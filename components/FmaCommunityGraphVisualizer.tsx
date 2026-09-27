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
  FmaCommunityGraph,
  FmaCommunityNode,
  FmaLinkKind,
  FmaSentiment,
} from "@/lib/aimanFmaCommunityTypes";
import {
  FMA_CREATOR_ID,
  FMA_STONE_ID,
  FMA_TUCKER_ID,
} from "@/lib/aimanFmaCommunityTypes";

type FGNode = FmaCommunityNode & {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
};

type FGLink = {
  source: string | FGNode;
  target: string | FGNode;
  kind: FmaLinkKind;
  weight?: number;
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
  enableZoomInteraction?: boolean;
  enablePanInteraction?: boolean;
  minZoom?: number;
  maxZoom?: number;
  warmupTicks?: number;
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
  onRenderFramePre?: (
    ctx: CanvasRenderingContext2D,
    scale: number,
  ) => void;
  onRenderFramePost?: (
    ctx: CanvasRenderingContext2D,
    scale: number,
  ) => void;
  linkColor?: (link: FGLink) => string;
  linkWidth?: (link: FGLink) => number;
  onEngineStop?: () => void;
}

interface ForceGraphInstance {
  zoomToFit: (ms?: number, px?: number) => void;
  zoom: (scale?: number, ms?: number) => number | unknown;
  centerAt: (x?: number, y?: number, ms?: number) => unknown;
  d3Force: (name: string, force?: unknown) => unknown;
  d3ReheatSimulation?: () => void;
  refresh?: () => void;
}

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
}) as unknown as ComponentType<
  ForceGraphProps & RefAttributes<ForceGraphInstance>
>;

function nodeRadius(node: FGNode): number {
  if (node.kind === "post") {
    const plays = node.plays ?? 0;
    return 28 + Math.min(10, Math.log10(plays + 10) * 2);
  }
  if (node.kind === "creator") return 22;
  if (node.kind === "voice") {
    return 12 + Math.min(16, Math.log1p(node.likes) * 1.6);
  }
  return 8;
}

const SENTIMENT_FILL: Record<FmaSentiment, string> = {
  positive: "#22c55e",
  neutral: "#94a3b8",
  negative: "#ef4444",
};

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  size: number,
) {
  const iw = img.naturalWidth || 1;
  const ih = img.naturalHeight || 1;
  const scale = Math.max(size / iw, size / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
}

function paintSentimentFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  sentiment: FmaSentiment,
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = SENTIMENT_FILL[sentiment];
  ctx.fill();

  const eyeY = y - r * 0.18;
  const eyeX = r * 0.28;
  const eyeR = Math.max(1.1, r * 0.09);
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(x - eyeX, eyeY, eyeR, 0, Math.PI * 2);
  ctx.arc(x + eyeX, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = Math.max(1.4, r * 0.12);
  ctx.lineCap = "round";
  ctx.beginPath();
  const mouthY = y + r * 0.28;
  const mouthW = r * 0.38;
  if (sentiment === "positive") {
    ctx.arc(x, y + r * 0.08, mouthW, 0.15 * Math.PI, 0.85 * Math.PI);
  } else if (sentiment === "negative") {
    ctx.arc(x, y + r * 0.55, mouthW, 1.15 * Math.PI, 1.85 * Math.PI);
  } else {
    ctx.moveTo(x - mouthW * 0.7, mouthY);
    ctx.lineTo(x + mouthW * 0.7, mouthY);
  }
  ctx.stroke();
}

function endpointId(end: string | FGNode): string {
  return typeof end === "string" ? end : end.id;
}

function wrapLabel(text: string, maxChars = 16, maxLines = 2): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = next;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.length > maxChars - 1 ? `${last.slice(0, maxChars - 1)}…` : `${last}…`;
  }
  return lines;
}

function homePostId(node: FmaCommunityNode): string {
  if (node.communityId === `post:${FMA_TUCKER_ID}`) return FMA_TUCKER_ID;
  if (
    node.postIds.includes(FMA_TUCKER_ID) &&
    !node.postIds.includes(FMA_STONE_ID)
  ) {
    return FMA_TUCKER_ID;
  }
  return node.postIds[0] ?? FMA_STONE_ID;
}

function closeness(node: FmaCommunityNode): number {
  return (
    Math.log1p(node.likes) * 3 +
    Math.log1p(node.mentionsIn) * 1.6 +
    Math.log1p(node.comments) * 0.5 +
    (node.kind === "voice" ? 0.9 : 0)
  );
}

function byCloseness(a: FmaCommunityNode, b: FmaCommunityNode): number {
  const d = closeness(b) - closeness(a);
  if (Math.abs(d) > 1e-6) return d;
  return b.likes - a.likes;
}

const SECTION_GAP = 140;
const PAD_TOP = 72;
const PAD_BOTTOM = 110;

function placeAroundPost(
  items: FmaCommunityNode[],
  origin: { x: number; y: number },
  positions: Map<string, { x: number; y: number }>,
  compact = false,
  maxX = Infinity,
) {
  const sorted = [...items].sort(byCloseness);
  const n = sorted.length;
  const scores = sorted.map(closeness);
  const maxS = scores[0] ?? 0;
  const minS = scores[n - 1] ?? 0;
  const placed: { x: number; y: number; r: number }[] = [];
  const maxAngle = compact ? 1.45 : 1.12;
  const gap = compact ? 28 : 42;
  const baseR = compact ? 64 : 118;
  const spreadR = compact ? 28 : 64;
  const nSpread = compact ? 16 : 32;

  const overlaps = (x: number, y: number, r: number) =>
    placed.some((p) => {
      const dx = x - p.x;
      const dy = y - p.y;
      const minD = r + p.r + gap;
      return dx * dx + dy * dy < minD * minD;
    });

  sorted.forEach((item, i) => {
    const byScore =
      maxS === minS ? i / Math.max(n - 1, 1) : (maxS - scores[i]) / (maxS - minS);
    const byRank = n <= 1 ? 0 : Math.sqrt(i / (n - 1));
    const t = byScore * 0.75 + byRank * 0.25;
    const targetR = baseR + t * (spreadR + Math.sqrt(Math.max(n, 1)) * nSpread);
    const nodeR = nodeRadius(item);
    let x = Math.min(origin.x + targetR, maxX);
    let y = origin.y;
    let found = false;
    for (let bump = 0; bump < 22 && !found; bump++) {
      const radius = targetR + bump * (compact ? 12 : 18);
      const slots = 8 + bump * 2 + Math.min(i, 6);
      for (let s = 0; s < slots; s++) {
        const sign = s % 2 === 0 ? 1 : -1;
        const step = Math.ceil(s / 2);
        const angle = sign * step * (1.05 / Math.max(Math.ceil(slots / 2), 1));
        if (Math.abs(angle) > maxAngle) continue;
        const px = origin.x + Math.cos(angle) * radius;
        const py = origin.y + Math.sin(angle) * radius;
        if (px <= origin.x + 10) continue;
        if (px > maxX) continue;
        if (!overlaps(px, py, nodeR)) {
          x = px;
          y = py;
          found = true;
          break;
        }
      }
    }
    placed.push({ x, y, r: nodeR });
    positions.set(item.id, { x: Math.max(x, origin.x + 16), y });
  });
}

function maxRadiusFor(n: number, compact = false): number {
  if (n <= 0) return compact ? 90 : 140;
  if (compact) return 64 + (28 + Math.sqrt(n) * 16) + 36;
  return 118 + (64 + Math.sqrt(n) * 32) + 56;
}

function layoutTimeline(nodes: FmaCommunityNode[], width: number) {
  const w = Math.max(320, width);
  const compact = w < 640;
  const timelineX = compact ? -w / 2 + 108 : -w / 2 + 156;
  const postX = timelineX + (compact ? 72 : 110);

  const positions = new Map<string, { x: number; y: number }>();
  const postMarks: { y: number; label: string }[] = [];

  const peopleByPost = new Map<string, FmaCommunityNode[]>();
  for (const node of nodes) {
    if (node.kind !== "voice" && node.kind !== "member") continue;
    const postId = homePostId(node);
    const list = peopleByPost.get(postId) ?? [];
    list.push(node);
    peopleByPost.set(postId, list);
  }

  positions.set(FMA_CREATOR_ID, { x: postX, y: 44 });

  let cursorY = PAD_TOP;
  for (const postId of [FMA_STONE_ID, FMA_TUCKER_ID]) {
    const people = peopleByPost.get(postId) ?? [];
    const maxR = maxRadiusFor(people.length, compact);
    const sectionH = Math.max(maxR * 2 + 48, compact ? 340 : 420);
    const postY = cursorY + sectionH / 2;
    const origin = { x: postX, y: postY };
    const postNode = nodes.find((n) => n.id === `post:${postId}`);
    positions.set(`post:${postId}`, origin);
    postMarks.push({
      y: postY,
      label: postNode?.dateLabel ?? "",
    });
    placeAroundPost(people, origin, positions, compact, w / 2 - 22);
    cursorY += sectionH + SECTION_GAP;
  }

  const height = Math.max(1100, cursorY - SECTION_GAP + PAD_BOTTOM);

  const laidOut = nodes.map((node) => {
    const pos = positions.get(node.id) ?? { x: postX, y: PAD_TOP };
    return {
      ...node,
      x: pos.x,
      y: pos.y,
      fx: pos.x,
      fy: pos.y,
    };
  });

  return { nodes: laidOut, height, timelineX, postMarks };
}

interface Props {
  data: FmaCommunityGraph;
  selectedId?: string | null;
  onSelect?: (node: FmaCommunityNode | null) => void;
  className?: string;
}

export default function FmaCommunityGraphVisualizer({
  data,
  selectedId = null,
  onSelect,
  className,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphInstance | null>(null);
  const didFitRef = useRef(false);
  const [width, setWidth] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const compact = width > 0 && width < 640;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setWidth(Math.max(200, Math.floor(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const update = () => setViewportH(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const cache = imageCacheRef.current;
    const urls = data.nodes
      .filter((n) => n.kind === "post")
      .map((n) => n.imageUrl)
      .filter((u): u is string => Boolean(u));
    let cancelled = false;
    for (const url of urls) {
      if (cache.has(url)) continue;
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (cancelled) return;
        cache.set(url, img);
        fgRef.current?.refresh?.();
      };
      img.onerror = () => {};
      img.src = url;
    }
    return () => {
      cancelled = true;
    };
  }, [data.nodes]);

  const layout = useMemo(
    () => layoutTimeline(data.nodes, width || 800),
    [data.nodes, width],
  );

  const graphData = useMemo(
    () => ({
      nodes: layout.nodes,
      links: data.links.map((l) => ({ ...l })),
    }),
    [data.links, layout.nodes],
  );

  const neighborIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const ids = new Set<string>([selectedId]);
    for (const link of data.links) {
      if (link.source === selectedId) ids.add(link.target);
      if (link.target === selectedId) ids.add(link.source);
    }
    const selected = data.nodes.find((n) => n.id === selectedId);
    if (selected?.communityId) {
      for (const node of data.nodes) {
        if (node.communityId === selected.communityId) ids.add(node.id);
      }
    }
    return ids;
  }, [data.links, data.nodes, selectedId]);

  const graphHeight = compact && viewportH > 0
    ? Math.max(420, viewportH - 96)
    : layout.height;

  const applyCamera = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("charge", null);
    fg.d3Force("center", null);
    fg.d3Force("link", null);
    fg.d3Force("collide", null);
    fg.d3Force("x", null);
    fg.d3Force("y", null);
    if (compact) {
      fg.zoomToFit(0, 20);
      return;
    }
    fg.zoom(1, 0);
    fg.centerAt(0, layout.height / 2, 0);
  }, [compact, layout.height]);

  useEffect(() => {
    didFitRef.current = false;
  }, [graphData, graphHeight, width]);

  useEffect(() => {
    let cancelled = false;
    let frames = 0;
    const apply = () => {
      if (cancelled) return;
      if (!fgRef.current) {
        if (frames++ < 30) requestAnimationFrame(apply);
        return;
      }
      didFitRef.current = true;
      applyCamera();
    };
    apply();
    return () => {
      cancelled = true;
    };
  }, [applyCamera, graphData, graphHeight, width]);

  const paintFrame = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const x = layout.timelineX;
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, layout.height - 28);
      ctx.stroke();
      for (const mark of layout.postMarks) {
        ctx.beginPath();
        ctx.arc(x, mark.y, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fill();
      }
      ctx.restore();
    },
    [layout.height, layout.postMarks, layout.timelineX],
  );

  const paintDates = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const x = layout.timelineX;
      ctx.save();
      for (const mark of layout.postMarks) {
        if (!mark.label) continue;
        ctx.font = "700 13px ui-sans-serif, system-ui";
        const textW = ctx.measureText(mark.label).width;
        const padX = 8;
        const boxW = textW + padX * 2;
        const boxH = 22;
        const boxX = x - 12 - boxW;
        const boxY = mark.y - boxH / 2;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 6);
        ctx.fillStyle = "rgba(8,8,12,0.82)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(mark.label, x - 20, mark.y);
      }
      ctx.restore();
    },
    [layout.postMarks, layout.timelineX],
  );

  const paintNode = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D, scale: number) => {
      const r = nodeRadius(node);
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const selected = selectedId === node.id;
      const hovered = hoveredId === node.id;
      const dim =
        selectedId != null && !neighborIds.has(node.id) && node.kind !== "post";
      const sentiment = node.sentiment ?? "neutral";

      ctx.save();
      ctx.globalAlpha = dim ? 0.22 : 1;

      if (selected || hovered) {
        ctx.beginPath();
        if (node.kind === "post") {
          const rr = r + 6;
          ctx.roundRect(x - rr, y - rr, rr * 2, rr * 2, 10);
        } else {
          ctx.arc(x, y, r + 5, 0, Math.PI * 2);
        }
        ctx.fillStyle = selected
          ? node.kind === "post"
            ? `${node.color}55`
            : `${SENTIMENT_FILL[sentiment]}66`
          : "rgba(255,255,255,0.12)";
        ctx.fill();
      }

      if (node.kind === "post") {
        const thumb = node.imageUrl
          ? imageCacheRef.current.get(node.imageUrl)
          : undefined;
        ctx.beginPath();
        ctx.roundRect(x - r, y - r, r * 2, r * 2, 10);
        ctx.fillStyle = node.color;
        ctx.fill();
        if (thumb && thumb.complete && thumb.naturalWidth > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(x - r, y - r, r * 2, r * 2, 10);
          ctx.clip();
          drawCover(ctx, thumb, x, y, r * 2);
          ctx.restore();
        }
        ctx.beginPath();
        ctx.roundRect(x - r, y - r, r * 2, r * 2, 10);
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 2.2;
        ctx.stroke();
      } else {
        paintSentimentFace(ctx, x, y, r, sentiment);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(15,23,42,0.35)";
        ctx.lineWidth = node.kind === "voice" ? 1.6 : 1.1;
        ctx.stroke();
      }
      ctx.restore();

      const showLabel =
        node.kind === "post" ||
        node.kind === "creator" ||
        node.kind === "voice" ||
        selected ||
        hovered;
      if (!showLabel) return;

      const fontSize = Math.max(
        9,
        (node.kind === "post" ? 12 : node.kind === "member" ? 9 : 11) /
          Math.sqrt(Math.max(scale, 0.55)),
      );
      ctx.font = `${node.kind === "member" ? 500 : 650} ${fontSize}px ui-sans-serif, system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const lines = wrapLabel(
        node.label,
        node.kind === "post" ? 20 : node.kind === "member" ? 14 : 16,
        2,
      );
      ctx.fillStyle = dim ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.92)";
      lines.forEach((line, i) => {
        ctx.fillText(line, x, y + r + 4 + i * (fontSize + 2));
      });
      if (node.kind === "post" && node.plays != null) {
        ctx.font = `500 ${Math.max(9, fontSize - 1)}px ui-sans-serif, system-ui`;
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillText(
          `${node.plays.toLocaleString("en-US")} plays`,
          x,
          y + r + 4 + lines.length * (fontSize + 2),
        );
      }
    },
    [hoveredId, layout.timelineX, neighborIds, selectedId, width],
  );

  const paintPointer = useCallback(
    (node: FGNode, color: string, ctx: CanvasRenderingContext2D) => {
      const r = nodeRadius(node) + 8;
      ctx.beginPath();
      if (node.kind === "post") {
        ctx.roundRect((node.x ?? 0) - r, (node.y ?? 0) - r, r * 2, r * 2, 10);
      } else {
        ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, Math.PI * 2);
      }
      ctx.fillStyle = color;
      ctx.fill();
    },
    [],
  );

  const linkTouches = useCallback(
    (link: FGLink, id: string | null) => {
      if (!id) return false;
      return endpointId(link.source) === id || endpointId(link.target) === id;
    },
    [],
  );

  const linkColor = useCallback(
    (link: FGLink) => {
      const hot =
        linkTouches(link, selectedId) || linkTouches(link, hoveredId);
      const dim = (selectedId || hoveredId) && !hot;
      if (link.kind === "community") {
        return hot ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.08)";
      }
      if (link.kind === "authored") {
        return dim ? "rgba(252,204,99,0.12)" : "rgba(252,204,99,0.4)";
      }
      if (link.kind === "mention") {
        return hot ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.03)";
      }
      return dim ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.16)";
    },
    [hoveredId, linkTouches, selectedId],
  );

  const linkWidth = useCallback(
    (link: FGLink) => {
      const hot =
        linkTouches(link, selectedId) || linkTouches(link, hoveredId);
      const base =
        link.kind === "community"
          ? 1.6
          : link.kind === "commented"
            ? 1.1 + Math.min(2.2, (link.weight ?? 1) * 0.15)
            : 1;
      return hot ? base + 0.8 : base;
    },
    [hoveredId, linkTouches, selectedId],
  );

  return (
    <div
      ref={wrapRef}
      className={`w-full overflow-hidden ${compact ? "touch-none" : "touch-pan-y"} ${className ?? ""}`}
      style={{ height: graphHeight }}
    >
      {width > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={width}
          height={graphHeight}
          graphData={graphData}
          backgroundColor="rgba(0,0,0,0)"
          cooldownTicks={0}
          warmupTicks={0}
          d3AlphaDecay={1}
          d3VelocityDecay={1}
          enableNodeDrag={false}
          enableZoomInteraction={compact}
          enablePanInteraction={compact}
          minZoom={compact ? 0.2 : 1}
          maxZoom={compact ? 5 : 1}
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={paintPointer}
          onRenderFramePre={paintFrame}
          onRenderFramePost={paintDates}
          onNodeHover={(node) => setHoveredId(node?.id ?? null)}
          onNodeClick={(node) => onSelect?.(node)}
          onBackgroundClick={() => onSelect?.(null)}
          linkColor={linkColor}
          linkWidth={linkWidth}
          onEngineStop={() => {
            if (didFitRef.current) return;
            didFitRef.current = true;
            applyCamera();
          }}
        />
      )}
    </div>
  );
}
