export type Language = 'en' | 'pt-BR' | 'es' | 'zh-CN';
export type InterfaceLanguage = 'en' | 'pt-BR';

export interface Persona {
  id: string;
  name: string;
  age: number;
  city: string;
  color: string;
  avatar: string | null;
  tags: string[];
  bio: Record<Language, string>;
}

export interface Feedback {
  note: string;
  rewrite: string;
}

export interface Catalog {
  mode: 'demo' | 'live';
  personas: Persona[];
  examples: Record<
    Language,
    { message: string; rewrite: string; notes: Record<Language, string> }
  >;
}

export interface Message {
  role: 'user' | 'assistant';
  text: string;
}

export interface TurnRequest {
  persona_id: string;
  conversation_language: Language;
  feedback_language: Language;
  feedback_enabled: boolean;
  message: string;
  history: Message[];
}

export type TurnEvent =
  | { type: 'reply'; text: string }
  | { type: 'feedback'; feedback: Feedback }
  | { type: 'feedback_unavailable' }
  | {
      type: 'error';
      branch: 'character' | 'critic';
      code: 'provider_error' | 'timeout';
    }
  | { type: 'done' };

export async function getCatalog(signal: AbortSignal): Promise<Catalog> {
  const response = await fetch('/api/catalog', { signal });
  if (!response.ok) throw new Error('catalog');
  return response.json();
}

export async function sendTurn(
  turn: TurnRequest,
  signal: AbortSignal,
  onEvent: (event: TurnEvent) => void,
) {
  const response = await fetch('/api/turns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Entre-Client': '1' },
    body: JSON.stringify(turn),
    signal,
  });
  if (!response.ok || !response.body) throw new Error('turn');
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) throw new Error('incomplete_stream');
      buffer += value;

      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const event: TurnEvent = JSON.parse(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        onEvent(event);
        if (event.type === 'done') return;
        newline = buffer.indexOf('\n');
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
