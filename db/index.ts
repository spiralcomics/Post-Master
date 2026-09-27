import { env } from 'cloudflare:workers';

export function getDb(): D1Database { if (!env.DB) throw new Error('Database binding is unavailable.'); return env.DB; }
export function getFiles(): R2Bucket { if (!env.FILES) throw new Error('File storage binding is unavailable.'); return env.FILES; }
export function getTokenKey(): string { if (!env.POSTMASTER_TOKEN_KEY) throw new Error('Token encryption is not configured.'); return env.POSTMASTER_TOKEN_KEY; }
