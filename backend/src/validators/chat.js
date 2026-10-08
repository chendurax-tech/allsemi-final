import { z } from 'zod';
import { requiredText, text, objectId } from './common.js';
import { CHAT_LIMITS } from '../config/constants.js';

/*
  A message to the public website assistant. Everything is bounded:
  the message, the few earlier turns the browser sends back for
  context, and the ids of the jobs it last showed. Unknown fields are
  dropped. The text is cleaned like every other submitted text.
*/
export const chatSchema = z.object({
  message: requiredText(CHAT_LIMITS.message, { multiline: true }),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    text: text(CHAT_LIMITS.historyText, { multiline: true }),
  }), { invalid_type_error: 'Send the history as a list.' }).max(CHAT_LIMITS.historyItems, 'Send at most the last few messages.').default([]),
  context: z.object({
    jobIds: z.array(objectId).max(CHAT_LIMITS.contextJobs).default([]),
    focusJobId: z.union([z.literal(''), objectId]).default(''),
  }).default({}),
});
