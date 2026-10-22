import React, { useRef, useState } from 'react';
import {
  CharacterId,
  DEFAULT_HUD_BUTTONS_LAYOUT,
  GameMode,
  GameSettings,
  HudButtonId,
  LOADOUT_PAIRS,
  LoadoutPairId,
  TrainingConfig,
  WEAPON_REGISTRY,
  WeaponId,
} from '../game/config.ts';
import { soundEngine } from '../audio/soundEngine.ts';
import { HudActionIcon, WeaponIllustration } from './WeaponArtwork.tsx';

export interface HudDomRefs {
  p1HpFill: React.MutableRefObject<HTMLDivElement | null>;
  p1HpGhost: React.MutableRefObject<HTMLDivElement | null>;
  p1HpText: React.MutableRefObject<HTMLSpanElement | null>;
  p1StaminaFill: React.MutableRefObject<HTMLDivElement | null>;
  p1StaminaText: React.MutableRefObject<HTMLSpanElement | null>;
  p1AbilityFill: React.MutableRefObject<HTMLDivElement | null>;
  p1AbilityText: React.MutableRefObject<HTMLSpanElement | null>;
  p1StateBadge: React.MutableRefObject<HTMLSpanElement | null>;
  p1ComboBox: React.MutableRefObject<HTMLDivElement | null>;
  p1ComboHits: React.MutableRefObject<HTMLSpanElement | null>;
  p1ComboDmg: React.MutableRefObject<HTMLSpanElement | null>;
  p2HpFill: React.MutableRefObject<HTMLDivElement | null>;
  p2HpGhost: React.MutableRefObject<HTMLDivElement | null>;
  p2HpText: React.MutableRefObject<HTMLSpanElement | null>;
  p2StaminaFill: React.MutableRefObject<HTMLDivElement | null>;
  p2StaminaText: React.MutableRefObject<HTMLSpanElement | null>;
  p2StateBadge: React.MutableRefObject<HTMLSpanElement | null>;
  p2ComboBox: React.MutableRefObject<HTMLDivElement | null>;
  p2ComboHits: React.MutableRefObject<HTMLSpanElement | null>;
  p2ComboDmg: React.MutableRefObject<HTMLSpanElement | null>;
  timerText: React.MutableRefObject<HTMLSpanElement | null>;
  aiStateBadge: React.MutableRefObject<HTMLSpanElement | null>;
  lockReticle: React.MutableRefObject<HTMLDivElement | null>;
  crosshairRef: React.MutableRefObject<HTMLDivElement | null>;
  hitMarkerRef: React.MutableRefObject<HTMLDivElement | null>;
  mobileAbilityOverlay: React.MutableRefObject<HTMLDivElement | null>;
  mobileAbilityTimer: React.MutableRefObject<HTMLSpanElement | null>;
  btnLightRef: React.MutableRefObject<HTMLButtonElement | null>;
  btnHeavyRef: React.MutableRefObject<HTMLButtonElement | null>;
  btnDodgeRef: React.MutableRefObject<HTMLButtonElement | null>;
  btnAbilityRef: React.MutableRefObject<HTMLButtonElement | null>;
  screenImpactOverlay: React.MutableRefObject<HTMLDivElement | null>;
  dashWindOverlay: React.MutableRefObject<HTMLDivElement | null>;
  hudShakeContainer: React.MutableRefObject<HTMLDivElement | null>;
}

export interface TouchInputState {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  jumpPressed: boolean;
  shoulderTogglePressed: boolean;
  aimHeld: boolean;
  lightPressed: boolean;
  lightHeld: boolean;
  attackDragX: number;
  attackDragY: number;
  heavyPressed: boolean;
  guardHeld: boolean;
  guardJustPressed: boolean;
  dodgePressed: boolean;
  slidePressed?: boolean;
  abilityPressed: boolean;
  cameraDeltaX?: number;
  cameraDeltaY?: number;
  selectedWeapon?: WeaponId;
}

export interface CombatHUDProps {
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
  countdownValue: number | null;
  roundBanner: string | null;
  combatCallout: {
    id: number;
    text: string;
    subtext?: string;
    color: string;
  } | null;
  muted: boolean;
  isFullscreen: boolean;
  lockedOn: boolean;
  firstPersonMode?: boolean;
  settings?: GameSettings;
  trainingConfig: TrainingConfig;
  touchInputRef: React.MutableRefObject<TouchInputState>;
  activeWeapon?: WeaponId;
  loadoutWeapons?: [WeaponId, WeaponId];
  selectedLoadoutPairId?: LoadoutPairId;
  loadoutOverlayMode?: 'initial' | 'respawn' | null;
  onSelectLoadoutPair?: (
    pairId: LoadoutPairId,
    weapons: [WeaponId, WeaponId],
    autoSpawn?: boolean
  ) => void;
  onConfirmRespawn?: () => void;
  onSelectWeapon?: (w: WeaponId) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onToggleLockOn: () => void;
  onToggleFirstPerson?: () => void;
  onToggleControlHints: () => void;
  onPause: () => void;
  onOpenLayoutEditor?: () => void;
  onRestartRound: () => void;
  onUpdateTrainingConfig: (upd: Partial<TrainingConfig>) => void;
}

export const CombatHUD: React.FC<CombatHUDProps> = ({
  hudRefs,
  gameMode,
  combatCallout,
  muted,
  isFullscreen,
  settings,
  trainingConfig,
  touchInputRef,
  activeWeapon: propActiveWeapon,
  loadoutWeapons = LOADOUT_PAIRS[0].weapons,
  selectedLoadoutPairId = 'pair_1',
  loadoutOverlayMode = null,
  onSelectLoadoutPair,
  onConfirmRespawn,
  onSelectWeapon,
  onToggleMute,
  onToggleFullscreen,
  onPause,
  onRestartRound,
  onUpdateTrainingConfig,
}) => {
  const [selectedWeaponUi, setSelectedWeaponUi] = useState<WeaponId>(
    propActiveWeapon || loadoutWeapons[0]
  );
  const [adsToggled, setAdsToggled] = useState<boolean>(false);

  // Guard timestamp to prevent pointerDown + click from double-firing on a single tap
  const lastWeaponTapTimeRef = useRef<number>(0);
  const lastLoadoutTapTimeRef = useRef<number>(0);

  // Left Movement Joystick Refs
  const stickZoneRef = useRef<HTMLDivElement | null>(null);
  const stickKnobRef = useRef<HTMLDivElement | null>(null);
  const stickPointerId = useRef<number | null>(null);
  const [isStickActiveUi, setIsStickActiveUi] = useState(false);

  // Full-Screen Multi-Pointer & Multi-Touch Free-Look Maps (Never gets stuck on left/right sides or multi-touch)
  const lookPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lookTouchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const stickTouchId = useRef<number | null>(null);

  // Free Fire Style Joystick-Like Fire Button Refs
  const fireKnobRef = useRef<HTMLDivElement | null>(null);
  const firePointerId = useRef<number | null>(null);
  const fireTouchId = useRef<number | null>(null);
  const fireStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const fireLastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFireActiveUi, setIsFireActiveUi] = useState(false);

  // Helper to deflect the Fire Button inner knob like a joystick while keeping the base in place
  const updateFireJoystickKnob = (clientX: number, clientY: number) => {
    const btn = hudRefs.btnLightRef.current;
    let cx = fireStartPos.current.x;
    let cy = fireStartPos.current.y;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      cx = rect.left + rect.width * 0.5;
      cy = rect.top + rect.height * 0.5;
    }
    const maxRadius = 28;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clamped;
    const ky = Math.sin(angle) * clamped;
    if (fireKnobRef.current) {
      fireKnobRef.current.style.transform = `translate3d(${kx.toFixed(1)}px, ${ky.toFixed(1)}px, 0)`;
    }
  };

  const resetFireJoystickKnob = () => {
    if (fireKnobRef.current) {
      fireKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    }
  };

  React.useEffect(() => {
    const onWindowPointerMove = (e: PointerEvent) => {
      if (stickPointerId.current !== null && e.pointerId === stickPointerId.current) {
        updateStickFromPointer(e.clientX, e.clientY);
        return;
      }

      if (firePointerId.current !== null && e.pointerId === firePointerId.current) {
        let dx = e.clientX - fireLastPos.current.x;
        let dy = e.clientY - fireLastPos.current.y;
        if (dx === 0 && typeof e.movementX === 'number' && Math.abs(e.movementX) > 0) {
          dx = e.movementX;
        }
        if (dy === 0 && typeof e.movementY === 'number' && Math.abs(e.movementY) > 0) {
          dy = e.movementY;
        }
        fireLastPos.current = { x: e.clientX, y: e.clientY };
        updateFireJoystickKnob(e.clientX, e.clientY);
        touchInputRef.current.attackDragX =
          (touchInputRef.current.attackDragX || 0) + dx * 0.75;
        touchInputRef.current.attackDragY =
          (touchInputRef.current.attackDragY || 0) + dy * 0.75;
        touchInputRef.current.lightHeld = true;
      } else if (lookPointersRef.current.has(e.pointerId)) {
        const prev = lookPointersRef.current.get(e.pointerId)!;
        let dx = e.clientX - prev.x;
        let dy = e.clientY - prev.y;
        // If pointer is clamped against the left or right screen edge, use raw movementX/Y so camera never gets stuck
        if (dx === 0 && typeof e.movementX === 'number' && Math.abs(e.movementX) > 0) {
          dx = e.movementX;
        }
        if (dy === 0 && typeof e.movementY === 'number' && Math.abs(e.movementY) > 0) {
          dy = e.movementY;
        }
        lookPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        touchInputRef.current.cameraDeltaX =
          (touchInputRef.current.cameraDeltaX || 0) + dx * 1.35;
        touchInputRef.current.cameraDeltaY =
          (touchInputRef.current.cameraDeltaY || 0) + dy * 1.35;
      }
    };

    const onWindowPointerUp = (e: PointerEvent) => {
      if (stickPointerId.current !== null && e.pointerId === stickPointerId.current) {
        stickPointerId.current = null;
        setIsStickActiveUi(false);
        touchInputRef.current.moveX = 0;
        touchInputRef.current.moveZ = 0;
        touchInputRef.current.sprint = false;
        if (stickKnobRef.current) {
          stickKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
        }
      }
      if (firePointerId.current !== null && e.pointerId === firePointerId.current) {
        firePointerId.current = null;
        touchInputRef.current.lightHeld = false;
        setIsFireActiveUi(false);
        resetFireJoystickKnob();
      }
      lookPointersRef.current.delete(e.pointerId);
    };

    const onWindowBlur = () => {
      lookPointersRef.current.clear();
      lookTouchesRef.current.clear();
      if (stickPointerId.current !== null) {
        stickPointerId.current = null;
        setIsStickActiveUi(false);
        touchInputRef.current.moveX = 0;
        touchInputRef.current.moveZ = 0;
        touchInputRef.current.sprint = false;
        if (stickKnobRef.current) {
          stickKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
        }
      }
      if (firePointerId.current !== null) {
        firePointerId.current = null;
        touchInputRef.current.lightHeld = false;
        setIsFireActiveUi(false);
        resetFireJoystickKnob();
      }
    };

    window.addEventListener('pointermove', onWindowPointerMove, { passive: true });
    window.addEventListener('pointerup', onWindowPointerUp, { passive: true });
    window.addEventListener('pointercancel', onWindowPointerUp, { passive: true });
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [touchInputRef]);

  const getBtnTransform = (id: HudButtonId): React.CSSProperties => {
    const layoutMap = settings?.buttonsLayout || DEFAULT_HUD_BUTTONS_LAYOUT;
    const item = layoutMap[id] || DEFAULT_HUD_BUTTONS_LAYOUT[id];
    const gScale = settings?.hudGlobalScale ?? 1.0;
    const gOpacity = settings?.hudGlobalOpacity ?? 0.95;
    return {
      transform: `translate3d(${item.offsetX}px, ${item.offsetY}px, 0) scale(${(
        item.scale * gScale
      ).toFixed(3)})`,
      opacity: Number((item.opacity * gOpacity).toFixed(3)),
    };
  };

  // Left Thumbstick Movement Handlers
  const updateStickFromPointer = (clientX: number, clientY: number) => {
    const zone = stickZoneRef.current;
    if (!zone) return;
    const rect = zone.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const maxRadius = Math.max(28, rect.width * 0.38);
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;

    if (stickKnobRef.current) {
      stickKnobRef.current.style.transform = `translate3d(${kx.toFixed(1)}px, ${ky.toFixed(1)}px, 0)`;
    }

    const normX = dx / maxRadius;
    const normY = dy / maxRadius;
    const mag = Math.hypot(normX, normY);
    const deadzone = settings?.touchDeadzone ?? 0.12;
    if (mag < deadzone) {
      touchInputRef.current.moveX = 0;
      touchInputRef.current.moveZ = 0;
      touchInputRef.current.sprint = false;
    } else {
      touchInputRef.current.moveX = Math.max(-1, Math.min(1, normX));
      touchInputRef.current.moveZ = Math.max(-1, Math.min(1, normY));
      touchInputRef.current.sprint = normY < -0.75;
    }
  };

  const handleStickStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    stickPointerId.current = e.pointerId;
    setIsStickActiveUi(true);
    updateStickFromPointer(e.clientX, e.clientY);
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== e.pointerId) return;
    updateStickFromPointer(e.clientX, e.clientY);
  };

  const handleStickEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== e.pointerId) return;
    stickPointerId.current = null;
    setIsStickActiveUi(false);
    touchInputRef.current.moveX = 0;
    touchInputRef.current.moveZ = 0;
    touchInputRef.current.sprint = false;
    if (stickKnobRef.current) {
      stickKnobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    }
  };

  // Full-Screen Free-Look Touch & Drag Zone (Works anywhere on left/right screen & inside Scope)
  const handleLookStart = (e: React.PointerEvent<HTMLDivElement>) => {
    lookPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const handleLookEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    lookPointersRef.current.delete(e.pointerId);
  };

  const handleLookTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === fireTouchId.current || t.identifier === stickTouchId.current) {
        continue;
      }
      lookTouchesRef.current.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
  };

  const handleLookTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    // Only use touch fallback when PointerEvents are not actively tracking this gesture
    if (lookPointersRef.current.size > 0) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        lookTouchesRef.current.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      return;
    }
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const prev = lookTouchesRef.current.get(t.identifier);
      if (!prev) continue;
      const dx = t.clientX - prev.x;
      const dy = t.clientY - prev.y;
      lookTouchesRef.current.set(t.identifier, { x: t.clientX, y: t.clientY });
      touchInputRef.current.cameraDeltaX =
        (touchInputRef.current.cameraDeltaX || 0) + dx * 1.35;
      touchInputRef.current.cameraDeltaY =
        (touchInputRef.current.cameraDeltaY || 0) + dy * 1.35;
    }
  };

  const handleLookTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      lookTouchesRef.current.delete(e.changedTouches[i].identifier);
    }
  };

  // Free Fire Style Joystick-Like Fire Button Handlers
  const handleFireDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    firePointerId.current = e.pointerId;
    fireStartPos.current = { x: e.clientX, y: e.clientY };
    fireLastPos.current = { x: e.clientX, y: e.clientY };
    touchInputRef.current.lightPressed = true;
    touchInputRef.current.lightHeld = true;
    setIsFireActiveUi(true);
    updateFireJoystickKnob(e.clientX, e.clientY);
  };

  const handleFireMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (firePointerId.current !== e.pointerId) return;
    const dx = e.clientX - fireLastPos.current.x;
    const dy = e.clientY - fireLastPos.current.y;
    fireLastPos.current = { x: e.clientX, y: e.clientY };
    updateFireJoystickKnob(e.clientX, e.clientY);
    if (dx !== 0 || dy !== 0) {
      touchInputRef.current.attackDragX =
        (touchInputRef.current.attackDragX || 0) + dx * 1.45;
      touchInputRef.current.attackDragY =
        (touchInputRef.current.attackDragY || 0) + dy * 1.45;
    }
  };

  const handleFireUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (firePointerId.current !== e.pointerId) return;
    firePointerId.current = null;
    touchInputRef.current.lightHeld = false;
    setIsFireActiveUi(false);
    resetFireJoystickKnob();
  };

  const handleFireTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (firePointerId.current !== null) return;
    const t = e.changedTouches[0];
    if (!t) return;
    fireTouchId.current = t.identifier;
    fireStartPos.current = { x: t.clientX, y: t.clientY };
    fireLastPos.current = { x: t.clientX, y: t.clientY };
    touchInputRef.current.lightPressed = true;
    touchInputRef.current.lightHeld = true;
    setIsFireActiveUi(true);
    updateFireJoystickKnob(t.clientX, t.clientY);
  };

  const handleFireTouchMove = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (firePointerId.current !== null || fireTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === fireTouchId.current) {
        const dx = t.clientX - fireLastPos.current.x;
        const dy = t.clientY - fireLastPos.current.y;
        fireLastPos.current = { x: t.clientX, y: t.clientY };
        updateFireJoystickKnob(t.clientX, t.clientY);
        touchInputRef.current.attackDragX =
          (touchInputRef.current.attackDragX || 0) + dx * 0.75;
        touchInputRef.current.attackDragY =
          (touchInputRef.current.attackDragY || 0) + dy * 0.75;
        break;
      }
    }
  };

  const handleFireTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (fireTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === fireTouchId.current) {
        fireTouchId.current = null;
        touchInputRef.current.lightHeld = false;
        setIsFireActiveUi(false);
        resetFireJoystickKnob();
        break;
      }
    }
  };

  /**
   * Instant Single-Click/Tap handler for the 2 Gun Boxes above the Health Bar:
   * - If it's ALREADY the active gun in hand -> triggers Reload!
   * - If it's the other gun -> smoothly switches to that gun!
   */
  const handleWeaponBoxTrigger = (wid: WeaponId) => {
    const now = performance.now();
    if (now - lastWeaponTapTimeRef.current < 80) return;
    lastWeaponTapTimeRef.current = now;

    const current = propActiveWeapon || selectedWeaponUi;
    if (current === wid) {
      soundEngine.play('reload_start');
      if (onSelectWeapon) {
        onSelectWeapon(wid);
      } else {
        touchInputRef.current.heavyPressed = true;
      }
      return;
    }
    soundEngine.play('ui_click');
    setSelectedWeaponUi(wid);
    if (onSelectWeapon) {
      onSelectWeapon(wid);
    } else {
      touchInputRef.current.selectedWeapon = wid;
    }
  };

  const handleLoadoutCardSelect = (
    pairId: LoadoutPairId,
    weapons: [WeaponId, WeaponId]
  ) => {
    const now = performance.now();
    if (now - lastLoadoutTapTimeRef.current < 80) return;
    lastLoadoutTapTimeRef.current = now;

    soundEngine.unlock();
    soundEngine.play('ui_confirm');
    setSelectedWeaponUi(weapons[0]);
    const shouldAutoSpawn = loadoutOverlayMode === 'initial';
    onSelectLoadoutPair?.(pairId, weapons, shouldAutoSpawn);
  };

  const currentWeapon = propActiveWeapon || selectedWeaponUi;
  const isSniperWeapon = currentWeapon === 'awp';
  const isKillCallout =
    combatCallout &&
    (combatCallout.text.includes('ELIMINATED') ||
      combatCallout.text.includes('HEADSHOT'));

  return (
    <div
      ref={hudRefs.hudShakeContainer}
      className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden"
    >
      {/* Full-Screen Touch / Mouse Drag Free-Look Surface (Allows moving camera freely anywhere & while scoped) */}
      <div
        onPointerDown={handleLookStart}
        onPointerUp={handleLookEnd}
        onPointerCancel={handleLookEnd}
        onTouchStart={handleLookTouchStart}
        onTouchMove={handleLookTouchMove}
        onTouchEnd={handleLookTouchEnd}
        onTouchCancel={handleLookTouchEnd}
        className="fixed inset-0 pointer-events-auto touch-none"
      />

      {/* Directional Crimson Blood Hurt Vignette Overlay */}
      <div
        ref={hudRefs.screenImpactOverlay}
        className="fixed inset-0 pointer-events-none transition-opacity duration-100 opacity-0"
        style={{
          background:
            'radial-gradient(circle at center, transparent 48%, rgba(185, 28, 28, 0.42) 78%, rgba(127, 29, 29, 0.78) 100%)',
        }}
      />

      {/* Tactical Slide Speed Lines Overlay */}
      <div
        ref={hudRefs.dashWindOverlay}
        className="fixed inset-0 pointer-events-none transition-opacity duration-150 opacity-0"
        style={{
          background:
            'radial-gradient(circle at center, transparent 58%, rgba(56, 189, 248, 0.22) 100%)',
        }}
      />

      {/* =================================================================== */}
      {/* REALISTIC CIRCULAR OPTICAL SCOPE WITH VISIBLE PERIPHERAL SCREEN     */}
      {/* =================================================================== */}
      <div
        ref={hudRefs.lockReticle}
        className="fixed inset-0 pointer-events-none flex items-center justify-center transition-opacity duration-100 opacity-0"
      >
        {isSniperWeapon ? (
          /* Realistic Circular 8x Sniper Scope with Peripheral World View Visible Around Sides */
          <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
            {/* Soft Peripheral Vignette (Does NOT black out side screen — world stays visible on sides!) */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at center, transparent 175px, rgba(8, 12, 18, 0.34) 225px, rgba(5, 8, 14, 0.56) 100%)',
              }}
            />

            {/* Machined Circular Sniper Scope Housing Tube */}
            <div className="relative w-[330px] h-[330px] sm:w-[400px] sm:h-[400px] rounded-full border-[14px] sm:border-[16px] border-[#0d1016] ring-2 ring-zinc-400/50 shadow-[0_0_55px_rgba(0,0,0,0.85),inset_0_0_32px_rgba(0,0,0,0.8)] flex items-center justify-center bg-emerald-950/[0.04]">
              {/* Top Elevation & Right Windage Mechanical Turret Knobs on Scope Ring */}
              <div className="absolute -top-6 w-12 h-4 rounded-t-md bg-zinc-800 border border-zinc-500/50 shadow-md" />
              <div className="absolute -right-6 w-4 h-12 rounded-r-md bg-zinc-800 border border-zinc-500/50 shadow-md" />
              <div className="absolute -left-5 w-3.5 h-9 rounded-l-md bg-zinc-800 border border-zinc-500/40" />

              {/* Inner Anti-Reflective Emerald Lens Coating Ring */}
              <div className="absolute inset-1.5 rounded-full border border-emerald-400/35 pointer-events-none" />
              <div className="absolute inset-4 rounded-full border border-white/10 pointer-events-none" />

              {/* Precision Dual-Plane Mil-Dot Reticle Inside Circular Lens */}
              <svg
                className="w-full h-full text-zinc-100/90 pointer-events-none"
                viewBox="0 0 200 200"
                fill="none"
              >
                <line x1="4" y1="100" x2="88" y2="100" stroke="currentColor" strokeWidth="0.9" />
                <line x1="112" y1="100" x2="196" y2="100" stroke="currentColor" strokeWidth="0.9" />
                <line x1="100" y1="4" x2="100" y2="88" stroke="currentColor" strokeWidth="0.9" />
                <line x1="100" y1="112" x2="100" y2="196" stroke="currentColor" strokeWidth="0.9" />
                {/* Thick Outer German #4 Duplex Posts */}
                <line x1="4" y1="100" x2="36" y2="100" stroke="currentColor" strokeWidth="2.4" />
                <line x1="164" y1="100" x2="196" y2="100" stroke="currentColor" strokeWidth="2.4" />
                <line x1="100" y1="164" x2="100" y2="196" stroke="currentColor" strokeWidth="2.4" />
                {/* Mil-Dot Windage & Elevation Ticks */}
                {[-36, -24, -12, 12, 24, 36].map((offset) => (
                  <g key={offset}>
                    <line
                      x1={100 + offset}
                      y1="97.5"
                      x2={100 + offset}
                      y2="102.5"
                      stroke="currentColor"
                      strokeWidth="0.85"
                    />
                    <line
                      x1="97.5"
                      y1={100 + offset}
                      x2="102.5"
                      y2={100 + offset}
                      stroke="currentColor"
                      strokeWidth="0.85"
                    />
                  </g>
                ))}
                {/* Illuminated Center Chevron & Red Precision Dot */}
                <path
                  d="M96 103 L100 98.5 L104 103"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="100" cy="100" r="1.5" fill="#ef4444" />
                {/* Rangefinder Stadia Ladder */}
                <line x1="94" y1="122" x2="106" y2="122" stroke="#10b981" strokeWidth="0.75" strokeOpacity="0.8" />
                <line x1="96" y1="132" x2="104" y2="132" stroke="#10b981" strokeWidth="0.75" strokeOpacity="0.8" />
                <line x1="97.5" y1="142" x2="102.5" y2="142" stroke="#10b981" strokeWidth="0.75" strokeOpacity="0.8" />
              </svg>
              <div className="absolute bottom-6 px-2.5 py-0.5 rounded-full bg-black/75 border border-emerald-400/35 font-mono text-[10px] text-emerald-300 tracking-widest">
                8.0X OPTIC
              </div>
            </div>
          </div>
        ) : (
          /* Realistic Circular 2.0X Tactical Red-Dot / Holographic Tube Scope with Clear Side View */
          <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
            {/* Subtle Peripheral Dimming (Side screen remains clearly visible!) */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at center, transparent 150px, rgba(8, 12, 18, 0.22) 210px, rgba(6, 9, 14, 0.42) 100%)',
              }}
            />

            {/* Cylindrical Machined Red-Dot Scope Housing */}
            <div className="relative w-[280px] h-[280px] sm:w-[330px] sm:h-[330px] rounded-full border-[11px] sm:border-[13px] border-[#11151c] ring-2 ring-zinc-400/55 bg-sky-500/[0.03] shadow-[0_0_45px_rgba(0,0,0,0.8),inset_0_0_24px_rgba(56,189,248,0.14)] flex items-center justify-center">
              {/* Inner Anti-Reflective Lens Bezel */}
              <div className="absolute inset-1.5 rounded-full border border-sky-400/35 pointer-events-none" />
              {/* Top Fiber-Optic Cap & Side Windage Turret Knob */}
              <div className="absolute -top-4 w-20 h-3 rounded-t-md bg-zinc-800 border border-white/25 flex items-center justify-center">
                <div className="w-12 h-0.5 bg-emerald-400/85 rounded-full" />
              </div>
              <div className="absolute -right-4 w-3.5 h-10 rounded-r-md bg-zinc-800 border border-white/25" />

              {/* Precision Illuminated Circular Reflex Reticle */}
              <svg
                className="w-52 h-52 text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.85)] pointer-events-none"
                viewBox="0 0 200 200"
                fill="none"
              >
                <circle
                  cx="100"
                  cy="100"
                  r="32"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeDasharray="25 10"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="13"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeOpacity="0.68"
                />
                <line x1="100" y1="44" x2="100" y2="62" stroke="currentColor" strokeWidth="1.8" />
                <line x1="100" y1="138" x2="100" y2="156" stroke="currentColor" strokeWidth="1.8" />
                <line x1="44" y1="100" x2="62" y2="100" stroke="currentColor" strokeWidth="1.8" />
                <line x1="138" y1="100" x2="156" y2="100" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="100" cy="100" r="2.2" fill="#fda4af" />
                <circle cx="100" cy="108" r="1.2" fill="#fb7185" fillOpacity="0.8" />
              </svg>

              <div className="absolute bottom-5 px-2.5 py-0.5 rounded-full bg-black/75 border border-sky-400/35 font-mono text-[10px] text-sky-300 tracking-widest">
                2.0X OPTIC
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 1. CENTER FPS CROSSHAIR & HIT MARKER                                */}
      {/* =================================================================== */}
      <div
        ref={hudRefs.crosshairRef}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center transition-opacity duration-75"
      >
        <div className="relative w-7 h-7 flex items-center justify-center">
          <span className="absolute top-0 w-[1.5px] h-2 bg-zinc-100/90 shadow-sm" />
          <span className="absolute bottom-0 w-[1.5px] h-2 bg-zinc-100/90 shadow-sm" />
          <span className="absolute left-0 h-[1.5px] w-2 bg-zinc-100/90 shadow-sm" />
          <span className="absolute right-0 h-[1.5px] w-2 bg-zinc-100/90 shadow-sm" />
          <span className="w-1 h-1 rounded-full bg-zinc-100" />
        </div>

        {/* Hit Marker X */}
        <div
          ref={hudRefs.hitMarkerRef}
          className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-75"
        >
          <svg className="w-6 h-6 text-rose-500 drop-shadow-[0_0_6px_rgba(244,63,94,0.9)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M4 4l5 5M20 4l-5 5M4 20l5-5M20 20l-5-5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. TOP DEATHMATCH BAR: KILL COUNTER, 5:00 TIMER & KILL BANNER       */}
      {/* =================================================================== */}
      <header className="fixed inset-x-0 top-0 p-3 sm:p-4 flex items-start justify-between gap-3 pointer-events-none">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111318]/85 border border-white/10 font-mono text-xs text-zinc-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-bold tracking-wider uppercase">
            {gameMode === 'training' ? 'FIRING RANGE' : 'DEATHMATCH'}
          </span>
          <span className="text-white/25">·</span>
          <span
            ref={hudRefs.aiStateBadge}
            data-surface="concrete"
            className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase"
          >
            CONCRETE
          </span>
        </div>

        {/* Top-Center: 5-Minute Deathmatch Kill Counter & Match Clock */}
        <div
          style={getBtnTransform('killCounter')}
          className="flex flex-col items-center gap-2 mx-auto"
        >
          <div className="flex items-center gap-3 sm:gap-4 px-4 py-1.5 rounded-xl bg-[#111318]/92 border border-white/15 shadow-xl font-mono tabular-nums">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-400">
                YOUR KILLS
              </span>
              <strong
                ref={hudRefs.p2HpText}
                className="text-lg sm:text-xl font-black text-zinc-100 leading-none"
              >
                0
              </strong>
            </div>

            <span className="h-5 w-[1px] bg-white/15" />

            <div className="px-2.5 py-0.5 rounded bg-zinc-900 border border-white/10 text-sm sm:text-base font-bold text-amber-300">
              <span ref={hudRefs.timerText}>05:00</span>
            </div>

            <span className="h-5 w-[1px] bg-white/15" />

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-rose-400">
                TOP RIVAL
              </span>
              <strong
                ref={hudRefs.p2StaminaText}
                className="text-base sm:text-lg font-bold text-zinc-200 leading-none"
              >
                0
              </strong>
            </div>
          </div>

          {/* Animated Kill Confirmation / Combat Callout Badge */}
          {combatCallout && (
            <div
              key={combatCallout.id}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-mono text-xs font-black uppercase tracking-wider shadow-2xl transition-transform ${
                isKillCallout
                  ? 'bg-rose-950/90 border-rose-400/70 text-rose-100 scale-105 shadow-[0_0_24px_rgba(225,29,72,0.55)]'
                  : 'bg-[#111318]/95 border-white/20 text-zinc-100'
              }`}
            >
              {isKillCallout && (
                <svg
                  className="w-4 h-4 text-rose-400 shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2a8 8 0 0 0-8 8c0 3.05 1.71 5.7 4.22 7.04L8 21h8l-.22-3.96A7.99 7.99 0 0 0 20 10a8 8 0 0 0-8-8zm-3 8.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
                </svg>
              )}
              <span>{combatCallout.text}</span>
              {isKillCallout && (
                <span className="text-amber-300 font-bold">+100</span>
              )}
            </div>
          )}
        </div>

        {/* Top-Right: Utility Icon Buttons */}
        <div className="pointer-events-auto flex items-center gap-2" data-ui-interactive="true">
          {gameMode === 'training' && (
            <div className="hidden md:flex items-center gap-1.5 bg-[#111318]/90 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] font-mono text-zinc-300">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onUpdateTrainingConfig({ infiniteAmmo: !trainingConfig.infiniteAmmo });
                }}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  trainingConfig.infiniteAmmo
                    ? 'bg-zinc-200 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                Inf Ammo
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onRestartRound();
                }}
                className="px-2 py-0.5 rounded text-zinc-300 hover:text-white cursor-pointer"
              >
                Reset
              </button>
            </div>
          )}

          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
            onPointerDown={(e) => {
              e.stopPropagation();
              soundEngine.play('ui_click');
              onToggleMute();
            }}
            className="w-9 h-9 rounded-lg bg-[#111318]/90 hover:bg-zinc-800 border border-white/15 flex items-center justify-center text-zinc-200 cursor-pointer"
          >
            {muted ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            data-fullscreen-toggle="true"
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            onPointerDown={(e) => {
              e.stopPropagation();
              soundEngine.play('ui_click');
              onToggleFullscreen();
            }}
            className="w-9 h-9 rounded-lg bg-[#111318]/90 hover:bg-zinc-800 border border-white/15 flex items-center justify-center text-zinc-200 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Pause Game"
            onPointerDown={(e) => {
              e.stopPropagation();
              soundEngine.play('ui_click');
              onPause();
            }}
            className="w-9 h-9 rounded-lg bg-[#111318]/90 hover:bg-zinc-800 border border-white/15 flex items-center justify-center text-zinc-200 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="3.5" height="14" rx="1" />
              <rect x="14.5" y="5" width="3.5" height="14" rx="1" />
            </svg>
          </button>
        </div>
      </header>

      {/* =================================================================== */}
      {/* 3. BOTTOM CONTROLS: JOYSTICK, 2-GUN BOXES + THIN GREEN HP LINE      */}
      {/* =================================================================== */}
      <div className="fixed inset-x-0 bottom-0 p-3 sm:p-5 flex items-end justify-between pointer-events-none">
        {/* LEFT THUMB: Polished Tactical Movement Thumbstick */}
        <div
          ref={stickZoneRef}
          data-ui-interactive="true"
          onPointerDown={handleStickStart}
          onPointerMove={handleStickMove}
          onPointerUp={handleStickEnd}
          onPointerCancel={handleStickEnd}
          style={getBtnTransform('joystick')}
          className={`pointer-events-auto relative w-30 h-30 sm:w-34 sm:h-34 rounded-full flex items-center justify-center touch-none transition-colors ${
            isStickActiveUi
              ? 'bg-[#11141c]/90 border-2 border-zinc-200/60 shadow-[0_0_24px_rgba(255,255,255,0.12)]'
              : 'bg-[#11141c]/75 border-2 border-white/25 shadow-xl'
          }`}
        >
          <div className="absolute inset-2 rounded-full border border-white/10 pointer-events-none" />
          <span className="absolute top-1.5 text-[9px] text-zinc-300/60 pointer-events-none">▲</span>
          <span className="absolute bottom-1.5 text-[9px] text-zinc-300/60 pointer-events-none">▼</span>
          <span className="absolute left-1.5 text-[9px] text-zinc-300/60 pointer-events-none">◀</span>
          <span className="absolute right-1.5 text-[9px] text-zinc-300/60 pointer-events-none">▶</span>
          <div className="absolute w-14 h-14 rounded-full border border-dashed border-white/15 pointer-events-none" />

          <div
            ref={stickKnobRef}
            className="w-13 h-13 rounded-full bg-gradient-to-b from-zinc-200/90 to-zinc-400/85 border-2 border-white shadow-lg pointer-events-none flex items-center justify-center"
          >
            <div className="w-7 h-7 rounded-full border border-zinc-700/40 bg-zinc-900/25 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-950" />
            </div>
          </div>
        </div>

        {/* CENTER-BOTTOM: 2 Small Gun Boxes ABOVE Sleek Thin Green Health Line + Side Percentage */}
        <div className="flex flex-col items-center gap-2 mx-auto" data-ui-interactive="true">
          {/* 2 Small Gun Boxes Directly Above Health Bar (1-Tap Switch or Reload) */}
          <div
            style={getBtnTransform('weaponBar')}
            className="pointer-events-auto flex items-center gap-2"
          >
            {loadoutWeapons.map((wid, idx) => {
              const spec = WEAPON_REGISTRY[wid];
              const isSelected = currentWeapon === wid;
              return (
                <button
                  key={wid}
                  type="button"
                  tabIndex={-1}
                  aria-label={`Weapon Slot ${idx + 1}`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    handleWeaponBoxTrigger(wid);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.currentTarget.blur();
                    handleWeaponBoxTrigger(wid);
                  }}
                  className={`relative w-26 sm:w-30 px-2.5 py-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer touch-manipulation ${
                    isSelected
                      ? 'bg-zinc-100/20 border-white ring-1 ring-white/75 shadow-lg scale-[1.03]'
                      : 'bg-[#111318]/88 border-white/15 hover:border-white/35 opacity-80 hover:opacity-100'
                  }`}
                >
                  {/* Actual Gun Image ONLY (No Gun Name) */}
                  <WeaponIllustration weaponId={wid} className="w-22 sm:w-25 h-8 sm:h-9 pointer-events-none" />

                  {/* Ammo Counter Below the Gun Image */}
                  <span
                    ref={idx === 0 ? hudRefs.p1StaminaText : hudRefs.p1AbilityText}
                    className={`pointer-events-none font-mono text-[11px] sm:text-xs font-bold tabular-nums leading-none ${
                      isSelected ? 'text-amber-300' : 'text-zinc-300'
                    }`}
                  >
                    {spec.magSize} / {spec.reserveMax}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sleek Thin Green Health Line (NO Bulky Outer Box!) + Percentage Directly Beside It */}
          <div
            style={getBtnTransform('healthBar')}
            className="pointer-events-none flex items-center gap-2.5 px-1 py-0.5"
          >
            <div className="relative h-2 w-44 sm:w-56 bg-black/65 rounded-full overflow-hidden border border-white/15 shadow-[0_2px_10px_rgba(0,0,0,0.85)]">
              <div
                ref={hudRefs.p1HpGhost}
                className="absolute inset-y-0 left-0 bg-emerald-900/70 transition-all duration-300"
                style={{ width: '100%' }}
              />
              <div
                ref={hudRefs.p1HpFill}
                className="relative h-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.9)] transition-all duration-75"
                style={{ width: '100%' }}
              />
            </div>
            <span
              ref={hudRefs.p1HpText}
              className="font-mono font-black text-xs sm:text-sm text-emerald-400 drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)] tabular-nums leading-none min-w-[38px]"
            >
              100%
            </span>
          </div>
        </div>

        {/* RIGHT THUMB: Icon-Only FPS Action Cluster (pointer-events-none on wrapper so empty spaces around buttons allow free camera look!) */}
        <div
          data-ui-interactive="true"
          className="pointer-events-none relative w-60 h-52 sm:w-68 sm:h-56 overflow-visible touch-none"
        >
          {/* 1. SLIDE BUTTON */}
          <button
            ref={hudRefs.btnAbilityRef}
            type="button"
            aria-label="Slide"
            onPointerDown={(e) => {
              e.stopPropagation();
              soundEngine.play('ui_click');
              touchInputRef.current.slidePressed = true;
              lookPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            }}
            style={getBtnTransform('slide')}
            className="pointer-events-auto absolute bottom-2 right-48 w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-[#111318]/88 hover:bg-zinc-800 border-2 border-white/30 flex items-center justify-center text-zinc-100 active:scale-92 shadow-lg cursor-pointer touch-none"
          >
            <HudActionIcon kind="slide" className="w-6 h-6" />
          </button>

          {/* 2. CROUCH BUTTON */}
          <button
            ref={hudRefs.btnDodgeRef}
            type="button"
            aria-label="Crouch"
            onPointerDown={(e) => {
              e.stopPropagation();
              touchInputRef.current.dodgePressed = true;
              lookPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            }}
            style={getBtnTransform('crouch')}
            className="pointer-events-auto absolute bottom-16 right-42 w-12 h-12 rounded-full bg-[#111318]/88 hover:bg-zinc-800 border-2 border-white/30 flex items-center justify-center text-zinc-100 active:scale-92 shadow-lg cursor-pointer touch-none"
          >
            <HudActionIcon kind="crouch" className="w-6 h-6" />
          </button>

          {/* 3. JUMP BUTTON */}
          <button
            type="button"
            aria-label="Jump"
            onPointerDown={(e) => {
              e.stopPropagation();
              touchInputRef.current.jumpPressed = true;
              lookPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            }}
            style={getBtnTransform('jump')}
            className="pointer-events-auto absolute bottom-2 right-28 w-13 h-13 rounded-full bg-[#111318]/88 hover:bg-zinc-800 border-2 border-white/30 flex items-center justify-center text-zinc-100 active:scale-92 shadow-lg cursor-pointer touch-none"
          >
            <HudActionIcon kind="jump" className="w-6 h-6" />
          </button>

          {/* 4. RELOAD BUTTON */}
          <button
            ref={hudRefs.btnHeavyRef}
            type="button"
            aria-label="Reload Weapon"
            onPointerDown={(e) => {
              e.stopPropagation();
              touchInputRef.current.heavyPressed = true;
              lookPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            }}
            style={getBtnTransform('reload')}
            className="pointer-events-auto absolute bottom-[82px] right-[108px] w-13 h-13 rounded-full bg-[#111318]/88 hover:bg-zinc-800 border-2 border-white/30 flex items-center justify-center text-zinc-100 active:scale-92 shadow-lg cursor-pointer touch-none"
          >
            <HudActionIcon kind="reload" className="w-6 h-6" />
          </button>

          {/* 5. SCOPE / ADS BUTTON */}
          <button
            type="button"
            aria-label="Aim Down Sights"
            onPointerDown={(e) => {
              e.stopPropagation();
              const next = !adsToggled;
              setAdsToggled(next);
              touchInputRef.current.aimHeld = next;
              lookPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            }}
            style={getBtnTransform('ads')}
            className={`pointer-events-auto absolute bottom-[112px] right-3 w-14 h-14 rounded-full border-2 flex items-center justify-center active:scale-92 shadow-lg cursor-pointer touch-none ${
              adsToggled
                ? 'bg-zinc-100 text-zinc-950 border-white shadow-[0_0_20px_rgba(255,255,255,0.35)]'
                : 'bg-[#111318]/88 text-zinc-100 border-white/30 hover:bg-zinc-800'
            }`}
          >
            <HudActionIcon kind="ads" className="w-7 h-7" />
          </button>

          {/* 6. FREE FIRE STYLE JOYSTICK-LIKE FIRE BUTTON */}
          <button
            ref={hudRefs.btnLightRef}
            type="button"
            aria-label="Fire Weapon"
            onPointerDown={handleFireDown}
            onPointerUp={handleFireUp}
            onPointerCancel={handleFireUp}
            onTouchStart={handleFireTouchStart}
            onTouchMove={handleFireTouchMove}
            onTouchEnd={handleFireTouchEnd}
            onTouchCancel={handleFireTouchEnd}
            style={getBtnTransform('fire')}
            className={`pointer-events-auto absolute bottom-3.5 right-3.5 w-22 h-22 rounded-full border-2 flex items-center justify-center cursor-pointer touch-none transition-colors ${
              isFireActiveUi
                ? 'bg-amber-500/25 border-amber-400 shadow-[0_0_28px_rgba(245,158,11,0.45)]'
                : 'bg-[#111318]/85 border-white/45 shadow-xl'
            }`}
          >
            <div className="pointer-events-none absolute inset-1.5 rounded-full border border-dashed border-white/25" />
            <span className="pointer-events-none absolute top-1 text-[8px] text-zinc-200/70 leading-none">
              ▲
            </span>
            <span className="pointer-events-none absolute bottom-1 text-[8px] text-zinc-200/70 leading-none">
              ▼
            </span>
            <span className="pointer-events-none absolute left-1 text-[8px] text-zinc-200/70 leading-none">
              ◀
            </span>
            <span className="pointer-events-none absolute right-1 text-[8px] text-zinc-200/70 leading-none">
              ▶
            </span>

            <div
              ref={fireKnobRef}
              className={`pointer-events-none w-14 h-14 rounded-full border-2 flex items-center justify-center shadow-lg transition-colors ${
                isFireActiveUi
                  ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-zinc-950 border-white'
                  : 'bg-gradient-to-b from-zinc-100 to-zinc-300 text-zinc-950 border-white'
              }`}
            >
              <HudActionIcon kind="fire" className="w-7 h-7" />
            </div>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 4. PRE-SPAWN & RESPAWN 3-LOADOUT SELECTION MODAL                    */}
      {/* - Initial Spawn: Clicking any of the 3 options immediately spawns!  */}
      {/* - Respawn on Death: Shows 3 options + "RESPAWN" button below them!  */}
      {/* =================================================================== */}
      {loadoutOverlayMode && (
        <div
          role="dialog"
          aria-label={
            loadoutOverlayMode === 'initial' ? 'Select Loadout to Spawn' : 'Respawn Loadout Select'
          }
          data-ui-interactive="true"
          className="fixed inset-0 z-40 bg-[#090c12]/80 backdrop-blur-xs flex items-center justify-center p-4 pointer-events-auto select-none"
        >
          <div className="w-full max-w-lg bg-[#12151d] border border-white/15 rounded-2xl p-5 sm:p-6 flex flex-col items-center gap-4 shadow-2xl">
            <div className="text-center">
              <span
                className={`font-mono text-xs font-bold uppercase tracking-widest ${
                  loadoutOverlayMode === 'respawn' ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {loadoutOverlayMode === 'respawn'
                  ? 'YOU WERE ELIMINATED · CHOOSE LOADOUT'
                  : 'DEATHMATCH READY · TAP A LOADOUT TO SPAWN'}
              </span>
              <h2 className="mt-1 font-display font-black text-2xl sm:text-3xl text-zinc-100">
                {loadoutOverlayMode === 'respawn' ? 'Select Weapons & Respawn' : 'Select Your Loadout'}
              </h2>
            </div>

            {/* 3 Loadout Options — Each Option Shows 2 Actual Gun Images Only (No Gun Names) */}
            <div className="w-full grid grid-cols-3 gap-3">
              {LOADOUT_PAIRS.map((pair, idx) => {
                const isSelected = selectedLoadoutPairId === pair.id;
                return (
                  <button
                    key={pair.id}
                    type="button"
                    aria-label={`Loadout Option ${idx + 1}`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handleLoadoutCardSelect(pair.id, pair.weapons);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadoutCardSelect(pair.id, pair.weapons);
                    }}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-2.5 transition-all cursor-pointer touch-manipulation ${
                      isSelected
                        ? 'bg-zinc-100/20 border-amber-400 ring-2 ring-amber-400/70 shadow-xl scale-[1.03]'
                        : 'bg-[#181c26] border-white/15 hover:border-white/40 opacity-85 hover:opacity-100'
                    }`}
                  >
                    <WeaponIllustration
                      weaponId={pair.weapons[0]}
                      className="w-full h-11 sm:h-13 pointer-events-none"
                    />
                    <div className="w-4/5 h-[1px] bg-white/15 pointer-events-none" />
                    <WeaponIllustration
                      weaponId={pair.weapons[1]}
                      className="w-full h-11 sm:h-13 pointer-events-none"
                    />
                  </button>
                );
              })}
            </div>

            {/* On Death: Prominent RESPAWN Button Below the 3 Loadout Options */}
            {loadoutOverlayMode === 'respawn' && (
              <button
                type="button"
                aria-label="Respawn"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  soundEngine.play('ui_confirm');
                  onConfirmRespawn?.();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  soundEngine.play('ui_confirm');
                  onConfirmRespawn?.();
                }}
                className="w-full py-3.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-display font-black text-base uppercase tracking-wider shadow-[0_0_24px_rgba(16,185,129,0.45)] transition-transform active:scale-98 cursor-pointer touch-manipulation"
              >
                Respawn
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
