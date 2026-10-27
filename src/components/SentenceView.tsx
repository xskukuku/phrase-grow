import { useEffect, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';
import { splitHighlightedSentence } from '../utils';

interface SentenceViewProps {
  sentence: string;
  term: string;
  compact?: boolean;
}

export function SentenceView({
  sentence,
  term,
  compact = false,
}: SentenceViewProps) {
  const [speaking, setSpeaking] = useState(false);
  const speechSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;
  const parts = splitHighlightedSentence(sentence, term);

  useEffect(() => {
    setSpeaking(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [sentence]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleSpeech = () => {
    if (!speechSupported) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = 'en-US';
    utterance.rate = 0.88;
    utterance.pitch = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className={`sentence-wrap ${compact ? 'sentence-compact' : ''}`}>
      <span className="sentence-quote" aria-hidden="true">
        “
      </span>
      <p className="sentence-text" lang="en">
        {parts.map((part, index) =>
          part.highlighted ? (
            <mark key={`${index}-${part.text}`} className="target-word">
              {part.text}
            </mark>
          ) : (
            <span key={`${index}-${part.text}`}>{part.text}</span>
          ),
        )}
      </p>
      {speechSupported ? (
        <button
          type="button"
          className={`speak-button ${speaking ? 'is-speaking' : ''}`}
          onClick={toggleSpeech}
          aria-label={speaking ? '停止朗读' : '朗读这个句子'}
          title={speaking ? '停止朗读' : '朗读句子'}
        >
          {speaking ? <Square size={15} fill="currentColor" /> : <Volume2 size={18} />}
        </button>
      ) : null}
    </div>
  );
}
