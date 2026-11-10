import { useEffect, useRef, useState } from 'react';

import {
  sendTurn,
  type Feedback,
  type InterfaceLanguage,
  type Language,
  type Message,
  type TurnEvent,
} from './api';

const KEY = 'entre-languages:v1';
const MAX_CONVERSATIONS = 40;
const MAX_TURNS = 60;

type FeedbackState = 'pending' | 'ready' | 'not-in-demo' | 'failed' | 'off';

export interface Turn {
  id: string;
  message: string;
  reply?: string;
  feedback?: Feedback;
  feedbackLanguage?: Language;
  feedbackState: FeedbackState;
  status: 'sending' | 'answered' | 'failed';
}

export interface Conversation {
  id: string;
  personaId: string;
  language: Language;
  turns: Turn[];
}

export interface Preferences {
  interfaceLanguage: InterfaceLanguage;
  practice: Language;
  feedbackLanguage: Language;
  feedbackEnabled: boolean;
  interests: string[];
}

interface Workspace {
  preferences: Preferences;
  conversations: Conversation[];
  saved: string[];
  recent: string[];
  activeId?: string;
}

function defaults(): Workspace {
  const portuguese = navigator.language.toLowerCase().startsWith('pt');
  return {
    preferences: {
      interfaceLanguage: portuguese ? 'pt-BR' : 'en',
      practice: 'en',
      feedbackLanguage: portuguese ? 'pt-BR' : 'en',
      feedbackEnabled: true,
      interests: [],
    },
    conversations: [],
    saved: [],
    recent: [],
  };
}

function markInterrupted(turn: Turn): Turn {
  return {
    ...turn,
    status: turn.status === 'sending' ? 'failed' : turn.status,
    feedbackState:
      turn.feedbackState === 'pending' ? 'failed' : turn.feedbackState,
  };
}

function loadWorkspace(): Workspace {
  try {
    const value = localStorage.getItem(KEY);
    if (!value) return defaults();
    const snapshot: Workspace = JSON.parse(value);
    return {
      ...snapshot,
      conversations: snapshot.conversations.map((conversation) => ({
        ...conversation,
        turns: conversation.turns.map(markInterrupted),
      })),
    };
  } catch {
    return defaults();
  }
}

function historyFrom(turns: Turn[]): Message[] {
  const history: Message[] = [];
  let characters = 0;
  for (const turn of turns.slice(-6).reverse()) {
    if (!turn.reply) continue;
    const size =
      Array.from(turn.message).length + Array.from(turn.reply).length;
    if (characters + size > 6000) break;
    characters += size;
    history.unshift(
      { role: 'user', text: turn.message },
      { role: 'assistant', text: turn.reply },
    );
  }
  return history;
}

function applyEvent(turn: Turn, event: TurnEvent): Turn {
  switch (event.type) {
    case 'reply':
      return { ...turn, reply: event.text, status: 'answered' };
    case 'feedback':
      return { ...turn, feedback: event.feedback, feedbackState: 'ready' };
    case 'feedback_unavailable':
      return { ...turn, feedbackState: 'not-in-demo' };
    case 'error':
      return event.branch === 'character'
        ? { ...turn, status: 'failed' }
        : { ...turn, feedbackState: 'failed' };
    case 'done':
      return markInterrupted(turn);
  }
}

export function useWorkspace() {
  const [state, setState] = useState(loadWorkspace);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const requests = useRef(
    new Map<
      string,
      {
        conversationId: string;
        controller: AbortController;
        awaitingReply: boolean;
      }
    >(),
  );
  const active = state.conversations.find(({ id }) => id === state.activeId);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      setStorageAvailable(false);
    }
  }, [state]);

  useEffect(() => {
    const pending = requests.current;
    return () => {
      for (const request of pending.values()) request.controller.abort();
    };
  }, []);

  function updatePreferences(patch: Partial<Preferences>) {
    setState((current) => ({
      ...current,
      preferences: { ...current.preferences, ...patch },
    }));
  }

  function setActive(id?: string) {
    setState((current) => ({ ...current, activeId: id }));
  }

  function start(personaId: string): Conversation {
    const conversation: Conversation = {
      id: crypto.randomUUID(),
      personaId,
      language: state.preferences.practice,
      turns: [],
    };
    setState((current) => ({
      ...current,
      activeId: conversation.id,
      conversations: [conversation, ...current.conversations].slice(
        0,
        MAX_CONVERSATIONS,
      ),
      recent: [
        personaId,
        ...current.recent.filter((id) => id !== personaId),
      ].slice(0, 3),
    }));
    return conversation;
  }

  function toggleSaved(personaId: string) {
    setState((current) => ({
      ...current,
      saved: current.saved.includes(personaId)
        ? current.saved.filter((id) => id !== personaId)
        : [...current.saved, personaId],
    }));
  }

  function cancel(conversationId: string) {
    for (const request of requests.current.values()) {
      if (request.conversationId === conversationId) request.controller.abort();
    }
  }

  function clear() {
    for (const request of requests.current.values()) request.controller.abort();
    setState((current) => ({
      ...defaults(),
      preferences: current.preferences,
    }));
  }

  function updateTurns(
    conversationId: string,
    apply: (turns: Turn[]) => Turn[],
  ) {
    setState((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, turns: apply(conversation.turns) }
          : conversation,
      ),
    }));
  }

  async function submit(
    conversation: Conversation,
    input: string,
    retryId?: string,
  ) {
    const message = input.trim();
    if (!message || conversation.turns.at(-1)?.status === 'sending') return;
    if (
      [...requests.current.values()].some(
        ({ conversationId, controller, awaitingReply }) =>
          conversationId === conversation.id &&
          !controller.signal.aborted &&
          awaitingReply,
      )
    )
      return;

    if (retryId) requests.current.get(retryId)?.controller.abort();

    const { feedbackLanguage, feedbackEnabled } = state.preferences;
    const controller = new AbortController();
    const id = retryId ?? crypto.randomUUID();
    const turn: Turn = {
      id,
      message,
      feedbackLanguage,
      status: 'sending',
      feedbackState: feedbackEnabled ? 'pending' : 'off',
    };
    const request = {
      conversationId: conversation.id,
      controller,
      awaitingReply: true,
    };
    requests.current.set(id, request);
    updateTurns(conversation.id, (turns) =>
      retryId
        ? turns.map((entry) => (entry.id === id ? turn : entry))
        : [...turns, turn].slice(-MAX_TURNS),
    );

    function update(apply: (entry: Turn) => Turn) {
      if (requests.current.get(id) !== request) return;
      updateTurns(conversation.id, (turns) =>
        turns.map((entry) => (entry.id === id ? apply(entry) : entry)),
      );
    }

    try {
      await sendTurn(
        {
          persona_id: conversation.personaId,
          conversation_language: conversation.language,
          feedback_language: feedbackLanguage,
          feedback_enabled: feedbackEnabled,
          message,
          history: historyFrom(
            conversation.turns.filter((entry) => entry.id !== retryId),
          ),
        },
        controller.signal,
        (event) => {
          if (
            event.type === 'reply' ||
            (event.type === 'error' && event.branch === 'character')
          ) {
            request.awaitingReply = false;
          }
          update((entry) => applyEvent(entry, event));
        },
      );
    } catch {
      update(markInterrupted);
    } finally {
      if (requests.current.get(id) === request) requests.current.delete(id);
    }
  }

  return {
    ...state,
    active,
    storageAvailable,
    updatePreferences,
    setActive,
    start,
    toggleSaved,
    cancel,
    clear,
    submit,
  };
}
