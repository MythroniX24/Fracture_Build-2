import {
  ARENA_REGISTRY,
  BOT_DIFFICULTIES,
  CHARACTER_REGISTRY,
} from './config.ts';
import type { BotDifficulty } from './config.ts';
import { createEmptyInput } from './rules.ts';
import type {
  FighterInput,
  FighterState,
  SimulationState,
} from './rules.ts';

export type AIStateName =
  | 'idle'
  | 'approach'
  | 'maintain_distance'
  | 'attack'
  | 'defend'
  | 'dodge'
  | 'counter'
  | 'recover'
  | 'reposition'
  | 'react_ability'
  | 'return_to_combat';

export class BotAIController {
  public currentState: AIStateName = 'idle';
  private decisionTimer = 0;
  private reactionTimer = 0;
  private strafeDirection: 1 | -1 = 1;
  private guardDuration = 0;
  private queuedAction: 'none' | 'light' | 'heavy' | 'ability' | 'dodge' | 'parry' = 'none';
  private rngState = 1337;

  constructor(seed = 1337) {
    this.rngState = seed;
  }

  private nextRandom(): number {
    // Deterministic LCG so unit tests and bot behavior are reproducible
    this.rngState = (this.rngState * 1664525 + 1013904223) >>> 0;
    return this.rngState / 0xffffffff;
  }

  public reset(): void {
    this.currentState = 'idle';
    this.decisionTimer = 0;
    this.reactionTimer = 0;
    this.guardDuration = 0;
    this.queuedAction = 'none';
  }

  public computeInput(
    sim: SimulationState,
    bot: FighterState,
    player: FighterState,
    difficulty: BotDifficulty,
    dummyMode: 'idle' | 'block_all' | 'counter_hit' | 'active_bot',
    dt: number
  ): FighterInput {
    const input = createEmptyInput();

    if (sim.roundOver || sim.matchOver) {
      return input;
    }

    // Training dummy modes
    if (dummyMode === 'idle') {
      this.currentState = 'idle';
      return input;
    }

    if (dummyMode === 'block_all') {
      this.currentState = 'defend';
      input.guardHeld = bot.stamina > 12;
      return input;
    }

    if (dummyMode === 'counter_hit') {
      // Blocks until hit or player recovers, then immediately throws a light counter
      const playerRecovering =
        player.actionState === 'light_recovery' ||
        player.actionState === 'heavy_recovery' ||
        player.actionState === 'ability_recovery';

      if (playerRecovering && Math.hypot(player.x - bot.x, player.z - bot.z) <= 2.6) {
        this.currentState = 'counter';
        input.lightAttackJustPressed = true;
      } else {
        this.currentState = 'defend';
        input.guardHeld = bot.stamina > 15;
      }
      return input;
    }

    // Full state-driven Bot AI
    const profile = BOT_DIFFICULTIES[difficulty];
    const botDef = CHARACTER_REGISTRY[bot.characterId];
    const arena = ARENA_REGISTRY[sim.arenaId];

    // If bot is in hit stun or knockdown, enter recover state
    if (
      bot.actionState === 'hit_stun' ||
      bot.actionState === 'stagger' ||
      bot.actionState === 'knockdown'
    ) {
      this.currentState = 'recover';
      this.queuedAction = 'none';
      return input;
    }

    // Perceivable target: if player has an active decoy and bot fails a perception check, bot tracks the decoy briefly!
    let targetX = player.x;
    let targetZ = player.z;
    if (player.decoy.active && player.decoy.ttl > 1.8 && this.nextRandom() < profile.mistakeRate + 0.25) {
      targetX = player.decoy.x;
      targetZ = player.decoy.z;
    }

    const dx = targetX - bot.x;
    const dz = targetZ - bot.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const dirX = dx / dist;
    const dirZ = dz / dist;
    const perpX = -dirZ * this.strafeDirection;
    const perpZ = dirX * this.strafeDirection;

    const botDistFromCenter = Math.hypot(bot.x, bot.z);

    // Execute queued reaction when reaction timer finishes
    if (this.reactionTimer > 0) {
      this.reactionTimer -= dt;
      if (this.reactionTimer <= 0 && this.queuedAction !== 'none') {
        const act = this.queuedAction;
        this.queuedAction = 'none';
        if (act === 'dodge') {
          input.dodgeJustPressed = true;
          input.moveX = perpX;
          input.moveZ = perpZ;
          return input;
        }
        if (act === 'parry') {
          input.guardJustPressed = true;
          input.guardHeld = true;
          return input;
        }
        if (act === 'light') {
          input.lightAttackJustPressed = true;
          return input;
        }
        if (act === 'heavy') {
          input.heavyAttackJustPressed = true;
          return input;
        }
        if (act === 'ability') {
          input.abilityJustPressed = true;
          return input;
        }
      }
    }

    // Observe player telegraphs (never reading raw controller buttons, only visible startup animations!)
    const playerInHeavyOrAbilityStartup =
      player.actionState === 'heavy_startup' || player.actionState === 'ability_startup';
    const playerInLightStartup = player.actionState === 'light_startup';
    const playerInRecovery =
      player.actionState === 'light_recovery' ||
      player.actionState === 'heavy_recovery' ||
      player.actionState === 'ability_recovery' ||
      player.actionState === 'parry_Whiff' ||
      player.actionState === 'stagger';

    this.decisionTimer -= dt;
    if (this.decisionTimer <= 0) {
      this.decisionTimer = profile.decisionIntervalSeconds * (0.85 + this.nextRandom() * 0.3);

      //Occasionally flip strafe direction
      if (this.nextRandom() < 0.28) {
        this.strafeDirection = this.strafeDirection === 1 ? -1 : 1;
      }

      // 1. Arena boundary awareness: if backed near edge, reposition toward center
      if (botDistFromCenter > arena.dangerRingRadius) {
        this.currentState = 'return_to_combat';
      }
      // 2. React to observable heavy/ability startup within threat range
      else if (playerInHeavyOrAbilityStartup && dist < 3.8 && this.queuedAction === 'none') {
        this.currentState = 'react_ability';
        const roll = this.nextRandom();
        if (roll < profile.dodgeChanceOnAbility && bot.stamina >= botDef.stats.dodgeStaminaCost) {
          this.queuedAction = 'dodge';
          this.reactionTimer = profile.reactionDelaySeconds * 0.7;
        } else if (roll < profile.dodgeChanceOnAbility + profile.parryChanceOnHeavy) {
          this.queuedAction = 'parry';
          this.reactionTimer = profile.reactionDelaySeconds * 0.6;
        } else {
          this.currentState = 'defend';
        }
      }
      // 3. React to light attack at close range
      else if (playerInLightStartup && dist < 2.7) {
        if (this.nextRandom() < profile.guardLikelihood && bot.stamina > 20) {
          this.currentState = 'defend';
        }
      }
      // 4. Punish observable player recovery / stagger windows
      else if (playerInRecovery && dist < 3.1 && bot.stamina > 22) {
        this.currentState = 'counter';
        if (this.nextRandom() > profile.mistakeRate) {
          this.queuedAction = dist < 2.3 ? 'heavy' : 'light';
          this.reactionTimer = profile.reactionDelaySeconds * 0.5;
        }
      }
      // 5. Low stamina management: back off and recover stamina
      else if (bot.stamina < 26) {
        this.currentState = 'maintain_distance';
      }
      // 6. Far away: approach player
      else if (dist > 3.2) {
        this.currentState = 'approach';
      }
      // 7. In combat range: decide between attack, ability, reposition, or guard
      else {
        const roll = this.nextRandom();
        if (roll < profile.aggression) {
          this.currentState = 'attack';
          if (
            bot.abilityCooldown <= 0 &&
            bot.stamina >= botDef.ability.staminaCost + 15 &&
            this.nextRandom() < 0.32
          ) {
            this.queuedAction = 'ability';
            this.reactionTimer = profile.reactionDelaySeconds;
          } else if (this.nextRandom() < 0.35 && bot.stamina >= botDef.attacks.heavy.staminaCost) {
            this.queuedAction = 'heavy';
            this.reactionTimer = profile.reactionDelaySeconds;
          } else {
            this.queuedAction = 'light';
            this.reactionTimer = profile.reactionDelaySeconds * 0.8;
          }
        } else if (roll < profile.aggression + 0.2) {
          this.currentState = 'reposition';
        } else {
          this.currentState = 'maintain_distance';
        }
      }
    }

    // Translate current AI state into movement & guard inputs
    switch (this.currentState) {
      case 'return_to_combat': {
        // Move toward arena center (0, 0) while strafing around player
        const toCenterLen = Math.hypot(-bot.x, -bot.z) || 1;
        input.moveX = (-bot.x / toCenterLen) * 0.75 + perpX * 0.45;
        input.moveZ = (-bot.z / toCenterLen) * 0.75 + perpZ * 0.45;
        input.sprint = bot.stamina > 45;
        break;
      }

      case 'approach': {
        input.moveX = dirX * 0.88 + perpX * 0.25;
        input.moveZ = dirZ * 0.88 + perpZ * 0.25;
        input.sprint = dist > 5.2 && bot.stamina > 50;
        break;
      }

      case 'maintain_distance': {
        // Ideal spacing ~ 2.6m
        const radial = dist < 2.3 ? -0.65 : dist > 3.2 ? 0.45 : 0;
        input.moveX = dirX * radial + perpX * 0.75;
        input.moveZ = dirZ * radial + perpZ * 0.75;
        break;
      }

      case 'reposition': {
        input.moveX = perpX * 0.95;
        input.moveZ = perpZ * 0.95;
        break;
      }

      case 'defend': {
        this.guardDuration += dt;
        // Never block forever: release guard after 1.1s or if stamina drops low
        if (this.guardDuration > 1.1 || bot.stamina < 18) {
          this.guardDuration = 0;
          this.currentState = 'reposition';
          input.guardHeld = false;
        } else {
          input.guardHeld = true;
          input.moveX = perpX * 0.35;
          input.moveZ = perpZ * 0.35;
        }
        break;
      }

      case 'attack':
      case 'counter': {
        if (dist > botDef.attacks.light.range * 0.85) {
          input.moveX = dirX * 0.9;
          input.moveZ = dirZ * 0.9;
        } else {
          input.moveX = perpX * 0.3;
          input.moveZ = perpZ * 0.3;
        }
        break;
      }

      default:
        break;
    }

    if (this.currentState !== 'defend') {
      this.guardDuration = 0;
    }

    return input;
  }
}
