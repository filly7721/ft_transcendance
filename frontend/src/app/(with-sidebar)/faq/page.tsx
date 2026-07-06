// TODO: replace placeholder questions with real content
const faqs = [
  {
    q: "HOW DO I PLAY WITH FRIENDS?",
    a: "Multiplayer lobbies are coming soon. You will be able to invite friends by username.",
  },
  {
    q: "IS AN ACCOUNT REQUIRED?",
    a: "You can browse without one, but playing ranked games will require logging in.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="border border-arcade-border bg-arcade-card p-6">
      <h2 className="mb-3 font-arcade text-xs glow-cyan">{q}</h2>
      <p className="text-xs font-mono leading-relaxed text-arcade-muted">{a}</p>
    </div>
  );
}

export default function FaqPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <h1 className="mb-4 text-center font-arcade text-2xl glow-cyan animate-glow-pulse">FAQ</h1>
      {faqs.map((faq) => (
        <FaqItem key={faq.q} {...faq} />
      ))}
    </div>
  );
}
