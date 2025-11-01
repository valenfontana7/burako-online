import type { Table, PublicGameState } from "../types/lobby";

type Props = {
  activeTable: Table;
  game?: PublicGameState | null;
};

export default function PlayerList({ activeTable, game }: Props) {
  const renderPlayerListItems = () => {
    if (!activeTable) return null;

    return activeTable.players.map((player) => {
      const playerGame = game?.players.find((g) => g.id === player.id);
      const isCurrentTurn =
        game?.phase === "playing" && game.currentTurn.playerId === player.id;
      const classes = [
        "player-list__item",
        player.id === activeTable.hostId ? "player-list__item--host" : "",
        isCurrentTurn ? "player-list__item--turn" : "",
      ]
        .filter(Boolean)
        .join(" ");

      const playerStats = playerGame
        ? [
            { label: "Puntos", value: `${playerGame.score}` },
            { label: "En mano", value: `${playerGame.handCount}` },
            {
              label: "Muerto",
              value: playerGame.hasTakenDead
                ? "Tomado"
                : `${playerGame.deadCount}`,
            },
            { label: "Juegos", value: `${playerGame.melds.length}` },
          ]
        : [
            {
              label: "Asiento",
              value: player.seat !== null ? `${player.seat + 1}` : "—",
            },
            {
              label: "Estado",
              value:
                activeTable.status === "waiting"
                  ? "Esperando"
                  : activeTable.status === "playing"
                  ? "En juego"
                  : "Finalizada",
            },
          ];

      return (
        <li key={player.id} className={classes}>
          <div className="player-list__header">
            <span className="player-list__name">
              {player.name}
              {playerGame?.isSelf ? " (Tú)" : ""}
            </span>
            <div className="player-list__badges">
              {player.isHost && (
                <span className="chip chip--host">Anfitrión</span>
              )}
              {playerGame?.isSelf && (
                <span className="chip chip--self">Tú</span>
              )}
              {isCurrentTurn && <span className="chip chip--turn">Turno</span>}
              {playerGame?.hasTakenDead && (
                <span className="chip chip--dead">Muerto</span>
              )}
            </div>
          </div>
          <div className="player-list__stats">
            {playerStats.map((stat) => (
              <div key={stat.label} className="player-stat">
                <span className="player-stat__label">{stat.label}</span>
                <span className="player-stat__value">{stat.value}</span>
              </div>
            ))}
          </div>
        </li>
      );
    });
  };

  return (
    <section className="game-section" aria-labelledby="game-section-players">
      <div className="game-section__header">
        <h3 id="game-section-players">Jugadores</h3>
        <span className="chip chip--info">{activeTable.players.length}</span>
      </div>
      <ul className="player-list">{renderPlayerListItems()}</ul>
    </section>
  );
}
