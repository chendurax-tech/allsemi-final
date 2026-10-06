import { env } from '../config/env.js';

/*
  Structured logger: one JSON line per event on stdout/stderr, which is
  what Render and most log collectors expect.

  Values under keys that look like credentials are replaced before they
  are written, so a careless log call cannot leak a password, token or
  API key. Request and response bodies are never logged.
*/

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const SENSITIVE_KEY = /(pass(word)?|secret|token|authorization|cookie|api[-_]?key|session|hash)/i;

function redact(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, code: value.code, stack: value.stack };
  }
  if (depth > 4) return '[depth limit]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redact(inner, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 2000) return `${value.slice(0, 2000)}...[truncated]`;
  return value;
}

function write(level, event, fields) {
  if (LEVELS[level] < LEVELS[env.logLevel]) return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...redact(fields || {}) });
  if (level === 'error' || level === 'warn') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export const logger = {
  debug: (event, fields) => write('debug', event, fields),
  info: (event, fields) => write('info', event, fields),
  warn: (event, fields) => write('warn', event, fields),
  error: (event, fields) => write('error', event, fields),
};
