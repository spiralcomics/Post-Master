import { put } from '@vercel/blob';
import { getDb } from '@/db';
import { authError, requireUserId } from '@/lib/user';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 2_000_000;

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const form = await request.formData();
    const file = form.get('file');
    const altText = String(form.get('altText') || '').trim();
    if (!(file instanceof File)) return Response.json({ error: 'Choose an image to upload.' }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: 'Use a JPEG, PNG, or WebP image.' }, { status: 400 });
    if (file.size > MAX_BYTES) return Response.json({ error: 'Images must be 2 MB or smaller for Bluesky.' }, { status: 400 });

    const id = crypto.randomUUID();
    const objectKey = `${userId}/${id}`;
    const blob = await put(objectKey, file, { access: 'private', addRandomSuffix: false, contentType: file.type });
    await getDb().prepare(`INSERT INTO media_assets (id, user_id, object_key, filename, content_type, size_bytes, alt_text, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, userId, blob.url, file.name, file.type, file.size, altText || null, Date.now()).run();
    return Response.json({ media: { id, filename: file.name, contentType: file.type, sizeBytes: file.size, altText } }, { status: 201 });
  } catch (error) {
    return authError(error) ?? Response.json({ error: error instanceof Error ? error.message : 'Image upload failed.' }, { status: 500 });
  }
}
