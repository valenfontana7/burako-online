export const CARD_COLORS = ["black", "red", "blue", "yellow"] as const;
export const CARD_NUMBERS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
] as const;

export type CardColor = (typeof CARD_COLORS)[number];
export type CardNumber = (typeof CARD_NUMBERS)[number];

export type TableStatus = "waiting" | "playing" | "finished";
export type GamePhase = "idle" | "playing" | "finished";
export type DrawSource = "stock" | "discard";
export type TurnStep = "draw" | "discard";

export type Player = {
  id: string;
  name: string;
  seat: number | null;
  isHost: boolean;
  joinedAt: number;
  isConnected: boolean;
};

export type CardBase = {
  id: string;
  value: number;
};

export type StandardCard = CardBase & {
  kind: "standard";
  color: CardColor;
  number: CardNumber;
};

export type JokerCard = CardBase & {
  kind: "joker";
  label: "JOKER";
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

export type PlayerRoundState = {
  hasTakenDead: boolean;
  isOut: boolean;
};

export type TurnState = {
  playerId: string;
  seat: number | null;
  step: TurnStep;
  drawnFrom: DrawSource | null;
};

export type GameState = {
  id: string;
  phase: GamePhase;
  round: number;
  createdAt: number;
  updatedAt: number;
  stock: Card[];
  discardPile: Card[];
  hands: Record<string, Card[]>;
  melds: Record<string, Meld[]>;
  tableMelds: Meld[];
  scores: Record<string, number>;
  seatByPlayerId: Record<string, number | null>;
  turnOrder: string[];
  turn: TurnState;
  deadPiles: Record<string, Card[]>;
  playerState: Record<string, PlayerRoundState>;
  winnerId?: string;
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
  phase: GamePhase;
  round: number;
  currentTurn: TurnState;
  stockCount: number;
  discardTop: Card | null;
  tableMelds: Meld[];
  players: PublicPlayerState[];
  winnerId?: string;
};

export type GameSummary = {
  phase: GamePhase;
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
  game?: GameState;
};

export type LobbySnapshot = {
  tables: TableSummary[];
};

export type TableSummary = {
  id: string;
  status: TableStatus;
  hostId: string;
  playerCount: number;
  game?: GameSummary;
};

export type LobbyEvents =
  | { type: "table-created"; table: TableSummary }
  | { type: "table-removed"; tableId: string }
  | { type: "table-updated"; table: TableSummary };
