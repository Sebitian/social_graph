"use client";

import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  empty?: string | null;
}

export default function AnalyticsSection({
  title,
  subtitle,
  children,
  className = "",
  empty = null,
}: Props) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur ${className}`}
    >
      <div className="flex items-baseline justify-between gap-2 border-b border-white/8 px-4 py-3">
        <h3 className="text-sm font-semibold text-white/85">{title}</h3>
        {subtitle ? (
          <span className="text-[11px] text-white/35">{subtitle}</span>
        ) : null}
      </div>
      {empty ? (
        <p className="px-4 py-6 text-center text-xs text-white/40">{empty}</p>
      ) : (
        <div className="divide-y divide-white/8">{children}</div>
      )}
    </section>
  );
}

interface RowProps {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  selected?: boolean;
}

export function AnalyticsRow({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  selected = false,
}: RowProps) {
  const className = `flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left transition ${
    onClick ? "hover:bg-white/5 active:bg-white/8" : ""
  } ${selected ? "bg-white/10" : ""}`;

  const content = (
    <>
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-white/90">{title}</div>
        {subtitle ? (
          <div className="truncate text-[11px] text-white/40">{subtitle}</div>
        ) : null}
      </div>
      {trailing ? (
        <div className="shrink-0 text-xs text-white/50">{trailing}</div>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
