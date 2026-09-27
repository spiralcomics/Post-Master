import { getBlueskyClient } from '@/lib/bluesky';
import { createSecureStore } from '@/lib/secure-store';
import { authError, requireUserId } from '@/lib/user';

export async function GET(request: Request) {
  try {
    const userId = requireUserId(request);
    const url = new URL(request.url);
    const handle = (url.searchParams.get('handle') || 'spiralcomics.bsky.social').trim();
    const state = crypto.randomUUID();
    await createSecureStore<string>('bluesky-user-state', 900).set(state, userId);
    const authorizationUrl = await (await getBlueskyClient()).authorize(handle, { state });
    return Response.redirect(authorizationUrl.toString(), 302);
  } catch (error) {
    return authError(error) ?? Response.json({ error: error instanceof Error ? error.message : 'Unable to start Bluesky authorization.' }, { status: 500 });
  }
}
