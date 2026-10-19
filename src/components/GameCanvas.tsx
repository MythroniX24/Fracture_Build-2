import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  ArenaId,
  BotDifficulty,
  CHARACTER_REGISTRY,
  CharacterId,
  GameMode,
  GameSettings,
  ScreenState,
  TrainingConfig,
} from '../game/config.ts';
import {
  CombatEvent,
  computeBotInput,
  emptyInput,
  FighterInput,
  getArenaSurfaceHeight,
  lerpAngle,
  SimulationState,
  stepSimulation,
} from '../game/rules.ts';
import { createMaterialLibrary } from '../three/materials.ts';
import {
  ArenaSceneRig,
  buildArenaScene,
  syncArenaBreakables,
  updateArenaScene,
} from '../three/arenas.ts';
import {
  ArticulatedFighterRig,
  buildFighterRig,
  updateFighterRigAnimation,
} from '../three/characters.ts';
import { soundEngine } from '../audio/soundEngine.ts';
import { multiplayerClient } from '../network/multiplayerClient.ts';
import { HudDomRefs, TouchInputState } from './CombatHUD.tsx';

interface GameCanvasProps {
  screenState: ScreenState;
  gameMode: GameMode;
  p1Char: CharacterId;
  p2Char: CharacterId;
  arenaId: ArenaId;
  botDifficulty: BotDifficulty;
  lockedOn: boolean;
  settings: GameSettings;
  trainingConfig: TrainingConfig;
  simRef: React.MutableRefObject<SimulationState>;
  hudRefs: HudDomRefs;
  touchInputRef: React.MutableRefObject<TouchInputState>;
  onToggleLockOn: () => void;
  onCombatEvent: (evt: CombatEvent) => void;
  onRoundFinished: (winner: 'p1' | 'p2' | 'draw') => void;
}

interface SparkParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  scale: number;
  color: THREE.Color;
}

interface ShockwaveRing {
  active: boolean;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  maxAge: number;
  maxScale: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  screenState,
  gameMode,
  p1Char,
  p2Char,
  arenaId,
  botDifficulty,
  lockedOn,
  settings,
  trainingConfig,
  simRef,
  hudRefs,
  touchInputRef,
  onToggleLockOn,
  onCombatEvent,
  onRoundFinished,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Keep latest props accessible inside requestAnimationFrame without re-creating the WebGL context
  const latestPropsRef = useRef({
    screenState,
    gameMode,
    p1Char,
    p2Char,
    arenaId,
    botDifficulty,
    lockedOn,
    settings,
    trainingConfig,
    onToggleLockOn,
    onCombatEvent,
    onRoundFinished,
  });

  useEffect(() => {
    latestPropsRef.current = {
      screenState,
      gameMode,
      p1Char,
      p2Char,
      arenaId,
      botDifficulty,
      lockedOn,
      settings,
      trainingConfig,
      onToggleLockOn,
      onCombatEvent,
      onRoundFinished,
    };
  }, [
    screenState,
    gameMode,
    p1Char,
    p2Char,
    arenaId,
    botDifficulty,
    lockedOn,
    settings,
    trainingConfig,
    onToggleLockOn,
    onCombatEvent,
    onRoundFinished,
  ]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isHeadless =
      typeof navigator !== 'undefined' &&
      (Boolean(navigator.webdriver) || /HeadlessChrome/i.test(navigator.userAgent));
    const renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless && latestPropsRef.current.settings.graphicsQuality !== 'low',
      powerPreference: 'high-performance',
    });
    const dprCap = isHeadless
      ? 1
      : latestPropsRef.current.settings.graphicsQuality === 'high'
        ? 2
        : latestPropsRef.current.settings.graphicsQuality === 'medium'
          ? 1.5
          : 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled =
      !isHeadless && latestPropsRef.current.settings.graphicsQuality !== 'low';
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Initialize Scene & Camera (52° FOV for close Over-The-Shoulder combat presence)
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      52,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      200
    );
    camera.position.set(-3.6, 3.2, 4.5);

    // 3. PBR Material Library + RoomEnvironment IBL (with Headless Chrome fallback)
    const matLib = createMaterialLibrary(renderer, isHeadless);
    if (matLib.envMap) {
      scene.environment = matLib.envMap;
      scene.environmentIntensity = 0.68;
    }

    // 4. Build Exact Foundry Arena v4 Scene
    let currentArenaId: ArenaId = latestPropsRef.current.arenaId;
    let arenaRig: ArenaSceneRig = buildArenaScene(currentArenaId, matLib);
    scene.add(arenaRig.group);
    scene.fog = new THREE.FogExp2(arenaRig.fogColor.getHex(), arenaRig.fogDensity);
    scene.background = arenaRig.fogColor;

    // 5. Build Fighter Rigs (P1, P2, and Rift Phase Decoy)
    let currentP1Char: CharacterId = latestPropsRef.current.p1Char;
    let currentP2Char: CharacterId = latestPropsRef.current.p2Char;

    let p1Rig: ArticulatedFighterRig = buildFighterRig(currentP1Char, matLib, false);
    let p2Rig: ArticulatedFighterRig = buildFighterRig(currentP2Char, matLib, false);
    const decoyRig: ArticulatedFighterRig = buildFighterRig('rift', matLib, true);
    decoyRig.root.visible = false;

    scene.add(p1Rig.root);
    scene.add(p2Rig.root);
    scene.add(decoyRig.root);

    // 6. 3D Gravity Plasma Orb Projectile Mesh Pool
    const orbGroup = new THREE.Group();
    const orbCoreMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
    const orbShellMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    const orbCoreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 14), orbCoreMat);
    const orbShellMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.58, 1), orbShellMat);
    const orbLight = new THREE.PointLight(0x38bdf8, 4.0, 7.0, 2.0);
    orbGroup.add(orbCoreMesh, orbShellMesh, orbLight);
    orbGroup.visible = false;
    scene.add(orbGroup);

    // 7. Pre-allocated Instanced Particle Pool for Sparks, Crate Splinters, and Barrel Shards
    const maxParticles = 220;
    const sparkGeo = new THREE.BoxGeometry(0.11, 0.11, 0.28);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sparkInstanced = new THREE.InstancedMesh(sparkGeo, sparkMat, maxParticles);
    sparkInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(sparkInstanced);

    const particles: SparkParticle[] = Array.from({ length: maxParticles }, () => ({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      age: 0,
      maxAge: 0.4,
      scale: 1,
      color: new THREE.Color(0xf59e0b),
    }));

    const dummyObj = new THREE.Object3D();
    dummyObj.scale.setScalar(0);
    dummyObj.updateMatrix();
    for (let i = 0; i < maxParticles; i++) {
      sparkInstanced.setMatrixAt(i, dummyObj.matrix);
      sparkInstanced.setColorAt(i, particles[i].color);
    }
    sparkInstanced.instanceMatrix.needsUpdate = true;
    if (sparkInstanced.instanceColor) sparkInstanced.instanceColor.needsUpdate = true;

    const spawnBurst = (
      x: number,
      y: number,
      z: number,
      colorHex: number,
      count: number,
      speed = 7.5,
      scaleMult = 1.0
    ) => {
      const qual = latestPropsRef.current.settings.particleQuality;
      const mult = qual === 'low' ? 0.4 : qual === 'medium' ? 0.75 : 1.0;
      const actualCount = Math.max(3, Math.round(count * mult));
      let spawned = 0;

      for (let i = 0; i < particles.length && spawned < actualCount; i++) {
        const p = particles[i];
        if (!p.active) {
          p.active = true;
          p.x = x + (Math.random() - 0.5) * 0.35;
          p.y = y + (Math.random() - 0.5) * 0.35;
          p.z = z + (Math.random() - 0.5) * 0.35;
          const theta = Math.random() * Math.PI * 2;
          const phi = (Math.random() - 0.22) * Math.PI;
          const spd = speed * (0.45 + Math.random() * 0.9);
          p.vx = Math.cos(theta) * Math.cos(phi) * spd;
          p.vy = Math.abs(Math.sin(phi)) * spd + 2.2;
          p.vz = Math.sin(theta) * Math.cos(phi) * spd;
          p.age = 0;
          p.maxAge = 0.25 + Math.random() * 0.38;
          p.scale = (0.7 + Math.random() * 0.9) * scaleMult;
          p.color.setHex(colorHex);
          spawned++;
        }
      }
    };

    // 8. Pre-allocated Shockwave Rings Pool
    const shockwaves: ShockwaveRing[] = Array.from({ length: 8 }, () => {
      const geo = new THREE.RingGeometry(0.35, 0.72, 32);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      return {
        active: false,
        mesh,
        mat,
        age: 0,
        maxAge: 0.42,
        maxScale: 5.5,
      };
    });

    const spawnShockwave = (
      x: number,
      y: number,
      z: number,
      colorHex: number,
      maxScale = 5.5,
      duration = 0.42
    ) => {
      const ring = shockwaves.find((r) => !r.active) || shockwaves[0];
      ring.active = true;
      ring.age = 0;
      ring.maxAge = duration;
      ring.maxScale = maxScale;
      ring.mat.color.setHex(colorHex);
      ring.mat.opacity = 0.9;
      ring.mesh.position.set(x, y + 0.08, z);
      ring.mesh.scale.setScalar(0.2);
      ring.mesh.visible = true;
    };

    // 8b. 3D Glowing Crescent Weapon Slash Arc Pool (Zero runtime allocation)
    const slashArcGeo = new THREE.RingGeometry(1.05, 2.25, 24, 1, -Math.PI * 0.58, Math.PI * 1.16);
    slashArcGeo.rotateX(-Math.PI / 2);
    const slashArcs = Array.from({ length: 8 }, () => {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(slashArcGeo, mat);
      mesh.visible = false;
      scene.add(mesh);
      return {
        active: false,
        mesh,
        mat,
        age: 0,
        maxAge: 0.24,
        startYaw: 0,
        spinSpeed: 8.5,
        baseScale: 1.0,
      };
    });

    const spawnSlashArc = (
      x: number,
      y: number,
      z: number,
      facingAngle: number,
      colorHex: number,
      tiltZ = 0,
      spinDir = 1,
      baseScale = 1.0,
      duration = 0.22
    ) => {
      const arc = slashArcs.find((a) => !a.active) || slashArcs[0];
      arc.active = true;
      arc.age = 0;
      arc.maxAge = duration;
      arc.baseScale = baseScale;
      arc.startYaw = facingAngle - Math.PI * 0.5 - spinDir * 0.55;
      arc.spinSpeed = spinDir * 10.5;
      arc.mat.color.setHex(colorHex);
      arc.mat.opacity = 0.95;
      arc.mesh.position.set(x, y, z);
      arc.mesh.rotation.set(0, arc.startYaw, tiltZ);
      arc.mesh.scale.setScalar(baseScale * 0.72);
      arc.mesh.visible = true;
    };

    // 9. Keyboard & Mouse Input Listeners (Smooth Zoomed-Out Behind-Player Camera Controls)
    const keysDown = new Set<string>();
    const oneShotInput = {
      jump: false,
      light: false,
      heavy: false,
      guardJustPressed: false,
      dodge: false,
      ability: false,
      execution: false,
    };
    let mouseGuardHeld = false;
    let camYaw = Math.PI * 0.5; // Starts directly behind P1 looking at P2 (+X)
    let camPitch = 0.22;
    let shoulderSide: 1 | -1 = 1;
    let currentShoulderOffset = 0.42;
    let lastMouseX: number | null = null;
    let lastMouseY: number | null = null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      keysDown.add(e.code);
      soundEngine.unlock();

      const props = latestPropsRef.current;
      if (props.screenState !== 'combat') return;

      const kb = props.settings.keybindings;
      if (e.code === kb.lockOn) {
        e.preventDefault();
        props.onToggleLockOn();
        soundEngine.play('ui_click');
      } else if (e.code === 'Space') {
        e.preventDefault();
        oneShotInput.jump = true;
      } else if (e.code === 'KeyV') {
        shoulderSide = shoulderSide === 1 ? -1 : 1;
        soundEngine.play('ui_click');
      } else if (e.code === 'KeyG') {
        oneShotInput.execution = true;
      } else if (e.code === kb.lightAttack) {
        oneShotInput.light = true;
      } else if (e.code === kb.heavyAttack || e.code === 'KeyF') {
        oneShotInput.heavy = true;
      } else if (e.code === kb.guard) {
        oneShotInput.guardJustPressed = true;
      } else if (e.code === kb.dodge || e.code === 'KeyQ' || e.code === 'KeyC') {
        oneShotInput.dodge = true;
      } else if (e.code === kb.ability || e.code === 'KeyU' || e.code === 'KeyE') {
        oneShotInput.ability = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.code);
    };

    const onMouseDown = (e: MouseEvent) => {
      soundEngine.unlock();
      const props = latestPropsRef.current;
      if (props.screenState !== 'combat') return;

      const target = e.target as HTMLElement;
      if (target && target.closest('button, input, select, label, [role="dialog"]')) {
        return;
      }

      if (
        renderer.domElement.requestPointerLock &&
        document.pointerLockElement !== renderer.domElement
      ) {
        try {
          renderer.domElement.requestPointerLock();
        } catch {
          // Fallback to non-locked mouse tracking inside iframes
        }
      }

      if (e.button === 0) {
        oneShotInput.light = true;
      } else if (e.button === 2) {
        mouseGuardHeld = true;
        oneShotInput.guardJustPressed = true;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        mouseGuardHeld = false;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const props = latestPropsRef.current;
      if (props.screenState !== 'combat') return;

      let dx = e.movementX || 0;
      let dy = e.movementY || 0;

      if (document.pointerLockElement !== renderer.domElement) {
        if (lastMouseX !== null && lastMouseY !== null && (e.buttons === 1 || !props.lockedOn)) {
          dx = e.clientX - lastMouseX;
          dy = e.clientY - lastMouseY;
        }
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      }

      camYaw -= dx * 0.0034;
      camPitch = Math.max(-0.15, Math.min(0.65, camPitch + dy * 0.0026));
    };

    // Touch drag on right half of viewport rotates camera smoothly
    let cameraTouchId: number | null = null;
    let lastTouchX = 0;
    let lastTouchY = 0;

    const onTouchStart = (e: TouchEvent) => {
      soundEngine.unlock();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (el && el.closest('button, [aria-label="Movement Analog Joystick"]')) {
          continue;
        }
        if (t.clientX > window.innerWidth * 0.42 && cameraTouchId === null) {
          cameraTouchId = t.identifier;
          lastTouchX = t.clientX;
          lastTouchY = t.clientY;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (cameraTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === cameraTouchId) {
          const dx = t.clientX - lastTouchX;
          const dy = t.clientY - lastTouchY;
          lastTouchX = t.clientX;
          lastTouchY = t.clientY;
          camYaw -= dx * 0.0052;
          camPitch = Math.max(-0.15, Math.min(0.65, camPitch + dy * 0.0038));
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (cameraTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === cameraTouchId) {
          cameraTouchId = null;
        }
      }
    };

    const clearAllInputsOnBlur = () => {
      keysDown.clear();
      mouseGuardHeld = false;
      cameraTouchId = null;
      lastMouseX = null;
      lastMouseY = null;
      oneShotInput.jump = false;
      oneShotInput.light = false;
      oneShotInput.heavy = false;
      oneShotInput.guardJustPressed = false;
      oneShotInput.dodge = false;
      oneShotInput.ability = false;
      oneShotInput.execution = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    window.addEventListener('blur', clearAllInputsOnBlur);

    // 10. ResizeObserver for 16:9 / Responsive Viewport
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    // 11. Main Animation & Fixed-Timestep Simulation Loop
    let rafId = 0;
    let lastTime = performance.now();
    let elapsedSec = 0;
    let roundFinishedNotified = false;
    let hitMarkerFadeTimer = 0;

    const currentCamPos = new THREE.Vector3(-9.6, 3.3, 0.45);
    const currentLookAt = new THREE.Vector3(2.5, 1.65, 0.2);
    const desiredCamPos = new THREE.Vector3();
    const desiredLookAt = new THREE.Vector3();
    const lockWorldPos = new THREE.Vector3();

    const processCombatEvents = (events: CombatEvent[]) => {
      const sim = simRef.current;
      for (const evt of events) {
        latestPropsRef.current.onCombatEvent(evt);
        const attacker = evt.attackerId === 'p2' ? sim.p2 : sim.p1;
        const isVolt = attacker.characterId === 'volt';
        const primaryBladeColor = isVolt ? 0x38bdf8 : 0xa855f7;
        const heavyBladeColor = isVolt ? 0xf59e0b : 0xf43f5e;
        const fAngle = evt.facingAngle ?? attacker.facingAngle;

        switch (evt.type) {
          case 'attack_swing': {
            soundEngine.play('swing_light');
            const kind = evt.attackKind || 'light_1';
            if (kind === 'light_1') {
              spawnSlashArc(attacker.x, attacker.y + 1.18, attacker.z, fAngle, primaryBladeColor, -0.16, 1, 1.05, 0.21);
              spawnBurst(evt.x, evt.y, evt.z, primaryBladeColor, 6, 4.5, 0.85);
            } else if (kind === 'light_2') {
              spawnSlashArc(attacker.x, attacker.y + 1.22, attacker.z, fAngle, primaryBladeColor, 0.22, -1, 1.15, 0.22);
              spawnBurst(evt.x, evt.y, evt.z, primaryBladeColor, 8, 5.2, 0.9);
            } else if (kind === 'light_3') {
              spawnSlashArc(attacker.x, attacker.y + 1.25, attacker.z, fAngle, primaryBladeColor, -0.52, 1, 1.32, 0.26);
              spawnSlashArc(attacker.x, attacker.y + 1.25, attacker.z, fAngle, heavyBladeColor, 0.52, -1, 1.28, 0.26);
              spawnBurst(evt.x, evt.y, evt.z, heavyBladeColor, 14, 7.2, 1.1);
            } else if (kind === 'heavy') {
              spawnSlashArc(attacker.x, attacker.y + 1.35, attacker.z, fAngle, heavyBladeColor, Math.PI * 0.44, 1, 1.48, 0.28);
              spawnShockwave(evt.x, getArenaSurfaceHeight(sim.arenaId, evt.x, evt.z), evt.z, heavyBladeColor, 3.8, 0.32);
              spawnBurst(evt.x, evt.y, evt.z, heavyBladeColor, 16, 8.0, 1.15);
            } else if (kind === 'execution') {
              spawnSlashArc(attacker.x, attacker.y + 1.3, attacker.z, fAngle, 0xff3300, -0.62, 1, 1.68, 0.32);
              spawnSlashArc(attacker.x, attacker.y + 1.3, attacker.z, fAngle, primaryBladeColor, 0.62, -1, 1.68, 0.32);
            }
            break;
          }
          case 'dodge_dash':
            soundEngine.play('swing_light');
            spawnShockwave(evt.x, getArenaSurfaceHeight(sim.arenaId, evt.x, evt.z), evt.z, primaryBladeColor, 2.8, 0.26);
            spawnBurst(evt.x, evt.y, evt.z, primaryBladeColor, 12, 6.2, 0.95);
            break;
          case 'hit_light':
            soundEngine.play('hit_light');
            spawnBurst(evt.x, evt.y, evt.z, 0xf59e0b, 18, 8.0, 1.05);
            spawnShockwave(evt.x, evt.y, evt.z, primaryBladeColor, 2.4, 0.22);
            hitMarkerFadeTimer = 0.18;
            break;
          case 'hit_heavy':
            soundEngine.play('hit_heavy');
            spawnBurst(evt.x, evt.y, evt.z, 0xf43f5e, 34, 11.0, 1.3);
            spawnShockwave(evt.x, getArenaSurfaceHeight(sim.arenaId, evt.x, evt.z), evt.z, 0xf59e0b, 5.4, 0.42);
            hitMarkerFadeTimer = 0.26;
            break;
          case 'execution_hit':
            soundEngine.play('hit_heavy');
            soundEngine.play('guard_break');
            spawnBurst(evt.x, evt.y, evt.z, 0xff3300, 48, 13.0, 1.5);
            spawnBurst(evt.x, evt.y + 0.4, evt.z, 0x38bdf8, 28, 11.0, 1.3);
            spawnShockwave(evt.x, getArenaSurfaceHeight(sim.arenaId, evt.x, evt.z), evt.z, 0xef4444, 8.2, 0.55);
            hitMarkerFadeTimer = 0.35;
            break;
          case 'hit_ability':
            soundEngine.play('hit_heavy');
            spawnBurst(evt.x, evt.y, evt.z, 0x38bdf8, 34, 11.0, 1.2);
            spawnShockwave(evt.x, getArenaSurfaceHeight(sim.arenaId, evt.x, evt.z), evt.z, 0x38bdf8, 6.8, 0.48);
            hitMarkerFadeTimer = 0.26;
            break;
          case 'blocked':
            soundEngine.play('block');
            spawnBurst(evt.x, evt.y, evt.z, 0x93c5fd, 14, 6.0);
            spawnShockwave(evt.x, evt.y, evt.z, 0x93c5fd, 2.2, 0.2);
            break;
          case 'parried':
            soundEngine.play('parry');
            spawnBurst(evt.x, evt.y, evt.z, 0x38bdf8, 36, 11.5, 1.3);
            spawnShockwave(evt.x, evt.y - 0.8, evt.z, 0x38bdf8, 6.2, 0.45);
            break;
          case 'counter_riposte':
            soundEngine.play('parry');
            soundEngine.play('swing_light');
            spawnSlashArc(attacker.x, attacker.y + 1.22, attacker.z, fAngle, 0xfbbf24, -0.25, 1, 1.4, 0.26);
            spawnBurst(evt.x, evt.y, evt.z, 0xfbbf24, 24, 9.5, 1.2);
            spawnShockwave(evt.x, getArenaSurfaceHeight(sim.arenaId, evt.x, evt.z), evt.z, 0xfbbf24, 4.4, 0.34);
            break;
          case 'combo_breaker':
            soundEngine.play('parry');
            spawnBurst(evt.x, evt.y, evt.z, 0x38bdf8, 28, 10.0, 1.25);
            spawnShockwave(evt.x, getArenaSurfaceHeight(sim.arenaId, evt.x, evt.z), evt.z, 0x38bdf8, 5.2, 0.38);
            break;
          case 'guard_break':
            soundEngine.play('guard_break');
            spawnBurst(evt.x, evt.y, evt.z, 0xef4444, 34, 10.5, 1.25);
            spawnShockwave(evt.x, getArenaSurfaceHeight(sim.arenaId, evt.x, evt.z), evt.z, 0xef4444, 5.8, 0.48);
            break;
          case 'ability_cast':
            soundEngine.play(
              evt.attackerId === 'p1' && latestPropsRef.current.p1Char === 'volt'
                ? 'ability_volt'
                : 'ability_rift'
            );
            spawnSlashArc(attacker.x, attacker.y + 1.25, attacker.z, fAngle, primaryBladeColor, 0, 1, 1.55, 0.28);
            spawnShockwave(evt.x, getArenaSurfaceHeight(sim.arenaId, evt.x, evt.z), evt.z, primaryBladeColor, 5.8, 0.42);
            spawnBurst(evt.x, evt.y + 1.0, evt.z, primaryBladeColor, 22, 9.0, 1.2);
            break;
          case 'prop_hit':
            soundEngine.play('block');
            spawnBurst(evt.x, evt.y, evt.z, evt.propKind === 'barrel' ? 0x38bdf8 : 0xd97706, 10, 5.5);
            break;
          case 'prop_shatter':
            soundEngine.play('guard_break');
            spawnBurst(
              evt.x,
              evt.y,
              evt.z,
              evt.propKind === 'barrel' ? 0x38bdf8 : 0xb45309,
              32,
              9.5,
              1.4
            );
            spawnBurst(evt.x, evt.y + 0.2, evt.z, 0xf59e0b, 18, 8.0, 1.1);
            spawnShockwave(evt.x, 0.08, evt.z, evt.propKind === 'barrel' ? 0x38bdf8 : 0xd97706, 3.8, 0.35);
            break;
          case 'barrel_explode':
            soundEngine.play('hit_heavy');
            spawnBurst(evt.x, evt.y + 0.3, evt.z, 0xff5500, 46, 13.5, 1.6);
            spawnBurst(evt.x, evt.y + 0.5, evt.z, 0x38bdf8, 28, 11.5, 1.3);
            spawnShockwave(evt.x, 0.1, evt.z, 0xff4400, 6.8, 0.52);
            break;
          case 'tile_crack':
            spawnBurst(evt.x, 0.15, evt.z, 0xff6600, 10, 5.0, 0.9);
            break;
          case 'tile_shatter':
            soundEngine.play('hit_heavy');
            spawnBurst(evt.x, 0.2, evt.z, 0xff4400, 22, 8.5, 1.3);
            spawnShockwave(evt.x, 0.06, evt.z, 0xff4400, 3.4, 0.36);
            break;
          case 'decoy_shatter':
            soundEngine.play('block');
            spawnBurst(evt.x, evt.y, evt.z, 0x38bdf8, 22, 8.0);
            break;
          case 'ko':
            soundEngine.play('ko_slowmo');
            break;
        }
      }
    };

    const buildLocalPlayerInput = (
      camForwardX: number,
      camForwardZ: number,
      camRightX: number,
      camRightZ: number
    ): FighterInput => {
      const kb = latestPropsRef.current.settings.keybindings;
      const touch = touchInputRef.current;

      let localRight = 0;
      let localForward = 0;

      if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) localRight += 1;
      if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) localRight -= 1;
      if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) localForward += 1;
      if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) localForward -= 1;

      if (Math.hypot(touch.moveX, touch.moveZ) > 0.05) {
        localRight = touch.moveX;
        localForward = -touch.moveZ;
      }

      // Pure horizontal camera-yaw relative XZ movement (prevents any lock-on movement lock or feedback glitch)
      let worldX = camRightX * localRight + camForwardX * localForward;
      let worldZ = camRightZ * localRight + camForwardZ * localForward;
      const mag = Math.hypot(worldX, worldZ);
      if (mag > 1) {
        worldX /= mag;
        worldZ /= mag;
      }

      const sprintHeld =
        keysDown.has(kb.sprint) || keysDown.has('ShiftRight') || touch.sprint;
      const guardHeld = keysDown.has(kb.guard) || mouseGuardHeld || touch.guardHeld;

      if (touch.shoulderTogglePressed) {
        shoulderSide = shoulderSide === 1 ? -1 : 1;
        touch.shoulderTogglePressed = false;
      }

      const input: FighterInput = {
        moveX: worldX,
        moveZ: worldZ,
        sprint: sprintHeld,
        jumpPressed: oneShotInput.jump || Boolean(touch.jumpPressed),
        lightPressed: oneShotInput.light || touch.lightPressed,
        heavyPressed: oneShotInput.heavy || touch.heavyPressed,
        guardHeld,
        guardJustPressed: oneShotInput.guardJustPressed || touch.guardJustPressed,
        dodgePressed: oneShotInput.dodge || touch.dodgePressed,
        abilityPressed: oneShotInput.ability || touch.abilityPressed,
        executionPressed: oneShotInput.execution,
      };

      // Reset one-shot triggers
      oneShotInput.jump = false;
      oneShotInput.light = false;
      oneShotInput.heavy = false;
      oneShotInput.guardJustPressed = false;
      oneShotInput.dodge = false;
      oneShotInput.ability = false;
      oneShotInput.execution = false;
      touch.jumpPressed = false;
      touch.lightPressed = false;
      touch.heavyPressed = false;
      touch.guardJustPressed = false;
      touch.dodgePressed = false;
      touch.abilityPressed = false;

      return input;
    };

    const updateHudDomDirectly = (sim: SimulationState) => {
      const refs = hudRefs;
      const p1Pct = Math.max(0, Math.min(100, (sim.p1.hp / sim.p1.maxHp) * 100));
      const p1GhostPct = Math.max(0, Math.min(100, (sim.p1.ghostHp / sim.p1.maxHp) * 100));
      const p1StamPct = Math.max(0, Math.min(100, (sim.p1.stamina / sim.p1.maxStamina) * 100));

      const p2Pct = Math.max(0, Math.min(100, (sim.p2.hp / sim.p2.maxHp) * 100));
      const p2GhostPct = Math.max(0, Math.min(100, (sim.p2.ghostHp / sim.p2.maxHp) * 100));
      const p2StamPct = Math.max(0, Math.min(100, (sim.p2.stamina / sim.p2.maxStamina) * 100));

      if (refs.p1HpFill.current) refs.p1HpFill.current.style.width = `${p1Pct}%`;
      if (refs.p1HpGhost.current) refs.p1HpGhost.current.style.width = `${p1GhostPct}%`;
      if (refs.p1HpText.current) {
        refs.p1HpText.current.textContent = `${Math.ceil(sim.p1.hp)}`;
      }
      if (refs.p1StaminaFill.current) refs.p1StaminaFill.current.style.width = `${p1StamPct}%`;
      if (refs.p1StaminaText.current) {
        refs.p1StaminaText.current.textContent = `${Math.floor(sim.p1.stamina)}`;
      }
      if (refs.p1StateBadge.current) {
        const label =
          sim.p1.action === 'attack_active' && sim.p1.currentAttack === 'execution'
            ? 'EXECUTING!'
            : sim.p1.hyperArmorMs > 0
              ? 'HYPER ARMOR!'
              : sim.p1.counterWindowMs > 0
                ? 'COUNTER READY!'
                : sim.p1.action.replace('_', ' ').toUpperCase();
        refs.p1StateBadge.current.textContent = label;
      }

      if (refs.p2HpFill.current) refs.p2HpFill.current.style.width = `${p2Pct}%`;
      if (refs.p2HpGhost.current) refs.p2HpGhost.current.style.width = `${p2GhostPct}%`;
      if (refs.p2HpText.current) {
        refs.p2HpText.current.textContent = `${Math.ceil(sim.p2.hp)}`;
      }
      if (refs.p2StaminaFill.current) refs.p2StaminaFill.current.style.width = `${p2StamPct}%`;
      if (refs.p2StaminaText.current) {
        refs.p2StaminaText.current.textContent = `${Math.floor(sim.p2.stamina)}`;
      }
      if (refs.p2StateBadge.current) {
        const isExecVulnerable =
          sim.p2.action === 'guard_break' || sim.p2.action === 'parry_stun' || sim.p2.poise <= 5;
        refs.p2StateBadge.current.textContent = isExecVulnerable
          ? 'STAGGERED'
          : sim.p2.action.replace('_', ' ').toUpperCase();
      }

      if (refs.timerText.current) {
        if (latestPropsRef.current.gameMode === 'training') {
          refs.timerText.current.textContent = '∞';
        } else {
          refs.timerText.current.textContent = `${Math.ceil(sim.roundTimerMs / 1000)}`;
        }
      }

      if (refs.aiStateBadge.current) {
        refs.aiStateBadge.current.textContent = sim.p2.aiCurrentOrder
          .replace('_', ' ')
          .toUpperCase();
      }

      // Ability cooldown bar & mobile button overlay
      const p1Def = CHARACTER_REGISTRY[sim.p1.characterId];
      const cdRatio = Math.max(
        0,
        Math.min(1, 1 - sim.p1.abilityCooldownMs / p1Def.ability.cooldownMs)
      );
      if (refs.p1AbilityFill.current) {
        refs.p1AbilityFill.current.style.width = `${cdRatio * 100}%`;
      }
      if (refs.p1AbilityText.current) {
        refs.p1AbilityText.current.textContent =
          sim.p1.abilityCooldownMs <= 0
            ? 'READY'
            : `${(sim.p1.abilityCooldownMs / 1000).toFixed(1)}s`;
      }
      if (refs.mobileAbilityOverlay.current) {
        refs.mobileAbilityOverlay.current.style.height = `${(1 - cdRatio) * 100}%`;
      }
      if (refs.mobileAbilityTimer.current) {
        refs.mobileAbilityTimer.current.textContent =
          sim.p1.abilityCooldownMs <= 0
            ? ''
            : `${(sim.p1.abilityCooldownMs / 1000).toFixed(1)}s`;
      }

      // Combo Boxes
      if (refs.p1ComboBox.current) {
        if (sim.p1.comboCount >= 2) {
          refs.p1ComboBox.current.style.opacity = '1';
          if (refs.p1ComboHits.current) {
            refs.p1ComboHits.current.textContent = `${sim.p1.comboCount} HIT`;
          }
          if (refs.p1ComboDmg.current) {
            refs.p1ComboDmg.current.textContent = `${sim.p1.comboDamage} DMG`;
          }
        } else {
          refs.p1ComboBox.current.style.opacity = '0';
        }
      }

      if (refs.p2ComboBox.current) {
        if (sim.p2.comboCount >= 2) {
          refs.p2ComboBox.current.style.opacity = '1';
          if (refs.p2ComboHits.current) {
            refs.p2ComboHits.current.textContent = `${sim.p2.comboCount} HIT`;
          }
          if (refs.p2ComboDmg.current) {
            refs.p2ComboDmg.current.textContent = `${sim.p2.comboDamage} DMG`;
          }
        } else {
          refs.p2ComboBox.current.style.opacity = '0';
        }
      }

      // Project 3D Target Lock-on Reticle onto Opponent's Chest
      if (refs.lockReticle.current) {
        if (
          latestPropsRef.current.screenState === 'combat' &&
          latestPropsRef.current.lockedOn
        ) {
          lockWorldPos.set(sim.p2.x, sim.p2.y + 1.35, sim.p2.z);
          lockWorldPos.project(camera);
          if (lockWorldPos.z < 1) {
            const xPx = (lockWorldPos.x * 0.5 + 0.5) * window.innerWidth;
            const yPx = (-lockWorldPos.y * 0.5 + 0.5) * window.innerHeight;
            refs.lockReticle.current.style.transform = `translate3d(${xPx}px, ${yPx}px, 0) translate(-50%, -50%)`;
            refs.lockReticle.current.style.opacity = '0.92';
          } else {
            refs.lockReticle.current.style.opacity = '0';
          }
        } else {
          refs.lockReticle.current.style.opacity = '0';
        }
      }

      // Dynamic Over-The-Shoulder Crosshair & Hit Marker Feedback
      if (refs.crosshairRef?.current) {
        const isAiming = sim.p1.action === 'block' || sim.p1.action === 'parry_window';
        const isSprinting = sim.p1.action === 'sprint';
        const scale = isAiming ? 0.72 : isSprinting ? 1.25 : 1.0;
        refs.crosshairRef.current.style.transform = `translate(-50%, -50%) scale(${scale})`;
      }
      if (refs.hitMarkerRef?.current) {
        refs.hitMarkerRef.current.style.opacity = hitMarkerFadeTimer > 0 ? '1' : '0';
      }
    };

    const camDir = new THREE.Vector3();
    const camRight = new THREE.Vector3();
    let rollingFrameMs = 16.6;
    let currentDynamicDpr = Math.min(window.devicePixelRatio || 1, dprCap);
    let dprCheckTimer = 0;

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const frameDelta = Math.max(1, now - lastTime);
      const rawDtMs = Math.min(50, frameDelta);
      lastTime = now;
      const dtSec = rawDtMs / 1000;
      elapsedSec += dtSec;

      // Auto-60FPS Dynamic Resolution Scaler (DRS) for lower-end mobile devices
      if (!isHeadless && frameDelta < 120) {
        rollingFrameMs = rollingFrameMs * 0.9 + frameDelta * 0.1;
        dprCheckTimer += dtSec;
        if (dprCheckTimer > 0.75) {
          dprCheckTimer = 0;
          const maxTargetDpr = Math.min(
            window.devicePixelRatio || 1,
            latestPropsRef.current.settings.graphicsQuality === 'high'
              ? 1.75
              : latestPropsRef.current.settings.graphicsQuality === 'medium'
                ? 1.35
                : 1.0
          );
          if (rollingFrameMs > 20.5 && currentDynamicDpr > 0.8) {
            currentDynamicDpr = Math.max(0.8, +(currentDynamicDpr - 0.15).toFixed(2));
            renderer.setPixelRatio(currentDynamicDpr);
          } else if (rollingFrameMs < 14.5 && currentDynamicDpr < maxTargetDpr) {
            currentDynamicDpr = Math.min(maxTargetDpr, +(currentDynamicDpr + 0.1).toFixed(2));
            renderer.setPixelRatio(currentDynamicDpr);
          }
        }
      }

      if (hitMarkerFadeTimer > 0) {
        hitMarkerFadeTimer = Math.max(0, hitMarkerFadeTimer - dtSec);
      }

      const props = latestPropsRef.current;
      const sim = simRef.current;

      // Rebuild Arena if ArenaId changed
      if (props.arenaId !== currentArenaId) {
        scene.remove(arenaRig.group);
        currentArenaId = props.arenaId;
        arenaRig = buildArenaScene(currentArenaId, matLib);
        scene.add(arenaRig.group);
        scene.fog = new THREE.FogExp2(arenaRig.fogColor.getHex(), arenaRig.fogDensity);
        scene.background = arenaRig.fogColor;
      }

      // Rebuild P1 or P2 Fighter Rig if character selection changed
      if (props.p1Char !== currentP1Char) {
        scene.remove(p1Rig.root);
        currentP1Char = props.p1Char;
        p1Rig = buildFighterRig(currentP1Char, matLib, false);
        scene.add(p1Rig.root);
      }
      if (props.p2Char !== currentP2Char) {
        scene.remove(p2Rig.root);
        currentP2Char = props.p2Char;
        p2Rig = buildFighterRig(currentP2Char, matLib, false);
        scene.add(p2Rig.root);
      }

      // Use stable horizontal camYaw basis for movement so lookAt tilt or screenShake never twists player movement
      camDir.set(Math.sin(camYaw), 0, Math.cos(camYaw)).normalize();
      camRight.set(-camDir.z, 0, camDir.x).normalize();

      // Advance Combat Simulation when in active combat
      const isPortraitPaused = Boolean(touchInputRef.current.portraitOverlayActive);

      if (props.screenState === 'combat' && !isPortraitPaused) {
        if (!sim.roundOver) {
          roundFinishedNotified = false;
        }

        const localInput = buildLocalPlayerInput(
          camDir.x,
          camDir.z,
          camRight.x,
          camRight.z
        );

        if (props.gameMode === 'multiplayer') {
          if (multiplayerClient.localRole === 'host') {
            const guestIn = multiplayerClient.latestGuestInput || emptyInput();
            stepSimulation(sim, localInput, guestIn, rawDtMs, false);
            multiplayerClient.clearGuestOneShots();
            multiplayerClient.sendHostSnapshot(sim);
          } else {
            multiplayerClient.sendGuestInput(localInput);
            stepSimulation(sim, emptyInput(), localInput, rawDtMs, false);
          }
        } else if (props.gameMode === 'training') {
          const botIn = computeBotInput(
            sim,
            sim.p2,
            sim.p1,
            props.trainingConfig.botDifficulty,
            rawDtMs,
            props.trainingConfig
          );
          stepSimulation(sim, localInput, botIn, rawDtMs, true, props.trainingConfig);
        } else {
          // Single-Player vs Bot
          const botIn = computeBotInput(
            sim,
            sim.p2,
            sim.p1,
            props.botDifficulty,
            rawDtMs
          );
          stepSimulation(sim, localInput, botIn, rawDtMs, false);
        }

        if (sim.events.length > 0) {
          processCombatEvents(sim.events);
        }

        if (sim.roundOver && !roundFinishedNotified && sim.roundWinner) {
          roundFinishedNotified = true;
          props.onRoundFinished(sim.roundWinner);
        }
      }

      // Sync 3D Breakable Crates, Energy Barrels, and Destructible Floor Tiles with SimulationState
      syncArenaBreakables(arenaRig, sim);

      // Update fighter 3D skeletal rigs & ground-height-aware contact shadows
      const p1GroundY = getArenaSurfaceHeight(sim.arenaId, sim.p1.x, sim.p1.z);
      const p2GroundY = getArenaSurfaceHeight(sim.arenaId, sim.p2.x, sim.p2.z);
      updateFighterRigAnimation(
        p1Rig,
        sim.p1,
        dtSec,
        elapsedSec,
        p1GroundY,
        (x, y, z, scale = 1, colorHex = 0xd9c9a8) =>
          spawnBurst(x, y, z, colorHex, 2, 1.1 * scale)
      );
      updateFighterRigAnimation(
        p2Rig,
        sim.p2,
        dtSec,
        elapsedSec,
        p2GroundY,
        (x, y, z, scale = 1, colorHex = 0xd9c9a8) =>
          spawnBurst(x, y, z, colorHex, 2, 1.1 * scale)
      );

      if (sim.decoy && sim.decoy.active) {
        decoyRig.root.visible = true;
        const decoyGroundY = getArenaSurfaceHeight(sim.arenaId, sim.decoy.x, sim.decoy.z);
        decoyRig.root.position.set(sim.decoy.x, decoyGroundY, sim.decoy.z);
        decoyRig.root.rotation.y = sim.decoy.facingAngle;
      } else {
        decoyRig.root.visible = false;
      }

      // Update 3D Plasma Gravity Orb Projectile visual
      if (sim.projectiles.length > 0) {
        const proj = sim.projectiles[0];
        orbGroup.visible = true;
        orbGroup.position.set(proj.x, proj.y, proj.z);
        orbShellMesh.rotation.x += dtSec * 6.5;
        orbShellMesh.rotation.y += dtSec * 8.2;
      } else {
        orbGroup.visible = false;
      }

      // Update Arena Machinery & Lava Animations (Foundry Arena v4)
      updateArenaScene(arenaRig, elapsedSec, dtSec);

      // Update Instanced Sparks & Debris Particles (only upload GPU buffers when active particles exist)
      let anyParticleUpdated = false;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!p.active) continue;
        anyParticleUpdated = true;
        p.age += dtSec;
        if (p.age >= p.maxAge) {
          p.active = false;
          dummyObj.scale.setScalar(0);
          dummyObj.updateMatrix();
          sparkInstanced.setMatrixAt(i, dummyObj.matrix);
        } else {
          p.vy -= 18.5 * dtSec;
          p.x += p.vx * dtSec;
          p.y += p.vy * dtSec;
          p.z += p.vz * dtSec;
          const floorY = getArenaSurfaceHeight(sim.arenaId, p.x, p.z) + 0.05;
          if (p.y < floorY) {
            p.y = floorY;
            p.vy = Math.abs(p.vy) * 0.35;
            p.vx *= 0.7;
            p.vz *= 0.7;
          }
          const lifeRatio = 1 - p.age / p.maxAge;
          dummyObj.position.set(p.x, p.y, p.z);
          dummyObj.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);
          dummyObj.scale.set(
            p.scale * lifeRatio,
            p.scale * lifeRatio,
            p.scale * lifeRatio * 2.1
          );
          dummyObj.updateMatrix();
          sparkInstanced.setMatrixAt(i, dummyObj.matrix);
          sparkInstanced.setColorAt(i, p.color);
        }
      }
      if (anyParticleUpdated) {
        sparkInstanced.instanceMatrix.needsUpdate = true;
        if (sparkInstanced.instanceColor) sparkInstanced.instanceColor.needsUpdate = true;
      }

      // Update Shockwave Rings
      for (const ring of shockwaves) {
        if (ring.active) {
          ring.age += dtSec;
          if (ring.age >= ring.maxAge) {
            ring.active = false;
            ring.mesh.visible = false;
          } else {
            const t = ring.age / ring.maxAge;
            const easeOut = 1 - Math.pow(1 - t, 3);
            ring.mesh.scale.setScalar(0.3 + easeOut * ring.maxScale);
            ring.mat.opacity = (1 - t) * 0.85;
          }
        }
      }

      // Update 3D Glowing Crescent Weapon Slash Arcs
      for (const arc of slashArcs) {
        if (arc.active) {
          arc.age += dtSec;
          if (arc.age >= arc.maxAge) {
            arc.active = false;
            arc.mesh.visible = false;
          } else {
            const t = arc.age / arc.maxAge;
            const easeOut = 1 - Math.pow(1 - t, 2.4);
            arc.mesh.rotation.y = arc.startYaw + arc.spinSpeed * arc.age;
            arc.mesh.scale.setScalar(arc.baseScale * (0.78 + easeOut * 0.55));
            arc.mat.opacity = (1 - t) * 0.92;
          }
        }
      }

      // =====================================================================
      // CAMERA CONTROLLER:
      // SMOOTH ZOOMED-OUT BEHIND-PLAYER CAMERA (NO LOCK-ON GLITCHING)
      // =====================================================================
      if (
        props.screenState === 'main_menu' ||
        props.screenState === 'mode_select' ||
        props.screenState === 'multiplayer_lobby'
      ) {
        const orbitAngle = Math.PI - 0.42 + elapsedSec * 0.14;
        desiredCamPos.set(
          Math.cos(orbitAngle) * 8.2,
          3.35,
          Math.sin(orbitAngle) * 8.2
        );
        desiredLookAt.set(0.6, 1.9, -0.4);
      } else if (props.screenState === 'character_select') {
        desiredCamPos.set(-3.6, 2.65, 4.2);
        desiredLookAt.set(-3.6, 2.05, 0);
      } else if (props.screenState === 'arena_select') {
        const panAngle = elapsedSec * 0.25;
        desiredCamPos.set(
          Math.cos(panAngle) * 14.5,
          6.8,
          Math.sin(panAngle) * 14.5
        );
        desiredLookAt.set(0, 1.5, 0);
      } else {
        // ACTIVE COMBAT: Zoomed-Out Behind-Player Camera
        const self =
          props.gameMode === 'multiplayer' && multiplayerClient.localRole === 'guest'
            ? sim.p2
            : sim.p1;
        const opp = self.id === 'p1' ? sim.p2 : sim.p1;

        const isAiming = self.action === 'block' || self.action === 'parry_window';
        const isSprinting = self.action === 'sprint';
        const isExecuting =
          self.action === 'attack_active' && self.currentAttack === 'execution';

        // Subtle shoulder offset so camera sits cleanly behind the player
        const targetShoulder = shoulderSide * (isAiming ? 0.52 : 0.42);
        currentShoulderOffset +=
          (targetShoulder - currentShoulderOffset) * Math.min(1, dtSec * 10);

        // Zoomed-out distance right behind the player (controlled by settings.cameraDistance, default 5.4m)
        const baseCamDist = Math.max(4.4, props.settings.cameraDistance || 5.4);
        const camDistance = isExecuting
          ? baseCamDist - 1.1
          : isAiming
            ? baseCamDist - 0.65
            : isSprinting
              ? baseCamDist + 0.75
              : baseCamDist;

        if (props.lockedOn) {
          const toOppX = opp.x - self.x;
          const toOppZ = opp.z - self.z;
          const toOppDist = Math.hypot(toOppX, toOppZ);
          // Only rotate camera yaw when opponent is not overlapping player's exact position (prevents 180-degree spin glitch)
          if (toOppDist > 0.85 && cameraTouchId === null) {
            const targetYaw = Math.atan2(toOppX, toOppZ);
            camYaw = lerpAngle(camYaw, targetYaw, Math.min(1, dtSec * 6.2));
          }
        }

        const fwdX = Math.sin(camYaw);
        const fwdZ = Math.cos(camYaw);
        const rightX = -fwdZ;
        const rightZ = fwdX;

        const camHeightOffset = 2.68 + Math.sin(camPitch) * 1.15;
        desiredCamPos.set(
          self.x - fwdX * camDistance + rightX * currentShoulderOffset,
          self.y + camHeightOffset,
          self.z - fwdZ * camDistance + rightZ * currentShoulderOffset
        );

        if (props.lockedOn) {
          // Look smoothly past the player toward the arena ahead, blended gently with opponent
          const forwardLookX = self.x + fwdX * 7.5 + rightX * (currentShoulderOffset * 0.45);
          const forwardLookZ = self.z + fwdZ * 7.5 + rightZ * (currentShoulderOffset * 0.45);
          desiredLookAt.set(
            forwardLookX * 0.62 + opp.x * 0.38,
            self.y * 0.55 + opp.y * 0.45 + 1.45 - Math.sin(camPitch) * 0.45,
            forwardLookZ * 0.62 + opp.z * 0.38
          );
        } else {
          desiredLookAt.set(
            self.x + fwdX * 8.5 + rightX * (currentShoulderOffset * 0.55),
            self.y + 1.48 - Math.sin(camPitch) * 1.85,
            self.z + fwdZ * 8.5 + rightZ * (currentShoulderOffset * 0.55)
          );
        }

        // Smooth radial pillar repulsion (prevents sudden ray-snapping camera glitches)
        desiredCamPos.x = Math.max(-33.2, Math.min(33.2, desiredCamPos.x));
        desiredCamPos.z = Math.max(-23.2, Math.min(23.2, desiredCamPos.z));

        for (const col of arenaRig.colliders) {
          if (col.height < 2.2) continue;
          const dx = desiredCamPos.x - col.x;
          const dz = desiredCamPos.z - col.z;
          const dist = Math.hypot(dx, dz);
          const minCamClearance = col.radius + 0.65;
          if (dist < minCamClearance && dist > 0.001) {
            const push = minCamClearance - dist;
            desiredCamPos.x += (dx / dist) * push;
            desiredCamPos.z += (dz / dist) * push;
          }
        }

        const camGroundY = getArenaSurfaceHeight(sim.arenaId, desiredCamPos.x, desiredCamPos.z);
        desiredCamPos.y = Math.max(camGroundY + 1.05, desiredCamPos.y);
      }

      // Smooth spring-damped camera tracking
      const lerpFactor = 1 - Math.exp(-12 * dtSec);
      currentCamPos.lerp(desiredCamPos, lerpFactor);
      currentLookAt.lerp(desiredLookAt, lerpFactor);

      camera.position.copy(currentCamPos);

      // Apply impact screen shake
      if (sim.screenShake > 0.01) {
        const shakeAmt = sim.screenShake * 0.22;
        camera.position.x += (Math.random() - 0.5) * shakeAmt;
        camera.position.y += (Math.random() - 0.5) * shakeAmt;
        camera.position.z += (Math.random() - 0.5) * shakeAmt;
      }

      camera.lookAt(currentLookAt);

      // Update HUD DOM bars directly at 60fps
      updateHudDomDirectly(sim);

      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('blur', clearAllInputsOnBlur);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 z-0 w-full h-full overflow-hidden bg-[#0c101c]"
    />
  );
};
