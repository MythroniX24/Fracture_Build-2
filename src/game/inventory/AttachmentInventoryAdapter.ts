import type { WeaponId } from '../config.ts';
import type { OpticId } from '../ads/ads.types.ts';
import { isOpticCompatibleWithWeapon } from '../ads/ScopeAttachmentSystem.ts';
import {
  getItemDefinition,
  getOpticAttachmentItemId,
  ITEM_REGISTRY,
} from './ItemRegistry.ts';
import type {
  AttachmentSlotType,
  ItemDefinition,
  WeaponAttachmentMap,
} from './InventoryTypes.ts';

/**
 * Checks whether an attachment item ID is compatible with the specified weapon ID
 * and optionally a target attachment slot.
 */
export function isAttachmentCompatibleWithWeapon(
  attachmentItemId: string,
  weaponId: WeaponId,
  targetSlot?: AttachmentSlotType
): { compatible: boolean; reason?: string } {
  const def = getItemDefinition(attachmentItemId);
  if (!def || def.category !== 'attachment' || !def.attachmentSlot) {
    return { compatible: false, reason: 'Item is not a weapon attachment.' };
  }

  if (targetSlot && def.attachmentSlot !== targetSlot) {
    return {
      compatible: false,
      reason: `${def.name} belongs in the ${def.attachmentSlot.toUpperCase()} slot, not ${targetSlot.toUpperCase()}.`,
    };
  }

  if (def.compatibleWeapons && !def.compatibleWeapons.includes(weaponId)) {
    return {
      compatible: false,
      reason: `${def.name} is not compatible with ${weaponId.toUpperCase()}.`,
    };
  }

  if (def.attachmentSlot === 'optic' && def.opticId) {
    if (!isOpticCompatibleWithWeapon(weaponId, def.opticId)) {
      return {
        compatible: false,
        reason: `${def.name} cannot be mounted on ${weaponId.toUpperCase()}.`,
      };
    }
  }

  return { compatible: true };
}

/**
 * Resolves the Universal ADS OpticId for a weapon given its installed attachments map.
 * Returns 'none' (Iron Sights) when no optic attachment is installed.
 */
export function resolveOpticIdFromAttachments(
  attachments: WeaponAttachmentMap | undefined
): OpticId {
  if (!attachments || !attachments.optic) {
    return 'none';
  }
  const def = getItemDefinition(attachments.optic);
  if (def && def.attachmentSlot === 'optic' && def.opticId) {
    return def.opticId;
  }
  return 'none';
}

/**
 * Converts a Universal ADS OpticId (e.g. 'scope_2x', 'scope_4x', 'none') to its corresponding
 * attachment item ID in ITEM_REGISTRY, or undefined for 'none'.
 */
export function opticIdToAttachmentItemId(opticId: OpticId): string | undefined {
  const mapped = getOpticAttachmentItemId(opticId);
  return mapped || undefined;
}

/**
 * Lists all attachment definitions in ITEM_REGISTRY that are compatible with a given weapon and slot.
 */
export function getCompatibleAttachmentsForWeaponSlot(
  weaponId: WeaponId,
  slot: AttachmentSlotType
): ItemDefinition[] {
  return Object.values(ITEM_REGISTRY).filter(
    (def) =>
      def.category === 'attachment' &&
      def.attachmentSlot === slot &&
      isAttachmentCompatibleWithWeapon(def.id, weaponId, slot).compatible
  );
}
