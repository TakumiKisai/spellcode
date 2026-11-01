// ===== WANDS + BANDWIDTH (pure data and helpers: no DOM, no game state, unit-checked in tests/wands.check.mjs) =====
// A wand decides HOW an attack card is executed. The card still supplies the underlying attack; the wand transforms its stats (a) and may
// tag it with a `fx` id that the combat code (fire() in main.js) uses to pick a different delivery. Nothing here replaces the card pipeline.
//
// Add a wand = add ONE entry to WANDS. No other file needs a hard-coded branch except the optional delivery (`fx`) in fire().
//   accepts   : 'all' (every attack card) or { spells:[ids], kinds:[attack kinds] }  -> an attack card is compatible if EITHER list matches
//   xform(a)  : mutates the compiled attack stats (after card modifiers, before Host stats are applied is NOT required: it runs last in stats())
//   fx        : optional delivery id read by fire(); cards the wand does not transform keep their normal delivery
//   transforms: spell ids the wand turns into a different attack (shown to the player as "<card> -> <name>")
//   bwMul/bwAdd: effective Bandwidth cost modifiers applied to every BW-consuming attack this wand executes
// Non-attack cards ('self' kind: shield() etc.) are never blocked by a wand.

const K = '#0b1220'; // sprite outline
export const ATTACK_KINDS = ['proj', 'nova', 'chain', 'orbit', 'mine', 'cone', 'beam', 'melee'];

export const WANDS = {
 universal: {
  n: 'Universal Wand', short: 'UNIVERSAL', glyph: '/', col: '#9fb4d6', hue: 214,
  d: 'Fires every attack card normally. Reliable fallback; no specialization.',
  accepts: 'all', transforms: [],
  art: [ // 20x7 pixel sprite, pointing right: [x, y, w, h, colour]. Drawn procedurally (the project has no image assets); see wandart.js
   [1, 1, 15, 5, K], [2, 2, 13, 3, '#aab9d6'], [2, 4, 13, 1, '#6f7fa0'], [3, 2, 9, 1, '#e4ecfa'], [2, 2, 3, 3, '#3a4560'], [3, 2, 1, 3, '#59668a'],
   [6, 2, 1, 3, '#e2b24a'], [11, 2, 1, 3, '#e2b24a'], [15, 2, 1, 3, '#e2b24a'],
   [16, 2, 3, 3, '#7ee0ff'], [17, 1, 1, 1, '#7ee0ff'], [17, 5, 1, 1, '#7ee0ff'], [19, 3, 1, 1, '#7ee0ff'], [17, 2, 1, 1, '#ffffff'], [18, 4, 1, 1, '#3b8fd0']
  ],
  dmgMul: 1,          // baseline: the existing combat balance. Lower this to make the fallback deliberately weaker than specialists.
  bwMul: 1, bwAdd: 0
 },
 cryomancer: {
  n: 'Cryomancer Wand', short: 'CRYOMANCER', glyph: '*', col: '#7ee8ff', hue: 190,
  d: 'Only stdout() fires. It becomes a continuous Cryogenic Stream: narrow, long, freezes the floor into slowing ice. Costs Bandwidth.',
  accepts: { spells: ['stdout'], kinds: [] },
  transforms: ['stdout'],
  fx: { stdout: 'cryo' },
  art: [
   [1, 1, 14, 5, K], [2, 2, 12, 3, '#4f95c4'], [2, 4, 12, 1, '#2f6a99'], [3, 2, 8, 1, '#bff0ff'], [2, 2, 3, 3, '#1d3d5e'],
   [6, 3, 1, 1, '#ffffff'], [9, 3, 1, 1, '#ffffff'], [12, 3, 1, 1, '#ffffff'], [14, 2, 1, 3, '#e6fbff'],
   [15, 2, 3, 3, '#e6fbff'], [16, 3, 2, 1, '#7ee8ff'], [16, 1, 2, 1, '#7ee8ff'], [18, 0, 1, 2, '#bff6ff'], [16, 5, 2, 1, '#7ee8ff'], [18, 5, 1, 2, '#bff6ff'], [18, 3, 2, 1, '#bff6ff'], [19, 3, 1, 1, '#ffffff']
  ],
  xform(a, c) {
   if (c.sp !== 'stdout') return;
   a.wandFx = 'cryo';
   a.col = '#7ee8ff';
   a.burn = 0;                              // ice does not burn: the stream chills instead
   a.freeze = Math.max(1, a.freeze);        // the freeze modifier still stacks and strengthens the chill
   a.dmg *= CRYO.dmgMul;
   a.cryoLen = CRYO.len;
   a.cryoHalf = CRYO.half;
   a.pierce = 99;                            // the stream passes through every bug in its path
   a.bw = CRYO.bw;                           // BASE Bandwidth per stream tick (wand effects and modifiers may change the effective cost)
  },
  bwMul: 1, bwAdd: 0
 },
 railgun: {
  n: 'Railgun Wand', short: 'RAILGUN', glyph: '=', col: '#b48cff', hue: 270,
  d: 'Only ping() fires. A slow, heavy rail shot that reaches across the room. Every bug it passes takes more damage than the last: line them up.',
  accepts: { spells: ['ping'], kinds: [] }, transforms: ['ping'], fx: { ping: 'rail' },
  art: [
   [0, 1, 19, 5, K], [1, 2, 17, 1, '#b48cff'], [1, 4, 17, 1, '#b48cff'], [1, 3, 17, 1, '#2a2f45'], [2, 3, 6, 1, '#6c7aa8'],
   [0, 2, 3, 3, '#3a4560'], [4, 3, 1, 1, '#e4ecfa'], [9, 3, 1, 1, '#e4ecfa'], [14, 3, 1, 1, '#e4ecfa'], [15, 2, 2, 3, '#1b2236'],
   [17, 2, 2, 3, '#ffffff'], [18, 3, 1, 1, '#7ee8ff'], [19, 3, 1, 1, '#7ee8ff'], [17, 1, 1, 1, '#d9c2ff'], [17, 5, 1, 1, '#d9c2ff']
  ],
  xform(a, c) {
   if (c.sp !== 'ping') return;
   a.wandFx = 'rail'; a.col = '#b48cff';
   a.dmg *= RAIL.dmgMul; a.rate *= RAIL.rateMul; a.railLen = RAIL.len; a.railRamp = RAIL.ramp; a.knock = Math.max(a.knock || 0, RAIL.knock);
   a.bw = RAIL.bw;
  }
 },
 pyromancer: {
  n: 'Pyromancer Wand', short: 'PYROMANCER', glyph: '^', col: '#ff7a45', hue: 18,
  d: 'Only fireball() fires. It becomes a napalm shell: it bursts on the first thing it touches and leaves a burning patch on the floor.',
  accepts: { spells: ['fireball'], kinds: [] }, transforms: ['fireball'], fx: { fireball: 'pyro' },
  art: [
   [1, 1, 13, 5, K], [2, 2, 11, 3, '#8a4a2b'], [2, 4, 11, 1, '#5e2f1b'], [3, 2, 7, 1, '#c9783f'], [2, 2, 3, 3, '#3b1d12'],
   [6, 2, 1, 3, '#e2b24a'], [10, 2, 1, 3, '#e2b24a'], [14, 2, 1, 3, '#e2b24a'],
   [15, 2, 3, 3, '#ff7a45'], [16, 1, 2, 5, '#ff7a45'], [17, 0, 1, 7, '#ffb04f'], [18, 2, 2, 3, '#ffd36a'], [19, 3, 1, 1, '#fff7db'], [16, 3, 2, 1, '#fff2c4']
  ],
  xform(a, c) {
   if (c.sp !== 'fireball') return;
   a.wandFx = 'pyro'; a.col = '#ff7a45';
   a.sp *= PYRO.speedMul; a.rad = Math.max(a.rad, PYRO.rad); a.pierce = 0; a.burn = Math.max(1, a.burn || 0);
   a.pyroR = PYRO.blastR; a.pyroBlast = PYRO.blastMul; a.pyroPatch = PYRO.patch;
   a.bw = PYRO.bw;
  }
 },
 swarm: {
  n: 'Swarm Wand', short: 'SWARM', glyph: ':', col: '#9dff7a', hue: 100,
  d: 'Only bolt() fires. One bolt becomes a cloud of small homing drones that spread out and hunt scattered bugs. Each drone hits weakly and does not pierce.',
  accepts: { spells: ['bolt'], kinds: [] }, transforms: ['bolt'], fx: { bolt: 'swarm' },
  art: [
   [1, 2, 11, 3, K], [2, 3, 9, 1, '#6bb04a'], [2, 2, 9, 1, '#9dff7a'], [2, 4, 9, 1, '#3d6e2a'], [1, 2, 3, 3, '#24401a'], [5, 3, 1, 1, '#e8ffd9'], [8, 3, 1, 1, '#e8ffd9'],
   [12, 3, 2, 1, '#9dff7a'], [14, 1, 2, 2, '#9dff7a'], [14, 4, 2, 2, '#9dff7a'], [17, 0, 2, 2, '#caff9d'], [17, 3, 2, 2, '#caff9d'], [17, 5, 2, 2, '#caff9d'],
   [14, 3, 3, 1, '#3d6e2a'], [15, 1, 1, 1, '#e8ffd9'], [15, 5, 1, 1, '#e8ffd9']
  ],
  xform(a, c) {
   if (c.sp !== 'bolt') return;
   a.wandFx = 'swarm'; a.col = '#9dff7a';
   a.swarmN = SWARM.n; a.dmg *= SWARM.dmgMul; a.pierce = 0; a.home = Math.max(1, a.home || 0); a.turn = Math.max(a.turn || 0, SWARM.turn);
   a.sp *= SWARM.speedMul; a.rad = SWARM.rad;
   a.bw = SWARM.bw;
  }
 },
 stormcaller: {
  n: 'Stormcaller Wand', short: 'STORMCALLER', glyph: '~', col: '#ffe066', hue: 50,
  d: 'Only chain() fires. Lightning no longer hops in a single line: every bug struck forks the arc to two more nearby, and each shock briefly slows what it touches.',
  accepts: { spells: ['chain'], kinds: [] }, transforms: ['chain'], fx: { chain: 'storm' },
  art: [
   [1, 1, 12, 5, K], [2, 2, 10, 3, '#5b4b9a'], [2, 4, 10, 1, '#3a2f66'], [3, 2, 7, 1, '#8f7bff'], [2, 2, 3, 3, '#241c44'], [6, 3, 1, 1, '#ffe066'], [9, 3, 1, 1, '#ffe066'],
   [13, 2, 2, 3, '#ffe066'], [15, 1, 1, 2, '#ffe066'], [16, 0, 2, 2, '#fff5b0'], [14, 4, 2, 1, '#ffe066'], [15, 5, 2, 2, '#ffe066'], [17, 4, 2, 1, '#fff5b0'], [18, 3, 2, 1, '#ffffff'], [16, 3, 2, 1, '#ffd23f']
  ],
  xform(a, c) {
   if (c.sp !== 'chain') return;
   a.wandFx = 'storm'; a.col = '#ffe066';
   a.stormFork = STORM.fork; a.stormShock = STORM.shock; a.dmg *= STORM.dmgMul;
   a.bw = STORM.bw;
  }
 },
 demolitionist: {
  n: 'Demolitionist Wand', short: 'DEMOLITION', glyph: 'o', col: '#ff5c7a', hue: 350,
  d: 'Only mine() fires. One mine becomes a row of three small charges laid along your aim that detonate in a rolling ripple. Needs room for three mines.',
  accepts: { spells: ['mine'], kinds: [] }, transforms: ['mine'], fx: { mine: 'cluster' },
  art: [
   [1, 2, 10, 3, K], [2, 3, 8, 1, '#7a2a3a'], [2, 2, 8, 1, '#b84a5e'], [2, 4, 8, 1, '#4a1a26'], [1, 2, 3, 3, '#2a0f16'], [5, 3, 1, 1, '#ffd0d8'],
   [11, 1, 6, 5, K], [12, 0, 4, 7, K], [12, 1, 4, 5, '#2a2f3a'], [11, 2, 6, 3, '#2a2f3a'], [13, 2, 2, 3, '#ff5c7a'], [13, 3, 2, 1, '#ffd0d8'], [17, 3, 2, 1, '#e2b24a'], [18, 2, 1, 1, '#ffd23f'], [19, 1, 1, 1, '#ffd23f'], [12, 1, 1, 1, '#6b7385'], [15, 5, 1, 1, '#6b7385']
  ],
  xform(a, c) {
   if (c.sp !== 'mine') return;
   a.wandFx = 'cluster'; a.col = '#ff5c7a';
   a.clusterN = DEMO.n; a.dmg *= DEMO.dmgMul; a.rad *= DEMO.radMul; a.clusterGap = DEMO.gap; a.clusterRipple = DEMO.ripple;
   a.bw = DEMO.bw;
  }
 }
};

// ---- PROVISIONAL numbers for the specialized wands (NOT FINAL BALANCE). `bw` = Bandwidth per successful cast of the transformed attack. ----
// Rough target: a held wand drains about 8-10 BW/s against the shared 6 BW/s regen, i.e. roughly 30-50 s of continuous fire from a full 100 BW.
export const RAIL = { dmgMul: 2.4, rateMul: .7, len: 560, ramp: .3, knock: 90, bw: 14 };      // ping 15 dmg @0.77/s -> 36 dmg @0.54/s, +30% per bug already pierced. ~7.5 BW/s
export const PYRO = { speedMul: .8, rad: 6, blastR: 56, blastMul: .75, bw: 8,                 // fireball: direct hit + 75% blast, then a burn patch. ~8 BW/s
 patch: { r: 40, life: 3, tick: .5, dmgMul: .22, max: 8 } };
export const SWARM = { n: 5, dmgMul: .42, turn: 5.5, speedMul: .8, rad: 3, bw: 5 };            // bolt 7 dmg -> five 2.9 dmg drones. ~9 BW/s at 1.82/s
export const STORM = { fork: 2, shock: .5, dmgMul: 1, bw: 9, cap: 9, reach: 120, falloff: .68 };                                  // chain: branching tree, each hit slows briefly. ~8 BW/s
export const DEMO = { n: 3, dmgMul: .6, radMul: .78, gap: 34, ripple: .14, bw: 8 };             // mine: three 60%-damage mines in a line. ~3.3 BW/s (mine is a slow card)

// Provisional, configurable Cryogenic Stream numbers. NOT FINAL BALANCE.
export const CRYO = {
 dmgMul: 1.15,   // slightly stronger than stdout() per tick (the Universal Wand is the baseline)
 len: 165,       // base reach (stdout cone is 125)
 half: .16,      // half-angle in radians: a narrow stream instead of a wide cone
 bw: 3,          // Bandwidth per stream tick (stdout ticks ~3.3/s)
 frost: { r: 17, life: 3.4, slow: .5, tick: .35, dps: 0, max: 40, spacing: 22 } // floor ice: radius, seconds, enemy speed factor, refresh, cap on patches
};

// ---- Bandwidth (BW) ----------------------------------------------------------------------------------------------------------------------
// Provisional values only: Host capacities are NOT finalized. Every number here is configurable; none is a finished Host stat.
export const BW_CFG = {
 base: 100,                    // fallback capacity
 host: {},                     // per-Host override, e.g. { compiler: 100, threads_rin: 140 } (THREADS is NOT implemented yet)
 min: 1,                       // a Host's capacity can never be configured below this
 cap: 999,                     // hard ceiling on capacity
 bwr: 6                        // BWR: baseline BW regenerated per second. Shared by all Hosts. HIDDEN from the HUD.
};

export const wandOf = id => WANDS[id] || WANDS.universal;

// Is this spell (SPELLS entry) compatible with the wand? Utility ('self') cards always are.
export function wandAccepts(wandId, spellId, spell) {
 const w = wandOf(wandId);
 if (!spell || spell.k === 'self') return true;
 if (w.accepts === 'all') return ATTACK_KINDS.includes(spell.k);
 const A = w.accepts || {};
 return (A.spells || []).includes(spellId) || (A.kinds || []).includes(spell.k);
}

// Human-readable reason shown to the player when a card cannot be fired by the equipped wand.
export const wandBlockText = (wandId, spell) => `${wandOf(wandId).short} cannot fire ${spell?.n || 'this card'}`;

// Apply the wand to compiled stats `a` for pipeline entry `c` ({sp, mods, mv, lv}). Returns `a` (mutated).
export function applyWand(a, c, wandId, spell) {
 const w = wandOf(wandId);
 a.wand = wandId;
 a.blocked = !wandAccepts(wandId, c.sp, spell);
 if (a.blocked) return a;
 if (w.dmgMul && w.dmgMul !== 1 && a.k !== 'self') a.dmg *= w.dmgMul;
 if (w.xform) w.xform(a, c);
 return a;
}

// Effective Bandwidth cost of one execution (0 = free). Cards do not cost BW by being cards: only attacks that carry a `bw` base cost do.
// Pipeline modifiers that repeat a cast (for / fork / recur / overclock) never re-charge: only the main cast is billed (see updCasts).
export function bwCost(a, ST = {}) {
 const base = +a.bw || 0;
 if (base <= 0 || a.blocked) return 0;
 const w = wandOf(a.wand);
 const v = (base * (w.bwMul ?? 1) + (w.bwAdd || 0)) * (a.bwMul ?? 1) * (ST.bwcost ?? 1);
 return Math.max(0, Math.round(v * 100) / 100);
}

export const bwMaxFor = (hostId, ST = {}) => {
 const raw = (BW_CFG.host[hostId] ?? BW_CFG.base) * (ST.bwmax ?? 1) + (ST.bwmaxAdd || 0);
 return Math.min(BW_CFG.cap, Math.max(BW_CFG.min, Math.round(raw)));
};
export const bwRegen = (ST = {}) => Math.max(0, BW_CFG.bwr * (ST.bwr ?? 1));
export const clampBW = (v, max) => Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0;

// ---- Acquisition + storage rules (pure, so they can be unit-checked) --------------------------------------------------------------------
// Chances are provisional and configurable. A source never forces a wand: it only OFFERS one when an unowned wand exists.
export const WAND_ACQ = {
 chest: .35,                   // Treasure Chest: chance that the card choice gains a wand option
 deck: .35,                    // "Deck & Hand" reward category: chance that the choice gains a wand option
 slots: ['four', 'five']       // House Edge (slot machine) hands that also drop a wand. The Cycle payout itself is unchanged.
};
export const specialWands = () => Object.keys(WANDS).filter(id => id !== 'universal');
// Wands that may still be found: not owned and not sitting in Storage (so a duplicate can never be created).
export const wandsOffered = (owned = [], stored = []) => specialWands().filter(id => !owned.includes(id) && !stored.includes(id));
// The Universal Wand can never be stored (it is the permanent fallback), and the equipped wand can never be stored.
export const canStoreWand = (id, equipped, owned = []) => id !== 'universal' && id !== equipped && owned.includes(id);

// Short labels shown in the pipeline preview for transformed attacks.
export const FX_LABEL = { cryo: 'cryogenic stream', rail: 'rail shot', pyro: 'napalm shell + burn patch', swarm: 'drone swarm', storm: 'forking lightning', cluster: 'cluster mines' };
