"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "netgraph.howToReadDismissed";

const SOCIAL_STEPS = [
  {
    n: "1",
    title: "You're the center",
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
    title: "Tap anyone",
    short: "Tap for receipts.",
    body: "Open a person to see their comments, reactions, and how often they show up on your posts.",
  },
] as const;

const CONFERENCE_STEPS = [
  {
    n: "1",
    title: "Event at the center",
    short: "Everyone came here.",
    body: "The hub is the conference. Every person around it was on the Luma guest list.",
  },
  {
    n: "2",
    title: "Color = company",
    short: "Same color = same employer.",
    body: "People from the same company share a color and sit together. Gray means no LinkedIn match yet.",
  },
  {
    n: "3",
    title: "Tap anyone",
    short: "Tap for LinkedIn.",
    body: "Open an attendee to see role, company, location, and how confidently we matched their LinkedIn.",
  },
] as const;

type HowToStep = {
  n: string;
  title: string;
  short: string;
  body: string;
};

function HowToReadContent({
  compact = false,
  steps,
}: {
  compact?: boolean;
  steps: readonly HowToStep[];
}) {
  if (compact) {
    return (
      <ol className="mt-1.5 flex gap-2 overflow-x-auto pb-0.5">
        {steps.map((step) => (
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
    );
  }

  return (
    <ol className="mt-3 grid gap-4 sm:grid-cols-3">
      {steps.map((step) => (
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
  );
}

/** Dismissible help banner for mobile; always-visible section on desktop. */
export function GraphHowToRead({
  className = "",
  forceOpen = false,
  onDismiss,
  variant = "social",
}: {
  className?: string;
  forceOpen?: boolean;
  onDismiss?: () => void;
  variant?: "social" | "conference";
}) {
  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);
  const steps = variant === "conference" ? CONFERENCE_STEPS : SOCIAL_STEPS;

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    onDismiss?.();
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  };

  if (!mounted) return null;

  const showMobile = forceOpen || !dismissed;

  return (
    <>
      {showMobile && (
        <section
          className={`relative rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 backdrop-blur sm:hidden ${className}`}
        >
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss help"
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white/70"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="pr-7 text-[10px] font-semibold uppercase tracking-wide text-white/40">
            How to read this
          </div>
          <HowToReadContent compact steps={steps} />
        </section>
      )}

      <section
        className={`hidden rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur sm:block ${className}`}
      >
        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
          How to read this
        </div>
        <HowToReadContent steps={steps} />
      </section>
    </>
  );
}

export function reopenGraphHowToRead() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
