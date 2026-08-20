"use client";

import { useMemo, useState } from "react";
import { ExternalLink, User } from "lucide-react";
import type { ScrapeResult, SocialSourcePlatform } from "@/lib/types";
import type { SpotifyTasteResult } from "@/lib/spotifyTypes";
import type { CompanyResult } from "@/lib/companyTypes";
import type { ConferenceResult } from "@/lib/conferenceTypes";
import type { TikTokResult } from "@/lib/tiktokTypes";
import { resolveAnalyticsMediaIdentity } from "@/lib/mediaIdentity";
import { proxiedAvatarUrlIfFresh, resolveProfilePicUrl } from "@/lib/avatarUrl";
import {
  CompanyIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  SpotifyIcon,
  TikTokIcon,
  ConferenceIcon,
} from "@/components/PlatformIcons";

export type ProfileGraphPlatform =
  | "linkedin"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "spotify"
  | "conference";

export type ProfileLinkedInMode = "person" | "company";

type SourceId =
  | "linkedin"
  | "company"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "spotify"
  | "conference";

type ProfileSource = {
  id: SourceId;
  label: string;
  title: string;
  handle: string;
  href: string;
  bio?: string;
  avatarUrl?: string;
  graphPlatform: ProfileGraphPlatform;
  linkedinMode?: ProfileLinkedInMode;
};

const SOURCE_ICON: Record<SourceId, typeof LinkedInIcon> = {
  linkedin: LinkedInIcon,
  company: CompanyIcon,
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  tiktok: TikTokIcon,
  spotify: SpotifyIcon,
  conference: ConferenceIcon,
};

function displayUrl(href: string): string {
  try {
    const url = new URL(href);
    return `${url.host}${url.pathname}`.replace(/\/$/, "");
  } catch {
    return href;
  }
}

function socialSource(
  platform: SocialSourcePlatform,
  data: ScrapeResult,
): ProfileSource | null {
  const identity = resolveAnalyticsMediaIdentity({
    platform,
    socialResults: { [platform]: data },
  });
  if (!identity) return null;
  const profile = data.profile;
  return {
    id: platform,
    label: platform === "linkedin" ? "LinkedIn" : platform === "instagram" ? "Instagram" : "Facebook",
    title: profile.fullName || profile.username,
    handle: identity.tag,
    href: identity.href,
    bio: profile.biography?.trim() || undefined,
    avatarUrl: resolveProfilePicUrl(
      profile.username,
      profile.profilePicUrl,
      platform,
    ),
    graphPlatform: platform,
    linkedinMode: platform === "linkedin" ? "person" : undefined,
  };
}

function collectSources(args: {
  socialResults: Partial<Record<SocialSourcePlatform, ScrapeResult | null>>;
  companyResult?: CompanyResult | null;
  tiktokResult?: TikTokResult | null;
  spotifyResult?: SpotifyTasteResult | null;
  conferenceResult?: ConferenceResult | null;
}): ProfileSource[] {
  const { socialResults, companyResult, tiktokResult, spotifyResult, conferenceResult } = args;
  const sources: ProfileSource[] = [];

  if (socialResults.linkedin) {
    const source = socialSource("linkedin", socialResults.linkedin);
    if (source) sources.push(source);
  }

  if (companyResult) {
    const identity = resolveAnalyticsMediaIdentity({
      platform: "linkedin",
      linkedinMode: "company",
      socialResults,
      companyResult,
    });
    if (identity) {
      sources.push({
        id: "company",
        label: "Company",
        title: companyResult.company.name,
        handle: identity.tag,
        href: identity.href,
        bio: `${companyResult.stats.employeeCount} employees in graph`,
        avatarUrl: companyResult.company.logoUrl
          ? proxiedAvatarUrlIfFresh(companyResult.company.logoUrl)
          : undefined,
        graphPlatform: "linkedin",
        linkedinMode: "company",
      });
    }
  }

  if (socialResults.instagram) {
    const source = socialSource("instagram", socialResults.instagram);
    if (source) sources.push(source);
  }

  if (socialResults.facebook) {
    const source = socialSource("facebook", socialResults.facebook);
    if (source) sources.push(source);
  }

  if (tiktokResult) {
    const identity = resolveAnalyticsMediaIdentity({
      platform: "tiktok",
      socialResults,
      tiktokResult,
    });
    if (identity) {
      sources.push({
        id: "tiktok",
        label: "TikTok",
        title: tiktokResult.profile.displayName || tiktokResult.profile.username,
        handle: identity.tag,
        href: identity.href,
        bio: tiktokResult.profile.bio?.trim() || undefined,
        graphPlatform: "tiktok",
      });
    }
  }

  if (spotifyResult) {
    const identity = resolveAnalyticsMediaIdentity({
      platform: "spotify",
      socialResults,
      spotifyResult,
    });
    if (identity) {
      sources.push({
        id: "spotify",
        label: "Spotify",
        title: spotifyResult.profile.displayName || spotifyResult.profile.username,
        handle: identity.tag,
        href: identity.href,
        bio: `${spotifyResult.profile.totalPublicPlaylists} public playlists`,
        graphPlatform: "spotify",
      });
    }
  }

  if (conferenceResult) {
    sources.push({
      id: "conference",
      label: "Conference",
      title: conferenceResult.event.name,
      handle: conferenceResult.event.id.replace(/^event:/, ""),
      href: conferenceResult.event.lumaUrl || "#",
      bio: `${conferenceResult.stats.attendeeCount} attendees · ${conferenceResult.stats.matchedCount} LinkedIn matches`,
      graphPlatform: "conference",
    });
  }

  return sources;
}

function SourceAvatar({
  title,
  avatarUrl,
}: {
  title: string;
  avatarUrl?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = title.trim().charAt(0).toUpperCase() || "?";
  if (avatarUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        onError={() => setFailed(true)}
        className="h-11 w-11 rounded-full object-cover ring-1 ring-white/15"
      />
    );
  }
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white/80 ring-1 ring-white/15">
      {initial}
    </div>
  );
}

interface Props {
  socialResults: Partial<Record<SocialSourcePlatform, ScrapeResult | null>>;
  companyResult?: CompanyResult | null;
  tiktokResult?: TikTokResult | null;
  spotifyResult?: SpotifyTasteResult | null;
  conferenceResult?: ConferenceResult | null;
  demo?: boolean;
  onViewGraph?: (
    platform: ProfileGraphPlatform,
    linkedinMode?: ProfileLinkedInMode,
  ) => void;
}

export default function ProfilePanel({
  socialResults,
  companyResult,
  tiktokResult,
  spotifyResult,
  conferenceResult,
  demo,
  onViewGraph,
}: Props) {
  const sources = useMemo(
    () =>
      collectSources({
        socialResults,
        companyResult,
        tiktokResult,
        spotifyResult,
        conferenceResult,
      }),
    [socialResults, companyResult, tiktokResult, spotifyResult, conferenceResult],
  );

  return (
    <div className="flex min-h-[70dvh] flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white/85">
          <User className="h-4 w-4" /> Profile
        </div>
        <p className="mt-1 text-xs text-white/40">
          {demo
            ? "Public source links for every snapshot loaded in this demo."
            : "Public source links for the graphs currently loaded."}
        </p>
      </div>

      {sources.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-white/40">
          No profile links yet. Load a graph to see source accounts here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 p-3 sm:p-4">
          {sources.map((source) => {
            const Icon = SOURCE_ICON[source.id];
            return (
              <li key={source.id}>
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/25 p-3">
                  <SourceAvatar title={source.title} avatarUrl={source.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/45">
                      <Icon className="h-3 w-3" />
                      {source.label}
                    </div>
                    <div className="mt-0.5 truncate text-sm font-semibold text-white">
                      {source.title}
                    </div>
                    {source.href && source.href !== "#" ? (
                    <a
                      href={source.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-ig-blue hover:underline"
                    >
                      <span className="truncate">{displayUrl(source.href)}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    ) : null}
                    {source.bio ? (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/45">
                        {source.bio}
                      </p>
                    ) : null}
                    {onViewGraph ? (
                      <button
                        type="button"
                        onClick={() =>
                          onViewGraph(source.graphPlatform, source.linkedinMode)
                        }
                        className="mt-2 text-[11px] font-medium text-white/55 transition hover:text-white/80"
                      >
                        View graph
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
