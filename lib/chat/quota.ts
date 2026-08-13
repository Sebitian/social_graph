import { createHash, randomBytes } from "crypto";
import { kv } from "@vercel/kv";
import { kvConfigured } from "@/lib/cache";

const COOKIE = "netgraph_chat";
const DAY_SECONDS = 60 * 60 * 24;
const VISITOR_COOKIE_MAX_AGE = DAY_SECONDS * 30;

function readNumber(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** 5 is enough to try suggested prompts + a follow-up without becoming a free LLM. */
export function chatVisitorLimit(): number {
  return readNumber(process.env.CHAT_MESSAGES_PER_VISITOR, 5);
}

/** Shared NAT (office/cafe Wi-Fi) can have several visitors; keep this above the per-person cap. */
export function chatIpLimit(): number {
  return readNumber(process.env.CHAT_MESSAGES_PER_IP, 20);
}

/** Hard kill switch so rotated cookies/IPs cannot drain the TokenRouter key. */
export function chatGlobalLimit(): number {
  return readNumber(process.env.CHAT_MESSAGES_GLOBAL_PER_DAY, 200);
}

export function chatCooldownSeconds(): number {
  return readNumber(process.env.CHAT_COOLDOWN_SECONDS, 8);
}

export function chatMaxHistory(): number {
  return readNumber(process.env.CHAT_MAX_HISTORY, 12);
}

export function chatQuotaEnabled(): boolean {
  if (process.env.CHAT_QUOTA === "0") return false;
  if (process.env.CHAT_QUOTA === "1") return true;
  return process.env.NODE_ENV !== "development";
}

export type ChatQuotaSnapshot = {
  enabled: boolean;
  remaining: number;
  limit: number;
  globalRemaining: number;
  retryAfterSeconds?: number;
  reason?: "visitor" | "ip" | "global" | "cooldown";
};

export type ChatQuotaDecision = ChatQuotaSnapshot & {
  ok: boolean;
  visitorId: string;
  setCookie?: string;
};

type Counter = { n: number; exp: number };

const memory = new Map<string, Counter>();

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=") || null;
  }
  return null;
}

function newVisitorId(): string {
  return randomBytes(16).toString("hex");
}

function visitorCookie(id: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${id}; Path=/; Max-Age=${VISITOR_COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly${secure}`;
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function ipHash(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

function identity(req: Request): { visitorId: string; setCookie?: string; ipKey: string } {
  const existing = parseCookie(req.headers.get("cookie"), COOKIE);
  const valid = existing && /^[a-f0-9]{32}$/i.test(existing);
  const visitorId = valid ? existing : newVisitorId();
  return {
    visitorId,
    setCookie: valid ? undefined : visitorCookie(visitorId),
    ipKey: ipHash(clientIp(req)),
  };
}

function memoryGet(key: string): number {
  const hit = memory.get(key);
  if (!hit) return 0;
  if (hit.exp < Date.now()) {
    memory.delete(key);
    return 0;
  }
  return hit.n;
}

function memoryIncr(key: string, ttlSeconds: number): number {
  const now = Date.now();
  const hit = memory.get(key);
  if (!hit || hit.exp < now) {
    memory.set(key, { n: 1, exp: now + ttlSeconds * 1000 });
    return 1;
  }
  hit.n += 1;
  return hit.n;
}

async function getCount(key: string): Promise<number> {
  if (kvConfigured()) {
    try {
      const value = await kv.get<number>(key);
      return typeof value === "number" ? value : 0;
    } catch {
      return 0;
    }
  }
  return memoryGet(key);
}

async function incrCount(key: string, ttlSeconds: number): Promise<number> {
  if (kvConfigured()) {
    try {
      const next = await kv.incr(key);
      if (next === 1) await kv.expire(key, ttlSeconds);
      return next;
    } catch {
      return memoryIncr(key, ttlSeconds);
    }
  }
  return memoryIncr(key, ttlSeconds);
}

async function cooldownActive(key: string): Promise<boolean> {
  if (kvConfigured()) {
    try {
      return Boolean(await kv.get(key));
    } catch {
      return memoryGet(key) > 0;
    }
  }
  return memoryGet(key) > 0;
}

async function setCooldown(key: string, ttlSeconds: number): Promise<void> {
  if (kvConfigured()) {
    try {
      await kv.set(key, 1, { ex: ttlSeconds });
      return;
    } catch {
      /* fall through */
    }
  }
  memory.set(key, { n: 1, exp: Date.now() + ttlSeconds * 1000 });
}

function keys(visitorId: string, ipKey: string) {
  const day = utcDay();
  return {
    visitor: `chat:q:v:${visitorId}:${day}`,
    ip: `chat:q:ip:${ipKey}:${day}`,
    global: `chat:q:g:${day}`,
    cool: `chat:q:cd:${visitorId}`,
  };
}

function snapshotFromCounts(args: {
  visitor: number;
  ip: number;
  global: number;
  cooldown?: boolean;
}): ChatQuotaSnapshot {
  const limit = chatVisitorLimit();
  const remaining = Math.max(0, limit - args.visitor);
  const globalRemaining = Math.max(0, chatGlobalLimit() - args.global);
  const ipRemaining = Math.max(0, chatIpLimit() - args.ip);
  let reason: ChatQuotaSnapshot["reason"];
  if (args.cooldown) reason = "cooldown";
  else if (remaining <= 0) reason = "visitor";
  else if (ipRemaining <= 0) reason = "ip";
  else if (globalRemaining <= 0) reason = "global";
  return {
    enabled: true,
    remaining: Math.min(remaining, ipRemaining, globalRemaining),
    limit,
    globalRemaining,
    reason,
    retryAfterSeconds:
      reason === "cooldown" ? chatCooldownSeconds() : undefined,
  };
}

export async function inspectChatQuota(req: Request): Promise<ChatQuotaDecision> {
  const { visitorId, setCookie, ipKey } = identity(req);
  if (!chatQuotaEnabled()) {
    const limit = chatVisitorLimit();
    return {
      ok: true,
      enabled: false,
      remaining: limit,
      limit,
      globalRemaining: chatGlobalLimit(),
      visitorId,
      setCookie,
    };
  }

  const k = keys(visitorId, ipKey);
  const [visitor, ip, global, cooling] = await Promise.all([
    getCount(k.visitor),
    getCount(k.ip),
    getCount(k.global),
    cooldownActive(k.cool),
  ]);
  const snap = snapshotFromCounts({ visitor, ip, global, cooldown: cooling });
  return {
    ...snap,
    ok: snap.remaining > 0 && !cooling,
    visitorId,
    setCookie,
  };
}

export async function consumeChatQuota(req: Request): Promise<ChatQuotaDecision> {
  const inspected = await inspectChatQuota(req);
  if (!inspected.enabled) return { ...inspected, ok: true };
  if (!inspected.ok) return inspected;

  const ipKey = ipHash(clientIp(req));
  const k = keys(inspected.visitorId, ipKey);
  const ttl = DAY_SECONDS * 2;
  const [visitor, ip, global] = await Promise.all([
    incrCount(k.visitor, ttl),
    incrCount(k.ip, ttl),
    incrCount(k.global, ttl),
  ]);
  const allowed =
    visitor <= chatVisitorLimit() &&
    ip <= chatIpLimit() &&
    global <= chatGlobalLimit();
  const snap = snapshotFromCounts({ visitor, ip, global });
  if (allowed) await setCooldown(k.cool, chatCooldownSeconds());
  return {
    ...snap,
    remaining: Math.max(0, snap.remaining),
    ok: allowed,
    visitorId: inspected.visitorId,
    setCookie: inspected.setCookie,
  };
}

export function quotaMessage(reason?: ChatQuotaSnapshot["reason"]): string {
  if (reason === "cooldown") {
    return `Wait a few seconds between demo questions.`;
  }
  if (reason === "global") {
    return "The shared demo chat is at today's cap. Graph and analytics stay open.";
  }
  return `That's the ${chatVisitorLimit()}-question demo limit for today. Graph and analytics stay open.`;
}
