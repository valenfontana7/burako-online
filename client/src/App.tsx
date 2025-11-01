import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { ReactNode } from "react";
import "./App.css";
import { useLobby } from "./hooks/useLobby";
import Header from "./components/Header";
import PlayerPanel from "./components/PlayerPanel";
import LobbyList from "./components/LobbyList";
import GamePrimary from "./components/GamePrimary";
import PlayerList from "./components/PlayerList";
import GameInfo from "./components/GameInfo";
import TableMelds from "./components/TableMelds";
import DiscardModal from "./components/DiscardModal";
import type { Card, Meld, StandardCard, PublicGameState } from "./types/lobby";
import ActionOverlay from "./components/ActionOverlay";

const PLAYER_NAME_STORAGE_KEY = "burako:player-name";

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

// status/labels are handled inside smaller components

const describeCard = (card: Card): string =>
  card.kind === "joker"
    ? "Comodín"
    : `${card.number} ${CARD_COLOR_LABEL[card.color]}`;

const getCardDisplayValue = (card: Card): string =>
  card.kind === "joker" ? "" : String(card.number);

const getCardColorClass = (card: Card): string => {
  if (card.kind === "joker") {
    return "card-tile__number--joker";
  }
  return CARD_COLOR_CLASS[card.color];
};

const describeMeld = (meld: Meld): string => {
  const base = meld.type === "set" ? "Pierna" : "Escalera";
  return meld.isClean ? `${base} limpia` : `${base} sucia`;
};

const App = () => {
  // By default do not assign a random name. If the user has a previously
  // persisted name we prefill the input, otherwise leave it empty so the
  // user can choose their preferred name.
  const [rawName, setRawName] = useState(() => {
    if (typeof window === "undefined") return "";
    const stored = window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY);
    return stored ?? "";
  });

  // `playerName` is the trimmed value entered by the user. It can be empty,
  // in which case actions that require a name (create/join) will be disabled.
  const playerName = useMemo(() => rawName.trim(), [rawName]);

  useEffect(() => {
    const trimmed = rawName.trim();
    if (trimmed.length === 0) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, trimmed);
    }
  }, [rawName]);
  const { state, actions } = useLobby(playerName);
  const { requestDiscard } = actions;
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
  const [discardModalOpen, setDiscardModalOpen] = useState(false);
  const [discardPileFull, setDiscardPileFull] = useState<null | Card[]>(null);
  const [actionOverlayOpen, setActionOverlayOpen] = useState(false);
  const [actionOverlayMessage, setActionOverlayMessage] = useState<
    string | null
  >(null);
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const [activeCompactTab, setActiveCompactTab] = useState<
    "info" | "players" | "melds"
  >("info");
  const activeTable = state.activeTable;
  const [isViewingLobby, setIsViewingLobby] = useState(false);

  useEffect(() => {
    if (activeTable) {
      setSelectedTableId(activeTable.id);
      // If we re-acquired the active table from the server, assume the player
      // is back in the game view unless they explicitly chose to view the
      // lobby.
      setIsViewingLobby(false);
    }
  }, [activeTable]);

  const game = state.game;
  const myPlayer = game?.players.find((player) => player.isSelf) ?? null;
  const myHand = useMemo(() => myPlayer?.hand ?? [], [myPlayer]);
  const tableMelds = useMemo(() => game?.tableMelds ?? [], [game]);

  // Local ordering for the player's hand represented as fixed slots. Each
  // slot is either a card id or null so slot indices map directly to the
  // rendered grid, allowing drops into empty slots.
  const MAX_PER_ROW = 7;
  const TOTAL_SLOTS = MAX_PER_ROW * 2;

  const [handOrder, setHandOrder] = useState<(string | null)[]>(() =>
    Array.from({ length: TOTAL_SLOTS }, () => null)
  );

  useEffect(() => {
    const ids = myHand.map((c) => c.id);
    setHandOrder((prev) => {
      const slots = Array.from(prev);
      // Remove ids that no longer exist on server
      for (let i = 0; i < slots.length; i++) {
        const id = slots[i];
        if (id && !ids.includes(id)) slots[i] = null;
      }
      // Place new ids into the first available empty slots preserving server order
      for (const id of ids) {
        if (slots.includes(id)) continue;
        const emptyIdx = slots.indexOf(null);
        if (emptyIdx === -1) break;
        slots[emptyIdx] = id;
      }
      return slots;
    });
  }, [myHand]);

  const displayHand = useMemo(() => {
    const byId = new Map(myHand.map((c) => [c.id, c]));
    const ordered = handOrder
      .filter(Boolean)
      .map((id) => byId.get(id as string))
      .filter(Boolean) as Card[];
    const missing = myHand.filter((c) => !handOrder.includes(c.id));
    return [...ordered, ...missing];
  }, [handOrder, myHand]);

  const stagedRows = useMemo(() => {
    const byId = new Map(myHand.map((c) => [c.id, c]));
    const slots = Array.from({ length: handOrder.length }, (_, i) =>
      handOrder[i] ? (byId.get(handOrder[i] as string) as Card) : null
    );
    const rows: (Card | null)[][] = [];
    for (let r = 0; r < 2; r++) {
      rows.push(slots.slice(r * MAX_PER_ROW, (r + 1) * MAX_PER_ROW));
    }
    return rows;
  }, [handOrder, myHand]);

  // Drag & drop state and handlers. We treat slots as a flat array of
  // length MAX_PER_ROW*2; slot indices are passed as the dataTransfer payload.
  const handleDragStart = (e: React.DragEvent, slotIndex: number) => {
    e.dataTransfer.setData("text/plain", String(slotIndex));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, toSlotIndex: number) => {
    e.preventDefault();
    const fromSlot = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(fromSlot)) return;
    setHandOrder((prev) => {
      const slots = Array.from(prev).slice(0, TOTAL_SLOTS);
      const movedId = slots[fromSlot];
      if (!movedId) return prev;
      if (fromSlot === toSlotIndex) return prev;

      // If target slot is empty, move the card there.
      const target = slots[toSlotIndex];
      if (!target) {
        slots[fromSlot] = null;
        slots[toSlotIndex] = movedId;
        return slots;
      }

      // If target occupied, swap positions.
      slots[fromSlot] = target;
      slots[toSlotIndex] = movedId;
      return slots;
    });
  };
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
  const discardHistory = game?.discardHistory ?? [];
  const discardCount = game?.discardCount ?? 0;
  const discardLabel = discardTop ? describeCard(discardTop) : null;
  const currentPlayer = game
    ? activeTable?.players.find(
        (player) => player.id === game.currentTurn.playerId
      ) ?? null
    : null;
  const winner = game?.winnerId
    ? activeTable?.players.find((player) => player.id === game.winnerId) ?? null
    : null;

  const headerStageHint = (() => {
    if (!game) return "";
    if (isMyTurn) {
      return game.currentTurn.step === "draw"
        ? "Tu turno — roba"
        : "Tu turno — descarta";
    }
    return currentPlayer ? `Turno de ${currentPlayer.name}` : "Esperando turno";
  })();
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

  // Detect game updates to display a brief overlay for actions performed
  // by other players. We compare previous and current `game` state and
  // derive a short human message.
  const prevGameRef = useRef<PublicGameState | null>(null);
  useEffect(() => {
    const prev = prevGameRef.current;
    const next = game;
    prevGameRef.current = next;
    if (!prev || !next) return;

    // helper to lookup player name
    const playerNameById = (id: string | null) =>
      id
        ? activeTable?.players.find((p) => p.id === id)?.name ?? "Jugador"
        : "Jugador";

    // If turn changed, notify the player who just became current (the
    // opponent) so they immediately receive an overlay telling them it's
    // their turn. Do not show this to the actor who just played.
    if (prev.currentTurn.playerId !== next.currentTurn.playerId) {
      const becameId = next.currentTurn.playerId;
      if (myPlayer?.id === becameId) {
        // Personal message for the player who now must act
        const step = next.currentTurn.step ?? "draw";
        const stepText =
          step === "draw" ? "Es tu turno — roba" : "Es tu turno — descarta";
        setActionOverlayMessage(stepText);
        setActionOverlayOpen(true);
      }
      return;
    }

    // If discard count increased, someone discarded (likely the previous turn player)
    if ((next.discardCount ?? 0) > (prev.discardCount ?? 0)) {
      const lastDiscarder = prev.currentTurn.playerId ?? null;
      const name = playerNameById(lastDiscarder);
      const msg = `${name} descartó una ficha`;
      // don't show to the actor who performed the discard
      if (myPlayer?.id !== lastDiscarder) {
        setActionOverlayMessage(msg);
        setActionOverlayOpen(true);
      }
      return;
    }

    // If melds changed (someone played a meld) — try to identify owner and type
    const prevMeldIds = new Set(prev.tableMelds.map((m) => m.id));
    const newMelds = (next.tableMelds ?? []).filter(
      (m) => !prevMeldIds.has(m.id)
    );
    if (newMelds.length > 0) {
      const m = newMelds[0];
      const ownerName = playerNameById(m.ownerId);
      const kind = m.type === "set" ? "bajó una pierna" : "bajó una escalera";
      if (m.ownerId !== myPlayer?.id) {
        setActionOverlayMessage(`${ownerName} ${kind}`);
        setActionOverlayOpen(true);
      }
      return;
    }

    // If someone drew from the discard (engine moves whole pile to hand)
    if ((prev.discardCount ?? 0) > (next.discardCount ?? 0)) {
      const taken = (prev.discardCount ?? 0) - (next.discardCount ?? 0);
      // find player whose hand increased by approximately `taken`
      const actor = next.players.find((p) => {
        const prevP = prev.players.find((q) => q.id === p.id);
        if (!prevP) return false;
        return p.handCount - prevP.handCount === taken;
      });
      if (actor && actor.id !== myPlayer?.id) {
        setActionOverlayMessage(`${actor.name} se llevó el descarte`);
        setActionOverlayOpen(true);
        return;
      }
    }

    // If stock decreased and a player's hand increased by 1 -> drew from stock
    if ((next.stockCount ?? 0) < (prev.stockCount ?? 0)) {
      const actor = next.players.find((p) => {
        const prevP = prev.players.find((q) => q.id === p.id);
        if (!prevP) return false;
        return p.handCount - prevP.handCount === 1;
      });
      if (actor && actor.id !== myPlayer?.id) {
        setActionOverlayMessage(`${actor.name} robó del mazo`);
        setActionOverlayOpen(true);
        return;
      }
    }

    // If winner appeared
    if (!prev.winnerId && next.winnerId) {
      const name = playerNameById(next.winnerId ?? null);
      const msg = `${name} ha ganado la partida`;
      setActionOverlayMessage(msg);
      setActionOverlayOpen(true);
      return;
    }
  }, [game, activeTable, myPlayer]);

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

  // Permanently leave the table (resign/abandon). This calls the server
  // leave flow and clears any client-side selection. The user will not be
  // automatically rejoined after this action.
  const handleResignTable = useCallback(async () => {
    const tableId = activeTable?.id ?? selectedTableId;
    if (!tableId) return;

    const confirmed = window.confirm(
      "¿Estás seguro que quieres rendirte y abandonar la partida? Esta acción te sacará de la mesa y no te reconectará automáticamente."
    );
    if (!confirmed) return;

    const success = await leaveTable(tableId);
    if (success) {
      setSelectedTableId(null);
      setSelectedCardIds([]);
      setSelectedMeldId(null);
    }
  }, [activeTable?.id, leaveTable, selectedTableId]);

  // Temporarily go back to the lobby UI while remaining part of the table on
  // the server so the player can re-enter the game later.
  const handleReturnToLobby = useCallback(() => {
    setIsViewingLobby(true);
    setSelectedTableId(null);
  }, []);

  const handleReturnToGame = useCallback(() => {
    setIsViewingLobby(false);
    if (activeTable) setSelectedTableId(activeTable.id);
  }, [activeTable]);

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

  // player list rendering moved to `PlayerList` component

  const playerListSection = activeTable ? (
    <PlayerList activeTable={activeTable} game={game} />
  ) : null;

  const gameInfoSection = activeTable ? (
    <GameInfo
      activeTable={activeTable}
      game={game}
      tableMelds={tableMelds}
      discardHistory={discardHistory}
      discardCount={discardCount}
      discardLabel={discardLabel}
      isMyTurn={isMyTurn}
      currentPlayerName={currentPlayer ? currentPlayer.name : null}
      winnerName={winner ? winner.name : null}
    />
  ) : null;

  const tableMeldsSection = game ? (
    <TableMelds
      tableMelds={tableMelds}
      players={game.players}
      selectedMeldId={selectedMeldId}
      handleSelectMeld={handleSelectMeld}
      describeMeld={describeMeld}
      getCardColorClass={getCardColorClass}
      getCardDisplayValue={getCardDisplayValue}
      describeCard={describeCard}
    />
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
      <Header
        shouldRenderHeader={shouldRenderHeader}
        activeTable={activeTable}
        showCompactTabsInHeader={showCompactTabsInHeader}
        appHeaderClassName={appHeaderClassName}
        renderCompactTabNav={renderCompactTabNav}
      />

      {(!activeTable || isViewingLobby) && (
        <>
          {activeTable && isViewingLobby ? (
            <div className="panel__notice">
              <p>
                Estás en la mesa <strong>{activeTable.id}</strong>. Puedes
                volver a la partida o rendirte.
              </p>
              <div className="panel__notice-actions">
                <button type="button" onClick={handleReturnToGame}>
                  Volver a la partida
                </button>
                <button
                  type="button"
                  className="button--danger"
                  onClick={handleResignTable}
                >
                  Rendirse
                </button>
              </div>
            </div>
          ) : (
            <PlayerPanel
              rawName={rawName}
              setRawName={setRawName}
              handleCreateTable={handleCreateTable}
              handleLeaveTable={handleResignTable}
              state={state}
              playerName={playerName}
              selectedTableId={selectedTableId}
            />
          )}

          <LobbyList
            tables={state.tables}
            selectedTableId={selectedTableId}
            handleJoinTable={handleJoinTable}
            playerName={playerName}
          />
        </>
      )}

      {activeTable && !isViewingLobby && (
        <section className="panel" aria-label="Panel de partida">
          <div className="panel__header panel__header--game panel__header--compact">
            <div className="panel__header-actions">
              {headerStageHint ? (
                <div className="panel__stage-hint" aria-hidden>
                  {headerStageHint}
                </div>
              ) : null}
              <div className="panel__header-actions--right">
                <button
                  type="button"
                  className="button--ghost"
                  onClick={handleReturnToLobby}
                >
                  Volver al lobby
                </button>
                <button
                  type="button"
                  className="button--danger"
                  onClick={handleResignTable}
                >
                  Rendirse
                </button>
              </div>
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
                <GamePrimary
                  canDraw={canDraw}
                  discardTop={discardTop}
                  discardHistory={discardHistory}
                  discardCount={discardCount}
                  onOpenDiscard={async () => {
                    const tableId = activeTable?.id;
                    if (!tableId) return;
                    const pile = await requestDiscard(tableId);
                    if (pile && Array.isArray(pile)) {
                      // assume pile items match Card shape
                      setDiscardPileFull(pile as Card[]);
                    } else {
                      setDiscardPileFull(null);
                    }
                    setDiscardModalOpen(true);
                  }}
                  canPlayMeld={canPlayMeld}
                  canExtendMeld={canExtendMeld}
                  canDiscard={canDiscard}
                  selectedCardCount={selectedCardCount}
                  selectedMeldId={selectedMeldId}
                  handleDrawStock={handleDrawStock}
                  handleDrawDiscard={handleDrawDiscard}
                  handlePlayMeld={handlePlayMeld}
                  handleExtendMeld={handleExtendMeld}
                  handleDiscardSelected={handleDiscardSelected}
                  handleClearSelection={handleClearSelection}
                  stagedRows={stagedRows}
                  displayHand={displayHand}
                  handleDragStart={handleDragStart}
                  handleDragOver={handleDragOver}
                  handleDrop={handleDrop}
                  selectedCardIds={selectedCardIds}
                  handleSelectCard={handleSelectCard}
                  myHandCount={myHand.length}
                  getCardColorClass={getCardColorClass}
                  getCardDisplayValue={getCardDisplayValue}
                  describeCard={describeCard}
                  isMyTurn={isMyTurn}
                  currentTurnStep={game?.currentTurn.step}
                  currentPlayerName={currentPlayer ? currentPlayer.name : null}
                />
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
                    {tableMeldsSection}
                    {gameInfoSection}
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
      <ActionOverlay
        open={actionOverlayOpen}
        message={actionOverlayMessage}
        onClose={() => {
          setActionOverlayOpen(false);
          setActionOverlayMessage(null);
        }}
      />

      <DiscardModal
        open={discardModalOpen}
        onClose={() => setDiscardModalOpen(false)}
        discardPile={discardPileFull}
      />
    </div>
  );
};

export default App;
