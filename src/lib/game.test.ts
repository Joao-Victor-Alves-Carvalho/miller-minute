import { describe, expect, it } from 'vitest';
import { crewChapters, crewOpen } from '../data/crew';
import { packOfItem, planetFor } from '../data/galaxy';
import { pack1 } from '../data/pack1';
import { packs } from '../data/packs';
import { skyOf, starDots } from './galaxy';
import { awardFinds, cosmetic, cosmetics, equip, owned } from './hangar';
import { emptyProgress, finishVoyage, normalizeProgress } from './progress';
import { buildSession, scheduleRetry, type Step } from './session';
import { DAY, newCard } from './srs';
import { destinationOf, planTasks, TASKS, taskForMode, tasksDone, tickTask } from './voyage';

const NOW = Date.UTC(2026, 10, 24, 12);

function seeded(seed = 3): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('viagem e tarefas', () => {
  it('cada tipo de exercício vira uma tarefa com nome de jogo', () => {
    expect(taskForMode('build')).toBe('circuit');
    expect(taskForMode('listen-type')).toBe('noise');
    for (const info of Object.values(TASKS)) {
      expect(info.title.length).toBeGreaterThan(3);
      expect(info.emoji).toBeTruthy();
    }
  });

  it('lista de tarefas cobre a sessão inteira e repetições não contam', () => {
    const steps = buildSession([], pack1.items.slice(0, 5), {}, seeded());
    const lines = planTasks(steps);
    expect(tasksDone(lines).total).toBe(steps.length);
    expect(lines.find((l) => l.kind === 'discover')?.total).toBe(5);
    expect(lines.find((l) => l.kind === 'engines')?.total).toBe(1);
    const withRetry = scheduleRetry(steps, 6, steps[6] as Step);
    expect(tasksDone(planTasks(withRetry)).total).toBe(steps.length);
  });

  it('tarefa marcada avisa quando o tipo fica completo', () => {
    let lines = planTasks([
      { itemId: 'p1:a', kind: 'quiz', graded: true, mode: 'build' },
      { itemId: 'p1:b', kind: 'quiz', graded: true, mode: 'build' },
    ]);
    let r = tickTask(lines, 'circuit');
    expect(r.finished).toBe(false);
    lines = r.lines;
    r = tickTask(lines, 'circuit');
    expect(r.finished).toBe(true);
    expect(tickTask(r.lines, 'circuit').lines).toEqual(r.lines); // não passa do total
  });

  it('destino é o planeta que mais aparece', () => {
    expect(destinationOf(['p1:a', 'p2:b', 'p2:c'])).toBe('p2');
    expect(destinationOf([])).toBe('p1');
    expect(packOfItem('viagem:hotel')).toBe('viagem');
  });

  it('pouso soma viagens e tarefas e guarda o primeiro pouso', () => {
    let p = finishVoyage(emptyProgress(), 'p1', [{ kind: 'circuit', done: 2 }, { kind: 'signal', done: 0 }], NOW);
    p = finishVoyage(p, 'p1', [{ kind: 'circuit', done: 3 }], NOW + DAY);
    expect(p.voyage.trips).toBe(2);
    expect(p.voyage.tasks.circuit).toBe(5);
    expect(p.voyage.tasks.signal).toBeUndefined();
    expect(p.voyage.landed.p1).toBe(NOW);
  });

  it('todo pacote tem um planeta', () => {
    for (const pack of packs) expect(planetFor(pack).name).toBeTruthy();
    expect(planetFor({ id: 'p9', title: 'Futuro' }).name).toBe('Futuro');
  });
});

describe('galáxia', () => {
  it('estrelas: dominadas, acesas, apagando e por descobrir', () => {
    const items = pack1.items;
    const cards = {
      [items[0]!.id]: { ...newCard(NOW), box: 5, due: NOW + 10 * DAY },
      [items[1]!.id]: { ...newCard(NOW), box: 2, due: NOW + DAY },
      [items[2]!.id]: { ...newCard(NOW), box: 2, due: NOW - DAY },
    };
    const sky = skyOf(pack1, cards, NOW);
    expect(sky).toMatchObject({ mastered: 1, lit: 1, dim: 1, unseen: items.length - 3 });
    const dots = starDots(sky, 48);
    expect(dots.length).toBeLessThanOrEqual(48);
    expect(dots).toContain('dim');
    expect(dots).toContain('mastered');
  });
});

describe('hangar', () => {
  it('começa com uma nave, um traje e um céu, sem avisos de achado', () => {
    const p = emptyProgress();
    expect(awardFinds(p, NOW).found).toHaveLength(0);
    expect(cosmetic(p.hangar.ship, 'ship').starter).toBe(true);
    expect(cosmetic('nao-existe', 'theme').id).toBe('espaco');
  });

  it('achados vêm de ações de aprendizado e só são avisados uma vez', () => {
    let p = emptyProgress();
    p = { ...p, voyage: { ...p.voyage, trips: 3, tasks: { circuit: 10 } } };
    const first = awardFinds(p, NOW);
    expect(first.found.map((c) => c.id).sort()).toEqual(['lander', 'ranger']);
    expect(awardFinds(first.progress, NOW).found).toHaveLength(0);
  });

  it('só usa o que já está no hangar', () => {
    const p = emptyProgress();
    const ranger = cosmetics.find((c) => c.id === 'ranger')!;
    expect(owned(p, ranger)).toBe(false);
    expect(equip(p, ranger).hangar.ship).toBe('endurance');
    const withRanger = { ...p, hangar: { ...p.hangar, found: { ranger: NOW } } };
    expect(equip(withRanger, ranger).hangar.ship).toBe('ranger');
  });

  it('ids únicos por tipo', () => {
    for (const kind of ['ship', 'suit', 'theme'] as const) {
      const ids = cosmetics.filter((c) => c.kind === kind).map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('progresso antigo ganha viagem e hangar padrão', () => {
    const old = normalizeProgress({ streak: 2 } as never);
    expect(old.voyage.trips).toBe(0);
    expect(old.hangar.ship).toBe('endurance');
  });
});

describe('diário da tripulação', () => {
  it('8 capítulos em ordem, com tradução e 3 perguntas com uma certa', () => {
    expect(crewChapters).toHaveLength(8);
    const unlocks = crewChapters.map((c) => c.unlockAt);
    expect([...unlocks].sort((a, b) => a - b)).toEqual(unlocks);
    for (const c of crewChapters) {
      expect(c.sentences.every((s) => s.en && s.pt)).toBe(true);
      expect(c.questions).toHaveLength(3);
      for (const q of c.questions) expect(q.options.filter((o) => o.ok)).toHaveLength(1);
    }
  });

  it('capítulos liberam com as viagens', () => {
    expect(crewOpen(0)).toHaveLength(1);
    expect(crewOpen(4)).toHaveLength(3);
    expect(crewOpen(100)).toHaveLength(8);
  });
});
