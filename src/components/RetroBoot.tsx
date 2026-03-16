/**
 * SKÖLL-TRACK — RETRO PIXEL BOOT ANIMATION
 *
 * Phases:
 *   0 – 60  : 8-bit stars appear one by one (Game Boy green palette)
 *  60 – 90  : Big Bang flash expands from centre
 *  90 – 240 : Particles scatter outward into planet positions
 * 240 – 300 : Resolution enhancement (8-bit → 16-bit colour)
 * 300 – 336 : Fade to black → hand off to main scene
 *
 * Click or any key skips the animation immediately.
 */

import { useCallback, useEffect, useRef } from 'react';

interface RetroBootProps {
  onComplete: () => void;
}

// ─── Palettes ────────────────────────────────────────────────────────────────
const P8 = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] as const;

const PLANET_DATA = [
  { dist: 0,   count: 15, color8: P8[3],  color16: '#ffaa00' }, // sun
  { dist: 50,  count: 3,  color8: P8[2],  color16: '#aaaaaa' }, // mercury
  { dist: 90,  count: 4,  color8: P8[3],  color16: '#ffcc66' }, // venus
  { dist: 130, count: 5,  color8: P8[1],  color16: '#2266cc' }, // earth
  { dist: 170, count: 4,  color8: P8[2],  color16: '#cc4422' }, // mars
  { dist: 260, count: 8,  color8: P8[3],  color16: '#cc8833' }, // jupiter
  { dist: 330, count: 7,  color8: P8[2],  color16: '#ddaa55' }, // saturn
] as const;

// ─── Component ───────────────────────────────────────────────────────────────
export function RetroBoot({ onComplete }: RetroBootProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(false);

  const complete = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete();
  }, [onComplete]);

  // Skip handler — fires once on click or keydown
  useEffect(() => {
    const skip = () => complete();
    window.addEventListener('click', skip, { once: true });
    window.addEventListener('keydown', skip, { once: true });
    return () => {
      window.removeEventListener('click', skip);
      window.removeEventListener('keydown', skip);
    };
  }, [complete]);

  // Main animation loop — lives entirely in a ref-based RAF, no state re-renders
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasEl: HTMLCanvasElement = canvas;

    const maybeCtx = canvas.getContext('2d');
    if (!maybeCtx) return;
    const ctx: CanvasRenderingContext2D = maybeCtx;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    type Star = { x: number; y: number; born: number; brightness: number };
    type Particle = { x: number; y: number; vx: number; vy: number; color8: string; color16: string; size: number };

    const stars: Star[] = [];
    const particles: Particle[] = [];
    let frame = 0;
    let rafId = 0;

    // ── Pixelate helper ──────────────────────────────────────────────────────
    function pixelate(level: number) {
      if (!canvasRef.current || !ctx) return;
      if (level <= 1) return;
      const w = Math.max(1, Math.floor(W / level));
      const h = Math.max(1, Math.floor(H / level));
      try {
        const off = new OffscreenCanvas(w, h);
        const octx = off.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
        if (!octx) return;
        octx.imageSmoothingEnabled = false;
        octx.drawImage(canvasEl, 0, 0, W, H, 0, 0, w, h);
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(off, 0, 0, w, h, 0, 0, W, H);
      } catch {
        // OffscreenCanvas unavailable — skip
      }
    }

    // ── Chunky circle (pixelated via 4px grid) ───────────────────────────────
    function chunkyCircle(x: number, y: number, r: number, color: string) {
      if (!canvasRef.current || !ctx) return;
      ctx.fillStyle = color;
      for (let dx = -r; dx < r; dx += 4) {
        for (let dy = -r; dy < r; dy += 4) {
          if (dx * dx + dy * dy < r * r) {
            ctx.fillRect(Math.floor((x + dx) / 4) * 4, Math.floor((y + dy) / 4) * 4, 4, 4);
          }
        }
      }
    }

    // ── Spawn particles at frame 60 ──────────────────────────────────────────
    function spawnParticles() {
      for (const p of PLANET_DATA) {
        const baseAngle = Math.random() * Math.PI * 2;
        const spread = p.dist === 0 ? Math.PI * 2 : 0.5;
        for (let i = 0; i < p.count; i++) {
          const angle = baseAngle + (Math.random() - 0.5) * spread;
          const speed = p.dist === 0 ? 0.15 : (2 + Math.random() * 3) * (p.dist / 200);
          particles.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color8: p.color8,
            color16: p.color16,
            size: p.dist === 0 ? 8 : p.dist > 200 ? 4 : 2,
          });
        }
      }
    }

    // ── Main draw tick ───────────────────────────────────────────────────────
    function draw() {
      if (!canvasRef.current || !ctx) return;
      frame++;

      // Background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, H);

      // ── Phase 1: Stars appear (0–60) ─────────────────────────────────────
      if (frame < 60) {
        if (frame % 3 === 0 && stars.length < 50) {
          stars.push({
            x: Math.random() * W,
            y: Math.random() * H,
            born: frame,
            brightness: Math.random(),
          });
        }
        for (const s of stars) {
          const age = frame - s.born;
          const flicker = Math.sin(age * 0.35 + s.x * 0.01) * 0.3 + 0.7;
          const idx = Math.min(3, Math.floor(s.brightness * 3 * flicker + 0.5));
          ctx.fillStyle = P8[idx];
          const sz = s.brightness > 0.7 ? 4 : 2;
          ctx.fillRect(Math.floor(s.x / 4) * 4, Math.floor(s.y / 4) * 4, sz, sz);
        }
        pixelate(4);
      }

      // ── Phase 2: Big Bang (60–90) ─────────────────────────────────────────
      if (frame === 60) spawnParticles();

      if (frame >= 60 && frame < 90) {
        for (const s of stars) {
          ctx.fillStyle = P8[Math.min(3, Math.floor(s.brightness * 2))];
          ctx.fillRect(Math.floor(s.x / 4) * 4, Math.floor(s.y / 4) * 4, 2, 2);
        }
        const bp = (frame - 60) / 30;
        const radius = bp * 56;
        const cidx = Math.min(3, Math.round(3 * (1 - bp * 0.4)));
        chunkyCircle(cx, cy, radius, P8[cidx]);
        pixelate(4);
      }

      // ── Phase 3: Particle expansion (90–240) ─────────────────────────────
      if (frame >= 90 && frame < 240) {
        for (const s of stars) {
          ctx.fillStyle = P8[Math.min(3, Math.floor(s.brightness * 2))];
          ctx.fillRect(Math.floor(s.x / 4) * 4, Math.floor(s.y / 4) * 4, 2, 2);
        }
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.97;
          p.vy *= 0.97;
          ctx.fillStyle = p.color8;
          ctx.fillRect(Math.floor(p.x / 4) * 4, Math.floor(p.y / 4) * 4, p.size, p.size);
        }
        pixelate(4);
        // HUD labels (rendered AFTER pixelate so text stays sharp)
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = P8[3];
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('S K Ö L L   T R A C K', cx, 42);
        ctx.font = '10px monospace';
        ctx.fillStyle = P8[2];
        const dots = '.'.repeat(1 + (Math.floor(frame / 20) % 3));
        ctx.fillText(`INITIALISING SOLAR SYSTEM${dots}`, cx, H - 32);
      }

      // ── Phase 4: Colour enhance (240–300) ────────────────────────────────
      if (frame >= 240 && frame < 300) {
        const t = (frame - 240) / 60;
        const pixelSize = Math.max(1, Math.ceil(4 - t * 3.6));

        for (const s of stars) {
          const alpha = 0.4 + s.brightness * 0.6;
          ctx.fillStyle = `rgba(200,220,255,${alpha.toFixed(2)})`;
          ctx.fillRect(s.x, s.y, 2, 2);
        }
        for (const p of particles) {
          ctx.fillStyle = t > 0.45 ? p.color16 : p.color8;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        if (pixelSize > 1) pixelate(pixelSize);

        ctx.fillStyle = t > 0.45 ? '#00ffaa' : P8[3];
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('S K Ö L L   T R A C K', cx, 42);
        ctx.font = '10px monospace';
        ctx.fillStyle = t > 0.45 ? '#00aa88' : P8[2];
        ctx.fillText('ENHANCING RESOLUTION...', cx, H - 32);
      }

      // ── Phase 5: Fade out (300–336) ───────────────────────────────────────
      if (frame >= 300 && frame < 336) {
        for (const s of stars) {
          ctx.fillStyle = `rgba(200,220,255,${(0.4 + s.brightness * 0.6).toFixed(2)})`;
          ctx.fillRect(s.x, s.y, 2, 2);
        }
        for (const p of particles) {
          ctx.fillStyle = p.color16;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        const fade = (frame - 300) / 36;
        ctx.fillStyle = `rgba(0,0,0,${fade.toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
      }

      // ── Done ─────────────────────────────────────────────────────────────
      if (frame >= 336) {
        complete();
        return;
      }

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [complete]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#000',
        cursor: 'pointer',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          inlineSize: '100%',
          blockSize: '100%',
          imageRendering: 'pixelated',
        }}
      />
      <div
        style={{
          position: 'absolute',
          insetBlockEnd: 14,
          insetInlineEnd: 18,
          color: 'rgba(155, 188, 15, 0.4)',
          fontFamily: 'monospace',
          fontSize: 9,
          letterSpacing: '0.14em',
          userSelect: 'none',
          textTransform: 'uppercase',
        }}
      >
        Click or press any key to skip
      </div>
    </div>
  );
}
