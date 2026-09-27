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
import type { CompanyEmployee, CompanyProfile } from "@/lib/companyTypes";
import {
  buildCompanyHierarchy,
  type HierarchyNode,
} from "@/lib/companyHierarchy";
import { proxiedAvatarUrlIfFresh } from "@/lib/avatarUrl";

type FGNode = HierarchyNode & {
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
};

type FGLink = {
  source: string | FGNode;
  target: string | FGNode;
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
  linkCanvasObjectMode?: () => "replace";
  linkCanvasObject?: (link: FGLink, ctx: CanvasRenderingContext2D) => void;
  onNodeHover?: (node: FGNode | null) => void;
  onNodeClick?: (node: FGNode) => void;
  onBackgroundClick?: () => void;
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

function endNode(end: string | FGNode | undefined): FGNode | null {
  if (!end || typeof end === "string") return null;
  return end;
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function initials(label: string): string {
  const parts = label.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function drawChip(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
) {
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const metrics = ctx.measureText(text);
  const padX = 4;
  const padY = 2;
  const height = 13;
  ctx.fillStyle = "#FBF8F2";
  ctx.fillRect(x - metrics.width / 2 - padX, y - 1, metrics.width + padX * 2, height + padY);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y + 1);
}

interface Props {
  company: CompanyProfile;
  employees: CompanyEmployee[];
  className?: string;
  selectedId?: string | null;
  onSelect?: (employeeId: string | null) => void;
}

export default function CompanyHierarchyGraph({
  company,
  employees,
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
  const fittedKeyRef = useRef("");
  const prevSizeRef = useRef({ w: 0, h: 0 });

  const layout = useMemo(
    () => buildCompanyHierarchy(company, employees),
    [company, employees],
  );

  useEffect(() => {
    const prev = prevSizeRef.current;
    const dw = Math.abs(size.w - prev.w);
    const dh = Math.abs(size.h - prev.h);
    if (prev.w > 0 && (dw > 72 || dh > 72)) {
      const mobile = size.w > 0 && size.w < 640;
      fgRef.current?.zoomToFit?.(500, mobile ? 28 : 72);
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
    const urls = layout.nodes
      .map((node) => node.imageUrl)
      .filter((url): url is string => Boolean(url));
    let cancelled = false;
    let loaded = 0;

    for (const remote of urls) {
      const url = remote.startsWith("http") ? proxiedAvatarUrlIfFresh(remote) : remote;
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
          setImageRevision((revision) => revision + 1);
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
  }, [layout.nodes]);

  const graphData = useMemo(() => {
    void imageRevision;
    return {
      nodes: layout.nodes.map((node) => ({
        ...node,
        fx: node.x,
        fy: node.y,
      })),
      links: layout.links.map((link) => ({ ...link })),
    };
  }, [layout, imageRevision]);

  const layoutKey = useMemo(
    () => layout.nodes.map((node) => node.id).join("|"),
    [layout.nodes],
  );

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("charge", null);
    fg.d3Force("center", null);
    fg.d3Force("link", null);
  }, [graphData]);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const fit = () => {
      if (cancelled) return;
      attempts += 1;
      const fg = fgRef.current;
      if (!fg || size.w < 50 || size.h < 50) {
        if (attempts < 12) window.setTimeout(fit, 120);
        return;
      }
      const mobile = size.w < 640;
      fg.zoomToFit(attempts === 1 ? 0 : 400, mobile ? 32 : 96);
      fittedKeyRef.current = layoutKey;
      if (attempts < 3) window.setTimeout(fit, 280);
    };
    const timer = window.setTimeout(fit, 60);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [layoutKey, size.w, size.h]);

  const paintLink = useCallback((link: FGLink, ctx: CanvasRenderingContext2D) => {
    const source = endNode(link.source);
    const target = endNode(link.target);
    if (!source || !target) return;
    const x1 = source.x ?? 0;
    const y1 = source.y ?? 0;
    const x2 = target.x ?? 0;
    const y2 = target.y ?? 0;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(22,26,23,0.28)";
    ctx.lineWidth = 1.25;
    if (target.kind === "person" && source.kind !== "person") {
      const yFrom = y1 + (source.kind === "band" ? 14 : source.radius + 26);
      const yTo = y2 - target.radius;
      if (Math.abs(x1 - x2) < 2) {
        ctx.moveTo(x1, yFrom);
        ctx.lineTo(x2, yTo);
      } else {
        const midY = yFrom + Math.min(28, Math.max(12, (yTo - yFrom) * 0.45));
        ctx.moveTo(x1, yFrom);
        ctx.lineTo(x1, midY);
        ctx.lineTo(x2, midY);
        ctx.lineTo(x2, yTo);
      }
    } else {
      const yStart =
        source.kind === "band" && source.spanBottom != null
          ? source.spanBottom
          : y1 +
            (source.kind === "company"
              ? source.radius + 26
              : source.kind === "person"
                ? source.radius + 38
                : 14);
      const yEnd = y2 - (target.kind === "band" ? 14 : target.radius);
      if (yEnd > yStart + 4) {
        ctx.moveTo(x1, yStart);
        ctx.lineTo(x1, yEnd);
      }
    }
    ctx.stroke();
  }, []);

  const paintNode = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const selected = selectedId != null && selectedId === node.employeeId;
      const hovered = hoveredId === node.id;
      const zoomed = globalScale >= 0.7;

      if (node.kind === "band") {
        const width = node.pillWidth;
        const height = 28;
        const left = x - width / 2;
        const top = y - height / 2;
        ctx.beginPath();
        ctx.roundRect(left, top, width, height, 14);
        ctx.fillStyle = "#FBF8F2";
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = node.color;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(left + 14, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#161A17";
        ctx.fillText(node.label, left + 24, y + 0.5);
        return;
      }

      const radius = node.radius;
      const isCompany = node.kind === "company";

      if (selected || hovered) {
        ctx.beginPath();
        if (isCompany) {
          ctx.roundRect(x - radius - 5, y - radius - 5, (radius + 5) * 2, (radius + 5) * 2, 10);
        } else {
          ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
        }
        ctx.fillStyle = selected ? "rgba(15,118,110,0.22)" : "rgba(22,26,23,0.06)";
        ctx.fill();
      }

      const img = node.imageUrl ? imageCacheRef.current.get(node.imageUrl) : undefined;
      ctx.save();
      ctx.beginPath();
      if (isCompany) {
        ctx.roundRect(x - radius, y - radius, radius * 2, radius * 2, 8);
      } else {
        ctx.arc(x, y, radius, 0, Math.PI * 2);
      }
      ctx.closePath();
      ctx.clip();
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
      } else {
        ctx.fillStyle = node.color;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        ctx.fillStyle = "#FBF8F2";
        ctx.font = `600 ${isCompany ? 13 : 11}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initials(node.label), x, y + 0.5);
      }
      ctx.restore();

      ctx.beginPath();
      if (isCompany) {
        ctx.roundRect(x - radius, y - radius, radius * 2, radius * 2, 8);
      } else {
        ctx.arc(x, y, radius, 0, Math.PI * 2);
      }
      ctx.strokeStyle = selected ? "#0F766E" : isCompany ? "#0A66C2" : node.color;
      ctx.lineWidth = selected ? 2.5 : 1.5;
      ctx.stroke();

      const showDetail = isCompany || selected || hovered || zoomed;
      const name = clip(node.label, isCompany ? 24 : 22);
      drawChip(
        ctx,
        name,
        x,
        y + radius + 6,
        `600 ${isCompany ? 12 : 11}px ui-sans-serif, system-ui, sans-serif`,
        "#161A17",
      );
      if (node.subtitle) {
        drawChip(
          ctx,
          clip(node.subtitle, showDetail ? 34 : 24),
          x,
          y + radius + 22,
          "500 10px ui-sans-serif, system-ui, sans-serif",
          node.color,
        );
      }
    },
    [hoveredId, selectedId],
  );

  const paintPointer = useCallback((node: FGNode, color: string, ctx: CanvasRenderingContext2D) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    ctx.fillStyle = color;
    if (node.kind === "band") {
      ctx.beginPath();
      ctx.roundRect(x - node.pillWidth / 2, y - 16, node.pillWidth, 32, 14);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.arc(x, y, node.radius + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 40, y + node.radius, 80, 36);
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`max-sm:touch-pan-y sm:touch-none ${className ?? "h-full w-full"}`}
    >
      {size.w > 0 && size.h > 0 ? (
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
          minZoom={0.15}
          maxZoom={4}
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={paintPointer}
          linkCanvasObjectMode={() => "replace"}
          linkCanvasObject={paintLink}
          onNodeHover={(node) => setHoveredId(node?.id ?? null)}
          onNodeClick={(node) => onSelect?.(node.employeeId ?? null)}
          onBackgroundClick={() => onSelect?.(null)}
        />
      ) : null}
    </div>
  );
}
