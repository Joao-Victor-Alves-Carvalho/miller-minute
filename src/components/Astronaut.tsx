import type { Cosmetic } from '../lib/hangar';

/** Capacete do astronauta com as cores do traje em uso. */
export function Astronaut({ suit, size = 40 }: { suit: Cosmetic; size?: number }) {
  const [main, visor, detail] = suit.colors;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M7 40 C7 31 12 28 20 28 C28 28 33 31 33 40 Z" fill={main} />
      <rect x="17" y="31" width="6" height="4" rx="1" fill={detail} />
      <circle cx="20" cy="17" r="13" fill={main} />
      <rect x="10" y="11" width="20" height="13" rx="6.5" fill={visor} />
      <path d="M13 14 Q16 12.5 19 13" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <circle cx="31" cy="12" r="2" fill={detail} />
    </svg>
  );
}
