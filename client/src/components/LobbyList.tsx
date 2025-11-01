type TableSummary = {
  id: string;
  status: "waiting" | "playing" | "finished";
  playerCount: number;
  createdAt?: number;
  game?: {
    round?: number;
    meldCount?: number;
    stockCount?: number;
    discardTop?: unknown;
  } | null;
};

type Props = {
  tables: TableSummary[];
  selectedTableId: string | null;
  handleJoinTable: (tableId: string) => Promise<void> | void;
  playerName: string;
};

export default function LobbyList({
  tables,
  selectedTableId,
  handleJoinTable,
  playerName,
}: Props) {
  return (
    <section className="panel" aria-labelledby="lobby-panel">
      <div className="panel__header" id="lobby-panel">
        <h2>Salas disponibles</h2>
        <span>{tables.length} mesas</span>
      </div>
      {tables.length === 0 ? (
        <p className="panel__empty">No hay mesas todavía. ¡Crea la primera!</p>
      ) : (
        <ul className="table-list">
          {tables.map((table) => {
            const isSelected = table.id === selectedTableId;
            const summary = table.game;
            const formatCompactDate = (ts?: number) => {
              if (!ts) return "";
              try {
                const d = new Date(ts);
                const day = String(d.getDate()).padStart(2, "0");
                const month = d.toLocaleString("es-ES", { month: "short" });
                const hour = String(d.getHours()).padStart(2, "0");
                const min = String(d.getMinutes()).padStart(2, "0");
                return `${day} ${month} · ${hour}:${min}`;
              } catch {
                return "";
              }
            };
            const description = summary
              ? `Ronda ${summary.round} · ${summary.meldCount} juegos`
              : table.status === "waiting"
              ? `Faltan ${Math.max(0, 2 - table.playerCount)} jugador(es)`
              : table.status === "playing"
              ? "Partida en curso"
              : "Partida finalizada";
            // show Spanish label for status but keep the original status string for CSS
            const statusLabelSpanish = (() => {
              if (table.status === "waiting") return "Esperando";
              if (table.status === "playing") return "En juego";
              return "Finalizada";
            })();
            return (
              <li
                key={table.id}
                className={
                  isSelected
                    ? "table-list__item table-list__item--selected"
                    : "table-list__item"
                }
              >
                <div className="table-list__header">
                  <div className="table-list__title">
                    <h3>Mesa {table.id.slice(0, 8)}</h3>
                    <p className="table-list__description">
                      {description}
                      {table.createdAt ? (
                        <small className="table-list__created">
                          {formatCompactDate(table.createdAt)}
                        </small>
                      ) : null}
                    </p>
                  </div>
                  <span className={`chip chip--${table.status}`}>
                    {statusLabelSpanish}
                  </span>
                </div>
                <div className="table-list__body">
                  <div className="table-list__meta">
                    <div className="table-list__meta-item">
                      <span className="table-list__meta-label">Jugadores</span>
                      <strong>{table.playerCount}/4</strong>
                    </div>
                    <div className="table-list__meta-item">
                      <span className="table-list__meta-label">Estado</span>
                      <strong>{statusLabelSpanish}</strong>
                    </div>
                    {summary ? (
                      <>
                        <div className="table-list__meta-item">
                          <span className="table-list__meta-label">Ronda</span>
                          <strong>{summary.round}</strong>
                        </div>
                        <div className="table-list__meta-item">
                          <span className="table-list__meta-label">Mazo</span>
                          <strong>{summary.stockCount}</strong>
                        </div>
                        <div className="table-list__meta-item">
                          <span className="table-list__meta-label">
                            Descarte
                          </span>
                          <strong>
                            {summary.discardTop ? "..." : "Vacío"}
                          </strong>
                        </div>
                      </>
                    ) : (
                      <div className="table-list__meta-item">
                        <span className="table-list__meta-label">Faltan</span>
                        <strong>{Math.max(0, 2 - table.playerCount)}</strong>
                      </div>
                    )}
                  </div>
                  <div className="table-list__actions">
                    <button
                      type="button"
                      onClick={() => handleJoinTable(table.id)}
                      disabled={
                        playerName.length === 0 || table.status === "finished"
                      }
                      title={
                        table.status === "finished"
                          ? "No puedes unirte a partidas finalizadas"
                          : undefined
                      }
                    >
                      Unirme
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
