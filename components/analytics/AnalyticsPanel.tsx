"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Grid3X3, User } from "lucide-react";
import type { ScrapeResult, SocialSourcePlatform } from "@/lib/types";
import type { SpotifyTasteResult } from "@/lib/spotifyTypes";
import type { CompanyResult } from "@/lib/companyTypes";
import type { TikTokResult } from "@/lib/tiktokTypes";
import {
  DEFAULT_ANALYTICS_RANGE,
  type AnalyticsRangeId,
} from "@/lib/analytics";
import { resolveAnalyticsMediaIdentity } from "@/lib/mediaIdentity";
import {
  CompanyIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  SpotifyIcon,
  TikTokIcon,
} from "@/components/PlatformIcons";
import TimeRangeControl from "@/components/analytics/TimeRangeControl";
import SocialAnalyticsBody from "@/components/analytics/SocialAnalyticsBody";
import TikTokAnalyticsBody from "@/components/analytics/TikTokAnalyticsBody";
import SpotifyAnalyticsBody from "@/components/analytics/SpotifyAnalyticsBody";
import CompanyAnalyticsBody from "@/components/analytics/CompanyAnalyticsBody";

export type AnalyticsPlatform =
  | "linkedin"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "spotify";

export type AnalyticsView = "summary" | "grid";

type LinkedInMode = "person" | "company";

const PLATFORM_TABS = [
  { id: "linkedin" as const, label: "LinkedIn", Icon: LinkedInIcon },
  { id: "instagram" as const, label: "Instagram", Icon: InstagramIcon },
  { id: "facebook" as const, label: "Facebook", Icon: FacebookIcon },
  { id: "tiktok" as const, label: "TikTok", Icon: TikTokIcon },
  { id: "spotify" as const, label: "Spotify", Icon: SpotifyIcon },
] as const;

const TAB =
  "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium transition";
const TAB_ACTIVE = "bg-white/15 text-white";
const TAB_AVAILABLE = "text-white/55 hover:bg-white/10 hover:text-white/80";
const TAB_DISABLED = "text-white/30 hover:bg-white/5 hover:text-white/45";
const LINKEDIN_ACTIVE = "bg-[#0A66C2]/25 text-white";

interface Props {
  socialResults: Partial<Record<SocialSourcePlatform, ScrapeResult | null>>;
  spotifyResult?: SpotifyTasteResult | null;
  companyResult?: CompanyResult | null;
  tiktokResult?: TikTokResult | null;
  /** Independent from Map — controlled or uncontrolled. */
  platform?: AnalyticsPlatform;
  onPlatformChange?: (platform: AnalyticsPlatform) => void;
  range?: AnalyticsRangeId;
  onRangeChange?: (range: AnalyticsRangeId) => void;
  /** Summary tiles vs person×post engagement grid (under Person). */
  view?: AnalyticsView;
  onViewChange?: (view: AnalyticsView) => void;
  /** Optional grid UI rendered when view === "grid". */
  gridContent?: ReactNode;
  onSelectUsername?: (username: string) => void;
  selectedUsername?: string | null;
  onSelectTikTokVideoId?: (id: string) => void;
  onSelectTikTokHashtag?: (label: string) => void;
  onSelectSpotifyGenre?: (label: string) => void;
  onSelectCompanyLocation?: (label: string) => void;
  onSelectCompanySchool?: (label: string) => void;
  className?: string;
}

function defaultPlatform(props: Props): AnalyticsPlatform {
  if (props.socialResults.linkedin) return "linkedin";
  if (props.socialResults.instagram) return "instagram";
  if (props.socialResults.facebook) return "facebook";
  if (props.tiktokResult) return "tiktok";
  if (props.spotifyResult) return "spotify";
  return "linkedin";
}

function socialHasGrid(
  social: ScrapeResult | null | undefined,
): social is ScrapeResult {
  return Boolean(social?.posts && social.posts.length > 0);
}

export default function AnalyticsPanel({
  socialResults,
  spotifyResult = null,
  companyResult = null,
  tiktokResult = null,
  platform: controlledPlatform,
  onPlatformChange,
  range: controlledRange,
  onRangeChange,
  view: controlledView,
  onViewChange,
  gridContent = null,
  onSelectUsername,
  selectedUsername,
  onSelectTikTokVideoId,
  onSelectTikTokHashtag,
  onSelectSpotifyGenre,
  onSelectCompanyLocation,
  onSelectCompanySchool,
  className = "",
}: Props) {
  const [internalPlatform, setInternalPlatform] = useState<AnalyticsPlatform>(
    () => defaultPlatform({ socialResults, spotifyResult, tiktokResult }),
  );
  const [internalRange, setInternalRange] = useState<AnalyticsRangeId>(
    DEFAULT_ANALYTICS_RANGE,
  );
  const [internalView, setInternalView] = useState<AnalyticsView>("summary");
  const [linkedinMode, setLinkedinMode] = useState<LinkedInMode>(() =>
    !socialResults.linkedin && companyResult ? "company" : "person",
  );

  const platform = controlledPlatform ?? internalPlatform;
  const range = controlledRange ?? internalRange;
  const view = controlledView ?? internalView;

  const setPlatform = (next: AnalyticsPlatform) => {
    onPlatformChange?.(next);
    if (controlledPlatform == null) setInternalPlatform(next);
  };

  const setRange = (next: AnalyticsRangeId) => {
    onRangeChange?.(next);
    if (controlledRange == null) setInternalRange(next);
  };

  const setView = (next: AnalyticsView) => {
    onViewChange?.(next);
    if (controlledView == null) setInternalView(next);
  };

  const availability = useMemo(
    () => ({
      linkedin: Boolean(socialResults.linkedin) || Boolean(companyResult),
      instagram: Boolean(socialResults.instagram),
      facebook: Boolean(socialResults.facebook),
      tiktok: Boolean(tiktokResult),
      spotify: Boolean(spotifyResult),
    }),
    [socialResults, companyResult, tiktokResult, spotifyResult],
  );

  const activeSocial =
    platform === "linkedin"
      ? socialResults.linkedin
      : platform === "instagram"
        ? socialResults.instagram
        : platform === "facebook"
          ? socialResults.facebook
          : null;

  const canShowGrid = socialHasGrid(activeSocial);
  const showLinkedInPerson = Boolean(socialResults.linkedin);
  const showLinkedInCompany = Boolean(companyResult);
  const showLinkedInSubnav =
    platform === "linkedin" && (showLinkedInPerson || showLinkedInCompany);

  useEffect(() => {
    if (view === "grid" && !canShowGrid) setView("summary");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when grid becomes unavailable
  }, [canShowGrid, view]);

  const selectPerson = () => {
    setLinkedinMode("person");
    setView("summary");
  };

  const selectCompany = () => {
    setLinkedinMode("company");
    setView("summary");
  };

  const handlePlatformClick = (id: AnalyticsPlatform) => {
    setPlatform(id);
    setView("summary");
    if (id === "linkedin") {
      setLinkedinMode(
        socialResults.linkedin ? "person" : companyResult ? "company" : "person",
      );
    }
  };

  const showingCompany =
    platform === "linkedin" &&
    (linkedinMode === "company" ||
      (!socialResults.linkedin && Boolean(companyResult)));

  const showingPerson =
    (platform === "linkedin" && !showingCompany && showLinkedInPerson) ||
    platform === "facebook" ||
    platform === "instagram";

  const showPersonGridSubnav = showingPerson && canShowGrid;

  const mediaIdentity = useMemo(
    () =>
      resolveAnalyticsMediaIdentity({
        platform,
        linkedinMode: showingCompany ? "company" : "person",
        socialResults,
        spotifyResult,
        companyResult,
        tiktokResult,
      }),
    [
      platform,
      showingCompany,
      socialResults,
      spotifyResult,
      companyResult,
      tiktokResult,
    ],
  );

  const body = (() => {
    if (view === "grid") {
      return (
        gridContent ?? (
          <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/45">
            Engagement grid is open. Tap a cell to inspect comments and
            reactions.
          </p>
        )
      );
    }

    if (platform === "spotify") {
      if (!spotifyResult) {
        return <EmptyState message="No Spotify analytics available yet." />;
      }
      return (
        <SpotifyAnalyticsBody
          data={spotifyResult}
          range={range}
          onSelectGenre={onSelectSpotifyGenre}
        />
      );
    }

    if (platform === "tiktok") {
      if (!tiktokResult) {
        return <EmptyState message="No TikTok analytics available yet." />;
      }
      return (
        <TikTokAnalyticsBody
          data={tiktokResult}
          range={range}
          onSelectVideoId={onSelectTikTokVideoId}
          onSelectHashtag={onSelectTikTokHashtag}
        />
      );
    }

    if (showingCompany && companyResult) {
      return (
        <CompanyAnalyticsBody
          data={companyResult}
          onSelectLocation={onSelectCompanyLocation}
          onSelectSchool={onSelectCompanySchool}
        />
      );
    }

    if (!activeSocial) {
      return (
        <EmptyState message={`No ${platform} analytics available yet.`} />
      );
    }

    return (
      <SocialAnalyticsBody
        data={activeSocial}
        range={range}
        platform={platform as SocialSourcePlatform}
        onSelectUsername={onSelectUsername}
        selectedUsername={selectedUsername}
      />
    );
  })();

  const rangeDisabled = showingCompany || view === "grid";

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {PLATFORM_TABS.map(({ id, label, Icon }) => {
            const available = availability[id];
            const selected = platform === id;
            return (
              <button
                key={id}
                type="button"
                title={label}
                onClick={() => handlePlatformClick(id)}
                className={`${TAB} ${
                  selected
                    ? id === "linkedin"
                      ? LINKEDIN_ACTIVE
                      : TAB_ACTIVE
                    : available
                      ? TAB_AVAILABLE
                      : TAB_DISABLED
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {mediaIdentity ? (
            <a
              href={mediaIdentity.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex max-w-full items-center gap-1 self-start rounded-full border border-white/15 bg-gradient-to-r from-white/10 via-white/5 to-white/10 px-3 py-1.5 text-sm font-medium text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:border-white/25 hover:from-white/15 hover:to-white/10 hover:text-white"
            >
              <span className="bg-gradient-to-b from-white to-white/55 bg-clip-text text-base font-semibold text-transparent drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]">
                @
              </span>
              <span className="truncate">{mediaIdentity.tag}</span>
            </a>
          ) : (
            <span />
          )}

          {view !== "grid" ? (
            <TimeRangeControl
              value={range}
              onChange={setRange}
              disabled={rangeDisabled}
              className="max-w-full"
            />
          ) : null}
        </div>

        {(showLinkedInSubnav || showPersonGridSubnav) && (
          <div className="flex flex-wrap items-center gap-2">
            {showLinkedInSubnav ? (
              <div className="inline-flex max-w-full flex-wrap self-start rounded-lg border border-white/10 bg-black/30 p-0.5">
                {showLinkedInPerson ? (
                  <button
                    type="button"
                    onClick={selectPerson}
                    className={`${TAB} ${
                      !showingCompany ? TAB_ACTIVE : TAB_AVAILABLE
                    }`}
                  >
                    <User className="h-3.5 w-3.5" />
                    Person
                  </button>
                ) : null}
                {showLinkedInCompany ? (
                  <button
                    type="button"
                    onClick={selectCompany}
                    className={`${TAB} ${
                      showingCompany ? TAB_ACTIVE : TAB_AVAILABLE
                    }`}
                  >
                    <CompanyIcon className="h-3.5 w-3.5" />
                    Company
                  </button>
                ) : null}
              </div>
            ) : null}

            {showPersonGridSubnav ? (
              <div className="inline-flex self-start rounded-lg border border-white/10 bg-black/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setView("summary")}
                  className={`${TAB} ${
                    view !== "grid" ? TAB_ACTIVE : TAB_AVAILABLE
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  className={`${TAB} ${
                    view === "grid" ? TAB_ACTIVE : TAB_AVAILABLE
                  }`}
                >
                  <Grid3X3 className="h-3.5 w-3.5" />
                  Grid
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {body}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/40">
      {message}
    </div>
  );
}
