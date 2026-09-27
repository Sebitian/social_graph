"use client";

import type { LucideIcon } from "lucide-react";
import { BarChart3, MessageCircle, Network, User } from "lucide-react";

export type FooterTab = "map" | "analytics" | "chat" | "profile";

const TABS: { id: FooterTab; label: string; Icon: LucideIcon }[] = [
  { id: "map", label: "Map", Icon: Network },
  { id: "analytics", label: "Analytics", Icon: BarChart3 },
  { id: "chat", label: "Chat", Icon: MessageCircle },
  { id: "profile", label: "Profile", Icon: User },
];

interface Props {
  active: FooterTab;
  onSelect: (tab: FooterTab) => void;
  tone?: "ink" | "paper";
  className?: string;
}

export default function GraphFooterTabs({
  active,
  onSelect,
  tone = "ink",
  className = "",
}: Props) {
  const paper = tone === "paper";
  return (
    <nav
      aria-label="Graph sections"
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] ${className}`}
    >
      <div
        className={`pointer-events-auto flex w-full max-w-lg items-stretch gap-0.5 rounded-2xl border p-1 sm:max-w-xl ${
          paper
            ? "border-[#161A17]/10 bg-[#FBF8F2]/95 shadow-[0_8px_32px_rgba(22,26,23,0.12)]"
            : "border-white/15 bg-black/75 shadow-[0_8px_32px_rgba(0,0,0,0.55),0_2px_8px_rgba(0,0,0,0.35)] backdrop-blur-xl"
        }`}
      >
        {TABS.map(({ id, label, Icon }) => {
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              aria-current={selected ? "page" : undefined}
              className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium transition ${
                paper
                  ? selected
                    ? "bg-[#E7E0D4] text-[#161A17]"
                    : "text-[#5E665F] active:bg-[#E7E0D4]"
                  : selected
                    ? "bg-white/15 text-white shadow-inner"
                    : "text-white/45 active:bg-white/10 active:text-white/75"
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] shrink-0 ${
                  paper
                    ? selected
                      ? "text-[#161A17]"
                      : "text-[#5E665F]"
                    : selected
                      ? "text-white"
                      : "text-white/55"
                }`}
              />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
