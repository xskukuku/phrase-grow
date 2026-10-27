import { Router } from 'express';
import {
  MAX_MEANING_LENGTH,
  MAX_WORD_LENGTH,
  SENTENCE_CACHE_MS,
} from './config.js';
import { pool } from './db.js';
import { AppError, asyncRoute } from './errors.js';
import { generateExample, testDeepSeekConnection } from './deepseek.js';
import {
  getPublicSettings,
  saveSettings,
} from './settings-service.js';
import { scheduleReview, serializeWord } from './scheduler.js';

export const apiRouter = Router();

const sentenceCache = new Map();
const sentenceInFlight = new Map();

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AppError(400, 'INVALID_ID', '词条编号不正确。');
  }
  return id;
}

function normalizeTerm(value) {
  if (typeof value !== 'string') {
    throw new AppError(400, 'INVALID_TERM', '请填写要学习的单词或短语。');
  }
  const term = value.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!term) {
    throw new AppError(400, 'INVALID_TERM', '请填写要学习的单词或短语。');
  }
  if (term.length > MAX_WORD_LENGTH) {
    throw new AppError(
      400,
      'INVALID_TERM',
      `单词或短语不能超过 ${MAX_WORD_LENGTH} 个字符。`,
    );
  }
  if (!/[\p{L}\p{N}]/u.test(term) || /[\u0000-\u001f\u007f]/.test(term)) {
    throw new AppError(400, 'INVALID_TERM', '这个单词或短语格式不正确。');
  }
  return term;
}

function termKey(term) {
  return term.toLocaleLowerCase('en-US');
}

function cleanOptionalMeaning(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new AppError(400, 'INVALID_MEANING', '释义格式不正确。');
  }
  const meaning = value.trim();
  if (!meaning) return null;
  if (meaning.length > MAX_MEANING_LENGTH) {
    throw new AppError(
      400,
      'INVALID_MEANING',
      `释义不能超过 ${MAX_MEANING_LENGTH} 个字符。`,
    );
  }
  return meaning;
}

function cleanKind(value, term) {
  if (value === undefined || value === null || value === '') {
    return /\s/.test(term) ? 'phrase' : 'word';
  }
  if (value !== 'word' && value !== 'phrase') {
    throw new AppError(400, 'INVALID_KIND', '类型只能是单词或短语。');
  }
  return value;
}

function isUniqueViolation(error) {
  return error?.code === '23505';
}

function safeTimeZone(value) {
  const fallback = 'Asia/Shanghai';
  if (!value || typeof value !== 'string') return fallback;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return value;
  } catch {
    return fallback;
  }
}

function dateInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDate(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day) + days * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function safeLogText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function buildWordsWhere(search, filter) {
  const clauses = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    clauses.push(
      `(term ILIKE $${params.length} OR COALESCE(meaning, '') ILIKE $${params.length})`,
    );
  }

  const filters = {
    due: 'due_at <= NOW()',
    new: 'review_count = 0',
    learning: 'review_count > 0 AND interval_days < 21 AND repetitions < 2',
    reviewing: 'review_count > 0 AND interval_days < 21 AND repetitions >= 2',
    mastered: 'interval_days >= 21',
  };
  if (filter && filter !== 'all') {
    if (!filters[filter]) {
      throw new AppError(400, 'INVALID_FILTER', '筛选条件不正确。');
    }
    clauses.push(`(${filters[filter]})`);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

apiRouter.get(
  '/health',
  asyncRoute(async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'phrase-grow', time: new Date().toISOString() });
  }),
);

apiRouter.get(
  '/stats',
  asyncRoute(async (req, res) => {
    const timeZone = safeTimeZone(req.query.tz);

    const [
      summaryResult,
      todayResult,
      activityResult,
      streakDatesResult,
    ] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS total_words,
          COUNT(*) FILTER (WHERE due_at <= NOW())::int AS due_count,
          COUNT(*) FILTER (WHERE due_at <= NOW() AND review_count = 0)::int AS due_new_count,
          COUNT(*) FILTER (WHERE due_at <= NOW() AND review_count > 0)::int AS due_review_count,
          COUNT(*) FILTER (WHERE review_count = 0)::int AS new_count,
          COUNT(*) FILTER (
            WHERE review_count > 0 AND interval_days < 21 AND repetitions < 2
          )::int AS learning_count,
          COUNT(*) FILTER (
            WHERE review_count > 0 AND interval_days < 21 AND repetitions >= 2
          )::int AS reviewing_count,
          COUNT(*) FILTER (WHERE interval_days >= 21)::int AS mastered_count,
          MIN(due_at) FILTER (WHERE due_at > NOW()) AS next_due_at
        FROM words
      `),
      pool.query(
        `SELECT
           COUNT(*)::int AS reviewed_today,
           COUNT(*) FILTER (WHERE rating = 'known')::int AS known_today
         FROM review_logs
         WHERE (reviewed_at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date`,
        [timeZone],
      ),
      pool.query(
        `SELECT
           to_char((reviewed_at AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS date,
           COUNT(*)::int AS count
         FROM review_logs
         WHERE reviewed_at >= NOW() - INTERVAL '40 days'
         GROUP BY 1
         ORDER BY 1`,
        [timeZone],
      ),
      pool.query(
        `SELECT DISTINCT
           to_char((reviewed_at AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS date
         FROM review_logs
         WHERE reviewed_at >= NOW() - INTERVAL '400 days'
         ORDER BY date DESC`,
        [timeZone],
      ),
    ]);

    const summary = summaryResult.rows[0];
    const today = todayResult.rows[0];
    const todayDate = dateInTimeZone(new Date(), timeZone);
    const activityMap = new Map(
      activityResult.rows.map((row) => [row.date, Number(row.count)]),
    );
    const activity = Array.from({ length: 35 }, (_, index) => {
      const date = shiftDate(todayDate, index - 34);
      return { date, count: activityMap.get(date) || 0 };
    });

    const reviewedDates = new Set(streakDatesResult.rows.map((row) => row.date));
    let streak = 0;
    let cursor = reviewedDates.has(todayDate)
      ? todayDate
      : shiftDate(todayDate, -1);
    while (reviewedDates.has(cursor)) {
      streak += 1;
      cursor = shiftDate(cursor, -1);
    }

    res.json({
      totalWords: summary.total_words,
      dueCount: summary.due_count,
      dueNewCount: summary.due_new_count,
      dueReviewCount: summary.due_review_count,
      newCount: summary.new_count,
      learningCount: summary.learning_count,
      reviewingCount: summary.reviewing_count,
      masteredCount: summary.mastered_count,
      reviewedToday: today.reviewed_today,
      knownToday: today.known_today,
      streak,
      activity,
      nextDueAt: summary.next_due_at
        ? new Date(summary.next_due_at).toISOString()
        : null,
      timeZone,
    });
  }),
);

apiRouter.get(
  '/words',
  asyncRoute(async (req, res) => {
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const filter =
      typeof req.query.filter === 'string' ? req.query.filter.trim() : 'all';
    const sort = req.query.sort === 'created' ? 'created' : 'due';
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(500, Math.max(1, Math.floor(requestedLimit)))
      : 300;

    const { where, params } = buildWordsWhere(search, filter);
    const orderBy =
      sort === 'created' ? 'created_at DESC, id DESC' : 'due_at ASC, id ASC';
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM words ${where}`,
      params,
    );
    const result = await pool.query(
      `SELECT * FROM words ${where} ORDER BY ${orderBy} LIMIT $${params.length + 1}`,
      [...params, limit],
    );

    res.json({
      words: result.rows.map(serializeWord),
      total: countResult.rows[0].total,
    });
  }),
);

apiRouter.post(
  '/words',
  asyncRoute(async (req, res) => {
    const term = normalizeTerm(req.body?.term);
    const meaning = cleanOptionalMeaning(req.body?.meaning);
    const kind = cleanKind(req.body?.kind, term);

    try {
      const result = await pool.query(
        `INSERT INTO words (term, term_key, meaning, kind, due_at)
         VALUES ($1, $2, $3, $4, NOW() - INTERVAL '1 minute')
         RETURNING *`,
        [term, termKey(term), meaning, kind],
      );
      res.status(201).json({ word: serializeWord(result.rows[0]) });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(409, 'DUPLICATE_WORD', '这个词已经在你的词库里了。');
      }
      throw error;
    }
  }),
);

apiRouter.patch(
  '/words/:id',
  asyncRoute(async (req, res) => {
    const id = parseId(req.params.id);
    const updates = [];
    const params = [];
    let nextTerm = null;

    if (Object.hasOwn(req.body || {}, 'term')) {
      nextTerm = normalizeTerm(req.body.term);
      params.push(nextTerm, termKey(nextTerm));
      updates.push(`term = $${params.length - 1}`, `term_key = $${params.length}`);
    }
    if (Object.hasOwn(req.body || {}, 'meaning')) {
      const meaning = cleanOptionalMeaning(req.body.meaning);
      params.push(meaning);
      updates.push(`meaning = $${params.length}`);
    }
    if (Object.hasOwn(req.body || {}, 'kind')) {
      const provisionalTerm = nextTerm || 'placeholder';
      const kind = cleanKind(req.body.kind, nextTerm || provisionalTerm);
      params.push(kind);
      updates.push(`kind = $${params.length}`);
    }

    if (!updates.length) {
      throw new AppError(400, 'NO_CHANGES', '没有需要保存的修改。');
    }

    params.push(id);
    updates.push('updated_at = NOW()');

    try {
      const result = await pool.query(
        `UPDATE words SET ${updates.join(', ')}
         WHERE id = $${params.length}
         RETURNING *`,
        params,
      );
      if (!result.rows[0]) {
        throw new AppError(404, 'WORD_NOT_FOUND', '没有找到这个词条。');
      }
      sentenceCache.delete(String(id));
      res.json({ word: serializeWord(result.rows[0]) });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(409, 'DUPLICATE_WORD', '这个词已经在你的词库里了。');
      }
      throw error;
    }
  }),
);

apiRouter.delete(
  '/words/:id',
  asyncRoute(async (req, res) => {
    const id = parseId(req.params.id);
    const result = await pool.query('DELETE FROM words WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      throw new AppError(404, 'WORD_NOT_FOUND', '没有找到这个词条。');
    }
    sentenceCache.delete(String(id));
    sentenceInFlight.delete(String(id));
    res.status(204).end();
  }),
);

apiRouter.get(
  '/review/next',
  asyncRoute(async (_req, res) => {
    const result = await pool.query(
      `SELECT * FROM words
       WHERE due_at <= NOW()
       ORDER BY due_at ASC, id ASC
       LIMIT 1`,
    );

    if (result.rows[0]) {
      res.json({ word: serializeWord(result.rows[0]), nextDueAt: null });
      return;
    }

    const nextResult = await pool.query(
      'SELECT MIN(due_at) AS next_due_at FROM words WHERE due_at > NOW()',
    );
    res.json({
      word: null,
      nextDueAt: nextResult.rows[0]?.next_due_at
        ? new Date(nextResult.rows[0].next_due_at).toISOString()
        : null,
    });
  }),
);

apiRouter.post(
  '/words/:id/sentence',
  asyncRoute(async (req, res) => {
    const id = parseId(req.params.id);
    const cacheKey = String(id);
    const cached = sentenceCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json({ generation: cached.generation, cached: true });
      return;
    }

    const wordResult = await pool.query('SELECT * FROM words WHERE id = $1', [id]);
    const word = wordResult.rows[0];
    if (!word) {
      throw new AppError(404, 'WORD_NOT_FOUND', '没有找到这个词条。');
    }

    let generationPromise = sentenceInFlight.get(cacheKey);
    if (!generationPromise) {
      generationPromise = (async () => {
        const generation = await generateExample(word);

        if (!word.meaning) {
          await pool.query(
            `UPDATE words
             SET meaning = $1, updated_at = NOW()
             WHERE id = $2 AND (meaning IS NULL OR meaning = '')`,
            [generation.targetMeaning, id],
          );
        }

        const cacheEntry = {
          generation,
          expiresAt: Date.now() + SENTENCE_CACHE_MS,
        };
        sentenceCache.set(cacheKey, cacheEntry);
        return generation;
      })().finally(() => {
        sentenceInFlight.delete(cacheKey);
      });
      sentenceInFlight.set(cacheKey, generationPromise);
    }

    const generation = await generationPromise;
    res.json({ generation, cached: false });
  }),
);

apiRouter.post(
  '/review/:id/answer',
  asyncRoute(async (req, res) => {
    const id = parseId(req.params.id);
    const rating = req.body?.rating;
    if (rating !== 'known' && rating !== 'unknown') {
      throw new AppError(400, 'INVALID_RATING', '请选择认识或不认识。');
    }

    const sentence = safeLogText(req.body?.sentence, 600);
    const sentenceZh = safeLogText(req.body?.sentenceZh, 600);
    const targetMeaningZh = safeLogText(req.body?.targetMeaningZh, 300);
    const now = new Date();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const existingResult = await client.query(
        'SELECT * FROM words WHERE id = $1 FOR UPDATE',
        [id],
      );
      const word = existingResult.rows[0];
      if (!word) {
        throw new AppError(404, 'WORD_NOT_FOUND', '没有找到这个词条。');
      }

      const schedule = scheduleReview(word, rating, now);
      const updateResult = await client.query(
        `UPDATE words
         SET repetitions = $2,
             interval_days = $3,
             ease_factor = $4,
             due_at = $5,
             lapses = lapses + $6,
             review_count = review_count + 1,
             known_count = known_count + $7,
             last_reviewed_at = $8,
             last_rating = $9,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          id,
          schedule.repetitions,
          schedule.intervalDays,
          schedule.easeFactor,
          schedule.dueAt.toISOString(),
          schedule.lapsed ? 1 : 0,
          rating === 'known' ? 1 : 0,
          now.toISOString(),
          rating,
        ],
      );

      await client.query(
        `INSERT INTO review_logs (
           word_id, rating, quality, interval_before, interval_after,
           due_before, due_after, ease_after, sentence, sentence_zh,
           target_meaning_zh, reviewed_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          id,
          rating,
          schedule.quality,
          Number(word.interval_days) || 0,
          schedule.intervalDays,
          word.due_at ? new Date(word.due_at).toISOString() : null,
          schedule.dueAt.toISOString(),
          schedule.easeFactor,
          sentence,
          sentenceZh,
          targetMeaningZh,
          now.toISOString(),
        ],
      );

      await client.query('COMMIT');

      res.json({
        word: serializeWord(updateResult.rows[0]),
        schedule: {
          rating,
          repetitions: schedule.repetitions,
          intervalDays: schedule.intervalDays,
          intervalMinutes: schedule.intervalMinutes,
          easeFactor: schedule.easeFactor,
          dueAt: schedule.dueAt.toISOString(),
        },
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }),
);

apiRouter.get(
  '/settings',
  asyncRoute(async (_req, res) => {
    res.json({ settings: await getPublicSettings() });
  }),
);

apiRouter.put(
  '/settings',
  asyncRoute(async (req, res) => {
    const body = req.body || {};
    if (
      body.apiKey !== undefined &&
      body.apiKey !== null &&
      typeof body.apiKey !== 'string'
    ) {
      throw new AppError(400, 'INVALID_API_KEY', 'API Key 格式不正确。');
    }
    if (body.clearApiKey !== undefined && typeof body.clearApiKey !== 'boolean') {
      throw new AppError(400, 'INVALID_SETTING', '设置参数不正确。');
    }

    const result = await saveSettings({
      apiKey: typeof body.apiKey === 'string' ? body.apiKey : undefined,
      clearApiKey: body.clearApiKey === true,
      model: typeof body.model === 'string' ? body.model : undefined,
    });

    if (result.error) {
      throw new AppError(400, 'INVALID_SETTING', result.error);
    }
    res.json({ settings: result.settings });
  }),
);

apiRouter.post(
  '/settings/test',
  asyncRoute(async (_req, res) => {
    res.json(await testDeepSeekConnection());
  }),
);

apiRouter.use((_req, _res, next) => {
  next(new AppError(404, 'API_NOT_FOUND', '接口不存在。'));
});
