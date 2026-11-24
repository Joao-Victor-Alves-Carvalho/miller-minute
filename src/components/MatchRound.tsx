import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Item } from '../data/types';
import { shuffle } from '../lib/session';
import { playCorrect, playWrong } from '../lib/sfx';
import { speak, vibrate } from '../lib/speech';

interface Props {
  items: Item[];
  audioOn: boolean;
  soundsOn: boolean;
  /** Fim da rodada, com quantos pares foram tentados errado. */
  onDone: (misses: number) => void;
}

type Side = 'en' | 'pt';

/**
 * Pares relâmpago: liga cada palavra em inglês ao significado. Rápido e sem nota (não mexe na
 * revisão espaçada); serve para reforçar as palavras novas antes da rodada de fixação.
 * Errar só pisca o par: tenta de novo, sem punição.
 */
export function MatchRound({ items, audioOn, soundsOn, onDone }: Props) {
  const left = useMemo(() => shuffle(items, Math.random), [items]);
  const right = useMemo(() => shuffle(items, Math.random), [items]);
  const [picked, setPicked] = useState<{ side: Side; id: string } | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string[]>([]);
  const misses = useRef(0);
  const finished = done.size === items.length;

  useEffect(() => {
    if (wrong.length === 0) return;
    const t = setTimeout(() => setWrong([]), 450);
    return () => clearTimeout(t);
  }, [wrong]);

  const tap = (side: Side, item: Item) => {
    if (done.has(item.id) || finished) return;
    if (side === 'en' && audioOn) speak(item.en);
    if (!picked || picked.side === side) {
      setPicked({ side, id: item.id });
      return;
    }
    if (picked.id === item.id) {
      const next = new Set(done);
      next.add(item.id);
      setDone(next);
      setPicked(null);
      vibrate(20);
      if (soundsOn && next.size === items.length) playCorrect();
      return;
    }
    misses.current += 1;
    setWrong([`${picked.side}:${picked.id}`, `${side}:${item.id}`]);
    setPicked(null);
    vibrate([50, 40, 50]);
    if (soundsOn) playWrong();
  };

  const cell = (side: Side, item: Item, i: number) => {
    const key = `${side}:${item.id}`;
    const isDone = done.has(item.id);
    const isPicked = picked?.side === side && picked.id === item.id;
    const isWrong = wrong.includes(key);
    let cls = 'option match-cell';
    if (isDone) cls += ' is-correct is-done';
    else if (isWrong) cls += ' is-wrong';
    else if (isPicked) cls += ' is-picked';
    return (
      <motion.button
        key={key}
        type="button"
        className={cls}
        onClick={() => tap(side, item)}
        disabled={isDone}
        aria-pressed={isPicked}
        initial={{ opacity: 0, y: 10 }}
        animate={isWrong ? { opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] } : isDone ? { opacity: 0.55, y: 0, scale: [1, 1.05, 1] } : { opacity: 1, y: 0 }}
        transition={{ delay: isWrong || isDone ? 0 : 0.04 * i, duration: 0.35 }}
        whileTap={isDone ? undefined : { scale: 0.96 }}
      >
        {side === 'en' ? item.en : item.pt}
      </motion.button>
    );
  };

  return (
    <>
      <div className="prompt">
        <p className="mission-tag">⚙️ Alinhe os motores</p>
        <p className="mission-how">Pares relâmpago: toque numa palavra em inglês e no significado dela.</p>
      </div>
      <div className="match-grid" role="group" aria-label="Ligue os pares">
        <div className="match-col">{left.map((item, i) => cell('en', item, i))}</div>
        <div className="match-col">{right.map((item, i) => cell('pt', item, i))}</div>
      </div>
      {finished && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'grid', gap: 10 }}>
          <p className="flash" style={{ margin: 0, textAlign: 'center' }}>
            {misses.current === 0 ? '⚡ Motores alinhados de primeira!' : `✅ Motores alinhados (${misses.current} ${misses.current === 1 ? 'tentativa a mais' : 'tentativas a mais'})`}
          </p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => onDone(misses.current)} autoFocus>
            Continuar
          </button>
        </motion.div>
      )}
    </>
  );
}
