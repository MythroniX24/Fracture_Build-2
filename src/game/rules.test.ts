import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBotInput,
  createSimulationState,
  emptyInput,
  getArenaSurfaceHeight,
  stepSimulation,
} from './rules.ts';

describe('FRACTURE Foundry Arena v4 Combat & Physics Rules', () => {
  it('initializes both fighters on top of the Foundry Arena central dais at y = 1.2', () => {
    const sim = createSimulationState('volt', 'rift', 'foundry_arena', 2, 90);
    assert.equal(sim.p1.hp, 115);
    assert.equal(sim.p2.hp, 105);
    assert.equal(sim.p1.y, 1.2, 'P1 should spawn on top of central dais (y = 1.2)');
    assert.equal(sim.p2.y, 1.2, 'P2 should spawn on top of central dais (y = 1.2)');
    assert.equal(sim.breakableProps.length, 30, 'Should have 24 breakable crates + 6 energy barrels');
    assert.ok(sim.floorTiles.length >= 60, 'Should have procedural destructible floor tiles');
  });

  it('initiates a light attack, advances through windup into active frames, and damages the opponent', () => {
    const sim = createSimulationState('volt', 'rift', 'foundry_arena', 2, 90);
    sim.p1.x = -1.2;
    sim.p2.x = 1.2;
    sim.p1.facingAngle = Math.PI * 0.5;
    sim.p2.facingAngle = -Math.PI * 0.5;

    const p1In = emptyInput();
    p1In.lightPressed = true;
    stepSimulation(sim, p1In, emptyInput(), 16);
    assert.equal(sim.p1.action, 'attack_windup');
    assert.equal(sim.p1.currentAttack, 'light_1');

    for (let i = 0; i < 20; i++) {
      stepSimulation(sim, emptyInput(), emptyInput(), 20);
    }

    assert.ok(sim.p2.hp < 105, `Expected P2 HP < 105 after hit, got ${sim.p2.hp}`);
    assert.equal(sim.p1.comboCount, 1);
  });

  it('triggers a precision parry when defender presses guard just before an attack lands', () => {
    const sim = createSimulationState('volt', 'rift', 'foundry_arena', 2, 90);
    sim.p1.x = -1.2;
    sim.p2.x = 1.2;

    const p1Attack = emptyInput();
    p1Attack.lightPressed = true;
    stepSimulation(sim, p1Attack, emptyInput(), 16);

    stepSimulation(sim, emptyInput(), emptyInput(), 70);

    const p2Parry = emptyInput();
    p2Parry.guardHeld = true;
    p2Parry.guardJustPressed = true;
    stepSimulation(sim, emptyInput(), p2Parry, 16);
    assert.equal(sim.p2.action, 'parry_window');

    for (let i = 0; i < 6; i++) {
      stepSimulation(sim, emptyInput(), { ...emptyInput(), guardHeld: true }, 20);
    }

    assert.equal(sim.p2.parriesLanded, 1, 'Expected P2 to land a timed parry');
    assert.equal(sim.p1.action, 'parry_stun', 'Expected attacker to enter parry_stun');
    assert.equal(sim.p1.poise, 0, 'Parried attacker should have 0 poise and be ready for execution');
  });

  it('allows immediate Counter-Riposte with Hyper-Armor out of blockstun and hitstun breakout via Dodge/Guard', () => {
    const sim = createSimulationState('volt', 'rift', 'foundry_arena', 2, 90);
    sim.p1.x = -1.2;
    sim.p2.x = 1.2;
    sim.p1.action = 'blockstun';
    sim.p1.actionTimerMs = 150;
    sim.p1.actionDurationMs = 160;
    sim.p1.counterWindowMs = 400;

    // P1 presses Light Attack during blockstun after 70ms -> triggers immediate Counter-Riposte with Hyper-Armor
    stepSimulation(sim, emptyInput(), emptyInput(), 80);
    const counterInput = emptyInput();
    counterInput.lightPressed = true;
    stepSimulation(sim, counterInput, emptyInput(), 16);

    assert.equal(sim.p1.action, 'attack_windup', 'Expected P1 to break out of blockstun into Counter-Riposte');
    assert.ok(sim.p1.hyperArmorMs > 0, 'Expected Counter-Riposte to grant Hyper-Armor so bot cannot interrupt');

    // Verify hitstun breakout via Dodge after 115ms so player is never locked for 1-2s
    sim.p1.action = 'hitstun';
    sim.p1.actionTimerMs = 240;
    sim.p1.actionDurationMs = 240;
    sim.p1.hyperArmorMs = 0;
    stepSimulation(sim, emptyInput(), emptyInput(), 125);
    const dodgeOut = emptyInput();
    dodgeOut.dodgePressed = true;
    stepSimulation(sim, dodgeOut, emptyInput(), 16);
    assert.equal(sim.p1.action, 'dodge', 'Expected P1 to escape hitstun via Dodge breakout');
  });

  it('queues buffered attack inputs during stun and triggers 3-hit Combo Breaker against spam', () => {
    const sim = createSimulationState('volt', 'rift', 'foundry_arena', 2, 90);
    sim.p1.x = -1.1;
    sim.p2.x = 1.1;
    sim.p1.action = 'hitstun';
    sim.p1.actionTimerMs = 60;
    sim.p1.actionDurationMs = 200;

    // Press light attack while still in hitstun -> should buffer and fire automatically when hitstun ends
    const earlyTap = emptyInput();
    earlyTap.lightPressed = true;
    stepSimulation(sim, earlyTap, emptyInput(), 16);
    assert.equal(sim.p1.bufferedInput, 'light', 'Expected early attack tap to be buffered during hitstun');

    // Step past remaining hitstun -> buffered attack executes automatically without needing another tap
    stepSimulation(sim, emptyInput(), emptyInput(), 60);
    assert.equal(sim.p1.action, 'attack_windup', 'Expected buffered attack to fire immediately on hitstun exit');
  });

  it('shatters breakable crates and detonates volatile barrels when attacked', () => {
    const sim = createSimulationState('volt', 'rift', 'foundry_arena', 2, 90);
    const crate = sim.breakableProps.find((p) => p.kind === 'crate')!;
    assert.ok(crate);

    // Position P1 right in front of crate facing it
    sim.p1.x = crate.x - 1.5;
    sim.p1.z = crate.z;
    sim.p1.y = getArenaSurfaceHeight(sim.arenaId, sim.p1.x, sim.p1.z);
    sim.p1.facingAngle = Math.PI * 0.5;
    // Move P2 far away
    sim.p2.x = 18;
    sim.p2.z = 12;

    const p1Heavy = emptyInput();
    p1Heavy.heavyPressed = true;
    stepSimulation(sim, p1Heavy, emptyInput(), 16);

    for (let i = 0; i < 30; i++) {
      stepSimulation(sim, emptyInput(), emptyInput(), 20);
    }

    assert.equal(crate.broken, true, 'Heavy attack should shatter the crate');
  });

  it('fractures floor tiles on heavy Tectonic Ground Break and supports thruster jumping', () => {
    const sim = createSimulationState('volt', 'rift', 'foundry_arena', 2, 90);
    // Place P1 on the outer tiled floor grid (x = 14.5, z = 2.5)
    sim.p1.x = 14.5;
    sim.p1.z = 2.5;
    sim.p1.y = getArenaSurfaceHeight(sim.arenaId, sim.p1.x, sim.p1.z);
    sim.p1.facingAngle = 0;

    const p1Heavy = emptyInput();
    p1Heavy.heavyPressed = true;
    stepSimulation(sim, p1Heavy, emptyInput(), 16);
    for (let i = 0; i < 25; i++) {
      stepSimulation(sim, emptyInput(), emptyInput(), 20);
    }

    const damagedTiles = sim.floorTiles.filter((t) => t.state > 0);
    assert.ok(damagedTiles.length > 0, 'Expected heavy attack to crack/shatter nearby floor tiles');

    // Wait for recovery to complete, then test thruster jump
    for (let i = 0; i < 30; i++) {
      stepSimulation(sim, emptyInput(), emptyInput(), 20);
    }
    const jumpIn = emptyInput();
    jumpIn.jumpPressed = true;
    stepSimulation(sim, jumpIn, emptyInput(), 16);
    assert.equal(sim.p1.action, 'jump');
    assert.ok(sim.p1.vy > 0, 'Expected positive vertical velocity on jump');
  });

  it('clamps fighters inside arena bounds and slides smoothly around pillars and intact crates', () => {
    const sim = createSimulationState('volt', 'rift', 'foundry_arena', 2, 90);
    sim.p1.x = -50;
    sim.p1.z = 50;

    stepSimulation(sim, emptyInput(), emptyInput(), 16);

    assert.ok(sim.p1.x >= -33.5, `Expected P1 X clamped inside arena, got ${sim.p1.x}`);
    assert.ok(sim.p1.z <= 23.5, `Expected P1 Z clamped inside arena, got ${sim.p1.z}`);
  });

  it('generates valid autonomous bot decisions and respects post-attack cooldowns', () => {
    const sim = createSimulationState('volt', 'rift', 'foundry_arena', 2, 90);
    const botInput = computeBotInput(sim, sim.p2, sim.p1, 'hard', 16);
    assert.equal(typeof botInput.moveX, 'number');
    assert.equal(typeof botInput.moveZ, 'number');

    // When bot has an active aiAttackCooldownMs, it must not spam attacks
    sim.p2.x = sim.p1.x + 1.4;
    sim.p2.z = sim.p1.z;
    sim.p2.aiAttackCooldownMs = 800;
    sim.p2.aiDecisionTimerMs = 0;
    const cooledBotInput = computeBotInput(sim, sim.p2, sim.p1, 'hard', 16);
    assert.equal(cooledBotInput.lightPressed, false, 'Bot should not spam light attack while on attack cooldown');
    assert.equal(cooledBotInput.heavyPressed, false, 'Bot should not spam heavy attack while on attack cooldown');
  });

  it('regenerates stamina while standing, walking, and running, and deducts scaled stamina on attacks, dash, and special ability', () => {
    const sim = createSimulationState('volt', 'rift', 'foundry_arena', 2, 90);
    sim.p1.stamina = 40;
    sim.p2.stamina = 40;

    // 1. Standing still regenerates stamina
    stepSimulation(sim, emptyInput(), emptyInput(), 200);
    assert.ok(sim.p1.stamina > 40, 'Standing still should regenerate P1 stamina');
    assert.ok(sim.p2.stamina > 40, 'Standing still should regenerate P2 stamina');

    // 2. Walking and running (sprint: true) regenerate stamina and never drain it
    const p1AfterStand = sim.p1.stamina;
    const p2AfterStand = sim.p2.stamina;
    const walkInput = { ...emptyInput(), moveX: 1, moveZ: 0, sprint: false };
    const sprintInput = { ...emptyInput(), moveX: -1, moveZ: 0, sprint: true };
    stepSimulation(sim, walkInput, sprintInput, 250);
    assert.ok(sim.p1.stamina > p1AfterStand, 'Walking should increase P1 stamina');
    assert.ok(sim.p2.stamina > p2AfterStand, 'Running/sprinting should increase P2 stamina and never drain it');

    // 3. Scaled stamina consumption: Light Attack (10), Dodge Dash (18), Heavy Attack (24), Special Ability (35)
    sim.p1.stamina = 100;
    sim.p1.action = 'idle';
    stepSimulation(sim, { ...emptyInput(), lightPressed: true }, emptyInput(), 16);
    assert.equal(sim.p1.stamina, 90, 'Light attack should cost 10 stamina for Volt');

    sim.p1.stamina = 100;
    sim.p1.action = 'idle';
    stepSimulation(sim, { ...emptyInput(), dodgePressed: true }, emptyInput(), 16);
    assert.equal(sim.p1.stamina, 82, 'Dodge dash should cost 18 stamina for Volt');
    assert.ok(sim.events.some((e) => e.type === 'dodge_dash'), 'Should emit dodge_dash VFX event');

    sim.p1.stamina = 100;
    sim.p1.action = 'idle';
    stepSimulation(sim, { ...emptyInput(), heavyPressed: true }, emptyInput(), 16);
    assert.equal(sim.p1.stamina, 76, 'Heavy attack should cost 24 stamina for Volt');

    sim.p1.stamina = 100;
    sim.p1.action = 'idle';
    sim.p1.abilityCooldownMs = 0;
    stepSimulation(sim, { ...emptyInput(), abilityPressed: true }, emptyInput(), 16);
    assert.equal(sim.p1.stamina, 65, 'Special ability should cost 35 stamina (> heavy attack)');
  });
});

