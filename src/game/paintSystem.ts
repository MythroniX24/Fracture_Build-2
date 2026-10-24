import type { CharacterId } from './config.ts';
import {
  BODY_REGION_ORDER,
  BODY_REGION_SPECS,
  type BodyRegionId,
  findBodyRegionAtUV,
  getSymmetryMirroredUV,
  isDesignCompatibleWithCharacter,
  mapLocalUvToRegionAtlas,
} from './characterSystem.ts';

export const PAINT_ATLAS_SIZE = 512;
export const MAX_UNDO_STEPS = 18;
export const MAX_SAVED_DESIGNS = 24;

export type PaintToolId =
  | 'brush'
  | 'soft_airbrush'
  | 'marker_pen'
  | 'paint_splatter'
  | 'shade_burn'
  | 'highlight_dodge'
  | 'soft_blend'
  | 'edge_wear'
  | 'bucket'
  | 'gradient_fill'
  | 'stripe_stamp'
  | 'camo_stamp'
  | 'rect'
  | 'circle'
  | 'line'
  | 'eraser'
  | 'eyedropper';

export interface BrushSettings {
  tool: PaintToolId;
  colorHex: string; // '#rrggbb'
  size: number; // radius in UV atlas pixels (2..64)
  opacity: number; // 0.05..1.0
  hardness: number; // 0.0..1.0
  flow: number; // 0.1..1.0
  symmetry: boolean; // Mirror across X axis & left/right limbs
  smoothing: number; // 0..0.85 stroke stabilization
  isolatedRegion: BodyRegionId | 'all';
}

export const DEFAULT_BRUSH_SETTINGS: BrushSettings = {
  tool: 'brush',
  colorHex: '#ef4444',
  size: 14,
  opacity: 1.0,
  hardness: 0.78,
  flow: 1.0,
  symmetry: false,
  smoothing: 0.35,
  isolatedRegion: 'all',
};

export const PRESET_PAINT_SWATCHES: string[] = [
  '#ef4444', // Crimson Red
  '#f97316', // Tactical Orange
  '#facc15', // Hazard Yellow
  '#22c55e', // Prism Emerald
  '#06b6d4', // Cyan Pulse
  '#3b82f6', // Cobalt Blue
  '#8b5cf6', // Electric Violet
  '#ec4899', // Magenta Strike
  '#111827', // Carbon Black
  '#475569', // Gunmetal Slate
  '#94a3b8', // Titanium Grey
  '#ffffff', // Pure Base White
];

export interface SortedColorPaletteGroup {
  id: 'vibrant' | 'tactical' | 'shading' | 'accents';
  label: string;
  subtitle: string;
  swatches: { hex: string; name: string }[];
}

export const SORTED_COLOR_PALETTES: SortedColorPaletteGroup[] = [
  {
    id: 'vibrant',
    label: 'Vibrant Splash & Neon',
    subtitle: 'High-saturation studio primary paints',
    swatches: [
      { hex: '#ef4444', name: 'Crimson Strike' },
      { hex: '#f97316', name: 'Solar Orange' },
      { hex: '#facc15', name: 'Volt Yellow' },
      { hex: '#22c55e', name: 'Venom Emerald' },
      { hex: '#06b6d4', name: 'Cyan Pulse' },
      { hex: '#1877f2', name: 'Cobalt Splash' },
      { hex: '#6366f1', name: 'Hyper Indigo' },
      { hex: '#8b5cf6', name: 'Rift Violet' },
      { hex: '#ec4899', name: 'Neon Magenta' },
      { hex: '#14b8a6', name: 'Bio Teal' },
      { hex: '#84cc16', name: 'Acid Lime' },
      { hex: '#f43f5e', name: 'Ruby Flare' },
    ],
  },
  {
    id: 'tactical',
    label: 'Tactical & Spec-Ops Camo',
    subtitle: 'Field armor, matte olive, desert & navy tones',
    swatches: [
      { hex: '#1e3a8a', name: 'Deep Navy' },
      { hex: '#1d4ed8', name: 'Tactical Royal' },
      { hex: '#0f766e', name: 'Deep Recon Teal' },
      { hex: '#15803d', name: 'Jungle Olive' },
      { hex: '#3f6212', name: 'Moss Camo' },
      { hex: '#854d0e', name: 'Coyote Tan' },
      { hex: '#b45309', name: 'Desert Ochre' },
      { hex: '#991b1b', name: 'Blood Oxide' },
      { hex: '#4c1d95', name: 'Night Ops Plum' },
      { hex: '#334155', name: 'Armor Slate' },
      { hex: '#1e293b', name: 'Stealth Cobalt' },
      { hex: '#57534e', name: 'Warm Stone' },
    ],
  },
  {
    id: 'shading',
    label: 'Shading, Shadows & Highlights',
    subtitle: 'Contour shadows, ambient occlusion & pure rim highlights',
    swatches: [
      { hex: '#ffffff', name: 'Pure Specular White' },
      { hex: '#f1f5f9', name: 'Soft Highlight Ice' },
      { hex: '#cbd5e1', name: 'Light Contour Silver' },
      { hex: '#94a3b8', name: 'Midtone Cool Grey' },
      { hex: '#64748b', name: 'Panel Seam Grey' },
      { hex: '#475569', name: 'Gunmetal Shade' },
      { hex: '#334155', name: 'Deep Armor Shadow' },
      { hex: '#1e293b', name: 'Dark Crevice Blue-Grey' },
      { hex: '#0f172a', name: 'Ambient Occlusion Navy' },
      { hex: '#18181b', name: 'Carbon Matte Black' },
      { hex: '#27272a', name: 'Graphite Core' },
      { hex: '#09090b', name: 'Abyss Black' },
    ],
  },
  {
    id: 'accents',
    label: 'Metallic & Visor Accents',
    subtitle: 'Gold trim, bronze plates, ice blue & visor glows',
    swatches: [
      { hex: '#fde047', name: 'Chrome Gold' },
      { hex: '#f59e0b', name: 'Amber Hazard' },
      { hex: '#d97706', name: 'Anodized Bronze' },
      { hex: '#38bdf8', name: 'Sky Visor Glow' },
      { hex: '#60a5fa', name: 'Arc Blue' },
      { hex: '#a78bfa', name: 'Plasma Lavender' },
      { hex: '#f472b6', name: 'Sakura Pink' },
      { hex: '#fb7185', name: 'Coral Accent' },
    ],
  },
];

export interface ShadingToneStep {
  id: 'deep_shadow' | 'dark_shade' | 'base' | 'light_tint' | 'specular';
  label: string;
  hex: string;
}

export interface PaintLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number; // 0..1
  /** RGBA pixel buffer of size PAINT_ATLAS_SIZE * PAINT_ATLAS_SIZE * 4 */
  data: Uint8ClampedArray;
}

export interface SerializedPaintLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  /** RLE compressed base64 or data URL of the layer RGBA buffer */
  rleBase64: string;
}

export interface SavedPaintDesign {
  id: string;
  name: string;
  characterId: CharacterId;
  uvLayoutId: 'chameleon_humanoid_v1';
  createdAt: number;
  updatedAt: number;
  isSample?: boolean;
  layers: SerializedPaintLayer[];
  /** Composite RGBA RLE for fast thumbnail & gameplay texture reconstruction */
  compositeRleBase64: string;
  primaryColors: string[];
}

export interface PaintWorkspaceHistoryEntry {
  layers: PaintLayer[];
  activeLayerId: string;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0;
    const g = parseInt(clean[1] + clean[1], 16) || 0;
    const b = parseInt(clean[2] + clean[2], 16) || 0;
    return { r, g, b };
  }
  const full = clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Generates a 5-step graduated shading strip (Deep Shadow -> Dark Shade -> Base -> Light Tint -> Specular Highlight)
 * for any active hex color so artists can shade and highlight 3D surfaces with one click.
 */
export function generateShadingTonesForHex(baseHex: string): ShadingToneStep[] {
  const { r, g, b } = hexToRgb(baseHex);
  const mix = (tr: number, tg: number, tb: number, t: number) =>
    rgbToHex(r + (tr - r) * t, g + (tg - g) * t, b + (tb - b) * t);

  return [
    { id: 'deep_shadow', label: 'Deep Shadow', hex: mix(12, 18, 34, 0.68) },
    { id: 'dark_shade', label: 'Dark Shade', hex: mix(18, 24, 42, 0.38) },
    { id: 'base', label: 'Base Tone', hex: rgbToHex(r, g, b) },
    { id: 'light_tint', label: 'Light Tint', hex: mix(255, 255, 255, 0.38) },
    { id: 'specular', label: 'Highlight', hex: mix(255, 255, 255, 0.74) },
  ];
}

export function createEmptyLayer(id: string, name: string): PaintLayer {
  return {
    id,
    name,
    visible: true,
    opacity: 1.0,
    data: new Uint8ClampedArray(PAINT_ATLAS_SIZE * PAINT_ATLAS_SIZE * 4),
  };
}

export function clonePaintLayer(layer: PaintLayer): PaintLayer {
  return {
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    opacity: layer.opacity,
    data: new Uint8ClampedArray(layer.data),
  };
}

/**
 * Checks if a pixel coordinate (px, py) in [0..PAINT_ATLAS_SIZE-1] is allowed
 * given an optional isolated body region filter.
 */
function isPixelInAllowedRegion(
  px: number,
  py: number,
  allowedRegion: BodyRegionId | 'all'
): boolean {
  if (allowedRegion === 'all') return true;
  const spec = BODY_REGION_SPECS[allowedRegion];
  if (!spec) return true;
  const u = (px + 0.5) / PAINT_ATLAS_SIZE;
  const v = 1.0 - (py + 0.5) / PAINT_ATLAS_SIZE;
  return (
    u >= spec.uvRect.uMin &&
    u <= spec.uvRect.uMax &&
    v >= spec.uvRect.vMin &&
    v <= spec.uvRect.vMax
  );
}

/**
 * Deterministic fast hash in [0..1] for organic splatter & stipple edge wear brushes.
 */
function hashPixel2D(px: number, py: number, seed: number): number {
  let n = (px * 374761393 + py * 668265263 + seed * 1442695041) | 0;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

/**
 * Applies a single circular brush, shading, blending, splatter, or eraser dab at UV (u, v) in [0..1] onto a PaintLayer.
 * Note: Three.js CanvasTexture has flipY = true by default, so v=1 maps to py=0 and v=0 maps to py=height-1.
 */
export function applyBrushDabToLayer(
  layer: PaintLayer,
  u: number,
  v: number,
  settings: BrushSettings,
  overrideRegionFilter?: BodyRegionId | 'all'
): void {
  const tool = settings.tool;
  const rawSize = Math.max(1, Math.min(80, settings.size));
  const size =
    tool === 'marker_pen'
      ? Math.max(1.5, rawSize * 0.55)
      : tool === 'paint_splatter'
        ? Math.min(84, rawSize * 1.35)
        : rawSize;

  const cx = u * PAINT_ATLAS_SIZE;
  const cy = (1.0 - v) * PAINT_ATLAS_SIZE;
  const rSq = size * size;

  const effectiveHardness =
    tool === 'soft_airbrush' || tool === 'shade_burn' || tool === 'highlight_dodge' || tool === 'soft_blend'
      ? Math.min(0.25, settings.hardness * 0.35)
      : tool === 'marker_pen'
        ? Math.max(0.92, settings.hardness)
        : Math.max(0, Math.min(0.99, settings.hardness));

  const innerRadius = size * effectiveHardness;
  const falloffSpan = Math.max(0.5, size - innerRadius);

  const isEraser = tool === 'eraser';
  const { r, g, b } = hexToRgb(settings.colorHex);
  const baseStrength = Math.max(0.02, Math.min(1, settings.opacity * settings.flow));
  const strength =
    tool === 'soft_airbrush'
      ? baseStrength * 0.42
      : tool === 'shade_burn' || tool === 'highlight_dodge'
        ? baseStrength * 0.36
        : tool === 'soft_blend'
          ? baseStrength * 0.55
          : baseStrength;

  const regionFilter = overrideRegionFilter ?? settings.isolatedRegion;

  const minX = Math.max(0, Math.floor(cx - size));
  const maxX = Math.min(PAINT_ATLAS_SIZE - 1, Math.ceil(cx + size));
  const minY = Math.max(0, Math.floor(cy - size));
  const maxY = Math.min(PAINT_ATLAS_SIZE - 1, Math.ceil(cy + size));

  const data = layer.data;

  // Special pass for 'soft_blend' (Smudge / Smooth Shading Blender):
  // Averages a 3x3 neighborhood around each pixel inside the brush radius so transitions become silky smooth.
  if (tool === 'soft_blend') {
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const snapshot = new Uint8ClampedArray(width * height * 4);
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const srcIdx = (py * PAINT_ATLAS_SIZE + px) * 4;
        const dstIdx = ((py - minY) * width + (px - minX)) * 4;
        snapshot[dstIdx] = data[srcIdx];
        snapshot[dstIdx + 1] = data[srcIdx + 1];
        snapshot[dstIdx + 2] = data[srcIdx + 2];
        snapshot[dstIdx + 3] = data[srcIdx + 3];
      }
    }

    for (let py = minY; py <= maxY; py++) {
      const dy = py - cy;
      for (let px = minX; px <= maxX; px++) {
        const dx = px - cx;
        const distSq = dx * dx + dy * dy;
        if (distSq > rSq) continue;
        if (!isPixelInAllowedRegion(px, py, regionFilter)) continue;

        const dist = Math.sqrt(distSq);
        const radial = Math.max(0, 1.0 - dist / size);
        const blendFactor = radial * radial * strength;
        if (blendFactor <= 0.01) continue;

        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let sumA = 0;
        let count = 0;

        for (let ny = Math.max(minY, py - 1); ny <= Math.min(maxY, py + 1); ny++) {
          for (let nx = Math.max(minX, px - 1); nx <= Math.min(maxX, px + 1); nx++) {
            const sIdx = ((ny - minY) * width + (nx - minX)) * 4;
            const a = snapshot[sIdx + 3] / 255;
            // Treat unpainted pixels as pure white (255,255,255) during color average so shading blends naturally onto white armor
            const effR = snapshot[sIdx] * a + 255 * (1 - a);
            const effG = snapshot[sIdx + 1] * a + 255 * (1 - a);
            const effB = snapshot[sIdx + 2] * a + 255 * (1 - a);
            sumR += effR;
            sumG += effG;
            sumB += effB;
            sumA += a;
            count++;
          }
        }

        if (count > 0 && sumA > 0.01) {
          const avgR = sumR / count;
          const avgG = sumG / count;
          const avgB = sumB / count;
          const avgA = sumA / count;
          const idx = (py * PAINT_ATLAS_SIZE + px) * 4;
          const curA = data[idx + 3] / 255;
          const curR = data[idx] * curA + 255 * (1 - curA);
          const curG = data[idx + 1] * curA + 255 * (1 - curA);
          const curB = data[idx + 2] * curA + 255 * (1 - curA);

          data[idx] = Math.round(curR + (avgR - curR) * blendFactor);
          data[idx + 1] = Math.round(curG + (avgG - curG) * blendFactor);
          data[idx + 2] = Math.round(curB + (avgB - curB) * blendFactor);
          data[idx + 3] = Math.round(Math.max(curA, avgA * blendFactor) * 255);
        }
      }
    }
    return;
  }

  const seed = Math.round(cx * 31 + cy * 97);

  for (let py = minY; py <= maxY; py++) {
    const dy = py - cy;
    const dySq = dy * dy;
    for (let px = minX; px <= maxX; px++) {
      const dx = px - cx;
      const distSq = dx * dx + dySq;
      if (distSq > rSq) continue;
      if (!isPixelInAllowedRegion(px, py, regionFilter)) continue;

      const dist = Math.sqrt(distSq);
      let radialAlpha =
        dist <= innerRadius ? 1.0 : Math.max(0, 1.0 - (dist - innerRadius) / falloffSpan);

      if (tool === 'soft_airbrush' || tool === 'shade_burn' || tool === 'highlight_dodge') {
        const norm = Math.min(1, dist / size);
        const smoothCos = 0.5 * (1 + Math.cos(norm * Math.PI));
        radialAlpha = smoothCos * smoothCos;
      } else if (tool === 'paint_splatter') {
        // Organic central splash + satellite paint droplets
        const angle = Math.atan2(dy, dx);
        const lobeWave =
          0.58 +
          0.22 * Math.sin(angle * 5 + seed * 0.1) +
          0.16 * Math.cos(angle * 9 - seed * 0.07);
        const normDist = dist / size;
        if (normDist <= lobeWave) {
          radialAlpha = 1.0;
        } else {
          // Satellite droplet clusters in outer ring
          const cellX = Math.floor(px / 3);
          const cellY = Math.floor(py / 3);
          const dropNoise = hashPixel2D(cellX, cellY, seed);
          radialAlpha = dropNoise > 0.82 && normDist < 0.98 ? 0.95 : 0;
        }
      } else if (tool === 'edge_wear') {
        // Textured stipple contour / ambient occlusion edge brush
        const stipple = hashPixel2D(px, py, seed);
        const rimBand = 1.0 - Math.abs(dist / size - 0.55) * 1.6;
        radialAlpha = stipple > 0.35 ? Math.max(0, rimBand) * radialAlpha : 0;
      }

      const dabAlpha = radialAlpha * strength;
      if (dabAlpha <= 0.002) continue;

      const idx = (py * PAINT_ATLAS_SIZE + px) * 4;
      const dstA = data[idx + 3] / 255;

      if (isEraser) {
        // Reduce alpha smoothly on the active layer; compositing reveals pure white beneath
        const newA = Math.max(0, dstA * (1.0 - dabAlpha));
        data[idx + 3] = Math.round(newA * 255);
        if (data[idx + 3] === 0) {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
        }
      } else if (tool === 'shade_burn') {
        // 3D Contour Shading / Burn Brush:
        // Darkens the existing pixel (or white base if unpainted) toward a deep shadow tone
        const curR = dstA > 0.01 ? data[idx] * dstA + 255 * (1 - dstA) : 255;
        const curG = dstA > 0.01 ? data[idx + 1] * dstA + 255 * (1 - dstA) : 255;
        const curB = dstA > 0.01 ? data[idx + 2] * dstA + 255 * (1 - dstA) : 255;
        const shadeTargetR = Math.min(curR * 0.42, r * 0.38);
        const shadeTargetG = Math.min(curG * 0.42, g * 0.38);
        const shadeTargetB = Math.min(curB * 0.45, b * 0.42);
        const outA = Math.min(1, dstA + dabAlpha * (1 - dstA));
        if (outA > 1e-5) {
          data[idx] = Math.max(0, Math.round(curR + (shadeTargetR - curR) * dabAlpha));
          data[idx + 1] = Math.max(0, Math.round(curG + (shadeTargetG - curG) * dabAlpha));
          data[idx + 2] = Math.max(0, Math.round(curB + (shadeTargetB - curB) * dabAlpha));
          data[idx + 3] = Math.round(outA * 255);
        }
      } else if (tool === 'highlight_dodge') {
        // 3D Specular / Rim Highlight Brush:
        // Lifts and brightens existing paint toward a luminous highlight tint
        const curR = dstA > 0.01 ? data[idx] * dstA + 255 * (1 - dstA) : 235;
        const curG = dstA > 0.01 ? data[idx + 1] * dstA + 255 * (1 - dstA) : 240;
        const curB = dstA > 0.01 ? data[idx + 2] * dstA + 255 * (1 - dstA) : 250;
        const hiTargetR = Math.min(255, Math.max(curR, r) + (255 - Math.max(curR, r)) * 0.65);
        const hiTargetG = Math.min(255, Math.max(curG, g) + (255 - Math.max(curG, g)) * 0.65);
        const hiTargetB = Math.min(255, Math.max(curB, b) + (255 - Math.max(curB, b)) * 0.65);
        const outA = Math.min(1, dstA + dabAlpha * (1 - dstA));
        if (outA > 1e-5) {
          data[idx] = Math.min(255, Math.round(curR + (hiTargetR - curR) * dabAlpha));
          data[idx + 1] = Math.min(255, Math.round(curG + (hiTargetG - curG) * dabAlpha));
          data[idx + 2] = Math.min(255, Math.round(curB + (hiTargetB - curB) * dabAlpha));
          data[idx + 3] = Math.round(outA * 255);
        }
      } else {
        // Porter-Duff source-over alpha blending onto active layer
        const outA = dabAlpha + dstA * (1.0 - dabAlpha);
        if (outA > 1e-5) {
          const dstR = data[idx];
          const dstG = data[idx + 1];
          const dstB = data[idx + 2];
          data[idx] = Math.round((r * dabAlpha + dstR * dstA * (1.0 - dabAlpha)) / outA);
          data[idx + 1] = Math.round((g * dabAlpha + dstG * dstA * (1.0 - dabAlpha)) / outA);
          data[idx + 2] = Math.round((b * dabAlpha + dstB * dstA * (1.0 - dabAlpha)) / outA);
          data[idx + 3] = Math.round(outA * 255);
        }
      }
    }
  }
}

/**
 * Draws a continuous interpolated stroke segment from (u0, v0) to (u1, v1) on a layer,
 * including automatic bilateral symmetry if enabled.
 */
export function applyBrushStrokeSegment(
  layer: PaintLayer,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  settings: BrushSettings,
  hitRegionId?: BodyRegionId | null
): void {
  // Check if stroke swaps across incompatible UV islands (avoid drawing a long line across atlas space)
  const reg0 = hitRegionId || findBodyRegionAtUV(u0, v0);
  const reg1 = findBodyRegionAtUV(u1, v1);
  const uvJump = Math.hypot(u1 - u0, v1 - v0);

  const effectiveFilter =
    settings.isolatedRegion !== 'all'
      ? settings.isolatedRegion
      : reg1 || reg0 || 'all';

  if (settings.isolatedRegion !== 'all' && reg1 && reg1 !== settings.isolatedRegion) {
    return;
  }

  // If the stroke jumps across separate UV islands (> 0.18 UV units), just stamp at (u1, v1)
  if (uvJump > 0.18 || (reg0 && reg1 && reg0 !== reg1)) {
    applyBrushDabToLayer(layer, u1, v1, settings, effectiveFilter);
    if (settings.symmetry) {
      const sym = getSymmetryMirroredUV(u1, v1, reg1 || reg0);
      const symFilter =
        settings.isolatedRegion !== 'all'
          ? BODY_REGION_SPECS[settings.isolatedRegion].mirrorRegionId
          : sym.regionId || 'all';
      applyBrushDabToLayer(layer, sym.u, sym.v, settings, symFilter);
    }
    return;
  }

  const distPx = uvJump * PAINT_ATLAS_SIZE;
  const stepMultiplier = settings.tool === 'paint_splatter' ? 0.65 : 0.25;
  const stepPx = Math.max(1.2, settings.size * stepMultiplier);
  const steps = Math.max(1, Math.ceil(distPx / stepPx));

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = u0 + (u1 - u0) * t;
    const v = v0 + (v1 - v0) * t;
    applyBrushDabToLayer(layer, u, v, settings, effectiveFilter);

    if (settings.symmetry) {
      const sym = getSymmetryMirroredUV(u, v, reg1 || reg0);
      const symFilter =
        settings.isolatedRegion !== 'all'
          ? BODY_REGION_SPECS[settings.isolatedRegion].mirrorRegionId
          : sym.regionId || 'all';
      applyBrushDabToLayer(layer, sym.u, sym.v, settings, symFilter);
    }
  }
}

/**
 * Fills a target body region with the selected colour and opacity.
 */
export function applyBucketFillToLayer(
  layer: PaintLayer,
  u: number,
  v: number,
  settings: BrushSettings,
  hitRegionId?: BodyRegionId | null
): void {
  const region = hitRegionId || findBodyRegionAtUV(u, v);
  if (!region) return;
  if (settings.isolatedRegion !== 'all' && region !== settings.isolatedRegion) return;

  const fillRegion = (targetRegion: BodyRegionId) => {
    const rect = BODY_REGION_SPECS[targetRegion].uvRect;
    const minX = Math.max(0, Math.floor(rect.uMin * PAINT_ATLAS_SIZE));
    const maxX = Math.min(PAINT_ATLAS_SIZE - 1, Math.ceil(rect.uMax * PAINT_ATLAS_SIZE));
    const minY = Math.max(0, Math.floor((1.0 - rect.vMax) * PAINT_ATLAS_SIZE));
    const maxY = Math.min(PAINT_ATLAS_SIZE - 1, Math.ceil((1.0 - rect.vMin) * PAINT_ATLAS_SIZE));

    const { r, g, b } = hexToRgb(settings.colorHex);
    const alpha = Math.max(0.05, Math.min(1, settings.opacity));
    const data = layer.data;

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const idx = (py * PAINT_ATLAS_SIZE + px) * 4;
        const dstA = data[idx + 3] / 255;
        const outA = alpha + dstA * (1.0 - alpha);
        if (outA > 1e-5) {
          data[idx] = Math.round((r * alpha + data[idx] * dstA * (1.0 - alpha)) / outA);
          data[idx + 1] = Math.round((g * alpha + data[idx + 1] * dstA * (1.0 - alpha)) / outA);
          data[idx + 2] = Math.round((b * alpha + data[idx + 2] * dstA * (1.0 - alpha)) / outA);
          data[idx + 3] = Math.round(outA * 255);
        }
      }
    }
  };

  fillRegion(region);
  if (settings.symmetry) {
    const mirrorReg = BODY_REGION_SPECS[region].mirrorRegionId;
    if (mirrorReg !== region) {
      fillRegion(mirrorReg);
    }
  }
}

/**
 * Fills a target body region with a smooth vertical 3D zenithal shading gradient
 * (bright top highlight -> rich midtone base -> deep lower contour shadow).
 */
export function applyGradientFillToLayer(
  layer: PaintLayer,
  u: number,
  v: number,
  settings: BrushSettings,
  hitRegionId?: BodyRegionId | null
): void {
  const region = hitRegionId || findBodyRegionAtUV(u, v);
  if (!region) return;
  if (settings.isolatedRegion !== 'all' && region !== settings.isolatedRegion) return;

  const tones = generateShadingTonesForHex(settings.colorHex);
  const topColor = hexToRgb(tones[3].hex); // Light Tint at top of limb/torso
  const midColor = hexToRgb(tones[2].hex); // Base color in middle
  const botColor = hexToRgb(tones[0].hex); // Deep shadow at bottom of limb/torso
  const alpha = Math.max(0.05, Math.min(1, settings.opacity));
  const data = layer.data;

  const fillRegionGradient = (targetRegion: BodyRegionId) => {
    const rect = BODY_REGION_SPECS[targetRegion].uvRect;
    const minX = Math.max(0, Math.floor(rect.uMin * PAINT_ATLAS_SIZE));
    const maxX = Math.min(PAINT_ATLAS_SIZE - 1, Math.ceil(rect.uMax * PAINT_ATLAS_SIZE));
    const minY = Math.max(0, Math.floor((1.0 - rect.vMax) * PAINT_ATLAS_SIZE));
    const maxY = Math.min(PAINT_ATLAS_SIZE - 1, Math.ceil((1.0 - rect.vMin) * PAINT_ATLAS_SIZE));
    const spanY = Math.max(1, maxY - minY);
    const spanX = Math.max(1, maxX - minX);

    for (let py = minY; py <= maxY; py++) {
      // t = 0 at top of region, t = 1 at bottom of region
      const ty = (py - minY) / spanY;
      let gradR: number;
      let gradG: number;
      let gradB: number;
      if (ty < 0.5) {
        const k = ty * 2;
        gradR = topColor.r + (midColor.r - topColor.r) * k;
        gradG = topColor.g + (midColor.g - topColor.g) * k;
        gradB = topColor.b + (midColor.b - topColor.b) * k;
      } else {
        const k = (ty - 0.5) * 2;
        gradR = midColor.r + (botColor.r - midColor.r) * k;
        gradG = midColor.g + (botColor.g - midColor.g) * k;
        gradB = midColor.b + (botColor.b - midColor.b) * k;
      }

      for (let px = minX; px <= maxX; px++) {
        // Subtle cylindrical horizontal contour shading (brighter center, slightly shaded edges)
        const tx = (px - minX) / spanX;
        const cylShade = 1.0 - Math.pow(Math.abs(tx - 0.5) * 2, 2) * 0.18;
        const r = Math.round(gradR * cylShade);
        const g = Math.round(gradG * cylShade);
        const b = Math.round(gradB * cylShade);

        const idx = (py * PAINT_ATLAS_SIZE + px) * 4;
        const dstA = data[idx + 3] / 255;
        const outA = alpha + dstA * (1.0 - alpha);
        if (outA > 1e-5) {
          data[idx] = Math.round((r * alpha + data[idx] * dstA * (1.0 - alpha)) / outA);
          data[idx + 1] = Math.round((g * alpha + data[idx + 1] * dstA * (1.0 - alpha)) / outA);
          data[idx + 2] = Math.round((b * alpha + data[idx + 2] * dstA * (1.0 - alpha)) / outA);
          data[idx + 3] = Math.round(outA * 255);
        }
      }
    }
  };

  fillRegionGradient(region);
  if (settings.symmetry) {
    const mirrorReg = BODY_REGION_SPECS[region].mirrorRegionId;
    if (mirrorReg !== region) {
      fillRegionGradient(mirrorReg);
    }
  }
}

/**
 * Stamps a geometric shape ('rect', 'circle', 'stripe_stamp', or 'camo_stamp') centered at (u, v)
 * onto the active layer, respecting body region boundaries and symmetry.
 */
export function applyGeometricShapeToLayer(
  layer: PaintLayer,
  u: number,
  v: number,
  shape: 'rect' | 'circle' | 'stripe_stamp' | 'camo_stamp',
  settings: BrushSettings,
  hitRegionId?: BodyRegionId | null
): void {
  const region = hitRegionId || findBodyRegionAtUV(u, v);
  if (settings.isolatedRegion !== 'all' && region && region !== settings.isolatedRegion) {
    return;
  }
  const filterRegion =
    settings.isolatedRegion !== 'all' ? settings.isolatedRegion : region || 'all';

  const stampSingle = (tu: number, tv: number, allowedReg: BodyRegionId | 'all') => {
    const cx = Math.round(tu * PAINT_ATLAS_SIZE);
    const cy = Math.round((1.0 - tv) * PAINT_ATLAS_SIZE);
    const radius = Math.max(4, Math.round(settings.size * 1.45));
    const { r, g, b } = hexToRgb(settings.colorHex);
    const alpha = Math.max(0.05, Math.min(1, settings.opacity));
    const data = layer.data;

    const minX = Math.max(0, cx - radius);
    const maxX = Math.min(PAINT_ATLAS_SIZE - 1, cx + radius);
    const minY = Math.max(0, cy - radius);
    const maxY = Math.min(PAINT_ATLAS_SIZE - 1, cy + radius);

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        if (!isPixelInAllowedRegion(px, py, allowedReg)) continue;
        const dx = px - cx;
        const dy = py - cy;

        let inside = false;
        if (shape === 'rect') {
          inside = Math.abs(dx) <= radius && Math.abs(dy) <= Math.round(radius * 0.72);
        } else if (shape === 'circle') {
          const dist = Math.hypot(dx, dy);
          inside = dist <= radius && dist >= radius * 0.48;
        } else if (shape === 'stripe_stamp') {
          // Tactical triple diagonal chevron/stripe pattern
          const diag = (dx + dy * 0.65) % 12;
          inside = Math.abs(dy) <= radius * 0.6 && Math.abs(dx) <= radius && Math.abs(diag) < 5;
        } else if (shape === 'camo_stamp') {
          // Tactical angular shard / hex camo pattern
          const qx = Math.abs(dx);
          const qy = Math.abs(dy);
          const hexDist = Math.max(qx * 0.866 + qy * 0.5, qy);
          const shardSub = ((dx * 3 + dy * 5) & 15) < 9;
          inside = hexDist <= radius * 0.92 && shardSub;
        }
        if (!inside) continue;

        const idx = (py * PAINT_ATLAS_SIZE + px) * 4;
        const dstA = data[idx + 3] / 255;
        const outA = alpha + dstA * (1.0 - alpha);
        if (outA > 1e-5) {
          data[idx] = Math.round((r * alpha + data[idx] * dstA * (1.0 - alpha)) / outA);
          data[idx + 1] = Math.round((g * alpha + data[idx + 1] * dstA * (1.0 - alpha)) / outA);
          data[idx + 2] = Math.round((b * alpha + data[idx + 2] * dstA * (1.0 - alpha)) / outA);
          data[idx + 3] = Math.round(outA * 255);
        }
      }
    }
  };

  stampSingle(u, v, filterRegion);
  if (settings.symmetry) {
    const sym = getSymmetryMirroredUV(u, v, region);
    const symFilter =
      settings.isolatedRegion !== 'all'
        ? BODY_REGION_SPECS[settings.isolatedRegion].mirrorRegionId
        : sym.regionId || 'all';
    stampSingle(sym.u, sym.v, symFilter);
  }
}

/**
 * Composites all visible PaintLayers over a pure-white (#ffffff) base into a target
 * Uint8ClampedArray (size = PAINT_ATLAS_SIZE * PAINT_ATLAS_SIZE * 4).
 * Because the base is always opaque pure white (255, 255, 255, 255), erasing never
 * creates transparent holes in the 3D character mesh!
 */
export function compositePaintLayersToBuffer(
  layers: PaintLayer[],
  targetBuffer?: Uint8ClampedArray
): Uint8ClampedArray {
  const totalBytes = PAINT_ATLAS_SIZE * PAINT_ATLAS_SIZE * 4;
  const out =
    targetBuffer && targetBuffer.length === totalBytes
      ? targetBuffer
      : new Uint8ClampedArray(totalBytes);

  // 1. Fill entire base with pure white (#ffffff, alpha 255)
  out.fill(255);

  // 2. Blend each visible layer bottom-to-top
  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0.001) continue;
    const layerOpacity = Math.max(0, Math.min(1, layer.opacity));
    const src = layer.data;

    for (let i = 0; i < totalBytes; i += 4) {
      const srcA = (src[i + 3] / 255) * layerOpacity;
      if (srcA <= 0.001) continue;
      const invA = 1.0 - srcA;
      out[i] = Math.round(src[i] * srcA + out[i] * invA);
      out[i + 1] = Math.round(src[i + 1] * srcA + out[i + 1] * invA);
      out[i + 2] = Math.round(src[i + 2] * srcA + out[i + 2] * invA);
      out[i + 3] = 255;
    }
  }

  return out;
}

/**
 * Samples the visible hex color (#rrggbb) at UV (u, v) from the composited layer stack.
 */
export function sampleColorAtUV(layers: PaintLayer[], u: number, v: number): string {
  const px = Math.max(0, Math.min(PAINT_ATLAS_SIZE - 1, Math.floor(u * PAINT_ATLAS_SIZE)));
  const py = Math.max(
    0,
    Math.min(PAINT_ATLAS_SIZE - 1, Math.floor((1.0 - v) * PAINT_ATLAS_SIZE))
  );
  const idx = (py * PAINT_ATLAS_SIZE + px) * 4;

  let r = 255;
  let g = 255;
  let b = 255;

  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0.001) continue;
    const srcA = (layer.data[idx + 3] / 255) * layer.opacity;
    if (srcA <= 0.001) continue;
    const invA = 1.0 - srcA;
    r = Math.round(layer.data[idx] * srcA + r * invA);
    g = Math.round(layer.data[idx + 1] * srcA + g * invA);
    b = Math.round(layer.data[idx + 2] * srcA + b * invA);
  }

  return rgbToHex(r, g, b);
}

// ============================================================================
// COMPACT RUN-LENGTH ENCODING (RLE) FOR PERSISTENT LAYER STORAGE
// ============================================================================

/**
 * Encodes an RGBA Uint8ClampedArray into a compact RLE string so multiple 512x512
 * multi-layer designs store in a few kilobytes in IndexedDB and localStorage.
 */
export function encodeRgbaBufferRLE(data: Uint8ClampedArray): string {
  const pixelCount = data.length >>> 2;
  const runs: string[] = [];
  let i = 0;

  while (i < pixelCount) {
    const base = i << 2;
    const r = data[base];
    const g = data[base + 1];
    const b = data[base + 2];
    const a = data[base + 3];

    let runLen = 1;
    while (i + runLen < pixelCount && runLen < 65535) {
      const next = (i + runLen) << 2;
      if (
        data[next] === r &&
        data[next + 1] === g &&
        data[next + 2] === b &&
        data[next + 3] === a
      ) {
        runLen++;
      } else {
        break;
      }
    }

    if (a === 0) {
      runs.push(`0:${runLen.toString(36)}`);
    } else {
      const hex =
        ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
      runs.push(`${hex.toString(36)}:${runLen.toString(36)}`);
    }
    i += runLen;
  }

  return runs.join(';');
}

export function decodeRgbaBufferRLE(
  rle: string,
  expectedLength = PAINT_ATLAS_SIZE * PAINT_ATLAS_SIZE * 4
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(expectedLength);
  if (!rle) return out;

  const parts = rle.split(';');
  let pixelIdx = 0;
  const maxPixels = expectedLength >>> 2;

  for (let p = 0; p < parts.length && pixelIdx < maxPixels; p++) {
    const token = parts[p];
    if (!token) continue;
    const colonIdx = token.indexOf(':');
    if (colonIdx === -1) continue;

    const colorCode = token.slice(0, colonIdx);
    const runLen = parseInt(token.slice(colonIdx + 1), 36) || 1;

    if (colorCode === '0') {
      pixelIdx = Math.min(maxPixels, pixelIdx + runLen);
      continue;
    }

    const rgba = parseInt(colorCode, 36) >>> 0;
    const r = (rgba >>> 24) & 255;
    const g = (rgba >>> 16) & 255;
    const b = (rgba >>> 8) & 255;
    const a = rgba & 255;

    const endPixel = Math.min(maxPixels, pixelIdx + runLen);
    for (let k = pixelIdx; k < endPixel; k++) {
      const base = k << 2;
      out[base] = r;
      out[base + 1] = g;
      out[base + 2] = b;
      out[base + 3] = a;
    }
    pixelIdx = endPixel;
  }

  return out;
}

export function serializePaintLayer(layer: PaintLayer): SerializedPaintLayer {
  return {
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    opacity: layer.opacity,
    rleBase64: encodeRgbaBufferRLE(layer.data),
  };
}

export function deserializePaintLayer(serialized: SerializedPaintLayer): PaintLayer {
  return {
    id: serialized.id,
    name: serialized.name,
    visible: serialized.visible,
    opacity: serialized.opacity,
    data: decodeRgbaBufferRLE(serialized.rleBase64),
  };
}

/**
 * Extracts up to 4 dominant non-white paint colors from a layer stack for gallery swatches.
 */
export function extractDominantColors(layers: PaintLayer[]): string[] {
  const counts = new Map<string, number>();
  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0.05) continue;
    const data = layer.data;
    // Sample every 16th pixel for speed
    for (let i = 0; i < data.length; i += 64) {
      if (data[i + 3] > 64) {
        const hex = rgbToHex(data[i], data[i + 1], data[i + 2]);
        if (hex !== '#ffffff') {
          counts.set(hex, (counts.get(hex) || 0) + 1);
        }
      }
    }
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return ['#ffffff'];
  return sorted.slice(0, 4).map((e) => e[0]);
}

// ============================================================================
// PERSISTENT STORAGE ENGINE (INDEXEDDB + LOCALSTORAGE MIRROR)
// ============================================================================

const IDB_NAME = 'fracture_poly_vault_db_v2';
const IDB_STORE = 'paint_designs';
const LS_DESIGNS_KEY = 'fracture_poly_designs_v2';
const LS_EQUIPPED_KEY = 'fracture_poly_equipped_v2';

/**
 * Generates 2 starter sample designs (clearly flagged with isSample: true)
 * so players can immediately test equipping, editing, or creating their own from scratch.
 */
export function buildDefaultStarterDesigns(): SavedPaintDesign[] {
  // Sample 0: ShadowRider Splash (Reference Lobby Blue / Orange / Yellow Paint Splashes on Pure White)
  const layer0 = createEmptyLayer('layer_splash', 'ShadowRider Paint Splashes');
  const blueBrush: BrushSettings = {
    ...DEFAULT_BRUSH_SETTINGS,
    colorHex: '#1877f2',
    size: 20,
    opacity: 1,
    hardness: 0.9,
    symmetry: false,
  };
  const orangeBrush: BrushSettings = {
    ...blueBrush,
    colorHex: '#f97316',
    size: 18,
  };
  const yellowBrush: BrushSettings = {
    ...blueBrush,
    colorHex: '#facc15',
    size: 15,
  };

  // Chest splashes (blue left/upper chest, yellow/orange mid chest)
  const chestTopR = mapLocalUvToRegionAtlas(0.72, 0.72, 'chest');
  const chestMidR = mapLocalUvToRegionAtlas(0.68, 0.42, 'chest');
  const chestMidL = mapLocalUvToRegionAtlas(0.32, 0.56, 'chest');
  const chestLow = mapLocalUvToRegionAtlas(0.48, 0.25, 'chest');
  applyBrushStrokeSegment(layer0, chestTopR.u, chestTopR.v, chestMidR.u, chestMidR.v, blueBrush, 'chest');
  applyBrushStrokeSegment(layer0, chestMidL.u, chestMidL.v, chestLow.u, chestLow.v, yellowBrush, 'chest');

  // Right Upper Arm & Forearm splashes (viewer's left side of character)
  const rArm1 = mapLocalUvToRegionAtlas(0.35, 0.72, 'rightUpperArm');
  const rArm2 = mapLocalUvToRegionAtlas(0.62, 0.35, 'rightUpperArm');
  applyBrushStrokeSegment(layer0, rArm1.u, rArm1.v, rArm2.u, rArm2.v, blueBrush, 'rightUpperArm');

  const rFore1 = mapLocalUvToRegionAtlas(0.35, 0.68, 'rightForearm');
  const rFore2 = mapLocalUvToRegionAtlas(0.65, 0.32, 'rightForearm');
  applyBrushStrokeSegment(layer0, rFore1.u, rFore1.v, rFore2.u, rFore2.v, orangeBrush, 'rightForearm');

  // Left Upper Arm & Forearm splashes (viewer's right side of character)
  const lArm1 = mapLocalUvToRegionAtlas(0.45, 0.74, 'leftUpperArm');
  const lArm2 = mapLocalUvToRegionAtlas(0.55, 0.38, 'leftUpperArm');
  applyBrushStrokeSegment(layer0, lArm1.u, lArm1.v, lArm2.u, lArm2.v, blueBrush, 'leftUpperArm');

  const lFore1 = mapLocalUvToRegionAtlas(0.42, 0.66, 'leftForearm');
  const lFore2 = mapLocalUvToRegionAtlas(0.58, 0.32, 'leftForearm');
  applyBrushStrokeSegment(layer0, lFore1.u, lFore1.v, lFore2.u, lFore2.v, orangeBrush, 'leftForearm');

  // Right Thigh & Lower Leg (viewer's left leg: bold blue + yellow splash)
  const rThigh1 = mapLocalUvToRegionAtlas(0.38, 0.78, 'rightThigh');
  const rThigh2 = mapLocalUvToRegionAtlas(0.56, 0.24, 'rightThigh');
  applyBrushStrokeSegment(layer0, rThigh1.u, rThigh1.v, rThigh2.u, rThigh2.v, { ...blueBrush, size: 24 }, 'rightThigh');
  const rThighYel = mapLocalUvToRegionAtlas(0.66, 0.55, 'rightThigh');
  applyBrushStrokeSegment(layer0, rThighYel.u, rThighYel.v, rThighYel.u, rThighYel.v, yellowBrush, 'rightThigh');

  const rShin1 = mapLocalUvToRegionAtlas(0.45, 0.75, 'rightLowerLeg');
  const rShin2 = mapLocalUvToRegionAtlas(0.52, 0.25, 'rightLowerLeg');
  applyBrushStrokeSegment(layer0, rShin1.u, rShin1.v, rShin2.u, rShin2.v, orangeBrush, 'rightLowerLeg');

  // Left Thigh & Lower Leg (viewer's right leg: bold orange + yellow + blue ankle splash)
  const lThigh1 = mapLocalUvToRegionAtlas(0.44, 0.72, 'leftThigh');
  const lThigh2 = mapLocalUvToRegionAtlas(0.62, 0.22, 'leftThigh');
  applyBrushStrokeSegment(layer0, lThigh1.u, lThigh1.v, lThigh2.u, lThigh2.v, { ...orangeBrush, size: 22 }, 'leftThigh');
  const lThighYel = mapLocalUvToRegionAtlas(0.36, 0.64, 'leftThigh');
  applyBrushStrokeSegment(layer0, lThighYel.u, lThighYel.v, lThighYel.u, lThighYel.v, yellowBrush, 'leftThigh');

  const lShin1 = mapLocalUvToRegionAtlas(0.48, 0.72, 'leftLowerLeg');
  const lShin2 = mapLocalUvToRegionAtlas(0.55, 0.22, 'leftLowerLeg');
  applyBrushStrokeSegment(layer0, lShin1.u, lShin1.v, lShin2.u, lShin2.v, blueBrush, 'leftLowerLeg');

  const comp0 = compositePaintLayersToBuffer([layer0]);

  // Sample 1: Crimson Strike Vector
  const layer1 = createEmptyLayer('layer_base', 'Base Stripes');
  const redSettings: BrushSettings = {
    ...DEFAULT_BRUSH_SETTINGS,
    colorHex: '#ef4444',
    size: 16,
    opacity: 1,
    symmetry: true,
  };
  applyBucketFillToLayer(layer1, 0.62, 0.88, redSettings, 'chest');
  applyGeometricShapeToLayer(layer1, 0.37, 0.62, 'stripe_stamp', redSettings, 'leftUpperArm');
  applyGeometricShapeToLayer(layer1, 0.12, 0.88, 'stripe_stamp', {
    ...redSettings,
    colorHex: '#111827',
  }, 'head');

  const comp1 = compositePaintLayersToBuffer([layer1]);

  // Sample 2: Emerald Recon Camo
  const layer2 = createEmptyLayer('layer_camo', 'Camo Pattern');
  const greenSettings: BrushSettings = {
    ...DEFAULT_BRUSH_SETTINGS,
    colorHex: '#10b981',
    size: 18,
    opacity: 1,
    symmetry: true,
  };
  applyBucketFillToLayer(layer2, 0.37, 0.62, greenSettings, 'leftUpperArm');
  applyBucketFillToLayer(layer2, 0.62, 0.37, greenSettings, 'leftThigh');
  applyGeometricShapeToLayer(layer2, 0.62, 0.88, 'circle', {
    ...greenSettings,
    colorHex: '#06b6d4',
  }, 'chest');

  const comp2 = compositePaintLayersToBuffer([layer2]);

  return [
    {
      id: 'sample_shadowrider_splash',
      name: 'Cobalt Splash [Sample]',
      characterId: 'volt',
      uvLayoutId: 'chameleon_humanoid_v1',
      createdAt: 1729550200000,
      updatedAt: 1729550200000,
      isSample: true,
      layers: [serializePaintLayer(layer0)],
      compositeRleBase64: encodeRgbaBufferRLE(comp0),
      primaryColors: ['#1877f2', '#f97316', '#facc15'],
    },
    {
      id: 'sample_crimson_viper',
      name: 'Crimson Strike [Sample]',
      characterId: 'volt',
      uvLayoutId: 'chameleon_humanoid_v1',
      createdAt: 1729550000000,
      updatedAt: 1729550000000,
      isSample: true,
      layers: [serializePaintLayer(layer1)],
      compositeRleBase64: encodeRgbaBufferRLE(comp1),
      primaryColors: ['#ef4444', '#111827'],
    },
    {
      id: 'sample_emerald_prism',
      name: 'Emerald Recon [Sample]',
      characterId: 'rift',
      uvLayoutId: 'chameleon_humanoid_v1',
      createdAt: 1729550100000,
      updatedAt: 1729550100000,
      isSample: true,
      layers: [serializePaintLayer(layer2)],
      compositeRleBase64: encodeRgbaBufferRLE(comp2),
      primaryColors: ['#10b981', '#06b6d4'],
    },
  ];
}

class PaintDesignStorageManager {
  private designsCache: SavedPaintDesign[] = [];
  private equippedDesignByCharacter: Record<CharacterId, string | null> = {
    volt: null,
    rift: null,
    kestrel: null,
    chroma: null,
  };
  private initialized = false;
  private listeners = new Set<() => void>();

  constructor() {
    this.loadFromSyncFallback();
    void this.initIndexedDB();
  }

  private loadFromSyncFallback(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(LS_DESIGNS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.designsCache = parsed;
          }
        }
        const eqRaw = window.localStorage.getItem(LS_EQUIPPED_KEY);
        if (eqRaw) {
          const parsedEq = JSON.parse(eqRaw);
          if (parsedEq && typeof parsedEq === 'object') {
            this.equippedDesignByCharacter = {
              ...this.equippedDesignByCharacter,
              ...parsedEq,
            };
          }
        }
      }
    } catch {
      // ignore storage errors
    }

    if (this.designsCache.length === 0) {
      this.designsCache = buildDefaultStarterDesigns();
      this.persistSyncFallback();
    } else if (!this.designsCache.some((d) => d.id === 'sample_shadowrider_splash')) {
      const defaults = buildDefaultStarterDesigns();
      this.designsCache = [defaults[0], ...this.designsCache];
      this.persistSyncFallback();
    }
  }

  private persistSyncFallback(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(LS_DESIGNS_KEY, JSON.stringify(this.designsCache));
        window.localStorage.setItem(
          LS_EQUIPPED_KEY,
          JSON.stringify(this.equippedDesignByCharacter)
        );
      }
    } catch {
      // ignore quota or private mode errors
    }
  }

  private async openDatabase(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return null;
    }
    return new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  public async initIndexedDB(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    const db = await this.openDatabase();
    if (!db) return;

    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      await new Promise<void>((resolve) => {
        req.onsuccess = () => {
          const rows = req.result as SavedPaintDesign[];
          if (Array.isArray(rows) && rows.length > 0) {
            rows.sort((a, b) => b.updatedAt - a.updatedAt);
            this.designsCache = rows;
            this.persistSyncFallback();
            this.notify();
          } else {
            // Seed IndexedDB with current cache
            void this.syncAllToIndexedDB();
          }
          resolve();
        };
        req.onerror = () => resolve();
      });
    } catch {
      // fallback already loaded
    }
  }

  private async syncAllToIndexedDB(): Promise<void> {
    const db = await this.openDatabase();
    if (!db) return;
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.clear();
      for (const d of this.designsCache) {
        store.put(d);
      }
    } catch {
      // ignore
    }
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    for (const cb of this.listeners) {
      cb();
    }
  }

  public getDesigns(): SavedPaintDesign[] {
    return [...this.designsCache];
  }

  public getDesignById(id: string | null | undefined): SavedPaintDesign | null {
    if (!id) return null;
    return this.designsCache.find((d) => d.id === id) || null;
  }

  public getEquippedDesignId(characterId: CharacterId): string | null {
    const eqId = this.equippedDesignByCharacter[characterId];
    if (!eqId) return null;
    const design = this.getDesignById(eqId);
    if (!design) return null;
    if (!isDesignCompatibleWithCharacter(design.uvLayoutId, characterId)) {
      return null;
    }
    return eqId;
  }

  public getEquippedDesign(characterId: CharacterId): SavedPaintDesign | null {
    const id = this.getEquippedDesignId(characterId);
    return this.getDesignById(id);
  }

  /**
   * Saves a new custom design (or updates an existing design when overwriteId is explicitly passed).
   * Creating a new design generates a unique ID so existing designs are never accidentally overwritten.
   */
  public saveDesign(params: {
    name: string;
    characterId: CharacterId;
    layers: PaintLayer[];
    overwriteDesignId?: string | null;
  }): { ok: boolean; design?: SavedPaintDesign; error?: string } {
    const trimmedName = params.name.trim();
    if (!trimmedName) {
      return { ok: false, error: 'Please enter a design name before saving.' };
    }
    if (params.layers.length === 0) {
      return { ok: false, error: 'Design must contain at least one paint layer.' };
    }

    if (
      !params.overwriteDesignId &&
      this.designsCache.length >= MAX_SAVED_DESIGNS
    ) {
      return {
        ok: false,
        error: `Storage limit reached (${MAX_SAVED_DESIGNS} designs max). Delete an old design first.`,
      };
    }

    try {
      const serializedLayers = params.layers.map(serializePaintLayer);
      const compositeBuffer = compositePaintLayersToBuffer(params.layers);
      const compositeRleBase64 = encodeRgbaBufferRLE(compositeBuffer);
      const primaryColors = extractDominantColors(params.layers);
      const now = Date.now();

      const existingIdx = params.overwriteDesignId
        ? this.designsCache.findIndex((d) => d.id === params.overwriteDesignId)
        : -1;

      let saved: SavedPaintDesign;
      if (existingIdx >= 0 && !this.designsCache[existingIdx].isSample) {
        saved = {
          ...this.designsCache[existingIdx],
          name: trimmedName,
          characterId: params.characterId,
          updatedAt: now,
          layers: serializedLayers,
          compositeRleBase64,
          primaryColors,
        };
        this.designsCache[existingIdx] = saved;
      } else {
        saved = {
          id: `design_${now}_${Math.random().toString(36).slice(2, 7)}`,
          name: trimmedName,
          characterId: params.characterId,
          uvLayoutId: 'chameleon_humanoid_v1',
          createdAt: now,
          updatedAt: now,
          isSample: false,
          layers: serializedLayers,
          compositeRleBase64,
          primaryColors,
        };
        this.designsCache = [saved, ...this.designsCache];
      }

      this.persistSyncFallback();
      void this.syncAllToIndexedDB();
      this.notify();
      return { ok: true, design: saved };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? `Failed to save design: ${err.message}`
            : 'Storage quota exceeded while saving design.',
      };
    }
  }

  public duplicateDesign(designId: string): {
    ok: boolean;
    design?: SavedPaintDesign;
    error?: string;
  } {
    const orig = this.getDesignById(designId);
    if (!orig) return { ok: false, error: 'Original design not found.' };
    if (this.designsCache.length >= MAX_SAVED_DESIGNS) {
      return { ok: false, error: `Maximum of ${MAX_SAVED_DESIGNS} designs reached.` };
    }
    const now = Date.now();
    const copy: SavedPaintDesign = {
      ...orig,
      id: `design_${now}_${Math.random().toString(36).slice(2, 7)}`,
      name: `${orig.name.replace(/\s*\[Sample\]$/i, '')} Copy`,
      createdAt: now,
      updatedAt: now,
      isSample: false,
      layers: orig.layers.map((l) => ({ ...l, id: `${l.id}_copy` })),
    };
    this.designsCache = [copy, ...this.designsCache];
    this.persistSyncFallback();
    void this.syncAllToIndexedDB();
    this.notify();
    return { ok: true, design: copy };
  }

  public renameDesign(designId: string, newName: string): boolean {
    const clean = newName.trim();
    if (!clean) return false;
    const idx = this.designsCache.findIndex((d) => d.id === designId);
    if (idx === -1) return false;
    this.designsCache[idx] = {
      ...this.designsCache[idx],
      name: clean,
      updatedAt: Date.now(),
    };
    this.persistSyncFallback();
    void this.syncAllToIndexedDB();
    this.notify();
    return true;
  }

  public deleteDesign(designId: string): boolean {
    const prevLen = this.designsCache.length;
    this.designsCache = this.designsCache.filter((d) => d.id !== designId);
    if (this.designsCache.length === prevLen) return false;

    for (const cid of ['volt', 'rift', 'kestrel', 'chroma'] as CharacterId[]) {
      if (this.equippedDesignByCharacter[cid] === designId) {
        this.equippedDesignByCharacter[cid] = null;
      }
    }
    this.persistSyncFallback();
    void this.syncAllToIndexedDB();
    this.notify();
    return true;
  }

  /**
   * Equips a saved design (or null to restore pure-white unpainted base) onto a character.
   * Preserves compatible designs when switching characters.
   */
  public equipDesign(characterId: CharacterId, designId: string | null): boolean {
    if (designId === null) {
      this.equippedDesignByCharacter[characterId] = null;
      this.persistSyncFallback();
      this.notify();
      return true;
    }
    const design = this.getDesignById(designId);
    if (!design) return false;
    if (!isDesignCompatibleWithCharacter(design.uvLayoutId, characterId)) {
      return false;
    }
    this.equippedDesignByCharacter[characterId] = designId;
    this.persistSyncFallback();
    this.notify();
    return true;
  }
}

export const paintStorage = new PaintDesignStorageManager();

/**
 * Generates a custom painted & shaded 512x512 RGBA buffer for in-game enemy Chameleon characters
 * so every enemy bot displays the signature pure-white Chameleon humanoid base with bold faction
 * paint splashes, shaded armor contours, and tactical markings.
 */
export function buildEnemyFactionPaintBuffer(
  characterId: CharacterId,
  archetype: 'rusher' | 'sniper' | 'heavy' | 'flanker',
  botIndex = 0
): Uint8ClampedArray {
  const layer = createEmptyLayer(`enemy_${characterId}_${archetype}_${botIndex}`, 'Enemy Faction Paint');

  const paletteByArchetype: Record<
    'rusher' | 'sniper' | 'heavy' | 'flanker',
    { primary: string; secondary: string; accent: string }
  > = {
    rusher: { primary: '#ef4444', secondary: '#f97316', accent: '#18181b' },
    flanker: { primary: '#f59e0b', secondary: '#ef4444', accent: '#1e293b' },
    sniper: { primary: '#8b5cf6', secondary: '#ec4899', accent: '#0f172a' },
    heavy: { primary: '#dc2626', secondary: '#fbbf24', accent: '#111827' },
  };

  const pal = paletteByArchetype[archetype] || paletteByArchetype.rusher;

  const splashBrush: BrushSettings = {
    ...DEFAULT_BRUSH_SETTINGS,
    tool: 'paint_splatter',
    colorHex: pal.primary,
    size: 22,
    opacity: 0.96,
    hardness: 0.85,
    symmetry: true,
  };

  const secondaryBrush: BrushSettings = {
    ...splashBrush,
    tool: 'brush',
    colorHex: pal.secondary,
    size: 18,
  };

  const shadeBrush: BrushSettings = {
    ...DEFAULT_BRUSH_SETTINGS,
    tool: 'shade_burn',
    colorHex: pal.accent,
    size: 20,
    opacity: 0.72,
    hardness: 0.25,
    symmetry: true,
  };

  // 1. Gradient shaded chest & back armor
  applyGradientFillToLayer(
    layer,
    0.62,
    0.88,
    { ...DEFAULT_BRUSH_SETTINGS, colorHex: pal.primary, opacity: 0.88, symmetry: false },
    'chest'
  );

  // 2. Bold paint splashes on upper arms, forearms, and thighs over the white Chameleon suit
  const uArmA = mapLocalUvToRegionAtlas(0.35, 0.72, 'leftUpperArm');
  const uArmB = mapLocalUvToRegionAtlas(0.65, 0.32, 'leftUpperArm');
  applyBrushStrokeSegment(layer, uArmA.u, uArmA.v, uArmB.u, uArmB.v, splashBrush, 'leftUpperArm');

  const fArmA = mapLocalUvToRegionAtlas(0.4, 0.68, 'leftForearm');
  const fArmB = mapLocalUvToRegionAtlas(0.6, 0.3, 'leftForearm');
  applyBrushStrokeSegment(layer, fArmA.u, fArmA.v, fArmB.u, fArmB.v, secondaryBrush, 'leftForearm');

  const thighA = mapLocalUvToRegionAtlas(0.38, 0.76, 'leftThigh');
  const thighB = mapLocalUvToRegionAtlas(0.62, 0.25, 'leftThigh');
  applyBrushStrokeSegment(layer, thighA.u, thighA.v, thighB.u, thighB.v, splashBrush, 'leftThigh');

  const shinA = mapLocalUvToRegionAtlas(0.44, 0.74, 'leftLowerLeg');
  const shinB = mapLocalUvToRegionAtlas(0.56, 0.24, 'leftLowerLeg');
  applyBrushStrokeSegment(layer, shinA.u, shinA.v, shinB.u, shinB.v, secondaryBrush, 'leftLowerLeg');

  // 3. Head crest stripe & contour shading
  const headCrest = mapLocalUvToRegionAtlas(0.5, 0.68, 'head');
  applyGeometricShapeToLayer(
    layer,
    headCrest.u,
    headCrest.v,
    botIndex % 2 === 0 ? 'stripe_stamp' : 'camo_stamp',
    { ...DEFAULT_BRUSH_SETTINGS, colorHex: pal.primary, size: 16, opacity: 0.95, symmetry: false },
    'head'
  );

  const pelvisMid = mapLocalUvToRegionAtlas(0.5, 0.45, 'pelvis');
  applyBrushDabToLayer(layer, pelvisMid.u, pelvisMid.v, shadeBrush, 'pelvis');

  return compositePaintLayersToBuffer([layer]);
}

