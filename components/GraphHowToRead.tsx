const STEPS = [
  {
    n: "1",
    title: "You’re the center",
    body: "People closer to you commented or reacted more — distance is presence, not friendship.",
  },
  {
    n: "2",
    title: "Color = same posts",
    body: "Matching colors are people who show up on the same posts. Gray means no strong overlap yet.",
  },
  {
    n: "3",
    title: "Click anyone",
    body: "Open a person to see their comments, reactions, and how often they show up on your posts.",
  },
] as const;

export function GraphHowToRead({ className = "" }: { className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur sm:px-5 sm:py-4 ${className}`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-white/40 sm:text-[11px]">
        How to read this
      </div>
      <ol className="mt-2 grid gap-2.5 sm:mt-3 sm:grid-cols-3 sm:gap-4">
        {STEPS.map((step) => (
          <li key={step.n} className="flex gap-2.5 sm:gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[11px] font-semibold text-white sm:h-7 sm:w-7 sm:text-xs">
              {step.n}
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-white/90 sm:text-sm">
                {step.title}
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-white/50 sm:text-xs sm:leading-relaxed">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
