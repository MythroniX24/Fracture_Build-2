import { WEAPON_REGISTRY } from '../config.ts';
import { isAttachmentCompatibleWithWeapon } from './AttachmentInventoryAdapter.ts';
import { createInitialPlayerInventory } from './InventoryController.ts';
import { getItemDefinition } from './ItemRegistry.ts';
import {
  INVENTORY_SCHEMA_VERSION,
  type InventoryItemInstance,
  type PlayerInventoryState,
  type WeaponAttachmentMap,
  type WeaponInstanceState,
} from './InventoryTypes.ts';

export const INVENTORY_STORAGE_KEY = 'fracture_tactical_inventory_v1';

export interface SerializedInventoryPayload {
  schemaVersion: number;
  savedAt: number;
  state: PlayerInventoryState;
}

function sanitizeWeaponInstance(raw: unknown): WeaponInstanceState | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const weaponId = obj.weaponId as string;
  if (!weaponId || !(weaponId in WEAPON_REGISTRY)) return null;

  const wId = weaponId as keyof typeof WEAPON_REGISTRY;
  const rawAtts = (obj.attachments || {}) as Record<string, unknown>;
  const cleanAtts: WeaponAttachmentMap = {};

  for (const [slot, itemId] of Object.entries(rawAtts)) {
    if (typeof itemId === 'string') {
      const check = isAttachmentCompatibleWithWeapon(itemId, wId, slot as any);
      if (check.compatible) {
        cleanAtts[slot as keyof WeaponAttachmentMap] = itemId;
      }
    }
  }

  return {
    instanceId:
      typeof obj.instanceId === 'string' && obj.instanceId.length > 0
        ? obj.instanceId
        : `wpn_restored_${wId}_${Math.random().toString(36).slice(2, 7)}`,
    weaponId: wId,
    attachments: cleanAtts,
    fireMode: obj.fireMode === 'semi' ? 'semi' : 'auto',
  };
}

function sanitizeItemInstance(raw: unknown): InventoryItemInstance | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.itemId !== 'string') return null;
  const def = getItemDefinition(obj.itemId);
  if (!def) return null;

  const qty =
    typeof obj.quantity === 'number' && Number.isFinite(obj.quantity)
      ? Math.max(1, Math.min(def.maxStack, Math.floor(obj.quantity)))
      : 1;

  return {
    instanceId:
      typeof obj.instanceId === 'string' && obj.instanceId.length > 0
        ? obj.instanceId
        : `itm_restored_${def.id}_${Math.random().toString(36).slice(2, 7)}`,
    itemId: def.id,
    quantity: qty,
    weaponState: obj.weaponState
      ? sanitizeWeaponInstance(obj.weaponState) || undefined
      : undefined,
  };
}

/**
 * Serializes a PlayerInventoryState into a versioned JSON string suitable for localStorage or server sync.
 */
export function serializeInventoryState(state: PlayerInventoryState): string {
  const payload: SerializedInventoryPayload = {
    schemaVersion: INVENTORY_SCHEMA_VERSION,
    savedAt: Date.now(),
    state: {
      ...state,
      schemaVersion: INVENTORY_SCHEMA_VERSION,
      lastError: null,
      lastNotice: null,
    },
  };
  return JSON.stringify(payload);
}

/**
 * Deserializes and validates a JSON string back into a safe PlayerInventoryState.
 * Returns null if the JSON is invalid or schema version is unsupported.
 */
export function deserializeInventoryState(rawJson: string): PlayerInventoryState | null {
  try {
    const parsed = JSON.parse(rawJson) as Partial<SerializedInventoryPayload>;
    if (
      !parsed ||
      parsed.schemaVersion !== INVENTORY_SCHEMA_VERSION ||
      !parsed.state
    ) {
      return null;
    }

    const s = parsed.state;
    const fallback = createInitialPlayerInventory();

    const primary =
      sanitizeWeaponInstance(s.equippedWeapons?.primary) ||
      fallback.equippedWeapons.primary;
    const secondary =
      sanitizeWeaponInstance(s.equippedWeapons?.secondary) ||
      fallback.equippedWeapons.secondary;
    const sidearm = s.equippedWeapons?.sidearm
      ? sanitizeWeaponInstance(s.equippedWeapons.sidearm)
      : null;

    const storedWeapons: WeaponInstanceState[] = [];
    if (Array.isArray(s.storedWeapons)) {
      for (const sw of s.storedWeapons) {
        const clean = sanitizeWeaponInstance(sw);
        if (clean) storedWeapons.push(clean);
      }
    }

    const maxSlots =
      typeof s.maxSlots === 'number' && s.maxSlots >= 8 && s.maxSlots <= 64
        ? Math.floor(s.maxSlots)
        : fallback.maxSlots;
    const maxWeightKg =
      typeof s.maxWeightKg === 'number' && s.maxWeightKg >= 15 && s.maxWeightKg <= 120
        ? s.maxWeightKg
        : fallback.maxWeightKg;

    const slots: (InventoryItemInstance | null)[] = Array.from(
      { length: maxSlots },
      (_, idx) => (Array.isArray(s.slots) ? sanitizeItemInstance(s.slots[idx]) : null)
    );

    return {
      schemaVersion: INVENTORY_SCHEMA_VERSION,
      equippedWeapons: {
        primary,
        secondary,
        sidearm,
      },
      storedWeapons,
      equippedGear: {
        helmet: sanitizeItemInstance(s.equippedGear?.helmet),
        armor: sanitizeItemInstance(s.equippedGear?.armor),
        backpack:
          sanitizeItemInstance(s.equippedGear?.backpack) ||
          fallback.equippedGear.backpack,
      },
      armorHp:
        typeof s.armorHp === 'number' && s.armorHp >= 0 ? s.armorHp : fallback.armorHp,
      maxArmorHp:
        typeof s.maxArmorHp === 'number' && s.maxArmorHp >= 0
          ? s.maxArmorHp
          : fallback.maxArmorHp,
      slots,
      maxSlots,
      maxWeightKg,
      inspectedWeaponInstanceId: primary.instanceId,
      selectedItemInstanceId: slots.find((sl) => sl !== null)?.instanceId ?? null,
      lastError: null,
      lastNotice: null,
      nextInstanceSeq:
        typeof s.nextInstanceSeq === 'number' && s.nextInstanceSeq > 100
          ? s.nextInstanceSeq
          : 500,
    };
  } catch {
    return null;
  }
}

export function saveInventoryToLocalStorage(state: PlayerInventoryState): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(INVENTORY_STORAGE_KEY, serializeInventoryState(state));
    return true;
  } catch {
    return false;
  }
}

export function loadInventoryFromLocalStorage(): PlayerInventoryState | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (!raw) return null;
    return deserializeInventoryState(raw);
  } catch {
    return null;
  }
}
