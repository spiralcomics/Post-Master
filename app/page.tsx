import { LockKeyhole } from 'lucide-react';
import DashboardClient from './dashboard-client';
import { chatGPTSignInPath, getChatGPTUser } from './chatgpt-auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getChatGPTUser();

  if (!user) {
    return (
      <main className="signin-shell">
        <section className="signin-card">
          <div className="brand signin-brand">
            <div className="brand-mark" aria-hidden="true"><span>S</span></div>
            <div><strong>POSTMASTER</strong><small>by Spiral Comics</small></div>
          </div>
          <div className="signin-icon" aria-hidden="true"><LockKeyhole size={25} /></div>
          <p className="eyebrow">PRIVATE WORKSPACE</p>
          <h1>Sign in to manage Spiral Comics</h1>
          <p>Your posts, schedules, uploads, and connected social accounts stay tied to your secure Postmaster profile.</p>
          <a className="signin-button" href={chatGPTSignInPath('/')} target="_top">Sign in with ChatGPT</a>
          <small className="signin-note">The Bluesky authorization service remains publicly discoverable, but your Postmaster data does not.</small>
        </section>
      </main>
    );
  }

  return <DashboardClient />;
}
