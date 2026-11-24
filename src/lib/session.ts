import type { Item } from '../data/types';
import { modeFor, type Mode } from './modes';
import { isDue, type CardState } from './srs';

/** Pares relâmpago: quantos itens no máximo por rodada (cabe na tela do celular). */
export const MATCH_SIZE = 5;

export type Rng = () => number;

/**
 * Um passo da sessão.
 * - intro: apresenta um item novo (palavra, tradução, áudio, exemplo).
 * - quiz com graded=true: a primeira pergunta do item na sessão; move a caixa Leitner.
 * - quiz com graded=false: repetição de fixação; não muda a caixa.
 * - match: "pares relâmpago" com os itens novos da sessão (inglês ↔ português); não muda a caixa.
 */
export interface Step {
  itemId: string;
  kind: 'intro' | 'quiz' | 'match';
  graded: boolean;
  mode: Mode;
  /** Itens da rodada de pares (só em kind 'match'). */
  group?: string[];
  /** Repetição depois de um erro (não conta como tarefa nova da viagem). */
  retry?: boolean;
}

export interface SessionOptions {
  maxReviews: number;
  maxNew: number;
  /** Quantos passos depois da apresentação o item novo é perguntado. */
  newGap: number;
}

export const DEFAULT_SESSION: SessionOptions = { maxReviews: 20, maxNew: 6, newGap: 2 };

export function shuffle<T>(list: readonly T[], rng: Rng): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}

/** Itens pendentes de revisão, os mais atrasados primeiro. */
export function dueItems(
  items: readonly Item[],
  cards: Readonly<Record<string, CardState>>,
  now: number,
): Item[] {
  return items
    .filter((item) => {
      const card = cards[item.id];
      return card !== undefined && isDue(card, now);
    })
    .sort((a, b) => (cards[a.id]?.due ?? 0) - (cards[b.id]?.due ?? 0));
}

/** Itens nunca vistos, na ordem do pacote (frequência). */
export function unseenItems(
  items: readonly Item[],
  cards: Readonly<Record<string, CardState>>,
): Item[] {
  return items.filter((item) => cards[item.id] === undefined);
}

/**
 * Monta a fila da sessão intercalando revisões e itens novos:
 * apresenta o item novo, pergunta alguns passos depois e repete no fim (fixação).
 */
export function buildSession(
  reviews: readonly Item[],
  fresh: readonly Item[],
  cards: Readonly<Record<string, CardState>>,
  rng: Rng,
  opts: SessionOptions = DEFAULT_SESSION,
): Step[] {
  const reviewQueue = shuffle(reviews.slice(0, opts.maxReviews), rng);
  const newQueue = fresh.slice(0, opts.maxNew);
  const pending: { itemId: string; at: number }[] = [];
  const out: Step[] = [];

  const reviewStep = (item: Item): Step => ({
    itemId: item.id,
    kind: 'quiz',
    graded: true,
    // Intercala tipos de pergunta conforme a posição na sessão.
    mode: modeFor(cards[item.id]?.box ?? 0, out.length, item),
  });

  while (reviewQueue.length > 0 || newQueue.length > 0 || pending.length > 0) {
    const readyIndex = pending.findIndex((p) => p.at <= out.length);
    if (readyIndex >= 0) {
      const [ready] = pending.splice(readyIndex, 1);
      if (ready) out.push({ itemId: ready.itemId, kind: 'quiz', graded: true, mode: 'en-pt-choice' });
      continue;
    }
    const nextNew = newQueue[0];
    if (nextNew && (out.length % 3 === 0 || reviewQueue.length === 0) && pending.length < 2) {
      newQueue.shift();
      out.push({ itemId: nextNew.id, kind: 'intro', graded: false, mode: 'en-pt-choice' });
      pending.push({ itemId: nextNew.id, at: out.length + opts.newGap });
      continue;
    }
    const nextReview = reviewQueue.shift();
    if (nextReview) {
      out.push(reviewStep(nextReview));
      continue;
    }
    // Sem revisões para espaçar: antecipa a próxima pergunta pendente.
    const first = pending.shift();
    if (first) out.push({ itemId: first.itemId, kind: 'quiz', graded: true, mode: 'en-pt-choice' });
  }

  // Pares relâmpago: junta os novos de uma vez (rápido, reforça antes da fixação).
  const matchItems = fresh.slice(0, Math.min(opts.maxNew, MATCH_SIZE));
  if (matchItems.length >= 3) {
    out.push({ itemId: matchItems[0]?.id ?? '', kind: 'match', graded: false, mode: 'en-pt-choice', group: matchItems.map((i) => i.id) });
  }

  // Rodada de fixação: os itens novos aparecem mais uma vez, já na direção inversa.
  const practice = shuffle(fresh.slice(0, opts.maxNew), rng).map<Step>((item) => ({
    itemId: item.id,
    kind: 'quiz',
    graded: false,
    mode: 'pt-en-choice',
  }));
  return [...out, ...practice];
}

/** Depois de um erro, o mesmo item volta alguns passos à frente (repetição para decorar). */
export const RETRY_GAP = 3;
export const MAX_RETRIES_PER_ITEM = 3;

export function scheduleRetry(queue: readonly Step[], index: number, step: Step): Step[] {
  const retry: Step = { ...step, graded: false, retry: true };
  const at = Math.min(queue.length, index + 1 + RETRY_GAP);
  return [...queue.slice(0, at), retry, ...queue.slice(at)];
}

/** Dias em que um erro continua no caderno de erros. */
export const MISTAKE_WINDOW_DAYS = 14;

/** Itens errados recentemente (e ainda não corrigidos), do erro mais novo ao mais antigo. */
export function mistakeItems(
  items: readonly Item[],
  cards: Readonly<Record<string, CardState>>,
  now: number,
): Item[] {
  const since = now - MISTAKE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return items
    .filter((item) => (cards[item.id]?.lastWrong ?? 0) >= since)
    .sort((a, b) => (cards[b.id]?.lastWrong ?? 0) - (cards[a.id]?.lastWrong ?? 0));
}
