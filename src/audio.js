// Fully synthesised audio: ocean ambience, a sparse adventure score, and SFX.
// Nothing is loaded from the network, and the context starts on the first click.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = localStorage.getItem('fruitbound-muted') === '1';
    this.timer = null;
    this.step = 0;
    this.noiseBuffer = null;
    this.enabled = false;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 5;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0.18; this.musicGain.connect(this.master);
    this.sfxGain = ctx.createGain(); this.sfxGain.gain.value = 0.55; this.sfxGain.connect(this.master);

    const len = ctx.sampleRate * 2.5;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    this.noiseBuffer = buffer;

    this.startAmbience();
    this.startMusic();
    this.enabled = true;
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem('fruitbound-muted', m ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.12);
  }

  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  startAmbience() {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer; source.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.4;
    const gain = ctx.createGain(); gain.gain.value = 0.055;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.032;
    lfo.connect(lfoGain); lfoGain.connect(gain.gain);
    source.connect(lp); lp.connect(gain); gain.connect(this.master);
    source.start(); lfo.start();

    // High, airy wind.
    const wind = ctx.createBufferSource(); wind.buffer = this.noiseBuffer; wind.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1600;
    const wg = ctx.createGain(); wg.gain.value = 0.012;
    const wlfo = ctx.createOscillator(); wlfo.frequency.value = 0.05;
    const wlg = ctx.createGain(); wlg.gain.value = 0.009;
    wlfo.connect(wlg); wlg.connect(wg.gain);
    wind.connect(hp); hp.connect(wg); wg.connect(this.master);
    wind.start(); wlfo.start();
  }

  startMusic() {
    if (this.timer) return;
    const chord = [146.83, 174.61, 220.0, 261.63];
    const melody = [293.66, 349.23, 440.0, 392.0, 349.23, 293.66, 261.63, 220.0];
    this.pad(chord, 9);
    this.timer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const note = melody[this.step % melody.length];
      this.pluck(note, t, 0.05, 0.5);
      if (this.step % 4 === 0) this.pluck(note / 2, t, 0.045, 1.4);
      if (this.step % 8 === 4) this.pad(chord.map(f => f * (Math.random() > 0.5 ? 1 : 1.5)), 8);
      this.step++;
    }, 620);
  }

  pad(freqs, seconds) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    for (const f of freqs) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 1.004;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.035, t + 1.2);
      g.gain.linearRampToValueAtTime(0.0, t + seconds);
      o.connect(g); o2.connect(g); g.connect(this.musicGain);
      o.start(t); o2.start(t); o.stop(t + seconds + 0.1); o2.stop(t + seconds + 0.1);
    }
  }

  pluck(freq, t, gain = 0.05, decay = 0.8) {
    const ctx = this.ctx; if (!ctx) return;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.musicGain);
    o.start(t); o2.start(t); o.stop(t + decay); o2.stop(t + decay);
  }

  noise(duration, { gain = 0.2, type = 'bandpass', freq = 1200, q = 1, freqEnd = null } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, ctx.currentTime); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(); src.stop(ctx.currentTime + duration + 0.02);
  }

  tone(freq, duration, { type = 'sine', gain = 0.16, slide = 0, delay = 0 } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + duration + 0.02);
  }

  swing() { this.noise(0.18, { gain: 0.18, freq: 900, freqEnd: 2600, q: 1.2 }); }
  hit(crit = false) {
    this.noise(0.12, { gain: crit ? 0.32 : 0.2, freq: 420, freqEnd: 130, q: 0.8 });
    this.tone(crit ? 150 : 190, 0.13, { type: 'square', gain: 0.09, slide: 70 });
  }
  dash() { this.noise(0.30, { gain: 0.16, freq: 350, freqEnd: 1400, q: 0.9 }); }
  fireball() {
    this.noise(0.42, { gain: 0.2, freq: 600, freqEnd: 170, q: 0.6 });
    this.tone(220, 0.3, { type: 'sawtooth', gain: 0.06, slide: 80 });
  }
  explosion() {
    this.noise(0.7, { gain: 0.42, type: 'lowpass', freq: 900, freqEnd: 80, q: 0.5 });
    this.tone(70, 0.6, { type: 'sine', gain: 0.3, slide: 32 });
    this.noise(0.2, { gain: 0.2, type: 'highpass', freq: 1600 });
  }
  coin() {
    this.tone(980, 0.08, { type: 'triangle', gain: 0.09 });
    this.tone(1460, 0.14, { type: 'triangle', gain: 0.06, delay: 0.05 });
  }
  heal() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, { type: 'sine', gain: 0.07, delay: i * 0.08 }));
  }
  levelUp() {
    [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.7, { type: 'triangle', gain: 0.10, delay: i * 0.09 }));
  }
  quest() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.8, { type: 'sine', gain: 0.09, delay: i * 0.1 }));
  }
  click() { this.tone(660, 0.06, { type: 'sine', gain: 0.06 }); }
  error() { this.tone(180, 0.16, { type: 'square', gain: 0.05, slide: 120 }); }
  chest() {
    this.noise(0.4, { gain: 0.1, freq: 700, freqEnd: 2400 });
    [523, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.45, { type: 'triangle', gain: 0.07, delay: 0.15 + i * 0.06 }));
  }
  roar() {
    this.noise(1.1, { gain: 0.35, type: 'lowpass', freq: 240, freqEnd: 70, q: 2 });
    this.tone(58, 1.0, { type: 'sawtooth', gain: 0.12, slide: 38 });
  }
  wave() { this.noise(0.8, { gain: 0.16, freq: 240, freqEnd: 900, q: 0.5 }); }
  board() { this.noise(0.5, { gain: 0.09, freq: 500, freqEnd: 200 }); }
  hurt() { this.tone(120, 0.25, { type: 'sawtooth', gain: 0.08, slide: 60 }); }
}
