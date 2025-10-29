import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import "./App.css";
import { useLobby } from "./hooks/useLobby";
import type { Card, Meld, StandardCard, TableStatus } from "./types/lobby";

const randomName = () => `Jugador-${Math.floor(Math.random() * 900 + 100)}`;

const CARD_COLOR_LABEL: Record<StandardCard["color"], string> = {
  black: "negro",
  red: "rojo",
  blue: "azul",
  yellow: "amarillo",
};

const CARD_COLOR_CLASS: Record<StandardCard["color"], string> = {
  black: "card-tile__number--black",
  red: "card-tile__number--red",
  blue: "card-tile__number--blue",
  yellow: "card-tile__number--yellow",
};

const TABLE_STATUS_LABEL: Record<TableStatus, string> = {
  waiting: "Esperando",
  playing: "En juego",
  finished: "Finalizada",
};

const TURN_STEP_LABEL = {
  draw: "Robar",
  discard: "Descartar",
} as const;

const DRAW_SOURCE_LABEL = {
  stock: "Mazo",
  discard: "Descarte",
} as const;

const describeCard = (card: Card): string =>
  card.kind === "joker"
    ? "Comodín"
    : `${card.number} ${CARD_COLOR_LABEL[card.color]}`;

const getCardDisplayValue = (card: Card): string =>
  card.kind === "joker" ? "J" : String(card.number);

const getCardColorClass = (card: Card): string => {
  if (card.kind === "joker") {
    return "card-tile__number--joker";
  }
  return CARD_COLOR_CLASS[card.color];
};

const describeMeld = (meld: Meld): string => {
  const base = meld.type === "set" ? "Pierna" : "Corrida";
  return meld.isClean ? `${base} limpia` : `${base} sucia`;
};

const App = () => {
  const [fallbackName] = useState(() => randomName());
  const [rawName, setRawName] = useState(() => fallbackName);
  const playerName = useMemo(
    () => rawName.trim() || fallbackName,
    [fallbackName, rawName]
  );
  const { state, actions } = useLobby(playerName);
  const {
    createTable,
    joinTable,
    leaveTable,
    startGame,
    drawFromStock,
    drawFromDiscard,
    discardCard,
    playMeld,
    extendMeld,
  } = actions;
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [selectedMeldId, setSelectedMeldId] = useState<string | null>(null);
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const [activeCompactTab, setActiveCompactTab] =
    useState<"info" | "players" | "melds">("info");
  const activeTable = state.activeTable;

  useEffect(() => {
    if (activeTable) {
      setSelectedTableId(activeTable.id);
    }
  }, [activeTable]);

  const game = state.game;
  const myPlayer = game?.players.find((player) => player.isSelf) ?? null;
  const myHand = useMemo(() => myPlayer?.hand ?? [], [myPlayer]);
  const tableMelds = useMemo(() => game?.tableMelds ?? [], [game]);
  const stagedRows = useMemo(() => {
    const rows: Card[][] = [[], [], []];

    myHand.forEach((card, index) => {
      rows[index % 3].push(card);
    });

    return rows;
  }, [myHand]);
  const activeTableId = activeTable?.id ?? null;
  const isHost = activeTable?.hostId === state.selfId;
  const canStartGame = Boolean(
    activeTable &&
      activeTable.status === "waiting" &&
      activeTable.players.length >= 2 &&
      isHost
  );
  const isMyTurn = Boolean(
    game && myPlayer && game.currentTurn.playerId === myPlayer.id
  );
  const canDraw = isMyTurn && game?.currentTurn.step === "draw";
  const canDiscard = isMyTurn && game?.currentTurn.step === "discard";
  const discardTop = game?.discardTop ?? null;
  const discardLabel = discardTop ? describeCard(discardTop) : null;
  const currentPlayer = game
    ? activeTable?.players.find(
        (player) => player.id === game.currentTurn.playerId
      ) ?? null
    : null;
  const winner = game?.winnerId
    ? activeTable?.players.find((player) => player.id === game.winnerId) ?? null
    : null;
  const selectedCardCount = selectedCardIds.length;
  const selectedDiscardCard = selectedCardIds[0] ?? null;
  const canPlayMeld =
    isMyTurn && game?.currentTurn.step === "discard" && selectedCardCount >= 3;
  const canExtendMeld =
    isMyTurn &&
    game?.currentTurn.step === "discard" &&
    selectedCardCount >= 1 &&
    Boolean(selectedMeldId);

  useEffect(() => {
    setSelectedCardIds((prev) =>
      prev.filter((cardId) => myHand.some((card) => card.id === cardId))
    );
  }, [myHand]);

  useEffect(() => {
    if (
      selectedMeldId &&
      !tableMelds.some((meld) => meld.id === selectedMeldId)
    ) {
      setSelectedMeldId(null);
    }
  }, [selectedMeldId, tableMelds]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 768px)");

    const listener = (event: MediaQueryListEvent) => {
      setIsCompactLayout(event.matches);
    };

    setIsCompactLayout(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    }

    mediaQuery.addListener(listener);
    return () => mediaQuery.removeListener(listener);
  }, []);

  useEffect(() => {
    if (!isCompactLayout) {
      setActiveCompactTab("info");
    }
  }, [isCompactLayout]);

  const handleCreateTable = useCallback(async () => {
    const tableId = await createTable();
    if (tableId) {
      setSelectedTableId(tableId);
    }
  }, [createTable]);

  const handleJoinTable = useCallback(
    async (tableId: string) => {
      const success = await joinTable(tableId);
      if (success) {
        setSelectedTableId(tableId);
      }
    },
    [joinTable]
  );

  const handleLeaveTable = useCallback(async () => {
    const tableId = activeTable?.id ?? selectedTableId;
    if (!tableId) {
      return;
    }

    const success = await leaveTable(tableId);
    if (success) {
      setSelectedTableId(null);
      setSelectedCardIds([]);
      setSelectedMeldId(null);
    }
  }, [activeTable?.id, leaveTable, selectedTableId]);

  const handleStartGame = useCallback(async () => {
    if (!activeTableId) {
      return;
    }
    await startGame(activeTableId);
  }, [activeTableId, startGame]);

  const handleDrawStock = useCallback(async () => {
    if (!activeTableId) {
      return;
    }
    await drawFromStock(activeTableId);
  }, [activeTableId, drawFromStock]);

  const handleDrawDiscard = useCallback(async () => {
    if (!activeTableId) {
      return;
    }
    await drawFromDiscard(activeTableId);
  }, [activeTableId, drawFromDiscard]);

  const handleDiscardSelected = useCallback(async () => {
    if (!activeTableId || !selectedDiscardCard) {
      return;
    }
    const ok = await discardCard(activeTableId, selectedDiscardCard);
    if (ok) {
      setSelectedCardIds((prev) =>
        prev.filter((id) => id !== selectedDiscardCard)
      );
    }
  }, [activeTableId, discardCard, selectedDiscardCard]);

  const handleSelectCard = useCallback((cardId: string) => {
    setSelectedCardIds((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId]
    );
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedCardIds([]);
    setSelectedMeldId(null);
  }, []);

  const handleSelectMeld = useCallback((meldId: string) => {
    setSelectedMeldId((prev) => (prev === meldId ? null : meldId));
  }, []);

  const handlePlayMeld = useCallback(
    async (type: "set" | "sequence") => {
      if (!activeTableId || selectedCardIds.length < 3) {
        return;
      }

      const ok = await playMeld(activeTableId, selectedCardIds, type);
      if (ok) {
        setSelectedCardIds([]);
      }
    },
    [activeTableId, playMeld, selectedCardIds]
  );

  const handleExtendMeld = useCallback(async () => {
    if (!activeTableId || !selectedMeldId || selectedCardIds.length === 0) {
      return;
    }

    const ok = await extendMeld(activeTableId, selectedMeldId, selectedCardIds);
    if (ok) {
      setSelectedCardIds([]);
    }
  }, [activeTableId, extendMeld, selectedCardIds, selectedMeldId]);

  const handleNameSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const renderPlayerListItems = () => {
    if (!activeTable) {
      return null;
    }

    return activeTable.players.map((player) => {
      const playerGame = game?.players.find(
        (gPlayer) => gPlayer.id === player.id
      );
      const isCurrentTurn =
        game?.phase === "playing" &&
        game.currentTurn.playerId === player.id;
      const classes = [
        "player-list__item",
        player.id === activeTable.hostId ? "player-list__item--host" : "",
        isCurrentTurn ? "player-list__item--turn" : "",
      ]
        .filter(Boolean)
        .join(" ");

      const playerStats = playerGame
        ? [
            {
              label: "Puntos",
              value: `${playerGame.score}`,
            },
            {
              label: "En mano",
              value: `${playerGame.handCount}`,
            },
            {
              label: "Muerto",
              value: playerGame.hasTakenDead
                ? "Tomado"
                : `${playerGame.deadCount}`,
            },
            {
              label: "Juegos",
              value: `${playerGame.melds.length}`,
            },
          ]
        : [
            {
              label: "Asiento",
              value: player.seat !== null ? `${player.seat + 1}` : "—",
            },
            {
              label: "Estado",
              value: TABLE_STATUS_LABEL[activeTable.status],
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
              {isCurrentTurn && (
                <span className="chip chip--turn">Turno</span>
              )}
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

  const playerListSection = activeTable ? (
    <section className="game-section" aria-labelledby="game-section-players">
      <div className="game-section__header">
        <h3 id="game-section-players">Jugadores</h3>
        <span className="chip chip--info">{activeTable.players.length}</span>
      </div>
      <ul className="player-list">{renderPlayerListItems()}</ul>
    </section>
  ) : null;

  const gameInfoSection = activeTable ? (
    <section className="game-section" aria-labelledby="game-section-info">
      <div className="game-section__header">
        <h3 id="game-section-info">Datos de la partida</h3>
      </div>
      <div className="game-meta game-meta--section">
        <div className="meta-card">
          <span className="meta-card__label">Estado</span>
          <span className="meta-card__value">
            <span className={`chip chip--${activeTable.status}`}>
              {TABLE_STATUS_LABEL[activeTable.status]}
            </span>
          </span>
          <span className="meta-card__hint">
            {activeTable.status === "waiting"
              ? "Esperando jugadores"
              : activeTable.status === "playing"
              ? "Partida en curso"
              : "Partida finalizada"}
          </span>
        </div>
        <div className="meta-card">
          <span className="meta-card__label">Jugadores</span>
          <span className="meta-card__value">
            {activeTable.players.length}/4
          </span>
          <span className="meta-card__hint">
            {activeTable.players.length < 2
              ? "Se requieren 2 jugadores"
              : "Mesa lista"}
          </span>
        </div>
        {game && (
          <div className="meta-card">
            <span className="meta-card__label">Ronda</span>
            <span className="meta-card__value">{game.round}</span>
            <span className="meta-card__hint">Progreso actual</span>
          </div>
        )}
      </div>
      {game ? (
        <>
          <div className="game-status">
            <div
              className={
                isMyTurn ? "stat-card stat-card--highlight" : "stat-card"
              }
            >
              <span className="stat-card__label">Turno actual</span>
              <span className="stat-card__value">
                {currentPlayer ? currentPlayer.name : "Pendiente"}
              </span>
              <span className="stat-card__hint">
                {isMyTurn
                  ? "Es tu turno"
                  : game.currentTurn.step === "draw"
                  ? "Debe robar una ficha"
                  : "Debe descartar una ficha"}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Paso</span>
              <span className="stat-card__value">
                {TURN_STEP_LABEL[game.currentTurn.step]}
              </span>
              <span className="stat-card__hint">
                {game.currentTurn.drawnFrom
                  ? `Robó del ${DRAW_SOURCE_LABEL[game.currentTurn.drawnFrom]}`
                  : "Aún no ha robado"}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Ronda</span>
              <span className="stat-card__value">{game.round}</span>
              <span className="stat-card__hint">
                {game.phase === "finished"
                  ? "Partida finalizada"
                  : "Partida en juego"}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Mazo</span>
              <span className="stat-card__value">{game.stockCount}</span>
              <span className="stat-card__hint">Fichas restantes</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Descarte</span>
              <span className="stat-card__value">{discardLabel ?? "Vacío"}</span>
              <span className="stat-card__hint">
                {discardTop ? `${discardTop.value} pts` : "Sin fichas aún"}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Juegos en mesa</span>
              <span className="stat-card__value">{tableMelds.length}</span>
              <span className="stat-card__hint">
                {tableMelds.length === 0
                  ? "Sin juegos todavía"
                  : "Listos para extender"}
              </span>
            </div>
          </div>
          {game.phase === "finished" && (
            <p className="game-end">
              Partida terminada. Ganador: {winner ? winner.name : "—"}
            </p>
          )}
        </>
      ) : (
        <p className="panel__empty">La partida aún no ha comenzado.</p>
      )}
    </section>
  ) : null;

  const tableMeldsSection = game ? (
    <section className="game-section" aria-labelledby="table-melds-title">
      <div className="table-melds">
        <div className="table-melds__header">
          <h3 id="table-melds-title">Juegos sobre la mesa</h3>
          <span className="chip chip--info">{tableMelds.length}</span>
        </div>
        {tableMelds.length === 0 ? (
          <p className="table-melds__empty">
            Todavía no hay juegos bajados.
          </p>
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
                    <span className="meld-card__label">
                      {describeMeld(meld)}
                    </span>
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
  ) : null;

  const compactTabContent: Record<"info" | "players" | "melds", ReactNode> = {
    info: gameInfoSection,
    players: playerListSection,
    melds: tableMeldsSection,
  };

  const currentCompactContent = compactTabContent[activeCompactTab];

  const showCompactTabsInHeader = Boolean(activeTable && isCompactLayout);
  const shouldRenderHeader = !activeTable || showCompactTabsInHeader;
  const appHeaderClassName = showCompactTabsInHeader
    ? "app__header app__header--compact"
    : "app__header";

  const renderCompactTabNav = () => (
    <div
      className="game-tabs__nav"
      role="tablist"
      aria-label="Secciones de la partida"
    >
      <button
        type="button"
        className={
          activeCompactTab === "info"
            ? "game-tabs__button game-tabs__button--active"
            : "game-tabs__button"
        }
        role="tab"
        aria-selected={activeCompactTab === "info"}
        onClick={() => setActiveCompactTab("info")}
      >
        Datos
      </button>
      <button
        type="button"
        className={
          activeCompactTab === "melds"
            ? "game-tabs__button game-tabs__button--active"
            : "game-tabs__button"
        }
        role="tab"
        aria-selected={activeCompactTab === "melds"}
        onClick={() => setActiveCompactTab("melds")}
      >
        Juegos
      </button>
      <button
        type="button"
        className={
          activeCompactTab === "players"
            ? "game-tabs__button game-tabs__button--active"
            : "game-tabs__button"
        }
        role="tab"
        aria-selected={activeCompactTab === "players"}
        onClick={() => setActiveCompactTab("players")}
      >
        Jugadores
      </button>
    </div>
  );

  return (
    <div className="app">
      {shouldRenderHeader && (
        <header className={appHeaderClassName}>
          {!activeTable && (
            <div>
              <h1>Burako Online</h1>
              <p className="app__subtitle">Lobby temprano · Real-time</p>
            </div>
          )}
          {showCompactTabsInHeader && renderCompactTabNav()}
        </header>
      )}

      {!activeTable && (
        <>
          <section className="panel" aria-labelledby="player-panel">
            <div className="panel__header" id="player-panel">
              <h2>Tu mesa</h2>
            </div>
            <form className="panel__form" onSubmit={handleNameSubmit}>
              <label className="panel__label" htmlFor="player-name">
                Nombre de jugador
              </label>
              <div className="panel__field-group">
                <input
                  id="player-name"
                  value={rawName}
                  onChange={(event) => setRawName(event.target.value)}
                  placeholder="Ingresa tu nombre"
                  maxLength={32}
                />
                <button type="button" onClick={() => setRawName(randomName())}>
                  Aleatorio
                </button>
              </div>
              <div className="panel__actions">
                <button
                  type="button"
                  onClick={handleCreateTable}
                  disabled={state.isConnecting}
                >
                  Crear mesa
                </button>
                <button
                  type="button"
                  onClick={handleLeaveTable}
                  disabled={!activeTable && !selectedTableId}
                >
                  Salir de mesa
                </button>
              </div>
            </form>
            {state.error && <p className="panel__error">{state.error}</p>}
          </section>

          <section className="panel" aria-labelledby="lobby-panel">
            <div className="panel__header" id="lobby-panel">
              <h2>Salas disponibles</h2>
              <span>{state.tables.length} mesas</span>
            </div>
            {state.tables.length === 0 ? (
              <p className="panel__empty">
                No hay mesas todavía. ¡Crea la primera!
              </p>
            ) : (
              <ul className="table-list">
                {state.tables.map((table) => {
                  const isSelected = table.id === selectedTableId;
                  const statusLabel = TABLE_STATUS_LABEL[table.status];
                  const summary = table.game;
                  const description = summary
                    ? `Ronda ${summary.round} · ${summary.meldCount} juegos`
                    : table.status === "waiting"
                    ? `Faltan ${Math.max(0, 2 - table.playerCount)} jugador(es)`
                    : table.status === "playing"
                    ? "Partida en curso"
                    : "Partida finalizada";
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
                          </p>
                        </div>
                        <span className={`chip chip--${table.status}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="table-list__body">
                        <div className="table-list__meta">
                          <div className="table-list__meta-item">
                            <span className="table-list__meta-label">
                              Jugadores
                            </span>
                            <strong>{table.playerCount}/4</strong>
                          </div>
                          <div className="table-list__meta-item">
                            <span className="table-list__meta-label">
                              Estado
                            </span>
                            <strong>{statusLabel}</strong>
                          </div>
                          {summary ? (
                            <>
                              <div className="table-list__meta-item">
                                <span className="table-list__meta-label">
                                  Ronda
                                </span>
                                <strong>{summary.round}</strong>
                              </div>
                              <div className="table-list__meta-item">
                                <span className="table-list__meta-label">
                                  Mazo
                                </span>
                                <strong>{summary.stockCount}</strong>
                              </div>
                              <div className="table-list__meta-item">
                                <span className="table-list__meta-label">
                                  Descarte
                                </span>
                                <strong>
                                  {summary.discardTop
                                    ? describeCard(summary.discardTop)
                                    : "Vacío"}
                                </strong>
                              </div>
                            </>
                          ) : (
                            <div className="table-list__meta-item">
                              <span className="table-list__meta-label">
                                Faltan
                              </span>
                              <strong>
                                {Math.max(0, 2 - table.playerCount)}
                              </strong>
                            </div>
                          )}
                        </div>
                        <div className="table-list__actions">
                          <button
                            type="button"
                            onClick={() => handleJoinTable(table.id)}
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
        </>
      )}

      {activeTable && (
        <section className="panel" aria-label="Panel de partida">
          <div className="panel__header panel__header--game panel__header--compact">
            <div className="panel__header-actions">
              <button
                type="button"
                className="button--ghost"
                onClick={handleLeaveTable}
              >
                Volver al lobby
              </button>
            </div>
          </div>
          {state.error && <p className="panel__error">{state.error}</p>}
          {canStartGame && (
            <div className="game-actions">
              <button type="button" onClick={handleStartGame}>
                Iniciar partida
              </button>
              <p className="game-hint">
                Necesitas al menos 2 jugadores para comenzar.
              </p>
            </div>
          )}
          {game ? (
            <div className="game-panel">
              <div className="game-panel__primary">
                <div className="game-controls">
                  <button
                    type="button"
                    onClick={handleDrawStock}
                    disabled={!canDraw}
                  >
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
                    Bajar corrida
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

                <div
                  className="game-stage"
                  aria-label="Palco para formar combinaciones con tus fichas"
                >
                  <div className="game-stage__header">
                    <h3>Palco de fichas</h3>
                    <span className="game-stage__count">
                      {myHand.length} en mano
                    </span>
                  </div>
                  <div className="stage-wrapper">
                    {stagedRows.map((row, rowIndex) => (
                      <div
                        key={`stage-row-${rowIndex}`}
                        className={`stage-row stage-row--${rowIndex}`}
                      >
                        <div className="stage-row__label">
                          Fila {rowIndex + 1}
                        </div>
                        {row.length === 0 ? (
                          <div className="stage-row__empty">
                            Espacio disponible
                          </div>
                        ) : (
                          <div className="stage-row__cards">
                            {row.map((card) => (
                              <button
                                key={card.id}
                                type="button"
                                className={[
                                  "card-tile",
                                  selectedCardIds.includes(card.id)
                                    ? "card-tile--selected"
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                onClick={() => handleSelectCard(card.id)}
                                aria-label={describeCard(card)}
                              >
                                <span
                                  className={[
                                    "card-tile__number",
                                    getCardColorClass(card),
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                >
                                  {getCardDisplayValue(card)}
                                </span>
                                <span className="card-tile__value">
                                  {card.kind === "joker"
                                    ? `Comodín · ${card.value} pts`
                                    : `${card.value} pts`}
                                </span>
                                <span className="card-tile__pip" aria-hidden />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    <div
                      className="stage-discard"
                      aria-label="Pila de descarte"
                      aria-live="polite"
                    >
                      <div className="stage-discard__title">Descarte</div>
                      {discardTop ? (
                        <div className="stage-discard__card">
                          <span
                            className={[
                              "stage-discard__number",
                              getCardColorClass(discardTop),
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            aria-label={discardLabel ?? undefined}
                          >
                            {getCardDisplayValue(discardTop)}
                          </span>
                          <span className="stage-discard__value">
                            {discardTop.kind === "joker"
                              ? `Comodín · ${discardTop.value} pts`
                              : `${discardTop.value} pts`}
                          </span>
                          <span className="card-tile__pip" aria-hidden />
                        </div>
                      ) : (
                        <div className="stage-discard__empty">Vacío</div>
                      )}
                    </div>
                  </div>
                  {isMyTurn &&
                    game.currentTurn.step === "discard" &&
                    selectedCardCount === 0 && (
                      <p className="stage-hint">
                        Selecciona fichas para descartarlas o formar un juego.
                      </p>
                    )}
                  {isMyTurn &&
                    game.currentTurn.step === "discard" &&
                    selectedCardCount > 1 && (
                      <p className="stage-hint">
                        Para descartar elige solo una ficha.
                      </p>
                    )}
                  {!isMyTurn && (
                    <p className="stage-hint">
                      Turno de {currentPlayer ? currentPlayer.name : "otro jugador"}.
                    </p>
                  )}
                </div>
              </div>

              <div
                className={
                  isCompactLayout ? "game-tabs game-tabs--compact" : "game-tabs"
                }
              >
                {isCompactLayout ? (
                  <>
                    {!showCompactTabsInHeader && renderCompactTabNav()}
                    <div className="game-tabs__content">
                      {currentCompactContent}
                    </div>
                  </>
                ) : (
                  <div className="game-tabs__grid">
                    {gameInfoSection}
                    {tableMeldsSection}
                    {playerListSection}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="panel__empty">La partida aún no ha comenzado.</p>
              {playerListSection}
            </>
          )}
        </section>
      )}
    </div>
  );
};

export default App;
