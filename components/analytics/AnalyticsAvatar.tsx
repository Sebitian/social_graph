"use client";

import { useState } from "react";
import type { SocialSourcePlatform } from "@/lib/types";
import { resolveProfilePicUrl } from "@/lib/avatarUrl";

interface Props {
  username: string;
  fullName?: string;
  profilePicUrl?: string;
  platform: SocialSourcePlatform;
  size?: number;
}

export default function AnalyticsAvatar({
  username,
  fullName,
  profilePicUrl,
  platform,
  size = 28,
}: Props) {
  const [failed, setFailed] = useState(false);
  const src = resolveProfilePicUrl(username, profilePicUrl, platform);
  const style = { width: size, height: size };
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="rounded-full object-cover ring-1 ring-[#161A17]/10"
        style={style}
      />
    );
  }
  return (
    <span
      className="flex items-center justify-center rounded-full bg-[#E7E0D4] text-[10px] font-semibold text-[#161A17]/85 ring-1 ring-[#161A17]/10"
      style={style}
    >
      {(fullName || username).charAt(0).toUpperCase()}
    </span>
  );
}
