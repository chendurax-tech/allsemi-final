/*
  Reading the official job source over HTTP, with limits: a time limit,
  a size limit and http(s) only. A failure is a SourceError with a short
  message that is safe to store and show; it never contains the body.
*/

export class SourceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SourceError';
  }
}

export const FETCH_LIMITS = { timeoutMs: 15_000, maxBytes: 3 * 1024 * 1024 };

export async function fetchText(url, { accept = '*/*', limits = FETCH_LIMITS } = {}) {
  if (!/^https?:\/\//i.test(String(url))) throw new SourceError('The source address is not an http(s) address.');
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: accept, 'User-Agent': 'ALLSEMIS-JobSync/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(limits.timeoutMs),
    });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    throw new SourceError(timedOut ? 'The source did not answer in time.' : 'The source could not be reached.');
  }
  if (!response.ok) throw new SourceError(`The source answered with HTTP ${response.status}.`);
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limits.maxBytes) throw new SourceError('The source answer is larger than allowed.');
  const reader = response.body?.getReader();
  if (!reader) return { text: '', contentType: response.headers.get('content-type') || '', url: response.url || url };
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limits.maxBytes) {
      await reader.cancel().catch(() => {});
      throw new SourceError('The source answer is larger than allowed.');
    }
    chunks.push(value);
  }
  return { text: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8'), contentType: response.headers.get('content-type') || '', url: response.url || url };
}
