import { ERRORS, tooLong, type ApiError } from './errors.js';

export type ChatRequest = { sessionId: string; message: string; turnstileToken: string | undefined };

export type Validated<T> = { ok: true; value: T } | { ok: false; error: ApiError };

// Session IDs are random strings the browser makes (crypto.randomUUID or similar).
const SESSION_ID = /^[A-Za-z0-9_-]{16,64}$/;

// Each check returns the error to send, or undefined when the request passes.

// Browsers send Origin on cross-site POSTs. Only the site itself may call the API.
export function checkOrigin(request: Request): ApiError | undefined {
  const origin = request.headers.get('origin');
  if (!origin) return undefined;
  try {
    const host = request.headers.get('host') ?? new URL(request.url).host;
    return new URL(origin).host === host ? undefined : ERRORS.Forbidden;
  } catch {
    return ERRORS.Forbidden;
  }
}

export function checkContentType(request: Request): ApiError | undefined {
  return request.headers.get('content-type')?.includes('application/json') ? undefined : ERRORS.NotJson;
}

export function checkBodySize(raw: string, maxInputChars: number): ApiError | undefined {
  // Room for JSON escaping of a maximum-length question, plus the other fields.
  return raw.length > maxInputChars * 6 + 1024 ? tooLong(maxInputChars) : undefined;
}

export function checkSessionId(sessionId: unknown): ApiError | undefined {
  return typeof sessionId === 'string' && SESSION_ID.test(sessionId) ? undefined : ERRORS.InvalidSession;
}

export function checkMessage(message: unknown, maxInputChars: number): ApiError | undefined {
  if (typeof message !== 'string' || message.trim() === '') return ERRORS.Empty;
  return message.trim().length > maxInputChars ? tooLong(maxInputChars) : undefined;
}

function parseJson(raw: string): Validated<Record<string, unknown>> {
  try {
    const body: unknown = JSON.parse(raw);
    return { ok: true, value: (body ?? {}) as Record<string, unknown> };
  } catch {
    return { ok: false, error: ERRORS.InvalidJson };
  }
}

// Runs every check on an incoming chat request, in order, and returns the clean fields.
export async function validateChatRequest(request: Request, maxInputChars: number): Promise<Validated<ChatRequest>> {
  const headerError = checkOrigin(request) ?? checkContentType(request);
  if (headerError) return { ok: false, error: headerError };

  const raw = await request.text();
  const sizeError = checkBodySize(raw, maxInputChars);
  if (sizeError) return { ok: false, error: sizeError };

  const body = parseJson(raw);
  if (!body.ok) return body;
  const { sessionId, message, turnstileToken } = body.value;
  const fieldError = checkSessionId(sessionId) ?? checkMessage(message, maxInputChars);
  if (fieldError) return { ok: false, error: fieldError };

  const token = typeof turnstileToken === 'string' && turnstileToken.length <= 4096 ? turnstileToken : undefined;
  return { ok: true, value: { sessionId: sessionId as string, message: (message as string).trim(), turnstileToken: token } };
}
