import * as THREE from 'three';
import { WEAPON_REGISTRY, type WeaponId } from './config.ts';

export interface ProceduralTextureSet {
  groundMap: THREE.CanvasTexture;
  groundBump: THREE.CanvasTexture;
  metalDeckMap: THREE.CanvasTexture;
  metalDeckBump: THREE.CanvasTexture;
  wallMap: THREE.CanvasTexture;
  containerMap: THREE.CanvasTexture;
  crateMap: THREE.CanvasTexture;
  muzzleFlashMap: THREE.CanvasTexture;
  bulletHoleMap: THREE.CanvasTexture;
  bulletHoleMp5Map: THREE.CanvasTexture;
  bulletHoleM4a1Map: THREE.CanvasTexture;
  bulletHoleAk47Map: THREE.CanvasTexture;
  bulletHoleDeagleMap: THREE.CanvasTexture;
  bulletHoleShotgunMap: THREE.CanvasTexture;
  bulletHoleAwpMap: THREE.CanvasTexture;
  bulletHoleRifleMap: THREE.CanvasTexture;
  bulletHoleSmgMap: THREE.CanvasTexture;
  bulletHoleSniperMap: THREE.CanvasTexture;
  bloodSplatterMap: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextureSet(maxAnisotropy = 4): ProceduralTextureSet {
  // 1. Tactical Asphalt / Concrete Slab Ground Texture
  const gCanvas = document.createElement('canvas');
  gCanvas.width = 512;
  gCanvas.height = 512;
  const gCtx = gCanvas.getContext('2d')!;
  gCtx.fillStyle = '#363b42';
  gCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 4500; i++) {
    const x = (i * 73) % 512;
    const y = (i * 139) % 512;
    const v = 46 + ((i * 29) % 24);
    gCtx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    gCtx.fillRect(x, y, 2, 2);
  }

  gCtx.strokeStyle = '#25292e';
  gCtx.lineWidth = 3;
  for (let p = 0; p <= 512; p += 128) {
    gCtx.beginPath();
    gCtx.moveTo(p, 0);
    gCtx.lineTo(p, 512);
    gCtx.stroke();
    gCtx.beginPath();
    gCtx.moveTo(0, p);
    gCtx.lineTo(512, p);
    gCtx.stroke();
  }

  gCtx.strokeStyle = 'rgba(210, 218, 226, 0.12)';
  gCtx.lineWidth = 2;
  gCtx.strokeRect(8, 8, 496, 496);

  const groundMap = new THREE.CanvasTexture(gCanvas);
  groundMap.colorSpace = THREE.SRGBColorSpace;
  groundMap.wrapS = THREE.RepeatWrapping;
  groundMap.wrapT = THREE.RepeatWrapping;
  groundMap.repeat.set(28, 28);
  groundMap.anisotropy = maxAnisotropy;

  const groundBump = new THREE.CanvasTexture(gCanvas);
  groundBump.wrapS = THREE.RepeatWrapping;
  groundBump.wrapT = THREE.RepeatWrapping;
  groundBump.repeat.set(28, 28);

  // 2. Architectural Concrete Panel Wall Texture
  const wCanvas = document.createElement('canvas');
  wCanvas.width = 256;
  wCanvas.height = 256;
  const wCtx = wCanvas.getContext('2d')!;
  wCtx.fillStyle = '#505762';
  wCtx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 1600; i++) {
    const x = (i * 53) % 256;
    const y = (i * 97) % 256;
    const lum = 72 + ((i * 19) % 20);
    wCtx.fillStyle = `rgb(${lum},${lum + 3},${lum + 7})`;
    wCtx.fillRect(x, y, 2, 2);
  }
  wCtx.strokeStyle = '#383d46';
  wCtx.lineWidth = 2;
  for (let y = 0; y <= 256; y += 64) {
    wCtx.beginPath();
    wCtx.moveTo(0, y);
    wCtx.lineTo(256, y);
    wCtx.stroke();
  }
  for (let x = 0; x <= 256; x += 128) {
    wCtx.beginPath();
    wCtx.moveTo(x, 0);
    wCtx.lineTo(x, 256);
    wCtx.stroke();
  }

  const wallMap = new THREE.CanvasTexture(wCanvas);
  wallMap.colorSpace = THREE.SRGBColorSpace;
  wallMap.wrapS = THREE.RepeatWrapping;
  wallMap.wrapT = THREE.RepeatWrapping;
  wallMap.repeat.set(2, 2);
  wallMap.anisotropy = maxAnisotropy;

  // 3. Corrugated Shipping Container / Industrial Steel Texture
  const cCanvas = document.createElement('canvas');
  cCanvas.width = 256;
  cCanvas.height = 256;
  const cCtx = cCanvas.getContext('2d')!;
  cCtx.fillStyle = '#5c6672';
  cCtx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    cCtx.fillStyle = x % 32 === 0 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.08)';
    cCtx.fillRect(x, 0, 8, 256);
  }
  cCtx.strokeStyle = 'rgba(20,24,30,0.45)';
  cCtx.lineWidth = 6;
  cCtx.strokeRect(3, 3, 250, 250);

  const containerMap = new THREE.CanvasTexture(cCanvas);
  containerMap.colorSpace = THREE.SRGBColorSpace;
  containerMap.wrapS = THREE.RepeatWrapping;
  containerMap.wrapT = THREE.RepeatWrapping;
  containerMap.anisotropy = maxAnisotropy;

  // 4. Reinforced Tactical Supply Crate Texture
  const crCanvas = document.createElement('canvas');
  crCanvas.width = 128;
  crCanvas.height = 128;
  const crCtx = crCanvas.getContext('2d')!;
  crCtx.fillStyle = '#8b623b';
  crCtx.fillRect(0, 0, 128, 128);
  crCtx.strokeStyle = '#52371e';
  crCtx.lineWidth = 6;
  crCtx.strokeRect(4, 4, 120, 120);
  crCtx.beginPath();
  crCtx.moveTo(8, 8);
  crCtx.lineTo(120, 120);
  crCtx.moveTo(120, 8);
  crCtx.lineTo(8, 120);
  crCtx.stroke();

  const crateMap = new THREE.CanvasTexture(crCanvas);
  crateMap.colorSpace = THREE.SRGBColorSpace;

  // 5. Radial Starburst Muzzle Flash Texture
  const mfCanvas = document.createElement('canvas');
  mfCanvas.width = 128;
  mfCanvas.height = 128;
  const mfCtx = mfCanvas.getContext('2d')!;
  const grad = mfCtx.createRadialGradient(64, 64, 2, 64, 64, 60);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.25, 'rgba(255, 230, 130, 0.95)');
  grad.addColorStop(0.55, 'rgba(255, 140, 25, 0.65)');
  grad.addColorStop(1, 'rgba(255, 60, 0, 0)');
  mfCtx.fillStyle = grad;
  mfCtx.fillRect(0, 0, 128, 128);

  const muzzleFlashMap = new THREE.CanvasTexture(mfCanvas);
  muzzleFlashMap.colorSpace = THREE.SRGBColorSpace;

  // Helper to paint directional forward carbon burn streak & grazing gouge along +X
  const drawDirectionalBurnStreak = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    length: number,
    halfWidth: number,
    opacity: number,
    emberRGB: string
  ) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(length / Math.max(1, halfWidth), 1);
    const bGrad = ctx.createRadialGradient(halfWidth * 0.35, 0, 1, halfWidth * 0.45, 0, halfWidth);
    bGrad.addColorStop(0, `rgba(10, 12, 16, ${opacity})`);
    bGrad.addColorStop(0.32, `rgba(${emberRGB}, ${opacity * 0.42})`);
    bGrad.addColorStop(0.65, `rgba(24, 28, 36, ${opacity * 0.45})`);
    bGrad.addColorStop(1, 'rgba(20, 24, 30, 0)');
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.arc(halfWidth * 0.35, 0, halfWidth, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // 6A. MP5-K (9mm Parabellum, 20 DMG) — Compact clean puncture, 4 hairline cracks, subtle amber pinpoint, light forward smudge
  const bhMp5Canvas = document.createElement('canvas');
  bhMp5Canvas.width = 256;
  bhMp5Canvas.height = 256;
  const mp5Ctx = bhMp5Canvas.getContext('2d')!;
  drawDirectionalBurnStreak(mp5Ctx, 124, 128, 66, 26, 0.62, '245, 158, 11');
  const mp5Grad = mp5Ctx.createRadialGradient(118, 128, 4, 122, 128, 62);
  mp5Grad.addColorStop(0, 'rgba(4, 6, 9, 0.98)');
  mp5Grad.addColorStop(0.18, 'rgba(245, 158, 11, 0.38)');
  mp5Grad.addColorStop(0.32, 'rgba(22, 26, 34, 0.92)');
  mp5Grad.addColorStop(0.56, 'rgba(135, 145, 160, 0.54)');
  mp5Grad.addColorStop(0.82, 'rgba(45, 50, 58, 0.22)');
  mp5Grad.addColorStop(1, 'rgba(45, 50, 58, 0)');
  mp5Ctx.fillStyle = mp5Grad;
  mp5Ctx.fillRect(0, 0, 256, 256);
  mp5Ctx.strokeStyle = 'rgba(14, 18, 24, 0.72)';
  mp5Ctx.lineWidth = 1.8;
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + 0.4;
    const len = 34 + (i % 2) * 14;
    mp5Ctx.beginPath();
    mp5Ctx.moveTo(118 + Math.cos(ang) * 10, 128 + Math.sin(ang) * 10);
    mp5Ctx.lineTo(118 + Math.cos(ang + 0.1) * len, 128 + Math.sin(ang + 0.1) * len);
    mp5Ctx.stroke();
  }
  const bulletHoleMp5Map = new THREE.CanvasTexture(bhMp5Canvas);
  bulletHoleMp5Map.colorSpace = THREE.SRGBColorSpace;
  bulletHoleMp5Map.anisotropy = maxAnisotropy;

  // 6B. M4A1 Carbine (5.56mm NATO, 26 DMG) — Crisp high-velocity tactical crater, 6 radial cracks, warm amber-orange ember ring
  const bhM4Canvas = document.createElement('canvas');
  bhM4Canvas.width = 256;
  bhM4Canvas.height = 256;
  const m4Ctx = bhM4Canvas.getContext('2d')!;
  drawDirectionalBurnStreak(m4Ctx, 122, 128, 82, 34, 0.74, '249, 115, 22');
  const m4Grad = m4Ctx.createRadialGradient(116, 128, 5, 120, 128, 78);
  m4Grad.addColorStop(0, 'rgba(5, 7, 10, 0.99)');
  m4Grad.addColorStop(0.18, 'rgba(251, 146, 60, 0.52)');
  m4Grad.addColorStop(0.32, 'rgba(18, 22, 29, 0.94)');
  m4Grad.addColorStop(0.55, 'rgba(82, 92, 106, 0.65)');
  m4Grad.addColorStop(0.82, 'rgba(38, 44, 52, 0.25)');
  m4Grad.addColorStop(1, 'rgba(30, 34, 40, 0)');
  m4Ctx.fillStyle = m4Grad;
  m4Ctx.fillRect(0, 0, 256, 256);
  m4Ctx.strokeStyle = 'rgba(12, 15, 21, 0.82)';
  m4Ctx.lineWidth = 2.4;
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + 0.22;
    const len = 46 + (i % 3) * 16;
    m4Ctx.beginPath();
    m4Ctx.moveTo(116 + Math.cos(ang) * 12, 128 + Math.sin(ang) * 12);
    m4Ctx.lineTo(
      116 + Math.cos(ang + 0.12) * (len * 0.55),
      128 + Math.sin(ang + 0.12) * (len * 0.55)
    );
    m4Ctx.lineTo(116 + Math.cos(ang - 0.08) * len, 128 + Math.sin(ang - 0.08) * len);
    m4Ctx.stroke();
  }
  const bulletHoleM4a1Map = new THREE.CanvasTexture(bhM4Canvas);
  bulletHoleM4a1Map.colorSpace = THREE.SRGBColorSpace;
  bulletHoleM4a1Map.anisotropy = maxAnisotropy;

  // 6C. AK-47 (7.62x39mm Heavy Rifle, 34 DMG) — Deep jagged concrete spall crater, 9 branched cracks, intense orange-red ember core
  const bhAkCanvas = document.createElement('canvas');
  bhAkCanvas.width = 256;
  bhAkCanvas.height = 256;
  const akCtx = bhAkCanvas.getContext('2d')!;
  drawDirectionalBurnStreak(akCtx, 120, 128, 96, 42, 0.84, '234, 88, 12');
  const akGrad = akCtx.createRadialGradient(114, 128, 6, 118, 128, 92);
  akGrad.addColorStop(0, 'rgba(4, 5, 8, 1)');
  akGrad.addColorStop(0.2, 'rgba(234, 88, 12, 0.65)');
  akGrad.addColorStop(0.35, 'rgba(15, 18, 24, 0.96)');
  akGrad.addColorStop(0.58, 'rgba(68, 76, 88, 0.72)');
  akGrad.addColorStop(0.84, 'rgba(32, 36, 44, 0.3)');
  akGrad.addColorStop(1, 'rgba(24, 28, 34, 0)');
  akCtx.fillStyle = akGrad;
  akCtx.fillRect(0, 0, 256, 256);
  // Jagged concrete spall chunks
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + 0.18;
    const dist = 26 + (i % 3) * 11;
    akCtx.fillStyle = i % 2 === 0 ? 'rgba(22, 26, 34, 0.78)' : 'rgba(96, 106, 120, 0.55)';
    akCtx.beginPath();
    akCtx.arc(114 + Math.cos(ang) * dist, 128 + Math.sin(ang) * dist, 5 + (i % 3) * 2, 0, Math.PI * 2);
    akCtx.fill();
  }
  akCtx.strokeStyle = 'rgba(10, 12, 18, 0.88)';
  akCtx.lineWidth = 2.8;
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2 + 0.14;
    const len = 58 + (i % 3) * 18;
    const midX = 114 + Math.cos(ang + 0.14) * (len * 0.52);
    const midY = 128 + Math.sin(ang + 0.14) * (len * 0.52);
    akCtx.beginPath();
    akCtx.moveTo(114 + Math.cos(ang) * 11, 128 + Math.sin(ang) * 11);
    akCtx.lineTo(midX, midY);
    akCtx.lineTo(114 + Math.cos(ang - 0.1) * len, 128 + Math.sin(ang - 0.1) * len);
    akCtx.stroke();
    if (i % 2 === 0) {
      akCtx.beginPath();
      akCtx.moveTo(midX, midY);
      akCtx.lineTo(
        midX + Math.cos(ang + 0.55) * (len * 0.35),
        midY + Math.sin(ang + 0.55) * (len * 0.35)
      );
      akCtx.stroke();
    }
  }
  const bulletHoleAk47Map = new THREE.CanvasTexture(bhAkCanvas);
  bulletHoleAk47Map.colorSpace = THREE.SRGBColorSpace;
  bulletHoleAk47Map.anisotropy = maxAnisotropy;

  // 6D. Desert Eagle (.50 AE Heavy Magnum, 54 DMG) — Wide blunt-force shock crater, double pulverized rings, 8 thick cracks, golden-amber thermal glow
  const bhDeagleCanvas = document.createElement('canvas');
  bhDeagleCanvas.width = 256;
  bhDeagleCanvas.height = 256;
  const dgCtx = bhDeagleCanvas.getContext('2d')!;
  drawDirectionalBurnStreak(dgCtx, 118, 128, 98, 48, 0.85, '251, 191, 36');
  const dgGrad = dgCtx.createRadialGradient(114, 128, 7, 116, 128, 96);
  dgGrad.addColorStop(0, 'rgba(3, 5, 8, 1)');
  dgGrad.addColorStop(0.22, 'rgba(251, 191, 36, 0.68)');
  dgGrad.addColorStop(0.36, 'rgba(18, 22, 30, 0.95)');
  dgGrad.addColorStop(0.54, 'rgba(148, 163, 184, 0.64)');
  dgGrad.addColorStop(0.72, 'rgba(30, 36, 44, 0.52)');
  dgGrad.addColorStop(1, 'rgba(30, 36, 44, 0)');
  dgCtx.fillStyle = dgGrad;
  dgCtx.fillRect(0, 0, 256, 256);
  // Double concentric pulverized shock rings
  dgCtx.strokeStyle = 'rgba(203, 213, 225, 0.42)';
  dgCtx.lineWidth = 3.2;
  dgCtx.beginPath();
  dgCtx.arc(114, 128, 34, 0, Math.PI * 2);
  dgCtx.stroke();
  dgCtx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
  dgCtx.lineWidth = 2.6;
  dgCtx.beginPath();
  dgCtx.arc(114, 128, 52, 0, Math.PI * 2);
  dgCtx.stroke();
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + 0.25;
    const len = 62 + (i % 2) * 18;
    dgCtx.beginPath();
    dgCtx.moveTo(114 + Math.cos(ang) * 14, 128 + Math.sin(ang) * 14);
    dgCtx.lineTo(114 + Math.cos(ang - 0.07) * len, 128 + Math.sin(ang - 0.07) * len);
    dgCtx.stroke();
  }
  const bulletHoleDeagleMap = new THREE.CanvasTexture(bhDeagleCanvas);
  bulletHoleDeagleMap.colorSpace = THREE.SRGBColorSpace;
  bulletHoleDeagleMap.anisotropy = maxAnisotropy;

  // 6E. SPAS-12 (12-Gauge Buckshot Pellet Gouge + Satellite Chip Cluster & Powder Burn)
  const bhSgCanvas = document.createElement('canvas');
  bhSgCanvas.width = 256;
  bhSgCanvas.height = 256;
  const sgCtx = bhSgCanvas.getContext('2d')!;
  drawDirectionalBurnStreak(sgCtx, 120, 128, 86, 44, 0.76, '251, 146, 60');
  const sgHalo = sgCtx.createRadialGradient(118, 128, 12, 122, 128, 98);
  sgHalo.addColorStop(0, 'rgba(20, 24, 30, 0.78)');
  sgHalo.addColorStop(0.55, 'rgba(42, 48, 58, 0.42)');
  sgHalo.addColorStop(1, 'rgba(48, 52, 60, 0)');
  sgCtx.fillStyle = sgHalo;
  sgCtx.fillRect(0, 0, 256, 256);
  const pelletOffsets = [
    [0, 0, 24],
    [-26, -18, 15],
    [30, -14, 16],
    [-20, 24, 14],
    [26, 22, 15],
    [6, -34, 13],
    [-36, 6, 13],
  ];
  for (const [px, py, rad] of pelletOffsets) {
    const cx = 118 + px;
    const cy = 128 + py;
    const pGrad = sgCtx.createRadialGradient(cx, cy, 2, cx, cy, rad);
    pGrad.addColorStop(0, 'rgba(5, 7, 11, 0.98)');
    pGrad.addColorStop(0.28, 'rgba(251, 146, 60, 0.44)');
    pGrad.addColorStop(0.52, 'rgba(32, 37, 46, 0.85)');
    pGrad.addColorStop(1, 'rgba(65, 70, 80, 0)');
    sgCtx.fillStyle = pGrad;
    sgCtx.beginPath();
    sgCtx.arc(cx, cy, rad, 0, Math.PI * 2);
    sgCtx.fill();
  }
  const bulletHoleShotgunMap = new THREE.CanvasTexture(bhSgCanvas);
  bulletHoleShotgunMap.colorSpace = THREE.SRGBColorSpace;
  bulletHoleShotgunMap.anisotropy = maxAnisotropy;

  // 6F. AWP (.338 Lapua Magnum, 105 DMG) — Massive armor-piercing crater, molten white-orange core, 12 deep structural cracks & long +X scorch tail
  const bhAwpCanvas = document.createElement('canvas');
  bhAwpCanvas.width = 256;
  bhAwpCanvas.height = 256;
  const snCtx = bhAwpCanvas.getContext('2d')!;
  drawDirectionalBurnStreak(snCtx, 116, 128, 118, 56, 0.94, '255, 120, 25');
  const snGrad = snCtx.createRadialGradient(110, 128, 6, 114, 128, 112);
  snGrad.addColorStop(0, 'rgba(255, 245, 210, 0.98)');
  snGrad.addColorStop(0.1, 'rgba(255, 115, 20, 0.92)');
  snGrad.addColorStop(0.24, 'rgba(6, 8, 12, 0.98)');
  snGrad.addColorStop(0.46, 'rgba(20, 25, 34, 0.92)');
  snGrad.addColorStop(0.68, 'rgba(90, 100, 116, 0.58)');
  snGrad.addColorStop(1, 'rgba(28, 32, 40, 0)');
  snCtx.fillStyle = snGrad;
  snCtx.fillRect(0, 0, 256, 256);
  snCtx.strokeStyle = 'rgba(8, 10, 15, 0.94)';
  snCtx.lineWidth = 3.4;
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 + 0.11;
    const len = 76 + (i % 3) * 22;
    const mx = 110 + Math.cos(ang + 0.15) * (len * 0.48);
    const my = 128 + Math.sin(ang + 0.15) * (len * 0.48);
    snCtx.beginPath();
    snCtx.moveTo(110 + Math.cos(ang) * 12, 128 + Math.sin(ang) * 12);
    snCtx.lineTo(mx, my);
    snCtx.lineTo(110 + Math.cos(ang - 0.1) * len, 128 + Math.sin(ang - 0.1) * len);
    snCtx.stroke();
    // Secondary branched fractures
    snCtx.lineWidth = 2.0;
    snCtx.beginPath();
    snCtx.moveTo(mx, my);
    snCtx.lineTo(
      mx + Math.cos(ang - 0.48) * (len * 0.36),
      my + Math.sin(ang - 0.48) * (len * 0.36)
    );
    snCtx.stroke();
    snCtx.lineWidth = 3.4;
  }
  const bulletHoleAwpMap = new THREE.CanvasTexture(bhAwpCanvas);
  bulletHoleAwpMap.colorSpace = THREE.SRGBColorSpace;
  bulletHoleAwpMap.anisotropy = maxAnisotropy;

  const bulletHoleRifleMap = bulletHoleM4a1Map;
  const bulletHoleSmgMap = bulletHoleMp5Map;
  const bulletHoleSniperMap = bulletHoleAwpMap;

  // 7. Realistic Crimson Blood Splatter Decal Texture
  const blCanvas = document.createElement('canvas');
  blCanvas.width = 128;
  blCanvas.height = 128;
  const blCtx = blCanvas.getContext('2d')!;
  const blGrad = blCtx.createRadialGradient(64, 64, 4, 64, 64, 48);
  blGrad.addColorStop(0, 'rgba(135, 12, 18, 0.92)');
  blGrad.addColorStop(0.45, 'rgba(165, 18, 26, 0.75)');
  blGrad.addColorStop(0.8, 'rgba(110, 10, 15, 0.35)');
  blGrad.addColorStop(1, 'rgba(90, 8, 12, 0)');
  blCtx.fillStyle = blGrad;
  blCtx.beginPath();
  blCtx.arc(64, 64, 48, 0, Math.PI * 2);
  blCtx.fill();
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2 + (i % 3) * 0.2;
    const dist = 22 + (i % 4) * 9;
    const rad = 3 + (i % 3) * 2.5;
    blCtx.fillStyle = 'rgba(145, 15, 22, 0.82)';
    blCtx.beginPath();
    blCtx.arc(64 + Math.cos(ang) * dist, 64 + Math.sin(ang) * dist, rad, 0, Math.PI * 2);
    blCtx.fill();
  }
  const bloodSplatterMap = new THREE.CanvasTexture(blCanvas);
  bloodSplatterMap.colorSpace = THREE.SRGBColorSpace;

  // 8. Industrial Diamond-Plate / Steel Grating Deck Texture
  const mdCanvas = document.createElement('canvas');
  mdCanvas.width = 256;
  mdCanvas.height = 256;
  const mdCtx = mdCanvas.getContext('2d')!;
  mdCtx.fillStyle = '#4a5564';
  mdCtx.fillRect(0, 0, 256, 256);

  // Grating grid slots
  mdCtx.strokeStyle = '#1e242d';
  mdCtx.lineWidth = 3;
  for (let p = 0; p <= 256; p += 32) {
    mdCtx.beginPath();
    mdCtx.moveTo(p, 0);
    mdCtx.lineTo(p, 256);
    mdCtx.stroke();
    mdCtx.beginPath();
    mdCtx.moveTo(0, p);
    mdCtx.lineTo(256, p);
    mdCtx.stroke();
  }

  // Diamond-plate raised lugs & rivets
  for (let y = 16; y < 256; y += 32) {
    for (let x = 16; x < 256; x += 32) {
      mdCtx.fillStyle = '#6c7a8c';
      mdCtx.beginPath();
      mdCtx.moveTo(x, y - 6);
      mdCtx.lineTo(x + 6, y);
      mdCtx.lineTo(x, y + 6);
      mdCtx.lineTo(x - 6, y);
      mdCtx.closePath();
      mdCtx.fill();
    }
  }

  // Outer bolted steel plate border
  mdCtx.strokeStyle = 'rgba(226, 232, 240, 0.28)';
  mdCtx.lineWidth = 4;
  mdCtx.strokeRect(4, 4, 248, 248);

  const metalDeckMap = new THREE.CanvasTexture(mdCanvas);
  metalDeckMap.colorSpace = THREE.SRGBColorSpace;
  metalDeckMap.wrapS = THREE.RepeatWrapping;
  metalDeckMap.wrapT = THREE.RepeatWrapping;
  metalDeckMap.repeat.set(6, 6);
  metalDeckMap.anisotropy = maxAnisotropy;

  const metalDeckBump = new THREE.CanvasTexture(mdCanvas);
  metalDeckBump.wrapS = THREE.RepeatWrapping;
  metalDeckBump.wrapT = THREE.RepeatWrapping;
  metalDeckBump.repeat.set(6, 6);

  return {
    groundMap,
    groundBump,
    metalDeckMap,
    metalDeckBump,
    wallMap,
    containerMap,
    crateMap,
    muzzleFlashMap,
    bulletHoleMap: bulletHoleM4a1Map,
    bulletHoleMp5Map,
    bulletHoleM4a1Map,
    bulletHoleAk47Map,
    bulletHoleDeagleMap,
    bulletHoleShotgunMap,
    bulletHoleAwpMap,
    bulletHoleRifleMap,
    bulletHoleSmgMap,
    bulletHoleSniperMap,
    bloodSplatterMap,
    dispose: () => {
      groundMap.dispose();
      groundBump.dispose();
      metalDeckMap.dispose();
      metalDeckBump.dispose();
      wallMap.dispose();
      containerMap.dispose();
      crateMap.dispose();
      muzzleFlashMap.dispose();
      bulletHoleMp5Map.dispose();
      bulletHoleM4a1Map.dispose();
      bulletHoleAk47Map.dispose();
      bulletHoleDeagleMap.dispose();
      bulletHoleShotgunMap.dispose();
      bulletHoleAwpMap.dispose();
      bloodSplatterMap.dispose();
    },
  };
}

export interface WeaponViewModelRig {
  root: THREE.Group;
  gunGroup: THREE.Group;
  slideOrBolt: THREE.Object3D;
  slideBaseZ: number;
  triggerBlade: THREE.Object3D;
  triggerBaseZ: number;
  fireSelector: THREE.Object3D;
  magazine: THREE.Object3D;
  magBasePos: THREE.Vector3;
  pumpGrip: THREE.Object3D | null;
  pumpBaseZ: number;
  muzzleFlashGroup: THREE.Group;
  muzzleTipLocal: THREE.Vector3;
  ejectionPortLocal: THREE.Vector3;
}

/**
 * Builds a high-poly, rounded, cylindrical & contoured 3D first-person weapon viewmodel.
 * No floating arm/hand boxes — every part uses smooth cylindrical, capsule, torus, and beveled geometry.
 */
export function buildDetailedWeaponViewModel(
  weaponId: WeaponId,
  muzzleFlashMap: THREE.Texture
): WeaponViewModelRig {
  const spec = WEAPON_REGISTRY[weaponId];
  const root = new THREE.Group();
  const gunGroup = new THREE.Group();
  root.add(gunGroup);

  const primaryMetal = new THREE.MeshStandardMaterial({
    color: spec.bodyColorHex,
    roughness: weaponId === 'deagle' ? 0.18 : 0.28,
    metalness: weaponId === 'deagle' ? 0.92 : 0.82,
  });
  const darkSteel = new THREE.MeshStandardMaterial({
    color: 0x16191f,
    roughness: 0.26,
    metalness: 0.88,
  });
  const gunmetal = new THREE.MeshStandardMaterial({
    color: 0x262c35,
    roughness: 0.34,
    metalness: 0.78,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: spec.accentColorHex,
    roughness: weaponId === 'ak47' ? 0.52 : 0.38,
    metalness: weaponId === 'ak47' ? 0.18 : 0.55,
  });
  const chromeSteel = new THREE.MeshStandardMaterial({
    color: 0xd4dae3,
    roughness: 0.16,
    metalness: 0.95,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.22,
    metalness: 0.92,
  });
  const opticGlassMat = new THREE.MeshBasicMaterial({
    color: weaponId === 'ak47' ? 0xfbbf24 : 0x38bdf8,
    transparent: true,
    opacity: 0.78,
  });
  const reticleDotMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
  });

  const isPistol = weaponId === 'deagle';
  const isSniper = weaponId === 'awp';
  const isShotgun = weaponId === 'spas12';
  const isSmg = weaponId === 'mp5';
  const isAk = weaponId === 'ak47';

  const recLen = isPistol ? 0.21 : isSniper ? 0.46 : isShotgun ? 0.42 : isSmg ? 0.29 : 0.36;
  const recRadius = isPistol ? 0.021 : isSniper ? 0.028 : 0.026;

  // 1. Contoured Cylindrical & Capsule Upper + Lower Receiver Assembly
  // Upper Receiver (Smooth High-Poly Contoured Cylinder + Rounded Top Dust Cover)
  const upperCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(recRadius, recRadius * 1.04, recLen, 28),
    isAk ? darkSteel : primaryMetal
  );
  upperCylinder.rotation.x = Math.PI / 2;
  upperCylinder.scale.set(0.92, 1.0, 1.05);
  upperCylinder.position.set(0, 0.018, 0);
  gunGroup.add(upperCylinder);

  // Lower Receiver Contoured Chassis (Rounded Capsule Geometry)
  const lowerCapsule = new THREE.Mesh(
    new THREE.CapsuleGeometry(recRadius * 0.86, Math.max(0.05, recLen * 0.72), 16, 28),
    primaryMetal
  );
  lowerCapsule.rotation.x = Math.PI / 2;
  lowerCapsule.scale.set(0.95, 1.0, 0.82);
  lowerCapsule.position.set(0, -0.014, 0.01);
  gunGroup.add(lowerCapsule);

  // Side Machined Receiver Cheek Contours & Magwell Flare
  if (!isPistol) {
    const magwellFlare = new THREE.Mesh(
      new THREE.CylinderGeometry(recRadius * 0.92, recRadius * 1.08, 0.052, 24),
      gunmetal
    );
    magwellFlare.scale.set(0.85, 1, 1.35);
    magwellFlare.position.set(0, -0.036, -0.045);
    gunGroup.add(magwellFlare);
  }

  // Rounded Trigger Guard (Torus Arc) + Curved Trigger Blade
  const triggerGuard = new THREE.Mesh(
    new THREE.TorusGeometry(0.022, 0.0042, 14, 28, Math.PI * 1.15),
    darkSteel
  );
  triggerGuard.rotation.y = Math.PI / 2;
  triggerGuard.rotation.z = Math.PI * 0.92;
  triggerGuard.position.set(0, -0.036, isPistol ? 0.032 : 0.068);
  gunGroup.add(triggerGuard);

  const triggerBaseZ = isPistol ? 0.035 : 0.072;
  const triggerBlade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0025, 0.0035, 0.022, 12),
    chromeSteel
  );
  triggerBlade.rotation.x = 0.35;
  triggerBlade.position.set(0, -0.032, triggerBaseZ);
  gunGroup.add(triggerBlade);

  // Articulated Left-Side Fire Selector Lever (rotates during draw/inspect & fire mode)
  const fireSelector = new THREE.Group();
  const selectorPin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0042, 0.0042, 0.006, 14),
    chromeSteel
  );
  selectorPin.rotation.z = Math.PI / 2;
  const selectorArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.0024, 0.016, 8, 12),
    chromeSteel
  );
  selectorArm.position.set(-0.003, 0, -0.007);
  selectorArm.rotation.x = Math.PI / 2;
  fireSelector.add(selectorPin, selectorArm);
  fireSelector.position.set(-recRadius * 0.94, -0.006, isPistol ? 0.052 : 0.082);
  gunGroup.add(fireSelector);

  // 2. Precision Machined Top Picatinny Rail with Beveled Cylindrical Cross-Bolts
  const railGroup = new THREE.Group();
  const railBase = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.006, recLen * 0.82, 10, 20),
    darkSteel
  );
  railBase.rotation.x = Math.PI / 2;
  railBase.scale.set(1.8, 1.0, 0.7);
  railBase.position.set(0, 0.043, -0.008);
  railGroup.add(railBase);

  const ribCount = isPistol ? 6 : 14;
  for (let i = 0; i < ribCount; i++) {
    const rib = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0032, 0.0032, recRadius * 1.25, 12),
      gunmetal
    );
    rib.rotation.z = Math.PI / 2;
    const zOffset = -recLen * 0.4 + (i / Math.max(1, ribCount - 1)) * (recLen * 0.78);
    rib.position.set(0, 0.047, zOffset);
    railGroup.add(rib);
  }
  gunGroup.add(railGroup);

  // 3. High-Poly Tubular / Contoured Handguard & Barrel Shroud
  const hgLen = isPistol ? 0.085 : isSniper ? 0.38 : isShotgun ? 0.36 : isSmg ? 0.17 : 0.29;
  const hgCenterZ = -recLen * 0.5 - hgLen * 0.46;

  if (isPistol) {
    // Desert Eagle sculpted triangular-round barrel shroud
    const pistolBarrelShroud = new THREE.Mesh(
      new THREE.CylinderGeometry(recRadius * 0.96, recRadius * 1.02, hgLen * 1.2, 24),
      primaryMetal
    );
    pistolBarrelShroud.rotation.x = Math.PI / 2;
    pistolBarrelShroud.position.set(0, 0.018, hgCenterZ + 0.015);
    gunGroup.add(pistolBarrelShroud);
  } else {
    // Octagonal / Cylindrical Free-Float Handguard Shroud
    const handguardTube = new THREE.Mesh(
      new THREE.CylinderGeometry(
        recRadius * 0.92,
        recRadius * 0.98,
        hgLen,
        isAk ? 16 : 28
      ),
      accentMat
    );
    handguardTube.rotation.x = Math.PI / 2;
    handguardTube.position.set(0, 0.008, hgCenterZ);
    gunGroup.add(handguardTube);

    // Machined Barrel Nut & Handguard Locking Collars (Torus Rings)
    for (let c = 0; c < 4; c++) {
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(recRadius * 0.96, 0.0032, 14, 28),
        darkSteel
      );
      collar.position.set(0, 0.008, -recLen * 0.5 - 0.02 - c * (hgLen * 0.28));
      gunGroup.add(collar);
    }

    // Upper Gas Cylinder Tube inside/above Handguard
    const gasTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0085, 0.0085, hgLen * 0.96, 18),
      isAk ? accentMat : darkSteel
    );
    gasTube.rotation.x = Math.PI / 2;
    gasTube.position.set(0, 0.028, hgCenterZ);
    gunGroup.add(gasTube);
  }

  // 4. High-Poly Fluted Barrel & Underbarrel Assembly
  const barrelLen = isPistol ? 0.16 : isSniper ? 0.68 : isShotgun ? 0.47 : isSmg ? 0.23 : 0.43;
  const barrelRadius = isShotgun ? 0.0135 : isSniper ? 0.0125 : 0.01;
  const barrelZ = -recLen * 0.5 - barrelLen * 0.5 + 0.04;

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(barrelRadius, barrelRadius * 1.12, barrelLen, 28),
    isPistol ? chromeSteel : darkSteel
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.018, barrelZ);
  gunGroup.add(barrel);

  // Radial Cooling Rings along exposed barrel
  if (!isPistol) {
    const ringCount = isSniper ? 6 : 4;
    for (let r = 0; r < ringCount; r++) {
      const bRing = new THREE.Mesh(
        new THREE.TorusGeometry(barrelRadius * 1.08, 0.0022, 12, 24),
        gunmetal
      );
      bRing.position.set(0, 0.018, barrelZ - barrelLen * 0.15 - r * 0.032);
      gunGroup.add(bRing);
    }
  }

  // Underbarrel Shotgun Tubular Magazine or Rifle Gas Block
  if (isShotgun) {
    const magTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0125, 0.0125, barrelLen * 0.92, 24),
      gunmetal
    );
    magTube.rotation.x = Math.PI / 2;
    magTube.position.set(0, -0.006, barrelZ + 0.02);
    const tubeCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0135, 0.0135, 0.025, 24),
      chromeSteel
    );
    tubeCap.rotation.x = Math.PI / 2;
    tubeCap.position.set(0, -0.006, barrelZ - barrelLen * 0.45);
    gunGroup.add(magTube, tubeCap);
  } else if (!isPistol) {
    const gasBlock = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.042, 20),
      darkSteel
    );
    gasBlock.rotation.x = Math.PI / 2;
    gasBlock.position.set(0, 0.022, -recLen * 0.5 - hgLen * 0.92);
    gunGroup.add(gasBlock);
  }

  // 5. Multi-Chamber Cylindrical Muzzle Brake / Tactical Suppressor
  const muzzleZ = -recLen * 0.5 - barrelLen + 0.035;
  const muzzleDiameter = isSmg ? barrelRadius * 1.85 : barrelRadius * 1.5;
  const muzzleLength = isSmg ? 0.11 : isSniper ? 0.075 : 0.058;
  const muzzleBrake = new THREE.Mesh(
    new THREE.CylinderGeometry(muzzleDiameter, muzzleDiameter * 0.95, muzzleLength, 28),
    isSmg ? gunmetal : darkSteel
  );
  muzzleBrake.rotation.x = Math.PI / 2;
  muzzleBrake.position.set(0, 0.018, muzzleZ);
  gunGroup.add(muzzleBrake);

  for (let m = -1; m <= 1; m++) {
    const portRing = new THREE.Mesh(
      new THREE.TorusGeometry(muzzleDiameter * 1.02, 0.0024, 12, 24),
      chromeSteel
    );
    portRing.position.set(0, 0.018, muzzleZ + m * (muzzleLength * 0.28));
    gunGroup.add(portRing);
  }

  // Front Hooded Ring Sight (Round Protective Hood + Fiber Optic Post)
  const frontSightHood = new THREE.Mesh(
    new THREE.TorusGeometry(0.011, 0.0022, 12, 24, Math.PI * 1.3),
    darkSteel
  );
  frontSightHood.rotation.z = -Math.PI * 0.15;
  frontSightHood.position.set(0, 0.044, muzzleZ + 0.065);
  const frontSightPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0018, 0.0022, 0.016, 10),
    reticleDotMat
  );
  frontSightPost.position.set(0, 0.041, muzzleZ + 0.065);
  gunGroup.add(frontSightHood, frontSightPost);

  // 6. High-Poly Round Tubular Optic / Scope Assembly
  if (isSniper) {
    const scopeGroup = new THREE.Group();
    // Dual Circular Scope Mount Rings
    for (const zPos of [-0.085, 0.045]) {
      const ringMount = new THREE.Mesh(
        new THREE.TorusGeometry(0.023, 0.0045, 14, 28),
        darkSteel
      );
      ringMount.position.set(0, 0.084, zPos);
      const riser = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.011, 0.026, 16),
        darkSteel
      );
      riser.position.set(0, 0.058, zPos);
      scopeGroup.add(ringMount, riser);
    }

    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.26, 32),
      darkSteel
    );
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.084, -0.02);

    const bellFront = new THREE.Mesh(
      new THREE.CylinderGeometry(0.031, 0.02, 0.075, 32),
      darkSteel
    );
    bellFront.rotation.x = Math.PI / 2;
    bellFront.position.set(0, 0.084, -0.175);

    const bellRear = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.026, 0.058, 32),
      darkSteel
    );
    bellRear.rotation.x = Math.PI / 2;
    bellRear.position.set(0, 0.084, 0.13);

    // Elevation & Windage Knurled Cylindrical Turrets
    const topTurret = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.018, 20),
      gunmetal
    );
    topTurret.position.set(0, 0.108, -0.02);
    const sideTurret = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.018, 20),
      gunmetal
    );
    sideTurret.rotation.z = Math.PI / 2;
    sideTurret.position.set(0.024, 0.084, -0.02);

    const lensRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.025, 0.0028, 14, 32),
      gunmetal
    );
    lensRim.position.set(0, 0.084, 0.158);

    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.023, 28), opticGlassMat);
    lens.position.set(0, 0.084, 0.159);

    const reticle = new THREE.Mesh(new THREE.CircleGeometry(0.0028, 16), reticleDotMat);
    reticle.position.set(0, 0.084, 0.16);

    scopeGroup.add(
      tube,
      bellFront,
      bellRear,
      topTurret,
      sideTurret,
      lensRim,
      lens,
      reticle
    );
    gunGroup.add(scopeGroup);
  } else if (!isPistol) {
    // Round Cylindrical Aimpoint / CompM4 Tubular Red-Dot Reflex Sight
    const reflexGroup = new THREE.Group();
    const riserMount = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.018, 0.022, 20),
      darkSteel
    );
    riserMount.scale.set(1.0, 1.0, 1.8);
    riserMount.position.set(0, 0.056, 0.01);

    const opticTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.021, 0.021, 0.082, 32),
      darkSteel
    );
    opticTube.rotation.x = Math.PI / 2;
    opticTube.position.set(0, 0.078, 0.01);

    const frontBezel = new THREE.Mesh(
      new THREE.TorusGeometry(0.021, 0.0028, 14, 28),
      gunmetal
    );
    frontBezel.position.set(0, 0.078, -0.031);

    const rearBezel = new THREE.Mesh(
      new THREE.TorusGeometry(0.021, 0.0028, 14, 28),
      gunmetal
    );
    rearBezel.position.set(0, 0.078, 0.051);

    const batteryTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0065, 0.0065, 0.052, 16),
      gunmetal
    );
    batteryTube.rotation.x = Math.PI / 2;
    batteryTube.position.set(0.018, 0.092, 0.01);

    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.019, 28), opticGlassMat);
    glass.position.set(0, 0.078, 0.048);

    const redDot = new THREE.Mesh(new THREE.CircleGeometry(0.0026, 16), reticleDotMat);
    redDot.position.set(0, 0.078, 0.049);

    reflexGroup.add(
      riserMount,
      opticTube,
      frontBezel,
      rearBezel,
      batteryTube,
      glass,
      redDot
    );
    gunGroup.add(reflexGroup);
  } else {
    // Pistol Rounded Fiber-Optic Rear Sight
    const rearSight = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.006, 0.018, 10, 16),
      darkSteel
    );
    rearSight.rotation.z = Math.PI / 2;
    rearSight.position.set(0, 0.048, 0.078);
    const tritiumDotL = new THREE.Mesh(new THREE.CircleGeometry(0.0022, 12), opticGlassMat);
    tritiumDotL.position.set(-0.006, 0.048, 0.085);
    const tritiumDotR = new THREE.Mesh(new THREE.CircleGeometry(0.0022, 12), opticGlassMat);
    tritiumDotR.position.set(0.006, 0.048, 0.085);
    gunGroup.add(rearSight, tritiumDotL, tritiumDotR);
  }

  // 7. Reciprocating Cylindrical Bolt Carrier / Contoured Slide
  const slideGroup = new THREE.Group();
  const slideBaseZ = isPistol ? -0.008 : 0.02;
  if (isPistol) {
    const slideMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(recRadius * 0.98, recRadius * 1.02, recLen * 1.04, 24),
      primaryMetal
    );
    slideMesh.rotation.x = Math.PI / 2;
    slideMesh.scale.set(0.95, 1.0, 0.85);
    slideMesh.position.set(0, 0.026, 0);
    const ejectionPort = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.044, 16),
      brassMat
    );
    ejectionPort.rotation.x = Math.PI / 2;
    ejectionPort.position.set(recRadius * 0.65, 0.028, 0.01);
    slideGroup.add(slideMesh, ejectionPort);
  } else {
    const boltCarrier = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.072, 20),
      chromeSteel
    );
    boltCarrier.rotation.x = Math.PI / 2;
    boltCarrier.position.set(recRadius * 0.68, 0.02, 0);

    const chargingHandleStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0038, 0.0038, 0.026, 14),
      darkSteel
    );
    chargingHandleStem.rotation.z = Math.PI / 2;
    chargingHandleStem.position.set(recRadius * 0.98, 0.022, -0.02);

    const chargingKnob = new THREE.Mesh(
      new THREE.SphereGeometry(0.007, 16, 16),
      darkSteel
    );
    chargingKnob.position.set(recRadius * 1.12, 0.022, -0.02);

    slideGroup.add(boltCarrier, chargingHandleStem, chargingKnob);
  }
  slideGroup.position.set(0, 0, slideBaseZ);
  gunGroup.add(slideGroup);

  // 8. Ribbed Cylindrical Pump Foregrip (SPAS-12) or Contoured Vertical Foregrip
  let pumpGrip: THREE.Object3D | null = null;
  const pumpBaseZ = -recLen * 0.5 - hgLen * 0.45;
  if (isShotgun) {
    const pumpGroup = new THREE.Group();
    const pumpBody = new THREE.Mesh(
      new THREE.CylinderGeometry(recRadius * 1.05, recRadius * 1.05, 0.14, 24),
      darkSteel
    );
    pumpBody.rotation.x = Math.PI / 2;
    pumpGroup.add(pumpBody);
    for (let r = -2; r <= 2; r++) {
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(recRadius * 1.07, 0.0028, 12, 24),
        gunmetal
      );
      rib.position.set(0, 0, r * 0.024);
      pumpGroup.add(rib);
    }
    pumpGroup.position.set(0, -0.01, pumpBaseZ);
    gunGroup.add(pumpGroup);
    pumpGrip = pumpGroup;
  } else if (weaponId === 'm4a1' || weaponId === 'mp5') {
    const vGrip = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.013, 0.068, 14, 24),
      darkSteel
    );
    vGrip.position.set(0, -0.056, pumpBaseZ + 0.02);
    gunGroup.add(vGrip);
  }

  // 9. Contoured / Curved Multi-Segment Detachable Magazine (Animates during Reload)
  const magGroup = new THREE.Group();
  const magLen = isPistol ? 0.11 : isSniper ? 0.095 : isSmg ? 0.165 : 0.16;

  if (isAk || isSmg) {
    // Authentic Curved Banana Magazine built from smooth overlapping capsule segments
    const segCount = 5;
    for (let s = 0; s < segCount; s++) {
      const t = s / (segCount - 1);
      const seg = new THREE.Mesh(
        new THREE.CapsuleGeometry(isSmg ? 0.013 : 0.017, magLen / segCount, 12, 20),
        isAk ? accentMat : gunmetal
      );
      seg.scale.set(0.85, 1.0, isSmg ? 1.45 : 1.75);
      const curveAngle = t * (isAk ? 0.42 : 0.32);
      seg.position.set(
        0,
        -t * magLen * 0.86,
        -Math.sin(curveAngle) * (isAk ? 0.048 : 0.032)
      );
      seg.rotation.x = -curveAngle;
      magGroup.add(seg);
    }
  } else {
    const magBody = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.016, magLen * 0.72, 14, 24),
      gunmetal
    );
    magBody.scale.set(0.85, 1.0, isSniper ? 2.1 : 1.65);
    magBody.position.set(0, -magLen * 0.35, 0);
    const magFloorplate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.019, 0.021, 0.014, 20),
      darkSteel
    );
    magFloorplate.scale.set(0.85, 1.0, isSniper ? 2.15 : 1.7);
    magFloorplate.position.set(0, -magLen * 0.78, 0);
    magGroup.add(magBody, magFloorplate);
  }

  const magBasePos = new THREE.Vector3(
    0,
    isPistol ? -0.048 : -0.052,
    isPistol ? 0.068 : -0.048
  );
  magGroup.position.copy(magBasePos);
  magGroup.rotation.x = isPistol ? 0.2 : -0.08;
  if (isShotgun) {
    magGroup.visible = false;
  }
  gunGroup.add(magGroup);

  // 10. Contoured Ergonomic Pistol Grip & Cylindrical Buffer Tube / Buttstock
  const grip = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.018, 0.078, 16, 24),
    isAk ? accentMat : darkSteel
  );
  grip.scale.set(0.92, 1.0, 1.28);
  grip.position.set(0, -0.065, isPistol ? 0.068 : 0.115);
  grip.rotation.x = 0.28;
  gunGroup.add(grip);

  if (!isPistol) {
    const stockLen = isSniper ? 0.26 : 0.22;
    const stockStartZ = recLen * 0.5;

    // Cylindrical Buffer Tube
    const bufferTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.017, 0.017, stockLen * 0.96, 24),
      darkSteel
    );
    bufferTube.rotation.x = Math.PI / 2;
    bufferTube.position.set(0, 0.008, stockStartZ + stockLen * 0.46);
    gunGroup.add(bufferTube);

    // Contoured Cheek Rest & Buttstock Body
    const cheekRest = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.024, stockLen * 0.68, 16, 24),
      isAk || isSniper ? accentMat : gunmetal
    );
    cheekRest.rotation.x = Math.PI / 2;
    cheekRest.scale.set(0.88, 1.0, 1.25);
    cheekRest.position.set(0, -0.008, stockStartZ + stockLen * 0.54);
    gunGroup.add(cheekRest);

    // Lower Stock Strut Cylinder
    const stockStrut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.012, stockLen * 0.65, 16),
      darkSteel
    );
    stockStrut.rotation.x = Math.PI / 2 - 0.28;
    stockStrut.position.set(0, -0.036, stockStartZ + stockLen * 0.58);
    gunGroup.add(stockStrut);

    // Rubberized Recoil Buttpad
    const buttPad = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.022, 0.065, 14, 24),
      darkSteel
    );
    buttPad.scale.set(0.85, 1.0, 0.55);
    buttPad.position.set(0, -0.018, stockStartZ + stockLen * 0.94);
    gunGroup.add(buttPad);
  }

  // 11. 3-Axis Volumetric Muzzle Flash Assembly
  const muzzleFlashGroup = new THREE.Group();
  const mfMat = new THREE.MeshBasicMaterial({
    map: muzzleFlashMap,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const flashFront = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), mfMat);
  const flashCrossH = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.18), mfMat);
  flashCrossH.rotation.y = Math.PI / 2;
  flashCrossH.position.z = -0.08;
  const flashCrossV = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.18), mfMat);
  flashCrossV.rotation.y = Math.PI / 2;
  flashCrossV.rotation.x = Math.PI / 2;
  flashCrossV.position.z = -0.08;

  muzzleFlashGroup.add(flashFront, flashCrossH, flashCrossV);
  const muzzleTipLocal = new THREE.Vector3(0, 0.018, muzzleZ - muzzleLength * 0.55);
  muzzleFlashGroup.position.copy(muzzleTipLocal);
  muzzleFlashGroup.visible = false;
  gunGroup.add(muzzleFlashGroup);

  const ejectionPortLocal = new THREE.Vector3(recRadius * 0.85, 0.026, slideBaseZ);

  return {
    root,
    gunGroup,
    slideOrBolt: slideGroup,
    slideBaseZ,
    triggerBlade,
    triggerBaseZ,
    fireSelector,
    magazine: magGroup,
    magBasePos,
    pumpGrip,
    pumpBaseZ,
    muzzleFlashGroup,
    muzzleTipLocal,
    ejectionPortLocal,
  };
}

export interface EnemySoldierRig {
  group: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  visorMesh: THREE.Mesh;
  muzzleFlash: THREE.Mesh;
  hpBarBg: THREE.Mesh;
  hpBarFill: THREE.Mesh;
  sniperLaser: THREE.Line;
}

/**
 * Builds an articulated 3D tactical enemy operator with ballistic helmet, NVG goggles,
 * plate carrier vest with MOLLE pouches, articulated limbs, shouldered rifle, and muzzle flash.
 */
export function buildDetailedEnemySoldier(
  archetype: 'assault' | 'rusher' | 'sniper',
  muzzleFlashMap: THREE.Texture
): EnemySoldierRig {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);

  const uniformColor =
    archetype === 'rusher' ? 0x2b2124 : archetype === 'sniper' ? 0x262c24 : 0x222933;
  const vestColor =
    archetype === 'rusher' ? 0x3f1d24 : archetype === 'sniper' ? 0x333c2e : 0x1b2028;
  const visorColor =
    archetype === 'rusher' ? 0xf97316 : archetype === 'sniper' ? 0xa855f7 : 0xef4444;

  const uniformMat = new THREE.MeshStandardMaterial({
    color: uniformColor,
    roughness: 0.72,
    metalness: 0.12,
  });
  const vestMat = new THREE.MeshStandardMaterial({
    color: vestColor,
    roughness: 0.52,
    metalness: 0.32,
  });
  const darkGearMat = new THREE.MeshStandardMaterial({
    color: 0x15181e,
    roughness: 0.42,
    metalness: 0.58,
  });
  const visorMat = new THREE.MeshBasicMaterial({
    color: visorColor,
  });

  // 1. Articulated Left & Right Legs (Pivoted at Hips y = 0.88)
  const buildLeg = (side: -1 | 1): THREE.Group => {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(side * 0.16, 0.88, 0);

    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.095, 0.26, 10, 16),
      uniformMat
    );
    thigh.position.set(0, -0.22, 0);
    thigh.castShadow = true;

    const kneePad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.105, 0.11, 14),
      darkGearMat
    );
    kneePad.position.set(0, -0.44, 0.02);

    const shin = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.082, 0.22, 10, 16),
      uniformMat
    );
    shin.position.set(0, -0.64, 0);
    shin.castShadow = true;

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.28), darkGearMat);
    boot.position.set(0, -0.81, 0.04);

    hipPivot.add(thigh, kneePad, shin, boot);
    return hipPivot;
  };

  const leftLegPivot = buildLeg(-1);
  const rightLegPivot = buildLeg(1);
  bodyPivot.add(leftLegPivot, rightLegPivot);

  // 2. Pelvis Belt, Torso & Tactical Plate Carrier Vest
  const pelvis = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.22, 0.16, 18),
    darkGearMat
  );
  pelvis.scale.set(1.1, 1, 0.72);
  pelvis.position.set(0, 0.92, 0);
  bodyPivot.add(pelvis);

  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.24, 0.3, 12, 20),
    uniformMat
  );
  torso.scale.set(1.1, 1, 0.72);
  torso.position.set(0, 1.24, 0);
  torso.castShadow = true;
  bodyPivot.add(torso);

  const plateCarrier = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.26, 0.44, 18),
    vestMat
  );
  plateCarrier.scale.set(1.08, 1, 0.74);
  plateCarrier.position.set(0, 1.25, 0);
  plateCarrier.castShadow = true;
  bodyPivot.add(plateCarrier);

  for (let i = -1; i <= 1; i++) {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 0.06), darkGearMat);
    pouch.position.set(i * 0.14, 1.15, 0.19);
    bodyPivot.add(pouch);
  }

  // 3. Head, Rounded Ballistic Helmet, Visor & NVG Goggles
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.68, 0);

  const headSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.165, 20, 20),
    darkGearMat
  );
  headSphere.castShadow = true;
  headGroup.add(headSphere);

  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
    vestMat
  );
  helmet.position.set(0, 0.02, -0.01);
  headGroup.add(helmet);

  const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.05), visorMat);
  visorMesh.position.set(0, 0.01, 0.15);
  headGroup.add(visorMesh);

  const nvgMount = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.055, 0.08), darkGearMat);
  nvgMount.position.set(0, 0.11, 0.18);
  headGroup.add(nvgMount);

  bodyPivot.add(headGroup);

  // 4. Articulated Shoulders, Arms & Shouldered Tactical Rifle
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.34, 1.44, 0);
  const leftShoulderPad = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 14, 14),
    vestMat
  );
  const leftArmMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.068, 0.32, 10, 16),
    uniformMat
  );
  leftArmMesh.position.set(0.06, -0.18, 0.16);
  leftArmMesh.rotation.x = -0.95;
  leftArmMesh.rotation.z = -0.35;
  leftArmPivot.add(leftShoulderPad, leftArmMesh);
  bodyPivot.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.34, 1.44, 0);
  const rightShoulderPad = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 14, 14),
    vestMat
  );
  const rightArmMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.068, 0.32, 10, 16),
    uniformMat
  );
  rightArmMesh.position.set(-0.04, -0.16, 0.16);
  rightArmMesh.rotation.x = -1.1;

  // Enemy Rifle Model attached to Right Arm Pivot
  const rifleBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.045, 0.66, 16),
    darkGearMat
  );
  rifleBody.rotation.x = Math.PI / 2;
  rifleBody.position.set(-0.12, -0.14, 0.42);
  const rifleBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.36, 14),
    darkGearMat
  );
  rifleBarrel.rotation.x = Math.PI / 2;
  rifleBarrel.position.set(-0.12, -0.12, 0.84);

  const mfMat = new THREE.MeshBasicMaterial({
    map: muzzleFlashMap,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const muzzleFlash = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.38), mfMat);
  muzzleFlash.position.set(-0.12, -0.12, 1.04);
  muzzleFlash.visible = false;

  rightArmPivot.add(rightShoulderPad, rightArmMesh, rifleBody, rifleBarrel, muzzleFlash);
  bodyPivot.add(rightArmPivot);

  // 5. Overhead World-Space Health Bar
  const hpBarBg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.86, 0.09),
    new THREE.MeshBasicMaterial({ color: 0x090b10, side: THREE.DoubleSide })
  );
  hpBarBg.position.set(0, 2.16, 0);
  group.add(hpBarBg);

  const hpBarFill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 0.055),
    new THREE.MeshBasicMaterial({
      color: visorColor,
      side: THREE.DoubleSide,
    })
  );
  hpBarFill.position.set(0, 2.16, 0.01);
  group.add(hpBarFill);

  // 6. Sniper Telegraph Laser Line
  const laserGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 1.32, 0),
    new THREE.Vector3(0, 1.32, 20),
  ]);
  const laserMat = new THREE.LineBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.78,
  });
  const sniperLaser = new THREE.Line(laserGeo, laserMat);
  sniperLaser.visible = false;
  group.add(sniperLaser);

  return {
    group,
    bodyPivot,
    headGroup,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    visorMesh,
    muzzleFlash,
    hpBarBg,
    hpBarFill,
    sniperLaser,
  };
}
