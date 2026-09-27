import { getDb, getTokenKey } from '@/db';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function base64ToBytes(value: string): Uint8Array {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

async function cryptoKey(): Promise<CryptoKey> {
  const raw = base64ToBytes(getTokenKey());
  if (raw.byteLength !== 32) throw new Error('Token encryption key must contain 32 bytes.');
  return crypto.subtle.importKey('raw', raw.buffer as ArrayBuffer, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encrypt(value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cryptoKey(), encoder.encode(JSON.stringify(value)));
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

async function decrypt<T>(value: string): Promise<T> {
  const [iv, payload] = value.split('.');
  if (!iv || !payload) throw new Error('Stored secret is malformed.');
  const ivBytes = base64ToBytes(iv);
  const payloadBytes = base64ToBytes(payload);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes.buffer as ArrayBuffer }, await cryptoKey(), payloadBytes.buffer as ArrayBuffer);
  return JSON.parse(decoder.decode(decrypted)) as T;
}

export function createSecureStore<T>(namespace: string, ttlSeconds?: number) {
  return {
    async set(key: string, value: T): Promise<void> {
      const now = Date.now();
      const expiresAt = ttlSeconds ? now + ttlSeconds * 1000 : null;
      const encryptedValue = await encrypt(value);
      await getDb().prepare(`INSERT INTO oauth_store (namespace, key, encrypted_value, expires_at, updated_at)
        VALUES (?, ?, ?, ?, ?) ON CONFLICT(namespace, key) DO UPDATE SET encrypted_value = excluded.encrypted_value,
        expires_at = excluded.expires_at, updated_at = excluded.updated_at`).bind(namespace, key, encryptedValue, expiresAt, now).run();
    },
    async get(key: string): Promise<T | undefined> {
      const row = await getDb().prepare('SELECT encrypted_value, expires_at FROM oauth_store WHERE namespace = ? AND key = ?').bind(namespace, key).first<{ encrypted_value: string; expires_at: number | null }>();
      if (!row) return undefined;
      if (row.expires_at && row.expires_at < Date.now()) { await this.del(key); return undefined; }
      return decrypt<T>(row.encrypted_value);
    },
    async del(key: string): Promise<void> {
      await getDb().prepare('DELETE FROM oauth_store WHERE namespace = ? AND key = ?').bind(namespace, key).run();
    },
  };
}
