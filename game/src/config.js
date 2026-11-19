// SOLMAR BAY — an original sun-soaked coastal open-world crime game.
// config.js: every tuned constant, the city layout and the story missions.
// Nothing here is from any commercial game: city, people and story are invented.
export const SAVE_KEY = 'solmar-bay-save-v1';
export const WORLD = {
  size: 420, // city spans -210..210 on x and z
  roadGap: 52, // distance between road centrelines
  roadWidth: 12,
  blockSize: 40,
};
export const PLAYER_CFG = { walkSpeed: 7, runSpeed: 11.5, health: 100, radius: 0.9 };
export const CAR_CFG = { accel: 22, brake: 34, reverse: 12, maxSpeed: 38, turn: 1.9, grip: 6 };
export const WANTED_MAX = 5;
export const COLORS = {
  sky: 0x87bfe8, sun: 0xfff2d0, sea: 0x2e7f9e, sand: 0xe8d29a,
  asphalt: 0x3a3f46, sidewalk: 0x9aa0a3, grass: 0x5f9e52,
};
// Palette of paint jobs for traffic / player cars (original names, no brands).
export const CAR_PAINTS = [
  { name: 'Sunset Coral', body: 0xe85d3d, trim: 0x2b2b2b },
  { name: 'Bay Teal', body: 0x1f8a8a, trim: 0x14333a },
  { name: 'Palm Lime', body: 0x86c232, trim: 0x222222 },
  { name: 'Vice Pink', body: 0xe86ba8, trim: 0x3a1430 },
  { name: 'Midnight', body: 0x232a3a, trim: 0xc8a24a },
  { name: 'Taxi Sun', body: 0xf2c230, trim: 0x222222 },
  { name: 'Cream', body: 0xeadfc8, trim: 0x5a4632 },
  { name: 'Ocean Blue', body: 0x2f6fd0, trim: 0x10233a },
];
export const PED_NAMES = [
  'Mara', 'Tomas', 'Lena', 'Oscar', 'Priya', 'Dante', 'Sofia', 'Ruben',
  'Nadia', 'Felix', 'Carmen', 'Hugo', 'Iris', 'Mateo', 'Luz', 'Diego',
];
// Six story missions. Each: id, title, briefing, objective text, reward, kind.
export const MISSIONS = [
  {
    id: 'm1', title: 'First Wheels', kind: 'steal',
    briefing: 'Sal Delgado needs wheels. Borrow a car from the boulevard — permanently — and bring it to the garage on Marina Row.',
    objective: 'Steal any car and deliver it to the yellow garage marker.',
    reward: 300, start: [150, 0, 150], target: [150, 0, -150],
  },
  {
    id: 'm2', title: 'Courier Run', kind: 'checkpoints',
    briefing: 'Mama Rosa\'s parcels don\'t deliver themselves. Hit all four drop points around Solmar Bay before the timer runs out.',
    objective: 'Drive through all 4 orange checkpoints before time runs out.',
    reward: 500, time: 150, start: [150, 0, -150],
    points: [[-150, 0, -150], [-150, 0, 150], [0, 0, 150], [0, 0, -150]],
  },
  {
    id: 'm3', title: 'Hot Afternoon', kind: 'escape',
    briefing: 'The Bay Police are on your tail after the courier job. Lose a 3-star wanted level — break line of sight and stay hidden.',
    objective: 'Lose the cops: reach wanted 0 while driving.',
    reward: 600, start: [0, 0, 150], wanted: 3,
  },
  {
    id: 'm4', title: 'Warehouse Row', kind: 'shootout',
    briefing: 'Rival crew the Vultures took over the old warehouse. Clear them out — on foot, armed — and grab the stash.',
    objective: 'Defeat all 5 Vultures at the warehouse, then collect the stash.',
    reward: 900, start: [-150, 0, -150], target: [-150, 0, 0], enemies: 5,
  },
  {
    id: 'm5', title: 'Getaway Driver', kind: 'chase',
    briefing: 'Sal is lifting the marina safe. You drive. Get him from the marina to the safehouse while the police chase you both.',
    objective: 'Pick up Sal at the marina, then reach the safehouse with the cops behind you.',
    reward: 1200, start: [150, 0, 150], target: [150, 0, -150], wanted: 2,
  },
  {
    id: 'm6', title: 'The Big Score', kind: 'finale',
    briefing: 'One last job: the Solmar Bay casino vault. Grab the cash, fight your way out, and lose a 4-star wanted level. Then you\'re free.',
    objective: 'Grab the vault cash at the casino, then lose the 4-star wanted level.',
    reward: 2500, start: [0, 0, -150], target: [0, 0, 150], wanted: 4, enemies: 4,
  },
];
export const STORY_INTRO =
  'Solmar Bay, 2026. Jace Rivera came home with nothing but a duffel bag and a debt. ' +
  'Fixer Sal Delgado offers a way up — one job at a time. Steal cars, outrun the Bay Police, ' +
  'and take the city back, block by block.';
// Free-roam activities shown on the HUD / map.
export const ACTIVITIES = [
  { id: 'spray', name: 'Pay-N-Spray', desc: 'Repaint: clears wanted level ($200)', pos: [-150, 0, 150] },
  { id: 'hospital', name: 'Bay Clinic', desc: 'Respawn point when busted or down', pos: [0, 0, 0] },
  { id: 'shop', name: 'Ammo-N-Go', desc: 'Ammo refill ($50)', pos: [150, 0, 0] },
];
