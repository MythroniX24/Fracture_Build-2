import React, { useState } from 'react';
import {
  ArenaId,
  BotDifficulty,
  CharacterId,
  DEFAULT_HUD_BUTTONS_LAYOUT,
  DEFAULT_KEYBINDINGS,
  GameMode,
  GameSettings,
  KeyBindingsConfig,
  LoadoutPairId,
  ScreenState,
  WeaponId,
} from '../game/config.ts';
import { SimulationState, getMatchLeaderboard } from '../game/rules.ts';
import { soundEngine } from '../audio/soundEngine.ts';
import { MultiplayerClient, RoomStatePayload } from '../network/multiplayerClient.ts';
import { WeaponIllustration } from './WeaponArtwork.tsx';

export interface MenuScreensProps {
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
  selectedWeapon?: WeaponId;
  selectedLoadoutPairId?: LoadoutPairId;
  onSelectLoadoutPair?: (pairId: LoadoutPairId, weapons: [WeaponId, WeaponId]) => void;
  onSelectWeapon?: (w: WeaponId) => void;
  onNavigate: (scr: ScreenState) => void;
  onSelectMode: (m: GameMode) => void;
  onSelectP1Char: (id: CharacterId) => void;
  onSelectP2Char: (id: CharacterId) => void;
  onSelectArena: (id: ArenaId) => void;
  onSelectDifficulty: (d: BotDifficulty) => void;
  onChangeMatchRules: (rounds: number, timeSec: number) => void;
  onStartCombat: () => void;
  onResumeCombat: () => void;
  onRestartMatch: () => void;
  onToggleFullscreen: () => void;
  onOpenSettings: (open: boolean) => void;
  onOpenLayoutEditor: () => void;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
}

export const MenuScreens: React.FC<MenuScreensProps> = ({
  screenState,
  botDifficulty,
  settings,
  settingsOpen,
  isFullscreen,
  sim,
  onNavigate,
  onSelectMode,
  onSelectDifficulty,
  onStartCombat,
  onResumeCombat,
  onRestartMatch,
  onToggleFullscreen,
  onOpenSettings,
  onOpenLayoutEditor,
  onUpdateSettings,
}) => {
  const [rebindingKey, setRebindingKey] = useState<keyof KeyBindingsConfig | null>(null);

  const handleKeyCapture = (e: React.KeyboardEvent) => {
    if (!rebindingKey) return;
    e.preventDefault();
    e.stopPropagation();
    onUpdateSettings({
      keybindings: {
        ...settings.keybindings,
        [rebindingKey]: e.code,
      },
    });
    setRebindingKey(null);
  };

  const leaderboard = screenState === 'match_result' ? getMatchLeaderboard(sim) : [];
  const topCombatant = leaderboard[0];

  return (
    <>
      {/* =================================================================== */}
      {/* 1. CLEAN MATTE TACTICAL MAIN MENU                                   */}
      {/* =================================================================== */}
      {screenState === 'main_menu' && (
        <div
          className="fixed inset-0 z-20 flex flex-col justify-between p-6 sm:p-10 pointer-events-none select-none"
          style={{
            background:
              'linear-gradient(90deg, rgba(12,14,18,0.88) 0%, rgba(12,14,18,0.52) 52%, rgba(12,14,18,0.10) 100%)',
          }}
        >
          {/* Top Brand Emblem */}
          <div className="flex items-center gap-3">
            <svg
              className="w-7 h-7 text-zinc-100"
              viewBox="0 0 32 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <polygon points="16,3 29,10 29,22 16,29 3,22 3,10" />
              <line x1="16" y1="8" x2="16" y2="24" />
              <line x1="8" y1="16" x2="24" y2="16" />
            </svg>
            <span className="font-display font-bold text-sm tracking-[0.22em] text-zinc-200 uppercase">
              SECTOR-09 · 5-MIN DEATHMATCH
            </span>
          </div>

          {/* Left-Third Focal Column: Title, Difficulty, & Primary Actions */}
          <div className="my-auto max-w-md flex flex-col items-start gap-5 pointer-events-auto">
            <div>
              <h1 className="font-display font-black text-5xl sm:text-6xl tracking-tight text-zinc-100 leading-none">
                FRACTURE
              </h1>
              <p className="mt-1.5 text-sm text-zinc-400">
                5-Minute Tactical Arena First-Person Deathmatch
              </p>
            </div>

            {/* Difficulty Segmented Selector */}
            <div className="w-full sm:w-80 bg-[#12141a]/95 border border-white/15 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-xl">
              <span className="text-xs font-medium text-zinc-400">AI Difficulty</span>
              <div className="flex items-center gap-1">
                {(['easy', 'normal', 'hard'] as BotDifficulty[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      soundEngine.play('ui_click');
                      onSelectDifficulty(d);
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-medium capitalize transition-colors cursor-pointer ${
                      botDifficulty === d
                        ? 'bg-zinc-200 text-zinc-950 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* <= 3 Primary Menu Actions */}
            <nav className="flex flex-col gap-2.5 w-full sm:w-80">
              <button
                type="button"
                data-start="true"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.play('ui_confirm');
                  onSelectMode('bot');
                  onStartCombat();
                }}
                className="w-full py-3.5 px-5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-display font-bold text-base tracking-wide flex items-center justify-between transition-transform active:scale-98 cursor-pointer"
              >
                <span>Start Deathmatch</span>
                <span className="font-mono text-xs font-bold">05:00 →</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.play('ui_click');
                  onSelectMode('training');
                  onStartCombat();
                }}
                className="w-full py-3 px-5 rounded-xl bg-[#14171e] hover:bg-zinc-800 border border-white/15 text-zinc-200 font-display font-semibold text-sm flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>Firing Range</span>
                <span className="font-mono text-xs text-zinc-400">Practice</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.play('ui_click');
                  onOpenSettings(true);
                }}
                className="w-full py-3 px-5 rounded-xl bg-[#14171e] hover:bg-zinc-800 border border-white/15 text-zinc-200 font-display font-semibold text-sm flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>Settings</span>
                <span className="font-mono text-xs text-zinc-400">Configure</span>
              </button>
            </nav>
          </div>

          {/* Flat Inline Control Hint Line */}
          <div className="text-xs font-mono text-zinc-400">
            WASD Move · Hold &amp; Drag Fire Button · V Slide · Right-Click Scope · R Reload · Esc Pause
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. PAUSE MODAL                                                      */}
      {/* =================================================================== */}
      {screenState === 'paused' && (
        <div className="fixed inset-0 z-30 bg-[#0b0d12]/80 flex items-center justify-center p-4 select-none">
          <div className="w-full max-w-xs bg-[#14171e] border border-white/15 rounded-2xl p-6 flex flex-col gap-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="font-display font-bold text-lg text-zinc-100">Paused</h2>
              <span className="font-mono text-xs text-zinc-400 tabular-nums">
                Kills: {sim.player.kills}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui_confirm');
                onResumeCombat();
              }}
              className="w-full py-3 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-sm cursor-pointer"
            >
              Resume
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui_click');
                onOpenLayoutEditor();
              }}
              className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-100 font-medium text-sm cursor-pointer"
            >
              Customize Controls
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui_click');
                onOpenSettings(true);
              }}
              className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-200 font-medium text-sm cursor-pointer"
            >
              Settings
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui_click');
                onRestartMatch();
              }}
              className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-200 font-medium text-sm cursor-pointer"
            >
              Restart Match
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui_confirm');
                onNavigate('match_result');
              }}
              className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-amber-300 font-medium text-sm cursor-pointer"
            >
              Finish Match &amp; Leaderboard
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui_click');
                onNavigate('main_menu');
              }}
              className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-zinc-200 font-medium text-sm cursor-pointer"
            >
              Main Menu
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. 5-MINUTE DEATHMATCH LEADERBOARD & MATCH RESULT MODAL             */}
      {/* =================================================================== */}
      {screenState === 'match_result' && (
        <div
          role="dialog"
          aria-label="Deathmatch Leaderboard"
          className="fixed inset-0 z-30 bg-[#0b0d12]/90 flex items-center justify-center p-4 select-none"
        >
          <div className="w-full max-w-lg bg-[#14171e] border border-white/15 rounded-2xl p-5 sm:p-6 flex flex-col gap-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            {/* Winner Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <div className="font-mono text-xs uppercase tracking-wider text-amber-400 font-bold">
                  {topCombatant?.isPlayer
                    ? 'VICTORY · MOST KILLS'
                    : `WINNER: ${topCombatant?.name || 'HOSTILE'}`}
                </div>
                <h2 className="mt-0.5 font-display font-black text-2xl text-zinc-100">
                  Deathmatch Leaderboard
                </h2>
              </div>
              <div className="text-right font-mono">
                <div className="text-[11px] text-zinc-400">Your Kills</div>
                <div className="text-2xl font-black text-emerald-400 tabular-nums">
                  {sim.player.kills}
                </div>
              </div>
            </div>

            {/* Ranked Combatant Leaderboard Table */}
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-12 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                <span className="col-span-2">Rank</span>
                <span className="col-span-4">Combatant</span>
                <span className="col-span-3 text-center">Loadout</span>
                <span className="col-span-2 text-right">Kills</span>
                <span className="col-span-1 text-right">D</span>
              </div>

              {leaderboard.map((entry, idx) => (
                <div
                  key={entry.id}
                  className={`grid grid-cols-12 items-center px-3 py-2 rounded-xl border font-mono text-xs tabular-nums ${
                    entry.isPlayer
                      ? 'bg-emerald-500/15 border-emerald-400/50 text-zinc-100 font-bold'
                      : idx === 0
                        ? 'bg-amber-500/15 border-amber-400/40 text-zinc-100'
                        : 'bg-[#0e1015] border-white/10 text-zinc-300'
                  }`}
                >
                  <span className="col-span-2 font-bold text-amber-300">#{idx + 1}</span>
                  <span className="col-span-4 truncate pr-2">{entry.name}</span>
                  <div className="col-span-3 flex items-center justify-center gap-1">
                    <WeaponIllustration weaponId={entry.weapons[0]} className="w-10 h-4" />
                    <WeaponIllustration weaponId={entry.weapons[1]} className="w-10 h-4" />
                  </div>
                  <span className="col-span-2 text-right text-sm font-black text-zinc-100">
                    {entry.kills}
                  </span>
                  <span className="col-span-1 text-right text-zinc-400">{entry.deaths}</span>
                </div>
              ))}
            </div>

            {/* Play Again & Back to Main Menu Actions */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                data-start="true"
                onClick={() => {
                  soundEngine.play('ui_confirm');
                  onRestartMatch();
                }}
                className="flex-1 py-3 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-sm cursor-pointer"
              >
                Play Again
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('ui_click');
                  onNavigate('main_menu');
                }}
                className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-zinc-200 font-medium text-sm cursor-pointer"
              >
                Back to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. CLEAN MATTE SETTINGS MODAL                                       */}
      {/* =================================================================== */}
      {settingsOpen && (
        <div
          role="dialog"
          aria-label="Settings"
          onKeyDown={handleKeyCapture}
          tabIndex={-1}
          className="fixed inset-0 z-50 bg-[#0b0d12]/80 flex items-center justify-center p-4 select-none"
        >
          <div className="w-full max-w-md bg-[#14171e] border border-white/15 rounded-2xl p-5 sm:p-6 flex flex-col gap-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display font-bold text-lg text-zinc-100">Settings</h3>
              <button
                type="button"
                aria-label="Close Settings"
                onClick={() => {
                  soundEngine.play('ui_click');
                  onOpenSettings(false);
                }}
                className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* Graphics Quality */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300">Graphics Quality</span>
              <div className="flex gap-1 bg-[#0e1015] p-1 rounded-lg border border-white/10">
                {(['low', 'medium', 'high'] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onUpdateSettings({ graphicsQuality: q })}
                    className={`px-3 py-1 rounded text-xs font-medium capitalize cursor-pointer ${
                      settings.graphicsQuality === q
                        ? 'bg-zinc-100 text-zinc-950 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Camera Aim Sensitivity */}
            <label className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-zinc-300">
                <span>Camera Aim Sensitivity</span>
                <span className="font-mono text-zinc-100 tabular-nums">
                  {Math.round(settings.touchSensitivity * 100)}%
                </span>
              </div>
              <input
                type="range"
                aria-label="Camera Aim Sensitivity"
                min={0.2}
                max={2.0}
                step={0.05}
                value={settings.touchSensitivity}
                onChange={(e) =>
                  onUpdateSettings({ touchSensitivity: parseFloat(e.target.value) })
                }
                className="w-full accent-zinc-100 cursor-pointer"
              />
            </label>

            {/* Firing Sensitivity (Fire Button Joystick Aim) */}
            <label className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-zinc-300">
                <span>Firing Sensitivity</span>
                <span className="font-mono text-amber-300 tabular-nums">
                  {Math.round((settings.fireSensitivity ?? 0.45) * 100)}%
                </span>
              </div>
              <input
                type="range"
                aria-label="Firing Sensitivity"
                min={0.1}
                max={2.0}
                step={0.05}
                value={settings.fireSensitivity ?? 0.45}
                onChange={(e) =>
                  onUpdateSettings({ fireSensitivity: parseFloat(e.target.value) })
                }
                className="w-full accent-amber-400 cursor-pointer"
              />
            </label>

            {/* Audio Volume */}
            <label className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-zinc-300">
                <span>Audio Volume</span>
                <span className="font-mono text-zinc-100 tabular-nums">
                  {Math.round(settings.masterVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.masterVolume}
                onChange={(e) =>
                  onUpdateSettings({ masterVolume: parseFloat(e.target.value) })
                }
                className="w-full accent-zinc-100 cursor-pointer"
              />
            </label>

            {/* Fullscreen & Mobile Landscape */}
            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-xs font-medium text-zinc-300">
                Fullscreen &amp; Landscape
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      autoFullscreenLandscape: !settings.autoFullscreenLandscape,
                    })
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                    settings.autoFullscreenLandscape
                      ? 'bg-zinc-200 text-zinc-950 font-semibold'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {settings.autoFullscreenLandscape ? 'Auto: On' : 'Auto: Off'}
                </button>
                <button
                  type="button"
                  data-fullscreen-toggle="true"
                  onClick={() => {
                    soundEngine.play('ui_click');
                    onToggleFullscreen();
                  }}
                  className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 cursor-pointer"
                >
                  {isFullscreen ? 'Exit' : 'Fullscreen'}
                </button>
              </div>
            </div>

            {/* Keybindings */}
            <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-300">Keyboard Bindings</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ keybindings: { ...DEFAULT_KEYBINDINGS } })
                  }
                  className="text-xs font-mono text-zinc-400 hover:text-zinc-100 cursor-pointer"
                >
                  Reset
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    ['fire', 'Fire'],
                    ['ads', 'Scope'],
                    ['reload', 'Reload'],
                    ['jump', 'Jump'],
                    ['crouch', 'Crouch'],
                    ['slide', 'Slide'],
                    ['nextWeapon', 'Switch Gun'],
                  ] as [keyof KeyBindingsConfig, string][]
                ).map(([key, label]) => (
                  <button
                    key={String(key)}
                    type="button"
                    onClick={() => setRebindingKey(key)}
                    className={`px-3 py-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer ${
                      rebindingKey === key
                        ? 'border-white bg-zinc-800 text-white'
                        : 'border-white/10 bg-[#0e1015] text-zinc-300 hover:border-white/25'
                    }`}
                  >
                    <span>{label}</span>
                    <span className="font-mono font-semibold text-zinc-100">
                      {rebindingKey === key
                        ? '...'
                        : (settings.keybindings[key] || '').replace('Key', '')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Touch Controls Layout Customizer */}
            <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-300">Touch Controls</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      buttonsLayout: { ...DEFAULT_HUD_BUTTONS_LAYOUT },
                      hudGlobalScale: 1.0,
                      hudGlobalOpacity: 0.95,
                    })
                  }
                  className="text-xs font-mono text-zinc-400 hover:text-zinc-100 cursor-pointer"
                >
                  Reset Layout
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  soundEngine.play('ui_confirm');
                  onOpenLayoutEditor();
                }}
                className="w-full py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-zinc-100 font-medium text-sm flex items-center justify-center transition-colors cursor-pointer"
              >
                Customize Controls
              </button>
            </div>

            <button
              type="button"
              onClick={() => onOpenSettings(false)}
              className="mt-1 w-full py-3 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-sm cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};
