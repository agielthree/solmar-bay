// main.js — SOLMAR BAY boot + game loop. Screens: title, play, pause, busted,
// game-over, complete. Wires city, traffic, pedestrians, police, missions,
// combat, audio, HUD, minimap and save/load together.
// ?shot=city|chase|mission|foot&seed=N stages a screenshot scene instead of
// the title screen and sets window.__shotReady when painted.
import * as THREE from 'three';
import { SAVE_KEY, MISSIONS, STORY_INTRO, ACTIVITIES, CAR_PAINTS } from './config.js';
import { createRandom, clamp } from './random.js';
import { createAudio } from './audio.js';
import { createCity } from './city.js';
import { createCar, drivePlayerCar, createTraffic, updateTraffic } from './vehicles.js';
import { createPedestrians, updatePedestrians } from './pedestrians.js';
import { createWanted, createPolice } from './police.js';
import { createMissionManager } from './missions.js';
import { createCombat } from './combat.js';
import { createPlayer, createCameraRig } from './player.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_MISSION, ACTION_ENTER, ACTION_MUTE } from './input.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason)));

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
window.addEventListener('resize', resize);

const city = createCity(scene, seed);
const rand = createRandom(seed);
const audio = createAudio();
const hud = createHud();
const input = createInput(canvas);
const wanted = createWanted();
const police = createPolice(scene);
const missions = createMissionManager(scene);
const combat = createCombat(scene, seed + 5);
const traffic = createTraffic(city, seed + 11, 12);
for (const c of traffic) scene.add(c.group);
const peds = createPedestrians(city, seed + 23, 16);
for (const p of peds) scene.add(p.group);
// A few parked cars the player can steal right away.
const parked = [];
for (const [x, z, h] of [[24, 40, 0], [-30, 60, Math.PI / 2], [60, -24, 0], [-60, -60, Math.PI], [40, 104, Math.PI / 2]]) {
  const car = createCar(x, z, h, rand.pick(CAR_PAINTS), {});
  scene.add(car.group); parked.push(car);
}
const allCars = () => [...traffic, ...parked, ...police.cars];
const player = createPlayer(scene, 0, 30);
const camRig = createCameraRig(camera);
resize();

const state = {
  screen: 'title', cash: 250, rep: 0, best: 0, health: 100, armor: 0,
  time: 0, clockMin: 9 * 60 + 12, bustedTimer: 0, sirenTimer: 0, shootCd: 0,
  hint: 'WASD move • E enter car • Q mission • Click shoot • M mute',
  carName: '', missionTitle: 'Free roam', missionText: STORY_INTRO,
};
function readSave() {
  try { return JSON.parse(window.localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
}
function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash, rep: state.rep, missionIndex: missions.index,
      px: player.x, pz: player.z, best: state.best,
    }));
  } catch { /* storage off: session-only */ }
}
const save = readSave();
if (save) {
  state.cash = save.cash || 0; state.rep = save.rep || 0; state.best = save.best || 0;
  missions.index = Math.min(save.missionIndex || 0, MISSIONS.length);
  player.x = save.px ?? 0; player.z = save.pz ?? 30;
  player.group.position.set(player.x, 0, player.z);
}
function loadSave() { /* Continue uses the save already applied at boot. */ }

function setScreen(name) {
  state.screen = name;
  hud.setScreen(name === 'title' ? 'title' : name === 'pause' ? 'pause' : name === 'busted' ? 'busted' : name === 'over' ? 'over' : name === 'complete' ? 'complete' : 'play');
  if (name === 'title') hud.setTitleStats(state.cash, missions.index, state.best);
}
function missionTitle() {
  if (missions.active) return missions.active.def.title;
  if (missions.done) return 'Solmar Bay — Complete';
  return 'Next: ' + (missions.currentDef ? missions.currentDef.title : '—');
}
function startMission() {
  const def = missions.currentDef;
  if (!def || missions.active) return;
  const d2 = (def.start[0] - player.x) ** 2 + (def.start[2] - player.z) ** 2;
  if (d2 > 14 * 14) { hud.showFeed('Get to the yellow marker to start: ' + def.title); return; }
  const a = missions.start();
  audio.mission(); audio.start();
  if (def.wanted) wanted.setLevel(def.wanted);
  hud.showFeed(def.title + ' — ' + def.briefing, 6000);
  state.missionText = def.objective;
}
function missionEvent(ev) {
  const a = missions.active; if (!a) return;
  const def = a.def;
  if (ev === 'checkpoint') { audio.pickup(); hud.showFeed('Checkpoint! ' + (a.checkpoint) + '/' + def.points.length); }
  if (ev === 'stolen') { wanted.add(20); audio.wanted(); hud.showFeed('Car stolen! The cops noticed. Deliver it to the garage.'); }
  if (ev === 'escape-start') { hud.showFeed('Lose the cops! Break line of sight.', 5000); }
  if (ev === 'fight-start') {
    hud.showFeed('Vultures! Clear the warehouse.', 5000);
    for (let i = 0; i < def.enemies; i++) combat.spawnEnemy(def.target[0] + rand.range(-12, 12), def.target[2] + rand.range(-12, 12));
    audio.wanted();
  }
  if (ev === 'stash') { hud.showFeed('Stash exposed — grab it!'); }
  if (ev === 'picked-up') { hud.showFeed('Sal is in! Get to the safehouse — fast.'); }
  if (ev === 'vault') {
    hud.showFeed('Vault crew! Fight through them, grab the cash.', 5000);
    for (let i = 0; i < def.enemies; i++) combat.spawnEnemy(def.start[0] + rand.range(-10, 10), def.start[2] + rand.range(-10, 10));
  }
  if (ev === 'grabbed') { state.cash += 800; wanted.setLevel(4); hud.showFeed('Cash grabbed! Now lose the 4-star heat!'); audio.cash(); }
  if (ev === 'complete') {
    const done = missions.complete();
    state.cash += done.reward; state.rep += 10;
    state.best = Math.max(state.best, state.cash);
    audio.cash(); audio.mission();
    hud.showFeed(`Mission complete: ${done.title}  +$${done.reward}`, 5000);
    writeSave();
    if (missions.done) { setScreen('complete'); hud.setComplete(`You finished all six missions and took Solmar Bay. Final cash $${state.cash.toLocaleString()}.`); }
  }
  if (ev === 'failed-time') {
    missions.fail(); audio.fail();
    hud.showFeed('Mission failed — out of time. Press Q at the marker to retry.', 5000);
  }
}
function enterCar() {
  if (player.inCar) {
    const car = player.inCar; player.inCar = null;
    player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 3;
    player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 3;
    player.group.visible = true;
    player.group.position.set(player.x, 0, player.z);
    car.speed = 0;
    return;
  }
  const car = player.nearestCar(allCars(), 5);
  if (!car || car.police) { hud.showFeed(car && car.police ? 'That is a police car!' : 'No car close enough.'); return; }
  const stolen = !parked.includes(car);
  if (stolen) {
    // Traffic car: driver flees on foot, stealing raises heat.
    wanted.add(20); audio.wanted();
    hud.showFeed('Car stolen! Wanted level up.');
    const idx = traffic.indexOf(car);
    if (idx >= 0) traffic.splice(idx, 1);
  } else {
    hud.showFeed('You took the ' + car.paint.name + '.');
    const idx = parked.indexOf(car);
    if (idx >= 0) parked.splice(idx, 1);
  }
  player.inCar = car; player.group.visible = false;
  state.carName = car.paint.name + (car.police ? ' (Police)' : '');
  audio.beep();
}
function respawn(kind) {
  player.health = 100; player.armor = 0; wanted.setLevel(0);
  combat.clearEnemies();
  if (player.inCar) { scene.remove(player.inCar.group); player.inCar = null; }
  player.group.visible = true;
  player.x = 0; player.z = 20; player.group.position.set(0, 0, 20);
  const lost = Math.min(state.cash, 150);
  state.cash -= lost;
  hud.setOver(kind === 'busted' ? 'BUSTED!' : 'WASTED!', kind === 'busted'
    ? `The Bay Police caught you. You lost $${lost}. The clinic patched you up — back on the streets.`
    : `You went down in Solmar Bay. You lost $${lost}. The clinic patched you up.`);
  setScreen('busted');
  audio.busted();
  writeSave();
}

// ---- per-frame update -------------------------------------------------------
let last = performance.now();
let shotFrames = 0;
function step(dt) {
  state.time += dt;
  state.clockMin = (state.clockMin + dt * 0.6) % (24 * 60);
  const hh = String(Math.floor(state.clockMin / 60)).padStart(2, '0');
  const mm = String(Math.floor(state.clockMin % 60)).padStart(2, '0');
  const dir = input.direction();
  const mouse = input.takeMouse();
  const actions = input.takeActions();
  if (actions & ACTION_MUTE) { const m = audio.toggleMute(); hud.showFeed(m ? 'Sound muted (M to unmute)' : 'Sound on'); }
  if (state.screen === 'play') {
    if (actions & ACTION_PAUSE) { setScreen('pause'); return; }
    if (actions & ACTION_MISSION) startMission();
    if (actions & ACTION_ENTER) {
      // Pay-n-spray / ammo shop first when close, else enter/exit car.
      const nearSpray = (ACTIVITIES[0].pos[0] - player.x) ** 2 + (ACTIVITIES[0].pos[2] - player.z) ** 2 < 100;
      const nearShop = (ACTIVITIES[2].pos[0] - player.x) ** 2 + (ACTIVITIES[2].pos[2] - player.z) ** 2 < 100;
      if (player.inCar && nearSpray && wanted.level > 0 && state.cash >= 200) {
        state.cash -= 200; wanted.setLevel(0); audio.cash();
        hud.showFeed('Repainted at Pay-N-Spray. Wanted cleared! -$200');
      } else if (!player.inCar && nearShop && state.cash >= 50) {
        state.cash -= 50; player.ammo += 60; audio.pickup();
        hud.showFeed('Ammo restocked at Ammo-N-Go. +60 rounds, -$50');
      } else enterCar();
    }
    if (actions & ACTION_CONFIRM) audio.start();
    // Player / car movement.
    if (player.inCar) {
      const res = drivePlayerCar(player.inCar, dir, dt, city, allCars());
      if (res.crashed) { audio.crash(); player.health = Math.max(0, player.health - 4); if (Math.random() < 0.3) wanted.add(5); }
      audio.engine(Math.abs(player.inCar.speed) / 38, true);
    } else {
      player.update(dt, input, camRig.yaw, city, allCars());
      audio.engine(0, false);
    }
    // Shooting (on foot only).
    if (!player.inCar && input.shooting && player.ammo > 0 && state.shootCd <= 0) {
      player.ammo -= 1; state.shootCd = 0.22; audio.gunshot();
      const origin = camera.position.clone();
      const d = new THREE.Vector3(); camera.getWorldDirection(d);
      const res = combat.shoot(origin, d, []);
      if (res.hit && res.enemy) {
        audio.hit();
        if (!res.enemy.alive) {
          state.cash += 25; state.rep += 1;
          hud.showFeed('Target down! +$25');
          if (missions.active) missions.active.enemiesLeft -= 1;
        }
        wanted.add(4);
      }
      for (const p of peds) { const d2 = (p.x - player.x) ** 2 + (p.z - player.z) ** 2; if (d2 < 900) p.scared = 2; }
    }
    state.shootCd = Math.max(0, (state.shootCd || 0) - dt);
    // World life.
    updateTraffic(traffic, dt, city, player.inCar);
    updatePedestrians(peds, dt, city, player.inCar ? [player.inCar] : [player]);
    // Wanted: police chase; busted if a cop touches the player on foot.
    const policeNear = police.cars.some((c) => (c.x - player.x) ** 2 + (c.z - player.z) ** 2 < 900);
    wanted.decay(dt, policeNear || player.inCar);
    police.update(dt, { x: player.x, z: player.z, wanted, inCar: !!player.inCar }, city, (unit) => {
      if (!player.inCar && wanted.level >= 2) {
        state.bustedTimer += dt;
        if (state.bustedTimer > 1.2) { state.bustedTimer = 0; respawn('busted'); }
      } else if (player.inCar) {
        player.inCar.speed *= 0.92;
        if (Math.random() < dt * 0.2) { player.health = Math.max(0, player.health - 2); }
      }
    });
    if (wanted.level > 0) {
      state.sirenTimer -= dt;
      if (state.sirenTimer <= 0) { state.sirenTimer = 0.9; audio.sirenBlip(Math.random() < 0.5); }
    }
    // Missions.
    const ev = missions.update(dt, { playerX: player.x, playerZ: player.z, inCar: !!player.inCar, wanted: wanted.level });
    if (ev) missionEvent(ev);
    // Idle mission marker: show where the next mission starts.
    if (!missions.active && !missions.done) missions.setMarker(missions.currentDef.start);
    // Combat enemies shoot back.
    combat.update(dt, { x: player.x, z: player.z }, (e, d) => {
      audio.gunshot();
      if (Math.random() < 0.45) {
        const dmg = 6 + Math.random() * 6;
        if (state.armor > 0) state.armor = Math.max(0, state.armor - dmg); else player.health -= dmg;
        hud.showFeed('You are taking fire!');
      }
    });
    // Pickups.
    for (const p of combat.pickups) {
      if (!p.taken) p.onTake = (pk) => {
        if (pk.kind === 'health') { player.health = Math.min(100, player.health + 40); hud.showFeed('Health +40'); }
        else { player.ammo += 40; hud.showFeed('Ammo +40'); }
        audio.pickup();
      };
    }
    if (player.health <= 0) respawn('wasted');
    // Hints (frozen in ?shot= mode so the staged text stays on screen).
    if (!shot) {
      const nearSpray = (ACTIVITIES[0].pos[0] - player.x) ** 2 + (ACTIVITIES[0].pos[2] - player.z) ** 2 < 100;
      state.hint = player.inCar
        ? (nearSpray && wanted.level > 0 ? 'E — Pay-N-Spray: clear wanted ($200)' : 'W/S drive • A/D steer • Space handbrake • E exit • Q mission')
        : (missions.active ? 'Click shoot • E enter car • Q mission • Esc pause' : 'Walk to the yellow marker, press Q to start a mission • E enter a car');
      state.missionTitle = missionTitle();
      state.missionText = missions.active ? missions.objectiveText() : (missions.done ? 'Story complete — Solmar Bay is yours. Free roam!' : MISSIONS[missions.index].briefing);
    }
  } else if (state.screen === 'title' || state.screen === 'over') {
    if (actions & ACTION_CONFIRM) { audio.start(); setScreen('play'); writeSave(); }
    updateTraffic(traffic, dt * 0.5, city, null);
    updatePedestrians(peds, dt * 0.5, city, []);
  } else if (state.screen === 'pause') {
    if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) { setScreen('play'); writeSave(); }
  } else if (state.screen === 'busted') {
    if (actions & ACTION_CONFIRM) setScreen('play');
  }
  // Camera + HUD always.
  const target = player.inCar || player;
  const yaw = camRig.update(dt, target, !!player.inCar, state.screen === 'play' ? mouse : { dx: 0, dy: 0 });
  if (!player.inCar) player.camYaw = yaw;
  hud.update({
    cash: state.cash, health: Math.round(player.health), armor: Math.round(state.armor),
    ammo: player.ammo, wanted: wanted.level, missionText: state.missionText,
    missionTitle: state.missionTitle, speed: player.inCar ? player.inCar.speed : 0,
    inCar: !!player.inCar, carName: state.carName, hint: state.hint,
    clock: `${hh}:${mm}`, rep: state.rep,
    missionPos: missions.active ? missions.markerPos() : (!missions.done && !missions.active ? missions.currentDef.start : null),
    px: player.x, pz: player.z, heading: player.inCar ? player.inCar.heading : player.heading,
    policeCars: police.cars, traffic, time: state.time,
  });
  hud.drawMinimap({
    px: player.x, pz: player.z, heading: player.inCar ? player.inCar.heading : player.heading,
    missionPos: missions.active ? missions.markerPos() : (!missions.done && !missions.active ? missions.currentDef.start : null),
    policeCars: police.cars, traffic, time: state.time,
  });
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (shot) {
    if (shotFrames < 2) { step(1 / 60); shotFrames += 1; }
    renderer.render(scene, camera);
    if (shotFrames >= 2) window.__shotReady = true;
    return;
  }
  step(dt);
  renderer.render(scene, camera);
}
window.__game = { state, player, wanted, missions, traffic, peds, police, setScreen, startMission };
setScreen('title');
if (shot) {
  stageShot(window.__game, shot, { city, scene, combat, parked, traffic, camRig });
  setScreen('play');
  // Keep the staged scene still for the screenshot: freeze world motion.
  state.screen = 'play';
}
requestAnimationFrame(frame);
