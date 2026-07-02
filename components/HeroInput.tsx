"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, AtSign, Loader2 } from "lucide-react";
import ScrapeBudgetSelector from "@/components/ScrapeBudgetSelector";
import {
  budgetToQuery,
  DEFAULT_SCRAPE_BUDGET,
  estimateScrapeBudget,
  type ScrapeBudget,
} from "@/lib/scrapeBudget";

interface Props {
  size?: "lg" | "md";
}

export default function HeroInput({ size = "lg" }: Props) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [budget, setBudget] = useState<ScrapeBudget>(DEFAULT_SCRAPE_BUDGET);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const handle = value.replace(/^@/, "").trim().toLowerCase();
    if (!/^[a-z0-9._]{1,30}$/.test(handle)) {
      setError("Enter a valid Instagram handle");
      return;
    }
    setError(null);
    setLoading(true);
    router.push(`/graph/${handle}?${budgetToQuery(budget)}`);
  }

  const big = size === "lg";
  const estimate = estimateScrapeBudget(budget);

  return (
    <form onSubmit={submit} className="w-full max-w-xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className={`group flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur transition focus-within:border-white/30 focus-within:bg-white/10 ${
          big ? "" : "scale-95"
        }`}
      >
        <span className="pl-3 text-white/40">
          <AtSign className={big ? "h-6 w-6" : "h-5 w-5"} />
        </span>
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="instagram_handle"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`w-full bg-transparent text-white placeholder-white/30 outline-none ${
            big ? "text-xl" : "text-lg"
          }`}
        />
        <button
          type="submit"
          disabled={loading}
          className={`flex items-center gap-2 rounded-xl bg-ig-gradient animate-gradient-pan font-semibold text-white transition hover:opacity-90 disabled:opacity-60 ${
            big ? "px-6 py-3 text-base" : "px-5 py-2.5 text-sm"
          }`}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              Visualize <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>
      </motion.div>
      {error && (
        <p className="mt-2 pl-2 text-sm text-ig-pink">{error}</p>
      )}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mt-4"
      >
        <ScrapeBudgetSelector
          value={budget}
          onChange={setBudget}
          compact={!big}
        />
        {estimate.needsPaymentPrompt && (
          <p className="mt-2 px-2 text-xs text-white/35">
            You will see a confirmation prompt before this paid-tier scrape
            starts.
          </p>
        )}
      </motion.div>
    </form>
  );
}
