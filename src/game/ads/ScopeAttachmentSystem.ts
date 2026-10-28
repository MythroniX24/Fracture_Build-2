import * as THREE from 'three';
import type { WeaponId } from '../config.ts';
import type {
  CoreSelectableOpticId,
  OpticId,
  WeaponOpticLoadout,
} from './ads.types.ts';
import {
  CORE_SELECTABLE_OPTICS,
  DEFAULT_WEAPON_OPTICS,
  OPTIC_REGISTRY,
  getOpticConfig,
} from './optic.config.ts';

/**
 * Checks whether an optic attachment is compatible with the specified weapon.
 */
export function isOpticCompatibleWithWeapon(
  weaponId: WeaponId,
  opticId: OpticId
): boolean {
  const cfg = OPTIC_REGISTRY[opticId];
  if (!cfg) return false;
  return cfg.compatibleWeapons.includes(weaponId);
}

/**
 * Returns the list of selectable optics compatible with the specified weapon.
 */
export function getCompatibleOpticsForWeapon(
  weaponId: WeaponId
): CoreSelectableOpticId[] {
  return CORE_SELECTABLE_OPTICS.filter((opticId) =>
    isOpticCompatibleWithWeapon(weaponId, opticId)
  );
}

/**
 * Resolves the active valid optic for a weapon from a loadout record.
 * Falls back safely to 'none' (Iron Sights) if undefined or incompatible.
 */
export function resolveEquippedOptic(
  weaponId: WeaponId,
  loadout?: Partial<WeaponOpticLoadout> | null
): OpticId {
  const candidate = loadout?.[weaponId] ?? DEFAULT_WEAPON_OPTICS[weaponId] ?? 'none';
  if (isOpticCompatibleWithWeapon(weaponId, candidate)) {
    return candidate;
  }
  return 'none';
}

/**
 * Equips an optic onto a weapon in the player's loadout if compatible.
 */
export function equipOpticForWeapon(
  loadout: WeaponOpticLoadout,
  weaponId: WeaponId,
  opticId: OpticId
): WeaponOpticLoadout {
  const validOptic = isOpticCompatibleWithWeapon(weaponId, opticId)
    ? opticId
    : 'none';
  return {
    ...loadout,
    [weaponId]: validOptic,
  };
}

/**
 * Cycles to the next compatible core optic ('none' -> 'scope_2x' -> 'scope_4x' -> 'none')
 * for quick in-game / armory hot-swapping.
 */
export function cycleWeaponOptic(
  loadout: WeaponOpticLoadout,
  weaponId: WeaponId
): { nextLoadout: WeaponOpticLoadout; nextOpticId: OpticId } {
  const compatible = getCompatibleOpticsForWeapon(weaponId);
  if (compatible.length === 0) {
    return { nextLoadout: loadout, nextOpticId: 'none' };
  }
  const current = resolveEquippedOptic(weaponId, loadout);
  const idx = compatible.indexOf(current as CoreSelectableOpticId);
  const nextOpticId = compatible[(idx + 1) % compatible.length];
  return {
    nextLoadout: equipOpticForWeapon(loadout, weaponId, nextOpticId),
    nextOpticId,
  };
}

/**
 * Builds a high-detail 3D optic mesh for attaching onto a weapon's rail mount (`opticMount`).
 * Only builds the attachment sub-tree so swapping optics never rebuilds the weapon mesh.
 */
export function build3DOpticAttachmentMesh(opticId: OpticId): THREE.Group {
  const group = new THREE.Group();
  group.name = `OpticAttachment_${opticId}`;

  if (opticId === 'none') {
    return group;
  }

  const mountMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.36,
    metalness: 0.86,
  });
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    roughness: 0.3,
    metalness: 0.88,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x09090b,
    roughness: 0.25,
    metalness: 0.92,
  });

  const cfg = getOpticConfig(opticId);
  const lensTintHex =
    opticId === 'scope_2x'
      ? 0x10b981
      : opticId === 'scope_4x'
        ? 0x38bdf8
        : 0xef4444;

  const lensMat = new THREE.MeshStandardMaterial({
    color: lensTintHex,
    emissive: lensTintHex,
    emissiveIntensity: 0.85,
    roughness: 0.08,
    metalness: 0.2,
    transparent: true,
    opacity: 0.72,
  });

  if (opticId === 'red_dot' || opticId === 'holo') {
    // Low-profile Picatinny Riser Base
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.014, 0.085),
      mountMat
    );
    base.position.set(0, 0.007, 0);
    group.add(base);

    // Reflex / Holo Hood
    const hood = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.034, 0.068),
      bodyMat
    );
    hood.position.set(0, 0.028, 0);
    group.add(hood);

    // Glowing Emitter Window
    const windowMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.024, 0.004),
      lensMat
    );
    windowMesh.position.set(0, 0.03, 0.028);
    group.add(windowMesh);
    return group;
  }

  if (opticId === 'scope_2x') {
    // 2x Tactical Combat Optic (Compact Prism / Cantilever Tube)
    const railBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.016, 0.115),
      mountMat
    );
    railBase.position.set(0, 0.008, 0);
    group.add(railBase);

    // Dual Cantilever Rings
    for (const zOff of [-0.034, 0.034]) {
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.032, 0.028, 0.02),
        mountMat
      );
      strut.position.set(0, 0.024, zOff);
      group.add(strut);
    }

    // Main 2x Tube Body
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.021, 0.021, 0.145, 16),
      bodyMat
    );
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.045, 0);
    group.add(tube);

    // Flared Objective & Ocular Bells
    const frontBell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.021, 0.038, 16),
      accentMat
    );
    frontBell.rotation.x = Math.PI / 2;
    frontBell.position.set(0, 0.045, -0.082);
    group.add(frontBell);

    const rearBell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.024, 0.032, 16),
      accentMat
    );
    rearBell.rotation.x = Math.PI / 2;
    rearBell.position.set(0, 0.045, 0.08);
    group.add(rearBell);

    // Top Elevation Turret Cap
    const topTurret = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.014, 12),
      accentMat
    );
    topTurret.position.set(0, 0.068, 0);
    group.add(topTurret);

    // Front & Rear Illuminated Coated Lenses
    const frontLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.021, 0.021, 0.004, 16),
      lensMat
    );
    frontLens.rotation.x = Math.PI / 2;
    frontLens.position.set(0, 0.045, -0.099);
    group.add(frontLens);

    const rearLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.019, 0.019, 0.004, 16),
      lensMat
    );
    rearLens.rotation.x = Math.PI / 2;
    rearLens.position.set(0, 0.045, 0.094);
    group.add(rearLens);

    group.userData.opticId = cfg.id;
    return group;
  }

  // 4x Marksman Scope / 6x / 8x Long-Range Scope
  const isLongScope = opticId === 'scope_6x' || opticId === 'scope_8x';
  const tubeLen = isLongScope ? 0.25 : 0.195;
  const bellRadius = isLongScope ? 0.031 : 0.028;
  const centerHeight = cfg.opticSightHeight;

  const railBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.038, 0.016, tubeLen * 0.72),
    mountMat
  );
  railBase.position.set(0, 0.008, 0);
  group.add(railBase);

  for (const zOff of [-tubeLen * 0.24, tubeLen * 0.24]) {
    const ringMount = new THREE.Mesh(
      new THREE.BoxGeometry(0.034, centerHeight - 0.008, 0.024),
      mountMat
    );
    ringMount.position.set(0, centerHeight * 0.5, zOff);
    group.add(ringMount);
  }

  // Main Marksman Scope Tube
  const mainTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, tubeLen, 16),
    bodyMat
  );
  mainTube.rotation.x = Math.PI / 2;
  mainTube.position.set(0, centerHeight, 0);
  group.add(mainTube);

  // Objective Bell (Front)
  const objBell = new THREE.Mesh(
    new THREE.CylinderGeometry(bellRadius, 0.02, 0.056, 16),
    accentMat
  );
  objBell.rotation.x = Math.PI / 2;
  objBell.position.set(0, centerHeight, -tubeLen * 0.5 - 0.022);
  group.add(objBell);

  // Ocular Bell (Rear Eye-piece)
  const ocuBell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.021, 0.025, 0.044, 16),
    accentMat
  );
  ocuBell.rotation.x = Math.PI / 2;
  ocuBell.position.set(0, centerHeight, tubeLen * 0.5 + 0.018);
  group.add(ocuBell);

  // Top Fiber-Optic / Ballistic Turret & Side Windage Drum
  const topTurret = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.011, 0.018, 12),
    accentMat
  );
  topTurret.position.set(0, centerHeight + 0.024, 0);
  group.add(topTurret);

  const sideTurret = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.016, 12),
    accentMat
  );
  sideTurret.rotation.z = Math.PI / 2;
  sideTurret.position.set(0.024, centerHeight, 0);
  group.add(sideTurret);

  // Illuminated Fiber-Optic Tube on Top of 4x ACOG
  const fiberStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.006, 0.005, 0.065),
    lensMat
  );
  fiberStrip.position.set(0, centerHeight + 0.023, -0.045);
  group.add(fiberStrip);

  // Front & Rear Lenses
  const frontLens = new THREE.Mesh(
    new THREE.CylinderGeometry(bellRadius * 0.86, bellRadius * 0.86, 0.004, 16),
    lensMat
  );
  frontLens.rotation.x = Math.PI / 2;
  frontLens.position.set(0, centerHeight, -tubeLen * 0.5 - 0.048);
  group.add(frontLens);

  const rearLens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.021, 0.021, 0.004, 16),
    lensMat
  );
  rearLens.rotation.x = Math.PI / 2;
  rearLens.position.set(0, centerHeight, tubeLen * 0.5 + 0.038);
  group.add(rearLens);

  group.userData.opticId = cfg.id;
  return group;
}

/**
 * Disposes geometries and materials of a previously attached 3D optic group.
 */
export function dispose3DOpticGroup(group: THREE.Object3D): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material?.dispose();
      }
    }
  });
}
