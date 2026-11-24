import { scenes } from '../data/scenes';
import type { Progress } from './progress';
import { isMastered } from './srs';
import type { TaskKind } from './voyage';

/**
 * Hangar: naves, trajes e temas que aparecem como surpresa enquanto você joga.
 * Só visual (não dá vantagem) e sem loja: cada achado vem de uma ação que faz aprender.
 */
export type CosmeticKind = 'ship' | 'suit' | 'theme';

export interface Cosmetic {
  id: string;
  kind: CosmeticKind;
  name: string;
  emoji: string;
  /** Pista de onde achar (sem entregar tudo). */
  hint: string;
  /** Cores: nave = casco, detalhe, fogo; traje = traje, visor, detalhe; tema = 3 manchas do fundo. */
  colors: [string, string, string];
  /** Formato da nave. */
  shape?: 'classic' | 'round' | 'needle';
  /** Vem com o jogo (não aparece como achado). */
  starter?: boolean;
  found: (p: Progress) => boolean;
}

const task = (p: Progress, kind: TaskKind) => p.voyage.tasks[kind] ?? 0;
const mastered = (p: Progress) => Object.values(p.cards).filter((c) => isMastered(c)).length;

export const cosmetics: Cosmetic[] = [
  // Naves
  { id: 'endurance', kind: 'ship', name: 'Endurance', emoji: '🚀', hint: 'A nave de sempre', colors: ['#e5e7eb', '#8b5cf6', '#22d3ee'], shape: 'classic', starter: true, found: () => true },
  { id: 'ranger', kind: 'ship', name: 'Ranger', emoji: '🛸', hint: 'Faça algumas viagens', colors: ['#22d3ee', '#0f172a', '#b6ff5c'], shape: 'needle', found: (p) => p.voyage.trips >= 3 },
  { id: 'lander', kind: 'ship', name: 'Módulo de pouso', emoji: '🔧', hint: 'Conserte muitos circuitos', colors: ['#cbd5e1', '#f59e0b', '#fb923c'], shape: 'round', found: (p) => task(p, 'circuit') >= 10 },
  { id: 'cometa', kind: 'ship', name: 'Cometa', emoji: '☄️', hint: 'Acerte muitas seguidas', colors: ['#ffc94d', '#7c2d12', '#f97316'], shape: 'needle', found: (p) => p.bestCombo >= 15 },
  { id: 'nebulosa', kind: 'ship', name: 'Nebulosa', emoji: '🌸', hint: 'Pouse em planetas diferentes', colors: ['#f472b6', '#4c1d95', '#c084fc'], shape: 'classic', found: (p) => Object.keys(p.voyage.landed).length >= 3 },
  { id: 'relampago', kind: 'ship', name: 'Relâmpago', emoji: '⚡', hint: 'Alinhe os motores várias vezes', colors: ['#b6ff5c', '#14532d', '#facc15'], shape: 'needle', found: (p) => task(p, 'engines') >= 15 },
  { id: 'boreal', kind: 'ship', name: 'Aurora Boreal', emoji: '🌌', hint: 'Uma longa jornada', colors: ['#a5f3fc', '#312e81', '#34d399'], shape: 'round', found: (p) => p.voyage.trips >= 30 },
  // Trajes
  { id: 'classico', kind: 'suit', name: 'Clássico', emoji: '🧑‍🚀', hint: 'O traje de sempre', colors: ['#f1f5f9', '#22d3ee', '#8b5cf6'], starter: true, found: () => true },
  { id: 'resgate', kind: 'suit', name: 'Laranja de resgate', emoji: '🟠', hint: 'Converse com a base por voz', colors: ['#fb923c', '#1e293b', '#f1f5f9'], found: (p) => p.calls.done >= 1 },
  { id: 'lunar', kind: 'suit', name: 'Prata lunar', emoji: '🌙', hint: 'Limpe muitas transmissões', colors: ['#cbd5e1', '#0ea5e9', '#64748b'], found: (p) => task(p, 'noise') >= 20 },
  { id: 'tripulacao', kind: 'suit', name: 'Uniforme da tripulação', emoji: '📖', hint: 'Leia o diário da tripulação', colors: ['#1e3a8a', '#ffc94d', '#93c5fd'], found: (p) => !!p.stories['crew-1'] },
  { id: 'voz', kind: 'suit', name: 'Céu noturno', emoji: '🎙️', hint: 'Dê muitos comandos de voz', colors: ['#312e81', '#f472b6', '#a5b4fc'], found: (p) => task(p, 'voice') >= 25 },
  { id: 'dourado', kind: 'suit', name: 'Dourado', emoji: '🏅', hint: 'Domine muitas palavras', colors: ['#facc15', '#7c2d12', '#fef3c7'], found: (p) => mastered(p) >= 100 },
  // Temas (cores do fundo)
  { id: 'espaco', kind: 'theme', name: 'Espaço profundo', emoji: '🌠', hint: 'O céu de sempre', colors: ['#8b5cf6', '#22d3ee', '#ec4899'], starter: true, found: () => true },
  { id: 'cinema', kind: 'theme', name: 'Luzes de cinema', emoji: '🎬', hint: 'Entre numa cena de filme', colors: ['#f472b6', '#f97316', '#7c3aed'], found: (p) => scenes.some((s) => p.situations[s.id]) },
  { id: 'verde', kind: 'theme', name: 'Aurora verde', emoji: '🟢', hint: 'Viaje bastante', colors: ['#34d399', '#22d3ee', '#a3e635'], found: (p) => p.voyage.trips >= 10 },
  { id: 'eclipse', kind: 'theme', name: 'Eclipse', emoji: '🌘', hint: 'Treine muito o ouvido', colors: ['#f59e0b', '#ef4444', '#6d28d9'], found: (p) => p.ear.dictation + p.ear.shadowing >= 10 },
  { id: 'oceano', kind: 'theme', name: 'Oceano de Miller', emoji: '🌊', hint: 'Passe uma hora a bordo', colors: ['#0ea5e9', '#14b8a6', '#1e40af'], found: (p) => p.totalMs >= 60 * 60_000 },
  { id: 'sol', kind: 'theme', name: 'Sol dourado', emoji: '☀️', hint: 'Chegue ao fim do diário da tripulação', colors: ['#facc15', '#fb923c', '#f472b6'], found: (p) => !!p.stories['crew-8'] },
];

export function cosmetic(id: string, kind: CosmeticKind): Cosmetic {
  return cosmetics.find((c) => c.id === id && c.kind === kind) ?? (cosmetics.find((c) => c.kind === kind && c.starter) as Cosmetic);
}

/** Já está no hangar (do começo ou achado). */
export function owned(p: Progress, c: Cosmetic): boolean {
  return !!c.starter || !!p.hangar.found[c.id];
}

/** Achados novos: registra e devolve para avisar. */
export function awardFinds(p: Progress, now: number): { progress: Progress; found: Cosmetic[] } {
  const found = cosmetics.filter((c) => !c.starter && !p.hangar.found[c.id] && c.found(p));
  if (found.length === 0) return { progress: p, found };
  const record = { ...p.hangar.found };
  for (const c of found) record[c.id] = now;
  return { progress: { ...p, hangar: { ...p.hangar, found: record } }, found };
}

/** Usa uma nave, traje ou tema (só se já estiver no hangar). */
export function equip(p: Progress, c: Cosmetic): Progress {
  if (!owned(p, c)) return p;
  return { ...p, hangar: { ...p.hangar, [c.kind]: c.id } };
}
