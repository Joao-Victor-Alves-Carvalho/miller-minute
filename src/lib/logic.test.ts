import { describe, expect, it } from 'vitest';
import { packs } from '../data/packs';
import { pack1 } from '../data/pack1';
import type { Item, Pack } from '../data/types';
import { checkTyped, normalize } from './answer';
import { buildChoices } from './choices';
import {
  currentStreak,
  emptyProgress,
  newAllowedToday,
  registerNewItems,
  registerStudyDay,
  unlockedPacks,
  orderByFocus,
} from './progress';
import { buildSession, dueItems, scheduleRetry, unseenItems, type Step } from './session';
import { DAY, grade, isMastered, MAX_BOX, newCard, previewDays, startOfDay, type CardState } from './srs';
import { answerField, clozeParts, modeFor, resolveMode } from './modes';
import { matchSpoken } from './answer';
import { explain } from './explain';
import { notes } from '../data/notes';
import { capabilities, pause, pausedMinutes, recordAnswer, resume } from './progress';

/** Gerador pseudoaleatório determinístico para os testes. */
function seeded(seed = 42): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const NOW = new Date(2026, 10, 20, 20, 0, 0).getTime();

describe('conteúdo', () => {
  const all = packs.flatMap((p) => p.items);

  it('o pacote 1 tem 300+ itens', () => {
    expect(pack1.items.length).toBeGreaterThanOrEqual(300);
    expect(pack1.items.length).toBeLessThanOrEqual(400);
  });

  it('ids, textos em inglês e traduções são únicos', () => {
    expect(new Set(all.map((i) => i.id)).size).toBe(all.length);
    expect(new Set(all.map((i) => i.en.toLowerCase())).size).toBe(all.length);
    expect(new Set(all.map((i) => i.pt.toLowerCase())).size).toBe(all.length);
  });

  it('exemplo e tradução do exemplo andam juntos', () => {
    for (const item of all) {
      expect(Boolean(item.ex), item.en).toBe(Boolean(item.exPt));
    }
  });
});

describe('Leitner', () => {
  it('acerto sobe a caixa e agenda pelo FSRS, contando do início do dia', () => {
    const card = grade(newCard(NOW), true, NOW);
    expect(card.box).toBe(1);
    expect(card.due).toBeGreaterThanOrEqual(startOfDay(NOW) + DAY);
    expect((card.due - startOfDay(card.due))).toBe(0);
    expect(card.mem?.s).toBeGreaterThan(1);
  });

  it('intervalos crescem a cada acerto e a nota muda o intervalo', () => {
    let card = grade(newCard(NOW), 'good', NOW);
    const first = card.due - startOfDay(NOW);
    card = grade(card, 'good', card.due);
    const second = card.due - startOfDay(card.mem!.last);
    expect(second).toBeGreaterThan(first);
    const base = grade(newCard(NOW), 'good', NOW);
    const days = previewDays(base, base.due);
    expect(days.hard).toBeLessThanOrEqual(days.good);
    expect(days.good).toBeLessThan(days.easy);
  });

  it('erro registra o lapso, baixa a estabilidade e marca o caderno de erros', () => {
    let card = grade(newCard(NOW), 'good', NOW);
    card = grade(card, 'good', card.due);
    const before = card.mem!.s;
    const wrong = grade(card, 'again', card.due + DAY);
    expect(wrong.mem!.s).toBeLessThan(before);
    expect(wrong.mem!.lapses).toBe(1);
    expect(wrong.lastWrong).toBe(card.due + DAY);
    expect(wrong.due).toBe(card.due + DAY);
  });

  it('migra cartões do sistema antigo (sem memória FSRS)', () => {
    const old: CardState = { box: 4, due: NOW - DAY, correct: 4, wrong: 1, lastSeen: NOW - 8 * DAY };
    const next = grade(old, 'good', NOW);
    expect(next.box).toBe(5);
    expect(next.due - startOfDay(NOW)).toBeGreaterThanOrEqual(7 * DAY);
    expect(next.mem?.reps).toBe(6);
  });

  it('erro desce uma caixa e deixa o item pendente na hora', () => {
    const card: CardState = { box: 3, due: NOW, correct: 3, wrong: 0, lastSeen: NOW };
    const after = grade(card, false, NOW);
    expect(after.box).toBe(2);
    expect(after.due).toBe(NOW);
    expect(grade(newCard(NOW), false, NOW).box).toBe(0);
  });

  it('a caixa não passa do máximo', () => {
    let card = newCard(NOW);
    for (let i = 0; i < 20; i++) card = grade(card, true, NOW);
    expect(card.box).toBe(MAX_BOX);
    expect(isMastered(card)).toBe(true);
  });

  it('o tipo de pergunta evolui com a caixa', () => {
    const item = pack1.items.find((i) => i.en === 'remember')!;
    expect(modeFor(0, 0, item)).toBe('en-pt-choice');
    expect(modeFor(0, 2, item)).toBe('listen-choice');
    expect(modeFor(2, 0, item)).toBe('pt-en-choice');
    expect(modeFor(2, 1, item)).toBe('cloze-choice');
    expect(modeFor(2, 3, item)).toBe('speak');
    expect(modeFor(4, 0, item)).toBe('pt-en-type');
  });
});

describe('sessão', () => {
  const items = pack1.items.slice(0, 30);

  it('item novo é apresentado antes de ser perguntado', () => {
    const steps = buildSession([], items.slice(0, 4), {}, seeded());
    for (const item of items.slice(0, 4)) {
      const intro = steps.findIndex((s) => s.itemId === item.id && s.kind === 'intro');
      const quiz = steps.findIndex((s) => s.itemId === item.id && s.kind === 'quiz' && s.graded);
      expect(intro).toBeGreaterThanOrEqual(0);
      expect(quiz).toBeGreaterThan(intro);
    }
  });

  it('cada item é avaliado uma vez e os novos repetem na fixação', () => {
    const cards: Record<string, CardState> = {};
    const reviews = items.slice(10, 18);
    for (const r of reviews) cards[r.id] = { ...newCard(NOW - DAY), box: 2, due: NOW - 1 };
    const fresh = items.slice(0, 5);
    const steps = buildSession(reviews, fresh, cards, seeded());
    const graded = steps.filter((s) => s.graded).map((s) => s.itemId);
    expect(new Set(graded).size).toBe(graded.length);
    expect(graded.length).toBe(reviews.length + fresh.length);
    const practice = steps.filter((s) => s.kind === 'quiz' && !s.graded);
    expect(practice.map((s) => s.itemId).sort()).toEqual(fresh.map((f) => f.id).sort());
    const reviewStep = steps.find((s) => s.itemId === reviews[0]?.id);
    expect(['pt-en-choice', 'cloze-choice', 'listen-choice', 'speak']).toContain(reviewStep?.mode);
  });

  it('respeita os limites de revisões e de novos', () => {
    const steps = buildSession(items, items, {}, seeded(), { maxReviews: 5, maxNew: 3, newGap: 2 });
    expect(steps.filter((s) => s.kind === 'intro')).toHaveLength(3);
  });

  it('erro reagenda o item alguns passos depois, sem avaliar de novo', () => {
    const queue: Step[] = items.slice(0, 6).map((i) => ({ itemId: i.id, kind: 'quiz', graded: true, mode: 'en-pt-choice' }));
    const current = queue[1] as Step;
    const next = scheduleRetry(queue, 1, current);
    expect(next).toHaveLength(7);
    expect(next[5]).toEqual({ ...current, graded: false });
    expect(scheduleRetry(queue, 5, current)[6]?.itemId).toBe(current.itemId);
  });

  it('separa pendentes e nunca vistos', () => {
    const cards: Record<string, CardState> = {
      [items[0]!.id]: { ...newCard(NOW), due: NOW - 10 },
      [items[1]!.id]: { ...newCard(NOW), due: NOW + DAY },
    };
    expect(dueItems(items, cards, NOW).map((i) => i.id)).toEqual([items[0]!.id]);
    expect(unseenItems(items, cards)).toHaveLength(items.length - 2);
  });
});

describe('alternativas', () => {
  it('4 opções distintas, sempre com a resposta', () => {
    const verbs = pack1.items.filter((i) => i.pos === 'verbo');
    const target = verbs[0] as Item;
    for (let seed = 1; seed < 20; seed++) {
      const choices = buildChoices(target, pack1.items, seeded(seed), 'pt');
      expect(choices).toHaveLength(4);
      expect(new Set(choices).size).toBe(4);
      expect(choices).toContain(target.pt);
    }
  });

  it('alternativas inteligentes: mesmo tema, confusões conhecidas e frases parecidas', async () => {
    const { pack2 } = await import('../data/pack2');
    const pool = [...pack1.items, ...pack2.items];
    const find = (en: string) => pool.find((i) => i.en === en)!;
    const ptOf = (en: string) => find(en).pt;
    // Segunda-feira: as erradas são outros dias da semana.
    const monday = buildChoices(find('Monday'), pool, seeded(3), 'pt', 4, { box: 3 });
    const days = ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(ptOf);
    expect(monday.filter((c) => days.includes(c))).toHaveLength(3);
    // do × make: a confusão clássica aparece.
    for (let seed = 1; seed < 8; seed++) expect(buildChoices(find('do'), pool, seeded(seed), 'en', 4, { box: 2 })).toContain('make');
    // Frase com a mesma estrutura.
    expect(buildChoices(find('How are you?'), pool, seeded(5), 'en', 4, { box: 2 })).toContain('How old are you?');
    // As confusões do próprio aprendiz voltam.
    const coffee = find('coffee');
    const beach = find('beach');
    expect(buildChoices(coffee, pool, seeded(9), 'pt', 4, { box: 3, confusedWith: [beach.id] })).toContain(beach.pt);
  });

  it('palavra nova tem uma alternativa mais tranquila; palavra firme só parecidas', async () => {
    const { similarity } = await import('./choices');
    const pool = pack1.items;
    const target = pool.find((i) => i.en === 'mother')!;
    const firm = buildChoices(target, pool, seeded(2), 'pt', 4, { box: 4 }).filter((c) => c !== target.pt);
    const scores = firm.map((c) => similarity(target, pool.find((i) => i.pt === c)!, 'pt'));
    expect(Math.min(...scores)).toBeGreaterThanOrEqual(5); // todas do tema família
  });

  it('completa com outras classes se faltar item da mesma', () => {
    const pool = [pack1.items[0]!, ...pack1.items.filter((i) => i.pos === 'verbo').slice(0, 10)];
    const choices = buildChoices(pool[0]!, pool, seeded(), 'en');
    expect(choices).toHaveLength(4);
  });
});

describe('resposta digitada', () => {
  it('ignora maiúsculas, acentos, pontuação e apóstrofo', () => {
    expect(normalize("  I'm FINE, thanks! ")).toBe('im fine thanks');
    expect(checkTyped('im fine thanks', "I'm fine, thanks")).toBe('exact');
  });

  it('aceita 1 letra errada em palavras de 5+ letras', () => {
    expect(checkTyped('remenber', 'remember')).toBe('typo');
    expect(checkTyped('ct', 'cat')).toBe('wrong');
    expect(checkTyped('', 'cat')).toBe('wrong');
    expect(checkTyped('dog', 'cat')).toBe('wrong');
  });
});

describe('progresso', () => {
  it('sequência de dias cresce, mantém no dia seguinte e zera se pular', () => {
    let p = registerStudyDay(emptyProgress(), NOW);
    expect(p.streak).toBe(1);
    expect(registerStudyDay(p, NOW).streak).toBe(1);
    p = registerStudyDay(p, NOW + DAY);
    expect(p.streak).toBe(2);
    expect(currentStreak(p, NOW + DAY * 2)).toBe(2);
    expect(currentStreak(p, NOW + DAY * 3)).toBe(0);
  });

  it('limite diário de itens novos (padrão 20) e o botão "+6"', async () => {
    const { addBonusNew } = await import('./progress');
    let p = registerNewItems(emptyProgress(), NOW, 20);
    expect(newAllowedToday(p, NOW)).toBe(0);
    p = addBonusNew(p, NOW);
    expect(newAllowedToday(p, NOW)).toBe(6);
    p = addBonusNew(p, NOW);
    expect(newAllowedToday(p, NOW)).toBe(12);
    expect(newAllowedToday(p, NOW + DAY)).toBe(20); // o bônus vale só no dia
  });

  it('migra o antigo padrão de 12 novas por dia para 20, sem mexer em escolhas diferentes', async () => {
    const { normalizeProgress } = await import('./progress');
    expect(normalizeProgress({ cards: {}, settings: { newPerDay: 12 } as never }).settings.newPerDay).toBe(20);
    expect(normalizeProgress({ cards: {}, settings: { newPerDay: 30 } as never }).settings.newPerDay).toBe(30);
    expect(normalizeProgress({ cards: {} }).settings.newPerDay).toBe(20);
  });

  it('libera o próximo pacote quando 80% do anterior já foi VISTO (não precisa dominar)', () => {
    const mk = (id: string, kind: Pack['kind'] = 'core'): Pack => ({
      id,
      title: id,
      subtitle: '',
      kind,
      items: Array.from({ length: 10 }, (_, i) => ({ id: `${id}:${i}`, en: `${id}${i}`, pt: `${id}${i}`, pos: 'verbo' as const })),
    });
    const a = mk('a');
    const b = mk('b');
    const cards: Record<string, CardState> = {};
    expect(unlockedPacks([a, b], cards)).toHaveLength(1);
    for (let i = 0; i < 7; i++) cards[`a:${i}`] = newCard(NOW);
    expect(unlockedPacks([a, b], cards)).toHaveLength(1);
    cards['a:7'] = newCard(NOW); // 8 de 10 vistas, nenhuma dominada
    expect(unlockedPacks([a, b], cards)).toHaveLength(2);
  });

  it('temáticos liberam com 60 palavras vistas e o foco muda a ordem dos novos', () => {
    const core = { id: 'c', title: 'c', subtitle: '', kind: 'core' as const, items: [] };
    const theme = { id: 't', title: 't', subtitle: '', kind: 'theme' as const, items: [] };
    const cards: Record<string, CardState> = {};
    expect(unlockedPacks([core, theme], cards).map((p) => p.id)).toEqual(['c']);
    for (let i = 0; i < 60; i++) cards[`c:${i}`] = newCard(NOW);
    expect(unlockedPacks([core, theme], cards).map((p) => p.id)).toEqual(['c', 't']);
    const items = [{ id: 'p1:a' }, { id: 'viagem:b' }, { id: 'p1:c' }];
    expect(orderByFocus(items, 'viagem').map((i) => i.id)).toEqual(['viagem:b', 'p1:a', 'p1:c']);
    expect(orderByFocus(items, null).map((i) => i.id)).toEqual(['p1:a', 'viagem:b', 'p1:c']);
  });
});

describe('tipos de pergunta', () => {
  const remember = pack1.items.find((i) => i.en === 'remember')!;
  const hello = pack1.items.find((i) => i.en === 'Hello')!;

  it('monta a lacuna a partir do exemplo', () => {
    expect(clozeParts(remember)).toEqual({ before: 'I ', answer: 'remember', after: ' you.' });
    expect(clozeParts(hello)).toBeNull(); // frase pronta não vira lacuna
    const won = pack1.items.find((i) => i.en === 'win')!; // exemplo usa "won", não serve
    expect(clozeParts(won)).toBeNull();
    expect(modeFor(2, 1, won)).toBe('pt-en-choice');
    expect(modeFor(4, 1, won)).toBe('pt-en-type');
  });

  it('boa parte do pacote tem lacuna possível', () => {
    const ok = pack1.items.filter((i) => clozeParts(i)).length;
    expect(ok).toBeGreaterThan(200);
  });

  it('esconde áudio e microfone quando pausados', () => {
    expect(resolveMode('listen-choice', remember, { audio: false, mic: true })).toBe('en-pt-choice');
    expect(resolveMode('speak', remember, { audio: true, mic: false })).toBe('pt-en-choice');
    expect(resolveMode('speak', remember, { audio: true, mic: true })).toBe('speak');
    expect(answerField('listen-choice')).toBe('pt');
    expect(answerField('cloze-choice')).toBe('en');
  });

  it('pausa por 15 minutos e reativa', () => {
    const support = { speech: true, recognition: true };
    let p = pause(emptyProgress(), 'mic', NOW);
    expect(pausedMinutes(p, 'mic', NOW)).toBe(15);
    expect(capabilities(p, NOW + 14 * 60_000, support)).toEqual({ audio: true, mic: false });
    expect(capabilities(p, NOW + 15 * 60_000, support)).toEqual({ audio: true, mic: true });
    p = resume(p, 'mic');
    expect(capabilities(p, NOW, support).mic).toBe(true);
    expect(capabilities(emptyProgress(), NOW, { speech: false, recognition: false })).toEqual({ audio: false, mic: false });
  });
});

describe('resposta falada', () => {
  it('aceita igual, com pontuação, número em dígito ou dentro da frase', () => {
    expect(matchSpoken(['Remember'], 'remember')).toBe(true);
    expect(matchSpoken(['i am fine thanks'], "I'm fine, thanks")).toBe(true); // sem contração também vale
    expect(matchSpoken(["I'm fine, thanks."], "I'm fine, thanks")).toBe(true);
    expect(matchSpoken(['2'], 'two')).toBe(true);
    expect(matchSpoken(['the kitchen'], 'kitchen')).toBe(true);
    expect(matchSpoken(['remembers'], 'remember')).toBe(true);
    expect(matchSpoken(['dog', 'cat'], 'cat')).toBe(true);
    expect(matchSpoken(['dog'], 'cat')).toBe(false);
    expect(matchSpoken([], 'cat')).toBe(false);
  });
});

describe('explicação do erro', () => {
  const pool = pack1.items;
  const make = pool.find((i) => i.en === 'make')!;
  const doItem = pool.find((i) => i.en === 'do')!;

  it('diz a resposta certa, o que foi marcado e a dica', () => {
    const lines = explain({ item: make, mode: 'pt-en-choice', chosen: 'do', pool, notes });
    expect(lines[0]).toContain('"make"');
    expect(lines.some((l) => l.includes('"do" significa'))).toBe(true);
    expect(lines.some((l) => l.includes('criar ou produzir'))).toBe(true);
  });

  it('explica a escolha em português e a lacuna', () => {
    const lines = explain({ item: doItem, mode: 'en-pt-choice', chosen: make.pt, pool, notes });
    expect(lines.some((l) => l.includes('tradução de "make"'))).toBe(true);
    const remember = pool.find((i) => i.en === 'remember')!;
    const cloze = explain({ item: remember, mode: 'cloze-choice', chosen: 'forget', pool, notes });
    expect(cloze.some((l) => l.includes('Eu me lembro de você'))).toBe(true);
  });

  it('todas as dicas apontam para palavras do pacote', () => {
    const ens = new Set(pool.map((i) => i.en.toLowerCase()));
    for (const key of Object.keys(notes)) expect(ens.has(key), key).toBe(true);
  });
});

describe('histórico', () => {
  it('soma respostas no dia', () => {
    let p = recordAnswer(emptyProgress(), NOW, true);
    p = recordAnswer(p, NOW, false);
    p = registerNewItems(p, NOW, 2);
    const day = Object.values(p.history)[0];
    expect(day).toEqual({ answers: 2, correct: 1, newItems: 2 });
    expect(p.totalAnswers).toBe(2);
  });
});

describe('situações (chat)', () => {
  it('roteiros válidos: ids únicos, opções com resposta certa e explicação nas erradas', async () => {
    const { situations: real } = await import('../data/situations');
    const { scenes } = await import('../data/scenes');
    const situations = [...real, ...scenes];
    expect(scenes.length).toBe(4);
    expect(scenes[0]?.unlockAt).toBe(0);
    for (let i = 1; i < scenes.length; i++) expect(scenes[i]!.unlockAt).toBeGreaterThanOrEqual(scenes[i - 1]!.unlockAt);
    const { tokens: toks } = await import('./chat');
    expect(new Set(situations.map((s) => s.id)).size).toBe(situations.length);
    expect(real[0]?.unlockAt).toBe(0);
    for (let i = 1; i < real.length; i++) {
      expect(real[i]!.unlockAt).toBeGreaterThanOrEqual(real[i - 1]!.unlockAt);
    }
    for (const s of situations) {
      expect(s.steps.at(-1)?.kind, s.id).toBeDefined();
      expect(s.steps.some((st) => st.kind === 'choose' || st.kind === 'build'), s.id).toBe(true);
      for (const step of s.steps) {
        if (step.kind === 'choose') {
          expect(step.options.length, `${s.id}: ${step.goal}`).toBeGreaterThanOrEqual(2);
          expect(step.options.some((o) => o.ok), `${s.id}: ${step.goal}`).toBe(true);
          expect(new Set(step.options.map((o) => o.text)).size).toBe(step.options.length);
          for (const o of step.options) if (!o.ok) expect(o.why, `${s.id}: ${o.text}`).toBeTruthy();
        }
        if (step.kind === 'build') {
          const words = toks(step.text);
          expect(words.length, step.text).toBeGreaterThanOrEqual(2);
          // Palavras extras não podem ser da frase (senão a montagem fica ambígua).
          for (const extra of step.extra) expect(words, `${s.id}: ${extra}`).not.toContain(extra);
        }
      }
    }
  });

  it('monta a frase ignorando pontuação e maiúsculas', async () => {
    const { checkBuild, tokens: toks, explainBuild } = await import('./chat');
    expect(toks("I'd like the chicken, please.")).toEqual(["I'd", 'like', 'the', 'chicken', 'please']);
    expect(checkBuild(['A', 'table', 'for', 'two', 'please'], 'A table for two, please.')).toBe(true);
    expect(checkBuild(['A', 'table', 'two', 'for', 'please'], 'A table for two, please.')).toBe(false);
    const step = { kind: 'build' as const, goal: '', text: 'A table for two, please.', pt: 'Uma mesa para dois.', extra: ['to'] };
    expect(explainBuild(['A', 'table', 'to', 'two', 'please'], step)).toContain('"to" não entra');
    expect(explainBuild(['table', 'A', 'for', 'two', 'please'], step)).toContain('a ordem não');
    expect(explainBuild(['A', 'table'], step)).toContain('Faltou palavra');
  });

  it('estrelas, liberação e registro', async () => {
    const { stars: st, isUnlocked: unlocked, phrasesOf } = await import('./chat');
    const { situations } = await import('../data/situations');
    const { completeSituation } = await import('./progress');
    expect(st(0)).toBe(3);
    expect(st(2)).toBe(2);
    expect(st(5)).toBe(1);
    const hotel = situations.find((s) => s.id === 'hotel')!;
    expect(unlocked(hotel, hotel.unlockAt - 1)).toBe(false);
    expect(unlocked(hotel, hotel.unlockAt)).toBe(true);
    expect(phrasesOf(hotel).length).toBeGreaterThan(3);
    let p = completeSituation(emptyProgress(), 'hotel', 2, NOW);
    p = completeSituation(p, 'hotel', 3, NOW);
    p = completeSituation(p, 'hotel', 1, NOW);
    expect(p.situations.hotel).toEqual({ done: 3, best: 3 });
    expect(p.streak).toBe(1);
  });

  it('narração e falas de outros personagens não contam como turno seu', async () => {
    const { myTurns, isMyTurn } = await import('./chat');
    const { scenes } = await import('../data/scenes');
    const orion = scenes[0]!;
    const mine = orion.steps.filter((st) => st.kind === 'choose' || st.kind === 'build').length;
    expect(myTurns(orion)).toBe(mine);
    expect(isMyTurn({ kind: 'scene', text: 'x', pt: 'x' })).toBe(false);
    expect(orion.steps.some((st) => st.kind === 'them' && st.who)).toBe(true);
  });
});

describe('Tempo de Miller', () => {
  it('converte o tempo da Terra para Miller e vice-versa (1 h em Miller = 7 anos aqui)', async () => {
    const { millerSeconds, earthYearsIfOnMiller, formatMiller, formatEarth, formatStudy, MILLER_RATIO } = await import('./miller');
    expect(Math.round(MILLER_RATIO)).toBe(61362);
    expect(millerSeconds(MILLER_RATIO * 1000)).toBeCloseTo(1, 6);
    expect(earthYearsIfOnMiller(3_600_000)).toBe(7);
    expect(formatMiller(millerSeconds(10 * 60_000))).toBe('0,0098 segundo');
    expect(formatEarth(earthYearsIfOnMiller(10 * 60_000))).toBe('1,2 ano');
    expect(formatEarth(earthYearsIfOnMiller(60_000))).toBe('1,4 mês');
    expect(formatEarth(earthYearsIfOnMiller(5_000))).toBe('4 dias'); // 3,55 dias
    expect(formatEarth(earthYearsIfOnMiller(10 * 3_600_000))).toBe('70 anos');
    expect(formatStudy(45_000)).toBe('45 s');
    expect(formatStudy(12 * 60_000)).toBe('12 min');
    expect(formatStudy(65 * 60_000)).toBe('1 h 05 min');
  });

  it('relógio de estudo ignora pausas longas e soma no dia', async () => {
    const { tick } = await import('./miller');
    const { addStudyTime, todayMs } = await import('./progress');
    expect(tick(null, 1000)).toEqual({ add: 0, last: 1000 });
    expect(tick(1000, 31_000).add).toBe(30_000);
    expect(tick(1000, 1000 + 10 * 60_000).add).toBe(0);
    let p = addStudyTime(emptyProgress(), NOW, 30_000);
    p = addStudyTime(p, NOW, 30_000);
    expect(todayMs(p, NOW)).toBe(60_000);
    expect(p.totalMs).toBe(60_000);
  });
});

describe('backup', () => {
  it('exporta e importa o progresso (código e arquivo)', async () => {
    const { encodeBackup, decodeBackup, backupJson } = await import('./backup');
    let p = recordAnswer(emptyProgress(), NOW, true);
    p = { ...p, cards: { 'p1:hello': grade(newCard(NOW), 'good', NOW) }, streak: 4 };
    const code = encodeBackup(p);
    expect(code.startsWith('MM1.')).toBe(true);
    const back = decodeBackup(code);
    expect(back.ok && back.progress.cards['p1:hello']?.box).toBe(1);
    expect(back.ok && back.progress.streak).toBe(4);
    const file = decodeBackup(backupJson(p));
    expect(file.ok && file.progress.totalAnswers).toBe(1);
  });

  it('recusa texto inválido com mensagem clara', async () => {
    const { decodeBackup } = await import('./backup');
    expect(decodeBackup('oi').ok).toBe(false);
    expect(decodeBackup('MM1.@@@').ok).toBe(false);
    expect(decodeBackup('{"foo":1}').ok).toBe(false);
  });
});

describe('ditado e shadowing', () => {
  it('compara palavra por palavra com tolerância', async () => {
    const { compareWords } = await import('./compare');
    expect(compareWords('I like music.', 'i like music').score).toBe(1);
    const missing = compareWords('I like rock music.', 'I like music');
    expect(missing.words.map((w) => w.ok)).toEqual([true, true, false, true]);
    expect(missing.score).toBe(0.75);
    expect(compareWords('Wait five minutes.', 'wait 5 minutes').score).toBe(1);
    expect(compareWords('I remember you.', 'I remenber you').score).toBe(1);
    expect(compareWords('Hello there', '').score).toBe(0);
  });
});

describe('lembrete (.ics)', () => {
  it('gera evento diário no próximo horário, com alarme e link', async () => {
    const { buildReminderIcs, parseTime } = await import('./ics');
    const now = new Date(2026, 10, 20, 21, 0);
    const ics = buildReminderIcs('20:30', 'https://exemplo/app/', now);
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toContain('DTSTART:20261121T203000');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('https://exemplo/app/');
    expect(buildReminderIcs('22:00', 'u', now)).toContain('DTSTART:20261120T220000');
    expect(parseTime('25:00')).toBeNull();
  });
});

describe('medalhas', () => {
  it('concede uma vez e registra a data', async () => {
    const { awardMedals } = await import('./medals');
    let p = recordAnswer(emptyProgress(), NOW, true);
    const first = awardMedals(p, NOW);
    expect(first.awarded.map((m) => m.id)).toContain('decolagem');
    p = first.progress;
    expect(awardMedals(p, NOW).awarded).toHaveLength(0);
    p = { ...p, totalMs: 61 * 60_000 };
    expect(awardMedals(p, NOW).awarded.map((m) => m.id)).toContain('hour');
  });
});

describe('caderno de erros', () => {
  it('lista os erros recentes, do mais novo para o mais antigo', async () => {
    const { mistakeItems } = await import('./session');
    const items = pack1.items.slice(0, 5);
    const cards: Record<string, CardState> = {
      [items[0]!.id]: { ...newCard(NOW), lastWrong: NOW - DAY },
      [items[1]!.id]: { ...newCard(NOW), lastWrong: NOW - 30 * DAY },
      [items[2]!.id]: { ...newCard(NOW), lastWrong: NOW - 1000 },
      [items[3]!.id]: newCard(NOW),
    };
    expect(mistakeItems(items, cards, NOW).map((i) => i.id)).toEqual([items[2]!.id, items[0]!.id]);
  });
});

describe('notificações', () => {
  it('escolhe o turno pelo horário de Brasília e varia a mensagem por dia', async () => {
    const { slotFor, pickMessage, MESSAGES, dayOfYear } = await import('./pushMessages');
    expect(slotFor(new Date(Date.UTC(2026, 10, 20, 14, 50)))).toBe('midday'); // 11h50 BRT
    expect(slotFor(new Date(Date.UTC(2026, 10, 20, 23, 50)))).toBe('night'); // 20h50 BRT
    expect(slotFor(new Date(Date.UTC(2026, 10, 21, 0, 5)))).toBe('night'); // 21h05 BRT
    const d1 = new Date(Date.UTC(2026, 10, 20, 15));
    const d2 = new Date(Date.UTC(2026, 10, 21, 15));
    expect(dayOfYear(d2)).toBe(dayOfYear(d1) + 1);
    expect(pickMessage('midday', d1)).not.toEqual(pickMessage('midday', d2));
    for (const list of Object.values(MESSAGES)) {
      expect(list.length).toBeGreaterThanOrEqual(7);
      for (const m of list) expect(m.title.length + m.body.length).toBeLessThan(160);
    }
  });

  it('converte a chave pública VAPID para bytes (65 bytes, ponto não comprimido)', async () => {
    const { base64UrlToBytes, VAPID_PUBLIC_KEY } = await import('./push');
    const bytes = base64UrlToBytes(VAPID_PUBLIC_KEY);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(4);
  });
});

describe('missão do metrô', () => {
  it('monta 3 etapas offline e marca o que já foi feito hoje', async () => {
    const { buildMetroPlan, pickNext } = await import('./metro');
    const { markActivity, doneToday, completeStory } = await import('./progress');
    const { stories } = await import('../data/stories');
    const { situations } = await import('../data/situations');
    const { scenes } = await import('../data/scenes');
    let p = emptyProgress();
    const content = { stories, chats: [...situations, ...scenes], audioOk: true };
    const plan = buildMetroPlan(p, NOW, content);
    expect(plan.map((s) => s.activity)).toEqual(expect.arrayContaining(['session', 'story']));
    expect(plan).toHaveLength(3);
    expect(plan.every((s) => !s.done)).toBe(true);
    p = markActivity(p, NOW, 'session');
    p = markActivity(p, NOW, 'session');
    expect(doneToday(p, NOW)).toEqual(['session']);
    expect(doneToday(p, NOW + DAY)).toEqual([]);
    p = completeStory(p, 'manha-tom', 3, NOW);
    expect(buildMetroPlan(p, NOW, content).filter((s) => s.done).map((s) => s.activity)).toEqual(['session', 'story']);
    // A próxima história sugerida é uma ainda não lida (quando liberada).
    expect(pickNext(stories, { 'manha-tom': { done: 1, best: 3 } }, 40)?.id).toBe('cafe-ana');
    expect(pickNext(stories, { 'manha-tom': { done: 1, best: 3 } }, 0)?.id).toBe('manha-tom');
    // Sem áudio, a 3ª etapa é uma conversa (nunca ditado).
    expect(buildMetroPlan(p, NOW, { ...content, audioOk: false }).at(-1)?.activity).toBe('chat');
  });
});

describe('cápsula do tempo', () => {
  it('conta os meses a partir da primeira mensagem e libera a próxima depois de 30 dias', async () => {
    const { capsuleStatus, beforeAndNow, promptForMonth, MONTH_MS } = await import('./capsule');
    expect(capsuleStatus([], NOW)).toEqual({ month: 1, recorded: false, daysToNext: 0 });
    const first = { id: 'a', month: 1, at: NOW, durationMs: 60_000, kind: 'audio' as const };
    expect(capsuleStatus([first], NOW + DAY)).toEqual({ month: 1, recorded: true, daysToNext: 29 });
    expect(capsuleStatus([first], NOW + MONTH_MS + 1000)).toMatchObject({ month: 2, recorded: false });
    const video = { id: 'v', month: 1, at: NOW, durationMs: 1, kind: 'video' as const };
    expect(capsuleStatus([video], NOW)).toMatchObject({ month: 1, recorded: false });
    expect(beforeAndNow([first])).toBeNull();
    const second = { ...first, id: 'b', month: 2, at: NOW + MONTH_MS };
    expect(beforeAndNow([second, first])?.map((c) => c.id)).toEqual(['a', 'b']);
    expect(promptForMonth(6).en).toContain('past self');
    expect(promptForMonth(9).en).toContain('past self');
  });
});

describe('IA: cliente, fila offline e Minhas frases', () => {
  it('cliente: envia o código e traduz os erros do servidor', async () => {
    const { makeCaller, AiError, normalizeUrl } = await import('./ai');
    expect(normalizeUrl(' meu.workers.dev/ ')).toBe('https://meu.workers.dev');
    const seen: { url: string; code: string | null }[] = [];
    const fake = (status: number, body: unknown) =>
      (async (url: string, init?: RequestInit) => {
        seen.push({ url, code: new Headers(init?.headers).get('X-Access-Code') });
        return new Response(JSON.stringify(body), { status });
      }) as unknown as typeof fetch;
    const cfg = { url: 'https://x.dev', code: 'segredo' };
    expect(await makeCaller(cfg, fake(200, { ok: true }))('/ping', {})).toEqual({ ok: true });
    expect(seen[0]).toEqual({ url: 'https://x.dev/ping', code: 'segredo' });
    await expect(makeCaller(cfg, fake(401, { error: 'x' }))('/chat', {})).rejects.toMatchObject({ kind: 'auth' });
    await expect(makeCaller(cfg, fake(429, {}))('/chat', {})).rejects.toMatchObject({ kind: 'limit' });
    await expect(makeCaller(cfg, fake(502, { error: 'erro da API' }))('/chat', {})).rejects.toMatchObject({ kind: 'server' });
    const broken = (async () => {
      throw new TypeError('network');
    }) as unknown as typeof fetch;
    await expect(makeCaller(cfg, broken)('/chat', {})).rejects.toBeInstanceOf(AiError);
    await expect(makeCaller(null)('/chat', {})).rejects.toMatchObject({ kind: 'config' });
  });

  it('fila: guarda offline, processa ao voltar e cria cartões', async () => {
    const { enqueue, processQueue, pendingJobs, AiError } = await import('./ai');
    let p = enqueue(emptyProgress(), { kind: 'phrase', text: 'brake a leg', context: 'série' }, NOW);
    p = enqueue(p, { kind: 'diary', text: 'Today I go to work.' }, NOW + 1);
    expect(pendingJobs(p)).toHaveLength(2);
    const update = (fn: (x: typeof p) => typeof p) => {
      p = fn(p);
    };
    // Sem internet: para na primeira tentativa e mantém tudo na fila.
    const offline = async () => {
      throw new AiError('sem internet', 'offline');
    };
    expect(await processQueue(() => p, update, offline)).toBe(0);
    expect(pendingJobs(p)).toHaveLength(2);
    // Com internet: processa os dois.
    const online = async (_path: string, body: Record<string, unknown>) =>
      body.kind === 'phrase'
        ? { en: 'Break a leg!', pt: 'Boa sorte!', explanation_pt: 'expressão de teatro', example: 'Break a leg tonight!' }
        : { corrected: 'Today I went to work.', natural: 'I went to work today.', mistakes: [{ said: 'I go', better: 'I went', why_pt: 'passado: went' }], tip_pt: 'Use o passado.' };
    expect(await processQueue(() => p, update, online)).toBe(2);
    expect(pendingJobs(p)).toHaveLength(0);
    expect(p.custom.map((i) => i.en).sort()).toEqual(['Break a leg!', 'I went']);
    // O erro do diário vai para o caderno de erros.
    expect(p.cards['mine:i-went']?.lastWrong).toBeDefined();
    expect(p.cards['mine:break-a-leg']).toBeUndefined();
  });

  it('erro do servidor marca só aquele item e segue a fila', async () => {
    const { enqueue, processQueue, AiError } = await import('./ai');
    let p = enqueue(enqueue(emptyProgress(), { kind: 'phrase', text: 'a' }, NOW), { kind: 'phrase', text: 'b' }, NOW + 1);
    const update = (fn: (x: typeof p) => typeof p) => {
      p = fn(p);
    };
    let n = 0;
    const flaky = async () => {
      n++;
      if (n === 1) throw new AiError('O servidor respondeu: erro', 'server');
      return { en: 'Bee', pt: 'abelha', explanation_pt: '', example: '' };
    };
    expect(await processQueue(() => p, update, flaky)).toBe(1);
    expect(p.aiQueue.map((j) => j.status).sort()).toEqual(['done', 'error']);
  });

  it('Minhas frases: sem repetição e sempre liberado quando tem itens', async () => {
    const { addCustomItems, customId } = await import('./progress');
    const { minePack } = await import('../data/packs');
    expect(customId("I'm on my way!")).toBe('mine:i-m-on-my-way');
    let p = addCustomItems(emptyProgress(), [{ en: 'Watch out', pt: 'Cuidado' }, { en: 'watch out', pt: 'cuidado' }, { en: '', pt: 'x' }], NOW);
    expect(p.custom).toHaveLength(1);
    p = addCustomItems(p, [{ en: 'Watch out', pt: 'Cuidado' }], NOW);
    expect(p.custom).toHaveLength(1);
    expect(unlockedPacks([minePack([])], {})).toHaveLength(0);
    expect(unlockedPacks([minePack(p.custom)], {})).toHaveLength(1);
  });
});
