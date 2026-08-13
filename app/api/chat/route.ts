import {
  convertToModelMessages,
  isStepCount,
  streamText,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import { loadChatContext, parseEnabledSourceIds, restrictChatBundle } from "@/lib/chat/loadContext";
import {
  getTokenRouterChatModel,
  tokenRouterConfigured,
} from "@/lib/chat/provider";
import { chatSystemPrompt, createChatTools } from "@/lib/chat/tools";
import {
  CHAT_MAX_MESSAGE_CHARS,
  chatMaxHistory,
  chatQuotaEnabled,
  consumeChatQuota,
  inspectChatQuota,
  quotaMessage,
  validateChatInput,
} from "@/lib/chat/quota";
import type { ScrapeBudget } from "@/lib/scrapeBudget";

export const runtime = "nodejs";
export const maxDuration = 60;

function withQuotaHeaders(
  response: Response,
  quota: {
    remaining: number;
    limit: number;
    setCookie?: string;
  },
): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Chat-Remaining", String(quota.remaining));
  headers.set("X-Chat-Limit", String(quota.limit));
  if (quota.setCookie) headers.append("Set-Cookie", quota.setCookie);
  return new Response(response.body, { status: response.status, headers });
}

function quotaJson(
  quota: Awaited<ReturnType<typeof inspectChatQuota>>,
  extra?: Record<string, unknown>,
  status = extra?.error ? 429 : 200,
) {
  const response = NextResponse.json(
    {
      remaining: quota.remaining,
      limit: quota.limit,
      globalRemaining: quota.globalRemaining,
      enabled: quota.enabled,
      cooldownSeconds: quota.cooldownSeconds,
      configured: tokenRouterConfigured(),
      ...extra,
    },
    { status },
  );
  return withQuotaHeaders(response, quota);
}

export async function GET(req: Request) {
  const quota = await inspectChatQuota(req);
  return quotaJson(quota);
}

export async function POST(req: Request) {
  if (!tokenRouterConfigured()) {
    return NextResponse.json(
      {
        error:
          "Chat is not configured. Add TOKENROUTER_API_KEY to .env.local.",
      },
      { status: 503 },
    );
  }

  const model = getTokenRouterChatModel();
  if (!model) {
    return NextResponse.json(
      { error: "Chat is not configured." },
      { status: 503 },
    );
  }

  let body: {
    messages?: UIMessage[];
    handle?: string;
    pinned?: boolean;
    budget?: Partial<ScrapeBudget>;
    enabledSources?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const handle = typeof body.handle === "string" ? body.handle : "";
  const loaded = await loadChatContext({
    handle,
    pinned: Boolean(body.pinned),
    budget: body.budget,
  });
  if (!loaded.ok) {
    return NextResponse.json(
      { error: loaded.error },
      { status: loaded.status },
    );
  }

  const enabled = parseEnabledSourceIds(
    body.enabledSources,
    loaded.bundle.sources,
  );
  const bundle = restrictChatBundle(loaded.bundle, enabled);

  const history = Array.isArray(body.messages) ? body.messages : [];
  const spam = validateChatInput(history, {
    enforceLimit: chatQuotaEnabled(),
  });
  if (spam) {
    const quota = await inspectChatQuota(req);
    return quotaJson(
      quota,
      {
        error: spam.error,
        retryAfterSeconds: quota.retryAfterSeconds,
      },
      spam.status,
    );
  }

  const quota = await consumeChatQuota(req);
  if (!quota.ok) {
    return quotaJson(quota, {
      error: quotaMessage(quota.reason),
      retryAfterSeconds: quota.retryAfterSeconds,
    });
  }

  const messages = history.slice(-chatMaxHistory()).map((message) => {
    if (!message || typeof message !== "object") return message;
    const parts = Array.isArray(message.parts)
      ? message.parts.map((part) => {
          if (part && part.type === "text" && typeof part.text === "string") {
            return { ...part, text: part.text.slice(0, CHAT_MAX_MESSAGE_CHARS) };
          }
          return part;
        })
      : message.parts;
    return { ...message, parts };
  });

  const result = streamText({
    model,
    system: chatSystemPrompt(bundle),
    messages: await convertToModelMessages(messages),
    tools: createChatTools(bundle),
    stopWhen: isStepCount(8),
  });

  return withQuotaHeaders(result.toUIMessageStreamResponse(), {
    remaining: quota.remaining,
    limit: quota.limit,
    setCookie: quota.setCookie,
  });
}
