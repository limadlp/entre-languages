import { ArrowRight, Bookmark, MapPin, Users } from 'lucide-react';

import type { InterfaceLanguage, Persona } from './api';
import { copy } from './copy';
import { Avatar, Tags } from './ui';

interface ContactsProps {
  contacts: Persona[];
  locale: InterfaceLanguage;
  onRemove: (id: string) => void;
  onOpen: (persona: Persona) => void;
  onDiscover: () => void;
}

export function Contacts({
  contacts,
  locale,
  onRemove,
  onOpen,
  onDiscover,
}: ContactsProps) {
  const t = copy[locale];

  return (
    <div className="inner">
      <h1>
        {t.saved}
        <span>.</span>
      </h1>
      {contacts.length ? (
        <div className="contact-grid">
          {contacts.map((contact) => (
            <article className="card contact-card" key={contact.id}>
              <div className="contact-name">
                <Avatar persona={contact} />
                <div>
                  <h2>{contact.name}</h2>
                  <p>
                    <MapPin size={13} /> {contact.city}
                  </p>
                </div>
                <button
                  className="icon-button"
                  onClick={() => onRemove(contact.id)}
                  aria-label={t.remove}
                >
                  <Bookmark size={19} fill="currentColor" />
                </button>
              </div>
              <p>{contact.bio[locale]}</p>
              <Tags persona={contact} locale={locale} />
              <button className="secondary" onClick={() => onOpen(contact)}>
                {t.reopen} <ArrowRight size={17} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="card empty">
          <Users size={28} />
          <h2>{t.emptyContacts}</h2>
          <p>{t.contactsHelp}</p>
          <button className="secondary" onClick={onDiscover}>
            {t.discover} <ArrowRight size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
