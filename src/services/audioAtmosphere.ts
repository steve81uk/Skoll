export class AudioAtmosphere {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private baseDrone: OscillatorNode | null = null;
  private harmonics: OscillatorNode | null = null;
  private rhythmLfo: OscillatorNode | null = null;
  private rhythmGain: GainNode | null = null;
  enabled = false;

  async enable() {
    if (this.enabled) return;
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.05;
    master.connect(ctx.destination);

    const base = ctx.createOscillator();
    base.type = 'sine';
    base.frequency.value = 60;

    const harm = ctx.createOscillator();
    harm.type = 'triangle';
    harm.frequency.value = 120;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.35;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;

    base.connect(master);
    harm.connect(master);
    lfo.connect(lfoGain);
    lfoGain.connect(master.gain);

    base.start();
    harm.start();
    lfo.start();

    this.ctx = ctx;
    this.master = master;
    this.baseDrone = base;
    this.harmonics = harm;
    this.rhythmLfo = lfo;
    this.rhythmGain = lfoGain;
    this.enabled = true;
  }

  disable() {
    if (!this.enabled) return;
    this.baseDrone?.stop();
    this.harmonics?.stop();
    this.rhythmLfo?.stop();
    this.ctx?.close();

    this.ctx = null;
    this.master = null;
    this.baseDrone = null;
    this.harmonics = null;
    this.rhythmLfo = null;
    this.rhythmGain = null;
    this.enabled = false;
  }

  updateFromTelemetry(kp: number, bz: number, windSpeed: number) {
    if (!this.enabled || !this.ctx || !this.baseDrone || !this.harmonics || !this.rhythmLfo || !this.rhythmGain) return;

    const t = this.ctx.currentTime;
    const basePitch = 40 + ((windSpeed - 300) / 500) * 80;
    this.baseDrone.frequency.setTargetAtTime(Math.max(30, Math.min(140, basePitch)), t, 0.4);

    const detune = bz < 0 ? Math.min(80, Math.abs(bz) * 5) : 0;
    this.harmonics.detune.setTargetAtTime(detune, t, 0.8);

    this.rhythmLfo.frequency.setTargetAtTime(0.2 + (kp / 9) * 1.4, t, 0.5);
    this.rhythmGain.gain.setTargetAtTime(0.01 + (kp / 9) * 0.05, t, 0.5);
  }

  triggerCMEArrival() {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0.1, t + 0.15);
    this.master.gain.linearRampToValueAtTime(0.05, t + 1.2);
  }
}
