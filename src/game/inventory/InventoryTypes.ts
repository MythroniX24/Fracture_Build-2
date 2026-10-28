import type { WeaponId } from '../config.ts';
import type { OpticId } from '../ads/ads.types.ts';

export const INVENTORY_SCHEMA_VERSION = 1;

export type ItemCategory =
  | 'weapon'
  | 'attachment'
  | 'ammo'
  | 'healing'
  | 'armor'
  | 'throwable'
  | 'tactical'
  | 'consumable'
  | 'misc';

export type ItemRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary';

export type AttachmentSlotType =
  | 'optic'
  | 'muzzle'
  | 'magazine'
  | 'underbarrel'
  | 'stock';

export const ATTACHMENT_SLOT_ORDER: AttachmentSlotType[] = [
  'optic',
  'muzzle',
  'magazine',
  'underbarrel',
  'stock',
];

export type EquippedWeaponSlotId = 'primary' | 'secondary' | 'sidearm';

export type EquippedGearSlotId = 'helmet' | 'armor' | 'backpack';

export type AmmoCaliberId =
  | 'ammo_556'
  | 'ammo_762'
  | 'ammo_9mm'
  | 'ammo_12g'
  | 'ammo_338'
  | 'ammo_50ae';

export type WeaponFireMode = 'auto' | 'semi';

export interface WeaponStatModifiers {
  damageMultiplier?: number;
  rpmMultiplier?: number;
  magSizeDelta?: number;
  reloadTimeMultiplier?: number;
  hipSpreadMultiplier?: number;
  adsSpreadMultiplier?: number;
  recoilPitchMultiplier?: number;
  recoilYawMultiplier?: number;
  maxRangeMultiplier?: number;
  moveSpeedMultiplierDelta?: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  weightKg: number;
  maxStack: number;
  equippable: boolean;
  iconKey: string;
  /** Present when category === 'weapon' */
  weaponId?: WeaponId;
  /** Ammo item ID used by this weapon */
  ammoType?: AmmoCaliberId;
  /** Present when category === 'attachment' */
  attachmentSlot?: AttachmentSlotType;
  /** Maps optic attachment directly to the Universal ADS OpticId */
  opticId?: OpticId;
  /** Compatible WeaponIds for attachments */
  compatibleWeapons?: WeaponId[];
  /** Gameplay stat modifiers applied when this attachment is installed */
  statModifiers?: WeaponStatModifiers;
  /** Present when category === 'armor' */
  gearSlot?: EquippedGearSlotId;
  armorRating?: number;
  damageReductionPct?: number;
  backpackSlots?: number;
  backpackMaxWeightKg?: number;
  /** Present when category === 'healing' or 'consumable' */
  healHp?: number;
  restoreStamina?: number;
  repairArmor?: number;
}

export type WeaponAttachmentMap = Partial<Record<AttachmentSlotType, string>>;

export interface WeaponInstanceState {
  instanceId: string;
  weaponId: WeaponId;
  attachments: WeaponAttachmentMap;
  fireMode: WeaponFireMode;
}

export interface InventoryItemInstance {
  instanceId: string;
  itemId: string;
  quantity: number;
  weaponState?: WeaponInstanceState;
}

export interface EquippedGearState {
  helmet: InventoryItemInstance | null;
  armor: InventoryItemInstance | null;
  backpack: InventoryItemInstance | null;
}

export interface EquippedWeaponsState {
  primary: WeaponInstanceState;
  secondary: WeaponInstanceState;
  sidearm: WeaponInstanceState | null;
}

export interface PlayerInventoryState {
  schemaVersion: number;
  equippedWeapons: EquippedWeaponsState;
  /** Additional weapons stored inside the tactical backpack weapon rack */
  storedWeapons: WeaponInstanceState[];
  equippedGear: EquippedGearState;
  armorHp: number;
  maxArmorHp: number;
  /** Fixed-length array of backpack grid slots (length === maxSlots) */
  slots: (InventoryItemInstance | null)[];
  maxSlots: number;
  maxWeightKg: number;
  /** Currently inspected weapon instance ID in the UI */
  inspectedWeaponInstanceId: string | null;
  /** Currently selected backpack item instance ID in the UI */
  selectedItemInstanceId: string | null;
  lastError: string | null;
  lastNotice: string | null;
  nextInstanceSeq: number;
}

export interface WorldLootItem {
  lootId: string;
  x: number;
  y: number;
  z: number;
  item: InventoryItemInstance;
  label: string;
}

export type InventorySortField =
  | 'category'
  | 'name'
  | 'quantity'
  | 'weight'
  | 'rarity';

export type InventoryDragSource =
  | { kind: 'backpack_slot'; slotIndex: number; instanceId: string; itemId: string }
  | { kind: 'stored_weapon'; weaponInstanceId: string; weaponId: WeaponId }
  | { kind: 'equipped_weapon'; weaponSlot: EquippedWeaponSlotId; weaponInstanceId: string; weaponId: WeaponId }
  | {
      kind: 'installed_attachment';
      weaponInstanceId: string;
      attachmentSlot: AttachmentSlotType;
      itemId: string;
    }
  | { kind: 'world_loot'; lootId: string; itemId: string };

export type InventoryDropTarget =
  | { kind: 'backpack_slot'; slotIndex: number }
  | { kind: 'weapon_slot'; weaponSlot: EquippedWeaponSlotId }
  | { kind: 'weapon_storage' }
  | {
      kind: 'attachment_slot';
      weaponInstanceId: string;
      attachmentSlot: AttachmentSlotType;
    }
  | { kind: 'gear_slot'; gearSlot: EquippedGearSlotId }
  | { kind: 'drop_world' };

export interface InventoryOperationResult {
  ok: boolean;
  code:
    | 'OK'
    | 'INVALID_ITEM'
    | 'INVALID_SLOT'
    | 'INCOMPATIBLE_ATTACHMENT'
    | 'INCOMPATIBLE_WEAPON_SLOT'
    | 'CAPACITY_FULL_SLOTS'
    | 'CAPACITY_FULL_WEIGHT'
    | 'INSUFFICIENT_QUANTITY'
    | 'LAST_WEAPON_GUARD'
    | 'NO_SPACE_FOR_REMOVED_ITEM'
    | 'NOT_FOUND';
  message: string;
}

export interface EffectiveWeaponStats {
  weaponId: WeaponId;
  damage: number;
  headshotMultiplier: number;
  rpm: number;
  fireIntervalMs: number;
  magSize: number;
  reserveMax: number;
  reloadTimeMs: number;
  pellets: number;
  hipSpreadDeg: number;
  adsSpreadDeg: number;
  recoilPitchDeg: number;
  recoilYawDeg: number;
  maxRange: number;
  moveSpeedMultiplier: number;
  opticId: OpticId;
}
