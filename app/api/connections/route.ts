import { getDb } from '@/db';
import { authError, requireUserId } from '@/lib/user';

export async function GET(request: Request) {
  try {
    const userId = requireUserId(request);
    const rows = await getDb().prepare('SELECT platform, account_id, handle, display_name, status, updated_at FROM social_connections WHERE user_id = ? ORDER BY platform').bind(userId).all();
    return Response.json({ connections: rows.results });
  } catch (error) {
    return authError(error) ?? Response.json({ error: 'Unable to load account connections.' }, { status: 500 });
  }
}
