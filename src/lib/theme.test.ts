import { describe, expect, it } from 'vitest';
import { emptyProgress, normalizeProgress } from './progress';
import { resolveAppearance } from './theme';

describe('aparência', () => {
  it('escuro e claro são fixos; automático segue o celular', () => {
    expect(resolveAppearance('dark', true)).toBe('dark');
    expect(resolveAppearance('light', false)).toBe('light');
    expect(resolveAppearance('system', true)).toBe('light');
    expect(resolveAppearance('system', false)).toBe('dark');
  });

  it('padrão continua escuro, inclusive em progresso antigo', () => {
    expect(emptyProgress().settings.appearance).toBe('dark');
    const old = normalizeProgress({ settings: { autoAudio: true, sounds: true, newPerDay: 20, goalMinutes: 10, focusPack: null, reminder: '20:00' } } as never);
    expect(old.settings.appearance).toBe('dark');
  });
});
