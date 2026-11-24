import { areConfusable, topicsFor } from '../data/topics';
import type { Item } from '../data/types';
import { levenshtein } from './answer';
import { shuffle, type Rng } from './session';

/**
 * Alternativas "inteligentes": as erradas se parecem com a certa, para a pergunta exigir
 * lembrar de verdade (prática de recuperação) em vez de eliminar pelo bom senso.
 * A parecença vem de: confusões conhecidas, as confusões do próprio aprendiz, mesmo tema,
 * forma parecida (escrita/som), mesma estrutura de frase e mesma classe gramatical.
 */
export interface ChoiceContext {
  /** Caixa do item (0 = palavra nova). Palavras mais firmes recebem alternativas mais difíceis. */
  box?: number;
  /** Ids que o aprendiz já confundiu com este item. */
  confusedWith?: readonly string[];
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean);

/** Quanto `cand` se parece com `target` (quanto maior, mais difícil de eliminar). */
export function similarity(target: Item, cand: Item, field: 'en' | 'pt', ctx: ChoiceContext = {}): number {
  let score = 0;
  const a = target.en.toLowerCase();
  const b = cand.en.toLowerCase();
  if (ctx.confusedWith?.includes(cand.id)) score += 10;
  if (areConfusable(a, b)) score += 8;
  const ta = topicsFor(a);
  if (ta.length && topicsFor(b).some((t) => ta.includes(t))) score += 5;
  // Mesmo pacote temático (viagem, trabalho, cinema) também é "mesmo tema".
  const packA = target.id.split(':')[0];
  if (packA && !packA.startsWith('p') && packA === cand.id.split(':')[0]) score += 3;
  if (cand.pos === target.pos) score += 2;
  // Forma parecida no texto que aparece nas alternativas.
  const x = target[field].toLowerCase();
  const y = cand[field].toLowerCase();
  const dist = levenshtein(x, y) / Math.max(x.length, y.length, 1);
  if (dist <= 0.35) score += 3;
  else if (x.slice(0, 2) === y.slice(0, 2)) score += 1;
  // Frases: mesma estrutura (mesma primeira palavra, palavras em comum, tamanho parecido).
  if (target.pos === 'frase' || cand.pos === 'frase') {
    const wa = words(target.en);
    const wb = words(cand.en);
    if (wa[0] && wa[0] === wb[0]) score += 4;
    const common = wa.filter((w) => wb.includes(w)).length;
    score += Math.min(3, common);
    const ratio = Math.min(wa.length, wb.length) / Math.max(wa.length, wb.length, 1);
    if (ratio >= 0.6) score += 1;
  }
  return score;
}

/**
 * Monta as alternativas: a certa + (count - 1) erradas. Palavra nova (caixa 0–1): duas
 * parecidas e uma mais aleatória da mesma classe. Palavra firme: só as mais parecidas.
 */
export function buildChoices(
  target: Item,
  pool: readonly Item[],
  rng: Rng,
  field: 'en' | 'pt',
  count = 4,
  ctx: ChoiceContext = {},
): string[] {
  const answer = target[field];
  const used = new Set([answer.toLowerCase()]);
  const candidates = pool.filter((i) => i.id !== target.id);
  // Pontuação com um pouco de sorte, para variar entre as sessões.
  const ranked = candidates
    .map((item) => ({ item, score: similarity(target, item, field, ctx) + rng() * 1.5 }))
    .sort((p, q) => q.score - p.score);

  const picked: string[] = [];
  const add = (item: Item) => {
    const value = item[field];
    if (picked.length >= count - 1 || used.has(value.toLowerCase())) return;
    used.add(value.toLowerCase());
    picked.push(value);
  };

  const easy = (ctx.box ?? 0) <= 1;
  const hardSlots = easy ? count - 2 : count - 1;
  for (const { item } of ranked) {
    if (picked.length >= hardSlots) break;
    add(item);
  }
  // Palavra nova: uma alternativa da mesma classe, mas não necessariamente parecida.
  if (easy) {
    for (const item of shuffle(candidates.filter((i) => i.pos === target.pos), rng)) {
      if (picked.length >= count - 1) break;
      add(item);
    }
  }
  for (const { item } of ranked) {
    if (picked.length >= count - 1) break;
    add(item);
  }
  return shuffle([answer, ...picked], rng);
}
