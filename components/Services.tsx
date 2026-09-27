"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { InstagramIcon, LinkedInIcon, TikTokIcon } from "@/components/PlatformIcons";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"] as const;

const PAPER = "#FBF8F2";
const INK = "#161A17";
const MUTED = "#5E665F";
const LINE = "#D5CDBF";
const TEAL = "#0F766E";
const AMBER = "#C4842A";
const ROSE = "#9B3A4A";
const SENT = ROSE;
const RECEIVED = TEAL;

type MetricId = "comments" | "reactions" | "engagers" | "posts";

const METRICS: {
  id: MetricId;
  label: string;
  value: string;
  delta: number;
  accent: string;
  points: number[];
}[] = [
  {
    id: "comments",
    label: "Comments",
    value: "1.2k",
    delta: 18,
    accent: TEAL,
    points: [82, 110, 96, 148, 172, 156, 201],
  },
  {
    id: "reactions",
    label: "Reactions",
    value: "3.4k",
    delta: 9,
    accent: AMBER,
    points: [210, 248, 265, 302, 340, 318, 390],
  },
  {
    id: "engagers",
    label: "Engagers",
    value: "486",
    delta: -4,
    accent: "#3E5348",
    points: [64, 71, 68, 80, 77, 74, 69],
  },
  {
    id: "posts",
    label: "Posts",
    value: "42",
    delta: 12,
    accent: "#8A6232",
    points: [4, 5, 3, 7, 6, 8, 9],
  },
];

const PLATFORMS: {
  id: "linkedin" | "instagram" | "tiktok";
  label: string;
  color: string;
  Icon: typeof LinkedInIcon;
}[] = [
  { id: "linkedin", label: "LinkedIn", color: "#0A66C2", Icon: LinkedInIcon },
  { id: "instagram", label: "Instagram", color: "#E4405F", Icon: InstagramIcon },
  { id: "tiktok", label: "TikTok", color: "#111111", Icon: TikTokIcon },
];

const PLATFORM_SERIES: Record<MetricId, Record<(typeof PLATFORMS)[number]["id"], number[]>> = {
  comments: {
    linkedin: [46, 58, 52, 84, 98, 90, 112],
    instagram: [82, 110, 96, 148, 172, 156, 201],
    tiktok: [18, 34, 72, 88, 126, 164, 148],
  },
  reactions: {
    linkedin: [120, 150, 138, 190, 220, 205, 248],
    instagram: [210, 248, 265, 302, 340, 318, 390],
    tiktok: [70, 110, 160, 210, 280, 340, 300],
  },
  engagers: {
    linkedin: [28, 34, 31, 42, 48, 44, 40],
    instagram: [64, 71, 68, 80, 77, 74, 69],
    tiktok: [12, 22, 36, 48, 62, 70, 55],
  },
  posts: {
    linkedin: [2, 3, 2, 4, 4, 3, 5],
    instagram: [4, 5, 3, 7, 6, 8, 9],
    tiktok: [1, 2, 4, 5, 7, 8, 6],
  },
};

const COMMENTATORS = [
  {
    id: "maya",
    name: "Maya Chen",
    handle: "@maya",
    value: 48,
    note: "Most of these landed on the March launch post.",
  },
  {
    id: "jordan",
    name: "Jordan Lee",
    handle: "@jordan",
    value: 31,
    note: "Replied on three product threads.",
  },
  {
    id: "sam",
    name: "Sam Rivera",
    handle: "@sam",
    value: 22,
    note: "Follow-ups on the hiring post.",
  },
  {
    id: "casey",
    name: "Casey Ng",
    handle: "@casey",
    value: 17,
    note: "Commented on the design recap.",
  },
];

type Tone = "positive" | "neutral" | "negative";

const TONES: { id: Tone; label: string; value: number; color: string }[] = [
  { id: "positive", label: "Positive", value: 186, color: TEAL },
  { id: "neutral", label: "Neutral", value: 72, color: "#A39888" },
  { id: "negative", label: "Negative", value: 41, color: ROSE },
];

const COMMENTS: { id: string; tone: Tone; author: string; likes: number; text: string }[] = [
  {
    id: "c1",
    tone: "positive",
    author: "Maya Chen",
    likes: 24,
    text: "This is the clearest thing you have posted all year.",
  },
  {
    id: "c2",
    tone: "positive",
    author: "Jordan Lee",
    likes: 11,
    text: "Saved. The comments finally sit next to the people who wrote them.",
  },
  {
    id: "c3",
    tone: "neutral",
    author: "Sam Rivera",
    likes: 2,
    text: "What time is the office-hours thread?",
  },
  {
    id: "c4",
    tone: "neutral",
    author: "Priya Shah",
    likes: 4,
    text: "Passing this to the team.",
  },
  {
    id: "c5",
    tone: "negative",
    author: "Leo Park",
    likes: 7,
    text: "The new layout buried the actual comments.",
  },
  {
    id: "c6",
    tone: "negative",
    author: "Alex Kim",
    likes: 3,
    text: "Hard to tell who is talking to whom.",
  },
];

type ArchiveKind = "post" | "comment";

type ArchiveRow = {
  id: string;
  kind: ArchiveKind;
  text: string;
  who: string;
  where: string;
};

const ARCHIVE: ArchiveRow[] = [
  {
    id: "p1",
    kind: "post",
    text: "March launch",
    who: "You",
    where: "48 comments",
  },
  {
    id: "p2",
    kind: "post",
    text: "Hiring post",
    who: "You",
    where: "22 comments",
  },
  {
    id: "p3",
    kind: "post",
    text: "Design recap",
    who: "You",
    where: "17 comments",
  },
  {
    id: "c1",
    kind: "comment",
    text: "This is the clearest thing you have posted all year.",
    who: "Maya Chen",
    where: "March launch",
  },
  {
    id: "c2",
    kind: "comment",
    text: "Saved. The comments finally sit next to the people who wrote them.",
    who: "Jordan Lee",
    where: "March launch",
  },
  {
    id: "c3",
    kind: "comment",
    text: "What time is the office-hours thread?",
    who: "Sam Rivera",
    where: "Hiring post",
  },
  {
    id: "c5",
    kind: "comment",
    text: "The new layout buried the actual comments.",
    who: "Leo Park",
    where: "Design recap",
  },
  {
    id: "c6",
    kind: "comment",
    text: "Hard to tell who is talking to whom.",
    who: "Alex Kim",
    where: "Design recap",
  },
];

function archiveHaystack(row: ArchiveRow): string {
  return `${row.kind} ${row.text} ${row.who} ${row.where}`.toLowerCase();
}

function archiveMatches(query: string, kind: "all" | ArchiveKind): ArchiveRow[] {
  const needle = query.trim().toLowerCase();
  return ARCHIVE.filter((row) => {
    if (kind !== "all" && row.kind !== kind) return false;
    if (!needle) return true;
    return archiveHaystack(row).includes(needle);
  });
}

type AgentAnswer = {
  text: string;
  rows: { label: string; value: string }[];
};

function askLamprotornis(raw: string): AgentAnswer {
  const query = raw.trim().toLowerCase();
  if (!query) {
    return {
      text: "Ask about a person, a post, or a tone.",
      rows: [],
    };
  }
  if (/negative|sentiment|tone/.test(query)) {
    const rows = COMMENTS.filter((row) => row.tone === "negative").map((row) => ({
      label: row.author,
      value: row.text,
    }));
    return { text: `${rows.length} comments read as negative.`, rows };
  }
  if (/positive/.test(query)) {
    const rows = COMMENTS.filter((row) => row.tone === "positive").map((row) => ({
      label: row.author,
      value: row.text,
    }));
    return { text: `${rows.length} comments read as positive.`, rows };
  }
  if (/top post|posts this month|which post/.test(query)) {
    return {
      text: "Top posts by comments.",
      rows: ARCHIVE.filter((row) => row.kind === "post").map((row) => ({
        label: row.text,
        value: row.where,
      })),
    };
  }
  if (/march|launch/.test(query)) {
    const rows = ARCHIVE.filter((row) => row.where === "March launch" || row.text === "March launch").map(
      (row) => ({
        label: row.kind === "post" ? row.text : row.who,
        value: row.kind === "post" ? row.where : row.text,
      }),
    );
    return {
      text: "The March launch drew the most comments. Maya Chen led them.",
      rows,
    };
  }
  const hits = [
    ...archiveMatches(query, "all").map((row) => ({
      label: row.kind === "post" ? row.text : row.who,
      value: row.kind === "post" ? row.where : row.text,
    })),
    ...GRAPH_PEOPLE.filter((person) =>
      `${person.name} ${person.handle} ${person.why}`.toLowerCase().includes(query),
    ).map((person) => ({ label: person.name, value: person.why })),
    ...COMMENTATORS.filter((person) =>
      `${person.name} ${person.handle} ${person.note}`.toLowerCase().includes(query),
    ).map((person) => ({ label: person.name, value: person.note })),
  ];
  const seen = new Set<string>();
  const rows = hits.filter((row) => {
    const key = `${row.label}|${row.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (rows.length === 0) {
    return {
      text: "Nothing in this sample matches that. Try a name, a post, or “negative”.",
      rows: [],
    };
  }
  return {
    text: `${rows.length} ${rows.length === 1 ? "match" : "matches"} across posts, comments, and people.`,
    rows: rows.slice(0, 3),
  };
}

type GraphPerson = {
  id: string;
  name: string;
  handle: string;
  angle: number;
  sent: number;
  received: number;
  why: string;
};

const GRAPH_PEOPLE: GraphPerson[] = [
  {
    id: "maya",
    name: "Maya Chen",
    handle: "@maya",
    angle: -90,
    sent: 3,
    received: 12,
    why: "Commented on 12 of your posts. You replied 3 times.",
  },
  {
    id: "jordan",
    name: "Jordan Lee",
    handle: "@jordan",
    angle: -30,
    sent: 8,
    received: 2,
    why: "You commented on 8 of their posts. They reacted twice.",
  },
  {
    id: "sam",
    name: "Sam Rivera",
    handle: "@sam",
    angle: 30,
    sent: 5,
    received: 5,
    why: "Even exchange. Five comments each way.",
  },
  {
    id: "casey",
    name: "Casey Ng",
    handle: "@casey",
    angle: 90,
    sent: 0,
    received: 9,
    why: "Left 9 comments. You have not replied.",
  },
  {
    id: "priya",
    name: "Priya Shah",
    handle: "@priya",
    angle: 150,
    sent: 4,
    received: 1,
    why: "You mentioned them on 4 posts. They replied once.",
  },
  {
    id: "leo",
    name: "Leo Park",
    handle: "@leo",
    angle: 210,
    sent: 1,
    received: 6,
    why: "Reacted to 6 posts. You commented once.",
  },
];

function chartMax(max: number) {
  if (max <= 0) return 1;
  const padded = max * 1.08;
  const pow = 10 ** Math.floor(Math.log10(padded));
  const n = padded / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * pow;
}

function linePath(pts: { x: number; y: number }[]) {
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

function polar(cx: number, cy: number, r: number, angle: number) {
  return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r] as const;
}

function donutSlice(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  start: number,
  end: number,
) {
  const large = end - start > Math.PI ? 1 : 0;
  const [x1, y1] = polar(cx, cy, outer, start);
  const [x2, y2] = polar(cx, cy, outer, end);
  const [x3, y3] = polar(cx, cy, inner, end);
  const [x4, y4] = polar(cx, cy, inner, start);
  return `M ${x1} ${y1} A ${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
}

function onActivate(event: KeyboardEvent, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

function Widget({ children }: { children: ReactNode }) {
  return (
    <div className="normal-case overflow-hidden rounded-2xl border border-[#D5CDBF] bg-[#FBF8F2] text-[#161A17] shadow-[0_18px_40px_rgba(22,26,23,0.06)]">
      {children}
    </div>
  );
}

function AnalyticsDemo() {
  const [metricId, setMetricId] = useState<MetricId>("comments");
  const [pinned, setPinned] = useState(MONTHS.length - 1);
  const [hover, setHover] = useState<number | null>(null);
  const [personId, setPersonId] = useState(COMMENTATORS[0].id);

  const metric = METRICS.find((item) => item.id === metricId) ?? METRICS[0];
  const active = hover ?? pinned;
  const person = COMMENTATORS.find((row) => row.id === personId) ?? COMMENTATORS[0];
  const maxValue = Math.max(...COMMENTATORS.map((row) => row.value));

  const w = 320;
  const h = 340;
  const pad = { l: 36, r: 34, t: 16, b: 28 };
  const platformSeries = PLATFORM_SERIES[metric.id];
  const maxY = chartMax(
    Math.max(...PLATFORMS.flatMap((platform) => platformSeries[platform.id])),
  );
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const series = PLATFORMS.map((platform) => {
    const coords = platformSeries[platform.id].map((v, i) => ({
      x: pad.l + (i / (platformSeries[platform.id].length - 1)) * innerW,
      y: pad.t + innerH - (v / maxY) * innerH,
      v,
    }));
    return { ...platform, coords };
  });
  const slot = innerW / (MONTHS.length - 1);
  const yTicks = [maxY, Math.round(maxY / 2), 0];
  const activeValues = series.map((platform) => platform.coords[active]);

  return (
    <Widget>
      <div className="grid grid-cols-4 border-b border-[#D5CDBF]" role="tablist" aria-label="Metrics">
        {METRICS.map((item) => {
          const selected = item.id === metricId;
          const up = item.delta > 0;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setMetricId(item.id)}
              className={`relative px-1.5 py-2.5 text-left outline-none transition focus-visible:bg-[#0F766E]/10 sm:px-2 ${
                selected ? "bg-[#0F766E]/10" : "hover:bg-[#161A17]/[0.03]"
              }`}
            >
              <span className="block truncate text-[10px] font-medium text-[#5E665F]">{item.label}</span>
              <span className="mt-0.5 flex items-baseline gap-1">
                <span className="font-mono text-sm font-semibold tabular-nums tracking-tight">
                  {item.value}
                </span>
                <span className={`text-[10px] tabular-nums ${up ? "text-[#0F766E]" : "text-[#9B3A4A]"}`}>
                  {up ? "+" : ""}
                  {item.delta}%
                </span>
              </span>
              {selected ? (
                <span
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full"
                  style={{ backgroundColor: item.accent }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-7 border-b border-[#D5CDBF]" role="tablist" aria-label="Months">
        {MONTHS.map((month, index) => {
          const selected = active === index;
          return (
            <button
              key={month}
              type="button"
              role="tab"
              aria-selected={pinned === index}
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setPinned(index)}
              className={`relative py-2 text-center text-[11px] outline-none ${
                selected ? "text-[#161A17]" : "text-[#5E665F] hover:text-[#161A17]"
              }`}
            >
              {month}
              {selected ? (
                <span
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full"
                  style={{ backgroundColor: TEAL }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="block h-[80vh] max-h-[80vh] w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${metric.label} by month`}
          onMouseLeave={() => setHover(null)}
        >
          {yTicks.map((tick) => {
            const y = pad.t + innerH - (tick / maxY) * innerH;
            return (
              <g key={tick}>
                <line
                  x1={pad.l}
                  x2={w - pad.r}
                  y1={y}
                  y2={y}
                  stroke="rgba(22,26,23,0.08)"
                />
                <text
                  x={pad.l - 6}
                  y={y + 3}
                  textAnchor="end"
                  fill={MUTED}
                  fontSize="8"
                >
                  {tick}
                </text>
              </g>
            );
          })}
          {series.map((platform) => (
            <g key={platform.id}>
              <path
                d={linePath(platform.coords.slice(0, -1))}
                fill="none"
                stroke={platform.color}
                strokeWidth="2.25"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <path
                d={linePath(platform.coords.slice(-2))}
                fill="none"
                stroke={platform.color}
                strokeWidth="2.25"
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray="4 3"
              />
              <circle
                cx={platform.coords[active].x}
                cy={platform.coords[active].y}
                r="3.5"
                fill={platform.color}
                stroke={PAPER}
                strokeWidth="1.5"
              />
            </g>
          ))}
          {active != null ? (
            <line
              x1={series[0].coords[active].x}
              x2={series[0].coords[active].x}
              y1={pad.t}
              y2={pad.t + innerH}
              stroke="rgba(22,26,23,0.12)"
            />
          ) : null}
          {series[0].coords.map((c, i) => (
            <text
              key={`label-${MONTHS[i]}`}
              x={c.x}
              y={h - 6}
              textAnchor="middle"
              fill={active === i ? INK : MUTED}
              fontSize="8"
            >
              {MONTHS[i]}
            </text>
          ))}
          {series[0].coords.map((c, i) => (
            <rect
              key={`hit-${MONTHS[i]}`}
              x={c.x - slot / 2}
              y={0}
              width={slot}
              height={h}
              fill="transparent"
              className="cursor-pointer [outline:none] focus:[outline:none]"
              role="button"
              tabIndex={0}
              aria-label={`${MONTHS[i]}, ${series
                .map((platform) => `${platform.label} ${platform.coords[i].v}`)
                .join(", ")}`}
              onMouseEnter={() => setHover(i)}
              onClick={() => setPinned(i)}
              onKeyDown={(event) => onActivate(event, () => setPinned(i))}
            />
          ))}
        </svg>
        {series.map((platform) => {
          const end = platform.coords[platform.coords.length - 1];
          const Icon = platform.Icon;
          return (
            <span
              key={platform.id}
              className="pointer-events-none absolute flex h-4 w-4 -translate-y-1/2 items-center justify-center"
              style={{
                left: `calc(${(end.x / w) * 100}% + 6px)`,
                top: `${(end.y / h) * 100}%`,
                color: platform.color,
              }}
              title={platform.label}
            >
              <Icon className="h-3.5 w-3.5" title={platform.label} />
            </span>
          );
        })}
      </div>

      <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[#D5CDBF] px-3 py-1.5 text-[11px] text-[#5E665F]">
        <span>
          {MONTHS[active]}
          {active === MONTHS.length - 1 ? " · still coming in" : ""}
        </span>
        <span className="flex flex-wrap gap-x-3 font-mono tabular-nums">
          {activeValues.map((point, index) => (
            <span key={series[index].id} style={{ color: series[index].color }}>
              {point.v}
            </span>
          ))}
        </span>
      </p>

      <div className="px-2 py-2">
        <div className="flex items-center justify-between px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[#5E665F]">
          <span>Top commentators</span>
          <span>Comments</span>
        </div>
        <ul>
          {COMMENTATORS.map((row, index) => {
            const selected = row.id === personId;
            const pct = Math.max(8, (row.value / maxValue) * 100);
            return (
              <li key={row.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setPersonId(row.id)}
                  className={`relative flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left outline-none transition focus-visible:bg-[#0F766E]/10 ${
                    selected ? "bg-[#0F766E]/10" : "hover:bg-[#161A17]/[0.04]"
                  }`}
                >
                  <span
                    className="pointer-events-none absolute inset-y-1 left-1 rounded-md"
                    style={{ width: `calc(${pct}% - 8px)`, background: "#0F766E18" }}
                    aria-hidden
                  />
                  <span className="relative w-4 shrink-0 text-center font-mono text-[10px] text-[#5E665F]">
                    {index + 1}
                  </span>
                  <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F3EEE4] text-[10px] font-semibold text-[#161A17]">
                    {row.name.charAt(0)}
                  </span>
                  <span className="relative min-w-0 flex-1">
                    <span className="block truncate text-[12px] text-[#161A17]">{row.name}</span>
                    <span className="block truncate text-[10px] text-[#5E665F]">{row.handle}</span>
                  </span>
                  <span className="relative shrink-0 font-mono text-[12px] tabular-nums text-[#161A17]">
                    {row.value}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="border-t border-[#D5CDBF] px-3 py-2 text-[11px] leading-relaxed text-[#5E665F]">
        <span className="text-[#161A17]">{person.name}.</span> {person.note}
      </p>
    </Widget>
  );
}

function SentimentDemo() {
  const [tone, setTone] = useState<Tone | null>(null);
  const total = TONES.reduce((sum, item) => sum + item.value, 0);
  const matching = tone ? COMMENTS.filter((row) => row.tone === tone) : COMMENTS;
  const preview = [COMMENTS[0], COMMENTS[4], COMMENTS[2]];
  const shown = (tone ? matching : preview).slice(0, 2);
  const active = TONES.find((item) => item.id === tone) ?? null;

  const cx = 80;
  const cy = 80;
  const outer = 62;
  const inner = 36;
  let cursor = -Math.PI / 2;
  const slices = TONES.map((item) => {
    const span = (item.value / total) * Math.PI * 2;
    const start = cursor + 0.02;
    const end = cursor + span - 0.02;
    cursor += span;
    return { ...item, start, end };
  });

  function toggle(id: Tone) {
    setTone((current) => (current === id ? null : id));
  }

  return (
    <Widget>
      <div className="flex items-center justify-between border-b border-[#D5CDBF] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5E665F]">Comment mix</p>
        <p className="font-mono text-[11px] tabular-nums text-[#5E665F]">{total} comments</p>
      </div>
      <div className="flex justify-center px-2 pt-2">
        <svg viewBox="0 0 160 160" className="h-[132px] w-[132px]" role="img" aria-label="Sentiment mix">
          {slices.map((slice) => {
            const selected = tone === slice.id;
            const dimmed = tone != null && !selected;
            return (
              <path
                key={slice.id}
                d={donutSlice(cx, cy, selected ? outer + 6 : outer, inner, slice.start, slice.end)}
                fill={slice.color}
                opacity={dimmed ? 0.28 : 1}
                stroke="none"
                className="cursor-pointer [outline:none] focus:[outline:none]"
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={`${slice.label}, ${slice.value}`}
                onClick={() => toggle(slice.id)}
                onKeyDown={(event) => onActivate(event, () => toggle(slice.id))}
              />
            );
          })}
          <text x={cx} y={cy - 2} textAnchor="middle" fill={INK} fontSize="16" fontWeight="600">
            {active ? active.value : total}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fill={MUTED} fontSize="10">
            {active ? `${Math.round((active.value / total) * 100)}%` : "total"}
          </text>
        </svg>
      </div>
      <ul className="flex flex-col gap-0.5 px-2 pb-2">
          {TONES.map((item) => {
            const selected = tone === item.id;
            const share = Math.round((item.value / total) * 100);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggle(item.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-left text-[11px] outline-none transition focus-visible:bg-[#0F766E]/10 ${
                    selected ? "bg-[#0F766E]/10 text-[#161A17]" : "text-[#5E665F] hover:bg-[#161A17]/[0.04]"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-[#161A17]">
                    {item.value}
                    <span className="ml-1 text-[#5E665F]">{share}%</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      <div className="border-t border-[#D5CDBF] px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-[#5E665F]">
          {shown.length} of {matching.length}
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {shown.slice(0, 2).map((row) => (
            <li key={row.id} className="rounded-lg border border-[#D5CDBF] bg-[#F3EEE4] px-2.5 py-2">
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#5E665F]">
                <span
                  className="rounded-full border px-1.5 py-px capitalize"
                  style={{
                    color: TONES.find((item) => item.id === row.tone)?.color,
                    borderColor: LINE,
                  }}
                >
                  {row.tone}
                </span>
                <span>{row.likes} likes</span>
                <span>{row.author}</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-[#161A17]">{row.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </Widget>
  );
}

function place(angle: number, radius: number, cx: number, cy: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * radius, y: cy + Math.sin(rad) * radius };
}

function Arrow({
  x1,
  y1,
  x2,
  y2,
  color,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 7;
  const spread = Math.PI * 0.78;
  const points = [
    [x2, y2],
    [x2 - Math.cos(angle - spread) * size, y2 - Math.sin(angle - spread) * size],
    [x2 - Math.cos(angle + spread) * size, y2 - Math.sin(angle + spread) * size],
  ]
    .map((point) => point.join(","))
    .join(" ");
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2" strokeLinecap="round" />
      <polygon points={points} fill={color} />
    </g>
  );
}

function GraphDemo() {
  const [selectedId, setSelectedId] = useState("maya");
  const cx = 190;
  const cy = 158;
  const ring = 96;
  const selected = GRAPH_PEOPLE.find((person) => person.id === selectedId) ?? null;

  return (
    <Widget>
      <div className="flex items-center justify-between border-b border-[#D5CDBF] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5E665F]">Network</p>
        <p className="flex items-center gap-2 text-[10px]">
          <span style={{ color: SENT }}>you sent</span>
          <span style={{ color: RECEIVED }}>they sent</span>
        </p>
      </div>
      <svg viewBox="0 0 400 340" className="block h-auto w-full" role="img" aria-label="Sample network">
        {GRAPH_PEOPLE.map((person) => {
          const at = place(person.angle, ring, cx, cy);
          const dx = at.x - cx;
          const dy = at.y - cy;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const emphasized = selectedId === person.id;
          const faded = selectedId !== "you" && !emphasized;
          return (
            <g key={person.id} opacity={faded ? 0.28 : 1}>
              <line
                x1={cx + ux * 24}
                y1={cy + uy * 24}
                x2={at.x - ux * 18}
                y2={at.y - uy * 18}
                stroke="rgba(22,26,23,0.14)"
                strokeWidth="1.5"
              />
              {person.sent > 0 ? (
                <Arrow
                  x1={cx + ux * 24}
                  y1={cy + uy * 24}
                  x2={cx + ux * 42}
                  y2={cy + uy * 42}
                  color={SENT}
                />
              ) : null}
              {person.received > 0 ? (
                <Arrow
                  x1={at.x - ux * 18}
                  y1={at.y - uy * 18}
                  x2={at.x - ux * 36}
                  y2={at.y - uy * 36}
                  color={RECEIVED}
                />
              ) : null}
            </g>
          );
        })}

        <g
          role="button"
          tabIndex={0}
          className="cursor-pointer [outline:none] focus:[outline:none]"
          style={{ outline: "none" }}
          aria-pressed={selectedId === "you"}
          aria-label="You, the center of this map"
          onClick={() => setSelectedId("you")}
          onKeyDown={(event) => onActivate(event, () => setSelectedId("you"))}
        >
          <circle cx={cx} cy={cy} r="20" fill={AMBER} />
          <text x={cx} y={cy + 4} textAnchor="middle" fill="#161A17" fontSize="12" fontWeight="600">
            You
          </text>
        </g>

        {GRAPH_PEOPLE.map((person) => {
          const at = place(person.angle, ring, cx, cy);
          const rad = (person.angle * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const emphasized = selectedId === person.id;
          const anchor = cos > 0.45 ? "start" : cos < -0.45 ? "end" : "middle";
          const labelX = at.x + cos * 26;
          const labelY = at.y + sin * 26 + (Math.abs(cos) > 0.45 ? 4 : sin > 0 ? 16 : -12);
          return (
            <g
              key={`node-${person.id}`}
              role="button"
              tabIndex={0}
              className="cursor-pointer [outline:none] focus:[outline:none]"
              style={{ outline: "none" }}
              aria-pressed={emphasized}
              aria-label={`${person.name}. ${person.why}`}
              onClick={() => setSelectedId(person.id)}
              onKeyDown={(event) => onActivate(event, () => setSelectedId(person.id))}
            >
              <circle cx={at.x} cy={at.y} r="26" fill="transparent" />
              <circle
                cx={at.x}
                cy={at.y}
                r="16"
                fill={PAPER}
                stroke={emphasized ? TEAL : LINE}
                strokeWidth="1.25"
              />
              <text x={at.x} y={at.y + 4} textAnchor="middle" fill={INK} fontSize="12" fontWeight="600">
                {person.name.charAt(0)}
              </text>
              <text
                x={labelX}
                y={labelY}
                textAnchor={anchor}
                fill={INK}
                fontSize="13"
              >
                {person.name.split(" ")[0]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="min-h-[4.75rem] border-t border-[#D5CDBF] px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5E665F]">
          {selected ? "Why this line" : "You"}
        </p>
        <p className="mt-0.5 flex items-baseline gap-2 text-[13px] text-[#161A17]">
          <span>{selected ? selected.name : "The center of this map"}</span>
          {selected ? (
            <span className="font-mono text-[11px] tabular-nums">
              <span style={{ color: SENT }}>{selected.sent}</span>
              <span className="text-[#5E665F]"> · </span>
              <span style={{ color: RECEIVED }}>{selected.received}</span>
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-[#5E665F]">
          {selected
            ? selected.why
            : "Six people around you. Rose leaves you. Teal comes back."}
        </p>
      </div>
    </Widget>
  );
}

function ArchiveDemo() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | ArchiveKind>("all");
  const matches = archiveMatches(query, kind);
  const shown = matches.slice(0, 4);

  return (
    <Widget>
      <form
        className="border-b border-[#D5CDBF] px-3 py-2.5"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="sr-only" htmlFor="archive-search">
          Search posts and comments
        </label>
        <input
          id="archive-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search posts and comments"
          className="w-full border-b border-[#D5CDBF] bg-transparent py-1.5 text-[13px] text-[#161A17] outline-none placeholder:text-[#5E665F] focus:border-[#0F766E]"
        />
        <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Record type">
          {(
            [
              ["all", "All"],
              ["post", "Posts"],
              ["comment", "Comments"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={kind === id}
              onClick={() => setKind(id)}
              className={`rounded-full px-2 py-0.5 text-[11px] outline-none ${
                kind === id
                  ? "bg-[#0F766E]/10 text-[#0F766E]"
                  : "text-[#5E665F] hover:text-[#161A17]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </form>
      <p className="px-3 pt-2 text-[10px] uppercase tracking-wide text-[#5E665F]">
        {shown.length} of {matches.length}
      </p>
      {shown.length === 0 ? (
        <p className="px-3 py-3 text-[12px] text-[#5E665F]">
          No posts or comments match “{query.trim()}”.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5 px-3 py-2">
          {shown.map((row) => (
            <li key={row.id} className="rounded-lg border border-[#D5CDBF] bg-[#F3EEE4] px-2.5 py-2">
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#5E665F]">
                <span className="capitalize text-[#0F766E]">{row.kind}</span>
                <span>{row.who}</span>
                <span>{row.where}</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-[#161A17]">{row.text}</p>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

const AGENT_PROMPTS = [
  "Who commented on the March launch?",
  "Which comments were negative?",
  "Top posts this month",
] as const;

function LamprotornisDemo() {
  const [draft, setDraft] = useState<string>(AGENT_PROMPTS[0]);
  const [question, setQuestion] = useState<string>(AGENT_PROMPTS[0]);
  const [answer, setAnswer] = useState(() => askLamprotornis(AGENT_PROMPTS[0]));

  function ask(next: string) {
    const trimmed = next.trim();
    setDraft(trimmed);
    setQuestion(trimmed);
    setAnswer(askLamprotornis(trimmed));
  }

  return (
    <Widget>
      <div className="border-b border-[#D5CDBF] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5E665F]">
          Searches the whole run
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
        {AGENT_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => ask(prompt)}
            className={`rounded-full border px-2 py-0.5 text-left text-[11px] outline-none ${
              question === prompt
                ? "border-[#0F766E] text-[#0F766E]"
                : "border-[#D5CDBF] text-[#5E665F] hover:text-[#161A17]"
            }`}
          >
            {prompt}
          </button>
        ))}
      </div>
      <form
        className="flex items-center gap-3 px-3 py-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          ask(draft);
        }}
      >
        <label className="sr-only" htmlFor="lamprotornis-ask">
          Ask Lamprotornis
        </label>
        <input
          id="lamprotornis-ask"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask across everything"
          className="min-w-0 flex-1 border-b border-[#D5CDBF] bg-transparent py-1.5 text-[13px] text-[#161A17] outline-none placeholder:text-[#5E665F] focus:border-[#0F766E]"
        />
        <button type="submit" className="shrink-0 text-sm font-medium text-[#0F766E]">
          ask
        </button>
      </form>
      <div className="border-t border-[#D5CDBF] px-3 py-2.5">
        <p className="text-[11px] text-[#5E665F]">{question}</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#161A17]">{answer.text}</p>
        {answer.rows.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1.5">
            {answer.rows.slice(0, 3).map((row) => (
              <li
                key={`${row.label}-${row.value}`}
                className="rounded-lg border border-[#D5CDBF] bg-[#F3EEE4] px-2.5 py-2"
              >
                <p className="text-[12px] text-[#161A17]">{row.label}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#5E665F]">{row.value}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Widget>
  );
}

const SERVICES: {
  title: string;
  body: string;
  demo: ReactNode;
  span: string;
  proper?: boolean;
}[] = [
  {
    title: "social media analytics",
    body: "Comments, reactions, engagers, and posts. Pick a metric and the line follows. The table ranks the people behind the number.",
    demo: <AnalyticsDemo />,
    span: "lg:col-span-1",
  },
  {
    title: "sentiment analysis",
    body: "Each comment scored positive, neutral, or negative. Tap a slice of the mix and the list keeps only that tone.",
    demo: <SentimentDemo />,
    span: "lg:col-span-1",
  },
  {
    title: "graph visualization",
    body: "You in the center, everyone else on a spoke. Rose is what you sent. Teal is what came back. Tap someone to see why the line is there.",
    demo: <GraphDemo />,
    span: "lg:col-span-2",
  },
  {
    title: "posts and comments",
    body: "Every post and comment from a run, in one list. Search a name, a word, or the post it sat on.",
    demo: <ArchiveDemo />,
    span: "lg:col-span-1",
  },
  {
    title: "Lamprotornis",
    body: "An agent that looks across the posts, the comments, the sentiment, and the people. Ask in a sentence.",
    demo: <LamprotornisDemo />,
    span: "lg:col-span-1",
    proper: true,
  },
];

export default function Services({ titleClassName = "" }: { titleClassName?: string }) {
  return (
    <section id="services" className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
      <h2 className={`${titleClassName} text-center text-4xl tracking-tight sm:text-5xl`}>services</h2>
      <p className="mx-auto mt-4 max-w-md text-center text-[15px] leading-relaxed text-[#5E665F] normal-case">
        What opens after you pick a handle.
      </p>
      <ul className="mt-14 grid items-start gap-x-10 gap-y-14 lg:grid-cols-2 lg:gap-x-16">
        {SERVICES.map((service) => (
          <li key={service.title} className={`flex min-w-0 flex-col ${service.span}`}>
            <h3
              className={`${titleClassName} text-center text-[1.7rem] leading-tight tracking-tight ${
                service.proper ? "normal-case" : ""
              }`}
            >
              {service.title}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-center text-sm leading-relaxed text-[#5E665F] normal-case">
              {service.body}
            </p>
            <div className="mt-4">{service.demo}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
