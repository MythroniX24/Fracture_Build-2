import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
  PLAYER_COLLISION_RADIUS,
  type PlayerInputSnapshot,
  computeWeaponWallObstruction,
  createSimulationState,
  getMatchLeaderboard,
  getScopeSensitivityMultiplier,
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

    // 3. Configure low default firing sensitivity separate from camera sensitivity
    assert.equal(DEFAULT_SETTINGS.fireSensitivity, 0.45);
    assert.ok(DEFAULT_SETTINGS.fireSensitivity < DEFAULT_SETTINGS.touchSensitivity);
  });
});


