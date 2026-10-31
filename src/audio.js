/* Áudio sintetizado com WebAudio — sem arquivos externos. */

export class GameAudio {
  constructor() {
    this.ctx = null
    this.master = null
    this.noiseBuffer = null
    this.enabled = true
    this.volume = 0.7
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.enabled ? this.volume * 0.65 : 0
    this.master.connect(this.ctx.destination)

    const len = Math.floor(this.ctx.sampleRate * 0.7)
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    this.noiseBuffer = buffer
  }

  setVolume(v) {
    this.volume = v
    if (this.master) this.master.gain.value = this.enabled ? v * 0.65 : 0
  }

  setEnabled(on) {
    this.enabled = on
    if (this.master) this.master.gain.value = on ? this.volume * 0.65 : 0
  }

  noise(duration, filterFreq, gain, type = 'bandpass') {
    if (!this.ctx || !this.noiseBuffer) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = filterFreq
    filter.Q.value = 0.8
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    src.connect(filter).connect(g).connect(this.master)
    src.start(t)
    src.stop(t + duration + 0.02)
  }

  tone(from, to, duration, gain = 0.05, type = 'sine') {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(from, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + duration + 0.02)
  }

  play(name, variant = 'dirt') {
    if (!this.enabled) return
    this.init()
    if (!this.ctx) return
    switch (name) {
      case 'step': {
        const freq = { grass: 620, dirt: 520, stone: 1150, sand: 400, wood: 760, glass: 1700 }[variant] || 600
        this.noise(0.075, freq, 0.055)
        this.tone(90, 55, 0.05, 0.02)
        break
      }
      case 'break':
        this.noise(0.16, 1500, 0.13, 'lowpass')
        this.tone(190, 70, 0.13, 0.05, 'triangle')
        break
      case 'place':
        this.tone(170, 90, 0.09, 0.07, 'square')
        this.noise(0.05, 900, 0.04)
        break
      case 'click':
        this.tone(720, 520, 0.045, 0.04, 'square')
        break
      case 'oink':
        this.tone(230, 155, 0.13, 0.07, 'sawtooth')
        setTimeout(() => this.tone(210, 140, 0.11, 0.05, 'sawtooth'), 110)
        break
      case 'splash':
        this.noise(0.3, 950, 0.11, 'lowpass')
        break
      case 'land':
        this.noise(0.12, 300, 0.08, 'lowpass')
        this.tone(80, 40, 0.12, 0.05)
        break
      case 'fly':
        this.noise(0.22, 1300, 0.05, 'highpass')
        break
      case 'pop':
        this.tone(420, 900, 0.09, 0.045, 'sine')
        break
      default:
        break
    }
  }
}
