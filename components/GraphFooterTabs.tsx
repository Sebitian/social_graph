"use client";

import type { LucideIcon } from "lucide-react";
import { BarChart3, Network, Share2, UserCircle } from "lucide-react";

export type FooterTab = "map" | "analytics" | "profile" | "share";

const TABS: { id: FooterTab; label: string; Icon: LucideIcon }[] = [
  { id: "map", label: "Map", Icon: Network },
  { id: "analytics", label: "Analytics", Icon: BarChart3 },
  { id: "profile", label: "Profile", Icon: UserCircle },
  { id: "share", label: "Share", Icon: Share2 },
];

interface Props {
  active: FooterTab;
  onSelect: (tab: FooterTab) => void;
  className?: string;
}

export default function GraphFooterTabs({ active, onSelect, className = "" }: Props) {
  return (
    <nav
      aria-label="Graph sections"
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] ${className}`}
    >
      <div className="pointer-events-auto flex w-full max-w-lg items-stretch gap-0.5 rounded-2xl border border-white/15 bg-black/75 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.55),0_2px_8px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:max-w-xl">
        {TABS.map(({ id, label, Icon }) => {
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              aria-current={selected ? "page" : undefined}
              className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium transition ${
                selected
                  ? "bg-white/15 text-white shadow-inner"
                  : "text-white/45 active:bg-white/10 active:text-white/75"
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] shrink-0 ${selected ? "text-white" : "text-white/55"}`}
              />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
