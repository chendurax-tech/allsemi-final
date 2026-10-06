import { AuditLog } from '../models/index.js';
import { logger } from '../utils/logger.js';

/*
  Audit logging for sensitive actions.

  record() never throws: a failure to write the audit entry is logged
  and must not turn a completed action into an error for the user.
  Callers pass only descriptive metadata. Passwords, tokens, storage
  keys and document contents are never passed in.
*/

const BLOCKED_KEYS = /(pass(word)?|secret|token|key|hash|cookie|authorization)/i;

function cleanMetadata(metadata) {
  const out = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (BLOCKED_KEYS.test(key)) continue;
    if (value === undefined) continue;
    if (typeof value === 'string') out[key] = value.slice(0, 300);
    else if (typeof value === 'number' || typeof value === 'boolean' || value === null) out[key] = value;
    else if (Array.isArray(value)) out[key] = value.slice(0, 30).map((item) => String(item).slice(0, 120));
    else out[key] = String(value).slice(0, 300);
  }
  return out;
}

export async function record({ req, user, action, entityType = '', entityId = '', summary = '', metadata = {} }) {
  try {
    const actor = user || req?.user || null;
    await AuditLog.create({
      actorId: actor?.id || actor?._id || null,
      actorName: actor?.name || 'System',
      actorRole: actor?.role || '',
      action,
      entityType,
      entityId: entityId ? String(entityId) : '',
      summary: String(summary).slice(0, 400),
      metadata: cleanMetadata(metadata),
      ip: req?.ip || '',
      at: new Date(),
    });
  } catch (error) {
    logger.error('audit.write_failed', { action, error });
  }
}

// The fields that differ between two plain objects, by name only. Used
// to say WHAT was edited without copying the values into the log.
export function changedFields(before, after, fields) {
  return fields.filter((field) => JSON.stringify(before?.[field] ?? null) !== JSON.stringify(after?.[field] ?? null));
}
