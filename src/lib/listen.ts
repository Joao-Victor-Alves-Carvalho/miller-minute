/**
 * Reconhecimento de fala do navegador (Web Speech API).
 * No Android (Chrome) usa o serviço do Google e precisa de internet.
 */
interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResultList {
  length: number;
  [index: number]: { length: number; [index: number]: RecognitionAlternative };
}
interface RecognitionEvent {
  results: RecognitionResultList;
}
interface RecognitionErrorEvent {
  error: string;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canRecognize(): boolean {
  return ctor() !== null;
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Reconhecimento de voz utilizável AGORA: no Android (Chrome) ele depende da internet,
 * então sem sinal (no metrô) as perguntas de falar são trocadas por outras.
 */
export function recognitionUsable(): boolean {
  if (!canRecognize()) return false;
  return isIos() || typeof navigator === 'undefined' || navigator.onLine !== false;
}

/** Recursos de voz do aparelho neste momento (para `capabilities`). */
export function speechSupport(canSpeakNow: boolean): { speech: boolean; recognition: boolean } {
  return { speech: canSpeakNow, recognition: recognitionUsable() };
}

export interface Listening {
  /** Alternativas do que foi dito (vazio se nada foi entendido). */
  result: Promise<string[]>;
  stop: () => void;
}

/** Erros: "not-allowed" (sem permissão), "network" (sem internet), "no-speech", "audio-capture". */
export function listen(timeoutMs = 7000): Listening {
  const Ctor = ctor();
  if (!Ctor) return { result: Promise.reject(new Error('unsupported')), stop: () => undefined };
  const rec = new Ctor();
  rec.lang = 'en-US';
  rec.interimResults = false;
  rec.maxAlternatives = 5;
  rec.continuous = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let guard: ReturnType<typeof setTimeout> | undefined;
  const result = new Promise<string[]>((resolve, reject) => {
    const heard: string[] = [];
    // Segurança: se o navegador nunca encerrar a escuta, não deixa o app preso em "Ouvindo…".
    guard = setTimeout(() => {
      try {
        rec.abort();
      } catch {
        // ignora
      }
      resolve(heard);
    }, timeoutMs + 2500);
    rec.onresult = (e) => {
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (!res) continue;
        for (let j = 0; j < res.length; j++) {
          const alt = res[j];
          if (alt?.transcript) heard.push(alt.transcript);
        }
      }
    };
    rec.onerror = (e) => {
      clearTimeout(timer);
      clearTimeout(guard);
      if (e.error === 'no-speech' || e.error === 'aborted') resolve([]);
      else reject(new Error(e.error));
    };
    rec.onend = () => {
      clearTimeout(timer);
      clearTimeout(guard);
      resolve(heard);
    };
  });
  try {
    window.speechSynthesis?.cancel();
    rec.start();
    timer = setTimeout(() => rec.stop(), timeoutMs);
  } catch (err) {
    return { result: Promise.reject(err instanceof Error ? err : new Error('start')), stop: () => undefined };
  }
  return { result, stop: () => rec.stop() };
}
