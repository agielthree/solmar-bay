// city.js — builds Solmar Bay: roads grid, buildings, beach, palms, lamps.
// Exports the THREE group plus collision boxes and road helpers for AI + driving.
import * as THREE from 'three';
import { WORLD, COLORS } from './config.js';
import { createRandom } from './random.js';

function buildingTexture(rand, base, lit) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  const rows = 10, cols = 5;
  for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++) {
    const on = rand.next() < (lit ? 0.55 : 0.3);
    g.fillStyle = on ? '#ffd98a' : '#1d2733';
    g.fillRect(10 + col * 23, 12 + r * 24, 15, 14);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const FACADE_COLORS = ['#e8b48a', '#d9a06b', '#f2d5a0', '#a8c8d8', '#e8e0d0', '#c98a7a', '#b8d0a0', '#d8b8e8', '#f0c060', '#90b8c8'];

export function createCity(scene, seed) {
  const rand = createRandom(seed);
  const group = new THREE.Group();
  const colliders = []; // {x,z,hx,hz} axis-aligned boxes the cars/player collide with
  const buildings = [];
  const size = WORLD.size, half = size / 2;

  // Ground: grass base, big asphalt road slab, sand beach + sea to the east.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size + 160, size + 160),
    new THREE.MeshLambertMaterial({ color: COLORS.grass }),
  );
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, 0); group.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(60, size + 160), new THREE.MeshLambertMaterial({ color: COLORS.sand }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(half + 30, 0, 0); group.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(220, size + 160), new THREE.MeshLambertMaterial({ color: COLORS.sea }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(half + 170, -0.4, 0); group.add(sea);

  // Road centrelines: x and z at -156,-104,-52,0,52,104,156 (roads run both ways).
  const lines = [-156, -104, -52, 0, 52, 104, 156];
  const roadMat = new THREE.MeshLambertMaterial({ color: COLORS.asphalt });
  const walkMat = new THREE.MeshLambertMaterial({ color: COLORS.sidewalk });
  for (const v of lines) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(size, WORLD.roadWidth), roadMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.01, v); group.add(h);
    const vt = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, size), roadMat);
    vt.rotation.x = -Math.PI / 2; vt.position.set(v, 0.01, 0); group.add(vt);
    // Sidewalks bordering each road.
    const s1 = new THREE.Mesh(new THREE.PlaneGeometry(size, 3), walkMat);
    s1.rotation.x = -Math.PI / 2; s1.position.set(0, 0.02, v + WORLD.roadWidth / 2 + 1.5); group.add(s1);
    const s2 = new THREE.Mesh(new THREE.PlaneGeometry(3, size), walkMat);
    s2.rotation.x = -Math.PI / 2; s2.position.set(v + WORLD.roadWidth / 2 + 1.5, 0.02, 0); group.add(s2);
    // Dashed centre line.
    for (let d = -half + 6; d < half; d += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), new THREE.MeshBasicMaterial({ color: 0xf2e8c8 }));
      dash.rotation.x = -Math.PI / 2; dash.position.set(d, 0.03, v); group.add(dash);
    }
  }
  // Crosswalks at the centre junction.
  for (let i = 0; i < 6; i++) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.rotation.x = -Math.PI / 2; stripe.position.set(-8 + i * 3.2, 0.03, 8); group.add(stripe);
  }

  // Buildings fill the blocks between roads; skip the centre plaza and the beach strip.
  const blockCentres = [];
  for (const x of lines) for (const z of lines) blockCentres.push([x + WORLD.roadGap / 2, z + WORLD.roadGap / 2]);
  const geoBox = new THREE.BoxGeometry(1, 1, 1);
  for (const [bx, bz] of blockCentres) {
    if (Math.abs(bx) < 30 && Math.abs(bz) < 30) continue; // central plaza
    if (bx > half - 40) continue; // beach side stays open
    const n = rand.int(1, 2);
    for (let i = 0; i < n; i++) {
      const w = rand.range(12, 20), d = rand.range(12, 20), h = rand.range(9, 42);
      const ox = bx + (i === 0 ? -7 : 8) + rand.range(-3, 3);
      const oz = bz + (i === 0 ? -6 : 7) + rand.range(-3, 3);
      const facade = rand.pick(FACADE_COLORS);
      const mat = new THREE.MeshLambertMaterial({ map: buildingTexture(rand, facade, h > 24) });
      const b = new THREE.Mesh(geoBox, mat);
      b.scale.set(w, h, d); b.position.set(ox, h / 2, oz); group.add(b);
      // Rooftop box / AC unit for silhouette variety.
      const roof = new THREE.Mesh(geoBox, new THREE.MeshLambertMaterial({ color: 0x555c66 }));
      roof.scale.set(w * 0.3, 2, d * 0.3); roof.position.set(ox + w * 0.2, h + 1, oz); group.add(roof);
      colliders.push({ x: ox, z: oz, hx: w / 2 + 0.4, hz: d / 2 + 0.4 });
      buildings.push({ x: ox, z: oz, h });
    }
  }
  // Landmarks: casino tower, marina lighthouse, clinic, garage, warehouse, spray shop.
  function landmark(x, z, w, h, d, color, label) {
    const m = new THREE.Mesh(geoBox, new THREE.MeshLambertMaterial({ color }));
    m.scale.set(w, h, d); m.position.set(x, h / 2, z); group.add(m);
    colliders.push({ x, z, hx: w / 2 + 0.4, hz: d / 2 + 0.4 });
    return m;
  }
  landmark(26, -130, 34, 46, 24, 0xc8a24a, 'casino'); // Solmar Casino (north block)
  landmark(156, 150, 10, 26, 10, 0xf2f2f2, 'lighthouse'); // marina lighthouse
  landmark(-130, 26, 22, 14, 18, 0xe8e8e8, 'warehouse'); // warehouse row (west block)
  landmark(130, -130, 20, 12, 16, 0x7ab8e8, 'garage'); // garage (NE block)
  landmark(-130, 130, 18, 12, 14, 0xe86ba8, 'spray'); // pay-n-spray (SW block)
  landmark(26, 26, 26, 8, 26, 0xd8d8c8, 'plaza'); // central plaza pavilion (block centre)

  // Palm trees along the beach and boulevard.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  for (let i = 0; i < 46; i++) {
    const px = rand.next() < 0.5 ? half + 12 + rand.range(0, 30) : lines[rand.int(0, lines.length - 1)] + 9;
    const pz = rand.range(-half, half);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
    trunk.position.set(px, 3.5, pz); group.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3.4, 7), leafMat);
    crown.position.set(px, 8.2, pz); group.add(crown);
    if (px < half) colliders.push({ x: px, z: pz, hx: 0.7, hz: 0.7 });
  }
  // Street lamps along main roads.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const v of [-104, 0, 104]) for (let d = -150; d <= 150; d += 52) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6, 6), lampMat);
    pole.position.set(v + 7.5, 3, d); group.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampGlow);
    bulb.position.set(v + 7.5, 6.2, d); group.add(bulb);
  }
  // Sun + sky + fog.
  const sun = new THREE.DirectionalLight(COLORS.sun, 1.5);
  sun.position.set(120, 180, 60); scene.add(sun);
  scene.add(new THREE.AmbientLight(0xbfd8e8, 0.85));
  scene.background = new THREE.Color(COLORS.sky);
  scene.fog = new THREE.Fog(COLORS.sky, 220, 520);

  scene.add(group);
  return {
    group, colliders, buildings, roadLines: lines,
    // Snap a point to the nearest road centreline (for AI driving / spawning).
    nearestRoad(x, z) {
      let best = lines[0], bd = Infinity;
      for (const v of lines) { const d = Math.min(Math.abs(x - v), Math.abs(z - v)); if (d < bd) { bd = d; best = v; } }
      return { line: best, axis: Math.abs(x - best) < Math.abs(z - best) ? 'x' : 'z', dist: bd };
    },
    collides(x, z, r) {
      for (const c of colliders) {
        if (Math.abs(x - c.x) < c.hx + r && Math.abs(z - c.z) < c.hz + r) return c;
      }
      if (Math.abs(x) > half + 4 || Math.abs(z) > half + 4) return { x: 0, z: 0, hx: 0, hz: 0, edge: true };
      return null;
    },
  };
}
