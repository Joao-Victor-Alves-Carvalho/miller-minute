/**
 * Estrelas passando (a nave está voando). A cada acerto (`warp` muda), um rastro de
 * velocidade passa uma vez. Com "reduzir movimento" ligado, tudo fica parado.
 */
export function Starfield({ warp }: { warp: number }) {
  return (
    <div className="starfield" aria-hidden="true">
      <div className="stars-layer s1" />
      <div className="stars-layer s2" />
      {warp > 0 && <div key={warp} className="warp-burst" />}
    </div>
  );
}
