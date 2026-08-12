"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Eye, Hash, Heart, Share2, Video, X } from "lucide-react";
import type {
  TikTokGraphNode,
  TikTokHashtag,
  TikTokVideo,
} from "@/lib/tiktokTypes";
import { formatTikTokCount } from "@/lib/tiktokTypes";

interface Props {
  node: TikTokGraphNode | null;
  videos: TikTokVideo[];
  hashtags: TikTokHashtag[];
  onClose: () => void;
  onSelectVideo?: (videoId: string) => void;
}

export default function TikTokVideoPanel({
  node,
  videos,
  hashtags,
  onClose,
  onSelectVideo,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const video = useMemo(() => {
    if (!node || node.kind !== "video" || !node.refId) return null;
    return videos.find((v) => v.id === node.refId) ?? null;
  }, [node, videos]);

  const hashtag = useMemo(() => {
    if (!node || node.kind !== "hashtag" || !node.refId) return null;
    return (
      hashtags.find((h) => h.label === node.refId || h.id === node.id) ?? null
    );
  }, [node, hashtags]);

  const relatedVideos = useMemo(() => {
    if (!hashtag) return [];
    return videos.filter((v) => hashtag.videoIds.includes(v.id));
  }, [hashtag, videos]);

  if (!mounted || !node || node.kind === "self") return null;

  const panel = (
    <AnimatePresence>
      {node ? (
        <motion.aside
          key={node.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 max-h-[70dvh] overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0a0a0c]/95 p-4 shadow-2xl backdrop-blur-xl sm:inset-auto sm:bottom-auto sm:left-auto sm:right-4 sm:top-24 sm:w-[340px] sm:max-h-[calc(100dvh-8rem)] sm:rounded-2xl"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                {node.kind === "video" ? "Video" : "Hashtag"}
              </div>
              <h3 className="mt-0.5 truncate text-base font-semibold text-white">
                {node.kind === "hashtag" ? node.label : videoSnippet(video?.text)}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {video && (
            <div className="space-y-3">
              {video.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={video.coverUrl}
                  alt=""
                  className="aspect-[9/14] w-full rounded-xl object-cover"
                />
              )}
              {video.text && (
                <p className="text-sm leading-relaxed text-white/70">{video.text}</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Metric icon={Eye} label="Plays" value={formatTikTokCount(video.playCount)} />
                <Metric icon={Heart} label="Likes" value={formatTikTokCount(video.diggCount)} />
                <Metric icon={Share2} label="Shares" value={formatTikTokCount(video.shareCount)} />
                <Metric icon={Video} label="Comments" value={formatTikTokCount(video.commentCount)} />
              </div>
              {video.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {video.hashtags.map((h) => (
                    <span
                      key={h.name}
                      className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[11px] text-white/60"
                    >
                      #{h.name}
                    </span>
                  ))}
                </div>
              )}
              {video.musicName && (
                <p className="text-xs text-white/45">
                  ♪ {video.musicName}
                  {video.musicAuthor ? ` — ${video.musicAuthor}` : ""}
                </p>
              )}
              <a
                href={video.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[#25F4EE] hover:underline"
              >
                Open on TikTok <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {hashtag && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Hash className="h-4 w-4 text-[#FE2C55]" />
                Used on {hashtag.weight} video{hashtag.weight === 1 ? "" : "s"}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Metric icon={Eye} label="Plays" value={formatTikTokCount(hashtag.playCount)} />
                <Metric icon={Heart} label="Likes" value={formatTikTokCount(hashtag.diggCount)} />
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                  Videos
                </div>
                {relatedVideos.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onSelectVideo?.(v.id)}
                    className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-2 text-left transition hover:bg-white/10"
                  >
                    {v.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.coverUrl}
                        alt=""
                        className="h-12 w-9 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-9 shrink-0 items-center justify-center rounded bg-white/10">
                        <Video className="h-4 w-4 text-white/40" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs text-white/80">
                        {videoSnippet(v.text)}
                      </div>
                      <div className="mt-0.5 text-[10px] text-white/40">
                        {formatTikTokCount(v.playCount)} plays ·{" "}
                        {formatTikTokCount(v.diggCount)} likes
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(panel, document.body);
}

function videoSnippet(text?: string, max = 72): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "TikTok video";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-black/30 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/35">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm text-white">{value}</div>
    </div>
  );
}
