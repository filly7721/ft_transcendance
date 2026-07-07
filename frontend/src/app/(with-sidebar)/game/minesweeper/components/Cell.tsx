function Cell({ name, onClick }: { name: string|number ; onClick: () => void }) {
	return (
		<button 
		  onClick={onClick}
		  className="w-10 h-10 bg-arcade-muted border-arcade-border border-2"
		>
			{name}
		</button>
	)
}
export default Cell;

// write the code here for minesweeper, add more components as needed, make the grid 