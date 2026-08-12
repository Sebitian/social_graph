"use client";

import { motion } from "framer-motion";
import { Eye, Hash, Heart, Share2, Users, Video } from "lucide-react";
import type { TikTokStats as Stats } from "@/lib/tiktokTypes";
import { formatTikTokCount } from "@/lib/tiktokTypes";

interface Props {
  stats: Stats;
  topHashtags?: { label: string; weight: number; color?: string }[];
  onSelectHashtag?: (label: string) => void;
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-black/25 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/35">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 font-mono text-lg text-white">{value}</div>
    </div>
  );
}

export default function TikTokNetworkStats({
  stats,
  topHashtags = [],
  onSelectHashtag,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur sm:p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="text-sm font-semibold text-white/80">
          Visibility snapshot
        </div>
        <span className="rounded-full bg-[#FE2C55]/15 px-2 py-0.5 text-[10px] font-medium text-[#FE2C55]">
          TikTok
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <StatCard icon={Users} label="Followers" value={formatTikTokCount(stats.followers)} />
        <StatCard icon={Video} label="Videos" value={stats.videoCount} />
        <StatCard icon={Eye} label="Plays" value={formatTikTokCount(stats.totalPlays)} />
        <StatCard icon={Heart} label="Likes" value={formatTikTokCount(stats.totalDiggs)} />
        <StatCard icon={Share2} label="Shares" value={formatTikTokCount(stats.totalShares)} />
        <StatCard icon={Hash} label="Hashtags" value={stats.hashtagCount} />
      </div>

      {topHashtags.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">
            Top hashtags
          </div>
          <div className="flex flex-wrap gap-1.5">
            {topHashtags.slice(0, 8).map((g) => (
              <button
                key={g.label}
                type="button"
                onClick={() => onSelectHashtag?.(g.label)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: g.color ?? "#FE2C55" }}
                />
                #{g.label}
                <span className="tabular-nums text-white/35">{g.weight}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
