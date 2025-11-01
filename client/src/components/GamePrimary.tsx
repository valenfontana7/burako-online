import type { Card } from "../types/lobby";
import type { DragEvent } from "react";
import GameControls from "./GameControls";
import StageView from "./StageViewClean";

type Props = {
  canDraw: boolean;
  discardTop: Card | null;
  discardHistory?: Card[];
  discardCount?: number;
  onOpenDiscard?: () => Promise<void> | void;
  canPlayMeld: boolean;
  canExtendMeld: boolean;
  canDiscard: boolean;
  selectedCardCount: number;
  selectedMeldId: string | null;
  handleDrawStock: () => Promise<void> | void;
  handleDrawDiscard: () => Promise<void> | void;
  handlePlayMeld: (type: "set" | "sequence") => Promise<void> | void;
  handleExtendMeld: () => Promise<void> | void;
  handleDiscardSelected: () => Promise<void> | void;
  handleClearSelection: () => void;
  stagedRows: (Card | null)[][];
  displayHand: Card[];
  handleDragStart: (e: DragEvent<HTMLButtonElement>, index: number) => void;
  handleDragOver: (e: DragEvent<HTMLElement>) => void;
  handleDrop: (e: DragEvent<HTMLElement>, toIndex: number) => void;
  selectedCardIds: string[];
  handleSelectCard: (cardId: string) => void;
  myHandCount: number;
  getCardColorClass: (card: Card) => string;
  getCardDisplayValue: (card: Card) => string;
  describeCard: (card: Card) => string;
  isMyTurn: boolean;
  currentTurnStep?: "draw" | "discard";
  currentPlayerName: string | null;
};

export default function GamePrimary({
  canDraw,
  discardTop,
  discardHistory,
  discardCount,
  canPlayMeld,
  canExtendMeld,
  canDiscard,
  selectedCardCount,
  selectedMeldId,
  handleDrawStock,
  handleDrawDiscard,
  handlePlayMeld,
  handleExtendMeld,
  handleDiscardSelected,
  handleClearSelection,
  stagedRows,
  displayHand,
  handleDragStart,
  handleDragOver,
  handleDrop,
  selectedCardIds,
  handleSelectCard,
  myHandCount,
  getCardColorClass,
  getCardDisplayValue,
  describeCard,
  isMyTurn,
  currentTurnStep,
  currentPlayerName,
  onOpenDiscard,
}: Props) {
  return (
    <div className="game-panel__primary">
      <GameControls
        canDraw={canDraw}
        discardTop={discardTop}
        canPlayMeld={canPlayMeld}
        canExtendMeld={canExtendMeld}
        canDiscard={canDiscard}
        selectedCardCount={selectedCardCount}
        selectedMeldId={selectedMeldId}
        handleDrawStock={handleDrawStock}
        handleDrawDiscard={handleDrawDiscard}
        handlePlayMeld={handlePlayMeld}
        handleExtendMeld={handleExtendMeld}
        handleDiscardSelected={handleDiscardSelected}
        handleClearSelection={handleClearSelection}
      />

      <StageView
        stagedRows={stagedRows}
        displayHand={displayHand}
        handleDragStart={handleDragStart}
        handleDragOver={handleDragOver}
        handleDrop={handleDrop}
        selectedCardIds={selectedCardIds}
        handleSelectCard={handleSelectCard}
        myHandCount={myHandCount}
        discardTop={discardTop}
        discardHistory={discardHistory}
        discardCount={discardCount}
        discardLabel={null}
        getCardColorClass={getCardColorClass}
        getCardDisplayValue={getCardDisplayValue}
        describeCard={describeCard}
        isMyTurn={isMyTurn}
        currentTurnStep={currentTurnStep}
        selectedCardCount={selectedCardCount}
        currentPlayerName={currentPlayerName}
        onOpenDiscard={onOpenDiscard}
      />
    </div>
  );
}
