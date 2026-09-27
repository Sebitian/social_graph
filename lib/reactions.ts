/** LinkedIn reaction types → the emoji LinkedIn uses in the reaction picker. */
export const REACTION_EMOJI: Record<string, string> = {
  LIKE: "👍",
  PRAISE: "👏", // Celebrate
  EMPATHY: "🫶", // Support
  APPRECIATION: "❤️", // Love
  INTEREST: "💡", // Insightful
  ENTERTAINMENT: "😂", // Funny
};

export const REACTION_TITLE: Record<string, string> = {
  LIKE: "Like",
  PRAISE: "Celebrate",
  EMPATHY: "Support",
  APPRECIATION: "Love",
  INTEREST: "Insightful",
  ENTERTAINMENT: "Funny",
};

/** Distinct LinkedIn reaction-picker colors. */
export const REACTION_COLOR: Record<string, string> = {
  LIKE: "#378FE9",
  PRAISE: "#5F9B41",
  EMPATHY: "#7B5EA7",
  APPRECIATION: "#DF704D",
  INTEREST: "#F5C33B",
  ENTERTAINMENT: "#4CB3D4",
};

const REACTION_FALLBACK_COLORS = [
  "#378FE9",
  "#5F9B41",
  "#DF704D",
  "#7B5EA7",
  "#F5C33B",
  "#4CB3D4",
  "#E167A4",
  "#8B5CF6",
];

export function reactionColor(typeOrLabel: string): string {
  const raw = typeOrLabel.trim();
  const upper = raw.toUpperCase();
  if (REACTION_COLOR[upper]) return REACTION_COLOR[upper];
  const byTitle = Object.entries(REACTION_TITLE).find(
    ([, title]) => title.toLowerCase() === raw.toLowerCase(),
  );
  if (byTitle && REACTION_COLOR[byTitle[0]]) return REACTION_COLOR[byTitle[0]];
  let hash = 0;
  for (const char of upper) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return REACTION_FALLBACK_COLORS[hash % REACTION_FALLBACK_COLORS.length];
}

export function reactionEntries(
  byType?: Record<string, number>,
): { type: string; emoji: string; title: string; count: number }[] {
  if (!byType) return [];
  return Object.entries(byType)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      type,
      emoji: REACTION_EMOJI[type] ?? "👍",
      title: REACTION_TITLE[type] ?? type,
      count,
    }));
}

export function formatReactionBreakdown(byType?: Record<string, number>): string {
  return reactionEntries(byType)
    .map(({ emoji, count }) => `${emoji}${count}`)
    .join(" ");
}
