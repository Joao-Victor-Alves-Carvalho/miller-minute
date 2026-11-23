import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { packs } from './data/packs';
import { scenes } from './data/scenes';
import { situations } from './data/situations';
import { stories } from './data/stories';
import { Aurora, type Mood } from './components/Aurora';
import { MedalToast } from './components/MedalToast';
import { awardMedals, type Medal } from './lib/medals';
import { tick } from './lib/miller';
import { modeFor } from './lib/modes';
import {
  addStudyTime,
  completeEar,
  completeSituation,
  completeStory,
  currentStreak,
  loadProgress,
  newAllowedToday,
  orderByFocus,
  pausedMinutes,
  registerStudyDay,
  markActivity,
  addBonusNew,
  BONUS_STEP,
  resume,
  saveProgress,
  unlockedPacks,
  type Progress,
} from './lib/progress';
import { buildSession, DEFAULT_SESSION, dueItems, mistakeItems, shuffle, unseenItems, type Step } from './lib/session';
import { Chat } from './screens/Chat';
import { Ear } from './screens/Ear';
import { Home } from './screens/Home';
import { ProgressScreen } from './screens/ProgressScreen';
import { Result } from './screens/Result';
import { Session, type SessionKind, type Summary } from './screens/Session';
import { Settings } from './screens/Settings';
import { Situations } from './screens/Situations';
import { Stories } from './screens/Stories';
import { StoryReader } from './screens/StoryReader';
import { Words } from './screens/Words';
import { Capsule } from './screens/Capsule';
import { Metro } from './screens/Metro';
import { buildMetroPlan, type MetroStep } from './lib/metro';
import { canSpeak } from './lib/speech';

type Screen =
  | { name: 'home' }
  | { name: 'session'; steps: Step[]; key: number; kind: SessionKind }
  | { name: 'result'; summary: Summary; ms: number }
  | { name: 'words' }
  | { name: 'situations' }
  | { name: 'scenes' }
  | { name: 'chat'; id: string; key: number; from: 'situations' | 'scenes' }
  | { name: 'stories' }
  | { name: 'story'; id: string; key: number }
  | { name: 'ear' }
  | { name: 'progress' }
  | { name: 'settings' }
  | { name: 'metro' }
  | { name: 'capsule' };

export type NavTarget = 'words' | 'situations' | 'scenes' | 'stories' | 'ear' | 'progress' | 'settings' | 'metro' | 'capsule';

/** Telas em que o relógio de estudo (Tempo de Miller) conta. */
const STUDY_SCREENS = new Set<Screen['name']>(['session', 'chat', 'story', 'ear']);

export function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [mood, setMood] = useState<Mood>('idle');
  const [toasts, setToasts] = useState<Medal[]>([]);
  const lastTouch = useRef<number | null>(null);
  const sessionStartMs = useRef(0);

  useEffect(() => saveProgress(progress), [progress]);

  // Medalhas: confere a cada mudança no progresso e avisa as novas.
  useEffect(() => {
    const { progress: next, awarded } = awardMedals(progress, Date.now());
    if (awarded.length > 0) {
      setProgress(next);
      setToasts((t) => [...t, ...awarded]);
    }
  }, [progress]);

  // Relógio de estudo: soma o tempo entre toques nas telas de estudo (pausas longas não contam).
  useEffect(() => {
    lastTouch.current = null;
    if (!STUDY_SCREENS.has(screen.name)) return;
    const onTouch = () => {
      const { add, last } = tick(lastTouch.current, Date.now());
      lastTouch.current = last;
      if (add > 0) setProgress((p) => addStudyTime(p, Date.now(), add));
    };
    window.addEventListener('pointerdown', onTouch, { capture: true, passive: true });
    window.addEventListener('keydown', onTouch, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', onTouch, { capture: true });
      window.removeEventListener('keydown', onTouch, { capture: true });
    };
  }, [screen.name]);

  const updateProgress = useCallback((fn: (p: Progress) => Progress) => setProgress(fn), []);

  // Recalcula a cada volta para a tela inicial (o "agora" muda).
  const plan = useMemo(() => {
    const now = Date.now();
    const unlocked = unlockedPacks(packs, progress.cards);
    const pool = unlocked.flatMap((p) => p.items);
    const due = dueItems(pool, progress.cards, now);
    const unseen = orderByFocus(unseenItems(pool, progress.cards), progress.settings.focusPack);
    const newCount = Math.min(newAllowedToday(progress, now), unseen.length);
    const mistakes = mistakeItems(pool, progress.cards, now);
    return { unlocked, pool, due, unseen, newCount, mistakes };
  }, [progress, screen.name]);

  const seenWords = Object.keys(progress.cards).length;

  const openSession = (steps: Step[], kind: SessionKind) => {
    sessionStartMs.current = progress.totalMs;
    setScreen({ name: 'session', steps, key: Date.now(), kind });
  };

  const start = () => {
    const fresh = plan.unseen.slice(0, Math.min(plan.newCount, DEFAULT_SESSION.maxNew));
    openSession(buildSession(plan.due, fresh, progress.cards, Math.random), 'normal');
  };

  const quizSteps = (items: typeof plan.pool) =>
    shuffle(items, Math.random).map<Step>((item, slot) => ({
      itemId: item.id,
      kind: 'quiz',
      graded: false,
      mode: modeFor(progress.cards[item.id]?.box ?? 0, slot, item),
    }));

  const startExtra = () => {
    const seen = plan.pool.filter((item) => progress.cards[item.id]);
    const weakest = seen.sort((a, b) => (progress.cards[a.id]?.box ?? 0) - (progress.cards[b.id]?.box ?? 0)).slice(0, 12);
    openSession(quizSteps(weakest), 'extra');
  };

  /** "Quero mais palavras": libera +6 novas hoje e já começa a sessão com elas. */
  const moreWords = () => {
    setProgress((p) => addBonusNew(p, Date.now()));
    openSession(buildSession(plan.due, plan.unseen.slice(0, BONUS_STEP), progress.cards, Math.random), 'normal');
  };

  const startMistakes = () => openSession(quizSteps(plan.mistakes.slice(0, 15)), 'mistakes');

  const finish = (summary: Summary) => {
    setProgress((p) => ({ ...markActivity(registerStudyDay(p, Date.now()), Date.now(), 'session'), bestCombo: Math.max(p.bestCombo, summary.bestCombo) }));
    setScreen({ name: 'result', summary, ms: Math.max(0, progress.totalMs - sessionStartMs.current) });
  };

  // Dentro da Missão do metrô, "voltar" das atividades retorna para a missão.
  const [inMetro, setInMetro] = useState(false);

  const goHome = () => {
    setMood('idle');
    setScreen(inMetro ? { name: 'metro' } : { name: 'home' });
  };

  const leaveMetro = () => {
    setInMetro(false);
    setScreen({ name: 'home' });
  };

  const metroSteps = buildMetroPlan(progress, Date.now(), { stories, chats: [...situations, ...scenes], audioOk: canSpeak() });

  const runMetroStep = (step: MetroStep) => {
    if (step.activity === 'session') {
      if (plan.due.length + plan.newCount > 0) start();
      else if (plan.unseen.length > 0) moreWords();
      else startExtra();
    } else if (step.activity === 'story' && step.targetId) {
      setScreen({ name: 'story', id: step.targetId, key: Date.now() });
    } else if (step.activity === 'chat' && step.targetId) {
      const from = scenes.some((x) => x.id === step.targetId) ? 'scenes' : 'situations';
      setScreen({ name: 'chat', id: step.targetId, key: Date.now(), from });
    } else {
      setScreen({ name: 'ear' });
    }
  };

  const navigate = (target: NavTarget) => {
    if (target === 'metro') setInMetro(true);
    setScreen({ name: target } as Screen);
  };
  const soundOn = progress.settings.sounds && pausedMinutes(progress, 'audio', Date.now()) === 0;
  const chatSituation = screen.name === 'chat' ? [...situations, ...scenes].find((s) => s.id === screen.id) : undefined;
  const story = screen.name === 'story' ? stories.find((s) => s.id === screen.id) : undefined;
  const screenKey = 'key' in screen ? `${screen.name}-${screen.key}` : screen.name;

  return (
    <>
      <Aurora mood={mood} />
      <main className="app">
        <AnimatePresence mode="wait">
          <motion.div
            key={screenKey}
            className="screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {screen.name === 'home' && (
              <Home
                progress={progress}
                dueCount={plan.due.length}
                newCount={plan.newCount}
                mistakesCount={plan.mistakes.length}
                unlocked={plan.unlocked}
                seenWords={seenWords}
                onStart={start}
                onExtra={startExtra}
                unseenLeft={plan.unseen.length}
                onMoreWords={moreWords}
                onMistakes={startMistakes}
                onNavigate={navigate}
                onFocus={(id) => setProgress((p) => ({ ...p, settings: { ...p.settings, focusPack: id } }))}
                onResume={(kind) => setProgress((p) => resume(p, kind))}
              />
            )}
            {screen.name === 'session' && (
              <Session
                steps={screen.steps}
                kind={screen.kind}
                pool={plan.pool}
                progress={progress}
                updateProgress={updateProgress}
                setMood={setMood}
                onFinish={finish}
                onExit={goHome}
              />
            )}
            {screen.name === 'result' && (
              <Result
                summary={screen.summary}
                ms={screen.ms}
                streak={currentStreak(progress, Date.now())}
                sound={soundOn}
                onDone={goHome}
              />
            )}
            {screen.name === 'words' && <Words items={plan.pool} progress={progress} onBack={() => setScreen({ name: 'progress' })} />}
            {screen.name === 'situations' && (
              <Situations
                list={situations}
                title="Situações reais"
                intro="Conversas do dia a dia, como no WhatsApp. Escolha ou monte suas respostas, ou fale no microfone. Novas situações liberam conforme você aprende palavras."
                progress={progress}
                seenWords={seenWords}
                onOpen={(id) => setScreen({ name: 'chat', id, key: Date.now(), from: 'situations' })}
                onBack={goHome}
              />
            )}
            {screen.name === 'scenes' && (
              <Situations
                list={scenes}
                title="Cenas de filme"
                intro="Diálogos originais no clima de filmes: ficção científica, policial, comédia romântica e terror. Cheios de expressões que você ouve no cinema e nas séries. Toque nas narrações 🎬 e nas falas para ver a tradução."
                progress={progress}
                seenWords={seenWords}
                onOpen={(id) => setScreen({ name: 'chat', id, key: Date.now(), from: 'scenes' })}
                onBack={goHome}
              />
            )}
            {screen.name === 'chat' && chatSituation && (
              <Chat
                situation={chatSituation}
                progress={progress}
                updateProgress={updateProgress}
                onComplete={(stars) => setProgress((p) => completeSituation(p, chatSituation.id, stars, Date.now()))}
                onBack={() => setScreen(inMetro ? { name: 'metro' } : screen.from === 'scenes' ? { name: 'scenes' } : { name: 'situations' })}
              />
            )}
            {screen.name === 'stories' && (
              <Stories
                progress={progress}
                seenWords={seenWords}
                onOpen={(id) => setScreen({ name: 'story', id, key: Date.now() })}
                onBack={goHome}
              />
            )}
            {screen.name === 'story' && story && (
              <StoryReader
                story={story}
                progress={progress}
                onComplete={(score) => setProgress((p) => completeStory(p, story.id, score, Date.now()))}
                onBack={() => setScreen(inMetro ? { name: 'metro' } : { name: 'stories' })}
              />
            )}
            {screen.name === 'ear' && (
              <Ear
                pool={plan.pool}
                progress={progress}
                updateProgress={updateProgress}
                onRoundDone={(kind) => setProgress((p) => completeEar(p, kind, Date.now()))}
                onBack={goHome}
              />
            )}
            {screen.name === 'progress' && <ProgressScreen progress={progress} onBack={goHome} onWords={() => setScreen({ name: 'words' })} />}
            {screen.name === 'settings' && <Settings progress={progress} setProgress={setProgress} onBack={goHome} />}
            {screen.name === 'metro' && <Metro steps={metroSteps} onStep={runMetroStep} onBack={leaveMetro} />}
            {screen.name === 'capsule' && <Capsule progress={progress} setProgress={setProgress} onBack={goHome} />}
          </motion.div>
        </AnimatePresence>
      </main>
      <MedalToast queue={toasts} onDone={() => setToasts((t) => t.slice(1))} sound={soundOn} />
    </>
  );
}
