import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSimulationState,
  createEmptyInput,
  stepSimulation,
  resetRoundPositions,
  checkSpatialHit,
} from './rules.ts';
import { ARENA_REGISTRY, CHARACTER_REGISTRY } from './config.ts';
import { BotAIController } from './ai.ts';

test('Character definitions for VOLT and RIFT are distinct and properly configured', () => {
  const volt = CHARACTER_REGISTRY.volt;
  const rift = CHARACTER_REGISTRY.rift;

  assert.ok(volt.stats.maxHp > rift.stats.maxHp, 'VOLT should have higher max HP than RIFT');
  assert.ok(rift.stats.runSpeed > volt.stats.runSpeed, 'RIFT should move faster than VOLT');
  assert.ok(volt.attacks.heavy.damage > rift.attacks.heavy.damage, 'VOLT heavy attack should deal more damage');
  assert.ok(rift.attacks.light.startup < volt.attacks.light.startup, 'RIFT light attack should have faster startup');
});

test('Spatial hit detection validates range, frontal arc cone, and single-hit per swing', () => {
  const sim = createSimulationState('volt', 'rift', 'iron_fortress', 2, 90);
  // Place fighters within melee range facing each other
  sim.p1.x = -1.0;
  sim.p1.z = 0;
  sim.p1.facingAngle = Math.PI / 2; // facing +X
  sim.p2.x = 0.8;
  sim.p2.z = 0;
  sim.p2.facingAngle = -Math.PI / 2; // facing -X

  const initialHp = sim.p2.hp;
  const p1Input = createEmptyInput();
  p1Input.lightAttackJustPressed = true;

  // Frame 1: trigger light attack
  stepSimulation(sim, p1Input, createEmptyInput(), 0.016);
  assert.equal(sim.p1.actionState, 'light_startup');

  // Step through startup and active frames
  for (let i = 0; i < 30; i++) {
    stepSimulation(sim, createEmptyInput(), createEmptyInput(), 0.016);
  }

  assert.equal(
    sim.p2.hp,
    initialHp - CHARACTER_REGISTRY.volt.attacks.light.damage,
    'Defender should take exact light attack damage once'
  );
  assert.equal(sim.p1.attacksLanded, 1, 'Single swing should only register one hit');
});

test('Input buffering queues attack during active/recovery frames and chains 3-hit combo', () => {
  const sim = createSimulationState('rift', 'volt', 'iron_fortress');
  sim.p1.x = -0.8;
  sim.p1.z = 0;
  sim.p1.facingAngle = Math.PI / 2;
  sim.p2.x = 0.8;
  sim.p2.z = 0;
  sim.p2.facingAngle = -Math.PI / 2;

  // Trigger 1st Light Attack
  const p1Strike1 = createEmptyInput();
  p1Strike1.lightAttackJustPressed = true;
  stepSimulation(sim, p1Strike1, createEmptyInput(), 0.02);
  assert.equal(sim.p1.actionState, 'light_startup');
  assert.equal(sim.p1.comboStep, 0);

  // Advance into active frames so 1st hit lands
  for (let i = 0; i < 10; i++) {
    stepSimulation(sim, createEmptyInput(), createEmptyInput(), 0.02);
  }
  assert.equal(sim.p1.attacksLanded, 1);

  // Queue 2nd Light Attack while still in active/early recovery
  const p1BufferStrike2 = createEmptyInput();
  p1BufferStrike2.lightAttackJustPressed = true;
  stepSimulation(sim, p1BufferStrike2, createEmptyInput(), 0.02);

  // Advance frames and confirm buffered 2nd strike fires and increments comboStep to 1
  let sawComboStep1 = false;
  for (let i = 0; i < 12; i++) {
    stepSimulation(sim, createEmptyInput(), createEmptyInput(), 0.02);
    if (sim.p1.comboStep === 1 && sim.p1.actionState === 'light_startup') {
      sawComboStep1 = true;
    }
  }
  assert.equal(sawComboStep1, true, 'Buffered light attack should chain into combo step 1');
});

test('Out-of-range or facing-away attacks miss spatially', () => {
  const arena = ARENA_REGISTRY.iron_fortress;
  const sim = createSimulationState('volt', 'rift', 'iron_fortress');
  sim.p1.x = 0;
  sim.p1.z = 0;
  sim.p1.facingAngle = Math.PI / 2; // +X

  // Target behind attacker (-X)
  const hitBehind = checkSpatialHit(sim.p1, -1.2, 0, 0.55, CHARACTER_REGISTRY.volt.attacks.light, arena);
  assert.equal(hitBehind, false, 'Attack should miss target behind fighter');

  // Target too far away (+X at 6m)
  const hitFar = checkSpatialHit(sim.p1, 6.0, 0, 0.55, CHARACTER_REGISTRY.volt.attacks.light, arena);
  assert.equal(hitFar, false, 'Attack should miss target beyond weapon range');
});

test('Guarding mitigates damage and drains stamina; Guard Break triggers when stamina reaches 0', () => {
  const sim = createSimulationState('volt', 'rift', 'iron_fortress');
  sim.p1.x = -0.9;
  sim.p1.z = 0;
  sim.p1.facingAngle = Math.PI / 2;
  sim.p2.x = 0.9;
  sim.p2.z = 0;
  sim.p2.facingAngle = -Math.PI / 2;
  sim.p2.actionState = 'block';
  sim.p2.stamina = 25; // Low enough that VOLT's heavy attack (38 guard damage) breaks guard!

  const p1Input = createEmptyInput();
  p1Input.heavyAttackJustPressed = true;
  const p2Input = createEmptyInput();
  p2Input.guardHeld = true;

  stepSimulation(sim, p1Input, p2Input, 0.016);
  for (let i = 0; i < 40; i++) {
    stepSimulation(sim, createEmptyInput(), p2Input, 0.016);
  }

  assert.equal(sim.p2.stamina, 0, 'Defender stamina should be depleted on guard crush');
  assert.equal(sim.p2.actionState, 'stagger', 'Defender should enter stagger state after guard crush');
});

test('Parry window deflects incoming attack and staggers the attacker', () => {
  const sim = createSimulationState('volt', 'rift', 'iron_fortress');
  sim.p1.x = -0.9;
  sim.p1.z = 0;
  sim.p1.facingAngle = Math.PI / 2;
  sim.p2.x = 0.9;
  sim.p2.z = 0;
  sim.p2.facingAngle = -Math.PI / 2;

  // P1 initiates light attack (0.15s startup)
  const p1Input = createEmptyInput();
  p1Input.lightAttackJustPressed = true;
  stepSimulation(sim, p1Input, createEmptyInput(), 0.02);

  // Advance 0.10s into startup, then P2 presses Guard to trigger Parry window
  for (let i = 0; i < 5; i++) {
    stepSimulation(sim, createEmptyInput(), createEmptyInput(), 0.02);
  }
  const p2ParryInput = createEmptyInput();
  p2ParryInput.guardJustPressed = true;
  p2ParryInput.guardHeld = true;
  stepSimulation(sim, createEmptyInput(), p2ParryInput, 0.02);
  assert.equal(sim.p2.actionState, 'parry_active');

  // Step into active hit frame
  for (let i = 0; i < 5; i++) {
    stepSimulation(sim, createEmptyInput(), createEmptyInput(), 0.02);
  }

  assert.equal(sim.p2.parriesLanded, 1, 'Defender should register a successful parry');
  assert.equal(sim.p1.actionState, 'stagger', 'Attacker should be staggered by parry');
});

test('RIFT False Remnant ability spawns a decoy and triggers cooldown', () => {
  const sim = createSimulationState('rift', 'volt', 'overgrown_colossus');
  const p1Input = createEmptyInput();
  p1Input.abilityJustPressed = true;

  stepSimulation(sim, p1Input, createEmptyInput(), 0.016);
  assert.equal(sim.p1.decoy.active, true, 'RIFT decoy should be active after casting False Remnant');
  assert.ok(sim.p1.abilityCooldown > 5, 'Ability cooldown should be active');
});

test('Arena boundary clamping keeps fighters inside playable radius', () => {
  const sim = createSimulationState('volt', 'rift', 'iron_fortress');
  sim.p1.x = 99;
  sim.p1.z = -99;

  stepSimulation(sim, createEmptyInput(), createEmptyInput(), 0.016);
  const dist = Math.hypot(sim.p1.x, sim.p1.z);
  assert.ok(
    dist <= ARENA_REGISTRY.iron_fortress.playableRadius,
    'Fighter position should be clamped inside arena playable radius'
  );
});

test('KO increments round score, resets positions on next round, and completes match', () => {
  const sim = createSimulationState('volt', 'rift', 'iron_fortress', 2, 90);
  sim.p1.x = -0.9;
  sim.p1.z = 0;
  sim.p2.x = 0.9;
  sim.p2.z = 0;
  sim.p2.hp = 5; // Low HP for KO

  const p1Input = createEmptyInput();
  p1Input.lightAttackJustPressed = true;
  stepSimulation(sim, p1Input, createEmptyInput(), 0.02);
  for (let i = 0; i < 20; i++) {
    stepSimulation(sim, createEmptyInput(), createEmptyInput(), 0.02);
  }

  assert.equal(sim.roundOver, true);
  assert.equal(sim.roundWinner, 'p1');
  assert.equal(sim.p1RoundsWon, 1);
  assert.equal(sim.matchOver, false);

  // Reset for Round 2 and win again
  sim.roundNumber = 2;
  resetRoundPositions(sim);
  assert.equal(sim.roundOver, false);
  assert.equal(sim.p2.hp, CHARACTER_REGISTRY.rift.stats.maxHp);

  sim.p1.x = -0.9;
  sim.p2.x = 0.9;
  sim.p2.hp = 5;
  stepSimulation(sim, p1Input, createEmptyInput(), 0.02);
  for (let i = 0; i < 20; i++) {
    stepSimulation(sim, createEmptyInput(), createEmptyInput(), 0.02);
  }

  assert.equal(sim.p1RoundsWon, 2);
  assert.equal(sim.matchOver, true);
  assert.equal(sim.matchWinner, 'p1');
});

test('Bot AI controller transitions states sensibly across distances and difficulties', () => {
  const sim = createSimulationState('volt', 'rift', 'iron_fortress');
  const ai = new BotAIController(42);

  // At spawn distance (9m apart), AI should approach
  const out1 = ai.computeInput(sim, sim.p2, sim.p1, 'normal', 'active_bot', 0.3);
  assert.equal(ai.currentState, 'approach');
  assert.ok(Math.hypot(out1.moveX, out1.moveZ) > 0.1, 'Bot should output movement vector when approaching');

  // When backed near arena boundary, AI should return to combat center
  sim.p2.x = 10.8;
  sim.p2.z = 0;
  ai.computeInput(sim, sim.p2, sim.p1, 'hard', 'active_bot', 0.3);
  assert.equal(ai.currentState, 'return_to_combat');
});
