import * as THREE from 'three';
import { getImpactMaterialProfile } from './ImpactMaterialProfiles.ts';
import { createProceduralImpactShaderMaterial } from './ImpactShader.ts';
import type {
  ImpactAngleResult,
  ImpactInstanceMetadata,
  ImpactMaterialType,
  ImpactQualityConfig,
  ProceduralMarkDescriptor,
} from './impact.types.ts';
import type { WeaponId } from '../config.ts';

// Module-scope reusable math objects for zero-GC per-impact & per-frame updates
const _tangentVec = new THREE.Vector3();
const _bitangentVec = new THREE.Vector3();
const _normalVec = new THREE.Vector3();
const _basisMat = new THREE.Matrix4();
const _posVec = new THREE.Vector3();
const _scaleVec = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _instanceMat = new THREE.Matrix4();
const _hiddenMat = new THREE.Matrix4().makeScale(0, 0, 0);
const _coreColor = new THREE.Color();
const _rimColor = new THREE.Color();

function markBufferSubRangeDirty(
  attr: THREE.InstancedBufferAttribute | THREE.BufferAttribute,
  offset: number,
  count: number
): void {
  if (typeof attr.addUpdateRange === 'function') {
    attr.addUpdateRange(offset, count);
  }
  attr.needsUpdate = true;
}

/**
 * Manages the batched `THREE.InstancedMesh` for procedural surface marks and an optional
 * bounded `THREE.InstancedMesh` for close-up 3D localized crater/dent detail collars.
 */
export class ImpactInstancePool {
  public readonly maxCapacity: number;
  public readonly maxDetailCapacity: number;
  public readonly instancedMesh: THREE.InstancedMesh;
  public readonly detailInstancedMesh: THREE.InstancedMesh;
  public readonly shaderMaterial: THREE.ShaderMaterial;

  private readonly planeGeometry: THREE.PlaneGeometry;
  private readonly detailGeometry: THREE.TorusGeometry;
  private readonly detailMaterial: THREE.MeshStandardMaterial;

  private readonly params0Array: Float32Array;
  private readonly params1Array: Float32Array;
  private readonly colorCoreArray: Float32Array;
  private readonly colorRimArray: Float32Array;
  private readonly metaArray: Float32Array;

  private readonly params0Attr: THREE.InstancedBufferAttribute;
  private readonly params1Attr: THREE.InstancedBufferAttribute;
  private readonly colorCoreAttr: THREE.InstancedBufferAttribute;
  private readonly colorRimAttr: THREE.InstancedBufferAttribute;
  private readonly metaAttr: THREE.InstancedBufferAttribute;

  private readonly slots: ImpactInstanceMetadata[] = [];
  private readonly detailSlotOwners: number[];
  private detailCursor = 0;
  private activeLimit: number;
  private detailLimit: number;
  private enableDetailGeometry: boolean;

  constructor(
    parentGroup: THREE.Object3D,
    maxCapacity = 192,
    maxDetailCapacity = 18,
    initialQuality?: ImpactQualityConfig
  ) {
    this.maxCapacity = maxCapacity;
    this.maxDetailCapacity = maxDetailCapacity;
    this.activeLimit = initialQuality ? Math.min(maxCapacity, initialQuality.maxActiveMarks) : maxCapacity;
    this.detailLimit = initialQuality
      ? Math.min(maxDetailCapacity, initialQuality.maxDetailMeshes)
      : maxDetailCapacity;
    this.enableDetailGeometry = initialQuality ? initialQuality.enableDetailGeometry : true;

    // 1. Shared 1m x 1m PlaneGeometry + Shared Procedural GLSL ShaderMaterial
    this.planeGeometry = new THREE.PlaneGeometry(1, 1);
    this.shaderMaterial = createProceduralImpactShaderMaterial(
      initialQuality?.lodNearDist ?? 14.0,
      initialQuality?.lodFarDist ?? 55.0,
      initialQuality?.shaderDetailLevel ?? 2
    );

    this.params0Array = new Float32Array(maxCapacity * 4);
    this.params1Array = new Float32Array(maxCapacity * 4);
    this.colorCoreArray = new Float32Array(maxCapacity * 3);
    this.colorRimArray = new Float32Array(maxCapacity * 3);
    this.metaArray = new Float32Array(maxCapacity * 4);

    this.params0Attr = new THREE.InstancedBufferAttribute(this.params0Array, 4);
    this.params1Attr = new THREE.InstancedBufferAttribute(this.params1Array, 4);
    this.colorCoreAttr = new THREE.InstancedBufferAttribute(this.colorCoreArray, 3);
    this.colorRimAttr = new THREE.InstancedBufferAttribute(this.colorRimArray, 3);
    this.metaAttr = new THREE.InstancedBufferAttribute(this.metaArray, 4);

    this.params0Attr.setUsage(THREE.DynamicDrawUsage);
    this.params1Attr.setUsage(THREE.DynamicDrawUsage);
    this.colorCoreAttr.setUsage(THREE.DynamicDrawUsage);
    this.colorRimAttr.setUsage(THREE.DynamicDrawUsage);
    this.metaAttr.setUsage(THREE.DynamicDrawUsage);

    this.planeGeometry.setAttribute('aImpactParams0', this.params0Attr);
    this.planeGeometry.setAttribute('aImpactParams1', this.params1Attr);
    this.planeGeometry.setAttribute('aImpactColorCore', this.colorCoreAttr);
    this.planeGeometry.setAttribute('aImpactColorRim', this.colorRimAttr);
    this.planeGeometry.setAttribute('aImpactMeta', this.metaAttr);

    this.instancedMesh = new THREE.InstancedMesh(
      this.planeGeometry,
      this.shaderMaterial,
      maxCapacity
    );
    this.instancedMesh.frustumCulled = false;
    this.instancedMesh.renderOrder = 2;
    this.instancedMesh.count = this.activeLimit;

    // 2. Optional 3D Localized Detail Collar Geometry (for close-up metal dents & heavy concrete spall rims)
    this.detailGeometry = new THREE.TorusGeometry(0.22, 0.038, 6, 14);
    this.detailMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.45,
      metalness: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    this.detailInstancedMesh = new THREE.InstancedMesh(
      this.detailGeometry,
      this.detailMaterial,
      maxDetailCapacity
    );
    this.detailInstancedMesh.frustumCulled = false;
    this.detailInstancedMesh.castShadow = false;
    this.detailInstancedMesh.receiveShadow = false;
    this.detailInstancedMesh.count = this.enableDetailGeometry ? this.detailLimit : 0;
    this.detailSlotOwners = new Array<number>(maxDetailCapacity).fill(-1);

    for (let i = 0; i < maxCapacity; i++) {
      this.instancedMesh.setMatrixAt(i, _hiddenMat);
      this.slots.push({
        slotIndex: i,
        active: false,
        createdAtMs: 0,
        ageMs: 0,
        maxAgeMs: initialQuality?.maxMarkAgeMs ?? 90000,
        x: 0,
        y: 0,
        z: 0,
        nx: 0,
        ny: 1,
        nz: 0,
        tx: 1,
        ty: 0,
        tz: 0,
        bx: 0,
        by: 0,
        bz: 1,
        scaleT: 0.16,
        scaleB: 0.16,
        seed: 1,
        materialType: 'concrete',
        weaponId: 'm4a1',
        shapeFamily: 0,
        incidenceDeg: 0,
        elongation: 1,
        asymmetry: 0,
        grazingRatio: 0,
        regime: 'perpendicular',
        localOverlapCount: 0,
        accumulationBoost: 0,
        priorityScore: 0,
        detailSlotIndex: -1,
        surfaceId: null,
      });
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < maxDetailCapacity; i++) {
      this.detailInstancedMesh.setMatrixAt(i, _hiddenMat);
      this.detailInstancedMesh.setColorAt(i, _rimColor.setHex(0x94a3b8));
    }
    this.detailInstancedMesh.instanceMatrix.needsUpdate = true;
    if (this.detailInstancedMesh.instanceColor) {
      this.detailInstancedMesh.instanceColor.needsUpdate = true;
    }

    parentGroup.add(this.instancedMesh);
    parentGroup.add(this.detailInstancedMesh);
  }

  public getSlots(): readonly ImpactInstanceMetadata[] {
    return this.slots;
  }

  public getActiveLimit(): number {
    return this.activeLimit;
  }

  public getActiveCount(): number {
    let count = 0;
    for (let i = 0; i < this.activeLimit; i++) {
      if (this.slots[i].active) count++;
    }
    return count;
  }

  public getActiveDetailCount(): number {
    if (!this.enableDetailGeometry) return 0;
    let count = 0;
    for (let i = 0; i < this.detailLimit; i++) {
      if (this.detailSlotOwners[i] >= 0) count++;
    }
    return count;
  }

  public applyQualityConfig(config: ImpactQualityConfig): void {
    const newLimit = Math.min(this.maxCapacity, config.maxActiveMarks);
    if (newLimit < this.activeLimit) {
      for (let i = newLimit; i < this.activeLimit; i++) {
        this.deactivateSlot(i);
      }
    }
    this.activeLimit = newLimit;
    this.instancedMesh.count = this.activeLimit;

    this.enableDetailGeometry = config.enableDetailGeometry;
    this.detailLimit = Math.min(this.maxDetailCapacity, config.maxDetailMeshes);
    this.detailInstancedMesh.count = this.enableDetailGeometry ? this.detailLimit : 0;

    this.shaderMaterial.uniforms.uLodNear.value = config.lodNearDist;
    this.shaderMaterial.uniforms.uLodFar.value = config.lodFarDist;
    this.shaderMaterial.uniforms.uDetailLevel.value = config.shaderDetailLevel;
  }

  /**
   * Writes an impact mark into `slotIndex` and uploads only the affected buffer range.
   */
  public writeImpactToSlot(
    slotIndex: number,
    nowMs: number,
    maxAgeMs: number,
    weaponId: WeaponId,
    materialType: ImpactMaterialType,
    angleResult: ImpactAngleResult,
    descriptor: ProceduralMarkDescriptor,
    spawnDetailCollar: boolean
  ): ImpactInstanceMetadata {
    const slot = this.slots[slotIndex];
    if (slot.detailSlotIndex >= 0) {
      this.releaseDetailSlot(slot.detailSlotIndex);
      slot.detailSlotIndex = -1;
    }

    const matProfile = getImpactMaterialProfile(materialType);

    slot.active = true;
    slot.createdAtMs = nowMs;
    slot.ageMs = 0;
    slot.maxAgeMs = maxAgeMs;
    slot.x = angleResult.clampedPoint.x;
    slot.y = angleResult.clampedPoint.y;
    slot.z = angleResult.clampedPoint.z;
    slot.nx = angleResult.normal.x;
    slot.ny = angleResult.normal.y;
    slot.nz = angleResult.normal.z;
    slot.tx = angleResult.tangent.x;
    slot.ty = angleResult.tangent.y;
    slot.tz = angleResult.tangent.z;
    slot.bx = angleResult.bitangent.x;
    slot.by = angleResult.bitangent.y;
    slot.bz = angleResult.bitangent.z;
    slot.scaleT = angleResult.scaleT;
    slot.scaleB = angleResult.scaleB;
    slot.seed = descriptor.seed;
    slot.materialType = materialType;
    slot.weaponId = weaponId;
    slot.shapeFamily = descriptor.shapeFamily;
    slot.incidenceDeg = angleResult.incidenceDeg;
    slot.elongation = angleResult.elongation;
    slot.asymmetry = angleResult.asymmetry;
    slot.grazingRatio = angleResult.grazingRatio;
    slot.regime = angleResult.regime;
    slot.localOverlapCount = descriptor.localOverlapCount;
    slot.accumulationBoost = descriptor.accumulationBoost;
    slot.surfaceId = angleResult.surfaceId;

    // Tiny deterministic normal offset jitter [0..0.0025m] so overlapping marks never Z-fight against each other
    const microOffset = ((slotIndex % 11) * 0.00022);
    _posVec.set(
      slot.x + slot.nx * microOffset,
      slot.y + slot.ny * microOffset,
      slot.z + slot.nz * microOffset
    );
    _tangentVec.set(slot.tx, slot.ty, slot.tz).normalize();
    _bitangentVec.set(slot.bx, slot.by, slot.bz).normalize();
    _normalVec.set(slot.nx, slot.ny, slot.nz).normalize();

    _basisMat.makeBasis(_tangentVec, _bitangentVec, _normalVec);
    _quat.setFromRotationMatrix(_basisMat);
    _scaleVec.set(slot.scaleT, slot.scaleB, 1.0);
    _instanceMat.compose(_posVec, _quat, _scaleVec);

    this.instancedMesh.setMatrixAt(slotIndex, _instanceMat);
    markBufferSubRangeDirty(this.instancedMesh.instanceMatrix, slotIndex * 16, 16);

    const i4 = slotIndex * 4;
    const i3 = slotIndex * 3;

    // Compress seed into [0.1 .. 999.9] float range for highp GLSL trig precision
    const floatSeed = ((descriptor.seed % 99991) / 100.0) + 0.13;
    const packedShapeAndRot =
      descriptor.shapeFamily +
      Math.min(0.98, Math.max(0.01, descriptor.rotationOffsetRad / 62.8318));

    this.params0Array[i4 + 0] = floatSeed;
    this.params0Array[i4 + 1] = packedShapeAndRot;
    this.params0Array[i4 + 2] = descriptor.aspectRatio;
    this.params0Array[i4 + 3] = angleResult.asymmetry;

    this.params1Array[i4 + 0] = descriptor.holeRadiusRatio;
    this.params1Array[i4 + 1] = descriptor.contourIrregularity;
    this.params1Array[i4 + 2] = descriptor.crackLengthRatio;
    this.params1Array[i4 + 3] = descriptor.scorchIntensity;

    _coreColor.setHex(matProfile.coreColorHex);
    _rimColor.setHex(matProfile.rimHighlightHex);

    this.colorCoreArray[i3 + 0] = _coreColor.r;
    this.colorCoreArray[i3 + 1] = _coreColor.g;
    this.colorCoreArray[i3 + 2] = _coreColor.b;

    this.colorRimArray[i3 + 0] = _rimColor.r;
    this.colorRimArray[i3 + 1] = _rimColor.g;
    this.colorRimArray[i3 + 2] = _rimColor.b;

    this.metaArray[i4 + 0] = descriptor.shaderMaterialCode;
    this.metaArray[i4 + 1] = 1.0; // full opacity
    this.metaArray[i4 + 2] = descriptor.crackCount;
    this.metaArray[i4 + 3] = descriptor.accumulationBoost;

    markBufferSubRangeDirty(this.params0Attr, i4, 4);
    markBufferSubRangeDirty(this.params1Attr, i4, 4);
    markBufferSubRangeDirty(this.colorCoreAttr, i3, 3);
    markBufferSubRangeDirty(this.colorRimAttr, i3, 3);
    markBufferSubRangeDirty(this.metaAttr, i4, 4);

    // Optional 3D localized detail collar for close-up metal/concrete/stone impacts
    if (
      this.enableDetailGeometry &&
      this.detailLimit > 0 &&
      spawnDetailCollar &&
      matProfile.allowDetailGeometry
    ) {
      this.allocateDetailCollar(slot, matProfile.spallColorHex);
    }

    return slot;
  }

  private allocateDetailCollar(slot: ImpactInstanceMetadata, colorHex: number): void {
    const dIdx = this.detailCursor % Math.max(1, this.detailLimit);
    this.detailCursor = (this.detailCursor + 1) % Math.max(1, this.detailLimit);

    const prevOwner = this.detailSlotOwners[dIdx];
    if (prevOwner >= 0 && prevOwner < this.slots.length) {
      this.slots[prevOwner].detailSlotIndex = -1;
    }

    this.detailSlotOwners[dIdx] = slot.slotIndex;
    slot.detailSlotIndex = dIdx;

    _posVec.set(
      slot.x + slot.nx * 0.004,
      slot.y + slot.ny * 0.004,
      slot.z + slot.nz * 0.004
    );
    _tangentVec.set(slot.tx, slot.ty, slot.tz).normalize();
    _bitangentVec.set(slot.bx, slot.by, slot.bz).normalize();
    _normalVec.set(slot.nx, slot.ny, slot.nz).normalize();
    _basisMat.makeBasis(_tangentVec, _bitangentVec, _normalVec);
    _quat.setFromRotationMatrix(_basisMat);

    const collarScale = Math.min(slot.scaleT, slot.scaleB) * 0.72;
    _scaleVec.set(
      collarScale * Math.min(1.6, slot.elongation * 0.85),
      collarScale,
      collarScale * 0.42
    );
    _instanceMat.compose(_posVec, _quat, _scaleVec);

    this.detailInstancedMesh.setMatrixAt(dIdx, _instanceMat);
    _rimColor.setHex(colorHex);
    this.detailInstancedMesh.setColorAt(dIdx, _rimColor);
    markBufferSubRangeDirty(this.detailInstancedMesh.instanceMatrix, dIdx * 16, 16);
    if (this.detailInstancedMesh.instanceColor) {
      this.detailInstancedMesh.instanceColor.needsUpdate = true;
    }
  }

  private releaseDetailSlot(detailIdx: number): void {
    if (detailIdx < 0 || detailIdx >= this.maxDetailCapacity) return;
    this.detailSlotOwners[detailIdx] = -1;
    this.detailInstancedMesh.setMatrixAt(detailIdx, _hiddenMat);
    markBufferSubRangeDirty(this.detailInstancedMesh.instanceMatrix, detailIdx * 16, 16);
  }

  public deactivateSlot(slotIndex: number): void {
    const slot = this.slots[slotIndex];
    if (!slot || !slot.active) return;
    slot.active = false;
    if (slot.detailSlotIndex >= 0) {
      this.releaseDetailSlot(slot.detailSlotIndex);
      slot.detailSlotIndex = -1;
    }
    this.instancedMesh.setMatrixAt(slotIndex, _hiddenMat);
    this.metaArray[slotIndex * 4 + 1] = 0;
    markBufferSubRangeDirty(this.instancedMesh.instanceMatrix, slotIndex * 16, 16);
    markBufferSubRangeDirty(this.metaAttr, slotIndex * 4, 4);
  }

  /**
   * Per-frame time & LOD update: ages active marks, smoothly fades out expiring marks,
   * and updates shader camera uniform. Zero heap allocations.
   */
  public update(dtSeconds: number, cameraPos: THREE.Vector3): void {
    const dtMs = dtSeconds * 1000;
    this.shaderMaterial.uniforms.uTime.value += dtSeconds;
    (this.shaderMaterial.uniforms.uCameraPos.value as THREE.Vector3).copy(cameraPos);

    let metaDirty = false;
    for (let i = 0; i < this.activeLimit; i++) {
      const slot = this.slots[i];
      if (!slot.active) continue;

      slot.ageMs += dtMs;
      if (slot.ageMs >= slot.maxAgeMs) {
        this.deactivateSlot(i);
        continue;
      }

      // Smooth fade-out during the final 15% of lifetime
      const lifeRatio = slot.ageMs / slot.maxAgeMs;
      if (lifeRatio > 0.85) {
        const fade = Math.max(0, 1.0 - (lifeRatio - 0.85) / 0.15);
        this.metaArray[i * 4 + 1] = fade;
        metaDirty = true;
      } else if (this.metaArray[i * 4 + 3] !== slot.accumulationBoost) {
        // Sync updated accumulation boost if nearby subsequent hits overlapped this mark
        this.metaArray[i * 4 + 3] = slot.accumulationBoost;
        metaDirty = true;
      }
    }

    if (metaDirty) {
      this.metaAttr.needsUpdate = true;
    }
  }

  public clearAll(): void {
    for (let i = 0; i < this.maxCapacity; i++) {
      const slot = this.slots[i];
      slot.active = false;
      slot.detailSlotIndex = -1;
      slot.localOverlapCount = 0;
      slot.accumulationBoost = 0;
      this.instancedMesh.setMatrixAt(i, _hiddenMat);
      this.metaArray[i * 4 + 1] = 0;
    }
    for (let i = 0; i < this.maxDetailCapacity; i++) {
      this.detailSlotOwners[i] = -1;
      this.detailInstancedMesh.setMatrixAt(i, _hiddenMat);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.detailInstancedMesh.instanceMatrix.needsUpdate = true;
    this.metaAttr.needsUpdate = true;
  }

  public dispose(): void {
    this.instancedMesh.removeFromParent();
    this.detailInstancedMesh.removeFromParent();
    this.planeGeometry.dispose();
    this.detailGeometry.dispose();
    this.shaderMaterial.dispose();
    this.detailMaterial.dispose();
  }
}
