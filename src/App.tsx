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
  LobbyTab,
  PartySize,
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
import {
  BODY_REGION_SPECS,
  type BodyRegionId,
  CHARACTER_ROSTER,
  type CharacterPoseId,
  type CosmeticInventoryItem,
  type EquipmentSlotId,
  INITIAL_COSMETIC_INVENTORY,
  enforcePartySizeLimit,
} from './game/characterSystem.ts';
import {
  type BrushSettings,
  DEFAULT_BRUSH_SETTINGS,
  MAX_UNDO_STEPS,
  PAINT_ATLAS_SIZE,
  type PaintLayer,
  type SavedPaintDesign,
  clonePaintLayer,
  compositePaintLayersToBuffer,
  createEmptyLayer,
  decodeRgbaBufferRLE,
  deserializePaintLayer,
  paintStorage,
} from './game/paintSystem.ts';
import { CameraFocusPreset, GameCanvas } from './components/GameCanvas.tsx';
import { CombatHUD, HudDomRefs, TouchInputState } from './components/CombatHUD.tsx';
import { MenuScreens } from './components/MenuScreens.tsx';
import {
  LobbyAndVaultUI,
  MissionProgressItem,
  PartyMemberSlot,
} from './components/LobbyAndVaultUI.tsx';
import { HUDLayoutEditor } from './components/HUDLayoutEditor.tsx';
import { soundEngine } from './audio/soundEngine.ts';
import { multiplayerClient, RoomStatePayload } from './network/multiplayerClient.ts';

const SETTINGS_STORAGE_KEY = 'fracture_fps_settings_v3';

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

  // =========================================================================
  // 3D LOBBY, CHARACTER ROSTER, PARTY & VAULT 3D PAINTING STUDIO STATE
  // =========================================================================
  const [activeLobbyTab, setActiveLobbyTab] = useState<LobbyTab>('home');
  const [vaultSubTab, setVaultSubTab] = useState<'studio' | 'gallery' | 'inventory'>('studio');
  const [unlockedChars, setUnlockedChars] = useState<CharacterId[]>([
    'volt',
    'rift',
    'kestrel',
    'chroma',
  ]);
  const [activeEquipment, setActiveEquipment] = useState<EquipmentSlotId[]>([]);
  const [characterPose, setCharacterPose] = useState<CharacterPoseId>('idle');
  const [cameraFocusPreset, setCameraFocusPreset] = useState<CameraFocusPreset>('full');
  const [cameraResetTrigger, setCameraResetTrigger] = useState<number>(0);
  const [cameraZoomDeltaTrigger, setCameraZoomDeltaTrigger] = useState<{
    seq: number;
    delta: number;
  }>({ seq: 0, delta: 0 });

  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      return localStorage.getItem('fracture_player_name_v2') || 'ShadowRider';
    } catch {
      return 'ShadowRider';
    }
  });
  const [partySize, setPartySize] = useState<PartySize>('squad');
  const [partyMembers, setPartyMembers] = useState<PartyMemberSlot[]>([
    {
      id: 'local_p1',
      name: 'ShadowRider',
      characterId: 'volt',
      level: 12,
      ready: true,
      isLeader: true,
      statusText: 'Ready',
    },
  ]);

  const [playerCredits, setPlayerCredits] = useState<number>(4850);
  const [playerGems, setPlayerGems] = useState<number>(320);
  const [playerXp, setPlayerXp] = useState<number>(1250);
  const playerLevel = Math.max(12, Math.floor((playerXp - 1250) / 1000) + 12);
  const [cosmeticInventory, setCosmeticInventory] = useState<CosmeticInventoryItem[]>(
    INITIAL_COSMETIC_INVENTORY
  );
  const [missions, setMissions] = useState<MissionProgressItem[]>([
    {
      id: 'm_paint_1',
      title: 'Studio Artisan',
      description: 'Create and save a custom 3D body-paint design in the Paint Studio.',
      progress: 0,
      target: 1,
      rewardCredits: 450,
      rewardXp: 500,
      claimed: false,
    },
    {
      id: 'm_equip_1',
      title: 'Colors in Combat',
      description: 'Equip any custom paint design to your active Poly character.',
      progress: 0,
      target: 1,
      rewardCredits: 300,
      rewardXp: 350,
      claimed: false,
    },
    {
      id: 'm_kills_5',
      title: 'Arena Dominator',
      description: 'Eliminate 5 hostile combatants across Deathmatch or Firing Range.',
      progress: 0,
      target: 5,
      rewardCredits: 600,
      rewardXp: 750,
      claimed: false,
    },
  ]);

  // Studio Painting State & Undo/Redo Stack
  const [studioInteractionMode, setStudioInteractionMode] = useState<'paint' | 'orbit'>('paint');
  const [brushSettings, setBrushSettings] = useState<BrushSettings>(DEFAULT_BRUSH_SETTINGS);
  const [recentColors, setRecentColors] = useState<string[]>([
    '#ef4444',
    '#3b82f6',
    '#10b981',
    '#facc15',
    '#111827',
  ]);
  const initialBaseLayer = useRef<PaintLayer>(createEmptyLayer('layer_1', 'Layer 1'));
  const studioLayersRef = useRef<PaintLayer[]>([initialBaseLayer.current]);
  const [studioLayers, setStudioLayers] = useState<PaintLayer[]>([initialBaseLayer.current]);
  const [activeLayerId, setActiveLayerId] = useState<string>('layer_1');
  const [studioTextureRevision, setStudioTextureRevision] = useState<number>(1);

  const undoStackRef = useRef<PaintLayer[][]>([]);
  const redoStackRef = useRef<PaintLayer[][]>([]);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  const [currentDesignId, setCurrentDesignId] = useState<string | null>(null);
  const [currentDesignName, setCurrentDesignName] = useState<string>('Poly Custom 01');
  const [savedDesigns, setSavedDesigns] = useState<SavedPaintDesign[]>(() =>
    paintStorage.getDesigns()
  );
  const [equippedDesignId, setEquippedDesignId] = useState<string | null>(() =>
    paintStorage.getEquippedDesignId('volt')
  );
  const equippedCompositeBufferRef = useRef<Uint8ClampedArray | null>(null);
  const [equippedDesignRevision, setEquippedDesignRevision] = useState<number>(1);
  const [hoveredBodyRegion, setHoveredBodyRegion] = useState<BodyRegionId | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setStatusToast(msg);
  }, []);

  useEffect(() => {
    if (!statusToast) return;
    const t = window.setTimeout(() => setStatusToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [statusToast]);

  // Sync saved designs & equipped skin from IndexedDB / localStorage on mount and updates
  useEffect(() => {
    const syncFromStorage = () => {
      const designs = paintStorage.getDesigns();
      setSavedDesigns(designs);
      const eqId = paintStorage.getEquippedDesignId(p1Char);
      setEquippedDesignId(eqId);
      const eqDesign = paintStorage.getDesignById(eqId);
      if (eqDesign) {
        equippedCompositeBufferRef.current = decodeRgbaBufferRLE(
          eqDesign.compositeRleBase64,
          PAINT_ATLAS_SIZE * PAINT_ATLAS_SIZE * 4
        );
      } else {
        equippedCompositeBufferRef.current = null;
      }
      setEquippedDesignRevision((r) => r + 1);
    };
    syncFromStorage();
    return paintStorage.subscribe(syncFromStorage);
  }, [p1Char]);

  const pushStudioUndoSnapshot = useCallback(() => {
    const cloned = studioLayersRef.current.map(clonePaintLayer);
    undoStackRef.current.push(cloned);
    if (undoStackRef.current.length > MAX_UNDO_STEPS) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(false);
  }, []);

  const commitStudioLayerUpdate = useCallback((nextLayers: PaintLayer[]) => {
    studioLayersRef.current = nextLayers;
    setStudioLayers([...nextLayers]);
    setStudioTextureRevision((r) => r + 1);
  }, []);

  const handleUndoStudio = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current.pop()!;
    redoStackRef.current.push(studioLayersRef.current.map(clonePaintLayer));
    commitStudioLayerUpdate(prev);
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, [commitStudioLayerUpdate]);

  const handleRedoStudio = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push(studioLayersRef.current.map(clonePaintLayer));
    commitStudioLayerUpdate(next);
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, [commitStudioLayerUpdate]);

  const handleAddLayer = useCallback(() => {
    pushStudioUndoSnapshot();
    const newId = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const newLayer = createEmptyLayer(
      newId,
      `Layer ${studioLayersRef.current.length + 1}`
    );
    const next = [...studioLayersRef.current, newLayer];
    commitStudioLayerUpdate(next);
    setActiveLayerId(newId);
  }, [pushStudioUndoSnapshot, commitStudioLayerUpdate]);

  const handleDeleteLayer = useCallback(
    (layerId: string) => {
      if (studioLayersRef.current.length <= 1) return;
      pushStudioUndoSnapshot();
      const next = studioLayersRef.current.filter((l) => l.id !== layerId);
      commitStudioLayerUpdate(next);
      if (activeLayerId === layerId) {
        setActiveLayerId(next[next.length - 1].id);
      }
    },
    [activeLayerId, pushStudioUndoSnapshot, commitStudioLayerUpdate]
  );

  const handleRenameLayer = useCallback(
    (layerId: string, newName: string) => {
      const clean = newName.trim();
      if (!clean) return;
      const next = studioLayersRef.current.map((l) =>
        l.id === layerId ? { ...l, name: clean } : l
      );
      commitStudioLayerUpdate(next);
    },
    [commitStudioLayerUpdate]
  );

  const handleToggleLayerVisible = useCallback(
    (layerId: string) => {
      const next = studioLayersRef.current.map((l) =>
        l.id === layerId ? { ...l, visible: !l.visible } : l
      );
      commitStudioLayerUpdate(next);
    },
    [commitStudioLayerUpdate]
  );

  const handleChangeLayerOpacity = useCallback(
    (layerId: string, opacity: number) => {
      const next = studioLayersRef.current.map((l) =>
        l.id === layerId ? { ...l, opacity } : l
      );
      commitStudioLayerUpdate(next);
    },
    [commitStudioLayerUpdate]
  );

  const handleMoveLayerOrder = useCallback(
    (layerId: string, dir: -1 | 1) => {
      const idx = studioLayersRef.current.findIndex((l) => l.id === layerId);
      if (idx === -1) return;
      const targetIdx = idx + dir;
      if (targetIdx < 0 || targetIdx >= studioLayersRef.current.length) return;
      pushStudioUndoSnapshot();
      const next = [...studioLayersRef.current];
      const [item] = next.splice(idx, 1);
      next.splice(targetIdx, 0, item);
      commitStudioLayerUpdate(next);
    },
    [pushStudioUndoSnapshot, commitStudioLayerUpdate]
  );

  const handleDuplicateLayer = useCallback(
    (layerId: string) => {
      const orig = studioLayersRef.current.find((l) => l.id === layerId);
      if (!orig) return;
      pushStudioUndoSnapshot();
      const copy = clonePaintLayer(orig);
      copy.id = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      copy.name = `${orig.name} Copy`;
      const next = [...studioLayersRef.current, copy];
      commitStudioLayerUpdate(next);
      setActiveLayerId(copy.id);
    },
    [pushStudioUndoSnapshot, commitStudioLayerUpdate]
  );

  const handleMergeLayerDown = useCallback(
    (layerId: string) => {
      const idx = studioLayersRef.current.findIndex((l) => l.id === layerId);
      if (idx <= 0) return;
      pushStudioUndoSnapshot();
      const top = studioLayersRef.current[idx];
      const bottom = clonePaintLayer(studioLayersRef.current[idx - 1]);
      const topOp = top.visible ? top.opacity : 0;

      for (let i = 0; i < bottom.data.length; i += 4) {
        const srcA = (top.data[i + 3] / 255) * topOp;
        if (srcA <= 0.001) continue;
        const dstA = bottom.data[i + 3] / 255;
        const outA = srcA + dstA * (1 - srcA);
        if (outA > 1e-5) {
          bottom.data[i] = Math.round(
            (top.data[i] * srcA + bottom.data[i] * dstA * (1 - srcA)) / outA
          );
          bottom.data[i + 1] = Math.round(
            (top.data[i + 1] * srcA + bottom.data[i + 1] * dstA * (1 - srcA)) /
              outA
          );
          bottom.data[i + 2] = Math.round(
            (top.data[i + 2] * srcA + bottom.data[i + 2] * dstA * (1 - srcA)) /
              outA
          );
          bottom.data[i + 3] = Math.round(outA * 255);
        }
      }

      const next = [...studioLayersRef.current];
      next.splice(idx - 1, 2, bottom);
      commitStudioLayerUpdate(next);
      setActiveLayerId(bottom.id);
    },
    [pushStudioUndoSnapshot, commitStudioLayerUpdate]
  );

  const handleClearActiveLayer = useCallback(() => {
    pushStudioUndoSnapshot();
    const next = studioLayersRef.current.map((l) => {
      if (l.id !== activeLayerId) return l;
      const cleared = clonePaintLayer(l);
      cleared.data.fill(0);
      return cleared;
    });
    commitStudioLayerUpdate(next);
    showToast('Cleared active layer to pure white.');
  }, [activeLayerId, pushStudioUndoSnapshot, commitStudioLayerUpdate, showToast]);

  const handleClearRegionOnActiveLayer = useCallback(
    (region: BodyRegionId) => {
      pushStudioUndoSnapshot();
      const rect = BODY_REGION_SPECS[region].uvRect;
      const minX = Math.max(0, Math.floor(rect.uMin * PAINT_ATLAS_SIZE));
      const maxX = Math.min(
        PAINT_ATLAS_SIZE - 1,
        Math.ceil(rect.uMax * PAINT_ATLAS_SIZE)
      );
      const minY = Math.max(
        0,
        Math.floor((1.0 - rect.vMax) * PAINT_ATLAS_SIZE)
      );
      const maxY = Math.min(
        PAINT_ATLAS_SIZE - 1,
        Math.ceil((1.0 - rect.vMin) * PAINT_ATLAS_SIZE)
      );

      const next = studioLayersRef.current.map((l) => {
        if (l.id !== activeLayerId) return l;
        const copy = clonePaintLayer(l);
        for (let py = minY; py <= maxY; py++) {
          for (let px = minX; px <= maxX; px++) {
            const idx = (py * PAINT_ATLAS_SIZE + px) * 4;
            copy.data[idx] = 0;
            copy.data[idx + 1] = 0;
            copy.data[idx + 2] = 0;
            copy.data[idx + 3] = 0;
          }
        }
        return copy;
      });
      commitStudioLayerUpdate(next);
      showToast(`Reset ${BODY_REGION_SPECS[region].label} to pure white.`);
    },
    [activeLayerId, pushStudioUndoSnapshot, commitStudioLayerUpdate, showToast]
  );

  const handleResetCharacterToWhite = useCallback(() => {
    pushStudioUndoSnapshot();
    const freshLayer = createEmptyLayer('layer_1', 'Layer 1');
    commitStudioLayerUpdate([freshLayer]);
    setActiveLayerId('layer_1');
    setCurrentDesignId(null);
    setCurrentDesignName(`Poly Custom ${savedDesigns.length + 1}`);
    paintStorage.equipDesign(p1Char, null);
    equippedCompositeBufferRef.current = null;
    setEquippedDesignId(null);
    setEquippedDesignRevision((r) => r + 1);
    showToast('Reset character to pure-white base appearance.');
  }, [
    p1Char,
    savedDesigns.length,
    pushStudioUndoSnapshot,
    commitStudioLayerUpdate,
    showToast,
  ]);

  const handleSaveStudioDesign = useCallback(
    (saveAsNew: boolean) => {
      const res = paintStorage.saveDesign({
        name: currentDesignName,
        characterId: p1Char,
        layers: studioLayersRef.current,
        overwriteDesignId: saveAsNew ? null : currentDesignId,
      });
      if (!res.ok || !res.design) {
        showToast(res.error || 'Could not save design.');
        return;
      }
      setCurrentDesignId(res.design.id);
      setCurrentDesignName(res.design.name);
      setMissions((prev) =>
        prev.map((m) =>
          m.id === 'm_paint_1' ? { ...m, progress: Math.max(m.progress, 1) } : m
        )
      );
      showToast(`Saved "${res.design.name}" to Skin Vault.`);
    },
    [currentDesignName, p1Char, currentDesignId, showToast]
  );

  const handleEquipCurrentStudioDesign = useCallback(() => {
    const res = paintStorage.saveDesign({
      name: currentDesignName || 'Custom Poly Skin',
      characterId: p1Char,
      layers: studioLayersRef.current,
      overwriteDesignId: currentDesignId,
    });
    if (res.ok && res.design) {
      setCurrentDesignId(res.design.id);
      paintStorage.equipDesign(p1Char, res.design.id);
      setEquippedDesignId(res.design.id);
    }
    equippedCompositeBufferRef.current = compositePaintLayersToBuffer(
      studioLayersRef.current
    );
    setEquippedDesignRevision((r) => r + 1);
    setMissions((prev) =>
      prev.map((m) =>
        m.id === 'm_paint_1' || m.id === 'm_equip_1'
          ? { ...m, progress: Math.max(m.progress, 1) }
          : m
      )
    );
    showToast(`Equipped "${currentDesignName}" to ${CHARACTER_ROSTER[p1Char].name}!`);
  }, [currentDesignName, p1Char, currentDesignId, showToast]);

  const handleLoadSavedDesignIntoStudio = useCallback(
    (design: SavedPaintDesign) => {
      pushStudioUndoSnapshot();
      const loadedLayers =
        design.layers.length > 0
          ? design.layers.map(deserializePaintLayer)
          : [createEmptyLayer('layer_1', 'Layer 1')];
      commitStudioLayerUpdate(loadedLayers);
      setActiveLayerId(loadedLayers[loadedLayers.length - 1].id);
      setCurrentDesignId(design.isSample ? null : design.id);
      setCurrentDesignName(
        design.isSample
          ? `${design.name.replace(/\s*\[Sample\]$/i, '')} Custom`
          : design.name
      );
      showToast(`Loaded "${design.name}" into 3D Studio for editing.`);
    },
    [pushStudioUndoSnapshot, commitStudioLayerUpdate, showToast]
  );

  const handleEquipSavedDesign = useCallback(
    (design: SavedPaintDesign) => {
      const ok = paintStorage.equipDesign(p1Char, design.id);
      if (!ok) {
        showToast('Design is not compatible with this character model.');
        return;
      }
      setEquippedDesignId(design.id);
      equippedCompositeBufferRef.current = decodeRgbaBufferRLE(
        design.compositeRleBase64,
        PAINT_ATLAS_SIZE * PAINT_ATLAS_SIZE * 4
      );
      setEquippedDesignRevision((r) => r + 1);
      setMissions((prev) =>
        prev.map((m) =>
          m.id === 'm_equip_1' ? { ...m, progress: Math.max(m.progress, 1) } : m
        )
      );
      showToast(`Equipped "${design.name}" to ${CHARACTER_ROSTER[p1Char].name}!`);
    },
    [p1Char, showToast]
  );

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

      const activeTag = document.activeElement?.tagName;
      const isTypingInInput =
        activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';

      if (
        screenState === 'main_menu' &&
        activeLobbyTab === 'home' &&
        !isTypingInInput &&
        (e.code === 'Enter' || e.code === 'Space')
      ) {
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
    activeLobbyTab,
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
    if (evt.type === 'enemy_killed' || evt.type === 'headshot') {
      setPlayerCredits((c) => c + (evt.type === 'headshot' ? 75 : 45));
      setPlayerXp((x) => x + (evt.type === 'headshot' ? 120 : 80));
      setMissions((prev) =>
        prev.map((m) =>
          m.id === 'm_kills_5'
            ? { ...m, progress: Math.min(m.target, m.progress + 1) }
            : m
        )
      );
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
      {/* Persistent Three.js WebGL First-Person Shooter & 3D Chameleon Studio Viewport */}
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
        activeLobbyTab={activeLobbyTab}
        vaultSubTab={vaultSubTab}
        characterPose={characterPose}
        cameraFocusPreset={cameraFocusPreset}
        cameraResetTrigger={cameraResetTrigger}
        cameraZoomDeltaTrigger={cameraZoomDeltaTrigger}
        activeEquipment={activeEquipment}
        studioInteractionMode={studioInteractionMode}
        brushSettings={brushSettings}
        studioLayersRef={studioLayersRef}
        activeLayerId={activeLayerId}
        studioTextureRevision={studioTextureRevision}
        equippedCompositeBufferRef={equippedCompositeBufferRef}
        equippedDesignRevision={equippedDesignRevision}
        selectedWeapon={selectedWeapon}
        partyMembers={partyMembers}
        onPaintStrokeBeforeStart={pushStudioUndoSnapshot}
        onPaintStrokeCommitted={() => {
          setStudioLayers([...studioLayersRef.current]);
          setStudioTextureRevision((r) => r + 1);
        }}
        onEyedropperSampled={(hex) => {
          setBrushSettings((prev) => ({ ...prev, colorHex: hex, tool: 'brush' }));
          showToast(`Sampled color ${hex.toUpperCase()}`);
        }}
        onHoverBodyRegion={setHoveredBodyRegion}
        onToggleLockOn={() => setLockedOn((prev) => !prev)}
        onToggleFirstPerson={() => setFirstPersonMode((prev) => !prev)}
        onCombatEvent={handleCombatEvent}
        onRoundFinished={handleRoundFinished}
      />

      {/* 3D Character Lobby, Character Selection Roster & Vault Custom Painting Studio */}
      {screenState === 'main_menu' && !layoutEditorOpen && (
        <LobbyAndVaultUI
          activeTab={activeLobbyTab}
          vaultSubTab={vaultSubTab}
          p1Char={p1Char}
          unlockedChars={unlockedChars}
          activeEquipment={activeEquipment}
          characterPose={characterPose}
          cameraFocusPreset={cameraFocusPreset}
          gameMode={gameMode}
          arenaId={arenaId}
          botDifficulty={botDifficulty}
          partySize={partySize}
          partyMembers={partyMembers}
          selectedLoadoutPairId={selectedLoadoutPairId}
          loadoutWeapons={loadoutWeapons}
          selectedWeapon={selectedWeapon}
          playerName={playerName}
          onChangePlayerName={(nextName) => {
            setPlayerName(nextName);
            try {
              localStorage.setItem('fracture_player_name_v2', nextName);
            } catch {
              // ignore
            }
            setPartyMembers((prev) =>
              prev.map((m) => (m.isLeader ? { ...m, name: nextName } : m))
            );
            showToast(`Updated Callsign to "${nextName}".`);
          }}
          playerCredits={playerCredits}
          playerGems={playerGems}
          onAddCurrency={(coinsDelta, gemsDelta) => {
            if (coinsDelta) setPlayerCredits((c) => c + coinsDelta);
            if (gemsDelta) setPlayerGems((g) => g + gemsDelta);
            showToast(
              `Added ${coinsDelta ? `+${coinsDelta} Coins ` : ''}${
                gemsDelta ? `+${gemsDelta} Gems` : ''
              }!`
            );
          }}
          playerXp={playerXp}
          playerLevel={playerLevel}
          cosmeticInventory={cosmeticInventory}
          missions={missions}
          settings={settings}
          isFullscreen={isFullscreen}
          onUpdateSettings={handleUpdateSettings}
          onToggleFullscreen={() => void handleToggleFullscreen()}
          onOpenLayoutEditor={() => {
            setEditorOpenedFromSettings(false);
            setLayoutEditorOpen(true);
          }}
          studioInteractionMode={studioInteractionMode}
          brushSettings={brushSettings}
          recentColors={recentColors}
          studioLayers={studioLayers}
          activeLayerId={activeLayerId}
          canUndo={canUndo}
          canRedo={canRedo}
          currentDesignId={currentDesignId}
          currentDesignName={currentDesignName}
          equippedDesignId={equippedDesignId}
          savedDesigns={savedDesigns}
          hoveredBodyRegion={hoveredBodyRegion}
          statusToast={statusToast}
          onSelectTab={setActiveLobbyTab}
          onSelectVaultSubTab={setVaultSubTab}
          onSelectCharacter={(cid) => {
            // Preserve currently equipped design if compatible with the new Poly unit
            const prevEqId = paintStorage.getEquippedDesignId(p1Char);
            if (prevEqId && !paintStorage.getEquippedDesignId(cid)) {
              paintStorage.equipDesign(cid, prevEqId);
            }
            setP1Char(cid);
            simRef.current.p1.characterId = cid;
            setPartyMembers((prev) =>
              prev.map((m) => (m.isLeader ? { ...m, characterId: cid } : m))
            );
            showToast(`Selected ${CHARACTER_ROSTER[cid].name} Unit.`);
          }}
          onUnlockCharacter={(cid, cost) => {
            if (playerCredits < cost) {
              showToast(`Need ${cost} CR to unlock ${CHARACTER_ROSTER[cid].name}.`);
              return;
            }
            setPlayerCredits((c) => c - cost);
            setUnlockedChars((prev) => (prev.includes(cid) ? prev : [...prev, cid]));
            setP1Char(cid);
            simRef.current.p1.characterId = cid;
            showToast(`Unlocked & Equipped ${CHARACTER_ROSTER[cid].name}!`);
          }}
          onToggleEquipmentSlot={(slot) => {
            setActiveEquipment((prev) =>
              prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
            );
          }}
          onSelectPose={setCharacterPose}
          onSelectCameraPreset={setCameraFocusPreset}
          onResetCamera={() => {
            setCameraFocusPreset('full');
            setCameraResetTrigger((c) => c + 1);
          }}
          onZoomCamera={(delta) =>
            setCameraZoomDeltaTrigger((prev) => ({ seq: prev.seq + 1, delta }))
          }
          onSelectGameMode={setGameMode}
          onSelectArena={(id) => {
            setArenaId(id);
            simRef.current.arenaId = id;
          }}
          onSelectDifficulty={setBotDifficulty}
          onSelectPartySize={(sz) => {
            setPartySize(sz);
            setPartyMembers((prev) => enforcePartySizeLimit(prev, sz));
          }}
          onInviteFriendToParty={(fr) => {
            setPartyMembers((prev) => {
              const next: PartyMemberSlot[] = [
                ...prev,
                {
                  id: fr.id,
                  name: fr.name,
                  characterId: fr.characterId,
                  level: fr.level,
                  ready: true,
                  statusText: 'Ready',
                },
              ];
              return enforcePartySizeLimit(next, partySize);
            });
            showToast(`${fr.name} joined your ${partySize.toUpperCase()} party.`);
          }}
          onRemovePartyMember={(id) => {
            setPartyMembers((prev) => prev.filter((m) => m.id !== id));
          }}
          onTogglePartyReady={() => {
            setPartyMembers((prev) =>
              prev.map((m) => (m.isLeader ? { ...m, ready: !m.ready } : m))
            );
          }}
          onSelectLoadoutPair={(pairId, weapons) =>
            handleSelectLoadoutPair(pairId, weapons, false)
          }
          onSelectWeapon={handleSelectWeapon}
          onStartMatch={() =>
            launchMatch(p1Char, p2Char, arenaId, roundsToWin, roundTimeSeconds, false)
          }
          onOpenSettingsModal={() => setSettingsOpen(true)}
          onClaimMission={(mid) => {
            const target = missions.find((m) => m.id === mid);
            if (!target || target.claimed || target.progress < target.target) return;
            setMissions((prev) =>
              prev.map((m) => (m.id === mid ? { ...m, claimed: true } : m))
            );
            setPlayerCredits((c) => c + target.rewardCredits);
            setPlayerXp((x) => x + target.rewardXp);
            showToast(
              `Claimed +${target.rewardCredits} CR & +${target.rewardXp} XP!`
            );
          }}
          onPurchaseCosmeticItem={(itemId, price) => {
            if (playerCredits < price) return;
            setPlayerCredits((c) => c - price);
            setCosmeticInventory((prev) =>
              prev.map((it) => (it.id === itemId ? { ...it, owned: true } : it))
            );
            const item = cosmeticInventory.find((it) => it.id === itemId);
            if (item?.equipmentSlot) {
              setActiveEquipment((prev) =>
                prev.includes(item.equipmentSlot!)
                  ? prev
                  : [...prev, item.equipmentSlot!]
              );
            }
            showToast(`Unlocked ${item?.name || 'Cosmetic Item'}!`);
          }}
          onSetStudioInteractionMode={setStudioInteractionMode}
          onUpdateBrushSettings={(partial) =>
            setBrushSettings((prev) => ({ ...prev, ...partial }))
          }
          onSelectColor={(hex) => {
            setBrushSettings((prev) => ({
              ...prev,
              colorHex: hex,
              tool: prev.tool === 'eraser' || prev.tool === 'eyedropper' ? 'brush' : prev.tool,
            }));
            setRecentColors((prev) => [
              hex,
              ...prev.filter((c) => c.toLowerCase() !== hex.toLowerCase()),
            ].slice(0, 8));
          }}
          onSelectActiveLayer={setActiveLayerId}
          onAddLayer={handleAddLayer}
          onDeleteLayer={handleDeleteLayer}
          onRenameLayer={handleRenameLayer}
          onToggleLayerVisible={handleToggleLayerVisible}
          onChangeLayerOpacity={handleChangeLayerOpacity}
          onMoveLayerOrder={handleMoveLayerOrder}
          onDuplicateLayer={handleDuplicateLayer}
          onMergeLayerDown={handleMergeLayerDown}
          onUndoStudio={handleUndoStudio}
          onRedoStudio={handleRedoStudio}
          onClearActiveLayer={handleClearActiveLayer}
          onClearRegionOnActiveLayer={handleClearRegionOnActiveLayer}
          onResetCharacterToWhite={handleResetCharacterToWhite}
          onChangeDesignName={setCurrentDesignName}
          onSaveDesign={handleSaveStudioDesign}
          onEquipCurrentStudioDesign={handleEquipCurrentStudioDesign}
          onLoadSavedDesignIntoStudio={handleLoadSavedDesignIntoStudio}
          onEquipSavedDesign={handleEquipSavedDesign}
          onDuplicateSavedDesign={(id) => {
            const res = paintStorage.duplicateDesign(id);
            if (res.ok && res.design) {
              showToast(`Duplicated "${res.design.name}".`);
            }
          }}
          onRenameSavedDesign={(id, newName) => {
            if (paintStorage.renameDesign(id, newName)) {
              showToast(`Renamed design to "${newName.trim()}".`);
            }
          }}
          onDeleteSavedDesign={(id) => {
            if (paintStorage.deleteDesign(id)) {
              if (currentDesignId === id) setCurrentDesignId(null);
              showToast('Deleted design from Vault.');
            }
          }}
        />
      )}

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

      {/* Settings, Pause & Result Modals */}
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
