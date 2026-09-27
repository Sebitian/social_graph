import { notFound, redirect } from "next/navigation";
import { catalogJobById } from "@/lib/jobCatalog";
import type { JobView } from "@/lib/jobSections";
import { canonicalJobPath } from "@/lib/jobs";

function targetFor(canonical: string, view: JobView): string {
  return view === "map" ? canonical : `${canonical}/${view}`;
}

/** Canonicalize an account run URL. Map has no extra segment. */
export async function settleAccountJob(
  label: string,
  id: string,
  view: JobView,
) {
  const canonical = await canonicalJobPath(id);
  if (!canonical) notFound();
  if (view !== "map" && catalogJobById(id)?.kind === "aiman") redirect(canonical);
  const target = targetFor(canonical, view);
  const requested =
    view === "map" ? `/jobs/${label}/${id}` : `/jobs/${label}/${id}/${view}`;
  if (requested !== target) redirect(target);
}

/** Canonicalize a conference run URL. Map has no extra segment. */
export async function settleConferenceJob(
  name: string,
  run: string,
  view: JobView,
) {
  const canonical = await canonicalJobPath(run);
  if (!canonical) notFound();
  const target = targetFor(canonical, view);
  const requested =
    view === "map"
      ? `/jobs/conferences/${name}/${run}`
      : `/jobs/conferences/${name}/${run}/${view}`;
  if (requested !== target) redirect(target);
}
