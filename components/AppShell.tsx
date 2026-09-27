"use client";

import {
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Clock,
  FolderOpen,
  MessageCircle,
  Network,
  PanelLeft,
  PanelRight,
  Search,
  Settings,
  User,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import BrandMark from "@/components/BrandMark";
import { SidebarSlot, SidebarSlotProvider } from "@/components/SidebarSlots";
import {
  SidebarGroup,
  SidebarItem,
  SidebarSection,
} from "@/components/SidebarNav";
import {
  ConferenceIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  SpotifyIcon,
  TikTokIcon,
} from "@/components/PlatformIcons";
import { sectionFromPathname, pathWithSection } from "@/lib/jobSections";
import type { JobIndexEntry } from "@/lib/jobs";
import { RUN_PLATFORMS } from "@/lib/jobCatalog";

const LEFT_KEY = "netgraph-sidebar-left";
const RIGHT_KEY = "netgraph-sidebar-right-v2";
const SEARCHED_HANDLES_KEY = "netgraph.searchedHandles";

function readSidebarKey(key: string): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(key);
  return stored === "0" ? false : stored === "1" ? true : true;
}

function useSidebarOpen(key: string): [boolean, (open: boolean | ((prev: boolean) => boolean)) => void] {
  const open = useSyncExternalStore(
    (callback) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) callback();
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
    () => readSidebarKey(key),
    () => true,
  );
  const setOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    if (typeof window !== "undefined") {
      const resolved = typeof next === "function" ? next(readSidebarKey(key)) : next;
      window.localStorage.setItem(key, resolved ? "1" : "0");
      window.dispatchEvent(new StorageEvent("storage", { key }));
    }
  };
  return [open, setOpen];
}

function PanelButton({
  side,
  pressed,
  onClick,
}: {
  side: "left" | "right";
  pressed: boolean;
  onClick: () => void;
}) {
  const label =
    side === "left" ? "Toggle Primary Side Bar" : "Toggle Secondary Side Bar";
  const shortcut = side === "left" ? "⌘B" : "⌥⌘B";
  const Icon = side === "left" ? PanelLeft : PanelRight;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={`${label} (${shortcut})`}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-[#E7E0D4] ${
        pressed ? "text-[#161A17]" : "text-[#5E665F]"
      }`}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}

function sidebarClass(side: "left" | "right"): string {
  const edge =
    side === "left"
      ? "left-0 border-r md:left-auto"
      : "right-0 border-l md:right-auto";
  return `fixed bottom-0 top-9 z-40 w-[min(17rem,86vw)] overflow-y-auto border-[#D5CDBF] bg-[#FBF8F2] text-[#161A17] md:sticky md:bottom-auto md:z-auto md:h-[calc(100dvh-2.25rem)] md:w-[260px] md:shrink-0 ${edge}`;
}

type PlatformKey =
  | "linkedin"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "spotify"
  | "conference"
  | "all"
  | "community";

const PLATFORM_ICON: Record<
  PlatformKey,
  LucideIcon | typeof LinkedInIcon
> = {
  linkedin: LinkedInIcon,
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  tiktok: TikTokIcon,
  spotify: SpotifyIcon,
  conference: ConferenceIcon,
  all: Network,
  community: Network,
};

const PLATFORM_LABEL: Record<PlatformKey, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  spotify: "Spotify",
  conference: "Conference",
  all: "All platforms",
  community: "Community",
};

function platformOfJob(job: JobIndexEntry): PlatformKey {
  if (job.lane === "conference") return "conference";
  if (job.kind === "aiman") return "community";
  if (job.kind === "bundle") return "all";
  if (job.kind === "company") return "linkedin";
  if (job.kind === "spotify") return "spotify";
  if (job.kind === "tiktok") return "tiktok";
  if (job.platform) return job.platform;
  for (const p of RUN_PLATFORMS) {
    if (job.label.endsWith(`-${p}`)) return p;
  }
  if (job.label.endsWith("-all")) return "all";
  return "all";
}

function groupJobsBySubject(jobs: JobIndexEntry[]) {
  const map = new Map<string, JobIndexEntry[]>();
  for (const job of jobs) {
    const list = map.get(job.subject) ?? [];
    list.push(job);
    map.set(job.subject, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.label.localeCompare(b.label));
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

const EMPTY_RECENT_HANDLES: string[] = [];

let recentHandlesRaw: string | null = null;
let recentHandlesSnapshot: string[] = EMPTY_RECENT_HANDLES;

function readRecentHandles(): string[] {
  if (typeof window === "undefined") return EMPTY_RECENT_HANDLES;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(SEARCHED_HANDLES_KEY);
  } catch {
    return EMPTY_RECENT_HANDLES;
  }
  if (raw === recentHandlesRaw) return recentHandlesSnapshot;
  recentHandlesRaw = raw;
  if (!raw) {
    recentHandlesSnapshot = EMPTY_RECENT_HANDLES;
    return recentHandlesSnapshot;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    const handles = Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : EMPTY_RECENT_HANDLES;
    recentHandlesSnapshot = handles.length ? handles : EMPTY_RECENT_HANDLES;
  } catch {
    recentHandlesSnapshot = EMPTY_RECENT_HANDLES;
  }
  return recentHandlesSnapshot;
}

function subscribeRecentHandles(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === SEARCHED_HANDLES_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

function useRecentHandles() {
  return useSyncExternalStore(
    subscribeRecentHandles,
    readRecentHandles,
    () => EMPTY_RECENT_HANDLES,
  );
}

function RecentJobs({ jobs, pathname }: { jobs: JobIndexEntry[]; pathname: string }) {
  const recentIds = useRecentHandles();

  const recent = useMemo(() => {
    const byHandle = new Map<string, JobIndexEntry>();
    for (const job of jobs) {
      const handle = job.label.replace(/-[^-]+$/, "");
      const existing = byHandle.get(handle);
      if (!existing || job.id > existing.id) {
        byHandle.set(handle, job);
      }
    }
    return recentIds
      .map(
        (handle) =>
          byHandle.get(handle) ??
          jobs.find(
            (j) => j.subject.toLowerCase() === handle.toLowerCase(),
          ),
      )
      .filter((job): job is JobIndexEntry => Boolean(job))
      .slice(0, 5);
  }, [jobs, recentIds]);

  if (!recent.length) {
    return (
      <p className="px-2 text-[12px] leading-relaxed text-[#5E665F]">
        Recent runs will appear here as you explore graphs.
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {recent.map((job) => {
        const active =
          pathname === job.href || pathname.startsWith(`${job.href}/`);
        const Icon = PLATFORM_ICON[platformOfJob(job)];
        return (
          <li key={job.id}>
            <Link
              href={job.href}
              aria-current={active ? "page" : undefined}
              className={`flex h-8 items-center gap-2 rounded-md px-2 text-[13px] ${
                active
                  ? "bg-[#0F766E]/10 text-[#0F766E]"
                  : "text-[#161A17] hover:bg-[#E7E0D4]"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{job.title}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SubjectGroup({
  subject,
  jobs,
  pathname,
}: {
  subject: string;
  jobs: JobIndexEntry[];
  pathname: string;
}) {
  return (
    <>
      <SidebarGroup title={subject} />
      <ul className="space-y-0.5">
        {jobs.map((job) => {
          const active = pathname === job.href || pathname.startsWith(`${job.href}/`);
          const platform = platformOfJob(job);
          const Icon = PLATFORM_ICON[platform];
          return (
            <li key={job.id}>
              <Link
                href={job.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-8 items-center justify-between gap-2 rounded-md px-2 text-[13px] ${
                  active
                    ? "bg-[#0F766E]/10 text-[#0F766E]"
                    : "text-[#161A17] hover:bg-[#E7E0D4]"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{PLATFORM_LABEL[platform]}</span>
                </span>
                <span className="shrink-0 font-mono text-[10px] text-[#5E665F]">
                  {job.id.slice(0, 8)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function JobExplorer({
  jobs,
  pathname,
}: {
  jobs: JobIndexEntry[];
  pathname: string;
}) {
  const subjects = useMemo(() => groupJobsBySubject(jobs), [jobs]);
  return (
    <nav aria-label="Jobs">
      {subjects.map(([subject, list]) => (
        <SubjectGroup key={subject} subject={subject} jobs={list} pathname={pathname} />
      ))}
    </nav>
  );
}

function RunInspector({
  jobs,
  pathname,
}: {
  jobs: JobIndexEntry[];
  pathname: string;
}) {
  const current = jobs.find((job) => job.href === pathname) ?? null;
  const related = current
    ? jobs.filter(
        (job) => job.lane === current.lane && job.subject === current.subject,
      )
    : [];

  return (
    <div className="px-3 py-2">
      <p className="pb-2 text-[11px] font-semibold tracking-[0.14em] text-[#5E665F] uppercase">
        This run
      </p>
      {current ? (
        <>
          <p className="text-sm font-medium text-[#161A17]">{current.title}</p>
          <p className="mt-2 break-all font-mono text-[11px] leading-5 text-[#5E665F]">
            {current.href}
          </p>
          <p className="mt-5 pb-1 text-[11px] font-semibold tracking-[0.14em] text-[#5E665F] uppercase">
            {current.subject}
          </p>
          <ul className="space-y-0.5">
            {related.map((job) => {
              const active = job.href === pathname;
              return (
                <li key={job.id}>
                  <Link
                    href={job.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-7 items-center justify-between gap-2 rounded-md px-2 text-[13px] ${
                      active
                        ? "bg-[#0F766E]/10 text-[#0F766E]"
                        : "text-[#161A17] hover:bg-[#E7E0D4]"
                    }`}
                  >
                    <span className="truncate font-mono text-[12px]">{job.label}</span>
                    <span className="shrink-0 font-mono text-[10px] text-[#5E665F]">
                      {job.id.slice(0, 8)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="text-[13px] leading-relaxed text-[#5E665F]">
          Pick a run on the left. The folder name is the account and platform.
          The id is only which scrape that was.
        </p>
      )}
      <p className="mt-6 text-[12px] leading-relaxed text-[#5E665F]">
        Accounts live at /jobs/name-platform/run. Conferences live at
        /jobs/conferences/event/run. Another scrape keeps the folder and gets a
        new id.
      </p>
    </div>
  );
}

export default function AppShell({
  jobs,
  children,
}: {
  jobs: JobIndexEntry[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [left, setLeft] = useSidebarOpen(LEFT_KEY);
  const [right, setRight] = useSidebarOpen(RIGHT_KEY);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "b")
        return;
      if (event.shiftKey) return;
      event.preventDefault();
      if (event.altKey) setRight((open) => !open);
      else setLeft((open) => !open);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setLeft, setRight]);

  if (pathname === "/") {
    return <div className="min-h-dvh">{children}</div>;
  }

  const onJobRoute = pathname.startsWith("/jobs/");
  const jobSection = onJobRoute ? sectionFromPathname(pathname) : "map";
  const jobBase = onJobRoute
    ? pathname.replace(/\/(analytics|chat|profile)$/, "") || pathname
    : null;

  return (
    <SidebarSlotProvider>
      <div className="flex min-h-dvh flex-col">
        <header className="app-chrome sticky top-0 z-50 flex h-9 shrink-0 items-center justify-between border-b border-[#D5CDBF] bg-[#F3EEE4] px-2 text-[#161A17]">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-1.5 rounded-md py-0.5 pl-0.5 pr-1.5 text-[#5E665F] transition hover:bg-[#E7E0D4] hover:text-[#161A17]"
          >
            <BrandMark className="h-[26px] w-[26px] shrink-0" />
            <span className="truncate text-[13px] font-medium">Starling</span>
          </Link>
          {jobSection !== "chat" ? (
            <div className="flex items-center gap-0.5">
              <PanelButton
                side="left"
                pressed={left}
                onClick={() => setLeft((open) => !open)}
              />
              <PanelButton
                side="right"
                pressed={right}
                onClick={() => setRight((open) => !open)}
              />
            </div>
          ) : null}
        </header>
        <div className="flex min-h-[calc(100dvh-2.25rem)] flex-1">
          {jobSection !== "chat" && (left || right) ? (
            <button
              type="button"
              aria-label="Close side bars"
              className="fixed inset-x-0 bottom-0 top-9 z-30 bg-black/50 md:hidden"
              onClick={() => {
                setLeft(false);
                setRight(false);
              }}
            />
          ) : null}
          {left && jobSection !== "chat" ? (
            <aside aria-label="Primary Side Bar" className={sidebarClass("left")}>
              <SidebarSection title="Project" icon={FolderOpen}>
                <SidebarItem
                  href="/search"
                  active={pathname === "/search"}
                  icon={Search}
                >
                  New search
                </SidebarItem>
                <SidebarItem
                  href={jobBase ?? "/"}
                  active={jobBase != null && jobSection === "map"}
                  icon={Waypoints}
                  trailing={
                    <Settings className="h-3.5 w-3.5 text-[#5E665F]" strokeWidth={1.75} />
                  }
                >
                  Graph
                </SidebarItem>
                {jobBase ? (
                  <>
                    <SidebarItem
                      href={pathWithSection(jobBase, "analytics")}
                      active={jobSection === "analytics"}
                      icon={BarChart3}
                    >
                      Analytics
                    </SidebarItem>
                    <SidebarItem
                      href={pathWithSection(jobBase, "chat")}
                      active={false}
                      icon={MessageCircle}
                    >
                      Chat
                    </SidebarItem>
                    <SidebarItem
                      href={pathWithSection(jobBase, "profile")}
                      active={jobSection === "profile"}
                      icon={User}
                      badge={{ text: "Soon" }}
                    >
                      Profile
                    </SidebarItem>
                  </>
                ) : null}
              </SidebarSection>

              <SidebarSlot side="left" />

              <SidebarSection title="Recents" icon={Clock} defaultOpen={false}>
                <RecentJobs jobs={jobs} pathname={pathname} />
              </SidebarSection>

              <SidebarSection title="Networks" icon={Network} defaultOpen={false}>
                <JobExplorer jobs={jobs} pathname={pathname} />
              </SidebarSection>
            </aside>
          ) : null}
          <div className="min-w-0 flex-1">{children}</div>
          {right && jobSection !== "chat" ? (
            <aside aria-label="Secondary Side Bar" className={sidebarClass("right")}>
              <SidebarSlot side="right" />
              <RunInspector jobs={jobs} pathname={pathname} />
            </aside>
          ) : null}
        </div>
      </div>
    </SidebarSlotProvider>
  );
}
