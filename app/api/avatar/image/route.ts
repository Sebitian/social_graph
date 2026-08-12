import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Hosts we are willing to proxy for canvas/avatar rendering. */
const ALLOWED_HOST_SUFFIXES = [
  "media.licdn.com",
  "licdn.com",
  "fbcdn.net",
  "facebook.com",
  "cdninstagram.com",
  "instagram.com",
  "fna.fbcdn.net",
  "xx.fbcdn.net",
];

function hostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

function refererFor(hostname: string): string {
  const host = hostname.toLowerCase();
  if (host.includes("licdn") || host.includes("linkedin")) {
    return "https://www.linkedin.com/";
  }
  if (host.includes("fbcdn") || host.includes("facebook")) {
    return "https://www.facebook.com/";
  }
  if (host.includes("instagram")) {
    return "https://www.instagram.com/";
  }
  return "https://www.google.com/";
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (target.protocol !== "https:") {
    return NextResponse.json({ error: "Only https urls allowed" }, { status: 400 });
  }
  if (!hostAllowed(target.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
  }

  try {
    const imageRes = await fetch(target.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
        Referer: refererFor(target.hostname),
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      cache: "no-store",
      redirect: "follow",
    });

    if (!imageRes.ok || !imageRes.body) {
      return NextResponse.json(
        { error: "Upstream image failed" },
        { status: imageRes.status === 404 ? 404 : 502 },
      );
    }

    const contentType = imageRes.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Not an image" }, { status: 502 });
    }

    return new NextResponse(imageRes.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "Avatar proxy failed" }, { status: 502 });
  }
}
