import type { Table, PublicGameState, Meld, Card } from "../types/lobby";
import { tableStatusLabel } from "../utils/statusLabels";

type Props = {
  activeTable: Table;
  game?: PublicGameState | null;
  tableMelds: Meld[];
  discardHistory?: Card[];
  discardCount?: number;
  discardLabel: string | null;
  isMyTurn: boolean;
  currentPlayerName: string | null;
  winnerName: string | null;
};

const TURN_STEP_LABEL = {
  draw: "Robar",
  discard: "Descartar",
} as const;

// compact view does not need draw source label

export default function GameInfo({
  activeTable,
  game,
  tableMelds,
  discardHistory,
  discardCount,
  discardLabel,
  isMyTurn,
  currentPlayerName,
  winnerName,
}: Props) {
  return (
    <section className="game-section" aria-labelledby="game-section-info">
      <div className="game-section__header">
        <h3 id="game-section-info">Datos de la partida</h3>
      </div>
      <div className="game-meta-compact">
        <div className="meta-compact__item">
          <span className="meta-card__label">Estado</span>
          <span className="meta-card__value">
            <span className={`chip chip--${activeTable.status}`}>
              {tableStatusLabel(activeTable.status)}
            </span>
          </span>
        </div>
        <div className="meta-compact__item">
          <span className="meta-card__label">Jugadores</span>
          <span className="meta-card__value">
            {activeTable.players.length}/4
          </span>
        </div>
        {game && (
          <div className="meta-compact__item">
            <span className="meta-card__label">Ronda</span>
            <span className="meta-card__value">{game.round}</span>
          </div>
        )}
        {game ? (
          <>
            <div className="meta-compact__item">
              <span className="meta-card__label">Turno</span>
              <span className="meta-card__value">
                {currentPlayerName ?? "—"}
              </span>
              <span className="meta-card__hint" style={{ display: "block" }}>
                {isMyTurn
                  ? "Es tu turno"
                  : game.currentTurn.step === "draw"
                  ? "Debe robar"
                  : "Debe descartar"}
              </span>
            </div>

            <div className="meta-compact__item">
              <span className="meta-card__label">Paso</span>
              <span className="meta-card__value">
                {TURN_STEP_LABEL[game.currentTurn.step]}
              </span>
            </div>

            <div className="meta-compact__item">
              <span className="meta-card__label">Mazo</span>
              <span className="meta-card__value">{game.stockCount}</span>
            </div>

            <div className="meta-compact__item">
              <span className="meta-card__label">Descarte</span>
              <span className="meta-card__value">
                {discardLabel ?? "Vacío"}
              </span>
              {discardHistory && discardHistory.length > 0 && (
                <div style={{ marginTop: 6 }} aria-hidden>
                  {discardHistory.map((c, idx) => (
                    <span
                      key={c.id}
                      className={[
                        "preview-pip",
                        idx === discardHistory.length - 1
                          ? "preview-pip--top"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{ marginRight: 4 }}
                    >
                      {c.kind === "joker" ? "J" : String(c.number)}
                    </span>
                  ))}
                  {typeof discardCount === "number" &&
                    discardCount > (discardHistory?.length ?? 0) && (
                      <span className="preview-badge">
                        +{discardCount - (discardHistory?.length ?? 0)}
                      </span>
                    )}
                </div>
              )}
            </div>

            <div className="meta-compact__item">
              <span className="meta-card__label">Juegos en mesa</span>
              <span className="meta-card__value">{tableMelds.length}</span>
            </div>

            {game.phase === "finished" && (
              <p className="game-end">
                Partida terminada. Ganador: {winnerName ?? "—"}
              </p>
            )}
          </>
        ) : (
          <p className="panel__empty">La partida aún no ha comenzado.</p>
        )}
      </div>
    </section>
  );
}
