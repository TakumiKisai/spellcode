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
  d: '', // description is set from EXTRA below (each wand now fires several cards)
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
  d: '', // description is set from EXTRA below (each wand now fires several cards)
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
  d: '', // description is set from EXTRA below (each wand now fires several cards)
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
  d: '', // description is set from EXTRA below (each wand now fires several cards)
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
  d: '', // description is set from EXTRA below (each wand now fires several cards)
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
  d: '', // description is set from EXTRA below (each wand now fires several cards)
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
 base: 200,                    // fallback capacity: 200 for every Host (provisional)
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
 if (w.extra && w.extra[c.sp]) w.extra[c.sp](a, c); // secondary cards this wand also transforms (each with its own unique effect)
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

// ---- Multi-card wands: every specialized wand fires SEVERAL cards, each with its own unique transformation. -----------------------------------
// Reusable on-hit effects (applied inside hitE, so they work for projectiles, beams, chains, nova rings and mine blasts alike):
//   xArc {n,frac,reach}: each hit arcs lightning to the n nearest other bugs (frac of the damage)   xBurnZ {r,life,tick,dmgMul,max}: leaves a burn patch
//   xFrostZ: leaves slowing floor ice                                                                 xPulse {r,frac}: each hit releases a small shockwave
// Delivery overrides read by fire(): swarmN (drones), lob (mortar), ringMines, cascade (concentric rings), k:'beam' (hitscan rail), pull (gravity).
export const EXTRA_FX = {
 arcBolt: { n: 2, frac: .6, reach: 130 }, teslaPing: { n: 2, frac: .5, reach: 140 }, teslaDrone: { n: 2, frac: .6, reach: 110 }, thunder: { n: 2, frac: .6, reach: 120 }, stormOrbit: { n: 1, frac: .7, reach: 110 },
 incendiary: { r: 30, life: 2.2, tick: .5, dmgMul: .18, max: 8 }, napalmMine: { r: 36, life: 2.6, tick: .5, dmgMul: .2, max: 8 },
 relay: { r: 46, frac: .5 }, pulseOrbit: { r: 40, frac: .5 }, emberBurst: { r: 34, frac: .7 }, breach: { r: 56, frac: .6 },
 horizonPull: 170, grapplePull: 360
};
export const ZAP = { every: .3, reach: 95, frac: .35 }; // in-flight lightning: arcing projectiles zap the nearest bug in reach every `every` seconds (frac of their damage)
export const EXTRA_BW = { // provisional BW per successful cast
 frostShell: 6, frostNova: 7, frostBlade: 7, salvo: 11, sniper: 15, incendiary: 5, napalmMine: 7, flameSword: 7, fireBlades: 10, tesla: 7, ember: 6, satellites: 10,
 arcBolt: 6, teslaPing: 8, thunder: 8, stormOrbit: 10, mortar: 9, ringMines: 8, breach: 9, harpoon: 8, skewer: 7, cascade: 7, relay: 8, pulseOrbit: 10,
 inferno: 6, gravWell: 9, horizon: 10, grapple: 7, ricochet: 5, refract: 7, spectrum: 14
};
const swarmish = (a, n, dmgMul) => { a.swarmN = n; a.dmg *= dmgMul; a.pierce = 0; a.home = Math.max(1, a.home || 0); a.turn = Math.max(a.turn || 0, SWARM.turn); a.sp = (a.sp || 0) > 0 ? a.sp * SWARM.speedMul : 260; a.rad = SWARM.rad; a.bounce = 0; };
const lbl = (a, fx, text, col) => { a.wandFx = fx; a.fxLabel = text; if (col) a.col = col; };
const EXTRA = {
 cryomancer: {
  fireball(a) { lbl(a, 'frostshell', 'frost shell: freezes + ice patch', '#7ee8ff'); a.freeze = Math.max(1, a.freeze); a.xFrostZ = 1; a.burn = 0; a.sp *= .9; a.bw = EXTRA_BW.frostShell; },
  nova(a) { lbl(a, 'frostnova', 'frost nova: freezing ring + ice', '#7ee8ff'); a.freeze = Math.max(1, a.freeze); a.xFrostZ = 1; a.burn = 0; a.bw = EXTRA_BW.frostNova; },
  rm(a) { lbl(a, 'frostblade', 'frost blade: freezing sweep, ice underfoot', '#7ee8ff'); a.freeze = Math.max(1, a.freeze); a.xFrostZ = 1; a.bw = EXTRA_BW.frostBlade; }
 },
 railgun: {
  bolt(a) { lbl(a, 'salvo', 'slug salvo: 3 piercing slugs in a train', '#b48cff'); a.salvo = 3; a.pierce = 99; a.sp = 900; a.dmg *= 1.1; a.rate *= .8; a.rad = 3; a.bw = EXTRA_BW.salvo; },
  lance(a) { lbl(a, 'rail', 'sniper rail: one target, damage grows with distance', '#b48cff'); a.k = 'beam'; a.railSnipe = 1; a.railLen = 560; a.railRamp = 0; a.dmg *= 1.2; a.rate *= .85; a.knock = Math.max(a.knock || 0, 60); a.bw = EXTRA_BW.sniper; }
 },
 pyromancer: {
  bolt(a) { lbl(a, 'incend', 'incendiary bolt: burn patches on hit', '#ff7a45'); a.burn = Math.max(1, a.burn || 0); a.xBurnZ = EXTRA_FX.incendiary; a.bw = EXTRA_BW.incendiary; },
  mine(a) { lbl(a, 'napalmmine', 'napalm mine: blast + burn patches', '#ff7a45'); a.burn = Math.max(1, a.burn || 0); a.xBurnZ = EXTRA_FX.napalmMine; a.bw = EXTRA_BW.napalmMine; },
  rm(a) { lbl(a, 'flamesword', 'flame sword: burning sweep, fire on the ground', '#ff7a45'); a.burn = Math.max(1, a.burn || 0); a.xBurnZ = EXTRA_FX.incendiary; a.bw = EXTRA_BW.flameSword; },
  stdout(a) { lbl(a, 'inferno', 'inferno: longer flames, burn patches', '#ff7a45'); a.xBurnZ = EXTRA_FX.incendiary; a.area *= 1.25; a.dmg *= 1.1; a.bw = EXTRA_BW.inferno; },
  orbit(a) { lbl(a, 'fireblades', 'fire blades: burning orbit, fire trail', '#ff7a45'); a.burn = Math.max(1, a.burn || 0); a.xBurnZ = EXTRA_FX.incendiary; a.bw = EXTRA_BW.fireBlades; }
 },
 swarm: {
  chain(a) { lbl(a, 'tesla', 'tesla swarm: drones that arc lightning', '#f4ff6a'); swarmish(a, 4, .5); a.xArc = EXTRA_FX.teslaDrone; a.xZap = ZAP; a.bw = EXTRA_BW.tesla; },
  fireball(a) { lbl(a, 'ember', 'ember swarm: drones burst on contact', '#ff9a5c'); swarmish(a, 6, .3); a.burn = Math.max(1, a.burn || 0); a.xPulse = EXTRA_FX.emberBurst; a.bw = EXTRA_BW.ember; },
  orbit(a) { lbl(a, 'satellites', 'satellites: twice the blades, each weaker', '#9dff7a'); a.orbitMul = 2; a.dmg *= .55; a.bw = EXTRA_BW.satellites; }
 },
 stormcaller: {
  bolt(a) { lbl(a, 'arcbolt', 'arc bolt: hits arc to nearby bugs', '#ffe066'); a.xArc = EXTRA_FX.arcBolt; a.xZap = ZAP; a.bw = EXTRA_BW.arcBolt; },
  ping(a) { lbl(a, 'teslaping', 'tesla beam: arcs from every bug pierced', '#ffe066'); a.xArc = EXTRA_FX.teslaPing; a.dmg *= 1.1; a.bw = EXTRA_BW.teslaPing; },
  rm(a) { lbl(a, 'thunder', 'thunder blade: lightning sword, arcs from each hit', '#ffe066'); a.xArc = EXTRA_FX.thunder; a.area *= 1.3; a.bw = EXTRA_BW.thunder; },
  orbit(a) { lbl(a, 'stormorbit', 'storm orbit: blades arc to nearby bugs', '#ffe066'); a.xArc = EXTRA_FX.stormOrbit; a.bw = EXTRA_BW.stormOrbit; }
 },
 demolitionist: {
  fireball(a) { lbl(a, 'mortar', 'mortar: lobbed, big blast at range', '#ff5c7a'); a.lob = 210; a.lobR = 66; a.lobMul = 1.5; a.pierce = 0; a.burn = 0; a.sp *= .9; a.bw = EXTRA_BW.mortar; },
  nova(a) { lbl(a, 'ringmines', 'ring of 4 mines around you', '#ff5c7a'); a.ringMines = 4; a.dmg *= .55; a.mineR = a.rad * .5; a.bw = EXTRA_BW.ringMines; },
  rm(a) { lbl(a, 'breach', 'breaching slam: every hit detonates', '#ff5c7a'); a.xPulse = EXTRA_FX.breach; a.knock = Math.max(a.knock || 0, 320); a.bw = EXTRA_BW.breach; }
 },
 pulse: {
  orbit(a) { lbl(a, 'pulseorbit', 'pulse orbit: blade hits emit shockwaves', '#5ee0d0'); a.xPulse = EXTRA_FX.pulseOrbit; a.bw = EXTRA_BW.pulseOrbit; }
 }
};
WANDS.pulse = {
 n: 'Pulse Wand', short: 'PULSE', glyph: 'O', col: '#5ee0d0', hue: 170, d: '',
 accepts: { spells: ['nova', 'chain'], kinds: [] }, transforms: ['nova', 'chain'],
 art: [
  [1, 2, 11, 3, K], [2, 3, 9, 1, '#2e8f84'], [2, 2, 9, 1, '#5ee0d0'], [2, 4, 9, 1, '#1d5e57'], [1, 2, 3, 3, '#103a36'], [5, 3, 1, 1, '#d9fffa'], [8, 3, 1, 1, '#d9fffa'],
  [12, 0, 1, 7, K], [13, 1, 1, 5, '#5ee0d0'], [14, 0, 1, 7, K], [15, 1, 1, 5, '#8ff5e8'], [16, 0, 1, 7, K], [17, 1, 1, 5, '#c6fff7'], [13, 3, 1, 1, '#ffffff'], [15, 3, 1, 1, '#ffffff'], [17, 3, 2, 1, '#ffffff']
 ],
 xform(a, c) {
  if (c.sp === 'nova') { lbl(a, 'cascade', 'pulse cascade: 3 concentric shockwaves', '#5ee0d0'); a.cascade = 1; a.rad *= 1.15; a.dmg *= .6; a.bw = EXTRA_BW.cascade; }
  else if (c.sp === 'chain') { lbl(a, 'relay', 'pulse relay: each bug struck emits a shockwave', '#5ee0d0'); a.xPulse = EXTRA_FX.relay; a.bw = EXTRA_BW.relay; }
 }
};
const SIG = { cryomancer: ['stdout'], railgun: ['ping'], pyromancer: ['fireball'], swarm: ['bolt'], stormcaller: ['chain'], demolitionist: ['mine'] }; // cards the original (signature) xforms handle
for (const id in EXTRA) { const x = EXTRA[id], W = WANDS[id], keys = Object.keys(x); W.extra = x; W.accepts = { spells: [...(W.accepts && W.accepts.spells || SIG[id] || []), ...keys.filter(k => !(W.accepts && W.accepts.spells || []).includes(k))], kinds: [] }; W.transforms = [...new Set([...(W.transforms || []), ...keys])]; }

// ---- Wands built around several cards from the start ----
WANDS.lancer = {
 n: 'Lancer Wand', short: 'LANCER', glyph: '>', col: '#8fd0ff', hue: 205, d: '',
 accepts: { spells: ['lance', 'ping'], kinds: [] }, transforms: ['lance', 'ping'],
 art: [
  [0, 2, 12, 3, K], [1, 3, 11, 1, '#5f7aa8'], [1, 2, 11, 1, '#9fb4d6'], [1, 4, 11, 1, '#3b4d70'], [0, 2, 3, 3, '#26324a'], [4, 3, 1, 1, '#e4ecfa'], [8, 3, 1, 1, '#e4ecfa'],
  [12, 1, 2, 5, '#e2b24a'], [13, 0, 1, 7, K], [14, 2, 3, 3, '#8fd0ff'], [14, 1, 2, 1, '#8fd0ff'], [14, 5, 2, 1, '#8fd0ff'], [17, 3, 2, 1, '#e8f6ff'], [19, 3, 1, 1, '#ffffff'], [16, 2, 2, 1, '#e8f6ff'], [16, 4, 2, 1, '#e8f6ff']
 ],
 xform(a, c) {
  if (c.sp === 'lance') { lbl(a, 'harpoon', 'harpoon: pierces + pulls bugs in', '#8fd0ff'); a.pierce = 99; a.pull = Math.max(2, a.pull || 0); a.dmg *= 1.1; a.bw = EXTRA_BW.harpoon; }
  else if (c.sp === 'ping') { lbl(a, 'skewer', 'skewer: beam that drags bugs back', '#8fd0ff'); a.pull = Math.max(1, a.pull || 0); a.dmg *= 1.1; a.bw = EXTRA_BW.skewer; }
 }
};
WANDS.gravity = {
 n: 'Singularity Wand', short: 'SINGULARITY', glyph: '@', col: '#8a6bff', hue: 255, d: '',
 accepts: { spells: ['nova', 'orbit', 'rm'], kinds: [] }, transforms: ['nova', 'orbit', 'rm'],
 art: [
  [1, 2, 11, 3, K], [2, 3, 9, 1, '#3a2f77'], [2, 2, 9, 1, '#6c55d8'], [2, 4, 9, 1, '#231b4d'], [1, 2, 3, 3, '#140f2e'], [5, 3, 1, 1, '#c9bcff'], [8, 3, 1, 1, '#c9bcff'],
  [13, 1, 5, 5, K], [14, 0, 3, 7, K], [14, 1, 3, 5, '#0a0714'], [13, 2, 5, 3, '#0a0714'], [14, 2, 3, 3, '#000000'], [13, 3, 1, 1, '#8a6bff'], [17, 3, 1, 1, '#8a6bff'], [15, 1, 1, 1, '#b9a6ff'], [15, 5, 1, 1, '#b9a6ff'], [12, 3, 1, 1, '#8a6bff'], [18, 3, 2, 1, '#b9a6ff']
 ],
 xform(a, c) {
  if (c.sp === 'nova') { lbl(a, 'gravwell', 'gravity well: drags bugs in, then crushes', '#8a6bff'); a.gravity = 1; a.knock = 0; a.dmg *= 1.15; a.bw = EXTRA_BW.gravWell; }
  else if (c.sp === 'orbit') { lbl(a, 'horizon', 'event horizon: blades drag bugs in', '#8a6bff'); a.xPull = EXTRA_FX.horizonPull; a.bw = EXTRA_BW.horizon; }
  else if (c.sp === 'rm') { lbl(a, 'grapple', 'grapple sweep: yanks the whole arc toward you', '#8a6bff'); a.xPull = EXTRA_FX.grapplePull; a.knock = 0; a.bw = EXTRA_BW.grapple; }
 }
};
WANDS.prism = {
 n: 'Prism Wand', short: 'PRISM', glyph: '<', col: '#ff9ae8', hue: 315, d: '',
 accepts: { spells: ['bolt', 'fireball', 'lance'], kinds: [] }, transforms: ['bolt', 'fireball', 'lance'],
 art: [
  [1, 2, 10, 3, K], [2, 3, 8, 1, '#a24d90'], [2, 2, 8, 1, '#ff9ae8'], [2, 4, 8, 1, '#6b2d5e'], [1, 2, 3, 3, '#3d1736'], [5, 3, 1, 1, '#ffe6f8'], [8, 3, 1, 1, '#ffe6f8'],
  [11, 3, 2, 1, '#ffe6f8'], [13, 1, 1, 5, K], [14, 0, 1, 7, K], [14, 1, 3, 5, '#ff9ae8'], [15, 2, 3, 3, '#ffffff'], [15, 3, 2, 1, '#8ff5ff'], [17, 0, 2, 2, '#ff9ae8'], [17, 5, 2, 2, '#9fe0ff'], [18, 3, 2, 1, '#fff2a8'], [16, 1, 1, 1, '#fff2a8'], [16, 5, 1, 1, '#c9ffd0']
 ],
 xform(a, c) {
  if (c.sp === 'bolt') { lbl(a, 'ricochet', 'ricochet bolt: bounces off walls 4x', '#ff9ae8'); a.bounce = Math.max(a.bounce || 0, 4); a.bw = EXTRA_BW.ricochet; }
  else if (c.sp === 'fireball') { lbl(a, 'refract', 'refractor: splits in two on every hit', '#ff9ae8'); a.pierce = 0; a.dmg *= .9; a.bw = EXTRA_BW.refract; }
  else if (c.sp === 'lance') { lbl(a, 'spectrum', 'spectrum lance: fan of three lances', '#ff9ae8'); a.pc = Math.max(a.pc || 1, 3); a.dmg *= .55; a.bw = EXTRA_BW.spectrum; }
 }
};

// ---- Compact per-card descriptions (shown as "Compatibility" lists in the equipment panel, reward cards and Storage) ----
export const CARD_DESC = {
 universal: { '*': 'normal attacks, no changes' },
 cryomancer: { stdout: 'icy stream, freezes the floor', fireball: 'frost shell, freezes + ices ground', nova: 'freezing ring, ices ground', rm: 'frost blade, freezing sweep' },
 railgun: { ping: 'rail shot, ramps per bug pierced', bolt: 'salvo of 3 piercing slugs', lance: 'sniper rail, 1 target, more dmg at range' },
 pyromancer: { fireball: 'napalm shell + burn patch', bolt: 'ignites, burn patches on hit', mine: 'napalm mine, burn patches', rm: 'flame sword, fire on the ground', orbit: 'fire blades, burning orbit', stdout: 'inferno: longer flames, burn patches' },
 swarm: { bolt: 'cloud of homing drones', chain: 'tesla drones that arc lightning', fireball: 'ember drones burst on contact', orbit: 'satellites: 2x blades, weaker' },
 stormcaller: { chain: 'forking lightning tree', bolt: 'arc bolt, hits jump to nearby', ping: 'tesla beam, arcs from each bug', rm: 'thunder blade, arcing sword', orbit: 'storm orbit, blades arc' },
 demolitionist: { mine: 'row of 3 ripple mines', fireball: 'mortar lob, big blast', nova: 'ring of 4 mines', rm: 'breaching slam, hits detonate' },
 lancer: { lance: 'harpoon, pierces + pulls bugs in', ping: 'skewer beam, drags bugs back' },
 pulse: { nova: '3 concentric shockwaves', chain: 'each bug struck emits a shockwave', orbit: 'blade hits emit shockwaves' },
 gravity: { nova: 'gravity well: pulls in, then crushes', orbit: 'event horizon: blades pull bugs in', rm: 'grapple sweep: yanks the arc to you' },
 prism: { bolt: 'ricochet bolt, bounces 4x', fireball: 'refractor: splits on every hit', lance: 'spectrum lance: fan of 3' }
};
export const wandCompat = id => Object.entries(CARD_DESC[id] || {}).map(([k, t]) => [k === '*' ? 'all attack cards' : k + '()', t]);
for (const id in WANDS) WANDS[id].d = wandCompat(id).map(([k, t]) => k + ' : ' + t).join('; '); // short tooltip text
