import { get } from '@vercel/blob';
import { getDb, getTokenKey } from '@/db';
import { createSecureStore } from './secure-store';
import { siteOrigin } from './config';

export type MetaPlatform = 'instagram' | 'threads';
export type MetaConfig = {
  instagramClientId?: string;
  instagramClientSecret?: string;
  threadsClientId?: string;
  threadsClientSecret?: string;
};
export type MetaToken = { accessToken: string; expiresAt?: number };

const INSTAGRAM_GRAPH_VERSION = 'v24.0';
const THREADS_GRAPH_VERSION = 'v1.0';

export const metaConfigStore = () => createSecureStore<MetaConfig>('meta-config');
export const metaTokenStore = () => createSecureStore<MetaToken>('meta-token');
export const metaStateStore = () => createSecureStore<{ userId: string; platform: MetaPlatform }>('meta-oauth-state', 900);

export function metaCallback(platform: MetaPlatform) {
  return `${siteOrigin()}/api/oauth/meta/${platform}/callback`;
}

export function metaCredentials(config: MetaConfig, platform: MetaPlatform) {
  const clientId = platform === 'instagram' ? config.instagramClientId : config.threadsClientId;
  const clientSecret = platform === 'instagram' ? config.instagramClientSecret : config.threadsClientSecret;
  if (!clientId || !clientSecret) throw new Error(`${platform === 'instagram' ? 'Instagram' : 'Threads'} developer credentials are not configured.`);
  return { clientId, clientSecret };
}

export function metaAuthorizationUrl(platform: MetaPlatform, clientId: string, state: string) {
  const url = new URL(platform === 'instagram' ? 'https://www.instagram.com/oauth/authorize' : 'https://threads.net/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', metaCallback(platform));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  url.searchParams.set('scope', platform === 'instagram'
    ? 'instagram_business_basic,instagram_business_content_publish'
    : 'threads_basic,threads_content_publish');
  return url;
}

async function graphJson<T>(url: string | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json() as T & { error?: { message?: string }; error_message?: string };
  if (!response.ok || data.error) throw new Error(data.error?.message || data.error_message || `Meta request failed (${response.status}).`);
  return data;
}

export async function exchangeMetaCode(platform: MetaPlatform, code: string, config: MetaConfig) {
  const { clientId, clientSecret } = metaCredentials(config, platform);
  const tokenUrl = platform === 'instagram' ? 'https://api.instagram.com/oauth/access_token' : 'https://graph.threads.net/oauth/access_token';
  const form = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', redirect_uri: metaCallback(platform), code });
  const short = await graphJson<{ access_token: string; user_id?: number | string }>(tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form });
  const exchangeUrl = new URL(platform === 'instagram' ? 'https://graph.instagram.com/access_token' : 'https://graph.threads.net/access_token');
  exchangeUrl.searchParams.set('grant_type', platform === 'instagram' ? 'ig_exchange_token' : 'th_exchange_token');
  exchangeUrl.searchParams.set('client_secret', clientSecret);
  exchangeUrl.searchParams.set('access_token', short.access_token);
  const long = await graphJson<{ access_token: string; expires_in?: number }>(exchangeUrl);
  const base = platform === 'instagram' ? 'https://graph.instagram.com' : `https://graph.threads.net/${THREADS_GRAPH_VERSION}`;
  const profileUrl = new URL(`${base}/me`);
  profileUrl.searchParams.set('fields', platform === 'instagram' ? 'user_id,username' : 'id,username');
  profileUrl.searchParams.set('access_token', long.access_token);
  const profile = await graphJson<{ id?: string; user_id?: string; username: string }>(profileUrl);
  return {
    token: { accessToken: long.access_token, expiresAt: long.expires_in ? Date.now() + long.expires_in * 1000 : undefined },
    accountId: String(profile.user_id || profile.id),
    username: profile.username,
  };
}

function keyBytes() {
  const decoded = atob(getTokenKey());
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

function hex(bytes: Uint8Array) { return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''); }

export async function signedMediaUrl(mediaId: string) {
  const media = await getDb().prepare('SELECT object_key FROM media_assets WHERE id = ?').bind(mediaId).first<{ object_key: string }>();
  if (!media) throw new Error('The attached image is no longer available.');
  if (media.object_key.startsWith('https://')) return media.object_key;
  const expires = Date.now() + 15 * 60 * 1000;
  const key = await crypto.subtle.importKey('raw', keyBytes(), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${mediaId}.${expires}`));
  return `${siteOrigin()}/api/media/public/${encodeURIComponent(mediaId)}?expires=${expires}&sig=${hex(new Uint8Array(signature))}`;
}

export async function verifyMediaSignature(mediaId: string, expires: number, signature: string) {
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const key = await crypto.subtle.importKey('raw', keyBytes(), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const bytes = signature.match(/.{2}/g)?.map((part) => Number.parseInt(part, 16));
  if (!bytes || bytes.length !== 32) return false;
  return crypto.subtle.verify('HMAC', key, Uint8Array.from(bytes), new TextEncoder().encode(`${mediaId}.${expires}`));
}

type PostRow = { content: string; link_url: string | null; media_id: string | null };
type ConnectionRow = { account_id: string; handle: string };
type MediaRow = { id: string; object_key: string; content_type: string };

export async function publishMeta(postId: string, userId: string, platform: MetaPlatform) {
  const db = getDb();
  const post = await db.prepare('SELECT content, link_url, media_id FROM posts WHERE id = ? AND user_id = ?').bind(postId, userId).first<PostRow>();
  const connection = await db.prepare('SELECT account_id, handle FROM social_connections WHERE user_id = ? AND platform = ? AND status = ?').bind(userId, platform, 'connected').first<ConnectionRow>();
  const token = await metaTokenStore().get(`${userId}:${platform}`);
  if (!post || !connection || !token) throw new Error(`${platform === 'instagram' ? 'Instagram' : 'Threads'} must be reconnected before publishing.`);
  const claimed = await db.prepare("UPDATE post_deliveries SET status = 'publishing', attempts = attempts + 1, updated_at = ? WHERE post_id = ? AND platform = ? AND status IN ('queued', 'failed')").bind(Date.now(), postId, platform).run();
  if (!claimed.meta.changes) return { status: 'already_processed' as const };

  try {
    const text = [post.content.trim(), post.link_url?.trim()].filter(Boolean).join('\n\n');
    let media: MediaRow | null = null;
    if (post.media_id) media = await db.prepare('SELECT id, object_key, content_type FROM media_assets WHERE id = ? AND user_id = ?').bind(post.media_id, userId).first<MediaRow>();
    if (platform === 'instagram' && !media) throw new Error('Instagram feed posts require an image. Attach an image and retry.');
    const imageUrl = media ? await signedMediaUrl(media.id) : undefined;
    const apiBase = platform === 'instagram' ? `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}` : `https://graph.threads.net/${THREADS_GRAPH_VERSION}`;
    const createPath = platform === 'instagram' ? `${apiBase}/${connection.account_id}/media` : `${apiBase}/${connection.account_id}/threads`;
    const createForm = new URLSearchParams({ access_token: token.accessToken });
    if (platform === 'instagram') { createForm.set('image_url', imageUrl!); createForm.set('caption', text); }
    else { createForm.set('media_type', imageUrl ? 'IMAGE' : 'TEXT'); createForm.set('text', text); if (imageUrl) createForm.set('image_url', imageUrl); }
    const container = await graphJson<{ id: string }>(createPath, { method: 'POST', body: createForm });
    const publishPath = platform === 'instagram' ? `${apiBase}/${connection.account_id}/media_publish` : `${apiBase}/${connection.account_id}/threads_publish`;
    const published = await graphJson<{ id: string }>(publishPath, { method: 'POST', body: new URLSearchParams({ creation_id: container.id, access_token: token.accessToken }) });
    let externalUrl: string | null = null;
    try {
      const permalink = new URL(`${apiBase}/${published.id}`); permalink.searchParams.set('fields', 'permalink'); permalink.searchParams.set('access_token', token.accessToken);
      externalUrl = (await graphJson<{ permalink?: string }>(permalink)).permalink || null;
    } catch { /* A permalink is helpful but not required for a successful publish. */ }
    const now = Date.now();
    await db.batch([
      db.prepare('UPDATE post_deliveries SET status = ?, external_id = ?, external_url = ?, error_message = NULL, published_at = ?, updated_at = ? WHERE post_id = ? AND platform = ?').bind('published', published.id, externalUrl, now, now, postId, platform),
      db.prepare("UPDATE posts SET status = CASE WHEN NOT EXISTS (SELECT 1 FROM post_deliveries WHERE post_id = ? AND status NOT IN ('published', 'not_connected')) THEN 'published' ELSE status END, updated_at = ? WHERE id = ?").bind(postId, now, postId),
    ]);
    return { status: 'published' as const, id: published.id, url: externalUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : `${platform} publishing failed.`;
    const now = Date.now();
    await db.batch([
      db.prepare('UPDATE post_deliveries SET status = ?, error_message = ?, updated_at = ? WHERE post_id = ? AND platform = ?').bind('failed', message, now, postId, platform),
      db.prepare("UPDATE posts SET status = 'failed', updated_at = ? WHERE id = ?").bind(now, postId),
    ]);
    throw error;
  }
}

export async function getPublicMedia(mediaId: string) {
  const media = await getDb().prepare('SELECT object_key, content_type FROM media_assets WHERE id = ?').bind(mediaId).first<{ object_key: string; content_type: string }>();
  if (!media) return null;
  const object = await get(media.object_key, { access: 'private' });
  return object?.statusCode === 200 ? { stream: object.stream, contentType: media.content_type } : null;
}
