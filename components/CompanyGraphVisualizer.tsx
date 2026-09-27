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
  CompanyGraphData,
  CompanyGraphLink,
  CompanyGraphNode,
  CompanyNodeKind,
} from "@/lib/companyTypes";
import { proxiedAvatarUrlIfFresh } from "@/lib/avatarUrl";

type FGNode = CompanyGraphNode & {
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
};

type FGLink = {
  source: string | FGNode;
  target: string | FGNode;
  kind: CompanyGraphLink["kind"];
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

const KIND_RADIUS: Record<CompanyNodeKind, number> = {
  company: 32,
  employee: 18,
};

function nodeRadius(node: FGNode): number {
  if (node.kind === "company") return KIND_RADIUS.company;
  const w = node.weight ?? 10;
  return KIND_RADIUS.employee + Math.min(8, (w - 8) * 0.4);
}

/** Hub-and-spoke: company pinned at center, employees on a ring. */
function layoutHubSpoke(nodes: CompanyGraphNode[]): FGNode[] {
  const company = nodes.find((n) => n.kind === "company");
  const employees = nodes.filter((n) => n.kind === "employee");
  const positions = new Map<string, { x: number; y: number }>();

  if (company) positions.set(company.id, { x: 0, y: 0 });

  const n = employees.length;
  const radius = Math.max(180, 60 + n * 14);
  employees.forEach((emp, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    positions.set(emp.id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  });

  return nodes.map((node) => {
    const pos = positions.get(node.id) ?? { x: 0, y: 320 };
    const pinned = node.kind === "company";
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
  data: CompanyGraphData;
  className?: string;
  selectedId?: string | null;
  onSelect?: (node: CompanyGraphNode | null) => void;
}

export default function CompanyGraphVisualizer({
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

    for (const remote of urls) {
      const url = remote.startsWith("http")
        ? proxiedAvatarUrlIfFresh(remote)
        : remote;
      if (!url || cache.has(url) || cache.has(remote)) continue;
      const img = new Image();
      img.decoding = "async";
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (cancelled) return;
        cache.set(url, img);
        cache.set(remote, img);
        loaded += 1;
        if (loaded % 2 === 0 || loaded === urls.length) {
          setImageRevision((r) => r + 1);
          fgRef.current?.refresh?.();
        }
      };
      img.onerror = () => {
        cache.set(url, img);
        cache.set(remote, img);
      };
      img.src = url;
    }

    return () => {
      cancelled = true;
    };
  }, [data.nodes]);

  const graphData = useMemo(() => {
    void imageRevision;
    return {
      nodes: layoutHubSpoke(data.nodes),
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
      const color = node.color ?? "#0A66C2";
      const isCompany = node.kind === "company";

      if (selected || hovered) {
        ctx.beginPath();
        if (isCompany) {
          ctx.rect(x - r - 5, y - r - 5, (r + 5) * 2, (r + 5) * 2);
        } else {
          ctx.arc(x, y, r + 5, 0, Math.PI * 2);
        }
        ctx.fillStyle =
          selected ? "rgba(15,118,110,0.22)" : "rgba(22,26,23,0.06)";
        ctx.fill();
      }

      const img = node.imageUrl
        ? imageCacheRef.current.get(node.imageUrl)
        : undefined;

      ctx.save();
      ctx.beginPath();
      if (isCompany) {
        ctx.rect(x - r, y - r, r * 2, r * 2);
      } else {
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.closePath();
      ctx.clip();

      if (img && img.complete && img.naturalWidth > 0) {
        if (isCompany) {
          ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
        } else {
          ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
        }
      } else {
        ctx.fillStyle = color;
        if (isCompany) {
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
        } else {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      ctx.beginPath();
      if (isCompany) {
        ctx.rect(x - r, y - r, r * 2, r * 2);
      } else {
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.strokeStyle = isCompany ? "#0A66C2" : "rgba(22,26,23,0.28)";
      ctx.lineWidth = isCompany ? 2.5 : 1.25;
      ctx.stroke();

      const showLabel =
        isCompany || selected || hovered || globalScale >= 0.55;
      if (!showLabel) return;

      const label = node.label;
      if (!label) return;
      const fontSize = Math.max(
        10,
        (isCompany ? 13 : 11) / Math.sqrt(Math.max(globalScale, 0.55)),
      );
      ctx.font = `${isCompany ? 600 : 500} ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      const maxChars = isCompany ? 24 : 18;
      const text =
        label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;

      const metrics = ctx.measureText(text);
      const padX = 4;
      const padY = 2;
      const ty = y + r + 5;
      ctx.fillStyle = "#FBF8F2";
      ctx.fillRect(
        x - metrics.width / 2 - padX,
        ty - 1,
        metrics.width + padX * 2,
        fontSize + padY * 2,
      );
      ctx.strokeStyle = "#D5CDBF";
      ctx.strokeRect(
        x - metrics.width / 2 - padX,
        ty - 1,
        metrics.width + padX * 2,
        fontSize + padY * 2,
      );
      ctx.fillStyle = "#161A17";
      ctx.fillText(text, x, ty + padY);
    },
    [hoveredId, selectedId],
  );

  const paintPointer = useCallback(
    (node: FGNode, color: string, ctx: CanvasRenderingContext2D) => {
      const r = nodeRadius(node) + 6;
      ctx.beginPath();
      if (node.kind === "company") {
        ctx.rect(
          (node.x ?? 0) - r,
          (node.y ?? 0) - r,
          r * 2,
          r * 2,
        );
      } else {
        ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, Math.PI * 2);
      }
      ctx.fillStyle = color;
      ctx.fill();
    },
    [],
  );

  return (
    <div ref={wrapRef} className={`max-sm:touch-pan-y sm:touch-none ${className ?? "h-full w-full"}`}>
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
          linkColor={() => "rgba(10,102,194,0.35)"}
          linkWidth={() => 1.4}
        />
      )}
    </div>
  );
}
