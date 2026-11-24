import { motion } from 'motion/react';
import { useState } from 'react';
import { Astronaut } from '../components/Astronaut';
import { IconArrowLeft } from '../components/Icons';
import { Ship } from '../components/Ship';
import { cosmetics, equip, owned, type Cosmetic, type CosmeticKind } from '../lib/hangar';
import type { Progress } from '../lib/progress';

const TABS: { kind: CosmeticKind; label: string }[] = [
  { kind: 'ship', label: '🚀 Naves' },
  { kind: 'suit', label: '🧑‍🚀 Trajes' },
  { kind: 'theme', label: '🌠 Céus' },
];

function Preview({ c }: { c: Cosmetic }) {
  if (c.kind === 'ship') return <Ship ship={c} size={64} />;
  if (c.kind === 'suit') return <Astronaut suit={c} size={64} />;
  return <span className="theme-swatch" style={{ background: `conic-gradient(${c.colors[0]}, ${c.colors[1]}, ${c.colors[2]}, ${c.colors[0]})` }} />;
}

/** Hangar: o que você já achou viajando. Só visual; achados chegam como surpresa. */
export function Hangar({ progress, setProgress, onBack }: { progress: Progress; setProgress: (fn: (p: Progress) => Progress) => void; onBack: () => void }) {
  const [tab, setTab] = useState<CosmeticKind>('ship');
  const list = cosmetics.filter((c) => c.kind === tab);
  const have = cosmetics.filter((c) => owned(progress, c)).length;

  return (
    <section className="screen" aria-label="Hangar">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Voltar">
          <IconArrowLeft />
        </button>
        <h1 className="page-title">Hangar</h1>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        {have} de {cosmetics.length} achados. Naves, trajes e céus aparecem como surpresa enquanto você viaja. Toque num achado para usar.
      </p>
      <div className="hangar-tabs" role="tablist" aria-label="Tipo">
        {TABS.map((t) => (
          <button key={t.kind} type="button" role="tab" aria-selected={tab === t.kind} className={`chip${tab === t.kind ? ' on' : ''}`} onClick={() => setTab(t.kind)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="hangar-grid">
        {list.map((c, i) => {
          const has = owned(progress, c);
          const on = progress.hangar[c.kind] === c.id;
          return (
            <motion.button
              key={c.id}
              type="button"
              className={`hangar-item glass${on ? ' on' : ''}${has ? '' : ' locked'}`}
              disabled={!has}
              aria-pressed={on}
              onClick={() => setProgress((p) => equip(p, c))}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.04 * i }}
              whileTap={has ? { scale: 0.95 } : undefined}
            >
              {has ? <Preview c={c} /> : <span className="mystery" aria-hidden="true">?</span>}
              <strong>{has ? c.name : 'Ainda escondido'}</strong>
              <small>{on ? 'Em uso' : has ? 'Tocar para usar' : `Pista: ${c.hint.toLowerCase()}`}</small>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
