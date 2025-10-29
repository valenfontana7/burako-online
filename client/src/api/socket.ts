import { io, type Socket } from "socket.io-client";
import { apiConfig } from "../config";
import type {
  LobbyEvent,
  LobbySnapshot,
  PublicGameState,
  Table,
} from "../types/lobby";

export type AckResponse =
  | { ok: true; tableId?: string }
  | { ok: false; error: string };

export type ClientToServerEvents = {
  "lobby:create-table": (
    payload: { playerName: string },
    ack: (response: AckResponse) => void
  ) => void;
  "lobby:join-table": (
    payload: { tableId: string; playerName: string },
    ack: (response: AckResponse) => void
  ) => void;
  "lobby:leave-table": (
    payload: { tableId: string },
    ack: (response: AckResponse) => void
  ) => void;
  "lobby:subscribe": (ack: (response: AckResponse) => void) => void;
  "lobby:unsubscribe": (ack: (response: AckResponse) => void) => void;
  "table:start-game": (
    payload: { tableId: string },
    ack: (response: AckResponse) => void
  ) => void;
  "table:draw-stock": (
    payload: { tableId: string },
    ack: (response: AckResponse) => void
  ) => void;
  "table:draw-discard": (
    payload: { tableId: string },
    ack: (response: AckResponse) => void
  ) => void;
  "table:discard": (
    payload: { tableId: string; cardId: string },
    ack: (response: AckResponse) => void
  ) => void;
  "table:play-meld": (
    payload: { tableId: string; cardIds: string[]; type: "set" | "sequence" },
    ack: (response: AckResponse) => void
  ) => void;
  "table:extend-meld": (
    payload: { tableId: string; meldId: string; cardIds: string[] },
    ack: (response: AckResponse) => void
  ) => void;
  "table:request-state": (
    payload: { tableId: string },
    ack: (response: AckResponse) => void
  ) => void;
};

export type ServerToClientEvents = {
  "lobby:snapshot": (snapshot: LobbySnapshot) => void;
  "lobby:event": (event: LobbyEvent) => void;
  "table:update": (table: Table) => void;
  "game:state": (state: PublicGameState) => void;
  error: (message: string) => void;
};

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;

export const getSocket = (): Socket<
  ServerToClientEvents,
  ClientToServerEvents
> => {
  if (!socket) {
    socket = io(apiConfig.serverUrl, {
      autoConnect: false,
    });
  }

  return socket;
};

export const ensureConnected = async (): Promise<
  Socket<ServerToClientEvents, ClientToServerEvents>
> => {
  const activeSocket = getSocket();

  if (activeSocket.connected) {
    return activeSocket;
  }

  await new Promise<void>((resolve, reject) => {
    activeSocket.once("connect", () => resolve());
    activeSocket.once("connect_error", reject);
    activeSocket.connect();
  });

  return activeSocket;
};

export const disconnectSocket = (): void => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
};
