/**
 * Tiny synthesised soundtrack + SFX. No assets, no network.
 * Everything starts from a user gesture so browsers stay happy.
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.musicTimer = 0;
    this.beat = 0;
    this.started = false;
    try {
      this.muted = localStorage.getItem('fruitseas.muted') === '1';
    } catch {
      /* ignore */
    }
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.75;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.17;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.55;
    this.sfxGain.connect(this.master);
    this.startAmbience();
    this.started = true;
  }

  setMuted(muted) {
    this.muted = muted;
    try {
      localStorage.setItem('fruitseas.muted', muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.75, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  noiseBuffer(seconds = 2) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  startAmbience() {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(3);
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.055;
    src.connect(filter).connect(gain).connect(this.musicGain);
    src.start();
  }

  note(freq, time, duration, gain = 0.1, type = 'triangle', dest = null) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain, time + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(env).connect(dest || this.musicGain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  /** Called from the game loop; schedules a gentle sea-shanty loop. */
  update(dt) {
    if (!this.ctx || this.muted) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.36;
    const t = this.ctx.currentTime + 0.02;
    const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];
    const beat = this.beat++;
    const step = beat % 16;
    if (step === 0 || step === 6 || step === 10) {
      this.note(110, t, 0.5, 0.07, 'sine');
    }
    if (step === 4 || step === 12) {
      this.note(146.83, t, 0.45, 0.045, 'sine');
    }
    if (step % 2 === 0 || Math.random() < 0.3) {
      const idx = [0, 2, 4, 5, 4, 2, 1, 3][step % 8];
      const octave = step > 7 && Math.random() < 0.5 ? 2 : 1;
      this.note(scale[idx] * octave, t, 0.3, 0.045, 'triangle');
    }
    if (step === 0) this.note(scale[0] / 2, t, 1.4, 0.035, 'sine');
  }

  blip(freq = 440, dur = 0.08, type = 'square', vol = 0.15) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.note(freq, t, dur, vol, type, this.sfxGain);
  }

  swing() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.18);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.exponentialRampToValueAtTime(1800, t + 0.12);
    filter.Q.value = 1.2;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(filter).connect(gain).connect(this.sfxGain);
    src.start(t);
  }

  hit(big = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(big ? 130 : 190, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(big ? 0.32 : 0.2, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(env).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.16);
    this.blip(big ? 70 : 110, 0.1, 'sine', 0.2);
  }

  coin() {
    this.blip(880, 0.07, 'triangle', 0.12);
    setTimeout(() => this.blip(1320, 0.1, 'triangle', 0.1), 55);
  }

  levelUp() {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.22, 'triangle', 0.16), i * 90);
    });
  }

  thunder() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.8);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 0.55);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.26, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    src.connect(filter).connect(gain).connect(this.sfxGain);
    src.start(t);
  }

  fire() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.5);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(260, t);
    filter.frequency.exponentialRampToValueAtTime(900, t + 0.35);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    src.connect(filter).connect(gain).connect(this.sfxGain);
    src.start(t);
  }

  freeze() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [1568, 2093, 2637].forEach((f, i) => this.note(f, t + i * 0.04, 0.5, 0.07, 'sine', this.sfxGain));
  }

  dash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.25);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 700;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(filter).connect(gain).connect(this.sfxGain);
    src.start(t);
  }

  splash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.35);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    src.connect(filter).connect(gain).connect(this.sfxGain);
    src.start(t);
  }

  error() {
    this.blip(160, 0.12, 'sawtooth', 0.12);
  }

  victory() {
    [392, 523, 659, 784, 1046, 1318].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.4, 'triangle', 0.14), i * 130);
    });
  }

  death() {
    [392, 330, 262, 196].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.4, 'sine', 0.16), i * 170);
    });
  }
}
