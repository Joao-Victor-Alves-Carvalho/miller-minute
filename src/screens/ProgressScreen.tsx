import { motion } from 'motion/react';
import { useState } from 'react';
import { situations } from '../data/situations';
import { stories } from '../data/stories';
import { IconArrowLeft } from '../components/Icons';
import { medals } from '../lib/medals';
import { earthYearsIfOnMiller, formatEarth, formatMiller, formatStudy, millerSeconds } from '../lib/miller';
import type { Progress } from '../lib/progress';
import { DAY, dayKey, isMastered, startOfDay } from '../lib/srs';

const WEEKDAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DAYS = 14;

/** Gráfico de barras: minutos de estudo por dia (uma série, uma cor). */
function StudyChart({ progress }: { progress: Progress }) {
  const [active, setActive] = useState<number | null>(null);
  const today = startOfDay(Date.now());
  const days = Array.from({ length: DAYS }, (_, i) => {
    const t = today - (DAYS - 1 - i) * DAY;
    const h = progress.history[dayKey(t)];
    return { t, minutes: (h?.ms ?? 0) / 60000, answers: h?.answers ?? 0, correct: h?.correct ?? 0 };
  });
  const max = Math.max(5, ...days.map((d) => d.minutes));
  const top = Math.ceil(max / 5) * 5;
  const W = 340;
  const H = 150;
  const padL = 26;
  const padB = 22;
  const plotW = W - padL;
  const plotH = H - padB - 8;
  const slot = plotW / DAYS;
  const barW = slot - 2; // 2px de espaço entre barras
  const y = (m: number) => 8 + plotH - (m / top) * plotH;
  const shown = active ?? DAYS - 1;
  const d = days[shown];

  return (
    <figure className="chart glass">
      <figcaption>
        <strong>Minutos de estudo por dia</strong>
        <span className="muted">últimos 14 dias</span>
      </figcaption>
      <div className="chart-tip" aria-live="polite">
        {d && (
          <>
            <strong>{shown === DAYS - 1 ? 'Hoje' : new Date(d.t).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</strong>
            <span>
              {formatStudy(d.minutes * 60000)} · {d.answers} respostas{d.answers ? ` · ${Math.round((d.correct / d.answers) * 100)}% de acerto` : ''}
            </span>
          </>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label="Gráfico de minutos de estudo por dia nos últimos 14 dias" onPointerLeave={() => setActive(null)}>
        {[0, top / 2, top].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W} y1={y(v)} y2={y(v)} className="grid" />
            <text x={padL - 6} y={y(v) + 4} className="axis" textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {days.map((day, i) => {
          const x = padL + i * slot + 1;
          const h = Math.max(0, y(0) - y(day.minutes));
          const r = Math.min(4, h, barW / 2);
          const yTop = y(0) - h;
          return (
            <g key={day.t}>
              {h > 0 && (
                <motion.path
                  d={`M${x},${y(0)} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${y(0)} Z`}
                  className={`bar${active === i ? ' on' : ''}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                />
              )}
              {/* Área de toque maior que a barra */}
              <rect
                x={padL + i * slot}
                y={8}
                width={slot}
                height={plotH}
                fill="transparent"
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
              />
              {(i % 2 === 1 || i === DAYS - 1) && (
                <text x={x + barW / 2} y={H - 6} className={`axis${i === DAYS - 1 ? ' today' : ''}`} textAnchor="middle">
                  {i === DAYS - 1 ? 'hoje' : WEEKDAY[new Date(day.t).getDay()]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>Minutos de estudo por dia</caption>
        <thead>
          <tr>
            <th>Dia</th>
            <th>Minutos</th>
            <th>Respostas</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.t}>
              <td>{new Date(day.t).toLocaleDateString('pt-BR')}</td>
              <td>{Math.round(day.minutes)}</td>
              <td>{day.answers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function ProgressScreen({ progress, onBack, onWords }: { progress: Progress; onBack: () => void; onWords: () => void }) {
  const cards = Object.values(progress.cards);
  const mastered = cards.filter((c) => isMastered(c)).length;
  const earnedCount = medals.filter((m) => progress.medals[m.id]).length;
  const stats = [
    { label: 'palavras vistas', value: String(cards.length) },
    { label: 'dominadas', value: String(mastered) },
    { label: 'de acerto', value: `${progress.totalAnswers ? Math.round((progress.totalCorrect / progress.totalAnswers) * 100) : 0}%` },
    { label: 'de estudo', value: formatStudy(progress.totalMs) },
    { label: 'melhor sequência', value: `${progress.bestStreak} d` },
    { label: 'melhor combo', value: `x${progress.bestCombo}` },
    { label: 'situações', value: `${Object.keys(progress.situations).length}/${situations.length}` },
    { label: 'histórias', value: `${Object.keys(progress.stories).length}/${stories.length}` },
    { label: 'ditados e shadowing', value: String(progress.ear.dictation + progress.ear.shadowing) },
  ];

  return (
    <section className="screen" aria-label="Progresso">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Voltar">
          <IconArrowLeft />
        </button>
        <h1 className="page-title">Progresso</h1>
      </div>

      <div className="stat-grid">
        {stats.map((s, i) => (
          <motion.div key={s.label} className="stat" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </motion.div>
        ))}
      </div>

      <p className="miller-line glass" style={{ padding: '14px 16px', borderRadius: 18 }}>
        🪐 Em {formatStudy(progress.totalMs)} de estudo, passaram {formatMiller(millerSeconds(progress.totalMs))} em Miller. Se fosse lá, seriam {formatEarth(earthYearsIfOnMiller(progress.totalMs))} na Terra.
      </p>

      <button type="button" className="btn btn-ghost btn-block" onClick={onWords}>
        🔤 Ver todas as palavras e o nível de cada uma
      </button>

      <StudyChart progress={progress} />

      <div className="row" style={{ marginTop: 4 }}>
        <p className="eyebrow" style={{ flex: 1 }}>
          Medalhas
        </p>
        <span className="muted" style={{ fontSize: 14, fontWeight: 700 }}>
          {earnedCount}/{medals.length}
        </span>
      </div>
      <ul className="medal-grid">
        {medals.map((m) => {
          const when = progress.medals[m.id];
          return (
            <li key={m.id} className={`medal${when ? ' on' : ''}`}>
              <span className="medal-emoji" aria-hidden="true">
                {when ? m.emoji : '🔒'}
              </span>
              <strong>{m.title}</strong>
              <span>{m.desc}</span>
              {when && <small>{new Date(when).toLocaleDateString('pt-BR')}</small>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
