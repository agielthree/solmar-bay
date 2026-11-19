// combat.js — on-foot shooting: hitscan raycast, muzzle flash, enemy AI that
// shoots back, health packs and ammo pickups scattered around the city.
import * as THREE from 'three';
import { createRandom } from './random.js';

export function createCombat(scene, seed) {
  const rand = createRandom(seed);
  const raycaster = new THREE.Raycaster();
  const enemies = [];
  const pickups = [];
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
  const tracers = [];
  function spawnEnemy(x, z, hp) {
    const g = new THREE.Group();
    const red = new THREE.MeshLambertMaterial({ color: 0x8a1a1a });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.8, 0.4), red);
    torso.position.y = 1.05; g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), new THREE.MeshLambertMaterial({ color: 0xc8a080 }));
    head.position.y = 1.7; g.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.7), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.3, 1.1, 0.4); g.add(gun);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.28), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    legL.position.set(-0.16, 0.35, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
    g.position.set(x, 0, z); scene.add(g);
    const e = { group: g, legL, legR, x, z, hp: hp || 60, alive: true, shootTimer: rand.range(1, 2.5), phase: 0 };
    enemies.push(e); return e;
  }
  function spawnPickup(x, z, kind) {
    const color = kind === 'health' ? 0x2ee86b : 0xffc832;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.4 }));
    mesh.position.set(x, 0.6, z); scene.add(mesh);
    const p = { mesh, x, z, kind, taken: false, phase: rand.range(0, 6) };
    pickups.push(p); return p;
  }
  // Seed a few pickups around the city.
  for (let i = 0; i < 6; i++) spawnPickup(rand.range(-180, 180), rand.range(-180, 180), i % 2 ? 'health' : 'ammo');
  spawnPickup(20, 20, 'health'); spawnPickup(-20, -20, 'ammo');
  return {
    enemies, pickups, spawnEnemy, spawnPickup,
    clearEnemies() { for (const e of enemies) { scene.remove(e.group); e.alive = false; } enemies.length = 0; },
    // Fire from the camera. Returns {hitEnemy, hitPoint} or null.
    shoot(origin, dir, targets) {
      raycaster.set(origin, dir); raycaster.far = 90;
      const meshes = [];
      for (const e of enemies) if (e.alive) meshes.push(e.group);
      for (const t of targets || []) meshes.push(t);
      const hits = raycaster.intersectObjects(meshes, true);
      const end = hits.length ? hits[0].point.clone() : origin.clone().add(dir.clone().multiplyScalar(90));
      const tracer = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, origin.distanceTo(end)), tracerMat);
      tracer.position.copy(origin.clone().add(end).multiplyScalar(0.5));
      tracer.lookAt(end); scene.add(tracer); tracers.push({ mesh: tracer, life: 0.08 });
      if (!hits.length) return { hit: false, point: end };
      let obj = hits[0].object, enemy = null;
      while (obj) { for (const e of enemies) if (e.group === obj || e.group.children.includes(obj)) enemy = e; obj = obj.parent; if (enemy) break; }
      // Simpler: find enemy whose group contains the hit object.
      if (!enemy) for (const e of enemies) { let o = hits[0].object; while (o) { if (o === e.group) { enemy = e; break; } o = o.parent; } if (enemy) break; }
      if (enemy) { enemy.hp -= 34; if (enemy.hp <= 0) { enemy.alive = false; scene.remove(enemy.group); } }
      return { hit: true, enemy, point: hits[0].point };
    },
    update(dt, playerPos, onEnemyShoot) {
      for (const t of tracers) { t.life -= dt; if (t.life <= 0) { scene.remove(t.mesh); } }
      for (let i = tracers.length - 1; i >= 0; i--) if (tracers[i].life <= 0) tracers.splice(i, 1);
      for (const e of enemies) {
        if (!e.alive) continue;
        const dx = playerPos.x - e.x, dz = playerPos.z - e.z;
        const d = Math.sqrt(dx * dx + dz * dz) || 1;
        e.group.rotation.y = Math.atan2(dx, dz);
        if (d > 18) { e.x += (dx / d) * 3.4 * dt; e.z += (dz / d) * 3.4 * dt; }
        else if (d < 6) { e.x -= (dx / d) * 2 * dt; e.z -= (dz / d) * 2 * dt; }
        e.phase += dt * 8;
        e.legL.rotation.x = Math.sin(e.phase) * 0.5; e.legR.rotation.x = -Math.sin(e.phase) * 0.5;
        e.group.position.set(e.x, 0, e.z);
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && d < 45) {
          e.shootTimer = 1.4 + Math.random() * 1.2;
          if (onEnemyShoot) onEnemyShoot(e, d);
        }
      }
      for (const p of pickups) {
        if (p.taken) continue;
        p.phase += dt * 2;
        p.mesh.rotation.y += dt * 1.5;
        p.mesh.position.y = 0.6 + Math.sin(p.phase) * 0.15;
        const dx = playerPos.x - p.x, dz = playerPos.z - p.z;
        if (dx * dx + dz * dz < 4) { p.taken = true; p.mesh.visible = false; if (p.onTake) p.onTake(p); }
      }
    },
  };
}
