import type { CompanyEmployee, CompanyProfile } from "./companyTypes";

/** Title bands, most senior first. Ranking comes from the LinkedIn title only. */
export interface HierarchyBand {
  id: string;
  label: string;
  color: string;
  count: number;
}

export interface HierarchyNode {
  id: string;
  kind: "company" | "band" | "person";
  label: string;
  subtitle?: string;
  color: string;
  imageUrl?: string;
  /** Set for person nodes so a click can open that employee. */
  employeeId?: string;
  x: number;
  y: number;
  radius: number;
  pillWidth: number;
  /** Bottom of this band's people, so the spine starts under the row. */
  spanBottom?: number;
}

export interface HierarchyLink {
  source: string;
  target: string;
}

export interface CompanyHierarchy {
  nodes: HierarchyNode[];
  links: HierarchyLink[];
  bands: HierarchyBand[];
  /** Band names from the top of the company down. */
  flow: string;
}

interface BandDef {
  id: string;
  label: string;
  color: string;
  test: (title: string) => boolean;
}

interface ChiefDef {
  re: RegExp;
  label: string;
}

const CHIEFS: ChiefDef[] = [
  { re: /\bcto\b|\bchief technology\b/, label: "CTO" },
  { re: /\bcfo\b|\bchief financial\b/, label: "CFO" },
  { re: /\bcoo\b|\bchief operating\b/, label: "COO" },
  { re: /\bcpo\b|\bchief product\b/, label: "CPO" },
  { re: /\bcmo\b|\bchief marketing\b/, label: "CMO" },
  { re: /\bcio\b|\bchief information\b/, label: "CIO" },
  { re: /\bcdo\b|\bchief development\b|\bchief data\b/, label: "CDO" },
  {
    re: /\bcso\b|\bchief scientific\b|\bchief science\b|\bchief strategy\b|\bchief security\b/,
    label: "CSO",
  },
  { re: /\bcbo\b|\bchief business\b/, label: "CBO" },
  { re: /\bchro\b|\bchief human\b|\bchief people\b/, label: "CHRO" },
];

const BANDS: BandDef[] = [
  {
    id: "ceo",
    label: "CEO",
    color: "#115E59",
    test: (t) => /\bceo\b/.test(t) || /\bchief executive\b/.test(t),
  },
  {
    id: "chair",
    label: "Chair",
    color: "#134E4A",
    test: (t) => /\b(chair|chairman|chairwoman|chairperson)\b/.test(t),
  },
  {
    id: "president",
    label: "President",
    color: "#0F766E",
    test: (t) => /\bpresident\b/.test(t) && !/\bvice\b/.test(t),
  },
  {
    id: "csuite",
    label: "C-suite",
    color: "#0A66C2",
    test: (t) =>
      CHIEFS.some((chief) => chief.re.test(t)) || /\bchief\b/.test(t),
  },
  {
    id: "founder",
    label: "Founders",
    color: "#6D28D9",
    test: (t) => /\b(co founder|cofounder|founder)\b/.test(t),
  },
  {
    id: "partner",
    label: "Partners",
    color: "#7C3AED",
    test: (t) => /\bpartner\b/.test(t),
  },
  {
    id: "svp",
    label: "SVP",
    color: "#B45309",
    test: (t) => /\bsvp\b/.test(t) || /\bsenior vice president\b/.test(t),
  },
  {
    id: "vp",
    label: "VP",
    color: "#C2410C",
    test: (t) => /\bvp\b/.test(t) || /\bvice president\b/.test(t),
  },
  {
    id: "head",
    label: "Heads",
    color: "#0E7490",
    test: (t) => /\bhead\b/.test(t),
  },
  {
    id: "director",
    label: "Directors",
    color: "#1D4ED8",
    test: (t) => /\bdirector\b/.test(t) || /\bgeneral manager\b/.test(t),
  },
  {
    id: "manager",
    label: "Managers",
    color: "#047857",
    test: (t) => /\bmanager\b/.test(t),
  },
  {
    id: "lead",
    label: "Leads",
    color: "#0F766E",
    test: (t) => /\blead\b/.test(t),
  },
  {
    id: "staff",
    label: "Staff",
    color: "#374151",
    test: (t) => /\b(staff|principal)\b/.test(t),
  },
  {
    id: "team",
    label: "Team",
    color: "#4B5563",
    test: () => true,
  },
];

const UNLISTED: BandDef = {
  id: "unlisted",
  label: "Unlisted",
  color: "#9CA3AF",
  test: () => true,
};

const PER_ROW = 5;
const COL = 200;
const SUB = 118;
const PERSON_R = 18;
const LABEL_BELOW = 46;
const ROW_CLEAR = PERSON_R + LABEL_BELOW + 36;

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleMissing(title: string): boolean {
  return !/[a-z0-9]/i.test(title);
}

function chiefAcronym(title: string): string | null {
  const normalized = normalizeTitle(title);
  for (const chief of CHIEFS) {
    if (chief.re.test(normalized)) return chief.label;
  }
  if (/\bchief\b/.test(normalized)) return "Chief";
  return null;
}

function chiefOrder(title: string): number {
  const normalized = normalizeTitle(title);
  const index = CHIEFS.findIndex((chief) => chief.re.test(normalized));
  return index === -1 ? CHIEFS.length : index;
}

export function shortTitle(raw: string): string {
  if (titleMissing(raw)) return "No title";
  let text = raw.trim();
  text = text.replace(/\s+@\s+.*$/i, "");
  text = text.replace(/\s+at\s+[^,|/]+$/i, "");
  text = text.replace(/\s*[|/]\s*/g, " · ");
  const swaps: [RegExp, string][] = [
    [/\bchief executive officer\b/gi, "CEO"],
    [/\bchief technology officer\b/gi, "CTO"],
    [/\bchief financial officer\b/gi, "CFO"],
    [/\bchief operating officer\b/gi, "COO"],
    [/\bchief product officer\b/gi, "CPO"],
    [/\bchief marketing officer\b/gi, "CMO"],
    [/\bchief information officer\b/gi, "CIO"],
    [/\bchief development officer\b/gi, "CDO"],
    [/\bchief scientific officer\b/gi, "CSO"],
    [/\bchief science officer\b/gi, "CSO"],
    [/\bchief strategy officer\b/gi, "CSO"],
    [/\bchief security officer\b/gi, "CSO"],
    [/\bchief business officer\b/gi, "CBO"],
    [/\bchief human resources officer\b/gi, "CHRO"],
    [/\bco-founder\b/gi, "Co-founder"],
    [/\bfounder\b/gi, "Founder"],
    [/\bsenior vice president\b/gi, "SVP"],
    [/\bvice president\b/gi, "VP"],
    [/\bceo\b/gi, "CEO"],
    [/\bcto\b/gi, "CTO"],
    [/\bcfo\b/gi, "CFO"],
    [/\bcoo\b/gi, "COO"],
    [/\bcpo\b/gi, "CPO"],
    [/\bcmo\b/gi, "CMO"],
    [/\bcio\b/gi, "CIO"],
    [/\bcdo\b/gi, "CDO"],
    [/\bcso\b/gi, "CSO"],
    [/\bcbo\b/gi, "CBO"],
  ];
  for (const [pattern, label] of swaps) text = text.replace(pattern, label);
  text = text.replace(/\s*\((?:CEO|CTO|CFO|COO|CPO|CMO|CIO|CDO|CSO|CBO|CHRO)\)/g, "");
  text = text.replace(/\s+/g, " ").trim();
  if (text.length > 36) text = `${text.slice(0, 35).trimEnd()}…`;
  return text || "No title";
}

function bandFor(title: string): BandDef {
  if (titleMissing(title)) return UNLISTED;
  const normalized = normalizeTitle(title);
  return BANDS.find((band) => band.test(normalized)) ?? UNLISTED;
}

function pillWidth(label: string): number {
  return Math.max(76, Math.round(label.length * 7.2 + 28));
}

interface Ranked {
  employee: CompanyEmployee;
  band: BandDef;
  shortTitle: string;
}

function rankEmployees(employees: CompanyEmployee[]): Ranked[] {
  return employees.map((employee) => {
    const band = bandFor(employee.title);
    return { employee, band, shortTitle: shortTitle(employee.title) };
  });
}

function compareRanked(a: Ranked, b: Ranked): number {
  const chief = chiefOrder(a.employee.title) - chiefOrder(b.employee.title);
  if (chief !== 0) return chief;
  const aSenior = /\bsenior\b/.test(normalizeTitle(a.employee.title)) ? 0 : 1;
  const bSenior = /\bsenior\b/.test(normalizeTitle(b.employee.title)) ? 0 : 1;
  if (aSenior !== bSenior) return aSenior - bSenior;
  const title = a.shortTitle.localeCompare(b.shortTitle);
  if (title !== 0) return title;
  return a.employee.fullName.localeCompare(b.employee.fullName);
}

function csuiteHeading(people: Ranked[]): string {
  const acronyms: string[] = [];
  for (const person of people) {
    const acronym = chiefAcronym(person.employee.title);
    if (!acronym || acronym === "Chief") return "C-suite";
    if (!acronyms.includes(acronym)) acronyms.push(acronym);
  }
  if (acronyms.length > 0 && acronyms.length <= 4) return acronyms.join(" · ");
  return "C-suite";
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

export function buildCompanyHierarchy(
  company: CompanyProfile,
  employees: CompanyEmployee[],
): CompanyHierarchy {
  const ranked = rankEmployees(employees);
  const present = [...BANDS, UNLISTED].filter((band) =>
    ranked.some((person) => person.band.id === band.id),
  );

  const groups = present.map((band) => {
    const people = ranked
      .filter((person) => person.band.id === band.id)
      .sort(compareRanked);
    const label = band.id === "csuite" ? csuiteHeading(people) : band.label;
    return { band, people, label };
  });

  const bands: HierarchyBand[] = groups.map((group) => ({
    id: group.band.id,
    label: group.label,
    color: group.band.color,
    count: group.people.length,
  }));

  const nodes: HierarchyNode[] = [];
  const links: HierarchyLink[] = [];
  const companyId = `company:${company.id}`;
  const bandGap = 86;

  nodes.push({
    id: companyId,
    kind: "company",
    label: company.name,
    color: "#0A66C2",
    imageUrl: company.logoUrl,
    x: 0,
    y: 0,
    radius: 28,
    pillWidth: 0,
  });

  let cursor = 96;
  let previousId = companyId;

  for (const group of groups) {
    if (group.people.length === 1) {
      const person = group.people[0];
      nodes.push({
        id: person.employee.id,
        kind: "person",
        label: person.employee.fullName,
        subtitle: person.shortTitle,
        color: group.band.color,
        imageUrl: person.employee.profilePicUrl,
        employeeId: person.employee.id,
        x: 0,
        y: cursor,
        radius: 22,
        pillWidth: 0,
      });
      links.push({ source: previousId, target: person.employee.id });
      previousId = person.employee.id;
      cursor += 112;
      continue;
    }

    const rows = chunk(group.people, PER_ROW);
    const bandId = `band:${group.band.id}`;
    const width = pillWidth(group.label);
    const bandY = cursor;

    const block = (rows.length - 1) * SUB;
    const spanBottom = bandY + bandGap + block + PERSON_R + 40;
    nodes.push({
      id: bandId,
      kind: "band",
      label: group.label,
      color: group.band.color,
      x: 0,
      y: bandY,
      radius: 16,
      pillWidth: width,
      spanBottom,
    });
    links.push({ source: previousId, target: bandId });
    previousId = bandId;

    rows.forEach((row, rowIndex) => {
      const rowY = bandY + bandGap + rowIndex * SUB;
      const startX = -((row.length - 1) * COL) / 2;
      row.forEach((person, index) => {
        nodes.push({
          id: person.employee.id,
          kind: "person",
          label: person.employee.fullName,
          subtitle: person.shortTitle,
          color: group.band.color,
          imageUrl: person.employee.profilePicUrl,
          employeeId: person.employee.id,
          x: startX + index * COL,
          y: rowY,
          radius: PERSON_R,
          pillWidth: 0,
        });
        links.push({ source: bandId, target: person.employee.id });
      });
    });

    cursor = bandY + bandGap + block + ROW_CLEAR;
  }

  return {
    nodes,
    links,
    bands,
    flow: bands.map((band) => band.label).join(" → "),
  };
}
