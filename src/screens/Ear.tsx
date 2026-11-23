import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { pack1 } from '../data/pack1';
import type { Item } from '../data/types';
import { IconArrowLeft, IconMic, IconSpeaker } from '../components/Icons';
import { compareWords, type WordCheck } from '../lib/compare';
import { speechSupport, listen, type Listening  } from '../lib/listen';
import { capabilities, pause, type Progress } from '../lib/progress';
import { shuffle } from '../lib/session';
import { playComplete, playCorrect, playWrong } from '../lib/sfx';
import { canSpeak, speak, stopSpeaking, vibrate } from '../lib/speech';

type Kind = 'dictation' | 'shadowing';
const ROUND = 6;
/** Recalculado a cada uso: sem internet no Android, o microfone sai de cena. */
const support = () => speechSupport(canSpeak());

interface Props {
  pool: Item[];
  progress: Progress;
  updateProgress: (fn: (p: Progress) => Progress) => void;
  onRoundDone: (kind: Kind) => void;
  onBack: () => void;
}

/** Frases de exemplo das palavras já vistas (completa com o pacote 1 no começo). */
function pickSentences(pool: Item[], progress: Progress): { en: string; pt: string }[] {
  const seen = pool.filter((i) => progress.cards[i.id] && i.ex && i.exPt);
  const base = seen.length >= ROUND ? seen : [...seen, ...pack1.items.filter((i) => i.ex && i.exPt && !progress.cards[i.id]).slice(0, 30)];
  return shuffle(base, Math.random)
    .slice(0, ROUND)
    .map((i) => ({ en: i.ex ?? '', pt: i.exPt ?? '' }));
}

export function Ear({ pool, progress, updateProgress, onRoundDone, onBack }: Props) {
  const caps = capabilities(progress, Date.now(), support());
  const canDictation = caps.audio;
  const canShadowing = caps.audio && caps.mic;
  const [kind, setKind] = useState<Kind | null>(null);
  const [round, setRound] = useState(0);
  const sentences = useMemo(() => pickSentences(pool, progress), [round]);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<{ words: WordCheck[]; score: number; heard?: string } | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [listening, setListening] = useState(false);
  const [micMsg, setMicMsg] = useState<string | null>(null);
  const rec = useRef<Listening | null>(null);
  const soundsOn = progress.settings.sounds && caps.audio;
  const sentence = sentences[idx];
  const finished = kind !== null && idx >= sentences.length;

  useEffect(() => {
    if (kind && sentence && !result) speak(sentence.en, 0.85);
  }, [kind, idx, round]);

  useEffect(
    () => () => {
      stopSpeaking();
      rec.current?.stop();
    },
    [],
  );

  const grade = (expected: string, got: string, heard?: string) => {
    const r = compareWords(expected, got);
    setResult({ ...r, heard });
    setScores((s) => [...s, r.score]);
    if (r.score >= 0.8) {
      vibrate(20);
      if (soundsOn) playCorrect();
    } else {
      vibrate([70, 50, 70]);
      if (soundsOn) playWrong();
    }
  };

  const next = () => {
    setResult(null);
    setTyped('');
    setMicMsg(null);
    if (idx + 1 >= sentences.length) {
      if (kind) onRoundDone(kind);
      if (soundsOn) playComplete();
    }
    setIdx(idx + 1);
  };

  const onDictation = (e: FormEvent) => {
    e.preventDefault();
    if (!sentence || result || !typed.trim()) return;
    grade(sentence.en, typed);
  };

  const record = () => {
    if (!sentence || listening) return;
    stopSpeaking();
    setMicMsg(null);
    setListening(true);
    const session = listen(9000);
    rec.current = session;
    session.result
      .then((alts) => {
        if (rec.current !== session) return;
        setListening(false);
        if (alts.length === 0) {
          setMicMsg('Não ouvi nada. Toque e repita a frase.');
          return;
        }
        // Usa a alternativa do reconhecimento que mais se parece com a frase.
        const best = alts.map((a) => ({ a, s: compareWords(sentence.en, a).score })).sort((x, y) => y.s - x.s)[0];
        if (best) grade(sentence.en, best.a, best.a);
      })
      .catch(() => {
        if (rec.current !== session) return;
        setListening(false);
        setMicMsg('O microfone não funcionou agora (precisa de permissão e internet).');
      });
  };

  const restart = (k: Kind) => {
    setKind(k);
    setRound((r) => r + 1);
    setIdx(0);
    setScores([]);
    setResult(null);
    setTyped('');
  };

  const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) : 0;

  return (
    <section className="screen" aria-label="Ditado e shadowing">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={() => (kind && !finished ? setKind(null) : onBack())} aria-label="Voltar">
          <IconArrowLeft />
        </button>
        <h1 className="page-title">{kind === 'dictation' ? 'Ditado' : kind === 'shadowing' ? 'Shadowing' : 'Ditado e shadowing'}</h1>
        {kind && !finished && (
          <span className="chat-count">
            {idx + 1}/{sentences.length}
          </span>
        )}
      </div>

      {kind === null && (
        <>
          <p className="muted" style={{ margin: 0 }}>
            Treino de ouvido com frases das palavras que você já viu. Rodadas de {ROUND} frases.
          </p>
          <button type="button" className="mode-card glass" disabled={!canDictation} onClick={() => restart('dictation')}>
            <span className="tile-emoji">✍️</span>
            <span>
              <strong>Ditado</strong>
              <span className="muted">Ouça a frase e escreva o que ouviu. O app mostra palavra por palavra o que você acertou.</span>
              {!canDictation && <span className="muted small">Precisa de áudio (está pausado ou indisponível).</span>}
            </span>
          </button>
          <button type="button" className="mode-card glass" disabled={!canShadowing} onClick={() => restart('shadowing')}>
            <span className="tile-emoji">🗣️</span>
            <span>
              <strong>Shadowing</strong>
              <span className="muted">Ouça e repita em voz alta, imitando o ritmo. O app confere o que entendeu da sua fala.</span>
              {!canShadowing && <span className="muted small">Precisa de áudio e microfone (pausados ou indisponíveis neste navegador).</span>}
            </span>
          </button>
        </>
      )}

      {kind && sentence && (
        <AnimatePresence mode="wait">
          <motion.div key={`${round}-${idx}`} className="stage" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="listen-box">
              <motion.button type="button" className="listen-btn" onClick={() => speak(sentence.en, 0.85)} whileTap={{ scale: 0.92 }} aria-label="Ouvir de novo">
                <IconSpeaker />
              </motion.button>
              <button type="button" className="link-btn" onClick={() => speak(sentence.en, 0.6)}>
                Ouvir devagar
              </button>
            </div>

            {kind === 'shadowing' && (
              <p className="shadow-text">
                {sentence.en}
                <span className="muted">{sentence.pt}</span>
              </p>
            )}

            {kind === 'dictation' && !result && (
              <form className="options" onSubmit={onDictation}>
                <input
                  className="type-input"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Escreva o que ouviu…"
                  aria-label="Frase que você ouviu"
                  autoFocus
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                <button type="submit" className="btn btn-primary btn-block" disabled={!typed.trim()}>
                  Conferir
                </button>
              </form>
            )}

            {kind === 'shadowing' && !result && (
              <div className="speak-box">
                <motion.button type="button" className={`mic-btn${listening ? ' is-listening' : ''}`} onClick={record} disabled={listening} whileTap={{ scale: 0.92 }} aria-label={listening ? 'Ouvindo…' : 'Repetir em voz alta'}>
                  {listening && <span className="ripple" aria-hidden="true" />}
                  <IconMic />
                </motion.button>
                <p className="muted" style={{ margin: 0, textAlign: 'center' }} aria-live="polite">
                  {listening ? 'Ouvindo… repita a frase' : micMsg ?? 'Ouça e toque no microfone para repetir'}
                </p>
                <button type="button" className="link-btn" onClick={() => updateProgress((p) => pause(p, 'mic', Date.now()))}>
                  Não posso falar agora (15 min)
                </button>
              </div>
            )}

            {result && (
              <motion.div className="ear-result glass" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <p className="eyebrow">{Math.round(result.score * 100)}% das palavras</p>
                <p className="word-check">
                  {result.words.map((w, i) => (
                    <span key={i} className={w.ok ? 'ok' : 'miss'}>
                      {w.word}
                    </span>
                  ))}
                </p>
                {result.heard && <p className="muted small">O microfone entendeu: "{result.heard}"</p>}
                {kind === 'dictation' && <p className="muted small">Você escreveu: "{typed}"</p>}
                <p className="muted small">{sentence.pt}</p>
                <div className="row">
                  {kind === 'shadowing' && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setScores((s) => s.slice(0, -1));
                        setResult(null);
                      }}
                    >
                      Tentar de novo
                    </button>
                  )}
                  <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={next} autoFocus>
                    {idx + 1 < sentences.length ? 'Próxima' : 'Ver resultado'}
                  </button>
                </div>
              </motion.div>
            )}
            {kind === 'dictation' && !result && (
              <button type="button" className="link-btn" style={{ alignSelf: 'center' }} onClick={() => updateProgress((p) => pause(p, 'audio', Date.now()))}>
                Não posso ouvir agora (15 min)
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {finished && (
        <motion.div className="chat-done glass" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <p className="stars">{avg >= 90 ? '🎧🎧🎧' : avg >= 60 ? '🎧🎧' : '🎧'}</p>
          <h2>Rodada concluída!</h2>
          <p className="muted" style={{ margin: 0 }}>
            Você acertou em média {avg}% das palavras. {avg >= 80 ? 'Ouvido afiado!' : 'Repetir ajuda muito: o ouvido se acostuma rápido.'}
          </p>
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onBack}>
              Voltar
            </button>
            <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => kind && restart(kind)}>
              Nova rodada
            </button>
          </div>
        </motion.div>
      )}
    </section>
  );
}
