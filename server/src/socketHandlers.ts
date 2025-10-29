import type { Server, Socket } from "socket.io";
import { GameEngine } from "./game/engine";
import { LobbyStore } from "./game/lobby";
import type { LobbyEvents, Table } from "./game/types";
import {
  type AckResponse,
  ClientToServerEvents,
  ServerToClientEvents,
  createTableSchema,
  extendMeldSchema,
  discardSchema,
  drawSchema,
  joinTableSchema,
  leaveTableSchema,
  playMeldSchema,
  startGameSchema,
  type TableUpdatePayload,
} from "./events";

const lobby = new LobbyStore();
const engine = new GameEngine();

type InterServerEvents = Record<string, never>;
type SocketData = {
  joinedTables: Set<string>;
  playerName?: string;
};

export const registerSocketHandlers = (
  io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >
): void => {
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);
    socket.data.joinedTables = new Set();

    socket.on("disconnect", (reason) => {
      console.log(`Client disconnected: ${socket.id} (${reason})`);
      socket.data.joinedTables.forEach((tableId) => {
        const table = lobby.getTable(tableId);
        if (!table) {
          return;
        }

        const player = table.players.find((entry) => entry.id === socket.id);
        if (!player) {
          return;
        }

        player.isConnected = false;
        emitTableUpdate(io, table);
      });
      socket.data.joinedTables.clear();
    });

    socket.on("lobby:subscribe", (ack) => {
      console.log(`Client ${socket.id} subscribing to lobby`);
      socket.join("lobby");
      socket.emit("lobby:snapshot", lobby.snapshot());
      try {
        const room = io.sockets.adapter.rooms.get("lobby");
        const count = room ? room.size : 0;
        console.log(`Lobby subscribers: ${count}`);
      } catch (e) {
        /* ignore */
      }
      ack({ ok: true });
    });

    socket.on("lobby:unsubscribe", (ack) => {
      console.log(`Client ${socket.id} unsubscribing from lobby`);
      socket.leave("lobby");
      ack({ ok: true });
    });

    socket.on("lobby:create-table", (payload, ack) => {
      const parsed = createTableSchema.safeParse(payload);
      if (!parsed.success) {
        ack({ ok: false, error: "Invalid payload" });
        return;
      }

      try {
        const table = lobby.createTable(socket.id, parsed.data.playerName);
        socket.join(`table:${table.id}`);
        socket.data.joinedTables.add(table.id);
        socket.data.playerName = parsed.data.playerName;
        socket.emit("table:update", serializeTable(table));
        broadcastLobbyEvent(io, {
          type: "table-created",
          table: toSummary(table),
        });
        console.log(`Table created: ${table.id} by ${socket.id}`);
        ack({ ok: true, tableId: table.id });
      } catch (error) {
        ack({ ok: false, error: parseError(error) });
      }
    });

    socket.on("lobby:join-table", (payload, ack) => {
      const parsed = joinTableSchema.safeParse(payload);
      if (!parsed.success) {
        ack({ ok: false, error: "Invalid payload" });
        return;
      }

      const existingTable = lobby.getTable(parsed.data.tableId);
      if (!existingTable) {
        ack({ ok: false, error: "Table not found" });
        return;
      }

      socket.data.playerName = parsed.data.playerName;

      const reconnectTarget = existingTable.players.find(
        (player) =>
          player.name === parsed.data.playerName && !player.isConnected
      );

      if (reconnectTarget && reconnectTarget.id !== socket.id) {
        const previousId = reconnectTarget.id;
        reconnectTarget.id = socket.id;
        reconnectTarget.isConnected = true;
        reconnectTarget.joinedAt = Date.now();

        if (existingTable.hostId === previousId) {
          existingTable.hostId = socket.id;
        }

        engine.rebindPlayer(existingTable, previousId, socket.id);

        socket.join(`table:${existingTable.id}`);
        socket.data.joinedTables.add(existingTable.id);
        emitTableUpdate(io, existingTable);
        emitGameState(io, existingTable, socket.id);
        ack({ ok: true, tableId: existingTable.id });
        return;
      }

      try {
        const table = lobby.joinTable(
          parsed.data.tableId,
          socket.id,
          parsed.data.playerName
        );
        socket.join(`table:${table.id}`);
        socket.data.joinedTables.add(table.id);
        emitTableUpdate(io, table);
        ack({ ok: true, tableId: table.id });
      } catch (error) {
        ack({ ok: false, error: parseError(error) });
      }
    });

    socket.on("lobby:leave-table", (payload, ack) => {
      const parsed = leaveTableSchema.safeParse(payload);
      if (!parsed.success) {
        ack({ ok: false, error: "Invalid payload" });
        return;
      }

      const result = handleLeaveTable(io, socket, parsed.data);
      ack(result);
    });

    socket.on("table:start-game", (payload, ack) => {
      const parsed = startGameSchema.safeParse(payload);
      if (!parsed.success) {
        ack({ ok: false, error: "Invalid payload" });
        return;
      }

      try {
        const table = lobby.getTable(parsed.data.tableId);
        if (!table) {
          ack({ ok: false, error: "Table not found" });
          return;
        }

        if (table.hostId !== socket.id) {
          ack({ ok: false, error: "Only the host can start the game" });
          return;
        }

        engine.startGame(table);
        emitTableUpdate(io, table);
        emitGameState(io, table);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, error: parseError(error) });
      }
    });

    socket.on("table:draw-stock", (payload, ack) => {
      const parsed = drawSchema.safeParse(payload);
      if (!parsed.success) {
        ack({ ok: false, error: "Invalid payload" });
        return;
      }

      try {
        const table = ensureTableForPlayer(parsed.data.tableId, socket.id);
        engine.drawFromStock(table, socket.id);
        emitGameState(io, table);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, error: parseError(error) });
      }
    });

    socket.on("table:draw-discard", (payload, ack) => {
      const parsed = drawSchema.safeParse(payload);
      if (!parsed.success) {
        ack({ ok: false, error: "Invalid payload" });
        return;
      }

      try {
        const table = ensureTableForPlayer(parsed.data.tableId, socket.id);
        engine.drawFromDiscard(table, socket.id);
        emitGameState(io, table);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, error: parseError(error) });
      }
    });

    socket.on("table:discard", (payload, ack) => {
      const parsed = discardSchema.safeParse(payload);
      if (!parsed.success) {
        ack({ ok: false, error: "Invalid payload" });
        return;
      }

      try {
        const table = ensureTableForPlayer(parsed.data.tableId, socket.id);
        engine.discardCard(table, socket.id, parsed.data.cardId);
        emitTableUpdate(io, table);
        emitGameState(io, table);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, error: parseError(error) });
      }
    });

    socket.on("table:play-meld", (payload, ack) => {
      const parsed = playMeldSchema.safeParse(payload);
      if (!parsed.success) {
        ack({ ok: false, error: "Invalid payload" });
        return;
      }

      try {
        const table = ensureTableForPlayer(parsed.data.tableId, socket.id);
        engine.playMeld(
          table,
          socket.id,
          parsed.data.cardIds,
          parsed.data.type
        );
        emitTableUpdate(io, table);
        emitGameState(io, table);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, error: parseError(error) });
      }
    });

    socket.on("table:extend-meld", (payload, ack) => {
      const parsed = extendMeldSchema.safeParse(payload);
      if (!parsed.success) {
        ack({ ok: false, error: "Invalid payload" });
        return;
      }

      try {
        const table = ensureTableForPlayer(parsed.data.tableId, socket.id);
        engine.extendMeld(
          table,
          socket.id,
          parsed.data.meldId,
          parsed.data.cardIds
        );
        emitTableUpdate(io, table);
        emitGameState(io, table);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, error: parseError(error) });
      }
    });

    socket.on("table:request-state", (payload, ack) => {
      const parsed = drawSchema.safeParse(payload);
      if (!parsed.success) {
        ack({ ok: false, error: "Invalid payload" });
        return;
      }

      try {
        const table = ensureTableForPlayer(parsed.data.tableId, socket.id);
        emitGameState(io, table, socket.id);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, error: parseError(error) });
      }
    });
  });
};

const handleLeaveTable = (
  io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  socket: Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  payload: { tableId: string }
): AckResponse => {
  try {
    const table = lobby.leaveTable(payload.tableId, socket.id);
    socket.leave(`table:${payload.tableId}`);
    socket.data.joinedTables.delete(payload.tableId);

    if (!table) {
      broadcastLobbyEvent(io, {
        type: "table-removed",
        tableId: payload.tableId,
      });
      return { ok: true };
    }

    engine.handlePlayerLeave(table, socket.id);
    emitTableUpdate(io, table);
    emitGameState(io, table);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: parseError(error) };
  }
};

const broadcastLobbyEvent = (
  io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  event: LobbyEvents
): void => {
  try {
    const room = io.sockets.adapter.rooms.get("lobby");
    const count = room ? room.size : 0;
    console.log(
      `Broadcasting lobby:event -> ${event.type} (subscribers=${count})`
    );
  } catch (e) {
    console.log(`Broadcasting lobby:event -> ${event.type}`);
  }
  // Emit to the lobby room. If there are no subscribers (e.g. HMR remounts in dev),
  // also fallback to broadcasting to all connected sockets so clients that
  // temporarily missed the subscribe still get the update.
  io.to("lobby").emit("lobby:event", event);
  try {
    const room = io.sockets.adapter.rooms.get("lobby");
    const count = room ? room.size : 0;
    if (count === 0) {
      console.log("No subscribers in 'lobby' room — falling back to io.emit");
      io.emit("lobby:event", event);
    }
  } catch (e) {
    // ignore
  }
};

const emitTableUpdate = (
  io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  table: Table
): void => {
  const payload = serializeTable(table);
  io.to(`table:${table.id}`).emit("table:update", payload);
  broadcastLobbyEvent(io, {
    type: "table-updated",
    table: toSummary(table),
  });
};

const emitGameState = (
  io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  table: Table,
  targetSocketId?: string
): void => {
  if (!table.game) {
    return;
  }

  if (targetSocketId) {
    const state = engine.getPublicState(table, targetSocketId);
    io.to(targetSocketId).emit("game:state", state);
    return;
  }

  table.players.forEach((player) => {
    const state = engine.getPublicState(table, player.id);
    io.to(player.id).emit("game:state", state);
  });
};

const toSummary = (table: Table) => ({
  id: table.id,
  status: table.status,
  hostId: table.hostId,
  playerCount: table.players.length,
  game: engine.summarize(table),
});

const serializeTable = (table: Table): TableUpdatePayload => ({
  id: table.id,
  hostId: table.hostId,
  status: table.status,
  createdAt: table.createdAt,
  players: table.players,
  game: engine.summarize(table),
});

const ensureTableForPlayer = (tableId: string, playerId: string): Table => {
  const table = lobby.getTable(tableId);
  if (!table) {
    throw new Error("Table not found");
  }

  if (!table.players.some((player) => player.id === playerId)) {
    throw new Error("Player not part of this table");
  }

  return table;
};

const parseError = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";
