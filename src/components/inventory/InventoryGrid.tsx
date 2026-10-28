import React, { useState } from 'react';
import { type WeaponId } from '../../game/config.ts';
import type { SimulationState } from '../../game/rules.ts';
import {
  type EquippedGearSlotId,
  type EquippedWeaponSlotId,
  findWeaponInstanceForWeaponId,
  getItemDefinition,
  type InventoryDragSource,
  type InventoryDropTarget,
  type InventoryItemInstance,
  type InventorySortField,
  moveBackpackSlotToSlot,
  validateInventoryDropTarget,
} from '../../game/inventory/index.ts';
import { InventoryItemCard } from './InventoryItemCard.tsx';
import { TacticalWeaponSvg } from './ReferenceArtwork.tsx';

export interface InventoryGridProps {
  sim: SimulationState;
  activeDragSource: InventoryDragSource | null;
  onStartDragSource: (source: InventoryDragSource) => void;
  onEndDrag: () => void;
  onDropOnTarget: (target: InventoryDropTarget) => void;
  onUseOrEquipSlot: (slotIndex: number) => void;
  onSplitSlotStack: (slotIndex: number, splitQty: number) => void;
  onDropSlotItem: (slotIndex: number, qty?: number) => void;
  onSelectInspectWeapon: (weaponInstanceId: string) => void;
  onEquipStoredWeapon: (
    weaponInstanceId: string,
    targetSlot: EquippedWeaponSlotId
  ) => void;
  onDropStoredWeapon: (weaponInstanceId: string) => void;
  onPickupWorldLoot: (lootId: string) => void;
  onSortBackpackSlots: (field: InventorySortField) => void;
  onExpandCapacity: (nextSlots: number, nextWeightKg: number) => void;
  onMutateCommit?: () => void;
  onClose?: () => void;
  onCycleGearTier?: (slot: EquippedGearSlotId) => void;
}

type RefFilterTab =
  | 'all'
  | 'weapons'
  | 'attachments'
  | 'ammo'
  | 'medical'
  | 'grenades'
  | 'misc';

const REF_TABS: { id: RefFilterTab; label: string; testId: string }[] = [
  { id: 'all', label: 'All', testId: 'cat-filter-all' },
  { id: 'weapons', label: 'Weapons', testId: 'cat-filter-weapon' },
  { id: 'attachments', label: 'Attachments', testId: 'cat-filter-attachment' },
  { id: 'ammo', label: 'Ammo', testId: 'cat-filter-ammo' },
  { id: 'medical', label: 'Medical', testId: 'cat-filter-healing' },
  { id: 'grenades', label: 'Grenades', testId: 'cat-filter-throwable' },
  { id: 'misc', label: 'Misc', testId: 'cat-filter-tactical' },
];

export const InventoryGrid: React.FC<InventoryGridProps> = ({
  sim,
  activeDragSource,
  onStartDragSource,
  onEndDrag,
  onDropOnTarget,
  onUseOrEquipSlot,
  onSplitSlotStack,
  onDropSlotItem,
  onSelectInspectWeapon,
  onEquipStoredWeapon,
  onDropStoredWeapon,
  onSortBackpackSlots,
  onMutateCommit,
  onClose,
  onCycleGearTier,
}) => {
  const player = sim.player;
  const inv = player.inventory;

  const [activeTab, setActiveTab] = useState<RefFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number>(0);
  const [moveSourceSlotIdx, setMoveSourceSlotIdx] = useState<number | null>(
    null
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matchesFilter = (slot: InventoryItemInstance | null): boolean => {
    if (!slot) return true;
    const def = getItemDefinition(slot.itemId);
    if (!def) return false;

    if (activeTab === 'weapons' && def.category !== 'weapon') return false;
    if (activeTab === 'attachments' && def.category !== 'attachment')
      return false;
    if (activeTab === 'ammo' && def.category !== 'ammo') return false;
    if (
      activeTab === 'medical' &&
      def.category !== 'healing' &&
      def.category !== 'consumable'
    )
      return false;
    if (activeTab === 'grenades' && def.category !== 'throwable') return false;
    if (
      activeTab === 'misc' &&
      def.category !== 'tactical' &&
      def.category !== 'armor' &&
      def.category !== 'misc'
    )
      return false;

    if (normalizedQuery) {
      return (
        def.name.toLowerCase().includes(normalizedQuery) ||
        def.shortName.toLowerCase().includes(normalizedQuery) ||
        def.category.toLowerCase().includes(normalizedQuery)
      );
    }
    return true;
  };

  const handleSlotClick = (
    slotIndex: number,
    e?: React.MouseEvent<HTMLDivElement>
  ) => {
    const slotItem = inv.slots[slotIndex];

    // Ctrl+Click splits stack immediately
    if (e?.ctrlKey && slotItem && slotItem.quantity > 1) {
      onSplitSlotStack(slotIndex, Math.floor(slotItem.quantity / 2));
      return;
    }

    // Alt+Click drops item immediately
    if (e?.altKey && slotItem) {
      onDropSlotItem(slotIndex);
      return;
    }

    if (moveSourceSlotIdx !== null) {
      if (moveSourceSlotIdx !== slotIndex) {
        moveBackpackSlotToSlot(player, moveSourceSlotIdx, slotIndex);
        if (onMutateCommit) onMutateCommit();
      }
      setMoveSourceSlotIdx(null);
      setSelectedSlotIdx(slotIndex);
      return;
    }
    setSelectedSlotIdx(slotIndex);
  };

  const renderBackpackSlotCell = (slotIndex: number) => {
    const slotItem = inv.slots[slotIndex] || null;
    const isSelected = selectedSlotIdx === slotIndex;
    const isVisible = matchesFilter(slotItem);

    let dragValid: boolean | null = null;
    if (activeDragSource) {
      const check = validateInventoryDropTarget(player, activeDragSource, {
        kind: 'backpack_slot',
        slotIndex,
      });
      dragValid = check.valid;
    }

    if (!slotItem) {
      return (
        <div
          key={`cell_${slotIndex}`}
          role="button"
          tabIndex={0}
          data-testid={`backpack-slot-${slotIndex}`}
          data-item-id="empty"
          aria-label={`Empty Backpack Slot ${slotIndex + 1}`}
          onClick={(e) => handleSlotClick(slotIndex, e)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onDropOnTarget({ kind: 'backpack_slot', slotIndex });
          }}
          className={`h-[76px] sm:h-[82px] rounded-[5px] border flex items-center justify-center transition-colors cursor-pointer ${
            dragValid === true
              ? 'border-emerald-400 bg-emerald-500/20'
              : isSelected
                ? 'border-amber-400/80 bg-[#141e2b]/65'
                : 'border-white/15 bg-[#0c121b]/50 hover:border-white/30 hover:bg-[#121a27]/65'
          }`}
        >
          <span className="text-xl font-light text-slate-400 select-none">
            +
          </span>
        </div>
      );
    }

    return (
      <div
        key={`cell_${slotIndex}`}
        className={isVisible ? '' : 'opacity-20 pointer-events-none'}
      >
        <InventoryItemCard
          instance={slotItem}
          slotIndex={slotIndex}
          isSelected={isSelected || moveSourceSlotIdx === slotIndex}
          isDragTargetValid={dragValid}
          onSelect={() => handleSlotClick(slotIndex)}
          onQuickAction={() => onUseOrEquipSlot(slotIndex)}
          onDragStart={() =>
            onStartDragSource({
              kind: 'backpack_slot',
              slotIndex,
              instanceId: slotItem.instanceId,
              itemId: slotItem.itemId,
            })
          }
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onDropOnTarget({ kind: 'backpack_slot', slotIndex });
          }}
        />
      </div>
    );
  };

  // Interactive Gear Cards in Row 3 Columns 4, 5, 6 (linked to Helmet, Armor, Backpack)
  const gearCards: {
    slot: EquippedGearSlotId;
    instance: InventoryItemInstance;
  }[] = [
    {
      slot: 'helmet',
      instance: inv.equippedGear.helmet || {
        instanceId: 'gear_ref_helmet',
        itemId: 'gear_helmet_lv2',
        quantity: 1,
      },
    },
    {
      slot: 'armor',
      instance: inv.equippedGear.armor || {
        instanceId: 'gear_ref_armor',
        itemId: 'gear_armor_lv2',
        quantity: 1,
      },
    },
    {
      slot: 'backpack',
      instance: inv.equippedGear.backpack || {
        instanceId: 'gear_ref_backpack',
        itemId: 'gear_backpack_lv2',
        quantity: 1,
      },
    },
  ];

  // 5-Weapon Tactical Rack in Row 4 (AKM, M4A1, UMP45, AWM, P90)
  const weaponRackCards: {
    weaponId: WeaponId;
    title: string;
  }[] = [
    { weaponId: 'ak47', title: 'AKM' },
    { weaponId: 'm4a1', title: 'M4A1' },
    { weaponId: 'mp5', title: 'UMP45' },
    { weaponId: 'awp', title: 'AWM' },
    { weaponId: 'spas12', title: 'P90' },
  ];

  const selectedSlotItem = inv.slots[selectedSlotIdx] || null;
  const selectedSlotDef = selectedSlotItem
    ? getItemDefinition(selectedSlotItem.itemId)
    : null;

  return (
    <section
      aria-label="Backpack Storage & Weapon Rack"
      data-testid="backpack-slots-grid"
      className="rounded-lg border border-white/15 bg-[#070b12]/32 backdrop-blur-sm p-2.5 sm:p-3.5 flex flex-col justify-between gap-2 sm:gap-2.5 h-full min-h-0 select-none overflow-y-auto"
    >
      {/* 1. HEADER & SEARCH BAR */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-display font-bold text-sm sm:text-[15px] tracking-wider text-slate-100 uppercase leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            BACKPACK
          </h3>
          {moveSourceSlotIdx !== null && (
            <span className="px-2 py-0.5 rounded bg-amber-500/25 border border-amber-400/60 text-[10px] font-mono text-amber-200 truncate">
              Moving #{moveSourceSlotIdx + 1}
            </span>
          )}
        </div>

        <div className="relative flex items-center w-36 sm:w-52 shrink-0">
          <svg
            viewBox="0 0 16 16"
            className="w-3.5 h-3.5 text-slate-300 absolute left-2.5 pointer-events-none"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            aria-label="Search inventory items"
            data-testid="inventory-search-input"
            className="w-full pl-8 pr-6 py-1 rounded-[5px] bg-[#0c121b]/65 border border-white/15 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-slate-300"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-xs text-slate-300 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 2. CATEGORY TABS ROW (Horizontally scrollable on mobile portrait, 7-col grid on sm+) */}
      <div
        role="tablist"
        aria-label="Filter items by category"
        className="flex overflow-x-auto gap-1.5 pb-0.5 sm:pb-0 sm:grid sm:grid-cols-7 shrink-0"
      >
        {REF_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={tab.testId}
              onClick={() => setActiveTab(tab.id)}
              className={`py-1.5 px-2.5 sm:px-2 rounded-[5px] border text-[11px] sm:text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[#4f5a20]/90 border-[#94ab38] text-white font-semibold'
                  : 'bg-[#0e1520]/60 border-white/15 text-slate-200 hover:text-white hover:border-white/30'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. ROWS 1, 2, 3 (18 ITEM CELLS: 3 columns on mobile portrait, 6 columns on sm+) */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2">
        {/* Row 1 (slots 0..5) */}
        {[0, 1, 2, 3, 4, 5].map((idx) => renderBackpackSlotCell(idx))}
        {/* Row 2 (slots 6..11) */}
        {[6, 7, 8, 9, 10, 11].map((idx) => renderBackpackSlotCell(idx))}
        {/* Row 3 Cols 1-3 (slots 12..14) */}
        {[12, 13, 14].map((idx) => renderBackpackSlotCell(idx))}
        {/* Row 3 Cols 4-6 (Interactive Helmet, Armor, Backpack Cards) */}
        {gearCards.map((gCard, gIdx) => (
          <div
            key={gCard.slot}
            className={
              matchesFilter(gCard.instance)
                ? ''
                : 'opacity-20 pointer-events-none'
            }
          >
            <InventoryItemCard
              instance={gCard.instance}
              slotIndex={24 + gIdx}
              isSelected={false}
              isDragTargetValid={null}
              onSelect={() => {
                if (onCycleGearTier) onCycleGearTier(gCard.slot);
              }}
              onQuickAction={() => {
                if (onCycleGearTier) onCycleGearTier(gCard.slot);
              }}
            />
          </div>
        ))}
      </div>

      {/* 4. ROW 4 — 5 WEAPON CARDS (2 cols on mobile portrait, 5 cols on sm+) */}
      <div
        data-testid="weapon-storage-rack"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onDropOnTarget({ kind: 'weapon_storage' });
        }}
        className={`grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2 ${
          activeTab !== 'all' && activeTab !== 'weapons'
            ? 'opacity-20 pointer-events-none'
            : ''
        }`}
      >
        {weaponRackCards.map((wCard) => {
          const wInst =
            findWeaponInstanceForWeaponId(inv, wCard.weaponId) ||
            inv.equippedWeapons.primary;
          const isStored = inv.storedWeapons.some(
            (sw) => sw.instanceId === wInst.instanceId
          );
          const isEquipped = !isStored;
          const isInspected = inv.inspectedWeaponInstanceId === wInst.instanceId;

          return (
            <div
              key={wCard.weaponId}
              draggable
              data-testid={`stored-weapon-${wCard.weaponId}`}
              data-weapon-instance-id={wInst.instanceId}
              onClick={() => onSelectInspectWeapon(wInst.instanceId)}
              onDoubleClick={() => {
                if (isStored) {
                  onEquipStoredWeapon(wInst.instanceId, 'primary');
                }
              }}
              onDragStart={() => {
                if (isStored) {
                  onStartDragSource({
                    kind: 'stored_weapon',
                    weaponInstanceId: wInst.instanceId,
                    weaponId: wInst.weaponId,
                  });
                }
              }}
              onDragEnd={onEndDrag}
              className={`group relative h-[90px] sm:h-[96px] rounded-[5px] border p-2 flex flex-col justify-between transition-colors cursor-pointer select-none ${
                isEquipped
                  ? 'border-[#2ea043] bg-[#0b1912]/60 shadow-[inset_0_0_14px_rgba(46,160,67,0.25)]'
                  : isInspected
                    ? 'border-[#38bdf8] bg-[#101926]/65'
                    : 'border-white/15 bg-[#0c121b]/50 hover:border-white/30 hover:bg-[#121a27]/65'
              }`}
            >
              <div className="flex items-center justify-between leading-none">
                <span className="text-xs font-semibold text-slate-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                  {wCard.title}
                </span>

                {/* Quick-Equip & Drop Buttons (Always visible on mobile, hover on desktop) */}
                <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-0.5 transition-opacity">
                  <button
                    type="button"
                    data-testid={`equip-stored-primary-${wCard.weaponId}`}
                    aria-label={`Equip ${wCard.title} to Primary`}
                    title="Equip to Primary (Slot 1)"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEquipStoredWeapon(wInst.instanceId, 'primary');
                    }}
                    className="px-1.5 py-0.5 rounded bg-emerald-600/85 hover:bg-emerald-500 text-white font-mono text-[9px] cursor-pointer"
                  >
                    1
                  </button>
                  <button
                    type="button"
                    data-testid={`equip-stored-secondary-${wCard.weaponId}`}
                    aria-label={`Equip ${wCard.title} to Secondary`}
                    title="Equip to Secondary (Slot 2)"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEquipStoredWeapon(wInst.instanceId, 'secondary');
                    }}
                    className="px-1.5 py-0.5 rounded bg-sky-600/85 hover:bg-sky-500 text-white font-mono text-[9px] cursor-pointer"
                  >
                    2
                  </button>
                  <button
                    type="button"
                    data-testid={`drop-stored-weapon-${wCard.weaponId}`}
                    aria-label={`Drop ${wCard.title}`}
                    title="Drop Weapon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDropStoredWeapon(wInst.instanceId);
                    }}
                    className="px-1 py-0.5 rounded bg-rose-600/85 hover:bg-rose-500 text-white font-mono text-[9px] cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Center Custom Vector Weapon Artwork */}
              <div className="flex-1 min-h-0 flex items-center justify-center my-0.5 pointer-events-none">
                <TacticalWeaponSvg
                  weaponId={wCard.weaponId}
                  attachments={wInst.attachments}
                  className="w-[96px] h-[40px] sm:w-[100px] sm:h-[44px]"
                />
              </div>

              {isEquipped ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-emerald-300 leading-none">
                    Equipped
                  </span>
                  <div className="h-[3px] w-full rounded-full bg-slate-800/80 overflow-hidden">
                    <div className="h-full w-4/5 bg-[#5cb85c]" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[11px] leading-none">
                  <span className="text-slate-200 font-medium">
                    {wCard.title}
                  </span>
                  <span className="text-slate-200 tabular-nums">x1</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 5. ROW 5 (6 MISC / CONSUMABLE ITEMS: 3 cols on mobile portrait, 6 cols on sm+) */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2">
        {[15, 16, 17, 18, 19, 20].map((idx) => renderBackpackSlotCell(idx))}
      </div>

      {/* 6. ROW 6 — EXTRA SLOTS (21..25) + [-] SPLIT + [TRASH] DROP */}
      <div className="grid grid-cols-4 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_36px_42px] gap-1.5 sm:gap-2 items-stretch">
        {[21, 22, 23, 24, 25].map((slotIdx, offset) => {
          const clampedIdx = Math.min(inv.maxSlots - 1, slotIdx);
          const itemInExtra =
            slotIdx < inv.maxSlots ? inv.slots[slotIdx] : null;
          const isSel = selectedSlotIdx === clampedIdx;

          if (itemInExtra) {
            return (
              <div key={`extra_cell_${offset}`} className="min-w-0">
                <InventoryItemCard
                  instance={itemInExtra}
                  slotIndex={slotIdx}
                  isSelected={isSel}
                  isDragTargetValid={null}
                  onSelect={() => handleSlotClick(slotIdx)}
                  onQuickAction={() => onUseOrEquipSlot(slotIdx)}
                  onDragStart={() =>
                    onStartDragSource({
                      kind: 'backpack_slot',
                      slotIndex: slotIdx,
                      instanceId: itemInExtra.instanceId,
                      itemId: itemInExtra.itemId,
                    })
                  }
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    onDropOnTarget({
                      kind: 'backpack_slot',
                      slotIndex: slotIdx,
                    });
                  }}
                />
              </div>
            );
          }

          return (
            <div
              key={`plus_cell_${offset}`}
              role="button"
              tabIndex={0}
              aria-label={`Empty Expansion Slot ${offset + 1}`}
              onClick={(e) => handleSlotClick(clampedIdx, e)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onDropOnTarget({
                  kind: 'backpack_slot',
                  slotIndex: clampedIdx,
                });
              }}
              className={`h-[68px] sm:h-[72px] rounded-[5px] border flex items-center justify-center cursor-pointer transition-colors ${
                isSel
                  ? 'border-amber-400/80 bg-[#141e2b]/65'
                  : 'border-white/15 bg-[#0c121b]/50 hover:border-white/30 hover:bg-[#121a27]/65'
              }`}
            >
              <span className="text-2xl font-light text-slate-400 leading-none">
                +
              </span>
            </div>
          );
        })}

        {/* [-] Split Stack Button */}
        <button
          type="button"
          data-testid="split-stack-btn"
          aria-label="Split Selected Stack"
          title="Split selected stack in half"
          onClick={() => {
            const itm = inv.slots[selectedSlotIdx];
            if (itm && itm.quantity > 1) {
              onSplitSlotStack(selectedSlotIdx, Math.floor(itm.quantity / 2));
            }
          }}
          className="h-[68px] sm:h-[72px] rounded-[5px] border border-white/15 bg-[#0c121b]/50 hover:border-white/30 hover:bg-[#121a27]/65 flex items-center justify-center text-slate-200 hover:text-white text-lg cursor-pointer transition-colors"
        >
          −
        </button>

        {/* [Trash] Drop Selected Item Button */}
        <button
          type="button"
          data-testid="drop-selected-slot-btn"
          aria-label="Drop Selected Item"
          title="Drop selected item into the world"
          onClick={() => onDropSlotItem(selectedSlotIdx)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onDropOnTarget({ kind: 'drop_world' });
          }}
          className="h-[68px] sm:h-[72px] rounded-[5px] border border-white/15 bg-[#0c121b]/50 hover:border-rose-500/60 flex items-center justify-center text-slate-200 hover:text-rose-300 cursor-pointer transition-colors"
        >
          <svg
            viewBox="0 0 16 16"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M3 4h10M6 4V2.5h4V4M5 4v9h6V4" />
          </svg>
        </button>
      </div>

      {/* 7. BOTTOM INTERACTIVE ACTION & SHORTCUT BAR */}
      <div
        data-testid="selected-item-detail-bar"
        className="pt-1.5 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200"
      >
        {/* Selected Item Summary + Quick Use/Equip Button */}
        <div className="flex items-center gap-2">
          {selectedSlotDef && selectedSlotItem ? (
            <>
              <span className="text-[11px] font-medium text-slate-100">
                {selectedSlotDef.shortName}{' '}
                <span className="text-slate-300">
                  (x{selectedSlotItem.quantity})
                </span>
              </span>
              <button
                type="button"
                data-testid="use-selected-slot-btn"
                onClick={() => onUseOrEquipSlot(selectedSlotIdx)}
                className="px-2.5 py-0.5 rounded bg-emerald-600/85 hover:bg-emerald-500 text-[10px] font-semibold text-white cursor-pointer"
              >
                {selectedSlotDef.category === 'attachment'
                  ? 'Attach'
                  : selectedSlotDef.equippable
                    ? 'Equip'
                    : 'Use'}
              </button>
            </>
          ) : (
            <span className="text-[11px] text-slate-400">Empty Slot</span>
          )}
        </div>

        {/* Interactive Shortcut Controls */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5">
          <button
            type="button"
            data-testid="slot-move-btn"
            onClick={() =>
              setMoveSourceSlotIdx(
                moveSourceSlotIdx === selectedSlotIdx ? null : selectedSlotIdx
              )
            }
            className={`flex items-center gap-1 hover:text-white cursor-pointer ${
              moveSourceSlotIdx !== null ? 'text-amber-300 font-semibold' : ''
            }`}
          >
            <span className="px-1.5 py-0.5 rounded-[3px] border border-white/20 bg-[#0e1520]/65 text-[10px] font-mono text-slate-200">
              🖱️
            </span>
            <span>Move</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const itm = inv.slots[selectedSlotIdx];
              if (itm && itm.quantity > 1) {
                onSplitSlotStack(selectedSlotIdx, Math.floor(itm.quantity / 2));
              }
            }}
            className="flex items-center gap-1 hover:text-white cursor-pointer"
          >
            <span className="px-1.5 py-0.5 rounded-[3px] border border-white/20 bg-[#0e1520]/65 text-[10px] font-mono text-slate-200">
              Ctrl
            </span>
            <span>Split</span>
          </button>

          <button
            type="button"
            onClick={() => onDropSlotItem(selectedSlotIdx)}
            className="flex items-center gap-1 hover:text-white cursor-pointer"
          >
            <span className="px-1.5 py-0.5 rounded-[3px] border border-white/20 bg-[#0e1520]/65 text-[10px] font-mono text-slate-200">
              Alt
            </span>
            <span>Drop</span>
          </button>

          <button
            type="button"
            onClick={() => onSortBackpackSlots('category')}
            className="flex items-center gap-1 hover:text-white cursor-pointer"
          >
            <span className="px-1.5 py-0.5 rounded-[3px] border border-white/20 bg-[#0e1520]/65 text-[10px] font-mono text-slate-200">
              R
            </span>
            <span>Rotate</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onClose) onClose();
            }}
            className="flex items-center gap-1 hover:text-white cursor-pointer"
          >
            <span className="px-1.5 py-0.5 rounded-[3px] border border-white/20 bg-[#0e1520]/65 text-[10px] font-mono text-slate-200">
              Esc
            </span>
            <span>Close</span>
          </button>
        </div>
      </div>
    </section>
  );
};
