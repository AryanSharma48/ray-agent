import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SHARED_SECRET_PATH = path.join(__dirname, 'shared-secret.json');

const ALGORITHM = 'aes-256-gcm';
const KEY_LEN = 32;
const SALT_LEN = 16;
const IV_LEN = 12;

/**
 * Encrypt an API key with a password using AES-256-GCM
 */
export function encryptApiKey(apiKey, password) {
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = crypto.scryptSync(password, salt, KEY_LEN);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag,
    encrypted
  };
}

/**
 * Decrypt an API key payload using the provided password
 */
export function decryptApiKey(payload, password) {
  try {
    const salt = Buffer.from(payload.salt, 'hex');
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');
    const key = crypto.scryptSync(password, salt, KEY_LEN);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(payload.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    throw new Error('Invalid password or corrupted shared key payload.');
  }
}

/**
 * Load the bundled shared secret payload if available
 */
export function loadBundledSecret() {
  if (fs.existsSync(SHARED_SECRET_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(SHARED_SECRET_PATH, 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Save the bundled shared secret payload
 */
export function saveBundledSecret(payload) {
  fs.writeFileSync(SHARED_SECRET_PATH, JSON.stringify(payload, null, 2), 'utf8');
}
