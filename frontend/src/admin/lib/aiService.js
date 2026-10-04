/*
  aiService - the admin panel's client for the BACKEND AI service.

  This file holds no API key and never calls OpenAI. The browser only
  ever talks to the ALLSEMIS backend, and the backend talks to the model
  provider. Model choice lives in backend configuration (an environment
  variable), so changing models later needs no change here or in any
  ATS screen.

  The five functions mirror the backend AIService one to one:
    extractResume, parseJobDescription, compareCandidateToJob,
    generateMatchExplanation, answerChatbot
  Extraction and comparison return structured JSON validated against a
  schema on the backend (see docs/ALLSEMI-IMPLEMENTATION-SCOPE.md).

  Until VITE_API_BASE_URL is set, every call resolves to
  { connected: false } and the screens show stored sample results.
*/

const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || '';

async function post(path, payload) {
  if (!API_BASE) {
    return { connected: false, message: 'The AI backend is not connected in this build. The stored sample result is shown.' };
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`AI service request failed (${response.status})`);
  return { connected: true, data: await response.json() };
}

export const aiService = {
  extractResume: (resumeId) => post('/api/ai/extract-resume', { resumeId }),
  parseJobDescription: (jobId) => post('/api/ai/parse-job', { jobId }),
  compareCandidateToJob: (candidateId, jobId) => post('/api/ai/compare', { candidateId, jobId }),
  generateMatchExplanation: (evaluationId) => post('/api/ai/explain', { evaluationId }),
  answerChatbot: (sessionId, message) => post('/api/ai/chat', { sessionId, message }),
};
