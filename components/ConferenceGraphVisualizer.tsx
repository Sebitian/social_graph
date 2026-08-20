"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type RefAttributes,
} from "react";
import dynamic from "next/dynamic";
import type {
  ConferenceGraphData,
  ConferenceGraphLink,
  ConferenceGraphNode,
  ConferenceNodeKind,
} from "@/lib/conferenceTypes";

type FGNode = ConferenceGraphNode & {
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
};

type FGLink = {
  source: string | FGNode;
  target: string | FGNode;
  kind: ConferenceGraphLink["kind"];
};

interface ForceGraphProps {
  width: number;
  height: number;
  graphData: { nodes: FGNode[]; links: FGLink[] };
  backgroundColor?: string;
  cooldownTicks?: number;
  d3AlphaDecay?: number;
  d3VelocityDecay?: number;
  enableNodeDrag?: boolean;
  minZoom?: number;
  maxZoom?: number;
  nodeCanvasObject?: (
    node: FGNode,
    ctx: CanvasRenderingContext2D,
    scale: number,
  ) => void;
  nodePointerAreaPaint?: (
    node: FGNode,
    color: string,
    ctx: CanvasRenderingContext2D,
  ) => void;
  onNodeHover?: (node: FGNode | null) => void;
  onNodeClick?: (node: FGNode) => void;
  onBackgroundClick?: () => void;
  linkColor?: (link: FGLink) => string;
  linkWidth?: (link: FGLink) => number;
}

interface ForceGraphInstance {
  zoomToFit: (ms?: number, px?: number) => void;
  d3Force: (name: string, force?: unknown) => unknown;
  refresh?: () => void;
}

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
}) as unknown as ComponentType<
  ForceGraphProps & RefAttributes<ForceGraphInstance>
>;

const KIND_RADIUS: Record<ConferenceNodeKind, number> = {
  event: 34,
  company: 18,
  attendee: 14,
};

function nodeRadius(node: FGNode): number {
  if (node.kind === "event") return KIND_RADIUS.event;
  if (node.kind === "company") {
    return KIND_RADIUS.company + Math.min(6, (node.weight ?? 1) * 1.5);
  }
  return KIND_RADIUS.attendee;
}

type Group = {
  key: string;
  company?: ConferenceGraphNode;
  attendees: ConferenceGraphNode[];
};

function groupAttendees(nodes: ConferenceGraphNode[]): Group[] {
  const companies = nodes.filter((n) => n.kind === "company");
  const attendees = nodes.filter((n) => n.kind === "attendee");
  const byCompany = new Map<string, ConferenceGraphNode[]>();
  const unaffiliated: ConferenceGraphNode[] = [];

  for (const attendee of attendees) {
    const company = companies.find((c) => c.label === attendee.company);
    if (company) {
      const list = byCompany.get(company.id) ?? [];
      list.push(attendee);
      byCompany.set(company.id, list);
    } else {
      unaffiliated.push(attendee);
    }
  }

  const groups: Group[] = companies.map((company) => ({
    key: company.id,
    company,
    attendees: byCompany.get(company.id) ?? [],
  }));

  const matched = unaffiliated.filter((a) => a.matchStatus === "matched");
  const unmatched = unaffiliated.filter((a) => a.matchStatus !== "matched");
  if (matched.length) {
    groups.push({ key: "unaffiliated", attendees: matched });
  }
  if (unmatched.length) {
    groups.push({ key: "unmatched", attendees: unmatched });
  }
  return groups.filter((g) => g.attendees.length > 0 || g.company);
}

/** Event at center; company wedges around it; attendees on the outer arc. */
function layoutConference(nodes: ConferenceGraphNode[]): FGNode[] {
  const event = nodes.find((n) => n.kind === "event");
  const groups = groupAttendees(nodes);
  const positions = new Map<string, { x: number; y: number }>();
  if (event) positions.set(event.id, { x: 0, y: 0 });

  const total = groups.reduce((sum, g) => sum + Math.max(g.attendees.length, 1), 0);
  const outer = Math.max(220, 70 + total * 12);
  const inner = Math.max(110, outer * 0.42);
  let cursor = -Math.PI / 2;

  for (const group of groups) {
    const span = (2 * Math.PI * Math.max(group.attendees.length, 1)) / total;
    const mid = cursor + span / 2;
    if (group.company) {
      positions.set(group.company.id, {
        x: Math.cos(mid) * inner,
        y: Math.sin(mid) * inner,
      });
    }
    const n = group.attendees.length;
    group.attendees.forEach((attendee, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const angle = cursor + span * (0.18 + t * 0.64);
      positions.set(attendee.id, {
        x: Math.cos(angle) * outer,
        y: Math.sin(angle) * outer,
      });
    });
    cursor += span;
  }

  return nodes.map((node) => {
    const pos = positions.get(node.id) ?? { x: 0, y: 320 };
    const pinned = node.kind === "event";
    return {
      ...node,
      x: pos.x,
      y: pos.y,
      fx: pinned ? pos.x : pos.x,
      fy: pinned ? pos.y : pos.y,
    };
  });
}

interface Props {
  data: ConferenceGraphData;
  className?: string;
  selectedId?: string | null;
  onSelect?: (node: ConferenceGraphNode | null) => void;
}

export default function ConferenceGraphVisualizer({
  data,
  className,
  selectedId = null,
  onSelect,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphInstance | null>(null);
  const [size, setSize] = useState({ w: 600, h: 480 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const fittedKeyRef = useRef<string>("");
  const prevSizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const prev = prevSizeRef.current;
    const dw = Math.abs(size.w - prev.w);
    const dh = Math.abs(size.h - prev.h);
    if (prev.w > 0 && (dw > 72 || dh > 72)) {
      const mobile = size.w > 0 && size.w < 640;
      fgRef.current?.zoomToFit?.(500, mobile ? 28 : 64);
    }
    prevSizeRef.current = size;
  }, [size.w, size.h]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({
        w: Math.max(200, Math.floor(width)),
        h: Math.max(200, Math.floor(height)),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const graphData = useMemo(
    () => ({
      nodes: layoutConference(data.nodes),
      links: data.links.map((l) => ({ ...l })),
    }),
    [data],
  );

  const layoutKey = useMemo(
    () => data.nodes.map((n) => n.id).join("|"),
    [data.nodes],
  );

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("charge", null);
    fg.d3Force("center", null);
    fg.d3Force("link", null);
  }, [graphData]);

  useEffect(() => {
    if (fittedKeyRef.current === layoutKey) return;
    const t = window.setTimeout(() => {
      const mobile = size.w > 0 && size.w < 640;
      fgRef.current?.zoomToFit?.(500, mobile ? 28 : 64);
      fittedKeyRef.current = layoutKey;
    }, 80);
    return () => window.clearTimeout(t);
  }, [layoutKey, size.w, size.h]);

  const paintNode = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const r = nodeRadius(node);
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const selected = selectedId === node.id;
      const hovered = hoveredId === node.id;
      const color = node.color ?? "#E11D48";
      const isEvent = node.kind === "event";
      const isCompany = node.kind === "company";

      if (selected || hovered) {
        ctx.beginPath();
        if (isEvent || isCompany) {
          const rr = r + 5;
          ctx.roundRect(x - rr, y - rr, rr * 2, rr * 2, isEvent ? 10 : 6);
        } else {
          ctx.arc(x, y, r + 5, 0, Math.PI * 2);
        }
        ctx.fillStyle = selected ? "rgba(225,29,72,0.35)" : "rgba(255,255,255,0.12)";
        ctx.fill();
      }

      ctx.save();
      ctx.beginPath();
      if (isEvent || isCompany) {
        ctx.roundRect(x - r, y - r, r * 2, r * 2, isEvent ? 10 : 5);
      } else {
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      if (isEvent || isCompany) {
        ctx.roundRect(x - r, y - r, r * 2, r * 2, isEvent ? 10 : 5);
      } else {
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.strokeStyle = isEvent
        ? "#FDA4AF"
        : isCompany
          ? "rgba(255,255,255,0.55)"
          : "rgba(255,255,255,0.4)";
      ctx.lineWidth = isEvent ? 2.5 : 1.25;
      ctx.stroke();

      if (isEvent) {
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.font = `700 ${Math.max(11, 13 / Math.sqrt(Math.max(globalScale, 0.55)))}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const words = node.label.split(" ");
        if (words.length > 1) {
          ctx.fillText(words[0], x, y - 7);
          ctx.fillText(words.slice(1).join(" "), x, y + 8);
        } else {
          ctx.fillText(node.label, x, y);
        }
        return;
      }

      const showLabel = selected || hovered || globalScale >= 0.55 || isCompany;
      if (!showLabel) return;

      const fontSize = Math.max(
        10,
        (isCompany ? 12 : 11) / Math.sqrt(Math.max(globalScale, 0.55)),
      );
      ctx.font = `${isCompany ? 600 : 500} ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const maxChars = isCompany ? 22 : 18;
      const text =
        node.label.length > maxChars
          ? `${node.label.slice(0, maxChars - 1)}…`
          : node.label;
      const metrics = ctx.measureText(text);
      const ty = y + r + 5;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(
        x - metrics.width / 2 - 4,
        ty - 1,
        metrics.width + 8,
        fontSize + 4,
      );
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fillText(text, x, ty + 2);
    },
    [hoveredId, selectedId],
  );

  const paintPointer = useCallback(
    (node: FGNode, color: string, ctx: CanvasRenderingContext2D) => {
      const r = nodeRadius(node) + 6;
      ctx.beginPath();
      if (node.kind === "event" || node.kind === "company") {
        ctx.rect((node.x ?? 0) - r, (node.y ?? 0) - r, r * 2, r * 2);
      } else {
        ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, Math.PI * 2);
      }
      ctx.fillStyle = color;
      ctx.fill();
    },
    [],
  );

  return (
    <div
      ref={wrapRef}
      className={`max-sm:touch-pan-y sm:touch-none ${className ?? "h-full w-full"}`}
    >
      {size.w > 0 && size.h > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={graphData}
          backgroundColor="rgba(0,0,0,0)"
          cooldownTicks={0}
          d3AlphaDecay={1}
          d3VelocityDecay={1}
          enableNodeDrag={false}
          minZoom={0.2}
          maxZoom={4}
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={paintPointer}
          onNodeHover={(node) => setHoveredId(node?.id ?? null)}
          onNodeClick={(node) => onSelect?.(node)}
          onBackgroundClick={() => onSelect?.(null)}
          linkColor={(link) =>
            link.kind === "company-attendee"
              ? "rgba(255,255,255,0.22)"
              : "rgba(225,29,72,0.35)"
          }
          linkWidth={() => 1.3}
        />
      )}
    </div>
  );
}
