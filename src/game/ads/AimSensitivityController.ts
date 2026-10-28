import type { OpticId } from './ads.types.ts';
import { getOpticConfig } from './optic.config.ts';

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Centralized Aim Sensitivity Solver.
 *
 * Multipliers at full ADS (adsProgress = 1):
 * - Hip-fire (adsProgress = 0):  1.00x
 * - ADS without scope ('none'):  0.70x
 * - 2x Scope ('scope_2x'):       0.50x
 * - 4x Scope ('scope_4x'):       0.35x
 *
 * Smoothly interpolates during ADS entry and exit and never stacks across frames.
 */
export function computeAimSensitivityMultiplier(
  adsProgress: number,
  opticId: OpticId = 'none'
): number {
  const p = clamp01(adsProgress);
  if (p <= 0.0001) {
    return 1.0;
  }
  const optic = getOpticConfig(opticId);
  const targetMult = optic.sensitivityMultiplier;
  return 1.0 + (targetMult - 1.0) * p;
}

/**
 * Applies the ADS/optic sensitivity multiplier once to a base look sensitivity value.
 */
export function computeEffectiveLookSensitivity(
  baseSensitivity: number,
  adsProgress: number,
  opticId: OpticId = 'none'
): number {
  return baseSensitivity * computeAimSensitivityMultiplier(adsProgress, opticId);
}
