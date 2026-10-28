import React, { useState } from 'react';
import type { SimulationState } from '../../game/rules.ts';
import { soundEngine } from '../../audio/soundEngine.ts';
import {
  type AttachmentSlotType,
  computeInventoryCapacity,
  dropInventoryItemToWorld,
  equipAttachmentFromBackpackSlot,
  type EquippedGearSlotId,
  type EquippedWeaponSlotId,
  equipWeaponFromStorage,
  executeInventoryDragDrop,
  findWeaponInstanceById,
  getItemDefinition,
  type InventoryDragSource,
  type InventoryDropTarget,
  type InventorySortField,
  moveWeaponSlotToStorage,
  pickupWorldLootItem,
  removeAttachmentFromWeapon,
  saveInventoryToLocalStorage,
  splitBackpackStack,
  swapEquippedWeaponSlots,
  syncInventoryToPlayerState,
  useOrEquipBackpackSlotItem,
  type WeaponFireMode,
} from '../../game/inventory/index.ts';
import { EquipmentPanel } from './EquipmentPanel.tsx';
import { InventoryGrid } from './InventoryGrid.tsx';
import { WeaponInspectionPanel } from './WeaponInspectionPanel.tsx';

export interface BackpackUIProps {
  sim: SimulationState;
  isOpen: boolean;
  onClose: () => void;
  onInventoryMutated: () => void;
}

const RARITY_RANK: Record<string, number> = {
  legendary: 5,
  epic: 4,
  rare: 3,
  uncommon: 2,
  common: 1,
};

function sortPlayerInventorySlots(
  sim: SimulationState,
  field: InventorySortField
): void {
  const inv = sim.player.inventory;
  const occupied = inv.slots
    .slice(0, inv.maxSlots)
    .filter((s): s is NonNullable<typeof s> => s !== null && s.quantity > 0);

  occupied.sort((a, b) => {
    const defA = getItemDefinition(a.itemId);
    const defB = getItemDefinition(b.itemId);
    if (!defA || !defB) return 0;

    if (field === 'name') {
      return defA.name.localeCompare(defB.name);
    }
    if (field === 'quantity') {
      return b.quantity - a.quantity || defA.name.localeCompare(defB.name);
    }
    if (field === 'weight') {
      return (
        defB.weightKg * b.quantity - defA.weightKg * a.quantity ||
        defA.name.localeCompare(defB.name)
      );
    }
    if (field === 'rarity') {
      return (
        (RARITY_RANK[defB.rarity] || 0) - (RARITY_RANK[defA.rarity] || 0) ||
        defA.name.localeCompare(defB.name)
      );
    }
    return (
      defA.category.localeCompare(defB.category) ||
      (RARITY_RANK[defB.rarity] || 0) - (RARITY_RANK[defA.rarity] || 0) ||
      defA.name.localeCompare(defB.name)
    );
  });

  for (let i = 0; i < inv.maxSlots; i++) {
    inv.slots[i] = occupied[i] || null;
  }
}

export const BackpackUI: React.FC<BackpackUIProps> = ({
  sim,
  isOpen,
  onClose,
  onInventoryMutated,
}) => {
  const [activeDragSource, setActiveDragSource] =
    useState<InventoryDragSource | null>(null);
  const [topNavTab, setTopNavTab] = useState<
    'inventory' | 'map' | 'missions' | 'settings'
  >('inventory');
  const [mobileSection, setMobileSection] = useState<
    'backpack' | 'equipment' | 'inspect'
  >('backpack');
  const [, setRevision] = useState(0);

  if (!isOpen) return null;

  const player = sim.player;
  const inv = player.inventory;
  const capacity = computeInventoryCapacity(inv);

  const commitMutation = (playClick = true) => {
    if (playClick) {
      soundEngine.play('ui_click');
    }
    syncInventoryToPlayerState(player);
    saveInventoryToLocalStorage(inv);
    setRevision((r) => r + 1);
    onInventoryMutated();
  };

  const handleSelectInspectWeapon = (weaponInstanceId: string) => {
    inv.inspectedWeaponInstanceId = weaponInstanceId;
    const found = findWeaponInstanceById(inv, weaponInstanceId);
    if (found && found.location !== 'stored') {
      player.activeWeapon = found.weapon.weaponId;
    }
    soundEngine.play('ui_click');
    setRevision((r) => r + 1);
    onInventoryMutated();
  };

  const handleDropOnTarget = (target: InventoryDropTarget) => {
    if (!activeDragSource) return;
    const res = executeInventoryDragDrop(sim, activeDragSource, target);
    setActiveDragSource(null);
    commitMutation(res.ok);
  };

  const handleSwapPrimarySecondary = () => {
    const res = swapEquippedWeaponSlots(player, 'primary', 'secondary');
    commitMutation(res.ok);
  };

  const handleMoveWeaponToStorage = (slot: EquippedWeaponSlotId) => {
    const res = moveWeaponSlotToStorage(player, slot);
    if (!res.ok && inv.storedWeapons.length > 0 && slot !== 'sidearm') {
      // Automatically swap with the first stored weapon if trying to unequip the last active rifle
      const replacement = inv.storedWeapons[0];
      const swapRes = equipWeaponFromStorage(
        player,
        replacement.instanceId,
        slot
      );
      commitMutation(swapRes.ok);
      return;
    }
    commitMutation(res.ok);
  };

  const handleEquipStoredWeapon = (
    weaponInstanceId: string,
    targetSlot: EquippedWeaponSlotId
  ) => {
    const res = equipWeaponFromStorage(player, weaponInstanceId, targetSlot);
    if (res.ok) {
      const found = findWeaponInstanceById(inv, weaponInstanceId);
      if (found) {
        player.activeWeapon = found.weapon.weaponId;
      }
    }
    commitMutation(res.ok);
  };

  const handleUseOrEquipSlot = (slotIndex: number) => {
    const slotItem = inv.slots[slotIndex];
    if (!slotItem) return;
    const def = getItemDefinition(slotItem.itemId);

    // If the item is a grenade/throwable or tactical tool, trigger immediate field use effect
    if (def && (def.category === 'throwable' || def.category === 'tactical') && !def.equippable && !def.repairArmor) {
      slotItem.quantity -= 1;
      if (slotItem.quantity <= 0) {
        inv.slots[slotIndex] = null;
      }
      inv.lastError = null;
      inv.lastNotice = `Deployed ${def.name} in tactical readiness.`;
      commitMutation(true);
      return;
    }

    const res = useOrEquipBackpackSlotItem(player, slotIndex);
    commitMutation(res.ok);
  };

  const handleCycleGearTier = (slot: EquippedGearSlotId) => {
    const current = inv.equippedGear[slot];
    const nextItemId =
      slot === 'helmet'
        ? current?.itemId === 'gear_helmet_lv3'
          ? 'gear_helmet_lv2'
          : 'gear_helmet_lv3'
        : slot === 'armor'
          ? current?.itemId === 'gear_armor_lv3'
            ? 'gear_armor_lv2'
            : 'gear_armor_lv3'
          : current?.itemId === 'gear_backpack_lv3'
            ? 'gear_backpack_lv2'
            : 'gear_backpack_lv3';

    const nextDef = getItemDefinition(nextItemId);
    if (!nextDef) return;

    // Prevent shrinking backpack slots if upper slots are occupied
    if (slot === 'backpack' && nextDef.backpackSlots) {
      for (let i = nextDef.backpackSlots; i < inv.slots.length; i++) {
        if (inv.slots[i]) {
          inv.lastError = `Clear slots ${nextDef.backpackSlots + 1}–${inv.maxSlots} before switching to ${nextDef.shortName}.`;
          setRevision((r) => r + 1);
          return;
        }
      }
    }

    inv.equippedGear[slot] = {
      instanceId: current?.instanceId || `gear_${slot}`,
      itemId: nextItemId,
      quantity: 1,
    };
    syncInventoryToPlayerState(player);
    if (slot === 'helmet' || slot === 'armor') {
      inv.armorHp = inv.maxArmorHp;
    }
    inv.lastError = null;
    inv.lastNotice = `Equipped ${nextDef.name}.`;
    commitMutation(true);
  };

  const handleSplitSlotStack = (slotIndex: number, splitQty: number) => {
    const res = splitBackpackStack(player, slotIndex, splitQty);
    commitMutation(res.ok);
  };

  const handleDropSlotItem = (slotIndex: number, qty?: number) => {
    const res = dropInventoryItemToWorld(sim, {
      kind: 'backpack_slot',
      slotIndex,
      quantity: qty,
    });
    commitMutation(res.ok);
  };

  const handleDropWeapon = (weaponInstanceId: string) => {
    const found = findWeaponInstanceById(inv, weaponInstanceId);
    if (!found) return;

    if (found.location !== 'stored') {
      // Move to storage first (or swap if last weapon) before dropping
      const slot = found.location as EquippedWeaponSlotId;
      const moveRes = moveWeaponSlotToStorage(player, slot);
      if (!moveRes.ok && inv.storedWeapons.length > 0 && slot !== 'sidearm') {
        equipWeaponFromStorage(player, inv.storedWeapons[0].instanceId, slot);
      }
    }

    const res = dropInventoryItemToWorld(sim, {
      kind: 'stored_weapon',
      weaponInstanceId,
    });
    commitMutation(res.ok);
  };

  const handlePickupWorldLoot = (lootId: string) => {
    const res = pickupWorldLootItem(sim, lootId);
    commitMutation(res.ok);
  };

  const handleRemoveAttachment = (slot: AttachmentSlotType) => {
    const targetId =
      inv.inspectedWeaponInstanceId || inv.equippedWeapons.primary.instanceId;
    const res = removeAttachmentFromWeapon(player, targetId, slot);
    commitMutation(res.ok);
  };

  const handleEquipAttachmentFromSlot = (backpackSlotIndex: number) => {
    const targetId =
      inv.inspectedWeaponInstanceId || inv.equippedWeapons.primary.instanceId;
    const res = equipAttachmentFromBackpackSlot(
      player,
      backpackSlotIndex,
      targetId
    );
    commitMutation(res.ok);
  };

  const handleToggleWeaponFireMode = (
    weaponInstanceId: string,
    nextMode: WeaponFireMode
  ) => {
    const found = findWeaponInstanceById(inv, weaponInstanceId);
    if (found) {
      found.weapon.fireMode = nextMode;
      inv.lastNotice = `Set ${found.weapon.weaponId.toUpperCase()} fire mode to ${nextMode.toUpperCase()}.`;
      inv.lastError = null;
      commitMutation(true);
    }
  };

  const handleSortBackpackSlots = (field: InventorySortField) => {
    sortPlayerInventorySlots(sim, field);
    inv.lastNotice = `Organized backpack items by ${field}.`;
    inv.lastError = null;
    commitMutation(true);
  };

  const handleExpandCapacity = (nextSlots: number, nextWeightKg: number) => {
    for (let i = nextSlots; i < inv.slots.length; i++) {
      if (inv.slots[i]) {
        inv.lastError = `Cannot reduce capacity to ${nextSlots} slots while slots ${nextSlots + 1}–${inv.maxSlots} contain items.`;
        setRevision((r) => r + 1);
        return;
      }
    }
    inv.maxSlots = nextSlots;
    inv.maxWeightKg = nextWeightKg;
    while (inv.slots.length < nextSlots) {
      inv.slots.push(null);
    }
    inv.lastError = null;
    inv.lastNotice = `Configured backpack capacity: ${nextSlots} slots / ${nextWeightKg} kg.`;
    commitMutation(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tactical Backpack & Inventory"
      data-testid="tactical-backpack-modal"
      data-ui-interactive="true"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[80] bg-black/10 p-3.5 sm:p-6 md:px-10 md:py-7 lg:px-14 lg:py-8 flex items-center justify-center pointer-events-auto select-none overflow-hidden"
    >
      {/* FLOATING INSET TACTICAL WINDOW (Not edge-to-edge; translucent glass so live 3D arena is visible behind and around it) */}
      <div className="relative w-full max-w-[1340px] h-full max-h-[820px] rounded-2xl border border-white/20 bg-[#080d14]/38 backdrop-blur-[4px] shadow-[0_24px_64px_rgba(0,0,0,0.65)] p-2.5 sm:p-3.5 flex flex-col gap-2 sm:gap-2.5 overflow-hidden">
        {/* TOP BAR */}
        <header className="w-full flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-white/12 shrink-0">
          {/* Left: [<- ESC] BACK + Live Action Feedback Pill */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="close-backpack-btn"
              aria-label="Close Tactical Backpack"
              onClick={() => {
                soundEngine.play('ui_click');
                onClose();
              }}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <span className="px-2.5 py-1 rounded-[5px] border border-white/20 bg-[#0e1520]/65 group-hover:bg-[#192332]/80 text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <span>←</span>
                <span>ESC</span>
              </span>
              <span className="hidden xs:inline font-display font-bold text-xs tracking-wider text-slate-100 group-hover:text-white uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                BACK
              </span>
            </button>

            {/* Live Status Feedback Banner */}
            {(inv.lastError || inv.lastNotice) && (
              <div
                role="status"
                className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] border text-[11px] font-medium max-w-[280px] truncate ${
                  inv.lastError
                    ? 'border-rose-500/50 bg-rose-500/20 text-rose-100'
                    : 'border-emerald-500/40 bg-emerald-500/20 text-emerald-100'
                }`}
              >
                <span className="truncate">
                  {inv.lastError || inv.lastNotice}
                </span>
              </div>
            )}
          </div>

          {/* Center: Segmented Navigation Tabs (INVENTORY | MAP | MISSIONS | SETTINGS) */}
          <nav
            aria-label="Tactical Menu Tabs"
            className="hidden md:flex items-center rounded-[5px] border border-white/15 bg-[#0e1520]/60 overflow-hidden"
          >
            {(
              [
                { id: 'inventory', label: 'INVENTORY', icon: 'vest' },
                { id: 'map', label: 'MAP', icon: 'pin' },
                { id: 'missions', label: 'MISSIONS', icon: 'clip' },
                { id: 'settings', label: 'SETTINGS', icon: 'gear' },
              ] as const
            ).map((tab) => {
              const isActive = topNavTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTopNavTab(tab.id)}
                  className={`px-4 py-1.5 text-xs font-display font-bold tracking-wider uppercase flex items-center gap-2 transition-colors cursor-pointer relative ${
                    isActive
                      ? 'bg-[#222d3d]/85 text-white border-b-2 border-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {tab.icon === 'vest' && (
                    <svg
                      viewBox="0 0 16 16"
                      className="w-3.5 h-3.5"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M4 2L6 4H10L12 2L14 5V14H2V5L4 2Z" />
                    </svg>
                  )}
                  {tab.icon === 'pin' && (
                    <svg
                      viewBox="0 0 16 16"
                      className="w-3.5 h-3.5"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M8 1.5A4.5 4.5 0 003.5 6c0 3.2 4.5 8.5 4.5 8.5s4.5-5.3 4.5-8.5A4.5 4.5 0 008 1.5zm0 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                    </svg>
                  )}
                  {tab.icon === 'clip' && (
                    <svg
                      viewBox="0 0 16 16"
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                    >
                      <rect x="3" y="2.5" width="10" height="11.5" rx="1" />
                      <path d="M5.5 6h5M5.5 9h5M5.5 12h3" />
                    </svg>
                  )}
                  {tab.icon === 'gear' && (
                    <svg
                      viewBox="0 0 16 16"
                      className="w-3.5 h-3.5"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M8 5a3 3 0 100 6 3 3 0 000-6zm6 2.2l-1.3-.3a5 5 0 00-.5-1.2l.7-1.1-1.1-1.1-1.1.7a5 5 0 00-1.2-.5L9.2 2.4H6.8l-.3 1.3a5 5 0 00-1.2.5l-1.1-.7-1.1 1.1.7 1.1a5 5 0 00-.5 1.2L2 7.2v1.6l1.3.3c.1.4.3.8.5 1.2l-.7 1.1 1.1 1.1 1.1-.7c.4.2.8.4 1.2.5l.3 1.3h2.4l.3-1.3c.4-.1.8-.3 1.2-.5l1.1.7 1.1-1.1-.7-1.1c.2-.4.4-.8.5-1.2l1.3-.3V7.2z" />
                    </svg>
                  )}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Weight Readout + Currency Readout + Settings Icon */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div
              data-testid="inventory-weight-readout"
              className="px-2.5 sm:px-3 py-1 rounded-[5px] border border-white/15 bg-[#0e1520]/65 flex items-center gap-1.5 text-[11px] sm:text-xs tabular-nums"
            >
              <svg
                viewBox="0 0 16 16"
                className="w-3.5 h-3.5 text-slate-200 shrink-0"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M6 2a2 2 0 00-2 2v1H3l-1 9h12l-1-9h-1V4a2 2 0 00-2-2H6zm0 2h4v1H6V4z" />
              </svg>
              <span>
                <strong className="text-white font-bold">
                  {capacity.currentWeightKg.toFixed(1)}
                </strong>{' '}
                <span className="text-slate-300">
                  / {Math.round(capacity.maxWeightKg)} kg
                </span>
              </span>
            </div>

            <div className="px-2.5 sm:px-3 py-1 rounded-[5px] border border-white/15 bg-[#0e1520]/65 flex items-center gap-1.5 text-[11px] sm:text-xs tabular-nums">
              <span className="w-3.5 h-3.5 rounded-full bg-[#4caf50] text-slate-950 font-bold text-[10px] flex items-center justify-center leading-none shrink-0">
                $
              </span>
              <strong className="text-white font-bold">
                {(4850 + sim.player.kills * 250).toLocaleString()}
              </strong>
            </div>

            <button
              type="button"
              aria-label="Inventory Settings"
              onClick={() =>
                setTopNavTab(topNavTab === 'settings' ? 'inventory' : 'settings')
              }
              className="p-1.5 rounded-[5px] border border-white/15 bg-[#0e1520]/65 hover:bg-[#192332]/80 text-slate-200 hover:text-white cursor-pointer"
            >
              <svg
                viewBox="0 0 16 16"
                className="w-3.5 h-3.5"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 5a3 3 0 100 6 3 3 0 000-6zm6 2.2l-1.3-.3a5 5 0 00-.5-1.2l.7-1.1-1.1-1.1-1.1.7a5 5 0 00-1.2-.5L9.2 2.4H6.8l-.3 1.3a5 5 0 00-1.2.5l-1.1-.7-1.1 1.1.7 1.1a5 5 0 00-.5 1.2L2 7.2v1.6l1.3.3c.1.4.3.8.5 1.2l-.7 1.1 1.1 1.1 1.1-.7c.4.2.8.4 1.2.5l.3 1.3h2.4l.3-1.3c.4-.1.8-.3 1.2-.5l1.1.7 1.1-1.1-.7-1.1c.2-.4.4-.8.5-1.2l1.3-.3V7.2z" />
              </svg>
            </button>
          </div>
        </header>

        {/* MOBILE / TABLET SECTION SWITCHER BAR (Visible on < lg viewports) */}
        <div
          role="tablist"
          aria-label="Mobile Inventory Panels"
          className="grid grid-cols-3 lg:hidden gap-1.5 bg-[#0a1018]/55 p-1 rounded-lg border border-white/15 shrink-0"
        >
          {(
            [
              ['backpack', 'Backpack'],
              ['equipment', 'Equipment'],
              ['inspect', 'Weapon Inspect'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mobileSection === key}
              data-testid={`mobile-tab-${key}`}
              onClick={() => setMobileSection(key)}
              className={`py-1.5 px-2 rounded-[5px] text-xs font-display font-bold tracking-wide uppercase cursor-pointer transition-colors ${
                mobileSection === key
                  ? 'bg-[#4f5a20]/95 border border-[#94ab38] text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Main 3-Column Tactical Grid */}
        <div className="flex-1 min-h-0 w-full grid grid-cols-1 lg:grid-cols-[384px_1fr_364px] gap-2.5 overflow-hidden">
          {/* LEFT COLUMN: EQUIPMENT + QUICK SLOTS */}
          <div
            className={`min-h-0 h-full ${
              mobileSection === 'equipment' ? 'block' : 'hidden lg:block'
            }`}
          >
            <EquipmentPanel
              player={player}
              activeDragSource={activeDragSource}
              onSelectInspectWeapon={(id) => {
                handleSelectInspectWeapon(id);
                setMobileSection('inspect');
              }}
              onSwapPrimarySecondary={handleSwapPrimarySecondary}
              onMoveWeaponToStorage={handleMoveWeaponToStorage}
              onStartDragEquippedWeapon={(slot, wep) =>
                setActiveDragSource({
                  kind: 'equipped_weapon',
                  weaponSlot: slot,
                  weaponInstanceId: wep.instanceId,
                  weaponId: wep.weaponId,
                })
              }
              onEndDrag={() => setActiveDragSource(null)}
              onDropOnTarget={handleDropOnTarget}
              onUseOrEquipSlot={handleUseOrEquipSlot}
              onCycleGearTier={handleCycleGearTier}
            />
          </div>

          {/* CENTER COLUMN: BACKPACK STORAGE + WEAPON RACK */}
          <div
            className={`min-h-0 h-full ${
              mobileSection === 'backpack' ? 'block' : 'hidden lg:block'
            }`}
          >
            <InventoryGrid
              sim={sim}
              activeDragSource={activeDragSource}
              onStartDragSource={setActiveDragSource}
              onEndDrag={() => setActiveDragSource(null)}
              onDropOnTarget={handleDropOnTarget}
              onUseOrEquipSlot={handleUseOrEquipSlot}
              onSplitSlotStack={handleSplitSlotStack}
              onDropSlotItem={handleDropSlotItem}
              onSelectInspectWeapon={(id) => {
                handleSelectInspectWeapon(id);
                setMobileSection('inspect');
              }}
              onEquipStoredWeapon={handleEquipStoredWeapon}
              onDropStoredWeapon={handleDropWeapon}
              onPickupWorldLoot={handlePickupWorldLoot}
              onSortBackpackSlots={handleSortBackpackSlots}
              onExpandCapacity={handleExpandCapacity}
              onMutateCommit={() => commitMutation(true)}
              onClose={onClose}
              onCycleGearTier={handleCycleGearTier}
            />
          </div>

          {/* RIGHT COLUMN: WEAPON INSPECTION + ATTACHMENTS + STATS */}
          <div
            className={`min-h-0 h-full ${
              mobileSection === 'inspect' ? 'block' : 'hidden lg:block'
            }`}
          >
            <WeaponInspectionPanel
              player={player}
              activeDragSource={activeDragSource}
              onStartDragAttachment={(slot, itemId) => {
                const targetId =
                  inv.inspectedWeaponInstanceId ||
                  inv.equippedWeapons.primary.instanceId;
                setActiveDragSource({
                  kind: 'installed_attachment',
                  weaponInstanceId: targetId,
                  attachmentSlot: slot,
                  itemId,
                });
              }}
              onEndDrag={() => setActiveDragSource(null)}
              onDropOnAttachmentSlot={handleDropOnTarget}
              onRemoveAttachment={handleRemoveAttachment}
              onEquipAttachmentFromSlot={handleEquipAttachmentFromSlot}
              onEquipStoredWeaponToSlot={handleEquipStoredWeapon}
              onMoveEquippedWeaponToStorage={handleMoveWeaponToStorage}
              onToggleWeaponFireMode={handleToggleWeaponFireMode}
              onClose={onClose}
              onDropWeapon={handleDropWeapon}
            />
          </div>
        </div>

        {/* Overlay Modal for MAP / MISSIONS / SETTINGS when top tab switched */}
        {topNavTab !== 'inventory' && (
          <div
            onClick={() => setTopNavTab('inventory')}
            className="absolute inset-3 z-[90] rounded-xl border border-white/20 bg-[#080d14]/88 backdrop-blur-md p-5 flex flex-col justify-between text-slate-200 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <h3 className="font-display font-bold text-base sm:text-lg uppercase tracking-wider text-white">
                {topNavTab === 'map'
                  ? 'TACTICAL SECTOR MAP & LOOT RADAR'
                  : topNavTab === 'missions'
                    ? 'ACTIVE FIELD DIRECTIVES & BOUNTIES'
                    : 'INVENTORY & OPTICS CONFIGURATION'}
              </h3>
              <button
                type="button"
                onClick={() => setTopNavTab('inventory')}
                className="px-3 py-1 rounded bg-[#4f5a20] text-white text-xs font-bold cursor-pointer"
              >
                Return to Inventory
              </button>
            </div>

            <div
              onClick={(e) => e.stopPropagation()}
              className="flex-1 flex flex-col items-center justify-center gap-4 text-center max-w-xl mx-auto w-full"
            >
              {topNavTab === 'map' && (
                <div className="w-full flex flex-col items-center gap-3">
                  <div className="w-full h-48 sm:h-56 rounded-lg border border-emerald-500/30 bg-[#0b1512]/80 relative overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 opacity-20 pointer-events-none">
                      {Array.from({ length: 24 }).map((_, i) => (
                        <div key={i} className="border border-emerald-400/40" />
                      ))}
                    </div>
                    <div className="relative z-10 flex flex-col items-center">
                      <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/30 animate-pulse" />
                      <span className="mt-1 text-[10px] font-mono text-emerald-300">
                        YOU ({Math.round(player.x)}, {Math.round(player.z)})
                      </span>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200">
                    Active Sector: FRACTURE Combat Arena · Nearby World Loot:{' '}
                    {sim.worldLoot?.length ?? 0} caches · Hostiles Active:{' '}
                    {sim.enemies.filter((b) => b.hp > 0).length}
                  </p>
                </div>
              )}
              {topNavTab === 'missions' && (
                <div className="flex flex-col gap-2.5 text-left w-full">
                  <div className="p-3 rounded border border-white/15 bg-[#0c121b]/70 flex justify-between items-center">
                    <div>
                      <div className="text-xs font-semibold text-white">
                        1. Equip Optic & Suppressor on Primary Rifle
                      </div>
                      <div className="text-[11px] text-slate-300">
                        Reward: +$1,200 Combat Credits
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-400">
                      COMPLETED
                    </span>
                  </div>
                  <div className="p-3 rounded border border-white/15 bg-[#0c121b]/70 flex justify-between items-center">
                    <div>
                      <div className="text-xs font-semibold text-white">
                        2. Eliminate 5 Arena Hostiles ({sim.player.kills} / 5)
                      </div>
                      <div className="text-[11px] text-slate-300">
                        Reward: +$2,500 Combat Credits & Level 3 Raid Pack
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-400">
                      IN PROGRESS
                    </span>
                  </div>
                </div>
              )}
              {topNavTab === 'settings' && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleExpandCapacity(16, 32)}
                    className={`px-4 py-2 rounded border text-xs font-semibold cursor-pointer ${
                      inv.maxSlots === 16
                        ? 'border-emerald-400 bg-emerald-500/25 text-white'
                        : 'border-white/20 bg-[#141a22]/80 text-slate-200'
                    }`}
                  >
                    Lv.1 Pack (16 Slots / 32 kg)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExpandCapacity(24, 45)}
                    className={`px-4 py-2 rounded border text-xs font-semibold cursor-pointer ${
                      inv.maxSlots === 24
                        ? 'border-emerald-400 bg-emerald-500/25 text-white'
                        : 'border-white/20 bg-[#141a22]/80 text-slate-200'
                    }`}
                  >
                    Lv.2 Pack (24 Slots / 45 kg)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExpandCapacity(32, 60)}
                    className={`px-4 py-2 rounded border text-xs font-semibold cursor-pointer ${
                      inv.maxSlots === 32
                        ? 'border-emerald-400 bg-emerald-500/25 text-white'
                        : 'border-white/20 bg-[#141a22]/80 text-slate-200'
                    }`}
                  >
                    Lv.3 Pack (32 Slots / 60 kg)
                  </button>
                </div>
              )}
            </div>

            <div className="text-center text-xs text-slate-400">
              Click anywhere outside or press Return to go back to Inventory
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
