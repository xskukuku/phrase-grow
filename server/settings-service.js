import {
  DEEPSEEK_API_KEY,
  DEEPSEEK_BASE_URL,
  DEEPSEEK_MODEL,
  DEFAULT_MODEL,
} from './config.js';
import { pool } from './db.js';
import { decryptSecret, encryptSecret } from './crypto.js';

const API_KEY_SETTING = 'deepseek_api_key';
const MODEL_SETTING = 'deepseek_model';
const MODEL_PATTERN = /^[a-zA-Z0-9._:-]{1,80}$/;

async function readSetting(key) {
  const result = await pool.query(
    'SELECT value FROM app_settings WHERE key = $1',
    [key],
  );
  return result.rows[0]?.value ?? null;
}

async function upsertSetting(key, value) {
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value],
  );
}

async function removeSetting(key) {
  await pool.query('DELETE FROM app_settings WHERE key = $1', [key]);
}

export function normalizeModel(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return MODEL_PATTERN.test(trimmed) ? trimmed : null;
}

function getBaseUrlHost() {
  try {
    return new URL(DEEPSEEK_BASE_URL).host;
  } catch {
    return 'api.deepseek.com';
  }
}

export async function getRuntimeConfig() {
  let savedKey = null;
  let savedKeyRowExists = false;
  let model = DEFAULT_MODEL;

  try {
    const [encryptedKey, savedModel] = await Promise.all([
      readSetting(API_KEY_SETTING),
      readSetting(MODEL_SETTING),
    ]);
    savedKeyRowExists = Boolean(encryptedKey);
    if (encryptedKey) {
      savedKey = await decryptSecret(encryptedKey);
    }
    const normalizedModel = normalizeModel(savedModel);
    if (normalizedModel) model = normalizedModel;
  } catch (error) {
    console.error('[settings] Could not read saved settings:', error.message);
  }

  if (DEEPSEEK_MODEL) {
    model = normalizeModel(DEEPSEEK_MODEL) || DEFAULT_MODEL;
  }

  const apiKey = DEEPSEEK_API_KEY || savedKey || '';
  const apiKeySource = DEEPSEEK_API_KEY
    ? 'environment'
    : savedKey
      ? 'saved'
      : null;

  return {
    apiKey,
    apiKeySource,
    apiKeyHint: apiKey ? apiKey.slice(-4) : null,
    savedKeyInvalid: savedKeyRowExists && !savedKey && !DEEPSEEK_API_KEY,
    model,
    modelSource: DEEPSEEK_MODEL ? 'environment' : 'saved',
    baseUrl: DEEPSEEK_BASE_URL,
    baseUrlHost: getBaseUrlHost(),
  };
}

export async function getPublicSettings() {
  const runtime = await getRuntimeConfig();
  return {
    apiKeyConfigured: Boolean(runtime.apiKey),
    apiKeySource: runtime.apiKeySource,
    apiKeyHint: runtime.apiKeyHint,
    savedKeyInvalid: runtime.savedKeyInvalid,
    model: runtime.model,
    modelSource: runtime.modelSource,
    baseUrlHost: runtime.baseUrlHost,
  };
}

export async function saveSettings({ apiKey, clearApiKey, model }) {
  if (typeof apiKey === 'string' && apiKey.trim()) {
    const trimmed = apiKey.trim();
    if (trimmed.length < 8 || trimmed.length > 300) {
      return { error: 'API Key 长度不正确。' };
    }
    const encrypted = await encryptSecret(trimmed);
    await upsertSetting(API_KEY_SETTING, encrypted);
  } else if (clearApiKey === true) {
    await removeSetting(API_KEY_SETTING);
  }

  if (typeof model === 'string' && model.trim()) {
    const normalized = normalizeModel(model);
    if (!normalized) {
      return { error: '模型名称格式不正确。' };
    }
    await upsertSetting(MODEL_SETTING, normalized);
  }

  return { settings: await getPublicSettings() };
}
