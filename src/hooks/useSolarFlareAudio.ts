/**
 * SKÖLL-TRACK — SOLAR FLARE SPATIAL AUDIO
 * Web Audio API engine that produces:
 *  - A low-frequency magnetic rumble (BiquadFilter + OscillatorNode)
 *  - High-energy crackling noise when a flare is active (AudioBufferSourceNode)
 *  - Spatial panning tied to the Sun's on-screen position
 *
 * All audio is lazy-initialised on first user interaction to satisfy
 * browser autoplay policies.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

interface FlareAudioOptions {
  intensity: number;          // 0..~3 from SolarFlareParticles
  flareActive: boolean;       // true when intensity > 1.5 || wind > 800
  solarWindSpeed?: number;    // km/s
}

interface FlareAudioControls {
  enabled: boolean;
  toggle: () => void;
}

// ─── White-noise generator ────────────────────────────────────────────────────
function createNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const frames = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function useSolarFlareAudio({
  intensity,
  flareActive,
  solarWindSpeed = 450,
}: FlareAudioOptions): FlareAudioControls {
  const ctxRef        = useRef<AudioContext | null>(null);
  const masterRef     = useRef<GainNode | null>(null);
  const rumbleOscRef  = useRef<OscillatorNode | null>(null);
  const rumbleGainRef = useRef<GainNode | null>(null);
  const crackleRef    = useRef<AudioBufferSourceNode | null>(null);
  const crackleGainRef= useRef<GainNode | null>(null);
  const filterRef     = useRef<BiquadFilterNode | null>(null);
  const noiseBufRef   = useRef<AudioBuffer | null>(null);
  const pannerRef     = useRef<StereoPannerNode | null>(null);
  const [enabled, setEnabled] = useState(false);

  // ─── Bootstrap AudioContext (lazy — needs user gesture) ──────────────────
  const init = useCallback(() => {
    if (ctxRef.current) return;
    try {
      const ctx = new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      ctxRef.current = ctx;

      // Master gain (global mute)
      const master = ctx.createGain();
      master.gain.value = 0.18;
      master.connect(ctx.destination);
      masterRef.current = master;

      // Stereo panner — Sun sits center but slight right bias (cinematic)
      const panner = ctx.createStereoPanner();
      panner.pan.value = 0.05;
      panner.connect(master);
      pannerRef.current = panner;

      // ── Magnetic rumble: sine oscillator at 36 Hz ─────────────────────
      const rumbleGain = ctx.createGain();
      rumbleGain.gain.value = 0;
      rumbleGain.connect(panner);
      rumbleGainRef.current = rumbleGain;

      const rumble = ctx.createOscillator();
      rumble.type = 'sine';
      rumble.frequency.value = 36;
      rumble.connect(rumbleGain);
      rumble.start();
      rumbleOscRef.current = rumble;

      // ── Crackle noise: white noise → band-pass filter → gain ──────────
      const noiseBuf = createNoiseBuffer(ctx, 3);
      noiseBufRef.current = noiseBuf;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2800;
      filter.Q.value = 0.6;
      filterRef.current = filter;

      const crackleGain = ctx.createGain();
      crackleGain.gain.value = 0;
      crackleGain.connect(panner);
      crackleGainRef.current = crackleGain;

      filter.connect(crackleGain);

      const crackle = ctx.createBufferSource();
      crackle.buffer = noiseBuf;
      crackle.loop = true;
      crackle.connect(filter);
      crackle.start();
      crackleRef.current = crackle;

    } catch {
      // AudioContext not supported
    }
  }, []);

  // ─── Toggle on/off (user calls this from UI) ─────────────────────────────
  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      if (next) {
        init();
      } else {
        masterRef.current?.gain.setTargetAtTime(0, ctxRef.current?.currentTime ?? 0, 0.1);
      }
      return next;
    });
  }, [init]);

  // ─── Real-time audio parameter updates ───────────────────────────────────
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx || !enabled) return;

    const t = ctx.currentTime;
    const clampedInt = Math.min(3, Math.max(0, intensity));
    const windFactor = Math.min(1, (solarWindSpeed - 300) / 1200);

    // Rumble scales with solar activity
    const rumbleTargetGain = clampedInt * 0.09 + windFactor * 0.04;
    rumbleGainRef.current?.gain.setTargetAtTime(rumbleTargetGain, t, 0.4);

    // Oscillator frequency shifts up during extreme events (Doppler-like)
    const rumbleFreq = 36 + clampedInt * 12 + windFactor * 20;
    rumbleOscRef.current?.frequency.setTargetAtTime(rumbleFreq, t, 0.3);

    // Crackle kicks in only during active flares
    const crackleTarget = flareActive ? clampedInt * 0.12 + windFactor * 0.06 : 0;
    crackleGainRef.current?.gain.setTargetAtTime(crackleTarget, t, flareActive ? 0.15 : 0.8);

    // Filter frequency tracks CME energy
    const filterFreq = 1800 + windFactor * 2400;
    filterRef.current?.frequency.setTargetAtTime(filterFreq, t, 0.25);

    // Master: fade in when enabled
    masterRef.current?.gain.setTargetAtTime(0.18, t, 0.2);

  }, [enabled, intensity, flareActive, solarWindSpeed]);

  // ─── Cleanup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  return { enabled, toggle };
}
