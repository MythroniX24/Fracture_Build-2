import type { WeaponId } from '../config.ts';
import type {
  ADSControllerState,
  ADSStage,
  AimInputMode,
  OpticId,
} from './ads.types.ts';
import { getOpticConfig, getWeaponADSProfile } from './optic.config.ts';

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Creates a clean initial ADSControllerState.
 */
export function createInitialADSControllerState(
  weaponId: WeaponId = 'm4a1',
  opticId: OpticId = 'scope_2x'
): ADSControllerState {
  return {
    isAimingRequested: false,
    toggleLatched: false,
    prevRawAimButtonDown: false,
    adsProgress: 0,
    stage: 'hip',
    weaponRaiseBlend: 0,
    shoulderAlignBlend: 0,
    opticAlignBlend: 0,
    sightAcquireBlend: 0,
    overlayOpacity: 0,
    hipCrosshairOpacity: 1,
    settleTimerSec: 0,
    settleOffsetPitch: 0,
    settleOffsetY: 0,
    activeWeaponId: weaponId,
    activeOpticId: opticId,
  };
}

export interface ADSCancelTriggers {
  isReloading?: boolean;
  isSprinting?: boolean;
  isSliding?: boolean;
  isDeadOrRespawning?: boolean;
  weaponSwitched?: boolean;
  opticSwitched?: boolean;
  forceInstantReset?: boolean;
}

/**
 * Cancels active ADS request (and optionally snaps progress to 0 on instant events like death/weapon switch).
 */
export function cancelADSController(
  state: ADSControllerState,
  instant = false
): void {
  state.isAimingRequested = false;
  state.toggleLatched = false;
  if (instant) {
    state.adsProgress = 0;
    state.stage = 'hip';
    state.weaponRaiseBlend = 0;
    state.shoulderAlignBlend = 0;
    state.opticAlignBlend = 0;
    state.sightAcquireBlend = 0;
    state.overlayOpacity = 0;
    state.hipCrosshairOpacity = 1;
    state.settleTimerSec = 0;
    state.settleOffsetPitch = 0;
    state.settleOffsetY = 0;
  } else if (state.adsProgress > 0.001) {
    state.stage = 'releasing';
  }
}

export interface StepADSControllerParams {
  dt: number;
  rawAimInputDown: boolean;
  aimMode: AimInputMode;
  weaponId: WeaponId;
  opticId: OpticId;
  isReloading: boolean;
  isSprinting: boolean;
  isSliding: boolean;
  isDeadOrRespawning: boolean;
  equipTimerSec: number;
}

/**
 * Steps the Universal ADS & Scope Entering state machine forward by `dt` seconds.
 * Frame-rate independent and deterministic.
 */
export function stepADSController(
  state: ADSControllerState,
  params: StepADSControllerParams
): ADSControllerState {
  const dt = Math.max(0, Math.min(0.1, params.dt));

  // Detect weapon switch or optic hot-swap while aiming
  const weaponSwitched = state.activeWeaponId !== params.weaponId;
  const opticSwitched = state.activeOpticId !== params.opticId;
  state.activeWeaponId = params.weaponId;
  state.activeOpticId = params.opticId;

  // Hard cancellation conditions: death/respawn or weapon switch
  if (params.isDeadOrRespawning || weaponSwitched) {
    cancelADSController(state, true);
    state.prevRawAimButtonDown = params.rawAimInputDown;
    return state;
  }

  // Soft cancellation conditions: reloading, sprinting, sliding, equipping, or swapping optic
  const blockedFromAiming =
    params.isReloading ||
    params.isSprinting ||
    params.isSliding ||
    params.equipTimerSec > 0.01;

  if (opticSwitched && state.adsProgress > 0.25) {
    // Re-run optic alignment / sight acquisition smoothly when swapping optic
    state.adsProgress = Math.min(state.adsProgress, 0.45);
    state.settleTimerSec = 0;
  }

  // Resolve Hold-to-Aim vs Toggle-to-Aim input
  const risingEdge = params.rawAimInputDown && !state.prevRawAimButtonDown;
  state.prevRawAimButtonDown = params.rawAimInputDown;

  if (blockedFromAiming) {
    state.toggleLatched = false;
    state.isAimingRequested = false;
  } else if (params.aimMode === 'toggle') {
    if (risingEdge) {
      state.toggleLatched = !state.toggleLatched;
    }
    state.isAimingRequested = state.toggleLatched;
  } else {
    // 'hold' mode
    state.toggleLatched = params.rawAimInputDown;
    state.isAimingRequested = params.rawAimInputDown;
  }

  const profile = getWeaponADSProfile(params.weaponId);
  const optic = getOpticConfig(params.opticId);

  const effectiveEnterDuration = Math.max(
    0.08,
    profile.enterDurationSec / Math.max(0.4, optic.enterSpeedMultiplier)
  );
  const effectiveExitDuration = Math.max(
    0.06,
    profile.exitDurationSec / Math.max(0.4, optic.exitSpeedMultiplier)
  );

  const prevProgress = state.adsProgress;

  if (state.isAimingRequested) {
    const enterRate = 1 / effectiveEnterDuration;
    state.adsProgress = clamp01(state.adsProgress + dt * enterRate);
  } else {
    const exitRate = 1 / effectiveExitDuration;
    state.adsProgress = clamp01(state.adsProgress - dt * exitRate);
  }

  const p = state.adsProgress;

  // Compute sub-blends for the 8 stages of the ADS & Scope Entering lifecycle
  // Stage 1 & 2: Weapon Raise upward & inward (0.00 -> 0.55)
  state.weaponRaiseBlend = smoothstep(0.0, 0.58, p);

  // Stage 3: Shoulder & Eye Alignment (0.20 -> 0.82)
  state.shoulderAlignBlend = smoothstep(0.18, 0.82, p);

  // Stage 4: Optic Body & Lens Alignment (0.42 -> 0.94)
  state.opticAlignBlend = smoothstep(0.42, 0.94, p);

  // Stage 5: Sight Acquisition (Reticle & Scope Lens Overlay fade in)
  if (optic.overlay.showLensOverlay) {
    if (state.isAimingRequested) {
      state.sightAcquireBlend = smoothstep(
        optic.overlay.acquireStartProgress,
        optic.overlay.acquireFullProgress,
        p
      );
      state.overlayOpacity = state.sightAcquireBlend;
    } else {
      // Stage 8: Aim release fades scope overlay out rapidly to avoid disorientation
      const releaseFade = smoothstep(0.45, 0.92, p);
      state.sightAcquireBlend = releaseFade;
      state.overlayOpacity = releaseFade;
    }
  } else {
    // Universal ADS with Iron Sights ('none') or open reflex: no magnified scope overlay
    state.sightAcquireBlend = smoothstep(0.6, 0.9, p);
    state.overlayOpacity = 0;
  }

  // Hip-fire crosshair fades out smoothly as weapon raises into ADS
  state.hipCrosshairOpacity = clamp01(1 - smoothstep(0.08, 0.55, p));

  // Stage 6: Underdamped Settle Spring as weapon reaches full alignment
  if (state.isAimingRequested && p >= 0.78) {
    if (prevProgress < 0.78) {
      state.settleTimerSec = 0.0001;
    } else {
      state.settleTimerSec += dt;
    }
    const t = state.settleTimerSec;
    const omega = profile.settleSpring.frequencyHz * Math.PI * 2;
    const zeta = profile.settleSpring.dampingRatio;
    const decay = Math.exp(-zeta * omega * t);
    const wave = Math.cos(omega * Math.sqrt(Math.max(0.05, 1 - zeta * zeta)) * t);
    state.settleOffsetPitch = profile.settleSpring.impulsePitchRad * decay * wave;
    state.settleOffsetY = profile.settleSpring.impulseY * decay * wave;
  } else {
    state.settleTimerSec = 0;
    const settleDecay = Math.exp(-22 * dt);
    state.settleOffsetPitch *= settleDecay;
    state.settleOffsetY *= settleDecay;
  }

  // Classify current 8-stage lifecycle state
  state.stage = classifyADSStage(
    p,
    state.isAimingRequested,
    optic.id !== 'none',
    state.settleTimerSec
  );

  return state;
}

export function classifyADSStage(
  adsProgress: number,
  isAimingRequested: boolean,
  hasOpticAttached: boolean,
  settleTimerSec: number
): ADSStage {
  if (adsProgress <= 0.001) {
    return 'hip';
  }
  if (!isAimingRequested) {
    return 'releasing';
  }
  if (adsProgress < 0.16) {
    return 'initiating';
  }
  if (adsProgress < 0.42) {
    return 'raising';
  }
  if (adsProgress < 0.64) {
    return 'aligning';
  }
  if (hasOpticAttached && adsProgress < 0.76) {
    return 'optic_align';
  }
  if (adsProgress < 0.9) {
    return 'acquiring';
  }
  if (adsProgress < 0.995 || (settleTimerSec > 0 && settleTimerSec < 0.18)) {
    return 'settling';
  }
  return 'aiming';
}
