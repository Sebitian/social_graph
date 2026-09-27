"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Inter } from "next/font/google";
import { User } from "lucide-react";
import type { ScrapeResult, SocialSourcePlatform } from "@/lib/types";
import type { SpotifyTasteResult } from "@/lib/spotifyTypes";
import type { CompanyResult } from "@/lib/companyTypes";
import type { ConferenceResult } from "@/lib/conferenceTypes";
import type { TikTokResult } from "@/lib/tiktokTypes";
import {
  DEFAULT_ANALYTICS_RANGE,
  type AnalyticsRangeId,
} from "@/lib/analytics";
import { resolveAnalyticsMediaIdentity } from "@/lib/mediaIdentity";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  SpotifyIcon,
  TikTokIcon,
  ConferenceIcon,
} from "@/components/PlatformIcons";
import TimeRangeControl from "@/components/analytics/TimeRangeControl";
import HandleTree from "@/components/analytics/HandleTree";
import SocialAnalyticsBody from "@/components/analytics/SocialAnalyticsBody";
import TikTokAnalyticsBody from "@/components/analytics/TikTokAnalyticsBody";
import SpotifyAnalyticsBody from "@/components/analytics/SpotifyAnalyticsBody";
import CompanyAnalyticsBody from "@/components/analytics/CompanyAnalyticsBody";
import ConferenceAnalyticsBody from "@/components/analytics/ConferenceAnalyticsBody";
import InstagramModeControls, {
  peopleFromInstagramBundle,
  peopleFromSocialResult,
} from "@/components/InstagramModeControls";
import type {
  InstagramMode,
  InstagramPeopleResult,
} from "@/lib/instagramPeople";
import {
  firstAvailableInstagramPersonId,
  instagramPersonById,
} from "@/lib/instagramPeople";
import { useSidebarSlot } from "@/components/SidebarSlots";

export type AnalyticsPlatform =
  | "linkedin"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "spotify"
  | "conference";

export type AnalyticsView = "summary" | "grid";

type LinkedInMode = "person" | "company";

const PLATFORM_TABS = [
  { id: "linkedin" as const, label: "LinkedIn", Icon: LinkedInIcon },
  { id: "instagram" as const, label: "Instagram", Icon: InstagramIcon },
  { id: "facebook" as const, label: "Facebook", Icon: FacebookIcon },
  { id: "tiktok" as const, label: "TikTok", Icon: TikTokIcon },
  { id: "spotify" as const, label: "Spotify", Icon: SpotifyIcon },
  { id: "conference" as const, label: "Conference", Icon: ConferenceIcon },
] as const;

const TAB =
  "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium transition";
const TAB_ACTIVE =
  "bg-[#FBF8F2] text-[#161A17] shadow-[0_1px_2px_rgba(22,26,23,0.06)] ring-1 ring-[#D5CDBF]";
const TAB_AVAILABLE = "text-[#5E665F] hover:bg-[#E7E0D4] hover:text-[#161A17]";
const TAB_DISABLED = "text-[#5E665F]/70 hover:bg-[#F3EEE4] hover:text-[#5E665F]";
const LINKEDIN_ACTIVE = TAB_ACTIVE;

const sans = Inter({ subsets: ["latin"], weight: ["400", "500", "600"] });

interface Props {
  socialResults: Partial<Record<SocialSourcePlatform, ScrapeResult | null>>;
  spotifyResult?: SpotifyTasteResult | null;
  companyResult?: CompanyResult | null;
  tiktokResult?: TikTokResult | null;
  conferenceResult?: ConferenceResult | null;
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
  onSelectConferenceLocation?: (label: string) => void;
  onSelectConferenceCompany?: (label: string) => void;
  onSelectConferenceAttendee?: (id: string) => void;
  instagramPeople?: InstagramPeopleResult | null;
  instagramMode?: InstagramMode;
  onInstagramModeChange?: (mode: InstagramMode) => void;
  instagramPersonId?: string;
  onInstagramPersonIdChange?: (id: string) => void;
  linkedinMode?: LinkedInMode;
  onLinkedinModeChange?: (mode: LinkedInMode) => void;
  className?: string;
}

function defaultPlatform(props: Props): AnalyticsPlatform {
  if (props.socialResults.linkedin) return "linkedin";
  if (props.socialResults.instagram) return "instagram";
  if (props.socialResults.facebook) return "facebook";
  if (props.tiktokResult) return "tiktok";
  if (props.spotifyResult) return "spotify";
  if (props.conferenceResult) return "conference";
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
  conferenceResult = null,
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
  onSelectConferenceLocation,
  onSelectConferenceCompany,
  onSelectConferenceAttendee,
  instagramPeople = null,
  instagramMode: controlledInstagramMode,
  onInstagramModeChange,
  instagramPersonId: controlledInstagramPersonId,
  onInstagramPersonIdChange,
  linkedinMode: controlledLinkedinMode,
  onLinkedinModeChange,
  className = "",
}: Props) {
  const [internalPlatform, setInternalPlatform] = useState<AnalyticsPlatform>(
    () => defaultPlatform({ socialResults, spotifyResult, tiktokResult, conferenceResult }),
  );
  const [internalRange, setInternalRange] = useState<AnalyticsRangeId>(
    DEFAULT_ANALYTICS_RANGE,
  );
  const [internalView, setInternalView] = useState<AnalyticsView>("summary");
  const [internalLinkedinMode, setInternalLinkedinMode] =
    useState<LinkedInMode>(() =>
      !socialResults.linkedin && companyResult ? "company" : "person",
    );
  const linkedinMode = controlledLinkedinMode ?? internalLinkedinMode;
  const setLinkedinMode = (next: LinkedInMode) => {
    onLinkedinModeChange?.(next);
    if (controlledLinkedinMode == null) setInternalLinkedinMode(next);
  };
  const [internalInstagramMode, setInternalInstagramMode] =
    useState<InstagramMode>(() =>
      socialResults.instagram ? "company" : "person",
    );
  const [internalInstagramPersonId, setInternalInstagramPersonId] =
    useState(() => firstAvailableInstagramPersonId(instagramPeople));

  const platform = controlledPlatform ?? internalPlatform;
  const range = controlledRange ?? internalRange;
  const view = controlledView ?? internalView;
  const instagramMode = controlledInstagramMode ?? internalInstagramMode;
  const instagramPersonId = controlledInstagramPersonId ?? internalInstagramPersonId;
  const selectedInstagramPerson = instagramPersonById(
    instagramPeople,
    instagramPersonId,
  );

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
      instagram:
        Boolean(socialResults.instagram) ||
        Boolean(instagramPeople?.people.length),
      facebook: Boolean(socialResults.facebook),
      tiktok: Boolean(tiktokResult),
      spotify: Boolean(spotifyResult),
      conference: Boolean(conferenceResult),
    }),
    [socialResults, companyResult, tiktokResult, spotifyResult, conferenceResult, instagramPeople],
  );

  const instagramSocial =
    instagramMode === "person"
      ? (selectedInstagramPerson?.result ?? null)
      : (socialResults.instagram ?? null);

  const activeSocial =
    platform === "linkedin"
      ? socialResults.linkedin
      : platform === "instagram"
        ? instagramSocial
        : platform === "facebook"
          ? socialResults.facebook
          : null;

  const canShowGrid = socialHasGrid(activeSocial);
  const showLinkedInPerson = Boolean(socialResults.linkedin);
  const showLinkedInCompany = Boolean(companyResult);
  const showLinkedInSubnav =
    platform === "linkedin" && (showLinkedInPerson || showLinkedInCompany);
  const showInstagramCompany = Boolean(socialResults.instagram);
  const showInstagramPeople = Boolean(instagramPeople?.people.length);
  const showInstagramSubnav =
    platform === "instagram" && (showInstagramCompany || showInstagramPeople);

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

  const setInstagramMode = (next: InstagramMode) => {
    onInstagramModeChange?.(next);
    if (controlledInstagramMode == null) setInternalInstagramMode(next);
    setView("summary");
  };

  const setInstagramPersonId = (next: string) => {
    onInstagramPersonIdChange?.(next);
    if (controlledInstagramPersonId == null) {
      setInternalInstagramPersonId(next);
    }
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
    if (id === "instagram") {
      setInstagramMode(socialResults.instagram ? "company" : "person");
    }
  };

  const showingCompany =
    platform === "linkedin" &&
    (linkedinMode === "company" ||
      (!socialResults.linkedin && Boolean(companyResult)));

  const showingPerson =
    (platform === "linkedin" && !showingCompany && showLinkedInPerson) ||
    platform === "facebook" ||
    (platform === "instagram" && Boolean(activeSocial));

  const showPersonGridSubnav = showingPerson && canShowGrid;

  const mediaIdentity = useMemo(
    () =>
      platform === "conference"
        ? null
        : resolveAnalyticsMediaIdentity({
            platform,
            linkedinMode: showingCompany ? "company" : "person",
            socialResults: {
              ...socialResults,
              instagram: instagramSocial ?? socialResults.instagram,
            },
            spotifyResult,
            companyResult,
            tiktokResult,
          }),
    [
      platform,
      showingCompany,
      socialResults,
      instagramSocial,
      spotifyResult,
      companyResult,
      tiktokResult,
    ],
  );

  const body = (() => {
    if (view === "grid") {
      return (
        gridContent ?? (
          <p className="rounded-2xl border border-[#D5CDBF] bg-[#FBF8F2] px-4 py-3 text-xs text-[#5E665F]">
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

    if (platform === "conference") {
      if (!conferenceResult) {
        return <EmptyState message="No conference analytics available yet." />;
      }
      return (
        <ConferenceAnalyticsBody
          data={conferenceResult}
          onSelectLocation={onSelectConferenceLocation}
          onSelectCompany={onSelectConferenceCompany}
          onSelectAttendee={onSelectConferenceAttendee}
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

  const analyticsTabs =
    availability.conference &&
    !availability.linkedin &&
    !availability.instagram &&
    !availability.facebook &&
    !availability.tiktok &&
    !availability.spotify
      ? PLATFORM_TABS.filter((tab) => tab.id === "conference")
      : PLATFORM_TABS.filter(
          (tab) => tab.id !== "conference" || availability.conference,
        );
  const platformsInSidebar = useSidebarSlot("left") != null;
  const rangeDisabled = showingCompany || platform === "conference" || view === "grid";

  return (
    <div className={`${sans.className} flex flex-col gap-3 text-[#161A17] ${className}`}>
      <div className="flex flex-col gap-2">
        {platformsInSidebar ? null : (
          <div className="flex flex-wrap items-center gap-1">
            {analyticsTabs.map(({ id, label, Icon }) => {
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
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {mediaIdentity ? (
              <a
                href={mediaIdentity.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1 self-start rounded-full border border-[#D5CDBF] bg-[#FBF8F2] px-3 py-1.5 text-sm font-medium text-[#161A17] transition hover:border-[#161A17]/25"
              >
                <span className="text-base font-semibold text-[#0F766E]">
                  @
                </span>
                <span className="truncate">{mediaIdentity.tag}</span>
              </a>
            ) : null}

            {showPersonGridSubnav ? (
              <div className="inline-flex self-start rounded-lg border border-[#D5CDBF] bg-[#F3EEE4] p-0.5">
                <button
                  type="button"
                  onClick={() => setView("summary")}
                  className={`${TAB} ${TAB_ACTIVE}`}
                >
                  <User className="h-3.5 w-3.5" />
                  Overview
                </button>
              </div>
            ) : null}
          </div>

          {view !== "grid" ? (
            <TimeRangeControl
              value={range}
              onChange={setRange}
              disabled={rangeDisabled}
              className="max-w-full"
            />
          ) : null}
        </div>

        {(showLinkedInSubnav || showInstagramSubnav) && (
          <div className="flex flex-wrap items-center gap-2">
            {showInstagramSubnav && showInstagramPeople ? (
              <HandleTree
                root={{
                  id: "company",
                  handle:
                    socialResults.instagram?.profile.username ||
                    instagramPeople?.companyHandle ||
                    "company",
                  selected: instagramMode === "company",
                  disabled: !showInstagramCompany,
                  title: showInstagramCompany
                    ? "Company account"
                    : "Company snapshot not loaded yet",
                  onClick: () => {
                    if (!showInstagramCompany) return;
                    setInstagramMode("company");
                  },
                }}
                nodes={peopleFromInstagramBundle(instagramPeople).map(
                  (person) => ({
                    id: person.id,
                    handle: person.username,
                    selected:
                      instagramMode === "person" && person.id === instagramPersonId,
                    disabled: !person.available,
                    title: person.available
                      ? `@${person.username}`
                      : person.unavailableReason,
                    onClick: () => {
                      if (!person.available) return;
                      setInstagramPersonId(person.id);
                      setInstagramMode("person");
                    },
                  }),
                )}
              />
            ) : showInstagramSubnav ? (
              <InstagramModeControls
                mode={instagramMode}
                onModeChange={setInstagramMode}
                people={peopleFromInstagramBundle(instagramPeople)}
                personId={instagramPersonId}
                onPersonIdChange={setInstagramPersonId}
                hasCompany={showInstagramCompany}
                avatarPlatform="instagram"
                tone="paper"
              />
            ) : null}
            {showLinkedInSubnav ? (
              <InstagramModeControls
                mode={showingCompany ? "company" : "person"}
                onModeChange={(next) => {
                  if (next === "person") selectPerson();
                  else selectCompany();
                }}
                people={peopleFromSocialResult(socialResults.linkedin)}
                personId={socialResults.linkedin?.profile.username ?? ""}
                onPersonIdChange={selectPerson}
                hasCompany={showLinkedInCompany}
                avatarPlatform="linkedin"
                tone="paper"
              />
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
    <div className="rounded-2xl border border-[#D5CDBF] bg-[#FBF8F2] p-6 text-center text-sm text-[#5E665F]">
      {message}
    </div>
  );
}
