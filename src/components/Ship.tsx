import type { Cosmetic } from '../lib/hangar';

/** Nave do hangar desenhada em SVG (apontando para cima). `thrust` mostra o fogo do motor. */
export function Ship({ ship, size = 40, thrust = true }: { ship: Cosmetic; size?: number; thrust?: boolean }) {
  const [hull, accent, flame] = ship.colors;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="ship-svg">
      {thrust && <path className="ship-flame" d="M16 31 L20 40 L24 31 Z" fill={flame} />}
      {ship.shape === 'round' ? (
        <>
          <path d="M9 27 L6 33 M31 27 L34 33" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="20" cy="24" rx="13" ry="7" fill={hull} />
          <path d="M11 22 a9 10 0 0 1 18 0 Z" fill={accent} opacity="0.9" />
          <circle cx="20" cy="17" r="3.2" fill="#e0f2fe" />
          <rect x="15" y="26" width="10" height="5" rx="2" fill={accent} />
        </>
      ) : ship.shape === 'needle' ? (
        <>
          <path d="M20 2 C24 10 25 20 24 31 L16 31 C15 20 16 10 20 2 Z" fill={hull} />
          <path d="M16 22 L9 31 L16 30 Z M24 22 L31 31 L24 30 Z" fill={accent} />
          <circle cx="20" cy="13" r="2.6" fill="#e0f2fe" stroke={accent} strokeWidth="1.2" />
        </>
      ) : (
        <>
          <path d="M20 3 C27 9 28 20 26 31 L14 31 C12 20 13 9 20 3 Z" fill={hull} />
          <path d="M14 21 L7 30 L14 31 Z M26 21 L33 30 L26 31 Z" fill={accent} />
          <circle cx="20" cy="15" r="3.6" fill="#e0f2fe" stroke={accent} strokeWidth="1.6" />
          <rect x="18" y="24" width="4" height="7" rx="1.5" fill={accent} />
        </>
      )}
    </svg>
  );
}
