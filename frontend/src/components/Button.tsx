import Link from "next/link";

// Neon-yellow arcade style shared by buttons and button-shaped links
const buttonClasses =
  "inline-block cursor-pointer border border-neon-yellow/40 px-3 py-1.5 text-center font-arcade text-[10px] text-neon-yellow transition-all hover:border-neon-yellow hover:shadow-[0_0_8px_#ffe00040] disabled:pointer-events-none disabled:opacity-40";

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
