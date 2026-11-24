import type { Pack } from './types';

/**
 * A galáxia do jogo: cada pacote de palavras é um planeta para explorar.
 * Nomes e visuais originais do Miller Minute.
 */
export interface Planet {
  id: string;
  name: string;
  emoji: string;
  /** Frase curta sobre o lugar (aparece no mapa e no pouso). */
  tagline: string;
  /** Duas cores do planeta (gradiente). */
  colors: [string, string];
}

const PLANETS: Record<string, Planet> = {
  p1: { id: 'p1', name: 'Lumen', emoji: '🌕', tagline: 'Onde nascem as primeiras palavras', colors: ['#8b5cf6', '#22d3ee'] },
  p2: { id: 'p2', name: 'Verdana', emoji: '🌿', tagline: 'Feiras, ruas e cozinhas do dia a dia', colors: ['#34d399', '#0ea5e9'] },
  viagem: { id: 'viagem', name: 'Odisseia', emoji: '🧳', tagline: 'Portos espaciais, hotéis e passeios', colors: ['#fb923c', '#ec4899'] },
  trabalho: { id: 'trabalho', name: 'Forja', emoji: '⚒️', tagline: 'Estações de trabalho e reuniões', colors: ['#f59e0b', '#ef4444'] },
  cinema: { id: 'cinema', name: 'Cinerama', emoji: '🎬', tagline: 'Holofotes, roteiros e cenas', colors: ['#f472b6', '#7c3aed'] },
  mine: { id: 'mine', name: 'Eco', emoji: '🪞', tagline: 'Feito das suas próprias frases', colors: ['#ffc94d', '#22d3ee'] },
};

/** Planeta de um pacote (pacotes futuros ganham um planeta genérico com o nome do pacote). */
export function planetFor(pack: Pick<Pack, 'id' | 'title'>): Planet {
  return PLANETS[pack.id] ?? { id: pack.id, name: pack.title, emoji: '🪐', tagline: 'Um mundo novo para explorar', colors: ['#64748b', '#22d3ee'] };
}

/** Pacote de um item pelo id ("p1:hello" → "p1"). */
export function packOfItem(itemId: string): string {
  return itemId.split(':')[0] ?? '';
}
