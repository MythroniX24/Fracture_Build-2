import React from 'react';
import {
  ATTACHMENT_SLOT_ORDER,
  type AttachmentSlotType,
  getItemDefinition,
  type InventoryDragSource,
  type InventoryDropTarget,
  isAttachmentCompatibleWithWeapon,
  type WeaponInstanceState,
} from '../../game/inventory/index.ts';
import { TacticalItemIcon } from './InventoryItemCard.tsx';

const SLOT_LABELS: Record<AttachmentSlotType, string> = {
  optic: 'Optic',
  muzzle: 'Muzzle',
  magazine: 'Magazine',
  underbarrel: 'Underbarrel',
  stock: 'Stock',
};

const DEFAULT_PREVIEW_ATTACHMENT_BY_SLOT: Record<AttachmentSlotType, string> = {
  optic: 'att_optic_2x',
  muzzle: 'att_muzzle_suppressor',
  magazine: 'att_mag_ext_ar',
  underbarrel: 'att_grip_vertical',
  stock: 'att_stock_tactical',
};

export interface AttachmentSlotsProps {
  weapon: WeaponInstanceState;
  activeDragSource: InventoryDragSource | null;
  onStartDragAttachment: (slot: AttachmentSlotType, itemId: string) => void;
  onEndDrag: () => void;
  onDropOnAttachmentSlot: (target: InventoryDropTarget) => void;
  onRemoveAttachment: (slot: AttachmentSlotType) => void;
  onQuickInstallSlot?: (slot: AttachmentSlotType) => void;
}

export const AttachmentSlots: React.FC<AttachmentSlotsProps> = ({
  weapon,
  activeDragSource,
  onStartDragAttachment,
  onEndDrag,
  onDropOnAttachmentSlot,
  onRemoveAttachment,
  onQuickInstallSlot,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between leading-none">
        <h4 className="font-display font-bold text-xs tracking-wider text-slate-100 uppercase">
          ATTACHMENTS
        </h4>
        <span className="text-[10px] text-slate-400">
          Click slot to attach / detach
        </span>
      </div>

      {/* 3-Column Grid: Top row (Optic, Muzzle, Magazine) + Bottom row (Underbarrel, Stock) */}
      <div className="grid grid-cols-3 gap-2">
        {ATTACHMENT_SLOT_ORDER.map((slot) => {
          const installedItemId = weapon.attachments[slot];
          const installedDef = installedItemId
            ? getItemDefinition(installedItemId)
            : null;
          const fallbackDef = getItemDefinition(
            DEFAULT_PREVIEW_ATTACHMENT_BY_SLOT[slot]
          );
          const displayDef = installedDef || fallbackDef;

          let dragStatus: 'valid' | 'invalid' | null = null;
          if (activeDragSource) {
            if (
              activeDragSource.kind === 'backpack_slot' ||
              activeDragSource.kind === 'installed_attachment'
            ) {
              const check = isAttachmentCompatibleWithWeapon(
                activeDragSource.itemId,
                weapon.weaponId,
                slot
              );
              dragStatus = check.compatible ? 'valid' : 'invalid';
            }
          }

          const isPurple = slot === 'optic';
          const borderClass =
            dragStatus === 'valid'
              ? 'border-emerald-400 bg-emerald-500/20'
              : dragStatus === 'invalid'
                ? 'border-rose-500/80 bg-rose-500/15 opacity-75'
                : installedDef
                  ? isPurple
                    ? 'border-[#8b5cf6]/85 bg-[#0c121b]/40 shadow-[inset_0_0_14px_rgba(139,92,246,0.22)] hover:border-[#a78bfa]'
                    : 'border-[#0ea5e9]/85 bg-[#0c121b]/40 shadow-[inset_0_0_14px_rgba(14,165,233,0.22)] hover:border-[#38bdf8]'
                  : 'border-white/15 border-dashed bg-[#090d14]/35 hover:border-[#38bdf8] opacity-80 hover:opacity-100';

          return (
            <div
              key={slot}
              role="button"
              tabIndex={0}
              data-testid={`weapon-attachment-slot-${slot}`}
              data-installed-item={installedItemId || 'none'}
              title={
                installedDef
                  ? `${installedDef.name} — Click to detach`
                  : `Click to install compatible ${SLOT_LABELS[slot]} from backpack`
              }
              onClick={() => {
                if (installedDef) {
                  onRemoveAttachment(slot);
                } else if (onQuickInstallSlot) {
                  onQuickInstallSlot(slot);
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                onDropOnAttachmentSlot({
                  kind: 'attachment_slot',
                  weaponInstanceId: weapon.instanceId,
                  attachmentSlot: slot,
                });
              }}
              className={`group relative h-[74px] sm:h-[76px] rounded-[5px] border p-1.5 flex flex-col justify-between transition-all cursor-pointer select-none ${borderClass}`}
            >
              <div className="flex items-center justify-between gap-1 leading-none">
                <span className="text-[11px] font-medium text-slate-200 truncate">
                  {SLOT_LABELS[slot]}
                </span>
                {installedDef ? (
                  <button
                    type="button"
                    data-testid={`remove-attachment-${slot}`}
                    aria-label={`Remove ${installedDef.name} from ${SLOT_LABELS[slot]}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveAttachment(slot);
                    }}
                    className="px-1 rounded bg-white/10 hover:bg-rose-500/30 text-[9px] font-mono text-slate-300 hover:text-rose-200 cursor-pointer"
                  >
                    ×
                  </button>
                ) : (
                  <span className="text-[9px] font-mono text-emerald-400">
                    +Add
                  </span>
                )}
              </div>

              {displayDef && (
                <div
                  draggable={Boolean(installedDef)}
                  onDragStart={() => {
                    if (installedDef) {
                      onStartDragAttachment(slot, installedDef.id);
                    }
                  }}
                  onDragEnd={onEndDrag}
                  className={`flex-1 min-h-0 flex items-center justify-center my-0.5 pointer-events-none ${
                    installedDef ? '' : 'opacity-45'
                  }`}
                >
                  <TacticalItemIcon
                    def={displayDef}
                    className="w-[50px] h-[36px]"
                  />
                </div>
              )}

              <span className="text-[10px] sm:text-[11px] font-medium text-slate-100 truncate leading-none">
                {installedDef
                  ? installedDef.shortName
                  : displayDef
                    ? `${displayDef.shortName} (Empty)`
                    : 'Empty'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
