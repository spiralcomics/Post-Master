import { env } from 'cloudflare:workers';
import { publishDuePosts } from '@/lib/publish';

export async function POST(request: Request) {
  const expected = env.POSTMASTER_CRON_SECRET;
  const provided = request.headers.get('authorization');
  if (!expected || provided !== `Bearer ${expected}`) return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  const results = await publishDuePosts(undefined, 20);
  return Response.json({ processed: results.length, results });
}
