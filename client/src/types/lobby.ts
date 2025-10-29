export type TableStatus = "waiting" | "playing" | "finished";

export const CARD_COLORS = ["black", "red", "blue", "yellow"] as const;
export const CARD_NUMBERS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
] as const;

export type CardColor = (typeof CARD_COLORS)[number];
export type CardNumber = (typeof CARD_NUMBERS)[number];

export type Player = {
  id: string;
  name: string;
  seat: number | null;
  isHost: boolean;
  joinedAt: number;
  isConnected: boolean;
};

export type StandardCard = {
  id: string;
  kind: "standard";
  color: CardColor;
  number: CardNumber;
  value: number;
};

export type JokerCard = {
  id: string;
  kind: "joker";
  label: "JOKER";
  value: number;
};

export type Card = StandardCard | JokerCard;

export type MeldType = "set" | "sequence";

export type Meld = {
  id: string;
  ownerId: string;
  cards: Card[];
  type: MeldType;
  isClean: boolean;
  canastaBonus: "clean" | "dirty" | null;
};

export type GameSummary = {
  phase: "idle" | "playing" | "finished";
  round: number;
  currentPlayerId: string | null;
  stockCount: number;
  discardTop: Card | null;
  meldCount: number;
  winnerId?: string;
};

export type Table = {
  id: string;
  hostId: string;
  status: TableStatus;
  createdAt: number;
  players: Player[];
  game?: GameSummary;
};

export type TableSummary = {
  id: string;
  status: TableStatus;
  hostId: string;
  playerCount: number;
  game?: GameSummary;
};

export type LobbySnapshot = {
  tables: TableSummary[];
};

export type LobbyEvent =
  | { type: "table-created"; table: TableSummary }
  | { type: "table-removed"; tableId: string }
  | { type: "table-updated"; table: TableSummary };

export type TurnState = {
  playerId: string;
  seat: number | null;
  step: "draw" | "discard";
  drawnFrom: "stock" | "discard" | null;
};

export type PublicPlayerState = {
  id: string;
  name: string;
  seat: number | null;
  score: number;
  handCount: number;
  isSelf: boolean;
  hand?: Card[];
  melds: Meld[];
  deadCount: number;
  hasTakenDead: boolean;
};

export type PublicGameState = {
  tableId: string;
  phase: "idle" | "playing" | "finished";
  round: number;
  currentTurn: TurnState;
  stockCount: number;
  discardTop: Card | null;
  tableMelds: Meld[];
  players: PublicPlayerState[];
  winnerId?: string;
};
