import { ok } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { handleMessage } from '../services/chat/chatService.js';

/*
  POST /api/public/chat - the public website assistant
  (services/chat/chatService.js). Public: no session is read and no
  admin permission applies; it can only reach published jobs and public
  ALLSEMIS information. Nothing is stored and the message is never
  logged. The answer is never cached.
*/
export const reply = asyncHandler(async (req, res) => {
  const answer = await handleMessage(req.body);
  res.set('Cache-Control', 'no-store');
  ok(res, answer);
});
