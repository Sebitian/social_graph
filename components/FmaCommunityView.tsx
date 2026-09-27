"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { DEMO_JOB_ID, jobPath } from "@/lib/jobCatalog";
import {
  ArrowLeft,
  AtSign,
  ChevronDown,
  ChevronUp,
  Heart,
  MessageCircle,
  Play,
  X,
} from "lucide-react";
import type {
  FmaCommunityGraph,
  FmaCommunityNode,
  FmaSentiment,
} from "@/lib/aimanFmaCommunityTypes";
import FmaCommunityGraphVisualizer from "@/components/FmaCommunityGraphVisualizer";

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function sentimentTone(sentiment?: FmaSentiment) {
  if (sentiment === "positive") {
    return {
      number: "text-emerald-400",
      label: "text-emerald-400/70",
      chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      tile: "border-emerald-500/25 bg-emerald-500/10",
    };
  }
  if (sentiment === "negative") {
    return {
      number: "text-red-400",
      label: "text-red-400/70",
      chip: "border-red-500/30 bg-red-500/10 text-red-300",
      tile: "border-red-500/25 bg-red-500/10",
    };
  }
  return {
    number: "text-slate-200",
    label: "text-white/40",
    chip: "border-white/10 bg-white/5 text-white/55",
    tile: "border-white/10 bg-white/5",
  };
}

function KpiTile({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "positive" | "negative" | "neutral";
}) {
  const numberClass =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "negative"
        ? "text-red-400"
        : "text-white";
  const borderClass =
    tone === "positive"
      ? "border-emerald-500/25 bg-emerald-500/8"
      : tone === "negative"
        ? "border-red-500/25 bg-red-500/8"
        : "border-white/10 bg-white/5";
  return (
    <div className={`rounded-xl border px-2.5 py-2 ${borderClass}`}>
      <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-white/40">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-lg font-semibold tabular-nums leading-none ${numberClass}`}>
        {value}
      </div>
    </div>
  );
}

function SelectedKpis({ node }: { node: FmaCommunityNode }) {
  const tone = sentimentTone(node.sentiment);
  const kpiTone =
    node.sentiment === "positive" || node.sentiment === "negative"
      ? node.sentiment
      : "neutral";
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {node.plays != null ? (
        <KpiTile
          label="Plays"
          value={compact(node.plays)}
          icon={<Play className="h-3 w-3" />}
        />
      ) : null}
      <KpiTile
        label="Likes"
        value={compact(node.likes)}
        icon={<Heart className="h-3 w-3" />}
        tone={kpiTone}
      />
      <KpiTile
        label="Comments"
        value={compact(node.commentsList?.length ?? node.comments)}
        icon={<MessageCircle className="h-3 w-3" />}
        tone={kpiTone}
      />
      {node.mentionsIn > 0 ? (
        <KpiTile
          label="Mentions"
          value={compact(node.mentionsIn)}
          icon={<AtSign className="h-3 w-3" />}
          tone={kpiTone}
        />
      ) : null}
      {node.sentiment ? (
        <div className={`rounded-xl border px-2.5 py-2 ${tone.tile}`}>
          <div
            className={`text-[9px] font-semibold uppercase tracking-wide ${tone.label}`}
          >
            Sentiment
          </div>
          <div
            className={`mt-1 text-lg font-semibold capitalize leading-none ${tone.number}`}
          >
            {node.sentiment}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function kindLabel(node: FmaCommunityNode): string {
  if (node.kind === "post") return "Post";
  if (node.kind === "creator") return "Creator";
  if (node.kind === "voice") {
    return node.voiceWhy === "thread"
      ? "Loud in the thread"
      : "Loud by likes";
  }
  return node.communityLabel
    ? `In ${node.communityLabel}'s cluster`
    : "Community";
}

export default function FmaCommunityView({ data }: { data: FmaCommunityGraph }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(true);
  const [commentQuery, setCommentQuery] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<FmaSentiment | "all">(
    "all",
  );
  const selected = useMemo(
    () => data.nodes.find((n) => n.id === selectedId) ?? null,
    [data.nodes, selectedId],
  );

  useEffect(() => {
    setCommentQuery("");
    setSentimentFilter("all");
  }, [selectedId]);

  const filteredComments = useMemo(() => {
    const list = selected?.commentsList ?? [];
    const q = commentQuery.trim().toLowerCase();
    return list.filter((row) => {
      if (sentimentFilter !== "all" && row.sentiment !== sentimentFilter) {
        return false;
      }
      if (!q) return true;
      return (
        row.text.toLowerCase().includes(q) ||
        row.postLabel.toLowerCase().includes(q)
      );
    });
  }, [commentQuery, selected, sentimentFilter]);

  const voiceCount = data.voices.length;
  const memberCount = data.nodes.filter((n) => n.kind === "member").length;

  return (
    <main className="relative min-h-[100dvh] bg-background bg-grid">
      <header className="sticky left-0 right-0 top-0 z-20 flex items-center justify-between gap-2 bg-background/80 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur sm:px-5 sm:pt-4">
        <Link
          href={jobPath(DEMO_JOB_ID)}
          className="flex min-h-[40px] items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 backdrop-blur transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Demo
        </Link>
        <div className="hidden text-right sm:block">
          <div className="text-sm font-medium text-white/85">
            Aiman FMA · posts and loud voices
          </div>
          <div className="text-[11px] text-white/45">
            {voiceCount} voices · {memberCount} in their clusters · 2 reels
          </div>
        </div>
      </header>

      <div className="flex flex-col">
        <div className="relative mx-3 mb-3 overflow-hidden rounded-xl border border-white/10 bg-black/50 sm:mx-5 sm:overflow-visible sm:rounded-3xl">
          <FmaCommunityGraphVisualizer
            data={data}
            selectedId={selectedId}
            onSelect={(node) => setSelectedId(node?.id ?? null)}
          />

          <div className="fixed bottom-4 left-4 z-10 flex max-w-[240px] flex-col gap-2 rounded-xl border border-white/10 bg-black/55 px-3 py-2 backdrop-blur">
            <button
              type="button"
              onClick={() => setLegendOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-2 text-left"
              aria-expanded={legendOpen}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                How to read
              </span>
              {legendOpen ? (
                <ChevronUp className="h-3.5 w-3.5 shrink-0 text-white/45" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/45" />
              )}
            </button>
            {legendOpen ? (
              <>
                <span className="text-[11px] leading-relaxed text-white/55">
                  Reels sit on a vertical timeline on the left — earlier
                  at the top, later at the bottom. Voices sit to the right
                  of the date line; louder comments are closer to the reel.
                </span>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                  Loudest
                </div>
                <div className="flex flex-col gap-1">
                  {data.voices.slice(0, 5).map((voice) => (
                    <button
                      key={voice.id}
                      type="button"
                      onClick={() => setSelectedId(voice.id)}
                      className={`rounded-md px-1.5 py-0.5 text-left text-[11px] transition ${
                        selectedId === voice.id
                          ? "bg-white/15 text-white"
                          : "text-white/65 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {voice.label}
                      <span className="ml-1 text-white/35">
                        {compact(voice.likes)} likes · {voice.communitySize}{" "}
                        around them
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {selected ? (
            <aside className="fixed bottom-3 right-3 top-[4.5rem] z-10 flex w-[min(100%-1.5rem,320px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/75 backdrop-blur sm:bottom-4 sm:right-4 sm:top-20">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close"
                className="absolute right-2.5 top-2.5 z-20 rounded-md p-1 text-[#ef4444] hover:bg-white/10"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 pr-11">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                {kindLabel(selected)}
              </div>
              <div className="mt-1 text-base font-semibold text-white">
                {selected.label}
              </div>
              {selected.kind !== "post" && selected.id !== "nuancedaiman" ? (
                <div className="text-[11px] text-white/40">@{selected.id}</div>
              ) : null}
              <SelectedKpis node={selected} />
              {selected.caption ? (
                <p className="mt-3 text-[12px] leading-relaxed text-white/55">
                  {selected.caption}
                </p>
              ) : null}
              {(selected.commentsList?.length ?? 0) > 0 ? (
                <div className="mt-3 flex flex-col gap-2">
                  <input
                    type="search"
                    value={commentQuery}
                    onChange={(e) => setCommentQuery(e.target.value)}
                    placeholder="Filter comments"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-[12px] text-white/85 outline-none placeholder:text-white/35 focus:border-white/25"
                  />
                  <div className="flex flex-wrap gap-1">
                    {(
                      [
                        ["all", "All"],
                        ["positive", "Positive"],
                        ["neutral", "Neutral"],
                        ["negative", "Negative"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSentimentFilter(id)}
                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                          sentimentFilter === id
                            ? id === "positive"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : id === "negative"
                                ? "bg-red-500/20 text-red-300"
                                : "bg-white/15 text-white"
                            : id === "positive"
                              ? "text-emerald-400/70 hover:text-emerald-300"
                              : id === "negative"
                                ? "text-red-400/70 hover:text-red-300"
                                : "text-white/45 hover:text-white/70"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-white/35">
                    {filteredComments.length} of{" "}
                    {selected.commentsList?.length ?? 0}
                  </div>
                  <div className="flex flex-col gap-2">
                    {filteredComments.map((row, i) => (
                      <div
                        key={`${row.postId}-${i}-${row.likes}`}
                        className="rounded-lg border border-white/8 bg-white/5 px-2.5 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/40">
                          <span
                            className={`rounded-full border px-1.5 py-px capitalize ${sentimentTone(row.sentiment).chip}`}
                          >
                            {row.sentiment}
                          </span>
                          <span>{compact(row.likes)} likes</span>
                          <span>{row.postLabel}</span>
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-white/80">
                          {row.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : selected.quote ? (
                <p className="mt-3 text-[13px] leading-relaxed text-white/75">
                  “{selected.quote}”
                </p>
              ) : null}
              {selected.url ? (
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-[12px] text-white/70 underline decoration-white/20 underline-offset-2 hover:text-white"
                >
                  Open on Instagram
                </a>
              ) : null}
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </main>
  );
}
