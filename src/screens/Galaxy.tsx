import { motion } from 'motion/react';
import { IconArrowLeft } from '../components/Icons';
import { PlanetOrb } from '../components/PlanetOrb';
import { planetFor } from '../data/galaxy';
import type { Pack } from '../data/types';
import { skyOf, starDots } from '../lib/galaxy';
import { seenRatio, THEME_UNLOCK_SEEN, UNLOCK_RATIO, type Progress } from '../lib/progress';

interface Props {
  packs: Pack[];
  progress: Progress;
  unlockedIds: ReadonlySet<string>;
  seenWords: number;
  /** Viaja para o planeta: reacende as estrelas apagando e descobre palavras novas de lá. */
  onExplore: (packId: string) => void;
  onFocus: (packId: string | null) => void;
  onBack: () => void;
}

/**
 * Mapa da galáxia: cada pacote é um planeta e cada palavra, uma estrela.
 * Estrela apagando = palavra pedindo revisão (a repetição espaçada por baixo do jogo).
 */
export function Galaxy({ packs, progress, unlockedIds, seenWords, onExplore, onFocus, onBack }: Props) {
  const now = Date.now();
  const core = packs.filter((p) => p.kind === 'core');
  const focus = progress.settings.focusPack;

  return (
    <section className="screen" aria-label="Galáxia">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Voltar">
          <IconArrowLeft />
        </button>
        <h1 className="page-title">Galáxia</h1>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Cada planeta guarda palavras, e cada palavra é uma estrela. Estrelas piscando fraquinho estão apagando: uma viagem até lá acende de novo.
      </p>

      {packs.map((pack, i) => {
        const planet = planetFor(pack);
        const locked = !unlockedIds.has(pack.id);
        const sky = skyOf(pack, progress.cards, now);
        const landed = progress.voyage.landed[pack.id];
        const prev = core[core.indexOf(pack) - 1];
        const lockMsg =
          pack.kind === 'theme'
            ? `Sinal aparece com ${THEME_UNLOCK_SEEN} palavras descobertas (faltam ${Math.max(0, THEME_UNLOCK_SEEN - seenWords)}).`
            : `Sinal aparece quando ${Math.round(UNLOCK_RATIO * 100)}% do planeta anterior estiver descoberto (agora: ${Math.round((prev ? seenRatio(prev, progress.cards) : 1) * 100)}%).`;
        const focused = focus === pack.id;
        return (
          <motion.div
            key={pack.id}
            className={`galaxy-planet glass${locked ? ' locked' : ''}`}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
          >
            <div className="row">
              <PlanetOrb planet={planet} size={58} ring={!locked && sky.mastered > 0} dim={locked} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="eyebrow">{locked ? 'Sinal desconhecido' : `${pack.title}${landed ? ' · 🏁 já pousou' : ''}`}</p>
                <h3 style={{ margin: '4px 0 0' }}>{locked ? '???' : planet.name}</h3>
                <p className="muted" style={{ margin: '2px 0 0', fontSize: 14 }}>
                  {locked ? lockMsg : planet.tagline}
                </p>
              </div>
            </div>
            {!locked && (
              <>
                <div className="star-dots" role="img" aria-label={`${sky.mastered + sky.lit} estrelas acesas, ${sky.dim} apagando, ${sky.unseen} por descobrir`}>
                  {starDots(sky).map((k, n) => (
                    <i key={n} className={k} />
                  ))}
                </div>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  ⭐ {sky.mastered + sky.lit} acesas · 🌑 {sky.dim} apagando · ✨ {sky.unseen} por descobrir
                </p>
                {(sky.dim > 0 || sky.unseen > 0) && (
                  <motion.button type="button" className="btn btn-primary btn-block" onClick={() => onExplore(pack.id)} whileTap={{ scale: 0.96 }}>
                    {sky.dim > 0 ? `🚀 Reacender ${sky.dim} ${sky.dim === 1 ? 'estrela' : 'estrelas'}` : `🚀 Explorar ${planet.name}`}
                  </motion.button>
                )}
                {sky.unseen > 0 && (
                  <button type="button" className={`focus-btn${focused ? ' on' : ''}`} onClick={() => onFocus(focused ? null : pack.id)} aria-pressed={focused}>
                    {focused ? `🎯 Rota fixada: as descobertas vêm de ${planet.name} · tocar para soltar` : `Fixar rota: descobrir palavras de ${planet.name}`}
                  </button>
                )}
              </>
            )}
          </motion.div>
        );
      })}
    </section>
  );
}
