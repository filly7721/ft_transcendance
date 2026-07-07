"use client";
import { useState } from "react";
import Cell from "./Cell"

type BoardChars = 'h' | 'f' | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
const Board: BoardChars[][] = [
  ['h', 'h', 'h', 'h', 'h', 'h', 'h', 'h'],
  ['h', 'h', 'h', 'h', 'h', 'h', 'h', 'h'],
  ['h', 'h', 'h', 'h', 'h', 'h', 'h', 'h'],
  ['h', 'h', 'h', 'h', 'h', 'h', 'h', 'h'],
  ['h', 'h', 'h', 'h', 'h', 'h', 'h', 'h'],
  ['h', 'h', 'h', 'h', 'h', 'h', 'h', 'h'],
  ['h', 'h', 'h', 'h', 'h', 'h', 'h', 'h'],
  ['h', 'h', 'h', 'h', 'h', 'h', 'h', 'h'],
]

function MinesweeperBoard() {
	const [board, setBoard] = useState(Board);

	function changeCell(x:number, y:number) {
		const newBoard = board.map(row => [...row]);
		newBoard[y][x] = 0;
		setBoard(newBoard);
	}
	return (
		<div className="flex flex-col p-12 pt-4">
			{board.map((row, y) => {
				return (
					<div key={y} className="flex w-fit">
						{row.map((cell, x) => {
							return (
								<Cell
								  key={x}
								  name={cell}
								  onClick={() => {changeCell(x, y);}}
								></Cell>
							)
						})}
					</div>
				)
			})}
		</div>
	)
}

export default MinesweeperBoard;