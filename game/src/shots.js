// shots.js — deterministic screenshot scenes. Each one puts the real game into
// a real gameplay moment (driving, police chase, mission, on-foot combat) and
// steps the world forward a little, so the frame is what playing looks like.
import { MISSIONS } from './config.js';

export function stageShot(game, name, world) {
  const { player, wanted, missions, traffic, police } = game;
  const { combat, camRig } = world;
  player.group.visible = true;
  if (name === 'chase') {
    // Player in a coral car speeding down the boulevard, 3 stars, two police cars behind.
    // Camera sits ahead and looks back, so the player car and the pursuing police are both in frame.
    const car = traffic[0];
    player.inCar = car; player.group.visible = false;
    car.x = 0; car.z = 40; car.heading = 0; car.speed = 30;
    car.group.position.set(0, 0, 40); car.group.rotation.y = 0;
    player.x = 0; player.z = 40;
    wanted.setLevel(3);
    police.spawnCar(3, 78); police.spawnCar(-3, 92);
    police.cars[0].speed = 28; police.cars[1].speed = 26;
    if (camRig) camRig.yaw = 0;
    game.state.carName = car.paint.name;
    game.state.missionTitle = 'On the run — 3 stars';
    game.state.missionText = 'WANTED 3 STARS — lose the Bay Police!';
    game.state.hint = 'W/S drive • A/D steer • Space handbrake • E exit';
  } else if (name === 'mission') {
    // Mission 2 Courier Run in progress: player driving west toward the first
    // checkpoint beacon on the north road, camera behind the car.
    missions.index = 1;
    const a = missions.start();
    const car = traffic[1];
    player.inCar = car; player.group.visible = false;
    car.x = -90; car.z = -150; car.heading = -Math.PI / 2; car.speed = 18;
    car.group.position.set(-90, 0, -150); car.group.rotation.y = -Math.PI / 2;
    player.x = -90; player.z = -150;
    if (camRig) camRig.yaw = -Math.PI / 2;
    game.state.carName = car.paint.name;
    game.state.missionTitle = 'Mission 2 — Courier Run';
    game.state.missionText = missions.objectiveText();
    game.state.hint = 'Drive through the orange checkpoints before time runs out';
  } else if (name === 'foot') {
    // On foot at the warehouse, mission 4 shootout: Vultures ahead, player armed,
    // camera behind the player so both he and the enemies are in frame.
    missions.index = 3;
    missions.start();
    missions.active.stage = 'fight';
    player.x = -128; player.z = 0; player.heading = -Math.PI / 2;
    player.group.position.set(-128, 0, 0); player.group.rotation.y = player.heading;
    player.ammo = 60;
    if (camRig) camRig.yaw = -Math.PI / 2;
    for (let i = 0; i < 5; i++) combat.spawnEnemy(-156 + (i % 2) * 10, -6 + Math.floor(i / 2) * 8);
    wanted.setLevel(1);
    game.state.missionTitle = 'Mission 4 — Warehouse Row';
    game.state.missionText = 'Vultures left: 5 — clear the warehouse!';
    game.state.hint = 'Click to shoot • WASD move • E enter car';
  } else {
    // city (default / cover fallback): driving through downtown with traffic + peds.
    const car = traffic[2];
    player.inCar = car; player.group.visible = false;
    car.x = 0; car.z = 90; car.heading = 0; car.speed = 16;
    car.group.position.set(0, 0, 90); car.group.rotation.y = 0;
    player.x = 0; player.z = 90;
    game.state.carName = car.paint.name;
    game.state.missionTitle = 'Solmar Bay — free roam';
    game.state.missionText = MISSIONS[0].briefing;
    game.state.hint = 'WASD move • E enter car • Q mission • Click shoot • M mute';
  }
  // Step the world a few frames so traffic/peds settle into natural positions.
  for (let i = 0; i < 30; i++) {
    for (const c of traffic) { if (c !== player.inCar) { c.x += Math.sin(c.heading) * c.speed * 0.016; c.z += Math.cos(c.heading) * c.speed * 0.016; c.group.position.set(c.x, 0, c.z); } }
  }
  return game;
}
