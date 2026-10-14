// Hashing and reference codes.
import { createHash, randomBytes } from 'node:crypto';

/** SHA-256 hex of a string. */
export const sha256 = (s) => createHash('sha256').update(s).digest('hex');

// No 0/O or 1/I, so references are easy to read out on the phone.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * A short reference code. With a seed (an idempotency key) the code is stable, so a retried request gets the same one.
 * @param {number} length
 * @param {string} [seed]
 */
export function refCode(length, seed) {
  const bytes = seed ? createHash('sha256').update(seed).digest() : randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
