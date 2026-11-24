import { motion } from 'motion/react';
import { useEffect } from 'react';
import { Confetti } from '../components/Confetti';
import { PlanetOrb } from '../components/PlanetOrb';
import { Ship } from '../components/Ship';
import { TaskList } from '../components/TaskList';
import type { Planet } from '../data/galaxy';
import type { Cosmetic } from '../lib/hangar';
import { earthYearsIfOnMiller, formatEarth, formatMiller, formatStudy, millerSeconds } from '../lib/miller';
import { playLanding } from '../lib/sfx';
import type { Summary } from './Session';

interface Props {
  summary: Summary;
  ms: number;
  planet: Planet;
  ship: Cosmetic;
  /** Primeira vez neste planeta. */
  firstLanding: boolean;
  sound: boolean;
  onDone: () => void;
}

/** Pouso no planeta: fim da viagem, com as tarefas feitas. Sem nota nem sequência na tela. */
export function Result({ summary, ms, planet, ship, firstLanding, sound, onDone }: Props) {
  useEffect(() => {
    // O som acompanha a nave tocando o chão.
    if (!sound) return;
    const t = setTimeout(playLanding, 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="screen landing" aria-label={`Pouso em ${planet.name}`}>
      <div className="landing-scene" aria-hidden="true">
        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.8 }} style={{ marginTop: 70 }}>
          <PlanetOrb planet={planet} size={150} ring />
        </motion.div>
        <motion.div className="lander" initial={{ y: -40, x: '-50%', opacity: 0 }} animate={{ y: 40, x: '-50%', opacity: 1 }} transition={{ duration: 1, ease: [0.2, 0.8, 0.3, 1] }}>
          <Ship ship={ship} size={54} />
        </motion.div>
      </div>

      <motion.p className="mission-tag" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        {firstLanding ? '🏁 Primeiro pouso' : '🛬 Pouso concluído'}
      </motion.p>
      <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        Bem-vindo a {planet.name}!
      </motion.h1>
      <motion.p className="muted" style={{ margin: 0 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
        {planet.tagline}.
      </motion.p>

      <motion.div style={{ width: '100%' }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
        <TaskList lines={summary.tasks} />
      </motion.div>

      <motion.div className="stats" style={{ width: '100%' }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}>
        <div className="stat">
          <strong>{summary.newLearned}</strong>
          <span>descobertas</span>
        </div>
        <div className="stat">
          <strong>{summary.correct}</strong>
          <span>acertos</span>
        </div>
        <div className="stat">
          <strong>x{summary.bestCombo}</strong>
          <span>melhor combo</span>
        </div>
      </motion.div>

      {ms > 0 && (
        <motion.p className="miller-line result-miller" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }}>
          🪐 Durante seus <strong>{formatStudy(ms)}</strong> de viagem, passaram só <strong>{formatMiller(millerSeconds(ms))}</strong> no planeta de Miller. Lá, esse tempo valeria{' '}
          <strong>{formatEarth(earthYearsIfOnMiller(ms))}</strong> aqui na Terra.
        </motion.p>
      )}

      <motion.button type="button" className="btn btn-primary btn-block" onClick={onDone} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} autoFocus>
        Voltar à nave
      </motion.button>

      <Confetti burst={1} amount={firstLanding ? 90 : 50} />
    </section>
  );
}
