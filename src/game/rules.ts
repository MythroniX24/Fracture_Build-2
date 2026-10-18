import {
  ARENA_REGISTRY,
  CHARACTER_REGISTRY,
} from './config.ts';
import type {
  ArenaDefinition,
  ArenaId,
  AttackSpec,
  CharacterDefinition,
  CharacterId,
  FighterActionState,
} from './config.ts';

export type BufferedActionType = 'light' | 'heavy' | 'dodge' | 'ability' | 'parry' | null;

export interface FighterInput {
  moveX: number; // -1 to 1 (world X)
  moveZ: number; // -1 to 1 (world Z)
  sprint: boolean;
  lightAttackJustPressed: boolean;
  heavyAttackJustPressed: boolean;
  guardHeld: boolean;
  guardJustPressed: boolean;
  dodgeJustPressed: boolean;
  abilityJustPressed: boolean;
  lockedOn?: boolean;
}

export interface DecoyState {
  active: boolean;
  x: number;
  z: number;
  facingAngle: number;
  ttl: number;
  maxTtl: number;
}

export interface FighterState {
  id: 'p1' | 'p2';
  characterId: CharacterId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  facingAngle: number; // radians, 0 = +Z, Math.PI/2 = +X
  hp: number;
  maxHp: number;
  ghostHp: number; // delayed trailing health bar
  stamina: number;
  maxStamina: number;
  actionState: FighterActionState;
  actionTimer: number; // time elapsed in current state
  actionDuration: number; // total duration of current phase
  currentAttack: AttackSpec | null;
  hasRegisteredHitInCurrentAttack: boolean;
  abilityCooldown: number;
  maxAbilityCooldown: number;
  attackCooldown: number;
  comboStep: number; // 0, 1, 2 for 3-hit light chain
  comboWindowTimer: number;
  bufferedAction: BufferedActionType;
  bufferTimer: number;
  guardHoldTime: number;
  hitFlashTimer: number;
  comboCount: number;
  comboDamage: number;
  comboResetTimer: number;
  lastDamageTaken: number;
  totalDamageDealt: number;
  parriesLanded: number;
  attacksLanded: number;
  decoy: DecoyState;
  overchargeBuffTimer: number;
}

export interface CombatEvent {
  type:
    | 'hit_light'
    | 'hit_heavy'
    | 'hit_ability'
    | 'blocked'
    | 'guard_break'
    | 'parried'
    | 'dodge_evade'
    | 'ability_cast'
    | 'decoy_shatter'
    | 'ko';
  attackerId: 'p1' | 'p2';
  defenderId: 'p1' | 'p2';
  x: number;
  y: number;
  z: number;
  damage: number;
  label: string;
}

export interface SimulationState {
  arenaId: ArenaId;
  roundNumber: number;
  roundsToWin: number;
  p1RoundsWon: number;
  p2RoundsWon: number;
  roundTimer: number;
  maxRoundTimer: number;
  hitstopTimer: number;
  cameraTrauma: number;
  roundOver: boolean;
  matchOver: boolean;
  roundWinner: 'p1' | 'p2' | 'draw' | null;
  matchWinner: 'p1' | 'p2' | null;
  p1: FighterState;
  p2: FighterState;
  events: CombatEvent[];
}

export function createEmptyInput(): FighterInput {
  return {
    moveX: 0,
    moveZ: 0,
    sprint: false,
    lightAttackJustPressed: false,
    heavyAttackJustPressed: false,
    guardHeld: false,
    guardJustPressed: false,
    dodgeJustPressed: false,
    abilityJustPressed: false,
    lockedOn: true,
  };
}

export function createFighterState(
  id: 'p1' | 'p2',
  characterId: CharacterId,
  x: number,
  z: number,
  facingAngle: number
): FighterState {
  const def = CHARACTER_REGISTRY[characterId];
  return {
    id,
    characterId,
    x,
    y: 0,
    z,
    vx: 0,
    vz: 0,
    facingAngle,
    hp: def.stats.maxHp,
    maxHp: def.stats.maxHp,
    ghostHp: def.stats.maxHp,
    stamina: def.stats.maxStamina,
    maxStamina: def.stats.maxStamina,
    actionState: 'idle',
    actionTimer: 0,
    actionDuration: 0,
    currentAttack: null,
    hasRegisteredHitInCurrentAttack: false,
    abilityCooldown: 0,
    maxAbilityCooldown: def.ability.cooldown,
    attackCooldown: 0,
    comboStep: 0,
    comboWindowTimer: 0,
    bufferedAction: null,
    bufferTimer: 0,
    guardHoldTime: 0,
    hitFlashTimer: 0,
    comboCount: 0,
    comboDamage: 0,
    comboResetTimer: 0,
    lastDamageTaken: 0,
    totalDamageDealt: 0,
    parriesLanded: 0,
    attacksLanded: 0,
    decoy: {
      active: false,
      x: 0,
      z: 0,
      facingAngle: 0,
      ttl: 0,
      maxTtl: 3.2,
    },
    overchargeBuffTimer: 0,
  };
}

export function createSimulationState(
  p1Char: CharacterId,
  p2Char: CharacterId,
  arenaId: ArenaId,
  roundsToWin = 2,
  roundTimeSeconds = 90
): SimulationState {
  const arena = ARENA_REGISTRY[arenaId];
  const spawnDist = arena.spawnDistance;
  return {
    arenaId,
    roundNumber: 1,
    roundsToWin,
    p1RoundsWon: 0,
    p2RoundsWon: 0,
    roundTimer: roundTimeSeconds,
    maxRoundTimer: roundTimeSeconds,
    hitstopTimer: 0,
    cameraTrauma: 0,
    roundOver: false,
    matchOver: false,
    roundWinner: null,
    matchWinner: null,
    p1: createFighterState('p1', p1Char, -spawnDist, 0, Math.PI / 2),
    p2: createFighterState('p2', p2Char, spawnDist, 0, -Math.PI / 2),
    events: [],
  };
}

export function resetRoundPositions(sim: SimulationState): void {
  const arena = ARENA_REGISTRY[sim.arenaId];
  const spawnDist = arena.spawnDistance;

  const p1Def = CHARACTER_REGISTRY[sim.p1.characterId];
  sim.p1.x = -spawnDist;
  sim.p1.y = 0;
  sim.p1.z = 0;
  sim.p1.vx = 0;
  sim.p1.vz = 0;
  sim.p1.facingAngle = Math.PI / 2;
  sim.p1.hp = p1Def.stats.maxHp;
  sim.p1.ghostHp = p1Def.stats.maxHp;
  sim.p1.stamina = p1Def.stats.maxStamina;
  sim.p1.actionState = 'idle';
  sim.p1.actionTimer = 0;
  sim.p1.currentAttack = null;
  sim.p1.hasRegisteredHitInCurrentAttack = false;
  sim.p1.abilityCooldown = 0;
  sim.p1.attackCooldown = 0;
  sim.p1.comboStep = 0;
  sim.p1.comboWindowTimer = 0;
  sim.p1.bufferedAction = null;
  sim.p1.bufferTimer = 0;
  sim.p1.comboCount = 0;
  sim.p1.comboDamage = 0;
  sim.p1.comboResetTimer = 0;
  sim.p1.decoy.active = false;
  sim.p1.overchargeBuffTimer = 0;

  const p2Def = CHARACTER_REGISTRY[sim.p2.characterId];
  sim.p2.x = spawnDist;
  sim.p2.y = 0;
  sim.p2.z = 0;
  sim.p2.vx = 0;
  sim.p2.vz = 0;
  sim.p2.facingAngle = -Math.PI / 2;
  sim.p2.hp = p2Def.stats.maxHp;
  sim.p2.ghostHp = p2Def.stats.maxHp;
  sim.p2.stamina = p2Def.stats.maxStamina;
  sim.p2.actionState = 'idle';
  sim.p2.actionTimer = 0;
  sim.p2.currentAttack = null;
  sim.p2.hasRegisteredHitInCurrentAttack = false;
  sim.p2.abilityCooldown = 0;
  sim.p2.attackCooldown = 0;
  sim.p2.comboStep = 0;
  sim.p2.comboWindowTimer = 0;
  sim.p2.bufferedAction = null;
  sim.p2.bufferTimer = 0;
  sim.p2.comboCount = 0;
  sim.p2.comboDamage = 0;
  sim.p2.comboResetTimer = 0;
  sim.p2.decoy.active = false;
  sim.p2.overchargeBuffTimer = 0;

  sim.roundTimer = sim.maxRoundTimer;
  sim.hitstopTimer = 0;
  sim.cameraTrauma = 0;
  sim.roundOver = false;
  sim.roundWinner = null;
  sim.events = [];
}

export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function lerpAngle(current: number, target: number, t: number): number {
  const diff = normalizeAngle(target - current);
  return normalizeAngle(current + diff * Math.min(1, Math.max(0, t)));
}

export function isDodgeInvulnerable(fighter: FighterState, def: CharacterDefinition): boolean {
  if (fighter.actionState !== 'dodge') return false;
  return (
    fighter.actionTimer >= def.stats.dodgeIFrameStart &&
    fighter.actionTimer <= def.stats.dodgeIFrameEnd
  );
}

export function isParryActive(fighter: FighterState): boolean {
  return fighter.actionState === 'parry_active';
}

export function isGuarding(fighter: FighterState): boolean {
  return fighter.actionState === 'block';
}

export function canAcceptNewAction(fighter: FighterState): boolean {
  return (
    fighter.actionState === 'idle' ||
    fighter.actionState === 'walk' ||
    fighter.actionState === 'run' ||
    fighter.actionState === 'block'
  );
}

/**
 * Checks whether a fighter is in a combo/dodge cancelable recovery window.
 */
export function canCancelIntoAction(
  fighter: FighterState,
  nextAction: 'light' | 'heavy' | 'dodge' | 'ability'
): boolean {
  if (fighter.actionState === 'light_recovery') {
    const progress = fighter.actionTimer / Math.max(0.01, fighter.actionDuration);
    if (nextAction === 'dodge' && progress >= 0.35) return true;
    // Allow 3-hit light chain (steps 0 -> 1 -> 2) or Light -> Heavy cancel if hit landed or late recovery
    if (
      (nextAction === 'light' && fighter.comboStep < 2) ||
      nextAction === 'heavy' ||
      nextAction === 'ability'
    ) {
      return fighter.hasRegisteredHitInCurrentAttack ? progress >= 0.15 : progress >= 0.45;
    }
  }
  if (fighter.actionState === 'heavy_recovery') {
    const progress = fighter.actionTimer / Math.max(0.01, fighter.actionDuration);
    if (nextAction === 'dodge' && progress >= 0.55) return true;
    if (nextAction === 'ability' && fighter.hasRegisteredHitInCurrentAttack && progress >= 0.35) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a line segment between attacker and defender intersects a solid arena obstacle.
 */
export function isBlockedByObstacle(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  arena: ArenaDefinition
): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 0.0001) return false;

  for (const obs of arena.obstacles) {
    if (!obs.blocksAttacks) continue;
    const t = Math.max(0, Math.min(1, ((obs.x - ax) * dx + (obs.z - az) * dz) / lenSq));
    const projX = ax + t * dx;
    const projZ = az + t * dz;
    const distSq = (obs.x - projX) * (obs.x - projX) + (obs.z - projZ) * (obs.z - projZ);
    if (distSq < obs.radius * obs.radius) {
      return true;
    }
  }
  return false;
}

/**
 * Spatial hit check: verifies range, frontal arc cone, and obstacle line-of-sight.
 */
export function checkSpatialHit(
  attacker: FighterState,
  targetX: number,
  targetZ: number,
  targetRadius: number,
  attack: AttackSpec,
  arena: ArenaDefinition
): boolean {
  const dx = targetX - attacker.x;
  const dz = targetZ - attacker.z;
  const dist = Math.hypot(dx, dz);

  // Effective distance subtracts defender's body capsule radius
  if (dist - targetRadius > attack.range) {
    return false;
  }

  // Check frontal cone angle
  if (dist > 0.05) {
    const angleToTarget = Math.atan2(dx, dz);
    const angleDiff = Math.abs(normalizeAngle(angleToTarget - attacker.facingAngle));
    const maxHalfCone = ((attack.arcDegrees * 0.5) * Math.PI) / 180;
    if (angleDiff > maxHalfCone) {
      return false;
    }
  }

  // Ensure strike does not pass through solid arena pillars
  if (isBlockedByObstacle(attacker.x, attacker.z, targetX, targetZ, arena)) {
    return false;
  }

  return true;
}

function startAttack(
  fighter: FighterState,
  opponent: FighterState,
  def: CharacterDefinition,
  kind: 'light' | 'heavy' | 'ability',
  freeStamina = false,
  aimAssist = true,
  moveAssist = true
): boolean {
  const baseSpec = def.attacks[kind];
  if (!freeStamina && fighter.stamina < baseSpec.staminaCost) {
    return false;
  }
  if (!freeStamina) {
    fighter.stamina = Math.max(0, fighter.stamina - baseSpec.staminaCost);
  }

  // Determine combo step progression for Light attacks
  if (kind === 'light') {
    if (
      fighter.actionState === 'light_recovery' ||
      (fighter.comboWindowTimer > 0 && fighter.comboStep < 2)
    ) {
      fighter.comboStep = Math.min(2, fighter.comboStep + 1);
    } else {
      fighter.comboStep = 0;
    }
    fighter.comboWindowTimer = 0.65;
  } else {
    fighter.comboStep = 0;
    fighter.comboWindowTimer = 0;
  }

  // Scale light combo steps (Step 0 = 1.0x, Step 1 = 1.12x, Step 2 Finisher = 1.28x damage & knockback)
  const stepMult = kind === 'light' ? (fighter.comboStep === 1 ? 1.12 : fighter.comboStep === 2 ? 1.28 : 1.0) : 1.0;
  const spec: AttackSpec =
    kind === 'light' && fighter.comboStep > 0
      ? {
          ...baseSpec,
          name:
            fighter.comboStep === 1
              ? `${baseSpec.name} II`
              : `${baseSpec.name} Finisher`,
          damage: Math.round(baseSpec.damage * stepMult),
          guardDamage: Math.round(baseSpec.guardDamage * stepMult),
          knockbackForce: baseSpec.knockbackForce * (fighter.comboStep === 2 ? 1.35 : 1.05),
          forwardImpulse: baseSpec.forwardImpulse * (fighter.comboStep === 2 ? 1.25 : 1.08),
          recovery: fighter.comboStep === 2 ? baseSpec.recovery * 1.25 : baseSpec.recovery,
        }
      : baseSpec;

  // Target selection (opponent or active decoy)
  let targetX = opponent.x;
  let targetZ = opponent.z;
  if (opponent.decoy.active) {
    const dReal = Math.hypot(opponent.x - fighter.x, opponent.z - fighter.z);
    const dDecoy = Math.hypot(opponent.decoy.x - fighter.x, opponent.decoy.z - fighter.z);
    if (dDecoy < dReal * 0.9) {
      targetX = opponent.decoy.x;
      targetZ = opponent.decoy.z;
    }
  }

  const dx = targetX - fighter.x;
  const dz = targetZ - fighter.z;
  const distToTarget = Math.hypot(dx, dz);

  if (distToTarget > 0.01) {
    const targetAngle = Math.atan2(dx, dz);
    if (aimAssist) {
      // Snap facing toward target if locked-on or within assist distance
      fighter.facingAngle = targetAngle;
    } else {
      // Subtle assist within 65 degrees
      const diff = Math.abs(normalizeAngle(targetAngle - fighter.facingAngle));
      if (diff < (65 * Math.PI) / 180) {
        fighter.facingAngle = lerpAngle(fighter.facingAngle, targetAngle, 0.65);
      }
    }
  }

  // Optional movement assistance: subtle step-in boost when slightly outside strike range
  if (moveAssist && distToTarget > spec.range * 0.7 && distToTarget <= spec.range + 1.25) {
    fighter.currentAttack = {
      ...spec,
      forwardImpulse: spec.forwardImpulse * 1.18,
    };
  } else {
    fighter.currentAttack = spec;
  }

  fighter.hasRegisteredHitInCurrentAttack = false;
  fighter.actionTimer = 0;
  fighter.actionDuration = spec.startup;
  fighter.attackCooldown = kind === 'light' && fighter.comboStep === 2 ? 0.16 : 0.06;

  if (kind === 'light') {
    fighter.actionState = 'light_startup';
  } else if (kind === 'heavy') {
    fighter.actionState = 'heavy_startup';
  } else {
    fighter.actionState = 'ability_startup';
  }

  return true;
}

export interface StepModifiers {
  p1InfiniteStamina?: boolean;
  p1Invulnerable?: boolean;
  p1InstantCooldowns?: boolean;
  p1AimAssist?: boolean;
  p1MoveAssist?: boolean;
}

export function stepSimulation(
  sim: SimulationState,
  p1Input: FighterInput,
  p2Input: FighterInput,
  rawDt: number,
  modifiers: StepModifiers = {}
): void {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  sim.events = [];

  // Decay camera trauma & hit flashes in real time
  sim.cameraTrauma = Math.max(0, sim.cameraTrauma - dt * 1.8);
  sim.p1.hitFlashTimer = Math.max(0, sim.p1.hitFlashTimer - dt);
  sim.p2.hitFlashTimer = Math.max(0, sim.p2.hitFlashTimer - dt);

  // Smooth ghost HP bars
  sim.p1.ghostHp += (sim.p1.hp - sim.p1.ghostHp) * Math.min(1, dt * 4.5);
  sim.p2.ghostHp += (sim.p2.hp - sim.p2.ghostHp) * Math.min(1, dt * 4.5);

  if (sim.roundOver || sim.matchOver) {
    return;
  }

  // Hitstop freezes physical simulation briefly on heavy impacts / parries
  if (sim.hitstopTimer > 0) {
    sim.hitstopTimer = Math.max(0, sim.hitstopTimer - dt);
    return;
  }

  const arena = ARENA_REGISTRY[sim.arenaId];

  // Update round timer
  if (sim.roundTimer > 0) {
    sim.roundTimer = Math.max(0, sim.roundTimer - dt);
    if (sim.roundTimer <= 0) {
      resolveRoundByTimeout(sim);
      return;
    }
  }

  // Step individual fighter states & inputs
  updateFighter(
    sim.p1,
    sim.p2,
    p1Input,
    dt,
    arena,
    sim,
    Boolean(modifiers.p1InfiniteStamina),
    Boolean(modifiers.p1InstantCooldowns),
    modifiers.p1AimAssist !== false,
    modifiers.p1MoveAssist !== false
  );
  updateFighter(sim.p2, sim.p1, p2Input, dt, arena, sim, false, false, true, true);

  // Resolve active attacks & hitboxes
  resolveFighterHitbox(sim.p1, sim.p2, arena, sim, false);
  resolveFighterHitbox(sim.p2, sim.p1, arena, sim, Boolean(modifiers.p1Invulnerable));

  // Resolve fighter-to-fighter body separation & arena boundaries
  resolveCollisionsAndBoundaries(sim.p1, sim.p2, arena);

  // Check KO conditions
  if (sim.p1.hp <= 0 || sim.p2.hp <= 0) {
    resolveRoundByKO(sim);
  }
}

function recordBufferedInput(f: FighterState, input: FighterInput): void {
  // Priority order for buffering new edge-triggered inputs
  if (input.dodgeJustPressed) {
    f.bufferedAction = 'dodge';
    f.bufferTimer = 0.24;
  } else if (input.abilityJustPressed) {
    f.bufferedAction = 'ability';
    f.bufferTimer = 0.24;
  } else if (input.heavyAttackJustPressed) {
    f.bufferedAction = 'heavy';
    f.bufferTimer = 0.24;
  } else if (input.lightAttackJustPressed) {
    f.bufferedAction = 'light';
    f.bufferTimer = 0.24;
  } else if (input.guardJustPressed) {
    f.bufferedAction = 'parry';
    f.bufferTimer = 0.20;
  }
}

function tryExecuteAction(
  f: FighterState,
  opponent: FighterState,
  input: FighterInput,
  def: CharacterDefinition,
  sim: SimulationState,
  infiniteStamina: boolean,
  instantCooldowns: boolean,
  aimAssist: boolean,
  moveAssist: boolean,
  fromCancelWindow: boolean
): boolean {
  const wantDodge = input.dodgeJustPressed || f.bufferedAction === 'dodge';
  const wantAbility = input.abilityJustPressed || f.bufferedAction === 'ability';
  const wantHeavy = input.heavyAttackJustPressed || f.bufferedAction === 'heavy';
  const wantLight = input.lightAttackJustPressed || f.bufferedAction === 'light';
  const wantParry = input.guardJustPressed || f.bufferedAction === 'parry';

  // 1. Dodge has highest defensive priority
  if (
    wantDodge &&
    (!fromCancelWindow || canCancelIntoAction(f, 'dodge')) &&
    (infiniteStamina || f.stamina >= def.stats.dodgeStaminaCost)
  ) {
    f.bufferedAction = null;
    f.bufferTimer = 0;
    if (!infiniteStamina) {
      f.stamina = Math.max(0, f.stamina - def.stats.dodgeStaminaCost);
    }
    f.actionState = 'dodge';
    f.actionTimer = 0;
    f.actionDuration = def.stats.dodgeDuration;
    f.currentAttack = null;
    f.comboStep = 0;

    // Dodge direction: input vector if pressed, otherwise backstep away from opponent
    const mag = Math.hypot(input.moveX, input.moveZ);
    let dirX: number;
    let dirZ: number;
    if (mag > 0.12) {
      dirX = input.moveX / mag;
      dirZ = input.moveZ / mag;
    } else {
      const awayX = f.x - opponent.x;
      const awayZ = f.z - opponent.z;
      const awayLen = Math.hypot(awayX, awayZ) || 1;
      dirX = awayX / awayLen;
      dirZ = awayZ / awayLen;
    }
    f.vx = dirX * def.stats.dodgeSpeed;
    f.vz = dirZ * def.stats.dodgeSpeed;
    if (input.lockedOn !== false || aimAssist) {
      f.facingAngle = Math.atan2(opponent.x - f.x, opponent.z - f.z);
    } else {
      f.facingAngle = Math.atan2(dirX, dirZ);
    }
    return true;
  }

  // 2. Character-Specific Ability
  if (
    wantAbility &&
    (!fromCancelWindow || canCancelIntoAction(f, 'ability')) &&
    f.abilityCooldown <= 0 &&
    (infiniteStamina || f.stamina >= def.ability.staminaCost)
  ) {
    if (startAttack(f, opponent, def, 'ability', infiniteStamina, aimAssist, moveAssist)) {
      f.bufferedAction = null;
      f.bufferTimer = 0;
      f.abilityCooldown = instantCooldowns ? 0.5 : def.ability.cooldown;

      if (f.characterId === 'volt') {
        f.overchargeBuffTimer = 2.5;
      } else if (f.characterId === 'rift') {
        f.decoy = {
          active: true,
          x: f.x,
          z: f.z,
          facingAngle: f.facingAngle,
          ttl: 3.2,
          maxTtl: 3.2,
        };
        const toOppX = opponent.x - f.x;
        const toOppZ = opponent.z - f.z;
        const dist = Math.hypot(toOppX, toOppZ) || 1;
        const perpX = -toOppZ / dist;
        const perpZ = toOppX / dist;
        const forwardX = toOppX / dist;
        const forwardZ = toOppZ / dist;
        f.vx = (perpX * 0.8 + forwardX * 0.6) * 11.5;
        f.vz = (perpZ * 0.8 + forwardZ * 0.6) * 11.5;
      }

      sim.events.push({
        type: 'ability_cast',
        attackerId: f.id,
        defenderId: opponent.id,
        x: f.x,
        y: 1.1,
        z: f.z,
        damage: 0,
        label: def.ability.name.toUpperCase(),
      });
      return true;
    }
  }

  // 3. Heavy Attack
  if (
    wantHeavy &&
    f.attackCooldown <= 0 &&
    (!fromCancelWindow || canCancelIntoAction(f, 'heavy'))
  ) {
    if (startAttack(f, opponent, def, 'heavy', infiniteStamina, aimAssist, moveAssist)) {
      f.bufferedAction = null;
      f.bufferTimer = 0;
      return true;
    }
  }

  // 4. Light Attack (with 3-hit combo chain support)
  if (
    wantLight &&
    (fromCancelWindow ? canCancelIntoAction(f, 'light') : f.attackCooldown <= 0)
  ) {
    if (startAttack(f, opponent, def, 'light', infiniteStamina, aimAssist, moveAssist)) {
      f.bufferedAction = null;
      f.bufferTimer = 0;
      return true;
    }
  }

  // 5. Parry (only from neutral/guard states, not mid-attack cancel)
  if (!fromCancelWindow && wantParry && f.actionState !== 'block' && f.stamina >= 8) {
    f.bufferedAction = null;
    f.bufferTimer = 0;
    f.actionState = 'parry_active';
    f.actionTimer = 0;
    f.actionDuration = def.stats.parryWindow;
    f.guardHoldTime = 0;
    f.vx *= 0.35;
    f.vz *= 0.35;
    return true;
  }

  return false;
}

function updateFighter(
  f: FighterState,
  opponent: FighterState,
  input: FighterInput,
  dt: number,
  arena: ArenaDefinition,
  sim: SimulationState,
  infiniteStamina: boolean,
  instantCooldowns: boolean,
  aimAssist: boolean,
  moveAssist: boolean
): void {
  const def = CHARACTER_REGISTRY[f.characterId];

  // Record any new edge-triggered inputs into the input buffer
  recordBufferedInput(f, input);

  // Cooldowns & timers
  if (instantCooldowns) {
    f.abilityCooldown = 0;
  } else {
    f.abilityCooldown = Math.max(0, f.abilityCooldown - dt);
  }
  f.attackCooldown = Math.max(0, f.attackCooldown - dt);

  if (f.comboWindowTimer > 0) {
    f.comboWindowTimer = Math.max(0, f.comboWindowTimer - dt);
    if (f.comboWindowTimer <= 0 && canAcceptNewAction(f)) {
      f.comboStep = 0;
    }
  }

  if (f.bufferTimer > 0) {
    f.bufferTimer = Math.max(0, f.bufferTimer - dt);
    if (f.bufferTimer <= 0) {
      f.bufferedAction = null;
    }
  }

  if (f.overchargeBuffTimer > 0) {
    f.overchargeBuffTimer = Math.max(0, f.overchargeBuffTimer - dt);
  }

  if (f.comboResetTimer > 0) {
    f.comboResetTimer = Math.max(0, f.comboResetTimer - dt);
    if (f.comboResetTimer <= 0) {
      f.comboCount = 0;
      f.comboDamage = 0;
    }
  }

  // Update active decoy if present
  if (f.decoy.active) {
    f.decoy.ttl -= dt;
    if (f.decoy.ttl <= 0) {
      f.decoy.active = false;
    }
  }

  // Stamina regeneration (only when not attacking, dodging, or holding block)
  const canRegenStamina =
    f.actionState === 'idle' ||
    f.actionState === 'walk' ||
    f.actionState === 'run';

  if (infiniteStamina) {
    f.stamina = f.maxStamina;
  } else if (canRegenStamina) {
    const regenRate = f.actionState === 'run' ? def.stats.staminaRegenPerSec * 0.45 : def.stats.staminaRegenPerSec;
    f.stamina = Math.min(f.maxStamina, f.stamina + regenRate * dt);
  } else if (f.actionState === 'block') {
    // Reduced stamina regen while holding guard
    f.stamina = Math.min(f.maxStamina, f.stamina + def.stats.staminaRegenPerSec * 0.18 * dt);
  }

  f.actionTimer += dt;

  // Handle input transitions when fighter is in a controllable neutral/movement state
  if (canAcceptNewAction(f)) {
    if (
      tryExecuteAction(
        f,
        opponent,
        input,
        def,
        sim,
        infiniteStamina,
        instantCooldowns,
        aimAssist,
        moveAssist,
        false
      )
    ) {
      return;
    }

    // Continuous Guard Hold
    if (input.guardHeld && f.stamina > 5) {
      f.actionState = 'block';
      f.guardHoldTime += dt;
      const moveMag = Math.min(1, Math.hypot(input.moveX, input.moveZ));
      const targetVx = moveMag > 0.1 ? input.moveX * (def.stats.walkSpeed * 0.44) : 0;
      const targetVz = moveMag > 0.1 ? input.moveZ * (def.stats.walkSpeed * 0.44) : 0;
      f.vx += (targetVx - f.vx) * Math.min(1, dt * def.stats.acceleration);
      f.vz += (targetVz - f.vz) * Math.min(1, dt * def.stats.acceleration);
      f.facingAngle = lerpAngle(
        f.facingAngle,
        Math.atan2(opponent.x - f.x, opponent.z - f.z),
        dt * 12
      );
      f.x += f.vx * dt;
      f.z += f.vz * dt;
      return;
    } else if (f.actionState === 'block') {
      f.actionState = 'idle';
      f.guardHoldTime = 0;
    }

    // Standard 360-Degree Directional Movement (Walk / Run / Idle)
    const inputMag = Math.hypot(input.moveX, input.moveZ);
    if (inputMag > 0.08) {
      const clampedMag = Math.min(1, inputMag);
      const dirX = input.moveX / inputMag;
      const dirZ = input.moveZ / inputMag;
      const isRunning = input.sprint && f.stamina > 10;
      const maxSpeed = isRunning ? def.stats.runSpeed : def.stats.walkSpeed;
      const speed = maxSpeed * (0.35 + 0.65 * clampedMag);

      const targetVx = dirX * speed;
      const targetVz = dirZ * speed;
      f.vx += (targetVx - f.vx) * Math.min(1, dt * def.stats.acceleration);
      f.vz += (targetVz - f.vz) * Math.min(1, dt * def.stats.acceleration);

      f.actionState = isRunning ? 'run' : 'walk';

      const toOpponentAngle = Math.atan2(opponent.x - f.x, opponent.z - f.z);
      const moveAngle = Math.atan2(dirX, dirZ);
      const isLocked = input.lockedOn !== false;
      const targetFacing = isRunning || !isLocked ? moveAngle : toOpponentAngle;
      f.facingAngle = lerpAngle(f.facingAngle, targetFacing, dt * 15);
    } else {
      f.vx += (0 - f.vx) * Math.min(1, dt * def.stats.deceleration);
      f.vz += (0 - f.vz) * Math.min(1, dt * def.stats.deceleration);
      if (Math.hypot(f.vx, f.vz) < 0.15) {
        f.vx = 0;
        f.vz = 0;
      }
      f.actionState = 'idle';
      if (input.lockedOn !== false) {
        const toOpponentAngle = Math.atan2(opponent.x - f.x, opponent.z - f.z);
        f.facingAngle = lerpAngle(f.facingAngle, toOpponentAngle, dt * 10);
      }
    }

    f.x += f.vx * dt;
    f.z += f.vz * dt;
    return;
  }

  // Non-idle state progression (Attacks, Dodge, Parry, Hit Stun, Stagger)
  switch (f.actionState) {
    case 'parry_active': {
      f.vx *= Math.pow(0.05, dt);
      f.vz *= Math.pow(0.05, dt);
      if (f.actionTimer >= f.actionDuration) {
        if (input.guardHeld && f.stamina > 5) {
          f.actionState = 'block';
          f.actionTimer = 0;
        } else {
          f.actionState = 'parry_Whiff';
          f.actionTimer = 0;
          f.actionDuration = def.stats.parryRecovery;
        }
      }
      break;
    }

    case 'parry_Whiff': {
      f.vx *= Math.pow(0.05, dt);
      f.vz *= Math.pow(0.05, dt);
      if (f.actionTimer >= f.actionDuration) {
        f.actionState = 'idle';
        f.actionTimer = 0;
      }
      break;
    }

    case 'dodge': {
      const progress = f.actionTimer / Math.max(0.01, f.actionDuration);
      if (progress > 0.65) {
        f.vx *= Math.pow(0.08, dt);
        f.vz *= Math.pow(0.08, dt);
      }
      f.x += f.vx * dt;
      f.z += f.vz * dt;

      if (f.actionTimer >= f.actionDuration) {
        f.actionState = 'idle';
        f.actionTimer = 0;
        f.vx *= 0.25;
        f.vz *= 0.25;
        // Immediately fire any buffered post-dodge attack
        tryExecuteAction(
          f,
          opponent,
          input,
          def,
          sim,
          infiniteStamina,
          instantCooldowns,
          aimAssist,
          moveAssist,
          false
        );
      }
      break;
    }

    case 'light_startup':
    case 'heavy_startup':
    case 'ability_startup': {
      const spec = f.currentAttack!;
      const forwardX = Math.sin(f.facingAngle);
      const forwardZ = Math.cos(f.facingAngle);
      f.vx = forwardX * spec.forwardImpulse * 0.65;
      f.vz = forwardZ * spec.forwardImpulse * 0.65;
      f.x += f.vx * dt;
      f.z += f.vz * dt;

      if (f.actionTimer >= f.actionDuration) {
        f.actionTimer = 0;
        f.actionDuration = spec.active;
        f.vx = forwardX * spec.forwardImpulse;
        f.vz = forwardZ * spec.forwardImpulse;
        if (f.actionState === 'light_startup') f.actionState = 'light_active';
        else if (f.actionState === 'heavy_startup') f.actionState = 'heavy_active';
        else f.actionState = 'ability_active';
      }
      break;
    }

    case 'light_active':
    case 'heavy_active':
    case 'ability_active': {
      const spec = f.currentAttack!;
      f.vx *= Math.pow(0.06, dt);
      f.vz *= Math.pow(0.06, dt);
      f.x += f.vx * dt;
      f.z += f.vz * dt;

      if (f.actionTimer >= f.actionDuration) {
        f.actionTimer = 0;
        f.actionDuration = spec.recovery;
        if (f.actionState === 'light_active') f.actionState = 'light_recovery';
        else if (f.actionState === 'heavy_active') f.actionState = 'heavy_recovery';
        else f.actionState = 'ability_recovery';
      }
      break;
    }

    case 'light_recovery':
    case 'heavy_recovery':
    case 'ability_recovery': {
      f.vx *= Math.pow(0.02, dt);
      f.vz *= Math.pow(0.02, dt);
      f.x += f.vx * dt;
      f.z += f.vz * dt;

      // Check if buffered combo chain or dodge cancel can trigger during recovery window
      if (
        f.bufferedAction &&
        tryExecuteAction(
          f,
          opponent,
          input,
          def,
          sim,
          infiniteStamina,
          instantCooldowns,
          aimAssist,
          moveAssist,
          true
        )
      ) {
        return;
      }

      if (f.actionTimer >= f.actionDuration) {
        f.actionState = 'idle';
        f.actionTimer = 0;
        f.currentAttack = null;
        f.hasRegisteredHitInCurrentAttack = false;
        // Execute buffered action immediately on recovery completion
        if (f.bufferedAction) {
          tryExecuteAction(
            f,
            opponent,
            input,
            def,
            sim,
            infiniteStamina,
            instantCooldowns,
            aimAssist,
            moveAssist,
            false
          );
        }
      }
      break;
    }

    case 'hit_stun':
    case 'stagger':
    case 'knockdown': {
      // Clear offensive combo chains when hit/staggered, but allow defensive dodge/parry buffering near the end
      f.comboStep = 0;
      f.comboWindowTimer = 0;
      f.vx *= Math.pow(0.025, dt);
      f.vz *= Math.pow(0.025, dt);
      f.x += f.vx * dt;
      f.z += f.vz * dt;

      if (f.actionTimer >= f.actionDuration) {
        f.actionState = 'idle';
        f.actionTimer = 0;
        f.vx = 0;
        f.vz = 0;
        if (f.bufferedAction) {
          tryExecuteAction(
            f,
            opponent,
            input,
            def,
            sim,
            infiniteStamina,
            instantCooldowns,
            aimAssist,
            moveAssist,
            false
          );
        }
      }
      break;
    }

    default:
      break;
  }
}

function resolveFighterHitbox(
  attacker: FighterState,
  defender: FighterState,
  arena: ArenaDefinition,
  sim: SimulationState,
  defenderInvulnerable: boolean
): void {
  const isActivePhase =
    attacker.actionState === 'light_active' ||
    attacker.actionState === 'heavy_active' ||
    attacker.actionState === 'ability_active';

  if (!isActivePhase || !attacker.currentAttack || attacker.hasRegisteredHitInCurrentAttack) {
    return;
  }

  const attack = attacker.currentAttack;
  const defenderDef = CHARACTER_REGISTRY[defender.characterId];

  // Check if attacker strikes RIFT's active decoy first
  if (defender.decoy.active) {
    const hitDecoy = checkSpatialHit(attacker, defender.decoy.x, defender.decoy.z, 0.55, attack, arena);
    const hitReal = checkSpatialHit(attacker, defender.x, defender.z, 0.55, attack, arena);

    if (hitDecoy && !hitReal) {
      attacker.hasRegisteredHitInCurrentAttack = true;
      defender.decoy.active = false;
      sim.events.push({
        type: 'decoy_shatter',
        attackerId: attacker.id,
        defenderId: defender.id,
        x: defender.decoy.x,
        y: 1.1,
        z: defender.decoy.z,
        damage: 0,
        label: 'DECOY SHATTERED',
      });
      return;
    }
  }

  // Spatial hit detection against defender
  const hitSuccess = checkSpatialHit(attacker, defender.x, defender.z, 0.58, attack, arena);
  if (!hitSuccess) {
    return;
  }

  // Mark hit registered so a single attack never deals repeated frame damage
  attacker.hasRegisteredHitInCurrentAttack = true;

  // 1. Check Dodge Invulnerability Window
  if (isDodgeInvulnerable(defender, defenderDef)) {
    sim.events.push({
      type: 'dodge_evade',
      attackerId: attacker.id,
      defenderId: defender.id,
      x: defender.x,
      y: 1.0,
      z: defender.z,
      damage: 0,
      label: 'EVADED',
    });
    return;
  }

  // Direction of knockback from attacker to defender
  const dx = defender.x - attacker.x;
  const dz = defender.z - attacker.z;
  const dist = Math.hypot(dx, dz) || 1;
  const dirX = dx / dist;
  const dirZ = dz / dist;

  // 2. Check Parry Window (Defender timed guard right as attack landed!)
  if (isParryActive(defender)) {
    defender.parriesLanded += 1;
    defender.stamina = Math.min(defender.maxStamina, defender.stamina + 25);
    defender.actionState = 'idle';
    defender.actionTimer = 0;

    // Attacker is staggered and wide open for counterattack!
    attacker.actionState = 'stagger';
    attacker.actionTimer = 0;
    attacker.actionDuration = 1.15;
    attacker.currentAttack = null;
    attacker.comboStep = 0;
    attacker.bufferedAction = null;
    attacker.vx = -dirX * 6.5;
    attacker.vz = -dirZ * 6.5;

    sim.hitstopTimer = 0.08;
    sim.cameraTrauma = Math.min(1, sim.cameraTrauma + 0.55);

    sim.events.push({
      type: 'parried',
      attackerId: attacker.id,
      defenderId: defender.id,
      x: (attacker.x + defender.x) * 0.5,
      y: 1.25,
      z: (attacker.z + defender.z) * 0.5,
      damage: 0,
      label: 'PARRY COUNTER!',
    });
    return;
  }

  // 3. Check Guard / Block (only blocks attacks within frontal 170 degrees of defender)
  const angleToAttacker = Math.atan2(-dirX, -dirZ);
  const defenderFacingDiff = Math.abs(normalizeAngle(angleToAttacker - defender.facingAngle));
  const isFacingAttacker = defenderFacingDiff <= (85 * Math.PI) / 180;

  if (isGuarding(defender) && isFacingAttacker) {
    const staminaDrain = attack.guardDamage;
    const chipDamage = defenderInvulnerable
      ? 0
      : Math.max(1, Math.round(attack.damage * (1 - defenderDef.stats.guardDamageReduction)));

    defender.hp = Math.max(1, defender.hp - chipDamage);
    defender.stamina -= staminaDrain;

    if (defender.stamina <= 0) {
      // GUARD BREAK!
      defender.stamina = 0;
      defender.actionState = 'stagger';
      defender.actionTimer = 0;
      defender.actionDuration = attack.staggerOnGuardBreak;
      defender.vx = dirX * (attack.knockbackForce * 0.8);
      defender.vz = dirZ * (attack.knockbackForce * 0.8);
      sim.hitstopTimer = 0.07;
      sim.cameraTrauma = Math.min(1, sim.cameraTrauma + 0.6);

      sim.events.push({
        type: 'guard_break',
        attackerId: attacker.id,
        defenderId: defender.id,
        x: defender.x,
        y: 1.25,
        z: defender.z,
        damage: chipDamage,
        label: 'GUARD CRUSH!',
      });
    } else {
      // Successful block
      defender.vx = dirX * (attack.knockbackForce * 0.42);
      defender.vz = dirZ * (attack.knockbackForce * 0.42);
      sim.hitstopTimer = 0.035;
      sim.cameraTrauma = Math.min(1, sim.cameraTrauma + 0.22);

      sim.events.push({
        type: 'blocked',
        attackerId: attacker.id,
        defenderId: defender.id,
        x: defender.x,
        y: 1.2,
        z: defender.z,
        damage: chipDamage,
        label: `BLOCKED (-${chipDamage})`,
      });
    }
    return;
  }

  // 4. Clean Hit!
  const buffMult = attacker.overchargeBuffTimer > 0 ? 1.15 : 1.0;
  const finalDamage = defenderInvulnerable ? 0 : Math.round(attack.damage * buffMult);
  defender.hp = Math.max(0, defender.hp - finalDamage);
  defender.lastDamageTaken = finalDamage;
  defender.hitFlashTimer = 0.12;
  defender.comboCount = 0;
  defender.comboDamage = 0;
  defender.comboResetTimer = 0;

  attacker.totalDamageDealt += finalDamage;
  attacker.attacksLanded += 1;
  attacker.comboCount += 1;
  attacker.comboDamage += finalDamage;
  attacker.comboResetTimer = 2.5;

  // Check poise / interruptibility
  const defenderInUninterruptibleStartup =
    (defender.actionState === 'heavy_startup' || defender.actionState === 'ability_startup') &&
    defender.currentAttack &&
    !defender.currentAttack.interruptibleStartup &&
    attack.id === 'light';

  if (!defenderInUninterruptibleStartup) {
    defender.actionState = attack.id === 'ability' ? 'knockdown' : 'hit_stun';
    defender.actionTimer = 0;
    defender.actionDuration = attack.hitStunDuration;
    defender.currentAttack = null;
    defender.hasRegisteredHitInCurrentAttack = false;
  }

  const knockbackScale = 1 / defenderDef.stats.mass;
  defender.vx = dirX * attack.knockbackForce * knockbackScale;
  defender.vz = dirZ * attack.knockbackForce * knockbackScale;
  defender.facingAngle = Math.atan2(-dirX, -dirZ);

  // Hitstop & camera shake scaled by attack weight
  if (attack.id === 'light') {
    sim.hitstopTimer = 0.035;
    sim.cameraTrauma = Math.min(1, sim.cameraTrauma + 0.25);
  } else if (attack.id === 'heavy') {
    sim.hitstopTimer = 0.06;
    sim.cameraTrauma = Math.min(1, sim.cameraTrauma + 0.5);
  } else {
    sim.hitstopTimer = 0.08;
    sim.cameraTrauma = Math.min(1, sim.cameraTrauma + 0.75);
  }

  const eventType =
    attack.id === 'light'
      ? 'hit_light'
      : attack.id === 'heavy'
        ? 'hit_heavy'
        : 'hit_ability';

  sim.events.push({
    type: eventType,
    attackerId: attacker.id,
    defenderId: defender.id,
    x: defender.x,
    y: 1.2,
    z: defender.z,
    damage: finalDamage,
    label: `${finalDamage} DMG`,
  });

  // Also check if attacker's swing clipped defender's decoy at the same time
  if (defender.decoy.active && checkSpatialHit(attacker, defender.decoy.x, defender.decoy.z, 0.55, attack, arena)) {
    defender.decoy.active = false;
  }
}

function resolveCollisionsAndBoundaries(
  p1: FighterState,
  p2: FighterState,
  arena: ArenaDefinition
): void {
  const minSeparation = 1.05;
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const dist = Math.hypot(dx, dz);

  if (dist < minSeparation) {
    const overlap = (minSeparation - dist) * 0.5;
    const nx = dist > 0.001 ? dx / dist : 1;
    const nz = dist > 0.001 ? dz / dist : 0;
    p1.x -= nx * overlap;
    p1.z -= nz * overlap;
    p2.x += nx * overlap;
    p2.z += nz * overlap;
  }

  clampFighterToArena(p1, arena);
  clampFighterToArena(p2, arena);
}

function clampFighterToArena(f: FighterState, arena: ArenaDefinition): void {
  const fighterRadius = 0.52;

  // Obstacle cylinder collisions
  for (const obs of arena.obstacles) {
    if (!obs.blocksMovement) continue;
    const dx = f.x - obs.x;
    const dz = f.z - obs.z;
    const dist = Math.hypot(dx, dz);
    const minDist = obs.radius + fighterRadius;
    if (dist < minDist) {
      const nx = dist > 0.001 ? dx / dist : 1;
      const nz = dist > 0.001 ? dz / dist : 0;
      f.x = obs.x + nx * minDist;
      f.z = obs.z + nz * minDist;
    }
  }

  // Circular arena boundary containment
  const distFromCenter = Math.hypot(f.x, f.z);
  const maxDist = arena.playableRadius - fighterRadius;
  if (distFromCenter > maxDist) {
    const scale = maxDist / distFromCenter;
    f.x *= scale;
    f.z *= scale;
    // Damp outward velocity when hitting arena rim
    f.vx *= 0.4;
    f.vz *= 0.4;
  }
  f.y = 0;
}

function resolveRoundByKO(sim: SimulationState): void {
  sim.roundOver = true;
  sim.hitstopTimer = 0.09;
  sim.cameraTrauma = 0.85;

  if (sim.p1.hp <= 0 && sim.p2.hp <= 0) {
    sim.roundWinner = 'draw';
    sim.p1.actionState = 'defeat';
    sim.p2.actionState = 'defeat';
  } else if (sim.p2.hp <= 0) {
    sim.roundWinner = 'p1';
    sim.p1RoundsWon += 1;
    sim.p1.actionState = 'victory';
    sim.p2.actionState = 'defeat';
    sim.events.push({
      type: 'ko',
      attackerId: 'p1',
      defenderId: 'p2',
      x: sim.p2.x,
      y: 1.2,
      z: sim.p2.z,
      damage: 0,
      label: 'KNOCKOUT!',
    });
  } else {
    sim.roundWinner = 'p2';
    sim.p2RoundsWon += 1;
    sim.p2.actionState = 'victory';
    sim.p1.actionState = 'defeat';
    sim.events.push({
      type: 'ko',
      attackerId: 'p2',
      defenderId: 'p1',
      x: sim.p1.x,
      y: 1.2,
      z: sim.p1.z,
      damage: 0,
      label: 'KNOCKOUT!',
    });
  }

  checkMatchVictory(sim);
}

function resolveRoundByTimeout(sim: SimulationState): void {
  sim.roundOver = true;
  const p1Ratio = sim.p1.hp / sim.p1.maxHp;
  const p2Ratio = sim.p2.hp / sim.p2.maxHp;

  if (Math.abs(p1Ratio - p2Ratio) < 0.01) {
    sim.roundWinner = 'draw';
  } else if (p1Ratio > p2Ratio) {
    sim.roundWinner = 'p1';
    sim.p1RoundsWon += 1;
    sim.p1.actionState = 'victory';
    sim.p2.actionState = 'defeat';
  } else {
    sim.roundWinner = 'p2';
    sim.p2RoundsWon += 1;
    sim.p2.actionState = 'victory';
    sim.p1.actionState = 'defeat';
  }

  checkMatchVictory(sim);
}

function checkMatchVictory(sim: SimulationState): void {
  if (sim.p1RoundsWon >= sim.roundsToWin) {
    sim.matchOver = true;
    sim.matchWinner = 'p1';
  } else if (sim.p2RoundsWon >= sim.roundsToWin) {
    sim.matchOver = true;
    sim.matchWinner = 'p2';
  }
}
