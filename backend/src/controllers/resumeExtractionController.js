import { ok, created } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { assertObjectId } from '../utils/query.js';
import {
  createExtraction, listExtractions, approveExtraction, discardExtraction,
} from '../services/resume/resumeExtractionService.js';

/*
  Resume extraction for the admin (services/resume/resumeExtractionService.js).

  Reading a resume runs on this server with local libraries: no AI
  service is called. It produces a draft only. The candidate changes
  only through approve, with the fields a recruiter chose.

  Responses carry the draft, its confidence, evidence and warnings, but
  never the stored resume text or the resume's storage key.
*/

// The applications being read at this moment, in this process. A
// second click on the same application is refused instead of reading
// the resume twice. With more than one instance this guard is per
// instance, like the rate limits.
const inFlight = new Set();

export const extract = asyncHandler(async (req, res) => {
  const applicationId = assertObjectId(req.params.id, 'application id');
  if (inFlight.has(applicationId)) {
    throw new AppError(409, 'EXTRACTION_IN_PROGRESS', 'This resume is already being read. Wait for it to finish.');
  }
  inFlight.add(applicationId);
  try {
    const extraction = await createExtraction({ req, applicationId });
    created(res, extraction.toJSON());
  } finally {
    inFlight.delete(applicationId);
  }
});

export const listForCandidate = asyncHandler(async (req, res) => {
  const items = await listExtractions(assertObjectId(req.params.id, 'candidate id'));
  res.set('Cache-Control', 'no-store');
  ok(res, items.map((item) => item.toJSON()));
});

export const approve = asyncHandler(async (req, res) => {
  const { extraction, candidate, ats } = await approveExtraction({ req, id: assertObjectId(req.params.id, 'extraction id'), body: req.body });
  ok(res, { extraction: extraction.toJSON(), candidate: candidate.toJSON(), ats });
});

export const discard = asyncHandler(async (req, res) => {
  const extraction = await discardExtraction({ req, id: assertObjectId(req.params.id, 'extraction id'), note: req.body.note });
  ok(res, extraction.toJSON());
});
