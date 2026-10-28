import React from 'react';
import type { WeaponId } from '../../game/config.ts';
import type { WeaponAttachmentMap } from '../../game/inventory/InventoryTypes.ts';

/**
 * Custom 3-bullet magazine icon used across weapon and ammo readouts.
 */
export const BulletTrioIcon: React.FC<{ className?: string }> = ({
  className = 'w-3 h-3.5',
}) => (
  <svg viewBox="0 0 14 16" fill="none" className={className} aria-hidden="true">
    {[2, 7, 12].map((cx) => (
      <g key={cx}>
        <path
          d={`M${cx - 1.3} 5.5L${cx} 1.5L${cx + 1.3} 5.5Z`}
          fill="#e2e8f0"
        />
        <rect
          x={cx - 1.3}
          y="5.8"
          width="2.6"
          height="8.5"
          rx="0.5"
          fill="#94a3b8"
        />
      </g>
    ))}
  </svg>
);

/**
 * Custom High-Detail Side-Profile Tactical Weapon SVG with Dynamic Attachment Rendering
 * (Optics, Suppressors/Compensators, Extended Magazines, Foregrips, and Stocks).
 */
export const TacticalWeaponSvg: React.FC<{
  weaponId: WeaponId;
  attachments?: WeaponAttachmentMap;
  className?: string;
}> = ({ weaponId, attachments, className = 'w-full h-full' }) => {
  const hasSuppressor = attachments?.muzzle === 'att_muzzle_suppressor';
  const hasCompensator =
    attachments?.muzzle === 'att_muzzle_compensator' ||
    attachments?.muzzle === 'att_muzzle_choke';
  const hasVertGrip = attachments?.underbarrel === 'att_grip_vertical';
  const hasAngledGrip = attachments?.underbarrel === 'att_grip_angled';
  const hasExtMag = Boolean(attachments?.magazine);
  const opticId = attachments?.optic;

  const renderOpticOverlay = (railX: number, railY: number) => {
    if (opticId === 'att_optic_8x') {
      return (
        <g>
          <rect x={railX + 6} y={railY - 5} width="4" height="6" fill="#475569" />
          <rect x={railX + 34} y={railY - 5} width="4" height="6" fill="#475569" />
          <path
            d={`M${railX - 4} ${railY - 10} L${railX + 6} ${railY - 8} L${railX + 42} ${railY - 8} L${railX + 54} ${railY - 12} L${railX + 54} ${railY - 2} L${railX + 42} ${railY - 5} L${railX + 6} ${railY - 5} L${railX - 4} ${railY - 3} Z`}
            fill="#1e293b"
            stroke="#94a3b8"
            strokeWidth="1.2"
          />
          <ellipse cx={railX + 54} cy={railY - 7} rx="1.8" ry="4.8" fill="#38bdf8" />
        </g>
      );
    }
    if (opticId === 'att_optic_4x' || opticId === 'att_optic_2x') {
      return (
        <g>
          <rect x={railX + 8} y={railY - 4} width="24" height="4" fill="#334155" />
          <path
            d={`M${railX + 2} ${railY - 11} L${railX + 32} ${railY - 12} L${railX + 38} ${railY - 14} L${railX + 38} ${railY - 3} L${railX + 32} ${railY - 4} L${railX + 2} ${railY - 4} Z`}
            fill="#27313f"
            stroke="#a855f7"
            strokeWidth="1.1"
          />
          <rect x={railX + 14} y={railY - 15} width="8" height="3" rx="1" fill="#64748b" />
          <ellipse cx={railX + 38} cy={railY - 8.5} rx="1.6" ry="4.5" fill="#34d399" />
        </g>
      );
    }
    if (opticId === 'att_optic_red_dot' || opticId === 'att_optic_holo') {
      return (
        <g>
          <path
            d={`M${railX + 8} ${railY - 10} L${railX + 28} ${railY - 10} L${railX + 31} ${railY - 1} L${railX + 6} ${railY - 1} Z`}
            fill="#1e293b"
            stroke="#38bdf8"
            strokeWidth="1.2"
          />
          <circle cx={railX + 18} cy={railY - 5.5} r="2" fill="#ef4444" />
        </g>
      );
    }
    // Iron sights default
    return (
      <g>
        <rect x={railX + 2} y={railY - 5} width="5" height="5" rx="1" fill="#475569" />
      </g>
    );
  };

  switch (weaponId) {
    case 'm4a1':
      return (
        <svg
          viewBox="0 0 260 88"
          fill="none"
          className={`pointer-events-none select-none ${className}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="m4_tan_upper" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#b08d57" />
              <stop offset="50%" stopColor="#85683a" />
              <stop offset="100%" stopColor="#4a381d" />
            </linearGradient>
            <linearGradient id="m4_dark_steel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#64748b" />
              <stop offset="50%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>
          {/* Tactical SOPMOD Stock */}
          <path
            d="M14 29 L62 29 L62 45 L38 49 L20 61 L12 58 L14 29 Z"
            fill="url(#m4_tan_upper)"
            stroke="#d6b885"
            strokeWidth="1.2"
          />
          <rect x="9" y="28" width="6" height="31" rx="2" fill="#0f172a" />
          {/* Buffer Tube */}
          <rect x="58" y="30" width="16" height="9" fill="#334155" />
          {/* Upper & Lower Receiver */}
          <path
            d="M72 24 L138 24 L138 48 L104 48 L96 43 L72 43 Z"
            fill="url(#m4_tan_upper)"
            stroke="#e2c799"
            strokeWidth="1.2"
          />
          {/* Ejection Port & Bolt */}
          <rect x="100" y="29" width="22" height="5.5" rx="1" fill="#1e293b" stroke="#94a3b8" strokeWidth="0.8" />
          {/* Top Picatinny Rail */}
          <rect x="74" y="21" width="112" height="3.5" fill="#1e293b" stroke="#94a3b8" strokeWidth="0.8" />
          {/* Dynamic Optic */}
          {renderOpticOverlay(84, 21)}
          {/* Ergonomic Textured Pistol Grip */}
          <path
            d="M75 43 L89 43 L80 70 L67 68 L75 43 Z"
            fill="url(#m4_tan_upper)"
            stroke="#d6b885"
            strokeWidth="1.1"
          />
          {/* Trigger & Guard */}
          <path d="M89 45 Q96 54 104 48" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
          <path d="M94 43 Q96 48 93 50" stroke="#e2e8f0" strokeWidth="1.6" fill="none" />
          {/* Magazine (Standard vs Extended) */}
          <path
            d={
              hasExtMag
                ? 'M106 47 L125 47 L135 83 L114 85 L106 47 Z'
                : 'M106 47 L125 47 L132 76 L112 78 L106 47 Z'
            }
            fill="url(#m4_tan_upper)"
            stroke="#e2c799"
            strokeWidth="1.2"
          />
          <line x1="113" y1="53" x2="125" y2="72" stroke="#4a381d" strokeWidth="1.6" />
          {/* Quad-Rail Free-Float Handguard */}
          <rect
            x="138"
            y="25"
            width="52"
            height="17"
            rx="2"
            fill="url(#m4_tan_upper)"
            stroke="#e2c799"
            strokeWidth="1.2"
          />
          {[144, 154, 164, 174].map((slotX) => (
            <rect key={slotX} x={slotX} y="29" width="6" height="3.5" rx="1" fill="#1e293b" />
          ))}
          {[144, 156, 168].map((slotX) => (
            <rect key={slotX} x={slotX} y="35.5" width="8" height="2.5" rx="1" fill="#334155" />
          ))}
          {/* Underbarrel Grip */}
          {hasVertGrip && (
            <path
              d="M154 42 L165 42 L163 64 L152 64 Z"
              fill="#1e293b"
              stroke="#64748b"
              strokeWidth="1.1"
            />
          )}
          {hasAngledGrip && (
            <path
              d="M146 42 L174 42 L166 53 L152 50 Z"
              fill="#1e293b"
              stroke="#64748b"
              strokeWidth="1.1"
            />
          )}
          {/* Front Sight Post & Barrel */}
          <path d="M182 14 L187 14 L189 25 L180 25 Z" fill="#334155" />
          <rect x="190" y="30" width="32" height="5.5" fill="url(#m4_dark_steel)" />
          {/* Muzzle / Suppressor */}
          {hasSuppressor ? (
            <rect
              x="216"
              y="26.5"
              width="36"
              height="12.5"
              rx="2.5"
              fill="url(#m4_dark_steel)"
              stroke="#94a3b8"
              strokeWidth="1.2"
            />
          ) : hasCompensator ? (
            <rect
              x="220"
              y="28"
              width="16"
              height="9.5"
              rx="1.5"
              fill="#475569"
              stroke="#cbd5e1"
              strokeWidth="1.1"
            />
          ) : (
            <rect
              x="220"
              y="28.5"
              width="12"
              height="8.5"
              rx="1.5"
              fill="#334155"
              stroke="#94a3b8"
              strokeWidth="1"
            />
          )}
        </svg>
      );

    case 'ak47':
      return (
        <svg
          viewBox="0 0 260 88"
          fill="none"
          className={`pointer-events-none select-none ${className}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="ak_wood_grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#c2632b" />
              <stop offset="55%" stopColor="#8c3b14" />
              <stop offset="100%" stopColor="#451a03" />
            </linearGradient>
            <linearGradient id="ak_metal_grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="50%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>
          {/* Hardwood Fixed Stock */}
          <path
            d="M14 32 L68 28 L68 43 L30 58 L14 54 Z"
            fill="url(#ak_wood_grad)"
            stroke="#ea580c"
            strokeWidth="1.1"
          />
          {/* Stamped Steel Receiver */}
          <path
            d="M68 24 L142 24 L144 45 L68 45 Z"
            fill="url(#ak_metal_grad)"
            stroke="#94a3b8"
            strokeWidth="1.2"
          />
          <path d="M72 24 Q105 19 140 24" stroke="#cbd5e1" strokeWidth="1.3" fill="none" />
          <rect x="104" y="29" width="24" height="5" rx="1" fill="#e2e8f0" />
          {renderOpticOverlay(88, 23)}
          {/* Bakelite Grip */}
          <path
            d="M74 45 L88 45 L79 70 L66 68 Z"
            fill="#9a3412"
            stroke="#fb923c"
            strokeWidth="1"
          />
          {/* Curved 7.62 Banana Magazine */}
          <path
            d="M110 44 L131 44 C138 60 147 72 156 81 L135 83 C125 72 115 58 110 44 Z"
            fill="#c2410c"
            stroke="#fdba74"
            strokeWidth="1.2"
          />
          {/* Wooden Handguard */}
          <path
            d="M142 25 L190 26 L188 41 L142 42 Z"
            fill="url(#ak_wood_grad)"
            stroke="#ea580c"
            strokeWidth="1.1"
          />
          <rect x="150" y="30" width="26" height="3.5" rx="1" fill="#451a03" />
          {hasVertGrip && (
            <rect x="160" y="42" width="10" height="20" rx="2" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
          )}
          {/* Gas Tube & Barrel */}
          <rect x="188" y="26" width="24" height="4.5" fill="#475569" />
          <rect x="188" y="32" width="44" height="5" fill="url(#ak_metal_grad)" />
          <path d="M216 17 L224 17 L226 32 L214 32 Z" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
          {hasSuppressor ? (
            <rect x="226" y="28.5" width="28" height="12" rx="2" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.1" />
          ) : (
            <path d="M232 31 L242 29 L239 37 L232 37 Z" fill="#cbd5e1" />
          )}
        </svg>
      );

    case 'mp5':
      return (
        <svg
          viewBox="0 0 260 88"
          fill="none"
          className={`pointer-events-none select-none ${className}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="smg_steel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="50%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>
          {/* Folding Tactical Stock */}
          <rect x="22" y="32" width="48" height="4.5" fill="#64748b" />
          <path d="M16 24 L26 24 L26 52 L16 49 Z" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.2" />
          {/* Upper SMG Receiver */}
          <rect
            x="68"
            y="23"
            width="102"
            height="24"
            rx="3"
            fill="url(#smg_steel)"
            stroke="#cbd5e1"
            strokeWidth="1.2"
          />
          {renderOpticOverlay(92, 23)}
          {/* Pistol Grip */}
          <path d="M76 47 L92 47 L84 72 L70 70 Z" fill="#1e293b" stroke="#64748b" strokeWidth="1.1" />
          {/* Straight/Curved SMG Mag */}
          <path
            d="M124 47 L140 47 C144 60 149 71 154 81 L140 82 C133 71 127 59 124 47 Z"
            fill="#334155"
            stroke="#94a3b8"
            strokeWidth="1.2"
          />
          {/* Integrated Foregrip & Barrel Shroud */}
          <rect x="156" y="46" width="10" height="21" rx="2" fill="#1e293b" stroke="#94a3b8" strokeWidth="1" />
          <rect
            x="170"
            y="26"
            width="58"
            height="15"
            rx="3"
            fill="#1e293b"
            stroke="#cbd5e1"
            strokeWidth="1.2"
          />
          {[184, 198, 212].map((lx) => (
            <line key={lx} x1={lx} y1="27" x2={lx} y2="40" stroke="#64748b" strokeWidth="1.2" />
          ))}
        </svg>
      );

    case 'awp':
      return (
        <svg
          viewBox="0 0 260 88"
          fill="none"
          className={`pointer-events-none select-none ${className}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="awm_olive" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#657332" />
              <stop offset="55%" stopColor="#495421" />
              <stop offset="100%" stopColor="#282f11" />
            </linearGradient>
            <linearGradient id="awm_barrel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#cbd5e1" />
              <stop offset="50%" stopColor="#475569" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>
          {/* AWM Olive Polymer Thumbhole Chassis */}
          <path
            d="M10 30 L166 30 L172 43 L102 46 L86 68 L68 68 L72 48 L40 50 L18 60 L10 58 Z"
            fill="url(#awm_olive)"
            stroke="#a3b856"
            strokeWidth="1.2"
          />
          <ellipse cx="56" cy="41" rx="10" ry="5.5" fill="#090d12" stroke="#84993c" strokeWidth="1" />
          <rect x="22" y="24" width="30" height="6" rx="2" fill="#1e293b" stroke="#64748b" strokeWidth="0.9" />
          {/* 8x Telescopic Sniper Scope */}
          <rect x="84" y="18" width="6" height="12" fill="#334155" />
          <rect x="128" y="18" width="6" height="12" fill="#334155" />
          <path
            d="M66 11 L78 14 L138 14 L154 8 L154 22 L138 18 L78 18 L66 20 Z"
            fill="url(#awm_barrel)"
            stroke="#cbd5e1"
            strokeWidth="1.2"
          />
          <ellipse cx="154" cy="15" rx="2.2" ry="6.2" fill="#38bdf8" />
          {/* .338 Box Magazine */}
          <rect x="106" y="45" width="25" height="20" rx="1.5" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.1" />
          {/* Fluted Free-Float Sniper Barrel & Muzzle Brake */}
          <rect x="162" y="26" width="72" height="5.5" fill="url(#awm_barrel)" />
          <rect x="232" y="23.5" width="16" height="10.5" rx="1.5" fill="#94a3b8" stroke="#0f172a" strokeWidth="1" />
          <path d="M168 42 L188 59" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    case 'spas12':
      return (
        <svg
          viewBox="0 0 260 88"
          fill="none"
          className={`pointer-events-none select-none ${className}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="p90_body" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="55%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>
          {/* Bullpup P90 / Tactical PDW & Combat Chassis */}
          <path
            d="M28 24 L196 24 L204 44 L176 52 L148 52 L140 66 L124 66 L126 48 L96 48 L88 68 L70 68 L74 48 L28 52 Z"
            fill="url(#p90_body)"
            stroke="#94a3b8"
            strokeWidth="1.3"
          />
          {/* Thumbhole Ergonomic Cutouts */}
          <ellipse cx="106" cy="40" rx="12" ry="6.5" fill="#090d12" stroke="#475569" strokeWidth="1" />
          <ellipse cx="156" cy="40" rx="9" ry="5.5" fill="#090d12" stroke="#475569" strokeWidth="1" />
          {/* Top-Mounted Translucent Horizontal Magazine */}
          <rect x="52" y="18" width="112" height="6" rx="2" fill="#d97706" fillOpacity="0.65" stroke="#fbbf24" strokeWidth="1" />
          {/* Elevated Optic Arch */}
          <path d="M144 10 L188 10 L194 24 L138 24 Z" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.2" />
          {renderOpticOverlay(150, 11)}
          {/* Flash Hider Barrel */}
          <rect x="200" y="31" width="24" height="6" rx="1.5" fill="#64748b" stroke="#cbd5e1" strokeWidth="1" />
        </svg>
      );

    case 'deagle':
      return (
        <svg
          viewBox="0 0 220 76"
          fill="none"
          className={`pointer-events-none select-none ${className}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="pistol_slide" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#cbd5e1" />
              <stop offset="45%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
          </defs>
          {/* Slide & Barrel Assembly */}
          <path
            d="M54 15 L172 15 L178 35 L60 35 L50 28 Z"
            fill="url(#pistol_slide)"
            stroke="#e2e8f0"
            strokeWidth="1.3"
          />
          <rect x="96" y="18" width="28" height="6" rx="1" fill="#0f172a" />
          {[66, 72, 78].map((sx) => (
            <line key={sx} x1={sx} y1="20" x2={sx} y2="31" stroke="#1e293b" strokeWidth="2" />
          ))}
          <rect x="60" y="10" width="8" height="5" fill="#0f172a" />
          <rect x="162" y="10" width="6" height="5" fill="#ef4444" />
          <path
            d="M62 35 L150 35 L146 41 L108 41 L104 50 L86 50 L62 35 Z"
            fill="#334155"
            stroke="#94a3b8"
            strokeWidth="1.1"
          />
          <path
            d="M62 35 L90 35 L78 68 L50 66 Z"
            fill="#0f172a"
            stroke="#94a3b8"
            strokeWidth="1.2"
          />
          <rect x="48" y="65" width="32" height="5" rx="1.5" fill="#94a3b8" />
          {hasSuppressor && (
            <rect x="176" y="19" width="34" height="11" rx="2" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.1" />
          )}
        </svg>
      );
  }
};

/**
 * Custom Full-Body Tactical Special-Ops Operator SVG Portrait
 * Dynamically reflects equipped Helmet, Armor Vest, and Primary Rifle.
 */
export const OperatorPortrait: React.FC<{
  className?: string;
  helmetTier?: number;
  armorTier?: number;
  primaryWeaponId?: WeaponId;
}> = ({
  className = 'w-full h-full',
  helmetTier = 2,
  armorTier = 2,
}) => {
  const helmetColor = helmetTier >= 3 ? '#475569' : '#4a5546';
  const vestColor = armorTier >= 3 ? '#4b5563' : '#786646';
  const accentStroke = helmetTier >= 3 ? '#fbbf24' : '#94a3b8';

  return (
    <svg
      viewBox="0 0 188 420"
      fill="none"
      className={`pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="op_glow" cx="50%" cy="44%" r="50%">
          <stop offset="0%" stopColor="#1e293b" stopOpacity="0.75" />
          <stop offset="65%" stopColor="#0f172a" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#080c10" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="suit_grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b4654" />
          <stop offset="50%" stopColor="#1e2631" />
          <stop offset="100%" stopColor="#0f141c" />
        </linearGradient>
        <linearGradient id="vest_grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={vestColor} />
          <stop offset="55%" stopColor="#4a3e2a" />
          <stop offset="100%" stopColor="#262015" />
        </linearGradient>
        <linearGradient id="visor_grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      {/* Tactical Platform Pedestal & Backlight */}
      <ellipse cx="94" cy="195" rx="80" ry="170" fill="url(#op_glow)" />
      <ellipse
        cx="94"
        cy="398"
        rx="64"
        ry="12"
        fill="#0c131c"
        stroke="#2e3d4f"
        strokeWidth="1.4"
      />
      <ellipse
        cx="94"
        cy="398"
        rx="46"
        ry="7"
        fill="none"
        stroke="#38bdf8"
        strokeOpacity="0.35"
        strokeWidth="1"
        strokeDasharray="5 4"
      />

      {/* Assault Rucksack Behind Shoulders */}
      <path
        d="M52 76 C52 68 136 68 136 76 L140 122 L48 122 Z"
        fill="#2c3529"
        stroke="#576653"
        strokeWidth="1.2"
      />

      {/* Tactical Pants & Contoured Legs */}
      {/* Left Leg */}
      <path
        d="M55 214 L91 214 L86 292 L82 364 L54 364 L52 292 Z"
        fill="url(#suit_grad)"
        stroke="#475569"
        strokeWidth="1.3"
      />
      {/* Right Leg */}
      <path
        d="M97 214 L133 214 L136 292 L134 364 L106 364 L102 292 Z"
        fill="url(#suit_grad)"
        stroke="#475569"
        strokeWidth="1.3"
      />
      {/* Thigh Holster & Mag Rig */}
      <rect
        x="47"
        y="232"
        width="13"
        height="36"
        rx="2.5"
        fill="#4a3e2a"
        stroke="#8c7853"
        strokeWidth="1.1"
      />
      <rect
        x="128"
        y="230"
        width="14"
        height="38"
        rx="3"
        fill="#19212c"
        stroke="#64748b"
        strokeWidth="1.1"
      />
      <line x1="53" y1="248" x2="88" y2="250" stroke="#111827" strokeWidth="3.5" />
      <line x1="100" y1="250" x2="135" y2="248" stroke="#111827" strokeWidth="3.5" />

      {/* Contoured Hard-Shell Knee Pads */}
      <path
        d="M54 282 L82 282 L84 300 L78 310 L58 310 L52 300 Z"
        fill="#19212c"
        stroke="#64748b"
        strokeWidth="1.3"
      />
      <rect x="58" y="288" width="20" height="8" rx="2" fill="#334155" />
      <path
        d="M106 282 L134 282 L136 300 L130 310 L110 310 L104 300 Z"
        fill="#19212c"
        stroke="#64748b"
        strokeWidth="1.3"
      />
      <rect x="110" y="288" width="20" height="8" rx="2" fill="#334155" />

      {/* Laced Tactical Combat Boots */}
      <path
        d="M52 362 L83 362 L85 396 L44 398 L42 387 L50 376 Z"
        fill="#33291a"
        stroke="#8c7853"
        strokeWidth="1.3"
      />
      <path d="M42 393 H85" stroke="#111827" strokeWidth="3" />
      <path
        d="M105 362 L136 362 L138 376 L146 387 L144 398 L103 396 Z"
        fill="#33291a"
        stroke="#8c7853"
        strokeWidth="1.3"
      />
      <path d="M103 393 H146" stroke="#111827" strokeWidth="3" />

      {/* Contoured Arms, Brassards & Armored Gloves */}
      {/* Left Arm */}
      <path
        d="M46 88 L26 102 L18 156 L22 210 L42 210 L44 162 L52 120 Z"
        fill="url(#suit_grad)"
        stroke="#475569"
        strokeWidth="1.3"
      />
      {/* Left Deltoid Pauldron */}
      <path
        d="M46 86 C30 90 20 104 20 124 L46 126 Z"
        fill="#26313f"
        stroke="#64748b"
        strokeWidth="1.3"
      />
      <rect x="24" y="102" width="14" height="9" rx="1.5" fill="#4f5a20" stroke="#84993c" strokeWidth="0.9" />
      {/* Left Tactical Glove */}
      <path
        d="M19 208 L41 208 L43 230 L34 236 L20 232 Z"
        fill="#161d26"
        stroke="#64748b"
        strokeWidth="1.2"
      />

      {/* Right Arm */}
      <path
        d="M142 88 L162 102 L170 156 L166 210 L146 210 L144 162 L136 120 Z"
        fill="url(#suit_grad)"
        stroke="#475569"
        strokeWidth="1.3"
      />
      {/* Right Deltoid Pauldron */}
      <path
        d="M142 86 C158 90 168 104 168 124 L142 126 Z"
        fill="#26313f"
        stroke="#64748b"
        strokeWidth="1.3"
      />
      <rect x="150" y="102" width="14" height="9" rx="1.5" fill="#4f5a20" stroke="#84993c" strokeWidth="0.9" />
      {/* Right Tactical Glove */}
      <path
        d="M147 208 L169 208 L168 232 L154 236 L145 230 Z"
        fill="#161d26"
        stroke="#64748b"
        strokeWidth="1.2"
      />

      {/* Torso & Sculpted JPC Plate Carrier */}
      <path
        d="M48 84 L70 80 L118 80 L140 84 L134 202 L54 202 Z"
        fill="url(#vest_grad)"
        stroke="#a38f68"
        strokeWidth="1.5"
      />
      {/* Padded Shoulder Straps & Comms Wire */}
      <path d="M56 76 L72 76 L70 112 L54 112 Z" fill="#4a3e2a" stroke="#a38f68" strokeWidth="1.1" />
      <path d="M116 76 L132 76 L134 112 L118 112 Z" fill="#4a3e2a" stroke="#a38f68" strokeWidth="1.1" />
      {/* Upper Chest Admin Panel & Patch */}
      <rect x="68" y="98" width="52" height="26" rx="2.5" fill="#362d1e" stroke="#a38f68" strokeWidth="1.1" />
      <rect x="76" y="104" width="22" height="10" rx="1" fill="#4f5a20" stroke="#84993c" strokeWidth="0.8" />
      <circle cx="110" cy="110" r="4" fill="#1e293b" stroke="#94a3b8" strokeWidth="1" />
      {/* 3 Front STANAG Magazine Pouches */}
      {[57, 83, 109].map((px) => (
        <g key={px}>
          <rect
            x={px}
            y="134"
            width="22"
            height="46"
            rx="2.5"
            fill="#362d1e"
            stroke="#a38f68"
            strokeWidth="1.2"
          />
          <rect x={px + 3} y="128" width="16" height="8" rx="1" fill="#475569" stroke="#94a3b8" strokeWidth="0.9" />
          <line x1={px + 2} y1="152" x2={px + 20} y2="152" stroke="#a38f68" strokeWidth="1.2" />
        </g>
      ))}

      {/* Diagonal Tactical Sling & Silhouette across Chest */}
      <path d="M58 84 L130 188" stroke="#111827" strokeWidth="4.5" strokeLinecap="round" />

      {/* Heavy Duty Battle Belt */}
      <rect
        x="48"
        y="196"
        width="92"
        height="20"
        rx="3.5"
        fill="#19212c"
        stroke="#64748b"
        strokeWidth="1.3"
      />
      <rect x="84" y="199" width="20" height="14" rx="2" fill="#475569" stroke="#cbd5e1" strokeWidth="1.1" />
      <rect x="52" y="198" width="14" height="16" rx="2" fill="#2c3529" stroke="#64748b" strokeWidth="1" />
      <rect x="122" y="198" width="14" height="16" rx="2" fill="#2c3529" stroke="#64748b" strokeWidth="1" />

      {/* Neck & Armored Collar */}
      <path d="M74 64 L114 64 L120 84 L68 84 Z" fill="#1e2631" stroke="#475569" strokeWidth="1.1" />

      {/* Head, Balaclava, Ballistic Goggles & High-Cut FAST Helmet */}
      <ellipse
        cx="94"
        cy="46"
        rx="23"
        ry="27"
        fill="#27313f"
        stroke="#475569"
        strokeWidth="1.3"
      />
      {/* Balaclava Lower Face Mask with Ventilation Seams */}
      <path
        d="M71 46 Q94 52 117 46 L113 68 Q94 76 75 68 Z"
        fill="#443b2b"
        stroke="#786648"
        strokeWidth="1.2"
      />
      <line x1="94" y1="51" x2="94" y2="71" stroke="#292318" strokeWidth="1.4" />
      {/* Panoramic Tactical Ski/Ballistic Goggles */}
      <rect
        x="70"
        y="33"
        width="48"
        height="15"
        rx="6"
        fill="url(#visor_grad)"
        stroke="#cbd5e1"
        strokeWidth="1.5"
      />
      <path d="M76 37 Q94 34 112 37" stroke="#e2e8f0" strokeOpacity="0.55" strokeWidth="1.2" fill="none" />
      {/* FAST Ballistic Helmet Shell & NVG Shroud */}
      <path
        d="M66 35 C66 11 122 11 122 35 L118 35 Q94 29 70 35 Z"
        fill={helmetColor}
        stroke={accentStroke}
        strokeWidth="1.5"
      />
      {/* NVG Mount Plate */}
      <rect
        x="86"
        y="17"
        width="16"
        height="12"
        rx="2"
        fill="#161d26"
        stroke="#94a3b8"
        strokeWidth="1.2"
      />
      {/* Peltor Comms Headset Ear Cups & Boom Mic */}
      <rect x="63" y="34" width="7" height="16" rx="2.5" fill="#161d26" stroke="#64748b" strokeWidth="1.1" />
      <rect x="118" y="34" width="7" height="16" rx="2.5" fill="#161d26" stroke="#64748b" strokeWidth="1.1" />
      <path d="M67 48 Q76 62 90 61" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
    </svg>
  );
};

/**
 * Custom High-Detail Vector Artwork for Every Gear Slot (Helmet, Armor, Backpack).
 */
export const CustomGearIcon: React.FC<{
  slot: 'helmet' | 'armor' | 'backpack';
  tier?: number;
  className?: string;
}> = ({ slot, tier = 2, className = 'w-14 h-12' }) => {
  if (slot === 'helmet') {
    return (
      <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
        <defs>
          <linearGradient id="helm_grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={tier >= 3 ? '#64748b' : '#57634c'} />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
        </defs>
        <path
          d="M12 34 C12 10 52 10 52 34 L46 38 L34 32 L18 36 Z"
          fill="url(#helm_grad)"
          stroke="#94a3b8"
          strokeWidth="1.5"
        />
        {/* Side Picatinny Rail & NVG Shroud */}
        <path d="M26 24 L44 24 L46 31 L28 31 Z" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1" />
        <rect x="13" y="20" width="7" height="8" rx="1" fill="#0f172a" stroke="#94a3b8" strokeWidth="1" />
        {/* Chinstrap */}
        <path d="M22 35 L28 46 L38 46 L42 36" stroke="#475569" strokeWidth="1.8" fill="none" />
      </svg>
    );
  }

  if (slot === 'armor') {
    return (
      <svg viewBox="0 0 64 54" fill="none" className={className} aria-hidden="true">
        <defs>
          <linearGradient id="armor_grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tier >= 3 ? '#64748b' : '#6b5e46'} />
            <stop offset="100%" stopColor="#262118" />
          </linearGradient>
        </defs>
        <path
          d="M18 8 L26 8 L28 16 L36 16 L38 8 L46 8 L50 22 L48 46 L16 46 L14 22 Z"
          fill="url(#armor_grad)"
          stroke="#a8997c"
          strokeWidth="1.4"
        />
        {/* MOLLE Webbing & Triple Mag Pouches */}
        <line x1="20" y1="22" x2="44" y2="22" stroke="#a8997c" strokeWidth="1.2" />
        <line x1="20" y1="26" x2="44" y2="26" stroke="#a8997c" strokeWidth="1.2" />
        <rect x="19" y="30" width="8" height="12" rx="1" fill="#3a3224" stroke="#a8997c" strokeWidth="1" />
        <rect x="28" y="30" width="8" height="12" rx="1" fill="#3a3224" stroke="#a8997c" strokeWidth="1" />
        <rect x="37" y="30" width="8" height="12" rx="1" fill="#3a3224" stroke="#a8997c" strokeWidth="1" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 54" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="pack_grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={tier >= 3 ? '#52525b' : '#57634c'} />
          <stop offset="100%" stopColor="#1e241b" />
        </linearGradient>
      </defs>
      {/* Top Grab Handle */}
      <path d="M26 9 Q32 4 38 9" stroke="#94a3b8" strokeWidth="2" fill="none" />
      {/* Main Rucksack Body */}
      <rect
        x="16"
        y="9"
        width="32"
        height="39"
        rx="6"
        fill="url(#pack_grad)"
        stroke="#94a3b8"
        strokeWidth="1.4"
      />
      {/* Front Utility Pockets & Straps */}
      <rect x="20" y="14" width="24" height="10" rx="2" fill="#2c3527" stroke="#94a3b8" strokeWidth="1" />
      <rect x="20" y="27" width="24" height="16" rx="2.5" fill="#2c3527" stroke="#94a3b8" strokeWidth="1" />
      <rect x="24" y="13" width="3" height="32" fill="#1e293b" />
      <rect x="37" y="13" width="3" height="32" fill="#1e293b" />
    </svg>
  );
};

/**
 * Custom High-Detail Vector Artwork for Every Item in the Tactical Backpack.
 */
export const CustomItemSvg: React.FC<{
  itemId: string;
  className?: string;
}> = ({ itemId, className = 'w-14 h-12' }) => {
  switch (itemId) {
    // 1. MEDICAL & CONSUMABLES
    case 'med_ifak':
    case 'med_trauma_kit':
      return (
        <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id="med_green" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#657b38" />
              <stop offset="100%" stopColor="#323e1a" />
            </linearGradient>
          </defs>
          <path d="M24 12 L24 8 L40 8 L40 12" stroke="#94a3b8" strokeWidth="2.2" />
          <rect
            x="10"
            y="12"
            width="44"
            height="32"
            rx="5"
            fill="url(#med_green)"
            stroke="#a3b86c"
            strokeWidth="1.5"
          />
          <rect x="18" y="10" width="5" height="4" rx="1" fill="#cbd5e1" />
          <rect x="41" y="10" width="5" height="4" rx="1" fill="#cbd5e1" />
          <path d="M29 20 H35 V25 H40 V31 H35 V36 H29 V31 H24 V25 H29 Z" fill="#f8fafc" />
        </svg>
      );

    case 'med_first_aid':
      return (
        <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id="med_red" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </linearGradient>
          </defs>
          <path d="M25 12 L25 9 L39 9 L39 12" stroke="#fca5a5" strokeWidth="2" />
          <rect
            x="11"
            y="12"
            width="42"
            height="31"
            rx="5"
            fill="url(#med_red)"
            stroke="#f87171"
            strokeWidth="1.5"
          />
          <path d="M29 20 H35 V25 H40 V31 H35 V36 H29 V31 H24 V25 H29 Z" fill="#ffffff" />
        </svg>
      );

    case 'med_bandage':
      return (
        <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
          <g transform="rotate(-32 32 26)">
            <rect
              x="14"
              y="16"
              width="36"
              height="20"
              rx="4"
              fill="#d6cfc2"
              stroke="#f5f5f4"
              strokeWidth="1.4"
            />
            <ellipse cx="16" cy="26" rx="3.5" ry="10" fill="#78716c" stroke="#e7e5e4" strokeWidth="1.2" />
            <rect x="27" y="16" width="8" height="20" fill="#a8a29e" fillOpacity="0.55" />
          </g>
        </svg>
      );

    case 'con_energy_drink':
      return (
        <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
          <g transform="rotate(14 32 26)">
            <rect
              x="21"
              y="7"
              width="22"
              height="38"
              rx="4"
              fill="#1d4ed8"
              stroke="#60a5fa"
              strokeWidth="1.4"
            />
            <ellipse cx="32" cy="8" rx="10" ry="2.5" fill="#cbd5e1" />
            <path d="M34 15 L27 26 H33 L29 37 L38 24 H32 Z" fill="#facc15" />
          </g>
        </svg>
      );

    case 'con_canned_food':
      return (
        <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
          <rect
            x="18"
            y="10"
            width="28"
            height="33"
            rx="3"
            fill="#94a3b8"
            stroke="#e2e8f0"
            strokeWidth="1.4"
          />
          <rect x="18" y="18" width="28" height="17" fill="#b91c1c" />
          <ellipse cx="32" cy="11" rx="14" ry="3.5" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
          <circle cx="32" cy="26.5" r="5" fill="#f59e0b" />
        </svg>
      );

    case 'med_painkiller':
      return (
        <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
          <rect x="23" y="8" width="18" height="6" rx="1.5" fill="#f59e0b" stroke="#fde68a" strokeWidth="1" />
          <rect
            x="21"
            y="14"
            width="22"
            height="30"
            rx="4"
            fill="#e2e8f0"
            stroke="#94a3b8"
            strokeWidth="1.4"
          />
          <rect x="21" y="22" width="22" height="12" fill="#0284c7" />
          <path d="M30 25 H34 V27 H36 V30 H34 V32 H30 V30 H28 V27 H30 Z" fill="#ffffff" />
        </svg>
      );

    case 'med_morphine':
    case 'con_adrenaline':
      return (
        <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
          <g transform="rotate(-38 32 26)">
            <rect x="29" y="6" width="6" height="8" rx="1" fill="#ea580c" />
            <rect
              x="27"
              y="14"
              width="10"
              height="26"
              rx="2"
              fill="#cbd5e1"
              stroke="#64748b"
              strokeWidth="1.2"
            />
            <rect x="29" y="18" width="6" height="14" rx="1" fill="#f59e0b" />
            <line x1="32" y1="40" x2="32" y2="48" stroke="#e2e8f0" strokeWidth="1.8" />
          </g>
        </svg>
      );

    // 2. GRENADES & THROWABLES
    case 'tac_frag_grenade':
      return (
        <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
          <rect x="28" y="7" width="8" height="6" rx="1" fill="#94a3b8" />
          <path d="M36 9 L44 15 L42 30" stroke="#94a3b8" strokeWidth="2" fill="none" />
          <circle cx="26" cy="11" r="3.5" stroke="#eab308" strokeWidth="1.5" />
          <ellipse
            cx="32"
            cy="29"
            rx="13"
            ry="15"
            fill="#4d5e28"
            stroke="#84993c"
            strokeWidth="1.5"
          />
          <line x1="20" y1="24" x2="44" y2="24" stroke="#283114" strokeWidth="1.4" />
          <line x1="20" y1="33" x2="44" y2="33" stroke="#283114" strokeWidth="1.4" />
          <line x1="32" y1="15" x2="32" y2="43" stroke="#283114" strokeWidth="1.4" />
        </svg>
      );

    case 'tac_smoke_grenade':
    case 'tac_flashbang':
      return (
        <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
          <rect x="28" y="6" width="8" height="5" rx="1" fill="#94a3b8" />
          <path d="M36 8 L42 13 L41 26" stroke="#cbd5e1" strokeWidth="1.8" fill="none" />
          <rect
            x="22"
            y="11"
            width="20"
            height="34"
            rx="3"
            fill="#475569"
            stroke="#cbd5e1"
            strokeWidth="1.4"
          />
          <rect x="22" y="22" width="20" height="10" fill="#657b38" />
          <line x1="25" y1="16" x2="39" y2="16" stroke="#cbd5e1" strokeWidth="1.2" />
        </svg>
      );

    // 3. AMMUNITION
    case 'ammo_556':
    case 'ammo_762':
    case 'ammo_338':
      return (
        <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
          <g transform="rotate(-14 32 26)">
            <rect
              x="12"
              y="14"
              width="40"
              height="26"
              rx="3"
              fill={itemId === 'ammo_762' ? '#5c4d32' : '#78633b'}
              stroke="#d6b885"
              strokeWidth="1.4"
            />
            <line x1="12" y1="22" x2="52" y2="22" stroke="#3e321d" strokeWidth="2" />
            <rect x="18" y="26" width="28" height="9" rx="1" fill="#3e321d" />
            {[22, 29, 36, 42].map((bx) => (
              <rect key={bx} x={bx} y="27.5" width="3.5" height="6" rx="0.8" fill="#eab308" />
            ))}
          </g>
        </svg>
      );

    case 'ammo_9mm':
    case 'ammo_12g':
    case 'ammo_50ae':
      return (
        <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
          <rect
            x="12"
            y="22"
            width="40"
            height="20"
            rx="3"
            fill="#524129"
            stroke="#d6b885"
            strokeWidth="1.3"
          />
          {[18, 25, 32, 39, 45].map((cx) => (
            <g key={cx}>
              <path d={`M${cx - 2} 16 L${cx} 10 L${cx + 2} 16 Z`} fill="#ea580c" />
              <rect x={cx - 2} y="16" width="4" height="9" fill="#eab308" />
            </g>
          ))}
        </svg>
      );

    // 4. ATTACHMENTS
    case 'att_optic_2x':
    case 'att_optic_4x':
    case 'att_optic_8x':
      return (
        <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
          <g transform="rotate(-22 32 26)">
            <rect x="20" y="31" width="24" height="6" rx="1" fill="#334155" />
            <path
              d="M10 20 L20 22 L44 22 L54 17 L54 33 L44 29 L20 29 L10 31 Z"
              fill="#3f4a3c"
              stroke="#a3b899"
              strokeWidth="1.4"
            />
            <rect x="28" y="15" width="8" height="6" rx="1" fill="#1e293b" stroke="#94a3b8" strokeWidth="1" />
            <ellipse cx="54" cy="25" rx="2.5" ry="7.5" fill="#34d399" />
          </g>
        </svg>
      );

    case 'att_optic_red_dot':
    case 'att_optic_holo':
      return (
        <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
          <rect x="16" y="32" width="32" height="7" rx="1.5" fill="#1e293b" stroke="#64748b" strokeWidth="1.2" />
          <path
            d="M18 14 L46 14 L48 32 L16 32 Z"
            fill="#0f172a"
            stroke="#94a3b8"
            strokeWidth="1.5"
          />
          <rect x="22" y="17" width="20" height="11" rx="2" fill="#dc2626" fillOpacity="0.35" />
          <circle cx="32" cy="22.5" r="2.5" fill="#ef4444" />
        </svg>
      );

    case 'att_muzzle_suppressor':
    case 'att_muzzle_compensator':
    case 'att_muzzle_choke':
      return (
        <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
          <g transform="rotate(-28 32 26)">
            <rect
              x="8"
              y="19"
              width="48"
              height="14"
              rx="3.5"
              fill="#334155"
              stroke="#94a3b8"
              strokeWidth="1.4"
            />
            <line x1="18" y1="19" x2="18" y2="33" stroke="#0f172a" strokeWidth="2" />
            <line x1="26" y1="19" x2="26" y2="33" stroke="#0f172a" strokeWidth="1.5" />
            <ellipse cx="55" cy="26" rx="2" ry="6" fill="#0f172a" />
          </g>
        </svg>
      );

    case 'att_grip_vertical':
    case 'att_grip_angled':
      return (
        <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
          <rect x="18" y="9" width="28" height="7" rx="1.5" fill="#475569" stroke="#cbd5e1" strokeWidth="1.2" />
          <path
            d="M24 16 L40 16 L38 44 L26 44 Z"
            fill="#1e293b"
            stroke="#94a3b8"
            strokeWidth="1.4"
          />
          {[22, 28, 34].map((gy) => (
            <line key={gy} x1="26" y1={gy} x2="38" y2={gy} stroke="#475569" strokeWidth="2" />
          ))}
        </svg>
      );

    case 'att_mag_ext_ar':
    case 'att_mag_fast_smg':
    case 'att_mag_ext_heavy':
      return (
        <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
          <path
            d="M24 8 L40 8 C43 22 46 34 50 45 L33 47 C28 35 25 22 24 8 Z"
            fill="#334155"
            stroke="#94a3b8"
            strokeWidth="1.4"
          />
          <line x1="30" y1="15" x2="39" y2="39" stroke="#eab308" strokeWidth="2.2" strokeDasharray="3 2" />
        </svg>
      );

    case 'att_stock_tactical':
    case 'att_stock_lightweight':
      return (
        <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
          <path
            d="M12 14 L52 14 L52 24 L36 28 L20 42 L12 40 Z"
            fill="#334155"
            stroke="#94a3b8"
            strokeWidth="1.4"
          />
          <polygon points="22,22 34,22 24,33" fill="#090d12" />
        </svg>
      );

    // 5. ARMOR, HELMETS & BACKPACKS
    case 'gear_helmet_lv2':
    case 'gear_helmet_lv3':
      return (
        <CustomGearIcon
          slot="helmet"
          tier={itemId === 'gear_helmet_lv3' ? 3 : 2}
          className={className}
        />
      );

    case 'gear_armor_lv2':
    case 'gear_armor_lv3':
    case 'gear_armor_plate':
      return (
        <CustomGearIcon
          slot="armor"
          tier={itemId === 'gear_armor_lv3' ? 3 : 2}
          className={className}
        />
      );

    case 'gear_backpack_lv1':
    case 'gear_backpack_lv2':
    case 'gear_backpack_lv3':
      return (
        <CustomGearIcon
          slot="backpack"
          tier={itemId === 'gear_backpack_lv3' ? 3 : 2}
          className={className}
        />
      );

    // 6. TACTICAL TOOLS
    case 'tac_grapple_hook':
      return (
        <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
          <circle cx="24" cy="32" r="10" stroke="#94a3b8" strokeWidth="2.5" strokeDasharray="4 2" />
          <line x1="28" y1="28" x2="46" y2="12" stroke="#cbd5e1" strokeWidth="2.4" />
          <path d="M36 10 Q48 8 48 20" stroke="#e2e8f0" strokeWidth="2.2" fill="none" />
          <path d="M40 18 Q52 16 50 26" stroke="#e2e8f0" strokeWidth="2" fill="none" />
        </svg>
      );

    case 'tac_toolkit':
      return (
        <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
          <path d="M24 14 V10 H40 V14" stroke="#cbd5e1" strokeWidth="2" />
          <rect
            x="12"
            y="14"
            width="40"
            height="28"
            rx="3"
            fill="#b91c1c"
            stroke="#f87171"
            strokeWidth="1.4"
          />
          <line x1="12" y1="25" x2="52" y2="25" stroke="#1e293b" strokeWidth="2" />
          <rect x="20" y="22" width="5" height="6" rx="1" fill="#e2e8f0" />
          <rect x="39" y="22" width="5" height="6" rx="1" fill="#e2e8f0" />
        </svg>
      );

    case 'tac_detector':
    case 'tac_rangefinder':
    default:
      return (
        <svg viewBox="0 0 64 52" fill="none" className={className} aria-hidden="true">
          <g transform="rotate(-18 32 26)">
            <line x1="26" y1="6" x2="26" y2="15" stroke="#38bdf8" strokeWidth="2.2" />
            <rect
              x="20"
              y="14"
              width="24"
              height="30"
              rx="4"
              fill="#1e293b"
              stroke="#94a3b8"
              strokeWidth="1.4"
            />
            <rect x="24" y="18" width="16" height="12" rx="2" fill="#0284c7" />
            <circle cx="32" cy="24" r="3" fill="#38bdf8" />
            <circle cx="28" cy="36" r="2" fill="#94a3b8" />
            <circle cx="36" cy="36" r="2" fill="#22c55e" />
          </g>
        </svg>
      );
  }
};
