import React, { useEffect, useState } from 'react';
import {
  ARENA_REGISTRY,
  ArenaId,
  BOT_DIFFICULTIES,
  BotDifficulty,
  CHARACTER_REGISTRY,
  CharacterId,
  GameMode,
  GameSettings,
  ScreenState,
} from '../game/config.ts';
import { SimulationState } from '../game/rules.ts';
import {
  MultiplayerClient,
  OpenRoomListing,
  RoomStatePayload,
} from '../network/multiplayerClient.ts';
import { soundEngine } from '../audio/soundEngine.ts';

interface MenuScreensProps {
  screenState: ScreenState;
  gameMode: GameMode;
  p1Char: CharacterId;
  p2Char: CharacterId;
  arenaId: ArenaId;
  botDifficulty: BotDifficulty;
  roundsToWin: number;
  roundTimeSeconds: number;
  settings: GameSettings;
  settingsOpen: boolean;
  isFullscreen: boolean;
  sim: SimulationState;
  mpClient: MultiplayerClient;
  mpRoom: RoomStatePayload | null;
  mpStatus: string;
  mpError: string | null;
  onNavigate: (screen: ScreenState) => void;
  onSelectMode: (mode: GameMode) => void;
  onSelectP1Char: (id: CharacterId) => void;
  onSelectP2Char: (id: CharacterId) => void;
  onSelectArena: (id: ArenaId) => void;
  onSelectDifficulty: (diff: BotDifficulty) => void;
  onChangeMatchRules: (rounds: number, timer: number) => void;
  onStartCombat: () => void;
  onResumeCombat: () => void;
  onRestartMatch: () => void;
  onToggleFullscreen: () => void;
  onOpenSettings: (open: boolean) => void;
  onUpdateSettings: (updates: Partial<GameSettings>) => void;
}

const formatKeyBinding = (code: string): string => {
  if (!code) return '-';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
  if (code === 'Space') return 'SPACE';
  if (code === 'Tab') return 'TAB';
  return code.toUpperCase();
};

export const MenuScreens: React.FC<MenuScreensProps> = ({
  screenState,
  gameMode,
  p1Char,
  p2Char,
  arenaId,
  botDifficulty,
  roundsToWin,
  roundTimeSeconds,
  settings,
  settingsOpen,
  isFullscreen,
  sim,
  mpClient,
  mpRoom,
  mpStatus,
  mpError,
  onNavigate,
  onSelectMode,
  onSelectP1Char,
  onSelectP2Char,
  onSelectArena,
  onSelectDifficulty,
  onChangeMatchRules,
  onStartCombat,
  onResumeCombat,
  onRestartMatch,
  onToggleFullscreen,
  onOpenSettings,
  onUpdateSettings,
}) => {
  const [playerName, setPlayerName] = useState('Vanguard-01');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [openRooms, setOpenRooms] = useState<OpenRoomListing[]>([]);
  const [rebindingKey, setRebindingKey] = useState<keyof GameSettings['keybindings'] | null>(null);

  // Refresh open rooms when inside multiplayer lobby
  useEffect(() => {
    if (screenState !== 'multiplayer_lobby') return;
    let mounted = true;
    const loadRooms = async () => {
      const list = await mpClient.fetchOpenRooms();
      if (mounted) setOpenRooms(list);
    };
    loadRooms();
    const id = window.setInterval(loadRooms, 1000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [screenState, mpClient]);

  // Listen for key press when rebinding a control in Settings
  useEffect(() => {
    if (!rebindingKey) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== 'Escape') {
        onUpdateSettings({
          keybindings: {
            ...settings.keybindings,
            [rebindingKey]: e.code,
          },
        });
      }
      setRebindingKey(null);
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [rebindingKey, settings.keybindings, onUpdateSettings]);

  const renderStatBar = (label: string, val: number) => (
    <div className="flex items-center gap-3">
      <span className="w-20 text-xs font-mono text-[#a8a29e] uppercase">{label}</span>
      <div className="flex-1 h-2 bg-[#0d0e11] border border-[#3f3f46]">
        <div
          className="h-full bg-[#d97706]"
          style={{ width: `${Math.min(100, val * 10)}%` }}
        />
      </div>
      <span className="w-6 text-right text-xs font-mono tabular-nums text-[#e6e4e0]">{val}/10</span>
    </div>
  );

  return (
    <>
      {/* =====================================================================
          1. MAIN MENU SCREEN (Asymmetric Left-Third Lockup over Live 3D Stage)
         ===================================================================== */}
      {screenState === 'main_menu' && (
        <main className="fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-10 hud-safe-padding pointer-events-none overflow-y-auto">
          <div className="w-full max-w-[1360px] mx-auto flex-1 flex flex-col justify-center">
            <div className="max-w-md pointer-events-auto bg-[#0d0e11]/90 border border-[#3f3f46] p-5 sm:p-7 flex flex-col gap-5">
              {/* Custom Inline <svg> Title Emblem & Industrial Lockup */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <svg
                    viewBox="0 0 48 48"
                    className="w-11 h-11 shrink-0"
                    aria-hidden="true"
                  >
                    <polygon
                      points="24,2 44,12 44,36 24,46 4,36 4,12"
                      fill="#181a20"
                      stroke="#d97706"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M17 12 L31 12 L22 25 L32 25 L16 38 L21 26 L14 26 Z"
                      fill="#d97706"
                    />
                  </svg>
                  <div>
                    <h1 className="font-display font-extrabold text-5xl sm:text-6xl tracking-wider text-[#e6e4e0] leading-none">
                      FRACTURE
                    </h1>
                    <p className="text-xs font-mono text-[#a8a29e] tracking-widest mt-1">
                      COLOSSUS ARENA COMBAT
                    </p>
                  </div>
                </div>

                {/* Accessible Fullscreen Toggle in Main Menu Header */}
                <button
                  type="button"
                  onClick={onToggleFullscreen}
                  aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen & Landscape Mode'}
                  className="px-2.5 py-1.5 bg-[#161920] hover:bg-[#222631] border border-[#3f3f46] hover:border-[#d97706] text-[10px] font-mono text-[#e6e4e0] uppercase flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current" strokeWidth="2">
                    {isFullscreen ? (
                      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                    ) : (
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    )}
                  </svg>
                  <span className="hidden sm:inline">{isFullscreen ? 'EXIT FULL' : '16:9 FULL'}</span>
                </button>
              </div>

              {/* Primary Start CTA & Main Navigation */}
              <nav aria-label="Main Menu" className="flex flex-col gap-2.5">
                <button
                  type="button"
                  data-start="true"
                  onClick={() => {
                    soundEngine.play('ui_confirm');
                    onSelectMode('bot');
                    onStartCombat();
                  }}
                  className="w-full py-3.5 px-5 bg-[#d97706] hover:bg-[#f59e0b] text-black font-display font-extrabold text-xl tracking-wider uppercase flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>PLAY NOW</span>
                  <span className="font-mono text-xs font-bold">ENTER ARENA →</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('ui_click');
                    onSelectMode('bot');
                    onNavigate('mode_select');
                  }}
                  className="w-full py-2.5 px-4 bg-[#161920] hover:bg-[#222631] border border-[#3f3f46] hover:border-[#d97706] text-[#e6e4e0] font-display font-bold text-lg tracking-wide uppercase flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>SINGLE PLAYER SETUP</span>
                  <span className="font-mono text-xs text-[#a8a29e]">VS AI BOT</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('ui_click');
                    onSelectMode('training');
                    onStartCombat();
                  }}
                  className="w-full py-2.5 px-4 bg-[#161920] hover:bg-[#222631] border border-[#3f3f46] hover:border-[#d97706] text-[#e6e4e0] font-display font-bold text-lg tracking-wide uppercase flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>TRAINING</span>
                  <span className="font-mono text-xs text-[#a8a29e]">PRACTICE LAB</span>
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.play('ui_click');
                      onNavigate('character_select');
                    }}
                    className="py-2.5 px-4 bg-[#161920] hover:bg-[#222631] border border-[#3f3f46] hover:border-[#d97706] text-[#e6e4e0] font-display font-bold text-base tracking-wide uppercase text-left transition-colors cursor-pointer"
                  >
                    CHARACTERS
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.play('ui_click');
                      onNavigate('arena_select');
                    }}
                    className="py-2.5 px-4 bg-[#161920] hover:bg-[#222631] border border-[#3f3f46] hover:border-[#d97706] text-[#e6e4e0] font-display font-bold text-base tracking-wide uppercase text-left transition-colors cursor-pointer"
                  >
                    ARENAS
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.play('ui_click');
                      onSelectMode('multiplayer');
                      onNavigate('multiplayer_lobby');
                    }}
                    className="py-2.5 px-4 bg-[#161920] hover:bg-[#222631] border border-[#3f3f46] hover:border-[#38bdf8] text-[#e6e4e0] font-display font-bold text-base tracking-wide uppercase text-left transition-colors cursor-pointer"
                  >
                    MULTIPLAYER
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.play('ui_click');
                      onOpenSettings(true);
                    }}
                    className="py-2.5 px-4 bg-[#161920] hover:bg-[#222631] border border-[#3f3f46] hover:border-[#d97706] text-[#e6e4e0] font-display font-bold text-base tracking-wide uppercase text-left transition-colors cursor-pointer"
                  >
                    SETTINGS
                  </button>
                </div>
              </nav>

              {/* Current Loadout Summary */}
              <div className="pt-3 border-t border-[#27272a] flex items-center justify-between text-xs font-mono text-[#a8a29e]">
                <span>FIGHTER: {CHARACTER_REGISTRY[p1Char].name}</span>
                <span>·</span>
                <span>ARENA: {ARENA_REGISTRY[arenaId].name}</span>
              </div>
            </div>
          </div>

          {/* Flat Borderless Control Hint Line in Bottom Safe Margin */}
          <div className="w-full max-w-[1360px] mx-auto flex items-center justify-between text-xs font-mono text-[#a8a29e] hud-stroke pt-2">
            <span>
              WASD Move · LMB/J Light · K Heavy · RMB/L Guard/Parry · Space Dodge · E/U Ability · Tab Lock-On
            </span>
            <span className="hidden sm:inline">PRESS ENTER OR SPACE TO FIGHT</span>
          </div>
        </main>
      )}

      {/* =====================================================================
          2. MODE SELECTION SCREEN
         ===================================================================== */}
      {screenState === 'mode_select' && (
        <section className="fixed inset-0 z-20 flex items-center justify-center p-6 bg-black/55 overflow-y-auto">
          <div className="w-full max-w-3xl bg-[#12141a] border border-[#3f3f46] p-6 sm:p-8 flex flex-col gap-6 my-auto">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
              <div>
                <h2 className="font-display font-bold text-3xl tracking-wider uppercase text-[#e6e4e0]">
                  SELECT COMBAT MODE
                </h2>
                <p className="text-xs font-mono text-[#a8a29e]">
                  Choose single-player AI challenge, free practice lab, or online arena lobby
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('main_menu')}
                className="px-4 py-2 bg-[#1c1f26] hover:bg-[#27272a] border border-[#3f3f46] text-xs font-mono uppercase text-[#e6e4e0]"
              >
                ← Back
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#181b22] border border-[#3f3f46] p-5 flex flex-col justify-between gap-4">
                <div>
                  <h3 className="font-display font-bold text-2xl text-[#d97706] uppercase">
                    SINGLE PLAYER (BOTS)
                  </h3>
                  <p className="text-xs text-[#a8a29e] mt-1">
                    Battle autonomous Colossus combat units offline across three tactical difficulty tiers.
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    {(['easy', 'normal', 'hard'] as BotDifficulty[]).map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => onSelectDifficulty(diff)}
                        className={`px-3 py-2 text-left text-xs font-mono border transition-colors ${
                          botDifficulty === diff
                            ? 'bg-[#d97706] text-black border-[#d97706] font-bold'
                            : 'bg-[#12141a] text-[#e6e4e0] border-[#3f3f46]'
                        }`}
                      >
                        {BOT_DIFFICULTIES[diff].label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSelectMode('bot');
                    onNavigate('character_select');
                  }}
                  className="w-full py-2.5 bg-[#d97706] hover:bg-[#f59e0b] text-black font-display font-bold text-base uppercase tracking-wider"
                >
                  Select Fighter →
                </button>
              </div>

              <div className="bg-[#181b22] border border-[#3f3f46] p-5 flex flex-col justify-between gap-4">
                <div>
                  <h3 className="font-display font-bold text-2xl text-[#38bdf8] uppercase">
                    TRAINING LAB
                  </h3>
                  <p className="text-xs text-[#a8a29e] mt-1">
                    Configurable target dummy, live attack phase readout, infinite stamina, and counter-timing drills.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSelectMode('training');
                    onNavigate('character_select');
                  }}
                  className="w-full py-2.5 bg-[#0284c7] hover:bg-[#38bdf8] text-black font-display font-bold text-base uppercase tracking-wider"
                >
                  Configure Training →
                </button>
              </div>

              <div className="bg-[#181b22] border border-[#3f3f46] p-5 flex flex-col justify-between gap-4">
                <div>
                  <h3 className="font-display font-bold text-2xl text-[#e6e4e0] uppercase">
                    ONLINE MULTIPLAYER
                  </h3>
                  <p className="text-xs text-[#a8a29e] mt-1">
                    Host a room code or join an open lobby for synchronized real-time 1v1 arena combat.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSelectMode('multiplayer');
                    onNavigate('multiplayer_lobby');
                  }}
                  className="w-full py-2.5 bg-[#e6e4e0] hover:bg-white text-black font-display font-bold text-base uppercase tracking-wider"
                >
                  Enter Lobby →
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          3. CHARACTER SELECTION SCREEN (Live 3D Preview + Full Combat Specs)
         ===================================================================== */}
      {screenState === 'character_select' && (
        <section className="fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-8 hud-safe-padding pointer-events-none overflow-y-auto">
          {/* Top Bar */}
          <div className="w-full max-w-[1360px] mx-auto flex items-center justify-between bg-[#12141a]/92 border border-[#3f3f46] px-6 py-3.5 pointer-events-auto">
            <div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-wider uppercase text-[#e6e4e0]">
                SELECT COLOSSUS FIGHTER
              </h2>
              <p className="text-xs font-mono text-[#a8a29e]">
                Choose your combat chassis and opponent matchup
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('main_menu')}
                className="px-4 py-2 bg-[#1c1f26] hover:bg-[#27272a] border border-[#3f3f46] text-xs font-mono uppercase text-[#e6e4e0]"
              >
                ← Main Menu
              </button>
              <button
                type="button"
                onClick={() => onNavigate('arena_select')}
                className="px-5 py-2 bg-[#d97706] hover:bg-[#f59e0b] text-black font-display font-bold text-base uppercase tracking-wider"
              >
                Select Arena →
              </button>
            </div>
          </div>

          {/* Right-Side Character Dossier Card (Leaves Left/Center 3D Fighter Unobstructed!) */}
          <div className="w-full max-w-[1360px] mx-auto flex flex-col lg:flex-row items-end justify-between gap-6 mt-4">
            {/* Fighter Switcher Cards */}
            <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-3 pointer-events-auto">
              {(['volt', 'rift'] as CharacterId[]).map((cid) => {
                const c = CHARACTER_REGISTRY[cid];
                const isSelected = p1Char === cid;
                return (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => {
                      soundEngine.play('ui_click');
                      onSelectP1Char(cid);
                    }}
                    className={`w-full sm:w-64 p-4 text-left border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#1c1f26] border-[#d97706]'
                        : 'bg-[#12141a]/90 border-[#3f3f46] hover:border-[#78716c]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-extrabold text-2xl tracking-wider text-[#e6e4e0]">
                        {c.name}
                      </span>
                      <span className="text-[11px] font-mono text-[#d97706]">
                        {isSelected ? 'P1 SELECTED' : 'SELECT'}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-[#a8a29e] mt-0.5">{c.role}</div>
                    <div className="mt-3 flex items-center gap-3 text-xs font-mono text-[#e6e4e0]">
                      <span>HP {c.stats.maxHp}</span>
                      <span>·</span>
                      <span>STM {c.stats.maxStamina}</span>
                    </div>
                  </button>
                );
              })}

              {/* Opponent (P2) Selector */}
              <div className="bg-[#12141a]/90 border border-[#3f3f46] p-4 flex flex-col justify-between min-w-[200px]">
                <span className="text-xs font-mono text-[#a8a29e] uppercase">
                  OPPONENT (P2):
                </span>
                <div className="flex items-center gap-2 mt-2">
                  {(['volt', 'rift'] as CharacterId[]).map((cid) => (
                    <button
                      key={cid}
                      type="button"
                      onClick={() => onSelectP2Char(cid)}
                      className={`flex-1 py-1.5 px-3 font-display font-bold text-sm uppercase border ${
                        p2Char === cid
                          ? 'bg-[#e11d48] text-white border-[#e11d48]'
                          : 'bg-[#1c1f26] text-[#a8a29e] border-[#3f3f46]'
                      }`}
                    >
                      {CHARACTER_REGISTRY[cid].name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Detailed Fighter Specification Panel */}
            {(() => {
              const activeDef = CHARACTER_REGISTRY[p1Char];
              return (
                <div className="w-full lg:w-[440px] bg-[#12141a]/92 border border-[#3f3f46] p-5 pointer-events-auto flex flex-col gap-4">
                  <div>
                    <div className="text-xs font-mono text-[#d97706] uppercase">
                      {activeDef.codename} · {activeDef.origin}
                    </div>
                    <h3 className="font-display font-extrabold text-3xl text-[#e6e4e0] mt-0.5">
                      {activeDef.name} — {activeDef.role}
                    </h3>
                    <p className="text-xs text-[#a8a29e] mt-1.5 leading-relaxed">
                      {activeDef.lore}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-2 border-t border-[#27272a]">
                    {renderStatBar('Power', activeDef.stats.displayRatings.power)}
                    {renderStatBar('Speed', activeDef.stats.displayRatings.speed)}
                    {renderStatBar('Defense', activeDef.stats.displayRatings.defense)}
                    {renderStatBar('Technique', activeDef.stats.displayRatings.technique)}
                  </div>

                  <div className="pt-2 border-t border-[#27272a]">
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-base text-[#d97706] uppercase">
                        ABILITY: {activeDef.ability.name}
                      </span>
                      <span className="text-xs font-mono text-[#a8a29e]">
                        CD {activeDef.ability.cooldown}s · {activeDef.ability.staminaCost} STM
                      </span>
                    </div>
                    <p className="text-xs text-[#e6e4e0] mt-1">{activeDef.ability.description}</p>
                    <p className="text-[11px] font-mono text-[#a8a29e] mt-1">
                      Counterplay: {activeDef.ability.counterplayHint}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {/* =====================================================================
          4. ARENA SELECTION SCREEN
         ===================================================================== */}
      {screenState === 'arena_select' && (
        <section className="fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-8 hud-safe-padding pointer-events-none overflow-y-auto">
          <div className="w-full max-w-[1360px] mx-auto flex items-center justify-between bg-[#12141a]/92 border border-[#3f3f46] px-6 py-3.5 pointer-events-auto">
            <div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-wider uppercase text-[#e6e4e0]">
                SELECT COMBAT ARENA
              </h2>
              <p className="text-xs font-mono text-[#a8a29e]">
                Inspect environmental layout, collision pillars, and combat radius
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('character_select')}
                className="px-4 py-2 bg-[#1c1f26] hover:bg-[#27272a] border border-[#3f3f46] text-xs font-mono uppercase text-[#e6e4e0]"
              >
                ← Fighters
              </button>
              <button
                type="button"
                onClick={() => onNavigate('match_settings')}
                className="px-5 py-2 bg-[#d97706] hover:bg-[#f59e0b] text-black font-display font-bold text-base uppercase tracking-wider"
              >
                Match Rules →
              </button>
            </div>
          </div>

          <div className="w-full max-w-[1360px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 pointer-events-auto mt-4">
            {(['iron_fortress', 'overgrown_colossus'] as ArenaId[]).map((aid) => {
              const a = ARENA_REGISTRY[aid];
              const selected = arenaId === aid;
              return (
                <button
                  key={aid}
                  type="button"
                  onClick={() => {
                    soundEngine.play('ui_click');
                    onSelectArena(aid);
                  }}
                  className={`p-5 text-left border transition-colors cursor-pointer ${
                    selected
                      ? 'bg-[#181b22]/95 border-[#d97706]'
                      : 'bg-[#12141a]/90 border-[#3f3f46] hover:border-[#78716c]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-extrabold text-2xl text-[#e6e4e0]">
                      {a.name}
                    </span>
                    <span className="text-xs font-mono text-[#d97706]">
                      {selected ? 'ACTIVE ARENA' : 'PREVIEW'}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-[#a8a29e] mt-0.5">
                    {a.subtitle} · {a.region}
                  </div>
                  <p className="text-xs text-[#e6e4e0] mt-2 leading-relaxed">{a.description}</p>
                  <div className="mt-3 pt-2 border-t border-[#27272a] flex items-center gap-4 text-xs font-mono text-[#a8a29e]">
                    <span>RADIUS: {a.playableRadius}m</span>
                    <span>·</span>
                    <span>PILLARS: {a.obstacles.length} SOLID</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* =====================================================================
          5. MATCH SETTINGS SCREEN
         ===================================================================== */}
      {screenState === 'match_settings' && (
        <section className="fixed inset-0 z-20 flex items-center justify-center p-6 bg-black/55 overflow-y-auto">
          <div className="w-full max-w-xl bg-[#12141a] border border-[#3f3f46] p-6 sm:p-8 flex flex-col gap-6 my-auto">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
              <div>
                <h2 className="font-display font-bold text-3xl uppercase text-[#e6e4e0]">
                  MATCH PARAMETERS
                </h2>
                <p className="text-xs font-mono text-[#a8a29e]">
                  {CHARACTER_REGISTRY[p1Char].name} vs {CHARACTER_REGISTRY[p2Char].name} ·{' '}
                  {ARENA_REGISTRY[arenaId].name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('arena_select')}
                className="px-4 py-2 bg-[#1c1f26] border border-[#3f3f46] text-xs font-mono uppercase text-[#e6e4e0]"
              >
                ← Back
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-mono text-[#a8a29e] uppercase mb-2">
                  ROUNDS TO WIN MATCH
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { r: 1, label: '1 Round (Single)' },
                    { r: 2, label: '2 Rounds (Best of 3)' },
                    { r: 3, label: '3 Rounds (Best of 5)' },
                  ].map((item) => (
                    <button
                      key={item.r}
                      type="button"
                      onClick={() => onChangeMatchRules(item.r, roundTimeSeconds)}
                      className={`py-2.5 px-3 text-xs font-mono border ${
                        roundsToWin === item.r
                          ? 'bg-[#d97706] text-black border-[#d97706] font-bold'
                          : 'bg-[#181b22] text-[#e6e4e0] border-[#3f3f46]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-[#a8a29e] uppercase mb-2">
                  ROUND DURATION LIMIT
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[60, 90, 120].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => onChangeMatchRules(roundsToWin, sec)}
                      className={`py-2.5 px-3 text-xs font-mono border ${
                        roundTimeSeconds === sec
                          ? 'bg-[#d97706] text-black border-[#d97706] font-bold'
                          : 'bg-[#181b22] text-[#e6e4e0] border-[#3f3f46]'
                      }`}
                    >
                      {sec} Seconds
                    </button>
                  ))}
                </div>
              </div>

              {gameMode === 'bot' && (
                <div>
                  <label className="block text-xs font-mono text-[#a8a29e] uppercase mb-2">
                    AI OPPONENT DIFFICULTY
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['easy', 'normal', 'hard'] as BotDifficulty[]).map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => onSelectDifficulty(diff)}
                        className={`py-2.5 px-3 text-xs font-mono uppercase border ${
                          botDifficulty === diff
                            ? 'bg-[#d97706] text-black border-[#d97706] font-bold'
                            : 'bg-[#181b22] text-[#e6e4e0] border-[#3f3f46]'
                        }`}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              data-start="true"
              onClick={() => {
                soundEngine.play('ui_confirm');
                onStartCombat();
              }}
              className="w-full py-3.5 bg-[#d97706] hover:bg-[#f59e0b] text-black font-display font-extrabold text-xl uppercase tracking-wider cursor-pointer"
            >
              LAUNCH ENGAGEMENT →
            </button>
          </div>
        </section>
      )}

      {/* =====================================================================
          6. ONLINE MULTIPLAYER LOBBY SCREEN
         ===================================================================== */}
      {screenState === 'multiplayer_lobby' && (
        <section className="fixed inset-0 z-20 flex items-center justify-center p-5 bg-black/65 overflow-y-auto">
          <div className="w-full max-w-3xl bg-[#12141a] border border-[#3f3f46] p-6 sm:p-8 flex flex-col gap-5 my-auto">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
              <div>
                <h2 className="font-display font-bold text-3xl uppercase text-[#e6e4e0]">
                  ONLINE MULTIPLAYER LOBBY
                </h2>
                <div className="flex items-center gap-3 text-xs font-mono text-[#a8a29e] mt-1">
                  <span>STATUS: {mpStatus.toUpperCase()}</span>
                  {mpClient.latencyMs > 0 && <span>· PING: {mpClient.latencyMs}ms</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  mpClient.leaveRoom();
                  onNavigate('main_menu');
                }}
                className="px-4 py-2 bg-[#1c1f26] border border-[#3f3f46] text-xs font-mono uppercase text-[#e6e4e0]"
              >
                ← Leave Lobby
              </button>
            </div>

            {mpError && (
              <div className="bg-[#451a1a] border border-[#ef4444] px-4 py-2.5 text-xs font-mono text-[#fecaca]">
                {mpError}
              </div>
            )}

            {!mpRoom ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Create / Join Room */}
                <div className="flex flex-col gap-4">
                  <div>
                    <label
                      htmlFor="mp-callsign-input"
                      className="block text-xs font-mono text-[#a8a29e] uppercase mb-1.5"
                    >
                      PILOT CALLSIGN
                    </label>
                    <input
                      id="mp-callsign-input"
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      maxLength={18}
                      className="w-full bg-[#181b22] border border-[#3f3f46] px-3 py-2 text-sm font-mono text-[#e6e4e0]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => mpClient.hostRoom(playerName, p1Char, arenaId)}
                    className="w-full py-3 bg-[#d97706] hover:bg-[#f59e0b] text-black font-display font-bold text-lg uppercase tracking-wider"
                  >
                    HOST NEW ARENA ROOM
                  </button>

                  <div className="pt-3 border-t border-[#27272a] flex flex-col gap-2">
                    <label
                      htmlFor="mp-room-code-input"
                      className="block text-xs font-mono text-[#a8a29e] uppercase"
                    >
                      JOIN BY ROOM CODE
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="mp-room-code-input"
                        type="text"
                        placeholder="E.G. K7X9P"
                        value={joinCodeInput}
                        onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                        maxLength={6}
                        className="flex-1 bg-[#181b22] border border-[#3f3f46] px-3 py-2 text-sm font-mono uppercase text-[#e6e4e0]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (joinCodeInput.trim()) {
                            mpClient.joinRoom(joinCodeInput, playerName, p1Char);
                          }
                        }}
                        className="px-5 py-2 bg-[#38bdf8] hover:bg-[#7dd3fc] text-black font-display font-bold text-base uppercase"
                      >
                        JOIN CODE
                      </button>
                    </div>
                  </div>
                </div>

                {/* Open Rooms List */}
                <div className="bg-[#181b22] border border-[#27272a] p-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-mono text-xs text-[#a8a29e] uppercase mb-3">
                      ACTIVE OPEN LOBBIES ({openRooms.length})
                    </h3>
                    {openRooms.length === 0 ? (
                      <p className="text-xs text-[#a8a29e] font-mono py-8 text-center">
                        No public rooms waiting. Click &ldquo;Host New Arena Room&rdquo; and open a second browser tab to test live 2-session combat!
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {openRooms.map((r) => (
                          <div
                            key={r.code}
                            className="flex items-center justify-between bg-[#12141a] border border-[#3f3f46] px-3 py-2"
                          >
                            <div>
                              <div className="font-mono font-bold text-sm text-[#d97706]">
                                CODE: {r.code}
                              </div>
                              <div className="text-[11px] font-mono text-[#a8a29e]">
                                Host: {r.hostName} ({r.hostCharacter.toUpperCase()})
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => mpClient.joinRoom(r.code, playerName, p1Char)}
                              className="px-3 py-1 bg-[#38bdf8] text-black font-mono text-xs font-bold uppercase"
                            >
                              JOIN ROOM {r.code}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Inside Active Room Lobby */
              <div className="flex flex-col gap-5">
                <div className="bg-[#181b22] border border-[#d97706] p-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-mono text-[#a8a29e] uppercase">ROOM CODE:</span>
                    <div className="font-mono font-extrabold text-3xl tracking-widest text-[#d97706]">
                      {mpRoom.code}
                    </div>
                  </div>
                  <div className="text-xs font-mono text-[#e6e4e0]">
                    ARENA: <strong>{ARENA_REGISTRY[mpRoom.arenaId].name}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => mpClient.leaveRoom()}
                    className="px-3 py-1.5 bg-[#27272a] text-xs font-mono text-[#e6e4e0]"
                  >
                    Leave Room
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[0, 1].map((slotIdx) => {
                    const p = mpRoom.players[slotIdx];
                    const isSelf = p && p.id === mpClient.localPlayerId;
                    return (
                      <div
                        key={slotIdx}
                        className="bg-[#181b22] border border-[#3f3f46] p-4 flex flex-col gap-3"
                      >
                        {p ? (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="font-display font-bold text-xl text-[#e6e4e0]">
                                {p.name} {isSelf ? '(YOU)' : ''}
                              </span>
                              <span
                                className={`text-xs font-mono px-2 py-0.5 ${
                                  p.ready
                                    ? 'bg-[#166534] text-[#dcfce7]'
                                    : 'bg-[#3f3f46] text-[#e6e4e0]'
                                }`}
                              >
                                {p.ready ? 'READY' : 'NOT READY'}
                              </span>
                            </div>
                            <div className="text-xs font-mono text-[#d97706]">
                              FIGHTER: {CHARACTER_REGISTRY[p.characterId].name}
                            </div>
                            {isSelf && (
                              <div className="flex gap-2 mt-1">
                                {(['volt', 'rift'] as CharacterId[]).map((cid) => (
                                  <button
                                    key={cid}
                                    type="button"
                                    onClick={() => {
                                      onSelectP1Char(cid);
                                      mpClient.updateLobby({ characterId: cid });
                                    }}
                                    className={`flex-1 py-1.5 text-xs font-mono uppercase border ${
                                      p.characterId === cid
                                        ? 'bg-[#d97706] text-black border-[#d97706] font-bold'
                                        : 'bg-[#12141a] text-[#a8a29e] border-[#3f3f46]'
                                    }`}
                                  >
                                    {cid}
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="py-6 text-center text-xs font-mono text-[#a8a29e]">
                            WAITING FOR CHALLENGER TO JOIN WITH CODE {mpRoom.code}...
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-end gap-3">
                  {(() => {
                    const selfPlayer = mpRoom.players.find((p) => p.id === mpClient.localPlayerId);
                    if (!selfPlayer) return null;
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => mpClient.updateLobby({ ready: !selfPlayer.ready })}
                          className="px-5 py-2.5 bg-[#27272a] hover:bg-[#3f3f46] text-xs font-mono uppercase text-[#e6e4e0] border border-[#52525b]"
                        >
                          {selfPlayer.ready ? 'Set Not Ready' : 'Set Ready'}
                        </button>
                        {selfPlayer.role === 'host' && (
                          <button
                            type="button"
                            onClick={() => mpClient.startMatch()}
                            className="px-6 py-2.5 bg-[#d97706] hover:bg-[#f59e0b] text-black font-display font-bold text-lg uppercase tracking-wider"
                          >
                            START ONLINE MATCH →
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* =====================================================================
          7. PAUSE MODAL (Triggered by Escape / P or Pause Button)
         ===================================================================== */}
      {screenState === 'paused' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Game Paused"
          className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-black/70 overflow-y-auto"
        >
          <div className="w-full max-w-md bg-[#12141a] border border-[#3f3f46] p-6 sm:p-8 flex flex-col gap-5 my-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono text-[#d97706] uppercase">ENGAGEMENT SUSPENDED</span>
                <h2 className="font-display font-extrabold text-4xl text-[#e6e4e0] uppercase">
                  COMBAT PAUSED
                </h2>
              </div>
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="px-2.5 py-1.5 bg-[#1c1f26] border border-[#3f3f46] text-[10px] font-mono text-[#e6e4e0] uppercase"
              >
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-[#181b22] border border-[#27272a] p-3 text-xs font-mono">
              <div>
                <span className="text-[#a8a29e] block">DAMAGE DEALT</span>
                <span className="text-lg font-bold tabular-nums text-[#e6e4e0]">
                  {sim.p1.totalDamageDealt}
                </span>
              </div>
              <div>
                <span className="text-[#a8a29e] block">PARRIES LANDED</span>
                <span className="text-lg font-bold tabular-nums text-[#38bdf8]">
                  {sim.p1.parriesLanded}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onResumeCombat}
                className="w-full py-3 bg-[#d97706] hover:bg-[#f59e0b] text-black font-display font-bold text-lg uppercase tracking-wider"
              >
                RESUME COMBAT
              </button>
              <button
                type="button"
                onClick={onRestartMatch}
                className="w-full py-2.5 bg-[#1c1f26] hover:bg-[#27272a] border border-[#3f3f46] text-[#e6e4e0] font-display font-bold text-base uppercase tracking-wider"
              >
                RESTART MATCH
              </button>
              <button
                type="button"
                onClick={() => onOpenSettings(true)}
                className="w-full py-2.5 bg-[#1c1f26] hover:bg-[#27272a] border border-[#3f3f46] text-[#e6e4e0] font-display font-bold text-base uppercase tracking-wider"
              >
                SETTINGS & CONTROLS
              </button>
              <button
                type="button"
                onClick={() => onNavigate('main_menu')}
                className="w-full py-2.5 bg-[#1c1f26] hover:bg-[#451a1a] border border-[#3f3f46] text-[#e6e4e0] font-display font-bold text-base uppercase tracking-wider"
              >
                RETURN TO MAIN MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          8. MATCH RESULT MODAL (Victory / Defeat + Mastery Metrics + Rematch)
         ===================================================================== */}
      {screenState === 'match_result' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Match Results"
          className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-black/75 overflow-y-auto"
        >
          <div className="w-full max-w-lg bg-[#12141a] border border-[#d97706] p-6 sm:p-8 flex flex-col gap-6 my-auto">
            <div>
              <span className="text-xs font-mono tracking-widest text-[#d97706] uppercase">
                {sim.matchWinner === 'p1' ? 'ARENA SUPREMACY ACHIEVED' : 'CHASSIS CRITICAL FAILURE'}
              </span>
              <h2 className="font-display font-extrabold text-5xl text-[#e6e4e0] uppercase mt-1">
                {sim.matchWinner === 'p1'
                  ? `${CHARACTER_REGISTRY[p1Char].name} VICTORIOUS`
                  : `${CHARACTER_REGISTRY[p2Char].name} PREVAILS`}
              </h2>
            </div>

            {/* 3 Tabular Mastery Stat Tiles */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#181b22] border border-[#3f3f46] p-3">
                <span className="text-[11px] font-mono text-[#a8a29e] block">ROUND SCORE</span>
                <span className="font-mono font-bold text-2xl tabular-nums text-[#e6e4e0]">
                  {sim.p1RoundsWon} - {sim.p2RoundsWon}
                </span>
              </div>
              <div className="bg-[#181b22] border border-[#3f3f46] p-3">
                <span className="text-[11px] font-mono text-[#a8a29e] block">DAMAGE DEALT</span>
                <span className="font-mono font-bold text-2xl tabular-nums text-[#d97706]">
                  {sim.p1.totalDamageDealt}
                </span>
              </div>
              <div className="bg-[#181b22] border border-[#3f3f46] p-3">
                <span className="text-[11px] font-mono text-[#a8a29e] block">PARRIES</span>
                <span className="font-mono font-bold text-2xl tabular-nums text-[#38bdf8]">
                  {sim.p1.parriesLanded}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                data-start="true"
                onClick={onRestartMatch}
                className="flex-1 py-3 bg-[#d97706] hover:bg-[#f59e0b] text-black font-display font-extrabold text-lg uppercase tracking-wider"
              >
                REMATCH
              </button>
              <button
                type="button"
                onClick={() => onNavigate('character_select')}
                className="flex-1 py-3 bg-[#1c1f26] hover:bg-[#27272a] border border-[#3f3f46] text-[#e6e4e0] font-display font-bold text-base uppercase tracking-wider"
              >
                CHANGE FIGHTER
              </button>
              <button
                type="button"
                onClick={() => onNavigate('main_menu')}
                className="flex-1 py-3 bg-[#1c1f26] hover:bg-[#27272a] border border-[#3f3f46] text-[#e6e4e0] font-display font-bold text-base uppercase tracking-wider"
              >
                MAIN MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          9. SETTINGS & CONTROLS MODAL (Affecting Real Engine Systems)
         ===================================================================== */}
      {settingsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Game Settings"
          className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6 bg-black/80 overflow-y-auto"
        >
          <div className="w-full max-w-3xl max-h-[90dvh] overflow-y-auto bg-[#12141a] border border-[#3f3f46] p-5 sm:p-8 flex flex-col gap-6 my-auto">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
              <div>
                <h2 className="font-display font-bold text-3xl uppercase text-[#e6e4e0]">
                  SYSTEM, DISPLAY & CONTROL SETTINGS
                </h2>
                <p className="text-xs font-mono text-[#a8a29e]">
                  Configure 16:9 landscape fullscreen, touch deadzones, combat assists, and desktop bindings
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenSettings(false)}
                className="px-4 py-1.5 bg-[#d97706] text-black font-mono text-xs font-bold uppercase cursor-pointer"
              >
                Done
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Column 1: Display, Audio, Graphics & Touch Assist */}
              <div className="flex flex-col gap-4">
                <div className="bg-[#181b22] border border-[#27272a] p-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-[#e6e4e0] block">
                      FULLSCREEN & LANDSCAPE LOCK
                    </span>
                    <span className="text-[11px] font-mono text-[#a8a29e]">
                      Request 16:9 fullscreen automatically on match start
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings({
                          autoFullscreenLandscape: !settings.autoFullscreenLandscape,
                        })
                      }
                      className={`px-3 py-1.5 text-xs font-mono border ${
                        settings.autoFullscreenLandscape
                          ? 'bg-[#d97706] text-black border-[#d97706] font-bold'
                          : 'bg-[#12141a] text-[#a8a29e] border-[#3f3f46]'
                      }`}
                    >
                      {settings.autoFullscreenLandscape ? 'AUTO ON' : 'MANUAL'}
                    </button>
                    <button
                      type="button"
                      onClick={onToggleFullscreen}
                      className="px-3 py-1.5 bg-[#12141a] border border-[#38bdf8] text-[#38bdf8] text-xs font-mono uppercase"
                    >
                      {isFullscreen ? 'Exit' : 'Toggle'}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="master-volume-range"
                    className="flex justify-between text-xs font-mono text-[#a8a29e] mb-1.5"
                  >
                    <span>MASTER VOLUME</span>
                    <span>{Math.round(settings.masterVolume * 100)}%</span>
                  </label>
                  <input
                    id="master-volume-range"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.masterVolume}
                    onChange={(e) =>
                      onUpdateSettings({ masterVolume: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[#d97706]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-xs font-mono text-[#a8a29e] mb-1.5">
                      GRAPHICS PRESET
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['low', 'medium', 'high'] as const).map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => onUpdateSettings({ graphicsQuality: q })}
                          className={`py-1.5 text-xs font-mono uppercase border ${
                            settings.graphicsQuality === q
                              ? 'bg-[#d97706] text-black border-[#d97706] font-bold'
                              : 'bg-[#181b22] text-[#e6e4e0] border-[#3f3f46]'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="block text-xs font-mono text-[#a8a29e] mb-1.5">
                      PARTICLES
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['low', 'medium', 'high'] as const).map((pq) => (
                        <button
                          key={pq}
                          type="button"
                          onClick={() => onUpdateSettings({ particleQuality: pq })}
                          className={`py-1.5 text-xs font-mono uppercase border ${
                            settings.particleQuality === pq
                              ? 'bg-[#d97706] text-black border-[#d97706] font-bold'
                              : 'bg-[#181b22] text-[#e6e4e0] border-[#3f3f46]'
                          }`}
                        >
                          {pq}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="touch-sens-range"
                    className="flex justify-between text-xs font-mono text-[#a8a29e] mb-1"
                  >
                    <span>JOYSTICK SENSITIVITY</span>
                    <span>{settings.touchSensitivity.toFixed(1)}x</span>
                  </label>
                  <input
                    id="touch-sens-range"
                    type="range"
                    min="0.6"
                    max="1.8"
                    step="0.1"
                    value={settings.touchSensitivity}
                    onChange={(e) =>
                      onUpdateSettings({ touchSensitivity: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[#d97706]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="touch-deadzone-range"
                    className="flex justify-between text-xs font-mono text-[#a8a29e] mb-1"
                  >
                    <span>ANALOG DEADZONE</span>
                    <span>{Math.round((settings.touchDeadzone || 0.12) * 100)}%</span>
                  </label>
                  <input
                    id="touch-deadzone-range"
                    type="range"
                    min="0.05"
                    max="0.28"
                    step="0.01"
                    value={settings.touchDeadzone || 0.12}
                    onChange={(e) =>
                      onUpdateSettings({ touchDeadzone: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[#d97706]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ aimAssist: !settings.aimAssist })}
                    className={`p-2 text-left text-xs font-mono border ${
                      settings.aimAssist
                        ? 'bg-[#1f242d] border-[#d97706] text-[#e6e4e0]'
                        : 'bg-[#181b22] border-[#3f3f46] text-[#a8a29e]'
                    }`}
                  >
                    <span className="block text-[10px] text-[#a8a29e]">TARGET ASSIST</span>
                    <strong>{settings.aimAssist ? 'ENABLED' : 'OFF'}</strong>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ moveAssist: !settings.moveAssist })}
                    className={`p-2 text-left text-xs font-mono border ${
                      settings.moveAssist
                        ? 'bg-[#1f242d] border-[#d97706] text-[#e6e4e0]'
                        : 'bg-[#181b22] border-[#3f3f46] text-[#a8a29e]'
                    }`}
                  >
                    <span className="block text-[10px] text-[#a8a29e]">MELEE STEP-IN ASSIST</span>
                    <strong>{settings.moveAssist ? 'ENABLED' : 'OFF'}</strong>
                  </button>
                </div>
              </div>

              {/* Column 2: Interactive Keyboard & Mouse Bindings Remapper */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-mono text-[#a8a29e] uppercase mb-1">
                  DESKTOP KEYBOARD & MOUSE SCHEME (CLICK TO REBIND)
                </span>
                {(
                  [
                    ['lightAttack', 'Light Attack (3x Combo)', 'LMB / '],
                    ['heavyAttack', 'Heavy Cleave', ''],
                    ['guard', 'Block Hold / Timed Parry', 'RMB / '],
                    ['dodge', 'Directional Dodge Roll', ''],
                    ['ability', 'Special Ability ( / U)', ''],
                    ['lockOn', 'Target Lock-On Toggle', ''],
                    ['sprint', 'Sprint Modifier', ''],
                  ] as const
                ).map(([keyName, label, mousePrefix]) => (
                  <div
                    key={keyName}
                    className="flex items-center justify-between bg-[#181b22] border border-[#27272a] px-3 py-2 text-xs font-mono"
                  >
                    <span className="text-[#e6e4e0]">{label}</span>
                    <button
                      type="button"
                      onClick={() => setRebindingKey(keyName)}
                      className={`px-2.5 py-1 border cursor-pointer ${
                        rebindingKey === keyName
                          ? 'bg-[#d97706] text-black border-[#d97706] font-bold'
                          : 'bg-[#12141a] text-[#38bdf8] border-[#3f3f46]'
                      }`}
                    >
                      {rebindingKey === keyName
                        ? 'PRESS KEY...'
                        : `${mousePrefix}${formatKeyBinding(settings.keybindings[keyName])}`}
                    </button>
                  </div>
                ))}

                <div className="mt-1 bg-[#181b22] border border-[#27272a] px-3 py-2 text-[11px] font-mono text-[#a8a29e] leading-relaxed">
                  <div>
                    <strong className="text-[#e6e4e0]">MOVEMENT:</strong> WASD or Arrow Keys (360° camera-relative)
                  </div>
                  <div>
                    <strong className="text-[#e6e4e0]">CAMERA:</strong> Mouse orbits in Free-Cam; Tab locks onto opponent
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
