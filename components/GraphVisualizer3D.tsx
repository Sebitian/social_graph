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
import * as THREE from "three";
import SpriteText from "three-spritetext";
import type { GraphData, GraphNode } from "@/lib/types";
import { INK, INK_MUTED, PAPER, PAPER_CARD, SELF_COLOR, UNCLUSTERED_COLOR } from "@/lib/graphUtils";
import { resolveProfilePicUrl, type AvatarPlatform } from "@/lib/avatarUrl";

type FGNode = GraphNode & {
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
};

type FGLink = {
  source: string | FGNode;
  target: string | FGNode;
};

type AvatarState = "loading" | "loaded" | "error";
type AvatarCacheEntry = {
  image: HTMLImageElement;
  state: AvatarState;
};

type NodeVisual = {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  halo: THREE.Sprite;
  count: SpriteText | null;
};

interface ForceGraphProps {
  width: number;
  height: number;
  graphData: { nodes: FGNode[]; links: FGLink[] };
  backgroundColor?: string;
  showNavInfo?: boolean;
  controlType?: "trackball" | "orbit" | "fly";
  rendererConfig?: { antialias?: boolean; alpha?: boolean };
  cooldownTime?: number;
  cooldownTicks?: number;
  warmupTicks?: number;
  d3AlphaDecay?: number;
  enableNodeDrag?: boolean;
  showPointerCursor?: boolean;
  linkOpacity?: number;
  nodeLabel?: (node: FGNode) => string;
  nodeThreeObject?: (node: FGNode) => THREE.Object3D;
  nodeThreeObjectExtend?: boolean;
  linkColor?: (link: FGLink) => string;
  linkWidth?: (link: FGLink) => number;
  onEngineStop?: () => void;
  onNodeHover?: (node: FGNode | null) => void;
  onNodeClick?: (node: FGNode) => void;
  onNodeDragEnd?: (node: FGNode) => void;
  onBackgroundClick?: () => void;
}

interface ForceGraphInstance {
  cameraPosition: (
    position: { x?: number; y?: number; z?: number },
    lookAt?: { x: number; y: number; z: number },
    transitionMs?: number,
  ) => void;
  zoomToFit: (durationMs?: number, padding?: number) => void;
  d3Force: (name: string, force?: unknown) => unknown;
  refresh: () => void;
}

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
}) as unknown as ComponentType<ForceGraphProps & RefAttributes<ForceGraphInstance>>;

const FOCUS_DISTANCE = 36;

/** Portrait phones make the same camera distance fill the screen with one face. */
function isNarrowGraph(width: number, height: number): boolean {
  return width > 0 && (width < 640 || height > width);
}

interface Props {
  data: GraphData;
  className?: string;
  interactive?: boolean;
  selectedId?: string | null;
  onSelect?: (node: GraphNode | null) => void;
  labelStyle?: "auto" | "handles";
  platform?: AvatarPlatform;
  featuredIds?: readonly string[];
  mutedFeaturedIds?: readonly string[];
  hintText?: string;
}

function endpointId(end: string | FGNode): string {
  return typeof end === "string" ? end : (end.id as string);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Even spread on a sphere so portraits start separated, then the force layout relaxes them. */
function spherePoint(index: number, count: number, radius: number) {
  if (count <= 1) return { x: radius, y: 0, z: 0 };
  const y = 1 - (index / (count - 1)) * 2;
  const ring = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = Math.PI * (3 - Math.sqrt(5)) * index;
  return {
    x: Math.cos(theta) * ring * radius,
    y: y * radius,
    z: Math.sin(theta) * ring * radius,
  };
}

function makeCircleTexture(
  image: HTMLImageElement | null,
  color: string,
  initial: string,
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (!ctx) return texture;

  const center = size / 2;
  const radius = center - 10;
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(center, center, radius + 7, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.clip();
  if (image && image.naturalWidth > 0) {
    ctx.drawImage(image, center - radius, center - radius, radius * 2, radius * 2);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = `700 ${Math.round(radius * 0.85)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initial.slice(0, 1).toUpperCase(), center, center + 2);
  }
  ctx.restore();
  texture.needsUpdate = true;
  return texture;
}

function makeHaloTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (!ctx) return texture;
  ctx.strokeStyle = SELF_COLOR;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 108, 0, Math.PI * 2);
  ctx.stroke();
  texture.needsUpdate = true;
  return texture;
}

function hoverHtml(node: FGNode): string {
  const name = escapeHtml(node.fullName || node.label);
  const handle = escapeHtml(node.label.replace(/^@/, ""));
  if (node.group === "self") {
    return `<div style="font:600 13px ui-sans-serif,system-ui;color:${INK}">${name}</div>`;
  }
  const role = node.position
    ? `<div style="margin-top:2px;color:${INK_MUTED}">${escapeHtml(node.position)}</div>`
    : "";
  const comments = `${node.comments} comment${node.comments === 1 ? "" : "s"}`;
  return `<div style="font:13px ui-sans-serif,system-ui;line-height:1.35;color:${INK}">
    <div style="font-weight:650">${name}</div>
    <div style="color:${INK_MUTED}">@${handle}</div>
    ${role}
    <div style="margin-top:4px;font-weight:650;color:#0F766E">${comments}</div>
  </div>`;
}

export default function GraphVisualizer3D({
  data,
  className,
  interactive = true,
  selectedId = null,
  onSelect,
  platform = null,
  hintText,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphInstance | null>(null);
  const visualsRef = useRef(new Map<string, NodeVisual>());
  const avatarCacheRef = useRef(new Map<string, AvatarCacheEntry>());
  const avatarUrlByNodeRef = useRef(new Map<string, string>());
  const haloTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const didFitRef = useRef(false);
  const focusedRef = useRef(false);
  const sizeRef = useRef({ width: 0, height: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [avatarRevision, setAvatarRevision] = useState(0);
  const [showHint, setShowHint] = useState(true);

  const bindGraph = useCallback((instance: ForceGraphInstance | null) => {
    fgRef.current = instance;
    setReady(Boolean(instance));
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const clusterColor = useMemo(() => {
    const map = new Map<number, string>();
    for (const circle of data.circles) map.set(circle.id, circle.color);
    return map;
  }, [data.circles]);

  const commenters = useMemo(
    () => data.nodes.filter((node) => node.group === "member" && node.comments > 0),
    [data.nodes],
  );

  const graphData = useMemo(() => {
    const self = data.nodes.find((node) => node.group === "self");
    const nodes: FGNode[] = [];
    if (self) {
      nodes.push({ ...self, x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 0 });
    }
    commenters.forEach((node, index) => {
      const point = spherePoint(index, commenters.length, 86);
      nodes.push({
        ...node,
        ...point,
        fx: point.x,
        fy: point.y,
        fz: point.z,
      });
    });
    const selfId = self?.id;
    const links: FGLink[] = selfId
      ? commenters.map((node) => ({ source: selfId, target: node.id }))
      : [];
    return { nodes, links };
  }, [commenters, data.nodes]);

  const colorFor = useCallback(
    (node: FGNode) => {
      if (node.group === "self") return SELF_COLOR;
      if (node.clusterId == null || node.clusterId < 0) return UNCLUSTERED_COLOR;
      return clusterColor.get(node.clusterId) ?? UNCLUSTERED_COLOR;
    },
    [clusterColor],
  );
  const colorForRef = useRef(colorFor);
  colorForRef.current = colorFor;

  const focusId = hovered ?? selectedId;

  useEffect(() => {
    didFitRef.current = false;
  }, [graphData]);

  const prevPlatformRef = useRef(platform);
  useEffect(() => {
    let cancelled = false;
    const queue: Array<() => void> = [];
    let active = 0;

    if (prevPlatformRef.current !== platform) {
      avatarCacheRef.current.clear();
      avatarUrlByNodeRef.current.clear();
    }
    prevPlatformRef.current = platform;

    const pump = () => {
      while (!cancelled && active < 6 && queue.length > 0) queue.shift()?.();
    };

    for (const node of graphData.nodes) {
      const preferred = resolveProfilePicUrl(
        node.label,
        node.profilePicUrl?.trim() || undefined,
        platform,
      );
      if (!preferred) continue;
      avatarUrlByNodeRef.current.set(node.id, preferred);
      if (avatarCacheRef.current.get(preferred)?.state === "loaded") {
        setAvatarRevision((revision) => revision + 1);
        continue;
      }
      if (avatarCacheRef.current.has(preferred)) continue;

      queue.push(() => {
        if (cancelled) return;
        active += 1;
        const image = new Image();
        image.decoding = "async";
        if (preferred.startsWith("/")) image.crossOrigin = "anonymous";
        else image.referrerPolicy = "no-referrer";
        const entry: AvatarCacheEntry = { image, state: "loading" };
        avatarCacheRef.current.set(preferred, entry);
        const finish = () => {
          active -= 1;
          pump();
        };
        image.onload = () => {
          entry.state = "loaded";
          // Paint onto the sprite already in the scene. refresh() rebuilds every
          // node and disposes THREE.Sprite's shared geometry, which then throws
          // "reading 'x'" on the next frame.
          if (!cancelled) setAvatarRevision((revision) => revision + 1);
          finish();
        };
        image.onerror = () => {
          entry.state = "error";
          finish();
        };
        image.src = preferred;
      });
      pump();
    }

    return () => {
      cancelled = true;
      queue.length = 0;
    };
  }, [graphData.nodes, platform]);

  const textureFor = useCallback((node: FGNode) => {
    const url = avatarUrlByNodeRef.current.get(node.id);
    const avatar = url ? avatarCacheRef.current.get(url) : undefined;
    const image = avatar?.state === "loaded" ? avatar.image : null;
    return makeCircleTexture(image, colorForRef.current(node), node.label || "?");
  }, []);

  const applyAppearance = useCallback(() => {
    const selfId = graphData.nodes.find((node) => node.group === "self")?.id;
    for (const [id, visual] of visualsRef.current) {
      const hot = focusId != null && id === focusId;
      const dim = focusId != null && id !== focusId && id !== selfId;
      visual.material.opacity = dim ? 0.22 : 1;
      if (visual.count) visual.count.material.opacity = dim ? 0.2 : 1;
      visual.halo.visible = hot;
    }
  }, [focusId, graphData.nodes]);

  useEffect(() => {
    applyAppearance();
  }, [applyAppearance, ready, avatarRevision]);

  useEffect(() => {
    for (const node of graphData.nodes) {
      const visual = visualsRef.current.get(node.id);
      if (!visual) continue;
      const next = textureFor(node);
      const previous = visual.material.map;
      visual.material.map = next;
      visual.material.needsUpdate = true;
      if (previous && previous !== next) previous.dispose();
    }
  }, [avatarRevision, graphData.nodes, textureFor]);

  const nodeThreeObject = useCallback(
    (node: FGNode) => {
      const group = new THREE.Group();
      const scale = node.group === "self" ? 26 : 18;
      const material = new THREE.SpriteMaterial({
        map: textureFor(node),
        transparent: true,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(scale, scale, 1);
      sprite.renderOrder = 2;

      if (!haloTextureRef.current) haloTextureRef.current = makeHaloTexture();
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: haloTextureRef.current,
          transparent: true,
          depthWrite: false,
        }),
      );
      halo.scale.set(scale * 1.35, scale * 1.35, 1);
      halo.visible = false;
      halo.renderOrder = 1;
      group.add(halo);
      group.add(sprite);

      let count: SpriteText | null = null;
      if (node.group !== "self") {
        count = new SpriteText(String(node.comments));
        count.color = INK;
        count.textHeight = 5;
        count.fontWeight = "700";
        count.backgroundColor = PAPER_CARD;
        count.padding = 1.4;
        count.borderRadius = 3;
        count.material.depthWrite = false;
        count.position.set(0, -(scale / 2 + 2.4), 0);
        group.add(count);
      }

      const previous = visualsRef.current.get(node.id);
      previous?.material.map?.dispose();
      previous?.material.dispose();
      visualsRef.current.set(node.id, { sprite, material, halo, count });
      return group;
    },
    [textureFor],
  );

  const frameGraph = useCallback((ms: number, padding: number) => {
    const graph = fgRef.current;
    if (!graph) return;
    // zoomToFit cannot leave the origin: the fit direction is the current camera vector.
    graph.cameraPosition({ x: 0, y: 0, z: 320 }, { x: 0, y: 0, z: 0 }, 0);
    graph.zoomToFit(ms, padding);
  }, []);

  useEffect(() => {
    const graph = fgRef.current;
    if (!graph || !ready) return;
    const charge = graph.d3Force("charge") as { strength?: (value: number) => void } | undefined;
    charge?.strength?.(-40);
    const frame = window.setTimeout(() => {
      const { width, height } = sizeRef.current;
      frameGraph(600, isNarrowGraph(width, height) ? 24 : 48);
    }, 250);
    return () => window.clearTimeout(frame);
  }, [frameGraph, ready, graphData]);

  sizeRef.current = size;

  const focusNode = useCallback((node: FGNode) => {
    const graph = fgRef.current;
    const { width, height } = sizeRef.current;
    if (!graph || isNarrowGraph(width, height)) return;
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const z = node.z ?? 0;
    const hypot = Math.hypot(x, y, z);
    const distRatio = 1 + FOCUS_DISTANCE / (hypot || FOCUS_DISTANCE);
    graph.cameraPosition(
      x || y || z
        ? { x: x * distRatio, y: y * distRatio, z: z * distRatio }
        : { x: 0, y: 0, z: FOCUS_DISTANCE },
      { x, y, z },
      900,
    );
  }, []);

  useEffect(() => {
    const graph = fgRef.current;
    if (!graph || !ready) return;
    const narrow = isNarrowGraph(size.width, size.height);
    const node = selectedId
      ? graphData.nodes.find((item) => item.id === selectedId)
      : undefined;
    const canFocus = Boolean(node && node.group !== "self" && !narrow);
    if (!canFocus) {
      if (!focusedRef.current) return;
      focusedRef.current = false;
      frameGraph(650, narrow ? 24 : 72);
      return;
    }
    focusedRef.current = true;
    focusNode(node as FGNode);
  }, [focusNode, frameGraph, graphData.nodes, ready, selectedId, size.height, size.width]);

  useEffect(() => {
    return () => {
      for (const visual of visualsRef.current.values()) {
        visual.material.map?.dispose();
        visual.material.dispose();
        visual.halo.material.dispose();
      }
      visualsRef.current.clear();
      haloTextureRef.current?.dispose();
    };
  }, []);

  const selfId = graphData.nodes.find((node) => node.group === "self")?.id;

  return (
    <div ref={wrapRef} className={`touch-none ${className ?? ""}`}>
      <div className="pointer-events-none absolute bottom-4 left-3 z-10 rounded-full border border-[#D5CDBF] bg-[#FBF8F2] px-3 py-1 text-[11px] font-medium text-[#5E665F]">
        {commenters.length} {commenters.length === 1 ? "person" : "people"} commented
      </div>
      {interactive && showHint && commenters.length > 0 && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 max-w-[92%] -translate-x-1/2 rounded-full border border-[#D5CDBF] bg-[#FBF8F2] px-3.5 py-1.5 text-center text-[11px] font-medium text-[#5E665F]">
          {hintText ?? "Hover for a name · click to read their comments"}
        </div>
      )}
      {size.width > 0 && commenters.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-[#5E665F]">
          Nobody in this snapshot left a comment.
        </div>
      )}
      {size.width > 0 && commenters.length > 0 && (
        <ForceGraph3D
          ref={bindGraph}
          width={size.width}
          height={size.height}
          graphData={graphData}
          backgroundColor={PAPER}
          showNavInfo={false}
          controlType="orbit"
          rendererConfig={{ antialias: true, alpha: false }}
          cooldownTicks={0}
          warmupTicks={0}
          enableNodeDrag={false}
          showPointerCursor={interactive}
          linkOpacity={0.7}
          nodeLabel={hoverHtml}
          nodeThreeObject={nodeThreeObject}
          nodeThreeObjectExtend={false}
          linkColor={(link) => {
            const source = endpointId(link.source);
            const target = endpointId(link.target);
            const hot = focusId != null && (source === focusId || target === focusId);
            if (hot) return "rgba(15,118,110,0.85)";
            if (focusId) return "rgba(22,26,23,0.08)";
            return "rgba(22,26,23,0.22)";
          }}
          linkWidth={(link) => {
            const source = endpointId(link.source);
            const target = endpointId(link.target);
            const hot = focusId != null && (source === focusId || target === focusId);
            return hot ? 1.3 : 0.35;
          }}
          onEngineStop={() => {
            if (didFitRef.current) return;
            didFitRef.current = true;
            const narrow = isNarrowGraph(size.width, size.height);
            frameGraph(800, narrow ? 24 : 80);
          }}
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
                  if (node.group === "self" || node.id === selfId) {
                    onSelect?.(null);
                    return;
                  }
                  onSelect?.(node);
                }
              : undefined
          }
          onNodeDragEnd={
            interactive
              ? (node) => {
                  if (node.group === "self") return;
                  node.fx = node.x;
                  node.fy = node.y;
                  node.fz = node.z;
                }
              : undefined
          }
          onBackgroundClick={
            interactive
              ? () => {
                  onSelect?.(null);
                  if (isNarrowGraph(size.width, size.height)) {
                    frameGraph(650, 24);
                  }
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
