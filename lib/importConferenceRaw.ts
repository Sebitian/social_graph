import { parsePosition } from "./position";
import type {
  ConferenceAttendee,
  ConferenceCompanyGroup,
  ConferenceEvent,
  ConferenceGraphData,
  ConferenceGraphLink,
  ConferenceGraphNode,
  ConferenceMatchStatus,
  ConferenceResult,
  ConferenceStats,
} from "./conferenceTypes";

export interface RawConferenceAttendee {
  searchedFor?: string;
  publicIdentifier?: string | null;
  linkedinUrl?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  headline?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  locationText?: string | null;
  profileSummary?: string | null;
  connectionsCount?: number | null;
  followerCount?: number | null;
  confidence?: number | null;
  searchQuery?: string | null;
  resultRank?: number | null;
  note?: string | null;
}

const EVENT_COLOR = "#E11D48";
const UNMATCHED_COLOR = "#6B7280";
const COMPANY_PALETTE = [
  "#38BDF8",
  "#A78BFA",
  "#34D399",
  "#FBBF24",
  "#F472B6",
  "#FB923C",
  "#2DD4BF",
  "#818CF8",
  "#F87171",
  "#C084FC",
  "#4ADE80",
  "#FACC15",
];

const SCRAPER_COMPANY = /^(linkedin|professional profile)$/i;
const US_STATES = new Set([
  "alabama",
  "alaska",
  "arizona",
  "arkansas",
  "california",
  "colorado",
  "connecticut",
  "delaware",
  "florida",
  "georgia",
  "hawaii",
  "idaho",
  "illinois",
  "indiana",
  "iowa",
  "kansas",
  "kentucky",
  "louisiana",
  "maine",
  "maryland",
  "massachusetts",
  "michigan",
  "minnesota",
  "mississippi",
  "missouri",
  "montana",
  "nebraska",
  "nevada",
  "new hampshire",
  "new jersey",
  "new mexico",
  "new york",
  "north carolina",
  "north dakota",
  "ohio",
  "oklahoma",
  "oregon",
  "pennsylvania",
  "rhode island",
  "south carolina",
  "south dakota",
  "tennessee",
  "texas",
  "utah",
  "vermont",
  "virginia",
  "washington",
  "west virginia",
  "wisconsin",
  "wyoming",
  "district of columbia",
]);

const LOCATIONISH =
  /\bunited states\b|\bprofessional profile\b|,\s*(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|hampshire|jersey|mexico|york|carolina|dakota|ohio|oklahoma|oregon|pennsylvania|rhode|tennessee|texas|utah|vermont|virginia|washington|wisconsin|wyoming)\b/i;

const CITY_STATE_COUNTRY =
  /\b([A-Z][A-Za-z][A-Za-z'-]*(?:\s+[A-Z][A-Za-z'-]+)?),\s*([A-Z][A-Za-z][A-Za-z'-]*(?:\s+[A-Z][A-Za-z'-]+)?),\s*United States\b/g;

const TITLEISH =
  /\b(engineer|director|manager|principal|partner|founder|ceo|cto|cfo|coo|president|officer|specialist|analyst|associate|consultant|investor|trader|designer|developer|scientist|lead|head|vp|vice president|intern|student|professor|attorney|lawyer|counsel|colorist|esthetician)\b/i;

const DATEISH = /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|present|\d)/i;

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(value: string): string[] {
  return fold(value)
    .split(/[\s-]+/)
    .filter((token) => token.length > 1);
}

function namesLikelyMatch(searched: string, found: string): boolean {
  const a = nameTokens(searched);
  const b = nameTokens(found);
  if (!a.length || !b.length) return false;
  if (fold(searched) === fold(found)) return true;

  const aLast = a[a.length - 1];
  const bLast = b[b.length - 1];
  const lastClose =
    aLast === bLast || aLast.startsWith(bLast) || bLast.startsWith(aLast);
  if (!lastClose) return false;

  const aFirst = a[0];
  const bFirst = b[0];
  if (aFirst === bFirst) return true;
  if (aFirst.startsWith(bFirst) || bFirst.startsWith(aFirst)) return true;
  return a.slice(0, -1).some((token) => b.includes(token));
}

function stripLinkedInSuffix(value: string): string {
  return value.replace(/\s+[—–-]\s*LinkedIn\s*$/i, "").trim();
}

function isJunkCompany(value?: string | null): boolean {
  const raw = value?.trim();
  if (!raw) return true;
  if (SCRAPER_COMPANY.test(raw)) return true;
  if (LOCATIONISH.test(raw)) return true;
  if (raw.length < 2) return true;
  return false;
}

function isLocationishHeadline(value?: string | null): boolean {
  const raw = value?.trim();
  if (!raw) return false;
  return LOCATIONISH.test(raw) || /,\s*[A-Z][a-z]+,\s*United States/.test(raw);
}

function cleanCompanyName(value: string): string {
  return value
    .replace(/\s+[—–-]\s*LinkedIn\s*$/i, "")
    .replace(/\s+\.{2,}$/g, "")
    .replace(/\s+Graphic$/i, "")
    .replace(/\s+Corporate$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCount(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const compact = raw.replace(/,/g, "").trim();
  const plus = compact.endsWith("+");
  const body = plus ? compact.slice(0, -1) : compact;
  if (/^\d+(\.\d+)?k$/i.test(body)) {
    return Math.round(parseFloat(body) * 1000);
  }
  const n = Number(body);
  return Number.isFinite(n) ? n : undefined;
}

function countsFromSummary(summary?: string | null): {
  connectionsCount?: number;
  followerCount?: number;
} {
  if (!summary) return {};
  const followers = summary.match(/([\d,.]+K?)\s+followers/i);
  const connections = summary.match(/([\d,.]+(?:\+)?)\s+connections/i);
  return {
    followerCount: parseCount(followers?.[1]),
    connectionsCount: parseCount(connections?.[1]),
  };
}

function isCountryOnly(value: string): boolean {
  return /^(united states|usa|us|romania|uk|united kingdom)$/i.test(value.trim());
}

function formatCityState(city: string, region: string): string | undefined {
  if (!US_STATES.has(region.toLowerCase())) return undefined;
  if (city.toLowerCase() === region.toLowerCase()) return `${city}, ${region}`;
  return `${city}, ${region}`;
}

function firstCityState(text: string): string | undefined {
  CITY_STATE_COUNTRY.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CITY_STATE_COUNTRY.exec(text))) {
    const formatted = formatCityState(match[1].trim(), match[2].trim());
    if (formatted) return formatted;
  }
  return undefined;
}

function locationFromText(
  locationText?: string | null,
  headline?: string | null,
  summary?: string | null,
): string | undefined {
  const loc = locationText?.trim();
  if (loc && !isJunkCompany(loc) && !isCountryOnly(loc)) return loc;

  for (const source of [headline, summary]) {
    if (!source) continue;
    const fromPattern = firstCityState(source);
    if (fromPattern) return fromPattern;
    const labeled = source.match(/Location:\s*([A-Z][A-Za-z.'\s-]+)/);
    if (labeled?.[1] && !isCountryOnly(labeled[1])) return labeled[1].trim();
  }
  return undefined;
}

function looksLikeTitle(value: string): boolean {
  return TITLEISH.test(value);
}

function looksLikeCompany(value: string): boolean {
  if (isJunkCompany(value) || DATEISH.test(value) || isLocationishHeadline(value)) {
    return false;
  }
  if (looksLikeTitle(value)) return false;
  if (
    /mutual connections|followers|holds the|presidency|see your|view mutual|continue\b/i.test(
      value,
    )
  ) {
    return false;
  }
  if (/^(helping|building|looking|see|view|i)\b/i.test(value)) return false;
  const words = value
    .replace(/[()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0 || words.length > 7) return false;
  const structural = /^(and|&|of|the|at|for)$/i;
  const capped = words.filter(
    (word) => /^[\p{Lu}0-9]/u.test(word) || structural.test(word),
  );
  if (capped.length < Math.ceil(words.length * 0.6)) return false;
  return true;
}

function companyFromBlurb(fullName: string, summary?: string | null): {
  title?: string;
  company?: string;
} {
  if (!summary) return {};
  const parts = summary
    .split(/\.\s+/)
    .map((part) => part.replace(/^[·•\s]+/, "").trim())
    .filter(Boolean);

  let index = 0;
  if (parts[0] && namesLikelyMatch(fullName, parts[0])) index = 1;
  if (parts[index] && firstCityState(parts[index])) index += 1;

  const maybeTitle = parts[index];
  const maybeCompany = parts[index + 1];
  const title =
    maybeTitle && looksLikeTitle(maybeTitle)
      ? stripLinkedInSuffix(maybeTitle)
      : undefined;
  const companyRaw =
    maybeTitle && !title && looksLikeCompany(maybeTitle)
      ? maybeTitle
      : maybeCompany;
  const companyCandidate = companyRaw?.split(" - ")[0]?.trim();
  const company =
    companyCandidate && looksLikeCompany(companyCandidate)
      ? cleanCompanyName(companyCandidate)
      : undefined;
  return { title, company };
}

function companyFromSummary(summary?: string | null): {
  title?: string;
  company?: string;
} {
  if (!summary) return {};

  const graphic = summary.match(
    /([A-Z][A-Za-z0-9.&'’\s-]{2,40}?)\s+Graphic\.\s+([^.]{3,50})/,
  );
  if (graphic?.[1] && !isJunkCompany(graphic[1])) {
    const role = graphic[2]?.trim();
    return {
      company: cleanCompanyName(graphic[1]),
      title:
        role && !DATEISH.test(role) && !looksLikeCompany(role) ? role : undefined,
    };
  }

  const presidency = summary.match(
    /presidency of (?:the )?([A-Z][A-Za-z0-9.&'’\s-]{3,60}?)(?:\s+\(|\.|,)/,
  );
  if (presidency?.[1] && !isJunkCompany(presidency[1])) {
    return { company: cleanCompanyName(presidency[1]), title: "President" };
  }

  return {};
}

function companyFromHeadline(
  headline?: string | null,
  jobTitle?: string | null,
): { title?: string; company?: string } {
  const raw = stripLinkedInSuffix(headline || jobTitle || "");
  if (!raw || isLocationishHeadline(raw)) return {};

  const parsed = parsePosition(raw);
  if (parsed.company && !isJunkCompany(parsed.company)) {
    return { title: parsed.title, company: cleanCompanyName(parsed.company) };
  }

  const founder = raw.match(
    /(?:CEO\s*&\s*Founder|Founder\s*&\s*CEO|Founder)\s+([A-Z][A-Za-z0-9.&'’\s-]{1,40})/,
  );
  if (founder?.[1] && !isJunkCompany(founder[1])) {
    return { title: "CEO & Founder", company: cleanCompanyName(founder[1]) };
  }

  const asCompany = cleanCompanyName((parsed.title || raw).replace(/\s+\.{2,}$/g, ""));
  if (asCompany && !looksLikeTitle(asCompany) && looksLikeCompany(asCompany) && asCompany.length <= 48) {
    return { company: asCompany };
  }

  return { title: parsed.title || raw };
}

function resolveCompany(row: RawConferenceAttendee): {
  title: string;
  company?: string;
} {
  const fromHeadline = companyFromHeadline(row.headline, row.jobTitle);
  const fromBlurb = companyFromBlurb(
    row.fullName?.trim() || row.searchedFor || "",
    row.profileSummary,
  );
  const fromSummary = companyFromSummary(row.profileSummary);
  const field = row.company?.trim();
  const fromField =
    field && !isJunkCompany(field) ? cleanCompanyName(field) : undefined;

  const headlineRoleCompany =
    fromHeadline.company && fromHeadline.title
      ? fromHeadline.company
      : undefined;
  const company =
    headlineRoleCompany ||
    fromHeadline.company ||
    fromSummary.company ||
    fromBlurb.company ||
    fromField;
  let title =
    fromHeadline.title ||
    fromBlurb.title ||
    fromSummary.title ||
    "";

  if (isLocationishHeadline(title)) title = "";
  if (
    title &&
    company &&
    (fold(title) === fold(company) || fold(title).startsWith(fold(company)))
  ) {
    title = "";
  }
  return { title: title.replace(/\s+/g, " ").trim(), company };
}

function slugify(value: string): string {
  const slug = fold(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown";
}

function colorForCompany(label: string, index: number): string {
  void label;
  return COMPANY_PALETTE[index % COMPANY_PALETTE.length];
}

function matchStatus(row: RawConferenceAttendee): {
  status: ConferenceMatchStatus;
  note?: string;
} {
  const searched = row.searchedFor?.trim();
  if (!searched) return { status: "missing", note: "Guest list name missing" };

  const note = row.note?.trim();
  if (note && /fetch failed|no data retrieved/i.test(note)) {
    return { status: "missing", note };
  }

  const found = row.fullName?.trim();
  if (!found || !row.publicIdentifier) {
    return { status: "missing", note: note || "No LinkedIn profile returned" };
  }

  if (note && /no exact match/i.test(note)) {
    return { status: "unmatched", note };
  }

  if (!namesLikelyMatch(searched, found)) {
    return {
      status: "unmatched",
      note: note || `LinkedIn result looks like ${found}, not ${searched}`,
    };
  }

  return { status: "matched", note };
}

function buildAttendee(row: RawConferenceAttendee, index: number): ConferenceAttendee {
  const lumaName = row.searchedFor?.trim() || `Guest ${index + 1}`;
  const { status, note } = matchStatus(row);
  const counts = countsFromSummary(row.profileSummary);
  const id = `attendee:${slugify(lumaName)}:${index}`;

  if (status !== "matched") {
    return {
      id,
      lumaName,
      fullName: lumaName,
      headline: "",
      title: "",
      matchStatus: status,
      matchNote: note,
    };
  }

  const { title, company } = resolveCompany(row);
  const headline = stripLinkedInSuffix(row.headline || row.jobTitle || "");
  const location = locationFromText(
    row.locationText,
    headline,
    row.profileSummary,
  );
  const displayTitle =
    title ||
    (isLocationishHeadline(headline) ||
    (company && fold(headline).startsWith(fold(company)))
      ? ""
      : headline);

  return {
    id,
    lumaName,
    fullName: row.fullName!.trim(),
    headline,
    title: displayTitle,
    company,
    location,
    publicIdentifier: row.publicIdentifier?.trim() || undefined,
    linkedinUrl:
      row.linkedinUrl?.trim() ||
      (row.publicIdentifier
        ? `https://www.linkedin.com/in/${row.publicIdentifier}`
        : undefined),
    profileSummary: row.profileSummary?.trim() || undefined,
    connectionsCount: row.connectionsCount ?? counts.connectionsCount,
    followerCount: row.followerCount ?? counts.followerCount,
    confidence: row.confidence ?? undefined,
    matchStatus: status,
    matchNote: note,
  };
}

function buildCompanies(attendees: ConferenceAttendee[]): ConferenceCompanyGroup[] {
  const counts = new Map<string, number>();
  for (const attendee of attendees) {
    if (!attendee.company) continue;
    counts.set(attendee.company, (counts.get(attendee.company) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count], index) => ({
      id: `company:${slugify(label)}`,
      label,
      count,
      color: colorForCompany(label, index),
    }));
}

function buildGraph(
  event: ConferenceEvent,
  attendees: ConferenceAttendee[],
  companies: ConferenceCompanyGroup[],
): ConferenceGraphData {
  const companyByLabel = new Map(companies.map((c) => [c.label, c]));
  const clustered = companies.filter((c) => c.count >= 2);

  const eventNode: ConferenceGraphNode = {
    id: event.id,
    label: event.name,
    kind: "event",
    refId: event.id,
    weight: 1,
    color: EVENT_COLOR,
  };

  const companyNodes: ConferenceGraphNode[] = clustered.map((company) => ({
    id: company.id,
    label: company.label,
    kind: "company",
    refId: company.id,
    weight: company.count,
    color: company.color,
  }));

  const attendeeNodes: ConferenceGraphNode[] = attendees.map((attendee) => {
    const group = attendee.company
      ? companyByLabel.get(attendee.company)
      : undefined;
    return {
      id: attendee.id,
      label: attendee.fullName,
      kind: "attendee",
      refId: attendee.publicIdentifier ?? attendee.id,
      weight: attendee.followerCount ?? attendee.connectionsCount ?? 0,
      color:
        attendee.matchStatus === "matched"
          ? (group?.color ?? EVENT_COLOR)
          : UNMATCHED_COLOR,
      title: attendee.title,
      company: attendee.company,
      location: attendee.location,
      matchStatus: attendee.matchStatus,
    };
  });

  const links: ConferenceGraphLink[] = [];
  for (const company of clustered) {
    links.push({
      source: event.id,
      target: company.id,
      kind: "event-company",
    });
  }

  for (const attendee of attendees) {
    const group = attendee.company
      ? companyByLabel.get(attendee.company)
      : undefined;
    if (group && group.count >= 2) {
      links.push({
        source: group.id,
        target: attendee.id,
        kind: "company-attendee",
      });
    } else {
      links.push({
        source: event.id,
        target: attendee.id,
        kind: "event-attendee",
      });
    }
  }

  return {
    nodes: [eventNode, ...companyNodes, ...attendeeNodes],
    links,
  };
}

function buildStats(
  attendees: ConferenceAttendee[],
  companies: ConferenceCompanyGroup[],
): ConferenceStats {
  const locationCounts = new Map<string, number>();
  let matchedCount = 0;
  let unmatchedCount = 0;
  let missingCount = 0;

  for (const attendee of attendees) {
    if (attendee.matchStatus === "matched") matchedCount += 1;
    else if (attendee.matchStatus === "unmatched") unmatchedCount += 1;
    else missingCount += 1;
    if (attendee.location) {
      locationCounts.set(
        attendee.location,
        (locationCounts.get(attendee.location) ?? 0) + 1,
      );
    }
  }

  return {
    attendeeCount: attendees.length,
    matchedCount,
    unmatchedCount,
    missingCount,
    companyCount: companies.length,
    locationCount: locationCounts.size,
    topCompanies: companies.slice(0, 8),
    topLocations: [...locationCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  };
}

function titleFromHandle(handle: string): string {
  const words = handle.replace(/[-_]+/g, " ").trim();
  if (!words) return "Conference";
  return words.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/** True when the array looks like a LinkedIn people-search attendee export. */
export function isConferenceRawDataset(
  raw: unknown,
): raw is RawConferenceAttendee[] {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  return raw.slice(0, 8).some(
    (item) =>
      item &&
      typeof item === "object" &&
      "searchedFor" in item &&
      ("publicIdentifier" in item || "linkedinUrl" in item),
  );
}

export function buildConferenceResultFromRaw(
  handle: string,
  raw: RawConferenceAttendee[],
  options?: {
    name?: string;
    lumaUrl?: string;
    venue?: string;
    scrapedAt?: number;
    pinned?: boolean;
  },
): ConferenceResult {
  const clean = handle.replace(/^@/, "").trim().toLowerCase();
  const attendees = raw.map(buildAttendee);
  if (attendees.length === 0) {
    throw new Error("Conference dataset has no attendees");
  }

  const companies = buildCompanies(attendees);
  const event: ConferenceEvent = {
    id: `event:${clean}`,
    name: options?.name?.trim() || titleFromHandle(clean),
    lumaUrl: options?.lumaUrl,
    venue: options?.venue,
    attendeeCount: attendees.length,
  };
  const graph = buildGraph(event, attendees, companies);
  const stats = buildStats(attendees, companies);

  return {
    kind: "conference",
    scrapedAt: options?.scrapedAt ?? Date.now(),
    pinned: options?.pinned ?? true,
    event,
    attendees,
    companies,
    graph,
    stats,
  };
}
