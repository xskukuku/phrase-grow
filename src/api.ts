import type {
  AnswerResult,
  PublicSettings,
  Rating,
  ReviewNextResult,
  Sentence,
  Stats,
  Word,
  WordInput,
  WordsResult,
} from './types';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 0, code = 'UNKNOWN') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError('无法连接服务器，请检查网络后重试。', 0, 'NETWORK_ERROR');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Keep a readable fallback for non-JSON failures.
  }

  if (!response.ok) {
    const body = payload as
      | { error?: { message?: string; code?: string } }
      | null;
    throw new ApiError(
      body?.error?.message || `请求失败（HTTP ${response.status}）`,
      response.status,
      body?.error?.code || 'REQUEST_FAILED',
    );
  }

  return payload as T;
}

export function getTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
  } catch {
    return 'Asia/Shanghai';
  }
}

export const api = {
  getStats(timeZone = getTimeZone()): Promise<Stats> {
    return request(`/api/stats?tz=${encodeURIComponent(timeZone)}`);
  },

  getWords(params: {
    search?: string;
    filter?: string;
    sort?: 'due' | 'created';
    limit?: number;
  } = {}): Promise<WordsResult> {
    const search = new URLSearchParams();
    if (params.search) search.set('search', params.search);
    if (params.filter && params.filter !== 'all') search.set('filter', params.filter);
    if (params.sort) search.set('sort', params.sort);
    if (params.limit) search.set('limit', String(params.limit));
    return request(`/api/words?${search.toString()}`);
  },

  createWord(input: WordInput): Promise<{ word: Word }> {
    return request('/api/words', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateWord(
    id: number,
    input: Partial<WordInput>,
  ): Promise<{ word: Word }> {
    return request(`/api/words/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  deleteWord(id: number): Promise<void> {
    return request(`/api/words/${id}`, { method: 'DELETE' });
  },

  getNextReview(): Promise<ReviewNextResult> {
    return request('/api/review/next');
  },

  generateSentence(wordId: number): Promise<{ generation: Sentence; cached: boolean }> {
    return request(`/api/words/${wordId}/sentence`, { method: 'POST' });
  },

  answerReview(
    wordId: number,
    rating: Rating,
    sentence: Sentence | null,
  ): Promise<AnswerResult> {
    return request(`/api/review/${wordId}/answer`, {
      method: 'POST',
      body: JSON.stringify({
        rating,
        sentence: sentence?.sentence || null,
        sentenceZh: sentence?.sentenceZh || null,
        targetMeaningZh: sentence?.targetMeaning || null,
      }),
    });
  },

  getSettings(): Promise<{ settings: PublicSettings }> {
    return request('/api/settings');
  },

  saveSettings(input: {
    apiKey?: string;
    clearApiKey?: boolean;
    model?: string;
  }): Promise<{ settings: PublicSettings }> {
    return request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  testSettings(): Promise<{ ok: boolean; latencyMs: number; model: string }> {
    return request('/api/settings/test', { method: 'POST' });
  },
};
