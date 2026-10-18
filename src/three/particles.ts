import * as THREE from 'three';

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
  age: number;
  maxAge: number;
  r: number;
  g: number;
  b: number;
}

/**
 * Pre-allocated Zero-GC Particle System using a single InstancedMesh.
 * Supports hit sparks, guard clangs, parry rings, and ambient dust motes.
 */
export class PooledParticleSystem {
  public readonly mesh: THREE.InstancedMesh;
  private readonly capacity: number;
  private readonly slots: ParticleSlot[];
  private cursor = 0;
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.MeshBasicMaterial;

  constructor(capacity = 160) {
    this.capacity = capacity;
    this.geometry = new THREE.OctahedronGeometry(0.08, 0);
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(capacity * 3),
      3
    );

    this.slots = Array.from({ length: capacity }, () => ({
      active: false,
      x: 0,
      y: -100,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      scale: 0,
      age: 0,
      maxAge: 1,
      r: 1,
      g: 1,
      b: 1,
    }));

    // Initialize all instances off-screen
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < capacity; i++) {
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.color.setRGB(1, 1, 1));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  public spawnBurst(
    x: number,
    y: number,
    z: number,
    count: number,
    colorHex: number,
    speed = 5.5,
    scale = 1.0,
    lifetime = 0.42
  ): void {
    this.color.setHex(colorHex);
    const r = this.color.r;
    const g = this.color.g;
    const b = this.color.b;

    for (let i = 0; i < count; i++) {
      const slot = this.slots[this.cursor];
      this.cursor = (this.cursor + 1) % this.capacity;

      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.25) * Math.PI;
      const spd = speed * (0.45 + Math.random() * 0.75);

      slot.active = true;
      slot.x = x + (Math.random() - 0.5) * 0.2;
      slot.y = y + (Math.random() - 0.5) * 0.2;
      slot.z = z + (Math.random() - 0.5) * 0.2;
      slot.vx = Math.cos(theta) * Math.cos(phi) * spd;
      slot.vy = Math.abs(Math.sin(phi)) * spd + 1.5;
      slot.vz = Math.sin(theta) * Math.cos(phi) * spd;
      slot.scale = scale * (0.7 + Math.random() * 0.6);
      slot.age = 0;
      slot.maxAge = lifetime * (0.75 + Math.random() * 0.4);
      slot.r = r;
      slot.g = g;
      slot.b = b;
    }
  }

  public update(dt: number): void {
    let anyUpdated = false;

    for (let i = 0; i < this.capacity; i++) {
      const s = this.slots[i];
      if (!s.active) continue;

      anyUpdated = true;
      s.age += dt;
      if (s.age >= s.maxAge) {
        s.active = false;
        this.dummy.position.set(0, -100, 0);
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }

      s.vy -= 14.0 * dt; // Gravity
      s.x += s.vx * dt;
      s.y = Math.max(0.04, s.y + s.vy * dt);
      s.z += s.vz * dt;

      const lifeRatio = 1 - s.age / s.maxAge;
      this.dummy.position.set(s.x, s.y, s.z);
      this.dummy.rotation.set(s.age * 8, s.age * 11, 0);
      this.dummy.scale.setScalar(s.scale * lifeRatio);
      this.dummy.updateMatrix();

      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.color.setRGB(s.r, s.g, s.b);
      this.mesh.setColorAt(i, this.color);
    }

    if (anyUpdated) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) {
        this.mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
