"use client";

import {
  List,
  ListTree,
  Maximize2,
  Minimize2,
  Network,
  User,
} from "lucide-react";
import GraphNodeSearch from "@/components/GraphNodeSearch";
import { GraphHowToRead } from "@/components/GraphHowToRead";
import { SidebarButton, SidebarSection } from "@/components/SidebarNav";
import { type ModePersonOption } from "@/components/InstagramModeControls";
import { SidebarFill } from "@/components/SidebarSlots";
import type { FooterTab } from "@/components/GraphFooterTabs";
import type { InstagramMode } from "@/lib/instagramPeople";
import type { GraphNode } from "@/lib/types";

export type GraphLegendItem = {
  id: string;
  color: string;
  label: string;
};

interface Props {
  showLinkedInModes: boolean;
  linkedinMode: InstagramMode;
  onLinkedinMode: (mode: InstagramMode) => void;
  linkedinPeople: ModePersonOption[];
  linkedinPersonId: string;
  hasLinkedInCompany: boolean;
  showInstagramModes: boolean;
  instagramMode: InstagramMode;
  onInstagramMode: (mode: InstagramMode) => void;
  instagramPeople: ModePersonOption[];
  instagramPersonId: string;
  onInstagramPerson: (id: string) => void;
  hasInstagramCompany: boolean;
  showRoster: boolean;
  rosterActive: boolean;
  onToggleRoster: () => void;
  showHierarchy: boolean;
  hierarchyActive: boolean;
  onToggleHierarchy: () => void;
  section: FooterTab;
  showSearch: boolean;
  searchNodes: GraphNode[];
  searchSelectedId: string | null;
  onSearchSelect: (node: GraphNode) => void;
  searchPlatform: "instagram" | "linkedin" | "facebook" | null;
  showDepth: boolean;
  depth: "2d" | "3d";
  onDepth: (depth: "2d" | "3d") => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  howTo: "social" | "conference" | null;
  legend: GraphLegendItem[];
  flowHint: string | null;
}

export function ProfileComingSoon() {
  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
        <User className="h-5 w-5 text-white/55" />
      </span>
      <h1 className="text-lg font-medium text-white">Profiles are coming soon</h1>
      <p className="max-w-sm text-sm leading-relaxed text-white/45">
        A page for the person behind this graph is on the way. The map is ready now.
      </p>
    </div>
  );
}

export default function GraphChrome(props: Props) {
  return (
    <>
      <SidebarFill side="left">
        <LeftChrome {...props} />
      </SidebarFill>
      <SidebarFill side="right">
        <RightChrome {...props} />
      </SidebarFill>
    </>
  );
}

function LeftChrome({
  showRoster,
  rosterActive,
  onToggleRoster,
  showHierarchy,
  hierarchyActive,
  onToggleHierarchy,
}: Props) {
  if (!showRoster && !showHierarchy) return null;

  return (
    <SidebarSection title="View" icon={Network}>
      {showRoster ? (
        <SidebarButton
          onClick={onToggleRoster}
          active={rosterActive}
          icon={List}
        >
          Roster
        </SidebarButton>
      ) : null}
      {showHierarchy ? (
        <SidebarButton
          onClick={onToggleHierarchy}
          active={hierarchyActive}
          icon={ListTree}
        >
          Hierarchy
        </SidebarButton>
      ) : null}
    </SidebarSection>
  );
}

function RightChrome({
  showSearch,
  searchNodes,
  searchSelectedId,
  onSearchSelect,
  searchPlatform,
  showDepth,
  depth,
  onDepth,
  fullscreen,
  onToggleFullscreen,
  howTo,
  legend,
  flowHint,
  section,
}: Props) {
  if (section !== "map") return null;
  const showTools = showSearch || showDepth;
  return (
    <div className="border-b border-[#D5CDBF]">
      {showTools ? (
        <div className="px-3 pt-3">
          <p className="pb-2 text-[11px] font-semibold tracking-[0.14em] text-[#5E665F] uppercase">
            Graph
          </p>
          {showSearch ? (
            <GraphNodeSearch
              nodes={searchNodes}
              selectedId={searchSelectedId}
              onSelect={onSearchSelect}
              platform={searchPlatform}
              variant="sidebar"
            />
          ) : null}
          <div className={`flex items-center gap-2 ${showSearch ? "mt-2" : ""}`}>
            {showDepth ? (
              <div className="inline-flex rounded-md border border-[#D5CDBF] bg-[#F3EEE4] p-0.5">
                {(["2d", "3d"] as const).map((next) => (
                  <button
                    key={next}
                    type="button"
                    onClick={() => onDepth(next)}
                    className={`rounded px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      depth === next
                        ? "bg-[#0F766E] text-[#FBF8F2]"
                        : "text-[#5E665F] hover:text-[#161A17]"
                    }`}
                  >
                    {next}
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="ml-auto flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-[#5E665F] hover:bg-[#E7E0D4] hover:text-[#161A17]"
            >
              {fullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
              {fullscreen ? "Exit" : "Full screen"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end px-3 pt-3">
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-[#5E665F] hover:bg-[#E7E0D4] hover:text-[#161A17]"
          >
            {fullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
            {fullscreen ? "Exit" : "Full screen"}
          </button>
        </div>
      )}

      {howTo ? (
        <div className="mt-3">
          <GraphHowToRead placement="sidebar" variant={howTo} />
        </div>
      ) : null}

      {legend.length > 0 ? (
        <div className="px-3 py-3">
          <p className="pb-2 text-[11px] font-semibold tracking-[0.14em] text-[#5E665F] uppercase">
            Groups
          </p>
          <ul className="space-y-1.5">
            {legend.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 text-[12px] text-[#161A17]"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-[#161A17]/10"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {flowHint ? (
        <div className="px-3 py-3">
          <p className="pb-1 text-[11px] font-semibold tracking-[0.14em] text-[#5E665F] uppercase">
            Flow
          </p>
          <p className="text-[12px] leading-relaxed text-[#5E665F]">{flowHint}</p>
        </div>
      ) : null}
    </div>
  );
}
