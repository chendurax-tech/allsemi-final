import mongoose from 'mongoose';
import { escapeRegex } from './sanitize.js';
import { badRequest } from './AppError.js';

/*
  Helpers for turning a request's query string into a database filter.

  Only plain strings are ever read from the query. Express parses
  "?status[$ne]=x" into an object; text() returns '' for anything that
  is not a string, so an operator can never be injected into a filter.
*/

export function text(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function pagination(query, { defaultLimit = 100, maxLimit = 500 } = {}) {
  const page = Math.max(1, Number.parseInt(text(query.page), 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(text(query.limit), 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

// A case-insensitive "contains" search across the given fields.
export function searchFilter(query, fields) {
  const q = text(query.q, 100);
  if (!q || fields.length === 0) return {};
  const pattern = escapeRegex(q);
  return { $or: fields.map((field) => ({ [field]: { $regex: pattern, $options: 'i' } })) };
}

// Equality filters, each limited to the values the field allows.
export function equalityFilters(query, definitions) {
  const filter = {};
  for (const [param, definition] of Object.entries(definitions)) {
    const value = text(query[param]);
    if (!value) continue;
    const { field = param, allowed, objectId, boolean } = definition;
    if (allowed && !allowed.includes(value)) throw badRequest(`"${value}" is not a valid ${param}.`);
    if (objectId) {
      if (!mongoose.isValidObjectId(value)) throw badRequest(`${param} is not a valid id.`);
      filter[field] = value;
    } else if (boolean) {
      filter[field] = value === 'true';
    } else {
      filter[field] = value;
    }
  }
  return filter;
}

export function dateRangeFilter(query, field, fromParam = 'from', toParam = 'to') {
  const range = {};
  const from = text(query[fromParam]);
  const to = text(query[toParam]);
  if (from && !Number.isNaN(Date.parse(from))) range.$gte = new Date(from);
  if (to && !Number.isNaN(Date.parse(to))) range.$lte = new Date(to);
  return Object.keys(range).length ? { [field]: range } : {};
}

export function sortFrom(query, allowed, fallback) {
  const raw = text(query.sort, 60);
  if (!raw) return fallback;
  const direction = raw.startsWith('-') ? -1 : 1;
  const field = raw.replace(/^-/, '');
  return allowed.includes(field) ? { [field]: direction } : fallback;
}

export function assertObjectId(id, label = 'id') {
  if (typeof id !== 'string' || !mongoose.isValidObjectId(id)) throw badRequest(`That ${label} is not valid.`);
  return id;
}
