import React, { useState, useRef, useCallback } from 'react';
import {
  DEFAULT_HUD_BUTTONS_LAYOUT,
  GameSettings,
  HUD_BUTTON_INFO,
  HudButtonId,
  HudButtonsLayout,
  LOADOUT_PAIRS,
  WEAPON_REGISTRY,
} from '../game/config.ts';
import { soundEngine } from '../audio/soundEngine.ts';
import { HudActionIcon, WeaponIllustration } from './WeaponArtwork.tsx';

export interface HUDLayoutEditorProps {
  settings: GameSettings;
  openedFromSettings?: boolean;
  onSave: (newLayout: HudButtonsLayout, globalScale: number, globalOpacity: number) => void;
  onClose: () => void;
}

export const HUDLayoutEditor: React.FC<HUDLayoutEditorProps> = ({
  settings,
  openedFromSettings = false,
  onSave,
  onClose,
}) => {
  const [layout, setLayout] = useState<HudButtonsLayout>(() => ({
    ...DEFAULT_HUD_BUTTONS_LAYOUT,
    ...(settings.buttonsLayout || {}),
  }));
  const [selectedBtn, setSelectedBtn] = useState<HudButtonId>('fire');
  const [barHidden, setBarHidden] = useState<boolean>(false);

  // Draggable position of the compact mini bar itself
  const [barPos, setBarPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const draggingBar = useRef<boolean>(false);
  const barDragStart = useRef<{ x: number; y: number; origX: number; origY: number }>({
    x: 0,
    y: 0,
    origX: 0,
    origY: 0,
  });

  // Drag tracking for any HUD control element
  const draggingId = useRef<HudButtonId | null>(null);
  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handlePointerDownBtn = (id: HudButtonId, e: React.PointerEvent) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    soundEngine.play('ui_click');
    setSelectedBtn(id);
    draggingId.current = id;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    const cur = layout[id] || DEFAULT_HUD_BUTTONS_LAYOUT[id];
    dragStartOffset.current = { x: cur.offsetX, y: cur.offsetY };
  };

  const handlePointerMoveBtn = (e: React.PointerEvent) => {
    if (!draggingId.current) return;
    const id = draggingId.current;
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;
    const nextX = Math.round(Math.max(-480, Math.min(480, dragStartOffset.current.x + dx)));
    const nextY = Math.round(Math.max(-480, Math.min(480, dragStartOffset.current.y + dy)));

    setLayout((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || DEFAULT_HUD_BUTTONS_LAYOUT[id]),
        offsetX: nextX,
        offsetY: nextY,
      },
    }));
  };

  const handlePointerUpBtn = (e: React.PointerEvent) => {
    if (draggingId.current) {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
      draggingId.current = null;
    }
  };

  // Drag handlers for moving the mini settings bar itself across the screen
  const handleBarDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input')) return;
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    draggingBar.current = true;
    barDragStart.current = {
      x: e.clientX,
      y: e.clientY,
      origX: barPos.x,
      origY: barPos.y,
    };
  };

  const handleBarDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingBar.current) return;
    const dx = e.clientX - barDragStart.current.x;
    const dy = e.clientY - barDragStart.current.y;
    setBarPos({
      x: Math.round(Math.max(-480, Math.min(480, barDragStart.current.origX + dx))),
      y: Math.round(Math.max(-60, Math.min(480, barDragStart.current.origY + dy))),
    });
  };

  const handleBarDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingBar.current) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    draggingBar.current = false;
  };

  const updateSelectedField = useCallback(
    (field: 'scale' | 'opacity', val: number) => {
      setLayout((prev) => {
        const cur = prev[selectedBtn] || DEFAULT_HUD_BUTTONS_LAYOUT[selectedBtn];
        return {
          ...prev,
          [selectedBtn]: {
            ...cur,
            [field]: val,
          },
        };
      });
    },
    [selectedBtn]
  );

  const resetAllToDefault = () => {
    soundEngine.play('ui_click');
    setLayout({ ...DEFAULT_HUD_BUTTONS_LAYOUT });
  };

  const handleSave = () => {
    soundEngine.play('ui_confirm');
    onSave(
      layout,
      settings.hudGlobalScale ?? 1.0,
      settings.hudGlobalOpacity ?? 0.95
    );
    onClose();
  };

  const curItem = layout[selectedBtn] || DEFAULT_HUD_BUTTONS_LAYOUT[selectedBtn];
  const curInfo = HUD_BUTTON_INFO[selectedBtn] || HUD_BUTTON_INFO.fire;

  const getBtnStyle = (id: HudButtonId): React.CSSProperties => {
    const item = layout[id] || DEFAULT_HUD_BUTTONS_LAYOUT[id];
    return {
      transform: `translate3d(${item.offsetX}px, ${item.offsetY}px, 0) scale(${item.scale})`,
      opacity: item.opacity,
    };
  };

  const selectionRing = (id: HudButtonId) =>
    selectedBtn === id
      ? 'border-amber-400 bg-zinc-100/25 ring-2 ring-amber-400 text-white'
      : 'border-white/30 bg-[#111318]/85 hover:border-white/60 text-zinc-200';

  const previewPair = LOADOUT_PAIRS[0].weapons;

  return (
    <div
      role="region"
      aria-label="HUD Layout Customizer"
      className="fixed inset-0 z-50 bg-[#0d0f14]/75 select-none touch-none overflow-hidden"
    >
      {/* Center Crosshair Reference */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center opacity-40">
        <div className="w-7 h-7 border border-white/30 rounded-full flex items-center justify-center">
          <div className="w-1 h-1 rounded-full bg-white" />
        </div>
      </div>

      {/* =================================================================== */}
      {/* TOP DEATHMATCH KILL COUNTER & TIMER (DRAGGABLE & EDITABLE)          */}
      {/* =================================================================== */}
      <div className="fixed inset-x-0 top-3 flex justify-center pointer-events-none z-20">
        <div
          role="button"
          tabIndex={0}
          aria-label="Customize Top Kill Counter"
          onPointerDown={(e) => handlePointerDownBtn('killCounter', e)}
          onPointerMove={handlePointerMoveBtn}
          onPointerUp={handlePointerUpBtn}
          onPointerCancel={handlePointerUpBtn}
          style={getBtnStyle('killCounter')}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-1.5 rounded-xl border cursor-grab active:cursor-grabbing font-mono text-xs ${selectionRing(
            'killCounter'
          )}`}
        >
          <span className="text-emerald-400 font-bold">YOUR KILLS: 12</span>
          <span className="text-zinc-500">|</span>
          <span className="text-amber-300 font-bold">05:00</span>
          <span className="text-zinc-500">|</span>
          <span className="text-rose-400 font-bold">TOP RIVAL: 8</span>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 1. COMPACT, DRAGGABLE, HIDEABLE MINI BAR (SIZE & TRANSPARENCY)      */}
      {/* =================================================================== */}
      <div
        onPointerDown={handleBarDragStart}
        onPointerMove={handleBarDragMove}
        onPointerUp={handleBarDragEnd}
        onPointerCancel={handleBarDragEnd}
        style={{
          transform: `translate3d(calc(-50% + ${barPos.x}px), ${barPos.y}px, 0)`,
        }}
        className="fixed top-16 left-1/2 z-40 w-72 sm:w-80 bg-[#14171d] border border-white/20 rounded-xl shadow-2xl pointer-events-auto cursor-move"
      >
        {/* Compact Drag Header */}
        <div className="flex items-center justify-between gap-1.5 px-3 py-2 border-b border-white/10">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-zinc-500 text-xs select-none" aria-hidden="true">
              ⋮⋮
            </span>
            <span className="font-mono text-xs font-semibold text-amber-300 truncate">
              {curInfo.label}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setBarHidden((h) => !h)}
              className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono text-zinc-200 cursor-pointer"
            >
              {barHidden ? 'Show' : 'Hide'}
            </button>
            <button
              type="button"
              onClick={resetAllToDefault}
              className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono text-zinc-300 cursor-pointer"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.play('ui_click');
                onClose();
              }}
              className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono text-zinc-300 cursor-pointer"
            >
              {openedFromSettings ? 'Back' : 'Close'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-2.5 py-0.5 rounded bg-zinc-100 hover:bg-white text-zinc-950 font-mono font-bold text-[11px] cursor-pointer"
            >
              Save
            </button>
          </div>
        </div>

        {/* Body: Size & Transparency Sliders */}
        {!barHidden && (
          <div className="p-3 flex flex-col gap-2.5 cursor-default">
            <div className="text-[10px] font-mono text-zinc-400">
              Drag any HUD control, gun box, or health bar to move it.
            </div>
            <label className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-zinc-400">Size</span>
                <span className="text-zinc-100 font-semibold tabular-nums">
                  {Math.round(curItem.scale * 100)}%
                </span>
              </div>
              <input
                type="range"
                aria-label="Button Size"
                min={0.5}
                max={1.65}
                step={0.05}
                value={curItem.scale}
                onChange={(e) => updateSelectedField('scale', parseFloat(e.target.value))}
                className="w-full accent-zinc-100 cursor-pointer"
              />
            </label>

            <label className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-zinc-400">Transparency</span>
                <span className="text-zinc-100 font-semibold tabular-nums">
                  {Math.round(curItem.opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                aria-label="Button Transparency"
                min={0.15}
                max={1.0}
                step={0.05}
                value={curItem.opacity}
                onChange={(e) => updateSelectedField('opacity', parseFloat(e.target.value))}
                className="w-full accent-zinc-100 cursor-pointer"
              />
            </label>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 2. DRAGGABLE FULL-SCREEN FPS CONTROLS (1:1 WITH COMBAT HUD)         */}
      {/* =================================================================== */}
      <div className="fixed inset-x-0 bottom-0 p-3 sm:p-5 flex items-end justify-between pointer-events-none z-20">
        {/* LEFT THUMB: Movement Stick */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Customize Move Stick"
          onPointerDown={(e) => handlePointerDownBtn('joystick', e)}
          onPointerMove={handlePointerMoveBtn}
          onPointerUp={handlePointerUpBtn}
          onPointerCancel={handlePointerUpBtn}
          style={getBtnStyle('joystick')}
          className={`pointer-events-auto relative w-30 h-30 sm:w-34 sm:h-34 rounded-full flex items-center justify-center touch-none cursor-grab active:cursor-grabbing border-2 ${selectionRing(
            'joystick'
          )}`}
        >
          <div className="absolute w-14 h-14 rounded-full border border-dashed border-white/20 pointer-events-none" />
          <div className="w-13 h-13 rounded-full bg-zinc-200/80 border-2 border-white pointer-events-none flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-950" />
          </div>
        </div>

        {/* CENTER-BOTTOM: 2 Gun Boxes Above Health Bar + Bottom Health Bar */}
        <div className="flex flex-col items-center gap-2 mx-auto">
          {/* Draggable 2-Gun Boxes */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Customize Weapon Bar"
            onPointerDown={(e) => handlePointerDownBtn('weaponBar', e)}
            onPointerMove={handlePointerMoveBtn}
            onPointerUp={handlePointerUpBtn}
            onPointerCancel={handlePointerUpBtn}
            style={getBtnStyle('weaponBar')}
            className={`pointer-events-auto flex items-center gap-2 p-1 rounded-xl border-2 cursor-grab active:cursor-grabbing ${selectionRing(
              'weaponBar'
            )}`}
          >
            {previewPair.map((wid) => {
              const spec = WEAPON_REGISTRY[wid];
              return (
                <div
                  key={wid}
                  className="w-26 sm:w-28 px-2 py-1 rounded-lg bg-[#111318]/90 border border-white/15 flex flex-col items-center gap-1 pointer-events-none"
                >
                  <WeaponIllustration weaponId={wid} className="w-20 h-7" />
                  <span className="font-mono text-[10px] font-bold text-zinc-200">
                    {spec.magSize} / {spec.reserveMax}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Draggable Bottom-Center Sleek Thin Green Health Line + Side Percentage */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Customize Health Bar"
            onPointerDown={(e) => handlePointerDownBtn('healthBar', e)}
            onPointerMove={handlePointerMoveBtn}
            onPointerUp={handlePointerUpBtn}
            onPointerCancel={handlePointerUpBtn}
            style={getBtnStyle('healthBar')}
            className={`pointer-events-auto rounded-full px-3 py-1.5 border-2 cursor-grab active:cursor-grabbing flex items-center gap-2.5 ${selectionRing(
              'healthBar'
            )}`}
          >
            <div className="h-2 w-44 sm:w-52 bg-zinc-900 rounded-full overflow-hidden pointer-events-none">
              <div className="h-full w-full bg-emerald-400" />
            </div>
            <span className="font-mono text-xs font-black text-emerald-400 pointer-events-none">
              100%
            </span>
          </div>
        </div>

        {/* RIGHT THUMB: Icon-Only FPS Action Cluster */}
        <div className="pointer-events-auto relative w-60 h-52 sm:w-68 sm:h-56 overflow-visible touch-none">
          {/* 1. SLIDE */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Customize Slide Button"
            onPointerDown={(e) => handlePointerDownBtn('slide', e)}
            onPointerMove={handlePointerMoveBtn}
            onPointerUp={handlePointerUpBtn}
            onPointerCancel={handlePointerUpBtn}
            style={getBtnStyle('slide')}
            className={`absolute bottom-2 right-48 w-12 h-12 sm:w-13 sm:h-13 rounded-full flex items-center justify-center border-2 cursor-grab active:cursor-grabbing ${selectionRing(
              'slide'
            )}`}
          >
            <HudActionIcon kind="slide" className="w-6 h-6" />
          </div>

          {/* 2. CROUCH */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Customize Crouch Button"
            onPointerDown={(e) => handlePointerDownBtn('crouch', e)}
            onPointerMove={handlePointerMoveBtn}
            onPointerUp={handlePointerUpBtn}
            onPointerCancel={handlePointerUpBtn}
            style={getBtnStyle('crouch')}
            className={`absolute bottom-16 right-42 w-12 h-12 rounded-full flex items-center justify-center border-2 cursor-grab active:cursor-grabbing ${selectionRing(
              'crouch'
            )}`}
          >
            <HudActionIcon kind="crouch" className="w-6 h-6" />
          </div>

          {/* 3. JUMP */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Customize Jump Button"
            onPointerDown={(e) => handlePointerDownBtn('jump', e)}
            onPointerMove={handlePointerMoveBtn}
            onPointerUp={handlePointerUpBtn}
            onPointerCancel={handlePointerUpBtn}
            style={getBtnStyle('jump')}
            className={`absolute bottom-2 right-28 w-13 h-13 rounded-full flex items-center justify-center border-2 cursor-grab active:cursor-grabbing ${selectionRing(
              'jump'
            )}`}
          >
            <HudActionIcon kind="jump" className="w-6 h-6" />
          </div>

          {/* 4. RELOAD */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Customize Reload Button"
            onPointerDown={(e) => handlePointerDownBtn('reload', e)}
            onPointerMove={handlePointerMoveBtn}
            onPointerUp={handlePointerUpBtn}
            onPointerCancel={handlePointerUpBtn}
            style={getBtnStyle('reload')}
            className={`absolute bottom-[82px] right-[108px] w-13 h-13 rounded-full flex items-center justify-center border-2 cursor-grab active:cursor-grabbing ${selectionRing(
              'reload'
            )}`}
          >
            <HudActionIcon kind="reload" className="w-6 h-6" />
          </div>

          {/* 5. SCOPE / ADS */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Customize Scope Button"
            onPointerDown={(e) => handlePointerDownBtn('ads', e)}
            onPointerMove={handlePointerMoveBtn}
            onPointerUp={handlePointerUpBtn}
            onPointerCancel={handlePointerUpBtn}
            style={getBtnStyle('ads')}
            className={`absolute bottom-[112px] right-3 w-14 h-14 rounded-full flex items-center justify-center border-2 cursor-grab active:cursor-grabbing ${selectionRing(
              'ads'
            )}`}
          >
            <HudActionIcon kind="ads" className="w-7 h-7" />
          </div>

          {/* 6. FIRE JOYSTICK BUTTON */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Customize Fire Button"
            onPointerDown={(e) => handlePointerDownBtn('fire', e)}
            onPointerMove={handlePointerMoveBtn}
            onPointerUp={handlePointerUpBtn}
            onPointerCancel={handlePointerUpBtn}
            style={getBtnStyle('fire')}
            className={`absolute bottom-3.5 right-3.5 w-22 h-22 rounded-full flex items-center justify-center border-2 cursor-grab active:cursor-grabbing ${selectionRing(
              'fire'
            )}`}
          >
            <div className="w-14 h-14 rounded-full bg-zinc-100 text-zinc-950 flex items-center justify-center pointer-events-none">
              <HudActionIcon kind="fire" className="w-7 h-7" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
