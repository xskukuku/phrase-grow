import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './config.js';

const SECRET_FILE = path.join(DATA_DIR, 'app-secret');
let cachedKey = null;

async function loadKey() {
  if (cachedKey) return cachedKey;

  if (process.env.APP_SECRET?.trim()) {
    cachedKey = crypto
      .createHash('sha256')
      .update(process.env.APP_SECRET.trim(), 'utf8')
      .digest();
    return cachedKey;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const stored = (await fs.readFile(SECRET_FILE, 'utf8')).trim();
    const decoded = Buffer.from(stored, 'base64');
    if (decoded.length !== 32) {
      throw new Error('Invalid local secret length');
    }
    cachedKey = decoded;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const generated = crypto.randomBytes(32);
    await fs.writeFile(SECRET_FILE, generated.toString('base64'), {
      encoding: 'utf8',
      mode: 0o600,
    });
    cachedKey = generated;
  }

  return cachedKey;
}

export async function encryptSecret(plaintext) {
  const key = await loadKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

export async function decryptSecret(payload) {
  if (typeof payload !== 'string') return null;
  const [version, ivPart, tagPart, dataPart] = payload.split(':');
  if (version !== 'v1' || !ivPart || !tagPart || !dataPart) return null;

  try {
    const key = await loadKey();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivPart, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}
