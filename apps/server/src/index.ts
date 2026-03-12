/**
 * SuperClaw Pure — Server Entry Point
 * 
 * This is the "Pure" version: no OpenClaw Bridge dependency.
 * All LLM communication goes through the native chat engine.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import {
  initDatabase,
  AgentRepository,
  SquadRepository,
  SquadMemberRepository,
  ProviderRepository,
  TaskRepository,
  ArtifactRepository,
  DatasetRepository,
  FinetuneJobRepository,
  AgentMemoryRepository,
} from './db/index.js';
import { MarketplaceRepository } from './db/marketplace.js';
import { UserRepository } from './db/users.js';
import { registerHealthRoutes } from './api/health.js';
import { registerAgentRoutes } from './api/agents.js';
import { registerSquadRoutes } from './api/squads.js';
import { registerSessionRoutes } from './api/sessions.js';
import { registerConfigRoutes } from './api/config.js';
import { registerProviderRoutes } from './api/providers.js';
import { registerSSERoutes } from './api/sse.js';
import { memoryRoutes } from './api/memory.js';
import { planRoutes } from './api/plans.js';
import { skillRoutes } from './api/skills.js';
import { heartbeatRoutes } from './api/heartbeat.js';
import { questionRoutes } from './api/questions.js';
import { registerTaskRoutes } from './api/tasks.js';
import { registerFileRoutes } from './api/files.js';
import { registerBrowserRoutes } from './api/browser.js';
import { registerArtifactRoutes } from './api/artifacts.js';
import { registerMCPRoutes } from './api/mcp.js';
import { registerDataRoutes } from './api/data.js';
import { registerPresentationRoutes } from './api/presentations.js';
import { registerMarketplaceRoutes } from './api/marketplace.js';
import { registerAuthRoutes } from './api/auth.js';
import { registerFinetuneRoutes } from './api/finetune.js';
import { registerCredentialRoutes } from './api/credentials.js';
import { CredentialRepository } from './db/credentials.js';
import { registerPreviewRoutes } from './api/preview.js';
import { registerConsoleRoutes } from './api/console.js';
import { registerWorkflowRoutes } from './api/workflows.js';
import { registerSetupRoutes } from './api/setup.js';
import { registerPublicChatRoutes } from './api/public-chat.js';
import { registerBacklogRoutes } from './api/backlog.js';
import { WorkflowRepository } from './db/workflow-repository.js';
import { WorkflowEngine, seedBuiltinWorkflows } from './engine/workflow-engine.js';
import { getMessageBus } from './engine/message-bus.js';
import { logger } from './lib/logger.js';

const PORT = parseInt(process.env.SUPERCLAW_PORT ?? '4070', 10);
const HOST = process.env.SUPERCLAW_HOST ?? '0.0.0.0';
const VERSION = '0.1.0';

async function main() {
  // ─── Initialize SQLite ──────────────────────────────────────────────────
  const db = initDatabase();
  const agents = new AgentRepository(db);
  const squads = new SquadRepository(db);
  const squadMembers = new SquadMemberRepository(db);
  const providers = new ProviderRepository(db);
  const tasks = new TaskRepository(db);
  const artifactRepo = new ArtifactRepository(db);
  const finetuneDatasets = new DatasetRepository(db);
  const finetuneJobs = new FinetuneJobRepository(db);
  const credentialRepo = new CredentialRepository(db);
  const agentMemoryRepo = new AgentMemoryRepository(db);

  // Workflow subsystem
  const workflowRepo = new WorkflowRepository(db);
  const bus = getMessageBus();
  const workflowEngine = new WorkflowEngine(workflowRepo, bus);
  seedBuiltinWorkflows(workflowRepo);

  // Seed defaults on first run
  providers.seedDefaults();
  const marketplace = new MarketplaceRepository(db);
  marketplace.seed();
  const userRepo = new UserRepository(db);
  userRepo.seedOwner();

  // ─── Log configured providers ─────────────────────────────────────────
  const providerList = providers.list();
  const enabledProviders = providerList.filter(p => p.enabled);
  if (enabledProviders.length > 0) {
    const names = enabledProviders.map(p => `${p.name} (${p.models.length} models)`);
    logger.info(`   Providers: ${names.join(', ')}`);
  } else {
    logger.info('   Providers: ⚠️  None configured — open browser to run Setup Wizard');
  }

  // ─── No Bridge needed! ────────────────────────────────────────────────
  // SuperClaw Pure uses native chat engine (engine/chat-engine.ts)
  // All LLM calls go directly from server → provider API
  logger.info('[Engine] Native mode — direct LLM communication (no Bridge)');

  // ─── Create Fastify server ────────────────────────────────────────────
  const isDev = process.env.NODE_ENV !== 'production';

  // /api/ prefix rewrite — frontend calls /api/* but routes are at root
  const nativeApiPrefixes = [
    '/api/auth/',
    '/api/config/database/', '/api/config/database',
    '/api/config/integrations',
    '/api/console/',
    '/api/files/upload',
    '/api/health',
    '/api/preview/',
    '/api/agents/status/stream',
  ];

  const app = Fastify({
    logger: {
      level: 'info',
      ...(isDev ? {
        transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
      } : {}),
    },
    rewriteUrl: (req) => {
      const url = req.url ?? '/';
      if (!url.startsWith('/api/')) return url;
      const urlPath = url.split('?')[0];
      for (const prefix of nativeApiPrefixes) {
        if (prefix.endsWith('/')) {
          if (urlPath.startsWith(prefix)) return url;
        } else {
          if (urlPath === prefix) return url;
        }
      }
      return url.replace(/^\/api/, '') || '/';
    },
  });

  // CORS
  const corsOrigins: (string | RegExp)[] = process.env.SUPERCLAW_CORS_ORIGINS
    ? process.env.SUPERCLAW_CORS_ORIGINS.split(',').map(s => s.trim())
    : [
        'http://localhost:4080',
        'http://localhost:3000',
        'http://127.0.0.1:4080',
        /^https?:\/\/.*\.ts\.net$/,
      ];
  await app.register(cors, { origin: corsOrigins });
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });

  // ─── Rate limiter ─────────────────────────────────────────────────────
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
  const RATE_LIMIT = 600;
  const RATE_WINDOW = 60_000;

  app.addHook('onRequest', async (req, reply) => {
    const key = req.ip;
    const now = Date.now();
    let entry = rateLimitMap.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + RATE_WINDOW };
      rateLimitMap.set(key, entry);
    }
    entry.count++;
    reply.header('X-RateLimit-Limit', RATE_LIMIT);
    reply.header('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT - entry.count));
    if (entry.count > RATE_LIMIT) {
      reply.status(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
    }
  });

  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key);
    }
  }, 5 * 60_000);

  // ─── Static SPA serving ───────────────────────────────────────────────
  const webDir = process.env.SUPERCLAW_WEB_DIR
    || (() => {
      const monorepoOut = join(import.meta.dirname, '..', '..', 'web', 'out');
      return existsSync(join(monorepoOut, 'index.html')) ? monorepoOut : undefined;
    })();

  if (webDir && existsSync(webDir)) {
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
      '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon', '.txt': 'text/plain', '.woff2': 'font/woff2',
      '.woff': 'font/woff', '.ttf': 'font/ttf', '.webp': 'image/webp',
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
      '.webmanifest': 'application/manifest+json', '.map': 'application/json',
    };

    app.addHook('onRequest', async (req, reply) => {
      if (req.method !== 'GET') return;
      if (req.url.startsWith('/api/')) return;

      const apiPrefixes = ['/healthz', '/agents', '/sessions', '/squads', '/tasks',
        '/providers', '/config', '/sse', '/memory', '/plans', '/skills', '/heartbeat',
        '/questions', '/credentials', '/files', '/artifacts', '/browser', '/mcp',
        '/datasets', '/presentation', '/marketplace', '/auth', '/finetune',
        '/workflows', '/workflow-runs', '/setup', '/debug', '/console',
        '/n8n', '/preview', '/audit', '/integrations', '/webhooks',
        '/public', '/shared-links', '/backlog'];
      if (apiPrefixes.some(p => req.url.startsWith(p))) return;

      if (req.url.startsWith('/_next/')) {
        const filePath = join(webDir, req.url);
        if (existsSync(filePath)) {
          const ext = extname(filePath);
          reply.header('Content-Type', mimeTypes[ext] || 'application/octet-stream');
          reply.header('Cache-Control', 'public, max-age=31536000, immutable');
          return reply.send(readFileSync(filePath));
        }
      }

      const safePath = req.url.split('?')[0];
      const filePath = join(webDir, safePath === '/' ? 'index.html' : safePath);
      if (existsSync(filePath)) {
        const ext = extname(filePath);
        if (ext) {
          reply.header('Content-Type', mimeTypes[ext] || 'application/octet-stream');
          if (ext !== '.html') reply.header('Cache-Control', 'public, max-age=31536000, immutable');
          return reply.send(readFileSync(filePath));
        }
      }

      const indexPath = join(webDir, 'index.html');
      if (existsSync(indexPath)) {
        reply.header('Content-Type', 'text/html');
        reply.header('Cache-Control', 'no-cache');
        return reply.send(readFileSync(indexPath));
      }
    });

    logger.info(`[Static] Serving web from ${webDir}`);
  }

  // ─── Routes ───────────────────────────────────────────────────────────
  registerHealthRoutes(app);
  registerSessionRoutes(app);
  registerAgentRoutes(app, agents, agentMemoryRepo);
  registerSquadRoutes(app, squads, squadMembers);
  registerConfigRoutes(app);
  registerProviderRoutes(app, providers);
  registerSSERoutes(app);
  app.register(memoryRoutes);
  app.register(planRoutes);
  app.register(skillRoutes);
  app.register(heartbeatRoutes);
  app.register(questionRoutes);
  registerTaskRoutes(app, tasks);
  registerFileRoutes(app, process.cwd());
  registerArtifactRoutes(app, artifactRepo);
  registerBrowserRoutes(app);
  registerMCPRoutes(app);
  registerDataRoutes(app);
  registerPresentationRoutes(app);
  registerMarketplaceRoutes(app, db);
  registerAuthRoutes(app, db);
  registerFinetuneRoutes(app, finetuneDatasets, finetuneJobs);
  registerConsoleRoutes(app);
  registerCredentialRoutes(app, credentialRepo);
  registerPreviewRoutes(app);
  registerWorkflowRoutes(app, workflowRepo, workflowEngine);
  registerSetupRoutes(app, providers);
  registerPublicChatRoutes(app);
  registerBacklogRoutes(app);

  // ─── Start ────────────────────────────────────────────────────────────
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log('');
    console.log(`  ✨ SuperClaw Pure v${VERSION}`);
    console.log(`  → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`  → Engine: Native (direct LLM)`);
    console.log(`  → Providers: ${enabledProviders.length > 0 ? enabledProviders.map(p => p.name).join(', ') : 'None (run Setup Wizard)'}`);
    console.log(`  → Agents: ${agents.list().length}`);
    console.log('');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = () => {
    logger.info('\n✨ Shutting down...');
    db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
