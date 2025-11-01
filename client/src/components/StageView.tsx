import type { Card } from "../types/lobby";
import type { DragEvent } from "react";

type Props = {
  stagedRows: (Card | null)[][];
  displayHand: Card[];
  handleDragStart: (e: DragEvent<HTMLButtonElement>, index: number) => void;
  handleDragOver: (e: DragEvent<HTMLElement>) => void;
  handleDrop: (e: DragEvent<HTMLElement>, toIndex: number) => void;
  selectedCardIds: string[];
  handleSelectCard: (cardId: string) => void;
  myHandCount: number;
  discardTop: Card | null;
  discardHistory?: Card[];
  discardCount?: number;
  discardLabel: string | null;
  getCardColorClass: (card: Card) => string;
  getCardDisplayValue: (card: Card) => string;
  describeCard: (card: Card) => string;
  isMyTurn: boolean;
  currentTurnStep?: "draw" | "discard";
  selectedCardCount: number;
  currentPlayerName: string | null;
  onOpenDiscard?: () => Promise<void> | void;
};

export default function StageView({
  stagedRows,
  displayHand,
  handleDragStart,
  handleDragOver,
  handleDrop,
  selectedCardIds,
  handleSelectCard,
  myHandCount,
  discardTop,
  discardLabel,
  discardHistory,
  discardCount,
  getCardColorClass,
  getCardDisplayValue,
  describeCard,
  isMyTurn,
  currentTurnStep,
  selectedCardCount,
  currentPlayerName,
  onOpenDiscard,
}: Props) {
  const slotsPerRow = stagedRows[0]?.length ?? 0;
  void displayHand;

  return (
    <div className="game-stage" aria-label="Palco para formar combinaciones con tus fichas">
      <div className="game-stage__header">
        <h3>Mis fichas</h3>
        <span className="game-stage__count">{myHandCount} en mano</span>
      </div>

      <div className="stage-wrapper">
        {stagedRows.map((row, rowIndex) => (
          <div key={`stage-row-${rowIndex}`} className={`stage-row stage-row--${rowIndex}`}>
            <div className="stage-row__label">Fila {rowIndex + 1}</div>
            <div className="stage-row__cards">
              {row.map((card, colIndex) => {
                const flatIndex = rowIndex * slotsPerRow + colIndex;
                if (!card) {
                  return (
                    <div
                      key={`empty-${flatIndex}`}
                      className="stage-row__empty"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, flatIndex)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Espacio vacío ${rowIndex + 1}-${colIndex + 1}`}
                    >
                      Espacio disponible
                    </div>
                  );
                }

                return (
                  <button
                    key={card.id}
                    type="button"
                    draggable
                    onDragStart={(e) => handleDragStart(e as DragEvent<HTMLButtonElement>, flatIndex)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, flatIndex)}
                    className={["card-tile", selectedCardIds.includes(card.id) ? "card-tile--selected" : ""].filter(Boolean).join(" ")}
                    onClick={() => handleSelectCard(card.id)}
                    aria-label={describeCard(card)}
                  >
                    <span className={["card-tile__number", getCardColorClass(card)].filter(Boolean).join(" ")}>
                      {card.kind === "joker" ? "✚" : getCardDisplayValue(card)}
                    </span>
                    <span className="card-tile__value">
                      {card.kind === "joker" ? `Comodín · ${card.value} pts` : `${card.value} pts`}
                    </span>
                    <span className="card-tile__pip" aria-hidden />
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="stage-discard" aria-hidden>
          {discardHistory && discardHistory.length > 0 ? (
            <div className="stage-discard__stack" aria-label={discardLabel ?? undefined}>
              {discardHistory.map((c, i) => (
                <div key={c.id} className={`stage-discard__mini stage-discard__mini--${i}`}>
                  <span className={["card-tile__number", getCardColorClass(c)].filter(Boolean).join(" ")}>
                    {c.kind === "joker" ? "✚" : String(c.number)}
                  </span>
                </div>
              ))}
              {typeof discardCount === "number" && discardCount > discardHistory.length && (
                <div className="stage-discard__count">+{discardCount - discardHistory.length}</div>
              )}
              <button type="button" className="button--icon button--icon--eye" onClick={() => onOpenDiscard && onOpenDiscard()} title="Ver descarte" aria-label="Ver descarte completo">
                Ver
              </button>
            </div>
          ) : discardTop ? (
            <div className="stage-discard__card">
              <span className={["card-tile__number", getCardColorClass(discardTop)].filter(Boolean).join(" ")} aria-label={discardLabel ?? undefined}>
                {discardTop.kind === "joker" ? "✚" : getCardDisplayValue(discardTop)}
              </span>
              <span className="stage-discard__value">
                {discardTop.kind === "joker" ? `Comodín · ${discardTop.value} pts` : `${discardTop.value} pts`}
              </span>
              <span className="card-tile__pip" aria-hidden />
              <button type="button" className="button--icon button--icon--eye" onClick={() => onOpenDiscard && onOpenDiscard()} title="Ver descarte" aria-label="Ver descarte completo">
                Ver
              </button>
            </div>
          ) : (
            <div className="stage-discard__empty">Vacío</div>
          )}
        </div>
      </div>

      {isMyTurn && currentTurnStep === "discard" && selectedCardCount === 0 && (
        <p className="stage-hint">Selecciona fichas para descartarlas o formar un juego.</p>
      )}
      {isMyTurn && currentTurnStep === "discard" && selectedCardCount > 1 && (
        <p className="stage-hint">Para descartar elige solo una ficha.</p>
      )}
    </div>
  );
}
        </div>
      </div>

      {isMyTurn && currentTurnStep === "discard" && selectedCardCount === 0 && (
        <p className="stage-hint">
          Selecciona fichas para descartarlas o formar un juego.
        </p>
      )}
      {isMyTurn && currentTurnStep === "discard" && selectedCardCount > 1 && (
        <p className="stage-hint">Para descartar elige solo una ficha.</p>
      )}
    </div>
  );
              </span>
              <span className="stage-discard__value">
                {discardTop.kind === "joker"
                  ? `Comodín · ${discardTop.value} pts`
                  : `${discardTop.value} pts`}
              </span>
              <span className="card-tile__pip" aria-hidden />
              <button
                type="button"
                className="button--icon button--icon--eye"
                onClick={() => onOpenDiscard && onOpenDiscard()}
                title="Ver descarte"
                aria-label="Ver descarte completo"
              >
                👁️
              </button>
            </div>
          ) : (
            <div className="stage-discard__empty">Vacío</div>
          )}
        </div>
      </div>

      {isMyTurn && currentTurnStep === "discard" && selectedCardCount === 0 && (
        <p className="stage-hint">
          Selecciona fichas para descartarlas o formar un juego.
                    <span
                      className={[
                        "card-tile__number",
                        getCardColorClass(card),
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {card.kind === "joker" ? (
                        <span aria-hidden>
                          {/* use dynamic icon for jokers */}
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden
                            focusable="false"
                            className="joker-icon"
                          >
                            <path d="M11 3h2v8h8v2h-8v8h-2v-8H3v-2h8V3z" fill="currentColor" />
                          </svg>
                        </span>
                      ) : (
                        getCardDisplayValue(card)
                      )}
                    </span>
