import { motion } from 'motion/react';
import type { NavTarget } from '../App';
import { Astronaut } from '../components/Astronaut';
import { PlanetOrb } from '../components/PlanetOrb';
import { Ship } from '../components/Ship';
import { crewChapters } from '../data/crew';
import type { Planet } from '../data/galaxy';
import { scenes } from '../data/scenes';
import { situations } from '../data/situations';
import { stories } from '../data/stories';
import { IconMic, IconSpeaker } from '../components/Icons';
import { isUnlocked } from '../lib/chat';
import { capsuleStatus } from '../lib/capsule';
import { earthYearsIfOnMiller, formatEarth, formatMiller, formatStudy, millerSeconds } from '../lib/miller';
import { cosmetics, owned, type Cosmetic } from '../lib/hangar';
import { pausedMinutes, todayMs, BONUS_STEP, doneToday, type PauseKind, type Progress } from '../lib/progress';

interface Props {
  progress: Progress;
  dueCount: number;
  newCount: number;
  mistakesCount: number;
  seenWords: number;
  onStart: () => void;
  onExtra: () => void;
  /** Palavras novas ainda não vistas nos pacotes liberados. */
  unseenLeft: number;
  onMoreWords: () => void;
  aiReady: boolean;
  pendingAi: number;
  onMistakes: () => void;
  onNavigate: (target: NavTarget) => void;
  onResume: (kind: PauseKind) => void;
  /** Para onde vai a próxima viagem. */
  nextPlanet: Planet;
  ship: Cosmetic;
  suit: Cosmetic;
  /** Revisões vencidas (estrelas apagando). */
  dimStars: number;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const enter = (i: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.05 * i, type: 'spring' as const, stiffness: 220, damping: 24 },
});

export function Home(props: Props) {
  const { progress, dueCount, newCount, mistakesCount, seenWords, onStart, onExtra, unseenLeft, onMoreWords, aiReady, pendingAi, onMistakes, onNavigate, onResume, nextPlanet, ship, suit, dimStars } = props;
  const now = Date.now();
  const hasWork = dueCount + newCount > 0;
  const seenAny = seenWords > 0;
  const micPaused = pausedMinutes(progress, 'mic', now);
  const audioPaused = pausedMinutes(progress, 'audio', now);
  const today = todayMs(progress, now);
  const openSituations = situations.filter((s) => isUnlocked(s, seenWords)).length;
  const openStories = stories.filter((s) => seenWords >= s.unlockAt).length;
  const openScenes = scenes.filter((s) => isUnlocked(s, seenWords)).length;
  const metroDone = Math.min(3, doneToday(progress, now).length);
  const capsule = capsuleStatus(progress.capsules, now);
  const crewOpen = crewChapters.filter((c) => progress.voyage.trips >= c.unlockAt);
  const crewNew = crewOpen.filter((c) => !progress.stories[c.id]).length;
  const found = cosmetics.filter((c) => owned(progress, c)).length;
  const planetsVisited = Object.keys(progress.voyage.landed).length;

  const tiles: { id: string; emoji: string; title: string; sub: string; onClick: () => void; badge?: number }[] = [
    { id: 'galaxy', emoji: '🌌', title: 'Galáxia', sub: dimStars > 0 ? `${dimStars} estrelas apagando` : `${planetsVisited} ${planetsVisited === 1 ? 'planeta visitado' : 'planetas visitados'}`, onClick: () => onNavigate('galaxy') },
    { id: 'crew', emoji: '🧑‍🚀', title: 'Diário da tripulação', sub: `Capítulo ${crewOpen.length} de ${crewChapters.length}`, onClick: () => onNavigate('crew'), badge: crewNew },
    { id: 'hangar', emoji: '🛠️', title: 'Hangar', sub: `${found} de ${cosmetics.length} achados`, onClick: () => onNavigate('hangar') },
    { id: 'endurance', emoji: '📞', title: 'Chamada da Endurance', sub: aiReady ? 'Conversa por voz com a IA' : 'Configure em Ajustes', onClick: () => onNavigate('endurance') },
    { id: 'journal', emoji: '✍️', title: 'Diário e frases', sub: pendingAi > 0 ? `${pendingAi} na fila` : 'Funciona offline', onClick: () => onNavigate('journal'), badge: pendingAi },
    { id: 'situations', emoji: '💬', title: 'Situações reais', sub: `${openSituations} de ${situations.length} liberadas`, onClick: () => onNavigate('situations') },
    { id: 'scenes', emoji: '🎬', title: 'Cenas de filme', sub: `${openScenes} de ${scenes.length} liberadas`, onClick: () => onNavigate('scenes') },
    { id: 'stories', emoji: '📖', title: 'Histórias', sub: `${openStories} de ${stories.length} liberadas`, onClick: () => onNavigate('stories') },
    { id: 'ear', emoji: '🎧', title: 'Ditado e shadowing', sub: 'Ouvir, escrever e repetir', onClick: () => onNavigate('ear') },
    {
      id: 'mistakes',
      emoji: '📕',
      title: 'Caderno de erros',
      sub: mistakesCount > 0 ? `${mistakesCount} para revisar` : 'Nenhum erro recente',
      onClick: onMistakes,
      badge: mistakesCount,
    },
    { id: 'metro', emoji: '🚇', title: 'Missão do metrô', sub: `${metroDone}/3 hoje · funciona offline`, onClick: () => onNavigate('metro') },
    {
      id: 'capsule',
      emoji: '📼',
      title: 'Cápsula do tempo',
      sub: capsule.recorded ? `Próxima em ${capsule.daysToNext} dias` : `Mensagem do mês ${capsule.month}`,
      onClick: () => onNavigate('capsule'),
      badge: capsule.recorded ? 0 : 1,
    },
    { id: 'progress', emoji: '📈', title: 'Progresso', sub: `Gráfico, medalhas e ${seenWords} palavras`, onClick: () => onNavigate('progress') },
  ];

  return (
    <section className="screen" aria-label="Início">
      <motion.header className="row" {...enter(0)}>
        <img className="logo-mark" src="./icon.svg" alt="" width={44} height={44} />
        <h1 className="logo">
          miller <span>minute.</span>
        </h1>
        <span className="spacer" />
        <button type="button" className="avatar-btn" onClick={() => onNavigate('hangar')} aria-label="Hangar: naves, trajes e céus">
          <Astronaut suit={suit} size={34} />
        </button>
        <button type="button" className="icon-btn" onClick={() => onNavigate('settings')} aria-label="Ajustes">
          <span aria-hidden="true" style={{ fontSize: 20 }}>
            ⚙️
          </span>
        </button>
      </motion.header>

      <motion.div className="hero glass" {...enter(1)}>
        <div>
          <p className="eyebrow">{greeting()}, João</p>
        </div>
        <div className="hero-trip">
          <div className="float">
            <Ship ship={ship} size={58} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="eyebrow">{hasWork ? 'Próxima viagem' : 'Céu tranquilo'}</p>
            <h2 style={{ margin: '6px 0 4px' }}>{hasWork ? nextPlanet.name : 'Tudo aceso!'}</h2>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              {hasWork
                ? [dueCount > 0 ? `🌑 ${dueCount} ${dueCount === 1 ? 'estrela apagando' : 'estrelas apagando'}` : '', newCount > 0 ? `✨ ${newCount} para descobrir` : ''].filter(Boolean).join(' · ')
                : 'Nenhuma estrela apagando. Explore outro jeito ou descubra mais.'}
            </p>
          </div>
          {hasWork && <PlanetOrb planet={nextPlanet} size={52} ring />}
        </div>
        {hasWork ? (
          <motion.button
            type="button"
            className="btn btn-primary btn-block"
            onClick={onStart}
            whileTap={{ scale: 0.96 }}
            animate={{ boxShadow: ['0 10px 40px -10px rgba(139,92,246,.7)', '0 10px 50px -6px rgba(34,211,238,.7)', '0 10px 40px -10px rgba(139,92,246,.7)'] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            🚀 {seenAny ? 'Decolar' : 'Primeira decolagem'}
          </motion.button>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>
              Revisões em dia e as palavras novas de hoje já foram. Quer continuar? Aprenda mais palavras ou pratique de outro jeito.
            </p>
            {unseenLeft > 0 && (
              <motion.button type="button" className="btn btn-primary btn-block" onClick={onMoreWords} whileTap={{ scale: 0.96 }}>
                ✨ Descobrir mais palavras (+{Math.min(BONUS_STEP, unseenLeft)})
              </motion.button>
            )}
            <div className="suggest-row" role="group" aria-label="Outras formas de praticar">
              <button type="button" className="suggest" onClick={() => onNavigate('situations')}>💬 Situação</button>
              <button type="button" className="suggest" onClick={() => onNavigate('scenes')}>🎬 Cena</button>
              <button type="button" className="suggest" onClick={() => onNavigate('stories')}>📖 História</button>
              <button type="button" className="suggest" onClick={() => onNavigate('ear')}>🎧 Ditado</button>
            </div>
            {seenAny && (
              <button type="button" className="btn btn-ghost btn-block" onClick={onExtra}>
                Voo livre (treino que não mexe nas revisões)
              </button>
            )}
          </>
        )}
      </motion.div>

      <motion.div className="miller glass" {...enter(2)}>
        <div className="row" style={{ alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="eyebrow">Tempo de Miller</p>
            <strong className="miller-today">
              {formatStudy(today)} <span className="muted">a bordo hoje</span>
            </strong>
          </div>
        </div>
        <p className="miller-line">
          🪐 Durante seus <strong>{formatStudy(today)}</strong> de estudo hoje, passaram só <strong>{formatMiller(millerSeconds(today))}</strong> no planeta de Miller.
        </p>
        <p className="miller-line">
          ⏳ Se tivesse estudado esse tempo lá em Miller, teriam passado <strong>{formatEarth(earthYearsIfOnMiller(today))}</strong> aqui na Terra.
        </p>
        <p className="muted miller-total">
          No total: {formatStudy(progress.totalMs)} de estudo · {formatMiller(millerSeconds(progress.totalMs))} em Miller · {formatEarth(earthYearsIfOnMiller(progress.totalMs))} na Terra
        </p>
      </motion.div>

      {(micPaused > 0 || audioPaused > 0) && (
        <motion.div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} {...enter(3)}>
          {micPaused > 0 && (
            <div className="pause-chip">
              <IconMic /> Perguntas de fala pausadas · {micPaused} min
              <button type="button" onClick={() => onResume('mic')}>
                Reativar
              </button>
            </div>
          )}
          {audioPaused > 0 && (
            <div className="pause-chip">
              <IconSpeaker /> Áudio pausado · {audioPaused} min
              <button type="button" onClick={() => onResume('audio')}>
                Reativar
              </button>
            </div>
          )}
        </motion.div>
      )}

      <motion.div className="tiles" {...enter(4)}>
        {tiles.map((t) => (
          <motion.button key={t.id} type="button" className="tile glass" onClick={t.onClick} whileTap={{ scale: 0.96 }} disabled={t.id === 'mistakes' && !mistakesCount}>
            <span className="tile-emoji" aria-hidden="true">
              {t.emoji}
            </span>
            <strong>{t.title}</strong>
            <span className="muted">{t.sub}</span>
            {t.badge ? <span className="badge-count">{t.badge}</span> : null}
          </motion.button>
        ))}
      </motion.div>

      <p className="version">Miller Minute v{__APP_VERSION__}</p>
    </section>
  );
}
