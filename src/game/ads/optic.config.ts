import type { WeaponId } from '../config.ts';
import type {
  CoreSelectableOpticId,
  OpticConfig,
  OpticId,
  WeaponADSProfile,
  WeaponOpticLoadout,
} from './ads.types.ts';

export const CORE_SELECTABLE_OPTICS: CoreSelectableOpticId[] = [
  'none',
  'scope_2x',
  'scope_4x',
];

export const DEFAULT_BASE_FOV = 90;
export const MIN_BASE_FOV = 70;
export const MAX_BASE_FOV = 110;

/**
 * Data-driven Optic Attachment Registry.
 * Defines Iron Sights ('none'), 2x Tactical Scope ('scope_2x'), 4x Marksman Scope ('scope_4x'),
 * plus extensible Red Dot, Holographic, 6x, and 8x optics.
 */
export const OPTIC_REGISTRY: Record<OpticId, OpticConfig> = {
  none: {
    id: 'none',
    name: 'Iron Sights',
    shortLabel: 'IRON',
    magnification: 1.0,
    targetFovAt90: 78, // Slight natural focus zoom from 90 -> 78 deg without scope overlay
    sensitivityMultiplier: 0.7, // Required: 0.70x for ADS without scope
    opticSightHeight: 0.0,
    adsPoseOffset: {
      x: 0,
      y: 0,
      z: 0,
      pitch: 0,
      yaw: 0,
      roll: 0,
    },
    enterSpeedMultiplier: 1.0,
    exitSpeedMultiplier: 1.0,
    compatibleWeapons: ['m4a1', 'ak47', 'mp5', 'spas12', 'awp', 'deagle'],
    reticle: {
      pattern: 'none',
      primaryColor: '#f4f4f5',
      secondaryColor: '#a1a1aa',
      glowColor: 'rgba(244,244,245,0)',
      centerDotRadiusPx: 0,
      ringRadiusPx: 0,
      lineThicknessPx: 0,
      stadiaTickCount: 0,
      showRangefinder: false,
    },
    overlay: {
      showLensOverlay: false,
      lensScaleRatio: 0.85,
      outerMaskOpacity: 0,
      eyeReliefShadow: 0,
      glassTintCss: 'rgba(0,0,0,0)',
      acquireStartProgress: 1.0,
      acquireFullProgress: 1.0,
      occludeWeaponMeshAtFullAds: false,
    },
  },

  red_dot: {
    id: 'red_dot',
    name: '1.25x Reflex Red Dot',
    shortLabel: 'RDS',
    magnification: 1.25,
    targetFovAt90: 72,
    sensitivityMultiplier: 0.65,
    opticSightHeight: 0.036,
    adsPoseOffset: {
      x: 0,
      y: -0.036,
      z: 0.015,
      pitch: 0,
      yaw: 0,
      roll: 0,
    },
    enterSpeedMultiplier: 0.96,
    exitSpeedMultiplier: 1.0,
    compatibleWeapons: ['m4a1', 'ak47', 'mp5', 'spas12', 'deagle'],
    reticle: {
      pattern: 'red_dot',
      primaryColor: '#ef4444',
      secondaryColor: '#fca5a5',
      glowColor: 'rgba(239,68,68,0.55)',
      centerDotRadiusPx: 3.0,
      ringRadiusPx: 18,
      lineThicknessPx: 1.5,
      stadiaTickCount: 0,
      showRangefinder: false,
    },
    overlay: {
      showLensOverlay: false,
      lensScaleRatio: 0.82,
      outerMaskOpacity: 0.18,
      eyeReliefShadow: 0.15,
      glassTintCss: 'rgba(14,165,233,0.03)',
      acquireStartProgress: 0.65,
      acquireFullProgress: 0.88,
      occludeWeaponMeshAtFullAds: false,
    },
  },

  holo: {
    id: 'holo',
    name: '1.35x Holographic Sight',
    shortLabel: 'HOLO',
    magnification: 1.35,
    targetFovAt90: 68,
    sensitivityMultiplier: 0.62,
    opticSightHeight: 0.04,
    adsPoseOffset: {
      x: 0,
      y: -0.04,
      z: 0.018,
      pitch: 0,
      yaw: 0,
      roll: 0,
    },
    enterSpeedMultiplier: 0.94,
    exitSpeedMultiplier: 0.98,
    compatibleWeapons: ['m4a1', 'ak47', 'mp5', 'spas12'],
    reticle: {
      pattern: 'holo_ring',
      primaryColor: '#f43f5e',
      secondaryColor: '#fda4af',
      glowColor: 'rgba(244,63,94,0.45)',
      centerDotRadiusPx: 2.2,
      ringRadiusPx: 28,
      lineThicknessPx: 1.6,
      stadiaTickCount: 4,
      showRangefinder: false,
    },
    overlay: {
      showLensOverlay: false,
      lensScaleRatio: 0.8,
      outerMaskOpacity: 0.22,
      eyeReliefShadow: 0.2,
      glassTintCss: 'rgba(16,185,129,0.03)',
      acquireStartProgress: 0.65,
      acquireFullProgress: 0.88,
      occludeWeaponMeshAtFullAds: false,
    },
  },

  scope_2x: {
    id: 'scope_2x',
    name: '2x Tactical Combat Optic',
    shortLabel: '2X',
    magnification: 2.0,
    targetFovAt90: 48, // Moderate 2x optical magnification from 90 deg base
    sensitivityMultiplier: 0.5, // Required: 0.50x for 2x scope
    opticSightHeight: 0.045,
    adsPoseOffset: {
      x: 0,
      y: -0.045,
      z: 0.032,
      pitch: 0,
      yaw: 0,
      roll: 0,
    },
    enterSpeedMultiplier: 0.88,
    exitSpeedMultiplier: 0.95,
    compatibleWeapons: ['m4a1', 'ak47', 'mp5', 'spas12', 'awp', 'deagle'],
    reticle: {
      pattern: 'tactical_2x',
      primaryColor: '#10b981',
      secondaryColor: 'rgba(228,228,231,0.88)',
      glowColor: 'rgba(16,185,129,0.55)',
      centerDotRadiusPx: 2.6,
      ringRadiusPx: 42,
      lineThicknessPx: 1.5,
      stadiaTickCount: 4,
      showRangefinder: false,
    },
    overlay: {
      showLensOverlay: true,
      lensScaleRatio: 0.74,
      outerMaskOpacity: 0.78,
      eyeReliefShadow: 0.55,
      glassTintCss: 'rgba(20, 184, 166, 0.045)',
      acquireStartProgress: 0.66,
      acquireFullProgress: 0.9,
      occludeWeaponMeshAtFullAds: true,
    },
  },

  scope_4x: {
    id: 'scope_4x',
    name: '4x ACOG Marksman Scope',
    shortLabel: '4X',
    magnification: 4.0,
    targetFovAt90: 25, // Stronger 4x optical magnification for medium-to-long range precision
    sensitivityMultiplier: 0.35, // Required: 0.35x for 4x scope
    opticSightHeight: 0.052,
    adsPoseOffset: {
      x: 0,
      y: -0.052,
      z: 0.045,
      pitch: 0,
      yaw: 0,
      roll: 0,
    },
    enterSpeedMultiplier: 0.78,
    exitSpeedMultiplier: 0.9,
    compatibleWeapons: ['m4a1', 'ak47', 'mp5', 'spas12', 'awp', 'deagle'],
    reticle: {
      pattern: 'marksman_4x',
      primaryColor: '#f43f5e',
      secondaryColor: 'rgba(244,244,245,0.92)',
      glowColor: 'rgba(244,63,94,0.5)',
      centerDotRadiusPx: 2.0,
      ringRadiusPx: 68,
      lineThicknessPx: 1.25,
      stadiaTickCount: 8,
      showRangefinder: true,
    },
    overlay: {
      showLensOverlay: true,
      lensScaleRatio: 0.68,
      outerMaskOpacity: 0.92,
      eyeReliefShadow: 0.78,
      glassTintCss: 'rgba(56, 189, 248, 0.05)',
      acquireStartProgress: 0.68,
      acquireFullProgress: 0.92,
      occludeWeaponMeshAtFullAds: true,
    },
  },

  scope_6x: {
    id: 'scope_6x',
    name: '6x Variable Reconnaissance Scope',
    shortLabel: '6X',
    magnification: 6.0,
    targetFovAt90: 17,
    sensitivityMultiplier: 0.25,
    opticSightHeight: 0.056,
    adsPoseOffset: {
      x: 0,
      y: -0.056,
      z: 0.052,
      pitch: 0,
      yaw: 0,
      roll: 0,
    },
    enterSpeedMultiplier: 0.72,
    exitSpeedMultiplier: 0.86,
    compatibleWeapons: ['m4a1', 'ak47', 'awp'],
    reticle: {
      pattern: 'sniper_mil',
      primaryColor: '#38bdf8',
      secondaryColor: 'rgba(244,244,245,0.94)',
      glowColor: 'rgba(56,189,248,0.45)',
      centerDotRadiusPx: 1.8,
      ringRadiusPx: 84,
      lineThicknessPx: 1.15,
      stadiaTickCount: 10,
      showRangefinder: true,
    },
    overlay: {
      showLensOverlay: true,
      lensScaleRatio: 0.66,
      outerMaskOpacity: 0.95,
      eyeReliefShadow: 0.85,
      glassTintCss: 'rgba(56, 189, 248, 0.055)',
      acquireStartProgress: 0.7,
      acquireFullProgress: 0.94,
      occludeWeaponMeshAtFullAds: true,
    },
  },

  scope_8x: {
    id: 'scope_8x',
    name: '8x Ballistic Sniper Scope',
    shortLabel: '8X',
    magnification: 8.0,
    targetFovAt90: 13,
    sensitivityMultiplier: 0.18,
    opticSightHeight: 0.058,
    adsPoseOffset: {
      x: 0,
      y: -0.058,
      z: 0.058,
      pitch: 0,
      yaw: 0,
      roll: 0,
    },
    enterSpeedMultiplier: 0.68,
    exitSpeedMultiplier: 0.84,
    compatibleWeapons: ['awp'],
    reticle: {
      pattern: 'sniper_mil',
      primaryColor: '#ef4444',
      secondaryColor: 'rgba(244,244,245,0.95)',
      glowColor: 'rgba(239,68,68,0.5)',
      centerDotRadiusPx: 1.6,
      ringRadiusPx: 92,
      lineThicknessPx: 1.1,
      stadiaTickCount: 12,
      showRangefinder: true,
    },
    overlay: {
      showLensOverlay: true,
      lensScaleRatio: 0.65,
      outerMaskOpacity: 0.96,
      eyeReliefShadow: 0.88,
      glassTintCss: 'rgba(14, 165, 233, 0.06)',
      acquireStartProgress: 0.72,
      acquireFullProgress: 0.95,
      occludeWeaponMeshAtFullAds: true,
    },
  },
};

/**
 * Default equipped optic per weapon.
 * Note: Every weapon can equip 'none' (Iron Sights), 'scope_2x' (2x Tactical), or 'scope_4x' (4x Marksman).
 * By default:
 * - M4A1 starts with 'scope_2x' (2x Tactical Optic)
 * - AWP starts with 'scope_4x' (4x Marksman Scope)
 * - AK-47, MP5, SPAS-12, and Desert Eagle start with 'none' (Iron Sights) to showcase Universal ADS out of the box!
 */
export const DEFAULT_WEAPON_OPTICS: WeaponOpticLoadout = {
  m4a1: 'scope_2x',
  ak47: 'none',
  mp5: 'none',
  spas12: 'none',
  awp: 'scope_4x',
  deagle: 'none',
};

/**
 * Per-weapon ADS animation and alignment profiles.
 * Tailored for weapon length, stock geometry, receiver height, and handling cadence.
 */
export const WEAPON_ADS_PROFILES: Record<WeaponId, WeaponADSProfile> = {
  m4a1: {
    weaponId: 'm4a1',
    enterDurationSec: 0.21,
    exitDurationSec: 0.17,
    railMountPosition: [0, 0.088, -0.02],
    ironSightAnchor: [0, 0.118, -0.02],
    hipEyeOffset: [0.02, -0.06, 0.2],
    adsEyeOffset: [0.22, -0.028, 0.3],
    raiseArcOffset: {
      x: -0.014,
      y: 0.022,
      z: -0.018,
      cantRollRad: -0.085,
      dipPitchRad: -0.032,
    },
    settleSpring: {
      frequencyHz: 11.5,
      dampingRatio: 0.62,
      impulsePitchRad: 0.014,
      impulseY: -0.005,
    },
    adsRecoilMultiplier: 0.52,
  },

  ak47: {
    weaponId: 'ak47',
    enterDurationSec: 0.24,
    exitDurationSec: 0.19,
    railMountPosition: [0, 0.082, -0.03],
    ironSightAnchor: [0, 0.105, -0.03],
    hipEyeOffset: [0.02, -0.06, 0.2],
    adsEyeOffset: [0.22, -0.036, 0.3],
    raiseArcOffset: {
      x: -0.018,
      y: 0.026,
      z: -0.022,
      cantRollRad: -0.105,
      dipPitchRad: -0.04,
    },
    settleSpring: {
      frequencyHz: 10.2,
      dampingRatio: 0.58,
      impulsePitchRad: 0.018,
      impulseY: -0.006,
    },
    adsRecoilMultiplier: 0.58,
  },

  mp5: {
    weaponId: 'mp5',
    enterDurationSec: 0.16,
    exitDurationSec: 0.14,
    railMountPosition: [0, 0.082, 0.01],
    ironSightAnchor: [0, 0.102, 0.01],
    hipEyeOffset: [0.02, -0.06, 0.2],
    adsEyeOffset: [0.215, -0.034, 0.32],
    raiseArcOffset: {
      x: -0.011,
      y: 0.016,
      z: -0.012,
      cantRollRad: -0.065,
      dipPitchRad: -0.024,
    },
    settleSpring: {
      frequencyHz: 13.5,
      dampingRatio: 0.68,
      impulsePitchRad: 0.01,
      impulseY: -0.0035,
    },
    adsRecoilMultiplier: 0.48,
  },

  spas12: {
    weaponId: 'spas12',
    enterDurationSec: 0.25,
    exitDurationSec: 0.2,
    railMountPosition: [0, 0.078, -0.02],
    ironSightAnchor: [0, 0.096, -0.02],
    hipEyeOffset: [0.02, -0.06, 0.2],
    adsEyeOffset: [0.22, -0.04, 0.29],
    raiseArcOffset: {
      x: -0.019,
      y: 0.025,
      z: -0.02,
      cantRollRad: -0.095,
      dipPitchRad: -0.038,
    },
    settleSpring: {
      frequencyHz: 9.8,
      dampingRatio: 0.6,
      impulsePitchRad: 0.019,
      impulseY: -0.0065,
    },
    adsRecoilMultiplier: 0.64,
  },

  awp: {
    weaponId: 'awp',
    enterDurationSec: 0.31,
    exitDurationSec: 0.22,
    railMountPosition: [0, 0.088, 0.02],
    ironSightAnchor: [0, 0.104, 0.02],
    hipEyeOffset: [0.02, -0.06, 0.2],
    adsEyeOffset: [0.22, -0.022, 0.28],
    raiseArcOffset: {
      x: -0.024,
      y: 0.032,
      z: -0.028,
      cantRollRad: -0.125,
      dipPitchRad: -0.048,
    },
    settleSpring: {
      frequencyHz: 8.8,
      dampingRatio: 0.56,
      impulsePitchRad: 0.022,
      impulseY: -0.0075,
    },
    adsRecoilMultiplier: 0.6,
  },

  deagle: {
    weaponId: 'deagle',
    enterDurationSec: 0.15,
    exitDurationSec: 0.13,
    railMountPosition: [0, 0.092, -0.02],
    ironSightAnchor: [0, 0.102, -0.02],
    hipEyeOffset: [0.02, -0.06, 0.2],
    adsEyeOffset: [0.205, -0.042, 0.34],
    raiseArcOffset: {
      x: -0.009,
      y: 0.015,
      z: -0.01,
      cantRollRad: -0.055,
      dipPitchRad: -0.022,
    },
    settleSpring: {
      frequencyHz: 14.0,
      dampingRatio: 0.7,
      impulsePitchRad: 0.011,
      impulseY: -0.003,
    },
    adsRecoilMultiplier: 0.55,
  },
};

export function getOpticConfig(opticId: OpticId | undefined | null): OpticConfig {
  if (!opticId || !OPTIC_REGISTRY[opticId]) {
    return OPTIC_REGISTRY.none;
  }
  return OPTIC_REGISTRY[opticId];
}

export function getWeaponADSProfile(weaponId: WeaponId): WeaponADSProfile {
  return WEAPON_ADS_PROFILES[weaponId] || WEAPON_ADS_PROFILES.m4a1;
}
