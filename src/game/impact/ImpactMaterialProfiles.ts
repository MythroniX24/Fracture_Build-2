import type { ArenaDefinition, SurfaceMaterial } from '../config.ts';
import type {
  ImpactMaterialProfile,
  ImpactMaterialType,
  ImpactQualityConfig,
  ImpactQualityProfileId,
} from './impact.types.ts';

/**
 * Configurable Material Damage Profiles:
 * - concrete: Dark central hole, irregular chipped rim, radial cracks, stone chips & dust
 * - stone: Deep dark cavity, jagged crystalline spall rim, pronounced fractures, mineral chips
 * - wood: Irregular fibrous hole, directional splintering along grain, warm charred rim, wood fragments
 * - metal: Dark armor core mark, bright raised metallic dent lip, hot orange/gold sparks, 3D dent collar
 * - glass: Bright frosty impact center, dense radial & branching cobweb cracks, crystalline shards
 * - tile: Sharp ceramic punch hole, clean spiderweb glaze cracks, white/slate ceramic chips
 * - gravel: Wide loose aggregate crater, dark displaced soil/stone basin, heavy dust puff
 * - default: Balanced masonry/composite fallback profile
 */
export const IMPACT_MATERIAL_PROFILES: Record<ImpactMaterialType, ImpactMaterialProfile> = {
  concrete: {
    id: 'concrete',
    shaderCode: 0,
    label: 'Reinforced Concrete',
    coreColorHex: 0x090d14,
    rimHighlightHex: 0xdbe4ef,
    spallColorHex: 0x64748b,
    scorchColorHex: 0x1e293b,
    crackIntensity: 0.82,
    crackCountRange: [5, 11],
    rimIrregularity: 0.68,
    splinterAnisotropy: 0.12,
    dentSpecular: 0.18,
    radialBranching: 0.45,
    sizeMultiplier: 1.0,
    maxElongationCap: 2.35,
    sparkColorHex: 0xfbbf24,
    debrisColorHex: 0x94a3b8,
    dustColorHex: 0xcbd5e1,
    sparkRatio: 0.28,
    debrisScale: 1.0,
    allowDetailGeometry: true,
  },
  stone: {
    id: 'stone',
    shaderCode: 1,
    label: 'Basalt & Quarry Stone',
    coreColorHex: 0x070a0f,
    rimHighlightHex: 0xcbd5e1,
    spallColorHex: 0x475569,
    scorchColorHex: 0x0f172a,
    crackIntensity: 0.92,
    crackCountRange: [6, 13],
    rimIrregularity: 0.84,
    splinterAnisotropy: 0.15,
    dentSpecular: 0.22,
    radialBranching: 0.58,
    sizeMultiplier: 1.06,
    maxElongationCap: 2.25,
    sparkColorHex: 0xf59e0b,
    debrisColorHex: 0x64748b,
    dustColorHex: 0x94a3b8,
    sparkRatio: 0.35,
    debrisScale: 1.12,
    allowDetailGeometry: true,
  },
  wood: {
    id: 'wood',
    shaderCode: 2,
    label: 'Structural Timber & Crates',
    coreColorHex: 0x1a0f07,
    rimHighlightHex: 0xd99b66,
    spallColorHex: 0x8b5a2b,
    scorchColorHex: 0x2e190b,
    crackIntensity: 0.64,
    crackCountRange: [4, 8],
    rimIrregularity: 0.78,
    splinterAnisotropy: 0.88,
    dentSpecular: 0.06,
    radialBranching: 0.22,
    sizeMultiplier: 0.94,
    maxElongationCap: 2.55,
    sparkColorHex: 0xfb923c,
    debrisColorHex: 0xb47b44,
    dustColorHex: 0xa17c5b,
    sparkRatio: 0.08,
    debrisScale: 1.15,
    allowDetailGeometry: false,
  },
  metal: {
    id: 'metal',
    shaderCode: 3,
    label: 'Armored Steel & Containers',
    coreColorHex: 0x0b0f17,
    rimHighlightHex: 0xf1f5f9,
    spallColorHex: 0x94a3b8,
    scorchColorHex: 0x1e293b,
    crackIntensity: 0.24,
    crackCountRange: [2, 5],
    rimIrregularity: 0.28,
    splinterAnisotropy: 0.2,
    dentSpecular: 0.94,
    radialBranching: 0.12,
    sizeMultiplier: 0.78,
    maxElongationCap: 2.45,
    sparkColorHex: 0xfef08a,
    debrisColorHex: 0xf97316,
    dustColorHex: 0x64748b,
    sparkRatio: 0.86,
    debrisScale: 1.2,
    allowDetailGeometry: true,
  },
  glass: {
    id: 'glass',
    shaderCode: 4,
    label: 'Ballistic Tempered Glass',
    coreColorHex: 0xe0f2fe,
    rimHighlightHex: 0xffffff,
    spallColorHex: 0xbae6fd,
    scorchColorHex: 0x38bdf8,
    crackIntensity: 1.0,
    crackCountRange: [9, 16],
    rimIrregularity: 0.52,
    splinterAnisotropy: 0.1,
    dentSpecular: 0.85,
    radialBranching: 0.95,
    sizeMultiplier: 1.18,
    maxElongationCap: 1.75,
    sparkColorHex: 0xe0f2fe,
    debrisColorHex: 0x7dd3fc,
    dustColorHex: 0xf0f9ff,
    sparkRatio: 0.45,
    debrisScale: 1.05,
    allowDetailGeometry: false,
  },
  tile: {
    id: 'tile',
    shaderCode: 5,
    label: 'Ceramic Hangar Tile',
    coreColorHex: 0x0f172a,
    rimHighlightHex: 0xf8fafc,
    spallColorHex: 0x94a3b8,
    scorchColorHex: 0x1e293b,
    crackIntensity: 0.88,
    crackCountRange: [6, 12],
    rimIrregularity: 0.56,
    splinterAnisotropy: 0.08,
    dentSpecular: 0.52,
    radialBranching: 0.72,
    sizeMultiplier: 0.92,
    maxElongationCap: 2.1,
    sparkColorHex: 0xfde047,
    debrisColorHex: 0xe2e8f0,
    dustColorHex: 0xcbd5e1,
    sparkRatio: 0.32,
    debrisScale: 0.95,
    allowDetailGeometry: false,
  },
  gravel: {
    id: 'gravel',
    shaderCode: 6,
    label: 'Compacted Gravel & Aggregate',
    coreColorHex: 0x1c1917,
    rimHighlightHex: 0xa8a29e,
    spallColorHex: 0x78716c,
    scorchColorHex: 0x292524,
    crackIntensity: 0.48,
    crackCountRange: [3, 7],
    rimIrregularity: 0.86,
    splinterAnisotropy: 0.14,
    dentSpecular: 0.08,
    radialBranching: 0.3,
    sizeMultiplier: 1.12,
    maxElongationCap: 2.2,
    sparkColorHex: 0xfbbf24,
    debrisColorHex: 0x78716c,
    dustColorHex: 0xa8a29e,
    sparkRatio: 0.18,
    debrisScale: 1.25,
    allowDetailGeometry: false,
  },
  default: {
    id: 'default',
    shaderCode: 0,
    label: 'Composite Tactical Surface',
    coreColorHex: 0x090d14,
    rimHighlightHex: 0xdbe4ef,
    spallColorHex: 0x64748b,
    scorchColorHex: 0x1e293b,
    crackIntensity: 0.78,
    crackCountRange: [5, 10],
    rimIrregularity: 0.65,
    splinterAnisotropy: 0.12,
    dentSpecular: 0.22,
    radialBranching: 0.42,
    sizeMultiplier: 1.0,
    maxElongationCap: 2.3,
    sparkColorHex: 0xfbbf24,
    debrisColorHex: 0x94a3b8,
    dustColorHex: 0xcbd5e1,
    sparkRatio: 0.3,
    debrisScale: 1.0,
    allowDetailGeometry: true,
  },
};

/**
 * Quality profiles for Mobile and Desktop devices.
 */
export const IMPACT_QUALITY_PROFILES: Record<ImpactQualityProfileId, ImpactQualityConfig> = {
  mobile: {
    id: 'mobile',
    maxActiveMarks: 72,
    maxDetailMeshes: 4,
    maxActiveParticles: 48,
    maxActiveDustPuffs: 12,
    shaderDetailLevel: 1,
    lodNearDist: 8.0,
    lodFarDist: 28.0,
    maxMarkAgeMs: 45000,
    enableDetailGeometry: false,
    particleBudgetScale: 0.55,
  },
  desktop: {
    id: 'desktop',
    maxActiveMarks: 192,
    maxDetailMeshes: 18,
    maxActiveParticles: 128,
    maxActiveDustPuffs: 28,
    shaderDetailLevel: 2,
    lodNearDist: 14.0,
    lodFarDist: 55.0,
    maxMarkAgeMs: 90000,
    enableDetailGeometry: true,
    particleBudgetScale: 1.0,
  },
};

export function getImpactMaterialProfile(
  materialType?: ImpactMaterialType | string | null
): ImpactMaterialProfile {
  if (!materialType) return IMPACT_MATERIAL_PROFILES.concrete;
  const key = materialType as ImpactMaterialType;
  return IMPACT_MATERIAL_PROFILES[key] || IMPACT_MATERIAL_PROFILES.default;
}

export function mapSurfaceMaterialToImpactMaterial(
  surface: SurfaceMaterial
): ImpactMaterialType {
  switch (surface) {
    case 'metal':
      return 'metal';
    case 'wood':
      return 'wood';
    case 'tile':
      return 'tile';
    case 'gravel':
    case 'grass':
      return 'gravel';
    case 'concrete':
    default:
      return 'concrete';
  }
}

/**
 * Automatically classifies the impact material from existing arena block metadata,
 * surface zones, cylindrical colliders, and breakable props when no explicit material is supplied.
 */
export function classifyArenaHitMaterial(
  arena: ArenaDefinition,
  hitX: number,
  hitY: number,
  hitZ: number,
  surfaceId?: string | null,
  propKind?: 'crate' | 'barrel' | null
): ImpactMaterialType {
  // 1. Breakable props: crates are wood, explosive drums are metal
  if (propKind === 'crate') return 'wood';
  if (propKind === 'barrel') return 'metal';

  // 2. Floor impact (y near 0): check arena surfaceZones
  if (Math.abs(hitY) <= 0.14 || surfaceId === 'floor') {
    if (arena.surfaceZones) {
      for (let i = 0; i < arena.surfaceZones.length; i++) {
        const z = arena.surfaceZones[i];
        if (hitX >= z.minX && hitX <= z.maxX && hitZ >= z.minZ && hitZ <= z.maxZ) {
          return mapSurfaceMaterialToImpactMaterial(z.material);
        }
      }
    }
    return 'concrete';
  }

  // 3. Match by surfaceId or proximity to arena blocks
  if (surfaceId) {
    for (let i = 0; i < arena.blocks.length; i++) {
      const b = arena.blocks[i];
      if (b.id === surfaceId) {
        if (b.kind === 'container') return 'metal';
        if (b.kind === 'tower') {
          // Upper observation band on sniper towers behaves like ballistic glass
          if (hitY > b.height * 0.68 && hitY < b.height * 0.92) {
            return 'glass';
          }
          return 'metal';
        }
        if (b.kind === 'platform') return 'metal';
        if (arena.id === 'overgrown_colossus' && (b.kind === 'building' || b.kind === 'wall')) {
          return 'stone';
        }
        return 'concrete';
      }
    }
  }

  // 4. Check cylindrical pillars / colliders
  for (let i = 0; i < arena.colliders.length; i++) {
    const col = arena.colliders[i];
    const d2 = (hitX - col.x) ** 2 + (hitZ - col.z) ** 2;
    if (d2 <= (col.radius + 0.25) ** 2 && hitY <= col.height + 0.2) {
      if (col.kind === 'piston' || col.kind === 'vent') return 'metal';
      return 'stone';
    }
  }

  // 5. Fallback block proximity check
  for (let i = 0; i < arena.blocks.length; i++) {
    const b = arena.blocks[i];
    const hw = b.width * 0.5 + 0.22;
    const hd = b.depth * 0.5 + 0.22;
    if (
      hitX >= b.x - hw &&
      hitX <= b.x + hw &&
      hitZ >= b.z - hd &&
      hitZ <= b.z + hd &&
      hitY <= b.height + 0.22
    ) {
      if (b.kind === 'container') return 'metal';
      if (b.kind === 'tower' && hitY > b.height * 0.68 && hitY < b.height * 0.92) {
        return 'glass';
      }
      if (arena.id === 'overgrown_colossus') return 'stone';
      return 'concrete';
    }
  }

  return arena.id === 'overgrown_colossus' ? 'stone' : 'concrete';
}
