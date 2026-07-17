import { NextResponse } from "next/server";

export const runtime = "nodejs";

const OG_CACHE = new Map<string, { url: string; cachedAt: number }>();
const OG_TTL_MS = 1000 * 60 * 60 * 12;

const BROWSER_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

function cleanHandle(raw: string): string {
  return decodeURIComponent(raw)
    .replace(/^@/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "");
}

function extractOgImage(html: string): string | null {
  const match =
    html.match(/property="og:image"\s+content="([^"]+)"/i) ??
    html.match(/content="([^"]+)"\s+property="og:image"/i) ??
    html.match(/og:image" content="([^"]+)"/i);
  if (!match?.[1]) return null;
  return match[1]
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#38;/g, "&");
}

async function resolveOgImage(handle: string): Promise<string | null> {
  const cached = OG_CACHE.get(handle);
  if (cached && Date.now() - cached.cachedAt < OG_TTL_MS) {
    return cached.url;
  }

  const res = await fetch(`https://www.instagram.com/${encodeURIComponent(handle)}/`, {
    headers: BROWSER_HEADERS,
    cache: "no-store",
  });

  if (!res.ok) return null;
  const html = await res.text();
  const url = extractOgImage(html);
  if (!url) return null;

  OG_CACHE.set(handle, { url, cachedAt: Date.now() });
  return url;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ handle: string }> },
) {
  const { handle: raw } = await context.params;
  const handle = cleanHandle(raw);
  if (!handle || handle.length < 2) {
    return NextResponse.json({ error: "Invalid handle" }, { status: 400 });
  }

  try {
    const ogUrl = await resolveOgImage(handle);
    if (!ogUrl) {
      return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    }

    const imageRes = await fetch(ogUrl, {
      headers: {
        "User-Agent": BROWSER_HEADERS["User-Agent"] as string,
        Referer: "https://www.instagram.com/",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      cache: "no-store",
    });

    if (!imageRes.ok || !imageRes.body) {
      return NextResponse.json({ error: "Upstream image failed" }, { status: 502 });
    }

    const contentType = imageRes.headers.get("content-type") ?? "image/jpeg";
    return new NextResponse(imageRes.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "Avatar lookup failed" }, { status: 502 });
  }
}
