"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, UserSearch, MessageCircle, Layers } from "lucide-react";

const STEPS = [
  { label: "Finding the profile", icon: UserSearch },
  { label: "Ranking current relationship signals", icon: MessageCircle },
  { label: "Grouping interaction clusters", icon: Layers },
  { label: "Drawing the graph", icon: Loader2 },
];

interface Props {
  handle: string;
}

export default function LoadingSpinner({ handle }: Props) {
  const [active, setActive] = useState(0);

  // Advance through steps on a timer for perceived progress. The real request
  // resolves independently; this is purely cosmetic pacing.
  useEffect(() => {
    const timers = [
      setTimeout(() => setActive(1), 1500),
      setTimeout(() => setActive(2), 4000),
      setTimeout(() => setActive(3), 6500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="relative">
        <div className="h-24 w-24 animate-spin rounded-full border-2 border-white/10 border-t-ig-pink" />
        <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-white/60">
          @{handle}
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const done = i < active;
          const current = i === active;
          return (
            <motion.div
              key={step.label}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: done || current ? 1 : 0.4 }}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left"
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  done
                    ? "bg-ig-pink/20 text-ig-pink"
                    : current
                      ? "bg-white/10 text-white"
                      : "bg-white/5 text-white/40"
                }`}
              >
                {done ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className={`h-4 w-4 ${current ? "animate-pulse" : ""}`} />
                )}
              </span>
              <span className="text-sm text-white/80">{step.label}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
