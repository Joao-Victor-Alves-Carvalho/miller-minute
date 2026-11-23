import { scenes } from '../data/scenes';
import { situations } from '../data/situations';
import { stories } from '../data/stories';
import type { Progress } from './progress';
import { isMastered } from './srs';

export interface Medal {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  earned: (p: Progress) => boolean;
}

const seen = (p: Progress) => Object.keys(p.cards).length;
const mastered = (p: Progress) => Object.values(p.cards).filter((c) => isMastered(c)).length;
const minutes = (p: Progress) => p.totalMs / 60000;

/** Medalhas com o tema de Interestelar. A ordem é a de exibição. */
export const medals: Medal[] = [
  { id: 'decolagem', emoji: '🚀', title: 'Decolagem', desc: 'Responder a primeira pergunta', earned: (p) => p.totalAnswers > 0 },
  { id: 'meta', emoji: '🎯', title: 'Missão do dia', desc: 'Bater a meta diária de estudo', earned: (p) => Object.values(p.history).some((d) => (d.ms ?? 0) >= p.settings.goalMinutes * 60000) },
  { id: 'streak3', emoji: '🔥', title: 'Ignição', desc: '3 dias seguidos', earned: (p) => p.bestStreak >= 3 },
  { id: 'streak7', emoji: '🛰️', title: 'Uma semana em órbita', desc: '7 dias seguidos', earned: (p) => p.bestStreak >= 7 },
  { id: 'streak30', emoji: '🌌', title: 'Tripulante da Endurance', desc: '30 dias seguidos', earned: (p) => p.bestStreak >= 30 },
  { id: 'words50', emoji: '📡', title: 'Primeiros sinais', desc: '50 palavras vistas', earned: (p) => seen(p) >= 50 },
  { id: 'words150', emoji: '🧭', title: 'Navegador', desc: '150 palavras vistas', earned: (p) => seen(p) >= 150 },
  { id: 'words400', emoji: '🪐', title: 'Explorador de mundos', desc: '400 palavras vistas', earned: (p) => seen(p) >= 400 },
  { id: 'mastered50', emoji: '🌱', title: 'Plano A', desc: '50 palavras dominadas', earned: (p) => mastered(p) >= 50 },
  { id: 'mastered200', emoji: '🌍', title: 'Nova casa', desc: '200 palavras dominadas', earned: (p) => mastered(p) >= 200 },
  { id: 'combo10', emoji: '⚡', title: 'Velocidade de escape', desc: 'Combo de 10 acertos seguidos', earned: (p) => p.bestCombo >= 10 },
  { id: 'hour', emoji: '⏳', title: 'Uma hora em Miller', desc: '60 min de estudo (seriam 7 anos na Terra)', earned: (p) => minutes(p) >= 60 },
  { id: 'tenhours', emoji: '🕳️', title: 'Gargantua', desc: '10 horas de estudo (70 anos na Terra, se fosse em Miller)', earned: (p) => minutes(p) >= 600 },
  { id: 'chat1', emoji: '💬', title: 'Primeiro contato', desc: 'Concluir uma situação real', earned: (p) => Object.keys(p.situations).length > 0 },
  { id: 'chat3stars', emoji: '⭐', title: 'Pouso perfeito', desc: 'Uma situação com 3 estrelas', earned: (p) => Object.values(p.situations).some((r) => r.best >= 3) },
  { id: 'chatall', emoji: '🗺️', title: 'Viajante interestelar', desc: 'Concluir todas as situações', earned: (p) => situations.every((s) => p.situations[s.id]) },
  { id: 'cinema1', emoji: '🎬', title: 'Em cartaz', desc: 'Concluir uma cena de filme', earned: (p) => scenes.some((s) => p.situations[s.id]) },
  { id: 'cinemaall', emoji: '🍿', title: 'Maratona', desc: 'Concluir todas as cenas de filme', earned: (p) => scenes.every((s) => p.situations[s.id]) },
  { id: 'capsule1', emoji: '📼', title: 'Mensagem de Cooper', desc: 'Gravar a primeira mensagem da cápsula do tempo', earned: (p) => p.capsules.some((c) => c.kind === 'audio') },
  { id: 'capsule6', emoji: '🕰️', title: 'Seis meses depois', desc: 'Gravar as mensagens de seis meses diferentes', earned: (p) => new Set(p.capsules.filter((c) => c.kind === 'audio').map((c) => c.month)).size >= 6 },
  { id: 'metro', emoji: '🚇', title: 'Passageiro aplicado', desc: 'Completar as 3 etapas da Missão do metrô num dia', earned: (p) => p.today.done.length >= 3 },
  { id: 'story1', emoji: '📖', title: 'Diário de bordo', desc: 'Ler a primeira história', earned: (p) => Object.keys(p.stories).length > 0 },
  { id: 'storyall', emoji: '📚', title: 'Biblioteca da nave', desc: 'Ler todas as histórias', earned: (p) => stories.every((s) => p.stories[s.id]) },
  { id: 'ear10', emoji: '🎧', title: 'Ouvido afiado', desc: '10 rodadas de ditado ou shadowing', earned: (p) => p.ear.dictation + p.ear.shadowing >= 10 },
];

/** Medalhas conquistadas agora que ainda não estavam registradas. */
export function newMedals(p: Progress): Medal[] {
  return medals.filter((m) => !p.medals[m.id] && m.earned(p));
}

export function awardMedals(p: Progress, now: number): { progress: Progress; awarded: Medal[] } {
  const awarded = newMedals(p);
  if (awarded.length === 0) return { progress: p, awarded };
  const record = { ...p.medals };
  for (const m of awarded) record[m.id] = now;
  return { progress: { ...p, medals: record }, awarded };
}

