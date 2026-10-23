import { currentUser } from './auth';

export async function requireUserId(): Promise<string> {
  const user = await currentUser();
  if (!user) throw new Error('AUTH_REQUIRED');
  return user.id;
}

export function authError(error: unknown): Response | null {
  return error instanceof Error && error.message === 'AUTH_REQUIRED'
    ? Response.json({ error: 'Sign in is required.' }, { status: 401 })
    : null;
}
