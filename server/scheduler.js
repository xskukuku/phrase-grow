export const MIN_EASE_FACTOR = 1.3;
export const LEARNING_STEP_MINUTES = 10;
export const MASTERED_INTERVAL_DAYS = 21;

function roundEase(value) {
  return Math.round(value * 100) / 100;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86_400_000);
}

/**
 * Binary-rating adaptation of the SM-2 algorithm.
 *
 * - "known" counts as quality 4, so the ease factor is preserved.
 * - "unknown" counts as quality 2, lowers ease, resets the repetition chain,
 *   and puts the card back into a short 10-minute learning step.
 */
export function scheduleReview(word, rating, now = new Date()) {
  const previousEase = Number(word.ease_factor) || 2.5;
  const previousRepetitions = Number(word.repetitions) || 0;
  const previousInterval = Number(word.interval_days) || 0;
  const quality = rating === 'known' ? 4 : 2;
  const easeDelta =
    0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  const nextEase = roundEase(Math.max(MIN_EASE_FACTOR, previousEase + easeDelta));

  if (rating === 'unknown') {
    return {
      repetitions: 0,
      intervalDays: 0,
      easeFactor: nextEase,
      dueAt: addMinutes(now, LEARNING_STEP_MINUTES),
      intervalMinutes: LEARNING_STEP_MINUTES,
      quality,
      lapsed: true,
    };
  }

  let intervalDays;
  if (previousRepetitions === 0) {
    intervalDays = 1;
  } else if (previousRepetitions === 1) {
    intervalDays = 3;
  } else {
    intervalDays = Math.max(
      1,
      Math.min(3650, Math.round(Math.max(1, previousInterval) * nextEase)),
    );
  }

  return {
    repetitions: previousRepetitions + 1,
    intervalDays,
    easeFactor: nextEase,
    dueAt: addDays(now, intervalDays),
    intervalMinutes: intervalDays * 24 * 60,
    quality,
    lapsed: false,
  };
}

export function getWordStatus(word) {
  const reviewCount = Number(word.review_count) || 0;
  const intervalDays = Number(word.interval_days) || 0;
  const repetitions = Number(word.repetitions) || 0;

  if (reviewCount === 0) return 'new';
  if (intervalDays >= MASTERED_INTERVAL_DAYS) return 'mastered';
  if (repetitions >= 2) return 'reviewing';
  return 'learning';
}

export function serializeWord(row) {
  if (!row) return null;

  return {
    id: Number(row.id),
    term: row.term,
    meaning: row.meaning || null,
    kind: row.kind,
    repetitions: Number(row.repetitions) || 0,
    intervalDays: Number(row.interval_days) || 0,
    easeFactor: Number(row.ease_factor) || 2.5,
    dueAt: new Date(row.due_at).toISOString(),
    lapses: Number(row.lapses) || 0,
    reviewCount: Number(row.review_count) || 0,
    knownCount: Number(row.known_count) || 0,
    lastReviewedAt: row.last_reviewed_at
      ? new Date(row.last_reviewed_at).toISOString()
      : null,
    lastRating: row.last_rating || null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    status: getWordStatus(row),
    isDue: new Date(row.due_at).getTime() <= Date.now(),
  };
}
