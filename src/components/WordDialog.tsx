import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertCircle, BookOpen, Sparkles } from 'lucide-react';
import { api, ApiError } from '../api';
import type { Word, WordKind } from '../types';
import { Modal } from './Modal';

interface WordDialogProps {
  open: boolean;
  word?: Word | null;
  onClose: () => void;
  onSaved: (word: Word, mode: 'create' | 'edit') => void;
}

export function WordDialog({
  open,
  word = null,
  onClose,
  onSaved,
}: WordDialogProps) {
  const formId = useId();
  const [term, setTerm] = useState('');
  const [meaning, setMeaning] = useState('');
  const [kind, setKind] = useState<WordKind>('word');
  const [kindTouched, setKindTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTerm(word?.term || '');
    setMeaning(word?.meaning || '');
    setKind(word?.kind || 'word');
    setKindTouched(Boolean(word));
    setSaving(false);
    setError(null);
  }, [open, word]);

  const closeIfIdle = () => {
    if (!saving) onClose();
  };

  const handleTermChange = (value: string) => {
    setTerm(value);
    if (!kindTouched) {
      setKind(/\s/.test(value.trim()) ? 'phrase' : 'word');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const cleanedTerm = term.trim();
    if (!cleanedTerm) {
      setError('先写下想记住的单词或短语吧。');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        term: cleanedTerm,
        meaning: meaning.trim() || null,
        kind,
      };
      const result = word
        ? await api.updateWord(word.id, payload)
        : await api.createWord(payload);
      onSaved(result.word, word ? 'edit' : 'create');
      onClose();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : '保存失败，请稍后再试。',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={closeIfIdle}
      eyebrow={word ? 'EDIT WORD' : 'NEW WORD'}
      title={word ? '编辑这个词' : '种下一个新词'}
      description={
        word
          ? '修改词条内容不会重置已有的记忆进度。'
          : '它会进入你的复习队列，AI 会为它写出语境例句。'
      }
    >
      <form id={formId} className="dialog-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor={`${formId}-term`}>单词或短语</label>
          <div className="input-with-icon">
            <BookOpen size={18} aria-hidden="true" />
            <input
              id={`${formId}-term`}
              data-autofocus
              type="text"
              value={term}
              onChange={(event) => handleTermChange(event.target.value)}
              placeholder="例如：serendipity / break the ice"
              maxLength={160}
              autoComplete="off"
              spellCheck={false}
              required
            />
          </div>
          <div className="field-inline-row">
            <div className="kind-toggle" role="group" aria-label="词条类型">
              <button
                type="button"
                className={kind === 'word' ? 'active' : ''}
                aria-pressed={kind === 'word'}
                onClick={() => {
                  setKind('word');
                  setKindTouched(true);
                }}
              >
                单词
              </button>
              <button
                type="button"
                className={kind === 'phrase' ? 'active' : ''}
                aria-pressed={kind === 'phrase'}
                onClick={() => {
                  setKind('phrase');
                  setKindTouched(true);
                }}
              >
                短语
              </button>
            </div>
            <span className="field-hint">最多 160 个字符</span>
          </div>
        </div>

        <div className="field">
          <label htmlFor={`${formId}-meaning`}>
            你理解的中文释义 <span className="label-optional">可选</span>
          </label>
          <textarea
            id={`${formId}-meaning`}
            value={meaning}
            onChange={(event) => setMeaning(event.target.value)}
            placeholder="例如：意外发现美好事物的运气"
            rows={3}
            maxLength={600}
          />
          <p className="field-hint">
            留空也可以，AI 会在第一次造句时补全释义。
          </p>
        </div>

        {error ? (
          <div className="inline-alert inline-alert-error" role="alert">
            <AlertCircle size={17} />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={closeIfIdle}
            disabled={saving}
          >
            取消
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? (
              <>
                <span className="button-spinner" aria-hidden="true" />
                保存中…
              </>
            ) : (
              <>
                <Sparkles size={17} />
                {word ? '保存修改' : '种下这个词'}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
