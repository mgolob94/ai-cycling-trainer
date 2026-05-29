const crypto = require('crypto');

// Authenticated symmetric encryption for at-rest secrets (Strava tokens).
// Stored format: "<iv>:<authTag>:<ciphertext>", each part base64.
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce, recommended for GCM

/**
 * Resolve the 32-byte key from TOKEN_ENCRYPTION_KEY. Accepts a 64-char hex
 * string or a base64-encoded 32-byte value. Resolved lazily so the server can
 * still boot without the key set (it only throws when encryption is used).
 */
function getKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY || '';
  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');

  if (key.length !== 32) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY must be 32 bytes — a 64-char hex string or base64. ' +
        'Generate one with: openssl rand -hex 32'
    );
  }
  return key;
}

/** Encrypt a UTF-8 string. Returns "iv:tag:ciphertext" (all base64). */
function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

/** Decrypt a value produced by encrypt(). Throws if the data was tampered with. */
function decrypt(payload) {
  const [ivB64, tagB64, dataB64] = String(payload).split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted payload');
  }
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

module.exports = { encrypt, decrypt };
