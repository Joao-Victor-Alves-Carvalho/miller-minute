import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { IconArrowLeft, IconCheck } from '../components/Icons';
import type { MetroStep } from '../lib/metro';
import { offlineChecks, type OfflineCheck } from '../lib/offline';

interface Props {
  steps: MetroStep[];
  onStep: (step: MetroStep) => void;
  onBack: () => void;
}

const EMOJI: Record<MetroStep['activity'], string> = { session: '🧠', story: '📖', ear: '🎧', chat: '💬', call: '📞' };

export function Metro({ steps, onStep, onBack }: Props) {
  const [checks, setChecks] = useState<OfflineCheck[]>(() => offlineChecks());
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    // As vozes do aparelho carregam de forma assíncrona; refaz a verificação quando chegam.
    const refresh = () => setChecks(offlineChecks());
    window.speechSynthesis?.addEventListener?.('voiceschanged', refresh);
    const onNet = () => setOnline(navigator.onLine);
    window.addEventListener('online', onNet);
    window.addEventListener('offline', onNet);
    const t = setTimeout(refresh, 800);
    return () => {
      clearTimeout(t);
      window.speechSynthesis?.removeEventListener?.('voiceschanged', refresh);
      window.removeEventListener('online', onNet);
      window.removeEventListener('offline', onNet);
    };
  }, []);

  const done = steps.filter((s) => s.done).length;
  const total = steps.reduce((sum, s) => sum + s.minutes, 0);
  const next = steps.find((s) => !s.done);
  const allOk = checks.every((c) => c.ok || c.id === 'mic');

  return (
    <section className="screen" aria-label="Missão do metrô">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Voltar">
          <IconArrowLeft />
        </button>
        <h1 className="page-title">🚇 Missão do metrô</h1>
      </div>

      <p className="muted" style={{ margin: 0 }}>
        Cerca de {total} minutos de estudo que funcionam sem internet. Faça na ordem; cada etapa concluída fica marcada.
      </p>

      <div className={`net-pill ${online ? 'on' : 'off'}`} role="status">
        {online ? '📶 Com internet agora' : '🚇 Sem internet: modo metrô ativo'}
      </div>

      <div className="metro-meter" aria-label={`${done} de ${steps.length} etapas concluídas`}>
        {steps.map((s) => (
          <span key={s.activity} className={s.done ? 'on' : ''} />
        ))}
      </div>

      <ol className="metro-steps">
        {steps.map((s, i) => (
          <motion.li key={s.activity} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <button
              type="button"
              className={`metro-step glass${s.done ? ' done' : ''}${s === next ? ' next' : ''}`}
              onClick={() => onStep(s)}
            >
              <span className="metro-num" aria-hidden="true">
                {s.done ? <IconCheck /> : EMOJI[s.activity]}
              </span>
              <span className="texts">
                <strong>
                  {i + 1}. {s.title}
                </strong>
                <span>
                  {s.desc} · ~{s.minutes} min
                </span>
              </span>
              <span className="metro-go" aria-hidden="true">
                {s.done ? 'Refazer' : s === next ? 'Começar' : '›'}
              </span>
            </button>
          </motion.li>
        ))}
      </ol>

      {done === steps.length && (
        <motion.p className="flash" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          🎉 Missão do metrô cumprida! Bom trabalho, tripulante.
        </motion.p>
      )}

      <div className="settings-card glass">
        <p className="eyebrow">Pronto para ficar sem sinal? {allOk ? '✅' : '⚠️'}</p>
        <ul className="checks">
          {checks.map((c) => (
            <li key={c.id} className={c.ok ? 'ok' : c.id === 'mic' ? 'info' : 'warn'}>
              <span aria-hidden="true">{c.ok ? '✓' : c.id === 'mic' ? 'ℹ️' : '!'}</span>
              <div>
                <strong>{c.label}</strong>
                {c.help && <p className="muted small">{c.help}</p>}
              </div>
            </li>
          ))}
        </ul>
        <p className="muted small">
          Dica: baixe também episódios de podcasts em inglês para ouvir nos trechos em que não der para usar a tela.
        </p>
      </div>
    </section>
  );
}
