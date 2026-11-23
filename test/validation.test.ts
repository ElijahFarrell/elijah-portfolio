import { describe, expect, it } from 'vitest';
import { ERRORS } from '../lib/errors.js';
import { checkMessage, checkOrigin, checkSessionId, validateChatRequest } from '../lib/validation.js';

const SESSION = 'test-session-0123456789';

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://elijahvfg.com/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'elijahvfg.com', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('validation checks', () => {
  it('allows same-origin and no-origin requests, blocks other sites', () => {
    expect(checkOrigin(post({}))).toBeUndefined();
    expect(checkOrigin(post({}, { origin: 'https://elijahvfg.com' }))).toBeUndefined();
    expect(checkOrigin(post({}, { origin: 'https://evil.example' }))).toBe(ERRORS.Forbidden);
  });

  it('checks the session id shape', () => {
    expect(checkSessionId(SESSION)).toBeUndefined();
    expect(checkSessionId('short')).toBe(ERRORS.InvalidSession);
    expect(checkSessionId(42)).toBe(ERRORS.InvalidSession);
  });

  it('checks the message is present and not too long', () => {
    expect(checkMessage('hi', 10)).toBeUndefined();
    expect(checkMessage('   ', 10)).toBe(ERRORS.Empty);
    expect(checkMessage('x'.repeat(11), 10)?.code).toBe('too_long');
  });
});

describe('validateChatRequest', () => {
  it('returns the trimmed fields for a good request', async () => {
    const result = await validateChatRequest(post({ sessionId: SESSION, message: '  Hello  ' }), 100);
    expect(result).toEqual({ ok: true, value: { sessionId: SESSION, message: 'Hello', turnstileToken: undefined } });
  });

  it('returns the first failing check', async () => {
    const notJson = await validateChatRequest(post('x', { 'content-type': 'text/plain' }), 100);
    expect(notJson).toEqual({ ok: false, error: ERRORS.NotJson });
    const badJson = await validateChatRequest(post('{'), 100);
    expect(badJson).toEqual({ ok: false, error: ERRORS.InvalidJson });
    const huge = await validateChatRequest(post({ sessionId: SESSION, message: 'x'.repeat(2000) }), 100);
    expect(huge.ok === false && huge.error.status).toBe(413);
  });
});
