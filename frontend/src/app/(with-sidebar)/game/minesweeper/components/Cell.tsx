// function Cell({
// 				name,
// 				onLeftClick,
// 				onRightClick
// 			  }: {
// 					name: string|number ;
// 					onLeftClick: () => void;
// 					onRightClick: () => void;
// 				 }
// 			)
// {
// 	const isRelvealed = name != 'h' && name != 'f'
// 	return (
// 		<button 
// 		  onClick={onLeftClick}
// 		  onContextMenu={(e) => {
// 			e.preventDefault();
// 			onRightClick();
// 		  }}
// 		  className={
// 			isRelvealed
// 			? "w-10 h-10  bg-arcade-card border-arcade-border border-2"
// 			: `
// 				w-10
// 				h-10
// 				bg-arcade-muted
// 				border-arcade-border
// 				border-2
// 				hover:border-arcade-border
// 				hover:scale-95
// 				active:scale-90
// 				active:bg-arcade-card
// 			`
// 		}
// 		>
// 			{name}
// 		</button>
// 	)
// }
// export default Cell;










import CellDisplay, { Cell as CellType } from "./CellDisplay";

export default function Cell({
  name,
  onLeftClick,
  onRightClick
}: {
  name: CellType;
  onLeftClick: () => void;
  onRightClick: () => void;
}) {
  return (
    <div
      onClick={onLeftClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onRightClick();
      }}
    >
      <CellDisplay cell={name} />
    </div>
  );
}
