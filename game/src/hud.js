// hud.js — DOM HUD: cash/health/armor, wanted stars, speed, mission objective,
// message feed, minimap canvas (roads, player, cars, police, mission marker),
// start / pause / busted / game-over / complete screens, help overlay.
export function createHud() {
  const el = (id) => document.getElementById(id);
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');
  const feed = el('feed');
  let feedTimer = null;
  function showFeed(msg, ms) {
    feed.textContent = msg; feed.style.opacity = '1';
    clearTimeout(feedTimer);
    feedTimer = setTimeout(() => { feed.style.opacity = '0'; }, ms || 3600);
  }
  return {
    showFeed,
    setScreen(name) {
      for (const s of ['screen-title', 'screen-pause', 'screen-busted', 'screen-over', 'screen-complete']) {
        el(s).style.display = s === 'screen-' + name ? 'flex' : 'none';
      }
      el('hud').style.display = name === 'play' ? 'block' : 'none';
    },
    setTitleStats(cash, missionsDone, best) {
      el('title-stats').textContent = `Cash $${cash.toLocaleString()}  •  Missions ${missionsDone}/6  •  Best cash $${best.toLocaleString()}`;
    },
    update(state) {
      el('cash').textContent = '$' + state.cash.toLocaleString();
      el('health-fill').style.width = Math.max(0, state.health) + '%';
      el('armor-fill').style.width = Math.max(0, state.armor) + '%';
      el('ammo').textContent = state.inCar ? '—' : 'AMMO ' + state.ammo;
      const stars = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
      el('stars').textContent = stars;
      el('stars').style.color = state.wanted > 0 ? '#ff4444' : '#888888';
      el('mission').textContent = state.missionText;
      el('mission-title').textContent = state.missionTitle;
      el('speed').textContent = state.inCar ? Math.round(Math.abs(state.speed) * 2.2) + ' km/h' : '';
      el('carname').textContent = state.inCar ? state.carName : '';
      el('hint').textContent = state.hint;
      el('clock').textContent = state.clock;
      el('respect').textContent = 'REP ' + state.rep;
    },
    // 2D minimap: 170x170, city -210..210 mapped to the canvas.
    drawMinimap(state) {
      const S = 170, map = (v) => ((v + 210) / 420) * S;
      mctx.fillStyle = 'rgba(10,18,24,0.88)'; mctx.fillRect(0, 0, S, S);
      mctx.fillStyle = '#2e7f9e'; mctx.fillRect(map(210), 0, S - map(210), S); // sea
      mctx.fillStyle = '#e8d29a'; mctx.fillRect(map(200), 0, 10, S); // beach
      mctx.strokeStyle = '#5a6068'; mctx.lineWidth = 3;
      for (const v of [-156, -104, -52, 0, 52, 104, 156]) {
        mctx.beginPath(); mctx.moveTo(0, map(v)); mctx.lineTo(S, map(v)); mctx.stroke();
        mctx.beginPath(); mctx.moveTo(map(v), 0); mctx.lineTo(map(v), S); mctx.stroke();
      }
      mctx.fillStyle = '#c8a24a'; mctx.fillRect(map(-13) - 4, map(-169) - 4, 8, 8); // casino
      mctx.fillStyle = '#e86ba8'; mctx.fillRect(map(-150) - 3, map(150) - 3, 6, 6); // spray
      mctx.fillStyle = '#7ab8e8'; mctx.fillRect(map(150) - 3, map(-150) - 3, 6, 6); // garage
      if (state.missionPos) {
        mctx.fillStyle = '#ffc832';
        mctx.beginPath(); mctx.arc(map(state.missionPos[0]), map(state.missionPos[2]), 6, 0, 7); mctx.fill();
        mctx.strokeStyle = '#ffc832'; mctx.lineWidth = 2;
        mctx.beginPath(); mctx.arc(map(state.missionPos[0]), map(state.missionPos[2]), 9 + Math.sin(state.time * 4) * 2, 0, 7); mctx.stroke();
      }
      for (const c of state.policeCars || []) {
        mctx.fillStyle = '#ff2222';
        mctx.beginPath(); mctx.arc(map(c.x), map(c.z), 3.5, 0, 7); mctx.fill();
      }
      for (const c of state.traffic || []) {
        mctx.fillStyle = '#d8d8d8'; mctx.fillRect(map(c.x) - 1.5, map(c.z) - 1.5, 3, 3);
      }
      // Player arrow.
      mctx.save();
      mctx.translate(map(state.px), map(state.pz)); mctx.rotate(state.heading);
      mctx.fillStyle = '#2ee86b';
      mctx.beginPath(); mctx.moveTo(0, -7); mctx.lineTo(5, 6); mctx.lineTo(-5, 6); mctx.closePath(); mctx.fill();
      mctx.restore();
    },
    setOver(title, text) { el('over-title').textContent = title; el('over-text').textContent = text; },
    setComplete(text) { el('complete-text').textContent = text; },
  };
}
