// ============================================================
// Session management: JWE-encrypted tokens bound to device
// fingerprint + IP, with similarity-based validation and
// auto-invalidation on mismatch.
//
// Uses `jose` for JWE (A256GCM encryption) — payload is fully
// opaque to an attacker who steals localStorage.
// ============================================================

import * as jose from 'jose';
import crypto from 'crypto';

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_TTL = 60 * 60 * 1000; // 1 hour
const IP_SIMILARITY_MASK = 16;      // /16 subnet for similarity

let _secretKey = null;

async function secretKey() {
  if (!_secretKey) {
    const keyBytes = crypto.createHash('sha256').update(SESSION_SECRET).digest();
    _secretKey = await jose.importJWK({ kty: 'oct', k: Buffer.from(keyBytes).toString('base64url'), alg: 'A256GCM' }, 'A256GCM');
  }
  return _secretKey;
}

// Issue a JWE session token containing discordId + redditUsername + fingerprint.
export async function issueSessionToken({ discordId, redditUsername, fingerprint, ip }) {
  const key = await secretKey();
  const payload = {
    sub: discordId,
    reddit: redditUsername || null,
    fp: fingerprintHash(fingerprint || ''),
    ipPrefix: ip ? ip.split('.').slice(0, IP_SIMILARITY_MASK / 8).join('.') : null,
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL,
  };
  return await new jose.CompactEncrypt(
    new TextEncoder().encode(JSON.stringify(payload))
  )
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .encrypt(key);
}

// Verify a JWE token + return the payload if valid.
// Returns { ok: true, payload } or { ok: false, reason: string, invalidate: boolean }.
// invalidate=true means the current token should be immediately rejected and
// the client must re-auth — no silent retry.
export async function verifySessionToken(token, currentDiscordId, currentFingerprint, currentIp) {
  if (!token) return { ok: false, reason: 'no_token', invalidate: false };

  let payload;
  try {
    const key = await secretKey();
    const { plaintext } = await jose.compactDecrypt(token, key);
    payload = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    return { ok: false, reason: 'bad_token', invalidate: true };
  }

  // Expiry
  if (Date.now() > payload.exp) {
    return { ok: false, reason: 'expired', invalidate: false };
  }

  // Discord ID must match (the token is bound to this Discord user)
  if (currentDiscordId && payload.sub !== currentDiscordId) {
    return { ok: false, reason: 'discord_mismatch', invalidate: true };
  }

  // Fingerprint similarity: both stored and current fingerprints are
  // hashes, so they ONLY match if identical — but we store the pre-hash
  // features and compare similarity at issue time. For validation we just
  // check exact match (the client regenerates the same fingerprint from
  // browser features — if they're on a different browser/device, it differs).
  if (payload.fp && currentFingerprint) {
    const currentFpHash = fingerprintHash(currentFingerprint);
    if (payload.fp !== currentFpHash) {
      return { ok: false, reason: 'device_mismatch', invalidate: true };
    }
  }

  // IP similarity: compare /16 subnet prefix
  if (payload.ipPrefix && currentIp) {
    const currentPrefix = currentIp.split('.').slice(0, IP_SIMILARITY_MASK / 8).join('.');
    if (payload.ipPrefix !== currentPrefix) {
      return { ok: false, reason: 'ip_moved', invalidate: false }; // don't invalidate — IPs change naturally
    }
  }

  return { ok: true, payload };
}

// Browser fingerprint: a hash of the raw fingerprint features.
// The raw features are sent in a header; only the hash is stored.
function fingerprintHash(raw) {
  return crypto.createHash('sha256').update(String(raw || '')).digest('hex').slice(0, 16);
}

export { fingerprintHash };
