import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {
  FOOTSTEP_SOUND_MANIFEST,
  type FootstepCategory,
  soundEngine,
} from '../audio/soundEngine.ts';
import {
  buildDetailedWeaponViewModel,
  setWeaponRigOpticAttachment,
} from './weaponVisuals3D.ts';
import {
  CORE_SELECTABLE_OPTICS,
  OPTIC_REGISTRY,
  WEAPON_ADS_PROFILES,
  computeAimSensitivityMultiplier,
  computeComposedCameraFOV,
  computeReticleRenderState,
  computeScopeViewState,
  computeWeaponADSPose,
  createInitialADSControllerState,
  cycleWeaponOptic,
  getTargetADSFov,
  isOpticCompatibleWithWeapon,
  resolveEquippedOptic,
  stepADSController,
} from './ads/index.ts';
import {
  addItemToBackpack,
  computeEffectiveWeaponStats,
  computeInventoryCapacity,
  deserializeInventoryState,
  dropInventoryItemToWorld,
  equipAttachmentFromBackpackSlot,
  equipWeaponFromStorage,
  executeInventoryDragDrop,
  findWeaponInstanceForWeaponId,
  getNearbyWorldLoot,
  isAttachmentCompatibleWithWeapon,
  moveBackpackSlotToSlot,
  moveWeaponSlotToStorage,
  pickupWorldLootItem,
  removeAttachmentFromWeapon,
  serializeInventoryState,
  splitBackpackStack,
  swapEquippedWeaponSlots,
  useOrEquipBackpackSlotItem,
  validateInventoryDropTarget,
} from './inventory/index.ts';
import {
  WEAPON_HOLD_PROFILES,
  buildChameleonHumanoidRig,
  buildCompactHandheldWeaponProp,
  updateChameleonRigAnimation,
} from './chameleonCharacter3D.ts';
import {
  ARENA_REGISTRY,
  DEATHMATCH_DURATION_SECONDS,
  DEFAULT_HUD_BUTTONS_LAYOUT,
  DEFAULT_SETTINGS,
  HUD_BUTTON_INFO,
  HUD_LAYOUT_PRESETS,
  type HudButtonId,
  LOADOUT_PAIRS,
  WEAPON_ORDER,
  WEAPON_REGISTRY,
} from './config.ts';
import {
  BODY_REGION_ORDER,
  BODY_REGION_SPECS,
  CHARACTER_ORDER,
  CHARACTER_ROSTER,
  PARTY_SIZE_LIMITS,
  canAddPartyMember,
  enforcePartySizeLimit,
  findBodyRegionAtUV,
  getSymmetryMirroredUV,
  isDesignCompatibleWithCharacter,
  mapLocalUvToRegionAtlas,
} from './characterSystem.ts';
import {
  DEFAULT_BRUSH_SETTINGS,
  PAINT_ATLAS_SIZE,
  SORTED_COLOR_PALETTES,
  applyBrushDabToLayer,
  applyBrushStrokeSegment,
  applyBucketFillToLayer,
  applyGeometricShapeToLayer,
  applyGradientFillToLayer,
  buildEnemyFactionPaintBuffer,
  compositePaintLayersToBuffer,
  createEmptyLayer,
  decodeRgbaBufferRLE,
  encodeRgbaBufferRLE,
  generateShadingTonesForHex,
  hexToRgb,
  paintStorage,
  sampleColorAtUV,
} from './paintSystem.ts';
import {
  PLAYER_COLLISION_RADIUS,
  type PlayerInputSnapshot,
  WEAPON_IMPACT_PROFILES,
  WEAPON_MASS_SWAY_PROFILES,
  computeBallisticImpactMarkPose,
  computeDynamicCrosshairState,
  computeWeaponWallObstruction,
  createSimulationState,
  createWeaponSwayPhysicsState,
  getMatchLeaderboard,
  getScopeSensitivityMultiplier,
  getSurfaceMaterialAt,
  handleWeaponSlotClick,
  hasClearLineOfSight,
  resolveEntityCollisions,
  setPlayerLoadoutPair,
  stepSimulation,
  stepWeaponSwayPhysics,
  switchPlayerWeapon,
} from './rules.ts';
import { BulletImpactSystem } from './impact/BulletImpactSystem.ts';
import {
  createSeededRandom,
  deriveImpactSeed,
  generateProceduralMarkDescriptor,
  solveImpactAngle,
} from './impact/ImpactAngleSolver.ts';
import {
  IMPACT_MATERIAL_PROFILES,
  IMPACT_QUALITY_PROFILES,
  classifyArenaHitMaterial,
} from './impact/ImpactMaterialProfiles.ts';
import type { ImpactMaterialType } from './impact/impact.types.ts';

function createNeutralInput(
  overrides: Partial<PlayerInputSnapshot> = {}
): PlayerInputSnapshot {
  return {
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
    ...overrides,
  };
}

describe('FRACTURE Tactical First-Person Shooter Rules & Arsenal', () => {
  it('initializes player with a 5-minute (300s) Deathmatch timer, 2-gun loadout pair, and 140m x 140m compound', () => {
    const sim = createSimulationState('volt', 'rift', 'foundry_arena');
    assert.equal(DEATHMATCH_DURATION_SECONDS, 300);
    assert.equal(sim.roundTimerSec, 300);
    assert.equal(LOADOUT_PAIRS.length, 3);
    for (const pair of LOADOUT_PAIRS) {
      assert.equal(pair.weapons.length, 2);
    }
    assert.deepEqual(sim.player.loadoutWeapons, ['m4a1', 'awp']);

    for (const wid of WEAPON_ORDER) {
      const spec = WEAPON_REGISTRY[wid];
      assert.ok(spec, `Weapon spec ${wid} should exist`);
      assert.equal(sim.player.weapons[wid].mag, spec.magSize);
      assert.equal(sim.player.weapons[wid].reserve, spec.reserveMax);
    }

    const arena = ARENA_REGISTRY[sim.arenaId];
    assert.ok(arena.bounds.maxX - arena.bounds.minX >= 130);
    assert.ok(arena.bounds.maxZ - arena.bounds.minZ >= 130);
    assert.ok(arena.blocks.length >= 20);
  });

  it('switches between the 2 loadout guns and reloads when clicking the gun already in hand', () => {
    const sim = createSimulationState();
    setPlayerLoadoutPair(sim.player, ['ak47', 'spas12']);
    assert.deepEqual(sim.player.loadoutWeapons, ['ak47', 'spas12']);
    assert.equal(sim.player.activeWeapon, 'ak47');

    // Clicking the other gun in the pair switches to it
    const switchRes = handleWeaponSlotClick(sim.player, 'spas12');
    assert.equal(switchRes, 'switched');
    assert.equal(sim.player.activeWeapon, 'spas12');

    // Fire 1 shell so magazine is no longer full
    sim.player.weaponSwitchTimerMs = 0;
    sim.player.fireCooldownMs = 0;
    stepSimulation(sim, 0.016, createNeutralInput({ fireJustPressed: true }));
    assert.equal(sim.player.weapons.spas12.mag, WEAPON_REGISTRY.spas12.magSize - 1);

    // Clicking the ALREADY active gun in hand triggers a reload!
    const reloadRes = handleWeaponSlotClick(sim.player, 'spas12');
    assert.equal(reloadRes, 'reloaded');
    assert.equal(sim.player.isReloading, true);

    // Advance past reload time
    for (let i = 0; i < 50; i++) {
      stepSimulation(sim, 0.05, createNeutralInput());
    }
    assert.equal(sim.player.isReloading, false);
    assert.equal(sim.player.weapons.spas12.mag, WEAPON_REGISTRY.spas12.magSize);
  });

  it('slides in joystick direction when moving, and slides forward when joystick is neutral', () => {
    const sim = createSimulationState();
    sim.player.x = 0;
    sim.player.z = 20;
    sim.player.yaw = 0; // Facing North (-Z)

    // 1. Press Slide WITHOUT moving joystick -> should slide forward (-Z)
    const evtsForward = stepSimulation(
      sim,
      0.016,
      createNeutralInput({ slidePressed: true, moveX: 0, moveZ: 0 })
    );
    assert.equal(sim.player.isSliding, true);
    assert.ok(evtsForward.some((e) => e.type === 'slide_start'));
    assert.ok(sim.player.slideDirZ < -0.9, 'Should slide forward (-Z) when joystick is idle');

    // Wait for slide and cooldown to finish
    for (let i = 0; i < 30; i++) {
      stepSimulation(sim, 0.05, createNeutralInput());
    }
    assert.equal(sim.player.isSliding, false);
    sim.player.slideCooldownMs = 0;

    // 2. Press Slide WHILE holding joystick right (moveX = 1) -> should slide right (+X)
    stepSimulation(
      sim,
      0.016,
      createNeutralInput({ slidePressed: true, moveX: 1, moveZ: 0 })
    );
    assert.equal(sim.player.isSliding, true);
    assert.ok(sim.player.slideDirX > 0.9, 'Should slide right (+X) when joystick is pushed right');
  });

  it('respawns player on death during 5-minute Deathmatch and crowns kill leader on timer expiry', () => {
    const sim = createSimulationState();
    assert.equal(sim.roundTimerSec, 300);

    // Place a bot right in front of player with clear LOS and let it deal fatal damage
    sim.player.x = 4;
    sim.player.z = 16;
    sim.player.hp = 5;
    const bot = sim.enemies[0];
    bot.x = 4;
    bot.z = 10;
    bot.state = 'attack';
    bot.fireCooldownMs = 0;

    let respawned = false;
    for (let i = 0; i < 12 && !respawned; i++) {
      bot.fireCooldownMs = 0;
      const events = stepSimulation(sim, 0.016, createNeutralInput(), 'hard', false);
      if (events.some((e) => e.type === 'player_respawn')) {
        respawned = true;
      }
    }
    assert.equal(respawned, true, 'Player should respawn after taking fatal bot fire');
    assert.equal(sim.roundOver, false, 'Deathmatch must continue for full 5 minutes on player death');
    assert.equal(sim.player.hp, 100, 'Player HP should restore to 100 on respawn');
    assert.equal(sim.player.deaths, 1);

    // Give player 14 kills and expire the 5-minute timer
    sim.player.kills = 14;
    sim.enemies[0].kills = 9;
    sim.roundTimerSec = 0.01;
    stepSimulation(sim, 0.05, createNeutralInput(), 'normal', false);

    assert.equal(sim.roundOver, true);
    assert.equal(sim.matchOver, true);
    assert.equal(sim.roundWinner, 'p1');
    const board = getMatchLeaderboard(sim);
    assert.equal(board[0].isPlayer, true);
    assert.equal(board[0].kills, 14);
  });

  it('registers body hits and precision headshots via 3D hitscan raycast', () => {
    const sim = createSimulationState();
    sim.player.x = 4;
    sim.player.y = 0;
    sim.player.z = 16;
    sim.player.yaw = 0;
    sim.player.pitch = -0.075; // Aim at chest height (~0.93m)

    const target = sim.enemies[0];
    target.x = 4;
    target.y = 0;
    target.z = 6;
    target.hp = 100;

    const eventsBody = stepSimulation(
      sim,
      0.016,
      createNeutralInput({ fireJustPressed: true, adsHeld: true })
    );
    assert.ok(eventsBody.some((e) => e.type === 'hit_body'));
    const bodyDmg = 100 - target.hp;
    assert.equal(bodyDmg, WEAPON_REGISTRY.m4a1.damage);

    // Now aim directly at head sphere (enemy.y + 1.56 vs player eye 1.68 -> pitch ~ -0.012)
    target.hp = 100;
    sim.player.fireCooldownMs = 0;
    sim.player.recoilKickPitch = 0;
    sim.player.pitch = -0.012;

    const eventsHead = stepSimulation(
      sim,
      0.016,
      createNeutralInput({ fireJustPressed: true, adsHeld: true })
    );
    assert.ok(eventsHead.some((e) => e.type === 'headshot'));
    const headDmg = 100 - target.hp;
    assert.ok(headDmg > bodyDmg, `Headshot (${headDmg}) should exceed body damage (${bodyDmg})`);
  });

  it('blocks shots when a solid building or cover wall sits between player and enemy', () => {
    const sim = createSimulationState();
    sim.player.x = 0;
    sim.player.y = 0;
    sim.player.z = 12;
    sim.player.isCrouching = true;
    sim.player.eyeHeight = 0.9; // Crouched behind 1.3m cover wall
    sim.player.yaw = 0;
    sim.player.pitch = 0;

    const target = sim.enemies[0];
    target.x = 0;
    target.y = 0;
    target.z = 2; // On the other side of cov_c2
    target.hp = 100;

    stepSimulation(
      sim,
      0.016,
      createNeutralInput({ fireJustPressed: true, adsHeld: true, crouchHeld: true })
    );
    assert.equal(target.hp, 100, 'Cover wall must block crouched shot');
  });

  it('prevents enemy bots from seeing or firing through solid walls and cover barriers', () => {
    const sim = createSimulationState();
    const arena = ARENA_REGISTRY[sim.arenaId];

    sim.player.x = -19;
    sim.player.y = 0;
    sim.player.z = 12;
    sim.player.hp = 100;

    for (const bot of sim.enemies) {
      bot.x = -9;
      bot.y = 0;
      bot.z = 12;
      bot.fireCooldownMs = 0;
    }

    const losThroughWall = hasClearLineOfSight(
      -9,
      0,
      12,
      sim.player.x,
      sim.player.y,
      sim.player.z,
      sim.player.eyeHeight,
      arena,
      sim.breakableProps
    );
    assert.equal(losThroughWall, false, 'Wall must block bot line-of-sight');

    const events = stepSimulation(sim, 0.016, createNeutralInput(), 'hard', false);
    assert.equal(
      events.some((e) => e.type === 'player_hurt'),
      false,
      'Enemy must never damage player through a wall'
    );
    assert.equal(sim.player.hp, 100);

    const losOverCover = hasClearLineOfSight(
      0,
      0,
      2,
      0,
      0,
      11,
      1.68,
      arena,
      sim.breakableProps
    );
    assert.equal(
      losOverCover,
      false,
      'Low 1.3m cover barrier must block bot chest/torso firing sightline'
    );
  });

  it('detonates explosive barrels when shot and damages nearby enemies', () => {
    const sim = createSimulationState();
    const barrel = sim.breakableProps.find((p) => p.kind === 'barrel')!;
    assert.ok(barrel);

    sim.player.x = barrel.x;
    sim.player.y = 0;
    sim.player.z = barrel.z + 6;
    sim.player.yaw = 0;
    sim.player.pitch = -0.14;
    sim.player.activeWeapon = 'awp';

    const target = sim.enemies[0];
    target.x = barrel.x + 1.5;
    target.z = barrel.z;
    target.hp = 100;

    const events = stepSimulation(
      sim,
      0.016,
      createNeutralInput({ fireJustPressed: true, adsHeld: true })
    );
    assert.equal(barrel.broken, true);
    assert.ok(events.some((e) => e.type === 'barrel_explode'));
    assert.ok(target.hp < 100, 'Nearby enemy should take explosive barrel damage');
  });

  it('supports all 10 customizable HUD controls (offsetX, offsetY, scale, opacity)', () => {
    const expectedIds: HudButtonId[] = [
      'joystick',
      'fire',
      'ads',
      'reload',
      'jump',
      'crouch',
      'slide',
      'weaponBar',
      'healthBar',
      'killCounter',
    ];

    for (const id of expectedIds) {
      const def = DEFAULT_HUD_BUTTONS_LAYOUT[id];
      assert.ok(def, `Default layout missing for ${id}`);
      assert.equal(def.offsetX, 0);
      assert.equal(def.offsetY, 0);
      assert.ok(def.scale >= 0.5 && def.scale <= 1.7);
      assert.ok(def.opacity >= 0.2 && def.opacity <= 1.0);
      assert.ok(HUD_BUTTON_INFO[id].label.length > 0);
    }

    assert.ok(HUD_LAYOUT_PRESETS.claw.layout.fire.offsetY < 0);
    assert.equal(DEFAULT_SETTINGS.autoFullscreenLandscape, true);
  });

  it('simultaneously rotates camera yaw/pitch and fires bullets when dragging the Fire button', () => {
    const sim = createSimulationState();
    const initialYaw = sim.player.yaw;
    const initialPitch = sim.player.pitch;

    stepSimulation(
      sim,
      0.016,
      createNeutralInput({
        fireHeld: true,
        fireJustPressed: true,
        lookDeltaYaw: 0.35,
        lookDeltaPitch: 0.12,
      })
    );

    assert.ok(
      Math.abs(sim.player.yaw - (initialYaw - 0.35)) < 0.05,
      'Player camera yaw should rotate while firing'
    );
    assert.ok(
      sim.player.pitch < initialPitch,
      'Player camera pitch should update while firing'
    );
    assert.ok(sim.traces.length > 0, 'Bullet trace should be emitted while dragging fire button');
    assert.equal(sim.traces[0].weaponId, 'm4a1');
  });

  it('tracks previousWeapon during smooth weapon swap and flags awaitingRespawn on death', () => {
    const sim = createSimulationState();
    assert.equal(sim.player.activeWeapon, 'm4a1');
    const switched = switchPlayerWeapon(sim.player, 'awp');
    assert.equal(switched, true);
    assert.equal(sim.player.previousWeapon, 'm4a1');
    assert.equal(sim.player.activeWeapon, 'awp');
    assert.equal(sim.player.weaponSwitchTimerMs, 340);
    assert.equal(sim.player.weaponSwitchDurationMs, 340);
  });

  it('emits dynamic footstep events that vary by surface material (concrete vs metal) in both Training and Arena modes', () => {
    const sim = createSimulationState('volt', 'rift', 'foundry_arena');

    // 1. Spawn at (0, 20) is on concrete
    sim.player.x = 0;
    sim.player.z = 20;
    let concreteSteps = 0;
    for (let i = 0; i < 15; i++) {
      const evts = stepSimulation(
        sim,
        0.04,
        createNeutralInput({ moveX: 1, moveZ: 0 }),
        'normal',
        false
      );
      for (const e of evts) {
        if (e.type === 'footstep') {
          assert.equal(e.surface, 'concrete');
          concreteSteps += 1;
        }
      }
    }
    assert.ok(concreteSteps >= 1, 'Walking on concrete courtyard must emit concrete footstep events');
    assert.equal(sim.player.currentSurface, 'concrete');

    // 2. Move onto South Firing Line / Central Steel Deck (z = 13, x = 0) in Training mode -> metal footsteps
    sim.player.x = 0;
    sim.player.z = 13;
    sim.player.vx = 0;
    sim.player.vz = 0;
    let metalSteps = 0;
    for (let i = 0; i < 15; i++) {
      const evts = stepSimulation(
        sim,
        0.04,
        createNeutralInput({ moveX: 1, moveZ: 0, sprintHeld: true }),
        'normal',
        true
      );
      for (const e of evts) {
        if (e.type === 'footstep') {
          assert.equal(e.surface, 'metal');
          metalSteps += 1;
        }
      }
    }
    assert.ok(metalSteps >= 1, 'Walking on steel grating deck in Training mode must emit metal footstep events');
    assert.equal(sim.player.currentSurface, 'metal');
  });

  it('scales scope sensitivity multiplier inversely with scope magnification', () => {
    // Hipfire (adsBlend = 0) should always be 1.0
    assert.equal(getScopeSensitivityMultiplier('awp', 0), 1.0);
    assert.equal(getScopeSensitivityMultiplier('m4a1', 0), 1.0);

    // Full ADS (adsBlend = 1) lowers sensitivity according to equipped optic magnification
    const awpSens = getScopeSensitivityMultiplier('awp', 1); // Default 4.0x scope (0.35)
    const m4Sens = getScopeSensitivityMultiplier('m4a1', 1); // Default 2.0x scope (0.50)
    const akSens = getScopeSensitivityMultiplier('ak47', 1); // Default Iron Sights (0.70)
    const mp5Sens = getScopeSensitivityMultiplier('mp5', 1); // Default Iron Sights (0.70)
    const deagleSens = getScopeSensitivityMultiplier('deagle', 1); // Default Iron Sights (0.70)
    const spasSens = getScopeSensitivityMultiplier('spas12', 1); // Default Iron Sights (0.70)

    assert.ok(awpSens < m4Sens, 'AWP 4x scope must have lower sensitivity than M4A1 2x scope');
    assert.ok(m4Sens < akSens, 'M4A1 2x scope must have lower sensitivity than AK-47 iron sights');
    assert.equal(akSens, 0.70);
    assert.equal(mp5Sens, 0.70);
    assert.equal(deagleSens, 0.70);
    assert.equal(spasSens, 0.70);

    // Explicit optic overrides scale inversely with magnification across any weapon
    assert.ok(
      getScopeSensitivityMultiplier('ak47', 1, 'scope_4x') <
        getScopeSensitivityMultiplier('ak47', 1, 'scope_2x') &&
        getScopeSensitivityMultiplier('ak47', 1, 'scope_2x') <
          getScopeSensitivityMultiplier('ak47', 1, 'none'),
      'Higher magnification optics must reduce sensitivity further than lower magnification or iron sights',
    );

    // Halfway ADS transition should smoothly interpolate between 1.0 and full-scope multiplier
    const halfAwp = getScopeSensitivityMultiplier('awp', 0.5);
    assert.ok(halfAwp < 1.0 && halfAwp > awpSens);
  });

  it('prevents character and weapon from clipping into walls and computes smooth 3D weapon wall obstruction', () => {
    const sim = createSimulationState();
    const arena = ARENA_REGISTRY[sim.arenaId];

    // 1. Out in the open south courtyard (0, 20), weapon has zero wall obstruction
    const clearObs = computeWeaponWallObstruction(sim.player, arena, sim.breakableProps);
    assert.equal(clearObs.obstruction, 0);

    // 2. Walk player directly into the West Hangar South wall (hangar_w_s: x = -14, z = 12, width = 3.2 -> maxX = -12.4)
    sim.player.x = -12.0;
    sim.player.z = 12.0;
    sim.player.yaw = Math.PI / 2; // Facing West (-X) directly into the hangar wall
    sim.player.pitch = 0;

    // Sprint forward into the wall for 20 steps
    for (let i = 0; i < 20; i++) {
      stepSimulation(
        sim,
        0.025,
        createNeutralInput({ moveZ: -1, sprintHeld: true }),
        'normal',
        true
      );
    }

    // Character body must stop outside the wall at x >= -12.4 + PLAYER_COLLISION_RADIUS
    const wallEastFaceX = -14 + 3.2 * 0.5; // -12.4
    assert.ok(
      sim.player.x >= wallEastFaceX + PLAYER_COLLISION_RADIUS - 0.001,
      `Character x (${sim.player.x}) must never clip inside wall face (${wallEastFaceX + PLAYER_COLLISION_RADIUS})`
    );

    // Weapon barrel facing the wall at close contact must register positive obstruction to retract/brace the gun
    assert.ok(
      sim.player.wallObstruction > 0.35,
      `Weapon wallObstruction (${sim.player.wallObstruction}) must engage when facing a wall at close contact`
    );

    // 3. Configure increased responsive 135% default firing sensitivity separate from camera sensitivity
    assert.equal(DEFAULT_SETTINGS.fireSensitivity, 1.35);

    // 4. Verify weapon stays on the character's anatomical RIGHT side (-X in torsoPivot space) while running/sprinting
    // and retracts backward + pitches upward into High-Port when wallObstruction = 1.0
    const rig = buildChameleonHumanoidRig('volt', 1);
    for (let s = 0; s < 10; s++) {
      updateChameleonRigAnimation(
        rig,
        'combat',
        1.0 + s * 0.016,
        7.8,
        s * 0.3,
        false,
        0,
        -1,
        false,
        0,
        0,
        'm4a1',
        0,
        0,
        1.0, // sprintBlend = 1.0
        0,
        0,
        { wallObstruction: 0 }
      );
    }
    const sprintRightX = rig.weaponMount.position.x;
    const clearWallZ = rig.weaponMount.position.z;
    const clearWallRotX = rig.weaponMount.rotation.x;
    assert.ok(
      sprintRightX < -0.18,
      `Weapon mount X (${sprintRightX}) must stay firmly on the character's right side (-X < -0.18) while running/sprinting`
    );

    for (let s = 0; s < 10; s++) {
      updateChameleonRigAnimation(
        rig,
        'combat',
        2.0 + s * 0.016,
        0,
        0,
        false,
        0,
        0,
        false,
        0,
        0,
        'm4a1',
        0,
        0,
        0,
        0,
        0,
        { wallObstruction: 1.0, wallBumpWave: 0.02 }
      );
    }
    assert.ok(
      rig.weaponMount.position.z < clearWallZ - 0.035 &&
        rig.weaponMount.position.z > 0.34,
      `Weapon mount Z (${rig.weaponMount.position.z}) must retract axially while staying strictly in front of the character chest (${clearWallZ})`
    );
    assert.ok(
      Math.abs(rig.weaponMount.rotation.x) < 0.22,
      `Weapon mount rotation.x (${rig.weaponMount.rotation.x}) must stay level and pointed forward (never pitching skyward into High-Port)`
    );

    // 5. Verify standing right behind a low cover wall (cov_c2: x=0, z=6.5, height=1.3m) does NOT obstruct or tilt the barrel
    sim.player.x = 0;
    sim.player.z = 7.45;
    sim.player.yaw = 0; // Facing North (-Z) directly over the 1.3m cover wall
    sim.player.pitch = 0;
    const lowCoverObs = computeWeaponWallObstruction(sim.player, arena, sim.breakableProps);
    assert.equal(
      lowCoverObs.obstruction,
      0,
      `Standing behind a 1.3m low cover wall must have 0 barrel obstruction so the player can shoot straight over cover`
    );
    rig.dispose();
  });

  it('loads all uploaded /footsteps/*.ogg audio files without missing assets', () => {
    assert.equal(FOOTSTEP_SOUND_MANIFEST.concrete.length, 9);
    assert.equal(FOOTSTEP_SOUND_MANIFEST.concrete[0], '/footsteps/boots/0.ogg');
    assert.equal(FOOTSTEP_SOUND_MANIFEST.metal.length, 8);
    assert.equal(FOOTSTEP_SOUND_MANIFEST.metal[0], '/footsteps/metal/0.ogg');

    const categories = Object.keys(FOOTSTEP_SOUND_MANIFEST) as FootstepCategory[];
    assert.equal(categories.length, 10);

    for (const cat of categories) {
      const urls = FOOTSTEP_SOUND_MANIFEST[cat];
      assert.ok(urls.length >= 1, `Category ${cat} must have at least 1 OGG file`);
      for (const relUrl of urls) {
        const diskPath = path.join(process.cwd(), relUrl);
        assert.ok(fs.existsSync(diskPath), `Uploaded footstep file must exist at ${diskPath}`);
        const stat = fs.statSync(diskPath);
        assert.ok(stat.size > 100, `Uploaded footstep file ${diskPath} must not be empty`);
      }

      // Verify Fisher-Yates randomized shuffle bag uses EVERY single variation (0..N-1) without back-to-back repeats
      if (urls.length > 1) {
        const firstBag = new Set<number>();
        let prevIdx = -1;
        for (let step = 0; step < urls.length; step++) {
          const idx = soundEngine.nextShuffledSampleIndex(cat);
          assert.ok(idx >= 0 && idx < urls.length, `Sample index ${idx} out of bounds for ${cat}`);
          assert.notEqual(idx, prevIdx, `Category ${cat} must not repeat sample ${idx} back-to-back`);
          firstBag.add(idx);
          prevIdx = idx;
        }
        assert.equal(
          firstBag.size,
          urls.length,
          `Category ${cat} must play all ${urls.length} uploaded OGG files in a full cycle`
        );

        // Next cycle's first sample must also not repeat the last sample of the previous cycle
        const nextCycleFirst = soundEngine.nextShuffledSampleIndex(cat);
        assert.notEqual(
          nextCycleFirst,
          prevIdx,
          `Category ${cat} must not repeat sample across shuffle bag boundary`
        );
      }
    }

    // Verify all 7 arena floor surface materials are active in the compound zones
    assert.equal(getSurfaceMaterialAt(0, 20), 'concrete');
    assert.equal(getSurfaceMaterialAt(0, 13), 'metal');
    assert.equal(getSurfaceMaterialAt(-20, 0), 'tile');
    assert.equal(getSurfaceMaterialAt(-40, 0), 'gravel');
    assert.equal(getSurfaceMaterialAt(0, -18), 'wood');
    assert.equal(getSurfaceMaterialAt(0, -58), 'grass');
    assert.equal(getSurfaceMaterialAt(-36, 30), 'water');

    // Verify walkBobPhase is phase-locked 1:1 with footstepCount * Math.PI when footsteps fire
    const sim = createSimulationState();
    sim.player.x = 0;
    sim.player.z = 20;
    let verifiedSyncSteps = 0;
    for (let i = 0; i < 40; i++) {
      const evts = stepSimulation(
        sim,
        0.02,
        createNeutralInput({ moveX: 1, moveZ: 0, sprintHeld: true }),
        'normal',
        true
      );
      if (evts.some((e) => e.type === 'footstep')) {
        verifiedSyncSteps += 1;
        const expectedMinPhase = sim.player.footstepCount * Math.PI;
        assert.ok(
          sim.player.walkBobPhase >= expectedMinPhase &&
            sim.player.walkBobPhase < expectedMinPhase + Math.PI * 0.35,
          `walkBobPhase (${sim.player.walkBobPhase}) must align with footstepCount * PI (${expectedMinPhase}) on step impact`
        );
      }
    }
    assert.ok(verifiedSyncSteps >= 2, 'Must verify at least 2 synchronized footstep phases');
  });

  it('scales gunshot marks uniquely across all 6 weapons, elongates 360° side-angle grazing hits, and clamps strictly inside wall edges', () => {
    const arena = ARENA_REGISTRY.foundry_arena;

    // 1. Every weapon has a distinct ballistic impact profile scaled by weapon power
    const mp5P = WEAPON_IMPACT_PROFILES.mp5;
    const m4P = WEAPON_IMPACT_PROFILES.m4a1;
    const akP = WEAPON_IMPACT_PROFILES.ak47;
    const deagleP = WEAPON_IMPACT_PROFILES.deagle;
    const spasP = WEAPON_IMPACT_PROFILES.spas12;
    const awpP = WEAPON_IMPACT_PROFILES.awp;

    assert.ok(mp5P.baseDiameter < m4P.baseDiameter, 'MP5 9mm crater must be smaller than M4A1 5.56mm');
    assert.ok(m4P.baseDiameter < akP.baseDiameter, 'M4A1 5.56mm crater must be smaller than AK-47 7.62mm');
    assert.ok(akP.baseDiameter < deagleP.baseDiameter, 'AK-47 crater must be smaller than Deagle .50 AE');
    assert.ok(deagleP.baseDiameter < awpP.baseDiameter, 'Deagle crater must be smaller than AWP .338 Lapua');
    assert.ok(spasP.craterDepthFactor > mp5P.craterDepthFactor, 'SPAS-12 buckshot gouge depth must exceed MP5');
    assert.ok(awpP.crackCount > akP.crackCount && akP.crackCount > m4P.crackCount && m4P.crackCount > mp5P.crackCount);

    // 2. Hit South face of cov_c2 (x: 0, z: 6.5, width: 6.5, height: 1.3, depth: 1.2 -> South face at z = 7.1, normal = (0, 0, 1))
    // Straight-on perpendicular shot (0 degrees incidence) vs sharp side-angle shot (~75 degrees incidence)
    const hitZ = 6.5 + 1.2 * 0.5; // 7.1
    const perpPoseM4 = computeBallisticImpactMarkPose(
      0,
      0.65,
      14,
      0,
      0.65,
      hitZ,
      0,
      0,
      1,
      'm4a1',
      arena
    );
    const perpPoseAwp = computeBallisticImpactMarkPose(
      0,
      0.65,
      14,
      0,
      0.65,
      hitZ,
      0,
      0,
      1,
      'awp',
      arena
    );
    assert.equal(perpPoseM4.validSurface, true);
    assert.equal(perpPoseAwp.validSurface, true);
    assert.ok(perpPoseAwp.scaleB > perpPoseM4.scaleB, 'AWP impact mark width must exceed M4A1 on same wall');
    assert.ok(
      Math.abs(perpPoseM4.scaleT - perpPoseM4.scaleB) < 0.02,
      'Straight-on shot should produce a near-circular impact crater'
    );

    // Side-angle (tircha) grazing shot from far left-front (-18, 1.1, 8.5) hitting (0, 0.65, 7.1)
    const sidePoseAk = computeBallisticImpactMarkPose(
      -18,
      1.1,
      8.5,
      0,
      0.65,
      hitZ,
      0,
      0,
      1,
      'ak47',
      arena
    );
    assert.equal(sidePoseAk.validSurface, true);
    assert.ok(
      sidePoseAk.scaleT > sidePoseAk.scaleB * 1.45,
      `Side-angle grazing shot must stretch into an oblique oval gouge (scaleT=${sidePoseAk.scaleT} vs scaleB=${sidePoseAk.scaleB})`
    );
    // Tangent vector must point along the bullet's horizontal-downward sweep (+X, -Y) across the wall face
    assert.ok(sidePoseAk.tx > 0.85, 'Tangent X must align with left-to-right bullet travel');
    assert.ok(sidePoseAk.reflectX > 0.7, 'Ricochet sparks must deflect forward along grazing direction');

    // 3. Strict wall-edge clamping: hit right at the top-right corner of cov_c2 (maxX = 3.25, maxY = 1.3)
    const cornerPoseAwp = computeBallisticImpactMarkPose(
      -10,
      1.6,
      8.8,
      3.24,
      1.29,
      hitZ,
      0,
      0,
      1,
      'awp',
      arena
    );
    assert.equal(cornerPoseAwp.validSurface, true);
    const halfSpanX =
      0.5 *
      (Math.abs(cornerPoseAwp.tx) * cornerPoseAwp.scaleT +
        Math.abs(cornerPoseAwp.bx) * cornerPoseAwp.scaleB);
    const halfSpanY =
      0.5 *
      (Math.abs(cornerPoseAwp.ty) * cornerPoseAwp.scaleT +
        Math.abs(cornerPoseAwp.by) * cornerPoseAwp.scaleB);

    assert.ok(
      cornerPoseAwp.x + halfSpanX <= 3.25 + 0.001,
      `Decal right edge (${cornerPoseAwp.x + halfSpanX}) must never poke out into air past wall maxX (3.25)`
    );
    assert.ok(
      cornerPoseAwp.y + halfSpanY <= 1.3 + 0.001,
      `Decal top edge (${cornerPoseAwp.y + halfSpanY}) must never poke out into air past wall height (1.3)`
    );

    // 4. Mid-air coordinate far from any wall or floor must be rejected (validSurface = false)
    const airPose = computeBallisticImpactMarkPose(
      0,
      1.68,
      20,
      0,
      4.5,
      15,
      0,
      0,
      1,
      'ak47',
      arena
    );
    assert.equal(airPose.validSurface, false, 'Mid-air point must never spawn a floating gunshot decal');
  });

  it('defines pure-white humanoid roster, 15 non-overlapping UV islands, and bilateral symmetry', () => {
    assert.equal(CHARACTER_ORDER.length, 4);
    for (const cid of CHARACTER_ORDER) {
      const def = CHARACTER_ROSTER[cid];
      assert.equal(def.baseWhiteHex, 0xffffff, `Character ${cid} must default to pure white (#ffffff)`);
      assert.equal(def.defaultEquipment.length, 0, `Character ${cid} must start with no bulky default equipment`);
      assert.equal(def.uvLayoutId, 'chameleon_humanoid_v1');
      assert.equal(def.supportedRegions.length, 15);
      assert.equal(isDesignCompatibleWithCharacter('chameleon_humanoid_v1', cid), true);
    }

    assert.equal(BODY_REGION_ORDER.length, 15);
    for (const reg of BODY_REGION_ORDER) {
      const mapped = mapLocalUvToRegionAtlas(0.5, 0.5, reg);
      const detected = findBodyRegionAtUV(mapped.u, mapped.v);
      assert.equal(detected, reg, `Center of ${reg} UV island must resolve back to ${reg}`);
    }

    // Verify bilateral symmetry maps leftUpperArm <-> rightUpperArm and mirrors within chest
    const leftArmMid = mapLocalUvToRegionAtlas(0.25, 0.5, 'leftUpperArm');
    const mirroredArm = getSymmetryMirroredUV(leftArmMid.u, leftArmMid.v, 'leftUpperArm');
    assert.equal(mirroredArm.regionId, 'rightUpperArm');
    assert.equal(findBodyRegionAtUV(mirroredArm.u, mirroredArm.v), 'rightUpperArm');

    const chestLeft = mapLocalUvToRegionAtlas(0.2, 0.5, 'chest');
    const chestMirrored = getSymmetryMirroredUV(chestLeft.u, chestLeft.v, 'chest');
    assert.equal(chestMirrored.regionId, 'chest');
    assert.ok(chestMirrored.u > chestLeft.u, 'Chest symmetry must mirror across horizontal U midpoint');
  });

  it('paints brush strokes, bucket fills, and shapes onto UV layers while erasing cleanly back to pure white (#ffffff)', () => {
    const layer = createEmptyLayer('test_layer', 'Base Layer');
    const chestCenter = mapLocalUvToRegionAtlas(0.5, 0.5, 'chest');

    // 1. Unpainted composite must be 100% pure white (#ffffff, alpha 255)
    const blankComposite = compositePaintLayersToBuffer([layer]);
    assert.equal(blankComposite[0], 255);
    assert.equal(blankComposite[1], 255);
    assert.equal(blankComposite[2], 255);
    assert.equal(blankComposite[3], 255);
    assert.equal(sampleColorAtUV([layer], chestCenter.u, chestCenter.v), '#ffffff');

    // 2. Paint a crimson brush stroke on the chest with bilateral symmetry enabled
    applyBrushStrokeSegment(
      layer,
      chestCenter.u,
      chestCenter.v,
      chestCenter.u,
      chestCenter.v,
      {
        ...DEFAULT_BRUSH_SETTINGS,
        tool: 'brush',
        colorHex: '#ef4444',
        size: 16,
        opacity: 1.0,
        hardness: 1.0,
        symmetry: true,
      },
      'chest'
    );
    assert.equal(sampleColorAtUV([layer], chestCenter.u, chestCenter.v), '#ef4444');

    // 3. Erase over the painted chest region and verify it restores pure white (#ffffff) with alpha 255 (never creating holes)
    applyBrushStrokeSegment(
      layer,
      chestCenter.u,
      chestCenter.v,
      chestCenter.u,
      chestCenter.v,
      {
        ...DEFAULT_BRUSH_SETTINGS,
        tool: 'eraser',
        size: 24,
        opacity: 1.0,
        hardness: 1.0,
      },
      'chest'
    );
    assert.equal(sampleColorAtUV([layer], chestCenter.u, chestCenter.v), '#ffffff');
    const erasedComposite = compositePaintLayersToBuffer([layer]);
    const px = Math.floor(chestCenter.u * PAINT_ATLAS_SIZE);
    const py = Math.floor((1 - chestCenter.v) * PAINT_ATLAS_SIZE);
    const idx = (py * PAINT_ATLAS_SIZE + px) * 4;
    assert.equal(erasedComposite[idx], 255);
    assert.equal(erasedComposite[idx + 1], 255);
    assert.equal(erasedComposite[idx + 2], 255);
    assert.equal(erasedComposite[idx + 3], 255, 'Erasing must never reduce composite alpha below 255');

    // 4. Bucket fill leftForearm with symmetry -> fills both leftForearm and rightForearm without bleeding onto head
    const leftForearmUv = mapLocalUvToRegionAtlas(0.5, 0.5, 'leftForearm');
    const rightForearmUv = mapLocalUvToRegionAtlas(0.5, 0.5, 'rightForearm');
    const headUv = mapLocalUvToRegionAtlas(0.5, 0.5, 'head');
    applyBucketFillToLayer(
      layer,
      leftForearmUv.u,
      leftForearmUv.v,
      {
        ...DEFAULT_BRUSH_SETTINGS,
        tool: 'bucket',
        colorHex: '#3b82f6',
        opacity: 1.0,
        symmetry: true,
      },
      'leftForearm'
    );
    assert.equal(sampleColorAtUV([layer], leftForearmUv.u, leftForearmUv.v), '#3b82f6');
    assert.equal(sampleColorAtUV([layer], rightForearmUv.u, rightForearmUv.v), '#3b82f6');
    assert.equal(sampleColorAtUV([layer], headUv.u, headUv.v), '#ffffff');

    // 5. Geometric shape stamp on head
    applyGeometricShapeToLayer(
      layer,
      headUv.u,
      headUv.v,
      'rect',
      {
        ...DEFAULT_BRUSH_SETTINGS,
        colorHex: '#22c55e',
        size: 16,
        opacity: 1.0,
      },
      'head'
    );
    assert.equal(sampleColorAtUV([layer], headUv.u, headUv.v), '#22c55e');
  });

  it('compresses RGBA paint buffers losslessly via RLE and saves, loads, equips, duplicates, and deletes designs', () => {
    const layer = createEmptyLayer('l1', 'Layer 1');
    const backUv = mapLocalUvToRegionAtlas(0.5, 0.5, 'back');
    applyBucketFillToLayer(
      layer,
      backUv.u,
      backUv.v,
      {
        ...DEFAULT_BRUSH_SETTINGS,
        colorHex: '#f97316',
        opacity: 1.0,
      },
      'back'
    );

    const rle = encodeRgbaBufferRLE(layer.data);
    assert.ok(rle.length > 0 && rle.length < 4000, 'RLE string must be compact');
    const decoded = decodeRgbaBufferRLE(rle, layer.data.length);
    assert.equal(decoded.length, layer.data.length);
    const reconstructedLayer = { ...layer, data: decoded };
    assert.equal(sampleColorAtUV([reconstructedLayer], backUv.u, backUv.v), '#f97316');

    // Save new custom design in paintStorage without overwriting starter samples
    const beforeCount = paintStorage.getDesigns().length;
    const saveRes = paintStorage.saveDesign({
      name: 'Unit Test Orange Back',
      characterId: 'volt',
      layers: [layer],
    });
    assert.equal(saveRes.ok, true);
    assert.ok(saveRes.design);
    const savedId = saveRes.design.id;
    assert.equal(paintStorage.getDesigns().length, beforeCount + 1);

    // Equip design and verify compatibility across characters
    assert.equal(paintStorage.equipDesign('volt', savedId), true);
    assert.equal(paintStorage.getEquippedDesignId('volt'), savedId);
    assert.equal(paintStorage.equipDesign('kestrel', savedId), true);
    assert.equal(paintStorage.getEquippedDesignId('kestrel'), savedId);

    // Duplicate and rename
    const dupRes = paintStorage.duplicateDesign(savedId);
    assert.equal(dupRes.ok, true);
    assert.ok(dupRes.design);
    assert.equal(paintStorage.renameDesign(dupRes.design.id, 'Renamed Copy'), true);
    assert.equal(paintStorage.getDesignById(dupRes.design.id)?.name, 'Renamed Copy');

    // Delete both test designs and verify equipped state clears cleanly
    assert.equal(paintStorage.deleteDesign(dupRes.design.id), true);
    assert.equal(paintStorage.deleteDesign(savedId), true);
    assert.equal(paintStorage.getEquippedDesignId('volt'), null);
  });

  it('enforces Solo (1), Duo (2), and Squad (4) party size limits accurately', () => {
    assert.equal(PARTY_SIZE_LIMITS.solo, 1);
    assert.equal(PARTY_SIZE_LIMITS.duo, 2);
    assert.equal(PARTY_SIZE_LIMITS.squad, 4);

    assert.equal(canAddPartyMember(1, 'solo'), false);
    assert.equal(canAddPartyMember(1, 'duo'), true);
    assert.equal(canAddPartyMember(2, 'duo'), false);
    assert.equal(canAddPartyMember(3, 'squad'), true);
    assert.equal(canAddPartyMember(4, 'squad'), false);

    const fourMembers = ['p1', 'p2', 'p3', 'p4'];
    assert.deepEqual(enforcePartySizeLimit(fourMembers, 'squad'), ['p1', 'p2', 'p3', 'p4']);
    assert.deepEqual(enforcePartySizeLimit(fourMembers, 'duo'), ['p1', 'p2']);
    assert.deepEqual(enforcePartySizeLimit(fourMembers, 'solo'), ['p1']);
  });

  it('provides sorted color palettes, 5-step shading tones, and 3D shading/blending brushes', () => {
    assert.equal(SORTED_COLOR_PALETTES.length, 4);
    assert.deepEqual(
      SORTED_COLOR_PALETTES.map((g) => g.id),
      ['vibrant', 'tactical', 'shading', 'accents']
    );

    const tones = generateShadingTonesForHex('#1877f2');
    assert.equal(tones.length, 5);
    const deepRgb = hexToRgb(tones[0].hex);
    const baseRgb = hexToRgb(tones[2].hex);
    const specRgb = hexToRgb(tones[4].hex);
    assert.ok(
      deepRgb.r + deepRgb.g + deepRgb.b < baseRgb.r + baseRgb.g + baseRgb.b,
      'deep_shadow must be darker than base tone'
    );
    assert.ok(
      specRgb.r + specRgb.g + specRgb.b > baseRgb.r + baseRgb.g + baseRgb.b,
      'specular highlight must be brighter than base tone'
    );

    // Test 3D Gradient Fill, Burn Shading, Dodge Highlight & Smooth Blend on chest region
    const layer = createEmptyLayer('shade_test', 'Shading Test');
    const chestMid = mapLocalUvToRegionAtlas(0.5, 0.5, 'chest');
    applyGradientFillToLayer(
      layer,
      chestMid.u,
      chestMid.v,
      { ...DEFAULT_BRUSH_SETTINGS, tool: 'gradient_fill', colorHex: '#ef4444', opacity: 1.0 },
      'chest'
    );
    const beforeShadeHex = sampleColorAtUV([layer], chestMid.u, chestMid.v);
    const beforeRgb = hexToRgb(beforeShadeHex);

    // Apply shade_burn to darken the contour
    applyBrushDabToLayer(
      layer,
      chestMid.u,
      chestMid.v,
      { ...DEFAULT_BRUSH_SETTINGS, tool: 'shade_burn', colorHex: '#0f172a', size: 16, opacity: 0.9 },
      'chest'
    );
    const afterBurnRgb = hexToRgb(sampleColorAtUV([layer], chestMid.u, chestMid.v));
    assert.ok(
      afterBurnRgb.r < beforeRgb.r,
      'shade_burn brush must darken existing surface color for 3D shading'
    );

    // Apply highlight_dodge to brighten the surface
    applyBrushDabToLayer(
      layer,
      chestMid.u,
      chestMid.v,
      { ...DEFAULT_BRUSH_SETTINGS, tool: 'highlight_dodge', colorHex: '#ffffff', size: 16, opacity: 0.95 },
      'chest'
    );
    const afterDodgeRgb = hexToRgb(sampleColorAtUV([layer], chestMid.u, chestMid.v));
    assert.ok(
      afterDodgeRgb.r > afterBurnRgb.r,
      'highlight_dodge brush must brighten shaded surface'
    );

    // Apply soft_blend without throwing or corrupting alpha
    applyBrushDabToLayer(
      layer,
      chestMid.u,
      chestMid.v,
      { ...DEFAULT_BRUSH_SETTINGS, tool: 'soft_blend', size: 14, opacity: 0.8 },
      'chest'
    );
    const blendedHex = sampleColorAtUV([layer], chestMid.u, chestMid.v);
    assert.match(blendedHex, /^#[0-9a-f]{6}$/i);
  });

  it('assigns valid characterIds and painted faction skins to all in-game enemy bots with zero copyrighted strings', () => {
    const sim = createSimulationState('volt', 'rift', 'foundry_arena');
    assert.ok(sim.enemies.length >= 6);
    for (let i = 0; i < sim.enemies.length; i++) {
      const bot = sim.enemies[i];
      assert.ok(
        CHARACTER_ORDER.includes(bot.characterId),
        `Enemy bot ${bot.id} must use a valid characterId, got ${bot.characterId}`
      );
    }

    const enemyPaintBuf = buildEnemyFactionPaintBuffer('rift', 'flanker', 1);
    assert.equal(enemyPaintBuf.length, PAINT_ATLAS_SIZE * PAINT_ATLAS_SIZE * 4);
    let nonWhitePixels = 0;
    for (let i = 0; i < enemyPaintBuf.length; i += 4) {
      if (
        enemyPaintBuf[i] < 250 ||
        enemyPaintBuf[i + 1] < 250 ||
        enemyPaintBuf[i + 2] < 250
      ) {
        nonWhitePixels++;
      }
    }
    assert.ok(
      nonWhitePixels > 1000,
      'Enemy faction paint buffer must contain painted & shaded regions over the white base'
    );

    // Ensure zero user-facing strings in roster, palettes, or starter designs contain "meccha", "chameleon", or "comelion"
    const bannedPattern = /meccha|chameleon|comelion/i;
    for (const cid of CHARACTER_ORDER) {
      const c = CHARACTER_ROSTER[cid];
      assert.equal(bannedPattern.test(c.name), false, `Roster name ${c.name} must not match banned pattern`);
      assert.equal(bannedPattern.test(c.codename), false, `Roster codename ${c.codename} must not match banned pattern`);
      assert.equal(bannedPattern.test(c.role), false, `Roster role ${c.role} must not match banned pattern`);
      assert.equal(bannedPattern.test(c.description), false, `Roster description must not match banned pattern`);
    }
    for (const pal of SORTED_COLOR_PALETTES) {
      assert.equal(bannedPattern.test(pal.label), false);
      assert.equal(bannedPattern.test(pal.subtitle), false);
      for (const sw of pal.swatches) {
        assert.equal(bannedPattern.test(sw.name), false);
      }
    }
    for (const d of paintStorage.getDesigns()) {
      assert.equal(bannedPattern.test(d.name), false, `Starter design ${d.name} must not match banned pattern`);
    }
  });

  it('builds distinct real-life 3D weapon geometries and hand sockets for all 6 weapons (m4a1, ak47, mp5, spas12, awp, deagle)', () => {
    const dummyTex = new THREE.Texture();
    const muzzleZSet = new Set<number>();
    const meshSignatures = new Set<string>();

    for (const wid of WEAPON_ORDER) {
      const vm = buildDetailedWeaponViewModel(wid, dummyTex);
      assert.ok(vm.root, `Viewmodel root must exist for ${wid}`);
      assert.ok(vm.rightHandSocket.z > 0.04, `Right hand socket must sit at pistol grip for ${wid}`);
      assert.ok(vm.leftHandSocket.z < 0.08, `Left hand socket must sit at forend/support for ${wid}`);
      muzzleZSet.add(Number(vm.muzzleTipLocal.z.toFixed(3)));

      let meshCount = 0;
      let totalVerts = 0;
      vm.gunGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          meshCount++;
          const posAttr = (obj as THREE.Mesh).geometry.attributes.position;
          if (posAttr) totalVerts += posAttr.count;
        }
      });
      assert.ok(meshCount >= 6, `Weapon ${wid} must have at least 6 distinct 3D component meshes`);
      meshSignatures.add(`${meshCount}:${totalVerts}`);

      if (wid === 'spas12') {
        assert.ok(vm.pumpGrip !== null, 'SPAS-12 must include an articulated pumpGrip');
      }

      const tpProp = buildCompactHandheldWeaponProp(wid, true);
      let tpMeshCount = 0;
      tpProp.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) tpMeshCount++;
      });
      assert.ok(tpMeshCount >= 6, `3rd-person weapon prop for ${wid} must use the unified detailed 3D weapon model`);
      const tpVm = tpProp.userData.weaponRig;
      assert.ok(tpVm, `3rd-person weapon prop for ${wid} must expose unified weaponRig for 1st/3rd-person sync`);
      assert.ok(tpVm.magazine, `Unified 3rd-person weaponRig for ${wid} must include articulated magazine`);
      assert.ok(tpVm.slideOrBolt, `Unified 3rd-person weaponRig for ${wid} must include articulated slideOrBolt`);
      assert.ok(tpVm.triggerBlade, `Unified 3rd-person weaponRig for ${wid} must include articulated triggerBlade`);
    }

    assert.equal(
      muzzleZSet.size,
      WEAPON_ORDER.length,
      'Each of the 6 weapons must have a distinct real-life barrel length and muzzleTipLocal.z'
    );
    assert.equal(
      meshSignatures.size,
      WEAPON_ORDER.length,
      'Each of the 6 weapons must have a unique 3D mesh & vertex signature'
    );
  });

  it('animates 16-direction character locomotion with distinct directional pelvis twist, torso counter-twist, and leg kinematics', () => {
    const rig = buildChameleonHumanoidRig('volt', 1);
    const pelvisYaws: number[] = [];

    for (let sector = 0; sector < 16; sector++) {
      const angle = (sector / 16) * Math.PI * 2;
      // localMoveX = right (+sin), localMoveZ = backward (-cos)
      const localMoveX = Math.sin(angle);
      const localMoveZ = -Math.cos(angle);
      // Step multiple frames to let exponential damping converge to sector target
      for (let step = 0; step < 8; step++) {
        updateChameleonRigAnimation(
          rig,
          'combat',
          1.0 + step * 0.016,
          5.2,
          Math.PI * 0.25,
          false,
          localMoveX,
          localMoveZ
        );
      }
      pelvisYaws.push(Number(rig.hipsPivot.rotation.y.toFixed(4)));
      // Upper torso counter-twists opposite to pelvis twist so weapon stays aimed forward
      assert.ok(
        Math.abs(rig.hipsPivot.rotation.y + rig.torsoPivot.rotation.y) < 0.12,
        `Torso must counter-twist pelvis in sector ${sector}`
      );
    }

    // Verify right strafe (sector 4) twists pelvis positively while left strafe (sector 12) twists negatively
    assert.ok(pelvisYaws[4] > 0.2, `Right strafe pelvis yaw (${pelvisYaws[4]}) must be positive`);
    assert.ok(pelvisYaws[12] < -0.1, `Left strafe pelvis yaw (${pelvisYaws[12]}) must be negative`);

    // Verify full-body locomotion moves hips laterally (hipsX), rolls torso, and pumps shoulders/elbows across stride phases
    for (let s = 0; s < 8; s++) {
      updateChameleonRigAnimation(rig, 'combat', 2.0 + s * 0.016, 5.4, Math.PI * 0.5, false, 0, -1, false, 0, 0);
    }
    const hipShiftPhaseA = rig.hipsPivot.position.x;
    const shoulderPitchPhaseA = rig.rightShoulderPivot.rotation.x;
    for (let s = 0; s < 8; s++) {
      updateChameleonRigAnimation(rig, 'combat', 2.2 + s * 0.016, 5.4, Math.PI * 1.5, false, 0, -1, false, 0, 0);
    }
    const hipShiftPhaseB = rig.hipsPivot.position.x;
    const shoulderPitchPhaseB = rig.rightShoulderPivot.rotation.x;
    assert.ok(
      Math.abs(hipShiftPhaseA - hipShiftPhaseB) > 0.02,
      'Full-body locomotion must shift pelvis laterally (hipsX) between left and right footsteps'
    );
    assert.ok(
      Math.abs(shoulderPitchPhaseA - shoulderPitchPhaseB) > 0.04,
      'Full-body locomotion must pump upper body shoulders/arms in sync with stride'
    );

    // Verify 3rd-person per-weapon reload choreography moves support/firing arms & weaponMount uniquely across weapons
    for (let s = 0; s < 8; s++) {
      updateChameleonRigAnimation(rig, 'combat', 3.0 + s * 0.016, 0, 0, false, 0, 0, true, 0.25, 0, 'm4a1');
    }
    const reloadSupportShoulderX = rig.rightShoulderPivot.rotation.x;
    for (let s = 0; s < 8; s++) {
      updateChameleonRigAnimation(rig, 'combat', 3.2 + s * 0.016, 0, 0, false, 0, 0, false, 0, 0, 'm4a1');
    }
    const aimSupportShoulderX = rig.rightShoulderPivot.rotation.x;
    assert.ok(
      Math.abs(reloadSupportShoulderX - aimSupportShoulderX) > 0.15,
      'Reload animation must articulate character support arm away from static aim pose'
    );

    // Verify AWP right-hand bolt-cycling reload differs from M4A1 left-hand magazine reload
    for (let s = 0; s < 8; s++) {
      updateChameleonRigAnimation(rig, 'combat', 4.0 + s * 0.016, 0, 0, false, 0, 0, true, 0.22, 0, 'awp');
    }
    const awpBoltRightShoulderX = rig.rightShoulderPivot.rotation.x;
    // Verify looking up (+aimPitch) and looking down (-aimPitch) visibly pitches spine, head, arms, and weaponMount
    for (let s = 0; s < 10; s++) {
      updateChameleonRigAnimation(rig, 'combat', 5.0 + s * 0.016, 0, 0, false, 0, 0, false, 0, 0, 'm4a1', 0.85);
    }
    const upTorsoPitch = rig.torsoPivot.rotation.x;
    const upHeadPitch = rig.headPivot.rotation.x;
    const upWeaponPitch = rig.weaponMount.rotation.x;
    const upWeaponY = rig.weaponMount.position.y;

    for (let s = 0; s < 10; s++) {
      updateChameleonRigAnimation(rig, 'combat', 5.3 + s * 0.016, 0, 0, false, 0, 0, false, 0, 0, 'm4a1', -0.85);
    }
    const downTorsoPitch = rig.torsoPivot.rotation.x;
    const downHeadPitch = rig.headPivot.rotation.x;
    const downWeaponPitch = rig.weaponMount.rotation.x;
    const downWeaponY = rig.weaponMount.position.y;

    assert.ok(
      upTorsoPitch < -0.25 && downTorsoPitch > 0.25,
      `Spine torsoPivot.rotation.x must tilt backward when looking up (${upTorsoPitch}) and forward when looking down (${downTorsoPitch})`
    );
    assert.ok(
      upHeadPitch < -0.2 && downHeadPitch > 0.2,
      `Head headPivot.rotation.x must tilt up (${upHeadPitch}) and down (${downHeadPitch}) with aimPitch`
    );
    assert.ok(
      upWeaponPitch < downWeaponPitch - 0.65,
      `Weapon mount rotation.x must pitch up (${upWeaponPitch}) and down (${downWeaponPitch}) with aimPitch`
    );
    assert.ok(
      upWeaponY > downWeaponY + 0.25,
      `Weapon mount height must sweep upward when aiming up (${upWeaponY}) and downward when aiming down (${downWeaponY})`
    );

    rig.dispose();
  });

  it('seats magazines flush inside all 6 3D weapon receivers with zero floating gap and drives the unified FPV/TPV combat weapon rig', () => {
    const dummyFlashTex = new THREE.Texture();
    for (const wid of WEAPON_ORDER) {
      const vm = buildDetailedWeaponViewModel(wid, dummyFlashTex);
      vm.root.updateMatrixWorld(true);

      // Compute bounding box of magazine vs solid gun receiver/barrel meshes (excluding muzzleFlashGroup planes)
      const magBox = new THREE.Box3().setFromObject(vm.magazine);
      const receiverBox = new THREE.Box3();
      vm.gunGroup.traverse((child) => {
        if (
          (child as THREE.Mesh).isMesh &&
          child !== vm.magazine &&
          !vm.magazine.children.includes(child) &&
          child.parent !== vm.magazine &&
          child.parent !== vm.muzzleFlashGroup
        ) {
          receiverBox.expandByObject(child);
        }
      });

      assert.ok(
        magBox.max.y > receiverBox.min.y + 0.015,
        `Weapon ${wid} magazine top (${magBox.max.y.toFixed(4)}) must penetrate deep inside receiver (${receiverBox.min.y.toFixed(4)}) with zero floating gap`
      );

      // Verify muzzleFlashGroup is positioned at the front tip of the barrel (negative Z in vm local space)
      const muzzlePos = new THREE.Vector3();
      vm.muzzleFlashGroup.getWorldPosition(muzzlePos);
      assert.ok(
        Math.abs(muzzlePos.z - receiverBox.min.z) < 0.06,
        `Weapon ${wid} muzzleFlashGroup (${muzzlePos.z.toFixed(3)}) must sit at the front barrel tip (${receiverBox.min.z.toFixed(3)})`
      );
    }

    // Verify unified FPV/TPV character rig updates mounted combatWeaponProp and locks magazine to left hand during reload
    const rig = buildChameleonHumanoidRig('volt', 1);
    const prop = buildCompactHandheldWeaponProp('m4a1', true);
    rig.weaponMount.add(prop);
    const vm = prop.userData.weaponRig;
    assert.ok(vm, 'combatWeaponProp must expose WeaponViewModelRig');

    // Run mid-reload (progress = 0.22 -> pulling magazine down into chest pouch)
    for (let s = 0; s < 6; s++) {
      updateChameleonRigAnimation(
        rig,
        'combat',
        1.0 + s * 0.016,
        0,
        0,
        false,
        0,
        0,
        true,
        0.22,
        0,
        'm4a1',
        -0.35,
        0,
        0,
        0,
        0,
        {
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
          muzzleFlashActive: true,
          fireCooldownRatio: 0,
          magAmmoCount: 12,
          isFirstHalfSwap: false,
          swapHalfProgress: 0,
          weaponRig: vm,
        }
      );
    }
    rig.root.updateMatrixWorld(true);
    assert.ok(
      vm.magazine.position.y < vm.magBasePos.y - 0.05,
      'Unified weapon rig magazine must move down with the left hand during reload extraction'
    );
    assert.equal(vm.muzzleFlashGroup.visible, true);

    rig.dispose();
  });

  it('expands and contracts dynamic crosshair gap based on weapon accuracy, character movement/stance, and recoil state', () => {
    const sim = createSimulationState();
    const p = sim.player;

    // 1. Weapon accuracy hierarchy in stationary hipfire: MP5 < M4A1 < AK-47 < SPAS-12
    p.activeWeapon = 'mp5';
    const mp5Gap = computeDynamicCrosshairState(p).targetGapPx;
    p.activeWeapon = 'm4a1';
    const m4Gap = computeDynamicCrosshairState(p).targetGapPx;
    p.activeWeapon = 'ak47';
    const akGap = computeDynamicCrosshairState(p).targetGapPx;
    p.activeWeapon = 'spas12';
    const spasGap = computeDynamicCrosshairState(p).targetGapPx;

    assert.ok(mp5Gap < m4Gap, `MP5 hipfire gap (${mp5Gap}) should be tighter than M4A1 (${m4Gap})`);
    assert.ok(m4Gap < akGap, `M4A1 hipfire gap (${m4Gap}) should be tighter than AK-47 (${akGap})`);
    assert.ok(akGap < spasGap, `AK-47 hipfire gap (${akGap}) should be tighter than SPAS-12 (${spasGap})`);

    // 2. Crouching and ADS tighten the crosshair gap
    p.activeWeapon = 'm4a1';
    p.isCrouching = true;
    const crouchGap = computeDynamicCrosshairState(p).targetGapPx;
    assert.ok(crouchGap < m4Gap, `Crouching gap (${crouchGap}) must be tighter than standing (${m4Gap})`);
    p.isCrouching = false;

    p.adsBlend = 1.0;
    const adsGap = computeDynamicCrosshairState(p).targetGapPx;
    assert.ok(adsGap < crouchGap, `Full ADS gap (${adsGap}) must be tighter than hipfire crouch (${crouchGap})`);
    p.adsBlend = 0;

    // 3. Character movement (walking, sprinting, airborne) expands the crosshair outward
    stepSimulation(sim, 0.05, createNeutralInput({ moveZ: -1 }));
    const walkGap = computeDynamicCrosshairState(p).targetGapPx;
    assert.ok(walkGap > m4Gap + 1.5, `Walking gap (${walkGap}) must expand beyond stationary (${m4Gap})`);

    stepSimulation(sim, 0.05, createNeutralInput({ moveZ: -1, sprintHeld: true }));
    const sprintGap = computeDynamicCrosshairState(p).targetGapPx;
    assert.ok(sprintGap > walkGap + 3.0, `Sprinting gap (${sprintGap}) must expand beyond walking (${walkGap})`);

    p.vx = 0;
    p.vz = 0;
    p.isSprinting = false;
    p.isGrounded = false;
    p.vy = 6.5;
    const airGap = computeDynamicCrosshairState(p).targetGapPx;
    assert.ok(airGap > walkGap + 5.0, `Airborne jump gap (${airGap}) must expand significantly (${walkGap})`);
    p.isGrounded = true;
    p.vy = 0;

    // 4. Firing weapon applies recoil kick & bloom that expands crosshair and recovers over time
    const preFireGap = computeDynamicCrosshairState(p).targetGapPx;
    p.fireCooldownMs = 0;
    stepSimulation(sim, 0.016, createNeutralInput({ fireJustPressed: true }));
    const postFireMetrics = computeDynamicCrosshairState(p);
    const postFireRecoilSpread = postFireMetrics.recoilSpreadDeg;
    const postFireGap = postFireMetrics.targetGapPx;
    assert.ok(postFireRecoilSpread > 0.4, 'Firing must produce positive recoilSpreadDeg');
    assert.ok(
      postFireGap > preFireGap + 2.0,
      `Post-fire gap (${postFireGap}) must expand over pre-fire (${preFireGap})`
    );

    // Let recoil recover over 20 frames
    for (let i = 0; i < 20; i++) {
      stepSimulation(sim, 0.025, createNeutralInput());
    }
    const recoveredGap = computeDynamicCrosshairState(p).targetGapPx;
    assert.ok(
      recoveredGap < postFireGap - 1.5,
      `Recovered gap (${recoveredGap}) must contract after recoil decays (${postFireGap})`
    );

    // 5. Verify researched /public/gunmarks/*.png reference textures exist on disk
    const gunmarkFiles = [
      'public/gunmarks/mp5_9mm.png',
      'public/gunmarks/m4a1_556mm.png',
      'public/gunmarks/ak47_762mm.png',
      'public/gunmarks/deagle_50ae.png',
      'public/gunmarks/spas12_12ga.png',
      'public/gunmarks/awp_338lapua.png',
    ];
    for (const relPath of gunmarkFiles) {
      const fullPath = path.join(process.cwd(), relPath);
      assert.ok(fs.existsSync(fullPath), `Gunmark reference asset must exist at ${fullPath}`);
      assert.ok(fs.statSync(fullPath).size > 500, `Gunmark asset ${fullPath} must be non-empty PNG`);
    }
  });

  it('simulates physics-based 6-DOF weapon sway with idle breathing, stride pendulum, and mass-scaled inertia', () => {
    // 1. Verify mass hierarchy: Deagle (2.0kg) < MP5 < M4A1 < AK47 < SPAS12 < AWP (6.5kg)
    assert.ok(
      WEAPON_MASS_SWAY_PROFILES.deagle.massKg < WEAPON_MASS_SWAY_PROFILES.m4a1.massKg &&
        WEAPON_MASS_SWAY_PROFILES.m4a1.massKg < WEAPON_MASS_SWAY_PROFILES.awp.massKg,
      'Weapon mass profiles must reflect realistic physical weight hierarchy'
    );
    assert.ok(
      WEAPON_MASS_SWAY_PROFILES.awp.omegaPos > 0 &&
        WEAPON_MASS_SWAY_PROFILES.awp.omegaPos < WEAPON_MASS_SWAY_PROFILES.deagle.omegaPos &&
        WEAPON_MASS_SWAY_PROFILES.awp.omegaRot < WEAPON_MASS_SWAY_PROFILES.deagle.omegaRot,
      'Heavier weapons must have lower spring natural frequency (slower, heavier inertia recovery)'
    );

    // 2. Idle state: continuous multi-frequency Lissajous breathing + postural micro-sway
    const idleState = createWeaponSwayPhysicsState();
    let maxIdleRmsPos = 0;
    let maxIdleRmsRot = 0;
    const samplePosX: number[] = [];
    const samplePosY: number[] = [];

    for (let i = 0; i < 240; i++) {
      stepWeaponSwayPhysics(idleState, 1 / 60, {
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
      });
      if (i >= 30) {
        samplePosX.push(idleState.posX);
        samplePosY.push(idleState.posY);
        const posMag = Math.hypot(idleState.posX, idleState.posY, idleState.posZ);
        const rotMag = Math.hypot(idleState.pitch, idleState.yaw, idleState.roll);
        if (posMag > maxIdleRmsPos) maxIdleRmsPos = posMag;
        if (rotMag > maxIdleRmsRot) maxIdleRmsRot = rotMag;
      }
    }

    assert.ok(
      maxIdleRmsPos > 0.0015 && maxIdleRmsPos < 0.025,
      `Idle weapon sway position amplitude (${maxIdleRmsPos}) must be subtle and non-zero`
    );
    assert.ok(
      maxIdleRmsRot > 0.002 && maxIdleRmsRot < 0.04,
      `Idle weapon sway rotational amplitude (${maxIdleRmsRot}) must be subtle and non-zero`
    );
    // Ensure it oscillates (changes direction over a 3.5s window rather than freezing at a static offset)
    const minX = Math.min(...samplePosX);
    const maxX = Math.max(...samplePosX);
    const minY = Math.min(...samplePosY);
    const maxY = Math.max(...samplePosY);
    assert.ok(maxX - minX > 0.002, 'Idle horizontal sway must actively oscillate over time');
    assert.ok(maxY - minY > 0.003, 'Idle vertical breathing sway must actively oscillate over time');

    // 3. ADS and crouch steadying: aiming down sights while crouched tightens idle sway significantly
    const adsState = createWeaponSwayPhysicsState();
    let maxAdsPos = 0;
    for (let i = 0; i < 240; i++) {
      stepWeaponSwayPhysics(adsState, 1 / 60, {
        weaponId: 'm4a1',
        lookDeltaYaw: 0,
        lookDeltaPitch: 0,
        localVelRight: 0,
        localVelFwd: 0,
        velY: 0,
        moveSpeed: 0,
        walkBobPhase: 0,
        adsBlend: 1,
        isCrouching: true,
        isSprinting: false,
        isSliding: false,
        isGrounded: true,
      });
      if (i >= 30) {
        const mag = Math.hypot(adsState.posX, adsState.posY, adsState.posZ);
        if (mag > maxAdsPos) maxAdsPos = mag;
      }
    }
    assert.ok(
      maxAdsPos < maxIdleRmsPos * 0.45,
      `Crouched ADS sway (${maxAdsPos}) must be significantly tighter than standing hipfire idle sway (${maxIdleRmsPos})`
    );

    // 4. Movement & Acceleration Inertia: sprinting forward & strafing right produces heavier pendulum bob + opposite bank roll
    const moveState = createWeaponSwayPhysicsState();
    let maxMoveDisp = 0;
    for (let i = 0; i < 60; i++) {
      stepWeaponSwayPhysics(moveState, 1 / 60, {
        weaponId: 'ak47',
        lookDeltaYaw: 0,
        lookDeltaPitch: 0,
        localVelRight: 4.5,
        localVelFwd: 7.5,
        velY: 0,
        moveSpeed: 8.7,
        walkBobPhase: i * 0.22,
        adsBlend: 0,
        isCrouching: false,
        isSprinting: true,
        isSliding: false,
        isGrounded: true,
      });
      const disp = Math.hypot(moveState.posX, moveState.posY, moveState.posZ);
      if (disp > maxMoveDisp) maxMoveDisp = disp;
    }
    assert.ok(
      maxMoveDisp > maxIdleRmsPos * 2.5,
      `Sprinting movement sway (${maxMoveDisp}) must exceed idle breathing sway (${maxIdleRmsPos}) with weighty pendulum momentum`
    );
    assert.ok(
      moveState.exertion > 0.4,
      `Sprinting must build cardiorespiratory exertion (${moveState.exertion}) for heavy post-sprint breathing`
    );

    // 5. Camera look rotational inertia scales with weapon mass (AWP lags more than Deagle on identical camera whip)
    const deagleLook = createWeaponSwayPhysicsState();
    const awpLook = createWeaponSwayPhysicsState();

    // Apply 6 frames of rapid horizontal camera pan
    for (let i = 1; i <= 6; i++) {
      stepWeaponSwayPhysics(deagleLook, 1 / 60, {
        weaponId: 'deagle',
        lookDeltaYaw: 0.06,
        lookDeltaPitch: 0.02,
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
      });
      stepWeaponSwayPhysics(awpLook, 1 / 60, {
        weaponId: 'awp',
        lookDeltaYaw: 0.06,
        lookDeltaPitch: 0.02,
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
      });
    }

    assert.ok(
      Math.hypot(awpLook.posX, awpLook.posY) > Math.hypot(deagleLook.posX, deagleLook.posY) ||
        Math.abs(awpLook.roll) > Math.abs(deagleLook.roll),
      `Heavy 6.5kg AWP look inertia response (pos=${Math.hypot(awpLook.posX, awpLook.posY)}, roll=${awpLook.roll}) must differ from 2.0kg Deagle`
    );
  });

  it('solves perpendicular, oblique, and grazing impact angles with tangent projection and elongation limits', () => {
    const arena = ARENA_REGISTRY.foundry_arena;
    // South face of cover block cov_c2 (x=0, z=7, depth=0.2 -> south face z=7.1, normal=(0,0,1))
    const hitPoint = { x: 0, y: 0.65, z: 7.1 };
    const normal = { x: 0, y: 0, z: 1 };

    // 1. Near-perpendicular impact (0° incidence)
    const perp = solveImpactAngle({
      point: hitPoint,
      normal,
      direction: { x: 0, y: 0, z: -1 },
      weaponId: 'm4a1',
      materialType: 'concrete',
      arena,
      seed: 1001,
    });
    assert.equal(perp.valid, true);
    assert.equal(perp.regime, 'perpendicular');
    assert.ok(perp.incidenceDeg < 5.0, `Expected near-0° incidence, got ${perp.incidenceDeg}`);
    assert.ok(perp.elongation >= 1.0 && perp.elongation < 1.05);
    assert.equal(perp.ricochetEligible, false);

    // 2. Oblique impact (~45° incidence from left-front)
    const oblique = solveImpactAngle({
      point: hitPoint,
      normal,
      direction: { x: 1, y: 0, z: -1 },
      weaponId: 'm4a1',
      materialType: 'concrete',
      arena,
      seed: 1001,
    });
    assert.equal(oblique.valid, true);
    assert.equal(oblique.regime, 'oblique');
    assert.ok(oblique.incidenceDeg > 40 && oblique.incidenceDeg < 50);
    assert.ok(oblique.elongation > perp.elongation * 1.18, 'Oblique impact must elongate along tangent');
    assert.ok(oblique.asymmetry > perp.asymmetry, 'Oblique impact must increase entry-to-exit asymmetry');
    assert.ok(oblique.tangent.x > 0.95, 'Projected tangent must align with +X bullet sweep');

    // 3. Shallow grazing impact (~78° incidence)
    const grazing = solveImpactAngle({
      point: hitPoint,
      normal,
      direction: { x: 4.8, y: -0.5, z: -1.0 },
      weaponId: 'ak47',
      materialType: 'metal',
      arena,
      seed: 1001,
    });
    assert.equal(grazing.valid, true);
    assert.equal(grazing.regime, 'grazing');
    assert.ok(grazing.incidenceDeg >= 60.0);
    assert.ok(grazing.elongation > oblique.elongation, 'Grazing impact must stretch further than oblique');
    assert.ok(
      grazing.elongation <= IMPACT_MATERIAL_PROFILES.metal.maxElongationCap,
      'Grazing elongation must respect sensible upper bound'
    );
    assert.equal(grazing.ricochetEligible, true, 'Grazing hit on metal must be ricochet-eligible');

    // 4. Safeguard against zero/invalid vectors
    const fallbackRes = solveImpactAngle({
      point: hitPoint,
      normal: { x: 0, y: 0, z: 0 },
      direction: { x: 0, y: 0, z: 0 },
      origin: { x: 0, y: 0.65, z: 12 },
      weaponId: 'mp5',
      materialType: 'concrete',
    });
    assert.equal(fallbackRes.valid, false, 'Zero normal vector must flag valid=false without NaN');
    assert.ok(Number.isFinite(fallbackRes.elongation));
  });

  it('generates deterministic, unique procedural mark descriptors and material profiles across all surfaces', () => {
    const materials: ImpactMaterialType[] = [
      'concrete',
      'stone',
      'wood',
      'metal',
      'glass',
      'tile',
      'gravel',
      'default',
    ];
    for (const mat of materials) {
      const prof = IMPACT_MATERIAL_PROFILES[mat];
      assert.ok(prof, `Material profile ${mat} must exist`);
      assert.ok(prof.sizeMultiplier > 0.5 && prof.sizeMultiplier < 1.5);
    }

    // Verify deterministic seeded reproducibility
    const seedA = deriveImpactSeed(1.25, 0.85, 7.1, 'ak47', 1);
    const seedB = deriveImpactSeed(1.25, 0.85, 7.1, 'ak47', 1);
    const seedC = deriveImpactSeed(2.4, 1.1, 7.1, 'ak47', 2);
    assert.equal(seedA, seedB, 'Identical coordinates and salt must produce identical seed');
    assert.notEqual(seedA, seedC, 'Different hit locations must produce distinct seeds');

    const rng1 = createSeededRandom(seedA);
    const rng2 = createSeededRandom(seedB);
    assert.equal(rng1(), rng2());
    assert.equal(rng1(), rng2());

    const angleRes = solveImpactAngle({
      point: { x: 0, y: 0.65, z: 7.1 },
      normal: { x: 0, y: 0, z: 1 },
      direction: { x: 0.3, y: -0.1, z: -1 },
      weaponId: 'ak47',
      materialType: 'concrete',
      seed: seedA,
    });
    const desc1 = generateProceduralMarkDescriptor(seedA, 'ak47', 'concrete', angleRes, 0);
    const desc2 = generateProceduralMarkDescriptor(seedB, 'ak47', 'concrete', angleRes, 0);
    const desc3 = generateProceduralMarkDescriptor(seedC, 'ak47', 'concrete', angleRes, 0);

    assert.deepEqual(desc1, desc2, 'Same seed and parameters must produce identical procedural mark');
    assert.ok(
      desc1.holeRadiusRatio !== desc3.holeRadiusRatio ||
        desc1.contourIrregularity !== desc3.contourIrregularity ||
        desc1.rotationOffsetRad !== desc3.rotationOffsetRad,
      'Different seeds must produce genuinely varied procedural parameters'
    );

    // Verify arena surface material classifier
    const arena = ARENA_REGISTRY.foundry_arena;
    assert.equal(classifyArenaHitMaterial(arena, 0, 0.5, 0, null, 'crate'), 'wood');
    assert.equal(classifyArenaHitMaterial(arena, 0, 0.5, 0, null, 'barrel'), 'metal');
    assert.equal(classifyArenaHitMaterial(arena, 0, 0.01, 12, 'floor', null), 'metal');
    assert.equal(classifyArenaHitMaterial(arena, 0, 0.01, -18, 'floor', null), 'wood');
  });

  it('batches instanced impacts, accumulates overlapping hits, recycles pool capacity, and switches quality profiles', () => {
    const root = new THREE.Group();
    const camera = new THREE.PerspectiveCamera(75, 1.6, 0.1, 200);
    camera.position.set(0, 1.68, 14);

    const engine = new BulletImpactSystem(root, 'desktop', false);
    const arena = ARENA_REGISTRY.foundry_arena;

    // 1. Add 4 overlapping impacts at almost the same spot on concrete wall cov_c2
    for (let i = 0; i < 4; i++) {
      const meta = engine.addImpact({
        point: { x: i * 0.04, y: 0.65, z: 7.1 },
        normal: { x: 0, y: 0, z: 1 },
        direction: { x: 0, y: 0, z: -1 },
        weaponId: 'm4a1',
        materialType: 'concrete',
        arena,
      });
      assert.ok(meta, `Impact #${i + 1} must be added`);
      if (i === 3) {
        assert.ok(
          meta.localOverlapCount >= 3,
          `4th closely spaced hit must detect >= 3 local overlaps (got ${meta.localOverlapCount})`
        );
        assert.ok(
          meta.accumulationBoost > 0.5,
          `Clustered hits must accumulate damage boost (${meta.accumulationBoost})`
        );
      }
    }

    // 2. Test all material types (concrete, stone, wood, metal, glass)
    const testMaterials: ImpactMaterialType[] = ['stone', 'wood', 'metal', 'glass'];
    for (let i = 0; i < testMaterials.length; i++) {
      const m = testMaterials[i];
      const meta = engine.addImpact({
        point: { x: -1.5 + i * 0.8, y: 0.7, z: 7.1 },
        normal: { x: 0, y: 0, z: 1 },
        direction: { x: 0.4, y: -0.1, z: -1 },
        weaponId: 'deagle',
        materialType: m,
        arena,
      });
      assert.ok(meta);
      assert.equal(meta.materialType, m);
    }

    const telemDesktop = engine.getDebugTelemetry();
    assert.equal(telemDesktop.activeImpactCount, 8);
    assert.equal(telemDesktop.qualityProfile, 'desktop');
    assert.ok(
      telemDesktop.impactDrawCalls <= 4,
      `All active marks, detail collars, and particles must batch into <= 4 InstancedMesh draw calls (got ${telemDesktop.impactDrawCalls})`
    );
    assert.ok(telemDesktop.activeSecondaryParticles > 0);

    // 3. Switch to mobile quality profile and verify pool capacity & recycling
    engine.setQualityProfile('mobile', false);
    const mobileMax = IMPACT_QUALITY_PROFILES.mobile.maxActiveMarks;
    assert.equal(engine.getQualityConfig().id, 'mobile');
    assert.equal(engine.getQualityConfig().maxActiveMarks, mobileMax);

    // Fire beyond mobile pool capacity (mobileMax + 15 shots) to verify bounded recycling
    for (let i = 0; i < mobileMax + 15; i++) {
      engine.addImpact({
        point: { x: ((i % 10) - 5) * 0.4, y: 0.4 + (i % 3) * 0.25, z: 7.1 },
        normal: { x: 0, y: 0, z: 1 },
        direction: { x: 0, y: 0, z: -1 },
        weaponId: 'mp5',
        materialType: 'concrete',
        arena,
      });
    }

    engine.update(0.016, camera);
    const telemFull = engine.getDebugTelemetry();
    assert.equal(
      telemFull.activeImpactCount,
      mobileMax,
      `Active impacts (${telemFull.activeImpactCount}) must never exceed mobile pool limit (${mobileMax})`
    );
    assert.ok(
      telemFull.recycledCount >= 15,
      `Overflowing pool must recycle lowest-priority marks (recycledCount=${telemFull.recycledCount})`
    );

    // 4. Verify clear and dispose lifecycle
    engine.clear();
    assert.equal(engine.getDebugTelemetry().activeImpactCount, 0);
    engine.dispose();
    assert.equal(root.children.length, 0, 'dispose() must detach BulletImpactSystem rootGroup from scene');
  });

  it('prevents all 6 3D weapons from clipping into the player character body across all pitch angles, ADS states, and wall-obstruction poses', () => {
    const invTorsoMatrix = new THREE.Matrix4();
    const vertexWorld = new THREE.Vector3();
    const vertexTorso = new THREE.Vector3();

    for (const charId of CHARACTER_ORDER) {
      const rig = buildChameleonHumanoidRig(charId, 1);
      const charProp = CHARACTER_ROSTER[charId].proportions;
      const chestSurfaceFrontZ = 0.215 * charProp.torsoWidth;

      for (const wid of WEAPON_ORDER) {
        rig.weaponMount.clear();
        const weaponProp = buildCompactHandheldWeaponProp(wid, true);
        rig.weaponMount.add(weaponProp);
        const vm = weaponProp.userData.weaponRig;

        const testConfigs = [
          { pitch: 0, ads: 0, wallObs: 0, recoil: 0, reload: false },
          { pitch: 0, ads: 1, wallObs: 0, recoil: 0.18, reload: false },
          { pitch: -1.32, ads: 0, wallObs: 0, recoil: 0, reload: false },
          { pitch: 1.32, ads: 0, wallObs: 0, recoil: 0, reload: false },
          { pitch: -1.25, ads: 1, wallObs: 0, recoil: 0.15, reload: false },
          { pitch: 0, ads: 0, wallObs: 1.0, recoil: 0, reload: false },
          { pitch: -0.95, ads: 0, wallObs: 1.0, recoil: 0.12, reload: false },
          { pitch: 0.95, ads: 0, wallObs: 1.0, recoil: 0, reload: true },
        ];

        for (const cfg of testConfigs) {
          for (let step = 0; step < 8; step++) {
            updateChameleonRigAnimation(
              rig,
              'combat',
              10.0 + step * 0.032,
              3.5,
              step * 0.3,
              false,
              0,
              -1,
              cfg.reload,
              0.45,
              cfg.recoil,
              wid,
              cfg.pitch,
              cfg.ads,
              0,
              0,
              0,
              {
                wallObstruction: cfg.wallObs,
                recoilKickZ: cfg.recoil * 0.12,
                recoilKickPitch: cfg.recoil,
                weaponRig: vm,
              }
            );
          }
          rig.root.updateMatrixWorld(true);
          invTorsoMatrix.copy(rig.torsoPivot.matrixWorld).invert();

          // Compute rear-most Z of the weapon's solid receiver & buttstock in torsoPivot space
          let minWeaponZInTorso = Infinity;
          vm.gunGroup.traverse((obj: THREE.Object3D) => {
            const mesh = obj as THREE.Mesh;
            if (!mesh.isMesh || obj.parent === vm.muzzleFlashGroup) return;
            mesh.geometry.computeBoundingBox();
            const bb = mesh.geometry.boundingBox;
            if (!bb) return;
            const corners = [
              [bb.min.x, bb.min.y, bb.min.z],
              [bb.max.x, bb.max.y, bb.max.z],
              [bb.min.x, bb.max.y, bb.max.z],
              [bb.max.x, bb.min.y, bb.max.z],
            ];
            for (const [cx, cy, cz] of corners) {
              vertexWorld.set(cx, cy, cz).applyMatrix4(mesh.matrixWorld);
              vertexTorso.copy(vertexWorld).applyMatrix4(invTorsoMatrix);
              if (vertexTorso.z < minWeaponZInTorso) {
                minWeaponZInTorso = vertexTorso.z;
              }
            }
          });

          assert.ok(
            minWeaponZInTorso > chestSurfaceFrontZ,
            `Weapon ${wid} on ${charId} (pitch=${cfg.pitch}, ads=${cfg.ads}, wallObs=${cfg.wallObs}) rear-most Z (${minWeaponZInTorso.toFixed(3)}) must stay strictly in front of character chest surface (${chestSurfaceFrontZ.toFixed(3)})`
          );

          // Verify character arms and bulb hands remain at normal (1, 1, 1) scale with zero finger-like forearm distortion
          assert.equal(rig.leftElbowPivot.scale.x, 1);
          assert.equal(rig.leftElbowPivot.scale.y, 1);
          assert.equal(rig.leftElbowPivot.scale.z, 1);
          assert.equal(rig.rightElbowPivot.scale.x, 1);
          assert.equal(rig.leftHandPivot.scale.x, 1);
          assert.equal(rig.leftHandPivot.scale.y, 1);
          assert.equal(rig.rightHandPivot.scale.x, 1);
        }
      }

      rig.dispose();
    }

    // Verify each of the 6 weapons produces a distinct holding stance & arm IK configuration in both combat and inspect poses
    const inspectRig = buildChameleonHumanoidRig('volt', 1);
    const combatWeaponSigs = new Set<string>();
    const inspectWeaponSigs = new Set<string>();

    for (const wid of WEAPON_ORDER) {
      assert.ok(WEAPON_HOLD_PROFILES[wid], `Weapon hold profile must exist for ${wid}`);
      inspectRig.weaponMount.clear();
      const prop = buildCompactHandheldWeaponProp(wid, true);
      inspectRig.weaponMount.add(prop);

      for (let s = 0; s < 10; s++) {
        updateChameleonRigAnimation(inspectRig, 'combat', 2.0 + s * 0.032, 0, 0, false, 0, 0, false, 0, 0, wid);
      }
      combatWeaponSigs.add(
        `${inspectRig.weaponMount.position.x.toFixed(3)}:${inspectRig.weaponMount.position.y.toFixed(3)}:${inspectRig.rightShoulderPivot.rotation.x.toFixed(3)}:${inspectRig.rightElbowPivot.rotation.x.toFixed(3)}`
      );

      for (let s = 0; s < 10; s++) {
        updateChameleonRigAnimation(inspectRig, 'inspect', 2.0 + s * 0.032, 0, 0, false, 0, 0, false, 0, 0, wid);
      }
      inspectWeaponSigs.add(
        `${inspectRig.weaponMount.position.x.toFixed(3)}:${inspectRig.weaponMount.rotation.y.toFixed(3)}:${inspectRig.rightShoulderPivot.rotation.x.toFixed(3)}:${inspectRig.leftShoulderPivot.rotation.x.toFixed(3)}`
      );
    }

    assert.equal(
      combatWeaponSigs.size,
      WEAPON_ORDER.length,
      'All 6 weapons must have distinct combat holding poses and arm IK angles'
    );
    assert.equal(
      inspectWeaponSigs.size,
      WEAPON_ORDER.length,
      'All 6 weapons must have distinct Lobby inspect holding poses and arm IK angles'
    );
    inspectRig.dispose();
  });

  it('implements Universal ADS without scope, 8-stage scope-entering animation, 2x & 4x optic attachments, sensitivity scaling, and drift-free FOV', () => {
    // 1. Verify Universal ADS works on ALL 6 weapons with 'none' (Iron Sights) equipped
    for (const wid of WEAPON_ORDER) {
      assert.ok(WEAPON_ADS_PROFILES[wid], `Weapon ADS profile must exist for ${wid}`);
      assert.equal(isOpticCompatibleWithWeapon(wid, 'none'), true);
      assert.equal(isOpticCompatibleWithWeapon(wid, 'scope_2x'), true);
      assert.equal(isOpticCompatibleWithWeapon(wid, 'scope_4x'), true);

      const ironState = createInitialADSControllerState(wid, 'none');
      for (let i = 0; i < 30; i++) {
        stepADSController(ironState, {
          dt: 0.016,
          rawAimInputDown: true,
          aimMode: 'hold',
          weaponId: wid,
          opticId: 'none',
          isReloading: false,
          isSprinting: false,
          isSliding: false,
          isDeadOrRespawning: false,
          equipTimerSec: 0,
        });
      }
      assert.equal(ironState.adsProgress, 1.0, `${wid} iron-sight ADS must reach 1.0`);
      assert.equal(
        ironState.overlayOpacity,
        0,
        `${wid} iron-sight ADS must NOT show a magnified scope overlay`
      );
      const ironScopeView = computeScopeViewState(ironState);
      assert.equal(ironScopeView.isScopeOverlayActive, false);
      assert.equal(ironScopeView.reticle.visible, false);

      // Verify Iron-Sight FOV decreases slightly from 90 -> 78 deg and sensitivity scales to 0.70x
      const hipFov = computeComposedCameraFOV({
        baseFov: 90,
        adsProgress: 0,
        opticId: 'none',
      });
      const ironAdsFov = computeComposedCameraFOV({
        baseFov: 90,
        adsProgress: 1.0,
        opticId: 'none',
      });
      assert.equal(hipFov, 90);
      assert.equal(ironAdsFov, 78);
      assert.equal(computeAimSensitivityMultiplier(0, 'none'), 1.0);
      assert.equal(computeAimSensitivityMultiplier(1.0, 'none'), 0.7);
    }

    // 2. Verify complete 8-stage Scope-Entering Animation progression & settle spring with 2x and 4x optics
    const m4Ads = createInitialADSControllerState('m4a1', 'scope_2x');
    const observedStages = new Set<string>([m4Ads.stage]);
    for (let step = 0; step < 60; step++) {
      stepADSController(m4Ads, {
        dt: 0.008,
        rawAimInputDown: true,
        aimMode: 'hold',
        weaponId: 'm4a1',
        opticId: 'scope_2x',
        isReloading: false,
        isSprinting: false,
        isSliding: false,
        isDeadOrRespawning: false,
        equipTimerSec: 0,
      });
      observedStages.add(m4Ads.stage);
    }
    assert.ok(observedStages.has('hip'));
    assert.ok(observedStages.has('initiating'));
    assert.ok(observedStages.has('raising'));
    assert.ok(observedStages.has('aligning'));
    assert.ok(observedStages.has('optic_align'));
    assert.ok(observedStages.has('acquiring'));
    assert.ok(observedStages.has('settling'));
    assert.ok(observedStages.has('aiming'));
    assert.equal(m4Ads.overlayOpacity, 1.0, '2x scope overlay must reach 1.0 opacity when acquired');

    // Release aim and verify 'releasing' stage and full return to 'hip'
    stepADSController(m4Ads, {
      dt: 0.016,
      rawAimInputDown: false,
      aimMode: 'hold',
      weaponId: 'm4a1',
      opticId: 'scope_2x',
      isReloading: false,
      isSprinting: false,
      isSliding: false,
      isDeadOrRespawning: false,
      equipTimerSec: 0,
    });
    assert.equal(m4Ads.stage, 'releasing');
    for (let step = 0; step < 30; step++) {
      stepADSController(m4Ads, {
        dt: 0.016,
        rawAimInputDown: false,
        aimMode: 'hold',
        weaponId: 'm4a1',
        opticId: 'scope_2x',
        isReloading: false,
        isSprinting: false,
        isSliding: false,
        isDeadOrRespawning: false,
        equipTimerSec: 0,
      });
    }
    assert.equal(m4Ads.stage, 'hip');
    assert.equal(m4Ads.adsProgress, 0);
    assert.equal(m4Ads.overlayOpacity, 0);
    assert.equal(m4Ads.hipCrosshairOpacity, 1);

    // 3. Verify 2x vs 4x Magnification FOV & Sensitivity Multipliers (1.00 / 0.70 / 0.50 / 0.35)
    const fovIron = getTargetADSFov('none', 90);
    const fov2x = getTargetADSFov('scope_2x', 90);
    const fov4x = getTargetADSFov('scope_4x', 90);
    assert.ok(fov2x < fovIron, `2x FOV (${fov2x}) must be narrower than Iron Sights (${fovIron})`);
    assert.ok(fov4x < fov2x, `4x FOV (${fov4x}) must be narrower than 2x FOV (${fov2x})`);
    assert.equal(OPTIC_REGISTRY.none.magnification, 1.0);
    assert.equal(OPTIC_REGISTRY.scope_2x.magnification, 2.0);
    assert.equal(OPTIC_REGISTRY.scope_4x.magnification, 4.0);

    assert.equal(computeAimSensitivityMultiplier(0, 'scope_4x'), 1.0);
    assert.equal(computeAimSensitivityMultiplier(1.0, 'none'), 0.7);
    assert.equal(computeAimSensitivityMultiplier(1.0, 'scope_2x'), 0.5);
    assert.equal(computeAimSensitivityMultiplier(1.0, 'scope_4x'), 0.35);

    // 4. Verify 3D Scope Attachment mounting & hot-swapping on WeaponViewModelRig without rebuilding weapon
    const dummyTex = new THREE.Texture();
    for (const wid of WEAPON_ORDER) {
      const rig = buildDetailedWeaponViewModel(wid, dummyTex);
      setWeaponRigOpticAttachment(rig, 'none');
      assert.equal(rig.equippedOpticId, 'none');
      assert.equal(rig.opticMount.children.length, 0);
      assert.equal(rig.ironSightsGroup.visible, true);

      setWeaponRigOpticAttachment(rig, 'scope_2x');
      assert.equal(rig.equippedOpticId, 'scope_2x');
      assert.equal(rig.opticMount.children.length, 1);
      assert.equal(rig.ironSightsGroup.visible, false);

      setWeaponRigOpticAttachment(rig, 'scope_4x');
      assert.equal(rig.equippedOpticId, 'scope_4x');
      assert.equal(rig.opticMount.children.length, 1);
      assert.equal(rig.ironSightsGroup.visible, false);
    }

    // 5. Verify Toggle-to-Aim mode and clean cancellation on reload, sprint, weapon switch, and death
    const sim = createSimulationState();
    sim.player.weaponOptics.m4a1 = 'scope_4x';
    // Press once in toggle mode -> enters ADS
    stepSimulation(
      sim,
      0.016,
      createNeutralInput({ adsHeld: true, aimMode: 'toggle' }),
      'normal',
      true
    );
    for (let i = 0; i < 30; i++) {
      stepSimulation(
        sim,
        0.016,
        createNeutralInput({ adsHeld: false, aimMode: 'toggle' }),
        'normal',
        true
      );
    }
    assert.equal(sim.player.isAds, true, 'Toggle ADS must stay latched after releasing aim button');
    assert.ok(sim.player.adsBlend > 0.99, 'Toggle ADS must reach full ADS');
    const reticle4x = computeReticleRenderState(sim.player.adsState);
    assert.equal(reticle4x.visible, true);
    assert.equal(reticle4x.magnificationLabel, '4.0X OPTIC');

    // Trigger reload while toggle-aimed -> must cancel ADS immediately
    sim.player.weapons.m4a1.mag = 10;
    stepSimulation(
      sim,
      0.016,
      createNeutralInput({ reloadPressed: true, aimMode: 'toggle' }),
      'normal',
      true
    );
    assert.equal(sim.player.isReloading, true);
    assert.equal(sim.player.isAds, false, 'Reloading must cancel ADS');

    // Verify 25 rapid press/release cycles cause zero FOV or pose drift
    const driftState = createInitialADSControllerState('ak47', 'scope_2x');
    for (let cycle = 0; cycle < 25; cycle++) {
      for (let i = 0; i < 8; i++) {
        stepADSController(driftState, {
          dt: 0.016,
          rawAimInputDown: true,
          aimMode: 'hold',
          weaponId: 'ak47',
          opticId: 'scope_2x',
          isReloading: false,
          isSprinting: false,
          isSliding: false,
          isDeadOrRespawning: false,
          equipTimerSec: 0,
        });
      }
      for (let i = 0; i < 20; i++) {
        stepADSController(driftState, {
          dt: 0.016,
          rawAimInputDown: false,
          aimMode: 'hold',
          weaponId: 'ak47',
          opticId: 'scope_2x',
          isReloading: false,
          isSprinting: false,
          isSliding: false,
          isDeadOrRespawning: false,
          equipTimerSec: 0,
        });
      }
    }
    const finalRestFov = computeComposedCameraFOV({
      baseFov: 90,
      adsProgress: driftState.adsProgress,
      opticId: 'scope_2x',
    });
    const finalRestPose = computeWeaponADSPose(driftState);
    assert.equal(finalRestFov, 90, 'Repeated ADS cycles must never drift base FOV');
    assert.equal(finalRestPose.weaponOffset[0], 0);
    assert.equal(finalRestPose.weaponOffset[1], 0);
    assert.equal(finalRestPose.weaponOffset[2], 0);
  });

  it('implements the complete Tactical Backpack, Weapon Storage, 5-Rail Attachment, World Loot, and Persistence system', () => {
    const sim = createSimulationState();
    const player = sim.player;
    const inv = player.inventory;

    // 1. Initial Inventory State & Capacity Calculation
    assert.ok(inv, 'Player must have an authoritative inventory state');
    assert.equal(inv.maxSlots, 24, 'Default Level 2 Field Pack must grant 24 slots');
    assert.equal(inv.maxWeightKg, 45.0, 'Default Level 2 Field Pack must grant 45.0 kg capacity');
    const initCap = computeInventoryCapacity(inv);
    assert.ok(initCap.usedSlots >= 7, 'Initial backpack must contain starter tactical items');
    assert.ok(initCap.currentWeightKg > 10 && initCap.currentWeightKg <= initCap.maxWeightKg);

    // 2. Weapon Storage & Moving / Swapping Weapons Between Storage and Primary/Secondary/Sidearm Slots
    assert.ok(inv.storedWeapons.length >= 2, 'Backpack weapon rack must hold multiple stored weapons');
    const mp5Stored = inv.storedWeapons.find((w) => w.weaponId === 'mp5');
    assert.ok(mp5Stored, 'MP5-SD must be in initial backpack weapon storage');
    const origPrimaryId = inv.equippedWeapons.primary.instanceId;
    assert.ok(origPrimaryId, 'Primary weapon slot must be occupied initially');

    // Equip MP5 from storage into Primary slot (swaps M4A1 into storage without weapon loss)
    const equipMp5Res = equipWeaponFromStorage(player, mp5Stored.instanceId, 'primary');
    assert.equal(equipMp5Res.ok, true, equipMp5Res.message);
    assert.equal(inv.equippedWeapons.primary.weaponId, 'mp5');
    assert.equal(player.loadoutWeapons[0], 'mp5', 'Active player loadoutWeapons[0] must sync with Primary slot');
    assert.ok(
      inv.storedWeapons.some((w) => w.instanceId === origPrimaryId && w.weaponId === 'm4a1'),
      'Replaced M4A1 must be safely stored in backpack weapon rack without loss'
    );

    // Reject placing a primary rifle/SMG into the Sidearm holster
    const invalidSidearmRes = equipWeaponFromStorage(player, origPrimaryId, 'sidearm');
    assert.equal(invalidSidearmRes.ok, false, 'Non-sidearm weapon must be rejected from sidearm holster');

    // Swap Primary (mp5) back with M4A1 from storage
    const restoreM4Res = equipWeaponFromStorage(player, origPrimaryId, 'primary');
    assert.equal(restoreM4Res.ok, true);
    assert.equal(inv.equippedWeapons.primary.weaponId, 'm4a1');

    // Swap Primary and Secondary weapon slots directly
    const swapSlotsRes = swapEquippedWeaponSlots(player, 'primary', 'secondary');
    assert.equal(swapSlotsRes.ok, true);
    assert.equal(inv.equippedWeapons.primary.weaponId, 'awp');
    assert.equal(inv.equippedWeapons.secondary.weaponId, 'm4a1');
    // Swap back so M4A1 is primary
    swapEquippedWeaponSlots(player, 'primary', 'secondary');
    assert.equal(inv.equippedWeapons.primary.weaponId, 'm4a1');

    // Prevent unequipping the last remaining weapon when trying to empty primary/secondary
    const moveSecRes = moveWeaponSlotToStorage(player, 'secondary');
    assert.equal(moveSecRes.ok, true);

    // 3. 5-Rail Weapon Attachment System & Compatibility Validation
    assert.equal(isAttachmentCompatibleWithWeapon('att_optic_8x', 'awp').compatible, true);
    assert.equal(isAttachmentCompatibleWithWeapon('att_optic_8x', 'deagle').compatible, false);
    assert.equal(isAttachmentCompatibleWithWeapon('att_muzzle_choke', 'spas12').compatible, true);
    assert.equal(isAttachmentCompatibleWithWeapon('att_muzzle_choke', 'm4a1').compatible, false);

    // Find 4x ACOG Scope in backpack and equip onto M4A1 (Primary)
    const acogSlotIdx = inv.slots.findIndex((s) => s?.itemId === 'att_optic_4x');
    assert.ok(acogSlotIdx >= 0, '4x ACOG must exist in starter backpack');
    const equipAcogRes = equipAttachmentFromBackpackSlot(
      player,
      acogSlotIdx,
      inv.equippedWeapons.primary.instanceId
    );
    assert.equal(equipAcogRes.ok, true);
    assert.equal(inv.equippedWeapons.primary.attachments.optic, 'att_optic_4x');
    assert.equal(
      player.weaponOptics.m4a1,
      'scope_4x',
      'Equipping 4x ACOG attachment must synchronize player.weaponOptics for Universal ADS'
    );

    // Swap 4x ACOG with 2x Tactical Optic from backpack -> old 4x ACOG returns to backpack slot
    const scope2xSlotIdx = inv.slots.findIndex((s) => s?.itemId === 'att_optic_2x');
    assert.ok(scope2xSlotIdx >= 0);
    const swapOpticRes = equipAttachmentFromBackpackSlot(
      player,
      scope2xSlotIdx,
      inv.equippedWeapons.primary.instanceId
    );
    assert.equal(swapOpticRes.ok, true);
    assert.equal(inv.equippedWeapons.primary.attachments.optic, 'att_optic_2x');
    assert.equal(player.weaponOptics.m4a1, 'scope_2x');
    assert.equal(
      inv.slots[scope2xSlotIdx]?.itemId,
      'att_optic_4x',
      'Swapped-out 4x ACOG must be placed into the backpack slot without loss'
    );

    // Remove optic from M4A1 -> restores Iron Sights ('none') and places 2x Optic in backpack
    const removeOpticRes = removeAttachmentFromWeapon(
      player,
      inv.equippedWeapons.primary.instanceId,
      'optic'
    );
    assert.equal(removeOpticRes.ok, true);
    assert.equal(inv.equippedWeapons.primary.attachments.optic, undefined);
    assert.equal(
      player.weaponOptics.m4a1,
      'none',
      'Removing optic attachment must restore weapon to Iron Sights (none)'
    );

    // 4. Extended Magazine Attachment & Reload Integration (No silent magazine refill on equip)
    const m4Instance = findWeaponInstanceForWeaponId(inv, 'm4a1')!;
    const baseM4Stats = computeEffectiveWeaponStats('m4a1', m4Instance.attachments);
    assert.equal(baseM4Stats.magSize, 30);

    player.weapons.m4a1.mag = 25;
    player.weapons.m4a1.reserve = 90;
    const extMagSlotIdx = inv.slots.findIndex((s) => s?.itemId === 'att_mag_ext_ar');
    assert.ok(extMagSlotIdx >= 0, 'Extended AR Mag must be in starter backpack');
    const equipMagRes = equipAttachmentFromBackpackSlot(
      player,
      extMagSlotIdx,
      m4Instance.instanceId
    );
    assert.equal(equipMagRes.ok, true);
    const modM4Stats = computeEffectiveWeaponStats('m4a1', m4Instance.attachments);
    assert.equal(modM4Stats.magSize, 40, 'Extended AR Magazine must increase M4A1 magSize from 30 to 40');
    assert.equal(
      player.weapons.m4a1.mag,
      25,
      'Equipping an extended magazine must NOT silently refill current mag ammo before reloading'
    );

    // Trigger reload and step simulation past reload completion -> fills to 40 rounds
    for (const pk of sim.pickups) {
      pk.active = false;
      pk.respawnTimerMs = 99999;
    }
    player.activeWeapon = 'm4a1';
    const reserveBeforeReload = player.weapons.m4a1.reserve;
    stepSimulation(sim, 0.016, createNeutralInput({ reloadPressed: true }), 'normal', true);
    assert.equal(player.isReloading, true);
    for (let i = 0; i < 50; i++) {
      stepSimulation(sim, 0.05, createNeutralInput(), 'normal', true);
    }
    assert.equal(player.isReloading, false);
    assert.equal(player.weapons.m4a1.mag, 40, 'Reloading with Extended Mag must fill magazine to 40');
    assert.equal(
      player.weapons.m4a1.reserve,
      reserveBeforeReload - 15,
      'Reloading 15 rounds must deduct 15 from reserve'
    );

    // 5. Stack Splitting & Merging in Backpack Grid
    const ammoSlotIdx = inv.slots.findIndex(
      (s) => s?.itemId === 'ammo_556' && s.quantity >= 20
    );
    assert.ok(ammoSlotIdx >= 0);
    const initialQty = inv.slots[ammoSlotIdx]!.quantity;
    const splitRes = splitBackpackStack(player, ammoSlotIdx, 25);
    assert.equal(splitRes.ok, true);
    assert.equal(inv.slots[ammoSlotIdx]!.quantity, initialQty - 25);
    const splitNewIdx = inv.slots.findIndex(
      (s, idx) => idx !== ammoSlotIdx && s?.itemId === 'ammo_556' && s.quantity === 25
    );
    assert.ok(splitNewIdx >= 0, 'Split stack must occupy a new backpack slot');

    // Merge split stack back into original stack
    const mergeRes = moveBackpackSlotToSlot(player, splitNewIdx, ammoSlotIdx);
    assert.equal(mergeRes.ok, true);
    assert.equal(inv.slots[ammoSlotIdx]!.quantity, initialQty);
    assert.equal(inv.slots[splitNewIdx], null);

    // 6. Consumable Usage & Backpack Tier Upgrade
    player.hp = 60;
    const medkitIdx = inv.slots.findIndex((s) => s?.itemId === 'med_ifak');
    assert.ok(medkitIdx >= 0);
    const healRes = useOrEquipBackpackSlotItem(player, medkitIdx);
    assert.equal(healRes.ok, true);
    assert.ok(player.hp > 60, 'IFAK must restore player HP');

    // Add Level 3 Heavy Assault Pack and equip it -> increases maxSlots to 32 and maxWeightKg to 60.0
    const addLv3Res = addItemToBackpack(player, 'gear_backpack_lv3', 1);
    assert.equal(addLv3Res.ok, true);
    const lv3Idx = inv.slots.findIndex((s) => s?.itemId === 'gear_backpack_lv3');
    const equipPackRes = useOrEquipBackpackSlotItem(player, lv3Idx);
    assert.equal(equipPackRes.ok, true);
    assert.equal(inv.maxSlots, 32);
    assert.ok(inv.maxWeightKg >= 55.0);

    // 7. Drag-and-Drop Validation & Atomic Rollback on Invalid Target
    const ammoItem = inv.slots[ammoSlotIdx]!;
    const dragSource = {
      kind: 'backpack_slot' as const,
      slotIndex: ammoSlotIdx,
      instanceId: ammoItem.instanceId,
      itemId: ammoItem.itemId,
    };
    const validTarget = validateInventoryDropTarget(player, dragSource, {
      kind: 'drop_world',
    });
    assert.equal(validTarget.valid, true);

    const invalidTarget = validateInventoryDropTarget(player, dragSource, {
      kind: 'weapon_slot',
      weaponSlot: 'primary',
    });
    assert.equal(invalidTarget.valid, false);
    const failedDrop = executeInventoryDragDrop(sim, dragSource, {
      kind: 'weapon_slot',
      weaponSlot: 'primary',
    });
    assert.equal(failedDrop.ok, false);
    assert.equal(
      inv.slots[ammoSlotIdx]?.quantity,
      initialQty,
      'Failed drag-and-drop must roll back cleanly without losing items'
    );

    // 8. World Loot Drop & Proximity Pickup
    const initialLootCount = sim.worldLoot.length;
    const dropLootRes = dropInventoryItemToWorld(sim, dragSource);
    assert.equal(dropLootRes.ok, true);
    assert.equal(sim.worldLoot.length, initialLootCount + 1);
    assert.equal(inv.slots[ammoSlotIdx], null);

    // Move player to dropped loot and pick it up
    const droppedLoot = sim.worldLoot[sim.worldLoot.length - 1];
    player.x = droppedLoot.x;
    player.z = droppedLoot.z;
    const near = getNearbyWorldLoot(sim, 3.5);
    assert.ok(near.some((l) => l.lootId === droppedLoot.lootId));

    const pickupRes = pickupWorldLootItem(sim, droppedLoot.lootId);
    assert.equal(pickupRes.ok, true);
    assert.equal(sim.worldLoot.length, initialLootCount);

    // 9. Versioned Serialization & Deserialization
    const serialized = serializeInventoryState(inv);
    const restored = deserializeInventoryState(serialized);
    assert.ok(restored, 'Deserialized inventory state must be valid');
    assert.equal(restored!.maxSlots, 32);
    assert.equal(
      restored!.equippedWeapons.primary.attachments.magazine,
      'att_mag_ext_ar',
      'Deserialized inventory must preserve weapon attachments'
    );
  });
});




