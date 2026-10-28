import React, { useEffect, useRef, useState } from 'react';
import {
  ARENA_ORDER,
  ARENA_REGISTRY,
  type ArenaId,
  type BotDifficulty,
  type CharacterId,
  type GameMode,
  type GameSettings,
  LOADOUT_PAIRS,
  type LoadoutPairId,
  type LobbyTab,
  type PartySize,
  WEAPON_ORDER,
  WEAPON_REGISTRY,
  type WeaponId,
} from '../game/config.ts';
import {
  BODY_REGION_ORDER,
  BODY_REGION_SPECS,
  type BodyRegionId,
  CHARACTER_ORDER,
  CHARACTER_ROSTER,
  type CharacterPoseId,
  type CosmeticInventoryItem,
  type EquipmentSlotId,
  PARTY_SIZE_LIMITS,
  canAddPartyMember,
} from '../game/characterSystem.ts';
import {
  type BrushSettings,
  PAINT_ATLAS_SIZE,
  PRESET_PAINT_SWATCHES,
  SORTED_COLOR_PALETTES,
  type PaintLayer,
  type PaintToolId,
  type SavedPaintDesign,
  decodeRgbaBufferRLE,
  generateShadingTonesForHex,
} from '../game/paintSystem.ts';
import type { CameraFocusPreset } from './GameCanvas.tsx';
import { SharedSettingsPanel } from './MenuScreens.tsx';
import { WeaponIllustration } from './WeaponArtwork.tsx';
import { soundEngine } from '../audio/soundEngine.ts';
import { DEFAULT_SETTINGS } from '../game/config.ts';
import {
  CORE_SELECTABLE_OPTICS,
  getOpticConfig,
  resolveEquippedOptic,
} from '../game/ads/index.ts';

export interface PartyMemberSlot {
  id: string;
  name: string;
  characterId: CharacterId;
  level: number;
  ready: boolean;
  isLeader?: boolean;
  statusText: string;
}

export interface MissionProgressItem {
  id: string;
  title: string;
  description: string;
  category?: 'daily' | 'weekly' | 'season';
  progress: number;
  target: number;
  rewardCredits: number;
  rewardXp: number;
  rewardGems?: number;
  claimed: boolean;
}

export interface LobbyAndVaultUIProps {
  activeTab: LobbyTab;
  vaultSubTab: 'studio' | 'gallery' | 'inventory';
  p1Char: CharacterId;
  unlockedChars: CharacterId[];
  activeEquipment: EquipmentSlotId[];
  characterPose: CharacterPoseId;
  cameraFocusPreset: CameraFocusPreset;
  gameMode: GameMode;
  arenaId: ArenaId;
  botDifficulty: BotDifficulty;
  partySize: PartySize;
  partyMembers: PartyMemberSlot[];
  selectedLoadoutPairId: LoadoutPairId;
  loadoutWeapons: [WeaponId, WeaponId];
  selectedWeapon: WeaponId;
  playerName?: string;
  onChangePlayerName?: (name: string) => void;
  playerCredits: number;
  playerGems?: number;
  onAddCurrency?: (coinsDelta: number, gemsDelta: number) => void;
  playerXp: number;
  playerLevel: number;
  cosmeticInventory: CosmeticInventoryItem[];
  missions: MissionProgressItem[];
  settings?: GameSettings;
  isFullscreen?: boolean;
  onUpdateSettings?: (partial: Partial<GameSettings>) => void;
  onToggleFullscreen?: () => void;
  onOpenLayoutEditor?: () => void;
  // Studio & Saved Designs props
  studioInteractionMode: 'paint' | 'orbit';
  brushSettings: BrushSettings;
  recentColors: string[];
  studioLayers: PaintLayer[];
  activeLayerId: string;
  canUndo: boolean;
  canRedo: boolean;
  currentDesignId: string | null;
  currentDesignName: string;
  equippedDesignId: string | null;
  savedDesigns: SavedPaintDesign[];
  hoveredBodyRegion: BodyRegionId | null;
  statusToast: string | null;
  // Handlers
  onSelectTab: (tab: LobbyTab) => void;
  onSelectVaultSubTab: (sub: 'studio' | 'gallery' | 'inventory') => void;
  onSelectCharacter: (charId: CharacterId) => void;
  onUnlockCharacter: (charId: CharacterId, cost: number) => void;
  onToggleEquipmentSlot: (slot: EquipmentSlotId) => void;
  onSelectPose: (pose: CharacterPoseId) => void;
  onSelectCameraPreset: (preset: CameraFocusPreset) => void;
  onResetCamera: () => void;
  onZoomCamera: (delta: number) => void;
  onSelectGameMode: (mode: GameMode) => void;
  onSelectArena: (arena: ArenaId) => void;
  onSelectDifficulty: (diff: BotDifficulty) => void;
  onSelectPartySize: (size: PartySize) => void;
  onInviteFriendToParty: (friend: {
    id: string;
    name: string;
    characterId: CharacterId;
    level: number;
  }) => void;
  onRemovePartyMember: (memberId: string) => void;
  onTogglePartyReady: () => void;
  onSelectLoadoutPair: (pairId: LoadoutPairId, weapons: [WeaponId, WeaponId]) => void;
  onSelectWeapon: (weaponId: WeaponId) => void;
  onStartMatch: () => void;
  onOpenSettingsModal: () => void;
  onOpenBackpack?: () => void;
  onClaimMission: (missionId: string) => void;
  onPurchaseCosmeticItem: (itemId: string, price: number, currency?: 'coins' | 'gems') => void;
  // Studio handlers
  onSetStudioInteractionMode: (mode: 'paint' | 'orbit') => void;
  onUpdateBrushSettings: (partial: Partial<BrushSettings>) => void;
  onSelectColor: (hex: string) => void;
  onSelectActiveLayer: (layerId: string) => void;
  onAddLayer: () => void;
  onDeleteLayer: (layerId: string) => void;
  onRenameLayer: (layerId: string, newName: string) => void;
  onToggleLayerVisible: (layerId: string) => void;
  onChangeLayerOpacity: (layerId: string, opacity: number) => void;
  onMoveLayerOrder: (layerId: string, dir: -1 | 1) => void;
  onDuplicateLayer: (layerId: string) => void;
  onMergeLayerDown: (layerId: string) => void;
  onUndoStudio: () => void;
  onRedoStudio: () => void;
  onClearActiveLayer: () => void;
  onClearRegionOnActiveLayer: (region: BodyRegionId) => void;
  onResetCharacterToWhite: () => void;
  onChangeDesignName: (name: string) => void;
  onSaveDesign: (saveAsNew: boolean) => void;
  onEquipCurrentStudioDesign: () => void;
  onLoadSavedDesignIntoStudio: (design: SavedPaintDesign) => void;
  onEquipSavedDesign: (design: SavedPaintDesign) => void;
  onDuplicateSavedDesign: (designId: string) => void;
  onRenameSavedDesign: (designId: string, newName: string) => void;
  onDeleteSavedDesign: (designId: string) => void;
}

const DEV_FRIENDS_ROSTER: {
  id: string;
  name: string;
  characterId: CharacterId;
  level: number;
  online: boolean;
  status: string;
  designTag: string;
}[] = [
  {
    id: 'friend_1',
    name: 'KAI_VORTEX',
    characterId: 'rift',
    level: 18,
    online: true,
    status: 'Online · In Lobby',
    designTag: 'Cobalt Splash',
  },
  {
    id: 'friend_2',
    name: 'NOVA_STRIKE',
    characterId: 'kestrel',
    level: 24,
    online: true,
    status: 'Online · Painting in Studio',
    designTag: 'Neon Violet',
  },
  {
    id: 'friend_3',
    name: 'ZERO_PULSE',
    characterId: 'chroma',
    level: 15,
    online: true,
    status: 'Online · Ready for Squad',
    designTag: 'Pure White Spec',
  },
  {
    id: 'friend_4',
    name: 'AXEL_99',
    characterId: 'volt',
    level: 31,
    online: false,
    status: 'Offline · Last seen 2h ago',
    designTag: 'Emerald Fang',
  },
  {
    id: 'friend_5',
    name: 'LYRA_SKY',
    characterId: 'kestrel',
    level: 21,
    online: true,
    status: 'Online · Sky Bastion',
    designTag: 'Solar Flare',
  },
];

/**
 * Renders a 64x64 2D UV preview thumbnail for any SavedPaintDesign.
 */
const DesignThumbnailCanvas: React.FC<{
  design: SavedPaintDesign;
  size?: number;
}> = ({ design, size = 64 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fullBuf = decodeRgbaBufferRLE(
      design.compositeRleBase64,
      PAINT_ATLAS_SIZE * PAINT_ATLAS_SIZE * 4
    );

    const offscreen = document.createElement('canvas');
    offscreen.width = PAINT_ATLAS_SIZE;
    offscreen.height = PAINT_ATLAS_SIZE;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;
    const imgData = offCtx.createImageData(PAINT_ATLAS_SIZE, PAINT_ATLAS_SIZE);
    imgData.data.set(fullBuf);
    offCtx.putImageData(imgData, 0, 0);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(offscreen, 0, 0, size, size);
  }, [design.compositeRleBase64, design.updatedAt, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded border border-slate-600/80 bg-slate-900 shrink-0"
    />
  );
};

/**
 * Custom SVG Portrait Thumbnail for the 4 Bottom Character Slots & Profile Avatar
 * matching the reference image's exact character thumbnails.
 */
const CharacterPortraitThumb: React.FC<{
  charId: CharacterId;
  variant?: 'lobby_slot' | 'avatar';
}> = ({ charId, variant = 'lobby_slot' }) => {
  if (charId === 'volt') {
    // 1st thumbnail: Faceless pure-white low-poly humanoid figure matching reference silhouette
    return (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="bgVolt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3a5f" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#bgVolt)" />
        {/* Low-Poly Sloped Shoulders & Torso */}
        <polygon points="14,64 18,43 27,39 37,39 46,43 50,64" fill="#f8fafc" />
        <polygon points="32,39 37,39 46,43 50,64 32,64" fill="#e2e8f0" />
        {/* Neck */}
        <rect x="28" y="33" width="8" height="8" rx="2" fill="#cbd5e1" />
        {/* Faceless Low-Poly White Head */}
        <polygon
          points="32,8 41,12 44,22 40,32 32,35 24,32 20,22 23,12"
          fill="#ffffff"
        />
        <polygon
          points="32,8 41,12 44,22 40,32 32,35"
          fill="#f1f5f9"
        />
      </svg>
    );
  }
  if (charId === 'rift') {
    // 2nd thumbnail: White & cyan tactical operator with horizontal visor
    return (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <rect width="64" height="64" fill="#17253b" />
        <path d="M10 64 C10 46 20 42 32 42 C44 42 54 46 54 64 Z" fill="#e2e8f0" />
        <path d="M14 50 L30 45 L26 62 L12 62 Z" fill="#0284c7" />
        <rect x="27" y="34" width="10" height="9" rx="3" fill="#94a3b8" />
        <ellipse cx="32" cy="23" rx="13.5" ry="14" fill="#f8fafc" />
        <rect x="21" y="18" width="22" height="6.5" rx="3" fill="#0ea5e9" />
      </svg>
    );
  }
  if (charId === 'kestrel') {
    // 3rd thumbnail: Purple/violet hooded stealth operator
    return (
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <rect width="64" height="64" fill="#231836" />
        <path d="M10 64 C10 46 20 42 32 42 C44 42 54 46 54 64 Z" fill="#ddd6fe" />
        <path d="M16 45 L48 45 L44 64 L20 64 Z" fill="#7c3aed" />
        <ellipse cx="32" cy="23" rx="14" ry="14.5" fill="#4c1d95" />
        <ellipse cx="32" cy="24" rx="10.5" ry="11" fill="#f5f3ff" />
        <path d="M23 21 L41 21 L38 26 L26 26 Z" fill="#a855f7" />
      </svg>
    );
  }
  // 4th thumbnail ('chroma'): Dark & gold heavy armored operator
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      <rect width="64" height="64" fill="#1f242d" />
      <path d="M8 64 C8 44 19 40 32 40 C45 40 56 44 56 64 Z" fill="#334155" />
      <path d="M18 43 L46 43 L42 64 L22 64 Z" fill="#eab308" />
      <ellipse cx="32" cy="23" rx="14" ry="14" fill="#1e293b" />
      <rect x="21" y="17" width="22" height="8" rx="2.5" fill="#facc15" />
    </svg>
  );
};

export const LobbyAndVaultUI: React.FC<LobbyAndVaultUIProps> = (props) => {
  const {
    activeTab,
    p1Char,
    unlockedChars,
    activeEquipment,
    characterPose,
    cameraFocusPreset,
    gameMode,
    arenaId,
    botDifficulty,
    partySize,
    partyMembers,
    selectedLoadoutPairId,
    loadoutWeapons,
    selectedWeapon,
    playerName = 'ShadowRider',
    onChangePlayerName,
    playerCredits,
    playerGems = 320,
    onAddCurrency,
    playerXp,
    playerLevel,
    cosmeticInventory,
    missions,
    settings,
    isFullscreen = false,
    onUpdateSettings,
    onToggleFullscreen,
    onOpenLayoutEditor,
    studioInteractionMode,
    brushSettings,
    recentColors,
    studioLayers,
    activeLayerId,
    canUndo,
    canRedo,
    currentDesignId,
    currentDesignName,
    equippedDesignId,
    savedDesigns,
    hoveredBodyRegion,
    statusToast,
    onSelectTab,
    onSelectCharacter,
    onUnlockCharacter,
    onToggleEquipmentSlot,
    onSelectPose,
    onSelectCameraPreset,
    onResetCamera,
    onZoomCamera,
    onSelectGameMode,
    onSelectArena,
    onSelectDifficulty,
    onSelectPartySize,
    onInviteFriendToParty,
    onRemovePartyMember,
    onTogglePartyReady,
    onSelectLoadoutPair,
    onSelectWeapon,
    onStartMatch,
    onClaimMission,
    onPurchaseCosmeticItem,
    onSetStudioInteractionMode,
    onUpdateBrushSettings,
    onSelectColor,
    onSelectActiveLayer,
    onAddLayer,
    onDeleteLayer,
    onRenameLayer,
    onToggleLayerVisible,
    onChangeLayerOpacity,
    onMoveLayerOrder,
    onDuplicateLayer,
    onMergeLayerDown,
    onUndoStudio,
    onRedoStudio,
    onClearActiveLayer,
    onClearRegionOnActiveLayer,
    onResetCharacterToWhite,
    onChangeDesignName,
    onSaveDesign,
    onEquipCurrentStudioDesign,
    onLoadSavedDesignIntoStudio,
    onEquipSavedDesign,
    onDuplicateSavedDesign,
    onRenameSavedDesign,
    onDeleteSavedDesign,
  } = props;

  // Local Interactive UI States
  const [seasonSlideIdx, setSeasonSlideIdx] = useState<number>(0);
  const [chatDrawerOpen, setChatDrawerOpen] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<
    { id: string; sender: string; text: string; time: string }[]
  >([
    {
      id: 'c1',
      sender: 'KAI_VORTEX',
      text: 'Yo ShadowRider! Sick blue & orange paint job on your rig!',
      time: '12:04',
    },
    {
      id: 'c2',
      sender: 'NOVA_STRIKE',
      text: 'Ready up for Squad Battle Royale when you are.',
      time: '12:05',
    },
  ]);

  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [currencyModalOpen, setCurrencyModalOpen] = useState<boolean>(false);

  // Vault Category Filter
  const [vaultFilter, setVaultFilter] = useState<
    'all' | 'paint_designs' | 'gear' | 'skins'
  >('all');
  const [renamingDesignId, setRenamingDesignId] = useState<string | null>(null);
  const [renameInputText, setRenameInputText] = useState<string>('');

  // Painting Studio Dirty / Unsaved Confirmation State
  const [studioHasUnsavedChanges, setStudioHasUnsavedChanges] =
    useState<boolean>(false);
  const [pendingLeaveTargetTab, setPendingLeaveTargetTab] =
    useState<LobbyTab | null>(null);
  const initialCanUndoRef = useRef<boolean>(canUndo);
  useEffect(() => {
    if (activeTab === 'painting_studio' && canUndo && !initialCanUndoRef.current) {
      setStudioHasUnsavedChanges(true);
    }
    initialCanUndoRef.current = canUndo;
  }, [canUndo, activeTab]);

  // Organized Studio UI States (Categorized Tabs & Collapsible Sections)
  const [studioToolTab, setStudioToolTab] = useState<
    'paint' | 'shade' | 'fill' | 'tools'
  >('paint');
  const [studioRightTab, setStudioRightTab] = useState<
    'colors' | 'layers' | 'save'
  >('colors');
  const [studioPaletteIdx, setStudioPaletteIdx] = useState<number>(0);
  const [studioShowTuning, setStudioShowTuning] = useState<boolean>(false);
  const [studioGearPopoverOpen, setStudioGearPopoverOpen] =
    useState<boolean>(false);
  const [studioPanelsHidden, setStudioPanelsHidden] = useState<boolean>(false);

  // Weapons Screen Category Filter
  const [weaponCategoryFilter, setWeaponCategoryFilter] = useState<
    'all' | 'assault' | 'smg' | 'shotgun' | 'sniper' | 'sidearm'
  >('all');

  // Missions Screen Category Filter
  const [missionTab, setMissionTab] = useState<'daily' | 'weekly' | 'season'>(
    'daily'
  );

  // Friends Screen Tab & Search
  const [friendsSubTab, setFriendsSubTab] = useState<
    'friends' | 'requests' | 'party'
  >('friends');
  const [friendSearchQuery, setFriendSearchQuery] = useState<string>('');
  const [friendRequests, setFriendRequests] = useState<
    { id: string; name: string; characterId: CharacterId; level: number }[]
  >([
    { id: 'req_1', name: 'BLAZE_FALCON', characterId: 'volt', level: 19 },
    { id: 'req_2', name: 'CYBER_WOLF', characterId: 'chroma', level: 27 },
  ]);

  // Shop Screen Category & Purchase Confirmation Modal
  const [shopCategory, setShopCategory] = useState<
    'featured' | 'cosmetics' | 'bundles' | 'currency'
  >('featured');
  const [pendingShopItem, setPendingShopItem] = useState<{
    id: string;
    name: string;
    description: string;
    price: number;
    currency: 'coins' | 'gems';
    rarity: string;
  } | null>(null);

  // Events Screen State
  const [claimedEventIds, setClaimedEventIds] = useState<string[]>([]);

  // Profile Screen Name Editing
  const [editingProfileName, setEditingProfileName] =
    useState<string>(playerName);
  useEffect(() => {
    setEditingProfileName(playerName);
  }, [playerName]);

  // Map Display Name for Bottom-Right Dock
  const [selectedMapModeLabel, setSelectedMapModeLabel] =
    useState<string>('Random');
  const [selectedGameModeDisplay, setSelectedGameModeDisplay] =
    useState<string>('Battle Royale');

  const activeCharSpec = CHARACTER_ROSTER[p1Char];
  const equippedDesign =
    savedDesigns.find((d) => d.id === equippedDesignId) || null;
  const maxPartySlots = PARTY_SIZE_LIMITS[partySize];

  const handleNavigateTab = (targetTab: LobbyTab) => {
    soundEngine.play('ui_click');
    if (
      activeTab === 'painting_studio' &&
      targetTab !== 'painting_studio' &&
      studioHasUnsavedChanges
    ) {
      setPendingLeaveTargetTab(targetTab);
      return;
    }
    onSelectTab(targetTab);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    soundEngine.play('ui_confirm');
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
    setChatMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}`,
        sender: playerName,
        text: trimmed,
        time: timeStr,
      },
    ]);
    setChatInput('');
  };

  // Left Sidebar Navigation Items (Dedicated screens for every lobby feature)
  const LEFT_NAV_ITEMS: {
    id: LobbyTab;
    label: string;
    hasRedDot?: boolean;
    renderIcon: (active: boolean) => React.ReactNode;
  }[] = [
    {
      id: 'home',
      label: 'Lobby',
      renderIcon: () => (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3L3 10.5h2.5V20h5v-5.5h3V20h5v-9.5H21L12 3z" />
        </svg>
      ),
    },
    {
      id: 'game_mode',
      label: 'Mode & Map',
      renderIcon: () => (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" />
        </svg>
      ),
    },
    {
      id: 'character',
      label: 'Character',
      renderIcon: () => (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12c2.48 0 4.5-2.02 4.5-4.5S14.48 3 12 3 7.5 5.02 7.5 7.5 9.52 12 12 12zm0 2.25c-3.01 0-9 1.51-9 4.5V21h18v-2.25c0-2.99-5.99-4.5-9-4.5z" />
        </svg>
      ),
    },
    {
      id: 'painting_studio',
      label: 'Paint Studio',
      renderIcon: () => (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
        </svg>
      ),
    },
    {
      id: 'vault',
      label: 'Skin Vault',
      renderIcon: () => (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 6h-3V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM9 4h6v2H9V4zm11 15H4v-6h4v1h8v-1h4v6z" />
        </svg>
      ),
    },
    {
      id: 'loadout',
      label: 'Loadout',
      renderIcon: () => (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 7h18v4h-4l-2 3h-3v5H7v-5H5V7zm4 2v2h10V9H7z" />
        </svg>
      ),
    },
    {
      id: 'weapons',
      label: 'Weapons',
      renderIcon: () => (
        <svg
          className="w-4 h-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.3"
        >
          <circle cx="12" cy="12" r="7.5" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: 'friends',
      label: 'Party & Squad',
      hasRedDot: friendRequests.length > 0,
      renderIcon: () => (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
        </svg>
      ),
    },
    {
      id: 'missions',
      label: 'Missions',
      hasRedDot: missions.some((m) => !m.claimed),
      renderIcon: () => (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
        </svg>
      ),
    },
    {
      id: 'events',
      label: 'Events',
      hasRedDot: claimedEventIds.length < 3,
      renderIcon: () => (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm-7-8l1.45 2.94 3.25.47-2.35 2.29.55 3.24L12 16.4l-2.9 1.54.55-3.24-2.35-2.29 3.25-.47L12 12z" />
        </svg>
      ),
    },
    {
      id: 'shop',
      label: 'Shop',
      renderIcon: () => (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0020 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      ),
    },
    {
      id: 'profile',
      label: 'Profile',
      renderIcon: () => (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
        </svg>
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      renderIcon: () => (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
        </svg>
      ),
    },
  ];

  const xpMax = 3000;
  const xpCurrent = Math.min(xpMax, playerXp);
  const xpPercent = Math.max(8, Math.min(100, Math.round((xpCurrent / xpMax) * 100)));

  return (
    <div className="fixed inset-0 pointer-events-none z-20 flex flex-col justify-between select-none font-sans overflow-hidden text-white">
      {/* ===================================================================== */}
      {/* TOP BAR (Exact Reference Profile Card on Left + Currencies & Icons on Right) */}
      {/* ===================================================================== */}
      {/* ===================================================================== */}
      {/* TOP BAR & LEFT SIDEBAR (Hidden when in Full-Screen 3D Paint Studio)   */}
      {/* ===================================================================== */}
      {activeTab !== 'painting_studio' && (
        <>
          <header
            data-ui-panel="true"
            className="pointer-events-auto flex items-start justify-between px-3.5 pt-2.5 pb-1 z-30"
          >
            {/* TOP-LEFT PLAYER PROFILE BOX (Clicking opens dedicated Profile Screen) */}
            <button
              type="button"
              onClick={() => handleNavigateTab('profile')}
              title="Open Player Profile"
              className="group relative flex items-center gap-2.5 bg-[#101826]/88 hover:bg-[#162236]/95 border border-[#2c4263]/85 rounded-md p-1.5 pr-3.5 shadow-[0_6px_20px_rgba(0,0,0,0.55)] transition-all text-left min-w-[238px]"
            >
              {/* Cyan-bordered Avatar Square */}
              <div className="relative w-11 h-11 rounded bg-[#0c1420] border-2 border-[#29c5f6] shadow-[0_0_10px_rgba(41,197,246,0.45)] overflow-hidden shrink-0">
                <CharacterPortraitThumb charId={p1Char} variant="avatar" />
              </div>

              <div className="flex flex-col flex-1 min-w-[162px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-bold tracking-tight text-white group-hover:text-[#38bdf8] transition-colors leading-tight">
                    {playerName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-300 mt-0.5 mb-1">
                  <span className="text-slate-300">Lv. {playerLevel}</span>
                  <span className="text-slate-200 font-mono">
                    {xpCurrent} / {xpMax} XP
                  </span>
                </div>
                {/* Glowing Cyan XP Progress Bar */}
                <div className="w-full h-1.5 bg-[#0a101d] rounded-full overflow-hidden border border-slate-700/70">
                  <div
                    className="h-full bg-gradient-to-r from-[#0ea5e9] to-[#38bdf8] shadow-[0_0_8px_#38bdf8]"
                    style={{ width: `${xpPercent}%` }}
                  />
                </div>
              </div>
            </button>

            {/* TOP-RIGHT CURRENCIES, NOTIFICATIONS, FRIENDS, SETTINGS & PING */}
            <div className="flex items-center gap-2.5 mt-0.5">
              {/* Gold Coins Pill (4,850) */}
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('ui_click');
                  setCurrencyModalOpen(true);
                }}
                className="flex items-center gap-2 bg-[#111927]/88 hover:bg-[#182436] border border-slate-600/80 rounded-full pl-2 pr-3.5 py-1 shadow-md transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-b from-[#fde047] via-[#eab308] to-[#b45309] border border-[#fef08a] flex items-center justify-center shadow-sm">
                  <span className="text-[11px] font-black text-[#451a03] leading-none">
                    S
                  </span>
                </div>
                <span className="text-[13px] font-bold text-white tracking-tight">
                  {playerCredits.toLocaleString()}
                </span>
              </button>

              {/* Purple Gems Pill (320 + '+' Button) */}
              <div className="flex items-center gap-2 bg-[#111927]/88 border border-slate-600/80 rounded-full pl-2 pr-1.5 py-1 shadow-md">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <polygon
                    points="12,2 21,9 17,21 7,21 3,9"
                    fill="#c084fc"
                    stroke="#f3e8ff"
                    strokeWidth="1.3"
                  />
                  <polygon points="12,2 17,9 12,21 7,9" fill="#9333ea" />
                </svg>
                <span className="text-[13px] font-bold text-white tracking-tight">
                  {playerGems.toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('ui_click');
                    setCurrencyModalOpen(true);
                  }}
                  title="Top Up Currency"
                  className="w-5 h-5 rounded-full bg-[#2a3950] hover:bg-[#38bdf8] hover:text-slate-950 text-slate-200 flex items-center justify-center text-xs font-black transition-colors ml-0.5"
                >
                  +
                </button>
              </div>

              {/* Notification Bell Icon with Red Badge '3' */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('ui_click');
                    setNotificationsOpen((prev) => !prev);
                  }}
                  title="Notifications"
                  className="w-8 h-8 rounded-full bg-[#111927]/82 hover:bg-[#1e293b] border border-slate-600/70 flex items-center justify-center text-slate-200 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                  </svg>
                </button>
                <span className="pointer-events-none absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ef4444] border border-slate-950 text-[9px] font-extrabold text-white flex items-center justify-center">
                  3
                </span>
              </div>

              {/* Friends Silhouette Icon */}
              <button
                type="button"
                onClick={() => handleNavigateTab('friends')}
                title="Friends & Squad"
                className="w-8 h-8 rounded-full bg-[#111927]/82 hover:bg-[#1e293b] border border-slate-600/70 flex items-center justify-center text-slate-200 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
              </button>

              {/* Settings Gear Icon */}
              <button
                type="button"
                onClick={() => handleNavigateTab('settings')}
                title="Settings"
                className="w-8 h-8 rounded-full bg-[#111927]/82 hover:bg-[#1e293b] border border-slate-600/70 flex items-center justify-center text-slate-200 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                </svg>
              </button>

              {/* Green Wi-Fi Signal + 52ms Ping Indicator */}
              <div className="flex flex-col items-center justify-center px-1 text-[#4ade80]">
                <svg className="w-4 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
                </svg>
                <span className="text-[9px] font-bold leading-none mt-0.5">52ms</span>
              </div>
            </div>
          </header>

          <aside
            data-ui-panel="true"
            className="pointer-events-auto fixed left-3.5 top-[72px] bottom-3.5 w-[148px] bg-[#0e1624]/88 backdrop-blur-md border border-slate-600/65 rounded-md overflow-y-auto no-scrollbar shadow-[0_10px_28px_rgba(0,0,0,0.55)] z-30"
          >
            <nav className="flex flex-col divide-y divide-slate-700/45">
              {LEFT_NAV_ITEMS.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigateTab(item.id)}
                    className={`relative flex items-center justify-between px-3 py-[7.5px] text-left transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-[#0ea5e9]/90 via-[#0284c7]/75 to-[#1e3a8a]/50 text-white font-bold shadow-[inset_3px_0_0_#38bdf8]'
                        : 'text-slate-200 hover:bg-slate-800/75 hover:text-white font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={isActive ? 'text-white' : 'text-slate-300'}>
                        {item.renderIcon(isActive)}
                      </span>
                      <span className="text-[12px] tracking-tight leading-none whitespace-nowrap">
                        {item.label}
                      </span>
                    </div>

                    {isActive && (
                      <svg
                        className="w-3 h-3 text-cyan-200 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    )}

                    {item.hasRedDot && !isActive && (
                      <span className="w-2 h-2 rounded-full bg-[#ef4444] shadow-[0_0_6px_#ef4444] shrink-0" />
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>
        </>
      )}

      {/* ===================================================================== */}
      {/* SCREEN A: UNCLUTTERED MAIN LOBBY (3D Character Centerpiece + Launch)  */}
      {/* All options live in dedicated screens via the Left Sidebar!           */}
      {/* ===================================================================== */}
      {activeTab === 'home' && (
        <>
          {/* 1. COMPACT FLOATING CHARACTER NAMEPLATE ABOVE 3D CHARACTER */}
          <div
            data-ui-panel="true"
            className="pointer-events-auto fixed top-[54px] left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#0f1726]/85 backdrop-blur-md border border-slate-500/60 rounded-full px-3.5 py-1 shadow-[0_6px_18px_rgba(0,0,0,0.45)] whitespace-nowrap"
          >
            <span className="text-xs font-extrabold text-[#38bdf8] tracking-wide">
              {activeCharSpec.name}
            </span>
            <span className="text-slate-500">·</span>
            <span className="text-xs font-bold text-white">
              {playerName}
            </span>
            <span className="text-[11px] font-semibold text-slate-300 pl-1 border-l border-slate-600/70">
              Lv. {playerLevel}
            </span>
          </div>

          {/* 2. BOTTOM-CENTER LIVE ANIMATION & POSE PREVIEW BAR */}
          <div
            data-ui-panel="true"
            className="pointer-events-auto fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-[#0b1322]/90 backdrop-blur-md border border-slate-600/75 rounded-full px-2.5 py-1 shadow-xl"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1.5 hidden sm:inline">
              Animation:
            </span>
            {(
              [
                ['idle', 'Idle'],
                ['walk', 'Walk'],
                ['run', 'Sprint'],
                ['inspect', 'Inspect'],
                ['salute', 'Salute'],
                ['victory', 'Victory'],
              ] as [CharacterPoseId, string][]
            ).map(([poseId, label]) => {
              const active = characterPose === poseId;
              return (
                <button
                  key={poseId}
                  type="button"
                  onClick={() => {
                    soundEngine.play('ui_click');
                    onSelectPose(poseId);
                  }}
                  className={`h-6 px-2.5 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${
                    active
                      ? 'bg-[#29c5f6] text-slate-950 font-bold shadow-[0_0_8px_rgba(41,197,246,0.5)]'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* 3. COMPACT BOTTOM-RIGHT MATCH SUMMARY & PLAY DOCK */}
          <aside
            data-ui-panel="true"
            className="pointer-events-auto fixed right-3.5 bottom-3.5 w-[212px] sm:w-[236px] flex flex-col gap-2 z-20"
          >
            {/* Compact Mode & Map Button -> Opens dedicated 'game_mode' screen */}
            <button
              type="button"
              onClick={() => handleNavigateTab('game_mode')}
              className="group w-full rounded-lg bg-[#0f1726]/90 hover:bg-[#162236] backdrop-blur-md border border-slate-500/75 hover:border-[#38bdf8] px-3 py-2 shadow-lg text-left flex items-center justify-between transition-all"
            >
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#38bdf8]">
                  {selectedGameModeDisplay} · {partySize.toUpperCase()}
                </div>
                <div className="text-xs font-bold text-white truncate mt-0.5">
                  Map: {selectedMapModeLabel}
                </div>
              </div>
              <span className="text-[10px] font-semibold text-slate-300 group-hover:text-white bg-slate-800/90 px-2 py-1 rounded border border-slate-600/80 shrink-0">
                Change &gt;
              </span>
            </button>

            {/* Primary Golden PLAY Button */}
            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui_confirm');
                onStartMatch();
              }}
              className="w-full h-[46px] rounded-lg bg-gradient-to-b from-[#fde047] via-[#facc15] to-[#ca8a04] hover:from-[#fef08a] hover:to-[#eab308] active:scale-[0.99] border-2 border-[#fef08a] shadow-[0_6px_20px_rgba(234,179,8,0.45)] flex items-center justify-center gap-2 text-slate-950 font-black text-[19px] tracking-wide transition-all cursor-pointer"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <polygon points="6,4 20,12 6,20" />
              </svg>
              <span>PLAY</span>
            </button>
          </aside>
        </>
      )}

      {/* ===================================================================== */}
      {/* SCREEN B: DEDICATED CHARACTER SCREEN ('character')                    */}
      {/* ===================================================================== */}
      {activeTab === 'character' && (
        <div
          data-ui-panel="true"
          className="pointer-events-auto fixed left-3 md:left-[164px] right-3.5 top-[62px] bottom-3.5 flex flex-col md:flex-row items-start justify-between gap-3 z-20 overflow-y-auto md:overflow-visible"
        >
          {/* Left Compact Character Roster & Poses Card */}
          <div className="w-full md:w-[244px] lg:w-[264px] bg-[#0c1422]/92 backdrop-blur-md border border-slate-700/75 rounded-lg p-3 flex flex-col gap-3 shadow-xl self-start max-h-full overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
              <h2 className="text-sm font-bold tracking-tight text-white whitespace-nowrap">
                Characters
              </h2>
              <button
                type="button"
                onClick={() => handleNavigateTab('home')}
                className="px-2 py-1 rounded bg-slate-800/90 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-600/80 whitespace-nowrap"
              >
                ← Lobby
              </button>
            </div>

            <div className="space-y-1.5">
              {CHARACTER_ORDER.map((cid) => {
                const spec = CHARACTER_ROSTER[cid];
                const selected = p1Char === cid;
                const unlocked = unlockedChars.includes(cid);
                return (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => {
                      soundEngine.play('ui_click');
                      onSelectCharacter(cid);
                    }}
                    className={`w-full rounded-md p-2 border transition-all flex items-center gap-2.5 text-left ${
                      selected
                        ? 'bg-[#152742] border-[#29c5f6] shadow-[0_0_10px_rgba(41,197,246,0.25)]'
                        : 'bg-[#111b2b]/90 border-slate-700/70 hover:border-slate-500'
                    }`}
                  >
                    <div className="w-10 h-10 rounded overflow-hidden border border-slate-600 shrink-0">
                      <CharacterPortraitThumb charId={cid} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-white truncate">
                          {spec.name}
                        </span>
                        <span className="text-[10px] font-semibold text-sky-300 shrink-0">
                          {selected ? 'Active' : unlocked ? 'Ready' : '1200 CR'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {spec.role} · {spec.proportions.heightScale}x
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Compact Pose & Locomotion Animation Switcher */}
            <div className="pt-2 border-t border-slate-700/60">
              <div className="text-[11px] font-semibold text-slate-300 mb-1.5">
                Animation Preview
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    ['idle', 'Idle'],
                    ['walk', 'Walk'],
                    ['run', 'Sprint'],
                    ['inspect', 'Inspect'],
                    ['salute', 'Salute'],
                    ['victory', 'Victory'],
                  ] as [CharacterPoseId, string][]
                ).map(([poseId, label]) => (
                  <button
                    key={poseId}
                    type="button"
                    onClick={() => onSelectPose(poseId)}
                    className={`py-1 px-2 rounded text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                      characterPose === poseId
                        ? 'bg-[#29c5f6] text-slate-950 border-[#38bdf8] font-bold'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Compact Character Details & Quick Actions Card */}
          <div className="w-full md:w-[248px] lg:w-[268px] bg-[#0c1422]/92 backdrop-blur-md border border-slate-700/75 rounded-lg p-3 flex flex-col gap-3 shadow-xl self-start">
            <div>
              <div className="text-[11px] font-semibold text-[#38bdf8]">
                {activeCharSpec.codename}
              </div>
              <h3 className="text-lg font-extrabold text-white tracking-tight">
                {activeCharSpec.name}
              </h3>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                {activeCharSpec.description}
              </p>
            </div>

            {/* Equipped Skin Summary */}
            <div className="bg-[#131f33] border border-slate-700/80 rounded-md p-2.5">
              <div className="text-[10px] font-semibold text-slate-400 mb-1.5">
                Equipped Skin
              </div>
              {equippedDesign ? (
                <div className="flex items-center gap-2.5">
                  <DesignThumbnailCanvas design={equippedDesign} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">
                      {equippedDesign.name}
                    </div>
                    <div className="text-[10px] text-emerald-400">
                      Equipped
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-300">
                  Default White Base
                </div>
              )}

              <div className="grid grid-cols-2 gap-1.5 mt-2.5">
                <button
                  type="button"
                  onClick={() => handleNavigateTab('painting_studio')}
                  className="py-1.5 px-2 rounded bg-[#29c5f6] hover:bg-[#38bdf8] text-slate-950 font-bold text-[11px] transition-colors whitespace-nowrap"
                >
                  Open Studio
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigateTab('vault')}
                  className="py-1.5 px-2 rounded bg-slate-800 hover:bg-slate-700 text-white font-semibold text-[11px] border border-slate-600 transition-colors whitespace-nowrap"
                >
                  Open Vault
                </button>
              </div>
            </div>

            {/* Compact Armor Attachments */}
            <div>
              <div className="text-[11px] font-semibold text-slate-300 mb-1.5">
                Armor Modules
              </div>
              <div className="grid grid-cols-2 gap-1">
                {(
                  [
                    ['headgear', 'Ear Pods'],
                    ['backgear', 'Backpack'],
                    ['shoulders', 'Pauldrons'],
                    ['chestRig', 'Harness'],
                  ] as [EquipmentSlotId, string][]
                ).map(([slot, label]) => {
                  const on = activeEquipment.includes(slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => onToggleEquipmentSlot(slot)}
                      className={`py-1 px-2 rounded text-[11px] font-semibold border text-left flex items-center justify-between whitespace-nowrap ${
                        on
                          ? 'bg-sky-500/20 border-sky-400/70 text-white'
                          : 'bg-slate-800/70 border-slate-700 text-slate-400'
                      }`}
                    >
                      <span>{label}</span>
                      <span className="text-[9px]">{on ? 'ON' : 'OFF'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleNavigateTab('home')}
              className="w-full py-2 rounded-md bg-gradient-to-b from-[#fde047] to-[#eab308] text-slate-950 font-extrabold text-xs tracking-wide shadow-md whitespace-nowrap"
            >
              Confirm Character
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN C: DEDICATED VAULT SCREEN ('vault')                            */}
      {/* ===================================================================== */}
      {activeTab === 'vault' && (
        <div
          data-ui-panel="true"
          className="pointer-events-auto fixed left-3 md:left-[164px] right-3.5 top-[62px] bottom-3.5 flex flex-col md:flex-row items-start justify-between gap-3 z-20"
        >
          {/* Left Compact Vault Drawer */}
          <div className="w-full md:w-[320px] lg:w-[356px] max-h-full bg-[#0c1422]/94 backdrop-blur-md border border-slate-700/75 rounded-lg p-3 flex flex-col shadow-xl overflow-hidden">
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-700/60">
              <h2 className="text-sm font-bold text-white whitespace-nowrap">
                Vault & Custom Skins
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleNavigateTab('painting_studio')}
                  className="px-2.5 py-1 rounded bg-[#29c5f6] hover:bg-[#38bdf8] text-slate-950 text-[11px] font-bold transition-colors whitespace-nowrap"
                >
                  + Paint Studio
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigateTab('home')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-600 whitespace-nowrap"
                >
                  ← Lobby
                </button>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="grid grid-cols-4 gap-1 mb-2.5 bg-slate-900/90 p-1 rounded-md border border-slate-700/70">
              {(
                [
                  ['all', 'All'],
                  ['paint_designs', 'Skins'],
                  ['gear', 'Armor'],
                  ['skins', 'Presets'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setVaultFilter(id)}
                  className={`py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    vaultFilter === id
                      ? 'bg-[#29c5f6] text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Scrollable Vault Items List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[calc(100vh-190px)]">
              {(vaultFilter === 'all' || vaultFilter === 'paint_designs') && (
                <>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                    <span>Saved Skins ({savedDesigns.length})</span>
                    <button
                      type="button"
                      onClick={onResetCharacterToWhite}
                      className="text-[11px] text-sky-400 hover:underline whitespace-nowrap"
                    >
                      Reset to White
                    </button>
                  </div>
                  {savedDesigns.map((design) => {
                    const isEquipped = equippedDesignId === design.id;
                    return (
                      <div
                        key={design.id}
                        className={`rounded-md p-2 border flex items-center gap-2.5 ${
                          isEquipped
                            ? 'bg-[#152742] border-[#29c5f6]'
                            : 'bg-[#111b2b] border-slate-700/80'
                        }`}
                      >
                        <DesignThumbnailCanvas design={design} size={44} />
                        <div className="flex-1 min-w-0">
                          {renamingDesignId === design.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={renameInputText}
                                onChange={(e) => setRenameInputText(e.target.value)}
                                className="bg-slate-900 border border-sky-400 rounded px-1.5 py-0.5 text-[11px] text-white w-28"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  onRenameSavedDesign(design.id, renameInputText);
                                  setRenamingDesignId(null);
                                }}
                                className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-bold"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div className="text-xs font-bold text-white truncate">
                              {design.name}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            <button
                              type="button"
                              onClick={() => onEquipSavedDesign(design)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                                isEquipped
                                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50'
                                  : 'bg-[#29c5f6] text-slate-950'
                              }`}
                            >
                              {isEquipped ? 'Equipped' : 'Equip'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onLoadSavedDesignIntoStudio(design);
                                onSelectTab('painting_studio');
                              }}
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold border border-slate-600 whitespace-nowrap"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDuplicateSavedDesign(design.id)}
                              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700 whitespace-nowrap"
                            >
                              Clone
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingDesignId(design.id);
                                setRenameInputText(design.name);
                              }}
                              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700 whitespace-nowrap"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteSavedDesign(design.id)}
                              className="px-1.5 py-0.5 rounded bg-rose-950/70 hover:bg-rose-900 text-rose-300 text-[10px] border border-rose-700/50 whitespace-nowrap"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {(vaultFilter === 'all' ||
                vaultFilter === 'gear' ||
                vaultFilter === 'skins') && (
                <>
                  <div className="text-[11px] font-semibold text-slate-300 pt-1">
                    Armor & Finish Modules
                  </div>
                  {cosmeticInventory.map((item) => {
                    const isEquipped =
                      item.equipmentSlot &&
                      activeEquipment.includes(item.equipmentSlot);
                    return (
                      <div
                        key={item.id}
                        className="rounded-md p-2 bg-[#111b2b] border border-slate-700/80 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-8 h-8 rounded border border-slate-500 flex items-center justify-center font-bold text-[10px] shrink-0"
                            style={{ backgroundColor: item.previewHex }}
                          >
                            3D
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {item.name}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {item.description}
                            </div>
                          </div>
                        </div>
                        {item.owned ? (
                          item.equipmentSlot ? (
                            <button
                              type="button"
                              onClick={() =>
                                onToggleEquipmentSlot(item.equipmentSlot!)
                              }
                              className={`px-2.5 py-1 rounded text-[11px] font-bold shrink-0 whitespace-nowrap ${
                                isEquipped
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-slate-800 text-white border border-slate-600'
                              }`}
                            >
                              {isEquipped ? 'Equipped' : 'Equip'}
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-emerald-400 shrink-0">
                              Owned
                            </span>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleNavigateTab('shop')}
                            className="px-2.5 py-1 rounded bg-amber-400 text-slate-950 text-[11px] font-bold shrink-0 whitespace-nowrap"
                          >
                            Shop
                          </button>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* Right Compact Camera & Studio Launch Card */}
          <div className="w-full md:w-[216px] bg-[#0c1422]/92 backdrop-blur-md border border-slate-700/75 rounded-lg p-3 flex flex-col gap-2.5 shadow-xl self-end">
            <div className="text-xs font-bold text-white">
              Camera Angle
            </div>
            <div className="grid grid-cols-2 gap-1">
              {(
                [
                  ['full', 'Full Body'],
                  ['head', 'Head'],
                  ['upper', 'Torso'],
                  ['back', 'Back'],
                ] as [CameraFocusPreset, string][]
              ).map(([preset, label]) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onSelectCameraPreset(preset)}
                  className={`py-1 rounded text-[11px] font-semibold border whitespace-nowrap ${
                    cameraFocusPreset === preset
                      ? 'bg-[#29c5f6] text-slate-950 border-[#38bdf8] font-bold'
                      : 'bg-slate-800/80 text-slate-200 border-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => handleNavigateTab('painting_studio')}
              className="w-full py-2 rounded-md bg-gradient-to-b from-[#29c5f6] to-[#0284c7] text-slate-950 font-extrabold text-xs tracking-wide shadow-md whitespace-nowrap"
            >
              Open 3D Paint Studio
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN D: ORGANIZED, COMPACT FULL-SCREEN 3D PAINT & SHADING STUDIO    */}
      {/* Sleek floating docks (self-start), categorized tabs, clear center 3D  */}
      {/* ===================================================================== */}
      {activeTab === 'painting_studio' && (
        <div className="fixed inset-0 pointer-events-none z-30 flex flex-col justify-between p-2 sm:p-2.5 select-none">
          {/* 1. COMPACT SINGLE-LINE TOP TOOLBAR */}
          <header
            data-ui-panel="true"
            className="pointer-events-auto flex items-center justify-between gap-2 bg-[#0b1322]/92 backdrop-blur-md border border-slate-700/80 rounded-lg px-2.5 py-1.5 shadow-lg overflow-x-auto no-scrollbar"
          >
            {/* Left: Navigation + Title + Compact Character Selector */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleNavigateTab('home')}
                className="h-7 px-2.5 rounded bg-slate-800/90 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-600/80 transition-colors whitespace-nowrap shrink-0"
              >
                ← Lobby
              </button>
              <button
                type="button"
                onClick={() => handleNavigateTab('vault')}
                className="h-7 px-2.5 rounded bg-slate-800/75 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                Vault
              </button>
              <div className="h-4 w-px bg-slate-700/80 mx-0.5 hidden sm:block" />
              <span className="text-xs font-bold tracking-tight text-white whitespace-nowrap hidden sm:inline">
                3D Studio
              </span>
              {/* Compact Character Pills */}
              <div className="flex items-center gap-0.5 bg-slate-900/90 p-0.5 rounded border border-slate-700/80 ml-1">
                {CHARACTER_ORDER.map((cid) => {
                  const spec = CHARACTER_ROSTER[cid];
                  const active = p1Char === cid;
                  const shortLabel = spec.name.split('-')[0];
                  return (
                    <button
                      key={cid}
                      type="button"
                      onClick={() => onSelectCharacter(cid)}
                      title={spec.name}
                      className={`h-6 px-2 rounded text-[10px] font-bold transition-all whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[#29c5f6] text-slate-950'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Center: Mode Switch + Undo/Redo + Symmetry */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center bg-slate-900/95 p-0.5 rounded border border-slate-700/80">
                <button
                  type="button"
                  onClick={() => onSetStudioInteractionMode('paint')}
                  className={`h-6 px-2.5 rounded text-[11px] font-bold transition-all whitespace-nowrap shrink-0 ${
                    studioInteractionMode === 'paint'
                      ? 'bg-[#29c5f6] text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Paint 3D
                </button>
                <button
                  type="button"
                  onClick={() => onSetStudioInteractionMode('orbit')}
                  className={`h-6 px-2.5 rounded text-[11px] font-bold transition-all whitespace-nowrap shrink-0 ${
                    studioInteractionMode === 'orbit'
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  360° Rotate
                </button>
              </div>

              <button
                type="button"
                disabled={!canUndo}
                onClick={onUndoStudio}
                title="Undo Stroke"
                className="h-7 px-2.5 rounded bg-slate-800/90 hover:bg-slate-700 disabled:opacity-35 text-[11px] font-semibold border border-slate-600/80 whitespace-nowrap shrink-0"
              >
                Undo
              </button>
              <button
                type="button"
                disabled={!canRedo}
                onClick={onRedoStudio}
                title="Redo Stroke"
                className="h-7 px-2.5 rounded bg-slate-800/90 hover:bg-slate-700 disabled:opacity-35 text-[11px] font-semibold border border-slate-600/80 whitespace-nowrap shrink-0"
              >
                Redo
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateBrushSettings({ symmetry: !brushSettings.symmetry })
                }
                className={`h-7 px-2 rounded text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                  brushSettings.symmetry
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/60'
                    : 'bg-slate-800/90 text-slate-300 border-slate-600/80'
                }`}
              >
                Mirror X {brushSettings.symmetry ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Right: Hide Panels + Reset + Save & Equip */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setStudioPanelsHidden((prev) => !prev)}
                className="h-7 px-2 rounded bg-slate-800/80 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 border border-slate-700 whitespace-nowrap shrink-0"
              >
                {studioPanelsHidden ? 'Show Tools' : 'Hide Tools'}
              </button>
              <button
                type="button"
                onClick={onResetCharacterToWhite}
                className="h-7 px-2 rounded bg-rose-950/75 hover:bg-rose-900 text-[11px] font-semibold text-rose-200 border border-rose-700/50 whitespace-nowrap shrink-0"
              >
                Reset White
              </button>
              <button
                type="button"
                onClick={() => {
                  onEquipCurrentStudioDesign();
                  setStudioHasUnsavedChanges(false);
                }}
                className="h-7 px-3 rounded bg-gradient-to-b from-[#fde047] to-[#eab308] hover:from-[#fef08a] hover:to-[#facc15] text-slate-950 font-extrabold text-[11px] tracking-wide shadow-sm whitespace-nowrap shrink-0"
              >
                Save & Equip Skin
              </button>
            </div>
          </header>

          {/* 2. MIDDLE WORKSPACE: COMPACT LEFT TOOL DOCK | WIDE OPEN 3D VIEWPORT | COMPACT RIGHT COLOR DOCK */}
          {!studioPanelsHidden ? (
            <div className="flex-1 flex items-start justify-between min-h-0 mt-2 gap-2 pointer-events-none">
              {/* =============================================================== */}
              {/* LEFT FLOATING DOCK: CATEGORIZED BRUSH TABS & COMPACT SLIDERS    */}
              {/* =============================================================== */}
              <aside
                data-ui-panel="true"
                className="pointer-events-auto w-[204px] sm:w-[218px] bg-[#0b1322]/92 backdrop-blur-md border border-slate-700/80 rounded-lg p-2.5 flex flex-col gap-2.5 shadow-xl self-start max-h-[calc(100vh-116px)] overflow-y-auto"
              >
                {/* 4 Clean Category Tabs (Brushes | Shading | Stencils | Tools) */}
                <div className="grid grid-cols-4 gap-0.5 bg-slate-950/90 p-0.5 rounded-md border border-slate-800">
                  {(
                    [
                      ['paint', 'Brushes'],
                      ['shade', 'Shading'],
                      ['fill', 'Stencils'],
                      ['tools', 'Tools'],
                    ] as const
                  ).map(([tabKey, tabLabel]) => {
                    const isTabActive = studioToolTab === tabKey;
                    return (
                      <button
                        key={tabKey}
                        type="button"
                        onClick={() => setStudioToolTab(tabKey)}
                        className={`py-1 rounded text-[10px] font-bold transition-colors whitespace-nowrap ${
                          isTabActive
                            ? 'bg-[#29c5f6] text-slate-950 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {tabLabel}
                      </button>
                    );
                  })}
                </div>

                {/* Active Category Tool Grid (Compact Single-Line Buttons) */}
                <div className="grid grid-cols-2 gap-1">
                  {(studioToolTab === 'paint'
                    ? ([
                        ['brush', 'Hard Round', '●'],
                        ['soft_airbrush', 'Soft Airbrush', '○'],
                        ['marker_pen', 'Fine Liner', '/'],
                        ['paint_splatter', 'Paint Splatter', '*'],
                      ] as [PaintToolId, string, string][])
                    : studioToolTab === 'shade'
                    ? ([
                        ['shade_burn', 'Shadow / Burn', '-'],
                        ['highlight_dodge', 'Highlight / Dodge', '+'],
                        ['soft_blend', 'Smooth Blend', '≈'],
                        ['edge_wear', 'Seam / Edge AO', '#'],
                      ] as [PaintToolId, string, string][])
                    : studioToolTab === 'fill'
                    ? ([
                        ['bucket', 'Region Fill', '■'],
                        ['gradient_fill', '3D Shade Fill', '▲'],
                        ['stripe_stamp', 'Stripe Stamp', '≡'],
                        ['camo_stamp', 'Hex Camo', '◆'],
                        ['rect', 'Box Plate', '▪'],
                        ['circle', 'Ring Emblem', '●'],
                      ] as [PaintToolId, string, string][])
                    : ([
                        ['line', 'Line Stroke', '/'],
                        ['eraser', 'White Eraser', '×'],
                        ['eyedropper', 'Color Picker', '+'],
                      ] as [PaintToolId, string, string][])
                  ).map(([tid, label, iconGlyph]) => {
                    const active = brushSettings.tool === tid;
                    return (
                      <button
                        key={tid}
                        type="button"
                        onClick={() => {
                          onSetStudioInteractionMode('paint');
                          onUpdateBrushSettings({ tool: tid });
                        }}
                        className={`h-8 px-2 rounded-md border flex items-center gap-1.5 text-left transition-all whitespace-nowrap overflow-hidden ${
                          active
                            ? 'bg-[#162d4c] border-[#29c5f6] text-white shadow-[inset_0_0_0_1px_#29c5f6]'
                            : 'bg-slate-900/85 border-slate-700/75 text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <span
                          className={`text-xs font-bold leading-none shrink-0 ${
                            active ? 'text-[#38bdf8]' : 'text-slate-400'
                          }`}
                        >
                          {iconGlyph}
                        </span>
                        <span className="text-[11px] font-semibold truncate">
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Primary Sliders: Size & Opacity */}
                <div className="bg-slate-900/75 p-2 rounded-md border border-slate-800 space-y-1.5">
                  <div>
                    <div className="flex justify-between text-[10px] font-semibold text-slate-300">
                      <span>Brush Size</span>
                      <span className="font-mono text-sky-300 tabular-nums">
                        {brushSettings.size}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={64}
                      value={brushSettings.size}
                      onChange={(e) =>
                        onUpdateBrushSettings({ size: Number(e.target.value) })
                      }
                      className="w-full accent-[#29c5f6] h-1"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-semibold text-slate-300">
                      <span>Opacity</span>
                      <span className="font-mono text-sky-300 tabular-nums">
                        {Math.round(brushSettings.opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      value={Math.round(brushSettings.opacity * 100)}
                      onChange={(e) =>
                        onUpdateBrushSettings({
                          opacity: Number(e.target.value) / 100,
                        })
                      }
                      className="w-full accent-[#29c5f6] h-1"
                    />
                  </div>
                </div>

                {/* Collapsible Advanced Tuning & Body Part Mask */}
                <div>
                  <button
                    type="button"
                    onClick={() => setStudioShowTuning((prev) => !prev)}
                    className="w-full py-1 px-2 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-700/70 flex items-center justify-between text-[10px] font-semibold text-slate-300 whitespace-nowrap"
                  >
                    <span>Fine Tuning & Part Mask</span>
                    <span>{studioShowTuning ? '^' : 'v'}</span>
                  </button>

                  {studioShowTuning && (
                    <div className="mt-1.5 bg-slate-900/85 p-2 rounded-md border border-slate-800 space-y-2">
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-300">
                            <span>Hardness</span>
                            <span className="font-mono tabular-nums">
                              {Math.round(brushSettings.hardness * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={99}
                            value={Math.round(brushSettings.hardness * 100)}
                            onChange={(e) =>
                              onUpdateBrushSettings({
                                hardness: Number(e.target.value) / 100,
                              })
                            }
                            className="w-full accent-[#29c5f6] h-1"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-300">
                            <span>Flow</span>
                            <span className="font-mono tabular-nums">
                              {Math.round(brushSettings.flow * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={10}
                            max={100}
                            value={Math.round(brushSettings.flow * 100)}
                            onChange={(e) =>
                              onUpdateBrushSettings({
                                flow: Number(e.target.value) / 100,
                              })
                            }
                            className="w-full accent-[#29c5f6] h-1"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-semibold text-slate-300">
                            Body Part Mask
                          </span>
                          {brushSettings.isolatedRegion !== 'all' && (
                            <button
                              type="button"
                              onClick={() =>
                                onClearRegionOnActiveLayer(
                                  brushSettings.isolatedRegion as BodyRegionId
                                )
                              }
                              className="text-[10px] text-rose-300 hover:underline"
                            >
                              Clear Part
                            </button>
                          )}
                        </div>
                        <select
                          value={brushSettings.isolatedRegion}
                          onChange={(e) =>
                            onUpdateBrushSettings({
                              isolatedRegion: e.target.value as
                                | BodyRegionId
                                | 'all',
                            })
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-white font-medium"
                        >
                          <option value="all">All Body Parts</option>
                          {BODY_REGION_ORDER.map((reg) => (
                            <option key={reg} value={reg}>
                              {BODY_REGION_SPECS[reg].label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </aside>

              {/* =============================================================== */}
              {/* RIGHT FLOATING DOCK: TABBED COLORS, SHADING TONES, LAYERS, SAVE */}
              {/* =============================================================== */}
              <aside
                data-ui-panel="true"
                className="pointer-events-auto w-[212px] sm:w-[226px] bg-[#0b1322]/92 backdrop-blur-md border border-slate-700/80 rounded-lg p-2.5 flex flex-col gap-2.5 shadow-xl self-start max-h-[calc(100vh-116px)] overflow-y-auto"
              >
                {/* Active Color + Auto 5-Step 3D Shading Strip */}
                <div className="bg-slate-900/85 p-2 rounded-md border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-300">
                      Active Color & Shades
                    </span>
                    <label className="flex items-center gap-1 cursor-pointer bg-slate-950 px-1.5 py-0.5 rounded border border-slate-700">
                      <input
                        type="color"
                        value={brushSettings.colorHex}
                        onChange={(e) => onSelectColor(e.target.value)}
                        title="Custom Color"
                        className="w-3.5 h-3.5 rounded cursor-pointer border-0 bg-transparent"
                      />
                      <span className="text-[10px] font-mono text-slate-200">
                        {brushSettings.colorHex.toUpperCase()}
                      </span>
                    </label>
                  </div>

                  {/* 5 Auto Shading Tones Row */}
                  <div className="grid grid-cols-5 gap-1">
                    {generateShadingTonesForHex(brushSettings.colorHex).map(
                      (step) => {
                        const isSelected =
                          brushSettings.colorHex.toLowerCase() ===
                          step.hex.toLowerCase();
                        return (
                          <button
                            key={step.id}
                            type="button"
                            onClick={() => onSelectColor(step.hex)}
                            title={`${step.label} (${step.hex})`}
                            className={`flex flex-col items-center rounded p-0.5 border transition-all ${
                              isSelected
                                ? 'border-white bg-slate-800 ring-1 ring-[#29c5f6]'
                                : 'border-slate-700/70 bg-slate-950/60 hover:border-slate-500'
                            }`}
                          >
                            <span
                              style={{ backgroundColor: step.hex }}
                              className="w-full h-3.5 rounded-sm border border-black/30"
                            />
                            <span className="text-[8px] font-medium text-slate-300 mt-0.5 truncate w-full text-center">
                              {step.label.split(' ')[0]}
                            </span>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* 3 Organized Right Tabs (Colors | Layers | Save) */}
                <div className="grid grid-cols-3 gap-0.5 bg-slate-950/90 p-0.5 rounded-md border border-slate-800">
                  {(
                    [
                      ['colors', 'Swatches'],
                      ['layers', `Layers (${studioLayers.length})`],
                      ['save', 'Save Skin'],
                    ] as const
                  ).map(([rKey, rLabel]) => {
                    const active = studioRightTab === rKey;
                    return (
                      <button
                        key={rKey}
                        type="button"
                        onClick={() => setStudioRightTab(rKey)}
                        className={`py-1 rounded text-[10px] font-bold transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-[#29c5f6] text-slate-950 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {rLabel}
                      </button>
                    );
                  })}
                </div>

                {/* TAB 1: ORGANIZED COLOR SWATCHES (1 Palette Category Visible at a Time) */}
                {studioRightTab === 'colors' && (
                  <div className="space-y-2">
                    {/* 4-Pill Palette Category Switcher */}
                    <div className="grid grid-cols-4 gap-1">
                      {['Neon', 'Camo', 'Shades', 'Metal'].map((shortName, idx) => (
                        <button
                          key={shortName}
                          type="button"
                          onClick={() => setStudioPaletteIdx(idx)}
                          className={`py-1 rounded text-[10px] font-semibold border transition-colors whitespace-nowrap ${
                            studioPaletteIdx === idx
                              ? 'bg-slate-800 text-[#38bdf8] border-[#38bdf8]/60 font-bold'
                              : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {shortName}
                        </button>
                      ))}
                    </div>

                    {/* Selected 12-Color Swatch Grid */}
                    {(() => {
                      const activeGroup =
                        SORTED_COLOR_PALETTES[studioPaletteIdx] ||
                        SORTED_COLOR_PALETTES[0];
                      return (
                        <div className="bg-slate-900/75 p-2 rounded-md border border-slate-800">
                          <div className="text-[10px] font-semibold text-slate-300 mb-1.5">
                            {activeGroup.label}
                          </div>
                          <div className="grid grid-cols-6 gap-1.5">
                            {activeGroup.swatches.map((sw) => {
                              const selected =
                                brushSettings.colorHex.toLowerCase() ===
                                sw.hex.toLowerCase();
                              return (
                                <button
                                  key={sw.hex + sw.name}
                                  type="button"
                                  title={`${sw.name} (${sw.hex})`}
                                  onClick={() => onSelectColor(sw.hex)}
                                  style={{ backgroundColor: sw.hex }}
                                  className={`h-5 rounded border transition-transform ${
                                    selected
                                      ? 'border-white scale-110 ring-1 ring-[#29c5f6] z-10'
                                      : 'border-slate-700/80 hover:scale-105'
                                  }`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Compact Recent Colors Row */}
                    {recentColors.length > 0 && (
                      <div className="flex items-center justify-between gap-1 pt-0.5">
                        <span className="text-[10px] text-slate-400 shrink-0">
                          Recent:
                        </span>
                        <div className="flex items-center gap-1 overflow-x-auto">
                          {recentColors.slice(0, 6).map((hex) => (
                            <button
                              key={hex}
                              type="button"
                              onClick={() => onSelectColor(hex)}
                              style={{ backgroundColor: hex }}
                              className="w-4 h-4 rounded-sm border border-slate-600 shrink-0"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: MULTI-LAYER MANAGER */}
                {studioRightTab === 'layers' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-300">
                        Paint Layers
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={onClearActiveLayer}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold border border-slate-700"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={onAddLayer}
                          className="px-2 py-0.5 rounded bg-[#29c5f6]/20 border border-[#29c5f6]/50 text-sky-300 text-[10px] font-bold"
                        >
                          + Layer
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 max-h-[150px] overflow-y-auto pr-0.5">
                      {studioLayers.map((layer, idx) => {
                        const active = layer.id === activeLayerId;
                        return (
                          <div
                            key={layer.id}
                            onClick={() => onSelectActiveLayer(layer.id)}
                            className={`cursor-pointer rounded px-2 py-1 border text-xs flex items-center justify-between ${
                              active
                                ? 'bg-[#162844] border-[#29c5f6]'
                                : 'bg-slate-900/80 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleLayerVisible(layer.id);
                                }}
                                className="text-slate-300 hover:text-white text-[11px] font-bold"
                              >
                                {layer.visible ? 'ON' : 'OFF'}
                              </button>
                              <span className="font-semibold truncate text-[11px]">
                                {layer.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {idx > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMergeLayerDown(layer.id);
                                  }}
                                  className="px-1 py-0.5 rounded bg-slate-800 text-[9px] font-semibold"
                                >
                                  Merge
                                </button>
                              )}
                              {studioLayers.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteLayer(layer.id);
                                  }}
                                  className="px-1 py-0.5 rounded bg-rose-950 text-rose-300 text-[9px] font-bold"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 3: SAVE & EXPORT SKIN */}
                {studioRightTab === 'save' && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-300 mb-1">
                        Skin Name
                      </label>
                      <input
                        type="text"
                        value={currentDesignName}
                        onChange={(e) => onChangeDesignName(e.target.value)}
                        placeholder="Custom skin name..."
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-white font-medium"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onSaveDesign(false);
                          setStudioHasUnsavedChanges(false);
                        }}
                        className="py-1.5 rounded bg-[#29c5f6] hover:bg-[#38bdf8] text-slate-950 font-bold text-[11px] whitespace-nowrap"
                      >
                        {currentDesignId ? 'Save' : 'Save Skin'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSaveDesign(true);
                          setStudioHasUnsavedChanges(false);
                        }}
                        className="py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-semibold text-[11px] border border-slate-600 whitespace-nowrap"
                      >
                        Save as New
                      </button>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          ) : (
            <div className="flex-1 pointer-events-none" />
          )}

          {/* 3. SLEEK SINGLE-ROW FLOATING BOTTOM CAMERA & GEAR PILL */}
          <div className="flex justify-center items-end pb-0.5 pointer-events-none relative">
            {/* Popover for Gear Visibility */}
            {studioGearPopoverOpen && (
              <div
                data-ui-panel="true"
                className="pointer-events-auto absolute bottom-11 bg-[#0b1322]/95 backdrop-blur-md border border-slate-600/80 rounded-lg p-2.5 shadow-2xl flex items-center gap-1.5 z-40"
              >
                {(
                  [
                    ['headgear', 'Ear Pods'],
                    ['backgear', 'Backpack'],
                    ['shoulders', 'Pauldrons'],
                    ['chestRig', 'Harness'],
                  ] as [EquipmentSlotId, string][]
                ).map(([slot, label]) => {
                  const on = activeEquipment.includes(slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => onToggleEquipmentSlot(slot)}
                      className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors whitespace-nowrap ${
                        on
                          ? 'bg-sky-500/20 text-sky-200 border-sky-400/60'
                          : 'bg-slate-900 text-slate-400 border-slate-700'
                      }`}
                    >
                      {label}: {on ? 'ON' : 'OFF'}
                    </button>
                  );
                })}
              </div>
            )}

            <div
              data-ui-panel="true"
              className="pointer-events-auto flex items-center gap-1 bg-[#0b1322]/90 backdrop-blur-md border border-slate-700/80 rounded-full px-2.5 py-1 shadow-xl overflow-x-auto max-w-full"
            >
              {(
                [
                  ['full', 'Front'],
                  ['left', 'Left'],
                  ['right', 'Right'],
                  ['back', 'Back'],
                  ['head', 'Head'],
                  ['upper', 'Torso'],
                  ['legs', 'Legs'],
                ] as [CameraFocusPreset, string][]
              ).map(([preset, label]) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onSelectCameraPreset(preset)}
                  className={`h-6 px-2 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    cameraFocusPreset === preset
                      ? 'bg-[#29c5f6] text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  {label}
                </button>
              ))}
              <div className="h-3.5 w-px bg-slate-700 mx-0.5 shrink-0" />
              <button
                type="button"
                onClick={() => onZoomCamera(-0.32)}
                title="Zoom In"
                className="h-6 px-2 rounded-full text-[11px] font-bold text-slate-200 hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => onZoomCamera(0.32)}
                title="Zoom Out"
                className="h-6 px-2 rounded-full text-[11px] font-bold text-slate-200 hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                −
              </button>
              <button
                type="button"
                onClick={onResetCamera}
                className="h-6 px-2 rounded-full text-[11px] font-semibold text-sky-300 hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                Reset
              </button>
              <div className="h-3.5 w-px bg-slate-700 mx-0.5 shrink-0" />
              <button
                type="button"
                onClick={() => setStudioGearPopoverOpen((prev) => !prev)}
                className={`h-6 px-2.5 rounded-full text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                  studioGearPopoverOpen
                    ? 'bg-sky-500/20 text-sky-300 border-sky-400/60'
                    : 'bg-slate-800/80 text-slate-200 border-slate-700 hover:bg-slate-700'
                }`}
              >
                Gear ({activeEquipment.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN E: DEDICATED LOADOUT SCREEN ('loadout')                        */}
      {/* ===================================================================== */}
      {activeTab === 'loadout' && (
        <div
          data-ui-panel="true"
          className="pointer-events-auto fixed left-3 md:left-[164px] right-3.5 top-[62px] bottom-3.5 flex items-start justify-between z-20"
        >
          <div className="w-full md:w-[320px] lg:w-[348px] max-h-full bg-[#0c1422]/94 backdrop-blur-md border border-slate-700/80 rounded-lg p-3.5 flex flex-col justify-between gap-3 shadow-xl overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/60">
                <h2 className="text-sm font-bold text-white whitespace-nowrap">
                  Weapon Loadout
                </h2>
                <button
                  type="button"
                  onClick={() => handleNavigateTab('home')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-600 whitespace-nowrap"
                >
                  ← Lobby
                </button>
              </div>

              {/* Loadout Pair Presets */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-300">
                  Primary & Secondary Pair
                </div>
                {LOADOUT_PAIRS.map((pair) => {
                  const selected = selectedLoadoutPairId === pair.id;
                  const w1 = WEAPON_REGISTRY[pair.weapons[0]];
                  const w2 = WEAPON_REGISTRY[pair.weapons[1]];
                  return (
                    <button
                      key={pair.id}
                      type="button"
                      onClick={() => {
                        soundEngine.play('ui_click');
                        onSelectLoadoutPair(pair.id, pair.weapons);
                      }}
                      className={`w-full text-left rounded-md p-2.5 border transition-all ${
                        selected
                          ? 'bg-[#152742] border-[#29c5f6] shadow-[0_0_10px_rgba(41,197,246,0.25)]'
                          : 'bg-[#111b2b] border-slate-700/80 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white">
                          {w1.shortName} + {w2.shortName}
                        </span>
                        <span className="text-[10px] font-semibold text-sky-300 uppercase">
                          {pair.id}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {w1.name} · {w2.name}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Active Handheld Weapon in Lobby */}
              <div>
                <div className="text-[11px] font-semibold text-slate-300 mb-1.5">
                  Displayed on Character
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {loadoutWeapons.map((wid, idx) => {
                    const w = WEAPON_REGISTRY[wid];
                    const active = selectedWeapon === wid;
                    const optId = resolveEquippedOptic(
                      wid,
                      settings?.weaponOptics
                    );
                    const optCfg = getOpticConfig(optId);
                    return (
                      <button
                        key={wid}
                        type="button"
                        onClick={() => onSelectWeapon(wid)}
                        className={`p-2 rounded-md border text-left ${
                          active
                            ? 'bg-[#152742] border-[#29c5f6]'
                            : 'bg-slate-900/80 border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-semibold text-sky-400">
                          <span>Slot {idx + 1}</span>
                          <span className="font-mono text-emerald-300">
                            {optCfg.shortLabel}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-white truncate">
                          {w.name}
                        </div>
                        <div className="text-[10px] text-slate-400 tabular-nums">
                          {w.damage} DMG · {w.magSize} RDS
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optic Attachment Selector for Active Weapon */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1.5">
                  <span>Optic Attachment ({WEAPON_REGISTRY[selectedWeapon].shortName})</span>
                  <span className="font-mono text-[10px] text-emerald-400">
                    {
                      getOpticConfig(
                        resolveEquippedOptic(selectedWeapon, settings?.weaponOptics)
                      ).name
                    }
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {CORE_SELECTABLE_OPTICS.map((optId) => {
                    const cfg = getOpticConfig(optId);
                    const activeOpt =
                      resolveEquippedOptic(selectedWeapon, settings?.weaponOptics) ===
                      optId;
                    return (
                      <button
                        key={optId}
                        type="button"
                        onClick={() => {
                          soundEngine.play('ui_click');
                          onUpdateSettings?.({
                            weaponOptics: {
                              ...(settings?.weaponOptics || DEFAULT_SETTINGS.weaponOptics),
                              [selectedWeapon]: optId,
                            },
                          });
                        }}
                        className={`py-1.5 px-2 rounded border text-center transition-all ${
                          activeOpt
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-bold'
                            : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="font-mono text-[11px] font-bold">
                          {cfg.shortLabel}
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {cfg.magnification.toFixed(1)}x Zoom
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2.5 border-t border-slate-700/60">
              <button
                type="button"
                onClick={() => {
                  onSelectLoadoutPair(LOADOUT_PAIRS[0].id, LOADOUT_PAIRS[0].weapons);
                  onSelectWeapon(LOADOUT_PAIRS[0].weapons[0]);
                }}
                className="px-2.5 py-2 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-600 whitespace-nowrap"
              >
                Reset
              </button>
              <button
                type="button"
                data-testid="lobby-open-backpack-btn"
                onClick={() => props.onOpenBackpack?.()}
                className="px-2.5 py-2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-[11px] font-bold text-emerald-300 border border-emerald-400/50 whitespace-nowrap"
              >
                Backpack [B]
              </button>
              <button
                type="button"
                onClick={() => handleNavigateTab('home')}
                className="flex-1 py-2 rounded bg-gradient-to-b from-[#fde047] to-[#eab308] text-slate-950 font-extrabold text-xs tracking-wide whitespace-nowrap"
              >
                Save Loadout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN F: DEDICATED WEAPONS ARMORY SCREEN ('weapons')                 */}
      {/* ===================================================================== */}
      {activeTab === 'weapons' && (
        <div
          data-ui-panel="true"
          className="pointer-events-auto fixed left-3 md:left-[164px] right-3.5 top-[62px] bottom-3.5 bg-[#0c1422]/95 backdrop-blur-md border border-slate-700/80 rounded-lg p-4 flex flex-col justify-between shadow-2xl z-20"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-700/60">
            <h2 className="text-base font-bold text-white whitespace-nowrap">
              Weapons Armory
            </h2>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  ['all', 'All'],
                  ['assault', 'Assault'],
                  ['smg', 'SMG'],
                  ['shotgun', 'Shotgun'],
                  ['sniper', 'Sniper'],
                  ['sidearm', 'Pistol'],
                ] as const
              ).map(([cat, label]) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setWeaponCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold border whitespace-nowrap ${
                    weaponCategoryFilter === cat
                      ? 'bg-[#29c5f6] text-slate-950 border-[#38bdf8] font-bold'
                      : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                data-testid="armory-open-backpack-btn"
                onClick={() => props.onOpenBackpack?.()}
                className="ml-1 px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-[11px] font-bold text-emerald-300 border border-emerald-400/50 whitespace-nowrap"
              >
                Backpack [B]
              </button>
              <button
                type="button"
                onClick={() => handleNavigateTab('home')}
                className="ml-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-600 whitespace-nowrap"
              >
                ← Lobby
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 my-3 flex-1 overflow-y-auto pr-1">
            {WEAPON_ORDER.filter((wid) => {
              if (weaponCategoryFilter === 'all') return true;
              if (weaponCategoryFilter === 'assault')
                return wid === 'm4a1' || wid === 'ak47';
              if (weaponCategoryFilter === 'smg') return wid === 'mp5';
              if (weaponCategoryFilter === 'shotgun') return wid === 'spas12';
              if (weaponCategoryFilter === 'sniper') return wid === 'awp';
              if (weaponCategoryFilter === 'sidearm') return wid === 'deagle';
              return true;
            }).map((wid) => {
              const spec = WEAPON_REGISTRY[wid];
              const isEquipped = selectedWeapon === wid;
              return (
                <div
                  key={wid}
                  onClick={() => {
                    soundEngine.play('ui_click');
                    onSelectWeapon(wid);
                  }}
                  className={`cursor-pointer rounded-lg p-3 border flex flex-col justify-between transition-all ${
                    isEquipped
                      ? 'bg-[#152742] border-[#29c5f6] shadow-[0_0_12px_rgba(41,197,246,0.25)]'
                      : 'bg-[#111b2b] border-slate-700/80 hover:border-slate-500'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase text-sky-400">
                        {spec.category}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-300">
                        {isEquipped ? 'Equipped' : 'Ready'}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white mt-0.5">
                      {spec.name}
                    </h3>
                    <div className="my-2.5 h-20 rounded bg-slate-950/80 border border-slate-800 flex items-center justify-center p-2">
                      <WeaponIllustration weaponId={wid} className="w-full h-16" />
                    </div>
                  </div>

                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between tabular-nums">
                      <span className="text-slate-400">Damage</span>
                      <span className="font-bold text-white">{spec.damage}</span>
                    </div>
                    <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#29c5f6]"
                        style={{ width: `${Math.min(100, spec.damage)}%` }}
                      />
                    </div>
                    <div className="flex justify-between pt-0.5 tabular-nums">
                      <span className="text-slate-400">Fire Rate</span>
                      <span className="font-semibold text-white">{spec.fireIntervalMs}ms</span>
                    </div>
                    <div className="flex justify-between tabular-nums">
                      <span className="text-slate-400">Magazine</span>
                      <span className="font-semibold text-white">{spec.magSize} rds</span>
                    </div>
                    <div className="pt-1.5 border-t border-slate-800/80">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span>Optic Sight</span>
                        <span className="font-mono text-emerald-300 font-bold">
                          {
                            getOpticConfig(
                              resolveEquippedOptic(wid, settings?.weaponOptics)
                            ).name
                          }
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {CORE_SELECTABLE_OPTICS.map((optId) => {
                          const cfg = getOpticConfig(optId);
                          const isOptEquipped =
                            resolveEquippedOptic(wid, settings?.weaponOptics) ===
                            optId;
                          return (
                            <button
                              key={optId}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                soundEngine.play('ui_click');
                                onUpdateSettings?.({
                                  weaponOptics: {
                                    ...(settings?.weaponOptics ||
                                      DEFAULT_SETTINGS.weaponOptics),
                                    [wid]: optId,
                                  },
                                });
                              }}
                              className={`py-1 rounded font-mono text-[10px] font-bold border transition-colors ${
                                isOptEquipped
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                              }`}
                            >
                              {cfg.shortLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectWeapon(wid);
                      }}
                      className={`w-full mt-2 py-1.5 rounded font-bold text-[11px] whitespace-nowrap ${
                        isEquipped
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-[#29c5f6] text-slate-950'
                      }`}
                    >
                      {isEquipped ? 'Equipped' : 'Equip Weapon'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN G: DEDICATED EVENTS SCREEN ('events')                          */}
      {/* ===================================================================== */}
      {activeTab === 'events' && (
        <div
          data-ui-panel="true"
          className="pointer-events-auto fixed left-3 md:left-[164px] right-3.5 top-[62px] bottom-3.5 bg-[#0c1422]/95 backdrop-blur-md border border-slate-700/80 rounded-lg p-4 flex flex-col justify-between shadow-2xl z-20 overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/60">
            <h2 className="text-base font-bold text-white whitespace-nowrap">
              Season 1 Events
            </h2>
            <button
              type="button"
              onClick={() => handleNavigateTab('home')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-600 whitespace-nowrap"
            >
              ← Lobby
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-3 flex-1">
            {[
              {
                id: 'evt_season1',
                title: 'SEASON 1: SKY BASTION',
                subtitle: 'New Challenges, New Rewards',
                desc: 'Deploy into the floating Sky Bastion outpost, complete tactical objectives, and earn exclusive Season 1 Coins & Gems.',
                progress: 3,
                target: 3,
                rewardCoins: 1200,
                rewardGems: 80,
                badge: 'READY TO CLAIM',
              },
              {
                id: 'evt_studio_jam',
                title: '3D STUDIO PAINT JAM',
                subtitle: 'Custom 3D Skin Showcase',
                desc: 'Paint your pure-white low-poly operator with custom multi-layer artwork in the 3D Studio and equip it for combat.',
                progress: savedDesigns.length,
                target: 1,
                rewardCoins: 800,
                rewardGems: 50,
                badge: 'LIMITED TIME',
              },
              {
                id: 'evt_squad_blitz',
                title: 'SQUAD BATTLE ROYALE',
                subtitle: 'Double XP Weekend',
                desc: 'Team up in Solo, Duo, or Squad mode and eliminate hostiles across any arena.',
                progress: 1,
                target: 1,
                rewardCoins: 650,
                rewardGems: 40,
                badge: 'ACTIVE EVENT',
              },
            ].map((ev) => {
              const claimed = claimedEventIds.includes(ev.id);
              const canClaim = ev.progress >= ev.target && !claimed;
              return (
                <div
                  key={ev.id}
                  className="rounded-lg bg-[#111b2b] border border-slate-700/80 p-3.5 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="h-24 rounded-md bg-gradient-to-br from-purple-900 via-blue-900 to-slate-900 border border-sky-400/40 p-2.5 flex flex-col justify-between">
                      <span className="self-start text-[10px] font-bold px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                        {ev.badge}
                      </span>
                      <div className="text-base font-black italic text-white drop-shadow">
                        {ev.title}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-[#fb923c] mt-2.5">
                      {ev.subtitle}
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                      {ev.desc}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2.5 border-t border-slate-700/60">
                    <div className="flex justify-between text-[11px] tabular-nums">
                      <span className="text-slate-400">Progress</span>
                      <span className="font-bold text-white">
                        {Math.min(ev.progress, ev.target)} / {ev.target}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-300 tabular-nums">
                      <span>+{ev.rewardCoins} Coins</span>
                      <span className="text-purple-300">+{ev.rewardGems} Gems</span>
                    </div>
                    <button
                      type="button"
                      disabled={claimed}
                      onClick={() => {
                        if (canClaim) {
                          soundEngine.play('ui_confirm');
                          setClaimedEventIds((prev) => [...prev, ev.id]);
                          onAddCurrency?.(ev.rewardCoins, ev.rewardGems);
                        } else {
                          onStartMatch();
                        }
                      }}
                      className={`w-full py-2 rounded font-bold text-xs whitespace-nowrap ${
                        claimed
                          ? 'bg-slate-800 text-slate-500'
                          : canClaim
                          ? 'bg-gradient-to-b from-[#fde047] to-[#eab308] text-slate-950'
                          : 'bg-[#29c5f6] text-slate-950'
                      }`}
                    >
                      {claimed
                        ? 'Reward Claimed ✓'
                        : canClaim
                        ? 'Claim Event Reward'
                        : 'Play Now'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN H: DEDICATED MISSIONS SCREEN ('missions')                      */}
      {/* ===================================================================== */}
      {activeTab === 'missions' && (
        <div
          data-ui-panel="true"
          className="pointer-events-auto fixed left-3 md:left-[164px] right-3.5 top-[62px] bottom-3.5 bg-[#0c1422]/95 backdrop-blur-md border border-slate-700/80 rounded-lg p-4 flex flex-col justify-between shadow-2xl z-20 overflow-y-auto"
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-700/60">
              <h2 className="text-base font-bold text-white whitespace-nowrap">
                Missions
              </h2>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    ['daily', 'Daily'],
                    ['weekly', 'Weekly'],
                    ['season', 'Season 1'],
                  ] as const
                ).map(([tabId, label]) => (
                  <button
                    key={tabId}
                    type="button"
                    onClick={() => setMissionTab(tabId)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold border whitespace-nowrap ${
                      missionTab === tabId
                        ? 'bg-[#29c5f6] text-slate-950 border-[#38bdf8] font-bold'
                        : 'bg-slate-800 text-slate-200 border-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleNavigateTab('home')}
                  className="ml-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-600 whitespace-nowrap"
                >
                  ← Lobby
                </button>
              </div>
            </div>

            <div className="space-y-2.5 mt-3">
              {missions.map((m) => {
                const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
                const ready = m.progress >= m.target && !m.claimed;
                return (
                  <div
                    key={m.id}
                    className="rounded-lg bg-[#111b2b] border border-slate-700/80 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          {m.title}
                        </span>
                        <span className="text-[10px] font-semibold text-sky-400 capitalize">
                          · {missionTab}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">{m.description}</p>
                      <div className="w-full max-w-md h-1.5 bg-slate-900 rounded-full overflow-hidden mt-1.5">
                        <div
                          className="h-full bg-[#29c5f6]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 tabular-nums">
                        {m.progress} / {m.target}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right tabular-nums">
                        <div className="text-[11px] font-bold text-amber-300">
                          +{m.rewardCredits} Coins
                        </div>
                        <div className="text-[11px] font-semibold text-sky-300">
                          +{m.rewardXp} XP
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={m.claimed}
                        onClick={() => {
                          if (ready) {
                            onClaimMission(m.id);
                          } else if (m.id.includes('paint')) {
                            handleNavigateTab('painting_studio');
                          } else {
                            onStartMatch();
                          }
                        }}
                        className={`px-3.5 py-2 rounded font-bold text-xs whitespace-nowrap ${
                          m.claimed
                            ? 'bg-slate-800 text-slate-500'
                            : ready
                            ? 'bg-gradient-to-b from-[#fde047] to-[#eab308] text-slate-950'
                            : 'bg-[#29c5f6] text-slate-950'
                        }`}
                      >
                        {m.claimed ? 'Claimed ✓' : ready ? 'Claim Reward' : 'Go Now'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN I: DEDICATED FRIENDS & PARTY SCREEN ('friends')                */}
      {/* ===================================================================== */}
      {activeTab === 'friends' && (
        <div
          data-ui-panel="true"
          className="pointer-events-auto fixed left-3 md:left-[164px] right-3.5 top-[62px] bottom-3.5 flex items-stretch justify-between gap-3 z-20"
        >
          <div className="flex-1 bg-[#0c1422]/95 backdrop-blur-md border border-slate-700/80 rounded-lg p-4 flex flex-col justify-between shadow-2xl">
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/60">
                <h2 className="text-base font-bold text-white whitespace-nowrap">
                  Friends & Party ({partySize.toUpperCase()} · Max {maxPartySlots})
                </h2>
                <button
                  type="button"
                  onClick={() => handleNavigateTab('home')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-600 whitespace-nowrap"
                >
                  ← Lobby
                </button>
              </div>

              {/* Tabs + Search */}
              <div className="flex flex-wrap items-center justify-between gap-2 my-2.5">
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      ['friends', `Friends (${DEV_FRIENDS_ROSTER.length})`],
                      ['requests', `Requests (${friendRequests.length})`],
                      ['party', `Party (${partyMembers.length}/${maxPartySlots})`],
                    ] as const
                  ).map(([tid, label]) => (
                    <button
                      key={tid}
                      type="button"
                      onClick={() => setFriendsSubTab(tid)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold border whitespace-nowrap ${
                        friendsSubTab === tid
                          ? 'bg-[#29c5f6] text-slate-950 border-[#38bdf8] font-bold'
                          : 'bg-slate-800 text-slate-200 border-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={friendSearchQuery}
                  onChange={(e) => setFriendSearchQuery(e.target.value)}
                  placeholder="Search player..."
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white w-48"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {friendsSubTab === 'friends' &&
                  DEV_FRIENDS_ROSTER.filter((f) =>
                    f.name.toLowerCase().includes(friendSearchQuery.toLowerCase())
                  ).map((friend) => {
                    const inParty = partyMembers.some((m) => m.id === friend.id);
                    const canAdd = canAddPartyMember(partyMembers.length, partySize);
                    return (
                      <div
                        key={friend.id}
                        className="rounded-md bg-[#111b2b] border border-slate-700/80 p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded overflow-hidden border border-slate-600 shrink-0">
                            <CharacterPortraitThumb charId={friend.characterId} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  friend.online ? 'bg-emerald-400' : 'bg-slate-500'
                                }`}
                              />
                              <span className="text-xs font-bold text-white truncate">
                                {friend.name}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                Lv.{friend.level}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {friend.status} · {friend.designTag}
                            </div>
                          </div>
                        </div>

                        {inParty ? (
                          <button
                            type="button"
                            onClick={() => onRemovePartyMember(friend.id)}
                            className="px-2.5 py-1 rounded bg-rose-950 text-rose-300 text-[11px] font-semibold border border-rose-700/60 whitespace-nowrap shrink-0"
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!friend.online || !canAdd}
                            onClick={() => onInviteFriendToParty(friend)}
                            className="px-2.5 py-1 rounded bg-[#29c5f6] disabled:opacity-40 text-slate-950 text-[11px] font-bold whitespace-nowrap shrink-0"
                          >
                            {canAdd ? 'Invite to Party' : `Full (${maxPartySlots})`}
                          </button>
                        )}
                      </div>
                    );
                  })}

                {friendsSubTab === 'requests' &&
                  friendRequests.map((req) => (
                    <div
                      key={req.id}
                      className="rounded-md bg-[#111b2b] border border-slate-700/80 p-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded overflow-hidden border border-slate-600 shrink-0">
                          <CharacterPortraitThumb charId={req.characterId} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">
                            {req.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Lv.{req.level} · Friend request
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onInviteFriendToParty(req);
                            setFriendRequests((prev) =>
                              prev.filter((r) => r.id !== req.id)
                            );
                          }}
                          className="px-2.5 py-1 rounded bg-emerald-500 text-slate-950 text-[11px] font-bold whitespace-nowrap"
                        >
                          Accept & Invite
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFriendRequests((prev) =>
                              prev.filter((r) => r.id !== req.id)
                            )
                          }
                          className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-[11px] font-semibold whitespace-nowrap"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}

                {friendsSubTab === 'party' &&
                  partyMembers.map((mem) => (
                    <div
                      key={mem.id}
                      className="rounded-md bg-[#152742] border border-[#29c5f6] p-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded overflow-hidden border border-[#29c5f6] shrink-0">
                          <CharacterPortraitThumb charId={mem.characterId} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">
                            {mem.name} {mem.isLeader ? '(Leader)' : ''}
                          </div>
                          <div className="text-[11px] text-emerald-300">
                            {mem.statusText} · Lv.{mem.level}
                          </div>
                        </div>
                      </div>
                      {!mem.isLeader ? (
                        <button
                          type="button"
                          onClick={() => onRemovePartyMember(mem.id)}
                          className="px-2.5 py-1 rounded bg-rose-950 text-rose-300 text-[11px] font-semibold whitespace-nowrap"
                        >
                          Kick
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={onTogglePartyReady}
                          className="px-2.5 py-1 rounded bg-emerald-500 text-slate-950 text-[11px] font-bold whitespace-nowrap"
                        >
                          {mem.ready ? 'Ready ✓' : 'Set Ready'}
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN J: DEDICATED SHOP SCREEN ('shop')                              */}
      {/* ===================================================================== */}
      {activeTab === 'shop' && (
        <div
          data-ui-panel="true"
          className="pointer-events-auto fixed left-3 md:left-[164px] right-3.5 top-[62px] bottom-3.5 bg-[#0c1422]/95 backdrop-blur-md border border-slate-700/80 rounded-lg p-4 flex flex-col justify-between shadow-2xl z-20 overflow-y-auto"
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-700/60">
              <h2 className="text-base font-bold text-white whitespace-nowrap">
                Item Shop
              </h2>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    ['featured', 'Featured'],
                    ['cosmetics', 'Armor & Gear'],
                    ['bundles', 'Paint Bundles'],
                    ['currency', 'Coins & Gems'],
                  ] as const
                ).map(([cid, label]) => (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => setShopCategory(cid)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold border whitespace-nowrap ${
                      shopCategory === cid
                        ? 'bg-[#29c5f6] text-slate-950 border-[#38bdf8] font-bold'
                        : 'bg-slate-800 text-slate-200 border-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleNavigateTab('home')}
                  className="ml-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-600 whitespace-nowrap"
                >
                  ← Lobby
                </button>
              </div>
            </div>

            {shopCategory === 'currency' ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                {[
                  {
                    id: 'pack_1',
                    title: 'Starter Coin Cache',
                    coins: 2500,
                    gems: 100,
                    tag: 'Starter',
                  },
                  {
                    id: 'pack_2',
                    title: 'Sky Bastion Vault Pack',
                    coins: 6000,
                    gems: 350,
                    tag: 'Popular',
                  },
                  {
                    id: 'pack_3',
                    title: 'Pro Artisan Crate',
                    coins: 15000,
                    gems: 1000,
                    tag: 'Best Value',
                  },
                ].map((pk) => (
                  <div
                    key={pk.id}
                    className="rounded-lg bg-[#111b2b] border border-slate-700 p-3.5 flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-[10px] font-semibold text-amber-300">
                        {pk.tag}
                      </span>
                      <h3 className="text-sm font-bold text-white mt-1">
                        {pk.title}
                      </h3>
                      <div className="text-xs font-bold text-amber-300 mt-1.5 tabular-nums">
                        +{pk.coins.toLocaleString()} Coins
                      </div>
                      <div className="text-xs font-bold text-purple-300 tabular-nums">
                        +{pk.gems.toLocaleString()} Gems
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.play('ui_confirm');
                        onAddCurrency?.(pk.coins, pk.gems);
                      }}
                      className="w-full mt-3 py-2 rounded bg-gradient-to-b from-[#fde047] to-[#eab308] text-slate-950 font-bold text-xs whitespace-nowrap"
                    >
                      Claim Pack
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                {cosmeticInventory.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg bg-[#111b2b] border border-slate-700/80 p-3.5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase text-sky-400">
                          {item.rarity} · {item.category}
                        </span>
                        {item.owned && (
                          <span className="text-[10px] font-semibold text-emerald-300">
                            Owned
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-white mt-0.5">
                        {item.name}
                      </h3>
                      <div
                        className="my-2.5 h-20 rounded border border-slate-600 flex items-center justify-center"
                        style={{ backgroundColor: item.previewHex }}
                      >
                        <div className="w-12 h-12 rounded-full bg-white/90 border-2 border-slate-900 shadow flex items-center justify-center text-slate-950 font-bold text-[10px]">
                          3D
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-300">{item.description}</p>
                    </div>

                    <div className="pt-2.5 mt-2.5 border-t border-slate-700/60">
                      {item.owned ? (
                        <button
                          type="button"
                          onClick={() => handleNavigateTab('vault')}
                          className="w-full py-1.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-semibold text-xs whitespace-nowrap"
                        >
                          Equip in Vault
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setPendingShopItem({
                              id: item.id,
                              name: item.name,
                              description: item.description,
                              price: item.priceCredits || 1200,
                              currency: 'coins',
                              rarity: item.rarity,
                            })
                          }
                          className="w-full py-1.5 rounded bg-gradient-to-b from-[#fde047] to-[#eab308] text-slate-950 font-bold text-xs whitespace-nowrap"
                        >
                          Buy · {item.priceCredits || 1200} Coins
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN K: DEDICATED PLAYER PROFILE SCREEN ('profile')                 */}
      {/* ===================================================================== */}
      {activeTab === 'profile' && (
        <div
          data-ui-panel="true"
          className="pointer-events-auto fixed left-3 md:left-[164px] right-3.5 top-[62px] bottom-3.5 bg-[#0c1422]/95 backdrop-blur-md border border-slate-700/80 rounded-lg p-4 flex flex-col justify-between shadow-2xl z-20 overflow-y-auto"
        >
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/60">
              <h2 className="text-base font-bold text-white whitespace-nowrap">
                Player Profile
              </h2>
              <button
                type="button"
                onClick={() => handleNavigateTab('home')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-600 whitespace-nowrap"
              >
                ← Lobby
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              {/* Identity & Editable Callsign Card */}
              <div className="rounded-lg bg-[#111b2b] border border-slate-700 p-3.5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-md border-2 border-[#29c5f6] overflow-hidden shrink-0">
                    <CharacterPortraitThumb charId={p1Char} variant="avatar" />
                  </div>
                  <div>
                    <div className="text-base font-bold text-white">
                      {playerName}
                    </div>
                    <div className="text-xs font-semibold text-[#38bdf8]">
                      Lv. {playerLevel} · Season 1
                    </div>
                    <div className="text-[11px] text-slate-400 tabular-nums">
                      {xpCurrent} / {xpMax} XP
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Edit Player Name
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      maxLength={18}
                      value={editingProfileName}
                      onChange={(e) => setEditingProfileName(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const clean = editingProfileName.trim();
                        if (clean && onChangePlayerName) {
                          onChangePlayerName(clean);
                        }
                      }}
                      className="px-2.5 py-1 rounded bg-[#29c5f6] text-slate-950 font-bold text-xs whitespace-nowrap"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>

              {/* Combat Stats */}
              <div className="rounded-lg bg-[#111b2b] border border-slate-700 p-3.5 space-y-2">
                <div className="text-xs font-bold text-sky-400">
                  Career Stats
                </div>
                {[
                  ['Matches Played', '48'],
                  ['Victories', '31 (64.5%)'],
                  ['Eliminations', '214'],
                  ['K/D Ratio', '2.85'],
                  ['Headshot Rate', '42.8%'],
                  ['Custom Skins', String(savedDesigns.length)],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between text-xs py-1 border-b border-slate-800/80 tabular-nums"
                  >
                    <span className="text-slate-400">{k}</span>
                    <span className="font-semibold text-white">{v}</span>
                  </div>
                ))}
              </div>

              {/* Achievements & Medals */}
              <div className="rounded-lg bg-[#111b2b] border border-slate-700 p-3.5 space-y-2">
                <div className="text-xs font-bold text-amber-400">
                  Unlocked Medals
                </div>
                {[
                  {
                    title: 'Studio Artisan',
                    desc: 'Equipped a custom 3D painted skin on your operator.',
                  },
                  {
                    title: 'Sky Bastion Pioneer',
                    desc: 'Reached Level 12 in Season 1.',
                  },
                  {
                    title: 'Ballistic Marksman',
                    desc: 'Mastered directional 360° impact craters.',
                  },
                ].map((ach) => (
                  <div
                    key={ach.title}
                    className="p-2 rounded bg-slate-900/80 border border-slate-800"
                  >
                    <div className="text-xs font-bold text-white">
                      {ach.title}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {ach.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN L: DEDICATED SETTINGS SCREEN ('settings')                      */}
      {/* Uses SharedSettingsPanel so Lobby Settings === In-Game Settings 100%! */}
      {/* ===================================================================== */}
      {activeTab === 'settings' && (
        <div
          data-ui-panel="true"
          className="pointer-events-auto fixed left-3 md:left-[164px] right-3.5 top-[62px] bottom-3.5 bg-[#0c1422]/95 backdrop-blur-md border border-slate-700/80 rounded-lg p-4 flex flex-col justify-between shadow-2xl z-20 overflow-y-auto"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/60">
              <div>
                <h2 className="text-base font-bold text-white whitespace-nowrap">
                  Game Settings
                </h2>
                <p className="text-[11px] text-slate-400">
                  All settings here are automatically synced with In-Game Combat Settings
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleNavigateTab('home')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-600 whitespace-nowrap"
              >
                ← Lobby
              </button>
            </div>

            <SharedSettingsPanel
              settings={settings || DEFAULT_SETTINGS}
              isFullscreen={isFullscreen}
              onUpdateSettings={(partial) => onUpdateSettings?.(partial)}
              onToggleFullscreen={() => onToggleFullscreen?.()}
              onOpenLayoutEditor={() => onOpenLayoutEditor?.()}
            />
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCREEN M: DEDICATED GAME MODE & MAP SELECTION SCREEN ('game_mode')    */}
      {/* ===================================================================== */}
      {activeTab === 'game_mode' && (
        <div
          data-ui-panel="true"
          className="pointer-events-auto fixed left-3 md:left-[164px] right-3.5 top-[62px] bottom-3.5 bg-[#0c1422]/95 backdrop-blur-md border border-slate-700/80 rounded-lg p-4 flex flex-col justify-between shadow-2xl z-20 overflow-y-auto"
        >
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/60">
              <h2 className="text-base font-bold text-white whitespace-nowrap">
                Game Mode & Map
              </h2>
              <button
                type="button"
                onClick={() => handleNavigateTab('home')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-600 whitespace-nowrap"
              >
                ← Lobby
              </button>
            </div>

            {/* Game Modes Row */}
            <div className="mt-3">
              <div className="text-xs font-semibold text-slate-300 mb-1.5">
                Game Mode
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    id: 'bot' as GameMode,
                    displayTitle: 'Battle Royale',
                    subtitle: 'Sky-Island Survival & Elimination',
                    badge: 'Ranked',
                  },
                  {
                    id: 'bot' as GameMode,
                    displayTitle: 'Team Deathmatch',
                    subtitle: 'Fast-Paced Arena Combat',
                    badge: 'Classic',
                  },
                  {
                    id: 'training' as GameMode,
                    displayTitle: 'Firing Range Lab',
                    subtitle: 'Recoil & Target Practice',
                    badge: 'Practice',
                  },
                ].map((gm) => {
                  const active = selectedGameModeDisplay === gm.displayTitle;
                  return (
                    <button
                      key={gm.displayTitle}
                      type="button"
                      onClick={() => {
                        soundEngine.play('ui_click');
                        setSelectedGameModeDisplay(gm.displayTitle);
                        onSelectGameMode(gm.id);
                      }}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        active
                          ? 'bg-[#152742] border-[#29c5f6] shadow-[0_0_12px_rgba(41,197,246,0.25)]'
                          : 'bg-[#111b2b] border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <span className="text-[10px] font-semibold text-sky-300">
                        {gm.badge}
                      </span>
                      <div className="text-sm font-bold text-white mt-0.5">
                        {gm.displayTitle}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {gm.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Maps Row */}
            <div className="mt-3.5">
              <div className="text-xs font-semibold text-slate-300 mb-1.5">
                Arena Map
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('ui_click');
                    setSelectedMapModeLabel('Random');
                  }}
                  className={`p-2.5 rounded-lg border text-left ${
                    selectedMapModeLabel === 'Random'
                      ? 'bg-[#152742] border-[#29c5f6]'
                      : 'bg-[#111b2b] border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold text-white">Random</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    All tactical arenas
                  </div>
                </button>
                {ARENA_ORDER.map((aid) => {
                  const aSpec = ARENA_REGISTRY[aid];
                  const active =
                    selectedMapModeLabel === aSpec.name && arenaId === aid;
                  return (
                    <button
                      key={aid}
                      type="button"
                      onClick={() => {
                        soundEngine.play('ui_click');
                        onSelectArena(aid);
                        setSelectedMapModeLabel(aSpec.name);
                      }}
                      className={`p-2.5 rounded-lg border text-left ${
                        active
                          ? 'bg-[#152742] border-[#29c5f6]'
                          : 'bg-[#111b2b] border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">
                        {aSpec.name}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                        {aSpec.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bot Difficulty & Party Size */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3.5">
              <div className="bg-[#111b2b] border border-slate-700 rounded-lg p-2.5">
                <div className="text-[11px] font-semibold text-slate-300 mb-1.5">
                  AI Difficulty
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['easy', 'normal', 'hard'] as BotDifficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onSelectDifficulty(d)}
                      className={`py-1 rounded text-xs font-semibold capitalize whitespace-nowrap ${
                        botDifficulty === d
                          ? 'bg-[#29c5f6] text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#111b2b] border border-slate-700 rounded-lg p-2.5">
                <div className="text-[11px] font-semibold text-slate-300 mb-1.5">
                  Party Size
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['solo', 'duo', 'squad'] as PartySize[]).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => onSelectPartySize(sz)}
                      className={`py-1 rounded text-xs font-semibold capitalize whitespace-nowrap ${
                        partySize === sz
                          ? 'bg-[#29c5f6] text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2.5 border-t border-slate-700/60 mt-3">
            <button
              type="button"
              onClick={() => handleNavigateTab('home')}
              className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-600 whitespace-nowrap"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={onStartMatch}
              className="px-5 py-2 rounded bg-gradient-to-b from-[#fde047] to-[#eab308] text-slate-950 font-extrabold text-xs uppercase tracking-wide whitespace-nowrap"
            >
              PLAY NOW
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* INTERACTIVE DIALOGS: CHAT DRAWER, NOTIFICATIONS, SHOP CONFIRM, UNSAVED */}
      {/* ===================================================================== */}
      {chatDrawerOpen && (
        <div
          data-ui-panel="true"
          className="pointer-events-auto fixed left-3.5 bottom-[58px] w-[320px] bg-[#0f1726]/95 border border-slate-500/80 rounded-lg p-3 shadow-2xl z-40"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700">
            <span className="text-xs font-black uppercase text-[#38bdf8]">
              Squad & Lobby Chat
            </span>
            <button
              type="button"
              onClick={() => setChatDrawerOpen(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="h-36 overflow-y-auto space-y-1.5 mb-2 pr-1 text-xs">
            {chatMessages.map((m) => (
              <div key={m.id} className="bg-slate-900/90 rounded p-1.5">
                <span className="font-bold text-[#38bdf8]">{m.sender}</span>{' '}
                <span className="text-[10px] text-slate-500">{m.time}</span>
                <div className="text-slate-200">{m.text}</div>
              </div>
            ))}
          </div>
          <form onSubmit={handleSendChat} className="flex gap-1.5">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type message to squad..."
              className="flex-1 bg-slate-900 border border-slate-600 rounded px-2.5 py-1.5 text-xs text-white"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded bg-[#29c5f6] text-slate-950 font-black text-xs"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {notificationsOpen && (
        <div
          data-ui-panel="true"
          className="pointer-events-auto fixed right-16 top-[54px] w-[280px] bg-[#0f1726]/96 border border-slate-500/80 rounded-lg p-3 shadow-2xl z-40 space-y-2"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-700">
            <span className="text-xs font-black uppercase text-white">
              Notifications (3)
            </span>
            <button
              type="button"
              onClick={() => setNotificationsOpen(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="text-xs bg-slate-900/90 p-2 rounded border border-slate-700">
            <div className="font-bold text-[#38bdf8]">Season 1 Live!</div>
            <div className="text-slate-300 text-[11px]">
              Claim your Sky Bastion rewards in the Events tab.
            </div>
          </div>
          <div className="text-xs bg-slate-900/90 p-2 rounded border border-slate-700">
            <div className="font-bold text-amber-300">3D Paint Studio Ready</div>
            <div className="text-slate-300 text-[11px]">
              Paint directly onto your 3D character in the Paint Studio!
            </div>
          </div>
          <div className="text-xs bg-slate-900/90 p-2 rounded border border-slate-700">
            <div className="font-bold text-emerald-300">2 Squad Invites</div>
            <div className="text-slate-300 text-[11px]">
              KAI_VORTEX & NOVA_STRIKE are online in the lobby.
            </div>
          </div>
        </div>
      )}

      {currencyModalOpen && (
        <div
          data-ui-panel="true"
          role="dialog"
          className="pointer-events-auto fixed inset-0 bg-black/65 flex items-center justify-center z-50"
        >
          <div className="w-[380px] bg-[#0f1726] border border-[#29c5f6] rounded-lg p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black uppercase text-white">
                Top Up Coins & Gems
              </h3>
              <button
                type="button"
                onClick={() => setCurrencyModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-300">
              Add instant Season 1 currency to unlock cosmetic armor and custom items in the Shop.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('ui_confirm');
                  onAddCurrency?.(1000, 0);
                  setCurrencyModalOpen(false);
                }}
                className="p-3 rounded bg-slate-900 hover:bg-slate-800 border border-amber-400/60 text-center"
              >
                <div className="text-sm font-black text-amber-300">+1,000 Coins</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Instant Grant</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('ui_confirm');
                  onAddCurrency?.(0, 150);
                  setCurrencyModalOpen(false);
                }}
                className="p-3 rounded bg-slate-900 hover:bg-slate-800 border border-purple-400/60 text-center"
              >
                <div className="text-sm font-black text-purple-300">+150 Gems</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Instant Grant</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingShopItem && (
        <div
          data-ui-panel="true"
          role="dialog"
          className="pointer-events-auto fixed inset-0 bg-black/65 flex items-center justify-center z-50"
        >
          <div className="w-[380px] bg-[#0f1726] border border-[#29c5f6] rounded-lg p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-black uppercase text-white">
              Confirm Item Purchase
            </h3>
            <div className="p-3 rounded bg-slate-900 border border-slate-700">
              <div className="text-sm font-bold text-white">
                {pendingShopItem.name}
              </div>
              <div className="text-xs text-slate-300 mt-1">
                {pendingShopItem.description}
              </div>
              <div className="text-xs font-bold text-amber-300 mt-2">
                Price: {pendingShopItem.price} Coins
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingShopItem(null)}
                className="px-4 py-2 rounded bg-slate-800 text-xs font-bold text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onPurchaseCosmeticItem(
                    pendingShopItem.id,
                    pendingShopItem.price,
                    pendingShopItem.currency
                  );
                  setPendingShopItem(null);
                }}
                className="px-4 py-2 rounded bg-gradient-to-b from-[#fde047] to-[#eab308] text-slate-950 text-xs font-black uppercase"
              >
                Confirm Purchase
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingLeaveTargetTab && (
        <div
          data-ui-panel="true"
          role="dialog"
          className="pointer-events-auto fixed inset-0 bg-black/65 flex items-center justify-center z-50"
        >
          <div className="w-[390px] bg-[#0f1726] border border-amber-400 rounded-lg p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-black uppercase text-white">
              Unsaved Paint Changes
            </h3>
            <p className="text-xs text-slate-300">
              You have unsaved 3D brush strokes on your character. Would you like to save your design before leaving the Painting Studio?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingLeaveTargetTab(null)}
                className="px-3 py-2 rounded bg-slate-800 text-xs font-bold text-slate-300"
              >
                Stay in Studio
              </button>
              <button
                type="button"
                onClick={() => {
                  const dest = pendingLeaveTargetTab;
                  setPendingLeaveTargetTab(null);
                  setStudioHasUnsavedChanges(false);
                  onSelectTab(dest);
                }}
                className="px-3 py-2 rounded bg-rose-900 text-xs font-bold text-white"
              >
                Discard & Leave
              </button>
              <button
                type="button"
                onClick={() => {
                  const dest = pendingLeaveTargetTab;
                  onSaveDesign(false);
                  setPendingLeaveTargetTab(null);
                  setStudioHasUnsavedChanges(false);
                  onSelectTab(dest);
                }}
                className="px-3.5 py-2 rounded bg-[#29c5f6] text-slate-950 text-xs font-black"
              >
                Save & Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Toast Banner */}
      {statusToast && (
        <div className="pointer-events-none fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#0f1726]/95 border border-[#29c5f6] text-white px-4 py-2 rounded-full text-xs font-bold shadow-xl">
          {statusToast}
        </div>
      )}
    </div>
  );
};
