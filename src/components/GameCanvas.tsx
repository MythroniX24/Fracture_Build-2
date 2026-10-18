import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  ARENA_REGISTRY,
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
  FighterInput,
  SimulationState,
  createEmptyInput,
  stepSimulation,
} from '../game/rules.ts';
import { BotAIController } from '../game/ai.ts';
import { createMaterialLibrary, setupStudioEnvironment } from '../three/materials.ts';
import {
  ArticulatedFighterRig,
  buildArticulatedFighter,
  updateFighterRigAnimation,
} from '../three/characters.ts';
import { ArenaSceneRig, buildArenaScene } from '../three/arenas.ts';
import { PooledParticleSystem } from '../three/particles.ts';
import { HudDomRefs, TouchInputState } from './CombatHUD.tsx';
import { soundEngine } from '../audio/soundEngine.ts';
import { multiplayerClient } from '../network/multiplayerClient.ts';

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

// Pre-allocated math helpers at module scope to prevent GC inside 60Hz loop
const _camTargetPos = new THREE.Vector3();
const _camDesiredPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _smoothLookTarget = new THREE.Vector3(0, 1.2, 0);
const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

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

  // Store latest props in refs so the persistent Three.js animation loop reads fresh state without re-mounting WebGL
  const livePropsRef = useRef({
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
    livePropsRef.current = {
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
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isHeadless && livePropsRef.current.settings.graphicsQuality !== 'low',
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;
    renderer.setSize(window.innerWidth, window.innerHeight);

    const applyGraphicsSettings = (quality: 'low' | 'medium' | 'high') => {
      if (isHeadless) {
        renderer.setPixelRatio(1);
        renderer.shadowMap.enabled = false;
        return;
      }
      const dpr = window.devicePixelRatio || 1;
      if (quality === 'low') {
        renderer.setPixelRatio(Math.min(dpr, 1.0));
        renderer.shadowMap.enabled = false;
      } else if (quality === 'medium') {
        renderer.setPixelRatio(Math.min(dpr, 1.5));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
      } else {
        renderer.setPixelRatio(Math.min(dpr, 2.0));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }
    };

    applyGraphicsSettings(livePropsRef.current.settings.graphicsQuality);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / Math.max(1, window.innerHeight),
      0.2,
      140
    );
    camera.position.set(0, 4.5, 11.5);
    _camTargetPos.copy(camera.position);

    const updateCameraAspectAndFov = () => {
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      const aspect = w / h;
      camera.aspect = aspect;
      // Adapt vertical FOV if viewport is narrower than 16:9 so horizontal arena framing is never cropped
      const targetAspect = 16 / 9;
      if (aspect < targetAspect) {
        const baseRad = THREE.MathUtils.degToRad(50);
        const hFov = 2 * Math.atan(Math.tan(baseRad / 2) * targetAspect);
        const adaptedVFov = 2 * Math.atan(Math.tan(hFov / 2) / Math.max(0.55, aspect));
        camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(adaptedVFov), 50, 76);
      } else {
        camera.fov = 50;
      }
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    updateCameraAspectAndFov();

    const envTexture = setupStudioEnvironment(renderer, scene, isHeadless);
    const materials = createMaterialLibrary(renderer, isHeadless);

    // 3-Point Studio & Arena Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x64748b, 0x292524, 0.95);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffedd5, 2.2);
    keyLight.position.set(12, 22, 14);
    keyLight.castShadow = !isHeadless;
    keyLight.shadow.mapSize.set(1024, 1024);
    const d = 14;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 55;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rimLight.position.set(-14, 10, -14);
    scene.add(rimLight);

    const underForgeLight = new THREE.PointLight(0xf97316, 1.8, 28, 1.6);
    underForgeLight.position.set(0, -3.5, 0);
    scene.add(underForgeLight);

    // Dynamic Scene State Holders
    let currentArenaId: ArenaId | null = null;
    let arenaRig: ArenaSceneRig | null = null;
    let currentP1Char: CharacterId | null = null;
    let currentP2Char: CharacterId | null = null;
    let p1Rig: ArticulatedFighterRig | null = null;
    let p2Rig: ArticulatedFighterRig | null = null;

    const particleSystem = new PooledParticleSystem(160);
    scene.add(particleSystem.mesh);

    const syncSceneActorsAndArena = () => {
      const { arenaId: targetArena, p1Char: targetP1, p2Char: targetP2, settings: curSettings } =
        livePropsRef.current;
      const castShadows = !isHeadless && curSettings.graphicsQuality !== 'low';

      if (currentArenaId !== targetArena) {
        if (arenaRig) {
          scene.remove(arenaRig.group);
          arenaRig.dispose();
        }
        currentArenaId = targetArena;
        arenaRig = buildArenaScene(targetArena, materials, castShadows);
        scene.add(arenaRig.group);

        const atmo = ARENA_REGISTRY[targetArena].atmosphere;
        scene.background = new THREE.Color(atmo.backgroundHex);
        scene.fog = new THREE.FogExp2(atmo.fogHex, atmo.fogDensity);
        keyLight.color.set(atmo.keyLightHex);
        keyLight.intensity = atmo.keyLightIntensity;
        hemiLight.color.set(atmo.hemiSkyHex);
        hemiLight.groundColor.set(atmo.hemiGroundHex);
        rimLight.color.set(atmo.accentHex);
        underForgeLight.color.set(targetArena === 'iron_fortress' ? 0xf97316 : 0x2dd4bf);
      }

      if (currentP1Char !== targetP1 || !p1Rig) {
        if (p1Rig) {
          scene.remove(p1Rig.root);
          scene.remove(p1Rig.decoyGroup);
        }
        currentP1Char = targetP1;
        p1Rig = buildArticulatedFighter(targetP1, materials, castShadows);
        scene.add(p1Rig.root);
        scene.add(p1Rig.decoyGroup);
      }

      if (currentP2Char !== targetP2 || !p2Rig) {
        if (p2Rig) {
          scene.remove(p2Rig.root);
          scene.remove(p2Rig.decoyGroup);
        }
        currentP2Char = targetP2;
        p2Rig = buildArticulatedFighter(targetP2, materials, castShadows);
        scene.add(p2Rig.root);
        scene.add(p2Rig.decoyGroup);
      }
    };

    syncSceneActorsAndArena();
    renderer.compile(scene, camera);

    // =========================================================================
    // UNIFIED KEYBOARD + MOUSE INPUT SYSTEM
    // =========================================================================
    const keysHeld = new Set<string>();
    const keysJustPressed = new Set<string>();
    let mouseLightJustPressed = false;
    let mouseGuardHeld = false;
    let mouseGuardJustPressed = false;
    let freeCamYaw = 0;
    let freeCamPitch = 0.36;
    let lastMouseX: number | null = null;
    let lastMouseY: number | null = null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const kb = livePropsRef.current.settings.keybindings;
      if (
        livePropsRef.current.screenState === 'combat' &&
        (e.code === kb.lockOn || e.code === 'Tab')
      ) {
        e.preventDefault();
        if (!keysHeld.has(e.code)) {
          livePropsRef.current.onToggleLockOn();
        }
      }
      if (!keysHeld.has(e.code)) {
        keysJustPressed.add(e.code);
      }
      keysHeld.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeld.delete(e.code);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (livePropsRef.current.screenState !== 'combat') return;
      // Ignore clicks on HUD buttons/inputs
      if (
        e.target instanceof HTMLElement &&
        (e.target.closest('button') ||
          e.target.closest('input') ||
          e.target.closest('[role="dialog"]'))
      ) {
        return;
      }
      if (e.button === 0) {
        mouseLightJustPressed = true;
      } else if (e.button === 2) {
        if (!mouseGuardHeld) {
          mouseGuardJustPressed = true;
        }
        mouseGuardHeld = true;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        mouseGuardHeld = false;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (livePropsRef.current.screenState !== 'combat') {
        lastMouseX = null;
        lastMouseY = null;
        return;
      }
      if (lastMouseX !== null && lastMouseY !== null) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        const sens = livePropsRef.current.settings.cameraSensitivity * 0.0035;
        freeCamYaw -= dx * sens;
        freeCamPitch = THREE.MathUtils.clamp(freeCamPitch + dy * sens * 0.7, 0.15, 0.85);
      }
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    const onContextMenu = (e: MouseEvent) => {
      if (livePropsRef.current.screenState === 'combat') {
        e.preventDefault();
      }
    };

    const clearInputs = () => {
      keysHeld.clear();
      keysJustPressed.clear();
      mouseLightJustPressed = false;
      mouseGuardHeld = false;
      mouseGuardJustPressed = false;
      lastMouseX = null;
      lastMouseY = null;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', clearInputs);
    window.addEventListener('resize', updateCameraAspectAndFov);
    window.addEventListener('orientationchange', updateCameraAspectAndFov);

    const botController = new BotAIController(2026);
    let lastQuality = livePropsRef.current.settings.graphicsQuality;
    let lastTime = performance.now();
    let elapsedTime = 0;
    let lastNetworkSyncTime = 0;
    let lastHandledRoundOver = false;
    let animFrameId = 0;

    // Multiplayer remote fighter interpolation buffer
    const remoteTarget = {
      hasData: false,
      x: 4.5,
      z: 0,
      vx: 0,
      vz: 0,
      facingAngle: -Math.PI / 2,
      hp: 100,
      stamina: 100,
      actionState: 'idle' as SimulationState['p2']['actionState'],
      actionTimer: 0,
      abilityCooldown: 0,
      decoyActive: false,
      decoyX: 0,
      decoyZ: 0,
    };

    multiplayerClient.setCallbacks({
      onRemoteSync: (sync) => {
        remoteTarget.hasData = true;
        remoteTarget.x = sync.x;
        remoteTarget.z = sync.z;
        remoteTarget.vx = sync.vx;
        remoteTarget.vz = sync.vz;
        remoteTarget.facingAngle = sync.facingAngle;
        remoteTarget.hp = sync.hp;
        remoteTarget.stamina = sync.stamina;
        remoteTarget.actionState = sync.actionState;
        remoteTarget.actionTimer = sync.actionTimer;
        remoteTarget.abilityCooldown = sync.abilityCooldown;
        remoteTarget.decoyActive = sync.decoyActive;
        remoteTarget.decoyX = sync.decoyX;
        remoteTarget.decoyZ = sync.decoyZ;
      },
      onRemoteCombatEvent: (evt) => {
        const sim = simRef.current;
        if (evt.eventKind === 'attack_hit') {
          sim.p1.hp = Math.max(0, sim.p1.hp - evt.damage);
          sim.p1.actionState = 'hit_stun';
          sim.p1.actionTimer = 0;
          sim.p1.actionDuration = 0.4;
          sim.p1.vx = evt.knockbackX;
          sim.p1.vz = evt.knockbackZ;
          sim.p1.hitFlashTimer = 0.12;
          soundEngine.play('hit_heavy');
        } else if (evt.eventKind === 'parry') {
          sim.p1.actionState = 'stagger';
          sim.p1.actionTimer = 0;
          sim.p1.actionDuration = 1.1;
          soundEngine.play('parried');
        }
      },
    });

    const tick = (now: number) => {
      animFrameId = requestAnimationFrame(tick);

      const rawDt = (now - lastTime) / 1000;
      // In headless browser CPU rendering, throttle to ~10fps so DOM clicks and screenshot captures never stall
      if (isHeadless && rawDt < 0.095) {
        return;
      }
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      elapsedTime += dt;

      const props = livePropsRef.current;
      if (props.settings.graphicsQuality !== lastQuality) {
        lastQuality = props.settings.graphicsQuality;
        applyGraphicsSettings(lastQuality);
      }

      syncSceneActorsAndArena();
      const sim = simRef.current;

      // Update Arena Rotating Gears & Environment
      arenaRig?.update(elapsedTime, dt);

      // =======================================================================
      // BUILD PLAYER 1 INPUT (Camera-Relative 360° WASD / Analog Joystick + Combat Actions)
      // =======================================================================
      const kb = props.settings.keybindings;
      const p1Input: FighterInput = createEmptyInput();
      p1Input.lockedOn = props.lockedOn;

      // True horizontal camera basis vectors projected onto XZ plane (never flips or gimbal-locks!)
      camera.getWorldDirection(_camForward);
      _camForward.y = 0;
      if (_camForward.lengthSq() > 0.0001) {
        _camForward.normalize();
      } else {
        _camForward.set(0, 0, -1);
      }
      // Right vector = Forward × Up(0,1,0) -> (-forward.z, 0, forward.x)
      _camRight.set(-_camForward.z, 0, _camForward.x);

      let rawForward = 0;
      let rawRight = 0;
      if (keysHeld.has(kb.moveForward) || keysHeld.has('ArrowUp')) rawForward += 1;
      if (keysHeld.has(kb.moveBackward) || keysHeld.has('ArrowDown')) rawForward -= 1;
      if (keysHeld.has(kb.moveRight) || keysHeld.has('ArrowRight')) rawRight += 1;
      if (keysHeld.has(kb.moveLeft) || keysHeld.has('ArrowLeft')) rawRight -= 1;

      // Normalize keyboard diagonal vector so diagonal movement is smooth and uniform
      const kbMag = Math.hypot(rawRight, rawForward);
      if (kbMag > 1) {
        rawRight /= kbMag;
        rawForward /= kbMag;
      }

      const touch = touchInputRef.current;
      if (Math.hypot(touch.moveX, touch.moveZ) > 0.01) {
        rawRight = touch.moveX;
        rawForward = -touch.moveZ;
      }

      p1Input.moveX = _camRight.x * rawRight + _camForward.x * rawForward;
      p1Input.moveZ = _camRight.z * rawRight + _camForward.z * rawForward;
      p1Input.sprint = keysHeld.has(kb.sprint) || keysHeld.has('ShiftRight') || touch.sprint;

      p1Input.lightAttackJustPressed =
        keysJustPressed.has(kb.lightAttack) ||
        mouseLightJustPressed ||
        touch.lightPressed;
      p1Input.heavyAttackJustPressed =
        keysJustPressed.has(kb.heavyAttack) || touch.heavyPressed;
      p1Input.guardHeld =
        keysHeld.has(kb.guard) || mouseGuardHeld || touch.guardHeld;
      p1Input.guardJustPressed =
        keysJustPressed.has(kb.guard) ||
        mouseGuardJustPressed ||
        touch.guardJustPressed;
      p1Input.dodgeJustPressed =
        keysJustPressed.has(kb.dodge) || touch.dodgePressed;
      p1Input.abilityJustPressed =
        keysJustPressed.has(kb.ability) ||
        keysJustPressed.has('KeyE') ||
        keysJustPressed.has('KeyU') ||
        touch.abilityPressed;

      // Clear single-frame edge triggers
      keysJustPressed.clear();
      mouseLightJustPressed = false;
      mouseGuardJustPressed = false;
      touch.lightPressed = false;
      touch.heavyPressed = false;
      touch.guardJustPressed = false;
      touch.dodgePressed = false;
      touch.abilityPressed = false;

      // Active Combat Simulation Step (pauses automatically while mobile portrait rotate overlay is active)
      if (props.screenState === 'combat' && !touch.portraitOverlayActive) {
        let p2Input = createEmptyInput();

        if (props.gameMode === 'bot') {
          p2Input = botController.computeInput(
            sim,
            sim.p2,
            sim.p1,
            props.botDifficulty,
            'active_bot',
            dt
          );
        } else if (props.gameMode === 'training') {
          p2Input = botController.computeInput(
            sim,
            sim.p2,
            sim.p1,
            props.trainingConfig.botDifficulty,
            props.trainingConfig.dummyBehavior,
            dt
          );
          // In training mode, prevent KO so practice continues seamlessly unless reset
          if (sim.p2.hp < 15) sim.p2.hp = sim.p2.maxHp;
          if (sim.p1.hp < 15) sim.p1.hp = sim.p1.maxHp;
          sim.roundTimer = 99;
        }

        if (p1Input.dodgeJustPressed) {
          soundEngine.play('dodge');
        }

        stepSimulation(sim, p1Input, p2Input, dt, {
          p1InfiniteStamina:
            props.gameMode === 'training' && props.trainingConfig.infiniteStamina,
          p1Invulnerable:
            props.gameMode === 'training' && props.trainingConfig.playerInvulnerable,
          p1InstantCooldowns:
            props.gameMode === 'training' && props.trainingConfig.instantCooldowns,
          p1AimAssist: props.settings.aimAssist,
          p1MoveAssist: props.settings.moveAssist,
        });

        // Multiplayer state synchronization & remote interpolation
        if (props.gameMode === 'multiplayer') {
          if (now - lastNetworkSyncTime > 50) {
            lastNetworkSyncTime = now;
            multiplayerClient.sendFighterSync({
              x: sim.p1.x,
              z: sim.p1.z,
              vx: sim.p1.vx,
              vz: sim.p1.vz,
              facingAngle: sim.p1.facingAngle,
              hp: sim.p1.hp,
              stamina: sim.p1.stamina,
              actionState: sim.p1.actionState,
              actionTimer: sim.p1.actionTimer,
              abilityCooldown: sim.p1.abilityCooldown,
              decoyActive: sim.p1.decoy.active,
              decoyX: sim.p1.decoy.x,
              decoyZ: sim.p1.decoy.z,
            });
          }

          if (remoteTarget.hasData) {
            const interp = Math.min(1, dt * 15);
            sim.p2.x += (remoteTarget.x - sim.p2.x) * interp;
            sim.p2.z += (remoteTarget.z - sim.p2.z) * interp;
            sim.p2.facingAngle = remoteTarget.facingAngle;
            sim.p2.actionState = remoteTarget.actionState;
            sim.p2.decoy.active = remoteTarget.decoyActive;
            sim.p2.decoy.x = remoteTarget.decoyX;
            sim.p2.decoy.z = remoteTarget.decoyZ;
          }
        }

        // Process Combat Events (Particles, Sound, Callouts)
        const pMult =
          props.settings.particleQuality === 'low'
            ? 0.4
            : props.settings.particleQuality === 'medium'
              ? 0.75
              : 1.0;

        for (const evt of sim.events) {
          props.onCombatEvent(evt);

          if (evt.type === 'hit_light') {
            soundEngine.play('hit_light');
            particleSystem.spawnBurst(evt.x, evt.y, evt.z, Math.round(8 * pMult), 0xfbbf24, 5.5, 0.9);
          } else if (evt.type === 'hit_heavy') {
            soundEngine.play('hit_heavy');
            particleSystem.spawnBurst(evt.x, evt.y, evt.z, Math.round(18 * pMult), 0xf97316, 7.5, 1.25);
          } else if (evt.type === 'hit_ability') {
            soundEngine.play('hit_ability');
            particleSystem.spawnBurst(evt.x, evt.y, evt.z, Math.round(24 * pMult), 0x38bdf8, 9.0, 1.4);
          } else if (evt.type === 'blocked') {
            soundEngine.play('blocked');
            particleSystem.spawnBurst(evt.x, evt.y, evt.z, Math.round(10 * pMult), 0x94a3b8, 4.5, 0.8);
          } else if (evt.type === 'parried') {
            soundEngine.play('parried');
            particleSystem.spawnBurst(evt.x, evt.y, evt.z, Math.round(26 * pMult), 0x38bdf8, 8.5, 1.35);
          } else if (evt.type === 'guard_break') {
            soundEngine.play('guard_break');
            particleSystem.spawnBurst(evt.x, evt.y, evt.z, Math.round(22 * pMult), 0xef4444, 8.0, 1.3);
          } else if (evt.type === 'ability_cast') {
            const attacker = evt.attackerId === 'p1' ? sim.p1 : sim.p2;
            soundEngine.play(attacker.characterId === 'volt' ? 'ability_volt' : 'ability_rift');
            particleSystem.spawnBurst(
              evt.x,
              evt.y,
              evt.z,
              Math.round(16 * pMult),
              attacker.characterId === 'volt' ? 0x38bdf8 : 0xa3b18a,
              6.0,
              1.1
            );
          } else if (evt.type === 'decoy_shatter') {
            soundEngine.play('blocked');
            particleSystem.spawnBurst(evt.x, evt.y, evt.z, Math.round(18 * pMult), 0xd6d3cd, 6.5, 1.1);
          } else if (evt.type === 'ko') {
            soundEngine.play('ko');
            particleSystem.spawnBurst(evt.x, evt.y, evt.z, Math.round(30 * pMult), 0xf97316, 9.5, 1.5);
          }
        }

        // Notify parent when round ends
        if (sim.roundOver && !lastHandledRoundOver && sim.roundWinner) {
          lastHandledRoundOver = true;
          props.onRoundFinished(sim.roundWinner);
        } else if (!sim.roundOver) {
          lastHandledRoundOver = false;
        }
      }

      // Update Articulated 3D Fighter Rigs & Pooled Particles
      if (p1Rig) updateFighterRigAnimation(p1Rig, sim.p1, elapsedTime, dt);
      if (p2Rig) updateFighterRigAnimation(p2Rig, sim.p2, elapsedTime, dt);
      particleSystem.update(dt);

      // =======================================================================
      // CAMERA CHOREOGRAPHY: Menu Showcase vs. Character Preview vs. Active Combat
      // =======================================================================
      if (props.screenState === 'character_select') {
        const focusX = sim.p1.x;
        const focusZ = sim.p1.z;
        sim.p1.facingAngle = Math.sin(elapsedTime * 0.7) * 0.45 + 0.35;
        _camDesiredPos.set(focusX + 1.1, 1.55, focusZ + 2.85);
        _lookTarget.set(focusX + 0.65, 1.15, focusZ);
      } else if (
        props.screenState === 'main_menu' ||
        props.screenState === 'mode_select' ||
        props.screenState === 'arena_select' ||
        props.screenState === 'match_settings' ||
        props.screenState === 'multiplayer_lobby'
      ) {
        const orbitAngle = elapsedTime * 0.14;
        const radius = 11.2;
        _camDesiredPos.set(
          Math.sin(orbitAngle) * radius,
          4.2 + Math.sin(elapsedTime * 0.4) * 0.6,
          Math.cos(orbitAngle) * radius
        );
        _lookTarget.set(0, 1.3, 0);
      } else if (props.lockedOn) {
        // LOCKED-ON TWO-FIGHTER TACTICAL CAMERA
        const targetX = sim.p2.decoy.active ? sim.p2.decoy.x : sim.p2.x;
        const targetZ = sim.p2.decoy.active ? sim.p2.decoy.z : sim.p2.z;
        const midX = sim.p1.x * 0.52 + targetX * 0.48;
        const midZ = sim.p1.z * 0.52 + targetZ * 0.48;
        const dx = targetX - sim.p1.x;
        const dz = targetZ - sim.p1.z;
        const fighterDist = Math.hypot(dx, dz);

        const dirX = fighterDist > 0.01 ? dx / fighterDist : 1;
        const dirZ = fighterDist > 0.01 ? dz / fighterDist : 0;
        const perpX = -dirZ;
        const perpZ = dirX;

        const sens = props.settings.cameraSensitivity;
        const camDist =
          THREE.MathUtils.clamp(4.6 + fighterDist * 0.62, 5.0, 11.8) /
          Math.pow(sens, 0.2);
        const camHeight = THREE.MathUtils.clamp(2.35 + fighterDist * 0.18, 2.45, 4.6);

        _camDesiredPos.set(
          midX + perpX * camDist - dirX * 1.25,
          camHeight,
          midZ + perpZ * camDist - dirZ * 1.25
        );
        _lookTarget.set(midX, 1.18, midZ);
        // Sync freeCamYaw so switching to free-cam is seamless
        freeCamYaw = Math.atan2(_camDesiredPos.x - sim.p1.x, _camDesiredPos.z - sim.p1.z);
      } else {
        // FREE-LOOK ORBIT CAMERA AROUND PLAYER 1 (Controlled by Mouse / Touch)
        const orbitDist = 6.2;
        const horizDist = Math.cos(freeCamPitch) * orbitDist;
        const vertHeight = 1.4 + Math.sin(freeCamPitch) * orbitDist;
        _camDesiredPos.set(
          sim.p1.x + Math.sin(freeCamYaw) * horizDist,
          vertHeight,
          sim.p1.z + Math.cos(freeCamYaw) * horizDist
        );
        _lookTarget.set(sim.p1.x, 1.25, sim.p1.z);
      }

      // Arena obstacle pull-in check so camera never clips inside a solid pillar
      if (arenaRig && arenaRig.colliderMeshes.length > 0 && props.screenState === 'combat') {
        _rayDir.copy(_camDesiredPos).sub(_lookTarget);
        const rayLen = _rayDir.length();
        if (rayLen > 0.1) {
          _rayDir.divideScalar(rayLen);
          _raycaster.set(_lookTarget, _rayDir);
          _raycaster.far = rayLen;
          const hits = _raycaster.intersectObjects(arenaRig.colliderMeshes, false);
          if (hits.length > 0 && hits[0].distance < rayLen) {
            _camDesiredPos.copy(_lookTarget).addScaledVector(_rayDir, Math.max(2.2, hits[0].distance - 0.45));
          }
        }
      }

      // Exponentially damp camera position and lookAt target
      const dampFactor = 1 - Math.exp(-9.0 * dt);
      _camTargetPos.lerp(_camDesiredPos, dampFactor);
      _smoothLookTarget.lerp(_lookTarget, dampFactor);
      camera.position.copy(_camTargetPos);

      // Apply decaying trauma^2 rotational/positional camera shake on heavy hits
      if (props.settings.screenShake && sim.cameraTrauma > 0.01) {
        const shake = sim.cameraTrauma * sim.cameraTrauma * 0.28;
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
      }

      camera.lookAt(_smoothLookTarget);
      renderer.render(scene, camera);

      // =======================================================================
      // 60HZ HIGH-FREQUENCY DOM HUD UPDATES (Zero React Re-Renders)
      // =======================================================================
      const p1Def = CHARACTER_REGISTRY[sim.p1.characterId];
      if (hudRefs.p1HpFill.current) {
        const pct = Math.max(0, Math.min(100, (sim.p1.hp / sim.p1.maxHp) * 100));
        hudRefs.p1HpFill.current.style.width = `${pct}%`;
      }
      if (hudRefs.p1HpGhost.current) {
        const pct = Math.max(0, Math.min(100, (sim.p1.ghostHp / sim.p1.maxHp) * 100));
        hudRefs.p1HpGhost.current.style.width = `${pct}%`;
      }
      if (hudRefs.p1HpText.current) {
        hudRefs.p1HpText.current.textContent = `${Math.ceil(sim.p1.hp)}`;
      }
      if (hudRefs.p1StaminaFill.current) {
        const pct = Math.max(0, Math.min(100, (sim.p1.stamina / sim.p1.maxStamina) * 100));
        hudRefs.p1StaminaFill.current.style.width = `${pct}%`;
        hudRefs.p1StaminaFill.current.style.backgroundColor =
          sim.p1.stamina < 20 ? '#ef4444' : '#38bdf8';
      }
      if (hudRefs.p1StaminaText.current) {
        hudRefs.p1StaminaText.current.textContent = `${Math.round(sim.p1.stamina)}`;
      }
      if (hudRefs.p1AbilityFill.current && hudRefs.p1AbilityText.current) {
        if (sim.p1.abilityCooldown <= 0.05) {
          hudRefs.p1AbilityFill.current.style.width = '100%';
          hudRefs.p1AbilityText.current.textContent =
            sim.p1.stamina >= p1Def.ability.staminaCost ? 'READY' : 'LOW STM';
        } else {
          const pct = Math.max(
            0,
            Math.min(100, (1 - sim.p1.abilityCooldown / sim.p1.maxAbilityCooldown) * 100)
          );
          hudRefs.p1AbilityFill.current.style.width = `${pct}%`;
          hudRefs.p1AbilityText.current.textContent = `${sim.p1.abilityCooldown.toFixed(1)}s`;
        }
      }
      if (hudRefs.mobileAbilityOverlay.current && hudRefs.mobileAbilityTimer.current) {
        if (sim.p1.abilityCooldown <= 0.05) {
          hudRefs.mobileAbilityOverlay.current.style.height = '0%';
          hudRefs.mobileAbilityTimer.current.textContent = 'SPECIAL';
        } else {
          const cdPct = Math.max(
            0,
            Math.min(100, (sim.p1.abilityCooldown / sim.p1.maxAbilityCooldown) * 100)
          );
          hudRefs.mobileAbilityOverlay.current.style.height = `${cdPct}%`;
          hudRefs.mobileAbilityTimer.current.textContent = `${sim.p1.abilityCooldown.toFixed(1)}s`;
        }
      }

      // Update mobile button stamina/cooldown availability visual states
      if (hudRefs.btnLightRef.current) {
        hudRefs.btnLightRef.current.style.opacity =
          sim.p1.stamina >= p1Def.attacks.light.staminaCost ? '1' : '0.45';
      }
      if (hudRefs.btnHeavyRef.current) {
        hudRefs.btnHeavyRef.current.style.opacity =
          sim.p1.stamina >= p1Def.attacks.heavy.staminaCost ? '1' : '0.45';
      }
      if (hudRefs.btnDodgeRef.current) {
        hudRefs.btnDodgeRef.current.style.opacity =
          sim.p1.stamina >= p1Def.stats.dodgeStaminaCost ? '1' : '0.45';
      }
      if (hudRefs.btnAbilityRef.current) {
        hudRefs.btnAbilityRef.current.style.opacity =
          sim.p1.abilityCooldown <= 0.05 && sim.p1.stamina >= p1Def.ability.staminaCost
            ? '1'
            : '0.55';
      }

      if (hudRefs.p1StateBadge.current) {
        const label =
          sim.p1.overchargeBuffTimer > 0 && sim.p1.actionState === 'idle'
            ? 'OVERCHARGED'
            : sim.p1.actionState.replace('_', ' ');
        hudRefs.p1StateBadge.current.textContent = label;
      }

      // P1 Combo Counter
      if (hudRefs.p1ComboBox.current && hudRefs.p1ComboHits.current && hudRefs.p1ComboDmg.current) {
        if (sim.p1.comboCount >= 2) {
          hudRefs.p1ComboBox.current.style.opacity = '1';
          hudRefs.p1ComboHits.current.textContent = `${sim.p1.comboCount} HIT COMBO`;
          hudRefs.p1ComboDmg.current.textContent = `${sim.p1.comboDamage} DMG`;
        } else {
          hudRefs.p1ComboBox.current.style.opacity = '0';
        }
      }

      if (hudRefs.p2HpFill.current) {
        const pct = Math.max(0, Math.min(100, (sim.p2.hp / sim.p2.maxHp) * 100));
        hudRefs.p2HpFill.current.style.width = `${pct}%`;
      }
      if (hudRefs.p2HpGhost.current) {
        const pct = Math.max(0, Math.min(100, (sim.p2.ghostHp / sim.p2.maxHp) * 100));
        hudRefs.p2HpGhost.current.style.width = `${pct}%`;
      }
      if (hudRefs.p2HpText.current) {
        hudRefs.p2HpText.current.textContent = `${Math.ceil(sim.p2.hp)}`;
      }
      if (hudRefs.p2StaminaFill.current) {
        const pct = Math.max(0, Math.min(100, (sim.p2.stamina / sim.p2.maxStamina) * 100));
        hudRefs.p2StaminaFill.current.style.width = `${pct}%`;
      }
      if (hudRefs.p2StaminaText.current) {
        hudRefs.p2StaminaText.current.textContent = `${Math.round(sim.p2.stamina)}`;
      }
      if (hudRefs.p2StateBadge.current) {
        hudRefs.p2StateBadge.current.textContent = sim.p2.actionState.replace('_', ' ');
      }
      if (hudRefs.p2ComboBox.current && hudRefs.p2ComboHits.current && hudRefs.p2ComboDmg.current) {
        if (sim.p2.comboCount >= 2) {
          hudRefs.p2ComboBox.current.style.opacity = '1';
          hudRefs.p2ComboHits.current.textContent = `${sim.p2.comboCount} HIT COMBO`;
          hudRefs.p2ComboDmg.current.textContent = `${sim.p2.comboDamage} DMG`;
        } else {
          hudRefs.p2ComboBox.current.style.opacity = '0';
        }
      }
      if (hudRefs.aiStateBadge.current) {
        hudRefs.aiStateBadge.current.textContent = botController.currentState.replace('_', ' ');
      }
      if (hudRefs.timerText.current) {
        hudRefs.timerText.current.textContent =
          props.gameMode === 'training' ? '∞' : `${Math.ceil(sim.roundTimer)}`;
      }

      // Project 3D Lock-On Reticle over targeted opponent
      if (hudRefs.lockReticle.current) {
        if (props.screenState === 'combat' && props.lockedOn) {
          const tx = sim.p2.decoy.active ? sim.p2.decoy.x : sim.p2.x;
          const tz = sim.p2.decoy.active ? sim.p2.decoy.z : sim.p2.z;
          _projVec.set(tx, 1.25, tz).project(camera);
          if (_projVec.z < 1) {
            const sx = (_projVec.x * 0.5 + 0.5) * window.innerWidth;
            const sy = (-_projVec.y * 0.5 + 0.5) * window.innerHeight;
            hudRefs.lockReticle.current.style.opacity = '0.9';
            hudRefs.lockReticle.current.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%)`;
          } else {
            hudRefs.lockReticle.current.style.opacity = '0';
          }
        } else {
          hudRefs.lockReticle.current.style.opacity = '0';
        }
      }
    };

    animFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', clearInputs);
      window.removeEventListener('resize', updateCameraAspectAndFov);
      window.removeEventListener('orientationchange', updateCameraAspectAndFov);
      arenaRig?.dispose();
      particleSystem.dispose();
      materials.dispose();
      envTexture?.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      data-testid="fracture-webgl-viewport"
      className="fixed inset-0 w-full h-full z-0 bg-[#0d0e11]"
    />
  );
};
