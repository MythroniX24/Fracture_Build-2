import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArenaId,
  BotDifficulty,
  CharacterId,
  DEATHMATCH_DURATION_SECONDS,
  DEFAULT_HUD_BUTTONS_LAYOUT,
  DEFAULT_KEYBINDINGS,
  DEFAULT_SETTINGS,
  DEFAULT_TRAINING_CONFIG,
  GameMode,
  GameSettings,
  LOADOUT_PAIRS,
  LoadoutPairId,
  ScreenState,
  TrainingConfig,
  WeaponId,
} from './game/config.ts';
import {
  CombatEvent,
  SimulationState,
  createSimulationState,
  handleWeaponSlotClick,
  resetRoundPositions,
  setPlayerLoadoutPair,
} from './game/rules.ts';
import { GameCanvas } from './components/GameCanvas.tsx';
import { CombatHUD, HudDomRefs, TouchInputState } from './components/CombatHUD.tsx';
import { MenuScreens } from './components/MenuScreens.tsx';
import { HUDLayoutEditor } from './components/HUDLayoutEditor.tsx';
import { soundEngine } from './audio/soundEngine.ts';
import { multiplayerClient, RoomStatePayload } from './network/multiplayerClient.ts';

const SETTINGS_STORAGE_KEY = 'fracture_fps_settings_v2';

function loadStoredSettings(): GameSettings {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(SETTINGS_STORAGE_KEY) : null;
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      fireSensitivity:
        typeof parsed.fireSensitivity === 'number'
          ? parsed.fireSensitivity
          : DEFAULT_SETTINGS.fireSensitivity,
      buttonsLayout: {
        ...DEFAULT_HUD_BUTTONS_LAYOUT,
        ...(parsed.buttonsLayout || {}),
      },
      keybindings: {
        ...DEFAULT_KEYBINDINGS,
        ...(parsed.keybindings || {}),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

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
  const [roundsToWin, setRoundsToWin] = useState<number>(1);
  const [roundTimeSeconds, setRoundTimeSeconds] = useState<number>(
    DEATHMATCH_DURATION_SECONDS
  );
  const [selectedLoadoutPairId, setSelectedLoadoutPairId] =
    useState<LoadoutPairId>('pair_1');
  const [loadoutWeapons, setLoadoutWeapons] = useState<[WeaponId, WeaponId]>(
    LOADOUT_PAIRS[0].weapons
  );
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponId>(
    LOADOUT_PAIRS[0].weapons[0]
  );
  const [loadoutOverlayMode, setLoadoutOverlayMode] = useState<
    'initial' | 'respawn' | null
  >(null);

  const [lockedOn, setLockedOn] = useState<boolean>(false);
  const [firstPersonMode, setFirstPersonMode] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [settings, setSettings] = useState<GameSettings>(() => loadStoredSettings());
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [layoutEditorOpen, setLayoutEditorOpen] = useState<boolean>(false);
  const [editorOpenedFromSettings, setEditorOpenedFromSettings] = useState<boolean>(false);
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
    createSimulationState(
      'volt',
      'rift',
      'foundry_arena',
      1,
      DEATHMATCH_DURATION_SECONDS,
      LOADOUT_PAIRS[0].weapons
    )
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
    lightHeld: false,
    attackDragX: 0,
    attackDragY: 0,
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
  const screenImpactOverlay = useRef<HTMLDivElement | null>(null);
  const dashWindOverlay = useRef<HTMLDivElement | null>(null);
  const hudShakeContainer = useRef<HTMLDivElement | null>(null);

  const hudRefs: HudDomRefs = React.useMemo(
    () => ({
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
      screenImpactOverlay,
      dashWindOverlay,
      hudShakeContainer,
    }),
    []
  );

  const lockMobileLandscape = useCallback(async () => {
    try {
      const orientationApi = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      if (orientationApi && typeof orientationApi.lock === 'function') {
        try {
          await orientationApi.lock('landscape');
        } catch {
          await orientationApi.lock('landscape-primary');
        }
      }
    } catch {
      // Graceful fallback when orientation lock is unsupported
    }
  }, []);

  const requestLandscapeFullscreen = useCallback(async () => {
    soundEngine.unlock();
    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
    if (isHeadless) return;

    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
    };

    try {
      const currentlyFullscreen = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
      if (!currentlyFullscreen) {
        if (typeof docEl.requestFullscreen === 'function') {
          await docEl.requestFullscreen({ navigationUI: 'hide' }).catch(() =>
            docEl.requestFullscreen()
          );
        } else if (typeof docEl.webkitRequestFullscreen === 'function') {
          await docEl.webkitRequestFullscreen();
        }
      }
    } catch {
      // Graceful fallback when fullscreen is blocked by iframe policy or browser
    }

    await lockMobileLandscape();
  }, [lockMobileLandscape]);

  // Automatically enter Fullscreen + Landscape on any in-game click/tap (in bubble phase so button clicks execute first and are never swallowed)
  useEffect(() => {
    if (!settings.autoFullscreenLandscape) return;

    const handleUserInteraction = (e: Event) => {
      soundEngine.unlock();
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-fullscreen-toggle="true"]')) {
        return;
      }
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
      };
      if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
        void requestLandscapeFullscreen();
      } else {
        void lockMobileLandscape();
      }
    };

    window.addEventListener('click', handleUserInteraction, { capture: false, passive: true });
    window.addEventListener('touchend', handleUserInteraction, { capture: false, passive: true });
    window.addEventListener('pointerup', handleUserInteraction, { capture: false, passive: true });
    return () => {
      window.removeEventListener('click', handleUserInteraction, { capture: false });
      window.removeEventListener('touchend', handleUserInteraction, { capture: false });
      window.removeEventListener('pointerup', handleUserInteraction, { capture: false });
    };
  }, [settings.autoFullscreenLandscape, requestLandscapeFullscreen, lockMobileLandscape]);

  // Track Fullscreen API state changes and enforce landscape lock when entering fullscreen
  useEffect(() => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
    };
    const onFullscreenChange = () => {
      const active = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
      setIsFullscreen(active);
      if (active) {
        void lockMobileLandscape();
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, [lockMobileLandscape]);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
        webkitExitFullscreen?: () => Promise<void>;
      };
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        if (typeof doc.exitFullscreen === 'function') {
          await doc.exitFullscreen();
        } else if (typeof doc.webkitExitFullscreen === 'function') {
          await doc.webkitExitFullscreen();
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

  // Sync activeWeapon state from simulation
  useEffect(() => {
    if (screenState !== 'combat') return;
    const id = window.setInterval(() => {
      const curWep = simRef.current.player.activeWeapon;
      setSelectedWeapon((prev) => (prev !== curWep ? curWep : prev));
    }, 150);
    return () => window.clearInterval(id);
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
      skipLoadoutPrompt = false
    ) => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      const nextSim = createSimulationState(
        overrideP1,
        overrideP2,
        overrideArena,
        overrideRounds,
        overrideTimer,
        loadoutWeapons
      );
      setSelectedWeapon(nextSim.player.activeWeapon);
      simRef.current = nextSim;
      setLockedOn(false);
      setSimVersion((v) => v + 1);
      setRoundBanner(null);
      setCountdownValue(null);
      setScreenState('combat');

      if (skipLoadoutPrompt) {
        setLoadoutOverlayMode(null);
      } else {
        setLoadoutOverlayMode('initial');
      }

      if (settings.autoFullscreenLandscape) {
        void requestLandscapeFullscreen();
      }
    },
    [
      p1Char,
      p2Char,
      arenaId,
      roundsToWin,
      roundTimeSeconds,
      loadoutWeapons,
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
    }, 600);
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
      if (settingsOpen || layoutEditorOpen) return;

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
          if (document.pointerLockElement) {
            try {
              document.exitPointerLock();
            } catch {
              // ignore
            }
          }
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
    };

    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [
    screenState,
    settingsOpen,
    layoutEditorOpen,
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
    if (evt.type === 'player_respawn' && simRef.current.player.awaitingRespawn) {
      setLoadoutOverlayMode('respawn');
    }
    if (
      evt.type === 'headshot' ||
      evt.type === 'enemy_killed' ||
      evt.type === 'wave_clear' ||
      evt.type === 'player_respawn' ||
      evt.type === 'pickup_collected' ||
      evt.type === 'barrel_explode' ||
      evt.type === 'prop_shatter'
    ) {
      const colorMap: Record<string, string> = {
        headshot: '#f59e0b',
        enemy_killed: '#e4e4e7',
        wave_clear: '#10b981',
        player_respawn: '#38bdf8',
        pickup_collected: '#10b981',
        barrel_explode: '#f97316',
        prop_shatter: '#d4d4d8',
      };
      setCombatCallout({
        id: Date.now() + Math.random(),
        text: evt.label,
        color: colorMap[evt.type] || '#f4f4f5',
      });
    }
  }, []);

  // Clear combat callouts after 1.0s
  useEffect(() => {
    if (!combatCallout) return;
    const t = window.setTimeout(() => setCombatCallout(null), 1000);
    return () => window.clearTimeout(t);
  }, [combatCallout]);

  const handleRoundFinished = useCallback((winner: 'p1' | 'p2' | 'draw') => {
    const sim = simRef.current;
    setSimVersion((v) => v + 1);

    const winLabel =
      winner === 'draw'
        ? 'TIME EXPIRED'
        : winner === 'p1'
          ? 'VICTORY · MOST KILLS'
          : `WINNER: ${sim.winnerName || 'HOSTILE'}`;
    setRoundBanner(winLabel);

    window.setTimeout(() => {
      if (sim.matchOver) {
        if (document.pointerLockElement) {
          try {
            document.exitPointerLock();
          } catch {
            // ignore
          }
        }
        setRoundBanner(null);
        setScreenState('match_result');
      } else {
        resetRoundPositions(sim);
        setSimVersion((v) => v + 1);
        setRoundBanner(null);
      }
    }, 900);
  }, []);

  const handleUpdateSettings = useCallback((updates: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        ...updates,
        buttonsLayout: updates.buttonsLayout
          ? { ...prev.buttonsLayout, ...updates.buttonsLayout }
          : prev.buttonsLayout,
      };
      soundEngine.setVolume(next.masterVolume, next.muted);
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleSelectWeapon = useCallback((w: WeaponId) => {
    const action = handleWeaponSlotClick(simRef.current.player, w);
    if (action === 'switched') {
      setSelectedWeapon(w);
    }
  }, []);

  const handleSelectLoadoutPair = useCallback(
    (
      pairId: LoadoutPairId,
      weapons: [WeaponId, WeaponId],
      autoSpawn = false
    ) => {
      setSelectedLoadoutPairId(pairId);
      setLoadoutWeapons(weapons);
      setSelectedWeapon(weapons[0]);
      setPlayerLoadoutPair(simRef.current.player, weapons);
      simRef.current.player.activeWeapon = weapons[0];
      if (autoSpawn) {
        simRef.current.player.awaitingRespawn = false;
        setLoadoutOverlayMode(null);
      }
      if (settings.autoFullscreenLandscape) {
        void requestLandscapeFullscreen();
      }
    },
    [settings.autoFullscreenLandscape, requestLandscapeFullscreen]
  );

  const handleConfirmRespawn = useCallback(() => {
    simRef.current.player.awaitingRespawn = false;
    simRef.current.player.hp = simRef.current.player.maxHp;
    setLoadoutOverlayMode(null);
    if (settings.autoFullscreenLandscape) {
      void requestLandscapeFullscreen();
    }
  }, [settings.autoFullscreenLandscape, requestLandscapeFullscreen]);

  const isCombatVisible =
    screenState === 'combat' || screenState === 'paused' || screenState === 'match_result';

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden bg-[#0e1015] select-none">
      {/* Persistent Three.js WebGL First-Person Shooter Viewport */}
      <GameCanvas
        screenState={screenState}
        gameMode={gameMode}
        p1Char={p1Char}
        p2Char={p2Char}
        arenaId={arenaId}
        botDifficulty={botDifficulty}
        lockedOn={lockedOn}
        firstPersonMode={firstPersonMode}
        settings={settings}
        trainingConfig={trainingConfig}
        simRef={simRef}
        hudRefs={hudRefs}
        touchInputRef={touchInputRef}
        loadoutOverlayOpen={Boolean(loadoutOverlayMode)}
        onToggleLockOn={() => setLockedOn((prev) => !prev)}
        onToggleFirstPerson={() => setFirstPersonMode((prev) => !prev)}
        onCombatEvent={handleCombatEvent}
        onRoundFinished={handleRoundFinished}
      />

      {/* Active FPS Combat HUD (Hidden while Full-Screen Controls Layout Editor is active) */}
      {isCombatVisible && !layoutEditorOpen && (
        <CombatHUD
          hudRefs={hudRefs}
          p1Char={p1Char}
          p2Char={p2Char}
          p1Name="OPERATOR"
          p2Name="HOSTILES"
          roundNumber={simRef.current.waveNumber}
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
          firstPersonMode={firstPersonMode}
          settings={settings}
          trainingConfig={trainingConfig}
          touchInputRef={touchInputRef}
          activeWeapon={selectedWeapon}
          loadoutWeapons={loadoutWeapons}
          selectedLoadoutPairId={selectedLoadoutPairId}
          loadoutOverlayMode={screenState === 'combat' ? loadoutOverlayMode : null}
          onSelectLoadoutPair={handleSelectLoadoutPair}
          onConfirmRespawn={handleConfirmRespawn}
          onSelectWeapon={handleSelectWeapon}
          onToggleMute={() => handleUpdateSettings({ muted: !settings.muted })}
          onToggleFullscreen={() => void handleToggleFullscreen()}
          onToggleLockOn={() => setLockedOn((prev) => !prev)}
          onToggleFirstPerson={() => setFirstPersonMode((prev) => !prev)}
          onToggleControlHints={() =>
            handleUpdateSettings({ showControlHints: !settings.showControlHints })
          }
          onPause={() => {
            if (document.pointerLockElement) {
              try {
                document.exitPointerLock();
              } catch {
                // ignore
              }
            }
            setScreenState('paused');
          }}
          onOpenLayoutEditor={() => {
            if (document.pointerLockElement) {
              try {
                document.exitPointerLock();
              } catch {
                // ignore
              }
            }
            setEditorOpenedFromSettings(false);
            setLayoutEditorOpen(true);
          }}
          onRestartRound={() => {
            resetRoundPositions(simRef.current);
            setSimVersion((v) => v + 1);
          }}
          onUpdateTrainingConfig={(upd) =>
            setTrainingConfig((prev) => ({ ...prev, ...upd }))
          }
        />
      )}

      {/* Clean Matte Menu, Settings, Pause & Result Screens */}
      {!layoutEditorOpen && (
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
          selectedWeapon={selectedWeapon}
          selectedLoadoutPairId={selectedLoadoutPairId}
          onSelectLoadoutPair={handleSelectLoadoutPair}
          onSelectWeapon={handleSelectWeapon}
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
          onOpenLayoutEditor={() => {
            setEditorOpenedFromSettings(settingsOpen);
            setSettingsOpen(false);
            setLayoutEditorOpen(true);
          }}
          onUpdateSettings={handleUpdateSettings}
        />
      )}

      {/* Dedicated Full-Screen Controls Layout Editor with Movable & Hideable Mini Bar */}
      {layoutEditorOpen && (
        <HUDLayoutEditor
          settings={settings}
          openedFromSettings={editorOpenedFromSettings}
          onSave={(newLayout, globalScale, globalOpacity) => {
            handleUpdateSettings({
              buttonsLayout: newLayout,
              hudGlobalScale: globalScale,
              hudGlobalOpacity: globalOpacity,
            });
          }}
          onClose={() => {
            setLayoutEditorOpen(false);
            if (editorOpenedFromSettings) {
              setSettingsOpen(true);
              setEditorOpenedFromSettings(false);
            }
          }}
        />
      )}
    </div>
  );
}

export default App;
