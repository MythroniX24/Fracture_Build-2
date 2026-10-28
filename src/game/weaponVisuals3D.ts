import * as THREE from 'three';
import { WEAPON_REGISTRY, type WeaponId } from './config.ts';
import type { OpticId } from './ads/ads.types.ts';
import { DEFAULT_WEAPON_OPTICS, getWeaponADSProfile } from './ads/optic.config.ts';
import {
  build3DOpticAttachmentMesh,
  dispose3DOpticGroup,
} from './ads/ScopeAttachmentSystem.ts';

export interface WeaponViewModelRig {
  root: THREE.Group;
  gunGroup: THREE.Group;
  opticMount: THREE.Group;
  ironSightsGroup: THREE.Group;
  equippedOpticId: OpticId;
  slideOrBolt: THREE.Object3D;
  slideBaseZ: number;
  triggerBlade: THREE.Object3D;
  triggerBaseZ: number;
  fireSelector: THREE.Object3D;
  magazine: THREE.Object3D;
  magBasePos: THREE.Vector3;
  pumpGrip: THREE.Object3D | null;
  pumpBaseZ: number;
  muzzleFlashGroup: THREE.Group;
  muzzleTipLocal: THREE.Vector3;
  ejectionPortLocal: THREE.Vector3;
  rightHandSocket: THREE.Vector3;
  leftHandSocket: THREE.Vector3;
}

/**
 * Dynamically attaches, detaches, or swaps the 3D optic mesh on a weapon rig's `opticMount`
 * without rebuilding the underlying weapon model.
 */
export function setWeaponRigOpticAttachment(
  rig: WeaponViewModelRig,
  opticId: OpticId
): void {
  if (rig.equippedOpticId === opticId && rig.opticMount.children.length > 0) {
    return;
  }
  if (rig.equippedOpticId === opticId && opticId === 'none') {
    rig.ironSightsGroup.visible = true;
    return;
  }

  // Clear previous optic mesh
  while (rig.opticMount.children.length > 0) {
    const child = rig.opticMount.children[0];
    rig.opticMount.remove(child);
    dispose3DOpticGroup(child);
  }

  rig.equippedOpticId = opticId;
  if (opticId === 'none') {
    rig.ironSightsGroup.visible = true;
  } else {
    rig.ironSightsGroup.visible = false;
    const attachmentMesh = build3DOpticAttachmentMesh(opticId);
    rig.opticMount.add(attachmentMesh);
  }
}

/**
 * Builds an authentic, realistic real-life 3D weapon viewmodel for each specific weapon ID:
 * - M4A1: Flat-top receiver, Crane collapsible stock, round ribbed handguard, A-frame front sight, curved STANAG mag
 * - AK-47: Stamped steel receiver with ribbed dust cover, laminated wood stock & handguard, banana mag, slanted compensator
 * - MP5: Compact stamped receiver, front cocking tube with angled charging handle, curved 9mm stick mag, hooded ring sight, wire stock
 * - SPAS-12: Dual-tube (barrel + mag tube), perforated heat shield, ribbed pump slide, folding metal stock, pistol grip
 * - AWP: Olive-drab thumbhole sniper chassis, cheek rest, massive optical scope with turrets, fluted match barrel, dual-baffle brake, bipod
 * - Desert Eagle: Polygonal .50 AE slide with cocking serrations, triangular barrel with top rail, beaver-tail frame, combat sights
 */
export function buildDetailedWeaponViewModel(
  weaponId: WeaponId,
  muzzleFlashMap: THREE.Texture
): WeaponViewModelRig {
  const spec = WEAPON_REGISTRY[weaponId];
  const root = new THREE.Group();
  const gunGroup = new THREE.Group();
  root.add(gunGroup);

  const primaryMetal = new THREE.MeshStandardMaterial({
    color: spec.bodyColorHex,
    roughness: weaponId === 'deagle' ? 0.16 : 0.25,
    metalness: weaponId === 'deagle' ? 0.94 : 0.85,
    envMapIntensity: 1.35,
  });
  const darkSteel = new THREE.MeshStandardMaterial({
    color: 0x14161b,
    roughness: 0.24,
    metalness: 0.9,
    envMapIntensity: 1.3,
  });
  const gunmetal = new THREE.MeshStandardMaterial({
    color: 0x242930,
    roughness: 0.3,
    metalness: 0.82,
    envMapIntensity: 1.25,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x54361e,
    roughness: 0.52,
    metalness: 0.14,
    envMapIntensity: 1.1,
  });
  const chromeSteel = new THREE.MeshStandardMaterial({
    color: 0xd8dee8,
    roughness: 0.14,
    metalness: 0.96,
    envMapIntensity: 1.45,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.2,
    metalness: 0.94,
    envMapIntensity: 1.4,
  });
  const polymerOlive = new THREE.MeshStandardMaterial({
    color: 0x354236,
    roughness: 0.48,
    metalness: 0.24,
    envMapIntensity: 1.15,
  });

  const slideGroup = new THREE.Group();
  const opticMount = new THREE.Group();
  opticMount.name = `OpticMount_${weaponId}`;
  const adsProfile = getWeaponADSProfile(weaponId);
  opticMount.position.set(
    adsProfile.railMountPosition[0],
    adsProfile.railMountPosition[1],
    adsProfile.railMountPosition[2]
  );
  gunGroup.add(opticMount);

  const ironSightsGroup = new THREE.Group();
  ironSightsGroup.name = `IronSights_${weaponId}`;
  gunGroup.add(ironSightsGroup);

  let slideBaseZ = 0.02;
  let triggerBaseZ = 0.072;
  const magGroup = new THREE.Group();
  let magBasePos = new THREE.Vector3(0, -0.028, -0.048);
  let pumpGrip: THREE.Object3D | null = null;
  let pumpBaseZ = -0.22;
  let muzzleTipLocal = new THREE.Vector3(0, 0.018, -0.6);
  let ejectionPortLocal = new THREE.Vector3(0.025, 0.026, 0.02);
  const rightHandSocket = new THREE.Vector3(0, -0.065, 0.115);
  const leftHandSocket = new THREE.Vector3(0, -0.038, -0.22);

  // Common Precision Trigger Blade
  const triggerBlade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0025, 0.0035, 0.022, 12),
    chromeSteel
  );
  triggerBlade.rotation.x = 0.35;
  gunGroup.add(triggerBlade);

  // Common Articulated Fire Selector Switch
  const fireSelector = new THREE.Group();
  const selectorPin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0042, 0.0042, 0.006, 14),
    chromeSteel
  );
  selectorPin.rotation.z = Math.PI / 2;
  const selectorArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.0024, 0.016, 8, 12),
    chromeSteel
  );
  selectorArm.position.set(-0.003, 0, -0.007);
  selectorArm.rotation.x = Math.PI / 2;
  fireSelector.add(selectorPin, selectorArm);
  gunGroup.add(fireSelector);

  const boreBlack = new THREE.MeshBasicMaterial({ color: 0x030508 });

  if (weaponId === 'm4a1') {
    // =========================================================================
    // 1. M4A1 CARBINE (Authentic AR-15 / Carbine Architecture)
    // =========================================================================
    const recLen = 0.34;
    slideBaseZ = 0.02;
    triggerBaseZ = 0.068;
    rightHandSocket.set(0, -0.056, 0.116);
    leftHandSocket.set(0, -0.012, -0.175);

    // Upper Receiver with flat-top Picatinny rail, brass deflector, forward assist & T-charging handle
    const upperRec = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.052, recLen * 0.75),
      darkSteel
    );
    upperRec.position.set(0, 0.022, 0);
    const fwdAssist = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.008, 0.032, 12),
      gunmetal
    );
    fwdAssist.rotation.z = -Math.PI * 0.35;
    fwdAssist.position.set(0.028, 0.018, 0.048);
    const brassDefl = new THREE.Mesh(
      new THREE.ConeGeometry(0.012, 0.022, 4),
      darkSteel
    );
    brassDefl.rotation.z = -Math.PI / 2;
    brassDefl.position.set(0.028, 0.022, 0.012);
    const tChargingHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.01, 0.022),
      gunmetal
    );
    tChargingHandle.position.set(0, 0.038, 0.125);
    const dustCoverFlap = new THREE.Mesh(
      new THREE.BoxGeometry(0.004, 0.018, 0.068),
      gunmetal
    );
    dustCoverFlap.position.set(0.025, 0.016, -0.01);
    gunGroup.add(upperRec, fwdAssist, brassDefl, tChargingHandle, dustCoverFlap);

    // Flat-top Picatinny Rail + Cross-Slots
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.008, recLen * 0.72), darkSteel);
    rail.position.set(0, 0.051, 0);
    gunGroup.add(rail);
    for (let r = -5; r <= 5; r++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.004, 0.009), gunmetal);
      tooth.position.set(0, 0.056, r * 0.02);
      gunGroup.add(tooth);
    }

    // Flip-Up Backup Rear Iron Sight (visible when optic === 'none')
    const rearSightBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.012, 0.024),
      darkSteel
    );
    rearSightBase.position.set(0, 0.062, 0.085);
    const rearSightAperture = new THREE.Mesh(
      new THREE.TorusGeometry(0.008, 0.0022, 10, 18),
      gunmetal
    );
    rearSightAperture.position.set(0, 0.076, 0.085);
    ironSightsGroup.add(rearSightBase, rearSightAperture);

    // Lower Receiver with deep STANAG magwell skirt and trigger guard
    const lowerRec = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, 0.062, recLen * 0.7),
      primaryMetal
    );
    lowerRec.position.set(0, -0.018, 0.01);
    const magwellHousing = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.042, 0.080),
      primaryMetal
    );
    magwellHousing.position.set(0, -0.032, -0.045);
    const magwellFlare = new THREE.Mesh(
      new THREE.BoxGeometry(0.050, 0.018, 0.086),
      darkSteel
    );
    magwellFlare.position.set(0, -0.048, -0.045);
    const triggerGuard = new THREE.Mesh(
      new THREE.TorusGeometry(0.022, 0.0038, 12, 24, Math.PI * 1.1),
      darkSteel
    );
    triggerGuard.rotation.y = Math.PI / 2;
    triggerGuard.position.set(0, -0.038, triggerBaseZ);
    gunGroup.add(lowerRec, magwellHousing, magwellFlare, triggerGuard);

    // A2 Textured Pistol Grip with Finger Swell
    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.017, 0.082, 14, 20), darkSteel);
    grip.scale.set(0.9, 1.0, 1.35);
    grip.rotation.x = 0.28;
    grip.position.set(0, -0.062, 0.116);
    gunGroup.add(grip);

    // 6-Position Buffer Tube, Castle Nut & Crane Collapsible Buttstock (CQB-tucked so stock clears shoulder)
    const castleNut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.016, 16),
      gunmetal
    );
    castleNut.rotation.x = Math.PI / 2;
    castleNut.position.set(0, 0.014, 0.128);
    const bufferTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.10, 20),
      darkSteel
    );
    bufferTube.rotation.x = Math.PI / 2;
    bufferTube.position.set(0, 0.014, 0.172);
    const craneStock = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, 0.088, 0.095),
      gunmetal
    );
    craneStock.position.set(0, -0.008, 0.178);
    const buttPad = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.102, 0.018),
      darkSteel
    );
    buttPad.position.set(0, -0.012, 0.228);
    gunGroup.add(castleNut, bufferTube, craneStock, buttPad);

    // Delta Ring & Ribbed Round Carbine Handguard with Vent Ribs
    const deltaRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.027, 0.029, 0.022, 24),
      darkSteel
    );
    deltaRing.rotation.x = Math.PI / 2;
    deltaRing.position.set(0, 0.016, -0.14);
    const handguard = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.18, 24),
      gunmetal
    );
    handguard.rotation.x = Math.PI / 2;
    handguard.position.set(0, 0.016, -0.24);
    gunGroup.add(deltaRing, handguard);
    for (let r = 0; r < 6; r++) {
      const hgRib = new THREE.Mesh(
        new THREE.TorusGeometry(0.0265, 0.0022, 8, 20),
        darkSteel
      );
      hgRib.position.set(0, 0.016, -0.165 - r * 0.028);
      gunGroup.add(hgRib);
    }

    // Distinctive A-Frame Triangular Front Sight Post / Gas Block + Sight Ears
    const aFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.075, 0.028),
      darkSteel
    );
    aFrame.position.set(0, 0.058, -0.34);
    const frontPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.002, 0.002, 0.018, 8),
      chromeSteel
    );
    frontPost.position.set(0, 0.098, -0.34);
    gunGroup.add(aFrame, frontPost);

    // Exposed M4 Step-Cut Barrel, Birdcage Flash Hider & Hollow Bore
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.42, 20),
      darkSteel
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.016, -0.38);
    const flashHider = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.052, 20),
      gunmetal
    );
    flashHider.rotation.x = Math.PI / 2;
    flashHider.position.set(0, 0.016, -0.59);
    const muzzleBore = new THREE.Mesh(
      new THREE.CircleGeometry(0.0085, 16),
      boreBlack
    );
    muzzleBore.rotation.y = Math.PI;
    muzzleBore.position.set(0, 0.016, -0.617);
    gunGroup.add(barrel, flashHider, muzzleBore);

    // Curved 30-Round STANAG Magazine seated deep inside magwellHousing (top at +0.036 in magGroup space -> zero air gap)
    const magTower = new THREE.Mesh(
      new THREE.BoxGeometry(0.033, 0.055, 0.066),
      darkSteel
    );
    magTower.position.set(0, 0.008, 0);
    const magBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.034, 0.165, 0.068),
      gunmetal
    );
    magBody.position.set(0, -0.062, 0);
    for (let mr = 0; mr < 3; mr++) {
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.036, 0.008, 0.054),
        darkSteel
      );
      rib.position.set(0, -0.032 - mr * 0.042, 0);
      magGroup.add(rib);
    }
    const magBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.016, 0.072),
      darkSteel
    );
    magBase.position.set(0, -0.146, 0);
    magGroup.add(magTower, magBody, magBase);
    magBasePos.set(0, -0.028, -0.045);
    magGroup.position.copy(magBasePos);
    magGroup.rotation.x = -0.11;
    gunGroup.add(magGroup);

    // Bolt carrier inside ejection port
    const boltCarrier = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.068, 16),
      chromeSteel
    );
    boltCarrier.rotation.x = Math.PI / 2;
    boltCarrier.position.set(0.022, 0.022, 0);
    slideGroup.add(boltCarrier);
    slideGroup.position.set(0, 0, slideBaseZ);
    gunGroup.add(slideGroup);

    muzzleTipLocal.set(0, 0.016, -0.62);
    ejectionPortLocal.set(0.026, 0.022, 0.01);
  } else if (weaponId === 'ak47') {
    // =========================================================================
    // 2. AK-47 HEAVY (Stamped Steel Receiver, Laminated Wood, Banana Magazine)
    // =========================================================================
    const recLen = 0.36;
    slideBaseZ = 0.02;
    triggerBaseZ = 0.075;
    rightHandSocket.set(0, -0.056, 0.118);
    leftHandSocket.set(0, -0.022, -0.165);

    // Stamped Steel Receiver, Magwell Dimple Collar & Ribbed Sheet Metal Dust Cover
    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.068, recLen * 0.78),
      darkSteel
    );
    receiver.position.set(0, 0.006, 0);
    const akMagwellCollar = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, 0.026, 0.082),
      gunmetal
    );
    akMagwellCollar.position.set(0, -0.026, -0.05);
    const dustCover = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, recLen * 0.72, 20),
      darkSteel
    );
    dustCover.rotation.x = Math.PI / 2;
    dustCover.position.set(0, 0.035, 0.01);
    const rearSightBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.026, 0.056),
      gunmetal
    );
    rearSightBlock.position.set(0, 0.044, -0.12);
    const rearSightLeaf = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.01, 0.052),
      chromeSteel
    );
    rearSightLeaf.position.set(0, 0.058, -0.12);
    gunGroup.add(receiver, akMagwellCollar, dustCover, rearSightBlock, rearSightLeaf);

    // Classic Soviet Laminated Wood Drop-Comb Buttstock (compact CQB length for shoulder clearance)
    const buttStock = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.092, 0.115),
      woodMat
    );
    buttStock.rotation.x = -0.08;
    buttStock.position.set(0, -0.018, 0.182);
    const buttPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, 0.102, 0.014),
      darkSteel
    );
    buttPlate.rotation.x = -0.08;
    buttPlate.position.set(0, -0.024, 0.242);
    gunGroup.add(buttStock, buttPlate);

    // Checkered Wood Pistol Grip & Trigger Guard
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.108, 0.038), woodMat);
    grip.rotation.x = 0.28;
    grip.position.set(0, -0.058, 0.118);
    const triggerGuard = new THREE.Mesh(
      new THREE.TorusGeometry(0.022, 0.0036, 10, 20, Math.PI * 1.1),
      darkSteel
    );
    triggerGuard.rotation.y = Math.PI / 2;
    triggerGuard.position.set(0, -0.036, triggerBaseZ);
    gunGroup.add(grip, triggerGuard);

    // Laminated Wood Handguard (Lower palm swell + Upper gas tube + Steel retainers)
    const lowerWood = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, 0.048, 0.18),
      woodMat
    );
    lowerWood.position.set(0, -0.008, -0.22);
    const gasTubeWood = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.17, 16),
      woodMat
    );
    gasTubeWood.rotation.x = Math.PI / 2;
    gasTubeWood.position.set(0, 0.028, -0.22);
    const hgFerrule = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, 0.054, 0.014),
      darkSteel
    );
    hgFerrule.position.set(0, -0.006, -0.312);
    gunGroup.add(lowerWood, gasTubeWood, hgFerrule);

    // Barrel, 45° Gas Block, Cleaning Rod, Protected Front Sight Ears, and Slanted Compensator
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.44, 16),
      darkSteel
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.008, -0.38);
    const cleaningRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0035, 0.0035, 0.28, 10),
      gunmetal
    );
    cleaningRod.rotation.x = Math.PI / 2;
    cleaningRod.position.set(0, -0.004, -0.45);
    const gasBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.038, 0.032),
      darkSteel
    );
    gasBlock.rotation.x = 0.35;
    gasBlock.position.set(0, 0.022, -0.35);
    const frontSight = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.062, 0.024),
      darkSteel
    );
    frontSight.position.set(0, 0.052, -0.54);
    const frontSightHood = new THREE.Mesh(
      new THREE.TorusGeometry(0.012, 0.003, 10, 18, Math.PI * 1.3),
      darkSteel
    );
    frontSightHood.position.set(0, 0.078, -0.54);
    const slantMuzzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.045, 16),
      darkSteel
    );
    slantMuzzle.rotation.x = Math.PI / 2;
    slantMuzzle.rotation.y = 0.38;
    slantMuzzle.position.set(0, 0.008, -0.61);
    const muzzleBore = new THREE.Mesh(
      new THREE.CircleGeometry(0.009, 16),
      boreBlack
    );
    muzzleBore.rotation.y = Math.PI;
    muzzleBore.position.set(0, 0.008, -0.633);
    gunGroup.add(
      barrel,
      cleaningRod,
      gasBlock,
      frontSight,
      frontSightHood,
      slantMuzzle,
      muzzleBore
    );

    // Iconic 30-round Curved Steel Banana Magazine locked deep inside AK receiver & magwellCollar
    const magFeedNeck = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.048, 0.070),
      gunmetal
    );
    magFeedNeck.position.set(0, 0.016, 0);
    magGroup.add(magFeedNeck);
    for (let s = 0; s < 5; s++) {
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(0.034, 0.046, 0.068),
        darkSteel
      );
      seg.position.set(0, -0.032 * s - 0.004, -0.012 * s);
      seg.rotation.x = -0.11 * s;
      const spineRib = new THREE.Mesh(
        new THREE.BoxGeometry(0.036, 0.042, 0.012),
        gunmetal
      );
      spineRib.position.set(0, -0.032 * s - 0.004, -0.012 * s + 0.028);
      spineRib.rotation.x = -0.11 * s;
      magGroup.add(seg, spineRib);
    }
    magBasePos.set(0, -0.020, -0.05);
    magGroup.position.copy(magBasePos);
    gunGroup.add(magGroup);

    // Large AK Charging Handle attached to bolt carrier on right side
    const boltCarrier = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.08, 14),
      chromeSteel
    );
    boltCarrier.rotation.x = Math.PI / 2;
    boltCarrier.position.set(0.023, 0.018, 0);
    const akChargingHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.005, 0.032, 12),
      chromeSteel
    );
    akChargingHandle.rotation.z = Math.PI / 2;
    akChargingHandle.position.set(0.036, 0.02, -0.02);
    slideGroup.add(boltCarrier, akChargingHandle);
    slideGroup.position.set(0, 0, slideBaseZ);
    gunGroup.add(slideGroup);

    muzzleTipLocal.set(0, 0.008, -0.64);
    ejectionPortLocal.set(0.024, 0.018, 0.01);
  } else if (weaponId === 'mp5') {
    // =========================================================================
    // 3. MP5-K TACTICAL SUBMACHINE GUN (Compact Stamped SMG, Cocking Tube, Wire Stock)
    // =========================================================================
    const recLen = 0.28;
    slideBaseZ = 0.01;
    triggerBaseZ = 0.058;
    rightHandSocket.set(0, -0.050, 0.088);
    leftHandSocket.set(0, -0.022, -0.145);

    // Upper Stamped Steel Receiver, Magwell Housing & Cocking Tube
    const receiver = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.024, recLen * 0.8, 20),
      darkSteel
    );
    receiver.rotation.x = Math.PI / 2;
    receiver.position.set(0, 0.018, 0);
    const lowerHousing = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.042, recLen * 0.72),
      gunmetal
    );
    lowerHousing.position.set(0, -0.006, 0.01);
    const mp5Magwell = new THREE.Mesh(
      new THREE.BoxGeometry(0.040, 0.038, 0.054),
      darkSteel
    );
    mp5Magwell.position.set(0, -0.022, -0.038);
    const cockingTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.22, 16),
      darkSteel
    );
    cockingTube.rotation.x = Math.PI / 2;
    cockingTube.position.set(0, 0.042, -0.11);
    const mp5Handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0038, 0.005, 0.026, 12),
      chromeSteel
    );
    mp5Handle.rotation.z = -Math.PI * 0.35;
    mp5Handle.position.set(-0.019, 0.046, -0.16);
    gunGroup.add(receiver, lowerHousing, mp5Magwell, cockingTube, mp5Handle);

    // Rotating Diopter Drum Rear Sight + Hooded Front Ring Sight + Post
    const rearDiopter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.012, 0.018, 16),
      gunmetal
    );
    rearDiopter.position.set(0, 0.046, 0.06);
    const frontHood = new THREE.Mesh(
      new THREE.TorusGeometry(0.013, 0.0035, 10, 20),
      darkSteel
    );
    frontHood.position.set(0, 0.052, -0.24);
    const frontPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0018, 0.0018, 0.014, 8),
      chromeSteel
    );
    frontPost.position.set(0, 0.048, -0.24);
    gunGroup.add(rearDiopter, frontHood, frontPost);

    // Ribbed Synthetic Tropical Handguard with Grip Grooves
    const tropicalForend = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, 0.055, 0.14),
      darkSteel
    );
    tropicalForend.position.set(0, -0.008, -0.16);
    gunGroup.add(tropicalForend);
    for (let g = -2; g <= 2; g++) {
      const groove = new THREE.Mesh(
        new THREE.BoxGeometry(0.046, 0.008, 0.012),
        gunmetal
      );
      groove.position.set(0, -0.012, -0.16 + g * 0.024);
      gunGroup.add(groove);
    }

    // 3-Lug Barrel, Compact Tactical Suppressor/Muzzle & Hollow Bore
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.26, 16),
      darkSteel
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.018, -0.28);
    const muzzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.08, 18),
      gunmetal
    );
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.018, -0.42);
    const muzzleBore = new THREE.Mesh(
      new THREE.CircleGeometry(0.008, 16),
      boreBlack
    );
    muzzleBore.rotation.y = Math.PI;
    muzzleBore.position.set(0, 0.018, -0.461);
    gunGroup.add(barrel, muzzle, muzzleBore);

    // Dual-Strut Retractable Steel Wire Stock (collapsed/CQB position)
    const wireL = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.105, 8), darkSteel);
    wireL.rotation.x = Math.PI / 2;
    wireL.position.set(-0.024, 0.014, 0.145);
    const wireR = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.105, 8), darkSteel);
    wireR.rotation.x = Math.PI / 2;
    wireR.position.set(0.024, 0.014, 0.145);
    const buttPad = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.09, 0.018), darkSteel);
    buttPad.position.set(0, -0.008, 0.198);
    gunGroup.add(wireL, wireR, buttPad);

    // Polymer Pistol Grip & Trigger Guard
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.098, 0.032), darkSteel);
    grip.rotation.x = 0.24;
    grip.position.set(0, -0.052, 0.086);
    const triggerGuard = new THREE.Mesh(
      new THREE.TorusGeometry(0.019, 0.0034, 10, 20, Math.PI * 1.1),
      darkSteel
    );
    triggerGuard.rotation.y = Math.PI / 2;
    triggerGuard.position.set(0, -0.032, triggerBaseZ);
    gunGroup.add(grip, triggerGuard);

    // Curved 9mm Stick Magazine & Floorplate seated deep inside mp5Magwell (zero air gap)
    const magFeedTower = new THREE.Mesh(new THREE.BoxGeometry(0.027, 0.048, 0.040), darkSteel);
    magFeedTower.position.set(0, 0.012, 0);
    const magBody = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.17, 0.042), gunmetal);
    magBody.position.set(0, -0.068, 0);
    const magFloor = new THREE.Mesh(new THREE.BoxGeometry(0.031, 0.014, 0.046), darkSteel);
    magFloor.position.set(0, -0.155, 0);
    magGroup.add(magFeedTower, magBody, magFloor);
    magBasePos.set(0, -0.022, -0.038);
    magGroup.position.copy(magBasePos);
    magGroup.rotation.x = -0.13;
    gunGroup.add(magGroup);

    // Bolt mechanism
    const boltMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.05, 12), chromeSteel);
    boltMesh.rotation.x = Math.PI / 2;
    boltMesh.position.set(0.018, 0.018, 0);
    slideGroup.add(boltMesh);
    slideGroup.position.set(0, 0, slideBaseZ);
    gunGroup.add(slideGroup);

    muzzleTipLocal.set(0, 0.018, -0.46);
    ejectionPortLocal.set(0.022, 0.018, 0.01);
  } else if (weaponId === 'spas12') {
    // =========================================================================
    // 4. SPAS-12 COMBAT SHOTGUN (Dual-Tube, Heat Shield, Pump Slide, Folding Stock)
    // =========================================================================
    const recLen = 0.42;
    slideBaseZ = 0.02;
    triggerBaseZ = 0.082;
    pumpBaseZ = -0.195;
    rightHandSocket.set(0, -0.056, 0.122);
    leftHandSocket.set(0, -0.022, -0.195);

    // Heavy Combat Shotgun Receiver + Trigger Guard
    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, 0.082, recLen * 0.75),
      darkSteel
    );
    receiver.position.set(0, 0.01, 0);
    const triggerGuard = new THREE.Mesh(
      new THREE.TorusGeometry(0.022, 0.0038, 10, 20, Math.PI * 1.1),
      darkSteel
    );
    triggerGuard.rotation.y = Math.PI / 2;
    triggerGuard.position.set(0, -0.038, triggerBaseZ);
    gunGroup.add(receiver, triggerGuard);

    // Dual-Tube Architecture: 12-Gauge Top Barrel + Full-Length Lower Magazine Tube + Hollow Bore
    const topBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0145, 0.0145, 0.48, 20),
      darkSteel
    );
    topBarrel.rotation.x = Math.PI / 2;
    topBarrel.position.set(0, 0.026, -0.38);
    const muzzleBore = new THREE.Mesh(
      new THREE.CircleGeometry(0.012, 16),
      boreBlack
    );
    muzzleBore.rotation.y = Math.PI;
    muzzleBore.position.set(0, 0.026, -0.621);
    const lowerMagTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0135, 0.0135, 0.44, 20),
      gunmetal
    );
    lowerMagTube.rotation.x = Math.PI / 2;
    lowerMagTube.position.set(0, -0.006, -0.36);
    const magCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0145, 0.0145, 0.028, 20),
      chromeSteel
    );
    magCap.rotation.x = Math.PI / 2;
    magCap.position.set(0, -0.006, -0.58);
    const frontBlade = new THREE.Mesh(
      new THREE.BoxGeometry(0.006, 0.018, 0.016),
      chromeSteel
    );
    frontBlade.position.set(0, 0.048, -0.58);
    gunGroup.add(topBarrel, muzzleBore, lowerMagTube, magCap, frontBlade);

    // Perforated Stamped Metal Heat Shield over Barrel with Cooling Slots
    const heatShield = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.036, 0.28),
      darkSteel
    );
    heatShield.position.set(0, 0.036, -0.32);
    gunGroup.add(heatShield);
    for (let v = 0; v < 6; v++) {
      const vent = new THREE.Mesh(
        new THREE.BoxGeometry(0.048, 0.01, 0.024),
        boreBlack
      );
      vent.position.set(0, 0.042, -0.21 - v * 0.042);
      gunGroup.add(vent);
    }

    // Deeply Ribbed Pump-Action Forend Slide
    const pumpGroup = new THREE.Group();
    const pumpBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.15, 20),
      darkSteel
    );
    pumpBody.rotation.x = Math.PI / 2;
    pumpGroup.add(pumpBody);
    for (let r = -2; r <= 2; r++) {
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(0.027, 0.0028, 8, 16),
        gunmetal
      );
      rib.position.set(0, 0, r * 0.026);
      pumpGroup.add(rib);
    }
    pumpGroup.position.set(0, -0.006, pumpBaseZ);
    gunGroup.add(pumpGroup);
    pumpGrip = pumpGroup;

    // SPAS-12 Folding Stamped Metal Skeleton Stock (Resting over receiver with hook)
    const foldStock = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, 0.022, 0.24),
      gunmetal
    );
    foldStock.position.set(0, 0.062, 0.02);
    const hookRest = new THREE.Mesh(
      new THREE.TorusGeometry(0.026, 0.005, 10, 16, Math.PI),
      darkSteel
    );
    hookRest.position.set(0, 0.076, 0.14);
    gunGroup.add(foldStock, hookRest);

    // Heavy Textured Pistol Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.11, 0.038), darkSteel);
    grip.rotation.x = 0.28;
    grip.position.set(0, -0.058, 0.122);
    gunGroup.add(grip);

    // Wide 12-Gauge Ejection Port & Shell Carrier
    const shellCarrier = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.055, 12),
      brassMat
    );
    shellCarrier.rotation.x = Math.PI / 2;
    shellCarrier.position.set(0.025, 0.018, 0.01);
    slideGroup.add(shellCarrier);
    slideGroup.position.set(0, 0, slideBaseZ);
    gunGroup.add(slideGroup);

    // Red 12-Gauge Buckshot Shell + Brass Rim in magGroup seated flush in bottom loading gate
    const shellHullMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.35,
      metalness: 0.15,
    });
    const shellHull = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.052, 14),
      shellHullMat
    );
    shellHull.rotation.x = Math.PI / 2;
    const shellBrass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0105, 0.0105, 0.016, 14),
      brassMat
    );
    shellBrass.rotation.x = Math.PI / 2;
    shellBrass.position.z = 0.026;
    magGroup.add(shellHull, shellBrass);
    magBasePos.set(0, -0.020, -0.06);
    magGroup.position.copy(magBasePos);
    gunGroup.add(magGroup);

    muzzleTipLocal.set(0, 0.026, -0.63);
    ejectionPortLocal.set(0.028, 0.018, 0.02);
  } else if (weaponId === 'awp') {
    // =========================================================================
    // 5. AWP MAGNUM SNIPER RIFLE (Thumbhole Chassis, 8x Scope, Fluted Barrel)
    // =========================================================================
    const recLen = 0.48;
    slideBaseZ = 0.02;
    triggerBaseZ = 0.078;
    rightHandSocket.set(0, -0.052, 0.118);
    leftHandSocket.set(0, -0.028, -0.145);

    // Rigid Olive-Drab Polymer Thumbhole Chassis, Magwell Skirt & Stock (compact rear overhang)
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(0.054, 0.092, 0.36),
      polymerOlive
    );
    chassis.position.set(0, -0.014, 0.02);
    const awpMagwellFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, 0.028, 0.088),
      darkSteel
    );
    awpMagwellFrame.position.set(0, -0.052, -0.035);
    const thumbholeHole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.020, 0.020, 0.058, 16),
      darkSteel
    );
    thumbholeHole.rotation.z = Math.PI / 2;
    thumbholeHole.position.set(0, -0.024, 0.138);
    const cheekPiece = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, 0.036, 0.088),
      darkSteel
    );
    cheekPiece.position.set(0, 0.046, 0.175);
    const buttPad = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.108, 0.020),
      darkSteel
    );
    buttPad.position.set(0, -0.016, 0.228);
    gunGroup.add(chassis, awpMagwellFrame, thumbholeHole, cheekPiece, buttPad);

    // Cylindrical Steel Bolt-Action Receiver
    const receiver = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.32, 20),
      darkSteel
    );
    receiver.rotation.x = Math.PI / 2;
    receiver.position.set(0, 0.034, -0.02);
    gunGroup.add(receiver);

    // Rotating Bolt Handle with Ball Knob on Right Side (articulates during bolt-action cycle & reload)
    const boltBody = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.09, 14), chromeSteel);
    boltBody.rotation.x = Math.PI / 2;
    boltBody.position.set(0.018, 0.034, 0);
    const boltArm = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.038, 10), chromeSteel);
    boltArm.position.set(0.035, 0.034, 0.01);
    boltArm.rotation.x = Math.PI * 0.42;
    const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.01, 14, 14), darkSteel);
    boltKnob.position.set(0.042, 0.022, 0.038);
    slideGroup.add(boltBody, boltArm, boltKnob);
    slideGroup.position.set(0, 0, slideBaseZ);
    gunGroup.add(slideGroup);

    // Precision Picatinny Scope Rail + Backup Iron Sights (when optic === 'none')
    const awpTopRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.024, 0.01, 0.24),
      darkSteel
    );
    awpTopRail.position.set(0, 0.052, -0.01);
    gunGroup.add(awpTopRail);

    const awpRearIron = new THREE.Mesh(
      new THREE.TorusGeometry(0.009, 0.0024, 10, 18),
      gunmetal
    );
    awpRearIron.position.set(0, 0.068, 0.09);
    const awpFrontIron = new THREE.Mesh(
      new THREE.BoxGeometry(0.006, 0.018, 0.008),
      darkSteel
    );
    awpFrontIron.position.set(0, 0.052, -0.74);
    ironSightsGroup.add(awpRearIron, awpFrontIron);

    // Match-Grade Long Fluted Barrel + Dual-Baffle Muzzle Brake + Ports & Hollow Bore
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.013, 0.62, 24),
      darkSteel
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.032, -0.46);
    const muzzleBrake = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.034, 0.075),
      darkSteel
    );
    muzzleBrake.position.set(0, 0.032, -0.80);
    const brakeVent = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, 0.016, 0.022),
      boreBlack
    );
    brakeVent.position.set(0, 0.032, -0.79);
    const muzzleBore = new THREE.Mesh(
      new THREE.CircleGeometry(0.011, 16),
      boreBlack
    );
    muzzleBore.rotation.y = Math.PI;
    muzzleBore.position.set(0, 0.032, -0.838);
    gunGroup.add(barrel, muzzleBrake, brakeVent, muzzleBore);

    // Folding Steel Bipod Legs under Barrel
    const bipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.18, 8), darkSteel);
    bipodL.rotation.x = Math.PI * 0.44;
    bipodL.position.set(-0.022, -0.042, -0.42);
    const bipodR = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.18, 8), darkSteel);
    bipodR.rotation.x = Math.PI * 0.44;
    bipodR.position.set(0.022, -0.042, -0.42);
    gunGroup.add(bipodL, bipodR);

    // Detachable 5-Round .338 Box Magazine + Floorplate seated deep inside awpMagwellFrame & chassis
    const magBody = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.098, 0.078), darkSteel);
    magBody.position.set(0, -0.028, 0);
    const magPlate = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.014, 0.082), gunmetal);
    magPlate.position.set(0, -0.078, 0);
    magGroup.add(magBody, magPlate);
    magBasePos.set(0, -0.024, -0.035);
    magGroup.position.copy(magBasePos);
    gunGroup.add(magGroup);

    muzzleTipLocal.set(0, 0.032, -0.85);
    ejectionPortLocal.set(0.024, 0.034, 0.01);
  } else {
    // =========================================================================
    // 6. DESERT EAGLE .50 ACTION EXPRESS (Polygonal Slide, Triangular Barrel)
    // =========================================================================
    const recLen = 0.22;
    slideBaseZ = 0.0;
    triggerBaseZ = 0.045;
    rightHandSocket.set(0, -0.052, 0.066);
    leftHandSocket.set(-0.018, -0.062, 0.056);

    // Lower Frame with Integral Picatinny Accessory Rail, Extended Beavertail & External Hammer
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.048, recLen * 0.95),
      darkSteel
    );
    frame.position.set(0, -0.01, 0.01);
    const beaverTail = new THREE.Mesh(
      new THREE.BoxGeometry(0.034, 0.018, 0.042),
      darkSteel
    );
    beaverTail.position.set(0, 0.01, 0.115);
    const hammerSpur = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.022, 0.018),
      chromeSteel
    );
    hammerSpur.rotation.x = -0.45;
    hammerSpur.position.set(0, 0.028, 0.112);
    const triggerGuard = new THREE.Mesh(
      new THREE.TorusGeometry(0.018, 0.0034, 10, 20, Math.PI * 1.1),
      darkSteel
    );
    triggerGuard.rotation.y = Math.PI / 2;
    triggerGuard.position.set(0, -0.032, triggerBaseZ);
    gunGroup.add(frame, beaverTail, hammerSpur, triggerGuard);

    // Wrap-Around Textured Combat Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.115, 0.052), darkSteel);
    grip.rotation.x = 0.28;
    grip.position.set(0, -0.058, 0.066);
    gunGroup.add(grip);

    // Massive Polygonal .50 AE Steel Slide with Cocking Serrations, Triangular Barrel & Hollow Bore
    const slideMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.052, recLen * 1.05),
      primaryMetal
    );
    slideMesh.position.set(0, 0.025, -0.01);
    for (let s = 0; s < 5; s++) {
      const serration = new THREE.Mesh(
        new THREE.BoxGeometry(0.044, 0.034, 0.004),
        darkSteel
      );
      serration.position.set(0, 0.025, 0.042 + s * 0.011);
      slideGroup.add(serration);
    }
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.044, 0.12),
      primaryMetal
    );
    barrel.position.set(0, 0.022, -0.16);
    const muzzleBore = new THREE.Mesh(
      new THREE.CircleGeometry(0.011, 16),
      boreBlack
    );
    muzzleBore.rotation.y = Math.PI;
    muzzleBore.position.set(0, 0.022, -0.221);
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.014, 0.01), darkSteel);
    frontSight.position.set(0, 0.054, -0.21);
    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.014, 0.012), darkSteel);
    rearSight.position.set(0, 0.054, 0.09);
    const portEject = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.028, 0.048), brassMat);
    portEject.position.set(0.016, 0.025, 0.01);

    slideGroup.add(slideMesh, barrel, muzzleBore, frontSight, rearSight, portEject);
    slideGroup.position.set(0, 0, slideBaseZ);
    gunGroup.add(slideGroup);

    // Full Detachable .50 AE Magazine Box + Angled Floorplate flush with Grip bottom
    const magTower = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.112, 0.046), chromeSteel);
    magTower.rotation.x = 0.28;
    magTower.position.set(0, -0.054, 0.065);
    const magBase = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.016, 0.056), darkSteel);
    magBase.rotation.x = 0.28;
    magBase.position.set(0, -0.106, 0.080);
    magGroup.add(magTower, magBase);
    magBasePos.set(0, 0, 0);
    magGroup.position.copy(magBasePos);
    gunGroup.add(magGroup);

    muzzleTipLocal.set(0, 0.022, -0.23);
    ejectionPortLocal.set(0.022, 0.025, 0.01);
  }

  // Common Volumetric 3-Axis Muzzle Flash
  const muzzleFlashGroup = new THREE.Group();
  const mfMat = new THREE.MeshBasicMaterial({
    map: muzzleFlashMap,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const flashFront = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), mfMat);
  const flashCrossH = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.2), mfMat);
  flashCrossH.rotation.y = Math.PI / 2;
  flashCrossH.position.z = -0.08;
  const flashCrossV = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.2), mfMat);
  flashCrossV.rotation.y = Math.PI / 2;
  flashCrossV.rotation.x = Math.PI / 2;
  flashCrossV.position.z = -0.08;
  muzzleFlashGroup.add(flashFront, flashCrossH, flashCrossV);
  muzzleFlashGroup.position.copy(muzzleTipLocal);
  muzzleFlashGroup.visible = false;
  gunGroup.add(muzzleFlashGroup);

  const rig: WeaponViewModelRig = {
    root,
    gunGroup,
    opticMount,
    ironSightsGroup,
    equippedOpticId: 'none',
    slideOrBolt: slideGroup,
    slideBaseZ,
    triggerBlade,
    triggerBaseZ,
    fireSelector,
    magazine: magGroup,
    magBasePos,
    pumpGrip,
    pumpBaseZ,
    muzzleFlashGroup,
    muzzleTipLocal,
    ejectionPortLocal,
    rightHandSocket,
    leftHandSocket,
  };

  setWeaponRigOpticAttachment(rig, DEFAULT_WEAPON_OPTICS[weaponId] ?? 'none');
  return rig;
}
