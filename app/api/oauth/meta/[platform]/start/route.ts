import { metaAuthorizationUrl, metaConfigStore, metaCredentials, metaStateStore, type MetaPlatform } from '@/lib/meta';
import { authError, requireUserId } from '@/lib/user';

export async function GET(request: Request, context: { params: Promise<{ platform: string }> | { platform: string } }) {
  try {
    const userId = requireUserId(request);
    const platform = (await context.params).platform as MetaPlatform;
    if (!['instagram', 'threads'].includes(platform)) return Response.json({ error: 'Unsupported Meta platform.' }, { status: 404 });
    const config = await metaConfigStore().get(userId) || {};
    const { clientId } = metaCredentials(config, platform);
    const state = crypto.randomUUID();
    await metaStateStore().set(state, { userId, platform });
    return Response.redirect(metaAuthorizationUrl(platform, clientId, state).toString(), 302);
  } catch (error) { return authError(error) ?? Response.json({ error: error instanceof Error ? error.message : 'Unable to start Meta authorization.' }, { status: 500 }); }
}
