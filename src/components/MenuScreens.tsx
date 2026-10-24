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
      {/* 4. UNIFIED SETTINGS MODAL (Shared between Lobby & In-Game)          */}
      {/* =================================================================== */}
      {settingsOpen && (
        <div
          role="dialog"
          aria-label="Settings"
          onKeyDown={handleKeyCapture}
          tabIndex={-1}
          className="fixed inset-0 z-50 bg-[#0b0d12]/85 backdrop-blur-md flex items-center justify-center p-4 select-none"
        >
          <div className="w-full max-w-2xl bg-[#111726] border border-white/15 rounded-2xl p-5 sm:p-6 flex flex-col gap-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-display font-bold text-lg text-zinc-100 uppercase tracking-wide">
                  Game Settings
                </h3>
                <p className="text-[11px] text-slate-400">
                  Synced across Main Lobby &amp; In-Game Combat
                </p>
              </div>
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

            <SharedSettingsPanel
              settings={settings}
              isFullscreen={isFullscreen}
              onUpdateSettings={onUpdateSettings}
              onToggleFullscreen={onToggleFullscreen}
              onOpenLayoutEditor={() => {
                onOpenSettings(false);
                onOpenLayoutEditor();
              }}
            />

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

export interface SharedSettingsPanelProps {
  settings: GameSettings;
  isFullscreen: boolean;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onToggleFullscreen: () => void;
  onOpenLayoutEditor: () => void;
}

export const SharedSettingsPanel: React.FC<SharedSettingsPanelProps> = ({
  settings,
  isFullscreen,
  onUpdateSettings,
  onToggleFullscreen,
  onOpenLayoutEditor,
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

  return (
    <div
      onKeyDown={handleKeyCapture}
      tabIndex={-1}
      className="grid grid-cols-1 md:grid-cols-2 gap-4 outline-none"
    >
      {/* Left Column: Audio, Graphics & Display */}
      <div className="flex flex-col gap-3.5 bg-slate-950/60 border border-white/10 rounded-xl p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
          Audio &amp; Graphics
        </div>

        {/* Audio Volume */}
        <label className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-zinc-300">
            <span>Audio Volume</span>
            <span className="font-mono text-sky-400 font-bold tabular-nums">
              {Math.round(settings.masterVolume * 100)}%
            </span>
          </div>
          <input
            type="range"
            aria-label="Audio Volume"
            min={0}
            max={1}
            step={0.05}
            value={settings.masterVolume}
            onChange={(e) =>
              onUpdateSettings({ masterVolume: parseFloat(e.target.value) })
            }
            className="w-full accent-sky-400 cursor-pointer"
          />
        </label>

        {/* Mute Audio */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-300">Mute All Audio</span>
          <button
            type="button"
            onClick={() => onUpdateSettings({ muted: !settings.muted })}
            className={`px-3 py-1 rounded-lg text-xs font-bold uppercase cursor-pointer ${
              settings.muted
                ? 'bg-rose-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {settings.muted ? 'Muted' : 'Active'}
          </button>
        </div>

        {/* Graphics Quality */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <span className="text-xs font-medium text-zinc-300">Graphics Quality</span>
          <div className="flex gap-1 bg-[#0e1015] p-1 rounded-lg border border-white/10">
            {(['low', 'medium', 'high'] as const).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onUpdateSettings({ graphicsQuality: q })}
                className={`px-2.5 py-1 rounded text-xs font-medium capitalize cursor-pointer ${
                  settings.graphicsQuality === q
                    ? 'bg-sky-500 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Particle Quality */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-300">Particle Density</span>
          <div className="flex gap-1 bg-[#0e1015] p-1 rounded-lg border border-white/10">
            {(['low', 'medium', 'high'] as const).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onUpdateSettings({ particleQuality: q })}
                className={`px-2.5 py-1 rounded text-xs font-medium capitalize cursor-pointer ${
                  settings.particleQuality === q
                    ? 'bg-sky-500 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Fullscreen & Mobile Landscape */}
        <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
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
                  ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 font-semibold'
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
              className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-xs font-medium text-zinc-200 cursor-pointer"
            >
              {isFullscreen ? 'Exit' : 'Fullscreen'}
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Sensitivity, Assist & Controls */}
      <div className="flex flex-col gap-3.5 bg-slate-950/60 border border-white/10 rounded-xl p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
          Sensitivity &amp; Controls
        </div>

        {/* Camera Aim Sensitivity */}
        <label className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-zinc-300">
            <span>Camera Aim Sensitivity</span>
            <span className="font-mono text-zinc-100 font-bold tabular-nums">
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
            className="w-full accent-sky-400 cursor-pointer"
          />
        </label>

        {/* Firing Sensitivity */}
        <label className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-zinc-300">
            <span>Firing Sensitivity</span>
            <span className="font-mono text-amber-300 font-bold tabular-nums">
              {Math.round((settings.fireSensitivity ?? 1.0) * 100)}%
            </span>
          </div>
          <input
            type="range"
            aria-label="Firing Sensitivity"
            min={0.1}
            max={2.0}
            step={0.05}
            value={settings.fireSensitivity ?? 1.0}
            onChange={(e) =>
              onUpdateSettings({ fireSensitivity: parseFloat(e.target.value) })
            }
            className="w-full accent-amber-400 cursor-pointer"
          />
        </label>

        {/* Aim Assist, Move Assist, Control Hints */}
        <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => onUpdateSettings({ aimAssist: !settings.aimAssist })}
            className={`px-2 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
              settings.aimAssist
                ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                : 'bg-slate-900 border-white/10 text-slate-400'
            }`}
          >
            Aim Assist: {settings.aimAssist ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={() => onUpdateSettings({ moveAssist: !settings.moveAssist })}
            className={`px-2 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
              settings.moveAssist
                ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                : 'bg-slate-900 border-white/10 text-slate-400'
            }`}
          >
            Move Assist: {settings.moveAssist ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({ showControlHints: !settings.showControlHints })
            }
            className={`px-2 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
              settings.showControlHints
                ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                : 'bg-slate-900 border-white/10 text-slate-400'
            }`}
          >
            Hints: {settings.showControlHints ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Touch Controls Layout Customizer */}
        <div className="border-t border-white/10 pt-2.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.play('ui_confirm');
              onOpenLayoutEditor();
            }}
            className="flex-1 py-2 px-3 rounded-lg bg-sky-600/25 hover:bg-sky-600/35 border border-sky-400/40 text-sky-100 font-semibold text-xs flex items-center justify-center transition-colors cursor-pointer"
          >
            Customize Touch HUD
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({
                buttonsLayout: { ...DEFAULT_HUD_BUTTONS_LAYOUT },
                hudGlobalScale: 1.0,
                hudGlobalOpacity: 0.95,
              })
            }
            className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-[11px] font-mono text-zinc-300 cursor-pointer"
          >
            Reset HUD
          </button>
        </div>
      </div>

      {/* Bottom Full-Width Row: Keyboard Bindings */}
      <div className="md:col-span-2 bg-slate-950/60 border border-white/10 rounded-xl p-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
            Keyboard Bindings (Click any action then press a key)
          </span>
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({ keybindings: { ...DEFAULT_KEYBINDINGS } })
            }
            className="text-xs font-mono text-sky-400 hover:text-sky-300 cursor-pointer"
          >
            Reset Keys
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
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
              className={`px-2.5 py-2 rounded-lg border text-xs flex flex-col items-start gap-0.5 cursor-pointer ${
                rebindingKey === key
                  ? 'border-sky-400 bg-sky-500/20 text-white'
                  : 'border-white/10 bg-[#0e1015] text-zinc-300 hover:border-white/25'
              }`}
            >
              <span className="text-[10px] text-slate-400">{label}</span>
              <span className="font-mono font-bold text-zinc-100">
                {rebindingKey === key
                  ? 'Press key...'
                  : (settings.keybindings[key] || '').replace('Key', '')}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
