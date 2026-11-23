/**
 * Cápsula do tempo ("Mensagens de Cooper"): uma mensagem em inglês por mês para o seu eu do
 * futuro. A mesma pergunta-base todo mês deixa a comparação justa; cada mês tem um extra.
 */
import type { CapsuleEntry } from './progress';
import { DAY } from './srs';

export const MONTH_MS = 30 * DAY;
/** Tempo máximo de cada gravação. */
export const MAX_RECORDING_MS = 3 * 60_000;

export interface CapsulePrompt {
  en: string;
  pt: string;
}

/** Pergunta-base (igual todo mês, para comparar). */
export const BASE_PROMPT: CapsulePrompt = {
  en: 'Introduce yourself: your name, where you live, what you do, and why you are learning English.',
  pt: 'Apresente-se: seu nome, onde mora, o que faz e por que está aprendendo inglês.',
};

/** Extra de cada mês (o 6º repete o tom do 1º para o "antes e depois"). */
export const MONTH_EXTRAS: CapsulePrompt[] = [
  { en: 'What do you hope to do with English in six months?', pt: 'O que você espera fazer com o inglês daqui a seis meses?' },
  { en: 'Describe your typical day, from morning to night.', pt: 'Descreva um dia típico seu, da manhã à noite.' },
  { en: 'Talk about a movie or series you like and why.', pt: 'Fale de um filme ou série que você gosta e por quê.' },
  { en: 'Tell a short story about a trip or a funny moment.', pt: 'Conte uma história curta sobre uma viagem ou um momento engraçado.' },
  { en: 'Explain your work with AI videos to someone from another country.', pt: 'Explique o seu trabalho com vídeos de IA para alguém de outro país.' },
  { en: 'Talk to your past self: what changed in these six months?', pt: 'Fale com o seu eu do passado: o que mudou nesses seis meses?' },
];

export function promptForMonth(month: number): CapsulePrompt {
  return MONTH_EXTRAS[Math.min(month, MONTH_EXTRAS.length) - 1] ?? MONTH_EXTRAS[MONTH_EXTRAS.length - 1]!;
}

export interface CapsuleStatus {
  /** Mês atual da missão (1, 2, 3…). */
  month: number;
  /** Já existe áudio deste mês? */
  recorded: boolean;
  /** Dias até o próximo mês (quando o atual já foi gravado). */
  daysToNext: number;
}

/** O mês conta a partir da primeira gravação; sem gravações, estamos no mês 1. */
export function capsuleStatus(capsules: readonly CapsuleEntry[], now: number): CapsuleStatus {
  const audios = capsules.filter((c) => c.kind === 'audio');
  if (audios.length === 0) return { month: 1, recorded: false, daysToNext: 0 };
  const first = Math.min(...audios.map((c) => c.at));
  const month = Math.floor((now - first) / MONTH_MS) + 1;
  const recorded = audios.some((c) => c.month === month);
  const nextStart = first + month * MONTH_MS;
  return { month, recorded, daysToNext: Math.max(0, Math.ceil((nextStart - now) / DAY)) };
}

/** Primeira e última gravação de áudio (para "antes e agora"). */
export function beforeAndNow(capsules: readonly CapsuleEntry[]): [CapsuleEntry, CapsuleEntry] | null {
  const audios = capsules.filter((c) => c.kind === 'audio').sort((a, b) => a.at - b.at);
  if (audios.length < 2) return null;
  return [audios[0]!, audios[audios.length - 1]!];
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
