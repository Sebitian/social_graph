"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import BrandMark from "@/components/BrandMark";

/**
 * Hero flock, then a scroll-scrubbed murmuration.
 * Birds gather into labeled circles, stack into layers, then
 * come back together in the center. The logo pops up there.
 * One purple bird shines. That one is us.
 */

type Tint = "ink" | "teal" | "amber";

const LAYERS = ["Family", "Friends", "Colleagues", "Acquaintances"] as const;
const PURPLE = "#7C3AED";

const GROUPS: { name: string; tint: Tint }[] = [
  { name: "Comments", tint: "ink" },
  { name: "Reactions", tint: "teal" },
  { name: "Shared posts", tint: "ink" },
  { name: "Followers", tint: "teal" },
  { name: "You", tint: "amber" },
];

const INK = "#161A17";
const TEAL = "#0F766E";
const AMBER = "#C4842A";

type Bird = {
  group: number;
  phase: number;
  depth: number;
  along: number;
  speed: number;
  homeX: number;
  homeY: number;
  heading: number;
  radius: number;
  size: number;
  alpha: number;
  self: boolean;
  band: number;
  x: number;
  y: number;
};

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blob(x: number, y: number, cx: number, cy: number, sx: number, sy: number) {
  const dx = (x - cx) / sx;
  const dy = (y - cy) / sy;
  return Math.exp(-0.5 * (dx * dx + dy * dy));
}

/** How thick the hero flock is. x and y run 0–1, origin top-left. */
function density(x: number, y: number) {
  if (y < -0.02 || y > 1.04) return 0;
  const left = 0.5 + y * 0.28;
  if (x < left) return 0;
  const fade = Math.min(1, (x - left) / 0.1);
  const mass =
    blob(x, y, 1.02, 0.02, 0.2, 0.16) * 1.35 +
    blob(x, y, 1.04, 0.22, 0.16, 0.2) * 1.6 +
    blob(x, y, 0.9, 0.38, 0.14, 0.18) * 1.15 +
    blob(x, y, 0.78, 0.28, 0.08, 0.12) * 0.4 +
    blob(x, y, 0.98, 0.58, 0.12, 0.16) * 0.9 +
    blob(x, y, 0.94, 0.78, 0.1, 0.14) * 0.45 +
    blob(x, y, 0.9, 0.98, 0.08, 0.1) * 0.22;
  return Math.min(1, mass * fade);
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function makeFlock(count: number): Bird[] {
  const rand = mulberry32(11);
  const birds: Bird[] = [];
  let guard = 0;
  while (birds.length < count && guard < count * 40) {
    guard += 1;
    const x = 0.5 + Math.pow(rand(), 0.45) * 0.56;
    const y = Math.pow(rand(), 1.45) * 1.05 - 0.02;
    const mass = density(x, y);
    if (rand() > mass) continue;
    const fringe = 1 - mass;
    const i = birds.length;
    birds.push({
      group: i % GROUPS.length,
      phase: rand() * Math.PI * 2,
      depth: rand(),
      along: Math.pow(rand(), 1.55),
      speed: 0.35 + rand() * 0.7,
      homeX: Math.min(x, 1.04),
      homeY: y,
      heading: rand() * Math.PI * 2,
      radius: 0.003 + rand() * (0.006 + fringe * 0.008),
      size: 10 + fringe * 4 + rand() * 3,
      alpha: 0.55 + mass * 0.45,
      self: i === 0,
      band: i % LAYERS.length,
      x: 0,
      y: 0,
    });
  }
  birds.sort((a, b) => a.alpha - b.alpha);
  return birds;
}

function groupCenter(index: number, time: number) {
  const ang = (index / GROUPS.length) * Math.PI * 2 + time * 0.18;
  const radius = 0.15;
  return {
    x: 0.5 + Math.cos(ang) * radius * 0.9,
    y: 0.46 + Math.sin(ang) * radius * 0.72,
  };
}

function lerpAngle(a: number, b: number, t: number) {
  let delta = b - a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * t;
}

const FLOCK = { x: 0.5, y: 0.46 };

/** A living ball in the middle. The logo sits in the hole. */
function flockPoint(bird: Bird, time: number) {
  const spin = bird.phase + time * (0.18 + bird.speed * 0.12);
  const rad = 0.1 + Math.sqrt(bird.depth) * 0.18;
  return {
    x: FLOCK.x + Math.cos(spin) * rad,
    y: FLOCK.y + Math.sin(spin) * rad * 0.82,
    heading: spin + Math.PI / 2,
  };
}

function clearLogo(x: number, y: number, t: number) {
  const pop = smoothstep(0.84, 0.94, t);
  const dx = x - FLOCK.x;
  const dy = y - FLOCK.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const clear = 0.11;
  if (dist >= clear || pop <= 0) return { x, y };
  const push = (clear - dist) * pop;
  return { x: x + (dx / dist) * push, y: y + (dy / dist) * push };
}

const ROW_X = 0.14;
const ROW_W = 0.72;

function layerY(index: number) {
  return 0.2 + ((index + 0.5) / LAYERS.length) * 0.6;
}

/** Stacked rows. Each row drifts, neighboring rows in opposite directions. */
function layerPoint(bird: Bird, time: number) {
  const layer = bird.band % LAYERS.length;
  const dir = layer % 2 === 0 ? 1 : -1;
  let across = bird.depth + dir * time * 0.025 * bird.speed;
  across = ((across % 1) + 1) % 1;
  return {
    x: ROW_X + across * ROW_W,
    y: layerY(layer) + Math.sin(bird.phase + time * 0.6) * 0.008,
    heading: dir > 0 ? -Math.PI / 2 : Math.PI / 2,
  };
}

/** Us. Sits in the You circle, then travels up and down through the layers. */
function selfPoint(time: number) {
  const you = groupCenter(GROUPS.length - 1, time);
  const pass = (Math.sin(time * 0.45) + 1) / 2;
  return {
    circle: { x: you.x, y: you.y, heading: -Math.PI / 2 },
    layer: {
      x: 0.5 + Math.sin(time * 0.8) * 0.02,
      y: lerp(layerY(0), layerY(LAYERS.length - 1), pass),
      heading: pass > 0.5 ? Math.PI : 0,
    },
  };
}

function heroPoint(bird: Bird, time: number, narrow: boolean) {
  const wobble = time * bird.speed * 1.15 + bird.phase;
  const jx = Math.cos(wobble) * bird.radius * 1.15;
  const jy = Math.sin(wobble * 0.8) * bird.radius;
  if (!narrow) return { x: bird.homeX + jx, y: bird.homeY + jy };

  const down = clamp01((bird.homeY + 0.02) / 1.05);
  const span = bird.depth;
  const left = 0.4 + down * 0.38;
  const right = 1.04 - down * 0.06;
  return {
    x: left + span * (right - left) + jx,
    y: Math.max(0.11, 0.11 + down * 0.68 + jy),
  };
}

function place(bird: Bird, t: number, time: number, narrow: boolean) {
  const fly = smoothstep(0.04, 0.16, t);
  const toLayers = smoothstep(0.32, 0.48, t);
  const toFlock = smoothstep(0.62, 0.78, t);
  const home = heroPoint(bird, time, narrow);

  if (bird.self) {
    const self = selfPoint(time);
    const ring = time * 0.55;
    const beside = {
      x: FLOCK.x + Math.cos(ring) * 0.14,
      y: FLOCK.y + Math.sin(ring) * 0.11,
      heading: ring + Math.PI / 2,
    };
    const circled = {
      x: lerp(home.x, self.circle.x, fly),
      y: lerp(home.y, self.circle.y, fly),
      heading: lerpAngle(bird.heading, self.circle.heading, fly),
    };
    const layered = {
      x: lerp(circled.x, self.layer.x, toLayers),
      y: lerp(circled.y, self.layer.y, toLayers),
      heading: lerpAngle(circled.heading, self.layer.heading, toLayers),
    };
    const spot = clearLogo(
      lerp(layered.x, beside.x, toFlock),
      lerp(layered.y, beside.y, toFlock),
      t,
    );
    return {
      x: spot.x,
      y: spot.y,
      heading: lerpAngle(layered.heading, beside.heading, toFlock),
    };
  }

  const center = groupCenter(bird.group, time);
  const local = bird.phase + time * bird.speed * 0.45;
  const arm = 0.016 + bird.depth * 0.036;
  const orbit = {
    x: center.x + Math.cos(local) * arm,
    y: center.y + Math.sin(local) * arm * 0.86,
    heading: local + Math.PI / 2,
  };
  const layer = layerPoint(bird, time);
  const flock = flockPoint(bird, time);
  const wOrbit = fly * (1 - toLayers);
  const wLayer = toLayers * (1 - toFlock);
  const wFlock = toFlock;
  const wHome = 1 - wOrbit - wLayer - wFlock;
  let heading = bird.heading;
  heading = lerpAngle(heading, orbit.heading, wOrbit);
  heading = lerpAngle(heading, layer.heading, wLayer);
  heading = lerpAngle(heading, flock.heading, wFlock);
  const spot = clearLogo(
    home.x * wHome + orbit.x * wOrbit + layer.x * wLayer + flock.x * wFlock,
    home.y * wHome + orbit.y * wOrbit + layer.y * wLayer + flock.y * wFlock,
    t,
  );
  return { x: spot.x, y: spot.y, heading };
}

export default function AsciiMurmur({ captionClassName = "" }: { captionClassName?: string }) {
  const trackRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const layerLabelRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const canvasNode = canvasRef.current;
    const stageNode = stageRef.current;
    const trackNode = trackRef.current;
    const heroNode = heroRef.current;
    const bubbleNode = bubbleRef.current;
    if (!canvasNode || !stageNode || !trackNode || !heroNode || !bubbleNode) return;
    // Nested functions do not keep the narrowing of a ref's `.current`.
    const canvas: HTMLCanvasElement = canvasNode;
    const stage: HTMLDivElement = stageNode;
    const track: HTMLElement = trackNode;
    const hero: HTMLDivElement = heroNode;
    const bubble: HTMLDivElement = bubbleNode;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx: CanvasRenderingContext2D = context;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const flock = makeFlock(stage.clientWidth < 760 ? 1400 : 2400);
    let raf = 0;
    let visible = true;
    let last = performance.now();
    const clock = { t: 0 };
    const scroll = { value: 0 };
    let pinMode = "";
    let glyphs: HTMLCanvasElement[][][] = [];
    let glyphSizes: number[] = [];
    const glyphAngles = 16;

    function buildGlyphs(dpr: number) {
      glyphSizes = [10, 12, 14, 16];
      const colors = [INK, TEAL, AMBER, PURPLE];
      glyphs = colors.map((color) =>
        glyphSizes.map((size) => {
          const px = size * dpr;
          const pad = Math.ceil(px * 2);
          return Array.from({ length: glyphAngles }, (_, angle) => {
            const tile = document.createElement("canvas");
            tile.width = pad;
            tile.height = pad;
            const tileCtx = tile.getContext("2d");
            if (!tileCtx) return tile;
            tileCtx.translate(pad / 2, pad / 2);
            tileCtx.rotate((angle / glyphAngles) * Math.PI * 2);
            tileCtx.fillStyle = color;
            tileCtx.font = `${px}px ui-monospace, SFMono-Regular, Menlo, monospace`;
            tileCtx.textAlign = "center";
            tileCtx.textBaseline = "middle";
            tileCtx.fillText("v", 0, 0);
            return tile;
          });
        }),
      );
    }

    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const bw = Math.max(1, Math.floor(w * dpr));
      const bh = Math.max(1, Math.floor(h * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      return { w, h, dpr };
    }

    function measure() {
      const rect = track.getBoundingClientRect();
      const view = window.innerHeight;
      const travel = track.offsetHeight - view;
      return {
        rect,
        view,
        target: travel <= 0 ? 0 : clamp01(-rect.top / travel),
      };
    }

    function pin(rect: DOMRect, view: number) {
      if (reduce) return;
      let mode = "top";
      if (rect.top <= 0 && rect.bottom >= view) {
        mode = `fixed:${Math.round(rect.left)}:${Math.round(rect.width)}:${view}`;
      } else if (rect.bottom < view) {
        mode = "bottom";
      }
      if (mode === pinMode) return;
      pinMode = mode;
      stage.style.height = `${view}px`;
      stage.style.left = "0px";
      stage.style.width = "100%";
      if (mode === "top") {
        stage.style.position = "absolute";
        stage.style.top = "0px";
        stage.style.bottom = "auto";
      } else if (mode === "bottom") {
        stage.style.position = "absolute";
        stage.style.top = "auto";
        stage.style.bottom = "0px";
      } else {
        stage.style.position = "fixed";
        stage.style.top = "0px";
        stage.style.bottom = "auto";
        stage.style.left = `${rect.left}px`;
        stage.style.width = `${rect.width}px`;
      }
    }

    function draw(now: number) {
      const { rect, view, target } = measure();
      pin(rect, view);
      const { w, h, dpr } = size();
      if (!glyphs.length) buildGlyphs(dpr);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduce) clock.t += dt;
      const follow = 1 - Math.exp(-16 * dt);
      scroll.value += (target - scroll.value) * follow;
      if (Math.abs(target - scroll.value) < 0.0006) scroll.value = target;
      const t = reduce ? 0 : scroll.value;
      const time = reduce ? 0.4 : clock.t;
      const narrow = w < 760;
      const gathered = smoothstep(0.08, 0.2, t);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      function paint(bird: Bird) {
        const next = place(bird, t, time, narrow);
        const flutter = Math.sin(time * bird.speed + bird.phase) * (bird.self ? 0.08 : 0.22);
        let rot = (next.heading + flutter) % (Math.PI * 2);
        if (rot < 0) rot += Math.PI * 2;
        const tint = GROUPS[bird.group].tint;
        const turn = ((bird.phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2);
        const order = (bird.group / GROUPS.length) * 0.62 + turn * 0.38;
        const tintAmount =
          smoothstep(order * 0.05, 0.02 + order * 0.07, t) *
          (1 - smoothstep(0.34 + order * 0.1, 0.5 + order * 0.12, t));
        const colorIndex = bird.self ? 3 : tint === "teal" ? 1 : tint === "amber" ? 2 : 0;
        const px = bird.self ? 16 : lerp(narrow ? bird.size * 0.82 : bird.size, narrow ? 10 : 12, gathered);
        let sizeIndex = 0;
        let sizeGap = Infinity;
        for (let i = 0; i < glyphSizes.length; i += 1) {
          const gap = Math.abs(glyphSizes[i] - px);
          if (gap < sizeGap) {
            sizeGap = gap;
            sizeIndex = i;
          }
        }
        const angleIndex = Math.round((rot / (Math.PI * 2)) * glyphAngles) % glyphAngles;
        const inkTile = glyphs[0]?.[sizeIndex]?.[angleIndex];
        const colorTile = glyphs[colorIndex]?.[sizeIndex]?.[angleIndex];
        if (!inkTile) return;
        const sx = next.x * w;
        const sy = next.y * h;
        const shine = bird.self ? tintAmount : 0;
        if (shine > 0.02) {
          const pulse = 0.65 + 0.35 * Math.sin(time * 2.6);
          const radius = (narrow ? 56 : 88) * (0.82 + pulse * 0.28);
          const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
          glow.addColorStop(0, `rgba(243, 232, 255, ${0.95 * pulse * shine})`);
          glow.addColorStop(0.22, `rgba(192, 132, 252, ${0.72 * pulse * shine})`);
          glow.addColorStop(0.5, `rgba(124, 58, 237, ${0.28 * pulse * shine})`);
          glow.addColorStop(1, "rgba(124, 58, 237, 0)");
          ctx.globalAlpha = 1;
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(sx, sy, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        const dw = (inkTile.width / dpr) * (bird.self ? 1.7 : 1);
        const inkLeft = colorIndex === 0 ? 1 : 1 - tintAmount;
        const base = bird.self ? 1 : lerp(bird.alpha, 0.92, gathered);
        if (inkLeft > 0.02) {
          ctx.globalAlpha = base * inkLeft;
          ctx.drawImage(inkTile, sx - dw / 2, sy - dw / 2, dw, dw);
        }
        if (colorTile && colorIndex !== 0 && tintAmount > 0.02) {
          ctx.globalAlpha = base * tintAmount;
          ctx.drawImage(colorTile, sx - dw / 2, sy - dw / 2, dw, dw);
        }
      }

      for (const bird of flock) {
        if (!bird.self) paint(bird);
      }
      for (const bird of flock) {
        if (bird.self) paint(bird);
      }

      hero.style.opacity = (1 - smoothstep(0.06, 0.2, t)).toFixed(3);

      const labelFade = smoothstep(0.12, 0.18, t) * (1 - smoothstep(0.22, 0.3, t));
      GROUPS.forEach((group, index) => {
        const node = labelRefs.current[index];
        if (!node) return;
        const center = groupCenter(index, time);
        const dx = center.x - 0.5;
        const dy = center.y - 0.48;
        const len = Math.hypot(dx, dy) || 1;
        node.style.opacity = String(labelFade);
        node.style.left = `${(center.x + (dx / len) * 0.13) * w}px`;
        node.style.top = `${(center.y + (dy / len) * 0.11) * h}px`;
      });

      const layerFade = smoothstep(0.38, 0.5, t) * (1 - smoothstep(0.6, 0.72, t));
      LAYERS.forEach((_, index) => {
        const node = layerLabelRefs.current[index];
        if (!node) return;
        node.style.opacity = String(layerFade);
        node.style.left = `${w * (ROW_X + ROW_W / 2)}px`;
        node.style.top = `${layerY(index) * h - 22}px`;
        node.style.transform = "translate(-50%, -100%)";
      });

      const popT = smoothstep(0.82, 0.94, t);
      const overshoot = Math.sin(popT * Math.PI) * 0.14 * (1 - popT);
      const scale = popT === 0 ? 0.6 : lerp(0.6, 1, popT) + overshoot;
      bubble.style.opacity = smoothstep(0.82, 0.9, t).toFixed(3);
      bubble.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }

    size();
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(track);
    const resize = new ResizeObserver(() => size());
    resize.observe(stage);

    function loop(now: number) {
      raf = requestAnimationFrame(loop);
      if (!visible && !reduce) return;
      draw(now);
      if (reduce) cancelAnimationFrame(raf);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      resize.disconnect();
    };
  }, []);

  return (
    <section
      ref={trackRef}
      className="relative h-[420vh] bg-[#F3EEE4] motion-reduce:h-auto"
      aria-label="A flock gathers into labeled circles, stacks into layers, then comes together around the Starling logo. One purple bird shines."
    >
      <div
        ref={stageRef}
        className="pointer-events-none absolute left-0 top-0 h-dvh w-full overflow-hidden motion-reduce:static motion-reduce:h-dvh"
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
        {GROUPS.map((group, index) => (
          <span
            key={group.name}
            ref={(node) => {
              labelRefs.current[index] = node;
            }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[11px] font-medium tracking-[0.14em] text-[#5E665F] uppercase"
            style={{ opacity: 0 }}
          >
            {group.name}
          </span>
        ))}
        {LAYERS.map((name, index) => (
          <span
            key={name}
            ref={(node) => {
              layerLabelRefs.current[index] = node;
            }}
            className="pointer-events-none absolute text-[11px] font-medium tracking-[0.14em] text-[#5E665F] uppercase"
            style={{ opacity: 0 }}
          >
            {name}
          </span>
        ))}
        <div
          ref={bubbleRef}
          className="pointer-events-none absolute left-1/2 top-[46%] z-10"
          style={{ opacity: 0, transform: "translate(-50%, -50%) scale(0.6)" }}
        >
          <div className="flex h-44 w-44 flex-col items-center justify-center rounded-full border border-[#D5CDBF] bg-[#FBF8F2] shadow-[0_18px_50px_rgba(22,26,23,0.16)] sm:h-48 sm:w-48">
            <Image
              src="/brand/pip.png"
              alt=""
              width={280}
              height={280}
              className="h-28 w-28 object-contain sm:h-32 sm:w-32"
            />
            <span className={`${captionClassName} -mt-1 text-2xl tracking-tight text-[#161A17] normal-case`}>
              Starling
            </span>
          </div>
        </div>
      </div>

      <div ref={heroRef} className="relative z-20 flex h-dvh flex-col">
        <header className="relative flex h-14 items-center px-6 sm:px-10">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark className="h-8 w-8 shrink-0" />
            <span className={`${captionClassName} text-2xl tracking-tight text-[#161A17] normal-case`}>
              Starling
            </span>
          </Link>
          <Link
            href="/demo"
            className="absolute left-1/2 -translate-x-1/2 text-sm text-[#5E665F] hover:text-[#161A17]"
          >
            Demo
          </Link>
        </header>
        <div className="flex flex-1 items-start px-6 pt-8 pb-16 sm:items-center sm:px-10 sm:pt-0 lg:px-16">
          <div className="max-w-xl">
            <h1
              className={`${captionClassName} text-5xl leading-[0.95] tracking-tight text-[#161A17] normal-case min-[480px]:text-6xl sm:text-7xl lg:text-8xl`}
            >
              See your people.
            </h1>
            <p className="mt-5 max-w-[46%] text-[15px] leading-relaxed text-[#161A17] normal-case sm:mt-6 sm:max-w-sm">
              A murmuration is many birds and one living shape. Starling draws that shape around any
              public handle, and tells you why each line is there.
            </p>
            <a
              href="https://www.youtube.com/watch?v=X0sE10zUYyY"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block max-w-[46%] text-[15px] text-[#0F766E] normal-case underline decoration-[#0F766E]/40 underline-offset-4 hover:decoration-[#0F766E] sm:max-w-sm"
            >
              Watch a murmuration
            </a>
            <Image
              src="/brand/pip.png"
              alt="Pip, a starling with one wing lifted"
              width={414}
              height={419}
              priority
              className="mt-8 w-36 sm:w-48"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
