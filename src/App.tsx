import { useCallback, useEffect, useState } from 'react';
import {
  BookOpenText,
  Brain,
  LayoutDashboard,
  Plus,
  Settings as SettingsIcon,
} from 'lucide-react';
import { api, ApiError } from './api';
import { LogoMark } from './components/LogoMark';
import { Toast } from './components/Toast';
import type { ToastState, ToastTone } from './components/Toast';
import { WordDialog } from './components/WordDialog';
import { DashboardPage } from './pages/DashboardPage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { WordsPage } from './pages/WordsPage';
import type { Page, Stats, Word } from './types';

const PAGE_IDS: Page[] = ['home', 'words', 'review', 'settings'];

const NAV_ITEMS = [
  { page: 'home' as const, label: '今日', icon: LayoutDashboard },
  { page: 'words' as const, label: '词库', icon: BookOpenText },
  { page: 'review' as const, label: '复习', icon: Brain },
  { page: 'settings' as const, label: '设置', icon: SettingsIcon },
];

function readPageFromHash(): Page {
  const value = window.location.hash.replace(/^#\/?/, '');
  return PAGE_IDS.includes(value as Page) ? (value as Page) : 'home';
}

function dueLabel(count: number): string {
  return count > 99 ? '99+' : String(count);
}

export default function App() {
  const [page, setPage] = useState<Page>(readPageFromHash);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const refreshStats = useCallback(async () => {
    try {
      const nextStats = await api.getStats();
      setStats(nextStats);
      setStatsError(null);
    } catch (error) {
      setStatsError(
        error instanceof ApiError ? error.message : '暂时无法读取学习数据。',
      );
    }
  }, []);

  const refreshApiStatus = useCallback(async () => {
    try {
      const result = await api.getSettings();
      setApiConfigured(result.settings.apiKeyConfigured);
    } catch {
      // The setup hint is best-effort; feature errors still explain themselves.
    }
  }, []);

  const navigate = useCallback((nextPage: Page) => {
    const nextHash = `#/${nextPage}`;
    if (window.location.hash === nextHash) {
      window.scrollTo(0, 0);
      return;
    }
    window.location.hash = `/${nextPage}`;
  }, []);

  useEffect(() => {
    const handleRouteChange = () => {
      setPage(readPageFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', handleRouteChange);
    return () => window.removeEventListener('hashchange', handleRouteChange);
  }, []);

  useEffect(() => {
    void refreshStats();
    void refreshApiStatus();
  }, [refreshApiStatus, refreshStats, page]);

  const handleDataChanged = useCallback(() => {
    setDataVersion((value) => value + 1);
    void refreshStats();
  }, [refreshStats]);

  const handleAddSaved = useCallback(
    (word: Word) => {
      showToast(`“${word.term}”已经种进词园，等待第一次复习。`);
      handleDataChanged();
    },
    [handleDataChanged, showToast],
  );

  const currentNav = NAV_ITEMS.find((item) => item.page === page);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>

      <aside className="sidebar">
        <a className="brand" href="#/home" aria-label="词芽 PhraseGrow 首页">
          <LogoMark />
          <span className="brand-copy">
            <strong>词芽</strong>
            <small>PhraseGrow</small>
          </span>
        </a>

        <div className="sidebar-label">你的词汇花园</div>

        <nav className="sidebar-nav" aria-label="主导航">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.page === page;
            return (
              <a
                key={item.page}
                href={`#/${item.page}`}
                className={`nav-link ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="nav-icon">
                  <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                </span>
                <span>{item.label}</span>
                {item.page === 'review' && stats?.dueCount ? (
                  <span className="nav-badge">{dueLabel(stats.dueCount)}</span>
                ) : null}
              </a>
            );
          })}
        </nav>

        <button
          type="button"
          className="btn btn-primary sidebar-add"
          onClick={() => setAddOpen(true)}
        >
          <Plus size={18} />
          添加新词
        </button>

        <div className="sidebar-note">
          <span className="sidebar-note-icon" aria-hidden="true">
            <Brain size={17} />
          </span>
          <div>
            <strong>记住，而不只是见过</strong>
            <p>AI 例句 + SM-2 记忆曲线，让每次重逢都恰到好处。</p>
          </div>
        </div>

        <div className="sidebar-footer">
          <span>PhraseGrow · 词芽</span>
          <span>在语境里慢慢生长</span>
        </div>
      </aside>

      <div className="main-column">
        <header className="mobile-topbar">
          <a className="brand brand-mobile" href="#/home" aria-label="词芽首页">
            <LogoMark />
            <span className="brand-copy">
              <strong>词芽</strong>
              <small>PhraseGrow</small>
            </span>
          </a>
          <div className="mobile-topbar-actions">
            <span className="mobile-page-label">{currentNav?.label}</span>
            <button
              type="button"
              className="icon-button icon-button-solid"
              onClick={() => setAddOpen(true)}
              aria-label="添加新词"
            >
              <Plus size={20} />
            </button>
          </div>
        </header>

        <main id="main-content" className="main-content">
          {page === 'home' ? (
            <DashboardPage
              stats={stats}
              statsError={statsError}
              onRetryStats={refreshStats}
              dataVersion={dataVersion}
              apiConfigured={apiConfigured}
              onStartReview={() => navigate('review')}
              onAddWord={() => setAddOpen(true)}
              onOpenWords={() => navigate('words')}
              onOpenSettings={() => navigate('settings')}
            />
          ) : null}

          {page === 'words' ? (
            <WordsPage
              dataVersion={dataVersion}
              stats={stats}
              onAddWord={() => setAddOpen(true)}
              onDataChanged={handleDataChanged}
              onNotify={showToast}
            />
          ) : null}

          {page === 'review' ? (
            <ReviewPage
              stats={stats}
              onStatsChanged={refreshStats}
              onAddWord={() => setAddOpen(true)}
              apiConfigured={apiConfigured}
              onOpenSettings={() => navigate('settings')}
              onOpenWords={() => navigate('words')}
              onNotify={showToast}
            />
          ) : null}

          {page === 'settings' ? (
            <SettingsPage onNotify={showToast} />
          ) : null}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="移动端导航">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.page === page;
          return (
            <a
              key={item.page}
              href={`#/${item.page}`}
              className={`mobile-nav-link ${active ? 'active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="mobile-nav-icon">
                <Icon size={21} strokeWidth={active ? 2.3 : 1.8} />
                {item.page === 'review' && stats?.dueCount ? (
                  <span className="mobile-nav-badge">
                    {dueLabel(stats.dueCount)}
                  </span>
                ) : null}
              </span>
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      <WordDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={handleAddSaved}
      />

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
