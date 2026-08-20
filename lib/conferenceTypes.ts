/** Luma / conference attendee graph types (separate from social ScrapeResult). */

export type ConferenceNodeKind = "event" | "company" | "attendee";

export type ConferenceMatchStatus = "matched" | "unmatched" | "missing";

export interface ConferenceEvent {
  id: string;
  name: string;
  lumaUrl?: string;
  venue?: string;
  attendeeCount: number;
}

export interface ConferenceAttendee {
  id: string;
  /** Name from the Luma guest list. */
  lumaName: string;
  fullName: string;
  headline: string;
  title: string;
  company?: string;
  location?: string;
  publicIdentifier?: string;
  linkedinUrl?: string;
  profileSummary?: string;
  connectionsCount?: number;
  followerCount?: number;
  /** LinkedIn search confidence 0–100 when a profile was returned. */
  confidence?: number;
  matchStatus: ConferenceMatchStatus;
  matchNote?: string;
}

export interface ConferenceCompanyGroup {
  id: string;
  label: string;
  count: number;
  color: string;
}

export interface ConferenceGraphNode {
  id: string;
  label: string;
  kind: ConferenceNodeKind;
  refId?: string;
  weight?: number;
  color?: string;
  title?: string;
  company?: string;
  location?: string;
  matchStatus?: ConferenceMatchStatus;
}

export interface ConferenceGraphLink {
  source: string;
  target: string;
  kind: "event-attendee" | "event-company" | "company-attendee";
}

export interface ConferenceGraphData {
  nodes: ConferenceGraphNode[];
  links: ConferenceGraphLink[];
}

export interface ConferenceLocationStat {
  label: string;
  count: number;
}

export interface ConferenceStats {
  attendeeCount: number;
  matchedCount: number;
  unmatchedCount: number;
  missingCount: number;
  companyCount: number;
  locationCount: number;
  topCompanies: ConferenceCompanyGroup[];
  topLocations: ConferenceLocationStat[];
}

export interface ConferenceResult {
  kind: "conference";
  scrapedAt: number;
  pinned?: boolean;
  cached?: boolean;
  demo?: boolean;
  event: ConferenceEvent;
  attendees: ConferenceAttendee[];
  companies: ConferenceCompanyGroup[];
  graph: ConferenceGraphData;
  stats: ConferenceStats;
}

export function isConferenceResult(value: unknown): value is ConferenceResult {
  if (!value || typeof value !== "object") return false;
  return (value as { kind?: string }).kind === "conference";
}
