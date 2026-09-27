import { Agent, RichText } from '@atproto/api';
import { getDb, getFiles } from '@/db';
import { getBlueskyAgent } from './bluesky';

type PostRow = { id: string; user_id: string; content: string; link_url: string | null; media_id: string | null };
type ConnectionRow = { account_id: string; handle: string };
type MediaRow = { object_key: string; content_type: string; alt_text: string | null };

export async function publishBluesky(postId: string, userId: string) {
  const db = getDb();
  const post = await db.prepare('SELECT id, user_id, content, link_url, media_id FROM posts WHERE id = ? AND user_id = ?').bind(postId, userId).first<PostRow>();
  if (!post) throw new Error('Post not found.');
  const connection = await db.prepare("SELECT account_id, handle FROM social_connections WHERE user_id = ? AND platform = 'bluesky' AND status = 'connected'").bind(userId).first<ConnectionRow>();
  if (!connection) throw new Error('Connect Bluesky before publishing.');

  const claimed = await db.prepare("UPDATE post_deliveries SET status = 'publishing', attempts = attempts + 1, updated_at = ? WHERE post_id = ? AND platform = 'bluesky' AND status IN ('queued', 'failed')").bind(Date.now(), postId).run();
  if (!claimed.meta.changes) return { status: 'already_processed' as const };

  try {
    const agent = await getBlueskyAgent(connection.account_id);
    const text = [post.content.trim(), post.link_url?.trim()].filter(Boolean).join('\n\n');
    const richText = new RichText({ text });
    await richText.detectFacets(agent);
    let embed: Parameters<Agent['post']>[0]['embed'];

    if (post.media_id) {
      const media = await db.prepare('SELECT object_key, content_type, alt_text FROM media_assets WHERE id = ? AND user_id = ?').bind(post.media_id, userId).first<MediaRow>();
      if (media) {
        const object = await getFiles().get(media.object_key);
        if (!object) throw new Error('The attached image is no longer available.');
        const uploaded = await agent.uploadBlob(new Uint8Array(await object.arrayBuffer()), { encoding: media.content_type });
        embed = { $type: 'app.bsky.embed.images' as const, images: [{ alt: media.alt_text || '', image: uploaded.data.blob }] };
      }
    }

    const response = await agent.post({ text: richText.text, facets: richText.facets, embed, createdAt: new Date().toISOString() });
    const rkey = response.uri.split('/').pop();
    const externalUrl = `https://bsky.app/profile/${connection.handle}/post/${rkey}`;
    const now = Date.now();
    await db.batch([
      db.prepare("UPDATE post_deliveries SET status = 'published', external_id = ?, external_url = ?, error_message = NULL, published_at = ?, updated_at = ? WHERE post_id = ? AND platform = 'bluesky'").bind(response.uri, externalUrl, now, now, postId),
      db.prepare("UPDATE posts SET status = CASE WHEN NOT EXISTS (SELECT 1 FROM post_deliveries WHERE post_id = ? AND status NOT IN ('published', 'not_connected')) THEN 'published' ELSE status END, updated_at = ? WHERE id = ?").bind(postId, now, postId),
    ]);
    return { status: 'published' as const, uri: response.uri, url: externalUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Bluesky publishing failed.';
    await db.prepare("UPDATE post_deliveries SET status = 'failed', error_message = ?, updated_at = ? WHERE post_id = ? AND platform = 'bluesky'").bind(message, Date.now(), postId).run();
    throw error;
  }
}
