import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FOOTSTEP_SOUND_MANIFEST,
  type FootstepCategory,
  soundEngine,
} from '../audio/soundEngine.ts';
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
  computeBallisticImpactMarkPose,
  computeWeaponWallObstruction,
  createSimulationState,
  getMatchLeaderboard,
  getScopeSensitivityMultiplier,
  getSurfaceMaterialAt,
  handleWeaponSlotClick,
  hasClearLineOfSight,
  resolveEntityCollisions,
  setPlayerLoadoutPair,
  stepSimulation,
  switchPlayerWeapon,
} from './rules.ts';

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

    // Full scope (adsBlend = 1) should lower sensitivity, with bigger scopes having lower sensitivity
    const awpSens = getScopeSensitivityMultiplier('awp', 1); // 8.0x scope (adsFov 22)
    const m4Sens = getScopeSensitivityMultiplier('m4a1', 1); // 2.0x acog (adsFov 46)
    const akSens = getScopeSensitivityMultiplier('ak47', 1); // 1.8x reflex (adsFov 48)
    const mp5Sens = getScopeSensitivityMultiplier('mp5', 1); // 1.5x holo (adsFov 52)
    const deagleSens = getScopeSensitivityMultiplier('deagle', 1); // 1.4x (adsFov 54)
    const spasSens = getScopeSensitivityMultiplier('spas12', 1); // 1.35x (adsFov 55)

    assert.ok(awpSens < m4Sens, 'AWP 8x scope must have lower sensitivity than M4A1 2x scope');
    assert.ok(m4Sens < akSens, 'M4A1 2x scope must have lower sensitivity than AK-47 reflex');
    assert.ok(akSens < mp5Sens, 'AK-47 reflex must have lower sensitivity than MP5 holo');
    assert.ok(mp5Sens < deagleSens, 'MP5 holo must have lower sensitivity than Deagle');
    assert.ok(deagleSens < spasSens, 'Deagle must have lower sensitivity than SPAS-12');
    assert.ok(spasSens < 0.7, 'All scoped weapons must reduce sensitivity below hipfire');

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

    // 3. Configure responsive 100% default firing sensitivity separate from camera sensitivity
    assert.equal(DEFAULT_SETTINGS.fireSensitivity, 1.0);
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
      assert.equal(bannedPattern.test(c.bio), false, `Roster bio must not match banned pattern`);
    }
    for (const pal of SORTED_COLOR_PALETTES) {
      assert.equal(bannedPattern.test(pal.label), false);
      assert.equal(bannedPattern.test(pal.subtitle), false);
      for (const sw of pal.swatches) {
        assert.equal(bannedPattern.test(sw.label), false);
      }
    }
    for (const d of paintStorage.getDesigns()) {
      assert.equal(bannedPattern.test(d.name), false, `Starter design ${d.name} must not match banned pattern`);
    }
  });
});


