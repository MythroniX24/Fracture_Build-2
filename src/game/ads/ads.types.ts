import type { WeaponId } from '../config.ts';

export type OpticId =
  | 'none'
  | 'red_dot'
  | 'holo'
  | 'scope_2x'
  | 'scope_4x'
  | 'scope_6x'
  | 'scope_8x';

export type CoreSelectableOpticId = 'none' | 'scope_2x' | 'scope_4x';

export type AimInputMode = 'hold' | 'toggle';

/**
 * 8-Stage ADS & Scope Entering Lifecycle:
 * 0. 'hip'          - Unaimed hip-fire state
 * 1. 'initiating'   - Stage 1: Aim initiation (weapon begins moving from hip-fire)
 * 2. 'raising'      - Stage 2: Weapon raise (moves upward & inward toward screen center)
 * 3. 'aligning'     - Stage 3: Shoulder/eye alignment (rotates & aligns with viewing direction)
 * 4. 'optic_align'  - Stage 4: Optic alignment (scope body & 3D lens align with eye line)
 * 5. 'acquiring'    - Stage 5: Sight acquisition (reticle & scope overlay fade in)
 * 6. 'settling'     - Stage 6: ADS settling (subtle damped spring settle into final pose)
 * 7. 'aiming'       - Stage 7: Settled ADS state (aiming & firing with ADS recoil recovery)
 * 8. 'releasing'    - Stage 8: Aim release (overlay fades out promptly, weapon returns to hip)
 */
export type ADSStage =
  | 'hip'
  | 'initiating'
  | 'raising'
  | 'aligning'
  | 'optic_align'
  | 'acquiring'
  | 'settling'
  | 'aiming'
  | 'releasing';

export type ReticlePatternType =
  | 'none'
  | 'red_dot'
  | 'holo_ring'
  | 'tactical_2x'
  | 'marksman_4x'
  | 'sniper_mil';

export interface OpticReticleConfig {
  pattern: ReticlePatternType;
  primaryColor: string;
  secondaryColor: string;
  glowColor: string;
  centerDotRadiusPx: number;
  ringRadiusPx: number;
  lineThicknessPx: number;
  stadiaTickCount: number;
  showRangefinder: boolean;
}

export interface OpticOverlayConfig {
  /** True only for magnified tube/combat optics (false for iron sights) */
  showLensOverlay: boolean;
  /** Circular lens diameter relative to viewport min dimension (0.55 - 0.85) */
  lensScaleRatio: number;
  /** Outer dark vignette / eye-relief opacity (0 - 0.96) */
  outerMaskOpacity: number;
  /** Inner lens rim shadow intensity (0 - 1) */
  eyeReliefShadow: number;
  /** Subtle optical glass tint */
  glassTintCss: string;
  /** Transition progress (0-1) at which the scope lens & reticle begin fading in */
  acquireStartProgress: number;
  /** Transition progress (0-1) at which the scope lens & reticle reach 100% opacity */
  acquireFullProgress: number;
  /** Whether to hide the 3D weapon body when fully inside the high-power scope eye-box */
  occludeWeaponMeshAtFullAds: boolean;
}

export interface ADSPoseOffset {
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw: number;
  roll: number;
}

export interface OpticConfig {
  id: OpticId;
  name: string;
  shortLabel: string;
  magnification: number;
  /** Target vertical FOV in degrees when base FOV is 90 deg */
  targetFovAt90: number;
  /** Look sensitivity multiplier when fully in ADS with this optic */
  sensitivityMultiplier: number;
  /** Height (meters in weapon rig space) from the top rail to the optical sight line */
  opticSightHeight: number;
  /** Additional local weapon pose offset when aiming through this optic */
  adsPoseOffset: ADSPoseOffset;
  /** Multiplier on weapon ADS enter speed (<1 = heavier optic, slower entry) */
  enterSpeedMultiplier: number;
  /** Multiplier on weapon ADS exit speed */
  exitSpeedMultiplier: number;
  /** Compatible weapons */
  compatibleWeapons: WeaponId[];
  reticle: OpticReticleConfig;
  overlay: OpticOverlayConfig;
}

export interface WeaponADSProfile {
  weaponId: WeaponId;
  /** Base ADS enter duration in seconds (before optic speed multiplier) */
  enterDurationSec: number;
  /** Base ADS exit duration in seconds */
  exitDurationSec: number;
  /** Local 3D coordinates on the weapon rig where the optic rail mount sits */
  railMountPosition: [number, number, number];
  /** Local 3D coordinates of the weapon's native iron sights line of sight */
  ironSightAnchor: [number, number, number];
  /** 1P camera eye offset when fully aligned in ADS [right, up, forward] */
  adsEyeOffset: [number, number, number];
  /** Hip-fire 1P camera eye offset [right, up, forward] */
  hipEyeOffset: [number, number, number];
  /** Raise arc peak upward/inward displacement during Stage 2 & 3 */
  raiseArcOffset: {
    x: number;
    y: number;
    z: number;
    cantRollRad: number;
    dipPitchRad: number;
  };
  /** Settle spring stiffness & damping for Stage 6 */
  settleSpring: {
    frequencyHz: number;
    dampingRatio: number;
    impulsePitchRad: number;
    impulseY: number;
  };
  /** ADS recoil stabilization multiplier (reduces visual shake while keeping center alignment) */
  adsRecoilMultiplier: number;
}

export type WeaponOpticLoadout = Record<WeaponId, OpticId>;

export interface ADSControllerState {
  isAimingRequested: boolean;
  toggleLatched: boolean;
  prevRawAimButtonDown: boolean;
  /** Normalized 0..1 progress between hip-fire (0) and ADS (1) */
  adsProgress: number;
  /** Current 8-stage lifecycle state */
  stage: ADSStage;
  /** Stage-specific sub-blends (0..1) */
  weaponRaiseBlend: number;
  shoulderAlignBlend: number;
  opticAlignBlend: number;
  sightAcquireBlend: number;
  /** Scope lens & reticle overlay opacity (0..1) */
  overlayOpacity: number;
  /** Hip-fire crosshair opacity (0..1) */
  hipCrosshairOpacity: number;
  /** Underdamped settle spring state for Stage 6 */
  settleTimerSec: number;
  settleOffsetPitch: number;
  settleOffsetY: number;
  /** Active weapon & optic tracked for transition interruption */
  activeWeaponId: WeaponId;
  activeOpticId: OpticId;
}

export interface ComputedWeaponADSPose {
  /** Interpolated camera eye offset [right, up, forward] */
  eyeOffset: [number, number, number];
  /** Local weapon position offset applied during transition/ADS */
  weaponOffset: [number, number, number];
  /** Local weapon Euler rotation offset [pitch, yaw, roll] */
  weaponRotation: [number, number, number];
  /** Stabilized recoil pitch/yaw/kickback scale for ADS */
  recoilScale: number;
  /** Whether the 3D weapon mesh should be hidden inside the scope eye-box */
  hideViewModelMesh: boolean;
  /** 0..1 blend of how strongly the weapon is locked to the center sight line */
  sightLineLockBlend: number;
}
