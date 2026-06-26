// Lightweight web-audio sound engine - no external assets, no licensing concerns.
// All sounds are procedurally synthesized so the game works offline.

class SoundEngine {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    try {
      const stored = localStorage.getItem("ucl_draft_sound");
      if (stored !== null) this.enabled = stored === "true";
    } catch (_) {}
  }

  ensureCtx() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      } catch (_) {}
    }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  setEnabled(v) {
    this.enabled = !!v;
    try { localStorage.setItem("ucl_draft_sound", String(this.enabled)); } catch (_) {}
  }

  toggle() { this.setEnabled(!this.enabled); return this.enabled; }
  isEnabled() { return this.enabled; }

  _tone({ freq = 440, type = "sine", duration = 0.2, gain = 0.15, attack = 0.005, release = 0.08, freqEnd = null }) {
    if (!this.enabled) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration + release);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + release + 0.02);
  }

  _noise({ duration = 0.2, gain = 0.1, filterFreq = 1200 }) {
    if (!this.enabled) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = filterFreq;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + duration);
  }

  dice() {
    if (!this.enabled) return;
    this._noise({ duration: 0.5, gain: 0.12, filterFreq: 1800 });
    setTimeout(() => this._tone({ freq: 320, freqEnd: 180, duration: 0.15, type: "square", gain: 0.06 }), 60);
    setTimeout(() => this._tone({ freq: 240, freqEnd: 120, duration: 0.18, type: "square", gain: 0.05 }), 220);
    setTimeout(() => this._tone({ freq: 180, freqEnd: 90,  duration: 0.18, type: "square", gain: 0.04 }), 380);
  }

  cardReveal() {
    this._tone({ freq: 520, freqEnd: 900, duration: 0.18, type: "triangle", gain: 0.08 });
    setTimeout(() => this._tone({ freq: 760, freqEnd: 1180, duration: 0.16, type: "triangle", gain: 0.07 }), 90);
  }

  click() {
    this._tone({ freq: 700, duration: 0.05, type: "square", gain: 0.05 });
  }

  goal() {
    // crowd-ish roar + triumphant chord
    this._noise({ duration: 1.6, gain: 0.18, filterFreq: 700 });
    const base = 392;
    [0, 0.08, 0.16, 0.32].forEach((delay, idx) => {
      setTimeout(() => {
        this._tone({ freq: base * Math.pow(1.122, idx),  duration: 0.55, type: "sawtooth", gain: 0.07 });
        this._tone({ freq: base * 2 * Math.pow(1.122, idx), duration: 0.55, type: "triangle", gain: 0.05 });
      }, delay * 1000);
    });
  }

  whistleStart() {
    this._tone({ freq: 1800, duration: 0.35, type: "sine", gain: 0.1 });
    setTimeout(() => this._tone({ freq: 1800, duration: 0.25, type: "sine", gain: 0.08 }), 380);
  }

  whistleEnd() {
    this._tone({ freq: 1600, duration: 0.25, type: "sine", gain: 0.09 });
    setTimeout(() => this._tone({ freq: 1600, duration: 0.20, type: "sine", gain: 0.08 }), 270);
    setTimeout(() => this._tone({ freq: 1600, duration: 0.45, type: "sine", gain: 0.09 }), 510);
  }

  trophy() {
    // celebratory ascending arpeggio
    const notes = [392, 523, 659, 784, 988, 1174];
    notes.forEach((f, i) => setTimeout(() => {
      this._tone({ freq: f, duration: 0.3, type: "triangle", gain: 0.09 });
      this._tone({ freq: f * 2, duration: 0.3, type: "sine", gain: 0.05 });
    }, i * 110));
    setTimeout(() => this._noise({ duration: 1.2, gain: 0.12, filterFreq: 1200 }), 600);
  }

  error() {
    this._tone({ freq: 220, duration: 0.12, type: "sawtooth", gain: 0.08 });
    setTimeout(() => this._tone({ freq: 170, duration: 0.18, type: "sawtooth", gain: 0.07 }), 110);
  }

  swoosh() {
    this._noise({ duration: 0.25, gain: 0.07, filterFreq: 2400 });
  }
}

export const sound = new SoundEngine();
