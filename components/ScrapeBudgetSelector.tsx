"use client";

import { MessageCircle, ShieldCheck } from "lucide-react";
import type { ScrapeBudget } from "@/lib/scrapeBudget";
import {
  estimateScrapeBudget,
  formatUsd,
  SCRAPE_BUDGET_LIMITS,
} from "@/lib/scrapeBudget";

interface Props {
  value: ScrapeBudget;
  onChange: (budget: ScrapeBudget) => void;
  compact?: boolean;
}

const PRESETS = [
  {
    label: "Free",
    description: "Starter graph",
    posts: SCRAPE_BUDGET_LIMITS.freePosts,
    comments: SCRAPE_BUDGET_LIMITS.freeCommentsPerPost,
  },
  {
    label: "Balanced",
    description: "More signal",
    posts: Math.min(25, SCRAPE_BUDGET_LIMITS.maxPosts),
    comments: Math.min(25, SCRAPE_BUDGET_LIMITS.maxCommentsPerPost),
  },
  {
    label: "Deep",
    description: "Largest graph",
    posts: Math.min(50, SCRAPE_BUDGET_LIMITS.maxPosts),
    comments: Math.min(75, SCRAPE_BUDGET_LIMITS.maxCommentsPerPost),
  },
];

export default function ScrapeBudgetSelector({
  value,
  onChange,
  compact = false,
}: Props) {
  const estimate = estimateScrapeBudget(value);

  function update(next: Partial<ScrapeBudget>) {
    onChange({
      postLimit: next.postLimit ?? value.postLimit,
      commentsPerPost: next.commentsPerPost ?? value.commentsPerPost,
      reciprocityEnabled: next.reciprocityEnabled ?? value.reciprocityEnabled,
      reciprocityFriends: next.reciprocityFriends ?? value.reciprocityFriends,
      reciprocityPostsPerFriend:
        next.reciprocityPostsPerFriend ?? value.reciprocityPostsPerFriend,
    });
  }

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-black/20 p-3 text-left backdrop-blur sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-white/85">
            <MessageCircle className="h-4 w-4 shrink-0 text-ig-pink" />
            Scrape depth
          </div>
          <p className="mt-1 text-xs text-white/45">
            More comments can improve the graph, but increases Apify usage.
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 sm:block sm:text-right">
          <div className="text-[10px] uppercase tracking-wide text-white/35 sm:text-xs">
            Max estimate
          </div>
          <div className="font-mono text-sm font-semibold text-white">
            {estimate.withinFreeTier
              ? "Free"
              : formatUsd(estimate.estimatedCostUsd)}
          </div>
        </div>
      </div>

      {!compact && (
        <div className="mt-3 grid grid-cols-3 gap-1.5 sm:mt-4 sm:gap-2">
          {PRESETS.map((preset) => {
            const active =
              value.postLimit === preset.posts &&
              value.commentsPerPost === preset.comments;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() =>
                  onChange({
                    postLimit: preset.posts,
                    commentsPerPost: preset.comments,
                    reciprocityEnabled: value.reciprocityEnabled,
                    reciprocityFriends: value.reciprocityFriends,
                    reciprocityPostsPerFriend: value.reciprocityPostsPerFriend,
                  })
                }
                className={`min-h-[44px] rounded-xl border px-2 py-2 text-left transition sm:px-3 ${
                  active
                    ? "border-ig-pink/60 bg-ig-pink/15 text-white"
                    : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                <div className="text-xs font-semibold sm:text-sm">{preset.label}</div>
                <div className="hidden text-[11px] text-white/35 sm:block">
                  {preset.description}
                </div>
                <div className="text-[10px] text-white/35 sm:hidden">
                  {preset.posts}×{preset.comments}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3 sm:mt-4 sm:gap-4">
        <label className="block">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-white/65">Recent posts/reels</span>
            <span className="font-mono text-white">{value.postLimit}</span>
          </div>
          <input
            type="range"
            min={1}
            max={SCRAPE_BUDGET_LIMITS.maxPosts}
            value={value.postLimit}
            onChange={(e) => update({ postLimit: Number(e.target.value) })}
            className="w-full accent-[#cd486b]"
          />
        </label>

        <label className="block">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-white/65">Comments per post</span>
            <span className="font-mono text-white">{value.commentsPerPost}</span>
          </div>
          <input
            type="range"
            min={1}
            max={SCRAPE_BUDGET_LIMITS.maxCommentsPerPost}
            value={value.commentsPerPost}
            onChange={(e) =>
              update({ commentsPerPost: Number(e.target.value) })
            }
            className="w-full accent-[#8a3ab9]"
          />
        </label>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={value.reciprocityEnabled}
              onChange={(e) => update({ reciprocityEnabled: e.target.checked })}
              className="mt-1 h-4 w-4 accent-[#cd486b]"
            />
            <div>
              <div className="text-xs font-medium text-white/75">
                Two-way reciprocity pass
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-white/40">
                Scrape top friends&apos; public posts to see if you comment back.
                Improves clustering; public accounts only.
              </p>
            </div>
          </label>

          {value.reciprocityEnabled && (
            <div className="mt-4 flex flex-col gap-4 border-t border-white/10 pt-4">
              <label className="block">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-white/65">Top friends to check</span>
                  <span className="font-mono text-white">{value.reciprocityFriends}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={SCRAPE_BUDGET_LIMITS.maxReciprocityFriends}
                  value={value.reciprocityFriends}
                  onChange={(e) =>
                    update({ reciprocityFriends: Number(e.target.value) })
                  }
                  className="w-full accent-[#cd486b]"
                />
              </label>
              <label className="block">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-white/65">Posts per friend</span>
                  <span className="font-mono text-white">
                    {value.reciprocityPostsPerFriend}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={SCRAPE_BUDGET_LIMITS.maxReciprocityPostsPerFriend}
                  value={value.reciprocityPostsPerFriend}
                  onChange={(e) =>
                    update({ reciprocityPostsPerFriend: Number(e.target.value) })
                  }
                  className="w-full accent-[#8a3ab9]"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span>
          Up to{" "}
          <span className="font-mono text-white/75">
            {estimate.maxComments}
          </span>{" "}
          comments scanned
          {estimate.reciprocityEnabled && estimate.maxReciprocityComments > 0 && (
            <>
              {" "}
              (+{estimate.maxReciprocityComments} reciprocity)
            </>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-ig-blue" />
          Hard-capped server-side
        </span>
      </div>

      {estimate.needsPaymentPrompt && (
        <p className="mt-3 rounded-xl border border-ig-orange/20 bg-ig-orange/10 px-3 py-2 text-xs text-ig-orange">
          This is above the free tier ({SCRAPE_BUDGET_LIMITS.freePosts} posts ×{" "}
          {SCRAPE_BUDGET_LIMITS.freeCommentsPerPost} comments
          {estimate.reciprocityEnabled
            ? ` + ${SCRAPE_BUDGET_LIMITS.freeReciprocityFriends} friends × ${SCRAPE_BUDGET_LIMITS.freeReciprocityPostsPerFriend} posts reciprocity`
            : ""}
          ). Actual Apify cost can be lower if fewer comments are returned.
        </p>
      )}
    </div>
  );
}
