import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface AuditEntry {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

interface RawRow {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: string;
  ip_address: string | null;
  created_at: string;
}

function toEntry(row: RawRow): AuditEntry {
  return {
    id: row.id,
    userId: row.user_id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    details: JSON.parse(row.details || '{}') as Record<string, unknown>,
    ipAddress: row.ip_address,
    createdAt: row.created_at,
  };
}

export class AuditRepository {
  constructor(private db: Database.Database) {}

  log(entry: Omit<AuditEntry, 'id' | 'createdAt'>): AuditEntry {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, details, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .run(
        id,
        entry.userId ?? null,
        entry.action,
        entry.resourceType ?? null,
        entry.resourceId ?? null,
        JSON.stringify(entry.details ?? {}),
        entry.ipAddress ?? null,
      );

    const row = this.db.prepare('SELECT * FROM audit_log WHERE id = ?').get(id) as RawRow;
    return toEntry(row);
  }

  list(filters?: { userId?: string; action?: string; limit?: number }): AuditEntry[] {
    let query = 'SELECT * FROM audit_log WHERE 1=1';
    const params: (string | number)[] = [];

    if (filters?.userId) {
      query += ' AND user_id = ?';
      params.push(filters.userId);
    }
    if (filters?.action) {
      query += ' AND action = ?';
      params.push(filters.action);
    }

    query += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    } else {
      query += ' LIMIT 500';
    }

    const rows = this.db.prepare(query).all(...params) as RawRow[];
    return rows.map(toEntry);
  }
}
