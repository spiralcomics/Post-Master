import { Agent } from '@atproto/api';
import { getDb } from '@/db';
import { getBlueskyClient, SITE_ORIGIN } from '@/lib/bluesky';
import { createSecureStore } from '@/lib/secure-store';

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const { session, state } = await (await getBlueskyClient()).callback(url.searchParams);
    if (!state) throw new Error('The Bluesky authorization state is missing.');
    const userState = createSecureStore<string>('bluesky-user-state', 900);
    const userId = await userState.get(state);
    await userState.del(state);
    if (!userId) throw new Error('The Bluesky authorization has expired.');

    const agent = new Agent(session);
    const profile = await agent.getProfile({ actor: session.did });
    const now = Date.now();
    await getDb().prepare(`INSERT INTO social_connections
      (id, user_id, platform, account_id, handle, display_name, status, created_at, updated_at)
      VALUES (?, ?, 'bluesky', ?, ?, ?, 'connected', ?, ?)
      ON CONFLICT(user_id, platform) DO UPDATE SET account_id = excluded.account_id, handle = excluded.handle,
      display_name = excluded.display_name, status = 'connected', updated_at = excluded.updated_at`)
      .bind(crypto.randomUUID(), userId, session.did, profile.data.handle, profile.data.displayName || profile.data.handle, now, now).run();
    return Response.redirect(`${SITE_ORIGIN}/?connected=bluesky`, 302);
  } catch (error) {
    const message = encodeURIComponent(error instanceof Error ? error.message : 'Bluesky connection failed.');
    return Response.redirect(`${SITE_ORIGIN}/?connection_error=${message}`, 302);
  }
}
