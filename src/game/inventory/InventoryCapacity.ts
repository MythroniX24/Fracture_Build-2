import {
  getItemDefinition,
  getWeaponItemDefinition,
} from './ItemRegistry.ts';
import type {
  InventoryItemInstance,
  PlayerInventoryState,
  WeaponInstanceState,
} from './InventoryTypes.ts';

export const DEFAULT_BACKPACK_SLOTS = 24;
export const DEFAULT_BACKPACK_MAX_WEIGHT_KG = 45.0;
export const MAX_STORED_WEAPONS = 6;

/**
 * Computes the total weight (in kg) of a single WeaponInstanceState including its installed attachments.
 */
export function computeWeaponInstanceWeightKg(weapon: WeaponInstanceState): number {
  const baseDef = getWeaponItemDefinition(weapon.weaponId);
  let total = baseDef ? baseDef.weightKg : 3.0;
  for (const attItemId of Object.values(weapon.attachments)) {
    if (!attItemId) continue;
    const attDef = getItemDefinition(attItemId);
    if (attDef) {
      total += attDef.weightKg;
    }
  }
  return Math.round(total * 100) / 100;
}

/**
 * Computes the total weight (in kg) of an InventoryItemInstance stack.
 */
export function computeItemInstanceWeightKg(item: InventoryItemInstance | null): number {
  if (!item || item.quantity <= 0) return 0;
  if (item.weaponState) {
    return computeWeaponInstanceWeightKg(item.weaponState);
  }
  const def = getItemDefinition(item.itemId);
  if (!def) return 0;
  return Math.round(def.weightKg * item.quantity * 100) / 100;
}

export interface InventoryCapacitySummary {
  usedSlots: number;
  maxSlots: number;
  freeSlots: number;
  storedWeaponCount: number;
  maxStoredWeapons: number;
  currentWeightKg: number;
  maxWeightKg: number;
  remainingWeightKg: number;
  weightRatio: number;
  slotRatio: number;
  isOverweight: boolean;
  isSlotsFull: boolean;
}

/**
 * Computes the complete slot and weight capacity summary for the player's inventory.
 */
export function computeInventoryCapacity(
  inv: PlayerInventoryState
): InventoryCapacitySummary {
  let usedSlots = 0;
  let totalWeight = 0;

  // Equipped weapons contribute to total carried weight
  if (inv.equippedWeapons.primary) {
    totalWeight += computeWeaponInstanceWeightKg(inv.equippedWeapons.primary);
  }
  if (inv.equippedWeapons.secondary) {
    totalWeight += computeWeaponInstanceWeightKg(inv.equippedWeapons.secondary);
  }
  if (inv.equippedWeapons.sidearm) {
    totalWeight += computeWeaponInstanceWeightKg(inv.equippedWeapons.sidearm);
  }

  // Stored weapons in the backpack weapon rack contribute to weight
  for (const sw of inv.storedWeapons) {
    totalWeight += computeWeaponInstanceWeightKg(sw);
  }

  // Equipped helmet/armor contribute to carried weight
  if (inv.equippedGear.helmet) {
    totalWeight += computeItemInstanceWeightKg(inv.equippedGear.helmet);
  }
  if (inv.equippedGear.armor) {
    totalWeight += computeItemInstanceWeightKg(inv.equippedGear.armor);
  }

  // Backpack slots
  const maxSlots = Math.max(1, inv.maxSlots || DEFAULT_BACKPACK_SLOTS);
  for (let i = 0; i < maxSlots; i++) {
    const slot = inv.slots[i];
    if (slot && slot.quantity > 0) {
      usedSlots += 1;
      totalWeight += computeItemInstanceWeightKg(slot);
    }
  }

  const maxWeightKg = Math.max(10, inv.maxWeightKg || DEFAULT_BACKPACK_MAX_WEIGHT_KG);
  const currentWeightKg = Math.round(totalWeight * 100) / 100;
  const remainingWeightKg = Math.max(
    0,
    Math.round((maxWeightKg - currentWeightKg) * 100) / 100
  );
  const freeSlots = Math.max(0, maxSlots - usedSlots);

  return {
    usedSlots,
    maxSlots,
    freeSlots,
    storedWeaponCount: inv.storedWeapons.length,
    maxStoredWeapons: MAX_STORED_WEAPONS,
    currentWeightKg,
    maxWeightKg,
    remainingWeightKg,
    weightRatio: Math.min(1, currentWeightKg / maxWeightKg),
    slotRatio: Math.min(1, usedSlots / maxSlots),
    isOverweight: currentWeightKg > maxWeightKg + 0.001,
    isSlotsFull: freeSlots === 0,
  };
}

/**
 * Checks whether adding `quantity` of `itemId` can fit in `inv` (either by merging into partial stacks or occupying empty slots)
 * and without exceeding `maxWeightKg`.
 */
export function canFitItemInBackpack(
  inv: PlayerInventoryState,
  itemId: string,
  quantity: number,
  extraWeightOverrideKg?: number
): { ok: boolean; reason?: 'CAPACITY_FULL_SLOTS' | 'CAPACITY_FULL_WEIGHT'; message?: string } {
  const def = getItemDefinition(itemId);
  if (!def || quantity <= 0) {
    return { ok: false, reason: 'CAPACITY_FULL_SLOTS', message: 'Invalid item.' };
  }

  const cap = computeInventoryCapacity(inv);
  const addedWeight =
    extraWeightOverrideKg !== undefined
      ? extraWeightOverrideKg
      : def.weightKg * quantity;

  if (cap.currentWeightKg + addedWeight > cap.maxWeightKg + 0.001) {
    return {
      ok: false,
      reason: 'CAPACITY_FULL_WEIGHT',
      message: `Exceeds max carry weight (${cap.currentWeightKg.toFixed(1)} + ${addedWeight.toFixed(1)} > ${cap.maxWeightKg.toFixed(1)} kg).`,
    };
  }

  // Count how many items can merge into existing partial stacks of the same itemId
  let remainingToPlace = quantity;
  if (def.maxStack > 1) {
    for (let i = 0; i < cap.maxSlots; i++) {
      const slot = inv.slots[i];
      if (slot && slot.itemId === itemId && slot.quantity < def.maxStack) {
        const spaceInStack = def.maxStack - slot.quantity;
        remainingToPlace -= spaceInStack;
        if (remainingToPlace <= 0) {
          return { ok: true };
        }
      }
    }
  }

  // Remaining items require empty slots
  const emptySlotsNeeded = Math.ceil(remainingToPlace / Math.max(1, def.maxStack));
  if (emptySlotsNeeded > cap.freeSlots) {
    return {
      ok: false,
      reason: 'CAPACITY_FULL_SLOTS',
      message: `Backpack is full (${cap.usedSlots}/${cap.maxSlots} slots used).`,
    };
  }

  return { ok: true };
}
