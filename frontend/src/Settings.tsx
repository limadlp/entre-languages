import { copy } from './copy';
import { LanguageSelect } from './ui';
import type { Preferences } from './workspace';

interface SettingsProps {
  preferences: Preferences;
  onUpdate: (patch: Partial<Preferences>) => void;
  onClear: () => void;
}

export function Settings({ preferences, onUpdate, onClear }: SettingsProps) {
  const locale = preferences.interfaceLanguage;
  const t = copy[locale];

  return (
    <div className="inner">
      <h1>
        {t.settings}
        <span>.</span>
      </h1>
      <div className="card settings-card">
        <p>{t.startSettings}</p>
        <label className="input-label">
          <span>{t.interfaceLanguage}</span>
          <select
            value={locale}
            onChange={(event) =>
              onUpdate({
                interfaceLanguage:
                  event.target.value === 'pt-BR' ? 'pt-BR' : 'en',
              })
            }
          >
            <option value="en">English</option>
            <option value="pt-BR">Português (Brasil)</option>
          </select>
        </label>
        <LanguageSelect
          title={t.practice}
          value={preferences.practice}
          onChange={(practice) => onUpdate({ practice })}
        />
        <LanguageSelect
          title={t.feedbackLanguage}
          value={preferences.feedbackLanguage}
          onChange={(feedbackLanguage) => onUpdate({ feedbackLanguage })}
        />
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={preferences.feedbackEnabled}
            onChange={(event) =>
              onUpdate({
                feedbackEnabled: event.target.checked,
              })
            }
          />{' '}
          {t.feedbackSetting}
        </label>
      </div>
      <div className="card settings-card">
        <h2>{t.local}</h2>
        <p>{t.privacy}</p>
        <button
          className="secondary"
          onClick={() => {
            if (window.confirm(t.confirmDelete)) onClear();
          }}
        >
          {t.deleteHistory}
        </button>
      </div>
    </div>
  );
}
