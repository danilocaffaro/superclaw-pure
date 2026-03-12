import type { FastifyInstance } from 'fastify';
import { MarketplaceRepository } from '../db/marketplace.js';
import type Database from 'better-sqlite3';

export function registerMarketplaceRoutes(app: FastifyInstance, db: Database.Database): void {
  const marketplace = new MarketplaceRepository(db);

  // GET /marketplace — list skills with filters
  app.get<{
    Querystring: { category?: string; installed?: string; search?: string };
  }>('/marketplace', async (req, reply) => {
    try {
      const { category, installed, search } = req.query;
      const filters: { category?: string; installed?: boolean; search?: string } = {};
      if (category) filters.category = category;
      if (installed !== undefined) filters.installed = installed === 'true';
      if (search) filters.search = search;

      const skills = marketplace.list(filters);
      return { data: skills };
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: { code: 'INTERNAL', message: String(err) } });
    }
  });

  // GET /marketplace/:id — single skill details
  app.get<{ Params: { id: string } }>('/marketplace/:id', async (req, reply) => {
    try {
      const skill = marketplace.getById(req.params.id);
      if (!skill) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: `Skill '${req.params.id}' not found` } });
      }
      return { data: skill };
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: { code: 'INTERNAL', message: String(err) } });
    }
  });

  // POST /marketplace/:id/install
  app.post<{ Params: { id: string } }>('/marketplace/:id/install', async (req, reply) => {
    try {
      const skill = marketplace.install(req.params.id);
      return { data: skill };
    } catch (err) {
      const msg = String(err);
      if (msg.includes('not found')) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: msg } });
      }
      app.log.error(err);
      return reply.status(500).send({ error: { code: 'INTERNAL', message: msg } });
    }
  });

  // POST /marketplace/:id/uninstall
  app.post<{ Params: { id: string } }>('/marketplace/:id/uninstall', async (req, reply) => {
    try {
      const skill = marketplace.uninstall(req.params.id);
      return { data: skill };
    } catch (err) {
      const msg = String(err);
      if (msg.includes('not found')) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: msg } });
      }
      app.log.error(err);
      return reply.status(500).send({ error: { code: 'INTERNAL', message: msg } });
    }
  });

  // POST /marketplace/:id/rate — body: { rating: 1-5 }
  app.post<{
    Params: { id: string };
    Body: { rating: number };
  }>('/marketplace/:id/rate', async (req, reply) => {
    try {
      const { rating } = req.body ?? {};
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return reply.status(400).send({ error: { code: 'VALIDATION', message: 'rating must be a number between 1 and 5' } });
      }
      const skill = marketplace.rate(req.params.id, rating);
      return { data: skill };
    } catch (err) {
      const msg = String(err);
      if (msg.includes('not found')) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: msg } });
      }
      app.log.error(err);
      return reply.status(500).send({ error: { code: 'INTERNAL', message: msg } });
    }
  });
}
