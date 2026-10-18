export type CharacterId = 'volt' | 'rift';
export type ArenaId = 'iron_fortress' | 'overgrown_colossus';
export type BotDifficulty = 'easy' | 'normal' | 'hard';
export type GameMode = 'bot' | 'training' | 'multiplayer';

export type ScreenState =
  | 'main_menu'
  | 'mode_select'
  | 'character_select'
  | 'arena_select'
  | 'match_settings'
  | 'multiplayer_lobby'
  | 'loading'
  | 'countdown'
  | 'combat'
  | 'paused'
  | 'round_result'
  | 'match_result';

export type FighterActionState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'dodge'
  | 'block'
  | 'parry_active'
  | 'parry_Whiff'
  | 'light_startup'
  | 'light_active'
  | 'light_recovery'
  | 'heavy_startup'
  | 'heavy_active'
  | 'heavy_recovery'
  | 'ability_startup'
  | 'ability_active'
  | 'ability_recovery'
  | 'hit_stun'
  | 'stagger'
  | 'knockdown'
  | 'victory'
  | 'defeat';

export interface AttackSpec {
  id: 'light' | 'heavy' | 'ability';
  name: string;
  startup: number; // seconds
  active: number; // seconds
  recovery: number; // seconds
  range: number; // meters
  arcDegrees: number; // frontal cone angle
  damage: number;
  guardDamage: number; // stamina damage on block
  chipDamageRatio: number; // fraction of damage that bleeds through block
  staminaCost: number;
  knockbackForce: number;
  hitStunDuration: number;
  staggerOnGuardBreak: number;
  interruptibleStartup: boolean;
  forwardImpulse: number;
}

export interface AbilitySpec {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  counterplayHint: string;
  cooldown: number; // seconds
  staminaCost: number;
}

export interface CharacterDefinition {
  id: CharacterId;
  name: string;
  codename: string;
  role: string;
  origin: string;
  lore: string;
  palette: {
    primary: string;
    secondary: string;
    frame: string;
    accent: string;
    weathered: string;
  };
  stats: {
    maxHp: number;
    maxStamina: number;
    staminaRegenPerSec: number;
    walkSpeed: number;
    runSpeed: number;
    acceleration: number;
    deceleration: number;
    dodgeSpeed: number;
    dodgeDuration: number;
    dodgeIFrameStart: number;
    dodgeIFrameEnd: number;
    dodgeStaminaCost: number;
    parryWindow: number;
    parryRecovery: number;
    guardDamageReduction: number; // e.g., 0.85 reduces 85% of incoming damage
    mass: number;
    displayRatings: {
      power: number; // 1-10
      speed: number; // 1-10
      defense: number; // 1-10
      technique: number; // 1-10
    };
  };
  attacks: {
    light: AttackSpec;
    heavy: AttackSpec;
    ability: AttackSpec;
  };
  ability: AbilitySpec;
}

export interface ArenaObstacle {
  id: string;
  x: number;
  z: number;
  radius: number;
  height: number;
  blocksMovement: boolean;
  blocksAttacks: boolean;
}

export interface ArenaDefinition {
  id: ArenaId;
  name: string;
  subtitle: string;
  region: string;
  description: string;
  playableRadius: number;
  dangerRingRadius: number;
  spawnDistance: number;
  obstacles: ArenaObstacle[];
  atmosphere: {
    backgroundHex: string;
    fogHex: string;
    fogDensity: number;
    keyLightHex: string;
    keyLightIntensity: number;
    hemiSkyHex: string;
    hemiGroundHex: string;
    accentHex: string;
  };
}

export interface BotDifficultyProfile {
  id: BotDifficulty;
  label: string;
  description: string;
  reactionDelaySeconds: number;
  decisionIntervalSeconds: number;
  parryChanceOnHeavy: number;
  dodgeChanceOnAbility: number;
  guardLikelihood: number;
  mistakeRate: number; // probability of sub-optimal spacing or delayed punish
  aggression: number;
}

export interface GameSettings {
  masterVolume: number; // 0 to 1
  muted: boolean;
  graphicsQuality: 'low' | 'medium' | 'high';
  cameraSensitivity: number; // 0.5 to 2.0
  touchSensitivity: number; // 0.5 to 2.0
  touchDeadzone: number; // 0.05 to 0.30
  aimAssist: boolean;
  moveAssist: boolean;
  showControlHints: boolean;
  autoFullscreenLandscape: boolean;
  screenShake: boolean;
  particleQuality: 'low' | 'medium' | 'high';
  keybindings: {
    moveForward: string;
    moveBackward: string;
    moveLeft: string;
    moveRight: string;
    lightAttack: string;
    heavyAttack: string;
    guard: string;
    dodge: string;
    ability: string;
    sprint: string;
    lockOn: string;
  };
}

export interface TrainingConfig {
  dummyBehavior: 'idle' | 'block_all' | 'counter_hit' | 'active_bot';
  botDifficulty: BotDifficulty;
  infiniteStamina: boolean;
  playerInvulnerable: boolean;
  instantCooldowns: boolean;
  showHitboxInfo: boolean;
}

export const CHARACTER_REGISTRY: Record<CharacterId, CharacterDefinition> = {
  volt: {
    id: 'volt',
    name: 'VOLT',
    codename: 'SIEGE BREAKER UNIT-04',
    role: 'Heavy Power Fighter',
    origin: 'Foundry Sector IX — Furnace Guard',
    lore: 'Forged to dismantle rogue industrial titans, VOLT encases a high-output arc reactor inside reinforced ochre plate. Every strike carries crushing hydraulic momentum, trading recovery speed for devastating guard pressure.',
    palette: {
      primary: '#d97706', // Industrial amber-ochre
      secondary: '#b45309', // Burnt forge orange
      frame: '#1f242d', // Charcoal mechanical chassis
      accent: '#38bdf8', // Restrained arc-core blue
      weathered: '#57534e', // Worn steel
    },
    stats: {
      maxHp: 130,
      maxStamina: 100,
      staminaRegenPerSec: 18,
      walkSpeed: 4.3,
      runSpeed: 6.5,
      acceleration: 25,
      deceleration: 28,
      dodgeSpeed: 9.4,
      dodgeDuration: 0.42,
      dodgeIFrameStart: 0.04,
      dodgeIFrameEnd: 0.26,
      dodgeStaminaCost: 20,
      parryWindow: 0.22,
      parryRecovery: 0.34,
      guardDamageReduction: 0.88,
      mass: 1.35,
      displayRatings: {
        power: 9,
        speed: 5,
        defense: 9,
        technique: 6,
      },
    },
    attacks: {
      light: {
        id: 'light',
        name: 'Hydraulic Jab',
        startup: 0.15,
        active: 0.14,
        recovery: 0.22,
        range: 2.4,
        arcDegrees: 110,
        damage: 12,
        guardDamage: 16,
        chipDamageRatio: 0.1,
        staminaCost: 11,
        knockbackForce: 5.2,
        hitStunDuration: 0.36,
        staggerOnGuardBreak: 1.15,
        interruptibleStartup: true,
        forwardImpulse: 3.4,
      },
      heavy: {
        id: 'heavy',
        name: 'Piston Haymaker',
        startup: 0.34,
        active: 0.18,
        recovery: 0.42,
        range: 2.8,
        arcDegrees: 125,
        damage: 26,
        guardDamage: 38,
        chipDamageRatio: 0.18,
        staminaCost: 25,
        knockbackForce: 11.5,
        hitStunDuration: 0.58,
        staggerOnGuardBreak: 1.35,
        interruptibleStartup: false, // Reinforced poise during heavy windup
        forwardImpulse: 5.4,
      },
      ability: {
        id: 'ability',
        name: 'Overcharge Tectonic Slam',
        startup: 0.42,
        active: 0.22,
        recovery: 0.50,
        range: 3.6,
        arcDegrees: 180,
        damage: 32,
        guardDamage: 55,
        chipDamageRatio: 0.25,
        staminaCost: 30,
        knockbackForce: 14.5,
        hitStunDuration: 0.72,
        staggerOnGuardBreak: 1.5,
        interruptibleStartup: false,
        forwardImpulse: 6.8,
      },
    },
    ability: {
      id: 'overcharge_slam',
      name: 'Overcharge Slam',
      subtitle: 'High-Commitment Arc Discharge',
      description: 'Vents core pressure into a leaping ground-shattering strike that deals massive guard damage in a wide frontal shockwave.',
      counterplayHint: 'Long 0.42s windup telegraph — back-dodge out of the 3.6m radius or punish the 0.50s recovery window.',
      cooldown: 8.5,
      staminaCost: 30,
    },
  },
  rift: {
    id: 'rift',
    name: 'RIFT',
    codename: 'THE FALSE REMNANT',
    role: 'Agile Colossus Scavenger & Trickster',
    origin: 'Sunken Reliquary — Outer Bone-Fields',
    lore: 'Clad in asymmetrical bone-white plating salvaged from dormant Colossi, RIFT fights with deceptive cadence and a mechanical echo-bracer that projects a physical remnant decoy to bait and punish overextension.',
    palette: {
      primary: '#d6d3cd', // Bone-white salvaged armour
      secondary: '#4b5563', // Weathered steel
      frame: '#18181b', // Charcoal mechanical joints
      accent: '#a3b18a', // Subdued oxidized moss-sage
      weathered: '#78716c', // Warm stone patina
    },
    stats: {
      maxHp: 105,
      maxStamina: 115,
      staminaRegenPerSec: 24,
      walkSpeed: 5.4,
      runSpeed: 8.2,
      acceleration: 33,
      deceleration: 35,
      dodgeSpeed: 11.6,
      dodgeDuration: 0.36,
      dodgeIFrameStart: 0.03,
      dodgeIFrameEnd: 0.26,
      dodgeStaminaCost: 15,
      parryWindow: 0.24,
      parryRecovery: 0.28,
      guardDamageReduction: 0.80,
      mass: 0.92,
      displayRatings: {
        power: 6,
        speed: 9,
        defense: 6,
        technique: 10,
      },
    },
    attacks: {
      light: {
        id: 'light',
        name: 'Scavenger Slash',
        startup: 0.11,
        active: 0.12,
        recovery: 0.17,
        range: 2.3,
        arcDegrees: 105,
        damage: 9,
        guardDamage: 12,
        chipDamageRatio: 0.08,
        staminaCost: 9,
        knockbackForce: 3.8,
        hitStunDuration: 0.30,
        staggerOnGuardBreak: 1.0,
        interruptibleStartup: true,
        forwardImpulse: 3.9,
      },
      heavy: {
        id: 'heavy',
        name: 'Spiral Thrust',
        startup: 0.24,
        active: 0.15,
        recovery: 0.30,
        range: 3.0,
        arcDegrees: 90,
        damage: 19,
        guardDamage: 26,
        chipDamageRatio: 0.15,
        staminaCost: 20,
        knockbackForce: 8.2,
        hitStunDuration: 0.48,
        staggerOnGuardBreak: 1.2,
        interruptibleStartup: true,
        forwardImpulse: 6.2,
      },
      ability: {
        id: 'ability',
        name: 'False Remnant Feint',
        startup: 0.14,
        active: 0.16,
        recovery: 0.24,
        range: 3.1,
        arcDegrees: 115,
        damage: 21,
        guardDamage: 28,
        chipDamageRatio: 0.16,
        staminaCost: 24,
        knockbackForce: 9.0,
        hitStunDuration: 0.52,
        staggerOnGuardBreak: 1.25,
        interruptibleStartup: true,
        forwardImpulse: 7.5,
      },
    },
    ability: {
      id: 'false_remnant',
      name: 'False Remnant',
      subtitle: 'Mechanical Decoy & Flank Dash',
      description: 'Deploys a stationary mechanical hologram-armour decoy at RIFT’s current position while darting laterally at an angle to deliver a flanking counter-slash.',
      counterplayHint: 'Watch for the bronze mechanical flicker on the stationary decoy and track RIFT’s lateral dust trail; wide sweeping strikes catch the dash.',
      cooldown: 7.0,
      staminaCost: 24,
    },
  },
};

export const ARENA_REGISTRY: Record<ArenaId, ArenaDefinition> = {
  iron_fortress: {
    id: 'iron_fortress',
    name: 'THE IRON FORTRESS',
    subtitle: 'Foundry Crucible Deck 04',
    region: 'Upper Smelting Citadel',
    description: 'A suspended octagonal crucible platform surrounded by monumental rotating drive gears, riveted gantry catwalks, and molten slag pits below.',
    playableRadius: 11.5,
    dangerRingRadius: 9.8,
    spawnDistance: 4.5,
    obstacles: [
      { id: 'pylon_nw', x: -7.2, z: -7.2, radius: 0.85, height: 4.5, blocksMovement: true, blocksAttacks: true },
      { id: 'pylon_ne', x: 7.2, z: -7.2, radius: 0.85, height: 4.5, blocksMovement: true, blocksAttacks: true },
      { id: 'pylon_sw', x: -7.2, z: 7.2, radius: 0.85, height: 4.5, blocksMovement: true, blocksAttacks: true },
      { id: 'pylon_se', x: 7.2, z: 7.2, radius: 0.85, height: 4.5, blocksMovement: true, blocksAttacks: true },
    ],
    atmosphere: {
      backgroundHex: '#121316',
      fogHex: '#18191e',
      fogDensity: 0.018,
      keyLightHex: '#ffedd5',
      keyLightIntensity: 2.2,
      hemiSkyHex: '#64748b',
      hemiGroundHex: '#292524',
      accentHex: '#d97706',
    },
  },
  overgrown_colossus: {
    id: 'overgrown_colossus',
    name: 'THE OVERGROWN COLOSSUS',
    subtitle: 'Cradle of the First Titan',
    region: 'Verdant Reclamation Basin',
    description: 'An ancient stone sanctuary built inside the ribcage and severed forearm of a petrified Colossus, reclaimed by twisting roots, weathered moss, and mist.',
    playableRadius: 12.0,
    dangerRingRadius: 10.2,
    spawnDistance: 4.5,
    obstacles: [
      { id: 'relic_west', x: -8.0, z: 0, radius: 0.95, height: 3.8, blocksMovement: true, blocksAttacks: true },
      { id: 'relic_east', x: 8.0, z: 0, radius: 0.95, height: 3.8, blocksMovement: true, blocksAttacks: true },
    ],
    atmosphere: {
      backgroundHex: '#111715',
      fogHex: '#16201d',
      fogDensity: 0.016,
      keyLightHex: '#fef3c7',
      keyLightIntensity: 2.0,
      hemiSkyHex: '#5eead4',
      hemiGroundHex: '#1c1917',
      accentHex: '#84a98c',
    },
  },
};

export const BOT_DIFFICULTIES: Record<BotDifficulty, BotDifficultyProfile> = {
  easy: {
    id: 'easy',
    label: 'RECRUIT UNIT (EASY)',
    description: 'Slower reaction cadence, telegraphed spacing, and frequent recovery openings.',
    reactionDelaySeconds: 0.42,
    decisionIntervalSeconds: 0.45,
    parryChanceOnHeavy: 0.05,
    dodgeChanceOnAbility: 0.18,
    guardLikelihood: 0.28,
    mistakeRate: 0.38,
    aggression: 0.42,
  },
  normal: {
    id: 'normal',
    label: 'VANGUARD AUTOMATON (NORMAL)',
    description: 'Balanced spacing, active stamina management, and reliable defense.',
    reactionDelaySeconds: 0.24,
    decisionIntervalSeconds: 0.26,
    parryChanceOnHeavy: 0.22,
    dodgeChanceOnAbility: 0.48,
    guardLikelihood: 0.55,
    mistakeRate: 0.16,
    aggression: 0.65,
  },
  hard: {
    id: 'hard',
    label: 'PRIME ARBITER (HARD)',
    description: 'Sharp spacing, calculated whiff punishes, and disciplined counter-timings without stat cheating.',
    reactionDelaySeconds: 0.14,
    decisionIntervalSeconds: 0.15,
    parryChanceOnHeavy: 0.45,
    dodgeChanceOnAbility: 0.75,
    guardLikelihood: 0.76,
    mistakeRate: 0.05,
    aggression: 0.82,
  },
};

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.7,
  muted: false,
  graphicsQuality: 'high',
  cameraSensitivity: 1.0,
  touchSensitivity: 1.0,
  touchDeadzone: 0.12,
  aimAssist: true,
  moveAssist: true,
  showControlHints: true,
  autoFullscreenLandscape: true,
  screenShake: true,
  particleQuality: 'high',
  keybindings: {
    moveForward: 'KeyW',
    moveBackward: 'KeyS',
    moveLeft: 'KeyA',
    moveRight: 'KeyD',
    lightAttack: 'KeyJ',
    heavyAttack: 'KeyK',
    guard: 'KeyL',
    dodge: 'Space',
    ability: 'KeyE',
    sprint: 'ShiftLeft',
    lockOn: 'Tab',
  },
};

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  dummyBehavior: 'active_bot',
  botDifficulty: 'normal',
  infiniteStamina: false,
  playerInvulnerable: false,
  instantCooldowns: false,
  showHitboxInfo: true,
};
