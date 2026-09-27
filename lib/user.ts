export function requireUserId(request: Request): string {
  const userId = request.headers.get('oai-authenticated-user-id');
  if (!userId) throw new Error('AUTH_REQUIRED');
  return userId;
}

export function authError(error: unknown): Response | null {
  return error instanceof Error && error.message === 'AUTH_REQUIRED'
    ? Response.json({ error: 'Sign in is required.' }, { status: 401 })
    : null;
}
