declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    POSTMASTER_TOKEN_KEY: string;
    POSTMASTER_OAUTH_PRIVATE_JWK: string;
    POSTMASTER_CRON_SECRET: string;
  }
}
