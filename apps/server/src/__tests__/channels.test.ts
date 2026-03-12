import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { ChannelRepository, initChannelSchema, type ChannelTypeConfig } from '../api/channels.js';

describe('ChannelRepository', () => {
  let db: Database.Database;
  let repo: ChannelRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    initChannelSchema(db);
    repo = new ChannelRepository(db);
  });

  describe('CRUD', () => {
    it('should create and retrieve a channel', () => {
      const config: ChannelTypeConfig = {
        type: 'telegram',
        botToken: 'tok_1234567890abcdef',
      };
      const ch = repo.create({
        name: 'Test Telegram',
        type: 'telegram',
        enabled: true,
        agentId: 'agent-1',
        config,
      });

      expect(ch.id).toBeTruthy();
      expect(ch.name).toBe('Test Telegram');
      expect(ch.type).toBe('telegram');
      expect(ch.enabled).toBe(true);
      expect(ch.agentId).toBe('agent-1');
      expect(ch.config).toEqual(config);
    });

    it('should list channels', () => {
      repo.create({ name: 'Ch1', type: 'telegram', enabled: true, agentId: '', config: { type: 'telegram', botToken: 'tok_1' } });
      repo.create({ name: 'Ch2', type: 'discord', enabled: false, agentId: '', config: { type: 'discord', webhookUrl: 'https://discord.com/api/webhooks/x' } });

      const list = repo.list();
      expect(list).toHaveLength(2);
    });

    it('should update a channel', () => {
      const ch = repo.create({ name: 'Old', type: 'slack', enabled: true, agentId: '', config: { type: 'slack', webhookUrl: 'https://hooks.slack.com/x' } });
      const updated = repo.update(ch.id, { name: 'New', enabled: false });
      expect(updated!.name).toBe('New');
      expect(updated!.enabled).toBe(false);
      expect(updated!.type).toBe('slack'); // Unchanged
    });

    it('should return undefined for updating non-existent channel', () => {
      expect(repo.update('nonexistent', { name: 'X' })).toBeUndefined();
    });

    it('should delete a channel', () => {
      const ch = repo.create({ name: 'ToDelete', type: 'webhook', enabled: true, agentId: '', config: { type: 'webhook', url: 'https://example.com' } });
      expect(repo.delete(ch.id)).toBe(true);
      expect(repo.get(ch.id)).toBeUndefined();
      expect(repo.list()).toHaveLength(0);
    });

    it('should return false for deleting non-existent channel', () => {
      expect(repo.delete('nonexistent')).toBe(false);
    });
  });

  describe('Message Logging', () => {
    it('should log inbound and outbound messages', () => {
      const ch = repo.create({ name: 'Log Test', type: 'telegram', enabled: true, agentId: '', config: { type: 'telegram', botToken: 'tok' } });

      repo.logMessage(ch.id, 'inbound', 'Hello from user', 'user123');
      repo.logMessage(ch.id, 'outbound', 'Hi back', undefined, 'user123');

      const msgs = db.prepare('SELECT * FROM channel_messages WHERE channel_id = ? ORDER BY created_at').all(ch.id) as any[];
      expect(msgs).toHaveLength(2);
      expect(msgs[0].direction).toBe('inbound');
      expect(msgs[0].from_id).toBe('user123');
      expect(msgs[0].content).toBe('Hello from user');
      expect(msgs[1].direction).toBe('outbound');
    });
  });

  describe('Schema Integrity', () => {
    it('should handle JSON config correctly', () => {
      const config: ChannelTypeConfig = {
        type: 'discord',
        webhookUrl: 'https://discord.com/api/webhooks/1234/abcdef',
        botToken: 'bot_token_here',
        guildId: '1234567890',
      };
      const ch = repo.create({ name: 'Discord', type: 'discord', enabled: true, agentId: 'a1', config });
      const retrieved = repo.get(ch.id);
      expect(retrieved!.config).toEqual(config);
    });

    it('should handle empty config gracefully', () => {
      const ch = repo.create({ name: 'Empty', type: 'webhook', enabled: true, agentId: '', config: { type: 'webhook' } });
      expect(ch.config).toEqual({ type: 'webhook' });
    });
  });
});
