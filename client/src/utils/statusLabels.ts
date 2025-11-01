export type TableStatus = "waiting" | "playing" | "finished";
export type GamePhase = "idle" | "playing" | "finished";

const TABLE_LABELS: Record<TableStatus, string> = {
  waiting: "Esperando",
  playing: "En juego",
  finished: "Finalizada",
};

const TABLE_HINTS: Record<TableStatus, string> = {
  waiting: "Esperando jugadores",
  playing: "Partida en curso",
  finished: "Partida finalizada",
};

const GAME_PHASE_LABELS: Record<GamePhase, string> = {
  idle: "En espera",
  playing: "En juego",
  finished: "Finalizada",
};

export function tableStatusLabel(status: TableStatus): string {
  return TABLE_LABELS[status] ?? status;
}

export function tableStatusHint(status: TableStatus): string {
  return TABLE_HINTS[status] ?? "";
}

export function gamePhaseLabel(phase: GamePhase): string {
  return GAME_PHASE_LABELS[phase] ?? phase;
}

export function gamePhaseHint(phase: GamePhase): string {
  return phase === "finished" ? "Partida finalizada" : "Partida en juego";
}
