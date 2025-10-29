import { z } from "zod";
import {
  GameSummary,
  LobbyEvents,
  LobbySnapshot,
  Player,
  PublicGameState,
  TableStatus,
} from "./game/types";

export const createTableSchema = z.object({
  playerName: z.string().min(1).max(32),
});

export type CreateTablePayload = z.infer<typeof createTableSchema>;

export const joinTableSchema = z.object({
  tableId: z.string().uuid(),
  playerName: z.string().min(1).max(32),
});

export type JoinTablePayload = z.infer<typeof joinTableSchema>;

export const leaveTableSchema = z.object({
  tableId: z.string().uuid(),
});

export type LeaveTablePayload = z.infer<typeof leaveTableSchema>;

const tableOnlySchema = z.object({
  tableId: z.string().uuid(),
});

export const startGameSchema = tableOnlySchema;
export type StartGamePayload = z.infer<typeof startGameSchema>;

export const drawSchema = tableOnlySchema;
export type DrawPayload = z.infer<typeof drawSchema>;

export const discardSchema = tableOnlySchema.extend({
  cardId: z.string().uuid(),
});

export type DiscardPayload = z.infer<typeof discardSchema>;

export const playMeldSchema = tableOnlySchema.extend({
  cardIds: z.array(z.string().uuid()).min(3),
  type: z.enum(["set", "sequence"] as const),
});

export type PlayMeldPayload = z.infer<typeof playMeldSchema>;

export const extendMeldSchema = tableOnlySchema.extend({
  meldId: z.string().uuid(),
  cardIds: z.array(z.string().uuid()).min(1),
});

export type ExtendMeldPayload = z.infer<typeof extendMeldSchema>;

export type TableUpdatePayload = {
  id: string;
  hostId: string;
  status: TableStatus;
  createdAt: number;
  players: Player[];
  game?: GameSummary;
};

export type ServerToClientEvents = {
  "lobby:snapshot": (snapshot: LobbySnapshot) => void;
  "lobby:event": (event: LobbyEvents) => void;
  "table:update": (table: TableUpdatePayload) => void;
  "game:state": (state: PublicGameState) => void;
  error: (message: string) => void;
};

export type ClientToServerEvents = {
  "lobby:create-table": (payload: CreateTablePayload, ack: AckCallback) => void;
  "lobby:join-table": (payload: JoinTablePayload, ack: AckCallback) => void;
  "lobby:leave-table": (payload: LeaveTablePayload, ack: AckCallback) => void;
  "lobby:subscribe": (ack: AckCallback) => void;
  "lobby:unsubscribe": (ack: AckCallback) => void;
  "table:start-game": (payload: StartGamePayload, ack: AckCallback) => void;
  "table:draw-stock": (payload: DrawPayload, ack: AckCallback) => void;
  "table:draw-discard": (payload: DrawPayload, ack: AckCallback) => void;
  "table:discard": (payload: DiscardPayload, ack: AckCallback) => void;
  "table:play-meld": (payload: PlayMeldPayload, ack: AckCallback) => void;
  "table:extend-meld": (payload: ExtendMeldPayload, ack: AckCallback) => void;
  "table:request-state": (payload: DrawPayload, ack: AckCallback) => void;
};

type AckCallback = (response: AckResponse) => void;

export type AckResponse =
  | { ok: true; tableId?: string }
  | { ok: false; error: string };
