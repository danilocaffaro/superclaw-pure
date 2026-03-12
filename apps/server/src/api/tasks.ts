import type { FastifyInstance } from 'fastify';
import type { TaskRepository, Task } from '../db/tasks.js';

interface TaskFilters {
  sessionId?: string;
  squadId?: string;
  status?: string;
}

interface MoveBody {
  status: Task['status'];
}

export function registerTaskRoutes(app: FastifyInstance, tasks: TaskRepository) {
  // GET /tasks?sessionId=...&squadId=...&status=...
  app.get<{ Querystring: TaskFilters }>('/tasks', async (req) => {
    const { sessionId, squadId, status } = req.query;
    return { data: tasks.list({ sessionId, squadId, status }) };
  });

  // GET /tasks/:id
  app.get<{ Params: { id: string } }>('/tasks/:id', async (req, reply) => {
    const task = tasks.getById(req.params.id);
    if (!task) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    return { data: task };
  });

  // POST /tasks — create task
  app.post<{ Body: Partial<Task> & { title: string } }>('/tasks', async (req, reply) => {
    const { title } = req.body;
    if (!title?.trim()) {
      return reply.status(400).send({ error: { code: 'VALIDATION', message: 'title is required' } });
    }
    const task = tasks.create(req.body);
    return reply.status(201).send({ data: task });
  });

  // PATCH /tasks/:id — update task (status change, assignment, etc.)
  app.patch<{ Params: { id: string }; Body: Partial<Task> }>('/tasks/:id', async (req, reply) => {
    try {
      const task = tasks.update(req.params.id, req.body);
      return { data: task };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('not found')) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: msg } });
      }
      return reply.status(500).send({ error: { code: 'INTERNAL', message: msg } });
    }
  });

  // DELETE /tasks/:id
  app.delete<{ Params: { id: string } }>('/tasks/:id', async (req, reply) => {
    const deleted = tasks.delete(req.params.id);
    if (!deleted) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    return { data: { deleted: true } };
  });

  // POST /tasks/:id/move — move task to new status (kanban drag)
  app.post<{ Params: { id: string }; Body: MoveBody }>('/tasks/:id/move', async (req, reply) => {
    const { status } = req.body;
    const validStatuses: Task['status'][] = ['todo', 'doing', 'review', 'done'];
    if (!validStatuses.includes(status)) {
      return reply.status(400).send({ error: { code: 'VALIDATION', message: `status must be one of: ${validStatuses.join(', ')}` } });
    }
    try {
      const task = tasks.update(req.params.id, { status });
      return { data: task };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('not found')) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: msg } });
      }
      return reply.status(500).send({ error: { code: 'INTERNAL', message: msg } });
    }
  });
}
