import { WEAPON_ORDER, WEAPON_REGISTRY, type WeaponId } from '../config.ts';
import type { OpticId, WeaponOpticLoadout } from '../ads/ads.types.ts';
import { DEFAULT_WEAPON_OPTICS } from '../ads/optic.config.ts';
import type { PlayerShooterState, SimulationState } from '../rules.ts';
import {
  isAttachmentCompatibleWithWeapon,
  opticIdToAttachmentItemId,
} from './AttachmentInventoryAdapter.ts';
import {
  canFitItemInBackpack,
  computeInventoryCapacity,
  computeWeaponInstanceWeightKg,
  DEFAULT_BACKPACK_MAX_WEIGHT_KG,
  DEFAULT_BACKPACK_SLOTS,
  MAX_STORED_WEAPONS,
} from './InventoryCapacity.ts';
import {
  getItemDefinition,
  WEAPON_AMMO_MAP,
  WEAPON_ITEM_ID_MAP,
} from './ItemRegistry.ts';
import type {
  AttachmentSlotType,
  EquippedGearSlotId,
  EquippedWeaponSlotId,
  InventoryDragSource,
  InventoryDropTarget,
  InventoryItemInstance,
  InventoryOperationResult,
  PlayerInventoryState,
  WeaponAttachmentMap,
  WeaponInstanceState,
  WorldLootItem,
} from './InventoryTypes.ts';
import { INVENTORY_SCHEMA_VERSION } from './InventoryTypes.ts';
import {
  findWeaponInstanceById,
  syncInventoryToPlayerState,
} from './WeaponInventoryAdapter.ts';

function nextInstanceId(inv: PlayerInventoryState, prefix: string): string {
  inv.nextInstanceSeq = (inv.nextInstanceSeq || 1) + 1;
  return `${prefix}_${inv.nextInstanceSeq}`;
}

function createWeaponInstance(
  seqRef: { seq: number },
  weaponId: WeaponId,
  opticId?: OpticId,
  extraAttachments?: WeaponAttachmentMap
): WeaponInstanceState {
  seqRef.seq += 1;
  const spec = WEAPON_REGISTRY[weaponId] || WEAPON_REGISTRY.m4a1;
  const attachments: WeaponAttachmentMap = { ...(extraAttachments || {}) };
  if (opticId && opticId !== 'none') {
    const attId = opticIdToAttachmentItemId(opticId);
    if (attId) {
      attachments.optic = attId;
    }
  }
  return {
    instanceId: `wpn_inst_${seqRef.seq}_${weaponId}`,
    weaponId,
    attachments,
    fireMode: spec.autoFire ? 'auto' : 'semi',
  };
}

/**
 * Creates a complete, deterministic initial PlayerInventoryState synchronized with
 * the player's starting loadoutWeapons and weaponOptics.
 */
export function createInitialPlayerInventory(
  loadoutWeapons: [WeaponId, WeaponId] = ['m4a1', 'awp'],
  weaponOptics: WeaponOpticLoadout = DEFAULT_WEAPON_OPTICS
): PlayerInventoryState {
  const seqRef = { seq: 100 };
  const primaryId = loadoutWeapons[0] || 'm4a1';
  const secondaryId = loadoutWeapons[1] || 'awp';

  const primaryInst = createWeaponInstance(
    seqRef,
    primaryId,
    weaponOptics[primaryId] ?? DEFAULT_WEAPON_OPTICS[primaryId],
    primaryId === 'm4a1'
      ? {
          muzzle: 'att_muzzle_suppressor',
          underbarrel: 'att_grip_vertical',
          stock: 'att_stock_tactical',
        }
      : undefined
  );
  const secondaryInst = createWeaponInstance(
    seqRef,
    secondaryId,
    weaponOptics[secondaryId] ?? DEFAULT_WEAPON_OPTICS[secondaryId]
  );

  // Sidearm slot defaults to Desert Eagle unless already in primary/secondary
  const sidearmInst =
    primaryId !== 'deagle' && secondaryId !== 'deagle'
      ? createWeaponInstance(seqRef, 'deagle', weaponOptics.deagle ?? 'none')
      : null;

  // Remaining weapons are stored in the Backpack Weapon Storage rack so all 6 weapons are accessible
  const equippedIds = new Set<WeaponId>([
    primaryId,
    secondaryId,
    ...(sidearmInst ? [sidearmInst.weaponId] : []),
  ]);
  const storedWeapons: WeaponInstanceState[] = [];
  for (const wid of WEAPON_ORDER) {
    if (!equippedIds.has(wid)) {
      storedWeapons.push(
        createWeaponInstance(
          seqRef,
          wid,
          weaponOptics[wid] ?? DEFAULT_WEAPON_OPTICS[wid]
        )
      );
    }
  }

  const slots: (InventoryItemInstance | null)[] = Array.from(
    { length: DEFAULT_BACKPACK_SLOTS },
    () => null
  );

  const seedItems: { itemId: string; quantity: number }[] = [
    // Row 1 (6 items): Medical & Grenades
    { itemId: 'med_ifak', quantity: 3 },
    { itemId: 'med_first_aid', quantity: 5 },
    { itemId: 'med_bandage', quantity: 10 },
    { itemId: 'con_energy_drink', quantity: 4 },
    { itemId: 'tac_frag_grenade', quantity: 2 },
    { itemId: 'tac_smoke_grenade', quantity: 3 },
    // Row 2 (6 items): Ammunition & Attachments
    { itemId: 'ammo_556', quantity: 120 },
    { itemId: 'ammo_762', quantity: 90 },
    { itemId: 'ammo_9mm', quantity: 60 },
    { itemId: 'att_optic_2x', quantity: 1 },
    { itemId: 'att_muzzle_suppressor', quantity: 1 },
    { itemId: 'att_grip_vertical', quantity: 1 },
    // Row 3 (Cols 1-3 attachments; Cols 4-6 render Lv.2 Gear):
    { itemId: 'att_optic_red_dot', quantity: 1 },
    { itemId: 'att_mag_ext_ar', quantity: 1 },
    { itemId: 'att_stock_tactical', quantity: 1 },
    // Row 5 (6 items): Consumables & Tactical Tools
    { itemId: 'con_canned_food', quantity: 6 },
    { itemId: 'med_painkiller', quantity: 4 },
    { itemId: 'med_morphine', quantity: 2 },
    { itemId: 'tac_grapple_hook', quantity: 1 },
    { itemId: 'tac_toolkit', quantity: 3 },
    { itemId: 'tac_detector', quantity: 1 },
    // Extra optic for 4x ACOG compatibility tests (leaving slots[22..23] empty for stack splitting/additions)
    { itemId: 'att_optic_4x', quantity: 1 },
  ];

  for (let i = 0; i < seedItems.length && i < slots.length; i++) {
    seqRef.seq += 1;
    slots[i] = {
      instanceId: `itm_${seqRef.seq}_${seedItems[i].itemId}`,
      itemId: seedItems[i].itemId,
      quantity: seedItems[i].quantity,
    };
  }

  return {
    schemaVersion: INVENTORY_SCHEMA_VERSION,
    equippedWeapons: {
      primary: primaryInst,
      secondary: secondaryInst,
      sidearm: sidearmInst,
    },
    storedWeapons,
    equippedGear: {
      helmet: {
        instanceId: 'gear_init_helmet',
        itemId: 'gear_helmet_lv2',
        quantity: 1,
      },
      armor: {
        instanceId: 'gear_init_armor',
        itemId: 'gear_armor_lv2',
        quantity: 1,
      },
      backpack: {
        instanceId: 'gear_init_backpack',
        itemId: 'gear_backpack_lv2',
        quantity: 1,
      },
    },
    armorHp: 75,
    maxArmorHp: 100,
    slots,
    maxSlots: DEFAULT_BACKPACK_SLOTS,
    maxWeightKg: DEFAULT_BACKPACK_MAX_WEIGHT_KG,
    inspectedWeaponInstanceId: primaryInst.instanceId,
    selectedItemInstanceId: slots[0]?.instanceId ?? null,
    lastError: null,
    lastNotice: null,
    nextInstanceSeq: seqRef.seq + 1,
  };
}

function recordResult(
  inv: PlayerInventoryState,
  result: InventoryOperationResult
): InventoryOperationResult {
  if (result.ok) {
    inv.lastError = null;
    inv.lastNotice = result.message;
  } else {
    inv.lastError = result.message;
  }
  return result;
}

/**
 * Adds an item (or stack of items) to the player's backpack, merging into existing partial stacks first
 * and then using empty slots. Validates both slot capacity and max weight before mutating state.
 */
export function addItemToBackpack(
  player: PlayerShooterState,
  itemId: string,
  quantity: number,
  weaponState?: WeaponInstanceState
): InventoryOperationResult {
  const inv = player.inventory;
  const def = getItemDefinition(itemId);
  if (!def || quantity <= 0 || !Number.isFinite(quantity)) {
    return recordResult(inv, {
      ok: false,
      code: 'INVALID_ITEM',
      message: 'Invalid item or quantity.',
    });
  }

  const intQty = Math.floor(quantity);

  // If adding a weapon item directly, route it to weapon storage if possible
  if (def.category === 'weapon' && def.weaponId) {
    const wState: WeaponInstanceState =
      weaponState || {
        instanceId: nextInstanceId(inv, 'wpn_inst'),
        weaponId: def.weaponId,
        attachments: {},
        fireMode: WEAPON_REGISTRY[def.weaponId].autoFire ? 'auto' : 'semi',
      };
    const wWeight = computeWeaponInstanceWeightKg(wState);
    const cap = computeInventoryCapacity(inv);
    if (cap.currentWeightKg + wWeight > cap.maxWeightKg + 0.001) {
      return recordResult(inv, {
        ok: false,
        code: 'CAPACITY_FULL_WEIGHT',
        message: `Cannot store ${def.name}: exceeds carry weight limit (${cap.maxWeightKg} kg).`,
      });
    }
    if (inv.storedWeapons.length >= MAX_STORED_WEAPONS) {
      return recordResult(inv, {
        ok: false,
        code: 'CAPACITY_FULL_SLOTS',
        message: `Weapon Storage Rack is full (${MAX_STORED_WEAPONS}/${MAX_STORED_WEAPONS} guns).`,
      });
    }
    inv.storedWeapons.push(wState);
    syncInventoryToPlayerState(player);
    return recordResult(inv, {
      ok: true,
      code: 'OK',
      message: `Stored ${def.name} in Weapon Rack.`,
    });
  }

  const fitCheck = canFitItemInBackpack(inv, itemId, intQty);
  if (!fitCheck.ok) {
    return recordResult(inv, {
      ok: false,
      code: fitCheck.reason || 'CAPACITY_FULL_SLOTS',
      message: fitCheck.message || 'Not enough space in backpack.',
    });
  }

  let remaining = intQty;

  // 1. Merge into existing partial stacks of the same itemId
  if (def.maxStack > 1) {
    for (let i = 0; i < inv.maxSlots && remaining > 0; i++) {
      const slot = inv.slots[i];
      if (slot && slot.itemId === itemId && slot.quantity < def.maxStack) {
        const addable = Math.min(remaining, def.maxStack - slot.quantity);
        slot.quantity += addable;
        remaining -= addable;
      }
    }
  }

  // 2. Place remaining into empty slots
  for (let i = 0; i < inv.maxSlots && remaining > 0; i++) {
    if (!inv.slots[i]) {
      const batch = Math.min(remaining, Math.max(1, def.maxStack));
      inv.slots[i] = {
        instanceId: nextInstanceId(inv, 'itm'),
        itemId,
        quantity: batch,
      };
      remaining -= batch;
    }
  }

  // If ammo was added, also top up active weapon reserve up to reserveMax if applicable
  if (def.category === 'ammo' && def.ammoType) {
    for (const wid of WEAPON_ORDER) {
      if (WEAPON_AMMO_MAP[wid] === def.ammoType) {
        const spec = WEAPON_REGISTRY[wid];
        player.weapons[wid].reserve = Math.min(
          spec.reserveMax,
          player.weapons[wid].reserve + intQty
        );
      }
    }
  }

  syncInventoryToPlayerState(player);
  return recordResult(inv, {
    ok: true,
    code: 'OK',
    message: `Added ${intQty}× ${def.name} to backpack.`,
  });
}

/**
 * Removes `quantity` of an item from a specific backpack slot index.
 */
export function removeItemFromBackpackSlot(
  player: PlayerShooterState,
  slotIndex: number,
  quantity?: number
): InventoryOperationResult {
  const inv = player.inventory;
  if (slotIndex < 0 || slotIndex >= inv.maxSlots) {
    return recordResult(inv, {
      ok: false,
      code: 'INVALID_SLOT',
      message: 'Invalid backpack slot index.',
    });
  }
  const slot = inv.slots[slotIndex];
  if (!slot) {
    return recordResult(inv, {
      ok: false,
      code: 'NOT_FOUND',
      message: 'Backpack slot is already empty.',
    });
  }
  const removeQty = quantity === undefined ? slot.quantity : Math.floor(quantity);
  if (removeQty <= 0 || removeQty > slot.quantity) {
    return recordResult(inv, {
      ok: false,
      code: 'INSUFFICIENT_QUANTITY',
      message: 'Invalid removal quantity.',
    });
  }

  const def = getItemDefinition(slot.itemId);
  if (removeQty === slot.quantity) {
    inv.slots[slotIndex] = null;
  } else {
    slot.quantity -= removeQty;
  }

  syncInventoryToPlayerState(player);
  return recordResult(inv, {
    ok: true,
    code: 'OK',
    message: `Removed ${removeQty}× ${def?.name || slot.itemId}.`,
  });
}

/**
 * Moves or merges or swaps items between two backpack grid slots (`fromSlot` -> `toSlot`).
 * Preserves instance IDs and never loses or duplicates items.
 */
export function moveBackpackSlotToSlot(
  player: PlayerShooterState,
  fromSlot: number,
  toSlot: number
): InventoryOperationResult {
  const inv = player.inventory;
  if (
    fromSlot < 0 ||
    fromSlot >= inv.maxSlots ||
    toSlot < 0 ||
    toSlot >= inv.maxSlots
  ) {
    return recordResult(inv, {
      ok: false,
      code: 'INVALID_SLOT',
      message: 'Slot index is out of bounds.',
    });
  }
  if (fromSlot === toSlot) {
    return { ok: true, code: 'OK', message: 'Same slot.' };
  }

  const source = inv.slots[fromSlot];
  if (!source) {
    return recordResult(inv, {
      ok: false,
      code: 'NOT_FOUND',
      message: 'Source slot is empty.',
    });
  }

  const target = inv.slots[toSlot];
  if (!target) {
    inv.slots[toSlot] = source;
    inv.slots[fromSlot] = null;
    return recordResult(inv, {
      ok: true,
      code: 'OK',
      message: `Moved ${getItemDefinition(source.itemId)?.name || source.itemId} to slot ${toSlot + 1}.`,
    });
  }

  // If both slots contain the same stackable item, merge up to maxStack
  const def = getItemDefinition(source.itemId);
  if (
    def &&
    target.itemId === source.itemId &&
    def.maxStack > 1 &&
    target.quantity < def.maxStack
  ) {
    const space = def.maxStack - target.quantity;
    const transfer = Math.min(space, source.quantity);
    target.quantity += transfer;
    source.quantity -= transfer;
    if (source.quantity <= 0) {
      inv.slots[fromSlot] = null;
    }
    return recordResult(inv, {
      ok: true,
      code: 'OK',
      message: `Merged ${transfer}× ${def.name} into stack (${target.quantity}/${def.maxStack}).`,
    });
  }

  // Otherwise swap the two slots atomically
  inv.slots[toSlot] = source;
  inv.slots[fromSlot] = target;
  return recordResult(inv, {
    ok: true,
    code: 'OK',
    message: `Swapped slot ${fromSlot + 1} with slot ${toSlot + 1}.`,
  });
}

/**
 * Splits a stack in `slotIndex` by moving `splitQuantity` into a target empty slot (or the first free slot).
 */
export function splitBackpackStack(
  player: PlayerShooterState,
  slotIndex: number,
  splitQuantity: number,
  targetEmptySlotIndex?: number
): InventoryOperationResult {
  const inv = player.inventory;
  if (slotIndex < 0 || slotIndex >= inv.maxSlots) {
    return recordResult(inv, {
      ok: false,
      code: 'INVALID_SLOT',
      message: 'Invalid backpack slot.',
    });
  }
  const source = inv.slots[slotIndex];
  if (!source) {
    return recordResult(inv, {
      ok: false,
      code: 'NOT_FOUND',
      message: 'No item stack to split.',
    });
  }

  const qty = Math.floor(splitQuantity);
  if (qty <= 0 || qty >= source.quantity) {
    return recordResult(inv, {
      ok: false,
      code: 'INSUFFICIENT_QUANTITY',
      message: `Split quantity must be between 1 and ${source.quantity - 1}.`,
    });
  }

  let destIndex = -1;
  if (
    targetEmptySlotIndex !== undefined &&
    targetEmptySlotIndex >= 0 &&
    targetEmptySlotIndex < inv.maxSlots &&
    !inv.slots[targetEmptySlotIndex]
  ) {
    destIndex = targetEmptySlotIndex;
  } else {
    destIndex = inv.slots.findIndex((s, idx) => idx < inv.maxSlots && s === null);
  }

  if (destIndex === -1) {
    return recordResult(inv, {
      ok: false,
      code: 'CAPACITY_FULL_SLOTS',
      message: 'Cannot split stack: no empty backpack slot available.',
    });
  }

  source.quantity -= qty;
  inv.slots[destIndex] = {
    instanceId: nextInstanceId(inv, 'itm'),
    itemId: source.itemId,
    quantity: qty,
  };

  const def = getItemDefinition(source.itemId);
  return recordResult(inv, {
    ok: true,
    code: 'OK',
    message: `Split ${qty}× ${def?.name || source.itemId} into slot ${destIndex + 1}.`,
  });
}

/**
 * Equips a stored weapon from `inv.storedWeapons` into `primary`, `secondary`, or `sidearm`.
 * If the target slot is occupied, swaps the previous weapon cleanly back into `storedWeapons`
 * preserving all attachments and instance IDs!
 */
export function equipWeaponFromStorage(
  player: PlayerShooterState,
  storedWeaponInstanceId: string,
  targetSlot: EquippedWeaponSlotId = 'primary'
): InventoryOperationResult {
  const inv = player.inventory;
  const storedIdx = inv.storedWeapons.findIndex(
    (w) => w.instanceId === storedWeaponInstanceId
  );
  if (storedIdx === -1) {
    return recordResult(inv, {
      ok: false,
      code: 'NOT_FOUND',
      message: 'Weapon was not found in backpack storage.',
    });
  }

  const incomingWeapon = inv.storedWeapons[storedIdx];
  if (
    targetSlot === 'sidearm' &&
    WEAPON_REGISTRY[incomingWeapon.weaponId].category !== 'Sidearm' &&
    incomingWeapon.weaponId !== 'mp5'
  ) {
    return recordResult(inv, {
      ok: false,
      code: 'INCOMPATIBLE_WEAPON_SLOT',
      message: `${WEAPON_REGISTRY[incomingWeapon.weaponId].name} is too large for the Sidearm Holster. Equip it to Primary or Secondary.`,
    });
  }

  const displacedWeapon = inv.equippedWeapons[targetSlot];
  if (displacedWeapon) {
    inv.storedWeapons[storedIdx] = displacedWeapon;
  } else {
    inv.storedWeapons.splice(storedIdx, 1);
  }

  inv.equippedWeapons[targetSlot] = incomingWeapon;
  inv.inspectedWeaponInstanceId = incomingWeapon.instanceId;

  // If equipping into the slot corresponding to the player's currently held gun (or if primary), update activeWeapon
  if (targetSlot === 'primary') {
    player.activeWeapon = incomingWeapon.weaponId;
  } else if (targetSlot === 'secondary' && displacedWeapon && player.activeWeapon === displacedWeapon.weaponId) {
    player.activeWeapon = incomingWeapon.weaponId;
  }

  syncInventoryToPlayerState(player);
  const wName = WEAPON_REGISTRY[incomingWeapon.weaponId].name;
  return recordResult(inv, {
    ok: true,
    code: 'OK',
    message: displacedWeapon
      ? `Swapped ${wName} into ${targetSlot.toUpperCase()} slot (${WEAPON_REGISTRY[displacedWeapon.weaponId].shortName} moved to storage).`
      : `Equipped ${wName} to ${targetSlot.toUpperCase()} slot.`,
  });
}

/**
 * Swaps two equipped weapon slots (e.g. Primary <-> Secondary).
 */
export function swapEquippedWeaponSlots(
  player: PlayerShooterState,
  slotA: EquippedWeaponSlotId,
  slotB: EquippedWeaponSlotId
): InventoryOperationResult {
  const inv = player.inventory;
  if (slotA === slotB) {
    return { ok: true, code: 'OK', message: 'Same weapon slot.' };
  }

  const wepA = inv.equippedWeapons[slotA];
  const wepB = inv.equippedWeapons[slotB];

  if (!wepA || !wepB) {
    return recordResult(inv, {
      ok: false,
      code: 'INVALID_SLOT',
      message: 'Both weapon slots must contain a weapon to swap.',
    });
  }

  if (
    (slotA === 'sidearm' &&
      WEAPON_REGISTRY[wepB.weaponId].category !== 'Sidearm' &&
      wepB.weaponId !== 'mp5') ||
    (slotB === 'sidearm' &&
      WEAPON_REGISTRY[wepA.weaponId].category !== 'Sidearm' &&
      wepA.weaponId !== 'mp5')
  ) {
    return recordResult(inv, {
      ok: false,
      code: 'INCOMPATIBLE_WEAPON_SLOT',
      message: 'Full-length rifles/shotguns cannot fit in the Sidearm Holster.',
    });
  }

  inv.equippedWeapons[slotA] = wepB;
  inv.equippedWeapons[slotB] = wepA;
  syncInventoryToPlayerState(player);

  return recordResult(inv, {
    ok: true,
    code: 'OK',
    message: `Swapped ${WEAPON_REGISTRY[wepA.weaponId].shortName} and ${WEAPON_REGISTRY[wepB.weaponId].shortName}.`,
  });
}

/**
 * Moves an equipped weapon into Backpack Weapon Storage.
 * Since Primary and Secondary combat slots always require an active firearm in-match,
 * moving Primary or Secondary to storage automatically promotes the first compatible stored weapon
 * (or moves the Sidearm slot to empty if sourceSlot === 'sidearm').
 */
export function moveWeaponSlotToStorage(
  player: PlayerShooterState,
  sourceSlot: EquippedWeaponSlotId
): InventoryOperationResult {
  const inv = player.inventory;
  const current = inv.equippedWeapons[sourceSlot];
  if (!current) {
    return recordResult(inv, {
      ok: false,
      code: 'NOT_FOUND',
      message: 'Weapon slot is already empty.',
    });
  }

  if (sourceSlot === 'sidearm') {
    if (inv.storedWeapons.length >= MAX_STORED_WEAPONS) {
      return recordResult(inv, {
        ok: false,
        code: 'CAPACITY_FULL_SLOTS',
        message: 'Weapon Storage Rack is full.',
      });
    }
    inv.storedWeapons.push(current);
    inv.equippedWeapons.sidearm = null;
    syncInventoryToPlayerState(player);
    return recordResult(inv, {
      ok: true,
      code: 'OK',
      message: `Stored ${WEAPON_REGISTRY[current.weaponId].name} in backpack weapon rack.`,
    });
  }

  // Primary or Secondary: swap with the first available stored weapon so the operator is never disarmed
  if (inv.storedWeapons.length === 0) {
    return recordResult(inv, {
      ok: false,
      code: 'LAST_WEAPON_GUARD',
      message: 'Cannot unequip weapon without a replacement in storage.',
    });
  }

  const replacement = inv.storedWeapons[0];
  inv.storedWeapons[0] = current;
  inv.equippedWeapons[sourceSlot] = replacement;
  if (player.activeWeapon === current.weaponId) {
    player.activeWeapon = replacement.weaponId;
  }
  syncInventoryToPlayerState(player);
  return recordResult(inv, {
    ok: true,
    code: 'OK',
    message: `Stored ${WEAPON_REGISTRY[current.weaponId].shortName} in backpack and equipped ${WEAPON_REGISTRY[replacement.weaponId].shortName}.`,
  });
}

/**
 * Equips an attachment from a backpack slot onto a target weapon instance (equipped or stored).
 * Validates compatibility, swaps any existing attachment in that category back into the backpack slot,
 * and updates Universal ADS / Magazine stats automatically.
 */
export function equipAttachmentFromBackpackSlot(
  player: PlayerShooterState,
  backpackSlotIndex: number,
  targetWeaponInstanceId: string,
  expectedAttachmentSlot?: AttachmentSlotType
): InventoryOperationResult {
  const inv = player.inventory;
  if (backpackSlotIndex < 0 || backpackSlotIndex >= inv.maxSlots) {
    return recordResult(inv, {
      ok: false,
      code: 'INVALID_SLOT',
      message: 'Invalid backpack slot.',
    });
  }

  const slotItem = inv.slots[backpackSlotIndex];
  if (!slotItem) {
    return recordResult(inv, {
      ok: false,
      code: 'NOT_FOUND',
      message: 'No attachment in the selected backpack slot.',
    });
  }

  const attDef = getItemDefinition(slotItem.itemId);
  if (!attDef || attDef.category !== 'attachment' || !attDef.attachmentSlot) {
    return recordResult(inv, {
      ok: false,
      code: 'INVALID_ITEM',
      message: `${attDef?.name || 'Item'} is not a weapon attachment.`,
    });
  }

  const found = findWeaponInstanceById(inv, targetWeaponInstanceId);
  if (!found) {
    return recordResult(inv, {
      ok: false,
      code: 'NOT_FOUND',
      message: 'Target weapon was not found.',
    });
  }

  const compat = isAttachmentCompatibleWithWeapon(
    attDef.id,
    found.weapon.weaponId,
    expectedAttachmentSlot
  );
  if (!compat.compatible) {
    return recordResult(inv, {
      ok: false,
      code: 'INCOMPATIBLE_ATTACHMENT',
      message: compat.reason || `${attDef.name} is not compatible with ${WEAPON_REGISTRY[found.weapon.weaponId].name}.`,
    });
  }

  const attSlot = attDef.attachmentSlot;
  const previousAttachmentItemId = found.weapon.attachments[attSlot];

  // If the same attachment is already installed, no-op
  if (previousAttachmentItemId === attDef.id) {
    return recordResult(inv, {
      ok: true,
      code: 'OK',
      message: `${attDef.name} is already installed on ${WEAPON_REGISTRY[found.weapon.weaponId].shortName}.`,
    });
  }

  // Install new attachment
  found.weapon.attachments[attSlot] = attDef.id;

  // Remove 1 from the source backpack slot, and place the displaced attachment (if any) back into the backpack
  if (slotItem.quantity > 1) {
    if (previousAttachmentItemId) {
      const emptyIdx = inv.slots.findIndex((s, idx) => idx < inv.maxSlots && s === null);
      if (emptyIdx === -1) {
        // Rollback
        found.weapon.attachments[attSlot] = previousAttachmentItemId;
        return recordResult(inv, {
          ok: false,
          code: 'NO_SPACE_FOR_REMOVED_ITEM',
          message: 'No free backpack slot to store the replaced attachment.',
        });
      }
      inv.slots[emptyIdx] = {
        instanceId: nextInstanceId(inv, 'itm'),
        itemId: previousAttachmentItemId,
        quantity: 1,
      };
    }
    slotItem.quantity -= 1;
  } else {
    if (previousAttachmentItemId) {
      inv.slots[backpackSlotIndex] = {
        instanceId: nextInstanceId(inv, 'itm'),
        itemId: previousAttachmentItemId,
        quantity: 1,
      };
    } else {
      inv.slots[backpackSlotIndex] = null;
    }
  }

  syncInventoryToPlayerState(player);
  const prevName = previousAttachmentItemId
    ? getItemDefinition(previousAttachmentItemId)?.shortName
    : null;

  return recordResult(inv, {
    ok: true,
    code: 'OK',
    message: prevName
      ? `Equipped ${attDef.name} on ${WEAPON_REGISTRY[found.weapon.weaponId].shortName} (swapped ${prevName} to backpack).`
      : `Equipped ${attDef.name} on ${WEAPON_REGISTRY[found.weapon.weaponId].shortName}.`,
  });
}

/**
 * Removes an installed attachment from a weapon and places it into the player's backpack.
 * Restores default Iron Sights ('none') when removing an Optic attachment.
 */
export function removeAttachmentFromWeapon(
  player: PlayerShooterState,
  weaponInstanceId: string,
  attachmentSlot: AttachmentSlotType,
  preferredBackpackSlotIndex?: number
): InventoryOperationResult {
  const inv = player.inventory;
  const found = findWeaponInstanceById(inv, weaponInstanceId);
  if (!found) {
    return recordResult(inv, {
      ok: false,
      code: 'NOT_FOUND',
      message: 'Weapon not found.',
    });
  }

  const removedItemId = found.weapon.attachments[attachmentSlot];
  if (!removedItemId) {
    return recordResult(inv, {
      ok: false,
      code: 'NOT_FOUND',
      message: `No attachment installed in ${attachmentSlot.toUpperCase()} slot.`,
    });
  }

  const attDef = getItemDefinition(removedItemId);

  // If a specific destination backpack slot was requested (e.g. via drag-and-drop)
  if (
    preferredBackpackSlotIndex !== undefined &&
    preferredBackpackSlotIndex >= 0 &&
    preferredBackpackSlotIndex < inv.maxSlots
  ) {
    const destSlot = inv.slots[preferredBackpackSlotIndex];
    if (!destSlot) {
      delete found.weapon.attachments[attachmentSlot];
      inv.slots[preferredBackpackSlotIndex] = {
        instanceId: nextInstanceId(inv, 'itm'),
        itemId: removedItemId,
        quantity: 1,
      };
      syncInventoryToPlayerState(player);
      return recordResult(inv, {
        ok: true,
        code: 'OK',
        message: `Removed ${attDef?.name || removedItemId} from ${WEAPON_REGISTRY[found.weapon.weaponId].shortName}.`,
      });
    }
    // If destination slot has another attachment for the same slot, try swapping!
    const destDef = getItemDefinition(destSlot.itemId);
    if (destDef?.category === 'attachment') {
      return equipAttachmentFromBackpackSlot(
        player,
        preferredBackpackSlotIndex,
        weaponInstanceId,
        attachmentSlot
      );
    }
  }

  // Otherwise place in first available slot
  const emptyIdx = inv.slots.findIndex((s, idx) => idx < inv.maxSlots && s === null);
  if (emptyIdx === -1) {
    return recordResult(inv, {
      ok: false,
      code: 'NO_SPACE_FOR_REMOVED_ITEM',
      message: `Cannot remove ${attDef?.name || 'attachment'}: backpack has no free slots.`,
    });
  }

  delete found.weapon.attachments[attachmentSlot];
  inv.slots[emptyIdx] = {
    instanceId: nextInstanceId(inv, 'itm'),
    itemId: removedItemId,
    quantity: 1,
  };

  syncInventoryToPlayerState(player);
  return recordResult(inv, {
    ok: true,
    code: 'OK',
    message: `Removed ${attDef?.name || removedItemId} to backpack slot ${emptyIdx + 1}.`,
  });
}

/**
 * Uses a consumable/healing item or equips an armor/helmet/backpack item from a backpack slot.
 */
export function useOrEquipBackpackSlotItem(
  player: PlayerShooterState,
  slotIndex: number
): InventoryOperationResult {
  const inv = player.inventory;
  if (slotIndex < 0 || slotIndex >= inv.maxSlots) {
    return recordResult(inv, {
      ok: false,
      code: 'INVALID_SLOT',
      message: 'Invalid backpack slot.',
    });
  }

  const slotItem = inv.slots[slotIndex];
  if (!slotItem) {
    return recordResult(inv, {
      ok: false,
      code: 'NOT_FOUND',
      message: 'Backpack slot is empty.',
    });
  }

  const def = getItemDefinition(slotItem.itemId);
  if (!def) {
    return recordResult(inv, {
      ok: false,
      code: 'INVALID_ITEM',
      message: 'Unknown item definition.',
    });
  }

  // 1. Weapon Attachment -> install on currently inspected (or active) weapon
  if (def.category === 'attachment') {
    const targetWepId =
      inv.inspectedWeaponInstanceId || inv.equippedWeapons.primary.instanceId;
    return equipAttachmentFromBackpackSlot(player, slotIndex, targetWepId);
  }

  // 2. Equippable Gear (Helmet, Armor, Backpack)
  if (def.gearSlot) {
    const gSlot: EquippedGearSlotId = def.gearSlot;
    const prevGear = inv.equippedGear[gSlot];

    // If equipping a smaller backpack, verify current items fit inside the new slot/weight limits
    if (gSlot === 'backpack' && def.backpackSlots && def.backpackMaxWeightKg) {
      // Check if any occupied slot is beyond the new slot count
      for (let i = def.backpackSlots; i < inv.slots.length; i++) {
        if (i !== slotIndex && inv.slots[i]) {
          return recordResult(inv, {
            ok: false,
            code: 'CAPACITY_FULL_SLOTS',
            message: `Cannot equip ${def.name}: move items out of slots ${def.backpackSlots + 1}–${inv.maxSlots} first.`,
          });
        }
      }
      const cap = computeInventoryCapacity(inv);
      if (cap.currentWeightKg > def.backpackMaxWeightKg + 0.001) {
        return recordResult(inv, {
          ok: false,
          code: 'CAPACITY_FULL_WEIGHT',
          message: `Cannot equip ${def.name}: current weight (${cap.currentWeightKg.toFixed(1)} kg) exceeds its ${def.backpackMaxWeightKg} kg limit.`,
        });
      }
    }

    inv.equippedGear[gSlot] = {
      instanceId: slotItem.instanceId,
      itemId: slotItem.itemId,
      quantity: 1,
    };
    inv.slots[slotIndex] = prevGear;
    syncInventoryToPlayerState(player);

    if (gSlot === 'armor' || gSlot === 'helmet') {
      inv.armorHp = Math.min(inv.maxArmorHp, inv.armorHp + (def.armorRating ?? 35));
    }

    return recordResult(inv, {
      ok: true,
      code: 'OK',
      message: `Equipped ${def.name}.`,
    });
  }

  // 3. Medical / Healing / Armor Repair Consumables
  if (def.healHp || def.restoreStamina || def.repairArmor) {
    let used = false;
    if (def.healHp) {
      player.hp = Math.min(player.maxHp, player.hp + def.healHp);
      used = true;
    }
    if (def.restoreStamina) {
      player.stamina = Math.min(player.maxStamina, player.stamina + def.restoreStamina);
      used = true;
    }
    if (def.repairArmor) {
      syncInventoryToPlayerState(player);
      inv.armorHp = Math.min(inv.maxArmorHp, inv.armorHp + def.repairArmor);
      used = true;
    }
    if (used) {
      removeItemFromBackpackSlot(player, slotIndex, 1);
      return recordResult(inv, {
        ok: true,
        code: 'OK',
        message: `Used ${def.name}.`,
      });
    }
  }

  return recordResult(inv, {
    ok: false,
    code: 'INVALID_ITEM',
    message: `${def.name} cannot be directly used from this slot.`,
  });
}

/**
 * Drops an item or stored weapon from the player's inventory into the 3D arena world (`sim.worldLoot`),
 * preserving its exact item definition, quantity, and installed weapon attachments.
 */
export function dropInventoryItemToWorld(
  sim: SimulationState,
  source:
    | { kind: 'backpack_slot'; slotIndex: number; quantity?: number }
    | { kind: 'stored_weapon'; weaponInstanceId: string }
    | {
        kind: 'installed_attachment';
        weaponInstanceId: string;
        attachmentSlot: AttachmentSlotType;
      }
): InventoryOperationResult {
  const player = sim.player;
  const inv = player.inventory;
  if (!sim.worldLoot) {
    sim.worldLoot = [];
  }

  // Drop slightly in front of the player at ground height
  const forwardX = -Math.sin(player.yaw);
  const forwardZ = -Math.cos(player.yaw);
  const jitterAngle = (sim.worldLoot.length * 1.15) % (Math.PI * 2);
  const dropX = player.x + forwardX * 1.35 + Math.cos(jitterAngle) * 0.35;
  const dropZ = player.z + forwardZ * 1.35 + Math.sin(jitterAngle) * 0.35;

  if (source.kind === 'backpack_slot') {
    const slot = inv.slots[source.slotIndex];
    if (!slot) {
      return recordResult(inv, {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Nothing in slot to drop.',
      });
    }
    const qty =
      source.quantity !== undefined
        ? Math.min(slot.quantity, Math.max(1, Math.floor(source.quantity)))
        : slot.quantity;
    const def = getItemDefinition(slot.itemId);
    const droppedInstance: InventoryItemInstance = {
      instanceId: nextInstanceId(inv, 'loot_itm'),
      itemId: slot.itemId,
      quantity: qty,
      weaponState: slot.weaponState
        ? {
            ...slot.weaponState,
            attachments: { ...slot.weaponState.attachments },
          }
        : undefined,
    };

    removeItemFromBackpackSlot(player, source.slotIndex, qty);

    sim.worldLoot.push({
      lootId: `loot_${Date.now()}_${inv.nextInstanceSeq++}`,
      x: dropX,
      y: 0,
      z: dropZ,
      item: droppedInstance,
      label: `${qty > 1 ? `${qty}× ` : ''}${def?.name || slot.itemId}`,
    });

    return recordResult(inv, {
      ok: true,
      code: 'OK',
      message: `Dropped ${qty}× ${def?.name || slot.itemId} on the ground.`,
    });
  }

  if (source.kind === 'stored_weapon') {
    const idx = inv.storedWeapons.findIndex(
      (w) => w.instanceId === source.weaponInstanceId
    );
    if (idx === -1) {
      return recordResult(inv, {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Stored weapon not found.',
      });
    }
    const wep = inv.storedWeapons[idx];
    inv.storedWeapons.splice(idx, 1);
    const itemId = WEAPON_ITEM_ID_MAP[wep.weaponId];
    const wSpec = WEAPON_REGISTRY[wep.weaponId];

    sim.worldLoot.push({
      lootId: `loot_${Date.now()}_${inv.nextInstanceSeq++}`,
      x: dropX,
      y: 0,
      z: dropZ,
      item: {
        instanceId: wep.instanceId,
        itemId,
        quantity: 1,
        weaponState: {
          ...wep,
          attachments: { ...wep.attachments },
        },
      },
      label: wSpec.name,
    });

    syncInventoryToPlayerState(player);
    return recordResult(inv, {
      ok: true,
      code: 'OK',
      message: `Dropped ${wSpec.name} into the world.`,
    });
  }

  if (source.kind === 'installed_attachment') {
    const found = findWeaponInstanceById(inv, source.weaponInstanceId);
    if (!found || !found.weapon.attachments[source.attachmentSlot]) {
      return recordResult(inv, {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Installed attachment not found.',
      });
    }
    const attItemId = found.weapon.attachments[source.attachmentSlot]!;
    delete found.weapon.attachments[source.attachmentSlot];
    const def = getItemDefinition(attItemId);

    sim.worldLoot.push({
      lootId: `loot_${Date.now()}_${inv.nextInstanceSeq++}`,
      x: dropX,
      y: 0,
      z: dropZ,
      item: {
        instanceId: nextInstanceId(inv, 'loot_att'),
        itemId: attItemId,
        quantity: 1,
      },
      label: def?.name || attItemId,
    });

    syncInventoryToPlayerState(player);
    return recordResult(inv, {
      ok: true,
      code: 'OK',
      message: `Dropped ${def?.name || attItemId} on the ground.`,
    });
  }

  return recordResult(inv, {
    ok: false,
    code: 'INVALID_ITEM',
    message: 'Invalid drop source.',
  });
}

/**
 * Picks up a `WorldLootItem` from `sim.worldLoot` into the player's inventory.
 * If the backpack or weapon rack is full or overweight, rejects the pickup and keeps the world item intact!
 */
export function pickupWorldLootItem(
  sim: SimulationState,
  lootId: string
): InventoryOperationResult {
  const player = sim.player;
  const inv = player.inventory;
  if (!sim.worldLoot) {
    return recordResult(inv, {
      ok: false,
      code: 'NOT_FOUND',
      message: 'No world loot found.',
    });
  }

  const lootIdx = sim.worldLoot.findIndex((l) => l.lootId === lootId);
  if (lootIdx === -1) {
    return recordResult(inv, {
      ok: false,
      code: 'NOT_FOUND',
      message: 'Loot item is no longer present.',
    });
  }

  const loot = sim.worldLoot[lootIdx];
  const res = addItemToBackpack(
    player,
    loot.item.itemId,
    loot.item.quantity,
    loot.item.weaponState
  );

  if (!res.ok) {
    // Reject pickup: keep the world item present!
    return res;
  }

  sim.worldLoot.splice(lootIdx, 1);
  return recordResult(inv, {
    ok: true,
    code: 'OK',
    message: `Picked up ${loot.label}.`,
  });
}

/**
 * Returns all world loot items within `radiusMeters` of the player, sorted closest first.
 */
export function getNearbyWorldLoot(
  sim: SimulationState,
  radiusMeters = 4.2
): WorldLootItem[] {
  if (!sim.worldLoot || sim.worldLoot.length === 0) return [];
  const px = sim.player.x;
  const pz = sim.player.z;
  const rSq = radiusMeters * radiusMeters;

  return sim.worldLoot
    .filter((l) => {
      const dx = l.x - px;
      const dz = l.z - pz;
      return dx * dx + dz * dz <= rSq;
    })
    .sort((a, b) => {
      const da = (a.x - px) ** 2 + (a.z - pz) ** 2;
      const db = (b.x - px) ** 2 + (b.z - pz) ** 2;
      return da - db;
    });
}

/**
 * Evaluates whether a drag source can be validly dropped onto a target without mutating state.
 * Used for real-time green (valid) vs red (invalid) slot highlighting during drag-and-drop.
 */
export function validateInventoryDropTarget(
  player: PlayerShooterState,
  source: InventoryDragSource,
  target: InventoryDropTarget
): { valid: boolean; reason?: string } {
  const inv = player.inventory;

  if (target.kind === 'drop_world') {
    if (source.kind === 'equipped_weapon') {
      return {
        valid: false,
        reason: 'Move weapon to storage before dropping it.',
      };
    }
    return { valid: true };
  }

  if (source.kind === 'backpack_slot') {
    const slotItem = inv.slots[source.slotIndex];
    if (!slotItem) return { valid: false, reason: 'Empty source slot.' };
    const def = getItemDefinition(slotItem.itemId);
    if (!def) return { valid: false, reason: 'Invalid item.' };

    if (target.kind === 'backpack_slot') {
      return { valid: true };
    }
    if (target.kind === 'attachment_slot') {
      const found = findWeaponInstanceById(inv, target.weaponInstanceId);
      if (!found) return { valid: false, reason: 'Weapon not found.' };
      const compat = isAttachmentCompatibleWithWeapon(
        def.id,
        found.weapon.weaponId,
        target.attachmentSlot
      );
      return { valid: compat.compatible, reason: compat.reason };
    }
    if (target.kind === 'gear_slot') {
      if (def.gearSlot === target.gearSlot) {
        return { valid: true };
      }
      return {
        valid: false,
        reason: `${def.name} cannot be equipped in ${target.gearSlot.toUpperCase()} slot.`,
      };
    }
    return { valid: false, reason: 'Incompatible destination slot.' };
  }

  if (source.kind === 'stored_weapon') {
    if (target.kind === 'weapon_slot') {
      if (
        target.weaponSlot === 'sidearm' &&
        WEAPON_REGISTRY[source.weaponId].category !== 'Sidearm' &&
        source.weaponId !== 'mp5'
      ) {
        return {
          valid: false,
          reason: 'Only Sidearms/SMGs fit in the Sidearm Holster.',
        };
      }
      return { valid: true };
    }
    return { valid: false, reason: 'Drag stored weapons to a Weapon Slot or Drop Zone.' };
  }

  if (source.kind === 'equipped_weapon') {
    if (target.kind === 'weapon_slot') {
      if (target.weaponSlot === source.weaponSlot) return { valid: true };
      if (
        target.weaponSlot === 'sidearm' &&
        WEAPON_REGISTRY[source.weaponId].category !== 'Sidearm' &&
        source.weaponId !== 'mp5'
      ) {
        return { valid: false, reason: 'Too large for Sidearm Holster.' };
      }
      return { valid: true };
    }
    if (target.kind === 'weapon_storage') {
      if (source.weaponSlot !== 'sidearm' && inv.storedWeapons.length === 0) {
        return { valid: false, reason: 'No replacement weapon in storage.' };
      }
      return { valid: true };
    }
    return { valid: false };
  }

  if (source.kind === 'installed_attachment') {
    if (target.kind === 'backpack_slot') {
      return { valid: true };
    }
    if (target.kind === 'attachment_slot') {
      const found = findWeaponInstanceById(inv, target.weaponInstanceId);
      if (!found) return { valid: false };
      const compat = isAttachmentCompatibleWithWeapon(
        source.itemId,
        found.weapon.weaponId,
        target.attachmentSlot
      );
      return { valid: compat.compatible, reason: compat.reason };
    }
    return { valid: false };
  }

  if (source.kind === 'world_loot') {
    if (target.kind === 'backpack_slot' || target.kind === 'weapon_storage') {
      return { valid: true };
    }
    return { valid: false };
  }

  return { valid: false };
}

/**
 * Executes a validated drag-and-drop operation between any inventory source and target.
 * If validation fails, preserves original item positions and state.
 */
export function executeInventoryDragDrop(
  sim: SimulationState,
  source: InventoryDragSource,
  target: InventoryDropTarget
): InventoryOperationResult {
  const player = sim.player;
  const inv = player.inventory;

  if (target.kind === 'drop_world') {
    if (source.kind === 'backpack_slot') {
      return dropInventoryItemToWorld(sim, {
        kind: 'backpack_slot',
        slotIndex: source.slotIndex,
      });
    }
    if (source.kind === 'stored_weapon') {
      return dropInventoryItemToWorld(sim, {
        kind: 'stored_weapon',
        weaponInstanceId: source.weaponInstanceId,
      });
    }
    if (source.kind === 'installed_attachment') {
      return dropInventoryItemToWorld(sim, {
        kind: 'installed_attachment',
        weaponInstanceId: source.weaponInstanceId,
        attachmentSlot: source.attachmentSlot,
      });
    }
  }

  if (source.kind === 'backpack_slot') {
    if (target.kind === 'backpack_slot') {
      return moveBackpackSlotToSlot(player, source.slotIndex, target.slotIndex);
    }
    if (target.kind === 'attachment_slot') {
      return equipAttachmentFromBackpackSlot(
        player,
        source.slotIndex,
        target.weaponInstanceId,
        target.attachmentSlot
      );
    }
    if (target.kind === 'gear_slot') {
      const slotItem = inv.slots[source.slotIndex];
      const def = slotItem ? getItemDefinition(slotItem.itemId) : null;
      if (!def || def.gearSlot !== target.gearSlot) {
        return recordResult(inv, {
          ok: false,
          code: 'INCOMPATIBLE_ATTACHMENT',
          message: `Item does not belong in ${target.gearSlot.toUpperCase()} slot.`,
        });
      }
      return useOrEquipBackpackSlotItem(player, source.slotIndex);
    }
  }

  if (source.kind === 'stored_weapon' && target.kind === 'weapon_slot') {
    return equipWeaponFromStorage(
      player,
      source.weaponInstanceId,
      target.weaponSlot
    );
  }

  if (source.kind === 'equipped_weapon') {
    if (target.kind === 'weapon_slot') {
      return swapEquippedWeaponSlots(
        player,
        source.weaponSlot,
        target.weaponSlot
      );
    }
    if (target.kind === 'weapon_storage') {
      return moveWeaponSlotToStorage(player, source.weaponSlot);
    }
  }

  if (source.kind === 'installed_attachment') {
    if (target.kind === 'backpack_slot') {
      return removeAttachmentFromWeapon(
        player,
        source.weaponInstanceId,
        source.attachmentSlot,
        target.slotIndex
      );
    }
    if (target.kind === 'attachment_slot') {
      if (source.weaponInstanceId === target.weaponInstanceId) {
        return { ok: true, code: 'OK', message: 'Already installed.' };
      }
      const srcWeapon = findWeaponInstanceById(inv, source.weaponInstanceId);
      const dstWeapon = findWeaponInstanceById(inv, target.weaponInstanceId);
      if (!srcWeapon || !dstWeapon) {
        return recordResult(inv, {
          ok: false,
          code: 'NOT_FOUND',
          message: 'Weapon not found.',
        });
      }
      const compat = isAttachmentCompatibleWithWeapon(
        source.itemId,
        dstWeapon.weapon.weaponId,
        target.attachmentSlot
      );
      if (!compat.compatible) {
        return recordResult(inv, {
          ok: false,
          code: 'INCOMPATIBLE_ATTACHMENT',
          message: compat.reason || 'Incompatible attachment for target weapon.',
        });
      }
      const displaced = dstWeapon.weapon.attachments[target.attachmentSlot];
      if (displaced) {
        const backCompat = isAttachmentCompatibleWithWeapon(
          displaced,
          srcWeapon.weapon.weaponId,
          source.attachmentSlot
        );
        if (!backCompat.compatible) {
          return recordResult(inv, {
            ok: false,
            code: 'INCOMPATIBLE_ATTACHMENT',
            message: backCompat.reason || 'Cannot swap incompatible attachments.',
          });
        }
        srcWeapon.weapon.attachments[source.attachmentSlot] = displaced;
      } else {
        delete srcWeapon.weapon.attachments[source.attachmentSlot];
      }
      dstWeapon.weapon.attachments[target.attachmentSlot] = source.itemId;
      syncInventoryToPlayerState(player);
      return recordResult(inv, {
        ok: true,
        code: 'OK',
        message: `Transferred ${getItemDefinition(source.itemId)?.name || 'attachment'} to ${WEAPON_REGISTRY[dstWeapon.weapon.weaponId].shortName}.`,
      });
    }
  }

  if (source.kind === 'world_loot') {
    return pickupWorldLootItem(sim, source.lootId);
  }

  return recordResult(inv, {
    ok: false,
    code: 'INVALID_SLOT',
    message: 'Invalid drag-and-drop destination.',
  });
}
