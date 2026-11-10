import { Languages, MapPin } from 'lucide-react';
import { useState } from 'react';

import type { Feedback, InterfaceLanguage, Language, Persona } from './api';
import { languages, tagLabel, type Copy } from './copy';

export function Avatar({
  persona,
  large = false,
}: {
  persona: Persona;
  large?: boolean;
}) {
  return (
    <span
      className={`avatar avatar-${persona.color}${large ? ' avatar-large' : ''}`}
      aria-hidden="true"
    >
      {persona.avatar ? <img alt="" src={persona.avatar} /> : persona.name[0]}
    </span>
  );
}

export function Tags({
  persona,
  locale,
}: {
  persona: Persona;
  locale: InterfaceLanguage;
}) {
  return (
    <div className="tags">
      {persona.tags.map((tag) => (
        <span className="tag" key={tag}>
          {tagLabel(tag, locale)}
        </span>
      ))}
    </div>
  );
}

export function LanguageSelect({
  title,
  value,
  onChange,
}: {
  title: string;
  value: Language;
  onChange: (language: Language) => void;
}) {
  return (
    <label className="input-label">
      <span>{title}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as Language)}
      >
        {Object.entries(languages).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Critique({
  feedback,
  t,
  language,
  noteLanguage,
  preview = false,
}: {
  feedback: Feedback;
  t: Copy;
  language: Language;
  noteLanguage?: Language;
  preview?: boolean;
}) {
  return (
    <aside className="critique" aria-label={preview ? t.example : t.critic}>
      <span className="critique-label">
        <Languages size={16} /> {preview ? t.example : t.critic}
      </span>
      <span className="rewrite-label">{t.natural}</span>
      <blockquote lang={language}>{feedback.rewrite}</blockquote>
      <p lang={noteLanguage}>{feedback.note}</p>
    </aside>
  );
}

export function Profile({
  persona,
  locale,
  t,
}: {
  persona: Persona;
  locale: InterfaceLanguage;
  t: Copy;
}) {
  return (
    <section className="profile">
      <Avatar persona={persona} large />
      <h2>
        {persona.name} <small>{persona.age}</small>
      </h2>
      <span className="location">
        <MapPin size={15} /> {persona.city}
      </span>
      <p>{persona.bio[locale]}</p>
      <Tags persona={persona} locale={locale} />
      <small className="fictional">{t.fictional}</small>
    </section>
  );
}

export function ChatInput({
  t,
  busy,
  initial,
  onSend,
  language,
}: {
  t: Copy;
  busy: boolean;
  initial: string;
  onSend: (text: string) => void;
  language: Language;
}) {
  const [input, setInput] = useState(initial);

  function submit() {
    if (busy || !input.trim()) return;
    onSend(input);
    setInput('');
  }

  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        aria-label={t.write}
        lang={language}
        minLength={1}
        maxLength={1000}
        value={input}
        placeholder={t.write}
        rows={2}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <button
        type="submit"
        className="primary send"
        disabled={busy || !input.trim()}
        aria-label={t.send}
      >
        <span aria-hidden="true">↑</span>
      </button>
    </form>
  );
}
