export type ChatRequest = { sessionId: string; message: string };

type Invalid = { ok: false; status: number; error: string; message: string };

// Session IDs are random strings the browser makes (crypto.randomUUID or similar).
const SESSION_ID = /^[A-Za-z0-9_-]{16,64}$/;

export async function parseChatRequest(
  request: Request,
  maxInputChars: number,
): Promise<({ ok: true } & ChatRequest) | Invalid> {
  const invalid = (status: number, error: string, message: string): Invalid => ({ ok: false, status, error, message });

  if (!request.headers.get('content-type')?.includes('application/json')) {
    return invalid(415, 'bad_request', 'Send the question as JSON.');
  }
  const raw = await request.text();
  // Room for JSON escaping of a maximum-length question, plus the other fields.
  if (raw.length > maxInputChars * 6 + 1024) {
    return invalid(413, 'too_long', `Questions can be up to ${maxInputChars} characters.`);
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return invalid(400, 'bad_request', 'That request was not valid JSON.');
  }
  const { sessionId, message } = (body ?? {}) as Record<string, unknown>;
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) {
    return invalid(400, 'bad_request', 'Missing or invalid session.');
  }
  if (typeof message !== 'string' || message.trim() === '') {
    return invalid(400, 'empty', 'Type a question first.');
  }
  const trimmed = message.trim();
  if (trimmed.length > maxInputChars) {
    return invalid(413, 'too_long', `Questions can be up to ${maxInputChars} characters.`);
  }
  return { ok: true, sessionId, message: trimmed };
}

// Browsers send Origin on cross-site POSTs. Only the site itself may call the API.
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === (request.headers.get('host') ?? new URL(request.url).host);
  } catch {
    return false;
  }
}
