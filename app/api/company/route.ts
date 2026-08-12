import { NextRequest, NextResponse } from "next/server";
import { readCompanySnapshot } from "@/lib/snapshot";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Demo company snapshot — reads pinned export, no live Apify. */
export async function GET(req: NextRequest) {
  const handle =
    req.nextUrl.searchParams.get("handle")?.replace(/^@/, "").trim().toLowerCase() ??
    "formationbio";

  try {
    const result = await readCompanySnapshot(handle);
    if (!result) {
      return NextResponse.json(
        { error: `No company snapshot for "${handle}"` },
        { status: 404 },
      );
    }
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=3600" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Company snapshot failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
