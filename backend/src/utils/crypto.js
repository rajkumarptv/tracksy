/**
 * AES-256-GCM field-level encryption for sensitive DB columns.
 *
 * Set ENCRYPTION_KEY in .env to a 64-char hex string (32 bytes):
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Encrypted values are prefixed with "ENC:" so old plaintext rows
 * are returned as-is (backward compatible).
 */
const crypto = require('crypto');

const ALGO    = 'aes-256-gcm';
const KEY_HEX = process.env.ENCRYPTION_KEY || '';
const KEY     = KEY_HEX.length === 64 ? Buffer.from(KEY_HEX, 'hex') : null;

if (!KEY) {
  console.warn('⚠️  ENCRYPTION_KEY not set or invalid — field encryption disabled');
}

/**
 * Encrypt a plaintext string.  Returns "ENC:<iv>:<tag>:<ciphertext>" or the
 * original value unchanged if encryption is disabled / input is falsy.
 */
function encrypt(text) {
  if (!KEY || !text || typeof text !== 'string') return text;
  try {
    const iv      = crypto.randomBytes(12);
    const cipher  = crypto.createCipheriv(ALGO, KEY, iv);
    const enc     = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag     = cipher.getAuthTag();
    return 'ENC:' + [iv, tag, enc].map(b => b.toString('hex')).join(':');
  } catch (e) {
    console.error('Encrypt error:', e.message);
    return text;
  }
}

/**
 * Decrypt an "ENC:…" string.  Non-ENC values pass through unchanged
 * so legacy plaintext rows continue to work.
 */
function decrypt(text) {
  if (!KEY || !text || typeof text !== 'string' || !text.startsWith('ENC:')) return text;
  try {
    const [ivHex, tagHex, encHex] = text.slice(4).split(':');
    const iv      = Buffer.from(ivHex,  'hex');
    const tag     = Buffer.from(tagHex, 'hex');
    const enc     = Buffer.from(encHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
    decipher.setAuthTag(tag);
    return decipher.update(enc, undefined, 'utf8') + decipher.final('utf8');
  } catch (e) {
    // Return ciphertext as-is rather than crashing (wrong key / corrupt data)
    return text;
  }
}

/** Decrypt every listed key in a row object (mutates a copy). */
function decryptRow(row, keys) {
  if (!row) return row;
  const out = { ...row };
  for (const k of keys) {
    if (out[k]) out[k] = decrypt(out[k]);
  }
  return out;
}

module.exports = { encrypt, decrypt, decryptRow, isEnabled: () => !!KEY };
