"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  type ComponentType,
  type SVGProps,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";

const ToggleSizeContext = createContext<"sm" | "md">("md");

type SidebarIcon = LucideIcon | ComponentType<SVGProps<SVGSVGElement> & { title?: string }>;

export function SidebarToggle({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; Icon?: SidebarIcon }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mx-1.5 mt-2 flex rounded-full border border-[#D5CDBF] bg-[#F3EEE4] p-0.5">
      {options.map(({ value: v, label, Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={active}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-medium transition ${
              active
                ? "bg-[#0F766E] text-[#FBF8F2]"
                : "text-[#5E665F] hover:text-[#161A17]"
            }`}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={1.75} /> : null}
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function SidebarSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  actions,
}: {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  defaultOpen?: boolean;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="px-1.5 py-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 w-full items-center justify-between gap-2 rounded-md px-2 text-[11px] font-semibold tracking-[0.14em] text-[#5E665F] uppercase transition hover:bg-[#E7E0D4]"
      >
        <span className="flex items-center gap-1.5">
          {Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={1.75} /> : null}
          {title}
        </span>
        <span className="flex items-center gap-1">
          {actions}
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
          )}
        </span>
      </button>
      {open ? (
        <div className="mt-1 space-y-0.5">
          <ToggleSizeContext.Provider value="sm">{children}</ToggleSizeContext.Provider>
        </div>
      ) : null}
    </div>
  );
}

export function SidebarGroup({ title }: { title: string }) {
  return (
    <p className="px-2 pb-1 pt-2 text-[12px] font-semibold text-[#161A17]">
      {title}
    </p>
  );
}

interface SidebarItemBaseProps {
  icon?: SidebarIcon;
  iconClassName?: string;
  iconStyle?: CSSProperties;
  trailing?: ReactNode;
  badge?: { text: string; tone?: "orange" | "purple" | "blue" };
  children: ReactNode;
}

function badgeClass(tone?: "orange" | "purple" | "blue") {
  if (tone === "orange") return "bg-orange-500/15 text-orange-300";
  if (tone === "purple") return "bg-purple-500/15 text-purple-300";
  if (tone === "blue") return "bg-blue-500/15 text-blue-300";
  return "bg-[#E7E0D4] text-[#5E665F]";
}

function ItemContent({
  icon: Icon,
  iconClassName,
  iconStyle,
  trailing,
  badge,
  children,
}: SidebarItemBaseProps) {
  const size = useContext(ToggleSizeContext);
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <>
      <span className="flex min-w-0 items-center gap-2">
        {Icon ? (
          <Icon
            className={`${iconClass} shrink-0 ${iconClassName ?? ""}`}
            style={iconStyle}
            strokeWidth={1.75}
          />
        ) : null}
        <span className="truncate">{children}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {badge ? (
          <span
            className={`rounded px-1.5 py-px text-[9px] font-semibold tracking-wide uppercase ${badgeClass(badge.tone)}`}
          >
            {badge.text}
          </span>
        ) : null}
        {trailing}
      </span>
    </>
  );
}

export function SidebarItem({
  href,
  active,
  ...rest
}: SidebarItemBaseProps & { href: string; active?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-8 items-center justify-between gap-2 rounded-md px-2 text-[13px] transition ${
        active
          ? "bg-[#0F766E]/10 text-[#0F766E]"
          : "text-[#161A17] hover:bg-[#E7E0D4]"
      }`}
    >
      <ItemContent {...rest} />
    </Link>
  );
}

export function SidebarButton({
  onClick,
  active,
  ...rest
}: SidebarItemBaseProps & { onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-8 w-full items-center justify-between gap-2 rounded-md px-2 text-[13px] transition ${
        active
          ? "bg-[#0F766E]/10 text-[#0F766E]"
          : "text-[#161A17] hover:bg-[#E7E0D4]"
      }`}
    >
      <ItemContent {...rest} />
    </button>
  );
}
