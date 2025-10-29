import { randomUUID } from "crypto";
import {
  GameSummary,
  LobbySnapshot,
  Player,
  Table,
  TableSummary,
} from "./types";

const MAX_PLAYERS_PER_TABLE = 4;

const toSummary = (table: Table): TableSummary => ({
  id: table.id,
  status: table.status,
  hostId: table.hostId,
  playerCount: table.players.length,
  game: toGameSummary(table.game),
});

const toGameSummary = (game: Table["game"]): GameSummary | undefined => {
  if (!game) {
    return undefined;
  }

  const discardTop = game.discardPile.at(-1) ?? null;

  return {
    phase: game.phase,
    round: game.round,
    currentPlayerId: game.phase === "playing" ? game.turn.playerId : null,
    stockCount: game.stock.length,
    discardTop,
    winnerId: game.winnerId,
  };
};

export class LobbyStore {
  private readonly tables = new Map<string, Table>();

  createTable(hostId: string, hostName: string): Table {
    const table: Table = {
      id: randomUUID(),
      hostId,
      status: "waiting",
      createdAt: Date.now(),
      players: [
        {
          id: hostId,
          name: hostName,
          seat: 0,
          isHost: true,
          joinedAt: Date.now(),
        },
      ],
      game: undefined,
    };

    this.tables.set(table.id, table);
    return table;
  }

  joinTable(tableId: string, playerId: string, name: string): Table {
    const table = this.tables.get(tableId);
    if (!table) {
      throw new Error("Table not found");
    }

    if (table.players.some((player) => player.id === playerId)) {
      return table;
    }

    if (table.status !== "waiting") {
      throw new Error("Game already started");
    }

    if (table.players.length >= MAX_PLAYERS_PER_TABLE) {
      throw new Error("Table is full");
    }

    const seat = this.nextSeat(table);
    const player: Player = {
      id: playerId,
      name,
      seat,
      isHost: false,
      joinedAt: Date.now(),
    };

    table.players.push(player);
    return table;
  }

  leaveTable(tableId: string, playerId: string): Table | undefined {
    const table = this.tables.get(tableId);
    if (!table) {
      return undefined;
    }

    table.players = table.players.filter((player) => player.id !== playerId);

    if (table.players.length === 0) {
      this.tables.delete(tableId);
      return undefined;
    }

    if (!table.players.some((player) => player.isHost)) {
      const [nextHost, ...rest] = table.players;
      table.players = [{ ...nextHost, isHost: true }, ...rest];
      table.hostId = nextHost.id;
    }

    return table;

    return table;
  }

  getTable(tableId: string): Table | undefined {
    return this.tables.get(tableId);
  }

  removeTable(tableId: string): void {
    this.tables.delete(tableId);
  }

  snapshot(): LobbySnapshot {
    return {
      tables: Array.from(this.tables.values()).map(toSummary),
    };
  }

  private nextSeat(table: Table): number {
    const takenSeats = new Set(
      table.players
        .map((player) => player.seat)
        .filter((seat): seat is number => seat !== null)
    );
    for (let seat = 0; seat < MAX_PLAYERS_PER_TABLE; seat += 1) {
      if (!takenSeats.has(seat)) {
        return seat;
      }
    }

    return -1;
  }
}
