import {
  ARENA_REGISTRY,
  BOT_DIFFICULTIES,
  CHARACTER_REGISTRY,
} from './config.ts';
import type {
  ArenaId,
  AttackSpec,
  BotDifficulty,
  CharacterId,
  TrainingConfig,
} from './config.ts';

export type FighterActionState =
  | 'idle'
  | 'move'
  | 'sprint'
  | 'jump'
  | 'dodge'
  | 'block'
  | 'parry_window'
  | 'attack_windup'
  | 'attack_active'
  | 'attack_recovery'
  | 'hitstun'
  | 'blockstun'
  | 'guard_break'
  | 'parry_stun';

export type AttackKind =
  | 'light_1'
  | 'light_2'
  | 'light_3'
  | 'heavy'
  | 'ability'
  | 'dash_strike'
  | 'aerial_slam'
  | 'execution';

export interface FighterInput {
  moveX: number; // -1 to 1 (World X)
  moveZ: number; // -1 to 1 (World Z)
  sprint: boolean;
  jumpPressed?: boolean;
  lightPressed: boolean;
  heavyPressed: boolean;
  guardHeld: boolean;
  guardJustPressed: boolean;
  dodgePressed: boolean;
  abilityPressed: boolean;
  executionPressed?: boolean;
}

export interface CombatEvent {
  type:
    | 'attack_swing'
    | 'dodge_dash'
    | 'hit_light'
    | 'hit_heavy'
    | 'hit_ability'
    | 'execution_hit'
    | 'blocked'
    | 'parried'
    | 'counter_riposte'
    | 'combo_breaker'
    | 'guard_break'
    | 'dodge_evade'
    | 'ability_cast'
    | 'decoy_spawn'
    | 'decoy_shatter'
    | 'prop_hit'
    | 'prop_shatter'
    | 'barrel_explode'
    | 'tile_crack'
    | 'tile_shatter'
    | 'ko'
    | 'round_end';
  attackerId?: 'p1' | 'p2';
  defenderId?: 'p1' | 'p2';
  attackKind?: AttackKind;
  facingAngle?: number;
  x: number;
  y: number;
  z: number;
  damage?: number;
  label: string;
  propId?: string;
  propKind?: 'crate' | 'barrel';
}

export interface DecoyState {
  active: boolean;
  ownerId: 'p1' | 'p2';
  characterId: CharacterId;
  x: number;
  z: number;
  facingAngle: number;
  hp: number;
  remainingMs: number;
}

export interface PlasmaProjectileState {
  id: string;
  ownerId: 'p1' | 'p2';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  damage: number;
  poiseDamage: number;
  remainingMs: number;
  colorHex: number;
}

export interface BreakablePropState {
  id: string;
  kind: 'crate' | 'barrel';
  x: number;
  z: number;
  rotY: number;
  radius: number;
  height: number;
  hp: number;
  maxHp: number;
  broken: boolean;
  hitFlashMs: number;
  explosiveRadius?: number;
  explosiveDamage?: number;
}

export interface FloorTileState {
  index: number;
  ring: number;
  angle: number;
  x: number;
  z: number;
  w: number;
  d: number;
  state: 0 | 1 | 2; // 0 = intact, 1 = cracked, 2 = shattered
}

export interface FighterState {
  id: 'p1' | 'p2';
  characterId: CharacterId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  facingAngle: number;
  hp: number;
  maxHp: number;
  ghostHp: number; // Trails behind hp for readable damage drain bar
  stamina: number;
  maxStamina: number;
  poise: number;
  maxPoise: number;
  staminaRegenDelayMs: number;
  action: FighterActionState;
  actionTimerMs: number;
  actionDurationMs: number;
  currentAttack: AttackKind | null;
  attackHasHit: boolean;
  queuedAttack: AttackKind | null;
  comboCount: number;
  comboDamage: number;
  comboResetTimerMs: number;
  abilityCooldownMs: number;
  invulnerableMs: number;
  hitFlashMs: number;
  dodgeDirX: number;
  dodgeDirZ: number;
  parriesLanded: number;
  totalDamageDealt: number;
  aiDecisionTimerMs: number;
  aiCurrentOrder: 'advance' | 'strafe_left' | 'strafe_right' | 'retreat' | 'guard' | 'attack';
  aiAttackCooldownMs?: number;
  aiComboRolled?: boolean;
  bufferedInput?: 'light' | 'heavy' | 'dodge' | 'ability' | 'execution' | 'jump' | null;
  bufferTimerMs?: number;
  hyperArmorMs: number;
  counterWindowMs: number;
  consecutiveHitsTaken?: number;
}

export interface SimulationState {
  arenaId: ArenaId;
  roundNumber: number;
  roundsToWin: number;
  p1RoundsWon: number;
  p2RoundsWon: number;
  roundTimerMs: number;
  maxRoundTimeMs: number;
  hitstopMs: number;
  slowMoMs: number;
  screenShake: number;
  roundOver: boolean;
  roundWinner: 'p1' | 'p2' | 'draw' | null;
  matchOver: boolean;
  matchWinner: 'p1' | 'p2' | null;
  p1: FighterState;
  p2: FighterState;
  decoy: DecoyState | null;
  projectiles: PlasmaProjectileState[];
  breakableProps: BreakablePropState[];
  floorTiles: FloorTileState[];
  events: CombatEvent[];
}

function foundryTileHash(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

export function createFloorTiles(): FloorTileState[] {
  const tiles: FloorTileState[] = [];
  const gridCols = 12;
  const gridRows = 8;
  const TS = 5;

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      // Skip tiles directly underneath the 20x10m central dais (c in 4..7, r in 3..4)
      if (c >= 4 && c <= 7 && r >= 3 && r <= 4) continue;
      const fc = Math.min(c, gridCols - 1 - c);
      const fr = Math.min(r, gridRows - 1 - r);
      const v = foundryTileHash(fc * 3.1, fr * 7.7, 5.5);
      const prot = c >= 3 && c <= 8 && r >= 2 && r <= 5;
      const initState: 0 | 1 | 2 = prot ? 0 : v > 0.88 ? 2 : v > 0.7 ? 1 : 0;

      const x = (c - gridCols / 2 + 0.5) * TS;
      const z = (r - gridRows / 2 + 0.5) * TS;
      tiles.push({
        ring: c,
        index: r,
        angle: Math.atan2(z, x),
        x,
        z,
        w: TS - 0.12,
        d: TS - 0.12,
        state: initState,
      });
    }
  }
  return tiles;
}

export function createBreakableProps(arenaId: ArenaId): BreakablePropState[] {
  const arena = ARENA_REGISTRY[arenaId] || ARENA_REGISTRY.foundry_arena;
  return arena.breakableProps.map((spec) => ({
    id: spec.id,
    kind: spec.kind,
    x: spec.x,
    z: spec.z,
    rotY: spec.rotY,
    radius: spec.radius,
    height: spec.height,
    hp: spec.maxHp,
    maxHp: spec.maxHp,
    broken: false,
    hitFlashMs: 0,
    explosiveRadius: spec.explosiveRadius,
    explosiveDamage: spec.explosiveDamage,
  }));
}

/**
 * Returns the exact ground elevation (Y) at a given (X, Z) coordinate in the Foundry Arena v4.
 * Central Safe Dais in fracture-foundry-arena-v4.html:
 * - Rectangular dais: width = 20m (|x| <= 10), depth = 10m (|z| <= 5), height = 1.2m
 * - West & East stepped ramps: 10 < |x| <= 11.85 and |z| <= 3.05, ramping from y = 1.2m down to y = 0.0m
 */
export function getArenaSurfaceHeight(_arenaId: ArenaId, x: number, z: number): number {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  if (ax <= 10.0 && az <= 5.0) {
    return 1.2;
  }
  if (ax > 10.0 && ax <= 11.85 && az <= 3.05) {
    const t = (ax - 10.0) / 1.85;
    return Math.max(0, 1.2 * (1 - t));
  }
  return 0;
}

export function createFighterState(
  id: 'p1' | 'p2',
  characterId: CharacterId,
  x: number,
  z: number,
  facingAngle: number,
  arenaId: ArenaId = 'foundry_arena'
): FighterState {
  const def = CHARACTER_REGISTRY[characterId];
  const initialY = getArenaSurfaceHeight(arenaId, x, z);
  return {
    id,
    characterId,
    x,
    y: initialY,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    facingAngle,
    hp: def.stats.maxHp,
    maxHp: def.stats.maxHp,
    ghostHp: def.stats.maxHp,
    stamina: def.stats.maxStamina,
    maxStamina: def.stats.maxStamina,
    poise: def.stats.maxPoise,
    maxPoise: def.stats.maxPoise,
    staminaRegenDelayMs: 0,
    action: 'idle',
    actionTimerMs: 0,
    actionDurationMs: 0,
    currentAttack: null,
    attackHasHit: false,
    queuedAttack: null,
    comboCount: 0,
    comboDamage: 0,
    comboResetTimerMs: 0,
    abilityCooldownMs: 0,
    invulnerableMs: 0,
    hitFlashMs: 0,
    dodgeDirX: 0,
    dodgeDirZ: 0,
    parriesLanded: 0,
    totalDamageDealt: 0,
    aiDecisionTimerMs: 0,
    aiCurrentOrder: 'advance',
    aiAttackCooldownMs: 0,
    aiComboRolled: false,
    bufferedInput: null,
    bufferTimerMs: 0,
    hyperArmorMs: 0,
    counterWindowMs: 0,
    consecutiveHitsTaken: 0,
  };
}

export function createSimulationState(
  p1Char: CharacterId,
  p2Char: CharacterId,
  arenaId: ArenaId = 'foundry_arena',
  roundsToWin = 2,
  roundTimeSeconds = 90
): SimulationState {
  const maxRoundTimeMs = roundTimeSeconds * 1000;
  return {
    arenaId,
    roundNumber: 1,
    roundsToWin,
    p1RoundsWon: 0,
    p2RoundsWon: 0,
    roundTimerMs: maxRoundTimeMs,
    maxRoundTimeMs,
    hitstopMs: 0,
    slowMoMs: 0,
    screenShake: 0,
    roundOver: false,
    roundWinner: null,
    matchOver: false,
    matchWinner: null,
    // Spawn on the Foundry central dais at (-4.8, 1.2, 0) and (4.8, 1.2, 0)
    p1: createFighterState('p1', p1Char, -4.8, 0, Math.PI * 0.5, arenaId),
    p2: createFighterState('p2', p2Char, 4.8, 0, -Math.PI * 0.5, arenaId),
    decoy: null,
    projectiles: [],
    breakableProps: createBreakableProps(arenaId),
    floorTiles: createFloorTiles(),
    events: [],
  };
}

export function resetRoundPositions(sim: SimulationState): void {
  const p1Wins = sim.p1RoundsWon;
  const p2Wins = sim.p2RoundsWon;
  const p1TotalDmg = sim.p1.totalDamageDealt;
  const p2TotalDmg = sim.p2.totalDamageDealt;
  const p1Parries = sim.p1.parriesLanded;
  const p2Parries = sim.p2.parriesLanded;

  sim.p1 = createFighterState('p1', sim.p1.characterId, -4.8, 0, Math.PI * 0.5, sim.arenaId);
  sim.p2 = createFighterState('p2', sim.p2.characterId, 4.8, 0, -Math.PI * 0.5, sim.arenaId);
  sim.p1.totalDamageDealt = p1TotalDmg;
  sim.p2.totalDamageDealt = p2TotalDmg;
  sim.p1.parriesLanded = p1Parries;
  sim.p2.parriesLanded = p2Parries;

  sim.p1RoundsWon = p1Wins;
  sim.p2RoundsWon = p2Wins;
  sim.roundTimerMs = sim.maxRoundTimeMs;
  sim.hitstopMs = 0;
  sim.slowMoMs = 0;
  sim.screenShake = 0;
  sim.roundOver = false;
  sim.roundWinner = null;
  sim.decoy = null;
  sim.projectiles = [];
  sim.breakableProps = createBreakableProps(sim.arenaId);
  sim.floorTiles = createFloorTiles();
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

export function emptyInput(): FighterInput {
  return {
    moveX: 0,
    moveZ: 0,
    sprint: false,
    jumpPressed: false,
    lightPressed: false,
    heavyPressed: false,
    guardHeld: false,
    guardJustPressed: false,
    dodgePressed: false,
    abilityPressed: false,
    executionPressed: false,
  };
}

/**
 * Damages or shatters destructible floor tiles around (x, z) within radius.
 */
export function damageArenaFloorAt(
  sim: SimulationState,
  x: number,
  z: number,
  radius: number,
  shatterForce = false
): void {
  for (const tile of sim.floorTiles) {
    if (tile.state >= 2) continue;
    const dist = Math.hypot(tile.x - x, tile.z - z);
    if (dist <= radius) {
      if (shatterForce && dist <= radius * 0.65) {
        tile.state = 2;
        sim.events.push({
          type: 'tile_shatter',
          x: tile.x,
          y: 0.05,
          z: tile.z,
          label: 'FLOOR SHATTERED',
        });
      } else if (tile.state === 0) {
        tile.state = 1;
        sim.events.push({
          type: 'tile_crack',
          x: tile.x,
          y: 0.05,
          z: tile.z,
          label: 'FLOOR FRACTURED',
        });
      } else if (tile.state === 1 && dist <= radius * 0.85) {
        tile.state = 2;
        sim.events.push({
          type: 'tile_shatter',
          x: tile.x,
          y: 0.05,
          z: tile.z,
          label: 'FLOOR SHATTERED',
        });
      }
    }
  }
}

/**
 * Triggers an explosive energy barrel detonation, damaging nearby fighters, other props, and floor tiles.
 */
function triggerBarrelExplosion(
  sim: SimulationState,
  barrel: BreakablePropState,
  attackerId?: 'p1' | 'p2'
): void {
  const radius = barrel.explosiveRadius || 4.5;
  const dmg = barrel.explosiveDamage || 14;

  sim.screenShake = Math.max(sim.screenShake, 0.72);
  sim.events.push({
    type: 'barrel_explode',
    attackerId,
    x: barrel.x,
    y: 0.8,
    z: barrel.z,
    damage: dmg,
    label: 'PLASMA BARREL DETONATION!',
    propId: barrel.id,
    propKind: 'barrel',
  });

  damageArenaFloorAt(sim, barrel.x, barrel.z, radius * 0.9, true);

  // Damage nearby fighters
  for (const fighter of [sim.p1, sim.p2]) {
    if (fighter.invulnerableMs > 0) continue;
    const dx = fighter.x - barrel.x;
    const dz = fighter.z - barrel.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= radius) {
      const falloff = 1 - (dist / radius) * 0.45;
      const actualDmg = Math.max(4, Math.round(dmg * falloff));
      fighter.hp = Math.max(0, fighter.hp - actualDmg);
      fighter.poise = Math.max(0, fighter.poise - 38);
      fighter.hitFlashMs = 200;
      fighter.action = 'hitstun';
      fighter.actionTimerMs = 0;
      fighter.actionDurationMs = 460;
      fighter.currentAttack = null;
      const nx = dist > 0.001 ? dx / dist : 1;
      const nz = dist > 0.001 ? dz / dist : 0;
      fighter.vx = nx * 8.5;
      fighter.vz = nz * 8.5;
    }
  }
}

/**
 * Damages breakable crates and energy barrels within an attack cone or radial blast.
 */
export function damageBreakablePropsInArc(
  sim: SimulationState,
  attacker: FighterState,
  spec: AttackSpec
): void {
  const fwdX = Math.sin(attacker.facingAngle);
  const fwdZ = Math.cos(attacker.facingAngle);

  for (const prop of sim.breakableProps) {
    if (prop.broken) continue;
    const dx = prop.x - attacker.x;
    const dz = prop.z - attacker.z;
    const dist = Math.hypot(dx, dz);
    const effectiveRange = spec.range + prop.radius + 0.55;
    if (dist > effectiveRange) continue;

    const dirX = dist > 0.0001 ? dx / dist : fwdX;
    const dirZ = dist > 0.0001 ? dz / dist : fwdZ;
    const dot = fwdX * dirX + fwdZ * dirZ;
    if (dot < spec.arcCos && dist > 1.35) continue;

    prop.hp = Math.max(0, prop.hp - spec.damage * 1.35);
    prop.hitFlashMs = 150;

    if (prop.hp <= 0) {
      prop.broken = true;
      sim.screenShake = Math.max(sim.screenShake, 0.35);
      sim.events.push({
        type: 'prop_shatter',
        attackerId: attacker.id,
        x: prop.x,
        y: prop.height * 0.5,
        z: prop.z,
        label: prop.kind === 'barrel' ? 'BARREL SHATTERED!' : 'CRATE DESTROYED!',
        propId: prop.id,
        propKind: prop.kind,
      });

      if (prop.kind === 'barrel') {
        triggerBarrelExplosion(sim, prop, attacker.id);
      }
    } else {
      sim.events.push({
        type: 'prop_hit',
        attackerId: attacker.id,
        x: prop.x,
        y: prop.height * 0.5,
        z: prop.z,
        label: 'PROP HIT',
        propId: prop.id,
        propKind: prop.kind,
      });
    }
  }
}

/**
 * Autonomous Bot AI decision engine with 3 distinct difficulty presets
 */
export function computeBotInput(
  sim: SimulationState,
  bot: FighterState,
  opponent: FighterState,
  difficulty: BotDifficulty,
  dtMs: number,
  trainingConfig?: TrainingConfig
): FighterInput {
  const input = emptyInput();

  if (trainingConfig) {
    if (trainingConfig.dummyBehavior === 'idle') {
      return input;
    }
    if (trainingConfig.dummyBehavior === 'block_all') {
      input.guardHeld = true;
      return input;
    }
    if (trainingConfig.dummyBehavior === 'counter_hit') {
      const dist = Math.hypot(opponent.x - bot.x, opponent.z - bot.z);
      if (
        opponent.action === 'attack_windup' ||
        opponent.action === 'attack_active'
      ) {
        input.guardHeld = true;
        if (opponent.actionTimerMs < 90) {
          input.guardJustPressed = true;
        }
      } else if (bot.action === 'blockstun' || (dist < 3.6 && opponent.action === 'attack_recovery')) {
        input.lightPressed = true;
      } else {
        input.guardHeld = true;
      }
      return input;
    }
  }

  const preset = BOT_DIFFICULTIES[difficulty];
  const targetX = sim.decoy && sim.decoy.active && sim.decoy.ownerId === opponent.id ? sim.decoy.x : opponent.x;
  const targetZ = sim.decoy && sim.decoy.active && sim.decoy.ownerId === opponent.id ? sim.decoy.z : opponent.z;

  const dx = targetX - bot.x;
  const dz = targetZ - bot.z;
  const dist = Math.hypot(dx, dz) || 0.001;
  const dirX = dx / dist;
  const dirZ = dz / dist;

  const strafeX = -dirZ;
  const strafeZ = dirX;

  bot.aiDecisionTimerMs -= dtMs;
  bot.aiAttackCooldownMs = Math.max(0, (bot.aiAttackCooldownMs ?? 0) - dtMs);

  const oppAttacking =
    opponent.action === 'attack_windup' || opponent.action === 'attack_active';

  // Reset per-swing combo roll flag when not in active/recovery
  if (bot.action !== 'attack_active' && bot.action !== 'attack_recovery') {
    bot.aiComboRolled = false;
  }

  // If opponent is staggered / guard_broken and close, execute if off attack cooldown!
  if (
    (opponent.action === 'guard_break' || opponent.action === 'parry_stun') &&
    dist <= 4.3 &&
    (bot.aiAttackCooldownMs ?? 0) <= 0 &&
    Math.random() < preset.aggression * 0.7
  ) {
    input.executionPressed = true;
    input.heavyPressed = true;
    bot.aiAttackCooldownMs = preset.reactionIntervalMs * 3.2;
    return input;
  }

  // Immediate defensive reaction if opponent is swinging nearby
  if (oppAttacking && dist < 4.5 && bot.aiDecisionTimerMs <= preset.reactionIntervalMs * 0.5) {
    const roll = Math.random();
    if (roll < preset.parryChance && opponent.action === 'attack_windup') {
      input.guardHeld = true;
      input.guardJustPressed = true;
      bot.aiDecisionTimerMs = preset.reactionIntervalMs;
      return input;
    }
    if (roll < preset.parryChance + preset.dodgeChance && bot.stamina >= 20) {
      input.dodgePressed = true;
      input.moveX = strafeX * (Math.random() < 0.5 ? 1 : -1) - dirX * 0.4;
      input.moveZ = strafeZ * (Math.random() < 0.5 ? 1 : -1) - dirZ * 0.4;
      bot.aiDecisionTimerMs = preset.reactionIntervalMs;
      return input;
    }
    if (roll < preset.parryChance + preset.dodgeChance + preset.blockChance) {
      bot.aiCurrentOrder = 'guard';
      bot.aiDecisionTimerMs = preset.reactionIntervalMs;
    }
  }

  // Roll ONCE per swing whether to chain follow-up attack (prevents 60Hz infinite combo spam!)
  if (
    (bot.action === 'attack_active' || bot.action === 'attack_recovery') &&
    bot.currentAttack &&
    !bot.aiComboRolled &&
    dist < 4.0
  ) {
    bot.aiComboRolled = true;
    const maxComboSteps = difficulty === 'easy' ? 1 : difficulty === 'normal' ? 2 : 3;
    const currentStep =
      bot.currentAttack === 'light_1' || bot.currentAttack === 'dash_strike'
        ? 1
        : bot.currentAttack === 'light_2'
          ? 2
          : 3;

    if (currentStep < maxComboSteps && Math.random() < preset.comboFollowupChance) {
      input.lightPressed = true;
    } else {
      // Finished combo string! Enforce mandatory post-combo breathing window so player can counter-attack!
      const baseCooldown =
        difficulty === 'easy' ? 1350 : difficulty === 'normal' ? 920 : 580;
      bot.aiAttackCooldownMs = baseCooldown + Math.random() * 350;
      bot.aiCurrentOrder = Math.random() < 0.5 ? 'strafe_left' : 'strafe_right';
    }
  }

  if (bot.aiDecisionTimerMs <= 0) {
    bot.aiDecisionTimerMs = preset.reactionIntervalMs * (0.85 + Math.random() * 0.4);

    if (bot.stamina < 24 || (bot.aiAttackCooldownMs ?? 0) > 0) {
      if (dist < 3.4) {
        bot.aiCurrentOrder = Math.random() < 0.45 ? 'retreat' : 'guard';
      } else {
        bot.aiCurrentOrder = Math.random() < 0.5 ? 'strafe_left' : 'strafe_right';
      }
    } else if (dist > 4.2) {
      bot.aiCurrentOrder = 'advance';
    } else if (dist >= 2.2 && dist <= 4.2) {
      const r = Math.random();
      if (r < preset.aggression) {
        bot.aiCurrentOrder = 'attack';
      } else if (r < preset.aggression + 0.22) {
        bot.aiCurrentOrder = 'guard';
      } else {
        bot.aiCurrentOrder = Math.random() < 0.5 ? 'strafe_left' : 'strafe_right';
      }
    } else {
      bot.aiCurrentOrder = Math.random() < preset.aggression ? 'attack' : 'strafe_right';
    }
  }

  switch (bot.aiCurrentOrder) {
    case 'advance':
      input.moveX = dirX;
      input.moveZ = dirZ;
      input.sprint = dist > 6.2 && bot.stamina > 45;
      if (
        input.sprint &&
        dist <= 4.8 &&
        dist >= 3.2 &&
        (bot.aiAttackCooldownMs ?? 0) <= 0 &&
        bot.stamina >= 18 &&
        Math.random() < preset.aggression * 0.28
      ) {
        input.lightPressed = true; // Dash strike!
        bot.aiAttackCooldownMs = preset.reactionIntervalMs * 2.5;
      } else if (
        dist < 5.2 &&
        bot.abilityCooldownMs <= 0 &&
        (bot.aiAttackCooldownMs ?? 0) <= 0 &&
        bot.stamina >= 35 &&
        Math.random() < 0.06
      ) {
        input.abilityPressed = true;
        bot.aiAttackCooldownMs = preset.reactionIntervalMs * 3.0;
      }
      break;
    case 'retreat':
      input.moveX = -dirX * 0.85 + strafeX * 0.35;
      input.moveZ = -dirZ * 0.85 + strafeZ * 0.35;
      if (oppAttacking && dist < 4.0) {
        input.guardHeld = true;
      }
      break;
    case 'strafe_left':
      input.moveX = strafeX * 0.85 + dirX * 0.15;
      input.moveZ = strafeZ * 0.85 + dirZ * 0.15;
      if (oppAttacking && dist < 3.8 && Math.random() < preset.blockChance) {
        input.guardHeld = true;
      }
      break;
    case 'strafe_right':
      input.moveX = -strafeX * 0.85 + dirX * 0.15;
      input.moveZ = -strafeZ * 0.85 + dirZ * 0.15;
      if (oppAttacking && dist < 3.8 && Math.random() < preset.blockChance) {
        input.guardHeld = true;
      }
      break;
    case 'guard':
      input.guardHeld = true;
      input.moveX = -strafeX * 0.38;
      input.moveZ = -strafeZ * 0.38;
      break;
    case 'attack':
      input.moveX = dirX * 0.55;
      input.moveZ = dirZ * 0.55;
      if (
        (bot.action === 'idle' || bot.action === 'move' || bot.action === 'sprint') &&
        (bot.aiAttackCooldownMs ?? 0) <= 0
      ) {
        const roll = Math.random();
        if (bot.abilityCooldownMs <= 0 && bot.stamina >= 35 && roll < 0.18) {
          input.abilityPressed = true;
        } else if (roll < 0.38 && bot.stamina >= 24) {
          input.heavyPressed = true;
        } else if (bot.stamina >= 10) {
          input.lightPressed = true;
        }
        const postSwingCooldown =
          difficulty === 'easy' ? 1250 : difficulty === 'normal' ? 820 : 480;
        bot.aiAttackCooldownMs = postSwingCooldown;
        bot.aiDecisionTimerMs = preset.reactionIntervalMs * 1.4;
      }
      break;
  }

  return input;
}

function startAttack(
  sim: SimulationState,
  fighter: FighterState,
  opponent: FighterState,
  attackKind: AttackKind,
  isCounterRiposte = false
): void {
  const def = CHARACTER_REGISTRY[fighter.characterId];
  const spec: AttackSpec = def.attacks[attackKind];

  const effectiveCost = isCounterRiposte ? Math.round(spec.staminaCost * 0.5) : spec.staminaCost;
  if (fighter.stamina < effectiveCost && attackKind !== 'execution' && !isCounterRiposte) {
    return;
  }

  fighter.stamina = Math.max(0, fighter.stamina - effectiveCost);
  fighter.staminaRegenDelayMs = 480;
  fighter.action = 'attack_windup';
  fighter.actionTimerMs = 0;
  // Counter-ripostes come out 25% faster and grant uninterruptible Hyper-Armor!
  fighter.actionDurationMs = isCounterRiposte
    ? Math.round(spec.windupMs * 0.72)
    : spec.windupMs;
  fighter.currentAttack = attackKind;
  fighter.attackHasHit = false;
  fighter.queuedAttack = null;
  fighter.bufferedInput = null;
  fighter.bufferTimerMs = 0;
  fighter.consecutiveHitsTaken = 0;

  if (
    isCounterRiposte ||
    attackKind === 'heavy' ||
    attackKind === 'ability' ||
    attackKind === 'aerial_slam' ||
    attackKind === 'execution'
  ) {
    fighter.hyperArmorMs = Math.max(
      fighter.hyperArmorMs ?? 0,
      fighter.actionDurationMs + spec.activeMs + (isCounterRiposte ? 120 : 40)
    );
    fighter.counterWindowMs = 0;
  }

  // Snap facing toward opponent (or decoy if active)
  const targetX =
    sim.decoy && sim.decoy.active && sim.decoy.ownerId === opponent.id
      ? sim.decoy.x
      : opponent.x;
  const targetZ =
    sim.decoy && sim.decoy.active && sim.decoy.ownerId === opponent.id
      ? sim.decoy.z
      : opponent.z;
  const dx = targetX - fighter.x;
  const dz = targetZ - fighter.z;
  if (Math.hypot(dx, dz) > 0.05) {
    fighter.facingAngle = lerpAngle(fighter.facingAngle, Math.atan2(dx, dz), 0.82);
  }

  if (attackKind === 'ability') {
    fighter.abilityCooldownMs = def.ability.cooldownMs;
    sim.events.push({
      type: 'ability_cast',
      attackerId: fighter.id,
      attackKind,
      facingAngle: fighter.facingAngle,
      x: fighter.x,
      y: fighter.y + 1.3,
      z: fighter.z,
      label: def.ability.name,
    });

    if (fighter.characterId === 'rift') {
      // Spawn Phase Decoy at current spot AND launch a real 3D Gravity Plasma Orb projectile!
      sim.decoy = {
        active: true,
        ownerId: fighter.id,
        characterId: fighter.characterId,
        x: fighter.x,
        z: fighter.z,
        facingAngle: fighter.facingAngle,
        hp: 15,
        remainingMs: 3600,
      };
      const fwdX = Math.sin(fighter.facingAngle);
      const fwdZ = Math.cos(fighter.facingAngle);
      sim.projectiles.push({
        id: `orb_${Date.now()}_${Math.random()}`,
        ownerId: fighter.id,
        x: fighter.x + fwdX * 1.35,
        y: fighter.y + 1.35,
        z: fighter.z + fwdZ * 1.35,
        vx: fwdX * 13.5,
        vy: 0,
        vz: fwdZ * 13.5,
        radius: 0.65,
        damage: 18,
        poiseDamage: 42,
        remainingMs: 1800,
        colorHex: 0x38bdf8,
      });
      fighter.invulnerableMs = 280;
    }
  } else {
    sim.events.push({
      type: 'attack_swing',
      attackerId: fighter.id,
      attackKind,
      facingAngle: fighter.facingAngle,
      x: fighter.x,
      y: fighter.y + 1.2,
      z: fighter.z,
      label: spec.name,
    });
  }
}

function updateSingleFighter(
  sim: SimulationState,
  fighter: FighterState,
  opponent: FighterState,
  input: FighterInput,
  dtMs: number,
  trainingConfig?: TrainingConfig
): void {
  const dtSec = dtMs / 1000;
  const def = CHARACTER_REGISTRY[fighter.characterId];

  // Training mode overrides
  if (trainingConfig && fighter.id === 'p1') {
    if (trainingConfig.infiniteStamina) {
      fighter.stamina = fighter.maxStamina;
    }
    if (trainingConfig.instantCooldowns) {
      fighter.abilityCooldownMs = 0;
    }
    if (trainingConfig.playerInvulnerable) {
      fighter.hp = fighter.maxHp;
      fighter.ghostHp = fighter.maxHp;
    }
  }
  if (trainingConfig && fighter.id === 'p2') {
    if (fighter.hp < fighter.maxHp && fighter.action === 'idle' && fighter.comboResetTimerMs <= 0) {
      fighter.hp = Math.min(fighter.maxHp, fighter.hp + 28 * dtSec);
    }
  }

  // Smooth ghost HP bar decay
  if (fighter.ghostHp > fighter.hp) {
    fighter.ghostHp = Math.max(fighter.hp, fighter.ghostHp - 28 * dtSec);
  } else {
    fighter.ghostHp = fighter.hp;
  }

  // Poise regeneration when not stunned
  if (
    fighter.action !== 'hitstun' &&
    fighter.action !== 'blockstun' &&
    fighter.action !== 'guard_break' &&
    fighter.action !== 'parry_stun'
  ) {
    fighter.poise = Math.min(fighter.maxPoise, fighter.poise + 14 * dtSec);
  }

  // Timers
  if (fighter.abilityCooldownMs > 0) {
    fighter.abilityCooldownMs = Math.max(0, fighter.abilityCooldownMs - dtMs);
  }
  if (fighter.invulnerableMs > 0) {
    fighter.invulnerableMs = Math.max(0, fighter.invulnerableMs - dtMs);
  }
  if (fighter.hitFlashMs > 0) {
    fighter.hitFlashMs = Math.max(0, fighter.hitFlashMs - dtMs);
  }
  if (fighter.staminaRegenDelayMs > 0) {
    fighter.staminaRegenDelayMs = Math.max(0, fighter.staminaRegenDelayMs - dtMs);
  }
  if ((fighter.hyperArmorMs ?? 0) > 0) {
    fighter.hyperArmorMs = Math.max(0, (fighter.hyperArmorMs ?? 0) - dtMs);
  }
  if ((fighter.counterWindowMs ?? 0) > 0) {
    fighter.counterWindowMs = Math.max(0, (fighter.counterWindowMs ?? 0) - dtMs);
  }
  if ((fighter.bufferTimerMs ?? 0) > 0) {
    fighter.bufferTimerMs = Math.max(0, (fighter.bufferTimerMs ?? 0) - dtMs);
    if (fighter.bufferTimerMs === 0) {
      fighter.bufferedInput = null;
    }
  }
  if (fighter.comboResetTimerMs > 0) {
    fighter.comboResetTimerMs = Math.max(0, fighter.comboResetTimerMs - dtMs);
    if (fighter.comboResetTimerMs === 0) {
      fighter.comboCount = 0;
      fighter.comboDamage = 0;
    }
  }

  // Capture any fresh button press into the 280ms Input Buffer so no tap is ever lost during hitstun/recovery!
  if (input.executionPressed) {
    fighter.bufferedInput = 'execution';
    fighter.bufferTimerMs = 280;
  } else if (input.abilityPressed) {
    fighter.bufferedInput = 'ability';
    fighter.bufferTimerMs = 280;
  } else if (input.dodgePressed) {
    fighter.bufferedInput = 'dodge';
    fighter.bufferTimerMs = 280;
  } else if (input.heavyPressed) {
    fighter.bufferedInput = 'heavy';
    fighter.bufferTimerMs = 280;
  } else if (input.lightPressed) {
    fighter.bufferedInput = 'light';
    fighter.bufferTimerMs = 280;
  } else if (input.jumpPressed) {
    fighter.bufferedInput = 'jump';
    fighter.bufferTimerMs = 240;
  }

  // Merge buffered inputs into effective one-shot checks when ready
  const wantLight = input.lightPressed || fighter.bufferedInput === 'light';
  const wantHeavy = input.heavyPressed || fighter.bufferedInput === 'heavy';
  const wantDodge = input.dodgePressed || fighter.bufferedInput === 'dodge';
  const wantAbility = input.abilityPressed || fighter.bufferedInput === 'ability';
  const wantExec = input.executionPressed || fighter.bufferedInput === 'execution';
  const wantJump = Boolean(input.jumpPressed || fighter.bufferedInput === 'jump');

  // Stamina regeneration: standing (idle), walking (move), running (sprint), and blocking regenerate stamina!
  // Walking/running NEVER drains stamina — only attacks, dashes/dodges, and special abilities consume stamina.
  const canRegen =
    fighter.staminaRegenDelayMs <= 0 &&
    (fighter.action === 'idle' ||
      fighter.action === 'move' ||
      fighter.action === 'sprint' ||
      fighter.action === 'block');
  if (canRegen) {
    const mult = fighter.action === 'block' ? 0.55 : 1.0;
    fighter.stamina = Math.min(
      fighter.maxStamina,
      fighter.stamina + def.stats.staminaRegenPerSec * mult * dtSec
    );
  }

  // Queue combo follow-up inputs during attack windup or active frames
  if (fighter.action === 'attack_windup' || fighter.action === 'attack_active') {
    if (fighter.currentAttack) {
      const curSpec = def.attacks[fighter.currentAttack];
      if (wantLight && curSpec.canChainInto && curSpec.canChainInto !== 'heavy') {
        fighter.queuedAttack = curSpec.canChainInto;
      } else if (wantHeavy && curSpec.canChainInto) {
        fighter.queuedAttack = 'heavy';
      }
    }
  }

  fighter.actionTimerMs += dtMs;

  // Check if opponent is vulnerable to an Execution Finisher
  const oppVulnerableForExecution =
    (opponent.action === 'guard_break' ||
      opponent.action === 'parry_stun' ||
      opponent.poise <= 5) &&
    Math.hypot(opponent.x - fighter.x, opponent.z - fighter.z) <= 4.5;

  // State machine transitions
  switch (fighter.action) {
    case 'parry_window': {
      if (fighter.actionTimerMs >= fighter.actionDurationMs) {
        if (input.guardHeld) {
          fighter.action = 'block';
          fighter.actionTimerMs = 0;
          fighter.actionDurationMs = 0;
        } else {
          fighter.action = 'idle';
          fighter.actionTimerMs = 0;
        }
      }
      break;
    }

    case 'dodge': {
      const progress = Math.min(1, fighter.actionTimerMs / fighter.actionDurationMs);
      const speedCurve = Math.sin(progress * Math.PI) * 1.45;
      const baseDodgeSpeed = def.stats.dodgeDistance / (fighter.actionDurationMs / 1000);
      fighter.vx = fighter.dodgeDirX * baseDodgeSpeed * speedCurve;
      fighter.vz = fighter.dodgeDirZ * baseDodgeSpeed * speedCurve;

      if (fighter.actionTimerMs >= fighter.actionDurationMs) {
        fighter.action = 'idle';
        fighter.actionTimerMs = 0;
        fighter.vx = 0;
        fighter.vz = 0;
      }
      break;
    }

    case 'attack_windup': {
      if (fighter.currentAttack) {
        const spec = def.attacks[fighter.currentAttack];
        const fwdX = Math.sin(fighter.facingAngle);
        const fwdZ = Math.cos(fighter.facingAngle);
        const lungeVel = (spec.forwardLunge * 0.55) / (spec.windupMs / 1000);
        fighter.vx = fwdX * lungeVel;
        fighter.vz = fwdZ * lungeVel;

        // Aerial slam accelerates downward
        if (fighter.currentAttack === 'aerial_slam') {
          fighter.vy = Math.min(fighter.vy, -14.0);
        }

        if (fighter.actionTimerMs >= fighter.actionDurationMs) {
          fighter.action = 'attack_active';
          fighter.actionTimerMs = 0;
          fighter.actionDurationMs = spec.activeMs;

          // Floor fracture on heavy / aerial_slam / execution / ability
          if (
            fighter.currentAttack === 'heavy' ||
            fighter.currentAttack === 'aerial_slam' ||
            fighter.currentAttack === 'execution' ||
            fighter.currentAttack === 'ability'
          ) {
            const impactX = fighter.x + fwdX * 1.6;
            const impactZ = fighter.z + fwdZ * 1.6;
            damageArenaFloorAt(
              sim,
              impactX,
              impactZ,
              fighter.currentAttack === 'execution' || fighter.currentAttack === 'ability'
                ? 4.6
                : 3.4,
              fighter.currentAttack === 'execution' || fighter.currentAttack === 'heavy'
            );
          }
        }
      }
      break;
    }

    case 'attack_active': {
      if (fighter.currentAttack) {
        const spec = def.attacks[fighter.currentAttack];
        const fwdX = Math.sin(fighter.facingAngle);
        const fwdZ = Math.cos(fighter.facingAngle);
        const lungeVel = (spec.forwardLunge * 0.45) / (spec.activeMs / 1000);
        fighter.vx = fwdX * lungeVel;
        fighter.vz = fwdZ * lungeVel;

        if (!fighter.attackHasHit) {
          // Check breakable crates & barrels in arc
          damageBreakablePropsInArc(sim, fighter, spec);
          // Check opponent / decoy hit
          resolveAttackHit(sim, fighter, opponent, spec);
        }

        if (fighter.actionTimerMs >= fighter.actionDurationMs) {
          fighter.action = 'attack_recovery';
          fighter.actionTimerMs = 0;
          fighter.actionDurationMs = spec.recoveryMs;
        }
      }
      break;
    }

    case 'attack_recovery': {
      fighter.vx *= Math.pow(0.001, dtSec);
      fighter.vz *= Math.pow(0.001, dtSec);

      // Early combo chain cancel during recovery
      if (fighter.currentAttack) {
        const curSpec = def.attacks[fighter.currentAttack];
        if (wantLight && curSpec.canChainInto && curSpec.canChainInto !== 'heavy') {
          fighter.queuedAttack = curSpec.canChainInto;
        } else if (wantHeavy && curSpec.canChainInto) {
          fighter.queuedAttack = 'heavy';
        }
      }

      if (
        fighter.queuedAttack &&
        fighter.actionTimerMs >= fighter.actionDurationMs * 0.16
      ) {
        const nextAtk = fighter.queuedAttack;
        fighter.queuedAttack = null;
        startAttack(sim, fighter, opponent, nextAtk);
        break;
      }

      // Dodge or Guard cancel out of recovery (snappy response!)
      if (
        wantDodge &&
        fighter.actionTimerMs >= fighter.actionDurationMs * 0.22 &&
        fighter.stamina >= def.stats.dodgeCost
      ) {
        fighter.bufferedInput = null;
        fighter.bufferTimerMs = 0;
        triggerDodge(sim, fighter, opponent, input, def.stats.dodgeCost);
        break;
      }

      if (input.guardJustPressed && fighter.actionTimerMs >= fighter.actionDurationMs * 0.25) {
        fighter.action = 'parry_window';
        fighter.actionTimerMs = 0;
        fighter.actionDurationMs = 210;
        fighter.currentAttack = null;
        fighter.queuedAttack = null;
        break;
      }

      if (fighter.actionTimerMs >= fighter.actionDurationMs) {
        fighter.action = 'idle';
        fighter.actionTimerMs = 0;
        fighter.currentAttack = null;
        fighter.queuedAttack = null;
      }
      break;
    }

    case 'hitstun':
    case 'blockstun':
    case 'guard_break':
    case 'parry_stun': {
      fighter.vx *= Math.pow(0.002, dtSec);
      fighter.vz *= Math.pow(0.002, dtSec);

      // 1. GUARD RIPOSTE / COUNTER-SLASH:
      // While blocking (blockstun) or after 120ms of hitstun, pressing Attack triggers an armored Counter-Riposte!
      const canCounterRiposte =
        (fighter.action === 'blockstun' && fighter.actionTimerMs >= 65) ||
        (fighter.action === 'hitstun' &&
          fighter.actionTimerMs >= Math.min(145, fighter.actionDurationMs * 0.52));

      if (canCounterRiposte && (wantLight || wantHeavy) && fighter.stamina >= 8) {
        const counterAtk: AttackKind = wantHeavy ? 'heavy' : 'light_1';
        fighter.poise = Math.max(fighter.poise, fighter.maxPoise * 0.65);
        startAttack(sim, fighter, opponent, counterAtk, true);
        break;
      }

      // 2. DODGE BREAKOUT / EVADE CANCEL out of hitstun or blockstun:
      const canDodgeEscape =
        (fighter.action === 'blockstun' && fighter.actionTimerMs >= 50) ||
        (fighter.action === 'hitstun' && fighter.actionTimerMs >= 110) ||
        (fighter.action === 'guard_break' && fighter.actionTimerMs >= 380);

      if (canDodgeEscape && wantDodge && fighter.stamina >= def.stats.dodgeCost * 0.75) {
        fighter.bufferedInput = null;
        fighter.bufferTimerMs = 0;
        fighter.consecutiveHitsTaken = 0;
        triggerDodge(sim, fighter, opponent, input, Math.round(def.stats.dodgeCost * 0.75));
        break;
      }

      // 3. TIMED PARRY / GUARD REVERSAL out of hitstun:
      if (
        fighter.action === 'hitstun' &&
        fighter.actionTimerMs >= 115 &&
        (input.guardJustPressed || input.guardHeld) &&
        fighter.stamina >= 8
      ) {
        fighter.action = input.guardJustPressed ? 'parry_window' : 'block';
        fighter.actionTimerMs = 0;
        fighter.actionDurationMs = input.guardJustPressed ? 210 : 0;
        fighter.consecutiveHitsTaken = 0;
        break;
      }

      if (fighter.actionTimerMs >= fighter.actionDurationMs) {
        if (fighter.action === 'guard_break' || fighter.action === 'parry_stun') {
          fighter.poise = fighter.maxPoise * 0.8;
        }
        fighter.counterWindowMs = 380; // Grant counter-attack window on recovery!
        fighter.action = 'idle';
        fighter.actionTimerMs = 0;
      }
      break;
    }

    case 'idle':
    case 'move':
    case 'sprint':
    case 'jump':
    case 'block': {
      fighter.consecutiveHitsTaken = 0;
      const groundSurfaceY = getArenaSurfaceHeight(sim.arenaId, fighter.x, fighter.z);
      const isAirborne = fighter.y > groundSurfaceY + 0.25 || Math.abs(fighter.vy) > 0.1;
      const hasCounterBoost = (fighter.counterWindowMs ?? 0) > 0;

      // 1. Execution Finisher (When enemy is staggered/guard-broken or G pressed)
      if ((wantExec || (wantHeavy && oppVulnerableForExecution)) && oppVulnerableForExecution) {
        startAttack(sim, fighter, opponent, 'execution', true);
        break;
      }

      // 2. Dodge Roll / Jet Thruster Evade
      if (wantDodge && fighter.stamina >= def.stats.dodgeCost) {
        fighter.bufferedInput = null;
        fighter.bufferTimerMs = 0;
        triggerDodge(sim, fighter, opponent, input, def.stats.dodgeCost);
        break;
      }

      // 3. Unique Character Ability
      if (
        wantAbility &&
        fighter.abilityCooldownMs <= 0 &&
        fighter.stamina >= def.ability.staminaCost
      ) {
        startAttack(sim, fighter, opponent, 'ability', hasCounterBoost);
        break;
      }

      // 4. Aerial Slam if attacking mid-air!
      if (
        isAirborne &&
        (wantLight || wantHeavy) &&
        fighter.stamina >= def.attacks.aerial_slam.staminaCost
      ) {
        startAttack(sim, fighter, opponent, 'aerial_slam', true);
        break;
      }

      // 5. Heavy Attack
      if (wantHeavy && fighter.stamina >= def.attacks.heavy.staminaCost) {
        startAttack(sim, fighter, opponent, 'heavy', hasCounterBoost);
        break;
      }

      // 6. Sprint Dash-Strike or Light Attack 1
      if (wantLight) {
        const moveMagCheck = Math.hypot(input.moveX, input.moveZ);
        if (
          input.sprint &&
          moveMagCheck > 0.5 &&
          fighter.stamina >= def.attacks.dash_strike.staminaCost
        ) {
          startAttack(sim, fighter, opponent, 'dash_strike', hasCounterBoost);
          break;
        } else if (fighter.stamina >= def.attacks.light_1.staminaCost * (hasCounterBoost ? 0.5 : 1)) {
          startAttack(sim, fighter, opponent, 'light_1', hasCounterBoost);
          break;
        }
      }

      // 7. Timed Parry / Guard Hold
      if (input.guardJustPressed && fighter.stamina >= 6) {
        fighter.action = 'parry_window';
        fighter.actionTimerMs = 0;
        fighter.actionDurationMs = 215; // Generous 215ms precision parry window
        fighter.vx *= 0.25;
        fighter.vz *= 0.25;
        break;
      }

      if (input.guardHeld && fighter.stamina > 2) {
        fighter.action = 'block';
      } else if (fighter.action === 'block') {
        fighter.action = 'idle';
      }

      // 8. 360-degree Arena Movement + Vertical Thruster Jump
      const moveMag = Math.hypot(input.moveX, input.moveZ);
      const groundY = getArenaSurfaceHeight(sim.arenaId, fighter.x, fighter.z);
      let isGrounded = fighter.y <= groundY + 0.06 && fighter.vy <= 0;

      if (wantJump && isGrounded && fighter.stamina >= 12) {
        fighter.bufferedInput = null;
        fighter.bufferTimerMs = 0;
        fighter.stamina = Math.max(0, fighter.stamina - 12);
        fighter.staminaRegenDelayMs = 450;
        fighter.vy = 9.2; // High-thrust jump easily clears the 1.2m central dais
        fighter.action = 'jump';
        fighter.actionTimerMs = 0;
        fighter.actionDurationMs = 650;
        isGrounded = false;
      }

      if (moveMag > 0.04) {
        const normX = input.moveX / Math.max(1, moveMag);
        const normZ = input.moveZ / Math.max(1, moveMag);
        // Sprinting/running never drains stamina — stamina continues to regenerate while moving!
        const wantsSprint = input.sprint && fighter.action !== 'block';

        let speed = def.stats.walkSpeed;
        if (fighter.action === 'block') {
          speed = def.stats.walkSpeed * 0.48;
        } else if (wantsSprint) {
          speed = def.stats.sprintSpeed;
          if (isGrounded) fighter.action = 'sprint';
        } else if (isGrounded) {
          fighter.action = 'move';
        }

        fighter.vx = normX * speed * Math.min(1, moveMag);
        fighter.vz = normZ * speed * Math.min(1, moveMag);

        if (wantsSprint) {
          fighter.facingAngle = lerpAngle(
            fighter.facingAngle,
            Math.atan2(normX, normZ),
            14 * dtSec
          );
        } else {
          const toOppX = opponent.x - fighter.x;
          const toOppZ = opponent.z - fighter.z;
          if (Math.hypot(toOppX, toOppZ) > 0.1) {
            fighter.facingAngle = lerpAngle(
              fighter.facingAngle,
              Math.atan2(toOppX, toOppZ),
              11 * dtSec
            );
          }
        }
      } else {
        fighter.vx = 0;
        fighter.vz = 0;
        if (fighter.action !== 'block' && fighter.action !== 'jump' && isGrounded) {
          fighter.action = 'idle';
        }
        const toOppX = opponent.x - fighter.x;
        const toOppZ = opponent.z - fighter.z;
        if (Math.hypot(toOppX, toOppZ) > 0.1) {
          fighter.facingAngle = lerpAngle(
            fighter.facingAngle,
            Math.atan2(toOppX, toOppZ),
            9 * dtSec
          );
        }
      }
      break;
    }
  }

  // Integrate horizontal velocity
  fighter.x += fighter.vx * dtSec;
  fighter.z += fighter.vz * dtSec;

  // Integrate vertical velocity (gravity + Foundry dais heightfield)
  const targetGroundY = getArenaSurfaceHeight(sim.arenaId, fighter.x, fighter.z);
  if (fighter.y > targetGroundY || fighter.vy > 0) {
    fighter.vy -= 24.0 * dtSec; // Crisp mech gravity
    fighter.y += fighter.vy * dtSec;
    if (fighter.y <= targetGroundY) {
      fighter.y = targetGroundY;
      fighter.vy = 0;
      if (fighter.action === 'jump') {
        fighter.action = 'idle';
      }
    }
  } else {
    // Smoothly step up/down onto the central octagonal dais stairs
    fighter.y = targetGroundY;
    fighter.vy = 0;
  }

  // Collide against arena bounds, pillars, pistons, braziers, vents, and intact breakable crates/barrels
  clampAndCollideArena(sim, fighter);
}

function triggerDodge(
  sim: SimulationState,
  fighter: FighterState,
  opponent: FighterState,
  input: FighterInput,
  staminaCost: number
): void {
  fighter.stamina = Math.max(0, fighter.stamina - staminaCost);
  fighter.staminaRegenDelayMs = 520;
  fighter.action = 'dodge';
  fighter.actionTimerMs = 0;
  fighter.actionDurationMs = 340;
  fighter.invulnerableMs = 240;
  fighter.currentAttack = null;
  fighter.queuedAttack = null;

  const mag = Math.hypot(input.moveX, input.moveZ);
  if (mag > 0.1) {
    fighter.dodgeDirX = input.moveX / mag;
    fighter.dodgeDirZ = input.moveZ / mag;
  } else {
    // Default backstep away from opponent
    const dx = fighter.x - opponent.x;
    const dz = fighter.z - opponent.z;
    const d = Math.hypot(dx, dz) || 1;
    fighter.dodgeDirX = dx / d;
    fighter.dodgeDirZ = dz / d;
  }
  fighter.facingAngle = Math.atan2(fighter.dodgeDirX, fighter.dodgeDirZ);

  sim.events.push({
    type: 'dodge_dash',
    attackerId: fighter.id,
    facingAngle: fighter.facingAngle,
    x: fighter.x,
    y: fighter.y + 0.9,
    z: fighter.z,
    label: 'DASH EVADE',
  });
}

function resolveAttackHit(
  sim: SimulationState,
  attacker: FighterState,
  defender: FighterState,
  spec: AttackSpec
): void {
  const fwdX = Math.sin(attacker.facingAngle);
  const fwdZ = Math.cos(attacker.facingAngle);

  // Check if attacker hits an active Rift decoy first
  if (sim.decoy && sim.decoy.active && sim.decoy.ownerId === defender.id) {
    const ddx = sim.decoy.x - attacker.x;
    const ddz = sim.decoy.z - attacker.z;
    const dDist = Math.hypot(ddx, ddz);
    if (dDist <= spec.range + 0.5) {
      const dirX = dDist > 0.001 ? ddx / dDist : fwdX;
      const dirZ = dDist > 0.001 ? ddz / dDist : fwdZ;
      const dot = fwdX * dirX + fwdZ * dirZ;
      if (dot >= spec.arcCos) {
        sim.decoy.active = false;
        attacker.attackHasHit = true;
        sim.hitstopMs = 55;
        sim.events.push({
          type: 'decoy_shatter',
          attackerId: attacker.id,
          defenderId: defender.id,
          x: sim.decoy.x,
          y: 1.2,
          z: sim.decoy.z,
          label: 'DECOY SHATTERED',
        });
        return;
      }
    }
  }

  const dx = defender.x - attacker.x;
  const dz = defender.z - attacker.z;
  const dist = Math.hypot(dx, dz);

  // Fighter capsule radius is ~0.78m
  if (dist > spec.range + 0.78) {
    return;
  }

  // Vertical proximity check
  if (Math.abs(defender.y - attacker.y) > 2.2) {
    return;
  }

  const dirX = dist > 0.0001 ? dx / dist : fwdX;
  const dirZ = dist > 0.0001 ? dz / dist : fwdZ;
  const dot = fwdX * dirX + fwdZ * dirZ;

  if (dot < spec.arcCos && dist > 1.25) {
    return;
  }

  attacker.attackHasHit = true;

  // 1. Dodge I-Frames Evasion
  if (defender.invulnerableMs > 0) {
    sim.events.push({
      type: 'dodge_evade',
      attackerId: attacker.id,
      defenderId: defender.id,
      x: defender.x,
      y: defender.y + 1.1,
      z: defender.z,
      label: 'EVADED',
    });
    return;
  }

  // Check if defender is facing the attacker for directional block/parry
  const defFwdX = Math.sin(defender.facingAngle);
  const defFwdZ = Math.cos(defender.facingAngle);
  const toAttackerX = -dirX;
  const toAttackerZ = -dirZ;
  const defFacingDot = defFwdX * toAttackerX + defFwdZ * toAttackerZ;

  // 2. Precision Timed Parry!
  if (defender.action === 'parry_window' && defFacingDot > -0.1) {
    defender.parriesLanded += 1;
    defender.stamina = Math.min(defender.maxStamina, defender.stamina + 28);
    defender.poise = defender.maxPoise;
    defender.action = 'idle';
    defender.actionTimerMs = 0;

    attacker.action = 'parry_stun';
    attacker.actionTimerMs = 0;
    attacker.actionDurationMs = 950;
    attacker.currentAttack = null;
    attacker.poise = 0; // Vulnerable to immediate Execution!
    attacker.vx = -fwdX * 4.5;
    attacker.vz = -fwdZ * 4.5;

    sim.hitstopMs = 130;
    sim.slowMoMs = 340;
    sim.screenShake = Math.max(sim.screenShake, 0.58);

    sim.events.push({
      type: 'parried',
      attackerId: attacker.id,
      defenderId: defender.id,
      x: (attacker.x + defender.x) * 0.5,
      y: Math.max(attacker.y, defender.y) + 1.35,
      z: (attacker.z + defender.z) * 0.5,
      label: 'PARRIED! EXECUTE READY!',
    });
    return;
  }

  // 3. Directional Guard / Block
  if (
    (defender.action === 'block' || defender.action === 'blockstun') &&
    defFacingDot > 0.0 &&
    spec.id !== 'execution'
  ) {
    defender.stamina -= spec.guardDamage;
    defender.poise = Math.max(0, defender.poise - spec.poiseDamage * 0.5);
    defender.staminaRegenDelayMs = 700;
    defender.hp = Math.max(1, defender.hp - spec.chipDamage);

    if (defender.stamina <= 0) {
      // Guard Crush!
      defender.stamina = 0;
      defender.poise = 0;
      defender.action = 'guard_break';
      defender.actionTimerMs = 0;
      defender.actionDurationMs = 1150;
      defender.vx = dirX * spec.knockback * 3.8;
      defender.vz = dirZ * spec.knockback * 3.8;

      sim.hitstopMs = 115;
      sim.slowMoMs = 260;
      sim.screenShake = Math.max(sim.screenShake, 0.65);

      sim.events.push({
        type: 'guard_break',
        attackerId: attacker.id,
        defenderId: defender.id,
        x: defender.x,
        y: defender.y + 1.35,
        z: defender.z,
        damage: spec.chipDamage,
        label: 'GUARD CRUSH! EXECUTE!',
      });
    } else {
      defender.action = 'blockstun';
      defender.actionTimerMs = 0;
      defender.actionDurationMs = spec.blockstunMs;
      defender.vx = dirX * spec.knockback * 2.2;
      defender.vz = dirZ * spec.knockback * 2.2;

      sim.hitstopMs = 45;
      sim.screenShake = Math.max(sim.screenShake, 0.22);

      sim.events.push({
        type: 'blocked',
        attackerId: attacker.id,
        defenderId: defender.id,
        x: (attacker.x + defender.x) * 0.5,
        y: Math.max(attacker.y, defender.y) + 1.25,
        z: (attacker.z + defender.z) * 0.5,
        damage: spec.chipDamage,
        label: 'BLOCKED',
      });
    }
    return;
  }

  // 4. Clean Direct Hit!
  const isPunish =
    defender.action === 'parry_stun' || defender.action === 'guard_break';
  const defenderHasHyperArmor =
    (defender.hyperArmorMs ?? 0) > 0 &&
    (defender.action === 'attack_windup' || defender.action === 'attack_active');

  // Hyper-Armor absorbs 40% of damage and prevents attack interruption!
  const finalDamage = Math.round(
    spec.damage * (isPunish ? 1.25 : defenderHasHyperArmor ? 0.6 : 1.0)
  );

  defender.hp = Math.max(0, defender.hp - finalDamage);
  defender.hitFlashMs = 175;

  if (defenderHasHyperArmor && defender.hp > 0 && spec.id !== 'execution') {
    // Defender powers right through the hit without losing their attack!
    defender.poise = Math.max(15, defender.poise - spec.poiseDamage * 0.35);
  } else {
    defender.poise = Math.max(0, defender.poise - spec.poiseDamage);
    defender.currentAttack = null;
    defender.queuedAttack = null;
    defender.consecutiveHitsTaken = (defender.consecutiveHitsTaken ?? 0) + 1;

    // 3-Hit Combo Breaker Protection: prevents any stunlock longer than 3 hits!
    if ((defender.consecutiveHitsTaken ?? 0) >= 3 && defender.hp > 0) {
      defender.consecutiveHitsTaken = 0;
      defender.poise = defender.maxPoise;
      defender.invulnerableMs = 260;
      defender.counterWindowMs = 450;
      defender.action = 'hitstun';
      defender.actionTimerMs = 0;
      defender.actionDurationMs = 190;
      defender.vx = dirX * 7.2;
      defender.vz = dirZ * 7.2;
    } else if (
      defender.poise <= 0 &&
      (spec.id === 'heavy' || spec.id === 'ability' || spec.id === 'aerial_slam') &&
      defender.hp > 0
    ) {
      // Only heavy/ability/aerial strikes can trigger stagger when poise breaks
      defender.poise = 0;
      defender.action = 'guard_break';
      defender.actionTimerMs = 0;
      defender.actionDurationMs = 680;
      defender.vx = dirX * spec.knockback * 3.8;
      defender.vz = dirZ * spec.knockback * 3.8;
      sim.events.push({
        type: 'guard_break',
        attackerId: attacker.id,
        defenderId: defender.id,
        x: defender.x,
        y: defender.y + 1.5,
        z: defender.z,
        damage: finalDamage,
        label: 'STAGGERED! EXECUTE READY!',
      });
    } else {
      defender.action = 'hitstun';
      defender.actionTimerMs = 0;
      defender.actionDurationMs = spec.hitstunMs;
      defender.counterWindowMs = 360;
      if (spec.id === 'execution' || defender.poise <= 0) {
        defender.poise = defender.maxPoise * 0.75;
      }
      defender.vx = dirX * spec.knockback * 4.2;
      defender.vz = dirZ * spec.knockback * 4.2;
    }
  }

  attacker.totalDamageDealt += finalDamage;
  attacker.comboCount += 1;
  attacker.comboDamage += finalDamage;
  attacker.comboResetTimerMs = 2300;

  const isHeavyImpact =
    spec.id === 'heavy' ||
    spec.id === 'light_3' ||
    spec.id === 'ability' ||
    spec.id === 'aerial_slam' ||
    spec.id === 'execution';

  sim.hitstopMs = spec.id === 'execution' ? 140 : isHeavyImpact ? 95 : 55;
  sim.screenShake = Math.max(
    sim.screenShake,
    spec.id === 'execution' ? 0.88 : isHeavyImpact ? 0.58 : 0.28
  );
  if (spec.id === 'execution') {
    sim.slowMoMs = 360;
  }

  if (defender.hp <= 0) {
    sim.slowMoMs = 680;
    sim.hitstopMs = 150;
    sim.screenShake = 0.92;
  }

  sim.events.push({
    type:
      spec.id === 'execution'
        ? 'execution_hit'
        : spec.id === 'ability'
          ? 'hit_ability'
          : isHeavyImpact
            ? 'hit_heavy'
            : 'hit_light',
    attackerId: attacker.id,
    defenderId: defender.id,
    x: (attacker.x + defender.x) * 0.5,
    y: Math.max(attacker.y, defender.y) + 1.25,
    z: (attacker.z + defender.z) * 0.5,
    damage: finalDamage,
    label:
      spec.id === 'execution'
        ? `EXECUTION! -${finalDamage}`
        : isPunish
          ? `CRITICAL -${finalDamage}`
          : `-${finalDamage}`,
  });
}

function updateProjectiles(sim: SimulationState, dtMs: number): void {
  if (sim.projectiles.length === 0) return;
  const dtSec = dtMs / 1000;

  for (let i = sim.projectiles.length - 1; i >= 0; i--) {
    const proj = sim.projectiles[i];
    proj.remainingMs -= dtMs;
    if (proj.remainingMs <= 0) {
      sim.projectiles.splice(i, 1);
      continue;
    }

    const target = proj.ownerId === 'p1' ? sim.p2 : sim.p1;
    const attacker = proj.ownerId === 'p1' ? sim.p1 : sim.p2;

    // Subtle homing toward target
    const toX = target.x - proj.x;
    const toZ = target.z - proj.z;
    const toDist = Math.hypot(toX, toZ) || 1;
    proj.vx += (toX / toDist) * 18 * dtSec;
    proj.vz += (toZ / toDist) * 18 * dtSec;
    const speed = Math.hypot(proj.vx, proj.vz) || 1;
    if (speed > 14.5) {
      proj.vx = (proj.vx / speed) * 14.5;
      proj.vz = (proj.vz / speed) * 14.5;
    }

    proj.x += proj.vx * dtSec;
    proj.z += proj.vz * dtSec;
    proj.y = getArenaSurfaceHeight(sim.arenaId, proj.x, proj.z) + 1.25;

    // Check collision with breakable props
    let hitSomething = false;
    for (const prop of sim.breakableProps) {
      if (prop.broken) continue;
      if (Math.hypot(prop.x - proj.x, prop.z - proj.z) <= prop.radius + proj.radius) {
        prop.hp = 0;
        prop.broken = true;
        sim.events.push({
          type: 'prop_shatter',
          attackerId: attacker.id,
          x: prop.x,
          y: prop.height * 0.5,
          z: prop.z,
          label: prop.kind === 'barrel' ? 'BARREL SHATTERED!' : 'CRATE DESTROYED!',
          propId: prop.id,
          propKind: prop.kind,
        });
        if (prop.kind === 'barrel') {
          triggerBarrelExplosion(sim, prop, attacker.id);
        }
        hitSomething = true;
        break;
      }
    }
    if (hitSomething) {
      damageArenaFloorAt(sim, proj.x, proj.z, 2.8, false);
      sim.projectiles.splice(i, 1);
      continue;
    }

    // Check collision with target fighter
    const distToTarget = Math.hypot(target.x - proj.x, target.z - proj.z);
    if (distToTarget <= proj.radius + 0.78) {
      if (target.invulnerableMs <= 0) {
        target.hp = Math.max(0, target.hp - proj.damage);
        target.poise = Math.max(0, target.poise - proj.poiseDamage);
        target.hitFlashMs = 190;
        target.action = target.poise <= 0 ? 'guard_break' : 'hitstun';
        target.actionTimerMs = 0;
        target.actionDurationMs = target.poise <= 0 ? 1000 : 520;
        target.vx = (proj.vx / speed) * 6.5;
        target.vz = (proj.vz / speed) * 6.5;
        attacker.totalDamageDealt += proj.damage;
        attacker.comboCount += 1;
        attacker.comboDamage += proj.damage;
        attacker.comboResetTimerMs = 2300;
        sim.hitstopMs = 70;
        sim.screenShake = Math.max(sim.screenShake, 0.52);
        damageArenaFloorAt(sim, target.x, target.z, 3.2, false);
        sim.events.push({
          type: 'hit_ability',
          attackerId: attacker.id,
          defenderId: target.id,
          x: target.x,
          y: target.y + 1.25,
          z: target.z,
          damage: proj.damage,
          label: `PLASMA ORB -${proj.damage}`,
        });
      }
      sim.projectiles.splice(i, 1);
    }
  }
}

function clampAndCollideArena(sim: SimulationState, fighter: FighterState): void {
  const arena = ARENA_REGISTRY[sim.arenaId] || ARENA_REGISTRY.foundry_arena;
  const fighterRadius = 0.76;

  // 1. Clamp to rectangular perimeter walls
  if (fighter.x < arena.bounds.minX + fighterRadius) {
    fighter.x = arena.bounds.minX + fighterRadius;
    if (fighter.vx < 0) fighter.vx = 0;
  } else if (fighter.x > arena.bounds.maxX - fighterRadius) {
    fighter.x = arena.bounds.maxX - fighterRadius;
    if (fighter.vx > 0) fighter.vx = 0;
  }

  if (fighter.z < arena.bounds.minZ + fighterRadius) {
    fighter.z = arena.bounds.minZ + fighterRadius;
    if (fighter.vz < 0) fighter.vz = 0;
  } else if (fighter.z > arena.bounds.maxZ - fighterRadius) {
    fighter.z = arena.bounds.maxZ - fighterRadius;
    if (fighter.vz > 0) fighter.vz = 0;
  }

  // 1b. Collide with Central Safe Dais vertical walls when on the lower floor (y < 0.85)
  // unless walking onto the West/East stepped ramps (|z| <= 3.05)
  if (fighter.y < 0.85) {
    const daisHalfW = 10.0 + fighterRadius;
    const daisHalfD = 5.0 + fighterRadius;
    const ax = Math.abs(fighter.x);
    const az = Math.abs(fighter.z);
    const onSteppedRamp = az <= 3.05 && ax >= 9.6;

    if (!onSteppedRamp && ax < daisHalfW && az < daisHalfD) {
      const penX = daisHalfW - ax;
      const penZ = daisHalfD - az;
      if (penX < penZ) {
        fighter.x = fighter.x >= 0 ? daisHalfW : -daisHalfW;
        if ((fighter.x > 0 && fighter.vx < 0) || (fighter.x < 0 && fighter.vx > 0)) {
          fighter.vx = 0;
        }
      } else {
        fighter.z = fighter.z >= 0 ? daisHalfD : -daisHalfD;
        if ((fighter.z > 0 && fighter.vz < 0) || (fighter.z < 0 && fighter.vz > 0)) {
          fighter.vz = 0;
        }
      }
    }
  }

  // 2. Collide with static architectural colliders (Barricades, Conveyor, Pillars)
  for (const col of arena.colliders) {
    // Only collide if fighter is below the top of the obstacle
    if (fighter.y >= col.height - 0.1) continue;

    const dx = fighter.x - col.x;
    const dz = fighter.z - col.z;
    const dist = Math.hypot(dx, dz);
    const minDist = col.radius + fighterRadius;

    if (dist < minDist) {
      const nx = dist > 0.0001 ? dx / dist : 1;
      const nz = dist > 0.0001 ? dz / dist : 0;
      fighter.x = col.x + nx * minDist;
      fighter.z = col.z + nz * minDist;

      // Project velocity onto tangent so fighter slides smoothly along pillars without sticking
      const vn = fighter.vx * nx + fighter.vz * nz;
      if (vn < 0) {
        fighter.vx -= vn * nx;
        fighter.vz -= vn * nz;
      }
    }
  }

  // 3. Collide with intact breakable crates & barrels (Shattering them if sprinting/dodging/knocked into them!)
  for (const prop of sim.breakableProps) {
    if (prop.broken) continue;
    if (fighter.y >= prop.height + 0.15) continue;

    const dx = fighter.x - prop.x;
    const dz = fighter.z - prop.z;
    const dist = Math.hypot(dx, dz);
    const minDist = prop.radius + fighterRadius;

    if (dist < minDist) {
      const speed = Math.hypot(fighter.vx, fighter.vz);
      const isHighMomentum =
        fighter.action === 'dodge' ||
        fighter.action === 'hitstun' ||
        fighter.action === 'guard_break' ||
        (fighter.action === 'sprint' && speed > 8.2);

      if (isHighMomentum) {
        prop.hp = Math.max(0, prop.hp - 18);
        prop.hitFlashMs = 140;
        if (prop.hp <= 0) {
          prop.broken = true;
          sim.screenShake = Math.max(sim.screenShake, 0.3);
          sim.events.push({
            type: 'prop_shatter',
            attackerId: fighter.id,
            x: prop.x,
            y: prop.height * 0.5,
            z: prop.z,
            label: prop.kind === 'barrel' ? 'BARREL SHATTERED!' : 'CRATE SMASHED!',
            propId: prop.id,
            propKind: prop.kind,
          });
          if (prop.kind === 'barrel') {
            triggerBarrelExplosion(sim, prop, fighter.id);
          }
          continue; // Immediately pass through broken prop!
        }
      }

      const nx = dist > 0.0001 ? dx / dist : 1;
      const nz = dist > 0.0001 ? dz / dist : 0;
      fighter.x = prop.x + nx * minDist;
      fighter.z = prop.z + nz * minDist;

      const vn = fighter.vx * nx + fighter.vz * nz;
      if (vn < 0) {
        fighter.vx -= vn * nx;
        fighter.vz -= vn * nz;
      }
    }
  }
}

function resolveFighterToFighterCollision(p1: FighterState, p2: FighterState): void {
  const minSeparation = 1.48;
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const dist = Math.hypot(dx, dz);
  if (dist < minSeparation) {
    const overlap = (minSeparation - dist) * 0.5;
    const nx = dist > 0.0001 ? dx / dist : 1;
    const nz = dist > 0.0001 ? dz / dist : 0;
    p1.x -= nx * overlap;
    p1.z -= nz * overlap;
    p2.x += nx * overlap;
    p2.z += nz * overlap;
  }
}

export function stepSimulation(
  sim: SimulationState,
  p1Input: FighterInput,
  p2Input: FighterInput,
  rawDtMs: number,
  isTraining = false,
  trainingConfig?: TrainingConfig
): void {
  sim.events = [];

  if (sim.roundOver) {
    return;
  }

  // Decay screen shake
  sim.screenShake = Math.max(0, sim.screenShake - (rawDtMs / 1000) * 2.2);

  // Decay prop hit flash timers
  for (const prop of sim.breakableProps) {
    if (prop.hitFlashMs > 0) {
      prop.hitFlashMs = Math.max(0, prop.hitFlashMs - rawDtMs);
    }
  }

  // Hitstop freeze frames for heavy impact feel
  if (sim.hitstopMs > 0) {
    sim.hitstopMs = Math.max(0, sim.hitstopMs - rawDtMs);
    return;
  }

  // Slow-motion scaling on parries, executions, and KOs
  let dtMs = rawDtMs;
  if (sim.slowMoMs > 0) {
    sim.slowMoMs = Math.max(0, sim.slowMoMs - rawDtMs);
    dtMs = rawDtMs * 0.32;
  }

  // Update active decoy
  if (sim.decoy && sim.decoy.active) {
    sim.decoy.remainingMs -= dtMs;
    if (sim.decoy.remainingMs <= 0) {
      sim.decoy.active = false;
    }
  }

  // Update दोनों fighters
  updateSingleFighter(sim, sim.p1, sim.p2, p1Input, dtMs, trainingConfig);
  updateSingleFighter(sim, sim.p2, sim.p1, p2Input, dtMs, trainingConfig);

  // Update projectiles
  updateProjectiles(sim, dtMs);

  // Prevent character mesh overlap
  resolveFighterToFighterCollision(sim.p1, sim.p2);
  clampAndCollideArena(sim, sim.p1);
  clampAndCollideArena(sim, sim.p2);

  if (isTraining) {
    // In training mode, prevent KO so player can practice combos endlessly
    if (sim.p1.hp <= 1) sim.p1.hp = sim.p1.maxHp;
    if (sim.p2.hp <= 1) sim.p2.hp = sim.p2.maxHp;
    return;
  }

  // Round timer
  sim.roundTimerMs = Math.max(0, sim.roundTimerMs - dtMs);

  // Check KO or Time Out
  if (sim.p1.hp <= 0 || sim.p2.hp <= 0 || sim.roundTimerMs <= 0) {
    sim.roundOver = true;

    if (sim.p1.hp <= 0 && sim.p2.hp <= 0) {
      sim.roundWinner = 'draw';
    } else if (sim.p2.hp <= 0) {
      sim.roundWinner = 'p1';
      sim.p1RoundsWon += 1;
    } else if (sim.p1.hp <= 0) {
      sim.roundWinner = 'p2';
      sim.p2RoundsWon += 1;
    } else {
      // Time out: higher HP percentage wins
      const p1Pct = sim.p1.hp / sim.p1.maxHp;
      const p2Pct = sim.p2.hp / sim.p2.maxHp;
      if (Math.abs(p1Pct - p2Pct) < 0.001) {
        sim.roundWinner = 'draw';
      } else if (p1Pct > p2Pct) {
        sim.roundWinner = 'p1';
        sim.p1RoundsWon += 1;
      } else {
        sim.roundWinner = 'p2';
        sim.p2RoundsWon += 1;
      }
    }

    if (sim.p1RoundsWon >= sim.roundsToWin) {
      sim.matchOver = true;
      sim.matchWinner = 'p1';
    } else if (sim.p2RoundsWon >= sim.roundsToWin) {
      sim.matchOver = true;
      sim.matchWinner = 'p2';
    }

    sim.events.push({
      type: 'ko',
      x: 0,
      y: 2.0,
      z: 0,
      label: sim.roundTimerMs <= 0 ? 'TIME OVER' : 'KNOCKOUT',
    });
  }
}
