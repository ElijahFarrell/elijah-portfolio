import { ERROR_MESSAGES, VALIDATION_MESSAGES } from './constants/messages.js';

// An error the API returns as JSON: { error: code, message }.
export type ApiError = { status: number; code: string; message: string };

export const ERRORS = {
  NotJson: { status: 415, code: 'bad_request', message: VALIDATION_MESSAGES.NotJson },
  InvalidJson: { status: 400, code: 'bad_request', message: VALIDATION_MESSAGES.InvalidJson },
  InvalidSession: { status: 400, code: 'bad_request', message: VALIDATION_MESSAGES.InvalidSession },
  Empty: { status: 400, code: 'empty', message: VALIDATION_MESSAGES.Empty },
  Forbidden: { status: 403, code: 'forbidden', message: VALIDATION_MESSAGES.Forbidden },
  Disabled: { status: 503, code: 'disabled', message: ERROR_MESSAGES.Disabled },
  Resting: { status: 503, code: 'resting', message: ERROR_MESSAGES.Resting },
  Busy: { status: 503, code: 'busy', message: ERROR_MESSAGES.Busy },
  Upstream: { status: 502, code: 'upstream', message: ERROR_MESSAGES.Upstream },
  Aborted: { status: 499, code: 'aborted', message: ERROR_MESSAGES.Aborted },
  RateLimited: { status: 429, code: 'rate_limited', message: ERROR_MESSAGES.RateLimited },
  Verify: { status: 403, code: 'verify', message: ERROR_MESSAGES.Verify },
  SessionLimit: { status: 429, code: 'session_limit', message: ERROR_MESSAGES.SessionLimit },
} as const satisfies Record<string, ApiError>;

export function tooLong(maxChars: number): ApiError {
  return { status: 413, code: 'too_long', message: VALIDATION_MESSAGES.TooLong(maxChars) };
}

// Maps a model or gateway failure to what the visitor sees.
export function upstreamError(cause: unknown): ApiError {
  const status = (cause as { statusCode?: number } | undefined)?.statusCode;
  // 402: the AI Gateway budget on the API key is used up.
  if (status === 402) return ERRORS.Resting;
  if (status === 429) return ERRORS.Busy;
  return ERRORS.Upstream;
}

export function errorResponse(error: ApiError): Response {
  return Response.json(
    { error: error.code, message: error.message },
    { status: error.status, headers: { 'cache-control': 'no-store' } },
  );
}
