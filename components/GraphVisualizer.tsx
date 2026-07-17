"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ComponentType,
  type RefAttributes,
} from "react";
import dynamic from "next/dynamic";
import type { GraphData, GraphNode, GraphLink } from "@/lib/types";
import {
  computeSocialMapLayout,
  detectFriendClusters,
  compactNumber,
  MEMBER_NODE_RADIUS,
  PROXIMITY_RINGS,
  SELF_COLOR,
  SELF_NODE_RADIUS,
  strongestTies,
  UNCLUSTERED_COLOR,
} from "@/lib/graphUtils";

type FGNode = GraphNode & {
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
};
type FGLink = {
  source: string | FGNode;
  target: string | FGNode;
  kind: GraphLink["kind"];
  weight?: number;
  inbound?: number;
  outbound?: number;
  reciprocityObserved?: boolean;
};

type AvatarState = "loading" | "loaded" | "error";
type AvatarCacheEntry = {
  image: HTMLImageElement;
  state: AvatarState;
};

interface ForceGraphProps {
  width: number;
  height: number;
  graphData: { nodes: FGNode[]; links: FGLink[] };
  backgroundColor?: string;
  cooldownTicks?: number;
  d3AlphaDecay?: number;
  minZoom?: number;
  maxZoom?: number;
  onEngineStop?: () => void;
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
  onRenderFramePre?: (ctx: CanvasRenderingContext2D, scale: number) => void;
  linkColor?: (link: FGLink) => string;
  linkWidth?: (link: FGLink) => number;
  linkCanvasObject?: (
    link: FGLink,
    ctx: CanvasRenderingContext2D,
    globalScale: number,
  ) => void;
  linkCanvasObjectMode?: string | ((link: FGLink) => string | undefined);
}

interface ForceGraphInstance {
  zoomToFit: (
    ms?: number,
    px?: number,
    filter?: (node: FGNode) => boolean,
  ) => void;
  centerAt: (x?: number, y?: number, ms?: number) => void;
  zoom: (k?: number, ms?: number) => void;
  d3Force: (name: string, force?: unknown) => unknown;
  /** Redraw canvas after async assets (avatars) load. */
  refresh?: () => void;
  d3ReheatSimulation?: () => void;
}

const ForceGraph2D = dynamic(
  () => import("react-force-graph-2d"),
  { ssr: false },
) as unknown as ComponentType<ForceGraphProps & RefAttributes<ForceGraphInstance>>;

const DEFAULT_LABEL_COUNT = 4;

function endpointId(end: string | FGNode): string {
  return typeof end === "string" ? end : (end.id as string);
}

function nodeRadius(node: FGNode): number {
  if (node.group === "self") return SELF_NODE_RADIUS;
  return MEMBER_NODE_RADIUS;
}

/** Comments they left on your posts (received). */
const RECEIVED_COLOR = "#3b82f6";
/** Comments you left on their posts (sent). */
const SENT_COLOR = "#ef4444";

/** Deterministic 0–1 hash for per-node entrance stagger. */
function hash01(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function linkEndpoints(l: FGLink): { source: FGNode; target: FGNode } | null {
  const source = l.source as FGNode;
  const target = l.target as FGNode;
  if (source.x == null || source.y == null || target.x == null || target.y == null) {
    return null;
  }
  return { source, target };
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  size: number,
) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * Math.cos(angle - 0.42), y - size * Math.sin(angle - 0.42));
  ctx.lineTo(x - size * Math.cos(angle + 0.42), y - size * Math.sin(angle + 0.42));
  ctx.closePath();
  ctx.fill();
}

function formatEdgeCount(n: number): string {
  return n >= 1000 ? compactNumber(n) : String(n);
}

function paintCommentLink(
  l: FGLink,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  opts: {
    alpha: number;
    emphasize: boolean;
  },
) {
  const ends = linkEndpoints(l);
  if (!ends) return;

  const { source, target } = ends;
  const sx = source.x!;
  const sy = source.y!;
  const tx = target.x!;
  const ty = target.y!;

  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;

  const ux = dx / len;
  const uy = dy / len;

  const sourceR = nodeRadius(source);
  const targetR = nodeRadius(target);
  const pad = 5 / globalScale;
  const lineStart = sourceR + pad;
  const lineEnd = len - targetR - pad;
  if (lineEnd <= lineStart) return;

  const received = l.inbound ?? target.comments ?? 0;
  const outboundVal =
    l.outbound ??
    target.outboundFromTarget ??
    target.features?.outboundCommentsFromTarget;
  const sentKnown = outboundVal != null;
  const sent = sentKnown ? outboundVal : 0;
  const showSent = sentKnown && sent > 0;
  const showBidirectional = sentKnown;

  const angleToTarget = Math.atan2(dy, dx);
  const angleToSource = angleToTarget + Math.PI;

  const usable = lineEnd - lineStart;
  const stubLen = Math.min(usable * 0.18, 28 / globalScale);
  const lineWidth = Math.max(1.8, (opts.emphasize ? 3 : 2.2) / globalScale);
  const arrowSize = Math.max(8, (opts.emphasize ? 11 : 9) / globalScale);
  const fontSize = Math.max(11, (opts.emphasize ? 14 : 12) / globalScale);
  const font = `700 ${fontSize}px ui-sans-serif, system-ui`;

  const sentOriginX = sx + ux * lineStart;
  const sentOriginY = sy + uy * lineStart;
  const recvOriginX = sx + ux * lineEnd;
  const recvOriginY = sy + uy * lineEnd;

  // Keep count pills away from the crowded self-node; prefer the outer third.
  const labelT = showBidirectional ? 0.55 : 0.72;
  const midX = sx + ux * (lineStart + usable * labelT);
  const midY = sy + uy * (lineStart + usable * labelT);

  ctx.save();
  ctx.globalAlpha = opts.alpha;

  // Full spoke spine — clearer when rings are spaced out
  ctx.beginPath();
  ctx.moveTo(sentOriginX, sentOriginY);
  ctx.lineTo(recvOriginX, recvOriginY);
  ctx.lineWidth = Math.max(1, (opts.emphasize ? 1.6 : 1.1) / globalScale);
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.stroke();

  // Red arrow at you → them (only when we know outbound comments exist)
  if (showSent) {
    ctx.strokeStyle = SENT_COLOR;
    ctx.fillStyle = SENT_COLOR;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    const sentTipX = sentOriginX + Math.cos(angleToTarget) * stubLen;
    const sentTipY = sentOriginY + Math.sin(angleToTarget) * stubLen;
    ctx.beginPath();
    ctx.moveTo(sentOriginX, sentOriginY);
    ctx.lineTo(sentTipX, sentTipY);
    ctx.stroke();
    drawArrowhead(ctx, sentTipX, sentTipY, angleToTarget, arrowSize);
  }

  // Blue arrow at them → you (received)
  ctx.strokeStyle = RECEIVED_COLOR;
  ctx.fillStyle = RECEIVED_COLOR;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  const recvTipX = recvOriginX + Math.cos(angleToSource) * stubLen;
  const recvTipY = recvOriginY + Math.sin(angleToSource) * stubLen;
  ctx.beginPath();
  ctx.moveTo(recvOriginX, recvOriginY);
  ctx.lineTo(recvTipX, recvTipY);
  ctx.stroke();
  drawArrowhead(ctx, recvTipX, recvTipY, angleToSource, arrowSize);

  // Skip crowded count pills on short spokes unless hovered/selected
  const minLenForPill = 110;
  if (usable < minLenForPill && !opts.emphasize) {
    ctx.restore();
    return;
  }

  ctx.font = font;
  const recvText = formatEdgeCount(received);

  if (showBidirectional) {
    const sentLabel = formatEdgeCount(sent);
    const sep = "·";
    const sentW = ctx.measureText(sentLabel).width;
    const sepW = ctx.measureText(sep).width;
    const recvW = ctx.measureText(recvText).width;
    const gap = fontSize * 0.28;
    const pillW = sentW + gap + sepW + gap + recvW + fontSize * 1.1;
    const pillH = fontSize * 1.45;
    const pillX = midX - pillW / 2;
    const pillY = midY - pillH / 2;

    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH * 0.28);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = Math.max(1.2, 1.4 / globalScale);
    ctx.stroke();

    ctx.textBaseline = "middle";
    let cursorX = pillX + fontSize * 0.55;
    ctx.textAlign = "left";
    ctx.fillStyle = SENT_COLOR;
    ctx.fillText(sentLabel, cursorX, midY);
    cursorX += sentW + gap;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText(sep, cursorX, midY);
    cursorX += sepW + gap;
    ctx.fillStyle = RECEIVED_COLOR;
    ctx.fillText(recvText, cursorX, midY);
  } else {
    // Inbound-only (e.g. LinkedIn): single blue count near the commenter
    const recvW = ctx.measureText(recvText).width;
    const pillW = recvW + fontSize * 1.05;
    const pillH = fontSize * 1.4;
    const pillX = midX - pillW / 2;
    const pillY = midY - pillH / 2;

    ctx.fillStyle = "rgba(0,0,0,0.88)";
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH * 0.28);
    ctx.fill();
    ctx.strokeStyle = "rgba(56,189,248,0.45)";
    ctx.lineWidth = Math.max(1, 1.2 / globalScale);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = RECEIVED_COLOR;
    ctx.fillText(recvText, midX, midY);
  }

  ctx.restore();
}

interface Props {
  data: GraphData;
  className?: string;
  interactive?: boolean;
  selectedId?: string | null;
  onSelect?: (node: GraphNode | null) => void;
  /**
   * auto — label self + top engagers (hover/select reveals more)
   * handles — always show @handle under every node (Instagram)
   */
  labelStyle?: "auto" | "handles";
}

export default function GraphVisualizer({
  data,
  className,
  interactive = true,
  selectedId = null,
  onSelect,
  labelStyle = "auto",
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphInstance | null>(null);
  const avatarCacheRef = useRef(new Map<string, AvatarCacheEntry>());
  /** Best avatar URL per node id (primary CDN or Unavatar fallback). */
  const avatarUrlByNodeRef = useRef(new Map<string, string>());
  const appearStartRef = useRef<number>(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [avatarRevision, setAvatarRevision] = useState(0);
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const prevLabelStyleRef = useRef(labelStyle);

  useEffect(() => {
    let cancelled = false;
    const queue: Array<() => void> = [];
    let active = 0;
    const MAX_CONCURRENT = 4;

    // When entering Instagram handle mode, drop expired CDN cache entries.
    if (
      labelStyle === "handles" &&
      prevLabelStyleRef.current !== "handles"
    ) {
      avatarCacheRef.current.clear();
      avatarUrlByNodeRef.current.clear();
    }
    prevLabelStyleRef.current = labelStyle;

    const pump = () => {
      while (!cancelled && active < MAX_CONCURRENT && queue.length > 0) {
        const next = queue.shift();
        if (next) next();
      }
    };

    const bump = () => {
      if (cancelled) return;
      setAvatarRevision((revision) => revision + 1);
    };

    for (const node of data.nodes) {
      const handle = node.label.replace(/^@/, "").trim().toLowerCase();
      const scraped = node.profilePicUrl?.trim() || undefined;
      // Instagram CDN links in old scrapes expire; resolve live avatars via our proxy.
      const liveAvatar =
        labelStyle === "handles" && handle
          ? `/api/avatar/instagram/${encodeURIComponent(handle)}`
          : undefined;
      const preferred = liveAvatar ?? scraped;
      if (!preferred) continue;

      avatarUrlByNodeRef.current.set(node.id, preferred);

      const ensureLoad = (url: string, onFail?: () => void) => {
        const existing = avatarCacheRef.current.get(url);
        if (existing) {
          if (existing.state === "loaded") {
            avatarUrlByNodeRef.current.set(node.id, url);
            bump();
          } else if (existing.state === "error" && onFail) {
            onFail();
          }
          // If still loading, the in-flight request will bump when done.
          return;
        }

        const start = () => {
          if (cancelled) return;
          active += 1;
          const image = new Image();
          image.decoding = "async";
          image.referrerPolicy = "no-referrer";
          const entry: AvatarCacheEntry = { image, state: "loading" };
          avatarCacheRef.current.set(url, entry);
          const finish = () => {
            active -= 1;
            pump();
          };
          image.onload = () => {
            entry.state = "loaded";
            avatarUrlByNodeRef.current.set(node.id, url);
            // Always bump — Strict Mode may have cancelled the effect that started
            // this request, but the image is still valid for the remounted effect.
            setAvatarRevision((revision) => revision + 1);
            finish();
          };
          image.onerror = () => {
            entry.state = "error";
            finish();
            if (onFail) onFail();
            else setAvatarRevision((revision) => revision + 1);
          };
          image.src = url;
        };

        queue.push(start);
        pump();
      };

      ensureLoad(preferred, () => {
        if (cancelled) return;
        // If the live proxy fails, try the scraped URL (may still work when fresh).
        if (!scraped || scraped === preferred) {
          bump();
          return;
        }
        avatarUrlByNodeRef.current.set(node.id, scraped);
        ensureLoad(scraped);
      });
    }

    return () => {
      cancelled = true;
      queue.length = 0;
    };
  }, [data.nodes, labelStyle]);

  // Force-graph stops painting after cooldown; refresh canvas when avatars arrive.
  useEffect(() => {
    if (avatarRevision === 0) return;
    fgRef.current?.refresh?.();
  }, [avatarRevision]);

  const members = useMemo(
    () => data.nodes.filter((n) => n.group === "member"),
    [data.nodes],
  );

  const friendClusters = useMemo(() => {
    const fromGraph = data.circles.map((c) => ({
      id: c.id,
      memberIds: members.filter((m) => m.clusterId === c.id).map((m) => m.id),
      kind: c.kind ?? ("strong" as const),
      label: c.label,
      subtitle: c.subtitle ?? "",
      color: c.color,
    }));
    return fromGraph.length ? fromGraph : detectFriendClusters(members);
  }, [data.circles, members]);

  const mapLayout = useMemo(() => {
    if (!size.width || !size.height) return null;
    return computeSocialMapLayout(members, friendClusters, size.width, size.height);
  }, [members, friendClusters, size.width, size.height]);

  const clusterColorByMember = useMemo(() => {
    const map = new Map<string, string>();
    for (const cluster of friendClusters) {
      for (const id of cluster.memberIds) map.set(id, cluster.color);
    }
    return map;
  }, [friendClusters]);

  const defaultLabelIds = useMemo(() => {
    return new Set(
      [...members]
        .sort(
          (a, b) =>
            (b.presenceScore ?? 0) - (a.presenceScore ?? 0) ||
            b.comments - a.comments,
        )
        .slice(0, DEFAULT_LABEL_COUNT)
        .map((n) => n.id),
    );
  }, [members]);

  useEffect(() => {
    if (mapLayout && appearStartRef.current === 0) {
      appearStartRef.current = performance.now();
    }
  }, [mapLayout]);

  const selectedNode = useMemo(
    () => (selectedId ? members.find((m) => m.id === selectedId) : undefined),
    [members, selectedId],
  );

  const highlightClusterId = selectedNode?.clusterId ?? null;

  const selectedTieIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    return new Set(strongestTies(selectedId, members, 3).map((t) => t.targetId));
  }, [selectedId, members]);

  const graphData = useMemo(() => {
    const nodes = data.nodes.map((n) => {
      if (n.group === "self") {
        return { ...n, x: 0, y: 0, fx: 0, fy: 0 } as FGNode;
      }
      const pos = mapLayout?.positions.get(n.id) ?? { x: 0, y: 0 };
      return { ...n, x: pos.x, y: pos.y, fx: pos.x, fy: pos.y } as FGNode;
    });

    const selfId = nodes.find((n) => n.group === "self")?.id;
    const links: FGLink[] = [];

    // Spokes: always derive counts from nodes (survives older cached graph payloads).
    if (selfId) {
      for (const member of nodes) {
        if (member.group !== "member") continue;
        links.push({
          source: selfId,
          target: member.id,
          kind: "comment",
          inbound: member.comments,
          outbound: member.outboundFromTarget,
          reciprocityObserved: member.features?.reciprocityObserved,
        });
      }
    }

    for (const l of data.links) {
      if (l.kind !== "friend") continue;
      links.push({
        source: endpointId(l.source as string | FGNode),
        target: endpointId(l.target as string | FGNode),
        kind: "friend",
        weight: l.weight,
      });
    }

    return { nodes, links };
  }, [data.nodes, data.links, mapLayout, avatarRevision]);

  const didFitRef = useRef(false);
  useEffect(() => {
    didFitRef.current = false;
  }, [data.nodes, mapLayout]);

  useEffect(() => {
    if (!selectedId || !fgRef.current || !mapLayout) return;
    const pos = mapLayout.positions.get(selectedId);
    if (!pos) return;
    setShowHint(false);

    const mobile = size.width > 0 && size.width < 640;
    if (mobile) {
      // Frame ego + selected together so you can see where they sit on the map.
      // A fixed hard zoom (desktop) feels lost on a phone.
      fgRef.current.zoomToFit(
        450,
        64,
        (node) => node.group === "self" || node.id === selectedId,
      );
      return;
    }

    fgRef.current.centerAt(pos.x, pos.y, 500);
    fgRef.current.zoom(1.85, 500);
  }, [selectedId, mapLayout, size.width]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !size.width) return;
    fg.d3Force("charge", null);
    fg.d3Force("link", null);
    fg.d3Force("center", null);
  }, [size.width, graphData]);

  const isDim = useCallback(
    (node: FGNode) => {
      if (node.group === "self") return false;
      if (!selectedId && highlightClusterId == null) return false;
      if (selectedId && node.id === selectedId) return false;
      if (selectedId && selectedTieIds.has(node.id)) return false;
      if (highlightClusterId != null && highlightClusterId >= 0) {
        return node.clusterId !== highlightClusterId;
      }
      return node.id !== selectedId;
    },
    [selectedId, highlightClusterId, selectedTieIds],
  );

  const renderBackground = useCallback(
    (ctx: CanvasRenderingContext2D, scale: number) => {
      if (!mapLayout) return;

      mapLayout.ringGuides.forEach((radius, index) => {
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.lineWidth = 1 / Math.sqrt(scale);
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.stroke();

        const ring = PROXIMITY_RINGS[index];
        if (!ring) return;
        const fontSize = Math.max(7, 9 / Math.sqrt(scale));
        ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255,255,255,0.32)";
        ctx.fillText(ring.label.toUpperCase(), 0, -radius + fontSize * 0.9);
      });

      for (const [clusterId, bounds] of mapLayout.clusterBounds.entries()) {
        const isHighlighted =
          highlightClusterId != null && highlightClusterId === clusterId;
        const dimmed = highlightClusterId != null && !isHighlighted;

        ctx.beginPath();
        ctx.arc(bounds.cx, bounds.cy, bounds.radius, 0, Math.PI * 2);
        ctx.fillStyle = isHighlighted
          ? `${bounds.color}22`
          : dimmed
            ? `${bounds.color}08`
            : `${bounds.color}14`;
        ctx.fill();
        ctx.lineWidth = 1.2 / Math.sqrt(scale);
        ctx.strokeStyle = isHighlighted
          ? `${bounds.color}88`
          : dimmed
            ? `${bounds.color}22`
            : `${bounds.color}33`;
        ctx.stroke();

        if (bounds.radius > 36 / Math.sqrt(scale) && !dimmed) {
          const fontSize = Math.max(8, 11 / Math.sqrt(scale));
          ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = isHighlighted
            ? `${bounds.color}ee`
            : `${bounds.color}aa`;
          ctx.fillText(bounds.label, bounds.cx, bounds.cy - bounds.radius - fontSize * 0.6);
        }
      }
    },
    [mapLayout, highlightClusterId],
  );

  const paintNode = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D, scale: number) => {
      if (avatarRevision < 0) return;
      const dim = isDim(node);
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const r = nodeRadius(node);
      const color =
        node.group === "self"
          ? SELF_COLOR
          : clusterColorByMember.get(node.id) ?? UNCLUSTERED_COLOR;
      const avatarUrl = avatarUrlByNodeRef.current.get(node.id) ?? node.profilePicUrl;
      const avatar = avatarUrl
        ? avatarCacheRef.current.get(avatarUrl)
        : undefined;

      const isSelected = node.id === selectedId;
      const isHovered = node.id === hovered;

      let appear = 1;
      if (node.group !== "self" && appearStartRef.current > 0) {
        const delay = hash01(node.id) * 220;
        const elapsed = performance.now() - appearStartRef.current - delay;
        appear = Math.max(0, Math.min(1, elapsed / 300));
      }

      ctx.save();
      ctx.globalAlpha = (dim ? 0.22 : 1) * appear;

      if (node.group === "self" || isHovered || isSelected) {
        ctx.shadowColor = color;
        ctx.shadowBlur = isSelected ? 22 : 14;
      }

      ctx.beginPath();
      ctx.arc(x, y, r + 1.5, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.clip();
      if (avatar?.state === "loaded") {
        ctx.drawImage(avatar.image, x - r, y - r, r * 2, r * 2);
      } else {
        ctx.fillStyle = color;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font = `${node.group === "self" ? "700" : "600"} ${Math.max(8, r * 0.78)}px ui-sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.label.charAt(0).toUpperCase(), x, y + 0.5);
      }
      ctx.restore();

      ctx.beginPath();
      ctx.arc(x, y, r + 1.5, 0, 2 * Math.PI);
      ctx.lineWidth = node.group === "self" ? 2.2 : 1.3;
      ctx.strokeStyle = node.group === "self" ? "rgba(255,255,255,0.95)" : color;
      ctx.stroke();

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, 2 * Math.PI);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.stroke();
      }

      const showLabel =
        labelStyle === "handles" ||
        node.group === "self" ||
        isHovered ||
        isSelected ||
        defaultLabelIds.has(node.id);

      if (showLabel) {
        const handle = node.label.replace(/^@/, "");
        const label =
          labelStyle === "handles"
            ? `@${handle}`
            : node.group === "self"
              ? node.fullName || `@${handle}`
              : node.fullName || node.label;
        const fontSize = Math.max(3.5, 10 / scale);
        ctx.font = `${node.group === "self" ? "700" : "500"} ${fontSize}px ui-sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillText(label, x, y + r + fontSize + 2);
      }

      ctx.restore();
    },
    [
      avatarRevision,
      hovered,
      selectedId,
      defaultLabelIds,
      isDim,
      clusterColorByMember,
      labelStyle,
    ],
  );

  const paintPointerArea = useCallback(
    (node: FGNode, color: string, ctx: CanvasRenderingContext2D) => {
      const r = nodeRadius(node) + 5;
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    [],
  );

  const linkTouchesSelection = useCallback(
    (l: FGLink) => {
      if (!selectedId) return false;
      const s = endpointId(l.source);
      const t = endpointId(l.target);
      return s === selectedId || t === selectedId;
    },
    [selectedId],
  );

  const linkTouchesHover = useCallback(
    (l: FGLink) => {
      if (!hovered) return false;
      const s = endpointId(l.source);
      const t = endpointId(l.target);
      return s === hovered || t === hovered;
    },
    [hovered],
  );

  const commentLinkStyle = useCallback(
    (l: FGLink) => {
      const emphasize = linkTouchesSelection(l) || linkTouchesHover(l);
      const dim = (selectedId != null || hovered != null) && !emphasize;
      return {
        alpha: dim ? 0.4 : emphasize ? 1 : 0.92,
        emphasize,
      };
    },
    [selectedId, hovered, linkTouchesSelection, linkTouchesHover],
  );

  const linkColor = useCallback(
    (l: FGLink) => {
      if (l.kind === "comment") return "rgba(0,0,0,0)";
      if (!selectedId) return "rgba(255,255,255,0.07)";
      return linkTouchesSelection(l) ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.04)";
    },
    [selectedId, linkTouchesSelection],
  );

  const linkWidth = useCallback(
    (l: FGLink) => {
      if (l.kind === "comment") return 0;
      if (!selectedId) return 0.4 + (l.weight ?? 0.3) * 0.6;
      return linkTouchesSelection(l) ? 0.8 + (l.weight ?? 0.3) : 0.4;
    },
    [selectedId, linkTouchesSelection],
  );

  const paintLink = useCallback(
    (l: FGLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (l.kind !== "comment") return;
      paintCommentLink(l, ctx, globalScale, commentLinkStyle(l));
    },
    [commentLinkStyle],
  );

  const linkCanvasObjectMode = useCallback(
    (l: FGLink) => (l.kind === "comment" ? "replace" : undefined),
    [],
  );

  return (
    <div ref={wrapRef} className={className}>
      {interactive && showHint && members.length > 0 && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 animate-pulse rounded-full border border-white/15 bg-black/60 px-4 py-1.5 text-[11px] font-medium text-white/70 backdrop-blur">
          Click anyone to explore their connections
        </div>
      )}

      {size.width > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={size.width}
          height={size.height}
          graphData={graphData}
          backgroundColor="rgba(0,0,0,0)"
          cooldownTicks={0}
          d3AlphaDecay={1}
          minZoom={0.35}
          maxZoom={6}
          onEngineStop={() => {
            if (didFitRef.current) {
              fgRef.current?.refresh?.();
              return;
            }
            didFitRef.current = true;
            fgRef.current?.zoomToFit(700, 120);
          }}
          onRenderFramePre={renderBackground}
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={paintPointerArea}
          onNodeHover={
            interactive
              ? (node) => {
                  if (node) setShowHint(false);
                  setHovered(node ? (node.id as string) : null);
                }
              : undefined
          }
          onNodeClick={
            interactive
              ? (node) => {
                  setShowHint(false);
                  if (node.group === "self") {
                    onSelect?.(null);
                    return;
                  }
                  onSelect?.(node);
                }
              : undefined
          }
          onBackgroundClick={
            interactive ? () => onSelect?.(null) : undefined
          }
          linkColor={linkColor}
          linkWidth={linkWidth}
          linkCanvasObject={paintLink}
          linkCanvasObjectMode={linkCanvasObjectMode}
        />
      )}
    </div>
  );
}
