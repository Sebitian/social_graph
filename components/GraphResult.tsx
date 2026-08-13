"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  CreditCard,
  FlaskConical,
  HelpCircle,
  List,
  Maximize2,
  Pin,
  ShieldAlert,
  User,
  X,
} from "lucide-react";
import type {
  Circle,
  GraphNode,
  ScrapeResult,
  SocialSourcePlatform,
} from "@/lib/types";
import type {
  SpotifyGraphNode,
  SpotifyTasteResult,
} from "@/lib/spotifyTypes";
import type {
  CompanyEmployee,
  CompanyGraphNode,
  CompanyResult,
} from "@/lib/companyTypes";
import type { TikTokGraphNode, TikTokResult } from "@/lib/tiktokTypes";
import PersonPanel from "@/components/PersonPanel";
import GraphVisualizer from "@/components/GraphVisualizer";
import SpotifyGraphVisualizer from "@/components/SpotifyGraphVisualizer";
import CompanyGraphVisualizer from "@/components/CompanyGraphVisualizer";
import TikTokGraphVisualizer from "@/components/TikTokGraphVisualizer";
import CompanyRosterTable from "@/components/CompanyRosterTable";
import SpotifyPlaylistPanel from "@/components/SpotifyPlaylistPanel";
import TikTokVideoPanel from "@/components/TikTokVideoPanel";
import CompanyEmployeePanel from "@/components/CompanyEmployeePanel";
import EngagementGrid from "@/components/EngagementGrid";
import GraphNodeSearch from "@/components/GraphNodeSearch";
import {
  GraphHowToRead,
  reopenGraphHowToRead,
} from "@/components/GraphHowToRead";
import AnalyticsPanel, {
  type AnalyticsPlatform,
} from "@/components/analytics/AnalyticsPanel";
import ChatPanel from "@/components/ChatPanel";
import ProfilePanel from "@/components/ProfilePanel";
import GraphFooterTabs, { type FooterTab } from "@/components/GraphFooterTabs";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  InstagramIcon,
  LinkedInIcon,
  SpotifyIcon,
  FacebookIcon,
  TikTokIcon,
  CompanyIcon,
} from "@/components/PlatformIcons";
import { SELF_COLOR, PROXIMITY_RINGS, UNCLUSTERED_COLOR } from "@/lib/graphUtils";
import {
  DEFAULT_ANALYTICS_RANGE,
  type AnalyticsRangeId,
} from "@/lib/analytics";
import type { ScrapeBudget } from "@/lib/scrapeBudget";
import {
  estimateScrapeBudget,
  formatUsd,
  budgetCacheSuffix,
  SCRAPE_BUDGET_LIMITS,
} from "@/lib/scrapeBudget";
import { DEMO_HANDLE } from "@/lib/paths";
import type { ChatSourceInfo } from "@/lib/chat/types";

type GraphPlatform =
  | "linkedin"
  | "instagram"
  | "spotify"
  | "facebook"
  | "tiktok";
type LinkedInMode = "person" | "company";
type GraphView = "map" | "roster";
type StatsView = "summary" | "grid";
type SocialPlatform = SocialSourcePlatform;

const PLATFORM_LABEL: Record<GraphPlatform, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  spotify: "Spotify",
};

const PLATFORM_TABS = [
  { id: "linkedin" as const, label: "LinkedIn", Icon: LinkedInIcon },
  { id: "instagram" as const, label: "Instagram", Icon: InstagramIcon },
  { id: "facebook" as const, label: "Facebook", Icon: FacebookIcon },
  { id: "tiktok" as const, label: "TikTok", Icon: TikTokIcon },
  { id: "spotify" as const, label: "Spotify", Icon: SpotifyIcon },
] as const;

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
  /** TikTok visibility snapshot (profile → videos → hashtags). */
  tiktokData?: TikTokResult | null;
  /** Load a frozen snapshot from data/snapshots — never calls Apify. */
  pinned?: boolean;
}

function platformOfResult(result: ScrapeResult): SocialPlatform {
  if (result.platform) return result.platform;
  return result.posts?.length ? "linkedin" : "instagram";
}

export default function GraphResult({
  handle,
  initialBudget = {},
  initialData = null,
  initialPlatformData = {},
  spotifyData = null,
  companyData = null,
  tiktokData = null,
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
  const [tiktokResult, setTiktokResult] =
    useState<TikTokResult | null>(tiktokData);
  const [tiktokSelected, setTiktokSelected] =
    useState<TikTokGraphNode | null>(null);
  const [confirmationState, setConfirmationState] = useState<
    "checking" | "required" | "confirmed"
  >(pinned ? "confirmed" : "checking");
  const [profileLimitHit, setProfileLimitHit] = useState(false);
  const [searchedCount, setSearchedCount] = useState(0);
  const [view, setView] = useState<GraphView>("map");
  const [statsView, setStatsView] = useState<StatsView>("summary");
  const [footerTab, setFooterTab] = useState<FooterTab>("map");
  const [analyticsPlatform, setAnalyticsPlatform] =
    useState<AnalyticsPlatform>(() => {
      if (initialPlatformData.linkedin || initialData?.platform === "linkedin")
        return "linkedin";
      if (initialPlatformData.instagram) return "instagram";
      if (initialPlatformData.facebook) return "facebook";
      if (tiktokData) return "tiktok";
      if (spotifyData) return "spotify";
      return "linkedin";
    });
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRangeId>(
    DEFAULT_ANALYTICS_RANGE,
  );
  const [howToOpen, setHowToOpen] = useState(false);
  const [graphFullscreen, setGraphFullscreen] = useState(false);
  const [linkedinMode, setLinkedinMode] = useState<LinkedInMode>(() =>
    !initialPlatformData.linkedin && companyData ? "company" : "person",
  );
  const [platform, setPlatform] = useState<GraphPlatform>(() => {
    if (pinned) {
      if (initialPlatformData.linkedin) return "linkedin";
      if (initialData && platformOfResult(initialData) === "linkedin")
        return "linkedin";
      if (initialPlatformData.instagram) return "instagram";
      if (initialData && platformOfResult(initialData) === "instagram")
        return "instagram";
      if (initialPlatformData.facebook) return "facebook";
      if (initialData && platformOfResult(initialData) === "facebook")
        return "facebook";
      if (tiktokData) return "tiktok";
      if (spotifyData) return "spotify";
      if (companyData) return "linkedin";
      return "linkedin";
    }
    // Search flow: the search is Instagram-handle shaped, default to Instagram.
    if (initialPlatformData.instagram) return "instagram";
    if (initialData) return platformOfResult(initialData);
    if (initialPlatformData.linkedin) return "linkedin";
    if (initialPlatformData.facebook) return "facebook";
    if (tiktokData) return "tiktok";
    if (spotifyData) return "spotify";
    return "instagram";
  });
  const graphWrapRef = useRef<HTMLDivElement>(null);
  const graphSectionRef = useRef<HTMLDivElement>(null);
  const mobileTabPanelRef = useRef<HTMLDivElement>(null);
  const requestedBudget = useMemo(
    () => estimateScrapeBudget(initialBudget),
    [initialBudget],
  );

  const selectFooterTab = useCallback((tab: FooterTab) => {
    setFooterTab(tab);
    requestAnimationFrame(() => {
      const target =
        tab === "map" ? graphSectionRef.current : mobileTabPanelRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

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
    platform === "tiktok" ||
    (platform === "linkedin" && linkedinMode === "company")
      ? null
      : (platformResults[platform] ?? null);
  const hasSpotify = Boolean(spotifyData || spotifyResult);
  const hasTikTok = Boolean(tiktokData || tiktokResult);
  const hasCompany = Boolean(companyData || companyResult);
  const hasLinkedInPerson = Boolean(platformResults.linkedin);
  const hasLinkedIn = hasLinkedInPerson || hasCompany;
  const hasFacebook = Boolean(platformResults.facebook);
  const isLinkedInCompany =
    platform === "linkedin" && linkedinMode === "company";
  const chatSources = useMemo((): ChatSourceInfo[] => {
    const sources: ChatSourceInfo[] = [];
    const linkedin = platformResults.linkedin;
    if (linkedin) {
      sources.push({
        id: "linkedin",
        label: "LinkedIn",
        title: linkedin.profile.fullName || linkedin.profile.username,
        handle: linkedin.profile.username,
        subtitle: `@${linkedin.profile.username} · Person graph`,
      });
    }
    if (companyResult) {
      sources.push({
        id: "company",
        label: "Company",
        title: companyResult.company.name,
        handle: companyResult.company.name,
        subtitle: `${companyResult.stats.employeeCount} employees in graph`,
      });
    }
    const instagram = platformResults.instagram;
    if (instagram) {
      sources.push({
        id: "instagram",
        label: "Instagram",
        title: instagram.profile.fullName || instagram.profile.username,
        handle: instagram.profile.username,
        subtitle: `@${instagram.profile.username} · Account graph`,
      });
    }
    const facebook = platformResults.facebook;
    if (facebook) {
      sources.push({
        id: "facebook",
        label: "Facebook",
        title: facebook.profile.fullName || facebook.profile.username,
        handle: facebook.profile.username,
        subtitle: `@${facebook.profile.username} · Account graph`,
      });
    }
    return sources;
  }, [companyResult, platformResults]);
  const isAlternatePlatform =
    platform === "spotify" || platform === "tiktok" || isLinkedInCompany;
  const platformHasData =
    platform === "spotify"
      ? hasSpotify
      : platform === "tiktok"
        ? hasTikTok
        : platform === "linkedin"
          ? isLinkedInCompany
            ? hasCompany
            : hasLinkedInPerson
          : Boolean(activeData);
  const showCompanyViews = platformHasData && isLinkedInCompany;
  const analyticsGridData =
    analyticsPlatform === "linkedin" ||
    analyticsPlatform === "instagram" ||
    analyticsPlatform === "facebook"
      ? (platformResults[analyticsPlatform] ?? null)
      : null;
  const analyticsCanShowGrid = Boolean(
    analyticsGridData?.posts && analyticsGridData.posts.length > 0,
  );
  const analyticsGridNodes = useMemo(() => {
    if (!analyticsGridData) return [];
    if (analyticsGridData.engagers && analyticsGridData.engagers.length > 0) {
      return analyticsGridData.engagers;
    }
    return analyticsGridData.graph.nodes;
  }, [analyticsGridData]);

  const analyticsCircleById = useMemo(() => {
    const m = new Map<number, Circle>();
    for (const c of analyticsGridData?.graph.circles ?? []) m.set(c.id, c);
    return m;
  }, [analyticsGridData]);

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

  const selectMemberByUsername = useCallback(
    (username: string) => {
      const key = username.trim().toLowerCase();
      const node = nodeByUsername.get(key);
      if (node) {
        setCompanySelected(null);
        setSpotifySelected(null);
        setTiktokSelected(null);
        setSelected(node);
        return;
      }
      for (const result of Object.values(platformResults)) {
        if (!result) continue;
        const pool = [
          ...(result.engagers ?? []),
          ...(result.graph.nodes ?? []),
        ];
        for (const candidate of pool) {
          if (candidate.group !== "member") continue;
          if (
            candidate.id.toLowerCase() === key ||
            candidate.label.toLowerCase() === key
          ) {
            setCompanySelected(null);
            setSpotifySelected(null);
            setTiktokSelected(null);
            setSelected(candidate);
            return;
          }
        }
      }
    },
    [nodeByUsername, platformResults],
  );

  const selectAnalyticsTikTokVideo = useCallback(
    (id: string) => {
      const node = tiktokResult?.graph.nodes.find(
        (n) => n.kind === "video" && n.refId === id,
      );
      if (!node) return;
      setSelected(null);
      setCompanySelected(null);
      setSpotifySelected(null);
      setTiktokSelected(node);
    },
    [tiktokResult],
  );

  const selectAnalyticsTikTokHashtag = useCallback(
    (label: string) => {
      const node = tiktokResult?.graph.nodes.find(
        (n) =>
          n.kind === "hashtag" &&
          (n.refId === label || n.label === `#${label}`),
      );
      if (!node) return;
      setSelected(null);
      setCompanySelected(null);
      setSpotifySelected(null);
      setTiktokSelected(node);
    },
    [tiktokResult],
  );

  const selectAnalyticsSpotifyGenre = useCallback(
    (label: string) => {
      const node = spotifyResult?.graph.nodes.find(
        (n) => n.kind === "genre" && n.label === label,
      );
      if (!node) return;
      setSelected(null);
      setCompanySelected(null);
      setTiktokSelected(null);
      setSpotifySelected(node);
    },
    [spotifyResult],
  );

  const selectAnalyticsCompanyLocation = useCallback(
    (label: string) => {
      const emp = companyResult?.employees.find((e) => e.location === label);
      if (!emp) return;
      setSelected(null);
      setSpotifySelected(null);
      setTiktokSelected(null);
      setCompanySelected(emp);
    },
    [companyResult],
  );

  const selectAnalyticsCompanySchool = useCallback(
    (label: string) => {
      const emp = companyResult?.employees.find((e) =>
        e.education?.some((ed) => ed.school === label),
      );
      if (!emp) return;
      setSelected(null);
      setSpotifySelected(null);
      setTiktokSelected(null);
      setCompanySelected(emp);
    },
    [companyResult],
  );


  useEffect(() => {
    if (!analyticsCanShowGrid && statsView === "grid") setStatsView("summary");
  }, [analyticsCanShowGrid, statsView]);

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
      setTiktokResult(tiktokData);
      setError(null);
      setSelected(null);
      setCompanySelected(null);
      setTiktokSelected(null);
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
    tiktokData,
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
      fetch(`/api/company?handle=${encodeURIComponent("formationbio")}`)
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

  const viewProfileGraph = useCallback(
    (nextPlatform: GraphPlatform, nextLinkedinMode?: LinkedInMode) => {
      setPlatform(nextPlatform);
      if (nextPlatform === "linkedin") {
        setLinkedinMode(
          nextLinkedinMode ??
            (platformResults.linkedin ? "person" : "company"),
        );
      }
      selectFooterTab("map");
    },
    [platformResults.linkedin, selectFooterTab],
  );

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
    !companyResult &&
    !tiktokResult
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
    (platform === "tiktok" && Boolean(tiktokResult?.pinned)) ||
    (isLinkedInCompany && Boolean(companyResult?.pinned));
  const showDemoBadge =
    Boolean(displayData?.demo) ||
    (platform === "spotify" && Boolean(spotifyResult?.demo)) ||
    (platform === "tiktok" && Boolean(tiktokResult?.demo)) ||
    (isLinkedInCompany && Boolean(companyResult?.demo));
  const showCachedBadge =
    (Boolean(displayData?.cached) &&
      !displayData?.demo &&
      !displayData?.pinned) ||
    (platform === "spotify" &&
      Boolean(spotifyResult?.cached) &&
      !spotifyResult?.demo &&
      !spotifyResult?.pinned) ||
    (platform === "tiktok" &&
      Boolean(tiktokResult?.cached) &&
      !tiktokResult?.demo &&
      !tiktokResult?.pinned) ||
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
          {platform !== "spotify" &&
            platform !== "tiktok" &&
            !isLinkedInCompany && (
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

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-1.5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[calc(4.25rem+env(safe-area-inset-top))] sm:px-4 sm:pt-20">
        {platform !== "spotify" &&
          platform !== "tiktok" &&
          !isLinkedInCompany && (
          <GraphHowToRead
            forceOpen={howToOpen}
            onDismiss={() => setHowToOpen(false)}
          />
        )}

        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:min-h-0">
        {/* Graph + selection panels (Map tab) */}
        <div className="flex flex-col gap-3 sm:gap-4 lg:min-h-0">
        <div
          ref={graphSectionRef}
          className={`scroll-mt-[calc(4.25rem+env(safe-area-inset-top))] relative flex flex-col ${
            footerTab !== "map" ? "hidden" : ""
          } ${
            view === "roster"
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
                    view === "roster" ? "min-h-[min(78dvh,720px)]" : ""
                  }`
            }`}
          >
            {/* Mobile: platform toggles above graph */}
            {!graphFullscreen ? (
            <div className="flex shrink-0 flex-col gap-1.5 border-b border-white/10 px-1.5 py-1.5 sm:hidden">
              <div className="inline-flex max-w-full self-start overflow-x-auto rounded-lg border border-white/10 bg-black/30 p-0.5">
                {PLATFORM_TABS.map(({ id, label, Icon }) => {
                  const available =
                    id === "spotify"
                      ? hasSpotify
                      : id === "tiktok"
                        ? hasTikTok
                        : id === "linkedin"
                          ? hasLinkedIn
                          : id === "facebook"
                            ? hasFacebook
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
                        setTiktokSelected(null);
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
                <div className="inline-flex max-w-full overflow-x-auto rounded-lg border border-white/10 bg-black/30 p-0.5">
                  {PLATFORM_TABS.map(({ id, label, Icon }) => {
                    const available =
                      id === "spotify"
                        ? hasSpotify
                        : id === "tiktok"
                          ? hasTikTok
                          : id === "linkedin"
                            ? hasLinkedIn
                            : id === "facebook"
                              ? hasFacebook
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
                          setTiktokSelected(null);
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
              {/* Top overlay controls — single row so search + exit stay aligned */}
              <div
                className={`pointer-events-none absolute inset-x-0 z-30 flex items-center gap-2 ${
                  graphFullscreen
                    ? "top-0 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
                    : "top-0 px-1.5 pt-1.5 sm:px-3 sm:pt-3"
                }`}
              >
                {!isLinkedInCompany &&
                !isAlternatePlatform &&
                activeData &&
                view === "map" ? (
                  <div className="pointer-events-auto min-w-0 flex-1 sm:max-w-[280px]">
                    <GraphNodeSearch
                      nodes={activeData.graph.nodes}
                      selectedId={selected?.id ?? null}
                      onSelect={setSelected}
                      platform={platform}
                    />
                  </div>
                ) : (
                  <div className="min-w-0 flex-1" />
                )}
                <button
                  type="button"
                  onClick={() =>
                    graphFullscreen
                      ? setGraphFullscreen(false)
                      : setGraphFullscreen(true)
                  }
                  aria-label={graphFullscreen ? "Exit full screen" : "Full screen"}
                  className="pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-0 bg-black/55 text-white/75 shadow-[0_4px_20px_rgba(0,0,0,0.35)] ring-1 ring-white/10 backdrop-blur-md transition hover:bg-black/70 hover:text-white active:scale-95"
                >
                  {graphFullscreen ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </button>
              </div>

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
              ) : platform === "tiktok" ? (
                tiktokResult ? (
                  <>
                    <TikTokGraphVisualizer
                      key={`tiktok-${tiktokResult.profile.username}`}
                      data={tiktokResult.graph}
                      className="absolute inset-0"
                      selectedId={tiktokSelected?.id ?? null}
                      onSelect={setTiktokSelected}
                    />
                    <div className="pointer-events-none absolute bottom-4 right-4 hidden max-w-[200px] flex-col gap-1.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur sm:flex">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                        Flow
                      </div>
                      <span className="text-[10px] leading-relaxed text-white/50">
                        You → videos → hashtags
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                    <TikTokIcon className="h-8 w-8 text-[#FE2C55]" />
                    <div className="text-sm font-medium text-white/80">
                      No TikTok snapshot yet
                    </div>
                    <p className="max-w-sm text-xs leading-relaxed text-white/40">
                      Import a TikTok profile + posts scrape to unlock visibility
                      views here.
                    </p>
                  </div>
                )
              ) : !activeData ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                  {platform === "linkedin" ? (
                    <LinkedInIcon className="h-8 w-8 text-[#0A66C2]" />
                  ) : platform === "facebook" ? (
                    <FacebookIcon className="h-8 w-8 text-[#1877F2]" />
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
              ) : (
                <>
                  <GraphVisualizer
                    key={`graph-${platform}-${activeData.profile.username}`}
                    data={activeData.graph}
                    className="absolute inset-0 max-sm:touch-pan-y sm:touch-none"
                    selectedId={selected?.id ?? null}
                    onSelect={setSelected}
                    labelStyle={platform === "instagram" ? "handles" : "auto"}
                    platform={
                      platform === "instagram" ||
                      platform === "linkedin" ||
                      platform === "facebook"
                        ? platform
                        : null
                    }
                  />

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
          {platform === "tiktok" && tiktokResult && (
            <TikTokVideoPanel
              node={tiktokSelected}
              videos={tiktokResult.videos}
              hashtags={tiktokResult.hashtags}
              onClose={() => setTiktokSelected(null)}
              onSelectVideo={(videoId) => {
                const node = tiktokResult.graph.nodes.find(
                  (n) => n.kind === "video" && n.refId === videoId,
                );
                if (node) setTiktokSelected(node);
              }}
            />
          )}
        </div>

        {/* Analytics / Chat / Profile — Chat stays mounted so the thread survives Map switches */}
        <div
          ref={mobileTabPanelRef}
          className={`mx-auto w-full max-w-5xl scroll-mt-3 ${footerTab === "map" ? "hidden" : ""}`}
        >
            {footerTab === "analytics" && (
              <AnalyticsPanel
                socialResults={platformResults}
                spotifyResult={spotifyResult}
                companyResult={companyResult}
                tiktokResult={tiktokResult}
                platform={analyticsPlatform}
                onPlatformChange={setAnalyticsPlatform}
                range={analyticsRange}
                onRangeChange={setAnalyticsRange}
                view={statsView}
                onViewChange={setStatsView}
                gridContent={
                  analyticsGridData ? (
                    <div className="flex min-h-[78dvh] flex-col gap-3 sm:min-h-[82dvh]">
                      <div className="relative min-h-[68dvh] flex-1 overflow-hidden rounded-xl border border-white/10 bg-black/40 sm:min-h-[72dvh]">
                        <EngagementGrid
                          posts={analyticsGridData.posts!}
                          nodes={analyticsGridNodes}
                          selectedId={selected?.id ?? null}
                          onSelect={setSelected}
                          className="absolute inset-0"
                        />
                      </div>
                    </div>
                  ) : null
                }
                onSelectUsername={selectMemberByUsername}
                selectedUsername={selected?.id ?? selected?.label ?? null}
                onSelectTikTokVideoId={selectAnalyticsTikTokVideo}
                onSelectTikTokHashtag={selectAnalyticsTikTokHashtag}
                onSelectSpotifyGenre={selectAnalyticsSpotifyGenre}
                onSelectCompanyLocation={selectAnalyticsCompanyLocation}
                onSelectCompanySchool={selectAnalyticsCompanySchool}
              />
            )}

            <div className={footerTab === "chat" ? "" : "hidden"}>
              <ChatPanel
                key={handle}
                handle={handle}
                pinned={pinned}
                sources={chatSources}
                budget={requestedBudget}
                onSelectUsername={selectMemberByUsername}
              />
            </div>

            {footerTab === "profile" && (
              <ProfilePanel
                socialResults={platformResults}
                companyResult={companyResult}
                tiktokResult={tiktokResult}
                spotifyResult={spotifyResult}
                demo={handle === DEMO_HANDLE}
                onViewGraph={viewProfileGraph}
              />
            )}
        </div>

        </div>
        </div>
      </div>

      {/* Node profile modals (portal overlays) */}
      {isLinkedInCompany ? (
        <CompanyEmployeePanel
          employee={companySelected}
          onClose={() => setCompanySelected(null)}
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
              ? (footerTab === "analytics"
                  ? analyticsCircleById
                  : circleById
                ).get(selected.clusterId)
              : undefined
          }
          onClose={() => setSelected(null)}
          platform={
            footerTab === "analytics"
              ? analyticsPlatform === "linkedin" ||
                analyticsPlatform === "instagram" ||
                analyticsPlatform === "facebook"
                ? analyticsPlatform
                : null
              : isAlternatePlatform
                ? null
                : platform
          }
        />
      )}

      {!graphFullscreen && (
        <GraphFooterTabs active={footerTab} onSelect={selectFooterTab} />
      )}
    </main>
  );
}
