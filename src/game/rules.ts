import {
  ARENA_REGISTRY,
  type ArenaDefinition,
  type ArenaId,
  BOT_DIFFICULTIES,
  type BotDifficulty,
  type CharacterId,
  DEATHMATCH_DURATION_SECONDS,
  LOADOUT_PAIRS,
  type MapBoxBlock,
  type SurfaceMaterial,
  type TrainingConfig,
  WEAPON_ORDER,
  WEAPON_REGISTRY,
  type WeaponId,
} from './config.ts';
import type {
  ADSControllerState,
  AimInputMode,
  OpticId,
  WeaponOpticLoadout,
} from './ads/ads.types.ts';
import { DEFAULT_WEAPON_OPTICS } from './ads/optic.config.ts';
import {
  cancelADSController,
  createInitialADSControllerState,
  stepADSController,
} from './ads/ADSController.ts';
import { computeAimSensitivityMultiplier } from './ads/AimSensitivityController.ts';
import {
  cycleWeaponOptic,
  equipOpticForWeapon,
  resolveEquippedOptic,
} from './ads/ScopeAttachmentSystem.ts';
import {
  computeEffectiveWeaponStats,
  createInitialPlayerInventory,
  type EffectiveWeaponStats,
  findWeaponInstanceForWeaponId,
  type PlayerInventoryState,
  syncExternalOpticSelectionToInventory,
  syncInventoryToPlayerState,
  type WorldLootItem,
} from './inventory/index.ts';

export type { SurfaceMaterial };

export interface PlayerInputSnapshot {
  moveX: number; // -1 (left) to +1 (right) strafe
  moveZ: number; // -1 (forward) to +1 (backward)
  lookDeltaYaw: number; // radians delta
  lookDeltaPitch: number; // radians delta
  sprintHeld: boolean;
  jumpPressed: boolean;
  crouchToggled: boolean;
  crouchHeld?: boolean;
  slidePressed?: boolean;
  fireHeld: boolean;
  fireJustPressed: boolean;
  adsHeld: boolean;
  aimMode?: AimInputMode;
  reloadPressed: boolean;
  selectWeapon?: WeaponId | null;
  cycleWeaponDelta?: number; // +1 or -1
}

export interface WeaponAmmoState {
  mag: number;
  reserve: number;
}

export interface PlayerShooterState {
  characterId: CharacterId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number; // radians, 0 = looking toward -Z (North)
  pitch: number; // radians, positive = looking up
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  isGrounded: boolean;
  isCrouching: boolean;
  isSliding: boolean;
  slideTimerMs: number;
  slideCooldownMs: number;
  slideDirX: number;
  slideDirZ: number;
  isSprinting: boolean;
  isAds: boolean;
  adsBlend: number; // 0 (hip) to 1 (full ADS)
  adsState: ADSControllerState;
  weaponOptics: WeaponOpticLoadout;
  inventory: PlayerInventoryState;
  eyeHeight: number;
  loadoutWeapons: [WeaponId, WeaponId];
  activeWeapon: WeaponId;
  previousWeapon?: WeaponId;
  weapons: Record<WeaponId, WeaponAmmoState>;
  fireCooldownMs: number;
  reloadTimerMs: number;
  isReloading: boolean;
  weaponSwitchTimerMs: number;
  weaponSwitchDurationMs?: number;
  awaitingRespawn?: boolean;
  recoilKickPitch: number;
  recoilKickYaw: number;
  muzzleFlashTimerMs: number;
  hurtFlashMs: number;
  walkBobPhase: number;
  currentSurface: SurfaceMaterial;
  footstepDistance: number;
  footstepCount: number;
  wallObstruction: number;
  kills: number;
  deaths: number;
  headshots: number;
  shotsFired: number;
  shotsHit: number;
  score: number;
  streak: number;
}

export type EnemyArchetype = 'assault' | 'rusher' | 'sniper';

export interface EnemyBotState {
  id: string;
  name: string;
  characterId: CharacterId;
  archetype: EnemyArchetype;
  weaponId: WeaponId;
  secondaryWeaponId: WeaponId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  hp: number;
  maxHp: number;
  kills: number;
  deaths: number;
  score: number;
  skirmishTimerMs: number;
  state: 'patrol' | 'advance' | 'strafe' | 'telegraph' | 'attack' | 'hitstun' | 'ko';
  stateTimerMs: number;
  fireCooldownMs: number;
  telegraphTimerMs: number;
  hitFlashMs: number;
  koTimerMs: number;
  respawnTimerMs: number;
  muzzleFlashTimerMs: number;
  attackAnimTimerMs: number;
  strafeDir: 1 | -1;
  patrolX: number;
  patrolZ: number;
  walkCycle: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  isPlayer: boolean;
  kills: number;
  deaths: number;
  score: number;
  weapons: [WeaponId, WeaponId];
}

export interface BulletTrace {
  id: number;
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
  ttlMs: number;
  maxTtlMs: number;
  colorHex: number;
  isHeadshot: boolean;
  isEnemyShot: boolean;
  weaponId?: WeaponId;
  hitNormalX: number;
  hitNormalY: number;
  hitNormalZ: number;
  hitKind: 'wall' | 'enemy' | 'headshot' | 'prop' | 'sky';
  propKind?: 'crate' | 'barrel';
  damage?: number;
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
  brokenTimerMs: number;
  hitFlashMs: number;
  explosiveRadius?: number;
  explosiveDamage?: number;
}

export interface MapPickupState {
  id: string;
  x: number;
  z: number;
  kind: 'ammo' | 'health';
  active: boolean;
  respawnTimerMs: number;
}

export interface CombatEvent {
  type:
    | 'shot_fired'
    | 'hit_body'
    | 'headshot'
    | 'enemy_killed'
    | 'player_hurt'
    | 'player_respawn'
    | 'reload_start'
    | 'reload_done'
    | 'dry_fire'
    | 'weapon_switch'
    | 'slide_start'
    | 'footstep'
    | 'barrel_explode'
    | 'prop_shatter'
    | 'pickup_collected'
    | 'wave_clear';
  actor: 'p1' | 'p2';
  label: string;
  weaponId?: WeaponId;
  surface?: SurfaceMaterial;
  stepIntensity?: 'walk' | 'sprint' | 'crouch' | 'land';
  damage?: number;
  x?: number;
  y?: number;
  z?: number;
}

export interface SimulationState {
  arenaId: ArenaId;
  player: PlayerShooterState;
  enemies: EnemyBotState[];
  traces: BulletTrace[];
  breakableProps: BreakablePropState[];
  pickups: MapPickupState[];
  worldLoot: WorldLootItem[];
  waveNumber: number;
  waveKills: number;
  waveTargetKills: number;
  roundNumber: number;
  roundsToWin: number;
  p1RoundsWon: number;
  p2RoundsWon: number;
  roundTimerSec: number;
  maxRoundTimeSec: number;
  roundOver: boolean;
  matchOver: boolean;
  roundWinner: 'p1' | 'p2' | 'draw' | null;
  matchWinner: 'p1' | 'p2' | null;
  winnerName: string | null;
  winnerKills: number;
  hitstopMs: number;
  cameraShakeTrauma: number;
  nextTraceId: number;
  // Backwards-compatible fighter references for existing UI/menus
  p1: PlayerShooterState;
  p2: { characterId: CharacterId; hp: number; maxHp: number };
}

function createInitialWeaponsMap(): Record<WeaponId, WeaponAmmoState> {
  const map = {} as Record<WeaponId, WeaponAmmoState>;
  for (const id of WEAPON_ORDER) {
    const spec = WEAPON_REGISTRY[id];
    map[id] = {
      mag: spec.magSize,
      reserve: spec.reserveMax,
    };
  }
  return map;
}

export function createPlayerShooterState(
  characterId: CharacterId = 'volt',
  startWeapon: WeaponId = 'm4a1',
  loadoutPair: [WeaponId, WeaponId] = LOADOUT_PAIRS[0].weapons
): PlayerShooterState {
  const pair: [WeaponId, WeaponId] =
    loadoutPair && loadoutPair.length === 2 ? [loadoutPair[0], loadoutPair[1]] : ['m4a1', 'awp'];
  const initialActive = pair.includes(startWeapon) ? startWeapon : pair[0];
  return {
    characterId,
    x: 0,
    y: 0,
    z: 20, // Spawns in South courtyard facing North (-Z) toward central compound
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0, // Facing North (-Z)
    pitch: 0,
    hp: 100,
    maxHp: 100,
    stamina: 100,
    maxStamina: 100,
    isGrounded: true,
    isCrouching: false,
    isSliding: false,
    slideTimerMs: 0,
    slideCooldownMs: 0,
    slideDirX: 0,
    slideDirZ: -1,
    isSprinting: false,
    isAds: false,
    adsBlend: 0,
    adsState: createInitialADSControllerState(
      initialActive,
      DEFAULT_WEAPON_OPTICS[initialActive] ?? 'none'
    ),
    weaponOptics: { ...DEFAULT_WEAPON_OPTICS },
    inventory: createInitialPlayerInventory(pair, { ...DEFAULT_WEAPON_OPTICS }),
    eyeHeight: 1.68,
    loadoutWeapons: pair,
    activeWeapon: initialActive,
    previousWeapon: initialActive,
    weapons: createInitialWeaponsMap(),
    fireCooldownMs: 0,
    reloadTimerMs: 0,
    isReloading: false,
    weaponSwitchTimerMs: 0,
    weaponSwitchDurationMs: 340,
    awaitingRespawn: false,
    recoilKickPitch: 0,
    recoilKickYaw: 0,
    muzzleFlashTimerMs: 0,
    hurtFlashMs: 0,
    walkBobPhase: 0,
    currentSurface: 'concrete',
    footstepDistance: 1.5,
    footstepCount: 0,
    wallObstruction: 0,
    kills: 0,
    deaths: 0,
    headshots: 0,
    shotsFired: 0,
    shotsHit: 0,
    score: 0,
    streak: 0,
  };
}

function createInitialEnemies(arena: ArenaDefinition): EnemyBotState[] {
  const templates: {
    id: string;
    name: string;
    characterId: CharacterId;
    archetype: EnemyArchetype;
    weaponId: WeaponId;
    secondaryWeaponId: WeaponId;
    spawnIdx: number;
    hp: number;
  }[] = [
    { id: 'bot_1', name: 'Vanguard-1', characterId: 'volt', archetype: 'assault', weaponId: 'm4a1', secondaryWeaponId: 'awp', spawnIdx: 0, hp: 100 },
    { id: 'bot_2', name: 'Striker-2', characterId: 'rift', archetype: 'rusher', weaponId: 'mp5', secondaryWeaponId: 'deagle', spawnIdx: 1, hp: 90 },
    { id: 'bot_3', name: 'Breacher-3', characterId: 'chroma', archetype: 'rusher', weaponId: 'spas12', secondaryWeaponId: 'ak47', spawnIdx: 2, hp: 95 },
    { id: 'bot_4', name: 'Overwatch-4', characterId: 'kestrel', archetype: 'sniper', weaponId: 'awp', secondaryWeaponId: 'm4a1', spawnIdx: 7, hp: 85 },
    { id: 'bot_5', name: 'Sentinel-5', characterId: 'chroma', archetype: 'assault', weaponId: 'ak47', secondaryWeaponId: 'spas12', spawnIdx: 3, hp: 105 },
    { id: 'bot_6', name: 'Enforcer-6', characterId: 'volt', archetype: 'assault', weaponId: 'm4a1', secondaryWeaponId: 'deagle', spawnIdx: 4, hp: 100 },
  ];

  return templates.map((t, idx) => {
    const sp = arena.spawnPoints[t.spawnIdx % arena.spawnPoints.length] || { x: 0, z: -30 };
    return {
      id: t.id,
      name: t.name,
      characterId: t.characterId,
      archetype: t.archetype,
      weaponId: t.weaponId,
      secondaryWeaponId: t.secondaryWeaponId,
      x: sp.x,
      y: 0,
      z: sp.z,
      vx: 0,
      vz: 0,
      yaw: Math.PI, // Facing South (+Z) toward player
      hp: t.hp,
      maxHp: t.hp,
      kills: 0,
      deaths: 0,
      score: 0,
      skirmishTimerMs: 11000 + idx * 3500,
      state: 'advance',
      stateTimerMs: 600 + idx * 150,
      fireCooldownMs: 900 + idx * 220,
      telegraphTimerMs: 0,
      hitFlashMs: 0,
      koTimerMs: 0,
      respawnTimerMs: 0,
      muzzleFlashTimerMs: 0,
      attackAnimTimerMs: 0,
      strafeDir: idx % 2 === 0 ? 1 : -1,
      patrolX: sp.x,
      patrolZ: sp.z,
      walkCycle: 0,
    };
  });
}

export function getMatchLeaderboard(sim: SimulationState): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [
    {
      id: 'player',
      name: 'YOU (OPERATOR)',
      isPlayer: true,
      kills: sim.player.kills,
      deaths: sim.player.deaths,
      score: sim.player.score,
      weapons: sim.player.loadoutWeapons,
    },
    ...sim.enemies.map((b) => ({
      id: b.id,
      name: b.name,
      isPlayer: false,
      kills: b.kills,
      deaths: b.deaths,
      score: b.score,
      weapons: [b.weaponId, b.secondaryWeaponId] as [WeaponId, WeaponId],
    })),
  ];

  entries.sort((a, b) => {
    if (b.kills !== a.kills) return b.kills - a.kills;
    if (b.score !== a.score) return b.score - a.score;
    if (a.deaths !== b.deaths) return a.deaths - b.deaths;
    return a.isPlayer ? -1 : 1;
  });

  return entries;
}

export function createSimulationState(
  p1Char: CharacterId = 'volt',
  p2Char: CharacterId = 'rift',
  arenaId: ArenaId = 'foundry_arena',
  roundsToWin = 2,
  roundTimeSeconds = DEATHMATCH_DURATION_SECONDS,
  loadoutPair: [WeaponId, WeaponId] = LOADOUT_PAIRS[0].weapons
): SimulationState {
  const arena = ARENA_REGISTRY[arenaId] || ARENA_REGISTRY.foundry_arena;
  const player = createPlayerShooterState(p1Char, loadoutPair[0], loadoutPair);
  const enemies = createInitialEnemies(arena);

  const breakableProps: BreakablePropState[] = arena.breakableProps.map((p) => ({
    ...p,
    hp: p.maxHp,
    broken: false,
    brokenTimerMs: 0,
    hitFlashMs: 0,
  }));

  const pickups: MapPickupState[] = arena.pickupSpots.map((pk) => ({
    ...pk,
    active: true,
    respawnTimerMs: 0,
  }));

  const worldLoot: WorldLootItem[] = [
    {
      lootId: 'loot_spawn_acog',
      x: 2.2,
      y: 0,
      z: 17.5,
      item: {
        instanceId: 'loot_itm_acog',
        itemId: 'att_optic_4x',
        quantity: 1,
      },
      label: '4.0× ACOG Marksman Scope',
    },
    {
      lootId: 'loot_spawn_medkit',
      x: -2.2,
      y: 0,
      z: 17.5,
      item: {
        instanceId: 'loot_itm_medkit',
        itemId: 'med_trauma_kit',
        quantity: 1,
      },
      label: 'Surgical Field Trauma Kit',
    },
    {
      lootId: 'loot_spawn_extmag',
      x: -1.8,
      y: 0,
      z: 15.8,
      item: {
        instanceId: 'loot_itm_extmag',
        itemId: 'att_mag_ext_ar',
        quantity: 1,
      },
      label: '40-Round Extended Rifle Mag',
    },
    {
      lootId: 'loot_spawn_ammo556',
      x: 1.8,
      y: 0,
      z: 15.8,
      item: {
        instanceId: 'loot_itm_ammo556',
        itemId: 'ammo_556',
        quantity: 30,
      },
      label: '30× 5.56×45mm NATO Ammo',
    },
  ];

  return {
    arenaId,
    player,
    enemies,
    traces: [],
    breakableProps,
    pickups,
    worldLoot,
    waveNumber: 1,
    waveKills: 0,
    waveTargetKills: 10,
    roundNumber: 1,
    roundsToWin,
    p1RoundsWon: 0,
    p2RoundsWon: 0,
    roundTimerSec: roundTimeSeconds,
    maxRoundTimeSec: roundTimeSeconds,
    roundOver: false,
    matchOver: false,
    roundWinner: null,
    matchWinner: null,
    winnerName: null,
    winnerKills: 0,
    hitstopMs: 0,
    cameraShakeTrauma: 0,
    nextTraceId: 1,
    p1: player,
    p2: { characterId: p2Char, hp: 100, maxHp: 100 },
  };
}

export function resetRoundPositions(sim: SimulationState): void {
  const arena = ARENA_REGISTRY[sim.arenaId] || ARENA_REGISTRY.foundry_arena;
  const preservedOptics = sim.player.weaponOptics
    ? { ...sim.player.weaponOptics }
    : { ...DEFAULT_WEAPON_OPTICS };
  const preservedInventory = sim.player.inventory;
  const freshPlayer = createPlayerShooterState(
    sim.player.characterId,
    sim.player.loadoutWeapons[0],
    sim.player.loadoutWeapons
  );
  freshPlayer.weaponOptics = preservedOptics;
  if (preservedInventory) {
    freshPlayer.inventory = preservedInventory;
    syncInventoryToPlayerState(freshPlayer);
  }
  freshPlayer.adsState = createInitialADSControllerState(
    freshPlayer.activeWeapon,
    resolveEquippedOptic(freshPlayer.activeWeapon, freshPlayer.weaponOptics)
  );
  Object.assign(sim.player, freshPlayer);
  sim.enemies = createInitialEnemies(arena);
  sim.traces = [];
  sim.breakableProps = arena.breakableProps.map((p) => ({
    ...p,
    hp: p.maxHp,
    broken: false,
    brokenTimerMs: 0,
    hitFlashMs: 0,
  }));
  sim.pickups = arena.pickupSpots.map((pk) => ({
    ...pk,
    active: true,
    respawnTimerMs: 0,
  }));
  sim.waveNumber = 1;
  sim.waveKills = 0;
  sim.waveTargetKills = 10;
  sim.roundTimerSec = sim.maxRoundTimeSec;
  sim.roundOver = false;
  sim.matchOver = false;
  sim.roundWinner = null;
  sim.matchWinner = null;
  sim.winnerName = null;
  sim.winnerKills = 0;
  sim.hitstopMs = 0;
  sim.cameraShakeTrauma = 0;
}

// ============================================================================
// COLLISION, SURFACE MATERIAL & RAYCASTING HELPERS
// ============================================================================

/**
 * Determines the floor/ground surface material ('concrete' vs 'metal') at world coordinates (x, z)
 * within both the Training (Firing Range) and Arena (Deathmatch) environments.
 */
export function getSurfaceMaterialAt(
  x: number,
  z: number,
  arenaId: ArenaId = 'foundry_arena'
): SurfaceMaterial {
  const arena = ARENA_REGISTRY[arenaId] || ARENA_REGISTRY.foundry_arena;
  if (arena.surfaceZones) {
    for (const zone of arena.surfaceZones) {
      if (x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ) {
        return zone.material;
      }
    }
  }
  return 'concrete';
}

function resolveCircleVsBox2D(
  cx: number,
  cz: number,
  radius: number,
  block: MapBoxBlock
): { x: number; z: number } {
  const halfW = block.width * 0.5;
  const halfD = block.depth * 0.5;
  const minX = block.x - halfW;
  const maxX = block.x + halfW;
  const minZ = block.z - halfD;
  const maxZ = block.z + halfD;

  const closestX = Math.max(minX, Math.min(maxX, cx));
  const closestZ = Math.max(minZ, Math.min(maxZ, cz));
  const dx = cx - closestX;
  const dz = cz - closestZ;
  const distSq = dx * dx + dz * dz;

  if (distSq >= radius * radius) {
    return { x: cx, z: cz };
  }

  if (distSq > 0.00001) {
    const dist = Math.sqrt(distSq);
    const push = radius - dist;
    return {
      x: cx + (dx / dist) * push,
      z: cz + (dz / dist) * push,
    };
  }

  // Center is inside AABB: push out along nearest edge
  const leftPen = Math.abs(cx - minX);
  const rightPen = Math.abs(maxX - cx);
  const topPen = Math.abs(cz - minZ);
  const botPen = Math.abs(maxZ - cz);
  const minPen = Math.min(leftPen, rightPen, topPen, botPen);

  if (minPen === leftPen) return { x: minX - radius, z: cz };
  if (minPen === rightPen) return { x: maxX + radius, z: cz };
  if (minPen === topPen) return { x: cx, z: minZ - radius };
  return { x: cx, z: maxZ + radius };
}

export const PLAYER_COLLISION_RADIUS = 0.74;
export const BOT_COLLISION_RADIUS = 0.62;

export function resolveEntityCollisions(
  x: number,
  z: number,
  radius: number,
  arena: ArenaDefinition,
  breakableProps: BreakablePropState[]
): { x: number; z: number } {
  let nx = x;
  let nz = z;

  // Run 3 iterative solver passes so corners, adjacent blocks, pillars, and props never allow clipping
  for (let pass = 0; pass < 3; pass++) {
    nx = Math.max(arena.bounds.minX + radius, Math.min(arena.bounds.maxX - radius, nx));
    nz = Math.max(arena.bounds.minZ + radius, Math.min(arena.bounds.maxZ - radius, nz));

    for (const block of arena.blocks) {
      const res = resolveCircleVsBox2D(nx, nz, radius, block);
      nx = res.x;
      nz = res.z;
    }

    for (const col of arena.colliders) {
      const dx = nx - col.x;
      const dz = nz - col.z;
      const minDist = radius + col.radius;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDist * minDist) {
        if (dSq > 0.00001) {
          const d = Math.sqrt(dSq);
          nx = col.x + (dx / d) * minDist;
          nz = col.z + (dz / d) * minDist;
        } else {
          nx = col.x + minDist;
        }
      }
    }

    for (const prop of breakableProps) {
      if (prop.broken) continue;
      const dx = nx - prop.x;
      const dz = nz - prop.z;
      const minDist = radius + prop.radius;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDist * minDist) {
        if (dSq > 0.00001) {
          const d = Math.sqrt(dSq);
          nx = prop.x + (dx / d) * minDist;
          nz = prop.z + (dz / d) * minDist;
        } else {
          nx = prop.x + minDist;
        }
      }
    }
  }

  return { x: nx, z: nz };
}

/**
 * Ray-AABB 3D intersection distance (returns null if no hit in [0, maxDist])
 */
export function intersectRayAABB(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
  maxDist: number
): number | null {
  let tmin = 0;
  let tmax = maxDist;

  // X slab
  if (Math.abs(dx) < 1e-6) {
    if (ox < minX || ox > maxX) return null;
  } else {
    const invD = 1 / dx;
    let t1 = (minX - ox) * invD;
    let t2 = (maxX - ox) * invD;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  // Y slab
  if (Math.abs(dy) < 1e-6) {
    if (oy < minY || oy > maxY) return null;
  } else {
    const invD = 1 / dy;
    let t1 = (minY - oy) * invD;
    let t2 = (maxY - oy) * invD;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  // Z slab
  if (Math.abs(dz) < 1e-6) {
    if (oz < minZ || oz > maxZ) return null;
  } else {
    const invD = 1 / dz;
    let t1 = (minZ - oz) * invD;
    let t2 = (maxZ - oz) * invD;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  return tmin >= 0 && tmin <= maxDist ? tmin : null;
}

/**
 * Ray-Sphere 3D intersection (used for precision headshot detection)
 */
export function intersectRaySphere(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  cx: number,
  cy: number,
  cz: number,
  r: number,
  maxDist: number
): number | null {
  const lx = cx - ox;
  const ly = cy - oy;
  const lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return null;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return null;
  const thc = Math.sqrt(r2 - d2);
  const t0 = tca - thc;
  const t = t0 >= 0 ? t0 : tca + thc;
  return t >= 0 && t <= maxDist ? t : null;
}

/**
 * Computes forward unit vector from yaw and pitch
 * Convention: yaw = 0 looks along -Z, yaw = PI/2 looks along -X (right-handed Three.js camera)
 */
export function getAimDirection(
  yaw: number,
  pitch: number
): { dx: number; dy: number; dz: number } {
  const cosPitch = Math.cos(pitch);
  return {
    dx: -Math.sin(yaw) * cosPitch,
    dy: Math.sin(pitch),
    dz: -Math.cos(yaw) * cosPitch,
  };
}

function computeAABBHitNormal(
  hx: number,
  hy: number,
  hz: number,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number
): { nx: number; ny: number; nz: number } {
  const eps = 0.04;
  if (Math.abs(hx - minX) < eps) return { nx: -1, ny: 0, nz: 0 };
  if (Math.abs(hx - maxX) < eps) return { nx: 1, ny: 0, nz: 0 };
  if (Math.abs(hz - minZ) < eps) return { nx: 0, ny: 0, nz: -1 };
  if (Math.abs(hz - maxZ) < eps) return { nx: 0, ny: 0, nz: 1 };
  if (Math.abs(hy - maxY) < eps) return { nx: 0, ny: 1, nz: 0 };
  return { nx: 0, ny: 1, nz: 0 };
}

function findClosestWallHitWithNormal(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  arena: ArenaDefinition,
  breakableProps?: BreakablePropState[]
): { dist: number; nx: number; ny: number; nz: number; hitSurface: boolean } {
  let closest = maxDist;
  let nx = -dx;
  let ny = -dy;
  let nz = -dz;
  let hitSurface = false;

  // Floor intersection (y = 0)
  if (dy < -1e-5 && oy > 0) {
    const tFloor = -oy / dy;
    if (tFloor > 0 && tFloor < closest) {
      const fx = ox + dx * tFloor;
      const fz = oz + dz * tFloor;
      if (
        fx >= arena.bounds.minX &&
        fx <= arena.bounds.maxX &&
        fz >= arena.bounds.minZ &&
        fz <= arena.bounds.maxZ
      ) {
        closest = tFloor;
        nx = 0;
        ny = 1;
        nz = 0;
        hitSurface = true;
      }
    }
  }

  // Outer Perimeter Compound Walls (minX, maxX, minZ, maxZ, height = 9.0m)
  const perimHeight = 9.0;
  if (Math.abs(dx) > 1e-6) {
    const targetX = dx > 0 ? arena.bounds.maxX : arena.bounds.minX;
    const tWallX = (targetX - ox) / dx;
    if (tWallX > 0 && tWallX < closest) {
      const wy = oy + dy * tWallX;
      const wz = oz + dz * tWallX;
      if (
        wy >= 0 &&
        wy <= perimHeight &&
        wz >= arena.bounds.minZ &&
        wz <= arena.bounds.maxZ
      ) {
        closest = tWallX;
        nx = dx > 0 ? -1 : 1;
        ny = 0;
        nz = 0;
        hitSurface = true;
      }
    }
  }
  if (Math.abs(dz) > 1e-6) {
    const targetZ = dz > 0 ? arena.bounds.maxZ : arena.bounds.minZ;
    const tWallZ = (targetZ - oz) / dz;
    if (tWallZ > 0 && tWallZ < closest) {
      const wy = oy + dy * tWallZ;
      const wx = ox + dx * tWallZ;
      if (
        wy >= 0 &&
        wy <= perimHeight &&
        wx >= arena.bounds.minX &&
        wx <= arena.bounds.maxX
      ) {
        closest = tWallZ;
        nx = 0;
        ny = 0;
        nz = dz > 0 ? -1 : 1;
        hitSurface = true;
      }
    }
  }

  for (const b of arena.blocks) {
    const hw = b.width * 0.5;
    const hd = b.depth * 0.5;
    const minX = b.x - hw;
    const maxX = b.x + hw;
    const minZ = b.z - hd;
    const maxZ = b.z + hd;
    const t = intersectRayAABB(
      ox,
      oy,
      oz,
      dx,
      dy,
      dz,
      minX,
      0,
      minZ,
      maxX,
      b.height,
      maxZ,
      closest
    );
    if (t !== null && t < closest) {
      closest = t;
      const n = computeAABBHitNormal(
        ox + dx * t,
        oy + dy * t,
        oz + dz * t,
        minX,
        0,
        minZ,
        maxX,
        b.height,
        maxZ
      );
      nx = n.nx;
      ny = n.ny;
      nz = n.nz;
      hitSurface = true;
    }
  }

  for (const c of arena.colliders) {
    // Exact 3D finite cylinder intersection so bullets never hit invisible AABB corners in mid-air
    const rox = ox - c.x;
    const roz = oz - c.z;
    const a = dx * dx + dz * dz;
    if (a > 1e-6) {
      const b = 2 * (rox * dx + roz * dz);
      const cc = rox * rox + roz * roz - c.radius * c.radius;
      const disc = b * b - 4 * a * cc;
      if (disc >= 0) {
        const sqrtDisc = Math.sqrt(disc);
        const tCyl = (-b - sqrtDisc) / (2 * a);
        if (tCyl > 0 && tCyl < closest) {
          const hitY = oy + dy * tCyl;
          if (hitY >= 0 && hitY <= c.height) {
            closest = tCyl;
            const hx = ox + dx * tCyl;
            const hz = oz + dz * tCyl;
            const invR = 1 / Math.max(0.001, c.radius);
            nx = (hx - c.x) * invR;
            ny = 0;
            nz = (hz - c.z) * invR;
            hitSurface = true;
          }
        }
      }
    }
  }

  if (breakableProps) {
    for (const p of breakableProps) {
      if (p.broken) continue;
      const minX = p.x - p.radius;
      const maxX = p.x + p.radius;
      const minZ = p.z - p.radius;
      const maxZ = p.z + p.radius;
      const t = intersectRayAABB(
        ox,
        oy,
        oz,
        dx,
        dy,
        dz,
        minX,
        0,
        minZ,
        maxX,
        p.height,
        maxZ,
        closest
      );
      if (t !== null && t < closest) {
        closest = t;
        nx = -dx;
        ny = 0.2;
        nz = -dz;
        hitSurface = true;
      }
    }
  }

  return { dist: closest, nx, ny, nz, hitSurface };
}

// ============================================================================
// 6-DOF PHYSICS-BASED WEAPON SWAY & MASS INERTIA SOLVER (IDLE & MOVEMENT)
// ============================================================================

export interface WeaponMassSwayProfile {
  weaponId: WeaponId;
  /** Physical loaded weapon mass in kilograms */
  massKg: number;
  /** Positional natural spring frequency omega_n (rad/s) */
  omegaPos: number;
  /** Rotational natural spring frequency omega_n (rad/s) */
  omegaRot: number;
  /** Damping ratio zeta (< 1.0 gives authentic slight mass overshoot & settle) */
  zeta: number;
  /** Rotational & translational lag multiplier from look/movement acceleration */
  inertiaScale: number;
  /** Amplitude multiplier for idle respiratory & postural Lissajous micro-sway */
  idleAmpScale: number;
}

export const WEAPON_MASS_SWAY_PROFILES: Record<WeaponId, WeaponMassSwayProfile> = {
  deagle: {
    weaponId: 'deagle',
    massKg: 2.0,
    omegaPos: 22.0,
    omegaRot: 24.0,
    zeta: 0.78,
    inertiaScale: 0.78,
    idleAmpScale: 0.82,
  },
  mp5: {
    weaponId: 'mp5',
    massKg: 2.55,
    omegaPos: 20.5,
    omegaRot: 22.0,
    zeta: 0.76,
    inertiaScale: 0.86,
    idleAmpScale: 0.88,
  },
  m4a1: {
    weaponId: 'm4a1',
    massKg: 3.1,
    omegaPos: 18.0,
    omegaRot: 19.5,
    zeta: 0.74,
    inertiaScale: 1.0,
    idleAmpScale: 1.0,
  },
  ak47: {
    weaponId: 'ak47',
    massKg: 4.3,
    omegaPos: 15.8,
    omegaRot: 17.0,
    zeta: 0.71,
    inertiaScale: 1.18,
    idleAmpScale: 1.12,
  },
  spas12: {
    weaponId: 'spas12',
    massKg: 4.4,
    omegaPos: 15.2,
    omegaRot: 16.5,
    zeta: 0.7,
    inertiaScale: 1.22,
    idleAmpScale: 1.15,
  },
  awp: {
    weaponId: 'awp',
    massKg: 6.5,
    omegaPos: 12.8,
    omegaRot: 13.8,
    zeta: 0.66,
    inertiaScale: 1.45,
    idleAmpScale: 1.32,
  },
};

export interface WeaponSwayPhysicsState {
  /** Spring-damper translational offset in torso/weapon space (meters) */
  posX: number;
  posY: number;
  posZ: number;
  /** Spring-damper translational velocity (m/s) */
  velX: number;
  velY: number;
  velZ: number;
  /** Spring-damper rotational offset (radians) */
  pitch: number;
  yaw: number;
  roll: number;
  /** Spring-damper angular velocity (rad/s) */
  angVelPitch: number;
  angVelYaw: number;
  angVelRoll: number;
  /** Continuous respiratory & heartbeat Lissajous phase (radians) */
  breathPhase: number;
  /** Fine neuromuscular postural micro-tremor phase (radians) */
  microTremorPhase: number;
  /** Smoothed cardiorespiratory exertion level [0..1] (builds during sprint, recovers in idle) */
  exertion: number;
  /** Smoothed locomotion blend [0..1] */
  moveBlend: number;
  /** Previous frame player-local velocity components for acceleration impulse calculation */
  prevLocalVelRight: number;
  prevLocalVelFwd: number;
  prevVelY: number;
  /** Instantaneous idle harmonic component (exposed for diagnostics & testing) */
  idlePosX: number;
  idlePosY: number;
  idlePitch: number;
  idleYaw: number;
  /** Instantaneous movement bob + inertia component (exposed for diagnostics & testing) */
  moveBobX: number;
  moveBobY: number;
}

export interface WeaponSwayStepInput {
  weaponId: WeaponId;
  /** Frame look yaw delta (radians) */
  lookDeltaYaw: number;
  /** Frame look pitch delta (radians) */
  lookDeltaPitch: number;
  /** Player-local lateral velocity (+right, -left in m/s) */
  localVelRight: number;
  /** Player-local forward velocity (+forward, -backward in m/s) */
  localVelFwd: number;
  /** World vertical velocity (+up, -down in m/s) */
  velY: number;
  /** Grounded horizontal speed (m/s) */
  moveSpeed: number;
  /** Phase-locked footstep walk bob phase (radians) */
  walkBobPhase: number;
  /** Aim-down-sights blend [0..1] */
  adsBlend: number;
  isCrouching: boolean;
  isSprinting: boolean;
  isSliding: boolean;
  isGrounded: boolean;
}

export function createWeaponSwayPhysicsState(): WeaponSwayPhysicsState {
  return {
    posX: 0,
    posY: 0,
    posZ: 0,
    velX: 0,
    velY: 0,
    velZ: 0,
    pitch: 0,
    yaw: 0,
    roll: 0,
    angVelPitch: 0,
    angVelYaw: 0,
    angVelRoll: 0,
    breathPhase: 0,
    microTremorPhase: 0,
    exertion: 0,
    moveBlend: 0,
    prevLocalVelRight: 0,
    prevLocalVelFwd: 0,
    prevVelY: 0,
    idlePosX: 0,
    idlePosY: 0,
    idlePitch: 0,
    idleYaw: 0,
    moveBobX: 0,
    moveBobY: 0,
  };
}

/**
 * Advances the 6-DOF second-order coupled spring-damper weapon sway physics state:
 * 1. Idle State: Multi-frequency Lissajous figure-8 breathing oscillation + subtle postural micro-tremor
 *    that speeds up with exertion after sprinting and steadies when crouching or ADS.
 * 2. Movement State: 2:1 Lissajous pendulum stride bob + Newton's First Law linear acceleration lag
 *    (weapon mass trails behind strafe/forward/vertical acceleration and banks into turns).
 * 3. Look/Aim Inertia: Centrifugal rotational lag, stock-to-muzzle pivot offset, and wrist roll torque
 *    scaled by the active firearm's physical mass (`WEAPON_MASS_SWAY_PROFILES`).
 */
export function stepWeaponSwayPhysics(
  state: WeaponSwayPhysicsState,
  dt: number,
  input: WeaponSwayStepInput
): WeaponSwayPhysicsState {
  const clampedDt = Math.min(0.05, Math.max(0.001, dt));
  const profile =
    WEAPON_MASS_SWAY_PROFILES[input.weaponId] || WEAPON_MASS_SWAY_PROFILES.m4a1;

  // 1. Update Cardiorespiratory Exertion & Smooth Locomotion Blend
  const targetExertion = input.isGrounded
    ? Math.min(1, input.moveSpeed / 7.5) * 0.72 + (input.isSprinting ? 0.28 : 0)
    : 0.45;
  const exertionRate = targetExertion > state.exertion ? 2.4 : 0.65;
  state.exertion +=
    (targetExertion - state.exertion) * (1 - Math.exp(-exertionRate * clampedDt));

  const targetMoveBlend =
    input.isGrounded && !input.isSliding ? Math.min(1, input.moveSpeed / 5.4) : 0;
  state.moveBlend +=
    (targetMoveBlend - state.moveBlend) * (1 - Math.exp(-10.5 * clampedDt));

  // Advance continuous harmonic phases (never freezes at 0 even when standing still!)
  const breathFreq = 1.85 + state.exertion * 2.05;
  state.breathPhase = (state.breathPhase + clampedDt * breathFreq) % (Math.PI * 4);
  state.microTremorPhase =
    (state.microTremorPhase + clampedDt * (5.2 + state.exertion * 2.4)) % (Math.PI * 4);

  // 2. Compute Target Idle Lissajous Breathing & Postural Micro-Sway Equilibrium
  const crouchScale = input.isCrouching ? 0.64 : 1.0;
  const adsIdleScale = 1 - input.adsBlend * 0.74;
  const idleAmp =
    profile.idleAmpScale * crouchScale * adsIdleScale * (1 + state.exertion * 0.7);

  const bSin = Math.sin(state.breathPhase);
  const bCos = Math.cos(state.breathPhase);
  const bHalfSin = Math.sin(state.breathPhase * 0.5);
  const bHalfCos = Math.cos(state.breathPhase * 0.5);
  const tremorSin = Math.sin(state.microTremorPhase);
  const tremorCos = Math.cos(state.microTremorPhase * 0.75);

  // Note: in torsoPivot space, -X is character right, +Y is up, +Z is forward
  const idleX = (bHalfSin * 0.0052 + tremorCos * 0.0011) * idleAmp;
  const idleY = (bSin * 0.0074 + Math.sin(state.breathPhase * 2.0 + 0.5) * 0.0019) * idleAmp;
  const idleZ = bCos * 0.0036 * idleAmp;
  const idlePitch = (-bSin * 0.0155 + tremorSin * 0.0028) * idleAmp;
  const idleYaw = (bHalfCos * 0.0125 + tremorCos * 0.0022) * idleAmp;
  const idleRoll = Math.sin(state.breathPhase * 0.5 + 0.38) * 0.0175 * idleAmp;

  state.idlePosX = idleX;
  state.idlePosY = idleY;
  state.idlePitch = idlePitch;
  state.idleYaw = idleYaw;

  // 3. Compute Locomotion Lissajous Pendulum Target (2:1 Vertical-to-Horizontal Figure-8 Stride)
  const wPhase = input.walkBobPhase;
  const wSin = Math.sin(wPhase);
  const wCos = Math.cos(wPhase);
  const wDoubleSin = Math.sin(wPhase * 2);
  const wDoubleCos = Math.cos(wPhase * 2);

  const sprintMult = input.isSprinting ? 1.34 : 1.0;
  const locoAmp =
    state.moveBlend *
    (1 - input.adsBlend * 0.76) *
    profile.inertiaScale *
    sprintMult;

  // Keep lateral bob biased slightly toward the right (-X) so the rifle never drifts across to the left
  const bobX = (wCos * 0.0125 - 0.0045 * state.moveBlend) * locoAmp;
  const bobY = (-Math.abs(wSin) * 0.0175 + wDoubleSin * 0.0075) * locoAmp;
  const bobZ = -wDoubleCos * 0.0085 * locoAmp;
  const bobPitch = (wDoubleCos * 0.028 + Math.abs(wSin) * 0.015) * locoAmp;
  const bobYaw = -wSin * 0.025 * locoAmp;
  const bobRoll = wCos * 0.034 * locoAmp;

  state.moveBobX = bobX;
  state.moveBobY = bobY;

  // Steady-state velocity drag offset (gun trails slightly behind sustained strafe/vertical motion)
  const adsInertiaScale = (1 - input.adsBlend * 0.62) * profile.inertiaScale;
  const strafeNorm = Math.max(-1, Math.min(1, input.localVelRight / 6.5));
  const fwdNorm = Math.max(-1, Math.min(1, input.localVelFwd / 7.5));
  const vertNorm = Math.max(-1, Math.min(1, input.velY / 8.5));

  // In torso space (-X = right, +X = left): moving right (+strafeNorm) trails the gun slightly left (+X)
  // while banking/rolling into the turn; capped so it always stays on the right side of the body
  const steadyLagX = strafeNorm * 0.0095 * adsInertiaScale;
  const steadyLagY = -vertNorm * 0.014 * adsInertiaScale;
  const steadyLagZ = -fwdNorm * 0.011 * adsInertiaScale;
  const steadyLagPitch = vertNorm * 0.032 * adsInertiaScale + fwdNorm * 0.016 * adsInertiaScale;
  const steadyLagYaw = -strafeNorm * 0.022 * adsInertiaScale;
  const steadyLagRoll = strafeNorm * 0.052 * adsInertiaScale;

  // 4. Inject Instantaneous Linear & Angular Acceleration Impulses (Newtonian Mass Inertia)
  const dvRight = Math.max(
    -12,
    Math.min(12, input.localVelRight - state.prevLocalVelRight)
  );
  const dvFwd = Math.max(-12, Math.min(12, input.localVelFwd - state.prevLocalVelFwd));
  const dvUp = Math.max(-16, Math.min(16, input.velY - state.prevVelY));
  state.prevLocalVelRight = input.localVelRight;
  state.prevLocalVelFwd = input.localVelFwd;
  state.prevVelY = input.velY;

  // Linear acceleration impulse: heavy weapons resist velocity changes
  state.velX += dvRight * 0.018 * adsInertiaScale;
  state.velY -= dvUp * 0.024 * adsInertiaScale;
  state.velZ -= dvFwd * 0.02 * adsInertiaScale;

  state.angVelRoll += dvRight * 0.085 * adsInertiaScale;
  state.angVelPitch += (dvUp * 0.055 - dvFwd * 0.035) * adsInertiaScale;
  state.angVelYaw -= dvRight * 0.042 * adsInertiaScale;

  // Camera look angular velocity impulse: weapon barrel lags and twists on wrist pivot
  const clampedLookYaw = Math.max(-0.35, Math.min(0.35, input.lookDeltaYaw));
  const clampedLookPitch = Math.max(-0.35, Math.min(0.35, input.lookDeltaPitch));

  state.velX += clampedLookYaw * 1.45 * adsInertiaScale;
  state.velY += clampedLookPitch * 1.25 * adsInertiaScale;
  state.angVelYaw += clampedLookYaw * 9.2 * adsInertiaScale;
  state.angVelPitch += clampedLookPitch * 8.6 * adsInertiaScale;
  state.angVelRoll -= clampedLookYaw * 11.4 * adsInertiaScale;

  // 5. Second-Order Underdamped Spring-Damper Integration (2 substeps for unconditional stability)
  const targetPosX = idleX + bobX + steadyLagX;
  const targetPosY = idleY + bobY + steadyLagY;
  const targetPosZ = idleZ + bobZ + steadyLagZ;
  const targetPitch = idlePitch + bobPitch + steadyLagPitch;
  const targetYaw = idleYaw + bobYaw + steadyLagYaw;
  const targetRoll = idleRoll + bobRoll + steadyLagRoll;

  const subSteps = 2;
  const subDt = clampedDt / subSteps;
  const kPos = profile.omegaPos * profile.omegaPos;
  const cPos = 2 * profile.zeta * profile.omegaPos;
  const kRot = profile.omegaRot * profile.omegaRot;
  const cRot = 2 * profile.zeta * profile.omegaRot;

  for (let s = 0; s < subSteps; s++) {
    const ax = -kPos * (state.posX - targetPosX) - cPos * state.velX;
    const ay = -kPos * (state.posY - targetPosY) - cPos * state.velY;
    const az = -kPos * (state.posZ - targetPosZ) - cPos * state.velZ;
    state.velX += ax * subDt;
    state.velY += ay * subDt;
    state.velZ += az * subDt;
    state.posX += state.velX * subDt;
    state.posY += state.velY * subDt;
    state.posZ += state.velZ * subDt;

    const aPitch = -kRot * (state.pitch - targetPitch) - cRot * state.angVelPitch;
    const aYaw = -kRot * (state.yaw - targetYaw) - cRot * state.angVelYaw;
    const aRoll = -kRot * (state.roll - targetRoll) - cRot * state.angVelRoll;
    state.angVelPitch += aPitch * subDt;
    state.angVelYaw += aYaw * subDt;
    state.angVelRoll += aRoll * subDt;
    state.pitch += state.angVelPitch * subDt;
    state.yaw += state.angVelYaw * subDt;
    state.roll += state.angVelRoll * subDt;
  }

  // Clamp physical bounds so extreme flicks never clip through torso or leave viewport
  state.posX = Math.max(-0.065, Math.min(0.045, state.posX));
  state.posY = Math.max(-0.055, Math.min(0.055, state.posY));
  state.posZ = Math.max(-0.048, Math.min(0.048, state.posZ));
  state.pitch = Math.max(-0.16, Math.min(0.16, state.pitch));
  state.yaw = Math.max(-0.18, Math.min(0.18, state.yaw));
  state.roll = Math.max(-0.24, Math.min(0.24, state.roll));

  return state;
}

export interface WeaponImpactProfile {
  weaponId: WeaponId;
  caliberLabel: string;
  coreBoreMm: number;
  spallCraterMm: number;
  /** World-space outer spall & dust diameter in meters (physically scaled by caliber energy) */
  baseDiameter: number;
  maxGrazingStretch: number;
  craterDepthFactor: number;
  crackCount: number;
  emberGlow: number;
  sparkCount: number;
  sparkColorHex: number;
  ringScale: number;
}

/**
 * Researched Forensic Ballistic Caliber Impact Profiles:
 * - spas12 (12-Gauge 00 Buckshot): 8.4mm lead pellets -> 9.5cm per-pellet spall pit (8 pellets form a multi-pit cluster)
 * - mp5 (9x19mm Parabellum): 9.01mm FMJ -> 13.5cm shallow conical concrete pit & lead wipe collar
 * - m4a1 (5.56x45mm NATO): 5.70mm high-velocity FMJ -> 17.5cm sharp hydraulic spall crater & copper flecks
 * - ak47 (7.62x39mm M43): 7.82mm heavy rifle -> 22.5cm deep jagged masonry blowout & aggregate rubble
 * - deagle (.50 Action Express): 12.7mm blunt slug -> 25.5cm wide pulverized concrete bowl & compression rings
 * - awp (.338 Lapua Magnum): 8.58mm anti-materiel -> 33.0cm catastrophic structural cavern & 12 radial fissures
 */
export const WEAPON_IMPACT_PROFILES: Record<WeaponId, WeaponImpactProfile> = {
  spas12: {
    weaponId: 'spas12',
    caliberLabel: '12-Gauge 00 Buckshot (8.4mm Pellet)',
    coreBoreMm: 8.4,
    spallCraterMm: 26,
    baseDiameter: 0.095,
    maxGrazingStretch: 1.82,
    craterDepthFactor: 0.44,
    crackCount: 4,
    emberGlow: 0.45,
    sparkCount: 5,
    sparkColorHex: 0xfb923c,
    ringScale: 1.15,
  },
  mp5: {
    weaponId: 'mp5',
    caliberLabel: '9x19mm Parabellum',
    coreBoreMm: 9.01,
    spallCraterMm: 32,
    baseDiameter: 0.135,
    maxGrazingStretch: 1.92,
    craterDepthFactor: 0.38,
    crackCount: 4,
    emberGlow: 0.38,
    sparkCount: 7,
    sparkColorHex: 0x38bdf8,
    ringScale: 1.4,
  },
  m4a1: {
    weaponId: 'm4a1',
    caliberLabel: '5.56x45mm NATO',
    coreBoreMm: 5.7,
    spallCraterMm: 46,
    baseDiameter: 0.175,
    maxGrazingStretch: 2.08,
    craterDepthFactor: 0.58,
    crackCount: 6,
    emberGlow: 0.62,
    sparkCount: 10,
    sparkColorHex: 0xfbbf24,
    ringScale: 1.85,
  },
  ak47: {
    weaponId: 'ak47',
    caliberLabel: '7.62x39mm M43',
    coreBoreMm: 7.82,
    spallCraterMm: 68,
    baseDiameter: 0.225,
    maxGrazingStretch: 2.22,
    craterDepthFactor: 0.78,
    crackCount: 9,
    emberGlow: 0.84,
    sparkCount: 14,
    sparkColorHex: 0xf97316,
    ringScale: 2.35,
  },
  deagle: {
    weaponId: 'deagle',
    caliberLabel: '.50 Action Express (12.7mm)',
    coreBoreMm: 12.7,
    spallCraterMm: 84,
    baseDiameter: 0.255,
    maxGrazingStretch: 2.12,
    craterDepthFactor: 0.88,
    crackCount: 8,
    emberGlow: 0.9,
    sparkCount: 16,
    sparkColorHex: 0xfacc15,
    ringScale: 2.65,
  },
  awp: {
    weaponId: 'awp',
    caliberLabel: '.338 Lapua Magnum (8.58mm)',
    coreBoreMm: 8.58,
    spallCraterMm: 138,
    baseDiameter: 0.33,
    maxGrazingStretch: 2.42,
    craterDepthFactor: 1.0,
    crackCount: 12,
    emberGlow: 1.0,
    sparkCount: 22,
    sparkColorHex: 0xea580c,
    ringScale: 3.4,
  },
};

export interface BallisticImpactMarkPose {
  validSurface: boolean;
  weaponId: WeaponId;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  /** Unit surface tangent pointing along the 360° projected bullet travel direction */
  tx: number;
  ty: number;
  tz: number;
  /** Unit surface bitangent orthogonal to normal and tangent */
  bx: number;
  by: number;
  bz: number;
  /** Specular/grazing 3D reflection direction for angled spark & spall deflection */
  reflectX: number;
  reflectY: number;
  reflectZ: number;
  /** Incidence cosine |d · n| in [0.14, 1.0] (1.0 = perpendicular, <1.0 = angled/grazing) */
  incidenceCos: number;
  /** Grazing ratio (1 - incidenceCos) in [0, 0.86] */
  grazingRatio: number;
  /** Elongation multiplier along the bullet's surface tangent direction */
  stretchFactor: number;
  /** World-space decal width along tangent axis t */
  scaleT: number;
  /** World-space decal width along bitangent axis b */
  scaleB: number;
  /** Block ID or 'floor' where the mark is anchored */
  surfaceId: string | null;
}

/**
 * Dynamic Multi-Caliber Gunshot Impact Pose Solver:
 * Computes the caliber-scaled 3D crater pose, 360° grazing elongation basis (t, b, n),
 * spall reflection vector, and strict wall-edge boundary clamping so no gunshot mark
 * ever floats in mid-air outside a wall edge.
 */
export function computeBallisticImpactMarkPose(
  fromX: number,
  fromY: number,
  fromZ: number,
  hitX: number,
  hitY: number,
  hitZ: number,
  normalX: number,
  normalY: number,
  normalZ: number,
  weaponId: WeaponId,
  arena: ArenaDefinition
): BallisticImpactMarkPose {
  const profile = WEAPON_IMPACT_PROFILES[weaponId] || WEAPON_IMPACT_PROFILES.m4a1;

  // 1. Incoming 3D unit bullet trajectory vector d
  const vx = hitX - fromX;
  const vy = hitY - fromY;
  const vz = hitZ - fromZ;
  const vLen = Math.hypot(vx, vy, vz);
  const dx = vLen > 1e-6 ? vx / vLen : 0;
  const dy = vLen > 1e-6 ? vy / vLen : 0;
  const dz = vLen > 1e-6 ? vz / vLen : -1;

  // 2. Outward surface normal n
  const nLen = Math.hypot(normalX, normalY, normalZ);
  let nx = nLen > 1e-6 ? normalX / nLen : 0;
  let ny = nLen > 1e-6 ? normalY / nLen : 1;
  let nz = nLen > 1e-6 ? normalZ / nLen : 0;
  if (dx * nx + dy * ny + dz * nz > 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }

  // 3. Incidence cosine & 360° oblique grazing stretch
  const rawDot = -(dx * nx + dy * ny + dz * nz);
  const incidenceCos = Math.max(0.14, Math.min(1.0, Math.abs(rawDot)));
  const grazingRatio = 1.0 - incidenceCos;
  const stretchFactor =
    1.0 + (profile.maxGrazingStretch - 1.0) * Math.pow(grazingRatio, 1.12);

  // 4. Tangent basis (t along projected bullet travel, b orthogonal on surface plane)
  const dotDN = dx * nx + dy * ny + dz * nz;
  let tx = dx - dotDN * nx;
  let ty = dy - dotDN * ny;
  let tz = dz - dotDN * nz;
  const tLen = Math.hypot(tx, ty, tz);

  if (tLen > 1e-4) {
    tx /= tLen;
    ty /= tLen;
    tz /= tLen;
  } else {
    const upX = Math.abs(ny) < 0.9 ? 0 : 1;
    const upY = Math.abs(ny) < 0.9 ? 1 : 0;
    const upZ = 0;
    const cx = upY * nz - upZ * ny;
    const cy = upZ * nx - upX * nz;
    const cz = upX * ny - upY * nx;
    const cLen = Math.hypot(cx, cy, cz) || 1;
    tx = cx / cLen;
    ty = cy / cLen;
    tz = cz / cLen;
  }

  let bx = ny * tz - nz * ty;
  let by = nz * tx - nx * tz;
  let bz = nx * ty - ny * tx;
  const bLen = Math.hypot(bx, by, bz) || 1;
  bx /= bLen;
  by /= bLen;
  bz /= bLen;

  // Specular grazing reflection vector r = d - 2(d·n)n
  let reflectX = dx - 2 * dotDN * nx;
  let reflectY = dy - 2 * dotDN * ny;
  let reflectZ = dz - 2 * dotDN * nz;
  const rLen = Math.hypot(reflectX, reflectY, reflectZ) || 1;
  reflectX /= rLen;
  reflectY /= rLen;
  reflectZ /= rLen;

  let scaleT = profile.baseDiameter * stretchFactor;
  let scaleB = profile.baseDiameter * (1.0 - grazingRatio * 0.1);

  const streakShift = (scaleT - scaleB) * 0.16;
  let posX = hitX + tx * streakShift;
  let posY = hitY + ty * streakShift;
  let posZ = hitZ + tz * streakShift;

  const edgePad = 0.015;

  // Case A: Arena Floor (y ≈ 0, ny > 0.75)
  if (ny > 0.75 && Math.abs(hitY) <= 0.12) {
    const extX = 0.5 * (Math.abs(tx) * scaleT + Math.abs(bx) * scaleB);
    const extZ = 0.5 * (Math.abs(tz) * scaleT + Math.abs(bz) * scaleB);
    posX = Math.max(
      arena.bounds.minX + extX + edgePad,
      Math.min(arena.bounds.maxX - extX - edgePad, posX)
    );
    posZ = Math.max(
      arena.bounds.minZ + extZ + edgePad,
      Math.min(arena.bounds.maxZ - extZ - edgePad, posZ)
    );
    posY = 0.016;
    return {
      validSurface: true,
      weaponId,
      x: posX,
      y: posY,
      z: posZ,
      nx: 0,
      ny: 1,
      nz: 0,
      tx,
      ty: 0,
      tz,
      bx,
      by: 0,
      bz,
      reflectX,
      reflectY,
      reflectZ,
      incidenceCos,
      grazingRatio,
      stretchFactor,
      scaleT,
      scaleB,
      surfaceId: 'floor',
    };
  }

  // Case B: Solid Architectural Block Face
  const faceTol = 0.18;
  let matchedBlock: MapBoxBlock | null = null;
  let bestFaceDist = Infinity;

  for (const b of arena.blocks) {
    const hw = b.width * 0.5;
    const hd = b.depth * 0.5;
    const minX = b.x - hw;
    const maxX = b.x + hw;
    const minZ = b.z - hd;
    const maxZ = b.z + hd;

    if (
      hitX >= minX - faceTol &&
      hitX <= maxX + faceTol &&
      hitZ >= minZ - faceTol &&
      hitZ <= maxZ + faceTol &&
      hitY >= -faceTol &&
      hitY <= b.height + faceTol
    ) {
      let faceDist = Infinity;
      if (Math.abs(nx) > 0.7) {
        const targetX = nx > 0 ? maxX : minX;
        faceDist = Math.abs(hitX - targetX);
      } else if (Math.abs(nz) > 0.7) {
        const targetZ = nz > 0 ? maxZ : minZ;
        faceDist = Math.abs(hitZ - targetZ);
      } else if (ny > 0.7) {
        faceDist = Math.abs(hitY - b.height);
      }
      if (faceDist < bestFaceDist && faceDist <= faceTol) {
        bestFaceDist = faceDist;
        matchedBlock = b;
      }
    }
  }

  if (!matchedBlock) {
    const perimHeight = 9.0;
    if (hitY >= -faceTol && hitY <= perimHeight + faceTol) {
      if (
        Math.abs(nx) > 0.7 &&
        (Math.abs(hitX - arena.bounds.minX) <= faceTol ||
          Math.abs(hitX - arena.bounds.maxX) <= faceTol)
      ) {
        const isMinX =
          Math.abs(hitX - arena.bounds.minX) <= Math.abs(hitX - arena.bounds.maxX);
        const wallX = isMinX ? arena.bounds.minX : arena.bounds.maxX;
        const extZ = 0.5 * (Math.abs(tz) * scaleT + Math.abs(bz) * scaleB);
        const extY = 0.5 * (Math.abs(ty) * scaleT + Math.abs(by) * scaleB);
        posZ = Math.max(
          arena.bounds.minZ + extZ + edgePad,
          Math.min(arena.bounds.maxZ - extZ - edgePad, posZ)
        );
        posY = Math.max(extY + edgePad, Math.min(perimHeight - extY - edgePad, posY));
        posX = wallX + (isMinX ? 0.014 : -0.014);
        return {
          validSurface: true,
          weaponId,
          x: posX,
          y: posY,
          z: posZ,
          nx: isMinX ? 1 : -1,
          ny: 0,
          nz: 0,
          tx,
          ty,
          tz,
          bx,
          by,
          bz,
          reflectX,
          reflectY,
          reflectZ,
          incidenceCos,
          grazingRatio,
          stretchFactor,
          scaleT,
          scaleB,
          surfaceId: isMinX ? 'perimeter_west' : 'perimeter_east',
        };
      }
      if (
        Math.abs(nz) > 0.7 &&
        (Math.abs(hitZ - arena.bounds.minZ) <= faceTol ||
          Math.abs(hitZ - arena.bounds.maxZ) <= faceTol)
      ) {
        const isMinZ =
          Math.abs(hitZ - arena.bounds.minZ) <= Math.abs(hitZ - arena.bounds.maxZ);
        const wallZ = isMinZ ? arena.bounds.minZ : arena.bounds.maxZ;
        const extX = 0.5 * (Math.abs(tx) * scaleT + Math.abs(bx) * scaleB);
        const extY = 0.5 * (Math.abs(ty) * scaleT + Math.abs(by) * scaleB);
        posX = Math.max(
          arena.bounds.minX + extX + edgePad,
          Math.min(arena.bounds.maxX - extX - edgePad, posX)
        );
        posY = Math.max(extY + edgePad, Math.min(perimHeight - extY - edgePad, posY));
        posZ = wallZ + (isMinZ ? 0.014 : -0.014);
        return {
          validSurface: true,
          weaponId,
          x: posX,
          y: posY,
          z: posZ,
          nx: 0,
          ny: 0,
          nz: isMinZ ? 1 : -1,
          tx,
          ty,
          tz,
          bx,
          by,
          bz,
          reflectX,
          reflectY,
          reflectZ,
          incidenceCos,
          grazingRatio,
          stretchFactor,
          scaleT,
          scaleB,
          surfaceId: isMinZ ? 'perimeter_north' : 'perimeter_south',
        };
      }
    }

    return {
      validSurface: false,
      weaponId,
      x: hitX,
      y: hitY,
      z: hitZ,
      nx,
      ny,
      nz,
      tx,
      ty,
      tz,
      bx,
      by,
      bz,
      reflectX,
      reflectY,
      reflectZ,
      incidenceCos,
      grazingRatio,
      stretchFactor,
      scaleT,
      scaleB,
      surfaceId: null,
    };
  }

  const hw = matchedBlock.width * 0.5;
  const hd = matchedBlock.depth * 0.5;
  const minX = matchedBlock.x - hw;
  const maxX = matchedBlock.x + hw;
  const minZ = matchedBlock.z - hd;
  const maxZ = matchedBlock.z + hd;
  const maxY = matchedBlock.height;

  if (Math.abs(nx) > 0.7) {
    let extZ = 0.5 * (Math.abs(tz) * scaleT + Math.abs(bz) * scaleB);
    let extY = 0.5 * (Math.abs(ty) * scaleT + Math.abs(by) * scaleB);
    const maxAllowedZ = Math.max(0.03, matchedBlock.depth * 0.45);
    const maxAllowedY = Math.max(0.03, maxY * 0.45);
    if (extZ > maxAllowedZ || extY > maxAllowedY) {
      const shrink = Math.min(
        maxAllowedZ / Math.max(1e-4, extZ),
        maxAllowedY / Math.max(1e-4, extY)
      );
      scaleT *= shrink;
      scaleB *= shrink;
      extZ *= shrink;
      extY *= shrink;
    }
    posZ = Math.max(minZ + extZ + edgePad, Math.min(maxZ - extZ - edgePad, posZ));
    posY = Math.max(extY + edgePad, Math.min(maxY - extY - edgePad, posY));
    posX = (nx > 0 ? maxX : minX) + (nx > 0 ? 0.011 : -0.011);
  } else if (Math.abs(nz) > 0.7) {
    let extX = 0.5 * (Math.abs(tx) * scaleT + Math.abs(bx) * scaleB);
    let extY = 0.5 * (Math.abs(ty) * scaleT + Math.abs(by) * scaleB);
    const maxAllowedX = Math.max(0.03, matchedBlock.width * 0.45);
    const maxAllowedY = Math.max(0.03, maxY * 0.45);
    if (extX > maxAllowedX || extY > maxAllowedY) {
      const shrink = Math.min(
        maxAllowedX / Math.max(1e-4, extX),
        maxAllowedY / Math.max(1e-4, extY)
      );
      scaleT *= shrink;
      scaleB *= shrink;
      extX *= shrink;
      extY *= shrink;
    }
    posX = Math.max(minX + extX + edgePad, Math.min(maxX - extX - edgePad, posX));
    posY = Math.max(extY + edgePad, Math.min(maxY - extY - edgePad, posY));
    posZ = (nz > 0 ? maxZ : minZ) + (nz > 0 ? 0.011 : -0.011);
  } else {
    let extX = 0.5 * (Math.abs(tx) * scaleT + Math.abs(bx) * scaleB);
    let extZ = 0.5 * (Math.abs(tz) * scaleT + Math.abs(bz) * scaleB);
    const maxAllowedX = Math.max(0.03, matchedBlock.width * 0.45);
    const maxAllowedZ = Math.max(0.03, matchedBlock.depth * 0.45);
    if (extX > maxAllowedX || extZ > maxAllowedZ) {
      const shrink = Math.min(
        maxAllowedX / Math.max(1e-4, extX),
        maxAllowedZ / Math.max(1e-4, extZ)
      );
      scaleT *= shrink;
      scaleB *= shrink;
      extX *= shrink;
      extZ *= shrink;
    }
    posX = Math.max(minX + extX + edgePad, Math.min(maxX - extX - edgePad, posX));
    posZ = Math.max(minZ + extZ + edgePad, Math.min(maxZ - extZ - edgePad, posZ));
    posY = maxY + 0.011;
  }

  return {
    validSurface: true,
    weaponId,
    x: posX,
    y: posY,
    z: posZ,
    nx,
    ny,
    nz,
    tx,
    ty,
    tz,
    bx,
    by,
    bz,
    reflectX,
    reflectY,
    reflectZ,
    incidenceCos,
    grazingRatio,
    stretchFactor,
    scaleT,
    scaleB,
    surfaceId: matchedBlock.id,
  };
}

/**
 * Multi-ray 3D Line-Of-Sight check (eye-level + chest-level) so enemies NEVER see or fire through walls or 1.3m cover barriers.
 */
export function hasClearLineOfSight(
  botX: number,
  botY: number,
  botZ: number,
  playerX: number,
  playerY: number,
  playerZ: number,
  playerEyeHeight: number,
  arena: ArenaDefinition,
  breakableProps?: BreakablePropState[]
): boolean {
  // 1. Upper eye-to-eye ray
  const ox1 = botX;
  const oy1 = botY + 1.25;
  const oz1 = botZ;
  const tx1 = playerX;
  const ty1 = playerY + Math.max(0.75, playerEyeHeight - 0.16);
  const tz1 = playerZ;

  const vx1 = tx1 - ox1;
  const vy1 = ty1 - oy1;
  const vz1 = tz1 - oz1;
  const dist1 = Math.hypot(vx1, vy1, vz1);
  if (dist1 < 0.05) return true;

  const hit1 = findClosestWallHitWithNormal(
    ox1,
    oy1,
    oz1,
    vx1 / dist1,
    vy1 / dist1,
    vz1 / dist1,
    dist1,
    arena,
    breakableProps
  );
  if (hit1.dist < dist1 - 0.12) {
    return false;
  }

  // 2. Chest-to-chest ray (ensures 1.3m tactical cover barriers occlude enemy fire)
  const oy2 = botY + 1.02;
  const ty2 = playerY + Math.min(1.05, playerEyeHeight * 0.68);
  const vy2 = ty2 - oy2;
  const dist2 = Math.hypot(vx1, vy2, vz1);
  const hit2 = findClosestWallHitWithNormal(
    ox1,
    oy2,
    oz1,
    vx1 / dist2,
    vy2 / dist2,
    vz1 / dist2,
    dist2,
    arena,
    breakableProps
  );
  if (hit2.dist < dist2 - 0.12) {
    return false;
  }

  return true;
}

/**
 * Universal 3D Multi-Sensor Weapon Wall-Obstruction Solver.
 * Casts a 5-ray 3D volumetric sensor fan from the player's eye/shoulder along the weapon's barrel
 * AND checks 3D barrel-capsule proximity against all walls, cover barriers, pillars, crates, barrels,
 * and perimeter bounds so the weapon physically touches/braces against walls and NEVER clips inside them.
 */
export function computeWeaponWallObstruction(
  player: PlayerShooterState,
  arena: ArenaDefinition,
  breakableProps?: BreakablePropState[]
): { obstruction: number; contactDist: number } {
  const wid = player.activeWeapon;
  const barrelReach =
    wid === 'awp'
      ? 1.56
      : wid === 'spas12'
      ? 1.42
      : wid === 'ak47'
      ? 1.38
      : wid === 'm4a1'
      ? 1.34
      : wid === 'mp5'
      ? 1.18
      : 1.05;
  const minClearance = 0.72;

  const ox = player.x;
  const oy = player.y + player.eyeHeight;
  const oz = player.z;

  const { dx, dy, dz } = getAimDirection(player.yaw, player.pitch);
  const forwardX = -Math.sin(player.yaw);
  const forwardZ = -Math.cos(player.yaw);
  const rightX = Math.cos(player.yaw);
  const rightZ = -Math.sin(player.yaw);

  const hipOffsetX = (1 - player.adsBlend) * 0.23;
  const hipOffsetY = (1 - player.adsBlend) * 0.16 + 0.06;

  // Sensor 1: Center eye aim ray
  const hit1 = findClosestWallHitWithNormal(
    ox,
    oy - 0.06,
    oz,
    dx,
    dy,
    dz,
    barrelReach,
    arena,
    breakableProps
  );

  // High-ready cover-mounted barrel elevation: when near low cover (waist/chest walls <= 1.35m),
  // the operator naturally holds the rifle at high-shoulder level so the barrel clears low walls.
  const bx = ox + rightX * hipOffsetX;
  const by = Math.max(0.45, oy - hipOffsetY * 0.65);
  const bz = oz + rightZ * hipOffsetX;
  const hit2 = findClosestWallHitWithNormal(
    bx,
    by,
    bz,
    dx,
    dy,
    dz,
    barrelReach,
    arena,
    breakableProps
  );

  // Sensor 3: Right-flank barrel guard ray (catches angled walls on right side of gun)
  const r3Dx = dx + rightX * 0.22;
  const r3Dy = dy;
  const r3Dz = dz + rightZ * 0.22;
  const r3Len = Math.hypot(r3Dx, r3Dy, r3Dz) || 1;
  const hit3 = findClosestWallHitWithNormal(
    bx + rightX * 0.08,
    by,
    bz + rightZ * 0.08,
    r3Dx / r3Len,
    r3Dy / r3Len,
    r3Dz / r3Len,
    barrelReach * 0.95,
    arena,
    breakableProps
  );

  // Sensor 4: Left-flank barrel guard ray (catches corners on left side of gun)
  const r4Dx = dx - rightX * 0.18;
  const r4Dy = dy;
  const r4Dz = dz - rightZ * 0.18;
  const r4Len = Math.hypot(r4Dx, r4Dy, r4Dz) || 1;
  const hit4 = findClosestWallHitWithNormal(
    bx - rightX * 0.08,
    by,
    bz - rightZ * 0.08,
    r4Dx / r4Len,
    r4Dy / r4Len,
    r4Dz / r4Len,
    barrelReach * 0.95,
    arena,
    breakableProps
  );

  // Sensor 5: Horizontal high-shoulder forward ray (above low cover walls <= 1.35m, catches tall walls)
  const highReadyY = Math.max(0.45, oy - 0.12);
  const hit5 = findClosestWallHitWithNormal(
    bx,
    highReadyY,
    bz,
    forwardX,
    0,
    forwardZ,
    barrelReach * 0.92,
    arena,
    breakableProps
  );

  let closestDist = barrelReach;
  if (hit1.hitSurface && hit1.dist < closestDist) closestDist = hit1.dist;
  if (hit2.hitSurface && hit2.dist < closestDist) closestDist = hit2.dist;
  if (hit3.hitSurface && hit3.dist < closestDist) closestDist = hit3.dist;
  if (hit4.hitSurface && hit4.dist < closestDist) closestDist = hit4.dist;
  if (hit5.hitSurface && hit5.dist < closestDist) closestDist = hit5.dist;

  // Sensor 6: 3D Volumetric Barrel Capsule Sample Points vs Tall Blocks, Pillars & Props
  // Ignores low cover walls that are below the high-ready sight/barrel line so shooting over cover is unobstructed
  const sampleFractions = [0.35, 0.62, 0.88];
  const barrelRadius = 0.22;
  const minBlockingWallHeight = oy - 0.22;
  for (let s = 0; s < sampleFractions.length; s++) {
    const distAlong = sampleFractions[s] * barrelReach;
    const sx = bx + dx * distAlong;
    const sy = by + dy * distAlong;
    const sz = bz + dz * distAlong;

    // Check arena outer perimeter bounds
    if (
      sx - barrelRadius < arena.bounds.minX ||
      sx + barrelRadius > arena.bounds.maxX ||
      sz - barrelRadius < arena.bounds.minZ ||
      sz + barrelRadius > arena.bounds.maxZ
    ) {
      closestDist = Math.min(closestDist, distAlong * 0.82);
    }

    // Check solid blocks that actually block the barrel height (skip low cover walls below barrel/sight line)
    for (const block of arena.blocks) {
      if (sy > block.height + 0.02 || block.height < minBlockingWallHeight) continue;
      const hw = block.width * 0.5;
      const hd = block.depth * 0.5;
      const cx = Math.max(block.x - hw, Math.min(block.x + hw, sx));
      const cz = Math.max(block.z - hd, Math.min(block.z + hd, sz));
      const d2 = (sx - cx) ** 2 + (sz - cz) ** 2;
      if (d2 < barrelRadius * barrelRadius) {
        closestDist = Math.min(closestDist, distAlong * 0.78);
      }
    }

    // Check cylindrical pillars
    for (const col of arena.colliders) {
      if (sy > col.height + 0.02 || col.height < minBlockingWallHeight) continue;
      const d2 = (sx - col.x) ** 2 + (sz - col.z) ** 2;
      const minR = col.radius + barrelRadius;
      if (d2 < minR * minR) {
        closestDist = Math.min(closestDist, distAlong * 0.78);
      }
    }

    // Check unbroken crates & barrels only if barrel aims directly into them
    if (breakableProps) {
      for (const prop of breakableProps) {
        if (prop.broken || sy > prop.height + 0.02 || prop.height < minBlockingWallHeight) continue;
        const d2 = (sx - prop.x) ** 2 + (sz - prop.z) ** 2;
        const minR = prop.radius + barrelRadius;
        if (d2 < minR * minR) {
          closestDist = Math.min(closestDist, distAlong * 0.78);
        }
      }
    }
  }

  if (closestDist >= barrelReach) {
    return { obstruction: 0, contactDist: barrelReach };
  }

  const rawObs =
    (barrelReach - closestDist) / Math.max(0.15, barrelReach - minClearance);
  const obstruction = Math.max(0, Math.min(1, rawObs));
  return { obstruction, contactDist: closestDist };
}

// ============================================================================
// WEAPON SWITCHING, SCOPE SENSITIVITY & RELOAD HELPERS
// ============================================================================

/**
 * Computes the camera & fire-joystick look sensitivity multiplier when in ADS.
 * Delegates to the centralized AimSensitivityController:
 * - Hip-fire (adsBlend = 0):  1.00x
 * - ADS without scope ('none'): 0.70x
 * - 2x Scope ('scope_2x'):      0.50x
 * - 4x Scope ('scope_4x'):      0.35x
 */
export function getScopeSensitivityMultiplier(
  weaponId: WeaponId,
  adsBlend: number,
  opticId?: OpticId
): number {
  const resolvedOptic =
    opticId ?? DEFAULT_WEAPON_OPTICS[weaponId] ?? 'none';
  return computeAimSensitivityMultiplier(adsBlend, resolvedOptic);
}

export function getPlayerEffectiveWeaponStats(
  player: PlayerShooterState,
  weaponId: WeaponId = player.activeWeapon
): EffectiveWeaponStats {
  const wInst = findWeaponInstanceForWeaponId(player.inventory, weaponId);
  return computeEffectiveWeaponStats(weaponId, wInst?.attachments);
}

/**
 * Equips a compatible optic attachment on a weapon for the player.
 */
export function setPlayerWeaponOptic(
  player: PlayerShooterState,
  weaponId: WeaponId,
  opticId: OpticId
): OpticId {
  player.weaponOptics = equipOpticForWeapon(
    player.weaponOptics || { ...DEFAULT_WEAPON_OPTICS },
    weaponId,
    opticId
  );
  const resolved = player.weaponOptics[weaponId];
  syncExternalOpticSelectionToInventory(player, weaponId, resolved);
  return resolved;
}

/**
 * Cycles the active optic attachment ('none' -> 'scope_2x' -> 'scope_4x') on the target weapon.
 */
export function cyclePlayerWeaponOptic(
  player: PlayerShooterState,
  weaponId: WeaponId = player.activeWeapon
): OpticId {
  const res = cycleWeaponOptic(
    player.weaponOptics || { ...DEFAULT_WEAPON_OPTICS },
    weaponId
  );
  player.weaponOptics = res.nextLoadout;
  syncExternalOpticSelectionToInventory(player, weaponId, res.nextOpticId);
  return res.nextOpticId;
}

export function setPlayerLoadoutPair(
  player: PlayerShooterState,
  pair: [WeaponId, WeaponId],
  events?: CombatEvent[]
): void {
  player.loadoutWeapons = [pair[0], pair[1]];
  if (player.inventory) {
    // Keep inventory equipped primary/secondary aligned with pair selection
    const p0 = findWeaponInstanceForWeaponId(player.inventory, pair[0]);
    const p1 = findWeaponInstanceForWeaponId(player.inventory, pair[1]);
    if (p0 && p1 && p0.instanceId !== p1.instanceId) {
      const all = [
        player.inventory.equippedWeapons.primary,
        player.inventory.equippedWeapons.secondary,
        ...(player.inventory.equippedWeapons.sidearm
          ? [player.inventory.equippedWeapons.sidearm]
          : []),
        ...player.inventory.storedWeapons,
      ];
      player.inventory.equippedWeapons.primary = p0;
      player.inventory.equippedWeapons.secondary = p1;
      player.inventory.storedWeapons = all.filter(
        (w) =>
          w.instanceId !== p0.instanceId &&
          w.instanceId !== p1.instanceId &&
          w.instanceId !== player.inventory.equippedWeapons.sidearm?.instanceId
      );
    }
  }
  if (!player.loadoutWeapons.includes(player.activeWeapon)) {
    switchPlayerWeapon(player, pair[0], events);
  }
}

export function switchPlayerWeapon(
  player: PlayerShooterState,
  targetWeapon: WeaponId,
  events?: CombatEvent[]
): boolean {
  if (player.activeWeapon === targetWeapon) return false;
  if (!WEAPON_REGISTRY[targetWeapon]) return false;

  if (!player.loadoutWeapons.includes(targetWeapon)) {
    player.loadoutWeapons = [player.loadoutWeapons[0], targetWeapon];
  }
  player.previousWeapon = player.activeWeapon;
  player.activeWeapon = targetWeapon;
  player.isReloading = false;
  player.reloadTimerMs = 0;
  player.isAds = false;
  player.adsBlend = 0;
  if (player.adsState) {
    cancelADSController(player.adsState, true);
    player.adsState.activeWeaponId = targetWeapon;
    player.adsState.activeOpticId = resolveEquippedOptic(
      targetWeapon,
      player.weaponOptics
    );
  }
  player.weaponSwitchDurationMs = 340;
  player.weaponSwitchTimerMs = 340;
  player.fireCooldownMs = Math.max(player.fireCooldownMs, 220);

  events?.push({
    type: 'weapon_switch',
    actor: 'p1',
    label: WEAPON_REGISTRY[targetWeapon].name,
    weaponId: targetWeapon,
  });
  return true;
}

export function startPlayerReload(
  player: PlayerShooterState,
  events?: CombatEvent[]
): boolean {
  if (player.isReloading) return false;
  const effSpec = getPlayerEffectiveWeaponStats(player, player.activeWeapon);
  const ammo = player.weapons[player.activeWeapon];
  if (ammo.mag >= effSpec.magSize || ammo.reserve <= 0) return false;

  player.isReloading = true;
  player.reloadTimerMs = effSpec.reloadTimeMs;
  player.isAds = false;
  if (player.adsState) {
    cancelADSController(player.adsState, false);
  }
  events?.push({
    type: 'reload_start',
    actor: 'p1',
    label: 'RELOADING',
    weaponId: player.activeWeapon,
  });
  return true;
}

/**
 * Handles tapping one of the 2 Gun Boxes above the Health Bar:
 * - If tapping the gun ALREADY in hand: triggers a Reload!
 * - If tapping the other gun in the pair: switches to that gun!
 */
export function handleWeaponSlotClick(
  player: PlayerShooterState,
  targetWeapon: WeaponId,
  events?: CombatEvent[]
): 'reloaded' | 'switched' | 'noop' {
  if (player.activeWeapon === targetWeapon) {
    const started = startPlayerReload(player, events);
    return started ? 'reloaded' : 'noop';
  }
  const switched = switchPlayerWeapon(player, targetWeapon, events);
  return switched ? 'switched' : 'noop';
}

// ============================================================================
// DYNAMIC CROSSHAIR & BALLISTIC SPREAD SYSTEM
// ============================================================================

export interface DynamicCrosshairMetrics {
  weaponId: WeaponId;
  /** Weapon base spread in degrees (interpolated by ADS and crouch stance) */
  baseSpreadDeg: number;
  /** Movement & stance dispersion penalty in degrees (walk, strafe, sprint, slide, airborne) */
  movementSpreadDeg: number;
  /** Active recoil & firing bloom dispersion in degrees */
  recoilSpreadDeg: number;
  /** Total effective ballistic spread cone in degrees */
  totalSpreadDeg: number;
  /** Target crosshair inner-to-outer expansion gap in CSS pixels */
  targetGapPx: number;
  /** Normalized recoil bloom intensity in [0, 1] */
  recoilIntensity: number;
  /** Normalized movement dispersion intensity in [0, 1] */
  movementIntensity: number;
}

const _crosshairMetricsScratch: DynamicCrosshairMetrics = {
  weaponId: 'm4a1',
  baseSpreadDeg: 1.6,
  movementSpreadDeg: 0,
  recoilSpreadDeg: 0,
  totalSpreadDeg: 1.6,
  targetGapPx: 12,
  recoilIntensity: 0,
  movementIntensity: 0,
};

/**
 * Computes real-time dynamic weapon dispersion & crosshair expansion metrics
 * based on weapon accuracy (hip vs ADS spread), character movement/stance
 * (velocity, crouch, sprint, slide, airborne), and active recoil state.
 */
export function computeDynamicCrosshairState(
  player: PlayerShooterState,
  extraRecoilPitchRad = 0,
  out: DynamicCrosshairMetrics = _crosshairMetricsScratch
): DynamicCrosshairMetrics {
  const spec = getPlayerEffectiveWeaponStats(player, player.activeWeapon);
  const adsBlend = Math.max(0, Math.min(1, player.adsBlend));

  // 1. Weapon Base Accuracy (smoothly interpolated between hipfire and ADS, tightened by crouching)
  const rawWeaponSpread =
    spec.hipSpreadDeg + (spec.adsSpreadDeg - spec.hipSpreadDeg) * adsBlend;
  const stanceMultiplier = player.isCrouching
    ? 0.65
    : player.isSliding
      ? 1.18
      : 1.0;
  const baseSpreadDeg = rawWeaponSpread * stanceMultiplier;

  // 2. Character Movement & Airborne Dispersion
  const horizSpeed = Math.hypot(player.vx, player.vz);
  const walkSpeedRef = 7.8;
  const speedRatio = Math.min(1.65, horizSpeed / walkSpeedRef);
  const adsMoveDamp = 1 - adsBlend * 0.42;

  let movementSpreadDeg =
    speedRatio * (0.55 + spec.hipSpreadDeg * 0.38) * adsMoveDamp;
  if (player.isSprinting && horizSpeed > 1.0) {
    movementSpreadDeg += 0.95;
  }
  if (player.isSliding) {
    movementSpreadDeg += 0.65;
  }
  if (!player.isGrounded || Math.abs(player.vy) > 0.15) {
    const vertPenalty = Math.min(1.35, Math.abs(player.vy) * 0.14);
    movementSpreadDeg += (1.85 + vertPenalty) * (1 - adsBlend * 0.25);
  }

  // 3. Active Recoil & Firing Bloom State
  const totalRecoilPitch =
    Math.abs(player.recoilKickPitch) + Math.abs(extraRecoilPitchRad);
  const recoilMagRad = Math.hypot(totalRecoilPitch, player.recoilKickYaw);
  const recoilFromKickDeg = ((recoilMagRad * 180) / Math.PI) * 0.72;
  const muzzleBloomRatio =
    player.muzzleFlashTimerMs > 0
      ? Math.min(1, player.muzzleFlashTimerMs / 65)
      : 0;
  const cooldownBloomRatio =
    player.fireCooldownMs > 0 && spec.fireIntervalMs > 0
      ? Math.min(1, player.fireCooldownMs / spec.fireIntervalMs)
      : 0;
  const shotPulseDeg =
    Math.max(muzzleBloomRatio, cooldownBloomRatio * 0.55) *
    spec.recoilPitchDeg *
    0.78;
  const recoilSpreadDeg =
    (recoilFromKickDeg + shotPulseDeg) * (1 - adsBlend * 0.35);

  const totalSpreadDeg = baseSpreadDeg + movementSpreadDeg + recoilSpreadDeg;

  // Map total angular spread (degrees) to screen-space crosshair gap (px)
  // Minimum 4px for pinpoint ADS/crouch accuracy, up to 54px under heavy recoil + movement
  const rawGapPx = 4.0 + totalSpreadDeg * 5.6;
  const targetGapPx = Math.max(4.0, Math.min(54.0, rawGapPx));

  out.weaponId = spec.weaponId;
  out.baseSpreadDeg = baseSpreadDeg;
  out.movementSpreadDeg = movementSpreadDeg;
  out.recoilSpreadDeg = recoilSpreadDeg;
  out.totalSpreadDeg = totalSpreadDeg;
  out.targetGapPx = targetGapPx;
  out.recoilIntensity = Math.max(0, Math.min(1, recoilSpreadDeg / 3.2));
  out.movementIntensity = Math.max(0, Math.min(1, movementSpreadDeg / 3.0));
  return out;
}

// ============================================================================
// PLAYER FIRING & BALLISTIC HITSCAN RESOLUTION
// ============================================================================

export function firePlayerWeapon(
  sim: SimulationState,
  events: CombatEvent[],
  infiniteAmmo = false
): boolean {
  const player = sim.player;
  const baseSpec = WEAPON_REGISTRY[player.activeWeapon];
  const spec = getPlayerEffectiveWeaponStats(player, player.activeWeapon);
  const ammo = player.weapons[player.activeWeapon];

  if (player.isReloading || player.fireCooldownMs > 0 || player.weaponSwitchTimerMs > 0) {
    return false;
  }

  if (ammo.mag <= 0) {
    player.fireCooldownMs = 220;
    events.push({
      type: 'dry_fire',
      actor: 'p1',
      label: 'OUT OF AMMO',
      weaponId: baseSpec.id,
    });
    if (ammo.reserve > 0) {
      startPlayerReload(player, events);
    }
    return false;
  }

  if (!infiniteAmmo) {
    ammo.mag -= 1;
  }

  const spreadMetrics = computeDynamicCrosshairState(player);
  const spreadDeg = spreadMetrics.totalSpreadDeg;
  const spreadRad = (spreadDeg * Math.PI) / 180;

  player.fireCooldownMs = spec.fireIntervalMs;
  player.muzzleFlashTimerMs = 65;
  player.shotsFired += 1;

  const arena = ARENA_REGISTRY[sim.arenaId] || ARENA_REGISTRY.foundry_arena;
  const ox = player.x;
  const oy = player.y + player.eyeHeight;
  const oz = player.z;

  let anyHit = false;
  let anyHeadshot = false;
  let totalDamageDealt = 0;

  for (let p = 0; p < spec.pellets; p++) {
    // Deterministic-friendly small spread pattern when p === 0 and ADS, or randomized cone for hipfire/shotgun
    const randYaw =
      p === 0 && player.isAds
        ? 0
        : (Math.random() - 0.5) * 2 * spreadRad;
    const randPitch =
      p === 0 && player.isAds
        ? 0
        : (Math.random() - 0.5) * 2 * spreadRad;

    const rayYaw = player.yaw + randYaw;
    const rayPitch = player.pitch + player.recoilKickPitch * 0.4 + randPitch;
    const { dx, dy, dz } = getAimDirection(rayYaw, rayPitch);

    const wallHit = findClosestWallHitWithNormal(ox, oy, oz, dx, dy, dz, spec.maxRange, arena);
    let bestDist = wallHit.dist;
    let hitEnemy: EnemyBotState | null = null;
    let hitIsHeadshot = false;
    let hitProp: BreakablePropState | null = null;

    // Check enemies
    for (const enemy of sim.enemies) {
      if (enemy.state === 'ko' || enemy.hp <= 0) continue;

      // 1. Head sphere check (center at y + 1.56, radius 0.30)
      const headT = intersectRaySphere(
        ox,
        oy,
        oz,
        dx,
        dy,
        dz,
        enemy.x,
        enemy.y + 1.56,
        enemy.z,
        0.31,
        bestDist
      );
      if (headT !== null && headT < bestDist) {
        bestDist = headT;
        hitEnemy = enemy;
        hitIsHeadshot = true;
        hitProp = null;
        continue;
      }

      // 2. Body AABB check (y from 0.05 to 1.45, half-width 0.44)
      const bodyT = intersectRayAABB(
        ox,
        oy,
        oz,
        dx,
        dy,
        dz,
        enemy.x - 0.44,
        enemy.y + 0.05,
        enemy.z - 0.44,
        enemy.x + 0.44,
        enemy.y + 1.45,
        enemy.z + 0.44,
        bestDist
      );
      if (bodyT !== null && bodyT < bestDist) {
        bestDist = bodyT;
        hitEnemy = enemy;
        hitIsHeadshot = false;
        hitProp = null;
      }
    }

    // Check breakable crates/barrels
    for (const prop of sim.breakableProps) {
      if (prop.broken) continue;
      const propT = intersectRayAABB(
        ox,
        oy,
        oz,
        dx,
        dy,
        dz,
        prop.x - prop.radius,
        0,
        prop.z - prop.radius,
        prop.x + prop.radius,
        prop.height,
        prop.z + prop.radius,
        bestDist
      );
      if (propT !== null && propT < bestDist) {
        bestDist = propT;
        hitProp = prop;
        hitEnemy = null;
      }
    }

    const hitX = ox + dx * bestDist;
    const hitY = oy + dy * bestDist;
    const hitZ = oz + dz * bestDist;

    let hitKind: BulletTrace['hitKind'] = wallHit.hitSurface ? 'wall' : 'sky';
    let hitNormalX = wallHit.nx;
    let hitNormalY = wallHit.ny;
    let hitNormalZ = wallHit.nz;

    if (hitEnemy) {
      hitKind = hitIsHeadshot ? 'headshot' : 'enemy';
      hitNormalX = -dx;
      hitNormalY = 0.25;
      hitNormalZ = -dz;
    } else if (hitProp) {
      hitKind = 'prop';
      const propNormal = computeAABBHitNormal(
        hitX,
        hitY,
        hitZ,
        hitProp.x - hitProp.radius,
        0,
        hitProp.z - hitProp.radius,
        hitProp.x + hitProp.radius,
        hitProp.height,
        hitProp.z + hitProp.radius
      );
      hitNormalX = propNormal.nx;
      hitNormalY = propNormal.ny;
      hitNormalZ = propNormal.nz;
    }

    const muzzleDist = Math.min(0.88, Math.max(0.05, bestDist * 0.35));
    const distScale = muzzleDist / 0.88;
    const rightScale = (player.isAds ? 0.015 : 0.22) * distScale;
    const rightX = Math.cos(player.yaw) * rightScale;
    const rightZ = -Math.sin(player.yaw) * rightScale;
    const downOffset = (player.isAds ? 0.06 : 0.14) * distScale;

    sim.traces.push({
      id: sim.nextTraceId++,
      fromX: ox + rightX + dx * muzzleDist,
      fromY: oy - downOffset + dy * muzzleDist,
      fromZ: oz + rightZ + dz * muzzleDist,
      toX: hitX,
      toY: hitY,
      toZ: hitZ,
      ttlMs: 95,
      maxTtlMs: 95,
      colorHex: hitIsHeadshot ? 0xfacc15 : 0xfbbf24,
      isHeadshot: hitIsHeadshot,
      isEnemyShot: false,
      weaponId: baseSpec.id,
      hitNormalX,
      hitNormalY,
      hitNormalZ,
      hitKind,
      propKind: hitProp ? hitProp.kind : undefined,
      damage: spec.damage,
    });

    if (hitEnemy) {
      anyHit = true;
      const dmg = Math.round(
        spec.damage * (hitIsHeadshot ? spec.headshotMultiplier : 1.0)
      );
      totalDamageDealt += dmg;
      hitEnemy.hp = Math.max(0, hitEnemy.hp - dmg);
      hitEnemy.hitFlashMs = 110;

      // Knockback impulse
      hitEnemy.vx += dx * (hitIsHeadshot ? 4.8 : 2.8);
      hitEnemy.vz += dz * (hitIsHeadshot ? 4.8 : 2.8);

      if (hitIsHeadshot) {
        anyHeadshot = true;
      }

      if (hitEnemy.hp <= 0 && hitEnemy.state !== 'ko') {
        hitEnemy.state = 'ko';
        hitEnemy.koTimerMs = 860;
        hitEnemy.respawnTimerMs = 2600;
        hitEnemy.deaths += 1;
        player.kills += 1;
        player.streak += 1;
        player.score += hitIsHeadshot ? 150 : 100;
        if (hitIsHeadshot) {
          player.headshots += 1;
        }
        sim.waveKills += 1;
        sim.hitstopMs = 35;

        events.push({
          type: 'enemy_killed',
          actor: 'p1',
          label: hitIsHeadshot ? 'HEADSHOT ELIMINATION' : 'HOSTILE ELIMINATED',
          weaponId: baseSpec.id,
          damage: dmg,
          x: hitEnemy.x,
          y: hitEnemy.y + 1.2,
          z: hitEnemy.z,
        });
      }
    } else if (hitProp) {
      anyHit = true;
      hitProp.hp = Math.max(0, hitProp.hp - spec.damage);
      hitProp.hitFlashMs = 80;
      if (hitProp.hp <= 0 && !hitProp.broken) {
        hitProp.broken = true;
        hitProp.brokenTimerMs = 9000;
        if (hitProp.kind === 'barrel' && hitProp.explosiveRadius && hitProp.explosiveDamage) {
          const radSq = hitProp.explosiveRadius * hitProp.explosiveRadius;
          for (const enemy of sim.enemies) {
            if (enemy.state === 'ko' || enemy.hp <= 0) continue;
            const edx = enemy.x - hitProp.x;
            const edz = enemy.z - hitProp.z;
            const dSq = edx * edx + edz * edz;
            if (dSq <= radSq) {
              enemy.hp = Math.max(0, enemy.hp - hitProp.explosiveDamage);
              enemy.hitFlashMs = 120;
              if (enemy.hp <= 0) {
                enemy.state = 'ko';
                enemy.koTimerMs = 450;
                enemy.respawnTimerMs = 2400;
                enemy.deaths += 1;
                player.kills += 1;
                player.score += 125;
                sim.waveKills += 1;
              }
            }
          }
          sim.cameraShakeTrauma = Math.min(1, sim.cameraShakeTrauma + 0.55);
          events.push({
            type: 'barrel_explode',
            actor: 'p1',
            label: 'EXPLOSIVE BARREL',
            x: hitProp.x,
            y: 1.0,
            z: hitProp.z,
          });
        } else {
          events.push({
            type: 'prop_shatter',
            actor: 'p1',
            label: 'CRATE DESTROYED',
            x: hitProp.x,
            y: 0.8,
            z: hitProp.z,
          });
        }
      }
    }
  }

  // Apply weapon recoil kick
  const recoilScale = player.isAds ? 0.68 : 1.0;
  player.recoilKickPitch = Math.min(
    0.22,
    player.recoilKickPitch + ((spec.recoilPitchDeg * Math.PI) / 180) * recoilScale
  );
  player.recoilKickYaw +=
    ((Math.random() - 0.5) * 2 * (spec.recoilYawDeg * Math.PI)) / 180;
  sim.cameraShakeTrauma = Math.min(
    1,
    sim.cameraShakeTrauma + (baseSpec.id === 'awp' || baseSpec.id === 'spas12' ? 0.28 : 0.11)
  );

  events.push({
    type: 'shot_fired',
    actor: 'p1',
    label: baseSpec.shortName,
    weaponId: baseSpec.id,
  });

  if (anyHit) {
    player.shotsHit += 1;
    events.push({
      type: anyHeadshot ? 'headshot' : 'hit_body',
      actor: 'p1',
      label: anyHeadshot ? 'HEADSHOT' : 'HIT',
      damage: totalDamageDealt,
    });
  }

  // Auto-reload when magazine hits 0 and reserve ammo is available
  if (ammo.mag <= 0 && ammo.reserve > 0) {
    startPlayerReload(player, events);
  }

  return true;
}

// ============================================================================
// MAIN SIMULATION STEP (60 FPS CLAMPED DT)
// ============================================================================

export function stepSimulation(
  sim: SimulationState,
  dtSeconds: number,
  p1Input: PlayerInputSnapshot,
  botDifficulty: BotDifficulty = 'normal',
  isTraining = false,
  trainingConfig?: TrainingConfig
): CombatEvent[] {
  const events: CombatEvent[] = [];
  const clampedDt = Math.min(Math.max(dtSeconds, 0.001), 0.05);
  const dtMs = clampedDt * 1000;

  // Decay visual timers even during hitstop
  sim.cameraShakeTrauma = Math.max(0, sim.cameraShakeTrauma - clampedDt * 2.6);
  const player = sim.player;
  player.muzzleFlashTimerMs = Math.max(0, player.muzzleFlashTimerMs - dtMs);
  player.hurtFlashMs = Math.max(0, player.hurtFlashMs - dtMs);
  player.slideCooldownMs = Math.max(0, player.slideCooldownMs - dtMs);

  for (let i = sim.traces.length - 1; i >= 0; i--) {
    sim.traces[i].ttlMs -= dtMs;
    if (sim.traces[i].ttlMs <= 0) {
      sim.traces.splice(i, 1);
    }
  }

  if (sim.hitstopMs > 0) {
    sim.hitstopMs = Math.max(0, sim.hitstopMs - dtMs);
    return events;
  }

  if (sim.roundOver || sim.matchOver) {
    return events;
  }

  const arena = ARENA_REGISTRY[sim.arenaId] || ARENA_REGISTRY.foundry_arena;

  // 1. Player Look Rotation & Recoil Recovery
  player.yaw -= p1Input.lookDeltaYaw;
  player.pitch = Math.max(
    -1.35,
    Math.min(1.35, player.pitch - p1Input.lookDeltaPitch)
  );
  const recoilDamp = 1 - Math.exp(-14 * clampedDt);
  player.recoilKickPitch *= 1 - recoilDamp;
  player.recoilKickYaw *= 1 - recoilDamp;

  // 2. Weapon Switching & Click-Active-Gun-to-Reload
  if (p1Input.selectWeapon) {
    handleWeaponSlotClick(player, p1Input.selectWeapon, events);
  } else if (p1Input.cycleWeaponDelta && p1Input.cycleWeaponDelta !== 0) {
    const pair = player.loadoutWeapons;
    const nextWep = player.activeWeapon === pair[0] ? pair[1] : pair[0];
    switchPlayerWeapon(player, nextWep, events);
  }

  // 3. Cooldowns & Reloading
  player.fireCooldownMs = Math.max(0, player.fireCooldownMs - dtMs);
  player.weaponSwitchTimerMs = Math.max(0, player.weaponSwitchTimerMs - dtMs);

  if (p1Input.reloadPressed) {
    startPlayerReload(player, events);
  }

  if (player.isReloading) {
    player.reloadTimerMs -= dtMs;
    if (player.reloadTimerMs <= 0) {
      const effSpec = getPlayerEffectiveWeaponStats(player, player.activeWeapon);
      const ammo = player.weapons[player.activeWeapon];
      const needed = effSpec.magSize - ammo.mag;
      const transfer = Math.max(0, Math.min(needed, ammo.reserve));
      ammo.mag += transfer;
      if (!trainingConfig?.infiniteAmmo) {
        ammo.reserve -= transfer;
      }
      player.isReloading = false;
      player.reloadTimerMs = 0;
      events.push({
        type: 'reload_done',
        actor: 'p1',
        label: 'RELOADED',
        weaponId: player.activeWeapon,
      });
    }
  }

  // 4. Crouch, Tactical Slide, ADS, and Locomotion
  if (p1Input.crouchToggled) {
    player.isCrouching = !player.isCrouching;
    if (player.isCrouching) {
      player.isSliding = false;
      player.slideTimerMs = 0;
    }
  } else if (typeof p1Input.crouchHeld === 'boolean') {
    player.isCrouching = p1Input.crouchHeld;
  }

  const weaponSpec = WEAPON_REGISTRY[player.activeWeapon];
  const inputLen = Math.hypot(p1Input.moveX, p1Input.moveZ);
  const normMoveX = inputLen > 1 ? p1Input.moveX / inputLen : p1Input.moveX;
  const normMoveZ = inputLen > 1 ? p1Input.moveZ / inputLen : p1Input.moveZ;

  // Convert local (moveX = right, moveZ = backward) into world XZ using player.yaw
  const forwardX = -Math.sin(player.yaw);
  const forwardZ = -Math.cos(player.yaw);
  const rightX = Math.cos(player.yaw);
  const rightZ = -Math.sin(player.yaw);

  // Trigger Tactical Slide:
  // - If joystick is moving (inputLen > 0.08), slide in joystick movement direction
  // - If joystick is NOT moving, slide forward in the direction player is facing!
  if (
    p1Input.slidePressed &&
    player.isGrounded &&
    !player.isSliding &&
    player.slideCooldownMs <= 0
  ) {
    let sdx = forwardX;
    let sdz = forwardZ;
    if (inputLen > 0.08) {
      const worldMoveX = rightX * normMoveX - forwardX * normMoveZ;
      const worldMoveZ = rightZ * normMoveX - forwardZ * normMoveZ;
      const wLen = Math.hypot(worldMoveX, worldMoveZ);
      if (wLen > 0.001) {
        sdx = worldMoveX / wLen;
        sdz = worldMoveZ / wLen;
      }
    }
    player.isSliding = true;
    player.slideTimerMs = 520;
    player.slideCooldownMs = 760;
    player.slideDirX = sdx;
    player.slideDirZ = sdz;
    player.isCrouching = false;
    events.push({
      type: 'slide_start',
      actor: 'p1',
      label: 'TACTICAL SLIDE',
    });
  }

  if (player.isSliding) {
    player.slideTimerMs -= dtMs;
    if (player.slideTimerMs <= 0 || !player.isGrounded) {
      player.isSliding = false;
      player.slideTimerMs = 0;
    }
  }

  // Sprint initiation cancels active ADS when player presses sprint while moving forward
  const sprintRequestedForward =
    Boolean(p1Input.sprintHeld) &&
    !player.isCrouching &&
    !player.isSliding &&
    normMoveZ < -0.2;

  if (!player.adsState) {
    player.adsState = createInitialADSControllerState(
      player.activeWeapon,
      resolveEquippedOptic(player.activeWeapon, player.weaponOptics)
    );
  }

  const activeOpticId = resolveEquippedOptic(
    player.activeWeapon,
    player.weaponOptics
  );

  stepADSController(player.adsState, {
    dt: clampedDt,
    rawAimInputDown: Boolean(p1Input.adsHeld),
    aimMode: p1Input.aimMode ?? 'hold',
    weaponId: player.activeWeapon,
    opticId: activeOpticId,
    isReloading: player.isReloading,
    isSprinting: sprintRequestedForward,
    isSliding: player.isSliding,
    isDeadOrRespawning: Boolean(player.awaitingRespawn || player.hp <= 0),
    equipTimerSec: player.weaponSwitchTimerMs / 1000,
  });

  player.isAds = player.adsState.isAimingRequested;
  player.adsBlend = player.adsState.adsProgress;

  const targetEye = player.isSliding ? 0.76 : player.isCrouching ? 1.08 : 1.68;
  player.eyeHeight += (targetEye - player.eyeHeight) * (1 - Math.exp(-16 * clampedDt));

  player.isSprinting =
    sprintRequestedForward && !player.isAds;

  if (player.isSliding) {
    const slideDecay = 0.5 + 0.5 * (player.slideTimerMs / 520);
    const slideSpeed = 14.4 * slideDecay * weaponSpec.moveSpeedMultiplier;
    player.vx = player.slideDirX * slideSpeed;
    player.vz = player.slideDirZ * slideSpeed;
  } else {
    const baseSpeed = player.isCrouching
      ? 4.6
      : player.isAds
        ? 5.2
        : player.isSprinting
          ? 10.6
          : 7.8;
    const moveSpeed = baseSpeed * weaponSpec.moveSpeedMultiplier;

    const wishVx = (rightX * normMoveX - forwardX * normMoveZ) * moveSpeed;
    const wishVz = (rightZ * normMoveX - forwardZ * normMoveZ) * moveSpeed;

    const accel = player.isGrounded ? 18 : 6;
    const blend = 1 - Math.exp(-accel * clampedDt);
    player.vx += (wishVx - player.vx) * blend;
    player.vz += (wishVz - player.vz) * blend;
  }

  // Jump & Vertical Physics
  const wasGroundedBeforeStep = player.isGrounded;
  if (p1Input.jumpPressed && player.isGrounded) {
    player.vy = 7.8;
    player.isGrounded = false;
    player.isCrouching = false;
    player.isSliding = false;
    player.slideTimerMs = 0;
  }

  player.vy -= 21.0 * clampedDt;
  player.y += player.vy * clampedDt;
  if (player.y <= 0) {
    player.y = 0;
    player.vy = 0;
    player.isGrounded = true;
  }

  // Sub-stepped Swept Character Collision Resolution (guarantees player never clips into walls or props at any speed)
  const stepHalfDt = clampedDt * 0.5;
  const midPos = resolveEntityCollisions(
    player.x + player.vx * stepHalfDt,
    player.z + player.vz * stepHalfDt,
    PLAYER_COLLISION_RADIUS,
    arena,
    sim.breakableProps
  );
  const nextPos = resolveEntityCollisions(
    midPos.x + player.vx * stepHalfDt,
    midPos.z + player.vz * stepHalfDt,
    PLAYER_COLLISION_RADIUS,
    arena,
    sim.breakableProps
  );

  // Also prevent player character from walking inside active enemy soldiers
  let finalPx = nextPos.x;
  let finalPz = nextPos.z;
  for (const bot of sim.enemies) {
    if (bot.state === 'ko' || bot.hp <= 0) continue;
    const dx = finalPx - bot.x;
    const dz = finalPz - bot.z;
    const minDist = PLAYER_COLLISION_RADIUS + BOT_COLLISION_RADIUS * 0.65;
    const dSq = dx * dx + dz * dz;
    if (dSq < minDist * minDist && dSq > 0.00001) {
      const d = Math.sqrt(dSq);
      finalPx = bot.x + (dx / d) * minDist;
      finalPz = bot.z + (dz / d) * minDist;
    }
  }
  const clampedFinal = resolveEntityCollisions(
    finalPx,
    finalPz,
    PLAYER_COLLISION_RADIUS,
    arena,
    sim.breakableProps
  );
  player.x = clampedFinal.x;
  player.z = clampedFinal.z;

  // Update 3D Weapon Wall-Obstruction State
  const wallObs = computeWeaponWallObstruction(player, arena, sim.breakableProps);
  player.wallObstruction = wallObs.obstruction;

  // Dynamic Surface Material Detection & Footstep Cadence
  const surfaceNow = getSurfaceMaterialAt(player.x, player.z, sim.arenaId);
  player.currentSurface = surfaceNow;

  if (!wasGroundedBeforeStep && player.isGrounded) {
    player.footstepCount += 1;
    player.footstepDistance = 0;
    player.walkBobPhase = player.footstepCount * Math.PI;
    events.push({
      type: 'footstep',
      actor: 'p1',
      label: `FOOTSTEP_${surfaceNow.toUpperCase()}`,
      surface: surfaceNow,
      stepIntensity: 'land',
      x: player.x,
      y: player.y,
      z: player.z,
    });
  }

  const horizSpeed = Math.hypot(player.vx, player.vz);
  if (player.isGrounded && horizSpeed > 0.4 && !player.isSliding) {
    const strideLen = player.isSprinting
      ? 2.25
      : player.isCrouching || player.isAds
      ? 1.75
      : 1.98;
    const stepAdvance = horizSpeed * clampedDt;
    player.footstepDistance += stepAdvance;
    if (player.footstepDistance >= strideLen) {
      player.footstepDistance -= strideLen;
      player.footstepCount += 1;
      events.push({
        type: 'footstep',
        actor: 'p1',
        label: `FOOTSTEP_${surfaceNow.toUpperCase()}`,
        surface: surfaceNow,
        stepIntensity: player.isSprinting
          ? 'sprint'
          : player.isCrouching
          ? 'crouch'
          : 'walk',
        x: player.x,
        y: player.y,
        z: player.z,
      });
    }
    // Phase-lock walkBobPhase directly to footstepCount + fractional stride progress (1 step = PI radians)
    player.walkBobPhase =
      (player.footstepCount + player.footstepDistance / strideLen) * Math.PI;
  } else if (horizSpeed <= 0.4) {
    // Prime footstep distance when stationary so the first step triggers promptly when starting movement
    player.footstepDistance = Math.max(player.footstepDistance, 1.45);
    player.walkBobPhase =
      (player.footstepCount + Math.min(0.85, player.footstepDistance / 1.98)) * Math.PI;
  }

  // 5. Firing Weapon (respects configured weapon instance fireMode: 'auto' vs 'semi')
  const activeWepInst = findWeaponInstanceForWeaponId(
    player.inventory,
    player.activeWeapon
  );
  const isAutoFireAllowed =
    weaponSpec.autoFire && (!activeWepInst || activeWepInst.fireMode === 'auto');
  const wantsToFire = isAutoFireAllowed
    ? p1Input.fireHeld || p1Input.fireJustPressed
    : p1Input.fireJustPressed;
  if (wantsToFire) {
    firePlayerWeapon(sim, events, Boolean(trainingConfig?.infiniteAmmo));
  }

  // 6. Pickups (Ammo & Medkits)
  for (const pk of sim.pickups) {
    if (!pk.active) {
      pk.respawnTimerMs -= dtMs;
      if (pk.respawnTimerMs <= 0) {
        pk.active = true;
      }
      continue;
    }

    const dx = player.x - pk.x;
    const dz = player.z - pk.z;
    if (dx * dx + dz * dz <= 2.4 * 2.4) {
      if (pk.kind === 'health' && player.hp < player.maxHp) {
        player.hp = Math.min(player.maxHp, player.hp + 45);
        pk.active = false;
        pk.respawnTimerMs = 12000;
        events.push({
          type: 'pickup_collected',
          actor: 'p1',
          label: '+45 HP MEDKIT',
        });
      } else if (pk.kind === 'ammo') {
        for (const wid of WEAPON_ORDER) {
          const wSpec = WEAPON_REGISTRY[wid];
          player.weapons[wid].reserve = wSpec.reserveMax;
        }
        pk.active = false;
        pk.respawnTimerMs = 10000;
        events.push({
          type: 'pickup_collected',
          actor: 'p1',
          label: 'MAX AMMO RESUPPLY',
        });
      }
    }
  }

  // 7. Enemy Squad AI, Deathmatch Scoring & Respawn Progression
  const diff = BOT_DIFFICULTIES[botDifficulty] || BOT_DIFFICULTIES.normal;
  let activeHostilesHpSum = 0;

  for (let i = 0; i < sim.enemies.length; i++) {
    const bot = sim.enemies[i];
    bot.hitFlashMs = Math.max(0, bot.hitFlashMs - dtMs);
    bot.muzzleFlashTimerMs = Math.max(0, bot.muzzleFlashTimerMs - dtMs);
    bot.attackAnimTimerMs = Math.max(0, bot.attackAnimTimerMs - dtMs);

    if (bot.state === 'ko') {
      bot.koTimerMs = Math.max(0, bot.koTimerMs - dtMs);
      bot.respawnTimerMs -= dtMs;
      if (bot.respawnTimerMs <= 0) {
        // Respawn enemy at a spawn point farthest from player
        let bestSp = arena.spawnPoints[0];
        let bestDistSq = -1;
        for (const sp of arena.spawnPoints) {
          const dSq = (sp.x - player.x) ** 2 + (sp.z - player.z) ** 2;
          if (dSq > bestDistSq) {
            bestDistSq = dSq;
            bestSp = sp;
          }
        }
        bot.x = bestSp.x + (i - 2) * 1.5;
        bot.z = bestSp.z;
        bot.hp = bot.maxHp;
        bot.state = 'advance';
        bot.fireCooldownMs = 1000;
        bot.telegraphTimerMs = 0;
      }
      continue;
    }

    activeHostilesHpSum += bot.hp;

    // Training dummy idle behavior option
    if (isTraining && trainingConfig?.dummyBehavior === 'idle') {
      bot.vx = 0;
      bot.vz = 0;
      continue;
    }

    // Periodic cross-arena bot skirmish kill progression so the 5-minute Deathmatch leaderboard stays competitive
    if (!isTraining) {
      bot.skirmishTimerMs -= dtMs;
      if (bot.skirmishTimerMs <= 0) {
        bot.skirmishTimerMs = 15000 + ((i * 4700) % 11000);
        if (Math.random() < 0.42 * diff.accuracy) {
          bot.kills += 1;
          bot.score += 100;
        }
      }
    }

    const toPlayerX = player.x - bot.x;
    const toPlayerZ = player.z - bot.z;
    const distToPlayer = Math.max(0.01, Math.hypot(toPlayerX, toPlayerZ));
    const dirX = toPlayerX / distToPlayer;
    const dirZ = toPlayerZ / distToPlayer;

    // Smoothly turn bot toward player
    const desiredYaw = Math.atan2(-dirX, -dirZ);
    bot.yaw = desiredYaw;

    // Strict 3D multi-ray line of sight check (blocks walls, cover barriers, and unbroken props)
    const hasLineOfSight = hasClearLineOfSight(
      bot.x,
      bot.y,
      bot.z,
      player.x,
      player.y,
      player.z,
      player.eyeHeight,
      arena,
      sim.breakableProps
    );

    // 3 Distinct Archetype Movement Policies:
    let moveVx = 0;
    let moveVz = 0;
    const perpX = -dirZ * bot.strafeDir;
    const perpZ = dirX * bot.strafeDir;

    bot.stateTimerMs -= dtMs;
    if (bot.stateTimerMs <= 0) {
      bot.strafeDir = bot.strafeDir === 1 ? -1 : 1;
      bot.stateTimerMs = 1100 + (i % 3) * 450;
    }

    if (bot.archetype === 'rusher') {
      const rushSpeed = 6.6 * diff.moveSpeedMultiplier;
      if (!hasLineOfSight) {
        moveVx = (dirX * 0.45 + perpX * 0.88) * rushSpeed;
        moveVz = (dirZ * 0.45 + perpZ * 0.88) * rushSpeed;
      } else if (distToPlayer > 7.5) {
        moveVx = (dirX * 0.85 + perpX * 0.4) * rushSpeed;
        moveVz = (dirZ * 0.85 + perpZ * 0.4) * rushSpeed;
      } else {
        moveVx = perpX * rushSpeed * 0.9;
        moveVz = perpZ * rushSpeed * 0.9;
      }
    } else if (bot.archetype === 'sniper') {
      const sniperSpeed = 4.5 * diff.moveSpeedMultiplier;
      if (distToPlayer < 22) {
        moveVx = -dirX * sniperSpeed;
        moveVz = -dirZ * sniperSpeed;
      } else if (!hasLineOfSight) {
        moveVx = perpX * sniperSpeed;
        moveVz = perpZ * sniperSpeed;
      } else {
        moveVx = perpX * sniperSpeed * 0.35;
        moveVz = perpZ * sniperSpeed * 0.35;
      }
    } else {
      // 'assault'
      const assaultSpeed = 5.4 * diff.moveSpeedMultiplier;
      if (!hasLineOfSight) {
        moveVx = (dirX * 0.35 + perpX * 0.92) * assaultSpeed;
        moveVz = (dirZ * 0.35 + perpZ * 0.92) * assaultSpeed;
      } else if (distToPlayer > 22) {
        moveVx = (dirX * 0.75 + perpX * 0.5) * assaultSpeed;
        moveVz = (dirZ * 0.75 + perpZ * 0.5) * assaultSpeed;
      } else if (distToPlayer < 10) {
        moveVx = (-dirX * 0.6 + perpX * 0.7) * assaultSpeed;
        moveVz = (-dirZ * 0.6 + perpZ * 0.7) * assaultSpeed;
      } else {
        moveVx = perpX * assaultSpeed * 0.85;
        moveVz = perpZ * assaultSpeed * 0.85;
      }
    }

    bot.vx += (moveVx - bot.vx) * Math.min(1, clampedDt * 10);
    bot.vz += (moveVz - bot.vz) * Math.min(1, clampedDt * 10);

    let nextBotX = bot.x + bot.vx * clampedDt;
    let nextBotZ = bot.z + bot.vz * clampedDt;

    // Prevent enemy bots from clipping into the player or other bots
    const pDx = nextBotX - player.x;
    const pDz = nextBotZ - player.z;
    const minPlayerDist = PLAYER_COLLISION_RADIUS + BOT_COLLISION_RADIUS * 0.65;
    const pDistSq = pDx * pDx + pDz * pDz;
    if (pDistSq < minPlayerDist * minPlayerDist && pDistSq > 0.00001) {
      const d = Math.sqrt(pDistSq);
      nextBotX = player.x + (pDx / d) * minPlayerDist;
      nextBotZ = player.z + (pDz / d) * minPlayerDist;
    }

    for (let j = 0; j < sim.enemies.length; j++) {
      if (i === j) continue;
      const other = sim.enemies[j];
      if (other.state === 'ko' || other.hp <= 0) continue;
      const bDx = nextBotX - other.x;
      const bDz = nextBotZ - other.z;
      const minBotDist = BOT_COLLISION_RADIUS * 1.45;
      const bDistSq = bDx * bDx + bDz * bDz;
      if (bDistSq < minBotDist * minBotDist && bDistSq > 0.00001) {
        const d = Math.sqrt(bDistSq);
        nextBotX = other.x + (bDx / d) * minBotDist;
        nextBotZ = other.z + (bDz / d) * minBotDist;
      }
    }

    const resolvedBot = resolveEntityCollisions(
      nextBotX,
      nextBotZ,
      BOT_COLLISION_RADIUS,
      arena,
      sim.breakableProps
    );
    bot.x = resolvedBot.x;
    bot.z = resolvedBot.z;
    bot.walkCycle += Math.hypot(bot.vx, bot.vz) * clampedDt * 2.2;

    // Bot Firing & Telegraph Logic (Skip firing if training strafe mode)
    if (isTraining && trainingConfig?.dummyBehavior === 'strafe') {
      continue;
    }

    bot.fireCooldownMs -= dtMs;
    if (hasLineOfSight && distToPlayer < 68 && bot.fireCooldownMs <= 0) {
      if (bot.archetype === 'sniper' && bot.telegraphTimerMs <= 0 && bot.state !== 'telegraph') {
        bot.state = 'telegraph';
        bot.telegraphTimerMs = 550; // 0.55s laser telegraph before sniper shot
        continue;
      }

      if (bot.state === 'telegraph') {
        bot.telegraphTimerMs -= dtMs;
        if (bot.telegraphTimerMs > 0) {
          continue;
        }
        bot.state = 'attack';
      }

      // Bot fires at player: verify exact 3D shot ray against all walls & props so bullets never clip walls
      const ox = bot.x;
      const oy = bot.y + 1.28;
      const oz = bot.z;
      const aimX = player.x + (Math.random() - 0.5) * 0.45;
      const aimY = player.y + Math.max(0.65, player.eyeHeight - 0.2);
      const aimZ = player.z + (Math.random() - 0.5) * 0.45;

      const sVx = aimX - ox;
      const sVy = aimY - oy;
      const sVz = aimZ - oz;
      const sDist = Math.max(0.05, Math.hypot(sVx, sVy, sVz));
      const sDx = sVx / sDist;
      const sDy = sVy / sDist;
      const sDz = sVz / sDist;

      const shotWallHit = findClosestWallHitWithNormal(
        ox,
        oy,
        oz,
        sDx,
        sDy,
        sDz,
        sDist,
        arena,
        sim.breakableProps
      );

      // If the specific bullet ray hits a wall or cover before reaching the player, clamp trace at wall and deal 0 damage!
      if (shotWallHit.dist < sDist - 0.15) {
        bot.fireCooldownMs = 600;
        bot.muzzleFlashTimerMs = 55;
        bot.attackAnimTimerMs = 140;
        sim.traces.push({
          id: sim.nextTraceId++,
          fromX: ox,
          fromY: oy,
          fromZ: oz,
          toX: ox + sDx * shotWallHit.dist,
          toY: oy + sDy * shotWallHit.dist,
          toZ: oz + sDz * shotWallHit.dist,
          ttlMs: 100,
          maxTtlMs: 100,
          colorHex: 0xf87171,
          isHeadshot: false,
          isEnemyShot: true,
          weaponId: bot.weaponId,
          hitNormalX: shotWallHit.nx,
          hitNormalY: shotWallHit.ny,
          hitNormalZ: shotWallHit.nz,
          hitKind: 'wall',
        });
        continue;
      }

      const botDamage =
        bot.archetype === 'sniper' ? 18 : bot.archetype === 'rusher' ? 7 : 9;
      bot.fireCooldownMs =
        (bot.archetype === 'sniper'
          ? 2400
          : bot.archetype === 'rusher'
            ? 850
            : 1100) +
        (1 - diff.accuracy) * 600;
      bot.muzzleFlashTimerMs = 65;
      bot.attackAnimTimerMs = 160;

      const hitRoll = Math.random();
      const hitChance =
        diff.accuracy *
        Math.max(0.2, 1 - distToPlayer / 75) *
        (player.isSliding ? 0.55 : player.isSprinting ? 0.72 : 1.0);

      sim.traces.push({
        id: sim.nextTraceId++,
        fromX: ox,
        fromY: oy,
        fromZ: oz,
        toX: aimX,
        toY: aimY,
        toZ: aimZ,
        ttlMs: 110,
        maxTtlMs: 110,
        colorHex: 0xf87171,
        isHeadshot: false,
        isEnemyShot: true,
        hitNormalX: -sDx,
        hitNormalY: 0.2,
        hitNormalZ: -sDz,
        hitKind: 'sky',
      });

      if (hitRoll < hitChance) {
        let hpLoss = botDamage;
        if (player.inventory && player.inventory.armorHp > 0) {
          const absorbed = Math.min(
            player.inventory.armorHp,
            Math.ceil(botDamage * 0.5)
          );
          player.inventory.armorHp = Math.max(
            0,
            player.inventory.armorHp - absorbed
          );
          hpLoss = Math.max(1, botDamage - absorbed);
        }
        player.hp = Math.max(0, player.hp - hpLoss);
        player.hurtFlashMs = 180;
        sim.cameraShakeTrauma = Math.min(1, sim.cameraShakeTrauma + 0.25);
        events.push({
          type: 'player_hurt',
          actor: 'p2',
          label: 'TAKING FIRE',
          damage: hpLoss,
        });

        if (player.hp <= 0) {
          if (!isTraining) {
            // In 5-minute Deathmatch: credit killer bot, increment player deaths, and respawn player!
            bot.kills += 1;
            bot.score += 100;
            player.deaths += 1;
            player.streak = 0;
            player.hp = player.maxHp;
            player.isReloading = false;
            player.reloadTimerMs = 0;
            player.isAds = false;
            player.adsBlend = 0;
            if (player.adsState) {
              cancelADSController(player.adsState, true);
            }
            for (const wid of player.loadoutWeapons) {
              const effWSpec = getPlayerEffectiveWeaponStats(player, wid);
              player.weapons[wid] = {
                mag: effWSpec.magSize,
                reserve: effWSpec.reserveMax,
              };
            }
            // Respawn player at south courtyard or safest spawn point and flag awaitingRespawn for Loadout UI
            player.x = 0;
            player.y = 0;
            player.z = 20;
            player.vx = 0;
            player.vy = 0;
            player.vz = 0;
            player.awaitingRespawn = true;
            events.push({
              type: 'player_respawn',
              actor: 'p1',
              label: 'RESPAWNED',
            });
          } else {
            player.hp = player.maxHp;
          }
        }
      }
    } else {
      bot.telegraphTimerMs = 0;
      if (bot.state === 'telegraph') bot.state = 'advance';
    }
  }

  // Auto-regen in training or slow tactical health recovery out of combat
  if (trainingConfig?.autoRegenHp && player.hurtFlashMs <= 0 && player.hp < player.maxHp) {
    player.hp = Math.min(player.maxHp, player.hp + clampedDt * 6);
  }

  // Wave progression
  if (sim.waveKills >= sim.waveTargetKills) {
    sim.waveNumber += 1;
    sim.waveKills = 0;
    sim.waveTargetKills += 6;
    player.hp = Math.min(player.maxHp, player.hp + 35);
    events.push({
      type: 'wave_clear',
      actor: 'p1',
      label: `WAVE ${sim.waveNumber}`,
    });
  }

  // Update p2 summary HP for any legacy status readers
  sim.p2.hp = Math.round(activeHostilesHpSum / Math.max(1, sim.enemies.length));

  // 5-Minute Deathmatch Timer Countdown & Winner Evaluation
  if (!isTraining) {
    sim.roundTimerSec = Math.max(0, sim.roundTimerSec - clampedDt);
    if (sim.roundTimerSec <= 0) {
      sim.roundOver = true;
      sim.matchOver = true;
      const leaderboard = getMatchLeaderboard(sim);
      const topEntry = leaderboard[0];
      sim.winnerName = topEntry.name;
      sim.winnerKills = topEntry.kills;
      if (topEntry.isPlayer) {
        sim.roundWinner = 'p1';
        sim.matchWinner = 'p1';
      } else {
        sim.roundWinner = 'p2';
        sim.matchWinner = 'p2';
      }
    }
  }

  return events;
}
