"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CreditCard,
  ShieldAlert,
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
import type {
  ConferenceAttendee,
  ConferenceGraphNode,
  ConferenceResult,
} from "@/lib/conferenceTypes";
import type { TikTokGraphNode, TikTokResult } from "@/lib/tiktokTypes";
import PersonPanel from "@/components/PersonPanel";
import GraphVisualizer from "@/components/GraphVisualizer";
import GraphVisualizer3D from "@/components/GraphVisualizer3D";
import SpotifyGraphVisualizer from "@/components/SpotifyGraphVisualizer";
import CompanyGraphVisualizer from "@/components/CompanyGraphVisualizer";
import CompanyHierarchyGraph from "@/components/CompanyHierarchyGraph";
import ConferenceGraphVisualizer from "@/components/ConferenceGraphVisualizer";
import TikTokGraphVisualizer from "@/components/TikTokGraphVisualizer";
import CompanyRosterTable from "@/components/CompanyRosterTable";
import ConferenceRosterTable from "@/components/ConferenceRosterTable";
import SpotifyPlaylistPanel from "@/components/SpotifyPlaylistPanel";
import TikTokVideoPanel from "@/components/TikTokVideoPanel";
import CompanyEmployeePanel from "@/components/CompanyEmployeePanel";
import ConferenceAttendeePanel from "@/components/ConferenceAttendeePanel";
import InstagramModeControls, {
  peopleFromInstagramBundle,
  peopleFromSocialResult,
} from "@/components/InstagramModeControls";
import GraphNodeSearch from "@/components/GraphNodeSearch";
import GraphChrome, { ProfileComingSoon } from "@/components/GraphChrome";
import type { GraphLegendItem } from "@/components/GraphChrome";
import AnalyticsPanel, {
  type AnalyticsPlatform,
} from "@/components/analytics/AnalyticsPanel";
import ChatPanel from "@/components/ChatPanel";
import type { FooterTab } from "@/components/GraphFooterTabs";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  InstagramIcon,
  LinkedInIcon,
  SpotifyIcon,
  FacebookIcon,
  TikTokIcon,
  CompanyIcon,
  ConferenceIcon,
} from "@/components/PlatformIcons";
import { SELF_COLOR, PROXIMITY_RINGS, UNCLUSTERED_COLOR } from "@/lib/graphUtils";
import { buildCompanyHierarchy } from "@/lib/companyHierarchy";
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
import type { ChatSourceInfo } from "@/lib/chat/types";
import {
  attachInstagramEmployeesToGraph,
  firstAvailableInstagramPersonId,
  INSTAGRAM_EMPLOYEE_COLOR,
  instagramPeopleSubtitle,
  instagramPersonById,
  instagramPersonForNode,
  instagramPersonRole,
  pruneQuietMemberNodes,
  type InstagramMode,
  type InstagramPeopleResult,
} from "@/lib/instagramPeople";
import { pathWithSection, sectionFromPathname } from "@/lib/jobSections";

type GraphPlatform =
  | "linkedin"
  | "instagram"
  | "spotify"
  | "facebook"
  | "tiktok"
  | "conference";
type LinkedInMode = "person" | "company";
type GraphView = "map" | "roster" | "hierarchy";
type SocialPlatform = SocialSourcePlatform;

const PLATFORM_LABEL: Record<GraphPlatform, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  spotify: "Spotify",
  conference: "Conference",
};

const SEARCHED_HANDLES_KEY = "netgraph.searchedHandles";
const SCRAPE_RESULT_CACHE_PREFIX = "netgraph.scrapeResult.v2";
const SCRAPE_RESULT_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

function memberKeyMatch(node: GraphNode, key: string): boolean {
  if (node.group !== "member") return false;
  return (
    node.id.toLowerCase() === key ||
    node.label.toLowerCase() === key ||
    (node.fullName ?? "").toLowerCase() === key
  );
}

function findMemberInResult(
  result: ScrapeResult | null | undefined,
  key: string,
): GraphNode | null {
  if (!result) return null;
  const pool = [...(result.engagers ?? []), ...result.graph.nodes];
  return pool.find((node) => memberKeyMatch(node, key)) ?? null;
}

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
  window.dispatchEvent(
    new StorageEvent("storage", { key: SEARCHED_HANDLES_KEY }),
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
  /** Instagram employee Person graphs (company account stays in initialPlatformData). */
  instagramPeopleData?: InstagramPeopleResult | null;
  /** Luma / conference attendee snapshot. */
  conferenceData?: ConferenceResult | null;
  /** Load a frozen snapshot from data/snapshots — never calls Apify. */
  pinned?: boolean;
  /** Job page already has this run. Do not fetch another scrape. */
  isolated?: boolean;
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
  instagramPeopleData = null,
  conferenceData = null,
  pinned = false,
  isolated = false,
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
  const [conferenceResult, setConferenceResult] =
    useState<ConferenceResult | null>(conferenceData);
  const [conferenceSelected, setConferenceSelected] =
    useState<ConferenceAttendee | null>(null);
  const [confirmationState, setConfirmationState] = useState<
    "checking" | "required" | "confirmed"
  >(pinned ? "confirmed" : "checking");
  const [profileLimitHit, setProfileLimitHit] = useState(false);
  const [searchedCount, setSearchedCount] = useState(0);
  const [view, setView] = useState<GraphView>("map");
  const [graphDepth, setGraphDepth] = useState<"2d" | "3d">("3d");
  const pathname = usePathname();
  const router = useRouter();
  const onJobRoute = pathname.startsWith("/jobs/");
  const [localSection, setLocalSection] = useState<FooterTab>("map");
  const footerTab: FooterTab = onJobRoute
    ? sectionFromPathname(pathname)
    : localSection;

  useEffect(() => {
    const surface = footerTab === "profile" ? "ink" : "paper";
    document.body.dataset.surface = surface;
    return () => {
      if (document.body.dataset.surface === surface) {
        delete document.body.dataset.surface;
      }
    };
  }, [footerTab]);
  const [analyticsPlatform, setAnalyticsPlatform] =
    useState<AnalyticsPlatform>(() => {
      if (initialPlatformData.linkedin || initialData?.platform === "linkedin")
        return "linkedin";
      if (initialPlatformData.instagram) return "instagram";
      if (initialPlatformData.facebook) return "facebook";
      if (tiktokData) return "tiktok";
      if (spotifyData) return "spotify";
      if (conferenceData) return "conference";
      return "linkedin";
    });
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRangeId>(
    DEFAULT_ANALYTICS_RANGE,
  );
  const [analyticsLinkedinMode, setAnalyticsLinkedinMode] =
    useState<LinkedInMode>(() =>
      !initialPlatformData.linkedin && companyData ? "company" : "person",
    );
  const [analyticsInstagramMode, setAnalyticsInstagramMode] =
    useState<InstagramMode>(() =>
      initialPlatformData.instagram || initialData?.platform === "instagram"
        ? "company"
        : "person",
    );
  const [analyticsInstagramPersonId, setAnalyticsInstagramPersonId] =
    useState(() => firstAvailableInstagramPersonId(instagramPeopleData));
  const [graphFullscreen, setGraphFullscreen] = useState(false);
  const [linkedinMode, setLinkedinMode] = useState<LinkedInMode>(() =>
    !initialPlatformData.linkedin && companyData ? "company" : "person",
  );
  const [instagramMode, setInstagramMode] = useState<InstagramMode>(() =>
    initialPlatformData.instagram || initialData?.platform === "instagram"
      ? "company"
      : "person",
  );
  const [instagramPersonId, setInstagramPersonId] = useState(() =>
    firstAvailableInstagramPersonId(instagramPeopleData),
  );
  const [platform] = useState<GraphPlatform>(() => {
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
      if (conferenceData) return "conference";
      return "linkedin";
    }
    // Search flow: the search is Instagram-handle shaped, default to Instagram.
    if (initialPlatformData.instagram) return "instagram";
    if (initialData) return platformOfResult(initialData);
    if (initialPlatformData.linkedin) return "linkedin";
    if (initialPlatformData.facebook) return "facebook";
    if (tiktokData) return "tiktok";
    if (spotifyData) return "spotify";
    if (conferenceData) return "conference";
    return "instagram";
  });
  const graphWrapRef = useRef<HTMLDivElement>(null);
  const graphSectionRef = useRef<HTMLDivElement>(null);
  const mobileTabPanelRef = useRef<HTMLDivElement>(null);
  const requestedBudget = useMemo(
    () => estimateScrapeBudget(initialBudget),
    [initialBudget],
  );

  const selectFooterTab = useCallback(
    (tab: FooterTab) => {
      if (onJobRoute) {
        const next = pathWithSection(pathname, tab);
        if (next !== pathname) router.push(next, { scroll: false });
      } else {
        setLocalSection(tab);
      }
      requestAnimationFrame(() => {
        const target =
          tab === "map" ? graphSectionRef.current : mobileTabPanelRef.current;
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [onJobRoute, pathname, router],
  );

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

  const instagramPeople = instagramPeopleData;
  const selectedInstagramPerson = instagramPersonById(
    instagramPeople,
    instagramPersonId,
  );
  const hasInstagramCompany = Boolean(platformResults.instagram);
  const hasInstagramPeople = Boolean(instagramPeople?.people.length);
  const hasInstagram = hasInstagramCompany || hasInstagramPeople;
  const isInstagramPerson =
    platform === "instagram" && instagramMode === "person";
  const activeData =
    platform === "spotify" ||
    platform === "tiktok" ||
    platform === "conference" ||
    (platform === "linkedin" && linkedinMode === "company")
      ? null
      : isInstagramPerson
        ? (selectedInstagramPerson?.result ?? null)
        : (platformResults[platform] ?? null);
  const hasSpotify = Boolean(spotifyData || spotifyResult);
  const hasTikTok = Boolean(tiktokData || tiktokResult);
  const hasConference = Boolean(conferenceData || conferenceResult);
  const hasCompany = Boolean(companyData || companyResult);
  const hasLinkedInPerson = Boolean(platformResults.linkedin);
  const hasLinkedIn = hasLinkedInPerson || hasCompany;
  const instagramModePeople = useMemo(
    () => peopleFromInstagramBundle(instagramPeople),
    [instagramPeople],
  );
  const instagramCompanyGraph = useMemo(() => {
    if (platform !== "instagram" || instagramMode !== "company") return null;
    const base = platformResults.instagram?.graph;
    if (!base) return null;
    return attachInstagramEmployeesToGraph(
      pruneQuietMemberNodes(base),
      instagramPeople,
    );
  }, [instagramMode, instagramPeople, platform, platformResults.instagram]);
  const instagramEmployeeIds = useMemo(
    () =>
      (instagramPeople?.people ?? [])
        .filter(
          (person) =>
            instagramPersonRole(person) === "employee" && person.available,
        )
        .map((person) => person.username),
    [instagramPeople],
  );
  const instagramUnavailableEmployeeIds = useMemo(
    () =>
      (instagramPeople?.people ?? [])
        .filter(
          (person) =>
            instagramPersonRole(person) === "employee" && !person.available,
        )
        .map((person) => person.username),
    [instagramPeople],
  );
  const showInstagramEmployees =
    platform === "instagram" &&
    instagramMode === "company" &&
    instagramEmployeeIds.length + instagramUnavailableEmployeeIds.length > 0;
  const mapGraph = instagramCompanyGraph ?? activeData?.graph;
  const linkedinModePeople = useMemo(
    () => peopleFromSocialResult(platformResults.linkedin),
    [platformResults.linkedin],
  );
  const linkedinPersonId = platformResults.linkedin?.profile.username ?? "";
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
        subtitle: instagramPeopleSubtitle(
          instagram.profile.username,
          instagramPeople,
        ),
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
    if (tiktokResult) {
      sources.push({
        id: "tiktok",
        label: "TikTok",
        title:
          tiktokResult.profile.displayName || tiktokResult.profile.username,
        handle: tiktokResult.profile.username,
        subtitle: `@${tiktokResult.profile.username} · Videos & hashtags`,
      });
    }
    if (conferenceResult) {
      sources.push({
        id: "conference",
        label: "Conference",
        title: conferenceResult.event.name,
        handle: conferenceResult.event.id.replace(/^event:/, ""),
        subtitle: `${conferenceResult.stats.attendeeCount} attendees in graph`,
      });
    }
    return sources;
  }, [companyResult, conferenceResult, instagramPeople, platformResults, tiktokResult]);
  const isConference = platform === "conference";
  const conferenceOnly =
    hasConference &&
    !hasLinkedIn &&
    !hasInstagram &&
    !hasFacebook &&
    !hasSpotify &&
    !hasTikTok;
  const isAlternatePlatform =
    platform === "spotify" ||
    platform === "tiktok" ||
    isLinkedInCompany ||
    isConference;
  const platformHasData =
    platform === "spotify"
      ? hasSpotify
      : platform === "tiktok"
        ? hasTikTok
        : platform === "conference"
          ? hasConference
        : platform === "linkedin"
          ? isLinkedInCompany
            ? hasCompany
            : hasLinkedInPerson
          : platform === "instagram"
            ? isInstagramPerson
              ? Boolean(selectedInstagramPerson?.result)
              : hasInstagramCompany
            : Boolean(activeData);
  const showCompanyViews = platformHasData && isLinkedInCompany;
  const showConferenceViews = platformHasData && isConference;
  const analyticsInstagramPerson = instagramPersonById(
    instagramPeopleData,
    analyticsInstagramPersonId,
  );
  const analyticsSocialData =
    analyticsPlatform === "instagram"
      ? analyticsInstagramMode === "person"
        ? (analyticsInstagramPerson?.result ?? null)
        : (platformResults.instagram ?? null)
      : analyticsPlatform === "linkedin" || analyticsPlatform === "facebook"
        ? (platformResults[analyticsPlatform] ?? null)
        : null;
  const analyticsCircleById = useMemo(() => {
    const m = new Map<number, Circle>();
    for (const c of analyticsSocialData?.graph.circles ?? []) m.set(c.id, c);
    return m;
  }, [analyticsSocialData]);

  const circleById = useMemo(() => {
    const m = new Map<number, Circle>();
    for (const c of activeData?.graph.circles ?? []) m.set(c.id, c);
    return m;
  }, [activeData]);

  const nodeByUsername = useMemo(() => {
    const m = new Map<string, GraphNode>();
    const pool = [
      ...(activeData?.engagers ?? []),
      ...(mapGraph?.nodes ?? activeData?.graph.nodes ?? []),
    ];
    for (const node of pool) {
      if (node.group !== "member") continue;
      m.set(node.id.toLowerCase(), node);
      m.set(node.label.toLowerCase(), node);
    }
    return m;
  }, [activeData, mapGraph]);

  const selectAnalyticsPerson = useCallback(
    (username: string) => {
      const key = username.replace(/^@/, "").trim().toLowerCase();
      if (!key) return;

      const fromPeople =
        (instagramPeople?.people ?? [])
          .map((person) => findMemberInResult(person.result, key))
          .find((node): node is GraphNode => node != null) ?? null;

      const node =
        findMemberInResult(analyticsSocialData, key) ??
        fromPeople ??
        findMemberInResult(platformResults.linkedin, key) ??
        findMemberInResult(platformResults.instagram, key) ??
        findMemberInResult(platformResults.facebook, key) ??
        nodeByUsername.get(key) ??
        null;

      if (!node) return;
      setCompanySelected(null);
      setSpotifySelected(null);
      setTiktokSelected(null);
      setConferenceSelected(null);
      setSelected(node);
    },
    [
      analyticsSocialData,
      instagramPeople,
      nodeByUsername,
      platformResults.facebook,
      platformResults.instagram,
      platformResults.linkedin,
    ],
  );

  const selectMemberByUsername = useCallback(
    (username: string) => {
      const key = username.trim().toLowerCase();
      if (platform === "instagram" && instagramMode === "company") {
        const person = instagramPersonForNode(instagramPeople, {
          id: key,
          label: key,
        });
        if (person?.available) {
          setInstagramPersonId(person.id);
          setInstagramMode("person");
          setSelected(null);
          setView("map");
          setAnalyticsPlatform("instagram");
          selectFooterTab("map");
          return;
        }
      }
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
      const guest = conferenceResult?.attendees.find(
        (person) =>
          person.fullName.toLowerCase() === key ||
          person.lumaName.toLowerCase() === key ||
          person.publicIdentifier?.toLowerCase() === key,
      );
      if (guest) {
        setSelected(null);
        setCompanySelected(null);
        setSpotifySelected(null);
        setTiktokSelected(null);
        setConferenceSelected(guest);
      }
    },
    [conferenceResult, instagramMode, instagramPeople, nodeByUsername, platform, platformResults, selectFooterTab],
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

  const selectAnalyticsConferenceLocation = useCallback(
    (label: string) => {
      const person = conferenceResult?.attendees.find((a) => a.location === label);
      if (!person) return;
      setSelected(null);
      setCompanySelected(null);
      setSpotifySelected(null);
      setTiktokSelected(null);
      setConferenceSelected(person);
    },
    [conferenceResult],
  );

  const selectAnalyticsConferenceCompany = useCallback(
    (label: string) => {
      const person = conferenceResult?.attendees.find((a) => a.company === label);
      if (!person) return;
      setSelected(null);
      setCompanySelected(null);
      setSpotifySelected(null);
      setTiktokSelected(null);
      setConferenceSelected(person);
    },
    [conferenceResult],
  );

  const selectAnalyticsConferenceAttendee = useCallback(
    (id: string) => {
      const person = conferenceResult?.attendees.find((a) => a.id === id);
      if (!person) return;
      setSelected(null);
      setCompanySelected(null);
      setSpotifySelected(null);
      setTiktokSelected(null);
      setConferenceSelected(person);
    },
    [conferenceResult],
  );


  useEffect(() => {
    const onCompany = platform === "linkedin" && linkedinMode === "company";
    if (!onCompany && view === "hierarchy") setView("map");
    if (!onCompany && platform !== "conference" && view === "roster") setView("map");
  }, [platform, linkedinMode, view]);

  useEffect(() => {
    if (!instagramPeopleData) return;
    const current = instagramPersonById(instagramPeopleData, instagramPersonId);
    if (current?.available) return;
    const next = firstAvailableInstagramPersonId(instagramPeopleData);
    if (next) setInstagramPersonId(next);
  }, [instagramPeopleData, instagramPersonId]);

  useEffect(() => {
    if (!instagramPeopleData) return;
    const current = instagramPersonById(
      instagramPeopleData,
      analyticsInstagramPersonId,
    );
    if (current?.available) return;
    const next = firstAvailableInstagramPersonId(instagramPeopleData);
    if (next) setAnalyticsInstagramPersonId(next);
  }, [analyticsInstagramPersonId, instagramPeopleData]);

  useEffect(() => {
    if (pinned || isolated) return;
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
      setConferenceResult(conferenceData);
      setError(null);
      setSelected(null);
      setCompanySelected(null);
      setTiktokSelected(null);
      setConferenceSelected(null);
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
    isolated,
    spotifyData,
    companyData,
    tiktokData,
    conferenceData,
  ]);

  useEffect(() => {
    if (isolated) return;
    if (!pinned && confirmationState !== "confirmed") return;
    if (pinned && confirmationState !== "confirmed") return;
    if (!pinned && data) return;
    if (pinned && (data || conferenceData || conferenceResult)) return;

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
    isolated,
    requestedBudget,
    conferenceData,
    conferenceResult,
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
  ]);

  const selectInstagramMode = useCallback((mode: InstagramMode) => {
    setInstagramMode(mode);
    setSelected(null);
    setView("map");
  }, []);

  const selectLinkedinMode = useCallback((mode: LinkedInMode) => {
    setLinkedinMode(mode);
    setSelected(null);
    setCompanySelected(null);
    setView("map");
  }, []);

  const selectInstagramPerson = useCallback((id: string) => {
    const person = instagramPersonById(instagramPeopleData, id);
    if (!person?.available) return;
    setInstagramPersonId(id);
    setSelected(null);
  }, [instagramPeopleData]);

  const openInstagramEmployeeGraph = useCallback(
    (id: string) => {
      const person = instagramPersonById(instagramPeopleData, id);
      if (!person?.available) return false;
      setInstagramPersonId(person.id);
      setInstagramMode("person");
      setSelected(null);
      setView("map");
      setAnalyticsPlatform("instagram");
      selectFooterTab("map");
      return true;
    },
    [instagramPeopleData, selectFooterTab],
  );

  const selectSocialGraphNode = useCallback(
    (node: GraphNode | null) => {
      if (node && platform === "instagram" && instagramMode === "company") {
        const person = instagramPersonForNode(instagramPeople, node);
        if (person?.available && openInstagramEmployeeGraph(person.id)) {
          return;
        }
      }
      setSelected(node);
    },
    [instagramMode, instagramPeople, openInstagramEmployeeGraph, platform],
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
    !tiktokResult &&
    !conferenceResult
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner handle={handle} />
      </div>
    );
  }

  const legendItems: GraphLegendItem[] = [];
  let flowHint: string | null = null;
  const companyHierarchy =
    footerTab === "map" &&
    view === "hierarchy" &&
    isLinkedInCompany &&
    companyResult
      ? buildCompanyHierarchy(companyResult.company, companyResult.employees)
      : null;
  if (companyHierarchy) {
    flowHint = companyHierarchy.flow;
    for (const band of companyHierarchy.bands) {
      legendItems.push({
        id: band.id,
        color: band.color,
        label: `${band.label} (${band.count})`,
      });
    }
  } else if (footerTab === "map" && view === "map") {
    if (isLinkedInCompany && companyResult) {
      flowHint = "Company → employees (hub and spoke)";
    } else if (platform === "spotify" && spotifyResult) {
      flowHint = "You → playlists → genres ← playlists ← friend";
    } else if (platform === "tiktok" && tiktokResult) {
      flowHint = "You → videos → hashtags";
    } else if (platform === "conference" && conferenceResult) {
      for (const company of conferenceResult.companies.slice(0, 8)) {
        legendItems.push({
          id: company.id,
          color: company.color,
          label: `${company.label}${company.count > 1 ? ` (${company.count})` : ""}`,
        });
      }
      legendItems.push({
        id: "unmatched",
        color: "#6B7280",
        label: "Unmatched guests",
      });
    } else if (activeData && !isAlternatePlatform) {
      legendItems.push({ id: "you", color: SELF_COLOR, label: "You" });
      if (showInstagramEmployees) {
        legendItems.push({
          id: "employees",
          color: INSTAGRAM_EMPLOYEE_COLOR,
          label: "Employees — tap to open",
        });
      }
      for (const cluster of activeData.graph.circles) {
        legendItems.push({
          id: String(cluster.id),
          color: cluster.color,
          label: `${cluster.label}${cluster.size > 0 ? ` (${cluster.size})` : ""}`,
        });
      }
      legendItems.push({
        id: "else",
        color: UNCLUSTERED_COLOR,
        label: "Everyone else",
      });
    }
  }

  const searchPlatform =
    platform === "instagram" ||
    platform === "linkedin" ||
    platform === "facebook"
      ? platform
      : null;
  const viewingAnalytics = footerTab === "analytics";
  const chromePlatform = viewingAnalytics ? analyticsPlatform : platform;

  return (
    <main
      className={`flex h-[calc(100dvh-2.25rem)] flex-col overflow-hidden ${
        footerTab === "profile"
          ? "bg-background text-white"
          : "bg-[#F3EEE4] text-[#161A17]"
      }`}
    >
      {footerTab !== "chat" ? (
        <GraphChrome
          showLinkedInModes={chromePlatform === "linkedin" && hasLinkedIn}
        linkedinMode={viewingAnalytics ? analyticsLinkedinMode : linkedinMode}
        onLinkedinMode={(mode) => {
          if (viewingAnalytics) {
            setAnalyticsLinkedinMode(mode);
            return;
          }
          selectLinkedinMode(mode);
        }}
        linkedinPeople={linkedinModePeople}
        linkedinPersonId={linkedinPersonId}
        hasLinkedInCompany={hasCompany}
        showInstagramModes={chromePlatform === "instagram" && hasInstagram}
        instagramMode={
          viewingAnalytics ? analyticsInstagramMode : instagramMode
        }
        onInstagramMode={(mode) => {
          if (viewingAnalytics) {
            setAnalyticsInstagramMode(mode);
            return;
          }
          selectInstagramMode(mode);
        }}
        instagramPeople={instagramModePeople}
        instagramPersonId={
          viewingAnalytics ? analyticsInstagramPersonId : instagramPersonId
        }
        onInstagramPerson={(id) => {
          if (viewingAnalytics) {
            setAnalyticsInstagramPersonId(id);
            setAnalyticsInstagramMode("person");
            return;
          }
          selectInstagramPerson(id);
        }}
        hasInstagramCompany={hasInstagramCompany}
        showRoster={!viewingAnalytics && (showCompanyViews || showConferenceViews)}
        rosterActive={view === "roster"}
        onToggleRoster={() => {
          setView(view === "roster" ? "map" : "roster");
          selectFooterTab("map");
        }}
        showHierarchy={
          !viewingAnalytics &&
          showCompanyViews &&
          (companyResult?.employees.length ?? 0) > 0
        }
        hierarchyActive={view === "hierarchy"}
        onToggleHierarchy={() => {
          setView(view === "hierarchy" ? "map" : "hierarchy");
          selectFooterTab("map");
        }}
        section={footerTab}
        showSearch={
          !isLinkedInCompany &&
          !isAlternatePlatform &&
          Boolean(activeData) &&
          view === "map"
        }
        searchNodes={mapGraph?.nodes ?? []}
        searchSelectedId={selected?.id ?? null}
        onSearchSelect={selectSocialGraphNode}
        searchPlatform={searchPlatform}
        showDepth={
          !isAlternatePlatform && Boolean(activeData) && view === "map"
        }
        depth={graphDepth}
        onDepth={setGraphDepth}
        fullscreen={graphFullscreen}
        onToggleFullscreen={() => setGraphFullscreen((open) => !open)}
        howTo={
          platform !== "spotify" &&
          platform !== "tiktok" &&
          !isLinkedInCompany
            ? isConference
              ? "conference"
              : "social"
            : null
        }
        legend={legendItems}
        flowHint={flowHint}
      />
      ) : null}
      <div className="relative flex-1 min-h-0">
        <div
          ref={graphSectionRef}
          className={`relative h-full min-h-0 ${footerTab !== "map" ? "hidden" : ""}`}
        >
          <motion.div
            ref={graphWrapRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className={`relative h-full overflow-hidden bg-[#F3EEE4] ${
              graphFullscreen ? "fixed inset-0 z-[60] h-[100dvh] bg-[#F3EEE4]" : ""
            }`}
          >
            {graphFullscreen ? (
              <button
                type="button"
                onClick={() => setGraphFullscreen(false)}
                aria-label="Exit full screen"
                className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-30 flex h-9 w-9 items-center justify-center rounded-full border border-[#D5CDBF] bg-[#FBF8F2] text-[#161A17] transition hover:bg-[#E7E0D4]"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <div
              className={`map-toolbar pointer-events-none absolute inset-x-0 z-30 flex items-center gap-2 px-3 ${
                graphFullscreen
                  ? "top-[max(0.75rem,env(safe-area-inset-top))]"
                  : "top-3"
              }`}
            >
              {platform === "instagram" && hasInstagram ? (
                <div className="pointer-events-auto relative z-10 shrink-0">
                  <InstagramModeControls
                    tone="glass"
                    mode={instagramMode}
                    onModeChange={selectInstagramMode}
                    people={instagramModePeople}
                    personId={instagramPersonId}
                    onPersonIdChange={selectInstagramPerson}
                    hasCompany={hasInstagramCompany}
                    avatarPlatform="instagram"
                  />
                </div>
              ) : null}
              {platform === "linkedin" && hasLinkedIn ? (
                <div className="pointer-events-auto relative z-10 shrink-0">
                  <InstagramModeControls
                    tone="glass"
                    mode={linkedinMode}
                    onModeChange={selectLinkedinMode}
                    people={linkedinModePeople}
                    personId={linkedinPersonId}
                    onPersonIdChange={() => selectLinkedinMode("person")}
                    hasCompany={hasCompany}
                    avatarPlatform="linkedin"
                  />
                </div>
              ) : null}
              {view === "map" &&
              !isLinkedInCompany &&
              !isAlternatePlatform &&
              activeData ? (
                <div className="map-toolbar-search pointer-events-auto min-w-0 flex-1">
                  <GraphNodeSearch
                    nodes={mapGraph?.nodes ?? []}
                    selectedId={selected?.id ?? null}
                    onSelect={selectSocialGraphNode}
                    platform={searchPlatform}
                    variant="glass"
                  />
                </div>
              ) : null}
            </div>
            <div className="absolute inset-0">
              {isLinkedInCompany ? (
                companyResult ? (
                  view === "roster" ? (
                    <CompanyRosterTable
                      employees={companyResult.employees}
                      selectedId={companySelected?.id ?? null}
                      onSelect={setCompanySelected}
                      className="absolute inset-0"
                    />
                  ) : view === "hierarchy" ? (
                    <CompanyHierarchyGraph
                      key={`hierarchy-${companyResult.company.id}`}
                      company={companyResult.company}
                      employees={companyResult.employees}
                      className="absolute inset-0"
                      selectedId={companySelected?.id ?? null}
                      onSelect={(employeeId) => {
                        if (!employeeId) {
                          setCompanySelected(null);
                          return;
                        }
                        setCompanySelected(
                          companyResult.employees.find((emp) => emp.id === employeeId) ??
                            null,
                        );
                      }}
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
                    </>
                  )
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                    <CompanyIcon className="h-8 w-8 text-[#0A66C2]" />
                    <div className="text-sm font-medium text-[#161A17]">
                      No company snapshot yet
                    </div>
                    <p className="max-w-sm text-xs leading-relaxed text-[#5E665F]">
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
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                    <SpotifyIcon className="h-8 w-8 text-[#1DB954]" />
                    <div className="text-sm font-medium text-[#161A17]">
                      No Spotify snapshot yet
                    </div>
                    <p className="max-w-sm text-xs leading-relaxed text-[#5E665F]">
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
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                    <TikTokIcon className="h-8 w-8 text-[#FE2C55]" />
                    <div className="text-sm font-medium text-[#161A17]">
                      No TikTok snapshot yet
                    </div>
                    <p className="max-w-sm text-xs leading-relaxed text-[#5E665F]">
                      Import a TikTok profile + posts scrape to unlock visibility
                      views here.
                    </p>
                  </div>
                )
              ) : platform === "conference" ? (
                conferenceResult ? (
                  view === "roster" ? (
                    <ConferenceRosterTable
                      attendees={conferenceResult.attendees}
                      selectedId={conferenceSelected?.id ?? null}
                      onSelect={setConferenceSelected}
                      className="absolute inset-0"
                    />
                  ) : (
                    <>
                      <ConferenceGraphVisualizer
                        key={`conference-${conferenceResult.event.id}`}
                        data={conferenceResult.graph}
                        className="absolute inset-0"
                        selectedId={conferenceSelected?.id ?? null}
                        onSelect={(node: ConferenceGraphNode | null) => {
                          if (!node || node.kind !== "attendee") {
                            setConferenceSelected(null);
                            return;
                          }
                          const person = conferenceResult.attendees.find(
                            (a) => a.id === node.id,
                          );
                          setConferenceSelected(person ?? null);
                        }}
                      />
                    </>
                  )
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                    <ConferenceIcon className="h-8 w-8 text-[#E11D48]" />
                    <div className="text-sm font-medium text-[#161A17]">
                      No conference snapshot yet
                    </div>
                    <p className="max-w-sm text-xs leading-relaxed text-[#5E665F]">
                      Import a Luma guest list + LinkedIn people-search export to
                      unlock this graph.
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
                  <div className="text-sm font-medium text-[#161A17]">
                    No {PLATFORM_LABEL[platform]}
                    {platform === "linkedin" && linkedinMode === "person"
                      ? " person"
                      : platform === "instagram"
                        ? instagramMode === "person"
                          ? " person"
                          : " company"
                        : ""}{" "}
                    snapshot yet
                  </div>
                  <p className="max-w-sm text-xs leading-relaxed text-[#5E665F]">
                    Switch to a platform tab that has a loaded snapshot to explore
                    the graph.
                  </p>
                </div>
              ) : (
                <>
                  {graphDepth === "3d" ? (
                    <GraphVisualizer3D
                      key={`graph3d-${platform}-${activeData.profile.username}`}
                      data={mapGraph ?? activeData.graph}
                      className="absolute inset-0"
                      selectedId={selected?.id ?? null}
                      onSelect={selectSocialGraphNode}
                      labelStyle={platform === "instagram" ? "handles" : "auto"}
                      platform={
                        platform === "instagram" ||
                        platform === "linkedin" ||
                        platform === "facebook"
                          ? platform
                          : null
                      }
                      featuredIds={
                        showInstagramEmployees ? instagramEmployeeIds : undefined
                      }
                      mutedFeaturedIds={
                        showInstagramEmployees
                          ? instagramUnavailableEmployeeIds
                          : undefined
                      }
                      hintText={
                        showInstagramEmployees
                          ? "Tap an employee to open their graph"
                          : undefined
                      }
                    />
                  ) : (
                    <GraphVisualizer
                      key={`graph-${platform}-${activeData.profile.username}`}
                      data={mapGraph ?? activeData.graph}
                      className="absolute inset-0 max-sm:touch-pan-y sm:touch-none"
                      selectedId={selected?.id ?? null}
                      onSelect={selectSocialGraphNode}
                      labelStyle={platform === "instagram" ? "handles" : "auto"}
                      platform={
                        platform === "instagram" ||
                        platform === "linkedin" ||
                        platform === "facebook"
                          ? platform
                          : null
                      }
                      featuredIds={
                        showInstagramEmployees ? instagramEmployeeIds : undefined
                      }
                      mutedFeaturedIds={
                        showInstagramEmployees
                          ? instagramUnavailableEmployeeIds
                          : undefined
                      }
                      hintText={
                        showInstagramEmployees
                          ? "Tap an employee to open their graph"
                          : undefined
                      }
                    />
                  )}

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
          className={`h-full overflow-y-auto ${footerTab === "map" ? "hidden" : ""}`}
        >
            {footerTab === "analytics" && (
              <AnalyticsPanel
                socialResults={platformResults}
                spotifyResult={spotifyResult}
                companyResult={companyResult}
                tiktokResult={tiktokResult}
                conferenceResult={conferenceResult}
                instagramPeople={instagramPeople}
                instagramMode={analyticsInstagramMode}
                onInstagramModeChange={setAnalyticsInstagramMode}
                instagramPersonId={analyticsInstagramPersonId}
                onInstagramPersonIdChange={setAnalyticsInstagramPersonId}
                linkedinMode={analyticsLinkedinMode}
                onLinkedinModeChange={setAnalyticsLinkedinMode}
                platform={analyticsPlatform}
                onPlatformChange={setAnalyticsPlatform}
                range={analyticsRange}
                onRangeChange={setAnalyticsRange}
                onSelectUsername={selectAnalyticsPerson}
                selectedUsername={selected?.id ?? selected?.label ?? null}
                onSelectTikTokVideoId={selectAnalyticsTikTokVideo}
                onSelectTikTokHashtag={selectAnalyticsTikTokHashtag}
                onSelectSpotifyGenre={selectAnalyticsSpotifyGenre}
                onSelectCompanyLocation={selectAnalyticsCompanyLocation}
                onSelectCompanySchool={selectAnalyticsCompanySchool}
                onSelectConferenceLocation={selectAnalyticsConferenceLocation}
                onSelectConferenceCompany={selectAnalyticsConferenceCompany}
                onSelectConferenceAttendee={selectAnalyticsConferenceAttendee}
              />
            )}

            <div className={footerTab === "chat" ? "h-full overflow-hidden" : "hidden"}>
              <ChatPanel
                key={handle}
                handle={handle}
                pinned={pinned}
                sources={chatSources}
                budget={requestedBudget}
                onSelectUsername={selectMemberByUsername}
                onClose={() => selectFooterTab("map")}
              />
            </div>

            {footerTab === "profile" ? <ProfileComingSoon /> : null}
        </div>
      </div>

      {/* Node profile modals (portal overlays) */}
      {selected ? (
        <PersonPanel
          node={selected}
          proximityRing={
            selected.circle >= 0
              ? PROXIMITY_RINGS[selected.circle]
              : undefined
          }
          friendCluster={
            selected.clusterId != null && selected.clusterId >= 0
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
                : platform === "linkedin" ||
                    platform === "instagram" ||
                    platform === "facebook"
                  ? platform
                  : null
          }
        />
      ) : isLinkedInCompany ? (
        <CompanyEmployeePanel
          employee={companySelected}
          onClose={() => setCompanySelected(null)}
        />
      ) : isConference ? (
        <ConferenceAttendeePanel
          attendee={conferenceSelected}
          onClose={() => setConferenceSelected(null)}
        />
      ) : null}
    </main>
  );
}
