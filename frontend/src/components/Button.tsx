import Link from "next/link";

// Neon-yellow arcade style shared by buttons and button-shaped links.
//
// `min-h-9 py-2` below `sm` is the touch target: the design's 28px-tall button
// is fine under a mouse and awkward under a thumb, so phones get ~36px and the
// desktop keeps its original density. `touch-manipulation` drops the 300ms
// double-tap-zoom wait mobile browsers otherwise add to every tap.
const buttonClasses =
  "inline-flex min-h-9 cursor-pointer touch-manipulation items-center justify-center gap-2 border border-neon-yellow/40 px-3 py-2 text-center font-arcade text-[10px] text-neon-yellow transition-all hover:border-neon-yellow hover:shadow-[0_0_8px_#ffe00040] disabled:pointer-events-none disabled:opacity-40 sm:min-h-0 sm:py-1.5";

export default function Button({
  className = "",
  ...props
}: React.ComponentProps<"button">) {
  return <button {...props} className={`${buttonClasses} ${className}`} />;
}

export function ButtonLink({
  className = "",
  ...props
}: React.ComponentProps<typeof Link>) {
  return <Link {...props} className={`${buttonClasses} ${className}`} />;
}
