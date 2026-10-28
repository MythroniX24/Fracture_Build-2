import type { ArenaDefinition, MapBoxBlock, WeaponId } from '../config.ts';
import { WEAPON_IMPACT_PROFILES } from '../rules.ts';
import { getImpactMaterialProfile } from './ImpactMaterialProfiles.ts';
import type {
  ImpactAngleRegime,
  ImpactAngleResult,
  ImpactMaterialType,
  ImpactRequest,
  ImpactShapeFamily,
  ProceduralMarkDescriptor,
} from './impact.types.ts';

/**
 * Fast, deterministic 32-bit PRNG (Mulberry32).
 * Given the same integer seed, always produces the exact same sequence in [0, 1).
 */
export function createSeededRandom(seed: number): () => number {
  let state = (seed | 0) >>> 0;
  if (state === 0) state = 0x6d2b79f5;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derives a deterministic 32-bit integer seed from world hit coordinates, weapon ID, and optional salt.
 */
export function deriveImpactSeed(
  x: number,
  y: number,
  z: number,
  weaponId: WeaponId,
  salt = 0
): number {
  const qx = Math.round((Number.isFinite(x) ? x : 0) * 1000) | 0;
  const qy = Math.round((Number.isFinite(y) ? y : 0) * 1000) | 0;
  const qz = Math.round((Number.isFinite(z) ? z : 0) * 1000) | 0;
  let wHash = 2166136261;
  for (let i = 0; i < weaponId.length; i++) {
    wHash ^= weaponId.charCodeAt(i);
    wHash = Math.imul(wHash, 16777619);
  }
  let h = wHash ^ Math.imul(qx, 73856093) ^ Math.imul(qy, 19349663) ^ Math.imul(qz, 83492791);
  h ^= Math.imul(salt | 0, 2654435761);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) || 1;
}

function safeNormalize(
  vx: number,
  vy: number,
  vz: number,
  fallbackX: number,
  fallbackY: number,
  fallbackZ: number
): { x: number; y: number; z: number; valid: boolean } {
  if (!Number.isFinite(vx) || !Number.isFinite(vy) || !Number.isFinite(vz)) {
    return { x: fallbackX, y: fallbackY, z: fallbackZ, valid: false };
  }
  const len = Math.hypot(vx, vy, vz);
  if (len < 1e-6) {
    return { x: fallbackX, y: fallbackY, z: fallbackZ, valid: false };
  }
  return { x: vx / len, y: vy / len, z: vz / len, valid: true };
}

/**
 * Angle-Dependent Ballistic Impact Solver:
 * - Normalizes incoming bullet vector `d` and surface normal `n` with safeguards for invalid vectors.
 * - Computes incidence cosine, incidence angle (radians & degrees), and regime ('perpendicular' | 'oblique' | 'grazing').
 * - Projects incoming direction onto the surface tangent plane to orient asymmetric spall, gouges, and splinters.
 * - Enforces weapon- and material-specific elongation bounds and arena wall-edge clamping.
 */
export function solveImpactAngle(request: ImpactRequest): ImpactAngleResult {
  const weaponProfile =
    WEAPON_IMPACT_PROFILES[request.weaponId] || WEAPON_IMPACT_PROFILES.m4a1;
  const matProfile = getImpactMaterialProfile(request.materialType);

  const px = Number.isFinite(request.point.x) ? request.point.x : 0;
  const py = Number.isFinite(request.point.y) ? request.point.y : 0;
  const pz = Number.isFinite(request.point.z) ? request.point.z : 0;

  // 1. Resolve incoming direction vector d (fall back to point - origin if direction is near-zero)
  let rawDx = request.direction.x;
  let rawDy = request.direction.y;
  let rawDz = request.direction.z;
  if (
    (!Number.isFinite(rawDx) || Math.hypot(rawDx, rawDy, rawDz) < 1e-5) &&
    request.origin
  ) {
    rawDx = px - request.origin.x;
    rawDy = py - request.origin.y;
    rawDz = pz - request.origin.z;
  }

  const normDir = safeNormalize(rawDx, rawDy, rawDz, 0, 0, -1);
  const dx = normDir.x;
  const dy = normDir.y;
  const dz = normDir.z;

  // 2. Resolve outward surface normal n and ensure it faces the incoming bullet (d · n <= 0)
  const normN = safeNormalize(
    request.normal.x,
    request.normal.y,
    request.normal.z,
    0,
    1,
    0
  );
  let nx = normN.x;
  let ny = normN.y;
  let nz = normN.z;

  let dotDN = dx * nx + dy * ny + dz * nz;
  if (dotDN > 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
    dotDN = -dotDN;
  }

  // 3. Clamped dot product & incidence angle calculation
  const incidenceCos = Math.max(0.08, Math.min(1.0, -dotDN));
  const incidenceRad = Math.acos(incidenceCos);
  const incidenceDeg = (incidenceRad * 180) / Math.PI;
  const grazingRatio = 1.0 - incidenceCos;

  let regime: ImpactAngleRegime = 'perpendicular';
  if (incidenceDeg >= 60.0) {
    regime = 'grazing';
  } else if (incidenceDeg >= 25.0) {
    regime = 'oblique';
  }

  // 4. Project incoming bullet direction onto the surface tangent plane: t = normalize(d - (d·n)n)
  let tx = dx - dotDN * nx;
  let ty = dy - dotDN * ny;
  let tz = dz - dotDN * nz;
  const tLen = Math.hypot(tx, ty, tz);

  if (tLen > 1e-4) {
    tx /= tLen;
    ty /= tLen;
    tz /= tLen;
  } else {
    // Near-exact perpendicular impact: construct a stable tangent orthogonal to n
    const upX = Math.abs(ny) < 0.9 ? 0 : 1;
    const upY = Math.abs(ny) < 0.9 ? 1 : 0;
    const upZ = 0;
    const cx = upY * nz - upZ * ny;
    const cy = upZ * nx - upX * nz;
    const cz = upX * ny - upY * nx;
    const cLen = Math.hypot(cx, cy, cz) || 1;
    tx = cx / cLen;
    ty = cy / cLen;
    tz = cz / cLen;
  }

  // Orthonormal bitangent b = n × t
  let bx = ny * tz - nz * ty;
  let by = nz * tx - nx * tz;
  let bz = nx * ty - ny * tx;
  const bLen = Math.hypot(bx, by, bz) || 1;
  bx /= bLen;
  by /= bLen;
  bz /= bLen;

  // 5. Specular reflection vector r = d - 2(d·n)n for ricochet & directional debris ejection
  let rx = dx - 2 * dotDN * nx;
  let ry = dy - 2 * dotDN * ny;
  let rz = dz - 2 * dotDN * nz;
  const rLen = Math.hypot(rx, ry, rz) || 1;
  rx /= rLen;
  ry /= rLen;
  rz /= rLen;

  // 6. Bounded angle-dependent elongation, asymmetry, and depth scaling
  const maxStretch = Math.min(
    weaponProfile.maxGrazingStretch * 1.08,
    matProfile.maxElongationCap
  );
  const rawElongation =
    1.0 + (maxStretch - 1.0) * Math.pow(grazingRatio, 1.08);
  const elongation = Math.max(1.0, Math.min(maxStretch, rawElongation));

  const asymmetry =
    regime === 'perpendicular'
      ? grazingRatio * 0.45
      : Math.min(0.85, 0.18 + grazingRatio * 0.78);

  const craterDepthScale =
    weaponProfile.craterDepthFactor *
    (regime === 'grazing' ? 0.38 : 1.0 - grazingRatio * 0.48);

  const ricochetEligible =
    regime === 'grazing' &&
    (matProfile.id === 'metal' ||
      matProfile.id === 'concrete' ||
      matProfile.id === 'stone' ||
      matProfile.id === 'tile');

  // Seeded size variation (±9%) so even identical perpendicular hits vary naturally
  const seed =
    request.seed ??
    deriveImpactSeed(px, py, pz, request.weaponId, Math.round(incidenceDeg * 10));
  const rng = createSeededRandom(seed);
  const sizeJitter = 0.91 + rng() * 0.18;
  const damageScale = request.damage
    ? Math.max(0.88, Math.min(1.18, 0.92 + request.damage / 320))
    : 1.0;

  const baseDiam =
    weaponProfile.baseDiameter * matProfile.sizeMultiplier * sizeJitter * damageScale;
  let scaleT = baseDiam * elongation;
  let scaleB = baseDiam * (1.0 - grazingRatio * 0.09);

  const entryShiftMeters = (scaleT - scaleB) * 0.16;
  let posX = px + tx * entryShiftMeters;
  let posY = py + ty * entryShiftMeters;
  let posZ = pz + tz * entryShiftMeters;

  let surfaceId: string | null = request.surfaceId ?? null;
  let valid = normN.valid;

  // 7. Strict Arena Surface & Wall-Edge Boundary Clamping (when arena is provided)
  if (request.arena) {
    const clampRes = clampImpactToArenaSurface(
      request.arena,
      px,
      py,
      pz,
      posX,
      posY,
      posZ,
      nx,
      ny,
      nz,
      tx,
      ty,
      tz,
      bx,
      by,
      bz,
      scaleT,
      scaleB,
      request.propKind
    );
    valid = clampRes.validSurface;
    posX = clampRes.x;
    posY = clampRes.y;
    posZ = clampRes.z;
    nx = clampRes.nx;
    ny = clampRes.ny;
    nz = clampRes.nz;
    scaleT = clampRes.scaleT;
    scaleB = clampRes.scaleB;
    if (clampRes.surfaceId) {
      surfaceId = clampRes.surfaceId;
    }
  }

  return {
    valid,
    incidenceCos,
    incidenceRad,
    incidenceDeg,
    grazingRatio,
    regime,
    normal: { x: nx, y: ny, z: nz },
    tangent: { x: tx, y: ty, z: tz },
    bitangent: { x: bx, y: by, z: bz },
    reflection: { x: rx, y: ry, z: rz },
    elongation,
    asymmetry,
    entryShiftMeters,
    craterDepthScale,
    ricochetEligible,
    scaleT,
    scaleB,
    clampedPoint: { x: posX, y: posY, z: posZ },
    surfaceId,
  };
}

/**
 * Generates a deterministic `ProceduralMarkDescriptor` that drives the instanced GLSL fragment shader.
 * Varies shape family, hole dimensions, outer contour irregularity, chipped sections, scorch intensity,
 * crack count/length/branching, and localized overlap accumulation.
 */
export function generateProceduralMarkDescriptor(
  seed: number,
  weaponId: WeaponId,
  materialType: ImpactMaterialType,
  angleResult: ImpactAngleResult,
  localOverlapCount = 0
): ProceduralMarkDescriptor {
  const rng = createSeededRandom(seed);
  const weaponProfile =
    WEAPON_IMPACT_PROFILES[weaponId] || WEAPON_IMPACT_PROFILES.m4a1;
  const matProfile = getImpactMaterialProfile(materialType);

  // Select procedural shape family based on angle regime + deterministic PRNG
  let shapeFamily: ImpactShapeFamily = 0;
  if (angleResult.regime === 'grazing') {
    shapeFamily = 2; // directional_gouge
  } else if (materialType === 'glass' || materialType === 'tile') {
    shapeFamily = 1; // star_fracture
  } else if (weaponId === 'awp' || weaponId === 'deagle' || weaponId === 'ak47') {
    shapeFamily = rng() > 0.45 ? 3 : 1; // stepped_cavern or star_fracture
  } else {
    const roll = rng();
    shapeFamily = roll < 0.45 ? 0 : roll < 0.78 ? 1 : 3;
  }

  // Independent variation of hole radius ratio
  const caliberHoleBase =
    weaponId === 'deagle'
      ? 0.28
      : weaponId === 'awp'
        ? 0.26
        : weaponId === 'ak47'
          ? 0.24
          : weaponId === 'spas12'
            ? 0.27
            : 0.21;
  const holeRadiusRatio = Math.max(
    0.13,
    Math.min(
      0.4,
      caliberHoleBase * (0.86 + rng() * 0.28) * (1.0 - angleResult.grazingRatio * 0.25)
    )
  );

  // Accumulated overlap boost when multiple rounds hit close together
  const accumulationBoost = Math.min(1.0, localOverlapCount * 0.22);

  // Outer contour irregularity & chipped edge fragments
  const contourIrregularity = Math.max(
    0.08,
    Math.min(
      0.96,
      matProfile.rimIrregularity * (0.82 + rng() * 0.36) + accumulationBoost * 0.16
    )
  );

  const chipMaskSeed = rng();

  // Central cavity darkness and thermal scorch
  const scorchIntensity = Math.max(
    0.12,
    Math.min(
      1.0,
      weaponProfile.emberGlow * (0.72 + rng() * 0.42) + accumulationBoost * 0.2
    )
  );
  const coreDarkness =
    materialType === 'glass'
      ? 0.35 + rng() * 0.2
      : Math.max(0.55, Math.min(1.0, 0.78 + weaponProfile.craterDepthFactor * 0.2));

  // Crack count, length, and branching
  const [minCracks, maxCracks] = matProfile.crackCountRange;
  const baseCracks =
    minCracks + Math.floor(rng() * (maxCracks - minCracks + 1));
  const crackCount = Math.max(
    0,
    Math.min(
      16,
      Math.round(
        (baseCracks + weaponProfile.crackCount * 0.35) *
          (1.0 + accumulationBoost * 0.35)
      )
    )
  );

  const crackLengthRatio = Math.max(
    0.22,
    Math.min(
      1.0,
      matProfile.crackIntensity * (0.76 + rng() * 0.38) + accumulationBoost * 0.18
    )
  );

  const crackBranching = Math.max(
    0.05,
    Math.min(1.0, matProfile.radialBranching * (0.8 + rng() * 0.4))
  );

  const rotationOffsetRad = rng() * Math.PI * 2;

  return {
    seed,
    shapeFamily,
    shaderMaterialCode: matProfile.shaderCode,
    holeRadiusRatio,
    aspectRatio: angleResult.elongation,
    contourIrregularity,
    chipMaskSeed,
    scorchIntensity,
    coreDarkness,
    rotationOffsetRad,
    crackCount,
    crackLengthRatio,
    crackBranching,
    accumulationBoost,
    localOverlapCount,
  };
}

/**
 * Clamps an impact pose strictly inside the hit arena surface (floor, perimeter wall,
 * solid architectural block, or cylindrical pillar) so decals never float in mid-air.
 */
function clampImpactToArenaSurface(
  arena: ArenaDefinition,
  hitX: number,
  hitY: number,
  hitZ: number,
  posX: number,
  posY: number,
  posZ: number,
  nx: number,
  ny: number,
  nz: number,
  tx: number,
  ty: number,
  tz: number,
  bx: number,
  by: number,
  bz: number,
  scaleT: number,
  scaleB: number,
  propKind?: 'crate' | 'barrel' | null
): {
  validSurface: boolean;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  scaleT: number;
  scaleB: number;
  surfaceId: string | null;
} {
  if (propKind) {
    return {
      validSurface: true,
      x: posX + nx * 0.012,
      y: posY + ny * 0.012,
      z: posZ + nz * 0.012,
      nx,
      ny,
      nz,
      scaleT,
      scaleB,
      surfaceId: `prop_${propKind}`,
    };
  }

  const edgePad = 0.015;

  // Case A: Arena Floor (y ≈ 0, ny > 0.75)
  if (ny > 0.75 && Math.abs(hitY) <= 0.14) {
    const extX = 0.5 * (Math.abs(tx) * scaleT + Math.abs(bx) * scaleB);
    const extZ = 0.5 * (Math.abs(tz) * scaleT + Math.abs(bz) * scaleB);
    const clampedX = Math.max(
      arena.bounds.minX + extX + edgePad,
      Math.min(arena.bounds.maxX - extX - edgePad, posX)
    );
    const clampedZ = Math.max(
      arena.bounds.minZ + extZ + edgePad,
      Math.min(arena.bounds.maxZ - extZ - edgePad, posZ)
    );
    return {
      validSurface: true,
      x: clampedX,
      y: 0.016,
      z: clampedZ,
      nx: 0,
      ny: 1,
      nz: 0,
      scaleT,
      scaleB,
      surfaceId: 'floor',
    };
  }

  // Case B: Solid Architectural Block Face
  const faceTol = 0.18;
  let matchedBlock: MapBoxBlock | null = null;
  let bestFaceDist = Infinity;

  for (let i = 0; i < arena.blocks.length; i++) {
    const b = arena.blocks[i];
    const hw = b.width * 0.5;
    const hd = b.depth * 0.5;
    const minX = b.x - hw;
    const maxX = b.x + hw;
    const minZ = b.z - hd;
    const maxZ = b.z + hd;

    if (
      hitX >= minX - faceTol &&
      hitX <= maxX + faceTol &&
      hitZ >= minZ - faceTol &&
      hitZ <= maxZ + faceTol &&
      hitY >= -faceTol &&
      hitY <= b.height + faceTol
    ) {
      let faceDist = Infinity;
      if (Math.abs(nx) > 0.7) {
        const targetX = nx > 0 ? maxX : minX;
        faceDist = Math.abs(hitX - targetX);
      } else if (Math.abs(nz) > 0.7) {
        const targetZ = nz > 0 ? maxZ : minZ;
        faceDist = Math.abs(hitZ - targetZ);
      } else if (ny > 0.7) {
        faceDist = Math.abs(hitY - b.height);
      }
      if (faceDist < bestFaceDist && faceDist <= faceTol) {
        bestFaceDist = faceDist;
        matchedBlock = b;
      }
    }
  }

  if (matchedBlock) {
    const hw = matchedBlock.width * 0.5;
    const hd = matchedBlock.depth * 0.5;
    const minX = matchedBlock.x - hw;
    const maxX = matchedBlock.x + hw;
    const minZ = matchedBlock.z - hd;
    const maxZ = matchedBlock.z + hd;
    const maxY = matchedBlock.height;

    let outScaleT = scaleT;
    let outScaleB = scaleB;
    let cx = posX;
    let cy = posY;
    let cz = posZ;

    if (Math.abs(nx) > 0.7) {
      let extZ = 0.5 * (Math.abs(tz) * outScaleT + Math.abs(bz) * outScaleB);
      let extY = 0.5 * (Math.abs(ty) * outScaleT + Math.abs(by) * outScaleB);
      const maxAllowedZ = Math.max(0.03, matchedBlock.depth * 0.45);
      const maxAllowedY = Math.max(0.03, maxY * 0.45);
      if (extZ > maxAllowedZ || extY > maxAllowedY) {
        const shrink = Math.min(
          maxAllowedZ / Math.max(1e-4, extZ),
          maxAllowedY / Math.max(1e-4, extY)
        );
        outScaleT *= shrink;
        outScaleB *= shrink;
        extZ *= shrink;
        extY *= shrink;
      }
      cz = Math.max(minZ + extZ + edgePad, Math.min(maxZ - extZ - edgePad, cz));
      cy = Math.max(extY + edgePad, Math.min(maxY - extY - edgePad, cy));
      cx = (nx > 0 ? maxX : minX) + (nx > 0 ? 0.011 : -0.011);
    } else if (Math.abs(nz) > 0.7) {
      let extX = 0.5 * (Math.abs(tx) * outScaleT + Math.abs(bx) * outScaleB);
      let extY = 0.5 * (Math.abs(ty) * outScaleT + Math.abs(by) * outScaleB);
      const maxAllowedX = Math.max(0.03, matchedBlock.width * 0.45);
      const maxAllowedY = Math.max(0.03, maxY * 0.45);
      if (extX > maxAllowedX || extY > maxAllowedY) {
        const shrink = Math.min(
          maxAllowedX / Math.max(1e-4, extX),
          maxAllowedY / Math.max(1e-4, extY)
        );
        outScaleT *= shrink;
        outScaleB *= shrink;
        extX *= shrink;
        extY *= shrink;
      }
      cx = Math.max(minX + extX + edgePad, Math.min(maxX - extX - edgePad, cx));
      cy = Math.max(extY + edgePad, Math.min(maxY - extY - edgePad, cy));
      cz = (nz > 0 ? maxZ : minZ) + (nz > 0 ? 0.011 : -0.011);
    } else {
      let extX = 0.5 * (Math.abs(tx) * outScaleT + Math.abs(bx) * outScaleB);
      let extZ = 0.5 * (Math.abs(tz) * outScaleT + Math.abs(bz) * outScaleB);
      const maxAllowedX = Math.max(0.03, matchedBlock.width * 0.45);
      const maxAllowedZ = Math.max(0.03, matchedBlock.depth * 0.45);
      if (extX > maxAllowedX || extZ > maxAllowedZ) {
        const shrink = Math.min(
          maxAllowedX / Math.max(1e-4, extX),
          maxAllowedZ / Math.max(1e-4, extZ)
        );
        outScaleT *= shrink;
        outScaleB *= shrink;
        extX *= shrink;
        extZ *= shrink;
      }
      cx = Math.max(minX + extX + edgePad, Math.min(maxX - extX - edgePad, cx));
      cz = Math.max(minZ + extZ + edgePad, Math.min(maxZ - extZ - edgePad, cz));
      cy = maxY + 0.011;
    }

    return {
      validSurface: true,
      x: cx,
      y: cy,
      z: cz,
      nx,
      ny,
      nz,
      scaleT: outScaleT,
      scaleB: outScaleB,
      surfaceId: matchedBlock.id,
    };
  }

  // Case C: Cylindrical Pillars / Colliders
  for (let i = 0; i < arena.colliders.length; i++) {
    const col = arena.colliders[i];
    const radialDist = Math.hypot(hitX - col.x, hitZ - col.z);
    if (
      Math.abs(radialDist - col.radius) <= 0.22 &&
      hitY >= 0 &&
      hitY <= col.height + 0.1
    ) {
      const rnx = (hitX - col.x) / Math.max(1e-4, radialDist);
      const rnz = (hitZ - col.z) / Math.max(1e-4, radialDist);
      const clampedY = Math.max(0.12, Math.min(col.height - 0.12, posY));
      return {
        validSurface: true,
        x: col.x + rnx * (col.radius + 0.012),
        y: clampedY,
        z: col.z + rnz * (col.radius + 0.012),
        nx: rnx,
        ny: 0,
        nz: rnz,
        scaleT: Math.min(scaleT, col.radius * 0.85),
        scaleB: Math.min(scaleB, col.radius * 0.85),
        surfaceId: col.id,
      };
    }
  }

  // Case D: Outer Perimeter Compound Walls
  const perimHeight = 9.0;
  if (hitY >= -faceTol && hitY <= perimHeight + faceTol) {
    if (
      Math.abs(nx) > 0.7 &&
      (Math.abs(hitX - arena.bounds.minX) <= faceTol ||
        Math.abs(hitX - arena.bounds.maxX) <= faceTol)
    ) {
      const isMinX =
        Math.abs(hitX - arena.bounds.minX) <= Math.abs(hitX - arena.bounds.maxX);
      const wallX = isMinX ? arena.bounds.minX : arena.bounds.maxX;
      const extZ = 0.5 * (Math.abs(tz) * scaleT + Math.abs(bz) * scaleB);
      const extY = 0.5 * (Math.abs(ty) * scaleT + Math.abs(by) * scaleB);
      const cz = Math.max(
        arena.bounds.minZ + extZ + edgePad,
        Math.min(arena.bounds.maxZ - extZ - edgePad, posZ)
      );
      const cy = Math.max(extY + edgePad, Math.min(perimHeight - extY - edgePad, posY));
      const cx = wallX + (isMinX ? 0.014 : -0.014);
      return {
        validSurface: true,
        x: cx,
        y: cy,
        z: cz,
        nx: isMinX ? 1 : -1,
        ny: 0,
        nz: 0,
        scaleT,
        scaleB,
        surfaceId: isMinX ? 'perimeter_west' : 'perimeter_east',
      };
    }
    if (
      Math.abs(nz) > 0.7 &&
      (Math.abs(hitZ - arena.bounds.minZ) <= faceTol ||
        Math.abs(hitZ - arena.bounds.maxZ) <= faceTol)
    ) {
      const isMinZ =
        Math.abs(hitZ - arena.bounds.minZ) <= Math.abs(hitZ - arena.bounds.maxZ);
      const wallZ = isMinZ ? arena.bounds.minZ : arena.bounds.maxZ;
      const extX = 0.5 * (Math.abs(tx) * scaleT + Math.abs(bx) * scaleB);
      const extY = 0.5 * (Math.abs(ty) * scaleT + Math.abs(by) * scaleB);
      const cx = Math.max(
        arena.bounds.minX + extX + edgePad,
        Math.min(arena.bounds.maxX - extX - edgePad, posX)
      );
      const cy = Math.max(extY + edgePad, Math.min(perimHeight - extY - edgePad, posY));
      const cz = wallZ + (isMinZ ? 0.014 : -0.014);
      return {
        validSurface: true,
        x: cx,
        y: cy,
        z: cz,
        nx: 0,
        ny: 0,
        nz: isMinZ ? 1 : -1,
        scaleT,
        scaleB,
        surfaceId: isMinZ ? 'perimeter_north' : 'perimeter_south',
      };
    }
  }

  return {
    validSurface: false,
    x: hitX,
    y: hitY,
    z: hitZ,
    nx,
    ny,
    nz,
    scaleT,
    scaleB,
    surfaceId: null,
  };
}
