import { LockKeyhole } from 'lucide-react';
import DashboardClient from './dashboard-client';
import SignInButton from './sign-in-button';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await currentUser();

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
          <SignInButton />
          <small className="signin-note">Only the configured Spiral Comics GitHub account can enter this workspace.</small>
        </section>
      </main>
    );
  }

  return <DashboardClient />;
}
