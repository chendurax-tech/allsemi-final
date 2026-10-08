import mongoose from 'mongoose';

const { Schema } = mongoose;

/*
  One run of the job synchronisation (services/jobSync/syncService.js):
  when, from which source, what was found and what changed. It is the
  sync's log, shown to staff in the admin.

  It also serves as the lock: a run in progress has `active: true`, and
  a unique index allows one such run per source, so two runs started at
  the same moment (the scheduler and a click) cannot both write. A run
  that never finished (the server stopped) is released after the lease.

  It holds no secret and no candidate data: source ids, counts and short
  error descriptions.
*/
const runSchema = new Schema({
  source: { type: String, required: true },
  sourceName: { type: String, default: '' },
  sourceUrl: { type: String, default: '' },
  trigger: { type: String, enum: ['schedule', 'manual', 'command', 'endpoint', 'test'], default: 'manual' },
  triggeredByName: { type: String, default: '' },
  status: { type: String, enum: ['RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED'], default: 'RUNNING' },
  active: { type: Boolean, default: true },
  startedAt: { type: Date, default: Date.now },
  finishedAt: { type: Date, default: null },
  counts: {
    discovered: { type: Number, default: 0 },
    created: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    unchanged: { type: Number, default: 0 },
    closed: { type: Number, default: 0 },
    reopened: { type: Number, default: 0 },
    missing: { type: Number, default: 0 },
    invalid: { type: Number, default: 0 },
  },
  // Why the source could not be read, when it could not. Nothing was
  // changed in that case.
  failure: { type: String, default: '', maxlength: 300 },
  notes: { type: [String], default: [] },
  errors: {
    type: [new Schema({ sourceJobId: { type: String, default: '' }, message: { type: String, maxlength: 300 } }, { _id: false })],
    default: [],
  },
}, { timestamps: false, suppressReservedKeysWarning: true });

runSchema.index({ source: 1, active: 1 }, { unique: true, partialFilterExpression: { active: true } });
runSchema.index({ startedAt: -1 });

runSchema.set('toJSON', {
  virtuals: false,
  versionKey: false,
  transform(doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.active;
    return ret;
  },
});

export const JobSyncRun = mongoose.models.JobSyncRun || mongoose.model('JobSyncRun', runSchema);
