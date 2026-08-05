import { NextRequest, NextResponse } from "next/server";
import { getSpotifyTaste } from "@/lib/scrape";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get("handle");

  if (!handle) {
    return NextResponse.json(
      { error: "Missing ?handle parameter" },
      { status: 400 },
    );
  }

  try {
    const result = await getSpotifyTaste(handle);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=3600" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Spotify taste failed";
    const status = message.includes("Invalid") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
