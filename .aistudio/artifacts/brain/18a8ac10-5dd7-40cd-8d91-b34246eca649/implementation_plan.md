# Weapon-Specific Ballistic Gunshot Marks & 360° Grazing-Angle Surface Projection

Deliver distinct, power-scaled gunshot impact marks for all 6 weapons (`MP5-K`, `M4A1`, `AK-47`, `Desert Eagle .50`, `SPAS-12`, and `AWP`) with true 360° incident-angle elongation, directional burn/ricochet streaks, angled spark deflection, and strict wall-face clamping so no mark ever floats in mid-air.

## User Review & Critical Decisions

> [!IMPORTANT]
> All core visual and physical preferences were confirmed in Phase 1 and are incorporated below:

- **Confirmed Decision 1 (6 Distinct Weapon-Power Impact Marks)**: Each of the 6 weapons receives its own dedicated ballistic crater texture, fracture pattern, heated ember core glow, and physical scale matched to its caliber and damage output (`21 DMG` 9mm MP5 up to `115 DMG` .338 Lapua AWP).
- **Confirmed Decision 2 (360° Grazing-Angle Oval Gouge, Burn Streak & Angled Sparks)**: Gunshot decals align their tangent axis with the incoming 3D bullet vector projected onto the hit wall/floor plane, stretching into an angled oval gouge with a directional carbon burn/ricochet streak and deflected spark cone.
- **Confirmed Decision 3 (120-Decal Pool & Strict Wall-Edge Clamping)**: The pooled decal capacity increases to 120 simultaneous marks, and every decal's position and half-extents are mathematically clamped inside the hit wall face boundaries (`minX..maxX`, `minY..maxY`, `minZ..maxZ`) so zero pixels ever overhang into empty air.

---

## 1. Overview & Core Concept

- **What It Does**: Replaces generic circular bullet decals with a physically grounded 3D ballistic surface impact system where every shot reflects the exact weapon caliber/power and the exact 3D angle of incidence ($0^\circ\text{–}360^\circ$ around any wall or floor surface).
- **Target Audience / Persona**: Tactical first-person shooter players who expect responsive, visually authentic ballistic feedback when firing from straight-on, diagonal, or steep side/flank angles.
- **Key Value**: Makes every gun feel distinctly powerful on impact and ensures side-angle wall hits look like genuine angled ballistic gouges firmly embedded inside the wall surface rather than flat front-facing stickers or floating planes.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Caliber-Differentiated Firing**: When firing any of the 6 weapons at walls, cover barriers, towers, containers, or floors, the player immediately sees a unique impact signature:
     - **MP5-K (9mm, 21 DMG)**: Tight, shallow high-velocity puncture (`0.15m` base) with a compact steel-gray spall rim and faint pinpoint ember.
     - **M4A1 (5.56mm NATO, 28 DMG)**: Crisp tactical entry hole (`0.20m` base) with 6 sharp radial concrete micro-cracks and warm amber inner ring.
     - **AK-47 (7.62×39mm Heavy, 36 DMG)**: Deep jagged concrete crater (`0.25m` base) with heavy chunk spalling, 9 branched fracture lines, and glowing orange-red core heat.
     - **Desert Eagle (.50 AE, 54 DMG)**: Wide, heavy blunt-force punch crater (`0.28m` base) with concentric shock rings, pulverized masonry rim, and bright brass-amber heat halo.
     - **SPAS-12 (12-Gauge Buckshot, 8 Pellets)**: Each pellet ray casts its own individual angled buckshot pit (`0.12m` per pellet) with powder-burn scorching and mini-radial chips across the spread pattern.
     - **AWP (.338 Lapua Magnum, 115 DMG)**: Massive high-energy penetration crater (`0.36m` base) with deep molten orange-gold core glow, wide pulverized outer spall zone, and 12 long structural fracture cracks.
  2. **360° Grazing / Side-Angle Shots**: Shooting a wall from the left, right, above, below, or any diagonal angle produces an elongated elliptical entry gouge oriented along the bullet's travel direction across the wall face, complete with a directional forward carbon/ricochet streak and sparks deflecting along the grazing reflection vector.
  3. **Edge & Corner Shots**: Shooting near the top, bottom, or side edge of a wall or barrier automatically clamps and trims the decal footprint within the solid wall face so the gunshot mark never pokes out into mid-air.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-contrast tactical ballistic realism with physically readable crater depth, dark carbon soot, exposed aggregate spall, and subtle post-impact thermal ember glow that cools over time.
  - *Color Palette & Mood*: Deep void charcoal (`#05070B`), pulverized slate spall (`#475569` / `#94A3B8`), carbon scorch (`#1E293B`), and caliber-scaled thermal ember accents (`#F59E0B` amber to `#EA580C` molten orange).
- **Interactive Feedback & Motion**:
  - Newly placed gunshot marks exhibit a brief, weapon-scaled thermal ember glow upon impact coupled with directional 3D spark particles and a surface-aligned shock ring.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: True 3D Tangent-Basis Decal Orientation vs. Random Roll Rotation**
  - *Chosen Approach*: Project the normalized 3D bullet direction vector $\vec{d}$ onto the hit surface plane with normal $\vec{n}$ to obtain the exact surface tangent vector $\vec{t} = \text{normalize}(\vec{d} - (\vec{d} \cdot \vec{n})\vec{n})$, construct an orthonormal basis $(\vec{t}, \vec{b}, \vec{n})$, and stretch the decal along $\vec{t}$ by the grazing factor $s_{\parallel} = \text{clamp}(1 / |\vec{d} \cdot \vec{n}|, 1.0, 2.65)$.
  - *Why*: Guarantees that a shot from any $360^\circ$ azimuth and pitch angles the gouge and burn streak in the exact direction the bullet skimmed the wall.
  - *Alternatives Considered*: Random 2D texture rotation, which makes side shots look identical to perpendicular front shots.
- **Decision 2: Analytical Wall-Face AABB Clamping + Mesh Verification**
  - *Chosen Approach*: Combine Three.js raycast mesh verification with analytical face-bound clamping against the hit architectural block's face rectangle (`[minU + halfExtentU, maxU - halfExtentU]`, `[minV + halfExtentV, maxV - halfExtentV]`), shrinking the decal scale if the wall face is narrower than the decal.
  - *Why*: Eliminates any possibility of a decal overhanging a wall corner, top ledge, or cover barrier into empty air while maintaining 60fps zero-GC performance.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│                     3D Ballistic Hitscan & Trace Engine                 │
│  • Records origin (fromX,fromY,fromZ), hitPoint (toX,toY,toZ),          │
│    surface normal (nx,ny,nz), and weaponId ('m4a1'..'awp')              │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│             360° Incident-Angle & Grazing Kinematics Solver             │
│  • Bullet Dir: d = normalize(to - from)                                 │
│  • Grazing Cos: cosθ = clamp(|d · n|, 0.15, 1.0)                        │
│  • Surface Tangent: t = normalize(d - (d · n) * n)                      │
│  • Bitangent: b = normalize(n × t)                                      │
│  • Grazing Stretch: stretch = lerp(1.0, 2.55, (1 - cosθ)^1.15)          │
└─────────────────┬───────────────────────────────────┬───────────────────┘
                  │                                   │
                  ▼                                   ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────┐
│   6 Weapon-Specific Procedural Maps   │ │ Strict Wall-Face Bound Clamp  │
│  • MP5-K (9mm compact puncture)       │ │ • Identifies hit block face   │
│  • M4A1 (5.56mm radial crack crater)  │ │ • Clamps (u,v) center inside  │
│  • AK-47 (7.62mm heavy jagged spall)  │ │   face margins by oriented    │
│  • Deagle (.50AE blunt shock crater)  │ │   ellipse half-extents        │
│  • SPAS-12 (12ga pellet pit + scorch) │ │ • Rejects/shrinks if near     │
│  • AWP (.338 deep molten fracture)    │ │   thin edge (no air overhang) │
│  + Directional Grazing Streak Overlay │ └───────────────┬───────────────┘
└─────────────────┬─────────────────────┘                 │
                  └───────────────────┬───────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                 120-Slot Zero-GC Pooled 3D Decal Renderer               │
│  • Applies basis matrix [t * scaleU, b * scaleV, n] + polygonOffset     │
│  • Deflects 3D spark cone along grazing reflection vector r = d - 2(d·n)n│
└─────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - Expand `ProceduralTextureSet` to provide 6 dedicated weapon impact textures (`bulletHoleMp5Map`, `bulletHoleM4a1Map`, `bulletHoleAk47Map`, `bulletHoleDeagleMap`, `bulletHoleShotgunMap`, `bulletHoleAwpMap`), each rendered on a high-resolution `256×256` canvas with asymmetric directional entry gouge + forward carbon streak details so grazing shots display a realistic directional tail along $+\vec{t}$.
  - Upgrade `DECAL_POOL_SIZE` to `120` pre-allocated decals in `vfxGroup`.
- **Interactive Component & State Mapping**:
  - On every `wall` trace in `spawnTraceImpactVFX`, compute the exact 3D incident vector $\vec{d}$, surface normal $\vec{n}$, grazing angle factor, tangent basis $(\vec{t}, \vec{b}, \vec{n})$, and clamp the world position against the hit `MapBoxBlock` face bounds before activating the pooled decal and directional spark burst.
