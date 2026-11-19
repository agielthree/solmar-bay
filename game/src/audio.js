// Synthesised WebAudio sound: no audio files, everything is oscillators + noise.
// Engine hum, police siren, gunshots, pickups, UI blips and a lo-fi synthwave loop.
export function createAudio() {
  let ctx = null, master = null, musicGain = null, engineOsc = null, engineGain = null;
  let muted = false, musicTimer = null, musicStep = 0, started = false;
  const BASS = [55, 0, 65.41, 0, 49, 0, 58.27, 0, 55, 0, 65.41, 0, 73.42, 0, 65.41, 0];
  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.14; musicGain.connect(master);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
      engineGain = ctx.createGain(); engineGain.gain.value = 0; engineOsc.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    } catch { return false; }
    return true;
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
  }
  function noise(dur, vol, low) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low || 1200;
    const g = ctx.createGain(); g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  function musicTick() {
    if (!ctx || muted) return;
    const f = BASS[musicStep % BASS.length];
    if (f) tone(f, 0.42, 'triangle', 0.5);
    if (musicStep % 4 === 0) tone(220, 0.18, 'square', 0.06);
    if (musicStep % 8 === 4) tone(330, 0.3, 'sine', 0.08, 440);
    musicStep += 1;
  }
  return {
    start() {
      if (started) return; started = true;
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      musicTimer = setInterval(musicTick, 230);
    },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    get muted() { return muted; },
    engine(speed01, on) {
      if (!ctx) return;
      engineGain.gain.value = on ? 0.05 + speed01 * 0.06 : 0;
      engineOsc.frequency.value = 45 + speed01 * 130;
    },
    siren(on) { /* siren is a repeating two-tone handled by the caller via beep */ },
    beep() { tone(880, 0.09, 'sine', 0.15); },
    sirenBlip(high) { tone(high ? 950 : 700, 0.28, 'square', 0.05); },
    gunshot() { noise(0.14, 0.5, 2600); tone(160, 0.1, 'square', 0.2, 60); },
    hit() { tone(220, 0.08, 'square', 0.15, 110); },
    pickup() { tone(660, 0.1, 'sine', 0.2); setTimeout(() => tone(990, 0.14, 'sine', 0.2), 90); },
    cash() { tone(880, 0.08, 'sine', 0.18); setTimeout(() => tone(1174, 0.08, 'sine', 0.18), 80); setTimeout(() => tone(1568, 0.16, 'sine', 0.18), 160); },
    crash() { noise(0.3, 0.5, 500); },
    wanted() { tone(440, 0.15, 'sawtooth', 0.15, 880); },
    busted() { tone(330, 0.4, 'sawtooth', 0.2, 110); },
    mission() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.2), i * 110)); },
    fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.18), i * 130)); },
  };
}
