/** Split a LinkedIn headline/position into title + company when possible. */
export function parsePosition(position?: string): {
  title?: string;
  company?: string;
} {
  const raw = position?.trim();
  if (!raw) return {};

  const atWord = raw.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atWord) {
    return { title: atWord[1].trim(), company: cleanCompany(atWord[2]) };
  }

  const atSymbol = raw.match(/^(.+?)\s*@\s*(.+)$/);
  if (atSymbol) {
    return { title: atSymbol[1].trim(), company: cleanCompany(atSymbol[2]) };
  }

  return { title: raw };
}

function cleanCompany(value: string): string {
  // Drop trailing pipe-separated fluff: "AbbVie R&D | UIUC ECE" → "AbbVie R&D"
  return value.split("|")[0]?.trim() || value.trim();
}
