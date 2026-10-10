import { W, H, GW, GH, PLAN, CHAOS } from './constants.js';
import { RAR, RC, SPELLS, MODS, UPG, HOSTS, DK, WORLDS, EN, ARENAS, BOSSES } from './data.js';
import { $, ri, pick, cl, shuffle, css, mk, defOf, isMod, maxV, okMod, wo, xText, xl, cardH } from './helpers.js';
import { renderOSWindows } from './probability.js';
import { snd, ensureMusicContext, preloadMusic, stopMusic, setMusic, MUTE, setMute, VOL, applyVolumes } from './audio.js';
import { wallHit, hazAt, mv, near, compilePipeline, stats, lineOf, drawBG } from './combat.js';

let META = { best: 0, wins: 0 };
try { META = { ...META, ...JSON.parse(localStorage.getItem('spellcode_meta') || '{}') }; } catch (e) {}
let SET = { shake: 1, dmg: 1, q: 2, cc: 2, pt: 1, gw: 3, fl: 2, ef: 1, vm: 1, vmu: 1, vs: 1, ...(META.set || {}) };
VOL.master = SET.vm; VOL.music = SET.vmu; VOL.sfx = SET.vs;
const GLOW = [0, .3, .65, 1]; // off / low / medium / high
const SETS = {
 shake: ['Screen shake', [0, .5, 1], ['off', 'half', 'full']],
 dmg: ['Damage numbers', [0, 1], ['off', 'on']],
 q: ['Effects quality', [0, 1, 2], ['low', 'med', 'high']],
 cc: ['Cast display', [0, 1, 2], ['off', 'compact', 'cards']],
 pt: ['Particles', [0, 1], ['off', 'on']],
 gw: ['Glow (projectiles, stdout, etc.)', [0, 1, 2, 3], ['off', 'low', 'medium', 'high']],
 fl: ['Flame detail', [0, 1, 2], ['off', 'simple', 'full']],
 ef: ['Flames on enemy bullets', [0, 1], ['off', 'on']]
};
const SLIDERS = [['vm', 'Master volume'], ['vmu', 'Music volume'], ['vs', 'Effects volume']];
const sliderH = ([k, t]) => `<label class="set-row"><span>${t}</span><input type="range" min="0" max="100" value="${Math.round(SET[k] * 100)}" data-vol="${k}"><b id="vol-${k}">${Math.round(SET[k] * 100)}%</b></label>`;
const settingsBody = () => `
 <div class="set-sec">SOUND</div>
 <div class="set-row"><span>Sound</span><button class="btn g" data-act="mute">${MUTE ? 'off' : 'on'}</button></div>
 ${SLIDERS.map(sliderH).join('')}
 <div class="set-sec">GRAPHICS</div>
 ${['q', 'pt', 'gw', 'fl', 'ef'].map(k => `<div class="set-row"><span>${SETS[k][0]}</span>${setBtn(k).replace(SETS[k][0] + ': ', '')}</div>`).join('')}
 <div class="set-sec">GAMEPLAY</div>
 ${['shake', 'dmg', 'cc'].map(k => `<div class="set-row"><span>${SETS[k][0]}</span>${setBtn(k).replace(SETS[k][0] + ': ', '')}</div>`).join('')}
 <p style="color:var(--mute);font-size:10.5px;margin:10px 0 0">Lower the graphics options if the game feels laggy. Changes save automatically.</p>
`;
const settingsSpec = { key: 'settings', icon: '⚙️', title: 'SETTINGS', renderBody: settingsBody };
const setBtn = k => {
 const t = SETS[k];
 return `<button class="btn g" data-set="${k}">${t[0]}: ${t[2][t[1].indexOf(SET[k])]}</button>`;
};
const saveMeta = () => {
 try { localStorage.setItem('spellcode_meta', JSON.stringify(META)); } catch (e) {}
};
const epicOK = () => META.best >= 3 || META.wins > 0;
const legOK = () => META.best >= 6 || META.wins > 0;

let topZ = 120;
const defaultWindows = () => ({
 draw: { open: false, min: false, max: false, x: 26, y: 50, z: 101 },
 disc: { open: false, min: false, max: false, x: 74, y: 84, z: 102 },
 deck: { open: false, min: false, max: false, x: 122, y: 118, z: 103 },
 settings: { open: false, min: false, max: false, x: 60, y: 70, z: 104 }
});

let G = { view: 'title', host: 'debugger', modal: null, windows: defaultWindows(), sh: 30 }, R = null, ST = {}, keys = {}, joy = null, dashReq = false;

function calcST() {
 const h = HOSTS[G.host];
 const s = {
  dmg: 1, cd: 1, spd: 1, hpa: 0, hpm: 1, shmax: 30, shm: 1, hm: 1,
  crit: 0, dashcd: 1, gc: 0, rh: .2, mv: 0, still: 0, slots: 0, hand: 0,
  chaos: 0, regen: 0, recur: 0, over: 0, glass: 0, par: 0, proxy: 0,
  leak: 0, stack: 0, nullref: 0, panic: 0, fork: 0
 };
 h.f(s);
 s.slots += G.xs || 0;
 s.hand += G.xh || 0;
 for (const k in G.u) for (let i = 0; i < G.u[k]; i++) UPG[k]?.f?.(s);
 ST = s;
 const old = G.max || 0;
 G.max = Math.round((h.hp + s.hpa) * s.hpm);
 if (G.hp != null) G.hp = cl(G.hp + Math.max(0, G.max - old), 1, G.max);
 if (G.sh == null) G.sh = ST.shmax;
}
const nSlots = () => 4 + ST.slots;
const hu = k => G.u[k] || 0;
const hostOpen = k => {
 const h = HOSTS[k];
 return !h.lt || (h.lt === 'Win a run' ? META.wins > 0 : META.best >= 4) || (META.own || {})[k];
};

function bossTrack(b) { return b === 'runtime' ? 'runtime' : b === 'leak' ? 'leak' : 'segfault'; }
function worldTrack(w) {
 if (w === WORLDS.boot) return 'boot';
 if (w === WORLDS.deadlock) return 'deadlock';
 if (w === WORLDS.heap) return 'heap';
 if (w === WORLDS.null) return 'null';
 if (w === WORLDS.kernel) return 'kernel';
 if (w?.gen) { w.music = w.music || pick(['generated', 'generated1']); return w.music; }
 return 'title';
}
function musicTrack() {
 if (G.cfg?.boss && (G.view === 'reward' || (G.view === 'run' && R && R.end && R.bossDead))) return '';
 if (G.view === 'title') return 'title';
 if (G.view === 'win') return 'win';
 if (G.view === 'over') return 'gameover';
 if (G.view === 'result-load') return G.resultWin ? 'win' : 'gameover';
 if (G.view === 'result') return G.resultWin ? 'win' : 'gameover';
 if (G.view === 'run') {
  if (G.cfg?.boss) return bossTrack(G.cfg.boss);
  // Overtime is a per-round timer, not cumulative run time.
  if (R && R.t >= 70) return 'overtime';
 }
 if (G.world) return worldTrack(G.world);
 return 'title';
}
let RUNTIME_INITIALIZED = false;
export function syncMusic() {
 if (sectorLoading || !RUNTIME_INITIALIZED) { stopMusic(.08); return; }
 setMusic(musicTrack());
}

function genWorld() {
 const h = ri(360);
 return {
  n: pick(['Buffer', 'Orphan', 'Stale', 'Zombie', 'Race', 'Stack', 'Dangling']) + ' ' + pick(['Underflow', 'Thread', 'Socket', 'Pipeline', 'Process', 'Condition', 'Mutex']),
  g: pick(['<>', '//', '~', '%%', '$_']),
  c: ['hsl(' + h + ',85%,68%)', 'hsl(' + (h + 50) % 360 + ',75%,48%)'],
  ar: shuffle(Object.keys(ARENAS)).slice(0, 4),
  gen: 1
 };
}

// Draw & Discard Flow
export function drawN(n) {
 while (n--) {
  if (!G.draw.length) {
   G.draw = shuffle([...G.disc]);
   G.disc = [];
  }
  if (!G.draw.length) break;
  G.hand.push(G.draw.pop());
 }
}

export function newRun() {
 G = {
  ...G, view: 'draft', round: 1, u: {}, deck: [], draw: [], disc: [], hand: [],
  slots: [], kills: 0, xs: 0, xh: 0, time: 0, hp: null, max: 0, sh: 30, lastArena: '',
  last: [], modal: null, redrawUsed: 0, windows: defaultWindows()
 };
 calcST();
 G.hp = G.max;
 G.sh = ST.shmax;
 // UNO-style starting deck: populate from host.start
 HOSTS[G.host].start.split(' ').forEach(k => {
  const c = mk(k, 1);
  G.deck.push(c);
 });
 G.draw = shuffle([...G.deck]);
 G.sector = 1; G.layer = 1; G.round = 1; G.world = WORLDS.boot; G.dm = 1; G.rb = 0;
 G.visited = ['boot']; G.cat = null;
 if (!hostOpen(G.host)) G.host = 'debugger';
 beginSectorLoad(WORLDS.boot, () => prepRound(), true);
}

function genRound(i) {
 const L = G.layer, boss = L === 5 ? (G.sector === 4 ? 'runtime' : pick(['segfault', 'leak'])) : null, k = boss ? 'fb' : (L === 2 || L === 4) ? 'e' : 'n';
 const ar = boss ? BOSSES[boss].arena : pick(G.world.ar.filter(a => a !== G.lastArena));
 G.lastArena = ar;
 return { i, k, boss, arena: ar, budget: Math.min(5 + 2.2 * i, 36), elite: false };
}
function worldOpts() {
 const pool = shuffle(Object.keys(WORLDS).filter(k => k !== 'boot' && k !== 'kernel' && !G.visited.includes(k))), take = () => pool.length ? WORLDS[pool.pop()] : genWorld();
 return [{ w: take(), m: 'easy' }, { w: take(), m: 'std' }, { w: take(), m: 'hard' }];
}
function advance() {
 G.layer++; G.round++;
 if (G.layer > 5) {
  G.sector++; G.layer = 1;
  G.sh = ST.shmax; // All hosts regenerate shield when reaching the next sector!
  if (G.sector === 4) {
   G.world = WORLDS.kernel; G.dm = 1.1; G.rb = 0;
  } else {
   G.view = 'world'; G.opts = worldOpts(); render(); return;
  }
 }
 prepRound();
}

function prepRound() {
 G.cfg = genRound(G.round);
 if (G.cfg.boss) preloadMusic(bossTrack(G.cfg.boss));
 if (G.cfg.k === 'e') { G.view = 'choice'; render(); } else draft();
}

const chime = () => [523, 659, 784].forEach((f, j) => setTimeout(() => snd(f, .14, 'triangle', .05), j * 70));
function dbl(id) { const n = Date.now(), r = G.lc && G.lc.id === id && n - G.lc.t < 400; G.lc = { id, t: n }; return r; }
function leave(c) { const lk = c.lk; c.lk = 0; (lk ? G.disc : G.hand).push(c); return lk; }
const handDraw = () => Math.max(3, 6 + ST.hand - Math.floor(G.slots.length / 2));

function slotClick(i) {
 const c = G.slots[i]; if (!c) return;
 const nm = defOf(c.k).n, dc = dbl(c.id), s = G.sel;
 if (dc && !G.fm) {
  const h = s && s.z === 'h' && G.hand.find(x => x.id === s.id);
  if (h) { G.hand.splice(G.hand.indexOf(h), 1); G.slots[i] = h; } else G.slots.splice(i, 1);
  G.msg = leave(c) ? nm + ' stored in Recycle Bin.' : '';
  G.sel = 0; G.lc = 0; render(); return;
 }
 if (G.fm === 'f') {
  const h = G.fs && G.hand.find(x => x.id === G.fs);
  if (h) {
   const ok = fuseCards(c, h);
   G.msg = ok ? 'Fused! v' + c.v + ': ' + (xText(c.k, c.v) || 'stronger') : fuseFailMsg(h, c);
   if (ok) { G.fz = c.id; chime(); }
   G.fs = 0;
  } else G.msg = 'Tap a hand card first, then a matching pipeline card.';
  render(); G.fz = 0; return;
 }
 if (G.fm === 'u') {
  G.msg = unfuseCard(c) ? 'Split ' + nm + '.' : 'Nothing to unfuse.'; render(); return;
 }
 if (s && s.z === 'h') {
  const h = G.hand.find(x => x.id === s.id);
  if (h) {
   if (c.lk) { G.msg = 'Double-tap ' + nm + ' to swap it out (it moves to the Recycle Bin).'; render(); return; }
   G.hand.splice(G.hand.indexOf(h), 1); G.slots[i] = h; leave(c); G.sel = 0; G.msg = ''; render(); return;
  }
 }
 if (s && s.z === 's') {
  const j = G.slots.findIndex(x => x.id === s.id);
  if (j >= 0 && j !== i) {
   const m = G.slots.splice(j, 1)[0]; G.slots.splice(i, 0, m); G.sel = 0; G.msg = ''; render(); return;
  }
 }
 G.sel = s && s.id === c.id ? 0 : { z: 's', id: c.id };
 G.msg = G.sel ? 'Tap another pipeline card to move this card to that spot, an empty slot to move to the end, or a hand card to replace it. Double-tap to remove.' : '';
 render();
}

// Persistent pipeline + draw flow
export function draft() {
 G.view = 'draft';
 G.fm = 0; G.fs = 0; G.msg = ''; G.modal = null; G.redrawUsed = 0;
 G.sel = 0; G.lc = 0;

 // Persistent pipeline: slots stay intact across rounds!
 // Discard remaining hand cards from previous round to disc
 if (G.hand.length) {
  G.disc.push(...G.hand);
  G.hand = [];
 }

 drawN(handDraw());

 // Guarantee: ensure player has at least one damaging attack in hand or pipeline
 const hasAtkInPipeline = G.slots.some(c => SPELLS[c.k]?.dmg);
 const hasAtkInHand = G.hand.some(c => SPELLS[c.k]?.dmg);
 if (!hasAtkInPipeline && !hasAtkInHand) {
  const src = [G.draw, G.disc].find(a => a.some(c => SPELLS[c.k]?.dmg));
  if (src) {
   const idx = src.findIndex(c => SPELLS[c.k]?.dmg);
   const [dmgCard] = src.splice(idx, 1);
   const returned = G.hand.pop();
   if (returned) src.push(returned);
   G.hand.unshift(dmgCard);
  }
 }
 render();
}

// Fusing rules: upgrades version, preserves it permanently in G.deck
const isCommon = k => !(defOf(k).r > 0);
const fuseFailMsg = (a, c) => (a && c && a.k === c.k) ? (isCommon(a.k) && (a.v || 1) !== (c.v || 1) ? 'Common cards only fuse with the same version.' : 'Max version reached (max v3).') : 'Cards must match.';
export function fuseCards(a, c) {
 if (!a || !c || a === c || a.k !== c.k) return false;
 const av = a.v || 1, cv = c.v || 1;
 if (isCommon(a.k)) {
  // Common (white) cards fuse by matching version: v1+v1 = v2, v2+v2 = v3.
  if (av !== cv || av + 1 > maxV(c.k)) return false;
  a.v = av + 1;
 } else {
  // Uncommon and above: additive (lance v1 + lance v1 = v2, + another v1 = v3).
  if (av + cv > maxV(c.k)) return false;
  a.v = av + cv;
 }
 for (const arr of [G.deck, G.draw, G.disc, G.hand, G.slots]) {
  const i = arr.indexOf(c);
  if (i >= 0) arr.splice(i, 1);
 }
 return true;
}

export function unfuseCard(c) {
 if ((c.v || 1) < 2) return false;
 c.v--;
 const n = mk(c.k, isCommon(c.k) ? c.v : 1); // common v3 -> two v2, v2 -> two v1; others split off a single v1
 G.deck.push(n);
 G.hand.push(n);
 return true;
}

function clearRound() {
 if (G.view !== 'run') return;
 snd(520, .3, 'triangle', .06, 400);
 G.hp = Math.min(G.max, G.hp + G.max * ST.rh);
 G.sh = Math.max(0, R && R.p ? R.p.sh : (G.sh != null ? G.sh : ST.shmax));
 if (ST.regen) G.sh = ST.shmax; // Debugger regens shield between rounds; other hosts preserve what they have until next sector!
 // Persistent pipeline: slots stay intact! Hand is cleared into discard
 G.disc.push(...G.hand);
 G.hand = [];
 if (G.round >= PLAN.length) { endRun(true); return; }
 G.cat = null; G.offers = null; G.view = 'reward'; render();
}

function captureRunResult(win) {
 const rows = (R?.damageByCard || []).map(x => ({ ...x }));
 rows.sort((a, b) => b.dmg - a.dmg);
 const roundsCleared = win ? PLAN.length : Math.max(0, G.round - 1);
 G.resultWin = !!win;
 G.resultStats = {
  win: !!win,
  kills: G.kills || 0,
  roundsCleared,
  roundsTotal: PLAN.length,
  time: R?.t || G.time || 0,
  damageTotal: R?.damageTotal || 0,
  damageTaken: R?.damageTaken || 0,
  castsExecuted: R?.castsExecuted || 0,
  topCards: rows.slice(0, 3)
 };
}
function endRun(win) {
 if (G.view !== 'run') return;
 if (R) R.end = 1;
 captureRunResult(win);
 G.view = 'result-load';
 META.best = Math.max(META.best, G.round);
 if (win) META.wins++;
 G.gain = Math.floor(G.kills / 8) + G.round * 2 + (win ? 30 : 0);
 META.commits = (META.commits || 0) + G.gain;
 saveMeta();
 stopMusic(.45);
 preloadMusic(win ? 'win' : 'gameover');
 render();
}

function rollRarity() {
 const i = G.round, c = G.cfg;
 let w = c.boss ? [0, 0, 50, 35, 15] : c.elite ? [0, 35, 42, 18, 5] : [Math.max(10, 58 - 6 * i), 30, 10 + 3 * i, 2 + 2 * i, i >= 4 ? 1 + i * .6 : 0];
 let t = w.reduce((a, b) => a + b), r = Math.random() * t, k = 0;
 for (; k < 4 && r >= w[k]; k++) r -= w[k];
 if (!legOK()) k = Math.min(k, 3);
 if (!epicOK()) k = Math.min(k, 2);
 return k;
}
function rollRewards(cat) {
 const n = G.cfg.rmode === 'h' ? 2 : 3, bonus = (G.cfg.rmode === 'o' ? 1 : 0) + (G.rb || 0);
 if (cat === 'd') return shuffle(Object.keys(DK).filter(k => k !== 'slot' || (G.xs || 0) < 2)).slice(0, n).map(k => ({ t: 'd', k }));
 if (cat === 'u') {
  const avail = Object.keys(UPG).filter(k => hu(k) < UPG[k].m);
  const maxR = legOK() ? 4 : epicOK() ? 3 : 2;
  const eligible = avail.filter(k => (UPG[k].r || 0) <= maxR);
  const pool = shuffle(eligible.length ? eligible : avail);
  const out = [];
  for (let j = 0; j < Math.min(n, pool.length); j++) {
   out.push({ t: 'u', k: pool[j] });
  }
  if (!out.length) return [{ t: 'd', k: 'heal' }, { t: 'd', k: 'hand' }];
  return out;
 }
 const out = [];
 for (let j = 0; j < n; j++) {
  let r = Math.min(legOK() ? 4 : epicOK() ? 3 : 2, rollRarity() + (j === 0 ? bonus : 0)), it = null;
  for (; r >= 0 && !it; r--) {
   const pool = [...Object.keys(SPELLS), ...Object.keys(MODS)].filter(k => defOf(k).r === r);
   const f = pool.filter(k => !out.some(o => o.k === k));
   if (f.length) it = { t: 'c', k: pick(f) };
  }
  if (!it) it = { t: 'c', k: 'for' };
  out.push(it);
 }
 return out;
}
export function rollFreshCard() {
 const maxR = Math.min(legOK() ? 4 : epicOK() ? 3 : 2, rollRarity());
 for (let r = maxR; r >= 0; r--) {
  const pool = [...Object.keys(SPELLS), ...Object.keys(MODS)].filter(k => defOf(k).r === r);
  if (pool.length) return mk(pick(pool), 1);
 }
 return mk('for', 1);
}

export function recycleCards(cardsToDelete) {
 if (!cardsToDelete || !cardsToDelete.length) return;
 const count = cardsToDelete.length;
 for (const c of cardsToDelete) {
  const idxDisc = G.disc.indexOf(c);
  if (idxDisc >= 0) G.disc.splice(idxDisc, 1);
  const idxDeck = G.deck.indexOf(c);
  if (idxDeck >= 0) G.deck.splice(idxDeck, 1);
 }
 const freshNames = [];
 for (let i = 0; i < count; i++) {
  const fresh = rollFreshCard();
  G.deck.push(fresh);
  G.draw.push(fresh);
  freshNames.push(defOf(fresh.k).n);
 }
 [392, 523, 659, 784].forEach((f, j) => setTimeout(() => snd(f, .12, 'triangle', .05), j * 60));
 G.msg = `♻️ Recycled ${count} card${count > 1 ? 's' : ''}! Added ${count} fresh card${count > 1 ? 's' : ''} to Draw Pile: ${freshNames.join(', ')}.`;
 render();
}

function takeReward(o) {
 if (o.t === 'c') {
  const c = mk(o.k);
  G.deck.push(c);
  G.disc.push(c);
 } else if (o.t === 'u') {
  G.u[o.k] = hu(o.k) + 1;
 } else if (o.k === 'slot') G.xs = (G.xs || 0) + 1;
 else if (o.k === 'hand') G.xh = (G.xh || 0) + 1;
 else G.hp = Math.min(G.max, G.hp + G.max * .5);
 calcST();
 snd(600, .15, 'triangle', .06, 300);
 advance();
}

// Arena / Combat Simulation
let PW = 0;
function freeSpot(arena) {
 for (const [x, y] of [[320, 300], [320, 200], [320, 335], [200, 200], [440, 200], [320, 60], [100, 200], [540, 200]]) {
  if (!wallHit(arena, x, y, 14) && !hazAt(arena, x, y)) return { x, y };
 }
 return { x: 320, y: 200 };
}
function spawnPos(arena, px, py) {
 for (let i = 0; i < 25; i++) {
  const s = ri(4), x = s < 2 ? 36 + Math.random() * 568 : s === 2 ? 36 : 604, y = s < 2 ? (s ? 364 : 36) : 36 + Math.random() * 328;
  if (!wallHit(arena, x, y, 16) && !hazAt(arena, x, y) && Math.hypot(x - px, y - py) > 190) return [x, y];
 }
 return [320, 50];
}

function fight() {
 G.slots.forEach(c => c.lk = 1);
 const c = G.cfg;
 G.last = [...G.slots];
 G.view = 'run';
 render();
 const startSh = G.sh != null ? G.sh : ST.shmax;
 R = {
  t: 0, end: 0, p: { ...freeSpot(c.arena), vx: 0, vy: 0, inv: .5, dash: 0, dcd: 0, nod: 0, fx: 0, fy: -1, sh: startSh, mov: 0, orb: null },
  en: [], pr: [], eb: [], tg: [], ps: [], tx: [], fx: [], lines: [], ht: [],
  casts: compilePipeline(G.slots, ST).out.map((cc, i) => ({
   c: cc, id: i, label: castLabel(cc), t: .4, pend: 0, bt: 0, n: 0, dis: 0, cdm: 1, cds: stats(cc, ST).cd
  })),
  damageByCard: [], damageTotal: 0, damageTaken: 0, castsExecuted: 0,
  spT: .5, budget: c.boss ? 0 : c.budget, gh: [], shake: 0, flash: 0, banner: null, emul: 1, fdT: 0,
  hasW: ARENAS[c.arena].w.length > 0,
  blk: Array.from({ length: GW * GH }, (_, i) => wallHit(c.arena, (i % GW) * 20 + 10, (i / GW | 0) * 20 + 10, 14)),
  boss: c.boss, bossDead: 0,
  col: { pan: css('--panel'), ink: css('--ink'), mu: css('--mute'), mult: css('--mult'), chip: css('--chip'), gold: css('--gold') }
 };
 R.bg = document.createElement('canvas'); R.bg.width = W; R.bg.height = H;
 drawBG(R.bg.getContext('2d'), R.col, ARENAS[c.arena], G.world);

 if (c.boss) spawnBoss();
 else {
  const fp = () => {
   for (let i = 0; i < 40; i++) {
    const x = 60 + Math.random() * 520, y = 60 + Math.random() * 280;
    if (!wallHit(c.arena, x, y, 16) && !hazAt(c.arena, x, y) && Math.hypot(x - R.p.x, y - R.p.y) > 140) return { x, y };
   }
   return { x: 320, y: 60 };
  };
  R.term = { ...fp(), p: 0 };
  R.pk = [fp(), fp(), fp()];
 }
 if (c.elite) {
  const k = pick(Object.keys(EN).filter(kk => EN[kk].from <= c.i && kk !== 'swarm'));
  const [x, y] = spawnPos(c.arena, R.p.x, R.p.y);
  const e = spawnE(k, x, y, { hm: 3.2, dm: 1.3, rs: 1.4 });
  e.elite = 1;
  if (Math.random() < .5) e.sp *= 1.3; else e.blast = 1;
  R.banner = { t: 2, s: 'ELITE: ' + k.toUpperCase() };
 }

 const cv = $('#cv');
 R.fs = W / (cv.getBoundingClientRect().width || W);
 cv.onpointerdown = e => {
  cv.setPointerCapture(e.pointerId);
  const rc = cv.getBoundingClientRect(), sc = W / rc.width;
  joy = { ox: e.clientX, oy: e.clientY, x: 0, y: 0, sc, cx: (e.clientX - rc.left) * sc, cy: (e.clientY - rc.top) * sc };
 };
 cv.onpointermove = e => {
  if (joy) {
   const dx = e.clientX - joy.ox, dy = e.clientY - joy.oy, l = Math.hypot(dx, dy) || 1, k = Math.min(1, l / 36);
   joy.x = dx / l * k; joy.y = dy / l * k;
  }
 };
 cv.onpointerup = cv.onpointercancel = () => joy = null;
 const db = $('#dash');
 if (db) db.onpointerdown = e => { e.stopPropagation(); dashReq = true; };

 const ctx = cv.getContext('2d'), mine = R;
 {
  // Glow / shadow setting: scales every shadowBlur used by the game's drawing code.
  const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx), 'shadowBlur');
  if (d && d.set && !ctx.__glow) { ctx.__glow = 1; Object.defineProperty(ctx, 'shadowBlur', { get() { return d.get.call(ctx); }, set(v) { d.set.call(ctx, v * GLOW[SET.gw]); }, configurable: true }); }
 }
 let last = performance.now();
 const loop = now => {
  if (R !== mine || G.view !== 'run') return;
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  if (!R.end) {
   R.t += dt; G.time += dt;
   step(dt);
  }
  draw(ctx);
  requestAnimationFrame(loop);
 };
 requestAnimationFrame(loop);
}

function spawnE(k, x, y, o = {}) {
 const t = EN[k], i = G.cfg.i, hp = Math.round(t.hp * (1 + .11 * (i - 1)) * (G.dm || 1) * (o.hm || 1));
 const e = { ...t, k, hp, max: hp, dmg: Math.round(t.dmg * (1 + .03 * (i - 1)) * Math.sqrt(G.dm || 1) * (o.dm || 1)), x, y, r: t.r * (o.rs || 1), kx: 0, ky: 0, fl: 0, slow: 0, burn: 0, bd: 0, prot: 1, st: 0, tm: 1.2 + Math.random() * 1.5, vuln: 0, oc: 0 };
 if (wallHit(G.cfg.arena, e.x, e.y, e.r)) { const q = spawnPos(G.cfg.arena, R.p.x, R.p.y); e.x = q[0]; e.y = q[1]; }
 if (PW) e.ghost = 1;
 R.en.push(e);
 return e;
}
function spawnBoss() {
 const b = BOSSES[G.cfg.boss], bh = Math.round(b.hp * (1 + .035 * (G.cfg.i - 1)) * (G.dm || 1));
 const e = spawnE('chaser', 320, 70);
 Object.assign(e, { boss: 1, g: b.g, c: b.c, hp: bh, max: bh, sp: b.sp, r: b.r, dmg: 14, ph: 0, pt: {}, beh: 'boss', bd0: b, gt: 0, projShape: G.cfg.boss });
 R.banner = { t: 2.4, s: 'WARNING: ' + b.n };
 snd(80, .8, 'sawtooth', .08, 40);
}

function part(x, y, vx, vy, l, c, s, fl) {
 if (SET.pt && R.ps.length < [90, 170, 300][SET.q]) R.ps.push({ x, y, vx, vy, l, m: l, c, s, fl });
}
function burst(x, y, c, n, sp = 110) {
 for (let i = 0; i < n; i++) {
  const a = Math.random() * 6.3, v = Math.random() * sp;
  part(x, y, Math.cos(a) * v, Math.sin(a) * v, .3 + Math.random() * .3, c, 2 + Math.random() * 2);
 }
}
const txt = (x, y, v, c, s = 11) => {
 if ((SET.dmg || typeof v === 'string') && R && R.tx && R.tx.length < 40) {
  const displayVal = typeof v === 'number' ? (isNaN(v) ? '0' : String(Math.round(v))) : String(v);
  R.tx.push({ x, y, v: displayVal, c: c || '#fff', s, t: .7 });
 }
};
const ring = (x, y, r, c, d = .4, f) => R.fx.push({ x, y, r: 0, max: r, l: d, d, c, f });

function gainSh(v) { R.p.sh = Math.min(ST.shmax, R.p.sh + v); }
function healP(v) { G.hp = Math.min(G.max, G.hp + v); txt(R.p.x, R.p.y - 14, '+' + Math.round(v), '#7ddc6f'); }

function hurt(d, src) {
 const p = R.p;
 if (p.inv > 0 || R.end) return;
 R.damageTaken += Math.max(0, d);
 p.nod = 0; let m = d;
 let absorbed = 0;
 if (p.sh > 0) {
  absorbed = Math.min(p.sh, m);
  p.sh -= absorbed; m -= absorbed;
  if (p.sh <= 0) {
   snd(200, .2, 'sawtooth', .06, -100);
   ring(p.x, p.y, 28, '#5ee0d0', .35);
   if (ST.proxy) blast(p.x, p.y, 95, 20 * ST.dmg, { col: '#4aa8ff', knock: 140 }, null, 1);
  }
 }
 if (absorbed > 0) {
  txt(p.x + (Math.random() - 0.5) * 14, p.y - 18, '-' + Math.round(absorbed) + ' SHIELD', '#5ee0d0', 11);
  burst(p.x, p.y, '#5ee0d0', 5, 80);
 }
 if (m > 0) {
  G.hp -= m; p.inv = .7; R.shake = Math.max(R.shake, 9); R.flash = .18;
  snd(110, .15, 'sawtooth', .07, -50, 'hurt');
  burst(p.x, p.y, '#ff5c7a', 10);
  txt(p.x, p.y - 12, '-' + Math.round(m), '#ff5c7a', 13);
 } else {
  p.inv = .22;
  R.shake = Math.max(R.shake, 3);
  snd(320, .08, 'triangle', .05, -120);
 }
 if (src) {
  const dx = p.x - src.x, dy = p.y - src.y, l = Math.hypot(dx, dy) || 1;
  p.vx += dx / l * 180; p.vy += dy / l * 180;
 }
 if (G.hp <= 0) endRun(false);
}

function updP(dt) {
 const p = R.p, arena = G.cfg.arena;
 let dx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
 let dy = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
 if (joy && (joy.x || joy.y)) { dx = joy.x; dy = joy.y; }
 const l = Math.hypot(dx, dy);
 if (l > 1) { dx /= l; dy /= l; }
 if (l > .1) {
  p.fx = dx / Math.min(1, l); p.fy = dy / Math.min(1, l);
  const q = Math.hypot(p.fx, p.fy); p.fx /= q; p.fy /= q;
 }
 const ta = Math.atan2(p.fy, p.fx);
 let df = ta - (p.ang ?? ta);
 df = Math.atan2(Math.sin(df), Math.cos(df));
 p.ang = (p.ang ?? ta) + df * Math.min(1, dt * 16);

 p.inv -= dt; p.dcd -= dt; p.nod += dt;
 const slow = hazAt(arena, p.x, p.y) === 'slow';
 if (dashReq && p.dcd <= 0 && p.dash <= 0) {
  p.dash = .16; p.dcd = 1.5 * ST.dashcd; p.inv = Math.max(p.inv, ST.nullref ? .55 : .28);
  p.vx = p.fx * 480; p.vy = p.fy * 480;
  snd(520, .1, 'triangle', .05, 300);
  burst(p.x, p.y, '#5ee0d0', 8);
 }
 dashReq = false;

 if (p.dash > 0) {
  p.dash -= dt;
  if (ST.nullref && Math.random() < .5) R.tg.push({ x: p.x, y: p.y, r: 26, t: .06, max: .06, dmg: 11 * ST.dmg, own: 'p', c: '#5ee0d0' });
  part(p.x, p.y, 0, 0, .25, '#5ee0d0', 5);
 } else {
  const sp = 130 * ST.spd * (slow ? .5 : 1), k = Math.min(1, dt * (l > .1 ? 14 : 9));
  p.vx += (dx * sp - p.vx) * k; p.vy += (dy * sp - p.vy) * k;
 }
 mv(arena, p, p.vx * dt, p.vy * dt, 9);
 p.mov = Math.hypot(p.vx, p.vy) > 45;

 const J = HOSTS[G.host].j || ['#ff7a45', '#ff3b1f', '#ffe066'];
 if (p.mov && Math.random() < .82) {
  const exX = p.x - p.fx * 11 + (Math.random() - .5) * 4;
  const exY = p.y - p.fy * 11 + (Math.random() - .5) * 4;
  const backVx = -p.fx * (55 + Math.random() * 35);
  const backVy = -p.fy * (55 + Math.random() * 35);
  if (R.ht.length < 70) R.ht.push({ x: exX, y: exY, vx: backVx, vy: backVy, l: .18 + Math.random() * .1, m: .28, c: J[Math.random() < .6 ? 0 : 1], s: 2 + Math.random() * .7 });
 }
 if (p.dash > 0) {
  R.gh.push({ x: p.x, y: p.y, l: .22 });
  if (R.ht.length < 70) R.ht.push({ x: p.x - p.fx * 14, y: p.y - p.fy * 14, vx: -p.fx * 150, vy: -p.fy * 150, l: .24, m: .34, c: J[2], s: 3.1 });
 }
 if (ST.regen && p.nod > 3) gainSh(ST.regen * dt);
 if (hazAt(arena, p.x, p.y) === 'lava' && p.dash <= 0) {
  const ld = 9 * dt;
  if (p.sh > 0) {
   p.sh = Math.max(0, p.sh - ld);
  } else {
   G.hp -= ld; R.shake = Math.max(R.shake, 2);
   if (G.hp <= 0) endRun(false);
  }
 }
}

function castLabel(c) {
 const mods = (c.mods || []).map((k, i) => `${MODS[k]?.n || k}${c.mv && c.mv[i] > 1 ? ' v' + c.mv[i] : ''}`);
 const spell = SPELLS[c.sp]?.n || c.sp || 'spell()';
 return `${mods.length ? mods.join(' + ') + ' > ' : ''}${spell}${c.lv > 1 ? ' v' + c.lv : ''}`;
}
function recordDamage(a, v) {
 if (!R || !Number.isFinite(v) || v <= 0) return;
 R.damageTotal += v;
 if (a && a._cardId != null) {
  let row = R.damageByCard.find(x => x.id === a._cardId);
  if (!row) {
   row = { id: a._cardId, label: a._cardLabel || 'spell()', dmg: 0, hits: 0 };
   R.damageByCard.push(row);
  }
  row.dmg += v;
  row.hits++;
 }
}
function fire(c) {
 let a = stats(c.c, ST);
 a._cardId = c.id;
 a._cardLabel = c.label;
 if (Math.random() < ST.chaos) a = stats({ sp: c.c.sp, mods: [...c.c.mods, pick(CHAOS)], mv: c.c.mv, lv: c.c.lv }, ST);
 if (ST.leak) a.dmg *= Math.min(2.5, 1 + .025 * R.t);
 const p = R.p;
 snd(a.k === 'self' ? 330 : a.k === 'nova' ? 140 : 260 + ri(60), .07, 'square', .025, -80, 'cast');
 if (a.sh) gainSh(a.sh);

 if (a.k === 'proj') {
  const t = near(R, p);
  if (!t) return;
  const a0 = Math.atan2(t.y - p.y, t.x - p.x);
  for (let i = 0; i < a.pc; i++) {
   const an = a0 + (a.pc > 1 ? (i - (a.pc - 1) / 2) * .3 : 0);
   R.pr.push({ x: p.x, y: p.y, vx: Math.cos(an) * a.sp, vy: Math.sin(an) * a.sp, a, shape: c.c.sp, life: 2.2, hit: new Set(), pierce: a.pierce, bounce: a.bounce, r: Math.min(a.rad * a.size, 16) });
  }
 } else if (a.k === 'nova') {
  const nr = a.rad * a.area;
  R.fx.push({ nova: 1, x: p.x, y: p.y, r: 0, max: nr, l: .34, d: .34, c: a.col });
  blast(p.x, p.y, nr, a.dmg, a, null, 0, 1);
 } else if (a.k === 'chain') {
  let t = near(R, p, a.rad * a.area), from = { x: p.x, y: p.y }, seen = new Set(), j = a.jumps + 1;
  while (t && j-- > 0) {
   seen.add(t);
   R.lines.push({ x1: from.x, y1: from.y, x2: t.x, y2: t.y, l: .18, c: a.col, lightning: 1, seed: Math.random(), w: 2.6 });
   hitE(t, a.dmg, a, from);
   from = { x: t.x, y: t.y };
   let b = null, bd = 120;
   for (const e of R.en) if (!e.dead && !seen.has(e)) {
    const d = Math.hypot(e.x - from.x, e.y - from.y);
    if (d < bd) { bd = d; b = e; }
   }
   t = b;
  }
 } else if (a.k === 'cone') {
  const t = near(R, p);
  if (!t) return;
  const tier = a.lv >= 3 ? 2 : a.lv === 2 ? 1 : 0, pal = STDOUT_PAL[tier];
  const mapStep = a.pc > 1 ? (a.pc - 1) / 2 : 0;
  // map(): extra spread makes the cone LONGER (+20% per step) instead of much wider (+.06 rad per step).
  const a0 = Math.atan2(t.y - p.y, t.x - p.x), rg = 125 * a.area * (1 + .2 * mapStep), hw = .5 + a.size * .05 + .06 * mapStep;
  for (let i = [4, 8, 14][SET.q]; i-- > 0;) { const an = a0 + (Math.random() - .5) * .9, v = 220 + Math.random() * 260; part(p.x + Math.cos(a0) * 10, p.y + Math.sin(a0) * 10, Math.cos(an) * v, Math.sin(an) * v, .35 + Math.random() * .2, pal.fx, 3 + Math.random() * 3, 1); }
  R.fx.push({ x: p.x, y: p.y, r: 0, max: rg, l: c.c?.sp === 'stdout' ? .34 : .22, d: c.c?.sp === 'stdout' ? .34 : .22, c: pal.fx, tier, cone: 1, stdout: c.c?.sp === 'stdout', a: a0, h: hw });
  for (const e of R.en) {
   if (e.dead) continue;
   const dx = e.x - p.x, dy = e.y - p.y;
   if (Math.hypot(dx, dy) < rg + e.r) {
    let df = Math.atan2(dy, dx) - a0;
    df = Math.atan2(Math.sin(df), Math.cos(df));
    if (Math.abs(df) < hw) hitE(e, a.dmg, a, p);
   }
  }
 } else if (a.k === 'beam') {
  const t = near(R, p);
  if (!t) return;
  const a0 = Math.atan2(t.y - p.y, t.x - p.x);
  for (let i = 0; i < a.pc; i++) {
   const an = a0 + (a.pc > 1 ? (i - (a.pc - 1) / 2) * .28 : 0), ca = Math.cos(an), sa = Math.sin(an);
   let L = 0;
   while (L < 300 && !wallHit(G.cfg.arena, p.x + ca * L, p.y + sa * L, 2)) L += 6;
   const hx = p.x + ca * L, hy = p.y + sa * L;
   const hitWall = wallHit(G.cfg.arena, hx, hy, 2);
   const tg = R.en.filter(e => {
    if (e.dead) return false;
    const dx = e.x - p.x, dy = e.y - p.y, pr = dx * ca + dy * sa;
    if (pr < 0 || pr > L) return false;
    return Math.abs(-dx * sa + dy * ca) < e.r + 3 * a.size;
   });
   const anyHit = hitWall || tg.length > 0;
   R.lines.push({ x1: p.x, y1: p.y, x2: hx, y2: hy, l: .18, c: a.col, w: 3.6 + a.size * 2.2, laser: 1, ping: 1, core: shadeHex(a.col, .75), impact: anyHit ? 1 : 0 });
   // Starburst only where the beam ends AND it actually hit something (wall or enemy).
   if (anyHit) R.fx.push({ star: 1, x: hx, y: hy, r: 0, max: 17 + a.size * 3, l: .26, d: .26, c: a.col, seed: Math.random() * 6 });
   if (hitWall) {
    burst(hx, hy, a.col, 9, 125);
    burst(hx, hy, '#d9f5ff', 4, 75);
   }
   for (const e of tg) {
    R.fx.push({ star: 1, small: 1, x: e.x, y: e.y, r: 0, max: 8 + a.size * 1.5, l: .2, d: .2, c: a.col, seed: Math.random() * 6 });
    hitE(e, a.dmg, a, p);
   }
  }
 } else if (a.k === 'melee') {
  const t = near(R, p, 95);
  if (!t) return;
  const a0 = Math.atan2(t.y - p.y, t.x - p.x), rg = 66 * a.area;
  R.fx.push({ slash: 1, melee: 1, x: p.x, y: p.y, a: a0, r: 0, max: rg, w: 1.2 + (a.pc > 1 ? .5 * (a.pc - 1) / 2 : 0), l: .4, d: .4, c: a.col });
  for (const e of R.en) {
   if (e.dead) continue;
   const dx = e.x - p.x, dy = e.y - p.y;
   if (Math.hypot(dx, dy) < rg + e.r) {
    let df = Math.atan2(dy, dx) - a0;
    df = Math.atan2(Math.sin(df), Math.cos(df));
    if (Math.abs(df) < 1.2 + (a.pc > 1 ? .5 * (a.pc - 1) / 2 : 0)) hitE(e, a.dmg, a, p);
   }
  }
 } else if (a.k === 'orbit') {
  const nb = 2 * a.rep + (a.pc > 1 ? 2 : 0) + Math.max(0, (a.lv || 1) - 1);
  p.orb = { t: Math.max(4.6, a.cd + .4), n: nb, a: { ...a, knock: Math.max(a.knock || 0, 150) }, ang: 0, zt: .5, bl: Array.from({ length: nb }, () => ({ c: 3, r: 0 })) };
 } else if (a.k === 'mine') {
  if (R.tg.filter(t => t.mine && t.own === 'p').length >= 6) return;
  R.tg.push({ mine: 1, x: p.x, y: p.y, r: a.rad * a.area, t: .9, max: .9, dmg: a.dmg, own: 'p', c: a.col, a });
 } else if (a.k === 'self') {
  if (a.shv) { gainSh(a.shv * ST.shm * a.area); ring(p.x, p.y, 24, '#5ee0d0', .3); }
  if (a.hpv) healP(a.hpv * ST.hm * a.area);
 }
}

function updCasts(dt) {
 const p = R.p, tm = Math.max(.3, p.mov ? 1 + ST.mv : 1 - ST.still);
 for (const c of R.casts) {
  if (c.dis > 0) { c.dis -= dt; continue; }
  if (c.pend > 0) {
   c.bt -= dt;
   if (c.bt <= 0) { fire(c); c.pend--; c.bt = .12; }
  }
  c.t -= dt * tm;
  if (c.t <= 0) {
   const a = stats(c.c, ST);
   if (canCast(a)) {
    c.n++;
    R.castsExecuted++;
    fire(c);
    c.pend = a.rep - 1 + (ST.over && c.n % 3 === 0 ? 1 : 0) + (ST.recur && c.n % 5 === 0 ? 1 : 0) + (ST.fork && Math.random() < .15 ? a.rep : 0);
    c.bt = .12; c.t = c.cdm = a.cd;
   } else c.t = 0;
  }
 }
 const o = p.orb;
 if (o) {
  o.t -= dt; o.ang += dt * 3.2;
  if (o.t <= 0) p.orb = null;
  else {
   const lvl = o.a.lv || 1;
   for (let i = 0; i < o.n; i++) {
    const bl = o.bl[i];
    if (bl.r > 0) { bl.r -= dt; if (bl.r <= 0) bl.c = 3; continue; }
    const an = o.ang + i * 6.283 / o.n, bx = p.x + Math.cos(an) * 48, by = p.y + Math.sin(an) * 48;
    for (const e of R.en) if (!e.dead && (e.oc || 0) <= 0 && Math.hypot(e.x - bx, e.y - by) < e.r + 7) {
     e.oc = .4; hitE(e, o.a.dmg, o.a, { x: bx, y: by });
    }
    for (const b of R.eb) if (b.l > 0 && Math.hypot(b.x - bx, b.y - by) < 11) {
     b.l = 0; for (let k = 0; k < 3; k++) part(bx, by, (Math.random() - .5) * 120, (Math.random() - .5) * 120, .25, o.a.col, 2);
     if (--bl.c <= 0) bl.r = 3.5;
    }
   }
   if (lvl >= 2) { o.zt -= dt; if (o.zt <= 0) { o.zt = lvl >= 3 ? .5 : .8; orbitZap(o, lvl); } }
  }
 }
}
function orbitZap(o, lvl) {
 const p = R.p; let tb = null, td = 230;
 for (const b of R.eb) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (b.l > 0 && d < td) { td = d; tb = b; } }
 if (tb) {
  tb.l = 0;
  R.lines.push({ x1: p.x, y1: p.y, x2: tb.x, y2: tb.y, l: .18, c: o.a.col, w: 3.2, laser: 1, orbit: 1, core: '#fffbe0' });
  ring(tb.x, tb.y, 12, o.a.col, .16);
  return;
 }
 let te = null; td = 260;
 for (const e of R.en) {
  if (e.dead) continue;
  const arm = e.boss ? 6 : e.k === 'tank' ? 6 : e.elite ? 4 : 0, d = Math.hypot(e.x - p.x, e.y - p.y);
  if (arm > (e.shred || 0) && d < td) { td = d; te = e; }
 }
 if (te) {
  te.shred = Math.min(6, (te.shred || 0) + (lvl >= 3 ? 3 : 2));
  te.shT = 4;
  R.lines.push({ x1: p.x, y1: p.y, x2: te.x, y2: te.y, l: .2, c: o.a.col, w: 3.4, laser: 1, orbit: 1, core: '#fffbe0' });
  ring(te.x, te.y, 15, o.a.col, .18);
  burst(te.x, te.y, o.a.col, 5, 80);
 }
}
function canCast(a) {
 const p = R.p;
 if (a.k === 'self') return a.shv ? p.sh < ST.shmax - 2 : a.hpv ? G.hp < G.max - 1 : true;
 if (a.k === 'nova') return R.en.some(e => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < a.rad * a.area * 1.1);
 if (a.k === 'cone' || a.k === 'melee') return R.en.some(e => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < (a.k === 'cone' ? 125 * a.area * (1 + (a.pc > 1 ? .2 * (a.pc - 1) / 2 : 0)) + 10 : 85));
 if (a.k === 'orbit') return !p.orb && R.en.length > 0;
 return R.en.some(e => !e.dead);
}

function blast(x, y, r, d, a, skip, np, self) {
 ring(x, y, r, a.col || '#ff7a45', .4, 1);
 R.shake = Math.max(R.shake, r > 80 ? 6 : 3);
 snd(90, .18, 'sawtooth', .05, -40, 'boom');
 burst(x, y, a.col || '#ff7a45', 12, 160);
 for (const e of R.en) if (!e.dead && e !== skip && Math.hypot(e.x - x, e.y - y) < r + e.r) hitE(e, d, a, { x, y }, np);
 if (self) R.eb = R.eb.filter(b => Math.hypot(b.x - x, b.y - y) > r);
}
function pullTo(x, y, r) {
 for (const e of R.en) if (!e.dead && !e.boss) {
  const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy);
  if (d < r && d > 4) { e.kx += dx / d * 160; e.ky += dy / d * 160; }
 }
}
function hitE(e, d, a, src, np) {
 if (e.dead) return;
 const sc = a.crit >= 1, crit = sc || Math.random() < ST.crit;
 let v = d * (crit ? (sc ? 1 + a.crit : 2) : 1) * e.prot * (e.vuln > 0 ? 1.5 : 1);
 const arm = Math.max(0, (e.boss ? 6 : e.k === 'tank' ? 6 : e.elite ? 4 : 0) - (e.shT > 0 ? (e.shred || 0) : 0));
 if (arm) v = Math.max(v * .25, v - arm);
 e.hp -= v; e.fl = .08;
 recordDamage(a, v);
 if (a.burn) e.burnCard = a._cardId;
 if (SET.q > 0) burst(e.x, e.y, a.col || '#fff', [0, 2, 4][SET.q], 90);
 txt(e.x, e.y - e.r, Math.round(v), crit ? '#ffd23f' : '#fff', crit ? 15 : 11);
 snd(crit ? 700 : 400 + ri(80), .04, 'square', .03, 0, 'hit');
 if (a.burn) { e.burn = 3; e.bd = Math.max(e.bd, d * .4 * a.burn / 3 * (arm ? .3 : 1)); }
 if (a.freeze) { e.slow = 2.2 + 1.1 * (a.freeze - 1); e.sf = [.55, .42, .32][a.freeze - 1] || .32; }
 if (a.knock && src) {
  const dx = e.x - src.x, dy = e.y - src.y, l = Math.hypot(dx, dy) || 1, k = a.knock / (e.boss ? 6 : e.r / 10);
  e.kx += dx / l * k; e.ky += dy / l * k;
 }
 if (a.leech && G.hp < G.max) G.hp = Math.min(G.max, G.hp + Math.min(1.5 * a.leech, v * .05 * a.leech));
 if (e.hp <= 0) kill(e, np);
}
function kill(e, np) {
 if (e.dead) return;
 e.dead = 1; G.kills++;
 burst(e.x, e.y, e.c, e.boss ? 50 : 12, e.boss ? 260 : 130);
 snd(160, .12, 'sawtooth', .05, -90, 'kill');
 if (ST.gc) gainSh(ST.gc);
 if (ST.panic && !np && !e.boss) blast(e.x, e.y, 62, e.max * .5, { col: '#ffa81f' }, e, 1);
 if (e.beh === 'split') for (let i = 0; i < 2; i++) spawnE('swarm', e.x + ri(14) - 7, e.y + ri(14) - 7);
 if (e.blast) R.tg.push({ x: e.x, y: e.y, r: 52, t: .7, max: .7, dmg: 12, own: 'e', c: '#ff5c7a' });
 if (e.boss) {
  R.bossDead = 1;
  R.en.forEach(x => { if (!x.dead && x !== e) { x.dead = 1; burst(x.x, x.y, x.c, 6); } });
  R.eb = []; R.shake = 18;
  snd(60, .8, 'sawtooth', .09, -20);
 }
}

function updSpawn(dt) {
 if (R.boss || R.budget <= .3) return;
 R.spT -= dt;
 const i = G.cfg.i;
 if (R.spT > 0 || R.en.length >= Math.min(26, 9 + i * 2)) return;
 const o = Object.keys(EN).filter(k => EN[k].from <= i && EN[k].cost <= R.budget + .3);
 if (!o.length) { R.budget = 0; return; }
 const k = pick(o), [x, y] = spawnPos(G.cfg.arena, R.p.x, R.p.y);
 if (k === 'swarm') {
  for (let j = 0; j < 4; j++) { spawnE(k, x + ri(30) - 15, y + ri(30) - 15); R.budget -= .35; }
  R.spT = 1;
 } else {
  spawnE(k, x, y);
  if (k === 'summoner') { const g = spawnE('tank', x + 22, y + 22); g.guard = 1; R.budget -= EN.tank.cost * .5; }
  R.budget -= EN[k].cost;
  R.spT = Math.max(.35, .85 - .04 * i);
 }
}

function ebul(x, y, an, sp, d, c, kind) {
 R.eb.push({ x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, dmg: d, l: 5, c: c || '#ff5c7a', pw: PW, kind: kind || 'orb' });
}

function bossAI(e, dt, d) {
 PW = e.bd0.grow ? 1 : 0;
 const b = e.bd0, f = e.hp / e.max, ph = f < .33 ? 2 : f < .66 ? 1 : 0;
 if (e.tpd) {
  e.tpd.t -= dt;
  if (e.tpd.t <= 0) {
   ring(e.x, e.y, 30, b.c, .3);
   e.x = e.tpd.x; e.y = e.tpd.y;
   ring(e.x, e.y, 54, b.c, .3);
   R.tg.push({ x: e.x, y: e.y, r: 54, t: .3, max: .3, dmg: 14, own: 'e', c: b.c });
   burst(e.x, e.y, b.c, 14, 160);
   e.vuln = 2.2; e.tpd = null;
  }
 }
 if (ph !== e.ph) {
  e.ph = ph; e.vuln = 2.2; R.eb = []; R.shake = 14;
  R.banner = { t: 1.8, s: 'PHASE ' + (ph + 1) + ': EXPOSED' };
  snd(120, .5, 'sawtooth', .08, -60);
 }
 if (b.grow) { e.gt += dt; R.emul = 1 + Math.min(.5, e.gt * .008); }
 const gm = b.grow ? 1 + Math.min(.8, e.gt * .01) : 1, pat = b.ph[ph];
 for (const k in pat) {
  e.pt[k] = (e.pt[k] ?? pat[k]) - dt;
  if (e.pt[k] > 0) continue;
  e.pt[k] = pat[k];
  const p = R.p;
  if (k === 'ring') {
   const n = 10 + ph * 3, o = Math.random() * 6.3;
   for (let i = 0; i < n; i++) ebul(e.x, e.y, o + i * 6.283 / n, 105 * gm, Math.round(7 * gm), b.c, e.bd0.n === 'THE MEMORY LEAK' ? 'leak' : e.bd0.n === 'THE SEGFAULT' ? 'segfault' : 'runtime');
  } else if (k === 'aim') {
   const a = Math.atan2(p.y - e.y, p.x - e.x);
   for (let i = -1; i <= 1; i++) ebul(e.x, e.y, a + i * .22, 150 * gm, Math.round(8 * gm), b.c, e.bd0.n === 'THE MEMORY LEAK' ? 'leak' : e.bd0.n === 'THE SEGFAULT' ? 'segfault' : 'runtime');
  } else if (k === 'zone') {
   for (let i = 0; i < 1 + ph; i++) {
    const x = i ? cl(p.x + ri(160) - 80, 40, 600) : p.x, y = i ? cl(p.y + ri(160) - 80, 40, 360) : p.y;
    R.tg.push({ x, y, r: 58, t: 1.1, max: 1.1, dmg: 15, own: 'e', c: b.c });
   }
   e.vuln = Math.max(e.vuln, 1.6); snd(150, .3, 'triangle', .05, -80);
  } else if (k === 'summon') {
   if (R.en.length < 22) for (let i = 0; i < 3; i++) spawnE(i ? 'swarm' : 'chaser', e.x + ri(40) - 20, e.y + ri(40) - 20);
  } else if (k === 'tp' && !e.tpd) {
   const dist = e.hp / e.max > .35 ? 85 : 170;
   for (let i = 0; i < 16; i++) {
    const a = Math.random() * 6.3, x = p.x + Math.cos(a) * dist, y = p.y + Math.sin(a) * dist;
    if (!wallHit(G.cfg.arena, x, y, e.r + 4) && !hazAt(G.cfg.arena, x, y)) {
     e.tpd = { x, y, t: .9 };
     ring(e.x, e.y, 30, b.c, .3);
     snd(300, .4, 'triangle', .05, 200);
     break;
    }
   }
  }
 }
 PW = 0;
}

function updEn(dt) {
 const p = R.p, arena = G.cfg.arena;
 for (const e of R.en) e.prot = 1;
 for (const s of R.en) if (s.beh === 'aura' && !s.dead) for (const e of R.en) if (e !== s && Math.hypot(e.x - s.x, e.y - s.y) < 95) e.prot = .55;

 for (let n = 0; n < R.en.length; n++) {
  const e = R.en[n];
  if (e.dead) continue;
  e.fl -= dt; e.oc -= dt; e.vuln -= dt; if (e.shT > 0) e.shT -= dt;
  if (e.burn > 0) {
   e.burn -= dt;
   const burnDmg = e.bd * dt;
   e.hp -= burnDmg;
   if (e.burnCard != null) {
    const src = R.casts.find(c => c.id === e.burnCard);
    recordDamage({ _cardId: e.burnCard, _cardLabel: src?.label || 'spell()' }, burnDmg);
   }
   if (!e.boss && e.bd > 0 && Math.random() < dt * 1.5) {
    for (const o of R.en) if (o !== e && !o.dead && o.burn <= 0 && Math.hypot(o.x - e.x, o.y - e.y) < 50) {
     o.burn = 2; o.bd = e.bd * .7; break;
    }
   }
   if (e.hp <= 0) { kill(e); continue; }
  }
  const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  let sp = e.sp * R.emul * (e.slow > 0 ? (e.sf || .55) : 1) * (hazAt(arena, e.x, e.y) === 'slow' ? .6 : 1);
  let mx = ux, my = uy;
  e.slow -= dt; e.tm -= dt;
  if (e.boss) bossAI(e, dt, d);
  else if (R.t > 70) sp *= 1.6;
  else switch (e.beh) {
   case 'shoot':
    if (d < 115) { mx = -ux; my = -uy; } else if (d < 190) { sp *= .35; mx = -uy; my = ux; }
    if (e.tm <= 0) { e.tm = 2.3; ebul(e.x, e.y, Math.atan2(dy, dx), 135, e.dmg, '#b48cff', 'shooter'); }
    break;
   case 'dash':
    if (e.st === 0) { if (e.tm <= 0) { e.st = 1; e.tm = .55; e.lx = ux; e.ly = uy; } }
    else if (e.st === 1) { sp = 0; if (e.tm <= 0) { e.st = 2; e.tm = .35; } }
    else {
     mx = e.lx; my = e.ly; sp = 340;
     if (wallHit(arena, e.x, e.y, e.r * .8) && Math.random() < .5) part(e.x, e.y, (Math.random() - .5) * 60, (Math.random() - .5) * 60, .22, e.c, 2);
     if (e.tm <= 0) {
      e.st = 0; e.tm = 2.4;
      // Charge over: if it ended inside a wall, step out to the nearest open spot.
      if (wallHit(arena, e.x, e.y, e.r * .8)) {
       out: for (let rr = 8; rr <= 80; rr += 8) for (let a = 0; a < 6.283; a += .785) {
        const nx = e.x + Math.cos(a) * rr, ny = e.y + Math.sin(a) * rr;
        if (nx > e.r && ny > e.r && nx < W - e.r && ny < H - e.r && !wallHit(arena, nx, ny, e.r * .8)) { e.x = nx; e.y = ny; break out; }
       }
      }
     }
    }
    break;
   case 'tp':
    if (e.tm <= 0) {
     e.tm = 2.4; ring(e.x, e.y, 16, e.c, .2);
     for (let i = 0; i < 8; i++) {
      const a = Math.random() * 6.3, x = p.x + Math.cos(a) * 110, y = p.y + Math.sin(a) * 110;
      if (!wallHit(arena, x, y, 12) && !hazAt(arena, x, y)) { e.x = x; e.y = y; break; }
     }
     burst(e.x, e.y, e.c, 6);
    }
    break;
   case 'summon':
    if (e.tm <= 0) {
     e.tm = 4.6;
     if (R.en.length < 30) for (let i = 0; i < 2; i++) spawnE('swarm', e.x + ri(20) - 10, e.y + ri(20) - 10);
     ring(e.x, e.y, 22, e.c, .3);
    }
    break;
  }
  const kd = Math.min(1, dt * 6);
  if (e.ghost || (e.beh === 'dash' && e.st === 2)) {
   e.x = cl(e.x + (mx * sp + e.kx) * dt, e.r, W - e.r);
   e.y = cl(e.y + (my * sp + e.ky) * dt, e.r, H - e.r);
  } else mv(arena, e, (mx * sp + e.kx) * dt, (my * sp + e.ky) * dt, e.r * .8);
  e.kx -= e.kx * kd; e.ky -= e.ky * kd;

  if (d < e.r + 9 && p.inv <= 0) {
   hurt(e.dmg, e);
   if (e.beh === 'leech') { e.hp = Math.min(e.max, e.hp + 8); if (p.sh > 0) p.sh = Math.max(0, p.sh - 5); }
   if (e.beh === 'null') { const c = pick(R.casts); if (c) { c.dis = 4; txt(p.x, p.y - 24, 'NULLED', '#a99fc0'); } }
   if (e.beh === 'tp') { const c = pick(R.casts); if (c) c.t += 1.5; }
  }
 }
 R.en = R.en.filter(e => !e.dead);
}

function updPr(dt) {
 const arena = G.cfg.arena;
 for (const q of R.pr) {
  const a = q.a;
  if (a.home) {
   const t = near(R, q, 260);
   if (t) {
    const ca = Math.atan2(q.vy, q.vx);
    let df = Math.atan2(t.y - q.y, t.x - q.x) - ca;
    df = Math.atan2(Math.sin(df), Math.cos(df));
    const na = ca + cl(df, -5 * a.home * dt, 5 * a.home * dt), s = Math.hypot(q.vx, q.vy);
    q.vx = Math.cos(na) * s; q.vy = Math.sin(na) * s;
   }
  }
  q.life -= dt;
  if (Math.random() < .6) part(q.x, q.y, 0, 0, .22, a.col, q.r * .7);
  const n = Math.max(1, Math.ceil(Math.hypot(q.vx, q.vy) * dt / 6)), sd = dt / n;
  for (let k = 0; k < n && q.life > 0; k++) {
   q.x += q.vx * sd; q.y += q.vy * sd;
   if (wallHit(arena, q.x, q.y, q.r)) {
    if (q.bounce > 0) {
     q.bounce--;
     const ox = q.x - q.vx * sd, oy = q.y - q.vy * sd;
     let f = 0;
     if (wallHit(arena, q.x, oy, q.r)) { q.vx *= -1; f = 1; }
     if (wallHit(arena, ox, q.y, q.r)) { q.vy *= -1; f = 1; }
     if (!f) { q.vx *= -1; q.vy *= -1; }
     q.x = ox; q.y = oy; q.hit.clear();
    } else {
     q.life = 0; burst(q.x, q.y, a.col, 4); break;
    }
   }
   for (const e of R.en) {
    if (e.dead || q.hit.has(e)) continue;
    if (Math.hypot(e.x - q.x, e.y - q.y) < e.r + q.r) {
     q.hit.add(e);
     hitE(e, a.dmg, a, { x: q.x, y: q.y });
     burst(q.x, q.y, a.col, 3);
     if (a.expl) blast(q.x, q.y, 50 * a.area * (1 + .3 * (a.expl - 1)), a.dmg * (.6 + .2 * (a.expl - 1)), { col: a.col, crit: 0 }, e, 0);
     if (a.pull) pullTo(q.x, q.y, 100 * (1 + .4 * (a.pull - 1)));
     if (q.pierce <= 0) { q.life = 0; break; }
     q.pierce--;
    }
   }
  }
 }
 R.pr = R.pr.filter(q => q.life > 0);
}

function updMisc(dt) {
 const p = R.p, arena = G.cfg.arena;
 for (const b of R.eb) {
  b.x += b.vx * dt; b.y += b.vy * dt; b.l -= dt;
  if (b.pw ? (b.x < -5 || b.y < -5 || b.x > W + 5 || b.y > H + 5) : wallHit(arena, b.x, b.y, 3)) b.l = 0;
  if (Math.hypot(b.x - p.x, b.y - p.y) < 9 && p.inv <= 0) { b.l = 0; hurt(b.dmg, b); }
 }
 R.eb = R.eb.filter(b => b.l > 0);
 for (const t of R.tg) {
  t.t -= dt;
  if (t.t > 0) continue;
  ring(t.x, t.y, t.r, t.c, .35, 1);
  burst(t.x, t.y, t.c, 10, 140);
  R.shake = Math.max(R.shake, t.own === 'e' ? 7 : 2);
  if (t.own === 'p') {
   for (const e of R.en) if (!e.dead && Math.hypot(e.x - t.x, e.y - t.y) < t.r + e.r) hitE(e, t.dmg, t.a || { col: t.c }, t);
  } else if (Math.hypot(p.x - t.x, p.y - t.y) < t.r + 6) hurt(t.dmg, t);
  snd(100, .2, 'sawtooth', .05, -40, 'boom');
 }
 R.tg = R.tg.filter(t => t.t > 0);
 for (const f of R.fx) { f.l -= dt; f.r = f.max * (1 - f.l / f.d); }
 R.fx = R.fx.filter(f => f.l > 0);
 R.lines = R.lines.filter(l => (l.l -= dt) > 0);
 for (const t of R.ht) { t.x += t.vx * dt; t.y += t.vy * dt; t.l -= dt; t.vx *= .82; t.vy *= .82; }
 R.ht = R.ht.filter(t => t.l > 0);
 R.gh = R.gh.filter(g => (g.l -= dt) > 0);
 for (const q of R.ps) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= .93; q.vy *= .93; if (q.fl) q.vy -= 70 * dt; q.l -= dt; }
 R.ps = R.ps.filter(q => q.l > 0);
 for (const t of R.tx) { t.y -= 22 * dt; t.t -= dt; }
 R.tx = R.tx.filter(t => t.t > 0);
 R.shake *= Math.pow(.02, dt);
 R.flash -= dt;
 if (R.banner && (R.banner.t -= dt) < 0) R.banner = null;
}

function step(dt) {
 updP(dt); updSpawn(dt); updCasts(dt); updPr(dt); updEn(dt); updMisc(dt);
 if (!R.end && R.en.length === 0 && R.budget <= .3 && (!R.boss || R.bossDead)) {
  R.end = 1; G.cfg.rmode = 'p';
  if (R.boss) { stopMusic(1.4); }
  setTimeout(clearRound, R.boss ? 1400 : 500);
 }
 objectives(dt);
}
function objectives(dt) {
 if (R.end || !R.term) return;
 const p = R.p, t = R.term;
 t.p = cl(t.p + (Math.hypot(p.x - t.x, p.y - t.y) < 36 ? dt / 6 : -dt / 25), 0, 1);
 if (t.p >= 1) return finish('h');
 for (const k of R.pk) if (!k.got && Math.hypot(p.x - k.x, p.y - k.y) < 16) {
  k.got = 1; snd(800, .08, 'triangle', .05, 200);
  if (R.pk.every(q => q.got)) return finish('o');
 }
}
function finish(m) {
 R.end = 1; G.cfg.rmode = m; R.en = []; R.eb = []; R.tg = [];
 R.banner = { t: 1.2, s: m === 'h' ? 'HACK COMPLETE' : 'DATA RECOVERED: BONUS' };
 snd(660, .3, 'triangle', .06, 300);
 setTimeout(clearRound, 700);
}

// stdout flame colors by spell level: v1 orange-red, v2 blue, v3 purple (tongues, core and sparks all share the palette).
const STDOUT_PAL = [
 { fx: '#ff7a45', fill: '#ff5a3c', core: ['255,255,240', '255,200,90', '255,90,30'], tg: ['255,248,215', '255,205,90', '255,110,40', '200,40,20'], sp: ['255,225,130', '255,90,30'], hot: '#ffd9a0' },
 { fx: '#5aa8ff', fill: '#3c78ff', core: ['240,250,255', '150,215,255', '50,110,255'], tg: ['235,248,255', '140,210,255', '60,120,255', '30,40,200'], sp: ['190,235,255', '60,120,255'], hot: '#cfe8ff' },
 { fx: '#b36bff', fill: '#9a4bff', core: ['252,240,255', '220,160,255', '140,60,255'], tg: ['250,235,255', '215,150,255', '150,70,255', '80,20,170'], sp: ['235,190,255', '150,70,255'], hot: '#ecd2ff' }
];
function lightenHex(c, t = .5) {
 const m = /^#([0-9a-f]{6})$/i.exec(c || '');
 if (!m) return c || '#fff';
 const n = parseInt(m[1], 16);
 const f = v => Math.round(v + (255 - v) * t);
 return '#' + [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
}
function shadeHex(c, k = .8) {
 const m = /^#([0-9a-f]{6})$/i.exec(c || '');
 if (!m) return c || '#444';
 const n = parseInt(m[1], 16);
 const r = Math.round(((n >> 16) & 255) * k);
 const g = Math.round(((n >> 8) & 255) * k);
 const b = Math.round((n & 255) * k);
 return `rgb(${r},${g},${b})`;
}
function projGlow(ctx, r, c, alpha = .28) {
 alpha *= GLOW[SET.gw];
 if (alpha < .004) return;
 ctx.save();
 ctx.globalCompositeOperation = 'lighter';
 ctx.globalAlpha = alpha * .45; ctx.fillStyle = c;
 ctx.beginPath(); ctx.arc(0, 0, r * 2.25, 0, 7); ctx.fill();
 ctx.globalAlpha = alpha * .55;
 ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, 7); ctx.fill();
 ctx.restore();
}
function jet(ctx, r, c, hot = '#fff4cf', base = -r * .84, k = 1, W0 = 0) {
 if (!SET.fl) return;
 const t = (typeof R?.t === 'number') ? R.t : 0;
 const W = (W0 || Math.max(2.2, r * .62));
 const fl = .88 + .22 * Math.sin(t * 34 + r * 1.3) + .08 * Math.sin(t * 57 + r);
 const Lf = Math.max(9, r * 2.7) * k * fl;
 const wig = Math.sin(t * 41 + r * 2) * W * .22;
 ctx.save();
 // Engine nozzle: small dark collar so the flame reads as coming out of a jet.
 ctx.globalCompositeOperation = 'source-over';
 ctx.shadowBlur = 0; ctx.fillStyle = shadeHex(c, .45);
 ctx.fillRect(base - W * .35, -W * .95, W * .75, W * 1.9);
 // Exhaust plume: outer glow, mid flame, hot core (same layering as the host's jet).
 ctx.globalCompositeOperation = 'lighter';
 ctx.shadowColor = c; ctx.shadowBlur = Math.max(4, r * 1.2);
 const plume = (len, w, col, al) => {
  ctx.globalAlpha = al; ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(base, -w);
  ctx.quadraticCurveTo(base - len * .45, -w * 1.05, base - len, wig);
  ctx.quadraticCurveTo(base - len * .45, w * 1.05, base, w);
  ctx.closePath(); ctx.fill();
 };
 if (SET.fl > 1) plume(Lf * 1.2, W * 1.15, c, .55);
 plume(Lf, W * .85, c, .9);
 ctx.shadowBlur = 0;
 plume(Lf * .68, W * .55, hot, .95);
 if (SET.fl > 1) plume(Lf * .38, W * .26, '#ffffff', .95);
 ctx.restore();
}
function poly(ctx, r, n, rot = 0, wobble = .035) {
 ctx.beginPath();
 for (let i = 0; i < n; i++) {
  const a = rot + i * Math.PI * 2 / n;
  const rr = r * (1 + Math.sin(i * 3.1) * wobble);
  const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
  if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
 }
 ctx.closePath();
}
function fireBlob(ctx, r, seed = 0) {
 const pts = [[1.05,0],[.73,.62],[.26,.98],[-.34,.86],[-.9,.5],[-1.02,-.05],[-.62,-.72],[-.08,-1.02],[.52,-.77]];
 ctx.beginPath();
 pts.forEach(([sx,sy],i)=>{ const w=1+.035*Math.sin(seed+i*2.4), px=sx*r*w, py=sy*r*w; if(!i)ctx.moveTo(px,py); else ctx.lineTo(px,py); });
 ctx.closePath();
}
function drawEnemyTelegraphs(ctx, e) {
 const c = e.c || '#fff', now = R.t;
 ctx.save();
 ctx.globalCompositeOperation = 'lighter';

 // Shielder: a persistent protective field around nearby allies.
 if (e.beh === 'aura' && !e.dead) {
  const pulse = 1 + Math.sin(now * 3.2 + e.x * .03) * .035;
  const rr = 95 * pulse;
  ctx.globalAlpha = .07; ctx.fillStyle = c;
  ctx.beginPath(); ctx.arc(e.x, e.y, rr, 0, 7); ctx.fill();
  ctx.globalAlpha = .22; ctx.strokeStyle = c; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(e.x, e.y, rr, 0, 7); ctx.stroke();
  ctx.globalAlpha = .55; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
   const a = now * .35 + i * Math.PI / 3;
   ctx.beginPath(); ctx.arc(e.x, e.y, rr + 2, a, a + .13); ctx.stroke();
  }
 }

 // Dashers: show the queued charge direction before the burst.
 if (e.beh === 'dash' && e.st > 0 && !e.dead) {
  const dx = e.lx || 0, dy = e.ly || 0, phase = e.st === 1 ? .5 : 1;
  ctx.globalAlpha = e.st === 1 ? .22 : .35; ctx.strokeStyle = c; ctx.lineWidth = 2.2;
  ctx.setLineDash([7, 5]);
  ctx.beginPath(); ctx.moveTo(e.x - dx * 8, e.y - dy * 8); ctx.lineTo(e.x + dx * (105 + 20 * phase), e.y + dy * (105 + 20 * phase)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = .12; ctx.fillStyle = c;
  ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + dx * 115 - dy * 8, e.y + dy * 115 + dx * 8);
  ctx.lineTo(e.x + dx * 115 + dy * 8, e.y + dy * 115 - dx * 8); ctx.closePath(); ctx.fill();
 }

 // Summoner: a faint summoning ring that tightens as the summon comes due.
 if (e.beh === 'summon' && !e.dead) {
  const charge = cl(1 - Math.max(0, e.tm) / 4.6, 0, 1);
  const rr = 17 + charge * 7 + Math.sin(now * 6) * 1.5;
  ctx.globalAlpha = .16 + charge * .16; ctx.strokeStyle = c; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(e.x, e.y, rr, 0, 7); ctx.stroke();
  for (let i = 0; i < 3; i++) {
   const a = now * .7 + i * 2.094;
   ctx.globalAlpha = .3 + charge * .25;
   ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * 7, e.y + Math.sin(a) * 7); ctx.lineTo(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr); ctx.stroke();
  }
 }

 // Nullifier: subtle disruption halo so the disable mechanic reads at a glance.
 if (e.beh === 'null' && !e.dead) {
  const pulse = .5 + .5 * Math.sin(now * 8 + e.x);
  ctx.globalAlpha = .10 + pulse * .10; ctx.strokeStyle = c; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 7 + pulse * 3, 0, 7); ctx.stroke();
  ctx.globalAlpha = .5; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(e.x - 10, e.y - 10); ctx.lineTo(e.x + 10, e.y + 10); ctx.stroke();
 }

 // Runtime Error boss: connected destination graph while teleport is primed.
 if (e.boss && e.tpd && !e.dead) {
  const tx = e.tpd.x, ty = e.tpd.y, dx = tx - e.x, dy = ty - e.y, len = Math.hypot(dx, dy) || 1;
  ctx.globalAlpha = .16; ctx.strokeStyle = c; ctx.lineWidth = 2;
  ctx.setLineDash([5, 7]);
  ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.setLineDash([]);
  const pulse = 1 + Math.sin(now * 10) * .12, r = 15 * pulse;
  ctx.globalAlpha = .28; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(tx, ty, r * 1.7, 0, 7); ctx.fill();
  ctx.globalAlpha = .9; ctx.strokeStyle = '#eadcff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(tx, ty, r, 0, 7); ctx.stroke();
  ctx.globalAlpha = .75; ctx.strokeStyle = c; ctx.beginPath();
  for (let i = 0; i < 4; i++) {
   const a = i * Math.PI / 2, x1 = tx + Math.cos(a) * (r + 5), y1 = ty + Math.sin(a) * (r + 5);
   const x2 = tx + Math.cos(a) * (r + 11), y2 = ty + Math.sin(a) * (r + 11);
   ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  }
  ctx.stroke();
  ctx.globalAlpha = .22; ctx.fillStyle = '#eadcff';
  ctx.beginPath(); ctx.arc(e.x + dx * .5, e.y + dy * .5, Math.min(5, len * .04), 0, 7); ctx.fill();
 }

 ctx.restore();
}

function drawProjectile(ctx, q, enemy = false) {
 const col = q.a?.col || q.c || '#fff';
 const r = Math.max(2.5, q.r || 4);
 const vx = q.vx || 1, vy = q.vy || 0, ang = Math.atan2(vy, vx);
 const shape = q.shape || q.kind || 'orb';
 const outline = shadeHex(col, .90);
 const hot = shape === 'shooter' ? '#eadcff' : '#fff2c4';

 ctx.save();
 ctx.translate(q.x, q.y);
 ctx.rotate(ang);
 projGlow(ctx, r, col, enemy ? .22 : .30);

 ctx.globalCompositeOperation = 'source-over';
 ctx.lineJoin = 'round';
 ctx.lineCap = 'round';
 ctx.lineWidth = Math.max(1.1, r * .24);
 ctx.strokeStyle = outline;
 ctx.shadowColor = col;
 ctx.shadowBlur = Math.max(2, r * .9);
 ctx.fillStyle = col;

 if (!enemy && shape === 'fireball') {
  fireBlob(ctx, r * 1.18, q.x * .05 + q.y * .03); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = '#ffd36a'; fireBlob(ctx, r * .70, 2.1); ctx.fill();
  ctx.fillStyle = '#fff7db'; ctx.beginPath(); ctx.arc(r * .20, -r * .16, Math.max(1.2, r * .23), 0, 7); ctx.fill();
 } else if (!enemy && shape === 'bolt') {
  ctx.beginPath(); ctx.arc(0, 0, r * 1.04, 0, 7); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = '#eaffff'; ctx.beginPath(); ctx.arc(r * .18, -r * .15, Math.max(1.1, r * .25), 0, 7); ctx.fill();
 } else if (!enemy && shape === 'lance') {
  // Lance: concave arrowhead — sharp tip, swept-back barbs, notched tail where the jet burns.
  const L = r * 2.7, Wk = r * 1.15, bx = -L * .66, notch = -L * .22;
  jet(ctx, r, col, hot, notch, 1.05, Wk * .45);
  ctx.shadowBlur = Math.max(2, r * .9); ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(L, 0); ctx.lineTo(bx, -Wk); ctx.lineTo(notch, 0); ctx.lineTo(bx, Wk);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = .7; ctx.fillStyle = outline;
  ctx.beginPath();
  ctx.moveTo(L * .55, 0); ctx.lineTo(bx * .62, -Wk * .5); ctx.lineTo(notch * .9, 0); ctx.lineTo(bx * .62, Wk * .5);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff0a8';
  ctx.beginPath();
  ctx.moveTo(L * .96, 0); ctx.lineTo(L * .5, -Wk * .28); ctx.lineTo(L * .56, 0); ctx.lineTo(L * .5, Wk * .28);
  ctx.closePath();
  ctx.fill();
  ctx.restore(); return;
 } else if (shape === 'shooter') {
  // Purple sun: round core + tiny directional rays.
  ctx.shadowBlur = 0; ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.08, 0, 7); ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = outline; ctx.lineWidth = Math.max(1, r * .18);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.globalAlpha = .75; ctx.beginPath(); ctx.moveTo(Math.cos(a)*r*1.15, Math.sin(a)*r*1.15); ctx.lineTo(Math.cos(a)*r*1.5, Math.sin(a)*r*1.5); ctx.stroke(); }
  ctx.globalAlpha = 1; ctx.fillStyle = '#e8d7ff'; ctx.beginPath(); ctx.arc(r*.15,-r*.12,Math.max(1.2,r*.28),0,7); ctx.fill();
 } else if (shape === 'runtime') {
  poly(ctx, r * 1.15, 3, -Math.PI / 2, .02); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = '#eadcff'; poly(ctx, r*.52, 3, -Math.PI/2, 0); ctx.fill();
 } else if (shape === 'leak') {
  poly(ctx, r * 1.17, 7, -.25, .09); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = '#c8f6a0'; fireBlob(ctx, r*.52, q.x*.05); ctx.fill();
 } else if (shape === 'segfault') {
  fireBlob(ctx, r*1.18, q.y*.04); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = '#ff9d8a'; poly(ctx, r*.52, 5, -.15, .04); ctx.fill();
 } else {
  ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = hot; ctx.beginPath(); ctx.arc(r*.12,-r*.10,Math.max(1.1,r*.24),0,7); ctx.fill();
 }
 // Keep the two mini-jets visibly outside the projectile body.
 if (!enemy || SET.ef) jet(ctx, r, col, hot);
 ctx.restore();
}

function draw(x) {
 const c = R.col, A = ARENAS[G.cfg.arena], p = R.p, H0 = HOSTS[G.host], hc = H0.c, hg = H0.g;
 x.save();
 x.fillStyle = c.pan; x.fillRect(0, 0, W, H);
 if (R.shake > .4) x.translate((Math.random() - .5) * R.shake * SET.shake, (Math.random() - .5) * R.shake * SET.shake);
 x.drawImage(R.bg, 0, 0);

 if (R.term) {
  const t = R.term;
  x.strokeStyle = c.chip; x.lineWidth = 2; x.globalAlpha = .5;
  x.strokeRect(t.x - 12, t.y - 12, 24, 24); x.globalAlpha = 1;
  x.beginPath(); x.arc(t.x, t.y, 20, -1.57, -1.57 + 6.283 * t.p); x.stroke();
  x.fillStyle = c.chip; x.font = "700 13px 'JetBrains Mono',monospace"; x.textAlign = 'center';
  x.fillText('>_', t.x, t.y);
  for (const k of R.pk) if (!k.got) {
   x.fillStyle = c.gold; x.beginPath();
   x.moveTo(k.x, k.y - 7); x.lineTo(k.x + 6, k.y); x.lineTo(k.x, k.y + 7); x.lineTo(k.x - 6, k.y); x.fill();
  }
 }
 for (const t of R.tg) {
  if (t.mine) {
   x.save(); x.globalCompositeOperation = 'lighter';
   x.globalAlpha = .28; x.fillStyle = t.c; x.beginPath(); x.arc(t.x, t.y, 18, 0, 7); x.fill();
   x.globalAlpha = .8; x.strokeStyle = t.c; x.lineWidth = 1.5; x.beginPath(); x.arc(t.x, t.y, 18, 0, 7); x.stroke();
   x.restore();
   continue;
  }
  const k = 1 - t.t / t.max;
  x.strokeStyle = k > .65 && ((R.t * 18) | 0) % 2 ? '#fff' : t.c;
  x.globalAlpha = .9; x.lineWidth = 2;
  x.beginPath(); x.arc(t.x, t.y, t.r, 0, 7); x.stroke();
  x.globalAlpha = .25; x.fillStyle = t.c;
  x.beginPath(); x.arc(t.x, t.y, t.r * k, 0, 7); x.fill();
  x.globalAlpha = 1;
 }

 for (const f of R.fx) {
  if (f.slash) {
   const k0 = 1 - f.l / f.d, k = 1 - Math.pow(1 - k0, 2.2), sw = -(f.w || 1.2) + 2 * (f.w || 1.2) * k, fade = Math.min(1, f.l / f.d * 2.2);
   x.save(); x.globalCompositeOperation = 'lighter'; x.lineCap = 'round';
   for (let i = 0; i < 7; i++) {
    x.globalAlpha = (1 - i / 7) * Math.min(1, k * 1.4) * fade * .8;
    x.strokeStyle = i < 2 ? lightenHex(f.c, .6) : f.c;
    x.lineWidth = 12 - i * 1.45; x.shadowColor = f.c; x.shadowBlur = i < 3 ? 8 : 3;
    x.beginPath(); x.arc(f.x, f.y, f.max * (.83 + i * .025), f.a + sw - i * .16 - .16, f.a + sw - i * .16); x.stroke();
   }
   // darker core inside the lighter rim (like fireball), normal blending so it stays solid instead of washing out
   x.globalCompositeOperation = 'source-over'; x.shadowBlur = 0; x.strokeStyle = shadeHex(f.c, .72);
   for (let i = 0; i < 4; i++) {
    x.globalAlpha = (1 - i / 5) * Math.min(1, k * 1.4) * fade * .7;
    x.lineWidth = 4.6 - i * 1.0;
    x.beginPath(); x.arc(f.x, f.y, f.max * (.83 + i * .025), f.a + sw - i * .16 - .16, f.a + sw - i * .16); x.stroke();
   }
   x.restore(); continue;
  }
  if (f.nova) {
   const k = f.l / f.d, p = 1 - k;
   x.save(); x.globalCompositeOperation = 'lighter';
   x.globalAlpha = k * .55; x.strokeStyle = f.c; x.lineWidth = 7; x.shadowColor = f.c; x.shadowBlur = 10;
   x.beginPath(); x.arc(f.x, f.y, f.max * p, 0, 7); x.stroke();
   x.globalAlpha = k * .45; x.lineWidth = 2.5;
   x.beginPath(); x.arc(f.x, f.y, f.max * p * .62, 0, 7); x.stroke();
   x.globalAlpha = k * .8; x.fillStyle = '#fff7db';
   x.beginPath(); x.arc(f.x, f.y, Math.max(3, f.max * .06 * k), 0, 7); x.fill();
   x.restore(); continue;
  }
  if (f.mine) {
   const k = 1 - f.t / f.max, pulse = 1 + Math.sin(R.t * 9) * .08;
   x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = .75; x.strokeStyle = f.c; x.lineWidth = 2; x.shadowColor = f.c; x.shadowBlur = 7;
   x.beginPath(); x.arc(f.x, f.y, 9 * pulse, 0, 7); x.stroke();
   x.globalAlpha = .95; x.fillStyle = '#241b34'; x.beginPath(); x.arc(f.x, f.y, 5.5, 0, 7); x.fill();
   x.fillStyle = f.c; x.beginPath(); x.arc(f.x, f.y, 2.5 + 2 * k, 0, 7); x.fill();
   x.globalAlpha = .35 + .25 * k; x.fillStyle = f.c; x.beginPath(); x.arc(f.x, f.y, 14 + 5 * k, 0, 7); x.fill();
   x.restore(); continue;
  }
  if (f.star) {
   // Ping impact: spiky starburst (like a comic-book pop), lighter rim + darker core, normal blending (no additive glow).
   const k = Math.max(0, f.l / f.d), grow = Math.min(1, (1 - k) * 3.2 + .35);
   const R0 = f.max * grow, n = f.small ? 7 : 9;
   x.save(); x.translate(f.x, f.y); x.rotate((f.seed || 0) + (1 - k) * .5);
   const spike = (ro, ri, rot) => {
    x.beginPath();
    for (let i = 0; i < n * 2; i++) {
     const an = i * Math.PI / n + rot, rr = i % 2 ? ri : ro * (1 + .22 * Math.sin(i * 2.7 + (f.seed || 0) * 5));
     x.lineTo(Math.cos(an) * rr, Math.sin(an) * rr);
    }
    x.closePath();
   };
   x.globalAlpha = k * .92; x.lineJoin = 'miter';
   x.fillStyle = lightenHex(f.c, .55); x.strokeStyle = f.c; x.lineWidth = 1.4;
   spike(R0, R0 * .42, 0); x.fill(); x.stroke();
   x.fillStyle = shadeHex(f.c, .55);
   spike(R0 * .6, R0 * .3, .2); x.fill();
   x.restore(); continue;
  }
  if (f.cone) {
   const k = f.l / f.d;
   const rr = Math.max(12, f.max * Math.min(1, f.r / f.max * 2.2));
   x.save();
   x.globalCompositeOperation = 'lighter';
   x.translate(f.x, f.y); x.rotate(f.a);
   if (f.stdout) {
    // stdout(): a wide flame jet: tongues of fire fanning out of a hot core, gradient sparks flying past the cone edge.
    const P = STDOUT_PAL[f.tier || 0], q = SET.fl, nT = [4, 7, 11][q], nS = [0, 8, 16][q], prog = 1 - k;
    x.globalAlpha = k * .07; x.fillStyle = P.fill; // faint cone marks the real damage area
    x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, f.max, -f.h, f.h); x.closePath(); x.fill();
    x.globalAlpha = 1;
    const GK = GLOW[SET.gw], cr = 30 + rr * .12, cg = x.createRadialGradient(10, 0, 1, 10, 0, cr);
    cg.addColorStop(0, 'rgba(' + P.core[0] + ',' + (k * .95 * GK) + ')'); cg.addColorStop(.45, 'rgba(' + P.core[1] + ',' + (k * .6 * GK) + ')'); cg.addColorStop(1, 'rgba(' + P.core[2] + ',0)');
    if (GK > 0) { x.fillStyle = cg; x.beginPath(); x.arc(10, 0, cr, 0, 7); x.fill(); }
    x.globalCompositeOperation = 'source-over'; // tongues + sparks use normal blending so their color reads on light arenas too
    for (let i = 0; i < nT; i++) {
     const u = nT > 1 ? i / (nT - 1) * 2 - 1 : 0;
     const ang = u * f.h * .92 + Math.sin(R.t * 17 + i * 2.3) * .05;
     const len = rr * (.66 + .34 * Math.cos(u * 1.3)) * (.88 + .12 * Math.sin(R.t * 23 + i * 1.7));
     const w = (7 + 5 * (1 - Math.abs(u))) * (.8 + .2 * k);
     x.save(); x.rotate(ang);
     const g = x.createLinearGradient(6, 0, Math.max(8, len), 0);
     g.addColorStop(0, 'rgba(' + P.tg[0] + ',' + (k * .9) + ')'); g.addColorStop(.28, 'rgba(' + P.tg[1] + ',' + (k * .75) + ')'); g.addColorStop(.62, 'rgba(' + P.tg[2] + ',' + (k * .5) + ')'); g.addColorStop(1, 'rgba(' + P.tg[3] + ',0)');
     x.fillStyle = g; x.beginPath(); x.moveTo(6, -w * .45);
     x.quadraticCurveTo(len * .45, -w, len, 0); x.quadraticCurveTo(len * .45, w, 6, w * .45); x.closePath(); x.fill();
     x.restore();
    }
    x.lineCap = 'round'; x.lineWidth = 1.6;
    for (let i = 0; i < nS; i++) {
     const h1 = Math.sin(i * 91.7) * 43758.5453, r1 = h1 - Math.floor(h1);
     const h2 = Math.sin(i * 12.9 + 4.1) * 43758.5453, r2 = h2 - Math.floor(h2);
     const ang = (r1 * 2 - 1) * f.h * 1.05, d0 = f.max * (.3 + .85 * r2) * Math.min(1, prog * 1.6 + .15), tl = 5 + 5 * r1;
     const sx = Math.cos(ang) * d0, sy = Math.sin(ang) * d0, ex = sx - Math.cos(ang) * tl, ey = sy - Math.sin(ang) * tl;
     const sg = x.createLinearGradient(sx, sy, ex, ey);
     sg.addColorStop(0, 'rgba(' + P.sp[0] + ',' + (k * .95) + ')'); sg.addColorStop(1, 'rgba(' + P.core[2] + ',0)');
     x.strokeStyle = sg; x.beginPath(); x.moveTo(sx, sy); x.lineTo(ex, ey); x.stroke();
    }
   } else {
    x.globalAlpha = k * .20; x.fillStyle = f.c;
    x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, rr, -f.h, f.h); x.closePath(); x.fill();
    x.globalAlpha = k * .34; x.fillStyle = '#ff9a4d';
    x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, rr * .72, -f.h * .62, f.h * .62); x.closePath(); x.fill();
    x.globalAlpha = k * .68; x.fillStyle = '#ffe7a3';
    x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, rr * .28, -f.h * .38, f.h * .38); x.closePath(); x.fill();
    x.shadowColor = f.c; x.shadowBlur = 7;
    x.globalAlpha = k * .9; x.fillStyle = '#fff4cf';
    x.beginPath(); x.moveTo(2, 0); x.lineTo(11, -3); x.lineTo(11, 3); x.closePath(); x.fill();
   }
   x.restore();
   continue;
  }
  x.globalAlpha = f.l / f.d; x.strokeStyle = f.c; x.lineWidth = 2 + 7 * f.l / f.d;
  x.beginPath(); x.arc(f.x, f.y, f.r, 0, 7); x.stroke();
 }
 x.globalAlpha = 1;

 for (const t of R.ht) {
  const k = Math.max(0, t.l / t.m), sp = Math.hypot(t.vx, t.vy) || 1, dx = t.vx / sp, dy = t.vy / sp, nx = -dy, ny = dx;
  const len = (7 + t.s * 2.2) * (0.7 + 0.3 * k), bend = t.s * 1.5;
  x.save(); x.globalCompositeOperation = 'lighter'; x.lineCap = 'round'; x.lineJoin = 'round';
  x.globalAlpha = k * .7; x.strokeStyle = t.c; x.lineWidth = t.s + 2; x.shadowColor = t.c; x.shadowBlur = 5;
  x.beginPath(); x.moveTo(t.x, t.y);
  x.lineTo(t.x + dx * len * .42 + nx * bend, t.y + dy * len * .42 + ny * bend);
  x.lineTo(t.x + dx * len * .73 - nx * bend * .7, t.y + dy * len * .73 - ny * bend * .7);
  x.lineTo(t.x + dx * len, t.y + dy * len); x.stroke();
  x.globalAlpha = k * .82; x.strokeStyle = '#fff2c4'; x.lineWidth = Math.max(1, t.s * .55); x.shadowBlur = 0;
  x.beginPath(); x.moveTo(t.x, t.y);
  x.lineTo(t.x + dx * len * .40 + nx * bend * .55, t.y + dy * len * .40 + ny * bend * .55);
  x.lineTo(t.x + dx * len * .70 - nx * bend * .4, t.y + dy * len * .70 - ny * bend * .4);
  x.lineTo(t.x + dx * len * .9, t.y + dy * len * .9); x.stroke();
  x.restore();
 }
 x.globalAlpha = 1;

 for (const l of R.lines) {
  const bm = !!l.w, al = Math.min(1, l.l * 9);
  if (l.laser) {
   const dx = l.x2 - l.x1, dy = l.y2 - l.y1, len = Math.hypot(dx, dy) || 1;
   const pulse = .86 + .14 * Math.sin(R.t * (l.ping ? 24 : 18));
   x.save();
   x.globalCompositeOperation = 'lighter';
   x.shadowColor = l.c; x.shadowBlur = l.ping ? 16 : 13;
   x.globalAlpha = al * .28 * pulse; x.strokeStyle = l.c; x.lineWidth = (l.w || 3) * 3.2;
   x.beginPath(); x.moveTo(l.x1, l.y1); x.lineTo(l.x2, l.y2); x.stroke();
   x.globalAlpha = al * .72 * pulse; x.shadowBlur = 8;
   x.lineWidth = (l.w || 3) * 1.35; x.strokeStyle = l.c;
   x.beginPath(); x.moveTo(l.x1, l.y1); x.lineTo(l.x2, l.y2); x.stroke();
   x.globalAlpha = al * .96; x.shadowBlur = 0;
   x.lineWidth = Math.max(1.4, (l.w || 3) * .42); x.strokeStyle = l.core || '#fffbe0';
   x.beginPath(); x.moveTo(l.x1, l.y1); x.lineTo(l.x2, l.y2); x.stroke();
   if (l.orbit) {
    const tx = l.x2 - dx / len * 5, ty = l.y2 - dy / len * 5;
    x.globalAlpha = al * .9; x.strokeStyle = l.c; x.lineWidth = 2;
    x.beginPath(); x.arc(tx, ty, 9, 0, 7); x.stroke();
   }
   x.restore();
  } else if (l.lightning) {
   const dx = l.x2 - l.x1, dy = l.y2 - l.y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
   x.save(); x.globalCompositeOperation = 'lighter'; x.shadowColor = l.c; x.shadowBlur = 8;
   for (let pass = 0; pass < 2; pass++) {
    x.globalAlpha = pass ? al * .95 : al * .32; x.strokeStyle = pass ? '#fff7d1' : l.c; x.lineWidth = pass ? 1.7 : 4;
    x.beginPath(); const steps = 6, amp = Math.min(8, len * .08), seed = l.seed || 0;
    for (let i = 0; i <= steps; i++) {
     const t = i / steps, wob = (i === 0 || i === steps) ? 0 : Math.sin((i + seed * 9) * 4.1) * amp;
     const px = l.x1 + dx * t + nx * wob, py = l.y1 + dy * t + ny * wob;
     if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
    }
    x.stroke();
   }
   x.restore();
  } else {
   x.strokeStyle = l.c; x.globalAlpha = al; x.lineWidth = bm ? l.w : 2.5;
   x.beginPath(); x.moveTo(l.x1, l.y1); x.lineTo(l.x2, l.y2); x.stroke();
  }
 }
 x.globalAlpha = 1;

 for (const q of R.ps) {
  const k = Math.max(0, q.l / q.m);
  if (q.fl) {
   const sp = Math.hypot(q.vx, q.vy) || 1, nx = q.vx / sp, ny = q.vy / sp;
   x.save(); x.globalCompositeOperation = 'lighter';
   x.globalAlpha = k * .72; x.strokeStyle = q.c; x.lineWidth = Math.max(1.3, q.s * (1.05 - .28 * k)); x.lineCap = 'round';
   x.beginPath();
   x.moveTo(q.x, q.y);
   x.lineTo(q.x - nx * (4 + q.s * 1.5), q.y - ny * (4 + q.s * 1.5));
   x.stroke();
   x.globalAlpha = k * .38; x.strokeStyle = '#fff2c4'; x.lineWidth = Math.max(0.8, q.s * .42);
   x.beginPath();
   x.moveTo(q.x, q.y);
   x.lineTo(q.x - nx * (2.5 + q.s * .8), q.y - ny * (2.5 + q.s * .8));
   x.stroke();
   x.restore();
  } else { x.globalAlpha = k; x.fillStyle = q.c; x.fillRect(q.x, q.y, q.s, q.s); }
 }
 x.globalAlpha = 1;
 x.textAlign = 'center'; x.textBaseline = 'middle';

 const orb = p.orb;
 if (orb && orb.a) {
  const oc = orb.a.col || '#8ae0ff', dk = shadeHex(oc, .38);
  x.save();
  for (let i = 0; i < orb.n; i++) {
   if (orb.bl && orb.bl[i] && orb.bl[i].r > 0) continue;
   const an = orb.ang + i * 6.283 / orb.n, bx = p.x + Math.cos(an) * 48, by = p.y + Math.sin(an) * 48;
   x.save(); x.translate(bx, by);
   // Four blades (up / right / down / left) per unit, spinning together; each blade has a darker core inside a lighter rim.
   x.rotate(R.t * 9 + i * 1.9);
   x.shadowColor = oc; x.shadowBlur = SET.q > 0 ? 4 : 0;
   for (let q = 0; q < 4; q++) {
    x.save(); x.rotate(q * Math.PI / 2);
    x.fillStyle = oc; x.strokeStyle = dk; x.lineWidth = 1;
    x.beginPath(); x.moveTo(0, -11.5); x.lineTo(3.6, -5.6); x.lineTo(0, -1.2); x.lineTo(-3.6, -5.6); x.closePath(); x.fill(); x.stroke();
    x.shadowBlur = 0; x.fillStyle = dk;
    x.beginPath(); x.moveTo(0, -9); x.lineTo(1.6, -5.6); x.lineTo(0, -3.2); x.lineTo(-1.6, -5.6); x.closePath(); x.fill();
    x.restore();
   }
   x.restore();
  }
  x.restore();
 }

 for (const e of R.en) {
  drawEnemyTelegraphs(x, e);
  x.globalAlpha = e.ghost ? .12 : .25; x.fillStyle = e.c;
  x.beginPath(); x.arc(e.x, e.y, e.r, 0, 7); x.fill();
  x.globalAlpha = e.ghost ? .7 : 1; x.strokeStyle = e.fl > 0 ? '#fff' : e.c;
  x.lineWidth = e.elite ? 3 : 2; x.beginPath(); x.arc(e.x, e.y, e.r, 0, 7); x.stroke();
  x.font = `700 ${Math.round(e.r * 1.5)}px 'JetBrains Mono',monospace`;
  x.fillStyle = e.fl > 0 ? '#fff' : e.c;
  x.fillText(e.g, e.x, e.y + 1);

  // Clear, animated burn status: flames, glow, and an explicit BURN tag.
  if (e.burn > 0) {
   const bt = R.t * 10 + e.x * .03 + e.y * .02;
   const pulse = .84 + .16 * Math.sin(bt * 1.8);
   x.save();
   x.globalCompositeOperation = 'lighter';
   x.shadowColor = '#ff6a24'; x.shadowBlur = 9;
   for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 + bt * .04;
    const rad = e.r * (0.72 + .08 * Math.sin(bt + i * 1.7));
    const fx = e.x + Math.cos(a) * rad;
    const fy = e.y + Math.sin(a) * rad;
    const fr = e.r * (.20 + .06 * Math.sin(bt * 1.7 + i));
    x.globalAlpha = .72 * pulse;
    x.fillStyle = '#ff5a22';
    x.beginPath();
    x.moveTo(fx, fy + fr);
    x.lineTo(fx - fr * .70, fy);
    x.lineTo(fx - fr * .15, fy - fr * 1.45);
    x.lineTo(fx + fr * .40, fy - fr * .52);
    x.lineTo(fx + fr * .78, fy);
    x.closePath(); x.fill();
    x.globalAlpha = .88 * pulse;
    x.fillStyle = '#ffd36a';
    x.beginPath();
    x.moveTo(fx, fy + fr * .62);
    x.lineTo(fx - fr * .28, fy);
    x.lineTo(fx + fr * .06, fy - fr * .82);
    x.lineTo(fx + fr * .34, fy);
    x.closePath(); x.fill();
   }
   x.globalCompositeOperation = 'source-over';
   x.shadowBlur = 0;
   const tagY = e.y - e.r - 12;
   x.globalAlpha = .95;
   x.fillStyle = 'rgba(42,18,12,.86)';
   const tagW = 44, tagH = 14;
   x.beginPath();
   if (x.roundRect) x.roundRect(e.x - tagW/2, tagY - tagH/2, tagW, tagH, 4);
   else x.rect(e.x - tagW/2, tagY - tagH/2, tagW, tagH);
   x.fill();
   x.strokeStyle = '#ff6a24'; x.lineWidth = 1; x.stroke();
   x.font = "700 8px 'JetBrains Mono',monospace";
   x.fillStyle = '#ffd36a'; x.textAlign = 'center'; x.textBaseline = 'middle';
   x.fillText('BURN', e.x, tagY);
   x.restore();
  }

  // Freeze / armor-weakened indicators, stacked above any BURN tag.
  let stN = e.burn > 0 ? 1 : 0;
  const stTag = (txt, edge, fg, bg) => {
   const ty = e.y - e.r - 12 - stN * 16, tw = 14 + txt.length * 5.2, th = 14;
   x.save(); x.globalAlpha = .95; x.fillStyle = bg; x.beginPath();
   if (x.roundRect) x.roundRect(e.x - tw / 2, ty - th / 2, tw, th, 4); else x.rect(e.x - tw / 2, ty - th / 2, tw, th);
   x.fill(); x.strokeStyle = edge; x.lineWidth = 1; x.stroke();
   x.font = "700 8px 'JetBrains Mono',monospace"; x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, e.x, ty);
   x.restore();
  };
  if (e.slow > 0) {
   x.save();
   x.globalAlpha = .2; x.fillStyle = '#9fe8ff'; x.beginPath(); x.arc(e.x, e.y, e.r, 0, 7); x.fill();
   for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + .2, sh = e.r * (.34 + (i % 2) * .16);
    x.save(); x.translate(e.x, e.y); x.rotate(a);
    x.globalAlpha = .9; x.fillStyle = i % 2 ? '#bff1ff' : '#7fd6ff';
    x.beginPath(); x.moveTo(e.r - 1, 0); x.lineTo(e.r + sh * .35, -sh * .22); x.lineTo(e.r + sh, 0); x.lineTo(e.r + sh * .35, sh * .22); x.closePath(); x.fill();
    x.restore();
   }
   x.restore();
   stTag('FREEZE', '#7fd6ff', '#d8f7ff', 'rgba(10,28,44,.88)'); stN++;
  }
  if (e.vuln > 0) {
   x.save();
   x.globalAlpha = .55 + .35 * Math.sin(R.t * 12); x.strokeStyle = '#ff5c7a'; x.lineWidth = 2.4;
   for (let i = 0; i < 4; i++) { const a0 = i * Math.PI / 2 + .25; x.beginPath(); x.arc(e.x, e.y, e.r + 4, a0, a0 + 1); x.stroke(); }
   x.restore();
   stTag(e.boss ? 'EXPOSED' : 'ARMOR -', '#ff5c7a', '#ffd0d8', 'rgba(44,10,20,.88)'); stN++;
  }
 }
 for (const q of R.pr) drawProjectile(x, q, false);
 for (const b of R.eb) drawProjectile(x, b, true);

 for (const g of R.gh) {
  x.globalAlpha = g.l * 2;
  x.font = "700 24px 'JetBrains Mono',monospace";
  x.fillStyle = hc;
  x.fillText(hg, g.x, g.y);
 }

 // Jet flame attached to host engine exhaust
 if (Math.hypot(p.vx, p.vy) > 20) {
  const an = Math.atan2(p.vy, p.vx) + Math.PI;
  const sp = Math.min(1, Math.hypot(p.vx, p.vy) / 130);
  const L = (12 + 16 * sp) * (.8 + Math.random() * .4) + (p.dash > 0 ? 18 : 0);
  x.save();
  x.translate(p.x + Math.cos(an) * 9, p.y + Math.sin(an) * 9);
  x.rotate(an);
  const J = HOSTS[G.host].j || ['#ff7a45', '#ff3b1f', '#ffe066'];
  x.shadowColor = J[0];
  x.shadowBlur = p.dash > 0 ? 14 : 7;
  x.globalAlpha = .65;
  x.fillStyle = J[1];
  x.beginPath(); x.moveTo(0, -6.5); x.lineTo(L * 1.25, 0); x.lineTo(0, 6.5); x.closePath(); x.fill();
  x.globalAlpha = .9;
  x.fillStyle = J[0];
  x.beginPath(); x.moveTo(0, -5); x.lineTo(L, 0); x.lineTo(0, 5); x.closePath(); x.fill();
  x.fillStyle = J[2];
  x.beginPath(); x.moveTo(0, -2.5); x.lineTo(L * .55, 0); x.lineTo(0, 2.5); x.closePath(); x.fill();
  x.restore();
  x.globalAlpha = 1;
 }

 // Shield visual on host (semicircle in front facing velocity, fainter arc behind)
 const hOutline = shadeHex(hc, .62);
 if (p.sh > 0) {
  const facing = Math.atan2(p.fy, p.fx);
  const shRatio = Math.min(1, p.sh / ST.shmax);
  x.shadowColor = hc;
  x.shadowBlur = 9;
  x.globalAlpha = .95;
  x.strokeStyle = hOutline;
  x.lineWidth = 3.8;
  x.beginPath();
  x.arc(p.x, p.y, 18, facing - Math.PI / 2, facing + Math.PI / 2);
  x.stroke();

  x.globalAlpha = .6 + .4 * shRatio;
  x.strokeStyle = hc;
  x.lineWidth = 2.6;
  x.beginPath();
  x.arc(p.x, p.y, 18, facing - Math.PI / 2, facing + Math.PI / 2);
  x.stroke();

  x.globalAlpha = .2 + .2 * shRatio;
  x.strokeStyle = hOutline;
  x.lineWidth = 1.8;
  x.beginPath();
  x.arc(p.x, p.y, 18, facing + Math.PI / 2, facing + 3 * Math.PI / 2);
  x.stroke();

  x.globalAlpha = .08 * shRatio;
  x.fillStyle = hc;
  x.beginPath();
  x.arc(p.x, p.y, 18, 0, 7);
  x.fill();
  x.globalAlpha = 1;
  x.shadowBlur = 0;
 }

 x.globalAlpha = p.inv > 0 && p.dash <= 0 && ((R.t * 24) | 0) % 2 ? .4 : 1;
 x.font = "700 24px 'JetBrains Mono',monospace";
 x.save(); x.translate(p.x, p.y); x.rotate((p.ang ?? -1.5708) + 1.5708);
 x.lineJoin = 'round';
 x.lineWidth = 2.2;
 x.shadowColor = hc; x.shadowBlur = 9 + 3 * Math.sin(R.t * 4);
 x.strokeStyle = hOutline;
 x.strokeText(hg, 0, 0);
 x.shadowBlur = 0;
 x.fillStyle = hc;
 x.fillText(hg, 0, 0);
 x.restore();
 x.globalAlpha = 1;

 x.textAlign = 'center';
 x.textBaseline = 'middle';
 for (const t of R.tx) {
  x.globalAlpha = Math.min(1, t.t * 2);
  x.font = `700 ${t.s}px 'JetBrains Mono',monospace`;
  x.fillStyle = t.c; x.fillText(t.v, t.x, t.y);
 }
 x.globalAlpha = 1;
 if (R.flash > 0) {
  x.fillStyle = 'rgba(255,60,90,' + R.flash * 1.2 + ')';
  x.fillRect(0, 0, W, H);
 }
 x.restore();

 // UI Overlay - Top Left HUD Card (HP, Shield, Dash)
 x.save();
 x.textAlign = 'left';
 x.textBaseline = 'middle';
 x.font = "700 11px 'JetBrains Mono',monospace";

 x.fillStyle = 'rgba(18, 22, 34, 0.78)';
 x.strokeStyle = 'rgba(255, 255, 255, 0.14)';
 x.lineWidth = 1;
 x.beginPath();
 if (x.roundRect) x.roundRect(8, 8, 204, 52, 6);
 else x.rect(8, 8, 204, 52);
 x.fill();
 x.stroke();

 // 1. HP Bar
 x.fillStyle = 'rgba(255, 255, 255, 0.12)';
 x.fillRect(14, 14, 108, 8);
 x.fillStyle = c.mult;
 x.fillRect(14, 14, 108 * Math.max(0, G.hp) / G.max, 8);
 x.fillStyle = '#fff';
 x.font = "700 10.5px 'JetBrains Mono',monospace";
 x.fillText(`HP ${Math.ceil(G.hp)}/${G.max}`, 128, 18);

 // 2. Shield Bar
 x.fillStyle = 'rgba(255, 255, 255, 0.12)';
 x.fillRect(14, 26, 108, 6);
 const shPct = Math.min(1, Math.max(0, p.sh) / ST.shmax);
 if (shPct > 0) {
  x.fillStyle = c.chip;
  x.fillRect(14, 26, 108 * shPct, 6);
 }
 x.fillStyle = shPct > 0 ? c.chip : 'rgba(255, 255, 255, 0.45)';
 x.fillText(`SHIELD ${Math.ceil(p.sh)}/${ST.shmax}`, 128, 29);

 // 3. Dash Meter
 x.fillStyle = 'rgba(255, 255, 255, 0.12)';
 x.fillRect(14, 37, 108, 6);
 const dashReady = p.dcd <= 0;
 const dashProgress = dashReady ? 1 : Math.max(0, 1 - (p.dcd / (1.5 * ST.dashcd)));
 x.fillStyle = dashReady ? c.chip : c.mu;
 x.fillRect(14, 37, 108 * dashProgress, 6);
 x.fillStyle = dashReady ? c.chip : 'rgba(255, 255, 255, 0.6)';
 x.fillText(dashReady ? 'DASH READY' : `DASH ${p.dcd.toFixed(1)}s`, 128, 40);
 x.restore();

 x.save();
 x.textAlign = 'right';
 x.textBaseline = 'middle';
 x.font = "700 11px 'JetBrains Mono',monospace";
 x.fillStyle = c.ink;
 x.fillText(`${G.sector}-${G.layer} ${G.world?.n || 'Sector'}: ${A.n}${G.cfg?.elite ? ' [ELITE]' : ''}`, W - 10, 15);
 x.fillText(`bugs ${R.en.length + (R.boss ? 0 : Math.ceil(Math.max(0, R.budget) / 1.2))}`, W - 10, 29);

 if (R.term) {
  x.fillStyle = c.chip;
  x.fillText(`hack ${Math.round((R.term.p || 0) * 100)}%  data ${R.pk.filter(k => k.got).length}/3`, W - 10, 43);
 }

 const bs = R.en.find(e => e.boss);
 if (bs && bs.bd0) {
  x.textAlign = 'center';
  x.fillStyle = c.mu;
  x.fillRect(150, 44, 340, 8);
  x.fillStyle = bs.c;
  x.fillRect(150, 44, 340 * Math.max(0, bs.hp) / (bs.max || 1), 8);
  x.fillStyle = c.ink;
  x.font = "700 11px 'JetBrains Mono',monospace";
  x.fillText(bs.bd0.n + (bs.vuln > 0 ? '  [EXPOSED x1.5]' : ''), 320, 64);
 }

 // Bottom spell pipeline casting monitors
 x.textAlign = 'left';
 const fs = 11;
 const nCasts = (R.casts && R.casts.length) ? R.casts.length : 1;
 const cw = Math.min(150, Math.max(60, Math.floor((W - 20) / nCasts - 4)));
 // Each cast is drawn as a mini card: rarity edge, spell name, cooldown, a chip for EVERY modifier (wrapping), cooldown bar.
 (SET.cc ? (R.casts || []) : []).forEach((k, i) => {
  const bx = 10 + i * (cw + 4), bottom = H - 8;
  if (SET.cc === 1) {
   // Compact: plain text, wrapped so every modifier shows, with a cooldown bar.
   const spd0 = SPELLS[k.c?.sp], dis0 = k.dis > 0;
   const mods0 = (k.c?.mods || []).map((m, mi) => (MODS[m]?.n || m) + (k.c.mv && k.c.mv[mi] > 1 ? ' v' + k.c.mv[mi] : ''));
   x.save(); x.font = `700 10px 'JetBrains Mono',monospace`; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
   const lines = []; let cur = '';
   for (const m of mods0) {
    const t = cur ? cur + ' ' + m : m;
    if (cur && x.measureText(t).width > cw) { lines.push(cur); cur = m; } else cur = t;
   }
   if (cur) lines.push(cur);
   x.fillStyle = 'rgba(255, 255, 255, 0.15)'; x.fillRect(bx, bottom - 6, cw, 6);
   x.fillStyle = dis0 ? '#ff5c7a' : c.gold;
   x.fillRect(bx, bottom - 6, cw * (dis0 ? 1 : 1 - Math.max(0, k.t) / (k.cdm || 1)), 6);
   x.fillStyle = dis0 ? '#ff5c7a' : c.ink;
   x.fillText((spd0?.n || k.c?.sp || 'spell()') + (k.c?.lv > 1 ? ' v' + k.c.lv : ''), bx, bottom - 11);
   x.fillStyle = c.mu;
   lines.slice().reverse().forEach((ln2, li) => x.fillText(ln2, bx, bottom - 23 - li * 12));
   x.restore(); return;
  }
  const spd = SPELLS[k.c?.sp], rc = RC[spd?.r] || '#9d92b5', dis = k.dis > 0;
  const mods = (k.c?.mods || []).map((m, mi) => (MODS[m]?.n || m) + (k.c.mv && k.c.mv[mi] > 1 ? ' v' + k.c.mv[mi] : ''));
  x.font = `700 9px 'JetBrains Mono',monospace`;
  const rows = [[]]; let cx = 0;
  for (let m of mods) {
   while (m.length > 3 && x.measureText(m).width + 8 > cw - 8) m = m.slice(0, -2) + '…';
   const w = Math.ceil(x.measureText(m).width) + 8;
   if (cx > 0 && cx + w > cw - 8) { rows.push([]); cx = 0; }
   rows[rows.length - 1].push({ m, w, cx }); cx += w + 3;
  }
  const nRows = mods.length ? rows.length : 0;
  const hh = 6 + 14 + (nRows ? nRows * 15 + 2 : 0) + 10, top = bottom - hh;
  x.save();
  x.globalAlpha = .88; x.fillStyle = 'rgba(16,19,26,1)'; x.beginPath();
  if (x.roundRect) x.roundRect(bx, top, cw, hh, 4); else x.rect(bx, top, cw, hh);
  x.fill();
  x.globalAlpha = 1; x.strokeStyle = dis ? '#ff5c7a' : rc; x.lineWidth = 1; x.stroke();
  x.fillStyle = dis ? '#ff5c7a' : rc; x.fillRect(bx + 1, top + 1, cw - 2, 3);
  x.beginPath(); x.rect(bx + 2, top, cw - 4, hh); x.clip();
  const spName = SPELLS[k.c?.sp]?.n || k.c?.sp || 'spell()';
  const cdSec = Number.isFinite(k.cds) ? k.cds.toFixed(1) : '1.0';
  x.font = `700 10px 'JetBrains Mono',monospace`; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
  x.fillStyle = dis ? '#ff5c7a' : '#e8ecf5';
  x.fillText(spName + (k.c?.lv > 1 ? ' v' + k.c.lv : ''), bx + 4, top + 17);
  x.font = `700 8px 'JetBrains Mono',monospace`; x.textAlign = 'right'; x.fillStyle = '#9aa3b8';
  x.fillText(cdSec + 's', bx + cw - 4, top + 17);
  x.textAlign = 'left';
  rows.forEach((row, ri2) => row.forEach(ch => {
   const cxp = bx + 4 + ch.cx, cyp = top + 22 + ri2 * 15;
   x.fillStyle = 'rgba(138,224,255,.16)'; x.beginPath();
   if (x.roundRect) x.roundRect(cxp, cyp, ch.w, 12, 3); else x.rect(cxp, cyp, ch.w, 12);
   x.fill(); x.strokeStyle = 'rgba(138,224,255,.6)'; x.lineWidth = 1; x.stroke();
   x.font = `700 9px 'JetBrains Mono',monospace`; x.fillStyle = '#bff1ff'; x.fillText(ch.m, cxp + 4, cyp + 9);
  }));
  x.fillStyle = 'rgba(255, 255, 255, 0.15)'; x.fillRect(bx + 4, bottom - 7, cw - 8, 4);
  x.fillStyle = dis ? '#ff5c7a' : c.gold;
  x.fillRect(bx + 4, bottom - 7, (cw - 8) * (dis ? 1 : 1 - Math.max(0, k.t) / (k.cdm || 1)), 4);
  x.restore();
 });

 if (R.banner) {
  x.textAlign = 'center';
  x.globalAlpha = Math.min(1, Math.max(0, R.banner.t));
  x.font = "900 26px 'Grenze Gotisch',serif";
  x.fillStyle = c.mult;
  x.fillText(R.banner.s, 320, 130);
  x.globalAlpha = 1;
 }
 x.restore();
}

const BOOT_LINES = [
 '> SPELLCODE RUNTIME ENVIRONMENT',
 '> initializing execution context........ OK',
 '> resolving runtime dependencies....... OK',
 '> mounting /usr/bin.................... OK',
 '> validating syscall interface.......... OK',
 '> checking stack integrity.............. OK',
 '> resolving bytecode registry........... OK',
 '> compiling runtime hooks............... OK',
 '> verifying execution context........... STABLE',
 '',
 '> runtime integrity: VERIFIED'
];
let bootReady = false;
function renderBoot() {
 const A = $('#app');
 A.innerHTML = `<div id="boot-screen"><div class="boot-window"><div class="boot-head">SPELLCODE SYSTEMS // INTERNAL RUNTIME</div><div id="boot-lines"></div><div class="boot-prompt">C:\\SPELLCODE\\RUNTIME&gt; <span class="boot-cursor"></span></div><button class="btn" data-act="initialize" disabled>${bootReady ? 'INITIALIZE RUNTIME' : 'INITIALIZING...'}</button></div></div>`;
 const out = $('#boot-lines'); let i = 0;
 const tick = () => {
  if (i >= BOOT_LINES.length) {
   bootReady = true;
   const b = $('#boot-screen [data-act="initialize"]');
   if (b) { b.disabled = false; b.textContent = 'INITIALIZE RUNTIME'; }
   return;
  }
  const line = BOOT_LINES[i++];
  const el = document.createElement('div');
  el.className = 'boot-line ' + (line.endsWith('OK') || line.includes('VERIFIED') || line.includes('STABLE') ? 'boot-ok' : '');
  el.textContent = line;
  out.appendChild(el);
  setTimeout(tick, line ? 60 : 35);
 };
 tick();
}

let sectorLoading = false, sectorLoadToken = 0;

const LOAD_STYLE = {
 'Boot Sector': { bg: '#050a06', accent: '#62ff79', hi: '#c2ffd0', ok: '#8dff9c', dim: '#397946', glow: 'rgba(40,255,80,.12)' },
 'Deadlock': { bg: '#050914', accent: '#4f8cff', hi: '#c6ddff', ok: '#8ec7ff', dim: '#46678f', glow: 'rgba(70,130,255,.16)' },
 'The Heap': { bg: '#100b05', accent: '#ffb04f', hi: '#ffe0b0', ok: '#ffc778', dim: '#8f6840', glow: 'rgba(255,160,60,.14)' },
 '/dev/null': { bg: '#09060e', accent: '#b56cff', hi: '#ead5ff', ok: '#c99cff', dim: '#73508f', glow: 'rgba(180,100,255,.15)' },
 'Kernel': { bg: '#0d0905', accent: '#ff765c', hi: '#ffd0c7', ok: '#ff9d8a', dim: '#8f5047', glow: 'rgba(255,100,80,.15)' }
};

function loadWorldStyle(w) {
 const known = LOAD_STYLE[w?.n];
 if (known) return known;
 const c = w?.c || ['#7ad8ff', '#3878b8'];
 return { bg: '#060a10', accent: c[1], hi: c[0], ok: c[0], dim: c[1], glow: 'rgba(80,150,255,.12)' };
}

function loadLines(from, to) {
 const f = from?.n || 'runtime', t = to?.n || 'runtime';
 const refs = {
  'Boot Sector': ['flushing boot hooks', 'closing init handles', 'syncing process table'],
  'Deadlock': ['releasing mutex wait graph', 'resolving lock ownership', 'validating thread scheduling'],
  'The Heap': ['walking allocation map', 'rebuilding free lists', 'checking heap fragmentation'],
  '/dev/null': ['closing stdout pipe', 'redirecting orphaned streams', 'verifying sink descriptors'],
  'Kernel': ['entering privileged context', 'validating syscall boundary', 'sealing runtime interface']
 };
 const r = refs[t] || ['resolving execution context', 'mounting sector namespace', 'synchronizing runtime hooks'];
 return [
  `> unloading ${f.toLowerCase()}................. OK`,
  `> releasing sector handles............ OK`,
  ``,
  `> mounting ${t.toLowerCase()}..................... OK`,
  `> ${r[0]}................ OK`,
  `> ${r[1]}................ OK`,
  `> ${r[2]}................ OK`,
  `> checking unauthorized processes..... 0 FOUND`,
  ``,
  `> execution context: ${t.toUpperCase()}`,
  `> sector mount: COMPLETE`
 ];
}

const waitReady = k => Promise.race([preloadMusic(k), new Promise(r => setTimeout(r, 1200))]);

function loadGate(root, fill, ready, label, token, go) {
 const b = document.createElement('button');
 b.className = 'btn';
 b.disabled = false;
 b.textContent = label;
 root.querySelector('.load-window').appendChild(b);
 fill.style.width = '100%';
 b.focus();
 ready.then(() => {
  if (token !== sectorLoadToken) return;
  b.disabled = false;
  b.textContent = label;
 });
 b.addEventListener('click', e => {
  e.stopPropagation();
  if (token !== sectorLoadToken) return;
  b.disabled = true;
  snd(880, .06, 'square', .03);
  go();
 });
}

function beginBossLoad(bossKey, after) {
 if (sectorLoading) return;
 sectorLoading = true;
 const token = ++sectorLoadToken;
 const style = {
  segfault: { bg: '#0b0710', accent: '#b56cff', hi: '#ead5ff', ok: '#c99cff', dim: '#6f4d8a', glow: 'rgba(180,100,255,.16)' },
  leak: { bg: '#07100c', accent: '#55e6a5', hi: '#caffea', ok: '#8ff0c3', dim: '#477d68', glow: 'rgba(70,220,150,.15)' },
  runtime: { bg: '#120705', accent: '#ff6a55', hi: '#ffd0c8', ok: '#ff9c8b', dim: '#8f4d43', glow: 'rgba(255,90,70,.17)' }
 }[bossKey] || { bg: '#080a10', accent: '#7aa7ff', hi: '#d8e5ff', ok: '#a9c6ff', dim: '#536b8f', glow: 'rgba(90,140,255,.14)' };
 const names = { segfault: 'SEGFAULT', leak: 'MEMORY LEAK', runtime: 'RUNTIME ERROR' };
 const refs = {
  segfault: ['invalidating stack frames', 'scanning pointer boundaries', 'isolating segmentation fault'],
  leak: ['tracing retained allocations', 'walking unreachable references', 'checking heap pressure'],
  runtime: ['entering final execution path', 'validating syscall boundary', 'locking runtime state']
 };
 const r = refs[bossKey] || refs.segfault;
 const A = $('#app');
 if (!MUTE) ensureMusicContext();
 stopMusic(.45);
 const ready = waitReady(bossTrack(bossKey));
 const root = document.createElement('div');
 root.id = 'sector-load';
 for (const k in style) root.style.setProperty('--load-' + ({ bg: 'bg', accent: 'accent', hi: 'hi', ok: 'ok', dim: 'dim', glow: 'glow' }[k] || k), style[k]);
 root.innerHTML = `<div class="load-window"><div class="load-head">SPELLCODE RUNTIME // THREAT TRANSITION</div><div id="load-lines"></div><div class="load-bar"><div class="load-fill"></div></div><div>&gt; ${names[bossKey] || 'BOSS'} <span class="load-cursor"></span></div></div>`;
 A.replaceChildren(root);
 const out = root.querySelector('#load-lines'), fill = root.querySelector('.load-fill');
 const world = G.world?.n || 'current sector';
 const lines = [
  `> unloading ${world.toLowerCase()}................. OK`,
  `> releasing sector handles............ OK`,
  ``,
  `> mounting ${names[bossKey] || 'BOSS'} context........ OK`,
  `> ${r[0]}................ OK`,
  `> ${r[1]}................ OK`,
  `> ${r[2]}................ OK`,
  `> checking unauthorized processes..... 0 FOUND`,
  ``,
  `> threat profile: ${(names[bossKey] || 'BOSS')}`,
  `> combat context: READY`
 ];
 let i = 0;
 const tick = () => {
  if (token !== sectorLoadToken) return;
  if (i >= lines.length) {
   loadGate(root, fill, ready, 'ENGAGE ' + (names[bossKey] || 'BOSS'), token, () => {
    sectorLoading = false;
    after();
    if (G.view !== 'run') render();
    if (!MUTE) syncMusic();
   });
   return;
  }
  const line = lines[i++];
  const el = document.createElement('div');
  el.className = 'load-line ' + (line.endsWith('OK') || line.includes('READY') || line.includes('FOUND') ? 'load-ok' : line === '' ? 'load-dim' : '');
  el.textContent = line;
  out.appendChild(el);
  fill.style.width = Math.round(i / lines.length * 92) + '%';
  setTimeout(tick, line ? 75 : 45);
 };
 tick();
}

function beginSectorLoad(target, after, initial = false) {
 if (sectorLoading) return;
 sectorLoading = true;
 const token = ++sectorLoadToken, from = G.world, style = loadWorldStyle(target);
 const lines = initial
  ? [`> closing lobby session................ OK`, `> binding host process: ${HOSTS[G.host]?.n?.toUpperCase() || 'HOST'}........ OK`, `> flushing lobby handles............... OK`, ``, `> mounting boot sector.................. OK`, `> allocating execution context......... OK`, `> attaching host to runtime............ OK`, `> synchronizing process table........... OK`, `> checking unauthorized processes..... 0 FOUND`, ``, `> execution context: BOOT SECTOR`, `> sector mount: COMPLETE`]
  : loadLines(from, target);
 const A = $('#app');
 if (!MUTE) ensureMusicContext();
 stopMusic(.45);
 const ready = waitReady(worldTrack(target));
 const root = document.createElement('div');
 root.id = 'sector-load';
 root.style.setProperty('--load-bg', style.bg);
 root.style.setProperty('--load-accent', style.accent);
 root.style.setProperty('--load-hi', style.hi);
 root.style.setProperty('--load-ok', style.ok);
 root.style.setProperty('--load-dim', style.dim);
 root.style.setProperty('--load-glow', style.glow);
 root.innerHTML = `<div class="load-window"><div class="load-head">SPELLCODE RUNTIME // SECTOR TRANSITION</div><div id="load-lines"></div><div class="load-bar"><div class="load-fill"></div></div><div>&gt; ${target?.n?.toUpperCase() || 'SECTOR'} <span class="load-cursor"></span></div></div>`;
 A.replaceChildren(root);
 const out = root.querySelector('#load-lines'), fill = root.querySelector('.load-fill');
 let i = 0;
 const tick = () => {
  if (token !== sectorLoadToken) return;
  if (i >= lines.length) {
   loadGate(root, fill, ready, initial ? 'BEGIN RUN' : 'ENTER ' + (target?.n?.toUpperCase() || 'SECTOR'), token, () => {
    G.world = target;
    G.sh = ST.shmax; // Full shield restored on sector transition!
    sectorLoading = false;
    after();
    render();
    if (!MUTE) syncMusic();
   });
   return;
  }
  const line = lines[i++];
  const el = document.createElement('div');
  el.className = 'load-line ' + (line.endsWith('OK') || line.includes('COMPLETE') || line.includes('FOUND') ? 'load-ok' : line === '' ? 'load-dim' : '');
  el.textContent = line;
  out.appendChild(el);
  fill.style.width = Math.round(i / lines.length * 92) + '%';
  setTimeout(tick, line ? 75 : 45);
 };
 tick();
}

const sec = () => {
 const w = G.world;
 return `<div><span class="sec" style="background-image:linear-gradient(90deg,${w.c[0]},${w.c[1]})">${G.sector}-${G.layer} ${w.g}</span><small style="display:block;color:var(--mute)">Sector ${G.sector}, Layer ${G.layer} [${w.n}]</small></div>`;
};
function head() {
 const pas = Object.keys(G.u).filter(k => G.u[k]).map(k => `<span style="color:${RC[UPG[k]?.r || 0]}" title="${UPG[k]?.d || ''}">${UPG[k]?.n || k}${G.u[k] > 1 ? ' x' + G.u[k] : ''}</span>`).join('');
 const currSh = Math.ceil(G.sh != null ? G.sh : ST.shmax);
 return `<div class="top">${sec()}<span>${HOSTS[G.host].n}</span><span style="color:var(--mult)">HP ${Math.ceil(G.hp)}/${G.max}</span><span style="color:var(--chip)">SH ${currSh}/${ST.shmax}</span><span>deck ${G.deck.length}</span></div><div class="pas">${pas || '<span style="color:var(--mute)">no upgrades yet</span>'}</div>`;
}


function resultLoadStyle(win) {
 return win
  ? { bg: '#06100a', accent: '#62ff79', hi: '#d1ffda', ok: '#91ffa2', dim: '#3c7a48', glow: 'rgba(40,255,80,.14)' }
  : { bg: '#100608', accent: '#ff5c7a', hi: '#ffd0d8', ok: '#ff91aa', dim: '#7f3d4c', glow: 'rgba(255,70,100,.14)' };
}
function renderResultLoad() {
 const A = $('#app'), win = !!G.resultWin, s = resultLoadStyle(win);
 const title = win ? 'POST-RUN // RESOLUTION COMPLETE' : 'POST-RUN // PROCESS HALTED';
 const lines = win ? [
  '> sealing combat state................ OK',
  '> flushing execution trace............ OK',
  '> indexing runtime telemetry.......... OK',
  '> verifying final process state....... RESOLVED',
  '',
  '> preparing run summary............... READY'
 ] : [
  '> capturing fatal process state....... OK',
  '> preserving execution trace.......... OK',
  '> indexing runtime telemetry.......... OK',
  '> verifying final process state....... TERMINATED',
  '',
  '> preparing crash summary............. READY'
 ];
 A.innerHTML = `<div id="sector-load" style="--load-bg:${s.bg};--load-accent:${s.accent};--load-hi:${s.hi};--load-ok:${s.ok};--load-dim:${s.dim};--load-glow:${s.glow}">
  <div class="load-window">
   <div class="load-head">SPELLCODE RUNTIME // ${title}</div>
   <div id="result-load-lines"></div>
   <div class="load-bar"><div class="load-fill"></div></div>
   <div>&gt; RUN SUMMARY <span class="load-cursor"></span></div>
  </div>
 </div>`;
 const root = $('#sector-load'), out = $('#result-load-lines'), fill = root.querySelector('.load-fill');
 let i = 0;
 const tick = () => {
  if (G.view !== 'result-load' || !root.isConnected) return;
  if (i >= lines.length) {
   const b = document.createElement('button');
   b.className = 'btn';
   b.dataset.act = 'initialize-summary';
   b.textContent = 'INITIALIZE RUN SUMMARY';
   root.querySelector('.load-window').appendChild(b);
   b.focus();
   fill.style.width = '100%';
   return;
  }
  const line = lines[i++];
  const el = document.createElement('div');
  el.className = 'load-line ' + (line.endsWith('OK') || line.includes('READY') || line.includes('RESOLVED') || line.includes('TERMINATED') ? 'load-ok' : line === '' ? 'load-dim' : '');
  el.textContent = line;
  out.appendChild(el);
  fill.style.width = Math.round(i / lines.length * 92) + '%';
  setTimeout(tick, line ? 70 : 45);
 };
 tick();
}

function fmtTime(sec) {
 const s = Math.max(0, Math.round(sec || 0));
 return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function renderResultSummary() {
 const A = $('#app'), s = G.resultStats || { win: false, kills: 0, roundsCleared: 0, roundsTotal: PLAN.length, time: 0, damageTotal: 0, damageTaken: 0, castsExecuted: 0, topCards: [] };
 const cp = compilePipeline(G.last || [], ST);
 const top = s.topCards || [];
 const topHTML = top.length
  ? top.map((r, i) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px dashed var(--mute)"><span>${i + 1}. ${r.label}</span><b style="color:var(--mult)">${Math.round(r.dmg)} dmg</b></div>`).join('')
  : '<span style="color:var(--mute)">No recorded spell damage.</span>';
 const rounds = `${s.roundsCleared}/${s.roundsTotal}`;
 A.innerHTML = `<div class="center">
  <h2>${s.win ? 'RUNTIME ERROR RESOLVED' : 'PROCESS TERMINATED'}</h2>
  <p>${HOSTS[G.host].n}: ${s.win ? 'all execution rounds cleared.' : 'fatal process state reached in round ' + G.round + '/' + PLAN.length + '.'}</p>
 </div>
 <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(145px,1fr));margin-bottom:12px">
  <div class="card"><b>${s.kills}</b><small>BUGS SQUASHED</small></div>
  <div class="card"><b>${rounds}</b><small>ROUNDS CLEARED</small></div>
  <div class="card"><b>${fmtTime(s.time)}</b><small>EXECUTION TIME</small></div>
  <div class="card"><b>${Math.round(s.damageTotal)}</b><small>DAMAGE DEALT</small></div>
  <div class="card"><b>${Math.round(s.damageTaken)}</b><small>DAMAGE RECEIVED</small></div>
  <div class="card"><b>${s.castsExecuted}</b><small>CASTS EXECUTED</small></div>
 </div>
 <div class="panel"><p class="lbl">Top damage cards</p>${topHTML}</div>
 <div class="panel"><p class="lbl">Final pipeline</p><pre>${cp.out.map(c => lineOf(c, ST)).join('\n') || '// empty'}</pre></div>
 <div class="row" style="justify-content:center">
  <button class="btn" data-act="start">Run again</button>
  <button class="btn g" data-act="title">Change host</button>
 </div>
 <p class="lbl" style="text-align:center">+${G.gain || 0} commits</p>`;
}

export function render() {
 if (!RUNTIME_INITIALIZED) { renderBoot(); return; }
 const A = $('#app'), v = G.view;

 if (v === 'title') {
  A.innerHTML = `<div class="center"><h1 class="logo">SPELLCODE</h1><p style="font:700 16px 'JetBrains Mono';color:var(--chip);margin:0">// RUNTIME</p><p>Compile spells into an execution pipeline, dodge bugs in real-time arenas, and squash errors. 20 rounds, 4 bosses.</p><p>Move: WASD / drag. Dash: Space or DASH. Spells cast automatically.</p>
  <div class="grid" style="text-align:left;margin-top:14px">${Object.keys(HOSTS).map(k => {
   const h = HOSTS[k], lk = !hostOpen(k);
   return `<button class="card host ${lk ? 'lk' : ''} ${G.host === k ? 'sel' : ''}" data-host="${k}" style="border-top-color:${lk ? '#6b5f82' : h.c}"><b>${lk ? '[x] chmod 000 ' + h.n : h.g + ' ' + h.n}</b><small>${lk ? '403 FORBIDDEN<br>' + h.lt + ', or buy for ' + h.cost + ' commits (you have ' + (META.commits || 0) + ')' : h.d}</small>${lk ? '' : `<i>${h.w} (${h.hp} HP)</i>`}</button>`;
  }).join('')}</div>
  <div class="row" style="justify-content:center"><button class="btn" data-act="start">Boot ${HOSTS[G.host].n}</button></div><p>Best room: ${META.best || 0}. Wins: ${META.wins}. Commits: ${META.commits || 0}.</p></div><button class="gear" data-act="settings" title="Settings">⚙</button>${renderOSWindows(G, 6, [settingsSpec])}`;
  return;
 }
 if (v === 'result-load') {
  renderResultLoad();
  return;
 }
 if (v === 'result') {
  renderResultSummary();
  return;
 }
 if (v === 'over' || v === 'win') {
  renderResultSummary();
  return;
 }
 if (v === 'run') {
  A.innerHTML = `<div class="wrap"><canvas id="cv" width="${W}" height="${H}"></canvas><button id="dash" aria-label="Dash">DASH</button></div><p class="lbl" style="margin-top:6px">WASD / drag to move. Space / DASH to dash. Pipeline casts automatically.</p>`;
  return;
 }
 if (v === 'choice') {
  const c = G.cfg;
  A.innerHTML = head() + `<h2>Round ${c.i}: choose your risk</h2><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))"><button class="card" data-risk="0" style="border-top-color:${RC[1]}"><b>SAFE ROUND</b><small>Standard bugs. Standard rewards.</small></button><button class="card" data-risk="1" style="border-top-color:${RC[4]}"><b>ELITE HUNT</b><small>An elite joins the swarm. Rewards are uncommon or better.</small></button></div>`;
  return;
 }
 if (v === 'world') {
  A.innerHTML = head() + `<h2>Choose the next sector</h2><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">${G.opts.map((o, i) => {
   const w = o.w, k = o.m === 'std', col = k ? w.c[1] : o.m === 'easy' ? RC[1] : RC[4];
   return `<button class="card" data-world="${i}" style="border-top-color:${col}"><b>${k ? w.g + ' ' + w.n : '? ' + (o.m === 'easy' ? '▽' : '▲▲')}</b><small>${k ? 'Known world. Standard difficulty.' : o.m === 'easy' ? 'Easier bugs.' : 'Tougher bugs, bonus rarity.'}</small></button>`;
  }).join('')}</div>`;
  return;
 }
 if (v === 'reward') {
  const c = G.cfg, cats = [['c', 'Spell / Modifier', 'New cards for your deck'], ['u', 'Passive', 'A permanent run upgrade'], ['d', 'Deck & Hand', 'Slots, hand size, healing']];
  A.innerHTML = head() + `<h2>${c.boss ? BOSSES[c.boss].n + ' defeated' : 'Layer cleared'}</h2>` + (G.cat ? `<div class="grid">${G.offers.map((o, i) => cardH(o.k, `data-pick="${i}"`, o.t === 'u', 1, '', G)).join('')}</div>` : `<p class="lbl">Choose a reward type.</p><div class="grid">${cats.map(k => `<button class="card" data-cat="${k[0]}" style="border-top-color:var(--chip)"><b>${k[1]}</b><small>${k[2]}</small></button>`).join('')}</div>`);
  return;
 }

 // DRAFT VIEW (Persistent pipeline & deck management)
 const cp = compilePipeline(G.slots, ST), n = nSlots(), c = G.cfg, ok = cp.out.some(cc => SPELLS[cc.sp]?.dmg);
 const bd = new Set();
 {
  let pm = [];
  G.slots.forEach(cc => {
   if (isMod(cc.k)) pm.push(cc);
   else { pm.forEach(m => { if (!okMod(m.k, cc.k)) bd.add(m.id); }); pm = []; }
  });
 }
 let sl = '';
 for (let i = 0; i < n; i++) {
  sl += G.slots[i]
   ? cardH(G.slots[i].k, `data-slot="${i}"`, 0, G.slots[i].v, (bd.has(G.slots[i].id) ? 'bad ' : '') + (G.fz === G.slots[i].id ? 'fz ' : '') + (G.sel && G.sel.id === G.slots[i].id ? 'selc ' : '') + (G.fs && (G.hand.find(x => x.id === G.fs) || {}).k === G.slots[i].k ? 'glow ' : '') + (G.slots[i].lk ? 'lkd' : ''), G)
   : `<div class="slot" data-slotend="1">slot ${i + 1}</div>`;
 }

 const wins = G.windows || defaultWindows();
 const isDrawOpen = wins.draw?.open;
 const isDiscOpen = wins.disc?.open;
 const isDeckOpen = wins.deck?.open;
 const windowsHTML = renderOSWindows(G, handDraw());

 A.innerHTML = head() + `
  <div class="row" style="margin-bottom:8px;gap:6px">
    <button class="btn g sm tb-btn ${isDrawOpen ? 'act' : ''}" data-act="view-draw">🗂️ Draw Pile (${G.draw.length})</button>
    <button class="btn g sm tb-btn ${isDiscOpen ? 'act' : ''}" data-act="view-disc">🗑️ Recycle Bin (${G.disc.length})</button>
    <button class="btn g sm tb-btn ${isDeckOpen ? 'act' : ''}" data-act="view-deck">📦 Full Deck (${G.deck.length})</button>
    <button class="btn g sm" data-act="redraw" ${G.redrawUsed ? 'disabled' : ''} title="Move hand to Recycle Bin and draw fresh cards">🔄 Redraw (${G.redrawUsed ? '0' : '1'})</button>
  </div>

  <div class="panel">
    <pre style="color:var(--ink)">INCOMING // ${ARENAS[c.arena].n}${c.elite ? '  [ELITE]' : ''}</pre>
    <div style="margin-top:4px;font-size:11px">${c.boss ? `<b style="color:var(--mult)">${BOSSES[c.boss].n}</b>: ${BOSSES[c.boss].i}` : 'Squash incoming bugs. Build persists across rounds!'}</div>
  </div>

  <p class="lbl">Pipeline (modifiers affect the spell to their right). Tap a card to select it, tap another to move it to that spot, or an empty slot to move it to the end. Double-tap to remove. Cards with a bar underneath were used last round, so they go to the Recycle Bin.</p>
  <div class="grid">${sl}</div>

  <div class="panel"><pre>${ok ? cp.out.map(cc => lineOf(cc, ST)).join('\n') : '// slot at least one damage spell'}${cp.dead.length ? '\n// warning: trailing modifier does nothing' : ''}</pre></div>

  <p class="lbl">Hand (tap to slot; double-tap to stash in Recycle Bin; if pipeline is full, tap a hand card, then a pipeline card)</p>
  <div class="grid">${G.hand.map((cc, i) => cardH(cc.k, `data-hand="${i}"`, 0, cc.v, (G.fz === cc.id ? 'fz ' : '') + (G.fs === cc.id || (G.sel && G.sel.id === cc.id) ? 'selc' : G.fs && G.hand.find(x => x.id === G.fs)?.k === cc.k ? 'glow' : ''), G)).join('')}</div>

  <div class="row">
    <button class="btn" data-act="run" ${ok ? '' : 'disabled'}>Run round ${c.i}</button>
    <button class="btn g" data-act="clear" ${G.slots.length ? '' : 'disabled'}>Clear pipeline</button>
    <button class="btn g" data-act="fuse">${G.fm === 'f' ? 'Fusing...' : 'Fuse'}</button>
    <button class="btn g" data-act="unfuse">${G.fm === 'u' ? 'Unfusing...' : 'Unfuse'}</button>
    ${G.sel && G.sel.z === 'h' ? `<button class="btn g" data-act="stash" style="border-color:#0b8479;color:#0b8479;font-weight:700" title="Store selected card in Recycle Bin">📥 Stash in Recycle Bin</button>` : ''}
  </div>
  <p class="lbl">${G.msg || 'Persistent Pipeline: cards stay equipped between rounds. Store cards in Recycle Bin, or delete 3 cards to put 3 fresh cards in draw pile.'}</p>
  ${windowsHTML}
 `;
}

// Global Event Listeners
$('#app').addEventListener('click', e => {
 ensureMusicContext();
 syncMusic();

 const winBtn = e.target.closest('[data-win-min],[data-win-max],[data-win-close]');
 if (winBtn) {
  const d = winBtn.dataset;
  if (d.winMin) {
   const w = G.windows && G.windows[d.winMin];
   if (w) { w.min = !w.min; if (!w.min) w.z = ++topZ; render(); }
   return;
  }
  if (d.winMax) {
   const w = G.windows && G.windows[d.winMax];
   if (w) { w.max = !w.max; w.min = false; w.z = ++topZ; render(); }
   return;
  }
  if (d.winClose) {
   const w = G.windows && G.windows[d.winClose];
   if (w) { w.open = false; render(); }
   return;
  }
 }

 const binRestoreBtn = e.target.closest('[data-bin-restore]');
 if (binRestoreBtn) {
  const id = +binRestoreBtn.dataset.binRestore;
  const card = G.disc.find(c => c.id === id);
  if (card) {
   G.disc.splice(G.disc.indexOf(card), 1);
   G.hand.push(card);
   snd(587, .1, 'triangle', .05);
   G.msg = `${defOf(card.k).n} restored from Recycle Bin to hand.`;
   render();
  }
  return;
 }

 const binDeleteBtn = e.target.closest('[data-bin-delete]');
 if (binDeleteBtn) {
  const id = +binDeleteBtn.dataset.binDelete;
  const card = G.disc.find(c => c.id === id);
  if (card) {
   recycleCards([card]);
  }
  return;
 }

 const t = e.target.closest('[data-act],[data-host],[data-hand],[data-slot],[data-pick],[data-risk],[data-cat],[data-world],[data-set],[data-slotend]');
 if (!t) return;
 snd(440, .05, 'square', .03);
 const d = t.dataset;

 if (d.act === 'initialize') {
  if (!bootReady) return;
  RUNTIME_INITIALIZED = true;
  G.view = 'title';
  render();
  syncMusic();
  return;
 }
 if (d.act === 'initialize-summary') {
  G.view = 'result';
  render();
  syncMusic();
  return;
 }
 if (d.act === 'view-draw') {
  G.windows = G.windows || defaultWindows();
  const w = G.windows.draw;
  if (w.open && !w.min) { w.min = true; }
  else { w.open = true; w.min = false; w.z = ++topZ; }
  render();
  return;
 }
 if (d.act === 'view-disc') {
  G.windows = G.windows || defaultWindows();
  const w = G.windows.disc;
  if (w.open && !w.min) { w.min = true; }
  else { w.open = true; w.min = false; w.z = ++topZ; }
  render();
  return;
 }
 if (d.act === 'view-deck') {
  G.windows = G.windows || defaultWindows();
  const w = G.windows.deck;
  if (w.open && !w.min) { w.min = true; }
  else { w.open = true; w.min = false; w.z = ++topZ; }
  render();
  return;
 }

 if (d.act === 'redraw') {
  if (G.redrawUsed) return;
  G.redrawUsed = 1;
  G.disc.push(...G.hand);
  G.hand = [];
  drawN(6 + ST.hand);
  render();
  return;
 }
 if (d.act === 'bin-recycle-3') {
  if (G.disc.length < 3) {
   G.msg = `Need at least 3 cards in Recycle Bin to recycle (currently ${G.disc.length}).`;
   snd(180, .15, 'square', .05);
   render();
   return;
  }
  recycleCards(G.disc.slice(0, 3));
  return;
 }
 if (d.act === 'bin-recycle-all') {
  if (!G.disc.length) return;
  recycleCards([...G.disc]);
  return;
 }
 if (d.act === 'stash') {
  if (G.sel && G.sel.z === 'h') {
   const idx = G.hand.findIndex(x => x.id === G.sel.id);
   if (idx >= 0) {
    const card = G.hand.splice(idx, 1)[0];
    G.disc.push(card);
    G.sel = 0;
    snd(380, .1, 'square', .04);
    G.msg = `${defOf(card.k).n} stored in Recycle Bin.`;
    render();
    return;
   }
  }
 }

 if (d.host) {
  if (!hostOpen(d.host)) {
   const h = HOSTS[d.host];
   if ((META.commits || 0) >= h.cost) {
    META.commits -= h.cost;
    META.own = META.own || {};
    META.own[d.host] = 1;
    saveMeta();
   } else {
    t.classList.add('deny');
    snd(120, .25, 'sawtooth', .05, -40);
    setTimeout(() => t.classList.remove('deny'), 400);
    return;
   }
  } else G.host = d.host;
  render();
 } else if (d.set) {
  const tt = SETS[d.set], i = tt[1].indexOf(SET[d.set]);
  SET[d.set] = tt[1][(i + 1) % tt[1].length];
  META.set = SET; saveMeta(); render();
 } else if (d.cat) {
  G.cat = d.cat; G.offers = rollRewards(d.cat); render();
 } else if (d.world != null) {
  const o = G.opts[+d.world];
  const target = o.w;
  const apply = () => {
   G.dm = { easy: .8, std: 1, hard: 1.25 }[o.m];
   G.rb = o.m === 'hard' ? 1 : 0;
   if (target.key) G.visited.push(target.key);
   prepRound();
  };
  beginSectorLoad(target, apply);
 } else if (d.act === 'start') {
  newRun();
 } else if (d.act === 'title') {
  G.view = 'title'; render();
 } else if (d.act === 'settings') {
  G.windows = G.windows || defaultWindows();
  const w = G.windows.settings || (G.windows.settings = defaultWindows().settings);
  w.open = !w.open; w.min = false; if (w.open) w.z = ++topZ;
  render();
 } else if (d.act === 'mute') {
  setMute(!MUTE); render();
 } else if (d.act === 'fuse') {
  G.fm = G.fm === 'f' ? 0 : 'f'; G.fs = 0;
  G.msg = G.fm ? 'Tap a card, then a matching card to permanently upgrade it.' : '';
  render();
 } else if (d.act === 'unfuse') {
  G.fm = G.fm === 'u' ? 0 : 'u'; G.fs = 0;
  G.msg = G.fm ? 'Tap a stacked card to split it back into base cards.' : '';
  render();
 } else if (d.act === 'run') {
  if (G.cfg && G.cfg.boss) {
   beginBossLoad(G.cfg.boss, () => fight());
  } else fight();
 } else if (d.act === 'clear') {
  const n = G.slots.filter(c => c.lk).length;
  G.slots.forEach(leave);
  G.slots = [];
  G.sel = 0;
  G.msg = n ? n + ' used card' + (n > 1 ? 's' : '') + ' went to the Recycle Bin.' : '';
  render();
 } else if (d.risk != null) {
  G.cfg.elite = d.risk === '1'; draft();
 } else if (d.hand != null) {
  if (G.fm) {
   const c = G.hand[+d.hand];
   if (G.fm === 'u') {
    G.msg = unfuseCard(c) ? 'Split ' + defOf(c.k).n + '.' : 'Nothing to unfuse.';
   } else if (!G.fs) {
    G.fs = c.id; G.msg = 'Now tap a matching card.';
   } else if (G.fs === c.id) {
    G.fs = 0; G.msg = '';
   } else {
    const a = G.hand.find(x => x.id === G.fs) || G.slots.find(x => x.id === G.fs);
    const ok = fuseCards(a, c);
    G.msg = ok ? 'Fused! v' + a.v + ': ' + (xText(a.k, a.v) || 'stronger') : fuseFailMsg(a, c);
    if (ok) {
     G.fz = a.id;
     [523, 659, 784].forEach((f, j) => setTimeout(() => snd(f, .14, 'triangle', .05), j * 70));
    }
    G.fs = 0;
   }
   render();
   G.fz = 0;
  } else {
   const c = G.hand[+d.hand], s = G.sel;
   if (s && s.z === 's') {
    const j = G.slots.findIndex(x => x.id === s.id), o = G.slots[j];
    if (o) {
     if (o.lk) {
      G.msg = 'Double-tap ' + defOf(o.k).n + ' to send it to the discard pile.';
      render(); return;
     }
     G.slots[j] = c; G.hand.splice(+d.hand, 1); leave(o); G.sel = 0; G.msg = ''; render(); return;
    }
   }
   if (G.slots.length < nSlots()) {
    G.slots.push(G.hand.splice(+d.hand, 1)[0]); G.sel = 0;
   } else {
    G.sel = s && s.id === c.id ? 0 : { z: 'h', id: c.id };
   }
   render();
  }
 } else if (d.slot != null) {
  slotClick(+d.slot);
 } else if (d.slotend != null) {
  const s = G.sel;
  if (s && s.z === 's') {
   const j = G.slots.findIndex(x => x.id === s.id);
   if (j >= 0) {
    G.slots.push(G.slots.splice(j, 1)[0]); G.sel = 0; G.msg = ''; render();
   }
  }
 } else if (d.pick != null) {
  const o = G.offers[+d.pick];
  if (o) takeReward(o);
 }
});

let dragWin = null, dragOffset = { x: 0, y: 0 };
$('#app').addEventListener('input', e => {
 const sl = e.target.closest('[data-vol]');
 if (!sl) return;
 const k = sl.dataset.vol, v = Math.max(0, Math.min(1, (+sl.value || 0) / 100));
 SET[k] = v;
 VOL.master = SET.vm; VOL.music = SET.vmu; VOL.sfx = SET.vs;
 applyVolumes();
 const lbl = document.getElementById('vol-' + k); if (lbl) lbl.textContent = Math.round(v * 100) + '%';
 META.set = SET; saveMeta();
});
addEventListener('pointerdown', e => {
 const winEl = e.target.closest('[data-win-id]');
 if (winEl) {
  const key = winEl.dataset.winId;
  if (G.windows && G.windows[key]) {
   G.windows[key].z = ++topZ;
   winEl.style.zIndex = G.windows[key].z;
  }
 }
 const dragHeader = e.target.closest('[data-win-drag]');
 if (dragHeader && !e.target.closest('.os-ctrl')) {
  const key = dragHeader.dataset.winDrag;
  const w = G.windows && G.windows[key];
  if (w && !w.max) {
   dragWin = key;
   dragOffset.x = e.clientX - (w.x || 0);
   dragOffset.y = e.clientY - (w.y || 0);
  }
 }
});
addEventListener('pointermove', e => {
 if (dragWin && G.windows && G.windows[dragWin]) {
  const w = G.windows[dragWin];
  w.x = Math.max(0, Math.min(window.innerWidth - 120, e.clientX - dragOffset.x));
  w.y = Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragOffset.y));
  const el = document.querySelector(`[data-win-id="${dragWin}"]`);
  if (el) {
   el.style.left = w.x + 'px';
   el.style.top = w.y + 'px';
  }
 }
});
addEventListener('pointerup', () => {
 dragWin = null;
});

addEventListener('keydown', e => {
 const k = e.key.toLowerCase();
 if (k === 'escape') {
  const openWins = Object.values(G.windows || {}).filter(w => w.open);
  if (openWins.length) {
   openWins.sort((a, b) => (b.z || 0) - (a.z || 0))[0].open = false;
   render();
   return;
  }
  if (G.modal) {
   G.modal = null;
   render();
   return;
  }
 }
 if (k === ' ' || k === 'shift') {
  dashReq = true;
  if (G.view === 'run') e.preventDefault();
 } else keys[k] = 1;
 if (G.view === 'run' && k.startsWith('arrow')) e.preventDefault();
});
addEventListener('keyup', e => keys[e.key.toLowerCase()] = 0);

render();
