import { getPublicMedia, verifyMediaSignature } from '@/lib/meta';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = (await context.params).id;
  const url = new URL(request.url);
  const expires = Number(url.searchParams.get('expires'));
  const signature = url.searchParams.get('sig') || '';
  if (!await verifyMediaSignature(id, expires, signature)) return Response.json({ error: 'Invalid or expired media link.' }, { status: 403 });
  const media = await getPublicMedia(id);
  if (!media) return Response.json({ error: 'Media not found.' }, { status: 404 });
  return new Response(media.stream, { headers: { 'content-type': media.contentType, 'cache-control': 'public, max-age=600' } });
}
