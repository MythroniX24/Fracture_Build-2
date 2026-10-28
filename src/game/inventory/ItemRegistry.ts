import { WEAPON_REGISTRY, type WeaponId } from '../config.ts';
import type {
  AmmoCaliberId,
  AttachmentSlotType,
  ItemCategory,
  ItemDefinition,
  ItemRarity,
} from './InventoryTypes.ts';

export const WEAPON_AMMO_MAP: Record<WeaponId, AmmoCaliberId> = {
  m4a1: 'ammo_556',
  ak47: 'ammo_762',
  mp5: 'ammo_9mm',
  spas12: 'ammo_12g',
  awp: 'ammo_338',
  deagle: 'ammo_50ae',
};

export const WEAPON_ITEM_ID_MAP: Record<WeaponId, string> = {
  m4a1: 'wpn_m4a1',
  ak47: 'wpn_ak47',
  mp5: 'wpn_mp5',
  spas12: 'wpn_spas12',
  awp: 'wpn_awp',
  deagle: 'wpn_deagle',
};

export const ITEM_REGISTRY: Record<string, ItemDefinition> = {
  // ==========================================================================
  // 1. WEAPONS (Mapped 1:1 with WEAPON_REGISTRY)
  // ==========================================================================
  wpn_m4a1: {
    id: 'wpn_m4a1',
    name: WEAPON_REGISTRY.m4a1.name,
    shortName: WEAPON_REGISTRY.m4a1.shortName,
    description:
      'Modular 5.56×45mm NATO carbine with balanced cyclic rate, low vertical climb, and full 5-rail attachment support.',
    category: 'weapon',
    rarity: 'rare',
    weightKg: 3.1,
    maxStack: 1,
    equippable: true,
    iconKey: 'wpn_m4a1',
    weaponId: 'm4a1',
    ammoType: 'ammo_556',
  },
  wpn_ak47: {
    id: 'wpn_ak47',
    name: WEAPON_REGISTRY.ak47.name,
    shortName: WEAPON_REGISTRY.ak47.shortName,
    description:
      'Heavy-hitting 7.62×39mm assault rifle delivering high per-shot stopping power and armor penetration.',
    category: 'weapon',
    rarity: 'rare',
    weightKg: 3.8,
    maxStack: 1,
    equippable: true,
    iconKey: 'wpn_ak47',
    weaponId: 'ak47',
    ammoType: 'ammo_762',
  },
  wpn_mp5: {
    id: 'wpn_mp5',
    name: WEAPON_REGISTRY.mp5.name,
    shortName: WEAPON_REGISTRY.mp5.shortName,
    description:
      'Compact roller-delayed 9×19mm submachine gun engineered for close-quarters mobility and rapid target transitions.',
    category: 'weapon',
    rarity: 'uncommon',
    weightKg: 2.5,
    maxStack: 1,
    equippable: true,
    iconKey: 'wpn_mp5',
    weaponId: 'mp5',
    ammoType: 'ammo_9mm',
  },
  wpn_spas12: {
    id: 'wpn_spas12',
    name: WEAPON_REGISTRY.spas12.name,
    shortName: WEAPON_REGISTRY.spas12.shortName,
    description:
      'Dual-mode 12-gauge combat shotgun firing 8 high-velocity buckshot pellets for devastating point-blank breaches.',
    category: 'weapon',
    rarity: 'rare',
    weightKg: 4.1,
    maxStack: 1,
    equippable: true,
    iconKey: 'wpn_spas12',
    weaponId: 'spas12',
    ammoType: 'ammo_12g',
  },
  wpn_awp: {
    id: 'wpn_awp',
    name: WEAPON_REGISTRY.awp.name,
    shortName: WEAPON_REGISTRY.awp.shortName,
    description:
      'Precision bolt-action .338 Lapua Magnum sniper platform built for long-range one-shot neutralization.',
    category: 'weapon',
    rarity: 'legendary',
    weightKg: 6.0,
    maxStack: 1,
    equippable: true,
    iconKey: 'wpn_awp',
    weaponId: 'awp',
    ammoType: 'ammo_338',
  },
  wpn_deagle: {
    id: 'wpn_deagle',
    name: WEAPON_REGISTRY.deagle.name,
    shortName: WEAPON_REGISTRY.deagle.shortName,
    description:
      'Gas-operated .50 Action Express heavy sidearm with high-caliber stopping power and fast draw speed.',
    category: 'weapon',
    rarity: 'epic',
    weightKg: 2.0,
    maxStack: 1,
    equippable: true,
    iconKey: 'wpn_deagle',
    weaponId: 'deagle',
    ammoType: 'ammo_50ae',
  },

  // ==========================================================================
  // 2. WEAPON ATTACHMENTS — OPTICS (Integrated with Universal ADS System)
  // ==========================================================================
  att_optic_red_dot: {
    id: 'att_optic_red_dot',
    name: '1.25× Micro Red Dot',
    shortName: 'Red Dot',
    description:
      'Parallax-free 1.25× illuminated red dot reflex sight for rapid close-quarters sight acquisition.',
    category: 'attachment',
    rarity: 'rare',
    weightKg: 0.18,
    maxStack: 1,
    equippable: true,
    iconKey: 'att_optic_red_dot',
    attachmentSlot: 'optic',
    opticId: 'red_dot',
    compatibleWeapons: ['m4a1', 'ak47', 'mp5', 'spas12', 'deagle'],
    statModifiers: {
      adsSpreadMultiplier: 0.9,
    },
  },
  att_optic_holo: {
    id: 'att_optic_holo',
    name: '1.35× Holographic Sight',
    shortName: 'Holo Sight',
    description:
      'Wide-window holographic weapon sight with circle-dot reticle for fast target tracking under recoil.',
    category: 'attachment',
    rarity: 'rare',
    weightKg: 0.28,
    maxStack: 1,
    equippable: true,
    iconKey: 'att_optic_holo',
    attachmentSlot: 'optic',
    opticId: 'holo',
    compatibleWeapons: ['m4a1', 'ak47', 'mp5', 'spas12'],
    statModifiers: {
      adsSpreadMultiplier: 0.86,
      recoilPitchMultiplier: 0.96,
    },
  },
  att_optic_2x: {
    id: 'att_optic_2x',
    name: '2x Scope',
    shortName: '2x Scope',
    description:
      '2.0× prism combat scope with illuminated emerald circle-chevron reticle and crisp mid-range magnification.',
    category: 'attachment',
    rarity: 'epic',
    weightKg: 0.35,
    maxStack: 1,
    equippable: true,
    iconKey: 'att_optic_2x',
    attachmentSlot: 'optic',
    opticId: 'scope_2x',
    compatibleWeapons: ['m4a1', 'ak47', 'mp5', 'spas12', 'awp', 'deagle'],
    statModifiers: {
      adsSpreadMultiplier: 0.78,
      maxRangeMultiplier: 1.08,
    },
  },
  att_optic_4x: {
    id: 'att_optic_4x',
    name: '4.0× ACOG Marksman Scope',
    shortName: '4x ACOG',
    description:
      '4.0× dual-illuminated marksman optic with mil-dot BDC stadia lines for mid-to-long-range precision.',
    category: 'attachment',
    rarity: 'epic',
    weightKg: 0.48,
    maxStack: 1,
    equippable: true,
    iconKey: 'att_optic_4x',
    attachmentSlot: 'optic',
    opticId: 'scope_4x',
    compatibleWeapons: ['m4a1', 'ak47', 'mp5', 'spas12', 'awp', 'deagle'],
    statModifiers: {
      adsSpreadMultiplier: 0.65,
      maxRangeMultiplier: 1.16,
    },
  },
  att_optic_8x: {
    id: 'att_optic_8x',
    name: '8.0× Long-Range Sniper Scope',
    shortName: '8x Scope',
    description:
      'High-magnification 8.0× first-focal-plane telescopic sight restricted to long-barreled rifle platforms.',
    category: 'attachment',
    rarity: 'legendary',
    weightKg: 0.72,
    maxStack: 1,
    equippable: true,
    iconKey: 'att_optic_8x',
    attachmentSlot: 'optic',
    opticId: 'scope_8x',
    compatibleWeapons: ['awp', 'm4a1', 'ak47'],
    statModifiers: {
      adsSpreadMultiplier: 0.5,
      maxRangeMultiplier: 1.25,
    },
  },

  // ==========================================================================
  // 3. WEAPON ATTACHMENTS — MUZZLE
  // ==========================================================================
  att_muzzle_suppressor: {
    id: 'att_muzzle_suppressor',
    name: 'Suppressor',
    shortName: 'Suppressor',
    description:
      'Baffled sound and flash suppressor that tightens ballistic dispersion and dampens horizontal muzzle drift.',
    category: 'attachment',
    rarity: 'rare',
    weightKg: 0.42,
    maxStack: 1,
    equippable: true,
    iconKey: 'att_muzzle_suppressor',
    attachmentSlot: 'muzzle',
    compatibleWeapons: ['m4a1', 'ak47', 'mp5', 'awp', 'deagle'],
    statModifiers: {
      hipSpreadMultiplier: 0.92,
      adsSpreadMultiplier: 0.9,
      recoilYawMultiplier: 0.86,
      maxRangeMultiplier: 1.05,
    },
  },
  att_muzzle_compensator: {
    id: 'att_muzzle_compensator',
    name: 'Multi-Port Recoil Compensator',
    shortName: 'Compensator',
    description:
      'Vented muzzle brake & compensator that vents propellant gases upward to sharply cut vertical and horizontal recoil.',
    category: 'attachment',
    rarity: 'rare',
    weightKg: 0.3,
    maxStack: 1,
    equippable: true,
    iconKey: 'att_muzzle_compensator',
    attachmentSlot: 'muzzle',
    compatibleWeapons: ['m4a1', 'ak47', 'mp5', 'deagle'],
    statModifiers: {
      recoilPitchMultiplier: 0.78,
      recoilYawMultiplier: 0.82,
    },
  },
  att_muzzle_choke: {
    id: 'att_muzzle_choke',
    name: 'Full-Bore Shotgun Choke',
    shortName: 'SG Choke',
    description:
      'Constricts 12-gauge buckshot pellet dispersion for denser groupings and extended effective shotgun range.',
    category: 'attachment',
    rarity: 'rare',
    weightKg: 0.25,
    maxStack: 1,
    equippable: true,
    iconKey: 'att_muzzle_choke',
    attachmentSlot: 'muzzle',
    compatibleWeapons: ['spas12'],
    statModifiers: {
      hipSpreadMultiplier: 0.74,
      adsSpreadMultiplier: 0.72,
      maxRangeMultiplier: 1.18,
    },
  },

  // ==========================================================================
  // 4. WEAPON ATTACHMENTS — MAGAZINES (Integrated with Weapon Ammo & Reload)
  // ==========================================================================
  att_mag_ext_ar: {
    id: 'att_mag_ext_ar',
    name: 'Extended Mag',
    shortName: 'Extended Mag',
    description:
      'High-capacity polymer box magazine adding +10 rounds to Assault Rifles with a slight reload weight trade-off.',
    category: 'attachment',
    rarity: 'rare',
    weightKg: 0.45,
    maxStack: 1,
    equippable: true,
    iconKey: 'att_mag_ext_ar',
    attachmentSlot: 'magazine',
    compatibleWeapons: ['m4a1', 'ak47'],
    statModifiers: {
      magSizeDelta: 10,
      reloadTimeMultiplier: 1.06,
    },
  },
  att_mag_fast_smg: {
    id: 'att_mag_fast_smg',
    name: 'Quick-Pull Extended Sub Mag',
    shortName: 'Quick Mag',
    description:
      'Paracord-looped magazine adding +5 rounds and cutting reload duration by 22% for SMGs and Sidearms.',
    category: 'attachment',
    rarity: 'rare',
    weightKg: 0.32,
    maxStack: 1,
    equippable: true,
    iconKey: 'att_mag_fast_smg',
    attachmentSlot: 'magazine',
    compatibleWeapons: ['mp5', 'deagle'],
    statModifiers: {
      magSizeDelta: 5,
      reloadTimeMultiplier: 0.78,
    },
  },
  att_mag_ext_heavy: {
    id: 'att_mag_ext_heavy',
    name: 'Heavy Ordnance Extended Tube/Box',
    shortName: 'Heavy Mag',
    description:
      'Adds +3 shells/rounds to Sniper Rifles and Combat Shotguns with reinforced spring feeding.',
    category: 'attachment',
    rarity: 'epic',
    weightKg: 0.5,
    maxStack: 1,
    equippable: true,
    iconKey: 'att_mag_ext_heavy',
    attachmentSlot: 'magazine',
    compatibleWeapons: ['awp', 'spas12'],
    statModifiers: {
      magSizeDelta: 3,
      reloadTimeMultiplier: 0.92,
    },
  },

  // ==========================================================================
  // 5. WEAPON ATTACHMENTS — UNDERBARREL
  // ==========================================================================
  att_grip_vertical: {
    id: 'att_grip_vertical',
    name: 'Vertical Grip',
    shortName: 'Vertical Grip',
    description:
      'Picatinny vertical foregrip providing superior leverage against vertical muzzle climb during sustained fire.',
    category: 'attachment',
    rarity: 'rare',
    weightKg: 0.22,
    maxStack: 1,
    equippable: true,
    iconKey: 'att_grip_vertical',
    attachmentSlot: 'underbarrel',
    compatibleWeapons: ['m4a1', 'ak47', 'mp5', 'spas12'],
    statModifiers: {
      recoilPitchMultiplier: 0.8,
      hipSpreadMultiplier: 0.94,
    },
  },
  att_grip_angled: {
    id: 'att_grip_angled',
    name: 'Angled Ergonomic Foregrip',
    shortName: 'Angled Grip',
    description:
      'Low-profile angled foregrip that stabilizes horizontal sway and tightens aimed grouping.',
    category: 'attachment',
    rarity: 'rare',
    weightKg: 0.2,
    maxStack: 1,
    equippable: true,
    iconKey: 'att_grip_angled',
    attachmentSlot: 'underbarrel',
    compatibleWeapons: ['m4a1', 'ak47', 'mp5'],
    statModifiers: {
      adsSpreadMultiplier: 0.82,
      recoilYawMultiplier: 0.8,
    },
  },

  // ==========================================================================
  // 6. WEAPON ATTACHMENTS — STOCK
  // ==========================================================================
  att_stock_tactical: {
    id: 'att_stock_tactical',
    name: 'Tactical Stock',
    shortName: 'Tactical Stock',
    description:
      'Adjustable marksman buttstock that reduces pitch/yaw recoil kick and steadies sight alignment.',
    category: 'attachment',
    rarity: 'rare',
    weightKg: 0.38,
    maxStack: 1,
    equippable: true,
    iconKey: 'att_stock_tactical',
    attachmentSlot: 'stock',
    compatibleWeapons: ['m4a1', 'ak47', 'mp5', 'spas12', 'awp'],
    statModifiers: {
      recoilPitchMultiplier: 0.86,
      recoilYawMultiplier: 0.85,
      adsSpreadMultiplier: 0.85,
    },
  },
  att_stock_lightweight: {
    id: 'att_stock_lightweight',
    name: 'Skeletonized CQB Wire Stock',
    shortName: 'LIGHT STOCK',
    description:
      'Ultralight aluminum stock that boosts operator strafe speed and speeds up magazine handling.',
    category: 'attachment',
    rarity: 'uncommon',
    weightKg: 0.24,
    maxStack: 1,
    equippable: true,
    iconKey: 'att_stock_lightweight',
    attachmentSlot: 'stock',
    compatibleWeapons: ['m4a1', 'mp5', 'spas12'],
    statModifiers: {
      moveSpeedMultiplierDelta: 0.04,
      reloadTimeMultiplier: 0.9,
    },
  },

  // ==========================================================================
  // 7. AMMUNITION CALIBERS
  // ==========================================================================
  ammo_556: {
    id: 'ammo_556',
    name: '5.56×45mm NATO Ammo',
    shortName: '5.56mm',
    description: 'Standard-issue intermediate rifle cartridges for the M4A1 Carbine.',
    category: 'ammo',
    rarity: 'common',
    weightKg: 0.012,
    maxStack: 120,
    equippable: false,
    iconKey: 'ammo_556',
    ammoType: 'ammo_556',
  },
  ammo_762: {
    id: 'ammo_762',
    name: '7.62×39mm Heavy Ammo',
    shortName: '7.62mm',
    description: 'High-grain intermediate rifle cartridges for the AK-47 Heavy.',
    category: 'ammo',
    rarity: 'common',
    weightKg: 0.016,
    maxStack: 90,
    equippable: false,
    iconKey: 'ammo_762',
    ammoType: 'ammo_762',
  },
  ammo_9mm: {
    id: 'ammo_9mm',
    name: '9×19mm Parabellum Ammo',
    shortName: '9mm',
    description: 'Submachine gun cartridges for the MP5-K Tactical.',
    category: 'ammo',
    rarity: 'common',
    weightKg: 0.008,
    maxStack: 90,
    equippable: false,
    iconKey: 'ammo_9mm',
    ammoType: 'ammo_9mm',
  },
  ammo_12g: {
    id: 'ammo_12g',
    name: '12-Gauge 00 Buckshot Shells',
    shortName: '12 GAUGE',
    description: '8-pellet tactical buckshot shells for the SPAS-12 Combat Shotgun.',
    category: 'ammo',
    rarity: 'uncommon',
    weightKg: 0.035,
    maxStack: 32,
    equippable: false,
    iconKey: 'ammo_12g',
    ammoType: 'ammo_12g',
  },
  ammo_338: {
    id: 'ammo_338',
    name: '.338 Lapua Magnum Rounds',
    shortName: '.338 MAG',
    description: 'Match-grade long-range sniper cartridges for the AWP Magnum.',
    category: 'ammo',
    rarity: 'rare',
    weightKg: 0.045,
    maxStack: 20,
    equippable: false,
    iconKey: 'ammo_338',
    ammoType: 'ammo_338',
  },
  ammo_50ae: {
    id: 'ammo_50ae',
    name: '.50 Action Express Rounds',
    shortName: '.50 AE',
    description: 'Heavy magnum pistol cartridges for the Desert Eagle .50.',
    category: 'ammo',
    rarity: 'uncommon',
    weightKg: 0.022,
    maxStack: 36,
    equippable: false,
    iconKey: 'ammo_50ae',
    ammoType: 'ammo_50ae',
  },

  // ==========================================================================
  // 8. MEDICAL, HEALING & CONSUMABLES
  // ==========================================================================
  med_ifak: {
    id: 'med_ifak',
    name: 'IFAK Tactical Med Kit',
    shortName: 'Med Kit',
    description:
      'Individual First-Aid Kit containing tourniquet and trauma dressing. Restores +50 Operator HP on use.',
    category: 'healing',
    rarity: 'common',
    weightKg: 0.2,
    maxStack: 5,
    equippable: false,
    iconKey: 'med_ifak',
    healHp: 50,
  },
  med_first_aid: {
    id: 'med_first_aid',
    name: 'Field First Aid Pouch',
    shortName: 'First Aid',
    description:
      'Emergency trauma kit restoring +75 Operator HP in the field.',
    category: 'healing',
    rarity: 'common',
    weightKg: 0.15,
    maxStack: 5,
    equippable: false,
    iconKey: 'med_first_aid',
    healHp: 75,
  },
  med_trauma_kit: {
    id: 'med_trauma_kit',
    name: 'Surgical Field Trauma Kit',
    shortName: 'Med Kit',
    description:
      'Comprehensive field surgical pack that restores Operator Health to full (+100 HP).',
    category: 'healing',
    rarity: 'epic',
    weightKg: 0.8,
    maxStack: 2,
    equippable: false,
    iconKey: 'med_trauma_kit',
    healHp: 100,
  },
  med_bandage: {
    id: 'med_bandage',
    name: 'Hemostatic Combat Bandage',
    shortName: 'Bandage',
    description:
      'Lightweight pressure dressing for rapid wound sealing. Restores +25 Operator HP.',
    category: 'healing',
    rarity: 'common',
    weightKg: 0.05,
    maxStack: 10,
    equippable: false,
    iconKey: 'med_bandage',
    healHp: 25,
  },
  med_painkiller: {
    id: 'med_painkiller',
    name: 'Combat Analgesic Painkillers',
    shortName: 'Painkiller',
    description:
      'High-strength field analgesic that restores +35 HP and steadies aim under fire.',
    category: 'healing',
    rarity: 'common',
    weightKg: 0.08,
    maxStack: 6,
    equippable: false,
    iconKey: 'med_painkiller',
    healHp: 35,
  },
  med_morphine: {
    id: 'med_morphine',
    name: 'Morphine Syrette Autoinjector',
    shortName: 'Morphine',
    description:
      'Rapid-acting emergency pain relief syrette restoring +60 HP immediately.',
    category: 'healing',
    rarity: 'common',
    weightKg: 0.08,
    maxStack: 4,
    equippable: false,
    iconKey: 'med_morphine',
    healHp: 60,
  },
  con_energy_drink: {
    id: 'con_energy_drink',
    name: 'High-Octane Energy Drink',
    shortName: 'Energy Drink',
    description:
      'Electrolyte and caffeine combat beverage restoring +15 HP and +60% Stamina.',
    category: 'consumable',
    rarity: 'common',
    weightKg: 0.1,
    maxStack: 6,
    equippable: false,
    iconKey: 'con_energy_drink',
    healHp: 15,
    restoreStamina: 60,
  },
  con_canned_food: {
    id: 'con_canned_food',
    name: 'Field Ration Canned Beef',
    shortName: 'Canned Food',
    description:
      'High-calorie military field ration restoring +20 HP and +40% Stamina.',
    category: 'consumable',
    rarity: 'common',
    weightKg: 0.1,
    maxStack: 10,
    equippable: false,
    iconKey: 'con_canned_food',
    healHp: 20,
    restoreStamina: 40,
  },
  con_adrenaline: {
    id: 'con_adrenaline',
    name: 'Epinephrine Combat Autoinjector',
    shortName: 'Morphine',
    description:
      'Emergency combat stimulant restoring +35 HP and +100% Stamina immediately.',
    category: 'consumable',
    rarity: 'rare',
    weightKg: 0.2,
    maxStack: 3,
    equippable: false,
    iconKey: 'con_adrenaline',
    healHp: 35,
    restoreStamina: 100,
  },
  gear_armor_plate: {
    id: 'gear_armor_plate',
    name: 'Ballistic Ceramic Strike Plate',
    shortName: 'Armor Plate',
    description:
      'Replacement Level-IV ceramic insert that repairs +50 Armor Points on your equipped vest.',
    category: 'armor',
    rarity: 'uncommon',
    weightKg: 0.5,
    maxStack: 4,
    equippable: false,
    iconKey: 'gear_armor_plate',
    repairArmor: 50,
  },

  // ==========================================================================
  // 9. ARMOR, HELMETS & TACTICAL BACKPACK TIERS
  // ==========================================================================
  gear_helmet_lv2: {
    id: 'gear_helmet_lv2',
    name: 'FAST Ballistic Helmet (Lv.2)',
    shortName: 'Helmet (Lv.2)',
    description:
      'High-cut aramid combat helmet providing +35 bonus armor capacity and incoming damage mitigation.',
    category: 'armor',
    rarity: 'epic',
    weightKg: 1.0,
    maxStack: 1,
    equippable: true,
    iconKey: 'gear_helmet_lv2',
    gearSlot: 'helmet',
    armorRating: 35,
    damageReductionPct: 12,
  },
  gear_helmet_lv3: {
    id: 'gear_helmet_lv3',
    name: 'Altyn Titanium Assault Helmet (Lv.3)',
    shortName: 'Helmet (Lv.3)',
    description:
      'Spetsnaz-grade titanium shell with armored visor granting +60 armor capacity and 22% damage reduction.',
    category: 'armor',
    rarity: 'legendary',
    weightKg: 1.8,
    maxStack: 1,
    equippable: true,
    iconKey: 'gear_helmet_lv3',
    gearSlot: 'helmet',
    armorRating: 60,
    damageReductionPct: 22,
  },
  gear_armor_lv2: {
    id: 'gear_armor_lv2',
    name: 'JPC Kevlar Plate Carrier (Lv.2)',
    shortName: 'Armor (Lv.2)',
    description:
      'Modular tactical plate carrier providing 65 Armor Points of torso protection.',
    category: 'armor',
    rarity: 'epic',
    weightKg: 2.0,
    maxStack: 1,
    equippable: true,
    iconKey: 'gear_armor_lv2',
    gearSlot: 'armor',
    armorRating: 65,
    damageReductionPct: 18,
  },
  gear_armor_lv3: {
    id: 'gear_armor_lv3',
    name: 'Titan Heavy Plate Rig (Lv.3)',
    shortName: 'Armor (Lv.3)',
    description:
      'Full-spectrum ceramic assault carrier providing 100 Armor Points of heavy ballistic protection.',
    category: 'armor',
    rarity: 'legendary',
    weightKg: 3.2,
    maxStack: 1,
    equippable: true,
    iconKey: 'gear_armor_lv3',
    gearSlot: 'armor',
    armorRating: 100,
    damageReductionPct: 28,
  },
  gear_backpack_lv1: {
    id: 'gear_backpack_lv1',
    name: 'Patrol Daypack (Lv.1)',
    shortName: 'Backpack (Lv.1)',
    description:
      'Standard light reconnaissance pack supporting 16 storage slots and 32.0 kg carry weight.',
    category: 'tactical',
    rarity: 'common',
    weightKg: 0.6,
    maxStack: 1,
    equippable: true,
    iconKey: 'gear_backpack_lv1',
    gearSlot: 'backpack',
    backpackSlots: 16,
    backpackMaxWeightKg: 32,
  },
  gear_backpack_lv2: {
    id: 'gear_backpack_lv2',
    name: 'Operator MOLLE Rucksack (Lv.2)',
    shortName: 'Backpack (Lv.2)',
    description:
      'Reinforced mid-size tactical rucksack expanding storage to 24 slots and 45.0 kg max weight.',
    category: 'tactical',
    rarity: 'epic',
    weightKg: 0.9,
    maxStack: 1,
    equippable: true,
    iconKey: 'gear_backpack_lv2',
    gearSlot: 'backpack',
    backpackSlots: 24,
    backpackMaxWeightKg: 45,
  },
  gear_backpack_lv3: {
    id: 'gear_backpack_lv3',
    name: 'Raid Expedition Pack (Lv.3)',
    shortName: 'Backpack (Lv.3)',
    description:
      'Heavy-frame special operations pack expanding storage to 32 slots and 60.0 kg max weight.',
    category: 'tactical',
    rarity: 'legendary',
    weightKg: 1.2,
    maxStack: 1,
    equippable: true,
    iconKey: 'gear_backpack_lv3',
    gearSlot: 'backpack',
    backpackSlots: 32,
    backpackMaxWeightKg: 60,
  },

  // ==========================================================================
  // 10. GRENADES, THROWABLES & TACTICAL EQUIPMENT
  // ==========================================================================
  tac_frag_grenade: {
    id: 'tac_frag_grenade',
    name: 'M67 Fragmentation Grenade',
    shortName: 'Frag Grenade',
    description:
      'Delayed-fuze anti-personnel fragmentation grenade with a 6.5m lethal blast radius.',
    category: 'throwable',
    rarity: 'common',
    weightKg: 0.2,
    maxStack: 5,
    equippable: false,
    iconKey: 'tac_frag_grenade',
  },
  tac_flashbang: {
    id: 'tac_flashbang',
    name: 'M84 Stun Flashbang',
    shortName: 'Flashbang',
    description:
      'Non-lethal pyrotechnic stun grenade engineered to disorient hostiles during room entry.',
    category: 'throwable',
    rarity: 'common',
    weightKg: 0.2,
    maxStack: 3,
    equippable: false,
    iconKey: 'tac_flashbang',
  },
  tac_smoke_grenade: {
    id: 'tac_smoke_grenade',
    name: 'AN-M18 Tactical Smoke',
    shortName: 'Smoke Grenade',
    description:
      'Dense screening smoke canister used to obscure sniper lanes and cover team rotations.',
    category: 'throwable',
    rarity: 'common',
    weightKg: 0.2,
    maxStack: 5,
    equippable: false,
    iconKey: 'tac_smoke_grenade',
  },
  tac_grapple_hook: {
    id: 'tac_grapple_hook',
    name: 'Folding Tactical Grapple Hook',
    shortName: 'Grapple Hook',
    description:
      'High-tensile steel climbing grapple with braided aramid rope for vertical scaling.',
    category: 'tactical',
    rarity: 'common',
    weightKg: 0.3,
    maxStack: 1,
    equippable: false,
    iconKey: 'tac_grapple_hook',
  },
  tac_toolkit: {
    id: 'tac_toolkit',
    name: 'Field Armorer Repair Toolkit',
    shortName: 'Toolkit',
    description:
      'Precision weapon and armor maintenance kit restoring +40 Armor durability.',
    category: 'tactical',
    rarity: 'common',
    weightKg: 0.25,
    maxStack: 5,
    equippable: false,
    iconKey: 'tac_toolkit',
    repairArmor: 40,
  },
  tac_detector: {
    id: 'tac_detector',
    name: 'RF Signal & Loot Detector',
    shortName: 'Detector',
    description:
      'Handheld digital spectrum scanner that locates nearby electronic caches and beacons.',
    category: 'tactical',
    rarity: 'common',
    weightKg: 0.2,
    maxStack: 1,
    equippable: false,
    iconKey: 'tac_detector',
  },
  tac_rangefinder: {
    id: 'tac_rangefinder',
    name: 'Laser Ballistic Rangefinder',
    shortName: 'Detector',
    description:
      'Optical laser telemetry monocular used by marksmen to verify target distance and windage.',
    category: 'tactical',
    rarity: 'rare',
    weightKg: 0.5,
    maxStack: 1,
    equippable: false,
    iconKey: 'tac_rangefinder',
  },
};

export const ITEM_ORDER: string[] = Object.keys(ITEM_REGISTRY);

export function getItemDefinition(itemId: string): ItemDefinition | null {
  return ITEM_REGISTRY[itemId] || null;
}

export function getWeaponItemDefinition(weaponId: WeaponId): ItemDefinition {
  const id = WEAPON_ITEM_ID_MAP[weaponId];
  return ITEM_REGISTRY[id] || ITEM_REGISTRY.wpn_m4a1;
}

export function getOpticAttachmentItemId(opticId: string): string | null {
  if (!opticId || opticId === 'none') return null;
  for (const def of Object.values(ITEM_REGISTRY)) {
    if (def.category === 'attachment' && def.attachmentSlot === 'optic' && def.opticId === opticId) {
      return def.id;
    }
  }
  return null;
}

export function getAttachmentsForSlot(slot: AttachmentSlotType): ItemDefinition[] {
  return Object.values(ITEM_REGISTRY).filter(
    (def) => def.category === 'attachment' && def.attachmentSlot === slot
  );
}

export function getRarityColorMeta(rarity: ItemRarity): {
  label: string;
  textClass: string;
  borderClass: string;
  bgClass: string;
  accentHex: string;
} {
  switch (rarity) {
    case 'legendary':
      return {
        label: 'Legendary',
        textClass: 'text-amber-300',
        borderClass: 'border-amber-400/50',
        bgClass: 'bg-amber-500/12',
        accentHex: '#f59e0b',
      };
    case 'epic':
      return {
        label: 'Epic',
        textClass: 'text-fuchsia-300',
        borderClass: 'border-fuchsia-400/45',
        bgClass: 'bg-fuchsia-500/12',
        accentHex: '#d946ef',
      };
    case 'rare':
      return {
        label: 'Rare',
        textClass: 'text-sky-300',
        borderClass: 'border-sky-400/45',
        bgClass: 'bg-sky-500/12',
        accentHex: '#38bdf8',
      };
    case 'uncommon':
      return {
        label: 'Uncommon',
        textClass: 'text-emerald-300',
        borderClass: 'border-emerald-400/45',
        bgClass: 'bg-emerald-500/12',
        accentHex: '#10b981',
      };
    default:
      return {
        label: 'Standard',
        textClass: 'text-zinc-300',
        borderClass: 'border-white/15',
        bgClass: 'bg-zinc-800/60',
        accentHex: '#a1a1aa',
      };
  }
}

export const CATEGORY_LABELS: Record<'all' | ItemCategory, string> = {
  all: 'All Items',
  weapon: 'Weapons',
  attachment: 'Attachments',
  ammo: 'Ammunition',
  healing: 'Medical',
  armor: 'Armor & Gear',
  throwable: 'Throwables',
  tactical: 'Tactical',
  consumable: 'Consumables',
  misc: 'Misc',
};
