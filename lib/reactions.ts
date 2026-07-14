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
