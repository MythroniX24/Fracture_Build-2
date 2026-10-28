import React, { useState } from 'react';
import { WEAPON_REGISTRY } from '../../game/config.ts';
import type { PlayerShooterState } from '../../game/rules.ts';
import {
  type AttachmentSlotType,
  computeEffectiveWeaponStats,
  type EquippedWeaponSlotId,
  findWeaponInstanceById,
  getItemDefinition,
  type InventoryDragSource,
  type InventoryDropTarget,
  isAttachmentCompatibleWithWeapon,
  WEAPON_AMMO_MAP,
  type WeaponFireMode,
} from '../../game/inventory/index.ts';
import { AttachmentSlots } from './AttachmentSlots.tsx';
import { BulletTrioIcon, TacticalWeaponSvg } from './ReferenceArtwork.tsx';

export interface WeaponInspectionPanelProps {
  player: PlayerShooterState;
  activeDragSource: InventoryDragSource | null;
  onStartDragAttachment: (slot: AttachmentSlotType, itemId: string) => void;
  onEndDrag: () => void;
  onDropOnAttachmentSlot: (target: InventoryDropTarget) => void;
  onRemoveAttachment: (slot: AttachmentSlotType) => void;
  onEquipAttachmentFromSlot: (backpackSlotIndex: number) => void;
  onEquipStoredWeaponToSlot: (
    weaponInstanceId: string,
    targetSlot: EquippedWeaponSlotId
  ) => void;
  onMoveEquippedWeaponToStorage: (slot: EquippedWeaponSlotId) => void;
  onToggleWeaponFireMode: (
    weaponInstanceId: string,
    nextMode: WeaponFireMode
  ) => void;
  onClose?: () => void;
  onDropWeapon?: (weaponInstanceId: string) => void;
}

export const WeaponInspectionPanel: React.FC<WeaponInspectionPanelProps> = ({
  player,
  activeDragSource,
  onStartDragAttachment,
  onEndDrag,
  onDropOnAttachmentSlot,
  onRemoveAttachment,
  onEquipAttachmentFromSlot,
  onEquipStoredWeaponToSlot,
  onMoveEquippedWeaponToStorage,
  onToggleWeaponFireMode,
  onClose,
  onDropWeapon,
}) => {
  const [inspectZoomed, setInspectZoomed] = useState(false);

  const inv = player.inventory;
  const targetId =
    inv.inspectedWeaponInstanceId || inv.equippedWeapons.primary.instanceId;
  const found =
    findWeaponInstanceById(inv, targetId) || {
      weapon: inv.equippedWeapons.primary,
      location: 'primary' as const,
      storedIndex: -1,
    };

  const weapon = found.weapon;
  const baseSpec = WEAPON_REGISTRY[weapon.weaponId];
  const effStats = computeEffectiveWeaponStats(
    weapon.weaponId,
    weapon.attachments
  );
  const ammo = player.weapons[weapon.weaponId];
  const ammoDef = getItemDefinition(WEAPON_AMMO_MAP[weapon.weaponId]);

  // Compatible attachments currently inside the player's backpack
  const compatibleBackpackAttachments: {
    slotIndex: number;
    itemId: string;
    name: string;
    shortName: string;
    attachmentSlot: AttachmentSlotType;
  }[] = [];

  for (let i = 0; i < inv.maxSlots; i++) {
    const slot = inv.slots[i];
    if (!slot) continue;
    const def = getItemDefinition(slot.itemId);
    if (!def || def.category !== 'attachment' || !def.attachmentSlot) continue;
    const check = isAttachmentCompatibleWithWeapon(def.id, weapon.weaponId);
    if (check.compatible && weapon.attachments[def.attachmentSlot] !== def.id) {
      compatibleBackpackAttachments.push({
        slotIndex: i,
        itemId: def.id,
        name: def.name,
        shortName: def.shortName,
        attachmentSlot: def.attachmentSlot,
      });
    }
  }

  const handleQuickInstallForSlot = (slotType: AttachmentSlotType) => {
    const match = compatibleBackpackAttachments.find(
      (a) => a.attachmentSlot === slotType
    );
    if (match) {
      onEquipAttachmentFromSlot(match.slotIndex);
    }
  };

  // Dynamic stats computed from base weapon + installed attachments
  const accuracyScore = Math.round(
    Math.max(25, Math.min(98, 92 - effStats.adsSpreadDeg * 16))
  );
  const recoilScore = Math.round(
    Math.max(15, Math.min(95, effStats.recoilPitchDeg * 28))
  );

  const statRows = [
    {
      label: 'Damage',
      displayValue: `${Math.round(effStats.damage)}`,
      ratio: Math.min(1, effStats.damage / 110),
    },
    {
      label: 'Fire Rate',
      displayValue: `${Math.round(effStats.rpm)}`,
      ratio: Math.min(1, effStats.rpm / 950),
    },
    {
      label: 'Accuracy',
      displayValue: `${accuracyScore}`,
      ratio: accuracyScore / 100,
    },
    {
      label: 'Recoil',
      displayValue: `${recoilScore}`,
      ratio: recoilScore / 100,
    },
    {
      label: 'Reload Time',
      displayValue: `${(effStats.reloadTimeMs / 1000).toFixed(1)}s`,
      ratio: Math.min(1, Math.max(0.18, effStats.reloadTimeMs / 4000)),
    },
    {
      label: 'Effective Range',
      displayValue: `${Math.round(effStats.maxRange * 6)}m`,
      ratio: Math.min(1, (effStats.maxRange * 6) / 900),
    },
  ];

  const magVal = ammo ? ammo.mag : effStats.magSize;
  const resVal = ammo ? ammo.reserve : effStats.reserveMax;

  return (
    <section
      aria-label="Detailed Weapon Inspection"
      data-testid="weapon-inspection-panel"
      data-inspected-weapon={weapon.weaponId}
      className="rounded-lg border border-white/15 bg-[#070b12]/32 backdrop-blur-sm p-2.5 sm:p-3 flex flex-col justify-between gap-1.5 sm:gap-2 h-full min-h-0 select-none overflow-y-auto"
    >
      {/* Top Panel Title Bar */}
      <div className="flex items-center justify-between border-b border-white/15 pb-1.5 shrink-0">
        <h3 className="font-display font-bold text-sm sm:text-[15px] tracking-wider text-slate-100 uppercase leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          WEAPON INSPECTION
        </h3>
        <button
          type="button"
          aria-label="Close Weapon Inspection"
          onClick={() => {
            if (onClose) onClose();
          }}
          className="text-slate-300 hover:text-white text-sm leading-none px-1 cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Weapon Name, Subtitle, Equipped Badge & Hero Artwork */}
      <div className="flex flex-col gap-1.5 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4
              data-testid="inspected-weapon-name"
              className="font-display font-bold text-base sm:text-lg text-white leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
            >
              {baseSpec.shortName}
            </h4>
            <div className="flex items-center gap-2 text-[11px] text-slate-300 mt-0.5">
              <span>{baseSpec.category}</span>
              <span aria-hidden="true">|</span>
              <span>{ammoDef?.shortName || '5.56mm'}</span>
            </div>
          </div>

          {found.location === 'stored' ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="inspect-equip-primary"
                onClick={() =>
                  onEquipStoredWeaponToSlot(weapon.instanceId, 'primary')
                }
                className="px-2.5 py-1 rounded-[4px] border border-[#388e3c] bg-[#142918]/80 hover:bg-[#1b3720] text-[#66bb6a] text-xs font-medium cursor-pointer"
              >
                Equip Primary
              </button>
              <button
                type="button"
                data-testid="inspect-equip-secondary"
                onClick={() =>
                  onEquipStoredWeaponToSlot(weapon.instanceId, 'secondary')
                }
                className="px-2 py-1 rounded-[4px] border border-white/20 bg-[#141b23]/70 hover:bg-[#1c2631] text-slate-200 text-xs font-medium cursor-pointer"
              >
                Slot 2
              </button>
            </div>
          ) : (
            <span className="px-2.5 py-1 rounded-[4px] border border-[#388e3c] bg-[#142918]/75 text-[#66bb6a] text-xs font-medium leading-none">
              Equipped ({found.location})
            </span>
          )}
        </div>

        {/* Large Custom Side-Profile Vector Weapon Illustration with Live Attachments */}
        <div
          onClick={() => setInspectZoomed((z) => !z)}
          title="Click to toggle detailed ballistics schematic zoom"
          className={`relative rounded-[5px] border border-white/15 bg-[#0c121b]/40 flex items-center justify-center cursor-pointer overflow-hidden transition-all ${
            inspectZoomed ? 'h-[108px] border-sky-400/60' : 'h-[86px]'
          }`}
        >
          <TacticalWeaponSvg
            weaponId={weapon.weaponId}
            attachments={weapon.attachments}
            className={`transition-transform duration-200 ${
              inspectZoomed
                ? 'w-full h-[96px] scale-110'
                : 'w-full h-[76px]'
            }`}
          />
          {inspectZoomed && (
            <div className="absolute inset-x-2 bottom-1 flex items-center justify-between text-[10px] font-mono text-sky-300 bg-slate-950/80 px-2 py-0.5 rounded">
              <span>HS ×{baseSpec.headshotMultiplier.toFixed(1)}</span>
              <span>Pellets: {baseSpec.pellets}</span>
              <span>Move: {Math.round(effStats.moveSpeedMultiplier * 100)}%</span>
            </div>
          )}
        </div>

        {/* Magazine / Reserve Readout & Green Readiness Bar */}
        <div className="flex flex-col gap-1 pb-1.5 border-b border-white/15">
          <div className="flex items-center justify-between text-xs sm:text-sm text-slate-200 tabular-nums">
            <div className="flex items-center gap-2">
              <BulletTrioIcon className="w-3.5 h-3.5" />
              <span data-testid="inspected-weapon-ammo">
                <strong className="text-white font-bold text-sm">
                  {magVal}
                </strong>{' '}
                <span className="text-xs text-slate-300">/ {resVal}</span>
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-300">
              Max Mag: {effStats.magSize}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-800/80 overflow-hidden">
            <div
              className="h-full bg-[#5cb85c] rounded-full transition-all"
              style={{
                width: `${Math.min(100, Math.max(15, Math.round((magVal / Math.max(1, effStats.magSize)) * 100)))}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* ATTACHMENTS (3 + 2 Grid) */}
      <div className="flex flex-col gap-1 shrink-0">
        <AttachmentSlots
          weapon={weapon}
          activeDragSource={activeDragSource}
          onStartDragAttachment={onStartDragAttachment}
          onEndDrag={onEndDrag}
          onDropOnAttachmentSlot={onDropOnAttachmentSlot}
          onRemoveAttachment={onRemoveAttachment}
          onQuickInstallSlot={handleQuickInstallForSlot}
        />

        {/* Quick-Attach Compatible Backpack Attachments Bar */}
        {compatibleBackpackAttachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            <span className="text-[10px] font-mono text-slate-300 mr-1">
              In Bag:
            </span>
            {compatibleBackpackAttachments.map((att) => (
              <button
                key={`${att.slotIndex}_${att.itemId}`}
                type="button"
                data-testid={`quick-attach-${att.itemId}`}
                onClick={() => onEquipAttachmentFromSlot(att.slotIndex)}
                className="px-1.5 py-0.5 rounded border border-sky-400/50 bg-sky-500/15 hover:bg-sky-500/30 text-[10px] font-medium text-sky-200 cursor-pointer transition-colors"
              >
                + {att.shortName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* STATS (6 Progress Bar Rows) */}
      <div className="flex flex-col gap-1 pt-1 border-t border-white/15 shrink-0">
        <h4 className="font-display font-bold text-xs tracking-wider text-slate-100 uppercase">
          STATS
        </h4>

        <div className="flex flex-col gap-1">
          {statRows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[96px_1fr_38px] items-center gap-2 text-[11px] sm:text-xs"
            >
              <span className="text-slate-200 truncate">{row.label}</span>
              <div className="h-[4.5px] w-full rounded-full bg-slate-800/80 overflow-hidden">
                <div
                  className="h-full bg-slate-200 rounded-full transition-all"
                  style={{ width: `${Math.round(row.ratio * 100)}%` }}
                />
              </div>
              <span className="text-right font-medium text-slate-100 tabular-nums">
                {row.displayValue}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* FIRE MODE ROW */}
      <div className="flex items-center gap-3 pt-1 border-t border-white/15 shrink-0">
        <span className="font-display font-bold text-xs tracking-wider text-slate-200 uppercase">
          FIRE MODE
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="fire-mode-auto"
            onClick={() => onToggleWeaponFireMode(weapon.instanceId, 'auto')}
            className={`px-2.5 py-0.5 rounded-[4px] border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
              weapon.fireMode === 'auto'
                ? 'border-white/30 bg-[#1e293b]/80 text-white'
                : 'border-transparent bg-transparent text-slate-300 hover:text-white'
            }`}
          >
            <BulletTrioIcon className="w-3 h-3" />
            <span>Auto</span>
          </button>

          <button
            type="button"
            data-testid="fire-mode-semi"
            onClick={() => onToggleWeaponFireMode(weapon.instanceId, 'semi')}
            className={`px-2.5 py-0.5 rounded-[4px] border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
              weapon.fireMode === 'semi'
                ? 'border-white/30 bg-[#1e293b]/80 text-white'
                : 'border-transparent bg-transparent text-slate-300 hover:text-white'
            }`}
          >
            <span className="font-mono text-xs leading-none">+</span>
            <span>Single</span>
          </button>
        </div>
      </div>

      {/* BOTTOM 3 ACTION BUTTONS: Unequip/Equip | Drop | Inspect */}
      <div className="grid grid-cols-3 gap-2 pt-0.5 shrink-0">
        <button
          type="button"
          data-testid="inspect-store-weapon"
          onClick={() => {
            if (found.location !== 'stored') {
              onMoveEquippedWeaponToStorage(
                found.location as EquippedWeaponSlotId
              );
            } else {
              onEquipStoredWeaponToSlot(weapon.instanceId, 'primary');
            }
          }}
          className={`py-1.5 rounded-[5px] border text-xs font-semibold cursor-pointer transition-colors ${
            found.location === 'stored'
              ? 'border-[#388e3c] bg-[#142918]/80 hover:bg-[#1b3720] text-[#66bb6a]'
              : 'border-white/20 bg-[#16202c]/70 hover:bg-[#1f2d3d] text-slate-100'
          }`}
        >
          {found.location === 'stored' ? 'Equip' : 'Unequip'}
        </button>

        <button
          type="button"
          data-testid="inspect-drop-weapon"
          onClick={() => {
            if (onDropWeapon) onDropWeapon(weapon.instanceId);
          }}
          className="py-1.5 rounded-[5px] border border-[#803135] bg-[#5c2326]/80 hover:bg-[#702a2e] text-rose-100 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <svg
            viewBox="0 0 16 16"
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M3 4h10M6 4V2.5h4V4M5 4v9h6V4" />
          </svg>
          <span>Drop</span>
        </button>

        <button
          type="button"
          data-testid="inspect-zoom-weapon"
          onClick={() => {
            setInspectZoomed((z) => !z);
            if (compatibleBackpackAttachments.length > 0 && !inspectZoomed) {
              onEquipAttachmentFromSlot(
                compatibleBackpackAttachments[0].slotIndex
              );
            }
          }}
          className={`py-1.5 rounded-[5px] border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
            inspectZoomed
              ? 'border-sky-400 bg-sky-600/85 text-white'
              : 'border-[#2563eb] bg-[#1d4ed8]/80 hover:bg-[#2563eb] text-white'
          }`}
        >
          <svg
            viewBox="0 0 16 16"
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>
          <span>{inspectZoomed ? 'Zoomed' : 'Inspect'}</span>
        </button>
      </div>
    </section>
  );
};
