import {
  ArrowLeft,
  Bookmark,
  Languages,
  MessageCircle,
  Shuffle,
} from 'lucide-react';
import { useEffect, useRef } from 'react';

import type { InterfaceLanguage, Persona } from './api';
import { copy, languages } from './copy';
import { Avatar, ChatInput, Critique, Profile } from './ui';
import type { Conversation } from './workspace';

interface ChatProps {
  active: Conversation;
  persona: Persona;
  locale: InterfaceLanguage;
  initial: string;
  saved: boolean;
  feedbackEnabled: boolean;
  matchError: boolean;
  onBack: () => void;
  onToggleSaved: () => void;
  onSkip: () => void;
  onClearInterests: () => void;
  onSubmit: (text: string, retryId?: string) => void;
  onFeedbackChange: (enabled: boolean) => void;
}

export function Chat({
  active,
  persona,
  locale,
  initial,
  saved,
  feedbackEnabled,
  matchError,
  onBack,
  onToggleSaved,
  onSkip,
  onClearInterests,
  onSubmit,
  onFeedbackChange,
}: ChatProps) {
  const t = copy[locale];
  const endOfChat = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endOfChat.current?.scrollIntoView({ block: 'end' });
  }, [active.id, active.turns]);

  return (
    <div className="chat-grid">
      <section className="chat" aria-label={persona.name}>
        <header className="chat-header">
          <button className="icon-button" onClick={onBack} aria-label={t.back}>
            <ArrowLeft size={19} />
          </button>
          <Avatar persona={persona} />
          <div>
            <h1>{persona.name}</h1>
            <p>{languages[active.language]}</p>
          </div>
          <button
            className="icon-button"
            onClick={onToggleSaved}
            aria-pressed={saved}
            aria-label={saved ? t.remove : t.save}
          >
            <Bookmark size={20} fill={saved ? 'currentColor' : 'none'} />
          </button>
          <button className="secondary skip" onClick={onSkip}>
            <Shuffle size={16} /> {t.skip}
          </button>
        </header>
        {matchError && (
          <p className="notice" role="status">
            {t.noMatch}{' '}
            <button className="text-button" onClick={onClearInterests}>
              {t.reset}
            </button>
          </p>
        )}
        <div className="message-list" role="log" aria-label={persona.name}>
          {!active.turns.length && (
            <div className="chat-empty">
              <Avatar persona={persona} large />
              <h2>{t.emptyChat}</h2>
              <p>{persona.bio[active.language]}</p>
            </div>
          )}
          {active.turns.map((turn, index) => (
            <div className="turn" key={turn.id}>
              <div className="message user-message">
                <strong>{t.you}</strong>
                <p lang={active.language}>{turn.message}</p>
              </div>
              {turn.feedback ? (
                <Critique
                  feedback={turn.feedback}
                  t={t}
                  language={active.language}
                  noteLanguage={turn.feedbackLanguage}
                />
              ) : turn.feedbackState === 'pending' ? (
                <p className="turn-status">
                  <Languages size={15} />
                  {t.reviewing}
                </p>
              ) : turn.feedbackState === 'not-in-demo' ||
                turn.feedbackState === 'failed' ? (
                <p className="turn-status">
                  <Languages size={15} />
                  {turn.feedbackState === 'failed'
                    ? t.critiqueError
                    : t.unavailable}
                </p>
              ) : null}
              {turn.reply && (
                <div className="message character-message">
                  <Avatar persona={persona} />
                  <div>
                    <strong>{persona.name}</strong>
                    <p lang={active.language}>{turn.reply}</p>
                  </div>
                </div>
              )}
              {turn.status === 'sending' && (
                <p className="turn-status">
                  <MessageCircle size={15} />
                  {t.composing}
                </p>
              )}
              {turn.status === 'failed' && (
                <div className="turn-status failed">
                  {t.characterError}
                  {index === active.turns.length - 1 && (
                    <button
                      className="text-button"
                      onClick={() => onSubmit(turn.message, turn.id)}
                    >
                      {t.retry}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={endOfChat} />
        </div>
        <footer className="chat-footer">
          <ChatInput
            key={active.id}
            t={t}
            initial={initial}
            language={active.language}
            busy={active.turns.at(-1)?.status === 'sending'}
            onSend={onSubmit}
          />
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={feedbackEnabled}
              onChange={(event) => onFeedbackChange(event.target.checked)}
            />
            <Languages size={15} /> {t.critic}
          </label>
        </footer>
      </section>
      <aside className="chat-aside">
        <Profile persona={persona} locale={locale} t={t} />
      </aside>
    </div>
  );
}
