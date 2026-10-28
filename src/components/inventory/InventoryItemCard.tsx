import React from 'react';
import {
  computeItemInstanceWeightKg,
  getItemDefinition,
  type InventoryItemInstance,
  type ItemDefinition,
} from '../../game/inventory/index.ts';
import { CustomItemSvg, TacticalWeaponSvg } from './ReferenceArtwork.tsx';

export const TacticalItemIcon: React.FC<{
  def: ItemDefinition;
  className?: string;
}> = ({ def, className = 'w-12 h-11' }) => {
  if (def.category === 'weapon' && def.weaponId) {
    return <TacticalWeaponSvg weaponId={def.weaponId} className={className} />;
  }
  return <CustomItemSvg itemId={def.id} className={className} />;
};

export interface InventoryItemCardProps {
  instance: InventoryItemInstance;
  slotIndex: number;
  isSelected?: boolean;
  isDragTargetValid?: boolean | null;
  onSelect: () => void;
  onQuickAction?: () => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
}

export function getCardRarityFrameClass(
  def: ItemDefinition,
  isSelected: boolean,
  isDragTargetValid: boolean | null
): string {
  if (isDragTargetValid === true) {
    return 'border-emerald-400 bg-emerald-500/15 shadow-[inset_0_0_12px_rgba(16,185,129,0.25)]';
  }
  if (isDragTargetValid === false) {
    return 'border-rose-500 bg-rose-500/15';
  }

  const selectedRing = isSelected
    ? 'ring-2 ring-amber-400/90 border-amber-400/80 bg-[#141e2b]/65'
    : '';

  const isPurpleCard =
    def.rarity === 'epic' ||
    def.rarity === 'legendary' ||
    def.id === 'att_optic_2x' ||
    def.id === 'att_optic_4x' ||
    def.id === 'att_optic_8x' ||
    def.id === 'gear_helmet_lv2' ||
    def.id === 'gear_armor_lv2' ||
    def.id === 'gear_backpack_lv2';

  const isBlueCard =
    def.rarity === 'rare' ||
    def.id === 'att_muzzle_suppressor' ||
    def.id === 'att_muzzle_compensator' ||
    def.id === 'att_muzzle_choke' ||
    def.id === 'att_grip_vertical' ||
    def.id === 'att_grip_angled' ||
    def.id === 'att_optic_red_dot' ||
    def.id === 'att_optic_holo' ||
    def.id === 'att_mag_ext_ar' ||
    def.id === 'att_mag_fast_smg' ||
    def.id === 'att_stock_tactical' ||
    def.id === 'att_stock_lightweight';

  if (isPurpleCard) {
    return `border-[#8b5cf6]/85 bg-[#0c121b]/50 shadow-[inset_0_0_14px_rgba(139,92,246,0.22)] hover:border-[#a78bfa] hover:bg-[#121a27]/65 ${selectedRing}`;
  }
  if (isBlueCard) {
    return `border-[#0ea5e9]/85 bg-[#0c121b]/50 shadow-[inset_0_0_14px_rgba(14,165,233,0.22)] hover:border-[#38bdf8] hover:bg-[#121a27]/65 ${selectedRing}`;
  }

  return `border-white/15 bg-[#0c121b]/50 hover:border-white/30 hover:bg-[#121a27]/65 ${selectedRing}`;
}

export const InventoryItemCard: React.FC<InventoryItemCardProps> = ({
  instance,
  slotIndex,
  isSelected = false,
  isDragTargetValid = null,
  onSelect,
  onQuickAction,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const def = getItemDefinition(instance.itemId);
  if (!def) return null;

  const weightKg = computeItemInstanceWeightKg(instance);
  const frameClass = getCardRarityFrameClass(
    def,
    isSelected,
    isDragTargetValid
  );
  const showStackCount =
    def.maxStack > 1 ||
    def.category === 'misc' ||
    def.category === 'consumable' ||
    def.category === 'healing' ||
    def.category === 'throwable' ||
    def.category === 'ammo';

  const quickLabel =
    def.category === 'healing' || def.category === 'consumable'
      ? 'Use'
      : def.category === 'attachment'
        ? 'Attach'
        : def.equippable
          ? 'Equip'
          : null;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      data-testid={`backpack-slot-${slotIndex}`}
      data-item-id={def.id}
      data-quantity={instance.quantity}
      aria-label={`Slot ${slotIndex + 1}: ${def.name} (${instance.quantity}x, ${weightKg.toFixed(2)} kg)`}
      onClick={onSelect}
      onDoubleClick={onQuickAction}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group relative h-[76px] sm:h-[82px] rounded-[5px] border px-2 pt-1.5 pb-1.5 flex flex-col justify-between transition-colors cursor-pointer select-none ${frameClass}`}
    >
      {/* Quick Action Pill on Hover / Selection */}
      {quickLabel && onQuickAction && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickAction();
          }}
          className={`${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          } focus:opacity-100 absolute top-1 right-1 z-10 px-1.5 py-0.5 rounded bg-emerald-600/90 hover:bg-emerald-500 text-[9px] font-bold text-white leading-none cursor-pointer transition-opacity`}
        >
          {quickLabel}
        </button>
      )}

      {/* Center Custom Vector Item Artwork */}
      <div className="flex-1 min-h-0 flex items-center justify-center pointer-events-none">
        <TacticalItemIcon
          def={def}
          className="w-[52px] h-[38px] sm:w-[58px] sm:h-[42px]"
        />
      </div>

      {/* Bottom Label & Stack Quantity */}
      <div className="relative pt-0.5 leading-none">
        {showStackCount && (
          <span
            data-testid={`slot-qty-${slotIndex}`}
            className="absolute -top-2.5 right-0 text-[10px] font-semibold text-slate-200 tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]"
          >
            x{instance.quantity}
          </span>
        )}
        <span className="block text-[10px] sm:text-[11px] font-medium text-slate-100 truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
          {def.shortName}
        </span>
      </div>
    </div>
  );
};
