"use client";

import { useEffect, useRef } from "react";

/**
 * Hero murmuration. Each bird keeps a home in the cloud and only
 * mills around it, so the shape stays while the wings keep moving.
 */

type Bird = {
  x: number;
  y: number;
  heading: number;
  phase: number;
  speed: number;
  flap: number;
  radius: number;
  scale: number;
  tone: number;
};

const TONES = [
  "rgba(20, 20, 18, 0.96)",
  "rgba(32, 32, 28, 0.92)",
  "rgba(62, 60, 54, 0.82)",
  "rgba(120, 114, 104, 0.62)",
];

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

/** How thick the flock is. x and y run 0–1, origin top-left. */
function density(x: number, y: number) {
  if (x < 0.4 || y < -0.02 || y > 1.05) return 0;
  const fade = x < 0.56 ? Math.max(0, (x - 0.46) / 0.1) : 1;
  const mass =
    blob(x, y, 1.04, 0.16, 0.2, 0.16) * 0.85 +
    blob(x, y, 1.06, 0.36, 0.16, 0.24) * 1.35 +
    blob(x, y, 0.9, 0.46, 0.18, 0.2) * 0.95 +
    blob(x, y, 0.72, 0.3, 0.1, 0.16) * 0.42 +
    blob(x, y, 0.98, 0.68, 0.14, 0.16) * 0.55 +
    blob(x, y, 0.86, 0.86, 0.12, 0.12) * 0.22;
  return Math.min(1, mass * fade);
}

function makeFlock(count: number): Bird[] {
  const rand = mulberry32(11);
  const birds: Bird[] = [];
  let guard = 0;
  while (birds.length < count && guard < count * 40) {
    guard += 1;
    const x = 0.46 + Math.pow(rand(), 0.62) * 0.6;
    const y = Math.pow(rand(), 0.9) * 1.05 - 0.02;
    const mass = density(x, y);
    if (rand() > mass) continue;
    const depth = rand();
    const fringe = 1 - mass;
    birds.push({
      x: Math.min(x, 1.06),
      y,
      heading: rand() * Math.PI * 2,
      phase: rand() * Math.PI * 2,
      speed: 0.22 + rand() * 0.7,
      flap: 3.2 + rand() * 2.4,
      radius: 0.002 + rand() * (0.005 + fringe * 0.007),
      scale: (0.72 + rand() * 0.7) * (0.78 + fringe * 0.45),
      tone: Math.min(1, depth * 0.35 + fringe * 0.55 + rand() * 0.15),
    });
  }
  birds.sort((a, b) => b.tone - a.tone);
  return birds;
}

function drawBird(ctx: CanvasRenderingContext2D, s: number, flap: number) {
  const lift = 0.28 + flap * 0.92;
  ctx.beginPath();
  ctx.moveTo(s * 0.2, 0);
  ctx.quadraticCurveTo(-s * 0.2, -s * 0.62 * lift, -s * 1.15, -s * 0.22 * lift);
  ctx.quadraticCurveTo(-s * 0.42, -s * 0.08, -s * 0.05, 0);
  ctx.lineTo(-s * 0.78, s * 0.04);
  ctx.lineTo(-s * 1.02, -s * 0.16);
  ctx.lineTo(-s * 0.82, 0);
  ctx.lineTo(-s * 1.02, s * 0.16);
  ctx.lineTo(-s * 0.78, -s * 0.02);
  ctx.quadraticCurveTo(-s * 0.42, s * 0.08, -s * 1.15, s * 0.22 * lift);
  ctx.quadraticCurveTo(-s * 0.2, s * 0.62 * lift, s * 0.2, 0);
  ctx.quadraticCurveTo(s * 0.62, s * 0.2, s * 0.95, 0);
  ctx.quadraticCurveTo(s * 0.62, -s * 0.2, s * 0.2, 0);
  ctx.fill();
}

function toneIndex(tone: number) {
  if (tone > 0.72) return 3;
  if (tone > 0.46) return 2;
  if (tone > 0.24) return 1;
  return 0;
}

function buildSprites() {
  const frames = 6;
  const sprites: HTMLCanvasElement[][] = [];
  for (let tone = 0; tone < TONES.length; tone += 1) {
    sprites[tone] = [];
    for (let frame = 0; frame < frames; frame += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = 96;
      canvas.height = 96;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.translate(48, 48);
      ctx.fillStyle = TONES[tone];
      drawBird(ctx, 16, frame / (frames - 1));
      sprites[tone].push(canvas);
    }
  }
  return sprites;
}

export default function MurmurField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasNode = canvasRef.current;
    if (!canvasNode) return;
    const context = canvasNode.getContext("2d");
    if (!context) return;
    const parentNode = canvasNode.parentElement;
    if (!parentNode) return;
    // Nested functions do not keep the narrowing of a ref's `.current`.
    const canvas: HTMLCanvasElement = canvasNode;
    const ctx: CanvasRenderingContext2D = context;
    const parent: HTMLElement = parentNode;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const narrow = parent.clientWidth < 760;
    const area = parent.clientWidth * parent.clientHeight;
    const flock = makeFlock(narrow ? 900 : Math.round(Math.min(5200, Math.max(1600, area / 380))));
    const sprites = buildSprites();
    const frames = sprites[0]?.length ?? 1;
    let raf = 0;
    let visible = true;
    const clock = { t: reduce ? 0.8 : 0 };
    let last = performance.now();

    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const bw = Math.max(1, Math.floor(w * dpr));
      const bh = Math.max(1, Math.floor(h * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      return { w, h, dpr };
    }

    function frame(now: number) {
      const { w, h, dpr } = size();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduce) clock.t += dt;
      const time = clock.t;
      const compact = w < 760;
      const driftX = Math.sin(time * 0.15) * 0.004;
      const driftY = Math.cos(time * 0.11) * 0.004;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      for (const bird of flock) {
        const wobble = time * bird.speed + bird.phase;
        let nx = bird.x + driftX + Math.cos(wobble) * bird.radius;
        let ny = bird.y + driftY + Math.sin(wobble * 0.8) * bird.radius * 0.75;
        if (compact) {
          nx = 0.02 + nx * 0.98;
          ny = 0.38 + ny * 0.6;
        }
        const x = nx * w;
        const y = ny * h;
        const sprite =
          sprites[toneIndex(bird.tone)]?.[
            Math.floor((((Math.sin(time * bird.flap + bird.phase) + 1) / 2) * (frames - 1)))
          ];
        if (!sprite) continue;
        const span = Math.min(46, Math.max(16, w * 0.014));
        const drawSize = span * bird.scale * 2.4;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(bird.heading + Math.sin(wobble * 0.55) * 0.9);
        ctx.drawImage(sprite, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
        ctx.restore();
      }
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(parent);
    const resize = new ResizeObserver(() => size());
    resize.observe(parent);

    function loop(now: number) {
      raf = requestAnimationFrame(loop);
      if (!visible && !reduce) return;
      frame(now);
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
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
