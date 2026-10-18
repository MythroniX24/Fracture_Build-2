export type SoundEffectType =
  | 'ui_click'
  | 'ui_confirm'
  | 'countdown_tick'
  | 'countdown_fight'
  | 'hit_light'
  | 'hit_heavy'
  | 'hit_ability'
  | 'blocked'
  | 'guard_break'
  | 'parried'
  | 'dodge'
  | 'ability_volt'
  | 'ability_rift'
  | 'ko';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterVolume = 0.7;
  private muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || this.masterVolume <= 0.01) return null;
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

    return this.ctx;
  }

  public setVolume(volume: number, muted: boolean): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.muted = muted;
  }

  public play(effect: SoundEffectType): void {
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

        case 'ko': {
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
