'use client';

import { signIn } from 'next-auth/react';

export default function SignInButton() {
  return <button className="signin-button" onClick={() => void signIn('github', { callbackUrl: '/' })}>Sign in with GitHub</button>;
}
