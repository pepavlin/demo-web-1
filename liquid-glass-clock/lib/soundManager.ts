/**
 * SoundManager – audio engine for the 3D game.
 *
 * Sheep bleat uses a real recorded sample (CC0 public domain from BigSoundBank).
 * All other sounds are generated via the Web Audio API procedurally.
 * Call `soundManager.init()` on the first user interaction (pointer lock),
 * then use the individual play* methods throughout the game loop.
 */

// Paths to recorded sheep bleat samples (CC0 – BigSoundBank #2343)
const SHEEP_BLEAT_SOURCES = ["/sounds/sheep-bleat.ogg", "/sounds/sheep-bleat.mp3"];

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private musicTimeout: ReturnType<typeof setTimeout> | null = null;
  private windTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Decoded sheep bleat buffer – null until loaded or if load failed. */
  private _sheepBuffer: AudioBuffer | null = null;
  private _sheepBufferLoading = false;

  private _muted = false;
  private _masterVolume = 0.75;
  private _musicVolume = 0.38;
  private _sfxVolume = 0.72;
  private _isDayTime = true;

  // ── Bootstrap (must be called from a user-gesture handler) ──────────────
  init(): void {
    if (this.ctx) {
      // Already initialised — just resume if suspended
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }
      return;
    }

    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._muted ? 0 : this._masterVolume;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this._musicVolume;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this._sfxVolume;
    this.sfxGain.connect(this.masterGain);

    this._scheduleAmbientChunk(0);
    this._scheduleWindGust();
    this._loadSheepBuffer();
  }

  /** Fetch and decode the sheep bleat sample. Tries OGG first, then MP3. */
  private _loadSheepBuffer(): void {
    if (this._sheepBufferLoading || this._sheepBuffer || !this.ctx) return;
    this._sheepBufferLoading = true;

    const tryNext = (sources: string[]): void => {
      if (!sources.length || !this.ctx) return;
      const [url, ...rest] = sources;
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.arrayBuffer();
        })
        .then((ab) => this.ctx!.decodeAudioData(ab))
        .then((buf) => {
          this._sheepBuffer = buf;
        })
        .catch(() => tryNext(rest));
    };

    tryNext(SHEEP_BLEAT_SOURCES);
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  private _noiseBuffer(duration: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.ceil(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Play a shaped noise burst through a biquad filter. */
  private _noiseBurst(
    freq: number,
    filterType: BiquadFilterType,
    peakGain: number,
    duration: number,
    Q = 1,
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(duration);

    const flt = ctx.createBiquadFilter();
    flt.type = filterType;
    flt.frequency.value = freq;
    flt.Q.value = Q;

    const g = ctx.createGain();
    g.gain.setValueAtTime(peakGain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    src.connect(flt);
    flt.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + duration);
  }

  // ── Ambient music ────────────────────────────────────────────────────────

  private _scheduleAmbientChunk(delayMs: number): void {
    this.musicTimeout = setTimeout(() => {
      this._playAmbientPad();
      // Next chord stab in 9-14 s
      this._scheduleAmbientChunk(9000 + Math.random() * 5000);
    }, delayMs);
  }

  private _playAmbientPad(): void {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const out = this.musicGain;

    // Day → C-major feel; Night → A-minor feel
    const basePitches = this._isDayTime
      ? [130.81, 164.81, 196.0, 261.63] // C3 E3 G3 C4
      : [110.0, 130.81, 164.81, 196.0]; // A2 C3 E3 G3

    const padDuration = 12;

    basePitches.forEach((baseHz, idx) => {
      // Fundamental + one octave overtone
      [1, 2].forEach((harmonic) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = baseHz * harmonic + (Math.random() - 0.5) * 6;

        const env = ctx.createGain();
        const startT = ctx.currentTime + idx * 0.25 + Math.random() * 0.3;
        const vol = (this._isDayTime ? 0.05 : 0.04) / harmonic;

        env.gain.setValueAtTime(0, startT);
        env.gain.linearRampToValueAtTime(vol, startT + 2);
        env.gain.setValueAtTime(vol, startT + padDuration - 2.5);
        env.gain.linearRampToValueAtTime(0, startT + padDuration);

        // Slow tremolo LFO
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.25 + Math.random() * 0.2;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = vol * 0.12;
        lfo.connect(lfoGain);
        lfoGain.connect(env.gain);

        osc.connect(env);
        env.connect(out);

        osc.start(startT);
        lfo.start(startT);
        osc.stop(startT + padDuration);
        lfo.stop(startT + padDuration);
      });
    });

    // Subtle bass pulse on root
    const bass = ctx.createOscillator();
    bass.type = "sine";
    bass.frequency.value = this._isDayTime ? 65.41 : 55.0; // C2 or A1
    const bassEnv = ctx.createGain();
    const bt = ctx.currentTime;
    bassEnv.gain.setValueAtTime(0, bt);
    bassEnv.gain.linearRampToValueAtTime(0.045, bt + 1.5);
    bassEnv.gain.setValueAtTime(0.045, bt + padDuration - 2);
    bassEnv.gain.linearRampToValueAtTime(0, bt + padDuration);
    bass.connect(bassEnv);
    bassEnv.connect(out);
    bass.start(bt);
    bass.stop(bt + padDuration);
  }

  // ── Wind ambience ────────────────────────────────────────────────────────

  private _scheduleWindGust(): void {
    const delay = (3 + Math.random() * 8) * 1000;
    this.windTimeout = setTimeout(() => {
      this._playWindGust();
      this._scheduleWindGust();
    }, delay);
  }

  private _playWindGust(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const duration = 2 + Math.random() * 2.5;
    const t = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(duration);

    const flt = ctx.createBiquadFilter();
    flt.type = "bandpass";
    flt.frequency.value = 300 + Math.random() * 700;
    flt.Q.value = 0.25 + Math.random() * 0.4;

    const env = ctx.createGain();
    const peak = 0.055 + Math.random() * 0.035;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(peak, t + duration * 0.35);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    src.connect(flt);
    flt.connect(env);
    env.connect(this.sfxGain);
    src.start(t);
    src.stop(t + duration);
  }

  // ── Public sound effects ─────────────────────────────────────────────────

  /**
   * Footstep – short filtered noise thud.
   * @param isRunning  true while sprinting
   */
  playFootstep(isRunning: boolean): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Low-thud noise
    const freq = isRunning ? 180 + Math.random() * 90 : 130 + Math.random() * 70;
    const gain = isRunning ? 0.28 : 0.18;
    this._noiseBurst(freq, "lowpass", gain, 0.09);

    // Subtle tonal click
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 70 + Math.random() * 30;

    const env = ctx.createGain();
    env.gain.setValueAtTime(gain * 0.45, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);

    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  /** Short ascending sweep played on jump. */
  playJump(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.14);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.28, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  /** Ascending arpeggio (C-E-G-C) played on coin pickup. */
  playCoinCollect(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;

    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    freqs.forEach((hz, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = hz;

      const t = ctx.currentTime + i * 0.075;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.3, t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

      osc.connect(env);
      env.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }

  /**
   * Sheep bleat – plays the recorded sample when available, procedural fallback otherwise.
   * @param volume  Spatial volume in [0, 1] – 1 = closest (max volume), 0 = inaudible.
   *                Use distance-based attenuation: volume = 1 - dist / maxDist.
   *                Multiple calls are independent, so several sheep can bleat simultaneously.
   */
  playSheepBleat(volume: number = 1): void {
    if (!this.ctx || !this.sfxGain) return;
    const vol = Math.max(0, Math.min(1, volume));
    // Skip completely inaudible bleats to save resources
    if (vol < 0.01) return;

    if (this._sheepBuffer) {
      this._playSheepSample(vol);
    } else {
      this._playSheepProceduralFallback(vol);
    }
  }

  /** Play the decoded sheep audio buffer at a randomised pitch and given volume. */
  private _playSheepSample(volume: number): void {
    if (!this.ctx || !this.sfxGain || !this._sheepBuffer) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this._sheepBuffer;
    // Slight random pitch variation so repeated bleats sound natural
    src.playbackRate.value = 0.92 + Math.random() * 0.16;

    const peak = 0.85 * volume;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.02);
    env.gain.setValueAtTime(peak, t + this._sheepBuffer.duration - 0.08);
    env.gain.linearRampToValueAtTime(0, t + this._sheepBuffer.duration);

    src.connect(env);
    env.connect(this.sfxGain);
    src.start(t);
  }

  /**
   * Procedural sheep bleat – used before the sample has loaded.
   * Replaced the old sawtooth version with a softer sine-based approach
   * to avoid the "creaking door" quality.
   */
  private _playSheepProceduralFallback(volume: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = 0.8;

    // Nasal body: sine carrier with slow vibrato, pitched like a real bleat (~300 Hz)
    const carrier = ctx.createOscillator();
    carrier.type = "sine";
    carrier.frequency.setValueAtTime(310, t);
    carrier.frequency.linearRampToValueAtTime(370, t + 0.12);
    carrier.frequency.linearRampToValueAtTime(280, t + 0.5);
    carrier.frequency.linearRampToValueAtTime(260, t + duration);

    // Vibrato (6–9 Hz tremor)
    const vib = ctx.createOscillator();
    vib.frequency.value = 6 + Math.random() * 3;
    const vibGain = ctx.createGain();
    vibGain.gain.value = 18;
    vib.connect(vibGain);
    vibGain.connect(carrier.frequency);

    // Bandpass mimicking nasal cavity resonance
    const flt = ctx.createBiquadFilter();
    flt.type = "bandpass";
    flt.frequency.value = 700;
    flt.Q.value = 1.2;

    const peak = 0.22 * volume;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.05);
    env.gain.setValueAtTime(peak, t + duration - 0.15);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    carrier.connect(flt);
    flt.connect(env);
    env.connect(this.sfxGain);
    carrier.start(t);
    vib.start(t);
    carrier.stop(t + duration);
    vib.stop(t + duration);
  }

  /** Low growl played when a fox is chasing the player. */
  playFoxGrowl(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const dur = 0.45;

    // Noise component
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur);
    const nFlt = ctx.createBiquadFilter();
    nFlt.type = "bandpass";
    nFlt.frequency.value = 160;
    nFlt.Q.value = 3;
    const nEnv = ctx.createGain();
    nEnv.gain.setValueAtTime(0, t);
    nEnv.gain.linearRampToValueAtTime(0.2, t + 0.05);
    nEnv.gain.setValueAtTime(0.2, t + 0.3);
    nEnv.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(nFlt);
    nFlt.connect(nEnv);
    nEnv.connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur);

    // Tonal growl
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 80 + Math.random() * 35;
    const oEnv = ctx.createGain();
    oEnv.gain.setValueAtTime(0, t);
    oEnv.gain.linearRampToValueAtTime(0.14, t + 0.06);
    oEnv.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(oEnv);
    oEnv.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur);
  }

  /** Sharp crack + whoosh for the player's ranged attack. */
  playAttack(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // High-pass noise burst (muzzle noise)
    this._noiseBurst(3200, "highpass", 0.25, 0.07);

    // Downward frequency sweep (crack)
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.1);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.38, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  /** Impact thud played when a bullet / melee hit lands on a fox. */
  playFoxHit(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.16);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.28, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  /** Descending defeat melody when a fox is killed. */
  playFoxDeath(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;

    const freqs = [380, 300, 240, 170];
    freqs.forEach((hz, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = hz;

      const t = ctx.currentTime + i * 0.1;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.22, t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);

      osc.connect(env);
      env.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  /** Low thud + harsh noise when the player takes damage from a fox. */
  playPlayerHit(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Low sub thud
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.22);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.48, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);

    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.26);

    // Mid-range hit noise
    this._noiseBurst(1100, "bandpass", 0.32, 0.1, 2.5);
  }

  /** Uplifting multi-chord fanfare for winning. */
  playVictory(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;

    const chords: { freqs: number[]; t: number; dur: number }[] = [
      { freqs: [261.63, 329.63, 392.0], t: 0, dur: 0.32 },
      { freqs: [293.66, 369.99, 440.0], t: 0.38, dur: 0.32 },
      { freqs: [349.23, 440.0, 523.25], t: 0.76, dur: 0.45 },
      { freqs: [523.25, 659.25, 783.99, 1046.5], t: 1.25, dur: 1.0 },
    ];

    chords.forEach(({ freqs, t: delay, dur }) => {
      freqs.forEach((hz) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = hz;

        const startT = ctx.currentTime + delay;
        const perNoteGain = 0.22 / freqs.length;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, startT);
        env.gain.linearRampToValueAtTime(perNoteGain, startT + 0.02);
        env.gain.setValueAtTime(perNoteGain, startT + dur - 0.06);
        env.gain.exponentialRampToValueAtTime(0.0001, startT + dur);

        osc.connect(env);
        env.connect(this.sfxGain!);
        osc.start(startT);
        osc.stop(startT + dur);
      });
    });
  }

  // ── Day / night music adaptation ─────────────────────────────────────────

  /**
   * Call this every frame with the current day fraction (0-1).
   * Updates the chord tonality used for the next ambient pad.
   */
  updateDaytime(dayFraction: number): void {
    this._isDayTime = dayFraction > 0.22 && dayFraction < 0.78;
  }

  // ── Volume / mute controls ───────────────────────────────────────────────

  setMuted(muted: boolean): void {
    this._muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : this._masterVolume;
    }
  }

  isMuted(): boolean {
    return this._muted;
  }

  setMasterVolume(vol: number): void {
    this._masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && !this._muted) {
      this.masterGain.gain.value = this._masterVolume;
    }
  }

  getMasterVolume(): number {
    return this._masterVolume;
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  destroy(): void {
    if (this.musicTimeout !== null) clearTimeout(this.musicTimeout);
    if (this.windTimeout !== null) clearTimeout(this.windTimeout);
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this._sheepBuffer = null;
    this._sheepBufferLoading = false;
  }
}

/** Singleton – import and use directly throughout the game. */
export const soundManager = new SoundManager();
