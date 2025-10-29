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

        socket.emit("lobby:subscribe", (ack) => {
          if (!isMounted) {
            return;
          }

          if (ack.ok) {
            setState((prev) => ({ ...prev, isConnecting: false }));
          } else {
            setState((prev) => ({
              ...prev,
              isConnecting: false,
              error: ack.error,
            }));
          }
        });

        const handleSnapshot = (snapshot: LobbySnapshot) => {
          if (!isMounted) {
            return;
          }
          setState((prev) => ({ ...prev, tables: snapshot.tables }));
        };

        const handleLobbyEvent = (event: LobbyEvent) => {
          if (!isMounted) {
            return;
          }

          setState((prev) => ({
            ...prev,
            tables: applyLobbyEvent(prev.tables, event),
          }));
        };

        const handleTableUpdate = (table: Table) => {
          if (!isMounted) {
            return;
          }

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
        };

        const handleDisconnect = () => {
          if (!isMounted) {
            return;
          }
          setState((prev) => ({ ...prev, selfId: null }));
        };

        socket.on("lobby:snapshot", handleSnapshot);
        socket.on("lobby:event", handleLobbyEvent);
        socket.on("table:update", handleTableUpdate);
        socket.on("game:state", handleGameState);
        socket.on("error", handleError);
        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);

        setState((prev) => ({ ...prev, selfId: socket.id ?? null }));

        return () => {
          socket.off("lobby:snapshot", handleSnapshot);
          socket.off("lobby:event", handleLobbyEvent);
          socket.off("table:update", handleTableUpdate);
          socket.off("game:state", handleGameState);
          socket.off("error", handleError);
          socket.off("connect", handleConnect);
          socket.off("disconnect", handleDisconnect);
          socket.emit("lobby:unsubscribe", () => undefined);
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
  }, []);

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
