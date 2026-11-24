import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { getItem } from '../data/packs';
import { IconArrowLeft, IconMic, IconSpeaker } from '../components/Icons';
import { AiError, type AiCaller } from '../lib/ai';
import { formatStudy } from '../lib/miller';
import { listen, recognitionUsable, type Listening } from '../lib/listen';
import type { AiMistake, Progress } from '../lib/progress';
import { playComplete } from '../lib/sfx';
import { canSpeak, speak, stopSpeaking } from '../lib/speech';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

interface Report {
  summary_pt: string;
  mistakes: AiMistake[];
  new_words: { en: string; pt: string; example: string }[];
  encouragement_pt: string;
}

interface Props {
  progress: Progress;
  call: AiCaller | null;
  onFinish: (report: Report, ms: number) => void;
  onAddWords: (words: { en: string; pt: string; example: string }[]) => void;
  onSettings: () => void;
  onBack: () => void;
}

const TOPICS = [
  { id: '', label: '🌤️ Livre' },
  { id: 'the learner’s day and routine', label: '☕ Meu dia' },
  { id: 'work, creating AI videos and images', label: '🎬 Trabalho' },
  { id: 'travel and visiting other countries', label: '✈️ Viagens' },
  { id: 'movies and TV series', label: '🍿 Filmes e séries' },
  { id: 'food and restaurants', label: '🍝 Comida' },
];

const SUGGESTED_MS = 15 * 60_000;

export function Endurance({ progress, call, onFinish, onAddWords, onSettings, onBack }: Props) {
  const [phase, setPhase] = useState<'intro' | 'call' | 'report'>('intro');
  const [topic, setTopic] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [listening, setListening] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [added, setAdded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(0);
  const rec = useRef<Listening | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const micOk = recognitionUsable();
  const voiceOn = canSpeak() && progress.settings.autoAudio;

  // Palavras recentes do aprendiz, para a IA usar na conversa.
  const words = useMemo(
    () =>
      Object.entries(progress.cards)
        .sort((a, b) => b[1].lastSeen - a[1].lastSeen)
        .slice(0, 40)
        .map(([id]) => getItem(id)?.en)
        .filter((w): w is string => Boolean(w)),
    [progress.cards],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, busy]);

  useEffect(() => {
    if (phase !== 'call') return;
    const t = setInterval(() => setElapsed(Date.now() - started.current), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(
    () => () => {
      stopSpeaking();
      rec.current?.stop();
    },
    [],
  );

  const send = async (history: Turn[]) => {
    if (!call) return;
    setBusy(true);
    setError(null);
    try {
      const out = await call('/chat', { messages: history, words, level: 'basic (A2)', topic });
      const reply = typeof out.reply === 'string' ? out.reply : '';
      setTurns([...history, { role: 'assistant', content: reply }]);
      if (voiceOn && reply) speak(reply, 0.9);
    } catch (err) {
      setError(err instanceof AiError ? err.message : 'Algo deu errado. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const startCall = () => {
    started.current = Date.now();
    setElapsed(0);
    setTurns([]);
    setPhase('call');
    void send([]);
  };

  const say = (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    void send([...turns, { role: 'user', content: clean }]);
  };

  const onType = (e: FormEvent) => {
    e.preventDefault();
    say(typed);
    setTyped('');
  };

  const record = () => {
    if (listening || busy) return;
    stopSpeaking();
    setError(null);
    setListening(true);
    const session = listen(12_000);
    rec.current = session;
    session.result
      .then((alts) => {
        if (rec.current !== session) return;
        setListening(false);
        if (alts[0]) say(alts[0]);
        else setError('Não ouvi nada. Toque no microfone e fale de novo, ou digite.');
      })
      .catch(() => {
        if (rec.current !== session) return;
        setListening(false);
        setError('O microfone não funcionou agora. Você pode digitar a resposta.');
      });
  };

  const endCall = async () => {
    if (!call) return;
    stopSpeaking();
    const ms = Date.now() - started.current;
    if (!turns.some((t) => t.role === 'user')) {
      setPhase('intro');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const out = (await call('/report', { messages: turns })) as unknown as Report;
      const safe: Report = {
        summary_pt: out.summary_pt ?? '',
        mistakes: Array.isArray(out.mistakes) ? out.mistakes : [],
        new_words: Array.isArray(out.new_words) ? out.new_words : [],
        encouragement_pt: out.encouragement_pt ?? '',
      };
      setReport(safe);
      setPhase('report');
      if (progress.settings.sounds) playComplete();
      onFinish(safe, ms);
    } catch (err) {
      setError(err instanceof AiError ? err.message : 'Não consegui gerar o relatório. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <div className="topbar">
      <button
        type="button"
        className="icon-btn"
        onClick={() => {
          stopSpeaking();
          onBack();
        }}
        aria-label="Voltar"
      >
        <IconArrowLeft />
      </button>
      <h1 className="page-title">📞 Chamada da Endurance</h1>
      {phase === 'call' && <span className="chat-count">{formatStudy(elapsed)}</span>}
    </div>
  );

  if (!call) {
    return (
      <section className="screen" aria-label="Chamada da Endurance">
        {header}
        <div className="settings-card glass">
          <p className="eyebrow">Falta ligar o servidor da IA</p>
          <p className="muted small" style={{ margin: 0 }}>
            A conversa usa o Claude por meio do seu servidor na Cloudflare. Configure o endereço e o código de acesso em Ajustes → Servidor da IA.
          </p>
          <button type="button" className="btn btn-primary btn-block" onClick={onSettings}>
            Abrir Ajustes
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="screen" aria-label="Chamada da Endurance">
      {header}

      {phase === 'intro' && (
        <>
          <p className="muted" style={{ margin: 0 }}>
            Uma conversa por voz com a Endurance, sua parceira de inglês. Ela fala devagar, usa as palavras que você está estudando e não interrompe para corrigir: no fim da chamada você recebe um relatório com os erros e as palavras novas. Precisa de internet.
          </p>
          <p className="eyebrow">Assunto</p>
          <div className="suggest-row" role="radiogroup" aria-label="Assunto da conversa">
            {TOPICS.map((t) => (
              <button key={t.label} type="button" role="radio" aria-checked={topic === t.id} className={`suggest${topic === t.id ? ' on' : ''}`} onClick={() => setTopic(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          {!micOk && (
            <p className="muted small" style={{ margin: 0 }}>
              Neste aparelho o app não consegue ouvir pelo microfone. Responda digitando — no iPhone, use o microfone do teclado para ditar.
            </p>
          )}
          <motion.button type="button" className="btn btn-primary btn-block" onClick={startCall} whileTap={{ scale: 0.96 }}>
            📞 Começar a chamada
          </motion.button>
          <p className="muted small" style={{ margin: 0 }}>
            Chamadas feitas: {progress.calls.done}. Sugestão: uns 15 minutos por dia.
          </p>
        </>
      )}

      {phase === 'call' && (
        <>
          <div className="chat-log endurance-log" role="log" aria-live="polite">
            {turns.map((t, i) => (
              <motion.div key={i} className={`bubble-row ${t.role === 'user' ? 'me' : 'them'}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className={`bubble ${t.role === 'user' ? 'me' : 'them'}`}>
                  {t.role === 'assistant' && <em className="who">Endurance</em>}
                  <span>{t.content}</span>
                </div>
                {t.role === 'assistant' && canSpeak() && (
                  <button type="button" className="bubble-audio" onClick={() => speak(t.content, 0.85)} aria-label="Ouvir de novo">
                    <IconSpeaker />
                  </button>
                )}
              </motion.div>
            ))}
            <AnimatePresence>
              {busy && (
                <motion.div className="bubble-row them" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="bubble them typing" aria-label="pensando">
                    <i />
                    <i />
                    <i />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={endRef} />
          </div>

          {error && (
            <p className="chat-feedback" role="alert">
              {error}
            </p>
          )}
          {elapsed >= SUGGESTED_MS && <p className="flash">⏱️ 15 minutos! Pode encerrar quando quiser para ver o relatório.</p>}

          <div className="call-controls">
            {micOk && (
              <motion.button
                type="button"
                className={`mic-btn${listening ? ' is-listening' : ''}`}
                onClick={record}
                disabled={busy || listening}
                whileTap={{ scale: 0.92 }}
                aria-label={listening ? 'Ouvindo…' : 'Falar'}
              >
                {listening && <span className="ripple" aria-hidden="true" />}
                <IconMic />
              </motion.button>
            )}
            <form className="row" style={{ width: '100%' }} onSubmit={onType}>
              <input
                className="type-input"
                style={{ flex: 1, minHeight: 52, fontSize: 17 }}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={micOk ? 'Ou digite aqui…' : 'Digite (ou dite pelo teclado)…'}
                aria-label="Sua resposta em inglês"
                autoCapitalize="sentences"
              />
              <button type="submit" className="btn btn-primary" disabled={!typed.trim() || busy}>
                Enviar
              </button>
            </form>
            <button type="button" className="btn btn-bad btn-block" onClick={() => void endCall()} disabled={busy}>
              Encerrar e ver o relatório
            </button>
          </div>
        </>
      )}

      {phase === 'report' && report && (
        <motion.div className="chat-done glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'left' }}>
          <h2 style={{ textAlign: 'center' }}>Fim da transmissão 🛰️</h2>
          <p style={{ margin: 0 }}>{report.summary_pt}</p>
          {report.mistakes.length > 0 && (
            <>
              <p className="eyebrow">Para melhorar ({report.mistakes.length})</p>
              <ul className="mistake-list">
                {report.mistakes.map((m, i) => (
                  <li key={i}>
                    <span className="said">{m.said}</span>
                    <span className="better">→ {m.better}</span>
                    <span className="muted small">{m.why_pt}</span>
                  </li>
                ))}
              </ul>
              <p className="muted small" style={{ margin: 0 }}>
                As versões corretas foram para o seu Caderno de erros e para "Minhas frases".
              </p>
            </>
          )}
          {report.new_words.length > 0 && (
            <>
              <p className="eyebrow">Palavras e frases para estudar</p>
              <ul className="phrase-list">
                {report.new_words.map((w) => (
                  <li key={w.en}>
                    <div>
                      <strong>{w.en}</strong>
                      <span>
                        {w.pt} · <em>{w.example}</em>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn btn-ghost btn-block"
                disabled={added}
                onClick={() => {
                  onAddWords(report.new_words);
                  setAdded(true);
                }}
              >
                {added ? '✓ Adicionadas às Minhas frases' : '➕ Adicionar aos meus estudos'}
              </button>
            </>
          )}
          {report.encouragement_pt && <p className="flash">{report.encouragement_pt}</p>}
          <div className="row">
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onBack}>
              Voltar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => {
                setReport(null);
                setAdded(false);
                setPhase('intro');
              }}
            >
              Nova chamada
            </button>
          </div>
        </motion.div>
      )}
    </section>
  );
}
