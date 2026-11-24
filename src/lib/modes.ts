import type { Item } from '../data/types';

/**
 * Tipos de pergunta.
 * - en-pt-choice: vê a palavra em inglês e escolhe o significado.
 * - pt-en-choice: vê em português e escolhe o inglês.
 * - pt-en-type: vê em português e digita o inglês.
 * - listen-choice: só ouve o inglês e escolhe o significado (precisa de áudio).
 * - cloze-choice: completa a lacuna de uma frase (como no Duolingo).
 * - speak: vê em português e fala o inglês no microfone (precisa de microfone).
 * - listen-type: só ouve o inglês e escreve o que ouviu (ditado da palavra; precisa de áudio).
 * - build: monta a frase de exemplo com blocos de palavras, a partir da tradução.
 * - spot-error: acha a palavra trocada na frase de exemplo (uma parecida no lugar da certa).
 * - translate: escreve em inglês a frase de exemplo inteira, a partir da tradução.
 *
 * Escada de dificuldade (pela caixa): reconhecer (0–1) → lembrar e usar em contexto (2–3)
 * → produzir sozinho (4+). Formatos misturados em todas as fases (prática intercalada).
 */
export type Mode =
  | 'en-pt-choice'
  | 'pt-en-choice'
  | 'pt-en-type'
  | 'listen-choice'
  | 'cloze-choice'
  | 'speak'
  | 'listen-type'
  | 'build'
  | 'spot-error'
  | 'translate';

export interface Caps {
  audio: boolean;
  mic: boolean;
}

export interface ClozeParts {
  before: string;
  answer: string;
  after: string;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Separa a frase de exemplo em antes / palavra / depois. Null se a palavra não aparece igual na frase. */
export function clozeParts(item: Item): ClozeParts | null {
  if (!item.ex || item.pos === 'frase') return null;
  const re = new RegExp(`(^|[^A-Za-z'])(${escapeRegExp(item.en)})(?=$|[^A-Za-z'])`, 'i');
  const match = re.exec(item.ex);
  if (!match || match[2] === undefined) return null;
  const start = match.index + (match[1]?.length ?? 0);
  const before = item.ex.slice(0, start);
  const after = item.ex.slice(start + match[2].length);
  // Precisa sobrar contexto de verdade em volta da lacuna.
  if (before.replace(/[^A-Za-z]/g, '').length + after.replace(/[^A-Za-z]/g, '').length < 4) return null;
  return { before, answer: match[2], after };
}

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

export interface Sentence {
  en: string;
  pt: string;
}

/**
 * Frase para "monte a frase": o exemplo (3 a 9 palavras) ou, numa frase pronta sem exemplo,
 * a própria frase (3 a 8 palavras).
 */
export function buildSource(item: Item): Sentence | null {
  if (item.ex && item.exPt && wordCount(item.ex) >= 3 && wordCount(item.ex) <= 9) return { en: item.ex, pt: item.exPt };
  if (item.pos === 'frase' && wordCount(item.en) >= 3 && wordCount(item.en) <= 8) return { en: item.en, pt: item.pt };
  return null;
}

/** Frase para "traduza a frase": o exemplo, com 3 a 10 palavras. */
export function translateSource(item: Item): Sentence | null {
  if (item.ex && item.exPt && wordCount(item.ex) >= 3 && wordCount(item.ex) <= 10) return { en: item.ex, pt: item.exPt };
  return null;
}

/** "Ache o erro" precisa da palavra (uma só) aparecendo igual no exemplo, com tradução. */
export function canSpotError(item: Item): boolean {
  return !item.en.includes(' ') && !!item.exPt && clozeParts(item) !== null;
}

/** O item tem o que o formato precisa (frase de exemplo, lacuna etc.). */
export function fits(mode: Mode, item: Item): boolean {
  if (mode === 'cloze-choice') return clozeParts(item) !== null;
  if (mode === 'build') return buildSource(item) !== null;
  if (mode === 'translate') return translateSource(item) !== null;
  if (mode === 'spot-error') return canSpotError(item);
  return true;
}

const LADDER: Record<'recognize' | 'recall' | 'produce', readonly Mode[]> = {
  // Palavra nova: reconhecer (ver e ouvir).
  recognize: ['en-pt-choice', 'en-pt-choice', 'listen-choice'],
  // Já conhece: lembrar e usar em contexto.
  recall: ['pt-en-choice', 'cloze-choice', 'listen-choice', 'speak', 'build', 'spot-error'],
  // Firme: produzir sozinho (escrever, falar, ditado, frase inteira).
  produce: ['pt-en-type', 'cloze-choice', 'speak', 'listen-type', 'translate', 'build'],
};

/** Tipo de pergunta base por caixa, alternando pelo "slot" da sessão (intercalação). */
export function modeFor(box: number, slot: number, item: Item): Mode {
  const stage = box <= 1 ? 'recognize' : box <= 3 ? 'recall' : 'produce';
  const list = LADDER[stage];
  const mode = list[slot % list.length] ?? 'pt-en-choice';
  if (!fits(mode, item)) return box <= 3 ? 'pt-en-choice' : 'pt-en-type';
  return mode;
}

export function needs(mode: Mode): 'audio' | 'mic' | null {
  if (mode === 'listen-choice' || mode === 'listen-type') return 'audio';
  if (mode === 'speak') return 'mic';
  return null;
}

/** Troca perguntas que precisam de áudio/microfone quando eles estão indisponíveis ou pausados. */
export function resolveMode(mode: Mode, item: Item, caps: Caps): Mode {
  if (mode === 'listen-choice' && !caps.audio) return 'en-pt-choice';
  if (mode === 'listen-type' && !caps.audio) return 'pt-en-type';
  if (mode === 'speak' && !caps.mic) return 'pt-en-choice';
  if (!fits(mode, item)) return mode === 'translate' ? 'pt-en-type' : 'pt-en-choice';
  return mode;
}

/** Campo das alternativas: significado em português ou palavra em inglês. */
export function answerField(mode: Mode): 'pt' | 'en' {
  return mode === 'en-pt-choice' || mode === 'listen-choice' ? 'pt' : 'en';
}

/** Perguntas de múltipla escolha (4 alternativas). */
export function isChoice(mode: Mode): boolean {
  return mode === 'en-pt-choice' || mode === 'pt-en-choice' || mode === 'listen-choice' || mode === 'cloze-choice';
}

/** Perguntas em que a resposta é a frase de exemplo inteira. */
export function isSentence(mode: Mode): boolean {
  return mode === 'build' || mode === 'translate' || mode === 'spot-error';
}
