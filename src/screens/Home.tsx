import { motion } from 'motion/react';
import type { NavTarget } from '../App';
import { packs } from '../data/packs';
import { scenes } from '../data/scenes';
import { situations } from '../data/situations';
import { stories } from '../data/stories';
import type { Pack } from '../data/types';
import { IconFlame, IconMic, IconSpeaker } from '../components/Icons';
import { isUnlocked } from '../lib/chat';
import { capsuleStatus } from '../lib/capsule';
import { earthYearsIfOnMiller, formatEarth, formatMiller, formatStudy, millerSeconds } from '../lib/miller';
import {
  currentStreak,
  masteredRatio,
  pausedMinutes,
  THEME_UNLOCK_SEEN,
  todayMs,
  UNLOCK_RATIO,
  BONUS_STEP,
  seenRatio,
  doneToday,
  type PauseKind,
  type Progress,
} from '../lib/progress';
import { MASTERED_BOX } from '../lib/srs';

interface Props {
  progress: Progress;
  dueCount: number;
  newCount: number;
  mistakesCount: number;
  unlocked: Pack[];
  seenWords: number;
  onStart: () => void;
  onExtra: () => void;
  /** Palavras novas ainda não vistas nos pacotes liberados. */
  unseenLeft: number;
  onMoreWords: () => void;
  onMistakes: () => void;
  onNavigate: (target: NavTarget) => void;
  onFocus: (packId: string | null) => void;
  onResume: (kind: PauseKind) => void;
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
  const { progress, dueCount, newCount, mistakesCount, unlocked, seenWords, onStart, onExtra, unseenLeft, onMoreWords, onMistakes, onNavigate, onFocus, onResume } = props;
  const now = Date.now();
  const streak = currentStreak(progress, now);
  const hasWork = dueCount + newCount > 0;
  const seenAny = seenWords > 0;
  const micPaused = pausedMinutes(progress, 'mic', now);
  const audioPaused = pausedMinutes(progress, 'audio', now);
  const today = todayMs(progress, now);
  const goalMs = progress.settings.goalMinutes * 60_000;
  const goalPct = Math.min(1, today / goalMs);
  const unlockedIds = new Set(unlocked.map((p) => p.id));
  const openSituations = situations.filter((s) => isUnlocked(s, seenWords)).length;
  const openStories = stories.filter((s) => seenWords >= s.unlockAt).length;
  const openScenes = scenes.filter((s) => isUnlocked(s, seenWords)).length;
  const focus = progress.settings.focusPack;
  const metroDone = Math.min(3, doneToday(progress, now).length);
  const capsule = capsuleStatus(progress.capsules, now);
  const corePacks = packs.filter((p) => p.kind === 'core');
  const prevSeen = (pack: Pack) => {
    const prev = corePacks[corePacks.indexOf(pack) - 1];
    return prev ? seenRatio(prev, progress.cards) : 1;
  };

  const tiles: { id: string; emoji: string; title: string; sub: string; onClick: () => void; badge?: number }[] = [
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
        <span className="pill" title="Dias seguidos estudando">
          <IconFlame />
          {streak}
          <span className="sr-only">dias seguidos</span>
        </span>
        <button type="button" className="icon-btn" onClick={() => onNavigate('settings')} aria-label="Ajustes">
          <span aria-hidden="true" style={{ fontSize: 20 }}>
            ⚙️
          </span>
        </button>
      </motion.header>

      <motion.div className="hero glass" {...enter(1)}>
        <div>
          <p className="eyebrow">{greeting()}, João</p>
          <h2 style={{ marginTop: 10 }}>{hasWork ? 'Bora treinar?' : 'Tudo em dia!'}</h2>
        </div>
        <div className="stats">
          <div className="stat">
            <strong>{dueCount}</strong>
            <span>revisões</span>
          </div>
          <div className="stat">
            <strong>{newCount}</strong>
            <span>novas hoje</span>
          </div>
          <div className="stat">
            <strong>{progress.totalAnswers > 0 ? Math.round((progress.totalCorrect / progress.totalAnswers) * 100) : 0}%</strong>
            <span>acertos</span>
          </div>
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
            {seenAny ? 'Começar sessão' : 'Começar do zero'}
          </motion.button>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>
              Revisões em dia e as palavras novas de hoje já foram. Quer continuar? Aprenda mais palavras ou pratique de outro jeito.
            </p>
            {unseenLeft > 0 && (
              <motion.button type="button" className="btn btn-primary btn-block" onClick={onMoreWords} whileTap={{ scale: 0.96 }}>
                ➕ Quero mais palavras (+{Math.min(BONUS_STEP, unseenLeft)})
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
                Treino extra (não conta no agendamento)
              </button>
            )}
          </>
        )}
      </motion.div>

      <motion.div className="miller glass" {...enter(2)}>
        <div className="row" style={{ alignItems: 'center', gap: 14 }}>
          <div className="goal-ring" role="img" aria-label={`Meta do dia: ${formatStudy(today)} de ${progress.settings.goalMinutes} min`}>
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="27" stroke="rgba(255,255,255,.1)" strokeWidth="7" fill="none" />
              <motion.circle
                cx="32"
                cy="32"
                r="27"
                stroke="url(#goalGrad)"
                strokeWidth="7"
                strokeLinecap="round"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: goalPct }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
              <defs>
                <linearGradient id="goalGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#8b5cf6" />
                  <stop offset="1" stopColor="#b6ff5c" />
                </linearGradient>
              </defs>
            </svg>
            <span>{goalPct >= 1 ? '✓' : `${Math.round(goalPct * 100)}%`}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="eyebrow">Tempo de Miller</p>
            <strong className="miller-today">
              {formatStudy(today)} <span className="muted">de {progress.settings.goalMinutes} min hoje</span>
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

      <motion.p className="eyebrow" style={{ marginTop: 6 }} {...enter(5)}>
        Pacotes de palavras
      </motion.p>
      {packs.map((pack, i) => {
        const locked = !unlockedIds.has(pack.id);
        const total = pack.items.length;
        let learning = 0;
        let mastered = 0;
        for (const item of pack.items) {
          const card = progress.cards[item.id];
          if (!card) continue;
          if (card.box >= MASTERED_BOX) mastered++;
          else learning++;
        }
        const ratio = masteredRatio(pack, progress.cards);
        const focused = focus === pack.id;
        const lockMsg =
          pack.kind === 'theme'
            ? `Libera com ${THEME_UNLOCK_SEEN} palavras vistas (faltam ${Math.max(0, THEME_UNLOCK_SEEN - seenWords)}).`
            : `Libera quando você tiver visto ${Math.round(UNLOCK_RATIO * 100)}% do pacote anterior (agora: ${Math.round(prevSeen(pack) * 100)}%).`;
        return (
          <motion.div key={pack.id} className={`pack glass${locked ? ' locked' : ''}${focused ? ' focused' : ''}`} {...enter(6 + i)}>
            <div className="row">
              <div style={{ flex: 1 }}>
                <p className="eyebrow">{pack.kind === 'theme' ? 'Temático' : `Pacote ${packs.filter((p) => p.kind === 'core').indexOf(pack) + 1}`}</p>
                <h3>
                  {locked ? '🔒 ' : ''}
                  {pack.title}
                </h3>
              </div>
              <strong style={{ fontSize: 22 }}>{Math.round(ratio * 100)}%</strong>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              {locked ? lockMsg : `${pack.subtitle} · ${total} itens`}
            </p>
            <div className="meter" aria-hidden="true">
              <motion.span style={{ background: 'var(--good)' }} initial={{ width: 0 }} animate={{ width: `${(mastered / total) * 100}%` }} transition={{ duration: 0.9, delay: 0.3 }} />
              <motion.span style={{ background: 'var(--violet)' }} initial={{ width: 0 }} animate={{ width: `${(learning / total) * 100}%` }} transition={{ duration: 0.9, delay: 0.4 }} />
            </div>
            <div className="legend">
              <span>
                <i style={{ background: 'var(--good)' }} />
                {mastered} dominadas
              </span>
              <span>
                <i style={{ background: 'var(--violet)' }} />
                {learning} aprendendo
              </span>
              <span>
                <i style={{ background: 'rgba(255,255,255,.15)' }} />
                {total - mastered - learning} novas
              </span>
            </div>
            {!locked && mastered + learning < total && (
              <button type="button" className={`focus-btn${focused ? ' on' : ''}`} onClick={() => onFocus(focused ? null : pack.id)} aria-pressed={focused}>
                {focused ? '🎯 Em foco: as palavras novas vêm daqui · tocar para tirar' : 'Focar as palavras novas neste pacote'}
              </button>
            )}
          </motion.div>
        );
      })}

      <p className="version">Miller Minute v{__APP_VERSION__}</p>
    </section>
  );
}
