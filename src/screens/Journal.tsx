import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { IconArrowLeft } from '../components/Icons';
import type { AiJob } from '../lib/progress';

interface Props {
  jobs: AiJob[];
  configured: boolean;
  online: boolean;
  syncing: boolean;
  onAdd: (job: { kind: 'diary'; text: string } | { kind: 'phrase'; text: string; context?: string }) => void;
  onSync: () => void;
  onSettings: () => void;
  onBack: () => void;
}

const DIARY_IDEAS = ['What did you do today?', 'What did you eat?', 'Who did you talk to?', 'What are your plans for tomorrow?'];

function JobCard({ job }: { job: AiJob }) {
  const when = new Date(job.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return (
    <li className={`job glass ${job.status}`}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">{job.kind === 'diary' ? '✍️ Diário' : '🎯 Frase capturada'}</span>
        <span className="muted small">{when}</span>
      </div>
      <p className="job-text">{job.text}</p>
      {job.status === 'pending' && <p className="muted small">⏳ Na fila: será corrigido assim que houver internet.</p>}
      {job.status === 'error' && <p className="chat-feedback">Não deu certo: {job.error}. Vou tentar de novo na próxima sincronização.</p>}
      {job.status === 'done' && job.kind === 'diary' && job.result && (
        <div className="job-result">
          {job.result.mistakes.length === 0 ? (
            <p className="flash" style={{ margin: 0 }}>✓ Sem erros! Muito bem.</p>
          ) : (
            <ul className="mistake-list">
              {job.result.mistakes.map((m, i) => (
                <li key={i}>
                  <span className="said">{m.said}</span>
                  <span className="better">→ {m.better}</span>
                  <span className="muted small">{m.why_pt}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="small" style={{ margin: 0 }}>
            <strong>Corrigido:</strong> {job.result.corrected}
          </p>
          <p className="small" style={{ margin: 0 }}>
            <strong>Mais natural:</strong> {job.result.natural}
          </p>
          {job.result.tip_pt && <p className="tip">💡 {job.result.tip_pt}</p>}
        </div>
      )}
      {job.status === 'done' && job.kind === 'phrase' && job.result && (
        <div className="job-result">
          <p style={{ margin: 0 }}>
            <strong>{job.result.en}</strong> — {job.result.pt}
          </p>
          <p className="muted small" style={{ margin: 0 }}>
            {job.result.explanation_pt}
          </p>
          <p className="small" style={{ margin: 0 }}>
            <em>{job.result.example}</em>
          </p>
          <p className="muted small" style={{ margin: 0 }}>
            ✓ Adicionada às Minhas frases (entra nas próximas sessões).
          </p>
        </div>
      )}
    </li>
  );
}

export function Journal({ jobs, configured, online, syncing, onAdd, onSync, onSettings, onBack }: Props) {
  const [tab, setTab] = useState<'diary' | 'phrase'>('diary');
  const [text, setText] = useState('');
  const [context, setContext] = useState('');
  const pending = jobs.filter((j) => j.status !== 'done').length;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    onAdd(tab === 'diary' ? { kind: 'diary', text: clean } : { kind: 'phrase', text: clean, context: context.trim() || undefined });
    setText('');
    setContext('');
  };

  return (
    <section className="screen" aria-label="Diário e frases">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Voltar">
          <IconArrowLeft />
        </button>
        <h1 className="page-title">✍️ Diário e frases</h1>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Funciona offline: escreva no metrô e a IA corrige quando voltar a internet. Os erros vão para o Caderno de erros e as frases viram cartões em "Minhas frases".
      </p>

      {!configured && (
        <div className="pause-chip">
          ⚙️ Servidor da IA não configurado: seus textos ficam guardados na fila.
          <button type="button" onClick={onSettings}>
            Ajustes
          </button>
        </div>
      )}

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'diary'} className={tab === 'diary' ? 'on' : ''} onClick={() => setTab('diary')}>
          ✍️ Diário
        </button>
        <button type="button" role="tab" aria-selected={tab === 'phrase'} className={tab === 'phrase' ? 'on' : ''} onClick={() => setTab('phrase')}>
          🎯 Capturar frase
        </button>
      </div>

      <form className="settings-card glass" onSubmit={submit}>
        {tab === 'diary' ? (
          <>
            <p className="muted small" style={{ margin: 0 }}>
              Escreva 3 frases em inglês sobre o seu dia. Ideias: {DIARY_IDEAS.join(' · ')}
            </p>
            <textarea className="type-input import-box journal-box" value={text} onChange={(e) => setText(e.target.value)} placeholder="Today I…" aria-label="Seu diário em inglês" />
          </>
        ) : (
          <>
            <p className="muted small" style={{ margin: 0 }}>
              Ouviu uma frase interessante numa série, vídeo ou podcast? Escreva do jeito que entendeu, mesmo com erros.
            </p>
            <input className="type-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: break a leg" aria-label="Frase que você ouviu" />
            <input className="type-input" value={context} onChange={(e) => setContext(e.target.value)} placeholder="Onde ouviu? (opcional)" aria-label="Onde ouviu a frase" />
          </>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={!text.trim()}>
          {online && configured ? 'Enviar para correção' : 'Guardar na fila'}
        </button>
      </form>

      <div className="row">
        <p className="eyebrow" style={{ flex: 1 }}>
          Seus textos {pending > 0 ? `(${pending} na fila)` : ''}
        </p>
        {pending > 0 && configured && (
          <button type="button" className="link-btn" onClick={onSync} disabled={syncing || !online}>
            {syncing ? 'Sincronizando…' : online ? 'Sincronizar agora' : 'Sem internet'}
          </button>
        )}
      </div>
      {jobs.length === 0 && <p className="muted">Nada por aqui ainda. Que tal escrever o diário de hoje?</p>}
      <motion.ul className="job-list" layout>
        {jobs.map((j) => (
          <JobCard key={j.id} job={j} />
        ))}
      </motion.ul>
    </section>
  );
}
