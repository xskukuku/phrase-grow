import pg from 'pg';
import { DATABASE_URL } from './config.js';

const { Pool, types } = pg;

// BIGINT / COUNT values fit comfortably within JavaScript's safe integer range here.
types.setTypeParser(20, (value) => Number(value));

if (!DATABASE_URL) {
  throw new Error(
    '缺少 DATABASE_URL。请复制 .env.example 为 .env，并填入 PostgreSQL 连接字符串。',
  );
}

function buildPoolOptions(connectionString) {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get('sslmode');
  // node-postgres does not understand libpq-only options. SSL is configured explicitly below.
  url.searchParams.delete('sslmode');
  url.searchParams.delete('channel_binding');

  const needsSsl =
    sslMode === 'require' ||
    sslMode === 'verify-ca' ||
    sslMode === 'verify-full' ||
    url.hostname.endsWith('.neon.tech');

  return {
    connectionString: url.toString(),
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 6,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    query_timeout: 20_000,
    application_name: 'phrase-grow',
  };
}

export const pool = new Pool(buildPoolOptions(DATABASE_URL));

pool.on('error', (error) => {
  console.error('[db] Unexpected idle client error:', error.message);
});

export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS words (
      id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      term              TEXT NOT NULL,
      term_key          TEXT NOT NULL UNIQUE,
      meaning           TEXT,
      kind              TEXT NOT NULL DEFAULT 'word'
                        CHECK (kind IN ('word', 'phrase')),
      repetitions       INTEGER NOT NULL DEFAULT 0,
      interval_days     INTEGER NOT NULL DEFAULT 0,
      ease_factor       DOUBLE PRECISION NOT NULL DEFAULT 2.5,
      due_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      lapses            INTEGER NOT NULL DEFAULT 0,
      review_count      INTEGER NOT NULL DEFAULT 0,
      known_count       INTEGER NOT NULL DEFAULT 0,
      last_reviewed_at  TIMESTAMPTZ,
      last_rating       TEXT CHECK (last_rating IN ('known', 'unknown')),
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS words_due_at_idx ON words (due_at);
    CREATE INDEX IF NOT EXISTS words_created_at_idx ON words (created_at DESC);

    CREATE TABLE IF NOT EXISTS review_logs (
      id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      word_id             BIGINT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      rating              TEXT NOT NULL CHECK (rating IN ('known', 'unknown')),
      quality             INTEGER NOT NULL,
      interval_before     INTEGER NOT NULL DEFAULT 0,
      interval_after      INTEGER NOT NULL DEFAULT 0,
      due_before          TIMESTAMPTZ,
      due_after           TIMESTAMPTZ NOT NULL,
      ease_after          DOUBLE PRECISION NOT NULL,
      sentence            TEXT,
      sentence_zh         TEXT,
      target_meaning_zh   TEXT,
      reviewed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS review_logs_reviewed_at_idx
      ON review_logs (reviewed_at DESC);
    CREATE INDEX IF NOT EXISTS review_logs_word_id_idx
      ON review_logs (word_id);

    CREATE TABLE IF NOT EXISTS app_settings (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function checkDatabase() {
  const result = await pool.query('SELECT 1 AS ok');
  return result.rows[0]?.ok === 1;
}
