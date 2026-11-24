import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { playComplete, playFind } from '../lib/sfx';
import { vibrate } from '../lib/speech';

/** Um aviso: medalha nova ou achado do hangar. */
export interface ToastItem {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  /** Texto pequeno de cima (padrão: "Nova medalha!"). */
  label?: string;
  find?: boolean;
}

/** Aviso de medalha nova ou achado no hangar, um de cada vez, no topo da tela. */
export function MedalToast({ queue, onDone, sound }: { queue: ToastItem[]; onDone: () => void; sound: boolean }) {
  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    if (sound) (current.find ? playFind : playComplete)();
    // O navegador só deixa vibrar depois do primeiro toque na tela.
    if ((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive) vibrate([30, 40, 30]);
    const timer = setTimeout(onDone, 3600);
    return () => clearTimeout(timer);
  }, [current]);

  return (
    <div className="toast-wrap" aria-live="polite">
      <AnimatePresence>
        {current && (
          <motion.button
            key={(current.find ? 'find:' : '') + current.id}
            type="button"
            className="toast"
            onClick={onDone}
            initial={{ y: -80, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          >
            <motion.span className="toast-emoji" initial={{ rotate: -30, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ delay: 0.15, type: 'spring' }}>
              {current.emoji}
            </motion.span>
            <span>
              <small>{current.label ?? 'Nova medalha!'}</small>
              <strong>{current.title}</strong>
              <span className="muted">{current.desc}</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
