// Bindings and variables from wrangler.jsonc (plus secrets set in the dashboard / .dev.vars)
interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  ANTHROPIC_API_KEY: string;
  /** Local development only */
  ANTHROPIC_BASE_URL?: string;
  /** Local development only: skip the Access check */
  DEV_SKIP_AUTH?: string;
}
