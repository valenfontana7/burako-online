import { useCallback, useEffect, useMemo, useState } from "react";
import { ensureConnected, getSocket, type AckResponse } from "../api/socket";
import type {
  LobbyEvent,
  LobbySnapshot,
  PublicGameState,
  Table,
} from "../types/lobby";

export type LobbyState = {
  tables: LobbySnapshot["tables"];
  activeTable: Table | null;
  activeTableId: string | null;
  isConnecting: boolean;
  error: string | null;
  game: PublicGameState | null;
  selfId: string | null;
};

const initialState: LobbyState = {
  tables: [],
  activeTable: null,
  activeTableId: null,
  isConnecting: true,
  error: null,
  game: null,
  selfId: null,
};

export const useLobby = (playerName: string) => {
  const [state, setState] = useState<LobbyState>(initialState);

  useEffect(() => {
    let isMounted = true;

    const connect = async () => {
      setState((prev) => ({ ...prev, isConnecting: true, error: null }));

      try {
        const socket = await ensureConnected();

        let isSubscribed = false;

        const subscribeToLobby = () => {
          if (isSubscribed) return;
          setState((prev) => ({ ...prev, isConnecting: true }));
          socket.emit("lobby:subscribe", (ack) => {
            if (!isMounted) {
              return;
            }

            if (ack.ok) {
              isSubscribed = true;
              setState((prev) => ({ ...prev, isConnecting: false }));

              // After subscribing, attempt to recover an active table id from
              // localStorage. If the user had an active table before reload,
              // request its state so the client rejoins the view.
              try {
                const stored =
                  typeof window !== "undefined"
                    ? window.localStorage.getItem("burako:active-table")
                    : null;
                if (stored) {
                  // Attempt to rejoin the table using the stored table id and the
                  // current playerName. The server supports a reconnect flow
                  // where a previously disconnected player (same name) is
                  // rebound to the new socket id and immediately sent the
                  // current game state.
                  socket.emit(
                    "lobby:join-table",
                    { tableId: stored, playerName },
                    (ack: AckResponse) => {
                      if (ack?.ok) {
                        setState((prev) => ({
                          ...prev,
                          activeTableId: stored,
                        }));
                        // Server typically emits `game:state` on successful
                        // reconnect; request state explicitly as a fallback.
                        socket.emit(
                          "table:request-state",
                          { tableId: stored },
                          () => undefined
                        );
                      } else {
                        // If join fails (e.g. name conflict), clear the stored
                        // active table so we don't repeatedly try on reload.
                        try {
                          if (typeof window !== "undefined") {
                            window.localStorage.removeItem(
                              "burako:active-table"
                            );
                          }
                        } catch {
                          /* ignore */
                        }
                      }
                    }
                  );
                }
              } catch {
                // ignore storage errors
              }
            } else {
              setState((prev) => ({
                ...prev,
                isConnecting: false,
                error: ack.error,
              }));
            }
          });
        };

        const handleSnapshot = (snapshot: LobbySnapshot) => {
          if (!isMounted) {
            return;
          }
          console.log("Received lobby snapshot:", snapshot);
          setState((prev) => ({ ...prev, tables: snapshot.tables }));
        };

        const handleLobbyEvent = (event: LobbyEvent) => {
          if (!isMounted) {
            return;
          }

          console.log("Received lobby event:", event);

          setState((prev) => ({
            ...prev,
            tables: applyLobbyEvent(prev.tables, event),
          }));
        };

        const handleTableUpdate = (table: Table) => {
          if (!isMounted) {
            return;
          }

          console.log("Received table:update:", table.id, table);

          let shouldRequestState = false;

          setState((prev) => {
            const isMember = table.players.some(
              (player) => player.id === prev.selfId
            );
            const isActive =
              isMember ||
              prev.activeTableId === table.id ||
              prev.activeTable?.id === table.id;

            if (table.game && isActive) {
              shouldRequestState = true;
            }

            const summaryFromUpdate = {
              id: table.id,
              status: table.status,
              hostId: table.hostId,
              playerCount: table.players.length,
              game: table.game,
            };

            let summaryExists = false;

            const updatedTables = prev.tables.map((summary) => {
              if (summary.id === table.id) {
                summaryExists = true;
                return summaryFromUpdate;
              }
              return summary;
            });

            const nextTables = summaryExists
              ? updatedTables
              : [...updatedTables, summaryFromUpdate];

            return {
              ...prev,
              activeTable: isActive ? table : prev.activeTable,
              activeTableId: isActive ? table.id : prev.activeTableId,
              tables: nextTables,
            };
          });

          if (shouldRequestState) {
            socket.emit(
              "table:request-state",
              { tableId: table.id },
              () => undefined
            );
          }
        };

        const handleGameState = (game: PublicGameState) => {
          if (!isMounted) {
            return;
          }

          setState((prev) => ({ ...prev, game }));
        };

        const handleError = (message: string) => {
          if (!isMounted) {
            return;
          }
          setState((prev) => ({ ...prev, error: message }));
        };

        const handleConnect = () => {
          if (!isMounted) {
            return;
          }
          setState((prev) => ({ ...prev, selfId: socket.id ?? null }));
          subscribeToLobby();
        };

        const handleDisconnect = () => {
          if (!isMounted) {
            return;
          }
          // Reset subscription flag on disconnect so we can re-subscribe after reconnect
          isSubscribed = false;
          setState((prev) => ({ ...prev, selfId: null, isConnecting: true }));
        };

        socket.on("lobby:snapshot", handleSnapshot);
        socket.on("lobby:event", handleLobbyEvent);
        socket.on("table:update", handleTableUpdate);
        socket.on("game:state", handleGameState);
        socket.on("error", handleError);
        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);

        setState((prev) => ({ ...prev, selfId: socket.id ?? null }));
        // Only subscribe immediately if socket is already connected. Otherwise wait for connect event.
        if (socket.connected) {
          subscribeToLobby();
        }

        return () => {
          socket.off("lobby:snapshot", handleSnapshot);
          socket.off("lobby:event", handleLobbyEvent);
          socket.off("table:update", handleTableUpdate);
          socket.off("game:state", handleGameState);
          socket.off("error", handleError);
          socket.off("connect", handleConnect);
          socket.off("disconnect", handleDisconnect);
          if (isSubscribed) {
            socket.emit("lobby:unsubscribe", () => undefined);
          }
        };
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Cannot connect to server";
        setState((prev) => ({ ...prev, isConnecting: false, error: message }));
      }
    };

    const cleanupPromise = connect();

    return () => {
      isMounted = false;

      cleanupPromise.then((cleanup) => {
        cleanup?.();
      });
    };
  }, [playerName]);

  const createTable = useCallback(async () => {
    const socket = getSocket();

    const response = await new Promise<AckResponse>((resolve) => {
      socket.emit("lobby:create-table", { playerName }, (ack) => resolve(ack));
    });

    if (!response.ok) {
      setState((prev) => ({ ...prev, error: response.error }));
      return null;
    }

    const tableId = response.tableId ?? null;
    if (tableId) {
      setState((prev) => ({ ...prev, activeTableId: tableId }));
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("burako:active-table", tableId);
        }
      } catch {
        /* ignore */
      }
    }

    return tableId;
  }, [playerName]);

  const joinTable = useCallback(
    async (tableId: string) => {
      const socket = getSocket();

      const response = await new Promise<AckResponse>((resolve) => {
        socket.emit("lobby:join-table", { tableId, playerName }, (ack) =>
          resolve(ack)
        );
      });

      if (!response.ok) {
        setState((prev) => ({ ...prev, error: response.error }));
        return false;
      }
      setState((prev) => ({ ...prev, activeTableId: tableId }));
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("burako:active-table", tableId);
        }
      } catch {
        /* ignore */
      }
      socket.emit("table:request-state", { tableId }, () => undefined);
      return true;
    },
    [playerName]
  );

  const leaveTable = useCallback(async (tableId: string) => {
    const socket = getSocket();

    const response = await new Promise<AckResponse>((resolve) => {
      socket.emit("lobby:leave-table", { tableId }, (ack) => resolve(ack));
    });

    if (!response.ok) {
      setState((prev) => ({ ...prev, error: response.error }));
      return false;
    }
    try {
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem("burako:active-table");
        if (stored === tableId) {
          window.localStorage.removeItem("burako:active-table");
        }
      }
    } catch {
      /* ignore */
    }

    setState((prev) => ({
      ...prev,
      activeTable: prev.activeTable?.id === tableId ? null : prev.activeTable,
      activeTableId: prev.activeTableId === tableId ? null : prev.activeTableId,
      game: prev.game?.tableId === tableId ? null : prev.game,
    }));
    return true;
  }, []);

  const startGame = useCallback(async (tableId: string) => {
    const socket = getSocket();
    const response = await new Promise<AckResponse>((resolve) => {
      socket.emit("table:start-game", { tableId }, (ack) => resolve(ack));
    });
    if (!response.ok) {
      setState((prev) => ({ ...prev, error: response.error }));
    }
    return response.ok;
  }, []);

  const drawFromStock = useCallback(async (tableId: string) => {
    const socket = getSocket();
    const response = await new Promise<AckResponse>((resolve) => {
      socket.emit("table:draw-stock", { tableId }, (ack) => resolve(ack));
    });
    if (!response.ok) {
      setState((prev) => ({ ...prev, error: response.error }));
    }
    return response.ok;
  }, []);

  const drawFromDiscard = useCallback(async (tableId: string) => {
    const socket = getSocket();
    const response = await new Promise<AckResponse>((resolve) => {
      socket.emit("table:draw-discard", { tableId }, (ack) => resolve(ack));
    });
    if (!response.ok) {
      setState((prev) => ({ ...prev, error: response.error }));
    }
    return response.ok;
  }, []);

  const discardCard = useCallback(async (tableId: string, cardId: string) => {
    const socket = getSocket();
    const response = await new Promise<AckResponse>((resolve) => {
      socket.emit("table:discard", { tableId, cardId }, (ack) => resolve(ack));
    });
    if (!response.ok) {
      setState((prev) => ({ ...prev, error: response.error }));
    }
    return response.ok;
  }, []);

  const requestDiscard = useCallback(async (tableId: string) => {
    const socket = getSocket();
    const response = await new Promise<AckResponse>((resolve) => {
      socket.emit("table:request-discard", { tableId }, (ack) => resolve(ack));
    });

    if (!response.ok) {
      setState((prev) => ({ ...prev, error: response.error }));
      return null;
    }

    // response.discardPile may be unknown[]; return as-is for now
    // consumer will validate/convert
    return (
      (response as { ok: true; discardPile?: unknown[] }).discardPile ?? null
    );
  }, []);

  const playMeld = useCallback(
    async (tableId: string, cardIds: string[], type: "set" | "sequence") => {
      const socket = getSocket();
      const response = await new Promise<AckResponse>((resolve) => {
        socket.emit("table:play-meld", { tableId, cardIds, type }, (ack) =>
          resolve(ack)
        );
      });
      if (!response.ok) {
        setState((prev) => ({ ...prev, error: response.error }));
      }
      return response.ok;
    },
    []
  );

  const extendMeld = useCallback(
    async (tableId: string, meldId: string, cardIds: string[]) => {
      const socket = getSocket();
      const response = await new Promise<AckResponse>((resolve) => {
        socket.emit("table:extend-meld", { tableId, meldId, cardIds }, (ack) =>
          resolve(ack)
        );
      });
      if (!response.ok) {
        setState((prev) => ({ ...prev, error: response.error }));
      }
      return response.ok;
    },
    []
  );

  const derivedState = useMemo(
    () => ({
      ...state,
      tableById: (tableId: string) =>
        state.tables.find((table) => table.id === tableId) ?? null,
    }),
    [state]
  );

  return {
    state: derivedState,
    actions: {
      createTable,
      joinTable,
      leaveTable,
      startGame,
      drawFromStock,
      drawFromDiscard,
      discardCard,
      requestDiscard,
      playMeld,
      extendMeld,
    },
  } as const;
};

const applyLobbyEvent = (
  tables: LobbySnapshot["tables"],
  event: LobbyEvent
): LobbySnapshot["tables"] => {
  switch (event.type) {
    case "table-created":
      return [...tables, event.table];
    case "table-updated":
      return tables.map((table) =>
        table.id === event.table.id ? event.table : table
      );
    case "table-removed":
      return tables.filter((table) => table.id !== event.tableId);
    default:
      return tables;
  }
};
