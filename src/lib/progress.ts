import type { TaskKind } from './voyage';
import type { Item, Pack } from '../data/types';
import type { SituationRecord } from './chat';
import { DAY, dayKey, isMastered, startOfDay, type CardState } from './srs';

export interface Settings {
  autoAudio: boolean;
  sounds: boolean;
  newPerDay: number;
  /** Meta diária de estudo, em minutos. */
  goalMinutes: number;
  /** Pacote de onde vêm as palavras novas (null = seguir a ordem). */
  focusPack: string | null;
  /** Horário do lembrete diário ("HH:MM"). */
  reminder: string;
}

export interface DayStats {
  answers: number;
  correct: number;
  newItems: number;
  /** Tempo de estudo no dia (ms). Ausente em dias antigos. */
  ms?: number;
}

export type PauseKind = 'audio' | 'mic';
export const PAUSE_MINUTES = 15;

export interface Progress {
  version: 1;
  cards: Record<string, CardState>;
  streak: number;
  /** Último dia (chave local) com sessão concluída. */
  lastStudyDay: string | null;
  newToday: { day: string; count: number };
  totalAnswers: number;
  totalCorrect: number;
  bestCombo: number;
  settings: Settings;
  /** Até quando (ms) perguntas de áudio / microfone ficam escondidas. */
  pauses: Record<PauseKind, number>;
  /** Histórico por dia (chave "AAAA-MM-DD"). */
  history: Record<string, DayStats>;
  /** Situações concluídas: quantas vezes e melhor número de estrelas. */
  situations: Record<string, SituationRecord>;
  /** Histórias lidas: quantas vezes e melhor nota (acertos nas perguntas). */
  stories: Record<string, SituationRecord>;
  /** Treino de ouvido: rodadas de ditado e de shadowing concluídas. */
  ear: { dictation: number; shadowing: number };
  /** Tempo total de estudo (ms). */
  totalMs: number;
  /** Maior sequência de dias já alcançada. */
  bestStreak: number;
  /** Medalhas conquistadas: id → quando (ms). */
  medals: Record<string, number>;
  /** Palavras novas extras liberadas hoje pelo botão "+6". */
  bonusNew: { day: string; count: number };
  /** Atividades concluídas hoje (para a Missão do metrô). */
  today: { day: string; done: Activity[] };
  /** Cápsula do tempo: gravações feitas (o áudio fica no IndexedDB do aparelho). */
  capsules: CapsuleEntry[];
  /** "Minhas frases": cartões criados pela IA a partir das suas conversas e textos. */
  custom: Item[];
  /** Fila da IA: textos escritos (inclusive offline) esperando correção. */
  aiQueue: AiJob[];
  /** Chamadas da Endurance concluídas. */
  calls: { done: number; lastAt: number };
  /** Confusões do aprendiz: id do item → ids que ele já escolheu no lugar (mais recente primeiro). */
  confusions: Record<string, string[]>;
  /** Viagens: quantas, tarefas feitas por tipo e primeiro pouso em cada planeta (id → ms). */
  voyage: { trips: number; tasks: Partial<Record<TaskKind, number>>; landed: Record<string, number> };
  /** Hangar: achados (id → quando) e o que está em uso. */
  hangar: { found: Record<string, number>; ship: string; suit: string; theme: string };
}

export interface AiMistake {
  said: string;
  better: string;
  why_pt: string;
}

export type AiJob =
  | { id: string; kind: 'diary'; text: string; at: number; status: 'pending' | 'done' | 'error'; error?: string; result?: { corrected: string; natural: string; mistakes: AiMistake[]; tip_pt: string } }
  | { id: string; kind: 'phrase'; text: string; context?: string; at: number; status: 'pending' | 'done' | 'error'; error?: string; result?: { en: string; pt: string; explanation_pt: string; example: string } };

export type Activity = 'session' | 'story' | 'ear' | 'chat' | 'call';

export interface CapsuleEntry {
  /** Id da gravação no IndexedDB. */
  id: string;
  /** Mês da missão (1 a 6+). */
  month: number;
  at: number;
  durationMs: number;
  /** Vídeo é salvo na galeria; aqui fica só o registro. */
  kind: 'audio' | 'video';
}

/** Fração do pacote anterior que precisa ter sido VISTA para liberar o próximo. */
export const UNLOCK_RATIO = 0.8;
/** Palavras extras por toque no botão "Quero mais palavras". */
export const BONUS_STEP = 6;

export function emptyProgress(): Progress {
  return {
    version: 1,
    cards: {},
    streak: 0,
    lastStudyDay: null,
    newToday: { day: '', count: 0 },
    totalAnswers: 0,
    totalCorrect: 0,
    bestCombo: 0,
    settings: { autoAudio: true, sounds: true, newPerDay: 20, goalMinutes: 10, focusPack: null, reminder: '20:00' },
    pauses: { audio: 0, mic: 0 },
    history: {},
    situations: {},
    stories: {},
    ear: { dictation: 0, shadowing: 0 },
    totalMs: 0,
    bestStreak: 0,
    medals: {},
    bonusNew: { day: '', count: 0 },
    today: { day: '', done: [] },
    capsules: [],
    custom: [],
    aiQueue: [],
    calls: { done: 0, lastAt: 0 },
    confusions: {},
    voyage: { trips: 0, tasks: {}, landed: {} },
    hangar: { found: {}, ship: 'endurance', suit: 'classico', theme: 'espaco' },
  };
}

export function masteredRatio(pack: Pack, cards: Readonly<Record<string, CardState>>): number {
  if (pack.items.length === 0) return 1;
  const done = pack.items.filter((item) => isMastered(cards[item.id])).length;
  return done / pack.items.length;
}

/** Palavras vistas para liberar os pacotes temáticos. */
export const THEME_UNLOCK_SEEN = 60;

/** Fração do pacote já vista (palavras que apareceram pelo menos uma vez). */
export function seenRatio(pack: Pack, cards: Readonly<Record<string, CardState>>): number {
  if (pack.items.length === 0) return 1;
  return pack.items.filter((item) => cards[item.id]).length / pack.items.length;
}

/**
 * Pacotes liberados: o primeiro principal sempre; cada principal seguinte quando 80% do
 * anterior já foi VISTO (as revisões continuam pelo FSRS, sem travar as palavras novas).
 * Os temáticos liberam com 60 palavras vistas.
 */
export function unlockedPacks(packs: readonly Pack[], cards: Readonly<Record<string, CardState>>): Pack[] {
  const out: Pack[] = [];
  let open = true;
  for (const pack of packs.filter((p) => p.kind === 'core')) {
    if (!open) break;
    out.push(pack);
    open = seenRatio(pack, cards) >= UNLOCK_RATIO;
  }
  if (Object.keys(cards).length >= THEME_UNLOCK_SEEN) out.push(...packs.filter((p) => p.kind === 'theme'));
  // "Minhas frases" fica sempre liberado quando tiver itens.
  out.push(...packs.filter((p) => p.kind === 'mine' && p.items.length > 0));
  return out;
}

/** Itens novos na ordem certa: primeiro os do pacote em foco, depois o resto. */
export function orderByFocus<T extends { id: string }>(items: readonly T[], focusPack: string | null): T[] {
  if (!focusPack) return [...items];
  const prefix = `${focusPack}:`;
  return [...items.filter((i) => i.id.startsWith(prefix)), ...items.filter((i) => !i.id.startsWith(prefix))];
}

export function newAllowedToday(progress: Progress, now: number): number {
  const today = dayKey(now);
  const used = progress.newToday.day === today ? progress.newToday.count : 0;
  const bonus = progress.bonusNew.day === today ? progress.bonusNew.count : 0;
  return Math.max(0, progress.settings.newPerDay + bonus - used);
}

/** Libera mais palavras novas hoje (botão "Quero mais palavras"). */
export function addBonusNew(progress: Progress, now: number, count = BONUS_STEP): Progress {
  const today = dayKey(now);
  const base = progress.bonusNew.day === today ? progress.bonusNew.count : 0;
  return { ...progress, bonusNew: { day: today, count: base + count } };
}

/** Marca uma atividade como feita hoje. */
export function markActivity(progress: Progress, now: number, activity: Activity): Progress {
  const today = dayKey(now);
  const done = progress.today.day === today ? progress.today.done : [];
  if (done.includes(activity)) return progress.today.day === today ? progress : { ...progress, today: { day: today, done } };
  return { ...progress, today: { day: today, done: [...done, activity] } };
}

export function doneToday(progress: Progress, now: number): Activity[] {
  return progress.today.day === dayKey(now) ? progress.today.done : [];
}

/** Sequência de dias: mantém se estudou ontem, zera se pulou um dia. */
export function currentStreak(progress: Progress, now: number): number {
  if (!progress.lastStudyDay) return 0;
  const today = dayKey(now);
  const yesterday = dayKey(startOfDay(now) - DAY / 2);
  return progress.lastStudyDay === today || progress.lastStudyDay === yesterday ? progress.streak : 0;
}

export function registerStudyDay(progress: Progress, now: number): Progress {
  const today = dayKey(now);
  if (progress.lastStudyDay === today) return progress;
  const streak = currentStreak(progress, now) + 1;
  return { ...progress, streak, bestStreak: Math.max(progress.bestStreak, streak), lastStudyDay: today };
}

export function registerNewItems(progress: Progress, now: number, count: number): Progress {
  const today = dayKey(now);
  const base = progress.newToday.day === today ? progress.newToday.count : 0;
  const day = progress.history[today] ?? { answers: 0, correct: 0, newItems: 0 };
  return {
    ...progress,
    newToday: { day: today, count: base + count },
    history: { ...progress.history, [today]: { ...day, newItems: day.newItems + count } },
  };
}

/** Soma a resposta no total e no histórico do dia. */
export function recordAnswer(progress: Progress, now: number, correct: boolean): Progress {
  const today = dayKey(now);
  const day = progress.history[today] ?? { answers: 0, correct: 0, newItems: 0 };
  return {
    ...progress,
    totalAnswers: progress.totalAnswers + 1,
    totalCorrect: progress.totalCorrect + (correct ? 1 : 0),
    history: { ...progress.history, [today]: { ...day, answers: day.answers + 1, correct: day.correct + (correct ? 1 : 0) } },
  };
}

/** Soma tempo de estudo no total e no dia. */
export function addStudyTime(progress: Progress, now: number, ms: number): Progress {
  if (ms <= 0) return progress;
  const today = dayKey(now);
  const day = progress.history[today] ?? { answers: 0, correct: 0, newItems: 0 };
  return {
    ...progress,
    totalMs: progress.totalMs + ms,
    history: { ...progress.history, [today]: { ...day, ms: (day.ms ?? 0) + ms } },
  };
}

export function todayMs(progress: Progress, now: number): number {
  return progress.history[dayKey(now)]?.ms ?? 0;
}

/** Registra uma história lida (conta como dia de estudo). */
export function completeStory(progress: Progress, id: string, score: number, now: number): Progress {
  const prev = progress.stories[id] ?? { done: 0, best: 0 };
  const next = { ...progress, stories: { ...progress.stories, [id]: { done: prev.done + 1, best: Math.max(prev.best, score) } } };
  return markActivity(registerStudyDay(next, now), now, 'story');
}

/** Registra uma rodada de ditado ou shadowing (conta como dia de estudo). */
export function completeEar(progress: Progress, kind: 'dictation' | 'shadowing', now: number): Progress {
  return markActivity(registerStudyDay({ ...progress, ear: { ...progress.ear, [kind]: progress.ear[kind] + 1 } }, now), now, 'ear');
}

/** Registra uma situação concluída (conta como dia de estudo). */
export function completeSituation(progress: Progress, id: string, stars: number, now: number): Progress {
  const prev = progress.situations[id] ?? { done: 0, best: 0 };
  const next = { ...progress, situations: { ...progress.situations, [id]: { done: prev.done + 1, best: Math.max(prev.best, stars) } } };
  return markActivity(registerStudyDay(next, now), now, 'chat');
}

/** Esconde perguntas de áudio ou microfone por 15 minutos. */
export function pause(progress: Progress, kind: PauseKind, now: number): Progress {
  return { ...progress, pauses: { ...progress.pauses, [kind]: now + PAUSE_MINUTES * 60_000 } };
}

export function resume(progress: Progress, kind: PauseKind): Progress {
  return { ...progress, pauses: { ...progress.pauses, [kind]: 0 } };
}

/** Minutos restantes de pausa (0 = ativo). */
export function pausedMinutes(progress: Progress, kind: PauseKind, now: number): number {
  const until = progress.pauses[kind];
  return until > now ? Math.ceil((until - now) / 60_000) : 0;
}

export function capabilities(
  progress: Progress,
  now: number,
  support: { speech: boolean; recognition: boolean },
): { audio: boolean; mic: boolean } {
  return {
    audio: support.speech && pausedMinutes(progress, 'audio', now) === 0,
    mic: support.recognition && pausedMinutes(progress, 'mic', now) === 0,
  };
}

// Chave antiga (nome provisório "Loop"): não mudar, senão o progresso salvo se perde.
const STORAGE_KEY = 'loop-english:v1';

/** Completa um progresso salvo (ou importado) com os campos que faltam. */
export function normalizeProgress(parsed: Partial<Progress>): Progress {
  const base = emptyProgress();
  return {
    ...base,
    ...parsed,
    version: 1,
    cards: { ...parsed.cards },
    pauses: { ...base.pauses, ...parsed.pauses },
    history: { ...parsed.history },
    situations: { ...parsed.situations },
    stories: { ...parsed.stories },
    ear: { ...base.ear, ...parsed.ear },
    totalMs: typeof parsed.totalMs === 'number' ? parsed.totalMs : 0,
    bestStreak: Math.max(parsed.bestStreak ?? 0, parsed.streak ?? 0),
    medals: { ...parsed.medals },
    // 12 era o padrão antigo de palavras novas por dia: sobe para o novo padrão (20).
    settings: { ...base.settings, ...parsed.settings, newPerDay: parsed.settings?.newPerDay === 12 ? 20 : (parsed.settings?.newPerDay ?? base.settings.newPerDay) },
    bonusNew: { ...base.bonusNew, ...parsed.bonusNew },
    today: { ...base.today, ...parsed.today },
    capsules: Array.isArray(parsed.capsules) ? parsed.capsules : [],
    custom: Array.isArray(parsed.custom) ? parsed.custom : [],
    aiQueue: Array.isArray(parsed.aiQueue) ? parsed.aiQueue : [],
    calls: { ...base.calls, ...parsed.calls },
    confusions: { ...parsed.confusions },
    voyage: { ...base.voyage, ...parsed.voyage, tasks: { ...parsed.voyage?.tasks }, landed: { ...parsed.voyage?.landed } },
    hangar: { ...base.hangar, ...parsed.hangar, found: { ...parsed.hangar?.found } },
  };
}

/** Fim de uma viagem: soma as tarefas feitas e registra o pouso no planeta. */
export function finishVoyage(p: Progress, planetId: string, tasks: readonly { kind: TaskKind; done: number }[], now: number): Progress {
  const sum = { ...p.voyage.tasks };
  for (const t of tasks) if (t.done > 0) sum[t.kind] = (sum[t.kind] ?? 0) + t.done;
  const landed = p.voyage.landed[planetId] ? p.voyage.landed : { ...p.voyage.landed, [planetId]: now };
  return { ...p, voyage: { trips: p.voyage.trips + 1, tasks: sum, landed } };
}

/** Quantas confusões guardar por item. */
export const MAX_CONFUSIONS = 5;

/** Registra que `otherId` foi escolhido no lugar de `itemId` (volta como alternativa difícil). */
export function addConfusion(p: Progress, itemId: string, otherId: string): Progress {
  if (itemId === otherId) return p;
  const list = [otherId, ...(p.confusions[itemId] ?? []).filter((id) => id !== otherId)].slice(0, MAX_CONFUSIONS);
  return { ...p, confusions: { ...p.confusions, [itemId]: list } };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    return normalizeProgress(JSON.parse(raw) as Partial<Progress>);
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Sem armazenamento (aba anônima, por exemplo): o app segue funcionando nesta sessão.
  }
}

/** Id estável de uma frase sua (o texto em inglês forma o id, como nos pacotes). */
export function customId(en: string): string {
  const slug = en
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `mine:${slug || 'frase'}`;
}

/**
 * Adiciona frases suas ao pacote "Minhas frases", sem repetir (nem com itens já existentes).
 * `asMistake` coloca a frase no caderno de erros (veio de um erro seu).
 */
export function addCustomItems(
  progress: Progress,
  items: { en: string; pt: string; ex?: string; exPt?: string }[],
  now: number,
  asMistake = false,
): Progress {
  const known = new Set(progress.custom.map((i) => i.id));
  const fresh: Item[] = [];
  const cards = { ...progress.cards };
  for (const it of items) {
    const en = it.en.trim();
    const pt = it.pt.trim();
    if (!en || !pt) continue;
    const id = customId(en);
    if (known.has(id)) continue;
    known.add(id);
    const item: Item = { id, en, pt, pos: en.includes(' ') ? 'frase' : 'substantivo' };
    if (it.ex) item.ex = it.ex;
    if (it.exPt) item.exPt = it.exPt;
    fresh.push(item);
    if (asMistake) cards[id] = { box: 0, due: now, correct: 0, wrong: 1, lastSeen: now, lastWrong: now };
  }
  if (fresh.length === 0) return progress;
  return { ...progress, custom: [...progress.custom, ...fresh], cards };
}
