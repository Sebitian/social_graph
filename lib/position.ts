/** Split a LinkedIn headline/position into title + company when possible.
 *  Typical shapes: "Title @ Company", "Title at Company", "Title, Company".
 */

const PLACEHOLDER = /^(?:-|--|—|–|\.{2,}|n\/?a)$/i;

/** Role words that follow a comma as part of the title, not a company. */
const TITLE_CONTINUATION =
  /^(?:and|&|or)?\s*(?:equity|investments?|business(?:\s+development)?|development|research|operations?|strategy|applications?|corporate|sales|marketing|product|engineering|design|finance|legal|growth|comms?|communications|brand|partnerships?|innovation|analytics|data(?:\s+science)?|science|technology|biotechnology|media|consulting|creative|commercial)\b/i;

const SOFT_PRESENCE = new Set([
  "follower",
  "following",
  "tagged in reel",
  "mentioned in reel",
]);

export function parsePosition(position?: string): {
  title?: string;
  company?: string;
} {
  const raw = position?.trim();
  if (!raw || PLACEHOLDER.test(raw)) return {};

  const atSymbol = raw.match(/^(.+?)\s*@\s*(.+)$/);
  if (atSymbol) {
    return pack(atSymbol[1], atSymbol[2]);
  }

  const atWord = raw.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atWord && startsLikeName(atWord[2])) {
    return pack(atWord[1], atWord[2]);
  }

  const comma = raw.match(/^(.+?),\s+(.+)$/);
  if (comma) {
    const title = comma[1].trim();
    const rest = comma[2].trim();
    if (
      title.length > 0 &&
      title.length <= 64 &&
      startsLikeName(rest) &&
      !TITLE_CONTINUATION.test(rest)
    ) {
      return pack(title, rest);
    }
  }

  return { title: raw };
}

export function formatPosition(position?: string): string | undefined {
  const { title, company } = parsePosition(position);
  if (title && company) return `${title} · ${company}`;
  return title || company || undefined;
}

export function isUsefulPosition(position?: string): boolean {
  const raw = position?.trim();
  if (!raw || PLACEHOLDER.test(raw)) return false;
  return !SOFT_PRESENCE.has(raw.toLowerCase());
}

function pack(titleRaw: string, companyRaw: string): {
  title?: string;
  company?: string;
} {
  const title = cleanTitle(titleRaw);
  const company = cleanCompany(companyRaw);
  if (title && company) return { title, company };
  if (company) return { company };
  if (title) return { title };
  return {};
}

function cleanTitle(value: string): string {
  return value.replace(/\s+/g, " ").replace(/[|·]+$/g, "").trim();
}

function cleanCompany(value: string): string {
  // Drop trailing pipe-separated fluff: "AbbVie R&D | UIUC ECE" → "AbbVie R&D"
  let s = value.split("|")[0]?.trim() || value.trim();
  s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
  s = s.replace(
    /\s+and\s+(?:write|writing|help|helping|build|building|work|working)\b.*$/i,
    "",
  );
  s = s.replace(/[|·.,;:!?]+$/g, "").trim();
  return s;
}

function startsLikeName(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^[\p{Lu}0-9]/u.test(trimmed);
}
