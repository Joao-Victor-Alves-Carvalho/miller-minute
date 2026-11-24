import type { Pack } from '../data/types';
import { isDue, MASTERED_BOX, type CardState } from './srs';

/** Estrelas de um planeta: cada palavra é uma estrela. Revisão vencida = estrela apagando. */
export interface Sky {
  total: number;
  /** Dominadas (caixa alta): estrelas mais fortes. */
  mastered: number;
  /** Vistas e em dia. */
  lit: number;
  /** Vistas e pedindo revisão (apagando). */
  dim: number;
  /** Ainda não descobertas. */
  unseen: number;
}

export function skyOf(pack: Pack, cards: Readonly<Record<string, CardState>>, now: number): Sky {
  const sky: Sky = { total: pack.items.length, mastered: 0, lit: 0, dim: 0, unseen: 0 };
  for (const item of pack.items) {
    const card = cards[item.id];
    if (!card) sky.unseen++;
    else if (isDue(card, now)) sky.dim++;
    else if (card.box >= MASTERED_BOX) sky.mastered++;
    else sky.lit++;
  }
  return sky;
}

export type StarKind = 'mastered' | 'lit' | 'dim' | 'unseen';

/** Até `max` pontinhos para desenhar o céu, proporcionais (cada tipo que existe aparece). */
export function starDots(sky: Sky, max = 48): StarKind[] {
  const kinds: StarKind[] = ['mastered', 'lit', 'dim', 'unseen'];
  if (sky.total <= max) return kinds.flatMap((k) => Array<StarKind>(sky[k]).fill(k));
  const out: StarKind[] = [];
  for (const k of kinds) {
    const n = sky[k] === 0 ? 0 : Math.max(1, Math.round((sky[k] / sky.total) * max));
    for (let i = 0; i < n; i++) out.push(k);
  }
  return out.slice(0, max);
}
