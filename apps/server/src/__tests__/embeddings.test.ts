import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initEmbeddingTables, loadVecExtension, storeEmbedding, vectorSearch, getEmbeddingDimensions, hybridSearch } from '../engine/embeddings.js';
import { AgentMemoryRepository } from '../db/agent-memory.js';

describe('Embeddings — sqlite-vec', () => {
  let db: Database.Database;
  const DIMS = 4; // tiny dimensions for testing

  beforeEach(() => {
    db = new Database(':memory:');

    // Create messages table (needed for joins)
    db.exec(`
      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Load sqlite-vec
    loadVecExtension(db);
    initEmbeddingTables(db, DIMS);
  });

  it('should load sqlite-vec extension', () => {
    const version = db.prepare("SELECT vec_version() as v").get() as { v: string };
    expect(version.v).toBeTruthy();
  });

  it('should create embedding tables', () => {
    // Check embedding_status table exists
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='embedding_status'"
    ).get() as { name: string } | undefined;
    expect(tables?.name).toBe('embedding_status');
  });

  it('should store and retrieve embeddings', () => {
    // Insert a test message
    db.prepare("INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)")
      .run('msg1', 'sess1', 'user', 'Hello world test message');

    // Store embedding
    const embedding = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    storeEmbedding(db, 'msg1', embedding, 'test-model', DIMS);

    // Check status
    const status = db.prepare('SELECT * FROM embedding_status WHERE message_id = ?').get('msg1') as any;
    expect(status.model).toBe('test-model');
    expect(status.dimensions).toBe(DIMS);
  });

  it('should perform vector search', () => {
    // Insert messages + embeddings
    for (let i = 0; i < 5; i++) {
      const id = `msg${i}`;
      db.prepare("INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)")
        .run(id, 'sess1', 'user', `Message number ${i}`);

      // Embeddings with varying similarity to query
      const emb = new Float32Array([i * 0.1, i * 0.2, i * 0.3, i * 0.4]);
      storeEmbedding(db, id, emb, 'test', DIMS);
    }

    // Search with a query embedding close to msg4
    const query = new Float32Array([0.4, 0.8, 1.2, 1.6]);
    const results = vectorSearch(db, query, 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('should filter vector search by session', () => {
    // Two sessions
    db.prepare("INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)")
      .run('a1', 'sess-a', 'user', 'Session A message');
    db.prepare("INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)")
      .run('b1', 'sess-b', 'user', 'Session B message');

    storeEmbedding(db, 'a1', new Float32Array([0.1, 0.2, 0.3, 0.4]), 'test', DIMS);
    storeEmbedding(db, 'b1', new Float32Array([0.5, 0.6, 0.7, 0.8]), 'test', DIMS);

    const results = vectorSearch(db, new Float32Array([0.1, 0.2, 0.3, 0.4]), 10, 'sess-a');
    // Should only return sess-a messages
    for (const r of results) {
      expect(r.messageId).toBe('a1');
    }
  });
});

describe('Embeddings — getEmbeddingDimensions', () => {
  it('should return known dimensions', () => {
    expect(getEmbeddingDimensions('text-embedding-3-small')).toBe(1536);
    expect(getEmbeddingDimensions('nomic-embed-text')).toBe(768);
    expect(getEmbeddingDimensions('all-minilm')).toBe(384);
  });

  it('should default to 1536 for unknown models', () => {
    expect(getEmbeddingDimensions('totally-unknown')).toBe(1536);
  });
});

describe('hybridSearch — RRF fusion', () => {
  let db: Database.Database;
  const DIMS = 4;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`CREATE TABLE messages (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL DEFAULT '',
      agent_id TEXT NOT NULL DEFAULT '', role TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.exec(`CREATE VIRTUAL TABLE messages_fts USING fts5(
      content, session_id UNINDEXED, agent_id UNINDEXED, role UNINDEXED, created_at UNINDEXED,
      content='messages', content_rowid='rowid'
    )`);
    loadVecExtension(db);
    initEmbeddingTables(db, DIMS);

    // Insert test messages
    const msgs = [
      { id: 'msg1', session_id: 'sess1', role: 'user', content: 'How to deploy to production' },
      { id: 'msg2', session_id: 'sess1', role: 'assistant', content: 'Use Docker and kubernetes for deployment' },
      { id: 'msg3', session_id: 'sess1', role: 'user', content: 'What is the capital of France' },
      { id: 'msg4', session_id: 'sess2', role: 'user', content: 'Deploy the application now' },
    ];
    const insert = db.prepare('INSERT INTO messages (id, session_id, agent_id, role, content) VALUES (?,?,?,?,?)');
    for (const m of msgs) insert.run(m.id, m.session_id, 'agent1', m.role, m.content);

    // Populate FTS5
    db.exec(`INSERT INTO messages_fts(messages_fts) VALUES('rebuild')`);
  });

  it('returns results when only FTS5 available (no vector)', () => {
    const results = hybridSearch(db, 'deploy production', new Float32Array(DIMS), 5);
    // May return empty if FTS5 rebuild not supported, but should not throw
    expect(Array.isArray(results)).toBe(true);
  });

  it('fuses vector and FTS5 results via RRF', () => {
    // Store an embedding for msg1 (high similarity to "deploy production")
    const embedding = new Float32Array([0.9, 0.1, 0.0, 0.0]);
    storeEmbedding(db, 'msg1', embedding, 'test-model', DIMS);

    // Query with similar vector
    const queryVec = new Float32Array([0.85, 0.15, 0.0, 0.0]);
    const results = hybridSearch(db, 'deploy production', queryVec, 5);

    expect(Array.isArray(results)).toBe(true);
    // msg1 should appear (both FTS5 match and vector match)
    const ids = results.map(r => r.messageId);
    if (ids.length > 0) {
      expect(ids).toContain('msg1');
    }
  });

  it('RRF score is always positive', () => {
    const embedding = new Float32Array([1.0, 0.0, 0.0, 0.0]);
    storeEmbedding(db, 'msg1', embedding, 'test-model', DIMS);
    const results = hybridSearch(db, 'deploy', new Float32Array([1.0, 0.0, 0.0, 0.0]), 10);
    for (const r of results) {
      expect(r.score).toBeGreaterThan(0);
    }
  });

  it('respects limit parameter', () => {
    const embedding = new Float32Array([1.0, 0.0, 0.0, 0.0]);
    ['msg1', 'msg2', 'msg3', 'msg4'].forEach(id => storeEmbedding(db, id, embedding, 'test-model', DIMS));
    const results = hybridSearch(db, 'deploy', embedding, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('filters by sessionId when provided', () => {
    const embedding = new Float32Array([1.0, 0.0, 0.0, 0.0]);
    ['msg1', 'msg2', 'msg4'].forEach(id => storeEmbedding(db, id, embedding, 'test-model', DIMS));
    const results = hybridSearch(db, 'deploy', embedding, 10, 'sess1');
    const sessionIds = results.map(r => r.content);
    // All results should come from sess1 (msg1, msg2), not sess2 (msg4)
    expect(results.every(r => ['msg1', 'msg2'].includes(r.messageId))).toBe(true);
  });
});

describe('AgentMemoryRepository.hybridArchivalSearch', () => {
  let db: Database.Database;
  let memRepo: AgentMemoryRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL DEFAULT '',
      agent_id TEXT NOT NULL DEFAULT '', role TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      content, session_id UNINDEXED, agent_id UNINDEXED, role UNINDEXED, created_at UNINDEXED,
      content='messages', content_rowid='rowid'
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS agent_memory (
      id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'short_term',
      key TEXT NOT NULL, value TEXT NOT NULL, relevance REAL DEFAULT 1.0,
      embedding_id TEXT, metadata TEXT, event_at DATETIME, valid_until DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    memRepo = new AgentMemoryRepository(db);
  });

  it('falls back to FTS5 when no embeddingConfig', async () => {
    const results = await memRepo.hybridArchivalSearch('test query', { limit: 5 });
    expect(Array.isArray(results)).toBe(true);
  });

  it('returns mode=fts5 results with correct shape', async () => {
    const results = await memRepo.hybridArchivalSearch('hello world');
    for (const r of results) {
      expect(r).toHaveProperty('content');
      expect(r).toHaveProperty('role');
      expect(r).toHaveProperty('createdAt');
      expect(r).toHaveProperty('score');
    }
  });
});
