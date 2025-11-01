import type { Meld, Card, PublicPlayerState } from "../types/lobby";

type Props = {
  tableMelds: Meld[];
  players: PublicPlayerState[];
  selectedMeldId: string | null;
  handleSelectMeld: (meldId: string) => void;
  describeMeld: (m: Meld) => string;
  getCardColorClass: (card: Card) => string;
  getCardDisplayValue: (card: Card) => string;
  describeCard: (card: Card) => string;
};

export default function TableMelds({
  tableMelds,
  players,
  selectedMeldId,
  handleSelectMeld,
  describeMeld,
  getCardColorClass,
  getCardDisplayValue,
  describeCard,
}: Props) {
  const nameById = new Map(players.map((p) => [p.id, p.name]));
  return (
    <section className="game-section" aria-labelledby="table-melds-title">
      <div className="table-melds">
        <div className="table-melds__header">
          <h3 id="table-melds-title">Juegos sobre la mesa</h3>
          <span className="chip chip--info">{tableMelds.length}</span>
        </div>
        {tableMelds.length === 0 ? (
          <p className="table-melds__empty">Todavía no hay juegos bajados.</p>
        ) : (
          <ul className="meld-list">
            {tableMelds.map((meld) => {
              const isSelected = meld.id === selectedMeldId;
              return (
                <li key={meld.id} className="meld-list__item">
                  <button
                    type="button"
                    className={[
                      "meld-card",
                      isSelected ? "meld-card--selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => handleSelectMeld(meld.id)}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span
                        className="chip chip--info"
                        style={{ fontSize: "0.85rem" }}
                      >
                        {nameById.get(meld.ownerId) ?? "—"}
                      </span>
                      <span className="meld-card__label">
                        {describeMeld(meld)}
                      </span>
                    </div>
                    <div className="meld-card__cards">
                      {meld.cards.map((card) => (
                        <span
                          key={card.id}
                          className={[
                            "meld-card__number",
                            getCardColorClass(card),
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          aria-label={describeCard(card)}
                        >
                          {getCardDisplayValue(card)}
                        </span>
                      ))}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
