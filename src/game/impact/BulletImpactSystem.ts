import * as THREE from 'three';
import {
  deriveImpactSeed,
  generateProceduralMarkDescriptor,
  solveImpactAngle,
} from './ImpactAngleSolver.ts';
import { ImpactCleanupManager } from './ImpactCleanupManager.ts';
import { ImpactEffectsPool } from './ImpactEffectsPool.ts';
import { ImpactInstancePool } from './ImpactInstancePool.ts';
import {
  IMPACT_QUALITY_PROFILES,
  classifyArenaHitMaterial,
} from './ImpactMaterialProfiles.ts';
import type {
  IBulletImpactSystem,
  ImpactAngleRegime,
  ImpactDebugTelemetry,
  ImpactInstanceMetadata,
  ImpactMaterialType,
  ImpactQualityConfig,
  ImpactQualityProfileId,
  ImpactRequest,
  ImpactShapeFamily,
} from './impact.types.ts';

/**
 * Production-Quality Hybrid Procedural Bullet Impact Engine (`BulletImpactSystem.ts`).
 *
 * Features:
 * 1. Angle-dependent impact solver (`solveImpactAngle`) computing incidence angle, tangent projection,
 *    and bounded deformation across perpendicular, oblique, and grazing hits.
 * 2. Deterministic seeded procedural mark synthesis across 4 shape families (spall crater, star fracture,
 *    directional gouge, stepped cavern) with natural overlap accumulation.
 * 3. Configurable material damage profiles for Concrete, Stone, Wood, Metal, Glass, Tile, and Gravel.
 * 4. Batched `THREE.InstancedMesh` rendering with a shared GLSL `ShaderMaterial` + optional close-up
 *    3D localized crater/dent collars + instanced secondary debris/spark/dust pools.
 * 5. Mobile & Desktop quality profiles and zero-allocation per-frame updates.
 */
export class BulletImpactSystem implements IBulletImpactSystem {
  public readonly rootGroup: THREE.Group;
  private readonly instancePool: ImpactInstancePool;
  private readonly effectsPool: ImpactEffectsPool;
  private readonly cleanupManager: ImpactCleanupManager;

  private qualityConfig: ImpactQualityConfig;
  private elapsedMs = 0;
  private totalImpactsAdded = 0;
  private lastCameraPos = new THREE.Vector3(0, 1.7, 20);

  private readonly materialCounts: Record<ImpactMaterialType, number> = {
    concrete: 0,
    stone: 0,
    wood: 0,
    metal: 0,
    glass: 0,
    tile: 0,
    gravel: 0,
    default: 0,
  };

  private lastImpactAngleDeg = 0;
  private lastElongation = 1.0;
  private lastRegime: ImpactAngleRegime = 'perpendicular';
  private lastMaterial: ImpactMaterialType = 'concrete';
  private lastShapeFamily: ImpactShapeFamily = 0;
  private lastOverlapCount = 0;

  constructor(
    sceneOrGroup: THREE.Object3D,
    initialProfile: ImpactQualityProfileId | 'low' | 'medium' | 'high' = 'desktop',
    isSoftwareGl = false
  ) {
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'BulletImpactSystemRoot';
    sceneOrGroup.add(this.rootGroup);

    const profileId = BulletImpactSystem.resolveProfileId(initialProfile, isSoftwareGl);
    this.qualityConfig = { ...IMPACT_QUALITY_PROFILES[profileId] };

    this.cleanupManager = new ImpactCleanupManager();
    this.instancePool = new ImpactInstancePool(
      this.rootGroup,
      IMPACT_QUALITY_PROFILES.desktop.maxActiveMarks,
      IMPACT_QUALITY_PROFILES.desktop.maxDetailMeshes,
      this.qualityConfig
    );
    this.effectsPool = new ImpactEffectsPool(
      this.rootGroup,
      IMPACT_QUALITY_PROFILES.desktop.maxActiveParticles,
      IMPACT_QUALITY_PROFILES.desktop.maxActiveDustPuffs,
      this.qualityConfig
    );
  }

  public static resolveProfileId(
    profile: ImpactQualityProfileId | 'low' | 'medium' | 'high',
    isSoftwareGl = false
  ): ImpactQualityProfileId {
    if (isSoftwareGl || profile === 'mobile' || profile === 'low') {
      return 'mobile';
    }
    return 'desktop';
  }

  public setQualityProfile(
    profile: ImpactQualityProfileId | 'low' | 'medium' | 'high',
    isSoftwareGl = false
  ): void {
    const profileId = BulletImpactSystem.resolveProfileId(profile, isSoftwareGl);
    this.qualityConfig = { ...IMPACT_QUALITY_PROFILES[profileId] };
    this.instancePool.applyQualityConfig(this.qualityConfig);
    this.effectsPool.applyQualityConfig(this.qualityConfig);
  }

  public getQualityConfig(): ImpactQualityConfig {
    return this.qualityConfig;
  }

  /**
   * Adds a new bullet impact mark and triggers material-specific secondary particles.
   * Reuses existing hitscan data — never performs an extra raycast.
   */
  public addImpact(request: ImpactRequest): ImpactInstanceMetadata | null {
    if (
      !request ||
      !request.point ||
      !request.normal ||
      !request.direction ||
      !Number.isFinite(request.point.x) ||
      !Number.isFinite(request.point.y) ||
      !Number.isFinite(request.point.z)
    ) {
      return null;
    }

    // 1. Resolve surface material type (explicit or auto-classified from arena geometry)
    let materialType: ImpactMaterialType = request.materialType ?? 'concrete';
    if (!request.materialType && request.arena) {
      materialType = classifyArenaHitMaterial(
        request.arena,
        request.point.x,
        request.point.y,
        request.point.z,
        request.surfaceId,
        request.propKind
      );
    }

    // 2. Solve incidence angle, tangent basis, elongation, and wall-edge clamping
    const angleResult = solveImpactAngle({
      ...request,
      materialType,
    });

    if (!angleResult.valid) {
      return null;
    }

    // 3. Always spawn secondary sparks/debris/dust at the impact site
    const seed =
      request.seed ??
      deriveImpactSeed(
        angleResult.clampedPoint.x,
        angleResult.clampedPoint.y,
        angleResult.clampedPoint.z,
        request.weaponId,
        this.totalImpactsAdded + 1
      );

    this.effectsPool.spawnImpactSecondaryEffects(
      seed,
      request.weaponId,
      materialType,
      angleResult
    );

    // 4. Compute localized overlap accumulation from nearby existing marks
    const overlapCount = this.cleanupManager.computeLocalOverlapCount(
      this.instancePool.getSlots(),
      this.instancePool.getActiveLimit(),
      angleResult.clampedPoint.x,
      angleResult.clampedPoint.y,
      angleResult.clampedPoint.z,
      angleResult.normal.x,
      angleResult.normal.y,
      angleResult.normal.z,
      0.28
    );

    // 5. Generate deterministic procedural mark descriptor
    const descriptor = generateProceduralMarkDescriptor(
      seed,
      request.weaponId,
      materialType,
      angleResult,
      overlapCount
    );

    // 6. Acquire an instanced slot (recycling lowest-priority mark if pool is full)
    const { slotIndex } = this.cleanupManager.acquireSlot(
      this.instancePool.getSlots(),
      this.instancePool.getActiveLimit(),
      this.lastCameraPos.x,
      this.lastCameraPos.y,
      this.lastCameraPos.z
    );

    // Check if close enough to camera to warrant a 3D localized detail collar
    const distToCam = Math.hypot(
      angleResult.clampedPoint.x - this.lastCameraPos.x,
      angleResult.clampedPoint.y - this.lastCameraPos.y,
      angleResult.clampedPoint.z - this.lastCameraPos.z
    );
    const spawnDetailCollar =
      this.qualityConfig.enableDetailGeometry &&
      distToCam <= this.qualityConfig.lodNearDist;

    const metadata = this.instancePool.writeImpactToSlot(
      slotIndex,
      this.elapsedMs,
      this.qualityConfig.maxMarkAgeMs,
      request.weaponId,
      materialType,
      angleResult,
      descriptor,
      spawnDetailCollar
    );

    this.totalImpactsAdded += 1;
    this.materialCounts[materialType] =
      (this.materialCounts[materialType] || 0) + 1;
    this.lastImpactAngleDeg = angleResult.incidenceDeg;
    this.lastElongation = angleResult.elongation;
    this.lastRegime = angleResult.regime;
    this.lastMaterial = materialType;
    this.lastShapeFamily = descriptor.shapeFamily;
    this.lastOverlapCount = overlapCount;

    return metadata;
  }

  /**
   * Advances time-dependent mark fade-outs, shader LOD uniforms, and secondary particle physics.
   * Called once per frame from the existing game loop.
   */
  public update(dtSeconds: number, camera: THREE.Camera): void {
    const clampedDt = Math.min(0.1, Math.max(0.0005, dtSeconds));
    this.elapsedMs += clampedDt * 1000;
    this.lastCameraPos.copy(camera.position);

    this.instancePool.update(clampedDt, this.lastCameraPos);
    this.effectsPool.update(clampedDt);
  }

  public getDebugTelemetry(): ImpactDebugTelemetry {
    const activeImpactCount = this.instancePool.getActiveCount();
    const maxPoolCapacity = this.instancePool.getActiveLimit();
    const activeSecondaryParticles = this.effectsPool.getActiveParticleCount();
    const activeDustPuffs = this.effectsPool.getActiveDustCount();
    const activeDetailMeshes = this.instancePool.getActiveDetailCount();

    // Draw call count: 1 for procedural marks InstancedMesh + (1 if detail geometry enabled) + 2 for particle/dust InstancedMeshes
    let impactDrawCalls = activeImpactCount > 0 ? 1 : 0;
    if (activeDetailMeshes > 0) impactDrawCalls += 1;
    if (activeSecondaryParticles > 0) impactDrawCalls += 1;
    if (activeDustPuffs > 0) impactDrawCalls += 1;

    return {
      activeImpactCount,
      maxPoolCapacity,
      poolUtilizationRatio:
        maxPoolCapacity > 0 ? activeImpactCount / maxPoolCapacity : 0,
      totalImpactsAdded: this.totalImpactsAdded,
      recycledCount: this.cleanupManager.getRecycledCount(),
      activeSecondaryParticles,
      activeDustPuffs,
      activeDetailMeshes,
      impactDrawCalls,
      materialCounts: { ...this.materialCounts },
      lastImpactAngleDeg: Number(this.lastImpactAngleDeg.toFixed(2)),
      lastElongation: Number(this.lastElongation.toFixed(3)),
      lastRegime: this.lastRegime,
      lastMaterial: this.lastMaterial,
      lastShapeFamily: this.lastShapeFamily,
      lastOverlapCount: this.lastOverlapCount,
      qualityProfile: this.qualityConfig.id,
    };
  }

  public clear(): void {
    this.instancePool.clearAll();
    this.effectsPool.clearAll();
    this.cleanupManager.resetStats();
  }

  public dispose(): void {
    this.instancePool.dispose();
    this.effectsPool.dispose();
    this.rootGroup.removeFromParent();
  }
}
