"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Download, Share2, Twitter } from "lucide-react";
import type { NetworkStats } from "@/lib/types";

interface Props {
  handle: string;
  stats: NetworkStats;
  onDownload?: () => void;
}

export default function ShareCard({ handle, stats, onDownload }: Props) {
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined"
      ? window.location.href
      : `https://your-app.vercel.app/graph/${handle}`;

  const shareText = `I just mapped @${handle}'s visible Instagram interaction clusters - ${stats.circleCount} clusters across the top ${stats.shown} connections. See yours:`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be blocked; no-op */
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Instagram Network Graph", text: shareText, url });
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
    }
  }

  const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    shareText,
  )}&url=${encodeURIComponent(url)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/80">
        <Share2 className="h-4 w-4 text-ig-pink" /> Share this graph
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={copy}
          className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white/70 transition hover:bg-black/50"
        >
          <span className="truncate font-mono text-xs">{url}</span>
          {copied ? (
            <Check className="h-4 w-4 shrink-0 text-green-400" />
          ) : (
            <Copy className="h-4 w-4 shrink-0" />
          )}
        </button>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={nativeShare}
            className="flex items-center justify-center gap-2 rounded-xl bg-ig-gradient animate-gradient-pan py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
          <a
            href={tweetHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10"
          >
            <Twitter className="h-4 w-4" /> Post
          </a>
          <button
            onClick={onDownload}
            disabled={!onDownload}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> PNG
          </button>
        </div>
      </div>
    </motion.div>
  );
}
