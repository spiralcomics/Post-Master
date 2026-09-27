import { getBlueskyJwks } from '@/lib/bluesky';

export async function GET() {
  return Response.json(await getBlueskyJwks(), { headers: { 'cache-control': 'public, max-age=3600' } });
}
