import type { Card } from "../types/lobby";

type Props = {
  canDraw: boolean;
  discardTop: Card | null;
  canPlayMeld: boolean;
  canExtendMeld: boolean;
  canDiscard: boolean;
  selectedCardCount: number;
  selectedMeldId: string | null;
  handleDrawStock: () => Promise<void> | void;
  handleDrawDiscard: () => Promise<void> | void;
  handlePlayMeld: (type: "set" | "sequence") => Promise<void> | void;
  handleExtendMeld: () => Promise<void> | void;
  handleDiscardSelected: () => Promise<void> | void;
  handleClearSelection: () => void;
};

export default function GameControls({
  canDraw,
  discardTop,
  canPlayMeld,
  canExtendMeld,
  canDiscard,
  selectedCardCount,
  selectedMeldId,
  handleDrawStock,
  handleDrawDiscard,
  handlePlayMeld,
  handleExtendMeld,
  handleDiscardSelected,
  handleClearSelection,
}: Props) {
  return (
    <div className="game-controls">
      <button type="button" onClick={handleDrawStock} disabled={!canDraw}>
        Robar del mazo
      </button>
      <button
        type="button"
        onClick={handleDrawDiscard}
        disabled={!canDraw || !discardTop}
      >
        Robar del descarte
      </button>
      <button
        type="button"
        onClick={() => handlePlayMeld("set")}
        disabled={!canPlayMeld}
      >
        Bajar pierna
      </button>
      <button
        type="button"
        onClick={() => handlePlayMeld("sequence")}
        disabled={!canPlayMeld}
      >
        Bajar escalera
      </button>
      <button
        type="button"
        onClick={handleExtendMeld}
        disabled={!canExtendMeld}
      >
        Agregar a juego
      </button>
      <button
        type="button"
        onClick={handleDiscardSelected}
        disabled={!canDiscard || selectedCardCount !== 1}
      >
        Descartar
      </button>
      <button
        type="button"
        className="button--ghost"
        onClick={handleClearSelection}
        disabled={selectedCardCount === 0 && !selectedMeldId}
      >
        Limpiar selección
      </button>
    </div>
  );
}
