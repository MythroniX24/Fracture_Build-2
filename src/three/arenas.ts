import * as THREE from 'three';
import { ARENA_REGISTRY, ArenaId } from '../game/config.ts';
import { MaterialLibrary } from './materials.ts';

export interface ArenaSceneRig {
  group: THREE.Group;
  colliderMeshes: THREE.Object3D[];
  update: (elapsedTime: number, dt: number) => void;
  dispose: () => void;
}

/**
 * Generates an extruded mechanical gear with teeth.
 */
function createGearGeometry(
  innerRadius: number,
  outerRadius: number,
  teethCount: number,
  thickness: number
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teethCount;

  for (let i = 0; i < teethCount; i++) {
    const a0 = i * step;
    const a1 = a0 + step * 0.25;
    const a2 = a0 + step * 0.55;
    const a3 = a0 + step * 0.8;

    const x0 = Math.cos(a0) * innerRadius;
    const y0 = Math.sin(a0) * innerRadius;
    const x1 = Math.cos(a1) * outerRadius;
    const y1 = Math.sin(a1) * outerRadius;
    const x2 = Math.cos(a2) * outerRadius;
    const y2 = Math.sin(a2) * outerRadius;
    const x3 = Math.cos(a3) * innerRadius;
    const y3 = Math.sin(a3) * innerRadius;

    if (i === 0) shape.moveTo(x0, y0);
    else shape.lineTo(x0, y0);
    shape.lineTo(x1, y1);
    shape.lineTo(x2, y2);
    shape.lineTo(x3, y3);
  }
  shape.closePath();

  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius * 0.42, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 1,
  });
  geo.center();
  return geo;
}

export function buildArenaScene(
  arenaId: ArenaId,
  materials: MaterialLibrary,
  castShadow: boolean
): ArenaSceneRig {
  const spec = ARENA_REGISTRY[arenaId];
  const group = new THREE.Group();
  group.name = `arena_${arenaId}`;
  const colliderMeshes: THREE.Object3D[] = [];
  const animatedGears: { mesh: THREE.Object3D; speed: number; axis: 'x' | 'y' | 'z' }[] = [];
  const geometriesToDispose: THREE.BufferGeometry[] = [];

  if (arenaId === 'iron_fortress') {
    // =========================================================================
    // ARENA A: THE IRON FORTRESS — Abandoned Industrial Crucible & Gear Chasm
    // =========================================================================
    // 1. Main Playable Octagonal Platform
    const mainPlatformGeo = new THREE.CylinderGeometry(
      spec.playableRadius,
      spec.playableRadius * 1.08,
      1.6,
      16
    );
    geometriesToDispose.push(mainPlatformGeo);
    const mainPlatform = new THREE.Mesh(mainPlatformGeo, materials.fortressFloor);
    mainPlatform.position.y = -0.8;
    mainPlatform.receiveShadow = castShadow;
    group.add(mainPlatform);

    // 2. Danger Ring / Inner Crucible Rim (offset on Y to prevent Z-fighting)
    const rimRingGeo = new THREE.RingGeometry(spec.dangerRingRadius - 0.18, spec.dangerRingRadius, 32);
    rimRingGeo.rotateX(-Math.PI / 2);
    geometriesToDispose.push(rimRingGeo);
    const rimRing = new THREE.Mesh(rimRingGeo, materials.voltArmorPrimary);
    rimRing.position.y = 0.012;
    group.add(rimRing);

    const centerInsigniaGeo = new THREE.RingGeometry(1.8, 2.05, 8);
    centerInsigniaGeo.rotateX(-Math.PI / 2);
    geometriesToDispose.push(centerInsigniaGeo);
    const centerInsignia = new THREE.Mesh(centerInsigniaGeo, materials.weatheredSteel);
    centerInsignia.position.y = 0.01;
    group.add(centerInsignia);

    // 3. Lower Mechanical Pit / Molten Furnace Glow Beneath Platform
    const pitFloorGeo = new THREE.CircleGeometry(42, 32);
    pitFloorGeo.rotateX(-Math.PI / 2);
    geometriesToDispose.push(pitFloorGeo);
    const pitFloor = new THREE.Mesh(pitFloorGeo, materials.forgeEmber);
    pitFloor.position.y = -11.5;
    group.add(pitFloor);

    // 4. Four Corner Structural Blast Pylons (match spec.obstacles)
    const pylonBaseGeo = new THREE.CylinderGeometry(0.85, 0.98, 4.6, 8);
    const pylonCapGeo = new THREE.BoxGeometry(1.9, 0.45, 1.9);
    const pylonRibGeo = new THREE.BoxGeometry(1.8, 3.8, 0.35);
    geometriesToDispose.push(pylonBaseGeo, pylonCapGeo, pylonRibGeo);

    for (const obs of spec.obstacles) {
      const pylonGrp = new THREE.Group();
      pylonGrp.position.set(obs.x, 0, obs.z);

      const col = new THREE.Mesh(pylonBaseGeo, materials.oxidizedIron);
      col.position.y = 2.3;
      col.castShadow = castShadow;
      col.receiveShadow = castShadow;

      const cap = new THREE.Mesh(pylonCapGeo, materials.weatheredSteel);
      cap.position.y = 4.6;

      const rib = new THREE.Mesh(pylonRibGeo, materials.mechanicalFrame);
      rib.position.y = 2.1;

      const lantern = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.9, 0.45),
        materials.forgeEmber
      );
      lantern.position.y = 3.6;

      pylonGrp.add(col, cap, rib, lantern);
      group.add(pylonGrp);
      colliderMeshes.push(col);
    }

    // 5. Monumental Rotating Industrial Gears in the Surrounding Pit & Midground
    const largeGearGeo = createGearGeometry(4.2, 5.4, 16, 0.9);
    const medGearGeo = createGearGeometry(2.6, 3.3, 12, 0.7);
    geometriesToDispose.push(largeGearGeo, medGearGeo);

    const gearConfigs = [
      { x: 0, y: -1.5, z: -18.5, rx: 0, ry: 0, scale: 1.45, speed: 0.18, axis: 'z' as const, geo: largeGearGeo },
      { x: -11.5, y: 1.2, z: -17.0, rx: 0, ry: 0.3, scale: 1.1, speed: -0.27, axis: 'z' as const, geo: medGearGeo },
      { x: 11.5, y: 1.2, z: -17.0, rx: 0, ry: -0.3, scale: 1.1, speed: -0.27, axis: 'z' as const, geo: medGearGeo },
      { x: -17.5, y: -2.2, z: 0, rx: Math.PI / 2, ry: 0, scale: 1.3, speed: 0.15, axis: 'y' as const, geo: largeGearGeo },
      { x: 17.5, y: -2.2, z: 0, rx: Math.PI / 2, ry: 0, scale: 1.3, speed: -0.15, axis: 'y' as const, geo: largeGearGeo },
    ];

    for (const cfg of gearConfigs) {
      const gearMesh = new THREE.Mesh(cfg.geo, materials.weatheredSteel);
      gearMesh.position.set(cfg.x, cfg.y, cfg.z);
      gearMesh.rotation.set(cfg.rx, cfg.ry, 0);
      gearMesh.scale.setScalar(cfg.scale);
      group.add(gearMesh);
      animatedGears.push({ mesh: gearMesh, speed: cfg.speed, axis: cfg.axis });
    }

    // 6. Suspended Elevated Walkways & Heavy Support Arches in Background
    const walkwayGeo = new THREE.BoxGeometry(28, 0.6, 2.4);
    const girderGeo = new THREE.CylinderGeometry(0.6, 0.8, 22, 6);
    geometriesToDispose.push(walkwayGeo, girderGeo);

    const backWalkway = new THREE.Mesh(walkwayGeo, materials.oxidizedIron);
    backWalkway.position.set(0, 6.8, -15.5);
    group.add(backWalkway);

    for (const gx of [-12, -5, 5, 12]) {
      const girder = new THREE.Mesh(girderGeo, materials.mechanicalFrame);
      girder.position.set(gx, 1.0, -16.5);
      group.add(girder);
    }

    // 7. Instanced Perimeter Bollards & Hanging Chains (efficient InstancedMesh)
    const bollardCount = 24;
    const bollardGeo = new THREE.BoxGeometry(0.32, 0.55, 0.22);
    geometriesToDispose.push(bollardGeo);
    const bollardInstanced = new THREE.InstancedMesh(
      bollardGeo,
      materials.oxidizedIron,
      bollardCount
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < bollardCount; i++) {
      const angle = (i / bollardCount) * Math.PI * 2;
      const r = spec.playableRadius - 0.22;
      dummy.position.set(Math.cos(angle) * r, 0.27, Math.sin(angle) * r);
      dummy.rotation.set(0, -angle + Math.PI / 2, 0);
      dummy.updateMatrix();
      bollardInstanced.setMatrixAt(i, dummy.matrix);
    }
    bollardInstanced.instanceMatrix.needsUpdate = true;
    bollardInstanced.computeBoundingSphere();
    group.add(bollardInstanced);
  } else {
    // =========================================================================
    // ARENA B: THE OVERGROWN COLOSSUS — Reclaimed Mechanical Jungle Sanctuary
    // =========================================================================
    // 1. Sunken Ancient Sanctuary Stone Deck
    const sanctuaryGeo = new THREE.CylinderGeometry(
      spec.playableRadius,
      spec.playableRadius * 1.15,
      2.2,
      24
    );
    geometriesToDispose.push(sanctuaryGeo);
    const sanctuaryFloor = new THREE.Mesh(sanctuaryGeo, materials.colossusStoneFloor);
    sanctuaryFloor.position.y = -1.1;
    sanctuaryFloor.receiveShadow = castShadow;
    group.add(sanctuaryFloor);

    // Outer Mossy Rim Ring
    const mossRimGeo = new THREE.RingGeometry(spec.dangerRingRadius - 0.35, spec.playableRadius - 0.1, 32);
    mossRimGeo.rotateX(-Math.PI / 2);
    geometriesToDispose.push(mossRimGeo);
    const mossRim = new THREE.Mesh(mossRimGeo, materials.mossFoliage);
    mossRim.position.y = 0.014;
    group.add(mossRim);

    // Surrounded by sunken verdant basin floor extending to horizon
    const basinGeo = new THREE.CircleGeometry(65, 32);
    basinGeo.rotateX(-Math.PI / 2);
    geometriesToDispose.push(basinGeo);
    const basinMesh = new THREE.Mesh(basinGeo, materials.mossFoliage);
    basinMesh.position.y = -4.5;
    group.add(basinMesh);

    // 2. Two Ancient Relic Monoliths on East & West flanks (matching spec.obstacles)
    const relicPillarGeo = new THREE.CylinderGeometry(0.75, 0.95, 3.8, 7);
    const relicMossCapGeo = new THREE.DodecahedronGeometry(0.95, 1);
    geometriesToDispose.push(relicPillarGeo, relicMossCapGeo);

    for (const obs of spec.obstacles) {
      const relicGrp = new THREE.Group();
      relicGrp.position.set(obs.x, 0, obs.z);

      const pillar = new THREE.Mesh(relicPillarGeo, materials.colossusRelicBone);
      pillar.position.y = 1.9;
      pillar.castShadow = castShadow;
      pillar.receiveShadow = castShadow;

      const mossCap = new THREE.Mesh(relicMossCapGeo, materials.mossFoliage);
      mossCap.position.set(0, 3.6, 0);
      mossCap.scale.set(1.1, 0.55, 1.1);

      relicGrp.add(pillar, mossCap);
      group.add(relicGrp);
      colliderMeshes.push(pillar);
    }

    // 3. Landmark Vista: Giant Fallen Colossus Head & Ribcage in the North Backdrop
    const titanHeadGroup = new THREE.Group();
    titanHeadGroup.position.set(0, 2.2, -17.5);
    titanHeadGroup.rotation.set(0.22, 0.15, -0.18);

    const skullDomeGeo = new THREE.CylinderGeometry(3.8, 4.4, 6.5, 8);
    const faceplateGeo = new THREE.BoxGeometry(5.6, 5.2, 3.5);
    const eyeSocketGeo = new THREE.CylinderGeometry(0.9, 0.9, 3.8, 12);
    const crestHornGeo = new THREE.ConeGeometry(1.2, 5.5, 6);
    geometriesToDispose.push(skullDomeGeo, faceplateGeo, eyeSocketGeo, crestHornGeo);

    const skullDome = new THREE.Mesh(skullDomeGeo, materials.colossusRelicBone);
    const faceplate = new THREE.Mesh(faceplateGeo, materials.riftArmorBone);
    faceplate.position.set(0, -0.4, 1.8);

    const leftEye = new THREE.Mesh(eyeSocketGeo, materials.riftBracerBronze);
    leftEye.rotation.x = Math.PI / 2;
    leftEye.position.set(-1.4, 0.4, 1.9);

    const rightEye = new THREE.Mesh(eyeSocketGeo, materials.mechanicalFrame);
    rightEye.rotation.x = Math.PI / 2;
    rightEye.position.set(1.4, 0.4, 1.9);

    const leftHorn = new THREE.Mesh(crestHornGeo, materials.colossusRelicBone);
    leftHorn.position.set(-3.2, 3.8, 0);
    leftHorn.rotation.z = 0.45;

    const rightHorn = new THREE.Mesh(crestHornGeo, materials.colossusRelicBone);
    rightHorn.position.set(3.2, 3.8, 0);
    rightHorn.rotation.z = -0.45;

    const headMoss = new THREE.Mesh(
      new THREE.DodecahedronGeometry(3.6, 1),
      materials.mossFoliage
    );
    headMoss.position.set(0.6, 3.1, 0.4);
    headMoss.scale.set(1.2, 0.45, 1.1);
    geometriesToDispose.push(headMoss.geometry);

    titanHeadGroup.add(skullDome, faceplate, leftEye, rightEye, leftHorn, rightHorn, headMoss);
    group.add(titanHeadGroup);

    // 4. Giant Fallen Mechanical Forearm & Outstretched Fingers Flanking the Arena
    const armBeamGeo = new THREE.CylinderGeometry(1.8, 2.2, 14, 8);
    geometriesToDispose.push(armBeamGeo);
    for (const side of [-1, 1]) {
      const fallenArm = new THREE.Mesh(armBeamGeo, materials.colossusRelicBone);
      fallenArm.position.set(side * 15.5, 0.8, -6.5);
      fallenArm.rotation.set(0.35, -side * 0.4, side * 1.15);
      group.add(fallenArm);
    }

    // 5. Curving Ancient Roots & Vines Framing the Sky (TubeGeometry)
    const rootCurves = [
      [
        new THREE.Vector3(-13, -2, -10),
        new THREE.Vector3(-9, 5.5, -13),
        new THREE.Vector3(-2, 7.2, -16),
        new THREE.Vector3(4, 2.0, -17),
      ],
      [
        new THREE.Vector3(13, -2, -9),
        new THREE.Vector3(8.5, 4.8, -12),
        new THREE.Vector3(2.5, 6.2, -15),
        new THREE.Vector3(-3, 1.5, -17),
      ],
      [
        new THREE.Vector3(-14, -3, 6),
        new THREE.Vector3(-12.5, 2.8, 2),
        new THREE.Vector3(-13, 0.5, -4),
      ],
    ];

    for (const pts of rootCurves) {
      const curve = new THREE.CatmullRomCurve3(pts);
      const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.55, 7, false);
      geometriesToDispose.push(tubeGeo);
      const rootMesh = new THREE.Mesh(tubeGeo, materials.rootWood);
      group.add(rootMesh);
    }

    // 6. Instanced Mossy Boulders & Ruin Stones around the Perimeter (with ±15% scale & tint variation)
    const boulderCount = 28;
    const boulderGeo = new THREE.DodecahedronGeometry(0.9, 1);
    geometriesToDispose.push(boulderGeo);
    const boulderInstanced = new THREE.InstancedMesh(
      boulderGeo,
      materials.mossFoliage,
      boulderCount
    );
    boulderInstanced.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(boulderCount * 3),
      3
    );

    const dummy = new THREE.Object3D();
    const colorHelper = new THREE.Color();
    for (let i = 0; i < boulderCount; i++) {
      const angle = (i / boulderCount) * Math.PI * 2;
      const dist = spec.playableRadius + 1.2 + (i % 3) * 1.8;
      const scale = 0.85 + ((i * 19) % 30) / 100;
      dummy.position.set(
        Math.cos(angle) * dist,
        -0.4 + (i % 2) * 0.25,
        Math.sin(angle) * dist
      );
      dummy.rotation.set(i * 0.7, i * 1.3, 0);
      dummy.scale.set(scale * 1.3, scale * 0.75, scale);
      dummy.updateMatrix();
      boulderInstanced.setMatrixAt(i, dummy.matrix);

      colorHelper.setHSL(0.36 + (i % 5) * 0.015, 0.24, 0.25 + (i % 4) * 0.04);
      boulderInstanced.setColorAt(i, colorHelper);
    }
    boulderInstanced.instanceMatrix.needsUpdate = true;
    boulderInstanced.instanceColor.needsUpdate = true;
    boulderInstanced.computeBoundingSphere();
    group.add(boulderInstanced);
  }

  return {
    group,
    colliderMeshes,
    update: (_elapsedTime: number, dt: number) => {
      for (const item of animatedGears) {
        item.mesh.rotation[item.axis] += item.speed * dt;
      }
    },
    dispose: () => {
      geometriesToDispose.forEach((g) => g.dispose());
    },
  };
}
