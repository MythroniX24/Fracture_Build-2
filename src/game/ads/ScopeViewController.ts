import type { ADSControllerState, OpticId } from './ads.types.ts';
import { getOpticConfig } from './optic.config.ts';
import {
  type ReticleRenderState,
  computeReticleRenderState,
} from './ReticleController.ts';

export interface ScopeViewState {
  isScopeOverlayActive: boolean;
  overlayOpacity: number;
  lensScale: number;
  lensDiameterVmin: number;
  outerMaskOpacity: number;
  eyeReliefShadow: number;
  glassTintCss: string;
  opticId: OpticId;
  reticle: ReticleRenderState;
}

/**
 * Computes the complete Scope Lens & Reticle View state for the current frame.
 * - For 'none' (Iron Sights): `isScopeOverlayActive` is false and `overlayOpacity` is 0.
 * - For 'scope_2x' (2x Tactical): Circular 74vmin lens, 2.0X illuminated circle-dot/chevron reticle, moderate vignette.
 * - For 'scope_4x' (4x Marksman): Circular 68vmin lens, 4.0X BDC mil-hash crosshair reticle, deep eye-box vignette.
 */
export function computeScopeViewState(
  adsState: ADSControllerState,
  recoilPitchRad = 0
): ScopeViewState {
  const optic = getOpticConfig(adsState.activeOpticId);
  const reticle = computeReticleRenderState(adsState, recoilPitchRad);
  const active = optic.overlay.showLensOverlay && adsState.overlayOpacity > 0.005;

  // Lens expands smoothly from 0.88x to 1.00x as the player's eye enters the scope eye-box (Stage 4 -> Stage 6)
  const lensScale = 0.88 + 0.12 * adsState.opticAlignBlend;

  return {
    isScopeOverlayActive: active,
    overlayOpacity: active ? adsState.overlayOpacity : 0,
    lensScale,
    lensDiameterVmin: Math.round(optic.overlay.lensScaleRatio * 100),
    outerMaskOpacity: optic.overlay.outerMaskOpacity,
    eyeReliefShadow: optic.overlay.eyeReliefShadow,
    glassTintCss: optic.overlay.glassTintCss,
    opticId: optic.id,
    reticle,
  };
}

/**
 * Synchronizes the Scope Overlay DOM container directly at 60fps without React re-renders.
 */
export function syncScopeOverlayDom(
  rootEl: HTMLDivElement | null,
  adsState: ADSControllerState,
  recoilPitchRad = 0
): void {
  if (!rootEl) return;
  const view = computeScopeViewState(adsState, recoilPitchRad);

  const opacityStr = view.overlayOpacity.toFixed(3);
  if (rootEl.dataset.lastOpacity !== opacityStr) {
    rootEl.dataset.lastOpacity = opacityStr;
    rootEl.style.opacity = opacityStr;
  }

  rootEl.dataset.opticId = view.opticId;
  rootEl.dataset.adsStage = adsState.stage;
  rootEl.dataset.adsProgress = adsState.adsProgress.toFixed(3);
  rootEl.dataset.scopeActive = view.isScopeOverlayActive ? 'true' : 'false';

  const scaleStr = view.lensScale.toFixed(3);
  if (rootEl.dataset.lastScale !== scaleStr) {
    rootEl.dataset.lastScale = scaleStr;
    rootEl.style.setProperty('--scope-lens-scale', scaleStr);
  }
}
