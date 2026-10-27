import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { api, ApiError } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { ToastTone } from '../components/Toast';
import type { PublicSettings } from '../types';

interface SettingsPageProps {
  onNotify: (message: string, tone?: ToastTone) => void;
}

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

export function SettingsPage({ onNotify }: SettingsPageProps) {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState('deepseek-chat');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testState, setTestState] = useState<TestState>({ status: 'idle' });
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await api.getSettings();
      setSettings(result.settings);
      setModel(result.settings.model);
    } catch (error) {
      setLoadError(
        error instanceof ApiError ? error.message : '设置没能加载出来。',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const keyManagedByEnv = settings?.apiKeySource === 'environment';
  const modelManagedByEnv = settings?.modelSource === 'environment';
  const hasUnsavedKey = Boolean(apiKey.trim());

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings || saving) return;

    setSaveError(null);
    setTestState({ status: 'idle' });

    if (!keyManagedByEnv && !settings.apiKeyConfigured && !apiKey.trim()) {
      setSaveError('请先填写 DeepSeek API Key。');
      return;
    }
    if (!/^[a-zA-Z0-9._:-]{1,80}$/.test(model.trim())) {
      setSaveError('模型名称格式不正确，请检查后重试。');
      return;
    }

    setSaving(true);
    try {
      const result = await api.saveSettings({
        apiKey: !keyManagedByEnv && apiKey.trim() ? apiKey.trim() : undefined,
        model: modelManagedByEnv ? undefined : model.trim(),
      });
      setSettings(result.settings);
      setModel(result.settings.model);
      setApiKey('');
      setShowKey(false);
      onNotify(
        hasUnsavedKey ? 'API Key 和模型设置已安全保存。' : '设置已保存。',
      );
    } catch (error) {
      setSaveError(
        error instanceof ApiError ? error.message : '保存失败，请稍后重试。',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!settings || testState.status === 'testing') return;
    setTestState({ status: 'testing' });
    try {
      const result = await api.testSettings();
      setTestState({
        status: 'success',
        message: `连接成功 · ${result.latencyMs} ms · ${result.model}`,
      });
    } catch (error) {
      setTestState({
        status: 'error',
        message:
          error instanceof ApiError ? error.message : '连接测试失败。',
      });
    }
  };

  const handleClearKey = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      const result = await api.saveSettings({ clearApiKey: true });
      setSettings(result.settings);
      setApiKey('');
      setClearOpen(false);
      setTestState({ status: 'idle' });
      onNotify('已从数据库移除保存的 API Key。', 'info');
    } catch (error) {
      onNotify(
        error instanceof ApiError ? error.message : '移除失败，请稍后重试。',
        'error',
      );
    } finally {
      setClearing(false);
    }
  };

  if (loading && !settings) {
    return (
      <div className="page settings-page">
        <div className="settings-skeleton" aria-busy="true">
          <div className="skeleton skeleton-eyebrow" />
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-hero" />
          <div className="skeleton skeleton-hero" />
        </div>
      </div>
    );
  }

  return (
    <div className="page settings-page">
      <header className="page-intro settings-intro">
        <p className="eyebrow">GARDEN SETTINGS</p>
        <h1 className="page-title">让句子长出来。</h1>
        <p className="page-lede">
          配置 DeepSeek API，让 AI 在每次复习时为你的生词写出新的语境例句。
        </p>
      </header>

      {loadError ? (
        <div className="status-banner status-banner-error" role="alert">
          <WifiOff size={18} />
          <div>
            <strong>设置没能加载出来</strong>
            <p>{loadError}</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void loadSettings()}
          >
            <RotateCw size={15} />
            重试
          </button>
        </div>
      ) : null}

      {settings ? (
        <div className="settings-layout">
          <div className="settings-main">
            <section className="settings-card">
              <div className="settings-card-heading">
                <span className="settings-icon">
                  <KeyRound size={21} />
                </span>
                <div>
                  <h2>DeepSeek 接入</h2>
                  <p>用于生成每次复习的中等难度英文例句和中文释义。</p>
                </div>
              </div>

              <div
                className={`config-status ${settings.apiKeyConfigured ? 'is-configured' : 'is-missing'}`}
              >
                <span className="config-status-icon">
                  {settings.apiKeyConfigured ? (
                    <ShieldCheck size={21} />
                  ) : (
                    <AlertCircle size={21} />
                  )}
                </span>
                <div>
                  <strong>
                    {settings.apiKeyConfigured
                      ? settings.apiKeySource === 'environment'
                        ? 'API Key 已由服务器环境变量提供'
                        : 'API Key 已安全保存'
                      : '还没有配置 API Key'}
                  </strong>
                  <p>
                    {settings.apiKeyConfigured
                      ? keyManagedByEnv
                        ? '当前使用 DEEPSEEK_API_KEY 环境变量。网页中的输入框不会覆盖它。'
                        : `密钥尾号 ···· ${settings.apiKeyHint || '••••'}，保存后不会在浏览器中显示。`
                      : '保存一个有效的 Key 之后，就可以开始生成例句了。'}
                  </p>
                </div>
                {settings.apiKeyConfigured ? (
                  <span className="config-dot" aria-label="已配置" />
                ) : null}
              </div>

              {settings.savedKeyInvalid ? (
                <div className="inline-alert inline-alert-error" role="alert">
                  <AlertCircle size={17} />
                  <span>
                    数据库中保存的 Key 无法解密，可能因为服务器密钥已改变。请重新保存一次。
                  </span>
                </div>
              ) : null}

              <form className="settings-form" onSubmit={handleSave}>
                <div className="field">
                  <div className="field-label-row">
                    <label htmlFor="settings-api-key">DeepSeek API Key</label>
                    <a
                      className="inline-link"
                      href="https://platform.deepseek.com/api_keys"
                      target="_blank"
                      rel="noreferrer"
                    >
                      获取 API Key
                      <ExternalLink size={13} />
                    </a>
                  </div>
                  <div className="input-with-icon input-with-action">
                    <LockKeyhole size={18} aria-hidden="true" />
                    <input
                      id="settings-api-key"
                      type={showKey ? 'text' : 'password'}
                      value={keyManagedByEnv ? '' : apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder={
                        keyManagedByEnv
                          ? '由服务器环境变量管理'
                          : settings.apiKeyConfigured
                            ? '输入新的 Key 以更换，留空则不修改'
                            : 'sk-...'
                      }
                      autoComplete="off"
                      spellCheck={false}
                      disabled={keyManagedByEnv || saving}
                      aria-describedby="api-key-note"
                    />
                    {!keyManagedByEnv ? (
                      <button
                        type="button"
                        className="input-action"
                        onClick={() => setShowKey((value) => !value)}
                        aria-label={showKey ? '隐藏 API Key' : '显示 API Key'}
                      >
                        {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    ) : null}
                  </div>
                  <p className="field-hint" id="api-key-note">
                    只保存在服务器端，使用 AES-256-GCM 加密后写入数据库，浏览器拿不到明文。
                  </p>
                </div>

                <div className="field">
                  <label htmlFor="settings-model">模型</label>
                  <input
                    id="settings-model"
                    type="text"
                    className="plain-input"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    list="deepseek-model-options"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={modelManagedByEnv || saving}
                  />
                  <datalist id="deepseek-model-options">
                    <option value="deepseek-chat" />
                  </datalist>
                  <p className="field-hint">
                    推荐 <code>deepseek-chat</code>；该模型支持稳定的 JSON
                    结构化输出。服务地址：{settings.baseUrlHost}
                  </p>
                </div>

                {saveError ? (
                  <div className="inline-alert inline-alert-error" role="alert">
                    <AlertCircle size={17} />
                    <span>{saveError}</span>
                  </div>
                ) : null}

                {testState.status === 'success' ? (
                  <div className="inline-alert inline-alert-success" role="status">
                    <CheckCircle2 size={17} />
                    <span>{testState.message}</span>
                  </div>
                ) : null}
                {testState.status === 'error' ? (
                  <div className="inline-alert inline-alert-error" role="alert">
                    <AlertCircle size={17} />
                    <span>{testState.message}</span>
                  </div>
                ) : null}

                <div className="settings-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void handleTest()}
                    disabled={
                      !settings.apiKeyConfigured ||
                      testState.status === 'testing' ||
                      saving ||
                      hasUnsavedKey
                    }
                    title={
                      hasUnsavedKey ? '请先保存新的 API Key 再测试' : undefined
                    }
                  >
                    {testState.status === 'testing' ? (
                      <LoaderCircle size={17} className="spin" />
                    ) : (
                      <Wifi size={17} />
                    )}
                    {testState.status === 'testing' ? '连接中…' : '测试连接'}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <span className="button-spinner" aria-hidden="true" />
                        保存中…
                      </>
                    ) : (
                      '保存设置'
                    )}
                  </button>
                </div>
                {hasUnsavedKey ? (
                  <p className="settings-form-note">
                    输入了新的 Key，请先保存后再测试连接。
                  </p>
                ) : null}
              </form>

              {settings.apiKeySource === 'saved' ? (
                <div className="settings-danger-row">
                  <span>不再使用这个 Key？</span>
                  <button
                    type="button"
                    className="btn btn-text btn-sm btn-text-danger"
                    onClick={() => setClearOpen(true)}
                  >
                    <Trash2 size={14} />
                    移除已保存的 Key
                  </button>
                </div>
              ) : null}
            </section>

            <section className="settings-card">
              <div className="settings-card-heading">
                <span className="settings-icon settings-icon-clay">
                  <Sparkles size={21} />
                </span>
                <div>
                  <h2>AI 例句规则</h2>
                  <p>我们怎样控制句子的难度和生词数量。</p>
                </div>
              </div>
              <div className="rule-grid">
                <div className="rule-item">
                  <strong>中等难度</strong>
                  <p>以 A2–B1 常用词汇为主，约 12–24 个英文单词，最多一个从句。</p>
                </div>
                <div className="rule-item">
                  <strong>只有一个生词</strong>
                  <p>目标词是整句中唯一的进阶词汇，其他词保持日常、好理解。</p>
                </div>
                <div className="rule-item">
                  <strong>语境可推断</strong>
                  <p>句子会提供足够线索，让你从上下文猜出目标词的含义。</p>
                </div>
                <div className="rule-item">
                  <strong>每次都不一样</strong>
                  <p>每次复习都会重新生成例句，避免只背某一句固定搭配。</p>
                </div>
              </div>
            </section>
          </div>

          <aside className="settings-aside">
            <section className="settings-side-card memory-card">
              <div className="settings-side-icon">
                <Sparkles size={18} />
              </div>
              <h2>复习是怎样安排的</h2>
              <div className="algo-timeline">
                <div className="algo-row">
                  <span className="algo-marker algo-known" />
                  <div>
                    <strong>点击“认识”</strong>
                    <p>间隔从 1 天 → 3 天 → 约 8 天逐步拉长。</p>
                  </div>
                </div>
                <div className="algo-row">
                  <span className="algo-marker algo-unknown" />
                  <div>
                    <strong>点击“不认识”</strong>
                    <p>约 10 分钟后再次出现，难易度与重复次数重置。</p>
                  </div>
                </div>
                <div className="algo-row">
                  <span className="algo-marker algo-mastered" />
                  <div>
                    <strong>间隔超过 21 天</strong>
                    <p>词条会被标记为已掌握，但仍会按更长的间隔复习。</p>
                  </div>
                </div>
              </div>
              <p className="algo-footnote">
                基于 SM-2 记忆曲线；每一次选择都会更新每个词自己的复习间隔。
              </p>
            </section>

            <section className="settings-side-card security-card">
              <div className="settings-side-icon settings-side-icon-clay">
                <LockKeyhole size={18} />
              </div>
              <h2>关于数据与安全</h2>
              <p>
                词库、复习记录和设置都保存在你的 Neon PostgreSQL
                数据库中。API Key 在服务端加密，页面只显示密钥尾号。
              </p>
              <p className="security-note">
                如果部署到新的服务器，请固定环境变量 <code>APP_SECRET</code>
                ，否则此前保存的 Key 将无法解密。
              </p>
            </section>
          </aside>
        </div>
      ) : null}

      <ConfirmDialog
        open={clearOpen}
        title="移除已保存的 API Key？"
        description="移除后，在重新填写有效的 Key 之前，将无法生成新的 AI 例句。词库和复习记录不会受影响。"
        confirmLabel="确认移除"
        busy={clearing}
        onClose={() => {
          if (!clearing) setClearOpen(false);
        }}
        onConfirm={() => void handleClearKey()}
      />
    </div>
  );
}
