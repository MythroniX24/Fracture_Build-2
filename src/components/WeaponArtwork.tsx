import React from 'react';
import { WeaponId } from '../game/config.ts';

export interface WeaponIllustrationProps {
  weaponId: WeaponId;
  className?: string;
}

/**
 * High-detail side-profile firearm illustrations for Loadout Pair cards and HUD Weapon Slots.
 * Pure visual firearm silhouettes & metallic details — no text labels.
 */
export const WeaponIllustration: React.FC<WeaponIllustrationProps> = ({
  weaponId,
  className = 'w-24 h-10',
}) => {
  switch (weaponId) {
    case 'm4a1':
      return (
        <svg
          viewBox="0 0 220 76"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="m4_metal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e4e4e7" />
              <stop offset="45%" stopColor="#71717a" />
              <stop offset="100%" stopColor="#27272a" />
            </linearGradient>
            <linearGradient id="m4_body" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#52525b" />
              <stop offset="100%" stopColor="#18181b" />
            </linearGradient>
          </defs>
          {/* SOPMOD Collapsible Buttstock */}
          <path
            d="M12 25 L54 25 L54 41 L32 45 L16 55 L10 53 L12 25 Z"
            fill="url(#m4_body)"
            stroke="#a1a1aa"
            strokeWidth="1.2"
          />
          <rect x="8" y="24" width="5" height="30" rx="2" fill="#18181b" />
          {/* Buffer tube */}
          <rect x="48" y="26" width="18" height="8" fill="#3f3f46" />
          {/* Upper & Lower Receiver */}
          <path
            d="M64 21 L126 21 L126 44 L96 44 L90 40 L64 40 Z"
            fill="url(#m4_metal)"
            stroke="#d4d4d8"
            strokeWidth="1.2"
          />
          {/* Ejection Port & Bolt Carrier */}
          <rect x="92" y="25" width="20" height="5" rx="1" fill="#e4e4e7" />
          {/* Picatinny Top Rail */}
          <path
            d="M68 18 L172 18 L172 21 L68 21 Z"
            fill="#27272a"
            stroke="#a1a1aa"
            strokeWidth="0.9"
          />
          {/* Holographic Reflex Sight */}
          <path
            d="M84 9 L108 9 L111 18 L82 18 Z"
            fill="#27272a"
            stroke="#e4e4e7"
            strokeWidth="1.2"
          />
          <rect x="88" y="11" width="14" height="5" rx="1" fill="#38bdf8" fillOpacity="0.65" />
          {/* Ergonomic Pistol Grip */}
          <path
            d="M68 40 L81 40 L73 65 L61 63 L68 40 Z"
            fill="#27272a"
            stroke="#71717a"
            strokeWidth="1.1"
          />
          {/* Trigger Guard & Trigger */}
          <path d="M81 42 Q88 50 96 44" stroke="#a1a1aa" strokeWidth="1.5" fill="none" />
          <path d="M86 40 Q88 45 85 47" stroke="#f4f4f5" strokeWidth="1.6" fill="none" />
          {/* Curved STANAG 30-Round Magazine */}
          <path
            d="M98 43 L116 43 L123 71 L104 73 L98 43 Z"
            fill="url(#m4_body)"
            stroke="#a1a1aa"
            strokeWidth="1.2"
          />
          <line x1="104" y1="49" x2="118" y2="66" stroke="#71717a" strokeWidth="1.2" />
          {/* M-LOK Tactical Handguard */}
          <rect
            x="126"
            y="22"
            width="48"
            height="16"
            rx="2"
            fill="url(#m4_body)"
            stroke="#a1a1aa"
            strokeWidth="1.2"
          />
          {/* Handguard cooling slots */}
          <rect x="132" y="26" width="8" height="3" rx="1" fill="#18181b" />
          <rect x="145" y="26" width="8" height="3" rx="1" fill="#18181b" />
          <rect x="158" y="26" width="8" height="3" rx="1" fill="#18181b" />
          <rect x="132" y="32" width="10" height="2.5" rx="1" fill="#a1a1aa" />
          <rect x="148" y="32" width="10" height="2.5" rx="1" fill="#a1a1aa" />
          {/* Front Sight Post & Barrel + Birdcage Flash Hider */}
          <path d="M168 12 L173 12 L175 22 L166 22 Z" fill="#52525b" />
          <rect x="174" y="27" width="28" height="5" fill="url(#m4_metal)" />
          <rect
            x="201"
            y="25.5"
            width="12"
            height="8"
            rx="1.5"
            fill="#52525b"
            stroke="#d4d4d8"
            strokeWidth="1"
          />
        </svg>
      );

    case 'ak47':
      return (
        <svg
          viewBox="0 0 220 76"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="ak_wood" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#d97706" />
              <stop offset="55%" stopColor="#92400e" />
              <stop offset="100%" stopColor="#451a03" />
            </linearGradient>
            <linearGradient id="ak_steel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4d4d8" />
              <stop offset="50%" stopColor="#52525b" />
              <stop offset="100%" stopColor="#18181b" />
            </linearGradient>
          </defs>
          {/* Classic Hardwood Fixed Stock */}
          <path
            d="M10 28 L60 25 L60 39 L26 52 L10 49 Z"
            fill="url(#ak_wood)"
            stroke="#f59e0b"
            strokeWidth="1.1"
          />
          {/* Stamped Steel Receiver & Dust Cover */}
          <path
            d="M60 21 L126 21 L128 40 L60 40 Z"
            fill="url(#ak_steel)"
            stroke="#a1a1aa"
            strokeWidth="1.2"
          />
          <path d="M64 21 Q94 17 124 21" stroke="#e4e4e7" strokeWidth="1.4" fill="none" />
          {/* Charging Handle & Selector Lever */}
          <rect x="92" y="25" width="22" height="4.5" rx="1" fill="#f4f4f5" />
          {/* Bakelite Pistol Grip */}
          <path
            d="M66 40 L79 40 L71 64 L59 62 Z"
            fill="#9a3412"
            stroke="#fb923c"
            strokeWidth="1"
          />
          {/* Iconic Deep-Curved 7.62x39mm Banana Magazine */}
          <path
            d="M99 39 L118 39 C124 53 132 64 140 72 L121 74 C112 64 103 52 99 39 Z"
            fill="#ea580c"
            stroke="#fdba74"
            strokeWidth="1.2"
          />
          {/* Wood Upper & Lower Handguard */}
          <path
            d="M126 22 L168 23 L166 37 L126 38 Z"
            fill="url(#ak_wood)"
            stroke="#f59e0b"
            strokeWidth="1.1"
          />
          <rect x="134" y="27" width="22" height="3" rx="1" fill="#451a03" />
          {/* Gas Tube & Rifle Barrel */}
          <rect x="166" y="23" width="22" height="4" fill="#71717a" />
          <rect x="166" y="29" width="40" height="4.5" fill="url(#ak_steel)" />
          {/* Iconic AK Front Sight Hood & Slant Muzzle Brake */}
          <path d="M192 15 L199 15 L201 29 L190 29 Z" fill="#71717a" stroke="#d4d4d8" strokeWidth="1" />
          <path d="M206 28 L214 26 L212 34 L206 34 Z" fill="#d4d4d8" />
        </svg>
      );

    case 'mp5':
      return (
        <svg
          viewBox="0 0 220 76"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="mp5_steel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e4e4e7" />
              <stop offset="50%" stopColor="#52525b" />
              <stop offset="100%" stopColor="#18181b" />
            </linearGradient>
          </defs>
          {/* Collapsible Wire Stock */}
          <rect x="18" y="29" width="44" height="3.5" fill="#a1a1aa" />
          <path d="M14 21 L22 21 L22 46 L14 44 Z" fill="#27272a" stroke="#a1a1aa" strokeWidth="1.2" />
          {/* Upper Roller-Delayed Receiver */}
          <rect
            x="60"
            y="20"
            width="86"
            height="21"
            rx="3"
            fill="url(#mp5_steel)"
            stroke="#d4d4d8"
            strokeWidth="1.2"
          />
          {/* Reflex Red-Dot Optic */}
          <path
            d="M84 10 L106 10 L108 20 L82 20 Z"
            fill="#18181b"
            stroke="#38bdf8"
            strokeWidth="1.2"
          />
          <circle cx="95" cy="15" r="2.2" fill="#ef4444" />
          {/* Pistol Grip */}
          <path
            d="M68 41 L82 41 L75 65 L62 63 Z"
            fill="#27272a"
            stroke="#71717a"
            strokeWidth="1.1"
          />
          {/* Curved 9mm SMG Magazine */}
          <path
            d="M108 41 L122 41 C126 53 131 63 136 72 L123 73 C117 63 111 52 108 41 Z"
            fill="#3f3f46"
            stroke="#d4d4d8"
            strokeWidth="1.2"
          />
          {/* Vertical Foregrip & Integrated Suppressor Barrel */}
          <rect x="136" y="40" width="9" height="19" rx="2" fill="#27272a" stroke="#a1a1aa" strokeWidth="1" />
          <rect
            x="146"
            y="23"
            width="52"
            height="13"
            rx="3"
            fill="#3f3f46"
            stroke="#e4e4e7"
            strokeWidth="1.2"
          />
          <line x1="158" y1="24" x2="158" y2="35" stroke="#a1a1aa" strokeWidth="1" />
          <line x1="172" y1="24" x2="172" y2="35" stroke="#a1a1aa" strokeWidth="1" />
          <line x1="186" y1="24" x2="186" y2="35" stroke="#a1a1aa" strokeWidth="1" />
        </svg>
      );

    case 'spas12':
      return (
        <svg
          viewBox="0 0 220 76"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="spas_metal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f4f4f5" />
              <stop offset="50%" stopColor="#71717a" />
              <stop offset="100%" stopColor="#27272a" />
            </linearGradient>
          </defs>
          {/* Tactical Folding Stock & Hook */}
          <path
            d="M12 27 L58 24 L58 38 L22 49 L12 46 Z"
            fill="#27272a"
            stroke="#a1a1aa"
            strokeWidth="1.2"
          />
          {/* Heavy Combat Shotgun Receiver */}
          <path
            d="M58 20 L132 20 L136 39 L58 39 Z"
            fill="url(#spas_metal)"
            stroke="#e4e4e7"
            strokeWidth="1.3"
          />
          <rect x="88" y="25" width="24" height="5" rx="1" fill="#18181b" />
          {/* Pistol Grip */}
          <path
            d="M62 39 L76 39 L69 64 L56 62 Z"
            fill="#18181b"
            stroke="#a1a1aa"
            strokeWidth="1.1"
          />
          {/* Ventilated Heatshield Barrel + Under-barrel Tube Magazine */}
          <rect x="132" y="20" width="74" height="6" fill="url(#spas_metal)" stroke="#d4d4d8" strokeWidth="1" />
          <rect x="132" y="27" width="70" height="5" fill="#52525b" />
          {/* Ribbed Pump-Action Foregrip */}
          <rect
            x="138"
            y="31"
            width="42"
            height="11"
            rx="2"
            fill="#f59e0b"
            fillOpacity="0.88"
            stroke="#fde68a"
            strokeWidth="1.2"
          />
          <line x1="146" y1="31" x2="146" y2="42" stroke="#451a03" strokeWidth="1.5" />
          <line x1="154" y1="31" x2="154" y2="42" stroke="#451a03" strokeWidth="1.5" />
          <line x1="162" y1="31" x2="162" y2="42" stroke="#451a03" strokeWidth="1.5" />
          <line x1="170" y1="31" x2="170" y2="42" stroke="#451a03" strokeWidth="1.5" />
          {/* Heavy Breacher Muzzle Choke */}
          <rect x="206" y="19" width="9" height="9" rx="1" fill="#e4e4e7" />
        </svg>
      );

    case 'awp':
      return (
        <svg
          viewBox="0 0 220 76"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="awp_chassis" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="55%" stopColor="#047857" />
              <stop offset="100%" stopColor="#064e3b" />
            </linearGradient>
            <linearGradient id="awp_barrel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f4f4f5" />
              <stop offset="50%" stopColor="#71717a" />
              <stop offset="100%" stopColor="#18181b" />
            </linearGradient>
          </defs>
          {/* Accuracy International Thumbhole Polymer Chassis */}
          <path
            d="M8 26 L146 26 L152 38 L88 41 L74 62 L58 62 L62 43 L34 45 L14 54 L8 52 Z"
            fill="url(#awp_chassis)"
            stroke="#6ee7b7"
            strokeWidth="1.2"
          />
          {/* Thumbhole Cutout */}
          <ellipse cx="48" cy="36" rx="9" ry="5" fill="#090d12" stroke="#34d399" strokeWidth="0.9" />
          {/* Adjustable Cheek Rest */}
          <rect x="18" y="21" width="26" height="5" rx="2" fill="#18181b" stroke="#a1a1aa" strokeWidth="0.9" />
          {/* Dual Scope Mount Rings & Long 8x Sniper Scope */}
          <rect x="74" y="15" width="6" height="11" fill="#52525b" />
          <rect x="112" y="15" width="6" height="11" fill="#52525b" />
          <path
            d="M58 9 L68 12 L120 12 L134 7 L134 19 L120 16 L68 16 L58 18 Z"
            fill="url(#awp_barrel)"
            stroke="#e4e4e7"
            strokeWidth="1.2"
          />
          {/* Scope Objective Lens Glow */}
          <ellipse cx="134" cy="13" rx="2" ry="5.5" fill="#38bdf8" />
          {/* Box .338 Lapua Magnum Magazine */}
          <rect
            x="92"
            y="40"
            width="22"
            height="18"
            rx="1.5"
            fill="#27272a"
            stroke="#a1a1aa"
            strokeWidth="1.1"
          />
          {/* Free-Floated Heavy Fluted Sniper Barrel + Large Double-Baffle Muzzle Brake */}
          <rect x="142" y="23" width="62" height="5" fill="url(#awp_barrel)" />
          <rect
            x="202"
            y="20.5"
            width="13"
            height="10"
            rx="1.5"
            fill="#d4d4d8"
            stroke="#18181b"
            strokeWidth="1"
          />
          {/* Folding Front Bipod */}
          <path d="M148 37 L166 52" stroke="#a1a1aa" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'deagle':
      return (
        <svg
          viewBox="0 0 220 76"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="deagle_chrome" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fafafa" />
              <stop offset="45%" stopColor="#d4d4d8" />
              <stop offset="80%" stopColor="#71717a" />
              <stop offset="100%" stopColor="#27272a" />
            </linearGradient>
          </defs>
          {/* Massive Triangular .50 AE Slide & Barrel Assembly */}
          <path
            d="M54 15 L176 15 L182 35 L60 35 L50 28 Z"
            fill="url(#deagle_chrome)"
            stroke="#ffffff"
            strokeWidth="1.4"
          />
          {/* Slide Serrations & Ejection Port */}
          <rect x="96" y="18" width="28" height="6" rx="1" fill="#27272a" />
          <line x1="66" y1="20" x2="66" y2="31" stroke="#3f3f46" strokeWidth="2" />
          <line x1="72" y1="20" x2="72" y2="31" stroke="#3f3f46" strokeWidth="2" />
          <line x1="78" y1="20" x2="78" y2="31" stroke="#3f3f46" strokeWidth="2" />
          {/* Front & Rear Combat Sights */}
          <rect x="60" y="10" width="8" height="5" fill="#18181b" />
          <rect x="166" y="10" width="6" height="5" fill="#ef4444" />
          {/* Lower Frame & Trigger Guard */}
          <path
            d="M62 35 L154 35 L150 41 L108 41 L104 50 L86 50 L62 35 Z"
            fill="#52525b"
            stroke="#d4d4d8"
            strokeWidth="1.1"
          />
          {/* Ergonomic Rubberized Grip & Extended Mag Baseplate */}
          <path
            d="M62 35 L90 35 L78 68 L50 66 Z"
            fill="#18181b"
            stroke="#a1a1aa"
            strokeWidth="1.3"
          />
          <rect x="48" y="65" width="32" height="5" rx="1.5" fill="#d4d4d8" />
        </svg>
      );
  }
};

/**
 * Custom Pro Mobile-Shooter Action Icons (Zero text labels on buttons).
 */
export const HudActionIcon: React.FC<{
  kind: 'fire' | 'ads' | 'reload' | 'jump' | 'crouch' | 'slide';
  className?: string;
}> = ({ kind, className = 'w-6 h-6' }) => {
  switch (kind) {
    case 'fire':
      // High-impact supersonic bullet + precision crosshair ring
      return (
        <svg
          className={className}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.8" strokeDasharray="4 3" />
          <path
            d="M16 2V6M16 26V30M2 16H6M26 16H30"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {/* Diagonal High-Caliber Cartridge */}
          <path
            d="M21.5 10.5C23 12 22.5 14.5 20.5 16.5L14.5 22.5L9.5 17.5L15.5 11.5C17.5 9.5 20 9 21.5 10.5Z"
            fill="currentColor"
          />
          <path d="M8 19L13 24L11 26L6 21L8 19Z" fill="currentColor" />
        </svg>
      );

    case 'ads':
      // Precision Sniper Scope Reticle with mil-dots
      return (
        <svg
          className={className}
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="14" cy="14" r="9.5" stroke="currentColor" strokeWidth="2" />
          <circle cx="14" cy="14" r="4" stroke="currentColor" strokeWidth="1.3" strokeOpacity="0.7" />
          <circle cx="14" cy="14" r="1.5" fill="currentColor" />
          <path
            d="M14 1.5V7M14 21V26.5M1.5 14H7M21 14H26.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'reload':
      // Curved rifle magazine with twin circular reload arrows
      return (
        <svg
          className={className}
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M6.5 9.5A9 9 0 0 1 21.5 8.5M22.5 18.5A9 9 0 0 1 7.5 19.5"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <path d="M18.5 5L22 8.8L18 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.5 23L6 19.2L10 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {/* Magazine silhouette in center */}
          <path
            d="M12 10H16L17 18H13L12 10Z"
            fill="currentColor"
          />
        </svg>
      );

    case 'jump':
      // Dynamic leaping operator + upward thrust chevrons
      return (
        <svg
          className={className}
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="14" cy="6.5" r="2.5" fill="currentColor" />
          <path
            d="M9 12.5L14 10.5L19 12.5M14 10.5V16.5M14 16.5L10.5 21.5M14 16.5L17.5 20.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8.5 25L14 21.5L19.5 25"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'crouch':
      // Low-profile tactical crouching operator icon
      return (
        <svg
          className={className}
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="15.5" cy="8.5" r="2.5" fill="currentColor" />
          <path
            d="M11 14L15.5 12.5L20.5 14.5M11 14L13.5 18.5L18.5 18.5L20 23.5M13.5 18.5L9.5 23.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M6 25H22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.6" />
        </svg>
      );

    case 'slide':
      // High-speed tactical combat slide icon with motion streaks
      return (
        <svg
          className={className}
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Speed motion lines */}
          <path
            d="M3 12H8M2 16H6.5M4 20H9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Sliding operator silhouette */}
          <circle cx="14.5" cy="9.5" r="2.4" fill="currentColor" />
          <path
            d="M11.5 14.5L16.5 13.5L22 15.5M12.5 14.5L16.5 19.5L24.5 21.5M16.5 19.5L11.5 22"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M7 24.5H25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
  }
};
