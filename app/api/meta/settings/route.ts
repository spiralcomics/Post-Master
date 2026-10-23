import { metaConfigStore, type MetaConfig } from '@/lib/meta';
import { authError, requireUserId } from '@/lib/user';

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const config = await metaConfigStore().get(userId) || {};
    return Response.json({ instagram: { configured: Boolean(config.instagramClientId && config.instagramClientSecret), clientId: config.instagramClientId || '' }, threads: { configured: Boolean(config.threadsClientId && config.threadsClientSecret), clientId: config.threadsClientId || '' } });
  } catch (error) { return authError(error) ?? Response.json({ error: 'Unable to load Meta settings.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json() as MetaConfig;
    const previous = await metaConfigStore().get(userId) || {};
    const next: MetaConfig = {
      instagramClientId: body.instagramClientId?.trim() || previous.instagramClientId,
      instagramClientSecret: body.instagramClientSecret?.trim() || previous.instagramClientSecret,
      threadsClientId: body.threadsClientId?.trim() || previous.threadsClientId,
      threadsClientSecret: body.threadsClientSecret?.trim() || previous.threadsClientSecret,
    };
    await metaConfigStore().set(userId, next);
    return Response.json({ instagram: { configured: Boolean(next.instagramClientId && next.instagramClientSecret), clientId: next.instagramClientId || '' }, threads: { configured: Boolean(next.threadsClientId && next.threadsClientSecret), clientId: next.threadsClientId || '' } });
  } catch (error) { return authError(error) ?? Response.json({ error: 'Unable to save Meta settings.' }, { status: 500 }); }
}
