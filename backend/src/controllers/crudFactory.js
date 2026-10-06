import { ok, created } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notFound, forbidden } from '../utils/AppError.js';
import { pagination, searchFilter, equalityFilters, sortFrom, assertObjectId } from '../utils/query.js';
import { roleCan } from '../config/permissions.js';
import { slugify } from '../utils/sanitize.js';
import { record, changedFields } from '../services/auditService.js';

/*
  crudController - the list / read / create / update / delete handlers
  shared by the admin resources. Each resource supplies its model, its
  validated field list and the few rules that are specific to it.

  What every resource gets from here:
  - list:   search (?q=), allow-listed equality filters, sort and
            pagination. Filter values are read as plain strings only.
  - create / update: the body has already been parsed by a zod schema
            (see middleware/validate.js), so only declared fields exist.
  - publish rule: moving a record to or from 'published' needs the
            resource's publish permission, checked here on the server.
  - audit:  create, update (field names only), status change, label
            change, publish, unpublish and delete are written to the
            audit log.

  Route-level permission checks (requireAuth + requirePermission) run
  before any of these handlers; see routes/admin.routes.js.
*/

export async function uniqueSlug(Model, wanted, excludeId, field = 'slug') {
  const base = slugify(wanted) || 'item';
  let candidate = base;
  for (let n = 2; n < 200; n += 1) {
    const clash = await Model.findOne({ [field]: candidate });
    if (!clash || (excludeId && String(clash._id) === String(excludeId))) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

export function crudController({
  Model,
  entity, // audit entity type, e.g. 'job'
  label = (doc) => doc.title || doc.name || String(doc._id),
  searchFields = [],
  filters = {},
  defaultSort = { createdAt: -1 },
  sortable = ['createdAt', 'updatedAt'],
  publishPermission = null,
  slugFrom = null, // field the slug is derived from when it is left empty
  keyFrom = null, // same, for a `key` field
  prepare = null, // async (data, { req, existing }) -> data
  afterSave = null, // async (doc, { req, before, isNew })
  beforeDelete = null, // async (doc, req)
  auditFields = [],
}) {
  const load = async (req) => {
    const doc = await Model.findById(assertObjectId(req.params.id));
    if (!doc) throw notFound(`That ${entity} was not found.`);
    return doc;
  };

  const assertPublishAllowed = (req, fromStatus, toStatus) => {
    if (!publishPermission) return;
    const touchesPublished = (fromStatus === 'published' || toStatus === 'published') && fromStatus !== toStatus;
    if (touchesPublished && !roleCan(req.user.role, publishPermission)) {
      throw forbidden('Your role cannot publish or unpublish this.');
    }
  };

  // What is published is what the public sees, so changing it is
  // publishing too: an edit to a live record needs the same permission
  // as putting it live.
  const assertLiveEditAllowed = (req, currentStatus) => {
    if (publishPermission && currentStatus === 'published' && !roleCan(req.user.role, publishPermission)) {
      throw forbidden('This is published. Your role cannot change what is live.');
    }
  };

  const list = asyncHandler(async (req, res) => {
    const { page, limit, skip } = pagination(req.query);
    const filter = { ...equalityFilters(req.query, filters), ...searchFilter(req.query, searchFields) };
    const sort = sortFrom(req.query, sortable, defaultSort);
    const [items, total] = await Promise.all([
      Model.find(filter).sort(sort).skip(skip).limit(limit),
      Model.countDocuments(filter),
    ]);
    ok(res, items.map((item) => item.toJSON()), { total, page, limit });
  });

  const read = asyncHandler(async (req, res) => {
    ok(res, (await load(req)).toJSON());
  });

  const create = asyncHandler(async (req, res) => {
    let data = { ...req.body };
    if ('status' in data) assertPublishAllowed(req, 'draft', data.status);
    if (slugFrom) data.slug = await uniqueSlug(Model, data.slug || data[slugFrom]);
    if (keyFrom) data.key = await uniqueSlug(Model, data.key || data[keyFrom], null, 'key');
    if (prepare) data = await prepare(data, { req, existing: null });
    const doc = await Model.create(data);
    if (afterSave) await afterSave(doc, { req, before: null, isNew: true });
    await record({ req, action: `${entity}.created`, entityType: entity, entityId: doc._id, summary: `Created ${entity} "${label(doc)}"` });
    if (doc.status === 'published') {
      await record({ req, action: `${entity}.published`, entityType: entity, entityId: doc._id, summary: `Published ${entity} "${label(doc)}"` });
    }
    created(res, doc.toJSON());
  });

  const update = asyncHandler(async (req, res) => {
    const doc = await load(req);
    const before = doc.toObject();
    let data = { ...req.body };
    assertLiveEditAllowed(req, before.status);
    if ('status' in data) assertPublishAllowed(req, before.status, data.status);
    if (slugFrom && 'slug' in data) data.slug = await uniqueSlug(Model, data.slug || data[slugFrom] || before[slugFrom], doc._id);
    if (keyFrom) delete data.key; // the key is fixed once created
    if (prepare) data = await prepare(data, { req, existing: doc });
    doc.set(data);
    await doc.save();
    if (afterSave) await afterSave(doc, { req, before, isNew: false });

    const after = doc.toObject();
    // A label change is recorded as its own entry, naming what was
    // added and removed. It is a tag, not a status change.
    if (Array.isArray(before.labels) && Array.isArray(after.labels)) {
      const added = after.labels.filter((item) => !before.labels.includes(item));
      const removed = before.labels.filter((item) => !after.labels.includes(item));
      if (added.length || removed.length) {
        const names = (list) => list.map((item) => item.charAt(0) + item.slice(1).toLowerCase()).join(', ');
        const parts = [added.length ? `added ${names(added)}` : '', removed.length ? `removed ${names(removed)}` : ''].filter(Boolean);
        await record({ req, action: `${entity}.labels_changed`, entityType: entity, entityId: doc._id, summary: `Labels on ${entity} "${label(doc)}": ${parts.join('; ')}`, metadata: { added, removed } });
      }
    }
    const edited = changedFields(before, after, auditFields.filter((field) => field !== 'status'));
    if (edited.length) {
      await record({ req, action: `${entity}.updated`, entityType: entity, entityId: doc._id, summary: `Edited ${entity} "${label(doc)}"`, metadata: { fields: edited } });
    }
    if ('status' in before && before.status !== after.status) {
      let action = `${entity}.status_changed`;
      if (after.status === 'published') action = `${entity}.published`;
      else if (before.status === 'published') action = `${entity}.unpublished`;
      await record({ req, action, entityType: entity, entityId: doc._id, summary: `${label(doc)}: ${before.status} to ${after.status}`, metadata: { from: before.status, to: after.status } });
    }
    ok(res, doc.toJSON());
  });

  const remove = asyncHandler(async (req, res) => {
    const doc = await load(req);
    assertLiveEditAllowed(req, doc.status);
    if (beforeDelete) await beforeDelete(doc, req);
    await doc.deleteOne();
    await record({ req, action: `${entity}.deleted`, entityType: entity, entityId: doc._id, summary: `Deleted ${entity} "${label(doc)}"` });
    ok(res, { id: String(doc._id), deleted: true });
  });

  return { list, read, create, update, remove, load };
}
