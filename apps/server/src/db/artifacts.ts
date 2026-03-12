import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface Artifact {
  id: string;
  sessionId: string | null;
  squadId: string | null;
  agentId: string | null;
  title: string;
  type: 'text' | 'code' | 'image' | 'file' | 'url';
  content: string;
  language: string | null;
  metadata: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactFilters {
  sessionId?: string;
  squadId?: string;
  agentId?: string;
  type?: string;
}

export class ArtifactRepository {
  constructor(private db: Database.Database) {}

  list(filters?: ArtifactFilters): Artifact[] {
    let sql = 'SELECT * FROM artifacts';
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.sessionId) { conditions.push('session_id = ?'); params.push(filters.sessionId); }
    if (filters?.squadId)   { conditions.push('squad_id = ?');   params.push(filters.squadId); }
    if (filters?.agentId)   { conditions.push('agent_id = ?');   params.push(filters.agentId); }
    if (filters?.type)      { conditions.push('type = ?');        params.push(filters.type); }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY created_at DESC';

    return (this.db.prepare(sql).all(...params) as Record<string, unknown>[]).map(this.rowToArtifact);
  }

  getById(id: string): Artifact | undefined {
    const row = this.db.prepare('SELECT * FROM artifacts WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToArtifact(row) : undefined;
  }

  create(data: Partial<Artifact> & { title: string }): Artifact {
    const id = data.id || randomUUID();
    this.db.prepare(
      `INSERT INTO artifacts (id, session_id, squad_id, agent_id, title, type, content, language, metadata, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      data.sessionId  ?? null,
      data.squadId    ?? null,
      data.agentId    ?? null,
      data.title,
      data.type       ?? 'text',
      data.content    ?? '',
      data.language   ?? null,
      JSON.stringify(data.metadata ?? {}),
      data.version    ?? 1,
    );
    return this.getById(id)!;
  }

  update(id: string, patch: Partial<Artifact>): Artifact {
    const existing = this.getById(id);
    if (!existing) throw new Error(`Artifact not found: ${id}`);

    const updates: string[] = ["updated_at = datetime('now')"];
    const params: unknown[] = [];

    if (patch.title    !== undefined) { updates.push('title = ?');    params.push(patch.title); }
    if (patch.type     !== undefined) { updates.push('type = ?');     params.push(patch.type); }
    if (patch.content  !== undefined) { updates.push('content = ?');  params.push(patch.content); }
    if (patch.language !== undefined) { updates.push('language = ?'); params.push(patch.language); }
    if (patch.metadata !== undefined) { updates.push('metadata = ?'); params.push(JSON.stringify(patch.metadata)); }
    if (patch.version  !== undefined) { updates.push('version = ?');  params.push(patch.version); }
    if (patch.sessionId !== undefined) { updates.push('session_id = ?'); params.push(patch.sessionId); }
    if (patch.squadId  !== undefined) { updates.push('squad_id = ?'); params.push(patch.squadId); }
    if (patch.agentId  !== undefined) { updates.push('agent_id = ?'); params.push(patch.agentId); }

    params.push(id);
    this.db.prepare(`UPDATE artifacts SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    return this.getById(id)!;
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM artifacts WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private rowToArtifact(row: Record<string, unknown>): Artifact {
    return {
      id:        row.id as string,
      sessionId: (row.session_id as string | null) ?? null,
      squadId:   (row.squad_id as string | null) ?? null,
      agentId:   (row.agent_id as string | null) ?? null,
      title:     row.title as string,
      type:      (row.type as Artifact['type']) ?? 'text',
      content:   (row.content as string) || '',
      language:  (row.language as string | null) ?? null,
      metadata:  JSON.parse((row.metadata as string) || '{}') as Record<string, unknown>,
      version:   (row.version as number) || 1,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
