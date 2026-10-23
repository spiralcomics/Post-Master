import { getDb } from '@/db';
import { publishDuePosts, publishPostDeliveries } from '@/lib/publish';
import { authError, requireUserId } from '@/lib/user';

const PLATFORMS = new Set(['bluesky', 'instagram', 'threads']);

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    await publishDuePosts(userId);
    const posts = await getDb().prepare(`SELECT id, content, link_url, media_id, scheduled_at, status, created_at, updated_at
      FROM posts WHERE user_id = ? ORDER BY COALESCE(scheduled_at, created_at) ASC LIMIT 100`).bind(userId).all();
    const deliveries = await getDb().prepare(`SELECT d.post_id, d.platform, d.status, d.external_url, d.error_message
      FROM post_deliveries d JOIN posts p ON p.id = d.post_id WHERE p.user_id = ?`).bind(userId).all();
    return Response.json({ posts: posts.results, deliveries: deliveries.results });
  } catch (error) {
    return authError(error) ?? Response.json({ error: 'Unable to load posts.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json() as { content?: unknown; linkUrl?: unknown; mediaId?: unknown; scheduledAt?: unknown; platforms?: unknown; publishNow?: unknown; draft?: unknown };
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const platforms = Array.isArray(body.platforms) ? [...new Set(body.platforms.map(String))] : [];
    if (!content) return Response.json({ error: 'Post copy is required.' }, { status: 400 });
    const isDraft = body.draft === true;
    if ((!isDraft && !platforms.length) || platforms.some((platform) => !PLATFORMS.has(platform))) return Response.json({ error: 'Choose at least one supported platform.' }, { status: 400 });
    if (platforms.includes('bluesky') && content.length > 300) return Response.json({ error: 'Bluesky posts are limited to 300 characters.' }, { status: 400 });

    const scheduledAt = typeof body.scheduledAt === 'string' && body.scheduledAt ? new Date(body.scheduledAt).getTime() : null;
    if (scheduledAt !== null && Number.isNaN(scheduledAt)) return Response.json({ error: 'The scheduled time is invalid.' }, { status: 400 });
    const linkUrl = typeof body.linkUrl === 'string' && body.linkUrl.trim() ? body.linkUrl.trim() : null;
    const mediaId = typeof body.mediaId === 'string' && body.mediaId ? body.mediaId : null;
    const now = Date.now();
    const id = crypto.randomUUID();
    const db = getDb();
    const initialStatus = isDraft ? 'draft' : body.publishNow === true ? 'publishing' : 'scheduled';
    const statements = [db.prepare(`INSERT INTO posts (id, user_id, content, link_url, media_id, scheduled_at, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, userId, content, linkUrl, mediaId, isDraft ? null : scheduledAt, initialStatus, now, now)];
    for (const platform of platforms) {
      const connection = await db.prepare('SELECT 1 AS connected FROM social_connections WHERE user_id = ? AND platform = ? AND status = ?').bind(userId, platform, 'connected').first();
      statements.push(db.prepare(`INSERT INTO post_deliveries (id, post_id, platform, status, attempts, updated_at) VALUES (?, ?, ?, ?, 0, ?)`)
        .bind(crypto.randomUUID(), id, platform, connection ? 'queued' : 'not_connected', now));
    }
    await db.batch(statements);

    let publishResults: unknown = null;
    if (body.publishNow === true) publishResults = await publishPostDeliveries(id, userId);
    return Response.json({ post: { id, status: initialStatus }, deliveries: publishResults }, { status: 201 });
  } catch (error) {
    return authError(error) ?? Response.json({ error: error instanceof Error ? error.message : 'Unable to save the post.' }, { status: 500 });
  }
}
