import type { OpticId } from './ads.types.ts';
import {
  DEFAULT_BASE_FOV,
  MAX_BASE_FOV,
  MIN_BASE_FOV,
  getOpticConfig,
} from './optic.config.ts';

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function easeOutCubic(t: number): number {
  const c = clamp(t, 0, 1);
  return 1 - Math.pow(1 - c, 3);
}

export interface ComposeCameraFOVParams {
  /** Player's configured base hip-fire FOV (default 90 deg) */
  baseFov?: number;
  /** Current 0..1 ADS transition progress */
  adsProgress: number;
  /** Currently equipped optic on active weapon */
  opticId: OpticId;
  /** Whether player is currently tactical sliding */
  isSliding?: boolean;
  /** Whether player is currently sprinting */
  isSprinting?: boolean;
  /** Temporary weapon recoil FOV kick in degrees */
  recoilFovKickDeg?: number;
}

/**
 * Computes the target ADS FOV for a given base FOV and equipped optic.
 */
export function getTargetADSFov(
  opticId: OpticId,
  baseFov: number = DEFAULT_BASE_FOV
): number {
  const clampedBase = clamp(baseFov, MIN_BASE_FOV, MAX_BASE_FOV);
  const optic = getOpticConfig(opticId);
  const scaleFactor = optic.targetFovAt90 / DEFAULT_BASE_FOV;
  return clamp(clampedBase * scaleFactor, 10, MAX_BASE_FOV);
}

/**
 * Centralized Camera FOV Composer.
 * Combines base FOV, Universal ADS / Optic magnification zoom, movement surge, and recoil kick
 * from stateless inputs so repeated ADS toggles or weapon switches never cause FOV drift.
 */
export function computeComposedCameraFOV(
  params: ComposeCameraFOVParams
): number {
  const baseFov = clamp(
    params.baseFov ?? DEFAULT_BASE_FOV,
    MIN_BASE_FOV,
    MAX_BASE_FOV
  );
  const p = clamp(params.adsProgress, 0, 1);
  const targetAdsFov = getTargetADSFov(params.opticId, baseFov);

  // Smooth optical zoom curve across ADS progress
  const zoomBlend = easeOutCubic(p);
  const zoomedFov = baseFov + (targetAdsFov - baseFov) * zoomBlend;

  // Movement FOV surge (only active when not ADS)
  const hipWeight = 1 - p;
  const movementFovDelta = params.isSliding
    ? 6.0 * hipWeight
    : params.isSprinting
      ? 3.5 * hipWeight
      : 0;

  // Subtle recoil FOV impulse (scaled down under high magnification to prevent nausea)
  const optic = getOpticConfig(params.opticId);
  const recoilScale = optic.magnification >= 2 ? 0.35 : 0.7;
  const recoilDelta = (params.recoilFovKickDeg ?? 0) * (1 - p * (1 - recoilScale));

  return clamp(zoomedFov + movementFovDelta + recoilDelta, 10, 120);
}
