import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowRepository } from '../db/workflow-repository.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, emoji TEXT DEFAULT '⚡',
      description TEXT DEFAULT '', category TEXT DEFAULT 'development',
      steps TEXT NOT NULL DEFAULT '[]', is_builtin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL REFERENCES workflows(id),
      status TEXT NOT NULL DEFAULT 'pending', current_step INTEGER DEFAULT 0,
      params TEXT DEFAULT '{}', error TEXT, started_at DATETIME,
      completed_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS workflow_run_steps (
      id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
      step_index INTEGER NOT NULL, name TEXT NOT NULL, agent_role TEXT DEFAULT '',
      agent_id TEXT, status TEXT NOT NULL DEFAULT 'pending', input_context TEXT DEFAULT '',
      output TEXT DEFAULT '', duration_ms INTEGER DEFAULT 0,
      started_at DATETIME, completed_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_wrs_run ON workflow_run_steps(run_id);
  `);
  return db;
}

const sampleSteps = [
  { name: 'Design', agentRole: 'designer', description: 'Create design' },
  { name: 'Implement', agentRole: 'developer', description: 'Write code' },
];

describe('WorkflowRepository', () => {
  let db: Database.Database;
  let repo: WorkflowRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new WorkflowRepository(db);
  });

  describe('templates', () => {
    it('should create and retrieve a template', () => {
      const t = repo.createTemplate({ name: 'Test', emoji: '🧪', description: 'desc', category: 'dev', steps: sampleSteps, isBuiltin: false });
      expect(t.id).toBeDefined();
      expect(t.name).toBe('Test');
      const fetched = repo.getTemplate(t.id);
      expect(fetched).toBeTruthy();
      expect(fetched!.steps).toHaveLength(2);
    });

    it('should list templates', () => {
      repo.createTemplate({ name: 'A', emoji: '🅰️', description: '', category: 'dev', steps: [], isBuiltin: false });
      repo.createTemplate({ name: 'B', emoji: '🅱️', description: '', category: 'dev', steps: [], isBuiltin: false });
      expect(repo.listTemplates()).toHaveLength(2);
    });

    it('should update a template', () => {
      const t = repo.createTemplate({ name: 'Old', emoji: '⚡', description: '', category: 'dev', steps: [], isBuiltin: false });
      const updated = repo.updateTemplate(t.id, { name: 'New', emoji: '✨' });
      expect(updated!.name).toBe('New');
      expect(updated!.emoji).toBe('✨');
    });

    it('should delete a non-builtin template', () => {
      const t = repo.createTemplate({ name: 'Del', emoji: '🗑️', description: '', category: 'dev', steps: [], isBuiltin: false });
      expect(repo.deleteTemplate(t.id)).toBe(true);
      expect(repo.getTemplate(t.id)).toBeNull();
    });

    it('should NOT delete a builtin template', () => {
      const t = repo.createTemplate({ name: 'Builtin', emoji: '🔒', description: '', category: 'dev', steps: [], isBuiltin: true });
      expect(repo.deleteTemplate(t.id)).toBe(false);
      expect(repo.getTemplate(t.id)).toBeTruthy();
    });

    it('should seed builtins idempotently', () => {
      const builtins = [{ name: 'CI Pipeline', emoji: '🚀', description: 'CI', category: 'ops', steps: sampleSteps }];
      repo.seedBuiltins(builtins);
      repo.seedBuiltins(builtins); // second call should be idempotent
      const all = repo.listTemplates();
      expect(all.filter(t => t.name === 'CI Pipeline')).toHaveLength(1);
      expect(all[0].isBuiltin).toBe(true);
    });
  });

  describe('runs', () => {
    let templateId: string;

    beforeEach(() => {
      const t = repo.createTemplate({ name: 'Flow', emoji: '🔄', description: '', category: 'dev', steps: sampleSteps, isBuiltin: false });
      templateId = t.id;
    });

    it('should create a run with steps from template', () => {
      const run = repo.createRun(templateId, { branch: 'main' });
      expect(run.id).toBeDefined();
      expect(run.status).toBe('pending');
      expect(run.steps).toHaveLength(2);
      expect(run.steps[0].name).toBe('Design');
      expect(run.params).toEqual({ branch: 'main' });
    });

    it('should get run with all steps', () => {
      const run = repo.createRun(templateId);
      const fetched = repo.getRun(run.id);
      expect(fetched).toBeTruthy();
      expect(fetched!.steps).toHaveLength(2);
      expect(fetched!.steps[1].stepIndex).toBe(1);
    });

    it('should list runs filtered by status', () => {
      repo.createRun(templateId);
      repo.createRun(templateId);
      const run3 = repo.createRun(templateId);
      repo.updateRunStatus(run3.id, 'completed');

      expect(repo.listRuns('pending')).toHaveLength(2);
      expect(repo.listRuns('completed')).toHaveLength(1);
      expect(repo.listRuns()).toHaveLength(3);
    });

    it('should update run status', () => {
      const run = repo.createRun(templateId);
      repo.updateRunStatus(run.id, 'running');
      expect(repo.getRun(run.id)!.status).toBe('running');
      repo.updateRunStatus(run.id, 'failed', 'timeout');
      const failed = repo.getRun(run.id)!;
      expect(failed.status).toBe('failed');
      expect(failed.error).toBe('timeout');
      expect(failed.completedAt).toBeDefined();
    });

    it('should update step status with output and duration', () => {
      const run = repo.createRun(templateId);
      const stepId = run.steps[0].id;
      repo.updateStepStatus(stepId, 'running');
      expect(repo.getStep(stepId)!.status).toBe('running');
      expect(repo.getStep(stepId)!.startedAt).toBeDefined();

      repo.updateStepStatus(stepId, 'done', 'Design complete', 1500);
      const step = repo.getStep(stepId)!;
      expect(step.status).toBe('done');
      expect(step.output).toBe('Design complete');
      expect(step.durationMs).toBe(1500);
      expect(step.completedAt).toBeDefined();
    });
  });
});
