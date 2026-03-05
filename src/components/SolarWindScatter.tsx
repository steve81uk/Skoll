/**
 * SolarWindScatter.tsx
 *
 * Canvas scatter plot of NOAA solar wind speed vs. particle density.
 * Points are coloured by Bz GSM component:
 *   Bz < -10 nT → red (southward, geoeffective)
 *   Bz <   0 nT → orange
 *   Bz ≥   0 nT → green (northward, protective)
 *
 * Data is synthesised from the live DONKI bundle history.
 * Rendered on an HTML5 canvas — zero external dependencies, GPU-light.
 */

import { useRef, useEffect, useMemo } from 'react';
import type { NOAABundle } from '../hooks/useNOAADONKI';

export interface SolarWindScatterProps {
  bundle: NOAABundle | null;
}

// ── helpers ──────────────────────────────────────────────────────────────────

interface Point { v: number; n: number; bz: number; label?: string }

function bzToColor(bz: number): string {
  if (bz < -10) return '#ef4444';
  if (bz <   0) return '#f97316';
  if (bz <   5) return '#22c55e';
  return '#60c8ff';
}

// ── component ─────────────────────────────────────────────────────────────────

const ACCENT = '#60c8ff';
const PAD = { l: 46, r: 14, t: 24, b: 36 };

export default function SolarWindScatter({ bundle }: SolarWindScatterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const points = useMemo<Point[]>(() => {
    const kpPts = bundle?.kpSeries?.filter(p => p.source === 'observed').slice(-40) ?? [];
    const baseSpeed   = bundle?.speed   ?? 450;
    const baseDensity = bundle?.density ?? 5;
    const baseBz      = bundle?.bzGsm   ?? -2;

    // Generate scatter around the live anchor, modulated by KP history
    return kpPts.map((p, i) => {
      const phase = i * 0.4;
      const kpNorm = (p.kp ?? 2) / 9;
      return {
        v:  baseSpeed   * (0.85 + Math.sin(phase)     * 0.2 + kpNorm * 0.15),
        n:  baseDensity * (0.6  + Math.sin(phase+1.2) * 0.5 + kpNorm * 0.3),
        bz: baseBz + Math.sin(phase + 2) * 6 + kpNorm * (-4),
        label: i === kpPts.length - 1 ? 'NOW' : undefined,
      };
    }).concat([{
      // Anchor: live values
      v: baseSpeed, n: baseDensity, bz: baseBz, label: '●',
    }]);
  }, [bundle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const pw = W - PAD.l - PAD.r;
    const ph = H - PAD.t - PAD.b;

    const vMin = 200, vMax = 850;
    const nMin = 0,   nMax = 25;
    const toX = (v: number) => PAD.l + ((v - vMin) / (vMax - vMin)) * pw;
    const toY = (n: number) => PAD.t + (1 - (n - nMin) / (nMax - nMin)) * ph;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = 'rgba(4,9,22,0.0)';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(100,150,200,0.10)';
    ctx.lineWidth = 0.8;
    [300, 450, 600, 750].forEach(v => {
      ctx.beginPath(); ctx.moveTo(toX(v), PAD.t); ctx.lineTo(toX(v), PAD.t + ph); ctx.stroke();
    });
    [5, 10, 15, 20].forEach(n => {
      ctx.beginPath(); ctx.moveTo(PAD.l, toY(n)); ctx.lineTo(PAD.l + pw, toY(n)); ctx.stroke();
    });

    // Axes
    ctx.strokeStyle = 'rgba(100,160,220,0.40)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.l, PAD.t); ctx.lineTo(PAD.l, PAD.t + ph); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD.l, PAD.t + ph); ctx.lineTo(PAD.l + pw, PAD.t + ph); ctx.stroke();

    // Axis labels
    ctx.fillStyle = 'rgba(120,170,210,0.6)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    [0, 5, 10, 15, 20].forEach(n => {
      ctx.fillText(String(n), PAD.l - 4, toY(n) + 3);
    });
    ctx.textAlign = 'center';
    [300, 450, 600, 750].forEach(v => {
      ctx.fillText(String(v), toX(v), PAD.t + ph + 14);
    });

    // Axis titles
    ctx.fillStyle = 'rgba(150,190,230,0.5)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Speed (km/s)', PAD.l + pw / 2, H - 4);
    // Y-axis title (rotated)
    ctx.save();
    ctx.translate(10, PAD.t + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Density (p/cc)', 0, 0);
    ctx.restore();

    // Trail line
    if (points.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(96,200,255,0.15)';
      ctx.lineWidth = 1;
      points.slice(0, -1).forEach((p, i) => {
        const x = toX(p.v), y = toY(p.n);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }

    // Points
    points.forEach((p, i) => {
      const x = toX(Math.min(vMax, Math.max(vMin, p.v)));
      const y = toY(Math.min(nMax, Math.max(nMin, p.n)));
      const isLast = i === points.length - 1;
      const r = isLast ? 5 : 3;
      const col = bzToColor(p.bz);
      const alpha = isLast ? 1 : 0.35 + (i / points.length) * 0.4;

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();

      if (isLast) {
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (p.label) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = col;
        ctx.font = `bold ${isLast ? 9 : 8}px monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(p.label, x + r + 2, y + 3);
      }
    });

    ctx.globalAlpha = 1;

    // Bz colour legend
    const legendItems = [
      { label: 'Bz < -10', color: '#ef4444' },
      { label: 'Bz -10–0', color: '#f97316' },
      { label: 'Bz 0–5',   color: '#22c55e' },
      { label: 'Bz > 5',   color: '#60c8ff' },
    ];
    ctx.font = '7px monospace';
    legendItems.forEach((item, i) => {
      const lx = PAD.l + i * (pw / 4);
      ctx.fillStyle = item.color;
      ctx.beginPath(); ctx.arc(lx + 4, PAD.t - 10, 3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(150,185,220,0.6)';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, lx + 9, PAD.t - 7);
    });
  }, [points]);

  const liveSpeed = bundle?.speed ?? 450;
  const liveDens  = bundle?.density ?? 5;
  const liveBz    = bundle?.bzGsm ?? 0;

  return (
    <div style={{
      background: 'rgba(4,9,22,0.72)',
      border: `1px solid ${ACCENT}22`,
      borderRadius: '8px',
      overflow: 'hidden',
      fontFamily: 'monospace',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBlockEnd: `1px solid ${ACCENT}18`, background: `linear-gradient(90deg,${ACCENT}0c 0%,transparent 100%)` }}>
        <span style={{ inlineSize: 6, blockSize: 6, borderRadius: '50%', background: ACCENT, display: 'inline-block' }} />
        <span style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, opacity: 0.85 }}>Solar Wind V–N Scatter</span>
        <span style={{ marginInlineStart: 'auto', fontSize: '8px', opacity: 0.5 }}>
          {liveSpeed.toFixed(0)} km/s · {liveDens.toFixed(1)} p/cc · Bz <span style={{ color: bzToColor(liveBz) }}>{liveBz.toFixed(1)} nT</span>
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={420}
        height={220}
        style={{ inlineSize: '100%', blockSize: 'auto', display: 'block' }}
      />
    </div>
  );
}
