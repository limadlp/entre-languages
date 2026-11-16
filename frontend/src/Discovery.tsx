import {
  ArrowRight,
  ChevronRight,
  Languages,
  Settings2,
  Shuffle,
} from 'lucide-react';

import type { Catalog, Persona } from './api';
import { copy, languageNames, languages, tagLabel } from './copy';
import { Critique } from './ui';
import type { Preferences } from './workspace';

interface DiscoveryProps {
  catalog?: Catalog;
  activePersona?: Persona;
  preferences: Preferences;
  matchError: boolean;
  onUpdate: (patch: Partial<Preferences>) => void;
  onMeet: () => void;
  onExample: () => void;
  onResume: () => void;
}

export function Discovery({
  catalog,
  activePersona,
  preferences,
  matchError,
  onUpdate,
  onMeet,
  onExample,
  onResume,
}: DiscoveryProps) {
  const locale = preferences.interfaceLanguage;
  const t = copy[locale];
  const example = catalog?.examples[preferences.practice];
  const tags = [
    ...new Set(catalog?.personas.flatMap(({ tags }) => tags) ?? []),
  ].sort((a, b) =>
    tagLabel(a, locale).localeCompare(tagLabel(b, locale), locale),
  );

  return (
    <div className="inner">
      <div className="page-heading">
        <h1>
          {t.practiceTitle(languageNames[locale][preferences.practice])}
          <span>.</span>
        </h1>
        <p>{t.intro}</p>
      </div>
      <div className="discovery-grid">
        <div className="card encounter">
          <div className="orbit" aria-hidden="true">
            <span className="orbit-track" />
            <span className="orbit-track" />
            <span className="orbit-badge orbit-en">hi</span>
            <span className="orbit-badge orbit-pt">oi</span>
            <span className="orbit-badge orbit-es">hola</span>
            <span className="orbit-badge orbit-zh">你好</span>
            <span className="orbit-center">
              <Languages size={45} strokeWidth={1.6} />
            </span>
          </div>
          <button className="primary" disabled={!catalog} onClick={onMeet}>
            <Shuffle size={18} /> {t.encounter} <ArrowRight size={18} />
          </button>
          {matchError && (
            <p className="notice" role="status">
              {t.noMatch}
            </p>
          )}
          {activePersona && (
            <button className="text-button" onClick={onResume}>
              {t.reopen} · {activePersona.name} <ChevronRight size={15} />
            </button>
          )}
        </div>
        <section className="card filters">
          <h2>
            <span className="tile-icon">
              <Settings2 size={19} />
            </span>
            {t.practice}
          </h2>
          <label className="input-label">
            <select
              aria-label={t.practice}
              value={preferences.practice}
              onChange={(event) => {
                onUpdate({
                  practice: event.target.value as typeof preferences.practice,
                });
              }}
            >
              {Object.entries(languages).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="filter-heading">
            <h3>{t.filters}</h3>
            {preferences.interests.length > 0 && (
              <button
                className="text-button"
                onClick={() => {
                  onUpdate({ interests: [] });
                }}
              >
                {t.reset}
              </button>
            )}
          </div>
          <p>{t.filterHelp}</p>
          <div className="tags">
            {tags.map((tag) => (
              <button
                type="button"
                className="tag"
                key={tag}
                aria-pressed={preferences.interests.includes(tag)}
                onClick={() => {
                  onUpdate({
                    interests: preferences.interests.includes(tag)
                      ? preferences.interests.filter((item) => item !== tag)
                      : [...preferences.interests, tag],
                  });
                }}
              >
                {tagLabel(tag, locale)}
              </button>
            ))}
          </div>
        </section>
      </div>
      {example && (
        <section className="card example">
          <div className="example-original">
            <h2>{t.sampleTitle}</h2>
            <span className="rewrite-label">{t.original}</span>
            <blockquote lang={preferences.practice}>
              {example.message}
            </blockquote>
            <button className="secondary" onClick={onExample}>
              {t.anExample} <ArrowRight size={17} />
            </button>
          </div>
          <Critique
            feedback={{
              note: example.notes[locale],
              rewrite: example.rewrite,
            }}
            t={t}
            language={preferences.practice}
            noteLanguage={locale}
            preview
          />
        </section>
      )}
    </div>
  );
}
