const STEPS = [
  {
    n: "1",
    title: "You’re the center",
    short: "Closer = more present.",
    body: "People closer to you commented or reacted more — distance is presence, not friendship.",
  },
  {
    n: "2",
    title: "Color = same posts",
    short: "Same color = same posts.",
    body: "Matching colors are people who show up on the same posts. Gray means no strong overlap yet.",
  },
  {
    n: "3",
    title: "Click anyone",
    short: "Tap for receipts.",
    body: "Open a person to see their comments, reactions, and how often they show up on your posts.",
  },
] as const;

export function GraphHowToRead({ className = "" }: { className?: string }) {
  return (
    <section
      className={`rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 backdrop-blur sm:rounded-2xl sm:px-5 sm:py-4 ${className}`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-white/40 sm:text-[11px]">
        How to read this
      </div>
      {/* Mobile: compact horizontal strip */}
      <ol className="mt-1.5 flex gap-2 overflow-x-auto pb-0.5 sm:hidden">
        {STEPS.map((step) => (
          <li
            key={step.n}
            className="flex min-w-[9.5rem] flex-1 items-start gap-2 rounded-lg bg-black/25 px-2 py-1.5"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[10px] font-semibold text-white">
              {step.n}
            </span>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold leading-tight text-white/90">
                {step.title}
              </div>
              <p className="mt-0.5 text-[10px] leading-snug text-white/45">
                {step.short}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {/* Desktop: 3-column grid */}
      <ol className="mt-3 hidden gap-4 sm:grid sm:grid-cols-3">
        {STEPS.map((step) => (
          <li key={step.n} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-xs font-semibold text-white">
              {step.n}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white/90">{step.title}</div>
              <p className="mt-0.5 text-xs leading-relaxed text-white/50">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
