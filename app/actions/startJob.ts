"use server";

import { redirect } from "next/navigation";
import { openOrCreateJob } from "@/lib/jobs";
import { RUN_PLATFORMS } from "@/lib/jobCatalog";

export type StartJobState = { error: string } | null;

export async function startJobForm(
  _prev: StartJobState,
  formData: FormData,
): Promise<StartJobState> {
  const handles: Partial<Record<string, string>> = {};
  for (const platform of RUN_PLATFORMS) {
    const value = formData.get(platform);
    if (typeof value === "string" && value.trim()) handles[platform] = value;
  }
  const result = await openOrCreateJob(handles);
  if ("error" in result) return { error: result.error };
  redirect(result.url);
}
