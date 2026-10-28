import React from 'react';
import { WEAPON_REGISTRY } from '../../game/config.ts';
import type { PlayerShooterState } from '../../game/rules.ts';
import {
  computeEffectiveWeaponStats,
  type EquippedGearSlotId,
  type EquippedWeaponSlotId,
  getItemDefinition,
  type InventoryDragSource,
  type InventoryDropTarget,
  validateInventoryDropTarget,
  type WeaponInstanceState,
} from '../../game/inventory/index.ts';
import {
  BulletTrioIcon,
  CustomGearIcon,
  CustomItemSvg,
  OperatorPortrait,
  TacticalWeaponSvg,
} from './ReferenceArtwork.tsx';

export interface EquipmentPanelProps {
  player: PlayerShooterState;
  activeDragSource: InventoryDragSource | null;
  onSelectInspectWeapon: (weaponInstanceId: string) => void;
  onSwapPrimarySecondary: () => void;
  onMoveWeaponToStorage: (slot: EquippedWeaponSlotId) => void;
  onStartDragEquippedWeapon: (
    slot: EquippedWeaponSlotId,
    weapon: WeaponInstanceState
  ) => void;
  onEndDrag: () => void;
  onDropOnTarget: (target: InventoryDropTarget) => void;
  onUseOrEquipSlot?: (slotIndex: number) => void;
  onCycleGearTier?: (slot: EquippedGearSlotId) => void;
}

export const EquipmentPanel: React.FC<EquipmentPanelProps> = ({
  player,
  activeDragSource,
  onSelectInspectWeapon,
  onSwapPrimarySecondary,
  onMoveWeaponToStorage,
  onStartDragEquippedWeapon,
  onEndDrag,
  onDropOnTarget,
  onUseOrEquipSlot,
  onCycleGearTier,
}) => {
  const inv = player.inventory;

  const getGearTier = (slotId: EquippedGearSlotId): number => {
    const id = inv.equippedGear[slotId]?.itemId || '';
    if (id.endsWith('lv3')) return 3;
    if (id.endsWith('lv1')) return 1;
    return 2;
  };

  const renderGearSlot = (slotId: EquippedGearSlotId, label: string) => {
    const inst = inv.equippedGear[slotId];
    const def = inst ? getItemDefinition(inst.itemId) : null;
    const tier = getGearTier(slotId);

    let dropState: 'valid' | 'invalid' | null = null;
    if (activeDragSource && activeDragSource.kind === 'backpack_slot') {
      const check = validateInventoryDropTarget(player, activeDragSource, {
        kind: 'gear_slot',
        gearSlot: slotId,
      });
      dropState = check.valid ? 'valid' : 'invalid';
    }

    const borderClass =
      dropState === 'valid'
        ? 'border-emerald-400 bg-emerald-500/20'
        : dropState === 'invalid'
          ? 'border-rose-500/70 bg-rose-500/15'
          : tier >= 3
            ? 'border-amber-400/75 bg-[#0c121b]/50 hover:border-amber-300 hover:bg-[#121a27]/65'
            : 'border-white/15 bg-[#0c121b]/50 hover:border-white/30 hover:bg-[#121a27]/65';

    return (
      <div
        key={slotId}
        role="button"
        tabIndex={0}
        data-testid={`gear-slot-${slotId}`}
        data-item-id={def?.id || 'none'}
        title={`Click to cycle/equip ${label} tier`}
        onClick={() => {
          if (onCycleGearTier) onCycleGearTier(slotId);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onDropOnTarget({ kind: 'gear_slot', gearSlot: slotId });
        }}
        className={`h-[98px] sm:h-[116px] rounded-[5px] border p-2 sm:p-2.5 flex flex-col justify-between relative cursor-pointer transition-colors select-none ${borderClass}`}
      >
        <div className="flex items-center justify-between leading-none">
          <span className="text-[11px] sm:text-xs font-medium text-slate-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            {label}
          </span>
        </div>

        <div className="flex-1 min-h-0 flex items-center justify-center my-0.5 pointer-events-none">
          {def ? (
            <CustomGearIcon
              slot={slotId}
              tier={tier}
              className="w-[52px] h-[42px] sm:w-[60px] sm:h-[48px]"
            />
          ) : (
            <span className="text-[9px] font-mono text-slate-500">EMPTY</span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-slate-300 leading-none">
            <BulletTrioIcon className="w-2.5 h-2.5 opacity-85" />
            <span
              className={
                tier >= 3 ? 'text-amber-300 font-semibold' : 'text-slate-300'
              }
            >
              Lv.{tier}
            </span>
          </div>
          <div className="h-[3.5px] w-full rounded-full bg-slate-800/80 overflow-hidden">
            <div
              className={`h-full ${
                tier >= 3 ? 'w-full bg-amber-400' : 'w-4/5 bg-[#5cb85c]'
              }`}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderWeaponSlotCard = (
    slotId: EquippedWeaponSlotId,
    slotLabel: string,
    weapon: WeaponInstanceState | null
  ) => {
    const isInspected =
      weapon !== null && inv.inspectedWeaponInstanceId === weapon.instanceId;
    const isActiveInHands =
      weapon !== null && player.activeWeapon === weapon.weaponId;

    let dropState: 'valid' | 'invalid' | null = null;
    if (activeDragSource) {
      const check = validateInventoryDropTarget(player, activeDragSource, {
        kind: 'weapon_slot',
        weaponSlot: slotId,
      });
      if (
        activeDragSource.kind === 'stored_weapon' ||
        activeDragSource.kind === 'equipped_weapon'
      ) {
        dropState = check.valid ? 'valid' : 'invalid';
      }
    }

    const borderClass =
      dropState === 'valid'
        ? 'border-emerald-400 bg-emerald-500/20'
        : dropState === 'invalid'
          ? 'border-rose-500 bg-rose-500/20'
          : isInspected
            ? 'border-[#38bdf8] bg-[#101926]/65 shadow-[inset_0_0_12px_rgba(56,189,248,0.22)]'
            : 'border-white/15 bg-[#0c121b]/50 hover:border-white/30 hover:bg-[#121a27]/65';

    if (!weapon) {
      return (
        <div
          key={slotId}
          data-testid={`equipped-slot-${slotId}`}
          data-weapon-id="none"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onDropOnTarget({ kind: 'weapon_slot', weaponSlot: slotId });
          }}
          className={`h-[98px] sm:h-[116px] rounded-[5px] border p-2 sm:p-2.5 flex flex-col justify-between transition-colors ${borderClass}`}
        >
          <span className="text-[11px] sm:text-xs font-medium text-slate-200">
            {slotLabel}
          </span>
          <div className="my-auto text-center text-[10px] font-mono text-slate-400">
            Drop Weapon Here
          </div>
          <div className="h-[3px] w-full bg-slate-800/80 rounded-full" />
        </div>
      );
    }

    const spec = WEAPON_REGISTRY[weapon.weaponId];
    const effStats = computeEffectiveWeaponStats(
      weapon.weaponId,
      weapon.attachments
    );
    const ammo = player.weapons[weapon.weaponId];
    const magVal = ammo ? ammo.mag : effStats.magSize;
    const resVal = ammo ? ammo.reserve : effStats.reserveMax;

    return (
      <div
        key={slotId}
        draggable
        data-testid={`equipped-slot-${slotId}`}
        data-weapon-id={weapon.weaponId}
        data-weapon-instance-id={weapon.instanceId}
        onClick={() => onSelectInspectWeapon(weapon.instanceId)}
        onDragStart={() => onStartDragEquippedWeapon(slotId, weapon)}
        onDragEnd={onEndDrag}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onDropOnTarget({ kind: 'weapon_slot', weaponSlot: slotId });
        }}
        className={`group relative h-[98px] sm:h-[116px] rounded-[5px] border p-2 sm:p-2.5 flex flex-col justify-between transition-colors cursor-pointer select-none ${borderClass}`}
      >
        {/* Top Row: Slot Label + Weapon Short Name + Store Action */}
        <div className="flex items-center justify-between gap-1 leading-none">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[11px] sm:text-xs font-medium text-slate-100 truncate">
              {slotLabel}
            </span>
            <span className="text-[9px] sm:text-[10px] font-mono text-slate-300 truncate">
              · {spec.shortName}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isActiveInHands && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                title="Active Weapon"
              />
            )}
            <button
              type="button"
              data-testid={`store-weapon-${slotId}`}
              aria-label={`Move ${spec.name} to Storage`}
              onClick={(e) => {
                e.stopPropagation();
                onMoveWeaponToStorage(slotId);
              }}
              className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 px-1.5 py-0.5 rounded bg-white/15 hover:bg-white/25 text-[9px] font-mono text-slate-100 cursor-pointer transition-opacity"
            >
              Store
            </button>
          </div>
        </div>

        {/* Center Custom Vector Weapon Illustration with Dynamic Attachments */}
        <div className="flex-1 min-h-0 flex items-center justify-center my-0.5 pointer-events-none">
          <TacticalWeaponSvg
            weaponId={weapon.weaponId}
            attachments={weapon.attachments}
            className="w-[116px] h-[42px] sm:w-[140px] sm:h-[50px]"
          />
        </div>

        {/* Bottom Ammo & Green Readiness Bar */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-medium text-slate-100 leading-none tabular-nums">
            <div className="flex items-center gap-1">
              <BulletTrioIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span>
                {magVal} / {resVal}
              </span>
            </div>
            <span className="text-[8px] sm:text-[9px] font-mono text-slate-300 uppercase">
              {weapon.fireMode}
            </span>
          </div>
          <div className="h-[3.5px] w-full rounded-full bg-slate-800/80 overflow-hidden">
            <div
              className="h-full bg-[#5cb85c]"
              style={{
                width: `${Math.min(100, Math.max(15, Math.round((magVal / Math.max(1, effStats.magSize)) * 100)))}%`,
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  // Find backpack slot indices for Quick Slots 3..6 (Frag Grenade, Med Kit, Energy Drink, Smoke Grenade)
  const findSlotIdx = (itemId: string) =>
    inv.slots.findIndex((s) => s?.itemId === itemId);

  const quickSlots = [
    {
      num: 1,
      label: inv.equippedWeapons.primary
        ? WEAPON_REGISTRY[inv.equippedWeapons.primary.weaponId].shortName
        : 'Primary',
      weaponId: inv.equippedWeapons.primary?.weaponId || 'm4a1',
      itemId: null as string | null,
      count:
        player.weapons[inv.equippedWeapons.primary?.weaponId || 'm4a1']?.mag ??
        30,
      isWeapon: true,
      onClick: () => {
        if (inv.equippedWeapons.primary) {
          onSelectInspectWeapon(inv.equippedWeapons.primary.instanceId);
        }
      },
    },
    {
      num: 2,
      label: inv.equippedWeapons.sidearm
        ? WEAPON_REGISTRY[inv.equippedWeapons.sidearm.weaponId].shortName
        : inv.equippedWeapons.secondary
          ? WEAPON_REGISTRY[inv.equippedWeapons.secondary.weaponId].shortName
          : 'Sidearm',
      weaponId:
        inv.equippedWeapons.sidearm?.weaponId ||
        inv.equippedWeapons.secondary?.weaponId ||
        'deagle',
      itemId: null as string | null,
      count:
        player.weapons[
          inv.equippedWeapons.sidearm?.weaponId ||
            inv.equippedWeapons.secondary?.weaponId ||
            'deagle'
        ]?.mag ?? 9,
      isWeapon: true,
      onClick: () => {
        const target =
          inv.equippedWeapons.sidearm || inv.equippedWeapons.secondary;
        if (target) {
          onSelectInspectWeapon(target.instanceId);
        }
      },
    },
    {
      num: 3,
      label: 'Frag Grenade',
      weaponId: null,
      itemId: 'tac_frag_grenade',
      count: inv.slots[findSlotIdx('tac_frag_grenade')]?.quantity ?? 0,
      isWeapon: false,
      onClick: () => {
        const idx = findSlotIdx('tac_frag_grenade');
        if (idx >= 0 && onUseOrEquipSlot) onUseOrEquipSlot(idx);
      },
    },
    {
      num: 4,
      label: 'Med Kit',
      weaponId: null,
      itemId: 'med_ifak',
      count: inv.slots[findSlotIdx('med_ifak')]?.quantity ?? 0,
      isWeapon: false,
      onClick: () => {
        const idx = findSlotIdx('med_ifak');
        if (idx >= 0 && onUseOrEquipSlot) onUseOrEquipSlot(idx);
      },
    },
    {
      num: 5,
      label: 'Energy Drink',
      weaponId: null,
      itemId: 'con_energy_drink',
      count: inv.slots[findSlotIdx('con_energy_drink')]?.quantity ?? 0,
      isWeapon: false,
      onClick: () => {
        const idx = findSlotIdx('con_energy_drink');
        if (idx >= 0 && onUseOrEquipSlot) onUseOrEquipSlot(idx);
      },
    },
    {
      num: 6,
      label: 'Smoke Grenade',
      weaponId: null,
      itemId: 'tac_smoke_grenade',
      count: inv.slots[findSlotIdx('tac_smoke_grenade')]?.quantity ?? 0,
      isWeapon: false,
      onClick: () => {
        const idx = findSlotIdx('tac_smoke_grenade');
        if (idx >= 0 && onUseOrEquipSlot) onUseOrEquipSlot(idx);
      },
    },
  ];

  const hpPct = Math.min(
    100,
    Math.max(0, Math.round((player.hp / Math.max(1, player.maxHp)) * 100))
  );
  const armorPct =
    inv.maxArmorHp > 0
      ? Math.min(
          100,
          Math.max(0, Math.round((inv.armorHp / inv.maxArmorHp) * 100))
        )
      : 0;

  return (
    <section
      aria-label="Operator Equipment & Quick Slots"
      className="flex flex-col gap-2.5 h-full min-h-0 select-none overflow-y-auto pr-0.5"
    >
      {/* 1. EQUIPMENT PANEL */}
      <div className="rounded-lg border border-white/15 bg-[#070b12]/32 backdrop-blur-sm p-2.5 sm:p-3.5 flex flex-col justify-between gap-2.5 flex-1 min-h-0">
        <div className="flex items-center justify-between leading-none">
          <h3 className="font-display font-bold text-sm sm:text-[15px] tracking-wider text-slate-100 uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            EQUIPMENT
          </h3>
          <button
            type="button"
            data-testid="swap-primary-secondary-btn"
            onClick={onSwapPrimarySecondary}
            className="px-2 py-1 rounded-[4px] border border-white/20 bg-[#0e1520]/65 hover:bg-[#1a2433]/80 text-[10px] font-mono text-slate-200 hover:text-white cursor-pointer transition-colors"
          >
            ⇄ Swap 1↔2
          </button>
        </div>

        {/* 3-Subcolumn Body: Left Gear Slots | Center Custom Operator Figure | Right Weapon Slots */}
        <div className="flex-1 min-h-0 grid grid-cols-[84px_1fr_138px] sm:grid-cols-[92px_1fr_160px] gap-1.5 sm:gap-2 items-center">
          {/* Left Subcolumn: Helmet, Armor, Backpack */}
          <div className="flex flex-col gap-2 justify-center">
            {renderGearSlot('helmet', 'Helmet')}
            {renderGearSlot('armor', 'Armor')}
            {renderGearSlot('backpack', 'Backpack')}
          </div>

          {/* Center Subcolumn: Custom Full-Body Tactical Operator */}
          <div className="h-[304px] sm:h-[364px] flex items-center justify-center overflow-hidden">
            <OperatorPortrait
              className="w-full h-full"
              helmetTier={getGearTier('helmet')}
              armorTier={getGearTier('armor')}
              primaryWeaponId={inv.equippedWeapons.primary?.weaponId}
            />
          </div>

          {/* Right Subcolumn: Primary, Secondary, Sidearm */}
          <div className="flex flex-col gap-2 justify-center">
            {renderWeaponSlotCard(
              'primary',
              'Primary',
              inv.equippedWeapons.primary
            )}
            {renderWeaponSlotCard(
              'secondary',
              'Secondary',
              inv.equippedWeapons.secondary
            )}
            {renderWeaponSlotCard(
              'sidearm',
              'Sidearm',
              inv.equippedWeapons.sidearm
            )}
          </div>
        </div>

        {/* Bottom Health & Armor Boxes */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          {/* Health Card */}
          <div className="rounded-[5px] border border-white/15 bg-[#0c121b]/42 px-2.5 py-2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <svg
                  viewBox="0 0 20 20"
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#5cb85c] shrink-0"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                </svg>
                <span className="text-xs text-slate-200">Health</span>
              </div>
              <strong
                data-testid="inventory-hp-text"
                className="text-xs sm:text-sm font-bold text-white tabular-nums"
              >
                {Math.round(player.hp)}
              </strong>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800/80 overflow-hidden">
              <div
                className="h-full bg-[#5cb85c] rounded-full transition-all"
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>

          {/* Armor Card */}
          <div className="rounded-[5px] border border-white/15 bg-[#0c121b]/42 px-2.5 py-2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <svg
                  viewBox="0 0 20 20"
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#3b82f6] shrink-0"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M10 2L3 5v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V5l-7-3z" />
                </svg>
                <span className="text-xs text-slate-200">Armor</span>
              </div>
              <strong
                data-testid="inventory-armor-text"
                className="text-xs sm:text-sm font-bold text-white tabular-nums"
              >
                {Math.round(inv.armorHp)}
              </strong>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800/80 overflow-hidden">
              <div
                className="h-full bg-[#3b82f6] rounded-full transition-all"
                style={{ width: `${armorPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. QUICK SLOTS PANEL */}
      <div className="rounded-lg border border-white/15 bg-[#070b12]/32 backdrop-blur-sm p-2.5 sm:p-3 flex flex-col gap-2 shrink-0">
        <h3 className="font-display font-bold text-xs sm:text-sm tracking-wider text-slate-100 uppercase leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          QUICK SLOTS
        </h3>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {quickSlots.map((qs) => (
            <button
              key={qs.num}
              type="button"
              onClick={qs.onClick}
              title={`Quick Slot ${qs.num}: ${qs.label}`}
              className="relative h-[74px] sm:h-[82px] rounded-[5px] border border-white/15 bg-[#0c121b]/50 hover:border-white/30 hover:bg-[#121a27]/65 p-1.5 flex flex-col justify-between items-center cursor-pointer transition-colors"
            >
              {/* Top-left white number badge */}
              <span className="self-start px-1 py-0.2 rounded-[2px] bg-slate-200 text-slate-950 font-mono font-bold text-[9px] leading-tight">
                {qs.num}
              </span>

              {/* Center Custom Vector Artwork */}
              <div className="flex-1 min-h-0 w-full flex items-center justify-center my-0.5 pointer-events-none">
                {qs.isWeapon && qs.weaponId ? (
                  <TacticalWeaponSvg
                    weaponId={qs.weaponId}
                    className="w-full h-[30px] sm:h-[34px]"
                  />
                ) : (
                  <CustomItemSvg
                    itemId={qs.itemId || 'med_ifak'}
                    className="w-[34px] h-[30px] sm:w-[38px] sm:h-[34px]"
                  />
                )}
              </div>

              {/* Bottom Count + Readiness Bar */}
              <div className="w-full flex flex-col gap-0.5">
                <div className="w-full flex items-center justify-between text-[10px] text-slate-100 tabular-nums leading-none">
                  {qs.isWeapon ? (
                    <BulletTrioIcon className="w-2.5 h-2.5 opacity-85" />
                  ) : (
                    <span />
                  )}
                  <span className="font-semibold">{qs.count}</span>
                </div>
                {qs.isWeapon && (
                  <div className="h-[2.5px] w-full rounded-full bg-slate-800/80 overflow-hidden">
                    <div className="h-full w-4/5 bg-[#5cb85c]" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
