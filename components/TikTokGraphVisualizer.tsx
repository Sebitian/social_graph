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
  TikTokGraphData,
  TikTokGraphLink,
  TikTokGraphNode,
  TikTokNodeKind,
} from "@/lib/tiktokTypes";

type FGNode = TikTokGraphNode & {
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
};

type FGLink = {
  source: string | FGNode;
  target: string | FGNode;
  kind: TikTokGraphLink["kind"];
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

const KIND_RADIUS: Record<TikTokNodeKind, number> = {
  self: 28,
  video: 16,
  hashtag: 11,
};

function nodeRadius(node: FGNode): number {
  if (node.kind === "video") {
    const plays = node.playCount ?? 0;
    return KIND_RADIUS.video + Math.min(8, Math.log10(plays + 10));
  }
  if (node.kind === "hashtag") {
    return KIND_RADIUS.hashtag + Math.min(5, (node.weight ?? 1) * 0.6);
  }
  return KIND_RADIUS.self;
}

/**
 * Horizontal pipeline:
 *   You → videos → hashtags
 */
function layoutPipeline(nodes: TikTokGraphNode[]): FGNode[] {
  const self = nodes.find((n) => n.kind === "self");
  const videos = nodes.filter((n) => n.kind === "video");
  const hashtags = nodes.filter((n) => n.kind === "hashtag");

  const X_SELF = -360;
  const X_VIDEOS = -40;
  const X_TAGS = 320;

  const positions = new Map<string, { x: number; y: number }>();

  const stackColumn = (items: TikTokGraphNode[], x: number, gap = 52) => {
    const n = items.length;
    if (n === 0) return;
    const span = (n - 1) * gap;
    items.forEach((item, i) => {
      const y = n === 1 ? 0 : -span / 2 + i * gap;
      positions.set(item.id, { x, y });
    });
  };

  if (self) positions.set(self.id, { x: X_SELF, y: 0 });

  const sortedVideos = [...videos].sort(
    (a, b) => (b.playCount ?? 0) - (a.playCount ?? 0),
  );
  stackColumn(sortedVideos, X_VIDEOS, videos.length > 16 ? 40 : 52);

  const sortedTags = [...hashtags].sort(
    (a, b) => (b.weight ?? 0) - (a.weight ?? 0),
  );
  stackColumn(sortedTags, X_TAGS, 48);

  return nodes.map((node) => {
    const pos = positions.get(node.id) ?? { x: 0, y: 0 };
    return {
      ...node,
      x: pos.x,
      y: pos.y,
      fx: pos.x,
      fy: pos.y,
    };
  });
}

interface Props {
  data: TikTokGraphData;
  className?: string;
  selectedId?: string | null;
  onSelect?: (node: TikTokGraphNode | null) => void;
}

export default function TikTokGraphVisualizer({
  data,
  className,
  selectedId = null,
  onSelect,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphInstance | null>(null);
  const [size, setSize] = useState({ w: 600, h: 480 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [imageRevision, setImageRevision] = useState(0);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
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

  useEffect(() => {
    const cache = imageCacheRef.current;
    const urls = data.nodes
      .map((n) => n.imageUrl)
      .filter((u): u is string => Boolean(u));

    let cancelled = false;
    let loaded = 0;

    for (const url of urls) {
      if (cache.has(url)) continue;
      const img = new Image();
      img.decoding = "async";
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (cancelled) return;
        cache.set(url, img);
        loaded += 1;
        if (loaded % 2 === 0 || loaded === urls.length) {
          setImageRevision((r) => r + 1);
          fgRef.current?.refresh?.();
        }
      };
      img.onerror = () => {};
      img.src = url;
    }

    return () => {
      cancelled = true;
    };
  }, [data.nodes]);

  const graphData = useMemo(() => {
    void imageRevision;
    return {
      nodes: layoutPipeline(data.nodes),
      links: data.links.map((l) => ({ ...l })),
    };
  }, [data, imageRevision]);

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
      const color = node.color ?? "#FE2C55";
      const isSelf = node.kind === "self";
      const isTag = node.kind === "hashtag";

      if (selected || hovered) {
        ctx.beginPath();
        ctx.arc(x, y, r + 5, 0, Math.PI * 2);
        ctx.fillStyle =
          selected ? "rgba(254,44,85,0.35)" : "rgba(255,255,255,0.12)";
        ctx.fill();
      }

      const img = node.imageUrl
        ? imageCacheRef.current.get(node.imageUrl)
        : undefined;

      ctx.save();
      ctx.beginPath();
      if (isTag) {
        // Soft rounded square for hashtags
        const s = r;
        ctx.roundRect(x - s, y - s, s * 2, s * 2, 4);
      } else {
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.closePath();
      ctx.clip();

      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
      } else {
        ctx.fillStyle = color;
        if (isTag) {
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
        } else {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      ctx.beginPath();
      if (isTag) {
        ctx.roundRect(x - r, y - r, r * 2, r * 2, 4);
      } else {
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.strokeStyle = isSelf
        ? "#FE2C55"
        : isTag
          ? "rgba(255,255,255,0.35)"
          : "#25F4EE";
      ctx.lineWidth = isSelf ? 2.5 : 1.25;
      ctx.stroke();

      const showLabel =
        isSelf || isTag || selected || hovered || globalScale >= 0.5;
      if (!showLabel) return;

      const label = node.label;
      if (!label) return;
      const fontSize = Math.max(
        10,
        (isSelf ? 13 : 11) / Math.sqrt(Math.max(globalScale, 0.55)),
      );
      ctx.font = `${isSelf ? 600 : 500} ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      const maxChars = isSelf ? 22 : isTag ? 16 : 20;
      const text =
        label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;

      const metrics = ctx.measureText(text);
      const padX = 4;
      const padY = 2;
      const ty = y + r + 5;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(
        x - metrics.width / 2 - padX,
        ty - 1,
        metrics.width + padX * 2,
        fontSize + padY * 2,
      );
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fillText(text, x, ty + padY);
    },
    [hoveredId, selectedId],
  );

  const paintPointer = useCallback(
    (node: FGNode, color: string, ctx: CanvasRenderingContext2D) => {
      const r = nodeRadius(node) + 6;
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, Math.PI * 2);
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
            link.kind === "self-video"
              ? "rgba(37,244,238,0.35)"
              : "rgba(254,44,85,0.28)"
          }
          linkWidth={(link) => (link.kind === "self-video" ? 1.6 : 1.1)}
        />
      )}
    </div>
  );
}
