export type SoundEffectType =
  | 'ui_click'
  | 'ui_confirm'
  | 'countdown_tick'
  | 'countdown_fight'
  | 'shot_m4a1'
  | 'shot_ak47'
  | 'shot_mp5'
  | 'shot_spas12'
  | 'shot_awp'
  | 'shot_deagle'
  | 'reload_start'
  | 'reload_done'
  | 'dry_fire'
  | 'headshot'
  | 'pickup'
  | 'footstep_concrete'
  | 'footstep_metal'
  | 'hit_light'
  | 'hit_heavy'
  | 'hit_ability'
  | 'hit_marker'
  | 'jump_thruster'
  | 'swing_light'
  | 'blocked'
  | 'block'
  | 'guard_break'
  | 'parried'
  | 'parry'
  | 'dodge'
  | 'ability_volt'
  | 'ability_rift'
  | 'ko'
  | 'ko_slowmo';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterVolume = 0.7;
  private muted = false;
  public lastFootstepSurface: 'concrete' | 'metal' | null = null;
  public footstepPlayCount = 0;

  private concreteBuffers: AudioBuffer[] = [];
  private metalBuffers: AudioBuffer[] = [];
  private foleyBuilt = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || this.masterVolume <= 0.01) return null;
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch {
          return null;
        }
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (this.ctx && !this.foleyBuilt) {
      this.buildFoleyFootstepBank(this.ctx);
    }

    return this.ctx;
  }

  /**
   * Builds 8 studio-grade PCM foley footstep samples (4 Concrete + 4 Steel Grating variations)
   * using physical impulse modeling (heel impact + sole roll + micro-grit grains + damped plate modes)
   * with zero synthetic sine-sweep oscillators. Also supports optional external WAV sample overrides.
   */
  private buildFoleyFootstepBank(ctx: AudioContext): void {
    this.foleyBuilt = true;
    const sr = ctx.sampleRate;

    // Deterministic pseudo-random generator for consistent, rich foley grain textures across 4 variations
    let seed = 133791;
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const nextSigned = () => nextRand() * 2 - 1;

    // 1. Build 4 Concrete Tactical Boot Foley Variations (~115ms each)
    for (let v = 0; v < 4; v++) {
      const dur = 0.115;
      const len = Math.floor(sr * dur);
      const buf = ctx.createBuffer(1, len, sr);
      const out = buf.getChannelData(0);

      // State variables for 2-pole lowpass (heel thump) and bandpass (asphalt grit)
      let lp1 = 0;
      let lp2 = 0;
      let bp1 = 0;
      let bp2 = 0;
      let clothLp = 0;

      const heelToneHz = 62 + v * 4.5;
      const toeDelaySec = 0.022 + (v % 2) * 0.004;

      // Pre-place 36 discrete asphalt/sand micro-grit crackle impulses across heel & sole roll
      const gritImpulses = new Float32Array(len);
      for (let g = 0; g < 36; g++) {
        const gt = 0.003 + nextRand() * 0.064;
        const idx = Math.min(len - 2, Math.floor(gt * sr));
        const amp = (0.45 + nextRand() * 0.55) * (gt < 0.025 ? 1.0 : 0.72);
        gritImpulses[idx] += (nextRand() > 0.5 ? 1 : -1) * amp;
        gritImpulses[idx + 1] -= (nextRand() > 0.5 ? 0.6 : -0.6) * amp;
      }

      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const wn = nextSigned();

        // Layer A: Heavy rubber boot heel strike (lowpass filtered brown noise + damped half-cycle pressure thud)
        const heelEnv = Math.exp(-t * 145) * Math.min(1, t / 0.0018);
        lp1 += 0.042 * (wn - lp1);
        lp2 += 0.042 * (lp1 - lp2);
        const pressurePulse =
          Math.sin(2 * Math.PI * heelToneHz * t) * Math.exp(-t * 165);
        const heelSample = (lp2 * 2.8 + pressurePulse * 0.55) * heelEnv;

        // Layer B: Sole roll & toe push-off thump (~22ms after heel)
        const dtToe = Math.max(0, t - toeDelaySec);
        const toeEnv =
          t >= toeDelaySec
            ? Math.exp(-dtToe * 175) * Math.min(1, dtToe / 0.0025)
            : 0;
        const toeSample = lp2 * 1.65 * toeEnv;

        // Layer C: Gritty concrete / stone micro-grain scuff
        const scuffWindow =
          Math.exp(-Math.pow((t - 0.024) / 0.026, 2)) * 0.85 +
          Math.exp(-t * 58) * 0.35;
        const gritDrive = gritImpulses[i] * 2.4 + wn * 0.42 * scuffWindow;
        bp1 += 0.28 * (gritDrive - bp1);
        bp2 += 0.08 * (bp1 - bp2);
        const gritBand = bp1 - bp2;

        // Layer D: Subtle tactical trouser / boot leather flex
        clothLp += 0.11 * (wn - clothLp);
        const clothEnv = Math.exp(-t * 36) * Math.sin(Math.min(Math.PI, (t / 0.09) * Math.PI));
        const clothSample = (clothLp - lp1) * 0.14 * clothEnv;

        // Combine & soft-clip with warm analog saturation
        const raw = heelSample * 0.95 + toeSample * 0.65 + gritBand * 0.62 + clothSample;
        out[i] = Math.tanh(raw * 1.45) * 0.88;
      }

      this.concreteBuffers.push(buf);
    }

    // 2. Build 4 Metal Grating / Steel Deck Foley Variations (~125ms each)
    for (let v = 0; v < 4; v++) {
      const dur = 0.125;
      const len = Math.floor(sr * dur);
      const buf = ctx.createBuffer(1, len, sr);
      const out = buf.getChannelData(0);

      let lp1 = 0;
      let lp2 = 0;
      let hpState = 0;

      // Damped industrial steel plate modal frequencies (inharmonic, fast decay — no synth whistle!)
      const modes = [
        { freq: 142 + v * 6, decay: 95, amp: 0.48 },
        { freq: 318 + v * 11, decay: 115, amp: 0.34 },
        { freq: 512 + v * 17, decay: 135, amp: 0.26 },
        { freq: 845 + v * 23, decay: 155, amp: 0.20 },
        { freq: 1380 + v * 35, decay: 185, amp: 0.15 },
        { freq: 2290 + v * 48, decay: 220, amp: 0.11 },
      ];
      const toeDelaySec = 0.019 + (v % 2) * 0.0035;

      // Micro-metallic lug contact clicks
      const lugClicks = new Float32Array(len);
      for (let c = 0; c < 22; c++) {
        const ct = 0.001 + nextRand() * 0.042;
        const idx = Math.min(len - 2, Math.floor(ct * sr));
        lugClicks[idx] += (nextRand() > 0.5 ? 1 : -1) * (0.5 + nextRand() * 0.5);
      }

      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const wn = nextSigned();

        // Layer A: Heavy rubber boot heel striking thick steel deck plate
        const heelEnv = Math.exp(-t * 135) * Math.min(1, t / 0.0012);
        lp1 += 0.065 * (wn - lp1);
        lp2 += 0.065 * (lp1 - lp2);
        const bootThud = lp2 * 2.5 * heelEnv;

        // Layer B: Damped steel plate modal clatter (modulated by broadband noise so it sounds mechanical, not tonal)
        let modalSum = 0;
        const noiseMod = 0.72 + 0.28 * wn;
        for (let m = 0; m < modes.length; m++) {
          const md = modes[m];
          modalSum +=
            Math.sin(2 * Math.PI * md.freq * t) *
            Math.exp(-t * md.decay) *
            md.amp;
        }
        // Secondary toe-tap on steel diamond lug
        let toeModal = 0;
        if (t >= toeDelaySec) {
          const dtToe = t - toeDelaySec;
          toeModal =
            (Math.sin(2 * Math.PI * modes[1].freq * 1.08 * dtToe) * 0.25 +
              Math.sin(2 * Math.PI * modes[3].freq * 1.05 * dtToe) * 0.16 +
              wn * 0.35) *
            Math.exp(-dtToe * 165);
        }

        // Layer C: Crisp diamond-plate lug transient scuff
        hpState += 0.22 * (wn + lugClicks[i] * 1.8 - hpState);
        const hiTransient =
          (wn + lugClicks[i] * 1.8 - hpState) *
          (Math.exp(-t * 170) * 0.65 + Math.exp(-Math.pow((t - toeDelaySec) / 0.012, 2)) * 0.35);

        const raw =
          bootThud * 0.92 +
          modalSum * noiseMod * 0.85 +
          toeModal * 0.75 +
          hiTransient * 0.42;
        out[i] = Math.tanh(raw * 1.55) * 0.86;
      }

      this.metalBuffers.push(buf);
    }
  }

  public unlock(): void {
    this.ensureContext();
  }

  public setVolume(volume: number, muted: boolean): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.muted = muted;
  }

  public playFootstep(
    surface: 'concrete' | 'metal',
    intensity: 'walk' | 'sprint' | 'crouch' | 'land' = 'walk',
    stepIndex = 0
  ): void {
    this.lastFootstepSurface = surface;
    this.footstepPlayCount += 1;

    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const bank = surface === 'metal' ? this.metalBuffers : this.concreteBuffers;
      if (bank.length === 0) return;

      const intensityScale =
        intensity === 'land'
          ? 1.35
          : intensity === 'sprint'
          ? 1.15
          : intensity === 'crouch'
          ? 0.45
          : 0.85;
      const vol = this.masterVolume * 0.36 * intensityScale;

      // Pick variation based on stepIndex and alternate left/right boot playback rate subtly
      const buf = bank[Math.abs(stepIndex) % bank.length];
      const src = ctx.createBufferSource();
      src.buffer = buf;

      const footParity = stepIndex % 2 === 0 ? 0.96 : 1.04;
      const speedRate =
        intensity === 'land'
          ? 0.88
          : intensity === 'sprint'
          ? 1.06
          : intensity === 'crouch'
          ? 0.92
          : 1.0;
      src.playbackRate.setValueAtTime(
        footParity * speedRate * (0.98 + Math.random() * 0.04),
        now
      );

      // Shape tone dynamically by movement intensity (warmer when crouching, punchier when sprinting/landing)
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      const cutoff =
        surface === 'metal'
          ? intensity === 'crouch'
            ? 2200
            : intensity === 'sprint' || intensity === 'land'
            ? 4200
            : 3400
          : intensity === 'crouch'
          ? 1600
          : intensity === 'sprint' || intensity === 'land'
          ? 3100
          : 2500;
      filter.frequency.setValueAtTime(cutoff, now);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(vol, now);

      src.connect(filter);
      filter.connect(masterGain);
      masterGain.connect(ctx.destination);
      src.start(now);

      // On jump landing, layer a subtle second boot-foot stagger 32ms later for realistic two-foot landing weight
      if (intensity === 'land') {
        const src2 = ctx.createBufferSource();
        src2.buffer = bank[(Math.abs(stepIndex) + 1) % bank.length];
        src2.playbackRate.setValueAtTime(1.03, now + 0.032);
        const gain2 = ctx.createGain();
        gain2.gain.setValueAtTime(vol * 0.68, now + 0.032);
        src2.connect(filter);
        filter.connect(gain2);
        gain2.connect(ctx.destination);
        src2.start(now + 0.032);
      }
    } catch {
      // Safe fallback if browser restricts audio playback
    }
  }

  public play(effect: SoundEffectType): void {
    if (effect === 'footstep_concrete') {
      this.playFootstep('concrete', 'walk', this.footstepPlayCount);
      return;
    }
    if (effect === 'footstep_metal') {
      this.playFootstep('metal', 'walk', this.footstepPlayCount);
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);

      const vol = this.masterVolume * 0.32;
      const pitchJitter = 0.94 + Math.random() * 0.12;

      switch (effect) {
        case 'ui_click': {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(320 * pitchJitter, now);
          osc.frequency.exponentialRampToValueAtTime(140, now + 0.045);
          gain.gain.setValueAtTime(vol * 0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.05);
          break;
        }

        case 'ui_confirm': {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(280, now);
          osc.frequency.exponentialRampToValueAtTime(520, now + 0.09);
          gain.gain.setValueAtTime(vol * 0.45, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.11);
          break;
        }

        case 'countdown_tick': {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.exponentialRampToValueAtTime(160, now + 0.12);
          gain.gain.setValueAtTime(vol * 0.5, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.14);
          break;
        }

        case 'countdown_fight': {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.exponentialRampToValueAtTime(95, now + 0.32);
          gain.gain.setValueAtTime(vol * 0.7, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.36);
          break;
        }

        case 'hit_light': {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(210 * pitchJitter, now);
          osc.frequency.exponentialRampToValueAtTime(65, now + 0.11);
          gain.gain.setValueAtTime(vol * 0.65, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.13);
          break;
        }

        case 'hit_heavy':
        case 'hit_ability': {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(145 * pitchJitter, now);
          osc.frequency.exponentialRampToValueAtTime(38, now + 0.24);
          gain.gain.setValueAtTime(vol * 0.9, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.26);
          break;
        }

        case 'blocked': {
          const osc = ctx.createOscillator();
          osc.type = 'square';
          osc.frequency.setValueAtTime(520 * pitchJitter, now);
          osc.frequency.exponentialRampToValueAtTime(260, now + 0.09);
          gain.gain.setValueAtTime(vol * 0.5, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.11);
          break;
        }

        case 'parried': {
          // High metallic resonance ring
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          osc1.type = 'sine';
          osc2.type = 'triangle';
          osc1.frequency.setValueAtTime(880, now);
          osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.28);
          osc2.frequency.setValueAtTime(440, now);
          osc2.frequency.exponentialRampToValueAtTime(660, now + 0.28);
          gain.gain.setValueAtTime(vol * 0.85, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc1.connect(gain);
          osc2.connect(gain);
          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.31);
          osc2.stop(now + 0.31);
          break;
        }

        case 'guard_break': {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(310, now);
          osc.frequency.exponentialRampToValueAtTime(52, now + 0.32);
          gain.gain.setValueAtTime(vol * 0.95, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.35);
          break;
        }

        case 'dodge': {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(190 * pitchJitter, now);
          osc.frequency.exponentialRampToValueAtTime(90, now + 0.1);
          gain.gain.setValueAtTime(vol * 0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.12);
          break;
        }

        case 'jump_thruster': {
          // Dual jet thruster roar
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(110 * pitchJitter, now);
          osc.frequency.linearRampToValueAtTime(260, now + 0.18);
          osc.frequency.exponentialRampToValueAtTime(80, now + 0.35);
          gain.gain.setValueAtTime(vol * 0.42, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.37);
          break;
        }

        case 'hit_marker': {
          // PUBG crisp hit marker tick
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1200, now);
          osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);
          gain.gain.setValueAtTime(vol * 0.55, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.07);
          break;
        }

        case 'ability_volt': {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(95, now);
          osc.frequency.exponentialRampToValueAtTime(240, now + 0.28);
          gain.gain.setValueAtTime(vol * 0.75, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.31);
          break;
        }

        case 'ability_rift': {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(620, now);
          osc.frequency.exponentialRampToValueAtTime(210, now + 0.22);
          gain.gain.setValueAtTime(vol * 0.65, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.25);
          break;
        }

        case 'swing_light': {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(280 * pitchJitter, now);
          osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);
          gain.gain.setValueAtTime(vol * 0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        }

        case 'block': {
          const osc = ctx.createOscillator();
          osc.type = 'square';
          osc.frequency.setValueAtTime(210 * pitchJitter, now);
          osc.frequency.exponentialRampToValueAtTime(90, now + 0.1);
          gain.gain.setValueAtTime(vol * 0.55, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.12);
          break;
        }

        case 'parry': {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880 * pitchJitter, now);
          osc.frequency.exponentialRampToValueAtTime(1320, now + 0.18);
          gain.gain.setValueAtTime(vol * 0.8, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.23);
          break;
        }

        case 'shot_m4a1':
        case 'shot_ak47':
        case 'shot_mp5':
        case 'shot_spas12':
        case 'shot_awp':
        case 'shot_deagle': {
          const isHeavy = effect === 'shot_awp' || effect === 'shot_spas12' || effect === 'shot_deagle';
          const duration = effect === 'shot_awp' ? 0.34 : effect === 'shot_spas12' ? 0.26 : 0.14;
          const baseFreq =
            effect === 'shot_awp'
              ? 110
              : effect === 'shot_spas12'
                ? 130
                : effect === 'shot_ak47'
                  ? 165
                  : effect === 'shot_deagle'
                    ? 150
                    : effect === 'shot_mp5'
                      ? 240
                      : 195;

          const osc = ctx.createOscillator();
          osc.type = isHeavy ? 'sawtooth' : 'triangle';
          osc.frequency.setValueAtTime(baseFreq * pitchJitter, now);
          osc.frequency.exponentialRampToValueAtTime(32, now + duration);

          // White noise burst for ballistic crack
          const bufLen = Math.floor(ctx.sampleRate * duration);
          const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
          const data = noiseBuf.getChannelData(0);
          for (let i = 0; i < bufLen; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.28));
          }
          const noise = ctx.createBufferSource();
          noise.buffer = noiseBuf;

          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(isHeavy ? 950 : 1450, now);

          gain.gain.setValueAtTime(vol * (isHeavy ? 0.95 : 0.68), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

          osc.connect(gain);
          noise.connect(filter);
          filter.connect(gain);

          osc.start(now);
          noise.start(now);
          osc.stop(now + duration + 0.01);
          noise.stop(now + duration + 0.01);
          break;
        }

        case 'reload_start': {
          const osc = ctx.createOscillator();
          osc.type = 'square';
          osc.frequency.setValueAtTime(420, now);
          osc.frequency.exponentialRampToValueAtTime(210, now + 0.06);
          gain.gain.setValueAtTime(vol * 0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.08);
          break;
        }

        case 'reload_done': {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(260, now);
          osc.frequency.exponentialRampToValueAtTime(640, now + 0.08);
          gain.gain.setValueAtTime(vol * 0.5, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        }

        case 'dry_fire': {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(300, now + 0.025);
          gain.gain.setValueAtTime(vol * 0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.035);
          break;
        }

        case 'headshot': {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1580, now);
          osc.frequency.exponentialRampToValueAtTime(2120, now + 0.11);
          gain.gain.setValueAtTime(vol * 0.75, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.14);
          break;
        }

        case 'pickup': {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(380, now);
          osc.frequency.exponentialRampToValueAtTime(760, now + 0.1);
          gain.gain.setValueAtTime(vol * 0.45, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.12);
          break;
        }

        case 'ko':
        case 'ko_slowmo': {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(140, now);
          osc.frequency.exponentialRampToValueAtTime(35, now + 0.55);
          gain.gain.setValueAtTime(vol, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
          osc.connect(gain);
          osc.start(now);
          osc.stop(now + 0.6);
          break;
        }
      }
    } catch {
      // Safe fallback if browser restricts audio playback
    }
  }
}

export const soundEngine = new SoundEngine();
