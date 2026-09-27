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
  INK,
  INK_MUTED,
  PAPER_CARD,
  PAPER_LINE,
  BRAND_ROSE,
} from "@/lib/graphUtils";
import {
  proxiedAvatarUrl,
  resolveProfilePicUrl,
  type AvatarPlatform,
} from "@/lib/avatarUrl";
import { INSTAGRAM_EMPLOYEE_COLOR } from "@/lib/instagramPeople";

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
const DEFAULT_LABEL_COUNT_MOBILE = 7;

function isMobileWidth(width: number): boolean {
  return width > 0 && width < 640;
}

function visualNodeRadius(
  node: FGNode,
  mobile: boolean,
  featured = false,
): number {
  const scale = mobile ? 1.14 : 1;
  if (node.group === "self") return SELF_NODE_RADIUS * scale;
  return (MEMBER_NODE_RADIUS + (featured ? 3 : 0)) * scale;
}

function endpointId(end: string | FGNode): string {
  return typeof end === "string" ? end : (end.id as string);
}

function nodeRadius(node: FGNode): number {
  if (node.group === "self") return SELF_NODE_RADIUS;
  return MEMBER_NODE_RADIUS;
}

/** Comments they left on your posts (received). */
const RECEIVED_COLOR = "#0F766E";
/** Comments you left on their posts (sent). */
const SENT_COLOR = BRAND_ROSE;

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
  ctx.strokeStyle = "rgba(22,26,23,0.16)";
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

    ctx.fillStyle = PAPER_CARD;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH * 0.28);
    ctx.fill();
    ctx.strokeStyle = PAPER_LINE;
    ctx.lineWidth = Math.max(1.2, 1.4 / globalScale);
    ctx.stroke();

    ctx.textBaseline = "middle";
    let cursorX = pillX + fontSize * 0.55;
    ctx.textAlign = "left";
    ctx.fillStyle = SENT_COLOR;
    ctx.fillText(sentLabel, cursorX, midY);
    cursorX += sentW + gap;
    ctx.fillStyle = INK_MUTED;
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

    ctx.fillStyle = PAPER_CARD;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH * 0.28);
    ctx.fill();
    ctx.strokeStyle = PAPER_LINE;
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
  /** Drives live avatar proxies (LinkedIn / Instagram CDN links expire). */
  platform?: AvatarPlatform;
  /** Always-labeled nodes (e.g. company employees) with a distinct ring. */
  featuredIds?: readonly string[];
  /** Featured nodes that cannot be opened — drawn muted. */
  mutedFeaturedIds?: readonly string[];
  hintText?: string;
}

export default function GraphVisualizer({
  data,
  className,
  interactive = true,
  selectedId = null,
  onSelect,
  labelStyle = "auto",
  platform = null,
  featuredIds,
  mutedFeaturedIds,
  hintText,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphInstance | null>(null);
  const avatarCacheRef = useRef(new Map<string, AvatarCacheEntry>());
  /** Best avatar URL per node id (proxy or scraped). */
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

  const prevPlatformRef = useRef(platform);

  useEffect(() => {
    let cancelled = false;
    const queue: Array<() => void> = [];
    let active = 0;
    const MAX_CONCURRENT = 6;

    // Platform switch invalidates which proxy URLs we prefer.
    if (prevPlatformRef.current !== platform) {
      avatarCacheRef.current.clear();
      avatarUrlByNodeRef.current.clear();
    }
    prevPlatformRef.current = platform;

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
      const scraped = node.profilePicUrl?.trim() || undefined;
      const preferred = resolveProfilePicUrl(node.label, scraped, platform);
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
          return;
        }

        const start = () => {
          if (cancelled) return;
          active += 1;
          const image = new Image();
          image.decoding = "async";
          // Same-origin API proxies — safe for canvas drawImage.
          if (url.startsWith("/")) {
            image.crossOrigin = "anonymous";
          } else {
            image.referrerPolicy = "no-referrer";
          }
          const entry: AvatarCacheEntry = { image, state: "loading" };
          avatarCacheRef.current.set(url, entry);
          const finish = () => {
            active -= 1;
            pump();
          };
          image.onload = () => {
            entry.state = "loaded";
            avatarUrlByNodeRef.current.set(node.id, url);
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
        // Scraped CDN expired / blocked — leave initials. (LinkedIn public OG
        // lookups are unreliable; Instagram already uses a live proxy above.)
        if (!cancelled) bump();
      });
    }

    return () => {
      cancelled = true;
      queue.length = 0;
    };
  }, [data.nodes, platform]);

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

  const featuredIdSet = useMemo(() => {
    const set = new Set<string>();
    for (const id of featuredIds ?? []) set.add(id.toLowerCase());
    for (const id of mutedFeaturedIds ?? []) set.add(id.toLowerCase());
    return set;
  }, [featuredIds, mutedFeaturedIds]);

  const mutedFeaturedIdSet = useMemo(
    () => new Set((mutedFeaturedIds ?? []).map((id) => id.toLowerCase())),
    [mutedFeaturedIds],
  );

  const defaultLabelIds = useMemo(() => {
    const count = isMobileWidth(size.width)
      ? DEFAULT_LABEL_COUNT_MOBILE
      : DEFAULT_LABEL_COUNT;
    const ids = new Set(
      [...members]
        .sort(
          (a, b) =>
            (b.presenceScore ?? 0) - (a.presenceScore ?? 0) ||
            b.comments - a.comments,
        )
        .slice(0, count)
        .map((n) => n.id),
    );
    for (const member of members) {
      if (featuredIdSet.has(member.id.toLowerCase())) ids.add(member.id);
    }
    return ids;
  }, [members, size.width, featuredIdSet]);

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
  const prevSizeRef = useRef({ width: 0, height: 0 });
  useEffect(() => {
    didFitRef.current = false;
  }, [data.nodes, mapLayout]);

  useEffect(() => {
    if (!size.width || !size.height || !fgRef.current) return;
    const prev = prevSizeRef.current;
    const dw = Math.abs(size.width - prev.width);
    const dh = Math.abs(size.height - prev.height);
    if (prev.width > 0 && (dw > 72 || dh > 72)) {
      didFitRef.current = false;
      const mobile = isMobileWidth(size.width);
      fgRef.current.zoomToFit(700, mobile ? 28 : 96);
    }
    prevSizeRef.current = { width: size.width, height: size.height };
  }, [size.width, size.height]);

  useEffect(() => {
    if (!selectedId) return;
    setShowHint(false);
  }, [selectedId]);

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

      const mobile = isMobileWidth(size.width);

      mapLayout.ringGuides.forEach((radius, index) => {
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.lineWidth = (mobile ? 1.2 : 1) / Math.sqrt(scale);
        ctx.strokeStyle = mobile ? "rgba(22,26,23,0.16)" : "rgba(22,26,23,0.1)";
        ctx.stroke();

        const ring = PROXIMITY_RINGS[index];
        if (!ring) return;
        const fontSize = Math.max(mobile ? 8 : 7, (mobile ? 10 : 9) / Math.sqrt(scale));
        ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = INK_MUTED;
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
    [mapLayout, highlightClusterId, size.width, size.height],
  );

  const paintNode = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D, scale: number) => {
      if (avatarRevision < 0) return;
      const mobile = isMobileWidth(size.width);
      const featured = featuredIdSet.has(node.id.toLowerCase());
      const mutedFeatured = mutedFeaturedIdSet.has(node.id.toLowerCase());
      const dim = isDim(node) && !featured;
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const r = visualNodeRadius(node, mobile, featured);
      const color =
        node.group === "self"
          ? SELF_COLOR
          : featured
            ? INSTAGRAM_EMPLOYEE_COLOR
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
      ctx.globalAlpha =
        (mutedFeatured ? 0.62 : dim ? (mobile ? 0.4 : 0.22) : 1) * appear;

      if (node.group === "self" || isHovered || isSelected) {
        ctx.shadowColor = color;
        ctx.shadowBlur = isSelected ? (mobile ? 26 : 22) : mobile ? 18 : 14;
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
      ctx.strokeStyle = node.group === "self" ? SELF_COLOR : color;
      ctx.stroke();

      if (featured) {
        ctx.beginPath();
        ctx.arc(x, y, r + 4.5, 0, 2 * Math.PI);
        ctx.lineWidth = 2;
        ctx.setLineDash(mutedFeatured ? [3 / scale, 2.5 / scale] : []);
        ctx.strokeStyle = INSTAGRAM_EMPLOYEE_COLOR;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, r + (featured ? 7 : 4), 0, 2 * Math.PI);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = SELF_COLOR;
        ctx.stroke();
      }

      const showLabel =
        featured ||
        labelStyle === "handles" ||
        node.group === "self" ||
        isHovered ||
        isSelected ||
        defaultLabelIds.has(node.id);

      if (showLabel) {
        const handle = node.label.replace(/^@/, "");
        const label =
          featured
            ? node.fullName || node.label
            : labelStyle === "handles"
              ? `@${handle}`
              : node.group === "self"
                ? node.fullName || `@${handle}`
                : node.fullName || node.label;
        const fontSize = Math.max(
          mobile ? 4.5 : 3.5,
          (mobile ? 12 : 10) / scale,
        );
        ctx.font = `${node.group === "self" || featured ? "700" : "500"} ${fontSize}px ui-sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = INK;
        if (mobile || scale > 0.85) {
          ctx.shadowColor = "rgba(243,238,228,0.95)";
          ctx.shadowBlur = 4 / scale;
        }
        ctx.fillText(label, x, y + r + fontSize + 2);
        if (featured) {
          const caption = mutedFeatured ? "No graph" : "Employee";
          const captionSize = Math.max(mobile ? 3.5 : 3, (mobile ? 9 : 8) / scale);
          ctx.font = `500 ${captionSize}px ui-sans-serif, system-ui`;
          ctx.fillStyle = mutedFeatured
            ? INK_MUTED
            : INSTAGRAM_EMPLOYEE_COLOR;
          ctx.fillText(caption, x, y + r + fontSize + captionSize + 5);
        }
        ctx.shadowBlur = 0;
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
      featuredIdSet,
      mutedFeaturedIdSet,
      labelStyle,
      size.width,
    ],
  );

  const paintPointerArea = useCallback(
    (node: FGNode, color: string, ctx: CanvasRenderingContext2D) => {
      const mobile = isMobileWidth(size.width);
      const featured = featuredIdSet.has(node.id.toLowerCase());
      const r = visualNodeRadius(node, mobile, featured) + (mobile ? 8 : 5);
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    [size.width, featuredIdSet],
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
      if (!selectedId) return "rgba(22,26,23,0.18)";
      return linkTouchesSelection(l) ? "rgba(15,118,110,0.7)" : "rgba(22,26,23,0.08)";
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
    <div ref={wrapRef} className={`max-sm:touch-pan-y sm:touch-none ${className}`}>
      {interactive && showHint && members.length > 0 && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 max-w-[90%] -translate-x-1/2 animate-pulse rounded-full border border-[#D5CDBF] bg-[#FBF8F2] px-3.5 py-1.5 text-center text-[11px] font-medium text-[#5E665F] sm:bottom-6 sm:max-w-none sm:px-4">
          {hintText ?? "Tap anyone to explore their connections"}
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
          minZoom={isMobileWidth(size.width) ? 0.45 : 0.35}
          maxZoom={6}
          onEngineStop={() => {
            if (didFitRef.current) {
              fgRef.current?.refresh?.();
              return;
            }
            didFitRef.current = true;
            const mobile = isMobileWidth(size.width);
            fgRef.current?.zoomToFit(700, mobile ? 28 : 96);
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
