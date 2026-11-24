// Every /api request must carry a valid Cloudflare Access token. Access sits in front of the
// Worker and adds it after login; checking it here as well means the API stays closed even if
// Access is misconfigured or the Worker is reached by another route.
import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksDomain = '';

export type AuthResult = { ok: true; email: string } | { ok: false; error: string };

export async function checkAccess(request: Request, env: Env): Promise<AuthResult> {
  // Local development only: set in .dev.vars, which is never deployed
  if (env.DEV_SKIP_AUTH === 'true') return { ok: true, email: 'local-dev' };

  // Fail closed: without the Access settings nothing gets in
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    return { ok: false, error: 'Login is not configured on the server' };
  }

  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return { ok: false, error: 'Not logged in' };

  if (!jwks || jwksDomain !== env.ACCESS_TEAM_DOMAIN) {
    jwks = createRemoteJWKSet(new URL(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`));
    jwksDomain = env.ACCESS_TEAM_DOMAIN;
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
      audience: env.ACCESS_AUD,
    });
    return { ok: true, email: typeof payload.email === 'string' ? payload.email : '' };
  } catch {
    return { ok: false, error: 'Login is invalid or has expired' };
  }
}
