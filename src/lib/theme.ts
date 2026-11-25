import type { Appearance } from './progress';

/** Cor da barra do sistema (celular) em cada modo. */
const BAR: Record<'dark' | 'light', string> = { dark: '#07070d', light: '#f3f2fa' };

/** Modo efetivo: "system" segue a preferência do celular. */
export function resolveAppearance(appearance: Appearance, prefersLight: boolean): 'dark' | 'light' {
  if (appearance === 'system') return prefersLight ? 'light' : 'dark';
  return appearance;
}

function prefersLight(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches === true;
}

/** Aplica o modo na página (atributo data-theme e cor da barra do sistema). */
export function applyAppearance(appearance: Appearance): 'dark' | 'light' {
  const mode = resolveAppearance(appearance, prefersLight());
  document.documentElement.dataset.theme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[mode]);
  return mode;
}

/** Lê a aparência salva antes de desenhar a tela (evita piscar escuro ao abrir no modo claro). */
export function savedAppearance(storageKey: string): Appearance {
  try {
    const raw = localStorage.getItem(storageKey);
    const value = raw ? (JSON.parse(raw) as { settings?: { appearance?: unknown } }).settings?.appearance : undefined;
    return value === 'light' || value === 'system' ? value : 'dark';
  } catch {
    return 'dark';
  }
}

/** Avisa quando o celular troca entre claro e escuro (para o modo "system"). */
export function watchSystemAppearance(onChange: () => void): () => void {
  const mq = window.matchMedia?.('(prefers-color-scheme: light)');
  if (!mq) return () => undefined;
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
