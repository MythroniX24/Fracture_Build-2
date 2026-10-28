import * as THREE from 'three';
import { WEAPON_IMPACT_PROFILES } from '../rules.ts';
import { createSeededRandom } from './ImpactAngleSolver.ts';
import { getImpactMaterialProfile } from './ImpactMaterialProfiles.ts';
import type {
  ImpactAngleResult,
  ImpactMaterialType,
  ImpactQualityConfig,
} from './impact.types.ts';
import type { WeaponId } from '../config.ts';

interface PooledDebrisParticle {
  active: boolean;
  ageMs: number;
  maxAgeMs: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

interface PooledDustPuff {
  active: boolean;
  ageMs: number;
  maxAgeMs: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  startScale: number;
  endScale: number;
}

const _posVec = new THREE.Vector3();
const _targetVec = new THREE.Vector3();
const _scaleVec = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _lookMat = new THREE.Matrix4();
const _instanceMat = new THREE.Matrix4();
const _hiddenMat = new THREE.Matrix4().makeScale(0, 0, 0);
const _color = new THREE.Color();
const _upVec = new THREE.Vector3(0, 1, 0);

/**
 * Pooled Secondary Impact Effects (`ImpactEffectsPool.ts`):
 * - Uses a single `THREE.InstancedMesh` for all 3D ballistic sparks, stone chips, wood splinters, and glass shards.
 * - Uses a single `THREE.InstancedMesh` for short-lived pulverized dust/smoke puffs.
 * - Zero per-impact mesh or material creation.
 */
export class ImpactEffectsPool {
  public readonly maxParticles: number;
  public readonly maxDustPuffs: number;
  public readonly particleInstancedMesh: THREE.InstancedMesh;
  public readonly dustInstancedMesh: THREE.InstancedMesh;

  private readonly particleGeo: THREE.BoxGeometry;
  private readonly particleMat: THREE.MeshBasicMaterial;
  private readonly dustGeo: THREE.DodecahedronGeometry;
  private readonly dustMat: THREE.MeshBasicMaterial;

  private readonly particles: PooledDebrisParticle[] = [];
  private readonly dustPuffs: PooledDustPuff[] = [];

  private particleCursor = 0;
  private dustCursor = 0;
  private activeParticleLimit: number;
  private activeDustLimit: number;
  private budgetScale: number;

  constructor(
    parentGroup: THREE.Object3D,
    maxParticles = 128,
    maxDustPuffs = 28,
    initialQuality?: ImpactQualityConfig
  ) {
    this.maxParticles = maxParticles;
    this.maxDustPuffs = maxDustPuffs;
    this.activeParticleLimit = initialQuality
      ? Math.min(maxParticles, initialQuality.maxActiveParticles)
      : maxParticles;
    this.activeDustLimit = initialQuality
      ? Math.min(maxDustPuffs, initialQuality.maxActiveDustPuffs)
      : maxDustPuffs;
    this.budgetScale = initialQuality?.particleBudgetScale ?? 1.0;

    this.particleGeo = new THREE.BoxGeometry(0.036, 0.036, 0.11);
    this.particleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.94,
    });
    this.particleInstancedMesh = new THREE.InstancedMesh(
      this.particleGeo,
      this.particleMat,
      maxParticles
    );
    this.particleInstancedMesh.frustumCulled = false;
    this.particleInstancedMesh.count = this.activeParticleLimit;

    this.dustGeo = new THREE.DodecahedronGeometry(0.11, 0);
    this.dustMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    });
    this.dustInstancedMesh = new THREE.InstancedMesh(
      this.dustGeo,
      this.dustMat,
      maxDustPuffs
    );
    this.dustInstancedMesh.frustumCulled = false;
    this.dustInstancedMesh.count = this.activeDustLimit;

    for (let i = 0; i < maxParticles; i++) {
      this.particleInstancedMesh.setMatrixAt(i, _hiddenMat);
      this.particleInstancedMesh.setColorAt(i, _color.setHex(0xfbbf24));
      this.particles.push({
        active: false,
        ageMs: 0,
        maxAgeMs: 320,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        gravity: 14,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      });
    }
    this.particleInstancedMesh.instanceMatrix.needsUpdate = true;
    if (this.particleInstancedMesh.instanceColor) {
      this.particleInstancedMesh.instanceColor.needsUpdate = true;
    }

    for (let i = 0; i < maxDustPuffs; i++) {
      this.dustInstancedMesh.setMatrixAt(i, _hiddenMat);
      this.dustInstancedMesh.setColorAt(i, _color.setHex(0xcbd5e1));
      this.dustPuffs.push({
        active: false,
        ageMs: 0,
        maxAgeMs: 380,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        startScale: 0.4,
        endScale: 1.5,
      });
    }
    this.dustInstancedMesh.instanceMatrix.needsUpdate = true;
    if (this.dustInstancedMesh.instanceColor) {
      this.dustInstancedMesh.instanceColor.needsUpdate = true;
    }

    parentGroup.add(this.particleInstancedMesh);
    parentGroup.add(this.dustInstancedMesh);
  }

  public applyQualityConfig(config: ImpactQualityConfig): void {
    const newParticleLimit = Math.min(this.maxParticles, config.maxActiveParticles);
    for (let i = newParticleLimit; i < this.activeParticleLimit; i++) {
      this.particles[i].active = false;
      this.particleInstancedMesh.setMatrixAt(i, _hiddenMat);
    }
    this.activeParticleLimit = newParticleLimit;
    this.particleInstancedMesh.count = this.activeParticleLimit;
    this.particleInstancedMesh.instanceMatrix.needsUpdate = true;

    const newDustLimit = Math.min(this.maxDustPuffs, config.maxActiveDustPuffs);
    for (let i = newDustLimit; i < this.activeDustLimit; i++) {
      this.dustPuffs[i].active = false;
      this.dustInstancedMesh.setMatrixAt(i, _hiddenMat);
    }
    this.activeDustLimit = newDustLimit;
    this.dustInstancedMesh.count = this.activeDustLimit;
    this.dustInstancedMesh.instanceMatrix.needsUpdate = true;

    this.budgetScale = config.particleBudgetScale;
  }

  public getActiveParticleCount(): number {
    let count = 0;
    for (let i = 0; i < this.activeParticleLimit; i++) {
      if (this.particles[i].active) count++;
    }
    return count;
  }

  public getActiveDustCount(): number {
    let count = 0;
    for (let i = 0; i < this.activeDustLimit; i++) {
      if (this.dustPuffs[i].active) count++;
    }
    return count;
  }

  /**
   * Spawns material-appropriate secondary sparks, splinters, stone chips, glass shards,
   * and optional short-lived dust puff for an impact.
   */
  public spawnImpactSecondaryEffects(
    seed: number,
    weaponId: WeaponId,
    materialType: ImpactMaterialType,
    angleResult: ImpactAngleResult
  ): void {
    if (this.activeParticleLimit <= 0) return;

    const rng = createSeededRandom(seed ^ 0x9e3779b9);
    const weaponProfile =
      WEAPON_IMPACT_PROFILES[weaponId] || WEAPON_IMPACT_PROFILES.m4a1;
    const matProfile = getImpactMaterialProfile(materialType);

    const rawCount = Math.round(
      weaponProfile.sparkCount * matProfile.debrisScale * this.budgetScale * 0.65
    );
    const totalCount = Math.max(2, Math.min(14, rawCount));

    const px = angleResult.clampedPoint.x + angleResult.normal.x * 0.03;
    const py = angleResult.clampedPoint.y + angleResult.normal.y * 0.03;
    const pz = angleResult.clampedPoint.z + angleResult.normal.z * 0.03;

    // Blend between outward normal and grazing specular reflection
    const dirBias = angleResult.regime === 'grazing' ? 0.85 : 0.55;
    const ejX =
      angleResult.normal.x * (1 - dirBias) + angleResult.reflection.x * dirBias;
    const ejY =
      angleResult.normal.y * (1 - dirBias) + angleResult.reflection.y * dirBias;
    const ejZ =
      angleResult.normal.z * (1 - dirBias) + angleResult.reflection.z * dirBias;

    for (let i = 0; i < totalCount; i++) {
      const idx = this.particleCursor % this.activeParticleLimit;
      this.particleCursor = (this.particleCursor + 1) % this.activeParticleLimit;
      const p = this.particles[idx];

      const isSpark =
        rng() < matProfile.sparkRatio ||
        (angleResult.ricochetEligible && i % 2 === 0);

      p.active = true;
      p.ageMs = 0;
      p.maxAgeMs = isSpark ? 180 + rng() * 190 : 250 + rng() * 240;
      p.x = px;
      p.y = py;
      p.z = pz;

      const speed =
        (isSpark ? 5.5 + rng() * 8.5 : 2.8 + rng() * 4.8) *
        (0.85 + weaponProfile.craterDepthFactor * 0.35);

      p.vx = (ejX * 0.82 + (rng() - 0.5) * 0.95) * speed;
      p.vy = (ejY * 0.82 + rng() * 0.75) * speed;
      p.vz = (ejZ * 0.82 + (rng() - 0.5) * 0.95) * speed;
      p.gravity = isSpark ? 9.5 : 16.5;

      if (materialType === 'wood') {
        // Long thin wooden splinters
        p.scaleX = 0.55;
        p.scaleY = 0.45;
        p.scaleZ = 1.65 + rng() * 0.9;
      } else if (isSpark) {
        // High-velocity incandescent streak
        p.scaleX = 0.48;
        p.scaleY = 0.48;
        p.scaleZ = 1.45 + rng() * 0.85;
      } else {
        // Chunky stone/concrete/ceramic/glass fragment
        const chunkScale = 0.72 + rng() * 0.55;
        p.scaleX = chunkScale;
        p.scaleY = chunkScale;
        p.scaleZ = chunkScale * 0.85;
      }

      _color.setHex(isSpark ? matProfile.sparkColorHex : matProfile.debrisColorHex);
      this.particleInstancedMesh.setColorAt(idx, _color);
    }

    if (this.particleInstancedMesh.instanceColor) {
      this.particleInstancedMesh.instanceColor.needsUpdate = true;
    }

    // Spawn short-lived dust puff for concrete, stone, gravel, wood, or tile
    if (
      this.activeDustLimit > 0 &&
      materialType !== 'metal' &&
      materialType !== 'glass'
    ) {
      const dIdx = this.dustCursor % this.activeDustLimit;
      this.dustCursor = (this.dustCursor + 1) % this.activeDustLimit;
      const d = this.dustPuffs[dIdx];
      d.active = true;
      d.ageMs = 0;
      d.maxAgeMs = 310 + rng() * 140;
      d.x = px;
      d.y = py;
      d.z = pz;
      d.vx = angleResult.normal.x * 0.65 + (rng() - 0.5) * 0.35;
      d.vy = Math.max(0.25, angleResult.normal.y * 0.55 + 0.38);
      d.vz = angleResult.normal.z * 0.65 + (rng() - 0.5) * 0.35;
      d.startScale = Math.max(0.32, angleResult.scaleB * 1.4);
      d.endScale = Math.max(0.95, angleResult.scaleB * 4.5);

      _color.setHex(matProfile.dustColorHex);
      this.dustInstancedMesh.setColorAt(dIdx, _color);
      if (this.dustInstancedMesh.instanceColor) {
        this.dustInstancedMesh.instanceColor.needsUpdate = true;
      }
    }
  }

  public update(dtSeconds: number): void {
    const dtMs = dtSeconds * 1000;
    let particlesDirty = false;
    let dustDirty = false;

    for (let i = 0; i < this.activeParticleLimit; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      particlesDirty = true;

      p.ageMs += dtMs;
      if (p.ageMs >= p.maxAgeMs) {
        p.active = false;
        this.particleInstancedMesh.setMatrixAt(i, _hiddenMat);
        continue;
      }

      const lifeRatio = 1.0 - p.ageMs / p.maxAgeMs;
      p.vy -= p.gravity * dtSeconds;
      p.x += p.vx * dtSeconds;
      p.y += p.vy * dtSeconds;
      p.z += p.vz * dtSeconds;

      if (p.y < 0.025) {
        p.y = 0.025;
        p.vy = Math.abs(p.vy) * 0.36;
        p.vx *= 0.72;
        p.vz *= 0.72;
      }

      _posVec.set(p.x, p.y, p.z);
      _targetVec.set(p.x + p.vx, p.y + p.vy, p.z + p.vz);
      _lookMat.lookAt(_posVec, _targetVec, _upVec);
      _quat.setFromRotationMatrix(_lookMat);

      const shrink = 0.35 + lifeRatio * 0.65;
      _scaleVec.set(p.scaleX * shrink, p.scaleY * shrink, p.scaleZ * shrink);
      _instanceMat.compose(_posVec, _quat, _scaleVec);
      this.particleInstancedMesh.setMatrixAt(i, _instanceMat);
    }

    if (particlesDirty) {
      this.particleInstancedMesh.instanceMatrix.needsUpdate = true;
    }

    for (let i = 0; i < this.activeDustLimit; i++) {
      const d = this.dustPuffs[i];
      if (!d.active) continue;
      dustDirty = true;

      d.ageMs += dtMs;
      if (d.ageMs >= d.maxAgeMs) {
        d.active = false;
        this.dustInstancedMesh.setMatrixAt(i, _hiddenMat);
        continue;
      }

      const t = d.ageMs / d.maxAgeMs;
      const drag = Math.exp(-3.2 * dtSeconds);
      d.vx *= drag;
      d.vz *= drag;
      d.x += d.vx * dtSeconds;
      d.y += d.vy * dtSeconds;
      d.z += d.vz * dtSeconds;

      const scale =
        THREE.MathUtils.lerp(d.startScale, d.endScale, 1 - (1 - t) * (1 - t)) *
        (1.0 - t * 0.55);
      _posVec.set(d.x, d.y, d.z);
      _quat.identity();
      _scaleVec.setScalar(Math.max(0.01, scale));
      _instanceMat.compose(_posVec, _quat, _scaleVec);
      this.dustInstancedMesh.setMatrixAt(i, _instanceMat);
    }

    if (dustDirty) {
      this.dustInstancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public clearAll(): void {
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles[i].active = false;
      this.particleInstancedMesh.setMatrixAt(i, _hiddenMat);
    }
    for (let i = 0; i < this.maxDustPuffs; i++) {
      this.dustPuffs[i].active = false;
      this.dustInstancedMesh.setMatrixAt(i, _hiddenMat);
    }
    this.particleInstancedMesh.instanceMatrix.needsUpdate = true;
    this.dustInstancedMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.particleInstancedMesh.removeFromParent();
    this.dustInstancedMesh.removeFromParent();
    this.particleGeo.dispose();
    this.particleMat.dispose();
    this.dustGeo.dispose();
    this.dustMat.dispose();
  }
}
