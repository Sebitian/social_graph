export const CHAT_SOCIAL_PLATFORMS = [
  "linkedin",
  "instagram",
  "facebook",
] as const;

export type ChatSocialPlatform = (typeof CHAT_SOCIAL_PLATFORMS)[number];

export type ChatSourceId = ChatSocialPlatform | "company";

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
