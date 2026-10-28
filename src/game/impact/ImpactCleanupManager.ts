import type { ImpactInstanceMetadata } from './impact.types.ts';

/**
 * Manages expiration, priority scoring, localized overlap detection,
 * and victim slot recycling for `ImpactInstancePool`.
 */
export class ImpactCleanupManager {
  private recycledCount = 0;

  public getRecycledCount(): number {
    return this.recycledCount;
  }

  public resetStats(): void {
    this.recycledCount = 0;
  }

  /**
   * Counts how many active impacts lie within `clusterRadius` meters on a similarly oriented surface
   * and increments their accumulation state so repeated hits visibly build up local damage.
   */
  public computeLocalOverlapCount(
    slots: readonly ImpactInstanceMetadata[],
    activeLimit: number,
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    clusterRadius = 0.28
  ): number {
    const rSq = clusterRadius * clusterRadius;
    let count = 0;
    for (let i = 0; i < activeLimit; i++) {
      const slot = slots[i];
      if (!slot || !slot.active) continue;
      // Check surface normal alignment
      const dotN = slot.nx * nx + slot.ny * ny + slot.nz * nz;
      if (dotN < 0.75) continue;

      const dx = slot.x - x;
      const dy = slot.y - y;
      const dz = slot.z - z;
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq <= rSq) {
        count++;
        slot.localOverlapCount = Math.min(8, slot.localOverlapCount + 1);
        slot.accumulationBoost = Math.min(1.0, slot.localOverlapCount * 0.22);
      }
    }
    return Math.min(8, count);
  }

  /**
   * Selects the best slot index to allocate for a new impact:
   * 1. First returns any inactive slot within `[0, maxActiveMarks)`.
   * 2. If all slots are active, recycles the lowest-priority mark based on age,
   *    distance from the active camera, and weapon caliber priority.
   */
  public acquireSlot(
    slots: readonly ImpactInstanceMetadata[],
    maxActiveMarks: number,
    cameraX: number,
    cameraY: number,
    cameraZ: number
  ): { slotIndex: number; recycled: boolean } {
    const limit = Math.min(slots.length, maxActiveMarks);
    for (let i = 0; i < limit; i++) {
      if (!slots[i].active) {
        return { slotIndex: i, recycled: false };
      }
    }

    // Pool is full: score all active slots and recycle the one with the lowest priority score
    let bestVictimIdx = 0;
    let lowestPriority = Infinity;

    for (let i = 0; i < limit; i++) {
      const s = slots[i];
      const dx = s.x - cameraX;
      const dy = s.y - cameraY;
      const dz = s.z - cameraZ;
      const dist = Math.hypot(dx, dy, dz);

      const ageRatio = s.ageMs / Math.max(1000, s.maxAgeMs);
      const caliberWeight =
        s.weaponId === 'awp'
          ? 1.35
          : s.weaponId === 'deagle' || s.weaponId === 'ak47'
            ? 1.18
            : 1.0;

      // Higher priority = keep; lower priority = recycle first
      const priority =
        (1.0 - ageRatio) * 55.0 -
        Math.min(45.0, dist * 0.75) +
        s.localOverlapCount * 4.0 +
        caliberWeight * 6.0;

      s.priorityScore = priority;
      if (priority < lowestPriority) {
        lowestPriority = priority;
        bestVictimIdx = i;
      }
    }

    this.recycledCount += 1;
    return { slotIndex: bestVictimIdx, recycled: true };
  }
}
