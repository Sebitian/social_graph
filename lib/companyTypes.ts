/** LinkedIn company employee graph types (separate from social ScrapeResult). */

export type CompanyNodeKind = "company" | "employee";

export interface CompanyEducation {
  school: string;
  degree?: string;
  fieldOfStudy?: string;
}

export interface CompanyProfile {
  id: string;
  name: string;
  logoUrl?: string;
  linkedinUrl: string;
  employeeCount: number;
  totalReported?: number;
}

export interface CompanyEmployee {
  id: string;
  publicIdentifier: string;
  fullName: string;
  headline: string;
  title: string;
  location?: string;
  tenure?: string;
  connectionsCount?: number;
  followerCount?: number;
  profilePicUrl?: string;
  linkedinUrl: string;
  education?: CompanyEducation[];
  topSkills?: string[];
}

export interface CompanyGraphNode {
  id: string;
  label: string;
  kind: CompanyNodeKind;
  imageUrl?: string;
  refId?: string;
  weight?: number;
  color?: string;
  title?: string;
  location?: string;
}

export interface CompanyGraphLink {
  source: string;
  target: string;
  kind: "company-employee";
}

export interface CompanyGraphData {
  nodes: CompanyGraphNode[];
  links: CompanyGraphLink[];
}

export interface CompanyLocationStat {
  label: string;
  count: number;
}

export interface CompanySchoolStat {
  label: string;
  count: number;
}

export interface CompanyStats {
  employeeCount: number;
  totalReported?: number;
  locationCount: number;
  schoolCount: number;
  avgConnections: number;
  topLocations: CompanyLocationStat[];
  topSchools: CompanySchoolStat[];
}

export interface CompanyResult {
  kind: "company";
  scrapedAt: number;
  pinned?: boolean;
  cached?: boolean;
  demo?: boolean;
  company: CompanyProfile;
  employees: CompanyEmployee[];
  graph: CompanyGraphData;
  stats: CompanyStats;
}

export function isCompanyResult(value: unknown): value is CompanyResult {
  if (!value || typeof value !== "object") return false;
  return (value as { kind?: string }).kind === "company";
}
