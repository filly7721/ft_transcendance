"use client";

import Button from "@/components/Button";
import SuperTttDemo from "@/components/games/SuperTttDemo";
import { useState } from "react";

type Cell = string;

interface GameState {
  boards: Cell[][];
  currPlayer: string;
}

// Dedicated super-tic-tac-toe game page — currently shows the static demo board.
// TODO: build the real game here; multiplayer rooms will live at
// /lobby/super-tic-tac-toe/[room-code] and reuse the game component built for this page.
export default function SuperTicTacToeGame() {
  const [gameState, setGameState] = useState<GameState>({
    boards: Array.from({ length: 9 }, () => Array(9).fill("")),
    currPlayer: "x",
  });
  // setGameState({ ...gameState, currPlayer: "x" })

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 py-12">
      <div className="text-center">
        <h1 className="mb-2 font-arcade text-2xl glow-magenta animate-glow-pulse">
          SUPER TTT
        </h1>
        <p className="font-mono text-xs uppercase tracking-widest text-neon-yellow animate-blink">
          DEV PREVIEW
        </p>
      </div>
      <BigBoard state={gameState} />
    </div>
  );
}

// function

function SmallBoard({ board }: { board: Cell[] }) {
  return (
    <div className="grid grid-cols-3 grid-rows-3">
      {board.map((cell, i) => {
        return (
          <div
            key={i}
            className="border-arcade-border border-2 bg-arcade-muted w-10 aspect-square"
          />
        );
      })}
    </div>
  );
}
function BigBoard({ state }: { state: GameState }) {
  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-2">
      {state.boards.map((board, idx) => {
        return <SmallBoard key={idx} board={board} />;
      })}
    </div>
  );
}
