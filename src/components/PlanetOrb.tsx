import type { Planet } from '../data/galaxy';

/** Planeta desenhado com CSS (gradiente + anel opcional). */
export function PlanetOrb({ planet, size = 56, ring = false, dim = false }: { planet: Planet; size?: number; ring?: boolean; dim?: boolean }) {
  const [a, b] = planet.colors;
  return (
    <span
      className={`planet-orb${ring ? ' ring' : ''}${dim ? ' dim' : ''}`}
      style={{ width: size, height: size, ['--pa' as string]: a, ['--pb' as string]: b }}
      aria-hidden="true"
    />
  );
}
