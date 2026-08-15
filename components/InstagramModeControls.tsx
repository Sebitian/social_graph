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
const TAB_ACTIVE = "bg-white/15 text-white";
const TAB_AVAILABLE = "text-white/55 hover:bg-white/10 hover:text-white/80";
const TAB_DISABLED = "text-white/30 hover:bg-white/5 hover:text-white/45";

interface Props {
  mode: InstagramMode;
  onModeChange: (mode: InstagramMode) => void;
  people: ModePersonOption[];
  personId: string;
  onPersonIdChange: (id: string) => void;
  hasCompany: boolean;
  avatarPlatform?: AvatarPlatform;
  className?: string;
}

function PersonAvatar({
  person,
  platform,
  size = "sm",
}: {
  person?: ModePersonOption | null;
  platform?: AvatarPlatform;
  size?: "sm" | "md";
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
        className={`${dim} shrink-0 rounded-full object-cover ring-1 ring-white/15`}
      />
    );
  }

  return (
    <span
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white/80 ring-1 ring-white/15`}
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
  className = "",
}: Props) {
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

  return (
    <div
      ref={rootRef}
      className={`flex flex-wrap items-center gap-2 ${className}`}
    >
      <div className="inline-flex rounded-lg border border-white/10 bg-black/30 p-0.5">
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
              ? TAB_ACTIVE
              : hasCompany
                ? TAB_AVAILABLE
                : TAB_DISABLED
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
              mode === "person" ? TAB_ACTIVE : TAB_AVAILABLE
            }`}
          >
              <PersonAvatar person={selected} platform={avatarPlatform} />
            <span className="min-w-0 truncate">
              {selected?.fullName || "Person"}
            </span>
            <ChevronDown
              className={`h-3 w-3 shrink-0 text-white/45 transition ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
        ) : (
          <button
            type="button"
            title="Person snapshot not loaded yet"
            disabled
            className={`${TAB} ${TAB_DISABLED}`}
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
              className="fixed z-[80] min-w-[240px] overflow-hidden rounded-xl border border-white/10 bg-[#141414] py-1 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
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
                            ? "bg-white/10 text-white"
                            : "text-white/80 hover:bg-white/10"
                          : "cursor-not-allowed text-white/30"
                      }`}
                    >
                      <PersonAvatar
                        person={person}
                        platform={avatarPlatform}
                        size="md"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {person.fullName}
                        </span>
                        <span className="block truncate text-[10px] text-white/40">
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
