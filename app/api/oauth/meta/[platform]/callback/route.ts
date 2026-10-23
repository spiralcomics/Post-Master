import { getDb } from '@/db';
import { exchangeMetaCode, metaConfigStore, metaStateStore, metaTokenStore, type MetaPlatform } from '@/lib/meta';
import { siteOrigin } from '@/lib/config';

export async function GET(request: Request, context: { params: Promise<{ platform: string }> }) {
  const url = new URL(request.url);
  const platform = (await context.params).platform as MetaPlatform;
  try {
    const state = url.searchParams.get('state'); const code = url.searchParams.get('code');
    if (!state || !code) throw new Error(url.searchParams.get('error_message') || 'Meta authorization was cancelled.');
    const saved = await metaStateStore().get(state); await metaStateStore().del(state);
    if (!saved || saved.platform !== platform) throw new Error('The Meta authorization session expired.');
    const config = await metaConfigStore().get(saved.userId) || {};
    const account = await exchangeMetaCode(platform, code, config);
    await metaTokenStore().set(`${saved.userId}:${platform}`, account.token);
    const now = Date.now();
    await getDb().prepare(`INSERT INTO social_connections (id, user_id, platform, account_id, handle, display_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'connected', ?, ?)
      ON CONFLICT(user_id, platform) DO UPDATE SET account_id = excluded.account_id, handle = excluded.handle, display_name = excluded.display_name, status = 'connected', updated_at = excluded.updated_at`)
      .bind(crypto.randomUUID(), saved.userId, platform, account.accountId, account.username, account.username, now, now).run();
    return Response.redirect(`${siteOrigin()}/?connected=${platform}`, 302);
  } catch (error) {
    const message = encodeURIComponent(error instanceof Error ? error.message : 'Meta connection failed.');
    return Response.redirect(`${siteOrigin()}/?connection_error=${message}`, 302);
  }
}
