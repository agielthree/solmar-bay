// vehicles.js — boxy original cars: factory, arcade driving, traffic AI, collisions.
import * as THREE from 'three';
import { CAR_CFG, CAR_PAINTS, WORLD } from './config.js';
import { createRandom } from './random.js';
import { clamp, angleLerp } from './random.js';

export function buildCarMesh(paint, isPolice) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0x1a1a1a : paint.body });
  const trimMat = new THREE.MeshLambertMaterial({ color: paint.trim });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fd4e8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.62; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.18, -0.2); g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 1.9), trimMat);
  roof.position.set(0, 1.5, -0.2); g.add(roof);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.38, wz); g.add(w); wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const s of [-0.7, 0.7]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    l.position.set(s, 0.72, 2.22); g.add(l);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar.position.set(0, 1.62, -0.2); g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.42), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar2.position.set(0.55, 1.62, -0.2); g.add(bar2);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    door.rotation.y = Math.PI / 2; door.position.set(1.01, 0.7, 0); g.add(door);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { group: g, wheels };
}

export function createCar(x, z, heading, paint, opts = {}) {
  const { group, wheels } = buildCarMesh(paint, !!opts.police);
  group.position.set(x, 0, z); group.rotation.y = heading;
  return {
    group, wheels, paint, police: !!opts.police, traffic: !!opts.traffic,
    x, z, heading, speed: 0, steer: 0, health: 100, driver: opts.driver || null,
    cruise: opts.cruise || 9, lane: opts.lane || 0, axis: opts.axis || 'z', dir: opts.dir || 1,
    stuck: 0,
  };
}

// Arcade driving for the player car. Returns {crashed} when it hit something hard.
export function drivePlayerCar(car, input, dt, city, cars) {
  const fwd = input.up ? 1 : input.down ? -0.55 : 0;
  const target = fwd > 0 ? CAR_CFG.maxSpeed * fwd : fwd < 0 ? -CAR_CFG.reverse : 0;
  const accel = fwd !== 0 ? CAR_CFG.accel : CAR_CFG.brake;
  car.speed += clamp(target - car.speed, -accel * dt, accel * dt);
  if (input.handbrake) car.speed *= Math.max(0, 1 - 3 * dt);
  const steerInput = input.left ? 1 : input.right ? -1 : 0;
  car.steer = angleLerp(car.steer, steerInput, Math.min(1, 8 * dt));
  const turnRate = car.steer * CAR_CFG.turn * clamp(Math.abs(car.speed) / 10, 0, 1) * Math.sign(car.speed || 1);
  car.heading += turnRate * dt;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  let crashed = false;
  const hit = city.collides(nx, nz, 1.6);
  if (hit) {
    if (Math.abs(car.speed) > 8) crashed = true;
    car.speed *= -0.25; // bounce off
    car.x += Math.sin(car.heading) * car.speed * dt * 0.2;
    car.z += Math.cos(car.heading) * car.speed * dt * 0.2;
  } else {
    car.x = nx; car.z = nz;
  }
  // Soft car-car collision: push apart and scrub speed.
  for (const other of cars) {
    if (other === car) continue;
    const dx = car.x - other.x, dz = car.z - other.z, d2 = dx * dx + dz * dz;
    if (d2 < 12 && d2 > 0.01) {
      const d = Math.sqrt(d2), push = (3.5 - d) / 2;
      car.x += (dx / d) * push; car.z += (dz / d) * push;
      other.x -= (dx / d) * push; other.z -= (dz / d) * push;
      if (Math.abs(car.speed) > 10) crashed = true;
      car.speed *= 0.55; other.speed *= 0.6;
    }
  }
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  car.wheels.forEach((w, i) => { w.rotation.x += car.speed * dt * 2; });
  return { crashed };
}

// Traffic AI: cars cruise along a road line, turn at junctions, avoid the player car.
export function createTraffic(city, seed, count) {
  const rand = createRandom(seed);
  const cars = [];
  for (let i = 0; i < count; i++) {
    const line = rand.pick(city.roadLines);
    const axis = rand.next() < 0.5 ? 'x' : 'z';
    const along = rand.range(-190, 190);
    const lane = rand.pick([-2.6, 2.6]);
    const x = axis === 'x' ? along : line + lane;
    const z = axis === 'x' ? line + lane : along;
    const dir = rand.pick([-1, 1]);
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = createCar(x, z, heading, rand.pick(CAR_PAINTS), { traffic: true, axis, dir, lane, cruise: rand.range(7, 12) });
    car.speed = car.cruise;
    cars.push(car);
  }
  return cars;
}
export function updateTraffic(cars, dt, city, playerCar) {
  for (const car of cars) {
    // Pick a new direction at a junction (every ~roadGap travelled, cheap check).
    const nearJunction = Math.abs(((car.axis === 'x' ? car.x : car.z) % WORLD.roadGap + WORLD.roadGap) % WORLD.roadGap) < 2;
    if (nearJunction && Math.random() < 0.02) {
      const turn = Math.random() < 0.5;
      if (turn) {
        car.axis = car.axis === 'x' ? 'z' : 'x';
        car.dir = Math.random() < 0.5 ? -1 : 1;
      } else car.dir *= 1;
    }
    // Slow down if the player car is right ahead.
    let slow = false;
    if (playerCar) {
      const dx = playerCar.x - car.x, dz = playerCar.z - car.z;
      const ahead = car.axis === 'x' ? dx * car.dir : dz * car.dir;
      const side = car.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
      if (ahead > 0 && ahead < 12 && side < 4) slow = true;
    }
    const target = slow ? 0 : car.cruise;
    car.speed += clamp(target - car.speed, -14 * dt, 8 * dt);
    const headingTarget = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    car.heading = angleLerp(car.heading, headingTarget, Math.min(1, 4 * dt));
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    if (!city.collides(nx, nz, 1.6) && Math.abs(nx) < 205 && Math.abs(nz) < 205) { car.x = nx; car.z = nz; }
    else { car.dir *= -1; car.heading += Math.PI; }
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    car.wheels.forEach((w) => { w.rotation.x += car.speed * dt * 2; });
  }
}
