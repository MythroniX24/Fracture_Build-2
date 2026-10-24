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
  const paintCanvas = document.createElement('canvas');
  paintCanvas.width = PAINT_ATLAS_SIZE;
  paintCanvas.height = PAINT_ATLAS_SIZE;
  const ctx = paintCanvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAINT_ATLAS_SIZE, PAINT_ATLAS_SIZE);

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

  // Smooth low-poly pelvis/waist seamlessly bridging torso and upper legs without a protruding front ridge
  const pelvisMesh = registerPaintableMesh(
    new THREE.CylinderGeometry(
      0.162 * prop.torsoWidth,
      0.164 * prop.torsoWidth,
      0.20,
      10,
      2
    ),
    'pelvis'
  );
  pelvisMesh.scale.set(1.08, 1.0, 0.74);
  pelvisMesh.position.set(0, 0.0, 0);
  hipsPivot.add(pelvisMesh);

  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.09, 0);
  hipsPivot.add(torsoPivot);

  // Front Chest Half-Cylinder + Sloped Shoulder Collar (mapped to 'chest')
  const chestFrontGeo = new THREE.CylinderGeometry(
    0.194 * prop.torsoWidth,
    0.162 * prop.torsoWidth,
    0.45,
    10,
    4,
    false,
    -Math.PI * 0.5,
    Math.PI
  );
  const chestFrontMesh = registerPaintableMesh(chestFrontGeo, 'chest');
  chestFrontMesh.scale.set(1.08, 1.0, 0.74);
  chestFrontMesh.position.set(0, 0.225, 0);

  const chestTopDome = registerPaintableMesh(
    new THREE.CylinderGeometry(
      0.088 * prop.torsoWidth,
      0.194 * prop.torsoWidth,
      0.075,
      10,
      1,
      false,
      -Math.PI * 0.5,
      Math.PI
    ),
    'chest'
  );
  chestTopDome.scale.set(1.08, 1.0, 0.74);
  chestTopDome.position.set(0, 0.485, 0);
  torsoPivot.add(chestFrontMesh, chestTopDome);

  // Rear Back Half-Cylinder + Dorsal Shoulder Collar (mapped to 'back')
  const backRearGeo = new THREE.CylinderGeometry(
    0.194 * prop.torsoWidth,
    0.162 * prop.torsoWidth,
    0.45,
    10,
    4,
    false,
    Math.PI * 0.5,
    Math.PI
  );
  const backRearMesh = registerPaintableMesh(backRearGeo, 'back');
  backRearMesh.scale.set(1.08, 1.0, 0.74);
  backRearMesh.position.set(0, 0.225, 0);

  const backTopDome = registerPaintableMesh(
    new THREE.CylinderGeometry(
      0.088 * prop.torsoWidth,
      0.194 * prop.torsoWidth,
      0.075,
      10,
      1,
      false,
      Math.PI * 0.5,
      Math.PI
    ),
    'back'
  );
  backTopDome.scale.set(1.08, 1.0, 0.74);
  backTopDome.position.set(0, 0.485, 0);
  torsoPivot.add(backRearMesh, backTopDome);

  // ==========================================================================
  // 2. NECK & FACELESS LOW-POLY ROUNDED HEAD (Matching Reference Image)
  // ==========================================================================
  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 0.51, 0);
  torsoPivot.add(neckPivot);

  const neckMesh = registerPaintableMesh(
    new THREE.CylinderGeometry(0.068, 0.086, 0.12, 10, 2),
    'neck'
  );
  neckMesh.position.set(0, 0.04, 0);
  neckPivot.add(neckMesh);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.095, 0);
  neckPivot.add(headPivot);

  // Faceless low-poly rounded sphere cranium (no visor, no crest, crisp low-poly facets)
  const headCranium = registerPaintableMesh(
    new THREE.SphereGeometry(0.168 * prop.headScale, 12, 9),
    'head'
  );
  headCranium.scale.set(0.95, 1.07, 0.97);
  headCranium.position.set(0, 0.148 * prop.headScale, 0.0);
  headPivot.add(headCranium);

  // ==========================================================================
  // 3. LEFT & RIGHT ARMS (Flared Low-Poly Tubular Arms + Rounded Bulb Hands)
  // ==========================================================================
  const buildArmAssembly = (side: -1 | 1) => {
    const isLeft = side === -1;
    const upperReg: BodyRegionId = isLeft ? 'leftUpperArm' : 'rightUpperArm';
    const forearmReg: BodyRegionId = isLeft ? 'leftForearm' : 'rightForearm';
    const handSubRange: [number, number] = isLeft ? [0.02, 0.48] : [0.52, 0.98];

    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * (0.188 * prop.torsoWidth), 0.435, 0);
    torsoPivot.add(shoulderPivot);

    // Smoothly integrated shoulder socket cap
    const shoulderCap = registerPaintableMesh(
      new THREE.SphereGeometry(0.062 * prop.limbThickness, 10, 7),
      upperReg,
      [0.1, 0.9]
    );
    shoulderCap.position.set(0, -0.015, 0);
    shoulderPivot.add(shoulderCap);

    // Upper arm cylinder flaring gently toward the elbow
    const upperArmMesh = registerPaintableMesh(
      new THREE.CylinderGeometry(
        0.060 * prop.limbThickness,
        0.074 * prop.limbThickness,
        0.26,
        10,
        3
      ),
      upperReg
    );
    upperArmMesh.position.set(0, -0.14, 0);
    shoulderPivot.add(upperArmMesh);

    // Seamless paintable elbow bridge (no grey joint ball)
    const elbowBridge = registerPaintableMesh(
      new THREE.SphereGeometry(0.072 * prop.limbThickness, 10, 7),
      upperReg,
      [0.2, 0.8]
    );
    elbowBridge.position.set(0, -0.27, 0);
    shoulderPivot.add(elbowBridge);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.27, 0);
    shoulderPivot.add(elbowPivot);

    // Forearm cylinder flaring wider toward the wrist/hand (signature silhouette feature)
    const forearmMesh = registerPaintableMesh(
      new THREE.CylinderGeometry(
        0.074 * prop.limbThickness,
        0.090 * prop.limbThickness,
        0.25,
        10,
        3
      ),
      forearmReg
    );
    forearmMesh.position.set(0, -0.125, 0);
    elbowPivot.add(forearmMesh);

    const handPivot = new THREE.Group();
    handPivot.position.set(0, -0.25, 0);
    elbowPivot.add(handPivot);

    // Smooth rounded low-poly bulb/mitten hand at the end of the flared forearm
    const bulbHandMesh = registerPaintableMesh(
      new THREE.SphereGeometry(0.090 * prop.limbThickness, 10, 8),
      'hands',
      handSubRange
    );
    bulbHandMesh.scale.set(0.96, 1.14, 0.94);
    bulbHandMesh.position.set(0, -0.035, 0);
    handPivot.add(bulbHandMesh);

    return { shoulderPivot, elbowPivot, handPivot };
  };

  const leftArm = buildArmAssembly(-1);
  const rightArm = buildArmAssembly(1);

  const weaponMount = new THREE.Group();
  weaponMount.position.set(0.02, 0.23, 0.215);
  torsoPivot.add(weaponMount);

  // ==========================================================================
  // 4. LEFT & RIGHT LEGS (Straight Tubular Low-Poly Legs + Rounded Bulb Feet)
  // ==========================================================================
  const buildLegAssembly = (side: -1 | 1) => {
    const isLeft = side === -1;
    const thighReg: BodyRegionId = isLeft ? 'leftThigh' : 'rightThigh';
    const shinReg: BodyRegionId = isLeft ? 'leftLowerLeg' : 'rightLowerLeg';
    const footSubRange: [number, number] = isLeft ? [0.02, 0.48] : [0.52, 0.98];

    const hipPivot = new THREE.Group();
    hipPivot.position.set(side * 0.094 * prop.torsoWidth, -0.05, 0);
    hipsPivot.add(hipPivot);

    // Smooth hip socket cap integrated into pelvis
    const hipCap = registerPaintableMesh(
      new THREE.SphereGeometry(0.082 * prop.limbThickness, 10, 7),
      thighReg,
      [0.1, 0.9]
    );
    hipPivot.add(hipCap);

    // Straight tubular upper leg / thigh
    const thighMesh = registerPaintableMesh(
      new THREE.CylinderGeometry(
        0.084 * prop.limbThickness,
        0.082 * prop.limbThickness,
        0.40,
        10,
        3
      ),
      thighReg
    );
    thighMesh.position.set(0, -0.20, 0);
    hipPivot.add(thighMesh);

    // Seamless paintable knee bridge (no grey joint ball)
    const kneeBridge = registerPaintableMesh(
      new THREE.SphereGeometry(0.080 * prop.limbThickness, 10, 7),
      thighReg,
      [0.2, 0.8]
    );
    kneeBridge.position.set(0, -0.40, 0);
    hipPivot.add(kneeBridge);

    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.40, 0);
    hipPivot.add(kneePivot);

    // Straight tubular lower leg / shin flaring slightly toward the rounded foot
    const shinMesh = registerPaintableMesh(
      new THREE.CylinderGeometry(
        0.082 * prop.limbThickness,
        0.087 * prop.limbThickness,
        0.39,
        10,
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
      new THREE.SphereGeometry(0.090 * prop.limbThickness, 10, 8),
      'feet',
      footSubRange
    );
    bulbFootMesh.scale.set(1.0, 0.82, 1.15);
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
  showWeapon: boolean;
}

/**
 * Animates the Low-Poly Humanoid Rig in the 3D Lobby, Paint Studio, Character Preview, or Combat
 * with smooth exponential pose damping, natural breathing, weight shifts, and multi-joint locomotion.
 */
export function updateChameleonRigAnimation(
  rig: ChameleonHumanoidRig,
  pose: CharacterPoseId | 'studio_neutral' | 'combat',
  timeSec: number,
  combatMoveSpeed = 0,
  combatWalkPhase = 0,
  isCrouching = false
): void {
  const breath = Math.sin(timeSec * 2.2);
  const breathCos = Math.cos(timeSec * 2.2);
  const slowWave = Math.sin(timeSec * 1.1);
  const secondaryWave = Math.cos(timeSec * 0.85);

  const targets: RigPoseTargets = {
    hipsY: isCrouching ? 0.68 : 0.90,
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
    showWeapon: false,
  };

  if (pose === 'studio_neutral') {
    // Clean, sculptural low-poly A-stance matching the reference image for 360° painting
    targets.hipsY = 0.90 + breath * 0.003;
    targets.torsoRotX = breath * 0.008;
    targets.lShoulderZ = -0.22;
    targets.rShoulderZ = 0.22;
    targets.lElbowX = -0.04;
    targets.rElbowX = -0.04;
    targets.showWeapon = false;
  } else if (pose === 'idle') {
    // Iconic reference silhouette A-stance with fluid breathing, subtle weight shift, and natural head look
    targets.hipsY = 0.90 + breath * 0.007;
    targets.hipsX = slowWave * 0.012;
    targets.hipsRotZ = -slowWave * 0.018;
    targets.hipsRotY = secondaryWave * 0.03;

    targets.torsoRotX = breath * 0.016;
    targets.torsoRotZ = slowWave * 0.015;
    targets.torsoRotY = -secondaryWave * 0.025;

    targets.neckRotY = slowWave * 0.035;
    targets.headRotY = slowWave * 0.075;
    targets.headRotX = breathCos * 0.022;
    targets.headRotZ = secondaryWave * 0.015;

    // Signature outward-angled arms (~13°) with subtle breathing sway
    targets.lShoulderZ = -0.22 - Math.max(0, breath) * 0.022;
    targets.rShoulderZ = 0.22 + Math.max(0, breath) * 0.022;
    targets.lShoulderX = secondaryWave * 0.025;
    targets.rShoulderX = -secondaryWave * 0.025;
    targets.lElbowX = -0.06 - breath * 0.015;
    targets.rElbowX = -0.06 - breath * 0.015;

    // Straight parallel tubular legs with subtle weight balance
    targets.lHipZ = slowWave * 0.016;
    targets.rHipZ = slowWave * 0.016;
    targets.lKneeX = Math.max(0, slowWave) * 0.04;
    targets.rKneeX = Math.max(0, -slowWave) * 0.04;
    targets.showWeapon = false;
  } else if (pose === 'walk') {
    // Balanced, natural walking cycle with hip sway, knee flexion, and counter-rotating arms
    const cycle = timeSec * 5.2;
    const s = Math.sin(cycle);
    const c = Math.cos(cycle);
    const doubleStep = Math.sin(cycle * 2);

    targets.hipsY = 0.89 + Math.abs(s) * 0.032;
    targets.hipsX = c * 0.018;
    targets.hipsRotY = s * 0.085;
    targets.hipsRotZ = c * 0.035;
    targets.hipsRotX = 0.04;

    targets.torsoRotX = 0.06 + doubleStep * 0.015;
    targets.torsoRotY = -s * 0.11;
    targets.torsoRotZ = -c * 0.03;

    targets.headRotY = s * 0.045;
    targets.headRotX = -0.03 - doubleStep * 0.012;

    // Opposite arm & leg swing
    targets.lHipX = -s * 0.48;
    targets.rHipX = s * 0.48;
    targets.lKneeX = Math.max(0, c) * 0.62 + 0.05;
    targets.rKneeX = Math.max(0, -c) * 0.62 + 0.05;

    targets.lShoulderX = s * 0.38;
    targets.rShoulderX = -s * 0.38;
    targets.lShoulderZ = -0.18;
    targets.rShoulderZ = 0.18;
    targets.lElbowX = -0.22 - Math.max(0, -s) * 0.25;
    targets.rElbowX = -0.22 - Math.max(0, s) * 0.25;
    targets.showWeapon = false;
  } else if (pose === 'run') {
    // Energetic sprint cycle with forward torso lean, high knee lift, and pumping arms
    const cycle = timeSec * 8.6;
    const s = Math.sin(cycle);
    const c = Math.cos(cycle);
    const bounce = Math.abs(s);

    targets.hipsY = 0.86 + bounce * 0.065;
    targets.hipsX = c * 0.024;
    targets.hipsRotY = s * 0.15;
    targets.hipsRotZ = c * 0.05;
    targets.hipsRotX = 0.12;

    targets.torsoRotX = 0.22 + (1 - bounce) * 0.04;
    targets.torsoRotY = -s * 0.18;
    targets.torsoRotZ = -c * 0.045;

    targets.headRotX = -0.14;
    targets.headRotY = s * 0.08;

    targets.lHipX = -s * 0.82;
    targets.rHipX = s * 0.82;
    targets.lKneeX = Math.max(0, c) * 1.05 + 0.12;
    targets.rKneeX = Math.max(0, -c) * 1.05 + 0.12;

    targets.lShoulderX = s * 0.72 - 0.12;
    targets.rShoulderX = -s * 0.72 - 0.12;
    targets.lShoulderZ = -0.16;
    targets.rShoulderZ = 0.16;
    targets.lElbowX = -0.85 - Math.max(0, -s) * 0.35;
    targets.rElbowX = -0.85 - Math.max(0, s) * 0.35;
    targets.showWeapon = false;
  } else if (pose === 'inspect') {
    const inspectCycle = Math.sin(timeSec * 1.8);
    targets.hipsY = 0.90 + breath * 0.008;
    targets.torsoRotY = 0.14 + inspectCycle * 0.12;
    targets.headRotY = -0.1 + inspectCycle * 0.16;
    targets.headRotX = 0.14;

    targets.rShoulderX = -0.78 + inspectCycle * 0.12;
    targets.rShoulderZ = 0.15;
    targets.rElbowX = -0.88;
    targets.rElbowY = inspectCycle * 0.35;

    targets.lShoulderX = -0.55;
    targets.lShoulderY = 0.42;
    targets.lShoulderZ = -0.14;
    targets.lElbowX = -0.72;
    targets.showWeapon = true;
  } else if (pose === 'salute') {
    targets.hipsY = 0.90 + breath * 0.006;
    targets.torsoRotX = -0.04 + breath * 0.01;
    targets.headRotY = slowWave * 0.06;

    // Crisp right-hand salute to brow, left arm cleanly angled at side
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

    // Both arms raised high in celebratory V-pose
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
    const stride = Math.sin(combatWalkPhase);
    const strideCos = Math.cos(combatWalkPhase);
    const moveFactor = Math.min(1, combatMoveSpeed / 5.5);
    const legAmp = 0.64 * moveFactor;

    const baseHipY = isCrouching ? 0.68 : 0.90;
    targets.hipsY =
      baseHipY - 0.025 * moveFactor + Math.abs(stride) * 0.042 * moveFactor;
    targets.hipsRotY = stride * 0.08 * moveFactor;

    targets.torsoRotX = isCrouching ? 0.26 : 0.09 * moveFactor + breath * 0.012;
    targets.torsoRotY = -stride * 0.12 * moveFactor;
    targets.headRotY = stride * 0.06 * moveFactor;
    targets.headRotX = isCrouching ? -0.14 : -0.04 * moveFactor;

    targets.lHipX = -stride * legAmp + (isCrouching ? -0.42 : 0);
    targets.rHipX = stride * legAmp + (isCrouching ? -0.42 : 0);

    const crouchKnee = isCrouching ? 0.72 : 0.06 * moveFactor;
    targets.lKneeX = crouchKnee + Math.max(0, strideCos) * 0.68 * moveFactor;
    targets.rKneeX = crouchKnee + Math.max(0, -strideCos) * 0.68 * moveFactor;

    targets.rShoulderX = -0.74 + breath * 0.015;
    targets.rShoulderY = -0.16;
    targets.rShoulderZ = 0.08;
    targets.rElbowX = -0.82;
    targets.rElbowY = 0.22;

    targets.lShoulderX = -0.78 + breath * 0.015;
    targets.lShoulderY = 0.44;
    targets.lShoulderZ = -0.14;
    targets.lElbowX = -0.64;
    targets.lElbowY = -0.18;
    targets.showWeapon = true;
  }

  // Smooth exponential damping across pose transitions
  const prev = rig.root.userData.animState as
    | (RigPoseTargets & { lastTimeSec: number })
    | undefined;
  const dt = prev ? Math.min(0.1, Math.max(0.001, timeSec - prev.lastTimeSec)) : 1;
  const alpha = !prev || pose === 'combat' ? 1 : 1 - Math.exp(-14 * dt);

  const damp = (cur: number, target: number) => cur + (target - cur) * alpha;

  const nextState: RigPoseTargets & { lastTimeSec: number } = prev
    ? {
        hipsY: damp(prev.hipsY, targets.hipsY),
        hipsX: damp(prev.hipsX, targets.hipsX),
        hipsRotX: damp(prev.hipsRotX, targets.hipsRotX),
        hipsRotY: damp(prev.hipsRotY, targets.hipsRotY),
        hipsRotZ: damp(prev.hipsRotZ, targets.hipsRotZ),
        torsoRotX: damp(prev.torsoRotX, targets.torsoRotX),
        torsoRotY: damp(prev.torsoRotY, targets.torsoRotY),
        torsoRotZ: damp(prev.torsoRotZ, targets.torsoRotZ),
        neckRotX: damp(prev.neckRotX, targets.neckRotX),
        neckRotY: damp(prev.neckRotY, targets.neckRotY),
        headRotX: damp(prev.headRotX, targets.headRotX),
        headRotY: damp(prev.headRotY, targets.headRotY),
        headRotZ: damp(prev.headRotZ, targets.headRotZ),
        lShoulderX: damp(prev.lShoulderX, targets.lShoulderX),
        lShoulderY: damp(prev.lShoulderY, targets.lShoulderY),
        lShoulderZ: damp(prev.lShoulderZ, targets.lShoulderZ),
        lElbowX: damp(prev.lElbowX, targets.lElbowX),
        lElbowY: damp(prev.lElbowY, targets.lElbowY),
        lElbowZ: damp(prev.lElbowZ, targets.lElbowZ),
        rShoulderX: damp(prev.rShoulderX, targets.rShoulderX),
        rShoulderY: damp(prev.rShoulderY, targets.rShoulderY),
        rShoulderZ: damp(prev.rShoulderZ, targets.rShoulderZ),
        rElbowX: damp(prev.rElbowX, targets.rElbowX),
        rElbowY: damp(prev.rElbowY, targets.rElbowY),
        rElbowZ: damp(prev.rElbowZ, targets.rElbowZ),
        lHipX: damp(prev.lHipX, targets.lHipX),
        lHipY: damp(prev.lHipY, targets.lHipY),
        lHipZ: damp(prev.lHipZ, targets.lHipZ),
        lKneeX: damp(prev.lKneeX, targets.lKneeX),
        rHipX: damp(prev.rHipX, targets.rHipX),
        rHipY: damp(prev.rHipY, targets.rHipY),
        rHipZ: damp(prev.rHipZ, targets.rHipZ),
        rKneeX: damp(prev.rKneeX, targets.rKneeX),
        showWeapon: targets.showWeapon,
        lastTimeSec: timeSec,
      }
    : { ...targets, lastTimeSec: timeSec };

  rig.root.userData.animState = nextState;

  rig.hipsPivot.position.set(nextState.hipsX, nextState.hipsY, 0);
  rig.hipsPivot.rotation.set(nextState.hipsRotX, nextState.hipsRotY, nextState.hipsRotZ);
  rig.torsoPivot.rotation.set(nextState.torsoRotX, nextState.torsoRotY, nextState.torsoRotZ);
  rig.neckPivot.rotation.set(nextState.neckRotX, nextState.neckRotY, 0);
  rig.headPivot.rotation.set(nextState.headRotX, nextState.headRotY, nextState.headRotZ);

  rig.leftShoulderPivot.rotation.set(
    nextState.lShoulderX,
    nextState.lShoulderY,
    nextState.lShoulderZ
  );
  rig.leftElbowPivot.rotation.set(nextState.lElbowX, nextState.lElbowY, nextState.lElbowZ);

  rig.rightShoulderPivot.rotation.set(
    nextState.rShoulderX,
    nextState.rShoulderY,
    nextState.rShoulderZ
  );
  rig.rightElbowPivot.rotation.set(nextState.rElbowX, nextState.rElbowY, nextState.rElbowZ);

  rig.leftHipPivot.rotation.set(nextState.lHipX, nextState.lHipY, nextState.lHipZ);
  rig.leftKneePivot.rotation.set(nextState.lKneeX, 0, 0);
  rig.rightHipPivot.rotation.set(nextState.rHipX, nextState.rHipY, nextState.rHipZ);
  rig.rightKneePivot.rotation.set(nextState.rKneeX, 0, 0);

  rig.weaponMount.visible = nextState.showWeapon;
}

/**
 * Builds a detailed black/white/yellow tactical assault rifle prop for the character weapon mount.
 */
export function buildCompactHandheldWeaponProp(
  weaponId: WeaponId,
  combatForwardAim = false
): THREE.Group {
  const grp = new THREE.Group();
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.36,
    metalness: 0.72,
  });
  const whiteShroudMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.35,
    metalness: 0.18,
  });
  const yellowAccentMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.38,
    metalness: 0.25,
  });

  const isPistol = weaponId === 'deagle';
  const isSniper = weaponId === 'awp';
  const len = isPistol ? 0.32 : isSniper ? 0.92 : 0.76;

  // Build gunCore along the X axis: stock at +X (viewer's right), barrel at -X (viewer's left)
  const gunCore = new THREE.Group();

  if (!isPistol) {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.044), darkMetalMat);
    stock.position.set(0.24, -0.01, 0);
    const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.125, 0.048), darkMetalMat);
    stockPad.position.set(0.35, -0.015, 0);
    gunCore.add(stock, stockPad);
  }

  // Main Receiver & White Upper Handguard Shroud + Yellow Magwell Accent
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(len * 0.5, 0.088, 0.052), darkMetalMat);
  receiver.position.set(0.02, 0.01, 0);

  const whiteUpper = new THREE.Mesh(
    new THREE.BoxGeometry(len * 0.58, 0.045, 0.056),
    whiteShroudMat
  );
  whiteUpper.position.set(-0.05, 0.042, 0);

  const yellowTrim = new THREE.Mesh(
    new THREE.BoxGeometry(len * 0.22, 0.036, 0.058),
    yellowAccentMat
  );
  yellowTrim.position.set(0.01, -0.008, 0);

  // Pistol Grip & Magazine
  const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.12, 0.038), darkMetalMat);
  pistolGrip.position.set(0.11, -0.075, 0);
  pistolGrip.rotation.z = 0.24;

  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.165, 0.036), darkMetalMat);
  mag.position.set(-0.03, -0.095, 0);
  mag.rotation.z = -0.2;

  // Top Optic Sight
  const optic = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.042, 0.04), darkMetalMat);
  optic.position.set(0.02, 0.078, 0);

  // Barrel & Front Sight / Muzzle Brake extending toward -X (viewer's left)
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.013, len * 0.58, 12),
    darkMetalMat
  );
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(-len * 0.42, 0.028, 0);

  const handguardSlots = new THREE.Mesh(
    new THREE.BoxGeometry(len * 0.34, 0.05, 0.046),
    darkMetalMat
  );
  handguardSlots.position.set(-len * 0.28, 0.022, 0);

  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.046, 0.016), darkMetalMat);
  frontSight.position.set(-len * 0.58, 0.054, 0);

  gunCore.add(
    receiver,
    whiteUpper,
    yellowTrim,
    pistolGrip,
    mag,
    optic,
    barrel,
    handguardSlots,
    frontSight
  );

  if (combatForwardAim) {
    // Rotate gunCore +90deg around Y so barrel (-X) points directly forward (+Z) and stock (+X) sits against right shoulder (-Z)
    gunCore.rotation.set(0, Math.PI * 0.5, 0);
    gunCore.position.set(0.06, -0.03, 0.12);
  } else {
    // Diagonal across chest: barrel (-X) tilted up-left, stock (+X) tilted down-right, completely below head/neck
    gunCore.rotation.set(0.12, 0.14, -0.52);
    gunCore.position.set(0.01, -0.02, 0.02);
  }
  grp.add(gunCore);
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
  muzzleFlash.position.set(0.06, 0.0, 0.68);
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
  sniperLaser.position.set(0.06, 0.03, 0.55);
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
  rig.leftHipPivot.rotation.set(0, 0, 0);
  rig.leftKneePivot.rotation.set(0, 0, 0);
  rig.rightHipPivot.rotation.set(0, 0, 0);
  rig.rightKneePivot.rotation.set(0, 0, 0);
  rig.weaponMount.visible = true;
  rig.weaponMount.position.set(0.02, 0.23, 0.215);
  rig.weaponMount.rotation.set(0, 0, 0);

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

  // Decompose velocity into lateral strafe relative to facing direction
  const rightX = Math.cos(bot.yaw);
  const rightZ = -Math.sin(bot.yaw);
  const strafeVel = bot.vx * rightX + bot.vz * rightZ;
  const strafeFactor = Math.max(-1, Math.min(1, strafeVel / 4.5));

  // 1. Articulated Leg Stride (Thighs + Knees + Strafe Hip Banking)
  const legAmp = 0.68 * moveFactor;
  rig.hipsPivot.position.y =
    0.90 - 0.03 * moveFactor + Math.abs(strideSin) * 0.048 * moveFactor + breath * 0.005;
  rig.hipsPivot.rotation.y = strideSin * 0.095 * moveFactor;
  rig.hipsPivot.rotation.z = -strafeFactor * 0.065;

  rig.leftHipPivot.rotation.x = -strideSin * legAmp - 0.04 * (1 - moveFactor);
  rig.rightHipPivot.rotation.x = strideSin * legAmp + 0.04 * (1 - moveFactor);
  rig.leftHipPivot.rotation.z = -0.02 - strafeFactor * 0.1 * strideSin;
  rig.rightHipPivot.rotation.z = 0.02 - strafeFactor * 0.1 * strideSin;

  rig.leftKneePivot.rotation.x =
    0.06 + (Math.max(0, strideCos) * 0.76 + 0.08) * moveFactor;
  rig.rightKneePivot.rotation.x =
    0.06 + (Math.max(0, -strideCos) * 0.76 + 0.08) * moveFactor;

  // 2. Torso & Head Combat Tracking + Hit-Stun Flinch + Firing Recoil
  const isFiring = bot.attackAnimTimerMs > 0;
  const recoilRatio = isFiring ? Math.min(1, bot.attackAnimTimerMs / 160) : 0;
  const recoilKick = Math.sin(recoilRatio * Math.PI) * 0.18;

  const isHit = bot.hitFlashMs > 0;
  const hitRatio = isHit ? Math.min(1, bot.hitFlashMs / 130) : 0;
  const hitFlinch = Math.sin(hitRatio * Math.PI) * 0.26;

  rig.torsoPivot.rotation.x =
    0.12 * moveFactor - recoilKick * 0.55 - hitFlinch + breath * 0.012;
  rig.torsoPivot.rotation.y = -strideSin * 0.11 * moveFactor + hitFlinch * 0.35;
  rig.torsoPivot.rotation.z = -strafeFactor * 0.08;

  rig.headPivot.rotation.x = -0.06 * moveFactor - hitFlinch * 0.6 + recoilKick * 0.25;
  rig.headPivot.rotation.y = strideSin * 0.08 * moveFactor;

  // 3. Two-Handed Forward Combat Weapon Hold (Arms + Elbows + Weapon Mount)
  const telegraphLift = bot.state === 'telegraph' || bot.state === 'attack' ? -0.08 : 0;

  rig.rightShoulderPivot.rotation.set(
    -0.76 + telegraphLift + recoilKick * 0.9 + breath * 0.014,
    -0.16,
    0.08
  );
  rig.rightElbowPivot.rotation.set(-0.84 - recoilKick * 0.45, 0.22, 0);

  rig.leftShoulderPivot.rotation.set(
    -0.8 + telegraphLift + recoilKick * 0.75 + breath * 0.014,
    0.46,
    -0.14
  );
  rig.leftElbowPivot.rotation.set(-0.62 - recoilKick * 0.35, -0.18, 0);

  rig.weaponMount.position.set(0.02, 0.23 + recoilKick * 0.04, 0.215 - recoilKick * 0.16);
  rig.weaponMount.rotation.set(-recoilKick * 0.45, 0, 0);

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

