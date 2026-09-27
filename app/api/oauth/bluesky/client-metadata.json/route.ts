import { clientMetadata } from '@/lib/bluesky';

export function GET() {
  return Response.json(clientMetadata, { headers: { 'cache-control': 'public, max-age=3600' } });
}
