import * as THREE from 'three';
import { ARENA_REGISTRY, ArenaCollider, ArenaId } from '../game/config.ts';
import type { SimulationState } from '../game/rules.ts';
import { MaterialLibrary } from './materials.ts';

export interface ArenaSceneRig {
  group: THREE.Group;
  colliderMeshes: THREE.Object3D[];
  colliders: ArenaCollider[];
  rulesOverlayGroup: THREE.Group;
  fogColor: THREE.Color;
  fogDensity: number;
  update: (elapsedTime: number, dt: number, sim?: SimulationState) => void;
  syncBreakables: (sim: SimulationState) => void;
  dispose: () => void;
  damageTileAt?: (worldX: number, worldZ: number, damage: number) => void;
}

/**
 * Deterministic hash matching fracture-foundry-arena-v4.html:
 * const h3=(x,y,z)=>{const s=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return s-Math.floor(s)};
 */
export function foundryHash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Computes initial tile state for column c (0..11) and row r (0..7) exactly as in fracture-foundry-arena-v4.html:
 * - 'D': Under central dais (c in 4..7, r in 3..4)
 * - 0: Intact steel tile (40 HP)
 * - 1: Cracked magma tile (20 HP)
 * - 2: Missing tile / open lava hole (0 HP)
 */
export function getInitialFoundryTileState(c: number, r: number): 'D' | 0 | 1 | 2 {
  if (c >= 4 && c <= 7 && r >= 3 && r <= 4) return 'D';
  const gridC = 12;
  const gridR = 8;
  const fc = Math.min(c, gridC - 1 - c);
  const fr = Math.min(r, gridR - 1 - r);
  const v = foundryHash3(fc * 3.1, fr * 7.7, 5.5);
  const prot = c >= 3 && c <= 8 && r >= 2 && r <= 5;
  return prot ? 0 : v > 0.88 ? 2 : v > 0.7 ? 1 : 0;
}

export function buildArenaScene(
  arenaId: ArenaId,
  materials: MaterialLibrary,
  castShadow = true
): ArenaSceneRig {
  const group = new THREE.Group();
  group.name = `arena_${arenaId}`;
  const colliderMeshes: THREE.Object3D[] = [];
  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const extraMaterialsToDispose: THREE.Material[] = [];
  const extraTexturesToDispose: THREE.Texture[] = [];
  const animators: ((elapsedTime: number, dt: number, sim?: SimulationState) => void)[] = [];

  let sd = 11;
  const rnd = () => {
    sd = (sd * 16807) % 2147483647;
    return sd / 2147483647;
  };

  const mk = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material | THREE.Material[],
    parent: THREE.Object3D,
    x = 0,
    y = 0,
    z = 0,
    sh = castShadow
  ) => {
    geometriesToDispose.push(geo);
    const o = new THREE.Mesh(geo, mat);
    o.position.set(x, y, z);
    o.castShadow = sh;
    o.receiveShadow = sh;
    parent.add(o);
    return o;
  };

  const bx = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  const PI = Math.PI;

  // ===========================================================================
  // EXACT FRACTURE FOUNDRY ARENA v4 (from fracture-foundry-arena-v4.html)
  // ===========================================================================
  const gridCols = 12;
  const gridRows = 8;
  const TS = 5;
  const W = gridCols * TS; // 60m
  const H = gridRows * TS; // 40m
  const E = 4; // 4m perimeter ledge
  const pH = 6;
  const dais = { w: 20, d: 10, h: 1.2 };
  const killY = -3;
  const lavaY = -5.5;

  // 1. Custom Moonlit Night Sky Shader Dome (lines 5116-5119)
  const moonDir = new THREE.Vector3(0.3, 0.8, 0.35).normalize();
  const skyGeo = new THREE.SphereGeometry(500, 32, 16);
  geometriesToDispose.push(skyGeo);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      moon: { value: moonDir },
      lin: { value: 0 },
    },
    vertexShader:
      'varying vec3 p;void main(){p=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:
      'varying vec3 p;uniform vec3 moon;uniform float lin;void main(){float h=clamp(p.y,0.,1.);vec3 c=mix(vec3(.5,.18,.09),vec3(.03,.035,.09),pow(h,.45));float m=max(dot(p,moon),0.);c+=vec3(.55,.65,.9)*(pow(m,400.)*1.6+pow(m,12.)*.12);float s=step(.9985,fract(sin(dot(floor(p*230.),vec3(12.9,78.2,37.7)))*43758.5));c+=s*vec3(.8)*smoothstep(.15,.5,h);gl_FragColor=vec4(lin>.5?pow(c,vec3(2.2)):c,1.);}',
  });
  extraMaterialsToDispose.push(skyMat);
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  group.add(skyMesh);

  // 2. Main Foundry Lighting (Optimized for 60FPS Mobile GPUs with identical visual richness)
  const hemiLight = new THREE.HemisphereLight(0xffd9b0, 0x4a2e1e, 1.0);
  group.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffe4b8, 2.65);
  sunLight.position.set(18, 28, 14);
  if (castShadow) {
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 4;
    sunLight.shadow.camera.far = 75;
    sunLight.shadow.camera.left = -28;
    sunLight.shadow.camera.right = 28;
    sunLight.shadow.camera.top = 24;
    sunLight.shadow.camera.bottom = -24;
    sunLight.shadow.bias = -0.0006;
  }
  group.add(sunLight);

  // Central Dais Overhead Forge Light + Molten Pit Under-Glow (2 high-impact PointLights instead of 5)
  const daisKeyLight = new THREE.PointLight(0xffe0b2, 2.6, 44, 1.4);
  daisKeyLight.position.set(0, 10.5, 0);
  group.add(daisKeyLight);

  const lavaLight = new THREE.PointLight(0xff5a1a, 2.2, 52, 1.8);
  lavaLight.position.set(0, -3.2, 0);
  group.add(lavaLight);
  const lavaLights = [lavaLight];

  // 3. Destructible 12x8 Floor Tile Grid (Shared BufferGeometry, receiveShadow only)
  const tileMeshMap = new Map<
    string,
    { mesh: THREE.Mesh; baseX: number; baseZ: number; lastState: number }
  >();
  const tileRows: string[] = [];
  const sharedTileGeo = bx(TS - 0.12, 1, TS - 0.12);
  geometriesToDispose.push(sharedTileGeo);

  for (let r = 0; r < gridRows; r++) {
    let row = '';
    for (let c = 0; c < gridCols; c++) {
      const initSt = getInitialFoundryTileState(c, r);
      if (initSt === 'D') {
        row += 'D';
        continue;
      }
      row += String(initSt);
      const x = (c - gridCols / 2 + 0.5) * TS;
      const z = (r - gridRows / 2 + 0.5) * TS;
      if (initSt === 2) continue;

      const tMesh = new THREE.Mesh(
        sharedTileGeo,
        initSt === 1 ? materials.foundryCrack : materials.foundryFloor
      );
      tMesh.position.set(x, -0.5 - (initSt === 1 ? 0.08 : 0), z);
      tMesh.castShadow = false;
      tMesh.receiveShadow = castShadow;
      group.add(tMesh);

      if (initSt === 1) {
        tMesh.rotation.set(
          0.012 * (foundryHash3(c, r, 1) - 0.5) * 4,
          0,
          0.012 * (foundryHash3(c, r, 2) - 0.5) * 4
        );
      }
      tileMeshMap.set(`${c}_${r}`, {
        mesh: tMesh,
        baseX: x,
        baseZ: z,
        lastState: initSt,
      });
    }
    tileRows.push(row);
  }
  const st = (c: number, r: number) => tileRows[r]?.[c] ?? '2';

  // 4. Perimeter Checkerplate Ledges & Hazard Warning Borders (lines 5144-5150)
  mk(bx(W + 2 * E, pH, E), materials.foundryLedge, group, 0, -pH / 2, H / 2 + E / 2);
  mk(bx(W + 2 * E, pH, E), materials.foundryLedge, group, 0, -pH / 2, -H / 2 - E / 2);
  mk(bx(E, pH, H), materials.foundryLedge, group, W / 2 + E / 2, -pH / 2, 0);
  mk(bx(E, pH, H), materials.foundryLedge, group, -W / 2 - E / 2, -pH / 2, 0);

  [
    [W + 0.4, 0.7, 0, H / 2 - 0.35],
    [W + 0.4, 0.7, 0, -H / 2 + 0.35],
    [0.7, H + 0.4, W / 2 - 0.35, 0],
    [0.7, H + 0.4, -W / 2 + 0.35, 0],
  ].forEach((p) => {
    mk(bx(p[0], 0.05, p[1]), materials.foundryHazard, group, p[2], 0.03, p[3], false);
  });

  // 5. Perimeter Brick Walls, Buttresses, Corner Beacons & Overhead Gantries (lines 5151-5159)
  const wallNorth = mk(bx(W + 2 * E + 4, 14, 2), materials.foundryBrick, group, 0, 7, H / 2 + E + 1);
  const wallSouth = mk(bx(W + 2 * E + 4, 14, 2), materials.foundryBrick, group, 0, 7, -H / 2 - E - 1);
  const wallEast = mk(bx(2, 14, H + 2 * E), materials.foundryBrick, group, W / 2 + E + 1, 7, 0);
  const wallWest = mk(bx(2, 14, H + 2 * E), materials.foundryBrick, group, -W / 2 - E - 1, 7, 0);
  colliderMeshes.push(wallNorth, wallSouth, wallEast, wallWest);

  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff3a2a });
  extraMaterialsToDispose.push(lampMat, beaconMat);

  for (const sx of [-1, 1]) {
    for (let k = -30; k <= 30; k += 12) {
      mk(bx(1.8, 14, 1.6), materials.foundryDark, group, k, 7, sx * (H / 2 + E - 0.2), false);
      mk(bx(0.3, 10, 0.1), materials.foundryGlowOrange, group, k, 7, sx * (H / 2 + E - 1.05), false);
    }
    for (let k = -12; k <= 12; k += 12) {
      mk(bx(1.6, 14, 1.8), materials.foundryDark, group, sx * (W / 2 + E - 0.2), 7, k, false);
      mk(bx(0.1, 10, 0.3), materials.foundryGlowCyan, group, sx * (W / 2 + E - 1.05), 7, k, false);
    }
    for (const sz of [-1, 1]) {
      mk(
        bx(5, 18, 5),
        materials.foundryWallTower,
        group,
        sx * (W / 2 + E + 1),
        9,
        sz * (H / 2 + E + 1),
        false
      );
      mk(
        new THREE.SphereGeometry(0.9, 12, 8),
        beaconMat,
        group,
        sx * (W / 2 + E + 1),
        18.7,
        sz * (H / 2 + E + 1),
        false
      );
    }
    mk(bx(W + 2 * E, 0.7, 0.9), materials.foundryDark, group, 0, 12, sx * 9, false);
    for (let k = -27; k <= 27; k += 18) {
      mk(bx(1.6, 0.3, 1.6), lampMat, group, k, 11.6, sx * 9, false);
    }
  }

  // 6. Central Safe Dais with FRACTURE Emblem Top & Stepped Ramps (lines 5160-5166)
  const dm = materials.foundryDais;
  const top = materials.foundryDaisTop;
  const daisMesh = mk(
    bx(dais.w, 7.2, dais.d),
    [dm, dm, top, dm, dm, dm],
    group,
    0,
    -2.4,
    0
  );
  colliderMeshes.push(daisMesh);

  [
    [dais.w + 0.3, 0.12, 0, dais.d / 2 + 0.1],
    [dais.w + 0.3, 0.12, 0, -dais.d / 2 - 0.1],
    [0.12, dais.d + 0.3, dais.w / 2 + 0.1, 0],
    [0.12, dais.d + 0.3, -dais.w / 2 - 0.1, 0],
  ].forEach((p) =>
    mk(bx(p[0], 0.08, p[1]), materials.foundryGlowOrange, group, p[2], dais.h + 0.03, p[3], false)
  );

  for (const sx of [-1, 1]) {
    const stepUpper = mk(bx(0.9, 0.8, 6), dm, group, sx * 10.45, 0.4, 0);
    const stepLower = mk(bx(0.9, 0.4, 6), dm, group, sx * 11.35, 0.2, 0);
    colliderMeshes.push(stepUpper, stepLower);
  }

  const spawnColors = [0xc8553d, 0x3f7fb5, 0xd9a93a, 0x5a9a5a];
  [
    [-6, -2.8],
    [6, -2.8],
    [6, 2.8],
    [-6, 2.8],
  ].forEach((p, i) => {
    const ringGeo = new THREE.RingGeometry(0.9, 1.15, 24);
    geometriesToDispose.push(ringGeo);
    const ringMat = new THREE.MeshBasicMaterial({
      color: spawnColors[i],
      side: THREE.DoubleSide,
    });
    extraMaterialsToDispose.push(ringMat);
    const m = new THREE.Mesh(ringGeo, ringMat);
    m.rotation.x = -PI / 2;
    m.position.set(p[0], dais.h + 0.07, p[1]);
    group.add(m);
  });

  // 7. Destructible Crates, Stacked Crates, Barricades & Barrels (lines 5168-5172, 5186-5187)
  const destructibleMeshMap = new Map<
    string,
    { mesh: THREE.Object3D; stackMesh?: THREE.Object3D; baseY: number; broken: boolean }
  >();

  // Flying shatter fragments when crates/barrels break
  const debrisList: {
    mesh: THREE.Mesh;
    vx: number;
    vy: number;
    vz: number;
    rx: number;
    ry: number;
    life: number;
    maxLife: number;
  }[] = [];

  const spawnDebris = (wx: number, wy: number, wz: number, isBarrel: boolean) => {
    const count = 8;
    const mat = isBarrel ? materials.foundryBarrelRed : materials.foundryCrate;
    for (let i = 0; i < count; i++) {
      const g = bx(0.35 + rnd() * 0.35, 0.22 + rnd() * 0.25, 0.35 + rnd() * 0.35);
      geometriesToDispose.push(g);
      const m = new THREE.Mesh(g, mat);
      m.position.set(
        wx + (rnd() - 0.5) * 0.9,
        wy + 0.4 + rnd() * 0.8,
        wz + (rnd() - 0.5) * 0.9
      );
      const ang = (i / count) * PI * 2 + rnd() * 0.5;
      const spd = 3.5 + rnd() * 5.5;
      group.add(m);
      debrisList.push({
        mesh: m,
        vx: Math.cos(ang) * spd,
        vy: 4.5 + rnd() * 4.5,
        vz: Math.sin(ang) * spd,
        rx: (rnd() - 0.5) * 10,
        ry: (rnd() - 0.5) * 10,
        life: 0,
        maxLife: 0.95,
      });
    }
  };

  // 4 Breakable Crates on the outer corners of the central dais (y = 1.2)
  const daisCrates = [
    { id: 'crate_dais_nw', x: -8.2, z: -3.6, rotY: 0.25 },
    { id: 'crate_dais_ne', x: 8.2, z: -3.6, rotY: -0.35 },
    { id: 'crate_dais_sw', x: -8.2, z: 3.6, rotY: 0.45 },
    { id: 'crate_dais_se', x: 8.2, z: 3.6, rotY: -0.2 },
  ];
  daisCrates.forEach((dc) => {
    const a = mk(bx(1.6, 1.6, 1.6), materials.foundryCrate, group, dc.x, dais.h + 0.8, dc.z);
    a.rotation.y = dc.rotY;
    colliderMeshes.push(a);
    destructibleMeshMap.set(dc.id, {
      mesh: a,
      baseY: dais.h + 0.8,
      broken: false,
    });
  });

  const crCoords = [
    [14, 9],
    [24, 6],
    [20, -12],
    [8, 14],
    [26, -3],
  ];
  let ci = 0;
  crCoords.forEach((p, idx) => {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const c = Math.floor((sx * p[0]) / TS + gridCols / 2);
        const r = Math.floor((sz * p[1]) / TS + gridRows / 2);
        if (st(c, r) === '2') {
          ci++;
          continue;
        }
        const wx = sx * p[0];
        const wz = sz * p[1];
        const propId = `crate_${idx}_${sx > 0 ? 'e' : 'w'}_${sz > 0 ? 's' : 'n'}`;
        const a = mk(bx(2, 2, 2), materials.foundryCrate, group, wx, 1, wz);
        a.rotation.y = foundryHash3(wx, wz, 3) * PI;
        colliderMeshes.push(a);

        let b: THREE.Mesh | undefined;
        if (ci % 4 === 0) {
          b = mk(bx(1.4, 1.4, 1.4), materials.foundryCrate, group, wx + 0.2, 2.7, wz);
          b.rotation.y = 0.5;
          colliderMeshes.push(b);
        }
        destructibleMeshMap.set(propId, {
          mesh: a,
          stackMesh: b,
          baseY: 1,
          broken: false,
        });
        ci++;
      }
    }
  });

  // Tactical explosive/industrial barrels on the combat deck near the dais ramps & flanks
  const combatBarrels = [
    { id: 'barrel_nw', x: -12.5, z: -4.2, red: true },
    { id: 'barrel_ne', x: 12.5, z: -4.2, red: false },
    { id: 'barrel_sw', x: -12.5, z: 4.2, red: false },
    { id: 'barrel_se', x: 12.5, z: 4.2, red: true },
    { id: 'barrel_n', x: 0, z: -6.8, red: true },
    { id: 'barrel_s', x: 0, z: 6.8, red: true },
  ];
  combatBarrels.forEach((bDef) => {
    const bGroup = new THREE.Group();
    bGroup.position.set(bDef.x, 0.65, bDef.z);
    group.add(bGroup);
    mk(
      new THREE.CylinderGeometry(0.55, 0.55, 1.3, 14),
      bDef.red ? materials.foundryBarrelRed : materials.foundryBarrelBlue,
      bGroup
    );
    mk(new THREE.CylinderGeometry(0.57, 0.57, 0.12, 14), materials.foundryBronze, bGroup);
    colliderMeshes.push(bGroup);
    destructibleMeshMap.set(bDef.id, {
      mesh: bGroup,
      baseY: 0.65,
      broken: false,
    });
  });

  // Ledge Barricades & Decorative Ledge Barrels (lines 5172, 5186-5187)
  [
    [14, H / 2 + E / 2],
    [-14, H / 2 + E / 2],
    [14, -H / 2 - E / 2],
    [-14, -H / 2 - E / 2],
  ].forEach((p) => {
    const bar = mk(bx(4, 1.2, 0.9), materials.foundryDark, group, p[0], 0.6, p[1]);
    colliderMeshes.push(bar);
  });

  const bm = [materials.foundryBarrelRed, materials.foundryBarrelBlue];
  const sharedBrlGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.3, 12);
  const sharedRingGeo = new THREE.CylinderGeometry(0.57, 0.57, 0.12, 12);
  geometriesToDispose.push(sharedBrlGeo, sharedRingGeo);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const x = sx * (19 + i * 1.3);
        const z = sz * (H / 2 + E / 2 + (i % 2) * 0.5);
        mk(sharedBrlGeo, bm[i % 2], group, x, 0.65, z, false);
        mk(sharedRingGeo, materials.foundryBronze, group, x, 0.65, z, false);
      }
    }
  }

  // 8. Bronze Pipes, Flanges, Wall Glow Strips & 4 Rotating Exhaust Fans (lines 5174-5184)
  const fans: THREE.Group[] = [];
  const sharedPipeGeo = new THREE.CylinderGeometry(0.28, 0.28, W + 2 * E, 10);
  const sharedFlangeGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.2, 10);
  geometriesToDispose.push(sharedPipeGeo, sharedFlangeGeo);
  for (const sx of [-1, 1]) {
    for (const y of [3.2, 4.6]) {
      const p = mk(
        sharedPipeGeo,
        materials.foundryBronze,
        group,
        0,
        y,
        sx * (H / 2 + E - 1.4),
        false
      );
      p.rotation.z = PI / 2;
      for (let k = -30; k <= 30; k += 10) {
        const f = mk(
          sharedFlangeGeo,
          materials.foundryDark,
          group,
          k,
          y,
          sx * (H / 2 + E - 1.4),
          false
        );
        f.rotation.z = PI / 2;
      }
    }
    mk(bx(W + 2 * E, 0.25, 0.1), materials.foundryGlowOrange, group, 0, 6.4, sx * (H / 2 + E - 0.02), false);
    mk(bx(0.1, 0.25, H + 2 * E), materials.foundryGlowCyan, group, sx * (W / 2 + E - 0.02), 6.4, 0, false);

    for (const z of [-6, 6]) {
      const g = new THREE.Group();
      g.position.set(sx * (W / 2 + E - 0.5), 8, z);
      group.add(g);
      mk(new THREE.TorusGeometry(2.3, 0.22, 8, 24), materials.foundryBronze, g, 0, 0, 0, false).rotation.y = PI / 2;
      mk(new THREE.CylinderGeometry(2.3, 2.3, 0.2, 24), materials.foundryDark, g, sx * 0.3, 0, 0, false).rotation.z =
        PI / 2;

      const bl = new THREE.Group();
      bl.position.x = sx * 0.1;
      g.add(bl);
      [0, PI / 2].forEach((a) => {
        mk(bx(0.08, 0.55, 4.1), materials.foundryDark, bl, 0, 0, 0, false).rotation.x = a;
      });
      mk(new THREE.CylinderGeometry(0.4, 0.4, 0.4, 10), materials.foundryBronze, bl, 0, 0, 0, false).rotation.z = PI / 2;
      fans.push(bl);
    }
  }

  mk(bx(0.9, 0.6, 18), materials.foundryDark, group, 0, 12, 0);
  mk(new THREE.CylinderGeometry(0.1, 0.1, 4.2, 6), materials.foundryDark, group, 0, 9.8, 0);
  mk(new THREE.TorusGeometry(0.7, 0.17, 8, 18, 4.6), materials.foundryBronze, group, 0, 7.4, 0).rotation.z =
    PI / 2;

  // Volumetric Spotlight Cones (lines 5184-5185)
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffc88a,
    transparent: true,
    opacity: 0.055,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  extraMaterialsToDispose.push(coneMat);
  for (const sx of [-1, 1]) {
    for (let k = -27; k <= 27; k += 18) {
      const cGeo = new THREE.ConeGeometry(5, 11.4, 20, 1, true);
      geometriesToDispose.push(cGeo);
      const c = new THREE.Mesh(cGeo, coneMat);
      c.position.set(k, 5.9, sx * 9);
      group.add(c);
    }
  }

  // 9. Molten Lava Pit & Rising Embers (lines 5188-5192)
  const lavaGeo = new THREE.PlaneGeometry(W, H);
  geometriesToDispose.push(lavaGeo);
  const lava = new THREE.Mesh(lavaGeo, materials.foundryLava);
  lava.rotation.x = -PI / 2;
  lava.position.y = lavaY;
  group.add(lava);

  const N = 260;
  const ep = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    ep[i * 3] = (rnd() - 0.5) * W;
    ep[i * 3 + 1] = -5 + rnd() * 21;
    ep[i * 3 + 2] = (rnd() - 0.5) * H;
  }
  const eg = new THREE.BufferGeometry();
  eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
  geometriesToDispose.push(eg);
  const emberMat = new THREE.PointsMaterial({
    size: 0.22,
    color: 0xff8a3c,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  extraMaterialsToDispose.push(emberMat);
  group.add(new THREE.Points(eg, emberMat));

  // 10. Rules Overlay Group (Safe Dais Green Outline & Red Kill Plane at y = -3) (lines 5193-5196)
  const rulesOverlayGroup = new THREE.Group();
  rulesOverlayGroup.visible = false;
  group.add(rulesOverlayGroup);

  const kpGeo = new THREE.PlaneGeometry(W, H);
  geometriesToDispose.push(kpGeo);
  const kpMat = new THREE.MeshBasicMaterial({
    color: 0xc0392b,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  extraMaterialsToDispose.push(kpMat);
  const kp = new THREE.Mesh(kpGeo, kpMat);
  kp.rotation.x = -PI / 2;
  kp.position.y = killY;
  rulesOverlayGroup.add(kp);

  const daisEdgeGeo = new THREE.EdgesGeometry(bx(dais.w + 0.5, 0.1, dais.d + 0.5));
  geometriesToDispose.push(daisEdgeGeo);
  const daisEdgeMat = new THREE.LineBasicMaterial({ color: 0x4caf6e, fog: false });
  extraMaterialsToDispose.push(daisEdgeMat);
  const eo = new THREE.LineSegments(daisEdgeGeo, daisEdgeMat);
  eo.position.y = dais.h + 0.15;
  rulesOverlayGroup.add(eo);

  // 11. Steam Vent Grates & Rising Steam Plumes (lines 5199-5203)
  const VN = [
    [-24, 22.4],
    [0, 22.4],
    [24, 22.4],
    [-24, -22.4],
    [0, -22.4],
    [24, -22.4],
  ];
  const SN = VN.length * 16;
  const spp = new Float32Array(SN * 3);
  const sph: number[] = [];
  VN.forEach((v) => {
    mk(bx(2.2, 0.1, 1.4), materials.foundryDark, group, v[0], 0.05, v[1]);
    [-0.7, 0, 0.7].forEach((o) =>
      mk(bx(0.12, 0.04, 1.1), materials.foundryGlowOrange, group, v[0] + o, 0.11, v[1], false)
    );
  });
  for (let i = 0; i < SN; i++) sph.push(rnd());
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(spp, 3));
  geometriesToDispose.push(sg);
  const steamMat = new THREE.PointsMaterial({
    map: materials.softParticleTex,
    size: 3.4,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    color: 0xd8d4cc,
  });
  extraMaterialsToDispose.push(steamMat);
  const steam = new THREE.Points(sg, steamMat);
  steam.frustumCulled = false;
  group.add(steam);

  // 12. Scorch Decals, Grid Coordinate Labels (A..L, 1..8), and Wall Grime Streaks (lines 5205-5215)
  for (let k = 0; k < 16; k++) {
    const c = Math.floor(foundryHash3(k, 1, 7) * gridCols);
    const r = Math.floor(foundryHash3(k, 2, 7) * gridRows);
    const q = st(c, r);
    if (q === '2' || q === 'D') continue;
    const decGeo = new THREE.PlaneGeometry(5.5, 5.5);
    geometriesToDispose.push(decGeo);
    const dec = new THREE.Mesh(decGeo, materials.foundryScorchMat);
    dec.rotation.set(-PI / 2, 0, foundryHash3(k, 5, 7) * 6.28);
    dec.position.set(
      (c - gridCols / 2 + 0.5) * TS + (foundryHash3(k, 3, 7) - 0.5) * 2,
      0.016,
      (r - gridRows / 2 + 0.5) * TS + (foundryHash3(k, 4, 7) - 0.5) * 2
    );
    group.add(dec);
  }

  const textDecalMatCache = new Map<string, THREE.MeshBasicMaterial>();
  const sharedDecalGeo = new THREE.PlaneGeometry(2.6, 1.3);
  geometriesToDispose.push(sharedDecalGeo);

  const makeTextDecal = (label: string, x: number, z: number, rotZ: number) => {
    let mat = textDecalMatCache.get(label);
    if (!mat) {
      const cnv = document.createElement('canvas');
      cnv.width = 128;
      cnv.height = 64;
      const ctx = cnv.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(235,235,225,0.8)';
        ctx.font = '700 46px system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 64, 34);
      }
      const tex = new THREE.CanvasTexture(cnv);
      tex.colorSpace = THREE.SRGBColorSpace;
      extraTexturesToDispose.push(tex);
      mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      extraMaterialsToDispose.push(mat);
      textDecalMatCache.set(label, mat);
    }
    const m = new THREE.Mesh(sharedDecalGeo, mat);
    m.rotation.set(-PI / 2, 0, rotZ);
    m.position.set(x, 0.02, z);
    group.add(m);
  };

  for (let c = 0; c < gridCols; c++) {
    const x = (c - gridCols / 2 + 0.5) * TS;
    const l = 'ABCDEFGHIJKL'[c];
    makeTextDecal(l, x, H / 2 + 0.9, PI);
    makeTextDecal(l, x, -H / 2 - 0.9, 0);
  }
  for (let r = 0; r < gridRows; r++) {
    const z = (r - gridRows / 2 + 0.5) * TS;
    makeTextDecal(String(r + 1), -W / 2 - 0.9, z, -PI / 2);
  }

  const addWallStreak = (w: number, h: number, x: number, z: number, ry: number) => {
    const geo = new THREE.PlaneGeometry(w, h);
    geometriesToDispose.push(geo);
    const m = new THREE.Mesh(geo, materials.foundryStreakMat);
    m.position.set(x, h / 2 + 0.4, z);
    m.rotation.y = ry;
    group.add(m);
  };
  for (const sx of [-1, 1]) {
    for (let k = -27; k <= 27; k += 18) {
      addWallStreak(18, 13, k, sx * (H / 2 + E - 0.03), sx > 0 ? PI : 0);
    }
    for (let k = -16; k <= 16; k += 16) {
      addWallStreak(16, 13, sx * (W / 2 + E - 0.03), k, sx > 0 ? -PI / 2 : PI / 2);
    }
  }

  // 13. Moving Overhead Gantry Crane & Swinging Molten Ladle (lines 5216-5221)
  const cr1 = new THREE.Group();
  cr1.position.set(0, 12, 9);
  group.add(cr1);
  mk(bx(2.2, 0.6, 1.6), materials.foundryDark, cr1);

  const sw = new THREE.Group();
  sw.position.y = -0.3;
  cr1.add(sw);
  mk(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 6), materials.foundryDark, sw, 0, -1.6, 0);

  const lad = new THREE.Group();
  lad.position.y = -3.4;
  sw.add(lad);
  const ladMat = new THREE.MeshStandardMaterial({
    color: 0x2a2622,
    metalness: 0.6,
    roughness: 0.5,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  extraMaterialsToDispose.push(ladMat);
  mk(new THREE.CylinderGeometry(1.5, 1, 1.7, 14, 1, true), ladMat, lad);

  const molGeo = new THREE.CircleGeometry(1.42, 20);
  geometriesToDispose.push(molGeo);
  const mol = new THREE.Mesh(molGeo, materials.foundryLava);
  mol.rotation.x = -PI / 2;
  mol.position.y = 0.5;
  lad.add(mol);
  mk(new THREE.TorusGeometry(1.15, 0.07, 6, 20, PI), materials.foundryBronze, lad, 0, 0.85, 0);

  // 14. East Conveyor Belt & Moving Crates + Reciprocating Wall Pistons (lines 5222-5225)
  mk(bx(1.4, 0.45, 16), materials.foundryConveyor, group, 33, 0.25, 0);
  [-1, 1].forEach((o) =>
    mk(bx(0.12, 0.7, 16.2), materials.foundryBronze, group, 33 + o * 0.8, 0.4, 0)
  );
  const cbx = [0, 1, 2].map((i) => mk(bx(0.9, 0.9, 0.9), materials.foundryCrate, group, 33, 0.9, -6 + i * 6));

  const pst: [THREE.Mesh, THREE.Mesh, number, number, number][] = [];
  for (const sx of [-1, 1]) {
    for (const x of [-12, 12]) {
      const z = sx * (H / 2 + E - 0.8);
      mk(bx(2.2, 2.2, 1.4), materials.foundryDark, group, x, 9, z);
      const rod = mk(new THREE.CylinderGeometry(0.32, 0.32, 2.6, 10), materials.foundryBronze, group, x, 9, z);
      rod.rotation.x = PI / 2;
      const head = mk(bx(1.7, 1.7, 0.3), materials.foundryDark, group, x, 9, z);
      pst.push([rod, head, z, -sx, x]);
    }
  }

  // 15. Distant Industrial Skyline: 46 Lit Buildings (1 InstancedMesh) & 9 Flaming Smokestacks
  const bldgUnitGeo = bx(1, 1, 1);
  geometriesToDispose.push(bldgUnitGeo);
  const bldgInstanced = new THREE.InstancedMesh(bldgUnitGeo, materials.foundryWindowMat, 46);
  bldgInstanced.frustumCulled = false;
  const _dummy = new THREE.Object3D();
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * PI * 2 + rnd() * 0.1;
    const R = 105 + rnd() * 45;
    const w = 8 + rnd() * 14;
    const h = 18 + rnd() * 50;
    _dummy.position.set(Math.cos(a) * R, h / 2 - 6, Math.sin(a) * R);
    _dummy.rotation.set(0, -a, 0);
    _dummy.scale.set(w, h, w);
    _dummy.updateMatrix();
    bldgInstanced.setMatrixAt(i, _dummy.matrix);
  }
  bldgInstanced.instanceMatrix.needsUpdate = true;
  group.add(bldgInstanced);

  const chm: [number, number, number][] = [];
  const cmkMat = new THREE.MeshBasicMaterial({ color: 0x1d1613 });
  const flMat = new THREE.MeshBasicMaterial({ color: 0xff6a2a });
  extraMaterialsToDispose.push(cmkMat, flMat);
  const stackGeo = new THREE.CylinderGeometry(3, 4.5, 1, 8);
  const flameGeo = new THREE.SphereGeometry(1.3, 8, 6);
  geometriesToDispose.push(stackGeo, flameGeo);
  const stackInstanced = new THREE.InstancedMesh(stackGeo, cmkMat, 9);
  const flameInstanced = new THREE.InstancedMesh(flameGeo, flMat, 9);
  stackInstanced.frustumCulled = false;
  flameInstanced.frustumCulled = false;

  for (let i = 0; i < 9; i++) {
    const a = i * 0.7 + 0.3;
    const R = 120 + rnd() * 30;
    const h = 60 + rnd() * 40;
    const x = Math.cos(a) * R;
    const z = Math.sin(a) * R;
    _dummy.position.set(x, h / 2 - 6, z);
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.set(1, h, 1);
    _dummy.updateMatrix();
    stackInstanced.setMatrixAt(i, _dummy.matrix);

    _dummy.position.set(x, h - 5.5, z);
    _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    flameInstanced.setMatrixAt(i, _dummy.matrix);

    chm.push([x, h - 4, z]);
  }
  stackInstanced.instanceMatrix.needsUpdate = true;
  flameInstanced.instanceMatrix.needsUpdate = true;
  group.add(stackInstanced, flameInstanced);

  const CN = chm.length * 8;
  const cpp = new Float32Array(CN * 3);
  const cph: number[] = [];
  for (let i = 0; i < CN; i++) cph.push(rnd());
  const cg2 = new THREE.BufferGeometry();
  cg2.setAttribute('position', new THREE.BufferAttribute(cpp, 3));
  geometriesToDispose.push(cg2);
  const smokeMat = new THREE.PointsMaterial({
    map: materials.softParticleTex,
    size: 34,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    color: 0x3a2f2a,
  });
  extraMaterialsToDispose.push(smokeMat);
  const csm = new THREE.Points(cg2, smokeMat);
  csm.frustumCulled = false;
  group.add(csm);

  // 16. Frame Update Loop (Animations + Destructible Crates/Tiles Synchronization)
  animators.push((t, dt, sim) => {
    // Steam vents
    for (let i = 0; i < SN; i++) {
      const v = VN[i >> 4];
      const p = (sph[i] + t * 0.12) % 1;
      spp[i * 3] = v[0] + Math.sin(t + i) * 0.5 * p;
      spp[i * 3 + 1] = 0.3 + p * 8;
      spp[i * 3 + 2] = v[1] + Math.cos(t * 0.8 + i) * 0.5 * p;
    }
    sg.attributes.position.needsUpdate = true;

    // Chimney smoke plumes
    for (let i = 0; i < CN; i++) {
      const c = chm[i >> 3];
      const p = (cph[i] + t * 0.02) % 1;
      cpp[i * 3] = c[0] + p * 14;
      cpp[i * 3 + 1] = c[1] + p * 35;
      cpp[i * 3 + 2] = c[2] + p * 6;
    }
    cg2.attributes.position.needsUpdate = true;

    // Overhead crane & ladle
    cr1.position.x = Math.sin(t * 0.18) * 24;
    sw.rotation.z = Math.cos(t * 0.18) * 0.06;
    lad.rotation.z = Math.sin(t * 0.9) * 0.03;

    // Conveyor belt & crates
    materials.conveyorTex.offset.y += dt * 0.45;
    cbx.forEach((c) => {
      c.position.z += dt * 1.2;
      if (c.position.z > 7.5) c.position.z = -7.5;
    });

    // Wall pistons
    pst.forEach((p) => {
      const e = 1 + Math.sin(t * 1.3 + p[4]);
      p[0].position.z = p[2] + p[3] * (0.4 + e);
      p[1].position.z = p[2] + p[3] * (1.7 + e);
    });

    // Exhaust fans & lava scroll & ember particles
    fans.forEach((f) => {
      f.rotation.x += dt * 1.6;
    });
    materials.lavaTex.offset.x += dt * 0.012;
    materials.lavaTex.offset.y += dt * 0.007;
    lavaLights.forEach((l, i) => {
      l.intensity = 1.6 + Math.sin(t * 3 + i * 2) * 0.2;
    });

    for (let i = 0; i < N; i++) {
      ep[i * 3 + 1] += dt * (1 + foundryHash3(i, 1, 1));
      ep[i * 3] += Math.sin(t + i) * dt * 0.4;
      if (ep[i * 3 + 1] > 16) ep[i * 3 + 1] = -5;
    }
    eg.attributes.position.needsUpdate = true;

    // Update flying debris chunks from broken crates/barrels
    for (let i = debrisList.length - 1; i >= 0; i--) {
      const d = debrisList[i];
      d.life += dt;
      if (d.life >= d.maxLife) {
        group.remove(d.mesh);
        debrisList.splice(i, 1);
      } else {
        d.vy -= 18 * dt;
        d.mesh.position.x += d.vx * dt;
        d.mesh.position.y += d.vy * dt;
        d.mesh.position.z += d.vz * dt;
        d.mesh.rotation.x += d.rx * dt;
        d.mesh.rotation.y += d.ry * dt;
        const scale = Math.max(0.01, 1 - d.life / d.maxLife);
        d.mesh.scale.setScalar(scale);
      }
    }
  });

  const syncBreakables = (sim: SimulationState) => {
    if (sim.floorTiles) {
      for (const simTile of sim.floorTiles) {
        const key = `${simTile.ring}_${simTile.index}`;
        const tData = tileMeshMap.get(key);
        if (!tData) continue;
        if (simTile.state === 2) {
          tData.mesh.visible = false;
        } else {
          tData.mesh.visible = true;
          if (simTile.state === 1 && tData.lastState !== 1) {
            tData.mesh.material = materials.foundryCrack;
            tData.mesh.position.y = -0.58;
            tData.lastState = 1;
          } else if (simTile.state === 0 && tData.lastState !== 0) {
            tData.mesh.material = materials.foundryFloor;
            tData.mesh.position.y = -0.5;
            tData.lastState = 0;
          }
        }
      }
    }

    if (sim.breakableProps) {
      for (const prop of sim.breakableProps) {
        const entry = destructibleMeshMap.get(prop.id);
        if (!entry) continue;
        if (prop.broken && !entry.broken) {
          entry.broken = true;
          entry.mesh.visible = false;
          if (entry.stackMesh) entry.stackMesh.visible = false;
          const idx1 = colliderMeshes.indexOf(entry.mesh);
          if (idx1 >= 0) colliderMeshes.splice(idx1, 1);
          if (entry.stackMesh) {
            const idx2 = colliderMeshes.indexOf(entry.stackMesh);
            if (idx2 >= 0) colliderMeshes.splice(idx2, 1);
          }
          spawnDebris(prop.x, entry.baseY, prop.z, prop.kind === 'barrel');
        } else if (!prop.broken && entry.broken) {
          entry.broken = false;
          entry.mesh.visible = true;
          if (entry.stackMesh) entry.stackMesh.visible = true;
          if (!colliderMeshes.includes(entry.mesh)) colliderMeshes.push(entry.mesh);
          if (entry.stackMesh && !colliderMeshes.includes(entry.stackMesh)) {
            colliderMeshes.push(entry.stackMesh);
          }
        } else if (!prop.broken && prop.hitFlashMs > 0) {
          entry.mesh.position.x = prop.x + (Math.random() - 0.5) * 0.18;
          entry.mesh.position.z = prop.z + (Math.random() - 0.5) * 0.18;
        } else if (!prop.broken && (entry.mesh.position.x !== prop.x || entry.mesh.position.z !== prop.z)) {
          entry.mesh.position.x = prop.x;
          entry.mesh.position.z = prop.z;
        }
      }
    }
  };

  const damageTileAt = (worldX: number, worldZ: number, damage: number) => {
    const c = Math.floor((worldX + W / 2) / TS);
    const r = Math.floor((worldZ + H / 2) / TS);
    const key = `${c}_${r}`;
    const entry = tileMeshMap.get(key);
    if (entry && entry.mesh.visible) {
      if (damage >= 20) {
        entry.mesh.material = materials.foundryCrack;
        entry.mesh.position.y = -0.58;
      }
    }
  };

  const arenaDef = ARENA_REGISTRY[arenaId] || ARENA_REGISTRY.foundry_arena;

  return {
    group,
    colliderMeshes,
    colliders: arenaDef.colliders,
    fogColor: new THREE.Color(0x1d1614),
    fogDensity: 0.0085,
    rulesOverlayGroup,
    update: (elapsedTime, dt, sim) => {
      animators.forEach((fn) => fn(elapsedTime, dt, sim));
    },
    syncBreakables,
    dispose: () => {
      geometriesToDispose.forEach((g) => g.dispose());
      extraMaterialsToDispose.forEach((m) => m.dispose());
      extraTexturesToDispose.forEach((t) => t.dispose());
    },
    damageTileAt,
  };
}

export function updateArenaScene(
  rig: ArenaSceneRig,
  elapsedTime: number,
  dt: number,
  sim?: SimulationState
): void {
  rig.update(elapsedTime, dt, sim);
}

export function syncArenaBreakables(rig: ArenaSceneRig, sim: SimulationState): void {
  rig.syncBreakables(sim);
}
