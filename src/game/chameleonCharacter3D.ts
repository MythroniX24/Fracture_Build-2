import * as THREE from 'three';
import {
  CHARACTER_ROSTER,
  type BodyRegionId,
  type CharacterPoseId,
  type EquipmentSlotId,
  mapLocalUvToRegionAtlas,
} from './characterSystem.ts';
import type { CharacterId, WeaponId } from './config.ts';
import type { EnemyBotState } from './rules.ts';
import {
  PAINT_ATLAS_SIZE,
  buildEnemyFactionPaintBuffer,
  compositePaintLayersToBuffer,
  type PaintLayer,
} from './paintSystem.ts';
import {
  buildDetailedWeaponViewModel,
  type WeaponViewModelRig,
} from './weaponVisuals3D.ts';

export interface ChameleonHumanoidRig {
  characterId: CharacterId;
  root: THREE.Group;
  bodyPivot: THREE.Group;
  hipsPivot: THREE.Group;
  torsoPivot: THREE.Group;
  neckPivot: THREE.Group;
  headPivot: THREE.Group;
  leftShoulderPivot: THREE.Group;
  leftElbowPivot: THREE.Group;
  leftHandPivot: THREE.Group;
  rightShoulderPivot: THREE.Group;
  rightElbowPivot: THREE.Group;
  rightHandPivot: THREE.Group;
  leftHipPivot: THREE.Group;
  leftKneePivot: THREE.Group;
  rightHipPivot: THREE.Group;
  rightKneePivot: THREE.Group;
  weaponMount: THREE.Group;
  paintableMeshes: THREE.Mesh[];
  regionMeshes: Record<BodyRegionId, THREE.Mesh[]>;
  equipmentGroups: Record<EquipmentSlotId, THREE.Group>;
  paintMaterial: THREE.MeshStandardMaterial;
  paintCanvas: HTMLCanvasElement;
  paintTexture: THREE.CanvasTexture;
  regionHighlightOutline: THREE.Mesh;
  dispose: () => void;
}

/**
 * Clones a BufferGeometry and remaps its [0..1] UVs into the dedicated non-overlapping
 * UV island rectangle for `regionId` so painting on this mesh updates only that region.
 */
function createAtlasMappedGeometry(
  baseGeo: THREE.BufferGeometry,
  regionId: BodyRegionId,
  uSubRange?: [number, number]
): THREE.BufferGeometry {
  const geo = baseGeo.clone();
  const uvAttr = geo.attributes.uv;
  if (uvAttr) {
    for (let i = 0; i < uvAttr.count; i++) {
      let u = uvAttr.getX(i);
      const v = uvAttr.getY(i);
      if (uSubRange) {
        u = uSubRange[0] + u * (uSubRange[1] - uSubRange[0]);
      }
      const mapped = mapLocalUvToRegionAtlas(u, v, regionId);
      uvAttr.setXY(i, mapped.u, mapped.v);
    }
    uvAttr.needsUpdate = true;
  }
  return geo;
}

/**
 * Builds a pure-white, faceless, smooth-faceted low-poly 3D humanoid character
 * matching the reference silhouette with 15 independently UV-mapped paintable body regions,
 * articulated joints, and optional removable gear.
 */
export function buildChameleonHumanoidRig(
  characterId: CharacterId,
  maxAnisotropy = 4
): ChameleonHumanoidRig {
  const charDef = CHARACTER_ROSTER[characterId] || CHARACTER_ROSTER.volt;
  const prop = charDef.proportions;

  // 1. Dedicated 512x512 Paint Canvas & CanvasTexture initialized to Pure White (#ffffff)
  const paintCanvas =
    typeof document !== 'undefined'
      ? document.createElement('canvas')
      : ({
          width: PAINT_ATLAS_SIZE,
          height: PAINT_ATLAS_SIZE,
          getContext: () => null,
        } as unknown as HTMLCanvasElement);
  paintCanvas.width = PAINT_ATLAS_SIZE;
  paintCanvas.height = PAINT_ATLAS_SIZE;
  const ctx = paintCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAINT_ATLAS_SIZE, PAINT_ATLAS_SIZE);
  }

  const paintTexture = new THREE.CanvasTexture(paintCanvas);
  paintTexture.colorSpace = THREE.SRGBColorSpace;
  paintTexture.anisotropy = maxAnisotropy;
  paintTexture.needsUpdate = true;

  // Pure-white matte-satin low-poly material so faceted shading and custom paint look crisp
  const paintMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: paintTexture,
    roughness: 0.56,
    metalness: 0.04,
    flatShading: true,
  });

  const equipPrimaryMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.55,
  });

  const equipAccentMat = new THREE.MeshStandardMaterial({
    color: charDef.accentTrimHex,
    roughness: 0.28,
    metalness: 0.45,
  });

  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  bodyPivot.scale.setScalar(prop.heightScale);
  root.add(bodyPivot);

  const paintableMeshes: THREE.Mesh[] = [];
  const regionMeshes: Record<BodyRegionId, THREE.Mesh[]> = {
    head: [],
    neck: [],
    chest: [],
    back: [],
    pelvis: [],
    leftUpperArm: [],
    rightUpperArm: [],
    leftForearm: [],
    rightForearm: [],
    hands: [],
    leftThigh: [],
    rightThigh: [],
    leftLowerLeg: [],
    rightLowerLeg: [],
    feet: [],
  };

  const registerPaintableMesh = (
    geo: THREE.BufferGeometry,
    regionId: BodyRegionId,
    uSubRange?: [number, number]
  ): THREE.Mesh => {
    const mappedGeo = createAtlasMappedGeometry(geo, regionId, uSubRange);
    mappedGeo.computeVertexNormals();
    const mesh = new THREE.Mesh(mappedGeo, paintMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.paintable = true;
    mesh.userData.bodyRegion = regionId;
    paintableMeshes.push(mesh);
    regionMeshes[regionId].push(mesh);
    return mesh;
  };

  // ==========================================================================
  // 1. HIPS / PELVIS & UNIFIED LOW-POLY TORSO (Front Chest + Rear Back)
  // ==========================================================================
  const hipsPivot = new THREE.Group();
  hipsPivot.position.set(0, 0.90, 0);
  bodyPivot.add(hipsPivot);

  // Smooth low-poly pelvis/waist with fuller, stocky athletic proportions
  const pelvisMesh = registerPaintableMesh(
    new THREE.CylinderGeometry(
      0.196 * prop.torsoWidth,
      0.198 * prop.torsoWidth,
      0.22,
      12,
      2
    ),
    'pelvis'
  );
  pelvisMesh.scale.set(1.16, 1.0, 0.88);
  pelvisMesh.position.set(0, 0.0, 0);
  hipsPivot.add(pelvisMesh);

  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.09, 0);
  hipsPivot.add(torsoPivot);

  // Front Chest Half-Cylinder + Sloped Shoulder Collar (stockier, broader athletic build)
  const chestFrontGeo = new THREE.CylinderGeometry(
    0.232 * prop.torsoWidth,
    0.196 * prop.torsoWidth,
    0.46,
    12,
    4,
    false,
    -Math.PI * 0.5,
    Math.PI
  );
  const chestFrontMesh = registerPaintableMesh(chestFrontGeo, 'chest');
  chestFrontMesh.scale.set(1.16, 1.0, 0.88);
  chestFrontMesh.position.set(0, 0.225, 0);

  const chestTopDome = registerPaintableMesh(
    new THREE.CylinderGeometry(
      0.106 * prop.torsoWidth,
      0.232 * prop.torsoWidth,
      0.082,
      12,
      1,
      false,
      -Math.PI * 0.5,
      Math.PI
    ),
    'chest'
  );
  chestTopDome.scale.set(1.16, 1.0, 0.88);
  chestTopDome.position.set(0, 0.488, 0);
  torsoPivot.add(chestFrontMesh, chestTopDome);

  // Rear Back Half-Cylinder + Dorsal Shoulder Collar (mapped to 'back')
  const backRearGeo = new THREE.CylinderGeometry(
    0.232 * prop.torsoWidth,
    0.196 * prop.torsoWidth,
    0.46,
    12,
    4,
    false,
    Math.PI * 0.5,
    Math.PI
  );
  const backRearMesh = registerPaintableMesh(backRearGeo, 'back');
  backRearMesh.scale.set(1.16, 1.0, 0.88);
  backRearMesh.position.set(0, 0.225, 0);

  const backTopDome = registerPaintableMesh(
    new THREE.CylinderGeometry(
      0.106 * prop.torsoWidth,
      0.232 * prop.torsoWidth,
      0.082,
      12,
      1,
      false,
      Math.PI * 0.5,
      Math.PI
    ),
    'back'
  );
  backTopDome.scale.set(1.16, 1.0, 0.88);
  backTopDome.position.set(0, 0.488, 0);
  torsoPivot.add(backRearMesh, backTopDome);

  // ==========================================================================
  // 2. NECK & FACELESS LOW-POLY ROUNDED HEAD (Matching Reference Image)
  // ==========================================================================
  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 0.51, 0);
  torsoPivot.add(neckPivot);

  const neckMesh = registerPaintableMesh(
    new THREE.CylinderGeometry(0.084, 0.104, 0.12, 12, 2),
    'neck'
  );
  neckMesh.position.set(0, 0.04, 0);
  neckPivot.add(neckMesh);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.095, 0);
  neckPivot.add(headPivot);

  // Faceless low-poly rounded sphere cranium (no visor, no crest, crisp low-poly facets)
  const headCranium = registerPaintableMesh(
    new THREE.SphereGeometry(0.178 * prop.headScale, 12, 9),
    'head'
  );
  headCranium.scale.set(0.98, 1.06, 0.99);
  headCranium.position.set(0, 0.148 * prop.headScale, 0.0);
  headPivot.add(headCranium);

  // ==========================================================================
  // 3. LEFT & RIGHT ARMS (Stockier Flared Low-Poly Tubular Arms + Rounded Bulb Hands)
  // ==========================================================================
  const buildArmAssembly = (side: -1 | 1) => {
    const isLeft = side === -1;
    const upperReg: BodyRegionId = isLeft ? 'leftUpperArm' : 'rightUpperArm';
    const forearmReg: BodyRegionId = isLeft ? 'leftForearm' : 'rightForearm';
    const handSubRange: [number, number] = isLeft ? [0.02, 0.48] : [0.52, 0.98];

    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * (0.228 * prop.torsoWidth), 0.435, 0);
    torsoPivot.add(shoulderPivot);

    // Smoothly integrated shoulder socket cap
    const shoulderCap = registerPaintableMesh(
      new THREE.SphereGeometry(0.080 * prop.limbThickness, 10, 7),
      upperReg,
      [0.1, 0.9]
    );
    shoulderCap.position.set(0, -0.015, 0);
    shoulderPivot.add(shoulderCap);

    // Thicker upper arm cylinder flaring gently toward the elbow
    const upperArmMesh = registerPaintableMesh(
      new THREE.CylinderGeometry(
        0.076 * prop.limbThickness,
        0.092 * prop.limbThickness,
        0.26,
        12,
        3
      ),
      upperReg
    );
    upperArmMesh.position.set(0, -0.14, 0);
    shoulderPivot.add(upperArmMesh);

    // Seamless paintable elbow bridge
    const elbowBridge = registerPaintableMesh(
      new THREE.SphereGeometry(0.090 * prop.limbThickness, 10, 7),
      upperReg,
      [0.2, 0.8]
    );
    elbowBridge.position.set(0, -0.27, 0);
    shoulderPivot.add(elbowBridge);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.27, 0);
    shoulderPivot.add(elbowPivot);

    // Thicker forearm cylinder flaring wider toward the wrist/hand (signature silhouette feature)
    const forearmMesh = registerPaintableMesh(
      new THREE.CylinderGeometry(
        0.090 * prop.limbThickness,
        0.108 * prop.limbThickness,
        0.25,
        12,
        3
      ),
      forearmReg
    );
    forearmMesh.position.set(0, -0.125, 0);
    elbowPivot.add(forearmMesh);

    const handPivot = new THREE.Group();
    handPivot.position.set(0, -0.25, 0);
    elbowPivot.add(handPivot);

    // Smooth, stocky rounded low-poly bulb/mitten hand at the end of the flared forearm (NO individual fingers)
    const bulbHandMesh = registerPaintableMesh(
      new THREE.SphereGeometry(0.108 * prop.limbThickness, 10, 8),
      'hands',
      handSubRange
    );
    bulbHandMesh.scale.set(0.98, 1.14, 0.96);
    bulbHandMesh.position.set(0, -0.035, 0);
    handPivot.add(bulbHandMesh);

    return { shoulderPivot, elbowPivot, handPivot };
  };

  const leftArm = buildArmAssembly(-1);
  const rightArm = buildArmAssembly(1);

  const weaponMount = new THREE.Group();
  weaponMount.position.set(-0.185, 0.36, 0.48);
  torsoPivot.add(weaponMount);

  // ==========================================================================
  // 4. LEFT & RIGHT LEGS (Stocky Tubular Low-Poly Legs + Rounded Bulb Feet)
  // ==========================================================================
  const buildLegAssembly = (side: -1 | 1) => {
    const isLeft = side === -1;
    const thighReg: BodyRegionId = isLeft ? 'leftThigh' : 'rightThigh';
    const shinReg: BodyRegionId = isLeft ? 'leftLowerLeg' : 'rightLowerLeg';
    const footSubRange: [number, number] = isLeft ? [0.02, 0.48] : [0.52, 0.98];

    const hipPivot = new THREE.Group();
    hipPivot.position.set(side * 0.112 * prop.torsoWidth, -0.05, 0);
    hipsPivot.add(hipPivot);

    // Smooth hip socket cap integrated into pelvis
    const hipCap = registerPaintableMesh(
      new THREE.SphereGeometry(0.102 * prop.limbThickness, 10, 7),
      thighReg,
      [0.1, 0.9]
    );
    hipPivot.add(hipCap);

    // Thicker tubular upper leg / thigh
    const thighMesh = registerPaintableMesh(
      new THREE.CylinderGeometry(
        0.105 * prop.limbThickness,
        0.100 * prop.limbThickness,
        0.40,
        12,
        3
      ),
      thighReg
    );
    thighMesh.position.set(0, -0.20, 0);
    hipPivot.add(thighMesh);

    // Seamless paintable knee bridge
    const kneeBridge = registerPaintableMesh(
      new THREE.SphereGeometry(0.098 * prop.limbThickness, 10, 7),
      thighReg,
      [0.2, 0.8]
    );
    kneeBridge.position.set(0, -0.40, 0);
    hipPivot.add(kneeBridge);

    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.40, 0);
    hipPivot.add(kneePivot);

    // Thicker tubular lower leg / shin flaring slightly toward the rounded foot
    const shinMesh = registerPaintableMesh(
      new THREE.CylinderGeometry(
        0.098 * prop.limbThickness,
        0.105 * prop.limbThickness,
        0.39,
        12,
        3
      ),
      shinReg
    );
    shinMesh.position.set(0, -0.195, 0);
    kneePivot.add(shinMesh);

    // Smooth rounded low-poly bulb foot grounded cleanly at y = 0
    const footGroup = new THREE.Group();
    footGroup.position.set(0, -0.39, 0.015);
    kneePivot.add(footGroup);

    const bulbFootMesh = registerPaintableMesh(
      new THREE.SphereGeometry(0.108 * prop.limbThickness, 10, 8),
      'feet',
      footSubRange
    );
    bulbFootMesh.scale.set(1.02, 0.84, 1.18);
    bulbFootMesh.position.set(0, -0.005, 0.01);
    footGroup.add(bulbFootMesh);

    return { hipPivot, kneePivot };
  };

  const leftLeg = buildLegAssembly(-1);
  const rightLeg = buildLegAssembly(1);

  // ==========================================================================
  // 5. OPTIONAL REMOVABLE EQUIPMENT ATTACHMENTS (Hidden by default for pure silhouette)
  // ==========================================================================
  const headgearGroup = new THREE.Group();
  const earCapMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.35,
    metalness: 0.15,
  });
  const earBlueRingMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.3,
    metalness: 0.45,
  });
  const earPodL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.028, 14), earCapMat);
  earPodL.rotation.z = Math.PI / 2;
  earPodL.position.set(-0.155 * prop.headScale, 0.14, 0);
  const earRingL = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.012, 14), earBlueRingMat);
  earRingL.rotation.z = Math.PI / 2;
  earRingL.position.set(-0.145 * prop.headScale, 0.14, 0);
  const earPodR = earPodL.clone();
  earPodR.position.x = 0.155 * prop.headScale;
  const earRingR = earRingL.clone();
  earRingR.position.x = 0.145 * prop.headScale;
  headgearGroup.add(earPodL, earRingL, earPodR, earRingR);
  headPivot.add(headgearGroup);

  const backgearGroup = new THREE.Group();
  const blueStrapMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.42,
    metalness: 0.25,
  });
  const packCore = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.1), equipPrimaryMat);
  packCore.position.set(0, 0.25, -0.17);
  const packTrim = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.11), blueStrapMat);
  packTrim.position.set(0, 0.31, -0.175);
  backgearGroup.add(packCore, packTrim);
  torsoPivot.add(backgearGroup);

  const shouldersGroup = new THREE.Group();
  const pauldronL = new THREE.Mesh(
    new THREE.SphereGeometry(0.092 * prop.limbThickness, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    equipAccentMat
  );
  pauldronL.position.set(0, 0.02, 0);
  pauldronL.rotation.z = 0.35;
  const pauldronR = pauldronL.clone();
  pauldronR.rotation.z = -0.35;
  leftArm.shoulderPivot.add(pauldronL);
  rightArm.shoulderPivot.add(pauldronR);
  shouldersGroup.userData.linkedMeshes = [pauldronL, pauldronR];
  torsoPivot.add(shouldersGroup);

  const chestRigGroup = new THREE.Group();
  const harnessStrap = new THREE.Mesh(
    new THREE.TorusGeometry(0.185 * prop.torsoWidth, 0.014, 10, 24),
    equipPrimaryMat
  );
  harnessStrap.rotation.x = Math.PI / 2;
  harnessStrap.scale.set(1.08, 0.78, 1.0);
  harnessStrap.position.set(0, 0.27, 0);
  const chestBadge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.025), equipAccentMat);
  chestBadge.position.set(0, 0.27, 0.155 * prop.torsoWidth);
  chestRigGroup.add(harnessStrap, chestBadge);
  torsoPivot.add(chestRigGroup);

  const equipmentGroups: Record<EquipmentSlotId, THREE.Group> = {
    headgear: headgearGroup,
    backgear: backgearGroup,
    shoulders: shouldersGroup,
    chestRig: chestRigGroup,
  };

  // Set initial equipment visibility from character definition (defaults to [] for pure white base)
  for (const slot of ['headgear', 'backgear', 'shoulders', 'chestRig'] as EquipmentSlotId[]) {
    const visible = charDef.defaultEquipment.includes(slot);
    setCharacterEquipmentSlotVisible(equipmentGroups, slot, visible);
  }

  // Subtle floor ring indicator for isolated body region in studio
  const regionHighlightOutline = new THREE.Mesh(
    new THREE.RingGeometry(0.48, 0.52, 48),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
    })
  );
  regionHighlightOutline.rotation.x = -Math.PI / 2;
  regionHighlightOutline.position.y = 0.015;
  root.add(regionHighlightOutline);

  return {
    characterId,
    root,
    bodyPivot,
    hipsPivot,
    torsoPivot,
    neckPivot,
    headPivot,
    leftShoulderPivot: leftArm.shoulderPivot,
    leftElbowPivot: leftArm.elbowPivot,
    leftHandPivot: leftArm.handPivot,
    rightShoulderPivot: rightArm.shoulderPivot,
    rightElbowPivot: rightArm.elbowPivot,
    rightHandPivot: rightArm.handPivot,
    leftHipPivot: leftLeg.hipPivot,
    leftKneePivot: leftLeg.kneePivot,
    rightHipPivot: rightLeg.hipPivot,
    rightKneePivot: rightLeg.kneePivot,
    weaponMount,
    paintableMeshes,
    regionMeshes,
    equipmentGroups,
    paintMaterial,
    paintCanvas,
    paintTexture,
    regionHighlightOutline,
    dispose: () => {
      for (const m of paintableMeshes) {
        m.geometry.dispose();
      }
      paintMaterial.dispose();
      equipPrimaryMat.dispose();
      equipAccentMat.dispose();
      paintTexture.dispose();
    },
  };
}

export function setCharacterEquipmentSlotVisible(
  equipmentGroups: Record<EquipmentSlotId, THREE.Group>,
  slot: EquipmentSlotId,
  visible: boolean
): void {
  const grp = equipmentGroups[slot];
  if (!grp) return;
  grp.visible = visible;
  const linked = grp.userData.linkedMeshes as THREE.Object3D[] | undefined;
  if (linked) {
    for (const obj of linked) {
      obj.visible = visible;
    }
  }
}

/**
 * Syncs a composited RGBA Uint8ClampedArray (or PaintLayer[]) directly onto the
 * character's 512x512 CanvasTexture in real time.
 */
export function syncLayersToCharacterRigTexture(
  rig: ChameleonHumanoidRig,
  layersOrBuffer: PaintLayer[] | Uint8ClampedArray
): void {
  const rgba =
    layersOrBuffer instanceof Uint8ClampedArray
      ? layersOrBuffer
      : compositePaintLayersToBuffer(layersOrBuffer);

  const ctx = rig.paintCanvas.getContext('2d');
  if (!ctx) return;

  const imgData = ctx.createImageData(PAINT_ATLAS_SIZE, PAINT_ATLAS_SIZE);
  imgData.data.set(rgba);
  ctx.putImageData(imgData, 0, 0);
  rig.paintTexture.needsUpdate = true;
}

interface RigPoseTargets {
  hipsY: number;
  hipsX: number;
  hipsRotX: number;
  hipsRotY: number;
  hipsRotZ: number;
  torsoRotX: number;
  torsoRotY: number;
  torsoRotZ: number;
  neckRotX: number;
  neckRotY: number;
  headRotX: number;
  headRotY: number;
  headRotZ: number;
  lShoulderX: number;
  lShoulderY: number;
  lShoulderZ: number;
  lElbowX: number;
  lElbowY: number;
  lElbowZ: number;
  rShoulderX: number;
  rShoulderY: number;
  rShoulderZ: number;
  rElbowX: number;
  rElbowY: number;
  rElbowZ: number;
  lHipX: number;
  lHipY: number;
  lHipZ: number;
  lKneeX: number;
  rHipX: number;
  rHipY: number;
  rHipZ: number;
  rKneeX: number;
  weaponMountX: number;
  weaponMountY: number;
  weaponMountZ: number;
  weaponMountRotX: number;
  weaponMountRotY: number;
  weaponMountRotZ: number;
  showWeapon: boolean;
}

export interface CombatWeaponKinematicsInput {
  swayPosX?: number;
  swayPosY?: number;
  swayPosZ?: number;
  swayYaw?: number;
  swayPitch?: number;
  swayRoll?: number;
  strafeRoll?: number;
  wallObstruction?: number;
  wallBumpWave?: number;
  recoilKickZ?: number;
  recoilKickPitch?: number;
  recoilKickRoll?: number;
  landDipY?: number;
  jumpImpulseY?: number;
  airborneLift?: number;
  airbornePitch?: number;
  landRollImpulse?: number;
  triggerPullBlend?: number;
  muzzleFlashActive?: boolean;
  isFirstHalfSwap?: boolean;
  swapHalfProgress?: number;
  fireCooldownRatio?: number;
  magAmmoCount?: number;
  weaponRig?: WeaponViewModelRig;
}

// Pre-allocated scratch math objects for zero-GC 60fps animation & 2-bone arm IK
const _ikRestAxis = new THREE.Vector3(0, -1, 0);
const _ikToHand = new THREE.Vector3();
const _ikDir = new THREE.Vector3();
const _ikBendDir = new THREE.Vector3();
const _ikUpperDir = new THREE.Vector3();
const _ikElbowPos = new THREE.Vector3();
const _ikForearmDir = new THREE.Vector3();
const _ikLocalForearmDir = new THREE.Vector3();
const _ikShoulderQuat = new THREE.Quaternion();
const _ikInvShoulderQuat = new THREE.Quaternion();
const _ikElbowQuat = new THREE.Quaternion();
const _ikPoleRight = new THREE.Vector3(-0.62, -1.25, -0.08);
const _ikPoleLeft = new THREE.Vector3(0.32, -1.35, 0.38);
const _weaponEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const _weaponQuat = new THREE.Quaternion();
const _socketRightLocal = new THREE.Vector3();
const _socketLeftLocal = new THREE.Vector3();
const _rightHandTargetTorso = new THREE.Vector3();
const _leftHandTargetTorso = new THREE.Vector3();
const _grabPointLocal = new THREE.Vector3();
const _clearanceCheckPt = new THREE.Vector3();

export interface WeaponHoldProfile {
  id: WeaponId;
  styleName: string;
  hipMount: [number, number, number];
  adsMountZ: number;
  baseRot: [number, number, number];
  torsoLeanX: number;
  torsoTurnY: number;
  headTiltZ: number;
  rightHandOffset: [number, number, number];
  leftHandOffset: [number, number, number];
  poleRight: [number, number, number];
  poleLeft: [number, number, number];
  holdFreq: number;
  holdPitchAmp: number;
  holdYawAmp: number;
  holdRollAmp: number;
  strideDipScale: number;
  strideRollScale: number;
  inspectMount: [number, number, number];
  inspectRot: [number, number, number];
  inspectTorsoTurnY: number;
  inspectTorsoLeanX: number;
  inspectFreq: number;
  inspectAnimPitch: number;
  inspectAnimYaw: number;
  inspectAnimRoll: number;
  inspectAnimLiftY: number;
}

/**
 * Distinct per-weapon holding stances, two-bone IK grip/forend contact offsets (calibrated for
 * normal 1:1 scale low-poly bulb hands so the upper surface cradles the grip/forend without
 * poking above the barrel), elbow pole vectors, and idle/locomotion/inspect animations.
 */
export const WEAPON_HOLD_PROFILES: Record<WeaponId, WeaponHoldProfile> = {
  m4a1: {
    id: 'm4a1',
    styleName: 'Tactical Carbine C-Clamp',
    hipMount: [-0.205, 0.415, 0.485],
    adsMountZ: 0.46,
    baseRot: [-0.02, 0.015, -0.065],
    torsoLeanX: 0.08,
    torsoTurnY: -0.05,
    headTiltZ: 0.03,
    rightHandOffset: [-0.042, -0.095, -0.016],
    leftHandOffset: [0.026, -0.122, 0.012],
    poleRight: [-0.45, -1.32, -0.10],
    poleLeft: [0.24, -1.52, 0.24],
    holdFreq: 1.65,
    holdPitchAmp: 0.014,
    holdYawAmp: 0.012,
    holdRollAmp: 0.018,
    strideDipScale: 1.0,
    strideRollScale: 1.0,
    inspectMount: [-0.145, 0.335, 0.465],
    inspectRot: [-0.18, 0.68, -0.16],
    inspectTorsoTurnY: 0.08,
    inspectTorsoLeanX: 0.03,
    inspectFreq: 1.6,
    inspectAnimPitch: 0.09,
    inspectAnimYaw: 0.14,
    inspectAnimRoll: 0.22,
    inspectAnimLiftY: 0.020,
  },
  ak47: {
    id: 'ak47',
    styleName: 'Kalashnikov Heavy Brawler',
    hipMount: [-0.222, 0.386, 0.495],
    adsMountZ: 0.465,
    baseRot: [-0.058, -0.022, 0.055],
    torsoLeanX: 0.135,
    torsoTurnY: -0.10,
    headTiltZ: -0.02,
    rightHandOffset: [-0.046, -0.096, -0.018],
    leftHandOffset: [0.028, -0.124, 0.028],
    poleRight: [-0.84, -0.92, -0.04],
    poleLeft: [0.18, -1.62, 0.32],
    holdFreq: 1.95,
    holdPitchAmp: 0.022,
    holdYawAmp: 0.016,
    holdRollAmp: 0.025,
    strideDipScale: 1.32,
    strideRollScale: 1.25,
    inspectMount: [-0.162, 0.315, 0.475],
    inspectRot: [-0.14, 0.74, 0.08],
    inspectTorsoTurnY: 0.14,
    inspectTorsoLeanX: 0.07,
    inspectFreq: 1.85,
    inspectAnimPitch: 0.14,
    inspectAnimYaw: 0.12,
    inspectAnimRoll: -0.20,
    inspectAnimLiftY: 0.028,
  },
  mp5: {
    id: 'mp5',
    styleName: 'Point-Man Compact SMG Tuck',
    hipMount: [-0.172, 0.434, 0.455],
    adsMountZ: 0.44,
    baseRot: [-0.01, 0.042, -0.148],
    torsoLeanX: 0.105,
    torsoTurnY: -0.02,
    headTiltZ: 0.055,
    rightHandOffset: [-0.038, -0.092, -0.014],
    leftHandOffset: [0.024, -0.118, 0.018],
    poleRight: [-0.28, -1.45, -0.14],
    poleLeft: [0.16, -1.55, 0.24],
    holdFreq: 2.55,
    holdPitchAmp: 0.012,
    holdYawAmp: 0.018,
    holdRollAmp: 0.028,
    strideDipScale: 0.82,
    strideRollScale: 1.38,
    inspectMount: [-0.132, 0.355, 0.445],
    inspectRot: [-0.22, 0.62, -0.24],
    inspectTorsoTurnY: 0.05,
    inspectTorsoLeanX: 0.04,
    inspectFreq: 2.35,
    inspectAnimPitch: 0.08,
    inspectAnimYaw: 0.16,
    inspectAnimRoll: 0.28,
    inspectAnimLiftY: 0.018,
  },
  spas12: {
    id: 'spas12',
    styleName: 'Breacher Pump-Shotgun Cradle',
    hipMount: [-0.228, 0.372, 0.502],
    adsMountZ: 0.47,
    baseRot: [-0.078, 0.024, -0.028],
    torsoLeanX: 0.12,
    torsoTurnY: -0.08,
    headTiltZ: 0.015,
    rightHandOffset: [-0.044, -0.096, -0.016],
    leftHandOffset: [0.030, -0.122, 0.008],
    poleRight: [-0.64, -1.12, -0.08],
    poleLeft: [0.36, -1.42, 0.30],
    holdFreq: 1.75,
    holdPitchAmp: 0.018,
    holdYawAmp: 0.020,
    holdRollAmp: 0.022,
    strideDipScale: 1.38,
    strideRollScale: 1.18,
    inspectMount: [-0.158, 0.322, 0.48],
    inspectRot: [-0.16, 0.72, -0.12],
    inspectTorsoTurnY: 0.11,
    inspectTorsoLeanX: 0.06,
    inspectFreq: 1.7,
    inspectAnimPitch: 0.12,
    inspectAnimYaw: 0.15,
    inspectAnimRoll: 0.18,
    inspectAnimLiftY: 0.024,
  },
  awp: {
    id: 'awp',
    styleName: 'Marksman Long-Rifle Precision Poise',
    hipMount: [-0.208, 0.402, 0.508],
    adsMountZ: 0.475,
    baseRot: [-0.088, 0.034, -0.042],
    torsoLeanX: 0.048,
    torsoTurnY: -0.14,
    headTiltZ: 0.04,
    rightHandOffset: [-0.042, -0.096, -0.016],
    leftHandOffset: [0.024, -0.124, 0.022],
    poleRight: [-0.48, -1.28, -0.10],
    poleLeft: [0.14, -1.65, 0.36],
    holdFreq: 1.12,
    holdPitchAmp: 0.010,
    holdYawAmp: 0.008,
    holdRollAmp: 0.012,
    strideDipScale: 1.15,
    strideRollScale: 0.85,
    inspectMount: [-0.152, 0.328, 0.485],
    inspectRot: [-0.24, 0.76, -0.14],
    inspectTorsoTurnY: 0.16,
    inspectTorsoLeanX: 0.02,
    inspectFreq: 1.25,
    inspectAnimPitch: 0.10,
    inspectAnimYaw: 0.10,
    inspectAnimRoll: 0.16,
    inspectAnimLiftY: 0.020,
  },
  deagle: {
    id: 'deagle',
    styleName: 'Gunfighter Two-Handed Weaver Pistol',
    hipMount: [-0.152, 0.438, 0.465],
    adsMountZ: 0.44,
    baseRot: [-0.016, 0.022, -0.085],
    torsoLeanX: 0.058,
    torsoTurnY: -0.12,
    headTiltZ: 0.045,
    rightHandOffset: [-0.036, -0.092, -0.014],
    leftHandOffset: [0.032, -0.114, -0.006],
    poleRight: [-0.44, -1.22, 0.16],
    poleLeft: [0.32, -1.38, 0.24],
    holdFreq: 2.25,
    holdPitchAmp: 0.015,
    holdYawAmp: 0.014,
    holdRollAmp: 0.024,
    strideDipScale: 0.75,
    strideRollScale: 1.15,
    inspectMount: [-0.122, 0.368, 0.445],
    inspectRot: [-0.16, 0.54, -0.22],
    inspectTorsoTurnY: 0.09,
    inspectTorsoLeanX: 0.03,
    inspectFreq: 2.05,
    inspectAnimPitch: 0.14,
    inspectAnimYaw: 0.18,
    inspectAnimRoll: 0.30,
    inspectAnimLiftY: 0.022,
  },
};

/**
 * Analytical 3D Body-Clearance Solver for Handheld Firearms:
 * Transforms the 8 bounding extrema control points of the active 3D weapon
 * (buttstock top/bottom, receiver/scope rear, pistol grip base, magazine base, forend)
 * from `weaponMount` space into `torsoPivot` space and enforces a strict minimum forward
 * clearance in front of the character's chest, abdomen, pelvis, shoulders, neck, and head.
 */
export function enforceWeaponBodyClearance(
  mountPos: THREE.Vector3,
  mountRot: THREE.Euler,
  weaponId: WeaponId,
  torsoWidth = 1.0,
  headScale = 1.0,
  headPitchRot = 0
): void {
  // Keep weapon on the anatomical right side (-X) so it never crosses into the neck/chin centerline
  if (mountPos.x > -0.125) {
    mountPos.x = -0.125;
  }

  // Clamp pitch rotation so High-Port + upward aim + reload never flips past vertical (-1.42 rad) into the head/chest
  mountRot.x = THREE.MathUtils.clamp(mountRot.x, -1.42, 1.12);

  const rearStockZ =
    weaponId === 'deagle'
      ? -0.115
      : weaponId === 'spas12'
        ? -0.15
        : weaponId === 'mp5'
          ? -0.185
          : -0.225;

  _weaponQuat.setFromEuler(mountRot);

  // Chest/shoulder/pelvis front surface is at Z = 0.215 * torsoWidth; enforce >= 0.220 * torsoWidth
  // so level-barrel CQB shoulder tuck can retract axially without ever touching the chest surface
  const minTorsoFrontZ = 0.220 * torsoWidth;
  // Head/neck front surface (accounting for forward head tilt when aiming down)
  const minHeadFrontZ = Math.max(
    minTorsoFrontZ,
    0.245 * headScale + Math.max(0, Math.sin(headPitchRot)) * 0.14
  );

  let maxNeededPushZ = 0;
  for (let i = 0; i < 8; i++) {
    let lx = i % 2 === 0 ? -0.028 : 0.028;
    let ly = 0;
    let lz = 0;
    if (i === 0) {
      // Buttstock rear top
      ly = 0.065;
      lz = rearStockZ;
    } else if (i === 1) {
      // Buttstock rear bottom (toe)
      ly = -0.105;
      lz = rearStockZ;
    } else if (i === 2) {
      // Optic / Scope / Rear Sight top
      ly = weaponId === 'awp' ? 0.135 : 0.11;
      lz = -0.115;
    } else if (i === 3) {
      // Pistol grip bottom
      ly = -0.135;
      lz = -0.105;
    } else if (i === 4) {
      // Magazine bottom tip (seated)
      ly = weaponId === 'deagle' ? -0.145 : -0.215;
      lz = weaponId === 'deagle' ? -0.075 : 0.065;
    } else if (i === 5) {
      // Magazine bottom tip during reload extraction/insertion
      ly = -0.285;
      lz = -0.025;
    } else if (i === 6) {
      // Handguard / Forend underside
      ly = -0.075;
      lz = 0.21;
    } else {
      // Upper barrel / front sight assembly when pitched into High-Port
      ly = 0.105;
      lz = 0.62;
    }

    _clearanceCheckPt
      .set(lx, ly, lz)
      .applyQuaternion(_weaponQuat)
      .add(mountPos);

    const reqZ = _clearanceCheckPt.y > 0.52 ? minHeadFrontZ : minTorsoFrontZ;
    if (_clearanceCheckPt.z < reqZ) {
      const needed = reqZ - _clearanceCheckPt.z;
      if (needed > maxNeededPushZ) {
        maxNeededPushZ = needed;
      }
    }
  }

  if (maxNeededPushZ > 0) {
    mountPos.z += maxNeededPushZ;
  }
}

function solveTwoBoneArmIK(
  shoulderPivot: THREE.Group,
  elbowPivot: THREE.Group,
  shoulderPos: THREE.Vector3,
  handTargetTorso: THREE.Vector3,
  poleVec: THREE.Vector3,
  upperLen = 0.27,
  forearmLen = 0.285
): void {
  _ikToHand.subVectors(handTargetTorso, shoulderPos);
  const rawDist = _ikToHand.length();
  if (rawDist < 0.001) {
    shoulderPivot.position.copy(shoulderPos);
    return;
  }

  _ikDir.copy(_ikToHand).multiplyScalar(1 / rawDist);
  // Natural clavicular protraction when reaching across the chest to the support forend,
  // preserving a comfortable athletic elbow bend while keeping the shoulder anchored to the upper torso
  const comfortableReach = (upperLen + forearmLen) * 0.84;
  if (rawDist > comfortableReach) {
    const protract = Math.min(0.13, (rawDist - comfortableReach) * 0.85);
    shoulderPivot.position.copy(shoulderPos).addScaledVector(_ikDir, protract);
  } else {
    shoulderPivot.position.copy(shoulderPos);
  }

  _ikToHand.subVectors(handTargetTorso, shoulderPivot.position);
  const effDist = _ikToHand.length();
  const maxReach = upperLen + forearmLen - 0.004;
  const d = Math.max(0.06, Math.min(maxReach, effDist));
  if (effDist > 0.0001) {
    _ikDir.copy(_ikToHand).multiplyScalar(1 / effDist);
  }

  const cosTheta = THREE.MathUtils.clamp(
    (upperLen * upperLen + d * d - forearmLen * forearmLen) / (2 * upperLen * d),
    -1,
    1
  );
  const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));

  const proj = poleVec.dot(_ikDir);
  _ikBendDir.copy(poleVec).addScaledVector(_ikDir, -proj);
  const bendLen = _ikBendDir.length();
  if (bendLen > 0.0001) {
    _ikBendDir.multiplyScalar(1 / bendLen);
  } else {
    _ikBendDir.set(0, -1, 0);
  }

  _ikUpperDir
    .copy(_ikDir)
    .multiplyScalar(cosTheta)
    .addScaledVector(_ikBendDir, sinTheta)
    .normalize();

  _ikElbowPos.copy(shoulderPivot.position).addScaledVector(_ikUpperDir, upperLen);
  _ikForearmDir.subVectors(handTargetTorso, _ikElbowPos);
  if (_ikForearmDir.lengthSq() > 0.00001) {
    _ikForearmDir.normalize();
  } else {
    _ikForearmDir.copy(_ikUpperDir);
  }

  _ikShoulderQuat.setFromUnitVectors(_ikRestAxis, _ikUpperDir);
  _ikInvShoulderQuat.copy(_ikShoulderQuat).invert();
  _ikLocalForearmDir
    .copy(_ikForearmDir)
    .applyQuaternion(_ikInvShoulderQuat)
    .normalize();
  _ikElbowQuat.setFromUnitVectors(_ikRestAxis, _ikLocalForearmDir);

  shoulderPivot.quaternion.copy(_ikShoulderQuat);
  elbowPivot.quaternion.copy(_ikElbowQuat);
}

function createDefaultRigPoseTargets(): RigPoseTargets & { lastTimeSec: number } {
  return {
    hipsY: 0.9,
    hipsX: 0,
    hipsRotX: 0,
    hipsRotY: 0,
    hipsRotZ: 0,
    torsoRotX: 0,
    torsoRotY: 0,
    torsoRotZ: 0,
    neckRotX: 0,
    neckRotY: 0,
    headRotX: 0,
    headRotY: 0,
    headRotZ: 0,
    lShoulderX: 0,
    lShoulderY: 0,
    lShoulderZ: -0.22,
    lElbowX: 0,
    lElbowY: 0,
    lElbowZ: 0,
    rShoulderX: 0,
    rShoulderY: 0,
    rShoulderZ: 0.22,
    rElbowX: 0,
    rElbowY: 0,
    rElbowZ: 0,
    lHipX: 0,
    lHipY: 0,
    lHipZ: 0,
    lKneeX: 0,
    rHipX: 0,
    rHipY: 0,
    rHipZ: 0,
    rKneeX: 0,
    weaponMountX: -0.185,
    weaponMountY: 0.36,
    weaponMountZ: 0.48,
    weaponMountRotX: 0,
    weaponMountRotY: 0,
    weaponMountRotZ: 0,
    showWeapon: false,
    lastTimeSec: -1,
  };
}

/**
 * Animates the Low-Poly Humanoid Rig in the 3D Lobby, Paint Studio, Character Preview, or Combat.
 * Uses a SINGLE unified character body, weapon mount, 2-bone arm IK, and mechanical weapon animation
 * for BOTH First-Person (FPV) and Third-Person (TPV) with zero per-frame heap allocations.
 */
export function updateChameleonRigAnimation(
  rig: ChameleonHumanoidRig,
  pose: CharacterPoseId | 'studio_neutral' | 'combat',
  timeSec: number,
  combatMoveSpeed = 0,
  combatWalkPhase = 0,
  isCrouching = false,
  localMoveX = 0,
  localMoveZ = 0,
  isReloading = false,
  reloadProgress = 0,
  recoilKick = 0,
  activeWeapon: WeaponId = 'm4a1',
  aimPitch = 0,
  adsBlend = 0,
  sprintBlend = 0,
  slideBlend = 0,
  weaponSwitchProgress = 0,
  combatKinematics?: CombatWeaponKinematicsInput
): void {
  const breath = Math.sin(timeSec * 2.2);
  const breathCos = Math.cos(timeSec * 2.2);
  const slowWave = Math.sin(timeSec * 1.1);
  const secondaryWave = Math.cos(timeSec * 0.85);
  const charProp =
    CHARACTER_ROSTER[rig.characterId]?.proportions || CHARACTER_ROSTER.volt.proportions;

  let targets = rig.root.userData.targetScratch as RigPoseTargets | undefined;
  if (!targets) {
    targets = createDefaultRigPoseTargets();
    rig.root.userData.targetScratch = targets;
  }

  targets.hipsY = isCrouching ? 0.68 : 0.90;
  targets.hipsX = 0;
  targets.hipsRotX = 0;
  targets.hipsRotY = 0;
  targets.hipsRotZ = 0;
  targets.torsoRotX = 0;
  targets.torsoRotY = 0;
  targets.torsoRotZ = 0;
  targets.neckRotX = 0;
  targets.neckRotY = 0;
  targets.headRotX = 0;
  targets.headRotY = 0;
  targets.headRotZ = 0;
  targets.lShoulderX = 0;
  targets.lShoulderY = 0;
  targets.lShoulderZ = -0.22;
  targets.lElbowX = 0;
  targets.lElbowY = 0;
  targets.lElbowZ = 0;
  targets.rShoulderX = 0;
  targets.rShoulderY = 0;
  targets.rShoulderZ = 0.22;
  targets.rElbowX = 0;
  targets.rElbowY = 0;
  targets.rElbowZ = 0;
  targets.lHipX = 0;
  targets.lHipY = 0;
  targets.lHipZ = 0;
  targets.lKneeX = 0;
  targets.rHipX = 0;
  targets.rHipY = 0;
  targets.rHipZ = 0;
  targets.rKneeX = 0;
  targets.weaponMountX = -0.185;
  targets.weaponMountY = 0.36;
  targets.weaponMountZ = 0.48;
  targets.weaponMountRotX = 0;
  targets.weaponMountRotY = 0;
  targets.weaponMountRotZ = 0;
  targets.showWeapon = false;

  if (pose === 'studio_neutral') {
    targets.hipsY = 0.90 + breath * 0.003;
    targets.torsoRotX = breath * 0.008;
    targets.lShoulderZ = -0.22;
    targets.rShoulderZ = 0.22;
    targets.lElbowX = -0.04;
    targets.rElbowX = -0.04;
    targets.showWeapon = false;
  } else if (pose === 'idle') {
    targets.hipsY = 0.90 + breath * 0.011;
    targets.hipsX = slowWave * 0.022;
    targets.hipsRotZ = -slowWave * 0.032;
    targets.hipsRotY = secondaryWave * 0.048;

    targets.torsoRotX = breath * 0.024;
    targets.torsoRotZ = slowWave * 0.028;
    targets.torsoRotY = -secondaryWave * 0.042;

    targets.neckRotY = slowWave * 0.045;
    targets.headRotY = slowWave * 0.085;
    targets.headRotX = breathCos * 0.032;
    targets.headRotZ = secondaryWave * 0.022;

    targets.lShoulderZ = -0.22 - Math.max(0, breath) * 0.035;
    targets.rShoulderZ = 0.22 + Math.max(0, breath) * 0.035;
    targets.lShoulderX = secondaryWave * 0.045;
    targets.rShoulderX = -secondaryWave * 0.045;
    targets.lElbowX = -0.10 - breath * 0.028;
    targets.rElbowX = -0.10 - breath * 0.028;

    targets.lHipZ = slowWave * 0.024;
    targets.rHipZ = slowWave * 0.024;
    targets.lKneeX = Math.max(0, slowWave) * 0.065;
    targets.rKneeX = Math.max(0, -slowWave) * 0.065;
    targets.showWeapon = false;
  } else if (pose === 'walk') {
    const cycle = timeSec * 5.2;
    const s = Math.sin(cycle);
    const c = Math.cos(cycle);
    const doubleStep = Math.sin(cycle * 2);

    targets.hipsY = 0.885 + Math.abs(s) * 0.046;
    targets.hipsX = c * 0.034;
    targets.hipsRotY = s * 0.135;
    targets.hipsRotZ = c * 0.058;
    targets.hipsRotX = 0.055 + doubleStep * 0.018;

    targets.torsoRotX = 0.075 + doubleStep * 0.026;
    targets.torsoRotY = -s * 0.165;
    targets.torsoRotZ = -c * 0.052;

    targets.neckRotY = s * 0.04;
    targets.headRotY = s * 0.065;
    targets.headRotX = -0.04 - doubleStep * 0.022;
    targets.headRotZ = c * 0.025;

    targets.lHipX = -s * 0.54;
    targets.rHipX = s * 0.54;
    targets.lHipZ = -c * 0.035;
    targets.rHipZ = -c * 0.035;
    targets.lKneeX = Math.max(0, c) * 0.72 + 0.06;
    targets.rKneeX = Math.max(0, -c) * 0.72 + 0.06;

    targets.lShoulderX = s * 0.48;
    targets.rShoulderX = -s * 0.48;
    targets.lShoulderY = s * 0.12;
    targets.rShoulderY = -s * 0.12;
    targets.lShoulderZ = -0.18 - Math.max(0, -s) * 0.05;
    targets.rShoulderZ = 0.18 + Math.max(0, s) * 0.05;
    targets.lElbowX = -0.28 - Math.max(0, -s) * 0.36;
    targets.rElbowX = -0.28 - Math.max(0, s) * 0.36;
    targets.showWeapon = false;
  } else if (pose === 'run') {
    const cycle = timeSec * 8.6;
    const s = Math.sin(cycle);
    const c = Math.cos(cycle);
    const bounce = Math.abs(s);

    targets.hipsY = 0.85 + bounce * 0.082;
    targets.hipsX = c * 0.044;
    targets.hipsRotY = s * 0.21;
    targets.hipsRotZ = c * 0.078;
    targets.hipsRotX = 0.15 + (1 - bounce) * 0.035;

    targets.torsoRotX = 0.24 + (1 - bounce) * 0.055;
    targets.torsoRotY = -s * 0.24;
    targets.torsoRotZ = -c * 0.072;

    targets.neckRotX = -0.06;
    targets.headRotX = -0.14 + (1 - bounce) * 0.03;
    targets.headRotY = s * 0.11;
    targets.headRotZ = c * 0.035;

    targets.lHipX = -s * 0.88;
    targets.rHipX = s * 0.88;
    targets.lHipZ = -c * 0.05;
    targets.rHipZ = -c * 0.05;
    targets.lKneeX = Math.max(0, c) * 1.14 + 0.14;
    targets.rKneeX = Math.max(0, -c) * 1.14 + 0.14;

    targets.lShoulderX = s * 0.82 - 0.16;
    targets.rShoulderX = -s * 0.82 - 0.16;
    targets.lShoulderY = s * 0.18;
    targets.rShoulderY = -s * 0.18;
    targets.lShoulderZ = -0.16 - Math.max(0, -s) * 0.06;
    targets.rShoulderZ = 0.16 + Math.max(0, s) * 0.06;
    targets.lElbowX = -0.92 - Math.max(0, -s) * 0.42;
    targets.rElbowX = -0.92 - Math.max(0, s) * 0.42;
    targets.showWeapon = false;
  } else if (pose === 'inspect') {
    const wp = WEAPON_HOLD_PROFILES[activeWeapon] || WEAPON_HOLD_PROFILES.m4a1;
    const inspectWave = Math.sin(timeSec * wp.inspectFreq);
    const inspectCos = Math.cos(timeSec * wp.inspectFreq);
    const flourishPulse = Math.max(0, Math.sin(timeSec * wp.inspectFreq * 0.5));

    targets.hipsY = 0.90 + breath * 0.008;
    targets.hipsX = slowWave * 0.014;
    targets.hipsRotY = -wp.inspectTorsoTurnY * 0.35;

    targets.torsoRotX = wp.inspectTorsoLeanX + breath * 0.015;
    targets.torsoRotY = wp.inspectTorsoTurnY + inspectWave * 0.055;
    targets.torsoRotZ = slowWave * 0.018;

    targets.neckRotY = -wp.inspectTorsoTurnY * 0.35 + inspectWave * 0.04;
    targets.headRotY = -wp.inspectTorsoTurnY * 0.55 + inspectWave * 0.09;
    targets.headRotX = 0.09 + inspectCos * 0.04;
    targets.headRotZ = wp.headTiltZ + inspectWave * 0.03;

    targets.lHipZ = -0.025;
    targets.rHipZ = 0.025;
    targets.lKneeX = 0.05;
    targets.rKneeX = 0.04;

    targets.weaponMountX = wp.inspectMount[0] + inspectCos * 0.012;
    targets.weaponMountY =
      wp.inspectMount[1] +
      Math.abs(inspectWave) * wp.inspectAnimLiftY +
      breath * 0.006;
    targets.weaponMountZ = wp.inspectMount[2] + flourishPulse * 0.015;
    targets.weaponMountRotX = wp.inspectRot[0] + inspectWave * wp.inspectAnimPitch;
    targets.weaponMountRotY = wp.inspectRot[1] + inspectCos * wp.inspectAnimYaw;
    targets.weaponMountRotZ = wp.inspectRot[2] + inspectWave * wp.inspectAnimRoll;
    targets.showWeapon = true;
  } else if (pose === 'salute') {
    targets.hipsY = 0.90 + breath * 0.006;
    targets.torsoRotX = -0.04 + breath * 0.01;
    targets.headRotY = slowWave * 0.06;

    targets.rShoulderX = -1.35;
    targets.rShoulderZ = 0.42;
    targets.rElbowX = -1.48;
    targets.rElbowZ = 0.55;

    targets.lShoulderZ = -0.20;
    targets.lShoulderX = 0.04;
    targets.lElbowX = -0.10;
    targets.showWeapon = false;
  } else if (pose === 'victory') {
    const vBounce = Math.abs(Math.sin(timeSec * 3.4));
    targets.hipsY = 0.90 + vBounce * 0.035;
    targets.torsoRotX = -0.08 - vBounce * 0.04;
    targets.torsoRotY = slowWave * 0.18;
    targets.headRotX = -0.12;
    targets.headRotY = slowWave * 0.12;

    targets.rShoulderX = -2.45 + breath * 0.08;
    targets.rShoulderZ = 0.32;
    targets.rElbowX = -0.28;

    targets.lShoulderX = -2.45 - breath * 0.08;
    targets.lShoulderZ = -0.32;
    targets.lElbowX = -0.28;

    targets.lHipZ = -0.06;
    targets.rHipZ = 0.06;
    targets.showWeapon = false;
  } else if (pose === 'combat') {
    const wp = WEAPON_HOLD_PROFILES[activeWeapon] || WEAPON_HOLD_PROFILES.m4a1;
    const stride = Math.sin(combatWalkPhase);
    const strideCos = Math.cos(combatWalkPhase);
    const doubleStep = Math.sin(combatWalkPhase * 2);
    const moveFactor = Math.min(1, combatMoveSpeed / 5.2);
    const sprintFactor = Math.max(
      sprintBlend,
      Math.max(0, Math.min(1, (combatMoveSpeed - 4.8) / 2.4))
    );
    const legAmp = (0.68 + sprintFactor * 0.24) * moveFactor;
    const clampedPitch = THREE.MathUtils.clamp(aimPitch, -1.35, 1.35);

    // 16-Direction Locomotion Kinematics
    const moveLen = Math.hypot(localMoveX, localMoveZ);
    const fwd = moveLen > 0.05 ? -localMoveZ / moveLen : 1.0;
    const right = moveLen > 0.05 ? localMoveX / moveLen : 0.0;
    const moveAngle = Math.atan2(right, fwd);
    const anglePositive = moveAngle < 0 ? moveAngle + Math.PI * 2 : moveAngle;
    const sector16 = Math.round((anglePositive / (Math.PI * 2)) * 16) % 16;
    const quantizedAngle = (sector16 / 16) * Math.PI * 2;
    const qFwd = Math.cos(quantizedAngle);
    const qRight = Math.sin(quantizedAngle);

    const dirFwd = fwd * 0.35 + qFwd * 0.65;
    const dirRight = right * 0.35 + qRight * 0.65;

    // 1. Full-Body Pelvis Weight Shift
    const baseHipY = isCrouching ? 0.68 : 0.90;
    targets.hipsY =
      baseHipY -
      0.22 * slideBlend -
      0.032 * moveFactor * (1 - slideBlend) +
      Math.abs(stride) * (0.052 + sprintFactor * 0.022) * moveFactor * (1 - slideBlend) +
      breath * 0.006 * (1 - moveFactor);
    targets.hipsX =
      stride * 0.036 * moveFactor * (1 - slideBlend) +
      strideCos * 0.016 * moveFactor * (1 - slideBlend) +
      dirRight * 0.024 * moveFactor;

    const pelvisTwist = Math.sin(moveAngle) * 0.28 * moveFactor * (1 - slideBlend);
    targets.hipsRotX = (0.06 + sprintFactor * 0.06) * dirFwd * moveFactor - 0.16 * slideBlend;
    targets.hipsRotY = pelvisTwist + stride * 0.11 * moveFactor * (1 - slideBlend);
    targets.hipsRotZ =
      -dirRight * 0.08 * moveFactor +
      strideCos * 0.045 * moveFactor * (1 - slideBlend) +
      0.14 * slideBlend;

    // 2. Per-Weapon Spine & Chest Posture (combines weapon-specific stance lean/blading with pitch & recoil)
    const recPitch = Math.min(0.28, recoilKick * 1.4);
    const baseTorsoLean =
      wp.torsoLeanX * (1 - adsBlend * 0.45) +
      (isCrouching ? 0.14 : (0.07 + sprintFactor * 0.07) * moveFactor * dirFwd) +
      doubleStep * 0.02 * moveFactor +
      breath * 0.012;
    targets.torsoRotX = baseTorsoLean - clampedPitch * 0.42 - recPitch * 0.45;
    targets.torsoRotY = wp.torsoTurnY * (1 - adsBlend * 0.65) - targets.hipsRotY;
    targets.torsoRotZ = -targets.hipsRotZ;

    // 3. Neck & Head Articulation (compounds with torsoRotX + weapon-specific cheek-weld tilt)
    targets.neckRotX = -clampedPitch * 0.24 + adsBlend * 0.05;
    targets.neckRotY = -targets.torsoRotY * 0.4;
    targets.headRotY = -targets.torsoRotY * 0.6;
    targets.headRotX =
      (isCrouching ? -0.10 : -0.04 * moveFactor) -
      clampedPitch * 0.34 +
      adsBlend * 0.05 +
      recPitch * 0.28;
    targets.headRotZ =
      -targets.torsoRotZ * 0.5 + wp.headTiltZ * (1 - adsBlend * 0.5) + adsBlend * 0.10;

    // 4. 16-Direction Leg Strides
    if (slideBlend > 0.35) {
      targets.lHipX = -0.82 * slideBlend;
      targets.lKneeX = 0.18 * slideBlend;
      targets.rHipX = -0.25 * slideBlend;
      targets.rKneeX = 1.28 * slideBlend;
      targets.lHipZ = -0.08;
      targets.rHipZ = 0.12;
    } else {
      targets.lHipX =
        -stride * legAmp * dirFwd + (isCrouching ? -0.44 : -0.03 * (1 - moveFactor));
      targets.rHipX =
        stride * legAmp * dirFwd + (isCrouching ? -0.44 : 0.03 * (1 - moveFactor));

      targets.lHipY = pelvisTwist * 0.25;
      targets.rHipY = pelvisTwist * 0.25;

      targets.lHipZ =
        -0.02 -
        dirRight * 0.18 * moveFactor +
        strideCos * 0.15 * dirRight * moveFactor;
      targets.rHipZ =
        0.02 +
        dirRight * 0.18 * moveFactor -
        strideCos * 0.15 * dirRight * moveFactor;

      const crouchKnee = isCrouching ? 0.76 : 0.08 * moveFactor + 0.03;
      const stepSwingL = strideCos * dirFwd + stride * dirRight * 0.65;
      const stepSwingR = -strideCos * dirFwd - stride * dirRight * 0.65;
      targets.lKneeX =
        crouchKnee + Math.max(0, stepSwingL) * (0.82 + sprintFactor * 0.22) * moveFactor;
      targets.rKneeX =
        crouchKnee + Math.max(0, stepSwingR) * (0.82 + sprintFactor * 0.22) * moveFactor;
    }

    // 5. Per-Weapon Unified FPV + TPV Weapon Mount Pose & Holding Cadence in Torso Space
    const ck = combatKinematics;
    const idleHarmonicScale = (isCrouching ? 0.65 : 1.0) * (1 - adsBlend * 0.75);
    const wPhase = timeSec * wp.holdFreq;
    const wSin = Math.sin(wPhase);
    const wCos = Math.cos(wPhase * 0.5);
    const defaultIdleX = wCos * 0.0052 * idleHarmonicScale;
    const defaultIdleY =
      (wSin * 0.0072 + Math.sin(wPhase * 2 + 0.5) * 0.002) * idleHarmonicScale;
    const defaultIdleZ = Math.cos(wPhase) * 0.0034 * idleHarmonicScale;
    const swayPosX = ck?.swayPosX ?? defaultIdleX;
    const swayPosY = ck?.swayPosY ?? defaultIdleY;
    const swayPosZ = ck?.swayPosZ ?? defaultIdleZ;
    const swayYaw = ck?.swayYaw ?? wCos * wp.holdYawAmp * idleHarmonicScale;
    const swayPitch = ck?.swayPitch ?? -wSin * wp.holdPitchAmp * idleHarmonicScale;
    const swayRoll =
      ck?.swayRoll ?? Math.sin(wPhase * 0.5 + 0.38) * wp.holdRollAmp * idleHarmonicScale;
    const strafeRoll = ck?.strafeRoll ?? 0;
    const wallObs = ck?.wallObstruction ?? 0;
    const wallBump = ck?.wallBumpWave ?? 0;
    const recZ = ck?.recoilKickZ ?? recoilKick * 0.12;
    const recRoll = ck?.recoilKickRoll ?? 0;
    const landDip = (ck?.landDipY ?? 0) + (ck?.jumpImpulseY ?? 0);
    const airLift = ck?.airborneLift ?? 0;
    const airPitch = ck?.airbornePitch ?? 0;
    const landRoll = ck?.landRollImpulse ?? 0;

    // Eye socket anchor in torsoPivot space:
    const eyePivotY = THREE.MathUtils.lerp(0.62, 0.58, adsBlend);
    const eyePivotZ = 0.18;

    const sightOffsetY =
      activeWeapon === 'awp'
        ? 0.095
        : activeWeapon === 'm4a1'
          ? 0.091
          : activeWeapon === 'ak47'
            ? 0.058
            : 0.054;
    const hipMountX = wp.hipMount[0];
    const hipMountY = wp.hipMount[1];
    const hipMountZ = wp.hipMount[2];
    const adsMountX = -0.165;
    const adsMountY = eyePivotY - sightOffsetY;
    const adsMountZ = wp.adsMountZ;

    const wallEase = wallObs * wallObs * (3 - 2 * wallObs);
    const wallBrace = wallObs > 0.25 ? (wallObs - 0.25) / 0.75 : 0;
    const hipPoseWeight = (1 - adsBlend * 0.88) * (1 - Number(isReloading) * 0.65);

    let localX =
      THREE.MathUtils.lerp(hipMountX, adsMountX, adsBlend) +
      swayPosX +
      stride * 0.011 * wp.strideRollScale * moveFactor * (1 - adsBlend * 0.75) +
      swayYaw * 0.28 -
      moveFactor * 0.015 * (1 - adsBlend) -
      sprintBlend * 0.025 -
      slideBlend * 0.018 -
      wallEase * 0.018;
    let localY =
      THREE.MathUtils.lerp(hipMountY, adsMountY, adsBlend) +
      swayPosY -
      Math.abs(stride) * 0.012 * wp.strideDipScale * moveFactor * (1 - adsBlend * 0.75) +
      stride * 0.02 * wp.strideDipScale * moveFactor * (1 - adsBlend * 0.75) +
      recPitch * 0.032 +
      landDip * 0.55 +
      airLift +
      swayPitch * 0.24 -
      sprintBlend * 0.022 -
      slideBlend * 0.032 +
      wallEase * 0.068 +
      wallBrace * 0.024;
    let localZ =
      THREE.MathUtils.lerp(hipMountZ, adsMountZ, adsBlend) +
      swayPosZ -
      recZ * 0.65 -
      recPitch * 0.05 -
      sprintBlend * 0.018 -
      wallEase * 0.072 -
      wallBrace * 0.024 -
      wallBump * 0.45;

    // Level CQB Tuck: keep barrel pointed straight forward along the aim vector (never pitch skyward near walls!)
    let localRotX =
      wp.baseRot[0] * hipPoseWeight -
      recPitch * 0.75 -
      swayPitch -
      airPitch -
      sprintBlend * 0.18 -
      slideBlend * 0.12 -
      wallEase * 0.02;
    let localRotY =
      wp.baseRot[1] * hipPoseWeight -
      stride * 0.022 * wp.strideRollScale * moveFactor * (1 - adsBlend * 0.75) -
      swayYaw -
      sprintBlend * 0.06 -
      slideBlend * 0.08 -
      wallEase * 0.03;
    let localRotZ =
      wp.baseRot[2] * hipPoseWeight +
      stride * 0.022 * wp.strideRollScale * moveFactor * (1 - adsBlend * 0.75) -
      recRoll +
      strafeRoll -
      swayRoll -
      landRoll -
      sprintBlend * 0.14 -
      slideBlend * 0.36 +
      wallBrace * 0.08;

    // Two-Stage Weapon Swap Holster & Draw Flourish
    if (weaponSwitchProgress > 0.01) {
      localY -= 0.18 * weaponSwitchProgress;
      localRotX += 0.48 * weaponSwitchProgress;
      localRotZ -= 0.34 * weaponSwitchProgress;
    }

    // Per-Weapon Reload Weapon Tilt & Bolt Pull Choreography (Shared across FPV & TPV!)
    let reloadBoltPull = 0;
    const runCantZ = moveFactor * 0.16;
    if (isReloading) {
      if (activeWeapon === 'm4a1') {
        if (reloadProgress < 0.34) {
          const t = reloadProgress / 0.34;
          const ease = Math.sin(t * Math.PI * 0.5);
          localX += 0.042 * ease;
          localY -= 0.038 * ease;
          localRotX -= 0.22 * ease;
          localRotY -= 0.20 * ease;
          localRotZ -= 0.44 * ease + runCantZ;
        } else if (reloadProgress < 0.70) {
          const t = (reloadProgress - 0.34) / 0.36;
          const slam = t > 0.72 ? Math.sin(((t - 0.72) / 0.28) * Math.PI) : 0;
          localX += 0.042;
          localY += -0.038 + slam * 0.036;
          localRotX += -0.22 + slam * 0.14;
          localRotY -= 0.20;
          localRotZ += -0.44 + slam * 0.12 - runCantZ;
        } else {
          const t = (reloadProgress - 0.70) / 0.30;
          const returnEase = 1 - t * t * (3 - 2 * t);
          const slap = Math.sin(t * Math.PI);
          localX += 0.042 * returnEase + slap * 0.018;
          localY += -0.038 * returnEase;
          localZ -= slap * 0.026;
          localRotX += -0.22 * returnEase - slap * 0.14;
          localRotY += -0.20 * returnEase + slap * 0.10;
          localRotZ += (-0.44 - runCantZ) * returnEase + slap * 0.22;
          reloadBoltPull = slap * 0.062;
        }
      } else if (activeWeapon === 'ak47') {
        if (reloadProgress < 0.34) {
          const t = reloadProgress / 0.34;
          const ease = Math.sin(t * Math.PI * 0.5);
          localX += 0.048 * ease;
          localY -= 0.036 * ease;
          localRotX -= 0.28 * ease;
          localRotY -= 0.24 * ease;
          localRotZ -= 0.52 * ease + runCantZ;
        } else if (reloadProgress < 0.68) {
          const t = (reloadProgress - 0.34) / 0.34;
          const rockLock = t > 0.68 ? Math.sin(((t - 0.68) / 0.32) * Math.PI) : 0;
          localX += 0.048;
          localY += -0.036 + rockLock * 0.038;
          localRotX += -0.28 + rockLock * 0.16;
          localRotY -= 0.24;
          localRotZ += -0.52 - runCantZ;
        } else {
          const t = (reloadProgress - 0.68) / 0.32;
          const returnEase = 1 - t * t * (3 - 2 * t);
          const rackWave = Math.sin(t * Math.PI);
          localX += 0.048 * returnEase - rackWave * 0.024;
          localY += -0.036 * returnEase - rackWave * 0.022;
          localZ -= rackWave * 0.038;
          localRotX += -0.28 * returnEase - rackWave * 0.16;
          localRotY += -0.24 * returnEase + rackWave * 0.18;
          localRotZ += (-0.52 - runCantZ) * returnEase + rackWave * 0.56;
          reloadBoltPull = rackWave * 0.078;
        }
      } else if (activeWeapon === 'mp5') {
        if (reloadProgress < 0.24) {
          const t = reloadProgress / 0.24;
          const lockPull = Math.sin(t * Math.PI * 0.5);
          localX += 0.032 * lockPull;
          localY += 0.016 * lockPull;
          localRotX -= 0.16 * lockPull;
          localRotY -= 0.22 * lockPull;
          localRotZ -= 0.34 * lockPull + runCantZ;
          reloadBoltPull = lockPull * 0.055;
        } else if (reloadProgress < 0.72) {
          const t = (reloadProgress - 0.24) / 0.48;
          reloadBoltPull = 0.055;
          const slam = t > 0.80 ? Math.sin(((t - 0.80) / 0.20) * Math.PI) : 0;
          localX += 0.038;
          localY += -0.032 + slam * 0.032;
          localRotX += -0.20 + slam * 0.12;
          localRotY -= 0.22;
          localRotZ += -0.40 - runCantZ;
        } else {
          const t = (reloadProgress - 0.72) / 0.28;
          const slapImpact =
            t > 0.35 && t < 0.75 ? Math.sin(((t - 0.35) / 0.4) * Math.PI) : 0;
          const returnEase = 1 - t * t * (3 - 2 * t);
          reloadBoltPull = t < 0.42 ? 0.055 : 0;
          localX += 0.038 * returnEase;
          localY += -0.032 * returnEase - slapImpact * 0.034;
          localRotX += -0.20 * returnEase + slapImpact * 0.16;
          localRotY += -0.22 * returnEase;
          localRotZ += (-0.40 - runCantZ) * returnEase + slapImpact * 0.24;
        }
      } else if (activeWeapon === 'spas12') {
        if (reloadProgress < 0.76) {
          const cradleEase =
            reloadProgress < 0.14
              ? Math.sin((reloadProgress / 0.14) * Math.PI * 0.5)
              : 1.0;
          const shellPhase =
            reloadProgress >= 0.12 ? ((reloadProgress - 0.12) / 0.64) * 4.0 : 0;
          const shellFrac = shellPhase - Math.floor(shellPhase);
          const thumbThrust = reloadProgress >= 0.12 ? Math.sin(shellFrac * Math.PI) : 0;
          localX += 0.052 * cradleEase;
          localY += -0.028 * cradleEase + thumbThrust * 0.022;
          localZ += thumbThrust * 0.016;
          localRotX += -0.26 * cradleEase + thumbThrust * 0.10;
          localRotY -= 0.28 * cradleEase;
          localRotZ += -0.64 * cradleEase + thumbThrust * 0.08 - runCantZ;
        } else {
          const t = (reloadProgress - 0.76) / 0.24;
          const returnEase = 1 - t * t * (3 - 2 * t);
          const pumpRack = Math.sin(t * Math.PI);
          localX += 0.052 * returnEase;
          localY += -0.028 * returnEase - pumpRack * 0.022;
          localZ -= pumpRack * 0.044;
          localRotX += -0.26 * returnEase - pumpRack * 0.20;
          localRotY += -0.28 * returnEase;
          localRotZ += (-0.64 - runCantZ) * returnEase;
          reloadBoltPull = pumpRack * 0.085;
        }
      } else if (activeWeapon === 'awp') {
        if (reloadProgress < 0.56) {
          const t = reloadProgress / 0.56;
          const lockImpulse =
            t > 0.80 ? Math.sin(((t - 0.80) / 0.20) * Math.PI) : 0;
          const ease = Math.sin(Math.min(1, t * 2) * Math.PI * 0.5);
          localX += 0.04 * ease;
          localY += -0.044 * ease + lockImpulse * 0.034;
          localRotX += -0.22 * ease + lockImpulse * 0.14;
          localRotY -= 0.18 * ease;
          localRotZ += -0.34 * ease - runCantZ;
        } else {
          const t = (reloadProgress - 0.56) / 0.44;
          const returnEase = 1 - t * t * (3 - 2 * t);
          const boltCycle = Math.sin(t * Math.PI);
          const boltLift = t < 0.25 ? t / 0.25 : t > 0.75 ? (1 - t) / 0.25 : 1.0;
          localX += 0.04 * returnEase - boltCycle * 0.02;
          localY += -0.044 * returnEase - boltCycle * 0.018;
          localZ -= boltCycle * 0.038;
          localRotX += -0.22 * returnEase - boltCycle * 0.14;
          localRotY += -0.18 * returnEase - boltCycle * 0.10;
          localRotZ += (-0.34 - runCantZ) * returnEase + boltLift * 0.24;
          reloadBoltPull = boltCycle * 0.088;
        }
      } else {
        // Desert Eagle .50 AE
        if (reloadProgress < 0.34) {
          const t = reloadProgress / 0.34;
          const ease = Math.sin(t * Math.PI * 0.5);
          localX += 0.065 * ease;
          localY += 0.028 * ease;
          localRotX -= 0.28 * ease;
          localRotY -= 0.32 * ease;
          localRotZ -= 0.58 * ease + runCantZ;
        } else if (reloadProgress < 0.68) {
          const t = (reloadProgress - 0.34) / 0.34;
          const palmSlam =
            t > 0.72 ? Math.sin(((t - 0.72) / 0.28) * Math.PI) : 0;
          localX += 0.065;
          localY += 0.028 + palmSlam * 0.042;
          localRotX += -0.28 + palmSlam * 0.20;
          localRotY -= 0.32;
          localRotZ += -0.58 + palmSlam * 0.14 - runCantZ;
        } else {
          const t = (reloadProgress - 0.68) / 0.32;
          const returnEase = 1 - t * t * (3 - 2 * t);
          const slideRack = Math.sin(t * Math.PI);
          localX += 0.065 * returnEase;
          localY += 0.028 * returnEase - slideRack * 0.022;
          localZ -= slideRack * 0.036;
          localRotX += -0.28 * returnEase - slideRack * 0.16;
          localRotY += -0.32 * returnEase + slideRack * 0.14;
          localRotZ += (-0.58 - runCantZ) * returnEase + slideRack * 0.22;
          reloadBoltPull = slideRack * 0.058;
        }
      }
    }

    targets.weaponMountX = localX;
    targets.weaponMountY = localY;
    targets.weaponMountZ = localZ;
    targets.weaponMountRotX = localRotX;
    targets.weaponMountRotY = localRotY;
    targets.weaponMountRotZ = localRotZ;
    targets.showWeapon = true;

    rig.root.userData.lastReloadBoltPull = reloadBoltPull;
  }

  // Smooth exponential damping across ALL pose and locomotion transitions
  let animState = rig.root.userData.animState as
    | (RigPoseTargets & { lastTimeSec: number })
    | undefined;
  const isFirstFrame = !animState || animState.lastTimeSec < 0;
  if (!animState) {
    animState = createDefaultRigPoseTargets();
    rig.root.userData.animState = animState;
  }

  const rawDt = isFirstFrame ? 1 : timeSec - animState.lastTimeSec;
  const dt = isFirstFrame ? 1 : Math.min(0.1, Math.max(0.001, rawDt));
  const dampRate = pose === 'combat' ? 28 : 14;
  const alpha =
    isFirstFrame || rawDt <= 0 || rawDt >= 0.5 ? 1 : 1 - Math.exp(-dampRate * dt);

  animState.hipsY += (targets.hipsY - animState.hipsY) * alpha;
  animState.hipsX += (targets.hipsX - animState.hipsX) * alpha;
  animState.hipsRotX += (targets.hipsRotX - animState.hipsRotX) * alpha;
  animState.hipsRotY += (targets.hipsRotY - animState.hipsRotY) * alpha;
  animState.hipsRotZ += (targets.hipsRotZ - animState.hipsRotZ) * alpha;
  animState.torsoRotX += (targets.torsoRotX - animState.torsoRotX) * alpha;
  animState.torsoRotY += (targets.torsoRotY - animState.torsoRotY) * alpha;
  animState.torsoRotZ += (targets.torsoRotZ - animState.torsoRotZ) * alpha;
  animState.neckRotX += (targets.neckRotX - animState.neckRotX) * alpha;
  animState.neckRotY += (targets.neckRotY - animState.neckRotY) * alpha;
  animState.headRotX += (targets.headRotX - animState.headRotX) * alpha;
  animState.headRotY += (targets.headRotY - animState.headRotY) * alpha;
  animState.headRotZ += (targets.headRotZ - animState.headRotZ) * alpha;
  animState.lShoulderX += (targets.lShoulderX - animState.lShoulderX) * alpha;
  animState.lShoulderY += (targets.lShoulderY - animState.lShoulderY) * alpha;
  animState.lShoulderZ += (targets.lShoulderZ - animState.lShoulderZ) * alpha;
  animState.lElbowX += (targets.lElbowX - animState.lElbowX) * alpha;
  animState.lElbowY += (targets.lElbowY - animState.lElbowY) * alpha;
  animState.lElbowZ += (targets.lElbowZ - animState.lElbowZ) * alpha;
  animState.rShoulderX += (targets.rShoulderX - animState.rShoulderX) * alpha;
  animState.rShoulderY += (targets.rShoulderY - animState.rShoulderY) * alpha;
  animState.rShoulderZ += (targets.rShoulderZ - animState.rShoulderZ) * alpha;
  animState.rElbowX += (targets.rElbowX - animState.rElbowX) * alpha;
  animState.rElbowY += (targets.rElbowY - animState.rElbowY) * alpha;
  animState.rElbowZ += (targets.rElbowZ - animState.rElbowZ) * alpha;
  animState.lHipX += (targets.lHipX - animState.lHipX) * alpha;
  animState.lHipY += (targets.lHipY - animState.lHipY) * alpha;
  animState.lHipZ += (targets.lHipZ - animState.lHipZ) * alpha;
  animState.lKneeX += (targets.lKneeX - animState.lKneeX) * alpha;
  animState.rHipX += (targets.rHipX - animState.rHipX) * alpha;
  animState.rHipY += (targets.rHipY - animState.rHipY) * alpha;
  animState.rHipZ += (targets.rHipZ - animState.rHipZ) * alpha;
  animState.rKneeX += (targets.rKneeX - animState.rKneeX) * alpha;
  animState.weaponMountX += (targets.weaponMountX - animState.weaponMountX) * alpha;
  animState.weaponMountY += (targets.weaponMountY - animState.weaponMountY) * alpha;
  animState.weaponMountZ += (targets.weaponMountZ - animState.weaponMountZ) * alpha;
  animState.weaponMountRotX +=
    (targets.weaponMountRotX - animState.weaponMountRotX) * alpha;
  animState.weaponMountRotY +=
    (targets.weaponMountRotY - animState.weaponMountRotY) * alpha;
  animState.weaponMountRotZ +=
    (targets.weaponMountRotZ - animState.weaponMountRotZ) * alpha;
  animState.showWeapon = targets.showWeapon;
  animState.lastTimeSec = timeSec;

  rig.hipsPivot.position.set(animState.hipsX, animState.hipsY, 0);
  rig.hipsPivot.rotation.set(
    animState.hipsRotX,
    animState.hipsRotY,
    animState.hipsRotZ
  );
  rig.torsoPivot.rotation.set(
    animState.torsoRotX,
    animState.torsoRotY,
    animState.torsoRotZ
  );
  rig.neckPivot.rotation.set(animState.neckRotX, animState.neckRotY, 0);
  rig.headPivot.rotation.set(
    animState.headRotX,
    animState.headRotY,
    animState.headRotZ
  );

  rig.leftHipPivot.rotation.set(animState.lHipX, animState.lHipY, animState.lHipZ);
  rig.leftKneePivot.rotation.set(animState.lKneeX, 0, 0);
  rig.rightHipPivot.rotation.set(animState.rHipX, animState.rHipY, animState.rHipZ);
  rig.rightKneePivot.rotation.set(animState.rKneeX, 0, 0);

  if (pose === 'combat') {
    const clampedPitch = THREE.MathUtils.clamp(aimPitch, -1.35, 1.35);
    const eyePivotY = THREE.MathUtils.lerp(0.62, 0.58, adsBlend);
    const eyePivotZ = 0.18;
    const remPitch = -clampedPitch - (animState.hipsRotX + animState.torsoRotX);
    const relY = animState.weaponMountY - eyePivotY;
    const relZ = animState.weaponMountZ - eyePivotZ;
    const cosRem = Math.cos(remPitch);
    const sinRem = Math.sin(remPitch);

    // Prevent downward aim (remPitch > 0) from swinging weaponMount backward (-Z) into the chest/abdomen
    const forwardPitchArcZ =
      relY >= 0 || sinRem <= 0
        ? relY * sinRem + relZ * cosRem
        : relZ * Math.max(0.78, cosRem) + sinRem * 0.06;

    rig.weaponMount.position.set(
      animState.weaponMountX,
      eyePivotY + relY * cosRem - relZ * sinRem,
      eyePivotZ + forwardPitchArcZ
    );
    rig.weaponMount.rotation.set(
      THREE.MathUtils.clamp(remPitch + animState.weaponMountRotX, -1.42, 1.12),
      animState.weaponMountRotY,
      animState.weaponMountRotZ
    );
    enforceWeaponBodyClearance(
      rig.weaponMount.position,
      rig.weaponMount.rotation,
      activeWeapon,
      charProp.torsoWidth,
      charProp.headScale,
      animState.neckRotX + animState.headRotX
    );
  } else {
    rig.weaponMount.position.set(
      animState.weaponMountX,
      animState.weaponMountY,
      animState.weaponMountZ
    );
    rig.weaponMount.rotation.set(
      animState.weaponMountRotX,
      animState.weaponMountRotY,
      animState.weaponMountRotZ
    );
    if (pose === 'inspect') {
      enforceWeaponBodyClearance(
        rig.weaponMount.position,
        rig.weaponMount.rotation,
        activeWeapon,
        charProp.torsoWidth,
        charProp.headScale,
        animState.neckRotX + animState.headRotX
      );
    }
  }
  rig.weaponMount.visible = animState.showWeapon;

  // Always keep arm and hand pivots at 100% natural, undistorted (1, 1, 1) scale
  rig.leftElbowPivot.scale.set(1, 1, 1);
  rig.rightElbowPivot.scale.set(1, 1, 1);
  rig.leftHandPivot.scale.set(1, 1, 1);
  rig.rightHandPivot.scale.set(1, 1, 1);

  if (pose === 'combat' || pose === 'inspect') {
    const wp = WEAPON_HOLD_PROFILES[activeWeapon] || WEAPON_HOLD_PROFILES.m4a1;
    const vm =
      combatKinematics?.weaponRig ??
      (rig.weaponMount.children[0]?.userData?.weaponRig as
        | WeaponViewModelRig
        | undefined);
    const reloadBoltPull =
      pose === 'combat' ? (rig.root.userData.lastReloadBoltPull as number) || 0 : 0;

    // Default sockets in weapon (vm) local space
    if (vm) {
      _socketRightLocal.copy(vm.rightHandSocket);
      _socketLeftLocal.copy(vm.leftHandSocket);
    } else {
      _socketRightLocal.set(0, -0.056, 0.116);
      _socketLeftLocal.set(0, -0.012, -0.175);
    }

    // Mechanical weapon animations & hand-locked choreography on the unified weaponRig
    if (vm) {
      let lockMagToLeftHand = false;
      vm.magazine.visible = activeWeapon !== 'spas12' || (pose === 'combat' && isReloading);

      // SPAS-12 Pump-Action Foregrip Rack between shots, during reload, and during Lobby inspect check
      if (vm.pumpGrip && activeWeapon === 'spas12') {
        const cdRatio = combatKinematics?.fireCooldownRatio ?? 0;
        const inspectPumpWave =
          pose === 'inspect'
            ? Math.max(0, Math.sin(timeSec * wp.inspectFreq - 1.1) - 0.55) / 0.45
            : 0;
        const inspectPumpShift = Math.sin(inspectPumpWave * Math.PI) * 0.068;
        const pumpShift =
          pose === 'combat'
            ? cdRatio > 0.20 && cdRatio < 0.86
              ? Math.sin(((cdRatio - 0.20) / 0.66) * Math.PI) * 0.078
              : reloadBoltPull
            : inspectPumpShift;
        vm.pumpGrip.position.z = vm.pumpBaseZ + pumpShift;
        if (!isReloading || pose === 'inspect') {
          _socketLeftLocal.set(
            vm.leftHandSocket.x,
            vm.leftHandSocket.y,
            vm.pumpGrip.position.z
          );
        }
      }

      // AWP Bolt-Action Right-Hand Bolt Cycle between sniper shots and during Lobby inspect check
      let awpInterShotBoltLift = 0;
      let awpInterShotBoltPull = 0;
      if (activeWeapon === 'awp' && !isReloading) {
        const cdRatio = combatKinematics?.fireCooldownRatio ?? 0;
        if (pose === 'combat' && cdRatio > 0.18 && cdRatio < 0.88) {
          const bt = (cdRatio - 0.18) / 0.70;
          awpInterShotBoltLift =
            bt < 0.25 ? bt / 0.25 : bt > 0.75 ? (1 - bt) / 0.25 : 1.0;
          awpInterShotBoltPull = Math.sin(bt * Math.PI) * 0.082;
          vm.slideOrBolt.rotation.z = -awpInterShotBoltLift * 0.68;
          _grabPointLocal.set(0.036, 0.038, vm.slideBaseZ + awpInterShotBoltPull);
          _socketRightLocal.lerpVectors(
            vm.rightHandSocket,
            _grabPointLocal,
            awpInterShotBoltLift
          );
        } else if (pose === 'inspect') {
          const checkWave =
            Math.max(0, Math.sin(timeSec * wp.inspectFreq - 1.2) - 0.6) / 0.4;
          awpInterShotBoltLift = Math.sin(checkWave * Math.PI);
          awpInterShotBoltPull = awpInterShotBoltLift * 0.045;
          vm.slideOrBolt.rotation.z = -awpInterShotBoltLift * 0.52;
        } else {
          vm.slideOrBolt.rotation.z = 0;
        }
      }

      if (pose === 'combat' && isReloading) {
        _grabPointLocal.set(
          vm.magBasePos.x - 0.012,
          vm.magBasePos.y - 0.024,
          vm.magBasePos.z
        );
        if (activeWeapon === 'm4a1') {
          if (reloadProgress < 0.34) {
            const t = reloadProgress / 0.34;
            if (t < 0.34) {
              const reachT = t / 0.34;
              vm.magazine.visible = true;
              vm.magazine.position.copy(vm.magBasePos);
              vm.magazine.rotation.set(-0.11, 0, 0);
              _socketLeftLocal.lerpVectors(vm.leftHandSocket, _grabPointLocal, reachT);
            } else if (t < 0.88) {
              const pullT = (t - 0.34) / 0.54;
              const pullEase = pullT * pullT;
              vm.magazine.visible = true;
              lockMagToLeftHand = true;
              vm.magazine.rotation.set(-0.11 + 0.22 * pullEase, 0, 0.12 * pullEase);
              _socketLeftLocal.set(
                _grabPointLocal.x - 0.015 * pullEase,
                _grabPointLocal.y - 0.26 * pullEase,
                _grabPointLocal.z + 0.08 * pullEase
              );
            } else {
              vm.magazine.visible = false;
              _socketLeftLocal.set(
                _grabPointLocal.x - 0.018,
                _grabPointLocal.y - 0.28,
                _grabPointLocal.z + 0.09
              );
            }
          } else if (reloadProgress < 0.70) {
            const t = (reloadProgress - 0.34) / 0.36;
            const slam = t > 0.72 ? Math.sin(((t - 0.72) / 0.28) * Math.PI) : 0;
            if (t < 0.10) {
              vm.magazine.visible = false;
              _socketLeftLocal.set(
                _grabPointLocal.x - 0.018,
                _grabPointLocal.y - 0.28,
                _grabPointLocal.z + 0.09
              );
            } else if (t < 0.72) {
              const insT = (t - 0.10) / 0.62;
              const insEase = 1 - (1 - insT) * (1 - insT);
              vm.magazine.visible = true;
              lockMagToLeftHand = true;
              vm.magazine.rotation.set(-0.11 + 0.18 * (1 - insEase), 0, 0);
              _socketLeftLocal.set(
                _grabPointLocal.x - 0.015 * (1 - insEase),
                _grabPointLocal.y - 0.26 * (1 - insEase),
                _grabPointLocal.z + 0.08 * (1 - insEase)
              );
            } else {
              vm.magazine.visible = true;
              vm.magazine.position.copy(vm.magBasePos);
              vm.magazine.rotation.set(-0.11, 0, 0);
              _socketLeftLocal.set(
                _grabPointLocal.x,
                _grabPointLocal.y - 0.018 + slam * 0.022,
                _grabPointLocal.z
              );
            }
          } else {
            const t = (reloadProgress - 0.70) / 0.30;
            vm.magazine.visible = true;
            vm.magazine.position.copy(vm.magBasePos);
            vm.magazine.rotation.set(-0.11, 0, 0);
            _grabPointLocal.set(-0.026, 0.042, 0.11 + reloadBoltPull);
            _socketLeftLocal.lerpVectors(_grabPointLocal, vm.leftHandSocket, t);
          }
        } else if (activeWeapon === 'ak47') {
          if (reloadProgress < 0.34) {
            const t = reloadProgress / 0.34;
            if (t < 0.32) {
              const reachT = t / 0.32;
              vm.magazine.visible = true;
              vm.magazine.position.copy(vm.magBasePos);
              vm.magazine.rotation.set(0, 0, 0);
              _socketLeftLocal.lerpVectors(vm.leftHandSocket, _grabPointLocal, reachT);
            } else if (t < 0.88) {
              const pullT = (t - 0.32) / 0.56;
              const pullEase = pullT * pullT;
              vm.magazine.visible = true;
              lockMagToLeftHand = true;
              vm.magazine.rotation.set(-0.42 * Math.min(1, pullT * 1.4), 0, 0);
              _socketLeftLocal.set(
                _grabPointLocal.x,
                _grabPointLocal.y - 0.26 * pullEase,
                _grabPointLocal.z + 0.07 * pullEase
              );
            } else {
              vm.magazine.visible = false;
              _socketLeftLocal.set(
                _grabPointLocal.x - 0.015,
                _grabPointLocal.y - 0.28,
                _grabPointLocal.z + 0.08
              );
            }
          } else if (reloadProgress < 0.68) {
            const t = (reloadProgress - 0.34) / 0.34;
            const rockLock = t > 0.68 ? Math.sin(((t - 0.68) / 0.32) * Math.PI) : 0;
            if (t < 0.10) {
              vm.magazine.visible = false;
              _socketLeftLocal.set(
                _grabPointLocal.x - 0.015,
                _grabPointLocal.y - 0.28,
                _grabPointLocal.z + 0.08
              );
            } else if (t < 0.72) {
              const insT = (t - 0.10) / 0.62;
              const insEase = 1 - (1 - insT) * (1 - insT);
              const rockAngle = (1 - insEase) * -0.42;
              vm.magazine.visible = true;
              lockMagToLeftHand = true;
              vm.magazine.rotation.set(rockAngle, 0, 0);
              _socketLeftLocal.set(
                _grabPointLocal.x,
                _grabPointLocal.y - 0.26 * (1 - insEase),
                _grabPointLocal.z + 0.06 * (1 - insEase)
              );
            } else {
              vm.magazine.visible = true;
              vm.magazine.position.copy(vm.magBasePos);
              vm.magazine.rotation.set(0, 0, 0);
              _socketLeftLocal.set(
                _grabPointLocal.x,
                _grabPointLocal.y - 0.016 + rockLock * 0.02,
                _grabPointLocal.z
              );
            }
          } else {
            const t = (reloadProgress - 0.68) / 0.32;
            vm.magazine.visible = true;
            vm.magazine.position.copy(vm.magBasePos);
            vm.magazine.rotation.set(0, 0, 0);
            _grabPointLocal.set(0.032, 0.036, vm.slideBaseZ + reloadBoltPull);
            _socketLeftLocal.lerpVectors(
              _grabPointLocal,
              vm.leftHandSocket,
              t > 0.72 ? (t - 0.72) / 0.28 : 0
            );
          }
        } else if (activeWeapon === 'mp5') {
          if (reloadProgress < 0.24) {
            vm.magazine.visible = true;
            vm.magazine.position.copy(vm.magBasePos);
            vm.magazine.rotation.set(-0.13, 0, 0);
            _socketLeftLocal.set(-0.024, 0.042, vm.slideBaseZ + reloadBoltPull);
          } else if (reloadProgress < 0.72) {
            const t = (reloadProgress - 0.24) / 0.48;
            const slam = t > 0.80 ? Math.sin(((t - 0.80) / 0.20) * Math.PI) : 0;
            if (t < 0.16) {
              const reachT = t / 0.16;
              vm.magazine.visible = true;
              vm.magazine.position.copy(vm.magBasePos);
              vm.magazine.rotation.set(-0.13, 0, 0);
              _socketLeftLocal.set(
                THREE.MathUtils.lerp(-0.024, _grabPointLocal.x, reachT),
                THREE.MathUtils.lerp(0.042, _grabPointLocal.y, reachT),
                THREE.MathUtils.lerp(vm.slideBaseZ + 0.055, _grabPointLocal.z, reachT)
              );
            } else if (t < 0.44) {
              const pullT = (t - 0.16) / 0.28;
              const pullEase = pullT * pullT;
              vm.magazine.visible = true;
              lockMagToLeftHand = true;
              vm.magazine.rotation.set(-0.13 - 0.16 * pullEase, 0, 0);
              _socketLeftLocal.set(
                _grabPointLocal.x,
                _grabPointLocal.y - 0.24 * pullEase,
                _grabPointLocal.z + 0.06 * pullEase
              );
            } else if (t < 0.54) {
              vm.magazine.visible = false;
              _socketLeftLocal.set(
                _grabPointLocal.x - 0.012,
                _grabPointLocal.y - 0.26,
                _grabPointLocal.z + 0.07
              );
            } else if (t < 0.82) {
              const insT = (t - 0.54) / 0.28;
              const insEase = 1 - (1 - insT) * (1 - insT);
              vm.magazine.visible = true;
              lockMagToLeftHand = true;
              vm.magazine.rotation.set(-0.13 - 0.14 * (1 - insEase), 0, 0);
              _socketLeftLocal.set(
                _grabPointLocal.x,
                _grabPointLocal.y - 0.24 * (1 - insEase),
                _grabPointLocal.z + 0.06 * (1 - insEase)
              );
            } else {
              vm.magazine.visible = true;
              vm.magazine.position.copy(vm.magBasePos);
              vm.magazine.rotation.set(-0.13, 0, 0);
              _socketLeftLocal.set(
                _grabPointLocal.x,
                _grabPointLocal.y - 0.015 + slam * 0.02,
                _grabPointLocal.z
              );
            }
          } else {
            const t = (reloadProgress - 0.72) / 0.28;
            vm.magazine.visible = true;
            vm.magazine.position.copy(vm.magBasePos);
            vm.magazine.rotation.set(-0.13, 0, 0);
            const slapArcY =
              t < 0.42
                ? 0.08 * Math.sin((t / 0.42) * Math.PI * 0.5)
                : 0.08 * (1 - (t - 0.42) / 0.58);
            _grabPointLocal.set(-0.028, 0.038 + slapArcY, vm.slideBaseZ + 0.02);
            _socketLeftLocal.lerpVectors(
              _grabPointLocal,
              vm.leftHandSocket,
              t > 0.65 ? (t - 0.65) / 0.35 : 0
            );
          }
        } else if (activeWeapon === 'spas12') {
          if (reloadProgress < 0.76) {
            const shellPhase =
              reloadProgress >= 0.12 ? ((reloadProgress - 0.12) / 0.64) * 4.0 : 0;
            const shellFrac = shellPhase - Math.floor(shellPhase);
            const thumbThrust =
              reloadProgress >= 0.12 ? Math.sin(shellFrac * Math.PI) : 0;
            vm.magazine.visible = reloadProgress >= 0.12 && shellFrac < 0.86;
            lockMagToLeftHand = vm.magazine.visible;
            const shellY = -0.18 * (1 - shellFrac);
            const shellZ = 0.04 * (1 - shellFrac) - 0.025 * thumbThrust;
            vm.magazine.rotation.set(-0.22 * (1 - shellFrac), 0, 0);
            _socketLeftLocal.set(
              vm.magBasePos.x - 0.012,
              vm.magBasePos.y - 0.024 + shellY + thumbThrust * 0.016,
              vm.magBasePos.z + shellZ
            );
          } else {
            vm.magazine.position.copy(vm.magBasePos);
            vm.magazine.visible = false;
            _socketLeftLocal.set(
              vm.leftHandSocket.x,
              vm.leftHandSocket.y,
              vm.pumpBaseZ + reloadBoltPull
            );
          }
        } else if (activeWeapon === 'awp') {
          if (reloadProgress < 0.56) {
            const t = reloadProgress / 0.56;
            const lockImpulse =
              t > 0.80 ? Math.sin(((t - 0.80) / 0.20) * Math.PI) : 0;
            if (t < 0.18) {
              const reachT = t / 0.18;
              vm.magazine.visible = true;
              vm.magazine.position.copy(vm.magBasePos);
              vm.magazine.rotation.set(0, 0, 0);
              _socketLeftLocal.lerpVectors(vm.leftHandSocket, _grabPointLocal, reachT);
            } else if (t < 0.45) {
              const pullT = (t - 0.18) / 0.27;
              const pullEase = pullT * pullT;
              vm.magazine.visible = true;
              lockMagToLeftHand = true;
              vm.magazine.rotation.set(0.14 * pullEase, 0, 0);
              _socketLeftLocal.set(
                _grabPointLocal.x,
                _grabPointLocal.y - 0.26 * pullEase,
                _grabPointLocal.z + 0.06 * pullEase
              );
            } else if (t < 0.55) {
              vm.magazine.visible = false;
              _socketLeftLocal.set(
                _grabPointLocal.x - 0.014,
                _grabPointLocal.y - 0.28,
                _grabPointLocal.z + 0.07
              );
            } else if (t < 0.82) {
              const insT = (t - 0.55) / 0.27;
              const insEase = 1 - (1 - insT) * (1 - insT);
              vm.magazine.visible = true;
              lockMagToLeftHand = true;
              vm.magazine.rotation.set(0.12 * (1 - insEase), 0, 0);
              _socketLeftLocal.set(
                _grabPointLocal.x,
                _grabPointLocal.y - 0.26 * (1 - insEase),
                _grabPointLocal.z + 0.06 * (1 - insEase)
              );
            } else {
              vm.magazine.visible = true;
              vm.magazine.position.copy(vm.magBasePos);
              vm.magazine.rotation.set(0, 0, 0);
              _socketLeftLocal.set(
                _grabPointLocal.x,
                _grabPointLocal.y - 0.015 + lockImpulse * 0.02,
                _grabPointLocal.z
              );
            }
          } else {
            const t = (reloadProgress - 0.56) / 0.44;
            const boltLift = t < 0.25 ? t / 0.25 : t > 0.75 ? (1 - t) / 0.25 : 1.0;
            vm.slideOrBolt.rotation.z = -boltLift * 0.68;
            vm.magazine.visible = true;
            vm.magazine.position.copy(vm.magBasePos);
            vm.magazine.rotation.set(0, 0, 0);
            _socketLeftLocal.copy(vm.leftHandSocket);
            _grabPointLocal.set(0.036, 0.038, vm.slideBaseZ + reloadBoltPull);
            _socketRightLocal.lerpVectors(vm.rightHandSocket, _grabPointLocal, boltLift);
          }
        } else {
          // Desert Eagle .50 AE
          if (reloadProgress < 0.34) {
            const t = reloadProgress / 0.34;
            if (t < 0.30) {
              const reachT = t / 0.30;
              vm.magazine.visible = true;
              vm.magazine.position.copy(vm.magBasePos);
              vm.magazine.rotation.set(0, 0, 0);
              _socketLeftLocal.lerpVectors(vm.leftHandSocket, _grabPointLocal, reachT);
            } else if (t < 0.88) {
              const pullT = (t - 0.30) / 0.58;
              const pullEase = pullT * pullT;
              vm.magazine.visible = true;
              lockMagToLeftHand = true;
              vm.magazine.rotation.set(0.20 * pullEase, 0, 0);
              _socketLeftLocal.set(
                _grabPointLocal.x,
                _grabPointLocal.y - 0.22 * pullEase,
                _grabPointLocal.z + 0.06 * pullEase
              );
            } else {
              vm.magazine.visible = false;
              _socketLeftLocal.set(
                _grabPointLocal.x - 0.01,
                _grabPointLocal.y - 0.24,
                _grabPointLocal.z + 0.07
              );
            }
          } else if (reloadProgress < 0.68) {
            const t = (reloadProgress - 0.34) / 0.34;
            const palmSlam =
              t > 0.72 ? Math.sin(((t - 0.72) / 0.28) * Math.PI) : 0;
            if (t < 0.10) {
              vm.magazine.visible = false;
              _socketLeftLocal.set(
                _grabPointLocal.x - 0.01,
                _grabPointLocal.y - 0.24,
                _grabPointLocal.z + 0.07
              );
            } else if (t < 0.74) {
              const insT = (t - 0.10) / 0.64;
              const insEase = 1 - (1 - insT) * (1 - insT);
              vm.magazine.visible = true;
              lockMagToLeftHand = true;
              vm.magazine.rotation.set(0.16 * (1 - insEase), 0, 0);
              _socketLeftLocal.set(
                _grabPointLocal.x,
                _grabPointLocal.y - 0.22 * (1 - insEase),
                _grabPointLocal.z + 0.06 * (1 - insEase)
              );
            } else {
              vm.magazine.visible = true;
              vm.magazine.position.copy(vm.magBasePos);
              vm.magazine.rotation.set(0, 0, 0);
              _socketLeftLocal.set(
                _grabPointLocal.x,
                _grabPointLocal.y - 0.014 + palmSlam * 0.018,
                _grabPointLocal.z
              );
            }
          } else {
            const t = (reloadProgress - 0.68) / 0.32;
            vm.magazine.visible = true;
            vm.magazine.position.copy(vm.magBasePos);
            vm.magazine.rotation.set(0, 0, 0);
            _grabPointLocal.set(-0.015, 0.052, vm.slideBaseZ + reloadBoltPull);
            _socketLeftLocal.lerpVectors(
              _grabPointLocal,
              vm.leftHandSocket,
              t > 0.72 ? (t - 0.72) / 0.28 : 0
            );
          }
        }
      } else {
        vm.magazine.position.copy(vm.magBasePos);
        vm.magazine.rotation.set(
          activeWeapon === 'm4a1'
            ? -0.11
            : activeWeapon === 'mp5'
              ? -0.13
              : 0,
          0,
          0
        );
      }

      if (lockMagToLeftHand) {
        vm.magazine.position.set(
          _socketLeftLocal.x + 0.012,
          _socketLeftLocal.y + 0.024,
          _socketLeftLocal.z
        );
      }

      // Articulated Trigger Squeeze, Fire Selector & Slide/Bolt Reciprocation
      const trigBlend = pose === 'combat' ? combatKinematics?.triggerPullBlend ?? 0 : 0;
      vm.triggerBlade.position.z = vm.triggerBaseZ + trigBlend * 0.0075;
      vm.triggerBlade.rotation.x = 0.35 + trigBlend * 0.36;

      const drawFlick =
        pose === 'combat' &&
        weaponSwitchProgress > 0.01 &&
        !(combatKinematics?.isFirstHalfSwap ?? false)
          ? Math.sin((combatKinematics?.swapHalfProgress ?? 0) * Math.PI) * 0.65
          : 0;
      vm.fireSelector.rotation.x =
        (activeWeapon === 'm4a1' || activeWeapon === 'ak47' || activeWeapon === 'mp5'
          ? 0.45
          : 0.0) - drawFlick;

      const emptyLock =
        pose === 'combat' &&
        (combatKinematics?.magAmmoCount ?? 1) === 0 &&
        !isReloading
          ? 0.038
          : 0;
      const showFlash = pose === 'combat' && Boolean(combatKinematics?.muzzleFlashActive);
      const shotKick = showFlash
        ? 0.055
        : Math.min(0.045, (recoilKick + (combatKinematics?.recoilKickPitch ?? 0)) * 0.26);
      vm.slideOrBolt.position.z =
        vm.slideBaseZ +
        Math.max(shotKick, reloadBoltPull, awpInterShotBoltPull, emptyLock);

      vm.muzzleFlashGroup.visible = showFlash;
      if (showFlash) {
        vm.muzzleFlashGroup.rotation.z = (timeSec * 43) % (Math.PI * 2);
        const fScale = 0.92 + Math.sin(timeSec * 120) * 0.25;
        vm.muzzleFlashGroup.scale.setScalar(fScale);
      }
    } else if (pose === 'combat' && isReloading) {
      // Fallback reload hand socket trajectory when called on a rig without a weaponRig attached
      const pullWave = Math.sin(reloadProgress * Math.PI);
      _socketLeftLocal.set(-0.012, -0.075 - pullWave * 0.24, 0.015 + pullWave * 0.08);
      if (activeWeapon === 'awp' && reloadProgress >= 0.56) {
        const boltWave = Math.sin(((reloadProgress - 0.56) / 0.44) * Math.PI);
        _socketRightLocal.set(0.036, 0.038 * boltWave, 0.04 + boltWave * 0.08);
      }
    }

    // Transform _socketRightLocal and _socketLeftLocal from weapon (vm) space -> weaponMount space -> torsoPivot space
    // Apply per-weapon contact offsets calibrated for the full-size (scale 1,1,1) rounded bulb hands so the upper/inner
    // palm surface cradles the grip and handguard cleanly without the sphere rising above the barrel centerline!
    _weaponQuat.setFromEuler(rig.weaponMount.rotation);

    _rightHandTargetTorso
      .set(
        -_socketRightLocal.x * 1.04 + wp.rightHandOffset[0],
        _socketRightLocal.y * 1.04 + wp.rightHandOffset[1],
        -_socketRightLocal.z * 1.04 + 0.035 + wp.rightHandOffset[2]
      )
      .applyQuaternion(_weaponQuat)
      .add(rig.weaponMount.position);

    const leftReloadLiftY = pose === 'combat' && isReloading ? 0.032 : 0;
    _leftHandTargetTorso
      .set(
        -_socketLeftLocal.x * 1.04 + wp.leftHandOffset[0],
        _socketLeftLocal.y * 1.04 + wp.leftHandOffset[1] + leftReloadLiftY,
        -_socketLeftLocal.z * 1.04 + 0.035 + wp.leftHandOffset[2]
      )
      .applyQuaternion(_weaponQuat)
      .add(rig.weaponMount.position);

    const strideBobOffset =
      pose === 'combat'
        ? Math.sin(combatWalkPhase) *
          0.026 *
          Math.min(1, combatMoveSpeed / 5.2) *
          (1 - adsBlend * 0.75)
        : 0;
    const shoulderY = THREE.MathUtils.clamp(
      0.415 + (rig.weaponMount.position.y - 0.42) * 0.22 - strideBobOffset,
      0.34,
      0.46
    );
    _ikPoleRight.set(wp.poleRight[0], wp.poleRight[1], wp.poleRight[2]);
    _ikPoleLeft.set(wp.poleLeft[0], wp.poleLeft[1], wp.poleLeft[2]);

    const rightArmShoulderPos = _grabPointLocal.set(
      -0.245 * charProp.torsoWidth,
      shoulderY,
      0.05
    );
    solveTwoBoneArmIK(
      rig.leftShoulderPivot,
      rig.leftElbowPivot,
      rightArmShoulderPos,
      _rightHandTargetTorso,
      _ikPoleRight,
      0.27,
      0.285
    );

    const leftArmShoulderPos = _grabPointLocal.set(
      0.182 * charProp.torsoWidth,
      shoulderY - 0.025,
      0.14
    );
    solveTwoBoneArmIK(
      rig.rightShoulderPivot,
      rig.rightElbowPivot,
      leftArmShoulderPos,
      _leftHandTargetTorso,
      _ikPoleLeft,
      0.27,
      0.285
    );
  } else {
    // Non-weapon poses (Idle, Walk, Run, Studio Neutral, Salute, Victory): restore standard shoulder positions & Euler rotations
    rig.leftShoulderPivot.position.set(-0.228 * charProp.torsoWidth, 0.435, 0);
    rig.rightShoulderPivot.position.set(0.228 * charProp.torsoWidth, 0.435, 0);

    rig.leftShoulderPivot.rotation.set(
      animState.lShoulderX,
      animState.lShoulderY,
      animState.lShoulderZ
    );
    rig.leftElbowPivot.rotation.set(
      animState.lElbowX,
      animState.lElbowY,
      animState.lElbowZ
    );

    rig.rightShoulderPivot.rotation.set(
      animState.rShoulderX,
      animState.rShoulderY,
      animState.rShoulderZ
    );
    rig.rightElbowPivot.rotation.set(
      animState.rElbowX,
      animState.rElbowY,
      animState.rElbowZ
    );
  }
}

let sharedHandheldMuzzleFlashTex: THREE.Texture | null = null;
function getSharedHandheldMuzzleFlashTex(): THREE.Texture {
  if (sharedHandheldMuzzleFlashTex) return sharedHandheldMuzzleFlashTex;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.35, 'rgba(253, 224, 71, 0.92)');
      grad.addColorStop(0.7, 'rgba(249, 115, 22, 0.55)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    sharedHandheldMuzzleFlashTex = new THREE.CanvasTexture(canvas);
  } else {
    sharedHandheldMuzzleFlashTex = new THREE.Texture();
  }
  return sharedHandheldMuzzleFlashTex;
}

/**
 * Builds the unified, articulated 3D weapon model (`buildDetailedWeaponViewModel`) for the character's
 * weapon mount so First-Person, Third-Person, Lobby Inspect, and Enemy Combatants all share the
 * exact same real-life mechanical 3D weapon geometry and moving parts (`magazine`, `slideOrBolt`, `pumpGrip`, `triggerBlade`, `muzzleFlashGroup`).
 */
export function buildCompactHandheldWeaponProp(
  weaponId: WeaponId,
  combatForwardAim = false,
  customMuzzleFlashMap?: THREE.Texture
): THREE.Group {
  const grp = new THREE.Group();
  const vmRig: WeaponViewModelRig = buildDetailedWeaponViewModel(
    weaponId,
    customMuzzleFlashMap || getSharedHandheldMuzzleFlashTex()
  );
  vmRig.magazine.visible = weaponId !== 'spas12';

  // Unified orientation in weaponMount space so Lobby Inspect, FPV, TPV, and Enemy Bots share exact 2-bone IK sockets
  vmRig.root.scale.setScalar(1.04);
  vmRig.root.rotation.set(0, Math.PI, 0);
  vmRig.root.position.set(0, 0, 0.035);
  void combatForwardAim;
  grp.add(vmRig.root);
  grp.userData.weaponRig = vmRig;
  return grp;
}

// ============================================================================
// IN-GAME ENEMY LOW-POLY HUMANOID COMBAT RIG & ARTICULATED ANIMATION SYSTEM
// ============================================================================

export interface EnemyChameleonCombatRig {
  group: THREE.Group;
  chameleonRig: ChameleonHumanoidRig;
  weaponGroup: THREE.Group;
  muzzleFlash: THREE.Group;
  visorMat: THREE.MeshStandardMaterial;
  hpBarBg: THREE.Mesh;
  hpBarFill: THREE.Mesh;
  sniperLaser: THREE.Mesh;
}

/**
 * Builds an in-game enemy combatant using the pure-white low-poly 3D humanoid rig
 * (`volt`, `rift`, `kestrel`, `chroma`) painted with bold faction splash & contour-shaded armor,
 * equipped with a forward-aiming 3D weapon, volumetric muzzle flash, sniper laser, and overhead HP bar.
 */
export function buildEnemyChameleonCombatRig(
  characterId: CharacterId,
  archetype: 'rusher' | 'sniper' | 'heavy' | 'flanker',
  weaponId: WeaponId,
  botIndex: number,
  muzzleFlashMap?: THREE.Texture,
  maxAnisotropy = 4
): EnemyChameleonCombatRig {
  const chameleonRig = buildChameleonHumanoidRig(characterId, maxAnisotropy);
  const group = chameleonRig.root;

  // Apply custom painted & shaded faction skin onto the pure-white body
  const factionPaintBuffer = buildEnemyFactionPaintBuffer(characterId, archetype, botIndex);
  syncLayersToCharacterRigTexture(chameleonRig, factionPaintBuffer);

  // Subtle chest/collar status indicator material (keeping the head 100% faceless like the reference image)
  const visorColor =
    archetype === 'sniper'
      ? 0xa855f7
      : archetype === 'flanker'
        ? 0xf59e0b
        : archetype === 'heavy'
          ? 0xef4444
          : 0xf43f5e;

  const visorMat = new THREE.MeshStandardMaterial({
    color: visorColor,
    emissive: visorColor,
    emissiveIntensity: 2.2,
    roughness: 0.15,
    metalness: 0.8,
  });
  const chestBeacon = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.024, 0.02),
    visorMat
  );
  chestBeacon.position.set(0, 0.36, 0.155);
  chameleonRig.torsoPivot.add(chestBeacon);

  // Forward-aimed 3D combat weapon mounted at shoulder/chest ready position
  const weaponGroup = buildCompactHandheldWeaponProp(weaponId, true);
  chameleonRig.weaponMount.add(weaponGroup);

  // Volumetric 3D Muzzle Flash at barrel tip (+Z forward)
  const muzzleFlash = new THREE.Group();
  const flashMat = new THREE.MeshBasicMaterial({
    map: muzzleFlashMap || null,
    color: 0xffd166,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const planeGeo = new THREE.PlaneGeometry(0.42, 0.42);
  const p1 = new THREE.Mesh(planeGeo, flashMat);
  const p2 = new THREE.Mesh(planeGeo, flashMat);
  p2.rotation.z = Math.PI / 4;
  const p3 = new THREE.Mesh(planeGeo, flashMat);
  p3.rotation.y = Math.PI / 2;
  muzzleFlash.add(p1, p2, p3);
  muzzleFlash.position.set(0.0, 0.015, 0.68);
  muzzleFlash.visible = false;
  weaponGroup.add(muzzleFlash);

  // Sniper targeting laser extending forward along +Z
  const laserGeo = new THREE.CylinderGeometry(0.005, 0.005, 42, 6);
  laserGeo.rotateX(Math.PI / 2);
  laserGeo.translate(0, 0, 21);
  const laserMat = new THREE.MeshBasicMaterial({
    color: 0xff1e42,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sniperLaser = new THREE.Mesh(laserGeo, laserMat);
  sniperLaser.position.set(0.0, 0.03, 0.55);
  sniperLaser.visible = false;
  weaponGroup.add(sniperLaser);

  // Floating overhead HP bar billboard
  const hpBarBg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 0.11),
    new THREE.MeshBasicMaterial({
      color: 0x090d16,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    })
  );
  hpBarBg.position.set(0, 2.18, 0);
  group.add(hpBarBg);

  const hpBarFill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.88, 0.072),
    new THREE.MeshBasicMaterial({
      color: visorColor,
      side: THREE.DoubleSide,
    })
  );
  hpBarFill.position.set(0, 2.18, 0.006);
  group.add(hpBarFill);

  return {
    group,
    chameleonRig,
    weaponGroup,
    muzzleFlash,
    visorMat,
    hpBarBg,
    hpBarFill,
    sniperLaser,
  };
}

/**
 * Updates the articulated 3D enemy character animation every frame:
 * - Accurate facing rotation (`bot.yaw + Math.PI` matching ChameleonHumanoidRig's +Z forward axis)
 * - Articulated hip, knee, and foot stride cycle synchronized with `bot.walkCycle` & ground speed
 * - Lateral strafe lean and upper-body counter-twist
 * - Two-handed forward rifle aiming, firing recoil kick, hit-flinch, and 2-stage KO collapse
 */
export function updateEnemyChameleonCombatAnimation(
  enemyRig: EnemyChameleonCombatRig,
  bot: EnemyBotState,
  timeSec: number
): void {
  const rig = enemyRig.chameleonRig;
  const prop = CHARACTER_ROSTER[rig.characterId]?.proportions || CHARACTER_ROSTER.volt.proportions;

  enemyRig.group.position.set(bot.x, bot.y, bot.z);
  enemyRig.group.rotation.set(0, bot.yaw + Math.PI, 0);

  // Reset base pivot transforms before applying frame pose
  rig.bodyPivot.position.set(0, 0, 0);
  rig.bodyPivot.rotation.set(0, 0, 0);
  rig.bodyPivot.scale.setScalar(prop.heightScale);
  rig.hipsPivot.position.set(0, 0.90, 0);
  rig.hipsPivot.rotation.set(0, 0, 0);
  rig.torsoPivot.rotation.set(0, 0, 0);
  rig.neckPivot.rotation.set(0, 0, 0);
  rig.headPivot.rotation.set(0, 0, 0);
  rig.leftShoulderPivot.rotation.set(0, 0, 0);
  rig.leftElbowPivot.rotation.set(0, 0, 0);
  rig.rightShoulderPivot.rotation.set(0, 0, 0);
  rig.rightElbowPivot.rotation.set(0, 0, 0);
  rig.leftElbowPivot.scale.set(1, 1, 1);
  rig.rightElbowPivot.scale.set(1, 1, 1);
  rig.leftHandPivot.scale.set(1, 1, 1);
  rig.rightHandPivot.scale.set(1, 1, 1);
  rig.leftHipPivot.rotation.set(0, 0, 0);
  rig.leftKneePivot.rotation.set(0, 0, 0);
  rig.rightHipPivot.rotation.set(0, 0, 0);
  rig.rightKneePivot.rotation.set(0, 0, 0);
  rig.weaponMount.visible = true;
  const holdProf = WEAPON_HOLD_PROFILES[bot.weaponId] || WEAPON_HOLD_PROFILES.m4a1;
  rig.weaponMount.position.set(
    holdProf.hipMount[0],
    holdProf.hipMount[1],
    holdProf.hipMount[2]
  );
  rig.weaponMount.rotation.set(
    holdProf.baseRot[0],
    holdProf.baseRot[1],
    holdProf.baseRot[2]
  );

  if (bot.state === 'ko') {
    // Multi-stage articulated KO collapse onto the arena floor
    const koElapsed = 1400 - Math.max(0, bot.koTimerMs);
    const t = Math.min(1, Math.max(0, koElapsed / 420));
    const easeOut = 1 - Math.pow(1 - t, 3);

    if (t < 0.42) {
      // Stage 1: knees buckle & torso pitches back from impact
      const s1 = t / 0.42;
      rig.hipsPivot.position.y = 0.90 - s1 * 0.34;
      rig.leftHipPivot.rotation.x = -0.55 * s1;
      rig.rightHipPivot.rotation.x = -0.48 * s1;
      rig.leftKneePivot.rotation.x = 1.15 * s1;
      rig.rightKneePivot.rotation.x = 1.05 * s1;
      rig.torsoPivot.rotation.x = -0.38 * s1;
      rig.leftShoulderPivot.rotation.z = -0.55 * s1;
      rig.rightShoulderPivot.rotation.z = 0.55 * s1;
    } else {
      // Stage 2: full ragdoll fall backward onto ground
      const s2 = (t - 0.42) / 0.58;
      rig.bodyPivot.position.y = 0.14 * (1 - s2) + 0.08;
      rig.bodyPivot.rotation.x = -easeOut * (Math.PI / 2.1);
      rig.bodyPivot.rotation.z = easeOut * 0.18;
      rig.leftShoulderPivot.rotation.set(-0.3, 0, -0.72 * easeOut);
      rig.rightShoulderPivot.rotation.set(-0.25, 0, 0.68 * easeOut);
      rig.leftElbowPivot.rotation.x = -0.35;
      rig.rightElbowPivot.rotation.x = -0.3;
      rig.leftHipPivot.rotation.z = -0.18 * easeOut;
      rig.rightHipPivot.rotation.z = 0.22 * easeOut;
      rig.leftKneePivot.rotation.x = 0.28;
      rig.rightKneePivot.rotation.x = 0.35;
    }

    enemyRig.muzzleFlash.visible = false;
    enemyRig.sniperLaser.visible = false;
    enemyRig.hpBarBg.visible = false;
    enemyRig.hpBarFill.visible = false;
    return;
  }

  // Active combatant: compute speed, forward/strafe components, and walk cycle
  const moveSpeed = Math.hypot(bot.vx, bot.vz);
  const moveFactor = Math.min(1, moveSpeed / 5.2);
  const phase = bot.walkCycle * 2.35;
  const strideSin = Math.sin(phase);
  const strideCos = Math.cos(phase);
  const breath = Math.sin(timeSec * 2.8 + bot.x);

  // Decompose velocity into local forward and lateral strafe relative to facing direction (16-direction compass sectors)
  const rightX = Math.cos(bot.yaw);
  const rightZ = -Math.sin(bot.yaw);
  const fwdX = -Math.sin(bot.yaw);
  const fwdZ = -Math.cos(bot.yaw);
  const strafeVel = bot.vx * rightX + bot.vz * rightZ;
  const fwdVel = bot.vx * fwdX + bot.vz * fwdZ;
  const velLen = Math.hypot(strafeVel, fwdVel);
  const normRight = velLen > 0.05 ? strafeVel / velLen : 0.0;
  const normFwd = velLen > 0.05 ? fwdVel / velLen : 1.0;

  const moveAngle = Math.atan2(normRight, normFwd);
  const anglePos = moveAngle < 0 ? moveAngle + Math.PI * 2 : moveAngle;
  const sector16 = Math.round((anglePos / (Math.PI * 2)) * 16) % 16;
  const qAngle = (sector16 / 16) * Math.PI * 2;
  const dirFwd = normFwd * 0.35 + Math.cos(qAngle) * 0.65;
  const dirRight = normRight * 0.35 + Math.sin(qAngle) * 0.65;
  const strafeFactor = Math.max(-1, Math.min(1, strafeVel / 4.5));

  // 1. Articulated 16-Direction Full-Body Stride (Hips X/Y + Pelvis Twist/Roll + Thighs + Knees)
  const legAmp = 0.72 * moveFactor;
  const pelvisTwist = Math.sin(moveAngle) * 0.28 * moveFactor;
  const doubleStep = Math.sin(phase * 2);
  rig.hipsPivot.position.x = strideCos * 0.032 * moveFactor + dirRight * 0.024 * moveFactor;
  rig.hipsPivot.position.y =
    0.90 - 0.032 * moveFactor + Math.abs(strideSin) * 0.054 * moveFactor + breath * 0.007;
  rig.hipsPivot.rotation.x = 0.065 * dirFwd * moveFactor;
  rig.hipsPivot.rotation.y = pelvisTwist + strideSin * 0.12 * moveFactor;
  rig.hipsPivot.rotation.z = -dirRight * 0.085 * moveFactor + strideCos * 0.048 * moveFactor;

  rig.leftHipPivot.rotation.x = -strideSin * legAmp * dirFwd - 0.04 * (1 - moveFactor);
  rig.rightHipPivot.rotation.x = strideSin * legAmp * dirFwd + 0.04 * (1 - moveFactor);
  rig.leftHipPivot.rotation.z =
    -0.02 - dirRight * 0.16 * moveFactor + strideCos * 0.14 * dirRight * moveFactor;
  rig.rightHipPivot.rotation.z =
    0.02 + dirRight * 0.16 * moveFactor - strideCos * 0.14 * dirRight * moveFactor;

  const stepSwingL = strideCos * dirFwd + strideSin * dirRight * 0.6;
  const stepSwingR = -strideCos * dirFwd - strideSin * dirRight * 0.6;
  rig.leftKneePivot.rotation.x =
    0.06 + (Math.max(0, stepSwingL) * 0.82 + 0.08) * moveFactor;
  rig.rightKneePivot.rotation.x =
    0.06 + (Math.max(0, stepSwingR) * 0.82 + 0.08) * moveFactor;

  // 2. Torso & Head Combat Tracking + Hit-Stun Flinch + Firing Recoil
  const isFiring = bot.attackAnimTimerMs > 0;
  const recoilRatio = isFiring ? Math.min(1, bot.attackAnimTimerMs / 160) : 0;
  const recoilKick = Math.sin(recoilRatio * Math.PI) * 0.22;

  const isHit = bot.hitFlashMs > 0;
  const hitRatio = isHit ? Math.min(1, bot.hitFlashMs / 130) : 0;
  const hitFlinch = Math.sin(hitRatio * Math.PI) * 0.26;

  rig.torsoPivot.rotation.x =
    holdProf.torsoLeanX + 0.11 * moveFactor * dirFwd + doubleStep * 0.025 * moveFactor - recoilKick * 0.65 - hitFlinch + breath * 0.015;
  rig.torsoPivot.rotation.y =
    holdProf.torsoTurnY - pelvisTwist - strideSin * 0.14 * moveFactor + hitFlinch * 0.35;
  rig.torsoPivot.rotation.z = -strafeFactor * 0.085 - strideCos * 0.042 * moveFactor;

  rig.neckPivot.rotation.x = -rig.torsoPivot.rotation.x * 0.3;
  rig.neckPivot.rotation.y = -rig.torsoPivot.rotation.y * 0.3;
  rig.headPivot.rotation.x = -0.06 * moveFactor - hitFlinch * 0.6 + recoilKick * 0.28;
  rig.headPivot.rotation.y = -rig.torsoPivot.rotation.y * 0.5;
  rig.headPivot.rotation.z = -rig.torsoPivot.rotation.z * 0.45;

  // 3. Dynamic Two-Handed Forward Combat Weapon Hold (Weapon Mount + Two-Bone Arm IK)
  const telegraphLift = bot.state === 'telegraph' || bot.state === 'attack' ? -0.06 : 0;

  rig.weaponMount.position.set(
    holdProf.hipMount[0] - moveFactor * 0.012 + strideSin * 0.012 * moveFactor,
    holdProf.hipMount[1] - Math.abs(strideSin) * 0.015 * moveFactor + recoilKick * 0.032,
    holdProf.hipMount[2] - recoilKick * 0.055
  );
  rig.weaponMount.rotation.set(
    holdProf.baseRot[0] + telegraphLift - recoilKick * 0.42 - moveFactor * 0.05 + doubleStep * 0.025 * moveFactor,
    holdProf.baseRot[1] - strideSin * 0.035 * moveFactor,
    holdProf.baseRot[2] + strideSin * 0.03 * moveFactor
  );
  enforceWeaponBodyClearance(
    rig.weaponMount.position,
    rig.weaponMount.rotation,
    bot.weaponId,
    prop.torsoWidth,
    prop.headScale,
    rig.neckPivot.rotation.x + rig.headPivot.rotation.x
  );

  // Solve 2-bone arm IK for enemy combatant hands onto the weapon's grip and forend with normal (1,1,1) arm proportions
  const vm = enemyRig.weaponGroup.userData.weaponRig as WeaponViewModelRig | undefined;
  if (vm) {
    _socketRightLocal.copy(vm.rightHandSocket);
    _socketLeftLocal.copy(vm.leftHandSocket);
  } else {
    _socketRightLocal.set(0, -0.048, 0.115);
    _socketLeftLocal.set(0, -0.01, -0.18);
  }

  _weaponQuat.setFromEuler(rig.weaponMount.rotation);
  _rightHandTargetTorso
    .set(
      -_socketRightLocal.x * 1.04 + holdProf.rightHandOffset[0],
      _socketRightLocal.y * 1.04 + holdProf.rightHandOffset[1],
      -_socketRightLocal.z * 1.04 + 0.035 + holdProf.rightHandOffset[2]
    )
    .applyQuaternion(_weaponQuat)
    .add(rig.weaponMount.position);

  _leftHandTargetTorso
    .set(
      -_socketLeftLocal.x * 1.04 + holdProf.leftHandOffset[0],
      _socketLeftLocal.y * 1.04 + holdProf.leftHandOffset[1],
      -_socketLeftLocal.z * 1.04 + 0.035 + holdProf.leftHandOffset[2]
    )
    .applyQuaternion(_weaponQuat)
    .add(rig.weaponMount.position);

  const botShoulderY = 0.415 - Math.abs(strideSin) * 0.016 * moveFactor;
  const botRightShoulderPos = _grabPointLocal.set(
    -0.238 * prop.torsoWidth,
    botShoulderY,
    0.04
  );
  _ikPoleRight.set(holdProf.poleRight[0], holdProf.poleRight[1], holdProf.poleRight[2]);
  solveTwoBoneArmIK(
    rig.leftShoulderPivot,
    rig.leftElbowPivot,
    botRightShoulderPos,
    _rightHandTargetTorso,
    _ikPoleRight,
    0.27,
    0.285
  );

  const botLeftShoulderPos = _grabPointLocal.set(
    0.212 * prop.torsoWidth,
    botShoulderY - 0.015,
    0.095
  );
  _ikPoleLeft.set(holdProf.poleLeft[0], holdProf.poleLeft[1], holdProf.poleLeft[2]);
  solveTwoBoneArmIK(
    rig.rightShoulderPivot,
    rig.rightElbowPivot,
    botLeftShoulderPos,
    _leftHandTargetTorso,
    _ikPoleLeft,
    0.27,
    0.285
  );

  // 4. Hit Flash Material Feedback & Status Beacon Intensity
  if (bot.hitFlashMs > 0) {
    rig.paintMaterial.emissive.setHex(0xff3b30);
    rig.paintMaterial.emissiveIntensity = 0.65 * hitRatio;
  } else if (bot.state === 'telegraph') {
    rig.paintMaterial.emissive.setHex(0x7f1d1d);
    rig.paintMaterial.emissiveIntensity = 0.22;
  } else {
    rig.paintMaterial.emissive.setHex(0x000000);
    rig.paintMaterial.emissiveIntensity = 0.0;
  }

  enemyRig.visorMat.emissiveIntensity =
    bot.state === 'telegraph' ? 5.0 : bot.state === 'attack' ? 4.0 : 2.2;

  // 5. Muzzle Flash & Sniper Laser Visibility
  enemyRig.muzzleFlash.visible = bot.muzzleFlashTimerMs > 0;
  if (enemyRig.muzzleFlash.visible) {
    enemyRig.muzzleFlash.rotation.z = (timeSec * 37) % (Math.PI * 2);
    const s = 0.85 + Math.sin(timeSec * 90) * 0.28;
    enemyRig.muzzleFlash.scale.set(s, s, s * 1.3);
  }

  enemyRig.sniperLaser.visible =
    bot.archetype === 'sniper' &&
    (bot.state === 'telegraph' || bot.state === 'attack' || bot.state === 'strafe');
}

