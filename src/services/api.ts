// Small wrapper around the Worker API (/api/*). The page and the API share one origin behind
// Cloudflare Access, so the login cookie is sent automatically.

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const LOGIN_EXPIRED = 'Your login has expired. Reload the page to log in again.';

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      ...init,
      headers: {
        ...(init.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch {
    // When the Access session has expired, the request is redirected to the login page on
    // another domain, which the browser blocks: that surfaces here as a network error.
    throw new ApiError(0, `Could not reach the server. ${LOGIN_EXPIRED}`);
  }

  if (response.status === 401) throw new ApiError(401, LOGIN_EXPIRED);

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await response.json() : null;
  if (!response.ok) {
    const message = (body as { error?: string } | null)?.error ?? `Server error ${response.status}`;
    throw new ApiError(response.status, message);
  }
  return body as T;
}

export const jsonBody = (data: unknown): RequestInit['body'] => JSON.stringify(data);
