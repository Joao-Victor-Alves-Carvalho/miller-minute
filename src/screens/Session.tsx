import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { notes } from '../data/notes';
import { getItem } from '../data/packs';
import type { Item } from '../data/types';
import type { Mood } from '../components/Aurora';
import { Confetti } from '../components/Confetti';
import { MatchRound } from '../components/MatchRound';
import { IconBolt, IconCheck, IconMic, IconSpeaker, IconX } from '../components/Icons';
import { SpeakButton } from '../components/SpeakButton';
import { checkTyped, matchSpoken } from '../lib/answer';
import type { WordCheck } from '../lib/compare';
import { buildPuzzle, checkBuild, checkTranslation, spotPuzzle } from '../lib/exercises';
import { buildChoices } from '../lib/choices';
import { explain } from '../lib/explain';
import { speechSupport, listen, type Listening  } from '../lib/listen';
import { answerField, clozeParts, isChoice, isSentence, resolveMode, type Mode } from '../lib/modes';
import {
  addConfusion,
  capabilities,
  pause,
  pausedMinutes,
  recordAnswer,
  registerNewItems,
  type PauseKind,
  type Progress,
} from '../lib/progress';
import { MAX_RETRIES_PER_ITEM, scheduleRetry, type Step } from '../lib/session';
import { playCorrect, playWrong } from '../lib/sfx';
import { canSpeak, speak, vibrate } from '../lib/speech';
import { autoRate, grade, newCard, previewDays, type CardState, type Rate } from '../lib/srs';

export interface Summary {
  answered: number;
  correct: number;
  bestCombo: number;
  newLearned: number;
}

/** normal: sessão do dia; extra: treino sem agendamento; mistakes: caderno de erros. */
export type SessionKind = 'normal' | 'extra' | 'mistakes';

interface Props {
  steps: Step[];
  kind: SessionKind;
  pool: Item[];
  progress: Progress;
  updateProgress: (fn: (p: Progress) => Progress) => void;
  setMood: (mood: Mood) => void;
  onFinish: (summary: Summary) => void;
  onExit: () => void;
}

interface Outcome {
  correct: boolean;
  typo: boolean;
  chosen: string | null;
  why: string[];
  /** Traduza a frase: palavra por palavra do que foi escrito. */
  check?: WordCheck[];
}

const GOOD = ['Mandou bem!', 'Isso aí!', 'Perfeito!', 'Boa!', 'Na mosca!', 'Arrasou!'];
const BAD = ['Quase!', 'Não foi dessa vez', 'Bora de novo'];
const LABEL: Record<Mode, string> = {
  'en-pt-choice': 'O que significa?',
  'pt-en-choice': 'Como se diz em inglês?',
  'pt-en-type': 'Escreva em inglês',
  'listen-choice': 'Ouça e escolha o significado',
  'cloze-choice': 'Complete a frase',
  speak: 'Fale em inglês',
  'listen-type': 'Ouça e escreva em inglês',
  build: 'Monte a frase em inglês',
  'spot-error': 'Ache a palavra errada',
  translate: 'Traduza a frase',
};

/** Recalculado a cada uso: sem internet no Android, o microfone sai de cena. */
const support = () => speechSupport(canSpeak());
const pick = (list: readonly string[]) => list[Math.floor(Math.random() * list.length)] ?? '';

export function Session({ steps, kind, pool, progress, updateProgress, setMood, onFinish, onExit }: Props) {
  const [queue, setQueue] = useState(steps);
  const [index, setIndex] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [typed, setTyped] = useState('');
  const [combo, setCombo] = useState(0);
  const [burst, setBurst] = useState(0);
  const [title, setTitle] = useState('');
  const [listening, setListening] = useState(false);
  const [micMsg, setMicMsg] = useState<string | null>(null);
  // Monte a frase: índices dos blocos escolhidos, na ordem.
  const [built, setBuilt] = useState<number[]>([]);
  const stats = useRef<Summary>({ answered: 0, correct: 0, bestCombo: 0, newLearned: 0 });
  const retries = useRef(new Map<string, number>());
  const recognition = useRef<Listening | null>(null);
  // Nota do FSRS: estado do cartão antes da resposta, para reavaliar se a pessoa trocar a nota.
  const [rating, setRating] = useState<Rate | null>(null);
  const graded = useRef<{ before: CardState; at: number } | null>(null);

  const step = queue[index];
  const item = step ? getItem(step.itemId) : undefined;
  const audioOn = pausedMinutes(progress, 'audio', Date.now()) === 0;
  const autoAudio = progress.settings.autoAudio && audioOn;
  const soundsOn = progress.settings.sounds && audioOn;

  // Tipo de pergunta efetivo: troca áudio/microfone quando estão pausados ou indisponíveis.
  // Os quebra-cabeças de frase são montados aqui (fixos durante o passo); sem peças, volta ao básico.
  const { mode, build, spot } = useMemo(() => {
    if (!step || !item) return { mode: 'en-pt-choice' as Mode, build: null, spot: null };
    const resolved = resolveMode(step.mode, item, capabilities(progress, Date.now(), support()));
    if (resolved === 'build') {
      const puzzle = buildPuzzle(item, pool, Math.random);
      return puzzle ? { mode: resolved, build: puzzle, spot: null } : { mode: 'pt-en-choice' as Mode, build: null, spot: null };
    }
    if (resolved === 'spot-error') {
      const puzzle = spotPuzzle(item, pool, Math.random);
      return puzzle ? { mode: resolved, build: null, spot: puzzle } : { mode: 'pt-en-choice' as Mode, build: null, spot: null };
    }
    return { mode: resolved, build: null, spot: null };
  }, [index, step, item, progress.pauses]);

  // Alternativas fixas durante o passo: reagendar um erro muda a fila, mas não o passo atual.
  // Palavra firme recebe alternativas mais parecidas; o que você já confundiu volta como alternativa.
  const choices = useMemo(() => {
    if (!step || !item || step.kind !== 'quiz' || !isChoice(mode)) return [];
    return buildChoices(item, pool, Math.random, answerField(mode), 4, {
      box: progress.cards[item.id]?.box ?? 0,
      confusedWith: progress.confusions[item.id],
    });
  }, [index, step, mode]);

  const matchItems = useMemo(
    () => (step?.kind === 'match' ? (step.group ?? []).map((id) => getItem(id)).filter((i): i is Item => i !== undefined) : []),
    [index, step],
  );
  const sentence = item && isSentence(mode) ? (mode === 'build' && build ? { en: build.sentence, pt: build.prompt } : { en: item.ex ?? item.en, pt: item.exPt ?? item.pt }) : null;

  const cloze = item && mode === 'cloze-choice' ? clozeParts(item) : null;

  // Áudio automático ao mostrar a pergunta.
  useEffect(() => {
    if (!item || outcome || step?.kind === 'match') return;
    if ((mode === 'listen-choice' || mode === 'listen-type') && audioOn) speak(item.en);
    else if (autoAudio && (step?.kind === 'intro' || mode === 'en-pt-choice')) speak(item.en);
  }, [index, step, mode]);

  // Para o microfone ao trocar de passo ou sair.
  useEffect(() => {
    setMicMsg(null);
    return () => {
      recognition.current?.stop();
      recognition.current = null;
      setListening(false);
    };
  }, [index]);

  const finish = useCallback(() => {
    setMood('idle');
    onFinish({ ...stats.current });
  }, [onFinish, setMood]);

  const advance = useCallback(() => {
    setMood('idle');
    setOutcome(null);
    setTyped('');
    setBuilt([]);
    if (index + 1 >= queue.length) finish();
    else setIndex(index + 1);
  }, [finish, index, queue.length, setMood]);

  const continueIntro = useCallback(() => {
    if (!step) return;
    stats.current.newLearned += 1;
    updateProgress((p) => registerNewItems(p, Date.now(), 1));
    advance();
  }, [advance, step, updateProgress]);

  const finishMatch = useCallback(
    (misses: number) => {
      // Pares não mexem na revisão espaçada; contam como prática (sem punir as tentativas).
      stats.current.answered += 1;
      if (misses === 0) stats.current.correct += 1;
      updateProgress((p) => recordAnswer(p, Date.now(), misses === 0));
      advance();
    },
    [advance, updateProgress],
  );

  const answer = useCallback(
    (correct: boolean, chosen: string | null, typo = false, check?: WordCheck[]) => {
      if (!step || !item || outcome) return;
      const now = Date.now();
      const before = progress.cards[item.id] ?? newCard(now);
      graded.current = step.graded && correct ? { before, at: now } : null;
      setRating(step.graded && correct ? autoRate(true, typo) : null);
      // Guarda a confusão (escolheu/escreveu outra palavra conhecida): ela volta como alternativa.
      const confusedWith =
        !correct && chosen && !isSentence(mode)
          ? pool.find((i) => i.id !== item.id && (isChoice(mode) ? i[answerField(mode)] === chosen : i.en.toLowerCase() === chosen.trim().toLowerCase()))
          : undefined;
      updateProgress((p0) => {
        const p = confusedWith ? addConfusion(p0, item.id, confusedWith.id) : p0;
        const next = recordAnswer(p, now, correct);
        const existing = p.cards[item.id];
        if (step.graded) {
          return { ...next, cards: { ...p.cards, [item.id]: grade(existing ?? newCard(now), autoRate(correct, typo), now) } };
        }
        if (!existing) return next;
        // Treinos sem agendamento: o erro vai para o caderno; no caderno, o acerto tira de lá.
        if (!correct) return { ...next, cards: { ...p.cards, [item.id]: { ...existing, lastWrong: now } } };
        if (kind === 'mistakes' && existing.lastWrong) {
          const fixed: CardState = { ...existing };
          delete fixed.lastWrong;
          return { ...next, cards: { ...p.cards, [item.id]: fixed } };
        }
        return next;
      });

      stats.current.answered += 1;
      if (correct) {
        stats.current.correct += 1;
        const nextCombo = combo + 1;
        setCombo(nextCombo);
        stats.current.bestCombo = Math.max(stats.current.bestCombo, nextCombo);
        setBurst((b) => b + 1);
        setTitle(typo ? 'Quase perfeito!' : pick(GOOD));
        vibrate(25);
        if (soundsOn) playCorrect();
      } else {
        setCombo(0);
        setTitle(pick(BAD));
        vibrate([70, 50, 70]);
        if (soundsOn) playWrong();
        const used = retries.current.get(item.id) ?? 0;
        if (used < MAX_RETRIES_PER_ITEM) {
          retries.current.set(item.id, used + 1);
          setQueue((q) => scheduleRetry(q, index, step));
        }
      }
      setMood(correct ? 'correct' : 'wrong');
      const why = correct ? [] : explain({ item, mode, chosen: spot && chosen ? (spot.words[Number(chosen)] ?? null) : chosen, pool, notes, swapped: spot?.wrong });
      setOutcome({ correct, typo, chosen, why, check });
      // A pronúncia vem depois do efeito sonoro (nas frases, a frase inteira).
      const say = sentence?.en ?? item.en;
      if (autoAudio && (answerField(mode) === 'en' || !correct)) setTimeout(() => speak(say), soundsOn ? 380 : 0);
    },
    [autoAudio, combo, index, item, kind, mode, outcome, pool, progress.cards, sentence, setMood, soundsOn, spot, step, updateProgress],
  );

  const rate = (r: Rate) => {
    const g = graded.current;
    if (!g || !item) return;
    setRating(r);
    updateProgress((p) => ({ ...p, cards: { ...p.cards, [item.id]: grade(g.before, r, g.at) } }));
  };

  const pauseKind = useCallback(
    (kind: PauseKind) => {
      recognition.current?.stop();
      setListening(false);
      updateProgress((p) => pause(p, kind, Date.now()));
    },
    [updateProgress],
  );

  const startListening = useCallback(() => {
    if (!item || outcome || listening) return;
    setMicMsg(null);
    setListening(true);
    const session = listen();
    recognition.current = session;
    session.result
      .then((alternatives) => {
        if (recognition.current !== session) return;
        setListening(false);
        if (alternatives.length === 0) {
          setMicMsg('Não ouvi nada. Toque no microfone e fale de novo.');
          return;
        }
        const ok = matchSpoken(alternatives, item.en);
        answer(ok, alternatives[0] ?? '');
      })
      .catch((err: unknown) => {
        if (recognition.current !== session) return;
        setListening(false);
        const code = err instanceof Error ? err.message : '';
        setMicMsg(
          code === 'not-allowed' || code === 'service-not-allowed'
            ? 'Sem permissão para o microfone. Libere nas configurações do navegador ou toque em "Não posso falar agora".'
            : code === 'network'
              ? 'O reconhecimento de voz precisa de internet. Tente de novo ou toque em "Não posso falar agora".'
              : 'O microfone não funcionou agora. Tente de novo ou toque em "Não posso falar agora".',
        );
      });
  }, [answer, item, listening, outcome]);

  // Teclado: 1–4 escolhem, Enter continua.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      if (step?.kind === 'match') return;
      if (step?.kind === 'intro' && e.key === 'Enter') {
        e.preventDefault();
        continueIntro();
        return;
      }
      if (outcome && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        advance();
        return;
      }
      const n = Number(e.key);
      if (!outcome && n >= 1 && n <= choices.length && item) {
        const choice = choices[n - 1] ?? '';
        answer(choice === item[answerField(mode)], choice);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, answer, choices, continueIntro, item, mode, outcome, step]);

  if (!step || !item) return null;

  const expected = item[answerField(mode)];
  const preview = outcome?.correct && graded.current ? previewDays(graded.current.before, graded.current.at) : null;
  const promptText = mode === 'en-pt-choice' ? item.en : item.pt;
  const typing = mode === 'pt-en-type' || mode === 'listen-type' || mode === 'translate';
  const pct = Math.round((index / queue.length) * 100);

  const onTypeSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (outcome) {
      advance();
      return;
    }
    if (typed.trim() === '') return;
    if (mode === 'translate') {
      const result = checkTranslation(item, typed);
      if (result) {
        answer(result.ok, typed, result.ok && result.score < 1, result.words);
        return;
      }
    }
    const result = checkTyped(typed, item.en);
    answer(result !== 'wrong', typed, result === 'typo');
  };

  const submitBuild = () => {
    if (!build || outcome || built.length === 0) return;
    const words = built.map((i) => build.tiles[i] ?? '');
    answer(checkBuild(build.answer, words), words.join(' '));
  };

  const renderPrompt = () => {
    if ((mode === 'build' || mode === 'translate') && sentence) {
      return (
        <div>
          <p className="sentence-prompt">{sentence.pt}</p>
          {mode === 'translate' && <p className="muted cloze-hint">Use “{item.en}” ({item.pt}).</p>}
        </div>
      );
    }
    if (mode === 'spot-error' && spot) {
      return (
        <div>
          <div className="spot-words" role="group" aria-label="Toque na palavra errada">
            {spot.words.map((word, i) => {
              const isWrong = i === spot.wrongIndex;
              const isChosen = outcome?.chosen === `${i}`;
              let cls = 'chip';
              if (outcome && isWrong) cls += ' is-correct';
              else if (outcome && isChosen) cls += ' is-wrong';
              return (
                <motion.button
                  key={`${i}-${word}`}
                  type="button"
                  className={cls}
                  disabled={outcome !== null}
                  onClick={() => answer(isWrong, `${i}`)}
                  whileTap={outcome ? undefined : { scale: 0.92 }}
                  animate={outcome && isChosen && !isWrong ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
                >
                  {outcome && isWrong ? (
                    <>
                      <s>{spot.wrong}</s>
                      <span className="fix">{spot.right}</span>
                    </>
                  ) : (
                    word
                  )}
                </motion.button>
              );
            })}
          </div>
          {item.exPt && <p className="muted cloze-hint">{item.exPt}</p>}
        </div>
      );
    }
    if (mode === 'listen-choice' || mode === 'listen-type') {
      return (
        <div className="listen-box">
          <motion.button
            type="button"
            className="listen-btn"
            onClick={() => speak(item.en, 0.9)}
            whileTap={{ scale: 0.92 }}
            aria-label="Ouvir de novo"
          >
            <span className="ripple" aria-hidden="true" />
            <IconSpeaker />
          </motion.button>
          <button type="button" className="link-btn" onClick={() => speak(item.en, 0.6)}>
            Ouvir devagar
          </button>
        </div>
      );
    }
    if (mode === 'cloze-choice' && cloze) {
      return (
        <div className="cloze">
          <p className="cloze-sentence">
            {cloze.before}
            <span className={`blank${outcome ? (outcome.correct ? ' filled good' : ' filled bad') : ''}`}>
              {outcome ? cloze.answer : ' '}
            </span>
            {cloze.after}
          </p>
          {item.exPt && <p className="muted cloze-hint">{item.exPt}</p>}
        </div>
      );
    }
    return (
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <h1 className={promptText.length > 14 ? 'prompt-word small' : 'prompt-word'} style={{ flex: 1 }}>
          {promptText}
        </h1>
        {mode === 'en-pt-choice' && audioOn && <SpeakButton text={item.en} />}
      </div>
    );
  };

  const renderAnswerArea = () => {
    if (mode === 'spot-error') {
      return !outcome ? (
        <button type="button" className="link-btn" onClick={() => answer(false, null)} style={{ alignSelf: 'center' }}>
          Não sei
        </button>
      ) : null;
    }
    if (mode === 'build' && build) {
      const ok = outcome?.correct;
      return (
        <div className="options">
          <div className={`built${outcome ? (ok ? ' is-correct' : ' is-wrong') : ''}`} aria-label="Sua frase">
            {built.length === 0 && <span className="muted">Toque nas palavras na ordem certa</span>}
            {built.map((tile) => (
              <motion.button
                layout
                key={tile}
                type="button"
                className="chip on"
                disabled={outcome !== null}
                onClick={() => setBuilt((list) => list.filter((x) => x !== tile))}
              >
                {build.tiles[tile]}
              </motion.button>
            ))}
          </div>
          <div className="bank">
            {build.tiles.map((word, tile) => {
              const used = built.includes(tile);
              return (
                <motion.button
                  layout
                  key={`${tile}-${word}`}
                  type="button"
                  className={`chip${used ? ' used' : ''}`}
                  disabled={used || outcome !== null}
                  onClick={() => setBuilt((list) => [...list, tile])}
                  whileTap={{ scale: 0.92 }}
                >
                  {word}
                </motion.button>
              );
            })}
          </div>
          {!outcome && (
            <div className="row">
              <button type="button" className="btn btn-ghost" onClick={() => answer(false, null)}>
                Não sei
              </button>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={built.length === 0} onClick={submitBuild}>
                Verificar
              </button>
            </div>
          )}
        </div>
      );
    }
    if (typing) {
      return (
        <form onSubmit={onTypeSubmit} className="options">
          <motion.input
            className={`type-input${outcome ? (outcome.correct ? ' is-correct' : ' is-wrong') : ''}`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={mode === 'translate' ? 'Escreva a frase em inglês…' : mode === 'listen-type' ? 'Escreva o que ouviu…' : 'Digite aqui…'}
            aria-label="Sua resposta em inglês"
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            readOnly={outcome !== null}
            animate={outcome && !outcome.correct ? { x: [0, -12, 12, -8, 8, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
          />
          {!outcome && (
            <div className="row">
              <button type="button" className="btn btn-ghost" onClick={() => answer(false, null)}>
                Não sei
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={typed.trim() === ''}>
                Verificar
              </button>
            </div>
          )}
          {mode === 'listen-type' && !outcome && (
            <button type="button" className="link-btn" onClick={() => pauseKind('audio')} style={{ alignSelf: 'center' }}>
              Não posso ouvir agora (15 min)
            </button>
          )}
        </form>
      );
    }
    if (mode === 'speak') {
      return (
        <div className="speak-box">
          <motion.button
            type="button"
            className={`mic-btn${listening ? ' is-listening' : ''}${outcome ? (outcome.correct ? ' is-correct' : ' is-wrong') : ''}`}
            onClick={startListening}
            disabled={outcome !== null || listening}
            whileTap={{ scale: 0.92 }}
            aria-label={listening ? 'Ouvindo…' : 'Toque e fale em inglês'}
          >
            {listening && <span className="ripple" aria-hidden="true" />}
            <IconMic />
          </motion.button>
          <p className="muted" aria-live="polite" style={{ margin: 0, textAlign: 'center' }}>
            {outcome?.chosen
              ? `Você disse: "${outcome.chosen}"`
              : listening
                ? 'Ouvindo… fale agora'
                : micMsg ?? 'Toque no microfone e fale a resposta em inglês'}
          </p>
          {!outcome && (
            <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="link-btn" onClick={() => pauseKind('mic')}>
                Não posso falar agora (15 min)
              </button>
              <button type="button" className="link-btn" onClick={() => answer(false, null)}>
                Não sei
              </button>
            </div>
          )}
        </div>
      );
    }
    return (
      <>
        <div className="options" role="group" aria-label="Alternativas">
          {choices.map((choice, i) => {
            const isAnswer = choice === expected;
            const isChosen = outcome?.chosen === choice;
            let cls = 'option';
            if (outcome) {
              if (isAnswer) cls += ' is-correct';
              else if (isChosen) cls += ' is-wrong';
              else cls += ' is-dim';
            }
            return (
              <motion.button
                key={choice}
                type="button"
                className={cls}
                disabled={outcome !== null}
                onClick={() => answer(isAnswer, choice)}
                initial={{ opacity: 0, y: 14 }}
                animate={
                  outcome && isChosen && !isAnswer
                    ? { opacity: 1, y: 0, x: [0, -12, 12, -8, 8, 0] }
                    : outcome && isAnswer
                      ? { opacity: 1, y: 0, scale: [1, 1.04, 1] }
                      : { opacity: 1, y: 0 }
                }
                transition={{ delay: outcome ? 0 : 0.05 * i, duration: outcome ? 0.4 : 0.3 }}
                whileTap={outcome ? undefined : { scale: 0.97 }}
              >
                <span className="key">{i + 1}</span>
                <span>{choice}</span>
                {outcome && isAnswer && <IconCheck className="mark" />}
                {outcome && isChosen && !isAnswer && <IconX className="mark" />}
              </motion.button>
            );
          })}
        </div>
        {mode === 'listen-choice' && !outcome && (
          <button type="button" className="link-btn" onClick={() => pauseKind('audio')} style={{ alignSelf: 'center' }}>
            Não posso ouvir agora (15 min)
          </button>
        )}
      </>
    );
  };

  return (
    <section className="screen" aria-label="Sessão de estudo">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={onExit} aria-label="Sair da sessão">
          <IconX />
        </button>
        <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da sessão">
          <motion.div initial={false} animate={{ width: `${Math.max(4, pct)}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        </div>
        <div className="combo" aria-live="polite">
          <AnimatePresence>
            {combo >= 2 && (
              <motion.span
                key={combo}
                className="row"
                style={{ justifyContent: 'center', gap: 2 }}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: [1.5, 1], opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <IconBolt width={16} height={16} /> x{combo}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${index}-${step.itemId}-${mode}`}
          className="stage"
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -28, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        >
          {step.kind === 'match' ? (
            <MatchRound items={matchItems} audioOn={audioOn} soundsOn={soundsOn} onDone={finishMatch} />
          ) : step.kind === 'intro' ? (
            <div className="intro-card glass">
              <span className="badge">Nova</span>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <h1 className={item.en.length > 14 ? 'prompt-word small' : 'prompt-word'} style={{ flex: 1 }}>
                  {item.en}
                </h1>
                {audioOn && <SpeakButton text={item.en} />}
              </div>
              <p className="translation">{item.pt}</p>
              {item.ex && (
                <div className="example">
                  <div style={{ flex: 1 }}>
                    <p className="en">{item.ex}</p>
                    <p className="pt">{item.exPt}</p>
                  </div>
                  {audioOn && <SpeakButton text={item.ex} size="small" />}
                </div>
              )}
              {notes[item.en.toLowerCase()] && <p className="tip">💡 {notes[item.en.toLowerCase()]}</p>}
              <button type="button" className="btn btn-primary btn-block" onClick={continueIntro} autoFocus>
                Entendi
              </button>
            </div>
          ) : (
            <>
              <div className="prompt">
                <p className="eyebrow">{LABEL[mode]}</p>
                {renderPrompt()}
              </div>
              {renderAnswerArea()}
              {outcome && <div style={{ height: outcome.correct ? 320 : 340 }} aria-hidden="true" />}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {outcome && (
          <motion.div
            className={`sheet ${outcome.correct ? 'good' : 'bad'}`}
            role="status"
            aria-live="assertive"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            <div className="sheet-inner">
              <h3>
                <motion.span
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15, delay: 0.05 }}
                  style={{ display: 'inline-flex' }}
                >
                  {outcome.correct ? <IconCheck /> : <IconX />}
                </motion.span>
                {title}
              </h3>
              {sentence ? (
                <>
                  <p className="answer-line">{sentence.en}</p>
                  <p className="muted" style={{ margin: 0 }}>
                    {sentence.pt}
                  </p>
                  {outcome.check && outcome.check.some((w) => !w.ok) && (
                    <p className="word-check" aria-label="Palavras que faltaram ou mudaram">
                      {outcome.check.map((w, i) => (
                        <span key={`${i}-${w.word}`} className={w.ok ? undefined : 'miss'}>
                          {w.word}
                        </span>
                      ))}
                    </p>
                  )}
                </>
              ) : (
                <p className="answer-line">
                  {item.en} <span className="muted">— {item.pt}</span>
                </p>
              )}
              {outcome.typo && !sentence && (
                <p className="muted" style={{ margin: 0 }}>
                  Grafia certa: <strong style={{ color: 'var(--text)' }}>{item.en}</strong>
                </p>
              )}
              {preview && (
                <div className="rating" role="group" aria-label="Como foi lembrar? (ajusta quando a palavra volta)">
                  {(['hard', 'good', 'easy'] as const).map((r) => {
                    const days = preview[r];
                    return (
                      <button key={r} type="button" className={`rate${rating === r ? ' on' : ''}`} onClick={() => rate(r)} aria-pressed={rating === r}>
                        <strong>{r === 'hard' ? 'Difícil' : r === 'good' ? 'Bom' : 'Fácil'}</strong>
                        <span>volta em {days} {days === 1 ? 'dia' : 'dias'}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {!outcome.correct && (
                <div className="why">
                  <p className="eyebrow">Por quê?</p>
                  <ul>
                    {outcome.why.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                    Essa volta daqui a pouco para você fixar.
                  </p>
                </div>
              )}
              {outcome.correct && item.ex && !sentence && (
                <div className="example">
                  <div style={{ flex: 1 }}>
                    <p className="en">{item.ex}</p>
                    <p className="pt">{item.exPt}</p>
                  </div>
                  {audioOn && <SpeakButton text={item.ex} size="small" />}
                </div>
              )}
              <button type="button" className={`btn btn-block ${outcome.correct ? 'btn-good' : 'btn-bad'}`} onClick={advance} autoFocus>
                Continuar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Confetti burst={burst} amount={combo > 0 && combo % 5 === 0 ? 48 : 22} />
    </section>
  );
}
