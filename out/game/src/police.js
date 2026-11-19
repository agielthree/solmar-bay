// police.js — wanted level, police cars + foot cops, chase, arrest and escape.
import * as THREE from 'three';
import { WANTED_MAX, CAR_PAINTS } from './config.js';
import { createCar } from './vehicles.js';
import { clamp } from './random.js';

export function createWanted() {
  return {
    level: 0, heat: 0, // heat 0..100; level = floor(heat/20) capped
    hiddenTimer: 0, sirenTimer: 0,
    add(amount) { this.heat = clamp(this.heat + amount, 0, 100); this.level = Math.min(WANTED_MAX, Math.floor(this.heat / 20)); },
    setLevel(n) { this.level = clamp(n, 0, WANTED_MAX); this.heat = this.level * 20 + 5; },
    decay(dt, visible) {
      if (this.level === 0) return;
      if (!visible) { this.hiddenTimer += dt; if (this.hiddenTimer > 4) { this.heat -= dt * 6; this.level = Math.max(0, Math.floor(this.heat / 20)); } }
      else this.hiddenTimer = 0;
    },
  };
}

// Police pursuit cars: spawn at a distance, chase the player, ram to slow them.
export function createPolice(scene) {
  const cars = [];
  const cops = []; // foot cops {group,x,z,heading}
  function spawnCar(x, z) {
    const car = createCar(x, z, 0, CAR_PAINTS[0], { police: true });
    car.speed = 0; scene.add(car.group); cars.push(car); return car;
  }
  function spawnCop(x, z) {
    const g = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.8, 0.4), navy);
    torso.position.y = 1.05; g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), new THREE.MeshLambertMaterial({ color: 0xc8a080 }));
    head.position.y = 1.7; g.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.48), navy);
    cap.position.y = 1.94; g.add(cap);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.28), navy);
    legL.position.set(-0.16, 0.35, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
    g.position.set(x, 0, z); scene.add(g);
    const cop = { group: g, legL, legR, x, z, heading: 0, phase: 0 };
    cops.push(cop); return cop;
  }
  return {
    cars, cops, spawnCar, spawnCop,
    // Keep the right number of pursuit cars for the wanted level; chase the target.
    update(dt, target, city, onRam) {
      const want = target.wanted ? target.wanted.level : 0;
      const wantCars = want === 0 ? 0 : want === 1 ? 1 : want === 2 ? 2 : want === 3 ? 3 : 4;
      while (cars.length < wantCars) {
        const a = Math.random() * Math.PI * 2;
        spawnCar(clamp(target.x + Math.sin(a) * 55, -200, 200), clamp(target.z + Math.cos(a) * 55, -200, 200));
      }
      while (cars.length > wantCars) { const c = cars.pop(); scene.remove(c.group); }
      for (const car of cars) {
        const dx = target.x - car.x, dz = target.z - car.z;
        const d = Math.sqrt(dx * dx + dz * dz) || 1;
        const wantHeading = Math.atan2(dx, dz);
        let dh = wantHeading - car.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        car.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
        const speedTarget = d > 60 ? 34 : d > 15 ? 30 : 20;
        car.speed += clamp(speedTarget - car.speed, -26 * dt, 18 * dt);
        const nx = car.x + Math.sin(car.heading) * car.speed * dt;
        const nz = car.z + Math.cos(car.heading) * car.speed * dt;
        if (!city.collides(nx, nz, 1.6)) { car.x = nx; car.z = nz; }
        else { car.heading += Math.PI * 0.5; car.speed *= 0.5; }
        car.group.position.set(car.x, 0, car.z);
        car.group.rotation.y = car.heading;
        car.wheels.forEach((w) => { w.rotation.x += car.speed * dt * 2; });
        if (d < 4.5 && onRam) onRam(car, d);
      }
      // Foot cops chase on foot when the player is on foot and wanted >= 2.
      const wantCops = target.inCar ? 0 : (want >= 2 ? Math.min(3, want) : 0);
      while (cops.length < wantCops) spawnCop(target.x + (Math.random() - 0.5) * 30, target.z + (Math.random() - 0.5) * 30);
      while (cops.length > wantCops) { const c = cops.pop(); scene.remove(c.group); }
      for (const cop of cops) {
        const dx = target.x - cop.x, dz = target.z - cop.z;
        const d = Math.sqrt(dx * dx + dz * dz) || 1;
        cop.heading = Math.atan2(dx, dz);
        const sp = 6.5;
        cop.x += Math.sin(cop.heading) * sp * dt; cop.z += Math.cos(cop.heading) * sp * dt;
        cop.phase += dt * 10;
        cop.legL.rotation.x = Math.sin(cop.phase) * 0.6; cop.legR.rotation.x = -Math.sin(cop.phase) * 0.6;
        cop.group.position.set(cop.x, 0, cop.z); cop.group.rotation.y = cop.heading;
        if (d < 1.6 && onRam) onRam(cop, d);
      }
    },
  };
}
