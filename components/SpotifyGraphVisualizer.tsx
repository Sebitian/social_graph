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
  SpotifyGraphData,
  SpotifyGraphLink,
  SpotifyGraphNode,
  SpotifyNodeKind,
} from "@/lib/spotifyTypes";

type FGNode = SpotifyGraphNode & {
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
};

type FGLink = {
  source: string | FGNode;
  target: string | FGNode;
  kind: SpotifyGraphLink["kind"];
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

const KIND_RADIUS: Record<SpotifyNodeKind, number> = {
  self: 26,
  friend: 22,
  playlist: 16,
  genre: 11,
};

function nodeRadius(node: FGNode): number {
  if (node.kind === "genre") {
    const w = node.weight ?? 1;
    return KIND_RADIUS.genre + Math.min(6, Math.log2(w + 1));
  }
  return KIND_RADIUS[node.kind];
}

/**
 * Horizontal pipeline:
 *   You → your playlists → genres ← friend playlists ← friend
 */
function layoutClusters(
  nodes: SpotifyGraphNode[],
  links: SpotifyGraphLink[],
): FGNode[] {
  const self = nodes.find((n) => n.kind === "self");
  const friends = nodes.filter((n) => n.kind === "friend");
  const playlists = nodes.filter((n) => n.kind === "playlist");
  const genres = nodes.filter((n) => n.kind === "genre");

  const playlistOwnerNode = new Map<string, string>();
  for (const link of links) {
    if (link.kind !== "profile-playlist") continue;
    playlistOwnerNode.set(link.target, link.source);
  }

  const selfId = self?.id;
  const friendId = friends[0]?.id;

  const selfPlaylists = playlists.filter(
    (p) => playlistOwnerNode.get(p.id) === selfId,
  );
  const friendPlaylists = playlists.filter(
    (p) => playlistOwnerNode.get(p.id) === friendId,
  );

  // Column x positions (left → right)
  const X_SELF = -520;
  const X_SELF_PLAYLISTS = -280;
  const X_GENRES = 0;
  const X_FRIEND_PLAYLISTS = 280;
  const X_FRIEND = 520;

  const positions = new Map<string, { x: number; y: number }>();

  const stackColumn = (
    items: SpotifyGraphNode[],
    x: number,
    gap = 56,
  ) => {
    const n = items.length;
    if (n === 0) return;
    const span = (n - 1) * gap;
    items.forEach((item, i) => {
      const y = n === 1 ? 0 : -span / 2 + i * gap;
      positions.set(item.id, { x, y });
    });
  };

  if (self) positions.set(self.id, { x: X_SELF, y: 0 });
  if (friends[0]) positions.set(friends[0].id, { x: X_FRIEND, y: 0 });

  // Keep playlists with tracks closer to genres (middle of each stack).
  const sortPlaylists = (list: SpotifyGraphNode[]) =>
    [...list].sort((a, b) => {
      const at = a.hasTracks ? 0 : 1;
      const bt = b.hasTracks ? 0 : 1;
      if (at !== bt) return at - bt;
      return a.label.localeCompare(b.label);
    });

  stackColumn(sortPlaylists(selfPlaylists), X_SELF_PLAYLISTS, 58);
  stackColumn(sortPlaylists(friendPlaylists), X_FRIEND_PLAYLISTS, 72);

  const sortGenres = [...genres].sort(
    (a, b) => (b.weight ?? 0) - (a.weight ?? 0),
  );
  stackColumn(sortGenres, X_GENRES, 52);

  let orphan = 0;
  for (const n of nodes) {
    if (positions.has(n.id)) continue;
    positions.set(n.id, { x: 0, y: 320 + orphan * 40 });
    orphan += 1;
  }

  return nodes.map((n) => {
    const pos = positions.get(n.id)!;
    return { ...n, x: pos.x, y: pos.y, fx: pos.x, fy: pos.y };
  });
}

interface Props {
  data: SpotifyGraphData;
  className?: string;
  selectedId?: string | null;
  onSelect?: (node: SpotifyGraphNode | null) => void;
}

export default function SpotifyGraphVisualizer({
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
      nodes: layoutClusters(data.nodes, data.links),
      // Hide direct self↔friend edge so the eye follows the column pipeline.
      links: data.links
        .filter((l) => l.kind !== "self-friend")
        .map((l) => ({ ...l })),
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
      fgRef.current?.zoomToFit?.(500, 64);
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
      const color = node.color ?? "#1DB954";

      if (selected || hovered) {
        ctx.beginPath();
        ctx.arc(x, y, r + 5, 0, Math.PI * 2);
        ctx.fillStyle =
          selected ? "rgba(29,185,84,0.35)" : "rgba(255,255,255,0.12)";
        ctx.fill();
      }

      const img = node.imageUrl
        ? imageCacheRef.current.get(node.imageUrl)
        : undefined;

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
      } else {
        ctx.fillStyle = color;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        if (node.kind === "genre") {
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
      }
      ctx.restore();

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle =
        node.kind === "self"
          ? "#1DB954"
          : node.kind === "friend"
            ? "#509BF5"
            : node.kind === "playlist"
              ? "rgba(255,255,255,0.4)"
              : color;
      ctx.lineWidth =
        node.kind === "self" || node.kind === "friend" ? 2.5 : 1.25;
      ctx.stroke();

      const showLabel =
        node.kind === "self" ||
        node.kind === "friend" ||
        node.kind === "playlist" ||
        selected ||
        hovered ||
        globalScale >= 0.7;
      if (!showLabel) return;

      const label = node.label;
      if (!label) return;
      const fontSize = Math.max(
        10,
        (node.kind === "genre" ? 11 : 12) /
          Math.sqrt(Math.max(globalScale, 0.55)),
      );
      ctx.font = `${
        node.kind === "self" || node.kind === "friend" ? 600 : 500
      } ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      const maxChars =
        node.kind === "genre" ? 14 : node.kind === "playlist" ? 16 : 22;
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
      ctx.fillStyle =
        node.kind === "genre"
          ? "rgba(255,255,255,0.75)"
          : "rgba(255,255,255,0.95)";
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
    <div ref={wrapRef} className={className ?? "h-full w-full"}>
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
            link.kind === "self-friend"
              ? "rgba(80,155,245,0.35)"
              : link.kind === "playlist-genre"
                ? "rgba(29,185,84,0.28)"
                : "rgba(255,255,255,0.28)"
          }
          linkWidth={(link) =>
            link.kind === "self-friend"
              ? 1.5
              : link.kind === "playlist-genre"
                ? 1.1
                : 1.6
          }
        />
      )}
    </div>
  );
}
