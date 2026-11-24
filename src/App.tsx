import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { minePack, packs, setCustomItems } from './data/packs';
import { scenes } from './data/scenes';
import { situations } from './data/situations';
import { stories } from './data/stories';
import { Aurora, type Mood } from './components/Aurora';
import { MedalToast, type ToastItem } from './components/MedalToast';
import { crewChapters } from './data/crew';
import { planetFor } from './data/galaxy';
import { awardFinds, cosmetic } from './lib/hangar';
import { destinationOf } from './lib/voyage';
import { Crew } from './screens/Crew';
import { Galaxy } from './screens/Galaxy';
import { Hangar } from './screens/Hangar';
import { awardMedals } from './lib/medals';
import { tick } from './lib/miller';
import { modeFor } from './lib/modes';
import {
  addStudyTime,
  completeEar,
  completeSituation,
  completeStory,
  loadProgress,
  newAllowedToday,
  orderByFocus,
  pausedMinutes,
  registerStudyDay,
  addCustomItems,
  markActivity,
  addBonusNew,
  finishVoyage,
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
import { Endurance } from './screens/Endurance';
import { Journal } from './screens/Journal';
import { enqueue, loadAiConfig, makeCaller, pendingJobs, processQueue, saveAiConfig, type AiConfig } from './lib/ai';
import { Capsule } from './screens/Capsule';
import { Metro } from './screens/Metro';
import { buildMetroPlan, type MetroStep } from './lib/metro';
import { canSpeak } from './lib/speech';

type Screen =
  | { name: 'home' }
  | { name: 'session'; steps: Step[]; key: number; kind: SessionKind; planetId: string }
  | { name: 'result'; summary: Summary; ms: number; planetId: string; firstLanding: boolean }
  | { name: 'words' }
  | { name: 'situations' }
  | { name: 'scenes' }
  | { name: 'chat'; id: string; key: number; from: 'situations' | 'scenes' }
  | { name: 'stories' }
  | { name: 'story'; id: string; key: number; from: 'stories' | 'crew' }
  | { name: 'galaxy' }
  | { name: 'hangar' }
  | { name: 'crew' }
  | { name: 'ear' }
  | { name: 'progress' }
  | { name: 'settings' }
  | { name: 'metro' }
  | { name: 'capsule' }
  | { name: 'endurance' }
  | { name: 'journal' };

export type NavTarget = 'galaxy' | 'hangar' | 'crew' | 'words' | 'situations' | 'scenes' | 'stories' | 'ear' | 'progress' | 'settings' | 'metro' | 'capsule' | 'endurance' | 'journal';

/** Telas em que o relógio de estudo (Tempo de Miller) conta. */
const STUDY_SCREENS = new Set<Screen['name']>(['session', 'chat', 'story', 'ear', 'endurance', 'journal']);

export function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [mood, setMood] = useState<Mood>('idle');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const lastTouch = useRef<number | null>(null);
  const sessionStartMs = useRef(0);

  useEffect(() => saveProgress(progress), [progress]);

  // "Minhas frases": registra os itens para as sessões encontrarem pelo id.
  setCustomItems(progress.custom);

  // ---------- IA (servidor na Cloudflare) e fila offline ----------
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(loadAiConfig);
  const caller = useMemo(() => (aiConfig ? makeCaller(aiConfig) : null), [aiConfig]);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const syncingRef = useRef(false);

  const sync = useCallback(async () => {
    if (!caller || syncingRef.current || !navigator.onLine) return;
    if (pendingJobs(progressRef.current).length === 0) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      await processQueue(() => progressRef.current, setProgress, caller);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [caller]);

  // Sincroniza ao abrir, ao configurar o servidor e quando a internet volta (saída do metrô).
  useEffect(() => {
    void sync();
    const onNet = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void sync();
    };
    window.addEventListener('online', onNet);
    window.addEventListener('offline', onNet);
    return () => {
      window.removeEventListener('online', onNet);
      window.removeEventListener('offline', onNet);
    };
  }, [sync]);

  const pendingCount = pendingJobs(progress).length;
  useEffect(() => {
    if (pendingCount > 0) void sync();
  }, [pendingCount, sync]);

  // Medalhas: confere a cada mudança no progresso e avisa as novas.
  useEffect(() => {
    const now = Date.now();
    const { progress: withMedals, awarded } = awardMedals(progress, now);
    const { progress: next, found } = awardFinds(withMedals, now);
    if (awarded.length > 0 || found.length > 0) {
      setProgress(next);
      setToasts((t) => [
        ...t,
        ...awarded,
        ...found.map((c) => ({ id: c.id, emoji: c.emoji, title: c.name, desc: 'Já está no seu hangar. Toque no capacete para usar.', label: 'Você encontrou!', find: true })),
      ]);
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
    const unlocked = unlockedPacks([...packs, minePack(progress.custom)], progress.cards);
    const pool = unlocked.flatMap((p) => p.items);
    const due = dueItems(pool, progress.cards, now);
    const unseen = orderByFocus(unseenItems(pool, progress.cards), progress.settings.focusPack);
    const newCount = Math.min(newAllowedToday(progress, now), unseen.length);
    const mistakes = mistakeItems(pool, progress.cards, now);
    return { unlocked, pool, due, unseen, newCount, mistakes };
  }, [progress, screen.name]);

  const seenWords = Object.keys(progress.cards).length;

  const allPacks = useMemo(() => [...packs, minePack(progress.custom)], [progress.custom]);
  const planetOf = (id: string) => planetFor(allPacks.find((p) => p.id === id) ?? { id, title: id });
  const ship = cosmetic(progress.hangar.ship, 'ship');

  const openSession = (steps: Step[], kind: SessionKind) => {
    if (steps.length === 0) return;
    sessionStartMs.current = progress.totalMs;
    const planetId = destinationOf(steps.filter((s) => s.kind !== 'match').map((s) => s.itemId));
    setScreen({ name: 'session', steps, key: Date.now(), kind, planetId });
  };

  /** Viagem a um planeta da galáxia: reacende as estrelas apagando e descobre palavras de lá. */
  const explorePlanet = (packId: string) => {
    const due = plan.due.filter((i) => i.id.startsWith(`${packId}:`));
    const fresh = plan.unseen.filter((i) => i.id.startsWith(`${packId}:`)).slice(0, Math.min(plan.newCount, DEFAULT_SESSION.maxNew));
    if (due.length + fresh.length === 0) {
      // Sem novas liberadas hoje: treina as palavras que já conhece de lá.
      const known = plan.pool.filter((i) => i.id.startsWith(`${packId}:`) && progress.cards[i.id]);
      openSession(quizSteps(shuffle(known, Math.random).slice(0, 12)), 'extra');
      return;
    }
    openSession(buildSession(due, fresh, progress.cards, Math.random), 'normal');
  };

  const nextPlanet = planetOf(
    destinationOf([...plan.due.slice(0, DEFAULT_SESSION.maxReviews), ...plan.unseen.slice(0, Math.min(plan.newCount, DEFAULT_SESSION.maxNew))].map((i) => i.id)),
  );

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
    const planetId = screen.name === 'session' ? screen.planetId : 'p1';
    const firstLanding = !progress.voyage.landed[planetId];
    setProgress((p) => {
      const now = Date.now();
      const done = markActivity(registerStudyDay(p, now), now, 'session');
      return { ...finishVoyage(done, planetId, summary.tasks, now), bestCombo: Math.max(p.bestCombo, summary.bestCombo) };
    });
    setScreen({ name: 'result', summary, ms: Math.max(0, progress.totalMs - sessionStartMs.current), planetId, firstLanding });
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
      setScreen({ name: 'story', id: step.targetId, key: Date.now(), from: 'stories' });
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
  const story = screen.name === 'story' ? [...stories, ...crewChapters].find((s) => s.id === screen.id) : undefined;
  const theme = cosmetic(progress.hangar.theme, 'theme');
  const screenKey = 'key' in screen ? `${screen.name}-${screen.key}` : screen.name;

  return (
    <>
      <Aurora mood={mood} colors={theme.colors} />
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
                seenWords={seenWords}
                onStart={start}
                onExtra={startExtra}
                unseenLeft={plan.unseen.length}
                onMoreWords={moreWords}
                aiReady={caller !== null}
                pendingAi={pendingCount}
                onMistakes={startMistakes}
                onNavigate={navigate}
                onResume={(kind) => setProgress((p) => resume(p, kind))}
                nextPlanet={nextPlanet}
                ship={ship}
                suit={cosmetic(progress.hangar.suit, 'suit')}
                dimStars={plan.due.length}
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
                planet={planetOf(screen.planetId)}
                ship={ship}
              />
            )}
            {screen.name === 'result' && (
              <Result
                summary={screen.summary}
                ms={screen.ms}
                planet={planetOf(screen.planetId)}
                ship={ship}
                firstLanding={screen.firstLanding}
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
                onOpen={(id) => setScreen({ name: 'story', id, key: Date.now(), from: 'stories' })}
                onBack={goHome}
              />
            )}
            {screen.name === 'story' && story && (
              <StoryReader
                story={story}
                progress={progress}
                onComplete={(score) => setProgress((p) => completeStory(p, story.id, score, Date.now()))}
                onBack={() => setScreen(inMetro ? { name: 'metro' } : screen.from === 'crew' ? { name: 'crew' } : { name: 'stories' })}
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
            {screen.name === 'settings' && (
              <Settings
                progress={progress}
                setProgress={setProgress}
                aiConfig={aiConfig}
                onAiConfig={(cfg) => {
                  saveAiConfig(cfg);
                  setAiConfig(cfg);
                }}
                onBack={goHome}
              />
            )}
            {screen.name === 'endurance' && (
              <Endurance
                progress={progress}
                call={caller}
                onFinish={(report) =>
                  setProgress((p) => {
                    const now = Date.now();
                    let next = addCustomItems(
                      p,
                      report.mistakes.filter((m) => m.better).map((m) => ({ en: m.better, pt: m.why_pt.slice(0, 80), ex: m.better, exPt: `Você disse: "${m.said}"` })),
                      now,
                      true,
                    );
                    next = { ...next, calls: { done: next.calls.done + 1, lastAt: now } };
                    return markActivity(registerStudyDay(next, now), now, 'call');
                  })
                }
                onAddWords={(words) => setProgress((p) => addCustomItems(p, words.map((w) => ({ en: w.en, pt: w.pt, ex: w.example })), Date.now()))}
                onSettings={() => setScreen({ name: 'settings' })}
                onBack={goHome}
              />
            )}
            {screen.name === 'journal' && (
              <Journal
                jobs={progress.aiQueue}
                configured={caller !== null}
                online={online}
                syncing={syncing}
                onAdd={(job) => setProgress((p) => enqueue(p, job, Date.now()))}
                onSync={() => void sync()}
                onSettings={() => setScreen({ name: 'settings' })}
                onBack={goHome}
              />
            )}
            {screen.name === 'metro' && <Metro steps={metroSteps} onStep={runMetroStep} onBack={leaveMetro} />}
            {screen.name === 'galaxy' && (
              <Galaxy
                packs={allPacks.filter((p) => p.items.length > 0)}
                progress={progress}
                unlockedIds={new Set(plan.unlocked.map((p) => p.id))}
                seenWords={seenWords}
                onExplore={explorePlanet}
                onFocus={(id) => setProgress((p) => ({ ...p, settings: { ...p.settings, focusPack: id } }))}
                onBack={goHome}
              />
            )}
            {screen.name === 'hangar' && <Hangar progress={progress} setProgress={setProgress} onBack={goHome} />}
            {screen.name === 'crew' && <Crew progress={progress} onOpen={(id) => setScreen({ name: 'story', id, key: Date.now(), from: 'crew' })} onBack={goHome} />}
            {screen.name === 'capsule' && <Capsule progress={progress} setProgress={setProgress} onBack={goHome} />}
          </motion.div>
        </AnimatePresence>
      </main>
      <MedalToast queue={toasts} onDone={() => setToasts((t) => t.slice(1))} sound={soundOn} />
    </>
  );
}
