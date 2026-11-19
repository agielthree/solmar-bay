// input.js — keyboard + mouse. WASD/arrows move, mouse drag orbits the camera,
// click shoots, E enters/exits cars, Q starts missions, Esc pauses, M mutes.
export const ACTION_CONFIRM = 1, ACTION_PAUSE = 2, ACTION_MISSION = 4, ACTION_ENTER = 8, ACTION_MUTE = 16;
export function createInput(canvas) {
  const keys = new Set();
  let actions = 0, mouseDX = 0, mouseDY = 0, shooting = false, dragging = false;
  let lastX = 0, lastY = 0;
  function key(e) { return e.code || e.key; }
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) {
      if (e.code === 'Enter' || e.code === 'Space') actions |= ACTION_CONFIRM;
      if (e.code === 'Escape' || e.code === 'KeyP') actions |= ACTION_PAUSE;
      if (e.code === 'KeyQ') actions |= ACTION_MISSION;
      if (e.code === 'KeyE') actions |= ACTION_ENTER;
      if (e.code === 'KeyM') actions |= ACTION_MUTE;
    }
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousedown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    if (e.button === 0) shooting = true;
  });
  window.addEventListener('mouseup', (e) => { dragging = false; if (e.button === 0) shooting = false; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    mouseDX += e.clientX - lastX; mouseDY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return {
    takeActions() { const a = actions; actions = 0; return a; },
    takeMouse() { const d = { dx: mouseDX, dy: mouseDY }; mouseDX = 0; mouseDY = 0; return d; },
    get shooting() { return shooting; },
    direction() {
      return {
        up: keys.has('KeyW') || keys.has('ArrowUp'),
        down: keys.has('KeyS') || keys.has('ArrowDown'),
        left: keys.has('KeyA') || keys.has('ArrowLeft'),
        right: keys.has('KeyD') || keys.has('ArrowRight'),
        run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        handbrake: keys.has('Space'),
      };
    },
  };
}
