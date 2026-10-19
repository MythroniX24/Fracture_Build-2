import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArenaId,
  BotDifficulty,
  CharacterId,
  DEFAULT_SETTINGS,
  DEFAULT_TRAINING_CONFIG,
  GameMode,
  GameSettings,
  ScreenState,
  TrainingConfig,
} from './game/config.ts';
import {
  CombatEvent,
  SimulationState,
  createSimulationState,
  resetRoundPositions,
} from './game/rules.ts';
import { GameCanvas } from './components/GameCanvas.tsx';
import { CombatHUD, HudDomRefs, TouchInputState } from './components/CombatHUD.tsx';
import { MenuScreens } from './components/MenuScreens.tsx';
import { soundEngine } from './audio/soundEngine.ts';
import { multiplayerClient, RoomStatePayload } from './network/multiplayerClient.ts';

export function App() {
  const searchParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialAutoStart = searchParams?.get('autostart') === '1';
  const initialScreenParam = searchParams?.get('screen') as ScreenState | null;
  const initialArenaParam = searchParams?.get('arena') as ArenaId | null;
  const initialModeParam = searchParams?.get('mode') as GameMode | null;

  const [screenState, setScreenState] = useState<ScreenState>(
    initialAutoStart ? 'combat' : initialScreenParam || 'main_menu'
  );
  const [gameMode, setGameMode] = useState<GameMode>(initialModeParam || 'bot');
  const [p1Char, setP1Char] = useState<CharacterId>('volt');
  const [p2Char, setP2Char] = useState<CharacterId>('rift');
  const [arenaId, setArenaId] = useState<ArenaId>(
    initialArenaParam || 'foundry_arena'
  );
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('normal');
  const [roundsToWin, setRoundsToWin] = useState<number>(2);
  const [roundTimeSeconds, setRoundTimeSeconds] = useState<number>(90);

  const [lockedOn, setLockedOn] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [trainingConfig, setTrainingConfig] = useState<TrainingConfig>(DEFAULT_TRAINING_CONFIG);

  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [roundBanner, setRoundBanner] = useState<string | null>(null);
  const [combatCallout, setCombatCallout] = useState<{
    id: number;
    text: string;
    subtext?: string;
    color: string;
  } | null>(null);

  // Force re-render when round/match numbers update
  const [, setSimVersion] = useState(0);

  // Multiplayer state
  const [mpRoom, setMpRoom] = useState<RoomStatePayload | null>(null);
  const [mpStatus, setMpStatus] = useState<string>('disconnected');
  const [mpError, setMpError] = useState<string | null>(null);

  // Core simulation state ref
  const simRef = useRef<SimulationState>(
    createSimulationState('volt', 'rift', 'foundry_arena', 2, 90)
  );

  // Touch input state ref
  const touchInputRef = useRef<TouchInputState>({
    moveX: 0,
    moveZ: 0,
    sprint: false,
    jumpPressed: false,
    shoulderTogglePressed: false,
    aimHeld: false,
    lightPressed: false,
    heavyPressed: false,
    guardHeld: false,
    guardJustPressed: false,
    dodgePressed: false,
    abilityPressed: false,
    cameraDeltaX: 0,
    cameraDeltaY: 0,
  });

  // High-frequency HUD DOM refs
  const p1HpFill = useRef<HTMLDivElement | null>(null);
  const p1HpGhost = useRef<HTMLDivElement | null>(null);
  const p1HpText = useRef<HTMLSpanElement | null>(null);
  const p1StaminaFill = useRef<HTMLDivElement | null>(null);
  const p1StaminaText = useRef<HTMLSpanElement | null>(null);
  const p1AbilityFill = useRef<HTMLDivElement | null>(null);
  const p1AbilityText = useRef<HTMLSpanElement | null>(null);
  const p1StateBadge = useRef<HTMLSpanElement | null>(null);
  const p1ComboBox = useRef<HTMLDivElement | null>(null);
  const p1ComboHits = useRef<HTMLSpanElement | null>(null);
  const p1ComboDmg = useRef<HTMLSpanElement | null>(null);
  const p2HpFill = useRef<HTMLDivElement | null>(null);
  const p2HpGhost = useRef<HTMLDivElement | null>(null);
  const p2HpText = useRef<HTMLSpanElement | null>(null);
  const p2StaminaFill = useRef<HTMLDivElement | null>(null);
  const p2StaminaText = useRef<HTMLSpanElement | null>(null);
  const p2StateBadge = useRef<HTMLSpanElement | null>(null);
  const p2ComboBox = useRef<HTMLDivElement | null>(null);
  const p2ComboHits = useRef<HTMLSpanElement | null>(null);
  const p2ComboDmg = useRef<HTMLSpanElement | null>(null);
  const timerText = useRef<HTMLSpanElement | null>(null);
  const aiStateBadge = useRef<HTMLSpanElement | null>(null);
  const lockReticle = useRef<HTMLDivElement | null>(null);
  const crosshairRef = useRef<HTMLDivElement | null>(null);
  const hitMarkerRef = useRef<HTMLDivElement | null>(null);
  const mobileAbilityOverlay = useRef<HTMLDivElement | null>(null);
  const mobileAbilityTimer = useRef<HTMLSpanElement | null>(null);
  const btnLightRef = useRef<HTMLButtonElement | null>(null);
  const btnHeavyRef = useRef<HTMLButtonElement | null>(null);
  const btnDodgeRef = useRef<HTMLButtonElement | null>(null);
  const btnAbilityRef = useRef<HTMLButtonElement | null>(null);

  const hudRefs: HudDomRefs = {
    p1HpFill,
    p1HpGhost,
    p1HpText,
    p1StaminaFill,
    p1StaminaText,
    p1AbilityFill,
    p1AbilityText,
    p1StateBadge,
    p1ComboBox,
    p1ComboHits,
    p1ComboDmg,
    p2HpFill,
    p2HpGhost,
    p2HpText,
    p2StaminaFill,
    p2StaminaText,
    p2StateBadge,
    p2ComboBox,
    p2ComboHits,
    p2ComboDmg,
    timerText,
    aiStateBadge,
    lockReticle,
    crosshairRef,
    hitMarkerRef,
    mobileAbilityOverlay,
    mobileAbilityTimer,
    btnLightRef,
    btnHeavyRef,
    btnDodgeRef,
    btnAbilityRef,
  };

  // Track Fullscreen API state changes
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const requestLandscapeFullscreen = useCallback(async () => {
    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
    if (isHeadless) return;

    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Graceful fallback when fullscreen is blocked by iframe policy or browser
    }

    try {
      const orientationApi = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      if (orientationApi && typeof orientationApi.lock === 'function') {
        await orientationApi.lock('landscape');
      }
    } catch {
      // Graceful fallback when orientation lock is unsupported
    }
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        try {
          const orientationApi = screen.orientation as ScreenOrientation & {
            unlock?: () => void;
          };
          orientationApi?.unlock?.();
        } catch {
          // ignore
        }
      } else {
        await requestLandscapeFullscreen();
      }
    } catch {
      // ignore
    }
  }, [requestLandscapeFullscreen]);

  // Mirror state to document.body.dataset.state for testability & game shell compliance
  useEffect(() => {
    if (screenState === 'combat' || screenState === 'countdown') {
      document.body.dataset.state = 'playing';
    } else if (screenState === 'paused') {
      document.body.dataset.state = 'paused';
    } else if (screenState === 'match_result') {
      document.body.dataset.state = 'gameover';
    } else {
      document.body.dataset.state = 'title';
    }
  }, [screenState]);

  // Subscribe to MultiplayerClient updates
  useEffect(() => {
    const unsub = multiplayerClient.subscribe(() => {
      setMpRoom(multiplayerClient.currentRoom ? { ...multiplayerClient.currentRoom } : null);
      setMpStatus(multiplayerClient.connectionStatus);
      setMpError(multiplayerClient.errorMessage);
    });
    return unsub;
  }, []);

  const launchMatch = useCallback(
    (
      overrideP1 = p1Char,
      overrideP2 = p2Char,
      overrideArena = arenaId,
      overrideRounds = roundsToWin,
      overrideTimer = roundTimeSeconds,
      skipCountdown = false
    ) => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      if (settings.autoFullscreenLandscape) {
        void requestLandscapeFullscreen();
      }
      simRef.current = createSimulationState(
        overrideP1,
        overrideP2,
        overrideArena,
        overrideRounds,
        overrideTimer
      );
      setLockedOn(true);
      setSimVersion((v) => v + 1);
      setRoundBanner(null);

      if (skipCountdown || gameMode === 'training') {
        setCountdownValue(null);
        setScreenState('combat');
        return;
      }

      setScreenState('combat');
      setCountdownValue(3);
      soundEngine.play('countdown_tick');
    },
    [
      p1Char,
      p2Char,
      arenaId,
      roundsToWin,
      roundTimeSeconds,
      gameMode,
      settings.autoFullscreenLandscape,
      requestLandscapeFullscreen,
    ]
  );

  // Handle countdown progression
  useEffect(() => {
    if (countdownValue === null) return;
    const timer = window.setTimeout(() => {
      if (countdownValue > 1) {
        setCountdownValue(countdownValue - 1);
        soundEngine.play('countdown_tick');
      } else if (countdownValue === 1) {
        setCountdownValue(0);
        soundEngine.play('countdown_fight');
      } else {
        setCountdownValue(null);
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [countdownValue]);

  // Bind Multiplayer match start callback
  useEffect(() => {
    multiplayerClient.setCallbacks({
      onMatchStart: (room) => {
        const self = room.players.find((p) => p.id === multiplayerClient.localPlayerId);
        const opp = room.players.find((p) => p.id !== multiplayerClient.localPlayerId);
        const myChar = self?.characterId || p1Char;
        const oppChar = opp?.characterId || p2Char;
        setP1Char(myChar);
        setP2Char(oppChar);
        setArenaId(room.arenaId);
        setGameMode('multiplayer');
        launchMatch(myChar, oppChar, room.arenaId, room.roundsToWin, room.roundTimeSeconds, false);
      },
      onOpponentDisconnected: () => {
        setScreenState('multiplayer_lobby');
      },
    });
  }, [p1Char, p2Char, launchMatch]);

  // Global keyboard shortcuts: Enter/Space on title screen starts; Escape/P pauses/resumes; R resets in training; F toggles fullscreen
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (settingsOpen) return;

      if (screenState === 'main_menu' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        soundEngine.play('ui_confirm');
        setGameMode('bot');
        launchMatch(p1Char, p2Char, arenaId, roundsToWin, roundTimeSeconds, true);
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (screenState === 'combat') {
          e.preventDefault();
          setScreenState('paused');
        } else if (screenState === 'paused') {
          e.preventDefault();
          setScreenState('combat');
        }
      }

      if (e.code === 'KeyM' && (screenState === 'combat' || screenState === 'paused')) {
        setSettings((prev) => {
          const nextMuted = !prev.muted;
          soundEngine.setVolume(prev.masterVolume, nextMuted);
          return { ...prev, muted: nextMuted };
        });
      }

      if (e.code === 'KeyF' && (screenState === 'combat' || screenState === 'paused')) {
        void handleToggleFullscreen();
      }

      if (e.code === 'KeyR' && screenState === 'combat' && gameMode === 'training') {
        resetRoundPositions(simRef.current);
        setSimVersion((v) => v + 1);
      }
    };

    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [
    screenState,
    settingsOpen,
    gameMode,
    p1Char,
    p2Char,
    arenaId,
    roundsToWin,
    roundTimeSeconds,
    launchMatch,
    handleToggleFullscreen,
  ]);

  const handleCombatEvent = useCallback((evt: CombatEvent) => {
    if (
      evt.type === 'parried' ||
      evt.type === 'counter_riposte' ||
      evt.type === 'combo_breaker' ||
      evt.type === 'guard_break' ||
      evt.type === 'execution_hit' ||
      evt.type === 'barrel_explode' ||
      evt.type === 'prop_shatter' ||
      evt.type === 'dodge_evade' ||
      evt.type === 'ability_cast' ||
      evt.type === 'decoy_shatter' ||
      evt.type === 'hit_heavy'
    ) {
      const colorMap: Record<string, string> = {
        parried: '#38bdf8',
        counter_riposte: '#fbbf24',
        combo_breaker: '#38bdf8',
        guard_break: '#ef4444',
        execution_hit: '#f43f5e',
        barrel_explode: '#fb923c',
        prop_shatter: '#f59e0b',
        dodge_evade: '#e6e4e0',
        ability_cast: '#d97706',
        decoy_shatter: '#a3b18a',
        hit_heavy: '#f59e0b',
      };
      setCombatCallout({
        id: Date.now() + Math.random(),
        text: evt.label,
        color: colorMap[evt.type] || '#e6e4e0',
      });
    }
  }, []);

  // Clear combat callouts after 1.1s
  useEffect(() => {
    if (!combatCallout) return;
    const t = window.setTimeout(() => setCombatCallout(null), 1100);
    return () => window.clearTimeout(t);
  }, [combatCallout]);

  const handleRoundFinished = useCallback((winner: 'p1' | 'p2' | 'draw') => {
    const sim = simRef.current;
    setSimVersion((v) => v + 1);

    const winLabel =
      winner === 'draw'
        ? 'ROUND DRAW'
        : winner === 'p1'
          ? 'ROUND WON'
          : 'ROUND LOST';
    setRoundBanner(winLabel);

    window.setTimeout(() => {
      if (sim.matchOver) {
        setRoundBanner(null);
        setScreenState('match_result');
      } else {
        sim.roundNumber += 1;
        resetRoundPositions(sim);
        setSimVersion((v) => v + 1);
        setRoundBanner(null);
        setCountdownValue(2);
      }
    }, 1800);
  }, []);

  const handleUpdateSettings = useCallback((updates: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      soundEngine.setVolume(next.masterVolume, next.muted);
      return next;
    });
  }, []);

  const isCombatVisible =
    screenState === 'combat' || screenState === 'paused' || screenState === 'match_result';

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden bg-[#0d0e11] select-none">
      {/* Persistent Three.js WebGL Viewport */}
      <GameCanvas
        screenState={screenState}
        gameMode={gameMode}
        p1Char={p1Char}
        p2Char={p2Char}
        arenaId={arenaId}
        botDifficulty={botDifficulty}
        lockedOn={lockedOn}
        settings={settings}
        trainingConfig={trainingConfig}
        simRef={simRef}
        hudRefs={hudRefs}
        touchInputRef={touchInputRef}
        onToggleLockOn={() => setLockedOn((prev) => !prev)}
        onCombatEvent={handleCombatEvent}
        onRoundFinished={handleRoundFinished}
      />

      {/* Active Combat HUD */}
      {isCombatVisible && (
        <CombatHUD
          hudRefs={hudRefs}
          p1Char={p1Char}
          p2Char={p2Char}
          p1Name="PLAYER 1"
          p2Name={
            gameMode === 'training'
              ? 'PRACTICE DUMMY'
              : gameMode === 'multiplayer'
                ? 'CHALLENGER'
                : `AI (${botDifficulty.toUpperCase()})`
          }
          roundNumber={simRef.current.roundNumber}
          roundsToWin={simRef.current.roundsToWin}
          p1RoundsWon={simRef.current.p1RoundsWon}
          p2RoundsWon={simRef.current.p2RoundsWon}
          gameMode={gameMode}
          countdownValue={countdownValue}
          roundBanner={roundBanner}
          combatCallout={combatCallout}
          muted={settings.muted}
          isFullscreen={isFullscreen}
          lockedOn={lockedOn}
          settings={settings}
          trainingConfig={trainingConfig}
          touchInputRef={touchInputRef}
          onToggleMute={() => handleUpdateSettings({ muted: !settings.muted })}
          onToggleFullscreen={() => void handleToggleFullscreen()}
          onToggleLockOn={() => setLockedOn((prev) => !prev)}
          onToggleControlHints={() =>
            handleUpdateSettings({ showControlHints: !settings.showControlHints })
          }
          onPause={() => setScreenState('paused')}
          onRestartRound={() => {
            resetRoundPositions(simRef.current);
            setSimVersion((v) => v + 1);
          }}
          onUpdateTrainingConfig={(upd) =>
            setTrainingConfig((prev) => ({ ...prev, ...upd }))
          }
        />
      )}

      {/* Menu, Lobby, Settings, Pause & Result Screens */}
      <MenuScreens
        screenState={screenState}
        gameMode={gameMode}
        p1Char={p1Char}
        p2Char={p2Char}
        arenaId={arenaId}
        botDifficulty={botDifficulty}
        roundsToWin={roundsToWin}
        roundTimeSeconds={roundTimeSeconds}
        settings={settings}
        settingsOpen={settingsOpen}
        isFullscreen={isFullscreen}
        sim={simRef.current}
        mpClient={multiplayerClient}
        mpRoom={mpRoom}
        mpStatus={mpStatus}
        mpError={mpError}
        onNavigate={(scr) => setScreenState(scr)}
        onSelectMode={(m) => setGameMode(m)}
        onSelectP1Char={(id) => {
          setP1Char(id);
          simRef.current.p1.characterId = id;
        }}
        onSelectP2Char={(id) => {
          setP2Char(id);
          simRef.current.p2.characterId = id;
        }}
        onSelectArena={(id) => {
          setArenaId(id);
          simRef.current.arenaId = id;
        }}
        onSelectDifficulty={(d) => setBotDifficulty(d)}
        onChangeMatchRules={(r, t) => {
          setRoundsToWin(r);
          setRoundTimeSeconds(t);
        }}
        onStartCombat={() =>
          launchMatch(p1Char, p2Char, arenaId, roundsToWin, roundTimeSeconds, false)
        }
        onResumeCombat={() => setScreenState('combat')}
        onRestartMatch={() =>
          launchMatch(p1Char, p2Char, arenaId, roundsToWin, roundTimeSeconds, false)
        }
        onToggleFullscreen={() => void handleToggleFullscreen()}
        onOpenSettings={(open) => setSettingsOpen(open)}
        onUpdateSettings={handleUpdateSettings}
      />
    </div>
  );
}

export default App;
