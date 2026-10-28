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
  type LobbyTab,
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
  WEAPON_IMPACT_PROFILES,
  type WeaponSwayPhysicsState,
  type WeaponSwayStepInput,
  computeBallisticImpactMarkPose,
  computeDynamicCrosshairState,
  computeWeaponWallObstruction,
  createWeaponSwayPhysicsState,
  resolveEntityCollisions,
  stepSimulation,
  stepWeaponSwayPhysics,
} from '../game/rules.ts';
import {
  buildDetailedWeaponViewModel,
  createProceduralTextureSet,
  setWeaponRigOpticAttachment,
  type WeaponViewModelRig,
} from '../game/visualModels.ts';
import {
  computeAimSensitivityMultiplier,
  computeComposedCameraFOV,
  computeWeaponADSPose,
  resolveEquippedOptic,
  syncScopeOverlayDom,
} from '../game/ads/index.ts';
import { BulletImpactSystem } from '../game/impact/BulletImpactSystem.ts';
import type { ImpactRequest } from '../game/impact/impact.types.ts';
import {
  type BodyRegionId,
  CHARACTER_ROSTER,
  type CharacterPoseId,
  type EquipmentSlotId,
  getSymmetryMirroredUV,
  mapLocalUvToRegionAtlas,
} from '../game/characterSystem.ts';
import {
  type BrushSettings,
  DEFAULT_BRUSH_SETTINGS,
  type PaintLayer,
  applyBrushStrokeSegment,
  applyBucketFillToLayer,
  applyGeometricShapeToLayer,
  applyGradientFillToLayer,
  sampleColorAtUV,
} from '../game/paintSystem.ts';
import {
  type ChameleonHumanoidRig,
  type CombatWeaponKinematicsInput,
  type EnemyChameleonCombatRig,
  buildChameleonHumanoidRig,
  buildCompactHandheldWeaponProp,
  buildEnemyChameleonCombatRig,
  enforceWeaponBodyClearance,
  setCharacterEquipmentSlotVisible,
  syncLayersToCharacterRigTexture,
  updateChameleonRigAnimation,
  updateEnemyChameleonCombatAnimation,
} from '../game/chameleonCharacter3D.ts';
import type { HudDomRefs, TouchInputState } from './CombatHUD.tsx';
import { soundEngine } from '../audio/soundEngine.ts';

export type CameraFocusPreset =
  | 'full'
  | 'upper'
  | 'head'
  | 'back'
  | 'legs'
  | 'left'
  | 'right';

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
  backpackOpen?: boolean;
  // 3D Lobby & Custom Chameleon Painting Studio Props
  activeLobbyTab?: LobbyTab;
  vaultSubTab?: 'studio' | 'gallery' | 'inventory';
  characterPose?: CharacterPoseId;
  cameraFocusPreset?: CameraFocusPreset;
  cameraResetTrigger?: number;
  cameraZoomDeltaTrigger?: { seq: number; delta: number };
  activeEquipment?: EquipmentSlotId[];
  studioInteractionMode?: 'paint' | 'orbit';
  brushSettings?: BrushSettings;
  studioLayersRef?: React.MutableRefObject<PaintLayer[]>;
  activeLayerId?: string;
  studioTextureRevision?: number;
  equippedCompositeBufferRef?: React.MutableRefObject<Uint8ClampedArray | null>;
  equippedDesignRevision?: number;
  selectedWeapon?: WeaponId;
  partyMembers?: {
    id: string;
    name: string;
    characterId: CharacterId;
    ready: boolean;
    isLeader?: boolean;
  }[];
  onPaintStrokeBeforeStart?: () => void;
  onPaintStrokeCommitted?: () => void;
  onEyedropperSampled?: (hex: string) => void;
  onHoverBodyRegion?: (region: BodyRegionId | null) => void;
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
  ageMs: number;
  emberGlow: number;
  isBlood: boolean;
}

interface ExplosionCoreFlashFX {
  group: THREE.Group;
  innerMat: THREE.MeshBasicMaterial;
  outerMat: THREE.MeshBasicMaterial;
  active: boolean;
  ageMs: number;
  maxAgeMs: number;
  maxScale: number;
}

interface ExplosionPlumeFX {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  active: boolean;
  delayMs: number;
  ageMs: number;
  maxAgeMs: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  startScale: number;
  endScale: number;
  isSmoke: boolean;
}

interface BarrelShrapnelFX {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  active: boolean;
  ageMs: number;
  maxAgeMs: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  bounces: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  screenState,
  gameMode,
  p1Char,
  arenaId,
  botDifficulty,
  firstPersonMode = true,
  onToggleFirstPerson,
  settings,
  trainingConfig,
  simRef,
  hudRefs,
  touchInputRef,
  onCombatEvent,
  onRoundFinished,
  loadoutOverlayOpen = false,
  backpackOpen = false,
  activeLobbyTab = 'home',
  vaultSubTab = 'studio',
  characterPose = 'idle',
  cameraFocusPreset = 'full',
  cameraResetTrigger = 0,
  cameraZoomDeltaTrigger,
  activeEquipment = [],
  studioInteractionMode = 'paint',
  brushSettings = DEFAULT_BRUSH_SETTINGS,
  studioLayersRef,
  activeLayerId = 'layer_1',
  studioTextureRevision = 0,
  equippedCompositeBufferRef,
  equippedDesignRevision = 0,
  selectedWeapon = 'm4a1',
  partyMembers = [],
  onPaintStrokeBeforeStart,
  onPaintStrokeCommitted,
  onEyedropperSampled,
  onHoverBodyRegion,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const screenStateRef = useRef(screenState);
  screenStateRef.current = screenState;
  const p1CharRef = useRef(p1Char);
  p1CharRef.current = p1Char;
  const firstPersonModeRef = useRef(firstPersonMode);
  firstPersonModeRef.current = firstPersonMode;
  const onToggleFirstPersonRef = useRef(onToggleFirstPerson);
  onToggleFirstPersonRef.current = onToggleFirstPerson;
  const loadoutOverlayOpenRef = useRef(loadoutOverlayOpen);
  loadoutOverlayOpenRef.current = loadoutOverlayOpen;
  const backpackOpenRef = useRef(backpackOpen);
  backpackOpenRef.current = backpackOpen;
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

  // 3D Lobby & Studio Refs
  const activeLobbyTabRef = useRef(activeLobbyTab);
  activeLobbyTabRef.current = activeLobbyTab;
  const vaultSubTabRef = useRef(vaultSubTab);
  vaultSubTabRef.current = vaultSubTab;
  const characterPoseRef = useRef(characterPose);
  characterPoseRef.current = characterPose;
  const cameraFocusPresetRef = useRef(cameraFocusPreset);
  cameraFocusPresetRef.current = cameraFocusPreset;
  const cameraResetTriggerRef = useRef(cameraResetTrigger);
  cameraResetTriggerRef.current = cameraResetTrigger;
  const cameraZoomDeltaTriggerRef = useRef(cameraZoomDeltaTrigger);
  cameraZoomDeltaTriggerRef.current = cameraZoomDeltaTrigger;
  const activeEquipmentRef = useRef(activeEquipment);
  activeEquipmentRef.current = activeEquipment;
  const studioInteractionModeRef = useRef(studioInteractionMode);
  studioInteractionModeRef.current = studioInteractionMode;
  const brushSettingsRef = useRef(brushSettings);
  brushSettingsRef.current = brushSettings;
  const activeLayerIdRef = useRef(activeLayerId);
  activeLayerIdRef.current = activeLayerId;
  const studioTextureRevisionRef = useRef(studioTextureRevision);
  studioTextureRevisionRef.current = studioTextureRevision;
  const equippedDesignRevisionRef = useRef(equippedDesignRevision);
  equippedDesignRevisionRef.current = equippedDesignRevision;
  const selectedWeaponRef = useRef(selectedWeapon);
  selectedWeaponRef.current = selectedWeapon;
  const partyMembersRef = useRef(partyMembers);
  partyMembersRef.current = partyMembers;
  const onPaintStrokeBeforeStartRef = useRef(onPaintStrokeBeforeStart);
  onPaintStrokeBeforeStartRef.current = onPaintStrokeBeforeStart;
  const onPaintStrokeCommittedRef = useRef(onPaintStrokeCommitted);
  onPaintStrokeCommittedRef.current = onPaintStrokeCommitted;
  const onEyedropperSampledRef = useRef(onEyedropperSampled);
  onEyedropperSampledRef.current = onEyedropperSampled;
  const onHoverBodyRegionRef = useRef(onHoverBodyRegion);
  onHoverBodyRegionRef.current = onHoverBodyRegion;

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
        isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(
          rendererStr
        );
        gl.getExtension('WEBGL_lose_context')?.loseContext();
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

    // Dynamic Muzzle Flash PointLight positioned at the active 3D weapon barrel muzzle tip in world space
    const muzzlePointLight = new THREE.PointLight(0xffb732, 0, 12, 1.5);
    scene.add(muzzlePointLight);

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
      centerRing.position.y = 0.011;
      mapGroup.add(centerRing);

      // Material-Specific 3D Floor Zones (Visually matching every Footstep Surface Material)
      const metalDeckMat = new THREE.MeshStandardMaterial({
        color: 0xb8c4d4,
        map: texSet.metalDeckMap,
        bumpMap: texSet.metalDeckBump,
        bumpScale: 0.022,
        roughness: 0.34,
        metalness: 0.78,
      });
      const tileDeckMat = new THREE.MeshStandardMaterial({
        color: 0xdbeafe,
        map: texSet.wallMap,
        bumpMap: texSet.groundBump,
        bumpScale: 0.008,
        roughness: 0.24,
        metalness: 0.32,
      });
      const woodDeckMat = new THREE.MeshStandardMaterial({
        color: 0xd99b66,
        map: texSet.crateMap,
        bumpMap: texSet.crateMap,
        bumpScale: 0.018,
        roughness: 0.72,
        metalness: 0.08,
      });
      const gravelDeckMat = new THREE.MeshStandardMaterial({
        color: 0x78716c,
        map: texSet.groundMap,
        bumpMap: texSet.groundBump,
        bumpScale: 0.038,
        roughness: 0.95,
        metalness: 0.04,
      });
      const grassDeckMat = new THREE.MeshStandardMaterial({
        color: 0x4d7c0f,
        map: texSet.groundMap,
        bumpMap: texSet.groundBump,
        bumpScale: 0.028,
        roughness: 0.9,
        metalness: 0.02,
      });
      const waterDeckMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.14,
        metalness: 0.65,
        transparent: true,
        opacity: 0.82,
      });
      const zoneBevelMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.42,
        metalness: 0.72,
      });

      if (arenaDef.surfaceZones) {
        for (const sz of arenaDef.surfaceZones) {
          if (sz.material === 'concrete') continue;
          const zw = sz.maxX - sz.minX;
          const zd = sz.maxZ - sz.minZ;
          const cx = (sz.minX + sz.maxX) * 0.5;
          const cz = (sz.minZ + sz.maxZ) * 0.5;

          const zoneMat =
            sz.material === 'metal'
              ? metalDeckMat
              : sz.material === 'tile'
              ? tileDeckMat
              : sz.material === 'wood'
              ? woodDeckMat
              : sz.material === 'gravel'
              ? gravelDeckMat
              : sz.material === 'grass'
              ? grassDeckMat
              : waterDeckMat;

          const plateHeight = sz.material === 'wood' ? 0.012 : 0.01;
          const deckPlate = new THREE.Mesh(
            new THREE.BoxGeometry(zw, plateHeight, zd),
            zoneMat
          );
          deckPlate.position.set(cx, plateHeight * 0.5, cz);
          deckPlate.receiveShadow = true;
          mapGroup.add(deckPlate);

          const deckRim = new THREE.Mesh(
            new THREE.BoxGeometry(zw + 0.16, 0.006, zd + 0.16),
            zoneBevelMat
          );
          deckRim.position.set(cx, 0.003, cz);
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

        // Reinforced Steel Roof Cap & Base Plinth for visual Crispness (kept flush so wall decals at +0.012m are never occluded)
        if (!isPerimeter) {
          const cap = new THREE.Mesh(
            new THREE.BoxGeometry(bw + 0.06, 0.14, bd + 0.06),
            trimMat
          );
          cap.position.set(b.x, bh + 0.07, b.z);
          mapGroup.add(cap);

          const plinth = new THREE.Mesh(
            new THREE.BoxGeometry(bw + 0.008, 0.12, bd + 0.008),
            trimMat
          );
          plinth.position.set(b.x, 0.06, b.z);
          mapGroup.add(plinth);

          // Yellow tactical caution band on waist-high concrete barriers
          if (b.kind === 'cover' && bh <= 1.6) {
            const band = new THREE.Mesh(
              new THREE.BoxGeometry(bw + 0.006, 0.1, bd + 0.006),
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
      roughness: 0.32,
      metalness: 0.56,
      envMapIntensity: 1.35,
    });
    const barrelStripeMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.38,
      metalness: 0.32,
      envMapIntensity: 1.2,
    });
    const barrelRimMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.36,
      metalness: 0.82,
      envMapIntensity: 1.35,
    });
    const barrelBungMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.25,
      metalness: 0.88,
      envMapIntensity: 1.4,
    });
    const crateMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texSet.crateMap,
      roughness: 0.72,
      metalness: 0.14,
      envMapIntensity: 1.15,
    });

    const syncBreakableProps = (sim: SimulationState) => {
      for (const p of sim.breakableProps) {
        let obj = propMeshes.get(p.id);
        if (!obj) {
          if (p.kind === 'barrel') {
            const grp = new THREE.Group();
            const cyl = new THREE.Mesh(
              new THREE.CylinderGeometry(p.radius, p.radius, p.height, 20),
              barrelMat
            );
            cyl.position.y = p.height * 0.5;
            cyl.castShadow = !isLow;
            cyl.receiveShadow = true;

            // Rolled steel top & bottom chime rims
            const chimeTop = new THREE.Mesh(
              new THREE.CylinderGeometry(p.radius * 1.045, p.radius * 1.045, 0.045, 20),
              barrelRimMat
            );
            chimeTop.position.y = p.height - 0.022;
            const chimeBot = new THREE.Mesh(
              new THREE.CylinderGeometry(p.radius * 1.045, p.radius * 1.045, 0.045, 20),
              barrelRimMat
            );
            chimeBot.position.y = 0.022;

            // Corrugated expansion ribs & high-visibility yellow hazard bands
            const ringTop = new THREE.Mesh(
              new THREE.CylinderGeometry(p.radius * 1.038, p.radius * 1.038, 0.11, 20),
              barrelStripeMat
            );
            ringTop.position.y = p.height * 0.72;

            const ribMidTop = new THREE.Mesh(
              new THREE.TorusGeometry(p.radius * 1.02, 0.018, 8, 20),
              barrelRimMat
            );
            ribMidTop.rotation.x = Math.PI * 0.5;
            ribMidTop.position.y = p.height * 0.64;

            const ringBot = new THREE.Mesh(
              new THREE.CylinderGeometry(p.radius * 1.038, p.radius * 1.038, 0.11, 20),
              barrelStripeMat
            );
            ringBot.position.y = p.height * 0.28;

            const ribMidBot = new THREE.Mesh(
              new THREE.TorusGeometry(p.radius * 1.02, 0.018, 8, 20),
              barrelRimMat
            );
            ribMidBot.rotation.x = Math.PI * 0.5;
            ribMidBot.position.y = p.height * 0.36;

            // Top steel bungs (2-inch & 3/4-inch drum plugs)
            const bungMain = new THREE.Mesh(
              new THREE.CylinderGeometry(0.048, 0.048, 0.028, 10),
              barrelBungMat
            );
            bungMain.position.set(p.radius * 0.42, p.height + 0.012, 0.06);
            const bungVent = new THREE.Mesh(
              new THREE.CylinderGeometry(0.028, 0.028, 0.024, 8),
              barrelBungMat
            );
            bungVent.position.set(-p.radius * 0.38, p.height + 0.01, -0.08);

            grp.add(
              cyl,
              chimeTop,
              chimeBot,
              ringTop,
              ribMidTop,
              ringBot,
              ribMidBot,
              bungMain,
              bungVent
            );
            obj = grp;
          } else {
            const box = new THREE.Mesh(
              new THREE.BoxGeometry(p.radius * 1.85, p.height, p.radius * 1.85),
              crateMat
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

    // 6. Articulated Meccha Chameleon Enemy Rigs & 3D Animated Supply Pickups
    const enemyGroup = new THREE.Group();
    scene.add(enemyGroup);
    const enemyRigs = new Map<string, EnemyChameleonCombatRig>();

    const pickupGroup = new THREE.Group();
    scene.add(pickupGroup);
    const pickupMeshes = new Map<string, { group: THREE.Group; ring: THREE.Mesh }>();

    // Shared 3D World Loot Group & Geometries (zero per-frame allocations)
    const worldLootGroup = new THREE.Group();
    scene.add(worldLootGroup);
    const worldLootCaseGeo = new THREE.BoxGeometry(0.46, 0.24, 0.34);
    const worldLootStripeGeo = new THREE.BoxGeometry(0.48, 0.05, 0.36);
    const worldLootRingGeo = new THREE.RingGeometry(0.36, 0.44, 20);
    const worldLootTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.25,
      metalness: 0.3,
    });
    const worldLootWeaponMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.3,
      metalness: 0.6,
    });
    const worldLootAttachmentMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.28,
      metalness: 0.55,
    });
    const worldLootSupplyMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.32,
      metalness: 0.45,
    });
    const worldLootRingMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const worldLootMeshes = new Map<
      string,
      { group: THREE.Group; ring: THREE.Mesh }
    >();

    // 6B. MECCHA CHAMELEON 3D Lobby Stage (Sunlit Sky-Island Tactical Outpost matching reference image)
    const LOBBY_STAGE_Y = 46;
    const lobbyStageGroup = new THREE.Group();
    lobbyStageGroup.position.set(0, LOBBY_STAGE_Y, 0);
    scene.add(lobbyStageGroup);

    // 1. Bright Sunlit Sky Dome Backdrop & Cumulus Clouds (isolates lobby from combat arena sky)
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 512;
    skyCanvas.height = 256;
    const skyCtx = skyCanvas.getContext('2d');
    if (skyCtx) {
      const grad = skyCtx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#3b95e6');
      grad.addColorStop(0.48, '#6ebbf5');
      grad.addColorStop(0.82, '#bae2ff');
      grad.addColorStop(1, '#dff2ff');
      skyCtx.fillStyle = grad;
      skyCtx.fillRect(0, 0, 512, 256);

      // Soft sunlit cumulus clouds along horizon
      const drawCloudBank = (cx: number, cy: number, rx: number, ry: number, alpha: number) => {
        skyCtx.save();
        skyCtx.fillStyle = `rgba(255, 253, 248, ${alpha})`;
        skyCtx.beginPath();
        skyCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        skyCtx.fill();
        skyCtx.restore();
      };
      drawCloudBank(110, 175, 85, 28, 0.85);
      drawCloudBank(150, 165, 65, 34, 0.92);
      drawCloudBank(380, 168, 95, 32, 0.88);
      drawCloudBank(425, 154, 70, 36, 0.94);
      drawCloudBank(260, 188, 120, 24, 0.72);
    }
    const lobbySkyTex = new THREE.CanvasTexture(skyCanvas);
    lobbySkyTex.colorSpace = THREE.SRGBColorSpace;
    const lobbySkyDome = new THREE.Mesh(
      new THREE.SphereGeometry(28, 32, 20),
      new THREE.MeshBasicMaterial({
        map: lobbySkyTex,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    lobbySkyDome.position.set(0, 2.0, 0);
    lobbyStageGroup.add(lobbySkyDome);

    // Volumetric 3D Cumulus Cloud Puffs in the upper-right & horizon sky
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.0,
      emissive: 0xdbeafe,
      emissiveIntensity: 0.35,
    });
    const cloudClusters: [number, number, number, number][] = [
      [6.5, 5.2, -13.5, 1.65],
      [8.2, 5.6, -13.2, 1.95],
      [9.8, 5.0, -13.6, 1.45],
      [4.2, 3.6, -15.0, 1.55],
      [1.2, 2.9, -15.5, 1.35],
      [-5.5, 4.8, -14.0, 1.5],
    ];
    for (const [cx, cy, cz, cScale] of cloudClusters) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(cScale, 14, 12),
        cloudMat
      );
      puff.scale.set(1.5, 0.72, 0.85);
      puff.position.set(cx, cy, cz);
      lobbyStageGroup.add(puff);
    }

    // 2. Metallic Concrete Outpost Floor Deck with Panel Seams
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const flCtx = floorCanvas.getContext('2d');
    if (flCtx) {
      flCtx.fillStyle = '#8b95a1';
      flCtx.fillRect(0, 0, 512, 512);
      // Subtle concrete & steel wear speckles
      for (let i = 0; i < 900; i++) {
        flCtx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(30,41,59,0.08)';
        flCtx.fillRect(
          (i * 73) % 512,
          (i * 139) % 512,
          3 + (i % 6),
          3 + ((i * 3) % 6)
        );
      }
      // Industrial deck grid seams
      flCtx.strokeStyle = 'rgba(30, 41, 59, 0.42)';
      flCtx.lineWidth = 3;
      for (let p = 64; p < 512; p += 64) {
        flCtx.beginPath();
        flCtx.moveTo(p, 0);
        flCtx.lineTo(p, 512);
        flCtx.stroke();
        flCtx.beginPath();
        flCtx.moveTo(0, p);
        flCtx.lineTo(512, p);
        flCtx.stroke();
      }
    }
    const lobbyFloorTex = new THREE.CanvasTexture(floorCanvas);
    lobbyFloorTex.wrapS = THREE.RepeatWrapping;
    lobbyFloorTex.wrapT = THREE.RepeatWrapping;
    lobbyFloorTex.repeat.set(3, 3);
    lobbyFloorTex.colorSpace = THREE.SRGBColorSpace;

    const studioFloor = new THREE.Mesh(
      new THREE.BoxGeometry(14.5, 0.4, 9.2),
      new THREE.MeshStandardMaterial({
        map: lobbyFloorTex,
        color: 0xcbd5e1,
        roughness: 0.58,
        metalness: 0.22,
      })
    );
    studioFloor.position.set(0, -0.2, -1.2);
    studioFloor.receiveShadow = true;
    lobbyStageGroup.add(studioFloor);

    // Subtle circular metallic floor ring directly under the central character's feet
    const pedestalBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.02, 0.024, 48),
      new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.42,
        metalness: 0.52,
      })
    );
    pedestalBase.position.set(0, 0.012, 0);
    pedestalBase.receiveShadow = true;
    lobbyStageGroup.add(pedestalBase);

    const pedestalGlowRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.96, 0.015, 10, 64),
      new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.35,
        metalness: 0.65,
      })
    );
    pedestalGlowRing.rotation.x = Math.PI / 2;
    pedestalGlowRing.position.set(0, 0.024, 0);
    lobbyStageGroup.add(pedestalGlowRing);

    // 3. Left Concrete Bastion Wall with Stenciled "PAINT YOUR STYLE" Graffiti & Overhanging Tree
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = 512;
    wallCanvas.height = 512;
    const wCtx = wallCanvas.getContext('2d');
    if (wCtx) {
      wCtx.fillStyle = '#646e78';
      wCtx.fillRect(0, 0, 512, 512);
      // Concrete panel lines
      wCtx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
      wCtx.lineWidth = 4;
      wCtx.strokeRect(12, 12, 488, 488);
      wCtx.beginPath();
      wCtx.moveTo(0, 256);
      wCtx.lineTo(512, 256);
      wCtx.stroke();
      // Distressed white stencil "PAINT YOUR STYLE"
      wCtx.save();
      wCtx.fillStyle = 'rgba(241, 245, 249, 0.85)';
      wCtx.font = '900 52px Impact, "Arial Black", sans-serif';
      wCtx.textAlign = 'center';
      wCtx.fillText('PAINT', 355, 220);
      wCtx.font = '900 42px Impact, "Arial Black", sans-serif';
      wCtx.fillText('YOUR', 355, 268);
      wCtx.font = '900 50px Impact, "Arial Black", sans-serif';
      wCtx.fillText('STYLE', 355, 318);
      wCtx.restore();
    }
    const wallTex = new THREE.CanvasTexture(wallCanvas);
    wallTex.colorSpace = THREE.SRGBColorSpace;

    const leftBastionWall = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 2.75, 1.4),
      new THREE.MeshStandardMaterial({
        map: wallTex,
        color: 0x94a3b8,
        roughness: 0.75,
        metalness: 0.12,
      })
    );
    leftBastionWall.position.set(-2.05, 1.35, -2.55);
    leftBastionWall.rotation.y = 0.22;
    lobbyStageGroup.add(leftBastionWall);

    // Overhanging green foliage tree canopy above the left bastion wall
    const foliageMatDark = new THREE.MeshStandardMaterial({
      color: 0x2e6f40,
      roughness: 0.85,
      metalness: 0.05,
    });
    const foliageMatBright = new THREE.MeshStandardMaterial({
      color: 0x4d9b56,
      roughness: 0.8,
      metalness: 0.05,
    });
    const treePuffs: [number, number, number, number, boolean][] = [
      [-2.15, 2.65, -2.25, 0.95, false],
      [-1.45, 2.72, -2.15, 0.82, true],
      [-0.95, 2.55, -2.3, 0.65, true],
      [-2.75, 2.5, -2.1, 0.88, false],
      [-1.8, 2.95, -2.4, 0.85, true],
    ];
    for (const [tx, ty, tz, rad, bright] of treePuffs) {
      const leafMesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(rad, 1),
        bright ? foliageMatBright : foliageMatDark
      );
      leafMesh.scale.set(1.25, 0.82, 0.95);
      leafMesh.position.set(tx, ty, tz);
      lobbyStageGroup.add(leafMesh);
    }

    // Left Military Supply Crates (Olive Green Crate + Dark Tactical Cases)
    const oliveCrate = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.82, 0.85),
      new THREE.MeshStandardMaterial({
        color: 0x5c6b47,
        roughness: 0.68,
        metalness: 0.22,
      })
    );
    oliveCrate.position.set(-2.35, 0.41, -1.55);
    oliveCrate.rotation.y = 0.18;
    lobbyStageGroup.add(oliveCrate);

    const darkCaseLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.48, 0.68),
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.55,
        metalness: 0.35,
      })
    );
    darkCaseLeft.position.set(-1.35, 0.24, -1.72);
    darkCaseLeft.rotation.y = 0.08;
    lobbyStageGroup.add(darkCaseLeft);

    // 4. Yellow Industrial Safety Railings along the Platform Back Edge
    const yellowRailMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.42,
      metalness: 0.38,
    });
    for (const rx of [-0.6, 1.25, 3.1]) {
      const topBar = new THREE.Mesh(
        new THREE.BoxGeometry(1.72, 0.055, 0.055),
        yellowRailMat
      );
      topBar.position.set(rx, 0.92, -3.25);
      const midBar = new THREE.Mesh(
        new THREE.BoxGeometry(1.72, 0.045, 0.045),
        yellowRailMat
      );
      midBar.position.set(rx, 0.52, -3.25);
      const postL = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.96, 0.06),
        yellowRailMat
      );
      postL.position.set(rx - 0.82, 0.48, -3.25);
      const postR = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.96, 0.06),
        yellowRailMat
      );
      postR.position.set(rx + 0.82, 0.48, -3.25);
      lobbyStageGroup.add(topBar, midBar, postL, postR);
    }

    // 5. Right-Side Yellow Heavy Cargo Crates (visible behind right UI cards)
    const rightCrateLarge = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.92, 0.95),
      new THREE.MeshStandardMaterial({
        color: 0xd97706,
        roughness: 0.52,
        metalness: 0.25,
      })
    );
    rightCrateLarge.position.set(2.45, 0.46, -1.85);
    rightCrateLarge.rotation.y = -0.24;
    lobbyStageGroup.add(rightCrateLarge);

    const rightCrateSmall = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.68, 0.78),
      yellowRailMat
    );
    rightCrateSmall.position.set(1.62, 0.34, -2.25);
    rightCrateSmall.rotation.y = -0.12;
    lobbyStageGroup.add(rightCrateSmall);

    // 6. Distant Floating Sky-Island on the Right with Waterfalls, Trees & Futuristic Citadel Spire
    const skyIslandGroup = new THREE.Group();
    skyIslandGroup.position.set(4.8, 0.65, -11.5);
    lobbyStageGroup.add(skyIslandGroup);

    const cliffRockMat = new THREE.MeshStandardMaterial({
      color: 0x7c7267,
      roughness: 0.88,
      metalness: 0.08,
    });
    const islandMainRock = new THREE.Mesh(
      new THREE.ConeGeometry(3.4, 3.8, 9),
      cliffRockMat
    );
    islandMainRock.rotation.x = Math.PI;
    islandMainRock.position.set(0, -0.4, 0);
    skyIslandGroup.add(islandMainRock);

    const islandUpperPlateau = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 2.8, 0.9, 10),
      new THREE.MeshStandardMaterial({
        color: 0x4d7c43,
        roughness: 0.82,
        metalness: 0.05,
      })
    );
    islandUpperPlateau.position.set(0, 1.55, 0);
    skyIslandGroup.add(islandUpperPlateau);

    // Cascading Waterfalls down the floating island cliff
    const waterfallMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.82,
    });
    for (const wx of [-0.85, 0.35, 1.25]) {
      const wf = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 2.8, 0.1),
        waterfallMat
      );
      wf.position.set(wx, 0.1, 2.15);
      wf.rotation.x = -0.12;
      skyIslandGroup.add(wf);
    }

    // Futuristic White & Cyan Citadel Spire on the Floating Island
    const spireBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.95, 2.4, 8),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.32,
        metalness: 0.48,
      })
    );
    spireBase.position.set(0.3, 3.1, -0.2);
    skyIslandGroup.add(spireBase);

    const spireNeedle = new THREE.Mesh(
      new THREE.ConeGeometry(0.38, 2.6, 8),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.25,
        metalness: 0.65,
        emissive: 0x0284c7,
        emissiveIntensity: 0.35,
      })
    );
    spireNeedle.position.set(0.3, 5.1, -0.2);
    skyIslandGroup.add(spireNeedle);

    // Small Airborne Jet Silhouette near the floating island
    const jetMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.75, 4),
      new THREE.MeshBasicMaterial({ color: 0x334155 })
    );
    jetMesh.rotation.z = Math.PI * 0.42;
    jetMesh.rotation.y = 0.35;
    jetMesh.position.set(-2.6, 3.35, 1.5);
    skyIslandGroup.add(jetMesh);

    // 7. Balanced Studio Lighting for Crisp Low-Poly White Facet Shading & Paint Splashes
    const studioSunLight = new THREE.DirectionalLight(0xfffbeb, 1.25);
    studioSunLight.position.set(3.8, 6.2, 4.0);
    const studioKeyLight = new THREE.PointLight(0xffffff, 1.15, 18, 1.1);
    studioKeyLight.position.set(2.4, 3.1, 3.0);
    const studioFillLight = new THREE.PointLight(0xcbd5e1, 0.65, 18, 1.1);
    studioFillLight.position.set(-2.8, 2.1, 2.5);
    const studioRimLight = new THREE.PointLight(0x38bdf8, 0.85, 14, 1.2);
    studioRimLight.position.set(0, 3.1, -2.9);
    lobbyStageGroup.add(
      studioSunLight,
      studioKeyLight,
      studioFillLight,
      studioRimLight
    );

    // Turntable Pivot & Active Lobby/Studio Chameleon Rig
    const turntableGroup = new THREE.Group();
    turntableGroup.position.set(0, 0.02, 0);
    lobbyStageGroup.add(turntableGroup);

    let currentLobbyCharId: CharacterId = p1CharRef.current;
    let currentLobbyWeaponId: WeaponId = selectedWeaponRef.current;
    let currentCombatWeaponId: WeaponId = selectedWeaponRef.current;
    let lobbyCharRig: ChameleonHumanoidRig = buildChameleonHumanoidRig(
      currentLobbyCharId,
      maxAnisotropy
    );
    let lobbyWeaponProp = buildCompactHandheldWeaponProp(currentLobbyWeaponId);
    lobbyCharRig.weaponMount.add(lobbyWeaponProp);
    turntableGroup.add(lobbyCharRig.root);

    // 3rd-Person Combat Player Rig & 1st-Person Chameleon Painted Forearm/Hand Sleeves
    let combatPlayerRig: ChameleonHumanoidRig = buildChameleonHumanoidRig(
      currentLobbyCharId,
      maxAnisotropy
    );
    let combatWeaponProp = buildCompactHandheldWeaponProp(
      currentLobbyWeaponId,
      true
    );
    combatPlayerRig.weaponMount.add(combatWeaponProp);
    combatPlayerRig.root.visible = false;
    scene.add(combatPlayerRig.root);

    // 1st-Person Dedicated Viewmodel Arms & Hands parented directly to active weapon
    const fpChameleonArmsGroup = new THREE.Group();

    const buildFpViewmodelArm = (
      isRight: boolean,
      forearmRegion: BodyRegionId
    ): THREE.Group => {
      const armGrp = new THREE.Group();

      const mapGeoUvToRegion = (
        geo: THREE.BufferGeometry,
        reg: BodyRegionId,
        subU?: [number, number]
      ) => {
        const uvAttr = geo.attributes.uv;
        if (!uvAttr) return;
        for (let i = 0; i < uvAttr.count; i++) {
          let u = uvAttr.getX(i);
          if (subU) {
            u = subU[0] + u * (subU[1] - subU[0]);
          }
          const mapped = mapLocalUvToRegionAtlas(
            u,
            uvAttr.getY(i),
            reg
          );
          uvAttr.setXY(i, mapped.u, mapped.v);
        }
        uvAttr.needsUpdate = true;
      };

      // Fingerless Sculpted Rounded Low-Poly Bulb/Mitten Hand matching ChameleonCharacter3D
      const handGrp = new THREE.Group();
      handGrp.name = isRight ? 'fpRightHandPivot' : 'fpLeftHandPivot';
      const handSubRange: [number, number] = isRight ? [0.52, 0.98] : [0.02, 0.48];
      const upperReg: BodyRegionId = isRight ? 'rightUpperArm' : 'leftUpperArm';

      if (isRight) {
        // Stocky rounded bulb/mitten firing hand wrapping the pistol grip (NO individual fingers)
        const bulbHandGeo = new THREE.SphereGeometry(0.044, 12, 10);
        mapGeoUvToRegion(bulbHandGeo, 'hands', handSubRange);
        const bulbHandMesh = new THREE.Mesh(
          bulbHandGeo,
          combatPlayerRig.paintMaterial
        );
        bulbHandMesh.scale.set(0.96, 1.18, 1.14);
        bulbHandMesh.position.set(0.012, -0.004, 0.006);
        bulbHandMesh.rotation.set(0.28, -0.12, 0.08);
        handGrp.add(bulbHandMesh);
      } else {
        // Stocky rounded bulb/mitten support hand cradling the handguard/forend (NO individual fingers)
        const bulbHandGeo = new THREE.SphereGeometry(0.046, 12, 10);
        mapGeoUvToRegion(bulbHandGeo, 'hands', handSubRange);
        const bulbHandMesh = new THREE.Mesh(
          bulbHandGeo,
          combatPlayerRig.paintMaterial
        );
        bulbHandMesh.scale.set(1.14, 0.94, 1.24);
        bulbHandMesh.position.set(-0.008, -0.014, 0.004);
        bulbHandMesh.rotation.set(0.12, 0.18, -0.22);
        handGrp.add(bulbHandMesh);
      }

      // Stocky Flared Forearm extending naturally from the lower shoulder/elbow into the rounded bulb hand
      const wristPos = isRight
        ? new THREE.Vector3(0.018, -0.014, 0.028)
        : new THREE.Vector3(-0.024, -0.018, 0.024);
      const elbowPos = isRight
        ? new THREE.Vector3(0.16, -0.15, 0.30)
        : new THREE.Vector3(-0.34, -0.15, 0.34);

      const forearmDir = new THREE.Vector3().subVectors(wristPos, elbowPos);
      const forearmLen = forearmDir.length();
      // Flared low-poly tubular forearm (wider at wrist, matching buildArmAssembly in chameleonCharacter3D.ts)
      const forearmGeo = new THREE.CylinderGeometry(
        0.048,
        0.040,
        forearmLen,
        12,
        4
      );
      mapGeoUvToRegion(forearmGeo, forearmRegion);
      const forearmMesh = new THREE.Mesh(
        forearmGeo,
        combatPlayerRig.paintMaterial
      );
      forearmMesh.position
        .addVectors(elbowPos, wristPos)
        .multiplyScalar(0.5);
      forearmMesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        forearmDir.clone().normalize()
      );

      // Seamless rounded elbow bridge & upper-arm sleeve continuation so no gap ever shows during reload/recoil
      const elbowCapGeo = new THREE.SphereGeometry(0.042, 10, 8);
      mapGeoUvToRegion(elbowCapGeo, upperReg);
      const elbowCap = new THREE.Mesh(
        elbowCapGeo,
        combatPlayerRig.paintMaterial
      );
      elbowCap.position.copy(elbowPos);

      const shoulderPos = isRight
        ? new THREE.Vector3(0.24, -0.22, 0.48)
        : new THREE.Vector3(-0.44, -0.22, 0.52);
      const upperDir = new THREE.Vector3().subVectors(elbowPos, shoulderPos);
      const upperGeo = new THREE.CylinderGeometry(
        0.041,
        0.036,
        upperDir.length(),
        12,
        3
      );
      mapGeoUvToRegion(upperGeo, upperReg);
      const upperMesh = new THREE.Mesh(
        upperGeo,
        combatPlayerRig.paintMaterial
      );
      upperMesh.position.addVectors(shoulderPos, elbowPos).multiplyScalar(0.5);
      upperMesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        upperDir.clone().normalize()
      );

      armGrp.add(handGrp, forearmMesh, elbowCap, upperMesh);
      return armGrp;
    };

    const fpRightArm = buildFpViewmodelArm(true, 'rightForearm');
    const fpLeftArm = buildFpViewmodelArm(false, 'leftForearm');
    fpChameleonArmsGroup.add(fpRightArm, fpLeftArm);
    viewmodelRig.add(fpChameleonArmsGroup);

    // Flanking Squadmate Pedestals for Duo (2P) and Squad (4P) Lobby Preview
    const squadSlotPositions: [number, number, number][] = [
      [-1.58, 0, -0.95],
      [1.58, 0, -0.95],
      [-2.72, 0, -1.65],
    ];
    const squadSlotEntries: {
      slotGroup: THREE.Group;
      charId: CharacterId;
      rig: ChameleonHumanoidRig;
    }[] = [];

    for (let i = 0; i < 3; i++) {
      const slotGrp = new THREE.Group();
      const [sx, sy, sz] = squadSlotPositions[i];
      slotGrp.position.set(sx, sy, sz);
      slotGrp.rotation.y = sx < 0 ? 0.25 : -0.25;

      const subBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.85, 0.1, 32),
        new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.35,
          metalness: 0.65,
        })
      );
      subBase.position.y = 0.05;
      slotGrp.add(subBase);

      const defaultSquadChar: CharacterId =
        i === 0 ? 'rift' : i === 1 ? 'kestrel' : 'chroma';
      const sqRig = buildChameleonHumanoidRig(defaultSquadChar, maxAnisotropy);
      sqRig.root.position.y = 0.1;
      slotGrp.add(sqRig.root);
      slotGrp.visible = false;
      lobbyStageGroup.add(slotGrp);
      squadSlotEntries.push({
        slotGroup: slotGrp,
        charId: defaultSquadChar,
        rig: sqRig,
      });
    }

    // 3D Surface Brush Cursor Ring for Vault Painting Studio
    const brushCursorMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });
    const brushCursorRing = new THREE.Mesh(
      new THREE.RingGeometry(0.028, 0.038, 24),
      brushCursorMat
    );
    brushCursorRing.visible = false;
    scene.add(brushCursorRing);

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

    // 7E. Production-Quality Hybrid Procedural Bullet Impact Engine + Blood Splatter Decal Pool
    const bulletImpactSystem = new BulletImpactSystem(
      vfxGroup,
      settingsRef.current.particleQuality,
      isSoftwareGl
    );
    let lastImpactQualitySetting = settingsRef.current.particleQuality;

    const _impactRequestScratch: ImpactRequest = {
      point: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
      direction: { x: 0, y: 0, z: -1 },
      origin: { x: 0, y: 0, z: 0 },
      weaponId: 'm4a1',
      arena: undefined,
      propKind: null,
      damage: 28,
      isEnemyShot: false,
    };

    // Dedicated lightweight pool for floor blood splatters & barrel blast scorch marks (24 decals)
    const DECAL_POOL_SIZE = 24;
    const decalPool: BulletDecalFX[] = [];
    const decalGeo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < DECAL_POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: texSet.bloodSplatterMap,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });
      const mesh = new THREE.Mesh(decalGeo, mat);
      mesh.visible = false;
      vfxGroup.add(mesh);
      decalPool.push({
        mesh,
        mat,
        active: false,
        ageMs: 2000,
        emberGlow: 0,
        isBlood: true,
      });
    }
    let decalCursor = 0;

    let highestProcessedTraceId = 0;
    const normalVec = new THREE.Vector3();
    const defaultForward = new THREE.Vector3(0, 0, 1);

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
      isEnemyShot?: boolean,
      propKind?: 'crate' | 'barrel',
      damage?: number
    ) => {
      if (hitKind === 'sky') return;

      const wid: WeaponId = weaponId || 'm4a1';
      normalVec.set(nx, ny, nz).normalize();

      // 1. Expanding Blood Mist Ring ONLY on enemy/headshot hits
      if (hitKind === 'headshot' || hitKind === 'enemy') {
        const ring = ringPool[ringCursor];
        ringCursor = (ringCursor + 1) % RING_POOL_SIZE;
        ring.active = true;
        ring.ageMs = 0;
        ring.maxAgeMs = hitKind === 'headshot' ? 320 : 260;
        ring.maxScale = hitKind === 'headshot' ? 4.2 : 3.1;
        ring.mat.color.setHex(hitKind === 'headshot' ? 0xdc2626 : 0xb91c1c);
        ring.mesh.position.set(x + nx * 0.03, y + ny * 0.03, z + nz * 0.03);
        ring.mesh.quaternion.setFromUnitVectors(defaultForward, normalVec);
        ring.mesh.scale.setScalar(0.32);
        ring.mesh.visible = true;
      }

      // 2. Hybrid Procedural Bullet Impact Engine on Wall, Floor, Container, Pillar, Tower & Prop Surfaces
      if (hitKind === 'wall' || hitKind === 'prop') {
        const arenaDefNow =
          ARENA_REGISTRY[simRef.current.arenaId] || ARENA_REGISTRY.foundry_arena;

        _impactRequestScratch.origin!.x = fromX;
        _impactRequestScratch.origin!.y = fromY;
        _impactRequestScratch.origin!.z = fromZ;
        _impactRequestScratch.point.x = x;
        _impactRequestScratch.point.y = y;
        _impactRequestScratch.point.z = z;
        _impactRequestScratch.normal.x = nx;
        _impactRequestScratch.normal.y = ny;
        _impactRequestScratch.normal.z = nz;
        _impactRequestScratch.direction.x = x - fromX;
        _impactRequestScratch.direction.y = y - fromY;
        _impactRequestScratch.direction.z = z - fromZ;
        _impactRequestScratch.weaponId = wid;
        _impactRequestScratch.arena = arenaDefNow;
        _impactRequestScratch.propKind = propKind || null;
        _impactRequestScratch.damage = damage;
        _impactRequestScratch.isEnemyShot = Boolean(isEnemyShot);

        const impactMeta = bulletImpactSystem.addImpact(_impactRequestScratch);

        if (impactMeta && container) {
          const telemetry = bulletImpactSystem.getDebugTelemetry();
          container.dataset.activeDecals = String(telemetry.activeImpactCount);
          container.dataset.lastDecalWeapon = wid;
          container.dataset.lastDecalSurface = impactMeta.surfaceId || 'wall';
          container.dataset.lastDecalStretch = impactMeta.elongation.toFixed(2);
          container.dataset.lastImpactMaterial = impactMeta.materialType;
          container.dataset.lastImpactRegime = impactMeta.regime;
          container.dataset.lastImpactAngleDeg = impactMeta.incidenceDeg.toFixed(1);
          container.dataset.lastImpactShapeFamily = String(impactMeta.shapeFamily);
          container.dataset.lastImpactOverlap = String(impactMeta.localOverlapCount);
          container.dataset.impactDrawCalls = String(telemetry.impactDrawCalls);
          container.dataset.impactPoolUtilization = telemetry.poolUtilizationRatio.toFixed(3);
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
        dec.mat.color.setHex(0xffffff);
        dec.mat.needsUpdate = true;
        dec.active = true;
        dec.ageMs = 2000;
        dec.emberGlow = 0;
        dec.isBlood = true;
        dec.mesh.position.set(
          x + (Math.random() - 0.5) * 0.35,
          0.018,
          z + (Math.random() - 0.5) * 0.35
        );
        normalVec.set(0, 1, 0);
        dec.mesh.quaternion.setFromUnitVectors(defaultForward, normalVec);
        dec.mesh.rotateZ(Math.random() * Math.PI * 2);
        const bloodDiam = (isHs ? 0.52 : 0.38) * (0.85 + Math.random() * 0.3);
        dec.mesh.scale.set(bloodDiam, bloodDiam, 1);
        dec.mesh.visible = true;
      }
    };

    // 7F. Complex Dynamic Multi-Stage Red Drum Explosion System (Zero-GC Pooled Volumetric Sprites)
    const explosionPointLight = new THREE.PointLight(0xff7b00, 0, 32, 1.35);
    vfxGroup.add(explosionPointLight);

    const CORE_FLASH_POOL_SIZE = 4;
    const explosionCoreFlashPool: ExplosionCoreFlashFX[] = [];
    const coreInnerGeo = new THREE.PlaneGeometry(1.6, 1.6);
    const coreOuterGeo = new THREE.PlaneGeometry(2.4, 2.4);
    for (let i = 0; i < CORE_FLASH_POOL_SIZE; i++) {
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        map: texSet.fireballCloudMap,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const outerMat = new THREE.MeshBasicMaterial({
        color: 0xff7b00,
        map: texSet.fireballCloudMap,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const grp = new THREE.Group();
      const mIn1 = new THREE.Mesh(coreInnerGeo, innerMat);
      const mIn2 = new THREE.Mesh(coreInnerGeo, innerMat);
      mIn2.rotation.y = Math.PI * 0.5;
      const mOut1 = new THREE.Mesh(coreOuterGeo, outerMat);
      const mOut2 = new THREE.Mesh(coreOuterGeo, outerMat);
      mOut2.rotation.y = Math.PI * 0.5;
      const mOut3 = new THREE.Mesh(coreOuterGeo, outerMat);
      mOut3.rotation.x = Math.PI * 0.5;
      grp.add(mIn1, mIn2, mOut1, mOut2, mOut3);
      grp.visible = false;
      vfxGroup.add(grp);
      explosionCoreFlashPool.push({
        group: grp,
        innerMat,
        outerMat,
        active: false,
        ageMs: 0,
        maxAgeMs: 280,
        maxScale: 4.4,
      });
    }
    let coreFlashCursor = 0;

    const EXPLOSION_PLUME_POOL_SIZE = 48;
    const explosionPlumePool: ExplosionPlumeFX[] = [];
    // Camera-facing volumetric billboard quad instead of solid geometric spheres
    const plumeGeo = new THREE.PlaneGeometry(1.38, 1.38);
    for (let i = 0; i < EXPLOSION_PLUME_POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        map: texSet.fireballCloudMap,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(plumeGeo, mat);
      mesh.visible = false;
      vfxGroup.add(mesh);
      explosionPlumePool.push({
        mesh,
        mat,
        active: false,
        delayMs: 0,
        ageMs: 0,
        maxAgeMs: 950,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        startScale: 0.7,
        endScale: 2.6,
        isSmoke: false,
      });
    }
    let plumeCursor = 0;

    const SHRAPNEL_POOL_SIZE = 28;
    const barrelShrapnelPool: BarrelShrapnelFX[] = [];
    const shrapnelGeo = new THREE.DodecahedronGeometry(0.12, 0);
    shrapnelGeo.scale(1.55, 0.38, 1.05);
    for (let i = 0; i < SHRAPNEL_POOL_SIZE; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: i % 3 === 0 ? 0xdc2626 : i % 3 === 1 ? 0x991b1b : 0x1e293b,
        emissive: 0xff6b00,
        emissiveIntensity: 1.6,
        roughness: 0.42,
        metalness: 0.82,
      });
      const mesh = new THREE.Mesh(shrapnelGeo, mat);
      mesh.visible = false;
      vfxGroup.add(mesh);
      barrelShrapnelPool.push({
        mesh,
        mat,
        active: false,
        ageMs: 0,
        maxAgeMs: 1550,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        bounces: 0,
      });
    }
    let shrapnelCursor = 0;

    const spawnBarrelExplosionVFX = (bx: number, bz: number) => {
      // 1. Dynamic High-Intensity Thermal PointLight Flash
      explosionPointLight.position.set(bx, 1.45, bz);
      explosionPointLight.color.setHex(0xff8c1a);
      explosionPointLight.intensity = 26.0;

      // 2. Blinding White-Gold Volumetric Core Detonation Flash
      const core = explosionCoreFlashPool[coreFlashCursor];
      coreFlashCursor = (coreFlashCursor + 1) % CORE_FLASH_POOL_SIZE;
      core.active = true;
      core.ageMs = 0;
      core.maxAgeMs = 280;
      core.maxScale = 4.6;
      core.group.position.set(bx, 1.05, bz);
      core.group.scale.setScalar(0.55);
      core.innerMat.opacity = 1;
      core.outerMat.opacity = 0.98;
      core.group.visible = true;

      // 3. Triple Supersonic Ground & Air Mach Shockwave Rings
      for (let w = 0; w < 3; w++) {
        const ring = ringPool[ringCursor];
        ringCursor = (ringCursor + 1) % RING_POOL_SIZE;
        ring.active = true;
        ring.ageMs = 0;
        ring.maxAgeMs = w === 0 ? 320 : w === 1 ? 460 : 580;
        ring.maxScale = w === 0 ? 58 : w === 1 ? 82 : 104;
        ring.mat.color.setHex(w === 0 ? 0xffffff : w === 1 ? 0xfef08a : 0xf97316);
        ring.mesh.position.set(bx, w === 2 ? 0.85 : 0.06 + w * 0.04, bz);
        normalVec.set(0, 1, 0);
        ring.mesh.quaternion.setFromUnitVectors(defaultForward, normalVec);
        ring.mesh.scale.setScalar(1.25);
        ring.mesh.visible = true;
      }

      // 4. Persistent Scorched Blast Crater Floor Decal with Glowing Thermal Ember Fissures
      const scorch = decalPool[decalCursor];
      decalCursor = (decalCursor + 1) % DECAL_POOL_SIZE;
      scorch.mat.map = texSet.blastScorchMap;
      scorch.mat.opacity = 0.99;
      scorch.mat.color.setHex(0xffb478);
      scorch.mat.needsUpdate = true;
      scorch.active = true;
      scorch.ageMs = 0;
      scorch.emberGlow = 1.0;
      scorch.isBlood = false;
      scorch.mesh.position.set(bx, 0.019, bz);
      normalVec.set(0, 1, 0);
      scorch.mesh.quaternion.setFromUnitVectors(defaultForward, normalVec);
      scorch.mesh.rotateZ(Math.random() * Math.PI * 2);
      scorch.mesh.scale.set(3.6, 3.6, 1);
      scorch.mesh.visible = true;

      // 5. Volumetric Camera-Facing Pyroclastic Fireball Billows + Staggered Fuel-Air Sub-Blasts + Mushroom Smoke + Ground Fire
      const plumeCount = isLow ? 22 : 36;
      for (let i = 0; i < plumeCount; i++) {
        const pl = explosionPlumePool[plumeCursor];
        plumeCursor = (plumeCursor + 1) % EXPLOSION_PLUME_POOL_SIZE;
        const isLingeringGroundFire = i >= plumeCount - (isLow ? 4 : 6);
        const isSmoke = !isLingeringGroundFire && i >= Math.floor(plumeCount * 0.52);
        const isSecondaryWave =
          !isSmoke && !isLingeringGroundFire && i >= Math.floor(plumeCount * 0.28);
        const angle = (i / plumeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;

        if (isLingeringGroundFire) {
          const gfDist = 0.18 + Math.random() * 1.15;
          pl.active = true;
          pl.delayMs = 120 + Math.random() * 240;
          pl.ageMs = 0;
          pl.maxAgeMs = 1450 + Math.random() * 850;
          pl.isSmoke = false;
          pl.startScale = 0.55 + Math.random() * 0.35;
          pl.endScale = 1.15 + Math.random() * 0.45;
          pl.mesh.position.set(
            bx + Math.cos(angle) * gfDist,
            0.32 + Math.random() * 0.22,
            bz + Math.sin(angle) * gfDist
          );
          pl.vx = (Math.random() - 0.5) * 0.35;
          pl.vy = 0.42 + Math.random() * 0.45;
          pl.vz = (Math.random() - 0.5) * 0.35;
          pl.rx = 0;
          pl.ry = 0;
          pl.rz = (Math.random() - 0.5) * 3.2;
          pl.mat.blending = THREE.AdditiveBlending;
          pl.mat.color.setHex(0xf97316);
          pl.mat.opacity = 0;
          pl.mat.needsUpdate = true;
          pl.mesh.scale.setScalar(pl.startScale);
          pl.mesh.visible = false;
          continue;
        }

        const radialDist = isSmoke
          ? 0.25 + Math.random() * 0.95
          : isSecondaryWave
            ? 0.65 + Math.random() * 1.35
            : 0.12 + Math.random() * 0.65;

        pl.active = true;
        pl.delayMs = isSecondaryWave
          ? 55 + Math.random() * 125
          : isSmoke
            ? 35 + Math.random() * 95
            : 0;
        pl.ageMs = 0;
        pl.maxAgeMs = isSmoke
          ? 1350 + Math.random() * 650
          : isSecondaryWave
            ? 680 + Math.random() * 280
            : 580 + Math.random() * 240;
        pl.isSmoke = isSmoke;
        pl.startScale = isSmoke ? 0.85 + Math.random() * 0.45 : 0.75 + Math.random() * 0.45;
        pl.endScale = isSmoke ? 3.2 + Math.random() * 1.4 : 2.45 + Math.random() * 1.15;

        pl.mesh.position.set(
          bx + Math.cos(angle) * radialDist,
          0.48 + Math.random() * 0.85,
          bz + Math.sin(angle) * radialDist
        );
        const outSpd = isSmoke ? 1.5 + Math.random() * 2.4 : 3.2 + Math.random() * 4.8;
        pl.vx = Math.cos(angle) * outSpd;
        pl.vy = isSmoke ? 3.8 + Math.random() * 3.2 : 2.6 + Math.random() * 4.2;
        pl.vz = Math.sin(angle) * outSpd;
        pl.rx = Math.random() * Math.PI * 2;
        pl.ry = 0;
        pl.rz = (Math.random() - 0.5) * 3.8;

        pl.mat.blending = isSmoke ? THREE.NormalBlending : THREE.AdditiveBlending;
        pl.mat.color.setHex(isSmoke ? 0x334155 : 0xfef08a);
        pl.mat.opacity = pl.delayMs > 0 ? 0 : 0.98;
        pl.mat.needsUpdate = true;
        pl.mesh.scale.setScalar(pl.startScale);
        pl.mesh.visible = pl.delayMs <= 0;
      }

      // 6. Ballistic Burning Red Steel Drum Shrapnel + Blown Drum Lid Chunks with Sparking Floor Bounce
      const shrapCount = isLow ? 12 : 22;
      for (let i = 0; i < shrapCount; i++) {
        const sh = barrelShrapnelPool[shrapnelCursor];
        shrapnelCursor = (shrapnelCursor + 1) % SHRAPNEL_POOL_SIZE;
        const isDrumLid = i === 0;
        const ang = (i / shrapCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const spd = isDrumLid ? 2.2 + Math.random() * 2.5 : 6.0 + Math.random() * 9.2;
        sh.active = true;
        sh.ageMs = 0;
        sh.maxAgeMs = 1250 + Math.random() * 600;
        sh.bounces = 0;
        sh.mesh.position.set(
          bx + Math.cos(ang) * (isDrumLid ? 0.08 : 0.35),
          isDrumLid ? 1.15 : 0.55 + Math.random() * 0.65,
          bz + Math.sin(ang) * (isDrumLid ? 0.08 : 0.35)
        );
        sh.vx = Math.cos(ang) * spd;
        sh.vy = isDrumLid ? 11.5 + Math.random() * 3.5 : 5.8 + Math.random() * 8.4;
        sh.vz = Math.sin(ang) * spd;
        sh.rx = (Math.random() - 0.5) * 24;
        sh.ry = (Math.random() - 0.5) * 24;
        sh.rz = (Math.random() - 0.5) * 24;
        sh.mat.emissiveIntensity = 1.85;
        sh.mesh.scale.setScalar(isDrumLid ? 2.1 : 0.85 + Math.random() * 0.85);
        sh.mesh.visible = true;
      }

      // 7. High-Velocity White-Hot Sparks & Incandescent Fuel Droplet Streamers
      spawnImpactBurst(bx, 0.95, bz, 0, 1, 0, 0xffffff, isLow ? 14 : 24, 2.55, 1.85);
      spawnImpactBurst(bx, 0.85, bz, 0, 1, 0, 0xfef08a, isLow ? 18 : 30, 2.25, 2.05);
      spawnImpactBurst(bx, 0.68, bz, 0, 1, 0, 0xf97316, isLow ? 16 : 28, 1.9, 2.4);
      spawnImpactBurst(bx, 0.48, bz, 0, 1, 0, 0xdc2626, isLow ? 12 : 20, 1.5, 2.7);

      if (container) {
        container.dataset.lastBarrelBlastX = bx.toFixed(2);
        container.dataset.lastBarrelBlastZ = bz.toFixed(2);
        container.dataset.activeExplosionPlumes = String(plumeCount);
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

    // Weapon viewmodel spring sway, smooth locomotion blend, physical 3D recoil & arm transition state
    let swayYaw = 0;
    let swayPitch = 0;
    let swayRoll = 0;
    let strafeRoll = 0;
    let landDipY = 0;
    let landRollImpulse = 0;
    let jumpImpulseY = 0;
    let stepImpactDipY = 0;
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
    let fpWeaponKickZ = 0;
    let fpWeaponKickPitch = 0;
    let fpWeaponKickRoll = 0;

    // Unified FPV <-> TPV transition blend (0 = First-Person, 1 = Third-Person) & 360° 3rd-person camera orbit
    let tpViewBlend = firstPersonModeRef.current ? 0 : 1;
    let tpOrbitYawOffset = 0;
    let tpOrbitPitchOffset = 0.18;
    const fpCamPos = new THREE.Vector3();
    const tpCamPos = new THREE.Vector3();
    const fpCamQuat = new THREE.Quaternion();
    const tpCamQuat = new THREE.Quaternion();
    const orbitLookTarget = new THREE.Vector3();
    const orbitDummyCam = new THREE.PerspectiveCamera();

    // Pre-allocated scratch vectors & objects for 60fps combat loop (zero GC churn)
    const tracerStartVec = new THREE.Vector3();
    const tracerEndVec = new THREE.Vector3();
    const tracerMidVec = new THREE.Vector3();
    const _muzzleWorldPos = new THREE.Vector3();
    const subInputScratch: PlayerInputSnapshot = {
      moveX: 0,
      moveZ: 0,
      lookDeltaYaw: 0,
      lookDeltaPitch: 0,
      sprintHeld: false,
      jumpPressed: false,
      crouchToggled: false,
      slidePressed: false,
      fireHeld: false,
      fireJustPressed: false,
      adsHeld: false,
      reloadPressed: false,
      selectWeapon: null,
      cycleWeaponDelta: 0,
    };
    const combatKinematicsScratch: CombatWeaponKinematicsInput = {
      swayPosX: 0,
      swayPosY: 0,
      swayPosZ: 0,
      swayYaw: 0,
      swayPitch: 0,
      swayRoll: 0,
      strafeRoll: 0,
      wallObstruction: 0,
      wallBumpWave: 0,
      recoilKickZ: 0,
      recoilKickPitch: 0,
      recoilKickRoll: 0,
      landDipY: 0,
      jumpImpulseY: 0,
      landRollImpulse: 0,
      airborneLift: 0,
      airbornePitch: 0,
      triggerPullBlend: 0,
      muzzleFlashActive: false,
      fireCooldownRatio: 0,
      magAmmoCount: 30,
      isFirstHalfSwap: false,
      swapHalfProgress: 0,
      weaponRig: undefined,
    };
    const weaponSwayState: WeaponSwayPhysicsState = createWeaponSwayPhysicsState();
    const weaponSwayInputScratch: WeaponSwayStepInput = {
      weaponId: 'm4a1',
      lookDeltaYaw: 0,
      lookDeltaPitch: 0,
      localVelRight: 0,
      localVelFwd: 0,
      velY: 0,
      moveSpeed: 0,
      walkBobPhase: 0,
      adsBlend: 0,
      isCrouching: false,
      isSprinting: false,
      isSliding: false,
      isGrounded: true,
    };

    // HUD dirty-check cache to prevent redundant DOM style/text writes at 60fps
    let lastHpPctStr = '';
    let lastHpTextStr = '';
    let lastSlot1Text = '';
    let lastSlot2Text = '';
    let lastKillsText = '';
    let lastBotKillsText = '';
    let lastTimerText = '';
    let lastChOpacityStr = '';
    let smoothedChGapPx = 13.0;
    let lastChGapStr = '';
    let lastChTickLenStr = '';
    let lastChDotScaleStr = '';
    let lastChColorStr = '';
    let lastChWeaponStr = '';
    let lastSlideOpacityStr = '';
    let lastHitMarkerOpacityStr = '';
    let lastHurtOpacityStr = '';

    const onKeyDown = (e: KeyboardEvent) => {
      if (screenStateRef.current !== 'combat') return;
      keysDown.add(e.code);

      const kb = settingsRef.current.keybindings;
      if (e.code === kb.jump) jumpQueued = true;
      if (e.code === kb.crouch || e.code === 'KeyC') crouchToggleQueued = true;
      if (e.code === kb.slide || e.code === 'KeyX') slideQueued = true;
      if (e.code === 'KeyV' || e.code === kb.toggleView) {
        onToggleFirstPersonRef.current?.();
        soundEngine.play('ui_click');
      }
      if ((e.code === kb.fire || e.code === 'KeyJ' || e.code === 'KeyF') && !e.repeat) {
        mouseFireJustPressed = true;
      }
      if (e.code === kb.reload || e.code === 'KeyR') reloadQueued = true;
      if (e.code === kb.nextWeapon || e.code === 'KeyQ') queuedWeaponCycle = 1;

      const pair = simRef.current.player.loadoutWeapons;
      if (e.code === 'Digit1') queuedWeaponSelect = pair[0];
      if (e.code === 'Digit2') queuedWeaponSelect = pair[1];
      if (e.code === 'Digit3') queuedWeaponSelect = 'mp5';
      if (e.code === 'Digit4') queuedWeaponSelect = 'spas12';
      if (e.code === 'Digit5') queuedWeaponSelect = 'ak47';
      if (e.code === 'Digit6') queuedWeaponSelect = 'deagle';
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.code);
    };

    let mouseLookDragHeld = false;
    let lastMousePos: { x: number; y: number } | null = null;

    // 3D Lobby Turntable & Vault Painting Studio Raycast State
    let charTurntableYaw = 0;
    let charTargetYaw: number | null = null;
    let charOrbitPitch = 0.03;
    let charZoomDist = 2.65;
    let charTargetZoomDist = 2.65;
    let charLookY = 0.84;
    let charTargetLookY = 0.84;
    let charSwitchScaleAnim = 1.0;
    let lastFocusPreset: CameraFocusPreset = cameraFocusPresetRef.current;
    let lastResetTrigger = cameraResetTriggerRef.current;
    let lastZoomDeltaSeq = 0;
    let lastStudioTexRev = -1;
    let lastEquippedTexRev = -1;
    let lastHoveredRegion: BodyRegionId | null = null;

    const paintRaycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let isPainting3DStroke = false;
    let isLobbyOrbitDragging = false;
    let lastLobbyPointerPos: { x: number; y: number } | null = null;
    let lastPaintUV: { u: number; v: number; region: BodyRegionId } | null = null;
    let paintShapeStart: { u: number; v: number; region: BodyRegionId } | null = null;
    let paintShapeLayerBackup: Uint8ClampedArray | null = null;

    const getActiveStudioLayer = (): PaintLayer | null => {
      const layers = studioLayersRef?.current;
      if (!layers || layers.length === 0) return null;
      return (
        layers.find((l) => l.id === activeLayerIdRef.current) ||
        layers[layers.length - 1]
      );
    };

    const raycastCharacterMesh = (
      clientX: number,
      clientY: number
    ): {
      uv: THREE.Vector2;
      region: BodyRegionId;
      point: THREE.Vector3;
      normal: THREE.Vector3;
    } | null => {
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      paintRaycaster.setFromCamera(pointerNdc, camera);
      const hits = paintRaycaster.intersectObjects(
        lobbyCharRig.paintableMeshes,
        false
      );
      for (const h of hits) {
        const reg = h.object.userData.bodyRegion as BodyRegionId | undefined;
        if (h.uv && reg) {
          const worldNormal = h.face
            ? h.face.normal
                .clone()
                .transformDirection(h.object.matrixWorld)
                .normalize()
            : new THREE.Vector3(0, 0, 1);
          return {
            uv: h.uv.clone(),
            region: reg,
            point: h.point.clone(),
            normal: worldNormal,
          };
        }
      }
      return null;
    };

    const isUiElementTarget = (target: EventTarget | null): boolean => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      return Boolean(
        el.closest(
          'button, input, select, textarea, label, [role="button"], [role="dialog"], [data-ui-interactive="true"], [data-ui-panel="true"]'
        )
      );
    };

    const onPointerDown = (e: PointerEvent) => {
      const isLobbyScreen =
        screenStateRef.current !== 'combat' &&
        screenStateRef.current !== 'paused' &&
        screenStateRef.current !== 'match_result';
      if (!isLobbyScreen) return;
      if (isUiElementTarget(e.target)) return;

      lastLobbyPointerPos = { x: e.clientX, y: e.clientY };
      charTargetYaw = null;

      const isStudioActive =
        activeLobbyTabRef.current === 'painting_studio' ||
        (activeLobbyTabRef.current === 'vault' &&
          vaultSubTabRef.current === 'studio');

      if (
        isStudioActive &&
        e.button === 0 &&
        studioInteractionModeRef.current === 'paint' &&
        !e.altKey
      ) {
        const hit = raycastCharacterMesh(e.clientX, e.clientY);
        const bs = brushSettingsRef.current;
        if (
          hit &&
          (bs.isolatedRegion === 'all' || bs.isolatedRegion === hit.region)
        ) {
          if (bs.tool === 'eyedropper') {
            if (studioLayersRef?.current) {
              const hex = sampleColorAtUV(
                studioLayersRef.current,
                hit.uv.x,
                hit.uv.y
              );
              onEyedropperSampledRef.current?.(hex);
            }
            return;
          }

          const activeLayer = getActiveStudioLayer();
          if (!activeLayer || !activeLayer.visible) return;

          onPaintStrokeBeforeStartRef.current?.();

          if (bs.tool === 'bucket') {
            applyBucketFillToLayer(
              activeLayer,
              hit.uv.x,
              hit.uv.y,
              bs,
              hit.region
            );
            if (studioLayersRef?.current) {
              syncLayersToCharacterRigTexture(
                lobbyCharRig,
                studioLayersRef.current
              );
            }
            onPaintStrokeCommittedRef.current?.();
            return;
          }

          if (bs.tool === 'gradient_fill') {
            applyGradientFillToLayer(
              activeLayer,
              hit.uv.x,
              hit.uv.y,
              bs,
              hit.region
            );
            if (studioLayersRef?.current) {
              syncLayersToCharacterRigTexture(
                lobbyCharRig,
                studioLayersRef.current
              );
            }
            onPaintStrokeCommittedRef.current?.();
            return;
          }

          if (
            bs.tool === 'rect' ||
            bs.tool === 'circle' ||
            bs.tool === 'stripe_stamp' ||
            bs.tool === 'camo_stamp'
          ) {
            applyGeometricShapeToLayer(
              activeLayer,
              hit.uv.x,
              hit.uv.y,
              bs.tool,
              bs,
              hit.region
            );
            if (studioLayersRef?.current) {
              syncLayersToCharacterRigTexture(
                lobbyCharRig,
                studioLayersRef.current
              );
            }
            onPaintStrokeCommittedRef.current?.();
            return;
          }

          if (bs.tool === 'line') {
            paintShapeStart = {
              u: hit.uv.x,
              v: hit.uv.y,
              region: hit.region,
            };
            paintShapeLayerBackup = new Uint8ClampedArray(activeLayer.data);
            isPainting3DStroke = true;
            return;
          }

          // Brush or Eraser
          isPainting3DStroke = true;
          lastPaintUV = { u: hit.uv.x, v: hit.uv.y, region: hit.region };
          const allowedReg =
            bs.isolatedRegion !== 'all' ? bs.isolatedRegion : hit.region;
          applyBrushStrokeSegment(
            activeLayer,
            hit.uv.x,
            hit.uv.y,
            hit.uv.x,
            hit.uv.y,
            bs,
            allowedReg
          );
          if (studioLayersRef?.current) {
            syncLayersToCharacterRigTexture(
              lobbyCharRig,
              studioLayersRef.current
            );
          }
          return;
        }
      }

      // Clicking outside the model or right-clicking / orbit mode rotates the character
      isLobbyOrbitDragging = true;
    };

    const onPointerMove = (e: PointerEvent) => {
      const isLobbyScreen =
        screenStateRef.current !== 'combat' &&
        screenStateRef.current !== 'paused' &&
        screenStateRef.current !== 'match_result';
      if (!isLobbyScreen) {
        brushCursorRing.visible = false;
        return;
      }

      const isStudioActive =
        activeLobbyTabRef.current === 'painting_studio' ||
        (activeLobbyTabRef.current === 'vault' &&
          vaultSubTabRef.current === 'studio');

      // Update 3D Surface Brush Cursor & Hovered Body Region in Studio
      if (isStudioActive && !isLobbyOrbitDragging) {
        const hoverHit = isUiElementTarget(e.target)
          ? null
          : raycastCharacterMesh(e.clientX, e.clientY);
        const nextReg = hoverHit ? hoverHit.region : null;
        if (nextReg !== lastHoveredRegion) {
          lastHoveredRegion = nextReg;
          onHoverBodyRegionRef.current?.(nextReg);
        }
        if (hoverHit) {
          const bs = brushSettingsRef.current;
          brushCursorMat.color.set(
            bs.tool === 'eraser' ? '#38bdf8' : bs.colorHex
          );
          brushCursorRing.position
            .copy(hoverHit.point)
            .addScaledVector(hoverHit.normal, 0.008);
          brushCursorRing.quaternion.setFromUnitVectors(
            defaultForward,
            hoverHit.normal
          );
          const cursorScale = Math.max(0.28, (bs.size / 16) * 0.95);
          brushCursorRing.scale.setScalar(cursorScale);
          brushCursorRing.visible = true;
        } else {
          brushCursorRing.visible = false;
        }
      } else {
        brushCursorRing.visible = false;
        if (lastHoveredRegion !== null) {
          lastHoveredRegion = null;
          onHoverBodyRegionRef.current?.(null);
        }
      }

      if (isPainting3DStroke && isStudioActive) {
        const hit = raycastCharacterMesh(e.clientX, e.clientY);
        const bs = brushSettingsRef.current;
        const activeLayer = getActiveStudioLayer();
        if (
          hit &&
          activeLayer &&
          activeLayer.visible &&
          (bs.isolatedRegion === 'all' || bs.isolatedRegion === hit.region)
        ) {
          if (
            paintShapeStart &&
            paintShapeLayerBackup &&
            bs.tool === 'line'
          ) {
            activeLayer.data.set(paintShapeLayerBackup);
            applyBrushStrokeSegment(
              activeLayer,
              paintShapeStart.u,
              paintShapeStart.v,
              hit.uv.x,
              hit.uv.y,
              bs,
              paintShapeStart.region
            );
            if (studioLayersRef?.current) {
              syncLayersToCharacterRigTexture(
                lobbyCharRig,
                studioLayersRef.current
              );
            }
          } else {
            let u = hit.uv.x;
            let v = hit.uv.y;
            const allowedReg =
              bs.isolatedRegion !== 'all' ? bs.isolatedRegion : hit.region;

            if (
              lastPaintUV &&
              lastPaintUV.region === hit.region &&
              Math.hypot(u - lastPaintUV.u, v - lastPaintUV.v) < 0.18
            ) {
              const smooth = Math.max(0, Math.min(0.75, bs.smoothing * 0.65));
              u = lastPaintUV.u * smooth + u * (1 - smooth);
              v = lastPaintUV.v * smooth + v * (1 - smooth);
              applyBrushStrokeSegment(
                activeLayer,
                lastPaintUV.u,
                lastPaintUV.v,
                u,
                v,
                bs,
                allowedReg
              );
            } else {
              applyBrushStrokeSegment(activeLayer, u, v, u, v, bs, allowedReg);
            }
            lastPaintUV = { u, v, region: hit.region };
            if (studioLayersRef?.current) {
              syncLayersToCharacterRigTexture(
                lobbyCharRig,
                studioLayersRef.current
              );
            }
          }
        }
        return;
      }

      if (isLobbyOrbitDragging && lastLobbyPointerPos) {
        const dx = e.clientX - lastLobbyPointerPos.x;
        const dy = e.clientY - lastLobbyPointerPos.y;
        charTurntableYaw += dx * 0.01;
        charOrbitPitch = THREE.MathUtils.clamp(
          charOrbitPitch + dy * 0.0045,
          -0.28,
          0.42
        );
        lastLobbyPointerPos = { x: e.clientX, y: e.clientY };
      }
    };

    const onPointerUp = () => {
      if (isPainting3DStroke) {
        isPainting3DStroke = false;
        lastPaintUV = null;
        paintShapeStart = null;
        paintShapeLayerBackup = null;
        onPaintStrokeCommittedRef.current?.();
      }
      isLobbyOrbitDragging = false;
      lastLobbyPointerPos = null;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (
        screenStateRef.current !== 'combat' ||
        loadoutOverlayOpenRef.current ||
        backpackOpenRef.current
      )
        return;
      if (isUiElementTarget(e.target)) return;

      lastMousePos = { x: e.clientX, y: e.clientY };
      mouseLookDragHeld = true;

      if (e.button === 0 && document.pointerLockElement === renderer.domElement) {
        mouseFireJustPressed = true;
        mouseFireHeld = true;
      }
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
      if (
        screenStateRef.current !== 'combat' ||
        loadoutOverlayOpenRef.current ||
        backpackOpenRef.current
      )
        return;
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
      if (isUiElementTarget(e.target)) return;
      if (screenStateRef.current === 'combat') {
        if (Math.abs(e.deltaY) > 4) {
          queuedWeaponCycle = e.deltaY > 0 ? 1 : -1;
        }
      } else {
        charTargetZoomDist = THREE.MathUtils.clamp(
          charTargetZoomDist + (e.deltaY > 0 ? 0.22 : -0.22),
          1.35,
          4.4
        );
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      if (!isUiElementTarget(e.target)) {
        e.preventDefault();
      }
    };

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    const onWindowBlur = () => {
      mouseAdsHeld = false;
      mouseFireHeld = false;
      mouseLookDragHeld = false;
      lastMousePos = null;
      keysDown.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('resize', onResize);
    window.addEventListener('blur', onWindowBlur);

    // 9. Main 60fps Game Loop (with software-WebGL main-thread yield so headless browser clicks never stall)
    let rafId = 0;
    let softGlTimerId = 0;
    let isDisposed = false;
    let lastTime = performance.now();
    let fireBufferTimerMs = 0;

    const afterDraw = () => {
      if (isDisposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync =
        gl && typeof gl.fenceSync === 'function'
          ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
          : null;
      if (gl && typeof gl.flush === 'function') gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          softGlTimerId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          softGlTimerId = window.setTimeout(() => {
            if (!isDisposed) {
              rafId = requestAnimationFrame(animate);
            }
          }, 80);
        }
      };
      softGlTimerId = window.setTimeout(poll, 5);
    };

    const animate = (now: number) => {
      if (!isSoftwareGl && !isDisposed) {
        rafId = requestAnimationFrame(animate);
      }
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), isSoftwareGl ? 0.25 : 0.05);
      const dtMs = dt * 1000;

      const sim = simRef.current;

      if (currentBuiltArenaId !== arenaIdRef.current) {
        buildArenaGeometry(arenaIdRef.current);
        propMeshes.forEach((m) => propsGroup.remove(m));
        propMeshes.clear();
        bulletImpactSystem.clear();
      }
      if (settingsRef.current.particleQuality !== lastImpactQualitySetting) {
        lastImpactQualitySetting = settingsRef.current.particleQuality;
        bulletImpactSystem.setQualityProfile(lastImpactQualitySetting, isSoftwareGl);
      }

      const isCombatScene =
        screenStateRef.current === 'combat' ||
        screenStateRef.current === 'paused' ||
        screenStateRef.current === 'match_result';

      if (isCombatScene) {
        const isPausedOrOverlay =
          screenStateRef.current === 'paused' ||
          screenStateRef.current === 'match_result' ||
          loadoutOverlayOpenRef.current ||
          backpackOpenRef.current;

        let moveX = 0;
        let moveZ = 0;
        let fireHeld = false;
        let frameLookYawDelta = 0;
        let frameLookPitchDelta = 0;

        if (!sim.player.weaponOptics && settingsRef.current.weaponOptics) {
          sim.player.weaponOptics = { ...settingsRef.current.weaponOptics };
        }
        const activeOpticId = resolveEquippedOptic(
          sim.player.activeWeapon,
          sim.player.weaponOptics
        );
        const adsSensFactor = computeAimSensitivityMultiplier(
          sim.player.adsBlend,
          activeOpticId
        );

        if (!isPausedOrOverlay) {
          const kb = settingsRef.current.keybindings;
          const touch = touchInputRef.current;

          moveX = touch.moveX;
          moveZ = touch.moveZ;
          if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) moveX -= 1;
          if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) moveX += 1;
          if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) moveZ -= 1;
          if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) moveZ += 1;
          moveX = Math.max(-1, Math.min(1, moveX));
          moveZ = Math.max(-1, Math.min(1, moveZ));

          const sprintHeld =
            keysDown.has(kb.sprint) || keysDown.has('ShiftLeft') || touch.sprint;

          const sensMult = settingsRef.current.touchSensitivity ?? 1.0;
          const fireSensMult = settingsRef.current.fireSensitivity ?? 1.0;

          // Separate Camera Free-Look Sensitivity vs Fire-Button Joystick Aim Sensitivity
          // Both scale down smoothly when in ADS based on optic magnification (adsSensFactor: 1.00 / 0.70 / 0.50 / 0.35)
          const mouseSens = 0.0026 * sensMult * adsSensFactor;
          const touchSens = 0.0056 * sensMult * adsSensFactor;
          const fireSens = 0.0046 * fireSensMult * adsSensFactor;

          const freeLookYawDelta =
            mouseLookDeltaX * mouseSens +
            (touch.cameraDeltaX || 0) * touchSens;
          const freeLookPitchDelta =
            mouseLookDeltaY * mouseSens +
            (touch.cameraDeltaY || 0) * touchSens;
          const fireAimYawDelta = (touch.attackDragX || 0) * fireSens;
          const fireAimPitchDelta = (touch.attackDragY || 0) * fireSens;

          const lookYawDelta = freeLookYawDelta + fireAimYawDelta;
          const lookPitchDelta = freeLookPitchDelta + fireAimPitchDelta;
          frameLookYawDelta = lookYawDelta;
          frameLookPitchDelta = lookPitchDelta;

          mouseLookDeltaX = 0;
          mouseLookDeltaY = 0;
          touch.attackDragX = 0;
          touch.attackDragY = 0;
          touch.cameraDeltaX = 0;
          touch.cameraDeltaY = 0;

          const fireJustPressed = mouseFireJustPressed || touch.lightPressed;
          fireHeld =
            mouseFireHeld ||
            touch.lightHeld ||
            keysDown.has(kb.fire) ||
            keysDown.has('KeyJ') ||
            keysDown.has('KeyF');
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

          const freeLookEyeDragX = (touch.freeLookDeltaX || 0) * touchSens;
          const freeLookEyeDragY = (touch.freeLookDeltaY || 0) * touchSens;
          touch.freeLookDeltaX = 0;
          touch.freeLookDeltaY = 0;

          const isAltOrbit =
            !firstPersonModeRef.current &&
            !adsHeld &&
            !fireHeld &&
            (keysDown.has('AltLeft') || keysDown.has('AltRight'));
          const isEyeButtonOrbit =
            !firstPersonModeRef.current &&
            !adsHeld &&
            !fireHeld &&
            Boolean(touch.freeLookActive);

          // Standard look/drag ALWAYS rotates player.yaw and player.pitch in both 1st-person and 3rd-person
          // so the character and gun always aim & shoot directly where the player looks!
          // Holding the 360° Free-Look Eye button (or Alt key) orbits around the character to inspect front/back/sides.
          let playerYawDelta = lookYawDelta;
          let playerPitchDelta = lookPitchDelta;
          if (isEyeButtonOrbit) {
            tpOrbitYawOffset = Math.atan2(
              Math.sin(tpOrbitYawOffset - freeLookEyeDragX * 1.15),
              Math.cos(tpOrbitYawOffset - freeLookEyeDragX * 1.15)
            );
            tpOrbitPitchOffset = THREE.MathUtils.clamp(
              tpOrbitPitchOffset + freeLookEyeDragY * 0.95,
              -0.72,
              0.92
            );
          } else if (isAltOrbit) {
            tpOrbitYawOffset = Math.atan2(
              Math.sin(tpOrbitYawOffset - freeLookYawDelta * 1.15),
              Math.cos(tpOrbitYawOffset - freeLookYawDelta * 1.15)
            );
            tpOrbitPitchOffset = THREE.MathUtils.clamp(
              tpOrbitPitchOffset + freeLookPitchDelta * 0.95,
              -0.72,
              0.92
            );
            playerYawDelta = fireAimYawDelta;
            playerPitchDelta = fireAimPitchDelta;
          } else {
            // Smoothly keep camera aligned over-the-shoulder with player's aim ray
            const alignAlpha = Math.min(1, dt * (fireHeld || adsHeld ? 18 : 12));
            tpOrbitYawOffset += (0 - tpOrbitYawOffset) * alignAlpha;
            tpOrbitPitchOffset += (0.14 - tpOrbitPitchOffset) * alignAlpha;
          }

          const pendingSelectWeapon = queuedWeaponSelect;
          const pendingCycleWeapon = queuedWeaponCycle;
          queuedWeaponSelect = null;
          queuedWeaponCycle = 0;

          if (fireJustPressed) {
            fireBufferTimerMs = 450;
          }

          const prevRoundOver = sim.roundOver;
          let remainingDt = dt;
          let firstSubStep = true;
          while (remainingDt > 0.0001) {
            const subDt = Math.min(remainingDt, 0.05);
            remainingDt -= subDt;
            const willReadyThisStep =
              sim.player.weaponSwitchTimerMs <= subDt * 1000 &&
              sim.player.fireCooldownMs <= subDt * 1000;
            const triggerFire =
              fireBufferTimerMs > 0 && willReadyThisStep;

            subInputScratch.moveX = moveX;
            subInputScratch.moveZ = moveZ;
            subInputScratch.sprintHeld = sprintHeld;
            subInputScratch.fireHeld = fireHeld;
            subInputScratch.adsHeld = adsHeld;
            subInputScratch.aimMode = Boolean(touch.aimHeld)
              ? 'hold'
              : (settingsRef.current.aimMode ?? 'hold');
            if (firstSubStep) {
              subInputScratch.lookDeltaYaw = playerYawDelta;
              subInputScratch.lookDeltaPitch = playerPitchDelta;
              subInputScratch.jumpPressed = jumpPressed;
              subInputScratch.crouchToggled = crouchToggled;
              subInputScratch.slidePressed = slidePressed;
              subInputScratch.reloadPressed = reloadPressed;
              subInputScratch.selectWeapon = pendingSelectWeapon;
              subInputScratch.cycleWeaponDelta = pendingCycleWeapon;
              subInputScratch.fireJustPressed =
                triggerFire || (fireJustPressed && willReadyThisStep);
            } else {
              subInputScratch.lookDeltaYaw = 0;
              subInputScratch.lookDeltaPitch = 0;
              subInputScratch.jumpPressed = false;
              subInputScratch.crouchToggled = false;
              subInputScratch.slidePressed = false;
              subInputScratch.reloadPressed = false;
              subInputScratch.selectWeapon = null;
              subInputScratch.cycleWeaponDelta = 0;
              subInputScratch.fireJustPressed = triggerFire;
            }

            const subEvents = stepSimulation(
              sim,
              subDt,
              subInputScratch,
              botDifficultyRef.current,
              gameModeRef.current === 'training',
              trainingConfigRef.current
            );
            let p1FiredThisSub = false;
            for (let ei = 0; ei < subEvents.length; ei++) {
              const evt = subEvents[ei];
              if (evt.type === 'shot_fired' && evt.actor === 'p1') {
                p1FiredThisSub = true;
              }
              if (evt.type === 'shot_fired') {
                const firedWid = evt.weaponId || sim.player.activeWeapon;
                const wSpec = WEAPON_REGISTRY[firedWid];
                soundEngine.play(wSpec ? wSpec.soundId : 'shot_m4a1');
                const kickMult =
                  firedWid === 'awp'
                    ? 2.15
                    : firedWid === 'spas12'
                    ? 1.95
                    : firedWid === 'deagle'
                    ? 1.75
                    : firedWid === 'ak47'
                    ? 1.38
                    : firedWid === 'm4a1'
                    ? 1.05
                    : 0.82;
                const adsStabilize = 1 - sim.player.adsBlend * 0.35;
                fpWeaponKickZ = Math.min(0.12, fpWeaponKickZ + 0.036 * kickMult * adsStabilize);
                fpWeaponKickPitch = Math.min(
                  0.28,
                  fpWeaponKickPitch + 0.072 * kickMult * adsStabilize
                );
                fpWeaponKickRoll += (Math.random() - 0.42) * 0.048 * kickMult * adsStabilize;
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
                const surf = evt.surface || sim.player.currentSurface;
                const intensity = evt.stepIntensity || 'walk';
                soundEngine.playFootstep(surf, intensity, sim.player.footstepCount);
                const impScale =
                  intensity === 'land'
                    ? 1.25
                    : intensity === 'sprint'
                    ? 1.0
                    : intensity === 'crouch'
                    ? 0.45
                    : 0.75;
                stepImpactDipY = -0.012 * impScale;
              } else if (evt.type === 'slide_start') {
                soundEngine.play('ui_click');
              } else if (evt.type === 'barrel_explode') {
                soundEngine.play('ko');
                if (evt.x !== undefined && evt.z !== undefined) {
                  spawnBarrelExplosionVFX(evt.x, evt.z);
                }
                onCombatEventRef.current(evt);
              } else if (evt.type === 'weapon_switch') {
                soundEngine.play('ui_click');
                onCombatEventRef.current(evt);
              } else if (evt.type === 'reload_start') {
                soundEngine.play('reload_start');
              } else if (evt.type === 'reload_done') {
                soundEngine.play('reload_done');
              } else if (evt.type === 'player_hurt') {
                soundEngine.play('hit_heavy');
              }
            }
            if (p1FiredThisSub) {
              fireBufferTimerMs = 0;
            } else if (fireBufferTimerMs > 0) {
              fireBufferTimerMs = Math.max(0, fireBufferTimerMs - subDt * 1000);
            }
            firstSubStep = false;
          }

          if (!prevRoundOver && sim.roundOver && sim.roundWinner) {
            onRoundFinishedRef.current(sim.roundWinner);
          }
        } else {
          // In pause menu or loadout overlay: consume and discard inputs so they don't buffer
          mouseLookDeltaX = 0;
          mouseLookDeltaY = 0;
          mouseFireJustPressed = false;
          jumpQueued = false;
          reloadQueued = false;
          crouchToggleQueued = false;
          slideQueued = false;
          touchInputRef.current.cameraDeltaX = 0;
          touchInputRef.current.cameraDeltaY = 0;
          touchInputRef.current.attackDragX = 0;
          touchInputRef.current.attackDragY = 0;
          queuedWeaponSelect = null;
          queuedWeaponCycle = 0;
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
        stepImpactDipY *= Math.exp(-16 * dt);

        const targetAirLift = !p.isGrounded
          ? THREE.MathUtils.clamp(p.vy * 0.0042, -0.026, 0.026)
          : 0;
        const targetAirPitch = !p.isGrounded
          ? THREE.MathUtils.clamp(-p.vy * 0.016, -0.11, 0.11)
          : 0;
        airborneLift += (targetAirLift - airborneLift) * Math.min(1, dt * 12);
        airbornePitch += (targetAirPitch - airbornePitch) * Math.min(1, dt * 12);

        const liveOpticId = resolveEquippedOptic(
          p.activeWeapon,
          p.weaponOptics
        );
        const composedFov = computeComposedCameraFOV({
          baseFov: settingsRef.current.baseFov ?? 90,
          adsProgress: p.adsBlend,
          opticId: liveOpticId,
          isSliding: p.isSliding,
          isSprinting: p.isSprinting,
          recoilFovKickDeg: fpWeaponKickPitch * 6.5,
        });
        if (Math.abs(camera.fov - composedFov) > 0.01) {
          camera.fov = composedFov;
          camera.updateProjectionMatrix();
        }
        if (container) {
          container.dataset.cameraFov = camera.fov.toFixed(2);
          container.dataset.adsStage = p.adsState.stage;
          container.dataset.adsProgress = p.adsBlend.toFixed(3);
          container.dataset.equippedOptic = liveOpticId;
          container.dataset.aimSensitivityMult = computeAimSensitivityMultiplier(
            p.adsBlend,
            liveOpticId
          ).toFixed(3);
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

        // Clean, smooth figure-8 stride glide synchronized 1:1 with footsteps (1 step = PI radians)
        const strideLateral = Math.sin(p.walkBobPhase);
        const strideVertical = -Math.cos(p.walkBobPhase * 2);
        const adsBobDamp = 1 - p.adsBlend * 0.78;
        const sprintAmp = p.isSprinting ? 1.15 : p.isCrouching ? 0.55 : 0.9;

        const bobX =
          strideLateral * 0.024 * sprintAmp * moveBobBlend * adsBobDamp +
          idleBreathX * (1 - moveBobBlend);
        const bobY =
          (strideVertical * 0.024 * sprintAmp + stepImpactDipY) *
            moveBobBlend *
            adsBobDamp +
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

        // Synchronize Equipped Chameleon Character Rig & Custom Paint Texture for Combat
        if (currentLobbyCharId !== p1CharRef.current) {
          currentLobbyCharId = p1CharRef.current;
          turntableGroup.remove(lobbyCharRig.root);
          lobbyCharRig.dispose();
          lobbyCharRig = buildChameleonHumanoidRig(currentLobbyCharId, maxAnisotropy);
          lobbyWeaponProp = buildCompactHandheldWeaponProp(currentLobbyWeaponId);
          lobbyCharRig.weaponMount.add(lobbyWeaponProp);
          turntableGroup.add(lobbyCharRig.root);

          scene.remove(combatPlayerRig.root);
          combatPlayerRig.dispose();
          combatPlayerRig = buildChameleonHumanoidRig(currentLobbyCharId, maxAnisotropy);
          combatWeaponProp = buildCompactHandheldWeaponProp(currentLobbyWeaponId, true);
          combatPlayerRig.weaponMount.add(combatWeaponProp);
          scene.add(combatPlayerRig.root);
          fpRightArm.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) {
              (c as THREE.Mesh).material = combatPlayerRig.paintMaterial;
            }
          });
          fpLeftArm.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) {
              (c as THREE.Mesh).material = combatPlayerRig.paintMaterial;
            }
          });
          lastEquippedTexRev = -1;
          lastStudioTexRev = -1;
        }

        if (lastEquippedTexRev !== equippedDesignRevisionRef.current) {
          lastEquippedTexRev = equippedDesignRevisionRef.current;
          const eqBuf = equippedCompositeBufferRef?.current;
          if (eqBuf) {
            syncLayersToCharacterRigTexture(combatPlayerRig, eqBuf);
          } else {
            const ctx = combatPlayerRig.paintCanvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, 512, 512);
              combatPlayerRig.paintTexture.needsUpdate = true;
            }
          }
        }

        const isFp = firstPersonModeRef.current;
        const targetTpBlend = isFp ? 0 : 1;
        tpViewBlend += (targetTpBlend - tpViewBlend) * (1 - Math.exp(-12 * dt));
        if (Math.abs(targetTpBlend - tpViewBlend) < 0.001) {
          tpViewBlend = targetTpBlend;
        }
        const tpEase = tpViewBlend * tpViewBlend * (3 - 2 * tpViewBlend);

        lobbyStageGroup.visible = false;
        brushCursorRing.visible = false;

        // SINGLE UNIFIED CHARACTER MODEL & ANIMATION FOR BOTH FIRST-PERSON (FPV) AND THIRD-PERSON (TPV):
        // Never use a separate viewmodelRig; combatPlayerRig IS the player body, arms, hands, and weapon in both FPV and TPV!
        // Switching between FPV and TPV ONLY changes the camera position/angle (and hides neckPivot inside the head in FPV).
        viewmodelRig.visible = false;
        combatPlayerRig.root.visible = true;
        combatPlayerRig.torsoPivot.visible = true;
        const showHeadInView = tpViewBlend > 0.18;
        combatPlayerRig.neckPivot.visible = showHeadInView;
        for (const pm of combatPlayerRig.regionMeshes.pelvis) {
          pm.visible = true;
        }

        for (const slot of ['headgear', 'backgear', 'shoulders', 'chestRig'] as EquipmentSlotId[]) {
          setCharacterEquipmentSlotVisible(
            combatPlayerRig.equipmentGroups,
            slot,
            activeEquipmentRef.current.includes(slot) &&
              (slot !== 'headgear' || showHeadInView)
          );
        }

        // Determine active displayed weapon across two-stage holster/draw swap
        const swapTotalMs = p.weaponSwitchDurationMs || 340;
        const swapHalfMs = swapTotalMs * 0.5;
        const isFirstHalfSwap = Boolean(
          p.weaponSwitchTimerMs > swapHalfMs &&
            p.previousWeapon &&
            p.previousWeapon !== p.activeWeapon
        );
        const displayedWeaponId: WeaponId = isFirstHalfSwap
          ? (p.previousWeapon as WeaponId)
          : p.activeWeapon;
        const swapProgress =
          p.weaponSwitchTimerMs > 0
            ? Math.sin((1 - p.weaponSwitchTimerMs / swapTotalMs) * Math.PI)
            : 0;

        // Decay weapon sway, physical 3D recoil kick, axial roll inertia & strafe/slide banking
        swayYaw *= Math.exp(-10 * dt);
        swayPitch *= Math.exp(-10 * dt);
        swayRoll *= Math.exp(-12 * dt);
        fpWeaponKickZ *= Math.exp(-18 * dt);
        fpWeaponKickPitch *= Math.exp(-16 * dt);
        fpWeaponKickRoll *= Math.exp(-14 * dt);
        const slideRollTarget = p.isSliding ? 0.14 : 0;
        const targetStrafeRoll =
          moveX * 0.055 * (1 - p.adsBlend * 0.65) + slideRollTarget;
        strafeRoll += (targetStrafeRoll - strafeRoll) * Math.min(1, dt * 12);

        // Smooth Interpolated Tactical Sprint & Slide Canted Poses (shared across 1st-person and 3rd-person)
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
        sprintBlend += (targetSprint - sprintBlend) * (1 - Math.exp(-12 * dt));
        slideBlend += (targetSlide - slideBlend) * (1 - Math.exp(-14 * dt));
        const sprintEase = sprintBlend * sprintBlend * (3 - 2 * sprintBlend);
        const slideEase = slideBlend * slideBlend * (3 - 2 * slideBlend);

        if (currentCombatWeaponId !== displayedWeaponId) {
          currentCombatWeaponId = displayedWeaponId;
          combatPlayerRig.weaponMount.remove(combatWeaponProp);
          combatWeaponProp = buildCompactHandheldWeaponProp(currentCombatWeaponId, true);
          combatPlayerRig.weaponMount.add(combatWeaponProp);
        }

        // Universal 3D Weapon Wall-Obstruction & Physical Wall-Brace Kinematics
        const liveWallObs = computeWeaponWallObstruction(
          p,
          arenaDefNow,
          sim.breakableProps
        ).obstruction;
        const prevWallBlend = wallObstructionBlend;
        wallObstructionBlend +=
          (liveWallObs - wallObstructionBlend) * (1 - Math.exp(-16 * dt));
        if (prevWallBlend < 0.08 && wallObstructionBlend >= 0.08) {
          wallTouchImpulse = 1.0;
        }
        wallTouchImpulse *= Math.exp(-14 * dt);
        const wallBumpWave = Math.sin(wallTouchImpulse * Math.PI) * 0.022;

        // Articulated Trigger Squeeze Micro-Animation on Every Shot
        const targetTrigger = fireHeld || p.muzzleFlashTimerMs > 0 ? 1.0 : 0.0;
        triggerPullBlend += (targetTrigger - triggerPullBlend) * Math.min(1, dt * 28);

        // Decompose world velocity into player-local right/backward components for smooth 16-direction locomotion
        const pRightX = Math.cos(p.yaw);
        const pRightZ = -Math.sin(p.yaw);
        const pBackX = Math.sin(p.yaw);
        const pBackZ = Math.cos(p.yaw);
        const rawLocalVelRight = p.vx * pRightX + p.vz * pRightZ;
        const rawLocalVelFwd = -(p.vx * pBackX + p.vz * pBackZ);
        const velLocalX = moveSpeed > 0.1 ? rawLocalVelRight / moveSpeed : 0;
        const velLocalZ =
          moveSpeed > 0.1 ? (p.vx * pBackX + p.vz * pBackZ) / moveSpeed : 0;
        const animMoveX =
          Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05 ? moveX : velLocalX;
        const animMoveZ =
          Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05 ? moveZ : velLocalZ;

        // Advance 6-DOF Physics-Based Weapon Sway & Mass Inertia Solver (Idle Breathing + Movement Bob + Acceleration Lag)
        weaponSwayInputScratch.weaponId = displayedWeaponId;
        weaponSwayInputScratch.lookDeltaYaw = frameLookYawDelta;
        weaponSwayInputScratch.lookDeltaPitch = frameLookPitchDelta;
        weaponSwayInputScratch.localVelRight = rawLocalVelRight;
        weaponSwayInputScratch.localVelFwd = rawLocalVelFwd;
        weaponSwayInputScratch.velY = p.vy;
        weaponSwayInputScratch.moveSpeed = moveSpeed;
        weaponSwayInputScratch.walkBobPhase = p.walkBobPhase;
        weaponSwayInputScratch.adsBlend = p.adsBlend;
        weaponSwayInputScratch.isCrouching = p.isCrouching;
        weaponSwayInputScratch.isSprinting = p.isSprinting;
        weaponSwayInputScratch.isSliding = p.isSliding;
        weaponSwayInputScratch.isGrounded = p.isGrounded;
        stepWeaponSwayPhysics(weaponSwayState, dt, weaponSwayInputScratch);

        swayYaw = weaponSwayState.yaw;
        swayPitch = weaponSwayState.pitch;
        swayRoll = weaponSwayState.roll;

        if (container) {
          container.dataset.weaponSwayX = weaponSwayState.posX.toFixed(5);
          container.dataset.weaponSwayY = weaponSwayState.posY.toFixed(5);
          container.dataset.weaponSwayPitch = weaponSwayState.pitch.toFixed(5);
          container.dataset.weaponSwayYaw = weaponSwayState.yaw.toFixed(5);
          container.dataset.weaponSwayRoll = weaponSwayState.roll.toFixed(5);
        }

        const effectivePitch = THREE.MathUtils.clamp(
          p.pitch + p.recoilKickPitch + shakePitch + reloadCamPitch,
          -1.42,
          1.42
        );
        const effectiveYaw = p.yaw + p.recoilKickYaw + shakeYaw;

        const tpReloadTotal = WEAPON_REGISTRY[p.activeWeapon].reloadTimeMs;
        const tpReloadProg = p.isReloading
          ? 1 - p.reloadTimerMs / Math.max(1, tpReloadTotal)
          : 0;

        const tpVm = combatWeaponProp?.userData?.weaponRig as
          | WeaponViewModelRig
          | undefined;
        const displayedOpticId = resolveEquippedOptic(
          displayedWeaponId,
          p.weaponOptics
        );
        const adsPose = computeWeaponADSPose(p.adsState);
        if (tpVm) {
          setWeaponRigOpticAttachment(tpVm, displayedOpticId);
          // Hide the 3D weapon mesh only when inside the high-magnification scope eye-box (Stage 5-7)
          // so Stages 1-4 visibly show the 3D weapon and 3D scope rising to the player's eye!
          tpVm.root.visible = !(adsPose.hideViewModelMesh && tpViewBlend < 0.25);
        }

        const ammoState = p.weapons[displayedWeaponId];
        combatKinematicsScratch.swayPosX =
          weaponSwayState.posX + adsPose.weaponOffset[0];
        combatKinematicsScratch.swayPosY =
          weaponSwayState.posY + adsPose.weaponOffset[1];
        combatKinematicsScratch.swayPosZ =
          weaponSwayState.posZ + adsPose.weaponOffset[2];
        combatKinematicsScratch.swayYaw = swayYaw + adsPose.weaponRotation[1];
        combatKinematicsScratch.swayPitch =
          swayPitch + adsPose.weaponRotation[0];
        combatKinematicsScratch.swayRoll =
          swayRoll + adsPose.weaponRotation[2];
        combatKinematicsScratch.strafeRoll = strafeRoll;
        combatKinematicsScratch.wallObstruction = wallObstructionBlend;
        combatKinematicsScratch.wallBumpWave = wallBumpWave;
        combatKinematicsScratch.recoilKickZ = fpWeaponKickZ * adsPose.recoilScale;
        combatKinematicsScratch.recoilKickPitch =
          fpWeaponKickPitch * adsPose.recoilScale;
        combatKinematicsScratch.recoilKickRoll =
          fpWeaponKickRoll * adsPose.recoilScale;
        combatKinematicsScratch.landDipY = landDipY;
        combatKinematicsScratch.jumpImpulseY = jumpImpulseY;
        combatKinematicsScratch.landRollImpulse = landRollImpulse;
        combatKinematicsScratch.airborneLift = airborneLift;
        combatKinematicsScratch.airbornePitch = airbornePitch;
        combatKinematicsScratch.triggerPullBlend = triggerPullBlend;
        combatKinematicsScratch.muzzleFlashActive = p.muzzleFlashTimerMs > 0;
        combatKinematicsScratch.fireCooldownRatio =
          p.fireCooldownMs / Math.max(1, WEAPON_REGISTRY[displayedWeaponId].fireIntervalMs);
        combatKinematicsScratch.magAmmoCount = ammoState ? ammoState.mag : 30;
        combatKinematicsScratch.isFirstHalfSwap = isFirstHalfSwap;
        combatKinematicsScratch.swapHalfProgress =
          p.weaponSwitchTimerMs > 0 ? p.weaponSwitchTimerMs / swapHalfMs : 0;
        combatKinematicsScratch.weaponRig = tpVm;

        // Place the single unified character body at the player's exact world position in BOTH FPV and TPV
        combatPlayerRig.root.position.set(safeCamXZ.x, p.y, safeCamXZ.z);
        combatPlayerRig.root.rotation.y = effectiveYaw + Math.PI;
        updateChameleonRigAnimation(
          combatPlayerRig,
          'combat',
          now * 0.001,
          moveSpeed,
          p.walkBobPhase,
          p.isCrouching,
          animMoveX,
          animMoveZ,
          p.isReloading,
          tpReloadProg,
          p.recoilKickPitch + fpWeaponKickPitch,
          displayedWeaponId,
          effectivePitch,
          p.adsBlend,
          sprintEase,
          slideEase,
          swapProgress,
          combatKinematicsScratch
        );
        combatPlayerRig.root.updateMatrixWorld(true);

        // Compute Exact 3D Muzzle Tip World Position on combatWeaponProp & Enforce Level 3D Wall Clearance (Zero Skyward Tilt!)
        if (tpVm) {
          // Axial CQB barrel foreshortening when pressed against a tall wall so the barrel tip never pokes into the wall mesh
          const barrelZScale = 1 - Math.min(0.28, wallObstructionBlend * 0.28);
          tpVm.root.scale.set(1, 1, barrelZScale);
          combatPlayerRig.weaponMount.updateMatrixWorld(true);
          tpVm.muzzleFlashGroup.getWorldPosition(_muzzleWorldPos);

          // 3D height-aware muzzle check: low cover walls below _muzzleWorldPos.y do NOT collide with or tilt the barrel!
          let clampedMuzzleX = _muzzleWorldPos.x;
          let clampedMuzzleZ = _muzzleWorldPos.z;
          const mRad = 0.22;
          const mY = _muzzleWorldPos.y;
          for (const block of arenaDefNow.blocks) {
            if (mY > block.height + 0.02) continue;
            const hw = block.width * 0.5;
            const hd = block.depth * 0.5;
            const cx = Math.max(block.x - hw, Math.min(block.x + hw, clampedMuzzleX));
            const cz = Math.max(block.z - hd, Math.min(block.z + hd, clampedMuzzleZ));
            const dx = clampedMuzzleX - cx;
            const dz = clampedMuzzleZ - cz;
            const d2 = dx * dx + dz * dz;
            if (d2 < mRad * mRad && d2 > 1e-8) {
              const d = Math.sqrt(d2);
              clampedMuzzleX = cx + (dx / d) * mRad;
              clampedMuzzleZ = cz + (dz / d) * mRad;
            }
          }
          const penDist = Math.hypot(
            clampedMuzzleX - _muzzleWorldPos.x,
            clampedMuzzleZ - _muzzleWorldPos.z
          );
          if (penDist > 0.001) {
            // Retract barrel axially backward along local Z (keeping barrel 100% level so bullets and gun point forward!)
            combatPlayerRig.weaponMount.position.z = Math.max(
              0.38,
              combatPlayerRig.weaponMount.position.z - Math.min(0.08, penDist * 0.65)
            );
            const charPropNow =
              CHARACTER_ROSTER[combatPlayerRig.characterId]?.proportions ||
              CHARACTER_ROSTER.volt.proportions;
            enforceWeaponBodyClearance(
              combatPlayerRig.weaponMount.position,
              combatPlayerRig.weaponMount.rotation,
              displayedWeaponId,
              charPropNow.torsoWidth,
              charPropNow.headScale,
              combatPlayerRig.neckPivot.rotation.x + combatPlayerRig.headPivot.rotation.x
            );
            combatPlayerRig.weaponMount.updateMatrixWorld(true);
            tpVm.muzzleFlashGroup.getWorldPosition(_muzzleWorldPos);
            _muzzleWorldPos.x = clampedMuzzleX;
            _muzzleWorldPos.z = clampedMuzzleZ;
          }
          muzzlePointLight.position.copy(_muzzleWorldPos);
          if (p.muzzleFlashTimerMs > 0) {
            muzzlePointLight.intensity = 4.5;
          } else {
            muzzlePointLight.intensity = Math.max(0, muzzlePointLight.intensity - dt * 38);
          }
        }

        for (let ti = 0; ti < sim.traces.length; ti++) {
          const tr = sim.traces[ti];
          if (tr.id > highestProcessedTraceId) {
            highestProcessedTraceId = tr.id;
            if (!tr.isEnemyShot && tpVm) {
              // Snap player bullet tracer origin 100% to the actual 3D gun barrel muzzle tip!
              tr.fromX = _muzzleWorldPos.x;
              tr.fromY = _muzzleWorldPos.y;
              tr.fromZ = _muzzleWorldPos.z;
            }
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
              tr.isEnemyShot,
              tr.propKind,
              tr.damage
            );
          }
        }

        // Compute First-Person Camera Pose directly at the character's eye socket in combatPlayerRig.torsoPivot space!
        const eyeLocalX =
          THREE.MathUtils.lerp(-0.015, -0.165, p.adsBlend) +
          adsPose.weaponOffset[0] * 0.4;
        const eyeLocalY =
          THREE.MathUtils.lerp(0.62, 0.58, p.adsBlend) +
          adsPose.weaponOffset[1] * 0.4 +
          (bobY + landDipY + jumpImpulseY) * 0.45;
        const eyeLocalZ = 0.18 + adsPose.weaponOffset[2] * 0.35;
        fpCamPos.set(eyeLocalX, eyeLocalY, eyeLocalZ);
        combatPlayerRig.torsoPivot.localToWorld(fpCamPos);
        const safeFpEyeXZ = resolveEntityCollisions(
          fpCamPos.x,
          fpCamPos.z,
          0.34,
          arenaDefNow,
          sim.breakableProps
        );
        fpCamPos.x = safeFpEyeXZ.x;
        fpCamPos.z = safeFpEyeXZ.z;

        orbitDummyCam.rotation.order = 'YXZ';
        orbitDummyCam.rotation.set(
          effectivePitch,
          effectiveYaw,
          -strafeRoll * 0.45 + reloadCamRoll + landRollImpulse * 0.4
        );
        fpCamQuat.copy(orbitDummyCam.quaternion);

        // Compute Precision Over-The-Shoulder Third-Person Camera Pose (converges on exact firing ray + supports 360° Free-Look Eye orbit)
        const tpDist = THREE.MathUtils.lerp(2.28, 1.35, p.adsBlend);
        const orbitYaw = effectiveYaw + tpOrbitYawOffset;
        const orbitPitch = THREE.MathUtils.clamp(
          0.14 + tpOrbitPitchOffset - effectivePitch * 0.52,
          -0.58,
          0.56
        );
        const horizDist = Math.cos(orbitPitch) * tpDist;
        const vertOffset = Math.sin(orbitPitch) * tpDist;
        const frontInspectFactor = Math.cos(tpOrbitYawOffset);
        const shoulderOffset =
          THREE.MathUtils.lerp(0.58, 0.42, p.adsBlend) *
          Math.max(0, frontInspectFactor);
        const orbitRightX = Math.cos(orbitYaw);
        const orbitRightZ = -Math.sin(orbitYaw);
        const rawTpX =
          p.x + Math.sin(orbitYaw) * horizDist + orbitRightX * shoulderOffset;
        const rawTpZ =
          p.z + Math.cos(orbitYaw) * horizDist + orbitRightZ * shoulderOffset;
        const safeTpXZ = resolveEntityCollisions(
          rawTpX,
          rawTpZ,
          0.25,
          arenaDefNow,
          sim.breakableProps
        );
        const shoulderPivotY = (p.isCrouching ? 1.04 : 1.44) + bobY * 0.45;
        tpCamPos.set(
          safeTpXZ.x,
          Math.max(p.y + 0.28, p.y + shoulderPivotY + vertOffset),
          safeTpXZ.z
        );

        // Converge 3rd-person camera directly onto the player's exact aim ray 26m ahead so center crosshair = bullet impact!
        const aimCosP = Math.cos(effectivePitch);
        const aimDirX = -Math.sin(effectiveYaw) * aimCosP;
        const aimDirY = Math.sin(effectivePitch);
        const aimDirZ = -Math.cos(effectiveYaw) * aimCosP;
        const inspectBlend = Math.min(1, Math.abs(tpOrbitYawOffset) / 0.35);
        const rayTargetX = p.x + aimDirX * 26.0 + orbitRightX * shoulderOffset * 0.12;
        const rayTargetY = p.y + p.eyeHeight + aimDirY * 26.0;
        const rayTargetZ = p.z + aimDirZ * 26.0 + orbitRightZ * shoulderOffset * 0.12;
        orbitLookTarget.set(
          THREE.MathUtils.lerp(rayTargetX, p.x, inspectBlend),
          THREE.MathUtils.lerp(rayTargetY, p.y + shoulderPivotY - 0.12, inspectBlend),
          THREE.MathUtils.lerp(rayTargetZ, p.z, inspectBlend)
        );
        orbitDummyCam.position.copy(tpCamPos);
        orbitDummyCam.lookAt(orbitLookTarget);
        tpCamQuat.copy(orbitDummyCam.quaternion);

        // Smoothly interpolate ONLY the Camera Position & Orientation between First-Person and Third-Person!
        camera.position.lerpVectors(fpCamPos, tpCamPos, tpEase);
        camera.quaternion.slerpQuaternions(fpCamQuat, tpCamQuat, tpEase);
      } else {
        // 9B. 3D Character Lobby & Vault Custom Painting Studio Showcase
        viewmodelRig.visible = false;
        combatPlayerRig.root.visible = false;
        muzzlePointLight.intensity = 0;
        lobbyStageGroup.visible = true;

        // Rebuild character rig if player switched characters in Roster
        if (currentLobbyCharId !== p1CharRef.current) {
          currentLobbyCharId = p1CharRef.current;
          turntableGroup.remove(lobbyCharRig.root);
          lobbyCharRig.dispose();
          lobbyCharRig = buildChameleonHumanoidRig(
            currentLobbyCharId,
            maxAnisotropy
          );
          currentLobbyWeaponId = selectedWeaponRef.current;
          lobbyWeaponProp = buildCompactHandheldWeaponProp(currentLobbyWeaponId);
          lobbyCharRig.weaponMount.add(lobbyWeaponProp);
          turntableGroup.add(lobbyCharRig.root);

          scene.remove(combatPlayerRig.root);
          combatPlayerRig.dispose();
          combatPlayerRig = buildChameleonHumanoidRig(
            currentLobbyCharId,
            maxAnisotropy
          );
          currentCombatWeaponId = currentLobbyWeaponId;
          combatWeaponProp = buildCompactHandheldWeaponProp(currentLobbyWeaponId, true);
          combatPlayerRig.weaponMount.add(combatWeaponProp);
          combatPlayerRig.root.visible = false;
          scene.add(combatPlayerRig.root);
          fpRightArm.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) {
              (c as THREE.Mesh).material = combatPlayerRig.paintMaterial;
            }
          });
          fpLeftArm.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) {
              (c as THREE.Mesh).material = combatPlayerRig.paintMaterial;
            }
          });

          charSwitchScaleAnim = 0.88;
          lastStudioTexRev = -1;
          lastEquippedTexRev = -1;
        }

        // Rebuild handheld weapon prop if player changed weapon in Loadout
        if (currentLobbyWeaponId !== selectedWeaponRef.current) {
          currentLobbyWeaponId = selectedWeaponRef.current;
          lobbyCharRig.weaponMount.remove(lobbyWeaponProp);
          lobbyWeaponProp = buildCompactHandheldWeaponProp(currentLobbyWeaponId);
          lobbyCharRig.weaponMount.add(lobbyWeaponProp);

          currentCombatWeaponId = currentLobbyWeaponId;
          combatPlayerRig.weaponMount.remove(combatWeaponProp);
          combatWeaponProp = buildCompactHandheldWeaponProp(currentLobbyWeaponId, true);
          combatPlayerRig.weaponMount.add(combatWeaponProp);
        }

        const isStudioView =
          activeLobbyTabRef.current === 'painting_studio' ||
          (activeLobbyTabRef.current === 'vault' &&
            vaultSubTabRef.current === 'studio');

        // Show handheld weapon prop when inspecting Loadout/Weapons tabs or when the 'inspect' pose animation is active
        lobbyWeaponProp.visible =
          activeLobbyTabRef.current === 'loadout' ||
          activeLobbyTabRef.current === 'weapons' ||
          characterPoseRef.current === 'inspect';
        const lobbyVm = lobbyWeaponProp?.userData?.weaponRig as
          | WeaponViewModelRig
          | undefined;
        if (lobbyVm) {
          setWeaponRigOpticAttachment(
            lobbyVm,
            resolveEquippedOptic(
              currentLobbyWeaponId,
              settingsRef.current.weaponOptics
            )
          );
        }

        // Smooth scale transition on character or design change
        const baseLobbyScale = isStudioView ? 0.94 : 0.84;
        charSwitchScaleAnim += (1.0 - charSwitchScaleAnim) * Math.min(1, dt * 12);
        lobbyCharRig.root.scale.setScalar(charSwitchScaleAnim * baseLobbyScale);

        // Sync optional equipment slots
        for (const slot of [
          'headgear',
          'backgear',
          'shoulders',
          'chestRig',
        ] as EquipmentSlotId[]) {
          setCharacterEquipmentSlotVisible(
            lobbyCharRig.equipmentGroups,
            slot,
            activeEquipmentRef.current.includes(slot)
          );
        }

        // Sync 3D Character Paint Texture (Studio Editing Buffer vs Equipped Buffer)
        if (isStudioView) {
          if (
            lastStudioTexRev !== studioTextureRevisionRef.current &&
            studioLayersRef?.current
          ) {
            lastStudioTexRev = studioTextureRevisionRef.current;
            syncLayersToCharacterRigTexture(
              lobbyCharRig,
              studioLayersRef.current
            );
          }
          // Highlight isolated body region if selected
          const isoReg = brushSettingsRef.current.isolatedRegion;
          for (const mesh of lobbyCharRig.paintableMeshes) {
            const mReg = mesh.userData.bodyRegion as BodyRegionId;
            mesh.visible = isoReg === 'all' || mReg === isoReg;
          }
        } else {
          for (const mesh of lobbyCharRig.paintableMeshes) {
            mesh.visible = true;
          }
          if (
            lastEquippedTexRev !== equippedDesignRevisionRef.current ||
            lastStudioTexRev !== -2
          ) {
            lastEquippedTexRev = equippedDesignRevisionRef.current;
            lastStudioTexRev = -2;
            const eqBuf = equippedCompositeBufferRef?.current;
            if (eqBuf) {
              syncLayersToCharacterRigTexture(lobbyCharRig, eqBuf);
              syncLayersToCharacterRigTexture(combatPlayerRig, eqBuf);
            } else {
              const ctx = lobbyCharRig.paintCanvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, 512, 512);
                lobbyCharRig.paintTexture.needsUpdate = true;
              }
            }
          }
        }

        // Update Character Pose & Animation
        const activePose = isStudioView
          ? 'studio_neutral'
          : (activeLobbyTabRef.current === 'loadout' ||
                activeLobbyTabRef.current === 'weapons') &&
              characterPoseRef.current === 'idle'
            ? 'inspect'
            : characterPoseRef.current;
        updateChameleonRigAnimation(
          lobbyCharRig,
          activePose,
          now * 0.001,
          0,
          0,
          false,
          0,
          0,
          false,
          0,
          0,
          currentLobbyWeaponId
        );

        // Sync Flanking Squadmate Pedestals in Lobby/Friends
        const showSquad =
          activeLobbyTabRef.current === 'friends' &&
          partyMembersRef.current.length > 1;
        const extraMembers = partyMembersRef.current.slice(1, 4);
        for (let i = 0; i < 3; i++) {
          const entry = squadSlotEntries[i];
          const member = extraMembers[i];
          if (showSquad && member) {
            if (entry.charId !== member.characterId) {
              entry.slotGroup.remove(entry.rig.root);
              entry.rig.dispose();
              entry.charId = member.characterId;
              entry.rig = buildChameleonHumanoidRig(entry.charId, maxAnisotropy);
              entry.rig.root.position.y = 0.1;
              entry.slotGroup.add(entry.rig.root);
            }
            entry.slotGroup.visible = true;
            updateChameleonRigAnimation(
              entry.rig,
              member.ready ? 'salute' : 'idle',
              now * 0.001 + (i + 1) * 0.8
            );
          } else {
            entry.slotGroup.visible = false;
          }
        }

        // Handle Camera Focus Presets & Reset Triggers
        if (lastResetTrigger !== cameraResetTriggerRef.current) {
          lastResetTrigger = cameraResetTriggerRef.current;
          charTargetYaw = 0;
          charOrbitPitch = 0.03;
          charTargetZoomDist = isStudioView ? 2.84 : 2.65;
          charTargetLookY = isStudioView ? 0.96 : 0.84;
        }

        const zoomTrig = cameraZoomDeltaTriggerRef.current;
        if (zoomTrig && zoomTrig.seq !== lastZoomDeltaSeq) {
          lastZoomDeltaSeq = zoomTrig.seq;
          charTargetZoomDist = THREE.MathUtils.clamp(
            charTargetZoomDist + zoomTrig.delta,
            1.35,
            4.4
          );
        }

        if (lastFocusPreset !== cameraFocusPresetRef.current) {
          lastFocusPreset = cameraFocusPresetRef.current;
          if (lastFocusPreset === 'head') {
            charTargetZoomDist = 1.62;
            charTargetLookY = 1.38;
            charTargetYaw = 0;
          } else if (lastFocusPreset === 'upper') {
            charTargetZoomDist = 2.15;
            charTargetLookY = 1.12;
            charTargetYaw = 0;
          } else if (lastFocusPreset === 'back') {
            charTargetZoomDist = 2.75;
            charTargetLookY = 0.96;
            charTargetYaw = Math.PI;
          } else if (lastFocusPreset === 'left') {
            charTargetZoomDist = 2.65;
            charTargetLookY = 0.96;
            charTargetYaw = Math.PI * 0.5;
          } else if (lastFocusPreset === 'right') {
            charTargetZoomDist = 2.65;
            charTargetLookY = 0.96;
            charTargetYaw = -Math.PI * 0.5;
          } else if (lastFocusPreset === 'legs') {
            charTargetZoomDist = 2.35;
            charTargetLookY = 0.52;
            charTargetYaw = 0;
          } else {
            charTargetZoomDist = isStudioView ? 2.84 : 2.65;
            charTargetLookY = isStudioView ? 0.96 : 0.84;
            charTargetYaw = 0;
          }
        } else if (cameraFocusPresetRef.current === 'full' && !isLobbyOrbitDragging) {
          charTargetZoomDist = isStudioView ? 2.84 : 2.65;
          charTargetLookY = isStudioView ? 0.96 : 0.84;
        }

        if (charTargetYaw !== null) {
          const diff = charTargetYaw - charTurntableYaw;
          charTurntableYaw += diff * Math.min(1, dt * 10);
          if (Math.abs(diff) < 0.005) {
            charTurntableYaw = charTargetYaw;
            charTargetYaw = null;
          }
        }

        turntableGroup.rotation.y = charTurntableYaw;
        charZoomDist +=
          (charTargetZoomDist - charZoomDist) * Math.min(1, dt * 11);
        charLookY += (charTargetLookY - charLookY) * Math.min(1, dt * 11);

        if (Math.abs(camera.fov - 44) > 0.1) {
          camera.fov += (44 - camera.fov) * Math.min(1, dt * 12);
          camera.updateProjectionMatrix();
        }

        const camY =
          LOBBY_STAGE_Y +
          0.02 +
          charLookY +
          Math.sin(charOrbitPitch) * charZoomDist;
        const camZ = Math.cos(charOrbitPitch) * charZoomDist;
        camera.position.set(0, camY, camZ);
        camera.lookAt(0, LOBBY_STAGE_Y + 0.02 + charLookY, 0);
      }

      // 10. Sync Breakable Props & Articulated Meccha Chameleon Enemy Combatants
      syncBreakableProps(sim);

      for (let botIdx = 0; botIdx < sim.enemies.length; botIdx++) {
        const bot = sim.enemies[botIdx];
        let rig = enemyRigs.get(bot.id);
        if (!rig) {
          const visualArchetype: 'rusher' | 'sniper' | 'heavy' | 'flanker' =
            bot.archetype === 'sniper'
              ? 'sniper'
              : bot.archetype === 'rusher'
                ? botIdx % 2 === 0
                  ? 'rusher'
                  : 'flanker'
                : botIdx % 2 === 0
                  ? 'heavy'
                  : 'flanker';
          rig = buildEnemyChameleonCombatRig(
            bot.characterId || 'volt',
            visualArchetype,
            bot.weaponId,
            botIdx,
            texSet.muzzleFlashMap,
            maxAnisotropy
          );
          enemyGroup.add(rig.group);
          enemyRigs.set(bot.id, rig);
        }

        if (bot.state === 'ko' && bot.koTimerMs <= 0) {
          rig.group.visible = false;
          continue;
        }

        rig.group.visible = true;
        updateEnemyChameleonCombatAnimation(rig, bot, now * 0.001);

        if (bot.state !== 'ko') {
          rig.hpBarBg.visible = true;
          rig.hpBarFill.visible = true;
          rig.hpBarBg.lookAt(camera.position);
          rig.hpBarFill.lookAt(camera.position);

          const hpRatio = Math.max(0, Math.min(1, bot.hp / Math.max(1, bot.maxHp)));
          rig.hpBarFill.scale.x = Math.max(0.001, hpRatio);
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

      // 10C. Sync 3D Tactical World Loot Items (Weapons, Attachments, Ammo & Gear)
      const activeLootIds = new Set<string>();
      if (sim.worldLoot) {
        for (const wl of sim.worldLoot) {
          activeLootIds.add(wl.lootId);
          let wlEntry = worldLootMeshes.get(wl.lootId);
          if (!wlEntry) {
            const grp = new THREE.Group();
            const isWep = Boolean(wl.item.weaponState);
            const isAtt = wl.item.itemId.startsWith('att_');
            const caseMesh = new THREE.Mesh(
              worldLootCaseGeo,
              isWep
                ? worldLootWeaponMat
                : isAtt
                  ? worldLootAttachmentMat
                  : worldLootSupplyMat
            );
            caseMesh.position.y = 0.24;
            const stripe = new THREE.Mesh(worldLootStripeGeo, worldLootTrimMat);
            stripe.position.y = 0.24;
            const ring = new THREE.Mesh(worldLootRingGeo, worldLootRingMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.025;
            grp.add(caseMesh, stripe, ring);
            worldLootGroup.add(grp);
            wlEntry = { group: grp, ring };
            worldLootMeshes.set(wl.lootId, wlEntry);
          }
          const hoverY = Math.sin(now * 0.004 + wl.x * 0.7) * 0.06;
          wlEntry.group.position.set(wl.x, hoverY, wl.z);
          wlEntry.group.rotation.y = now * 0.0018 + wl.z;
          const pulse = 0.9 + Math.sin(now * 0.006 + wl.x) * 0.12;
          wlEntry.ring.scale.setScalar(pulse);
        }
      }
      worldLootMeshes.forEach((entry, lootId) => {
        if (!activeLootIds.has(lootId)) {
          worldLootGroup.remove(entry.group);
          worldLootMeshes.delete(lootId);
        }
      });

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

      // Update Multi-Stage Red Drum Explosion Core Flashes, Rolling Fireballs, Mushroom Smoke Plumes & Shrapnel
      if (explosionPointLight.intensity > 0) {
        explosionPointLight.intensity = Math.max(
          0,
          explosionPointLight.intensity * Math.exp(-6.5 * dt) - dt * 2.5
        );
      }

      for (let i = 0; i < CORE_FLASH_POOL_SIZE; i++) {
        const cf = explosionCoreFlashPool[i];
        if (!cf.active) continue;
        cf.ageMs += dtMs;
        if (cf.ageMs >= cf.maxAgeMs) {
          cf.active = false;
          cf.group.visible = false;
          continue;
        }
        const t = cf.ageMs / cf.maxAgeMs;
        const easeOut = 1 - (1 - t) * (1 - t);
        cf.group.scale.setScalar(0.5 + easeOut * cf.maxScale);
        cf.group.rotation.y += dt * 8;
        cf.innerMat.opacity = Math.max(0, 1 - t * 1.35);
        cf.outerMat.opacity = Math.max(0, (1 - t) * 0.95);
      }

      for (let i = 0; i < EXPLOSION_PLUME_POOL_SIZE; i++) {
        const pl = explosionPlumePool[i];
        if (!pl.active) continue;
        if (pl.delayMs > 0) {
          pl.delayMs -= dtMs;
          if (pl.delayMs <= 0) {
            pl.mesh.visible = true;
            pl.mat.opacity = 0.96;
            // Secondary sub-detonation light pulse!
            explosionPointLight.intensity = Math.max(explosionPointLight.intensity, 12.5);
          } else {
            continue;
          }
        }
        pl.ageMs += dtMs;
        if (pl.ageMs >= pl.maxAgeMs) {
          pl.active = false;
          pl.mesh.visible = false;
          continue;
        }
        const t = pl.ageMs / pl.maxAgeMs;
        // Drag & thermal buoyancy lift
        const drag = Math.exp(-2.8 * dt);
        pl.vx *= drag;
        pl.vz *= drag;
        if (pl.isSmoke) {
          pl.vy *= Math.exp(-1.2 * dt);
        } else {
          pl.vy += 1.6 * dt;
        }
        pl.mesh.position.x += pl.vx * dt;
        pl.mesh.position.y += pl.vy * dt;
        pl.mesh.position.z += pl.vz * dt;
        // Billboard volumetric cloud sprite toward active camera and roll organically around view axis
        pl.mesh.quaternion.copy(camera.quaternion);
        pl.rx += pl.rz * dt;
        pl.mesh.rotateZ(pl.rx);

        const scale = THREE.MathUtils.lerp(pl.startScale, pl.endScale, 1 - (1 - t) * (1 - t));
        pl.mesh.scale.setScalar(scale);

        if (pl.isSmoke) {
          // Dark billowing mushroom smoke cooling from warm soot to charcoal gray
          if (t < 0.22) {
            pl.mat.color.setHex(0x7c2d12);
          } else if (t < 0.52) {
            pl.mat.color.setHex(0x475569);
          } else {
            pl.mat.color.setHex(0x1e293b);
          }
          const fadeIn = Math.min(1, t * 4.5);
          pl.mat.opacity = fadeIn * (1 - t) * 0.78;
        } else {
          // Thermal fireball cooling progression: Incandescent White-Gold -> Fiery Orange -> Crimson -> Soot
          if (t < 0.2) {
            pl.mat.color.setHex(0xfef08a);
          } else if (t < 0.52) {
            pl.mat.color.setHex(0xf97316);
          } else if (t < 0.78) {
            pl.mat.color.setHex(0xdc2626);
          } else {
            pl.mat.color.setHex(0x451a03);
          }
          const flicker = 0.9 + 0.1 * Math.sin(pl.ageMs * 0.045 + i);
          pl.mat.opacity = (1 - t * t) * 0.94 * flicker;
        }
      }

      for (let i = 0; i < SHRAPNEL_POOL_SIZE; i++) {
        const sh = barrelShrapnelPool[i];
        if (!sh.active) continue;
        sh.ageMs += dtMs;
        if (sh.ageMs >= sh.maxAgeMs) {
          sh.active = false;
          sh.mesh.visible = false;
          continue;
        }
        const t = sh.ageMs / sh.maxAgeMs;
        sh.vy -= 18.5 * dt;
        sh.mesh.position.x += sh.vx * dt;
        sh.mesh.position.y += sh.vy * dt;
        sh.mesh.position.z += sh.vz * dt;
        if (sh.mesh.position.y < 0.05) {
          sh.mesh.position.y = 0.05;
          sh.vy = Math.abs(sh.vy) * 0.46;
          sh.vx *= 0.68;
          sh.vz *= 0.68;
          if (sh.bounces < 2) {
            sh.bounces++;
            spawnImpactBurst(
              sh.mesh.position.x,
              0.06,
              sh.mesh.position.z,
              0,
              1,
              0,
              0xfbbf24,
              2,
              0.65,
              0.7
            );
          }
        }
        sh.mesh.rotation.x += sh.rx * dt;
        sh.mesh.rotation.y += sh.ry * dt;
        sh.mesh.rotation.z += sh.rz * dt;
        sh.mat.emissiveIntensity = Math.max(0, (1 - t) * 1.85);
      }

      // Update Batched Procedural Bullet Impact Engine (Instanced Marks, LOD Uniforms & Pooled Secondary Effects)
      bulletImpactSystem.update(dt, camera);

      // Cool Fresh Blast Crater Embers
      for (let i = 0; i < DECAL_POOL_SIZE; i++) {
        const d = decalPool[i];
        if (!d.active || d.isBlood || d.ageMs >= 2400) continue;
        d.ageMs += dtMs;
        if (d.emberGlow > 0) {
          if (d.ageMs < 420) {
            d.mat.color.setHex(0xffedd5);
          } else {
            d.mat.color.setHex(0xffffff);
            d.emberGlow = 0;
          }
        }
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

      // Scope Overlay & Hip-fire Crosshair Smooth Crossfade via ScopeViewController
      syncScopeOverlayDom(
        hudRefs.lockReticle.current,
        p.adsState,
        p.recoilKickPitch + fpWeaponKickPitch
      );
      if (hudRefs.crosshairRef.current) {
        const chEl = hudRefs.crosshairRef.current;
        const chOpacity = p.adsState
          ? p.adsState.hipCrosshairOpacity
          : Math.max(0, 1 - p.adsBlend * 1.4);
        const chOpacityStr = chOpacity.toFixed(2);
        if (chOpacityStr !== lastChOpacityStr) {
          lastChOpacityStr = chOpacityStr;
          chEl.style.opacity = chOpacityStr;
        }

        // Dynamic Crosshair Expansion from Character Movement, Weapon Accuracy & Recoil State
        const chMetrics = computeDynamicCrosshairState(p, fpWeaponKickPitch);
        const gapLerpRate = chMetrics.targetGapPx > smoothedChGapPx ? 26 : 16;
        smoothedChGapPx +=
          (chMetrics.targetGapPx - smoothedChGapPx) * (1 - Math.exp(-gapLerpRate * dt));

        const gapStr = `${smoothedChGapPx.toFixed(1)}px`;
        if (gapStr !== lastChGapStr) {
          lastChGapStr = gapStr;
          chEl.style.setProperty('--ch-gap', gapStr);
          chEl.dataset.gapPx = smoothedChGapPx.toFixed(2);
          chEl.dataset.spreadDeg = chMetrics.totalSpreadDeg.toFixed(2);
          chEl.dataset.baseSpreadDeg = chMetrics.baseSpreadDeg.toFixed(2);
          chEl.dataset.moveSpreadDeg = chMetrics.movementSpreadDeg.toFixed(2);
          chEl.dataset.recoilSpreadDeg = chMetrics.recoilSpreadDeg.toFixed(2);
        }

        const isShotgun = p.activeWeapon === 'spas12';
        const tickLenPx = isShotgun
          ? 7.5
          : 8.5 + chMetrics.recoilIntensity * 2.5 + chMetrics.movementIntensity * 1.5;
        const tickLenStr = `${tickLenPx.toFixed(1)}px`;
        if (tickLenStr !== lastChTickLenStr) {
          lastChTickLenStr = tickLenStr;
          chEl.style.setProperty('--ch-tick-len', tickLenStr);
        }

        const dotScale = 1.0 + chMetrics.recoilIntensity * 0.38;
        const dotScaleStr = dotScale.toFixed(2);
        if (dotScaleStr !== lastChDotScaleStr) {
          lastChDotScaleStr = dotScaleStr;
          chEl.style.setProperty('--ch-dot-scale', dotScaleStr);
        }

        const chColor =
          chMetrics.recoilIntensity > 0.45
            ? '#fbbf24'
            : p.isCrouching && chMetrics.movementIntensity < 0.08
              ? '#6ee7b7'
              : '#f4f4f5';
        if (chColor !== lastChColorStr) {
          lastChColorStr = chColor;
          chEl.style.setProperty('--ch-color', chColor);
        }

        if (p.activeWeapon !== lastChWeaponStr) {
          lastChWeaponStr = p.activeWeapon;
          chEl.dataset.weapon = p.activeWeapon;
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
      if (isSoftwareGl && !isDisposed) {
        afterDraw();
      }
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(rafId);
      window.clearTimeout(softGlTimerId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('blur', onWindowBlur);
      lobbyCharRig.dispose();
      combatPlayerRig.dispose();
      squadSlotEntries.forEach((s) => s.rig.dispose());
      worldLootCaseGeo.dispose();
      worldLootStripeGeo.dispose();
      worldLootRingGeo.dispose();
      worldLootTrimMat.dispose();
      worldLootWeaponMat.dispose();
      worldLootAttachmentMat.dispose();
      worldLootSupplyMat.dispose();
      worldLootRingMat.dispose();
      bulletImpactSystem.dispose();
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
