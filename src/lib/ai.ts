/**
 * Cliente da IA (servidor Cloudflare do Miller Minute).
 * O endereço e o código de acesso ficam só neste aparelho (localStorage), fora do backup.
 */
import { addCustomItems, type AiJob, type AiMistake, type Progress } from './progress';

export interface AiConfig {
  url: string;
  code: string;
}

const KEY = 'miller-minute:ai';

export function loadAiConfig(): AiConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw) as Partial<AiConfig>;
    return cfg.url && cfg.code ? { url: cfg.url, code: cfg.code } : null;
  } catch {
    return null;
  }
}

export function saveAiConfig(cfg: AiConfig | null): void {
  try {
    if (cfg) localStorage.setItem(KEY, JSON.stringify(cfg));
    else localStorage.removeItem(KEY);
  } catch {
    // sem armazenamento: fica só nesta sessão
  }
}

/** Aceita "meu-worker.conta.workers.dev" ou a URL completa; tira barra final. */
export function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/+$/, '');
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: 'offline' | 'config' | 'auth' | 'limit' | 'server',
  ) {
    super(message);
  }
}

export type AiCaller = (path: '/chat' | '/report' | '/correct' | '/ping', body: Record<string, unknown>) => Promise<Record<string, unknown>>;

export function makeCaller(cfg: AiConfig | null, fetchImpl: typeof fetch = fetch): AiCaller {
  return async (path, body) => {
    if (!cfg) throw new AiError('Configure o servidor da IA em Ajustes.', 'config');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AiError('Sem internet agora.', 'offline');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    let res: Response;
    try {
      res = await fetchImpl(`${cfg.url}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Access-Code': cfg.code },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new AiError('Não consegui falar com o servidor (sem internet ou endereço errado).', 'offline');
    } finally {
      clearTimeout(timer);
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return data;
    const msg = typeof data.error === 'string' ? data.error : `erro ${res.status}`;
    if (res.status === 401) throw new AiError('Código de acesso recusado. Confira em Ajustes.', 'auth');
    if (res.status === 429) throw new AiError('Limite de uso atingido. Tente daqui a pouco.', 'limit');
    throw new AiError(`O servidor respondeu: ${msg}`, 'server');
  };
}

// ---------- Fila offline (diário e frases capturadas) ----------

export function enqueue(progress: Progress, job: { kind: 'diary'; text: string } | { kind: 'phrase'; text: string; context?: string }, now: number): Progress {
  const id = `${job.kind}-${now}-${Math.random().toString(36).slice(2, 7)}`;
  const entry: AiJob = job.kind === 'diary' ? { id, kind: 'diary', text: job.text, at: now, status: 'pending' } : { id, kind: 'phrase', text: job.text, context: job.context, at: now, status: 'pending' };
  return { ...progress, aiQueue: [entry, ...progress.aiQueue].slice(0, 200) };
}

export function pendingJobs(progress: Progress): AiJob[] {
  return progress.aiQueue.filter((j) => j.status === 'pending' || j.status === 'error');
}

/** Aplica o resultado de um pedido da fila (e cria os cartões em "Minhas frases"). */
export function applyResult(progress: Progress, jobId: string, result: Record<string, unknown>, now: number): Progress {
  const job = progress.aiQueue.find((j) => j.id === jobId);
  if (!job) return progress;
  let next: Progress = { ...progress, aiQueue: progress.aiQueue.map((j) => (j.id === jobId ? ({ ...j, status: 'done', error: undefined, result } as AiJob) : j)) };
  if (job.kind === 'phrase') {
    const r = result as { en?: string; pt?: string; example?: string };
    if (r.en && r.pt) next = addCustomItems(next, [{ en: r.en, pt: r.pt, ex: r.example }], now);
  } else {
    const mistakes = ((result as { mistakes?: AiMistake[] }).mistakes ?? []).filter((m) => m.better && m.why_pt);
    next = addCustomItems(next, mistakes.map((m) => ({ en: m.better, pt: m.why_pt.slice(0, 80), ex: m.better, exPt: `Você escreveu: "${m.said}"` })), now, true);
  }
  return next;
}

export function markError(progress: Progress, jobId: string, message: string): Progress {
  return { ...progress, aiQueue: progress.aiQueue.map((j) => (j.id === jobId ? ({ ...j, status: 'error', error: message } as AiJob) : j)) };
}

/**
 * Processa a fila em ordem, um por vez. Para ao primeiro erro de conexão/configuração
 * (tenta de novo depois); erros do servidor marcam só aquele item.
 */
export async function processQueue(
  get: () => Progress,
  update: (fn: (p: Progress) => Progress) => void,
  call: AiCaller,
): Promise<number> {
  let done = 0;
  for (const job of pendingJobs(get())) {
    try {
      const body = job.kind === 'diary' ? { kind: 'diary', text: job.text } : { kind: 'phrase', text: job.text, context: job.context };
      const result = await call('/correct', body);
      update((p) => applyResult(p, job.id, result, Date.now()));
      done++;
    } catch (err) {
      if (err instanceof AiError && (err.kind === 'offline' || err.kind === 'config' || err.kind === 'auth' || err.kind === 'limit')) break;
      update((p) => markError(p, job.id, err instanceof Error ? err.message : 'erro'));
    }
  }
  return done;
}
