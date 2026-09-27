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
      className={`overflow-hidden rounded-2xl border border-[#D5CDBF] bg-[#FBF8F2] ${className}`}
    >
      <div className="flex items-baseline justify-between gap-2 border-b border-[#D5CDBF] px-4 py-3">
        <h3 className="text-sm font-semibold text-[#161A17]">{title}</h3>
        {subtitle ? (
          <span className="text-[11px] text-[#5E665F]/80">{subtitle}</span>
        ) : null}
      </div>
      {empty ? (
        <p className="px-4 py-6 text-center text-xs text-[#5E665F]">{empty}</p>
      ) : (
        <div className="divide-y divide-[#E7E0D4]">{children}</div>
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
    onClick ? "hover:bg-[#F3EEE4] active:bg-[#E7E0D4]" : ""
  } ${selected ? "bg-[#E7E0D4]" : ""}`;

  const content = (
    <>
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[#161A17]">{title}</div>
        {subtitle ? (
          <div className="truncate text-[11px] text-[#5E665F]">{subtitle}</div>
        ) : null}
      </div>
      {trailing ? (
        <div className="shrink-0 text-xs text-[#5E665F]">{trailing}</div>
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
