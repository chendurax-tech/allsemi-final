import mongoose from 'mongoose';

/*
  Records an earlier build stored for two features that are now future
  scope: the semantic (embedding) candidate-job match and AI Job
  Intelligence. Nothing writes these collections any more and there are
  no models for them, but a database may still hold some. They were
  derived from candidate profiles and jobs (a semantic match quotes the
  profile), so they are removed with the records they came from.
*/
const SEMANTIC_MATCHES = 'semanticmatches';
const JOB_INTELLIGENCE = 'jobintelligences';

function collection(name) {
  return mongoose.connection.db ? mongoose.connection.db.collection(name) : null;
}

export async function removeLegacyDerivedData({ candidateIds = [], jobIds = [] } = {}) {
  const matches = collection(SEMANTIC_MATCHES);
  const intelligence = collection(JOB_INTELLIGENCE);
  if (candidateIds.length && matches) await matches.deleteMany({ candidateId: { $in: candidateIds } });
  if (jobIds.length) {
    if (matches) await matches.deleteMany({ jobId: { $in: jobIds } });
    if (intelligence) await intelligence.deleteMany({ jobId: { $in: jobIds } });
  }
}
