/**
 * Missão do metrô: 3 etapas que funcionam sem internet (30 a 40 min).
 * 1) sessão de revisões e palavras novas; 2) uma história; 3) ditado ou uma conversa (alternando).
 */
import type { Situation, SituationRecord } from './chat';
import { doneToday, type Activity, type Progress } from './progress';
import { dayKey } from './srs';

export interface MetroStep {
  activity: Activity;
  title: string;
  desc: string;
  minutes: number;
  /** Id da história ou da conversa sugerida (quando houver). */
  targetId?: string;
  done: boolean;
}

interface Unlockable {
  id: string;
  unlockAt: number;
}

/** Próximo item liberado: o primeiro ainda não feito; se todos foram feitos, o feito menos vezes. */
export function pickNext<T extends Unlockable>(list: readonly T[], records: Readonly<Record<string, SituationRecord>>, seenWords: number): T | undefined {
  const open = list.filter((x) => seenWords >= x.unlockAt);
  return open.find((x) => !records[x.id]) ?? [...open].sort((a, b) => (records[a.id]?.done ?? 0) - (records[b.id]?.done ?? 0))[0];
}

export function buildMetroPlan(
  progress: Progress,
  now: number,
  content: { stories: (Unlockable & { title: string })[]; chats: Situation[]; audioOk: boolean },
): MetroStep[] {
  const done = doneToday(progress, now);
  const seen = Object.keys(progress.cards).length;
  const story = pickNext(content.stories, progress.stories, seen);
  const chat = pickNext(content.chats, progress.situations, seen);
  // Alterna a 3ª etapa por dia: dias pares ditado (se houver áudio), ímpares uma conversa.
  const dayNumber = Number(dayKey(now).slice(-2));
  const earDay = content.audioOk && dayNumber % 2 === 0;

  const steps: MetroStep[] = [
    { activity: 'session', title: 'Revisões + palavras novas', desc: 'Sua sessão do dia, com as palavras que vencem hoje.', minutes: 15, done: done.includes('session') },
  ];
  if (story) {
    steps.push({ activity: 'story', title: `História: ${story.title}`, desc: 'Ouça e leia, depois responda 3 perguntas.', minutes: 10, targetId: story.id, done: done.includes('story') });
  }
  if (earDay || !chat) {
    steps.push({ activity: 'ear', title: 'Ditado', desc: 'Ouça 6 frases e escreva o que ouviu.', minutes: 10, done: done.includes('ear') });
  } else {
    steps.push({ activity: 'chat', title: `${chat.emoji} ${chat.title}`, desc: 'Uma conversa completa, do começo ao fim.', minutes: 10, targetId: chat.id, done: done.includes('chat') });
  }
  return steps;
}
