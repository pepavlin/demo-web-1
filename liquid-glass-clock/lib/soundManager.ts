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
  private _paused = false;
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

    // Low-frequency rumble: the "pressure" of a wind gust (60–160 Hz)
    const src1 = ctx.createBufferSource();
    src1.buffer = this._noiseBuffer(duration);
    const flt1 = ctx.createBiquadFilter();
    flt1.type = "lowpass";
    flt1.frequency.value = 60 + Math.random() * 100;
    flt1.Q.value = 0.5;
    const env1 = ctx.createGain();
    const peak1 = 0.06 + Math.random() * 0.03;
    env1.gain.setValueAtTime(0.0001, t);
    env1.gain.linearRampToValueAtTime(peak1, t + duration * 0.4);
    env1.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src1.connect(flt1);
    flt1.connect(env1);
    env1.connect(this.sfxGain);
    src1.start(t);
    src1.stop(t + duration);

    // High-frequency hiss: air rushing past (2 500–4 000 Hz)
    const src2 = ctx.createBufferSource();
    src2.buffer = this._noiseBuffer(duration);
    const flt2 = ctx.createBiquadFilter();
    flt2.type = "highpass";
    flt2.frequency.value = 2500 + Math.random() * 1500;
    flt2.Q.value = 0.3;
    const env2 = ctx.createGain();
    const peak2 = 0.025 + Math.random() * 0.015;
    env2.gain.setValueAtTime(0.0001, t);
    env2.gain.linearRampToValueAtTime(peak2, t + duration * 0.25);
    env2.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src2.connect(flt2);
    flt2.connect(env2);
    env2.connect(this.sfxGain);
    src2.start(t);
    src2.stop(t + duration);
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

  /**
   * Growl played when a fox is chasing the player.
   * @param distance  Distance (world units) from player to nearest chasing fox.
   *                  Used to scale volume – louder when closer.
   */
  playFoxGrowl(distance: number = 10): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const dur = 0.8;

    // Volume scales with proximity: full volume when very close, minimum at ~25 units
    const vol = Math.max(0.2, 1.0 - distance / 25);

    // Layer 1 – Low rumble: bandpass noise (150–260 Hz) gives the "chest" of the growl
    // Slightly tighter Q and lower frequency range for a deeper, more organic foundation
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = this._noiseBuffer(dur);
    const nFlt = ctx.createBiquadFilter();
    nFlt.type = "bandpass";
    nFlt.frequency.value = 150 + Math.random() * 110;
    nFlt.Q.value = 3.0;
    const nEnv = ctx.createGain();
    nEnv.gain.setValueAtTime(0, t);
    nEnv.gain.linearRampToValueAtTime(0.55 * vol, t + 0.12);
    nEnv.gain.setValueAtTime(0.55 * vol, t + 0.60);
    nEnv.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    nSrc.connect(nFlt);
    nFlt.connect(nEnv);
    nEnv.connect(this.sfxGain);
    nSrc.start(t);
    nSrc.stop(t + dur);

    // Layer 2 – Vocal core: sine oscillator with subtle LFO pitch wobble
    // Sine produces a cleaner fundamental; the noise layer provides roughness.
    // LFO at 12–18 Hz with narrow ±10 Hz deviation creates realistic vocal tremor
    // (original had ±35 Hz which caused an unnatural mechanical wobble).
    const osc = ctx.createOscillator();
    osc.type = "sine";
    const baseFreq = 170 + Math.random() * 60;
    osc.frequency.setValueAtTime(baseFreq, t);
    // Slight downward pitch contour over the growl – sounds more threatening/organic
    osc.frequency.linearRampToValueAtTime(baseFreq - 15, t + dur);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 12 + Math.random() * 6;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 10;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const oEnv = ctx.createGain();
    oEnv.gain.setValueAtTime(0, t);
    oEnv.gain.linearRampToValueAtTime(0.35 * vol, t + 0.15);
    oEnv.gain.setValueAtTime(0.35 * vol, t + 0.62);
    oEnv.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(oEnv);
    oEnv.connect(this.sfxGain);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur);
    lfo.stop(t + dur);

    // Layer 3 – Upper presence: triangle wave (380–540 Hz) adds harmonics without harshness
    // Triangle is softer than square and gives a more animal-like upper resonance
    const snarl = ctx.createOscillator();
    snarl.type = "triangle";
    snarl.frequency.value = 380 + Math.random() * 160;
    const sEnv = ctx.createGain();
    sEnv.gain.setValueAtTime(0, t);
    sEnv.gain.linearRampToValueAtTime(0.08 * vol, t + 0.06);
    sEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    snarl.connect(sEnv);
    sEnv.connect(this.sfxGain);
    snarl.start(t);
    snarl.stop(t + 0.45);
  }

  /**
   * Weapon attack sound – different audio per weapon type.
   * @param weaponType  "sword" | "bow" | "crossbow"
   */
  playAttack(weaponType: string = "bow"): void {
    if (!this.ctx || !this.sfxGain) return;
    if (weaponType === "sword") {
      this._playSwordSwing();
    } else if (weaponType === "crossbow") {
      this._playCrossbowShot();
    } else {
      this._playBowShot();
    }
  }

  /** Sword swing: sharp air-cutting swish + brief metallic ring. */
  private _playSwordSwing(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Swish – bandpass noise, fast decay, mimics blade cutting air
    const swishSrc = ctx.createBufferSource();
    swishSrc.buffer = this._noiseBuffer(0.18);
    const swishFlt = ctx.createBiquadFilter();
    swishFlt.type = "bandpass";
    swishFlt.frequency.value = 2400;
    swishFlt.Q.value = 0.7;
    const swishEnv = ctx.createGain();
    swishEnv.gain.setValueAtTime(0, t);
    swishEnv.gain.linearRampToValueAtTime(0.32, t + 0.02);
    swishEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    swishSrc.connect(swishFlt);
    swishFlt.connect(swishEnv);
    swishEnv.connect(this.sfxGain);
    swishSrc.start(t);
    swishSrc.stop(t + 0.18);

    // Metallic ring – sine at steel resonance frequency, longer decay
    const ringOsc = ctx.createOscillator();
    ringOsc.type = "sine";
    ringOsc.frequency.setValueAtTime(920 + Math.random() * 120, t + 0.02);
    const ringEnv = ctx.createGain();
    ringEnv.gain.setValueAtTime(0.14, t + 0.02);
    ringEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    ringOsc.connect(ringEnv);
    ringEnv.connect(this.sfxGain);
    ringOsc.start(t + 0.02);
    ringOsc.stop(t + 0.28);
  }

  /** Bow shot: bowstring twang + arrow whoosh in flight. */
  private _playBowShot(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Bowstring twang – low-pitched pluck with a brief vibrato decay
    const twangOsc = ctx.createOscillator();
    twangOsc.type = "sine";
    twangOsc.frequency.setValueAtTime(130 + Math.random() * 20, t);
    twangOsc.frequency.exponentialRampToValueAtTime(90, t + 0.15);
    const twangEnv = ctx.createGain();
    twangEnv.gain.setValueAtTime(0.42, t);
    twangEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    twangOsc.connect(twangEnv);
    twangEnv.connect(this.sfxGain);
    twangOsc.start(t);
    twangOsc.stop(t + 0.22);

    // Second harmonic – adds body to the pluck
    const twangOsc2 = ctx.createOscillator();
    twangOsc2.type = "sine";
    twangOsc2.frequency.setValueAtTime(260 + Math.random() * 20, t);
    twangOsc2.frequency.exponentialRampToValueAtTime(180, t + 0.1);
    const twangEnv2 = ctx.createGain();
    twangEnv2.gain.setValueAtTime(0.18, t);
    twangEnv2.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    twangOsc2.connect(twangEnv2);
    twangEnv2.connect(this.sfxGain);
    twangOsc2.start(t);
    twangOsc2.stop(t + 0.14);

    // Arrow whoosh – highpass noise sweep (arrow in flight)
    const whooshSrc = ctx.createBufferSource();
    whooshSrc.buffer = this._noiseBuffer(0.2);
    const whooshFlt = ctx.createBiquadFilter();
    whooshFlt.type = "highpass";
    whooshFlt.frequency.value = 1800;
    whooshFlt.Q.value = 0.5;
    const whooshEnv = ctx.createGain();
    whooshEnv.gain.setValueAtTime(0, t + 0.04);
    whooshEnv.gain.linearRampToValueAtTime(0.18, t + 0.08);
    whooshEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    whooshSrc.connect(whooshFlt);
    whooshFlt.connect(whooshEnv);
    whooshEnv.connect(this.sfxGain);
    whooshSrc.start(t + 0.04);
    whooshSrc.stop(t + 0.28);
  }

  /** Crossbow shot: mechanical click/thunk + sharp bolt release. */
  private _playCrossbowShot(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Mechanical trigger click – short square pulse
    const clickOsc = ctx.createOscillator();
    clickOsc.type = "square";
    clickOsc.frequency.value = 580 + Math.random() * 80;
    const clickEnv = ctx.createGain();
    clickEnv.gain.setValueAtTime(0.28, t);
    clickEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    clickOsc.connect(clickEnv);
    clickEnv.connect(this.sfxGain);
    clickOsc.start(t);
    clickOsc.stop(t + 0.04);

    // Body thunk – deep sine thud (limb energy release)
    const thunkOsc = ctx.createOscillator();
    thunkOsc.type = "sine";
    thunkOsc.frequency.setValueAtTime(210, t + 0.01);
    thunkOsc.frequency.exponentialRampToValueAtTime(70, t + 0.1);
    const thunkEnv = ctx.createGain();
    thunkEnv.gain.setValueAtTime(0.38, t + 0.01);
    thunkEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    thunkOsc.connect(thunkEnv);
    thunkEnv.connect(this.sfxGain);
    thunkOsc.start(t + 0.01);
    thunkOsc.stop(t + 0.12);

    // Bolt flight – high-pass noise, sharp and cutting (faster than bow arrow)
    const boltSrc = ctx.createBufferSource();
    boltSrc.buffer = this._noiseBuffer(0.14);
    const boltFlt = ctx.createBiquadFilter();
    boltFlt.type = "highpass";
    boltFlt.frequency.value = 3000;
    boltFlt.Q.value = 0.8;
    const boltEnv = ctx.createGain();
    boltEnv.gain.setValueAtTime(0, t + 0.02);
    boltEnv.gain.linearRampToValueAtTime(0.22, t + 0.04);
    boltEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    boltSrc.connect(boltFlt);
    boltFlt.connect(boltEnv);
    boltEnv.connect(this.sfxGain);
    boltSrc.start(t + 0.02);
    boltSrc.stop(t + 0.18);
  }

  /**
   * Arrow impact sound – sharp thwack when an arrow embeds in flesh/animal.
   * Combines a brief high-frequency crack (impact transient) with a low-mid thud
   * (body resonance), giving the distinctive sound of an arrow hitting a target.
   */
  playArrowHit(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Sharp impact crack – short highpass noise (arrow tip impact)
    const crackSrc = ctx.createBufferSource();
    crackSrc.buffer = this._noiseBuffer(0.06);
    const crackFlt = ctx.createBiquadFilter();
    crackFlt.type = "highpass";
    crackFlt.frequency.value = 2200 + Math.random() * 600;
    crackFlt.Q.value = 0.5;
    const crackEnv = ctx.createGain();
    crackEnv.gain.setValueAtTime(0.35, t);
    crackEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    crackSrc.connect(crackFlt);
    crackFlt.connect(crackEnv);
    crackEnv.connect(this.sfxGain);
    crackSrc.start(t);
    crackSrc.stop(t + 0.06);

    // Body thud – low-mid sine decay (flesh/body resonance)
    const thudOsc = ctx.createOscillator();
    thudOsc.type = "sine";
    thudOsc.frequency.setValueAtTime(200 + Math.random() * 40, t + 0.005);
    thudOsc.frequency.exponentialRampToValueAtTime(80, t + 0.1);
    const thudEnv = ctx.createGain();
    thudEnv.gain.setValueAtTime(0.22, t + 0.005);
    thudEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    thudOsc.connect(thudEnv);
    thudEnv.connect(this.sfxGain);
    thudOsc.start(t + 0.005);
    thudOsc.stop(t + 0.14);
  }

  /** Impact thud played when a bullet / melee hit lands on a fox. */
  playFoxHit(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Noise burst – sharp impact "thwack" quality at the moment of hit
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = this._noiseBuffer(0.1);
    const nFlt = ctx.createBiquadFilter();
    nFlt.type = "bandpass";
    nFlt.frequency.value = 900;
    nFlt.Q.value = 0.9;
    const nEnv = ctx.createGain();
    nEnv.gain.setValueAtTime(0.25, t);
    nEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    nSrc.connect(nFlt);
    nFlt.connect(nEnv);
    nEnv.connect(this.sfxGain);
    nSrc.start(t);
    nSrc.stop(t + 0.1);

    // Sine sweep – yelp tone descending from high pitch to low (bark/cry character)
    // Sine wave is cleaner than square and better resembles an animal vocal cry
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(480, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.18);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.28, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);

    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.20);
  }

  /** Descending defeat melody when a fox is killed. */
  playFoxDeath(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;

    // Sine waves produce a cry/whimper quality rather than the buzzy sawtooth game-jingle feel.
    // Each note gets a downward pitch glide and decreasing volume for a natural dying-away effect.
    const freqs = [380, 300, 240, 170];
    const vols  = [0.22, 0.18, 0.14, 0.10];
    freqs.forEach((hz, i) => {
      const t = ctx.currentTime + i * 0.11;
      const noteDur = 0.18;

      // Sine oscillator with intra-note pitch glide (20% downward slide)
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(hz, t);
      osc.frequency.exponentialRampToValueAtTime(hz * 0.80, t + noteDur);

      const env = ctx.createGain();
      env.gain.setValueAtTime(vols[i], t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + noteDur);

      osc.connect(env);
      env.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + noteDur);

      // Subtle noise breath under first two notes for organic texture
      if (i < 2) {
        const nSrc = ctx.createBufferSource();
        nSrc.buffer = this._noiseBuffer(noteDur);
        const nFlt = ctx.createBiquadFilter();
        nFlt.type = "bandpass";
        nFlt.frequency.value = hz * 1.5;
        nFlt.Q.value = 1.5;
        const nEnv = ctx.createGain();
        nEnv.gain.setValueAtTime(vols[i] * 0.18, t);
        nEnv.gain.exponentialRampToValueAtTime(0.0001, t + noteDur);
        nSrc.connect(nFlt);
        nFlt.connect(nEnv);
        nEnv.connect(this.sfxGain!);
        nSrc.start(t);
        nSrc.stop(t + noteDur);
      }
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

  /** Short satisfying thud when placing a block. */
  playBlockPlace(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Low-freq thud (body resonance)
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.45, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.2);

    // High click transient
    const osc2 = ctx.createOscillator();
    osc2.type = "square";
    osc2.frequency.value = 900;
    const env2 = ctx.createGain();
    env2.gain.setValueAtTime(0.15, t);
    env2.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    osc2.connect(env2);
    env2.connect(this.sfxGain);
    osc2.start(t);
    osc2.stop(t + 0.04);
  }

  /** Crumble/break sound when removing a block. */
  playBlockRemove(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Short noise burst
    const bufLen = Math.floor(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 800;
    filt.Q.value = 0.8;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.3, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

    noise.connect(filt);
    filt.connect(env);
    env.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.14);
  }

  /** Gentle brush sound for terrain sculpting. */
  playTerrainSculpt(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const bufLen = Math.floor(ctx.sampleRate * 0.08);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      const env = Math.sin((i / bufLen) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env * 0.4;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 400;

    const gain = ctx.createGain();
    gain.gain.value = 0.18;

    noise.connect(filt);
    filt.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.1);
  }

  /**
   * Water ambient sound – gentle flowing/gurgling noise.
   * Should only be called when the player is within hearing range of water.
   * @param volume  Proximity-based volume in [0, 1] – 1 = right at the water edge.
   */
  playWaterAmbient(volume: number = 1): void {
    if (!this.ctx || !this.sfxGain) return;
    const vol = Math.max(0, Math.min(1, volume));
    if (vol < 0.01) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = 1.5 + Math.random() * 1.0;

    // Main flow: bandpass noise in the "flowing water" range (250–450 Hz)
    const src1 = ctx.createBufferSource();
    src1.buffer = this._noiseBuffer(duration);
    const flt1 = ctx.createBiquadFilter();
    flt1.type = "bandpass";
    flt1.frequency.value = 250 + Math.random() * 200;
    flt1.Q.value = 0.8 + Math.random() * 0.6;
    const peak1 = 0.12 * vol;
    const env1 = ctx.createGain();
    env1.gain.setValueAtTime(0.0001, t);
    env1.gain.linearRampToValueAtTime(peak1, t + duration * 0.2);
    env1.gain.setValueAtTime(peak1, t + duration * 0.7);
    env1.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src1.connect(flt1);
    flt1.connect(env1);
    env1.connect(this.sfxGain);
    src1.start(t);
    src1.stop(t + duration);

    // Surface sparkle: high-frequency ripple component (1 200–2 000 Hz)
    const sparkDur = duration * 0.4;
    const src2 = ctx.createBufferSource();
    src2.buffer = this._noiseBuffer(sparkDur);
    const flt2 = ctx.createBiquadFilter();
    flt2.type = "bandpass";
    flt2.frequency.value = 1200 + Math.random() * 800;
    flt2.Q.value = 2 + Math.random() * 2;
    const peak2 = 0.04 * vol;
    const env2 = ctx.createGain();
    env2.gain.setValueAtTime(0.0001, t);
    env2.gain.linearRampToValueAtTime(peak2, t + 0.1);
    env2.gain.exponentialRampToValueAtTime(0.0001, t + sparkDur);
    src2.connect(flt2);
    flt2.connect(env2);
    env2.connect(this.sfxGain);
    src2.start(t);
    src2.stop(t + sparkDur);
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

  // ── Pause / Resume ───────────────────────────────────────────────────────

  /**
   * Suspend all audio and stop scheduling new sounds.
   * Call when the game is paused (pointer lock released).
   */
  pause(): void {
    if (!this.ctx || this._paused) return;
    this._paused = true;
    if (this.musicTimeout !== null) clearTimeout(this.musicTimeout);
    if (this.windTimeout !== null) clearTimeout(this.windTimeout);
    this.musicTimeout = null;
    this.windTimeout = null;
    this.ctx.suspend();
  }

  /**
   * Resume all audio and restart ambient scheduling.
   * Call when the game is unpaused (pointer lock reacquired).
   */
  resume(): void {
    if (!this.ctx || !this._paused) return;
    this._paused = false;
    this.ctx.resume().then(() => {
      this._scheduleAmbientChunk(0);
      this._scheduleWindGust();
    });
  }

  isPaused(): boolean {
    return this._paused;
  }

  // ── Thunder & Rain ───────────────────────────────────────────────────────

  /**
   * Synthesises a low-frequency thunder rumble.
   * Sharp transient crack followed by a long filtered-noise roll-off.
   */
  playThunder(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const out = this.sfxGain;
    const t = ctx.currentTime;

    // 1. Sharp crack: short high-amplitude noise burst
    const crackDur = 0.18;
    const crackSrc = ctx.createBufferSource();
    crackSrc.buffer = this._noiseBuffer(crackDur);
    const crackFlt = ctx.createBiquadFilter();
    crackFlt.type = "bandpass";
    crackFlt.frequency.value = 180;
    crackFlt.Q.value = 0.6;
    const crackEnv = ctx.createGain();
    crackEnv.gain.setValueAtTime(0.0001, t);
    crackEnv.gain.linearRampToValueAtTime(0.55, t + 0.02);
    crackEnv.gain.exponentialRampToValueAtTime(0.0001, t + crackDur);
    crackSrc.connect(crackFlt);
    crackFlt.connect(crackEnv);
    crackEnv.connect(out);
    crackSrc.start(t);
    crackSrc.stop(t + crackDur);

    // 2. Deep rumble: long low-pass noise
    const rumbleDur = 4.5 + Math.random() * 2;
    const rumbleSrc = ctx.createBufferSource();
    rumbleSrc.buffer = this._noiseBuffer(rumbleDur);
    const rumbleFlt = ctx.createBiquadFilter();
    rumbleFlt.type = "lowpass";
    rumbleFlt.frequency.value = 90 + Math.random() * 50;
    rumbleFlt.Q.value = 0.4;
    const rumbleEnv = ctx.createGain();
    rumbleEnv.gain.setValueAtTime(0.0001, t);
    rumbleEnv.gain.linearRampToValueAtTime(0.32, t + 0.15);
    rumbleEnv.gain.setValueAtTime(0.28, t + 0.6);
    rumbleEnv.gain.exponentialRampToValueAtTime(0.0001, t + rumbleDur);
    rumbleSrc.connect(rumbleFlt);
    rumbleFlt.connect(rumbleEnv);
    rumbleEnv.connect(out);
    rumbleSrc.start(t + 0.05); // slight delay — rumble lags crack
    rumbleSrc.stop(t + rumbleDur + 0.1);
  }

  // ── Bomb throw (short fuse hiss) ─────────────────────────────────────────

  playBombThrow(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const out = this.sfxGain;
    const t = ctx.currentTime;

    // Short hiss / whoosh as the bomb flies
    const hissDur = 0.35;
    const hissSrc = ctx.createBufferSource();
    hissSrc.buffer = this._noiseBuffer(hissDur);
    const hissFlt = ctx.createBiquadFilter();
    hissFlt.type = "highpass";
    hissFlt.frequency.value = 3200;
    hissFlt.Q.value = 0.5;
    const hissEnv = ctx.createGain();
    hissEnv.gain.setValueAtTime(0.0001, t);
    hissEnv.gain.linearRampToValueAtTime(0.18, t + 0.05);
    hissEnv.gain.exponentialRampToValueAtTime(0.0001, t + hissDur);
    hissSrc.connect(hissFlt);
    hissFlt.connect(hissEnv);
    hissEnv.connect(out);
    hissSrc.start(t);
    hissSrc.stop(t + hissDur + 0.05);
  }

  // ── Bomb explosion (loud thud + rumble) ──────────────────────────────────

  playBombExplosion(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const out = this.sfxGain;
    const t = ctx.currentTime;

    // 1. Sharp initial crack/boom (wide-band noise burst)
    const boomDur = 0.28;
    const boomSrc = ctx.createBufferSource();
    boomSrc.buffer = this._noiseBuffer(boomDur);
    const boomFlt = ctx.createBiquadFilter();
    boomFlt.type = "lowpass";
    boomFlt.frequency.value = 800;
    boomFlt.Q.value = 0.8;
    const boomEnv = ctx.createGain();
    boomEnv.gain.setValueAtTime(0.0001, t);
    boomEnv.gain.linearRampToValueAtTime(0.85, t + 0.01);
    boomEnv.gain.exponentialRampToValueAtTime(0.0001, t + boomDur);
    boomSrc.connect(boomFlt);
    boomFlt.connect(boomEnv);
    boomEnv.connect(out);
    boomSrc.start(t);
    boomSrc.stop(t + boomDur + 0.05);

    // 2. Sub-bass thump (low sine burst)
    const thumpOsc = ctx.createOscillator();
    thumpOsc.type = "sine";
    thumpOsc.frequency.setValueAtTime(55, t);
    thumpOsc.frequency.exponentialRampToValueAtTime(18, t + 0.45);
    const thumpEnv = ctx.createGain();
    thumpEnv.gain.setValueAtTime(0.0001, t);
    thumpEnv.gain.linearRampToValueAtTime(0.70, t + 0.02);
    thumpEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    thumpOsc.connect(thumpEnv);
    thumpEnv.connect(out);
    thumpOsc.start(t);
    thumpOsc.stop(t + 0.5);

    // 3. Trailing rubble rumble
    const rumbleDur = 1.8;
    const rumbleSrc = ctx.createBufferSource();
    rumbleSrc.buffer = this._noiseBuffer(rumbleDur);
    const rumbleFlt = ctx.createBiquadFilter();
    rumbleFlt.type = "lowpass";
    rumbleFlt.frequency.value = 120;
    rumbleFlt.Q.value = 0.4;
    const rumbleEnv = ctx.createGain();
    rumbleEnv.gain.setValueAtTime(0.0001, t + 0.08);
    rumbleEnv.gain.linearRampToValueAtTime(0.35, t + 0.18);
    rumbleEnv.gain.exponentialRampToValueAtTime(0.0001, t + rumbleDur);
    rumbleSrc.connect(rumbleFlt);
    rumbleFlt.connect(rumbleEnv);
    rumbleEnv.connect(out);
    rumbleSrc.start(t + 0.08);
    rumbleSrc.stop(t + rumbleDur + 0.1);
  }

  // ── Tree-chopping sounds ─────────────────────────────────────────────────

  /** Short woody "thwack" played on each axe swing that hits a tree. */
  playTreeChop(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Low-frequency thump — wood impact body
    const thumpOsc = ctx.createOscillator();
    thumpOsc.type = "sine";
    thumpOsc.frequency.setValueAtTime(180, t);
    thumpOsc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    const thumpEnv = ctx.createGain();
    thumpEnv.gain.setValueAtTime(0.35, t);
    thumpEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    thumpOsc.connect(thumpEnv);
    thumpEnv.connect(this.sfxGain);
    thumpOsc.start(t);
    thumpOsc.stop(t + 0.15);

    // Mid noise burst — "crack" transient of axe biting wood
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = this._noiseBuffer(0.08);
    const nFlt = ctx.createBiquadFilter();
    nFlt.type = "bandpass";
    nFlt.frequency.value = 1400;
    nFlt.Q.value = 1.2;
    const nEnv = ctx.createGain();
    nEnv.gain.setValueAtTime(0.18, t);
    nEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    nSrc.connect(nFlt);
    nFlt.connect(nEnv);
    nEnv.connect(this.sfxGain);
    nSrc.start(t);
    nSrc.stop(t + 0.09);
  }

  /**
   * Rumbling crash played when a tree finishes falling.
   * A deep bass thud followed by a brief wood-splintering noise burst.
   */
  playTreeFall(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Bass slam — tree hitting the ground
    const bassOsc = ctx.createOscillator();
    bassOsc.type = "sine";
    bassOsc.frequency.setValueAtTime(90, t);
    bassOsc.frequency.exponentialRampToValueAtTime(25, t + 0.45);
    const bassEnv = ctx.createGain();
    bassEnv.gain.setValueAtTime(0.55, t);
    bassEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.50);
    bassOsc.connect(bassEnv);
    bassEnv.connect(this.sfxGain);
    bassOsc.start(t);
    bassOsc.stop(t + 0.52);

    // Splintering crackle — branches snapping
    const crackSrc = ctx.createBufferSource();
    crackSrc.buffer = this._noiseBuffer(0.35);
    const crackFlt = ctx.createBiquadFilter();
    crackFlt.type = "bandpass";
    crackFlt.frequency.value = 600;
    crackFlt.Q.value = 0.7;
    const crackEnv = ctx.createGain();
    crackEnv.gain.setValueAtTime(0.22, t + 0.02);
    crackEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    crackSrc.connect(crackFlt);
    crackFlt.connect(crackEnv);
    crackEnv.connect(this.sfxGain);
    crackSrc.start(t + 0.02);
    crackSrc.stop(t + 0.40);
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
    this._paused = false;
  }
}

/** Singleton – import and use directly throughout the game. */
export const soundManager = new SoundManager();
