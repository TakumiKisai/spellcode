// ===== ROOMS (0.8 connected maps + 0.9 special rooms) =====
// Pure data + helpers (no DOM, no game state), so it can be unit-checked in Node.
// SECTOR = world, LAYER = stage, ROOM = one arena in a layer's map. Boss arenas (Layer 5) are NOT part of this system.
import { ARENAS, WORLDS, BOSSES } from './data.js';

// ---- Room types ----------------------------------------------------------------------------------------------------------
// budget = share of the layer's spawn budget used by that room. safe = no enemies, doors always open.
// Add a new room type here (plus its interact/draw hooks in main.js) and it can be used in any map string below.
export const ROOM_TYPES = {
 S: { id: 'start', n: 'ENTRY', safe: 1, col: '#7ee8ff' },
 C: { id: 'combat', n: 'COMBAT', budget: .45, col: '#ff7a45' },
 X: { id: 'exit', n: 'EXIT NODE', budget: .65, exit: 1, col: '#9af5a0' },
 E: { id: 'challenge', n: 'CHALLENGE // ELITE HUNT', budget: .4, elite: 1, col: '#ff4d6d' },
 T: { id: 'chest', n: 'TREASURE CACHE', safe: 1, col: '#e2b24a' },
 $: { id: 'shop', n: 'CYCLE SHOP', safe: 1, col: '#b45cff' },
 B: { id: 'boss', n: 'BOSS CHAMBER', boss: 1, col: '#ff4d6d' } // only ever built by buildBossMap(), never written in a MAPS string
};

// ---- Cycles (in-run currency) ----------------------------------------------------------------------------------------------
// Recovered from the design notes: Cycles are the in-run currency (NOT Commits), they carry between layers, and a redraw costs
// escalating Cycles per layer (1, 2, 3...) that resets each layer. NOT recovered: how many Cycles you start with / earn. The numbers
// under start/earn are PROTOTYPE values, easy to retune here.
export const CYCLES = {
 start: 3,
 redrawCosts: [1, 2, 3, 4, 5],         // nth redraw in a layer; beyond the list it keeps climbing by +1
 earn: { C: 2, X: 3, E: 5, boss: 5 },  // Cycles granted for clearing a room of that type (boss = Layer 5 boss)
 chestCycles: [1, 3]                   // a chest may also drop this many Cycles (min, max) on top of its card choice
};
export const redrawCost = n => n < CYCLES.redrawCosts.length ? CYCLES.redrawCosts[n] : CYCLES.redrawCosts[CYCLES.redrawCosts.length - 1] + (n - CYCLES.redrawCosts.length + 1);

// ---- Shop configuration (prototype; every number here is tunable) ------------------------------------------------------------
// Item categories are open-ended: 'card' | 'item'. A future 'wand' category only needs a new entry in the shop builder in main.js.
export const SHOP = {
 cardCount: 3,
 cardPrice: [3, 6, 10],      // by card rarity (common, uncommon, rare)
 cardMaxRarity: 2,
 restore: { name: 'RESTORE()', price: 4, heal: .4, stock: 2, d: 'Restore 40% HP. Use it between fights.' },   // placeholder name, easy to rename
 patch: { name: 'PATCH()', price: 3, stock: 2, d: 'Refill your shield. Use it between fights.' },
 crate: { name: 'MYSTERY_CRATE()', price: 5, d: 'One random card. Odds are shown.', odds: [[.60, 0], [.30, 1], [.10, 2]] }, // [chance, rarity]
 saleChance: .15,            // rand() < 0.15: one random card in the stock is 50% off
 rerollPrice: 1,
 maxRerolls: 3
};

// ---- Slots (Cycles casino) ------------------------------------------------------------------------------------------------
// One roll per spin; thresholds are cumulative and shown to the player as rand() expressions. Expected return = sum(p * mult).
export const SLOTS = {
 bets: [1, 2, 5],
 table: [
  { id: 'jackpot', n: 'JACKPOT 7-7-7', p: .03, mult: 10, sym: ['7', '7', '7'] },
  { id: 'triple', n: 'TRIPLE', p: .07, mult: 4, sym: ['#', '#', '#'] },
  { id: 'pair', n: 'PAIR', p: .20, mult: 2, sym: ['%', '%', '&'] }
 ],
 misses: [['7', '#', '%'], ['%', '7', '&'], ['#', '&', '7'], ['&', '%', '#'], ['7', '&', '#']],
 symbols: ['7', '#', '%', '&']
};
export function slotTable() { let acc = 0; return SLOTS.table.map(o => ({ ...o, thr: +(acc += o.p).toFixed(4) })); }
export function slotRTP() { return +SLOTS.table.reduce((a, o) => a + o.p * o.mult, 0).toFixed(4); }
// r defaults to Math.random(); pass r for deterministic tests. Pure: it never touches the balance.
export function spinSlots(bet, r = Math.random()) {
 for (const o of slotTable()) if (r < o.thr) return { id: o.id, n: o.n, mult: o.mult, bet, payout: bet * o.mult, r, thr: o.thr, sym: o.sym.slice() };
 const m = SLOTS.misses[Math.floor(((r - .30) / .70) * SLOTS.misses.length) % SLOTS.misses.length] || SLOTS.misses[0];
 return { id: 'miss', n: 'NO MATCH', mult: 0, bet, payout: 0, r, thr: .30, sym: m.slice() };
}

// ---- Fixed maps for the ordinary sectors ---------------------------------------------------------------------------------
// ASCII grid: a letter every 2nd column/row is a room (see ROOM_TYPES), '-' joins two rooms side by side, '|' joins two rooms
// above/below each other. These are AUTHORED and never re-rolled. Key = '<world>:<layer>' (Layers 1-4 only).
// Reading a map: S is where you enter, X is the exit node (clear it, then step on the portal to finish the layer).
export const MAPS = {
 // BOOT SECTOR: gentle onboarding. 1-3 always keeps its chest on the right-hand branch.
 'boot:1': ['S-C-X'],
 'boot:2': ['S-C-X',
            '  |  ',
            '  E  '],
 'boot:3': ['C-X  ',
            '| |  ',
            'C-C-T',
            '  |  ',
            '  S  '],
 'boot:4': ['S-C-$',
            '  |  ',
            '  C-X'],
 // THE HEAP
 'heap:1': ['S-C-C-X',
            '    |  ',
            '    T  '],
 'heap:2': ['  E  ',
            '  |  ',
            'S-C-X',
            '  |  ',
            '  $  '],
 'heap:3': ['S-C-C-X',
            '  |   |',
            '  C-E-C'],
 'heap:4': ['S-C-C-X',
            '  |    ',
            '  E-T  '],
 // /dev/null
 'null:1': ['S-C-X',
            '  |  ',
            '  C-T'],
 'null:2': ['S-C-C-X',
            '    |  ',
            '    E  '],
 'null:3': ['S-C-X',
            '  | |',
            '  $ E'],
 'null:4': ['S-C-C-X',
            '  |   |',
            '  C-T-C'],
 // NEXUS COMPLEX
 'nexus:1': ['S-C-X',
             '  |  ',
             '  T  '],
 'nexus:2': ['S-C-E',
             '  |  ',
             '  C-X'],
 'nexus:3': ['    T  ',
             '    |  ',
             'S-C-C-X',
             '  |    ',
             '  $    '],
 'nexus:4': ['S-C-C-X',
             '  | |  ',
             '  $ E  ']
};

const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
export const DIR_VEC = DIRS; export const DIR_OPP = OPP;
const idOf = (x, y) => x + '_' + y;

function link(a, b) {
 const dx = b.at[0] - a.at[0], dy = b.at[1] - a.at[1];
 const d = dx === 1 ? 'E' : dx === -1 ? 'W' : dy === 1 ? 'S' : 'N';
 a.doors[d] = b.id; b.doors[OPP[d]] = a.id;
}
export function parseMap(rows) {
 const rooms = {}, at = {};
 rows.forEach((row, ri) => {
  if (ri % 2) return;
  for (let ci = 0; ci < row.length; ci += 2) {
   const ch = row[ci];
   if (ROOM_TYPES[ch]) { const x = ci / 2, y = ri / 2, r = { id: idOf(x, y), type: ch, at: [x, y], doors: {} }; rooms[r.id] = r; at[x + ',' + y] = r; }
  }
 });
 rows.forEach((row, ri) => {
  for (let ci = 0; ci < row.length; ci++) {
   const ch = row[ci];
   if (ch === '-' && ri % 2 === 0 && ci % 2 === 1) { const a = at[(ci - 1) / 2 + ',' + ri / 2], b = at[(ci + 1) / 2 + ',' + ri / 2]; if (a && b) link(a, b); }
   if (ch === '|' && ri % 2 === 1 && ci % 2 === 0) { const a = at[ci / 2 + ',' + (ri - 1) / 2], b = at[ci / 2 + ',' + (ri + 1) / 2]; if (a && b) link(a, b); }
  }
 });
 return rooms;
}

// ---- Arena derivation ----------------------------------------------------------------------------------------------------
// Every room reuses an EXISTING world arena. A derived copy (registered in ARENAS as '<base>@<doors>') has the walls and hazards cut
// away around its doors so each door is reachable; safe rooms also lose hazards and the walls in the middle ("stage") for the NPC.
const ZONES = { N: [270, 0, 100, 52], S: [270, 348, 100, 52], W: [0, 150, 52, 100], E: [588, 150, 52, 100] };
const STAGE = [200, 80, 240, 240];
const hit = (a, b) => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
const blocked = (A, x, y, r) => { for (const w of A.w) if (x > w[0] - r && x < w[0] + w[2] + r && y > w[1] - r && y < w[1] + w[3] + r) return true; return x < r || y < r || x > 640 - r || y > 400 - r; };
export const DOOR_SPOT = { N: [320, 26], S: [320, 374], W: [26, 200], E: [614, 200] };
export const ENTRY_SPOT = { N: [320, 44], S: [320, 356], W: [44, 200], E: [596, 200] }; // where you stand after walking in through that side
function reachable(A, from) {
 const seen = new Set(), q = [from], key = (x, y) => x + ',' + y;
 seen.add(key(from[0], from[1]));
 while (q.length) {
  const [x, y] = q.pop();
  for (const [dx, dy] of [[10, 0], [-10, 0], [0, 10], [0, -10]]) {
   const nx = x + dx, ny = y + dy, k = key(nx, ny);
   if (seen.has(k) || blocked(A, nx, ny, 9)) continue;
   seen.add(k); q.push([nx, ny]);
  }
 }
 return seen;
}
function freeNear(A, x, y) {
 for (let r = 0; r < 220; r += 10) for (let a = 0; a < 16; a++) {
  const px = Math.round((x + Math.cos(a / 16 * 6.283) * r) / 10) * 10, py = Math.round((y + Math.sin(a / 16 * 6.283) * r) / 10) * 10;
  if (!blocked(A, px, py, 9)) return [px, py];
 }
 return [x, y];
}
export function roomArena(base, doors, calm) {
 const open = ['N', 'E', 'S', 'W'].filter(d => doors[d]);
 const key = `${base}@${open.join('') || '-'}${calm ? 'c' : ''}`;
 if (ARENAS[key]) return key;
 const b = ARENAS[base], zones = open.map(d => ZONES[d]);
 const A = { ...b, key, base, own: b.own, w: b.w.filter(r => !zones.some(z => hit(r, z)) && !(calm && hit(r, STAGE))), hz: calm ? [] : b.hz.filter(r => !zones.some(z => hit(r, z))), roomDerived: 1, doorSides: open };
 ARENAS[key] = A;
 // Make sure every door can actually be reached from the middle of the room; if a wall seals one off, cut a corridor through it.
 for (let pass = 0; pass < 3; pass++) {
  const seen = reachable(A, freeNear(A, 320, 200)), bad = open.filter(d => !seen.has(ENTRY_SPOT[d][0] + ',' + ENTRY_SPOT[d][1]) && !seen.has(Math.round(ENTRY_SPOT[d][0] / 10) * 10 + ',' + Math.round(ENTRY_SPOT[d][1] / 10) * 10));
  if (!bad.length) break;
  for (const d of bad) { const [dx, dy] = ENTRY_SPOT[d], c = [Math.min(dx, 320) - 20, Math.min(dy, 200) - 20, Math.abs(dx - 320) + 40, Math.abs(dy - 200) + 40]; A.w = A.w.filter(r => !hit(r, c)); }
 }
 return key;
}
export function calmArena(world) { // the world's quietest arena (fewest hazards, then walls): shops, chests and the entry room use it
 return [...world.ar].sort((a, b) => (ARENAS[a].hz.length - ARENAS[b].hz.length) || (ARENAS[a].w.length - ARENAS[b].w.length))[0];
}
function assignArenas(world, layer, rooms) {
 const pal = world.ar, primary = pal[(layer - 1) % pal.length], calm = calmArena(world);
 for (const r of Object.values(rooms)) {
  const T = ROOM_TYPES[r.type];
  r.base = T.safe ? calm : T.exit ? primary : pal[(((r.at[0] + 2 * r.at[1] + layer + (r.type === 'E' ? 1 : 0)) % pal.length) + pal.length) % pal.length]; // positive modulo: Kernel maps use negative coordinates
  r.arena = roomArena(r.base, r.doors, !!T.safe);
 }
}

// ---- Kernel Expedition: the ONLY procedural map generator --------------------------------------------------------------------
export function genKernelRooms(layer, rnd = Math.random) {
 const rooms = {}, at = {};
 const add = (x, y, type) => { const r = { id: idOf(x, y), type, at: [x, y], doors: {} }; rooms[r.id] = r; at[x + ',' + y] = r; return r; };
 const freeDirs = (r) => Object.keys(DIRS).filter(d => !at[(r.at[0] + DIRS[d][0]) + ',' + (r.at[1] + DIRS[d][1])]);
 const pathLen = 3 + Math.floor(rnd() * 3) + (layer > 2 ? 1 : 0);
 let cur = add(0, 0, 'S'); const path = [cur];
 for (let i = 1; i < pathLen; i++) {
  const fd = freeDirs(cur); if (!fd.length) break;
  const d = fd[Math.floor(rnd() * fd.length)];
  const n = add(cur.at[0] + DIRS[d][0], cur.at[1] + DIRS[d][1], 'C'); link(cur, n); path.push(n); cur = n;
 }
 if (path.length < 2) { const n = add(1, 0, 'X'); link(cur, n); } else cur.type = 'X';
 const want = 1 + Math.floor(rnd() * 3), bag = ['C', 'C', 'T', 'E', '$'], used = {};
 for (let i = 0; i < want; i++) {
  const cand = path.slice(1).filter(r => freeDirs(r).length); if (!cand.length) break;
  const from = cand[Math.floor(rnd() * cand.length)], fd = freeDirs(from), d = fd[Math.floor(rnd() * fd.length)];
  let t = bag[Math.floor(rnd() * bag.length)]; if ((t === '$' || t === 'T') && used[t]) t = 'C'; used[t] = 1;
  const n = add(from.at[0] + DIRS[d][0], from.at[1] + DIRS[d][1], t); link(from, n);
 }
 for (const r of Object.values(rooms)) for (const d of Object.keys(DIRS)) { // a shortcut that reconnects two neighbouring rooms now and then
  const o = at[(r.at[0] + DIRS[d][0]) + ',' + (r.at[1] + DIRS[d][1])];
  if (o && !r.doors[d] && r.type !== 'X' && o.type !== 'X' && rnd() < .3) link(r, o);
 }
 return rooms;
}

// ---- Public entry point ----------------------------------------------------------------------------------------------------
// Returns a fresh map object, or null for layers that keep the single-room format (boss layers, Deadlock, generated worlds).
export function buildLayerMap(worldKey, layer, rnd = Math.random) {
 const world = WORLDS[worldKey]; if (!world || layer < 1 || layer > 4) return null;
 let rooms;
 if (worldKey === 'kernel') rooms = genKernelRooms(layer, rnd);
 else if (MAPS[worldKey + ':' + layer]) rooms = parseMap(MAPS[worldKey + ':' + layer]);
 else return null;
 assignArenas(world, layer, rooms);
 const start = Object.values(rooms).find(r => r.type === 'S'), exit = Object.values(rooms).find(r => r.type === 'X');
 const state = {}; for (const id in rooms) state[id] = { seen: false, cleared: false, looted: false };
 return { key: worldKey + ':' + layer, procedural: worldKey === 'kernel', rooms, start: start.id, exit: exit.id, cur: start.id, state };
}

// ---- Boss layers (Layer 5): an antechamber with a boss door -> the existing dedicated boss arena ---------------------------------
// The boss arena itself is NOT touched: the 'B' room points at BOSSES[boss].arena and runs through the original boss code (intro, music, HP bar,
// rewards). Stepping through the boss door starts the same boss boot screen as before. Deadlock keeps its own structure and gets no door yet.
export function buildBossMap(worldKey, bossKey) {
 const world = WORLDS[worldKey]; if (!world || worldKey === 'deadlock' || !BOSSES[bossKey] || !ARENAS[BOSSES[bossKey].arena]) return null;
 const a = { id: '0_0', type: 'S', at: [0, 0], doors: { E: '1_0' } }, b = { id: '1_0', type: 'B', at: [1, 0], doors: {} };
 a.base = calmArena(world); a.arena = roomArena(a.base, a.doors, true);
 b.base = b.arena = BOSSES[bossKey].arena;
 const rooms = { [a.id]: a, [b.id]: b }, state = {}; for (const id in rooms) state[id] = { seen: false, cleared: false, looted: false };
 return { key: worldKey + ':boss', procedural: false, boss: true, bossKey, rooms, start: a.id, exit: b.id, cur: a.id, state };
}
