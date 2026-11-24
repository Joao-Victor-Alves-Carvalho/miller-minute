import type { Item } from '../data/types';
import { normalize } from './answer';
import { similarity } from './choices';
import { compareWords, type WordCheck } from './compare';
import { buildSource, canSpotError, clozeParts, translateSource } from './modes';
import { shuffle, type Rng } from './session';

/** Palavras de uma frase como aparecem na tela (com a pontuação grudada). */
export function tokens(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Palavra sem pontuação em volta, para os blocos de "monte a frase". */
const bare = (word: string) => word.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, '');

/** Palavras soltas de outros itens que se parecem com a do item (para confundir de verdade). */
function similarWords(item: Item, pool: readonly Item[], rng: Rng, avoid: ReadonlySet<string>, count: number): string[] {
  const out: string[] = [];
  const ranked = pool
    .filter((i) => i.id !== item.id && !i.en.includes(' ') && /^[A-Za-z']+$/.test(i.en))
    .map((i) => ({ i, score: similarity(item, i, 'en', { box: 4 }) + rng() * 1.5 }))
    .sort((a, b) => b.score - a.score);
  for (const { i } of ranked) {
    if (out.length >= count) break;
    const w = i.en.toLowerCase();
    if (avoid.has(w) || out.some((o) => o.toLowerCase() === w)) continue;
    out.push(i.en);
  }
  return out;
}

export interface BuildPuzzle {
  /** Tradução mostrada como pergunta. */
  prompt: string;
  /** A frase certa (para mostrar e ouvir). */
  sentence: string;
  /** Blocos na ordem certa. */
  answer: string[];
  /** Blocos embaralhados, com duas palavras a mais que não entram. */
  tiles: string[];
}

/** "Monte a frase": blocos da frase de exemplo, embaralhados, mais duas palavras parecidas. */
export function buildPuzzle(item: Item, pool: readonly Item[], rng: Rng): BuildPuzzle | null {
  const source = buildSource(item);
  if (!source) return null;
  const answer = tokens(source.en).map(bare).filter(Boolean);
  if (answer.length < 3) return null;
  const extra = similarWords(item, pool, rng, new Set(answer.map((w) => w.toLowerCase())), 2);
  let tiles = shuffle([...answer, ...extra], rng);
  // Nunca começa já na ordem certa.
  if (tiles.slice(0, answer.length).join(' ') === answer.join(' ')) tiles = [...tiles.slice(1), tiles[0] ?? ''];
  return { prompt: source.pt, sentence: source.en, answer, tiles };
}

/** Confere a frase montada (sem diferença de maiúsculas/pontuação). */
export function checkBuild(answer: readonly string[], built: readonly string[]): boolean {
  return normalize(built.join(' ')) === normalize(answer.join(' '));
}

export interface SpotPuzzle {
  /** Palavras da frase como aparecem na tela, já com a palavra trocada. */
  words: string[];
  /** Posição da palavra trocada. */
  wrongIndex: number;
  /** A palavra que entrou no lugar (errada). */
  wrong: string;
  /** A palavra certa. */
  right: string;
}

/** "Ache o erro": troca a palavra do item, na frase de exemplo, por uma parecida. */
export function spotPuzzle(item: Item, pool: readonly Item[], rng: Rng): SpotPuzzle | null {
  if (!canSpotError(item)) return null;
  const parts = clozeParts(item);
  if (!parts) return null;
  const before = tokens(parts.before);
  // A palavra precisa começar uma "palavra" da frase (sem aspas ou parênteses grudados antes).
  if (parts.before !== '' && !/\s$/.test(parts.before)) return null;
  const sentence = new Set(tokens(item.ex ?? '').map((w) => bare(w).toLowerCase()));
  const [wrong] = similarWords(item, pool, rng, sentence, 1);
  if (!wrong) return null;
  const after = parts.after.split(/\s+/);
  const glued = after[0] ?? '';
  const rest = after.slice(1).filter(Boolean);
  // Mantém a maiúscula do começo da frase.
  const shown = /^[A-Z]/.test(parts.answer) ? wrong.charAt(0).toUpperCase() + wrong.slice(1) : wrong.toLowerCase();
  return { words: [...before, shown + glued, ...rest], wrongIndex: before.length, wrong: shown, right: parts.answer };
}

/** Frase traduzida é aceita com 80% das palavras certas (tolera erro de digitação pequeno). */
export const TRANSLATE_PASS = 0.8;

const CONTRACTIONS: Record<string, string> = {
  "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are', "he's": 'he is', "she's": 'she is',
  "it's": 'it is', "that's": 'that is', "what's": 'what is', "where's": 'where is', "there's": 'there is',
  "isn't": 'is not', "aren't": 'are not', "wasn't": 'was not', "don't": 'do not', "doesn't": 'does not',
  "didn't": 'did not', "can't": 'can not', "cannot": 'can not', "won't": 'will not', "i'll": 'i will', "you'll": 'you will',
  "we'll": 'we will', "i've": 'i have', "i'd": 'i would', "let's": 'let us', "haven't": 'have not', "couldn't": 'could not',
};

/** Abre as contrações ("it's" = "it is"), para as duas formas valerem igual. */
export function expandContractions(text: string): string {
  return text
    .replace(/[’`´]/g, "'")
    .split(/\s+/)
    .map((w) => {
      const m = /^([^A-Za-z']*)([A-Za-z']+)([^A-Za-z']*)$/.exec(w);
      const full = m ? CONTRACTIONS[(m[2] ?? '').toLowerCase()] : undefined;
      return m && full ? `${m[1] ?? ''}${full}${m[3] ?? ''}` : w;
    })
    .join(' ');
}

export function checkTranslation(item: Item, typed: string): { ok: boolean; words: WordCheck[]; score: number } | null {
  const source = translateSource(item);
  if (!source) return null;
  const { words, score } = compareWords(expandContractions(source.en), expandContractions(typed));
  return { ok: score >= TRANSLATE_PASS, words, score };
}
