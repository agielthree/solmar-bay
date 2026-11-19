// player.js — Jace Rivera on foot: WASD movement relative to camera, run, and
// entering / exiting cars (stealing a parked or traffic car, driver flees).
import * as THREE from 'three';
import { PLAYER_CFG } from './config.js';
import { clamp, angleLerp } from './random.js';

export function buildPlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2f6fd0 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc8a080 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.8, 0.4), jacket);
  torso.position.y = 1.05; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), skin);
  head.position.y = 1.72; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.48), new THREE.MeshLambertMaterial({ color: 0xe85d3d }));
  cap.position.y = 1.96; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.28), new THREE.MeshLambertMaterial({ color: 0x2b3a4a }));
  legL.position.set(-0.16, 0.35, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), jacket);
  armL.position.set(-0.42, 1.05, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.42; g.add(armR);
  // Pistol in hand (visible when armed).
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.42, 0.85, 0.3); gun.name = 'gun'; g.add(gun);
  return { group: g, legL, legR, armL, armR };
}

export function createPlayer(scene, x, z) {
  const { group, legL, legR, armL, armR } = buildPlayerMesh();
  group.position.set(x, 0, z); scene.add(group);
  return {
    group, legL, legR, armL, armR,
    x, z, heading: 0, health: PLAYER_CFG.health, armor: 0,
    camYaw: Math.PI, camPitch: 0.32, walkPhase: 0, moving: false,
    inCar: null, ammo: 60,
    update(dt, input, camYaw, city, cars) {
      if (this.inCar) return;
      const dir = input.direction();
      const speed = dir.run ? PLAYER_CFG.runSpeed : PLAYER_CFG.walkSpeed;
      let mx = 0, mz = 0;
      if (dir.up) { mx += Math.sin(camYaw); mz += Math.cos(camYaw); }
      if (dir.down) { mx -= Math.sin(camYaw); mz -= Math.cos(camYaw); }
      if (dir.left) { mx += Math.sin(camYaw - Math.PI / 2); mz += Math.cos(camYaw - Math.PI / 2); }
      if (dir.right) { mx += Math.sin(camYaw + Math.PI / 2); mz += Math.cos(camYaw + Math.PI / 2); }
      const len = Math.hypot(mx, mz);
      this.moving = len > 0;
      if (len > 0) {
        mx /= len; mz /= len;
        const nx = this.x + mx * speed * dt, nz = this.z + mz * speed * dt;
        if (!city.collides(nx, nz, PLAYER_CFG.radius)) { this.x = nx; this.z = nz; }
        else if (!city.collides(nx, this.z, PLAYER_CFG.radius)) this.x = nx;
        else if (!city.collides(this.x, nz, PLAYER_CFG.radius)) this.z = nz;
        this.heading = angleLerp(this.heading, Math.atan2(mx, mz), Math.min(1, 12 * dt));
      }
      this.walkPhase += dt * (this.moving ? (dir.run ? 13 : 9) : 0);
      const swing = this.moving ? Math.sin(this.walkPhase) * 0.55 : 0;
      legL.rotation.x = swing; legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.7; armR.rotation.x = swing * 0.7;
      group.position.set(this.x, 0, this.z);
      group.rotation.y = this.heading;
    },
    nearestCar(cars, maxDist) {
      let best = null, bd = maxDist * maxDist;
      for (const c of cars) {
        const d2 = (c.x - this.x) ** 2 + (c.z - this.z) ** 2;
        if (d2 < bd) { bd = d2; best = c; }
      }
      return best;
    },
  };
}

// Third-person camera: follows behind the player or the car, orbit with mouse drag.
export function createCameraRig(camera) {
  return {
    yaw: Math.PI, pitch: 0.32, dist: 11,
    update(dt, target, inCar, mouse) {
      this.yaw -= mouse.dx * 0.005;
      this.pitch = clamp(this.pitch + mouse.dy * 0.003, 0.08, 1.1);
      const dist = inCar ? 15 : 11;
      this.dist += (dist - this.dist) * Math.min(1, 5 * dt);
      const tx = target.x, tz = target.z;
      const cx = tx - Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist;
      const cz = tz - Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist;
      const cy = (inCar ? 2.2 : 2.0) + Math.sin(this.pitch) * this.dist;
      camera.position.set(cx, cy, cz);
      camera.lookAt(tx, inCar ? 1.6 : 1.4, tz);
      return this.yaw;
    },
  };
}
export { THREE };
