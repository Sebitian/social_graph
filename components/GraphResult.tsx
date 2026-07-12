"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CreditCard,
  FlaskConical,
  Pin,
  ShieldAlert,
} from "lucide-react";
import type { Circle, GraphNode, ScrapeResult } from "@/lib/types";
import PersonPanel from "@/components/PersonPanel";
import GraphVisualizer from "@/components/GraphVisualizer";
import { GraphHowToRead } from "@/components/GraphHowToRead";
import NetworkStats from "@/components/NetworkStats";
import ShareCard from "@/components/ShareCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import { SELF_COLOR, PROXIMITY_RINGS, UNCLUSTERED_COLOR } from "@/lib/graphUtils";
import type { ScrapeBudget } from "@/lib/scrapeBudget";
import {
  estimateScrapeBudget,
  formatUsd,
  budgetCacheSuffix,
  SCRAPE_BUDGET_LIMITS,
} from "@/lib/scrapeBudget";

const SEARCHED_HANDLES_KEY = "netgraph.searchedHandles";
const SCRAPE_RESULT_CACHE_PREFIX = "netgraph.scrapeResult.v2";
const SCRAPE_RESULT_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

type StoredScrapeResult = {
  savedAt: number;
  value: ScrapeResult;
};

function readSearchedHandles(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEARCHED_HANDLES_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function rememberSearchedHandle(handle: string) {
  const handles = readSearchedHandles();
  if (handles.includes(handle)) return;
  localStorage.setItem(
    SEARCHED_HANDLES_KEY,
    JSON.stringify([...handles, handle].slice(-50)),
  );
}

function scrapeResultCacheKey(handle: string, budget: ScrapeBudget) {
  return `${SCRAPE_RESULT_CACHE_PREFIX}:${handle}:${budgetCacheSuffix(budget)}`;
}

function readCachedScrapeResult(
  handle: string,
  budget: ScrapeBudget,
): ScrapeResult | null {
  try {
    const raw = localStorage.getItem(scrapeResultCacheKey(handle, budget));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredScrapeResult>;
    if (!parsed.savedAt || !parsed.value) return null;
    if (Date.now() - parsed.savedAt > SCRAPE_RESULT_CACHE_TTL_MS) {
      localStorage.removeItem(scrapeResultCacheKey(handle, budget));
      return null;
    }

    return { ...parsed.value, cached: true };
  } catch {
    return null;
  }
}

function rememberScrapeResult(
  handle: string,
  budget: ScrapeBudget,
  value: ScrapeResult,
) {
  try {
    const stored: StoredScrapeResult = {
      savedAt: Date.now(),
      value,
    };
    localStorage.setItem(scrapeResultCacheKey(handle, budget), JSON.stringify(stored));
  } catch {
    // Storage may be full or unavailable; the server cache still protects scrapes.
  }
}

interface Props {
  handle: string;
  initialBudget?: Partial<ScrapeBudget>;
  /** Load a frozen snapshot from data/snapshots — never calls Apify. */
  pinned?: boolean;
}

export default function GraphResult({
  handle,
  initialBudget = {},
  pinned = false,
}: Props) {
  const [data, setData] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [confirmationState, setConfirmationState] = useState<
    "checking" | "required" | "confirmed"
  >(pinned ? "confirmed" : "checking");
  const [profileLimitHit, setProfileLimitHit] = useState(false);
  const [searchedCount, setSearchedCount] = useState(0);
  const [pinStatus, setPinStatus] = useState<string | null>(null);
  const [pinning, setPinning] = useState(false);
  const graphWrapRef = useRef<HTMLDivElement>(null);
  const requestedBudget = useMemo(
    () => estimateScrapeBudget(initialBudget),
    [initialBudget],
  );

  const circleById = useMemo(() => {
    const m = new Map<number, Circle>();
    for (const c of data?.graph.circles ?? []) m.set(c.id, c);
    return m;
  }, [data]);

  const nodeByUsername = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const node of data?.graph.nodes ?? []) {
      if (node.group === "member") m.set(node.label.toLowerCase(), node);
    }
    return m;
  }, [data]);

  const selectMemberByUsername = useCallback(
    (username: string) => {
      const node = nodeByUsername.get(username.toLowerCase());
      if (node) setSelected(node);
    },
    [nodeByUsername],
  );

  useEffect(() => {
    if (pinned) return;
    let cancelled = false;
    const searchedHandles = readSearchedHandles();
    const isNewProfile = !searchedHandles.includes(handle);
    const overFreeProfileLimit =
      isNewProfile &&
      searchedHandles.length >= SCRAPE_BUDGET_LIMITS.profileFreeLimit;
    const cachedResult = readCachedScrapeResult(handle, requestedBudget);

    queueMicrotask(() => {
      if (cancelled) return;
      setData(cachedResult);
      setError(null);
      setSelected(null);
      setProfileLimitHit(overFreeProfileLimit);
      setSearchedCount(searchedHandles.length);
      setConfirmationState(
        cachedResult ||
          !(requestedBudget.needsPaymentPrompt || overFreeProfileLimit)
          ? "confirmed"
          : "required",
      );
    });
    return () => {
      cancelled = true;
    };
  }, [
    handle,
    requestedBudget,
    pinned,
  ]);

  useEffect(() => {
    if (!pinned && confirmationState !== "confirmed") return;
    if (pinned && confirmationState !== "confirmed") return;
    if (!pinned && data) return;
    if (pinned && data) return;

    let cancelled = false;
    const params = new URLSearchParams({ handle });
    if (pinned) {
      params.set("pinned", "1");
    } else {
      params.set("posts", String(requestedBudget.postLimit));
      params.set("comments", String(requestedBudget.commentsPerPost));
      params.set("reciprocity", requestedBudget.reciprocityEnabled ? "1" : "0");
      params.set("reciprocityFriends", String(requestedBudget.reciprocityFriends));
      params.set("reciprocityPosts", String(requestedBudget.reciprocityPostsPerFriend));
    }

    fetch(`/api/scrape?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Something went wrong");
        return json as ScrapeResult;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          if (!pinned) {
            rememberScrapeResult(handle, requestedBudget, json);
            rememberSearchedHandle(handle);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [
    confirmationState,
    data,
    handle,
    pinned,
    requestedBudget,
  ]);

  const pinCurrentRun = useCallback(async () => {
    if (!data || pinning) return;
    setPinning(true);
    setPinStatus(null);
    try {
      const res = await fetch("/api/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not pin snapshot");
      setPinStatus(json.url as string);
    } catch (err) {
      setPinStatus(err instanceof Error ? err.message : "Pin failed");
    } finally {
      setPinning(false);
    }
  }, [data, pinning]);

  const downloadSnapshotJson = useCallback(() => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `${handle}-snapshot.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [data, handle]);

  const downloadPng = useCallback(() => {
    const canvas = graphWrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${handle}-network.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [handle]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle className="h-10 w-10 text-ig-orange" />
        <h2 className="text-xl font-semibold text-white">
          Couldn&apos;t map @{handle}
        </h2>
        <p className="max-w-sm text-sm text-white/50">{error}</p>
        <Link
          href="/"
          className="mt-2 rounded-xl bg-ig-gradient px-5 py-2.5 text-sm font-semibold text-white"
        >
          Try another handle
        </Link>
      </div>
    );
  }

  if (confirmationState === "required") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-ig-orange/15 text-ig-orange">
            <CreditCard className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white">
            Confirm this scrape for @{handle}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/50">
            This pass is UI-only for payments, but the scrape will still be
            capped before it reaches Apify.
          </p>

          <div className="mt-5 grid gap-3 text-left sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs uppercase tracking-wide text-white/35">
                Requested depth
              </div>
              <div className="mt-2 font-mono text-lg font-semibold text-white">
                {requestedBudget.postLimit} x {requestedBudget.commentsPerPost}
              </div>
              <div className="text-xs text-white/45">
                Up to {requestedBudget.maxComments} comments
                {requestedBudget.reciprocityEnabled && (
                  <>
                    {" "}
                    (incl. {requestedBudget.maxReciprocityComments} reciprocity)
                  </>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs uppercase tracking-wide text-white/35">
                Max estimate
              </div>
              <div className="mt-2 font-mono text-lg font-semibold text-white">
                {requestedBudget.withinFreeTier
                  ? "Free"
                  : formatUsd(requestedBudget.estimatedCostUsd)}
              </div>
              <div className="text-xs text-white/45">
                Actual cost may be lower
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 text-left">
            {requestedBudget.reciprocityEnabled && (
              <div className="flex gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/55">
                Reciprocity pass: top {requestedBudget.reciprocityFriends} friends ×{" "}
                {requestedBudget.reciprocityPostsPerFriend} posts each (public accounts only).
              </div>
            )}
            {requestedBudget.needsPaymentPrompt && (
              <div className="flex gap-2 rounded-xl border border-ig-orange/20 bg-ig-orange/10 px-3 py-2 text-xs text-ig-orange">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Above the free {SCRAPE_BUDGET_LIMITS.freePosts} posts x{" "}
                {SCRAPE_BUDGET_LIMITS.freeCommentsPerPost} comments tier.
              </div>
            )}
            {profileLimitHit && (
              <div className="flex gap-2 rounded-xl border border-ig-orange/20 bg-ig-orange/10 px-3 py-2 text-xs text-ig-orange">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                This browser has already searched {searchedCount} profiles;
                free usage is capped at {SCRAPE_BUDGET_LIMITS.profileFreeLimit}.
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => setConfirmationState("confirmed")}
              className="rounded-xl bg-ig-gradient px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Continue anyway
            </button>
            <Link
              href="/"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/75 transition hover:bg-white/10"
            >
              Adjust limits
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner handle={handle} />
      </div>
    );
  }

  return (
    <main className="relative min-h-screen bg-background bg-grid">
      {/* Top bar */}
      <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-5 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 backdrop-blur transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" /> New search
        </Link>
        {data.pinned && (
          <span className="flex items-center gap-1.5 rounded-full border border-ig-blue/30 bg-ig-blue/10 px-3 py-1.5 text-xs text-ig-blue backdrop-blur">
            <Pin className="h-3.5 w-3.5" /> Pinned snapshot
          </span>
        )}
        {data.demo && (
          <span className="flex items-center gap-1.5 rounded-full border border-ig-orange/30 bg-ig-orange/10 px-3 py-1.5 text-xs text-ig-orange backdrop-blur">
            <FlaskConical className="h-3.5 w-3.5" /> Demo data
          </span>
        )}
        {data.cached && !data.demo && !data.pinned && (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 backdrop-blur">
            Cached result
          </span>
        )}
      </header>

      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-4 px-4 pb-6 pt-20 lg:grid-cols-[1fr_340px]">
        {/* Graph */}
        <div className="relative min-h-[420px]">
          <motion.div
            ref={graphWrapRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="relative flex min-h-[420px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-black/20"
          >
            <GraphHowToRead className="shrink-0" />

            <div className="relative min-h-[320px] flex-1">
              <GraphVisualizer
                data={data.graph}
                className="absolute inset-0"
                selectedId={selected?.id ?? null}
                onSelect={setSelected}
              />

              <div className="pointer-events-none absolute bottom-4 right-4 flex max-w-[260px] flex-col gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                  Node color
                </div>
                <span className="flex items-center gap-1.5 text-xs text-white/60">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: SELF_COLOR }}
                  />
                  You
                </span>
                {data.graph.circles.map((cluster) => (
                  <span
                    key={cluster.id}
                    className="flex items-start gap-1.5 text-xs text-white/55"
                  >
                    <span
                      className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/10"
                      style={{ backgroundColor: cluster.color }}
                    />
                    <span>
                      <span className="text-white/70">{cluster.label}</span>
                      {cluster.size > 0 ? ` (${cluster.size})` : ""}
                      {cluster.subtitle ? (
                        <span className="mt-0.5 block text-[10px] leading-snug text-white/35">
                          {cluster.subtitle}
                        </span>
                      ) : null}
                    </span>
                  </span>
                ))}
                <span className="flex items-start gap-1.5 text-xs text-white/55">
                  <span
                    className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/10"
                    style={{ backgroundColor: UNCLUSTERED_COLOR }}
                  />
                  <span>
                    <span className="text-white/70">Everyone else</span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-white/35">
                      No strong overlap with other commenters yet
                    </span>
                  </span>
                </span>
              </div>
            </div>
          </motion.div>

          <PersonPanel
            node={selected}
            proximityRing={
              selected && selected.circle >= 0
                ? PROXIMITY_RINGS[selected.circle]
                : undefined
            }
            friendCluster={
              selected && selected.clusterId != null && selected.clusterId >= 0
                ? circleById.get(selected.clusterId)
                : undefined
            }
            onClose={() => setSelected(null)}
          />
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">@{data.profile.username}</h1>
              {data.profile.isVerified && (
                <BadgeCheck className="h-5 w-5 text-ig-blue" />
              )}
            </div>
            {data.profile.fullName && (
              <div className="text-sm text-white/60">{data.profile.fullName}</div>
            )}
            {data.profile.biography && (
              <p className="mt-2 text-sm text-white/40">{data.profile.biography}</p>
            )}
            <div className="mt-3 text-xs text-white/30">
              Top {data.stats.shown} connections · closer = more present · color = same-post groups
            </div>
          </div>

          <NetworkStats
            stats={data.stats}
            onSelectUsername={selectMemberByUsername}
            selectedUsername={selected?.label ?? null}
          />
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/80">
              <ShieldAlert className="h-4 w-4 text-ig-orange" /> Scrape budget
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-black/25 p-3">
                <div className="text-xs text-white/35">Your posts</div>
                <div className="mt-1 font-mono text-white">
                  {data.budget.postLimit} x {data.budget.commentsPerPost}
                </div>
              </div>
              <div className="rounded-xl bg-black/25 p-3">
                <div className="text-xs text-white/35">Reciprocity</div>
                <div className="mt-1 font-mono text-white">
                  {data.budget.reciprocityEnabled
                    ? `${data.budget.reciprocityFriends} x ${data.budget.reciprocityPostsPerFriend}`
                    : "Off"}
                </div>
              </div>
              <div className="rounded-xl bg-black/25 p-3">
                <div className="text-xs text-white/35">Max estimate</div>
                <div className="mt-1 font-mono text-white">
                  {data.budget.withinFreeTier
                    ? "Free"
                    : formatUsd(data.budget.estimatedCostUsd)}
                </div>
              </div>
              <div className="rounded-xl bg-black/25 p-3">
                <div className="text-xs text-white/35">Comment cap</div>
                <div className="mt-1 font-mono text-white">{data.budget.maxComments}</div>
              </div>
            </div>
            <p className="mt-3 text-xs text-white/40">
              Server cap: up to {data.budget.maxComments} comments scanned
              {data.budget.reciprocityEnabled
                ? ` (your posts + friends' posts for two-way signals).`
                : "."}{" "}
              Actual Apify cost may be lower when fewer comments are returned.
            </p>
          </div>

          {!pinned && !data.demo && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/80">
                <Pin className="h-4 w-4 text-ig-blue" /> Save this run
              </div>
              <p className="text-xs leading-relaxed text-white/45">
                Pin the graph you&apos;re viewing so anyone can open a share link
                without spending Apify credits again.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={pinCurrentRun}
                  disabled={pinning}
                  className="rounded-xl bg-ig-gradient px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {pinning ? "Saving…" : "Pin for share link"}
                </button>
                <button
                  type="button"
                  onClick={downloadSnapshotJson}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10"
                >
                  Download JSON backup
                </button>
              </div>
              {pinStatus && (
                <p className="mt-2 break-all text-xs text-white/55">
                  {pinStatus.startsWith("http") ? (
                    <>
                      Share:{" "}
                      <Link
                        href={`/graph/${handle}/pinned`}
                        className="text-ig-blue underline"
                      >
                        /graph/{handle}/pinned
                      </Link>
                    </>
                  ) : (
                    pinStatus
                  )}
                </p>
              )}
            </div>
          )}

          {pinned && data.scrapedAt > 0 && (
            <p className="rounded-2xl border border-ig-blue/20 bg-ig-blue/5 px-4 py-3 text-xs text-white/55">
              Frozen snapshot from{" "}
              {new Date(data.scrapedAt).toLocaleString()}. No live scrape runs on this page.
            </p>
          )}

          <ShareCard handle={handle} stats={data.stats} onDownload={downloadPng} />
        </aside>
      </div>
    </main>
  );
}
