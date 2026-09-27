"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, User } from "lucide-react";
import { CompanyIcon } from "@/components/PlatformIcons";
import { resolveProfilePicUrl } from "@/lib/avatarUrl";
import type { AvatarPlatform } from "@/lib/avatarUrl";
import type { InstagramMode, InstagramPeopleResult } from "@/lib/instagramPeople";
import type { ScrapeResult } from "@/lib/types";

export interface ModePersonOption {
  id: string;
  username: string;
  fullName: string;
  profilePicUrl?: string;
  available: boolean;
  unavailableReason?: string;
}

export function peopleFromInstagramBundle(
  data: InstagramPeopleResult | null | undefined,
): ModePersonOption[] {
  return (data?.people ?? []).map((person) => ({
    id: person.id,
    username: person.username,
    fullName: person.fullName,
    profilePicUrl: person.profilePicUrl,
    available: person.available,
    unavailableReason: person.unavailableReason,
  }));
}

export function peopleFromSocialResult(
  data: ScrapeResult | null | undefined,
): ModePersonOption[] {
  if (!data) return [];
  const username = data.profile.username;
  return [
    {
      id: username,
      username,
      fullName: data.profile.fullName || username,
      profilePicUrl: data.profile.profilePicUrl,
      available: true,
    },
  ];
}

const TAB =
  "inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium transition";

const INK = {
  active: "bg-white/15 text-white",
  available: "text-white/55 hover:bg-white/10 hover:text-white/80",
  disabled: "text-white/30 hover:bg-white/5 hover:text-white/45",
  shell: "inline-flex rounded-lg border border-white/10 bg-black/30 p-0.5",
  menu: "fixed z-[80] min-w-[240px] overflow-hidden rounded-xl border border-white/10 bg-[#141414] py-1 shadow-[0_12px_40px_rgba(0,0,0,0.45)]",
  chevron: "text-white/45",
  ring: "ring-white/15",
  fallback: "bg-white/10 text-white/80 ring-white/15",
  itemOn: "bg-white/10 text-white",
  itemIdle: "text-white/80 hover:bg-white/10",
  itemOff: "cursor-not-allowed text-white/30",
  meta: "text-white/40",
};

const PAPER = {
  active:
    "bg-[#FBF8F2] text-[#161A17] shadow-[0_1px_2px_rgba(22,26,23,0.06)]",
  available: "text-[#5E665F] hover:bg-[#E7E0D4] hover:text-[#161A17]",
  disabled: "text-[#5E665F]/50 hover:bg-[#E7E0D4]/70",
  shell: "inline-flex rounded-lg border border-[#D5CDBF] bg-[#F3EEE4] p-0.5",
  menu: "fixed z-[80] min-w-[240px] overflow-hidden rounded-xl border border-[#D5CDBF] bg-[#FBF8F2] py-1 text-[#161A17] shadow-[0_12px_40px_rgba(22,26,23,0.12)]",
  chevron: "text-[#5E665F]",
  ring: "ring-[#161A17]/10",
  fallback: "bg-[#E7E0D4] text-[#161A17] ring-[#161A17]/10",
  itemOn: "bg-[#EFE8DC] text-[#161A17]",
  itemIdle: "text-[#161A17] hover:bg-[#F3EEE4]",
  itemOff: "cursor-not-allowed text-[#5E665F]/50",
  meta: "text-[#5E665F]",
};

const GLASS = {
  active: "bg-[#0F766E]/10 text-[#0F766E]",
  available: "text-[#5E665F] hover:bg-[#E7E0D4] hover:text-[#161A17]",
  disabled: "text-[#5E665F]/50 hover:bg-[#E7E0D4]",
  shell:
    "inline-flex rounded-2xl border border-[#D5CDBF] bg-[#FBF8F2] p-1 shadow-[0_8px_32px_rgba(22,26,23,0.08)]",
  menu: "fixed z-[80] min-w-[240px] overflow-hidden rounded-2xl border border-[#D5CDBF] bg-[#FBF8F2] py-1 text-[#161A17] shadow-[0_12px_40px_rgba(22,26,23,0.12)]",
  chevron: "text-[#5E665F]",
  ring: "ring-[#161A17]/10",
  fallback: "bg-[#E7E0D4] text-[#161A17] ring-[#161A17]/10",
  itemOn: "bg-[#0F766E]/10 text-[#0F766E]",
  itemIdle: "text-[#161A17] hover:bg-[#F3EEE4]",
  itemOff: "cursor-not-allowed text-[#5E665F]/50",
  meta: "text-[#5E665F]",
};

interface Props {
  mode: InstagramMode;
  onModeChange: (mode: InstagramMode) => void;
  people: ModePersonOption[];
  personId: string;
  onPersonIdChange: (id: string) => void;
  hasCompany: boolean;
  avatarPlatform?: AvatarPlatform;
  /** Paper matches the landing page. Glass floats on the map in the same palette. Ink stays on dark surfaces. */
  tone?: "ink" | "paper" | "glass";
  className?: string;
}

function PersonAvatar({
  person,
  platform,
  size = "sm",
  tone,
}: {
  person?: ModePersonOption | null;
  platform?: AvatarPlatform;
  size?: "sm" | "md";
  tone: typeof INK;
}) {
  const [failed, setFailed] = useState(false);
  const dim = size === "md" ? "h-7 w-7" : "h-5 w-5";
  const src = person
    ? resolveProfilePicUrl(person.username, person.profilePicUrl, platform)
    : undefined;
  const initial = (person?.fullName || person?.username || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        className={`${dim} shrink-0 rounded-full object-cover ring-1 ${tone.ring}`}
      />
    );
  }

  return (
    <span
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-1 ${tone.fallback}`}
    >
      {person ? initial : <User className="h-3 w-3" />}
    </span>
  );
}

export default function InstagramModeControls({
  mode,
  onModeChange,
  people,
  personId,
  onPersonIdChange,
  hasCompany,
  avatarPlatform = "instagram",
  tone = "ink",
  className = "",
}: Props) {
  const paint = tone === "paper" ? PAPER : tone === "glass" ? GLASS : INK;
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const hasPeople = people.length > 0;
  const selected = people.find((person) => person.id === personId) ?? people[0];

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPos({ top: rect.bottom + 4, left: rect.left });
    };
    place();
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", place);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!hasCompany && !hasPeople) return null;

  if (tone === "glass") {
    const companyOpen = mode === "company";
    const accountOpen = mode === "person";
    const glassButton = (expanded: boolean, enabled: boolean) =>
      `inline-flex h-10 shrink-0 items-center justify-center overflow-hidden rounded-full border text-[13px] font-medium text-[#161A17] shadow-[0_8px_24px_rgba(22,26,23,0.08)] transition-all duration-200 ${
        expanded
          ? "gap-2 border-[#0F766E]/35 bg-[#FBF8F2] px-3.5"
          : "w-10 border-[#D5CDBF] bg-[#FBF8F2] px-0"
      } ${enabled ? "hover:bg-[#E7E0D4]" : "cursor-not-allowed opacity-45"}`;
    const glassLabel = (expanded: boolean) =>
      `overflow-hidden whitespace-nowrap transition-all duration-200 ${
        expanded ? "max-w-[7.5rem] opacity-100" : "max-w-0 opacity-0"
      }`;

    return (
      <div ref={rootRef} className={`flex items-center gap-2 ${className}`}>
        <button
          type="button"
          aria-pressed={companyOpen}
          aria-label="Company"
          title={hasCompany ? "Company" : "Company snapshot not loaded yet"}
          onClick={() => {
            if (!hasCompany) return;
            setOpen(false);
            onModeChange("company");
          }}
          className={glassButton(companyOpen, hasCompany)}
        >
          <CompanyIcon className="h-4 w-4 shrink-0" />
          <span className={glassLabel(companyOpen)}>Company</span>
        </button>

        {hasPeople ? (
          <button
            ref={buttonRef}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-pressed={accountOpen}
            aria-label="Account"
            title="Account"
            onClick={() => {
              if (!accountOpen) {
                onModeChange("person");
                return;
              }
              if (people.length > 1) setOpen((prev) => !prev);
            }}
            className={glassButton(accountOpen, true)}
          >
            <PersonAvatar person={selected} platform={avatarPlatform} tone={paint} />
            <span className={glassLabel(accountOpen)}>Account</span>
            {people.length > 1 && accountOpen ? (
              <ChevronDown
                className={`h-3 w-3 shrink-0 transition ${paint.chevron} ${
                  open ? "rotate-180" : ""
                }`}
              />
            ) : null}
          </button>
        ) : (
          <button
            type="button"
            title="Account snapshot not loaded yet"
            aria-label="Account"
            disabled
            className={glassButton(false, false)}
          >
            <User className="h-4 w-4 shrink-0" />
          </button>
        )}

        {open && hasPeople && typeof document !== "undefined"
          ? createPortal(
              <ul
                ref={menuRef}
                role="listbox"
                style={{ top: menuPos.top, left: menuPos.left }}
                className={paint.menu}
              >
                {people.map((person) => {
                  const active = person.id === personId && mode === "person";
                  return (
                    <li key={person.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        disabled={!person.available}
                        title={
                          person.available
                            ? `@${person.username}`
                            : person.unavailableReason
                        }
                        onClick={() => {
                          if (!person.available) return;
                          onPersonIdChange(person.id);
                          onModeChange("person");
                          setOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-xs transition ${
                          person.available
                            ? active
                              ? paint.itemOn
                              : paint.itemIdle
                            : paint.itemOff
                        }`}
                      >
                        <PersonAvatar
                          person={person}
                          platform={avatarPlatform}
                          size="md"
                          tone={paint}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {person.fullName}
                          </span>
                          <span className={`block truncate text-[10px] ${paint.meta}`}>
                            {person.available ? `@${person.username}` : "No data"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>,
              document.body,
            )
          : null}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`flex flex-wrap items-center gap-2 ${className}`}
    >
      <div className={paint.shell}>
        <button
          type="button"
          title={hasCompany ? "Company" : "Company snapshot not loaded yet"}
          onClick={() => {
            if (!hasCompany) return;
            setOpen(false);
            onModeChange("company");
          }}
          className={`${TAB} ${
            mode === "company"
              ? paint.active
              : hasCompany
                ? paint.available
                : paint.disabled
          }`}
        >
          <CompanyIcon className="h-3.5 w-3.5 shrink-0" />
          Company
        </button>

        {hasPeople ? (
          <button
            ref={buttonRef}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            title="Person"
            onClick={() => {
              onModeChange("person");
              setOpen((prev) => !prev);
            }}
            className={`${TAB} max-w-[220px] ${
              mode === "person" ? paint.active : paint.available
            }`}
          >
              <PersonAvatar person={selected} platform={avatarPlatform} tone={paint} />
            <span className="min-w-0 truncate">
              {selected?.fullName || "Person"}
            </span>
            <ChevronDown
              className={`h-3 w-3 shrink-0 transition ${paint.chevron} ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
        ) : (
          <button
            type="button"
            title="Person snapshot not loaded yet"
            disabled
            className={`${TAB} ${paint.disabled}`}
          >
            <User className="h-3.5 w-3.5 shrink-0" />
            Person
          </button>
        )}
      </div>
      {open && hasPeople && typeof document !== "undefined"
        ? createPortal(
            <ul
              ref={menuRef}
              role="listbox"
              style={{ top: menuPos.top, left: menuPos.left }}
              className={paint.menu}
            >
              {people.map((person) => {
                const active = person.id === personId && mode === "person";
                return (
                  <li key={person.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={!person.available}
                      title={
                        person.available
                          ? `@${person.username}`
                          : person.unavailableReason
                      }
                      onClick={() => {
                        if (!person.available) return;
                        onPersonIdChange(person.id);
                        onModeChange("person");
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-xs transition ${
                        person.available
                          ? active
                            ? paint.itemOn
                            : paint.itemIdle
                          : paint.itemOff
                      }`}
                    >
                      <PersonAvatar
                        person={person}
                        platform={avatarPlatform}
                        size="md"
                        tone={paint}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {person.fullName}
                        </span>
                        <span className={`block truncate text-[10px] ${paint.meta}`}>
                          {person.available
                            ? `@${person.username}`
                            : "No data"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
