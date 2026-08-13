"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, Check, Copy, Loader2, MessageCircle, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import ChatDataTable, {
  tableFromToolPart,
} from "@/components/chat/ChatDataTable";
import ChatMarkdown from "@/components/chat/ChatMarkdown";
import ChatTimeChart from "@/components/chat/ChatTimeChart";
import {
  CompanyIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  TikTokIcon,
} from "@/components/PlatformIcons";
import { chartFromToolPart } from "@/lib/chat/chart";
import { displayPartsFromMessage } from "@/lib/chat/display";
import type { ChatChart, ChatSourceId, ChatSourceInfo, ChatTable } from "@/lib/chat/types";
import type { ScrapeBudget } from "@/lib/scrapeBudget";

const SOURCE_ICON: Record<
  Exclude<ChatSourceId, "company">,
  typeof LinkedInIcon
> = {
  linkedin: LinkedInIcon,
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  tiktok: TikTokIcon,
};

const LINKEDIN_CLUSTER_IDS: ChatSourceId[] = ["linkedin", "company"];

function iconBtnClass(selected: boolean): string {
  return `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
    selected
      ? "border-white/20 bg-white/15 text-white"
      : "border-white/10 bg-transparent text-white/40 hover:border-white/20 hover:text-white/70"
  }`;
}

function suggestions(sources: ChatSourceInfo[]): string[] {
  const ids = new Set(sources.map((source) => source.id));
  const prompts: string[] = [];
  const viewNames = [
    ids.has("instagram") ? "Instagram" : null,
    ids.has("facebook") ? "Facebook" : null,
    ids.has("tiktok") ? "TikTok" : null,
  ].filter((name): name is string => Boolean(name));

  if (viewNames.length >= 2) {
    prompts.push(
      `Compare ${viewNames[0]} vs ${viewNames[1]} views this week`,
    );
  }
  if (ids.has("tiktok")) {
    prompts.push("Show TikTok plays over the past week");
  } else if (ids.has("instagram")) {
    prompts.push("Show Instagram plays over the past week");
  } else if (ids.has("facebook")) {
    prompts.push("Show Facebook views over the past week");
  }
  if (ids.has("instagram") || ids.has("facebook") || ids.has("linkedin")) {
    prompts.push("Top posts this month as a table");
  }
  if (ids.has("tiktok") && !prompts.includes("Top posts this month as a table")) {
    prompts.push("Top TikTok videos by plays");
  }
  if (ids.has("linkedin") || ids.has("instagram") || ids.has("facebook")) {
    prompts.push("Who is my top engager?");
  }
  if (ids.has("company")) {
    const company = sources.find((source) => source.id === "company");
    prompts.push(
      company
        ? `Who is the ${company.title} CEO?`
        : "Who is the company CEO?",
    );
  }
  if (
    (ids.has("linkedin") || ids.has("instagram") || ids.has("facebook")) &&
    prompts.length < 4
  ) {
    prompts.push("Show engagement over time");
  }
  return [...new Set(prompts)].slice(0, 4);
}

function isPresentTablePart(part: { type: string }): part is {
  type: "tool-present_table";
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
} {
  return part.type === "tool-present_table";
}

function isPresentChartPart(part: { type: string }): part is {
  type: "tool-present_chart";
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
} {
  return part.type === "tool-present_chart";
}

function chartToMarkdown(chart: ChatChart): string {
  const lines = [chart.title ? `**${chart.title}**` : "**Chart**"];
  for (const series of chart.series) {
    const tail = series.points
      .slice(-6)
      .map((p) => `${p.label}: ${p.v}`)
      .join(", ");
    lines.push(`${series.label} — ${tail}`);
  }
  if (chart.caption) lines.push(chart.caption);
  return lines.join("\n");
}

function tableToMarkdown(table: ChatTable): string {
  const header = `| ${table.columns.map((col) => col.label).join(" | ")} |`;
  const divider = `| ${table.columns.map(() => "---").join(" | ")} |`;
  const rows = table.rows.map((row) =>
    `| ${table.columns
      .map((col) => {
        const value = row[col.key];
        return value == null ? "" : String(value).replace(/\|/g, "\\|");
      })
      .join(" | ")} |`,
  );
  return [
    table.title ? `**${table.title}**` : null,
    header,
    divider,
    ...rows,
    table.caption || null,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatChatTranscript(
  messages: Array<{
    role: string;
    parts: Array<{ type: string; text?: string }>;
  }>,
): string {
  const blocks: string[] = [];
  for (const message of messages) {
    const chunks: string[] = [];
    const display = displayPartsFromMessage(
      message.parts.map((part) => {
        if (part.type === "text") return { type: "text", text: part.text };
        if (isPresentTablePart(part)) {
          return { type: "table", table: tableFromToolPart(part) };
        }
        if (isPresentChartPart(part)) {
          return { type: "chart", chart: chartFromToolPart(part) };
        }
        return { type: part.type };
      }),
    );
    for (const part of display) {
      if (part.type === "text") chunks.push(part.text);
      if (part.type === "table") chunks.push(tableToMarkdown(part.table));
      if (part.type === "chart") chunks.push(chartToMarkdown(part.chart));
    }
    const body = chunks.join("\n\n").trim();
    if (!body) continue;
    const who = message.role === "user" ? "You" : "Netgraph";
    blocks.push(`**${who}**\n${body}`);
  }
  return blocks.join("\n\n---\n\n");
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

function LinkedInSourceCluster({
  person,
  company,
  activeIds,
  busy,
  onToggleParent,
  onToggleChild,
}: {
  person?: ChatSourceInfo;
  company?: ChatSourceInfo;
  activeIds: ChatSourceId[];
  busy: boolean;
  onToggleParent: () => void;
  onToggleChild: (id: ChatSourceId) => void;
}) {
  const personOn = Boolean(person && activeIds.includes("linkedin"));
  const companyOn = Boolean(company && activeIds.includes("company"));
  const parentOn = personOn || companyOn;
  const lastCluster =
    parentOn &&
    activeIds.every((id) => id === "linkedin" || id === "company");
  const lastPerson = personOn && activeIds.length === 1;
  const lastCompany = companyOn && activeIds.length === 1;

  return (
    <div className="inline-flex shrink-0 items-center">
      <button
        type="button"
        aria-pressed={parentOn}
        aria-label="LinkedIn"
        disabled={busy}
        title={
          lastCluster
            ? "Keep at least one account selected"
            : parentOn
              ? "Remove LinkedIn"
              : "Add LinkedIn"
        }
        onClick={() => {
          if (!lastCluster) onToggleParent();
        }}
        className={iconBtnClass(parentOn)}
      >
        <LinkedInIcon className="h-3.5 w-3.5" />
      </button>
      {person ? (
        <>
          <span
            className={`h-px w-2.5 shrink-0 ${
              parentOn ? "bg-white/35" : "bg-white/15"
            }`}
            aria-hidden
          />
          <button
            type="button"
            aria-pressed={personOn}
            aria-label="Person"
            disabled={busy}
            title={
              lastPerson
                ? "Keep at least one account selected"
                : person.subtitle || person.title
            }
            onClick={() => {
              if (!lastPerson) onToggleChild("linkedin");
            }}
            className={iconBtnClass(personOn)}
          >
            <User className="h-3.5 w-3.5" />
          </button>
        </>
      ) : null}
      {company ? (
        <>
          <span
            className={`h-px w-2.5 shrink-0 ${
              parentOn ? "bg-white/35" : "bg-white/15"
            }`}
            aria-hidden
          />
          <button
            type="button"
            aria-pressed={companyOn}
            aria-label="Company"
            disabled={busy}
            title={
              lastCompany
                ? "Keep at least one account selected"
                : company.title
            }
            onClick={() => {
              if (!lastCompany) onToggleChild("company");
            }}
            className={iconBtnClass(companyOn)}
          >
            <CompanyIcon className="h-3.5 w-3.5" />
          </button>
        </>
      ) : null}
    </div>
  );
}

export default function ChatPanel({
  handle,
  pinned,
  sources,
  budget,
  onSelectUsername,
}: Props) {
  const [input, setInput] = useState("");
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [enabledIds, setEnabledIds] = useState<ChatSourceId[]>(() =>
    sources.map((source) => source.id),
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeIds = useMemo(() => {
    const availableIds = sources.map((source) => source.id);
    const resolved = enabledIds.filter((id) => availableIds.includes(id));
    return resolved.length > 0 ? resolved : availableIds;
  }, [enabledIds, sources]);
  const enabledSources = sources.filter((source) => activeIds.includes(source.id));

  const resizeInput = (node: HTMLTextAreaElement) => {
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  };

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

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

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
          enabledSources: activeIds,
          budget: {
            postLimit: budget.postLimit,
            commentsPerPost: budget.commentsPerPost,
            reciprocityEnabled: budget.reciprocityEnabled,
            reciprocityFriends: budget.reciprocityFriends,
            reciprocityPostsPerFriend: budget.reciprocityPostsPerFriend,
          },
        }),
      }),
    [activeIds, budget, handle, pinned],
  );

  const { messages, sendMessage, status, error, clearError } = useChat({
    id: handle,
    transport,
  });

  const busy = status === "submitted" || status === "streaming";
  const prompts = suggestions(enabledSources);
  const canChat = enabledSources.length > 0;
  const quotaBlocked =
    quota?.enabled === true && quota.remaining <= 0;
  const canSend = canChat && !quotaBlocked;

  const toggleSource = (id: ChatSourceId) => {
    setEnabledIds((prev) => {
      const available = sources.map((source) => source.id);
      const current = prev.filter((item) => available.includes(item));
      const base = current.length > 0 ? current : available;
      if (base.includes(id)) {
        if (base.length === 1) return base;
        return base.filter((item) => item !== id);
      }
      return [...base, id];
    });
  };

  const toggleLinkedInCluster = () => {
    setEnabledIds((prev) => {
      const available = sources.map((source) => source.id);
      const current = prev.filter((item) => available.includes(item));
      const base = current.length > 0 ? current : available;
      const clusterIds = LINKEDIN_CLUSTER_IDS.filter((id) =>
        available.includes(id),
      );
      if (clusterIds.length === 0) return base;
      const clusterOn = clusterIds.some((id) => base.includes(id));
      const others = base.filter((id) => !clusterIds.includes(id));
      if (clusterOn) {
        if (others.length === 0) return base;
        return others;
      }
      return [...base, ...clusterIds.filter((id) => !base.includes(id))];
    });
  };

  const linkedinPerson = sources.find((source) => source.id === "linkedin");
  const linkedinCompany = sources.find((source) => source.id === "company");
  const platformSources = sources.filter(
    (source) => source.id !== "linkedin" && source.id !== "company",
  );

  const submit = (text: string) => {
    const next = text.trim();
    if (!next || busy || !canSend) return;
    clearError();
    void sendMessage({ text: next });
    setInput("");
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(input);
  };

  const copyChat = async () => {
    const text = formatChatTranscript(messages);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be blocked */
    }
  };

  return (
    <div className="flex min-h-[70dvh] flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/85">
              <MessageCircle className="h-4 w-4" /> Chat
            </div>
            <p className="mt-1 text-xs text-white/40">
              Frozen snapshots — not live scraping.
              {quota?.enabled
                ? ` ${quota.remaining} of ${quota.limit} demo questions left today.`
                : null}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void copyChat()}
            disabled={messages.length === 0}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/12 bg-black/25 px-2.5 py-1 text-[11px] font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
            aria-label={copied ? "Copied chat" : "Copy chat"}
            title={copied ? "Copied" : "Copy entire chat"}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        {sources.length === 0 ? (
          <p className="mt-2 text-xs text-white/45">
            No Chat snapshots are loaded on this page.
          </p>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
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
          const display = displayPartsFromMessage(
            message.parts.map((part) => {
              if (part.type === "text") return { type: "text", text: part.text };
              if (isPresentTablePart(part)) {
                return {
                  type: "table",
                  toolCallId: part.toolCallId,
                  table: tableFromToolPart(part),
                };
              }
              if (isPresentChartPart(part)) {
                return {
                  type: "chart",
                  toolCallId: part.toolCallId,
                  chart: chartFromToolPart(part),
                };
              }
              return { type: part.type };
            }),
          );
          if (display.length === 0) return null;
          const isUser = message.role === "user";
          return (
            <div
              key={message.id}
              className={
                isUser
                  ? "ml-auto max-w-[min(100%,32rem)] rounded-[22px] bg-white/[0.12] px-4 py-2.5 text-[15px] leading-relaxed text-white"
                  : "w-full max-w-none text-[15px] leading-7 text-white/85"
              }
            >
              {isUser ? (
                <span className="whitespace-pre-wrap break-words">
                  {display
                    .filter((part) => part.type === "text")
                    .map((part) => part.text)
                    .join("")}
                </span>
              ) : (
                <div className="min-w-0 space-y-3">
                  {display.map((part, index) => {
                    if (part.type === "text") {
                      return (
                        <ChatMarkdown
                          key={`${message.id}-text-${index}`}
                          text={part.text}
                          onSelectUsername={onSelectUsername}
                        />
                      );
                    }
                    if (part.type === "table") {
                      return (
                        <ChatDataTable
                          key={`${message.id}-table-${part.key}`}
                          table={part.table}
                          onSelectUsername={onSelectUsername}
                        />
                      );
                    }
                    return (
                      <ChatTimeChart
                        key={`${message.id}-chart-${part.key}`}
                        chart={part.chart}
                      />
                    );
                  })}
                </div>
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

      <form onSubmit={onSubmit} className="p-3 pt-1">
        <div className="rounded-[28px] border border-white/10 bg-[#2c2c32] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus-within:border-white/20">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              resizeInput(event.currentTarget);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit(input);
              }
            }}
            rows={1}
            disabled={busy || !canSend}
            placeholder={
              quotaBlocked
                ? "Demo question limit reached for today"
                : canChat
                  ? "Ask anything"
                  : "No snapshots loaded for Chat"
            }
            className="max-h-40 min-h-[44px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-sm leading-relaxed text-white placeholder:text-white/35 focus:outline-none disabled:opacity-50"
          />
          <div className="flex items-end gap-2 px-2.5 pb-2.5">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {linkedinPerson || linkedinCompany ? (
                <LinkedInSourceCluster
                  person={linkedinPerson}
                  company={linkedinCompany}
                  activeIds={activeIds}
                  busy={busy}
                  onToggleParent={toggleLinkedInCluster}
                  onToggleChild={toggleSource}
                />
              ) : null}
              {platformSources.map((source) => {
                if (source.id === "company") return null;
                const Icon = SOURCE_ICON[source.id];
                const selected = activeIds.includes(source.id);
                const lastSelected = selected && activeIds.length === 1;
                const name = `${source.label} · ${source.title}`;
                return (
                  <button
                    key={source.id}
                    type="button"
                    aria-pressed={selected}
                    aria-label={
                      lastSelected
                        ? "Keep at least one account selected"
                        : `${selected ? "Remove" : "Add"} ${name}`
                    }
                    disabled={busy}
                    title={
                      lastSelected
                        ? "Keep at least one account selected"
                        : name
                    }
                    onClick={() => {
                      if (!lastSelected) toggleSource(source.id);
                    }}
                    className={iconBtnClass(selected)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
            <button
              type="submit"
              disabled={busy || !canSend || !input.trim()}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/90 disabled:bg-white/15 disabled:text-white/35"
              aria-label="Send"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
