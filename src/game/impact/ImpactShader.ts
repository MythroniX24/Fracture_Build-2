import * as THREE from 'three';

/**
 * Shared Instanced Procedural Bullet Impact Shader (`ImpactShader.ts`).
 *
 * Renders hundreds of unique, angle-deformed, material-specific bullet impacts in a SINGLE
 * batched `THREE.InstancedMesh` draw call using compact per-instance attributes:
 *
 * - `aImpactParams0` (vec4):
 *     x: deterministic float seed [0..1000]
 *     y: shapeFamily (0..3) + rotationOffsetRad * 0.1
 *     z: elongation (aspect ratio >= 1.0)
 *     w: asymmetry (0.0 = symmetric perpendicular, > 0 = teardrop/gouge warp)
 * - `aImpactParams1` (vec4):
 *     x: holeRadiusRatio [0.12..0.42]
 *     y: contourIrregularity [0.08..0.96]
 *     z: crackLengthRatio [0.0..1.0]
 *     w: scorchIntensity [0.1..1.0]
 * - `aImpactColorCore` (vec3):
 *     central cavity / bore RGB color
 * - `aImpactColorRim` (vec3):
 *     chipped spall rim / wood splinter / metallic dent / glass frost RGB color
 * - `aImpactMeta` (vec4):
 *     x: materialCode (0=concrete, 1=stone, 2=wood, 3=metal, 4=glass, 5=tile, 6=gravel)
 *     y: opacityFade [0..1] (age/cleanup fade + fresh thermal ember pulse)
 *     z: crackCount [0..16]
 *     w: accumulationBoost [0..1] (boosted when multiple shots overlap closely)
 */

export interface ProceduralImpactShaderUniforms {
  [uniform: string]: THREE.IUniform<unknown>;
  uTime: THREE.IUniform<number>;
  uCameraPos: THREE.IUniform<THREE.Vector3>;
  uLodNear: THREE.IUniform<number>;
  uLodFar: THREE.IUniform<number>;
  uDetailLevel: THREE.IUniform<number>;
}

const VERTEX_SHADER = /* glsl */ `
  attribute vec4 aImpactParams0;
  attribute vec4 aImpactParams1;
  attribute vec3 aImpactColorCore;
  attribute vec3 aImpactColorRim;
  attribute vec4 aImpactMeta;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec4 vParams0;
  varying vec4 vParams1;
  varying vec3 vColorCore;
  varying vec3 vColorRim;
  varying vec4 vMeta;

  void main() {
    vUv = uv * 2.0 - 1.0; // Remap [0, 1] -> [-1, 1] local tangent/bitangent plane
    vParams0 = aImpactParams0;
    vParams1 = aImpactParams1;
    vColorCore = aImpactColorCore;
    vColorRim = aImpactColorRim;
    vMeta = aImpactMeta;

    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec3 uCameraPos;
  uniform float uLodNear;
  uniform float uLodFar;
  uniform float uDetailLevel;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec4 vParams0;
  varying vec4 vParams1;
  varying vec3 vColorCore;
  varying vec3 vColorRim;
  varying vec4 vMeta;

  // Fast deterministic 1D/2D hash functions (zero texture lookups required)
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash12(i + vec2(0.0, 0.0)), hash12(i + vec2(1.0, 0.0)), u.x),
      mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // Multi-harmonic angular contour noise seeded per impact
  float angularContourNoise(float angle, float seed, float irregularity, float shapeFamily) {
    float s1 = sin(angle * 3.0 + seed * 1.7) * 0.36;
    float s2 = cos(angle * 5.0 - seed * 2.9) * 0.28;
    float s3 = sin(angle * 9.0 + seed * 4.3) * 0.20;
    float s4 = cos(angle * 15.0 - seed * 6.1) * 0.16;

    // Shape family modulation:
    // 0: spall_crater, 1: star_fracture, 2: directional_gouge, 3: stepped_cavern
    float starBoost = (abs(shapeFamily - 1.0) < 0.4) ? sin(angle * 7.0 + seed) * 0.28 : 0.0;
    float stepQuant = (abs(shapeFamily - 3.0) < 0.4) ? floor((s1 + s2) * 4.0) * 0.15 : 0.0;

    return (s1 + s2 + s3 + s4 + starBoost + stepQuant) * irregularity;
  }

  void main() {
    float opacityFade = vMeta.y;
    if (opacityFade <= 0.005) discard;

    float seed = vParams0.x;
    float shapeFamily = floor(vParams0.y + 0.001);
    float rotOffset = fract(vParams0.y) * 62.8318;
    float elongation = max(1.0, vParams0.z);
    float asymmetry = clamp(vParams0.w, 0.0, 0.9);

    float holeRadius = clamp(vParams1.x, 0.10, 0.48);
    float rimIrreg = clamp(vParams1.y, 0.05, 0.98);
    float crackReach = clamp(vParams1.z, 0.0, 1.0);
    float scorchStrength = clamp(vParams1.w, 0.05, 1.0);

    float matCode = floor(vMeta.x + 0.1);
    float crackCount = clamp(vMeta.z, 1.0, 16.0);
    float accumBoost = clamp(vMeta.w, 0.0, 1.0);

    // Distance-based LOD factor (1.0 close up, smoothly drops to 0.0 beyond uLodFar)
    float camDist = distance(vWorldPos, uCameraPos);
    float lodFactor = 1.0 - smoothstep(uLodNear, uLodFar, camDist);

    // 1. Angle-Dependent Non-Linear Coordinate Deformation (NOT a simple stretched circle!)
    // Entry side (-x along tangent) pinches into a sharp entry lip;
    // Exit side (+x along tangent) flares outward into a spall fan or grazing furrow.
    vec2 p = vUv;
    float entryExitFlare = 1.0 + p.x * asymmetry * 0.48;
    vec2 warped = p;
    warped.x = p.x - asymmetry * 0.14 * (1.0 - p.y * p.y);
    warped.y = p.y / max(0.52, entryExitFlare);

    // Grazing gouge channel compression for shapeFamily == 2
    if (abs(shapeFamily - 2.0) < 0.4) {
      warped.y *= 1.18 + 0.25 * (1.0 - abs(p.x));
    }

    float r = length(warped);
    if (r > 0.99) discard;

    float angle = atan(warped.y, warped.x) + rotOffset;

    // 2. Procedural Chipped Contour & Missing Edge Chunks
    float angNoise = angularContourNoise(angle, seed, rimIrreg, shapeFamily);
    float highFreqChip = (lodFactor > 0.15)
      ? (noise2D(warped * 9.5 + vec2(seed * 0.37, seed * 0.71)) - 0.5) * 0.18 * rimIrreg * lodFactor
      : 0.0;

    float distortedR = r + angNoise * 0.22 + highFreqChip;

    // Define core bore, inner spall shelf, outer chipped rim, and dust/scorch halo radii
    float boreR = holeRadius * (1.0 + accumBoost * 0.22);
    float innerShelfR = boreR * (1.42 + rimIrreg * 0.35);
    float outerRimR = min(0.84, innerShelfR * (1.35 + accumBoost * 0.18));

    // Directional exit spall extension along +tangent (+x)
    float exitBias = max(0.0, cos(angle - rotOffset)) * asymmetry * 0.24;
    outerRimR += exitBias;

    // 3. Procedural Radial & Branching Cracks
    float crackMask = 0.0;
    if (crackReach > 0.05 && lodFactor > 0.08 && r > boreR * 0.75) {
      float radialNorm = (r - boreR * 0.75) / max(0.15, 0.95 - boreR * 0.75);
      if (radialNorm < crackReach) {
        // Angular sector wobble so cracks zig-zag organically
        float jitterAngle = angle + sin(r * 22.0 + seed * 3.1) * (0.08 + 0.06 * rimIrreg);
        float sector = abs(sin(jitterAngle * crackCount * 0.5 + seed));
        float sharpness = mix(14.0, 28.0, lodFactor);
        float primaryCrack = pow(max(0.0, 1.0 - sector), sharpness);

        // Secondary branched sub-cracks on desktop quality or glass/stone
        float branchCrack = 0.0;
        if (uDetailLevel > 1.5 || abs(matCode - 4.0) < 0.4) {
          float branchSector = abs(cos(jitterAngle * (crackCount * 1.5) - r * 14.0 + seed * 1.9));
          branchCrack = pow(max(0.0, 1.0 - branchSector), sharpness * 1.2) * 0.65;
        }

        // Glass & Ceramic Tile add concentric cobweb fracture rings
        float concentricRing = 0.0;
        if (abs(matCode - 4.0) < 0.4 || abs(matCode - 5.0) < 0.4) {
          float ringWave = abs(sin(distortedR * 24.0 + angNoise * 5.0 + seed));
          concentricRing = pow(max(0.0, 1.0 - ringWave), 16.0) * 0.75;
        }

        float radialFade = (1.0 - radialNorm / max(0.01, crackReach));
        crackMask = clamp((primaryCrack + branchCrack + concentricRing) * radialFade * lodFactor, 0.0, 1.0);
      }
    }

    // 4. Material-Specific Procedural Surface Damage Synthesis
    vec3 finalColor = vColorCore;
    float finalAlpha = 0.0;

    // Directional relief lighting term (simulates top-left recessed shadow & bottom-right sunlit lip)
    float reliefGrad = dot(normalize(warped + vec2(0.0001)), normalize(vec2(-0.65, -0.75)));

    if (abs(matCode - 2.0) < 0.4) {
      // === WOOD: Directional grain splintering & fibrous tear ===
      float grainNoise = sin(warped.y * 38.0 + noise2D(warped * 12.0 + seed) * 3.0);
      float splinterStretch = abs(warped.x) / max(1.0, 1.35 + abs(grainNoise) * 0.85);
      float woodDist = length(vec2(splinterStretch, warped.y * 1.15)) + angNoise * 0.16;

      float coreMask = 1.0 - smoothstep(boreR * 0.75, boreR * 1.08, woodDist);
      float splinterRim = (1.0 - smoothstep(boreR, outerRimR * 1.12, woodDist)) * (1.0 - coreMask);
      float grainStrips = step(0.15, grainNoise) * splinterRim;

      finalColor = mix(vColorRim * 0.72, vColorRim * 1.18, grainStrips);
      finalColor = mix(finalColor, vColorCore, coreMask);
      finalColor = mix(finalColor, vColorCore * 0.6, crackMask * 0.85);

      float scorchHalo = (1.0 - smoothstep(boreR, outerRimR * 1.25, r)) * scorchStrength * 0.45;
      finalAlpha = clamp(coreMask * 0.96 + splinterRim * 0.85 + crackMask * 0.75 + scorchHalo, 0.0, 1.0);
    } else if (abs(matCode - 3.0) < 0.4) {
      // === METAL: Punched dark armor core + smooth raised specular dent lip ===
      float metalDist = r + angNoise * 0.07;
      float coreMask = 1.0 - smoothstep(boreR * 0.82, boreR * 1.02, metalDist);
      float dentCollar = exp(-pow((metalDist - boreR * 1.22) / max(0.04, boreR * 0.42), 2.0));
      float specSheen = max(0.0, -reliefGrad) * dentCollar * 1.35;
      float grazingStreak = (elongation > 1.25 && p.x > 0.0)
        ? exp(-abs(p.y) * 7.5) * (1.0 - smoothstep(boreR, outerRimR * 1.15, p.x)) * 0.75
        : 0.0;

      finalColor = mix(vColorCore * 1.4, vColorRim, clamp(dentCollar * 0.75 + specSheen + grazingStreak, 0.0, 1.0));
      finalColor = mix(finalColor, vColorCore, coreMask);

      float heatBlueHalo = (1.0 - smoothstep(boreR, outerRimR * 1.15, metalDist)) * scorchStrength * 0.42;
      finalAlpha = clamp(coreMask * 0.98 + dentCollar * 0.88 + grazingStreak * 0.75 + crackMask * 0.45 + heatBlueHalo, 0.0, 1.0);
    } else if (abs(matCode - 4.0) < 0.4) {
      // === GLASS: Crushed frosty white impact core + dense branching cobweb fractures ===
      float coreFrost = 1.0 - smoothstep(0.0, boreR * 1.15, distortedR);
      float outerFrost = (1.0 - smoothstep(boreR, outerRimR * 1.1, distortedR)) * 0.42;
      finalColor = mix(vColorRim, vec3(1.0), coreFrost * 0.75 + crackMask * 0.65);
      finalAlpha = clamp(coreFrost * 0.92 + outerFrost + crackMask * 0.95, 0.0, 0.96);
    } else {
      // === CONCRETE (0), STONE (1), TILE (5), GRAVEL (6): Multi-shelf spall crater & radial fractures ===
      float coreMask = 1.0 - smoothstep(boreR * 0.78, boreR * 1.06, distortedR);
      float innerSpall = (1.0 - smoothstep(boreR * 0.95, innerShelfR, distortedR)) * (1.0 - coreMask);
      float outerSpall = (1.0 - smoothstep(innerShelfR * 0.9, outerRimR, distortedR)) * (1.0 - coreMask - innerSpall);

      // Chipped stone fragments around the outer spall boundary
      float chipDots = 0.0;
      if (lodFactor > 0.2) {
        float cell = hash12(floor((warped + vec2(seed * 0.13)) * 16.0));
        chipDots = step(0.86 - accumBoost * 0.08, cell) * (1.0 - smoothstep(boreR * 1.1, outerRimR * 1.22, r)) * lodFactor;
      }

      // 3D bevel shading inside the spall basin
      vec3 spallShaded = vColorRim * (0.76 - reliefGrad * 0.28);
      vec3 outerColor = mix(vColorRim * 0.58, spallShaded, innerSpall);

      finalColor = mix(outerColor, vColorCore, coreMask);
      finalColor = mix(finalColor, vColorCore * 0.45, crackMask * 0.92);
      finalColor = mix(finalColor, vColorRim * 1.12, chipDots * 0.75);

      // Subtle outer carbon & pulverized dust halo
      float dustHalo = (1.0 - smoothstep(boreR * 0.9, min(0.98, outerRimR * 1.32), r)) * (0.36 + scorchStrength * 0.28);
      finalAlpha = clamp(
        coreMask * 0.98 +
        innerSpall * 0.90 +
        outerSpall * 0.68 +
        crackMask * 0.88 +
        chipDots * 0.72 +
        dustHalo,
        0.0,
        0.98
      );
    }

    // Soft circular outer boundary feathering to guarantee zero square quad edges
    float edgeFeather = 1.0 - smoothstep(0.82, 0.99, r);
    finalAlpha *= edgeFeather * opacityFade;

    if (finalAlpha <= 0.01) discard;

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export function createProceduralImpactShaderMaterial(
  lodNearDist = 14.0,
  lodFarDist = 55.0,
  detailLevel = 2
): THREE.ShaderMaterial {
  const uniforms: ProceduralImpactShaderUniforms = {
    uTime: { value: 0 },
    uCameraPos: { value: new THREE.Vector3() },
    uLodNear: { value: lodNearDist },
    uLodFar: { value: lodFarDist },
    uDetailLevel: { value: detailLevel },
  };

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
}
