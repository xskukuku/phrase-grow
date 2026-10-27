export type Page = 'home' | 'words' | 'review' | 'settings';
export type WordKind = 'word' | 'phrase';
export type WordStatus = 'new' | 'learning' | 'reviewing' | 'mastered';
export type Rating = 'known' | 'unknown';

export interface Word {
  id: number;
  term: string;
  meaning: string | null;
  kind: WordKind;
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  dueAt: string;
  lapses: number;
  reviewCount: number;
  knownCount: number;
  lastReviewedAt: string | null;
  lastRating: Rating | null;
  createdAt: string;
  updatedAt: string;
  status: WordStatus;
  isDue: boolean;
}

export interface ActivityDay {
  date: string;
  count: number;
}

export interface Stats {
  totalWords: number;
  dueCount: number;
  dueNewCount: number;
  dueReviewCount: number;
  newCount: number;
  learningCount: number;
  reviewingCount: number;
  masteredCount: number;
  reviewedToday: number;
  knownToday: number;
  streak: number;
  activity: ActivityDay[];
  nextDueAt: string | null;
  timeZone: string;
}

export interface Sentence {
  sentence: string;
  sentenceZh: string;
  targetMeaning: string;
  partOfSpeech: string;
  model: string;
  generatedAt: string;
}

export interface ReviewSchedule {
  rating: Rating;
  repetitions: number;
  intervalDays: number;
  intervalMinutes: number;
  easeFactor: number;
  dueAt: string;
}

export interface AnswerResult {
  word: Word;
  schedule: ReviewSchedule;
}

export interface ReviewNextResult {
  word: Word | null;
  nextDueAt: string | null;
}

export interface WordsResult {
  words: Word[];
  total: number;
}

export interface PublicSettings {
  apiKeyConfigured: boolean;
  apiKeySource: 'environment' | 'saved' | null;
  apiKeyHint: string | null;
  savedKeyInvalid: boolean;
  model: string;
  modelSource: 'environment' | 'saved';
  baseUrlHost: string;
}

export interface WordInput {
  term: string;
  meaning?: string | null;
  kind: WordKind;
}
