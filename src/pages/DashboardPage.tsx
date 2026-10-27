import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Flame,
  KeyRound,
  Layers,
  Leaf,
  RotateCw,
  Sparkles,
  Sprout,
  WifiOff,
} from 'lucide-react';
import { api, ApiError } from '../api';
import type { Stats, Word } from '../types';
import {
  activityLevel,
  activityTotal,
  dayLabel,
  formatDue,
  formatToday,
  getGreeting,
  percentage,
  STATUS_META,
} from '../utils';

interface DashboardPageProps {
  stats: Stats | null;
  statsError: string | null;
  onRetryStats: () => void;
  dataVersion: number;
  apiConfigured: boolean | null;
  onStartReview: () => void;
  onAddWord: () => void;
  onOpenWords: () => void;
  onOpenSettings: () => void;
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-label="正在加载学习数据" aria-busy="true">
      <div className="skeleton skeleton-eyebrow" />
      <div className="skeleton skeleton-title" />
      <div className="skeleton-grid">
        {[0, 1, 2, 3].map((item) => (
          <div className="skeleton-card" key={item}>
            <div className="skeleton skeleton-line short" />
            <div className="skeleton skeleton-number" />
          </div>
        ))}
      </div>
      <div className="skeleton skeleton-hero" />
    </div>
  );
}

function ProgressOrb({ percent }: { percent: number }) {
  return (
    <div className="progress-orb-wrap">
      <div
        className="progress-orb"
        style={{ '--progress': `${percent * 3.6}deg` } as CSSProperties}
        role="img"
        aria-label={`今日复习进度 ${percent}%`}
      >
        <div className="progress-orb-inner">
          <span className="progress-number">{percent}%</span>
          <span className="progress-caption">今日进度</span>
        </div>
      </div>
      <span className="orb-leaf orb-leaf-one" aria-hidden="true">
        <Leaf size={20} />
      </span>
      <span className="orb-leaf orb-leaf-two" aria-hidden="true">
        <Leaf size={14} />
      </span>
      <span className="orb-dot" aria-hidden="true" />
    </div>
  );
}

export function DashboardPage({
  stats,
  statsError,
  onRetryStats,
  dataVersion,
  apiConfigured,
  onStartReview,
  onAddWord,
  onOpenWords,
  onOpenSettings,
}: DashboardPageProps) {
  const [recentWords, setRecentWords] = useState<Word[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRecentLoading(true);
    api
      .getWords({ sort: 'created', limit: 5 })
      .then((result) => {
        if (cancelled) return;
        setRecentWords(result.words);
        setRecentError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setRecentError(
          error instanceof ApiError ? error.message : '最近词条加载失败。',
        );
      })
      .finally(() => {
        if (!cancelled) setRecentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dataVersion]);

  if (!stats && !statsError) {
    return (
      <div className="page dashboard-page">
        <DashboardSkeleton />
      </div>
    );
  }

  const safeStats: Stats = stats || {
    totalWords: 0,
    dueCount: 0,
    dueNewCount: 0,
    dueReviewCount: 0,
    newCount: 0,
    learningCount: 0,
    reviewingCount: 0,
    masteredCount: 0,
    reviewedToday: 0,
    knownToday: 0,
    streak: 0,
    activity: [],
    nextDueAt: null,
    timeZone: 'Asia/Shanghai',
  };

  const totalPlan = safeStats.reviewedToday + safeStats.dueCount;
  const progress = percentage(safeStats.reviewedToday, totalPlan);
  const totalActivity = activityTotal(safeStats.activity);
  const isBrandNew = safeStats.totalWords === 0;
  const hasDue = safeStats.dueCount > 0;

  let heroTitle: ReactNode;
  let heroSubtitle: string;

  if (isBrandNew) {
    heroTitle = (
      <>
        从一个词开始，
        <br />
        慢慢长出自己的表达。
      </>
    );
    heroSubtitle =
      '先种下最近遇到的生词或短语。AI 会结合它的含义，为你写出难度适中的语境例句。';
  } else if (hasDue) {
    heroTitle = (
      <>
        今天还有 <span className="title-accent">{safeStats.dueCount}</span> 个词
        <br />
        等你再见一面。
      </>
    );
    heroSubtitle =
      '不急着背答案。先读一遍 AI 写的新句子，看看自己能不能在语境里认出它。';
  } else if (safeStats.reviewedToday > 0) {
    heroTitle = (
      <>
        今天的复习，
        <br />
        已经全部完成。
      </>
    );
    heroSubtitle =
      '词园暂时安静下来了。休息一下，或者再种下几个刚遇见的新词。';
  } else {
    heroTitle = (
      <>
        今天的词园很安静，
        <br />
        还没有到期的复习。
      </>
    );
    heroSubtitle =
      '记忆正在慢慢沉淀。你可以添加新词，或者等到下一轮复习自动出现。';
  }

  const primaryAction = hasDue
    ? { label: '开始今日复习', onClick: onStartReview, icon: Sparkles }
    : { label: '添加新词', onClick: onAddWord, icon: Sprout };

  const PrimaryIcon = primaryAction.icon;

  return (
    <div className="page dashboard-page">
      <header className="dashboard-topline">
        <p className="eyebrow">
          {getGreeting()} · {formatToday()}
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-sm desktop-add-button"
          onClick={onAddWord}
        >
          <span className="btn-icon-bubble">+</span>
          添加新词
        </button>
      </header>

      {apiConfigured === false ? (
        <aside className="setup-banner">
          <span className="setup-banner-icon" aria-hidden="true">
            <KeyRound size={19} />
          </span>
          <div>
            <strong>还差一把钥匙</strong>
            <p>配置 DeepSeek API Key 后，AI 才能为你写出每一次复习的例句。</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onOpenSettings}
          >
            去设置
            <ArrowRight size={14} />
          </button>
        </aside>
      ) : null}

      {statsError ? (
        <div className="status-banner status-banner-error" role="alert">
          <WifiOff size={18} />
          <div>
            <strong>暂时没有读到最新学习数据</strong>
            <p>{statsError}</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRetryStats}>
            <RotateCw size={15} />
            重试
          </button>
        </div>
      ) : null}

      <section className={`hero-panel ${hasDue ? 'hero-due' : ''}`}>
        <div className="hero-copy">
          <span className="hero-kicker">
            <Leaf size={15} />
            {hasDue ? '今天的记忆练习' : '词园今日概况'}
          </span>
          <h1 className="hero-title">{heroTitle}</h1>
          <p className="hero-subtitle">{heroSubtitle}</p>
          <div className="hero-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={primaryAction.onClick}>
              <PrimaryIcon size={18} />
              {primaryAction.label}
            </button>
            <button
              type="button"
              className="btn btn-text btn-lg"
              onClick={hasDue ? onAddWord : onOpenWords}
            >
              {hasDue ? '添加新词' : '查看词库'}
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="hero-meta">
            <span>
              <CalendarDays size={15} />
              {safeStats.dueCount > 0
                ? `${safeStats.dueNewCount} 个新词 · ${safeStats.dueReviewCount} 个待巩固`
                : safeStats.nextDueAt
                  ? `下次复习 ${formatDue(safeStats.nextDueAt)}`
                  : '还没有待安排的复习'}
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <ProgressOrb percent={progress} />
          <div className="hero-visual-caption">
            <span>
              <strong>{safeStats.reviewedToday}</strong> 今日已复习
            </span>
            <span className="caption-divider" aria-hidden="true" />
            <span>
              <strong>{safeStats.dueCount}</strong> 待复习
            </span>
          </div>
        </div>
      </section>

      {isBrandNew && recentWords.length === 0 && !recentLoading ? (
        <section className="onboarding-strip">
          <div className="onboarding-step">
            <span className="step-number">01</span>
            <div>
              <strong>种下生词</strong>
              <p>遇到不认识的词或短语，随手收进词库。</p>
            </div>
          </div>
          <div className="onboarding-step">
            <span className="step-number">02</span>
            <div>
              <strong>AI 写句子</strong>
              <p>每次复习，都生成只包含这一个生词的新语境。</p>
            </div>
          </div>
          <div className="onboarding-step">
            <span className="step-number">03</span>
            <div>
              <strong>按节奏重逢</strong>
              <p>认识就拉长间隔，不认识就很快再见。</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="stat-grid" aria-label="学习数据概览">
        <article className="stat-card">
          <div className="stat-topline">
            <span className="stat-icon stat-icon-green">
              <Layers size={18} />
            </span>
            <span className="stat-label">待复习</span>
          </div>
          <strong className="stat-value">{safeStats.dueCount}</strong>
          <p className="stat-foot">
            {safeStats.dueCount > 0
              ? `新词 ${safeStats.dueNewCount} · 旧词 ${safeStats.dueReviewCount}`
              : '当前队列已清空'}
          </p>
        </article>

        <article className="stat-card">
          <div className="stat-topline">
            <span className="stat-icon stat-icon-clay">
              <CheckCircle2 size={18} />
            </span>
            <span className="stat-label">今日已复习</span>
          </div>
          <strong className="stat-value">{safeStats.reviewedToday}</strong>
          <p className="stat-foot">
            {safeStats.reviewedToday > 0
              ? `${safeStats.knownToday} 次认识 · ${Math.max(0, safeStats.reviewedToday - safeStats.knownToday)} 次不认识`
              : '还没开始今天的复习'}
          </p>
        </article>

        <article className="stat-card">
          <div className="stat-topline">
            <span className="stat-icon stat-icon-gold">
              <Flame size={18} />
            </span>
            <span className="stat-label">连续复习</span>
          </div>
          <strong className="stat-value">
            {safeStats.streak}
            <span className="stat-unit">天</span>
          </strong>
          <p className="stat-foot">
            {safeStats.streak > 0 ? '让记忆保持一点温度' : '今天开始也不迟'}
          </p>
        </article>

        <article className="stat-card">
          <div className="stat-topline">
            <span className="stat-icon stat-icon-blue">
              <Sprout size={18} />
            </span>
            <span className="stat-label">已掌握</span>
          </div>
          <strong className="stat-value">{safeStats.masteredCount}</strong>
          <p className="stat-foot">
            共 {safeStats.totalWords} 个词条
          </p>
        </article>
      </section>

      <div className="home-grid">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">RECENT SEEDS</p>
              <h2>最近种下的词</h2>
            </div>
            <button type="button" className="btn btn-text btn-sm" onClick={onOpenWords}>
              全部词库
              <ArrowUpRight size={15} />
            </button>
          </div>

          {recentLoading ? (
            <div className="recent-list" aria-busy="true">
              {[0, 1, 2].map((item) => (
                <div className="recent-row" key={item}>
                  <div className="skeleton skeleton-avatar" />
                  <div className="recent-row-main">
                    <div className="skeleton skeleton-line" />
                    <div className="skeleton skeleton-line tiny" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentError ? (
            <div className="panel-empty">
              <WifiOff size={22} />
              <p>{recentError}</p>
            </div>
          ) : recentWords.length === 0 ? (
            <div className="panel-empty panel-empty-action">
              <span className="empty-seed" aria-hidden="true">
                <Sprout size={28} />
              </span>
              <h3>词库还是空的</h3>
              <p>从最近读书、看电影时遇到的那个词开始吧。</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onAddWord}>
                添加第一个词
              </button>
            </div>
          ) : (
            <div className="recent-list">
              {recentWords.map((word) => {
                const meta = STATUS_META[word.status];
                return (
                  <div className="recent-row" key={word.id}>
                    <span className="word-avatar" aria-hidden="true">
                      {word.term.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="recent-row-main">
                      <div className="recent-term-line">
                        <strong>{word.term}</strong>
                        <span className={`kind-pill kind-${word.kind}`}>
                          {word.kind === 'phrase' ? '短语' : '单词'}
                        </span>
                      </div>
                      <p className={word.meaning ? '' : 'muted-copy'}>
                        {word.meaning || 'AI 将在第一次复习时补全释义'}
                      </p>
                    </div>
                    <div className="recent-row-side">
                      <span className={`status-pill ${meta.className}`}>
                        {meta.label}
                      </span>
                      <small>{word.isDue ? '现在可复习' : formatDue(word.dueAt)}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="home-side">
          <section className="panel rhythm-panel">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">MEMORY RHYTHM</p>
                <h2>复习节奏</h2>
              </div>
              <span className="streak-chip">
                <Flame size={14} />
                {safeStats.streak} 天
              </span>
            </div>
            <p className="rhythm-summary">
              过去五周，你和词见了 <strong>{totalActivity}</strong> 次。
            </p>
            <div
              className="heatmap"
              aria-label={`过去五周共复习 ${totalActivity} 次`}
            >
              {safeStats.activity.map((day) => (
                <span
                  key={day.date}
                  className={`heat-cell level-${activityLevel(day.count)}`}
                  title={`${dayLabel(day.date)} · ${day.count ? `复习 ${day.count} 次` : '没有复习'}`}
                />
              ))}
            </div>
            <div className="heatmap-legend">
              <span>少</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <span
                  key={level}
                  className={`heat-cell level-${level}`}
                  aria-hidden="true"
                />
              ))}
              <span>多</span>
            </div>
          </section>

          <section className="panel curve-panel">
            <div className="curve-ornament" aria-hidden="true">
              <Leaf size={20} />
            </div>
            <p className="eyebrow">SPACED REPETITION</p>
            <h2>让记忆，在快忘记时重逢。</h2>
            <p className="curve-copy">
              采用 SM-2 记忆曲线：认识，就把下次间隔拉长；不认识，10
              分钟后再来一次。
            </p>
            <div className="curve-steps" aria-hidden="true">
              <span className="curve-step active">1 天</span>
              <span className="curve-line" />
              <span className="curve-step">3 天</span>
              <span className="curve-line" />
              <span className="curve-step">8 天</span>
              <span className="curve-line" />
              <span className="curve-step">更久</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
