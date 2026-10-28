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
  blastScorchMap: THREE.CanvasTexture;
  fireballCloudMap: THREE.CanvasTexture;
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

  // ============================================================================
  // 6. RESEARCHED MULTI-CALIBER BALLISTIC GUNSHOT MARK TEXTURE SYSTEM (512x512)
  // ============================================================================
  // Based on forensic ballistics research across 6 calibers (matching /public/gunmarks/*.png):
  // - 9x19mm Parabellum (MP5-K): 9mm bore, ~28mm shallow conical spall pit, dark lead bullet-wipe ring, 5 fine cracks
  // - 5.56x45mm NATO (M4A1): 5.56mm high-velocity yaw fragmentation crater (~42mm), bright exposed concrete rim, copper-jacket flecks, 7 sharp cracks
  // - 7.62x39mm M43 (AK-47): 7.62mm heavy steel-core blowout (~58mm), stepped spall basin, blasted aggregate chips, 10 branched fractures
  // - .50 Action Express (Desert Eagle): 12.7mm blunt-force bowl crater (~64mm), pulverized white cement crush ring, concentric compression arcs
  // - 12-Gauge 00 Buckshot (SPAS-12): Individual 8.4mm (0.33") lead pellet pit with compact spall lip (spawned per pellet ray!)
  // - .338 Lapua Magnum (AWP): 8.6mm 6,500J structural penetration cavern (~88mm), dual-ring spalled concrete shelf, 14 deep branched fissures
  interface CaliberCraterSpec {
    outerDustR: number;
    spallR: number;
    innerShelfR: number;
    boreR: number;
    lobes: number;
    crackCount: number;
    crackLen: number;
    crackWidth: number;
    branchedCracks: boolean;
    concentricArcs: boolean;
    copperTransfer: boolean;
    rubbleChunks: number;
    seed: number;
  }

  const renderCaliberImpactDecalTexture = (spec: CaliberCraterSpec): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const cx = 256;
    const cy = 256;

    // 1. Subtle outer pulverized masonry dust & carbon blast halo
    const haloGrad = ctx.createRadialGradient(cx, cy, spec.boreR * 0.8, cx, cy, spec.outerDustR);
    haloGrad.addColorStop(0, 'rgba(15, 23, 42, 0.52)');
    haloGrad.addColorStop(0.38, 'rgba(71, 85, 105, 0.36)');
    haloGrad.addColorStop(0.72, 'rgba(148, 163, 184, 0.18)');
    haloGrad.addColorStop(1, 'rgba(148, 163, 184, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, spec.outerDustR, 0, Math.PI * 2);
    ctx.fill();

    // Build irregular chipped polygonal spall rim vertices
    const buildRimPolygon = (radius: number, lobeCount: number, seedOffset: number) => {
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < lobeCount; i++) {
        const ang = (i / lobeCount) * Math.PI * 2;
        const n1 = Math.sin(ang * 3 + spec.seed + seedOffset) * 0.14;
        const n2 = Math.cos(ang * 5 - spec.seed * 1.3 + seedOffset) * 0.09;
        const n3 = Math.sin(ang * 9 + spec.seed * 2.1) * 0.05;
        const r = radius * (0.88 + n1 + n2 + n3);
        pts.push({
          x: cx + Math.cos(ang) * r,
          y: cy + Math.sin(ang) * r,
        });
      }
      return pts;
    };

    const outerPts = buildRimPolygon(spec.spallR, spec.lobes, 0);

    // 2. 3D Recessed Top-Left Shadow Lip & Bottom-Right Sunlit Chipped Stone Rim
    ctx.save();
    ctx.translate(-3.5, -3.5);
    ctx.fillStyle = 'rgba(2, 6, 14, 0.88)';
    ctx.beginPath();
    outerPts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(2.5, 2.5);
    ctx.fillStyle = 'rgba(241, 245, 249, 0.72)';
    ctx.beginPath();
    outerPts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 3. Exposed fractured concrete spall cone (light chalky rim -> dark crushed interior)
    const spallGrad = ctx.createRadialGradient(
      cx - spec.spallR * 0.16,
      cy - spec.spallR * 0.16,
      spec.boreR * 0.5,
      cx + spec.spallR * 0.12,
      cy + spec.spallR * 0.12,
      spec.spallR * 1.15
    );
    spallGrad.addColorStop(0, 'rgba(15, 23, 42, 0.98)');
    spallGrad.addColorStop(0.45, 'rgba(51, 65, 85, 0.95)');
    spallGrad.addColorStop(0.78, 'rgba(148, 163, 184, 0.92)');
    spallGrad.addColorStop(1, 'rgba(226, 232, 240, 0.88)');
    ctx.fillStyle = spallGrad;
    ctx.beginPath();
    outerPts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();

    // 4. Stepped inner spall shelf for heavy rifle / magnum calibers
    if (spec.innerShelfR > 0) {
      const innerPts = buildRimPolygon(spec.innerShelfR, Math.max(10, spec.lobes - 4), 2.4);
      const shelfGrad = ctx.createRadialGradient(cx, cy, spec.boreR * 0.4, cx, cy, spec.innerShelfR);
      shelfGrad.addColorStop(0, 'rgba(5, 8, 16, 0.98)');
      shelfGrad.addColorStop(0.65, 'rgba(30, 41, 59, 0.96)');
      shelfGrad.addColorStop(1, 'rgba(100, 116, 139, 0.9)');
      ctx.fillStyle = shelfGrad;
      ctx.beginPath();
      innerPts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(203, 213, 225, 0.55)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    // 5. Coarse exposed aggregate stone speckles & ejected rubble fragments inside spall basin
    for (let i = 0; i < spec.lobes * 3; i++) {
      const a = i * 2.39996 + spec.seed;
      const d = spec.boreR * 1.15 + ((i * 29) % 100) * 0.01 * (spec.spallR - spec.boreR * 1.1);
      const gx = cx + Math.cos(a) * d;
      const gy = cy + Math.sin(a) * d;
      const gr = 2.0 + (i % 4) * 1.4;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(241, 245, 249, 0.78)' : 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.arc(gx, gy, gr, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < spec.rubbleChunks; i++) {
      const ang = (i / spec.rubbleChunks) * Math.PI * 2 + spec.seed * 0.17;
      const dist = spec.spallR * (0.76 + ((i * 13) % 35) * 0.01);
      const rx = cx + Math.cos(ang) * dist;
      const ry = cy + Math.sin(ang) * dist;
      const rad = 5.5 + (i % 3) * 3.2;
      ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
      ctx.beginPath();
      ctx.arc(rx + 1.8, ry + 1.8, rad + 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.beginPath();
      ctx.arc(rx, ry, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Concentric blunt-force compression rings (.50 AE & .338 Lapua)
    if (spec.concentricArcs) {
      for (let ring = 0; ring < 2; ring++) {
        const arcR = spec.boreR + (spec.spallR - spec.boreR) * (0.48 + ring * 0.28);
        const startA = ring * 1.7 + spec.seed * 0.2;
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.65)';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(cx + 1.2, cy + 1.2, arcR, startA, startA + Math.PI * 1.35);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(6, 10, 19, 0.92)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(cx, cy, arcR, startA, startA + Math.PI * 1.35);
        ctx.stroke();
      }
    }

    // 7. Radial stress fractures with 3D chipped stone edge highlight
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < spec.crackCount; i++) {
      const baseAng =
        (i / spec.crackCount) * Math.PI * 2 +
        Math.sin(i * 4.1 + spec.seed) * (0.22 / Math.max(1, spec.crackCount));
      const len = spec.crackLen * (0.78 + ((i * 23 + spec.seed * 7) % 44) * 0.01);
      const r0 = spec.boreR * 0.85;
      const r1 = r0 + len * 0.35;
      const r2 = r0 + len * 0.72;
      const r3 = r0 + len;

      const a1 = baseAng + (i % 2 === 0 ? 0.08 : -0.08);
      const a2 = baseAng + (i % 2 === 0 ? -0.06 : 0.07);
      const a3 = baseAng + (i % 3 === 0 ? 0.05 : -0.04);

      const x0 = cx + Math.cos(baseAng) * r0;
      const y0 = cy + Math.sin(baseAng) * r0;
      const x1 = cx + Math.cos(a1) * r1;
      const y1 = cy + Math.sin(a1) * r1;
      const x2 = cx + Math.cos(a2) * r2;
      const y2 = cy + Math.sin(a2) * r2;
      const x3 = cx + Math.cos(a3) * r3;
      const y3 = cy + Math.sin(a3) * r3;

      // Chipped stone lip highlight
      ctx.strokeStyle = 'rgba(241, 245, 249, 0.62)';
      ctx.lineWidth = spec.crackWidth + 1.6;
      ctx.beginPath();
      ctx.moveTo(x0 + 1.4, y0 + 1.4);
      ctx.lineTo(x1 + 1.4, y1 + 1.4);
      ctx.lineTo(x2 + 1.4, y2 + 1.4);
      ctx.lineTo(x3 + 1.4, y3 + 1.4);
      ctx.stroke();

      // Deep dark stress fracture
      ctx.strokeStyle = 'rgba(4, 7, 14, 0.95)';
      ctx.lineWidth = spec.crackWidth;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.stroke();

      if (spec.branchedCracks && i % 2 === 0) {
        const bAng = a1 + (i % 4 === 0 ? 0.42 : -0.42);
        const bLen = len * 0.42;
        const bx = x1 + Math.cos(bAng) * bLen;
        const by = y1 + Math.sin(bAng) * bLen;

        ctx.strokeStyle = 'rgba(241, 245, 249, 0.48)';
        ctx.lineWidth = Math.max(1.2, spec.crackWidth * 0.65) + 1.2;
        ctx.beginPath();
        ctx.moveTo(x1 + 1.1, y1 + 1.1);
        ctx.lineTo(bx + 1.1, by + 1.1);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(4, 7, 14, 0.9)';
        ctx.lineWidth = Math.max(1.2, spec.crackWidth * 0.65);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
    }

    // 8. Dark graphite lead bullet-wipe ring & propellant soot smudge around entry bore
    const wipeR = spec.boreR * 1.72;
    const wipeGrad = ctx.createRadialGradient(cx, cy, spec.boreR * 0.55, cx, cy, wipeR);
    wipeGrad.addColorStop(0, 'rgba(2, 4, 9, 1)');
    wipeGrad.addColorStop(0.55, 'rgba(15, 23, 42, 0.96)');
    wipeGrad.addColorStop(0.82, 'rgba(51, 65, 85, 0.72)');
    wipeGrad.addColorStop(1, 'rgba(51, 65, 85, 0)');
    ctx.fillStyle = wipeGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, wipeR, 0, Math.PI * 2);
    ctx.fill();

    // 9. Deep crushed bullet penetration bore cavity
    const borePts = buildRimPolygon(spec.boreR, 12, 5.1);
    ctx.fillStyle = 'rgba(2, 3, 7, 0.99)';
    ctx.beginPath();
    borePts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();

    // Inner bore wall depth rim
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.75)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(cx + 1.5, cy + 1.5, spec.boreR * 0.92, -Math.PI * 0.35, Math.PI * 0.65);
    ctx.stroke();

    // 10. Copper-jacket FMJ micro-transfer flecks around bore perimeter
    if (spec.copperTransfer) {
      ctx.fillStyle = 'rgba(194, 120, 72, 0.74)';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + spec.seed * 0.3;
        const fx = cx + Math.cos(a) * (spec.boreR * 1.12);
        const fy = cy + Math.sin(a) * (spec.boreR * 1.12);
        ctx.beginPath();
        ctx.arc(fx, fy, 2.6 + (i % 2) * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    return tex;
  };

  // 6A. MP5-K (9x19mm Parabellum) — Compact 9mm bore pit, neat conical spall, 5 fine cracks
  const bulletHoleMp5Map = renderCaliberImpactDecalTexture({
    outerDustR: 138,
    spallR: 82,
    innerShelfR: 0,
    boreR: 34,
    lobes: 12,
    crackCount: 5,
    crackLen: 78,
    crackWidth: 2.6,
    branchedCracks: false,
    concentricArcs: false,
    copperTransfer: false,
    rubbleChunks: 3,
    seed: 11,
  });

  // 6B. M4A1 Carbine (5.56x45mm NATO) — High-velocity fragmentation spall cone, copper flecks, 7 sharp cracks
  const bulletHoleM4a1Map = renderCaliberImpactDecalTexture({
    outerDustR: 168,
    spallR: 102,
    innerShelfR: 62,
    boreR: 36,
    lobes: 14,
    crackCount: 7,
    crackLen: 108,
    crackWidth: 3.2,
    branchedCracks: true,
    concentricArcs: false,
    copperTransfer: true,
    rubbleChunks: 5,
    seed: 23,
  });

  // 6C. AK-47 (7.62x39mm M43) — Heavy steel-core masonry blowout, stepped shelf, 10 branched cracks
  const bulletHoleAk47Map = renderCaliberImpactDecalTexture({
    outerDustR: 196,
    spallR: 124,
    innerShelfR: 78,
    boreR: 44,
    lobes: 16,
    crackCount: 10,
    crackLen: 136,
    crackWidth: 4.0,
    branchedCracks: true,
    concentricArcs: false,
    copperTransfer: true,
    rubbleChunks: 8,
    seed: 37,
  });

  // 6D. Desert Eagle (.50 Action Express) — Wide 12.7mm blunt-force bowl crater, concentric crush arcs
  const bulletHoleDeagleMap = renderCaliberImpactDecalTexture({
    outerDustR: 204,
    spallR: 132,
    innerShelfR: 86,
    boreR: 52,
    lobes: 15,
    crackCount: 8,
    crackLen: 132,
    crackWidth: 4.2,
    branchedCracks: true,
    concentricArcs: true,
    copperTransfer: true,
    rubbleChunks: 7,
    seed: 51,
  });

  // 6E. SPAS-12 (12-Gauge 00 Buckshot) — Individual 8.4mm lead pellet impact pit (spawned per pellet ray!)
  const bulletHoleShotgunMap = renderCaliberImpactDecalTexture({
    outerDustR: 124,
    spallR: 74,
    innerShelfR: 0,
    boreR: 32,
    lobes: 11,
    crackCount: 4,
    crackLen: 64,
    crackWidth: 2.2,
    branchedCracks: false,
    concentricArcs: false,
    copperTransfer: false,
    rubbleChunks: 2,
    seed: 67,
  });

  // 6F. AWP (.338 Lapua Magnum) — Massive 6,500J structural penetration cavern, dual spall shelf, 13 deep fractures
  const bulletHoleAwpMap = renderCaliberImpactDecalTexture({
    outerDustR: 236,
    spallR: 154,
    innerShelfR: 98,
    boreR: 56,
    lobes: 18,
    crackCount: 13,
    crackLen: 168,
    crackWidth: 4.8,
    branchedCracks: true,
    concentricArcs: true,
    copperTransfer: true,
    rubbleChunks: 11,
    seed: 79,
  });

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

  // 9. Scorched Blast Crater Decal Texture (Charred Asphalt + Radial Soot Rays + Glowing Ember Fissures)
  const scCanvas = document.createElement('canvas');
  scCanvas.width = 256;
  scCanvas.height = 256;
  const scCtx = scCanvas.getContext('2d')!;
  const scGrad = scCtx.createRadialGradient(128, 128, 6, 128, 128, 122);
  scGrad.addColorStop(0, 'rgba(5, 5, 8, 0.98)');
  scGrad.addColorStop(0.32, 'rgba(15, 16, 22, 0.92)');
  scGrad.addColorStop(0.62, 'rgba(30, 32, 38, 0.65)');
  scGrad.addColorStop(0.86, 'rgba(45, 48, 56, 0.25)');
  scGrad.addColorStop(1, 'rgba(45, 48, 56, 0)');
  scCtx.fillStyle = scGrad;
  scCtx.fillRect(0, 0, 256, 256);

  // Radial blast soot streaks
  for (let i = 0; i < 28; i++) {
    const ang = (i / 28) * Math.PI * 2 + (i % 3) * 0.08;
    const len = 72 + ((i * 19) % 48);
    scCtx.strokeStyle = i % 2 === 0 ? 'rgba(8, 9, 12, 0.68)' : 'rgba(55, 60, 70, 0.35)';
    scCtx.lineWidth = 2.5 + (i % 3) * 1.5;
    scCtx.beginPath();
    scCtx.moveTo(128 + Math.cos(ang) * 14, 128 + Math.sin(ang) * 14);
    scCtx.lineTo(128 + Math.cos(ang) * len, 128 + Math.sin(ang) * len);
    scCtx.stroke();
  }

  // Glowing thermal ember cracks in central blast pit
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2 + 0.17;
    const r1 = 42 + (i % 3) * 16;
    scCtx.strokeStyle = 'rgba(249, 115, 22, 0.78)';
    scCtx.lineWidth = 2.2;
    scCtx.beginPath();
    scCtx.moveTo(128, 128);
    scCtx.lineTo(
      128 + Math.cos(ang + 0.12) * (r1 * 0.5),
      128 + Math.sin(ang + 0.12) * (r1 * 0.5)
    );
    scCtx.lineTo(128 + Math.cos(ang) * r1, 128 + Math.sin(ang) * r1);
    scCtx.stroke();
  }
  const blastScorchMap = new THREE.CanvasTexture(scCanvas);
  blastScorchMap.colorSpace = THREE.SRGBColorSpace;
  blastScorchMap.anisotropy = maxAnisotropy;

  // 10. Volumetric Pyroclastic Fireball & Turbulent Smoke Billow Sprite Texture (256x256)
  const fbCanvas = document.createElement('canvas');
  fbCanvas.width = 256;
  fbCanvas.height = 256;
  const fbCtx = fbCanvas.getContext('2d')!;
  // Multi-lobed turbulent cloud puffs so billboarded explosion plumes look like organic rolling fire/smoke
  const puffClusters: [number, number, number, number][] = [
    [128, 128, 96, 1.0],
    [96, 102, 68, 0.85],
    [160, 106, 64, 0.82],
    [102, 156, 66, 0.80],
    [156, 152, 68, 0.84],
    [128, 86, 58, 0.76],
    [82, 130, 56, 0.74],
    [174, 128, 56, 0.74],
    [128, 170, 58, 0.75],
  ];
  for (const [px, py, pr, alpha] of puffClusters) {
    const pGrad = fbCtx.createRadialGradient(px - pr * 0.12, py - pr * 0.12, pr * 0.08, px, py, pr);
    pGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    pGrad.addColorStop(0.35, `rgba(255, 245, 225, ${alpha * 0.88})`);
    pGrad.addColorStop(0.68, `rgba(215, 195, 180, ${alpha * 0.45})`);
    pGrad.addColorStop(1, 'rgba(90, 80, 75, 0)');
    fbCtx.fillStyle = pGrad;
    fbCtx.beginPath();
    fbCtx.arc(px, py, pr, 0, Math.PI * 2);
    fbCtx.fill();
  }
  const fireballCloudMap = new THREE.CanvasTexture(fbCanvas);
  fireballCloudMap.colorSpace = THREE.SRGBColorSpace;

  return {
    groundMap,
    groundBump,
    metalDeckMap,
    metalDeckBump,
    wallMap,
    containerMap,
    crateMap,
    muzzleFlashMap,
    blastScorchMap,
    fireballCloudMap,
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
      blastScorchMap.dispose();
      fireballCloudMap.dispose();
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

export {
  buildDetailedWeaponViewModel,
  setWeaponRigOpticAttachment,
  type WeaponViewModelRig,
} from './weaponVisuals3D.ts';

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
