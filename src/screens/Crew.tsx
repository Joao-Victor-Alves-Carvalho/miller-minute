import { motion } from 'motion/react';
import { crewChapters } from '../data/crew';
import { IconArrowLeft } from '../components/Icons';
import type { Progress } from '../lib/progress';

/** Diário da tripulação: a história do jogo, um capítulo novo a cada algumas viagens. */
export function Crew({ progress, onOpen, onBack }: { progress: Progress; onOpen: (id: string) => void; onBack: () => void }) {
  const trips = progress.voyage.trips;
  return (
    <section className="screen" aria-label="Diário da tripulação">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Voltar">
          <IconArrowLeft />
        </button>
        <h1 className="page-title">Diário da tripulação</h1>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        A história da sua nave, em inglês. Ouça, leia (toque numa frase para ver a tradução) e responda no fim. Um capítulo novo aparece a cada algumas viagens.
      </p>
      <ul className="situation-list">
        {crewChapters.map((c, i) => {
          const open = trips >= c.unlockAt;
          const rec = progress.stories[c.id];
          const left = c.unlockAt - trips;
          return (
            <motion.li key={c.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <button type="button" className={`situation glass${open ? '' : ' locked'}`} disabled={!open} onClick={() => onOpen(c.id)}>
                <span className="avatar" aria-hidden="true">
                  {open ? c.emoji : '🔒'}
                </span>
                <span className="texts">
                  <strong>{open ? c.title : `Capítulo ${i + 1}`}</strong>
                  <span>{open ? c.subtitle : `Aparece em ${left} ${left === 1 ? 'viagem' : 'viagens'}`}</span>
                </span>
                {rec && (
                  <span className="mini-stars" aria-label={`Melhor resultado: ${rec.best} de ${c.questions.length} acertos`}>
                    {'★'.repeat(rec.best)}
                    <span className="off">{'★'.repeat(Math.max(0, c.questions.length - rec.best))}</span>
                  </span>
                )}
              </button>
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}
