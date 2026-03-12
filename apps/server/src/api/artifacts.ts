import type { FastifyInstance } from 'fastify';
import type { ArtifactRepository, Artifact, ArtifactFilters } from '../db/artifacts.js';

export function registerArtifactRoutes(app: FastifyInstance, artifacts: ArtifactRepository) {
  // GET /artifacts?sessionId=&squadId=&agentId=&type=
  app.get<{ Querystring: ArtifactFilters }>('/artifacts', async (req) => {
    const { sessionId, squadId, agentId, type } = req.query;
    return { data: artifacts.list({ sessionId, squadId, agentId, type }) };
  });

  // GET /artifacts/:id
  app.get<{ Params: { id: string } }>('/artifacts/:id', async (req, reply) => {
    const artifact = artifacts.getById(req.params.id);
    if (!artifact) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Artifact not found' } });
    }
    return { data: artifact };
  });

  // POST /artifacts — create
  app.post<{ Body: Partial<Artifact> & { title: string } }>('/artifacts', async (req, reply) => {
    const { title } = req.body;
    if (!title?.trim()) {
      return reply.status(400).send({ error: { code: 'VALIDATION', message: 'title is required' } });
    }
    const artifact = artifacts.create(req.body);
    return reply.status(201).send({ data: artifact });
  });

  // PATCH /artifacts/:id — update
  app.patch<{ Params: { id: string }; Body: Partial<Artifact> }>('/artifacts/:id', async (req, reply) => {
    try {
      const artifact = artifacts.update(req.params.id, req.body);
      return { data: artifact };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('not found')) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: msg } });
      }
      return reply.status(500).send({ error: { code: 'INTERNAL', message: msg } });
    }
  });

  // DELETE /artifacts/:id
  app.delete<{ Params: { id: string } }>('/artifacts/:id', async (req, reply) => {
    const deleted = artifacts.delete(req.params.id);
    if (!deleted) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Artifact not found' } });
    }
    return { data: { deleted: true } };
  });
}
