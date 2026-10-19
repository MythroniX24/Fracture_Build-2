import React, { useState } from 'react';
import {
  ARENA_REGISTRY,
  ArenaId,
  BotDifficulty,
  CharacterId,
  CHARACTER_REGISTRY,
  DEFAULT_KEYBINDINGS,
  GameMode,
  GameSettings,
  KeyBindingsConfig,
  ScreenState,
} from '../game/config';
import { SimulationState } from '../game/rules';
import { soundEngine } from '../audio/soundEngine';
import { MultiplayerClient, RoomStatePayload } from '../network/multiplayerClient';

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
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
}

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
  sim,
  mpClient,
  mpRoom,
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
  onOpenSettings,
  onUpdateSettings,
}) => {
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [rebindingKey, setRebindingKey] = useState<keyof KeyBindingsConfig | null>(null);

  const characterList = Object.values(CHARACTER_REGISTRY);
  const arenaList = Object.values(ARENA_REGISTRY);

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
    <>
      {/* =================================================================== */}
      {/* 1. MAIN MENU SCREEN (ULTRA-CLEAN STAGE SHOWCASE)                    */}
      {/* =================================================================== */}
      {screenState === 'main_menu' && (
        <div className="fixed inset-0 z-20 flex flex-col justify-between p-6 sm:p-10 pointer-events-none select-none">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_#f59e0b]" />
              <span className="font-mono text-xs uppercase tracking-[0.3em] text-slate-300 font-bold">
                FRACTURE
              </span>
            </div>

            <button
              type="button"
              aria-label="Open Settings"
              onClick={() => {
                soundEngine.unlock();
                soundEngine.play('ui_click');
                onOpenSettings(true);
              }}
              className="pointer-events-auto w-11 h-11 rounded-full bg-slate-950/75 hover:bg-slate-900 border border-white/15 flex items-center justify-center text-slate-200 transition-all active:scale-90 shadow-lg cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </header>

          <div className="my-auto max-w-md flex flex-col items-start gap-6">
            <div>
              <h1 className="font-display font-black text-5xl sm:text-7xl tracking-tight uppercase italic text-white leading-none drop-shadow-[0_8px_28px_rgba(0,0,0,0.85)]">
                FRACTURE
              </h1>
              <p className="mt-1.5 font-mono text-xs uppercase tracking-[0.35em] text-amber-400 font-semibold">
                3D ARENA COMBAT
              </p>
            </div>

            <nav className="pointer-events-auto flex flex-col gap-2.5 w-64 sm:w-72">
              <button
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.play('ui_confirm');
                  onSelectMode('bot');
                  onNavigate('mode_select');
                }}
                className="w-full px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-display font-black text-lg tracking-wider uppercase flex items-center justify-between shadow-[0_8px_24px_rgba(245,158,11,0.35)] transition-all active:scale-95 cursor-pointer"
              >
                <span>PLAY</span>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.play('ui_click');
                  onSelectMode('training');
                  onNavigate('character_select');
                }}
                className="w-full px-5 py-3 rounded-2xl bg-slate-950/75 hover:bg-slate-900/90 border border-white/15 hover:border-cyan-400/50 text-white font-display font-bold text-sm tracking-wider uppercase flex items-center justify-between transition-all active:scale-95 cursor-pointer"
              >
                <span>TRAINING</span>
                <span className="text-cyan-400 font-mono text-xs">→</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.play('ui_click');
                  onSelectMode('multiplayer');
                  onNavigate('multiplayer_lobby');
                }}
                className="w-full px-5 py-3 rounded-2xl bg-slate-950/75 hover:bg-slate-900/90 border border-white/15 hover:border-purple-400/50 text-white font-display font-bold text-sm tracking-wider uppercase flex items-center justify-between transition-all active:scale-95 cursor-pointer"
              >
                <span>ONLINE DUEL</span>
                <span className="text-purple-400 font-mono text-xs">→</span>
              </button>
            </nav>
          </div>

          <div />
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. MODE SELECT SCREEN (CLEAN COMPACT PANEL)                         */}
      {/* =================================================================== */}
      {screenState === 'mode_select' && (
        <div className="fixed inset-0 z-20 bg-slate-950/65 backdrop-blur-md flex items-center justify-center p-4 select-none">
          <div className="w-full max-w-xl bg-slate-900/90 border border-white/15 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight text-white">
                SELECT MODE
              </h2>
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('ui_click');
                  onNavigate('main_menu');
                }}
                className="px-4 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-xs font-bold uppercase tracking-wider text-slate-200 cursor-pointer"
              >
                Back
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { id: 'bot', title: 'VS AI', accent: 'border-amber-400 bg-amber-500/15' },
                  { id: 'training', title: 'TRAINING', accent: 'border-cyan-400 bg-cyan-500/15' },
                  { id: 'multiplayer', title: 'ONLINE 1V1', accent: 'border-purple-400 bg-purple-500/15' },
                ] as { id: GameMode; title: string; accent: string }[]
              ).map((m) => {
                const active = gameMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      soundEngine.play('ui_click');
                      onSelectMode(m.id);
                    }}
                    className={`p-4 rounded-2xl border-2 text-center transition-all cursor-pointer ${
                      active
                        ? `${m.accent} text-white shadow-lg`
                        : 'border-white/10 bg-slate-950/60 text-slate-400 hover:text-white hover:border-white/25'
                    }`}
                  >
                    <div className="font-display font-black text-sm sm:text-base uppercase tracking-wider">
                      {m.title}
                    </div>
                  </button>
                );
              })}
            </div>

            {gameMode !== 'multiplayer' && (
              <div className="flex flex-col gap-2.5">
                <span className="font-mono text-[11px] uppercase tracking-widest text-slate-400 font-bold">
                  AI DIFFICULTY
                </span>
                <div className="grid grid-cols-3 gap-2.5">
                  {(['easy', 'normal', 'hard'] as BotDifficulty[]).map((diff) => {
                    const active = botDifficulty === diff;
                    return (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => {
                          soundEngine.play('ui_click');
                          onSelectDifficulty(diff);
                        }}
                        className={`py-2.5 rounded-xl border font-display font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                          active
                            ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md'
                            : 'bg-slate-950/60 text-slate-300 border-white/10 hover:border-white/25'
                        }`}
                      >
                        {diff}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui_confirm');
                if (gameMode === 'multiplayer') {
                  onNavigate('multiplayer_lobby');
                } else {
                  onNavigate('character_select');
                }
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-display font-black text-base uppercase tracking-wider shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              CONTINUE
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. CHARACTER SELECT SCREEN (CLEAN FIGHTER CARDS)                    */}
      {/* =================================================================== */}
      {screenState === 'character_select' && (
        <div className="fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-8 pointer-events-none select-none">
          <header className="flex items-center justify-between pointer-events-auto">
            <h2 className="font-display font-black text-2xl sm:text-4xl uppercase tracking-tight text-white drop-shadow">
              SELECT FIGHTER
            </h2>
            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui_click');
                onNavigate('mode_select');
              }}
              className="px-4 py-2 rounded-full bg-slate-950/80 hover:bg-slate-900 border border-white/15 text-xs font-bold uppercase tracking-wider text-slate-200 cursor-pointer"
            >
              Back
            </button>
          </header>

          <div className="my-auto ml-auto w-full max-w-md flex flex-col gap-3 pointer-events-auto">
            {characterList.map((char) => {
              const isSelected = p1Char === char.id;
              return (
                <button
                  key={char.id}
                  type="button"
                  onClick={() => {
                    soundEngine.play('ui_click');
                    const opp: CharacterId = char.id === 'volt' ? 'rift' : 'volt';
                    onSelectP1Char(char.id);
                    onSelectP2Char(opp);
                  }}
                  className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all cursor-pointer backdrop-blur-md ${
                    isSelected
                      ? 'bg-slate-900/90 border-cyan-400 shadow-[0_0_24px_rgba(56,189,248,0.25)]'
                      : 'bg-slate-950/70 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-display font-black text-xl sm:text-2xl uppercase text-white">
                        {char.name}
                      </div>
                      <div className="font-mono text-[11px] uppercase tracking-wider text-cyan-300">
                        {char.title}
                      </div>
                    </div>
                    <span
                      className={`w-3.5 h-3.5 rounded-full ${
                        isSelected ? 'bg-cyan-400 shadow-[0_0_10px_#38bdf8]' : 'bg-slate-700'
                      }`}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-950/70 rounded-xl py-1.5 border border-white/5">
                      <div className="text-[10px] font-mono text-slate-400">SPEED</div>
                      <div className="font-mono font-bold text-xs text-cyan-300">
                        {char.stats.speedRating}/10
                      </div>
                    </div>
                    <div className="bg-slate-950/70 rounded-xl py-1.5 border border-white/5">
                      <div className="text-[10px] font-mono text-slate-400">POWER</div>
                      <div className="font-mono font-bold text-xs text-amber-300">
                        {char.stats.powerRating}/10
                      </div>
                    </div>
                    <div className="bg-slate-950/70 rounded-xl py-1.5 border border-white/5">
                      <div className="text-[10px] font-mono text-slate-400">DEFENSE</div>
                      <div className="font-mono font-bold text-xs text-emerald-300">
                        {char.stats.defenseRating}/10
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui_confirm');
                onNavigate('arena_select');
              }}
              className="mt-1 w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-display font-black text-base uppercase tracking-wider shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              NEXT: ARENA
            </button>
          </div>

          <div />
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. ARENA SELECT & MATCH SETTINGS SCREEN                             */}
      {/* =================================================================== */}
      {(screenState === 'arena_select' || screenState === 'match_settings') && (
        <div className="fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-8 pointer-events-none select-none">
          <header className="flex items-center justify-between pointer-events-auto">
            <h2 className="font-display font-black text-2xl sm:text-4xl uppercase tracking-tight text-white drop-shadow">
              SELECT ARENA
            </h2>
            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui_click');
                onNavigate('character_select');
              }}
              className="px-4 py-2 rounded-full bg-slate-950/80 hover:bg-slate-900 border border-white/15 text-xs font-bold uppercase tracking-wider text-slate-200 cursor-pointer"
            >
              Back
            </button>
          </header>

          <div className="mt-auto mx-auto w-full max-w-md bg-slate-950/85 backdrop-blur-md border border-white/15 rounded-3xl p-5 flex flex-col gap-4 pointer-events-auto shadow-2xl">
            <div className="flex flex-col gap-2">
              {arenaList.map((arena) => {
                const active = arenaId === arena.id;
                return (
                  <button
                    key={arena.id}
                    type="button"
                    onClick={() => {
                      soundEngine.play('ui_click');
                      onSelectArena(arena.id);
                    }}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-slate-900 border-amber-400 text-white'
                        : 'bg-slate-950/60 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="font-display font-black text-base uppercase">
                        {arena.name}
                      </div>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-amber-400">
                        {arena.subtitle}
                      </div>
                    </div>
                    <span
                      className={`w-3 h-3 rounded-full ${
                        active ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'bg-slate-700'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Compact Rounds & Timer Selector */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
              <div className="flex items-center justify-between bg-slate-900/80 rounded-xl px-3 py-2">
                <span className="text-[11px] font-mono text-slate-400">ROUNDS</span>
                <div className="flex gap-1">
                  {[1, 2, 3].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => onChangeMatchRules(r, roundTimeSeconds)}
                      className={`w-6 h-6 rounded-lg font-mono text-xs font-bold cursor-pointer ${
                        roundsToWin === r
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-900/80 rounded-xl px-3 py-2">
                <span className="text-[11px] font-mono text-slate-400">TIME</span>
                <div className="flex gap-1">
                  {[60, 90].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onChangeMatchRules(roundsToWin, t)}
                      className={`px-2 h-6 rounded-lg font-mono text-xs font-bold cursor-pointer ${
                        roundTimeSeconds === t
                          ? 'bg-cyan-400 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {t}s
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui_confirm');
                onStartCombat();
              }}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-display font-black text-lg uppercase tracking-wider shadow-[0_8px_24px_rgba(245,158,11,0.4)] transition-all active:scale-95 cursor-pointer"
            >
              START FIGHT
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. MULTIPLAYER LOBBY SCREEN                                         */}
      {/* =================================================================== */}
      {screenState === 'multiplayer_lobby' && (
        <div className="fixed inset-0 z-20 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 select-none">
          <div className="w-full max-w-md bg-slate-900/95 border border-white/15 rounded-3xl p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-black text-2xl uppercase text-white">
                ONLINE 1V1
              </h2>
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('ui_click');
                  mpClient.leaveRoom();
                  onNavigate('main_menu');
                }}
                className="px-4 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-xs font-bold uppercase text-slate-200 cursor-pointer"
              >
                Back
              </button>
            </div>

            {mpError && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/50 text-xs text-rose-200 font-medium">
                {mpError}
              </div>
            )}

            {!mpRoom ? (
              <div className="flex flex-col gap-4">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('ui_confirm');
                    mpClient.hostRoom('PLAYER 1', p1Char, arenaId);
                  }}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-display font-black text-sm uppercase tracking-wider cursor-pointer"
                >
                  CREATE ROOM
                </button>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="ROOM CODE"
                    className="flex-1 bg-slate-950 border border-white/15 rounded-xl px-4 py-3 font-mono font-bold text-sm uppercase tracking-widest text-white text-center"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.play('ui_confirm');
                      if (joinCodeInput.trim()) {
                        mpClient.joinRoom(joinCodeInput.trim(), 'CHALLENGER', p2Char);
                      }
                    }}
                    className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-sm uppercase cursor-pointer"
                  >
                    JOIN
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-4 flex flex-col items-center gap-4 text-center">
                <span className="font-mono text-xs uppercase tracking-widest text-slate-400">
                  ROOM CODE
                </span>
                <div className="px-6 py-3 rounded-2xl bg-slate-950 border border-cyan-400/50 font-mono font-black text-3xl tracking-[0.25em] text-cyan-300">
                  {mpRoom.code}
                </div>
                {mpRoom.players.length >= 2 ? (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.play('ui_confirm');
                      mpClient.startMatch();
                    }}
                    className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-sm uppercase tracking-wider cursor-pointer"
                  >
                    START ONLINE DUEL
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 animate-pulse">
                    Waiting for challenger...
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 6. PAUSE MODAL                                                      */}
      {/* =================================================================== */}
      {screenState === 'paused' && (
        <div
          role="dialog"
          aria-label="Pause Menu"
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 select-none"
        >
          <div className="w-full max-w-xs bg-slate-900 border border-white/15 rounded-3xl p-6 flex flex-col gap-3 shadow-2xl text-center">
            <h3 className="font-display font-black text-2xl uppercase text-white mb-1">PAUSED</h3>

            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui_confirm');
                onResumeCombat();
              }}
              className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-sm uppercase tracking-wider cursor-pointer"
            >
              RESUME
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui_click');
                onRestartMatch();
              }}
              className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-display font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              RESTART
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui_click');
                onOpenSettings(true);
              }}
              className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-display font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              SETTINGS
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui_click');
                onNavigate('main_menu');
              }}
              className="w-full py-3 rounded-2xl bg-rose-950/70 hover:bg-rose-900 border border-rose-500/30 text-rose-200 font-display font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              QUIT
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 7. MATCH RESULT SCREEN                                              */}
      {/* =================================================================== */}
      {screenState === 'match_result' && (
        <div className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 select-none">
          <div className="w-full max-w-sm bg-slate-900/95 border border-white/15 rounded-3xl p-6 text-center flex flex-col items-center gap-5 shadow-2xl">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-amber-400 font-bold">
              MATCH OVER
            </div>

            <h2 className="font-display font-black text-3xl sm:text-4xl uppercase italic text-white">
              {sim.matchWinner === 'p1'
                ? `${CHARACTER_REGISTRY[p1Char].name} WINS`
                : `${CHARACTER_REGISTRY[p2Char].name} WINS`}
            </h2>

            <div className="flex items-center gap-4 px-5 py-2 rounded-full bg-slate-950 border border-white/10 font-mono font-black text-xl text-white">
              <span className="text-cyan-400">{sim.p1RoundsWon}</span>
              <span className="text-slate-600">:</span>
              <span className="text-rose-400">{sim.p2RoundsWon}</span>
            </div>

            <div className="w-full flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('ui_confirm');
                  onRestartMatch();
                }}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-display font-black text-base uppercase tracking-wider cursor-pointer"
              >
                REMATCH
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('ui_click');
                  onNavigate('main_menu');
                }}
                className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-display font-bold text-xs uppercase tracking-wider cursor-pointer"
              >
                MAIN MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 8. SETTINGS MODAL                                                   */}
      {/* =================================================================== */}
      {settingsOpen && (
        <div
          role="dialog"
          aria-label="Settings"
          onKeyDown={handleKeyCapture}
          tabIndex={-1}
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 select-none"
        >
          <div className="w-full max-w-md bg-slate-900 border border-white/15 rounded-3xl p-6 flex flex-col gap-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display font-black text-xl uppercase text-white">SETTINGS</h3>
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('ui_click');
                  onOpenSettings(false);
                }}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Graphics Quality */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Graphics
              </span>
              <div className="flex gap-1.5">
                {(['low', 'medium', 'high'] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onUpdateSettings({ graphicsQuality: q })}
                    className={`px-3 py-1 rounded-lg text-xs font-bold uppercase cursor-pointer ${
                      settings.graphicsQuality === q
                        ? 'bg-cyan-400 text-slate-950'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Camera Zoom Distance */}
            <label className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-300">
                <span>Camera Distance</span>
                <span className="font-mono text-cyan-300">
                  {settings.cameraDistance.toFixed(1)}m
                </span>
              </div>
              <input
                type="range"
                min={4.4}
                max={7.2}
                step={0.2}
                value={settings.cameraDistance}
                onChange={(e) =>
                  onUpdateSettings({ cameraDistance: parseFloat(e.target.value) })
                }
                className="w-full accent-cyan-400"
              />
            </label>

            {/* Master Volume */}
            <label className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-300">
                <span>Audio Volume</span>
                <span className="font-mono text-amber-300">
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
                className="w-full accent-amber-400"
              />
            </label>

            {/* Compact Keybindings */}
            <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Controls
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ keybindings: { ...DEFAULT_KEYBINDINGS } })
                  }
                  className="text-[11px] font-mono text-cyan-400 hover:underline cursor-pointer"
                >
                  Reset
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['lightAttack', 'Strike'],
                    ['heavyAttack', 'Heavy'],
                    ['guard', 'Guard'],
                    ['dodge', 'Dash'],
                    ['ability', 'Special'],
                    ['lockOn', 'Lock-On'],
                  ] as [keyof KeyBindingsConfig, string][]
                ).map(([key, label]) => (
                  <button
                    key={String(key)}
                    type="button"
                    onClick={() => setRebindingKey(key)}
                    className={`px-3 py-2 rounded-xl border text-xs flex items-center justify-between cursor-pointer ${
                      rebindingKey === key
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-white/10 bg-slate-950/70 text-slate-300'
                    }`}
                  >
                    <span>{label}</span>
                    <span className="font-mono font-bold text-cyan-300">
                      {rebindingKey === key
                        ? '...'
                        : settings.keybindings[key].replace('Key', '')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenSettings(false)}
              className="mt-2 w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-sm uppercase tracking-wider cursor-pointer"
            >
              DONE
            </button>
          </div>
        </div>
      )}
    </>
  );
};
