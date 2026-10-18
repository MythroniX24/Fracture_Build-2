# FRACTURE — 3D Arena Fighting Game

FRACTURE is a skill-based 3D industrial fantasy arena fighting game built with React, TypeScript, Three.js, Web Audio API, and an optional Express + WebSocket multiplayer server.

## 1. Project Architecture

- `server.ts` — Full-stack Express + WebSocket (`/ws`) server supporting local development and real-time 2-player online multiplayer rooms.
- `src/game/config.ts` — Centralized character registry (`VOLT` and `RIFT`), attack frame data, arena definitions (`iron_fortress` and `overgrown_colossus`), AI difficulty profiles (`easy`, `normal`, `hard`), and settings.
- `src/game/rules.ts` — Pure deterministic combat simulation, movement physics, spatial cone/range/obstacle hit detection, guard/parry/dodge mechanics, stamina regeneration, unique character abilities, and round/match state machine.
- `src/game/ai.ts` — State-driven Bot AI controller with observable perception (`idle`, `approach`, `maintain_distance`, `attack`, `defend`, `dodge`, `counter`, `recover`, `reposition`, `react_ability`, `return_to_combat`) and Training dummy modes.
- `src/game/rules.test.ts` — Automated unit tests using `node:test` and `node:assert/strict`.
- `src/three/materials.ts` — Procedural PBR textures (`CanvasTexture` bump/roughness maps) and shared `MeshStandardMaterial` library with `RoomEnvironment` reflections.
- `src/three/characters.ts` — Procedural 14-part articulated 3D character rigs and animation solver for **VOLT** and **RIFT** (including RIFT's False Remnant decoy).
- `src/three/arenas.ts` — Procedural 3D arenas: **The Iron Fortress** (octagonal crucible deck, rotating bevel-toothed gears, blast pylons, molten pit) and **The Overgrown Colossus** (sunken sanctuary, fallen Titan skull/horns/forearm, curving root arches, instanced mossy boulders).
- `src/three/particles.ts` — Zero-GC pooled `THREE.InstancedMesh` particle ring buffer for hit sparks, guard clangs, parry shockwaves, and ability discharges.
- `src/audio/soundEngine.ts` — Procedural Web Audio API sound synthesizer with master volume and mute controls.
- `src/network/multiplayerClient.ts` — Real-time WebSocket client for room creation, room code joining, state synchronization, remote interpolation, and disconnect recovery.
- `src/components/GameCanvas.tsx` — Isolated Three.js WebGL viewport with smooth exponentially-damped combat camera, obstacle pull-in raycasting, and direct 60Hz DOM ref updates.
- `src/components/CombatHUD.tsx` — Industrial editorial combat HUD, collapsible Training Mode bottom dock, and responsive mobile virtual joystick + 5-button touch cluster.
- `src/components/MenuScreens.tsx` — Complete screen navigation (Main Menu, Mode Select, Character Select, Arena Select, Match Settings, Multiplayer Lobby, Pause Modal, Match Result Modal, and Settings Modal).

## 2. Launch & Test Instructions

```bash
# Install dependencies
npm install

# Run deterministic unit tests
node --test src/game/rules.test.ts

# Start development server (Express + Vite + WebSocket on port 3000)
npm run dev

# Build for production
npm run build
```

## 3. Desktop & Mobile Controls

### Desktop Keyboard (Rebindable in Settings)
- **Move**: `W`, `A`, `S`, `D` or Arrow Keys
- **Sprint**: `Left Shift`
- **Light Strike**: `J`
- **Heavy Strike**: `K`
- **Guard / Timed Parry**: `L` (tap just before impact to Parry; hold to Guard)
- **Directional Dodge**: `Space`
- **Character Ability**: `U`
- **Pause / Resume**: `Escape` or `P`
- **Mute Audio**: `M`
- **Reset Training Positions**: `R`

### Mobile Touch
- **Bottom-Left Virtual Joystick**: 360-degree directional movement (outer ring engages sprint).
- **Bottom-Right Action Cluster**: `STRIKE (LIGHT)`, `HEAVY`, `GUARD / PARRY`, `DODGE`, and `SKILL (ABILITY)` buttons.
