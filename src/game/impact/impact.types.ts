import type * as THREE from 'three';
import type { ArenaDefinition, WeaponId } from '../config.ts';

/**
 * Supported surface material classifications for procedural bullet impacts.
 */
export type ImpactMaterialType =
  | 'concrete'
  | 'stone'
  | 'wood'
  | 'metal'
  | 'glass'
  | 'tile'
  | 'gravel'
  | 'default';

/**
 * Numeric material code passed to the shared procedural impact GLSL shader:
 * 0 = concrete, 1 = stone, 2 = wood, 3 = metal, 4 = glass, 5 = tile, 6 = gravel
 */
export type ImpactShaderMaterialCode = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * 4 distinct procedural mark shape families synthesized in the fragment shader:
 * 0 = spall_crater (classic irregular polygonal masonry/surface crater)
 * 1 = star_fracture (starburst radial fracture & multi-lobe blowout)
 * 2 = directional_gouge (asymmetric teardrop / grazing furrow channel)
 * 3 = stepped_cavern (dual-ring terraced penetration cavity)
 */
export type ImpactShapeFamily = 0 | 1 | 2 | 3;

/**
 * Physical incidence angle regime relative to the surface normal:
 * - 'perpendicular': 0° <= theta < 25° (mostly circular hole, symmetric spall)
 * - 'oblique': 25° <= theta < 60° (elliptical/asymmetric teardrop, directional spall)
 * - 'grazing': 60° <= theta <= 85° (elongated shallow gouge/scrape, ricochet eligible)
 */
export type ImpactAngleRegime = 'perpendicular' | 'oblique' | 'grazing';

export type ImpactQualityProfileId = 'mobile' | 'desktop';

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * Strongly typed request payload for adding a bullet impact to the engine.
 */
export interface ImpactRequest {
  /** World-space impact position */
  point: Vector3Like;
  /** World-space surface normal at the hit point */
  normal: Vector3Like;
  /** Incoming bullet travel direction vector (need not be pre-normalized) */
  direction: Vector3Like;
  /** Optional world-space firing origin (used if direction is zero or for distance checks) */
  origin?: Vector3Like;
  /** Surface material classification (falls back to automatic arena classification or 'default') */
  materialType?: ImpactMaterialType;
  /** Active weapon ID that fired the round */
  weaponId: WeaponId;
  /** Optional deterministic 32-bit seed (auto-derived from coordinates & shot counter if omitted) */
  seed?: number;
  /** Optional weapon damage dealt on hit (scales crater severity slightly) */
  damage?: number;
  /** Optional arena definition for strict wall-edge boundary clamping */
  arena?: ArenaDefinition;
  /** Optional block/surface identifier */
  surfaceId?: string | null;
  /** Optional prop kind when hitting breakable crates/barrels */
  propKind?: 'crate' | 'barrel' | null;
  /** Whether the shot was fired by an enemy bot */
  isEnemyShot?: boolean;
}

/**
 * Output of the angle-dependent impact solver (`ImpactAngleSolver.ts`).
 */
export interface ImpactAngleResult {
  valid: boolean;
  /** Clamped dot product |d · n| in [0.08, 1.0] (1.0 = dead-on perpendicular) */
  incidenceCos: number;
  /** Incidence angle in radians from the surface normal [0, PI/2) */
  incidenceRad: number;
  /** Incidence angle in degrees from the surface normal [0, 85.4] */
  incidenceDeg: number;
  /** Grazing ratio (1 - incidenceCos) in [0, 0.92] */
  grazingRatio: number;
  /** Physical impact regime ('perpendicular' | 'oblique' | 'grazing') */
  regime: ImpactAngleRegime;
  /** Outward unit surface normal facing against the incoming bullet */
  normal: Vector3Like;
  /** Unit surface tangent pointing along the projected bullet travel direction */
  tangent: Vector3Like;
  /** Unit surface bitangent orthogonal to normal and tangent */
  bitangent: Vector3Like;
  /** Unit 3D specular/grazing reflection direction for spark & debris deflection */
  reflection: Vector3Like;
  /** Bounded elongation multiplier along the tangent direction [1.0 .. maxGrazingStretch] */
  elongation: number;
  /** Directional entry-to-exit asymmetry factor [0.0 .. 0.85] for shader coordinate warping */
  asymmetry: number;
  /** Forward shift along tangent (meters) so oblique gouges extend forward from entry point */
  entryShiftMeters: number;
  /** Relative crater depth multiplier (deep on perpendicular hits, shallow on grazing scrapes) */
  craterDepthScale: number;
  /** True when grazing angle exceeds threshold and material supports ricochet sparks */
  ricochetEligible: boolean;
  /** World-space mark width along tangent axis (meters) */
  scaleT: number;
  /** World-space mark width along bitangent axis (meters) */
  scaleB: number;
  /** Clamped world-space impact center (never pokes outside wall edges) */
  clampedPoint: Vector3Like;
  /** Identified surface/block ID if clamped against arena architecture */
  surfaceId: string | null;
}

/**
 * Material-specific visual & physical damage profile.
 */
export interface ImpactMaterialProfile {
  id: ImpactMaterialType;
  shaderCode: ImpactShaderMaterialCode;
  label: string;
  /** Deep central hole / cavity color (hex) */
  coreColorHex: number;
  /** Chipped rim / spall shelf / dent lip highlight color (hex) */
  rimHighlightHex: number;
  /** Secondary outer spall / splinter / frost halo color (hex) */
  spallColorHex: number;
  /** Thermal scorch / carbon wipe color (hex) */
  scorchColorHex: number;
  /** Base radial crack intensity [0..1] */
  crackIntensity: number;
  /** Min and max radial crack count */
  crackCountRange: readonly [number, number];
  /** Edge chipping & polygonal contour irregularity [0..1] */
  rimIrregularity: number;
  /** Directional grain/splinter anisotropy along tangent [0..1] (high for wood) */
  splinterAnisotropy: number;
  /** Metallic raised dent specular sheen [0..1] (high for metal) */
  dentSpecular: number;
  /** Concentric/branching cobweb fracture factor [0..1] (high for glass/tile) */
  radialBranching: number;
  /** Overall mark diameter multiplier relative to weapon caliber base size */
  sizeMultiplier: number;
  /** Max allowed grazing elongation multiplier for this material */
  maxElongationCap: number;
  /** Secondary particle colors (hex) */
  sparkColorHex: number;
  debrisColorHex: number;
  dustColorHex: number;
  /** Ratio of high-velocity sparks vs heavy debris chunks [0..1] */
  sparkRatio: number;
  /** Base secondary particle count multiplier */
  debrisScale: number;
  /** Whether close-up impacts on this material can spawn 3D localized rim/dent geometry */
  allowDetailGeometry: boolean;
}

/**
 * Deterministic procedural parameters synthesized per bullet impact.
 */
export interface ProceduralMarkDescriptor {
  seed: number;
  shapeFamily: ImpactShapeFamily;
  shaderMaterialCode: ImpactShaderMaterialCode;
  /** Inner bore radius ratio relative to outer decal quad [0.12 .. 0.42] */
  holeRadiusRatio: number;
  /** Elongation aspect ratio (scaleT / scaleB) */
  aspectRatio: number;
  /** Outer contour irregularity & chipping amplitude [0.08 .. 0.95] */
  contourIrregularity: number;
  /** Deterministic chip mask phase [0 .. 1] */
  chipMaskSeed: number;
  /** Carbon scorch & thermal ring intensity [0.1 .. 1.0] */
  scorchIntensity: number;
  /** Central cavity darkness [0.4 .. 1.0] */
  coreDarkness: number;
  /** Subtle angular jitter (radians) applied to radial cracks & lobes */
  rotationOffsetRad: number;
  /** Number of primary radial cracks [0 .. 16] */
  crackCount: number;
  /** Radial crack reach [0.2 .. 1.0] */
  crackLengthRatio: number;
  /** Branching / cobweb fracture intensity [0 .. 1] */
  crackBranching: number;
  /** Accumulated damage boost from overlapping nearby hits [0 .. 1] */
  accumulationBoost: number;
  /** Number of overlapping impacts within the local cluster radius */
  localOverlapCount: number;
}

/**
 * Quality profile configuration for mobile and desktop targets.
 */
export interface ImpactQualityConfig {
  id: ImpactQualityProfileId;
  /** Maximum active instanced procedural impact marks in the ring/priority pool */
  maxActiveMarks: number;
  /** Maximum close-up 3D detail rim/dent meshes */
  maxDetailMeshes: number;
  /** Maximum active instanced 3D secondary particles (sparks, splinters, chips, shards) */
  maxActiveParticles: number;
  /** Maximum active instanced dust/smoke puffs */
  maxActiveDustPuffs: number;
  /** Shader procedural crack & noise detail level (1 = mobile fast, 2 = desktop full) */
  shaderDetailLevel: number;
  /** Near distance (meters) where full procedural crack & chip detail is rendered */
  lodNearDist: number;
  /** Far distance (meters) beyond which fine cracks fade out to save fragment cost */
  lodFarDist: number;
  /** Maximum lifetime of an impact mark in milliseconds before fade-out */
  maxMarkAgeMs: number;
  /** Whether close-up 3D detail crater/dent geometry is enabled */
  enableDetailGeometry: boolean;
  /** Particle count multiplier per impact */
  particleBudgetScale: number;
}

/**
 * Per-slot instance metadata stored in `ImpactInstancePool`.
 */
export interface ImpactInstanceMetadata {
  slotIndex: number;
  active: boolean;
  createdAtMs: number;
  ageMs: number;
  maxAgeMs: number;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  tx: number;
  ty: number;
  tz: number;
  bx: number;
  by: number;
  bz: number;
  scaleT: number;
  scaleB: number;
  seed: number;
  materialType: ImpactMaterialType;
  weaponId: WeaponId;
  shapeFamily: ImpactShapeFamily;
  incidenceDeg: number;
  elongation: number;
  asymmetry: number;
  grazingRatio: number;
  regime: ImpactAngleRegime;
  localOverlapCount: number;
  accumulationBoost: number;
  priorityScore: number;
  detailSlotIndex: number;
  surfaceId: string | null;
}

/**
 * Development & diagnostic telemetry snapshot.
 */
export interface ImpactDebugTelemetry {
  activeImpactCount: number;
  maxPoolCapacity: number;
  poolUtilizationRatio: number;
  totalImpactsAdded: number;
  recycledCount: number;
  activeSecondaryParticles: number;
  activeDustPuffs: number;
  activeDetailMeshes: number;
  impactDrawCalls: number;
  materialCounts: Record<ImpactMaterialType, number>;
  lastImpactAngleDeg: number;
  lastElongation: number;
  lastRegime: ImpactAngleRegime;
  lastMaterial: ImpactMaterialType;
  lastShapeFamily: ImpactShapeFamily;
  lastOverlapCount: number;
  qualityProfile: ImpactQualityProfileId;
}

/**
 * Public interface for the procedural bullet impact system.
 */
export interface IBulletImpactSystem {
  addImpact(request: ImpactRequest): ImpactInstanceMetadata | null;
  update(dtSeconds: number, camera: THREE.Camera): void;
  setQualityProfile(
    profile: ImpactQualityProfileId | 'low' | 'medium' | 'high',
    isSoftwareGl?: boolean
  ): void;
  getQualityConfig(): ImpactQualityConfig;
  getDebugTelemetry(): ImpactDebugTelemetry;
  clear(): void;
  dispose(): void;
}
