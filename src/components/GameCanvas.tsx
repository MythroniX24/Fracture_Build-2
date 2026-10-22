import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ARENA_REGISTRY,
  type ArenaId,
  type BotDifficulty,
  type CharacterId,
  type GameMode,
  type GameSettings,
  type ScreenState,
  type TrainingConfig,
  WEAPON_ORDER,
  WEAPON_REGISTRY,
  type WeaponId,
} from '../game/config.ts';
import {
  type CombatEvent,
  PLAYER_COLLISION_RADIUS,
  type PlayerInputSnapshot,
  type SimulationState,
  computeWeaponWallObstruction,
  getScopeSensitivityMultiplier,
  resolveEntityCollisions,
  stepSimulation,
} from '../game/rules.ts';
import {
  buildDetailedEnemySoldier,
  buildDetailedWeaponViewModel,
  createProceduralTextureSet,
  type EnemySoldierRig,
  type WeaponViewModelRig,
} from '../game/visualModels.ts';
import type { HudDomRefs, TouchInputState } from './CombatHUD.tsx';
import { soundEngine } from '../audio/soundEngine.ts';

export interface GameCanvasProps {
  screenState: ScreenState;
  gameMode: GameMode;
  p1Char: CharacterId;
  p2Char: CharacterId;
  arenaId: ArenaId;
  botDifficulty: BotDifficulty;
  lockedOn: boolean;
  firstPersonMode?: boolean;
  settings: GameSettings;
  trainingConfig: TrainingConfig;
  simRef: React.MutableRefObject<SimulationState>;
  hudRefs: HudDomRefs;
  touchInputRef: React.MutableRefObject<TouchInputState>;
  onToggleLockOn: () => void;
  onToggleFirstPerson?: () => void;
  onCombatEvent: (evt: CombatEvent) => void;
  onRoundFinished: (winner: 'p1' | 'p2' | 'draw') => void;
  loadoutOverlayOpen?: boolean;
}

interface ShellCasingParticle {
  mesh: THREE.Mesh;
  active: boolean;
  ageMs: number;
  maxAgeMs: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
}

interface ImpactParticle {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  active: boolean;
  ageMs: number;
  maxAgeMs: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  baseScale: number;
}

interface ImpactRingFX {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  active: boolean;
  ageMs: number;
  maxAgeMs: number;
  maxScale: number;
}

interface BulletDecalFX {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  active: boolean;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  screenState,
  gameMode,
  arenaId,
  botDifficulty,
  settings,
  trainingConfig,
  simRef,
  hudRefs,
  touchInputRef,
  onCombatEvent,
  onRoundFinished,
  loadoutOverlayOpen = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const screenStateRef = useRef(screenState);
  screenStateRef.current = screenState;
  const loadoutOverlayOpenRef = useRef(loadoutOverlayOpen);
  loadoutOverlayOpenRef.current = loadoutOverlayOpen;
  const gameModeRef = useRef(gameMode);
  gameModeRef.current = gameMode;
  const arenaIdRef = useRef(arenaId);
  arenaIdRef.current = arenaId;
  const botDifficultyRef = useRef(botDifficulty);
  botDifficultyRef.current = botDifficulty;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const trainingConfigRef = useRef(trainingConfig);
  trainingConfigRef.current = trainingConfig;
  const onCombatEventRef = useRef(onCombatEvent);
  onCombatEventRef.current = onCombatEvent;
  const onRoundFinishedRef = useRef(onRoundFinished);
  onRoundFinishedRef.current = onRoundFinished;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const quality = settingsRef.current.graphicsQuality;
    let isSoftwareGl = false;
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
      if (gl) {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        const rendererStr = dbg
          ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
          : String(gl.getParameter(gl.RENDERER));
        isSoftwareGl = /SwiftShader|llvmpipe|Software|Microsoft Basic Render/i.test(
          rendererStr
        );
      }
    } catch {
      // ignore
    }

    const isLow = quality === 'low' || isSoftwareGl;
    const isHigh = quality === 'high' && !isSoftwareGl;

    // 1. WebGLRenderer Setup with ACES Filmic Tone Mapping
    const renderer = new THREE.WebGLRenderer({
      antialias: !isLow,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, isLow ? 1.0 : isHigh ? 2.0 : 1.5)
    );
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    renderer.shadowMap.enabled = !isLow;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const texSet = createProceduralTextureSet(maxAnisotropy);

    // 2. Scene, Sky Gradient, IBL Environment & Tactical Lighting
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fb3c8);
    scene.fog = new THREE.FogExp2(0x9fb3c8, 0.0055);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.72;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0xe2e8f0, 0x334155, 0.85);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 2.35);
    sunLight.position.set(42, 68, 36);
    sunLight.castShadow = !isLow;
    if (!isLow) {
      const mapRes = isHigh ? 2048 : 1024;
      sunLight.shadow.mapSize.set(mapRes, mapRes);
      sunLight.shadow.camera.near = 5;
      sunLight.shadow.camera.far = 180;
      const d = 68;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0005;
    }
    scene.add(sunLight);

    // 3. First-Person Camera & 6-Weapon Viewmodel Rig
    const camera = new THREE.PerspectiveCamera(
      78,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.08,
      260
    );
    camera.rotation.order = 'YXZ';
    scene.add(camera);

    const viewmodelRig = new THREE.Group();
    camera.add(viewmodelRig);

    // Dynamic Muzzle Flash PointLight attached to viewmodel
    const muzzlePointLight = new THREE.PointLight(0xffb732, 0, 11, 1.6);
    muzzlePointLight.position.set(0.2, -0.1, -1.1);
    camera.add(muzzlePointLight);

    const weaponModels: Record<WeaponId, WeaponViewModelRig> = {} as Record<
      WeaponId,
      WeaponViewModelRig
    >;
    for (const wid of WEAPON_ORDER) {
      const built = buildDetailedWeaponViewModel(wid, texSet.muzzleFlashMap);
      built.root.visible = wid === 'm4a1';
      viewmodelRig.add(built.root);
      weaponModels[wid] = built;
    }

    // 4. Tactical Compound Map Builder with Procedural PBR Textures
    const mapGroup = new THREE.Group();
    scene.add(mapGroup);
    let currentBuiltArenaId: ArenaId | null = null;

    const buildArenaGeometry = (aid: ArenaId) => {
      while (mapGroup.children.length > 0) {
        const child = mapGroup.children.pop()!;
        mapGroup.remove(child);
      }

      const arenaDef = ARENA_REGISTRY[aid] || ARENA_REGISTRY.foundry_arena;
      const skyHex =
        aid === 'foundry_arena' ? 0x8fa6bd : aid === 'iron_fortress' ? 0x64748b : 0x94a3b8;
      scene.background = new THREE.Color(skyHex);
      scene.fog = new THREE.FogExp2(skyHex, 0.0042);
      sunLight.color.setHex(0xfff7ed);
      sunLight.intensity = 2.65;
      hemiLight.color.setHex(0xe2e8f0);
      hemiLight.groundColor.setHex(arenaDef.ambientHex || 0x334155);

      const spanX = (arenaDef.bounds.maxX - arenaDef.bounds.minX) * 1.35;
      const spanZ = (arenaDef.bounds.maxZ - arenaDef.bounds.minZ) * 1.35;

      // Textured Asphalt / Concrete Ground Slab
      const groundMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: texSet.groundMap,
        bumpMap: texSet.groundBump,
        bumpScale: 0.015,
        roughness: 0.84,
        metalness: 0.08,
      });
      const groundMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(spanX, spanZ),
        groundMat
      );
      groundMesh.rotation.x = -Math.PI / 2;
      groundMesh.receiveShadow = true;
      mapGroup.add(groundMesh);

      // Tactical Lane Striping & Heli-Pad / Compound Center Markings
      const stripeMat = new THREE.MeshBasicMaterial({
        color: 0xcbd5e1,
        transparent: true,
        opacity: 0.22,
      });
      const centerRing = new THREE.Mesh(
        new THREE.RingGeometry(11.5, 12.1, 48),
        stripeMat
      );
      centerRing.rotation.x = -Math.PI / 2;
      centerRing.position.y = 0.025;
      mapGroup.add(centerRing);

      // Industrial Diamond-Plate / Steel Grating Floor Zones (Metal Footstep Surfaces)
      const metalDeckMat = new THREE.MeshStandardMaterial({
        color: 0xb8c4d4,
        map: texSet.metalDeckMap,
        bumpMap: texSet.metalDeckBump,
        bumpScale: 0.022,
        roughness: 0.34,
        metalness: 0.78,
      });
      const metalBevelMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.38,
        metalness: 0.82,
      });

      if (arenaDef.surfaceZones) {
        for (const sz of arenaDef.surfaceZones) {
          if (sz.material !== 'metal') continue;
          const zw = sz.maxX - sz.minX;
          const zd = sz.maxZ - sz.minZ;
          const cx = (sz.minX + sz.maxX) * 0.5;
          const cz = (sz.minZ + sz.maxZ) * 0.5;

          const deckPlate = new THREE.Mesh(
            new THREE.BoxGeometry(zw, 0.028, zd),
            metalDeckMat
          );
          deckPlate.position.set(cx, 0.014, cz);
          deckPlate.receiveShadow = true;
          mapGroup.add(deckPlate);

          const deckRim = new THREE.Mesh(
            new THREE.BoxGeometry(zw + 0.16, 0.018, zd + 0.16),
            metalBevelMat
          );
          deckRim.position.set(cx, 0.009, cz);
          deckRim.receiveShadow = true;
          mapGroup.add(deckRim);
        }
      }

      // Shared Architectural Materials
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0x64748b,
        map: texSet.wallMap,
        bumpMap: texSet.wallMap,
        bumpScale: 0.012,
        roughness: 0.65,
        metalness: 0.18,
      });
      const towerMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        map: texSet.wallMap,
        roughness: 0.58,
        metalness: 0.28,
      });
      const containerMat = new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        map: texSet.containerMap,
        roughness: 0.5,
        metalness: 0.42,
      });
      const coverMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        map: texSet.wallMap,
        roughness: 0.56,
        metalness: 0.24,
      });
      const trimMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.42,
        metalness: 0.62,
      });
      const hazardStripeMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.48,
        metalness: 0.25,
      });

      for (const b of arenaDef.blocks) {
        const bw = b.width;
        const bh = b.height;
        const bd = b.depth;
        const isBuilding = b.kind === 'building';
        const isTower = b.kind === 'tower';
        const isContainer = b.kind === 'container';
        const isPerimeter = b.kind === 'wall';

        const mat = isTower
          ? towerMat
          : isContainer
          ? containerMat
          : isBuilding || isPerimeter
          ? wallMat
          : coverMat;

        const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
        mesh.position.set(b.x, bh * 0.5, b.z);
        mesh.castShadow = !isLow && !isPerimeter;
        mesh.receiveShadow = true;
        mapGroup.add(mesh);

        // Reinforced Steel Roof Cap & Base Plinth for visual Crispness
        if (!isPerimeter) {
          const cap = new THREE.Mesh(
            new THREE.BoxGeometry(bw + 0.18, 0.16, bd + 0.18),
            trimMat
          );
          cap.position.set(b.x, bh + 0.04, b.z);
          mapGroup.add(cap);

          const plinth = new THREE.Mesh(
            new THREE.BoxGeometry(bw + 0.14, 0.18, bd + 0.14),
            trimMat
          );
          plinth.position.set(b.x, 0.09, b.z);
          mapGroup.add(plinth);

          // Yellow tactical caution band on waist-high concrete barriers
          if (b.kind === 'cover' && bh <= 1.6) {
            const band = new THREE.Mesh(
              new THREE.BoxGeometry(bw + 0.04, 0.1, bd + 0.04),
              hazardStripeMat
            );
            band.position.set(b.x, bh - 0.18, b.z);
            mapGroup.add(band);
          }
        }
      }

      // Render cylindrical tactical pillars from arenaDef.colliders
      for (const col of arenaDef.colliders) {
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(col.radius, col.radius * 1.06, col.height, 16),
          towerMat
        );
        pillar.position.set(col.x, col.height * 0.5, col.z);
        pillar.castShadow = !isLow;
        pillar.receiveShadow = true;
        mapGroup.add(pillar);
      }

      // 4 Corner Floodlight Towers for Horizon Depth & Silhouette Framing
      const towerCoords = [
        [-48, -48],
        [48, -48],
        [-48, 48],
        [48, 48],
      ];
      const lampMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      for (const [tx, tz] of towerCoords) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.42, 16, 8),
          trimMat
        );
        pole.position.set(tx, 8, tz);
        const head = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 0.8), trimMat);
        head.position.set(tx, 16.2, tz);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.45, 0.9), lampMat);
        lamp.position.set(tx, 16.1, tz);
        mapGroup.add(pole, head, lamp);
      }

      // Freeze world matrices on static arena architecture to save per-frame CPU traversal
      mapGroup.updateMatrixWorld(true);
      mapGroup.traverse((child) => {
        if (child !== mapGroup) {
          child.matrixAutoUpdate = false;
          child.updateMatrix();
        }
      });

      currentBuiltArenaId = aid;
    };

    buildArenaGeometry(arenaIdRef.current);

    // 5. Breakable Props (Explosive Red Hazard Barrels & Wooden Tactical Crates)
    const propsGroup = new THREE.Group();
    scene.add(propsGroup);
    const propMeshes = new Map<string, THREE.Object3D>();

    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.36,
      metalness: 0.48,
    });
    const barrelStripeMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.42,
      metalness: 0.25,
    });
    const crateMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texSet.crateMap,
      roughness: 0.76,
      metalness: 0.12,
    });

    const syncBreakableProps = (sim: SimulationState) => {
      for (const p of sim.breakableProps) {
        let obj = propMeshes.get(p.id);
        if (!obj) {
          if (p.kind === 'barrel') {
            const grp = new THREE.Group();
            const cyl = new THREE.Mesh(
              new THREE.CylinderGeometry(p.radius, p.radius, p.height, 16),
              barrelMat.clone()
            );
            cyl.position.y = p.height * 0.5;
            cyl.castShadow = !isLow;
            cyl.receiveShadow = true;

            const ringTop = new THREE.Mesh(
              new THREE.CylinderGeometry(p.radius * 1.04, p.radius * 1.04, 0.12, 16),
              barrelStripeMat
            );
            ringTop.position.y = p.height * 0.74;

            const ringBot = new THREE.Mesh(
              new THREE.CylinderGeometry(p.radius * 1.04, p.radius * 1.04, 0.12, 16),
              barrelStripeMat
            );
            ringBot.position.y = p.height * 0.26;

            grp.add(cyl, ringTop, ringBot);
            obj = grp;
          } else {
            const box = new THREE.Mesh(
              new THREE.BoxGeometry(p.radius * 1.85, p.height, p.radius * 1.85),
              crateMat.clone()
            );
            box.position.y = p.height * 0.5;
            box.castShadow = !isLow;
            box.receiveShadow = true;
            obj = box;
          }
          propsGroup.add(obj);
          propMeshes.set(p.id, obj);
        }
        obj.visible = !p.broken;
        obj.position.set(p.x, 0, p.z);
      }
    };

    // 6. Articulated 16-Part Enemy Bot Rigs & 3D Animated Supply Pickups
    const enemyGroup = new THREE.Group();
    scene.add(enemyGroup);
    const enemyRigs = new Map<string, EnemySoldierRig>();

    const pickupGroup = new THREE.Group();
    scene.add(pickupGroup);
    const pickupMeshes = new Map<string, { group: THREE.Group; ring: THREE.Mesh }>();

    // 7. Zero-GC Pooled Ballistic VFX Systems
    const vfxGroup = new THREE.Group();
    scene.add(vfxGroup);

    // 7A. Dual-Layer Bullet Tracer Pool (Bright Core + Additive Outer Glow)
    const TRACER_POOL_SIZE = 24;
    const tracerPool: {
      group: THREE.Group;
      coreMat: THREE.MeshBasicMaterial;
      glowMat: THREE.MeshBasicMaterial;
    }[] = [];
    const coreGeo = new THREE.CylinderGeometry(0.007, 0.003, 1, 6);
    coreGeo.rotateX(Math.PI / 2);
    const glowGeo = new THREE.CylinderGeometry(0.022, 0.01, 1, 6);
    glowGeo.rotateX(Math.PI / 2);

    for (let i = 0; i < TRACER_POOL_SIZE; i++) {
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.95,
      });
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      const grp = new THREE.Group();
      grp.add(coreMesh, glowMesh);
      grp.visible = false;
      vfxGroup.add(grp);
      tracerPool.push({ group: grp, coreMat, glowMat });
    }

    // 7B. Spinning Brass Shell Casing Pool (24 casings)
    const CASING_POOL_SIZE = 24;
    const casingPool: ShellCasingParticle[] = [];
    const casingGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.028, 8);
    const casingMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.22,
      metalness: 0.92,
    });
    for (let i = 0; i < CASING_POOL_SIZE; i++) {
      const mesh = new THREE.Mesh(casingGeo, casingMat);
      mesh.visible = false;
      vfxGroup.add(mesh);
      casingPool.push({
        mesh,
        active: false,
        ageMs: 0,
        maxAgeMs: 950,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
      });
    }
    let casingCursor = 0;

    const spawnShellCasing = () => {
      const c = casingPool[casingCursor];
      casingCursor = (casingCursor + 1) % CASING_POOL_SIZE;
      const activeRig = weaponModels[simRef.current.player.activeWeapon];
      if (!activeRig) return;

      const worldPos = activeRig.ejectionPortLocal.clone();
      activeRig.gunGroup.localToWorld(worldPos);
      c.mesh.position.copy(worldPos);

      // Eject up and to the right in camera space
      const rightDir = new THREE.Vector3(1, 0.45, -0.15)
        .applyQuaternion(camera.quaternion)
        .normalize();
      const speed = 2.2 + Math.random() * 1.1;
      c.vx = rightDir.x * speed;
      c.vy = rightDir.y * speed + 1.4;
      c.vz = rightDir.z * speed;
      c.rx = (Math.random() - 0.5) * 28;
      c.ry = (Math.random() - 0.5) * 28;
      c.rz = (Math.random() - 0.5) * 28;
      c.ageMs = 0;
      c.maxAgeMs = 900;
      c.active = true;
      c.mesh.visible = true;
    };

    // 7C. 3D Impact Sparks, Concrete Dust, Blood & Explosion Particle Pool (96 particles)
    const PARTICLE_POOL_SIZE = 96;
    const particlePool: ImpactParticle[] = [];
    const sparkGeo = new THREE.BoxGeometry(0.045, 0.045, 0.14);
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(sparkGeo, mat);
      mesh.visible = false;
      vfxGroup.add(mesh);
      particlePool.push({
        mesh,
        mat,
        active: false,
        ageMs: 0,
        maxAgeMs: 360,
        vx: 0,
        vy: 0,
        vz: 0,
        gravity: 14,
        baseScale: 1,
      });
    }
    let particleCursor = 0;

    const spawnImpactBurst = (
      x: number,
      y: number,
      z: number,
      nx: number,
      ny: number,
      nz: number,
      colorHex: number,
      count: number,
      speedScale = 1,
      scaleMul = 1
    ) => {
      for (let i = 0; i < count; i++) {
        const p = particlePool[particleCursor];
        particleCursor = (particleCursor + 1) % PARTICLE_POOL_SIZE;
        p.active = true;
        p.ageMs = 0;
        p.maxAgeMs = 240 + Math.random() * 240;
        p.mesh.position.set(x + nx * 0.04, y + ny * 0.04, z + nz * 0.04);
        p.mat.color.setHex(colorHex);
        p.mat.opacity = 1;
        p.baseScale = scaleMul * (0.7 + Math.random() * 0.7);
        p.mesh.scale.setScalar(p.baseScale);

        const spd = (3.5 + Math.random() * 6.5) * speedScale;
        p.vx = (nx * 0.75 + (Math.random() - 0.5) * 1.1) * spd;
        p.vy = (ny * 0.75 + Math.random() * 0.9) * spd;
        p.vz = (nz * 0.75 + (Math.random() - 0.5) * 1.1) * spd;
        p.gravity = 15;
        p.mesh.visible = true;
      }
    };

    // 7D. Expanding Surface Impact Shock Rings (20 rings)
    const RING_POOL_SIZE = 20;
    const ringPool: ImpactRingFX[] = [];
    const ringGeo = new THREE.RingGeometry(0.06, 0.12, 16);
    for (let i = 0; i < RING_POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      vfxGroup.add(mesh);
      ringPool.push({
        mesh,
        mat,
        active: false,
        ageMs: 0,
        maxAgeMs: 220,
        maxScale: 2.6,
      });
    }
    let ringCursor = 0;

    // 7E. Surface-Aligned Weapon-Specific Bullet Decals & Blood Splatters (48 decals)
    const DECAL_POOL_SIZE = 48;
    const decalPool: BulletDecalFX[] = [];
    const decalGeo = new THREE.PlaneGeometry(0.22, 0.22);
    for (let i = 0; i < DECAL_POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: texSet.bulletHoleRifleMap,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
      });
      const mesh = new THREE.Mesh(decalGeo, mat);
      mesh.visible = false;
      vfxGroup.add(mesh);
      decalPool.push({ mesh, mat, active: false });
    }
    let decalCursor = 0;

    let highestProcessedTraceId = 0;
    const normalVec = new THREE.Vector3();
    const defaultForward = new THREE.Vector3(0, 0, 1);
    const decalRaycaster = new THREE.Raycaster();
    const rayOriginVec = new THREE.Vector3();
    const rayDirVec = new THREE.Vector3();

    const getWeaponDecalTextureAndScale = (weaponId?: WeaponId) => {
      if (weaponId === 'awp') {
        return { map: texSet.bulletHoleSniperMap, scale: 1.45 };
      }
      if (weaponId === 'spas12') {
        return { map: texSet.bulletHoleShotgunMap, scale: 1.38 };
      }
      if (weaponId === 'mp5' || weaponId === 'deagle') {
        return { map: texSet.bulletHoleSmgMap, scale: 0.82 };
      }
      return { map: texSet.bulletHoleRifleMap, scale: 1.05 };
    };

    const spawnTraceImpactVFX = (
      fromX: number,
      fromY: number,
      fromZ: number,
      x: number,
      y: number,
      z: number,
      nx: number,
      ny: number,
      nz: number,
      hitKind: 'wall' | 'enemy' | 'headshot' | 'prop' | 'sky',
      weaponId?: WeaponId,
      isEnemyShot?: boolean
    ) => {
      if (hitKind === 'sky') return;

      normalVec.set(nx, ny, nz).normalize();

      // 1. Expanding Shockwave / Blood Mist Ring at Impact Point
      const ring = ringPool[ringCursor];
      ringCursor = (ringCursor + 1) % RING_POOL_SIZE;
      ring.active = true;
      ring.ageMs = 0;
      ring.maxAgeMs =
        hitKind === 'headshot' ? 320 : hitKind === 'enemy' ? 260 : 190;
      ring.maxScale =
        hitKind === 'headshot' ? 4.2 : hitKind === 'enemy' ? 3.1 : 2.3;
      ring.mat.color.setHex(
        hitKind === 'headshot'
          ? 0xdc2626
          : hitKind === 'enemy'
          ? 0xb91c1c
          : 0xfde047
      );
      ring.mesh.position.set(x + nx * 0.03, y + ny * 0.03, z + nz * 0.03);
      ring.mesh.quaternion.setFromUnitVectors(defaultForward, normalVec);
      ring.mesh.scale.setScalar(0.35);
      ring.mesh.visible = true;

      // 2. Directional Sparks / Realistic Blood Burst / Surface-Verified Bullet Decals
      if (hitKind === 'wall' || hitKind === 'prop') {
        spawnImpactBurst(x, y, z, nx, ny, nz, 0xfbbf24, isLow ? 4 : 8, 1.0, 0.9);
        spawnImpactBurst(x, y, z, nx, ny, nz, 0x94a3b8, isLow ? 2 : 4, 0.55, 1.2);

        // Place weapon-specific bullet mark ONLY on verified visible static 3D map meshes (NEVER in air or on breakable props)
        if (hitKind === 'wall' && !isEnemyShot) {
          rayOriginVec.set(fromX, fromY, fromZ);
          rayDirVec.set(x - fromX, y - fromY, z - fromZ);
          const rayLen = rayDirVec.length();
          if (rayLen > 0.05) {
            rayDirVec.divideScalar(rayLen);
            decalRaycaster.near = 0.01;
            decalRaycaster.far = rayLen + 1.5;
            decalRaycaster.set(rayOriginVec, rayDirVec);
            const hits = decalRaycaster.intersectObjects(mapGroup.children, true);
            const validHit = hits.find(
              (h) => h.face && h.distance <= rayLen + 0.65 && h.object.visible
            );
            if (validHit && validHit.face) {
              const surfNormal = validHit.face.normal
                .clone()
                .transformDirection(validHit.object.matrixWorld)
                .normalize();
              const dec = decalPool[decalCursor];
              decalCursor = (decalCursor + 1) % DECAL_POOL_SIZE;
              const { map, scale } = getWeaponDecalTextureAndScale(weaponId);
              dec.mat.map = map;
              dec.mat.opacity = 0.94;
              dec.mat.needsUpdate = true;
              dec.active = true;
              dec.mesh.position
                .copy(validHit.point)
                .addScaledVector(surfNormal, 0.008);
              dec.mesh.quaternion.setFromUnitVectors(defaultForward, surfNormal);
              dec.mesh.rotateZ(Math.random() * Math.PI * 2);
              dec.mesh.scale.setScalar(scale * (0.9 + Math.random() * 0.2));
              dec.mesh.visible = true;
            }
          }
        }
      } else if (hitKind === 'headshot' || hitKind === 'enemy') {
        const isHs = hitKind === 'headshot';
        // High-density multi-shade 3D blood splatter & mist burst
        spawnImpactBurst(
          x,
          y,
          z,
          nx,
          ny,
          nz,
          0xdc2626,
          isLow ? 8 : isHs ? 18 : 12,
          isHs ? 1.25 : 0.95,
          isHs ? 1.35 : 1.1
        );
        spawnImpactBurst(
          x,
          y,
          z,
          nx * 0.5,
          ny + 0.35,
          nz * 0.5,
          0x7f1d1d,
          isLow ? 5 : isHs ? 12 : 8,
          0.7,
          1.45
        );
        if (isHs) {
          spawnImpactBurst(x, y, z, nx, ny, nz, 0xfef08a, isLow ? 4 : 7, 1.3, 0.95);
        }

        // Project a realistic crimson blood splatter decal onto the arena floor beneath the hit
        const dec = decalPool[decalCursor];
        decalCursor = (decalCursor + 1) % DECAL_POOL_SIZE;
        dec.mat.map = texSet.bloodSplatterMap;
        dec.mat.opacity = 0.88;
        dec.mat.needsUpdate = true;
        dec.active = true;
        dec.mesh.position.set(
          x + (Math.random() - 0.5) * 0.35,
          0.012,
          z + (Math.random() - 0.5) * 0.35
        );
        normalVec.set(0, 1, 0);
        dec.mesh.quaternion.setFromUnitVectors(defaultForward, normalVec);
        dec.mesh.rotateZ(Math.random() * Math.PI * 2);
        dec.mesh.scale.setScalar((isHs ? 2.4 : 1.75) * (0.85 + Math.random() * 0.3));
        dec.mesh.visible = true;
      }
    };

    // 8. Keyboard & Mouse Desktop Input Listeners
    const keysDown = new Set<string>();
    let mouseLookDeltaX = 0;
    let mouseLookDeltaY = 0;
    let mouseFireHeld = false;
    let mouseFireJustPressed = false;
    let mouseAdsHeld = false;
    let jumpQueued = false;
    let crouchToggleQueued = false;
    let slideQueued = false;
    let reloadQueued = false;
    let queuedWeaponSelect: WeaponId | null = null;
    let queuedWeaponCycle = 0;
    let hitMarkerTimerMs = 0;

    // Weapon viewmodel spring sway, smooth locomotion blend, wall contact & micro-animation state
    let swayYaw = 0;
    let swayPitch = 0;
    let swayRoll = 0;
    let strafeRoll = 0;
    let landDipY = 0;
    let landRollImpulse = 0;
    let jumpImpulseY = 0;
    let airborneLift = 0;
    let airbornePitch = 0;
    let wasGrounded = true;
    let sprintBlend = 0;
    let slideBlend = 0;
    let moveBobBlend = 0;
    let wallObstructionBlend = 0;
    let wallTouchImpulse = 0;
    let triggerPullBlend = 0;
    let inspectBreathPhase = 0;

    // Pre-allocated scratch vectors for 60fps tracer loop (zero GC churn)
    const tracerStartVec = new THREE.Vector3();
    const tracerEndVec = new THREE.Vector3();
    const tracerMidVec = new THREE.Vector3();

    // HUD dirty-check cache to prevent redundant DOM style/text writes at 60fps
    let lastHpPctStr = '';
    let lastHpTextStr = '';
    let lastSlot1Text = '';
    let lastSlot2Text = '';
    let lastKillsText = '';
    let lastBotKillsText = '';
    let lastTimerText = '';
    let lastScopeOpacityStr = '';
    let lastChOpacityStr = '';
    let lastSlideOpacityStr = '';
    let lastHitMarkerOpacityStr = '';
    let lastHurtOpacityStr = '';

    const onKeyDown = (e: KeyboardEvent) => {
      if (screenStateRef.current !== 'combat') return;
      keysDown.add(e.code);

      const kb = settingsRef.current.keybindings;
      if (e.code === kb.jump) jumpQueued = true;
      if (e.code === kb.crouch || e.code === 'KeyC') crouchToggleQueued = true;
      if (e.code === kb.slide || e.code === 'KeyV') slideQueued = true;
      if (e.code === kb.reload || e.code === 'KeyR') reloadQueued = true;
      if (e.code === kb.nextWeapon || e.code === 'KeyQ') queuedWeaponCycle = 1;

      const pair = simRef.current.player.loadoutWeapons;
      if (e.code === 'Digit1') queuedWeaponSelect = pair[0];
      if (e.code === 'Digit2') queuedWeaponSelect = pair[1];
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.code);
    };

    let mouseLookDragHeld = false;
    let lastMousePos: { x: number; y: number } | null = null;

    const onMouseDown = (e: MouseEvent) => {
      if (screenStateRef.current !== 'combat' || loadoutOverlayOpenRef.current) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.closest('button, input, label, [role="button"], [role="dialog"], [data-ui-interactive="true"]')
      ) {
        return;
      }

      lastMousePos = { x: e.clientX, y: e.clientY };
      mouseLookDragHeld = true;

      if (e.button === 2) {
        mouseAdsHeld = true;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseFireHeld = false;
      if (e.button === 2) mouseAdsHeld = false;
      if (e.buttons === 0) {
        mouseLookDragHeld = false;
        lastMousePos = null;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (screenStateRef.current !== 'combat' || loadoutOverlayOpenRef.current) return;
      if (document.pointerLockElement === renderer.domElement) {
        mouseLookDeltaX += e.movementX;
        mouseLookDeltaY += e.movementY;
      } else if (mouseLookDragHeld || mouseFireHeld || e.buttons > 0) {
        // Avoid double-applying delta when CombatHUD window pointer tracking is already active
        const touch = touchInputRef.current;
        if (touch.cameraDeltaX === 0 && touch.cameraDeltaY === 0) {
          if (lastMousePos) {
            let dx = e.clientX - lastMousePos.x;
            let dy = e.clientY - lastMousePos.y;
            if (dx === 0 && typeof e.movementX === 'number' && Math.abs(e.movementX) > 0) {
              dx = e.movementX;
            }
            if (dy === 0 && typeof e.movementY === 'number' && Math.abs(e.movementY) > 0) {
              dy = e.movementY;
            }
            mouseLookDeltaX += dx * 1.35;
            mouseLookDeltaY += dy * 1.35;
          } else {
            mouseLookDeltaX += e.movementX * 1.35;
            mouseLookDeltaY += e.movementY * 1.35;
          }
        }
        lastMousePos = { x: e.clientX, y: e.clientY };
      } else {
        lastMousePos = { x: e.clientX, y: e.clientY };
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (screenStateRef.current !== 'combat') return;
      if (Math.abs(e.deltaY) > 4) {
        queuedWeaponCycle = e.deltaY > 0 ? 1 : -1;
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      if (screenStateRef.current === 'combat') {
        e.preventDefault();
      }
    };

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('resize', onResize);

    // 9. Main 60fps Game Loop
    let rafId = 0;
    let lastTime = performance.now();

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      const dtMs = dt * 1000;

      const sim = simRef.current;

      if (currentBuiltArenaId !== arenaIdRef.current) {
        buildArenaGeometry(arenaIdRef.current);
        propMeshes.forEach((m) => propsGroup.remove(m));
        propMeshes.clear();
      }

      if (screenStateRef.current === 'combat' && !loadoutOverlayOpenRef.current) {
        const kb = settingsRef.current.keybindings;
        const touch = touchInputRef.current;

        let moveX = touch.moveX;
        let moveZ = touch.moveZ;
        if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) moveX -= 1;
        if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) moveX += 1;
        if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) moveZ -= 1;
        if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) moveZ += 1;
        moveX = Math.max(-1, Math.min(1, moveX));
        moveZ = Math.max(-1, Math.min(1, moveZ));

        const sprintHeld =
          keysDown.has(kb.sprint) || keysDown.has('ShiftLeft') || touch.sprint;

        const sensMult = settingsRef.current.touchSensitivity ?? 1.0;
        const fireSensMult = settingsRef.current.fireSensitivity ?? 0.45;
        const activeSpec = WEAPON_REGISTRY[sim.player.activeWeapon];
        const adsSensFactor = getScopeSensitivityMultiplier(
          sim.player.activeWeapon,
          sim.player.adsBlend
        );

        // Separate Camera Free-Look Sensitivity vs Fire-Button Joystick Aim Sensitivity
        // Both scale down smoothly when scoped in based on optic magnification (adsSensFactor)
        const mouseSens = 0.0026 * sensMult * adsSensFactor;
        const touchSens = 0.0056 * sensMult * adsSensFactor;
        const fireSens = 0.0024 * fireSensMult * adsSensFactor;

        const lookYawDelta =
          mouseLookDeltaX * mouseSens +
          (touch.cameraDeltaX || 0) * touchSens +
          (touch.attackDragX || 0) * fireSens;
        const lookPitchDelta =
          mouseLookDeltaY * mouseSens +
          (touch.cameraDeltaY || 0) * touchSens +
          (touch.attackDragY || 0) * fireSens;

        mouseLookDeltaX = 0;
        mouseLookDeltaY = 0;
        touch.attackDragX = 0;
        touch.attackDragY = 0;
        touch.cameraDeltaX = 0;
        touch.cameraDeltaY = 0;

        // Accumulate smooth weapon rotational sway & axial wrist roll inertia
        const weightFactor =
          sim.player.activeWeapon === 'awp' || sim.player.activeWeapon === 'spas12'
            ? 1.25
            : sim.player.activeWeapon === 'mp5' || sim.player.activeWeapon === 'deagle'
            ? 0.82
            : 1.0;
        swayYaw = THREE.MathUtils.clamp(
          swayYaw + lookYawDelta * 0.48 * weightFactor,
          -0.15,
          0.15
        );
        swayPitch = THREE.MathUtils.clamp(
          swayPitch + lookPitchDelta * 0.48 * weightFactor,
          -0.13,
          0.13
        );
        swayRoll = THREE.MathUtils.clamp(
          swayRoll - lookYawDelta * 0.62 * weightFactor,
          -0.18,
          0.18
        );

        const fireJustPressed = mouseFireJustPressed || touch.lightPressed;
        const fireHeld = mouseFireHeld || touch.lightHeld;
        const adsHeld =
          mouseAdsHeld || keysDown.has(kb.ads) || Boolean(touch.aimHeld);
        const jumpPressed = jumpQueued || touch.jumpPressed;
        const reloadPressed = reloadQueued || touch.heavyPressed;
        const crouchToggled = crouchToggleQueued || touch.dodgePressed;
        const slidePressed = slideQueued || Boolean(touch.slidePressed);

        if (touch.selectedWeapon) {
          queuedWeaponSelect = touch.selectedWeapon;
          touch.selectedWeapon = undefined;
        }

        mouseFireJustPressed = false;
        jumpQueued = false;
        reloadQueued = false;
        crouchToggleQueued = false;
        slideQueued = false;
        touch.lightPressed = false;
        touch.jumpPressed = false;
        touch.heavyPressed = false;
        touch.dodgePressed = false;
        touch.slidePressed = false;

        const inputSnap: PlayerInputSnapshot = {
          moveX,
          moveZ,
          lookDeltaYaw: lookYawDelta,
          lookDeltaPitch: lookPitchDelta,
          sprintHeld,
          jumpPressed,
          crouchToggled,
          slidePressed,
          fireHeld,
          fireJustPressed,
          adsHeld,
          reloadPressed,
          selectWeapon: queuedWeaponSelect,
          cycleWeaponDelta: queuedWeaponCycle,
        };
        queuedWeaponSelect = null;
        queuedWeaponCycle = 0;

        const prevRoundOver = sim.roundOver;
        const events = stepSimulation(
          sim,
          dt,
          inputSnap,
          botDifficultyRef.current,
          gameModeRef.current === 'training',
          trainingConfigRef.current
        );

        for (const evt of events) {
          if (evt.type === 'shot_fired') {
            const wSpec = WEAPON_REGISTRY[evt.weaponId || sim.player.activeWeapon];
            soundEngine.play(wSpec ? wSpec.soundId : 'shot_m4a1');
            spawnShellCasing();
          } else if (evt.type === 'headshot') {
            soundEngine.play('headshot');
            hitMarkerTimerMs = 190;
            onCombatEventRef.current(evt);
          } else if (evt.type === 'hit_body') {
            soundEngine.play('hit_marker');
            hitMarkerTimerMs = 130;
          } else if (evt.type === 'enemy_killed') {
            soundEngine.play('ko');
            onCombatEventRef.current(evt);
          } else if (evt.type === 'wave_clear' || evt.type === 'player_respawn') {
            soundEngine.play('ui_confirm');
            onCombatEventRef.current(evt);
          } else if (evt.type === 'footstep') {
            soundEngine.playFootstep(
              evt.surface || sim.player.currentSurface,
              evt.stepIntensity || 'walk',
              sim.player.footstepCount
            );
          } else if (evt.type === 'slide_start') {
            soundEngine.play('ui_click');
          } else if (evt.type === 'barrel_explode') {
            soundEngine.play('ko');
            if (evt.x !== undefined && evt.z !== undefined) {
              spawnImpactBurst(evt.x, 1.0, evt.z, 0, 1, 0, 0xf97316, 22, 1.8, 2.2);
              spawnImpactBurst(evt.x, 1.0, evt.z, 0, 1, 0, 0xfef08a, 14, 1.4, 1.8);
            }
            onCombatEventRef.current(evt);
          } else if (evt.type === 'reload_start') {
            soundEngine.play('reload_start');
          } else if (evt.type === 'reload_done') {
            soundEngine.play('reload_done');
          } else if (evt.type === 'player_hurt') {
            soundEngine.play('hit_heavy');
          }
        }

        if (!prevRoundOver && sim.roundOver && sim.roundWinner) {
          onRoundFinishedRef.current(sim.roundWinner);
        }

        // Spawn 3D surface impact VFX for any newly created bullet traces
        for (const tr of sim.traces) {
          if (tr.id > highestProcessedTraceId) {
            highestProcessedTraceId = tr.id;
            spawnTraceImpactVFX(
              tr.fromX,
              tr.fromY,
              tr.fromZ,
              tr.toX,
              tr.toY,
              tr.toZ,
              tr.hitNormalX,
              tr.hitNormalY,
              tr.hitNormalZ,
              tr.hitKind,
              tr.weaponId,
              tr.isEnemyShot
            );
          }
        }

        // Update Camera Position, FOV Zoom (ADS + Slide Surge), Jump/Landing Weight & Trauma Shake
        const p = sim.player;
        if (wasGrounded && !p.isGrounded && p.vy > 1.0) {
          // Jump takeoff push-off dip
          jumpImpulseY = -0.032;
          landRollImpulse = 0.035;
        } else if (!wasGrounded && p.isGrounded) {
          // Heavy two-stage shock-absorber landing dip & wrist roll bounce
          landDipY = -0.068;
          landRollImpulse = -0.055;
        }
        wasGrounded = p.isGrounded;
        landDipY *= Math.exp(-13 * dt);
        jumpImpulseY *= Math.exp(-15 * dt);
        landRollImpulse *= Math.exp(-11 * dt);

        const targetAirLift = !p.isGrounded
          ? THREE.MathUtils.clamp(p.vy * 0.0042, -0.026, 0.026)
          : 0;
        const targetAirPitch = !p.isGrounded
          ? THREE.MathUtils.clamp(-p.vy * 0.016, -0.11, 0.11)
          : 0;
        airborneLift += (targetAirLift - airborneLift) * Math.min(1, dt * 12);
        airbornePitch += (targetAirPitch - airbornePitch) * Math.min(1, dt * 12);

        const baseFov = p.isSliding ? 84 : 78;
        const targetFov = THREE.MathUtils.lerp(baseFov, activeSpec.adsFov, p.adsBlend);
        if (Math.abs(camera.fov - targetFov) > 0.05) {
          camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 18);
          camera.updateProjectionMatrix();
        }

        const moveSpeed = Math.hypot(p.vx, p.vz);
        const targetMoveBob =
          p.isGrounded && !p.isSliding ? Math.min(1, moveSpeed / 5.2) : 0;
        moveBobBlend += (targetMoveBob - moveBobBlend) * Math.min(1, dt * 11);

        inspectBreathPhase += dt * (p.isSprinting ? 4.2 : 1.85);
        const idleBreathX =
          Math.cos(inspectBreathPhase * 0.9) * 0.0028 * (1 - p.adsBlend * 0.85);
        const idleBreathY =
          (Math.sin(inspectBreathPhase * 1.6) * 0.0042 +
            Math.sin(inspectBreathPhase * 3.2) * 0.0009) *
          (1 - p.adsBlend * 0.85);

        const bobX =
          Math.cos(p.walkBobPhase * 0.5) *
            0.032 *
            moveBobBlend *
            (1 - p.adsBlend * 0.75) +
          idleBreathX * (1 - moveBobBlend);
        const bobY =
          Math.sin(p.walkBobPhase) *
            0.042 *
            moveBobBlend *
            (1 - p.adsBlend * 0.75) +
          idleBreathY * (1 - moveBobBlend);

        // Reload camera micro-nods synchronized with mag drop, mag slam & bolt rack
        let reloadCamPitch = 0;
        let reloadCamRoll = 0;
        if (p.isReloading) {
          const rTotal = WEAPON_REGISTRY[p.activeWeapon].reloadTimeMs;
          const rProg = 1 - p.reloadTimerMs / Math.max(1, rTotal);
          if (rProg < 0.34) {
            const s = Math.sin((rProg / 0.34) * Math.PI);
            reloadCamPitch = -0.018 * s;
            reloadCamRoll = 0.015 * s;
          } else if (rProg < 0.72) {
            const t = (rProg - 0.34) / 0.38;
            if (t > 0.72) {
              const slam = Math.sin(((t - 0.72) / 0.28) * Math.PI);
              reloadCamPitch = 0.026 * slam;
              reloadCamRoll = -0.018 * slam;
            }
          } else {
            const t = (rProg - 0.72) / 0.28;
            const rack = Math.sin(t * Math.PI);
            reloadCamPitch = -0.016 * rack;
            reloadCamRoll = -0.022 * rack;
          }
        }

        const shakeMag = sim.cameraShakeTrauma * sim.cameraShakeTrauma * 0.12;
        const shakeYaw = (Math.random() - 0.5) * shakeMag;
        const shakePitch = (Math.random() - 0.5) * shakeMag;

        // Apply bobX along camera's local right axis and clamp camera outside all walls
        const camRightX = Math.cos(p.yaw);
        const camRightZ = -Math.sin(p.yaw);
        const arenaDefNow =
          ARENA_REGISTRY[sim.arenaId] || ARENA_REGISTRY.foundry_arena;
        const safeCamXZ = resolveEntityCollisions(
          p.x + camRightX * bobX,
          p.z + camRightZ * bobX,
          PLAYER_COLLISION_RADIUS,
          arenaDefNow,
          sim.breakableProps
        );

        camera.position.set(
          safeCamXZ.x,
          p.y + p.eyeHeight + bobY + landDipY + jumpImpulseY,
          safeCamXZ.z
        );
        camera.rotation.y = p.yaw + p.recoilKickYaw + shakeYaw;
        camera.rotation.x = THREE.MathUtils.clamp(
          p.pitch + p.recoilKickPitch + shakePitch + reloadCamPitch,
          -1.42,
          1.42
        );

        // Decay weapon sway, axial roll inertia & strafe/slide banking
        swayYaw *= Math.exp(-10 * dt);
        swayPitch *= Math.exp(-10 * dt);
        swayRoll *= Math.exp(-12 * dt);
        const slideRollTarget = p.isSliding ? 0.14 : 0;
        const targetStrafeRoll =
          moveX * 0.055 * (1 - p.adsBlend * 0.65) + slideRollTarget;
        strafeRoll += (targetStrafeRoll - strafeRoll) * Math.min(1, dt * 12);
        camera.rotation.z =
          -strafeRoll * 0.45 + reloadCamRoll + landRollImpulse * 0.4;

        // Update First-Person Weapon Viewmodel Kinematics & Smooth Two-Stage Swap + Reload Animations
        const swapTotalMs = p.weaponSwitchDurationMs || 340;
        const swapHalfMs = swapTotalMs * 0.5;
        const isFirstHalfSwap =
          p.weaponSwitchTimerMs > swapHalfMs &&
          p.previousWeapon &&
          p.previousWeapon !== p.activeWeapon;
        const displayedWeaponId: WeaponId = isFirstHalfSwap
          ? (p.previousWeapon as WeaponId)
          : p.activeWeapon;

        for (const wid of WEAPON_ORDER) {
          const vm = weaponModels[wid];
          const isDisplayed = wid === displayedWeaponId;
          // Hide viewmodel when deeply scoped so circular optical reticle overlay has unobstructed view
          vm.root.visible = isDisplayed && p.adsBlend < 0.72;

          if (isDisplayed) {
            const hipX = 0.23;
            const hipY = -0.21;
            const hipZ = -0.42;
            const adsX = 0.0;
            const adsY = wid === 'ak47' ? -0.115 : -0.122;
            const adsZ = -0.31;

            // Smooth Two-Stage Weapon Swap Kinematics (1: Holster Outgoing -> 2: Draw Incoming)
            let switchOffsetX = 0;
            let switchDrop = 0;
            let switchOffsetZ = 0;
            let switchRotX = 0;
            let switchRotY = 0;
            let switchRotZ = 0;

            if (p.weaponSwitchTimerMs > 0) {
              if (isFirstHalfSwap) {
                // Stage 1: Lower & tilt outgoing weapon smoothly down-left
                const t = 1 - (p.weaponSwitchTimerMs - swapHalfMs) / swapHalfMs;
                const ease = t * t * (3 - 2 * t);
                switchOffsetX = -0.09 * ease;
                switchDrop = -0.29 * ease;
                switchOffsetZ = 0.08 * ease;
                switchRotX = -0.62 * ease;
                switchRotY = 0.34 * ease;
                switchRotZ = 0.42 * ease;
              } else {
                // Stage 2: Draw incoming weapon up from right hip with damped spring arc
                const t = p.weaponSwitchTimerMs / swapHalfMs;
                const ease = t * t;
                const flourish = Math.sin((1 - t) * Math.PI);
                switchOffsetX = 0.08 * ease;
                switchDrop = -0.28 * ease + 0.018 * flourish;
                switchOffsetZ = 0.09 * ease;
                switchRotX = -0.58 * ease + 0.08 * flourish;
                switchRotY = -0.28 * ease;
                switchRotZ = -0.46 * ease + 0.12 * flourish;
              }
            }

            // Multi-Phase Realistic Reload Animation (1: Tilt & Drop Mag -> 2: Slam New Mag -> 3: Rack Bolt)
            let reloadOffsetX = 0;
            let reloadOffsetY = 0;
            let reloadRotX = 0;
            let reloadRotY = 0;
            let reloadRotZ = 0;
            let reloadBoltPull = 0;

            if (p.isReloading) {
              const reloadTotal = WEAPON_REGISTRY[wid].reloadTimeMs;
              const progress = 1 - p.reloadTimerMs / Math.max(1, reloadTotal);

              if (progress < 0.34) {
                // Phase 1: Tilt rifle & drop spent magazine out of magwell
                const t = progress / 0.34;
                const ease = Math.sin(t * (Math.PI * 0.5));
                reloadOffsetX = -0.05 * ease;
                reloadOffsetY = -0.06 * ease;
                reloadRotX = 0.28 * ease;
                reloadRotY = 0.22 * ease;
                reloadRotZ = 0.48 * ease;
                vm.magazine.position.set(
                  vm.magBasePos.x - 0.02 * ease,
                  vm.magBasePos.y - 0.24 * t * t,
                  vm.magBasePos.z + 0.03 * ease
                );
              } else if (progress < 0.72) {
                // Phase 2: Insert fresh magazine & slam upward into receiver
                const t = (progress - 0.34) / 0.38;
                const slamImpulse = t > 0.75 ? Math.sin(((t - 0.75) / 0.25) * Math.PI) * 0.035 : 0;
                reloadOffsetX = -0.05;
                reloadOffsetY = -0.06 + slamImpulse;
                reloadRotX = 0.28 - slamImpulse * 2.2;
                reloadRotY = 0.22;
                reloadRotZ = 0.48;
                const magLift = (1 - Math.min(1, t / 0.78)) * -0.24;
                vm.magazine.position.set(
                  vm.magBasePos.x,
                  vm.magBasePos.y + magLift,
                  vm.magBasePos.z
                );
              } else {
                // Phase 3: Rack bolt carrier / charging handle and settle back to shoulder
                const t = (progress - 0.72) / 0.28;
                const returnEase = 1 - t;
                const rackWave = Math.sin(t * Math.PI);
                reloadOffsetX = -0.05 * returnEase;
                reloadOffsetY = -0.06 * returnEase - 0.02 * rackWave;
                reloadRotX = 0.28 * returnEase + 0.14 * rackWave;
                reloadRotY = 0.22 * returnEase - 0.12 * rackWave;
                reloadRotZ = 0.48 * returnEase - 0.18 * rackWave;
                reloadBoltPull = rackWave * 0.065;
                vm.magazine.position.copy(vm.magBasePos);
              }
            } else {
              vm.magazine.position.copy(vm.magBasePos);
            }

            // Smooth Interpolated Tactical Sprint & Slide Canted Poses (eliminates instant snap/teleport)
            const isSprintingPose =
              p.isSprinting &&
              moveSpeed > 5.2 &&
              !p.isAds &&
              !p.isSliding &&
              p.fireCooldownMs <= 0 &&
              !p.isReloading &&
              p.weaponSwitchTimerMs <= 0;
            const targetSprint = isSprintingPose ? 1 : 0;
            const targetSlide = p.isSliding && !p.isAds ? 1 : 0;
            // Smooth exponential damping into and out of running & sliding stances
            sprintBlend += (targetSprint - sprintBlend) * Math.min(1, dt * 10.5);
            slideBlend += (targetSlide - slideBlend) * Math.min(1, dt * 12.0);

            const sprintEase = sprintBlend * sprintBlend * (3 - 2 * sprintBlend);
            const slideEase = slideBlend * slideBlend * (3 - 2 * slideBlend);

            // Subtle rhythmic chest-carry stride oscillation while running
            const sprintSwingX = Math.cos(p.walkBobPhase * 0.5) * 0.022 * sprintEase;
            const sprintSwingY = Math.abs(Math.sin(p.walkBobPhase * 0.5)) * -0.018 * sprintEase;
            const sprintSwingRotY = Math.cos(p.walkBobPhase * 0.5) * 0.055 * sprintEase;
            const sprintSwingRotZ = Math.sin(p.walkBobPhase * 0.5) * 0.04 * sprintEase;

            // Universal 3D Weapon Wall-Obstruction & Physical Wall-Brace Kinematics
            const liveWallObs = computeWeaponWallObstruction(
              p,
              arenaDefNow,
              sim.breakableProps
            ).obstruction;
            const prevWallBlend = wallObstructionBlend;
            wallObstructionBlend +=
              (liveWallObs - wallObstructionBlend) * Math.min(1, dt * 16.0);
            if (prevWallBlend < 0.08 && wallObstructionBlend >= 0.08) {
              // Tactile barrel-to-wall contact bump micro-impulse
              wallTouchImpulse = 1.0;
            }
            wallTouchImpulse *= Math.exp(-14 * dt);

            const wallEase =
              wallObstructionBlend *
              wallObstructionBlend *
              (3 - 2 * wallObstructionBlend);
            const wallBrace =
              wallObstructionBlend > 0.32
                ? (wallObstructionBlend - 0.32) / 0.68
                : 0;
            const wallBumpWave = Math.sin(wallTouchImpulse * Math.PI) * 0.022;

            // Retract weapon backward into shoulder on initial contact, then pivot into Tactical High-Port Wall Brace
            const wallShiftX = -wallEase * 0.08 * (1 - p.adsBlend * 0.6);
            const wallLiftY =
              (wallEase * 0.055 + wallBrace * 0.045) * (1 - p.adsBlend * 0.65);
            const wallRetractZ = wallEase * 0.34 + wallBumpWave;
            const wallRotX =
              (wallBrace * 0.62 + wallBumpWave * 1.8) * (1 - p.adsBlend * 0.65);
            const wallRotY =
              (wallEase * 0.22 + wallBrace * 0.38) * (1 - p.adsBlend * 0.65);
            const wallRotZ = -wallBrace * 0.26 * (1 - p.adsBlend * 0.65);

            const recoilBack = Math.min(0.085, p.recoilKickPitch * 0.42);
            const posX =
              THREE.MathUtils.lerp(hipX, adsX, p.adsBlend) +
              switchOffsetX +
              reloadOffsetX -
              swayYaw * 0.45 -
              sprintEase * 0.06 +
              sprintSwingX -
              slideEase * 0.05 +
              bobX * 0.32 +
              wallShiftX;
            const posY =
              THREE.MathUtils.lerp(hipY, adsY, p.adsBlend) +
              switchDrop +
              reloadOffsetY +
              (landDipY + jumpImpulseY) * 0.68 +
              airborneLift +
              swayPitch * 0.35 -
              sprintEase * 0.05 +
              sprintSwingY -
              slideEase * 0.04 +
              bobY * 0.48 +
              wallLiftY;
            const posZ =
              THREE.MathUtils.lerp(hipZ, adsZ, p.adsBlend) +
              switchOffsetZ +
              recoilBack -
              sprintEase * 0.025 +
              wallRetractZ;

            vm.root.position.set(posX, posY, posZ);
            vm.root.rotation.set(
              p.recoilKickPitch * 0.68 +
                reloadRotX +
                switchRotX +
                swayPitch +
                airbornePitch -
                sprintEase * 0.22 +
                slideEase * 0.12 +
                wallRotX,
              reloadRotY +
                switchRotY -
                swayYaw +
                sprintEase * 0.48 +
                sprintSwingRotY +
                slideEase * 0.18 +
                wallRotY,
              reloadRotZ +
                switchRotZ -
                strafeRoll +
                swayRoll +
                landRollImpulse +
                sprintEase * 0.18 +
                sprintSwingRotZ +
                slideEase * 0.52 +
                wallRotZ
            );

            // Articulated Trigger Squeeze Micro-Animation on Every Shot
            const targetTrigger =
              fireHeld || p.muzzleFlashTimerMs > 0 ? 1.0 : 0.0;
            triggerPullBlend +=
              (targetTrigger - triggerPullBlend) * Math.min(1, dt * 28);
            vm.triggerBlade.position.z =
              vm.triggerBaseZ + triggerPullBlend * 0.0075;
            vm.triggerBlade.rotation.x = 0.35 + triggerPullBlend * 0.36;

            // Articulated Fire-Selector Switch Flick during Weapon Draw
            const drawSelectorFlick =
              p.weaponSwitchTimerMs > 0 && !isFirstHalfSwap
                ? Math.sin((p.weaponSwitchTimerMs / swapHalfMs) * Math.PI) * 0.65
                : 0;
            vm.fireSelector.rotation.x =
              (WEAPON_REGISTRY[wid].autoFire ? 0.45 : 0.0) - drawSelectorFlick;

            // Reciprocating Slide / Bolt Kickback on Every Shot + Last-Round Bolt Lock + Reload Bolt Rack
            const ammoState = p.weapons[wid];
            const emptyLockBack =
              ammoState && ammoState.mag === 0 && !p.isReloading ? 0.036 : 0;
            const shotKick =
              p.muzzleFlashTimerMs > 0
                ? 0.048
                : Math.min(0.038, p.recoilKickPitch * 0.25);
            vm.slideOrBolt.position.z =
              vm.slideBaseZ + Math.max(shotKick, reloadBoltPull, emptyLockBack);

            // SPAS-12 Pump-Action Foregrip Rack Animation
            if (vm.pumpGrip && wid === 'spas12') {
              const cdRatio = p.fireCooldownMs / Math.max(1, WEAPON_REGISTRY.spas12.fireIntervalMs);
              const pumpShift =
                cdRatio > 0.25 && cdRatio < 0.85
                  ? Math.sin(((cdRatio - 0.25) / 0.6) * Math.PI) * 0.075
                  : reloadBoltPull;
              vm.pumpGrip.position.z = vm.pumpBaseZ + pumpShift;
            }

            // 3-Axis Muzzle Flash & Dynamic Muzzle PointLight
            const showFlash = p.muzzleFlashTimerMs > 0;
            vm.muzzleFlashGroup.visible = showFlash;
            if (showFlash) {
              vm.muzzleFlashGroup.rotation.z = Math.random() * Math.PI * 2;
              const fScale = 0.85 + Math.random() * 0.45;
              vm.muzzleFlashGroup.scale.setScalar(fScale);
              muzzlePointLight.intensity = 4.2;
            } else {
              muzzlePointLight.intensity = Math.max(
                0,
                muzzlePointLight.intensity - dt * 38
              );
            }
          }
        }
      } else {
        // Cinematic Orbit Camera on Menu / Lobby Screens
        const orbitAngle = now * 0.00022;
        camera.position.set(
          Math.cos(orbitAngle) * 34,
          14.5,
          Math.sin(orbitAngle) * 34
        );
        camera.lookAt(0, 2.2, 0);
        viewmodelRig.visible = false;
        muzzlePointLight.intensity = 0;
      }

      if (screenStateRef.current === 'combat') {
        viewmodelRig.visible = true;
      }

      // 10. Sync Breakable Props & Articulated 16-Part Enemy Soldiers
      syncBreakableProps(sim);

      for (const bot of sim.enemies) {
        let rig = enemyRigs.get(bot.id);
        if (!rig) {
          rig = buildDetailedEnemySoldier(bot.archetype, texSet.muzzleFlashMap);
          enemyGroup.add(rig.group);
          enemyRigs.set(bot.id, rig);
        }

        if (bot.state === 'ko' && bot.koTimerMs <= 0) {
          rig.group.visible = false;
          continue;
        }

        rig.group.visible = true;
        const speed = Math.hypot(bot.vx, bot.vz);
        const stride = Math.sin(bot.walkCycle * 1.45);
        const gaitBounce =
          bot.state === 'ko' ? 0 : Math.abs(Math.cos(bot.walkCycle * 1.45)) * Math.min(1, speed * 0.25) * 0.06;

        rig.group.position.set(bot.x, bot.y + gaitBounce, bot.z);
        rig.group.rotation.y = Math.PI / 2 - bot.yaw;

        if (bot.state === 'ko') {
          // Multi-Stage Articulated 3D Killing / Death Collapse Animation
          const fallProgress = Math.min(1, 1 - Math.max(0, bot.koTimerMs) / 860);
          if (fallProgress < 0.32) {
            // Stage 1: Fatal Impact Stagger & Head/Arm Recoil Snap
            const s = fallProgress / 0.32;
            const snap = Math.sin(s * (Math.PI * 0.5));
            rig.bodyPivot.rotation.x = -0.28 * snap;
            rig.bodyPivot.rotation.z = 0.22 * snap * bot.strafeDir;
            rig.bodyPivot.position.y = -0.08 * snap;
            rig.headGroup.rotation.x = -0.55 * snap;
            rig.leftArmPivot.rotation.z = -0.65 * snap;
            rig.rightArmPivot.rotation.x = -0.35 * snap;
            rig.leftLegPivot.rotation.x = 0.35 * snap;
            rig.rightLegPivot.rotation.x = 0.25 * snap;
          } else {
            // Stage 2: Full Ragdoll Collapse onto the Arena Floor
            const c = (fallProgress - 0.32) / 0.68;
            const ease = c * c * (3 - 2 * c);
            rig.bodyPivot.rotation.x = -0.28 - ease * (Math.PI * 0.48 - 0.28);
            rig.bodyPivot.rotation.z = (0.22 + ease * 0.18) * bot.strafeDir;
            rig.bodyPivot.position.y = -0.08 - ease * 0.68;
            rig.headGroup.rotation.x = -0.55 + ease * 0.25;
            rig.leftArmPivot.rotation.z = -0.65 - ease * 0.45;
            rig.rightArmPivot.rotation.x = -0.35 + ease * 0.85;
            rig.leftLegPivot.rotation.x = 0.35 * (1 - ease);
            rig.rightLegPivot.rotation.x = -0.22 * ease;
          }
          rig.hpBarBg.visible = false;
          rig.hpBarFill.visible = false;
          rig.sniperLaser.visible = false;
          rig.muzzleFlash.visible = false;
        } else {
          rig.bodyPivot.position.y = 0;
          const legAmp = Math.min(0.65, speed * 0.11);
          rig.leftLegPivot.rotation.x = stride * legAmp;
          rig.rightLegPivot.rotation.x = -stride * legAmp;

          // Rich Enemy Micro-Animations: Strafe Banking, Hit-Flinch Twist, Head Scan & Recoil Kick
          const hitFlinchRatio = Math.min(1, bot.hitFlashMs / 110);
          const hitFlinchPitch = -0.22 * hitFlinchRatio;
          const hitFlinchTwist = 0.18 * hitFlinchRatio * bot.strafeDir;
          const fireRecoilRatio = Math.min(1, bot.attackAnimTimerMs / 160);
          const fireRecoil = -0.16 * fireRecoilRatio;
          const strafeLean =
            Math.min(1, speed * 0.16) * 0.08 * bot.strafeDir;

          rig.bodyPivot.rotation.x = hitFlinchPitch + fireRecoil * 0.42 + Math.min(0.08, speed * 0.012);
          rig.bodyPivot.rotation.y = stride * legAmp * 0.16 + hitFlinchTwist;
          rig.bodyPivot.rotation.z = strafeLean;
          rig.headGroup.rotation.x = -hitFlinchPitch * 0.65;
          rig.headGroup.rotation.y = Math.sin(now * 0.0025 + bot.walkCycle * 0.4) * 0.12;
          rig.leftArmPivot.rotation.z = -0.06 - Math.abs(stride) * 0.05;
          rig.rightArmPivot.rotation.x = fireRecoil - Math.abs(stride) * 0.04;

          rig.muzzleFlash.visible = bot.muzzleFlashTimerMs > 0;
          if (bot.muzzleFlashTimerMs > 0) {
            rig.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
          }

          rig.hpBarBg.visible = true;
          rig.hpBarFill.visible = true;
          rig.hpBarBg.lookAt(camera.position);
          rig.hpBarFill.lookAt(camera.position);

          const hpRatio = Math.max(0, Math.min(1, bot.hp / Math.max(1, bot.maxHp)));
          rig.hpBarFill.scale.x = Math.max(0.001, hpRatio);

          const visorMat = rig.visorMesh.material as THREE.MeshBasicMaterial;
          if (bot.hitFlashMs > 0) {
            visorMat.color.setHex(0xffffff);
          } else {
            visorMat.color.setHex(
              bot.archetype === 'rusher'
                ? 0xf97316
                : bot.archetype === 'sniper'
                ? 0xa855f7
                : 0xef4444
            );
          }

          if (bot.archetype === 'sniper' && bot.state === 'telegraph') {
            rig.sniperLaser.visible = true;
          } else {
            rig.sniperLaser.visible = false;
          }
        }
      }

      // 10B. Sync 3D Floating & Rotating Arena Supply Pickups (Medkits & Ammo Crates)
      for (const pk of sim.pickups) {
        let pEntry = pickupMeshes.get(pk.id);
        if (!pEntry) {
          const grp = new THREE.Group();
          const isHp = pk.kind === 'health';
          const boxMat = new THREE.MeshStandardMaterial({
            color: isHp ? 0x10b981 : 0xf59e0b,
            roughness: 0.3,
            metalness: 0.55,
          });
          const trimM = new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            roughness: 0.25,
            metalness: 0.2,
          });
          const caseMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.56, 0.34, 0.42),
            boxMat
          );
          caseMesh.position.y = 0.38;
          const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(0.58, 0.08, 0.44),
            trimM
          );
          stripe.position.y = 0.38;
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.45, 0.55, 24),
            new THREE.MeshBasicMaterial({
              color: isHp ? 0x34d399 : 0xfbbf24,
              transparent: true,
              opacity: 0.65,
              side: THREE.DoubleSide,
            })
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.03;
          grp.add(caseMesh, stripe, ring);
          pickupGroup.add(grp);
          pEntry = { group: grp, ring };
          pickupMeshes.set(pk.id, pEntry);
        }
        pEntry.group.visible = pk.active;
        if (pk.active) {
          const hoverY = Math.sin(now * 0.0035 + pk.x) * 0.08;
          pEntry.group.position.set(pk.x, hoverY, pk.z);
          pEntry.group.rotation.y = now * 0.0014;
          const pulse = 0.92 + Math.sin(now * 0.006) * 0.14;
          pEntry.ring.scale.setScalar(pulse);
        }
      }

      // 11. Update Pooled Ballistic VFX (Tracers, Shell Casings, Sparks, Rings)
      for (let i = 0; i < TRACER_POOL_SIZE; i++) {
        const item = tracerPool[i];
        const trace = sim.traces[i];
        if (!trace) {
          if (item.group.visible) item.group.visible = false;
          continue;
        }
        tracerStartVec.set(trace.fromX, trace.fromY, trace.fromZ);
        tracerEndVec.set(trace.toX, trace.toY, trace.toZ);
        const dist = tracerStartVec.distanceTo(tracerEndVec);
        if (dist < 0.05) {
          if (item.group.visible) item.group.visible = false;
          continue;
        }
        tracerMidVec.addVectors(tracerStartVec, tracerEndVec).multiplyScalar(0.5);
        item.group.position.copy(tracerMidVec);
        item.group.scale.set(1, 1, dist);
        item.group.lookAt(tracerEndVec);
        const alpha = Math.max(0, Math.min(1, trace.ttlMs / trace.maxTtlMs));
        item.coreMat.opacity = alpha * 0.95;
        item.glowMat.opacity = alpha * 0.65;
        item.glowMat.color.setHex(trace.colorHex);
        item.group.visible = true;
      }

      // Update Spinning Brass Shell Casings
      for (let i = 0; i < CASING_POOL_SIZE; i++) {
        const c = casingPool[i];
        if (!c.active) continue;
        c.ageMs += dtMs;
        if (c.ageMs >= c.maxAgeMs) {
          c.active = false;
          c.mesh.visible = false;
          continue;
        }
        c.vy -= 13.5 * dt;
        c.mesh.position.x += c.vx * dt;
        c.mesh.position.y += c.vy * dt;
        c.mesh.position.z += c.vz * dt;
        if (c.mesh.position.y < 0.02) {
          c.mesh.position.y = 0.02;
          c.vy = Math.abs(c.vy) * 0.42;
          c.vx *= 0.7;
          c.vz *= 0.7;
        }
        c.mesh.rotation.x += c.rx * dt;
        c.mesh.rotation.y += c.ry * dt;
        c.mesh.rotation.z += c.rz * dt;
      }

      // Update 3D Impact Sparks & Debris Particles
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const p = particlePool[i];
        if (!p.active) continue;
        p.ageMs += dtMs;
        if (p.ageMs >= p.maxAgeMs) {
          p.active = false;
          p.mesh.visible = false;
          continue;
        }
        const lifeRatio = 1 - p.ageMs / p.maxAgeMs;
        p.vy -= p.gravity * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        if (p.mesh.position.y < 0.03) {
          p.mesh.position.y = 0.03;
          p.vy = Math.abs(p.vy) * 0.35;
        }
        p.mesh.lookAt(
          p.mesh.position.x + p.vx,
          p.mesh.position.y + p.vy,
          p.mesh.position.z + p.vz
        );
        p.mat.opacity = lifeRatio;
        p.mesh.scale.setScalar(p.baseScale * (0.4 + lifeRatio * 0.6));
      }

      // Update Expanding Impact Shock Rings
      for (let i = 0; i < RING_POOL_SIZE; i++) {
        const r = ringPool[i];
        if (!r.active) continue;
        r.ageMs += dtMs;
        if (r.ageMs >= r.maxAgeMs) {
          r.active = false;
          r.mesh.visible = false;
          continue;
        }
        const t = r.ageMs / r.maxAgeMs;
        r.mesh.scale.setScalar(0.35 + t * r.maxScale);
        r.mat.opacity = (1 - t) * 0.85;
      }

      // 12. Direct 60fps HUD DOM Synchronization (dirty-checked to avoid redundant layout/style churn)
      const p = sim.player;
      const hpPct = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
      const hpPctStr = `${hpPct.toFixed(1)}%`;
      if (hpPctStr !== lastHpPctStr) {
        lastHpPctStr = hpPctStr;
        if (hudRefs.p1HpFill.current) {
          hudRefs.p1HpFill.current.style.width = hpPctStr;
        }
        if (hudRefs.p1HpGhost.current) {
          hudRefs.p1HpGhost.current.style.width = hpPctStr;
        }
      }
      const hpTextStr = `${Math.ceil(hpPct)}%`;
      if (hpTextStr !== lastHpTextStr && hudRefs.p1HpText.current) {
        lastHpTextStr = hpTextStr;
        hudRefs.p1HpText.current.textContent = hpTextStr;
      }

      // Sync Ammo below both Gun Boxes (Slot 1 & Slot 2)
      const wSlot1 = p.loadoutWeapons[0] || 'm4a1';
      const wSlot2 = p.loadoutWeapons[1] || 'awp';
      const ammo1 = p.weapons[wSlot1];
      const ammo2 = p.weapons[wSlot2];

      if (hudRefs.p1StaminaText.current && ammo1) {
        const s1Text =
          p.isReloading && p.activeWeapon === wSlot1
            ? 'RELOAD...'
            : `${ammo1.mag} / ${ammo1.reserve}`;
        if (s1Text !== lastSlot1Text) {
          lastSlot1Text = s1Text;
          hudRefs.p1StaminaText.current.textContent = s1Text;
        }
      }
      if (hudRefs.p1AbilityText.current && ammo2) {
        const s2Text =
          p.isReloading && p.activeWeapon === wSlot2
            ? 'RELOAD...'
            : `${ammo2.mag} / ${ammo2.reserve}`;
        if (s2Text !== lastSlot2Text) {
          lastSlot2Text = s2Text;
          hudRefs.p1AbilityText.current.textContent = s2Text;
        }
      }

      // Sync Top Deathmatch Kill Counter & Top Rival Kills
      if (hudRefs.p2HpText.current) {
        const killsStr = `${p.kills}`;
        if (killsStr !== lastKillsText) {
          lastKillsText = killsStr;
          hudRefs.p2HpText.current.textContent = killsStr;
        }
      }
      if (hudRefs.p2StaminaText.current) {
        let topBotKills = 0;
        for (let i = 0; i < sim.enemies.length; i++) {
          if (sim.enemies[i].kills > topBotKills) {
            topBotKills = sim.enemies[i].kills;
          }
        }
        const botKillsStr = `${topBotKills}`;
        if (botKillsStr !== lastBotKillsText) {
          lastBotKillsText = botKillsStr;
          hudRefs.p2StaminaText.current.textContent = botKillsStr;
        }
      }

      if (hudRefs.timerText.current) {
        const totalSecs = Math.max(0, Math.ceil(sim.roundTimerSec));
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        const timerStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        if (timerStr !== lastTimerText) {
          lastTimerText = timerStr;
          hudRefs.timerText.current.textContent = timerStr;
        }
      }

      if (hudRefs.aiStateBadge.current) {
        const surfUpper = (p.currentSurface || 'concrete').toUpperCase();
        if (hudRefs.aiStateBadge.current.textContent !== surfUpper) {
          hudRefs.aiStateBadge.current.textContent = surfUpper;
          hudRefs.aiStateBadge.current.dataset.surface = p.currentSurface || 'concrete';
        }
      }

      // Scope Overlay & Hip-fire Crosshair Smooth Crossfade
      if (hudRefs.lockReticle.current) {
        const scopeOpacity = p.adsBlend > 0.15 ? Math.min(1, (p.adsBlend - 0.15) / 0.65) : 0;
        const scopeOpacityStr = scopeOpacity.toFixed(2);
        if (scopeOpacityStr !== lastScopeOpacityStr) {
          lastScopeOpacityStr = scopeOpacityStr;
          hudRefs.lockReticle.current.style.opacity = scopeOpacityStr;
        }
      }
      if (hudRefs.crosshairRef.current) {
        const chOpacity = Math.max(0, 1 - p.adsBlend * 1.4);
        const chOpacityStr = chOpacity.toFixed(2);
        if (chOpacityStr !== lastChOpacityStr) {
          lastChOpacityStr = chOpacityStr;
          hudRefs.crosshairRef.current.style.opacity = chOpacityStr;
        }
      }

      // Tactical Slide Speed Vignette
      if (hudRefs.dashWindOverlay.current) {
        const slideOpacityStr = p.isSliding ? '0.9' : '0';
        if (slideOpacityStr !== lastSlideOpacityStr) {
          lastSlideOpacityStr = slideOpacityStr;
          hudRefs.dashWindOverlay.current.style.opacity = slideOpacityStr;
        }
      }

      if (hudRefs.hitMarkerRef.current) {
        hitMarkerTimerMs = Math.max(0, hitMarkerTimerMs - dtMs);
        const hmOpacityStr = hitMarkerTimerMs > 0 ? '1' : '0';
        if (hmOpacityStr !== lastHitMarkerOpacityStr) {
          lastHitMarkerOpacityStr = hmOpacityStr;
          hudRefs.hitMarkerRef.current.style.opacity = hmOpacityStr;
        }
      }

      if (hudRefs.screenImpactOverlay.current) {
        const hurtOpacity = Math.min(0.65, (p.hurtFlashMs / 240) * 0.55);
        const hurtOpacityStr = hurtOpacity.toFixed(2);
        if (hurtOpacityStr !== lastHurtOpacityStr) {
          lastHurtOpacityStr = hurtOpacityStr;
          hudRefs.screenImpactOverlay.current.style.opacity = hurtOpacityStr;
        }
      }

      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('resize', onResize);
      texSet.dispose();
      envTarget.dispose();
      renderer.dispose();
    };
  }, [simRef, hudRefs, touchInputRef]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full overflow-hidden bg-zinc-950 select-none"
    />
  );
};
