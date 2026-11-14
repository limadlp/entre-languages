import { ChevronRight, Globe, Settings2, Shuffle, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { getCatalog, type Catalog, type Persona } from './api';
import { Chat } from './Chat';
import { Contacts } from './Contacts';
import { copy, languages } from './copy';
import { Discovery } from './Discovery';
import { Settings } from './Settings';
import { Avatar } from './ui';
import { useWorkspace, type Preferences } from './workspace';

type Page = 'discover' | 'chat' | 'contacts' | 'settings';

export default function App() {
  const workspace = useWorkspace();
  const { active, preferences, saved } = workspace;
  const locale = preferences.interfaceLanguage;
  const t = copy[locale];
  const [catalog, setCatalog] = useState<Catalog>();
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState<Page>(active ? 'chat' : 'discover');
  const [initial, setInitial] = useState('');
  const [matchError, setMatchError] = useState(false);
  const content = useRef<HTMLElement>(null);
  const persona = catalog?.personas.find(({ id }) => id === active?.personaId);
  const contacts =
    catalog?.personas.filter(({ id }) => saved.includes(id)) ?? [];
  const example = catalog?.examples[preferences.practice];
  const showChat = page === 'chat' && active && persona;
  useEffect(() => {
    const controller = new AbortController();
    getCatalog(controller.signal)
      .then(setCatalog)
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    content.current?.scrollTo(0, 0);
  }, [page]);

  function updateDiscovery(patch: Partial<Preferences>) {
    workspace.updatePreferences(patch);
    setMatchError(false);
  }

  function meet(withExample = false, skip = false) {
    if (!catalog) return;

    const eligible = catalog.personas.filter(
      (candidate) =>
        (!skip || candidate.id !== active?.personaId) &&
        (!preferences.interests.length ||
          candidate.tags.some((tag) => preferences.interests.includes(tag))),
    );
    const fresh = eligible.filter(({ id }) => !workspace.recent.includes(id));
    const options = fresh.length ? fresh : eligible;
    if (!options.length) {
      setMatchError(true);
      return;
    }

    if (skip && active) workspace.cancel(active.id);
    const next = options[Math.floor(Math.random() * options.length)];
    workspace.start(next.id);
    setMatchError(false);
    setInitial(withExample ? (example?.message ?? '') : '');
    setPage('chat');
  }

  function openContact(contact: Persona) {
    const conversation = workspace.conversations.find(
      ({ personaId }) => personaId === contact.id,
    );
    if (conversation) workspace.setActive(conversation.id);
    else workspace.start(contact.id);
    setInitial('');
    setMatchError(false);
    setPage('chat');
  }

  function changePage(next: Page) {
    setPage(next);
    setMatchError(false);
  }

  const currentLabel =
    page === 'chat' ? (persona?.name ?? t.discover) : t[page];

  return (
    <div className="shell">
      <aside className="rail">
        <button
          className="brand"
          onClick={() => changePage('discover')}
          aria-label="Entre Languages"
        >
          <span className="brand-mark">
            <Shuffle size={22} strokeWidth={2.5} />
          </span>
          <span>
            entre<span className="brand-dot">.</span>
            <small>languages</small>
          </span>
        </button>
        <nav aria-label={t.nav}>
          <button
            className={page === 'discover' || page === 'chat' ? 'active' : ''}
            aria-current={page === 'discover' ? 'page' : undefined}
            onClick={() => changePage('discover')}
          >
            <Shuffle size={18} /> <span>{t.discover}</span>
          </button>
          <button
            className={page === 'contacts' ? 'active' : ''}
            aria-current={page === 'contacts' ? 'page' : undefined}
            onClick={() => changePage('contacts')}
          >
            <Users size={18} /> <span>{t.contacts}</span>
            <small>{saved.length}</small>
          </button>
          <button
            className={page === 'settings' ? 'active' : ''}
            aria-current={page === 'settings' ? 'page' : undefined}
            onClick={() => changePage('settings')}
          >
            <Settings2 size={18} /> <span>{t.settings}</span>
          </button>
        </nav>

        <div className="rail-contacts">
          <h2>{t.saved}</h2>
          {contacts.length ? (
            contacts.map((contact) => (
              <button
                key={contact.id}
                className="rail-contact"
                onClick={() => openContact(contact)}
              >
                <Avatar persona={contact} /> <span>{contact.name}</span>
                <ChevronRight size={14} />
              </button>
            ))
          ) : (
            <p>{t.contactsHelp}</p>
          )}
        </div>
        <div className="rail-footer">
          <Globe size={17} />
          <span>{languages[preferences.practice]}</span>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <span className="breadcrumb">
            Entre Languages <ChevronRight size={13} />
          </span>
          <strong>{currentLabel}</strong>
          {catalog && (
            <span className="mode">
              {catalog.mode === 'demo' ? t.demo : t.live}
            </span>
          )}
        </header>
        <main
          ref={content}
          className={showChat ? 'content chat-content' : 'content'}
        >
          {!workspace.storageAvailable && (
            <p className="notice" role="status">
              {t.storageError}
            </p>
          )}
          {loadError && (
            <div className="notice" role="alert">
              {t.accessError}{' '}
              <button
                className="text-button"
                onClick={() => {
                  setLoadError(false);
                  setAttempt(attempt + 1);
                }}
              >
                {t.tryAgain}
              </button>
            </div>
          )}

          {showChat ? (
            <Chat
              active={active}
              persona={persona}
              locale={locale}
              initial={initial}
              saved={saved.includes(persona.id)}
              feedbackEnabled={preferences.feedbackEnabled}
              matchError={matchError}
              onBack={() => changePage('discover')}
              onToggleSaved={() => workspace.toggleSaved(persona.id)}
              onSkip={() => meet(false, true)}
              onClearInterests={() => updateDiscovery({ interests: [] })}
              onSubmit={(text, retryId) => {
                setInitial('');
                void workspace.submit(active, text, retryId);
              }}
              onFeedbackChange={(feedbackEnabled) =>
                workspace.updatePreferences({ feedbackEnabled })
              }
            />
          ) : page === 'contacts' ? (
            <Contacts
              contacts={contacts}
              locale={locale}
              onRemove={workspace.toggleSaved}
              onOpen={openContact}
              onDiscover={() => changePage('discover')}
            />
          ) : page === 'settings' ? (
            <Settings
              preferences={preferences}
              onUpdate={workspace.updatePreferences}
              onClear={workspace.clear}
            />
          ) : (
            <Discovery
              catalog={catalog}
              activePersona={persona}
              preferences={preferences}
              matchError={matchError}
              onUpdate={updateDiscovery}
              onMeet={() => meet()}
              onExample={() => meet(true)}
              onResume={() => changePage('chat')}
            />
          )}
        </main>
      </div>
    </div>
  );
}
