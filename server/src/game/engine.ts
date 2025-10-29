import { randomUUID } from "crypto";
import {
  Card,
  CardNumber,
  CardColor,
  CARD_NUMBERS,
  CARD_COLORS,
  GameState,
  GameSummary,
  JokerCard,
  Meld,
  MeldType,
  PublicGameState,
  StandardCard,
  Table,
  TurnState,
} from "./types";

const HAND_SIZE = 11;
const DEAD_BONUS = 100;
const CLOSING_BONUS = 100;
const CANASTA_CLEAN_BONUS = 200;
const CANASTA_DIRTY_BONUS = 100;

const cardValueMap: Record<CardNumber, number> = {
  1: 15,
  2: 20,
  3: 5,
  4: 5,
  5: 5,
  6: 5,
  7: 5,
  8: 10,
  9: 10,
  10: 10,
  11: 10,
  12: 10,
  13: 10,
};

const numberOrder: CardNumber[] = [...CARD_NUMBERS];

const createStandardCard = (
  color: CardColor,
  number: CardNumber,
  id: string
): StandardCard => ({
  id,
  kind: "standard",
  color,
  number,
  value: cardValueMap[number],
});

const createJoker = (id: string): JokerCard => ({
  id,
  kind: "joker",
  label: "JOKER",
  value: 50,
});

const shuffle = <T>(input: T[]): T[] => {
  const array = [...input];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const createDeck = (): Card[] => {
  const cards: Card[] = [];

  for (let deck = 0; deck < 2; deck += 1) {
    for (const color of CARD_COLORS) {
      for (const number of CARD_NUMBERS) {
        cards.push(createStandardCard(color, number, randomUUID()));
      }
    }
    cards.push(createJoker(randomUUID()));
    cards.push(createJoker(randomUUID()));
  }

  return shuffle(cards);
};

export class GameEngine {
  startGame(table: Table): GameState {
    if (table.players.length < 2) {
      throw new Error("Se necesitan al menos dos jugadores para comenzar");
    }

    const deck = createDeck();
    const turnOrder = [...table.players]
      .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
      .map((player) => player.id);

    const hands: Record<string, Card[]> = {};
    const melds: Record<string, Meld[]> = {};
    const scores: Record<string, number> = {};
    const seatByPlayerId: Record<string, number | null> = {};
    const deadPiles: Record<string, Card[]> = {};
    const playerState: GameState["playerState"] = {};

    for (const player of table.players) {
      hands[player.id] = deck.splice(0, HAND_SIZE);
      melds[player.id] = [];
      scores[player.id] = 0;
      seatByPlayerId[player.id] = player.seat;
      deadPiles[player.id] = deck.splice(0, HAND_SIZE);
      playerState[player.id] = {
        hasTakenDead: false,
        isOut: false,
      };
    }

    if (deck.length === 0) {
      throw new Error("No hay cartas suficientes para iniciar la partida");
    }

    const discardPile: Card[] = [deck.pop() as Card];

    const turn: TurnState = {
      playerId: turnOrder[0],
      seat: seatByPlayerId[turnOrder[0]],
      step: "draw",
      drawnFrom: null,
    };

    const now = Date.now();

    const game: GameState = {
      id: randomUUID(),
      phase: "playing",
      round: 1,
      createdAt: now,
      updatedAt: now,
      stock: deck,
      discardPile,
      hands,
      melds,
      tableMelds: [],
      scores,
      seatByPlayerId,
      turnOrder,
      turn,
      deadPiles,
      playerState,
    };

    table.status = "playing";
    table.game = game;

    return game;
  }

  drawFromStock(table: Table, playerId: string): void {
    const game = this.requireActiveGame(table);
    this.requireTurn(game, playerId, "draw");

    if (game.stock.length === 0) {
      this.recycleStock(game);
    }

    if (game.stock.length === 0) {
      throw new Error("No quedan cartas en el mazo");
    }

    const card = game.stock.pop() as Card;
    game.hands[playerId].push(card);

    game.turn.step = "discard";
    game.turn.drawnFrom = "stock";
    game.updatedAt = Date.now();
  }

  drawFromDiscard(table: Table, playerId: string): void {
    const game = this.requireActiveGame(table);
    this.requireTurn(game, playerId, "draw");

    if (game.discardPile.length === 0) {
      throw new Error("No hay cartas en el descarte");
    }

    const card = game.discardPile.pop() as Card;
    game.hands[playerId].push(card);

    game.turn.step = "discard";
    game.turn.drawnFrom = "discard";
    game.updatedAt = Date.now();
  }

  discardCard(table: Table, playerId: string, cardId: string): void {
    const game = this.requireActiveGame(table);
    this.requireTurn(game, playerId, "discard");

    const hand = game.hands[playerId];
    const index = hand.findIndex((card) => card.id === cardId);

    if (index === -1) {
      throw new Error("Carta no encontrada en la mano");
    }

    const [card] = hand.splice(index, 1);
    game.discardPile.push(card);
    game.updatedAt = Date.now();

    if (hand.length === 0) {
      const playerState = game.playerState[playerId];
      if (!playerState) {
        throw new Error("Estado del jugador no disponible");
      }

      const deadPile = game.deadPiles[playerId] ?? [];
      if (!playerState.hasTakenDead && deadPile.length > 0) {
        this.addScore(game, playerId, DEAD_BONUS);
        hand.push(...deadPile);
        game.deadPiles[playerId] = [];
        playerState.hasTakenDead = true;
        game.updatedAt = Date.now();
        this.advanceTurn(game, playerId);
        return;
      }

      playerState.isOut = true;
      this.finishGame(table, playerId);
      return;
    }

    this.advanceTurn(game, playerId);
  }

  playMeld(
    table: Table,
    playerId: string,
    cardIds: string[],
    type: MeldType
  ): void {
    const game = this.requireActiveGame(table);
    this.requireTurn(game, playerId, "discard");

    if (cardIds.length < 3) {
      throw new Error("Necesitas al menos tres fichas para bajar un juego");
    }

    const hand = game.hands[playerId];
    const extracted = this.takeCardsFromHand(hand, cardIds);
    const { orderedCards, isClean } = this.validateMeld(extracted, type);

    const meld: Meld = {
      id: randomUUID(),
      ownerId: playerId,
      cards: orderedCards,
      type,
      isClean,
      canastaBonus: null,
    };

    game.melds[playerId].push(meld);
    game.tableMelds.push(meld);
    game.updatedAt = Date.now();
    this.handleCanastaBonus(game, meld);
  }

  extendMeld(
    table: Table,
    playerId: string,
    meldId: string,
    cardIds: string[]
  ): void {
    const game = this.requireActiveGame(table);
    this.requireTurn(game, playerId, "discard");

    if (cardIds.length === 0) {
      throw new Error("Selecciona fichas para añadir al juego");
    }

    const target = game.tableMelds.find((meld) => meld.id === meldId);
    if (!target) {
      throw new Error("Juego no encontrado en la mesa");
    }

    const hand = game.hands[playerId];
    const extracted = this.takeCardsFromHand(hand, cardIds);
    const merged = [...target.cards, ...extracted];
    const { orderedCards, isClean } = this.validateMeld(merged, target.type);

    target.cards = orderedCards;
    target.isClean = isClean;
    game.updatedAt = Date.now();
    this.handleCanastaBonus(game, target);
  }

  getPublicState(table: Table, viewerId: string): PublicGameState {
    const game = this.requireGame(table);
    const discardTop = game.discardPile.at(-1) ?? null;

    const players = table.players.map((player) => {
      const state = game.playerState[player.id];
      return {
        id: player.id,
        name: player.name,
        seat: player.seat,
        score: game.scores[player.id] ?? 0,
        handCount: game.hands[player.id]?.length ?? 0,
        isSelf: player.id === viewerId,
        hand: player.id === viewerId ? game.hands[player.id] : undefined,
        melds: game.melds[player.id] ?? [],
        deadCount: game.deadPiles[player.id]?.length ?? 0,
        hasTakenDead: state?.hasTakenDead ?? false,
      };
    });

    return {
      tableId: table.id,
      phase: game.phase,
      round: game.round,
      currentTurn: game.turn,
      stockCount: game.stock.length,
      discardTop,
      tableMelds: game.tableMelds,
      players,
      winnerId: game.winnerId,
    };
  }

  summarize(table: Table): GameSummary | undefined {
    const game = table.game;
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
      meldCount: game.tableMelds.length,
      winnerId: game.winnerId,
    };
  }

  rebindPlayer(table: Table, previousId: string, nextId: string): void {
    const game = table.game;
    if (!game || previousId === nextId) {
      return;
    }

    const promoteKey = <T>(store: Record<string, T>) => {
      if (Object.prototype.hasOwnProperty.call(store, previousId)) {
        store[nextId] = store[previousId];
        delete store[previousId];
      }
    };

    promoteKey(game.hands);
    promoteKey(game.melds);
    promoteKey(game.scores);
    promoteKey(game.seatByPlayerId);
    promoteKey(game.deadPiles);
    promoteKey(game.playerState);

    const playerMelds = game.melds[nextId];
    if (playerMelds) {
      playerMelds.forEach((meld) => {
        if (meld.ownerId === previousId) {
          meld.ownerId = nextId;
        }
      });
    }

    game.turnOrder = game.turnOrder.map((id) =>
      id === previousId ? nextId : id
    );

    if (game.turn.playerId === previousId) {
      game.turn = {
        ...game.turn,
        playerId: nextId,
      };
    }

    game.tableMelds.forEach((meld) => {
      if (meld.ownerId === previousId) {
        meld.ownerId = nextId;
      }
    });

    if (game.winnerId === previousId) {
      game.winnerId = nextId;
    }
  }

  handlePlayerLeave(table: Table, playerId: string): void {
    const game = table.game;
    if (!game) {
      return;
    }

    delete game.hands[playerId];
    delete game.melds[playerId];
    delete game.scores[playerId];
    delete game.seatByPlayerId[playerId];
    delete game.deadPiles[playerId];
    delete game.playerState[playerId];

    game.turnOrder = game.turnOrder.filter((id) => id !== playerId);

    if (game.turn.playerId === playerId) {
      this.advanceTurn(game, playerId);
    }

    if (game.turnOrder.length < 2) {
      const winnerId = game.turnOrder[0] ?? null;
      if (winnerId) {
        this.finishGame(table, winnerId, "Abandono de jugadores");
      } else {
        table.status = "finished";
        game.phase = "finished";
        game.winnerId = undefined;
      }
    }
  }

  private requireGame(table: Table): GameState {
    if (!table.game) {
      throw new Error("La mesa no tiene una partida activa");
    }
    return table.game;
  }

  private requireActiveGame(table: Table): GameState {
    const game = this.requireGame(table);
    if (game.phase !== "playing") {
      throw new Error("La partida no está en curso");
    }
    return game;
  }

  private requireTurn(
    game: GameState,
    playerId: string,
    step: TurnState["step"]
  ): void {
    if (game.turn.playerId !== playerId) {
      throw new Error("No es tu turno");
    }
    if (game.turn.step !== step) {
      throw new Error("Acción no permitida en esta fase del turno");
    }
  }

  private advanceTurn(game: GameState, currentPlayerId: string): void {
    if (game.turnOrder.length === 0) {
      game.turn = {
        playerId: currentPlayerId,
        seat: null,
        step: "draw",
        drawnFrom: null,
      };
      return;
    }

    const currentIndex = game.turnOrder.findIndex(
      (id) => id === currentPlayerId
    );
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + 1) % game.turnOrder.length;
    const nextPlayerId = game.turnOrder[nextIndex];
    const seat = game.seatByPlayerId[nextPlayerId] ?? null;

    game.turn = {
      playerId: nextPlayerId,
      seat,
      step: "draw",
      drawnFrom: null,
    };
    game.updatedAt = Date.now();
  }

  private finishGame(
    table: Table,
    winnerId: string | null,
    reason?: string
  ): void {
    const game = this.requireGame(table);
    if (winnerId) {
      this.addScore(game, winnerId, CLOSING_BONUS);
    }
    game.phase = "finished";
    game.winnerId = winnerId ?? undefined;
    game.updatedAt = Date.now();
    table.status = "finished";
    if (reason) {
      console.log(`Partida finalizada: ${reason}`);
    }
  }

  private recycleStock(game: GameState): void {
    if (game.discardPile.length <= 1) {
      return;
    }

    const top = game.discardPile.pop() as Card;
    const recycled = shuffle(game.discardPile);
    game.discardPile = [top];
    game.stock = recycled;
  }

  private takeCardsFromHand(hand: Card[], cardIds: string[]): Card[] {
    const extracted: Card[] = [];

    for (const cardId of cardIds) {
      const index = hand.findIndex((card) => card.id === cardId);
      if (index === -1) {
        throw new Error("Alguna ficha ya no está en tu mano");
      }
      const [card] = hand.splice(index, 1);
      extracted.push(card);
    }

    return extracted;
  }

  private addScore(game: GameState, playerId: string, points: number): void {
    if (!points) {
      return;
    }
    game.scores[playerId] = (game.scores[playerId] ?? 0) + points;
  }

  private handleCanastaBonus(game: GameState, meld: Meld): void {
    if (meld.cards.length < 7) {
      return;
    }

    if (meld.canastaBonus === "clean") {
      return;
    }

    const bonusType = meld.isClean ? "clean" : "dirty";

    if (meld.canastaBonus === "dirty") {
      if (bonusType === "clean") {
        this.addScore(
          game,
          meld.ownerId,
          CANASTA_CLEAN_BONUS - CANASTA_DIRTY_BONUS
        );
        meld.canastaBonus = "clean";
      }
      return;
    }

    if (bonusType === "clean") {
      this.addScore(game, meld.ownerId, CANASTA_CLEAN_BONUS);
      meld.canastaBonus = "clean";
      return;
    }

    this.addScore(game, meld.ownerId, CANASTA_DIRTY_BONUS);
    meld.canastaBonus = "dirty";
  }

  private validateMeld(
    cards: Card[],
    type: MeldType
  ): {
    orderedCards: Card[];
    isClean: boolean;
  } {
    if (cards.length < 3) {
      throw new Error("Un juego requiere al menos tres fichas");
    }

    const jokers = cards.filter((card) => card.kind === "joker");
    if (jokers.length > 1) {
      throw new Error("Solo se permite un comodín por juego");
    }

    const standards = cards.filter(
      (card): card is StandardCard => card.kind === "standard"
    );

    if (standards.length === 0) {
      throw new Error("Necesitas fichas reales para formar un juego");
    }

    if (type === "set") {
      return this.validateSet(standards, jokers);
    }

    return this.validateSequence(standards, jokers);
  }

  private validateSet(
    standards: StandardCard[],
    jokers: Card[]
  ): { orderedCards: Card[]; isClean: boolean } {
    const targetNumber = standards[0].number;
    const invalid = standards.some((card) => card.number !== targetNumber);
    if (invalid) {
      throw new Error("Todas las fichas deben compartir el mismo número");
    }

    return {
      orderedCards: [...standards, ...jokers],
      isClean: jokers.length === 0,
    };
  }

  private validateSequence(
    standards: StandardCard[],
    jokers: Card[]
  ): { orderedCards: Card[]; isClean: boolean } {
    const color = standards[0].color;
    if (standards.some((card) => card.color !== color)) {
      throw new Error("Las escaleras requieren fichas del mismo color");
    }

    const indices = standards
      .map((card) => numberOrder.indexOf(card.number))
      .sort((a, b) => a - b);

    for (let i = 1; i < indices.length; i += 1) {
      if (indices[i] === indices[i - 1]) {
        throw new Error("No puedes repetir el mismo número en una escalera");
      }
    }

    const min = indices[0];
    const max = indices[indices.length - 1];
    const span = max - min + 1;
    if (span > standards.length + jokers.length) {
      throw new Error(
        "Los valores no son consecutivos, incluso usando el comodín"
      );
    }

    const orderedStandards = [...standards].sort(
      (a, b) => numberOrder.indexOf(a.number) - numberOrder.indexOf(b.number)
    );

    return {
      orderedCards: [...orderedStandards, ...jokers],
      isClean: jokers.length === 0,
    };
  }
}
