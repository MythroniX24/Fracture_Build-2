import type {
  ADSControllerState,
  ComputedWeaponADSPose,
} from './ads.types.ts';
import { getOpticConfig, getWeaponADSProfile } from './optic.config.ts';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Computes the complete 6-DOF weapon & camera eye alignment pose for the current ADS state.
 * Works universally for Iron Sights ('none') and any attached Optic ('scope_2x', 'scope_4x', etc.).
 */
export function computeWeaponADSPose(
  adsState: ADSControllerState
): ComputedWeaponADSPose {
  const profile = getWeaponADSProfile(adsState.activeWeaponId);
  const optic = getOpticConfig(adsState.activeOpticId);

  const p = adsState.adsProgress;
  const smoothP = easeInOutCubic(p);

  // Bell-curve arc peaking during Stage 2 & 3 (Weapon Raise -> Shoulder Alignment)
  // Creates a natural physical bring-up arc rather than a robotic linear slide
  const raiseBell = Math.sin(p * Math.PI) * (1 - p * 0.35);

  // 1. Camera Eye Offset Interpolation (Hip -> Iron Sights / Optic Eye-Box)
  // When an optic is mounted above the receiver rail, the eye line rises by `opticSightHeight`
  const targetEyeRight = profile.adsEyeOffset[0] + optic.adsPoseOffset.x;
  const targetEyeUp =
    profile.adsEyeOffset[1] + optic.opticSightHeight * 0.55 - optic.adsPoseOffset.y * 0.45;
  const targetEyeForward = profile.adsEyeOffset[2] + optic.adsPoseOffset.z;

  const eyeRight =
    lerp(profile.hipEyeOffset[0], targetEyeRight, adsState.shoulderAlignBlend) +
    profile.raiseArcOffset.x * raiseBell;
  const eyeUp =
    lerp(profile.hipEyeOffset[1], targetEyeUp, adsState.opticAlignBlend) +
    profile.raiseArcOffset.y * raiseBell +
    adsState.settleOffsetY;
  const eyeForward =
    lerp(profile.hipEyeOffset[2], targetEyeForward, smoothP) +
    profile.raiseArcOffset.z * raiseBell;

  // 2. Local Weapon Transform Offset & Rotation during ADS Transition + Settle
  const wepOffX =
    profile.raiseArcOffset.x * 0.65 * raiseBell +
    optic.adsPoseOffset.x * adsState.opticAlignBlend;
  const wepOffY =
    profile.raiseArcOffset.y * 0.75 * raiseBell +
    optic.adsPoseOffset.y * 0.35 * adsState.opticAlignBlend +
    adsState.settleOffsetY;
  const wepOffZ =
    profile.raiseArcOffset.z * 0.65 * raiseBell +
    optic.adsPoseOffset.z * 0.5 * adsState.opticAlignBlend;

  const wepPitch =
    profile.raiseArcOffset.dipPitchRad * raiseBell +
    optic.adsPoseOffset.pitch * adsState.opticAlignBlend +
    adsState.settleOffsetPitch;
  const wepYaw = optic.adsPoseOffset.yaw * adsState.opticAlignBlend;
  const wepRoll =
    profile.raiseArcOffset.cantRollRad * raiseBell +
    optic.adsPoseOffset.roll * adsState.opticAlignBlend;

  // 3. Stabilized ADS Recoil Multiplier
  const recoilScale = lerp(1.0, profile.adsRecoilMultiplier, smoothP);

  // 4. Sight-Line Lock Blend (dampens idle breathing/walk sway when ADS is active)
  const sightLineLockBlend = smoothP;

  // 5. High-magnification Scope Eye-Box Mesh Occlusion
  // Only hide the 3D weapon body once the scope lens overlay is nearly opaque (>= 0.85)
  // so Stages 1-4 visibly show the 3D weapon and 3D scope rising to the player's eye!
  const hideViewModelMesh =
    optic.overlay.showLensOverlay &&
    optic.overlay.occludeWeaponMeshAtFullAds &&
    adsState.overlayOpacity >= 0.85;

  return {
    eyeOffset: [eyeRight, eyeUp, eyeForward],
    weaponOffset: [wepOffX, wepOffY, wepOffZ],
    weaponRotation: [wepPitch, wepYaw, wepRoll],
    recoilScale,
    hideViewModelMesh,
    sightLineLockBlend,
  };
}
