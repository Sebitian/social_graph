import { NextRequest, NextResponse } from "next/server";
import { getNetwork } from "@/lib/scrape";
import { readSnapshot } from "@/lib/snapshot";
import { parseScrapeBudgetParams } from "@/lib/scrapeBudget";

export const runtime = "nodejs";
// Apify actor runs can take a while; allow a generous budget on Vercel.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get("handle");
  const force = req.nextUrl.searchParams.get("force") === "1";
  const pinned = req.nextUrl.searchParams.get("pinned") === "1";
  const budget = parseScrapeBudgetParams(req.nextUrl.searchParams);

  if (!handle) {
    return NextResponse.json(
      { error: "Missing ?handle parameter" },
      { status: 400 },
    );
  }

  if (pinned) {
    const snapshot = await readSnapshot(handle);
    if (!snapshot) {
      return NextResponse.json(
        { error: `No pinned snapshot for @${handle.replace(/^@/, "")}` },
        { status: 404 },
      );
    }
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "public, s-maxage=86400, immutable" },
    });
  }

  try {
    const result = await getNetwork(handle, { force, budget });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=3600" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scrape failed";
    const status = message.includes("Invalid") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
