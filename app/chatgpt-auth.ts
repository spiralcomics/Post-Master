import { headers } from 'next/headers';

export type ChatGPTUser = {
  id: string;
  email: string | null;
};

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const id = requestHeaders.get('oai-authenticated-user-id');
  if (!id) return null;

  return {
    id,
    email: requestHeaders.get('oai-authenticated-user-email'),
  };
}

export function chatGPTSignInPath(returnTo = '/') {
  const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
  return `/signin-with-chatgpt?return_to=${encodeURIComponent(safeReturnTo)}`;
}
