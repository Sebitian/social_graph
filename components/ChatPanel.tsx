"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CompanyIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
} from "@/components/PlatformIcons";
import type { ChatSourceId, ChatSourceInfo } from "@/lib/chat/types";
import type { ScrapeBudget } from "@/lib/scrapeBudget";

const SOURCE_ICON: Record<
  ChatSourceId,
  typeof LinkedInIcon
> = {
  linkedin: LinkedInIcon,
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  company: CompanyIcon,
};

function suggestions(sources: ChatSourceInfo[]): string[] {
  const ids = new Set(sources.map((source) => source.id));
  const prompts: string[] = [];
  if (ids.has("linkedin") || ids.has("instagram") || ids.has("facebook")) {
    prompts.push("Who is my top engager?");
    prompts.push("What was my last post?");
  }
  if (ids.has("company")) {
    const company = sources.find((source) => source.id === "company");
    prompts.push(
      company
        ? `Who is the ${company.title} CEO?`
        : "Who is the company CEO?",
    );
  }
  return prompts.slice(0, 4);
}

function MessageBody({
  text,
  onSelectUsername,
}: {
  text: string;
  onSelectUsername?: (username: string) => void;
}) {
  const chunks = text.split(/(@[A-Za-z0-9._]+)/g);
  return (
    <span className="whitespace-pre-wrap break-words">
      {chunks.map((chunk, index) => {
        if (chunk.startsWith("@") && chunk.length > 1 && onSelectUsername) {
          const username = chunk.slice(1);
          return (
            <button
              key={`${chunk}-${index}`}
              type="button"
              className="font-medium text-white underline decoration-white/30 underline-offset-2 hover:decoration-white"
              onClick={() => onSelectUsername(username)}
            >
              {chunk}
            </button>
          );
        }
        return <span key={`${chunk}-${index}`}>{chunk}</span>;
      })}
    </span>
  );
}

interface Props {
  handle: string;
  pinned: boolean;
  sources: ChatSourceInfo[];
  budget: ScrapeBudget;
  onSelectUsername?: (username: string) => void;
}

type QuotaState = {
  remaining: number;
  limit: number;
  enabled: boolean;
};

export default function ChatPanel({
  handle,
  pinned,
  sources,
  budget,
  onSelectUsername,
}: Props) {
  const [input, setInput] = useState("");
  const [quota, setQuota] = useState<QuotaState | null>(null);

  const applyQuotaHeaders = (response: Response) => {
    const remaining = response.headers.get("x-chat-remaining");
    const limit = response.headers.get("x-chat-limit");
    if (remaining == null || limit == null) return;
    setQuota((prev) => ({
      remaining: Number(remaining),
      limit: Number(limit),
      enabled: prev?.enabled ?? true,
    }));
  };

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/chat")
      .then(async (response) => {
        const json = (await response.json()) as {
          remaining?: number;
          limit?: number;
          enabled?: boolean;
        };
        if (cancelled) return;
        if (typeof json.remaining === "number" && typeof json.limit === "number") {
          setQuota({
            remaining: json.remaining,
            limit: json.limit,
            enabled: Boolean(json.enabled),
          });
        }
      })
      .catch(() => {
        /* quota badge is optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: async (input, init) => {
          const response = await fetch(input, init);
          applyQuotaHeaders(response);
          if (response.status === 429) {
            const json = (await response
              .clone()
              .json()
              .catch(() => null)) as { error?: string } | null;
            throw new Error(
              json?.error || "Demo chat limit reached for today.",
            );
          }
          return response;
        },
        body: () => ({
          handle,
          pinned,
          budget: {
            postLimit: budget.postLimit,
            commentsPerPost: budget.commentsPerPost,
            reciprocityEnabled: budget.reciprocityEnabled,
            reciprocityFriends: budget.reciprocityFriends,
            reciprocityPostsPerFriend: budget.reciprocityPostsPerFriend,
          },
        }),
      }),
    [budget, handle, pinned],
  );

  const { messages, sendMessage, status, error, clearError } = useChat({
    id: handle,
    transport,
  });

  const busy = status === "submitted" || status === "streaming";
  const prompts = suggestions(sources);
  const canChat = sources.length > 0;
  const quotaBlocked =
    quota?.enabled === true && quota.remaining <= 0;
  const canSend = canChat && !quotaBlocked;

  const submit = (text: string) => {
    const next = text.trim();
    if (!next || busy || !canSend) return;
    clearError();
    void sendMessage({ text: next });
    setInput("");
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(input);
  };

  return (
    <div className="flex min-h-[70dvh] flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white/85">
          <MessageCircle className="h-4 w-4" /> Chat
        </div>
        <p className="mt-1 text-xs text-white/40">
          Frozen snapshots — not live scraping.
          {quota?.enabled
            ? ` ${quota.remaining} of ${quota.limit} demo questions left today.`
            : null}
        </p>
        {sources.length > 0 ? (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {sources.map((source) => {
              const Icon = SOURCE_ICON[source.id];
              return (
                <li
                  key={source.id}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/12 bg-black/30 px-2.5 py-1 text-[11px] text-white/75"
                >
                  <Icon className="h-3 w-3 shrink-0 text-white/70" />
                  <span className="truncate">
                    <span className="font-medium text-white/90">
                      {source.label}
                    </span>
                    <span className="text-white/45"> · {source.title}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-white/45">
            No Chat snapshots are loaded on this page.
          </p>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && canSend && (
          <div className="flex flex-wrap gap-2">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => submit(prompt)}
                className="rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-left text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {messages.map((message) => {
          const text = message.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("");
          if (!text && message.role === "assistant") {
            return null;
          }
          return (
            <div
              key={message.id}
              className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                message.role === "user"
                  ? "ml-auto bg-white/15 text-white"
                  : "bg-black/30 text-white/80"
              }`}
            >
              {message.role === "user" ? (
                <span className="whitespace-pre-wrap break-words">{text}</span>
              ) : (
                <MessageBody text={text} onSelectUsername={onSelectUsername} />
              )}
            </div>
          );
        })}

        {quotaBlocked && quota ? (
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/55">
            That&apos;s the {quota.limit}-question demo limit for today. The
            graph and analytics stay open.
          </div>
        ) : null}

        {busy && (
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Looking up loaded snapshots…
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error.message || "Chat request failed."}
          </div>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="flex items-end gap-2 border-t border-white/10 p-3"
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit(input);
            }
          }}
          rows={2}
          disabled={busy || !canSend}
          placeholder={
            quotaBlocked
              ? "Demo question limit reached for today"
              : canChat
                ? "Ask about engagers, posts, or the company roster…"
                : "No snapshots loaded for Chat"
          }
          className="min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/25 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !canSend || !input.trim()}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-35"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
