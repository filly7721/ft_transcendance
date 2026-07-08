"use client";

import { useEffect, useState } from "react";
import {
  applyMove,
  createInitialState,
  isBoardPlayable,
  isValidMove,
  type Mark,
  type SuperTttState,
} from "@/lib/superTtt";

// The playable super-tic-tac-toe game for one lobby. Moves travel through
// sendMove(), which validates locally so an illegal or out-of-turn move is
// never sent to the backend; the server stays authoritative and its echoed
// moves are applied via applyServerMove().
export default function SuperTtt({ lobbyCode }: { lobbyCode: string }) {
  const [gameState, setGameState] = useState<SuperTttState>(createInitialState);

  // TODO(backend): mark is assigned by the server when joining the lobby.
  // Until then both marks are "ours" so the game is playable locally.
  const myMark: Mark = gameState.currentPlayer;

  useEffect(() => {
    // TODO(backend): open the websocket for this lobby, e.g.
    //   const ws = new WebSocket(`${WS_URL}/game/super-tic-tac-toe/${lobbyCode}`);
    //   ws.onmessage = (event) => {
    //     const msg = JSON.parse(event.data);
    //     if (msg.type === "move") applyServerMove(msg.boardIdx, msg.cellIdx);
    //     // also expected: player-assignment (sets myMark), full-state resync,
    //     // opponent joined/left, game over
    //   };
    //   return () => ws.close();
  }, [lobbyCode]);

  // Applied when the server broadcasts a move (either player's, already
  // validated server-side) — no turn check here, the server is authoritative.
  function applyServerMove(boardIdx: number, cellIdx: number) {
    setGameState((state) => applyMove(state, boardIdx, cellIdx));
  }

  function sendMove(boardIdx: number, cellIdx: number) {
    // Client-side validation: only our turn, only the active board, only an
    // empty cell — anything else never reaches the websocket.
    if (gameState.currentPlayer !== myMark) return;
    if (!isValidMove(gameState, boardIdx, cellIdx)) return;

    // TODO(backend): ws.send(JSON.stringify({ type: "move", boardIdx, cellIdx }));
    // TODO(backend): remove this local apply once the server echoes moves back.
    applyServerMove(boardIdx, cellIdx);
  }

  return (
    <div className="flex flex-col items-center gap-10">
      <StatusBar state={gameState} lobbyCode={lobbyCode} />
      <div className="bg-arcade-card  mt-2 p-4 rounded-xl">
        <div className="grid grid-cols-3 gap-1 bg-[radial-gradient(circle_closest-side,var(--color-arcade-border)_95%,transparent_100%)]">
          {gameState.boards.map((cells, boardIdx) => (
            <MiniBoard
              key={boardIdx}
              cells={cells}
              result={gameState.boardResults[boardIdx]}
              playable={isBoardPlayable(gameState, boardIdx)}
              onCellClick={(cellIdx) => sendMove(boardIdx, cellIdx)}
              currentPlayer={gameState.currentPlayer}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBar({
  state,
  lobbyCode,
}: {
  state: SuperTttState;
  lobbyCode: string;
}) {
  return (
    <div className="flex items-center gap-8 border border-arcade-border bg-arcade-panel px-8 py-4">
      <div className="text-center">
        <div className="font-mono text-xs text-arcade-muted mb-1">LOBBY</div>
        <div className="font-arcade text-xs text-foreground/80">
          {lobbyCode}
        </div>
      </div>

      <div className="text-center font-mono text-xs px-4 border-x border-arcade-border">
        {state.result === null ? (
          <>
            <div
              className={`font-arcade text-xs animate-blink ${
                state.currentPlayer === "X" ? "glow-cyan" : "glow-magenta"
              }`}
            >
              {state.currentPlayer} TURN
            </div>
            <div className="text-arcade-muted mt-1">
              {state.activeBoard === null
                ? "ANY BOARD"
                : `BOARD ${state.activeBoard + 1}`}
            </div>
          </>
        ) : (
          <div
            className={`font-arcade text-xs ${
              state.result === "X"
                ? "glow-cyan"
                : state.result === "O"
                  ? "glow-magenta"
                  : "text-arcade-muted"
            }`}
          >
            {state.result === "draw" ? "DRAW" : `${state.result} WINS`}
          </div>
        )}
      </div>

      <div className="text-center">
        <div className="font-mono text-xs text-arcade-muted mb-1">SCORE</div>
        <div className="font-arcade text-xs">
          <span className="glow-cyan">
            {state.boardResults.filter((r) => r === "X").length}
          </span>
          <span className="text-arcade-muted mx-1">-</span>
          <span className="glow-magenta">
            {state.boardResults.filter((r) => r === "O").length}
          </span>
        </div>
      </div>
    </div>
  );
}

function MiniBoard({
  cells,
  result,
  playable,
  onCellClick,
  currentPlayer,
}: {
  cells: (Mark | null)[];
  result: Mark | "draw" | null;
  playable: boolean;
  onCellClick: (cellIdx: number) => void;
  currentPlayer: Mark;
}) {
  const borderClass = playable
    ? currentPlayer === "X"
      ? "border-2 border-neon-cyan shadow-[0_0_12px_#00f5ff40]"
      : "border-2 border-neon-magenta shadow-[0_0_12px_#ff00cc40]"
    : result !== null
      ? "border border-arcade-border/30"
      : "border border-arcade-border/50";

  return (
    <div
      className={`relative p-1 ${borderClass} bg-arcade-card transition-all`}
    >
      {result !== null && result !== "draw" && (
        <div className="absolute inset-0 flex items-center justify-center bg-arcade-bg/70 z-10">
          <span
            className={`font-arcade text-3xl ${result === "X" ? "glow-cyan" : "glow-magenta"}`}
          >
            {result}
          </span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-0.5">
        {cells.map((mark, cellIdx) => (
          <button
            key={cellIdx}
            onClick={() => onCellClick(cellIdx)}
            disabled={!playable || mark !== null}
            className={`w-8 h-8 flex items-center justify-center border text-xs font-arcade transition-colors ${
              playable && !mark
                ? `border-arcade-border/60 bg-arcade-panel cursor-pointer ${
                    currentPlayer === "X"
                      ? "hover:border-neon-cyan/50"
                      : "hover:border-neon-magenta/50"
                  }`
                : "border-arcade-border/30 bg-arcade-panel"
            }`}
          >
            {mark === "X" && <span className="glow-cyan text-xs">X</span>}
            {mark === "O" && <span className="glow-magenta text-xs">O</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
