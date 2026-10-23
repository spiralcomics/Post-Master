# Post Master

Post Master is the private Spiral Comics social publishing studio for Bluesky, Instagram, and Threads. This branch is configured for GitHub and Vercel using standard Next.js.

## Infrastructure

- Vercel hosts the Next.js application and API routes.
- Neon Postgres stores posts, account connections, and encrypted OAuth state.
- Vercel Blob stores post images.
- Auth.js limits access to one configured GitHub account.
- GitHub Actions checks for due posts hourly.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the values.
2. Create a Neon database and set `DATABASE_URL`.
3. Run `pnpm db:push` to create the schema.
4. Run `pnpm dev`.

## Vercel setup

1. Import this GitHub repository into Vercel with the Next.js preset.
2. Add a Neon integration and a public Vercel Blob store.
3. Add every variable from `.env.example` to Vercel. Set `APP_URL` and `NEXTAUTH_URL` to the production origin.
4. Create a GitHub OAuth app whose callback is `https://YOUR_DOMAIN/api/auth/callback/github`.
5. Run `pnpm db:push` locally against the production `DATABASE_URL` once.
6. Update Meta and Bluesky OAuth redirect configuration for the production domain, then reconnect each account.

## Hourly scheduling

Add these GitHub Actions repository secrets:

- `POSTMASTER_URL`: the production origin without a trailing slash.
- `POSTMASTER_CRON_SECRET`: the same random value configured in Vercel.

GitHub Actions schedules are best effort, so a post may be published somewhat later than the top of the hour.
