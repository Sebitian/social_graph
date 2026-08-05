"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  CreditCard,
  FlaskConical,
  Grid3X3,
  HelpCircle,
  List,
  Maximize2,
  Pin,
  ShieldAlert,
  User,
  X,
} from "lucide-react";
import type { Circle, GraphNode, ScrapeResult } from "@/lib/types";
import type {
  SpotifyGraphNode,
  SpotifyTasteResult,
} from "@/lib/spotifyTypes";
import type {
  CompanyEmployee,
  CompanyGraphNode,
  CompanyResult,
} from "@/lib/companyTypes";
import PersonPanel from "@/components/PersonPanel";
import GraphVisualizer from "@/components/GraphVisualizer";
import SpotifyGraphVisualizer from "@/components/SpotifyGraphVisualizer";
import CompanyGraphVisualizer from "@/components/CompanyGraphVisualizer";
import CompanyRosterTable from "@/components/CompanyRosterTable";
import SpotifyPlaylistPanel from "@/components/SpotifyPlaylistPanel";
import CompanyEmployeePanel from "@/components/CompanyEmployeePanel";
import SpotifyNetworkStats from "@/components/SpotifyNetworkStats";
import CompanyNetworkStats from "@/components/CompanyNetworkStats";
import EngagementGrid from "@/components/EngagementGrid";
import GraphNodeSearch from "@/components/GraphNodeSearch";
import {
  GraphHowToRead,
  reopenGraphHowToRead,
} from "@/components/GraphHowToRead";
import NetworkStats from "@/components/NetworkStats";
import ShareCard from "@/components/ShareCard";
import GraphFooterTabs, { type FooterTab } from "@/components/GraphFooterTabs";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  InstagramIcon,
  LinkedInIcon,
  SpotifyIcon,
  CompanyIcon,
} from "@/components/PlatformIcons";
import { SELF_COLOR, PROXIMITY_RINGS, UNCLUSTERED_COLOR } from "@/lib/graphUtils";
import type { ScrapeBudget } from "@/lib/scrapeBudget";
import {
  estimateScrapeBudget,
  formatUsd,
  budgetCacheSuffix,
  SCRAPE_BUDGET_LIMITS,
} from "@/lib/scrapeBudget";

type GraphPlatform = "linkedin" | "instagram" | "spotify";
type LinkedInMode = "person" | "company";
type GraphView = "map" | "roster";
type StatsView = "summary" | "grid";
type SocialPlatform = "linkedin" | "instagram";

const PLATFORM_LABEL: Record<GraphPlatform, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  spotify: "Spotify",
};

const TOOLBAR_TAB =
  "inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium transition";
const TOOLBAR_TAB_ACTIVE = "bg-white/15 text-white";
const TOOLBAR_TAB_AVAILABLE = "text-white/55 hover:bg-white/10 hover:text-white/80";
const TOOLBAR_TAB_DISABLED = "text-white/30 hover:bg-white/5 hover:text-white/45";
const LINKEDIN_TAB_ACTIVE = "bg-[#0A66C2]/25 text-white";

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
  /** Server-loaded snapshot — skips the client scrape fetch when present. */
  initialData?: ScrapeResult | null;
  /** Extra platform snapshots for the LinkedIn / Instagram switcher. */
  initialPlatformData?: Partial<Record<SocialPlatform, ScrapeResult>>;
  /** Spotify taste snapshot (profile → playlists → genres). */
  spotifyData?: SpotifyTasteResult | null;
  /** LinkedIn company employee snapshot. */
  companyData?: CompanyResult | null;
  /** Load a frozen snapshot from data/snapshots — never calls Apify. */
  pinned?: boolean;
}

function platformOfResult(result: ScrapeResult): SocialPlatform {
  return result.posts?.length ? "linkedin" : "instagram";
}

export default function GraphResult({
  handle,
  initialBudget = {},
  initialData = null,
  initialPlatformData = {},
  spotifyData = null,
  companyData = null,
  pinned = false,
}: Props) {
  const [data, setData] = useState<ScrapeResult | null>(initialData);
  const [extraSocialData, setExtraSocialData] = useState<
    Partial<Record<SocialPlatform, ScrapeResult>>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [spotifySelected, setSpotifySelected] =
    useState<SpotifyGraphNode | null>(null);
  const [spotifyResult, setSpotifyResult] =
    useState<SpotifyTasteResult | null>(spotifyData);
  const [companyResult, setCompanyResult] =
    useState<CompanyResult | null>(companyData);
  const [companySelected, setCompanySelected] =
    useState<CompanyEmployee | null>(null);
  const [confirmationState, setConfirmationState] = useState<
    "checking" | "required" | "confirmed"
  >(pinned ? "confirmed" : "checking");
  const [profileLimitHit, setProfileLimitHit] = useState(false);
  const [searchedCount, setSearchedCount] = useState(0);
  const [pinStatus, setPinStatus] = useState<string | null>(null);
  const [pinning, setPinning] = useState(false);
  const [view, setView] = useState<GraphView>("map");
  const [statsView, setStatsView] = useState<StatsView>("summary");
  const [footerTab, setFooterTab] = useState<FooterTab>("map");
  const [howToOpen, setHowToOpen] = useState(false);
  const [graphFullscreen, setGraphFullscreen] = useState(false);
  const [linkedinMode, setLinkedinMode] = useState<LinkedInMode>(() =>
    !initialPlatformData.linkedin && companyData ? "company" : "person",
  );
  const [platform, setPlatform] = useState<GraphPlatform>(() => {
    if (pinned) {
      if (initialPlatformData.linkedin) return "linkedin";
      if (initialData && initialData.posts?.length) return "linkedin";
      if (initialPlatformData.instagram) return "instagram";
      if (initialData) return "instagram";
      if (spotifyResult) return "spotify";
      if (companyResult) return "linkedin";
      return "linkedin";
    }
    // Search flow: the search is Instagram-handle shaped, default to Instagram.
    if (initialPlatformData.instagram) return "instagram";
    if (initialData && initialData.posts?.length) return "linkedin";
    if (initialData) return "instagram";
    if (initialPlatformData.linkedin) return "linkedin";
    if (spotifyResult) return "spotify";
    return "instagram";
  });
  const graphWrapRef = useRef<HTMLDivElement>(null);
  const graphSectionRef = useRef<HTMLDivElement>(null);
  const footerPanelRef = useRef<HTMLDivElement>(null);
  const mobileTabPanelRef = useRef<HTMLDivElement>(null);
  const requestedBudget = useMemo(
    () => estimateScrapeBudget(initialBudget),
    [initialBudget],
  );

  const selectFooterTab = useCallback((tab: FooterTab) => {
    setFooterTab(tab);
    requestAnimationFrame(() => {
      const target =
        tab === "map"
          ? graphSectionRef.current
          : mobileTabPanelRef.current ?? footerPanelRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    if (!selected && !companySelected && !spotifySelected) return;
    if (footerTab === "stats" && statsView === "grid") {
      requestAnimationFrame(() => {
        mobileTabPanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
      return;
    }
    setFooterTab("map");
    requestAnimationFrame(() => {
      footerPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [selected?.id, companySelected?.id, spotifySelected?.id, footerTab, statsView]);

  useEffect(() => {
    if (!graphFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [graphFullscreen]);

  useEffect(() => {
    if (!graphFullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGraphFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [graphFullscreen]);

  const platformResults = useMemo(() => {
    const map: Partial<Record<SocialPlatform, ScrapeResult>> = {
      ...initialPlatformData,
      ...extraSocialData,
    };
    if (data) {
      const key = platformOfResult(data);
      map[key] ??= data;
    }
    return map;
  }, [data, extraSocialData, initialPlatformData]);

  const activeData =
    platform === "spotify" ||
    (platform === "linkedin" && linkedinMode === "company")
      ? null
      : (platformResults[platform] ?? null);
  const hasSpotify = Boolean(spotifyData || spotifyResult);
  const hasCompany = Boolean(companyData || companyResult);
  const hasLinkedInPerson = Boolean(platformResults.linkedin);
  const hasLinkedIn = hasLinkedInPerson || hasCompany;
  const isLinkedInCompany =
    platform === "linkedin" && linkedinMode === "company";
  const platformHasData =
    platform === "spotify"
      ? hasSpotify
      : platform === "linkedin"
        ? isLinkedInCompany
          ? hasCompany
          : hasLinkedInPerson
        : Boolean(activeData);
  const showSocialViews =
    platformHasData &&
    ((platform === "linkedin" && linkedinMode === "person") ||
      platform === "instagram");
  const showCompanyViews = platformHasData && isLinkedInCompany;
  const showGridToggle = Boolean(
    showSocialViews && activeData?.posts && activeData.posts.length > 0,
  );
  const showGridInDesktop =
    statsView === "grid" &&
    showGridToggle &&
    Boolean(activeData?.posts?.length);

  const circleById = useMemo(() => {
    const m = new Map<number, Circle>();
    for (const c of activeData?.graph.circles ?? []) m.set(c.id, c);
    return m;
  }, [activeData]);

  const nodeByUsername = useMemo(() => {
    const m = new Map<string, GraphNode>();
    const pool = [
      ...(activeData?.engagers ?? []),
      ...(activeData?.graph.nodes ?? []),
    ];
    for (const node of pool) {
      if (node.group !== "member") continue;
      m.set(node.id.toLowerCase(), node);
      m.set(node.label.toLowerCase(), node);
    }
    return m;
  }, [activeData]);

  const gridNodes = useMemo(() => {
    if (activeData?.engagers && activeData.engagers.length > 0) {
      return activeData.engagers;
    }
    return activeData?.graph.nodes ?? [];
  }, [activeData]);

  const selectMemberByUsername = useCallback(
    (username: string) => {
      const key = username.trim().toLowerCase();
      const node = nodeByUsername.get(key);
      if (node) setSelected(node);
    },
    [nodeByUsername],
  );

  useEffect(() => {
    if (!showGridToggle && statsView === "grid") setStatsView("summary");
  }, [showGridToggle, statsView]);

  useEffect(() => {
    if (platform !== "linkedin" || linkedinMode !== "company") {
      if (view === "roster") setView("map");
    }
  }, [platform, linkedinMode, view]);

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
      setExtraSocialData({});
      setSpotifyResult(spotifyData);
      setCompanyResult(companyData);
      setError(null);
      setSelected(null);
      setCompanySelected(null);
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
    spotifyData,
    companyData,
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

  // Search flow: also load LinkedIn and Spotify demo data so all platform tabs work.
  useEffect(() => {
    if (pinned) return;
    if (confirmationState !== "confirmed") return;

    let cancelled = false;

    if (!extraSocialData.linkedin && !initialPlatformData.linkedin) {
      const params = new URLSearchParams({ handle, platform: "linkedin" });
      params.set("posts", String(requestedBudget.postLimit));
      params.set("comments", String(requestedBudget.commentsPerPost));
      params.set("reciprocity", requestedBudget.reciprocityEnabled ? "1" : "0");
      params.set("reciprocityFriends", String(requestedBudget.reciprocityFriends));
      params.set("reciprocityPosts", String(requestedBudget.reciprocityPostsPerFriend));

      fetch(`/api/scrape?${params.toString()}`)
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "LinkedIn demo failed");
          return json as ScrapeResult;
        })
        .then((json) => {
          if (!cancelled) {
            setExtraSocialData((prev) => ({ ...prev, linkedin: json }));
          }
        })
        .catch((err) => {
          // Keep the main flow working even if the LinkedIn demo fetch fails.
          console.error("LinkedIn demo fetch failed", err);
        });
    }

    if (!spotifyResult && !spotifyData) {
      fetch(`/api/spotify?handle=${encodeURIComponent(handle)}`)
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Spotify demo failed");
          return json as SpotifyTasteResult;
        })
        .then((json) => {
          if (!cancelled) setSpotifyResult(json);
        })
        .catch((err) => {
          console.error("Spotify demo fetch failed", err);
        });
    }

    if (!companyResult && !companyData) {
      fetch(`/api/company?handle=${encodeURIComponent("nousresearch")}`)
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Company demo failed");
          return json as CompanyResult;
        })
        .then((json) => {
          if (!cancelled) setCompanyResult(json);
        })
        .catch((err) => {
          console.error("Company demo fetch failed", err);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [
    confirmationState,
    extraSocialData.linkedin,
    handle,
    initialPlatformData.linkedin,
    pinned,
    requestedBudget,
    spotifyData,
    spotifyResult,
    companyData,
    companyResult,
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

  if (
    !data &&
    Object.keys(platformResults).length === 0 &&
    !spotifyResult &&
    !companyResult
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner handle={handle} />
      </div>
    );
  }

  const displayData = activeData ?? data;
  const showPinnedBadge =
    Boolean(displayData?.pinned) ||
    (platform === "spotify" && Boolean(spotifyResult?.pinned)) ||
    (isLinkedInCompany && Boolean(companyResult?.pinned));
  const showDemoBadge =
    Boolean(displayData?.demo) ||
    (platform === "spotify" && Boolean(spotifyResult?.demo)) ||
    (isLinkedInCompany && Boolean(companyResult?.demo));
  const showCachedBadge =
    (Boolean(displayData?.cached) &&
      !displayData?.demo &&
      !displayData?.pinned) ||
    (platform === "spotify" &&
      Boolean(spotifyResult?.cached) &&
      !spotifyResult?.demo &&
      !spotifyResult?.pinned) ||
    (isLinkedInCompany &&
      Boolean(companyResult?.cached) &&
      !companyResult?.demo &&
      !companyResult?.pinned);

  return (
    <main className="relative min-h-[100dvh] bg-background bg-grid">
      {/* Top bar */}
      <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:pt-4">
        <Link
          href="/"
          className="flex min-h-[40px] items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 backdrop-blur transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="sm:hidden">Back</span>
          <span className="hidden sm:inline">New search</span>
        </Link>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          {platform !== "spotify" && !isLinkedInCompany && (
            <button
              type="button"
              onClick={() => {
                reopenGraphHowToRead();
                setHowToOpen(true);
              }}
              aria-label="How to read this graph"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/55 backdrop-blur transition hover:bg-white/10 hover:text-white/80 sm:hidden"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          )}
          {showPinnedBadge && (
            <span className="flex items-center gap-1.5 rounded-full border border-ig-blue/30 bg-ig-blue/10 px-2.5 py-1.5 text-[11px] text-ig-blue backdrop-blur sm:px-3 sm:text-xs">
              <Pin className="h-3.5 w-3.5" />
              <span className="sm:hidden">Pinned</span>
              <span className="hidden sm:inline">Pinned snapshot</span>
            </span>
          )}
          {showDemoBadge && (
            <span className="flex items-center gap-1.5 rounded-full border border-ig-orange/30 bg-ig-orange/10 px-2.5 py-1.5 text-[11px] text-ig-orange backdrop-blur sm:px-3 sm:text-xs">
              <FlaskConical className="h-3.5 w-3.5" /> Demo
            </span>
          )}
          {showCachedBadge && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-white/50 backdrop-blur sm:px-3 sm:text-xs">
              Cached
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-1.5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[calc(3.25rem+env(safe-area-inset-top))] sm:px-4 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pt-20 lg:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {platform !== "spotify" && !isLinkedInCompany && (
          <GraphHowToRead
            forceOpen={howToOpen}
            onDismiss={() => setHowToOpen(false)}
          />
        )}

        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:min-h-0 lg:grid-cols-[1fr_340px]">
        {/* Graph + top engagers */}
        <div className="flex flex-col gap-3 sm:gap-4 lg:min-h-0">
        <div
          ref={graphSectionRef}
          className={`scroll-mt-[calc(3.25rem+env(safe-area-inset-top))] relative flex flex-col ${
            footerTab !== "map" ? "hidden lg:flex" : ""
          } ${
            showGridInDesktop || view === "roster"
              ? "min-h-[min(78dvh,720px)]"
              : "h-[calc(100dvh-10rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-[320px] sm:min-h-[520px] lg:h-auto lg:min-h-[620px]"
          }`}
        >
          <motion.div
            ref={graphWrapRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className={`relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-black/50 to-black/70 ${
              graphFullscreen
                ? "fixed inset-0 z-50 h-[100dvh] min-h-[100dvh] rounded-none border-0"
                : `h-full rounded-xl border border-white/10 sm:min-h-[520px] sm:rounded-3xl lg:min-h-[620px] ${
                    showGridInDesktop || view === "roster"
                      ? "min-h-[min(78dvh,720px)]"
                      : ""
                  }`
            }`}
          >
            {/* Mobile: platform toggles above graph */}
            {!graphFullscreen ? (
            <div className="flex shrink-0 flex-col gap-1.5 border-b border-white/10 px-1.5 py-1.5 sm:hidden">
              <div className="inline-flex self-start rounded-lg border border-white/10 bg-black/30 p-0.5">
                {(
                  [
                    { id: "linkedin" as const, label: "LinkedIn", Icon: LinkedInIcon },
                    { id: "instagram" as const, label: "Instagram", Icon: InstagramIcon },
                    { id: "spotify" as const, label: "Spotify", Icon: SpotifyIcon },
                  ] as const
                ).map(({ id, label, Icon }) => {
                  const available =
                    id === "spotify"
                      ? hasSpotify
                      : id === "linkedin"
                        ? hasLinkedIn
                        : Boolean(platformResults[id]);
                  const active = platform === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      title={available ? label : `${label} snapshot not loaded yet`}
                      onClick={() => {
                        setPlatform(id);
                        setSelected(null);
                        setSpotifySelected(null);
                        setCompanySelected(null);
                        setView("map");
                        setStatsView("summary");
                        if (id === "linkedin") {
                          setLinkedinMode(hasLinkedInPerson ? "person" : "company");
                        }
                      }}
                      className={`${TOOLBAR_TAB} min-w-[40px] justify-center ${
                        active ? TOOLBAR_TAB_ACTIVE : available ? TOOLBAR_TAB_AVAILABLE : TOOLBAR_TAB_DISABLED
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                    </button>
                  );
                })}
              </div>
              {(platform === "linkedin" && hasLinkedIn) || showCompanyViews ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {platform === "linkedin" && hasLinkedIn && (
                    <div className="inline-flex rounded-lg border border-white/10 bg-black/30 p-0.5">
                      {(
                        [
                          { id: "person" as const, label: "Person", Icon: User, enabled: hasLinkedInPerson },
                          { id: "company" as const, label: "Company", Icon: CompanyIcon, enabled: hasCompany },
                        ] as const
                      ).map(({ id: modeId, label: modeLabel, Icon: ModeIcon, enabled }) => (
                        <button
                          key={modeId}
                          type="button"
                          title={enabled ? modeLabel : `${modeLabel} snapshot not loaded yet`}
                          onClick={() => {
                            if (!enabled) return;
                            setLinkedinMode(modeId);
                            setSelected(null);
                            setCompanySelected(null);
                            setView("map");
                            setStatsView("summary");
                          }}
                          className={`${TOOLBAR_TAB} ${
                            linkedinMode === modeId
                              ? LINKEDIN_TAB_ACTIVE
                              : enabled ? TOOLBAR_TAB_AVAILABLE : TOOLBAR_TAB_DISABLED
                          }`}
                        >
                          <ModeIcon className="h-3.5 w-3.5 shrink-0" />
                          {modeLabel}
                        </button>
                      ))}
                    </div>
                  )}
                  {showCompanyViews && (
                    <div className="inline-flex rounded-lg border border-white/10 bg-black/30 p-0.5">
                      <button
                        type="button"
                        onClick={() => setView(view === "roster" ? "map" : "roster")}
                        className={`${TOOLBAR_TAB} ${
                          view === "roster" ? TOOLBAR_TAB_ACTIVE : TOOLBAR_TAB_AVAILABLE
                        }`}
                      >
                        <List className="h-3.5 w-3.5" />
                        Roster
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            ) : null}

            <div className="hidden shrink-0 flex-col gap-2 border-b border-white/10 px-3 py-2 sm:flex">
              <div className="flex items-center gap-2">
                <div className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-white/35">
                  Platform
                </div>
                <div className="inline-flex rounded-lg border border-white/10 bg-black/30 p-0.5">
                  {(
                    [
                      { id: "linkedin" as const, label: "LinkedIn", Icon: LinkedInIcon },
                      { id: "instagram" as const, label: "Instagram", Icon: InstagramIcon },
                      { id: "spotify" as const, label: "Spotify", Icon: SpotifyIcon },
                    ] as const
                  ).map(({ id, label, Icon }) => {
                    const available =
                      id === "spotify"
                        ? hasSpotify
                        : id === "linkedin"
                          ? hasLinkedIn
                          : Boolean(platformResults[id]);
                    const active = platform === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        title={available ? label : `${label} snapshot not loaded yet`}
                        onClick={() => {
                          setPlatform(id);
                          setSelected(null);
                          setSpotifySelected(null);
                          setCompanySelected(null);
                          setView("map");
                          setStatsView("summary");
                          if (id === "linkedin") {
                            setLinkedinMode(hasLinkedInPerson ? "person" : "company");
                          }
                        }}
                        className={`${TOOLBAR_TAB} ${
                          active ? TOOLBAR_TAB_ACTIVE : available ? TOOLBAR_TAB_AVAILABLE : TOOLBAR_TAB_DISABLED
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {(platform === "linkedin" && hasLinkedIn) || showCompanyViews ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {platform === "linkedin" && hasLinkedIn && (
                    <div className="flex items-center gap-2">
                      <div className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-white/35">
                        LinkedIn
                      </div>
                      <div className="inline-flex rounded-lg border border-white/10 bg-black/30 p-0.5">
                        {(
                          [
                            { id: "person" as const, label: "Person", Icon: User, enabled: hasLinkedInPerson },
                            { id: "company" as const, label: "Company", Icon: CompanyIcon, enabled: hasCompany },
                          ] as const
                        ).map(({ id: modeId, label: modeLabel, Icon: ModeIcon, enabled }) => (
                          <button
                            key={modeId}
                            type="button"
                            title={enabled ? modeLabel : `${modeLabel} snapshot not loaded yet`}
                            onClick={() => {
                              if (!enabled) return;
                              setLinkedinMode(modeId);
                              setSelected(null);
                              setCompanySelected(null);
                              setView("map");
                              setStatsView("summary");
                            }}
                            className={`${TOOLBAR_TAB} ${
                              linkedinMode === modeId
                                ? LINKEDIN_TAB_ACTIVE
                                : enabled ? TOOLBAR_TAB_AVAILABLE : TOOLBAR_TAB_DISABLED
                            }`}
                          >
                            <ModeIcon className="h-3.5 w-3.5 shrink-0" />
                            <span>{modeLabel}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {showCompanyViews && (
                    <div className="flex items-center gap-2">
                      <div className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-white/35">
                        View
                      </div>
                      <div className="inline-flex rounded-lg border border-white/10 bg-black/30 p-0.5">
                        <button
                          type="button"
                          onClick={() => setView(view === "roster" ? "map" : "roster")}
                          className={`${TOOLBAR_TAB} ${
                            view === "roster" ? TOOLBAR_TAB_ACTIVE : TOOLBAR_TAB_AVAILABLE
                          }`}
                        >
                          <List className="h-3.5 w-3.5" />
                          Roster
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="relative min-h-[260px] flex-1 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.04)_0%,transparent_55%)]">
              <button
                type="button"
                onClick={() =>
                  graphFullscreen
                    ? setGraphFullscreen(false)
                    : setGraphFullscreen(true)
                }
                aria-label={graphFullscreen ? "Exit full screen" : "Full screen"}
                className={`absolute z-30 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/75 text-white/75 shadow-lg backdrop-blur transition hover:bg-black/90 hover:text-white active:scale-95 ${
                  graphFullscreen
                    ? "right-3 top-[max(0.75rem,env(safe-area-inset-top))]"
                    : "right-2 top-2 sm:right-3 sm:top-3"
                }`}
              >
                {graphFullscreen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>

              {isLinkedInCompany ? (
                companyResult ? (
                  view === "roster" ? (
                    <CompanyRosterTable
                      employees={companyResult.employees}
                      selectedId={companySelected?.id ?? null}
                      onSelect={setCompanySelected}
                      className="absolute inset-0"
                    />
                  ) : (
                    <>
                      <CompanyGraphVisualizer
                        key={`company-${companyResult.company.id}`}
                        data={companyResult.graph}
                        className="absolute inset-0"
                        selectedId={companySelected?.id ?? null}
                        onSelect={(node: CompanyGraphNode | null) => {
                          if (!node || node.kind === "company") {
                            setCompanySelected(null);
                            return;
                          }
                          const emp = companyResult.employees.find(
                            (e) => e.id === node.id,
                          );
                          setCompanySelected(emp ?? null);
                        }}
                      />
                      <div className="pointer-events-none absolute bottom-4 right-4 hidden max-w-[200px] flex-col gap-1.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur sm:flex">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                          Flow
                        </div>
                        <span className="text-[10px] leading-relaxed text-white/50">
                          Company → employees (hub and spoke)
                        </span>
                      </div>
                    </>
                  )
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                    <CompanyIcon className="h-8 w-8 text-[#0A66C2]" />
                    <div className="text-sm font-medium text-white/80">
                      No company snapshot yet
                    </div>
                    <p className="max-w-sm text-xs leading-relaxed text-white/40">
                      Import a LinkedIn company employee export to unlock company
                      views here.
                    </p>
                  </div>
                )
              ) : platform === "spotify" ? (
                spotifyResult ? (
                  <>
                    <SpotifyGraphVisualizer
                      key={`spotify-${spotifyResult.profile.userId}`}
                      data={spotifyResult.graph}
                      className="absolute inset-0"
                      selectedId={spotifySelected?.id ?? null}
                      onSelect={setSpotifySelected}
                    />
                    <div className="pointer-events-none absolute bottom-4 right-4 hidden max-w-[200px] flex-col gap-1.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur sm:flex">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                        Flow
                      </div>
                      <span className="text-[10px] leading-relaxed text-white/50">
                        You → playlists → genres ← playlists ← friend
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                    <SpotifyIcon className="h-8 w-8 text-[#1DB954]" />
                    <div className="text-sm font-medium text-white/80">
                      No Spotify snapshot yet
                    </div>
                    <p className="max-w-sm text-xs leading-relaxed text-white/40">
                      Import a Spotify profile + playlist scrape to unlock taste
                      views here.
                    </p>
                  </div>
                )
              ) : !activeData ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                  {platform === "linkedin" ? (
                    <LinkedInIcon className="h-8 w-8 text-[#0A66C2]" />
                  ) : (
                    <InstagramIcon className="h-8 w-8 text-white/70" />
                  )}
                  <div className="text-sm font-medium text-white/80">
                    No {PLATFORM_LABEL[platform]}
                    {platform === "linkedin" && linkedinMode === "person"
                      ? " person"
                      : ""}{" "}
                    snapshot yet
                  </div>
                  <p className="max-w-sm text-xs leading-relaxed text-white/40">
                    Switch to a platform tab that has a loaded snapshot to explore
                    the graph.
                  </p>
                </div>
              ) : showGridInDesktop ? (
                <>
                  <EngagementGrid
                    posts={activeData.posts!}
                    nodes={gridNodes}
                    selectedId={selected?.id ?? null}
                    onSelect={setSelected}
                    className="absolute inset-0 hidden lg:block"
                  />
                  <div className="absolute inset-0 lg:hidden">
                    <GraphVisualizer
                      key={`graph-${platform}-${activeData.profile.username}`}
                      data={activeData.graph}
                      className="absolute inset-0 max-sm:touch-pan-y sm:touch-none"
                      selectedId={selected?.id ?? null}
                      onSelect={setSelected}
                      labelStyle={platform === "instagram" ? "handles" : "auto"}
                    />
                  </div>
                </>
              ) : (
                <>
                  <GraphVisualizer
                    key={`graph-${platform}-${activeData.profile.username}`}
                    data={activeData.graph}
                    className="absolute inset-0 max-sm:touch-pan-y sm:touch-none"
                    selectedId={selected?.id ?? null}
                    onSelect={setSelected}
                    labelStyle={platform === "instagram" ? "handles" : "auto"}
                  />

                  <div className="absolute left-1.5 right-12 top-1.5 z-20 sm:left-4 sm:right-auto sm:top-3 sm:w-[280px]">
                    <GraphNodeSearch
                      nodes={activeData.graph.nodes}
                      selectedId={selected?.id ?? null}
                      onSelect={setSelected}
                      platform={platform}
                    />
                  </div>

                  {/* Mobile: compact horizontal groups strip */}
                  <div className="pointer-events-none absolute inset-x-1.5 bottom-1.5 z-10 flex gap-1 overflow-x-auto rounded-md border border-white/10 bg-black/65 px-1.5 py-1 backdrop-blur sm:hidden">
                    <span className="flex shrink-0 items-center gap-1 text-[9px] text-white/65">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: SELF_COLOR }}
                      />
                      You
                    </span>
                    {activeData.graph.circles.map((cluster) => (
                      <span
                        key={cluster.id}
                        className="flex shrink-0 items-center gap-1 text-[10px] text-white/55"
                      >
                        <span
                          className="h-2 w-2 rounded-full ring-1 ring-white/10"
                          style={{ backgroundColor: cluster.color }}
                        />
                        <span className="max-w-[7rem] truncate text-white/70">
                          {cluster.label}
                        </span>
                      </span>
                    ))}
                    <span className="flex shrink-0 items-center gap-1 text-[10px] text-white/55">
                      <span
                        className="h-2 w-2 rounded-full ring-1 ring-white/10"
                        style={{ backgroundColor: UNCLUSTERED_COLOR }}
                      />
                      Else
                    </span>
                  </div>

                  {/* Desktop: stacked groups legend */}
                  <div className="pointer-events-none absolute bottom-4 right-4 hidden max-w-[220px] flex-col gap-1.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur sm:flex">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                      Groups
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-white/60">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: SELF_COLOR }}
                      />
                      You
                    </span>
                    {activeData.graph.circles.map((cluster) => (
                      <span
                        key={cluster.id}
                        className="flex items-center gap-1.5 text-xs text-white/55"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/10"
                          style={{ backgroundColor: cluster.color }}
                        />
                        <span className="truncate text-white/70">
                          {cluster.label}
                          {cluster.size > 0 ? ` (${cluster.size})` : ""}
                        </span>
                      </span>
                    ))}
                    <span className="flex items-center gap-1.5 text-xs text-white/55">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/10"
                        style={{ backgroundColor: UNCLUSTERED_COLOR }}
                      />
                      <span className="text-white/70">Everyone else</span>
                    </span>
                  </div>
                </>
              )}
            </div>
          </motion.div>

          <div className="hidden lg:contents">
          {isLinkedInCompany && companyResult ? (
            <CompanyEmployeePanel
              employee={companySelected}
              onClose={() => setCompanySelected(null)}
            />
          ) : platform === "spotify" && spotifyResult ? (
            <SpotifyPlaylistPanel
              node={spotifySelected}
              playlists={spotifyResult.playlists}
              genres={spotifyResult.genres}
              friends={spotifyResult.friends}
              onClose={() => setSpotifySelected(null)}
              onSelectPlaylist={(playlistId) => {
                const node = spotifyResult.graph.nodes.find(
                  (n) => n.kind === "playlist" && n.refId === playlistId,
                );
                if (node) setSpotifySelected(node);
              }}
            />
          ) : (
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
              platform={
                platform === "spotify" || isLinkedInCompany ? null : platform
              }
            />
          )}
          </div>
          <div className="lg:hidden">
            {platform === "spotify" && spotifyResult && (
              <SpotifyPlaylistPanel
                node={spotifySelected}
                playlists={spotifyResult.playlists}
                genres={spotifyResult.genres}
                friends={spotifyResult.friends}
                onClose={() => setSpotifySelected(null)}
                onSelectPlaylist={(playlistId) => {
                  const node = spotifyResult.graph.nodes.find(
                    (n) => n.kind === "playlist" && n.refId === playlistId,
                  );
                  if (node) setSpotifySelected(node);
                }}
              />
            )}
          </div>
        </div>

        {isLinkedInCompany && companyResult ? (
          <div className="hidden lg:block">
          <CompanyNetworkStats
            stats={companyResult.stats}
            companyName={companyResult.company.name}
            onSelectLocation={(label) => {
              const emp = companyResult.employees.find(
                (e) => e.location === label,
              );
              if (emp) setCompanySelected(emp);
            }}
            onSelectSchool={(label) => {
              const emp = companyResult.employees.find((e) =>
                e.education?.some((ed) => ed.school === label),
              );
              if (emp) setCompanySelected(emp);
            }}
          />
          </div>
        ) : platform === "spotify" && spotifyResult ? (
          <div className="hidden lg:block">
          <SpotifyNetworkStats
            stats={spotifyResult.stats}
            topGenres={spotifyResult.genres.map((g) => ({
              label: g.label,
              weight: g.weight,
              color: g.color,
            }))}
            onSelectGenre={(label) => {
              const node = spotifyResult.graph.nodes.find(
                (n) => n.kind === "genre" && n.label === label,
              );
              if (node) setSpotifySelected(node);
            }}
          />
          </div>
        ) : activeData ? (
          <div className="hidden lg:flex lg:flex-col lg:gap-3">
            {showGridToggle && (
              <div className="inline-flex self-start rounded-lg border border-white/10 bg-black/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setStatsView("summary")}
                  className={`${TOOLBAR_TAB} ${
                    statsView === "summary"
                      ? TOOLBAR_TAB_ACTIVE
                      : TOOLBAR_TAB_AVAILABLE
                  }`}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  Stats
                </button>
                <button
                  type="button"
                  onClick={() => setStatsView("grid")}
                  className={`${TOOLBAR_TAB} ${
                    statsView === "grid"
                      ? TOOLBAR_TAB_ACTIVE
                      : TOOLBAR_TAB_AVAILABLE
                  }`}
                >
                  <Grid3X3 className="h-3.5 w-3.5" />
                  Grid
                </button>
              </div>
            )}
            {statsView === "summary" ? (
              <NetworkStats
                stats={activeData.stats}
                uniqueCount={activeData.engagers?.length}
                onSelectUsername={selectMemberByUsername}
                selectedUsername={selected?.id ?? selected?.label ?? null}
                platform={
                  platform === "spotify" || isLinkedInCompany ? null : platform
                }
              />
            ) : showGridToggle ? (
              <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/45">
                Engagement grid is open in the main panel. Tap a cell to inspect
                comments and reactions.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Mobile: stats / profile / share tabs (map lives in graph section above) */}
        {footerTab !== "map" && (
          <div
            ref={mobileTabPanelRef}
            className="scroll-mt-3 lg:hidden"
          >
            {footerTab === "stats" && (
              <div className="flex flex-col gap-3">
                {showGridToggle && (
                  <div className="inline-flex self-start rounded-lg border border-white/10 bg-black/30 p-0.5">
                    <button
                      type="button"
                      onClick={() => setStatsView("summary")}
                      className={`${TOOLBAR_TAB} ${
                        statsView === "summary"
                          ? TOOLBAR_TAB_ACTIVE
                          : TOOLBAR_TAB_AVAILABLE
                      }`}
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                      Stats
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatsView("grid")}
                      className={`${TOOLBAR_TAB} ${
                        statsView === "grid"
                          ? TOOLBAR_TAB_ACTIVE
                          : TOOLBAR_TAB_AVAILABLE
                      }`}
                    >
                      <Grid3X3 className="h-3.5 w-3.5" />
                      Grid
                    </button>
                  </div>
                )}

                {statsView === "grid" && showGridToggle && activeData ? (
                  <div className="flex min-h-[52dvh] flex-col gap-3">
                    <div className="relative min-h-[40dvh] flex-1 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                      <EngagementGrid
                        posts={activeData.posts!}
                        nodes={gridNodes}
                        selectedId={selected?.id ?? null}
                        onSelect={setSelected}
                        className="absolute inset-0"
                      />
                    </div>
                    {selected ? (
                      <PersonPanel
                        variant="inline"
                        node={selected}
                        proximityRing={
                          selected.circle >= 0
                            ? PROXIMITY_RINGS[selected.circle]
                            : undefined
                        }
                        friendCluster={
                          selected.clusterId != null && selected.clusterId >= 0
                            ? circleById.get(selected.clusterId)
                            : undefined
                        }
                        onClose={() => setSelected(null)}
                        platform={
                          platform === "spotify" || isLinkedInCompany
                            ? null
                            : platform
                        }
                      />
                    ) : null}
                  </div>
                ) : (
                  <>
                {isLinkedInCompany && companyResult ? (
                  <CompanyNetworkStats
                    stats={companyResult.stats}
                    companyName={companyResult.company.name}
                    onSelectLocation={(label) => {
                      const emp = companyResult.employees.find(
                        (e) => e.location === label,
                      );
                      if (emp) setCompanySelected(emp);
                    }}
                    onSelectSchool={(label) => {
                      const emp = companyResult.employees.find((e) =>
                        e.education?.some((ed) => ed.school === label),
                      );
                      if (emp) setCompanySelected(emp);
                    }}
                  />
                ) : platform === "spotify" && spotifyResult ? (
                  <SpotifyNetworkStats
                    stats={spotifyResult.stats}
                    topGenres={spotifyResult.genres.map((g) => ({
                      label: g.label,
                      weight: g.weight,
                      color: g.color,
                    }))}
                    onSelectGenre={(label) => {
                      const node = spotifyResult.graph.nodes.find(
                        (n) => n.kind === "genre" && n.label === label,
                      );
                      if (node) setSpotifySelected(node);
                    }}
                  />
                ) : activeData ? (
                  <NetworkStats
                    stats={activeData.stats}
                    uniqueCount={activeData.engagers?.length}
                    onSelectUsername={selectMemberByUsername}
                    selectedUsername={selected?.id ?? selected?.label ?? null}
                    platform={
                      platform === "spotify" || isLinkedInCompany ? null : platform
                    }
                  />
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-sm text-white/40">
                    No stats available for this platform yet.
                  </div>
                )}
                  </>
                )}
              </div>
            )}

            {footerTab === "profile" && (
              <>
                {isLinkedInCompany && companyResult ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur">
                    <div className="flex items-center gap-3">
                      {companyResult.company.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={companyResult.company.logoUrl}
                          alt=""
                          className="h-12 w-12 rounded-lg object-cover ring-1 ring-white/15"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#0A66C2]/20 text-lg font-bold text-[#0A66C2]">
                          {companyResult.company.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h1 className="truncate text-lg font-bold text-white">
                          {companyResult.company.name}
                        </h1>
                        <div className="text-sm text-white/50">LinkedIn company map</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-white/35">
                      {companyResult.stats.employeeCount}
                      {companyResult.stats.totalReported &&
                      companyResult.stats.totalReported >
                        companyResult.stats.employeeCount
                        ? ` of ${companyResult.stats.totalReported}`
                        : ""}{" "}
                      employees · {companyResult.stats.locationCount} locations ·{" "}
                      {companyResult.stats.schoolCount} schools
                    </div>
                    {companyResult.company.linkedinUrl && (
                      <a
                        href={companyResult.company.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-xs text-[#0A66C2] hover:underline"
                      >
                        Open company page
                      </a>
                    )}
                  </div>
                ) : platform === "spotify" && spotifyResult ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur">
                    <div className="flex items-center gap-3">
                      {spotifyResult.profile.profileImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={spotifyResult.profile.profileImage}
                          alt=""
                          className="h-12 w-12 rounded-full object-cover ring-1 ring-white/15"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1DB954]/20 text-lg font-bold text-[#1DB954]">
                          {spotifyResult.profile.displayName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h1 className="truncate text-lg font-bold text-white">
                          {spotifyResult.profile.displayName}
                        </h1>
                        <div className="text-sm text-white/50">Spotify taste map</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-white/35">
                      {spotifyResult.stats.friendCount} friend
                      {spotifyResult.stats.friendCount === 1 ? "" : "s"} ·{" "}
                      {spotifyResult.stats.playlistCount} playlists ·{" "}
                      {spotifyResult.stats.trackCount} tracks ·{" "}
                      {spotifyResult.stats.genreCount} genres
                    </div>
                    {spotifyResult.profile.sourceUrl && (
                      <a
                        href={spotifyResult.profile.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-xs text-[#1DB954] hover:underline"
                      >
                        Open profile
                      </a>
                    )}
                  </div>
                ) : activeData ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur">
                    <div className="flex items-center gap-2">
                      <h1 className="truncate text-lg font-bold text-white">
                        @{activeData.profile.username}
                      </h1>
                      {activeData.profile.isVerified && (
                        <BadgeCheck className="h-5 w-5 shrink-0 text-ig-blue" />
                      )}
                    </div>
                    {activeData.profile.fullName && (
                      <div className="text-sm text-white/60">
                        {activeData.profile.fullName}
                      </div>
                    )}
                    {activeData.profile.biography && (
                      <p className="mt-2 text-sm text-white/40">
                        {activeData.profile.biography}
                      </p>
                    )}
                    <div className="mt-3 text-xs text-white/30">
                      {activeData.engagers && activeData.engagers.length > 0
                        ? `${activeData.engagers.length} unique engagers · map shows top ${activeData.stats.shown}`
                        : `Top ${activeData.stats.shown} connections`}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur">
                    <div className="text-sm font-semibold text-white/70">
                      {PLATFORM_LABEL[platform]}
                    </div>
                    <p className="mt-2 text-xs text-white/40">
                      No snapshot loaded for this platform yet.
                    </p>
                  </div>
                )}
              </>
            )}

            {footerTab === "share" && (
              <div className="flex flex-col gap-3">
                {data && !data.pinned && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/80">
                      <ShieldAlert className="h-4 w-4 text-ig-orange" /> Scrape budget
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
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
                        <div className="mt-1 font-mono text-white">
                          {data.budget.maxComments}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {data && !pinned && !data.demo && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/80">
                      <Pin className="h-4 w-4 text-ig-blue" /> Save this run
                    </div>
                    <p className="text-xs leading-relaxed text-white/45">
                      Pin the graph so anyone can open a share link without spending
                      Apify credits again.
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={pinCurrentRun}
                        disabled={pinning}
                        className="min-h-[44px] rounded-xl bg-ig-gradient px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                      >
                        {pinning ? "Saving…" : "Pin for share link"}
                      </button>
                      <button
                        type="button"
                        onClick={downloadSnapshotJson}
                        className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10"
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

                {pinned &&
                  ((isLinkedInCompany &&
                    companyResult &&
                    companyResult.scrapedAt > 0) ||
                    (platform === "spotify" &&
                      spotifyResult &&
                      spotifyResult.scrapedAt > 0) ||
                    (displayData && displayData.scrapedAt > 0)) && (
                    <p className="rounded-2xl border border-ig-blue/20 bg-ig-blue/5 px-4 py-3 text-xs text-white/55">
                      Frozen snapshot from{" "}
                      {new Date(
                        isLinkedInCompany && companyResult
                          ? companyResult.scrapedAt
                          : platform === "spotify" && spotifyResult
                            ? spotifyResult.scrapedAt
                            : displayData!.scrapedAt,
                      ).toLocaleString()}
                      . No live scrape runs on this page.
                    </p>
                  )}

                {activeData && platform !== "spotify" && !isLinkedInCompany ? (
                  <ShareCard
                    handle={activeData.profile.username}
                    stats={activeData.stats}
                    platform={platform}
                    onDownload={downloadPng}
                  />
                ) : (
                  !data?.pinned &&
                  !pinned && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-sm text-white/40">
                      Share options appear when a social graph is loaded.
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {/* Mobile: person detail below map */}
        <div ref={footerPanelRef} className="scroll-mt-3 lg:hidden">
          {footerTab === "map" && (companySelected || selected) && (
          <div className="mt-2.5">
                {isLinkedInCompany && companySelected ? (
                  <CompanyEmployeePanel
                    employee={companySelected}
                    onClose={() => setCompanySelected(null)}
                  />
                ) : selected ? (
                  <PersonPanel
                    variant="inline"
                    node={selected}
                    proximityRing={
                      selected.circle >= 0
                        ? PROXIMITY_RINGS[selected.circle]
                        : undefined
                    }
                    friendCluster={
                      selected.clusterId != null && selected.clusterId >= 0
                        ? circleById.get(selected.clusterId)
                        : undefined
                    }
                    onClose={() => setSelected(null)}
                    platform={
                      platform === "spotify" || isLinkedInCompany
                        ? null
                        : platform
                    }
                  />
                ) : null}
          </div>
          )}
        </div>
        </div>

        {/* Sidebar — desktop only */}
        <aside className="hidden flex-col gap-3 sm:gap-4 lg:flex">
          {isLinkedInCompany && companyResult ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur sm:p-4">
              <div className="flex items-center gap-3">
                {companyResult.company.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={companyResult.company.logoUrl}
                    alt=""
                    className="h-12 w-12 rounded-lg object-cover ring-1 ring-white/15"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#0A66C2]/20 text-lg font-bold text-[#0A66C2]">
                    {companyResult.company.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-bold text-white sm:text-xl">
                    {companyResult.company.name}
                  </h1>
                  <div className="text-sm text-white/50">LinkedIn company map</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-white/35">
                {companyResult.stats.employeeCount}
                {companyResult.stats.totalReported &&
                companyResult.stats.totalReported >
                  companyResult.stats.employeeCount
                  ? ` of ${companyResult.stats.totalReported}`
                  : ""}{" "}
                employees · {companyResult.stats.locationCount} locations ·{" "}
                {companyResult.stats.schoolCount} schools
              </div>
              {companyResult.company.linkedinUrl && (
                <a
                  href={companyResult.company.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-[#0A66C2] hover:underline"
                >
                  Open company page
                </a>
              )}
            </div>
          ) : platform === "spotify" && spotifyResult ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur sm:p-4">
              <div className="flex items-center gap-3">
                {spotifyResult.profile.profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={spotifyResult.profile.profileImage}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover ring-1 ring-white/15"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1DB954]/20 text-lg font-bold text-[#1DB954]">
                    {spotifyResult.profile.displayName.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-bold text-white sm:text-xl">
                    {spotifyResult.profile.displayName}
                  </h1>
                  <div className="text-sm text-white/50">Spotify taste map</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-white/35">
                {spotifyResult.stats.friendCount} friend
                {spotifyResult.stats.friendCount === 1 ? "" : "s"} ·{" "}
                {spotifyResult.stats.playlistCount} playlists ·{" "}
                {spotifyResult.stats.trackCount} tracks ·{" "}
                {spotifyResult.stats.genreCount} genres
              </div>
              {spotifyResult.profile.sourceUrl && (
                <a
                  href={spotifyResult.profile.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-[#1DB954] hover:underline"
                >
                  Open profile
                </a>
              )}
            </div>
          ) : activeData ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur sm:p-4">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-bold text-white sm:text-xl">
                  @{activeData.profile.username}
                </h1>
                {activeData.profile.isVerified && (
                  <BadgeCheck className="h-5 w-5 shrink-0 text-ig-blue" />
                )}
              </div>
              {activeData.profile.fullName && (
                <div className="text-sm text-white/60">
                  {activeData.profile.fullName}
                </div>
              )}
              {activeData.profile.biography && (
                <p className="mt-2 line-clamp-3 text-sm text-white/40 sm:line-clamp-none">
                  {activeData.profile.biography}
                </p>
              )}
              <div className="mt-3 text-xs text-white/30">
                {activeData.engagers && activeData.engagers.length > 0
                  ? `${activeData.engagers.length} unique engagers · map shows top ${activeData.stats.shown}`
                  : `Top ${activeData.stats.shown} connections`}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur sm:p-4">
              <div className="text-sm font-semibold text-white/70">
                {PLATFORM_LABEL[platform]}
              </div>
              <p className="mt-2 text-xs text-white/40">
                No snapshot loaded for this platform yet.
              </p>
            </div>
          )}

          {/* Hide scrape budget on pinned demos (noise on phone); keep on live runs */}
          {data && !data.pinned && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur sm:p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/80">
                <ShieldAlert className="h-4 w-4 text-ig-orange" /> Scrape budget
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm sm:gap-3">
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
          )}

          {data && !pinned && !data.demo && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur sm:p-4">
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
                  className="min-h-[44px] rounded-xl bg-ig-gradient px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {pinning ? "Saving…" : "Pin for share link"}
                </button>
                <button
                  type="button"
                  onClick={downloadSnapshotJson}
                  className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10"
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

          {pinned &&
            ((isLinkedInCompany &&
              companyResult &&
              companyResult.scrapedAt > 0) ||
              (platform === "spotify" && spotifyResult && spotifyResult.scrapedAt > 0) ||
              (displayData && displayData.scrapedAt > 0)) && (
            <p className="rounded-2xl border border-ig-blue/20 bg-ig-blue/5 px-4 py-3 text-xs text-white/55">
              Frozen snapshot from{" "}
              {new Date(
                isLinkedInCompany && companyResult
                  ? companyResult.scrapedAt
                  : platform === "spotify" && spotifyResult
                    ? spotifyResult.scrapedAt
                    : displayData!.scrapedAt,
              ).toLocaleString()}
              . No live scrape runs on this page.
            </p>
          )}

          {activeData && platform !== "spotify" && !isLinkedInCompany && (
            <ShareCard
              handle={activeData.profile.username}
              stats={activeData.stats}
              platform={platform}
              onDownload={downloadPng}
            />
          )}
        </aside>
        </div>
      </div>

      {!graphFullscreen && (
        <GraphFooterTabs active={footerTab} onSelect={selectFooterTab} />
      )}
    </main>
  );
}
