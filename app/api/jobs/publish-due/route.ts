import { publishDuePosts } from '@/lib/publish';

async function publish(request: Request) {
  const expected = process.env.POSTMASTER_CRON_SECRET;
  const provided = request.headers.get('authorization');
  if (!expected || provided !== `Bearer ${expected}`) return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  const results = await publishDuePosts(undefined, 20);
  return Response.json({ processed: results.length, results });
}

export const GET = publish;
export const POST = publish;
