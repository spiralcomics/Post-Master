import { getDb } from '@/db';
import { publishPostDeliveries } from '@/lib/publish';
import { authError, requireUserId } from '@/lib/user';

async function postId(context: { params: Promise<{ id: string }> }) {
  return (await context.params).id;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const id = await postId(context);
    const body = await request.json() as { content?: unknown; linkUrl?: unknown; scheduledAt?: unknown; action?: unknown; publishNow?: unknown };
    const db = getDb();
    const existing = await db.prepare('SELECT id, status FROM posts WHERE id = ? AND user_id = ?').bind(id, userId).first<{ id: string; status: string }>();
    if (!existing) return Response.json({ error: 'Post not found.' }, { status: 404 });
    if (existing.status === 'published' || existing.status === 'cancelled') return Response.json({ error: 'Published or cancelled posts cannot be changed.' }, { status: 409 });

    if (body.action === 'retry') {
      const now = Date.now();
      await db.batch([
        db.prepare("UPDATE posts SET status = 'publishing', updated_at = ? WHERE id = ?").bind(now, id),
        db.prepare("UPDATE post_deliveries SET status = 'failed', error_message = NULL, updated_at = ? WHERE post_id = ? AND platform = 'bluesky'").bind(now, id),
      ]);
      const results = await publishPostDeliveries(id, userId);
      return Response.json({ post: { id, status: results.some((result) => result.status === 'failed') ? 'failed' : 'published' }, deliveries: results });
    }

    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) return Response.json({ error: 'Post copy is required.' }, { status: 400 });
    if (content.length > 300) return Response.json({ error: 'Bluesky posts are limited to 300 characters.' }, { status: 400 });
    const scheduledAt = typeof body.scheduledAt === 'string' && body.scheduledAt ? new Date(body.scheduledAt).getTime() : null;
    if (scheduledAt !== null && Number.isNaN(scheduledAt)) return Response.json({ error: 'The scheduled time is invalid.' }, { status: 400 });
    const linkUrl = typeof body.linkUrl === 'string' && body.linkUrl.trim() ? body.linkUrl.trim() : null;
    const status = body.publishNow === true ? 'publishing' : scheduledAt === null ? 'draft' : 'scheduled';
    const now = Date.now();
    await db.batch([
      db.prepare('UPDATE posts SET content = ?, link_url = ?, scheduled_at = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(content, linkUrl, scheduledAt, status, now, id, userId),
      db.prepare("UPDATE post_deliveries SET status = 'queued', error_message = NULL, attempts = 0, updated_at = ? WHERE post_id = ? AND status != 'published'").bind(now, id),
    ]);
    if (body.publishNow === true) {
      const results = await publishPostDeliveries(id, userId);
      return Response.json({ post: { id, status: results.some((result) => result.status === 'failed') ? 'failed' : 'published' }, deliveries: results });
    }
    return Response.json({ post: { id, status } });
  } catch (error) {
    return authError(error) ?? Response.json({ error: error instanceof Error ? error.message : 'Unable to update the post.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const id = await postId(context);
    const db = getDb();
    const now = Date.now();
    const result = await db.prepare("UPDATE posts SET status = 'cancelled', updated_at = ? WHERE id = ? AND user_id = ? AND status NOT IN ('published', 'cancelled')").bind(now, id, userId).run();
    if (!result.meta.changes) return Response.json({ error: 'This post cannot be cancelled.' }, { status: 409 });
    await db.prepare("UPDATE post_deliveries SET status = 'cancelled', updated_at = ? WHERE post_id = ? AND status != 'published'").bind(now, id).run();
    return Response.json({ post: { id, status: 'cancelled' } });
  } catch (error) {
    return authError(error) ?? Response.json({ error: 'Unable to cancel the post.' }, { status: 500 });
  }
}
