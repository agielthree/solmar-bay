// pedestrians.js — sidewalk walkers with names, colours and simple flee behaviour.
import * as THREE from 'three';
import { PED_NAMES } from './config.js';
import { createRandom } from './random.js';
import { clamp } from './random.js';

const SKINS = [0xc8a080, 0x8a5a3a, 0xe8c8a8, 0x6a4a2a, 0xd8b090];
const SHIRTS = [0xe85d3d, 0x2f6fd0, 0x86c232, 0xe8c832, 0xe86ba8, 0xf2f2f2, 0x7a4ae8, 0x1f8a8a];

export function buildPedMesh(rand) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: rand.pick(SKINS) });
  const shirt = new THREE.MeshLambertMaterial({ color: rand.pick(SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: rand.pick([0x2b3a4a, 0x3a2b2b, 0x222222, 0x5a6a7a]) });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.36), shirt);
  torso.position.y = 1.05; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.68; g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.44), new THREE.MeshLambertMaterial({ color: rand.pick([0x141414, 0x5a3a1a, 0x888888, 0x2a1a0a]) }));
  hair.position.y = 1.92; g.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.28), pants);
  legL.position.set(-0.16, 0.35, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt);
  armL.position.set(-0.42, 1.05, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.42; g.add(armR);
  return { group: g, legL, legR, armL, armR };
}

export function createPedestrians(city, seed, count) {
  const rand = createRandom(seed);
  const peds = [];
  for (let i = 0; i < count; i++) {
    const line = rand.pick(city.roadLines);
    const axis = rand.next() < 0.5 ? 'x' : 'z';
    const along = rand.range(-190, 190);
    const side = rand.pick([-8.5, 8.5]);
    const x = axis === 'x' ? along : line + side;
    const z = axis === 'x' ? line + side : along;
    const { group, legL, legR, armL, armR } = buildPedMesh(rand);
    group.position.set(x, 0, z);
    peds.push({
      group, legL, legR, armL, armR, x, z, name: rand.pick(PED_NAMES),
      axis, dir: rand.pick([-1, 1]), speed: rand.range(1.2, 2.4),
      walkPhase: rand.range(0, 6), scared: 0, alive: true,
    });
  }
  return peds;
}
export function updatePedestrians(peds, dt, city, threats) {
  for (const p of peds) {
    if (!p.alive) continue;
    // Flee from gunfire / fast cars nearby.
    let fleeX = 0, fleeZ = 0;
    for (const t of threats || []) {
      const dx = p.x - t.x, dz = p.z - t.z, d2 = dx * dx + dz * dz;
      if (d2 < 400) { const d = Math.sqrt(d2) || 1; fleeX += (dx / d) * 4; fleeZ += (dz / d) * 4; p.scared = 2; }
    }
    if (p.scared > 0) {
      p.scared -= dt;
      p.x += fleeX * dt * 2; p.z += fleeZ * dt * 2;
    } else {
      const step = p.speed * p.dir * dt;
      if (p.axis === 'x') p.x += step; else p.z += step;
      const along = p.axis === 'x' ? p.x : p.z;
      if (along > 200 || along < -200) p.dir *= -1;
    }
    p.x = clamp(p.x, -205, 205); p.z = clamp(p.z, -205, 205);
    p.walkPhase += dt * (p.scared > 0 ? 14 : 7);
    const swing = Math.sin(p.walkPhase) * 0.5;
    p.legL.rotation.x = swing; p.legR.rotation.x = -swing;
    p.armL.rotation.x = -swing * 0.8; p.armR.rotation.x = swing * 0.8;
    p.group.position.set(p.x, 0, p.z);
    const heading = p.scared > 0 ? Math.atan2(fleeX, fleeZ) : p.axis === 'x' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
    p.group.rotation.y = heading;
  }
}
