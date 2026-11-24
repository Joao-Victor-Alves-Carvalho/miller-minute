import { packOfItem } from '../data/galaxy';
import type { Mode } from './modes';
import type { Step } from './session';

/**
 * Viagem: cada sessão é um voo até um planeta, com uma lista de tarefas a bordo.
 * As tarefas são os próprios exercícios (recuperação ativa) com cara de jogo;
 * concluir todas leva ao pouso. Errar não falha a tarefa: a palavra só volta depois.
 */
export type TaskKind =
  | 'discover'
  | 'signal'
  | 'reply'
  | 'code'
  | 'radio'
  | 'log'
  | 'voice'
  | 'noise'
  | 'circuit'
  | 'fake'
  | 'diary'
  | 'engines';

export interface TaskInfo {
  emoji: string;
  /** Nome da tarefa na lista ("Consertar circuitos"). */
  title: string;
  /** Nome no topo da pergunta ("Conserte o circuito"). */
  mission: string;
  /** O exercício por trás, dito de forma simples. */
  how: string;
  /** Aviso quando todas desse tipo ficam prontas. */
  done: string;
}

export const TASKS: Record<TaskKind, TaskInfo> = {
  discover: { emoji: '✨', title: 'Catalogar descobertas', mission: 'Descoberta', how: 'Palavra nova', done: 'Descobertas catalogadas!' },
  signal: { emoji: '📡', title: 'Decodificar sinais', mission: 'Decodifique o sinal', how: 'O que significa?', done: 'Sinais decodificados!' },
  reply: { emoji: '🛰️', title: 'Responder à base', mission: 'Responda à base', how: 'Como se diz em inglês?', done: 'Base respondida!' },
  code: { emoji: '⌨️', title: 'Digitar códigos', mission: 'Digite o código', how: 'Escreva em inglês', done: 'Códigos digitados!' },
  radio: { emoji: '🎧', title: 'Escuta de rádio', mission: 'Escuta de rádio', how: 'Ouça e escolha o significado', done: 'Rádio sintonizado!' },
  log: { emoji: '🧩', title: 'Completar registros', mission: 'Complete o registro', how: 'Complete a frase', done: 'Registros completos!' },
  voice: { emoji: '🎙️', title: 'Comandos de voz', mission: 'Comando de voz', how: 'Fale em inglês', done: 'Comandos de voz aceitos!' },
  noise: { emoji: '📻', title: 'Limpar transmissões', mission: 'Transmissão com ruído', how: 'Ouça e escreva em inglês', done: 'Transmissões limpas!' },
  circuit: { emoji: '🔧', title: 'Consertar circuitos', mission: 'Conserte o circuito', how: 'Monte a frase em inglês', done: 'Circuitos consertados!' },
  fake: { emoji: '🚨', title: 'Achar sinais falsos', mission: 'Sinal falso', how: 'Ache a palavra errada', done: 'Sinais falsos encontrados!' },
  diary: { emoji: '📝', title: 'Escrever o diário de bordo', mission: 'Diário de bordo', how: 'Traduza a frase', done: 'Diário de bordo em dia!' },
  engines: { emoji: '⚙️', title: 'Alinhar os motores', mission: 'Alinhe os motores', how: 'Ligue cada palavra ao significado', done: 'Motores alinhados!' },
};

const BY_MODE: Record<Mode, TaskKind> = {
  'en-pt-choice': 'signal',
  'pt-en-choice': 'reply',
  'pt-en-type': 'code',
  'listen-choice': 'radio',
  'cloze-choice': 'log',
  speak: 'voice',
  'listen-type': 'noise',
  build: 'circuit',
  'spot-error': 'fake',
  translate: 'diary',
};

export function taskForMode(mode: Mode): TaskKind {
  return BY_MODE[mode];
}

/** Tarefa de um passo (o modo é o efetivo, depois de trocar áudio/microfone). */
export function taskOf(step: Step, mode: Mode = step.mode): TaskKind {
  if (step.kind === 'intro') return 'discover';
  if (step.kind === 'match') return 'engines';
  return taskForMode(mode);
}

export interface TaskLine {
  kind: TaskKind;
  total: number;
  done: number;
}

/** Lista de tarefas da viagem (repetições depois de um erro não contam como tarefa nova). */
export function planTasks(steps: readonly Step[], modeOf: (step: Step) => Mode = (s) => s.mode): TaskLine[] {
  const lines = new Map<TaskKind, TaskLine>();
  for (const step of steps) {
    if (step.retry) continue;
    const kind = taskOf(step, modeOf(step));
    const line = lines.get(kind) ?? { kind, total: 0, done: 0 };
    line.total += 1;
    lines.set(kind, line);
  }
  return [...lines.values()];
}

/** Marca uma tarefa feita. Devolve a lista nova e se aquele tipo acabou de ficar completo. */
export function tickTask(lines: readonly TaskLine[], kind: TaskKind): { lines: TaskLine[]; finished: boolean } {
  let finished = false;
  const next = lines.map((line) => {
    if (line.kind !== kind || line.done >= line.total) return line;
    const done = line.done + 1;
    if (done === line.total) finished = true;
    return { ...line, done };
  });
  return { lines: next, finished };
}

export function tasksDone(lines: readonly TaskLine[]): { done: number; total: number } {
  return lines.reduce((acc, l) => ({ done: acc.done + l.done, total: acc.total + l.total }), { done: 0, total: 0 });
}

/** Destino da viagem: o planeta (pacote) que mais aparece na sessão. */
export function destinationOf(itemIds: readonly string[], fallback = 'p1'): string {
  const count = new Map<string, number>();
  for (const id of itemIds) {
    const pack = packOfItem(id);
    count.set(pack, (count.get(pack) ?? 0) + 1);
  }
  let best = fallback;
  let max = 0;
  for (const [pack, n] of count) {
    if (n > max) {
      best = pack;
      max = n;
    }
  }
  return best;
}
