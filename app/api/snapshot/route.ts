import { NextRequest, NextResponse } from "next/server";
import type { ScrapeResult } from "@/lib/types";
import { pinnedGraphPath, snapshotStorageFor, writeSnapshot } from "@/lib/snapshot";

export const runtime = "nodejs";

function pinAuthorized(req: NextRequest): boolean {
  const secret = process.env.SNAPSHOT_PIN_SECRET;
  if (!secret) return process.env.NODE_ENV === "development";
  return req.headers.get("x-pin-secret") === secret;
}

export async function POST(req: NextRequest) {
  if (!pinAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as ScrapeResult;
    const handle = body.profile?.username ?? "";
    if (!handle) {
      return NextResponse.json(
        { error: "Missing body.profile.username" },
        { status: 400 },
      );
    }

    const saved = await writeSnapshot(handle, body);
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const storage = await snapshotStorageFor(saved);
    return NextResponse.json({
      ok: true,
      handle: saved,
      storage,
      url: `${site}${pinnedGraphPath(saved)}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save snapshot";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
