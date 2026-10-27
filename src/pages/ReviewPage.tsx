import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  CloudOff,
  KeyRound,
  Leaf,
  LoaderCircle,
  RotateCw,
  Sparkles,
  Sprout,
  X,
} from 'lucide-react';
import { api, ApiError } from '../api';
import { SentenceView } from '../components/SentenceView';
import type { ToastTone } from '../components/Toast';
import type { AnswerResult, Rating, Sentence, Stats, Word } from '../types';
import {
  formatNextReview,
  formatSchedule,
  getGreeting,
} from '../utils';

type ReviewStage = 'loading' | 'front' | 'answered' | 'empty' | 'error';

interface ReviewPageProps {
  stats: Stats | null;
  apiConfigured: boolean | null;
  onStatsChanged: () => void;
  onAddWord: () => void;
  onOpenSettings: () => void;
  onOpenWords: () => void;
  onNotify: (message: string, tone?: ToastTone) => void;
}

interface GenerationError {
  message: string;
  code: string;
}

export function ReviewPage({
  stats,
  apiConfigured,
  onStatsChanged,
  onAddWord,
  onOpenSettings,
  onOpenWords,
  onNotify,
}: ReviewPageProps) {
  const [stage, setStage] = useState<ReviewStage>('loading');
  const [word, setWord] = useState<Word | null>(null);
  const [generation, setGeneration] = useState<Sentence | null>(null);
  const [generationLoading, setGenerationLoading] = useState(false);
  const [generationError, setGenerationError] = useState<GenerationError | null>(
    null,
  );
  const [answer, setAnswer] = useState<AnswerResult | null>(null);
  const [submittingRating, setSubmittingRating] = useState<Rating | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [nextDueAt, setNextDueAt] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const cardRequestRef = useRef(0);
  const generationRequestRef = useRef(0);
  const mountedRef = useRef(true);
  const answerLockRef = useRef(false);

  const requestSentence = useCallback(async (targetWord: Word) => {
    const requestId = generationRequestRef.current + 1;
    generationRequestRef.current = requestId;
    setGeneration(null);
    setGenerationError(null);
    setGenerationLoading(true);

    try {
      const result = await api.generateSentence(targetWord.id);
      if (!mountedRef.current || generationRequestRef.current !== requestId) return;
      setGeneration(result.generation);
    } catch (caught) {
      if (!mountedRef.current || generationRequestRef.current !== requestId) return;
      const apiError = caught instanceof ApiError ? caught : null;
      setGenerationError({
        message: apiError?.message || 'AI 例句生成失败，请重试。',
        code: apiError?.code || 'UNKNOWN',
      });
    } finally {
      if (mountedRef.current && generationRequestRef.current === requestId) {
        setGenerationLoading(false);
      }
    }
  }, []);

  const loadNextCard = useCallback(async () => {
    const requestId = cardRequestRef.current + 1;
    cardRequestRef.current = requestId;
    generationRequestRef.current += 1;
    setStage('loading');
    setWord(null);
    setGeneration(null);
    setGenerationError(null);
    setAnswer(null);
    setAnswerError(null);
    setSubmittingRating(null);
    setCardError(null);

    try {
      const result = await api.getNextReview();
      if (!mountedRef.current || cardRequestRef.current !== requestId) return;

      if (!result.word) {
        setNextDueAt(result.nextDueAt);
        setStage('empty');
        return;
      }

      setWord(result.word);
      setStage('front');
      void requestSentence(result.word);
    } catch (caught) {
      if (!mountedRef.current || cardRequestRef.current !== requestId) return;
      setCardError(
        caught instanceof ApiError
          ? caught.message
          : '读取复习队列失败，请稍后重试。',
      );
      setStage('error');
    }
  }, [requestSentence]);

  useEffect(() => {
    mountedRef.current = true;
    void loadNextCard();
    return () => {
      mountedRef.current = false;
      cardRequestRef.current += 1;
      generationRequestRef.current += 1;
    };
  }, [loadNextCard]);

  const handleAnswer = useCallback(
    async (rating: Rating) => {
      if (
        !word ||
        !generation ||
        stage !== 'front' ||
        submittingRating ||
        answerLockRef.current
      ) {
        return;
      }
      answerLockRef.current = true;
      setSubmittingRating(rating);
      setAnswerError(null);

      try {
        const result = await api.answerReview(word.id, rating, generation);
        if (!mountedRef.current) return;
        setAnswer(result);
        setStage('answered');
        setSessionCount((count) => count + 1);
        onStatsChanged();
      } catch (caught) {
        if (!mountedRef.current) return;
        const message =
          caught instanceof ApiError
            ? caught.message
            : '这次回答没能保存，请再试一次。';
        setAnswerError(message);
        onNotify(message, 'error');
      } finally {
        answerLockRef.current = false;
        if (mountedRef.current) setSubmittingRating(null);
      }
    },
    [generation, onNotify, onStatsChanged, stage, submittingRating, word],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }
      if (event.repeat) return;

      if (stage === 'front' && generation && !submittingRating) {
        if (event.key === '1') {
          event.preventDefault();
          void handleAnswer('unknown');
        } else if (event.key === '2') {
          event.preventDefault();
          void handleAnswer('known');
        }
      } else if (stage === 'answered' && event.key === 'Enter') {
        event.preventDefault();
        void loadNextCard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [generation, handleAnswer, loadNextCard, stage, submittingRating]);

  const retryGeneration = () => {
    if (word) void requestSentence(word);
  };

  const todayReviewed = stats?.reviewedToday ?? sessionCount;
  const dueCount = stats?.dueCount ?? 0;
  const isApiKeyIssue =
    generationError?.code === 'API_KEY_MISSING' ||
    generationError?.code === 'DEEPSEEK_AUTH';

  return (
    <div className="page review-page">
      <h1 className="sr-only">语境复习</h1>

      <header className="review-topline">
        <a className="review-exit" href="#/home">
          <ArrowLeft size={17} />
          <span>结束复习</span>
        </a>
        <div className="review-session-label">
          <span className="live-dot" aria-hidden="true" />
          {getGreeting()}，慢慢读
        </div>
        <div className="review-today">
          <span>今日已复习</span>
          <strong>{todayReviewed}</strong>
          <span className="review-due-divider" aria-hidden="true" />
          <span>待复习</span>
          <strong>{dueCount}</strong>
        </div>
      </header>

      {apiConfigured === false ? (
        <div className="review-setup-warning">
          <KeyRound size={16} />
          <span>还没有配置 DeepSeek API Key，AI 例句暂时无法生成。</span>
          <button type="button" className="btn btn-text btn-sm" onClick={onOpenSettings}>
            去设置
          </button>
        </div>
      ) : null}

      <div className="review-shell">
        {stage === 'loading' ? (
          <section className="review-card review-loading" aria-busy="true">
            <div className="review-loading-orb" aria-hidden="true">
              <LoaderCircle size={26} />
            </div>
            <p className="eyebrow">PREPARING YOUR SENTENCE</p>
            <h2>正在翻开下一张词卡…</h2>
            <div className="skeleton skeleton-sentence-line" />
            <div className="skeleton skeleton-sentence-line medium" />
            <div className="skeleton skeleton-sentence-line short" />
          </section>
        ) : null}

        {stage === 'error' ? (
          <section className="review-card review-state-card">
            <span className="review-state-icon review-state-error">
              <CloudOff size={30} />
            </span>
            <p className="eyebrow">CONNECTION PAUSED</p>
            <h2>没能读到下一张词卡</h2>
            <p className="review-state-copy">{cardError}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void loadNextCard()}
            >
              <RotateCw size={17} />
              重新加载
            </button>
          </section>
        ) : null}

        {stage === 'empty' ? (
          <section className="review-card review-state-card review-empty-card">
            <span className="review-state-icon">
              <Leaf size={34} />
            </span>
            <p className="eyebrow">ALL QUIET IN THE GARDEN</p>
            <h2>{sessionCount > 0 ? '这一轮，复习完成。' : '今天没有到期的词。'}</h2>
            <p className="review-state-copy">
              {sessionCount > 0
                ? `你刚刚和 ${sessionCount} 个词重新见了面。剩下的交给记忆曲线，让它们在对的时候再回来。`
                : '你的复习队列已经清空。可以去词库添加新词，或者等下一轮复习自动出现。'}
            </p>
            <div className="next-review-note">
              <CalendarClock size={17} />
              <span>下次复习：{formatNextReview(nextDueAt)}</span>
            </div>
            <div className="review-empty-actions">
              <button type="button" className="btn btn-primary" onClick={onAddWord}>
                <Sprout size={17} />
                添加新词
              </button>
              <button type="button" className="btn btn-secondary" onClick={onOpenWords}>
                <BookOpen size={17} />
                查看词库
              </button>
            </div>
          </section>
        ) : null}

        {stage === 'front' && word ? (
          <section className="review-card">
            <div className="review-card-topline">
              <div className="target-chip-group">
                <span className="target-label">本次生词</span>
                <span className="target-chip">{word.term}</span>
                <span className={`kind-pill kind-${word.kind}`}>
                  {word.kind === 'phrase' ? '短语' : '单词'}
                </span>
              </div>
              <span className="ai-difficulty-chip">
                <Sparkles size={14} />
                AI 例句 · 中等难度
              </span>
            </div>

            {generationLoading ? (
              <div className="generation-loading" aria-live="polite">
                <div className="generation-loading-mark">
                  <span className="ai-pulse" aria-hidden="true">
                    <Sparkles size={21} />
                  </span>
                  <span>
                    AI 正在用「{word.term}」写一句
                    <br className="mobile-break" /> 难度适中的新句子…
                  </span>
                </div>
                <div className="skeleton skeleton-sentence-line" />
                <div className="skeleton skeleton-sentence-line medium" />
                <div className="skeleton skeleton-sentence-line short" />
                <p className="generation-hint">通常只需要几秒钟，请稍候。</p>
              </div>
            ) : null}

            {generationError ? (
              <div className="generation-error">
                <span className="generation-error-icon">
                  <CloudOff size={22} />
                </span>
                <div>
                  <h3>这次的句子没有写出来</h3>
                  <p>{generationError.message}</p>
                  <div className="generation-error-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={retryGeneration}
                    >
                      <RotateCw size={15} />
                      重新生成
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={onOpenSettings}
                    >
                      <KeyRound size={15} />
                      检查设置
                    </button>
                  </div>
                  {isApiKeyIssue ? (
                    <p className="generation-error-note">
                      先在设置中填写有效的 DeepSeek API Key，才能开始 AI 造句。
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {generation && !generationLoading ? (
              <>
                <p className="review-instruction">
                  读一读这句话，想一想高亮的目标词在这里是什么意思。
                </p>
                <SentenceView sentence={generation.sentence} term={word.term} />

                {answerError ? (
                  <div className="inline-alert inline-alert-error" role="alert">
                    <CloudOff size={17} />
                    <span>{answerError}</span>
                  </div>
                ) : null}

                <div className="rating-actions">
                  <button
                    type="button"
                    className="rating-button rating-unknown"
                    onClick={() => void handleAnswer('unknown')}
                    disabled={Boolean(submittingRating)}
                  >
                    <span className="rating-icon">
                      {submittingRating === 'unknown' ? (
                        <LoaderCircle size={21} className="spin" />
                      ) : (
                        <X size={21} />
                      )}
                    </span>
                    <span className="rating-copy">
                      <strong>不认识</strong>
                      <small>还没想起来</small>
                    </span>
                    <kbd>1</kbd>
                  </button>

                  <button
                    type="button"
                    className="rating-button rating-known"
                    onClick={() => void handleAnswer('known')}
                    disabled={Boolean(submittingRating)}
                  >
                    <span className="rating-icon">
                      {submittingRating === 'known' ? (
                        <LoaderCircle size={21} className="spin" />
                      ) : (
                        <Check size={21} />
                      )}
                    </span>
                    <span className="rating-copy">
                      <strong>认识</strong>
                      <small>能理解句意</small>
                    </span>
                    <kbd>2</kbd>
                  </button>
                </div>
                <p className="review-keyboard-hint">
                  选择后会显示整句意思和这个词的释义
                </p>
              </>
            ) : null}
          </section>
        ) : null}

        {stage === 'answered' && word && generation && answer ? (
          <section className="review-card review-answered-card">
            <div className="review-card-topline">
              <div className="target-chip-group">
                <span className="target-label">本次生词</span>
                <span className="target-chip">{word.term}</span>
              </div>
              <span
                className={`answer-schedule-chip ${answer.schedule.rating === 'known' ? 'known' : 'unknown'}`}
              >
                <CalendarClock size={14} />
                {formatSchedule(answer.schedule)}
              </span>
            </div>

            <SentenceView sentence={generation.sentence} term={word.term} compact />

            <div className="answer-reveal" aria-live="polite">
              <div className="answer-divider">
                <span>语境与词义</span>
              </div>

              <div className="translation-block">
                <span className="answer-label">全句意思</span>
                <p className="translation-text" lang="zh-CN">
                  {generation.sentenceZh}
                </p>
              </div>

              <div className="target-meaning-block">
                <div className="target-meaning-heading">
                  <span className="answer-label">在这个句子里</span>
                  {generation.partOfSpeech ? (
                    <span className="part-of-speech">{generation.partOfSpeech}</span>
                  ) : null}
                </div>
                <p className="target-term-inline">{word.term}</p>
                <p className="target-meaning-text">{generation.targetMeaning}</p>
              </div>

              <div className="answer-outcome-line">
                <span
                  className={`outcome-dot ${answer.schedule.rating === 'known' ? 'known' : 'unknown'}`}
                />
                {answer.schedule.rating === 'known'
                  ? '你标记了认识，复习间隔已相应拉长。'
                  : '你标记了不认识，这个词会在很短时间内再出现。'}
              </div>
            </div>

            <div className="answer-next-row">
              <span className="session-count">
                {sessionCount > 0 ? `本次已复习 ${sessionCount} 个词` : ''}
              </span>
              <button
                type="button"
                className="btn btn-primary btn-lg next-button"
                onClick={() => void loadNextCard()}
              >
                下一个
                <ArrowRight size={18} />
              </button>
            </div>
            <p className="review-keyboard-hint review-next-hint">
              按 Enter 继续下一张
            </p>
          </section>
        ) : null}
      </div>

      {stage === 'front' && !generationLoading && generation ? (
        <p className="review-page-footnote">
          <Sparkles size={14} />
          每次复习都会生成新的语境，让记忆不只依赖一种场景。
        </p>
      ) : null}
    </div>
  );
}
