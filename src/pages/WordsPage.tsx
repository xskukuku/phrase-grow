import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  CalendarClock,
  Pencil,
  Plus,
  RotateCw,
  Search,
  SearchX,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import { api, ApiError } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { ToastTone } from '../components/Toast';
import { WordDialog } from '../components/WordDialog';
import type { Stats, Word } from '../types';
import { formatDue, STATUS_META } from '../utils';

type FilterValue = 'all' | 'due' | 'new' | 'learning' | 'reviewing' | 'mastered';

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'due', label: '待复习' },
  { value: 'new', label: '新词' },
  { value: 'learning', label: '学习中' },
  { value: 'reviewing', label: '巩固中' },
  { value: 'mastered', label: '已掌握' },
];

interface WordsPageProps {
  dataVersion: number;
  stats: Stats | null;
  onAddWord: () => void;
  onDataChanged: () => void;
  onNotify: (message: string, tone?: ToastTone) => void;
}

export function WordsPage({
  dataVersion,
  stats,
  onAddWord,
  onDataChanged,
  onNotify,
}: WordsPageProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  const [words, setWords] = useState<Word[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editWord, setEditWord] = useState<Word | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Word | null>(null);
  const [deleting, setDeleting] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    let cancelled = false;

    const timer = window.setTimeout(
      () => {
        setLoading(true);
        api
          .getWords({
            search: search.trim(),
            filter,
            limit: 300,
          })
          .then((result) => {
            if (cancelled || requestIdRef.current !== requestId) return;
            setWords(result.words);
            setTotal(result.total);
            setError(null);
          })
          .catch((caught) => {
            if (cancelled || requestIdRef.current !== requestId) return;
            setError(
              caught instanceof ApiError
                ? caught.message
                : '词库加载失败，请稍后重试。',
            );
          })
          .finally(() => {
            if (!cancelled && requestIdRef.current === requestId) {
              setLoading(false);
            }
          });
      },
      search ? 260 : 0,
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, filter, dataVersion]);

  const handleEditSaved = (word: Word) => {
    onNotify(`“${word.term}”的修改已保存。`);
    onDataChanged();
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api.deleteWord(deleteTarget.id);
      onNotify(`“${deleteTarget.term}”已从词库移除。`, 'info');
      setDeleteTarget(null);
      onDataChanged();
    } catch (caught) {
      onNotify(
        caught instanceof ApiError ? caught.message : '删除失败，请稍后再试。',
        'error',
      );
    } finally {
      setDeleting(false);
    }
  };

  const isFiltered = Boolean(search.trim()) || filter !== 'all';
  const showInitialSkeleton = loading && words.length === 0 && !error;
  const totalWords = stats?.totalWords ?? total;
  const dueWords = stats?.dueCount ?? 0;

  return (
    <div className="page words-page">
      <header className="page-intro words-intro">
        <div>
          <p className="eyebrow">YOUR WORD GARDEN</p>
          <h1 className="page-title">我的词库</h1>
          <p className="page-lede">
            把不熟悉的词和短语收进来，剩下的交给 AI 语境和记忆曲线。
          </p>
        </div>
        <div className="page-intro-actions">
          <div className="header-metrics">
            <span>
              <strong>{totalWords}</strong> 个词条
            </span>
            <span className="metric-dot" aria-hidden="true" />
            <span>
              <strong className={dueWords > 0 ? 'text-accent' : ''}>{dueWords}</strong>{' '}
              个待复习
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onAddWord}>
            <Plus size={17} />
            添加新词
          </button>
        </div>
      </header>

      <section className="wordbook-toolbar">
        <div className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索单词、短语或释义"
            aria-label="搜索词库"
          />
          {search ? (
            <button
              type="button"
              className="clear-search"
              onClick={() => setSearch('')}
              aria-label="清空搜索"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>
        <div className="filter-chips" role="group" aria-label="按学习状态筛选">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`filter-chip ${filter === item.value ? 'active' : ''}`}
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {error ? (
        <div className="status-banner status-banner-error" role="alert">
          <WifiOff size={18} />
          <div>
            <strong>词库没能加载出来</strong>
            <p>{error}</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setError(null);
              onDataChanged();
            }}
          >
            <RotateCw size={15} />
            重试
          </button>
        </div>
      ) : null}

      <section
        className={`wordbook-panel ${loading && words.length > 0 ? 'is-refreshing' : ''}`}
        aria-busy={loading}
      >
        <div className="wordbook-bar">
          <span>
            {loading && words.length === 0
              ? '正在整理词园…'
              : isFiltered
                ? `找到 ${total} 个词条`
                : `全部 ${total} 个词条`}
          </span>
          <span className="wordbook-bar-hint">
            {loading ? '正在整理词园…' : '按下次复习时间排序'}
          </span>
        </div>

        <div className="word-table-head" aria-hidden="true">
          <span>词条</span>
          <span>释义</span>
          <span>状态</span>
          <span>下次复习</span>
          <span className="align-right">操作</span>
        </div>

        {showInitialSkeleton ? (
          <div className="word-list" aria-label="正在加载词库">
            {[0, 1, 2, 3].map((item) => (
              <div className="word-row word-row-skeleton" key={item}>
                <div className="word-term-cell">
                  <div className="skeleton skeleton-avatar" />
                  <div className="skeleton-stack">
                    <div className="skeleton skeleton-line" />
                    <div className="skeleton skeleton-line tiny" />
                  </div>
                </div>
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-pill" />
                <div className="skeleton skeleton-line tiny" />
                <div className="skeleton skeleton-pill" />
              </div>
            ))}
          </div>
        ) : words.length === 0 ? (
          <div className="wordbook-empty">
            {search || filter !== 'all' ? (
              <>
                <span className="empty-icon">
                  <SearchX size={30} />
                </span>
                <h3>这里还没有符合条件的词</h3>
                <p>换一个关键词，或者查看其他学习状态。</p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSearch('');
                    setFilter('all');
                  }}
                >
                  清除筛选
                </button>
              </>
            ) : (
              <>
                <span className="empty-icon empty-icon-green">
                  <BookOpen size={30} />
                </span>
                <h3>词库还是一张白纸</h3>
                <p>种下第一个生词，AI 会为你准备它的第一句语境。</p>
                <button type="button" className="btn btn-primary" onClick={onAddWord}>
                  <Plus size={17} />
                  添加第一个词
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="word-list">
              {words.map((word) => {
                const meta = STATUS_META[word.status];
                return (
                  <article className="word-row" key={word.id}>
                    <div className="word-term-cell">
                      <span className="word-avatar word-avatar-soft" aria-hidden="true">
                        {word.term.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="word-term-main">
                        <div className="word-term-line">
                          <h2>{word.term}</h2>
                          <span className={`kind-pill kind-${word.kind}`}>
                            {word.kind === 'phrase' ? '短语' : '单词'}
                          </span>
                        </div>
                        <span className="word-exposure">
                          {word.reviewCount > 0
                            ? `已复习 ${word.reviewCount} 次${word.lapses > 0 ? ` · 遗忘 ${word.lapses} 次` : ''}`
                            : '还没有复习过'}
                        </span>
                      </div>
                    </div>

                    <div className="word-meaning-cell">
                      {word.meaning ? (
                        <p>{word.meaning}</p>
                      ) : (
                        <p className="muted-copy">AI 将在第一次复习时补全释义</p>
                      )}
                    </div>

                    <div className="word-status-cell">
                      <span className={`status-pill ${meta.className}`}>
                        {meta.label}
                      </span>
                    </div>

                    <div className="word-due-cell">
                      {word.isDue ? (
                        <span className="due-now">现在可复习</span>
                      ) : (
                        <span className="due-time">
                          <CalendarClock size={14} />
                          {formatDue(word.dueAt)}
                        </span>
                      )}
                    </div>

                    <div className="word-actions">
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => setEditWord(word)}
                        aria-label={`编辑 ${word.term}`}
                        title="编辑词条"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button icon-button-danger"
                        onClick={() => setDeleteTarget(word)}
                        aria-label={`删除 ${word.term}`}
                        title="删除词条"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="word-mobile-meta">
                      <span className={`status-pill ${meta.className}`}>
                        {meta.label}
                      </span>
                      <span className="word-mobile-due">
                        {word.isDue ? '现在可复习' : formatDue(word.dueAt)}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
            {total > words.length ? (
              <p className="list-footnote">
                当前显示前 {words.length} 个词条，使用搜索可以更快找到目标。
              </p>
            ) : null}
          </>
        )}
      </section>

      <WordDialog
        open={Boolean(editWord)}
        word={editWord}
        onClose={() => setEditWord(null)}
        onSaved={handleEditSaved}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`移除“${deleteTarget?.term || ''}”？`}
        description="这个操作会同时删除它的复习历史和记忆进度，之后无法恢复。"
        confirmLabel="确认删除"
        busy={deleting}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
