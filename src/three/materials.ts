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
  dispose: () => void;
}

function createProceduralBumpTexture(
  kind: 'brushed_metal' | 'pitted_stone' | 'arena_grate' | 'ancient_ruin'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);

    if (kind === 'brushed_metal') {
      for (let i = 0; i < 450; i++) {
        const y = (i * 17) % 256;
        const val = 110 + ((i * 31) % 40);
        ctx.fillStyle = `rgb(${val},${val},${val})`;
        ctx.fillRect(0, y, 256, 2);
      }
      // Subtle rivets & seam lines
      ctx.strokeStyle = '#404040';
      ctx.lineWidth = 2;
      ctx.strokeRect(8, 8, 240, 240);
    } else if (kind === 'pitted_stone') {
      for (let i = 0; i < 600; i++) {
        const x = (i * 73) % 256;
        const y = (i * 139) % 256;
        const r = 2 + (i % 6);
        const val = 90 + ((i * 23) % 75);
        ctx.fillStyle = `rgb(${val},${val},${val})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 'arena_grate') {
      ctx.strokeStyle = '#363636';
      ctx.lineWidth = 4;
      for (let i = 0; i < 256; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 256);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(256, i);
        ctx.stroke();
      }
      ctx.fillStyle = '#a8a8a8';
      for (let x = 16; x < 256; x += 32) {
        for (let y = 16; y < 256; y += 32) {
          ctx.fillRect(x - 3, y - 3, 6, 6);
        }
      }
    } else if (kind === 'ancient_ruin') {
      ctx.strokeStyle = '#484848';
      ctx.lineWidth = 3;
      for (let i = 0; i < 256; i += 64) {
        ctx.strokeRect(i + 2, 2, 60, 124);
        ctx.strokeRect(((i + 32) % 256) + 2, 130, 60, 124);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace; // Linear space for bump/roughness maps
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
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

  const brushedBump = createProceduralBumpTexture('brushed_metal');
  brushedBump.anisotropy = maxAniso;

  const stoneBump = createProceduralBumpTexture('pitted_stone');
  stoneBump.anisotropy = maxAniso;

  const grateBump = createProceduralBumpTexture('arena_grate');
  grateBump.repeat.set(8, 8);
  grateBump.anisotropy = maxAniso;

  const ruinBump = createProceduralBumpTexture('ancient_ruin');
  ruinBump.repeat.set(6, 6);
  ruinBump.anisotropy = maxAniso;

  const shadowTex = createContactShadowTexture();

  const voltArmorPrimary = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.36,
    metalness: capMetal(0.72),
    bumpMap: brushedBump,
    bumpScale: 0.015,
  });

  const voltArmorSecondary = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.48,
    metalness: capMetal(0.65),
    bumpMap: brushedBump,
    bumpScale: 0.012,
  });

  const voltCoreEmissive = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 1.8,
    roughness: 0.2,
    metalness: 0.1,
  });

  const riftArmorBone = new THREE.MeshStandardMaterial({
    color: 0xd6d3cd,
    roughness: 0.58,
    metalness: capMetal(0.18),
    bumpMap: stoneBump,
    bumpScale: 0.018,
  });

  const riftArmorSteel = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.34,
    metalness: capMetal(0.78),
    bumpMap: brushedBump,
    bumpScale: 0.014,
  });

  const riftMossAccent = new THREE.MeshStandardMaterial({
    color: 0x586f5a,
    roughness: 0.85,
    metalness: 0.05,
    bumpMap: stoneBump,
    bumpScale: 0.025,
  });

  const riftBracerBronze = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    emissive: 0x78350f,
    emissiveIntensity: 0.55,
    roughness: 0.28,
    metalness: capMetal(0.85),
  });

  const decoyWireframe = new THREE.MeshStandardMaterial({
    color: 0xd6d3cd,
    emissive: 0x84a98c,
    emissiveIntensity: 0.75,
    roughness: 0.3,
    metalness: capMetal(0.5),
    transparent: true,
    opacity: 0.55,
    wireframe: false,
  });

  const mechanicalFrame = new THREE.MeshStandardMaterial({
    color: 0x2d333f,
    roughness: 0.5,
    metalness: capMetal(0.72),
  });

  const weatheredSteel = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.42,
    metalness: capMetal(0.75),
    bumpMap: brushedBump,
    bumpScale: 0.015,
  });

  const oxidizedIron = new THREE.MeshStandardMaterial({
    color: 0x4a3f39,
    roughness: 0.68,
    metalness: capMetal(0.52),
    bumpMap: stoneBump,
    bumpScale: 0.02,
  });

  const fortressFloor = new THREE.MeshStandardMaterial({
    color: 0x323842,
    roughness: 0.52,
    metalness: capMetal(0.62),
    bumpMap: grateBump,
    bumpScale: 0.03,
  });

  const colossusStoneFloor = new THREE.MeshStandardMaterial({
    color: 0x343835,
    roughness: 0.78,
    metalness: 0.15,
    bumpMap: ruinBump,
    bumpScale: 0.035,
  });

  const colossusRelicBone = new THREE.MeshStandardMaterial({
    color: 0x9ca39e,
    roughness: 0.68,
    metalness: 0.22,
    bumpMap: stoneBump,
    bumpScale: 0.025,
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
    opacity: 0.55,
    depthWrite: false,
  });

  const allMaterials = [
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
  ];

  const allTextures = [brushedBump, stoneBump, grateBump, ruinBump, shadowTex];

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
    dispose: () => {
      allMaterials.forEach((m) => m.dispose());
      allTextures.forEach((t) => t.dispose());
    },
  };
}
