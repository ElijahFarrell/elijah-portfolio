import type { TurnstileVerifier } from './limits.js';

// Checks a Cloudflare Turnstile token with the siteverify endpoint at `verifyUrl`.
export function createTurnstileVerifier(
  secret: string,
  verifyUrl: string,
  fetchImpl: typeof fetch = fetch,
): TurnstileVerifier {
  return async (token, ip) => {
    try {
      const body = new URLSearchParams({ secret, response: token });
      if (ip) body.set('remoteip', ip);
      const res = await fetchImpl(verifyUrl, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(5000),
      });
      const data = (await res.json()) as { success?: boolean };
      return data.success === true;
    } catch (err) {
      console.error('chat: turnstile verification failed', err);
      return false;
    }
  };
}
