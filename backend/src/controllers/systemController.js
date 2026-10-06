import { ok } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pagination, equalityFilters, dateRangeFilter, text } from '../utils/query.js';
import { AuditLog } from '../models/index.js';
import { getSiteSettings, updateContact } from '../services/settingsService.js';
import { record } from '../services/auditService.js';
import { describeConfig } from '../config/env.js';
import { aiStatus } from '../services/aiService.js';

// ---- settings ----
export const getSettings = asyncHandler(async (req, res) => {
  const settings = await getSiteSettings();
  const config = describeConfig();
  ok(res, {
    contact: settings.toJSON().contact,
    updatedAt: settings.updatedAt,
    updatedByName: settings.updatedByName,
    // Which integrations are configured. Booleans only: no keys, no
    // connection strings, nothing that could be used as a credential.
    system: {
      fileStorage: config.fileStorage,
      mediaStorage: config.mediaStorage,
      email: config.email,
      b2Configured: config.b2Configured,
      cloudinaryConfigured: config.cloudinaryConfigured,
      resendConfigured: config.resendConfigured,
      ai: aiStatus(),
    },
  });
});

export const putContact = asyncHandler(async (req, res) => {
  const settings = await updateContact(req.body, req.user);
  await record({ req, action: 'settings.contact_updated', entityType: 'settings', entityId: 'site', summary: 'Updated public contact details' });
  ok(res, { contact: settings.toJSON().contact, updatedAt: settings.updatedAt, updatedByName: settings.updatedByName });
});

// ---- audit log ----
export const listAuditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const filter = {
    ...equalityFilters(req.query, { entityType: {}, entityId: {}, actorId: { objectId: true } }),
    ...dateRangeFilter(req.query, 'at'),
  };
  const action = text(req.query.action, 80);
  if (action) filter.action = action;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ at: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);
  ok(res, items.map((item) => item.toJSON()), { total, page, limit });
});
