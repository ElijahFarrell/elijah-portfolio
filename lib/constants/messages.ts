// Text the API sends back to visitors. The chat panel shows these as-is.

export const VALIDATION_MESSAGES = {
  NotJson: 'Send the question as JSON.',
  InvalidJson: 'That request was not valid JSON.',
  InvalidSession: 'Missing or invalid session.',
  Empty: 'Type a question first.',
  TooLong: (maxChars: number) => `Questions can be up to ${maxChars} characters.`,
  Forbidden: 'Not allowed.',
} as const;

export const ERROR_MESSAGES = {
  Disabled: "The chat isn't available right now.",
  Resting: 'The chat is resting for today. Please try again tomorrow.',
  Busy: 'The chat is busy right now. Please try again in a minute.',
  Upstream: 'Something went wrong. Please try again.',
  Aborted: 'Request cancelled.',
  CutOff: 'The answer was cut off. Please try again.',
  RateLimited: "You're asking quickly. Please try again in a few minutes.",
  Bot: "Couldn't verify this browser. Refresh the page and try again.",
  SessionLimit: 'This chat has reached its limit. Clear the chat to start a new one.',
} as const;
