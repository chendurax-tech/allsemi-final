import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';

/*
  Password hashing with scrypt (Node's built-in implementation, so
  there is no native module to compile on the host).

  Parameters follow the OWASP password storage guidance for scrypt:
  N = 2^15, r = 8, p = 3, with a 16-byte random salt per password and a
  64-byte derived key. The parameters are stored inside the hash string,
  so they can be raised later and existing hashes still verify;
  needsRehash() tells the login flow when to upgrade one.

  Stored format:  scrypt$N$r$p$<salt base64>$<key base64>
*/

const PARAMS = { N: 2 ** 15, r: 8, p: 3 };
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function derive(password, salt, { N, r, p }, keyLength) {
  return new Promise((resolve, reject) => {
    // maxmem must cover 128 * N * r bytes, with headroom.
    scrypt(password, salt, keyLength, { N, r, p, maxmem: 256 * N * r }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password) {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(String(password), salt, PARAMS, KEY_LENGTH);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
}

function parse(stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [, N, r, p, salt, key] = parts;
  const params = { N: Number(N), r: Number(r), p: Number(p) };
  if (![params.N, params.r, params.p].every((n) => Number.isInteger(n) && n > 0)) return null;
  return { params, salt: Buffer.from(salt, 'base64'), key: Buffer.from(key, 'base64') };
}

export async function verifyPassword(password, stored) {
  const parsed = parse(stored);
  if (!parsed) return false;
  const candidate = await derive(String(password), parsed.salt, parsed.params, parsed.key.length);
  return candidate.length === parsed.key.length && timingSafeEqual(candidate, parsed.key);
}

export function needsRehash(stored) {
  const parsed = parse(stored);
  if (!parsed) return true;
  return parsed.params.N !== PARAMS.N || parsed.params.r !== PARAMS.r || parsed.params.p !== PARAMS.p;
}

// The same rule everywhere a password is set: at least 12 characters,
// with a letter and a digit. Length matters more than symbols.
export function passwordProblem(password) {
  const value = String(password || '');
  if (value.length < 12) return 'Use at least 12 characters.';
  if (value.length > 200) return 'Use at most 200 characters.';
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) return 'Include at least one letter and one number.';
  return null;
}

export function generatePassword(length = 20) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  // Guarantee the rule above whatever the random draw was.
  return `${out.slice(0, length - 2)}a7`;
}
