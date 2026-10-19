import React, { useEffect, useRef, useState } from 'react';
import {
  CharacterId,
  CHARACTER_REGISTRY,
  GameMode,
  GameSettings,
  TrainingConfig,
} from '../game/config';
import { soundEngine } from '../audio/soundEngine';

export interface HudDomRefs {
  p1HpFill: React.RefObject<HTMLDivElement | null>;
  p1HpGhost: React.RefObject<HTMLDivElement | null>;
  p1HpText: React.RefObject<HTMLSpanElement | null>;
  p1StaminaFill: React.RefObject<HTMLDivElement | null>;
  p1StaminaText: React.RefObject<HTMLSpanElement | null>;
  p1AbilityFill: React.RefObject<HTMLDivElement | null>;
  p1AbilityText: React.RefObject<HTMLSpanElement | null>;
  p1StateBadge: React.RefObject<HTMLSpanElement | null>;
  p1ComboBox: React.RefObject<HTMLDivElement | null>;
  p1ComboHits: React.RefObject<HTMLSpanElement | null>;
  p1ComboDmg: React.RefObject<HTMLSpanElement | null>;
  p2HpFill: React.RefObject<HTMLDivElement | null>;
  p2HpGhost: React.RefObject<HTMLDivElement | null>;
  p2HpText: React.RefObject<HTMLSpanElement | null>;
  p2StaminaFill: React.RefObject<HTMLDivElement | null>;
  p2StaminaText: React.RefObject<HTMLSpanElement | null>;
  p2StateBadge: React.RefObject<HTMLSpanElement | null>;
  p2ComboBox: React.RefObject<HTMLDivElement | null>;
  p2ComboHits: React.RefObject<HTMLSpanElement | null>;
  p2ComboDmg: React.RefObject<HTMLSpanElement | null>;
  timerText: React.RefObject<HTMLSpanElement | null>;
  aiStateBadge: React.RefObject<HTMLSpanElement | null>;
  lockReticle: React.RefObject<HTMLDivElement | null>;
  crosshairRef?: React.RefObject<HTMLDivElement | null>;
  hitMarkerRef?: React.RefObject<HTMLDivElement | null>;
  mobileAbilityOverlay: React.RefObject<HTMLDivElement | null>;
  mobileAbilityTimer: React.RefObject<HTMLSpanElement | null>;
  btnLightRef?: React.RefObject<HTMLButtonElement | null>;
  btnHeavyRef?: React.RefObject<HTMLButtonElement | null>;
  btnDodgeRef?: React.RefObject<HTMLButtonElement | null>;
  btnAbilityRef?: React.RefObject<HTMLButtonElement | null>;
}

export interface TouchInputState {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  jumpPressed?: boolean;
  shoulderTogglePressed?: boolean;
  aimHeld?: boolean;
  lightPressed: boolean;
  heavyPressed: boolean;
  guardHeld: boolean;
  guardJustPressed: boolean;
  dodgePressed: boolean;
  abilityPressed: boolean;
  cameraDeltaX?: number;
  cameraDeltaY?: number;
  portraitOverlayActive?: boolean;
}

export interface CombatHUDProps {
  hudRefs: HudDomRefs;
  p1Char: CharacterId;
  p2Char: CharacterId;
  p1Name?: string;
  p2Name?: string;
  roundNumber: number;
  roundsToWin?: number;
  p1RoundsWon: number;
  p2RoundsWon: number;
  gameMode: GameMode;
  countdownValue?: number | null;
  roundBanner?: string | null;
  combatCallout?: {
    id: number;
    text: string;
    subtext?: string;
    color: string;
  } | null;
  muted?: boolean;
  isFullscreen?: boolean;
  lockedOn: boolean;
  settings?: GameSettings;
  trainingConfig: TrainingConfig;
  touchInputRef: React.MutableRefObject<TouchInputState>;
  onToggleMute?: () => void;
  onToggleFullscreen?: () => void;
  onToggleLockOn: () => void;
  onToggleControlHints?: () => void;
  onPause: () => void;
  onRestartRound: () => void;
  onUpdateTrainingConfig: (next: Partial<TrainingConfig>) => void;
}

export const CombatHUD: React.FC<CombatHUDProps> = ({
  hudRefs,
  p1Char,
  p2Char,
  p1RoundsWon,
  p2RoundsWon,
  gameMode,
  countdownValue,
  roundBanner,
  combatCallout,
  lockedOn,
  trainingConfig,
  touchInputRef,
  onToggleLockOn,
  onPause,
  onRestartRound,
  onUpdateTrainingConfig,
}) => {
  const p1Def = CHARACTER_REGISTRY[p1Char];
  const p2Def = CHARACTER_REGISTRY[p2Char];

  const [trainingDrawerOpen, setTrainingDrawerOpen] = useState(false);

  // Virtual Analog Stick State
  const stickZoneRef = useRef<HTMLDivElement | null>(null);
  const stickKnobRef = useRef<HTMLDivElement | null>(null);
  const activeStickPointerId = useRef<number | null>(null);
  const stickOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleStickStart = (clientX: number, clientY: number, pointerId: number) => {
    soundEngine.unlock();
    activeStickPointerId.current = pointerId;
    stickOrigin.current = { x: clientX, y: clientY };
    if (stickKnobRef.current) {
      stickKnobRef.current.style.transform = `translate3d(0px, 0px, 0)`;
    }
  };

  const handleStickMove = (clientX: number, clientY: number, pointerId: number) => {
    if (activeStickPointerId.current !== pointerId) return;
    const dx = clientX - stickOrigin.current.x;
    const dy = clientY - stickOrigin.current.y;
    const maxRadius = 46;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(maxRadius, dist);
    const angle = Math.atan2(dy, dx);

    const nx = dist > 5 ? (Math.cos(angle) * clampedDist) / maxRadius : 0;
    const ny = dist > 5 ? (Math.sin(angle) * clampedDist) / maxRadius : 0;

    touchInputRef.current.moveX = nx;
    touchInputRef.current.moveZ = ny;
    touchInputRef.current.sprint = dist > maxRadius * 0.78;

    if (stickKnobRef.current) {
      const kx = Math.cos(angle) * clampedDist;
      const ky = Math.sin(angle) * clampedDist;
      stickKnobRef.current.style.transform = `translate3d(${kx}px, ${ky}px, 0)`;
    }
  };

  const handleStickEnd = (pointerId: number) => {
    if (activeStickPointerId.current !== pointerId) return;
    activeStickPointerId.current = null;
    touchInputRef.current.moveX = 0;
    touchInputRef.current.moveZ = 0;
    touchInputRef.current.sprint = false;
    if (stickKnobRef.current) {
      stickKnobRef.current.style.transform = `translate3d(0px, 0px, 0)`;
    }
  };

  useEffect(() => {
    const onWindowPointerMove = (e: PointerEvent) => {
      if (activeStickPointerId.current === e.pointerId) {
        handleStickMove(e.clientX, e.clientY, e.pointerId);
      }
    };
    const onWindowPointerUp = (e: PointerEvent) => {
      if (activeStickPointerId.current === e.pointerId) {
        handleStickEnd(e.pointerId);
      }
      if (touchInputRef.current.guardHeld) {
        touchInputRef.current.guardHeld = false;
      }
    };
    window.addEventListener('pointermove', onWindowPointerMove, { passive: true });
    window.addEventListener('pointerup', onWindowPointerUp, { passive: true });
    window.addEventListener('pointercancel', onWindowPointerUp, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
    };
  }, []);

  const bannerHeadline =
    countdownValue !== null && countdownValue !== undefined
      ? countdownValue > 0
        ? `${countdownValue}`
        : 'FIGHT!'
      : roundBanner || combatCallout?.text || null;

  const bannerSub = combatCallout?.subtext || null;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* 3D Projected Lock-On Diamond Reticle */}
      <div
        ref={hudRefs.lockReticle}
        className="fixed top-0 left-0 w-9 h-9 opacity-0 transition-opacity duration-150 pointer-events-none"
      >
        <div className="w-full h-full border-2 border-cyan-400/80 rotate-45 rounded-sm shadow-[0_0_12px_rgba(56,189,248,0.75)] flex items-center justify-center">
          <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
        </div>
      </div>

      {/* Subtle Center Crosshair & Hit Marker */}
      <div
        ref={hudRefs.crosshairRef}
        className="fixed left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-100"
      >
        <div className="relative w-5 h-5 flex items-center justify-center opacity-55">
          <div className="w-1 h-1 rounded-full bg-white shadow-[0_0_4px_#38bdf8]" />
          <div className="absolute -top-1 w-0.5 h-1.5 bg-cyan-300/70" />
          <div className="absolute -bottom-1 w-0.5 h-1.5 bg-cyan-300/70" />
          <div className="absolute -left-1 w-1.5 h-0.5 bg-cyan-300/70" />
          <div className="absolute -right-1 w-1.5 h-0.5 bg-cyan-300/70" />
        </div>
        <div
          ref={hudRefs.hitMarkerRef}
          className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-75"
        >
          <div className="w-6 h-0.5 bg-amber-400 rotate-45 shadow-[0_0_8px_#f59e0b]" />
          <div className="absolute w-6 h-0.5 bg-amber-400 -rotate-45 shadow-[0_0_8px_#f59e0b]" />
        </div>
      </div>

      {/* =================================================================== */}
      {/* ULTRA-CLEAN TOP EDGE VITAL BARS (ZERO BOX CLUTTER)                  */}
      {/* =================================================================== */}
      <header className="w-full px-3 sm:px-6 pt-2.5 flex items-start justify-between gap-3">
        {/* PLAYER 1 VITALS (LEFT) */}
        <div className="w-[38%] max-w-[290px] flex flex-col gap-1">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <span className="font-display font-black text-xs sm:text-sm tracking-wider text-white drop-shadow">
                {p1Def.name}
              </span>
              <div className="flex items-center gap-1" aria-label={`Player 1 Rounds Won: ${p1RoundsWon}`}>
                {[0, 1].map((idx) => (
                  <span
                    key={idx}
                    className={`w-2 h-2 rounded-full transition-all ${
                      p1RoundsWon > idx
                        ? 'bg-cyan-400 shadow-[0_0_6px_#38bdf8]'
                        : 'bg-slate-800/80 border border-slate-600/60'
                    }`}
                  />
                ))}
              </div>
            </div>
            <span
              ref={hudRefs.p1HpText}
              className="font-mono font-bold text-[11px] text-cyan-300 tabular-nums drop-shadow"
            >
              {p1Def.stats.maxHp}
            </span>
          </div>

          {/* Sleek Floating HP Bar */}
          <div className="relative h-2.5 sm:h-3 w-full bg-slate-950/75 rounded-full overflow-hidden border border-white/15 shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            <div
              ref={hudRefs.p1HpGhost}
              className="absolute inset-y-0 left-0 bg-amber-400/75 transition-all duration-150"
              style={{ width: '100%' }}
            />
            <div
              ref={hudRefs.p1HpFill}
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400"
              style={{ width: '100%' }}
            />
          </div>

          {/* Sleek Stamina Bar */}
          <div className="relative h-1.5 w-[86%] bg-slate-950/75 rounded-full overflow-hidden border border-white/10">
            <div
              ref={hudRefs.p1StaminaFill}
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-yellow-300"
              style={{ width: '100%' }}
            />
          </div>

          {/* Hidden DOM refs kept for zero-allocation telemetry compatibility */}
          <div className="hidden">
            <span ref={hudRefs.p1StaminaText}>100</span>
            <span ref={hudRefs.p1StateBadge}>IDLE</span>
            <div ref={hudRefs.p1AbilityFill} />
            <span ref={hudRefs.p1AbilityText}>READY</span>
          </div>

          {/* Minimal Floating Combo Counter */}
          <div
            ref={hudRefs.p1ComboBox}
            className="mt-1 opacity-0 transition-opacity duration-150 pointer-events-none flex flex-col"
          >
            <span
              ref={hudRefs.p1ComboHits}
              className="font-display font-black text-base sm:text-xl italic text-amber-400 drop-shadow-[0_2px_8px_rgba(245,158,11,0.65)]"
            >
              2 HIT
            </span>
            <span
              ref={hudRefs.p1ComboDmg}
              className="font-mono text-[10px] font-bold text-cyan-200 tracking-wider"
            >
              24 DMG
            </span>
          </div>
        </div>

        {/* CENTER ROUND CLOCK */}
        <div className="flex flex-col items-center pt-0.5">
          <span
            ref={hudRefs.timerText}
            className="w-11 h-9 sm:w-12 sm:h-10 rounded-full bg-slate-950/70 border border-white/15 flex items-center justify-center font-mono font-black text-base sm:text-lg text-white tabular-nums shadow-[0_4px_14px_rgba(0,0,0,0.5)]"
          >
            90
          </span>
        </div>

        {/* PLAYER 2 VITALS (RIGHT) + CIRCULAR TOP UTILITY ICONS */}
        <div className="w-[38%] max-w-[290px] flex flex-col items-end gap-1">
          <div className="w-full flex items-center justify-between px-0.5">
            <span
              ref={hudRefs.p2HpText}
              className="font-mono font-bold text-[11px] text-rose-300 tabular-nums drop-shadow"
            >
              {p2Def.stats.maxHp}
            </span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1" aria-label={`Player 2 Rounds Won: ${p2RoundsWon}`}>
                {[0, 1].map((idx) => (
                  <span
                    key={idx}
                    className={`w-2 h-2 rounded-full transition-all ${
                      p2RoundsWon > idx
                        ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
                        : 'bg-slate-800/80 border border-slate-600/60'
                    }`}
                  />
                ))}
              </div>
              <span className="font-display font-black text-xs sm:text-sm tracking-wider text-white drop-shadow">
                {p2Def.name}
              </span>
            </div>
          </div>

          {/* Sleek Floating HP Bar (Right-aligned) */}
          <div className="relative h-2.5 sm:h-3 w-full bg-slate-950/75 rounded-full overflow-hidden border border-white/15 shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            <div
              ref={hudRefs.p2HpGhost}
              className="absolute inset-y-0 right-0 bg-amber-400/75 transition-all duration-150"
              style={{ width: '100%' }}
            />
            <div
              ref={hudRefs.p2HpFill}
              className="absolute inset-y-0 right-0 bg-gradient-to-l from-rose-500 via-pink-500 to-amber-500"
              style={{ width: '100%' }}
            />
          </div>

          {/* Sleek Stamina Bar (Right-aligned) */}
          <div className="relative h-1.5 w-[86%] bg-slate-950/75 rounded-full overflow-hidden border border-white/10">
            <div
              ref={hudRefs.p2StaminaFill}
              className="absolute inset-y-0 right-0 bg-gradient-to-l from-amber-500 to-yellow-300"
              style={{ width: '100%' }}
            />
          </div>

          {/* Hidden DOM refs kept for zero-allocation compatibility */}
          <div className="hidden">
            <span ref={hudRefs.p2StaminaText}>100</span>
            <span ref={hudRefs.p2StateBadge}>IDLE</span>
            <span ref={hudRefs.aiStateBadge}>DUEL</span>
          </div>

          {/* Circular Icon Utility Buttons (Lock-On, Training Gear, Pause) */}
          <div className="mt-1.5 flex items-center gap-2 pointer-events-auto">
            {gameMode === 'training' && (
              <button
                type="button"
                aria-label="Training Settings"
                onClick={() => {
                  soundEngine.play('ui_click');
                  setTrainingDrawerOpen((v) => !v);
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all active:scale-90 ${
                  trainingDrawerOpen
                    ? 'bg-amber-500/30 border-amber-400 text-amber-300'
                    : 'bg-slate-950/65 border-white/15 text-slate-300 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            )}

            <button
              type="button"
              aria-label="Toggle Target Lock"
              onClick={() => {
                soundEngine.play('ui_click');
                onToggleLockOn();
              }}
              className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all active:scale-90 ${
                lockedOn
                  ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(56,189,248,0.4)]'
                  : 'bg-slate-950/65 border-white/15 text-slate-400 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="7" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
              </svg>
            </button>

            <button
              type="button"
              aria-label="Pause Match"
              onClick={() => {
                soundEngine.play('ui_click');
                onPause();
              }}
              className="w-9 h-9 rounded-full bg-slate-950/65 hover:bg-slate-900 border border-white/15 flex items-center justify-center text-slate-200 transition-all active:scale-90"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            </button>
          </div>

          <div
            ref={hudRefs.p2ComboBox}
            className="mt-1 text-right opacity-0 transition-opacity duration-150 pointer-events-none flex flex-col items-end"
          >
            <span
              ref={hudRefs.p2ComboHits}
              className="font-display font-black text-base sm:text-xl italic text-rose-400 drop-shadow-[0_2px_8px_rgba(244,63,94,0.65)]"
            >
              2 HIT
            </span>
            <span
              ref={hudRefs.p2ComboDmg}
              className="font-mono text-[10px] font-bold text-amber-200 tracking-wider"
            >
              24 DMG
            </span>
          </div>
        </div>
      </header>

      {/* COMPACT POPOVER TRAINING DRAWER (ONLY WHEN OPENED IN TRAINING MODE) */}
      {gameMode === 'training' && trainingDrawerOpen && (
        <aside className="fixed top-20 right-4 z-30 pointer-events-auto bg-slate-950/90 backdrop-blur-md border border-white/15 rounded-2xl p-3 flex flex-col gap-2 w-52 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Training Lab
            </span>
            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui_click');
                onRestartRound();
              }}
              className="px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-cyan-300"
            >
              Reset
            </button>
          </div>
          <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
            <span>Dummy AI</span>
            <select
              aria-label="Training Dummy Behavior"
              value={trainingConfig.dummyBehavior}
              onChange={(e) =>
                onUpdateTrainingConfig({
                  dummyBehavior: e.target.value as TrainingConfig['dummyBehavior'],
                })
              }
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-xs text-white"
            >
              <option value="idle">Stand</option>
              <option value="block_all">Guard</option>
              <option value="counter_hit">Counter</option>
              <option value="active_bot">Spar</option>
            </select>
          </label>
          <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
            <span>Infinite Stamina</span>
            <input
              type="checkbox"
              checked={trainingConfig.infiniteStamina}
              onChange={(e) => onUpdateTrainingConfig({ infiniteStamina: e.target.checked })}
              className="accent-cyan-400"
            />
          </label>
          <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
            <span>Instant Cooldown</span>
            <input
              type="checkbox"
              checked={trainingConfig.instantCooldowns}
              onChange={(e) => onUpdateTrainingConfig({ instantCooldowns: e.target.checked })}
              className="accent-cyan-400"
            />
          </label>
        </aside>
      )}

      {/* CENTER ROUND ANNOUNCEMENT BANNER */}
      {bannerHeadline && (
        <div className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
          <div className="px-8 py-3 flex flex-col items-center">
            <h2 className="font-display font-black text-4xl sm:text-6xl tracking-tight uppercase italic text-white drop-shadow-[0_4px_24px_rgba(245,158,11,0.75)]">
              {bannerHeadline}
            </h2>
            {bannerSub && (
              <p className="mt-1 font-mono text-xs sm:text-sm uppercase tracking-[0.25em] text-cyan-300 font-semibold drop-shadow">
                {bannerSub}
              </p>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* CIRCULAR ICON-ONLY COMBAT CONTROLLER (BOTTOM CORNERS ONLY)          */}
      {/* =================================================================== */}
      <div className="fixed inset-x-0 bottom-0 p-3 sm:p-5 flex items-end justify-between pointer-events-none">
        {/* LEFT THUMB: Circular Analog Joystick */}
        <div
          ref={stickZoneRef}
          role="slider"
          aria-label="Movement Analog Joystick"
          aria-valuemin={-1}
          aria-valuemax={1}
          aria-valuenow={0}
          tabIndex={0}
          onPointerDown={(e) => {
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // Ignore InvalidStateError on synthetic or non-capturable pointers
            }
            handleStickStart(e.clientX, e.clientY, e.pointerId);
          }}
          onPointerMove={(e) => handleStickMove(e.clientX, e.clientY, e.pointerId)}
          onPointerUp={(e) => {
            try {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            } catch {
              // Ignore release errors
            }
            handleStickEnd(e.pointerId);
          }}
          onPointerCancel={(e) => handleStickEnd(e.pointerId)}
          onLostPointerCapture={(e) => handleStickEnd(e.pointerId)}
          className="pointer-events-auto relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-slate-950/40 border border-white/15 flex items-center justify-center touch-none shadow-[0_0_24px_rgba(0,0,0,0.45)]"
        >
          <div className="w-16 h-16 rounded-full border border-white/10 pointer-events-none" />
          {/* Directional Chevrons */}
          <svg className="absolute top-2 w-3 h-3 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M18 15l-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg className="absolute bottom-2 w-3 h-3 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg className="absolute left-2 w-3 h-3 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg className="absolute right-2 w-3 h-3 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          <div
            ref={stickKnobRef}
            className="w-11 h-11 rounded-full bg-gradient-to-b from-cyan-400/80 to-sky-600/80 border-2 border-white/75 shadow-[0_0_16px_rgba(56,189,248,0.65)] pointer-events-none flex items-center justify-center"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-white/90" />
          </div>
        </div>

        {/* RIGHT THUMB: Circular Icon-Only Action Wheel in Natural Sequence Arc */}
        <div className="pointer-events-auto relative w-60 h-48 sm:w-64 sm:h-52 touch-none">
          {/* 1. JUMP BUTTON (Outer Lower-Left Arc) */}
          <button
            type="button"
            aria-label="Jump"
            onPointerDown={() => {
              soundEngine.unlock();
              touchInputRef.current.jumpPressed = true;
            }}
            className="absolute bottom-2 right-44 w-11 h-11 rounded-full bg-slate-950/70 hover:bg-slate-900 active:scale-90 border border-white/25 flex items-center justify-center text-slate-200 shadow-lg transition-transform"
          >
            {/* Double Upward Leap Chevron Icon */}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M17 11l-5-5-5 5M17 18l-5-5-5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* 2. DASH / DODGE BUTTON (Inner Lower-Left Arc - Cyan Speed Wing Icon) */}
          <button
            ref={hudRefs.btnDodgeRef}
            type="button"
            aria-label="Dodge Dash"
            onPointerDown={() => {
              soundEngine.unlock();
              touchInputRef.current.dodgePressed = true;
            }}
            className="absolute bottom-2 right-24 w-14 h-14 rounded-full bg-cyan-950/75 hover:bg-cyan-900/80 active:scale-90 border-2 border-cyan-400/80 flex items-center justify-center text-cyan-300 shadow-[0_0_16px_rgba(56,189,248,0.35)] transition-transform"
          >
            {/* Unmistakable Winged Dash / Speed Burst Icon */}
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
              <path d="M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 8h8M3 12h10M5 16h8" strokeLinecap="round" />
            </svg>
          </button>

          {/* 3. GUARD / PARRY BUTTON (Middle Arc - Tactical Shield Icon) */}
          <button
            type="button"
            aria-label="Guard and Parry"
            onPointerDown={(e) => {
              soundEngine.unlock();
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // Ignore InvalidStateError on synthetic or non-capturable pointers
              }
              touchInputRef.current.guardHeld = true;
              touchInputRef.current.guardJustPressed = true;
            }}
            onPointerUp={(e) => {
              try {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              } catch {
                // Ignore release errors
              }
              touchInputRef.current.guardHeld = false;
            }}
            onPointerCancel={() => {
              touchInputRef.current.guardHeld = false;
            }}
            onLostPointerCapture={() => {
              touchInputRef.current.guardHeld = false;
            }}
            className="absolute bottom-[74px] right-[96px] w-14 h-14 rounded-full bg-sky-950/75 hover:bg-sky-900/80 active:scale-90 border-2 border-sky-400/80 flex items-center justify-center text-sky-300 shadow-[0_0_16px_rgba(56,189,248,0.35)] transition-transform"
          >
            {/* Unmistakable Aegis Shield Icon */}
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path
                d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M12 8v7M9 11h6" strokeLinecap="round" />
            </svg>
          </button>

          {/* 4. SPECIAL ABILITY BUTTON (Upper-Left Arc - Lightning Singularity Star Icon) */}
          <button
            ref={hudRefs.btnAbilityRef}
            type="button"
            aria-label="Special Ability"
            onPointerDown={() => {
              soundEngine.unlock();
              touchInputRef.current.abilityPressed = true;
            }}
            className="absolute bottom-[118px] right-[144px] w-14 h-14 rounded-full overflow-hidden bg-purple-950/80 hover:bg-purple-900/85 active:scale-90 border-2 border-purple-400/85 flex items-center justify-center text-purple-200 shadow-[0_0_18px_rgba(168,85,247,0.45)] transition-transform"
          >
            <div
              ref={hudRefs.mobileAbilityOverlay}
              className="absolute bottom-0 inset-x-0 bg-slate-950/80 transition-all duration-100 pointer-events-none"
              style={{ height: '0%' }}
            />
            {/* Unmistakable High-Voltage Lightning Bolt Icon */}
            <svg className="relative z-10 w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
            </svg>
            <span
              ref={hudRefs.mobileAbilityTimer}
              className="absolute bottom-1 inset-x-0 text-center font-mono text-[9px] font-bold text-amber-300 z-20"
            />
          </button>

          {/* 5. HEAVY ATTACK BUTTON (Upper-Right Arc - Heavy Cleave Burst Icon) */}
          <button
            ref={hudRefs.btnHeavyRef}
            type="button"
            aria-label="Heavy Attack"
            onPointerDown={() => {
              soundEngine.unlock();
              touchInputRef.current.heavyPressed = true;
            }}
            className="absolute bottom-[106px] right-3 w-15 h-15 sm:w-16 sm:h-16 rounded-full bg-rose-950/80 hover:bg-rose-900/85 active:scale-90 border-2 border-rose-400/85 flex items-center justify-center text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.45)] transition-transform"
          >
            {/* Unmistakable Heavy Meteor Impact / Cleaving Starburst Blade Icon */}
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polygon
                points="12 2 14.8 8.5 22 9.3 16.5 14 18.2 21 12 17.3 5.8 21 7.5 14 2 9.3 9.2 8.5 12 2"
                fill="currentColor"
                fillOpacity="0.25"
              />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
          </button>

          {/* 6. PRIMARY LIGHT ATTACK BUTTON (Anchor Corner - Large Twin Crossed Blades Icon) */}
          <button
            ref={hudRefs.btnLightRef}
            type="button"
            aria-label="Light Attack"
            onPointerDown={() => {
              soundEngine.unlock();
              touchInputRef.current.lightPressed = true;
            }}
            className="absolute bottom-2 right-2 w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/85 to-orange-600/85 hover:from-amber-400 hover:to-orange-500 active:scale-90 border-2 border-amber-200 flex items-center justify-center text-slate-950 shadow-[0_0_26px_rgba(245,158,11,0.65)] transition-transform"
          >
            {/* Unmistakable Crossed Twin War-Blades Icon */}
            <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M14.5 17.5L3 6V3h3l11.5 11.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13 19l6-6M16 16l4 4M19 21l2-2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9.5 17.5L21 6V3h-3L6.5 14.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M11 19l-6-6M8 16l-4 4M5 21l-2-2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
