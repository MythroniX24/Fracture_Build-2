import type {
  ADSControllerState,
  OpticId,
  OpticReticleConfig,
  ReticlePatternType,
} from './ads.types.ts';
import { getOpticConfig } from './optic.config.ts';

export interface ReticleRenderState {
  visible: boolean;
  opacity: number;
  opticId: OpticId;
  pattern: ReticlePatternType;
  magnificationLabel: string;
  opticTitle: string;
  reticleConfig: OpticReticleConfig;
  /** Subtle dynamic breathing/recoil sway offset in pixels within the lens */
  recoilShiftYPx: number;
}

/**
 * Computes the active reticle state for the equipped optic and ADS progress.
 * Ensures the reticle is ONLY visible when an optic with a reticle is equipped and ADS is in Sight Acquisition / Aiming.
 */
export function computeReticleRenderState(
  adsState: ADSControllerState,
  recoilPitchRad = 0
): ReticleRenderState {
  const optic = getOpticConfig(adsState.activeOpticId);
  const showReticle =
    optic.overlay.showLensOverlay && adsState.overlayOpacity > 0.01;

  return {
    visible: showReticle,
    opacity: showReticle ? adsState.overlayOpacity : 0,
    opticId: optic.id,
    pattern: optic.reticle.pattern,
    magnificationLabel: `${optic.magnification.toFixed(1)}X OPTIC`,
    opticTitle: optic.name.toUpperCase(),
    reticleConfig: optic.reticle,
    recoilShiftYPx: Math.max(-14, Math.min(14, -recoilPitchRad * 42)),
  };
}
