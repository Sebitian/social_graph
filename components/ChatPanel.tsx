"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  ArrowUp,
  Check,
  Copy,
  Loader2,
  MessageCircle,
  Mic,
  Square,
  SquarePen,
  User,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import ChatDataTable, {
  tableFromToolPart,
} from "@/components/chat/ChatDataTable";
import ChatMarkdown from "@/components/chat/ChatMarkdown";
import ChatTimeChart from "@/components/chat/ChatTimeChart";
import { useChatVoice } from "@/components/chat/useChatVoice";
import {
  CompanyIcon,
  ConferenceIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  TikTokIcon,
} from "@/components/PlatformIcons";
import { chartFromToolPart } from "@/lib/chat/chart";
import { displayPartsFromMessage, type ChatDisplayPart } from "@/lib/chat/display";
import { spokenTextFromDisplay } from "@/lib/chat/speech";
import type { ChatChart, ChatSourceId, ChatSourceInfo, ChatTable } from "@/lib/chat/types";
import type { ScrapeBudget } from "@/lib/scrapeBudget";

const SOURCE_ICON: Record<ChatSourceId, typeof LinkedInIcon> = {
  linkedin: LinkedInIcon,
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  tiktok: TikTokIcon,
  company: CompanyIcon,
  conference: ConferenceIcon,
};

const PROMPT_ICON_CLASS: Record<ChatSourceId, string> = {
  linkedin: "text-[#0A66C2]",
  instagram: "text-[#E4405F]",
  facebook: "text-[#1877F2]",
  tiktok: "text-[#161A17]",
  company: "text-[#5E665F]",
  conference: "text-[#E11D48]",
};

const PROMPT_HIGHLIGHTS = [
  "top engager",
  "past week",
  "view over time",
  "over time",
  "this week",
  "this month",
  "employees",
];

type PromptSuggestion = {
  text: string;
  sources: ChatSourceId[];
};

const LINKEDIN_CLUSTER_IDS: ChatSourceId[] = ["linkedin", "company"];

function iconBtnClass(selected: boolean): string {
  return `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
    selected
      ? "border-[#0F766E]/30 bg-[#0F766E]/10 text-[#0F766E]"
      : "border-[#D5CDBF]/70 bg-transparent text-[#5E665F] hover:border-[#0F766E]/40 hover:bg-[#E7E0D4] hover:text-[#161A17]"
  }`;
}

function firstSource(
  ids: Set<ChatSourceId>,
  order: ChatSourceId[],
): ChatSourceId | null {
  return order.find((id) => ids.has(id)) ?? null;
}

function suggestions(sources: ChatSourceInfo[]): PromptSuggestion[] {
  const ids = new Set(sources.map((source) => source.id));
  const prompts: PromptSuggestion[] = [];
  const viewIds = (
    ["instagram", "facebook", "tiktok"] as const satisfies ChatSourceId[]
  ).filter((id) => ids.has(id));
  const viewLabel: Record<(typeof viewIds)[number], string> = {
    instagram: "Instagram",
    facebook: "Facebook",
    tiktok: "TikTok",
  };

  const firstView = viewIds[0];
  const secondView = viewIds[1];
  if (firstView && secondView) {
    prompts.push({
      text: `Compare ${viewLabel[firstView]} vs ${viewLabel[secondView]} views this week`,
      sources: [firstView, secondView],
    });
  }
  if (ids.has("tiktok")) {
    prompts.push({
      text: "Show TikTok plays over the past week",
      sources: ["tiktok"],
    });
  } else if (ids.has("instagram")) {
    prompts.push({
      text: "Show Instagram plays over the past week",
      sources: ["instagram"],
    });
    prompts.push({
      text: "List Instagram employees and their follower counts",
      sources: ["instagram"],
    });
  } else if (ids.has("facebook")) {
    prompts.push({
      text: "Show Facebook views over the past week",
      sources: ["facebook"],
    });
  }
  const postsSource = firstSource(ids, ["instagram", "facebook", "linkedin"]);
  if (postsSource) {
    prompts.push({
      text: "Top posts this month as a table",
      sources: [postsSource],
    });
  } else if (ids.has("tiktok")) {
    prompts.push({
      text: "Top TikTok videos by plays",
      sources: ["tiktok"],
    });
  }
  const engagerSource = firstSource(ids, ["instagram", "facebook", "linkedin"]);
  if (engagerSource) {
    prompts.push({
      text: "Who was the top engager this past week?",
      sources: [engagerSource],
    });
  }
  if (ids.has("company")) {
    const company = sources.find((source) => source.id === "company");
    prompts.push({
      text: company
        ? `Who is the ${company.title} CEO?`
        : "Who is the company CEO?",
      sources: ["company"],
    });
  }
  if (ids.has("conference")) {
    const conference = sources.find((source) => source.id === "conference");
    prompts.push({
      text: conference
        ? `Who is at ${conference.title}?`
        : "Who is on the guest list?",
      sources: ["conference"],
    });
    prompts.push({
      text: "Which companies showed up?",
      sources: ["conference"],
    });
  }
  const trendSource = firstSource(ids, ["instagram", "facebook", "linkedin"]);
  if (trendSource && prompts.length < 4) {
    prompts.push({
      text: "Show view over time",
      sources: [trendSource],
    });
  }

  const seen = new Set<string>();
  return prompts.filter((prompt) => {
    if (seen.has(prompt.text)) return false;
    seen.add(prompt.text);
    return true;
  }).slice(0, 4);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function PromptText({ text }: { text: string }) {
  const pattern = new RegExp(
    `(${PROMPT_HIGHLIGHTS.map(escapeRegExp).join("|")})`,
    "gi",
  );
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, index) => {
        const highlight = PROMPT_HIGHLIGHTS.some(
          (phrase) => phrase.toLowerCase() === part.toLowerCase(),
        );
        return highlight ? (
          <strong key={index} className="font-semibold text-[#0F766E]">
            {part}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </>
  );
}

function PromptLogos({ sources }: { sources: ChatSourceId[] }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${
        sources.length > 1 ? "w-9" : "w-7"
      }`}
      aria-hidden
    >
      {sources.map((id, index) => {
        const Icon = SOURCE_ICON[id];
        return (
          <span
            key={`${id}-${index}`}
            className={`inline-flex h-5 w-5 items-center justify-center ${
              index > 0 ? "-ml-1.5" : ""
            }`}
          >
            <Icon className={`h-4 w-4 ${PROMPT_ICON_CLASS[id]}`} />
          </span>
        );
      })}
    </span>
  );
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

function displayFromMessage(parts: Array<{ type: string; text?: string }>): ChatDisplayPart[] {
  return displayPartsFromMessage(
    parts.map((part) => {
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
    const display = displayFromMessage(message.parts);
    for (const part of display) {
      if (part.type === "text") chunks.push(part.text);
      if (part.type === "table") chunks.push(tableToMarkdown(part.table));
      if (part.type === "chart") chunks.push(chartToMarkdown(part.chart));
    }
    const body = chunks.join("\n\n").trim();
    if (!body) continue;
    const who = message.role === "user" ? "You" : "Starling";
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
  onClose?: () => void;
}

type QuotaState = {
  remaining: number;
  limit: number;
  enabled: boolean;
  cooldownSeconds: number;
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
              parentOn ? "bg-[#0F766E]/40" : "bg-[#D5CDBF]/70"
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
              parentOn ? "bg-[#0F766E]/40" : "bg-[#D5CDBF]/70"
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
  onClose,
}: Props) {
  const [input, setInput] = useState("");
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [enabledIds, setEnabledIds] = useState<ChatSourceId[]>(() =>
    sources.map((source) => source.id),
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cooling, setCooling] = useState(false);
  const coolTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    listening,
    speakingId,
    sttSupported,
    ttsSupported,
    micError,
    voices,
    voiceURI,
    selectVoice,
    speak,
    stopSpeaking,
    stopListening,
    toggleListening,
    bindVoice,
    consumeAskedWithVoice,
  } = useChatVoice();

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
      cooldownSeconds: prev?.cooldownSeconds ?? 8,
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
          cooldownSeconds?: number;
        };
        if (cancelled) return;
        if (typeof json.remaining === "number" && typeof json.limit === "number") {
          setQuota({
            remaining: json.remaining,
            limit: json.limit,
            enabled: Boolean(json.enabled),
            cooldownSeconds:
              typeof json.cooldownSeconds === "number" ? json.cooldownSeconds : 8,
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
      if (coolTimer.current) clearTimeout(coolTimer.current);
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
          if (response.status === 429 || response.status === 400) {
            const json = (await response
              .clone()
              .json()
              .catch(() => null)) as { error?: string } | null;
            throw new Error(
              json?.error ||
                (response.status === 429
                  ? "Demo chat limit reached for today."
                  : "Could not send that message."),
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

  const { messages, sendMessage, setMessages, status, error, clearError, stop } =
    useChat({
      id: handle,
      transport,
    });

  const busy = status === "submitted" || status === "streaming";
  const prompts = suggestions(enabledSources);
  const canChat = enabledSources.length > 0;
  const userTurns = messages.filter((message) => message.role === "user").length;
  const questionLimit = quota?.limit ?? 5;
  const limitsOn = quota?.enabled !== false;
  const remaining = Math.max(
    0,
    Math.min(quota?.remaining ?? questionLimit, questionLimit - userTurns),
  );
  const quotaBlocked = limitsOn && (remaining <= 0 || userTurns >= questionLimit);
  const canSend = canChat && !quotaBlocked && !cooling;

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
    if (next.length < 2 || busy || !canSend) return;
    stopListening("cancel");
    stopSpeaking();
    clearError();
    void sendMessage({ text: next });
    setInput("");
    const coolMs =
      (limitsOn ? (quota?.cooldownSeconds ?? 8) : 0) * 1000;
    if (coolMs > 0) {
      setCooling(true);
      if (coolTimer.current) clearTimeout(coolTimer.current);
      coolTimer.current = setTimeout(() => setCooling(false), coolMs);
    }
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

  const isEmpty = messages.length === 0;

  bindVoice({
    setInput: (text) => {
      setInput(text);
      requestAnimationFrame(() => {
        if (textareaRef.current) resizeInput(textareaRef.current);
      });
    },
    submit: (text) => {
      setInput(text);
      submit(text);
    },
  });

  useEffect(() => {
    if (status !== "ready" || !ttsSupported) return;
    if (!consumeAskedWithVoice()) return;
    const last = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");
    if (!last) return;
    const spoken = spokenTextFromDisplay(displayFromMessage(last.parts));
    if (spoken) speak(last.id, spoken, { toggle: false });
  }, [consumeAskedWithVoice, messages, speak, status, ttsSupported]);

  const startNewChat = () => {
    if (isEmpty && !input.trim()) return;
    stopListening("cancel");
    stopSpeaking();
    void stop();
    setMessages([]);
    clearError();
    setInput("");
    setCopied(false);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    });
  };

  const composer = (
    <form onSubmit={onSubmit} className={isEmpty ? "w-full" : "p-3 pt-1"}>
      {limitsOn ? (
        <p
          className="mb-1.5 pr-1 text-right text-[11px] tabular-nums text-[#5E665F]/70"
          aria-live="polite"
        >
          {remaining === 1
            ? "1 message left"
            : `${remaining} messages left`}
        </p>
      ) : null}
      <div className="rounded-[28px] border border-[#D5CDBF] bg-[#F3EEE4] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] focus-within:border-[#0F766E]/40 focus-within:ring-1 focus-within:ring-[#0F766E]/10">
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
            listening
              ? "Listening…"
              : quotaBlocked
              ? "Demo question limit reached for today"
              : cooling
                ? "Wait a few seconds…"
                : canChat
                  ? "Ask anything"
                  : "No snapshots loaded for Chat"
          }
          className="max-h-40 min-h-[44px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-sm leading-relaxed text-[#161A17] placeholder:text-[#5E665F]/55 focus:outline-none disabled:opacity-50"
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
          {sttSupported ? (
            <button
              type="button"
              onClick={() => toggleListening(input)}
              disabled={(busy || !canSend) && !listening}
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
                listening
                  ? "animate-pulse border-red-400/50 bg-red-500 text-white"
                  : "border-[#D5CDBF]/70 bg-transparent text-[#5E665F] hover:border-[#0F766E]/40 hover:bg-[#E7E0D4] hover:text-[#161A17] disabled:opacity-35"
              }`}
              aria-label={listening ? "Stop listening" : "Ask with voice"}
              aria-pressed={listening}
              title={
                listening
                  ? "Stop listening and send"
                  : "Ask with voice"
              }
            >
              <Mic className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="submit"
            disabled={busy || !canSend || !input.trim()}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0F766E] text-white transition hover:bg-[#0D9488] disabled:bg-[#D5CDBF] disabled:text-[#5E665F]/50"
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
      {micError ? (
        <p className="mt-2 px-1 text-xs text-red-600">{micError}</p>
      ) : null}
    </form>
  );

  return (
    <div className="flex h-full flex-col bg-[#FBF8F2]">
      <div className="border-b border-[#D5CDBF] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#161A17]">
              <MessageCircle className="h-4 w-4 text-[#0F766E]" /> Chat
            </div>
            <p className="mt-1 text-xs text-[#5E665F]">
              Frozen snapshots — not live scraping.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {ttsSupported && voices.length > 0 ? (
              <select
                aria-label="Read-aloud voice"
                value={voiceURI}
                onChange={(event) => selectVoice(event.target.value)}
                className="max-w-[10.5rem] truncate rounded-lg border border-[#D5CDBF] bg-[#F3EEE4] px-2 py-1.5 text-[12px] text-[#161A17] outline-none transition hover:bg-[#E7E0D4]"
                title="Read-aloud voice"
              >
                {voices.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name}
                  </option>
                ))}
              </select>
            ) : null}
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-[#D5CDBF] bg-[#F3EEE4] text-[#161A17]/80 transition hover:bg-[#E7E0D4] hover:text-[#161A17]"
                aria-label="Close chat"
                title="Back to graph"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={startNewChat}
              disabled={isEmpty && !input.trim()}
              className="inline-flex items-center gap-2 rounded-lg border border-[#D5CDBF] bg-[#F3EEE4] px-3 py-1.5 text-[13px] font-medium text-[#161A17] transition hover:bg-[#E7E0D4] disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="New chat"
            >
              <SquarePen className="h-3.5 w-3.5" strokeWidth={2} />
              New chat
            </button>
            <button
              type="button"
              onClick={() => void copyChat()}
              disabled={isEmpty}
              className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-[#D5CDBF] bg-[#F3EEE4] text-[#161A17]/80 transition hover:bg-[#E7E0D4] hover:text-[#161A17] disabled:cursor-not-allowed disabled:opacity-35"
              aria-label={copied ? "Copied chat" : "Copy chat"}
              title={copied ? "Copied" : "Copy chat"}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-[#0F766E]" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
        {sources.length === 0 ? (
          <p className="mt-2 text-xs text-[#5E665F]">
            No Chat snapshots are loaded on this page.
          </p>
        ) : null}
      </div>

      {isEmpty ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-10">
          <div className="flex w-full max-w-xl flex-col">
            <h2 className="mb-6 text-center text-[1.7rem] font-medium tracking-tight text-[#161A17]">
              Where should we begin?
            </h2>
            {composer}
            {canSend && prompts.length > 0 ? (
              <ul className="mt-5 w-full">
                {prompts.map((prompt) => (
                  <li key={prompt.text}>
                    <button
                      type="button"
                      onClick={() => submit(prompt.text)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-[#E7E0D4]"
                    >
                      <PromptLogos sources={prompt.sources} />
                      <span className="min-w-0 text-[13.5px] leading-snug text-[#161A17]/75">
                        <PromptText text={prompt.text} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {quotaBlocked ? (
              <div className="mt-4 rounded-xl border border-[#D5CDBF] bg-[#F3EEE4] px-3 py-2 text-xs text-[#5E665F]">
                That&apos;s the {questionLimit}-question demo limit for today. The
                graph and analytics stay open.
              </div>
            ) : null}
            {error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error.message || "Chat request failed."}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
            {messages.map((message) => {
              const display = displayFromMessage(message.parts);
              if (display.length === 0) return null;
              const isUser = message.role === "user";
              const spoken = isUser ? "" : spokenTextFromDisplay(display);
              const speakingThis = speakingId === message.id;
              const streamingThis =
                busy && !isUser && message.id === messages[messages.length - 1]?.id;
              return (
                <div
                  key={message.id}
                  className={
                    isUser
                      ? "ml-auto max-w-[min(100%,32rem)] rounded-[22px] bg-[#0F766E] px-4 py-2.5 text-[15px] leading-relaxed text-white"
                      : "w-full max-w-none text-[15px] leading-7 text-[#161A17]/85"
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
                      {ttsSupported && spoken ? (
                        <button
                          type="button"
                          disabled={streamingThis}
                          onClick={() => speak(message.id, spoken)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#5E665F] transition hover:bg-[#E7E0D4] hover:text-[#161A17] disabled:opacity-30"
                          aria-label={speakingThis ? "Stop reading" : "Read response"}
                          title={speakingThis ? "Stop reading" : "Read response"}
                        >
                          {speakingThis ? (
                            <Square className="h-3 w-3 fill-current" />
                          ) : (
                            <Volume2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}

            {quotaBlocked ? (
              <div className="rounded-xl border border-[#D5CDBF] bg-[#F3EEE4] px-3 py-2 text-xs text-[#5E665F]">
                That&apos;s the {questionLimit}-question demo limit for today. The
                graph and analytics stay open.
              </div>
            ) : null}

            {busy && (
              <div className="flex items-center gap-2 text-xs text-[#5E665F]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Looking up loaded snapshots…
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error.message || "Chat request failed."}
              </div>
            )}
          </div>
          {composer}
        </>
      )}
    </div>
  );
}
