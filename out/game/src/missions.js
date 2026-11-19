// missions.js — the six-mission story chain: state machine, objective markers,
// checkpoint rings, enemy spawns and completion. The marker is a visible beacon
// in the 3D world and on the minimap.
import * as THREE from 'three';
import { MISSIONS } from './config.js';

export function createMissionManager(scene) {
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffc832, transparent: true, opacity: 0.85 });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 30, 16, 1, true), beaconMat);
  beacon.visible = false; scene.add(beacon);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc832, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.4, 24), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; ring.visible = false; scene.add(ring);
  let pulse = 0;
  return {
    index: 0, // next mission to play
    active: null, // {def, stage, checkpoint, enemiesLeft, timer}
    beacon, ring,
    get currentDef() { return MISSIONS[this.index] || null; },
    get done() { return this.index >= MISSIONS.length; },
    start() {
      const def = this.currentDef;
      if (!def) return null;
      this.active = { def, stage: 'go', checkpoint: 0, enemiesLeft: def.enemies || 0, timer: def.time || 0, pickedUp: false };
      this.setMarker(def.start);
      return this.active;
    },
    setMarker(pos) {
      beacon.position.set(pos[0], 15, pos[2]); beacon.visible = true;
      ring.position.set(pos[0], 0.1, pos[2]); ring.visible = true;
    },
    hideMarker() { beacon.visible = false; ring.visible = false; },
    markerPos() {
      const a = this.active; if (!a) return null;
      if (a.def.kind === 'checkpoints') return a.def.points[a.checkpoint];
      if (a.stage === 'return' && a.def.target) return a.def.target;
      if (a.stage === 'escape') return null;
      return a.def.target || a.def.start;
    },
    // Advance the active mission. Returns an event string or null.
    update(dt, ctx) {
      const a = this.active; if (!a) return null;
      pulse += dt;
      beacon.material.opacity = 0.55 + Math.sin(pulse * 4) * 0.25;
      beacon.rotation.y += dt;
      const pos = this.markerPos();
      if (pos) { beacon.position.set(pos[0], 15, pos[2]); ring.position.set(pos[0], 0.1, pos[2]); }
      if (a.def.time) { a.timer -= dt; if (a.timer <= 0) return 'failed-time'; }
      const px = ctx.playerX, pz = ctx.playerZ;
      const near = (p, r) => p && (p[0] - px) ** 2 + (p[2] - pz) ** 2 < r * r;
      if (a.def.kind === 'checkpoints') {
        const pt = a.def.points[a.checkpoint];
        if (near(pt, 6)) {
          a.checkpoint += 1;
          if (a.checkpoint >= a.def.points.length) return 'complete';
          return 'checkpoint';
        }
      } else if (a.def.kind === 'steal') {
        if (a.stage === 'go' && ctx.inCar) { a.stage = 'return'; this.setMarker(a.def.target); return 'stolen'; }
        if (a.stage === 'return' && near(a.def.target, 7)) return 'complete';
      } else if (a.def.kind === 'escape') {
        if (a.stage === 'go') { a.stage = 'escape'; return 'escape-start'; }
        if (ctx.wanted === 0) return 'complete';
      } else if (a.def.kind === 'shootout') {
        if (a.stage === 'go' && near(a.def.target, 10)) { a.stage = 'fight'; return 'fight-start'; }
        if (a.stage === 'fight' && a.enemiesLeft <= 0 && !a.pickedUp) { a.stage = 'grab'; this.setMarker(a.def.target); return 'stash'; }
        if (a.stage === 'grab' && near(a.def.target, 4)) return 'complete';
      } else if (a.def.kind === 'chase') {
        if (a.stage === 'go' && near(a.def.start, 6) && ctx.inCar) { a.stage = 'return'; this.setMarker(a.def.target); return 'picked-up'; }
        if (a.stage === 'return' && near(a.def.target, 7)) return 'complete';
      } else if (a.def.kind === 'finale') {
        if (a.stage === 'go' && near(a.def.start, 6)) { a.stage = 'fight'; return 'vault'; }
        if (a.stage === 'fight' && a.enemiesLeft <= 0 && !a.pickedUp) { a.stage = 'escape'; return 'grabbed'; }
        if (a.stage === 'escape' && ctx.wanted === 0) return 'complete';
      }
      return null;
    },
    complete() {
      const def = this.active.def;
      this.active = null; this.index += 1; this.hideMarker();
      return def;
    },
    fail() { this.active = null; this.hideMarker(); },
    objectiveText() {
      const a = this.active; if (!a) return this.done ? 'Story complete — Solmar Bay is yours.' : 'Press Q near the yellow marker to start a mission.';
      if (a.def.kind === 'checkpoints') return `Checkpoint ${a.checkpoint + 1}/${a.def.points.length} — ${Math.ceil(a.timer)}s left`;
      if (a.def.kind === 'escape') return 'Lose the cops — wanted level must hit 0';
      if (a.def.kind === 'shootout') return a.stage === 'fight' ? `Vultures left: ${a.enemiesLeft}` : a.stage === 'grab' ? 'Grab the stash!' : 'Go to the warehouse';
      if (a.def.kind === 'finale') return a.stage === 'escape' ? 'Lose the 4-star wanted level!' : a.stage === 'fight' ? `Guards left: ${a.enemiesLeft}` : 'Reach the casino vault';
      if (a.def.kind === 'steal') return a.stage === 'return' ? 'Deliver the car to the garage' : 'Steal a car (press E near one)';
      if (a.def.kind === 'chase') return a.stage === 'return' ? 'Drive Sal to the safehouse!' : 'Pick up Sal at the marina';
      return a.def.objective;
    },
  };
}
