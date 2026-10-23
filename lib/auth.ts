import { getServerSession, type NextAuthOptions } from 'next-auth';
import GitHubProvider from 'next-auth/providers/github';

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID || '',
      clientSecret: process.env.GITHUB_SECRET || '',
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      const allowedLogin = process.env.POSTMASTER_GITHUB_LOGIN?.trim().toLowerCase();
      const githubProfile = profile as { login?: unknown } | undefined;
      const login = typeof githubProfile?.login === 'string' ? githubProfile.login.toLowerCase() : '';
      return Boolean(allowedLogin && login === allowedLogin);
    },
  },
  pages: { signIn: '/' },
  session: { strategy: 'jwt' },
};

export async function currentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ? { id: 'owner', email: session.user.email || null } : null;
}
