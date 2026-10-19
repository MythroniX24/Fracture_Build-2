import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export interface MaterialLibrary {
  voltArmorPrimary: THREE.MeshStandardMaterial;
  voltArmorSecondary: THREE.MeshStandardMaterial;
  voltCoreEmissive: THREE.MeshStandardMaterial;
  riftArmorBone: THREE.MeshStandardMaterial;
  riftArmorSteel: THREE.MeshStandardMaterial;
  riftMossAccent: THREE.MeshStandardMaterial;
  riftBracerBronze: THREE.MeshStandardMaterial;
  decoyWireframe: THREE.MeshStandardMaterial;
  mechanicalFrame: THREE.MeshStandardMaterial;
  weatheredSteel: THREE.MeshStandardMaterial;
  oxidizedIron: THREE.MeshStandardMaterial;
  fortressFloor: THREE.MeshStandardMaterial;
  colossusStoneFloor: THREE.MeshStandardMaterial;
  colossusRelicBone: THREE.MeshStandardMaterial;
  mossFoliage: THREE.MeshStandardMaterial;
  rootWood: THREE.MeshStandardMaterial;
  forgeEmber: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;

  // Fracture Mech (from fracture-character-lab-v2.html)
  mechGunmetalArmor: THREE.MeshStandardMaterial;
  mechArmorVolt: THREE.MeshStandardMaterial;
  mechArmorRift: THREE.MeshStandardMaterial;
  mechBronze: THREE.MeshStandardMaterial;
  mechDarkChassis: THREE.MeshStandardMaterial;
  mechCoreVolt: THREE.MeshStandardMaterial;
  mechCoreRift: THREE.MeshStandardMaterial;
  mechVisor: THREE.MeshBasicMaterial;
  mechSeam: THREE.MeshBasicMaterial;
  mechShield: THREE.MeshBasicMaterial;
  jetFlame: THREE.MeshBasicMaterial;

  // Foundry Arena v4 (from fracture-foundry-arena-v4.html)
  foundryFloor: THREE.MeshStandardMaterial;
  foundryCrack: THREE.MeshStandardMaterial;
  foundryDais: THREE.MeshStandardMaterial;
  foundryDaisTop: THREE.MeshStandardMaterial;
  foundryLedge: THREE.MeshStandardMaterial;
  foundryBrick: THREE.MeshStandardMaterial;
  foundryWallTower: THREE.MeshStandardMaterial;
  foundryDark: THREE.MeshStandardMaterial;
  foundryBronze: THREE.MeshStandardMaterial;
  foundryCrate: THREE.MeshStandardMaterial;
  foundryBarrelRed: THREE.MeshStandardMaterial;
  foundryBarrelBlue: THREE.MeshStandardMaterial;
  foundryConveyor: THREE.MeshStandardMaterial;
  foundryWindowMat: THREE.MeshBasicMaterial;
  foundryLava: THREE.MeshBasicMaterial;
  foundryGlowOrange: THREE.MeshBasicMaterial;
  foundryGlowCyan: THREE.MeshBasicMaterial;
  foundryHazard: THREE.MeshStandardMaterial;
  foundryScorchMat: THREE.MeshBasicMaterial;
  foundryStreakMat: THREE.MeshBasicMaterial;
  softParticleTex: THREE.CanvasTexture;
  crackTex: THREE.CanvasTexture;
  lavaTex: THREE.CanvasTexture;
  conveyorTex: THREE.CanvasTexture;
  hazardTex: THREE.CanvasTexture;
  envMap: THREE.Texture | null;

  dispose: () => void;
}

/**
 * Deterministic LCG & hash helpers matching fracture-foundry-arena-v4.html
 */
function makeRng(initialSeed = 11) {
  let sd = initialSeed;
  return () => {
    sd = (sd * 16807) % 2147483647;
    return sd / 2147483647;
  };
}

function drawSteelPanel(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  base: string,
  rnd: () => number
) {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle =
      rnd() > 0.5
        ? `rgba(255,255,255,${rnd() * 0.07})`
        : `rgba(0,0,0,${rnd() * 0.12})`;
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  for (let i = 0; i < 14; i++) {
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.beginPath();
    const x = rnd() * w;
    const y = rnd() * h;
    g.moveTo(x, y);
    g.lineTo(x + rnd() * 60 - 30, y + rnd() * 8 - 4);
    g.stroke();
  }
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineWidth = 4;
  g.strokeRect(2, 2, w - 4, h - 4);
  g.strokeStyle = 'rgba(255,255,255,0.12)';
  g.lineWidth = 2;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = 'rgba(20,20,20,0.7)';
  [
    [18, 18],
    [w - 18, 18],
    [18, h - 18],
    [w - 18, h - 18],
  ].forEach((p) => {
    g.beginPath();
    g.arc(p[0], p[1], 5, 0, 7);
    g.fill();
  });
}

function drawCracks(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  col: string,
  lw = 3
) {
  const rnd = makeRng(77);
  g.strokeStyle = col;
  g.lineWidth = lw;
  for (let k = 0; k < 5; k++) {
    let x = w / 2 + rnd() * 40 - 20;
    let y = h / 2 + rnd() * 40 - 20;
    let a = rnd() * 6.28;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 9; s++) {
      a += rnd() * 1.2 - 0.6;
      x += (Math.cos(a) * w) / 14;
      y += (Math.sin(a) * w) / 14;
      g.lineTo(x, y);
    }
    g.stroke();
  }
}

/**
 * 512x512 Procedural Armor panel texture from fracture-character-lab-v2.html (armT)
 */
export function createArmorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const g = canvas.getContext('2d');
  if (g) {
    const rnd = makeRng(42);
    g.fillStyle = '#62666d';
    g.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 2500; i++) {
      g.fillStyle =
        rnd() > 0.5
          ? `rgba(255,255,255,${rnd() * 0.035})`
          : `rgba(0,0,0,${rnd() * 0.06})`;
      g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    for (let i = 0; i < 10; i++) {
      g.strokeStyle = 'rgba(8,8,10,0.32)';
      g.lineWidth = 2;
      g.strokeRect(
        rnd() * 512 * 0.75,
        rnd() * 512 * 0.75,
        50 + rnd() * 180,
        40 + rnd() * 150
      );
    }
    for (let i = 0; i < 12; i++) {
      g.fillStyle = 'rgba(20,20,22,0.4)';
      g.beginPath();
      g.arc(rnd() * 512, rnd() * 512, 3, 0, 7);
      g.fill();
    }
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = `rgba(230,225,215,${rnd() * 0.15})`;
      g.lineWidth = 1;
      g.beginPath();
      const a = rnd() * 512;
      const b = rnd() * 512;
      g.moveTo(a, b);
      g.lineTo(a + rnd() * 70 - 35, b + rnd() * 10 - 5);
      g.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * 64x64 Soft Radial Alpha texture for dust puffs, steam vents, and glow flares
 */
export function createSoftParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  if (g) {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 128x128 Procedural Ground Fracture Crack texture from character lab
 */
export function createCrackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  if (g) {
    const rnd = makeRng(123);
    g.strokeStyle = 'rgba(10,6,4,0.85)';
    g.lineWidth = 3;
    for (let k = 0; k < 9; k++) {
      let x = 64;
      let y = 64;
      let a = k * 0.7;
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        a += rnd() * 0.8 - 0.4;
        x += Math.cos(a) * 11;
        y += Math.sin(a) * 11;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 256x256 Molten Lava Texture from fracture-foundry-arena-v4.html (tLava)
 */
export function createLavaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  if (g) {
    const rnd = makeRng(55);
    g.fillStyle = '#3a0d05';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 170; i++) {
      const x = rnd() * 256;
      const y = rnd() * 256;
      const r = 10 + rnd() * 30;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,175,45,0.9)');
      gr.addColorStop(0.5, 'rgba(220,70,10,0.45)');
      gr.addColorStop(1, 'rgba(60,10,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 8);
  return tex;
}

/**
 * 128x128 Industrial Yellow/Black Hazard Striping (tHaz)
 */
export function createHazardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  if (g) {
    g.fillStyle = '#e0b020';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#16130f';
    for (let i = -2; i < 6; i++) {
      g.beginPath();
      g.moveTo(i * 32, 0);
      g.lineTo(i * 32 + 16, 0);
      g.lineTo(i * 32 + 16 - 128, 128);
      g.lineTo(i * 32 - 128, 128);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createCanvasTex(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  repeat?: [number, number]
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (g) draw(g, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.35)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function setupStudioEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  isHeadless = false
): THREE.Texture | null {
  if (isHeadless) {
    return null;
  }
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmremGenerator.dispose();
  return envTex;
}

export function createMaterialLibrary(
  renderer: THREE.WebGLRenderer,
  isHeadless = false
): MaterialLibrary {
  const maxAniso = isHeadless ? 1 : renderer.capabilities.getMaxAnisotropy?.() || 1;
  const capMetal = (m: number) => (isHeadless ? Math.min(m, 0.22) : m);
  const rnd = makeRng(11);

  let envMap: THREE.Texture | null = null;
  if (!isHeadless) {
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    } catch {
      envMap = null;
    }
  }

  const shadowTex = createContactShadowTexture();
  const armorTex = createArmorTexture();
  armorTex.anisotropy = maxAniso;

  const softParticleTex = createSoftParticleTexture();
  const crackTex = createCrackTexture();
  const lavaTex = createLavaTexture();
  const hazardTex = createHazardTexture();

  // Exact Foundry Arena v4 Textures
  const tFloor = createCanvasTex(256, 256, (g, w, h) => drawSteelPanel(g, w, h, '#5a6068', rnd));
  const tCrack = createCanvasTex(256, 256, (g, w, h) => {
    drawSteelPanel(g, w, h, '#4c5056', rnd);
    drawCracks(g, w, h, '#0b0b0b', 3);
  });
  const tCrackEm = createCanvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    drawCracks(g, w, h, '#ff6a1f', 3);
  });
  const tWall = createCanvasTex(256, 256, (g, w, h) => {
    drawSteelPanel(g, w, h, '#3c4048', rnd);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, h * 0.45, w, 10);
    g.fillStyle = '#c46a1a';
    g.fillRect(0, h * 0.45 + 10, w, 4);
  }, [1, 2]);

  const tCrate = createCanvasTex(128, 128, (g, w, h) => {
    // Rich industrial wood + steel crate with cross-bracing
    drawSteelPanel(g, w, h, '#7d6b52', rnd);
    g.strokeStyle = 'rgba(38,28,18,0.75)';
    g.lineWidth = 3;
    for (let y = 16; y < h; y += 22) {
      g.beginPath();
      g.moveTo(6, y);
      g.lineTo(w - 6, y);
      g.stroke();
    }
    g.strokeStyle = '#2a241c';
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(10, 10);
    g.lineTo(w - 10, h - 10);
    g.moveTo(w - 10, 10);
    g.lineTo(10, h - 10);
    g.stroke();
  });

  const tEmb = createCanvasTex(512, 256, (g, w, h) => {
    drawSteelPanel(g, w, h, '#34373e', rnd);
    g.strokeStyle = '#d99a48';
    g.lineWidth = 6;
    g.strokeRect(16, 16, w - 32, h - 32);
    g.lineWidth = 2;
    g.strokeRect(28, 28, w - 56, h - 56);
    g.fillStyle = '#e0a050';
    g.font = '700 62px Georgia,serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('FRACTURE', w / 2, h / 2);
    drawCracks(g, w, h, 'rgba(0,0,0,0.75)', 3);
  });

  const tLedge = createCanvasTex(256, 256, (g, w, h) => {
    drawSteelPanel(g, w, h, '#484d54', rnd);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 0; y < h; y += 32) {
      for (let x = 0; x < w; x += 32) {
        if (((x + y) / 32) % 2 === 0) {
          g.fillRect(x + 2, y + 2, 28, 28);
        }
      }
    }
  }, [6, 2]);

  const tBrick = createCanvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#5c4d44';
    g.fillRect(0, 0, w, h);
    const bH = 32;
    const bW = 64;
    for (let row = 0; row < h / bH; row++) {
      const y = row * bH;
      const off = (row % 2) * (bW / 2);
      for (let col = -1; col < w / bW + 1; col++) {
        const x = col * bW + off;
        const shade = 75 + Math.floor(rnd() * 35);
        g.fillStyle = `rgb(${shade + 18},${shade + 4},${shade - 4})`;
        g.fillRect(x + 2, y + 2, bW - 4, bH - 4);
      }
    }
    for (let i = 0; i < 1200; i++) {
      g.fillStyle = rnd() > 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,230,200,0.06)';
      g.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
  }, [6, 2]);

  const tDaisCarbon = createCanvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#25282e';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#31353d';
    for (let y = 0; y < h; y += 8) {
      for (let x = (y % 16 === 0 ? 0 : 4); x < w; x += 8) {
        g.fillRect(x, y, 4, 4);
      }
    }
  }, [6, 2]);

  const conveyorTex = createCanvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#232323';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#3d3d3d';
    for (let i = 0; i < 8; i++) {
      g.fillRect(0, i * 16, 64, 5);
    }
  }, [1, 6]);

  const windowTex = createCanvasTex(64, 128, (g) => {
    g.fillStyle = '#14100e';
    g.fillRect(0, 0, 64, 128);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = rnd() > 0.3 ? '#ffb45a' : '#7fbfff';
      g.globalAlpha = 0.4 + rnd() * 0.5;
      g.fillRect(rnd() * 60, rnd() * 124, 3, 4);
    }
    g.globalAlpha = 1.0;
  });

  const scorchTex = createCanvasTex(128, 128, (g) => {
    for (let i = 0; i < 40; i++) {
      const x = 64 + (rnd() - 0.5) * 50;
      const y = 64 + (rnd() - 0.5) * 50;
      const r = 8 + rnd() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(10,6,4,0.45)');
      gr.addColorStop(1, 'rgba(10,6,4,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    }
  });

  const streakTex = createCanvasTex(128, 256, (g) => {
    for (let i = 0; i < 26; i++) {
      const x = rnd() * 128;
      const w = 2 + rnd() * 8;
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, `rgba(8,5,3,${0.25 + rnd() * 0.35})`);
      gr.addColorStop(1, 'rgba(8,5,3,0)');
      g.fillStyle = gr;
      g.fillRect(x, 0, w, 60 + rnd() * 196);
    }
  });

  [tFloor, tCrack, tCrackEm, tWall, tCrate, tEmb, tLedge, tBrick, tDaisCarbon].forEach((t) => {
    t.anisotropy = maxAniso;
  });

  // Legacy backwards-compatible materials
  const voltArmorPrimary = new THREE.MeshStandardMaterial({
    color: 0xc8553d,
    roughness: 0.42,
    metalness: capMetal(0.7),
    map: armorTex,
    bumpMap: armorTex,
    bumpScale: 0.02,
  });

  const voltArmorSecondary = new THREE.MeshStandardMaterial({
    color: 0x9e3f2b,
    roughness: 0.48,
    metalness: capMetal(0.65),
    map: armorTex,
  });

  const voltCoreEmissive = new THREE.MeshStandardMaterial({
    color: 0xffa030,
    emissive: 0xff8c20,
    emissiveIntensity: 2.2,
    roughness: 0.2,
    metalness: 0.1,
  });

  const riftArmorBone = new THREE.MeshStandardMaterial({
    color: 0x3f7fb5,
    roughness: 0.42,
    metalness: capMetal(0.7),
    map: armorTex,
  });

  const riftArmorSteel = new THREE.MeshStandardMaterial({
    color: 0x2e618e,
    roughness: 0.34,
    metalness: capMetal(0.78),
    map: armorTex,
  });

  const riftMossAccent = new THREE.MeshStandardMaterial({
    color: 0x5a9a5a,
    roughness: 0.85,
    metalness: 0.05,
  });

  const riftBracerBronze = new THREE.MeshStandardMaterial({
    color: 0xa6793f,
    roughness: 0.32,
    metalness: capMetal(0.85),
  });

  const decoyWireframe = new THREE.MeshStandardMaterial({
    color: 0x60a5fa,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.85,
    roughness: 0.25,
    metalness: capMetal(0.6),
    transparent: true,
    opacity: 0.52,
  });

  const mechanicalFrame = new THREE.MeshStandardMaterial({
    color: 0x1d1c1b,
    roughness: 0.55,
    metalness: capMetal(0.6),
  });

  const weatheredSteel = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.42,
    metalness: capMetal(0.75),
  });

  const oxidizedIron = new THREE.MeshStandardMaterial({
    color: 0x4a3f39,
    roughness: 0.68,
    metalness: capMetal(0.52),
  });

  const fortressFloor = new THREE.MeshStandardMaterial({
    map: tFloor,
    roughness: 0.55,
    metalness: capMetal(0.25),
  });

  const colossusStoneFloor = new THREE.MeshStandardMaterial({
    map: tFloor,
    roughness: 0.65,
    metalness: 0.2,
  });

  const colossusRelicBone = new THREE.MeshStandardMaterial({
    color: 0x9ca39e,
    roughness: 0.68,
    metalness: 0.22,
  });

  const mossFoliage = new THREE.MeshStandardMaterial({
    color: 0x3f5e46,
    roughness: 0.88,
    metalness: 0.04,
  });

  const rootWood = new THREE.MeshStandardMaterial({
    color: 0x3b2f26,
    roughness: 0.82,
    metalness: 0.08,
  });

  const forgeEmber = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 1.4,
    roughness: 0.3,
    metalness: 0.2,
  });

  const contactShadow = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });

  // Exact Mech Materials from fracture-character-lab-v2.html
  // armM: brushed gunmetal steel with panel lines & rivets
  const mechGunmetalArmor = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: armorTex,
    bumpMap: armorTex,
    bumpScale: 0.08,
    metalness: capMetal(0.7),
    roughness: 0.42,
  });

  // accM: faction accent armor (Crimson-Terracotta for VOLT, Cobalt-Blue for RIFT)
  const mechArmorVolt = new THREE.MeshStandardMaterial({
    color: 0xc8553d,
    metalness: capMetal(0.38),
    roughness: 0.4,
  });

  const mechArmorRift = new THREE.MeshStandardMaterial({
    color: 0x3f7fb5,
    metalness: capMetal(0.38),
    roughness: 0.4,
  });

  const mechBronze = new THREE.MeshStandardMaterial({
    color: 0xa6793f,
    metalness: capMetal(0.85),
    roughness: 0.32,
  });

  const mechDarkChassis = new THREE.MeshStandardMaterial({
    color: 0x1d1c1b,
    metalness: capMetal(0.6),
    roughness: 0.55,
  });

  const mechCoreVolt = new THREE.MeshStandardMaterial({
    color: 0xffb04a,
    emissive: 0xffa030,
    emissiveIntensity: 2.2,
    roughness: 0.3,
  });

  const mechCoreRift = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x38bdf8,
    emissiveIntensity: 2.2,
    roughness: 0.3,
  });

  const mechVisor = new THREE.MeshBasicMaterial({
    color: 0xffc766,
  });

  const mechSeam = new THREE.MeshBasicMaterial({
    color: 0xffa83a,
  });

  const mechShield = new THREE.MeshBasicMaterial({
    color: 0x7fd0ff,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const jetFlame = new THREE.MeshBasicMaterial({
    color: 0xff9a3a,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });

  // Exact Foundry Arena v4 Materials
  const foundryFloor = new THREE.MeshStandardMaterial({
    map: tFloor,
    bumpMap: tFloor,
    bumpScale: 0.04,
    roughness: 0.55,
    metalness: capMetal(0.25),
  });

  const foundryCrack = new THREE.MeshStandardMaterial({
    map: tCrack,
    bumpMap: tCrack,
    bumpScale: 0.06,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: tCrackEm,
    emissiveIntensity: 0.95,
    roughness: 0.55,
    metalness: capMetal(0.25),
  });

  const foundryDais = new THREE.MeshStandardMaterial({
    map: tDaisCarbon,
    bumpMap: tDaisCarbon,
    bumpScale: 0.04,
    metalness: capMetal(0.7),
    roughness: 0.35,
  });

  const foundryDaisTop = new THREE.MeshStandardMaterial({
    map: tEmb,
    bumpMap: tEmb,
    bumpScale: 0.04,
    roughness: 0.45,
    metalness: capMetal(0.35),
  });

  const foundryLedge = new THREE.MeshStandardMaterial({
    map: tLedge,
    bumpMap: tLedge,
    bumpScale: 0.04,
    color: 0xb0b0b0,
    roughness: 0.55,
    metalness: capMetal(0.25),
  });

  const foundryBrick = new THREE.MeshStandardMaterial({
    map: tBrick,
    bumpMap: tBrick,
    bumpScale: 0.12,
    color: 0xa89a90,
    roughness: 0.92,
    metalness: 0,
  });

  const foundryWallTower = new THREE.MeshStandardMaterial({
    map: tWall,
    color: 0xb0b0b0,
    roughness: 0.55,
    metalness: capMetal(0.25),
  });

  const foundryDark = new THREE.MeshStandardMaterial({
    map: tFloor,
    color: 0x8a8a8a,
    roughness: 0.55,
    metalness: capMetal(0.25),
  });

  const foundryBronze = new THREE.MeshStandardMaterial({
    color: 0x8a5a2a,
    metalness: capMetal(0.85),
    roughness: 0.38,
  });

  const foundryCrate = new THREE.MeshStandardMaterial({
    map: tCrate,
    bumpMap: tCrate,
    bumpScale: 0.08,
    color: 0xc2b092,
    roughness: 0.78,
    metalness: capMetal(0.1),
  });

  const foundryBarrelRed = new THREE.MeshStandardMaterial({
    color: 0xa8452f,
    metalness: capMetal(0.55),
    roughness: 0.45,
  });

  const foundryBarrelBlue = new THREE.MeshStandardMaterial({
    color: 0x3f6f9a,
    metalness: capMetal(0.55),
    roughness: 0.45,
  });

  const foundryConveyor = new THREE.MeshStandardMaterial({
    map: conveyorTex,
    roughness: 0.9,
  });

  const foundryWindowMat = new THREE.MeshBasicMaterial({
    map: windowTex,
  });

  const foundryLava = new THREE.MeshBasicMaterial({
    map: lavaTex,
    fog: false,
  });

  const foundryGlowOrange = new THREE.MeshBasicMaterial({
    color: 0xff8a2a,
  });

  const foundryGlowCyan = new THREE.MeshBasicMaterial({
    color: 0x4fd6ff,
  });

  const foundryHazard = new THREE.MeshStandardMaterial({
    map: hazardTex,
    roughness: 0.7,
    metalness: capMetal(0.25),
  });

  const foundryScorchMat = new THREE.MeshBasicMaterial({
    map: scorchTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const foundryStreakMat = new THREE.MeshBasicMaterial({
    map: streakTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const allMaterials: THREE.Material[] = [
    voltArmorPrimary,
    voltArmorSecondary,
    voltCoreEmissive,
    riftArmorBone,
    riftArmorSteel,
    riftMossAccent,
    riftBracerBronze,
    decoyWireframe,
    mechanicalFrame,
    weatheredSteel,
    oxidizedIron,
    fortressFloor,
    colossusStoneFloor,
    colossusRelicBone,
    mossFoliage,
    rootWood,
    forgeEmber,
    contactShadow,
    mechGunmetalArmor,
    mechArmorVolt,
    mechArmorRift,
    mechBronze,
    mechDarkChassis,
    mechCoreVolt,
    mechCoreRift,
    mechVisor,
    mechSeam,
    mechShield,
    jetFlame,
    foundryFloor,
    foundryCrack,
    foundryDais,
    foundryDaisTop,
    foundryLedge,
    foundryBrick,
    foundryWallTower,
    foundryDark,
    foundryBronze,
    foundryCrate,
    foundryBarrelRed,
    foundryBarrelBlue,
    foundryConveyor,
    foundryWindowMat,
    foundryLava,
    foundryGlowOrange,
    foundryGlowCyan,
    foundryHazard,
    foundryScorchMat,
    foundryStreakMat,
  ];

  const allTextures: THREE.Texture[] = [
    shadowTex,
    armorTex,
    softParticleTex,
    crackTex,
    lavaTex,
    hazardTex,
    tFloor,
    tCrack,
    tCrackEm,
    tWall,
    tCrate,
    tEmb,
    tLedge,
    tBrick,
    tDaisCarbon,
    conveyorTex,
    windowTex,
    scorchTex,
    streakTex,
  ];

  return {
    voltArmorPrimary,
    voltArmorSecondary,
    voltCoreEmissive,
    riftArmorBone,
    riftArmorSteel,
    riftMossAccent,
    riftBracerBronze,
    decoyWireframe,
    mechanicalFrame,
    weatheredSteel,
    oxidizedIron,
    fortressFloor,
    colossusStoneFloor,
    colossusRelicBone,
    mossFoliage,
    rootWood,
    forgeEmber,
    contactShadow,

    mechGunmetalArmor,
    mechArmorVolt,
    mechArmorRift,
    mechBronze,
    mechDarkChassis,
    mechCoreVolt,
    mechCoreRift,
    mechVisor,
    mechSeam,
    mechShield,
    jetFlame,

    foundryFloor,
    foundryCrack,
    foundryDais,
    foundryDaisTop,
    foundryLedge,
    foundryBrick,
    foundryWallTower,
    foundryDark,
    foundryBronze,
    foundryCrate,
    foundryBarrelRed,
    foundryBarrelBlue,
    foundryConveyor,
    foundryWindowMat,
    foundryLava,
    foundryGlowOrange,
    foundryGlowCyan,
    foundryHazard,
    foundryScorchMat,
    foundryStreakMat,
    softParticleTex,
    crackTex,
    lavaTex,
    conveyorTex,
    hazardTex,
    envMap,

    dispose: () => {
      allMaterials.forEach((m) => m.dispose());
      allTextures.forEach((t) => t.dispose());
      if (envMap) envMap.dispose();
    },
  };
}
