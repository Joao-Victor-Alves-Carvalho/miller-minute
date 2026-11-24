import { pack1 } from './pack1';
import { pack2 } from './pack2';
import { themes } from './themes';
import type { Item, Pack } from './types';

/** Pacotes em ordem de desbloqueio. Novos pacotes entram no fim desta lista. */
export const packs: Pack[] = [pack1, pack2, ...themes];

export const itemsById: ReadonlyMap<string, Item> = new Map(
  packs.flatMap((pack) => pack.items.map((item) => [item.id, item] as const)),
);

/** Itens do pacote "Minhas frases" (vêm do progresso; registrados pelo App). */
let customItems = new Map<string, Item>();

export function setCustomItems(items: readonly Item[]): void {
  customItems = new Map(items.map((item) => [item.id, item]));
}

/** Procura um item nos pacotes fixos e nas suas frases. */
export function getItem(id: string): Item | undefined {
  return itemsById.get(id) ?? customItems.get(id);
}

export const MINE_PACK_ID = 'mine';

export function minePack(items: Item[]): Pack {
  return { id: MINE_PACK_ID, title: 'Minhas frases', subtitle: 'Das suas conversas, do diário e do que você capturou', kind: 'mine', items };
}
