/**
 * DRAPAbsorptionGraph.tsx
 *
 * D-Region Absorption Prediction graph.
 * Shows HF radio absorption (dB) across 1–30 MHz for the sunlit hemisphere.
 *
 * D-RAP model (simplified Chapman layer):
 *   A(f) = A0 · f^(−1.8)
 *   A0 = 43.6 · sec(SZA)^0.75 · (I/I_ref)^0.5
 *   where I = GOES flux, I_ref = 1e-5 W/m² (M1-class)
 *
 * Band regions:
 *   1–3 MHz   Low-HF (AM broadcast / NVIS)
 *   3–10 MHz  Mid-HF (amateur / aviation)
 *   10–30 MHz High-HF (shortwave / RTTY)
 *
 * Absorption > 10 dB = total blackout (signal lost)
 * Absorption 5-10 dB = degraded comms
 * Absorption < 5 dB  = usable
 */

import { useRef, useEffect } from 'react';

export interface DRAPAbsorptionGraphProps {
  /** GOES 1–8 Å flux in W/m² */
  fluxWm2: number;
  /** Solar zenith angle at observer location (degrees). Default 45°. */
  sza?: number;
}

// ── D-RAP physics ─────────────────────────────────────────────────────────────

function drapAbsorption(freqMHz: number, fluxWm2: number, szaDeg: number): number {
  const szaRad = (Math.min(89, szaDeg) * Math.PI) / 180;
  const secSZA = 1 / Math.cos(szaRad);
  const I_ref  = 1e-5; // M1-class reference
  const fluxClamped = Math.max(1e-8, fluxWm2);
  const A0 = 43.6 * Math.pow(secSZA, 0.75) * Math.sqrt(fluxClamped / I_ref);
  return A0 * Math.pow(freqMHz, -1.8);
}

function absToColor(dB: number): string {
  if (dB >= 10) return '#ef4444';   // total blackout
  if (dB >=  5) return '#f97316';   // degraded
  if (dB >=  2) return '#ffd166';   // marginal
  return '#22c55e';                  // clear
}

// ── component ─────────────────────────────────────────────────────────────────

const FREQS = Array.from({ length: 120 }, (_, i) => 1 + i * (29 / 119)); // 1–30 MHz, 120 pts
const PAD = { l: 42, r: 12, t: 24, b: 36 };
const ACCENT = '#ffd166';

export default function DRAPAbsorptionGraph({ fluxWm2, sza = 45 }: DRAPAbsorptionGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flareClass = fluxWm2 >= 1e-4 ? `X${(fluxWm2/1e-4).toFixed(1)}` :
                     fluxWm2 >= 1e-5 ? `M${(fluxWm2/1e-5).toFixed(1)}` :
                     fluxWm2 >= 1e-6 ? `C${(fluxWm2/1e-6).toFixed(1)}` :
                     fluxWm2 >= 1e-7 ? `B${(fluxWm2/1e-7).toFixed(1)}` : 'A';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const pw = W - PAD.l - PAD.r;
    const ph = H - PAD.t - PAD.b;

    const absVals = FREQS.map(f => drapAbsorption(f, fluxWm2, sza));
    const maxAbs  = Math.max(15, ...absVals);

    const toX = (f: number)  => PAD.l + ((f - 1) / 29) * pw;
    const toY = (db: number) => PAD.t + (1 - Math.min(1, db / maxAbs)) * ph;

    ctx.clearRect(0, 0, W, H);

    // Background blackout / degraded bands
    const blackoutY = toY(10);
    const degradedY = toY(5);

    ctx.fillStyle = 'rgba(239,68,68,0.06)';
    ctx.fillRect(PAD.l, PAD.t, pw, blackoutY - PAD.t);

    ctx.fillStyle = 'rgba(249,115,22,0.06)';
    ctx.fillRect(PAD.l, blackoutY, pw, degradedY - blackoutY);

    // Grid
    ctx.strokeStyle = 'rgba(100,150,200,0.10)';
    ctx.lineWidth = 0.8;
    [5, 10, 15].forEach(db => {
      ctx.beginPath(); ctx.moveTo(PAD.l, toY(db)); ctx.lineTo(PAD.l + pw, toY(db)); ctx.stroke();
    });
    [3, 7, 10, 14, 18, 22, 26, 30].forEach(f => {
      ctx.beginPath(); ctx.moveTo(toX(f), PAD.t); ctx.lineTo(toX(f), PAD.t + ph); ctx.stroke();
    });

    // Band annotations
    ctx.font = '7px monospace';
    ctx.fillStyle = 'rgba(150,185,220,0.35)';
    ctx.textAlign = 'center';
    ctx.fillText('LOW-HF', toX(2), PAD.t + ph + 26);
    ctx.fillText('MID-HF', toX(6.5), PAD.t + ph + 26);
    ctx.fillText('HIGH-HF', toX(20), PAD.t + ph + 26);

    // Band dividers
    ctx.strokeStyle = 'rgba(150,185,220,0.15)';  ctx.lineWidth = 0.6;
    [3, 10].forEach(f => {
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(toX(f), PAD.t); ctx.lineTo(toX(f), PAD.t + ph + 3); ctx.stroke();
    });
    ctx.setLineDash([]);

    // Axes
    ctx.strokeStyle = 'rgba(100,160,220,0.40)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.l, PAD.t); ctx.lineTo(PAD.l, PAD.t + ph); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD.l, PAD.t + ph); ctx.lineTo(PAD.l + pw, PAD.t + ph); ctx.stroke();

    // Axis tick labels
    ctx.fillStyle = 'rgba(120,170,210,0.6)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    [0, 5, 10, 15].forEach(db => {
      ctx.fillText(String(db), PAD.l - 4, toY(db) + 3);
    });
    ctx.textAlign = 'center';
    [3, 7, 10, 14, 18, 22, 26, 30].forEach(f => {
      ctx.fillText(String(f), toX(f), PAD.t + ph + 12);
    });

    // Axis titles
    ctx.fillStyle = 'rgba(150,190,230,0.5)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Frequency (MHz)', PAD.l + pw / 2, H - 2);
    ctx.save();
    ctx.translate(10, PAD.t + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Absorption (dB)', 0, 0);
    ctx.restore();

    // Threshold labels
    ctx.font = '8px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(239,68,68,0.55)';
    ctx.fillText('BLACKOUT', PAD.l - 4, toY(10) + 3);
    ctx.fillStyle = 'rgba(249,115,22,0.55)';
    ctx.fillText('DEGRADE', PAD.l - 4, toY(5) + 3);

    // Gradient fill under curve
    const grad = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + ph);
    grad.addColorStop(0,   'rgba(255,180,50,0.40)');
    grad.addColorStop(0.5, 'rgba(249,115,22,0.22)');
    grad.addColorStop(1,   'rgba(34,197,94,0.05)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(toX(FREQS[0]), toY(absVals[0]));
    FREQS.forEach((f, i) => ctx.lineTo(toX(f), toY(absVals[i])));
    ctx.lineTo(toX(FREQS[FREQS.length - 1]), PAD.t + ph);
    ctx.lineTo(toX(FREQS[0]), PAD.t + ph);
    ctx.closePath();
    ctx.fill();

    // Absorption curve — segment-coloured
    FREQS.forEach((f, i) => {
      if (i === 0) return;
      const x0 = toX(FREQS[i-1]), y0 = toY(absVals[i-1]);
      const x1 = toX(f),           y1 = toY(absVals[i]);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = absToColor((absVals[i-1] + absVals[i]) / 2);
      ctx.lineWidth = 1.8;
      ctx.stroke();
    });

    // Current-class label
    ctx.fillStyle = 'rgba(255,210,100,0.75)';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${flareClass}  SZA ${sza.toFixed(0)}°`, PAD.l + pw, PAD.t - 5);

  }, [fluxWm2, sza, flareClass]);

  return (
    <div style={{
      background: 'rgba(4,9,22,0.72)',
      border: `1px solid ${ACCENT}22`,
      borderRadius: '8px',
      overflow: 'hidden',
      fontFamily: 'monospace',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBlockEnd: `1px solid ${ACCENT}18`, background: `linear-gradient(90deg,${ACCENT}0c 0%,transparent 100%)` }}>
        <span style={{ inlineSize: 6, blockSize: 6, borderRadius: '50%', background: ACCENT, display: 'inline-block' }} />
        <span style={{ fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, opacity: 0.85 }}>D-RAP HF Absorption</span>
        <span style={{ marginInlineStart: 'auto', fontSize: '8px' }}>
          <span style={{ color: fluxWm2 >= 1e-4 ? '#ef4444' : fluxWm2 >= 1e-5 ? '#f97316' : '#ffd166', fontWeight: 'bold' }}>{flareClass}</span>
          <span style={{ opacity: 0.45 }}> · SZA {sza.toFixed(0)}°</span>
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
