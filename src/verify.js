// Discord signs every interaction with Ed25519: the signature is over the
// timestamp followed by the raw body, checked against the application's public
// key (hex, 32 bytes). node:crypto does it with no dependency.
import { createPublicKey, verify } from 'node:crypto';

// An Ed25519 public key in DER (SubjectPublicKeyInfo) is this prefix and the 32 raw bytes.
const DER_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const keys = new Map();

export function publicKeyOf(hex) {
  let key = keys.get(hex);
  if (!key) {
    if (!/^[0-9a-f]{64}$/i.test(hex ?? '')) throw new Error('DISCORD_PUBLIC_KEY must be 64 hex characters');
    key = createPublicKey({ key: Buffer.concat([DER_PREFIX, Buffer.from(hex, 'hex')]), format: 'der', type: 'spki' });
    keys.set(hex, key);
  }
  return key;
}

/**
 * True when the request is Discord's. `maxAge` (seconds) refuses an old
 * timestamp, so a captured request cannot be replayed later.
 */
export function isFromDiscord({ publicKey, signature, timestamp, body, now = Date.now(), maxAge = 300 }) {
  if (typeof signature !== 'string' || !/^[0-9a-f]{128}$/i.test(signature)) return false;
  if (typeof timestamp !== 'string' || !/^\d{1,12}$/.test(timestamp)) return false;
  if (maxAge && Math.abs(now / 1000 - Number(timestamp)) > maxAge) return false;
  try {
    const raw = Buffer.isBuffer(body) ? body : Buffer.from(String(body ?? ''));
    return verify(null, Buffer.concat([Buffer.from(timestamp), raw]), publicKeyOf(publicKey), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}
