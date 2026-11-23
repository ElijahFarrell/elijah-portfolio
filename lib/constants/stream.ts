// Part types read from the AI SDK's fullStream.
export const PART_TYPES = {
  Delta: 'text-delta',
  Error: 'error',
  Abort: 'abort',
} as const;

// Events sent to the browser, one JSON object per line (NDJSON).
//   {"type":"text","text":"..."}  a piece of the answer
//   {"type":"error","message":"..."}  the answer stopped early
//   {"type":"done"}  the answer is complete
export const EVENT_TYPES = {
  Text: 'text',
  Error: 'error',
  Done: 'done',
} as const;

export type StreamEvent =
  | { type: typeof EVENT_TYPES.Text; text: string }
  | { type: typeof EVENT_TYPES.Error; message: string }
  | { type: typeof EVENT_TYPES.Done };
