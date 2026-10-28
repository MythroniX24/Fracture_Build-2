import { WEAPON_REGISTRY, type WeaponId } from '../config.ts';
import type { PlayerShooterState } from '../rules.ts';
import { cancelADSController } from '../ads/ADSController.ts';
import { resolveEquippedOptic } from '../ads/ScopeAttachmentSystem.ts';
import { getItemDefinition } from './ItemRegistry.ts';
import {
  opticIdToAttachmentItemId,
  resolveOpticIdFromAttachments,
} from './AttachmentInventoryAdapter.ts';
import type {
  EffectiveWeaponStats,
  PlayerInventoryState,
  WeaponAttachmentMap,
  WeaponInstanceState,
} from './InventoryTypes.ts';

/**
 * Computes effective gameplay weapon statistics for a weapon with its installed attachments.
 * Used both by the WeaponInspectionPanel UI and by live gameplay (firing, reload, magazine capacity, recoil, spread).
 */
export function computeEffectiveWeaponStats(
  weaponId: WeaponId,
  attachments?: WeaponAttachmentMap
): EffectiveWeaponStats {
  const base = WEAPON_REGISTRY[weaponId] || WEAPON_REGISTRY.m4a1;

  let damageMult = 1.0;
  let rpmMult = 1.0;
  let magDelta = 0;
  let reloadMult = 1.0;
  let hipSpreadMult = 1.0;
  let adsSpreadMult = 1.0;
  let recoilPitchMult = 1.0;
  let recoilYawMult = 1.0;
  let rangeMult = 1.0;
  let moveSpeedDelta = 0;

  if (attachments) {
    for (const attItemId of Object.values(attachments)) {
      if (!attItemId) continue;
      const def = getItemDefinition(attItemId);
      const mod = def?.statModifiers;
      if (!mod) continue;

      if (mod.damageMultiplier !== undefined) damageMult *= mod.damageMultiplier;
      if (mod.rpmMultiplier !== undefined) rpmMult *= mod.rpmMultiplier;
      if (mod.magSizeDelta !== undefined) magDelta += mod.magSizeDelta;
      if (mod.reloadTimeMultiplier !== undefined) reloadMult *= mod.reloadTimeMultiplier;
      if (mod.hipSpreadMultiplier !== undefined) hipSpreadMult *= mod.hipSpreadMultiplier;
      if (mod.adsSpreadMultiplier !== undefined) adsSpreadMult *= mod.adsSpreadMultiplier;
      if (mod.recoilPitchMultiplier !== undefined) recoilPitchMult *= mod.recoilPitchMultiplier;
      if (mod.recoilYawMultiplier !== undefined) recoilYawMult *= mod.recoilYawMultiplier;
      if (mod.maxRangeMultiplier !== undefined) rangeMult *= mod.maxRangeMultiplier;
      if (mod.moveSpeedMultiplierDelta !== undefined) moveSpeedDelta += mod.moveSpeedMultiplierDelta;
    }
  }

  const effectiveRpm = Math.max(30, Math.round(base.rpm * rpmMult));
  const effectiveFireIntervalMs = Math.max(40, Math.round(60000 / effectiveRpm));
  const effectiveMagSize = Math.max(1, base.magSize + magDelta);
  const effectiveReloadTimeMs = Math.max(
    650,
    Math.round(base.reloadTimeMs * reloadMult)
  );

  return {
    weaponId: base.id,
    damage: Math.max(1, Math.round(base.damage * damageMult)),
    headshotMultiplier: base.headshotMultiplier,
    rpm: effectiveRpm,
    fireIntervalMs: effectiveFireIntervalMs,
    magSize: effectiveMagSize,
    reserveMax: base.reserveMax,
    reloadTimeMs: effectiveReloadTimeMs,
    pellets: base.pellets,
    hipSpreadDeg: Math.round(base.hipSpreadDeg * hipSpreadMult * 100) / 100,
    adsSpreadDeg: Math.round(base.adsSpreadDeg * adsSpreadMult * 1000) / 1000,
    recoilPitchDeg: Math.round(base.recoilPitchDeg * recoilPitchMult * 100) / 100,
    recoilYawDeg: Math.round(base.recoilYawDeg * recoilYawMult * 100) / 100,
    maxRange: Math.round(base.maxRange * rangeMult),
    moveSpeedMultiplier:
      Math.round(Math.max(0.75, Math.min(1.2, base.moveSpeedMultiplier + moveSpeedDelta)) * 100) /
      100,
    opticId: resolveOpticIdFromAttachments(attachments),
  };
}

/**
 * Finds the active WeaponInstanceState for a given WeaponId (checking equipped slots first, then stored weapons).
 */
export function findWeaponInstanceForWeaponId(
  inv: PlayerInventoryState | undefined,
  weaponId: WeaponId
): WeaponInstanceState | null {
  if (!inv) return null;
  if (inv.equippedWeapons.primary?.weaponId === weaponId) {
    return inv.equippedWeapons.primary;
  }
  if (inv.equippedWeapons.secondary?.weaponId === weaponId) {
    return inv.equippedWeapons.secondary;
  }
  if (inv.equippedWeapons.sidearm?.weaponId === weaponId) {
    return inv.equippedWeapons.sidearm;
  }
  for (const sw of inv.storedWeapons) {
    if (sw.weaponId === weaponId) return sw;
  }
  return null;
}

/**
 * Finds a WeaponInstanceState by its unique instanceId across equipped and stored weapons.
 */
export function findWeaponInstanceById(
  inv: PlayerInventoryState | undefined,
  instanceId: string
): {
  weapon: WeaponInstanceState;
  location: 'primary' | 'secondary' | 'sidearm' | 'stored';
  storedIndex: number;
} | null {
  if (!inv || !instanceId) return null;
  if (inv.equippedWeapons.primary?.instanceId === instanceId) {
    return { weapon: inv.equippedWeapons.primary, location: 'primary', storedIndex: -1 };
  }
  if (inv.equippedWeapons.secondary?.instanceId === instanceId) {
    return { weapon: inv.equippedWeapons.secondary, location: 'secondary', storedIndex: -1 };
  }
  if (inv.equippedWeapons.sidearm?.instanceId === instanceId) {
    return { weapon: inv.equippedWeapons.sidearm, location: 'sidearm', storedIndex: -1 };
  }
  const idx = inv.storedWeapons.findIndex((w) => w.instanceId === instanceId);
  if (idx !== -1) {
    return { weapon: inv.storedWeapons[idx], location: 'stored', storedIndex: idx };
  }
  return null;
}

/**
 * Synchronizes the authoritative PlayerInventoryState with PlayerShooterState:
 * - Updates `player.loadoutWeapons` from `equippedWeapons.primary` and `equippedWeapons.secondary`.
 * - Ensures `player.activeWeapon` is one of the equipped weapons (switching cleanly if needed).
 * - Syncs each weapon's Optic attachment with `player.weaponOptics` and `player.adsState`.
 * - Integrates magazine attachment capacity changes without silently refilling magazines (if an extended mag is removed and current mag > base magSize, excess rounds return to reserve).
 * - Updates `player.armorHp` / `player.maxArmorHp` from equipped Helmet & Armor.
 */
export function syncInventoryToPlayerState(player: PlayerShooterState): void {
  const inv = player.inventory;
  if (!inv) return;

  const primaryWep = inv.equippedWeapons.primary.weaponId;
  const secondaryWep = inv.equippedWeapons.secondary.weaponId;

  player.loadoutWeapons = [primaryWep, secondaryWep];

  // If the currently held weapon was moved to storage or swapped out, switch to the new slot weapon
  const validEquipped: WeaponId[] = [primaryWep, secondaryWep];
  if (inv.equippedWeapons.sidearm) {
    validEquipped.push(inv.equippedWeapons.sidearm.weaponId);
  }
  if (!validEquipped.includes(player.activeWeapon)) {
    player.previousWeapon = player.activeWeapon;
    player.activeWeapon = primaryWep;
    player.isReloading = false;
    player.reloadTimerMs = 0;
    player.isAds = false;
    player.adsBlend = 0;
    if (player.adsState) {
      cancelADSController(player.adsState, true);
    }
  }

  // Sync optics and magazine capacity across all weapon instances
  const allWeaponInstances: WeaponInstanceState[] = [
    ...inv.storedWeapons,
    ...(inv.equippedWeapons.sidearm ? [inv.equippedWeapons.sidearm] : []),
    inv.equippedWeapons.secondary,
    inv.equippedWeapons.primary, // Equipped primary/secondary take precedence
  ];

  for (const wInst of allWeaponInstances) {
    const opticId = resolveOpticIdFromAttachments(wInst.attachments);
    player.weaponOptics[wInst.weaponId] = opticId;

    const effStats = computeEffectiveWeaponStats(wInst.weaponId, wInst.attachments);
    const ammo = player.weapons[wInst.weaponId];
    if (ammo && ammo.mag > effStats.magSize) {
      // Return excess chambered rounds to reserve when removing an extended magazine
      const excess = ammo.mag - effStats.magSize;
      ammo.mag = effStats.magSize;
      ammo.reserve = Math.min(effStats.reserveMax + excess, ammo.reserve + excess);
    }
  }

  if (player.adsState) {
    player.adsState.activeWeaponId = player.activeWeapon;
    player.adsState.activeOpticId = resolveEquippedOptic(
      player.activeWeapon,
      player.weaponOptics
    );
  }

  // Sync Backpack capacity from equipped backpack tier
  if (inv.equippedGear.backpack) {
    const bpDef = getItemDefinition(inv.equippedGear.backpack.itemId);
    if (bpDef?.backpackSlots) {
      inv.maxSlots = bpDef.backpackSlots;
      while (inv.slots.length < inv.maxSlots) {
        inv.slots.push(null);
      }
    }
    if (bpDef?.backpackMaxWeightKg) {
      inv.maxWeightKg = bpDef.backpackMaxWeightKg;
    }
  }

  // Sync Armor HP ceiling from equipped armor + helmet
  let maxArmor = 0;
  if (inv.equippedGear.armor) {
    const armorDef = getItemDefinition(inv.equippedGear.armor.itemId);
    maxArmor += armorDef?.armorRating ?? 0;
  }
  if (inv.equippedGear.helmet) {
    const helmetDef = getItemDefinition(inv.equippedGear.helmet.itemId);
    maxArmor += helmetDef?.armorRating ?? 0;
  }
  inv.maxArmorHp = maxArmor;
  if (inv.armorHp > inv.maxArmorHp) {
    inv.armorHp = inv.maxArmorHp;
  }
}

/**
 * Synchronizes an external Optic change (e.g. from the quick HUD Optic Selector bar or O shortcut)
 * back into the active weapon's attachment slot in `player.inventory` so both systems share a single source of truth.
 */
export function syncExternalOpticSelectionToInventory(
  player: PlayerShooterState,
  weaponId: WeaponId,
  opticId: string
): void {
  const inv = player.inventory;
  if (!inv) return;
  const wInst = findWeaponInstanceForWeaponId(inv, weaponId);
  if (!wInst) return;

  if (!opticId || opticId === 'none') {
    delete wInst.attachments.optic;
  } else {
    const attId = opticIdToAttachmentItemId(opticId as any);
    if (attId) {
      wInst.attachments.optic = attId;
    }
  }
}
