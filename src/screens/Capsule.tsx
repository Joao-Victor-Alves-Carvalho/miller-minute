import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { IconArrowLeft, IconMic } from '../components/Icons';
import { BASE_PROMPT, beforeAndNow, capsuleStatus, formatDuration, MAX_RECORDING_MS, promptForMonth } from '../lib/capsule';
import { deleteRecording, loadRecording, saveRecording } from '../lib/capsuleStore';
import { saveFile } from '../lib/files';
import type { CapsuleEntry, Progress } from '../lib/progress';
import { canRecord, extensionFor, startRecording, type RecordKind, type Recording } from '../lib/recorder';

interface Props {
  progress: Progress;
  setProgress: Dispatch<SetStateAction<Progress>>;
  onBack: () => void;
}

interface Draft {
  kind: RecordKind;
  blob: Blob;
  mime: string;
  durationMs: number;
  url: string;
}

/** Player que carrega o áudio guardado no aparelho só quando aparece. */
function StoredAudio({ id, label }: { id: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    void loadRecording(id)
      .then((blob) => {
        if (!alive) return;
        if (!blob) {
          setMissing(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  if (missing) return <p className="muted small">Áudio não encontrado neste aparelho.</p>;
  return url ? <audio controls src={url} aria-label={label} preload="metadata" className="capsule-audio" /> : <p className="muted small">Carregando…</p>;
}

export function Capsule({ progress, setProgress, onBack }: Props) {
  const status = capsuleStatus(progress.capsules, Date.now());
  const extra = promptForMonth(status.month);
  const [recording, setRecording] = useState<{ rec: Recording; kind: RecordKind; started: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const supported = canRecord();
  const pair = beforeAndNow(progress.capsules);
  const audios = [...progress.capsules].filter((c) => c.kind === 'audio').sort((a, b) => b.at - a.at);
  const videos = progress.capsules.filter((c) => c.kind === 'video');

  // Cronômetro e limite de 3 minutos.
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      const ms = Date.now() - recording.started;
      setElapsed(ms);
      if (ms >= MAX_RECORDING_MS) void stop();
    }, 250);
    return () => clearInterval(timer);
  }, [recording]);

  // Pré-visualização da câmera no vídeo.
  useEffect(() => {
    if (recording?.kind === 'video' && videoRef.current) {
      videoRef.current.srcObject = recording.rec.stream;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [recording]);

  useEffect(() => () => recording?.rec.cancel(), []);

  const start = async (kind: RecordKind) => {
    setError(null);
    setMsg(null);
    if (draft) URL.revokeObjectURL(draft.url);
    setDraft(null);
    try {
      const rec = await startRecording(kind);
      setElapsed(0);
      setRecording({ rec, kind, started: Date.now() });
    } catch {
      setError(
        kind === 'audio'
          ? 'Não consegui acessar o microfone. Libere a permissão do microfone para o app e tente de novo.'
          : 'Não consegui acessar a câmera. Libere a permissão da câmera e do microfone e tente de novo.',
      );
    }
  };

  const stop = async () => {
    if (!recording) return;
    const current = recording;
    setRecording(null);
    const out = await current.rec.stop();
    setDraft({ kind: current.kind, ...out, url: URL.createObjectURL(out.blob) });
  };

  const discard = () => {
    if (draft) URL.revokeObjectURL(draft.url);
    setDraft(null);
  };

  const keep = async () => {
    if (!draft) return;
    const id = `capsule-m${status.month}-${Date.now()}`;
    const entry: CapsuleEntry = { id, month: status.month, at: Date.now(), durationMs: draft.durationMs, kind: draft.kind };
    try {
      if (draft.kind === 'audio') {
        await saveRecording(id, draft.blob);
        // Regravar no mesmo mês substitui a mensagem anterior daquele mês.
        const old = progress.capsules.filter((c) => c.kind === 'audio' && c.month === status.month);
        for (const c of old) await deleteRecording(c.id).catch(() => undefined);
        setProgress((p) => ({ ...p, capsules: [...p.capsules.filter((c) => !(c.kind === 'audio' && c.month === status.month)), entry] }));
        setMsg(`Mensagem do mês ${status.month} guardada na cápsula! 📼`);
      } else {
        await saveFile(`mensagem-cooper-mes-${status.month}.${extensionFor(draft.mime)}`, draft.mime, draft.blob);
        setProgress((p) => ({ ...p, capsules: [...p.capsules, entry] }));
        setMsg('Vídeo enviado para salvar. No iPhone, escolha "Salvar vídeo"; no Android, salve na galeria ou no Google Fotos.');
      }
      discard();
    } catch {
      setError('Não consegui guardar a gravação. Verifique se há espaço no aparelho.');
    }
  };

  const exportAudio = async (c: CapsuleEntry) => {
    const blob = await loadRecording(c.id).catch(() => undefined);
    if (!blob) return setError('Áudio não encontrado neste aparelho.');
    await saveFile(`mensagem-cooper-mes-${c.month}.${extensionFor(blob.type)}`, blob.type, blob);
  };

  const remove = async (c: CapsuleEntry) => {
    if (!window.confirm(`Apagar a mensagem do mês ${c.month}? Isso não pode ser desfeito.`)) return;
    await deleteRecording(c.id).catch(() => undefined);
    setProgress((p) => ({ ...p, capsules: p.capsules.filter((x) => x.id !== c.id) }));
  };

  return (
    <section className="screen" aria-label="Cápsula do tempo">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Voltar">
          <IconArrowLeft />
        </button>
        <h1 className="page-title">📼 Cápsula do tempo</h1>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Como as mensagens que atravessam o tempo no filme: todo mês você grava uma mensagem em inglês para o seu eu do futuro. No mês 6, ouça a primeira e a última lado a lado.
      </p>

      {msg && <p className="flash" role="status">{msg}</p>}
      {error && <p className="chat-feedback" role="alert">{error}</p>}

      <div className="settings-card glass capsule-mission">
        <p className="eyebrow">Mensagem do mês {status.month}</p>
        {status.recorded && !draft && !recording ? (
          <p className="muted small" style={{ margin: 0 }}>
            ✅ Você já gravou a mensagem deste mês. A próxima libera em {status.daysToNext} {status.daysToNext === 1 ? 'dia' : 'dias'}. Se quiser, pode regravar (substitui a deste mês).
          </p>
        ) : null}
        <div className="prompt-box">
          <p>
            <strong>1.</strong> {BASE_PROMPT.en}
            <span className="muted small">{BASE_PROMPT.pt}</span>
          </p>
          <p>
            <strong>2.</strong> {extra.en}
            <span className="muted small">{extra.pt}</span>
          </p>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          Fale à vontade, sem ler e sem medo de errar: os erros de hoje são o "antes" do seu "depois". Até 3 minutos.
        </p>

        {!supported && <p className="chat-feedback">Este navegador não consegue gravar. Abra o app pelo ícone instalado.</p>}

        <AnimatePresence mode="wait">
          {recording ? (
            <motion.div key="rec" className="rec-box" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {recording.kind === 'video' && <video ref={videoRef} className="rec-video" muted playsInline />}
              <p className="rec-time" aria-live="polite">
                <span className="rec-dot" aria-hidden="true" /> Gravando {formatDuration(elapsed)} / {formatDuration(MAX_RECORDING_MS)}
              </p>
              <button type="button" className="btn btn-bad btn-block" onClick={() => void stop()}>
                ⏹ Parar
              </button>
            </motion.div>
          ) : draft ? (
            <motion.div key="draft" className="rec-box" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {draft.kind === 'audio' ? (
                <audio controls src={draft.url} className="capsule-audio" aria-label="Ouvir a gravação" />
              ) : (
                <video controls src={draft.url} className="rec-video" playsInline />
              )}
              <p className="muted small" style={{ margin: 0 }}>
                Duração: {formatDuration(draft.durationMs)}
              </p>
              <div className="row">
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={discard}>
                  Gravar de novo
                </button>
                <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => void keep()}>
                  {draft.kind === 'audio' ? 'Guardar na cápsula' : 'Salvar na galeria'}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="idle" className="rec-box" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.button type="button" className="mic-btn" onClick={() => void start('audio')} disabled={!supported} whileTap={{ scale: 0.92 }} aria-label="Gravar mensagem em áudio">
                <IconMic />
              </motion.button>
              <p className="muted small" style={{ margin: 0, textAlign: 'center' }}>
                Toque para gravar o áudio
              </p>
              {(status.month === 1 || status.month >= 6) && (
                <button type="button" className="btn btn-ghost btn-block" onClick={() => void start('video')} disabled={!supported}>
                  🎥 Gravar também em vídeo (vai para a sua galeria)
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {pair && (
        <div className="settings-card glass">
          <p className="eyebrow">Antes e agora</p>
          <p className="small" style={{ margin: 0 }}>
            <strong>Mês {pair[0].month}</strong> · {new Date(pair[0].at).toLocaleDateString('pt-BR')}
          </p>
          <StoredAudio id={pair[0].id} label={`Mensagem do mês ${pair[0].month}`} />
          <p className="small" style={{ margin: 0 }}>
            <strong>Mês {pair[1].month}</strong> · {new Date(pair[1].at).toLocaleDateString('pt-BR')}
          </p>
          <StoredAudio id={pair[1].id} label={`Mensagem do mês ${pair[1].month}`} />
          <p className="muted small" style={{ margin: 0 }}>
            Em breve: a IA vai comparar palavras por minuto, pausas, vocabulário e erros entre as mensagens.
          </p>
        </div>
      )}

      {audios.length > 0 && (
        <div className="settings-card glass">
          <p className="eyebrow">Suas mensagens ({audios.length})</p>
          <ul className="capsule-list">
            {audios.map((c) => (
              <li key={c.id}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>Mês {c.month}</strong>
                  <span className="muted small">
                    {new Date(c.at).toLocaleDateString('pt-BR')} · {formatDuration(c.durationMs)}
                  </span>
                </div>
                <StoredAudio id={c.id} label={`Mensagem do mês ${c.month}`} />
                <div className="row">
                  <button type="button" className="link-btn" onClick={() => void exportAudio(c)}>
                    Exportar
                  </button>
                  <button type="button" className="link-btn" onClick={() => void remove(c)}>
                    Apagar
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="muted small" style={{ margin: 0 }}>
            Os áudios ficam só neste aparelho e não entram no código de backup. Use "Exportar" de vez em quando para guardar uma cópia.
          </p>
        </div>
      )}
      {videos.length > 0 && (
        <p className="muted small">🎥 Vídeos gravados: {videos.map((v) => `mês ${v.month}`).join(', ')} (salvos na sua galeria).</p>
      )}
    </section>
  );
}
