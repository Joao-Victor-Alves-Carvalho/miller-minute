/**
 * Servidor da IA do Miller Minute (Cloudflare Worker): regras e validação, sem dependência do
 * ambiente, para poder testar sem chamar a API. A chamada ao Claude é injetada (`Ask`).
 *
 * Endpoints (POST, JSON, cabeçalho `X-Access-Code` obrigatório):
 *   /chat     → próxima fala da "Chamada da Endurance"
 *   /report   → relatório no fim da chamada (erros, palavras novas)
 *   /correct  → correção do diário ou explicação de uma frase capturada
 */

export interface Env {
  ANTHROPIC_API_KEY: string;
  APP_ACCESS_CODE: string;
  /** Origens permitidas (separadas por vírgula). */
  ALLOWED_ORIGINS?: string;
}

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

/** Chamada ao modelo: texto livre ou JSON validado por schema. */
export type Ask = (req: {
  system: string;
  messages: Turn[];
  maxTokens: number;
  effort: 'low' | 'medium';
  schema?: Record<string, unknown>;
}) => Promise<{ text: string; refused: boolean }>;

export const MODEL = 'claude-haiku-5-5';
export const MAX_TURNS = 60;
export const MAX_CHARS = 1200;

const DEFAULT_ORIGINS = ['https://joao-victor-alves-carvalho.github.io', 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://localhost:4173'];

export function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()) : DEFAULT_ORIGINS;
  const ok = origin !== null && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] ?? '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Access-Code',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Comparação em tempo constante (não revela o código pelo tempo de resposta). */
export function sameCode(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const clip = (s: unknown, n = MAX_CHARS) => (typeof s === 'string' ? s.slice(0, n) : '');

// ---------- Prompts ----------

export function chatSystem(input: { level: string; words: string[]; topic?: string }): string {
  return [
    'You are "Endurance", a warm, patient English conversation partner inside a language app.',
    `The learner is a Brazilian adult (native Portuguese) at ${input.level} level who wants to talk with foreigners anywhere in the world.`,
    'This is a spoken conversation: the learner talks through a microphone and hears your replies read aloud.',
    'Reply ONLY in English, in 1 to 3 short sentences, with everyday words, and end with one simple question that keeps the conversation going.',
    'Do not correct mistakes explicitly during the conversation. If the learner makes a mistake, naturally reuse the correct form in your reply (a recast).',
    'If the learner writes in Portuguese or seems stuck, help with a very simple English sentence they can repeat.',
    'No emojis, no markdown, no lists: plain sentences that sound natural when read aloud.',
    input.words.length ? `When natural, use some of these words the learner is studying: ${input.words.slice(0, 40).join(', ')}.` : '',
    input.topic ? `Today's topic: ${input.topic}.` : 'Start with a friendly question about their day.',
  ]
    .filter(Boolean)
    .join('\n');
}

export const REPORT_SYSTEM = [
  'You review a spoken English conversation between a Brazilian learner (user turns) and a tutor (assistant turns).',
  'Find up to 5 of the most useful mistakes in the USER turns only (grammar, word choice, unnatural phrasing). Ignore punctuation and capitalization: the text came from speech recognition.',
  'For each mistake give what they said, a natural correction, and a short explanation in Brazilian Portuguese.',
  'Also list up to 5 useful English words or phrases from the conversation worth studying, with a Portuguese translation and a short English example.',
  'Write the summary and encouragement in Brazilian Portuguese, short and kind. If there were no mistakes, return an empty list.',
].join('\n');

export const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary_pt', 'mistakes', 'new_words', 'encouragement_pt'],
  properties: {
    summary_pt: { type: 'string' },
    mistakes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['said', 'better', 'why_pt'],
        properties: { said: { type: 'string' }, better: { type: 'string' }, why_pt: { type: 'string' } },
      },
    },
    new_words: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['en', 'pt', 'example'],
        properties: { en: { type: 'string' }, pt: { type: 'string' }, example: { type: 'string' } },
      },
    },
    encouragement_pt: { type: 'string' },
  },
} as const;

export const DIARY_SYSTEM = [
  'You correct a short English diary entry written by a Brazilian learner at basic level.',
  'Return the corrected text (minimal changes), a more natural version a native speaker would write, up to 5 mistakes with a short explanation in Brazilian Portuguese, and one practical tip in Portuguese.',
  'If the text is already correct, keep it and return an empty mistakes list. Be encouraging.',
].join('\n');

export const DIARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['corrected', 'natural', 'mistakes', 'tip_pt'],
  properties: {
    corrected: { type: 'string' },
    natural: { type: 'string' },
    mistakes: REPORT_SCHEMA.properties.mistakes,
    tip_pt: { type: 'string' },
  },
} as const;

export const PHRASE_SYSTEM = [
  'A Brazilian learner heard an English phrase (in a series, video, podcast or real life) and wants to study it.',
  'The text may have small spelling mistakes: fix them. Return the phrase in correct English, a natural Brazilian Portuguese translation, a short explanation in Portuguese of meaning and when to use it (slang, idioms, grammar), and one short new English example.',
].join('\n');

export const PHRASE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['en', 'pt', 'explanation_pt', 'example'],
  properties: { en: { type: 'string' }, pt: { type: 'string' }, explanation_pt: { type: 'string' }, example: { type: 'string' } },
} as const;

// ---------- Validação ----------

export class BadRequest extends Error {}

export function parseTurns(value: unknown): Turn[] {
  if (!Array.isArray(value)) throw new BadRequest('messages deve ser uma lista');
  const turns = value.slice(-MAX_TURNS).map((t) => {
    const role = (t as Turn)?.role;
    if (role !== 'user' && role !== 'assistant') throw new BadRequest('role inválido');
    return { role, content: clip((t as Turn).content) };
  });
  return turns.filter((t) => t.content.trim().length > 0);
}

// ---------- Handlers ----------

export async function handle(path: string, body: Record<string, unknown>, ask: Ask): Promise<Record<string, unknown>> {
  if (path === '/chat') {
    let messages = parseTurns(body.messages);
    // A conversa precisa começar pelo aprendiz; no início, pede para o tutor abrir a chamada.
    if (messages.length === 0 || messages[0]?.role !== 'user') messages = [{ role: 'user', content: '(The learner joined the call. Greet them and start.)' }, ...messages];
    if (messages[messages.length - 1]?.role !== 'user') throw new BadRequest('a última fala deve ser do aprendiz');
    const words = Array.isArray(body.words) ? body.words.filter((w): w is string => typeof w === 'string').map((w) => w.slice(0, 40)) : [];
    const out = await ask({
      system: chatSystem({ level: clip(body.level, 40) || 'basic (A2)', words, topic: clip(body.topic, 120) || undefined }),
      messages,
      maxTokens: 400,
      effort: 'low',
    });
    return out.refused ? { reply: "Let's talk about something else. What did you do today?", refused: true } : { reply: out.text.trim() };
  }

  if (path === '/report') {
    const messages = parseTurns(body.messages);
    if (!messages.some((m) => m.role === 'user')) throw new BadRequest('conversa vazia');
    const transcript = messages.map((m) => `${m.role === 'user' ? 'LEARNER' : 'TUTOR'}: ${m.content}`).join('\n');
    const out = await ask({
      system: REPORT_SYSTEM,
      messages: [{ role: 'user', content: `Conversation transcript:\n${transcript}` }],
      maxTokens: 2000,
      effort: 'medium',
      schema: REPORT_SCHEMA,
    });
    if (out.refused) return { summary_pt: 'Não foi possível gerar o relatório desta conversa.', mistakes: [], new_words: [], encouragement_pt: '' };
    return JSON.parse(out.text) as Record<string, unknown>;
  }

  if (path === '/correct') {
    const kind = body.kind;
    const text = clip(body.text);
    if (!text.trim()) throw new BadRequest('texto vazio');
    if (kind !== 'diary' && kind !== 'phrase') throw new BadRequest('kind deve ser diary ou phrase');
    const out = await ask({
      system: kind === 'diary' ? DIARY_SYSTEM : PHRASE_SYSTEM,
      messages: [{ role: 'user', content: kind === 'phrase' && body.context ? `${text}\n(Where I heard it: ${clip(body.context, 200)})` : text }],
      maxTokens: 1500,
      effort: 'medium',
      schema: kind === 'diary' ? DIARY_SCHEMA : PHRASE_SCHEMA,
    });
    if (out.refused) throw new BadRequest('não foi possível processar este texto');
    return JSON.parse(out.text) as Record<string, unknown>;
  }

  throw new BadRequest('endpoint desconhecido');
}
