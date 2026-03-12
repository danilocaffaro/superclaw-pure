import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';

// ─── Constants ────────────────────────────────────────────────────────────────
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;

// ─── Key derivation ───────────────────────────────────────────────────────────
function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_LENGTH) as Buffer;
}

// ─── Encryption ───────────────────────────────────────────────────────────────
export function encrypt(
  plaintext: string,
  passphrase: string,
): { encrypted: string; iv: string; salt: string } {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return {
    encrypted: encrypted + tag.toString('hex'),
    iv: iv.toString('hex'),
    salt: salt.toString('hex'),
  };
}

// ─── Decryption ───────────────────────────────────────────────────────────────
export function decrypt(
  encryptedHex: string,
  iv: string,
  salt: string,
  passphrase: string,
): string {
  const key = deriveKey(passphrase, Buffer.from(salt, 'hex'));
  const tagStart = encryptedHex.length - TAG_LENGTH * 2;
  const encrypted = encryptedHex.slice(0, tagStart);
  const tag = Buffer.from(encryptedHex.slice(tagStart), 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CredentialRequest {
  id: string;
  sessionId: string;
  agentId: string | null;
  label: string;
  service: string;
  reason: string;
  status: 'pending' | 'provided' | 'expired' | 'cancelled';
  credentialId: string | null;
  oneTime: boolean;
  saveToVault: boolean;
  createdAt: string;
  expiresAt: string | null;
}

export interface VaultEntry {
  id: string;
  label: string;
  service: string;
  oneTime: boolean;
  used: boolean;
  createdAt: string;
  expiresAt: string | null;
}

// Note: VaultEntry never exposes encrypted_value in listing — only through decrypt endpoint
