export const JOB_VIEWS = ["map", "analytics", "chat", "profile"] as const;

export type JobView = (typeof JOB_VIEWS)[number];

const EXTRA_VIEWS = ["analytics", "chat", "profile"] as const;

export function isExtraJobView(value: string): value is Exclude<JobView, "map"> {
  return (EXTRA_VIEWS as readonly string[]).includes(value);
}

/** Map is the run URL. Analytics, chat, and profile are the next path segment. */
export function sectionFromPathname(pathname: string): JobView {
  const last = pathname.split("/").filter(Boolean).pop() ?? "";
  if (isExtraJobView(last)) return last;
  return "map";
}

export function pathWithSection(pathname: string, section: JobView): string {
  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  const base = isExtraJobView(last)
    ? `/${parts.slice(0, -1).join("/")}`
    : pathname.replace(/\/$/, "") || "/";
  if (section === "map") return base;
  return `${base}/${section}`;
}
