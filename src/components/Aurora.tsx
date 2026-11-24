import type { CSSProperties } from 'react';

export type Mood = 'idle' | 'correct' | 'wrong';

/** Fundo com manchas de cor em movimento; muda de cor no acerto e no erro. As cores vêm do tema do hangar. */
export function Aurora({ mood, colors }: { mood: Mood; colors?: readonly [string, string, string] }) {
  const style = colors ? ({ '--blob1': colors[0], '--blob2': colors[1], '--blob3': colors[2] } as CSSProperties) : undefined;
  return (
    <div className="aurora" data-mood={mood} aria-hidden="true" style={style}>
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
    </div>
  );
}
