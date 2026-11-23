import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Confetti } from '../components/Confetti';
import { IconArrowLeft, IconMic, IconSpeaker } from '../components/Icons';
import { matchSpoken } from '../lib/answer';
import { checkBuild, explainBuild, isMyTurn, myTurns, phrasesOf, stars as starsFor, tokens, type ChatOption, type Situation } from '../lib/chat';
import { speechSupport, listen, type Listening  } from '../lib/listen';
import { capabilities, pause, pausedMinutes, type Progress } from '../lib/progress';
import { shuffle } from '../lib/session';
import { playComplete, playCorrect, playWrong } from '../lib/sfx';
import { canSpeak, speak, vibrate } from '../lib/speech';

interface Bubble {
  id: number;
  from: 'them' | 'me' | 'scene';
  who?: string;
  text: string;
  pt: string;
}

interface Props {
  situation: Situation;
  progress: Progress;
  updateProgress: (fn: (p: Progress) => Progress) => void;
  onComplete: (stars: number) => void;
  onBack: () => void;
}

/** Recalculado a cada uso: sem internet no Android, o microfone sai de cena. */
const support = () => speechSupport(canSpeak());

export function Chat({ situation, progress, updateProgress, onComplete, onBack }: Props) {
  const [pos, setPos] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [typing, setTyping] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [missed, setMissed] = useState<Set<number>>(new Set());
  const [picked, setPicked] = useState<{ word: string; key: number }[]>([]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [listening, setListening] = useState(false);
  const [micMsg, setMicMsg] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  const recognition = useRef<Listening | null>(null);
  const completed = useRef(false);

  const now = Date.now();
  const audioOn = pausedMinutes(progress, 'audio', now) === 0;
  const caps = capabilities(progress, now, support());
  const voiceOn = progress.settings.autoAudio && audioOn;
  const soundsOn = progress.settings.sounds && audioOn;
  const step = situation.steps[pos];
  const total = myTurns(situation);
  const answered = situation.steps.slice(0, pos).filter(isMyTurn).length;

  const push = useCallback((from: Bubble['from'], text: string, pt: string, who?: string) => {
    nextId.current += 1;
    const id = nextId.current;
    setBubbles((b) => [...b, who ? { id, from, text, pt, who } : { id, from, text, pt }]);
  }, []);

  // Falas da outra pessoa: "digitando…" e depois a mensagem (com voz).
  useEffect(() => {
    if (!step) {
      if (!finished && pos > 0) {
        setFinished(true);
        if (!completed.current) {
          completed.current = true;
          if (soundsOn) playComplete();
          onComplete(starsFor(missed.size));
        }
      }
      return;
    }
    if (step.kind === 'scene') {
      const timer = setTimeout(() => {
        push('scene', step.text, step.pt);
        setPos((p) => p + 1);
      }, 900);
      return () => clearTimeout(timer);
    }
    if (step.kind !== 'them') return;
    setTyping(true);
    const delay = 600 + Math.min(step.text.length * 18, 900);
    const timer = setTimeout(() => {
      setTyping(false);
      push('them', step.text, step.pt, step.who);
      if (voiceOn) speak(step.text);
      setPos((p) => p + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [pos]);

  useEffect(() => {
    // No fim, mostra o começo do cartão de conclusão (estrelas); antes, acompanha a última mensagem.
    if (finished) doneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [bubbles, typing, feedback, finished, pos]);

  // Para o microfone ao mudar de turno.
  useEffect(() => {
    setMicMsg(null);
    setPicked([]);
    return () => {
      recognition.current?.stop();
      recognition.current = null;
      setListening(false);
    };
  }, [pos]);

  const options = useMemo(() => (step?.kind === 'choose' ? shuffle(step.options, Math.random) : []), [pos]);
  const bank = useMemo(() => {
    if (step?.kind !== 'build') return [];
    return shuffle([...tokens(step.text), ...step.extra], Math.random).map((word, key) => ({ word, key }));
  }, [pos]);

  const succeed = (text: string, pt: string) => {
    if (soundsOn) playCorrect();
    vibrate(20);
    setFeedback(null);
    push('me', text, pt);
    setPos((p) => p + 1);
  };

  const fail = (why: string) => {
    if (soundsOn) playWrong();
    vibrate([70, 50, 70]);
    setMissed((m) => new Set(m).add(pos));
    setFeedback(why);
  };

  const choose = (option: ChatOption) => {
    if (option.ok) succeed(option.text, option.pt);
    else fail(option.why ?? `"${option.text}" não é a melhor resposta aqui.`);
  };

  const sendBuild = () => {
    if (step?.kind !== 'build') return;
    const words = picked.map((p) => p.word);
    if (checkBuild(words, step.text)) succeed(step.text, step.pt);
    else fail(explainBuild(words, step));
  };

  const startListening = () => {
    if (!isMyTurn(step) || listening) return;
    setMicMsg(null);
    setListening(true);
    const session = listen();
    recognition.current = session;
    session.result
      .then((heard) => {
        if (recognition.current !== session) return;
        setListening(false);
        if (heard.length === 0) {
          setMicMsg('Não ouvi nada. Toque no microfone e fale de novo.');
          return;
        }
        if (step.kind === 'build') {
          if (matchSpoken(heard, step.text)) succeed(step.text, step.pt);
          else setMicMsg(`Entendi "${heard[0]}". Tente de novo ou monte a frase.`);
          return;
        }
        const match = step.options.find((o) => matchSpoken(heard, o.text));
        if (match) choose(match);
        else setMicMsg(`Entendi "${heard[0]}". Tente de novo ou toque numa resposta.`);
      })
      .catch(() => {
        if (recognition.current !== session) return;
        setListening(false);
        setMicMsg('O microfone não funcionou agora (precisa de permissão e internet).');
      });
  };

  const toggleReveal = (id: number) =>
    setRevealed((r) => {
      const next = new Set(r);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const myTurn = isMyTurn(step) && !typing;
  const earned = starsFor(missed.size);

  return (
    <section className="chat" aria-label={`Conversa: ${situation.title}`}>
      <header className="chat-head">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Voltar">
          <IconArrowLeft />
        </button>
        <div className="avatar" aria-hidden="true">
          {situation.emoji}
        </div>
        <div className="chat-who">
          <h1>{situation.partner.name}</h1>
          <span>{typing ? 'digitando…' : situation.partner.role}</span>
        </div>
        <span className="chat-count" aria-label={`${answered} de ${total} respostas`}>
          {answered}/{total}
        </span>
      </header>

      <div className="chat-log" role="log" aria-live="polite">
        <p className="chat-scene">
          {situation.emoji} {situation.title}: {situation.subtitle}. Toque numa mensagem para ver a tradução.
        </p>
        {bubbles.map((b) =>
          b.from === 'scene' ? (
            <motion.button
              key={b.id}
              type="button"
              className="scene-note"
              onClick={() => toggleReveal(b.id)}
              aria-expanded={revealed.has(b.id)}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <span>🎬 {b.text}</span>
              {revealed.has(b.id) && <small>{b.pt}</small>}
            </motion.button>
          ) : (
          <motion.div
            key={b.id}
            className={`bubble-row ${b.from}`}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          >
            <button type="button" className={`bubble ${b.from}`} onClick={() => toggleReveal(b.id)} aria-expanded={revealed.has(b.id)}>
              {b.who && <em className="who">{b.who}</em>}
              <span>{b.text}</span>
              {revealed.has(b.id) && <small>{b.pt}</small>}
            </button>
            {audioOn && (
              <button type="button" className="bubble-audio" onClick={() => speak(b.text)} aria-label={`Ouvir: ${b.text}`}>
                <IconSpeaker />
              </button>
            )}
          </motion.div>
          ),
        )}
        <AnimatePresence>
          {typing && (
            <motion.div className="bubble-row them" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bubble them typing" aria-label="digitando">
                <i />
                <i />
                <i />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {finished && (
          <motion.div ref={doneRef} className="chat-done glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <p className="stars" aria-label={`${earned} de 3 estrelas`}>
              {[1, 2, 3].map((n) => (
                <motion.span key={n} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 + n * 0.15, type: 'spring' }} className={n <= earned ? 'on' : ''}>
                  ★
                </motion.span>
              ))}
            </p>
            <h2>Situação concluída!</h2>
            <p className="muted" style={{ margin: 0 }}>
              {missed.size === 0 ? 'Sem nenhum erro. Você está pronto para a vida real!' : `Você tropeçou em ${missed.size} ${missed.size === 1 ? 'resposta' : 'respostas'}. Repita para fixar.`}
            </p>
            <p className="eyebrow" style={{ marginTop: 6 }}>
              Frases desta conversa
            </p>
            <ul className="phrase-list">
              {phrasesOf(situation).map((p) => (
                <li key={p.text}>
                  <div>
                    <strong>{p.text}</strong>
                    <span>{p.pt}</span>
                  </div>
                  {audioOn && (
                    <button type="button" className="bubble-audio" onClick={() => speak(p.text)} aria-label={`Ouvir: ${p.text}`}>
                      <IconSpeaker />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      <div className="composer">
        {finished ? (
          <div className="row">
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onBack}>
              Voltar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => {
                completed.current = false;
                nextId.current = 0;
                setBubbles([]);
                setMissed(new Set());
                setRevealed(new Set());
                setFinished(false);
                setFeedback(null);
                setPos(0);
              }}
            >
              Repetir
            </button>
          </div>
        ) : myTurn && step ? (
          <>
            <p className="goal">🎯 {step.goal}</p>
            <AnimatePresence>
              {feedback && (
                <motion.p className="chat-feedback" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: [0, -8, 8, -4, 0] }} exit={{ opacity: 0 }} role="alert">
                  {feedback}
                </motion.p>
              )}
            </AnimatePresence>
            {step.kind === 'choose' ? (
              <div className="replies">
                {options.map((o) => (
                  <motion.button key={o.text} type="button" className="reply" onClick={() => choose(o)} whileTap={{ scale: 0.97 }}>
                    {o.text}
                  </motion.button>
                ))}
              </div>
            ) : (
              <>
                <div className="built" aria-label="Sua frase">
                  {picked.length === 0 && <span className="muted">Toque nas palavras na ordem certa</span>}
                  {picked.map((p) => (
                    <motion.button
                      layout
                      key={p.key}
                      type="button"
                      className="chip on"
                      onClick={() => setPicked((list) => list.filter((x) => x.key !== p.key))}
                    >
                      {p.word}
                    </motion.button>
                  ))}
                </div>
                <div className="bank">
                  {bank.map((b) => {
                    const used = picked.some((p) => p.key === b.key);
                    return (
                      <motion.button
                        layout
                        key={b.key}
                        type="button"
                        className={`chip${used ? ' used' : ''}`}
                        disabled={used}
                        onClick={() => setPicked((list) => [...list, b])}
                        whileTap={{ scale: 0.92 }}
                      >
                        {b.word}
                      </motion.button>
                    );
                  })}
                </div>
                <button type="button" className="btn btn-primary btn-block" onClick={sendBuild} disabled={picked.length === 0}>
                  Enviar
                </button>
              </>
            )}
            {caps.mic && (
              <div className="row" style={{ justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className={`mini-mic${listening ? ' is-listening' : ''}`} onClick={startListening} disabled={listening}>
                  <IconMic /> {listening ? 'Ouvindo…' : 'Responder falando'}
                </button>
                <button type="button" className="link-btn" onClick={() => updateProgress((p) => pause(p, 'mic', Date.now()))}>
                  Sem microfone (15 min)
                </button>
              </div>
            )}
            {micMsg && <p className="muted" style={{ margin: 0, textAlign: 'center', fontSize: 14 }}>{micMsg}</p>}
          </>
        ) : (
          <p className="muted" style={{ margin: 0, textAlign: 'center' }}>
            {situation.partner.name} está digitando…
          </p>
        )}
      </div>

      <Confetti burst={finished ? 1 : 0} amount={50} />
    </section>
  );
}
