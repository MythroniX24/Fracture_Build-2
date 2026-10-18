import React, { useEffect, useRef, useState } from 'react';
import {
  BotDifficulty,
  CHARACTER_REGISTRY,
  CharacterId,
  GameMode,
  GameSettings,
  TrainingConfig,
} from '../game/config.ts';

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
  mobileAbilityOverlay: React.RefObject<HTMLDivElement | null>;
  mobileAbilityTimer: React.RefObject<HTMLSpanElement | null>;
  btnLightRef: React.RefObject<HTMLButtonElement | null>;
  btnHeavyRef: React.RefObject<HTMLButtonElement | null>;
  btnDodgeRef: React.RefObject<HTMLButtonElement | null>;
  btnAbilityRef: React.RefObject<HTMLButtonElement | null>;
}

export interface TouchInputState {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  lightPressed: boolean;
  heavyPressed: boolean;
  guardHeld: boolean;
  guardJustPressed: boolean;
  dodgePressed: boolean;
  abilityPressed: boolean;
  cameraDeltaX: number;
  cameraDeltaY: number;
  portraitOverlayActive?: boolean;
}

interface CombatHUDProps {
  hudRefs: HudDomRefs;
  p1Char: CharacterId;
  p2Char: CharacterId;
  p1Name: string;
  p2Name: string;
  roundNumber: number;
  roundsToWin: number;
  p1RoundsWon: number;
  p2RoundsWon: number;
  gameMode: GameMode;
  countdownValue: number | null; // 3, 2, 1, 0 ('FIGHT!')
  roundBanner: string | null;
  combatCallout: { id: number; text: string; subtext?: string; color: string } | null;
  muted: boolean;
  isFullscreen: boolean;
  lockedOn: boolean;
  settings: GameSettings;
  trainingConfig: TrainingConfig;
  touchInputRef: React.MutableRefObject<TouchInputState>;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onToggleLockOn: () => void;
  onToggleControlHints: () => void;
  onPause: () => void;
  onRestartRound: () => void;
  onUpdateTrainingConfig: (updates: Partial<TrainingConfig>) => void;
}

const formatKeyLabel = (code: string): string => {
  if (!code) return '-';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
  if (code === 'Space') return 'SPACE';
  if (code === 'Tab') return 'TAB';
  return code.toUpperCase();
};

export const CombatHUD: React.FC<CombatHUDProps> = ({
  hudRefs,
  p1Char,
  p2Char,
  p1Name,
  p2Name,
  roundNumber,
  roundsToWin,
  p1RoundsWon,
  p2RoundsWon,
  gameMode,
  countdownValue,
  roundBanner,
  combatCallout,
  muted,
  isFullscreen,
  lockedOn,
  settings,
  trainingConfig,
  touchInputRef,
  onToggleMute,
  onToggleFullscreen,
  onToggleLockOn,
  onToggleControlHints,
  onPause,
  onRestartRound,
  onUpdateTrainingConfig,
}) => {
  const p1Def = CHARACTER_REGISTRY[p1Char];
  const p2Def = CHARACTER_REGISTRY[p2Char];
  const kb = settings.keybindings;

  const [dockCollapsed, setDockCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight < 540 : false
  );
  const [joystickVisual, setJoystickVisual] = useState({
    active: false,
    dx: 0,
    dy: 0,
    magnitude: 0,
    sprinting: false,
  });

  // Track pressed state of mobile combat buttons for crisp active visual feedback
  const [pressedButtons, setPressedButtons] = useState<{
    light: boolean;
    heavy: boolean;
    guard: boolean;
    dodge: boolean;
    ability: boolean;
  }>({
    light: false,
    heavy: false,
    guard: false,
    dodge: false,
    ability: false,
  });

  // Track portrait orientation on mobile screens for Rotate Device overlay
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  const [portraitDismissed, setPortraitDismissed] = useState(false);

  const joystickPointerIdRef = useRef<number | null>(null);
  const joystickCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const guardPointerIdRef = useRef<number | null>(null);

  useEffect(() => {
    const checkOrientation = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const portrait = h > w && w < 768;
      setIsMobilePortrait(portrait);
      if (!portrait) {
        setPortraitDismissed(false);
      }
      if (h < 540) {
        setDockCollapsed(true);
      }
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Sync portrait overlay pause state to touchInputRef so GameCanvas suspends combat until rotated/dismissed
  useEffect(() => {
    touchInputRef.current.portraitOverlayActive = isMobilePortrait && !portraitDismissed;
  }, [isMobilePortrait, portraitDismissed, touchInputRef]);

  // Reset all touch inputs cleanly if the user switches apps, loses focus, or changes visibility
  useEffect(() => {
    const resetAllTouchInputs = () => {
      joystickPointerIdRef.current = null;
      guardPointerIdRef.current = null;
      setJoystickVisual({ active: false, dx: 0, dy: 0, magnitude: 0, sprinting: false });
      setPressedButtons({
        light: false,
        heavy: false,
        guard: false,
        dodge: false,
        ability: false,
      });
      touchInputRef.current.moveX = 0;
      touchInputRef.current.moveZ = 0;
      touchInputRef.current.sprint = false;
      touchInputRef.current.lightPressed = false;
      touchInputRef.current.heavyPressed = false;
      touchInputRef.current.guardHeld = false;
      touchInputRef.current.guardJustPressed = false;
      touchInputRef.current.dodgePressed = false;
      touchInputRef.current.abilityPressed = false;
    };

    const onVisibilityChange = () => {
      if (document.hidden) resetAllTouchInputs();
    };

    window.addEventListener('blur', resetAllTouchInputs);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('blur', resetAllTouchInputs);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [touchInputRef]);

  const renderCharacterCrest = (charId: CharacterId, accentHex: string) => {
    if (charId === 'volt') {
      return (
        <svg viewBox="0 0 32 32" className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" aria-hidden="true">
          <polygon
            points="16,2 29,9 29,23 16,30 3,23 3,9"
            fill="#14161b"
            stroke={accentHex}
            strokeWidth="2"
          />
          <path d="M18 6 L10 17 L16 17 L13 26 L22 14 L16 14 Z" fill={accentHex} />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 32 32" className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" aria-hidden="true">
        <polygon
          points="16,2 29,16 16,30 3,16"
          fill="#14161b"
          stroke={accentHex}
          strokeWidth="2"
        />
        <circle cx="16" cy="16" r="5" fill="none" stroke="#d6d3cd" strokeWidth="2" />
        <circle cx="16" cy="16" r="2" fill={accentHex} />
      </svg>
    );
  };

  const renderRoundPips = (wonCount: number, maxPips: number, align: 'left' | 'right') => {
    const pips = [];
    for (let i = 0; i < maxPips; i++) {
      const isWon = i < wonCount;
      pips.push(
        <svg
          key={i}
          viewBox="0 0 24 24"
          className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
          aria-label={isWon ? 'Round won' : 'Round open'}
        >
          <polygon
            points="12,2 21,7 21,17 12,22 3,17 3,7"
            fill={isWon ? '#d97706' : '#181a20'}
            stroke={isWon ? '#fef3c7' : '#525866'}
            strokeWidth="2"
          />
          {isWon && <circle cx="12" cy="12" r="4" fill="#fef3c7" />}
        </svg>
      );
    }
    return (
      <div className={`flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {pips}
      </div>
    );
  };

  // =========================================================================
  // VIRTUAL ANALOG JOYSTICK HANDLERS (360-degree normalized + deadzone + multi-touch safe)
  // =========================================================================
  const updateJoystickFromPoint = (clientX: number, clientY: number) => {
    const maxRadius = 40;
    const rawDx = (clientX - joystickCenterRef.current.x) * settings.touchSensitivity;
    const rawDy = (clientY - joystickCenterRef.current.y) * settings.touchSensitivity;
    const dist = Math.hypot(rawDx, rawDy);
    const clampedDist = Math.min(maxRadius, dist);
    const angle = Math.atan2(rawDy, rawDx);
    const dx = Math.cos(angle) * clampedDist;
    const dy = Math.sin(angle) * clampedDist;

    const rawNorm = clampedDist / maxRadius;
    const deadzone = settings.touchDeadzone || 0.12;

    if (rawNorm <= deadzone) {
      setJoystickVisual({ active: true, dx, dy, magnitude: 0, sprinting: false });
      touchInputRef.current.moveX = 0;
      touchInputRef.current.moveZ = 0;
      touchInputRef.current.sprint = false;
      return;
    }

    // Rescale magnitude smoothly from [deadzone, 1.0] -> [0.0, 1.0]
    const rescaledMag = Math.min(1, (rawNorm - deadzone) / (1 - deadzone));
    const normX = Math.cos(angle) * rescaledMag;
    const normY = Math.sin(angle) * rescaledMag;
    const isSprinting = rawNorm > 0.82;

    setJoystickVisual({
      active: true,
      dx,
      dy,
      magnitude: rescaledMag,
      sprinting: isSprinting,
    });
    touchInputRef.current.moveX = normX;
    touchInputRef.current.moveZ = normY;
    touchInputRef.current.sprint = isSprinting;
  };

  const handleJoystickStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (joystickPointerIdRef.current !== null) return;
    joystickPointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unsupported in synthetic events
    }
    const rect = e.currentTarget.getBoundingClientRect();
    joystickCenterRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    updateJoystickFromPoint(e.clientX, e.clientY);
  };

  const handleJoystickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joystickPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    updateJoystickFromPoint(e.clientX, e.clientY);
  };

  const handleJoystickEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joystickPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    joystickPointerIdRef.current = null;
    setJoystickVisual({ active: false, dx: 0, dy: 0, magnitude: 0, sprinting: false });
    touchInputRef.current.moveX = 0;
    touchInputRef.current.moveZ = 0;
    touchInputRef.current.sprint = false;
  };

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between hud-safe-padding select-none overflow-hidden"
    >
      {/* =====================================================================
          PORTRAIT ROTATE-DEVICE OVERLAY (For Mobile Portrait Screens)
         ===================================================================== */}
      {isMobilePortrait && !portraitDismissed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Rotate Device to Landscape"
          className="fixed inset-0 z-50 bg-[#0d0e11]/95 flex flex-col items-center justify-center p-6 text-center pointer-events-auto"
        >
          <div className="max-w-sm w-full bg-[#14161b] border border-[#d97706] p-6 flex flex-col items-center gap-4">
            <svg
              viewBox="0 0 64 64"
              className="w-14 h-14 stroke-[#d97706] fill-none"
              strokeWidth="2.5"
            >
              <rect x="18" y="8" width="28" height="48" rx="4" opacity="0.35" />
              <rect x="8" y="18" width="48" height="28" rx="4" />
              <path d="M48 10 A18 18 0 0 1 56 24" strokeLinecap="round" />
              <polyline points="52 24 56 24 56 20" />
            </svg>
            <div>
              <span className="text-[11px] font-mono tracking-widest text-[#d97706] uppercase">
                16:9 TACTICAL VIEWPORT · COMBAT PAUSED
              </span>
              <h2 className="font-display font-extrabold text-3xl text-[#e6e4e0] uppercase mt-1">
                ROTATE TO LANDSCAPE
              </h2>
              <p className="text-xs text-[#a8a29e] mt-1.5 leading-relaxed">
                FRACTURE arena combat is engineered for widescreen landscape visibility so both Colossi fighters and dual-thumb controls remain unobstructed. Rotate your device to resume automatically.
              </p>
            </div>
            <div className="w-full flex flex-col gap-2 mt-1">
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="w-full py-2.5 px-4 bg-[#d97706] hover:bg-[#f59e0b] text-black font-display font-bold text-base uppercase tracking-wider"
              >
                LOCK LANDSCAPE & FULLSCREEN
              </button>
              <button
                type="button"
                onClick={() => setPortraitDismissed(true)}
                className="w-full py-2 px-4 bg-[#1c1f26] border border-[#3f3f46] text-xs font-mono text-[#a8a29e] hover:text-[#e6e4e0] uppercase"
              >
                Continue in Current Orientation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          3D TARGET LOCK-ON RETICLE (Projected dynamically over targeted opponent)
         ===================================================================== */}
      <div
        ref={hudRefs.lockReticle}
        aria-hidden="true"
        className="fixed top-0 left-0 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 transition-opacity duration-150"
        style={{ opacity: lockedOn ? 0.9 : 0 }}
      >
        <svg viewBox="0 0 48 48" className="w-11 h-11 overflow-visible">
          <polygon
            points="24,4 44,24 24,44 4,24"
            fill="none"
            stroke="#d97706"
            strokeWidth="1.75"
            strokeDasharray="6 4"
          />
          <line x1="24" y1="0" x2="24" y2="9" stroke="#fef3c7" strokeWidth="2" />
          <line x1="24" y1="39" x2="24" y2="48" stroke="#fef3c7" strokeWidth="2" />
          <line x1="0" y1="24" x2="9" y2="24" stroke="#fef3c7" strokeWidth="2" />
          <line x1="39" y1="24" x2="48" y2="24" stroke="#fef3c7" strokeWidth="2" />
          <circle cx="24" cy="24" r="2.5" fill="#d97706" />
        </svg>
      </div>

      {/* =====================================================================
          TOP HUD CLUSTER: P1 Vitals | Center Timer & Lock Status | P2 Vitals
         ===================================================================== */}
      <header className="w-full max-w-[1440px] mx-auto grid grid-cols-12 items-start gap-2 sm:gap-3 z-20">
        {/* PLAYER 1 VITALS (Left 5 cols) */}
        <div className="col-span-5 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {renderCharacterCrest(p1Char, p1Def.palette.primary)}
              <div className="flex flex-col min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display font-extrabold text-lg sm:text-2xl tracking-wider text-[#e6e4e0] leading-none hud-stroke truncate">
                    {p1Def.name}
                  </span>
                  <span className="hidden lg:inline text-[10px] font-mono text-[#a8a29e] uppercase tracking-wider truncate">
                    {p1Name}
                  </span>
                </div>
                <span className="hidden lg:block text-[9px] font-mono text-[#a8a29e] tracking-widest uppercase truncate">
                  {p1Def.codename}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {renderRoundPips(p1RoundsWon, roundsToWin, 'left')}
              <div className="bg-[#12141a]/90 border border-[#3f3f46] px-1.5 py-0.5 flex items-baseline gap-0.5">
                <span
                  ref={hudRefs.p1HpText}
                  className="font-mono font-bold text-xs sm:text-sm tabular-nums text-[#e6e4e0]"
                >
                  {p1Def.stats.maxHp}
                </span>
                <span className="text-[9px] font-mono text-[#a8a29e]">/{p1Def.stats.maxHp}</span>
              </div>
            </div>
          </div>

          {/* P1 Health Bar with Delayed Ghost Drain */}
          <div className="relative h-3.5 sm:h-4.5 w-full bg-[#12141a] border border-[#525866] overflow-hidden shadow-inner">
            <div className="absolute inset-0 z-10 grid grid-cols-4 pointer-events-none">
              <div className="border-r border-black/35" />
              <div className="border-r border-black/35" />
              <div className="border-r border-black/35" />
            </div>
            <div
              ref={hudRefs.p1HpGhost}
              className="absolute inset-y-0 left-0 bg-[#dc2626] transition-none"
              style={{ width: '100%', transformOrigin: 'left' }}
            />
            <div
              ref={hudRefs.p1HpFill}
              className="absolute inset-y-0 left-0 bg-[#d97706] transition-none"
              style={{ width: '100%', transformOrigin: 'left' }}
            />
          </div>

          {/* P1 Stamina Bar + Live Action State Readout */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] sm:text-[10px] font-mono font-bold tracking-wider text-[#38bdf8] uppercase shrink-0">
              STM
            </span>
            <div className="relative h-1.5 sm:h-2 flex-1 bg-[#12141a] border border-[#3f3f46] overflow-hidden">
              <div
                ref={hudRefs.p1StaminaFill}
                className="absolute inset-y-0 left-0 bg-[#38bdf8]"
                style={{ width: '100%', transformOrigin: 'left' }}
              />
            </div>
            <span
              ref={hudRefs.p1StaminaText}
              className="text-[10px] font-mono font-semibold tabular-nums text-[#e6e4e0] w-6 text-right shrink-0 hud-stroke"
            >
              {p1Def.stats.maxStamina}
            </span>
            <span
              ref={hudRefs.p1StateBadge}
              className="hidden sm:inline-block px-1.5 py-0.5 bg-[#14161b]/90 border border-[#3f3f46] text-[9px] font-mono font-semibold text-[#e6e4e0] uppercase tracking-wider min-w-[60px] text-center"
            >
              IDLE
            </span>
          </div>

          {/* P1 Dynamic Combo Counter */}
          <div
            ref={hudRefs.p1ComboBox}
            className="mt-0.5 self-start bg-[#14161b]/95 border-l-4 border-[#d97706] px-2.5 py-0.5 flex items-baseline gap-2 transition-opacity duration-150 opacity-0 pointer-events-none"
          >
            <span
              ref={hudRefs.p1ComboHits}
              className="font-display font-extrabold text-base sm:text-xl text-[#d97706] tracking-wider uppercase"
            >
              2 HIT COMBO
            </span>
            <span
              ref={hudRefs.p1ComboDmg}
              className="text-[11px] font-mono font-bold text-[#e6e4e0] tabular-nums"
            >
              24 DMG
            </span>
          </div>
        </div>

        {/* CENTER ROUND TIMER, SCORE & LOCK-ON STATUS (Center 2 cols) */}
        <div className="col-span-2 flex flex-col items-center justify-start">
          <div className="flex items-center gap-1 text-[9px] sm:text-xs font-mono tracking-widest text-[#a8a29e] uppercase hud-stroke">
            <span>{gameMode === 'training' ? 'PRACTICE' : `RD ${roundNumber}`}</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline text-[#e6e4e0] font-bold">
              {p1RoundsWon}-{p2RoundsWon}
            </span>
          </div>

          <div className="bg-[#12141a]/95 border-2 border-[#525866] px-2.5 sm:px-4 py-0.5 mt-0.5 shadow-md">
            <span
              ref={hudRefs.timerText}
              className="font-display font-extrabold text-xl sm:text-3xl tracking-tight tabular-nums text-[#e6e4e0] leading-none block"
            >
              {gameMode === 'training' ? '∞' : '90'}
            </span>
          </div>

          {/* Interactive Lock-On Status Indicator */}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleLockOn();
            }}
            aria-label={
              lockedOn
                ? 'Target Lock Active (Click to Switch to Free Camera)'
                : 'Free Camera Active (Click to Lock On Target)'
            }
            className={`mt-1 px-2 py-0.5 border text-[9px] font-mono uppercase tracking-wider flex items-center gap-1 pointer-events-auto transition-colors cursor-pointer ${
              lockedOn
                ? 'bg-[#1f242d]/95 border-[#d97706] text-[#fef3c7]'
                : 'bg-[#12141a]/90 border-[#3f3f46] text-[#a8a29e]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                lockedOn ? 'bg-[#d97706]' : 'bg-[#525866]'
              }`}
            />
            <span>{lockedOn ? 'LOCKED' : 'FREE CAM'}</span>
          </button>
        </div>

        {/* PLAYER 2 VITALS + TOP-RIGHT UTILITY BAR (Right 5 cols) */}
        <div className="col-span-5 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 shrink-0">
              <div className="bg-[#12141a]/90 border border-[#3f3f46] px-1.5 py-0.5 flex items-baseline gap-0.5">
                <span
                  ref={hudRefs.p2HpText}
                  className="font-mono font-bold text-xs sm:text-sm tabular-nums text-[#e6e4e0]"
                >
                  {p2Def.stats.maxHp}
                </span>
                <span className="text-[9px] font-mono text-[#a8a29e]">/{p2Def.stats.maxHp}</span>
              </div>
              {renderRoundPips(p2RoundsWon, roundsToWin, 'right')}
            </div>

            <div className="flex items-center gap-1.5 min-w-0">
              <div className="flex flex-col items-end min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="hidden xl:inline text-[10px] font-mono text-[#a8a29e] uppercase tracking-wider truncate">
                    {p2Name}
                  </span>
                  <span className="font-display font-extrabold text-lg sm:text-2xl tracking-wider text-[#e6e4e0] leading-none hud-stroke shrink-0">
                    {p2Def.name}
                  </span>
                </div>
                <span className="hidden lg:block text-[9px] font-mono text-[#a8a29e] tracking-widest uppercase truncate">
                  {p2Def.codename}
                </span>
              </div>
              {renderCharacterCrest(p2Char, '#e11d48')}

              {/* Top-Right Utility Controls (Fullscreen, Mute, Reset, Pause) */}
              <div className="flex items-center gap-1 ml-0.5 pointer-events-auto shrink-0">
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen & Landscape'}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleFullscreen();
                  }}
                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-[#14161b]/95 border border-[#3f3f46] hover:border-[#d97706] text-[#e6e4e0] transition-colors cursor-pointer"
                >
                  {isFullscreen ? (
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current" strokeWidth="2">
                      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current" strokeWidth="2">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
                  title={muted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleMute();
                  }}
                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-[#14161b]/95 border border-[#3f3f46] hover:border-[#d97706] text-[#e6e4e0] transition-colors cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    {muted ? (
                      <line x1="23" y1="9" x2="17" y2="15" />
                    ) : (
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    )}
                  </svg>
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Reset Round Positions"
                  title="Reset Round Positions (R)"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onRestartRound();
                  }}
                  className="hidden md:flex w-7 h-7 sm:w-8 sm:h-8 items-center justify-center bg-[#14161b]/95 border border-[#3f3f46] hover:border-[#d97706] text-[#e6e4e0] transition-colors cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>

                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Pause Game"
                  title="Pause Game (Esc)"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onPause();
                  }}
                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-[#14161b]/95 border border-[#3f3f46] hover:border-[#d97706] text-[#e6e4e0] transition-colors cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current" strokeWidth="2">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* P2 Health Bar (drains right-to-left) */}
          <div className="relative h-3.5 sm:h-4.5 w-full bg-[#12141a] border border-[#525866] overflow-hidden shadow-inner">
            <div className="absolute inset-0 z-10 grid grid-cols-4 pointer-events-none">
              <div className="border-r border-black/35" />
              <div className="border-r border-black/35" />
              <div className="border-r border-black/35" />
            </div>
            <div
              ref={hudRefs.p2HpGhost}
              className="absolute inset-y-0 right-0 bg-[#991b1b] transition-none"
              style={{ width: '100%', transformOrigin: 'right' }}
            />
            <div
              ref={hudRefs.p2HpFill}
              className="absolute inset-y-0 right-0 bg-[#e11d48] transition-none"
              style={{ width: '100%', transformOrigin: 'right' }}
            />
          </div>

          {/* P2 Stamina Bar + State Readout */}
          <div className="flex items-center gap-1.5">
            <span
              ref={hudRefs.p2StateBadge}
              className="hidden sm:inline-block px-1.5 py-0.5 bg-[#14161b]/90 border border-[#3f3f46] text-[9px] font-mono font-semibold text-[#e6e4e0] uppercase tracking-wider min-w-[60px] text-center"
            >
              IDLE
            </span>
            <span
              ref={hudRefs.p2StaminaText}
              className="text-[10px] font-mono font-semibold tabular-nums text-[#e6e4e0] w-6 text-left shrink-0 hud-stroke"
            >
              {p2Def.stats.maxStamina}
            </span>
            <div className="relative h-1.5 sm:h-2 flex-1 bg-[#12141a] border border-[#3f3f46] overflow-hidden">
              <div
                ref={hudRefs.p2StaminaFill}
                className="absolute inset-y-0 right-0 bg-[#38bdf8]"
                style={{ width: '100%', transformOrigin: 'right' }}
              />
            </div>
            <span className="text-[9px] sm:text-[10px] font-mono font-bold tracking-wider text-[#38bdf8] uppercase shrink-0">
              STM
            </span>
          </div>

          {gameMode === 'training' && trainingConfig.showHitboxInfo && (
            <div className="hidden lg:flex items-center justify-end gap-2 text-[10px] font-mono text-[#a8a29e]">
              <span>
                AI DECISION: <strong ref={hudRefs.aiStateBadge} className="text-[#e6e4e0] uppercase">IDLE</strong>
              </span>
            </div>
          )}

          {/* P2 Dynamic Combo Counter */}
          <div
            ref={hudRefs.p2ComboBox}
            className="mt-0.5 self-end bg-[#14161b]/95 border-r-4 border-[#e11d48] px-2.5 py-0.5 flex items-baseline gap-2 transition-opacity duration-150 opacity-0 pointer-events-none"
          >
            <span
              ref={hudRefs.p2ComboDmg}
              className="text-[11px] font-mono font-bold text-[#e6e4e0] tabular-nums"
            >
              24 DMG
            </span>
            <span
              ref={hudRefs.p2ComboHits}
              className="font-display font-extrabold text-base sm:text-xl text-[#e11d48] tracking-wider uppercase"
            >
              2 HIT COMBO
            </span>
          </div>
        </div>
      </header>

      {/* =====================================================================
          CENTER COUNTDOWN / ROUND BANNER / COMBAT CALLOUTS
         ===================================================================== */}
      <div className="flex-1 flex flex-col items-center justify-center pointer-events-none relative z-10 min-h-0">
        {countdownValue !== null && (
          <div className="flex flex-col items-center">
            <span className="text-xs font-mono tracking-[0.25em] text-[#d97706] uppercase mb-1 hud-stroke">
              ARENA ENGAGEMENT SEQUENCE
            </span>
            <span className="font-display font-extrabold text-5xl sm:text-8xl tracking-wider text-[#e6e4e0] hud-stroke">
              {countdownValue > 0 ? countdownValue : 'FIGHT!'}
            </span>
          </div>
        )}

        {roundBanner && countdownValue === null && (
          <div className="bg-[#12141a]/95 border-y-2 border-[#d97706] px-10 py-3 text-center shadow-lg">
            <div className="font-display font-extrabold text-3xl sm:text-6xl tracking-wider text-[#e6e4e0]">
              {roundBanner}
            </div>
          </div>
        )}

        {combatCallout && (
          <div
            key={combatCallout.id}
            className="mt-6 sm:mt-12 flex flex-col items-center text-center"
          >
            <span
              className="font-display font-extrabold text-xl sm:text-3xl tracking-wider uppercase hud-stroke"
              style={{ color: combatCallout.color }}
            >
              {combatCallout.text}
            </span>
            {combatCallout.subtext && (
              <span className="text-xs font-mono text-[#e6e4e0] hud-stroke">
                {combatCallout.subtext}
              </span>
            )}
          </div>
        )}
      </div>

      {/* =====================================================================
          BOTTOM PERIMETER: Desktop Ability & Hints + Training Dock + Mobile Controls
         ===================================================================== */}
      <div className="w-full max-w-[1440px] mx-auto flex flex-col gap-1.5 z-20">
        {/* Desktop Ability Cooldown Socket & Toggleable Control Hint Strip */}
        <div className="hidden lg:flex items-end justify-between gap-4">
          {/* Player 1 Unique Ability & Action Status Bar */}
          <div className="bg-[#12141a]/92 border border-[#3f3f46] px-3.5 py-2 flex items-center gap-3.5 pointer-events-auto">
            <div className="w-10 h-10 bg-[#1f242d] border-2 border-[#d97706] flex flex-col items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-[#d97706] fill-none" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-base tracking-wide text-[#e6e4e0] uppercase leading-none">
                  {p1Def.ability.name}
                </span>
                <span className="px-1.5 py-0.5 bg-[#1c1f26] border border-[#3f3f46] text-[10px] font-mono text-[#d97706]">
                  [{formatKeyLabel(kb.ability)} / U]
                </span>
                <span className="text-[11px] font-mono text-[#a8a29e]">
                  {p1Def.ability.staminaCost} STM
                </span>
              </div>
              <div className="w-44 h-2 bg-[#0d0e11] border border-[#27272a] mt-1.5 overflow-hidden">
                <div
                  ref={hudRefs.p1AbilityFill}
                  className="h-full bg-[#d97706]"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <span
              ref={hudRefs.p1AbilityText}
              className="font-mono text-xs font-bold tabular-nums text-[#d97706] w-14 text-right"
            >
              READY
            </span>
          </div>

          {/* Compact Desktop Control Hint Bar (Toggleable) */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {settings.showControlHints && (
              <div className="bg-[#12141a]/88 border border-[#3f3f46] px-3.5 py-2 text-xs font-mono text-[#e6e4e0] flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  <strong className="text-[#d97706]">WASD</strong> Move
                </span>
                <span>·</span>
                <span>
                  <strong className="text-[#d97706]">LMB / {formatKeyLabel(kb.lightAttack)}</strong> Light (3x Combo)
                </span>
                <span>·</span>
                <span>
                  <strong className="text-[#d97706]">{formatKeyLabel(kb.heavyAttack)}</strong> Heavy
                </span>
                <span>·</span>
                <span>
                  <strong className="text-[#38bdf8]">RMB / {formatKeyLabel(kb.guard)}</strong> Guard / Parry
                </span>
                <span>·</span>
                <span>
                  <strong className="text-[#e6e4e0]">{formatKeyLabel(kb.dodge)}</strong> Dodge
                </span>
                <span>·</span>
                <span>
                  <strong className="text-[#d97706]">{formatKeyLabel(kb.ability)}</strong> Ability
                </span>
                <span>·</span>
                <span>
                  <strong className="text-[#e6e4e0]">{formatKeyLabel(kb.lockOn)}</strong> Target Lock
                </span>
              </div>
            )}
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleControlHints();
              }}
              aria-label={settings.showControlHints ? 'Hide Control Hints' : 'Show Control Hints'}
              title="Toggle Control Hints"
              className="px-2.5 py-2 bg-[#14161b]/92 border border-[#3f3f46] hover:border-[#d97706] text-xs font-mono text-[#a8a29e] hover:text-[#e6e4e0] cursor-pointer"
            >
              {settings.showControlHints ? 'HIDE HINTS' : '? CONTROLS'}
            </button>
          </div>
        </div>

        {/* TRAINING MODE: Unified Collapsible Bottom Control Dock */}
        {gameMode === 'training' && (
          <div className="mx-auto w-full max-w-[920px] pointer-events-auto flex flex-col items-center">
            <button
              type="button"
              onClick={() => setDockCollapsed((prev) => !prev)}
              className="px-3 py-0.5 bg-[#14161b]/95 border border-[#3f3f46] text-[10px] font-mono text-[#a8a29e] hover:text-[#e6e4e0] transition-colors flex items-center gap-1.5"
            >
              <svg viewBox="0 0 16 16" className="w-3 h-3 fill-none stroke-current" strokeWidth="2">
                {dockCollapsed ? <path d="M4 10l4-4 4 4" /> : <path d="M4 6l4 4 4-4" />}
              </svg>
              <span>{dockCollapsed ? 'Show Training Controls' : 'Hide Training Controls'}</span>
            </button>

            {!dockCollapsed && (
              <div className="w-full bg-[#14161b]/95 border border-t-0 border-[#3f3f46] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[#a8a29e]">DUMMY:</span>
                  {(
                    [
                      ['idle', 'Stand Idle'],
                      ['block_all', 'Guard All'],
                      ['counter_hit', 'Counter On Block'],
                      ['active_bot', 'Combat AI'],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onUpdateTrainingConfig({ dummyBehavior: mode })}
                      className={`px-2 py-0.5 font-mono text-[10px] border transition-colors whitespace-nowrap ${
                        trainingConfig.dummyBehavior === mode
                          ? 'bg-[#d97706] text-black border-[#d97706] font-semibold'
                          : 'bg-[#1c1f26] text-[#e6e4e0] border-[#3f3f46] hover:border-[#78716c]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {trainingConfig.dummyBehavior === 'active_bot' && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[#a8a29e]">AI:</span>
                    {(['easy', 'normal', 'hard'] as BotDifficulty[]).map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => onUpdateTrainingConfig({ botDifficulty: diff })}
                        className={`px-2 py-0.5 font-mono text-[10px] uppercase border transition-colors ${
                          trainingConfig.botDifficulty === diff
                            ? 'bg-[#e6e4e0] text-black border-[#e6e4e0] font-semibold'
                            : 'bg-[#1c1f26] text-[#a8a29e] border-[#3f3f46]'
                        }`}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateTrainingConfig({ infiniteStamina: !trainingConfig.infiniteStamina })
                    }
                    className={`px-2 py-0.5 font-mono text-[10px] border transition-colors ${
                      trainingConfig.infiniteStamina
                        ? 'bg-[#0284c7] text-white border-[#38bdf8]'
                        : 'bg-[#1c1f26] text-[#a8a29e] border-[#3f3f46]'
                    }`}
                  >
                    Inf Stamina: {trainingConfig.infiniteStamina ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateTrainingConfig({
                        playerInvulnerable: !trainingConfig.playerInvulnerable,
                      })
                    }
                    className={`px-2 py-0.5 font-mono text-[10px] border transition-colors ${
                      trainingConfig.playerInvulnerable
                        ? 'bg-[#0284c7] text-white border-[#38bdf8]'
                        : 'bg-[#1c1f26] text-[#a8a29e] border-[#3f3f46]'
                    }`}
                  >
                    Invulnerable: {trainingConfig.playerInvulnerable ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateTrainingConfig({ instantCooldowns: !trainingConfig.instantCooldowns })
                    }
                    className={`px-2 py-0.5 font-mono text-[10px] border transition-colors ${
                      trainingConfig.instantCooldowns
                        ? 'bg-[#0284c7] text-white border-[#38bdf8]'
                        : 'bg-[#1c1f26] text-[#a8a29e] border-[#3f3f46]'
                    }`}
                  >
                    Zero CD: {trainingConfig.instantCooldowns ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={onRestartRound}
                    className="px-2 py-0.5 font-mono text-[10px] bg-[#27272a] hover:bg-[#3f3f46] text-[#e6e4e0] border border-[#52525b]"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            ADVANCED MOBILE / TABLET FIGHTING CONTROLS (<= 1024px)
           =================================================================== */}
        <div className="flex lg:hidden items-end justify-between w-full pb-0.5 pointer-events-none">
          {/* LEFT SIDE: Responsive 360° Virtual Analog Joystick */}
          <div className="flex flex-col items-center gap-0.5 pointer-events-auto touch-none">
            <div
              onPointerDown={handleJoystickStart}
              onPointerMove={handleJoystickMove}
              onPointerUp={handleJoystickEnd}
              onPointerCancel={handleJoystickEnd}
              onLostPointerCapture={handleJoystickEnd}
              aria-label="Movement Analog Joystick"
              className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#12141a]/88 border-2 flex items-center justify-center relative touch-none transition-colors ${
                joystickVisual.active
                  ? joystickVisual.sprinting
                    ? 'border-[#38bdf8]'
                    : 'border-[#d97706]'
                  : 'border-[#525866]'
              }`}
            >
              {/* Outer 8-Way Compass Ticks & Deadzone Guide SVG */}
              <svg
                viewBox="0 0 120 120"
                className="absolute inset-0 w-full h-full pointer-events-none"
                aria-hidden="true"
              >
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="#27272a"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                {/* Deadzone boundary ring */}
                <circle
                  cx="60"
                  cy="60"
                  r={Math.round(48 * (settings.touchDeadzone || 0.12))}
                  fill="none"
                  stroke="#3f3f46"
                  strokeWidth="1"
                />
                {/* Center crosshair */}
                <line x1="54" y1="60" x2="66" y2="60" stroke="#525866" strokeWidth="1.5" />
                <line x1="60" y1="54" x2="60" y2="66" stroke="#525866" strokeWidth="1.5" />
                {/* Cardinal ticks */}
                <line x1="60" y1="4" x2="60" y2="11" stroke="#78716c" strokeWidth="2" />
                <line x1="60" y1="109" x2="60" y2="116" stroke="#78716c" strokeWidth="2" />
                <line x1="4" y1="60" x2="11" y2="60" stroke="#78716c" strokeWidth="2" />
                <line x1="109" y1="60" x2="116" y2="60" stroke="#78716c" strokeWidth="2" />
                {/* Active Vector Line */}
                {joystickVisual.active && (
                  <line
                    x1="60"
                    y1="60"
                    x2={60 + joystickVisual.dx}
                    y2={60 + joystickVisual.dy}
                    stroke={joystickVisual.sprinting ? '#38bdf8' : '#d97706'}
                    strokeWidth="2.5"
                  />
                )}
              </svg>

              {/* Movable Analog Thumb Stick */}
              <div
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 flex items-center justify-center shadow-md pointer-events-none ${
                  joystickVisual.active
                    ? joystickVisual.sprinting
                      ? 'bg-[#38bdf8] border-[#e0f2fe] text-black'
                      : 'bg-[#d97706] border-[#fef3c7] text-black'
                    : 'bg-[#1f242d] border-[#a8a29e] text-[#e6e4e0]'
                }`}
                style={{
                  transform: `translate3d(${joystickVisual.dx}px, ${joystickVisual.dy}px, 0)`,
                }}
              >
                <div className="w-2 h-2 rounded-full bg-current opacity-80" />
              </div>
            </div>
            <span className="text-[9px] font-mono tracking-wider text-[#a8a29e] uppercase hud-stroke">
              {joystickVisual.sprinting ? 'SPRINTING' : '360° MOVE'}
            </span>
          </div>

          {/* RIGHT SIDE: Dedicated 6-Button Ergonomic Action Cluster with SVG Combat Icons */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pointer-events-auto touch-none items-end">
            {/* 1. TARGET LOCK-ON BUTTON */}
            <button
              type="button"
              aria-label="Toggle Target Lock"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleLockOn();
              }}
              className={`w-12 h-12 sm:w-14 sm:h-14 border-2 flex flex-col items-center justify-center gap-0.5 transition-transform active:scale-95 ${
                lockedOn
                  ? 'bg-[#1f242d] border-[#d97706] text-[#fef3c7]'
                  : 'bg-[#14161b]/90 border-[#525866] text-[#a8a29e]'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 fill-none stroke-current" strokeWidth="2">
                <circle cx="12" cy="12" r="7" />
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
                {lockedOn && <circle cx="12" cy="12" r="2" fill="currentColor" />}
              </svg>
              <span className="font-display font-bold text-[9px] sm:text-[10px] tracking-wider uppercase leading-none">
                {lockedOn ? 'LOCKED' : 'TARGET'}
              </span>
            </button>

            {/* 2. SPECIAL ABILITY BUTTON (With Live Cooldown Progress Overlay & Timer) */}
            <button
              ref={hudRefs.btnAbilityRef}
              type="button"
              aria-label="Special Ability"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // ignore
                }
                touchInputRef.current.abilityPressed = true;
                setPressedButtons((p) => ({ ...p, ability: true }));
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                setPressedButtons((p) => ({ ...p, ability: false }));
              }}
              onPointerCancel={() => setPressedButtons((p) => ({ ...p, ability: false }))}
              onLostPointerCapture={() => setPressedButtons((p) => ({ ...p, ability: false }))}
              className={`relative w-12 h-12 sm:w-14 sm:h-14 border-2 overflow-hidden flex flex-col items-center justify-center gap-0.5 transition-transform ${
                pressedButtons.ability
                  ? 'bg-[#d97706] border-[#fef3c7] text-black scale-95'
                  : 'bg-[#1f242d]/95 border-[#d97706] text-[#e6e4e0]'
              }`}
            >
              <div
                ref={hudRefs.mobileAbilityOverlay}
                className="absolute inset-x-0 bottom-0 bg-black/75 pointer-events-none transition-none"
                style={{ height: '0%' }}
              />
              <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 fill-none stroke-current relative z-10" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span
                ref={hudRefs.mobileAbilityTimer}
                className="font-display font-bold text-[9px] sm:text-[10px] tracking-wider uppercase leading-none relative z-10"
              >
                SPECIAL
              </span>
            </button>

            {/* 3. HEAVY ATTACK BUTTON */}
            <button
              ref={hudRefs.btnHeavyRef}
              type="button"
              aria-label="Heavy Attack"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // ignore
                }
                touchInputRef.current.heavyPressed = true;
                setPressedButtons((p) => ({ ...p, heavy: true }));
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                setPressedButtons((p) => ({ ...p, heavy: false }));
              }}
              onPointerCancel={() => setPressedButtons((p) => ({ ...p, heavy: false }))}
              onLostPointerCapture={() => setPressedButtons((p) => ({ ...p, heavy: false }))}
              className={`w-12 h-12 sm:w-14 sm:h-14 border-2 flex flex-col items-center justify-center gap-0.5 transition-transform ${
                pressedButtons.heavy
                  ? 'bg-[#e11d48] border-[#ffe4e6] text-white scale-95'
                  : 'bg-[#27171c]/95 border-[#e11d48] text-[#e6e4e0]'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 fill-none stroke-current" strokeWidth="2">
                <path d="M14 4l6 6-4 4-6-6 4-4z" />
                <path d="M4 20l8-8" />
                <path d="M3 15l6 6" />
              </svg>
              <span className="font-display font-bold text-[9px] sm:text-[10px] tracking-wider uppercase leading-none">
                HEAVY
              </span>
            </button>

            {/* 4. DODGE / EVADE BUTTON */}
            <button
              ref={hudRefs.btnDodgeRef}
              type="button"
              aria-label="Dodge Evade"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // ignore
                }
                touchInputRef.current.dodgePressed = true;
                setPressedButtons((p) => ({ ...p, dodge: true }));
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                setPressedButtons((p) => ({ ...p, dodge: false }));
              }}
              onPointerCancel={() => setPressedButtons((p) => ({ ...p, dodge: false }))}
              onLostPointerCapture={() => setPressedButtons((p) => ({ ...p, dodge: false }))}
              className={`w-12 h-12 sm:w-14 sm:h-14 border-2 flex flex-col items-center justify-center gap-0.5 transition-transform ${
                pressedButtons.dodge
                  ? 'bg-[#e6e4e0] border-white text-black scale-95'
                  : 'bg-[#181b22]/95 border-[#a8a29e] text-[#e6e4e0]'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 fill-none stroke-current" strokeWidth="2.2">
                <polyline points="11 17 6 12 11 7" />
                <polyline points="18 17 13 12 18 7" />
              </svg>
              <span className="font-display font-bold text-[9px] sm:text-[10px] tracking-wider uppercase leading-none">
                DODGE
              </span>
            </button>

            {/* 5. BLOCK / PARRY BUTTON (Hold to Block, Tap to Parry) */}
            <button
              type="button"
              aria-label="Block and Parry"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                guardPointerIdRef.current = e.pointerId;
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // ignore
                }
                touchInputRef.current.guardHeld = true;
                touchInputRef.current.guardJustPressed = true;
                setPressedButtons((p) => ({ ...p, guard: true }));
              }}
              onPointerUp={(e) => {
                if (guardPointerIdRef.current !== null && guardPointerIdRef.current !== e.pointerId) return;
                e.preventDefault();
                guardPointerIdRef.current = null;
                touchInputRef.current.guardHeld = false;
                setPressedButtons((p) => ({ ...p, guard: false }));
              }}
              onPointerCancel={() => {
                guardPointerIdRef.current = null;
                touchInputRef.current.guardHeld = false;
                setPressedButtons((p) => ({ ...p, guard: false }));
              }}
              onLostPointerCapture={() => {
                guardPointerIdRef.current = null;
                touchInputRef.current.guardHeld = false;
                setPressedButtons((p) => ({ ...p, guard: false }));
              }}
              className={`w-12 h-12 sm:w-14 sm:h-14 border-2 flex flex-col items-center justify-center gap-0.5 transition-transform ${
                pressedButtons.guard
                  ? 'bg-[#38bdf8] border-[#e0f2fe] text-black scale-95'
                  : 'bg-[#16202e]/95 border-[#38bdf8] text-[#e6e4e0]'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 fill-none stroke-current" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span className="font-display font-bold text-[9px] sm:text-[10px] tracking-wider uppercase leading-none">
                {pressedButtons.guard ? 'GUARD' : 'BLOCK'}
              </span>
            </button>

            {/* 6. LIGHT ATTACK PRIMARY BUTTON */}
            <button
              ref={hudRefs.btnLightRef}
              type="button"
              aria-label="Light Attack"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // ignore
                }
                touchInputRef.current.lightPressed = true;
                setPressedButtons((p) => ({ ...p, light: true }));
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                setPressedButtons((p) => ({ ...p, light: false }));
              }}
              onPointerCancel={() => setPressedButtons((p) => ({ ...p, light: false }))}
              onLostPointerCapture={() => setPressedButtons((p) => ({ ...p, light: false }))}
              className={`w-14 h-14 sm:w-16 sm:h-16 border-2 flex flex-col items-center justify-center gap-0.5 shadow-lg transition-transform ${
                pressedButtons.light
                  ? 'bg-[#fef3c7] border-white text-black scale-95'
                  : 'bg-[#d97706] border-[#fef3c7] text-black'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6 fill-none stroke-current" strokeWidth="2.4">
                <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
                <line x1="13" y1="19" x2="19" y2="13" />
                <line x1="16" y1="16" x2="20" y2="20" />
                <line x1="19" y1="21" x2="21" y2="19" />
              </svg>
              <span className="font-display font-extrabold text-[10px] sm:text-xs tracking-wider uppercase leading-none">
                LIGHT
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
