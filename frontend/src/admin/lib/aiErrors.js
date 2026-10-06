/*
  What to show when an AI request fails (a requirement profile draft or
  a comparison of several candidates).

  The server's own sentence is shown whenever it sent one: it says what
  happened and that nothing was changed. The sentences below are used
  only when the answer carried none, which happens when a proxy or a
  rate limiter answers in place of the API.

  Codes (see the AI routes in backend/src/routes/admin.routes.js):
    AI_QUOTA_EXCEEDED    the OpenAI account has no credit left or has
                         reached its spend limit
    AI_NOT_CONFIGURED    the server has no key or no model
    AI_IN_PROGRESS       a request for the same job is still running
    AI_FAILED            the provider failed, timed out or was not reached
    AI_INVALID_RESPONSE  the answer could not be used, nothing was stored
    RATE_LIMITED         too many AI requests from this user in a short time
*/

const BY_CODE = {
  AI_QUOTA_EXCEEDED: 'OpenAI refused the request because the account has no credit left or has reached its spend limit. Nothing was changed.',
  AI_NOT_CONFIGURED: 'AI is not connected on this server.',
  AI_IN_PROGRESS: 'An AI request is already running for this job. Wait for it to finish.',
  AI_FAILED: 'The AI service could not be reached or did not answer. Nothing was changed. Try again in a moment.',
  AI_INVALID_RESPONSE: 'The AI service gave an answer that could not be used. Nothing was saved. Try again.',
  RATE_LIMITED: 'Too many AI requests were started in a short time. Wait a few minutes and try again.',
};
const BY_STATUS = { 403: 'Your role cannot start this AI request.', 404: 'This job was not found. It may have been removed.', 409: BY_CODE.AI_IN_PROGRESS, 429: BY_CODE.RATE_LIMITED };
const FALLBACK = 'The AI request did not finish. Nothing was changed. Try again.';
// What the API client puts in place of a missing message or code.
const CLIENT_PLACEHOLDER = 'The request could not be completed. Please try again.';

export function aiFailureText(error) {
  if (!error) return FALLBACK;
  // The server could not be reached at all: the client's own sentence.
  if (error.code === 'NETWORK_ERROR') return error.message || FALLBACK;
  const fromServer = error.code !== 'REQUEST_FAILED' && error.message && error.message !== CLIENT_PLACEHOLDER;
  if (fromServer) return error.message;
  return BY_CODE[error.code] || BY_STATUS[error.status] || FALLBACK;
}

// The code to put on the alert, so a quota refusal can be told apart
// from any other failure.
export const aiFailureCode = (error) => (error && typeof error.code === 'string' ? error.code : 'UNKNOWN');
