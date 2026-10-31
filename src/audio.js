export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muffle = null;
    this.comp = null;
    this.convolver = null;
    this.dry = null;
    this.wet = null;
    this.noiseBuf = null;
    this.volume = 0.8;
    this.ambient = null;
    this.chaseTimer = null;
    this.chaseOn = false;
    this.hidden = false;
  }

  init() {
    if (this.ctx) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 18;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.3;
    comp.connect(ctx.destination);
    this.comp = comp;

    const muffle = ctx.createBiquadFilter();
    muffle.type = 'lowpass';
    muffle.frequency.value = 20000;
    muffle.Q.value = 0.4;
    muffle.connect(comp);
    this.muffle = muffle;

    const master = ctx.createGain();
    master.gain.value = this.volume;
    master.connect(muffle);
    this.master = master;

    const conv = ctx.createConvolver();
    conv.buffer = this.makeImpulse(2.6, 3.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    conv.connect(wet);
    wet.connect(master);
    this.convolver = conv;
    this.wet = wet;

    const dry = ctx.createGain();
    dry.gain.value = 1;
    dry.connect(master);
    this.dry = dry;

    this.noiseBuf = this.makeNoise(2.0);
    this.startAmbient();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  now() { return this.ctx ? this.ctx.currentTime : 0; }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.now(), 0.04);
  }

  setHidden(hidden) {
    this.hidden = hidden;
    if (!this.muffle) return;
    this.muffle.frequency.setTargetAtTime(hidden ? 620 : 20000, this.now(), 0.18);
  }

  makeNoise(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = white * 0.6 + last * 1.6;
    }
    return buf;
  }

  makeImpulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  route(node, wet = 0.22, pan = 0) {
    if (!this.ctx) return;
    const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    let out = node;
    if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p); out = p; }
    out.connect(this.dry);
    if (wet > 0) {
      const g = this.ctx.createGain();
      g.gain.value = wet;
      out.connect(g);
      g.connect(this.convolver);
    }
  }

  tone({ freq = 220, endFreq = null, type = 'sine', dur = 0.3, gain = 0.06, attack = 0.01, release = 0.2, wet = 0.2, pan = 0, filter = null, detune = 0 }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    if (detune) osc.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.02, dur + release));
    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type || 'lowpass';
      f.frequency.setValueAtTime(filter.freq || 800, t);
      if (filter.endFreq) f.frequency.exponentialRampToValueAtTime(Math.max(40, filter.endFreq), t + dur);
      f.Q.value = filter.q || 0.7;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    this.route(g, wet, pan);
    osc.start(t);
    osc.stop(t + dur + release + 0.05);
  }

  noise({ dur = 0.4, gain = 0.06, type = 'lowpass', freq = 800, endFreq = null, q = 0.8, attack = 0.005, release = 0.3, wet = 0.25, pan = 0, playbackRate = 1 }) {
    if (!this.ctx || !this.noiseBuf) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = playbackRate;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (endFreq) f.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.02, dur + release));
    src.connect(f); f.connect(g);
    this.route(g, wet, pan);
    src.start(t);
    src.stop(t + dur + release + 0.05);
  }

  startAmbient() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.032, t + 2.5);
    gain.connect(this.master);
    this.ambient = { gain, nodes: [] };

    const low = ctx.createOscillator();
    low.type = 'sine'; low.frequency.value = 43;
    const lowG = ctx.createGain(); lowG.gain.value = 0.5;
    low.connect(lowG); lowG.connect(gain);

    const fifth = ctx.createOscillator();
    fifth.type = 'triangle'; fifth.frequency.value = 64.5; fifth.detune.value = -6;
    const fifthG = ctx.createGain(); fifthG.gain.value = 0.18;
    fifth.connect(fifthG); fifthG.connect(gain);

    const air = ctx.createBufferSource();
    air.buffer = this.noiseBuf; air.loop = true;
    const airF = ctx.createBiquadFilter(); airF.type = 'lowpass'; airF.frequency.value = 170; airF.Q.value = 0.6;
    const airG = ctx.createGain(); airG.gain.value = 0.18;
    air.connect(airF); airF.connect(airG); airG.connect(gain);

    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.055;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.012;
    lfo.connect(lfoG); lfoG.connect(gain.gain);

    low.start(t); fifth.start(t); air.start(t); lfo.start(t);
    this.ambient.nodes.push(low, fifth, air, lfo);
  }

  setAmbientLevel(v) {
    if (!this.ambient) return;
    this.ambient.gain.gain.setTargetAtTime(Math.max(0.0001, v), this.now(), 0.5);
  }

  /* ---------------- one shots ---------------- */

  footstep(run = false, quiet = false, pan = 0) {
    const g = quiet ? 0.018 : run ? 0.055 : 0.032;
    this.noise({ dur: run ? 0.12 : 0.16, gain: g, type: 'lowpass', freq: run ? 520 : 340, endFreq: 120, q: 1.2, wet: 0.12, pan });
    this.tone({ freq: run ? 78 : 62, endFreq: 38, type: 'sine', dur: 0.1, gain: g * 0.65, wet: 0.08, pan });
  }

  doorCreak(pan = 0) {
    this.tone({ freq: 170, endFreq: 78, type: 'sawtooth', dur: 0.9, gain: 0.025, attack: 0.12, release: 0.35, wet: 0.4, pan, filter: { type: 'bandpass', freq: 500, endFreq: 260, q: 4 } });
    this.noise({ dur: 0.85, gain: 0.022, type: 'bandpass', freq: 900, endFreq: 300, q: 3, wet: 0.4, pan });
  }

  doorSlam(pan = 0) {
    this.noise({ dur: 0.32, gain: 0.12, type: 'lowpass', freq: 1600, endFreq: 80, q: 0.9, wet: 0.5, pan });
    this.tone({ freq: 90, endFreq: 34, type: 'sine', dur: 0.4, gain: 0.12, wet: 0.3, pan });
  }

  unlock() {
    this.noise({ dur: 0.07, gain: 0.05, type: 'highpass', freq: 2200, wet: 0.15 });
    this.tone({ freq: 880, dur: 0.18, gain: 0.035, wet: 0.25 });
    this.tone({ freq: 1320, dur: 0.22, gain: 0.025, wet: 0.3, attack: 0.02 });
  }

  key() {
    this.tone({ freq: 1046, dur: 0.5, gain: 0.03, wet: 0.5, attack: 0.01 });
    this.tone({ freq: 1568, dur: 0.65, gain: 0.02, wet: 0.55, attack: 0.02 });
  }

  pickup() {
    this.tone({ freq: 660, dur: 0.18, gain: 0.03, wet: 0.2 });
    this.tone({ freq: 990, dur: 0.3, gain: 0.025, wet: 0.25, attack: 0.02 });
  }

  battery() {
    this.tone({ freq: 320, endFreq: 640, type: 'triangle', dur: 0.25, gain: 0.03, wet: 0.15 });
    this.tone({ freq: 960, dur: 0.4, gain: 0.02, wet: 0.2, attack: 0.03 });
  }

  bandage() {
    this.noise({ dur: 0.5, gain: 0.035, type: 'bandpass', freq: 1800, endFreq: 700, q: 1.5, wet: 0.2 });
  }

  flashlight(click = true) {
    this.noise({ dur: 0.035, gain: click ? 0.04 : 0.02, type: 'highpass', freq: 2400, wet: 0.05 });
    if (click) this.tone({ freq: 210, endFreq: 160, type: 'square', dur: 0.03, gain: 0.012, wet: 0 });
  }

  flicker() {
    this.tone({ freq: 60, type: 'sawtooth', dur: 0.22, gain: 0.016, wet: 0.1, filter: { type: 'lowpass', freq: 400 } });
    this.noise({ dur: 0.16, gain: 0.014, type: 'highpass', freq: 1600, wet: 0.1 });
  }

  hurt() {
    this.tone({ freq: 150, endFreq: 46, type: 'sawtooth', dur: 0.45, gain: 0.1, wet: 0.35 });
    this.noise({ dur: 0.35, gain: 0.07, type: 'lowpass', freq: 900, endFreq: 120, wet: 0.3 });
  }

  rushRoar(pan = 0) {
    this.noise({ dur: 2.8, gain: 0.13, type: 'lowpass', freq: 180, endFreq: 2400, q: 1.1, attack: 0.5, release: 0.6, wet: 0.5, pan });
    this.tone({ freq: 38, endFreq: 92, type: 'sawtooth', dur: 2.6, gain: 0.05, attack: 0.7, wet: 0.35, filter: { type: 'lowpass', freq: 300, endFreq: 900 } });
    this.tone({ freq: 180, endFreq: 420, type: 'square', dur: 2.2, gain: 0.012, attack: 0.8, wet: 0.4, pan });
  }

  rushPass(pan = 0) {
    this.noise({ dur: 0.85, gain: 0.16, type: 'bandpass', freq: 1800, endFreq: 220, q: 1.4, attack: 0.02, release: 0.35, wet: 0.45, pan });
    this.tone({ freq: 120, endFreq: 40, type: 'sawtooth', dur: 0.75, gain: 0.07, wet: 0.25, pan });
  }

  ambushGrowl(pan = 0) {
    this.tone({ freq: 64, endFreq: 42, type: 'sawtooth', dur: 1.4, gain: 0.055, attack: 0.25, release: 0.5, wet: 0.4, pan, filter: { type: 'lowpass', freq: 220, endFreq: 120 } });
    this.noise({ dur: 1.2, gain: 0.04, type: 'bandpass', freq: 300, endFreq: 160, q: 2, wet: 0.35, pan });
  }

  screechWhisper(pan = 0) {
    this.noise({ dur: 0.18, gain: 0.03, type: 'bandpass', freq: 2600, endFreq: 1800, q: 4, wet: 0.2, pan });
    setTimeout(() => this.noise({ dur: 0.22, gain: 0.028, type: 'bandpass', freq: 2200, endFreq: 3200, q: 5, wet: 0.2, pan }), 190);
  }

  screechScream(pan = 0) {
    this.tone({ freq: 1500, endFreq: 320, type: 'sawtooth', dur: 0.75, gain: 0.11, attack: 0.005, wet: 0.4, pan });
    this.tone({ freq: 2300, endFreq: 900, type: 'square', dur: 0.55, gain: 0.03, attack: 0.005, wet: 0.3, pan });
    this.noise({ dur: 0.7, gain: 0.1, type: 'highpass', freq: 1400, endFreq: 500, wet: 0.35, pan });
  }

  haltWhisper(pan = 0) {
    this.noise({ dur: 1.8, gain: 0.05, type: 'bandpass', freq: 420, endFreq: 220, q: 2.5, attack: 0.5, release: 0.8, wet: 0.6, pan });
    this.tone({ freq: 88, endFreq: 62, type: 'sine', dur: 1.7, gain: 0.04, attack: 0.5, release: 0.6, wet: 0.5, pan });
    this.tone({ freq: 176, endFreq: 124, type: 'triangle', dur: 1.5, gain: 0.018, attack: 0.6, wet: 0.5, pan });
  }

  haltHit(pan = 0) {
    this.tone({ freq: 240, endFreq: 40, type: 'sawtooth', dur: 0.9, gain: 0.14, wet: 0.4, pan });
    this.noise({ dur: 0.8, gain: 0.13, type: 'lowpass', freq: 1600, endFreq: 100, wet: 0.4, pan });
  }

  figureStep(pan = 0, loud = 1) {
    this.tone({ freq: 54, endFreq: 28, type: 'sine', dur: 0.22, gain: 0.11 * loud, wet: 0.25, pan });
    this.noise({ dur: 0.18, gain: 0.05 * loud, type: 'lowpass', freq: 260, endFreq: 70, wet: 0.2, pan });
  }

  figureRoar(pan = 0) {
    this.tone({ freq: 72, endFreq: 38, type: 'sawtooth', dur: 2.2, gain: 0.08, attack: 0.25, release: 0.8, wet: 0.5, pan, filter: { type: 'lowpass', freq: 340, endFreq: 120 } });
    this.noise({ dur: 2.0, gain: 0.07, type: 'bandpass', freq: 220, endFreq: 90, q: 2, attack: 0.4, release: 0.7, wet: 0.45, pan });
    this.tone({ freq: 144, endFreq: 70, type: 'square', dur: 1.6, gain: 0.015, attack: 0.4, wet: 0.4, pan });
  }

  heartbeat(intensity = 1) {
    const g = 0.07 + intensity * 0.07;
    this.tone({ freq: 52, endFreq: 32, type: 'sine', dur: 0.12, gain: g, wet: 0.1 });
    setTimeout(() => this.tone({ freq: 46, endFreq: 28, type: 'sine', dur: 0.16, gain: g * 0.7, wet: 0.1 }), 150);
  }

  elevatorDing() {
    this.tone({ freq: 784, dur: 1.0, gain: 0.04, wet: 0.6, attack: 0.01 });
    this.tone({ freq: 1175, dur: 1.2, gain: 0.022, wet: 0.6, attack: 0.01 });
  }

  checkpoint() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone({ freq: f, dur: 0.7, gain: 0.025, wet: 0.6, attack: 0.02 }), i * 90));
  }

  win() {
    [392, 523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone({ freq: f, dur: 1.6, gain: 0.04, wet: 0.7, attack: 0.02 }), i * 180));
    this.tone({ freq: 65, dur: 3.2, gain: 0.05, wet: 0.3, attack: 0.5 });
  }

  death() {
    this.tone({ freq: 180, endFreq: 34, type: 'sawtooth', dur: 2.0, gain: 0.12, wet: 0.5 });
    this.tone({ freq: 90, endFreq: 42, type: 'square', dur: 1.8, gain: 0.05, wet: 0.4 });
    this.noise({ dur: 1.4, gain: 0.09, type: 'lowpass', freq: 1200, endFreq: 80, wet: 0.5 });
    this.tone({ freq: 1400, endFreq: 220, type: 'sawtooth', dur: 0.8, gain: 0.05, wet: 0.4 });
  }

  ui() {
    this.tone({ freq: 520, dur: 0.06, gain: 0.015, wet: 0.1 });
    this.noise({ dur: 0.03, gain: 0.012, type: 'highpass', freq: 3000, wet: 0.05 });
  }

  startChase() {
    if (!this.ctx || this.chaseOn) return;
    this.chaseOn = true;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.value = 0.0001;
    bus.gain.exponentialRampToValueAtTime(0.55, t + 0.5);
    bus.connect(this.master);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 520; filter.Q.value = 3;
    filter.connect(bus);

    const bass = ctx.createOscillator();
    bass.type = 'sawtooth'; bass.frequency.value = 55;
    const bassG = ctx.createGain(); bassG.gain.value = 0.055;
    bass.connect(bassG); bassG.connect(filter);

    const pulse = ctx.createOscillator();
    pulse.type = 'square'; pulse.frequency.value = 3.1;
    const pulseG = ctx.createGain(); pulseG.gain.value = 0.04;
    pulse.connect(pulseG); pulseG.connect(bassG.gain);

    const high = ctx.createOscillator();
    high.type = 'triangle'; high.frequency.value = 466; high.detune.value = 7;
    const highG = ctx.createGain(); highG.gain.value = 0.008;
    high.connect(highG); highG.connect(bus);

    bass.start(t); pulse.start(t); high.start(t);
    this.chase = { bus, nodes: [bass, pulse, high] };
  }

  stopChase() {
    if (!this.chaseOn || !this.ctx) return;
    this.chaseOn = false;
    const t = this.now();
    this.chase.bus.gain.cancelScheduledValues(t);
    this.chase.bus.gain.setTargetAtTime(0.0001, t, 0.25);
    for (const n of this.chase.nodes) {
      try { n.stop(t + 1.4); } catch (e) { /* noop */ }
    }
    this.chase = null;
  }

  pause() {
    this.suspend();
  }

  resumeFromPause() {
    this.resume();
  }
}
