import * as THREE from 'three';
import { CharacterId } from '../game/config.ts';
import { FighterState } from '../game/rules.ts';
import { MaterialLibrary } from './materials.ts';

export interface ArticulatedFighterRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftShoulder: THREE.Group;
  leftForearm: THREE.Group;
  rightShoulder: THREE.Group;
  rightForearm: THREE.Group;
  leftHip: THREE.Group;
  leftShin: THREE.Group;
  rightHip: THREE.Group;
  rightShin: THREE.Group;
  coreMesh: THREE.Mesh;
  guardShieldMesh: THREE.Mesh;
  decoyGroup: THREE.Group;
  primaryArmorClone: THREE.MeshStandardMaterial;
  coreMaterialClone: THREE.MeshStandardMaterial;
  walkCyclePhase: number;
}

function createBeveledPlateGeometry(w: number, h: number, d: number, bevel = 0.03): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const hw = w * 0.5;
  const hh = h * 0.5;
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw, -hh);
  shape.lineTo(hw * 0.88, hh);
  shape.lineTo(-hw * 0.88, hh);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: d,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

export function buildArticulatedFighter(
  characterId: CharacterId,
  materials: MaterialLibrary,
  castShadow: boolean
): ArticulatedFighterRig {
  const root = new THREE.Group();
  root.name = `fighter_${characterId}`;

  // Contact shadow disc grounded at y = 0.018
  const shadowGeo = new THREE.CircleGeometry(0.82, 24);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMesh = new THREE.Mesh(shadowGeo, materials.contactShadow);
  shadowMesh.position.y = 0.018;
  root.add(shadowMesh);

  // Body pivot for squash/stretch and animation vertical bob
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const pelvis = new THREE.Group();
  pelvis.position.y = 0.92;
  bodyPivot.add(pelvis);

  const torso = new THREE.Group();
  torso.position.y = 0.22;
  pelvis.add(torso);

  const head = new THREE.Group();
  head.position.y = 0.56;
  torso.add(head);

  const leftShoulder = new THREE.Group();
  const rightShoulder = new THREE.Group();
  const leftForearm = new THREE.Group();
  const rightForearm = new THREE.Group();

  const leftHip = new THREE.Group();
  const rightHip = new THREE.Group();
  const leftShin = new THREE.Group();
  const rightShin = new THREE.Group();

  // Clone primary material so hit flashes only affect this specific fighter
  const primaryArmorClone =
    characterId === 'volt'
      ? materials.voltArmorPrimary.clone()
      : materials.riftArmorBone.clone();

  const coreMaterialClone =
    characterId === 'volt'
      ? materials.voltCoreEmissive.clone()
      : materials.riftBracerBronze.clone();

  let coreMesh: THREE.Mesh;

  if (characterId === 'volt') {
    // =========================================================================
    // CHARACTER 01: VOLT — Heavy Siege-Breaker Power Fighter
    // =========================================================================
    leftShoulder.position.set(-0.44, 0.36, 0);
    rightShoulder.position.set(0.44, 0.36, 0);
    leftForearm.position.set(0, -0.32, 0);
    rightForearm.position.set(0, -0.32, 0);

    leftHip.position.set(-0.22, -0.06, 0);
    rightHip.position.set(0.22, -0.06, 0);
    leftShin.position.set(0, -0.42, 0);
    rightShin.position.set(0, -0.42, 0);

    // Pelvis / Belt Assembly
    const pelvisBlock = new THREE.Mesh(
      createBeveledPlateGeometry(0.54, 0.24, 0.36, 0.025),
      materials.mechanicalFrame
    );
    const beltPlate = new THREE.Mesh(
      createBeveledPlateGeometry(0.58, 0.14, 0.4, 0.02),
      materials.voltArmorSecondary
    );
    beltPlate.position.y = 0.04;
    pelvis.add(pelvisBlock, beltPlate);

    // Torso Chassis & Layered Heavy Chest Plastron
    const spineCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.2, 0.52, 10),
      materials.mechanicalFrame
    );
    spineCore.position.y = 0.22;
    torso.add(spineCore);

    const chestArmor = new THREE.Mesh(
      createBeveledPlateGeometry(0.72, 0.48, 0.44, 0.04),
      primaryArmorClone
    );
    chestArmor.position.set(0, 0.28, 0.02);
    torso.add(chestArmor);

    // Collar / Gorget Guard
    const gorget = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.3, 0.14, 8, 1, true),
      materials.voltArmorSecondary
    );
    gorget.position.set(0, 0.52, 0.02);
    torso.add(gorget);

    // Rear Furnace Exhaust Packs
    const exhaustPack = new THREE.Mesh(
      createBeveledPlateGeometry(0.46, 0.38, 0.2, 0.025),
      materials.oxidizedIron
    );
    exhaustPack.position.set(0, 0.3, -0.26);
    torso.add(exhaustPack);

    // Distinctive Blue Arc Reactor Core recessed in Chest
    const coreRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.028, 8, 16),
      materials.weatheredSteel
    );
    coreRing.position.set(0, 0.28, 0.25);
    torso.add(coreRing);

    coreMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.06, 16),
      coreMaterialClone
    );
    coreMesh.rotation.x = Math.PI / 2;
    coreMesh.position.set(0, 0.28, 0.24);
    torso.add(coreMesh);

    // Industrial Siege Helmet
    const helmDome = new THREE.Mesh(
      createBeveledPlateGeometry(0.32, 0.3, 0.34, 0.03),
      primaryArmorClone
    );
    helmDome.position.y = 0.12;
    const helmVisorSlit = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.06, 0.36),
      coreMaterialClone
    );
    helmVisorSlit.position.set(0, 0.13, 0.02);
    const helmCrest = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.12, 0.38),
      materials.voltArmorSecondary
    );
    helmCrest.position.set(0, 0.26, -0.01);
    head.add(helmDome, helmVisorSlit, helmCrest);

    // Broad Layered Pauldrons & Hydraulic Arms
    const pauldronGeo = createBeveledPlateGeometry(0.34, 0.32, 0.38, 0.035);
    const upperArmGeo = new THREE.CylinderGeometry(0.11, 0.1, 0.32, 10);
    const forearmGeo = createBeveledPlateGeometry(0.26, 0.38, 0.28, 0.03);
    const pistonGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.36, 8);
    const fistGeo = new THREE.BoxGeometry(0.22, 0.2, 0.24);

    for (const [side, shoulderGrp, forearmGrp] of [
      [-1, leftShoulder, leftForearm],
      [1, rightShoulder, rightForearm],
    ] as const) {
      const pauldron = new THREE.Mesh(pauldronGeo, primaryArmorClone);
      pauldron.position.set(side * 0.08, 0.06, 0);
      pauldron.rotation.z = -side * 0.22;

      const pauldronTrim = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.08, 0.42),
        materials.voltArmorSecondary
      );
      pauldronTrim.position.set(side * 0.09, -0.06, 0);

      const upperArm = new THREE.Mesh(upperArmGeo, materials.mechanicalFrame);
      upperArm.position.y = -0.16;

      shoulderGrp.add(pauldron, pauldronTrim, upperArm, forearmGrp);

      // Reinforced Piston Gauntlet
      const gauntlet = new THREE.Mesh(forearmGeo, primaryArmorClone);
      gauntlet.position.y = -0.18;

      const piston = new THREE.Mesh(pistonGeo, materials.weatheredSteel);
      piston.position.set(side * 0.12, -0.16, -0.06);

      const knuckleFist = new THREE.Mesh(fistGeo, materials.oxidizedIron);
      knuckleFist.position.set(0, -0.38, 0.03);

      forearmGrp.add(gauntlet, piston, knuckleFist);
    }

    // Heavy Stable Legs & Greaves
    const thighGeo = createBeveledPlateGeometry(0.24, 0.42, 0.26, 0.025);
    const kneeGeo = new THREE.BoxGeometry(0.22, 0.14, 0.28);
    const greaveGeo = createBeveledPlateGeometry(0.26, 0.44, 0.3, 0.03);
    const bootGeo = createBeveledPlateGeometry(0.28, 0.14, 0.42, 0.02);

    for (const [, hipGrp, shinGrp] of [
      [-1, leftHip, leftShin],
      [1, rightHip, rightShin],
    ] as const) {
      const thigh = new THREE.Mesh(thighGeo, materials.mechanicalFrame);
      thigh.position.y = -0.2;
      const thighPlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.3, 0.28),
        materials.voltArmorSecondary
      );
      thighPlate.position.set(0, -0.18, 0.02);
      hipGrp.add(thigh, thighPlate, shinGrp);

      const kneeGuard = new THREE.Mesh(kneeGeo, materials.weatheredSteel);
      kneeGuard.position.set(0, 0.02, 0.04);

      const greave = new THREE.Mesh(greaveGeo, primaryArmorClone);
      greave.position.y = -0.22;

      const boot = new THREE.Mesh(bootGeo, materials.oxidizedIron);
      boot.position.set(0, -0.43, 0.06);

      shinGrp.add(kneeGuard, greave, boot);
    }
  } else {
    // =========================================================================
    // CHARACTER 02: RIFT — Agile Colossus Scavenger & Tactical Trickster
    // =========================================================================
    leftShoulder.position.set(-0.34, 0.36, 0);
    rightShoulder.position.set(0.35, 0.38, 0);
    leftForearm.position.set(0, -0.31, 0);
    rightForearm.position.set(0, -0.31, 0);

    leftHip.position.set(-0.17, -0.05, 0);
    rightHip.position.set(0.17, -0.05, 0);
    leftShin.position.set(0, -0.43, 0);
    rightShin.position.set(0, -0.43, 0);

    // Lean Scavenger Pelvis & Asymmetrical Hip Tassets
    const pelvisCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.16, 0.22, 8),
      materials.mechanicalFrame
    );
    const rightHipPlate = new THREE.Mesh(
      createBeveledPlateGeometry(0.16, 0.28, 0.26, 0.015),
      primaryArmorClone
    );
    rightHipPlate.position.set(0.2, -0.06, 0);
    rightHipPlate.rotation.z = -0.18;
    pelvis.add(pelvisCore, rightHipPlate);

    // Articulated Charcoal Spine & Bone-White Salvaged Rib Cuirass
    const spineFrame = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.14, 0.52, 8),
      materials.mechanicalFrame
    );
    spineFrame.position.y = 0.24;
    torso.add(spineFrame);

    const boneCuirass = new THREE.Mesh(
      createBeveledPlateGeometry(0.5, 0.44, 0.32, 0.025),
      primaryArmorClone
    );
    boneCuirass.position.set(0, 0.29, 0.02);
    torso.add(boneCuirass);

    // Diagonal Weathered Scarf / Moss Mantle across chest
    const mossMantle = new THREE.Mesh(
      createBeveledPlateGeometry(0.54, 0.16, 0.36, 0.02),
      materials.riftMossAccent
    );
    mossMantle.position.set(0.03, 0.44, 0.01);
    mossMantle.rotation.z = 0.22;
    torso.add(mossMantle);

    // Salvaged Colossus Gyro-Core on chest/back
    coreMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.11, 0),
      coreMaterialClone
    );
    coreMesh.position.set(-0.06, 0.3, 0.19);
    torso.add(coreMesh);

    // Enclosed Scavenger Helmet (tapered bone mask + vertical optical slit)
    const helmBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.16, 0.3, 8),
      primaryArmorClone
    );
    helmBase.position.y = 0.13;
    const helmFaceplate = new THREE.Mesh(
      createBeveledPlateGeometry(0.22, 0.28, 0.24, 0.02),
      primaryArmorClone
    );
    helmFaceplate.position.set(0, 0.14, 0.04);
    const helmSlit = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.18, 0.27),
      materials.mechanicalFrame
    );
    helmSlit.position.set(0, 0.14, 0.05);
    const helmEye = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.035, 0.28),
      coreMaterialClone
    );
    helmEye.position.set(0, 0.16, 0.05);
    head.add(helmBase, helmFaceplate, helmSlit, helmEye);

    // RIGHT ARM: Salvaged Fallen Colossus Pauldron (Asymmetrical Heavy Relic)
    const colossusPauldron = new THREE.Mesh(
      createBeveledPlateGeometry(0.36, 0.34, 0.36, 0.03),
      primaryArmorClone
    );
    colossusPauldron.position.set(0.1, 0.08, 0);
    colossusPauldron.rotation.z = -0.3;

    const mossPatch = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.1, 0.38),
      materials.riftMossAccent
    );
    mossPatch.position.set(0.12, 0.18, 0);
    mossPatch.rotation.z = -0.3;

    const rUpperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.07, 0.3, 8),
      materials.mechanicalFrame
    );
    rUpperArm.position.y = -0.15;
    rightShoulder.add(colossusPauldron, mossPatch, rUpperArm, rightForearm);

    const rForearmArmor = new THREE.Mesh(
      createBeveledPlateGeometry(0.16, 0.34, 0.18, 0.02),
      materials.riftArmorSteel
    );
    rForearmArmor.position.y = -0.17;
    // Reverse-grip Scavenger Kinetic Blade (grounded industrial shear blade, not oversized fantasy sword)
    const rBlade = new THREE.Mesh(
      createBeveledPlateGeometry(0.05, 0.56, 0.12, 0.01),
      primaryArmorClone
    );
    rBlade.position.set(0.06, -0.36, 0.18);
    rBlade.rotation.x = Math.PI * 0.38;
    rightForearm.add(rForearmArmor, rBlade);

    // LEFT ARM: Agile Joint + Distinctive Misdirection Echo-Bracer
    const lPauldron = new THREE.Mesh(
      createBeveledPlateGeometry(0.2, 0.18, 0.24, 0.02),
      materials.riftArmorSteel
    );
    lPauldron.position.set(-0.05, 0.04, 0);
    const lUpperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.068, 0.3, 8),
      materials.mechanicalFrame
    );
    lUpperArm.position.y = -0.15;
    leftShoulder.add(lPauldron, lUpperArm, leftForearm);

    const lForearmBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.075, 0.32, 8),
      materials.riftArmorSteel
    );
    lForearmBody.position.y = -0.16;

    // Misdirection Bracer Rings
    const bracerRing1 = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.02, 8, 16),
      coreMaterialClone
    );
    bracerRing1.rotation.x = Math.PI / 2;
    bracerRing1.position.y = -0.14;

    const bracerRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.018, 8, 16),
      primaryArmorClone
    );
    bracerRing2.rotation.x = Math.PI / 2;
    bracerRing2.position.y = -0.24;

    const lBlade = new THREE.Mesh(
      createBeveledPlateGeometry(0.04, 0.44, 0.1, 0.01),
      materials.weatheredSteel
    );
    lBlade.position.set(-0.06, -0.34, 0.14);
    lBlade.rotation.x = Math.PI * 0.35;

    leftForearm.add(lForearmBody, bracerRing1, bracerRing2, lBlade);

    // Agile Articulated Legs
    for (const [, hipGrp, shinGrp] of [
      [-1, leftHip, leftShin],
      [1, rightHip, rightShin],
    ] as const) {
      const thigh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.085, 0.4, 8),
        materials.mechanicalFrame
      );
      thigh.position.y = -0.2;

      const thighGuard = new THREE.Mesh(
        createBeveledPlateGeometry(0.17, 0.32, 0.2, 0.018),
        primaryArmorClone
      );
      thighGuard.position.set(0, -0.18, 0.03);
      hipGrp.add(thigh, thighGuard, shinGrp);

      const shinFrame = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.065, 0.42, 8),
        materials.riftArmorSteel
      );
      shinFrame.position.y = -0.21;

      const shinPlate = new THREE.Mesh(
        createBeveledPlateGeometry(0.16, 0.36, 0.2, 0.018),
        primaryArmorClone
      );
      shinPlate.position.set(0, -0.2, 0.03);

      const foot = new THREE.Mesh(
        createBeveledPlateGeometry(0.18, 0.11, 0.34, 0.015),
        materials.mechanicalFrame
      );
      foot.position.set(0, -0.43, 0.05);

      shinGrp.add(shinFrame, shinPlate, foot);
    }
  }

  torso.add(leftShoulder, rightShoulder);
  pelvis.add(leftHip, rightHip);

  // Subtle physical Guard Barrier Plane in front of forearms when blocking/parrying
  const guardGeo = new THREE.RingGeometry(0.28, 0.52, 6);
  const guardMat = new THREE.MeshBasicMaterial({
    color: characterId === 'volt' ? 0x38bdf8 : 0xa3b18a,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const guardShieldMesh = new THREE.Mesh(guardGeo, guardMat);
  guardShieldMesh.position.set(0, 1.25, 0.58);
  bodyPivot.add(guardShieldMesh);

  // Decoy group (for RIFT's False Remnant ability)
  const decoyGroup = new THREE.Group();
  decoyGroup.visible = false;
  const decoyTorso = new THREE.Mesh(
    createBeveledPlateGeometry(0.48, 0.85, 0.3, 0.02),
    materials.decoyWireframe
  );
  decoyTorso.position.y = 1.15;
  const decoyHead = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.15, 0.28, 8),
    materials.decoyWireframe
  );
  decoyHead.position.y = 1.72;
  const decoyRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.025, 8, 24),
    materials.riftBracerBronze
  );
  decoyRing.rotation.x = Math.PI / 2;
  decoyRing.position.y = 1.05;
  decoyGroup.add(decoyTorso, decoyHead, decoyRing);

  // Configure shadow casting across all child meshes
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh && obj !== shadowMesh && obj !== guardShieldMesh) {
      obj.castShadow = castShadow;
      obj.receiveShadow = castShadow;
    }
  });

  return {
    root,
    bodyPivot,
    pelvis,
    torso,
    head,
    leftShoulder,
    leftForearm,
    rightShoulder,
    rightForearm,
    leftHip,
    leftShin,
    rightHip,
    rightShin,
    coreMesh,
    guardShieldMesh,
    decoyGroup,
    primaryArmorClone,
    coreMaterialClone,
    walkCyclePhase: 0,
  };
}

/**
 * Procedural animation solver: updates all articulated joint rotations and positions
 * smoothly from FighterState without allocating objects in the 60Hz loop.
 */
export function updateFighterRigAnimation(
  rig: ArticulatedFighterRig,
  state: FighterState,
  elapsedTime: number,
  dt: number
): void {
  // 1. World transform
  rig.root.position.set(state.x, state.y, state.z);
  rig.root.rotation.y = state.facingAngle;

  // 2. Hit flash & Overcharge core intensity
  if (state.hitFlashTimer > 0) {
    rig.primaryArmorClone.emissive.setHex(0xffffff);
    rig.primaryArmorClone.emissiveIntensity = 0.75;
  } else if (state.overchargeBuffTimer > 0) {
    rig.primaryArmorClone.emissive.setHex(0xd97706);
    rig.primaryArmorClone.emissiveIntensity = 0.35;
  } else {
    rig.primaryArmorClone.emissive.setHex(0x000000);
    rig.primaryArmorClone.emissiveIntensity = 0;
  }

  rig.coreMaterialClone.emissiveIntensity =
    state.overchargeBuffTimer > 0
      ? 2.8 + Math.sin(elapsedTime * 18) * 0.6
      : 1.5 + Math.sin(elapsedTime * 4) * 0.25;

  // 3. Update Decoy mesh if active
  if (state.decoy.active) {
    rig.decoyGroup.visible = true;
    rig.decoyGroup.position.set(state.decoy.x, 0, state.decoy.z);
    rig.decoyGroup.rotation.y = state.decoy.facingAngle + Math.sin(elapsedTime * 12) * 0.08;
    const decoyRing = rig.decoyGroup.children[2];
    if (decoyRing) {
      decoyRing.rotation.z = elapsedTime * 4;
    }
  } else {
    rig.decoyGroup.visible = false;
  }

  // 4. Guard shield visibility
  const guardMat = rig.guardShieldMesh.material as THREE.MeshBasicMaterial;
  if (state.actionState === 'parry_active') {
    guardMat.opacity = 0.75;
    rig.guardShieldMesh.scale.setScalar(1.25);
    rig.guardShieldMesh.rotation.z = elapsedTime * 6;
  } else if (state.actionState === 'block') {
    guardMat.opacity = 0.38;
    rig.guardShieldMesh.scale.setScalar(1.0);
    rig.guardShieldMesh.rotation.z = elapsedTime * 1.5;
  } else {
    guardMat.opacity = 0;
  }

  // 5. Compute target joint poses based on actionState
  const speed = Math.hypot(state.vx, state.vz);
  if (state.actionState === 'walk' || state.actionState === 'run') {
    rig.walkCyclePhase += speed * dt * 2.7;
  } else {
    rig.walkCyclePhase += dt * 2.2;
  }

  const phase = rig.walkCyclePhase;
  const progress = state.actionDuration > 0 ? Math.min(1, state.actionTimer / state.actionDuration) : 0;

  // Default neutral combat stance
  let pelvisY = 0.92;
  let torsoPitch = 0.08;
  let torsoYaw = -0.22;
  let torsoRoll = 0;
  let headPitch = -0.05;
  let headYaw = 0.2;

  let lShoulderX = -0.35;
  let lShoulderZ = -0.18;
  let lForearmX = -0.85;

  let rShoulderX = -0.25;
  let rShoulderZ = 0.18;
  let rForearmX = -0.95;

  let lHipX = -0.15;
  let lShinX = 0.3;
  let rHipX = 0.18;
  let rShinX = 0.25;

  switch (state.actionState) {
    case 'idle': {
      const breath = Math.sin(elapsedTime * 3.2);
      pelvisY = 0.91 + breath * 0.018;
      torsoPitch = 0.08 + breath * 0.025;
      lShoulderX = -0.38 + breath * 0.04;
      rShoulderX = -0.28 - breath * 0.04;
      break;
    }

    case 'walk':
    case 'run': {
      const amp = state.actionState === 'run' ? 0.68 : 0.42;
      const s = Math.sin(phase);
      const c = Math.cos(phase);
      pelvisY = 0.90 + Math.abs(s) * 0.045;
      torsoPitch = state.actionState === 'run' ? 0.26 : 0.14;
      torsoYaw = -s * 0.18;

      lHipX = s * amp;
      lShinX = Math.max(0.1, -c * amp * 0.85 + 0.35);
      rHipX = -s * amp;
      rShinX = Math.max(0.1, c * amp * 0.85 + 0.35);

      lShoulderX = -s * amp * 0.7 - 0.25;
      rShoulderX = s * amp * 0.7 - 0.25;
      break;
    }

    case 'dodge': {
      pelvisY = 0.68;
      torsoPitch = 0.58;
      lShoulderX = 0.45;
      rShoulderX = 0.45;
      lHipX = -0.55;
      lShinX = 0.95;
      rHipX = 0.35;
      rShinX = 0.65;
      break;
    }

    case 'block': {
      pelvisY = 0.84;
      torsoPitch = 0.16;
      torsoYaw = -0.35;
      lShoulderX = -1.15;
      lShoulderZ = 0.35;
      lForearmX = -1.35;
      rShoulderX = -1.05;
      rShoulderZ = -0.25;
      rForearmX = -1.25;
      lHipX = -0.32;
      lShinX = 0.55;
      rHipX = 0.32;
      rShinX = 0.45;
      break;
    }

    case 'parry_active': {
      pelvisY = 0.88;
      torsoPitch = -0.08;
      torsoYaw = 0.45;
      lShoulderX = -1.35;
      lShoulderZ = -0.45;
      lForearmX = -0.4;
      rShoulderX = -0.8;
      break;
    }

    case 'light_startup': {
      // Windup right arm back
      torsoYaw = -0.55;
      rShoulderX = 0.45;
      rShoulderZ = 0.35;
      rForearmX = -1.3;
      break;
    }

    case 'light_active': {
      // Snap right jab / slash forward!
      pelvisY = 0.87;
      torsoPitch = 0.22;
      torsoYaw = 0.62;
      headYaw = -0.45;
      rShoulderX = -1.48;
      rShoulderZ = -0.12;
      rForearmX = -0.15;
      lShoulderX = 0.35;
      lHipX = -0.42;
      lShinX = 0.6;
      break;
    }

    case 'light_recovery': {
      torsoYaw = 0.25 * (1 - progress);
      rShoulderX = -0.9 * (1 - progress) - 0.25;
      break;
    }

    case 'heavy_startup': {
      // Deep windup crouch & shoulder coil
      pelvisY = 0.78;
      torsoPitch = -0.15;
      torsoYaw = -0.85;
      rShoulderX = 0.75;
      rShoulderZ = 0.55;
      rForearmX = -1.1;
      lShoulderX = -0.75;
      break;
    }

    case 'heavy_active': {
      // Crushing full-body haymaker / spiral thrust
      pelvisY = 0.84;
      torsoPitch = 0.38;
      torsoYaw = 0.88;
      headYaw = -0.65;
      rShoulderX = -1.62;
      rShoulderZ = -0.28;
      rForearmX = -0.08;
      lShoulderX = 0.65;
      lHipX = -0.58;
      lShinX = 0.75;
      rHipX = 0.48;
      break;
    }

    case 'heavy_recovery': {
      pelvisY = 0.85;
      torsoPitch = 0.28 * (1 - progress);
      torsoYaw = 0.5 * (1 - progress);
      rShoulderX = -1.1 * (1 - progress) - 0.25;
      break;
    }

    case 'ability_startup': {
      // Both arms raised high in overcharge / feint telegraph
      pelvisY = 0.98;
      torsoPitch = -0.28;
      lShoulderX = -2.1;
      lShoulderZ = -0.35;
      rShoulderX = -2.1;
      rShoulderZ = 0.35;
      lForearmX = -0.4;
      rForearmX = -0.4;
      break;
    }

    case 'ability_active': {
      // Ground-shattering tectonic slam / low lateral blitz slash
      pelvisY = 0.66;
      torsoPitch = 0.65;
      lShoulderX = -1.45;
      rShoulderX = -1.45;
      lForearmX = -0.15;
      rForearmX = -0.15;
      lHipX = -0.7;
      lShinX = 1.1;
      rHipX = 0.5;
      rShinX = 0.85;
      break;
    }

    case 'ability_recovery': {
      pelvisY = 0.76 + 0.16 * progress;
      torsoPitch = 0.45 * (1 - progress);
      break;
    }

    case 'hit_stun': {
      pelvisY = 0.86;
      torsoPitch = -0.38;
      torsoRoll = 0.18;
      headPitch = -0.35;
      lShoulderX = 0.35;
      rShoulderX = 0.42;
      break;
    }

    case 'stagger': {
      const sway = Math.sin(elapsedTime * 10) * 0.15;
      pelvisY = 0.80;
      torsoPitch = -0.45;
      torsoRoll = sway;
      lShoulderX = 0.55;
      lShoulderZ = -0.45;
      rShoulderX = 0.55;
      rShoulderZ = 0.45;
      break;
    }

    case 'knockdown':
    case 'defeat': {
      pelvisY = 0.38;
      torsoPitch = -1.15;
      lShoulderX = 0.6;
      rShoulderX = 0.6;
      lHipX = -0.8;
      rHipX = -0.6;
      break;
    }

    case 'victory': {
      pelvisY = 0.95;
      torsoPitch = -0.15;
      rShoulderX = -2.45;
      rShoulderZ = 0.25;
      rForearmX = -0.35;
      lShoulderX = -0.2;
      break;
    }

    default:
      break;
  }

  // Smooth exponential damping for responsive yet weighty articulation
  const k = Math.min(1, dt * 22);
  rig.pelvis.position.y = THREE.MathUtils.lerp(rig.pelvis.position.y, pelvisY, k);
  rig.torso.rotation.x = THREE.MathUtils.lerp(rig.torso.rotation.x, torsoPitch, k);
  rig.torso.rotation.y = THREE.MathUtils.lerp(rig.torso.rotation.y, torsoYaw, k);
  rig.torso.rotation.z = THREE.MathUtils.lerp(rig.torso.rotation.z, torsoRoll, k);

  rig.head.rotation.x = THREE.MathUtils.lerp(rig.head.rotation.x, headPitch, k);
  rig.head.rotation.y = THREE.MathUtils.lerp(rig.head.rotation.y, headYaw, k);

  rig.leftShoulder.rotation.x = THREE.MathUtils.lerp(rig.leftShoulder.rotation.x, lShoulderX, k);
  rig.leftShoulder.rotation.z = THREE.MathUtils.lerp(rig.leftShoulder.rotation.z, lShoulderZ, k);
  rig.leftForearm.rotation.x = THREE.MathUtils.lerp(rig.leftForearm.rotation.x, lForearmX, k);

  rig.rightShoulder.rotation.x = THREE.MathUtils.lerp(rig.rightShoulder.rotation.x, rShoulderX, k);
  rig.rightShoulder.rotation.z = THREE.MathUtils.lerp(rig.rightShoulder.rotation.z, rShoulderZ, k);
  rig.rightForearm.rotation.x = THREE.MathUtils.lerp(rig.rightForearm.rotation.x, rForearmX, k);

  rig.leftHip.rotation.x = THREE.MathUtils.lerp(rig.leftHip.rotation.x, lHipX, k);
  rig.leftShin.rotation.x = THREE.MathUtils.lerp(rig.leftShin.rotation.x, lShinX, k);
  rig.rightHip.rotation.x = THREE.MathUtils.lerp(rig.rightHip.rotation.x, rHipX, k);
  rig.rightShin.rotation.x = THREE.MathUtils.lerp(rig.rightShin.rotation.x, rShinX, k);
}
