/**
 * SKÖLL-TRACK — SOLAR AUDIO SONIFICATION HOOK
 *
 * Translates live space-weather telemetry into a real-time generative audio
 * landscape using the Web Audio API. Each metric drives a distinct audio
 * parameter, creating a continuous "earcon" system for ambient situational
 * awareness without requiring eyes on the screen.
 *
 * Mapping design (planned):
 *   Kp Index        → master drone frequency (150Hz base, +8Hz per Kp unit)
 *   Solar wind      → filter cutoff sweep (slow at 400 km/s, sweeping at 800+)
 *   Bz component    → stereo panning (positive Bz = centre, negative = L/R sweep)
 *   Flare class     → percussive strike (C=soft ping, M=hit, X=resonant boom)
 *   Kessler risk    → background noise floor (white noise gain 0–0.15)
 *
 * Status: SCAFFOLD — AudioContext setup and parameter types defined; synthesis pending.
 */
/**
 * SKÖLL-TRACK — SOLAR AUDIO SONIFICATION HOOK
 *
 * Translates live space-weather telemetry into a real-time generative audio
 * landscape using the Web Audio API.
 *
 * Signal chain:
 *   sawtooth osc (Kp→freq) → LPF (wind→cutoff) → StereoPanner (Bz→pan)
 *     → MasterGain → destination
 *   LFO (sine, 0.18 Hz) → droneDetune  (subtle warm wobble ±3 Hz)
 *   WhiteNoise → BPF → NoiseGain (kesslerRisk→gain) → MasterGain
 *
 * Parameter mappings:
 *   kpIndex          → drone base freq  : 120 + kp × 8 Hz
 *   solarWindSpeed   → LPF cutoff       : 80 + (speed−300)/600 × 400 Hz
 *   bzGsm            → stereo pan       : clamp(bz/25, −0.8, 0.8)
 *   kesslerRisk      → noise floor gain : risk × 0.04
 *
 * AudioContext is created strictly inside start() — called from a user-gesture
 * onClick handler — to satisfy browser autoplay policies.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface SonificationParams {
  kpIndex: number;
  solarWindSpeed: number;
  bzGsm: number;
  flareClass: string;
  kesslerRisk: number;
}

export interface SonificationState {
  active: boolean;
  /** Master volume 0–1 */
  volume: number;
  /** Current drone base frequency in Hz */
  droneFrequencyHz: number;
}

// ─── Internal node bundle ─────────────────────────────────────────────────────
interface AudioNodes {
  ctx: AudioContext;
  drone: OscillatorNode;
  filter: BiquadFilterNode;
  panner: StereoPannerNode;
  master: GainNode;
  noiseGain: GainNode;
}

function buildAudioGraph(ctx: AudioContext, params: SonificationParams, volume: number): AudioNodes {
  const master = ctx.createGain();
  master.gain.value = volume * 0.12;
  master.connect(ctx.destination);

  const drone = ctx.createOscillator();
  drone.type = 'sawtooth';
  drone.frequency.value = 120 + params.kpIndex * 8;

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.18;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 3.0;
  lfo.connect(lfoGain);
  lfoGain.connect(drone.detune);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 3.5;
  filter.frequency.value = Math.max(60, 80 + Math.max(0, (params.solarWindSpeed - 300) / 600) * 400);

  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.max(-0.8, Math.min(0.8, params.bzGsm / 25));

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) { noiseData[i] = Math.random() * 2 - 1; }
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  noiseSource.loop = true;
  const noiseBpf = ctx.createBiquadFilter();
  noiseBpf.type = 'bandpass';
  noiseBpf.frequency.value = 200;
  noiseBpf.Q.value = 0.5;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = params.kesslerRisk * 0.04;
  noiseSource.connect(noiseBpf);
  noiseBpf.connect(noiseGain);
  noiseGain.connect(master);
  noiseSource.start();

  drone.connect(filter);
  filter.connect(panner);
  panner.connect(master);
  lfo.start();
  drone.start();

  return { ctx, drone, filter, panner, master, noiseGain };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useSolarSonification(params: SonificationParams): SonificationState & {
  start: () => void;
  stop: () => void;
  setVolume: (v: number) => void;
  triggerCME: () => void;
} {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nodesRef    = useRef<AudioNodes | null>(null);
  const [active, setActive]      = useState(false);
  const [volume, setVolumeState] = useState(0.4);

  const droneFrequencyHz = 120 + params.kpIndex * 8;

  // Must be called directly from a user-gesture onClick
  const start = useCallback(() => {
    if (active) return;
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      if (!nodesRef.current) {
        nodesRef.current = buildAudioGraph(ctx, params, volume);
      }
      setActive(true);
    } catch (err) {
      console.warn('[useSolarSonification] AudioContext failed to start:', err);
    }
  // params omitted — synced reactively below
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, volume]);

  const stop = useCallback(() => {
    if (!active || !nodesRef.current) return;
    const { ctx, master } = nodesRef.current;
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    window.setTimeout(() => void ctx.suspend(), 600);
    setActive(false);
  }, [active]);

  const triggerCME = useCallback(() => {
    if (!active || !nodesRef.current) return;
    const { ctx, master } = nodesRef.current;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(volume * 0.12, t);
    master.gain.linearRampToValueAtTime(volume * 0.55, t + 0.08);
    master.gain.setTargetAtTime(volume * 0.12, t + 0.08, 0.9);
  }, [active, volume]);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (nodesRef.current) {
      const { ctx, master } = nodesRef.current;
      master.gain.setTargetAtTime(clamped * 0.12, ctx.currentTime, 0.1);
    }
  }, []);

  useEffect(() => {
    if (!active || !nodesRef.current) return;
    const { ctx, drone, filter, panner, noiseGain } = nodesRef.current;
    const t = ctx.currentTime;
    drone.frequency.setTargetAtTime(120 + params.kpIndex * 8, t, 0.5);
    filter.frequency.setTargetAtTime(
      Math.max(60, 80 + Math.max(0, (params.solarWindSpeed - 300) / 600) * 400), t, 0.8,
    );
    panner.pan.setTargetAtTime(Math.max(-0.8, Math.min(0.8, params.bzGsm / 25)), t, 1.0);
    noiseGain.gain.setTargetAtTime(params.kesslerRisk * 0.04, t, 2.0);
  }, [active, params.kpIndex, params.solarWindSpeed, params.bzGsm, params.kesslerRisk]);

  useEffect(() => {
    return () => {
      try { nodesRef.current?.drone.stop(); } catch { /* already stopped */ }
      void audioCtxRef.current?.close();
      nodesRef.current = null;
    };
  }, []);

  return { active, volume, droneFrequencyHz, start, stop, setVolume, triggerCME };
}
