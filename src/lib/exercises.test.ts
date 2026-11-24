import { describe, expect, it } from 'vitest';
import { pack1 } from '../data/pack1';
import { pack2 } from '../data/pack2';
import { buildPuzzle, checkBuild, checkTranslation, expandContractions, spotPuzzle } from './exercises';
import { buildSource, canSpotError, fits, modeFor, needs, resolveMode, translateSource } from './modes';
import { addConfusion, emptyProgress, MAX_CONFUSIONS, normalizeProgress } from './progress';
import { buildSession, MATCH_SIZE } from './session';

function seeded(seed = 7): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const pool = [...pack1.items, ...pack2.items];
const remember = pack1.items.find((i) => i.en === 'remember')!;
const hello = pack1.items.find((i) => i.en === 'Hello')!;

describe('escada de formatos', () => {
  it('reconhecer → lembrar em contexto → produzir', () => {
    const recall = new Set(Array.from({ length: 6 }, (_, s) => modeFor(2, s, remember)));
    expect(recall).toEqual(new Set(['pt-en-choice', 'cloze-choice', 'listen-choice', 'speak', 'build', 'spot-error']));
    const produce = new Set(Array.from({ length: 6 }, (_, s) => modeFor(5, s, remember)));
    expect(produce).toContain('listen-type');
    expect(produce).toContain('translate');
    expect(produce).not.toContain('en-pt-choice');
    const recognize = new Set(Array.from({ length: 6 }, (_, s) => modeFor(0, s, remember)));
    expect(recognize).toEqual(new Set(['en-pt-choice', 'listen-choice']));
  });

  it('formato que não cabe no item volta para o básico', () => {
    const noEx = { ...remember, id: 'x:1', ex: undefined, exPt: undefined };
    expect(fits('build', noEx)).toBe(false);
    expect(modeFor(2, 4, noEx)).toBe('pt-en-choice');
    expect(modeFor(5, 4, noEx)).toBe('pt-en-type');
    expect(resolveMode('translate', noEx, { audio: true, mic: true })).toBe('pt-en-type');
  });

  it('ditado da palavra precisa de áudio', () => {
    expect(needs('listen-type')).toBe('audio');
    expect(resolveMode('listen-type', remember, { audio: false, mic: true })).toBe('pt-en-type');
  });

  it('a maior parte do pacote 1 aceita os formatos de frase', () => {
    const n = pack1.items.length;
    expect(pack1.items.filter((i) => buildSource(i)).length / n).toBeGreaterThan(0.6);
    expect(pack1.items.filter((i) => translateSource(i)).length / n).toBeGreaterThan(0.6);
    expect(pack1.items.filter((i) => canSpotError(i)).length / n).toBeGreaterThan(0.5);
  });
});

describe('monte a frase', () => {
  it('blocos da frase + duas palavras a mais, fora de ordem', () => {
    const p = buildPuzzle(remember, pool, seeded())!;
    expect(p.answer).toEqual(['I', 'remember', 'you']);
    expect(p.tiles).toHaveLength(5);
    for (const w of p.answer) expect(p.tiles).toContain(w);
    expect(p.tiles.slice(0, 3).join(' ')).not.toBe('I remember you');
    expect(checkBuild(p.answer, ['i', 'remember', 'you'])).toBe(true);
    expect(checkBuild(p.answer, ['you', 'remember', 'I'])).toBe(false);
  });

  it('frase pronta sem exemplo usa a própria frase', () => {
    const phrase = pool.find((i) => i.pos === 'frase' && !i.ex && i.en.split(' ').length >= 3);
    if (!phrase) return;
    const p = buildPuzzle(phrase, pool, seeded())!;
    expect(p.sentence).toBe(phrase.en);
    expect(p.prompt).toBe(phrase.pt);
  });

  it('frase curta demais não vira quebra-cabeça', () => {
    expect(buildPuzzle({ ...hello, ex: undefined, exPt: undefined }, pool, seeded())).toBeNull();
  });
});

describe('ache o erro', () => {
  it('troca a palavra por uma parecida, na mesma posição', () => {
    const p = spotPuzzle(remember, pool, seeded())!;
    expect(p.right).toBe('remember');
    expect(p.wrongIndex).toBe(1);
    expect(p.words[0]).toBe('I');
    expect(p.words[2]).toBe('you.');
    expect(p.wrong.toLowerCase()).not.toBe('remember');
    expect(p.words[1]).toBe(p.wrong);
  });

  it('a palavra trocada costuma ser da mesma família (ex.: do → make)', () => {
    const doItem = pool.find((i) => i.en === 'do' && canSpotError(i));
    if (!doItem) return;
    const seen = new Set(Array.from({ length: 10 }, (_, k) => spotPuzzle(doItem, pool, seeded(k + 1))?.wrong.toLowerCase()));
    expect(seen.has('make')).toBe(true);
  });
});

describe('traduza a frase', () => {
  it('aceita a frase com pequenos erros e mostra o que faltou', () => {
    expect(checkTranslation(remember, 'I remember you')?.ok).toBe(true);
    expect(checkTranslation(remember, 'i remember you.')?.score).toBe(1);
    const bad = checkTranslation(remember, 'I forget you')!;
    expect(bad.ok).toBe(false);
    expect(bad.words.find((w) => w.word === 'remember')?.ok).toBe(false);
  });

  it('contração e forma longa valem igual', () => {
    expect(expandContractions("I think it's good.")).toBe('I think it is good.');
    const think = { ...remember, id: 'x:think', en: 'think', ex: "I think it's good.", exPt: 'Eu acho que é bom.' };
    expect(checkTranslation(think, 'I think it is good')?.score).toBe(1);
    expect(checkTranslation(think, "i think it's good")?.score).toBe(1);
    const longForm = pack1.items.find((i) => i.ex === 'I think it is good.')!;
    expect(checkTranslation(longForm, "I think it's good")?.ok).toBe(true);
  });
});

describe('pares relâmpago', () => {
  it('entram depois das palavras novas, sem nota', () => {
    const fresh = pack1.items.slice(0, 6);
    const steps = buildSession([], fresh, {}, seeded());
    const match = steps.filter((s) => s.kind === 'match');
    expect(match).toHaveLength(1);
    expect(match[0]?.graded).toBe(false);
    expect(match[0]?.group).toHaveLength(Math.min(6, MATCH_SIZE));
    const at = steps.indexOf(match[0]!);
    // Todas as apresentações vêm antes dos pares.
    const lastIntro = steps.map((s) => s.kind).lastIndexOf('intro');
    expect(lastIntro).toBeLessThan(at);
  });

  it('com menos de 3 novas não tem rodada de pares', () => {
    const steps = buildSession([], pack1.items.slice(0, 2), {}, seeded());
    expect(steps.some((s) => s.kind === 'match')).toBe(false);
  });
});

describe('confusões do aprendiz', () => {
  it('guarda as mais recentes, sem repetir, com limite', () => {
    let p = emptyProgress();
    for (let k = 0; k < 8; k++) p = addConfusion(p, 'a', `b${k}`);
    p = addConfusion(p, 'a', 'b3');
    expect(p.confusions.a?.[0]).toBe('b3');
    expect(p.confusions.a).toHaveLength(MAX_CONFUSIONS);
    expect(new Set(p.confusions.a).size).toBe(MAX_CONFUSIONS);
    expect(addConfusion(p, 'a', 'a')).toBe(p);
  });

  it('progresso antigo ganha o campo vazio', () => {
    const old = normalizeProgress({ streak: 3 } as never);
    expect(old.confusions).toEqual({});
  });
});
