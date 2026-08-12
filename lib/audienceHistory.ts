import type { AudienceSnapshot } from "./types";

const MS_DAY = 86_400_000;

/**
 * Build a sparse prior-audience series for demos / first imports.
 * Real daily scrapes should append true observations instead.
 *
 * Offsets are chosen so a 7D range typically shows about +6 followers.
 */
export function seedAudienceHistory(opts: {
  scrapedAt: number;
  followersCount: number;
  followingCount?: number;
  connectionsCount?: number;
}): AudienceSnapshot[] {
  const {
    scrapedAt,
    followersCount,
    followingCount,
    connectionsCount,
  } = opts;

  const points: Array<{
    days: number;
    followersDelta: number;
    followingDelta: number;
    connectionsDelta: number;
  }> = [
    { days: 90, followersDelta: -38, followingDelta: -7, connectionsDelta: -12 },
    { days: 30, followersDelta: -16, followingDelta: -3, connectionsDelta: -4 },
    { days: 14, followersDelta: -9, followingDelta: -2, connectionsDelta: -1 },
    { days: 7, followersDelta: -6, followingDelta: -1, connectionsDelta: 0 },
    { days: 1, followersDelta: -2, followingDelta: 0, connectionsDelta: 0 },
  ];

  return points.map((p) => ({
    at: scrapedAt - p.days * MS_DAY,
    followersCount: Math.max(0, followersCount + p.followersDelta),
    ...(followingCount != null
      ? {
          followingCount: Math.max(0, followingCount + p.followingDelta),
        }
      : {}),
    ...(connectionsCount != null
      ? {
          connectionsCount: Math.max(
            0,
            connectionsCount + p.connectionsDelta,
          ),
        }
      : {}),
  }));
}
