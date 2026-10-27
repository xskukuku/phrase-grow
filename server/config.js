import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT_DIR, '.env') });

export const PORT = Number(process.env.PORT) || 8787;
export const DATABASE_URL = process.env.DATABASE_URL?.trim();
export const DEEPSEEK_BASE_URL = (
  process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com'
).replace(/\/+$/, '');
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL?.trim() || '';
export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY?.trim() || '';
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const DIST_DIR = path.join(ROOT_DIR, 'dist', 'public');
export const DATA_DIR = process.env.DATA_DIR?.trim()
  ? path.resolve(process.env.DATA_DIR.trim())
  : path.join(ROOT_DIR, '.data');
export const DEFAULT_MODEL = 'deepseek-chat';
export const MAX_WORD_LENGTH = 160;
export const MAX_MEANING_LENGTH = 600;
export const SENTENCE_CACHE_MS = 5 * 60 * 1000;
