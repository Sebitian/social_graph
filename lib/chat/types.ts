export const CHAT_SOCIAL_PLATFORMS = [
  "linkedin",
  "instagram",
  "facebook",
] as const;

export type ChatSocialPlatform = (typeof CHAT_SOCIAL_PLATFORMS)[number];

export type ChatSourceId = ChatSocialPlatform | "company" | "tiktok" | "conference";

export type ChatSourceInfo = {
  id: ChatSourceId;
  label: string;
  title: string;
  handle: string;
  subtitle?: string;
};

export function isChatSocialPlatform(
  value: unknown,
): value is ChatSocialPlatform {
  return (
    value === "linkedin" || value === "instagram" || value === "facebook"
  );
}

export function isChatSourceId(value: unknown): value is ChatSourceId {
  return isChatSocialPlatform(value) || value === "company" || value === "tiktok" || value === "conference";
}

export type ChatTableCell = string | number | null;

export type ChatTableColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
};

export type ChatTable = {
  title?: string | null;
  caption?: string | null;
  columns: ChatTableColumn[];
  rows: Array<Record<string, ChatTableCell>>;
};

export type ChatChartPoint = {
  t?: number | null;
  label: string;
  v: number;
};

export type ChatChartSeries = {
  id: string;
  label: string;
  color?: string;
  points: ChatChartPoint[];
};

export type ChatChart = {
  title?: string | null;
  caption?: string | null;
  yLabel?: string | null;
  series: ChatChartSeries[];
};
