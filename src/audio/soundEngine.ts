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

export type FootstepCategory =
  | 'concrete'
  | 'metal'
  | 'tile'
  | 'gravel'
  | 'wood'
  | 'grass'
  | 'water'
  | 'bones'
  | 'dog'
  | 'mech';

/**
 * Complete manifest of the uploaded /footsteps/ OGG audio library:
 * - 'concrete' uses /footsteps/boots/0.ogg .. 8.ogg (Derived from footstep-concrete.wav by swuing)
 * - 'metal' uses /footsteps/metal/0.ogg .. 7.ogg (Derived from fboots on aluminum ladder 01 by Eelke)
 * - Plus tile, gravel, wood, grass, water, bones, dog, and mech packs
 */
export const FOOTSTEP_SOUND_MANIFEST: Record<FootstepCategory, string[]> = {
  concrete: Array.from({ length: 9 }, (_, i) => `/footsteps/boots/${i}.ogg`),
  metal: Array.from({ length: 8 }, (_, i) => `/footsteps/metal/${i}.ogg`),
  tile: Array.from({ length: 9 }, (_, i) => `/footsteps/tile/${i}.ogg`),
  gravel: Array.from({ length: 10 }, (_, i) => `/footsteps/gravel/${i}.ogg`),
  wood: Array.from({ length: 9 }, (_, i) => `/footsteps/wood/${i}.ogg`),
  grass: Array.from({ length: 9 }, (_, i) => `/footsteps/grass/${i}.ogg`),
  water: Array.from({ length: 5 }, (_, i) => `/footsteps/water/${i}.ogg`),
  bones: Array.from({ length: 10 }, (_, i) => `/footsteps/bones/${i}.ogg`),
  dog: Array.from({ length: 8 }, (_, i) => `/footsteps/dog/${i}.ogg`),
  mech: ['/footsteps/mech/0.ogg'],
};

export type FootstepSoundId =
  | 'footstep_concrete'
  | 'footstep_metal'
  | 'footstep_tile'
  | 'footstep_gravel'
  | 'footstep_wood'
  | 'footstep_grass'
  | 'footstep_water'
  | 'footstep_bones'
  | 'footstep_dog'
  | 'footstep_mech';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterVolume = 0.7;
  private muted = false;
  public lastFootstepSurface: FootstepCategory | null = null;
  public lastFootstepSampleIndex = -1;
  public footstepPlayCount = 0;

  private rawFootstepData = new Map<FootstepCategory, (ArrayBuffer | null)[]>();
  private decodedFootstepBuffers = new Map<FootstepCategory, (AudioBuffer | null)[]>();
  private htmlAudioBank = new Map<FootstepCategory, HTMLAudioElement[]>();
  private shuffleBags = new Map<FootstepCategory, number[]>();
  private lastPlayedIndexByCategory = new Map<FootstepCategory, number>();
  private playedHistoryByCategory = new Map<FootstepCategory, number[]>();
  private preloadStarted = false;
  private decodingCategories = new Set<FootstepCategory>();

  constructor() {
    if (typeof window !== 'undefined') {
      this.preloadFootstepFiles();
    }
  }

  /**
   * Draws the next sample index (0 .. N-1) for a given material using a Fisher-Yates
   * non-repeating shuffle bag. Guarantees every single sound file in the folder is used
   * in random order before reshuffling, and prevents back-to-back repeats across bag boundaries.
   */
  public nextShuffledSampleIndex(category: FootstepCategory): number {
    const urls = FOOTSTEP_SOUND_MANIFEST[category] || FOOTSTEP_SOUND_MANIFEST.concrete;
    const count = urls.length;
    if (count <= 1) {
      this.lastPlayedIndexByCategory.set(category, 0);
      this.recordPlayedIndex(category, 0);
      return 0;
    }

    let bag = this.shuffleBags.get(category);
    if (!bag || bag.length === 0) {
      bag = Array.from({ length: count }, (_, i) => i);
      // Fisher-Yates shuffle
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = bag[i];
        bag[i] = bag[j];
        bag[j] = tmp;
      }
      // We pop from the end of `bag`, so `bag[bag.length - 1]` is the next index to play.
      // Ensure it never repeats the last played index from the previous cycle.
      const lastIdx = this.lastPlayedIndexByCategory.get(category);
      if (lastIdx !== undefined && bag[bag.length - 1] === lastIdx) {
        const swapPos = Math.floor(Math.random() * (bag.length - 1));
        const tmp = bag[bag.length - 1];
        bag[bag.length - 1] = bag[swapPos];
        bag[swapPos] = tmp;
      }
      this.shuffleBags.set(category, bag);
    }

    const chosenIndex = bag.pop()!;
    this.lastPlayedIndexByCategory.set(category, chosenIndex);
    this.recordPlayedIndex(category, chosenIndex);
    return chosenIndex;
  }

  private recordPlayedIndex(category: FootstepCategory, index: number): void {
    let hist = this.playedHistoryByCategory.get(category);
    if (!hist) {
      hist = [];
      this.playedHistoryByCategory.set(category, hist);
    }
    hist.push(index);
    if (hist.length > 64) {
      hist.shift();
    }
  }

  public getPlayedHistory(category: FootstepCategory): number[] {
    return [...(this.playedHistoryByCategory.get(category) || [])];
  }

  private preloadFootstepFiles(): void {
    if (this.preloadStarted || typeof window === 'undefined') return;
    this.preloadStarted = true;

    const categories = Object.keys(FOOTSTEP_SOUND_MANIFEST) as FootstepCategory[];
    for (const category of categories) {
      const urls = FOOTSTEP_SOUND_MANIFEST[category];
      const rawArr: (ArrayBuffer | null)[] = new Array(urls.length).fill(null);
      const decArr: (AudioBuffer | null)[] = new Array(urls.length).fill(null);
      const audioEls: HTMLAudioElement[] = [];

      this.rawFootstepData.set(category, rawArr);
      this.decodedFootstepBuffers.set(category, decArr);

      // Eagerly preload and decode ALL uploaded footstep packs so every material & variation is ready immediately
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        if (typeof Audio !== 'undefined') {
          const el = new Audio();
          el.preload = 'auto';
          el.src = url;
          audioEls.push(el);
        }

        if (typeof fetch === 'function') {
          this.fetchAndDecodeSample(category, i, url);
        }
      }

      this.htmlAudioBank.set(category, audioEls);
    }
  }

  private fetchAndDecodeSample(
    category: FootstepCategory,
    index: number,
    url: string
  ): void {
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((arrayBuf) => {
        const rawArr = this.rawFootstepData.get(category);
        if (rawArr) {
          rawArr[index] = arrayBuf;
        }
        if (this.ctx) {
          this.decodeSingleBuffer(this.ctx, category, index, arrayBuf);
        }
      })
      .catch(() => {
        // Ignore network errors in headless/offline test environments
      });
  }

  private decodeSingleBuffer(
    ctx: AudioContext,
    category: FootstepCategory,
    index: number,
    rawBuf: ArrayBuffer
  ): void {
    const decArr = this.decodedFootstepBuffers.get(category);
    if (!decArr || decArr[index]) return;

    try {
      // Clone ArrayBuffer so decodeAudioData never detaches the cached buffer
      const copy = rawBuf.slice(0);
      ctx
        .decodeAudioData(copy)
        .then((audioBuffer) => {
          // Peak-normalize each decoded variation (0..N-1) to 0.88 so quiet recordings (e.g. gravel/8, metal/1)
          // and hot recordings (e.g. tile/0, water/3) play at a consistent, balanced level
          for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
            const data = audioBuffer.getChannelData(ch);
            let peak = 0;
            for (let i = 0; i < data.length; i++) {
              const abs = Math.abs(data[i]);
              if (abs > peak) peak = abs;
            }
            if (peak > 0.05 && Math.abs(peak - 0.88) > 0.03) {
              const scale = 0.88 / peak;
              for (let i = 0; i < data.length; i++) {
                data[i] *= scale;
              }
            }
          }
          decArr[index] = audioBuffer;
        })
        .catch(() => {});
    } catch {
      // ignore
    }
  }

  private ensureCategoryDecoded(ctx: AudioContext, category: FootstepCategory): void {
    const urls = FOOTSTEP_SOUND_MANIFEST[category];
    const rawArr = this.rawFootstepData.get(category);
    const decArr = this.decodedFootstepBuffers.get(category);
    if (!urls || !rawArr || !decArr) return;

    for (let i = 0; i < urls.length; i++) {
      if (decArr[i]) continue;
      const raw = rawArr[i];
      if (raw) {
        this.decodeSingleBuffer(ctx, category, i, raw);
      } else if (!this.decodingCategories.has(category)) {
        this.fetchAndDecodeSample(category, i, urls[i]);
      }
    }
    this.decodingCategories.add(category);
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || this.masterVolume <= 0.01) return null;
    if (typeof window === 'undefined') return null;

    this.preloadFootstepFiles();

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

    if (this.ctx) {
      const categories = Object.keys(FOOTSTEP_SOUND_MANIFEST) as FootstepCategory[];
      for (const category of categories) {
        this.ensureCategoryDecoded(this.ctx, category);
      }
    }

    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public setVolume(volume: number, muted: boolean): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.muted = muted;
  }

  private getMaterialGainTrim(category: FootstepCategory): number {
    switch (category) {
      case 'concrete':
        return 0.95;
      case 'metal':
        return 1.05;
      case 'tile':
        return 0.84;
      case 'gravel':
        return 0.96;
      case 'wood':
        return 0.76;
      case 'grass':
        return 0.74;
      case 'water':
        return 0.85;
      default:
        return 0.9;
    }
  }

  private playSingleFootstepSample(
    category: FootstepCategory,
    sampleIdx: number,
    gainLevel: number,
    playbackRate: number,
    delaySec = 0
  ): void {
    const ctx = this.ensureContext();
    if (ctx) {
      this.ensureCategoryDecoded(ctx, category);
    }

    const decArr = this.decodedFootstepBuffers.get(category);
    const exactBuffer = decArr ? decArr[sampleIdx] : null;
    const finalGain = Math.max(
      0,
      Math.min(1.35, gainLevel * this.getMaterialGainTrim(category))
    );

    if (ctx && exactBuffer) {
      try {
        const startTime = ctx.currentTime + delaySec;
        const src = ctx.createBufferSource();
        src.buffer = exactBuffer;
        src.playbackRate.setValueAtTime(playbackRate, startTime);

        // Subtle material-appropriate acoustic shaping so footsteps sit naturally in the 3D mix
        const filter = ctx.createBiquadFilter();
        if (category === 'concrete') {
          filter.type = 'lowshelf';
          filter.frequency.setValueAtTime(160, startTime);
          filter.gain.setValueAtTime(2.2, startTime);
        } else if (category === 'wood' || category === 'grass') {
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(5200, startTime);
        } else {
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(7500, startTime);
        }

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(finalGain, startTime);

        src.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);
        src.start(startTime);
        return;
      } catch {
        // Fall through to HTMLAudioElement playback
      }
    }

    // Immediate HTMLAudioElement playback of the exact sampleIdx OGG file if Web Audio buffer is still decoding
    const audioEls = this.htmlAudioBank.get(category);
    if (audioEls && audioEls.length > 0) {
      const baseEl = audioEls[sampleIdx % audioEls.length];
      const triggerHtmlAudio = () => {
        try {
          const clone = baseEl.cloneNode(true) as HTMLAudioElement;
          clone.volume = Math.max(0, Math.min(1, finalGain));
          clone.playbackRate = Math.max(0.5, Math.min(2.0, playbackRate));
          void clone.play().catch(() => {});
        } catch {
          // ignore
        }
      };

      if (delaySec > 0 && typeof window !== 'undefined') {
        window.setTimeout(triggerHtmlAudio, Math.round(delaySec * 1000));
      } else {
        triggerHtmlAudio();
      }
    }
  }

  public playFootstep(
    surface: FootstepCategory = 'concrete',
    intensity: 'walk' | 'sprint' | 'crouch' | 'land' = 'walk',
    _stepIndex = 0
  ): void {
    const validSurface: FootstepCategory =
      surface in FOOTSTEP_SOUND_MANIFEST ? surface : 'concrete';
    this.lastFootstepSurface = validSurface;
    this.footstepPlayCount += 1;

    // Always advance the randomized shuffle bag so every variation (0..N-1) is selected in random non-repeating order
    const idx = this.nextShuffledSampleIndex(validSurface);
    this.lastFootstepSampleIndex = idx;

    if (this.muted || this.masterVolume <= 0.01) return;
    if (typeof window === 'undefined') return;

    const urls = FOOTSTEP_SOUND_MANIFEST[validSurface];
    if (!urls || urls.length === 0) return;

    const intensityScale =
      intensity === 'land'
        ? 1.12
        : intensity === 'sprint'
        ? 0.98
        : intensity === 'crouch'
        ? 0.46
        : 0.82;
    const vol = this.masterVolume * 0.88 * intensityScale;

    const speedRate =
      intensity === 'land'
        ? 0.96
        : intensity === 'sprint'
        ? 1.02
        : intensity === 'crouch'
        ? 0.97
        : 1.0;
    const rate = speedRate * (0.985 + Math.random() * 0.03);

    this.playSingleFootstepSample(validSurface, idx, vol, rate, 0);

    // On jump landing, play a second staggered boot step 42ms later using the next randomized OGG variation
    if (intensity === 'land' && urls.length > 1) {
      const idx2 = this.nextShuffledSampleIndex(validSurface);
      this.playSingleFootstepSample(validSurface, idx2, vol * 0.75, rate * 1.02, 0.042);
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
