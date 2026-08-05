import type {
  CompanyEmployee,
  CompanyGraphData,
  CompanyGraphLink,
  CompanyGraphNode,
  CompanyProfile,
  CompanyResult,
  CompanyStats,
} from "./companyTypes";

interface RawPicture {
  url?: string;
}

interface RawPosition {
  position?: string;
  companyName?: string;
  companyLinkedinUrl?: string;
  companyId?: string;
  companyUniversalName?: string;
  duration?: string;
  companyLogo?: RawPicture & { sizes?: RawPicture[] };
}

interface RawEducation {
  schoolName?: string;
  degree?: string;
  fieldOfStudy?: string;
}

interface RawLocation {
  linkedinText?: string;
  parsed?: { text?: string; city?: string; state?: string; country?: string };
}

interface RawCompanyProfile {
  id?: string;
  publicIdentifier?: string;
  linkedinUrl?: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  location?: RawLocation;
  connectionsCount?: number;
  followerCount?: number;
  profilePicture?: RawPicture;
  photo?: RawPicture;
  currentPosition?: RawPosition[];
  profileTopEducation?: RawEducation[];
  skills?: { name?: string }[] | string[];
  topSkills?: string[];
  _meta?: {
    pagination?: { totalElements?: number };
  };
}

const COMPANY_COLOR = "#0A66C2";
const EMPLOYEE_COLOR = "#509BF5";

function slugFromCompanyUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/linkedin\.com\/company\/([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]).toLowerCase() : undefined;
}

function pictureUrl(profile: RawCompanyProfile): string | undefined {
  if (profile.profilePicture?.url) return profile.profilePicture.url;
  if (profile.photo?.url) return profile.photo.url;
  return undefined;
}

function logoUrlFromPosition(pos?: RawPosition): string | undefined {
  if (!pos?.companyLogo?.url) return pos?.companyLogo?.sizes?.[0]?.url;
  return pos.companyLogo.url;
}

function parseLocation(raw?: RawLocation): string | undefined {
  if (!raw) return undefined;
  const parsed = raw.parsed;
  if (parsed?.city && parsed?.state) return `${parsed.city}, ${parsed.state}`;
  if (parsed?.text) return parsed.text;
  return raw.linkedinText;
}

function parseTitle(profile: RawCompanyProfile): string {
  const pos = profile.currentPosition?.[0]?.position?.trim();
  if (pos && pos !== "--") return pos;
  return profile.headline?.trim() || "—";
}

function parseEducation(raw?: RawEducation[]) {
  if (!raw?.length) return undefined;
  return raw.map((e) => ({
    school: e.schoolName ?? "Unknown",
    degree: e.degree,
    fieldOfStudy: e.fieldOfStudy,
  }));
}

function parseSkills(profile: RawCompanyProfile): string[] | undefined {
  const fromTop = profile.topSkills ?? [];
  const fromSkills = (profile.skills ?? [])
    .map((s) => (typeof s === "string" ? s : s.name))
    .filter((s): s is string => Boolean(s));
  const merged = [...new Set([...fromTop, ...fromSkills])];
  return merged.length > 0 ? merged.slice(0, 12) : undefined;
}

function employeeNodeVal(connections?: number): number {
  const n = connections ?? 0;
  return 8 + Math.min(14, Math.log2(n + 2) * 2.5);
}

/** True when the array looks like HarvestAPI company employee search output. */
export function isCompanyRawDataset(raw: unknown): raw is RawCompanyProfile[] {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  const sample = raw.slice(0, 5);
  return sample.some(
    (item) =>
      item &&
      typeof item === "object" &&
      "publicIdentifier" in item &&
      "currentPosition" in item &&
      !("type" in item && (item as { type?: string }).type === "post"),
  );
}

function buildEmployee(profile: RawCompanyProfile): CompanyEmployee | null {
  if (!profile.id || !profile.publicIdentifier) return null;
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  if (!fullName) return null;

  return {
    id: profile.id,
    publicIdentifier: profile.publicIdentifier,
    fullName,
    headline: profile.headline?.trim() || "",
    title: parseTitle(profile),
    location: parseLocation(profile.location),
    tenure: profile.currentPosition?.[0]?.duration,
    connectionsCount: profile.connectionsCount,
    followerCount: profile.followerCount,
    profilePicUrl: pictureUrl(profile),
    linkedinUrl:
      profile.linkedinUrl ??
      `https://www.linkedin.com/in/${profile.publicIdentifier}`,
    education: parseEducation(profile.profileTopEducation),
    topSkills: parseSkills(profile),
  };
}

function buildCompanyProfile(
  handle: string,
  employees: CompanyEmployee[],
  rawProfiles: RawCompanyProfile[],
): CompanyProfile {
  const firstPos = rawProfiles.find((p) => p.currentPosition?.[0])?.currentPosition?.[0];
  const slug =
    slugFromCompanyUrl(firstPos?.companyLinkedinUrl) ??
    handle.replace(/^company-/, "");
  const totalReported = rawProfiles.find((p) => p._meta?.pagination?.totalElements)
    ?._meta?.pagination?.totalElements;

  return {
    id: firstPos?.companyId ?? slug,
    name: firstPos?.companyName ?? slug,
    logoUrl: logoUrlFromPosition(firstPos),
    linkedinUrl:
      firstPos?.companyLinkedinUrl ??
      `https://www.linkedin.com/company/${slug}/`,
    employeeCount: employees.length,
    totalReported,
  };
}

function buildGraph(
  company: CompanyProfile,
  employees: CompanyEmployee[],
): CompanyGraphData {
  const companyNode: CompanyGraphNode = {
    id: company.id,
    label: company.name,
    kind: "company",
    imageUrl: company.logoUrl,
    refId: company.id,
    weight: 1,
    color: COMPANY_COLOR,
  };

  const employeeNodes: CompanyGraphNode[] = employees.map((emp) => ({
    id: emp.id,
    label: emp.fullName,
    kind: "employee",
    imageUrl: emp.profilePicUrl,
    refId: emp.publicIdentifier,
    weight: emp.connectionsCount ?? 0,
    color: EMPLOYEE_COLOR,
    title: emp.title,
    location: emp.location,
  }));

  const links: CompanyGraphLink[] = employees.map((emp) => ({
    source: company.id,
    target: emp.id,
    kind: "company-employee",
  }));

  return {
    nodes: [companyNode, ...employeeNodes],
    links,
  };
}

function buildStats(
  employees: CompanyEmployee[],
  totalReported?: number,
): CompanyStats {
  const locationCounts = new Map<string, number>();
  const schoolCounts = new Map<string, number>();
  let connectionSum = 0;
  let connectionN = 0;

  for (const emp of employees) {
    if (emp.location) {
      locationCounts.set(emp.location, (locationCounts.get(emp.location) ?? 0) + 1);
    }
    for (const ed of emp.education ?? []) {
      schoolCounts.set(ed.school, (schoolCounts.get(ed.school) ?? 0) + 1);
    }
    if (typeof emp.connectionsCount === "number") {
      connectionSum += emp.connectionsCount;
      connectionN += 1;
    }
  }

  const topLocations = [...locationCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topSchools = [...schoolCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    employeeCount: employees.length,
    totalReported,
    locationCount: locationCounts.size,
    schoolCount: schoolCounts.size,
    avgConnections: connectionN > 0 ? Math.round(connectionSum / connectionN) : 0,
    topLocations,
    topSchools,
  };
}

export function buildCompanyResultFromRaw(
  handle: string,
  raw: RawCompanyProfile[],
  options?: { scrapedAt?: number; pinned?: boolean },
): CompanyResult {
  const clean = handle.replace(/^@/, "").trim().toLowerCase();
  const employees = raw
    .map(buildEmployee)
    .filter((e): e is CompanyEmployee => e !== null);

  if (employees.length === 0) {
    throw new Error("Company dataset has no employee profiles");
  }

  const company = buildCompanyProfile(clean, employees, raw);
  const graph = buildGraph(company, employees);
  const stats = buildStats(employees, company.totalReported);

  // Apply node sizing after graph build
  for (const node of graph.nodes) {
    if (node.kind === "employee") {
      node.weight = employeeNodeVal(node.weight);
    }
  }

  return {
    kind: "company",
    scrapedAt: options?.scrapedAt ?? Date.now(),
    pinned: options?.pinned ?? true,
    company,
    employees,
    graph,
    stats,
  };
}
