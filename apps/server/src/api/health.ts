import type { FastifyInstance } from 'fastify';

const VERSION = '0.1.0';

export function registerHealthRoutes(app: FastifyInstance) {
  app.get('/healthz', async () => {
    return {
      status: 'ok',
      version: VERSION,
      engine: 'native',
    };
  });

  app.get('/status', async () => {
    return {
      status: 'ok',
      version: VERSION,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      engine: { type: 'native' },
    };
  });

  app.get('/api/health', async () => {
    return {
      version: VERSION,
      buildTime: new Date().toISOString().slice(0, 10),
      nodeVersion: process.version,
      engine: 'native',
      uptime: Math.floor(process.uptime()),
    };
  });
}
