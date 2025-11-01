import type { Card } from "../types/lobby";

type Props = {
  open: boolean;
  onClose: () => void;
  discardPile: Card[] | null;
};

export default function DiscardModal({ open, onClose, discardPile }: Props) {
  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal discard-modal">
        <div className="modal__header">
          <h2>Descarte</h2>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="modal__body">
          {discardPile && discardPile.length > 0 ? (
            <div className="discard-grid">
              {discardPile.map((c) => (
                <div key={c.id} className="card-tile card-tile--mini">
                  <span
                    className={[
                      "card-tile__number",
                      c.kind === "joker"
                        ? "card-tile__number--joker"
                        : `card-tile__number--${c.color}`,
                    ].join(" ")}
                  >
                    {c.kind === "joker" ? "J" : String(c.number)}
                  </span>
                  <span className="card-tile__value">
                    {c.kind === "joker"
                      ? `Comodín · ${c.value} pts`
                      : `${c.value} pts`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p>Sin fichas en el descarte.</p>
          )}
        </div>
        <div className="modal__footer">
          <button type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
