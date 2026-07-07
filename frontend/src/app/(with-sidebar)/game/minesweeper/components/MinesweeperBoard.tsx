"use client";
import { useState } from "react";
import Cell from "./Cell"

// type BoardChars = 'h' | 'f' | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
import { Cell as CellType } from "./CellDisplay";
type BoardChars = CellType;
const Board: BoardChars[][] = [
  ['h', 'h', 'h', 'h', 'h', 'h',  3 , 'h'],
  ['h', 'h', 'h', 'h', 'h',  6 ,  6 , 'h'],
  ['h',  8 , 'h', 'h', 'h', 'h', 'h', 'h'],
  ['h', 'h', 'h', 'h', 'h',  5 , 'h', 'h'],
  ['h',  7 , 'h', 'h',  3 ,  0 ,  3 , 'h'],
  ['h', 'h',  3 ,  0 ,  0 ,  0 ,  0 ,  0 ],
  ['h',  4 ,  0 ,  0 ,  0 ,  0 ,  0 ,  1 ],
  [ 2 , 'h',  1 ,  0 ,  0 ,  0 ,  1 , 'h'],
]

function MinesweeperBoard() {
	const [board, setBoard] = useState(Board);

	// left-click
	function changeCell(x:number, y:number) {
		const newBoard = board.map(row => [...row]);
		if (newBoard[y][x] == 'f')
			return;
		newBoard[y][x] = 0;
		setBoard(newBoard);
	}

	// right-click
	function flagCell(x:number, y:number) {
		const newBoard = board.map(row => [...row]);
		if (newBoard[y][x] == 'f')
			newBoard[y][x] = 'h';
		else if (newBoard[y][x] == 'h')
			newBoard[y][x] = 'f';
		setBoard(newBoard);
	}
	return (
		<div className="flex flex-col p-12 pt-4">
			{board.map((meow, y) => {
				return (
					<div key={y} className="flex w-fit">
						{meow.map((cell, x) => {
							return (
								<Cell
								  key={x}
								  name={cell}
								  onLeftClick={() => {changeCell(x, y);}}
								  onRightClick={() => {flagCell(x, y);}}
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