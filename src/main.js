import { W, H, GW, GH, PLAN, CHAOS, setArenaSize } from './constants.js';
import { RAR, RC, SPELLS, MODS, UPG, HOSTS, DK, WORLDS, EN, ARENAS, BOSSES, RACE, LEAK, SEGFAULT, PLAYER_SHIELD } from './data.js';
import { ROOM_TYPES, CYCLES, SHOP, SLOTS, redrawCost, slotHandTable, slotRTP, spinSlots, buildLayerMap, buildBossMap, ENTRY_SPOT, DIR_OPP } from './rooms.js';
import { WANDS, wandOf, wandAccepts, bwCost, bwMaxFor, bwRegen, clampBW, CRYO, WAND_ACQ, wandsOffered, canStoreWand } from './wands.js';
import { wandIconHTML, drawWandSprite, wandCanvas } from './wandart.js';
import { $, ri, pick, cl, shuffle, css, mk, defOf, isMod, maxV, okMod, wo, xText, xl, cardH } from './helpers.js';
import { renderOSWindows } from './probability.js';
import { drawNodes } from './themes.js';
import { snd, sfx, uiSound, testSound, AOPT, ensureMusicContext, preloadMusic, stopMusic, setMusic, setMusicMood, MUTE, setMute, VOL, applyVolumes } from './audio.js';
import { wallHit, hazAt, mv, near, compilePipeline, stats, lineOf, drawBG, drawLabLive, setDynamicWalls } from './combat.js';
import { initFullscreen } from './fullscreen.js';

let META = { best: 0, wins: 0 };
try { META = { ...META, ...JSON.parse(localStorage.getItem('spellcode_meta') || '{}') }; } catch (e) {}
let SET = { shake: 1, dmg: 1, q: 2, cc: 2, pt: 1, gw: 3, fl: 2, ef: 1, vm: 1, vmu: 1, vs: 1, vb: 1, vu: 1, mus: 1, sx: 1, uis: 1, cs: 1, dn: 1, bhp: 0, aim: 0, ...(META.set || {}) };
if (![0, 1, 2].includes(SET.bhp)) SET.bhp = 0; // Boss HP Display: 0 = HP Bar (default), 1 = HP Bar + Percentage, 2 = Actual HP + Percentage
if (![0, 1].includes(SET.aim)) SET.aim = 0;
const applyAudioSettings = () => {
 VOL.master = SET.vm; VOL.music = SET.vmu; VOL.sfx = SET.vs; VOL.boss = SET.vb; VOL.ui = SET.vu;
 AOPT.music = SET.mus ? 1 : 0; AOPT.sfx = SET.sx ? 1 : 0; AOPT.ui = SET.uis; AOPT.cards = SET.cs ? 1 : 0; AOPT.dens = SET.dn;
 applyVolumes();
};
applyAudioSettings();
const GLOW = [0, .3, .65, 1]; // off / low / medium / high
const SETS = {
 shake: ['Screen shake', [0, .5, 1], ['off', 'half', 'full']],
 dmg: ['Damage numbers', [0, 1], ['off', 'on']],
 q: ['Effects quality', [0, 1, 2], ['low', 'med', 'high']],
 cc: ['Cast display', [0, 1, 2], ['off', 'compact', 'cards']],
 pt: ['Particles', [0, 1], ['off', 'on']],
 gw: ['Glow (projectiles, stdout, etc.)', [0, 1, 2, 3], ['off', 'low', 'medium', 'high']],
 fl: ['Flame detail', [0, 1, 2], ['off', 'simple', 'full']],
 ef: ['Flames on enemy bullets', [0, 1], ['off', 'on']],
 mus: ['Music', [0, 1], ['off', 'on']],
 sx: ['Sound effects', [0, 1], ['off', 'on']],
 uis: ['Button sounds', [0, 1, 2, 3], ['off', 'soft', 'classic', 'arcade']],
 cs: ['Card sounds', [0, 1], ['off', 'on']],
 dn: ['Sound density', [0, 1, 2], ['low', 'normal', 'high']],
 bhp: ['Boss HP Display', [0, 1, 2], ['HP Bar', 'HP Bar + Percentage', 'Actual HP + Percentage']],
 aim: ['Aim mode', [0, 1], ['Mouse aim', 'Host facing']]
};
const BHP_NAMES = ['HP Bar', 'HP Bar + Percentage', 'Actual HP + Percentage'], BHP_EX = ['', ' (e.g. 75%)', ' (e.g. 4500 / 6000 (75%))'];
const SLIDERS = [['vm', 'Master volume'], ['vmu', 'Music volume'], ['vs', 'Effects volume (your spells)'], ['vb', 'Boss & enemy volume'], ['vu', 'Button & card volume']];
const sliderH = ([k, t]) => `<label class="set-row"><span>${t}</span><input type="range" min="0" max="100" value="${Math.round(SET[k] * 100)}" data-vol="${k}"><b id="vol-${k}">${Math.round(SET[k] * 100)}%</b></label>`;
const settingsBody = () => `
 <div class="set-sec">SOUND</div>
 <div class="set-row"><span>Sound (everything)</span><button class="btn g" data-act="mute">${MUTE ? 'off' : 'on'}</button></div>
 ${SLIDERS.map(sliderH).join('')}
 ${['mus', 'sx', 'uis', 'cs', 'dn'].map(k => `<div class="set-row"><span>${SETS[k][0]}</span>${setBtn(k).replace(SETS[k][0] + ': ', '')}</div>`).join('')}
 <div class="set-row"><span>Test sounds</span><span><button class="btn g sm" data-act="test-sfx">spells</button> <button class="btn g sm" data-act="test-boss">boss</button> <button class="btn g sm" data-act="test-ui">buttons</button></span></div>
 <div class="set-sec">BOSS HP DISPLAY</div>
 <div class="seg">${[0, 1, 2].map(i => `<button class="btn g${SET.bhp === i ? ' on' : ''}" data-setv="bhp:${i}">${BHP_NAMES[i]}${BHP_EX[i]}</button>`).join('')}</div>
 <p style="color:var(--mute);font-size:10.5px;margin:4px 0 0">Changes how boss health is shown (Race Condition, Memory Leak, PRISM...). Press H during a fight to cycle it.</p>
 <div class="set-sec">GRAPHICS</div>
 ${['q', 'pt', 'gw', 'fl', 'ef'].map(k => `<div class="set-row"><span>${SETS[k][0]}</span>${setBtn(k).replace(SETS[k][0] + ': ', '')}</div>`).join('')}
 <div class="set-sec">GAMEPLAY</div>
 ${['shake', 'dmg', 'cc', 'aim'].map(k => `<div class="set-row"><span>${SETS[k][0]}</span>${setBtn(k).replace(SETS[k][0] + ': ', '')}</div>`).join('')}
 <p style="color:var(--mute);font-size:10.5px;margin:4px 0 0">Mouse aim follows the pointer; Host facing aims in the direction you last moved.</p>
 <p style="color:var(--mute);font-size:10.5px;margin:10px 0 0">Lower the graphics options if the game feels laggy. Changes save automatically.</p>
`;
// ===== In-run pause menu (Esc or the II button) =====
function pauseHTML() {
 const row = k => `<div class="set-row"><span>${SETS[k][0]}</span><button class="btn g" data-pa="set:${k}">${SETS[k][2][SETS[k][1].indexOf(SET[k])]}</button></div>`;
 return `<div class="pause-panel${G.sandbox ? ' sbx' : ''}" role="dialog" aria-label="${G.sandbox ? 'Sandbox test controls' : 'Paused'}">
  <h2 style="margin:0 0 4px">${G.sandbox ? '$ spellcode --sandbox' : 'PAUSED'}</h2>
  ${G.sandbox ? `<div class="set-sec">// cheats  (non-canon, no progression)</div>
  <div class="set-row"><span>god_mode</span><button class="btn g" data-pa="immortal">${R?.invincible ? 'true' : 'false'}</button></div>
  <div class="set-row"><span>one_hit_kill</span><button class="btn g" data-pa="onehit">${R?.sbOneHit ? 'true' : 'false'}</button></div>
  <div class="set-row"><span>free_dash</span><button class="btn g" data-pa="freedash">${R?.sbDash ? 'true' : 'false'}</button></div>
  <div class="set-row"><span>freeze_boss</span><button class="btn g" data-pa="freeze">${R?.sbFreeze ? 'true' : 'false'}</button></div>
  <div class="set-row"><span>time_scale</span><button class="btn g" data-pa="speed">${R?.sbSpeed || 1}x</button></div>
  ${R?.boss ? `<div class="set-row"><span>boss.phase =</span><span class="seg" style="flex-direction:row;margin:0">${[1, 2, 3].map(i => `<button class="btn g sm" data-pa="phase:${i - 1}">P${i}</button>`).join('')}</span></div>` : ''}
  <div class="set-row"><span>enemies</span><span class="seg" style="flex-direction:row;margin:0"><button class="btn g sm" data-pa="spawn">spawn()</button><button class="btn g sm" data-pa="clear">clear()</button></span></div>
  <div class="set-sec">// pipeline (tap a card to remove it)</div>
  ${sbxMiniPipe()}
  <div class="set-row"><span>add card</span><span style="display:flex;gap:4px;align-items:center"><select id="sbx-card" class="sbx-sel">${sbxCardOpts()}</select><select id="sbx-ver" class="sbx-sel"><option value="1">v1</option><option value="2">v2</option><option value="3">v3</option></select><button class="btn g sm" data-pa="addcard">ADD</button></span></div>
  <button class="btn g" data-pa="heal" style="width:100%;margin:4px 0">restore(hp, shield)</button>
  <button class="btn g" data-pa="skip" style="width:100%;margin:4px 0">skipRound()</button>` : ''}
  <button class="btn" data-pa="resume" style="width:100%;padding:10px;font-size:14px">RESUME (\`)</button>
  <button class="btn g" data-pa="quit" style="width:100%;margin:6px 0;${G.quitArm ? 'border-color:#ff5c7a;color:#ff9aa9' : ''}">${G.quitArm ? 'CONFIRM: QUIT TO MENU?' : 'QUIT GAME'}</button>
  <div class="set-sec">AUDIO</div>
  ${SLIDERS.map(sliderH).join('')}
  <div class="set-row"><span>Sound (everything)</span><button class="btn g" data-pa="mute">${MUTE ? 'off' : 'on'}</button></div>
  ${row('mus')}${row('sx')}
  <div class="set-sec">GRAPHICS</div>
  ${['q', 'pt', 'gw', 'fl', 'ef', 'shake', 'dmg'].map(row).join('')}
  <div class="set-sec">GAMEPLAY</div>
  ${row('aim')}
  <div class="set-sec">BOSS HP DISPLAY</div>
  <div class="seg">${[0, 1, 2].map(i => `<button class="btn g${SET.bhp === i ? ' on' : ''}" data-pa="bhp:${i}">${BHP_NAMES[i]}</button>`).join('')}</div>
  <p style="color:var(--mute);font-size:10.5px;margin:8px 0 0">Your run is paused and untouched. Other settings live in the lobby.</p>
 </div>`;
}
function renderPause() {
 const el = document.getElementById('pausemenu');
 if (el) { const top = el.firstElementChild ? el.firstElementChild.scrollTop : 0; el.innerHTML = pauseHTML(); if (el.firstElementChild) el.firstElementChild.scrollTop = top; }
}
function closePause() {
 const el = document.getElementById('pausemenu');
 if (el) el.remove();
 if (R) R.paused = 0;
}
function quitGame() {
 if (G.view !== 'run' || !R) return;
 closePause();
 if (G.sandbox) { endRun(false); return; } // sandbox: back to the sandbox menu
 R.end = 1;
 if (R.seg) setDynamicWalls(G.cfg.arena, []);
 keys = {}; joy = null; dashReq = false; mouseFire = 0; mobileFire = 0; mobileContinuous = 0;
 G.view = 'title'; render(); stopMusic(.45); syncMusic();
}
function togglePause() {
 if (!R || G.view !== 'run' || R.end) return;
 if (R.paused) { G.quitArm = 0; closePause(); dashReq = false; uiSound('close'); return; }
 R.paused = 1; dashReq = false; joy = null;
 const el = document.createElement('div');
 el.id = 'pausemenu'; el.innerHTML = pauseHTML();
 el.addEventListener('click', e => {
  e.stopPropagation(); // never reaches the global handler (which re-renders the screen)
  if (e.target === el) { togglePause(); return; }
  const t = e.target.closest('[data-pa]'); if (!t) return;
  const [a, b] = t.dataset.pa.split(':');
  if (a === 'resume') { G.quitArm = 0; togglePause(); return; }
  if (a === 'quit') { // two clicks: the first arms it, the second leaves the run (no progress is recorded for an abandoned run)
   if (G.quitArm) { G.quitArm = 0; quitGame(); return; }
   G.quitArm = 1; uiSound('toggle'); renderPause();
   setTimeout(() => { if (G.quitArm) { G.quitArm = 0; if (R?.paused) renderPause(); } }, 4000);
   return;
  }
  if (a === 'immortal' && G.sandbox && R) { R.invincible = !R.invincible; uiSound('toggle'); renderPause(); return; }
  if (G.sandbox && R && ['onehit', 'freedash', 'freeze', 'speed', 'phase', 'spawn', 'clear'].includes(a)) {
   const boss = R.en.find(e => e.boss && !e.dead);
   if (a === 'onehit') R.sbOneHit = !R.sbOneHit;
   else if (a === 'freedash') R.sbDash = !R.sbDash;
   else if (a === 'freeze') R.sbFreeze = !R.sbFreeze;
   else if (a === 'speed') R.sbSpeed = { 1: .5, .5: .25, .25: 2, 2: 1 }[R.sbSpeed || 1];
   else if (a === 'phase' && boss && !R.bossIntro) boss.hp = Math.max(1, Math.round(boss.max * [.9, .5, .2][+b]));
   else if (a === 'spawn') { const ks = Object.keys(EN).filter(k => !['chain', 'summoner'].includes(k)); spawnE(pick(ks), cl(mouseX, 30, W - 30), cl(mouseY, 30, H - 30)); }
   else if (a === 'clear') { R.en = R.en.filter(e => e.boss); R.eb = []; }
   uiSound('toggle'); renderPause(); return;
  }
  if (a === 'addcard' && G.sandbox && R) { // add a card to the pipeline (and deck) mid-fight and rebuild the casts
   const k = $('#sbx-card')?.value, v = +($('#sbx-ver')?.value || 1);
   if (k && (SPELLS[k] || MODS[k])) {
    G.sbxCard = k; const c = mk(k, v); G.deck.push(c); G.slots.push(c);
    sbxRebuild(); sfx('heal');
   }
   uiSound('toggle'); renderPause(); return;
  }
  if (a === 'rmcard' && G.sandbox && R) { // remove a card from the pipeline (it stays in the deck)
   const i = +b; if (G.slots[i]) { G.slots.splice(i, 1); sbxRebuild(); sfx('heal'); }
   uiSound('toggle'); renderPause(); return;
  }
  if (a === 'heal' && G.sandbox && R) { G.hp = G.max; R.p.sh = ST.shmax; R.p.inv = 0; sfx('heal'); renderPause(); return; }
  if (a === 'skip' && G.sandbox) { closePause(); sandboxSkipRound(); return; }
  if (a === 'mute') { setMute(!MUTE); syncMusic(); }
  else if (a === 'set') { const tt = SETS[b], i = tt[1].indexOf(SET[b]); SET[b] = tt[1][(i + 1) % tt[1].length]; if (b === 'mus') syncMusic(); }
  else if (a === 'bhp') SET.bhp = +b;
  META.set = SET; saveMeta(); applyAudioSettings(); uiSound('toggle'); renderPause();
 });
 document.body.appendChild(el);
 uiSound('open');
}
addEventListener('visibilitychange', () => { if (document.hidden && G.view === 'run' && R && !R.end && !R.paused) togglePause(); });
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

let G = { view: 'title', host: 'debugger', modal: null, windows: defaultWindows(), sh: 30 }, R = null, ST = {}, keys = {}, joy = null, dashReq = false, mouseFire = 0, mobileFire = 0, mobileContinuous = 0, fireBlockedX = 0, mouseX = 0, mouseY = 0;

function calcST() {
 const h = HOSTS[G.host];
 const s = {
  dmg: 1, rate: 1, spd: 1, hpa: 0, hpm: 1, shmax: 20, shm: 1, hm: 1,
  crit: 0, dashcd: 1, gc: 0, rh: 0, mv: 0, still: 0, slots: 0, hand: 0,
  chaos: 0, regen: 0, recur: 0, over: 0, glass: 0, par: 0, proxy: 0,
  leak: 0, stack: 0, nullref: 0, panic: 0, fork: 0
 };
 h.f(s);
 s.slots += G.xs || 0;
 s.hand += G.xh || 0;
 for (const k in G.u) for (let i = 0; i < G.u[k]; i++) UPG[k]?.f?.(s);
 s.wand = WANDS[G.wand] ? G.wand : 'universal'; // equipped wand id, read by stats() in combat.js
 s.bwr = 1; s.bwcost = 1; s.bwmax = 1; // Bandwidth modifiers (passives may change these later; BWR itself stays hidden)
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

function bossTrack(b) { return BOSSES[b]?.track || 'segfault'; }
function worldTrack(w) {
 if (w === WORLDS.boot) return 'boot';
 if (w === WORLDS.deadlock) return 'deadlock';
 if (w === WORLDS.heap) return 'heap';
 if (w === WORLDS.null) return 'null';
 if (w === WORLDS.kernel) return 'kernel';
 if (w === WORLDS.nexus) return 'nexus';
 if (w?.gen) { w.music = w.music || pick(['generated', 'generated1']); return w.music; }
 return 'title';
}
function musicTrack() {
 if (G.cfg?.boss && (G.view === 'reward' || (G.view === 'run' && R && R.end && R.bossDead))) return '';
 if (G.view === 'title') return 'title';
 if (G.view === 'win') return 'win';
 if (G.view === 'over') return 'gameover';
 if (G.view === 'result-event') return G.resultWin ? 'win' : 'gameover';
 if (G.view === 'result-load') return G.resultWin ? 'win' : 'gameover';
 if (G.view === 'result') return G.resultWin ? 'win' : 'gameover';
 if (G.view === 'run') {
  if (G.cfg?.boss) return bossTrack(G.cfg.boss);
  if (R?.room?.type === '$') return 'cycles_shop'; // Cycle Shop rooms have their own track
  // Overtime is a per-round timer, not cumulative run time (never in a cleared / safe room).
  if (R && R.t >= 70 && !R.room?.cleared) return 'overtime';
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
  ar: shuffle(Object.keys(ARENAS).filter(k => !ARENAS[k].own && !ARENAS[k].boss)).slice(0, 4),
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

function initializeRun(sandbox = false, startRound = 1, bossChoice = 'round') {
 G = {
  ...G, view: 'draft', round: 1, u: {}, deck: [], draw: [], disc: [], hand: [],
  slots: [], kills: 0, xs: 0, xh: 0, time: 0, hp: null, max: 0, sh: 30, lastArena: '',
  last: [], modal: null, redrawUsed: 0, windows: defaultWindows(),
  sandbox, sandboxRound: sandbox ? startRound : null, sandboxBossChoice: bossChoice,
  sandboxImmortal: !!sandbox, sandboxMessage: '', bar: null,
  wand: 'universal', wands: ['universal'], binWands: [], binTab: 'cards', binWandConfirm: 0, bw: 0, bwMax: 0, bwTrail: 0,
  cycles: CYCLES.start, items: { restore: 0 }, layerRedraws: 0, rewardCtx: null, shop: null, mapMode: 0
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
 if (!sandbox && !hostOpen(G.host)) G.host = 'debugger'; // sandbox may use any Host, locked or not
 if (sandbox) G.wands = Object.keys(WANDS); // sandbox is a test bed: every wand is available (no wand economy exists yet)
 initBW(true);
 G.round = sandbox ? cl(Math.floor(+startRound || 1), 1, PLAN.length) : 1;
 G.sector = sandbox ? Math.ceil(G.round / 5) : 1;
 G.layer = sandbox ? (G.round - 1) % 5 + 1 : 1;
 G.world = sandbox ? [WORLDS.boot, WORLDS.heap, WORLDS.null, WORLDS.nexus][G.sector - 1] : WORLDS.boot;
 G.dm = 1; G.rb = 0; G.visited = ['boot']; G.cat = null;
 if (sandbox) sandboxPrepareRound();
 else beginSectorLoad(WORLDS.boot, () => prepRound(), true);
}
export function newRun() { initializeRun(); }

// SANDBOX IS NON-CANON AND NOT LORE-RELATED. Never grant or save campaign
// commits, achievements, quests, best-round records, or permanent rewards here.
function sandboxPrepareRound() {
 const c = genRound(G.round);
 if (G.sandboxBossChoice !== 'round' && BOSSES[G.sandboxBossChoice]) { // a specifically chosen test boss skips the rooms and goes straight to the fight, as before
  delete c.map; delete c.bossKey; c.layerBudget = undefined;
  c.boss = G.sandboxBossChoice; c.k = 'fb'; c.arena = BOSSES[c.boss].arena;
 }
 G.cfg = c; G.layerRedraws = 0;
 if (c.boss || c.bossKey) preloadMusic(bossTrack(c.boss || c.bossKey));
 draft();
}
function sandboxSkipRound() {
 if (!G.sandbox) return;
 if (G.view === 'run' && R) {
  R.end = 1;
  G.sh = R.p.sh;
  if (R.seg) setDynamicWalls(G.cfg.arena, []);
  keys = {}; joy = null; dashReq = false; mouseFire = 0; mobileFire = 0; mobileContinuous = 0;
 }
 const previous = G.round;
 G.round = G.round >= PLAN.length ? 1 : G.round + 1;
 G.sector = Math.ceil(G.round / 5);
 G.layer = (G.round - 1) % 5 + 1;
 G.world = [WORLDS.boot, WORLDS.heap, WORLDS.null, WORLDS.nexus][G.sector - 1];
 G.sandboxBossChoice = 'round';
 G.sandboxMessage = `TEST ROUND ${previous} SKIPPED // ROUND ${G.round}`;
 G.cat = null; G.offers = null; G.cfg = null;
 sandboxPrepareRound();
}

function genRound(i) {
 // The boss belongs to the WORLD (sector); worlds without one (generated) fall back to the old sector order.
 const L = G.layer, boss = L === 5 ? (G.world?.boss || ({ 1: 'leak', 2: 'segfault', 3: 'race', 4: 'runtime' }[G.sector] || 'runtime')) : null, k = boss ? 'fb' : 'n';
 const ar = boss ? BOSSES[boss].arena : G.world.ordered ? G.world.ar[(L - 1) % G.world.ar.length] : pick(G.world.ar.filter(a => a !== G.lastArena));
 G.lastArena = ar;
 const cfg = { i, k, boss, arena: ar, budget: Math.min(5 + 2.2 * i, 36), elite: false };
 // Ordinary layers of the fixed-map sectors (and Kernel's procedural ones) become connected room maps; boss layers, Deadlock, generated worlds and the sandbox keep the single room.
 if (G.world?.key && !boss) { const m = buildLayerMap(G.world.key, L); if (m) { cfg.map = m; cfg.layerBudget = cfg.budget; cfg.arena = m.rooms[m.start].arena; } }
 // Boss layers: an antechamber with a boss door. The boss only becomes the active fight (cfg.boss) once you walk through it; Deadlock keeps its own flow.
 if (G.world?.key && boss) { const m = buildBossMap(G.world.key, boss); if (m) { cfg.map = m; cfg.bossKey = boss; cfg.boss = null; cfg.k = 'n'; cfg.budget = 0; cfg.arena = m.rooms[m.start].arena; } }
 return cfg;
}
function worldOpts() {
 const pool = shuffle(Object.keys(WORLDS).filter(k => k !== 'boot' && k !== 'kernel' && !G.visited.includes(k))), take = () => pool.length ? WORLDS[pool.pop()] : genWorld();
 return [{ w: take(), m: 'easy' }, { w: take(), m: 'std' }, { w: take(), m: 'hard' }];
}
function advance() {
 G.layer++; G.round++;
 if (G.layer > 5) {
  G.sector++; G.layer = 1;
  G.hp = G.max; // HP is only fully restored when a new sector begins (no heal between layers)
  G.sh = ST.shmax; G.bar = null; // All hosts regenerate shield (and the barrier) when reaching the next sector!
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
 G.layerRedraws = 0; // redraw cost climbs per layer and resets on each new one
  if (G.cfg.boss || G.cfg.bossKey) preloadMusic(bossTrack(G.cfg.boss || G.cfg.bossKey));
 if (G.cfg.map && Object.values(G.cfg.map.rooms).some(r => r.type === '$')) preloadMusic('cycles_shop');
 draft();
}

const chime = () => uiSound('card_fuse');
function dbl(id) { const n = Date.now(), r = G.lc && G.lc.id === id && n - G.lc.t < 400; G.lc = { id, t: n }; return r; }
function leave(c) { const lk = c.lk; c.lk = 0; (lk ? G.disc : G.hand).push(c); return lk; }
const handDraw = () => Math.max(3, 6 + ST.hand - Math.floor(G.slots.length / 2));

function slotClick(i) {
 const c = G.slots[i]; if (!c) return;
 const nm = defOf(c.k).n, dc = dbl(c.id), s = G.sel;
 if (dc && !G.fm) {
  const h = s && s.z === 'h' && G.hand.find(x => x.id === s.id);
  if (h) { G.hand.splice(G.hand.indexOf(h), 1); G.slots[i] = h; } else G.slots.splice(i, 1);
  G.msg = leave(c) ? nm + ' stored in Storage.' : '';
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
   if (c.lk) { G.msg = 'Double-tap ' + nm + ' to swap it out (it moves to the Storage).'; render(); return; }
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

function showRunNotice(kind, title, detail) {
 const app = $('#app');
 if (!app) return;
 const notice = document.createElement('div');
 notice.className = `run-notice run-notice-${kind}`;
 notice.setAttribute('role', 'status');
 notice.setAttribute('aria-live', 'polite');
 const label = document.createElement('small');
 label.textContent = kind === 'hack' ? 'INTRUSION CONFIRMED' : kind === 'host' ? 'HOST PROCESS' : 'LAYER STATUS';
 const heading = document.createElement('b');
 heading.textContent = title;
 const caption = document.createElement('span');
 caption.textContent = detail;
 notice.append(label, heading, caption);
 app.appendChild(notice);
 setTimeout(() => notice.remove(), 2400);
}

function clearRound() {
 if (G.view !== 'run') return;
 sfx('objective');
 G.hp = Math.min(G.max, G.hp + G.max * ST.rh);
 G.sh = Math.max(0, R && R.p ? R.p.sh : (G.sh != null ? G.sh : ST.shmax));
 if (ST.regen) G.sh = ST.shmax; // Debugger regens shield between rounds; other hosts preserve what they have until next sector!
 // Persistent pipeline: slots stay intact! Hand is cleared into discard
 G.disc.push(...G.hand);
 G.hand = [];
 if (G.sandbox && G.round >= PLAN.length) {
  G.sandboxMessage = 'TEST COMPLETE // NO CAMPAIGN PROGRESS RECORDED';
  if (R?.seg) setDynamicWalls(G.cfg.arena, []);
  G.view = 'sandbox'; render(); syncMusic(); return;
 }
 if (G.round >= PLAN.length) { if (R) R.end = 0; endRun(true); return; } // step()/finish() already set R.end; endRun's guard would bail out and the run summary never showed
 const notice = G.cfg?.rmode === 'h'
  ? ['hack', 'LAYER HACKED', `${G.world?.n || 'Runtime'} // ${G.sector}-${G.layer}`]
  : ['purge', 'LAYER PURGED', `${G.world?.n || 'Runtime'} // ${G.sector}-${G.layer}`];
 G.cat = null; G.offers = null; G.view = 'reward'; render();
 if (!G.sandbox) showRunNotice(...notice);
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
 G.resultEvent = !win
  ? 'death'
  : G.cfg?.rmode === 'h'
   ? 'hack'
   : G.cfg?.boss
    ? 'host-purge'
    : 'layer-purge';
}
function endRun(win) {
 if (G.view !== 'run' || R?.end) return;
 if (R) R.end = 1;
 if (G.sandbox) {
  G.sandboxMessage = win ? 'TEST COMPLETE // NO CAMPAIGN PROGRESS RECORDED' : 'TEST ENDED // NO CAMPAIGN PROGRESS RECORDED';
  if (R?.seg) setDynamicWalls(G.cfg.arena, []);
  keys = {}; joy = null; dashReq = false; mouseFire = 0; mobileFire = 0; mobileContinuous = 0;
  G.view = 'sandbox'; render(); stopMusic(.45); syncMusic();
  return;
 }
 captureRunResult(win);
 if (!win && R) {
  const reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
  R.deathSequence = { t: 0, duration: reducedMotion ? .45 : 2.8 };
  R.flash = 0;
  R.shake = 0;
  keys = {};
  joy = null;
  dashReq = false; mouseFire = 0; mobileFire = 0; mobileContinuous = 0; syncCombatUI();
 } else {
  G.view = 'result-event';
 }
 META.best = Math.max(META.best, G.round);
 if (win) META.wins++;
 G.gain = Math.floor(G.kills / 8) + G.round * 2 + (win ? 30 : 0);
 META.commits = (META.commits || 0) + G.gain;
 saveMeta();
 stopMusic(.45);
 preloadMusic(win ? 'win' : 'gameover');
 if (win) render();
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
 if (cat === 'd') {
  const out = shuffle(Object.keys(DK).filter(k => k !== 'slot' || (G.xs || 0) < 2)).slice(0, n).map(k => ({ t: 'd', k }));
  const w = Math.random() < WAND_ACQ.deck ? wandOffer() : null; if (w) out.push({ t: 'w', k: w }); // Deck & Hand reward: sometimes also a wand
  return out;
 }
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
 uiSound('card_draw');
 G.msg = `♻️ Recycled ${count} card${count > 1 ? 's' : ''}! Added ${count} fresh card${count > 1 ? 's' : ''} to Draw Pile: ${freshNames.join(', ')}.`;
 render();
}

function takeReward(o) {
 if (o.t === 'w') {
  if (acquireWand(o.k)) G.msg = `${wandName(o.k)} added to your collection. Equip it on the pipeline screen.`;
 } else if (o.t === 'c') {
  const c = mk(o.k);
  G.deck.push(c);
  G.disc.push(c);
 } else if (o.t === 'u') {
  G.u[o.k] = hu(o.k) + 1;
 } else if (o.k === 'slot') G.xs = (G.xs || 0) + 1;
 else if (o.k === 'hand') G.xh = (G.xh || 0) + 1;
 else G.hp = Math.min(G.max, G.hp + G.max * .5);
 calcST();
 uiSound('reward');
 afterReward();
}

// Arena / Combat Simulation
let PW = 0;
function freeSpot(arena) {
 if (ARENAS[arena].ps) return { x: ARENAS[arena].ps[0], y: ARENAS[arena].ps[1] };
 const sx = W / 640, sy = H / 400;
 for (const [x, y] of [[320, 300], [320, 200], [320, 335], [200, 200], [440, 200], [320, 60], [100, 200], [540, 200]]) {
  if (!wallHit(arena, x * sx, y * sy, 14) && !hazAt(arena, x * sx, y * sy)) return { x: x * sx, y: y * sy };
 }
 return { x: W / 2, y: H / 2 };
}
function spawnPos(arena, px, py) {
 for (let i = 0; i < 25; i++) {
  const s = ri(4), x = s < 2 ? 36 + Math.random() * (W - 72) : s === 2 ? 36 : W - 36, y = s < 2 ? (s ? H - 36 : 36) : 36 + Math.random() * (H - 72);
  if (!wallHit(arena, x, y, 16) && !hazAt(arena, x, y) && Math.hypot(x - px, y - py) > 190) return [x, y];
 }
 return [W / 2, 50];
}

const BOSS_INTRO_CUES = {
 leak: [
  [2.72, 'I have been watching you since the first sector.', 'MEMORY LEAK'],
  [4.05, 'I let you come this far.', 'MEMORY LEAK']
 ]
};

// ===== SEGMENT FAULT ENTRANCE (Citadel 403) =====
// Undertale-style dialogue: one box at the bottom, the text types out with a voice blip per character, a click / tap / Enter / Space / Z finishes the current
// line instantly, and the next one moves on. SKIP (top right) jumps straight to the fight for replays.
const SEG_DIALOGUE = [
 { who: 'CITADEL 403', kind: 'alert', text: 'SENTINEL PROTOCOL: ACTIVE.' },
 { who: 'TARGETING SYSTEM', kind: 'alert', text: 'HOSTILE SIGNATURE DETECTED.' },
 { who: 'TARGETING SYSTEM', kind: 'alert', text: 'IDENTITY: UNREGISTERED.' },
 { who: 'TARGETING SYSTEM', kind: 'alert', text: 'THREAT LEVEL: ESCALATING.' },
 { who: 'TARGETING SYSTEM', kind: 'alert', text: 'ENGAGING COUNTERMEASURES.' },
 { who: 'SYSTEM', kind: 'system', text: 'FRIENDLY SIGNATURE DETECTED.', cps: 22 },
 { who: 'SYSTEM', kind: 'system', text: 'ERROR.', cps: 14, shake: 1, flash: 1 },
 { who: 'SYSTEM', kind: 'system', text: 'FRIENDLY SIGNATURE NOT FOUND.\nRECLASSIFYING TARGET.' },
 { who: 'RECOVERED RADIO // FRAGMENT', kind: 'radio', text: 'OSCAR MIKE...', cps: 20 },
 { who: 'RECOVERED RADIO // FRAGMENT', kind: 'radio', text: 'FRACTU— [SIGNAL LOST]' },
 { who: 'RECOVERED RADIO // FRAGMENT', kind: 'radio', text: 'SIX? LC? REPEAT, SIX—' },
 { who: 'RECOVERED RADIO // FRAGMENT', kind: 'radio', text: '[STATIC]', cps: 10 },
 { who: 'UNKNOWN VOICE', kind: 'radio', text: '...still here...', cps: 12 },
 { who: 'SEGMENT FAULT', kind: 'boss', text: 'UNAUTHORIZED PRESENCE.', cps: 26, shake: 1 },
 { who: 'SEGMENT FAULT', kind: 'boss', text: 'PURGE THE INTRUDER.', cps: 30, shake: 1, flash: 1 },
 { who: 'SEGMENT FAULT', kind: 'boss', text: 'PURGE THE INTRUDER.\nPURGE—', cps: 38, shake: 1 },
 { who: 'SEGMENT FAULT', kind: 'boss', text: 'EXECUTING.', cps: 18, shake: 1, flash: 1 }
];
const SEG_KIND = {
 alert: { col: '#ff5267', txt: '#ffe9eb', blip: 'dlg_sys' },
 system: { col: '#ffb2b7', txt: '#fff0f1', blip: 'dlg_sys' },
 radio: { col: '#9bb2bd', txt: '#d8dfe0', blip: 'dlg_radio' },
 boss: { col: '#ff5c7a', txt: '#ff9aa9', blip: 'dlg_boss', glyph: '\u0416' },
 leak: { col: '#7dff6a', txt: '#d8ffd0', blip: 'dlg_boss', glyph: '\u04E8' },
 rt: { col: '#b48cff', txt: '#eadcff', blip: 'dlg_sys', glyph: '\u039E' }
};
// ===== MEMORY LEAK / RUNTIME ERROR INTROS: same dialogue box as Segment Fault =====
// line.attempts = the text "fails to load": it types up to `upto` of the line, glitches, wipes and starts over, each retry with more zalgo (z).
const LEAK_GENERIC = [
 { who: 'MEMORY LEAK', kind: 'leak', text: 'UNAUTHORIZED HOST.' },
 { who: 'MEMORY LEAK', kind: 'leak', text: 'RUNNING EXECUTION PHASE.', shake: 1 }
];
const LEAK_SOREN = [ // Glitch Host only (Soren Glitch): the scan can't decide whether it knows him
 { who: 'MEMORY LEAK', kind: 'leak', text: 'HOST DETECTED.' },
 { who: 'MEMORY LEAK', kind: 'leak', text: 'INITIALIZING SCAN...' },
 { who: 'MEMORY LEAK', kind: 'leak', text: '...', cps: 9 },
 { who: 'MEMORY LEAK', kind: 'leak', text: 'ERROR.', cps: 14, shake: 1, flash: 1 },
 { who: 'MEMORY LEAK', kind: 'leak', text: 'SIGNATURE RECOGNIZED.' },
 { who: 'MEMORY LEAK', kind: 'leak', text: 'SIGNATURE NOT FOUND.' },
 { who: 'MEMORY LEAK', kind: 'leak', text: 'SIGNATURE RECOGNIZED.' },
 { who: 'MEMORY LEAK', kind: 'leak', text: '...', cps: 9 },
 { who: 'MEMORY LEAK', kind: 'leak', text: 'YOU SHOULD NOT BE HERE.', shake: 1 },
 { who: 'MEMORY LEAK', kind: 'leak', text: 'YOU SHOULD NOT BE HERE.', shake: 1, attempts: [{ upto: .55, z: 1 }, { upto: 1, z: 1 }] },
 { who: 'MEMORY LEAK', kind: 'leak', text: 'YOU SHOULD NOT BE HEREEEEEEEEEEEE.', cps: 30, shake: 1, flash: 1, attempts: [{ upto: .3, z: 2 }, { upto: .62, z: 3 }, { upto: .85, z: 4 }, { upto: 1, z: 5 }] }
];
const RT_SCRIPT = [ // residual warning loop, not Trace talking to the Host
 { who: 'RUNTIME ERROR', kind: 'rt', text: 'PLEASE DO NOT APPROACH.', cps: 24 },
 { who: 'RUNTIME ERROR', kind: 'rt', text: 'PLEASE DO NOT APPROACH.', cps: 24 },
 { who: 'RUNTIME ERROR', kind: 'rt', text: 'PLEA\u0337SE D\u0338O N\u0336OT AP\u0335PROACH.', cps: 26, shake: 1 },
 { who: 'RUNTIME ERROR', kind: 'rt', text: 'PL\u0337E\u0338A\u0335S\u0336E\u0334 D\u0337O\u0338 N\u0336O\u0335T\u0334 A\u0337P\u0338P\u0335R\u0336O\u0337A\u0338C\u0335H\u0334.', cps: 30, shake: 1, flash: 1 }
];
const DLG_BOSSES = ['segfault', 'leak', 'runtime'];
const DLG_COLS = 25; // characters per row in the (narrow) dialogue box; text size is unchanged
const dlgVis = str => Array.from(str).filter(ch => !(ch >= '\u0300' && ch <= '\u036f')).length; // zalgo / strike marks take no width
function dlgWrap(text, max = DLG_COLS) {
 return text.split('\n').map(par => {
  const out = []; let row = '';
  for (const w of par.split(' ')) {
   if (row && dlgVis(row) + 1 + dlgVis(w) > max) { out.push(row); row = w; } else row = row ? row + ' ' + w : w;
  }
  out.push(row); return out.join('\n');
 }).join('\n');
}
function introScript(key) { return key === 'segfault' ? SEG_DIALOGUE : key === 'leak' ? (G.host === 'glitch' ? LEAK_SOREN : LEAK_GENERIC) : key === 'runtime' ? RT_SCRIPT : null; }
function introInit(key, rm) {
 const script = introScript(key);
 if (!script || key === 'segfault') return { script, core: 0, coreT: 0 };
 return { script, core: 0, coreT: 0, startAt: key === 'leak' ? (rm ? 1.2 : 2.6) : (rm ? .5 : 1.7), coreAt: Math.max(0, script.length - (script === LEAK_SOREN ? 3 : 1)) };
}
function zalgo(str, lvl, seed) {
 let o = '', i = 0;
 for (const ch of str) {
  o += ch; i++;
  if (ch === ' ' || ch === '\n') continue;
  for (let k = 0; k < lvl; k++) { const h = Math.sin(i * 12.9898 + k * 78.233 + seed * 37.719) * 43758.5453; o += String.fromCharCode(0x300 + Math.floor((h - Math.floor(h)) * 0x70)); }
 }
 return o;
}
function dlgShown(d) {
 const str = d.chars.slice(0, d.n).join(''), z = d.phase === 'fail' ? Math.max(3, (d.zl || 0) + 2) : (d.zl || 0);
 return z ? zalgo(str, z, Math.floor(R.t * 9)) : str;
}
function segDlgStart(intro, i) {
 const line = intro.script[i], chars = Array.from(dlgWrap(line.text)), cps = (line.cps || 34) * (intro.reducedMotion ? 2 : 1), cum = [];
 let t = 0;
 for (const ch of chars) { cum.push(t); t += 1 / cps; if (ch === ',' || ch === ';') t += .12; else if ('.!?…—'.includes(ch)) t += .22; }
 intro.dlg = { i, line, chars, cum, t: 0, n: 0, phase: 'typing', wait: 0, att: line.attempts ? 0 : -1, hold: 0, zl: line.attempts ? (line.attempts[0].z || 0) : (line.z || 0) };
 if (line.flash) R.flash = Math.max(R.flash, .2);
 if (line.shake) R.shake = Math.max(R.shake, 6);
}
function segDlgUpdate(intro, dt) {
 const d = intro.dlg;
 if (!d) return;
 if (d.phase === 'typing') {
  d.t += dt;
  const lim = d.att >= 0 ? Math.floor(d.chars.length * d.line.attempts[d.att].upto) : d.chars.length;
  let n = d.n;
  while (n < lim && d.cum[n] <= d.t) n++;
  if (n > d.n) { if (/[A-Za-z0-9]/.test(d.chars[n - 1])) sfx(SEG_KIND[d.line.kind].blip); d.n = n; }
  if (d.n >= lim) {
   if (d.att >= 0 && d.att < d.line.attempts.length - 1) { d.phase = 'fail'; d.hold = .55; R.shake = Math.max(R.shake, 4); sfx('dlg_sys'); } // load "fails": hold, then retry
   else d.phase = 'wait';
  }
 } else if (d.phase === 'fail') {
  d.hold -= dt;
  if (d.hold <= 0) { d.att++; d.n = 0; d.t = 0; d.zl = d.line.attempts[d.att].z || 0; d.phase = 'typing'; R.flash = Math.max(R.flash, .08); }
 } else d.wait += dt;
}
// One input for everything: first press completes the line, second press moves on, and after the last line the fight starts.
function segDialogueAdvance() {
 const intro = R?.bossIntro;
 if (!intro || !intro.dlg || intro.out != null) return;
 const d = intro.dlg;
 if (d.phase === 'typing' || d.phase === 'fail') { d.n = d.chars.length; if (d.att >= 0) { d.att = d.line.attempts.length - 1; d.zl = d.line.attempts[d.att].z || 0; } d.phase = 'wait'; uiSound('tick'); return; }
 if (d.i + 1 < intro.script.length) { segDlgStart(intro, d.i + 1); uiSound('click'); }
 else if (intro.script === SEG_DIALOGUE) { intro.out = SEGFAULT.intro.out; R.flash = .35; sfx('boss_phase'); setMusicMood(20000, 1, 1.1); } // ramp speed/filter back during the surge, not on the first fight frame
 else { intro.out = intro.script === RT_SCRIPT ? .3 : .45; R.flash = Math.max(R.flash, .15); } // Leak / Runtime: the box closes and the fight starts
}
// Memory Leak + Runtime Error intro driver (Segment Fault has its own scene in segIntroUpdate)
function dlgIntroFinish() {
 const intro = R?.bossIntro;
 if (!intro) return;
 R.bossIntro = null; R.flash = 0; R.p.inv = Math.max(R.p.inv, 1);
 setMusicMood(20000, 1, 1.1);
 keys = {}; joy = null; dashReq = false;
}
function bossIntroSkip() { if (G.cfg.boss === 'segfault') segIntroFinish(); else dlgIntroFinish(); }
function leakCoreAppear(intro) {
 intro.core = 2; const mc = R.leak?.mc;
 if (mc) { ring(mc.x, mc.y, 46, '#7dff6a', .5); burst(mc.x, mc.y, '#7dff6a', 14, 150); }
 R.flash = Math.max(R.flash, .18); R.shake = Math.max(R.shake, 6); sfx('boss_phase');
}
function leakCoreStep(intro, dt) { // the Main Core stays hidden until late in the dialogue: it telegraphs, then appears
 const L = R.leak, mc = L?.mc, b = L?.boss;
 if (!mc || !b) return;
 mc.ang += dt * 1.1; mc.x = b.x + Math.cos(mc.ang) * LEAK.mainCore.orbit; mc.y = b.y + Math.sin(mc.ang) * LEAK.mainCore.orbit;
 if (intro.core === 2) return;
 const d = intro.dlg;
 if (intro.core === 0 && d && d.i >= intro.coreAt) { intro.core = 1; intro.coreT = 0; sfx('zone_warn'); }
 if (intro.core === 1) { intro.coreT += dt; if (intro.coreT >= 1.1 && d && d.i >= intro.script.length - 1) leakCoreAppear(intro); }
}
function dlgIntroUpdate(intro, dt) {
 const key = G.cfg.boss, rm = intro.reducedMotion;
 R.t += dt; updMisc(dt);
 if (key === 'leak') leakCoreStep(intro, dt);
 if (intro.out != null) { intro.out -= dt; if (intro.out <= 0) dlgIntroFinish(); return; }
 if (intro.dlg) { segDlgUpdate(intro, dt); return; }
 intro.t += dt;
 if (key === 'leak' && !intro.warningPlayed && intro.t >= (rm ? .675 : 1.5)) { intro.warningPlayed = 1; sfx('boss_warning'); }
 if (key === 'runtime') {
  if (!intro.duck) { intro.duck = 1; setMusicMood(1300, .35, .5); } // background audio drops away
  const boss = R.en.find(e => e.boss && !e.dead);
  if (!intro.rev && intro.t >= intro.revealAt && boss) { intro.rev = 1; ring(boss.x, boss.y, 70, '#b48cff', .5); burst(boss.x, boss.y, '#b48cff', 18, 190); R.flash = Math.max(R.flash, .22); R.shake = Math.max(R.shake, 7); sfx('boss_warning', { x: boss.x }); }
 }
 if (intro.t >= intro.startAt) segDlgStart(intro, 0);
}
function segIntroImpact(intro) {
 intro.hit = 1;
 const S = R.seg, door = S?.walls.find(w => w.type === 'door'), [hx, hy] = SEGFAULT.intro.hit;
 if (door) segDamageWall(door, 1000, 0);
 intro.shards = [];
 for (let i = 0; i < 20; i++) intro.shards.push({ x: 709 + Math.random() * 10, y: 214 + Math.random() * 124, vx: -60 - Math.random() * 300 + (Math.random() < .25 ? 320 : 0), vy: (Math.random() - .5) * 220, a: Math.random() * 6, va: (Math.random() - .5) * 12, w: 5 + Math.random() * 9, h: 3 + Math.random() * 6, l: .9 + Math.random() * .7, c: i % 3 ? '#ff677c' : '#ffd5d9' });
 burst(hx - 20, hy, '#ffb36b', 26, 260); burst(hx - 20, hy, '#ff677c', 18, 200);
 ring(hx - 10, hy, 120, '#fff0c2', .5); ring(hx - 10, hy, 70, '#ff8793', .4);
 R.shake = Math.max(R.shake, 18); R.flash = Math.max(R.flash, .2);
 sfx('seg_impact'); sfx('shatter');
}
function segIntroFinish() {
 const intro = R?.bossIntro;
 if (!intro) return;
 const S = R.seg, C = SEGFAULT.intro, door = S?.walls.find(w => w.type === 'door'), mech = R.en.find(e => e.boss && !e.dead);
 if (door && door.hp > 0) { door.hp = 0; door.regenAt = Infinity; setDynamicWalls(G.cfg.arena, S.walls.filter(w => w.hp > 0).map(w => [w.x, w.y, w.w, w.h])); } // skipped before the crash: breach silently
 if (mech) { mech.x = C.land[0]; mech.y = C.land[1]; mech.faceAng = Math.atan2(R.p.y - mech.y, R.p.x - mech.x); }
 R.bossIntro = null; R.flash = 0; R.p.inv = Math.max(R.p.inv, 1);
 if (!intro.out) setMusicMood(20000, 1, 1.1); // skipped: still ramp gently
 keys = {}; joy = null; dashReq = false;
}
// Timeline (scene seconds): bay warm-up -> launch -> bulkhead impact -> skid into the keep -> scan the Host -> dialogue.
function segIntroUpdate(intro, dt) {
 const C = SEGFAULT.intro, mech = R.en.find(e => e.boss && !e.dead), p = R.p, k = intro.reducedMotion ? 2.5 : 1;
 updMisc(dt); // keeps shake, sparks, rings and floating text alive during the cutscene
 intro.shards = (intro.shards || []).filter(s => { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 240 * dt; s.a += s.va * dt; return (s.l -= dt) > 0; });
 if (intro.out != null) {
  intro.out -= dt; R.shake = Math.max(R.shake, 4);
  if (intro.out <= 0) segIntroFinish();
  return;
 }
 if (intro.dlg) { segDlgUpdate(intro, dt); return; }
 intro.st = (intro.st || 0) + dt * k;
 const st = intro.st;
 if (mech) {
  const [bx, by] = C.bay, [hx, hy] = C.hit, [lx, ly] = C.land;
  if (st < C.dashAt) {
   const j = cl(st / C.dashAt, 0, 1);
   mech.x = bx + (Math.random() - .5) * 3 * j; mech.y = by + (Math.random() - .5) * 3 * j; mech.faceAng = Math.PI;
   if (st > .8) segExhaust(mech, Math.PI, dt, .3 + .7 * j);
  } else if (st < C.hitAt) {
   const u = (st - C.dashAt) / (C.hitAt - C.dashAt);
   mech.x = bx + (hx - bx) * u * u * u; mech.y = by; mech.faceAng = Math.PI;
   segExhaust(mech, Math.PI, dt);
  } else {
   if (!intro.hit) segIntroImpact(intro);
   if (st < C.skidEnd) {
    const u = (st - C.hitAt) / (C.skidEnd - C.hitAt), e = 1 - Math.pow(1 - u, 3);
    mech.x = hx + (lx - hx) * e; mech.y = hy + (ly - hy) * e; mech.faceAng = Math.PI + Math.sin(u * 8) * (1 - u) * .3;
    segExhaust(mech, mech.faceAng, dt, 1 - u * .8);
    if (Math.random() < .7) part(mech.x + mech.r * .7, mech.y + (Math.random() - .5) * mech.r * 1.6, 60 + Math.random() * 120, (Math.random() - .5) * 160, .35, '#ffb36b', 2 + Math.random() * 2, 0);
   } else {
    mech.x = lx; mech.y = ly;
    const want = Math.atan2(p.y - ly, p.x - lx), diff = Math.atan2(Math.sin(want - mech.faceAng), Math.cos(want - mech.faceAng));
    mech.faceAng += cl(diff, -3 * dt, 3 * dt);
   }
  }
 }
 if (st >= C.dlgAt) segDlgStart(intro, 0);
}

function fight() {
 closePause();
 G.slots.forEach(c => c.lk = 1);
 const c = G.cfg;
 roomSetup(c);
 const reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
 setArenaSize(ARENAS[c.arena].W || 640, ARENAS[c.arena].H || 400); // fixed framing for the whole fight: the full room is always visible, no zoom/scroll
 G.last = [...G.slots];
 G.view = 'run';
 render();
 const startSh = G.sh != null ? G.sh : ST.shmax;
 R = {
  t: 0, end: 0, sandbox: !!G.sandbox, invincible: !!G.sandboxImmortal,
  p: { ...(c.map && !c.boss ? roomSpawn(c) : freeSpot(c.arena)), vx: 0, vy: 0, inv: .5, dash: 0, dcd: 0, nod: 0, fx: 0, fy: -1, sh: startSh, mov: 0, orb: null },
  en: [], pr: [], eb: [], tg: [], ps: [], tx: [], fx: [], lines: [], ht: [],
  casts: compilePipeline(G.slots, ST).out.map((cc, i) => ({
   c: cc, id: i, label: castLabel(cc), t: 0, pend: 0, bt: 0, n: 0, dis: 0,
   period: 1 / stats(cc, ST).rate, rate: stats(cc, ST).rate
  })),
  damageByCard: [], damageTotal: 0, damageTaken: 0, castsExecuted: 0,
  spT: .5, budget: c.boss ? 0 : c.budget, gh: [], shake: 0, flash: 0, banner: null, emul: 1, fdT: 0,
  hasW: ARENAS[c.arena].w.length > 0,
  blk: Array.from({ length: GW * GH }, (_, i) => wallHit(c.arena, (i % GW) * 20 + 10, (i / GW | 0) * 20 + 10, 14)),
  boss: c.boss, bossDead: 0, bossIntro: c.boss ? { t: 0, st: 0, duration: c.boss === 'segfault' ? 9999 : reducedMotion ? (c.boss === 'leak' ? 2.4 : .8) : (c.boss === 'leak' ? 5.2 : 2), revealAt: c.boss === 'segfault' ? 0 : c.boss === 'leak' ? null : reducedMotion ? (c.boss === 'runtime' ? .3 : .4) : (c.boss === 'runtime' ? 1.0 : 1.35), reducedMotion, ...introInit(c.boss, reducedMotion), warningPlayed: 0, dialogueIndex: 0, waitingForNext: false } : null, gcGain: 0, paused: 0, ct: .2,
  combatMode: 1, attackHeld: 0, mobileAim: null,
  col: { pan: css('--panel'), ink: css('--ink'), mu: css('--mute'), mult: css('--mult'), chip: css('--chip'), gold: css('--gold') }
 };
 if (G.world && G.world.key === 'boot') R.col = { pan: '#0d1629', ink: '#e8eefc', mu: '#7f93b8', mult: '#ff7a45', chip: '#5ee0d0', gold: '#e2b24a' }; // Boot Sector floor is always dark: keep HUD text light regardless of the page theme
 if (c.map && !c.boss) roomInit(c);
 mouseFire = 0; mobileFire = 0; mobileContinuous = 0; fireBlockedX = 0; keys.x = 0;
 mouseX = R.p.x + 100; mouseY = R.p.y;
 if (c.boss) c.boss === 'segfault' ? setMusicMood(1300, .6, .35, .78) : setMusicMood(20000, .72, .35, .9); // Segment Fault entrance: slowed + muffled
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
  if (!c.map || (R.room.type === 'X' && !R.room.cleared)) { // hack terminal + data cores only in hostile exit nodes of mapped layers
   R.term = { ...fp(), p: 0 };
   R.pk = [fp(), fp(), fp()];
  }
 }
 if (c.elite) {
  const k = wpick(poolFor(c.i, 99).filter(kk => kk !== 'swarm' && kk !== 'chain'));
  const [x, y] = spawnPos(c.arena, R.p.x, R.p.y);
  const e = spawnE(k, x, y, { hm: 3.2, dm: 1.3, rs: 1.4 });
  e.elite = 1;
  if (Math.random() < .5) e.sp *= 1.3; else e.blast = 1;
  R.banner = { t: 2, s: 'ELITE: ' + k.toUpperCase() };
 }

 const cv = $('#cv');
 R.fs = W / (cv.getBoundingClientRect().width || W);
 const introNext = $('#intro-next');
 const syncIntroNext = () => {
  if (!introNext) return;
  const intro = R?.bossIntro;
  if (DLG_BOSSES.includes(G.cfg.boss)) { // Segment Fault / Memory Leak / Runtime Error use the on-canvas dialogue box; this button skips the whole entrance (handy on replays)
   introNext.style.display = intro ? 'block' : 'none';
   introNext.textContent = 'SKIP \u25B8\u25B8'; introNext.disabled = false;
   introNext.classList.toggle('segfault', G.cfg.boss === 'segfault'); introNext.classList.toggle('leak', G.cfg.boss === 'leak');
   return;
  }
  const dialogueVisible = intro?.waitingForNext && (G.cfg.boss === 'segfault' || G.cfg.boss === 'leak');
  introNext.style.display = dialogueVisible ? 'block' : 'none';
  introNext.textContent = 'NEXT';
  introNext.disabled = !intro?.waitingForNext;
  introNext.classList.toggle('segfault', G.cfg.boss === 'segfault');
  introNext.classList.toggle('leak', G.cfg.boss === 'leak');
 };
 if (introNext) introNext.onclick = e => {
  e.preventDefault(); e.stopPropagation();
  if (DLG_BOSSES.includes(G.cfg.boss)) { if (R?.bossIntro) bossIntroSkip(); syncIntroNext(); return; }
  const intro = R?.bossIntro;
  const cues = BOSS_INTRO_CUES[G.cfg.boss];
  if (!intro?.waitingForNext || !cues) return;
  const factor = intro.reducedMotion ? (G.cfg.boss === 'leak' ? .45 : .4) : 1;
  intro.dialogueIndex++;
  intro.waitingForNext = false;
  intro.t = intro.dialogueIndex < cues.length ? cues[intro.dialogueIndex][0] * factor : intro.duration;
  syncIntroNext();
 };
 syncIntroNext();
 const updateMouseAim = e => {
  if (!R || !cv || G.view !== 'run') return;
  R.mobileAim = null;
  const rc = cv.getBoundingClientRect(), scale = W / (rc.width || W);
  mouseX = cl((e.clientX - rc.left) * scale, 0, W);
  mouseY = cl((e.clientY - rc.top) * scale, 0, H);
 };
 cv.onpointerdown = e => {
  if (R.seg?.relays?.some(r => r.qte)) { // QTE buttons (touch / mouse)
   const rc = cv.getBoundingClientRect(), px = (e.clientX - rc.left) * W / rc.width, py = (e.clientY - rc.top) * H / rc.height;
   for (let i = 0; i < 4; i++) { const b = qteBtn(i); if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) { e.preventDefault(); segQteInput(i); return; } }
  }
  if (R.bossIntro && DLG_BOSSES.includes(G.cfg.boss)) { e.preventDefault(); if (e.pointerType !== 'mouse' || e.button === 0) segDialogueAdvance(); return; }
  if (e.pointerType === 'mouse') {
   updateMouseAim(e);
   if (e.button === 0) { e.preventDefault(); if (!R.paused && !R.bossIntro && !R.end) setCombatMode(!R.combatMode); }
   else if (e.button === 2) { e.preventDefault(); if (!R.paused && !R.bossIntro && !R.end) mouseFire = 1; }
   return;
  }
  cv.setPointerCapture(e.pointerId);
  const rc = cv.getBoundingClientRect(), sc = W / rc.width;
  joy = { ox: e.clientX, oy: e.clientY, x: 0, y: 0, sc, cx: (e.clientX - rc.left) * sc, cy: (e.clientY - rc.top) * sc };
 };
 cv.onpointermove = e => {
  if (e.pointerType === 'mouse') updateMouseAim(e);
  if (joy) {
   const dx = e.clientX - joy.ox, dy = e.clientY - joy.oy, l = Math.hypot(dx, dy) || 1, k = Math.min(1, l / 36);
   joy.x = dx / l * k; joy.y = dy / l * k;
  }
 };
 cv.onpointerup = cv.onpointercancel = e => { joy = null; if (e.pointerType === 'mouse' && e.button === 2) mouseFire = 0; };
 cv.oncontextmenu = e => e.preventDefault();
 const aimPad = $('#aim-pad');
 if (aimPad) {
  let aimPointer = null;
  const setTouchAim = e => {
   const rc = aimPad.getBoundingClientRect();
   const dx = e.clientX - (rc.left + rc.width / 2), dy = e.clientY - (rc.top + rc.height / 2);
   if (Math.hypot(dx, dy) > 4) R.mobileAim = Math.atan2(dy, dx);
  };
  aimPad.onpointerdown = e => { e.preventDefault(); e.stopPropagation(); aimPointer = e.pointerId; aimPad.setPointerCapture(e.pointerId); setTouchAim(e); };
  aimPad.onpointermove = e => { if (e.pointerId === aimPointer) setTouchAim(e); };
  aimPad.onpointerup = aimPad.onpointercancel = e => { if (e.pointerId === aimPointer) aimPointer = null; };
 }
 const attackButton = $('#mobile-fire');
 if (attackButton) {
  attackButton.onpointerdown = e => { e.preventDefault(); e.stopPropagation(); if (!R.paused && !R.bossIntro && !R.end) mobileFire = 1; attackButton.setPointerCapture(e.pointerId); };
  attackButton.onpointerup = attackButton.onpointercancel = attackButton.onlostpointercapture = e => { e.preventDefault(); mobileFire = 0; };
 }
 const combatButton = $('#combat-toggle');
 if (combatButton) combatButton.onclick = e => { e.preventDefault(); e.stopPropagation(); if (!R.paused && !R.bossIntro && !R.end) setCombatMode(!R.combatMode); };
 const continuousButton = $('#continuous-fire');
 if (continuousButton) continuousButton.onclick = e => {
  e.preventDefault(); e.stopPropagation();
  if (R.paused || R.bossIntro || R.end) return;
  mobileContinuous = mobileContinuous ? 0 : 1;
  syncCombatUI();
 };
 syncCombatUI();
 const db = $('#dash');
 if (db) db.onpointerdown = e => { e.stopPropagation(); dashReq = true; };
 const ib = $('#interact');
 if (ib) ib.onpointerdown = e => { e.preventDefault(); e.stopPropagation(); interact(); };

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
  if (R.bossIntro && !R.paused) {
   const intro = R.bossIntro;
   if (G.cfg.boss === 'segfault') {
    R.t += dt;
    segIntroUpdate(intro, dt);
   } else if (G.cfg.boss === 'leak' || G.cfg.boss === 'runtime') {
    dlgIntroUpdate(intro, dt);
   } else {
    const cues = BOSS_INTRO_CUES[G.cfg.boss];
    const factor = intro.reducedMotion ? (G.cfg.boss === 'leak' ? .45 : .4) : 1;
    if (!intro.waitingForNext) {
     intro.t = Math.min(intro.duration, intro.t + dt);
     const cue = cues?.[intro.dialogueIndex];
     if (cue) {
      const revealTime = G.cfg.boss === 'leak' && !intro.reducedMotion ? cue[1].length / 37 : 0;
      const pauseAt = (cue[0] + revealTime) * factor;
      if (intro.t >= pauseAt) {
       intro.t = pauseAt;
       intro.waitingForNext = true;
      }
     }
    }
    R.t += dt * .2;
    if (G.cfg.boss === 'leak' && !intro.warningPlayed && intro.t >= (intro.reducedMotion ? .675 : 1.5)) {
     intro.warningPlayed = 1;
     sfx('boss_warning');
    }
    if (intro.t >= intro.duration) {
     R.bossIntro = null;
     if (G.cfg.boss) setMusicMood(20000, 1, 1);
     keys = {};
     joy = null;
     dashReq = false;
    }
   }
   syncIntroNext();
  } else if (!R.end && !R.paused) {
   R.t += dt; G.time += dt;
   step(R.sandbox && R.sbSpeed ? dt * R.sbSpeed : dt);
  } else if (R.deathSequence && !R.paused) {
   const sequence = R.deathSequence;
   sequence.t = Math.min(sequence.duration, sequence.t + dt);
   R.t += dt * .12;
  }
  draw(ctx);
  if (R.deathSequence && R.deathSequence.t >= R.deathSequence.duration && G.view === 'run') {
   R.deathSequence = null;
   G.view = 'result-event';
   render();
   syncMusic();
   return;
  }
  requestAnimationFrame(loop);
 };
 requestAnimationFrame(loop);
}

// ===== ROOMS: connected layer maps (0.8) + special rooms, Cycle Shop and Cycles (0.9) =====
// A layer with a map is a graph of rooms. Each room entry is one fight(): G.cfg.map.cur names the room, roomSetup() points G.cfg at that room's
// arena / budget / elite flag, and R.room carries the live room state. Walking through an open door calls leaveRoom(), which re-enters fight().
// Persistent per-layer state (visited / cleared / looted rooms, shop stock) lives on G.cfg.map, so returning to a room never re-runs its encounter.
const roomMap = () => G.cfg?.map || null;
function findFree(arena, x, y) {
 for (let r = 0; r < 240; r += 10) for (let a = 0; a < 16; a++) {
  const px = x + Math.cos(a / 16 * 6.283) * r, py = y + Math.sin(a / 16 * 6.283) * r;
  if (!wallHit(arena, px, py, 16) && !hazAt(arena, px, py)) return { x: px, y: py };
 }
 return { x, y };
}
function roomSetup(c) { // top of fight(): aim the shared cfg at the current room
 const M = c.map; if (!M) return;
 const rm = M.rooms[M.cur], T = ROOM_TYPES[rm.type], st = M.state[rm.id];
  st.seen = true;
 c.arena = rm.arena;
 if (T.boss) { c.boss = c.bossKey; c.k = 'fb'; c.budget = 0; c.elite = false; return; } // the boss chamber runs through the original boss code
 const fresh = !T.safe && !st.cleared;
 c.budget = fresh ? Math.min(36, (c.layerBudget || c.budget) * (T.budget || .45)) : 0;
 c.elite = !!(T.elite && fresh);
}
function roomSpawn(c) {
 if (c.resumePos) { const p = c.resumePos; c.resumePos = null; return { x: p.x, y: p.y }; }
 if (c.entryDir && ENTRY_SPOT[c.entryDir]) { const [x, y] = ENTRY_SPOT[c.entryDir]; return { x, y }; }
 return freeSpot(c.arena);
}
function roomInit(c) { // right after R exists
 const M = c.map, rm = M.rooms[M.cur], T = ROOM_TYPES[rm.type], st = M.state[rm.id];
 const room = R.room = { id: rm.id, type: rm.type, T, cleared: !!(T.safe || st.cleared), t: 0, acts: [], near: null, rewardWait: 0 };
 if (rm.type === 'T') room.acts.push({ k: 'chest', ...findFree(c.arena, 320, 200), r: 48, label: st.looted ? 'EMPTY CACHE' : '[E] OPEN CACHE' });
  if (rm.type === 'E' && st.rewarded && !st.claimed) room.acts.push({ k: 'chest', reward: 'challenge', ...findFree(c.arena, 320, 200), r: 48, label: '[E] OPEN REWARD CHEST' }); // left before claiming: the chest is still here
 if (rm.type === '$') {
  M.shop = M.shop || {}; room.shop = M.shop[rm.id] = M.shop[rm.id] || buildShopStock();
  room.merchant = { x: 320, y: 138 };
  room.acts.push({ k: 'merchant', x: 320, y: 168, r: 72, label: '[E] TALK TO MERCHANT' }, { k: 'slots', x: 205, y: 168, r: 44, label: '[E] CYCLE SLOTS' });
 }
 if (T.exit && room.cleared) room.portal = findFree(c.arena, 320, 200);
 R.banner = rm.type === 'E' ? { t: 2.4, s: 'CHALLENGE: ELITE HUNT' } : rm.type === 'X' ? { t: 1.8, s: 'EXIT NODE' } : rm.type === 'C' && !room.cleared ? { t: 1.2, s: 'HOSTILE PROCESS' } : rm.type === '$' ? { t: 2.2, s: 'CYCLE SHOP' } : rm.type === 'T' ? { t: 1.6, s: 'TREASURE CACHE' } : null;
 if (rm.type === '$') { preloadMusic('cycles_shop'); }
 if (rm.type === 'S' && c.bossKey) R.banner = { t: 2.6, s: 'BOSS DOOR AHEAD' };
 bindMapUI();
 syncMusic();
}
function leaveRoom(d) {
 const M = roomMap(), rm = M.rooms[R.room.id], to = rm.doors[d]; if (!to || R.end) return;
 G.sh = Math.max(0, R.p.sh);
 R.end = 1; // the old loop stops; fight() builds a fresh R for the next room
 M.cur = to; G.cfg.entryDir = DIR_OPP[d]; G.cfg.resumePos = null;
 if (M.rooms[to].type === 'B') { sfx('objective'); beginBossLoad(G.cfg.bossKey, () => fight()); return; } // boss door: the original boss boot screen, then the dedicated arena
 sfx('dash');
 fight();
}
function roomClear(m) { // a hostile room has been beaten (swarm cleared, or the exit node's hack / data objective completed)
 const room = R.room, M = roomMap(), st = M.state[room.id];
 if (room.cleared) return;
 room.cleared = true; st.cleared = true;
 R.en = []; R.eb = []; R.tg = []; R.term = null; R.pk = [];
 R.banner = { t: 1.8, s: m === 'h' ? 'HACK COMPLETE' : m === 'o' ? 'DATA RECOVERED: BONUS' : room.type === 'E' ? 'CHALLENGE CLEARED' : 'ROOM CLEARED' };
 sfx('objective');
 const earn = CYCLES.earn[room.type] || 0;
 if (earn) { G.cycles += earn; txt(R.p.x, R.p.y - 26, '+' + earn + ' CYCLES', '#e2b24a', 12); }
 if (room.type === 'X') { M.layerMode = m; G.cfg.rmode = m; room.portal = findFree(G.cfg.arena, 320, 200); }
 if (room.type === 'E' && !st.rewarded) {
  st.rewarded = true; // the reward is NOT opened automatically any more: a chest unlocks and the player opens it
  const spot = findFree(G.cfg.arena, 320, 200);
  room.acts.push({ k: 'chest', reward: 'challenge', ...spot, r: 48, label: '[E] OPEN REWARD CHEST' });
  R.banner = { t: 2.2, s: 'REWARD CHEST UNLOCKED' }; ring(spot.x, spot.y, 30, '#ff7ad9', .5); sfx('pickup');
 }
}
function layerExit() { // stepping on the exit node's portal ends the layer through the ORIGINAL reward flow
 if (R.end) return;
 R.end = 1; G.cfg.rmode = roomMap().layerMode || 'p';
 R.banner = { t: 1.2, s: 'LAYER COMPLETE' }; sfx('objective');
 setTimeout(clearRound, 500);
}
function startRoomReward(kind) {
 if (G.view !== 'run' || !R?.room) return;
 G.sh = Math.max(0, R.p.sh);
 G.rewardCtx = { kind, room: R.room.id }; G.cfg.resumePos = { x: R.p.x, y: R.p.y };
 G.cfg.rmode = 'p'; G.cfg.elite = kind === 'challenge'; // challenge rooms pay the established Elite Hunt rarity table (uncommon or better)
 R.end = 1; keys = {}; joy = null; dashReq = false; mouseFire = 0; mobileFire = 0; mobileContinuous = 0;
 if (kind === 'chest') { G.cat = 'c'; G.offers = rollRewards('c'); const w = Math.random() < WAND_ACQ.chest ? wandOffer() : null; if (w) G.offers.push({ t: 'w', k: w }); } // Treasure chest: sometimes also a wand else { G.cat = null; G.offers = null; }
 G.view = 'reward'; render(); syncMusic();
}
function afterReward() {
 if (G.rewardCtx) { G.rewardCtx = null; G.cfg.elite = false; G.cat = null; G.offers = null; fight(); return; } // back to the room you were in
 advance();
}
const chestSpent = (a, st) => a.reward === 'challenge' ? !!st.claimed : !!st.looted;
function openChest(act) {
 const st = roomMap().state[R.room.id];
 if (act.reward === 'challenge') { // challenge reward chest: flagged BEFORE the existing reward screen opens, so it can never pay out twice
  if (st.claimed) { R.hint = { t: 1.4, s: 'This reward was already claimed.' }; uiSound('deny'); return; }
  st.claimed = true; act.label = 'EMPTY'; sfx('pickup');
  startRoomReward('challenge');
  return;
 }
 if (st.looted) { R.hint = { t: 1.4, s: 'This cache is already empty.' }; uiSound('deny'); return; }
 st.looted = true; act.label = 'EMPTY CACHE'; // flagged BEFORE the reward screen opens, so it can never pay out twice
 const [lo, hi] = CYCLES.chestCycles, n = lo + ri(hi - lo + 1);
 G.cycles += n; sfx('pickup');
 startRoomReward('chest');
 G.rewardNote = `Cache opened: +${n} Cycles. Choose 1 card.`;
}
function useItem(k) {
 if (!R || G.view !== 'run' || !R.room || !R.room.cleared || R.end) { if (R) R.hint = { t: 1.4, s: 'Items can only be used once the room is clear.' }; uiSound('deny'); return; }
 if (!(G.items[k] > 0)) { uiSound('deny'); return; }
 if (k === 'restore') {
  if (G.hp >= G.max) { R.hint = { t: 1.4, s: 'HP is already full.' }; uiSound('deny'); return; }
  G.items.restore--; healP(G.max * SHOP.restore.heal);
 }
}
const nearDoor = (d, p) => d === 'W' ? p.x < 14 && Math.abs(p.y - H / 2) < 46 : d === 'E' ? p.x > W - 14 && Math.abs(p.y - H / 2) < 46 : d === 'N' ? p.y < 14 && Math.abs(p.x - W / 2) < 46 : p.y > H - 14 && Math.abs(p.x - W / 2) < 46;
function roomTick(dt) { // runs every frame while the room is clear / safe
 const room = R.room, M = roomMap(), rm = M.rooms[room.id], p = R.p;
 room.t += dt;
 if (room.rewardWait || R.end) return;
 if (room.portal && Math.hypot(p.x - room.portal.x, p.y - room.portal.y) < 26) { layerExit(); return; }
 if (room.t > .45) for (const d in rm.doors) if (nearDoor(d, p)) { leaveRoom(d); return; }
 room.near = null;
 for (const a of room.acts) if (Math.hypot(p.x - a.x, p.y - a.y) < a.r && !(a.k === 'chest' && chestSpent(a, M.state[room.id]))) { room.near = a; break; }
 const ib = $('#interact'); if (ib) { const show = room.near ? '1' : ''; if (ib.dataset.on !== show) { ib.dataset.on = show; ib.style.display = show ? 'block' : 'none'; } if (room.near) ib.textContent = room.near.k === 'chest' ? 'OPEN' : room.near.k === 'slots' ? 'SLOTS' : 'TALK'; }
}
function interact() {
 if (!R || G.view !== 'run' || R.end || R.paused || R.shopOpen || !R.room || !R.room.cleared || !R.room.near) return;
 const a = R.room.near;
 if (a.k === 'chest') openChest(a);
 else if (a.k === 'merchant') openShop('main');
 else if (a.k === 'slots') openShop('slots');
}

// ---- Drawing: doors, props, merchant, portal, minimap ----
// Pixel-art shop robot (rectangles on a 64x64 grid, scaled up without smoothing; no image assets). Feet stand at (fx, fy); s = pixel size.
const MP = { k: '#0b0d10', nv: '#1e5b8c', nvl: '#3a86bd', nvd: '#12395a', br: '#c8902a', brl: '#f2c456', brd: '#7a5416', st: '#9aa5b1', stl: '#cdd5dd', std: '#5a6572', sc: '#07090d', ey: '#ffd83a', ap: '#7b4b25', apl: '#a0662f', apd: '#4d2d15', gr: '#6f9230', tan: '#caa55c', tand: '#8f7438', wood: '#7a4a24', woodl: '#9c6430' };
const MLED = ['#ff4d6d', '#ffd83a', '#59e0ff', '#7dff9a', '#b45cff'];
const mpx = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const mob = (g, x, y, w, h, c) => { mpx(g, x - 1, y - 1, w + 2, h + 2, MP.k); mpx(g, x, y, w, h, c); }; // block with a 1px outline
function drawMerchantPx(g, t) {
 const b = Math.sin(t * 2.2) > .5 ? 1 : 0;                       // idle breathing: head + torso drop 1px
 const blink = (t % 3.4) > 3.25, tw = Math.floor(t * 3), sway = Math.sin(t * 2.4) > .35 ? 1 : Math.sin(t * 2.4) < -.35 ? -1 : 0;
 mpx(g, 6, 61, 46, 2, 'rgba(0,0,0,.38)');                          // ground shadow
 // ---- broom (behind the robot): handle, LED string, ferrule, bristles on the floor
 mob(g, 12, 13, 2, 38, MP.wood); mpx(g, 12, 14, 1, 36, MP.woodl); mob(g, 11, 10, 4, 3, MP.br);
 for (let i = 0; i < 6; i++) { const y = 17 + i * 6, side = i % 2 ? 15 : 9, c = MLED[(i + tw) % 5]; mpx(g, side < 12 ? 10 : 14, y + 1, 2, 1, '#22301f'); mob(g, side, y, 2, 2, c); mpx(g, side, y, 1, 1, '#fff'); }
 for (let u = 0; u <= 22; u++) { const px = Math.round(13 + 21 * u / 22), py = Math.round(10 - 6 * u / 22 - 7 * Math.sin(Math.PI * u / 22)); mpx(g, px, py, 1, 1, u % 5 === 2 ? MLED[(u + tw) % 5] : '#22301f'); }
 mob(g, 11, 47, 4, 3, MP.br); mpx(g, 11, 47, 4, 1, MP.brl);
 const BW = [8, 10, 12, 14, 14, 14, 14, 14, 14, 14]; // bristles: a wide head that rests on the floor
 for (let r = 0; r < 10; r++) { const w = BW[r], x0 = 13 - Math.floor(w / 2) + (r > 6 ? sway : 0); mpx(g, x0 - 1, 51 + r, w + 2, 1, MP.k); }
 for (let r = 0; r < 10; r++) { const w = BW[r], x0 = 13 - Math.floor(w / 2) + (r > 6 ? sway : 0); mpx(g, x0, 51 + r, w, 1, MP.tan); for (let q = x0 + 1; q < x0 + w; q += 3) mpx(g, q, 51 + r, 1, 1, MP.tand); }
 mpx(g, 6, 61, 16, 1, MP.k);
 if (tw % 4 < 2) mpx(g, 3 + (tw % 3), 58 - (tw % 2), 1, 1, '#cbb88a');   // a speck of dust
 // ---- legs: piston stubs + tread feet
 mob(g, 30, 54, 3, 4, MP.std); mob(g, 39, 54, 3, 4, MP.std);
 for (const fx of [26, 36]) { mob(g, fx, 57, 11, 4, MP.nv); mpx(g, fx + 1, 58, 9, 1, MP.br); mpx(g, fx + 1, 60, 9, 1, MP.nvd); for (let q = 0; q < 3; q++) mpx(g, fx + 2 + q * 3, 59, 2, 1, MP.std); }
 // ---- torso (bobs with b)
 const y0 = b;
 mob(g, 28, 35 + y0, 16, 14, MP.nvd);
 mpx(g, 30, 36 + y0, 12, 5, MP.std); mpx(g, 30, 36 + y0, 12, 1, MP.stl); mob(g, 34, 37 + y0, 4, 3, MP.br); mpx(g, 34, 37 + y0, 4, 1, MP.brl);
 mob(g, 28, 41 + y0, 16, 12, MP.ap); mpx(g, 29, 42 + y0, 14, 1, MP.apl); mpx(g, 28, 41 + y0, 16, 1, MP.brd); mpx(g, 35, 41 + y0, 2, 1, MP.brl);
 mob(g, 30, 46 + y0, 5, 5, MP.apl); mpx(g, 30, 46 + y0, 5, 1, MP.apd); mob(g, 37, 46 + y0, 5, 5, MP.apl); mpx(g, 37, 46 + y0, 5, 1, MP.apd);
 mpx(g, 31, 44 + y0, 2, 2, MP.gr); mpx(g, 32, 48 + y0, 1, 2, '#6ab0ff'); mpx(g, 39, 44 + y0, 3, 3, '#e8d8b0'); mpx(g, 35, 48 + y0, 2, 4, MP.gr);
 // ---- shoulders + arms
 mob(g, 21, 35 + y0, 8, 6, MP.nv); mpx(g, 22, 36 + y0, 5, 1, MP.nvl); mpx(g, 21, 40 + y0, 8, 1, MP.br);
 mob(g, 43, 35 + y0, 8, 6, MP.nv); mpx(g, 44, 36 + y0, 5, 1, MP.nvl); mpx(g, 43, 40 + y0, 8, 1, MP.br);
 mob(g, 20, 42 + y0, 3, 4, MP.st); mob(g, 16, 45 + y0, 5, 3, MP.st); mob(g, 10, 43 + y0, 6, 6, MP.stl); mpx(g, 10, 46 + y0, 6, 1, MP.std); mpx(g, 11, 44 + y0, 2, 1, '#fff'); // left arm: tube + gauntlet gripping the handle
 mob(g, 48, 42 + y0, 3, 6, MP.st); mpx(g, 47, 47 + y0, 5, 2, MP.br); mob(g, 47, 50 + y0, 5, 3, MP.std); mpx(g, 47, 53 + y0, 2, 2, MP.std); mpx(g, 50, 53 + y0, 2, 2, MP.std); // right arm: cuff + two-prong claw
 // ---- head
 mob(g, 36, 7 + y0, 2, 5, MP.st); mob(g, 34, 2 + y0, 6, 5, MP.br); mpx(g, 35, 3 + y0, 2, 2, Math.sin(t * 5) > 0 ? '#fff6c0' : MP.brl);
 mob(g, 30, 10 + y0, 14, 2, MP.nv); mob(g, 27, 12 + y0, 20, 4, MP.nv); mpx(g, 31, 10 + y0, 7, 1, MP.nvl); mpx(g, 29, 13 + y0, 4, 2, MP.nvl); mpx(g, 41, 12 + y0, 5, 4, MP.nvd);
 mob(g, 25, 16 + y0, 24, 2, MP.br); mpx(g, 26, 16 + y0, 22, 1, MP.brl);
 mob(g, 26, 18 + y0, 22, 14, MP.st); mpx(g, 27, 18 + y0, 20, 1, MP.stl); mpx(g, 27, 30 + y0, 20, 1, MP.std);
 mpx(g, 28, 20 + y0, 18, 10, MP.sc);
 const eh = blink ? 1 : 4; mpx(g, 31, 22 + y0 + (blink ? 1.5 : 0) | 0, 3, eh, MP.ey); mpx(g, 40, 22 + y0 + (blink ? 1.5 : 0) | 0, 3, eh, MP.ey);
 for (let q = 0; q < 3; q++) mpx(g, 33 + q * 3, 28 + y0, 2, 1, (tw + q) % 3 === 0 ? '#7dff9a' : '#1c3a26');
 mob(g, 22, 19 + y0, 4, 10, MP.br); mpx(g, 23, 20 + y0, 1, 8, MP.brl); mob(g, 48, 19 + y0, 4, 10, MP.br); mpx(g, 49, 20 + y0, 1, 8, MP.brl); mpx(g, 50, 20 + y0, 1, 8, MP.brd);
}
let MER_CV = null;
function drawMerchant(x, fx, fy, s, t) {
 if (!MER_CV) { MER_CV = document.createElement('canvas'); MER_CV.width = 64; MER_CV.height = 64; }
 const g = MER_CV.getContext('2d'); g.clearRect(0, 0, 64, 64); drawMerchantPx(g, t);
 x.save(); x.imageSmoothingEnabled = false; x.drawImage(MER_CV, fx - 36 * s, fy - 61 * s, 64 * s, 64 * s); x.restore();
}

// ---- Themed room walls + door frames (visual only: the arena edge already collides at the player radius) ----
const WALLS = {
 boot: { fill: '#0b1a12', edge: '#62ff79', seam: '#1c5c35', acc: '#2fe06a', pat: 'circuit' },
 heap: { fill: '#1b1509', edge: '#ffb04f', seam: '#5e4216', acc: '#ffcf7a', pat: 'blocks' },
 null: { fill: '#110a1c', edge: '#b56cff', seam: '#43276f', acc: '#e0b3ff', pat: 'glitch' },
 nexus: { fill: '#13202e', edge: '#5fd3ff', seam: '#285572', acc: '#bdeeff', pat: 'panels' },
 kernel: { fill: '#1d0f0a', edge: '#ff765c', seam: '#6e2a1b', acc: '#ffb09e', pat: 'hazard' }
};
const WT = 9, GAP = 46; // wall thickness (= player radius), half the door width
function wallSegs(rm) {
 const d = rm.doors, f = (side, r, r2) => d[side] ? [r, r2] : [r];
 const hz = (y, side) => d[side] ? [[0, y, W / 2 - GAP, WT], [W / 2 + GAP, y, W / 2 - GAP, WT]] : [[0, y, W, WT]];
 const vt = (xx, side) => d[side] ? [[xx, WT, WT, H / 2 - GAP - WT], [xx, H / 2 + GAP, WT, H / 2 - GAP - WT]] : [[xx, WT, WT, H - 2 * WT]];
 return [...hz(0, 'N').map(r => [...r, 'N']), ...hz(H - WT, 'S').map(r => [...r, 'S']), ...vt(0, 'W').map(r => [...r, 'W']), ...vt(W - WT, 'E').map(r => [...r, 'E'])];
}
function drawWallsAndDoors(x, room, M, rm, t) {
 const th = WALLS[G.world?.key] || { fill: '#10161f', edge: G.world?.c?.[0] || '#9af5a0', seam: '#2a3646', acc: '#cfe', pat: 'panels' };
 x.save();
 for (const [sx, sy, sw, sh, side] of wallSegs(rm)) {
  const hor = sw > sh, len = hor ? sw : sh;
  x.fillStyle = th.fill; x.fillRect(sx, sy, sw, sh);
  for (let k = 6; k < len - 2; k += 12) { // theme pattern along the wall
   const px = hor ? sx + k : sx, py = hor ? sy : sy + k, a = (k * 7 + sx * 3 + sy) | 0, n = k % 36 === 6;
   if (th.pat === 'circuit') { if (n) { x.fillStyle = th.seam; x.fillRect(px, py, hor ? 1 : sw, hor ? sh : 1); } if (k % 72 === 6) { x.fillStyle = th.acc; x.fillRect(hor ? px - 1.5 : sx + sw / 2 - 1.5, hor ? sy + sh / 2 - 1.5 : py - 1.5, 3, 3); } }
   else if (th.pat === 'blocks') { x.fillStyle = (k / 12) % 2 ? 'rgba(255,176,79,.13)' : 'rgba(0,0,0,.28)'; x.fillRect(hor ? px - 6 : sx, hor ? sy : py - 6, hor ? 12 : sw, hor ? sh : 12); }
   else if (th.pat === 'glitch') { x.fillStyle = th.seam; x.fillRect(px, py, hor ? 1 : sw, hor ? sh : 1); if ((Math.floor(t * 6) + (a % 5)) % 5 === 0) { x.globalAlpha = .5; x.fillStyle = th.acc; x.fillRect(hor ? px - 3 : sx + (a % 5), hor ? sy + (a % 6) : py - 3, hor ? 9 : 2, hor ? 2 : 9); x.globalAlpha = 1; } }
   else if (th.pat === 'hazard') { x.strokeStyle = 'rgba(255,118,92,.38)'; x.lineWidth = 3; x.beginPath(); if (hor) { x.moveTo(px - 4, sy + sh); x.lineTo(px + 4, sy); } else { x.moveTo(sx + sw, py - 4); x.lineTo(sx, py + 4); } x.stroke(); }
   else { if (n) { x.fillStyle = th.seam; x.fillRect(px, py, hor ? 1 : sw, hor ? sh : 1); x.fillStyle = th.acc; x.beginPath(); x.arc(hor ? px : sx + sw / 2, hor ? sy + sh / 2 : py, 1.2, 0, 7); x.fill(); } }
  }
  x.strokeStyle = th.edge; x.lineWidth = 1.6; x.shadowColor = th.edge; x.shadowBlur = 5; x.beginPath(); // glowing inner edge
  if (side === 'N') { x.moveTo(sx, WT); x.lineTo(sx + sw, WT); } else if (side === 'S') { x.moveTo(sx, H - WT); x.lineTo(sx + sw, H - WT); } else if (side === 'W') { x.moveTo(WT, sy); x.lineTo(WT, sy + sh); } else { x.moveTo(W - WT, sy); x.lineTo(W - WT, sy + sh); }
  x.stroke(); x.shadowBlur = 0;
 }
 // Doors. Local frame per side: x runs along the wall (0 = door centre), y runs from the OUTER edge into the room, wall occupies y 0..WT.
 const FR = { N: [W / 2, 0, 0], S: [W / 2, H, Math.PI], W: [0, H / 2, -Math.PI / 2], E: [W, H / 2, Math.PI / 2] };
 const TAG = { N: [W / 2, WT + 38], S: [W / 2, H - WT - 38], W: [WT + 44, H / 2], E: [W - WT - 44, H / 2] };
 for (const side in rm.doors) {
  const to = M.rooms[rm.doors[side]], tt = ROOM_TYPES[to.type], boss = to.type === 'B', open = room.cleared, pulse = .6 + .35 * Math.sin(t * 4);
  const chal = to.type === 'E'; // Challenge Room entrance: amber hazard-trimmed gate. Distinct from ordinary doors, lighter than the red boss door.
  const col = boss ? '#ff4d6d' : chal ? '#ffb04f' : open ? tt.col : '#d23a3a', [fx, fy, fr] = FR[side], pw = boss ? 11 : chal ? 10 : 8, pd = WT + (boss ? 6 : chal ? 5 : 4);
  x.save(); x.translate(fx, fy); x.rotate(fr);
  x.fillStyle = '#0a0d12'; x.fillRect(-GAP - pw + 1, 0, pw, pd); x.fillRect(GAP - 1, 0, pw, pd); // posts
  x.strokeStyle = th.edge; x.lineWidth = 1.5; x.strokeRect(-GAP - pw + 1, 0, pw, pd); x.strokeRect(GAP - 1, 0, pw, pd);
  if (boss) { x.fillStyle = 'rgba(255,77,109,.6)'; for (let i = 0; i < 4; i++) { x.fillRect(-GAP - pw + 2, 2 + i * 4, pw - 2, 2); x.fillRect(GAP, 2 + i * 4, pw - 2, 2); } }
  x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 8; x.fillRect(-GAP - 4, pd - 2, 4, 3); x.fillRect(GAP, pd - 2, 4, 3); x.shadowBlur = 0; // post lights
  if (chal) { // amber caution stripes on the posts, a lintel plate and a small warning plaque
   x.fillStyle = 'rgba(255,176,79,.75)'; for (let i = 0; i < 3; i++) { x.fillRect(-GAP - pw + 2, 2 + i * 4, pw - 2, 2); x.fillRect(GAP, 2 + i * 4, pw - 2, 2); }
   x.strokeStyle = '#ffb04f'; x.lineWidth = 1.5; x.globalAlpha = .6 + .25 * Math.sin(t * 2.4); x.strokeRect(-GAP - pw + 1, 0, 2 * (GAP + pw) - 2, pd + 3); x.globalAlpha = 1;
   x.fillStyle = '#ffb04f'; x.beginPath(); x.moveTo(0, WT + 4); x.lineTo(7, WT + 16); x.lineTo(-7, WT + 16); x.closePath(); x.fill();
   x.fillStyle = '#1a1208'; x.font = "700 9px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('!', 0, WT + 12.5);
  }
  if (boss) { // boss door: glowing outer frame + a hazard-striped warning mat in front of it
   x.save(); x.globalAlpha = .55 + .35 * Math.sin(t * 3); x.strokeStyle = '#ff4d6d'; x.lineWidth = 2.5; x.shadowColor = '#ff4d6d'; x.shadowBlur = 14; x.strokeRect(-GAP - pw + 1, 0, 2 * (GAP + pw) - 2, pd + 26); x.restore();
   x.save(); x.beginPath(); x.rect(-GAP + 2, WT, 2 * GAP - 4, 24); x.clip(); x.fillStyle = 'rgba(8,4,6,.7)'; x.fillRect(-GAP, WT, 2 * GAP, 24);
   x.fillStyle = 'rgba(255,77,109,.5)'; const off = (t * 14) % 28; for (let i = -2; i < 8; i++) { const bx = -GAP + i * 28 + off; x.beginPath(); x.moveTo(bx, WT + 24); x.lineTo(bx + 12, WT + 24); x.lineTo(bx + 24, WT); x.lineTo(bx + 12, WT); x.closePath(); x.fill(); } x.restore();
  }
  if (!open) { // locked leaves meet in the middle
   x.fillStyle = '#2a1216'; x.fillRect(-GAP + 3, 1, 2 * GAP - 6, WT - 2);
   x.fillStyle = '#d23a3a'; for (let i = 0; i < 5; i++) x.fillRect(-GAP + 10 + i * 17, 3, 6, 3);
   x.fillStyle = '#ff6a6a'; x.fillRect(-1.5, 0, 3, WT);
  } else { // leaves retracted into the posts, glowing threshold
   x.fillStyle = '#20262f'; x.fillRect(-GAP + 1, 1, 7, WT - 2); x.fillRect(GAP - 8, 1, 7, WT - 2);
   x.globalAlpha = pulse; x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 10; x.fillRect(-GAP + 9, WT - 3, 2 * GAP - 18, 3); x.shadowBlur = 0;
   x.strokeStyle = col; x.lineWidth = 2; for (let i = 0; i < 3; i++) { const y = WT + 8 + i * 9 + (t * 16) % 9; x.globalAlpha = pulse * (1 - i * .28); x.beginPath(); x.moveTo(-6, y + 4); x.lineTo(0, y - 2); x.lineTo(6, y + 4); x.stroke(); } // chevrons toward the door
   x.globalAlpha = 1;
  }
  x.restore();
  const tag = boss ? 'BOSS' : chal ? 'CHALLENGE' : to.type === 'C' || to.type === 'X' ? '' : to.type;
  if (tag) { x.fillStyle = col; x.font = "700 " + (boss ? 14 : 11) + "px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = col; x.shadowBlur = boss ? 10 : 0; x.fillText(tag, TAG[side][0], TAG[side][1]); x.shadowBlur = 0; }
 }
 x.restore();
}
// Programming-themed data cache: dark armored crate, circuit traces, a glowing `{ }` terminal lid and a `>_` latch.
// kind 'T' = treasure cache (gold/cyan), 'E' = challenge reward (hot magenta/amber). spent = opened/emptied.
function drawChest(x, a, spent, kind, t) {
 const col = kind === 'E' ? '#ff7ad9' : '#5ee0d0', acc = kind === 'E' ? '#ffb04f' : '#e2b24a';
 x.save(); x.translate(a.x, a.y);
 x.shadowColor = col; x.shadowBlur = spent ? 0 : 12 + 4 * Math.sin(t * 3);
 x.fillStyle = spent ? '#1d222b' : '#0f1724'; x.fillRect(-19, -2, 38, 21); // body
 x.shadowBlur = 0; x.strokeStyle = spent ? '#4a5160' : col; x.lineWidth = 1.5; x.strokeRect(-19, -2, 38, 21);
 x.strokeStyle = spent ? '#323946' : 'rgba(94,224,208,.45)'; x.lineWidth = 1; // circuit traces
 x.beginPath(); x.moveTo(-15, 15); x.lineTo(-8, 15); x.lineTo(-8, 8); x.lineTo(-2, 8); x.moveTo(15, 15); x.lineTo(9, 15); x.lineTo(9, 6); x.stroke();
 x.fillStyle = spent ? '#4a5160' : acc; for (const [px, py] of [[-8, 8], [9, 6], [-2, 8]]) x.fillRect(px - 1.5, py - 1.5, 3, 3);
 x.fillStyle = spent ? '#2a303b' : '#1b2a40'; x.fillRect(-19, -2, 38, 4); // lid seam
 if (spent) { // lid slid open: dark empty bay, `null`
  x.fillStyle = '#10141b'; x.fillRect(-19, -13, 38, 10); x.strokeStyle = '#4a5160'; x.strokeRect(-19, -13, 38, 10);
  x.fillStyle = '#6b7385'; x.font = "700 7px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('null', 0, -8);
 } else {
  x.fillStyle = '#0b1220'; x.fillRect(-19, -13, 38, 11); x.strokeStyle = col; x.strokeRect(-19, -13, 38, 11);
  x.fillStyle = col; x.font = "700 9px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(kind === 'E' ? '{sudo}' : '{ }', 0, -7);
  x.fillStyle = '#05080d'; x.fillRect(-7, 5, 14, 9); x.strokeStyle = acc; x.strokeRect(-7, 5, 14, 9);
  x.fillStyle = acc; x.font = "700 7px 'JetBrains Mono',monospace"; x.fillText(Math.floor(t * 2) % 2 ? '>_' : '> ', 0, 9.5);
  x.fillStyle = col; for (const sx of [-19, 19]) { x.fillRect(sx - 2, -13, 4, 3); x.fillRect(sx - 2, 16, 4, 3); } // corner brackets
 }
 x.restore();
}
function drawRoomLayer(x) {
 const room = R.room, M = roomMap(), rm = M.rooms[room.id], t = R.t, T = room.T;
 drawWallsAndDoors(x, room, M, rm, t);
 for (const a of room.acts) if (a.k === 'chest') drawChest(x, a, chestSpent(a, M.state[room.id]), a.reward ? 'E' : 'T', t); // treasure cache + challenge reward chest
 if (room.type === '$') { // cycle shop: marquee bulbs, counter, slot machine, odds board and the merchant
  x.save();
  for (let i = 0; i < 15; i++) { const on = (Math.floor(t * 6) + i) % 3 === 0; x.fillStyle = on ? '#ffd24a' : '#5a4a1a'; x.beginPath(); x.arc(70 + i * 36, 10, 3, 0, 7); x.fill(); }
  x.fillStyle = '#b45cff'; x.font = "700 12px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.fillText(`// CYCLES :: house edge ${Math.round((1 - slotRTP()) * 100)}% //`, W / 2, 30);
  drawMerchant(x, 320, 186, 2, t);
  x.fillStyle = '#3b2a55'; x.fillRect(244, 176, 152, 18); x.strokeStyle = '#b45cff'; x.lineWidth = 1.5; x.strokeRect(244, 176, 152, 18); // counter (in front of the robot's feet)
  x.fillStyle = '#e2b24a'; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(262 + i * 24, 185, 2.5, 0, 7); x.fill(); }
  x.translate(205, 150); x.fillStyle = '#2a1840'; x.fillRect(-18, -24, 36, 52); x.strokeStyle = '#ff4de1'; x.lineWidth = 2; x.strokeRect(-18, -24, 36, 52);
  x.fillStyle = '#07120f'; x.fillRect(-14, -16, 28, 14); x.fillStyle = '#7dff9a'; x.font = "700 11px 'JetBrains Mono',monospace";
  x.font = "700 8px 'JetBrains Mono',monospace"; x.fillText([0, 1, 2, 3, 4].map(i => SLOTS.symbols[Math.floor(t * 3 + i * 1.7) % SLOTS.symbols.length]).join(''), 0, -6);
  x.fillStyle = '#ffd24a'; x.beginPath(); x.arc(24, -8, 3, 0, 7); x.fill(); x.fillRect(23, -8, 2, 18);
  x.restore();
  x.save(); x.fillStyle = '#0b1117'; x.fillRect(408, 128, 64, 44); x.strokeStyle = '#59c7c2'; x.strokeRect(408, 128, 64, 44);
  x.fillStyle = '#59c7c2'; x.font = "700 9px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.fillText('rand()', 440, 142); x.fillStyle = '#ffd24a'; x.font = "700 12px 'JetBrains Mono',monospace";
  x.fillText('0.' + String(Math.floor((Math.sin(Math.floor(t * 8) * 91.7) * .5 + .5) * 9999)).padStart(4, '0'), 440, 162); x.restore();
 }
 if (room.portal) { // layer exit portal
  const q = room.portal; x.save(); x.translate(q.x, q.y);
  for (let i = 0; i < 3; i++) { x.strokeStyle = `rgba(154,245,160,${.8 - i * .22})`; x.lineWidth = 3 - i * .7; x.beginPath(); x.ellipse(0, 0, 20 + i * 5 + Math.sin(t * 3 + i) * 2, 26 + i * 5 + Math.sin(t * 3 + i) * 2, t * (i % 2 ? -1 : 1) * .6, 0, 7); x.stroke(); }
  x.fillStyle = 'rgba(154,245,160,.22)'; x.beginPath(); x.arc(0, 0, 18, 0, 7); x.fill(); x.fillStyle = '#9af5a0'; x.font = "700 10px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.fillText('NEXT LAYER', 0, 44); x.restore();
 }
}
// ---- Map: a MAP button turns the minimap on; clicking the minimap opens a bigger pop-up (the game pauses); clicking again turns the map off ----
function mapLayout(M, mode) {
 const ids = Object.keys(M.rooms), xs = ids.map(i => M.rooms[i].at[0]), ys = ids.map(i => M.rooms[i].at[1]);
 const x0 = Math.min(...xs), y0 = Math.min(...ys), gw = Math.max(...xs) - x0 + 1, gh = Math.max(...ys) - y0 + 1, big = mode === 2;
 const cw = big ? Math.min(60, Math.floor((W - 160) / gw) - 22) : 15, ch = big ? Math.round(cw * .66) : 11, gap = big ? 22 : 4;
 const mw = gw * (cw + gap) - gap, mh = gh * (ch + gap) - gap;
 if (big) { const pw = Math.max(mw + 80, 340), ph = mh + 130, px = (W - pw) / 2, py = (H - ph) / 2; return { x0, y0, cw, ch, gap, big, ox: px + (pw - mw) / 2, oy: py + 58, px, py, pw, ph }; }
 return { x0, y0, cw, ch, gap, big, ox: 16, oy: 124, px: 10, py: 118, pw: mw + 12, ph: mh + 12 }; // moved down: the HUD card grew a Bandwidth row and a wand row
}
function syncMap() {
 const b = $('#mapbtn'), a = $('#maparea'); if (!b || !a || !R?.room) return;
 b.style.display = 'block'; b.classList.toggle('on', !!G.mapMode); b.setAttribute('aria-pressed', G.mapMode ? 'true' : 'false');
 if (G.mapMode === 2) { R.banner = null; R.hint = null; } // keep pop-up text off the big map
 if (!G.mapMode) { a.style.display = 'none'; return; }
 const L = mapLayout(roomMap(), G.mapMode), pc = (v, d) => (v / d * 100).toFixed(2) + '%';
 a.style.display = 'block';
 if (G.mapMode === 2) Object.assign(a.style, { left: '0', top: '0', width: '100%', height: '100%' });
 else Object.assign(a.style, { left: pc(L.px, W), top: pc(L.py, H), width: pc(L.pw, W), height: pc(L.ph, H) });
}
function bindMapUI() {
 const b = $('#mapbtn'), a = $('#maparea'); if (!b || !a) return;
 b.onpointerdown = a.onpointerdown = e => e.stopPropagation();
 b.onclick = e => { e.stopPropagation(); G.mapMode = G.mapMode ? 0 : 1; uiSound('toggle'); syncMap(); };
 a.onclick = e => { e.stopPropagation(); G.mapMode = G.mapMode === 1 ? 2 : 0; uiSound('toggle'); syncMap(); };
 syncMap();
}
function cycleMap() { if (!R?.room) return; G.mapMode = ((G.mapMode || 0) + 1) % 3; uiSound('toggle'); syncMap(); }
const ROOM_WORD = { S: 'ENTRY', C: 'HOSTILE', X: 'EXIT NODE', E: 'ELITE', T: 'CACHE', $: 'SHOP', B: 'BOSS' };
function drawMapPanel(x, M, room, L) {
 const show = new Set();
 for (const id in M.rooms) if (M.state[id].seen) { show.add(id); for (const d in M.rooms[id].doors) show.add(M.rooms[id].doors[d]); }
 const pos = id => { const r = M.rooms[id]; return [L.ox + (r.at[0] - L.x0) * (L.cw + L.gap), L.oy + (r.at[1] - L.y0) * (L.ch + L.gap)]; };
 x.save();
 if (L.big) { x.fillStyle = 'rgba(3,6,12,.8)'; x.fillRect(0, 0, W, H); }
 x.globalAlpha = L.big ? .96 : .62; x.fillStyle = '#05080e'; x.fillRect(L.px, L.py, L.pw, L.ph); x.globalAlpha = 1;
 if (L.big) { x.strokeStyle = WALLS[G.world?.key]?.edge || '#9af5a0'; x.lineWidth = 2; x.strokeRect(L.px, L.py, L.pw, L.ph); x.fillStyle = '#e8eefc'; x.font = "700 14px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(`LAYER MAP // ${G.sector}-${G.layer}${M.procedural ? ' // GENERATED' : ''}`, W / 2, L.py + 26); }
 x.strokeStyle = 'rgba(160,180,200,.6)'; x.lineWidth = L.big ? 4 : 2;
 for (const id of show) { const r = M.rooms[id]; for (const d of ['E', 'S']) if (r.doors[d] && show.has(r.doors[d])) { const [a, b] = pos(id), [e, f] = pos(r.doors[d]); x.beginPath(); x.moveTo(a + L.cw / 2, b + L.ch / 2); x.lineTo(e + L.cw / 2, f + L.ch / 2); x.stroke(); } }
 const types = new Set();
 for (const id of show) {
  const r = M.rooms[id], T = ROOM_TYPES[r.type], [a, b] = pos(id), seen = M.state[id].seen, st = M.state[id]; types.add(r.type);
  x.globalAlpha = seen ? 1 : .55; x.fillStyle = seen ? (st.cleared || T.safe ? '#243142' : '#3a2428') : '#161e29'; x.fillRect(a, b, L.cw, L.ch);
  x.strokeStyle = T.col; x.lineWidth = id === room.id ? (L.big ? 4 : 2.5) : (L.big ? 2 : 1); x.strokeRect(a + .5, b + .5, L.cw - 1, L.ch - 1);
  x.fillStyle = T.col; x.textAlign = 'center'; x.textBaseline = 'middle';
  if (L.big) {
   x.font = "700 " + Math.max(8, Math.min(11, L.cw / 6)) + "px 'JetBrains Mono',monospace"; x.fillText(ROOM_WORD[r.type] || '', a + L.cw / 2, b + L.ch / 2 - 5);
   x.fillStyle = '#9aa7b6'; x.font = "400 9px 'JetBrains Mono',monospace";
   x.fillText(!seen ? 'unexplored' : r.type === 'T' ? (st.looted ? 'empty' : 'unopened') : T.safe ? 'visited' : st.cleared ? 'cleared' : 'hostile', a + L.cw / 2, b + L.ch / 2 + 7);
  } else { x.font = "700 8px 'JetBrains Mono',monospace"; x.fillText(r.type === 'C' ? '' : r.type === 'X' ? '>' : r.type, a + L.cw / 2, b + L.ch / 2 + 1); }
  if (id === room.id) { x.fillStyle = '#fff'; if (L.big) { x.font = "700 9px 'JetBrains Mono',monospace"; x.fillText('YOU ARE HERE', a + L.cw / 2, b + L.ch + 9); } else { x.beginPath(); x.arc(a + L.cw / 2, b + L.ch / 2, 2, 0, 7); x.fill(); } }
  x.globalAlpha = 1;
 }
 if (L.big) { // legend + hint
  let lx = L.px + 24; const ly = L.py + L.ph - 36; x.textAlign = 'left'; x.font = "400 10px 'JetBrains Mono',monospace";
  for (const t of ['S', 'C', 'X', 'E', 'T', '$', 'B']) if (types.has(t)) { x.fillStyle = ROOM_TYPES[t].col; x.fillRect(lx, ly - 4, 8, 8); x.fillStyle = '#c3ccd8'; const w = ROOM_WORD[t]; x.fillText(w, lx + 12, ly); lx += 22 + w.length * 6.2; }
  x.fillStyle = '#7f93b8'; x.textAlign = 'center'; x.fillText('click anywhere to close the map', W / 2, L.py + L.ph - 14);
 }
 x.restore();
}
function drawRoomHud(x) {
 const room = R.room, M = roomMap(), c = R.col;
 x.save(); x.textAlign = 'right'; x.textBaseline = 'middle'; x.font = "700 11px 'JetBrains Mono',monospace";
 x.fillStyle = room.T.col; x.fillText(room.T.n, W - 10, 43);
 x.fillStyle = '#e2b24a'; x.fillText(`CYCLES ${G.cycles}`, W - 10, 57);
 const it = []; if (G.items.restore) it.push(`[Q] ${SHOP.restore.name} x${G.items.restore}`);
 if (it.length) { x.fillStyle = room.cleared ? c.chip : c.mu; x.fillText(it.join('  '), W - 10, 71); }
 x.restore();
 if (G.mapMode) drawMapPanel(x, M, room, mapLayout(M, G.mapMode));
 if (room.near && R.end === 0 && !R.shopOpen && G.mapMode !== 2) { x.save(); x.fillStyle = 'rgba(5,8,14,.8)'; const tw = 160; x.fillRect(W / 2 - tw / 2, H - 46, tw, 20); x.fillStyle = '#e2b24a'; x.font = "700 11px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(room.near.label, W / 2, H - 36); x.restore(); }
 if (R.t < .35) { x.save(); x.globalAlpha = 1 - R.t / .35; x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.restore(); }
}

// ---- Cycle Shop (Undertale-style menu: merchant portrait, typewriter dialogue, BUY / SLOTS / LEAVE) ----
function buildShopStock() {
 const pool = [...Object.keys(SPELLS), ...Object.keys(MODS)].filter(k => defOf(k).r <= SHOP.cardMaxRarity);
 const cards = shuffle(pool).slice(0, SHOP.cardCount).map(k => ({ k, price: SHOP.cardPrice[defOf(k).r] ?? 10, sold: false }));
 if (Math.random() < SHOP.saleChance && cards.length) { const c = cards[ri(cards.length)]; c.price = Math.max(1, Math.round(c.price / 2)); c.sale = true; }
 return { cards, passives: rollShopPassives(), restore: SHOP.restore.stock, rerolls: 0, crates: 0 };
}
function rollShopPassives() { // same eligibility rules as the passive reward choice (not maxed, rarity gated)
 const maxR = legOK() ? 4 : epicOK() ? 3 : 2, avail = Object.keys(UPG).filter(k => hu(k) < UPG[k].m && (UPG[k].r || 0) <= maxR && !SHOP.passiveExclude.includes(k));
 return shuffle(avail).slice(0, SHOP.passiveCount).map(k => ({ k, price: SHOP.passivePrice[UPG[k].r || 0] ?? 12, sold: false }));
}
const SHOP_LINES = {
 hello: ['Sweeping up losing streaks. Welcome to the Cycle Shop.', 'Cycles in, luck out. Browse, spin, just do not touch the broom.', 'Every odd is published and all sales are final. What can I compile for you?'],
 buy: ['Everything here is hot-swappable.', 'Prices are fixed. The sales are rand().'],
 slots: ['The odds are on the board. I do not cheat, I just sweep.', 'One roll per spin. rand() has no memory, and neither do I.'],
 poor: ['Insufficient Cycles. Try winning some.', 'Error 402: payment required.'],
 thanks: ['Transaction committed.', 'Pleasure doing business. Keep the change. There is none.'],
 bye: ['Come back when your cache is full.', 'Segfault you later.']
};
const sline = k => pick(SHOP_LINES[k]);
function openShop(mode = 'main') {
 if (R.shopOpen) return;
 R.shopOpen = 1; keys = {}; joy = null; dashReq = false; mouseFire = 0; mobileFire = 0; mobileContinuous = 0;
 G.shop = { mode: mode === 'slots' ? 'slots' : 'buy', busy: false, spin: null, bet: SLOTS.bets[0], say: '', typed: 0, msg: '' };
 const ov = document.createElement('div'); ov.id = 'shopov'; $('#app').appendChild(ov);
 ov.addEventListener('click', shopClick);
 shopSay(mode === 'slots' ? sline('slots') : sline('hello'));
 shopRender();
 const tick = () => { if (!R || !R.shopOpen) return; const cv = $('#sh-port'); if (cv) { const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); drawMerchant(g, 72, 122, 2, performance.now() / 1000); } requestAnimationFrame(tick); }; // the menu is re-rendered on every click, so look the canvas up each frame
 requestAnimationFrame(tick);
}
function closeShop() {
 if (!R || !R.shopOpen) return;
 finalizeSpin(); // never lose (or double-pay) a spin that is still rolling
 clearInterval(G.shop?.typer); R.shopOpen = 0; $('#shopov')?.remove(); G.shop = null; uiSound('back');
 R.hint = { t: 1.6, s: 'Cycles: ' + G.cycles };
}
function shopSay(text) {
 const S = G.shop; clearInterval(S.typer); S.say = text; S.typed = 0;
 S.typer = setInterval(() => { // typewriter with a blip every few characters
  S.typed++; const el = $('#sh-dlg'); if (el) el.textContent = S.say.slice(0, S.typed) + (S.typed < S.say.length ? '_' : '');
  if (S.typed % 3 === 1) uiSound('tick');
  if (S.typed >= S.say.length) clearInterval(S.typer);
 }, 26);
}
function shopRender() {
 const ov = $('#shopov'), S = G.shop, st = R.room.shop; if (!ov) return;
 const tile = (data, col, tag, name, desc, foot, dis) => `<button class="card u" data-sh="${data}" ${dis ? 'disabled' : ''} style="border-top-color:${col}"><em style="color:${col}">${tag}</em><b>${name}</b><small>${desc}</small><span class="sh-pr">${foot}</span></button>`;
 const slot = (html, c) => `<div class="sh-slot">${html}<div class="sh-tag ${c.sold ? 'sold' : ''}">${c.sold ? 'SOLD' : c.price + ' CY'}${c.sale && !c.sold ? `<em>sale! rand() &lt; ${SHOP.saleChance}</em>` : ''}</div></div>`;
 let body = '';
 if (S.mode === 'buy') {
  const cards = st.cards.map((c, i) => slot(cardH(c.k, `data-sh="card:${i}" ${c.sold ? 'disabled' : ''}`, false, 1, '', G), c)).join('');
  const pas = st.passives.map((c, i) => slot(cardH(c.k, `data-sh="pas:${i}" ${c.sold || hu(c.k) >= UPG[c.k].m ? 'disabled' : ''}`, true, 1, '', G), c)).join('');
  const odds = SHOP.crate.odds.map(([p, r]) => `rand() &lt; ${p} &rarr; ${RAR[r]}`).join(' | ');
  body = `<div class="sh-sec">Cards</div><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${cards}</div>
   <div class="sh-sec">Passives</div><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${pas || '<small class="sh-note">Nothing left to upgrade.</small>'}</div>
   <div class="sh-sec">Supplies</div><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
   ${tile('restore', RC[1], 'HP RECOVERY', SHOP.restore.name, `${SHOP.restore.d} (${st.restore} left)`, st.restore <= 0 ? 'SOLD OUT' : SHOP.restore.price + ' CY', st.restore <= 0)}
   ${tile('crate', RC[3], 'RNG', SHOP.crate.name, `${SHOP.crate.d} ${odds}`, SHOP.crate.price + ' CY', false)}
   ${tile('reroll', RC[2], 'RNG', 'REROLL_STOCK()', `New cards and passives (${SHOP.maxRerolls - st.rerolls} left). Supplies stay the same.`, SHOP.rerollPrice + ' CY', st.rerolls >= SHOP.maxRerolls)}</div>`;
 } else {
  const sp = S.spin, reels = sp ? sp.shown : Array(SLOTS.reels).fill('?'), done = sp && sp.paid;
  const rows = slotHandTable().map(h => `<tr class="${done && sp.res.id === h.id ? 'hit' : ''}"><td>${h.n}</td><td>${(h.p * 100).toFixed(2)}%</td><td>${h.mult ? 'x' + h.mult : '-'}</td></tr>`).join('');
  body = `<div class="sh-slots"><div class="sh-reels">${reels.map(r => `<span>${r}</span>`).join('')}</div>
   <div class="sh-hand">${done ? `${sp.res.n}${sp.res.payout ? ' // +' + sp.res.payout + ' CY' : ' // no payout'}` : S.busy ? '...' : 'Five reels, scored like poker. Pick a bet.'}</div>
   <div class="sh-bets">${SLOTS.bets.map(b => `<button class="btn sm ${S.bet === b ? '' : 'g'}" data-sh="bet:${b}" ${S.busy ? 'disabled' : ''}>bet ${b}</button>`).join('')}<button class="btn sm" style="background:var(--mult)" data-sh="spin" ${S.busy || G.cycles < S.bet ? 'disabled' : ''}>${S.busy ? 'spinning...' : 'spin()'}</button></div>
   <table class="sh-odds"><tr><th>hand</th><th>chance</th><th>pays</th></tr>${rows}</table>
   <p class="sh-note">Each reel: symbols[floor(rand() * ${SLOTS.symbols.length})], ${SLOTS.reels} times. Chances are exact. Expected return ${(slotRTP() * 100).toFixed(1)}% of every bet, paid when the reels stop.</p></div>`;
 }
 ov.innerHTML = `<div class="sh-box"><div class="sh-head"><canvas id="sh-port" width="128" height="128"></canvas><div class="sh-talk"><div class="sh-name">MERCHANT.exe <span>// cycle shop</span></div><div id="sh-dlg">${S.say.slice(0, S.typed)}</div>
  <div class="sh-bar"><span class="sh-pill">CYCLES <b id="sh-cy">${G.cycles}</b></span><span class="sh-pill">${SHOP.restore.name} x${G.items.restore}</span></div></div></div>
  ${body}<div class="sh-menu"><button class="btn ${S.mode === 'buy' ? '' : 'g'}" data-sh="go:buy" ${S.busy ? 'disabled' : ''}>buy()</button><button class="btn ${S.mode === 'slots' ? '' : 'g'}" data-sh="go:slots" ${S.busy ? 'disabled' : ''}>slots()</button><button class="btn g" data-sh="leave" ${S.busy ? 'disabled' : ''}>leave()</button></div></div>`;
}
function finalizeSpin() { // idempotent: the timer and closeShop() can both call it, and the payout is only ever applied once
 const S = G.shop; if (!S || !S.spin || S.spin.paid) return;
 const sp = S.spin; sp.paid = true; clearInterval(sp.timer); sp.shown = sp.res.sym; S.busy = false;
 if (WAND_ACQ.slots.includes(sp.res.id)) { const w = wandOffer(); if (w && acquireWand(w)) S.wandWon = w; } // House Edge: a big hand also drops a wand; the Cycle payout is unchanged
 if (sp.res.payout > 0) { G.cycles += sp.res.payout; sfx('pickup'); S.say = sp.res.id === 'five' ? 'Five of a kind. The house is... fine. +' + sp.res.payout + ' Cycles.' : sp.res.n + '! +' + sp.res.payout + ' Cycles.'; }
 else { S.say = (sp.res.id === 'pair' ? 'Just a pair. ' : 'No match. ') + 'The broom sweeps up your ' + sp.res.bet + ' CY.'; }
 if (S.wandWon) { S.say += ` The house slides over a ${wandName(S.wandWon)}. Equip it on the pipeline screen.`; txt(R.p.x, R.p.y - 26, 'WAND ACQUIRED', wandOf(S.wandWon).col, 12); S.wandWon = null; }
 if (R.shopOpen) { shopSay(S.say); shopRender(); }
}
function shopClick(e) {
 const b = e.target.closest('[data-sh]'); if (!b || b.disabled) return; e.stopPropagation();
 const S = G.shop, st = R.room.shop, [k, arg] = b.dataset.sh.split(':');
 if (S.busy) return;
 if (k === 'leave') { closeShop(); return; }
 if (k === 'go') { S.mode = arg; shopSay(sline(arg === 'buy' ? 'buy' : 'slots')); uiSound('select'); shopRender(); return; }
 if (k === 'bet') { S.bet = +arg; uiSound('select'); shopRender(); return; }
 if (k === 'spin') {
  if (G.cycles < S.bet) { shopSay(sline('poor')); uiSound('deny'); return; }
  G.cycles -= S.bet; // the wager leaves the balance before the roll, and the roll is made exactly once
  const res = spinSlots(S.bet);
  S.busy = true; S.spin = { res, shown: Array(SLOTS.reels).fill('-'), paid: false, t0: performance.now() };
  S.spin.timer = setInterval(() => { // reels land one after another
   const el = performance.now() - S.spin.t0; S.spin.shown = res.sym.map((s, i) => el > 450 + i * 260 ? s : SLOTS.symbols[ri(SLOTS.symbols.length)]);
   const r = $('#shopov')?.querySelectorAll('.sh-reels span'); if (r) S.spin.shown.forEach((s, i) => { r[i].textContent = s; });
   if (el > 450 + (SLOTS.reels - 1) * 260 + 150) finalizeSpin();
  }, 70);
  uiSound('select'); shopRender(); return;
 }
 let cost = 0, ok = false;
 if (k === 'card') { const c = st.cards[+arg]; if (!c || c.sold) return; cost = c.price; if (G.cycles >= cost) { G.cycles -= cost; c.sold = true; const nc = mk(c.k); G.deck.push(nc); G.disc.push(nc); calcST(); ok = true; } }
 else if (k === 'pas') { const c = st.passives[+arg]; if (!c || c.sold || hu(c.k) >= UPG[c.k].m) return; cost = c.price; if (G.cycles >= cost) { G.cycles -= cost; c.sold = true; G.u[c.k] = hu(c.k) + 1; calcST(); ok = true; } }
 else if (k === 'restore') { cost = SHOP.restore.price; if (st.restore <= 0) return; if (G.cycles >= cost) { G.cycles -= cost; st.restore--; G.items.restore++; ok = true; } }
 else if (k === 'crate') {
  cost = SHOP.crate.price;
  if (G.cycles >= cost) {
   G.cycles -= cost; let r = SHOP.crate.odds[SHOP.crate.odds.length - 1][1], roll = Math.random(), acc = 0;
   for (const [p, rr] of SHOP.crate.odds) { acc += p; if (roll < acc) { r = rr; break; } }
   let pool = []; for (let q = r; q >= 0 && !pool.length; q--) pool = [...Object.keys(SPELLS), ...Object.keys(MODS)].filter(kk => defOf(kk).r === q);
   const nc = mk(pick(pool)); G.deck.push(nc); G.disc.push(nc); calcST(); ok = true; shopSay(`THE CRATE HISSES. ${defOf(nc.k).n} (${RAR[defOf(nc.k).r]}) ADDED TO YOUR DECK.`); uiSound('reward'); shopRender(); return;
  }
 }
 else if (k === 'reroll') { cost = SHOP.rerollPrice; if (st.rerolls >= SHOP.maxRerolls) return; if (G.cycles >= cost) { G.cycles -= cost; st.rerolls++; const fresh = buildShopStock(); st.cards = fresh.cards; st.passives = fresh.passives; ok = true; } }
 if (!ok) { shopSay(sline('poor')); uiSound('deny'); return; }
 shopSay(sline('thanks')); uiSound('reward'); shopRender();
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
 const b = BOSSES[G.cfg.boss], bh = b.fixed ? b.hp : Math.round(b.hp * (1 + .035 * (G.cfg.i - 1)) * (G.dm || 1)); // fixed: prototype HP is used exactly (Memory Leak 6000, Race Condition 3200)
 const bs0 = ARENAS[G.cfg.arena].bs || [320, 70];
 const e = spawnE('chaser', bs0[0], bs0[1]);
 Object.assign(e, { boss: 1, g: b.g, c: b.c, hp: bh, max: bh, sp: b.sp, r: b.r, dmg: 14, ph: 0, pt: {}, beh: 'boss', bd0: b, gt: 0, projShape: G.cfg.boss });
 if (G.cfg.boss === 'segfault' && R.bossIntro) {
  e.x = SEGFAULT.intro.bay[0];
  e.y = SEGFAULT.intro.bay[1];
  e.faceAng = Math.PI;
 }
 if (b.race) {
  Object.assign(e, { race: 1, twin: 'merged', max0: bh, inv: 0, rp: { red: rProc('red'), blue: rProc('blue') } });
  R.race = { lastRes: -9, split: 0, red: null, blue: null, cb: null, stk: [], still: 0 };
 }
 if (G.cfg.boss === 'segfault') {
  R.seg = {
   boss: e,
   plates: ['front', 'left', 'right'].map(side => ({ side, hp: SEGFAULT.plates.hp, max: SEGFAULT.plates.hp, dead: 0 })), // no back plate: the fuel tanks sit there
   tanks: [0, 1].map(() => ({ hp: SEGFAULT.fuel.tankHp, max: SEGFAULT.fuel.tankHp, fuel: 1, broken: 0, fix: 0, hit: 0 })), flames: [], flameCd: 4,
   homingCd: 7.2, barrageCd: 17, stdoutCd: 11.8, dashCd: 14, stackCd: 18, deadZoneCd: 20,
   overload: { state: 'off', hp: 0, charge: 0, t: 0, delay: 0, shots: [] }, relayPattern: 0,
   walls: SEGFAULT.walls.map(w => ({ ...w, max: w.type === 'holo' ? 20 : 70, hp: w.type === 'holo' ? 20 : 70, regenAt: 0, heat: 0 })),
   telegraphs: [], trails: [], overheated: [], zones: [], lasers: [], protocol: null, warned: 0,
   relays: (ARENAS[G.cfg.arena].nodes || []).map(([x, y], i) => ({ i, x, y, state: 'idle', cd: 5.5 + i * 1.15, t: 0, shots: 0, gap: 0, aim: 0 }))
  };
  setDynamicWalls(G.cfg.arena, R.seg.walls.filter(w => w.hp > 0).map(w => [w.x, w.y, w.w, w.h]));
 }
 if (b.army) leakInit(e);
 if (!b.army && G.cfg.boss !== 'segfault') {
  R.banner = { t: 2.4, s: 'WARNING: ' + b.n };
  sfx('boss_warning');
 }
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

function shMax() { return ST.shmax + (R?.p?.shx || 0); } // shield() raises this for the fight; it never refills
function gainSh(v) { R.p.sh = Math.min(shMax(), R.p.sh + v); }
// Energy barrier: one-hit outline shield. Skills can call this to bring it back instantly.
const hasBarrier = () => G.host === 'debugger'; // the energy barrier is the Debugger's own mechanic (its passive shield regen is nerfed to pay for it)
function restoreBarrier() {
 if (!hasBarrier()) return;
 const b = G.bar ||= { ready: 1, t: 0 };
 const was = b.ready; b.ready = 1; b.t = 0;
 if (!was && R?.p) { ring(R.p.x, R.p.y, 34, '#7ee8ff', .4); burst(R.p.x, R.p.y, '#bff6ff', 10, 120); sfx('heal'); }
}
function healP(v) { G.hp = Math.min(G.max, G.hp + v); txt(R.p.x, R.p.y - 14, '+' + Math.round(v), '#7ddc6f'); sfx('heal'); }

function hurt(d, src) {
 const p = R.p;
 if (p.inv > 0 || R.end || (R.sandbox && R.invincible)) return 0;
 const bar = hasBarrier() ? (G.bar ||= { ready: 1, t: 0 }) : null;
 if (bar?.ready && d > 0) { // the energy outline takes this hit, shatters, and regenerates slowly
  bar.ready = 0; bar.t = PLAYER_SHIELD.barrierRegen; p.inv = .7; R.shake = Math.max(R.shake, 6);
  ring(p.x, p.y, 34, '#7ee8ff', .4); burst(p.x, p.y, '#bff6ff', 14, 170); txt(p.x, p.y - 18, 'BARRIER BROKEN', '#7ee8ff', 10); sfx('shield_break');
  return 0;
 }
 R.damageTaken += Math.max(0, d);
 p.nod = 0; let m = d;
 let absorbed = 0;
 if (p.sh > 0) {
  absorbed = Math.min(p.sh, m);
  p.sh -= absorbed; m -= absorbed;
  if (p.sh <= 0) {
   sfx('shield_break');
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
  sfx('player_hurt');
  burst(p.x, p.y, '#ff5c7a', 10);
  txt(p.x, p.y - 12, '-' + Math.round(m), '#ff5c7a', 13);
 } else {
  p.inv = .22;
  R.shake = Math.max(R.shake, 3);
  sfx('shield_hit');
 }
 if (src) {
  const dx = p.x - src.x, dy = p.y - src.y, l = Math.hypot(dx, dy) || 1;
  p.vx += dx / l * 180; p.vy += dy / l * 180;
 }
 if (G.hp <= 0) endRun(false);
 return 1;
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
 if (SET.aim === 0 || R.mobileAim != null) p.ang = aimAngle();

 p.inv -= dt; p.dcd -= dt; p.nod += dt;
 const slow = hazAt(arena, p.x, p.y) === 'slow';
 if (dashReq && p.dcd <= 0 && p.dash <= 0) {
  p.dash = .16; p.dcd = 1.5 * ST.dashcd; p.inv = Math.max(p.inv, ST.nullref ? .55 : .28);
  p.vx = p.fx * 480; p.vy = p.fy * 480;
  sfx('dash');
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
 const oldX = p.x, oldY = p.y;
 mv(arena, p, p.vx * dt, p.vy * dt, 9);
 if (R.seg?.lasers.length && p.dash <= 0) for (const laser of R.seg.lasers) { // relay lasers are not walls: you can walk through them, but it hurts; a dash passes clean
  if (laser.hitCd <= 0 && segLineDistance(p.x, p.y, laser.x1, laser.y1, laser.x2, laser.y2) < 8) { laser.hitCd = .7; hurt(laser.damage, { x: (laser.x1 + laser.x2) / 2, y: (laser.y1 + laser.y2) / 2 }); }
 }
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
 { // every Host regenerates shield slowly after a quiet spell; Debugger is nerfed but still faster; combat mode OFF is a bit quicker
  const SH = PLAYER_SHIELD;
  const slow = p.shSlow > 0; if (slow) p.shSlow -= dt; // NULL REFERENCE debuff: shield regen crawls
  if (p.nod > (ST.regen ? SH.debuggerDelay : SH.delay) + (slow ? 2 : 0) && p.sh < shMax()) gainSh((ST.regen || SH.regen) * (R.combatMode ? 1 : SH.idleMul) * (slow ? .2 : 1) * dt);
  const b = hasBarrier() ? (G.bar ||= { ready: 1, t: 0 }) : null;
  if (b && !b.ready && (b.t -= dt * (R.combatMode ? 1 : SH.idleMul)) <= 0) restoreBarrier();
 }
 if (hazAt(arena, p.x, p.y) === 'lava' && p.dash <= 0 && !(R.sandbox && R.invincible)) {
  const ld = 9 * dt;
  if (p.sh > 0) {
   p.sh = Math.max(0, p.sh - ld);
  } else {
   G.hp -= ld; R.shake = Math.max(R.shake, 2);
   if (G.hp <= 0) endRun(false);
  }
 }
}

// ---- Bandwidth (BW): lives on G so it persists across rooms (R is rebuilt per room). BWR (regen) is internal and never shown. ----
function initBW(full) {
 G.bwMax = bwMaxFor(G.host, ST);
 G.bw = full ? G.bwMax : clampBW(G.bw, G.bwMax);
 G.bwTrail = G.bw;
}
function updBW(dt) {
 if (!(G.bwMax > 0)) initBW(true);
 const before = G.bw;
 G.bw = clampBW(G.bw + bwRegen(ST) * dt, G.bwMax); // regeneration can never exceed the maximum
 G.bwTrail = G.bwTrail > G.bw ? Math.max(G.bw, G.bwTrail - G.bwMax * 1.2 * dt) : G.bw; // lagging bar shows what was just spent
 G.bwRegenOn = G.bw > before + 1e-6 && G.bw < G.bwMax ? 1 : 0;
 if (R && R.bwFlash > 0) R.bwFlash -= dt;
}
function equipWand(id) {
 if (!WANDS[id] || !(G.wands || []).includes(id) || G.wand === id) return false;
 G.wand = id; calcST(); return true;
}
// ---- Wand collection (G.wands) and Storage (G.binWands) are separate lists; a wand is only ever in one of them. ----
const wandName = id => wandOf(id).n;
function wandOffer() { const a = wandsOffered(G.wands, G.binWands); return a.length ? pick(a) : null; } // never offers a wand that is owned or in Storage
function acquireWand(id) {
 if (!WANDS[id] || id === 'universal' || G.wands.includes(id) || (G.binWands || []).includes(id)) return false; // no duplicates, ever
 G.wands.push(id); return true; // acquiring never changes the equipped wand
}
function storeWand(id) {
 if (!canStoreWand(id, G.wand, G.wands)) return false; // Universal and the equipped wand can never be stored: a valid equipped wand always exists
 G.wands.splice(G.wands.indexOf(id), 1); (G.binWands ||= []).push(id); G.binWandConfirm = 0; return true;
}
function restoreWand(id) {
 const i = (G.binWands || []).indexOf(id); if (i < 0 || G.wands.includes(id)) return false;
 G.binWands.splice(i, 1); G.wands.push(id); return true; // back in the collection, NOT auto-equipped
}
// Pipeline cards the equipped wand cannot fire (shown to the player; they never fire silently as something else).
const blockedCards = () => compilePipeline(G.slots, ST).out.filter(cc => stats(cc, ST).blocked);
const wandCardH = (id, attr, extra = '') => { const w = wandOf(id); return `<button class="card u" ${attr} style="border-top-color:${w.col}"><em style="color:${w.col}">WAND</em><div style="height:40px;text-align:center;padding-top:4px">${wandIconHTML(id, 3, -35)}</div><b>${w.n}</b><small>${w.d}</small>${extra}</button>`; };
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
function syncCombatUI() {
 const combatButton = document.getElementById('combat-toggle');
 if (combatButton && R) {
  combatButton.textContent = R.combatMode ? 'COMBAT ON' : 'COMBAT OFF';
  combatButton.setAttribute('aria-pressed', R.combatMode ? 'true' : 'false');
 }
 const continuousButton = document.getElementById('continuous-fire');
 if (continuousButton) {
  continuousButton.textContent = mobileContinuous ? 'AUTO ON' : 'AUTO OFF';
  continuousButton.setAttribute('aria-pressed', mobileContinuous ? 'true' : 'false');
 }
}
function setCombatMode(enabled) {
 if (!R) return;
 R.combatMode = enabled ? 1 : 0;
 if (!R.combatMode) {
  if (keys.x) fireBlockedX = 1;
  keys.x = 0; mouseFire = 0; mobileFire = 0; mobileContinuous = 0;
  for (const c of R.casts) c.pend = 0;
 }
 syncCombatUI();
}
function aimAngle() {
 const p = R.p;
 if (R.mobileAim != null) return R.mobileAim;
 if (SET.aim === 0) return Math.atan2(mouseY - p.y, mouseX - p.x);
 return p.ang ?? Math.atan2(p.fy || -1, p.fx || 0);
}
function aimTarget(maxRange = 1000) {
 const p = R.p, angle = aimAngle(), ca = Math.cos(angle), sa = Math.sin(angle);
 let target = null, nearest = maxRange;
 for (const e of R.en) {
  if (e.dead) continue;
  const dx = e.x - p.x, dy = e.y - p.y;
  const along = dx * ca + dy * sa;
  const across = Math.abs(-dx * sa + dy * ca);
  if (along >= 0 && along <= maxRange && across <= e.r + 12 && along < nearest) {
   nearest = along;
   target = e;
  }
 }
 return target;
}
function fire(c) {
 let a = stats(c.c, ST);
 a._cardId = c.id;
 a._cardLabel = c.label;
 if (Math.random() < ST.chaos) a = stats({ sp: c.c.sp, mods: [...c.c.mods, pick(CHAOS)], mv: c.c.mv, lv: c.c.lv }, ST);
 a._spell = c.c.sp;
 if (ST.leak) a.dmg *= Math.min(2.5, 1 + .025 * R.t);
 const p = R.p;
 sfx('cast_' + a.k, { x: p.x });
 if (a.sh) gainSh(a.sh);

 if (a.k === 'proj') {
  const a0 = aimAngle();
  for (let i = 0; i < a.pc; i++) {
   const an = a0 + (a.pc > 1 ? (i - (a.pc - 1) / 2) * .3 : 0);
   R.pr.push({ x: p.x, y: p.y, vx: Math.cos(an) * a.sp, vy: Math.sin(an) * a.sp, a, shape: c.c.sp, life: 2.2, hit: new Set(), pierce: a.pierce, bounce: a.bounce, r: Math.min(a.rad * a.size, 16) });
  }
 } else if (a.k === 'nova') {
  const nr = a.rad * a.area;
  R.fx.push({ nova: 1, x: p.x, y: p.y, r: 0, max: nr, l: .34, d: .34, c: a.col });
  blast(p.x, p.y, nr, a.dmg, a, null, 0, 1);
 } else if (a.k === 'chain') {
  let t = aimTarget(a.rad * a.area), from = { x: p.x, y: p.y }, seen = new Set(), j = a.jumps + 1;
  while (t && j-- > 0) {
   seen.add(t);
   R.lines.push({ x1: from.x, y1: from.y, x2: t.x, y2: t.y, l: .18, c: a.col, lightning: 1, seed: Math.random(), w: 2.6 });
   const hopScale = Math.pow(.72, seen.size - 1) * (t.boss ? .75 : 1);
   hitE(t, a.dmg, a, from, undefined, hopScale);
   from = { x: t.x, y: t.y };
   let b = null, bd = 120;
   for (const e of R.en) if (!e.dead && !seen.has(e)) {
    const d = Math.hypot(e.x - from.x, e.y - from.y);
    if (d < bd) { bd = d; b = e; }
   }
   t = b;
  }
 } else if (a.k === 'cone' && a.wandFx === 'cryo') {
  cryoStream(a, c);
 } else if (a.k === 'cone') {
  const tier = a.lv >= 3 ? 2 : a.lv === 2 ? 1 : 0, pal = STDOUT_PAL[tier];
  const mapStep = a.pc > 1 ? (a.pc - 1) / 2 : 0;
  // map(): extra spread makes the cone LONGER (+20% per step) instead of much wider (+.06 rad per step).
  const a0 = aimAngle(), rg = 125 * a.area * (1 + .2 * mapStep), hw = .5 + a.size * .05 + .06 * mapStep;
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
  const a0 = aimAngle();
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
    if (R.seg) segDamageWall(segWallAt(hx, hy, 2), a.dmg);
    burst(hx, hy, a.col, 9, 125);
    burst(hx, hy, '#d9f5ff', 4, 75);
   }
   for (const e of tg) {
    R.fx.push({ star: 1, small: 1, x: e.x, y: e.y, r: 0, max: 8 + a.size * 1.5, l: .2, d: .2, c: a.col, seed: Math.random() * 6 });
    hitE(e, a.dmg, a, p);
   }
  }
 } else if (a.k === 'melee') {
  const a0 = aimAngle(), rg = 66 * a.area;
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
  // the sweep also intercepts enemy projectiles that are inside it
  const arc = 1.2 + (a.pc > 1 ? .5 * (a.pc - 1) / 2 : 0);
  for (const b of R.eb) {
   if (b.l <= 0 || b.nb || Math.hypot(b.x - p.x, b.y - p.y) > rg + 8) continue;
   let df = Math.atan2(b.y - p.y, b.x - p.x) - a0; df = Math.atan2(Math.sin(df), Math.cos(df));
   if (Math.abs(df) < arc) { b.l = 0; for (let k = 0; k < 3; k++) part(b.x, b.y, (Math.random() - .5) * 140, (Math.random() - .5) * 140, .25, a.col, 2); sfx('orbit_block', { x: b.x }); }
  }
 } else if (a.k === 'orbit') {
  const nb = 2 * a.rep + (a.pc > 1 ? 2 : 0) + Math.max(0, (a.lv || 1) - 1);
  // NERF: one activation = one set of blades. Repeat casts (for/async/fork) can no longer rebuild a damaged ring mid-activation.
  if (p.orb && p.orb.t > 0) return false;
  sfx('cast_orbit', { x: p.x });
  p.orb = { t: Math.max(4.6, 1 / a.rate + .4), n: nb, a: { ...a, knock: Math.max(a.knock || 0, 150) }, ang: 0, zt: .5, bl: Array.from({ length: nb }, () => ({ c: 3, dead: 0 })) };
 } else if (a.k === 'mine') {
  if (R.tg.filter(t => t.mine && t.own === 'p').length >= 6) return false; // rejected: no BW charged
  R.tg.push({ mine: 1, x: p.x, y: p.y, r: a.rad * a.area, t: .9, max: .9, dmg: a.dmg, own: 'p', c: a.col, a });
 } else if (a.k === 'self') {
  if (a.shv) { p.shx = Math.min((p.shx || 0) + a.shv * ST.shm * a.area, PLAYER_SHIELD.maxBonus); ring(p.x, p.y, 24, '#5ee0d0', .3); txt(p.x, p.y - 16, '+MAX SHIELD', '#5ee0d0', 10); }
  if (a.hpv) healP(a.hpv * ST.hm * a.area);
 }
}

// ---- Cryomancer Wand: stdout() becomes a Cryogenic Stream (real damage + freeze + slowing floor ice). Reuses hitE / freeze / wallHit. ----
function cryoStream(a, c) {
 const p = R.p, a0 = aimAngle(), mapStep = a.pc > 1 ? (a.pc - 1) / 2 : 0, F = CRYO.frost;
 const maxL = a.cryoLen * a.area * (1 + .2 * mapStep), half = a.cryoHalf + .03 * mapStep;
 let L = 0; const ca = Math.cos(a0), sa = Math.sin(a0);
 while (L < maxL && !wallHit(G.cfg.arena, p.x + ca * (L + 6), p.y + sa * (L + 6), 2)) L += 6; // the stream stops at walls
 R.fx.push({ x: p.x, y: p.y, r: 0, max: L, l: .22, d: .22, c: a.col, cryo: 1, a: a0, h: half, seed: Math.random() * 9 });
 for (const e of R.en) {
  if (e.dead) continue;
  const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy);
  if (dist > L + e.r) continue;
  let df = Math.atan2(dy, dx) - a0; df = Math.atan2(Math.sin(df), Math.cos(df));
  if (Math.abs(df) < half + Math.atan2(e.r, Math.max(dist, 1))) hitE(e, a.dmg, a, p);
 }
 // floor ice along the stream (capped so a held stream stays cheap)
 R.frost ||= [];
 for (let d = 26; d <= L; d += F.spacing) {
  const fx = p.x + ca * d, fy = p.y + sa * d;
  const ex = R.frost.find(q => Math.hypot(q.x - fx, q.y - fy) < F.r * .7);
  if (ex) { ex.l = Math.max(ex.l, F.life * .85); continue; }
  if (R.frost.length < F.max) R.frost.push({ x: fx, y: fy, r: F.r * (.8 + Math.random() * .5), l: F.life, m: F.life, seed: Math.random() * 9 });
 }
 for (let i = [2, 4, 7][SET.q]; i-- > 0;) { const d = Math.random() * L, w = (Math.random() - .5) * half * 1.6; part(p.x + Math.cos(a0 + w) * d, p.y + Math.sin(a0 + w) * d, Math.cos(a0) * 40, Math.sin(a0) * 40 - 20, .4, Math.random() < .5 ? '#7ee8ff' : '#e6fbff', 2 + Math.random() * 2, 1); }
}
function updFrost(dt) {
 if (!R.frost || !R.frost.length) return;
 const F = CRYO.frost;
 for (const q of R.frost) q.l -= dt;
 R.frost = R.frost.filter(q => q.l > 0);
 for (const e of R.en) {
  if (e.dead) continue;
  for (const q of R.frost) if (Math.hypot(e.x - q.x, e.y - q.y) < q.r + e.r * .5) { e.slow = Math.max(e.slow || 0, .3); e.sf = Math.min(e.sf || 1, F.slow); break; }
 }
}
function updCasts(dt) {
 const p = R.p, tm = Math.max(.3, p.mov ? 1 + ST.mv : 1 - ST.still);
 R.attackHeld = !!(R.combatMode && (keys.x || mouseFire || mobileFire || mobileContinuous));
 for (const c of R.casts) {
  if (!R.attackHeld) { c.pend = 0; continue; }
  if (c.blk === undefined) c.blk = !!stats(c.c, ST).blocked; // wand cannot fire this card: it never fires (and never as a different attack)
  if (c.blk) { c.pend = 0; continue; }
  if (c.dis > 0) { c.dis -= dt; continue; }
  if (c.pend > 0) {
   c.bt -= dt;
   if (c.bt <= 0) { fire(c); c.pend--; c.bt = .12; }
  }
  c.t -= dt * tm;
  if (c.t <= 0) {
   const a = stats(c.c, ST);
   const cost = bwCost(a, ST);
   if (canCast(a) && cost > G.bw + 1e-9) { R.bwFlash = .5; c.t = 0; } // insufficient BW: nothing fires, nothing is charged
   else if (canCast(a)) {
    if (fire(c) === false) { c.t = 0; continue; } // rejected inside fire(): no cooldown, no charge
    if (cost > 0) { G.bw = clampBW(G.bw - cost, G.bwMax); R.bwUsed = (R.bwUsed || 0) + cost; } // BW is only paid when the cast actually executed
    c.n++;
    R.castsExecuted++;
    c.pend = a.rep - 1 + (ST.over && c.n % 3 === 0 ? 1 : 0) + (ST.recur && c.n % 5 === 0 ? 1 : 0) + (ST.fork && Math.random() < .15 ? a.rep : 0);
    c.bt = .12; c.rate = a.rate; c.t = c.period = 1 / a.rate;
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
    if (bl.dead) continue; // destroyed blades stay gone for the rest of this activation (no timer, no hidden replacement)
    const an = o.ang + i * 6.283 / o.n, bx = p.x + Math.cos(an) * 48, by = p.y + Math.sin(an) * 48;
    for (const e of R.en) if (!e.dead && (e.oc || 0) <= 0 && Math.hypot(e.x - bx, e.y - by) < e.r + 7) {
     e.oc = .4; hitE(e, o.a.dmg, o.a, { x: bx, y: by });
    }
    for (const b of R.eb) if (b.l > 0 && !b.nb && Math.hypot(b.x - bx, b.y - by) < 11) {
     b.l = 0; for (let k = 0; k < 3; k++) part(bx, by, (Math.random() - .5) * 120, (Math.random() - .5) * 120, .25, o.a.col, 2);
     sfx('orbit_block', { x: bx });
     if (--bl.c <= 0) { bl.dead = 1; burst(bx, by, o.a.col, 8, 120); }
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
  tb.l = 0; sfx('orbit_zap', { x: p.x });
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
 if (a.k === 'self') return a.shv ? (p.shx || 0) < PLAYER_SHIELD.maxBonus - 1 : a.hpv ? G.hp < G.max - 1 : true;
 // attacks no longer wait for an enemy: nova, stdout (cone), melee and the rest all fire whenever the Host holds attack (melee and nova also clear enemy projectiles that are close)
 if (a.k === 'orbit') return !p.orb;
 return true;
}

function blast(x, y, r, d, a, skip, np, self) {
 ring(x, y, r, a.col || '#ff7a45', .4, 1);
 R.shake = Math.max(R.shake, r > 80 ? 6 : 3);
 sfx('boom', { x });
 burst(x, y, a.col || '#ff7a45', 12, 160);
 for (const e of R.en) if (!e.dead && e !== skip && Math.hypot(e.x - x, e.y - y) < r + e.r) hitE(e, d, a, { x, y }, np);
 if (self) R.eb = R.eb.filter(b => Math.hypot(b.x - x, b.y - y) > r);
}
function pullTo(x, y, r, force = 160) {
 for (const e of R.en) if (!e.dead && !e.boss) {
  const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy);
  if (d < r && d > 4) { e.kx += dx / d * force; e.ky += dy / d * force; }
 }
}
const segFuel = S => S.tanks.reduce((a, t) => a + (t.broken ? 0 : t.fuel), 0) / S.tanks.length;
const segBurn = (S, v) => { for (const t of S.tanks) if (!t.broken) t.fuel = Math.max(0, t.fuel - v); };
function segTankHit(e, damage) {
 const S = R.seg, F = SEGFAULT.fuel, live = S.tanks.filter(t => !t.broken);
 if (!live.length) return;
 const t = live[Math.random() * live.length | 0], bx = e.x - Math.cos(e.faceAng || 0) * e.r, by = e.y - Math.sin(e.faceAng || 0) * e.r;
 t.hp -= damage * .6; t.hit = .18; burst(bx, by, '#ffb36b', 3, 80);
 if (t.hp > 0) return;
 t.broken = 1; t.fuel = 0; t.fix = F.rupturedFix; // ruptured: stunned and armoured while he is down, tank refits later
 e.segTankStun = F.stun; e.segDash = null; S.stack = null;
 const blast = Math.round(F.blast * (e.max || 0)); // the tank blows: direct HP damage (plates and armour do not apply) and a short burst around the tank
 e.hp -= blast; txt(bx, by - 14, '-' + blast, '#ffb36b', 12);
 if (Math.hypot(R.p.x - bx, R.p.y - by) < F.blastRadius) hurt(F.blastHurt, e);
 ring(bx, by, F.blastRadius, '#fff0c2', .45);
 ring(bx, by, 60, '#ffb36b', .4); burst(bx, by, '#ff9a45', 18, 200); R.shake = Math.max(R.shake, 10);
 txt(e.x, e.y - e.r - 12, 'FUEL TANK RUPTURED', '#ffb36b', 9); sfx('shatter', { x: e.x });
}
function segFuelThink(e, dt) {
 const S = R.seg, F = SEGFAULT.fuel;
 for (const t of S.tanks) {
  t.hit = Math.max(0, t.hit - dt);
  if (t.broken) { if ((t.fix -= dt) <= 0) { t.broken = 0; t.hp = t.max; t.fuel = .35; } } else t.fuel = Math.min(1, t.fuel + F.refuel * dt);
 }
 if (e.segTankStun > 0) e.segTankStun -= dt;
}
function segfaultAbsorb(e, damage, attack, source) {
 const S = R.seg, O = S?.overload;
 if (!S || e.bd0?.n !== 'SEGMENT FAULT' || !source) return false;
 const rel = Math.atan2(Math.sin(Math.atan2(source.y - e.y, source.x - e.x) - (e.faceAng || 0)), Math.cos(Math.atan2(source.y - e.y, source.x - e.x) - (e.faceAng || 0)));
 const side = Math.abs(rel) <= Math.PI / 4 ? 'front' : Math.abs(rel) >= Math.PI * .75 ? 'back' : rel < 0 ? 'left' : 'right';
 if (side === 'back') segTankHit(e, damage); // hits from behind reach the fuel tanks (and still hurt him)
 if (e.ph < 2) {
  const plate = S.plates.find(item => item.side === side && !item.dead);
  if (!plate) return false;
  const kind = attack?.expl ? 'impact' :
   attack?.k === 'proj' ? 'projectile' :
   ['beam', 'cone', 'chain'].includes(attack?.k) ? 'energy' :
   ['nova', 'mine', 'melee'].includes(attack?.k) ? 'impact' : '';
  const reduction = SEGFAULT.plates.resist[side]?.[kind] || 0;
  plate.hp = Math.max(0, plate.hp - damage * (1 - reduction));
  plate.hit = .16;
  burst(e.x + Math.cos((e.faceAng || 0) + ({ front: 0, back: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 }[side])), e.y, '#ffb6be', 3, 70);
  if (plate.hp <= 0) {
   plate.dead = 1;
   ring(e.x, e.y, SEGFAULT.plates.radius + 15, '#ff6177', .35);
   burst(e.x, e.y, '#ffc5cb', 14, 150);
   txt(e.x, e.y - e.r - 12, `${side.toUpperCase()} PLATE BROKEN`, '#ff9aa8', 9);
   sfx('shatter', { x: e.x });
  } else if (!plate.hitCue) {
   plate.hitCue = 1;
   sfx('shield_hit', { x: e.x });
  }
  return true;
 }
 if (!O || O.state !== 'absorbing' || side !== 'front') return false;
 const contribution = Math.max(0, damage);
 O.charge += contribution;
 O.hp = Math.max(0, O.hp - contribution);
 O.hit = .18;
 if (O.shots.length < 16) O.shots.push({
  angle: Math.atan2(source.y - e.y, source.x - e.x),
  speed: cl(attack?.k === 'proj' ? attack.sp : 180, 120, 580),
  damage: cl(contribution * .55, 4, 20),
  color: attack?.col || '#ff6177',
  type: attack?._spell || attack?.k || 'projectile',
  radius: attack?.k === 'proj' ? cl((attack.rad || 5) * (attack.size || 1), 3, 9) : 4
 });
 if (O.charge >= SEGFAULT.phase3.overload.threshold) {
  O.state = 'overloading';
  O.t = SEGFAULT.phase3.overload.telegraph;
  sfx('boss_warning', { x: e.x });
 } else if (O.hp <= 0) {
  O.state = 'regenerating';
  O.t = SEGFAULT.phase3.overload.regenDelay;
  O.charge = 0;
  O.shots = [];
  ring(e.x, e.y, e.r + 30, '#ff9b5e', .45);
  sfx('shatter', { x: e.x });
 }
 return true;
}
function hitE(e, d, a, src, np, damageScale = 1) {
 if (e.segStun > 0) d *= 1.5;
 if (R.sandbox && R.sbOneHit) d *= 100;
 if (e.dead) return;
 if (e.inv > 0) { txt(e.x, e.y - e.r, 'IMMUNE', '#aab4c8', 10); return; }
 const sc = a.crit >= 1, crit = sc || Math.random() < ST.crit;
 let v = d * (crit ? (sc ? 1 + a.crit : 2) : 1) * e.prot * (e.vuln > 0 ? 1.5 : 1);
 const overloadState = e.boss && e.bd0?.n === 'SEGMENT FAULT' ? R.seg?.overload?.state : null;
 const segArmor = e.ph >= 2 ? (overloadState === 'cooldown' ? SEGFAULT.phase3.overload.cooldownArmor : SEGFAULT.phase3.overload.absorbingArmor) : 6;
 const arm = Math.max(0, (e.boss ? segArmor : e.k === 'tank' ? 6 : e.elite ? 4 : 0) - (e.shT > 0 ? (e.shred || 0) : 0));
 if (arm) v = Math.max(v * .25, v - arm);
 if (e.segTankStun > 0) v *= 1 - SEGFAULT.fuel.stunReduction; // ruptured tank: heavy damage reduction while he is down
 v *= damageScale;
 if (e.boss && e.bd0?.n === 'SEGMENT FAULT' && segfaultAbsorb(e, v, a, src)) {
  recordDamage(a, v);
  txt(e.x, e.y - e.r, overloadState === 'absorbing' ? 'ABSORBED' : 'PLATED', '#ffb6be', 9);
  return;
 }
 if (e.boss && e.bd0?.n === 'SEGMENT FAULT' && R.seg?.protocol && !R.seg.protocol.active && !R.seg.protocol.activated) segActivateDeadZone();
 if (e.twin === 'red' || e.twin === 'blue') R.race.lastHit = e.twin;
 const LK = R.race && R.race.lock;
 if (LK && LK.state === 'active' && LK.holder === e) { LK.dur -= v; v *= RACE.mutex.reduce; if (LK.dur <= 0) shatterLock(LK, e); }
 if (e.shMax) v = dmgDirect(e, v) + 0 * (e.shHit = .2); else e.hp -= v;
 e.fl = .08;
 recordDamage(a, v);
 if (a.burn) e.burnCard = a._cardId;
 if (SET.q > 0) burst(e.x, e.y, a.col || '#fff', [0, 2, 4][SET.q], 90);
 txt(e.x, e.y - e.r, Math.round(v), crit ? '#ffd23f' : '#fff', crit ? 15 : 11);
 sfx(crit ? 'crit' : 'hit', { x: e.x });
 if (a.burn) { e.burn = 3; e.bd = Math.max(e.bd, d * damageScale * .4 * a.burn / 3 * (arm ? .3 : 1)); }
 if (a.freeze) { e.slow = 2.2 + 1.1 * (a.freeze - 1); e.sf = [.55, .42, .32][a.freeze - 1] || .32; }
 if (a.knock && src) {
  const dx = e.x - src.x, dy = e.y - src.y, l = Math.hypot(dx, dy) || 1, k = a.knock / (e.boss ? 6 : e.r / 10);
  e.kx += dx / l * k; e.ky += dy / l * k;
 }
 if (a.leech && G.hp < G.max) G.hp = Math.min(G.max, G.hp + Math.min(1.5 * a.leech, v * .05 * a.leech));
 if (e.twin === 'merged' && e.hp <= e.max * RACE.splitAt && !(e.splitT > 0)) { e.hp = Math.max(1, e.hp); startSplit(e); }
 if (e.hp <= 0) kill(e, np);
}
function kill(e, np) {
 if (e.dead) return;
 if (R.leak && R.leak.boss === e && !R.leak.prismDead) {
  e.hp = 1;
  if (!R.leak.killBlocked) {
   R.leak.killBlocked = 1;
   R.banner = { t: 2.2, s: 'DEPENDENCY ERROR: PRISM PROCESS ACTIVE' };
   txt(e.x, e.y - e.r - 14, 'PRISM PROCESS REQUIRED', '#b36bff', 10);
  }
  return;
 }
 e.dead = 1; G.kills++;
 if (e.army) armyDeath(e);
 burst(e.x, e.y, e.c, e.boss ? 50 : 12, e.boss ? 260 : 130);
 sfx('kill', { x: e.x });
 if (ST.gc && !np) {
  const gcCap = 8 * ST.gc, gcGain = Math.min(ST.gc, gcCap - (R.gcGain || 0));
  if (gcGain > 0) { gainSh(gcGain); R.gcGain = (R.gcGain || 0) + gcGain; }
 }
 if (ST.panic && !np && !e.boss) blast(e.x, e.y, 62, e.max * .5, { col: '#ffa81f' }, e, 1);
 if (e.beh === 'split') for (let i = 0; i < 2; i++) spawnE('swarm', e.x + ri(14) - 7, e.y + ri(14) - 7);
 if (e.blast) R.tg.push({ x: e.x, y: e.y, r: 52, t: .7, max: .7, dmg: 12, own: 'e', c: '#ff5c7a' });
 if (e.boss) {
  const partner = e.twin && e.twin !== 'merged' ? R.en.find(x => x.boss && !x.dead && x !== e) : null;
  if (partner) {
   // One twin down: only its own shots and zones go away; the other Host keeps fighting.
   R.eb = R.eb.filter(b => b.own !== e.twin); R.tg = R.tg.filter(z => z.own2 !== e.twin);
   if (R.race.cb && R.race.cb.own === e.twin) R.race.cb = null;
   R.race.stk = (R.race.stk || []).filter(n => n.own2 !== e.twin);
   // Thread merge: the survivor absorbs the dead twin's process, gets faster, and the lock + tether vanish.
   partner.merged = 1; partner.sp *= RACE.merge.speed;
   if (partner.rp && !partner.rp[e.twin]) { partner.rp[e.twin] = rProc(e.twin); partner.rp[e.twin].cd = 1.6; }
   R.race.lock = null; R.race.merged = 1;
   R.shake = 12; R.banner = { t: 2, s: 'THREAD MERGE: ' + (e.twin === 'red' ? 'RED' : 'BLUE') + ' PROCESS ABSORBED' };
   sfx('race_merge');
  } else {
   R.bossDead = 1;
   R.en.forEach(x => { if (!x.dead && x !== e) { x.dead = 1; burst(x.x, x.y, x.c, 6); } });
   R.eb = []; R.shake = 18;
   if (R.race) { R.race.cb = null; R.race.stk = []; }
   if (R.leak) { R.leak.areas = []; R.leak.mc = null; }
   sfx('boss_death');
   showRunNotice('host', 'HOST PURGED', BOSSES[G.cfg.boss]?.n || e.g || 'HOST PROCESS');
  }
 }
}

// Sector flavour: some bugs only exist in one sector (wk), and each sector favours certain bugs (pref weights).
const wkey = () => G.world?.key || '';
function poolFor(i, budget) { return Object.keys(EN).filter(k => EN[k].from <= i && EN[k].cost <= budget && (!EN[k].wk || EN[k].wk.includes(wkey()))); }
function wpick(list) {
 const pf = G.world?.pref || {}, ws = list.map(k => pf[k] || 1), tot = ws.reduce((a, b) => a + b, 0);
 let r = Math.random() * tot;
 for (let j = 0; j < list.length; j++) { r -= ws[j]; if (r <= 0) return list[j]; }
 return list[list.length - 1];
}
function updSpawn(dt) {
 if (R.boss || R.budget <= .3) return;
 R.spT -= dt;
 const i = G.cfg.i;
 if (R.spT > 0 || R.en.length >= Math.min(26, 9 + i * 2)) return;
 const o = poolFor(i, R.budget + .3);
 if (!o.length) { R.budget = 0; return; }
 const k = wpick(o), [x, y] = spawnPos(G.cfg.arena, R.p.x, R.p.y);
 if (k === 'swarm') {
  for (let j = 0; j < 4; j++) { spawnE(k, x + ri(30) - 15, y + ri(30) - 15); R.budget -= .35; }
  R.spT = 1;
 } else {
  spawnE(k, x, y);
  if (k === 'chain') { const m = spawnE(k, x + 34, y + 18), a = R.en[R.en.length - 2]; if (a && m) { a.pair = m; a.mate = m; m.mate = a; R.budget -= EN.chain.cost; } }
  if (k === 'summoner') { const g = spawnE('tank', x + 22, y + 22); g.guard = 1; R.budget -= EN.tank.cost * .5; }
  R.budget -= EN[k].cost;
  R.spT = Math.max(.35, .85 - .04 * i);
 }
}

function ebul(x, y, an, sp, d, c, kind) {
 if (kind === 'shooter') sfx('shooter_shoot', { x });
 const bullet = { x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, dmg: d, l: 5, c: c || '#ff5c7a', pw: PW, kind: kind || 'orb' };
 R.eb.push(bullet);
 return bullet;
}

function segLineOfSight(x1, y1, x2, y2) {
 const length = Math.hypot(x2 - x1, y2 - y1), steps = Math.max(1, Math.ceil(length / 8));
 for (let i = 1; i < steps; i++) {
  const t = i / steps;
  if (wallHit(G.cfg.arena, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 2)) return false;
 }
 return true;
}
function segWallAt(x, y, r = 4) {
 return R.seg?.walls.find(w => w.hp > 0 && x > w.x - r && x < w.x + w.w + r && y > w.y - r && y < w.y + w.h + r);
}
function segDamageWall(wall, amount, heat = 0) {
 if (!wall || wall.hp <= 0 || wall.type === 'steel') return; // steel is unbreakable and never overheats
 wall.hp = amount > 0 && wall.type === 'holo' ? 0 : Math.max(0, wall.hp - amount);
 if (heat) wall.heat = Math.max(wall.heat || 0, heat);
 if (wall.hp === 0) {
  wall.regenAt = wall.type === 'door' ? Infinity : R.t + (wall.type === 'holo' ? SEGFAULT.phase2.hologramRegen : SEGFAULT.phase2.wallRegen); // the breached bulkhead door stays open
  burst(wall.x + wall.w / 2, wall.y + wall.h / 2, wall.type === 'holo' ? '#71edff' : '#ff687d', 8, 100);
  sfx('shatter');
 }
 setDynamicWalls(G.cfg.arena, R.seg.walls.filter(w => w.hp > 0).map(w => [w.x, w.y, w.w, w.h]));
}
function segOverloadThink(e, dt) {
 const O = R.seg.overload, C = SEGFAULT.phase3.overload;
 O.hit = Math.max(0, (O.hit || 0) - dt);
 if (O.state === 'off') return;
 O.t -= dt;
 if (O.state === 'overloading' && O.t <= 0) {
  const shots = O.shots.slice();
  if (!shots.length) shots.push({ angle: e.faceAng || 0, speed: 200, damage: 8, color: '#ff6177' });
  for (let i = 0; i < shots.length; i++) {
   const shot = shots[i], gradient = ['#a84cff', '#e34fb1', '#ff8745'];
   const b = ebul(e.x, e.y, shot.angle, shot.speed, shot.damage, gradient[i % gradient.length], 'seg_overload');
   b.pw = 1; b.segReflected = 1; b.r = shot.radius; b.reflectedType = shot.type;
  }
  for (let i = 0; i < 8; i++) {
   const b = ebul(e.x, e.y, i * Math.PI / 4 + (e.faceAng || 0), 165, 7, '#d16aff', 'seg_overload');
   b.pw = 1; b.segReflected = 1;
  }
  O.shots = []; O.charge = 0; O.state = 'cooldown'; O.t = C.cooldown;
  ring(e.x, e.y, 115, '#d16aff', .55);
  sfx('boss_ring', { x: e.x });
 } else if (O.state === 'cooldown' && O.t <= 0) {
  O.state = 'absorbing'; O.hp = C.durability; O.charge = 0; O.t = 0;
 } else if (O.state === 'regenerating' && O.t <= 0) {
  O.state = 'reviving'; O.t = .9;
  sfx('boss_warning', { x: e.x });
 } else if (O.state === 'reviving' && O.t <= 0) {
  O.state = 'absorbing'; O.hp = C.durability; O.charge = 0; O.t = 0;
  ring(e.x, e.y, e.r + 25, '#ff6177', .4);
  sfx('shield_break', { x: e.x });
 }
}
function segSchedule(type, duration, data = {}) {
 R.seg.telegraphs.push({ type, t: duration, T: duration, data });
}
function segSpawnHoming(e, target) {
 const an = Math.atan2(target.y - e.y, target.x - e.x), hs = SEGFAULT.phase2.homing.speed * (SEGFAULT.phase2.homing.speedMul[e.ph] || 1);
 R.eb.push({ x: e.x, y: e.y, vx: Math.cos(an) * hs, vy: Math.sin(an) * hs, dmg: SEGFAULT.phase2.homing.damage, l: 7, c: '#ff7380', kind: 'seg_homing', segHoming: 1, v2: e.ph >= 1, lastX: target.x, lastY: target.y, turn: SEGFAULT.phase2.homing.turn, disruptedUntil: 0 });
 sfx('boss_aim', { x: e.x });
}
function segSpawnBarrage(e, target) {
 const C = SEGFAULT.phase2.barrage, aim = Math.atan2(target.y - e.y, target.x - e.x);
 for (let i = 0; i < 5; i++) {
  const an = aim + i * Math.PI * 2 / 5;
  const targetX = target.x + Math.cos(an) * 95, targetY = target.y + Math.sin(an) * 95;
  const launch = Math.atan2(targetY - e.y, targetX - e.x);
  const b = ebul(e.x, e.y, launch, C.speed, C.damage, '#ff5267', 'seg_barrage');
  b.pw = 1; b.segBarrage = 1;
 }
 const center = ebul(e.x, e.y, aim, C.speed + 25, C.damage + 2, '#ffd0d6', 'seg_barrage');
 center.pw = 1; center.segBarrage = 1;
 sfx('boss_ring', { x: e.x });
}
function segSpawnAirstrike(data, ph) {
 const damage = 15 + ph * 2, radius = 54 + ph * 4;
 for (const target of data.strikes) {
  R.tg.push({ ...target, r: radius, t: .58, max: .58, dmg: damage, own: 'e', c: '#ff5267', kind: 'airstrike' });
 }
 sfx('boss_ring');
}
function segScheduleAirstrike(e, ph, p) {
 const count = 3 + ph, strikes = [{ x: p.x, y: p.y }];
 for (let i = 1; i < count; i++) {
  const angle = e.faceAng + i * Math.PI * 2 / (count - 1), distance = 72 + ph * 18;
  strikes.push({
   x: cl(p.x + Math.cos(angle) * distance, 52, W - 52),
   y: cl(p.y + Math.sin(angle) * distance, 52, H - 52)
  });
 }
 const delay = LEAK.meteor.tele;
 segSchedule('airstrike', delay, { strikes });
 sfx('boss_warning', { x: e.x });
}
function segSpawnVolley(e, data) {
 if (data.pattern === 'ring') {
  const origin = data.angle;
  for (let i = 0; i < data.count; i++) {
   ebul(e.x, e.y, origin + i * Math.PI * 2 / data.count, data.speed, data.damage, data.color, 'segfault');
  }
  sfx('boss_ring', { x: e.x });
 } else {
  for (let i = -1; i <= 1; i++) {
   ebul(e.x, e.y, data.angle + i * .22, data.speed, data.damage, data.color, 'segfault');
  }
  sfx('boss_aim', { x: e.x });
 }
}
function segStartTrail(e, data, duration, width, damage) {
 const length = Math.min(data.range || 340, Math.hypot(W, H));
 const endX = cl(e.x + Math.cos(data.angle) * length, 14, W - 14), endY = cl(e.y + Math.sin(data.angle) * length, 14, H - 14);
 const steps = Math.max(1, Math.ceil(Math.hypot(endX - e.x, endY - e.y) / 6));
 for (let i = 0; i <= steps; i++) {
  const t = i / steps, wall = segWallAt(e.x + (endX - e.x) * t, e.y + (endY - e.y) * t, width / 2);
  if (wall) segDamageWall(wall, 0, 2.5);
 }
 const tier = data.tier ?? 2, P = STDOUT_PAL[tier];
 R.seg.trails.push({ x1: e.x, y1: e.y, x2: endX, y2: endY, t: duration, T: duration, width, damage, tick: 0, color: data.color || P.fx, tier, grow: data.grow ?? .3, age: 0 });
 // flames along the lane are real stdout cones (same as the exhaust and the stdout card), spawned each frame by the trail update
 R.shake = Math.max(R.shake, data.shake ?? 3);
 sfx('seg_flame', { x: e.x });
}
function segActivateDeadZone() {
 const S = R.seg, D = SEGFAULT.deadZone;
 if (!S?.protocol || S.protocol.active || S.protocol.activated) return;
 S.protocol.activated = 1; S.protocol.active = 1; S.protocol.t = D.active;
 S.telegraphs = S.telegraphs.filter(tele => tele.type !== 'dead-zone');
 S.lasers = S.protocol.lines.map(line => ({ ...line, t: D.active, damage: D.damage, hitCd: 0 }));
 R.banner = { t: 1.4, s: 'DEAD ZONE // RELAY GRID ACTIVE' };
 sfx('boss_warning');
}
// RELAY HACKING: stand within reach of a node and hold E (touch: just stay close) to take it over. A hacked node stops firing and can no longer anchor Dead Zone lasers.
const SEG_NUM = ['I', 'II', 'III', 'IV'], SEG_SYM = ['{', '}', ';', '('];
const qteBtn = i => ({ x: W / 2 - 112 + i * 58, y: H - 74, w: 52, h: 40 });
function segQteStart(rl, ph) {
 const Q = SEGFAULT.qte, n = Q.len[ph] || Q.len[0], seq = [];
 for (let i = 0; i < n; i++) { let k; do k = Math.random() * 4 | 0; while (i && k === seq[i - 1]); seq.push(k); }
 rl.qte = { seq, i: 0, t: Q.time };
 sfx('seg_relay_charge', { x: rl.x });
}
function segQteInput(n) {
 const rl = R.seg?.relays.find(r => r.qte);
 if (!rl) return false;
 const q = rl.qte;
 if (q.seq[q.i] === n) {
  q.i++; uiSound('card_pick'); ring(rl.x, rl.y, 22, '#7ee8ff', .25);
  if (q.i >= q.seq.length) { rl.qte = null; segHackRelay(rl); }
 } else { q.i = 0; q.t -= SEGFAULT.qte.penalty; txt(rl.x, rl.y - 70, 'MISS', '#ff5c7a', 9); sfx('seg_relay', { x: rl.x }); }
 return true;
}
// RELAY HACKING (QTE): stand next to a node and press E (touch: just stand close) to open the hack, then press the numbered keys in the order shown. A hacked node stops firing and can no longer anchor Dead Zone lasers.
function segHackThink(dt) {
 const S = R.seg, p = R.p, RC = SEGFAULT.relay, Q = SEGFAULT.qte, ph = R.en.find(b => b.boss)?.ph || 0, coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
 for (const rl of S.relays) {
  if (rl.hacked) continue;
  const dist = Math.hypot(p.x - rl.x, p.y - rl.y);
  rl.near = dist < RC.hackRadius; rl.hcd = Math.max(0, (rl.hcd || 0) - dt); // hcd = hack cooldown (rl.cd is the turret's fire cooldown)
  if (rl.qte) {
   if (dist > RC.hackRadius + 16) rl.qte = null; // walked away
   else if ((rl.qte.t -= dt) <= 0) { rl.qte = null; rl.hcd = Q.cooldown; txt(rl.x, rl.y - 40, 'HACK FAILED', '#ff5c7a', 9); sfx('seg_relay', { x: rl.x }); }
  } else if (rl.near && rl.hcd <= 0 && (keys.e || coarse) && !S.relays.some(r => r.qte)) segQteStart(rl, ph);
 }
}
function sbxRebuild() { // recompile the pipeline into live casts after a cheat edit
 if (!R) return;
 R.casts = compilePipeline(G.slots, ST).out.map((cc, i) => ({ c: cc, id: i, label: castLabel(cc), t: 0, pend: 0, bt: 0, n: 0, dis: 0, period: 1 / stats(cc, ST).rate, rate: stats(cc, ST).rate }));
}
function sbxMiniPipe() { // pause menu: your current pipeline as chips (tap one to remove it) + the compiled result
 const nm = c => (SPELLS[c.k] || MODS[c.k] || {}).n || c.k;
 const chips = G.slots.map((c, i) => `<button class="btn g sm" data-pa="rmcard:${i}" title="remove" style="margin:2px">${nm(c)} v${c.v || 1} \u2715</button>`).join('') || '<span class="lbl">// empty pipeline</span>';
 const cp = compilePipeline(G.slots, ST);
 return `<div style="display:flex;flex-wrap:wrap;gap:2px;margin:4px 0">${chips}</div><pre style="font-size:10px;margin:4px 0;white-space:pre-wrap">${cp.out.map(c => lineOf(c, ST)).join('\n') || '// nothing compiles yet'}</pre>`;
}
function sbxCardOpts() { // sandbox: every spell and modifier, for the add_card() cheat
 const opt = (k, o) => `<option value="${k}"${G.sbxCard === k ? ' selected' : ''}>${o.n}</option>`;
 return `<optgroup label="spells">${Object.keys(SPELLS).map(k => opt(k, SPELLS[k])).join('')}</optgroup><optgroup label="modifiers">${Object.keys(MODS).map(k => opt(k, MODS[k])).join('')}</optgroup>`;
}
function segHackRelay(rl) {
 const S = R.seg;
 rl.hacked = 1; rl.state = 'idle'; rl.hack = 1; rl.near = false;
 burst(rl.x, rl.y, '#7ee8ff', 18, 160); ring(rl.x, rl.y, 70, '#7ee8ff', .4); sfx('heal', { x: rl.x });
 const left = S.relays.filter(r => !r.hacked).length;
 if (S.protocol) { // pull this node's lines out of a running Dead Zone
  S.protocol.lines = S.protocol.lines.filter(l => l.a !== rl.i && l.b !== rl.i); S.lasers = S.lasers.filter(l => l.a !== rl.i && l.b !== rl.i);
  if (!S.protocol.lines.length) { S.protocol = null; S.lasers = []; S.telegraphs = S.telegraphs.filter(q => q.type !== 'dead-zone'); }
 }
 R.banner = { t: 2.4, s: left < 2 ? 'RELAYS HACKED // DEAD ZONE OFFLINE' : 'RELAY HACKED // ' + (S.relays.length - left) + '/' + S.relays.length };
}
function segfaultThink(e, dt, ph, distance) {
 const S = R.seg, p = R.p;
 if (!S) return;
 segHackThink(dt);
 segFuelThink(e, dt);
 if (e.segTankStun > 0) { // fuel leak: dazed, leaking fire, heavily armoured
  if (Math.random() < .6) part(e.x - Math.cos(e.faceAng || 0) * e.r, e.y - Math.sin(e.faceAng || 0) * e.r, (Math.random() - .5) * 80, -20 - Math.random() * 60, .45, '#ff9a45', 2.5, 0);
  return;
 }
 if (e.segStun > 0) { // crashed into a wall: dazed and open to extra damage for a moment
  e.segStun -= dt;
  if (Math.random() < .5) part(e.x + (Math.random() - .5) * e.r * 1.6, e.y + (Math.random() - .5) * e.r * 1.6, (Math.random() - .5) * 90, -30 - Math.random() * 50, .4, '#ffe08a', 2, 0);
  return;
 }
 // anti-stuck: if he has not moved for a while he sidesteps around the wall and is cleared to jetpack again
 e.stk = e.stk || { x: e.x, y: e.y, t: 0 };
 if ((e.stk.t += dt) >= .8) {
  const moved = Math.hypot(e.x - e.stk.x, e.y - e.stk.y);
  e.stk.x = e.x; e.stk.y = e.y; e.stk.t = 0;
  if (moved < 6 && !e.segDash && distance > e.r + 50) {
   const base = Math.atan2(p.y - e.y, p.x - e.x);
   for (const off of [Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, Math.PI * .75, -Math.PI * .75]) {
    const nx = e.x + Math.cos(base + off) * 36, ny = e.y + Math.sin(base + off) * 36;
    if (!wallHit(G.cfg.arena, nx, ny, e.r)) { e.x = nx; e.y = ny; break; }
   }
   S.dashCd = Math.min(S.dashCd, .4);
  }
 }
 if (ph >= 1 && !e.segDash) segExhaust(e, e.faceAng ?? 0, dt, ph === 1 ? .4 : .8, ph); // passive jet: blue in phase 2, purple and stronger in phase 3
 const face = Math.atan2(p.y - e.y, p.x - e.x);
 let faceDelta = Math.atan2(Math.sin(face - (e.faceAng ?? face)), Math.cos(face - (e.faceAng ?? face)));
 e.faceAng = (e.faceAng ?? face) + cl(faceDelta, -2.4 * dt, 2.4 * dt);

 for (const plate of S.plates) {
  plate.hit = Math.max(0, (plate.hit || 0) - dt);
  if (!plate.hit) plate.hitCue = 0;
 }
 for (const wall of S.walls) {
  if (wall.heat > 0) wall.heat = Math.max(0, wall.heat - dt);
  wall.hitCd = Math.max(0, (wall.hitCd || 0) - dt);
  if (wall.hp > 0 && wall.heat > 0 && p.x > wall.x - 16 && p.x < wall.x + wall.w + 16 && p.y > wall.y - 16 && p.y < wall.y + wall.h + 16 && wall.hitCd <= 0) {
   wall.hitCd = .65;
   hurt(8, { x: wall.x + wall.w / 2, y: wall.y + wall.h / 2 });
  }
  if (wall.hp <= 0 && wall.regenAt <= R.t) {
   wall.hp = wall.max;
   wall.heat = 0;
   wall.regenAt = 0;
   ring(wall.x + wall.w / 2, wall.y + wall.h / 2, Math.max(wall.w, wall.h), wall.type === 'holo' ? '#71edff' : '#ff687d', .35);
  }
 }
 setDynamicWalls(G.cfg.arena, S.walls.filter(w => w.hp > 0).map(w => [w.x, w.y, w.w, w.h]));

 if (ph === 2 && !S.phase3) {
  S.phase3 = 1;
  const offsets = { front: 0, back: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 };
  for (const plate of S.plates) if (!plate.dead) {
   plate.dead = 1;
   const angle = (e.faceAng || 0) + offsets[plate.side], px = e.x + Math.cos(angle) * (e.r + 5), py = e.y + Math.sin(angle) * (e.r + 5);
   burst(px, py, '#ff8793', 5, 100);
  }
  const O = S.overload;
  O.state = 'absorbing'; O.hp = SEGFAULT.phase3.overload.durability; O.charge = 0; O.t = 0;
  R.shake = Math.max(R.shake, 12);
  sfx('boss_phase');
 }
 if (S.phase3) segOverloadThink(e, dt);

 for (const tele of S.telegraphs) tele.t -= dt;
 const activeTelegraphs = [];
 for (const tele of S.telegraphs) {
  if (tele.t > 0) { activeTelegraphs.push(tele); continue; }
  const d = tele.data;
  if (tele.type === 'homing') segSpawnHoming(e, d);
  else if (tele.type === 'barrage') segSpawnBarrage(e, d);
  else if (tele.type === 'airstrike') segSpawnAirstrike(d, ph);
  else if (tele.type === 'stdout') segStartTrail(e, { ...d, tier: 2, grow: SEGFAULT.phase2.stdoutV3.grow, half: SEGFAULT.phase2.stdoutV3.half }, 2.3, SEGFAULT.phase2.stdoutV3.width, SEGFAULT.phase2.stdoutV3.damage);
  else if (tele.type === 'flame') S.flames.push({ t: SEGFAULT.flame.duration[d.tier], angle: Math.atan2(p.y - e.y, p.x - e.x), tier: d.tier, em: 0, tick: 0 });
  else if (tele.type === 'volley') segSpawnVolley(e, d);
  else if (tele.type === 'dead-zone') segActivateDeadZone();
  else if (tele.type === 'jet-dash') { e.segDash = { x: d.x, y: d.y, angle: d.angle, speed: 500, stack: 0 }; segBurn(S, SEGFAULT.fuel.dashCost); }
  else if (tele.type === 'stack') {
   segBurn(S, SEGFAULT.fuel.dashCost * 1.6);
   S.stack = { routes: d.routes, index: 1, trail: SEGFAULT.phase3.stack.trail, origin: { x: e.x, y: e.y } };
   e.segDash = { ...d.routes[0], angle: Math.atan2(d.routes[0].y - e.y, d.routes[0].x - e.x), speed: 540, stack: 1 };
  }
 }
 S.telegraphs = activeTelegraphs;

 if (S.protocol?.active) {
  S.protocol.t -= dt;
  if (S.protocol.t <= 0) { S.protocol = null; S.lasers = []; }
 }
 for (const trail of S.trails) {
  trail.t -= dt; trail.tick -= dt; trail.age += dt; trail.em = (trail.em || 0) - dt;
  if (trail.t > 0 && trail.em <= 0) { // stdout cones along the lane up to the flame front; they thin out in the last second so the expiry is obvious
   trail.em = .05;
   const tl = Math.hypot(trail.x2 - trail.x1, trail.y2 - trail.y1) || 1, ux = (trail.x2 - trail.x1) / tl, uy = (trail.y2 - trail.y1) / tl, rch = tl * cl(trail.age / Math.max(.01, trail.grow), 0, 1), Pf = STDOUT_PAL[trail.tier ?? 2];
   for (let n = 0; n < 3; n++) {
    if (trail.t < 1 && Math.random() > trail.t) continue;
    const s = Math.random() * rch, ln = 70 + Math.random() * 60;
    R.fx.push({ x: trail.x1 + ux * s, y: trail.y1 + uy * s, r: 0, max: ln, l: .32, d: .32, c: Pf.fx, tier: trail.tier ?? 2, cone: 1, stdout: 1, a: Math.atan2(uy, ux) + (Math.random() - .5) * .5, h: .28 });
   }
  }
  const reach = cl(trail.age / Math.max(.01, trail.grow), 0, 1), fx = trail.x1 + (trail.x2 - trail.x1) * reach, fy = trail.y1 + (trail.y2 - trail.y1) * reach;
  if (trail.t > 0 && trail.tick <= 0 && segLineDistance(p.x, p.y, trail.x1, trail.y1, fx, fy) < trail.width + 7) {
   trail.tick = .42;
   hurt(trail.damage, { x: trail.x1, y: trail.y1 });
  }
 }
 S.trails = S.trails.filter(trail => trail.t > 0);
 for (const laser of S.lasers) laser.hitCd = Math.max(0, laser.hitCd - dt);

 // RELAY TURRETS: every node charges (visible ring + aim line + three pips), then fires a burst of slow rounds along the locked line.
 // Nodes that anchor a Dead Zone line go quiet until the protocol ends; at most RC.maxBusy nodes are mid-burst at once.
 {
  const RC = SEGFAULT.relay;
  let busy = S.relays.filter(rl => rl.state !== 'idle').length;
  for (const rl of S.relays) {
   if (rl.hacked) continue;
   if (S.protocol && S.protocol.lines.some(l => l.a === rl.i || l.b === rl.i)) { rl.state = 'idle'; rl.cd = Math.max(rl.cd, 1.2); continue; }
   if (rl.state === 'idle') {
    rl.cd -= dt;
    if (rl.cd <= 0 && busy < RC.maxBusy) { rl.state = 'charge'; rl.t = RC.telegraph; rl.aim = Math.atan2(p.y - rl.y, p.x - rl.x); busy++; sfx('seg_relay_charge', { x: rl.x }); }
   } else if (rl.state === 'charge') {
    rl.t -= dt;
    if (rl.t > .22) rl.aim = Math.atan2(p.y - rl.y, p.x - rl.x); // tracks, then locks for the last moment so the lane can be read and dodged
    if (rl.t <= 0) { rl.state = 'burst'; rl.shots = RC.burst; rl.gap = 0; }
   } else if (rl.state === 'burst') {
    rl.gap -= dt;
    if (rl.gap <= 0) {
     const b = ebul(rl.x, rl.y, rl.aim + (rl.shots - (RC.burst + 1) / 2) * (RC.spread[ph] || 0), RC.speed, RC.damage, '#ff9d6b', 'seg_relay');
     b.l = 8; rl.flash = .14;
     burst(rl.x, rl.y, '#ff9d6b', 3, 60);
     sfx('seg_relay', { x: rl.x });
     if (--rl.shots <= 0) { rl.state = 'idle'; rl.cd = RC.cooldown[ph] * (.85 + Math.random() * .3); } else rl.gap = RC.gap;
    }
   }
   rl.flash = Math.max(0, (rl.flash || 0) - dt);
  }
 }

 S.homingCd -= dt; S.barrageCd -= dt; S.stdoutCd -= dt; S.deadZoneCd -= dt;
 if (S.homingCd <= 0 && !S.telegraphs.some(q => q.type === 'homing')) { // phase 1 fires the plain homing missile; V2 rules start in phase 2
  segSchedule('homing', SEGFAULT.phase2.homing.telegraph, { x: p.x, y: p.y });
  S.homingCd = SEGFAULT.phase2.homing.cooldown * (ph ? 1 : 1.3);
 }
 const BC = SEGFAULT.phase2.barrage;
 // six-missile barrage: phase 2+, only when the Host is far, and only on the moment they cross the threshold (hysteresis: must come back inside before it can re-arm)
 if (distance < BC.farDistance - BC.hysteresis) S.barrageArmed = 1;
 if (ph >= 1 && S.barrageArmed && distance >= BC.farDistance && S.barrageCd <= 0 && !S.telegraphs.some(q => q.type === 'barrage')) {
  S.barrageArmed = 0;
  S.barrageCd = BC.cooldown;
  segSchedule('barrage', BC.telegraph, { x: p.x, y: p.y });
  sfx('boss_warning', { x: e.x });
 }
 if (ph >= 1 && S.stdoutCd <= 0 && distance > SEGFAULT.phase2.stdoutV3.distance && !segLineOfSight(e.x, e.y, p.x, p.y) && !S.telegraphs.some(q => q.type === 'stdout')) { // V3: moderately far AND no direct line of sight
  S.stdoutCd = SEGFAULT.phase2.stdoutV3.cooldown;
  segSchedule('stdout', SEGFAULT.phase2.stdoutV3.telegraph, { angle: Math.atan2(p.y - e.y, p.x - e.x), range: SEGFAULT.phase2.stdoutV3.range, color: '#bd71ff' });
  sfx('boss_warning', { x: e.x });
 }
 if (S.deadZoneCd <= 0 && !S.protocol && S.lasers.length === 0) {
  const nodes = ARENAS[G.cfg.arena].nodes || [], live = S.relays.filter(r => !r.hacked).map(r => r.i);
  if (nodes.length >= 6 && live.length >= 2) { // needs two un-hacked nodes to stretch a laser between
   S.deadZoneCd = SEGFAULT.deadZone.cooldown;
   const layouts = [
    [[0, 5], [1, 4], [2, 3]],
    [[0, 3], [1, 2], [4, 5]],
    [[0, 4], [1, 5], [2, 3]]
   ];
   const pairs = live.length === nodes.length ? layouts[S.relayPattern++ % layouts.length] : Array.from({ length: live.length >> 1 }, (_, i) => [live[i], live[live.length - 1 - i]]); // hacked nodes drop out; pair up the rest
   const lines = pairs.map(([a, b]) => ({ a, b, x1: nodes[a][0], y1: nodes[a][1], x2: nodes[b][0], y2: nodes[b][1] }));
   S.protocol = { active: 0, activated: 0, t: SEGFAULT.deadZone.warning, lines };
   S.telegraphs.push({ type: 'dead-zone', t: SEGFAULT.deadZone.warning, T: SEGFAULT.deadZone.warning, data: {} });
   R.banner = { t: SEGFAULT.deadZone.warning, s: 'DEAD ZONE // RELAYS ACQUIRING' };
   sfx('boss_warning', { x: e.x });
  }
 }
 // CLOSE-RANGE STDOUT (the Host's stdout card flames, v1/v2/v3 by phase): when the Host gets close and there is fuel
 S.flameCd -= dt;
 { const FL = SEGFAULT.flame;
  if (S.flameCd <= 0 && !S.flames.length && !S.telegraphs.some(q => q.type === 'flame') && distance < FL.trigger[ph] && segFuel(S) >= FL.minFuel) {
   S.flameCd = FL.cooldown[ph]; segSchedule('flame', FL.telegraph, { tier: ph }); sfx('boss_bolt', { x: e.x }); // audio-only cue: it is meant to punish standing close
  }
  for (const f of S.flames) {
   f.t -= dt; f.em -= dt; f.tick -= dt;
   const want = Math.atan2(p.y - e.y, p.x - e.x), diff = Math.atan2(Math.sin(want - f.angle), Math.cos(want - f.angle)), rg = FL.range[f.tier], pal = STDOUT_PAL[f.tier];
   f.angle += cl(diff, -FL.track * dt, FL.track * dt); e.faceAng = f.angle;
   if (f.em <= 0) {
    f.em = .07;
    R.fx.push({ x: e.x, y: e.y, r: 0, max: rg, l: .22, d: .22, c: pal.fx, tier: f.tier, cone: 1, stdout: 1, a: f.angle, h: FL.half });
    for (let i = 0; i < 3; i++) { const an = f.angle + (Math.random() - .5) * .9, v = 220 + Math.random() * 200; part(e.x + Math.cos(f.angle) * e.r, e.y + Math.sin(f.angle) * e.r, Math.cos(an) * v, Math.sin(an) * v, .35, pal.fx, 3 + Math.random() * 3, 1); }
   }
   segBurn(S, FL.drain * dt);
   for (const w of S.walls) { // fire overheats the walls it touches
    if (w.hp <= 0 || w.type === 'steel' || w.type === 'door') continue;
    const cxp = cl(e.x, w.x, w.x + w.w), cyp = cl(e.y, w.y, w.y + w.h), wa = Math.atan2(cyp - e.y, cxp - e.x);
    if (Math.hypot(cxp - e.x, cyp - e.y) < rg && Math.abs(Math.atan2(Math.sin(wa - f.angle), Math.cos(wa - f.angle))) < FL.half + .15) segDamageWall(w, 0, 2.5);
   }
   if (segFuel(S) <= .02) f.t = 0;
   if (f.tick <= 0 && Math.hypot(p.x - e.x, p.y - e.y) < rg + 8) {
    const df = Math.atan2(Math.sin(Math.atan2(p.y - e.y, p.x - e.x) - f.angle), Math.cos(Math.atan2(p.y - e.y, p.x - e.x) - f.angle));
    if (Math.abs(df) < FL.half) { hurt(FL.damage[f.tier], e); f.tick = FL.tick; }
   }
  }
  S.flames = S.flames.filter(f => f.t > 0);
 }
 S.dashCd -= dt;
 if (!e.segDash && !S.stack && S.dashCd <= 0 && segFuel(S) >= SEGFAULT.fuel.minDash && !S.telegraphs.some(q => q.type === 'jet-dash')) {
  S.dashCd = SEGFAULT.phase3.dashCooldown;
  const angle = Math.atan2(p.y - e.y, p.x - e.x), length = Math.min(SEGFAULT.phase3.dashLength, distance + 45);
  segSchedule('jet-dash', .72, { angle, x: cl(e.x + Math.cos(angle) * length, e.r + 20, W - e.r - 20), y: cl(e.y + Math.sin(angle) * length, e.r + 20, H - e.r - 20) });
  sfx('boss_warning', { x: e.x });
 }
 if (ph === 2) {
  S.stackCd -= dt;
  if (!S.stack && S.stackCd <= 0 && segFuel(S) >= SEGFAULT.fuel.minDash && !S.telegraphs.some(q => q.type === 'stack')) {
   S.stackCd = SEGFAULT.phase3.stack.cooldown;
   const aim = Math.atan2(p.y - e.y, p.x - e.x), routes = [-.62, 0, .62].map(delta => {
    const a = aim + delta, length = SEGFAULT.phase3.stack.length;
    return { angle: a, x: cl(e.x + Math.cos(a) * length, e.r + 20, W - e.r - 20), y: cl(e.y + Math.sin(a) * length, e.r + 20, H - e.r - 20) };
   });
   routes.push(routes.splice(1, 1)[0]); // zig-zag order: left end -> right end -> centre end
   segSchedule('stack', SEGFAULT.phase3.stack.telegraph, { routes });
   sfx('boss_warning', { x: e.x });
  }
 }
 if (e.segDash) {
  const dash = e.segDash, dx = dash.x - e.x, dy = dash.y - e.y, len = Math.hypot(dx, dy), V2 = SEGFAULT.phase3.stdoutV2, SK = SEGFAULT.phase3.stack;
  if (dash.sx == null) { dash.sx = e.x; dash.sy = e.y; }
  // STACK OVERFLOW: three dashes in a zig-zag through the marked points. Phase 3 dashes ricochet off walls (the wall overheats) instead of stopping.
  const endDash = crash => {
   const stackTrail = dash.stack && S.stack, run = Math.hypot(e.x - dash.sx, e.y - dash.sy);
   e.segDash = null;
   if ((!crash || stackTrail) && run > 24) {
    segStartTrail(e, { angle: dash.angle + Math.PI, range: stackTrail ? run : Math.min(run, V2.duration * 420), color: '#70b5ff', tier: 1,
      grow: stackTrail ? SK.grow : V2.grow, half: stackTrail ? SK.half : V2.half, shake: stackTrail ? 2 : 5 },
     stackTrail ? S.stack.trail : V2.duration, stackTrail ? 9 : V2.width, V2.damage);
   }
   if (crash && !stackTrail) segCrash(e, crash);
   else if (crash) R.shake = Math.max(R.shake, 6);
   if (stackTrail) { // zig-zag: straight on to the next marked point, heading along the real leg
    const route = S.stack.routes[S.stack.index++];
    if (route) e.segDash = { ...route, angle: Math.atan2(route.y - e.y, route.x - e.x), speed: 540, stack: 1 }; else S.stack = null;
   }
  };
  if (len < dash.speed * dt || len < 5) { e.x = dash.x; e.y = dash.y; endDash(null); }
  else {
   const step = dash.speed * dt, ox = e.x, oy = e.y, fx = ox + dx / len * step, fy = oy + dy / len * step;
   let nx = fx, ny = fy, crash = null;
   if (!dash.back) for (let i = 0; i < 5 && !crash; i++) {
    const t = (i + 1) / 5, wall = segWallAt(ox + (fx - ox) * t, oy + (fy - oy) * t, e.r * .55);
    if (wall?.type === 'holo') segDamageWall(wall, 1000, 2.5); // holograms never stop a dash: he smashes straight through
    else if (wall) {
     nx = ox + (fx - ox) * (i / 5); ny = oy + (fy - oy) * (i / 5);
     if (ph === 2 && (dash.bounces || 0) < 2) { // phase 3: ricochet. The wall overheats (holograms still shatter), steel just rings; he keeps his momentum off the struck face
      segDamageWall(wall, wall.type === 'holo' ? 1000 : 0, 2.5);
      let vx = dx / len, vy = dy / len;
      if (nx < wall.x || nx > wall.x + wall.w) vx = -vx; else vy = -vy;
      const rem = Math.max(150, len), bx = cl(nx + vx * rem, e.r + 20, W - e.r - 20), by = cl(ny + vy * rem, e.r + 20, H - e.r - 20);
      Object.assign(dash, { x: bx, y: by, angle: Math.atan2(vy, vx), bounces: (dash.bounces || 0) + 1, sx: nx, sy: ny });
      burst(nx + Math.cos(dash.angle + Math.PI) * -e.r, ny, '#ffb36b', 12, 200); R.shake = Math.max(R.shake, 7); sfx('seg_impact', { x: e.x });
      break;
     }
     segDamageWall(wall, 1000, 2.5); crash = wall; // earlier phases: normal and holo walls shatter on impact, steel does not; either way the dash ends here
    }
   }
   e.x = nx; e.y = ny; e.faceAng = dash.back ? dash.angle + Math.PI : dash.angle;
   segExhaust(e, dash.angle, dt, 1, e.ph >= 2 ? 2 : 1);
   if (!dash.back && Math.hypot(p.x - e.x, p.y - e.y) < e.r + 10 && p.inv <= 0) hurt(e.dmg, e);
   if (crash) endDash(crash);
  }
 }
}
function segCrash(e, wall) {
 const steel = wall.type === 'steel', hx = e.x + Math.cos(e.faceAng) * e.r, hy = e.y + Math.sin(e.faceAng) * e.r;
 R.shake = Math.max(R.shake, steel ? 14 : 9);
 burst(hx, hy, '#ffb36b', 16, 220); burst(hx, hy, '#ff677c', 10, 160); ring(hx, hy, steel ? 90 : 60, '#fff0c2', .4);
 sfx('seg_impact', { x: e.x });
}
// Jetpack exhaust: short stdout cones every few frames overlap into a continuous plume out of Segfault's back (same flame the Host's stdout() uses).
function segExhaust(e, heading, dt, power = 1, tier = 1) {
 e.exT = (e.exT || 0) - dt;
 if (e.exT > 0) return;
 e.exT = .045;
 R.fx.push({ x: e.x - Math.cos(heading) * e.r * .8, y: e.y - Math.sin(heading) * e.r * .8, r: 0, max: 130 * power, l: .24, d: .24, c: STDOUT_PAL[tier].fx, tier, cone: 1, stdout: 1, a: heading + Math.PI, h: .3 });
}
function segLineDistance(px, py, ax, ay, bx, by) {
 const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
 const t = cl(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
 return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
// ===== THE RUNTIME ERROR (Grid Lock) BUFF: corrupted walls, wall satchels, prism + afterimage, faster/tighter triangle bursts, adaptive teleport =====
// Values marked [default] were NOT specified in the design doc: they are implementation defaults, easy to retune here.
const RTE = {
 aim: { n: 3, spread: .07 },                       // aim() burst: same 3 triangles, ~4 deg apart (was .22 rad); speed = SPELLS.fireball.sp (was 150)
 capByPhase: [1, 2, 3],                            // max simultaneously corrupted walls per phase (1 / 2 / 3 from the doc's example)
 wall: { every: [6.0, 5.2, 4.6], rays: 2, arc: 1.0, speed: 58, life: 9, dmg: 12, r: 8, warn: .6, maxBullets: 90 }, // fewer, heavier // [default] slow, long-lived prism projectiles
 satchel: { max: 5, speed: 300, arm: .8, fuse: .55, touchFuse: .3, touchDist: 13, radius: 66, dmg: 20, manualMinAge: 5, stagger: .16 }, // blast = damage only, no projectiles // [default]
 prism: { charge: 1.15, lock: .3, beam: .5, dmg: 14, w: 5, extra: 2, reflectDmg: 8, bounces: 3 },  // extra = reflected segments stay visible/active 2s longer (doc)
 after: { mode: 'laser', life: 2.2, speed: 70, aimAt: 1.0, fireAt: 1.6, spawnAt: .5, lead: .35, beam: .3, dmg: 7, w: 3, ring: 105, tri: 3, triSpeed: 90, triLife: 12, triDmg: 6 }, // [default] mode: 'laser' | 'triangles' (the doc does not say which one was chosen)
 transit: .24,                                    // invulnerable (i-frames) while she is between the departure and landing points
 recall: { aim: .5, glare: 1.0, dmg: [20, 24, 27], w: 9, flash: .2, after: .45 }, // RE:CALL sniper
 nul: { cards: 3.5, slow: 8, dmg: 8, speed: 230, tele: 1.0 },       // NULL REFERENCE wave
 col: '#e070ff', hot: '#ffd6fb'
};
const RTE_NAME = 'THE RUNTIME ERROR';
const isRTE = e => e && e.bd0 && e.bd0.n === RTE_NAME;
const RT = () => R.rt ||= { cw: [], sat: [], thr: [], pr: [], af: [], seg: [], blasts: [], hz: [], sw: [], pn: [], rc: null, nl: [] };
const rteWalls = () => ARENAS[G.cfg.arena].w;
function rteWallAt(x, y, m = 3) { // index of the interior wall block containing (x,y) (+m px margin), or -1 (map edge / no wall)
 const ws = rteWalls();
 for (let i = 0; i < ws.length; i++) { const w = ws[i]; if (x > w[0] - m && x < w[0] + w[2] + m && y > w[1] - m && y < w[1] + w[3] + m) return i; }
 return -1;
}
function rteCrossed(ax, ay, bx, by) { // interior walls the straight teleport line passes through
 const ws = rteWalls(), out = [], len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(len / 3));
 for (let s = 0; s <= n; s++) {
  const px = ax + (bx - ax) * s / n, py = ay + (by - ay) * s / n;
  for (let i = 0; i < ws.length; i++) { const w = ws[i]; if (!out.includes(i) && px > w[0] && px < w[0] + w[2] && py > w[1] && py < w[1] + w[3]) out.push(i); }
 }
 return out;
}
const rteRectDist = (px, py, w) => Math.hypot(Math.max(w[0] - px, 0, px - (w[0] + w[2])), Math.max(w[1] - py, 0, py - (w[1] + w[3])));
const rteIsCorrupt = wi => !!R.rt && R.rt.cw.some(c => c.wi === wi);
function rteBullet(x, y, a, sp, dmg, life, kind, color) { // shared spawn for prism / triangle hazards (obeys the global bullet cap)
 if (R.eb.length > 280) return null;
 const b = ebul(x, y, a, sp, dmg, color || RTE.col, kind);
 b.l = life;
 if (kind === 'prism') { b.pw = 1; b.r = RTE.wall.r; } // prism projectiles only vanish on Host contact or when they leave the map
 return b;
}

// --- adaptive teleport: score candidate landing spots by where the Host is heading, and by whether the jump cuts through a wall ---
function rtePickTp(e, p, ph) {
 const T = RT(), cap = RTE.capByPhase[ph] ?? 3, dist = e.hp / e.max > .35 ? 85 : 170;
 const sp = Math.hypot(p.vx || 0, p.vy || 0), ux = sp > 20 ? p.vx / sp : 0, uy = sp > 20 ? p.vy / sp : 0;
 let best = null;
 for (let i = 0; i < 16; i++) {
  const a = Math.random() * 6.3, x = p.x + Math.cos(a) * dist, y = p.y + Math.sin(a) * dist;
  if (wallHit(G.cfg.arena, x, y, e.r + 4) || hazAt(G.cfg.arena, x, y)) continue;
  const walls = rteCrossed(e.x, e.y, x, y), fresh = walls.filter(w => !rteIsCorrupt(w));
  let s = Math.random() + (ux || uy ? 1.4 * (Math.cos(a) * ux + Math.sin(a) * uy) : 0); // land ahead of the Host's movement
  if (fresh.length) s += T.cw.length < cap ? 2 : 1.2;                                   // prefer jumps that corrupt a wall (or move the corruption)
  if (!best || s > best.s) best = { s, x, y, walls: fresh };
 }
 return best;
}
function rteCorrupt(wi, ph) {
 const T = RT(), cap = RTE.capByPhase[ph] ?? 3;
 if (T.cw.some(c => c.wi === wi)) return;
 while (T.cw.length >= cap) T.cw.shift(); // at the cap the oldest corruption moves to the new wall: the cap is never exceeded
 T.cw.push({ wi, age: 0, fire: 1.4 + Math.random() * .8, n: 0 });
 const w = rteWalls()[wi];
 ring(w[0] + w[2] / 2, w[1] + w[3] / 2, Math.max(w[2], w[3]) * .7, RTE.col, .5);
 burst(w[0] + w[2] / 2, w[1] + w[3] / 2, RTE.col, 12, 150);
 txt(w[0] + w[2] / 2, w[1] - 8, 'WALL CORRUPTED', RTE.col, 11); sfx('boss_warning', { x: w[0] });
}
function rteWallFire(c, ph) {
 const w = rteWalls()[c.wi], cx = w[0] + w[2] / 2, cy = w[1] + w[3] / 2, W0 = RTE.wall;
 if (R.eb.length > W0.maxBullets) return;
 const base = Math.atan2(H / 2 - cy, W / 2 - cx) + ((c.n++ % 2) ? W0.arc / 2 : 0); // wall-aware: the fan opens toward the middle of the arena
 for (let i = 0; i < W0.rays; i++) {
  const a = base + (i - (W0.rays - 1) / 2) * W0.arc;
  let sx = cx, sy = cy;
  for (let k = 0; k < 120 && sx > w[0] - 2 && sx < w[0] + w[2] + 2 && sy > w[1] - 2 && sy < w[1] + w[3] + 2; k++) { sx += Math.cos(a) * 3; sy += Math.sin(a) * 3; } // start on the wall's surface, never inside it
  rteBullet(sx, sy, a, W0.speed, W0.dmg, W0.life, 'prism');
 }
 sfx('zone_warn', { x: cx });
}

// --- wall satchels ---
function rteThrow(e) {
 const T = RT(), S = RTE.satchel, p = R.p;
 if (T.sat.length + T.thr.length >= S.max) return false;
 const ws = rteWalls().map((w, i) => ({ i, d: Math.hypot(w[0] + w[2] / 2 - p.x, w[1] + w[3] / 2 - p.y) })).sort((a, b) => a.d - b.d).slice(0, 3);
 const t = ws[ri(ws.length)], w = rteWalls()[t.i], a = Math.atan2(w[1] + w[3] / 2 - e.y, w[0] + w[2] / 2 - e.x);
 T.thr.push({ x: e.x, y: e.y, px: e.x, py: e.y, vx: Math.cos(a) * S.speed, vy: Math.sin(a) * S.speed, l: 2.2 });
 sfx('enemy_summon', { x: e.x }); return true;
}
function rteDetonate() { // the boss triggers its armed satchels in a staggered sequence
 const T = RT(), S = RTE.satchel, armed = T.sat.filter(s => s.st === 'arm' && s.arm <= 0);
 if (armed.length < 2 && !(armed[0] && armed[0].age > S.manualMinAge)) return false; // a lone fresh trap is kept for the Host to run into
 armed.forEach((s, i) => { s.st = 'fuse'; s.fuse = S.fuse + i * S.stagger; });
 sfx('boss_warning', { x: armed[0].x }); return true;
}
function rteExplode(s) {
 const T = RT(), S = RTE.satchel, p = R.p;
 T.blasts.push({ x: s.x, y: s.y, t: .55, T: .55, seed: Math.random() * 6 });
 ring(s.x, s.y, S.radius, RTE.col, .4, 1); burst(s.x, s.y, RTE.col, 16, 170); R.shake = Math.max(R.shake, 8); sfx('zone_boom', { x: s.x });
 if (Math.hypot(p.x - s.x, p.y - s.y) < S.radius + 6) hurt(S.dmg, s);
}

// --- prism attack (real prism = single targeted beam) + afterimage ---
function rteBeam(x0, y0, ang, o) { // an effectively unlimited-range beam. Only CORRUPTED walls reflect it; any other wall ends it with a ping() starburst.
 const T = RT(), arena = G.cfg.arena, ws = rteWalls(), P = RTE.prism;
 let x = x0, y = y0, a = ang, sx = x0, sy = y0, bounces = 0, len = 0;
 const seg = (ax, ay, bx, by, refl) => {
  const t = refl ? (o.refDur ?? o.dur + P.extra) : o.dur;
  T.seg.push({ x1: ax, y1: ay, x2: bx, y2: by, t, dmg: refl ? P.reflectDmg : o.dmg, w: o.w });
  R.lines.push({ x1: ax, y1: ay, x2: bx, y2: by, l: t, c: RTE.col, w: o.w, laser: 1, core: RTE.hot, rte: 1, refl: refl ? 1 : 0 });
 };
 while (len < 1800) {
  const nx = x + Math.cos(a) * 4, ny = y + Math.sin(a) * 4;
  if (wallHit(arena, nx, ny, 1)) {
   const wi = rteWallAt(nx, ny, 2);
   seg(sx, sy, x, y, bounces > 0);
   R.fx.push({ star: 1, x, y, r: 0, max: o.big ? 21 : 14, l: .26, d: .26, c: '#ff9bf0', seed: Math.random() * 6 }); // ping()-style impact
   if (wi >= 0 && rteIsCorrupt(wi) && bounces < P.bounces) {
    const w = ws[wi];
    const inc = a; a = (x < w[0] || x > w[0] + w[2]) ? Math.PI - a : -a; // mirror off the face that was hit
    if (Math.abs(Math.atan2(Math.sin(a - inc - Math.PI), Math.cos(a - inc - Math.PI))) < .12) a += .16; // head-on hit: skew slightly so the reflection doesn't retrace the incoming beam
    R.fx.push({ star: 1, x, y, r: 0, max: o.big ? 30 : 22, l: .6, d: .6, c: '#ffd6fb', seed: Math.random() * 6 }); // bounce starburst (bigger/longer than a plain impact)
    ring(x, y, 34, RTE.col, .4);
    bounces++; x += Math.cos(a) * 4; y += Math.sin(a) * 4; sx = x; sy = y; len += 4; continue;
   }
   return;
  }
  x = nx; y = ny; len += 4;
 }
 seg(sx, sy, x, y, bounces > 0);
}
function rteStartPrism(e) {
 const T = RT(), p = R.p;
 if (T.pr.length) return false;
 const base = Math.atan2(p.y - e.y, p.x - e.x) + (Math.random() < .5 ? 1 : -1) * Math.PI / 2;
 for (let i = 0; i < 8; i++) {
  const a = base + i * .785, x = e.x + Math.cos(a) * 38, y = e.y + Math.sin(a) * 38;
  if (!wallHit(G.cfg.arena, x, y, 14)) { T.pr.push({ x, y, t: 0, ang: Math.atan2(p.y - y, p.x - x), lock: 0, st: 'charge', fade: 0 }); sfx('race_beam_charge', { x }); return true; }
 }
 return false;
}
function rteZone(e, ph) { // BOUNDS CHECK: a coordinate cross (full-width row + column) that locks onto where you're heading; replaces the plain AoE circles
 const T = RT(), p = R.p;
 for (let i = 0; i < 1 + ph; i++) {
  const x = i ? cl(p.x + ri(200) - 100, 30, W - 30) : cl(p.x + (p.vx || 0) * .35, 30, W - 30), y = i ? cl(p.y + ri(200) - 100, 30, H - 30) : cl(p.y + (p.vy || 0) * .35, 30, H - 30);
  T.hz.push({ kind: 'cross', x, y, t: 1.15 + i * .18, max: 1.15 + i * .18, w: 20, dmg: 15, hit: 0, fl: .22 });
 }
 sfx('zone_warn', { x: p.x });
}
// PHASE 1 - INDEX OUT OF BOUNDS: a full-width bar sweeps the arena; the only safe spot is a gap lined up near where you stand
function rteSweep() {
 const T = RT(), p = R.p, h = Math.random() < .5, dir = Math.random() < .5 ? 1 : -1, len = h ? W : H, gw = 112, th = 22;
 const gapC = cl((h ? p.x : p.y) + (ri(140) - 70), gw / 2 + 12, len - gw / 2 - 12), span = h ? H : W;
 T.sw.push({ h, dir, th, gw, gapC, T: 1.0, tele: 1.0, pos: dir > 0 ? -th : span + th, spd: 215, span, dmg: 15 });
 sfx('zone_warn', { x: p.x });
}
// PHASE 2 - FORK BOMB: a fat triangle that splits into 3, and each of those splits into 3 more
function rteFork(e) {
 const p = R.p, a = Math.atan2(p.y - e.y, p.x - e.x), b = rteBullet(e.x, e.y, a, 170, 8, 6, 'runtime', '#ff9bf0');
 if (!b) return;
 b.fk = 2; b.ft = .85; b.r = 9; b.pw = 1; // fuse bullets fly through walls so they always reach their split ring(e.x, e.y, 26, '#ff9bf0', .3); sfx('boss_aim', { x: e.x });
}
function rteForkSplit(b) {
 const gen = b.fk - 1;
 for (let i = -1; i <= 1; i++) {
  const a = Math.atan2(b.vy, b.vx) + i * .55, c = rteBullet(b.x, b.y, a, gen ? 150 : 200, gen ? 7 : 9, 6, 'runtime', gen ? '#ff9bf0' : RTE.col);
  if (c && gen) { c.fk = gen; c.ft = .75; c.r = 7; c.pw = 1; }
 }
 burst(b.x, b.y, '#ff9bf0', 8, 110); sfx('shield_hit', { x: b.x });
}
// PHASE 3 - KERNEL PANIC: Runtime Error locks in place and three beams spin around it
function rtePanic(e) {
 const T = RT(), p = R.p;
 if (T.pn.length || T.rc) return false;
 T.pn.push({ x: e.x, y: e.y, a0: Math.atan2(p.y - e.y, p.x - e.x), dir: Math.random() < .5 ? 1 : -1, tele: 1.1, T: 1.1, run: 2.6, spin: 0, spd: .95, dmg: 10 });
 e.vuln = Math.max(e.vuln, 3.5); sfx('boss_warning', { x: e.x }); return true;
}
// RE:CALL - she locks in place and snipes: 0.5s of tracking, then an instant hitscan shot; she teleports, shoots again, then follows up
function rteRecall(e, ph) {
 const T = RT();
 if (T.rc || e.tpd || T.pn.length) return false;
 const c = rtePickTp(e, R.p, ph); if (!c) return false;
 e.tpd = { x: c.x, y: c.y, t: 99, walls: c.walls, hold: 1 }; // the teleport telegraph stays up while she shoots first
 T.rc = { st: 'glare', n: 1, t: 0, ang: Math.atan2(R.p.y - e.y, R.p.x - e.x) }; // 1s sniper glare first: this teleport is the RE:CALL one
 e.vuln = Math.max(e.vuln, 1.2); ring(e.x, e.y, 34, '#ff9bf0', .35); sfx('boss_warning', { x: e.x }); return true;
}
function rteRecallStep(boss, ph, dt) {
 const T = R.rt, rc = T.rc, p = R.p, C = RTE.recall;
 rc.t += dt;
 if (rc.st === 'glare') {
  if (!boss.tpd) { T.rc = null; return; }
  rc.ang = Math.atan2(p.y - boss.y, p.x - boss.x);
  if (rc.t >= C.glare) { rc.st = 'aim'; rc.t = 0; sfx('boss_aim', { x: boss.x }); }
 } else if (rc.st === 'aim') {
  if (rc.n === 1 && !boss.tpd) { T.rc = null; return; }
  rc.ang = Math.atan2(p.y - boss.y, p.x - boss.x); // tracks right up to the shot
  if (rc.t >= C.aim) { // fires instantly: no lock delay
   rteBeam(boss.x, boss.y, rc.ang, { dur: C.flash, dmg: C.dmg[ph] ?? C.dmg[2], w: C.w, big: 1, refDur: C.flash });
   ring(boss.x, boss.y, 30, '#fff', .25); burst(boss.x, boss.y, '#ff9bf0', 12, 200); R.shake = Math.max(R.shake, 9); R.flash = Math.max(R.flash, .1); sfx('cast_beam', { x: boss.x }); sfx('boss_aim', { x: boss.x });
   if (rc.n === 1) { boss.tpd.hold = 0; boss.tpd.t = C.after; rc.st = 'tp'; rc.t = 0; }
   else { rc.st = 'tail'; rc.t = 0; rteZone(boss, ph); } // "other stuff": a BOUNDS CHECK follows the second shot
  }
 } else if (rc.st === 'tp') {
  if (!boss.tpd) { rc.n = 2; rc.st = 'aim'; rc.t = 0; rc.ang = Math.atan2(p.y - boss.y, p.x - boss.x); }
 } else if (rc.t > .6) T.rc = null;
}
// NULL REFERENCE - a strong pulse: nulls every card and cripples shield regen
function rteNullStart(e) {
 const T = RT(); if (T.nl.length) return false;
 T.nl.push({ x: e.x, y: e.y, tele: RTE.nul.tele, T: RTE.nul.tele, r: 0, hit: 0 });
 e.vuln = Math.max(e.vuln, 1.5); sfx('boss_warning', { x: e.x }); return true;
}
function rteNullHit(n) {
 const N = RTE.nul;
 for (const c of R.casts) c.dis = Math.max(c.dis || 0, N.cards);
 R.p.shSlow = N.slow; hurt(N.dmg, { x: n.x, y: n.y });
 txt(R.p.x, R.p.y - 28, 'CARDS NULLED ' + N.cards + 's', '#c9a6ff', 11); R.flash = Math.max(R.flash, .15); R.shake = Math.max(R.shake, 6); sfx('leak_frag_hit', { x: R.p.x });
}
function rteAfterImage(x, y) {
 ring(x, y, 22, '#d9b8ff', .35); burst(x, y, '#d9b8ff', 8, 90); sfx('tp_charge', { x });
 RT().af.push({ x, y, t: 0, ang: 0, st: 'live', fade: 0, aim: null });
}

function rteUpdate(dt) {
 const T = R.rt; if (!T) return;
 if (R.sbFreeze) return;
 const p = R.p, arena = G.cfg.arena, boss = R.en.find(e => e.boss && !e.dead && isRTE(e));
 if (R.bossDead || !boss) { // encounter over: no hazard may outlive the boss
  T.cw = []; T.sat = []; T.thr = []; T.pr = []; T.af = []; T.seg = []; T.blasts = []; T.hz = []; T.sw = []; T.pn = []; T.rc = null; T.nl = [];
  R.lines = R.lines.filter(l => !l.rte); return;
 }
 const ph = boss.ph, S = RTE.satchel, P = RTE.prism, A = RTE.after;
 // RE:CALL + NULL REFERENCE
 if (T.rc) rteRecallStep(boss, ph, dt);
 for (const n of T.nl) {
  if (n.tele > 0) { n.tele -= dt; continue; }
  n.r += RTE.nul.speed * dt;
  if (!n.hit && p.inv <= 0 && Math.abs(Math.hypot(p.x - n.x, p.y - n.y) - n.r) < 14) { n.hit = 1; rteNullHit(n); }
 }
 T.nl = T.nl.filter(n => n.r < 520);
 // INDEX OUT OF BOUNDS sweeps
 for (const w of T.sw) {
  if (w.tele > 0) { w.tele -= dt; continue; }
  w.pos += w.dir * w.spd * dt;
  const along = w.h ? p.x : p.y, across = w.h ? p.y : p.x;
  if (p.inv <= 0 && Math.abs(across - w.pos) < w.th / 2 + 7 && !(along > w.gapC - w.gw / 2 + 6 && along < w.gapC + w.gw / 2 - 6)) hurt(w.dmg, w.h ? { x: p.x, y: w.pos } : { x: w.pos, y: p.y });
 }
 T.sw = T.sw.filter(w => w.dir > 0 ? w.pos < w.span + w.th * 2 : w.pos > -w.th * 2);
 // FORK BOMB fuses
 for (const b of R.eb.slice()) if (b.fk > 0 && b.l > 0) { b.ft -= dt; if (b.ft <= 0) { b.l = 0; rteForkSplit(b); } }
 // KERNEL PANIC spinning beams
 for (const n of T.pn) {
  if (n.tele > 0) { n.tele -= dt; continue; }
  n.run -= dt; n.spin += n.dir * n.spd * dt;
  for (let i = 0; i < 3; i++) {
   const an = n.a0 + n.spin + i * Math.PI * 2 / 3, L = rayLen(n.x, n.y, an, 900);
   if (p.inv <= 0 && segDist(p.x, p.y, n.x, n.y, n.x + Math.cos(an) * L, n.y + Math.sin(an) * L) < 11) { hurt(n.dmg, { x: n.x, y: n.y }); break; }
  }
 }
 T.pn = T.pn.filter(n => n.run > 0);
 // BOUNDS CHECK crosses and the teleport-departure diamond (square telegraphs instead of circles)
 for (const h of T.hz) {
  h.t -= dt;
  if (h.t <= 0 && !h.fx) { h.fx = 1; R.shake = Math.max(R.shake, 5); burst(h.x, h.y, RTE.col, 10, 140); sfx('zone_boom', { x: h.x }); }
  if (h.t <= 0 && h.t > -h.fl && !h.hit && p.inv <= 0) {
   const inside = h.kind === 'cross' ? (Math.abs(p.x - h.x) < h.w / 2 + 6 || Math.abs(p.y - h.y) < h.w / 2 + 6) : (Math.abs(p.x - h.x) + Math.abs(p.y - h.y) < h.r * 1.2);
   if (inside) { h.hit = 1; hurt(h.dmg, h); }
  }
 }
 T.hz = T.hz.filter(h => h.t > -h.fl);
 // corrupted walls fire slow prism volleys
 for (const c of T.cw) {
  c.age += dt; c.fire -= dt;
  if (c.fire <= 0) { rteWallFire(c, ph); c.fire = RTE.wall.every[ph] * (.9 + Math.random() * .2); }
 }
 // thrown satchels fly until they hit a wall, then stick
 for (const q of T.thr) {
  q.l -= dt;
  const n = Math.max(1, Math.ceil(Math.hypot(q.vx, q.vy) * dt / 4));
  for (let i = 0; i < n && q.l > 0; i++) {
   q.px = q.x; q.py = q.y; q.x += q.vx * dt / n; q.y += q.vy * dt / n;
   if (wallHit(arena, q.x, q.y, 2)) {
    q.l = 0; const wi = rteWallAt(q.x, q.y, 4);
    if (wi >= 0 && T.sat.length < S.max) { T.sat.push({ x: q.px, y: q.py, wi, st: 'arm', arm: S.arm, fuse: 0, age: 0 }); ring(q.px, q.py, 14, RTE.col, .3); sfx('shield_hit', { x: q.px }); }
    else burst(q.x, q.y, RTE.col, 5, 80);
   }
  }
 }
 T.thr = T.thr.filter(q => q.l > 0);
 // stuck satchels: armed -> (boss detonates, or the Host touches the trapped wall) -> fuse -> blast
 const touched = new Set();
 for (const s of T.sat) {
  s.age += dt;
  if (s.st === 'arm') { s.arm -= dt; const w = rteWalls()[s.wi]; if (s.arm <= 0 && w && p.inv <= 0 && rteRectDist(p.x, p.y, w) < S.touchDist) touched.add(s.wi); }
  else if (s.st === 'fuse') s.fuse -= dt;
 }
 for (const s of T.sat) if (s.st === 'arm' && touched.has(s.wi)) { s.st = 'fuse'; s.fuse = S.touchFuse; sfx('boss_warning', { x: s.x }); }
 for (const s of T.sat) if (s.st === 'fuse' && s.fuse <= 0) { s.st = 'dead'; rteExplode(s); }
 T.sat = T.sat.filter(s => s.st !== 'dead');
 for (const b of T.blasts) b.t -= dt;
 T.blasts = T.blasts.filter(b => b.t > 0);
 // real prism: charge (aim tracks the Host) -> aim locks -> fires once at the locked position
 for (const q of T.pr) {
  q.t += dt;
  if (q.st === 'charge') {
   if (!q.af && q.t >= P.charge * RTE.after.spawnAt) { q.af = 1; rteAfterImage(q.x + Math.cos(q.ang + 1.57) * 26, q.y + Math.sin(q.ang + 1.57) * 26); } // the afterimage splits off mid-telegraph
   if (q.t < P.charge - P.lock) q.ang = Math.atan2(p.y - q.y, p.x - q.x);
   else if (!q.lock) { q.lock = 1; q.ang = Math.atan2(p.y - q.y, p.x - q.x); sfx('boss_aim', { x: q.x }); }
   if (q.t >= P.charge) {
    rteBeam(q.x, q.y, q.ang, { dur: P.beam, dmg: P.dmg, w: P.w, big: 1 });
    R.shake = Math.max(R.shake, 5); sfx('cast_beam', { x: q.x }); sfx('boss_aim', { x: q.x });
    q.st = 'fired'; q.t = 0;
   }
  } else if (q.t > .4) q.fade = 1;
 }
 T.pr = T.pr.filter(q => !q.fade);
 // afterimage: smaller ghost that follows the Host, then fires once at where the Host is heading
 for (const f of T.af) {
  f.t += dt;
  const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy) || 1, s = A.speed * (d > 110 ? 1 : d < 85 ? -.7 : 0);
  if (f.t < A.fireAt) mv(arena, f, dx / d * s * dt, dy / d * s * dt, 6);
  const pt = { x: cl(p.x + (p.vx || 0) * A.lead, 8, W - 8), y: cl(p.y + (p.vy || 0) * A.lead, 8, H - 8) };
  if (f.t >= A.aimAt && f.t < A.fireAt) f.aim = Math.atan2(pt.y - f.y, pt.x - f.x);
  if (f.st === 'live' && f.t >= A.fireAt) {
   const a = Math.atan2(pt.y - f.y, pt.x - f.x); f.aim = a; f.st = 'fired';
   if (A.mode === 'triangles') for (let i = 0; i < A.tri; i++) rteBullet(f.x, f.y, a + (i - (A.tri - 1) / 2) * .16, A.triSpeed, A.triDmg, A.triLife, 'runtime', '#b48cff');
   else rteBeam(f.x, f.y, a, { dur: A.beam, dmg: A.dmg, w: A.w });
   sfx('boss_aim', { x: f.x });
  }
  if (f.t >= A.life) f.fade = 1;
 }
 T.af = T.af.filter(f => !f.fade);
 // beam damage (the main beam is brief; reflected segments stay active for 2s longer)
 for (const g of T.seg) {
  g.t -= dt;
  if (g.t > 0 && p.inv <= 0 && segDist(p.x, p.y, g.x1, g.y1, g.x2, g.y2) < 9 + g.w / 2) hurt(g.dmg, { x: g.x1, y: g.y1 });
 }
 T.seg = T.seg.filter(g => g.t > 0);
}

function drawRuntimeFx(x) {
 const T = R.rt, col = RTE.col, t = R.t; if (!T) return;
 const boss = R.en.find(e => e.boss && isRTE(e) && !e.dead);
 const ws = rteWalls();
 // teleport telegraph: highlight the walls the jump will cut through
 if (boss && boss.tpd && boss.tpd.walls) for (const wi of boss.tpd.walls) {
  const w = ws[wi]; x.save(); x.globalAlpha = .5 + .3 * Math.sin(t * 14); x.strokeStyle = '#eadcff'; x.lineWidth = 2; x.setLineDash([4, 4]); x.strokeRect(w[0] - 2, w[1] - 2, w[2] + 4, w[3] + 4); x.restore();
 }
 // corrupted walls
 for (const c of T.cw) {
  const w = ws[c.wi], warn = c.fire < RTE.wall.warn, pu = .5 + .5 * Math.sin(t * 5 + c.wi);
  x.save();
  x.globalAlpha = .26 + .14 * pu + (warn ? .3 : 0); x.fillStyle = col; x.fillRect(w[0], w[1], w[2], w[3]);
  const sd = Math.floor(t * 9) + c.wi * 7; x.globalAlpha = .75; x.fillStyle = RTE.hot;
  for (let i = 0; i < 4; i++) { const k = Math.sin(sd * (i + 1.7)) * 43758.5; const fr = k - Math.floor(k); x.fillRect(w[0] + fr * Math.max(1, w[2] - 8), w[1] + ((fr * 7.3) % 1) * Math.max(1, w[3] - 3), Math.min(8, w[2]), 2); } // glitch scanlines
  x.globalAlpha = .9; x.strokeStyle = warn ? '#fff' : col; x.lineWidth = 2; x.shadowColor = col; x.shadowBlur = warn ? 14 : 8; x.strokeRect(w[0] + 1, w[1] + 1, w[2] - 2, w[3] - 2);
  x.restore();
 }
 // RE:CALL sniper glare: a spinning star on her and on the landing spot for 1s
 if (T.rc && T.rc.st === 'glare' && boss) {
  const k = cl(T.rc.t / RTE.recall.glare, 0, 1), spin = t * 9, star = (gx, gy, r) => {
   x.save(); x.translate(gx, gy); x.rotate(spin); x.shadowColor = '#fff'; x.shadowBlur = 14;
   for (const [rr, al, off] of [[r, 1, 0], [r * .62, .65, Math.PI / 4]]) { x.save(); x.rotate(off); x.globalAlpha = al; x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 4; i++) { const a0 = i * Math.PI / 2; x.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr); x.lineTo(Math.cos(a0 + Math.PI / 4) * rr * .1, Math.sin(a0 + Math.PI / 4) * rr * .1); } x.closePath(); x.fill(); x.restore(); }
   x.globalAlpha = .9; x.fillStyle = '#ffd6fb'; x.beginPath(); x.arc(0, 0, r * .16, 0, 7); x.fill(); x.restore();
  };
  x.save(); star(boss.x, boss.y, 12 + 26 * Math.min(1, k * 3)); if (boss.tpd) star(boss.tpd.x, boss.tpd.y, 7 + 12 * Math.min(1, k * 3));
  x.globalAlpha = .9; x.fillStyle = '#ffd6fb'; x.font = "700 9px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.fillText('RE:CALL', boss.x, boss.y - boss.r - 22); x.restore();
 }
 // RE:CALL sniper line
 if (T.rc && T.rc.st === 'aim' && boss) {
  const rc = T.rc, L = rayLen(boss.x, boss.y, rc.ang, 1200), k = cl(rc.t / RTE.recall.aim, 0, 1), last = k > .72;
  x.save(); x.lineCap = 'round'; x.shadowColor = '#ff9bf0'; x.shadowBlur = 10;
  x.globalAlpha = .5 + .5 * k; x.strokeStyle = last ? '#fff' : '#ff9bf0'; x.lineWidth = last ? 3 : 1.6; if (!last) { x.setLineDash([10, 6]); x.lineDashOffset = -t * 120; }
  x.beginPath(); x.moveTo(boss.x, boss.y); x.lineTo(boss.x + Math.cos(rc.ang) * L, boss.y + Math.sin(rc.ang) * L); x.stroke(); x.setLineDash([]);
  x.shadowBlur = 0; x.globalAlpha = .9; x.strokeStyle = '#ff9bf0'; x.lineWidth = 2; x.beginPath(); x.arc(R.p.x, R.p.y, 20 - 8 * k, 0, 7); x.stroke(); // reticle closing on the Host
  x.fillStyle = '#ffd6fb'; x.font = "700 9px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.fillText('RE:CALL', boss.x, boss.y - boss.r - 14);
  x.restore();
 }
 // NULL REFERENCE wave
 for (const n of T.nl) {
  x.save();
  if (n.tele > 0) { const k = 1 - n.tele / n.T; x.globalAlpha = .3 + .6 * k; x.strokeStyle = '#c9a6ff'; x.lineWidth = 2; x.setLineDash([6, 6]); x.lineDashOffset = -t * 50; x.beginPath(); x.arc(n.x, n.y, 30 + 120 * k, 0, 7); x.stroke(); x.setLineDash([]); x.fillStyle = '#eadcff'; x.font = "700 9px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.fillText('NULL REFERENCE', n.x, n.y - 36 - 120 * k); }
  else { x.shadowColor = '#c9a6ff'; x.shadowBlur = 14; x.globalAlpha = .9; x.strokeStyle = '#c9a6ff'; x.lineWidth = 8; x.setLineDash([26, 10]); x.lineDashOffset = -t * 90; x.beginPath(); x.arc(n.x, n.y, n.r, 0, 7); x.stroke(); x.setLineDash([]); x.shadowBlur = 0; x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.arc(n.x, n.y, n.r, 0, 7); x.stroke(); }
  x.restore();
 }
 if (R.p.shSlow > 0) { x.save(); x.globalAlpha = .85; x.fillStyle = '#c9a6ff'; x.font = "700 8px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.fillText('SHIELD REGEN -80% ' + Math.ceil(R.p.shSlow) + 's', R.p.x, R.p.y + 24); x.restore(); }
 // INDEX OUT OF BOUNDS bars
 for (const w of T.sw) {
  const live = w.tele <= 0, span = w.h ? W : H, pos = live ? w.pos : (w.dir > 0 ? w.th / 2 : w.span - w.th / 2), g0 = w.gapC - w.gw / 2, g1 = w.gapC + w.gw / 2;
  const seg = (a, b, y, th) => w.h ? x.fillRect(a, y - th / 2, b - a, th) : x.fillRect(y - th / 2, a, th, b - a);
  x.save();
  if (!live) {
   const k = 1 - w.tele / w.T; x.globalAlpha = .15 + .35 * k * (Math.sin(t * 30) > 0 ? 1 : .6); x.fillStyle = col; seg(0, g0, pos, w.th); seg(g1, span, pos, w.th);
   x.globalAlpha = .9; x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath();
   for (const g of [g0, g1]) { if (w.h) { x.moveTo(g, pos - w.th); x.lineTo(g, pos + w.th); } else { x.moveTo(pos - w.th, g); x.lineTo(pos + w.th, g); } }
   x.stroke();
   x.fillStyle = RTE.hot; x.font = "700 8px 'JetBrains Mono',monospace"; x.textAlign = 'center'; if (w.h) x.fillText('INDEX OUT OF BOUNDS', w.gapC, pos + (w.dir > 0 ? w.th + 12 : -w.th - 6)); else x.fillText('OOB', pos + (w.dir > 0 ? w.th + 14 : -w.th - 14), w.gapC);
  } else {
   x.shadowColor = col; x.shadowBlur = 12; x.globalAlpha = .75; x.fillStyle = col; seg(0, g0, pos, w.th); seg(g1, span, pos, w.th);
   x.shadowBlur = 0; x.globalAlpha = .95; x.fillStyle = '#fff'; seg(0, g0, pos, 3); seg(g1, span, pos, 3);
   x.fillStyle = RTE.hot; const sd = Math.floor(t * 12); for (let i = 0; i < 14; i++) { const q = Math.sin(sd * 7.1 + i * 12.9) * 43758.5; const f = q - Math.floor(q); const a = f * span; if (a < g0 - 6 || a > g1) { x.globalAlpha = .6; if (w.h) x.fillRect(a, pos - w.th / 2 + f * w.th, 8, 3); else x.fillRect(pos - w.th / 2 + f * w.th, a, 3, 8); } }
  }
  x.restore();
 }
 // FORK BOMB fuse warning rings
 for (const b of R.eb) if (b.fk > 0 && b.l > 0) { x.save(); x.globalAlpha = .4 + .5 * Math.sin(t * 30 + b.x); x.strokeStyle = '#ff9bf0'; x.lineWidth = 2; x.beginPath(); x.arc(b.x, b.y, 12 + (b.ft < .3 ? (.3 - b.ft) * 40 : 0), 0, 7); x.stroke(); x.restore(); }
 // KERNEL PANIC beams
 for (const n of T.pn) {
  const live = n.tele <= 0; x.save(); x.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
   const an = n.a0 + n.spin + i * Math.PI * 2 / 3, L = rayLen(n.x, n.y, an, 900), ex = n.x + Math.cos(an) * L, ey = n.y + Math.sin(an) * L;
   if (!live) { x.globalAlpha = .35 + .4 * (1 - n.tele / n.T); x.strokeStyle = col; x.lineWidth = 2; x.setLineDash([8, 6]); x.lineDashOffset = -t * 70; x.beginPath(); x.moveTo(n.x, n.y); x.lineTo(ex, ey); x.stroke(); x.setLineDash([]); }
   else { x.shadowColor = col; x.shadowBlur = 14; x.globalAlpha = .85; x.strokeStyle = col; x.lineWidth = 7; x.beginPath(); x.moveTo(n.x, n.y); x.lineTo(ex, ey); x.stroke(); x.shadowBlur = 0; x.globalAlpha = 1; x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke(); }
  }
  x.shadowBlur = 0; x.globalAlpha = live ? .9 : .5; x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.arc(n.x, n.y, 16 + (live ? 0 : (1 - n.tele / n.T) * 8), 0, 7); x.stroke();
  if (!live) { x.fillStyle = RTE.hot; x.globalAlpha = .9; x.font = "700 9px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.fillText('KERNEL PANIC', n.x, n.y - 24); }
  x.restore();
 }
 // BOUNDS CHECK cross + departure diamond
 for (const h of T.hz) {
  const k = 1 - Math.max(0, h.t) / h.max, fired = h.t <= 0, f = Math.max(0, 1 + h.t / h.fl);
  x.save();
  if (h.kind === 'cross') {
   const w = h.w;
   if (!fired) {
    x.globalAlpha = .3 + .5 * k; x.strokeStyle = col; x.lineWidth = 1.5; x.setLineDash([8, 6]); x.lineDashOffset = -t * 60;
    x.beginPath(); x.moveTo(0, h.y); x.lineTo(W, h.y); x.moveTo(h.x, 0); x.lineTo(h.x, H); x.stroke(); x.setLineDash([]);
    x.globalAlpha = .1 + .25 * k; x.fillStyle = col; x.fillRect(0, h.y - w / 2, W, w); x.fillRect(h.x - w / 2, 0, w, H);
    x.globalAlpha = .95; x.strokeStyle = '#fff'; x.lineWidth = 2; x.strokeRect(h.x - 9, h.y - 9, 18, 18);
    x.fillStyle = RTE.hot; x.font = "700 8px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.fillText('[' + Math.round(h.x) + ',' + Math.round(h.y) + ']', h.x, h.y - 14);
   } else {
    x.globalAlpha = f; x.fillStyle = '#fff'; x.fillRect(0, h.y - w / 2, W, w); x.fillRect(h.x - w / 2, 0, w, H);
    x.globalAlpha = f * .7; x.fillStyle = col; x.fillRect(0, h.y - w, W, w * 2); x.fillRect(h.x - w, 0, w * 2, H);
   }
  } else {
   const r = h.r * 1.2; x.translate(h.x, h.y);
   x.beginPath(); x.moveTo(0, -r); x.lineTo(r, 0); x.lineTo(0, r); x.lineTo(-r, 0); x.closePath();
   if (!fired) { x.globalAlpha = .3 + .5 * k; x.strokeStyle = col; x.lineWidth = 2.5; x.stroke(); x.globalAlpha = .12 + .2 * k; x.fillStyle = col; x.fill(); }
   else { x.globalAlpha = f; x.fillStyle = '#fff'; x.fill(); x.strokeStyle = col; x.lineWidth = 3; x.stroke(); }
  }
  x.restore();
 }
 // satchels (thrown + stuck) and blasts
 const diamond = (sx, sy, r, ang) => { x.save(); x.translate(sx, sy); x.rotate(ang); x.beginPath(); x.moveTo(r * 1.5, 0); x.lineTo(0, -r); x.lineTo(-r, 0); x.lineTo(0, r); x.closePath(); x.restore(); };
 for (const q of T.thr) { x.save(); x.globalAlpha = .5; x.strokeStyle = col; x.lineWidth = 3; x.lineCap = 'round'; x.beginPath(); x.moveTo(q.x - q.vx * .06, q.y - q.vy * .06); x.lineTo(q.x, q.y); x.stroke(); x.globalAlpha = 1; x.fillStyle = col; x.strokeStyle = '#fff'; x.lineWidth = 1.6; x.shadowColor = col; x.shadowBlur = 12; diamond(q.x, q.y, 7, t * 12); x.fill(); x.stroke(); x.restore(); }
 for (const s of T.sat) {
  const w = ws[s.wi], out = w ? Math.atan2(s.y - (w[1] + w[3] / 2), s.x - (w[0] + w[2] / 2)) : 0, fuse = s.st === 'fuse';
  const blink = fuse ? (Math.sin(t * 40) > 0) : s.arm > 0 ? .5 : .5 + .5 * Math.sin(t * 4 + s.x);
  x.save();
  if (fuse) { x.globalAlpha = .5; x.strokeStyle = RTE.hot; x.lineWidth = 1.5; x.setLineDash([5, 5]); x.beginPath(); x.arc(s.x, s.y, RTE.satchel.radius, 0, 7); x.stroke(); x.setLineDash([]); } // blast radius telegraph
  x.globalAlpha = s.arm > 0 ? .55 : 1; x.shadowColor = col; x.shadowBlur = fuse ? 14 : 6;
  x.fillStyle = fuse && blink ? '#fff' : '#7a35d6'; x.strokeStyle = fuse ? '#fff' : col; x.lineWidth = 1.6;
  diamond(s.x, s.y, 5.5, out); x.fill(); x.stroke();
  x.fillStyle = fuse ? '#ff9bf0' : RTE.hot; x.globalAlpha = (s.arm > 0 ? .55 : 1) * (.4 + .6 * (typeof blink === 'number' ? blink : 1)); x.beginPath(); x.arc(s.x, s.y, 1.8, 0, 7); x.fill();
  x.restore();
 }
 for (const b of T.blasts) { // prism-shard burst (deliberately not Segfault's bomb look)
  const k = 1 - b.t / b.T, r = RTE.satchel.radius * (.35 + .65 * Math.min(1, k * 2.2));
  x.save(); x.translate(b.x, b.y); x.rotate(b.seed + k * .6); x.globalAlpha = (1 - k) * .9; x.shadowColor = col; x.shadowBlur = 10;
  for (let i = 0; i < 8; i++) { x.save(); x.rotate(i * Math.PI / 4); x.fillStyle = i % 2 ? '#ff9bf0' : col; x.strokeStyle = RTE.hot; x.lineWidth = 1; x.beginPath(); x.moveTo(r, 0); x.lineTo(r * .35, -r * .13); x.lineTo(r * .12, 0); x.lineTo(r * .35, r * .13); x.closePath(); x.fill(); x.stroke(); x.restore(); }
  x.restore();
 }
 // prism telegraph + the elongated pink/purple prism itself
 const prismShape = (len, hw) => { x.beginPath(); x.moveTo(len, 0); x.lineTo(len * .2, -hw); x.lineTo(-len * .72, -hw * .72); x.lineTo(-len * .85, 0); x.lineTo(-len * .72, hw * .72); x.lineTo(len * .2, hw); x.closePath(); };
 for (const q of T.pr) {
  if (q.st === 'charge') {
   const L = rayLen(q.x, q.y, q.ang, 900);
   x.save(); x.globalAlpha = q.lock ? .85 : .3 + .2 * Math.sin(t * 20); x.strokeStyle = q.lock ? '#ffd6fb' : col; x.lineWidth = q.lock ? 1.6 : 1; if (!q.lock) x.setLineDash([6, 6]);
   x.beginPath(); x.moveTo(q.x, q.y); x.lineTo(q.x + Math.cos(q.ang) * L, q.y + Math.sin(q.ang) * L); x.stroke(); x.restore();
  }
  x.save(); x.translate(q.x, q.y); x.rotate(q.ang); x.globalAlpha = q.st === 'fired' ? Math.max(0, 1 - q.t * 2.5) : Math.min(1, q.t * 4);
  const g = x.createLinearGradient(-26, -8, 30, 8); g.addColorStop(0, '#7a35d6'); g.addColorStop(.5, '#d77bff'); g.addColorStop(1, '#ff9bf0');
  x.shadowColor = col; x.shadowBlur = 14; x.fillStyle = g; x.strokeStyle = '#f6e6ff'; x.lineWidth = 1.6; prismShape(30, 8); x.fill(); x.stroke();
  x.shadowBlur = 0; x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.moveTo(30, 0); x.lineTo(6, -6); x.lineTo(-18, -4); x.lineTo(-8, 0); x.closePath(); x.fill(); // shiny upper facet
  x.restore();
 }
 // afterimage: smaller, translucent, own targeting line (leads the Host's movement)
 for (const f of T.af) {
  if (f.aim != null && f.t >= RTE.after.aimAt && f.st === 'live') {
   x.save(); x.globalAlpha = .25 + .25 * Math.sin(t * 26); x.strokeStyle = '#d9b8ff'; x.lineWidth = 1; x.setLineDash([3, 5]);
   x.beginPath(); x.moveTo(f.x, f.y); x.lineTo(f.x + Math.cos(f.aim) * 320, f.y + Math.sin(f.aim) * 320); x.stroke(); x.restore();
  }
  const fade = Math.min(1, f.t * 3) * Math.min(1, (RTE.after.life - f.t) * 3);
  x.save(); x.translate(f.x, f.y); x.rotate(f.aim ?? Math.atan2(R.p.y - f.y, R.p.x - f.x)); x.globalAlpha = .5 * fade * (.8 + .2 * Math.sin(t * 18));
  x.fillStyle = '#b48cff'; x.strokeStyle = '#e6d6ff'; x.lineWidth = 1; x.shadowColor = '#b48cff'; x.shadowBlur = 8; prismShape(14, 4); x.fill(); x.stroke(); x.restore();
 }
}

function bossAI(e, dt, d) {
 if (R.sandbox && R.sbFreeze) return;
 if (e.bd0.race) { raceAI(e, dt, d); return; }
 PW = e.bd0.grow ? 1 : 0;
 const b = e.bd0, f = e.hp / e.max, ph = f < .33 ? 2 : f < .66 ? 1 : 0;
 if (e.tpd) {
  if (!e.tpd.hold) e.tpd.t -= dt;
  let land = false;
  if (isRTE(e)) { // she vanishes for a moment between the two points and cannot be hurt (i-frames)
   if (e.tpd.go) { e.tpd.tr -= dt; land = e.tpd.tr <= 0; }
   else if (e.tpd.t <= 0) { e.tpd.go = 1; e.tpd.tr = RTE.transit; e.inv = 1; ring(e.x, e.y, 30, b.c, .3); burst(e.x, e.y, b.c, 10, 140); sfx('tp_charge', { x: e.x }); }
  } else land = e.tpd.t <= 0;
  if (land) {
   ring(e.x, e.y, 30, b.c, .3);
   e.x = e.tpd.x; e.y = e.tpd.y;
   ring(e.x, e.y, 54, b.c, .3); sfx('tp_land', { x: e.x });
   if (isRTE(e)) RT().hz.push({ kind: 'diamond', x: e.x, y: e.y, t: .3, max: .3, r: 54, dmg: 12, hit: 0, fl: .2 }); else R.tg.push({ x: e.x, y: e.y, r: 54, t: .3, max: .3, dmg: 14, own: 'e', c: b.c });
   burst(e.x, e.y, b.c, 14, 160);
   if (isRTE(e) && e.tpd.walls && e.tpd.walls.length) rteCorrupt(e.tpd.walls[0], ph); // the jump corrupted the first wall it cut through
   if (isRTE(e)) e.inv = 0;
   e.vuln = 2.2; e.tpd = null;
  }
 }
 if (ph !== e.ph) {
  e.ph = ph; e.vuln = 2.2; R.eb = []; R.shake = 14;
  if (b.n !== 'SEGMENT FAULT') R.banner = { t: 1.8, s: 'PHASE ' + (ph + 1) + ': EXPOSED' };
  sfx('boss_phase');
 }
 if (b.n === 'SEGMENT FAULT') segfaultThink(e, dt, ph, d);
 if (b.grow) { e.gt += dt; R.emul = 1 + Math.min(.5, e.gt * .008); }
 const gm = b.grow ? 1 + Math.min(.8, e.gt * .01) : 1, pat = b.ph[ph];
 if (R.leak) R.leak.gm = gm;
 const rcLock = isRTE(e) && R.rt && R.rt.rc; // RE:CALL: she is locked in place, every other timer holds
 for (const k in pat) {
  if (rcLock) continue;
  e.pt[k] = (e.pt[k] ?? pat[k]) - dt;
  if (e.pt[k] > 0) continue;
  e.pt[k] = pat[k];
  const p = R.p;
  if (b.n === 'SEGMENT FAULT' && (k === 'ring' || k === 'aim')) {
   const angle = Math.atan2(p.y - e.y, p.x - e.x);
   const delay = SEGFAULT.volleyTelegraph;
   segSchedule('volley', delay, {
    pattern: k, count: 10 + ph * 3, angle: k === 'ring' ? Math.random() * Math.PI * 2 : angle,
    speed: k === 'ring' ? 105 * gm : 150 * gm, damage: k === 'ring' ? Math.round(7 * gm) : Math.round(8 * gm), color: b.c
   });
   sfx('boss_warning', { x: e.x });
   continue;
  }
  if (b.army && (k === 'ring' || k === 'aim')) { // Memory Leak: keep ring/aim volleys apart so overlapping volleys can't remove every dodge route
   const wait = LEAK.density.volleyGap - (R.t - (e.lastVol ?? -9));
   if (wait > 0) { e.pt[k] = wait + .05; continue; }
   e.lastVol = R.t;
  }
  if (k === 'ring') {
   const n = b.army ? Math.max(6, Math.round((10 + ph * 3) * LEAK.density.ring)) : isRTE(e) ? 7 + ph : 10 + ph * 3, o = Math.random() * 6.3;
   sfx('boss_ring', { x: e.x });
   for (let i = 0; i < n; i++) ebul(e.x, e.y, o + i * 6.283 / n, isRTE(e) ? 125 : 105 * gm, isRTE(e) ? 10 : Math.round(7 * gm), // Runtime Error: fewer, harder rings
     b.c, e.bd0.n === 'THE MEMORY LEAK' ? 'leak' : e.bd0.n === 'SEGMENT FAULT' ? 'segfault' : 'runtime');
  } else if (k === 'aim') {
   const a = Math.atan2(p.y - e.y, p.x - e.x);
   sfx('boss_aim', { x: e.x });
   const rt = isRTE(e), cnt = rt ? RTE.aim.n : 3, spr = rt ? RTE.aim.spread : .22, asp = rt ? SPELLS.fireball.sp : 150 * gm; // Runtime Error: fireball speed, tight burst
   for (let i = 0; i < cnt; i++) ebul(e.x, e.y, a + (i - (cnt - 1) / 2) * spr, asp, rt ? 10 : Math.round(8 * gm), b.c, e.bd0.n === 'THE MEMORY LEAK' ? 'leak' : e.bd0.n === 'SEGMENT FAULT' ? 'segfault' : 'runtime');
  } else if (k === 'zone' && isRTE(e)) {
   rteZone(e, ph); e.vuln = Math.max(e.vuln, 1.6);
  } else if (k === 'recall' && isRTE(e)) {
   if (!rteRecall(e, ph)) e.pt[k] = 1.5;
  } else if (k === 'nullp' && isRTE(e)) {
   if (!rteNullStart(e)) e.pt[k] = 1.5;
  } else if (k === 'sweep' && isRTE(e)) {
   rteSweep();
  } else if (k === 'fork' && isRTE(e)) {
   rteFork(e);
  } else if (k === 'panic' && isRTE(e)) {
   if (!rtePanic(e)) e.pt[k] = 1.5;
  } else if (k === 'satchel' && isRTE(e)) {
   if (!rteThrow(e)) e.pt[k] = 1.5;
  } else if (k === 'det' && isRTE(e)) {
   if (!rteDetonate()) e.pt[k] = 1.5;
  } else if (k === 'prism' && isRTE(e)) {
   if (!rteStartPrism(e)) e.pt[k] = 1.5;
  } else if (k === 'zone' && b.n === 'SEGMENT FAULT') {
   segScheduleAirstrike(e, ph, p);
   e.vuln = Math.max(e.vuln, 1.6);
  } else if (k === 'zone') {
   for (let i = 0; i < 1 + ph; i++) {
    const x = i ? cl(p.x + ri(160) - 80, 40, W - 40) : p.x, y = i ? cl(p.y + ri(160) - 80, 40, H - 40) : p.y;
    R.tg.push({ x, y, r: 58, t: 1.1, max: 1.1, dmg: 15, own: 'e', c: b.c });
   }
   e.vuln = Math.max(e.vuln, 1.6); sfx('zone_warn', { x: p.x });
  } else if (k === 'summon') {
   if (b.army) { necropost(e, pat); } else {
   sfx('enemy_summon', { x: e.x });
   if (R.en.length < 22) for (let i = 0; i < 3; i++) spawnE(i ? 'swarm' : 'chaser', e.x + ri(40) - 20, e.y + ri(40) - 20);
   }
  } else if (k === 'dump') {
   coreSacrifice(e);
  } else if (k === 'tp' && !e.tpd && isRTE(e) && R.rt && R.rt.pn.length) {
   e.pt[k] = .8; // holds still while KERNEL PANIC spins
  } else if (k === 'tp' && !e.tpd && isRTE(e)) {
   const c = rtePickTp(e, p, ph);
   if (c) { e.tpd = { x: c.x, y: c.y, t: .9, walls: c.walls }; ring(e.x, e.y, 30, b.c, .3); sfx('tp_charge', { x: e.x }); }
  } else if (k === 'tp' && !e.tpd) {
   const dist = e.hp / e.max > .35 ? 85 : 170;
   for (let i = 0; i < 16; i++) {
    const a = Math.random() * 6.3, x = p.x + Math.cos(a) * dist, y = p.y + Math.sin(a) * dist;
    if (!wallHit(G.cfg.arena, x, y, e.r + 4) && !hazAt(G.cfg.arena, x, y)) {
     e.tpd = { x, y, t: .9 };
     ring(e.x, e.y, 30, b.c, .3);
     sfx('tp_charge', { x: e.x });
     break;
    }
   }
  }
 }
 PW = 0;
}


// ===== THE RACE CONDITION (sector 3 boss): two competing attack processes, a mutex lock, a tether, then a split / thread merge =====
// AoE 1  ALTERNATING WRITES: a checkerboard of squares. Red squares pop on beat 1, blue squares on beat 2. Step onto the other colour between beats.
// AoE 2  STACK TRACE: every red dash leaves numbered frames along its lane that detonate in order, racing away from the dash start.
// Sniper: a genuine precision BEAM (targeting line, aim locks shortly before firing). It is a raycast, not a projectile, so Orbit blades can never block it.
const rrange = a => a[0] + Math.random() * (a[1] - a[0]);
function rProc(kind) {
 const C = kind === 'red' ? RACE.dash : RACE.shoot;
 return { kind, st: 0, cd: rrange(C.cd) * (kind === 'blue' ? 1.15 : 1), t: 0, T: 1, L: .3, ang: 0, lock: false, variant: 0, last: -1 };
}
const isP1 = e => e.twin === 'merged';
const cdMul = e => (isP1(e) ? RACE.p1.cd : RACE.twinCd) * (e.merged ? RACE.merge.cd : 1);
const gapOf = e => isP1(e) ? RACE.p1.gap : RACE.gap;
function leadPos() {
 const p = R.p, v = R.race.v || { x: 0, y: 0 };
 return { x: cl(p.x + v.x * RACE.lead, 20, W - 20), y: cl(p.y + v.y * RACE.lead, 20, H - 20) };
}
function segDist(px, py, ax, ay, bx, by) {
 const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = cl(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
 return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
// distance a straight ray travels from (x,y) before it hits a wall (shared by the sniper beam and its targeting line)
function rayLen(x, y, an, max = 900) {
 const ca = Math.cos(an), sa = Math.sin(an), arena = G.cfg.arena;
 let L = 0;
 while (L < max && !wallHit(arena, x + ca * L, y + sa * L, 2)) L += 6;
 return L;
}
const orbitUp = () => { const o = R.p.orb; return !!(o && o.bl && o.bl.some(b => !b.dead)); };

// --- AoE 1: ALTERNATING WRITES ---
function startGrid(e, still) {
 const C = RACE.grid, S = C.cell, p = R.p, arena = G.cfg.arena, tp = still ? { x: p.x, y: p.y } : leadPos();
 const cx = cl(tp.x, S, W - S), cy = cl(tp.y, S, H - S), cells = [];
 for (let i = -C.span; i <= C.span; i++) for (let j = -C.span; j <= C.span; j++) {
  const x = cx + i * S, y = cy + j * S;
  if (x < 10 || y < 10 || x > W - 10 || y > H - 10 || wallHit(arena, x, y, 0)) continue;
  const par = (Math.abs(i + j)) % 2;
  cells.push({ x, y, par, col: par ? RACE.blue : RACE.red, dmg: C.dmg, pad: 0, pop: 0 });
 }
 const tele = C.tele * (still ? .75 : 1);
 R.race.cb = { cells, t: 0, tele, beat: C.beat, wave: 0, own: e.twin, coll: 0 };
 R.race.lastRes = Math.max(R.race.lastRes, R.t + tele + C.beat);
 sfx('zone_warn', { x: cx });
}
function popGrid(cb, par) {
 const C = RACE.grid, p = R.p;
 let hit = 0;
 for (const c of cb.cells) if (c.par === par) {
  c.pop = .3;
  R.fx.push({ sq: 1, x: c.x, y: c.y, r: 0, max: C.cell / 2 + c.pad, l: .34, d: .34, c: c.col });
  burst(c.x, c.y, c.col, 2, 90);
  const hs = C.cell / 2 + c.pad + 3;
  if (!hit && Math.abs(p.x - c.x) < hs && Math.abs(p.y - c.y) < hs) { hit = 1; hurt(c.dmg, { x: c.x, y: c.y }); }
 }
 R.shake = Math.max(R.shake, 5);
 sfx(par ? 'race_check_b' : 'race_check_a', { x: p.x });
}
function updGrid(dt) {
 const cb = R.race.cb;
 if (!cb) return;
 cb.t += dt;
 for (const c of cb.cells) if (c.pop > 0) c.pop -= dt;
 if (cb.wave === 0 && cb.t >= cb.tele) { cb.wave = 1; popGrid(cb, 0); }
 else if (cb.wave === 1 && cb.t >= cb.tele + cb.beat) { cb.wave = 2; popGrid(cb, 1); }
 else if (cb.wave === 2 && cb.t >= cb.tele + cb.beat + .4) R.race.cb = null;
}

// --- AoE 2: STACK TRACE ---
function startStack(e) {
 const C = RACE.stack, arena = G.cfg.arena, dx = e.dash.dx, dy = e.dash.dy, nodes = [];
 for (let i = 0; i < C.n; i++) {
  const d = (i + .5) * C.step, x = e.x + dx * d, y = e.y + dy * d;
  if (x < 14 || y < 14 || x > W - 14 || y > H - 14 || wallHit(arena, x, y, 2)) break; // the trace ends at walls
  nodes.push({ x, y, i, t: C.delay + i * C.fuse, T: C.delay + i * C.fuse, r: C.r, dmg: C.dmg, col: i % 2 ? RACE.blue : RACE.red, own2: e.twin });
 }
 if (!nodes.length) return;
 R.race.stk = (R.race.stk || []).concat(nodes);
 R.race.lastRes = Math.max(R.race.lastRes, R.t + C.delay + nodes.length * C.fuse);
 sfx('race_stack_tick', { x: e.x });
}
function updStack(dt) {
 const st = R.race.stk;
 if (!st || !st.length) return;
 const p = R.p;
 for (const n of st) {
  n.t -= dt;
  if (n.done || n.t > 0) continue;
  n.done = 1;
  ring(n.x, n.y, n.r, n.col, .3, 1); burst(n.x, n.y, n.col, 5, 120);
  R.shake = Math.max(R.shake, 3);
  sfx('race_stack_boom', { x: n.x });
  if (!R.end && Math.hypot(p.x - n.x, p.y - n.y) < n.r + 6) hurt(n.dmg, n);
 }
 R.race.stk = st.filter(n => !n.done);
 if (!R.race.stk.length && R.race.merged !== 2) coordinate('red');
}
// Phase 1 coordination: when one process finishes a pattern the other follows up quickly.
function coordinate(from) {
 const b = R.en.find(x => x.race && x.twin === 'merged' && !x.dead);
 if (!b || !b.rp) return;
 const o = b.rp[from === 'red' ? 'blue' : 'red'];
 if (o && o.st === 0) o.cd = Math.min(o.cd, .3);
}
function raceCollideAt(x, y, r) {
 const cb = R.race.cb;
 if (!cb) return;
 const S = RACE.grid.cell;
 for (const c of cb.cells) {
  if (c.hot || c.pop > 0 || (cb.wave === 1 && c.par === 0) || cb.wave === 2) continue;
  if (Math.abs(x - c.x) < S / 2 + r && Math.abs(y - c.y) < S / 2 + r) {
   c.hot = 1; c.pad = 9; c.dmg *= RACE.collide.dmg; c.col = '#c77dff';
   burst(c.x, c.y, '#c77dff', 5, 110);
   if (!cb.coll++) { txt(c.x, c.y - S / 2, 'COLLISION', '#e0b3ff', 11); sfx('race_check_b', { x: c.x }); }
  }
 }
}
function shatterLock(L, e) {
 L.state = 'broken'; L.cd = RACE.mutex.cd; L.broke = e;
 burst(e.x, e.y, '#9fe8ff', 22, 230); ring(e.x, e.y, 30, '#9fe8ff', .4);
 txt(e.x, e.y - e.r - 8, 'LOCK SHATTERED', '#9fe8ff', 13); R.shake = 8; sfx('shatter', { x: e.x });
}
// Runs once per frame: player velocity (for lead aim), AoE updates, tether, mutex lock timers.
function raceGlobal(dt) {
 const r0 = R.race, p = R.p;
 if (r0.pp && dt > 0) {
  let vx = (p.x - r0.pp.x) / dt, vy = (p.y - r0.pp.y) / dt;
  const m = Math.hypot(vx, vy); if (m > 380) { vx *= 380 / m; vy *= 380 / m; }
  r0.v = { x: (r0.v ? r0.v.x : 0) * .7 + vx * .3, y: (r0.v ? r0.v.y : 0) * .7 + vy * .3 };
 }
 r0.pp = { x: p.x, y: p.y };
 // standing still (or leaning on Orbit) is what Phase 1 punishes
 const spd = r0.v ? Math.hypot(r0.v.x, r0.v.y) : 99;
 r0.still = spd < 24 && p.dash <= 0 ? (r0.still || 0) + dt : Math.max(0, (r0.still || 0) - dt * 2.5);
 updGrid(dt); updStack(dt);
 if (!r0.split) return;
 const a = r0.red, b = r0.blue, both = a && b && !a.dead && !b.dead;
 if (!both) { r0.lock = null; return; }
 r0.tetherT = Math.max(0, (r0.tetherT == null ? RACE.tether.arm : r0.tetherT) - dt);
 if (r0.tetherT <= 0 && !a.dash && !b.dash && !R.end && R.t - (r0.tcd || -9) > RACE.tether.cd && segDist(p.x, p.y, a.x, a.y, b.x, b.y) < 9 + RACE.tether.w + 2) {
  hurt(RACE.tether.dmg, a); r0.tcd = R.t; sfx('race_tether', { x: p.x });
 }
 const L = r0.lock;
 if (!L) return;
 if (L.state === 'active') {
  L.t -= dt;
  if (L.t <= 0) { L.from = L.holder; L.holder = L.holder === a ? b : a; L.state = 'transit'; L.tr = RACE.mutex.transit; L.t = RACE.mutex.handover; sfx('race_lock_form', { x: L.holder.x }); }
 } else if (L.state === 'transit') {
  L.tr -= dt; if (L.tr <= 0) L.state = 'active';
 } else if (L.state === 'broken') {
  L.cd -= dt;
  if (L.cd <= 0) {
   // re-forms stronger, on the twin that wasn't hit last
   L.lvl++; L.max = Math.round(L.base * Math.pow(RACE.mutex.grow, L.lvl)); L.dur = L.max;
   L.holder = r0.lastHit === 'red' ? b : a; L.state = 'active'; L.t = RACE.mutex.handover;
   ring(L.holder.x, L.holder.y, 28, '#9fe8ff', .4); sfx('race_lock_form', { x: L.holder.x });
  }
 }
}
function raceAI(e, dt, d) {
 if (R.race && R.race.tick !== R.t) { R.race.tick = R.t; raceGlobal(dt); }
 if (e.splitT > 0) {
  // mitosis: boss is frozen and protected until the animation ends
  e.splitT -= dt; e.dash = null;
  if (e.splitT <= 0) finishSplit(e);
  return;
 }
 if (e.twin === 'merged' && e.hp <= e.max * RACE.splitAt) { e.hp = Math.max(1, e.hp); startSplit(e); return; }
 if (R.end || !e.rp) return;
 for (const k in e.rp) raceProc(e, e.rp[k], dt);
}
// Precision beam: instant raycast along the locked aim line. NOT an enemy bullet, so Orbit blades (and Orbit's zap) can never intercept it.
function fireSnipe(e, pr) {
 const C = RACE.snipe, p = R.p, ca = Math.cos(pr.ang), sa = Math.sin(pr.ang), L = rayLen(e.x, e.y, pr.ang, 900);
 const hx = e.x + ca * L, hy = e.y + sa * L;
 R.lines.push({ x1: e.x + ca * (e.r + 2), y1: e.y + sa * (e.r + 2), x2: hx, y2: hy, l: C.life, c: RACE.blue, w: C.w, laser: 1, core: '#eaf3ff' });
 R.fx.push({ star: 1, x: hx, y: hy, r: 0, max: 20, l: .28, d: .28, c: RACE.blue, seed: Math.random() * 6 });
 burst(hx, hy, RACE.blue, 8, 130); burst(e.x, e.y, RACE.blue, 6, 160);
 R.shake = Math.max(R.shake, 4);
 sfx('race_beam_fire', { x: e.x });
 if (!R.end && p.inv <= 0 && segDist(p.x, p.y, e.x, e.y, hx, hy) < C.w / 2 + 6) hurt(C.dmg, e);
}
function raceProc(e, pr, dt) {
 const red = pr.kind === 'red', C = red ? RACE.dash : RACE.shoot, p = R.p, P1 = isP1(e);
 if (pr.vol) { // BURST STREAM: three tight volleys, each re-aimed at where you're heading
  pr.vol.t -= dt;
  if (pr.vol.t <= 0) {
   const B = RACE.shoot.burst, lp = leadPos(), a = Math.atan2(lp.y - e.y, lp.x - e.x);
   for (let i = -1; i <= 1; i++) { ebul(e.x, e.y, a + i * B.spread, B.sp, B.dmg, RACE.blue, 'hex'); R.eb[R.eb.length - 1].own = e.twin; }
   sfx('boss_aim', { x: e.x }); pr.vol.n--; pr.vol.t = B.gap; if (pr.vol.n <= 0) pr.vol = null;
  }
 }
 const still = P1 && (R.race.still || 0) > RACE.p1.still;
 if (pr.st === 0) {
  pr.cd -= dt * (still ? 1.8 : 1);
  if (pr.cd > 0) return;
  pr.st = 1; pr.lock = false;
  if (red) {
   // red hunts: it goes for where you ARE
   pr.T = C.tele * (still ? .72 : 1); pr.L = C.lock; pr.ang = Math.atan2(p.y - e.y, p.x - e.x);
   sfx('race_dash_tele', { x: e.x });
   if (still) txt(p.x, p.y - 28, 'STATIONARY', '#ff8a95', 11);
  } else {
   // blue zones: it aims where you're HEADING. Variants: 0 alternating writes (checkerboard AoE), 1 shotgun spread, 2 precision beam
   const up = P1 && orbitUp(), opts = [0, 1, 2, 3].filter(v => v !== pr.last);
   pr.variant = pr.want != null ? pr.want : opts[Math.floor(Math.random() * opts.length)];
   if (pr.want == null && up && Math.random() < RACE.p1.orbit) pr.variant = 2; // leaning on Orbit gets you sniped: the beam ignores blades
   if ((pr.variant === 2 || pr.variant === 0) && R.t - R.race.lastRes < gapOf(e)) { pr.want = pr.variant; pr.st = 0; pr.cd = .2; return; } // big moves keep their place in line until there's a clear window
   pr.want = null; pr.last = pr.variant;
   const lp = still ? { x: p.x, y: p.y } : leadPos(); pr.ang = Math.atan2(lp.y - e.y, lp.x - e.x);
   if (pr.variant === 2) { pr.T = RACE.snipe.tele * (up ? .8 : 1); pr.L = RACE.snipe.lock; sfx('race_beam_charge', { x: e.x }); }
   else if (pr.variant === 0) { startGrid(e, still); pr.T = R.race.cb ? R.race.cb.tele + R.race.cb.beat + .4 : 1; pr.L = 0; }
   else { pr.T = C.tele; pr.L = C.lock; sfx('enemy_dash_tele', { x: e.x }); }
  }
  pr.t = pr.T;
 } else if (pr.st === 1) {
  pr.t -= dt;
  if (!red && pr.variant === 0) {
   // the checkerboard is its own telegraph; this process stays busy until both beats have landed
   if (pr.t <= 0) { pr.st = 0; pr.cd = rrange(C.cd) * cdMul(e); R.race.lastRes = Math.max(R.race.lastRes, R.t); if (P1) coordinate('blue'); }
   return;
  }
  if (pr.t > pr.L) { const tp = red ? p : (still ? p : leadPos()); pr.ang = Math.atan2(tp.y - e.y, tp.x - e.x); } // aim tracks, then locks for the final moment
  else { if (!pr.lock && !red && pr.variant === 2) sfx('race_beam_lock', { x: e.x }); pr.lock = true; }
  if (pr.t > 0) return;
  // order rule: two damaging moments never land closer than the gap apart, so there's always a reaction window
  if (!(!red && pr.variant === 2) && R.t - R.race.lastRes < gapOf(e)) { pr.t = .05; return; }
  R.race.lastRes = Math.max(R.race.lastRes, R.t);
  if (red) {
   e.dash = { dx: Math.cos(pr.ang), dy: Math.sin(pr.ang), sp: C.sp };
   pr.st = 2; pr.t = C.t;
   for (let s = 0; s <= C.sp * C.t; s += 24) raceCollideAt(e.x + e.dash.dx * s, e.y + e.dash.dy * s, e.r);
   burst(e.x, e.y, RACE.red, 10, 140); sfx('race_dash', { x: e.x });
   startStack(e);
  } else {
   if (pr.variant === 3) { pr.vol = { n: 3, t: 0 }; }
   else if (pr.variant === 1) {
    for (let i = 0; i < C.n; i++) { ebul(e.x, e.y, pr.ang + (i - (C.n - 1) / 2) * C.spread, C.sp, C.dmg, RACE.blue, 'hex'); R.eb[R.eb.length - 1].own = e.twin; }
    sfx('boss_aim', { x: e.x });
   } else fireSnipe(e, pr);
   pr.st = 0; pr.cd = rrange(C.cd) * cdMul(e);
  }
 } else if (pr.st === 2) {
  pr.t -= dt;
  raceCollideAt(e.x, e.y, e.r);
  if (pr.t <= 0) {
   e.dash = null; R.race.lastRes = Math.max(R.race.lastRes, R.t);
   // Phase 1: sometimes it doubles back immediately (shorter tell, same rules)
   if (P1 && !pr.echo && Math.random() < RACE.p1.echo && Math.hypot(p.x - e.x, p.y - e.y) < 280) {
    pr.echo = 1; pr.st = 1; pr.lock = false; pr.T = .5; pr.L = .2; pr.t = .5; pr.ang = Math.atan2(p.y - e.y, p.x - e.x);
    sfx('race_dash_tele', { x: e.x }); txt(e.x, e.y - e.r - 10, 'RE-DISPATCH', '#ff8a95', 11);
    return;
   }
   pr.echo = 0; pr.st = 0; pr.cd = rrange(C.cd) * cdMul(e);
  }
 }
}
function raceMove(e, ux, uy, d, sp) {
 if (e.splitT > 0) return [0, 0, 0];
 if (e.dash) return [e.dash.dx, e.dash.dy, e.dash.sp];
 if (isP1(e)) sp *= RACE.p1.sp; // Phase 1 is faster and keeps closing in
 let slow = 1;
 if (e.rp) for (const k in e.rp) if (e.rp[k].st === 1 && !(k === 'blue' && e.rp[k].variant === 0)) slow = .25; // planting its feet while winding up
 if (e.twin === 'blue') {
  e.sg = e.sg || 1; if (Math.sin(R.t * .7 + e.x) > .98) e.sg = -e.sg;
  if (d < 150) return [-ux, -uy, sp * slow];
  if (d > 235) return [ux, uy, sp * .8 * slow];
  return [-uy * e.sg, ux * e.sg, sp * .7 * slow];
 }
 if (d < 110 && !(isP1(e) && (R.race.still || 0) > RACE.p1.still)) return [-uy, ux, sp * .6 * slow];
 return [ux, uy, sp * slow];
}
function startSplit(e) {
 e.splitT = RACE.splitTime; e.inv = 99; e.burn = 0; e.dash = null; e.rp = null;
 R.eb = []; R.tg = R.tg.filter(z => !z.own2); R.race.cb = null; R.race.stk = [];
 R.shake = 10; R.flash = .3;
 R.banner = { t: 1.8, s: 'PROCESS FORK: RACE CONDITION SPLITS' };
 sfx('race_split');
 ring(e.x, e.y, 24, '#ffffff', .5);
}
function finishSplit(e) {
 const hp2 = Math.max(1, Math.round((e.max0 || e.max) * RACE.twinHp));
 const arena = G.cfg.arena, D = 38;
 let bx = e.x + D, rx = e.x - D;
 if (wallHit(arena, bx, e.y, e.r)) bx = e.x;
 if (wallHit(arena, rx, e.y, e.r)) rx = e.x;
 Object.assign(e, { twin: 'red', c: RACE.red, hp: hp2, max: hp2, inv: 0, splitT: 0, x: rx, sp: 46, rp: { red: rProc('red') }, dash: null });
 e.rp.red.cd = 1.2;
 const b = spawnE('chaser', bx, e.y);
 Object.assign(b, { boss: 1, g: e.g, c: RACE.blue, hp: hp2, max: hp2, sp: 38, r: e.r, dmg: 14, ph: 0, pt: {}, beh: 'boss', bd0: e.bd0, gt: 0, projShape: 'race', race: 1, twin: 'blue', inv: 0, rp: { blue: rProc('blue') }, tm: 9 });
 b.rp.blue.cd = 1.8;
 R.race.red = e; R.race.blue = b; R.race.split = 1; R.race.lastRes = R.t; R.race.tetherT = RACE.tether.arm;
 const base = Math.round(hp2 * RACE.mutex.dur);
 R.race.lock = { holder: Math.random() < .5 ? e : b, base, max: base, dur: base, lvl: 0, t: RACE.mutex.handover, cd: 0, state: 'active', tr: 0, from: null };
 R.banner = { t: 1.8, s: 'BREAK THE LOCK, DEFEAT BOTH HOSTS' };
 burst(e.x, e.y, RACE.red, 18, 200); burst(b.x, b.y, RACE.blue, 18, 200);
 ring(e.x, e.y, 40, RACE.red, .4); ring(b.x, b.y, 40, RACE.blue, .4);
 sfx('race_lock_form');
}

// ===== THE MEMORY LEAK: evolving corrupted army (Fragment -> Shard -> Core), Main Core, squads, NECROPOST / CORE DUMP, unique healer PRISM =====
const armyList = () => R.en.filter(u => u.army && !u.prism && !u.dead);
const ordN = () => armyList().filter(u => !u.lead && u.army !== 'core').length;   // ordinary Fragments + Shards (cap LEAK.cap)
const coreN = () => armyList().filter(u => !u.lead && u.army === 'core').length;  // ordinary Cores (cap LEAK.coreCap)
const bossBounds = (x, y, an) => {
 const ca = Math.cos(an), sa = Math.sin(an);
 let t = 1e9;
 if (ca > 1e-4) t = Math.min(t, (W - x) / ca); else if (ca < -1e-4) t = Math.min(t, -x / ca);
 if (sa > 1e-4) t = Math.min(t, (H - y) / sa); else if (sa < -1e-4) t = Math.min(t, -y / sa);
 return Math.max(0, t);
};
function leakInit(b) {
 R.leak = { boss: b, sig: 0, prevN: 0, needFrag: 1, needShard: 1, needFragT: 0, needShardT: 0, areas: [], mc: { x: b.x, y: b.y, ang: 0, r: LEAK.mainCore.r, fl: 0, rec: 0, bs: 0, bt: 3, bT: 0, ba: 0, ps: 0, stg: 0, lk: 0, pt: 0, gv: 0, gt: 1 }, meteors: [], craters: [], spawns: [], pendLead: { frag: 0, shard: 0 }, prism: null, prismSpawned: 0, prismDead: 0, sqT: 1, gm: 1, blocked: 0, nextSpawnGroup: 0 };
 // Opening wave: every spawn point is telegraphed first. The first Fragment / Shard queued become the Main Fragment / Main Shard.
 const D = LEAK.spawnIntro, group = ++R.leak.nextSpawnGroup; let n = 0;
 queueSpawn('frag', { t: D, d: 0, group }); queueSpawn('shard', { t: D, d: .08, group });
 for (let i = 0; i < 3; i++) queueSpawn('frag', { t: D, d: .16 + .08 * n++, group });
 queueSpawn('shard', { t: D, d: .16 + .08 * n++, group, noLead: 1, variant: 'lance' });
 queueSpawn('shard', { t: D, d: .16 + .08 * n++, group, noLead: 1, variant: 'scatter' });
 queueSpawn('shard', { t: D, d: .16 + .08 * n++, group });
 sfx('zone_warn', { x: b.x });
}
// Normal Squad B spawns use the open flank bays; Squad A uses the defensive ring. The post-SIGCONT Squad A wave also uses a bay.
function spawnSite(squad) {
 const A = ARENAS[G.cfg.arena], z = A.z, b = R.leak.boss, p = R.p;
 if (z && squad === 'B') {
  const far = z.bays.filter(q => Math.hypot(q[0] - p.x, q[1] - p.y) > 170), q = pick(far.length ? far : z.bays);
  return [q[0] + ri(36) - 18, q[1] + ri(60) - 30];
 }
 for (let i = 0; i < 14; i++) {
  const a = Math.random() * 6.283, r = (z ? z.rc * .55 : 60) + Math.random() * 28, x = b.x + Math.cos(a) * r, y = b.y + Math.sin(a) * r;
  if (!wallHit(G.cfg.arena, x, y, 10) && Math.hypot(x - p.x, y - p.y) > 70) return [x, y];
 }
 return [b.x, b.y + 60];
}
// Queue a telegraphed spawn; the unit appears when the warning ends (see leakGlobal). o.t = warning length, o.d = extra stagger.
function queueSpawn(kind, o = {}) {
 if (R.leak.sig > 0) return; // SIGSTOP: ordinary minion spawning is suspended (leader replacements wait too; nothing is queued, so there is no burst at SIGCONT)
 const L = R.leak, lead = !o.noLead && ((kind === 'frag' && L.needFrag) || (kind === 'shard' && L.needShard)) && !L.pendLead[kind];
 if (lead) L.pendLead[kind] = 1;
 const sq = lead ? (kind === 'frag' ? 'B' : 'A') : (o.squad || assignSquad()), [x, y] = o.pos || spawnSite(sq), T = (o.t || LEAK.spawnTele) + (o.d || 0);
 L.spawns.push({ kind, x, y, squad: sq, lead: lead ? 1 : 0, noLead: o.noLead || 0, group: o.group || 0, variant: o.variant || null, t: T, T });
}
function queueResumeSquadA() {
 const L = R.leak, center = spawnSite('B'), count = Math.min(LEAK.cap, Math.ceil(LEAK.cap * LEAK.squadA)), group = ++L.nextSpawnGroup;
 const pos = i => [center[0] + ((i % 4) - 1.5) * 18, center[1] + (Math.floor(i / 4) - 1) * 18];
 const hasShardLead = L.needShard && !L.pendLead.shard;
 let i = 0;
 if (hasShardLead) queueSpawn('shard', { squad: 'A', pos: pos(i++), group });
 queueSpawn('shard', { squad: 'A', noLead: 1, pos: pos(i), group, variant: pick(['lance', 'scatter']) });
 i++;
 for (; i < count; i++) queueSpawn('frag', { squad: 'A', noLead: 1, pos: pos(i), group });
}
function assignSquad() { // counts units that are still being telegraphed, so a big wave splits 40/60 correctly
 const pend = (R.leak.spawns || []).filter(q => !q.lead), U = armyList().filter(u => !u.lead), a = U.filter(u => u.squad === 'A').length + pend.filter(q => q.squad === 'A').length;
 return a < Math.ceil((U.length + pend.length + 1) * LEAK.squadA) ? 'A' : 'B';
}
// Creates a unit. Leader replacement: if the Main Fragment / Main Shard died, the NEXT newly spawned unit of that kind is promoted (never an existing one).
function spawnArmy(kind, x, y, sq, noLead = 0, variantOverride = null) {
 const L = R.leak, B = LEAK.t[kind];
 let lead = 0;
 const hasLead = () => R.en.some(u => u.lead && u.army === kind && !u.dead);
 if (!noLead && kind === 'frag' && L.needFrag && !hasLead()) { lead = 1; L.needFrag = 0; }
 if (!noLead && kind === 'shard' && L.needShard && !hasLead()) { lead = 1; L.needShard = 0; }
 if (!lead && ordN() >= LEAK.cap) return null; // hard cap: nothing can bypass it
 let variant = null;
 if (!lead) {
  const variants = LEAK.variants[kind] || {};
  if (variants[variantOverride]) variant = variantOverride;
  else {
   const roll = Math.random();
   let cumulative = 0;
   for (const name in variants) {
    cumulative += variants[name].chance;
    if (roll < cumulative) { variant = name; break; }
   }
  }
 }
 const T = lead ? (kind === 'frag' ? LEAK.mainFrag : LEAK.mainShard) : B, V = variant && LEAK.variants[kind][variant];
 const e = spawnE('chaser', x, y);
 Object.assign(e, { army: kind, variant, k: 'army_' + kind, g: B.g, c: V?.c || B.c, hp: Math.round(T.hp * (V?.hp || 1)), max: Math.round(T.hp * (V?.hp || 1)), r: T.r, sp: T.sp * (V?.sp || 1), dmg: Math.round(T.dmg * (V?.dmg || 1)), beh: 'army', ghost: 1, lead, evo: 0, squad: lead ? (kind === 'frag' ? 'B' : 'A') : (sq || assignSquad()), vx: 0, vy: 0, ap: ri(3), fT: 1 + Math.random() * 2, sT: 1, dg: 0, cs: 0, ct: 2 + Math.random() * 2, cn: 0, q: 0, vq: 0, bT: 0, gi: ri(7), rt: 0, dcd: 0, tm: 9, sapperT: 0, sapperCd: 1 + Math.random() * 2 });
 burst(e.x, e.y, B.c, 6, 90);
 return e;
}
function addEvoArea(x, y, k = 1) {
 const A = R.leak.areas;
 A.push({ x, y, r: LEAK.evo.areaR * (k < 1 ? .8 : 1), t: LEAK.evo.areaT * (k < 1 ? .65 : 1), max: LEAK.evo.areaT * (k < 1 ? .65 : 1), k });
 while (A.length > LEAK.evo.maxAreas) A.shift();
}
function evolveTo(u, kind) {
 const B = LEAK.t[kind], fr = cl(u.hp / u.max, .5, 1);
 Object.assign(u, { army: kind, variant: null, k: 'army_' + kind, g: B.g, c: B.c, r: B.r, sp: B.sp, dmg: B.dmg, max: B.hp, hp: Math.round(B.hp * fr), evo: 0, fT: 1.5, q: 0, cs: 0, ct: 2.5, cn: 0 });
 burst(u.x, u.y, B.c, 14, 150); ring(u.x, u.y, 26, '#7dff6a', .4);
 txt(u.x, u.y - u.r - 10, 'EVOLVED: ' + kind.toUpperCase(), '#9dff7a', 10); sfx('leak_evolve', { x: u.x });
}
function tryEvolve(u) {
 const need = LEAK.evo.need[u.army];
 if (!need || u.lead || u.evo < need) return false;
 if (u.army === 'shard' && coreN() >= LEAK.coreCap) { u.evo = need; return false; } // waits for a free Core slot
 evolveTo(u, u.army === 'frag' ? 'shard' : 'core');
 return true;
}
function armyDeath(e) {
 const L = R.leak;
 if (!L || e.deathDone) return;
 e.deathDone = 1;
 if (e.prism) { L.prismDead = 1; L.prism = null; R.banner = { t: 2.2, s: 'PRISM DESTROYED' }; sfx('leak_prism_die', { x: e.x }); burst(e.x, e.y, '#b36bff', 30, 240); return; }
 if (e.lead && e.army === 'frag') { L.needFrag = 1; L.needFragT = 2.5; txt(e.x, e.y - 14, 'MAIN FRAGMENT DOWN', '#a6f06b', 10); }
 if (e.lead && e.army === 'shard') { L.needShard = 1; L.needShardT = 2.5; txt(e.x, e.y - 14, 'MAIN SHARD DOWN', '#5fe0a0', 10); }
 if (e.army === 'core' && !e.sacd) { addEvoArea(e.x, e.y, 1); sfx('leak_sacrifice', { x: e.x }); }
}
function armyExpire(e) { // dies without counting as a player kill (Fragment that landed its hit, sacrificed Core)
 if (e.dead) return;
 e.dead = 1; burst(e.x, e.y, e.c, 8, 130); armyDeath(e);
}
function disableCards(e, preferMostModified = false) {
 const D = LEAK.disable, depl = cl(1 - ordN() / 10, 0, 1), n = D.cards + Math.round(depl * D.moreCards), dur = D.base + D.extra * depl;
 const pool = R.casts.filter(c => !(c.dis > 0));
 let disabled = 0;
 if (preferMostModified && pool.length) {
  const maxMods = Math.max(...pool.map(c => (c.c?.mods || []).length));
  if (maxMods > 0) {
   const candidates = pool.filter(c => (c.c?.mods || []).length === maxMods);
   const target = pick(candidates);
   target.dis = dur;
   pool.splice(pool.indexOf(target), 1);
   disabled++;
  }
 }
 for (let i = disabled; i < n && pool.length; i++) { const c = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; c.dis = dur; }
 txt(R.p.x, R.p.y - 26, 'CARDS DISABLED ' + dur.toFixed(1) + 's', '#a6f06b', 10); sfx('leak_frag_hit', { x: R.p.x });
}
function armyContact(e, hit) {
 if (!hit) return;
 if (e.army === 'frag') {
  if (!e.lead) { sfx('leak_frag_hit', { x: e.x }); armyExpire(e); }
  else if (!(e.dcd > 0)) { e.dcd = LEAK.disable.cd; e.rt = 1.3; disableCards(e); }
 }
}
// Main Core stagger: every blocked hit adds pressure (would-be damage relative to LEAK.mainCore.stagger.ref). The Core never loses HP.
function corePressure(mc, dmg) {
 const S = LEAK.mainCore.stagger;
 if (mc.lk > 0 || mc.stg > 0) return; // lockout / already staggered: no pressure, so it can't be stun-locked
 let v = cl((dmg || 0) / S.ref, S.min, S.max);
 v = Math.min(v, Math.max(0, S.perSec - mc.gv)); mc.gv += v;
 if (v <= 0) return;
 const before = mc.ps / S.threshold;
 mc.ps += v; mc.pt = 0;
 const f = mc.ps / S.threshold;
 if (f >= 1) { staggerCore(mc); return; }
 if (before < S.alert && f >= S.alert) { sfx('leak_core_strain', { x: mc.x }); txt(mc.x, mc.y - 22, 'CORE CRACKING', '#ffb070', 9); }
 else if (before < S.warn && f >= S.warn) sfx('leak_core_strain', { x: mc.x });
}
function staggerCore(mc) {
 const S = LEAK.mainCore.stagger;
 mc.stg = S.time; mc.ps = 0; mc.bs = 0; mc.fl = .4;
 ring(mc.x, mc.y, 64, '#ffffff', .5, 1); burst(mc.x, mc.y, '#9dff7a', 26, 230); R.shake = Math.max(R.shake, 7);
 txt(mc.x, mc.y - 24, 'CORE STAGGERED', '#ffffff', 12); sfx('leak_core_stagger', { x: mc.x });
}
function leakGlobal(dt) {
 const L = R.leak, b = L && L.boss;
 if (!b || b.dead) return;
 const p = R.p, mc = L.mc;
 if (mc) { // Main Core: invulnerable bodyguard. Orbits at a capped speed (so shots can slip past it) and fires a telegraphed beam at close range.
  const M = LEAK.mainCore, md = Math.hypot(p.x - mc.x, p.y - mc.y);
  const angTo = (ox, oy) => Math.atan2(p.y - oy, p.x - ox);
  const adiff = (a, c) => Math.atan2(Math.sin(a - c), Math.cos(a - c));
  const ta = Math.atan2(p.y - b.y, p.x - b.x) + Math.sin(R.t * 1.7) * .55;
  // stagger bookkeeping (hidden pressure meter): per-second gain window, decay when you stop pressing, stun timer, post-stun lockout
  const S = M.stagger;
  mc.gt -= dt; if (mc.gt <= 0) { mc.gt = 1; mc.gv = 0; }
  mc.pt += dt; if (mc.pt > S.decayDelay && mc.stg <= 0) mc.ps = Math.max(0, mc.ps - S.decay * dt);
  if (mc.lk > 0) mc.lk -= dt;
  if (mc.stg > 0) {
   mc.stg -= dt;
   if (mc.stg <= 0) { mc.stg = 0; mc.lk = S.lockout; mc.bs = 0; mc.bt = M.beamCd * .5; ring(mc.x, mc.y, 40, '#9dff7a', .4, 1); txt(mc.x, mc.y - 22, 'CORE RECOVERED', '#9dff7a', 10); sfx('leak_core_recover', { x: mc.x }); }
  }
  const dazed = mc.stg > 0;
  const lim = M.spin * (mc.bs === 1 ? .3 : 1) * (mc.rec > 0 ? .45 : 1) * dt;
  if (!dazed) mc.ang += cl(adiff(ta, mc.ang) * dt * 1.8, -lim, lim);
  mc.x = b.x + Math.cos(mc.ang) * M.orbit; mc.y = b.y + Math.sin(mc.ang) * M.orbit;
  if (mc.fl > 0) mc.fl -= dt;
  if (mc.rec > 0) mc.rec -= dt;
  if (dazed) { /* staggered: no orbit, no beam */ } else if (mc.bs === 0) {
   mc.bt -= dt;
   if (mc.bt <= 0 && md < M.beamRange && !R.end) { mc.bs = 1; mc.bT = M.beamTele; mc.ba = angTo(mc.x, mc.y); sfx('leak_core_charge', { x: mc.x }); }
  } else if (mc.bs === 1) {
   mc.bT -= dt;
   if (mc.bT > M.beamLock) { const st = 2.4 * dt; mc.ba += cl(adiff(angTo(mc.x, mc.y), mc.ba), -st, st); } // tracks (turn-rate limited), then locks
   if (mc.bT <= 0) {
    const Lr = Math.min(M.beamLen, bossBounds(mc.x, mc.y, mc.ba)), hx = mc.x + Math.cos(mc.ba) * Lr, hy = mc.y + Math.sin(mc.ba) * Lr;
    R.lines.push({ x1: mc.x, y1: mc.y, x2: hx, y2: hy, l: .34, c: '#9dff7a', w: 13, laser: 1, core: '#ffffff' });
    burst(hx, hy, '#9dff7a', 10, 150); ring(mc.x, mc.y, 34, '#eaffd0', .3); sfx('leak_core_laser', { x: mc.x }); R.shake = Math.max(R.shake, 5);
    if (!R.end && p.inv <= 0 && segDist(p.x, p.y, mc.x, mc.y, hx, hy) < 13) hurt(Math.round(M.beamDmg * L.gm), mc);
    mc.bs = 0; mc.bt = M.beamCd; mc.fl = .3;
   }
  }
 }
 // SIGSTOP / SIGCONT: when the army goes from some to none, ordinary spawning is suspended once for LEAK.sigstop.time seconds
 { const total = armyList().length + L.spawns.length;
  if (L.sig > 0) { L.sig -= dt; if (L.sig <= 0) { L.sig = 0; R.banner = { t: 1.4, s: '[SIGCONT] MINION SPAWN PROCESS RESUMED' }; sfx('zone_warn', { x: b.x }); queueResumeSquadA(); } }
  else if ((L.prevN || 0) > 0 && total === 0) { L.sig = LEAK.sigstop.time; R.banner = { t: 2.4, s: '[SIGSTOP] MINION SPAWN PROCESS SUSPENDED' }; sfx('objective'); }
  L.prevN = total; }
 for (const a of L.areas) a.t -= dt;
 L.areas = L.areas.filter(a => a.t > 0);
 for (const m of L.meteors) { if (m.w > 0) { m.w -= dt; continue; } m.t -= dt; if (m.t <= 0) { meteorImpact(m); m.done = 1; } }
 L.meteors = L.meteors.filter(m => !m.done);
 for (const c of L.craters) c.t -= dt;
 L.craters = L.craters.filter(c => c.t > 0);
 for (const u of armyList()) { // evolution: Squad A evolves slowly on its own, everyone speeds up inside green-flame areas
  if (u.lead || u.army === 'core') continue;
  let rate = u.squad === 'A' ? LEAK.evo.passive : 0;
  for (const a of L.areas) if (Math.hypot(u.x - a.x, u.y - a.y) < a.r) rate += LEAK.evo.area * a.k;
  if (rate > 0) { u.evo += rate * dt; tryEvolve(u); }
 }
 L.sqT -= dt; // dynamic squad assignment: keep ~40% of the ordinary army on defence
 if (L.sqT <= 0) {
  L.sqT = 1.4;
  const U = armyList().filter(u => !u.lead), want = Math.round(U.length * LEAK.squadA), A = U.filter(u => u.squad === 'A'), B = U.filter(u => u.squad === 'B');
  const bd = u => Math.hypot(u.x - b.x, u.y - b.y);
  if (A.length < want && B.length) { B.sort((m, n) => bd(m) - bd(n))[0].squad = 'A'; }
  else if (A.length > want + 1) { A.sort((m, n) => bd(n) - bd(m))[0].squad = 'B'; }
 }
 if (L.needFrag) { L.needFragT -= dt; if (L.needFragT <= 0 && !L.pendLead.frag) queueSpawn('frag'); }
 if (L.needShard) { L.needShardT -= dt; if (L.needShardT <= 0 && !L.pendLead.shard) queueSpawn('shard'); }
 for (const q of L.spawns) { // telegraph over: the unit appears
  q.t -= dt; if (q.t > 0) continue;
  q.done = 1; const u = spawnArmy(q.kind, q.x, q.y, q.squad, q.noLead, q.variant);
  if (q.lead) L.pendLead[q.kind] = 0;
  if (u && u.lead) { sfx('leak_promote', { x: u.x }); txt(u.x, u.y - 14, u.army === 'frag' ? 'NEW MAIN FRAGMENT' : 'NEW MAIN SHARD', u.c, 10); }
 }
 L.spawns = L.spawns.filter(q => !q.done);
 if (!L.prismSpawned && b.hp < b.max * .5) spawnPrism();
}
// Boss patterns. 'summon' = NECROPOST (calls down CORE DUMP meteors + summons), 'dump' = Core sacrifice
function necropost(e, pat) {
 const room = LEAK.cap - ordN() - R.leak.spawns.filter(q => !q.lead).length, ph = e.ph || 0;
 sfx('necropost', { x: e.x }); R.banner = { t: 1.4, s: 'NECROPOST' };
 callCoreDump(e, room > 0 ? LEAK.meteor.n[Math.min(2, ph)] : 1); // the hotspot now comes from the meteor impact (see meteorImpact), not from the boss
 if (R.leak.sig > 0) { /* SIGSTOP: the CORE DUMP meteor still falls, but no new minions */ } else if (room > 0) { // never more than the cap allows
  const n = Math.min(3, room);
  const group = ++R.leak.nextSpawnGroup;
  for (let i = 0; i < n; i++) {
   const shard = i === n - 1;
   queueSpawn(shard ? 'shard' : 'frag', { d: i * .14, group, ...(shard ? { variant: pick(['lance', 'scatter']) } : {}) });
  }
 } else e.pt.summon = pat.summon * .5; // army is full: no units, but NECROPOST comes around twice as often (one meteor each time)
}
// CORE DUMP: the meteor(s) NECROPOST calls down. First one lands on where you are heading; extras are scattered around you.
function callCoreDump(e, n) {
 const L = R.leak, M = LEAK.meteor, p = R.p;
 for (let i = 0; i < n; i++) {
  let x = p.x + (p.vx || 0) * .45, y = p.y + (p.vy || 0) * .45;
  if (i) { const a = Math.random() * 6.283, d = M.spread * (.6 + Math.random() * .6); x = p.x + Math.cos(a) * d; y = p.y + Math.sin(a) * d; }
  L.meteors.push({ x: cl(x, 30, W - 30), y: cl(y, 30, H - 30), w: i * M.stagger, t: M.tele, T: M.tele, r: M.r, dmg: Math.round(M.dmg * L.gm), sx: e.x, sy: e.y, fa: -1.57 - .35 + (Math.random() - .5) * .3, called: 0 });
 }
 R.lines.push({ x1: e.x, y1: e.y, x2: e.x, y2: -30, l: .45, c: '#7dff6a', w: 12, laser: 1, core: '#eaffd0' });
 ring(e.x, e.y, 56, '#7dff6a', .5, 1); burst(e.x, e.y, '#7dff6a', 14, 170); sfx('zone_warn', { x: p.x });
}
function meteorImpact(m) {
 const L = R.leak, M = LEAK.meteor, p = R.p;
 ring(m.x, m.y, m.r, '#ff8a3c', .5, 1); ring(m.x, m.y, m.r * .6, '#eaffd0', .35, 1); burst(m.x, m.y, '#ff8a3c', 18, 230); burst(m.x, m.y, '#7dff6a', 16, 170);
 R.shake = Math.max(R.shake, 11); sfx('zone_boom', { x: m.x }); sfx('leak_sacrifice', { x: m.x });
 if (!R.end && p.inv <= 0 && Math.hypot(p.x - m.x, p.y - m.y) < m.r + 6) hurt(m.dmg, m);
 addEvoArea(m.x, m.y, M.k); // the evolution hotspot is a consequence of the impact
 L.craters.push({ x: m.x, y: m.y, t: 9, max: 9, r: m.r });
}
function coreSacrifice(e) {
 const cores = armyList().filter(u => u.army === 'core' && !u.lead && !(u.sac > 0)), elig = armyList().filter(u => !u.lead && u.army !== 'core').length;
 if (!cores.length || elig < 2) return;
 const c = cores.sort((m, n) => m.hp - n.hp)[0];
 c.sac = 1.1; R.banner = { t: 1.2, s: 'CORE SACRIFICE' }; sfx('leak_core_charge', { x: c.x });
}
function sacrifice(c) {
 const p = R.p;
 c.sacd = 1; addEvoArea(c.x, c.y, 1); ring(c.x, c.y, 60, '#39d35f', .45, 1); burst(c.x, c.y, '#39d35f', 22, 200); R.shake = Math.max(R.shake, 6);
 sfx('leak_sacrifice', { x: c.x });
 if (Math.hypot(p.x - c.x, p.y - c.y) < 62) hurt(10, c);
 armyExpire(c);
}
// ----- movement / behaviour -----
function steer(e, gx, gy, spd, turn, dt) {
 const dx = gx - e.x, dy = gy - e.y, d = Math.hypot(dx, dy) || 1;
 e.vx += (dx / d * spd - e.vx) * Math.min(1, dt * turn); e.vy += (dy / d * spd - e.vy) * Math.min(1, dt * turn);
 const s = Math.hypot(e.vx, e.vy) || 1;
 return [e.vx / s, e.vy / s, s];
}
// Where an eligible unit can stand inside a hotspot. MOVEMENT ONLY: the evolution requirements themselves are untouched.
// Squad A tends hotspots inside its defensive reach (round the boss / PRISM); Squad B uses hotspots near it, on the side away from you.
function evoSpot(e) {
 if (e.lead || e.army === 'core') return null;
 const L = R.leak, b = L.boss, p = R.p, pr = L.prism && !L.prism.dead ? L.prism : null, E = LEAK.evo;
 let best = null, bd = 1e9;
 for (const a of L.areas) {
  if (a.t < 2.2) continue; // about to fade
  const ok = e.squad === 'A' ? Math.min(Math.hypot(a.x - b.x, a.y - b.y), pr ? Math.hypot(a.x - pr.x, a.y - pr.y) : 1e9) <= E.aReach : Math.hypot(a.x - e.x, a.y - e.y) <= E.bReach;
  if (!ok) continue;
  const dx = a.x - p.x, dy = a.y - p.y, d = Math.hypot(dx, dy) || 1, sx = a.x + dx / d * a.r * .4 + Math.cos(e.gi * 2.4) * a.r * .25, sy = a.y + dy / d * a.r * .4 + Math.sin(e.gi * 2.4) * a.r * .25;
  if (e.squad === 'B' && Math.hypot(sx - p.x, sy - p.y) < 85) continue; // Squad B keeps its distance from you
  const dd = Math.hypot(sx - e.x, sy - e.y);
  if (dd < bd) { bd = dd; best = { x: sx, y: sy, a }; }
 }
 return best;
}
function guardPoint(e) {
 const L = R.leak, p = R.p, pr = L.prism && !L.prism.dead ? L.prism : null, t = pr && ((pr.hc && pr.hc.t > 0) || pr.cc || (e.gi & 1)) ? pr : L.boss;
 const dx = p.x - t.x, dy = p.y - t.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, off = ((e.gi % 7) - 3) * 22, nr = 58 + (e.army === 'core' ? 24 : 0);
 return { x: t.x + ux * nr - uy * off, y: t.y + uy * nr + ux * off };
}
const leakAlarm = () => { const L = R.leak, p = R.p; return Math.hypot(p.x - L.boss.x, p.y - L.boss.y) < 140 || (L.prism && Math.hypot(p.x - L.prism.x, p.y - L.prism.y) < 120); };
function armyMove(e, dt, ux, uy, d, f) {
 const L = R.leak, p = R.p, b = L.boss;
 if (!b || b.dead) return [0, 0, 0];
 if (e.sac > 0) return [0, 0, 0];
 if (e.army === 'frag') {
  if (e.variant === 'sapper' && !e.lead) {
   if (e.sapperT > 0) return [0, 0, 0];
   let gx = p.x, gy = p.y, spd = e.sp * f;
   if (d < 140) { gx = e.x - ux * 70; gy = e.y - uy * 70; }
   else if (d < 165) { gx = e.x - uy * 80; gy = e.y + ux * 80; spd *= .5; }
   return steer(e, gx, gy, spd, 3.2, dt);
  }
  let gx, gy, spd = e.sp * f, turn = 5, sp = null;
  if (e.lead) {
   e.rt = Math.max(0, e.rt - dt); e.dcd -= dt;
   turn = LEAK.mainFrag.turn;
   if (e.rt > 0) { gx = b.x; gy = b.y; spd *= .8; turn = 4; }
   else { gx = p.x; gy = p.y; if (d < 150) spd *= LEAK.mainFrag.boost; }
  } else if (e.squad === 'A' && ((sp = evoSpot(e)) ? (!leakAlarm() || e.evo > 2) : !leakAlarm())) { // defend; if a hotspot is in reach, stand in it (a unit that has started evolving stays put even under alarm)
   const g = sp || guardPoint(e); gx = g.x + Math.sin(R.t * 3 + e.gi) * 8; gy = g.y + Math.cos(R.t * 2.6 + e.gi) * 8; spd *= sp ? .8 : .6; turn = 4;
   if (Math.hypot(gx - e.x, gy - e.y) < 6) spd = 0;
  } else {
   // rush: front / back / side approach, then straight through the Host without ever stopping
   const fx = p.fx || 0, fy = p.fy || -1, fo = e.ap === 0 ? 34 : e.ap === 1 ? -34 : 0, so = e.ap === 2 ? 34 : 0;
   if (d > 90) { gx = p.x + fx * fo - fy * so; gy = p.y + fy * fo + fx * so; } else { gx = p.x; gy = p.y; }
   if (d < 160) spd *= 1.12;
   if (!e.rush && d < 260) { e.rush = 1; sfx('leak_frag_rush', { x: e.x }); }
  }
  return steer(e, gx, gy, spd, turn, dt);
 }
 if (e.army === 'shard') {
  e.sT -= dt; if (e.sT <= 0) { e.sdir = -(e.sdir || 1); e.sT = 1.3 + Math.random() * 1.8; }
  const sd = e.sdir || 1;
  let mx = 0, my = 0, spd = e.sp * f, sp = null;
  if (e.lead) { // defensive leader: hovers between the boss and you
   const bd = Math.hypot(p.x - b.x, p.y - b.y) || 1, ax = (p.x - b.x) / bd, ay = (p.y - b.y) / bd, gx = b.x + ax * 95 - ay * sd * 55, gy = b.y + ay * 95 + ax * sd * 55, dd = Math.hypot(gx - e.x, gy - e.y) || 1;
   mx = (gx - e.x) / dd; my = (gy - e.y) / dd; spd *= Math.min(1.4, dd / 30 + .2);
  } else if (e.squad === 'A') {
   const g = evoSpot(e) || guardPoint(e), dd = Math.hypot(g.x - e.x, g.y - e.y) || 1;
   mx = (g.x - e.x) / dd; my = (g.y - e.y) / dd; spd *= Math.min(1, dd / 24);
  } else if (d >= 100 && (sp = evoSpot(e))) { // Squad B shard: pressure you from inside a hotspot when one is near
   const dd = Math.hypot(sp.x - e.x, sp.y - e.y) || 1; mx = (sp.x - e.x) / dd; my = (sp.y - e.y) / dd; spd *= Math.min(1, dd / 24);
  } else if (d < 120) { mx = -ux; my = -uy; spd *= 1.1; }
  else if (d > 215) { mx = ux; my = uy; }
  else { mx = -uy * sd; my = ux * sd; spd *= .9; }
  if (e.dg > 0) e.dg -= dt; // dodge: sidestep shots that are coming straight at it
  else for (const q of R.pr) {
   const qx = e.x - q.x, qy = e.y - q.y, dd = Math.hypot(qx, qy);
   if (dd < 95 && dd > 1) {
    const sp = Math.hypot(q.vx, q.vy) || 1;
    if ((q.vx * qx + q.vy * qy) / (sp * dd) > .86) { const sg = (qx * -q.vy + qy * q.vx) >= 0 ? 1 : -1; e.kx += -q.vy / sp * sg * 230; e.ky += q.vx / sp * sg * 230; e.dg = .9; break; }
   }
  }
  return [mx, my, spd];
 }
 if (e.army === 'core') {
  let mx = 0, my = 0, spd = e.sp * f;
  if (e.squad === 'A') { const g = guardPoint(e), dd = Math.hypot(g.x - e.x, g.y - e.y) || 1; mx = (g.x - e.x) / dd; my = (g.y - e.y) / dd; spd *= Math.min(1, dd / 24); }
  else if (d < 150) { mx = -ux; my = -uy; } else if (d > 230) { mx = ux; my = uy; } else { spd *= .5; mx = -uy; my = ux; }
  if (e.cs === 1) spd *= .3;
  return [mx, my, spd];
 }
 if (e.army === 'prism') {
  const dx = b.x - p.x, dy = b.y - p.y, dl = Math.hypot(dx, dy) || 1, gx = b.x + dx / dl * 85 + Math.sin(R.t * .8) * 30, gy = b.y + dy / dl * 85 + Math.cos(R.t * .7) * 20;
  if (d < 150) return [-ux, -uy, e.sp * f * 1.4];
  const dd = Math.hypot(gx - e.x, gy - e.y) || 1;
  return [(gx - e.x) / dd, (gy - e.y) / dd, e.sp * f * Math.min(1, dd / 30)];
 }
 return [0, 0, 0];
}
function leakShot(e, an, n, spread, c) {
 if (R.eb.length > 280) return;
 const L = R.leak, dm = Math.round((e.lead ? 7 : 6) * L.gm);
 PW = 1;
 for (let i = 0; i < n; i++) ebul(e.x, e.y, an + (n > 1 ? (i - (n - 1) / 2) * spread : 0), 210, dm, c || '#7ddc6f', 'leak');
 PW = 0;
}
function sapperShot(e) {
 const V = LEAK.variants.frag.sapper, an = e.sapperAng, len = Math.min(V.range, bossBounds(e.x, e.y, an));
 const hx = e.x + Math.cos(an) * len, hy = e.y + Math.sin(an) * len;
 R.lines.push({ x1: e.x, y1: e.y, x2: hx, y2: hy, l: .24, c: '#3dffc4', w: 9, laser: 1, core: '#eaffd0' });
 burst(hx, hy, '#3dffc4', 7, 120);
 sfx('leak_core_laser', { x: e.x });
 if (!R.end && R.p.inv <= 0 && segDist(R.p.x, R.p.y, e.x, e.y, hx, hy) < 12) {
  hurt(V.beamDmg, e);
  if (!R.end) disableCards(e, true);
 }
}
function armyThink(e, dt) {
 const L = R.leak, p = R.p, b = L && L.boss;
 if (!b || b.dead || e.dead) return;
 e.rt = Math.max(0, e.rt || 0); e.dcd = (e.dcd || 0) - dt;
 const d = Math.hypot(p.x - e.x, p.y - e.y);
 if (e.variant === 'sapper' && !e.lead) {
  if (e.sapperT > 0) {
   e.sapperT -= dt;
   if (e.sapperT <= 0) { e.sapperT = 0; sapperShot(e); e.sapperCd = LEAK.variants.frag.sapper.cd; }
  } else {
   e.sapperCd -= dt;
   if (e.sapperCd <= 0 && d <= LEAK.variants.frag.sapper.range) {
    e.sapperAng = Math.atan2(p.y - e.y, p.x - e.x);
    e.sapperT = LEAK.variants.frag.sapper.tele;
   }
  }
  return;
 }
 if (e.army === 'shard') {
  e.fT -= dt;
  if (e.lead) {
   if (e.vq > 0) { e.bT -= dt; if (e.bT <= 0) { leakShot(e, Math.atan2(p.y - e.y, p.x - e.x), 3, .2, e.c); sfx('leak_shard_burst', { x: e.x }); e.vq--; e.bT = .34; } }
   else if (e.fT <= 0 && d < 420) { e.vq = 3; e.bT = 0; e.fT = 4.2; } // shotgun: 3 bursts, 9 polygons
  } else if (e.variant === 'lance') {
   if (e.fT <= 0 && d < 320) {
    ebul(e.x, e.y, Math.atan2(p.y - e.y, p.x - e.x), LEAK.variants.shard.lance.projectileSpeed, LEAK.variants.shard.lance.projectileDmg, e.c, 'lance');
    sfx('leak_shard_burst', { x: e.x }); e.fT = LEAK.variants.shard.lance.volleyCd + Math.random() * .8;
   }
  } else if (e.variant === 'scatter') {
   if (e.fT <= 0 && d < 300) {
    const V = LEAK.variants.shard.scatter, an = Math.atan2(p.y - e.y, p.x - e.x);
    for (let i = 0; i < V.count; i++) ebul(e.x, e.y, an + (i - (V.count - 1) / 2) * (V.spread / (V.count - 1)), V.projectileSpeed, V.projectileDmg, e.c, 'hex');
    sfx('leak_shard_burst', { x: e.x }); e.fT = V.volleyCd + Math.random();
   }
  } else {
   if (e.q > 0) { e.bT -= dt; if (e.bT <= 0) { leakShot(e, Math.atan2(p.y - e.y, p.x - e.x) + (Math.random() - .5) * .08, 1, 0, e.c); e.q--; e.bT = .09; if (e.q === 2) sfx('leak_shard_burst', { x: e.x }); } }
   else if (e.fT <= 0 && d < 380) { e.q = 3; e.bT = 0; e.fT = 2.8 + Math.random() * 1.2; } // burst of 3 fast polygons
  }
 } else if (e.army === 'core') {
  if (e.sac > 0) { e.sac -= dt; if (e.sac <= 0) sacrifice(e); return; }
  e.ct -= dt;
  if (e.cs === 0 && e.ct <= 0) {
   e.cn++;
   if (e.cn % 3 === 0) { // corruption nova
    if (R.eb.length < 260) { PW = 1; const o = Math.random() * 6.3, dm = Math.round(7 * L.gm); const nn = Math.max(5, Math.round(8 * LEAK.density.nova)); for (let i = 0; i < nn; i++) ebul(e.x, e.y, o + i * 6.283 / nn, 95, dm, '#39d35f', 'leak'); PW = 0; }
    sfx('boss_ring', { x: e.x }); e.ct = 3.4;
   } else { e.cs = 1; e.cT = 1; e.cang = Math.atan2(p.y - e.y, p.x - e.x); sfx('leak_core_charge', { x: e.x }); }
  } else if (e.cs === 1) {
   e.cT -= dt;
   if (e.cT > .28) e.cang = Math.atan2(p.y - e.y, p.x - e.x); // tracks, then locks
   if (e.cT <= 0) {
    const Lr = bossBounds(e.x, e.y, e.cang), hx = e.x + Math.cos(e.cang) * Lr, hy = e.y + Math.sin(e.cang) * Lr;
    R.lines.push({ x1: e.x, y1: e.y, x2: hx, y2: hy, l: .3, c: '#39d35f', w: 8, laser: 1, core: '#eaffd0' });
    burst(hx, hy, '#39d35f', 8, 130); sfx('leak_core_laser', { x: e.x });
    if (!R.end && p.inv <= 0 && segDist(p.x, p.y, e.x, e.y, hx, hy) < 12) hurt(Math.round(14 * L.gm), e);
    e.cs = 0; e.ct = 4.2;
   }
  }
 } else if (e.army === 'prism') prismThink(e, dt);
}
// ----- PRISM: the unique healer -----
function spawnPrism() {
 const L = R.leak, b = L.boss, P = LEAK.prism;
 L.prismSpawned = 1; // once per fight: it never comes back
 const e = spawnE('chaser', b.x, b.y + 44);
 Object.assign(e, { prism: 1, army: 'prism', k: 'prism', g: '◇', c: '#b36bff', hp: P.hp, max: P.hp, shMax: P.shield, sh: P.shield, r: P.r, sp: P.sp, dmg: 0, beh: 'army', ghost: 1, squad: 'A', lead: 1, corrupt: 0, hc: null, cc: null, shDelay: 0, dw: 0, intImm: 0, hcd: 1.2, ccd: 2.2, shHit: 0, vx: 0, vy: 0, tm: 9 });
 L.prism = e; R.banner = { t: 2.2, s: 'PRISM ONLINE' }; sfx('leak_prism_spawn', { x: e.x }); ring(e.x, e.y, 50, '#b36bff', .6); burst(e.x, e.y, '#b36bff', 26, 200);
}
function healTarget(e) {
 const L = R.leak, P = LEAK.prism;
 let best = null, bs = 0;
 for (const t of [L.boss, ...armyList()]) {
  if (!t || t.dead) continue;
  const miss = (t.max - t.hp) / t.max;
  if (miss < .06 || Math.hypot(t.x - e.x, t.y - e.y) > 360) continue;
  const val = t === L.boss ? 8 : t.lead ? 3.2 : t.army === 'core' ? 4 : t.army === 'shard' ? 2 : 1, s = val * miss;
  if (s > bs) { bs = s; best = t; }
 }
 return best;
}
function evoTarget(e) {
 let best = null, bn = 1e9;
 for (const u of armyList()) {
  if (u.lead || u.army === 'core' || Math.hypot(u.x - e.x, u.y - e.y) > 360) continue;
  if (u.army === 'shard' && coreN() >= LEAK.coreCap) continue;
  const need = LEAK.evo.need[u.army] - u.evo;
  if (need <= e.corrupt && need < bn) { bn = need; best = u; }
 }
 return best;
}
const HEAL_C = '#ffd84a', CORR_C = '#c77dff'; // healing = warm gold-white (smooth wavy laser, '+'), corrupt boost = violet/magenta (jagged lightning, spikes)
function endHeal(e, cd) { e.hc = null; e.hcd = cd; }
function prismThink(e, dt) {
 const P = LEAK.prism, L = R.leak;
 e.shHit = Math.max(0, (e.shHit || 0) - dt); e.hcd -= dt; e.ccd -= dt;
 { const I = P.interrupt, thr = I.dmg * (P.hp + P.shield); e.shDelay = Math.max(0, e.shDelay - dt); e.intImm = Math.max(0, e.intImm - dt); e.dw = Math.max(0, e.dw - dt * thr / I.win); } // recent-damage meter drains, so only SUSTAINED fire interrupts
 // ----- HEALING LASER: attaches to a target, then stays connected (TF2 Medic style) and heals gradually while connected -----
 if (e.hc) {
  const h = e.hc, t = h.tgt;
  if (!t || t.dead || Math.hypot(t.x - e.x, t.y - e.y) > P.breakRange) endHeal(e, 1);
  else if (h.t > 0) { // attaching
   h.t -= dt;
   if (h.t <= 0) { h.life = P.healDur; h.tk = .5; h.acc = 0; sfx('leak_prism_charge', { x: e.x }); ring(t.x, t.y, t.r + 10, HEAL_C, .3); }
  } else { // connected: heal per second. Only ACTUAL hp restored counts: it feeds the CORRUPT meter and the shield, and nothing else feeds either one.
   h.life -= dt;
   const rate = t === L.boss ? t.max * P.bossHps : t.max * P.hps, got = Math.max(0, Math.min(t.max - t.hp, rate * dt));
   if (got > 0) { t.hp += got; e.corrupt = Math.min(P.meter, e.corrupt + got * P.gain); if (e.shDelay <= 0) e.sh = Math.min(e.shMax, e.sh + got * P.shGain); h.acc += got; } // shield can't refill for P.shDelay seconds after PRISM was hit
   h.tk -= dt;
   if (h.tk <= 0) {
    h.tk = .5;
    if (h.acc >= 1) { txt(t.x, t.y - t.r - 8, '+' + Math.round(h.acc), HEAL_C, 11); h.acc = 0; sfx('leak_prism_heal', { x: e.x }); if (e.shMax && e.sh > 0) sfx('leak_prism_shield', { x: e.x }); }
   }
   if (Math.random() < dt * 10) { const u = Math.random(); part(e.x + (t.x - e.x) * u, e.y + (t.y - e.y) * u, (Math.random() - .5) * 20, -18 - Math.random() * 16, .5, HEAL_C, 2); }
   if (h.life <= 0 || t.hp >= t.max - .5) endHeal(e, P.healCd);
  }
 } else if (e.hcd <= 0) { const t = healTarget(e); if (t) { e.hc = { tgt: t, t: P.tele, life: 0, tk: .5, acc: 0 }; sfx('leak_prism_charge', { x: e.x }); } else e.hcd = .5; }
 // ----- CORRUPT BOOST: separate one-shot evolution boost (its own colour/effect, runs alongside the heal laser) -----
 if (e.cc) {
  e.cc.t -= dt;
  const u = e.cc.tgt;
  if (!u || u.dead || u.lead || (u.army !== 'frag' && u.army !== 'shard')) { e.cc = null; e.ccd = 1; }
  else if (e.cc.t <= 0) {
   const need = LEAK.evo.need[u.army] - u.evo;
   if (need <= e.corrupt && !(u.army === 'shard' && coreN() >= LEAK.coreCap)) {
    e.corrupt -= need; u.evo = LEAK.evo.need[u.army]; // transfers ONLY what the next evolution needs; the rest stays in the meter
    R.lines.push({ x1: e.x, y1: e.y, x2: u.x, y2: u.y, l: .28, c: CORR_C, w: 5, laser: 1, core: '#f3e0ff' });
    burst(u.x, u.y, CORR_C, 12, 160); ring(u.x, u.y, u.r + 16, CORR_C, .35, 1); txt(u.x, u.y - u.r - 12, 'CORRUPT BOOST', '#d9a0ff', 9);
    sfx('leak_prism_corrupt', { x: e.x }); tryEvolve(u);
   }
   e.cc = null; e.ccd = P.corrCd;
  }
 } else if (e.ccd <= 0) { const u = evoTarget(e); if (u) { e.cc = { tgt: u, t: P.corrTele }; sfx('leak_prism_charge', { x: e.x }); } else e.ccd = .6; }
}
// damage that goes through PRISM's shield first (and is reduced while the shield holds)
function dmgDirect(e, v) {
 const sh0 = e.sh || 0;
 if (e.shMax && e.sh > 0) {
  v *= LEAK.prism.red;
  const ab = Math.min(e.sh, v); e.sh -= ab; v -= ab; e.shHit = .2;
  if (e.sh <= 0) { e.sh = 0; sfx('shield_break', { x: e.x }); ring(e.x, e.y, e.r + 14, '#5ee0d0', .35); }
 }
 e.hp -= v;
 if (e.prism) prismHurt(e, (sh0 - (e.sh || 0)) + v);
 return v;
}
// PRISM took damage: delay its shield regeneration, and sustained fire briefly breaks its healing beam (once per P.interrupt.immune seconds)
function prismHurt(e, dealt) {
 const P = LEAK.prism, I = P.interrupt;
 e.shDelay = P.shDelay; e.dw += dealt;
 if (e.hc && e.intImm <= 0 && e.dw >= I.dmg * (P.hp + P.shield)) {
  endHeal(e, I.cd); e.intImm = I.immune; e.dw = 0;
  ring(e.x, e.y, e.r + 18, '#ffd84a', .35); txt(e.x, e.y - e.r - 14, 'HEAL INTERRUPTED', '#ffd84a', 10); sfx('shatter', { x: e.x });
 }
}

function updEn(dt) {
 const p = R.p, arena = G.cfg.arena;
 if (R.leak) leakGlobal(dt);
 R.ct = (R.ct || 0) - dt;
 if (R.ct <= 0 && !R.end) for (const a of R.en) { // Deadlock chain: crossing the tether hurts
  const m = a.pair;
  if (m && !a.dead && !m.dead && segDist(p.x, p.y, a.x, a.y, m.x, m.y) < 9) { hurt(5, a); R.ct = .8; break; }
 }
 for (const e of R.en) e.prot = 1;
 for (const s of R.en) if (s.beh === 'aura' && !s.dead) for (const e of R.en) if (e !== s && Math.hypot(e.x - s.x, e.y - s.y) < 95) e.prot = .55;

 for (let n = 0; n < R.en.length; n++) {
  const e = R.en[n];
  if (e.dead) continue;
  e.fl -= dt; e.oc -= dt; e.vuln -= dt; if (e.shT > 0) e.shT -= dt;
  if (e.inv > 0) e.burn = 0;
  if (e.burn > 0) {
   e.burn -= dt;
   const burnDmg = e.bd * dt;
   dmgDirect(e, burnDmg);
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
  let sp = e.sp * R.emul * (e.bd0?.n === 'SEGMENT FAULT' ? SEGFAULT.speed[e.ph] || 1 : 1) * (e.slow > 0 ? (e.sf || .55) : 1) * (hazAt(arena, e.x, e.y) === 'slow' ? .6 : 1);
  let mx = ux, my = uy;
  e.slow -= dt; e.tm -= dt;
  if (e.army) armyThink(e, dt);
  if (e.boss) bossAI(e, dt, d);
  else if (e.army) { /* army units run their own AI below */ }
  else if (R.t > 70 && !R.boss) sp *= 1.6;
  else switch (e.beh) {
   case 'shoot':
    if (d < 115) { mx = -ux; my = -uy; } else if (d < 190) { sp *= .35; mx = -uy; my = ux; }
    if (e.tm <= 0) { e.tm = 2.3; ebul(e.x, e.y, Math.atan2(dy, dx), 135, e.dmg, '#b48cff', 'shooter'); }
    break;
   case 'dash':
    if (e.st === 0) { if (e.tm <= 0) { e.st = 1; e.tm = .55; e.lx = ux; e.ly = uy; sfx('enemy_dash_tele', { x: e.x }); } }
    else if (e.st === 1) { sp = 0; if (e.tm <= 0) { e.st = 2; e.tm = .35; sfx('enemy_dash', { x: e.x }); } }
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
   case 'spread': { // Kernel: interrupt. Strafes at mid range, fires a 3-way fan
    if (d < 100) { mx = -ux; my = -uy; } else if (d > 190) { mx = ux; my = uy; } else { e.sgn = e.sgn || (Math.random() < .5 ? 1 : -1); sp *= 1.15; mx = -uy * e.sgn; my = ux * e.sgn; }
    if (e.tm <= 0) { e.tm = 2.4; const a0 = Math.atan2(dy, dx); for (let i = -1; i <= 1; i++) ebul(e.x, e.y, a0 + i * .26, 150, e.dmg, e.c, 'shooter'); }
    break;
   }
   case 'spin': { // Kernel: daemon. Rooted turret, rotating pair of shots
    sp = 0; e.sa = (e.sa == null ? Math.random() * 6.3 : e.sa) + dt * 1.15;
    if (e.tm <= 0) { e.tm = .5; ebul(e.x, e.y, e.sa, 125, e.dmg, e.c, 'shooter'); ebul(e.x, e.y, e.sa + Math.PI, 125, e.dmg, e.c, 'shooter'); }
    break;
   }
   case 'cross': { // Deadlock: warden. Keeps range, alternates + and x volleys
    if (d < 140) { mx = -ux; my = -uy; } else if (d > 230) { mx = ux; my = uy; } else sp *= .3;
    if (e.tm <= 0) { e.tm = 2.8; e.xs = !e.xs; const a0 = Math.atan2(dy, dx) + (e.xs ? .785 : 0); for (let i = 0; i < 4; i++) ebul(e.x, e.y, a0 + i * 1.5708, 125, e.dmg, e.c, 'shooter'); }
    break;
   }
   case 'link': { // Deadlock: chain pair. Tethered to its mate; alone it panics (faster)
    const m = e.mate;
    if (m && !m.dead) { const md = Math.hypot(m.x - e.x, m.y - e.y); if (md > 175) { mx = (m.x - e.x) / md; my = (m.y - e.y) / md; sp *= 1.2; } }
    else { sp *= 1.55; e.enr = 1; }
    break;
   }
   case 'tp':
    if (e.tm <= 0) {
     e.tm = 2.4; ring(e.x, e.y, 16, e.c, .2); sfx('enemy_tp', { x: e.x });
     for (let i = 0; i < 8; i++) {
      const a = Math.random() * 6.3, x = p.x + Math.cos(a) * 110, y = p.y + Math.sin(a) * 110;
      if (!wallHit(arena, x, y, 12) && !hazAt(arena, x, y)) { e.x = x; e.y = y; break; }
     }
     burst(e.x, e.y, e.c, 6);
    }
    break;
   case 'summon':
    if (e.tm <= 0) {
     e.tm = 4.6; sfx('enemy_summon', { x: e.x });
     if (R.en.length < 30) for (let i = 0; i < 2; i++) spawnE('swarm', e.x + ri(20) - 10, e.y + ri(20) - 10);
     ring(e.x, e.y, 22, e.c, .3);
    }
    break;
  }
  if (e.segDash || e.segStun > 0 || e.segTankStun > 0) { mx = 0; my = 0; sp = 0; }
  if (e.race) { const rm = raceMove(e, ux, uy, d, sp); mx = rm[0]; my = rm[1]; sp = rm[2]; }
  else if (e.army) { const am = armyMove(e, dt, ux, uy, d, sp / (e.sp || 1)); mx = am[0]; my = am[1]; sp = am[2]; }
  const kd = Math.min(1, dt * 6);
  if (e.ghost || (e.beh === 'dash' && e.st === 2)) {
   e.x = cl(e.x + (mx * sp + e.kx) * dt, e.r, W - e.r);
   e.y = cl(e.y + (my * sp + e.ky) * dt, e.r, H - e.r);
  } else mv(arena, e, (mx * sp + e.kx) * dt, (my * sp + e.ky) * dt, e.r * .8);
  e.kx -= e.kx * kd; e.ky -= e.ky * kd;

  if (d < e.r + 9 && p.inv <= 0 && !e.prism && !(e.sac > 0)) {
   const landed = hurt(e.dmg, e);
   if (e.army) armyContact(e, landed);
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
  if (a.home && !q.noHome && R.leak) { // Shards jam homing shots that get close
   for (const u of R.en) if (u.army === 'shard' && !u.dead && Math.hypot(u.x - q.x, u.y - q.y) < 52) { q.noHome = 1; burst(q.x, q.y, '#5fe0a0', 4, 90); if (!q.jt) { q.jt = 1; if (Math.random() < .35) txt(q.x, q.y - 8, 'JAMMED', '#5fe0a0', 9); } break; }
  }
  if (a.home && !q.noHome) {
   const t = near(R, q, 260);
   if (t) {
    const ca = Math.atan2(q.vy, q.vx);
    let df = Math.atan2(t.y - q.y, t.x - q.x) - ca;
    df = Math.atan2(Math.sin(df), Math.cos(df));
    const na = ca + cl(df, -a.turn * dt, a.turn * dt), s = Math.hypot(q.vx, q.vy);
    q.vx = Math.cos(na) * s; q.vy = Math.sin(na) * s;
   }
  }
  q.life -= dt;
  if (Math.random() < .6) part(q.x, q.y, 0, 0, .22, a.col, q.r * .7);
  const n = Math.max(1, Math.ceil(Math.hypot(q.vx, q.vy) * dt / 6)), sd = dt / n;
  for (let k = 0; k < n && q.life > 0; k++) {
   q.x += q.vx * sd; q.y += q.vy * sd;
   if (wallHit(arena, q.x, q.y, q.r)) {
    if (R.seg) segDamageWall(segWallAt(q.x, q.y, q.r), a.dmg);
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
   const mc = R.leak && R.leak.mc;
   if (mc && !(mc.stg > 0) && Math.hypot(q.x - mc.x, q.y - mc.y) < mc.r + q.r + 1) { // Main Core: invulnerable, swallows projectiles (but not while staggered)
    q.life = 0; mc.fl = .14; mc.rec = LEAK.mainCore.recover; R.leak.blocked++; burst(q.x, q.y, '#9dff7a', 4, 100); sfx('leak_core_block', { x: mc.x }); corePressure(mc, a.dmg); break;
   }
   for (const e of R.en) {
    if (e.dead || q.hit.has(e)) continue;
    if (Math.hypot(e.x - q.x, e.y - q.y) < e.r + q.r) {
     q.hit.add(e);
     hitE(e, a.dmg, a, { x: q.x, y: q.y });
     if (e.army === 'shard') { // Shards consume homing / piercing / fork-on-hit on impact (they still take the damage)
      let neg = 0;
      if (a.home && !q.noHome) { q.noHome = 1; neg = 1; }
      if (a.split && !q.noFork) { q.noFork = 1; neg = 1; }
      if (q.pierce > 0) { q.pierce = 0; neg = 1; }
      if (neg && Math.random() < .5) txt(e.x, e.y - e.r - 8, 'NEGATED', '#5fe0a0', 9);
     }
     burst(q.x, q.y, a.col, 3);
     if (a.expl) blast(q.x, q.y, 50 * a.area * (1 + .3 * (a.expl - 1)), a.dmg * (.6 + .2 * (a.expl - 1)), { col: a.col, crit: 0 }, e, 0);
     if (a.pull) {
      const reach = [110, 155, 205][a.pull - 1] || 205;
      const force = [170, 250, 340][a.pull - 1] || 340;
      pullTo(q.x, q.y, reach, force);
     }
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
 if (R.rt) rteUpdate(dt);
 for (const b of R.eb) {
  if (b.segHoming) {
   if (b.v2 && p.dash > 0 && b.disruptedUntil <= R.t && Math.hypot(p.x - b.x, p.y - b.y) <= SEGFAULT.phase2.homing.evadeRadius) { // dash-evade disruption is Homing V2 (phase 2+)
    b.disruptedUntil = R.t + SEGFAULT.phase2.homing.evadeLock;
   }
   const visible = !b.v2 || segLineOfSight(b.x, b.y, p.x, p.y); // phase 1 missiles see through walls (V1)
   if (visible) { b.lastX = p.x; b.lastY = p.y; }
   if (b.disruptedUntil <= R.t) {
    const tx = visible ? p.x : b.lastX, ty = visible ? p.y : b.lastY;
    const speed = Math.hypot(b.vx, b.vy) || SEGFAULT.phase2.homing.speed;
    const current = Math.atan2(b.vy, b.vx), target = Math.atan2(ty - b.y, tx - b.x);
    const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    const angle = current + cl(diff, -b.turn * dt, b.turn * dt);
    b.vx = Math.cos(angle) * speed; b.vy = Math.sin(angle) * speed;
   }
  }
  const n = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 8)), sx = b.vx * dt / n, sy = b.vy * dt / n;
  b.l -= dt;
  for (let i = 0; i < n; i++) {
   b.x += sx; b.y += sy;
   if (b.pw ? (b.x < -5 || b.y < -5 || b.x > W + 5 || b.y > H + 5) : wallHit(arena, b.x, b.y, 3)) { b.l = 0; break; }
   if (Math.hypot(b.x - p.x, b.y - p.y) < 9 && p.inv <= 0) { b.l = 0; hurt(b.dmg, b); break; }
  }
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
  sfx(t.own === 'e' ? 'zone_boom' : 'boom', { x: t.x });
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
 if (R.hint && (R.hint.t -= dt) < 0) R.hint = null;
}

function step(dt) {
 if (R.shopOpen || (R.room && G.mapMode === 2)) { updMisc(dt); return; }
 if (R.sandbox && R.sbDash) R.p.dcd = 0;
 updP(dt);
 updBW(dt); updFrost(dt);
 if (R.room && R.room.cleared) { updPr(dt); updMisc(dt); roomTick(dt); return; } // clear or safe room: just walk, use doors, interact
 updSpawn(dt); updCasts(dt); updPr(dt); updEn(dt); updMisc(dt);
 if (R.room && !R.end && R.en.length === 0 && R.budget <= .3) { roomClear('p'); return; }
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
  k.got = 1; sfx('pickup');
  if (R.pk.every(q => q.got)) return finish('o');
 }
}
function finish(m) {
 if (R.room) { roomClear(m); return; }
 R.end = 1; G.cfg.rmode = m; R.en = []; R.eb = []; R.tg = [];
 R.banner = { t: 1.2, s: m === 'h' ? 'HACK COMPLETE' : 'DATA RECOVERED: BONUS' };
 sfx('objective');
 setTimeout(clearRound, m === 'h' ? 1400 : 700);
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
// Race Condition, merged phase: one figure made of overlapping red and blue bodies; mitosis animation when splitting.
// ===== Memory Leak army drawing =====
function pgon(x, r, n, rot) { x.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i * 6.2832 / n; i ? x.lineTo(Math.cos(a) * r, Math.sin(a) * r) : x.moveTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); }
function flameRing(x, cx, cy, r, n, col, t, k = 1) { // green flame tongues around a point
 x.save(); x.globalCompositeOperation = 'lighter';
 for (let i = 0; i < n; i++) {
  const a = i * 6.2832 / n + t * .6, fl = .6 + .4 * Math.sin(t * 9 + i * 1.7), px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r, h = r * .5 * fl * k;
  x.globalAlpha = .5 * fl; x.fillStyle = col;
  x.beginPath(); x.moveTo(px + Math.cos(a + 1.57) * 3, py + Math.sin(a + 1.57) * 3);
  x.quadraticCurveTo(px + Math.cos(a) * h * .6, py + Math.sin(a) * h * .6 - h * .3, px + Math.cos(a) * h, py + Math.sin(a) * h - h * .5);
  x.quadraticCurveTo(px + Math.cos(a) * h * .6, py + Math.sin(a) * h * .6 + h * .1, px + Math.cos(a - 1.57) * 3, py + Math.sin(a - 1.57) * 3);
  x.fill();
 }
 x.restore();
}
function drawLeakAreas(x) {
 const L = R.leak;
 if (!L || !L.areas.length) return;
 for (const a of L.areas) {
  const k = cl(a.t / a.max, 0, 1), fade = Math.min(1, a.t * 1.5);
  x.save(); x.globalAlpha = .16 * fade; const g = x.createRadialGradient(a.x, a.y, 2, a.x, a.y, a.r); g.addColorStop(0, '#7dff6a'); g.addColorStop(1, 'rgba(60,200,80,0)');
  x.fillStyle = g; x.beginPath(); x.arc(a.x, a.y, a.r, 0, 7); x.fill();
  x.globalAlpha = .55 * fade; x.strokeStyle = '#6dff6a'; x.lineWidth = 1.5; x.setLineDash([5, 5]); x.lineDashOffset = -R.t * 14; x.beginPath(); x.arc(a.x, a.y, a.r * (.85 + .15 * k), 0, 7); x.stroke(); x.setLineDash([]);
  x.restore();
  if (SET.fl) flameRing(x, a.x, a.y, a.r * .8, SET.fl > 1 ? 12 : 6, '#5dff5d', R.t, fade);
 }
}
function drawMainCore(x) {
 const L = R.leak, mc = L && L.mc;
 if (!mc || !L.boss || L.boss.dead) return;
 x.save();
 x.strokeStyle = 'rgba(125,255,106,.18)'; x.lineWidth = 1; x.setLineDash([3, 5]); x.beginPath(); x.arc(L.boss.x, L.boss.y, LEAK.mainCore.orbit, 0, 7); x.stroke(); x.setLineDash([]);
 const S = LEAK.mainCore.stagger, sf = cl(mc.ps / S.threshold, 0, 1), dz = mc.stg > 0, alertC = !dz && sf >= S.alert, warnC = !dz && sf >= S.warn;
 x.translate(mc.x + (dz || alertC ? Math.sin(R.t * 70) * (dz ? 1.2 : 1.6) : 0), mc.y + (dz || alertC ? Math.cos(R.t * 63) * 1.2 : 0));
 const fl = mc.fl > 0;
 x.globalCompositeOperation = 'lighter'; x.globalAlpha = .35; x.fillStyle = '#7dff6a'; x.beginPath(); x.arc(0, 0, mc.r * 1.7, 0, 7); x.fill();
 x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
 x.rotate(dz ? .4 : R.t * 1.4); x.strokeStyle = dz ? '#8a9a8a' : fl ? '#fff' : alertC ? ((R.t * 12 | 0) % 2 ? '#ff6a4d' : '#ffd24a') : warnC ? '#ffd24a' : '#d8ffc8'; x.lineWidth = 2.4; x.fillStyle = dz ? 'rgba(20,30,22,.9)' : 'rgba(30,90,40,.85)'; pgon(x, mc.r, 4, 0); x.fill(); x.stroke();
 if (warnC || alertC) { x.strokeStyle = alertC ? '#ff6a4d' : '#ffd24a'; x.lineWidth = 1.2; x.globalAlpha = .9; x.beginPath(); x.moveTo(-mc.r * .9, -mc.r * .2); x.lineTo(-mc.r * .1, mc.r * .15); x.lineTo(mc.r * .3, -mc.r * .35); x.lineTo(mc.r * .9, mc.r * .25); x.stroke(); x.globalAlpha = 1; }
 x.rotate(dz ? 0 : -R.t * 2.8); x.lineWidth = 1.4; x.strokeStyle = dz ? '#5a665a' : '#7dff6a'; pgon(x, mc.r * .6, 4, 0); x.stroke();
 x.restore();
 if (mc.bs === 1) { // BEAM telegraph: converging ring on the Core, red-hot aim line that tracks, then locks and thickens
  const M = LEAK.mainCore, lock = mc.bT <= M.beamLock, Lr = Math.min(M.beamLen, bossBounds(mc.x, mc.y, mc.ba)), dx = Math.cos(mc.ba), dy = Math.sin(mc.ba), k = 1 - cl(mc.bT / M.beamTele, 0, 1);
  x.save(); x.lineCap = 'round';
  x.globalAlpha = lock ? .5 : .3 + .3 * k; x.strokeStyle = '#ff4d3a'; x.lineWidth = lock ? 12 : 2 + 4 * k; x.beginPath(); x.moveTo(mc.x, mc.y); x.lineTo(mc.x + dx * Lr, mc.y + dy * Lr); x.stroke();
  x.globalAlpha = 1; x.strokeStyle = lock ? '#fff' : '#ffb0a0'; x.lineWidth = lock ? 2.4 : 1.2; if (!lock) x.setLineDash([7, 5]); x.lineDashOffset = -R.t * 60; x.beginPath(); x.moveTo(mc.x, mc.y); x.lineTo(mc.x + dx * Lr, mc.y + dy * Lr); x.stroke(); x.setLineDash([]);
  x.strokeStyle = lock ? '#fff' : '#ff6a4d'; x.lineWidth = 2; x.globalAlpha = .9; x.beginPath(); x.arc(mc.x, mc.y, mc.r * (3.2 - 2 * k), 0, 7); x.stroke();
  x.fillStyle = '#fff'; x.globalAlpha = .4 + .6 * k; x.beginPath(); x.arc(mc.x, mc.y, mc.r * (.5 + .7 * k), 0, 7); x.fill();
  x.restore();
 }
 x.save(); x.font = "700 8px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.lineWidth = 3; x.strokeStyle = 'rgba(0,10,4,.9)'; const lbl = mc.stg > 0 ? 'MAIN CORE: STAGGERED ' + mc.stg.toFixed(1) + 's' : mc.bs === 1 ? 'MAIN CORE: BEAM' : (mc.ps / LEAK.mainCore.stagger.threshold >= LEAK.mainCore.stagger.alert) ? 'MAIN CORE: CRACKING' : 'MAIN CORE'; x.strokeText(lbl, mc.x, mc.y - mc.r - 8); x.fillStyle = mc.stg > 0 ? '#ffffff' : mc.bs === 1 ? '#ffb0a0' : 'rgba(216,255,200,.9)'; x.fillText(lbl, mc.x, mc.y - mc.r - 8); x.restore();
}
// ----- CORE DUMP (meteor) drawing -----
function drawCraters(x) {
 const L = R.leak; if (!L || !L.craters.length) return;
 for (const c of L.craters) {
  const k = cl(c.t / c.max, 0, 1);
  x.save(); x.globalAlpha = .55 * Math.min(1, c.t) * (.4 + .6 * k);
  const g = x.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.r * .8); g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(.7, 'rgba(10,30,12,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.beginPath(); x.arc(c.x, c.y, c.r * .8, 0, 7); x.fill();
  x.globalAlpha *= 1.2; x.strokeStyle = '#ff8a3c'; x.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) { const a = i * 1.047 + c.x * .013; x.beginPath(); x.moveTo(c.x + Math.cos(a) * 6, c.y + Math.sin(a) * 6); x.lineTo(c.x + Math.cos(a + .2) * c.r * .6, c.y + Math.sin(a + .2) * c.r * .6); x.stroke(); }
  x.restore();
 }
}
function drawMeteorTele(x) { // ground telegraph: where NECROPOST's CORE DUMP will land
 const L = R.leak; if (!L || !L.meteors.length || !L.boss || L.boss.dead) return;
 for (const m of L.meteors) {
  if (m.w > 0) continue;
  const k = 1 - cl(m.t / m.T, 0, 1), late = m.t < .4, blink = late && ((R.t * 20) | 0) % 2;
  x.save();
  x.globalAlpha = .22; x.strokeStyle = '#ff6a3c'; x.lineWidth = 1.5; x.setLineDash([2, 6]); x.beginPath(); x.moveTo(m.sx, m.sy); x.lineTo(m.x, m.y); x.stroke(); x.setLineDash([]); // who is targeting
  x.globalAlpha = .12 + .3 * k; x.fillStyle = '#ff5a2c'; x.beginPath(); x.arc(m.x, m.y, m.r * k, 0, 7); x.fill();
  x.globalAlpha = .9; x.strokeStyle = 'rgba(30,0,0,.8)'; x.lineWidth = 5; x.beginPath(); x.arc(m.x, m.y, m.r, 0, 7); x.stroke();
  x.strokeStyle = blink ? '#fff' : '#ff6a3c'; x.lineWidth = 2.6; x.setLineDash([9, 6]); x.lineDashOffset = -R.t * 28; x.beginPath(); x.arc(m.x, m.y, m.r, 0, 7); x.stroke(); x.setLineDash([]);
  x.globalAlpha = .55 * (1 - k); x.lineWidth = 2; x.strokeStyle = '#ffb08a'; x.beginPath(); x.arc(m.x, m.y, m.r * (1 + 1.1 * (1 - k)), 0, 7); x.stroke(); // converging ring
  x.globalAlpha = .55; x.strokeStyle = '#7dff6a'; x.lineWidth = 1.2; x.setLineDash([3, 5]); x.beginPath(); x.arc(m.x, m.y, m.r * .8, 0, 7); x.stroke(); x.setLineDash([]); // preview: evolution flames will be left here
  x.globalAlpha = .95; x.strokeStyle = blink ? '#fff' : '#ffd0b0'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(m.x - 10, m.y); x.lineTo(m.x + 10, m.y); x.moveTo(m.x, m.y - 10); x.lineTo(m.x, m.y + 10); x.stroke();
  x.font = "700 9px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.lineWidth = 3; x.strokeStyle = 'rgba(20,0,0,.9)'; x.strokeText('CORE DUMP', m.x, m.y - m.r - 8); x.fillStyle = '#ffb08a'; x.fillText('CORE DUMP', m.x, m.y - m.r - 8);
  x.restore();
 }
}
function drawSpawnTele(x) { // warning before a Fragment / Shard appears: bright white-cyan (nothing else uses it), converging ring + light column + silhouette
 const L = R.leak; if (!L || !L.spawns.length || !L.boss || L.boss.dead) return;
 const grouped = new Set();
 for (const q of L.spawns) {
  if (q.group && q.squad === 'A') {
   const squad = L.spawns.filter(item => item.group === q.group && item.squad === 'A');
   if (squad.length > 1) {
    if (grouped.has(q.group)) continue;
    grouped.add(q.group);
    const cx = squad.reduce((sum, item) => sum + item.x, 0) / squad.length;
    const cy = squad.reduce((sum, item) => sum + item.y, 0) / squad.length;
    const radius = Math.max(...squad.map(item => Math.hypot(item.x - cx, item.y - cy))) + 28;
    const k = cl(Math.max(...squad.map(item => 1 - item.t / item.T)), 0, 1);
    const blink = squad.some(item => item.t < .18) && ((R.t * 28) | 0) % 2;
    x.save();
    x.globalCompositeOperation = 'lighter';
    x.globalAlpha = .1 + .2 * k;
    x.fillStyle = '#7dff6a';
    x.beginPath(); x.arc(cx, cy, radius, 0, 7); x.fill();
    x.globalAlpha = .9;
    x.strokeStyle = blink ? '#ffffff' : '#7dff6a';
    x.lineWidth = 2.5;
    x.setLineDash([10, 7]);
    x.lineDashOffset = -R.t * 18;
    x.beginPath(); x.arc(cx, cy, radius * (1.22 - .22 * k), 0, 7); x.stroke();
    x.setLineDash([]);
    x.globalAlpha = .75;
    x.lineWidth = 1;
    x.beginPath(); x.arc(cx, cy, radius, 0, 7); x.stroke();
    x.globalAlpha = .18 + .38 * k;
    const beam = x.createLinearGradient(cx, cy - 100, cx, cy);
    beam.addColorStop(0, 'rgba(125,255,106,0)');
    beam.addColorStop(1, 'rgba(190,255,170,.9)');
    x.fillStyle = beam;
    x.fillRect(cx - 6, cy - 100, 12, 100);
    x.restore();

    x.save();
    x.font = "700 9px 'JetBrains Mono',monospace";
    x.textAlign = 'center'; x.lineWidth = 3;
    x.strokeStyle = 'rgba(0,12,8,.95)';
    x.strokeText(`SQUAD A // ${squad.length} INBOUND`, cx, cy + radius + 14);
    x.fillStyle = '#caffbd';
    x.fillText(`SQUAD A // ${squad.length} INBOUND`, cx, cy + radius + 14);
    x.restore();
    continue;
   }
  }
  const k = cl(1 - q.t / q.T, 0, 1), big = q.lead ? 1.35 : 1, blink = q.t < .18 && ((R.t * 28) | 0) % 2;
  x.save(); x.translate(q.x, q.y); x.lineJoin = 'round';
  const col = blink ? '#ffffff' : '#7df9ff';
  x.save(); x.globalCompositeOperation = 'lighter'; const g = x.createLinearGradient(0, -90, 0, 0); g.addColorStop(0, 'rgba(125,249,255,0)'); g.addColorStop(1, 'rgba(210,255,255,.9)');
  x.globalAlpha = .2 + .5 * k; x.fillStyle = g; x.fillRect(-7 * big, -90, 14 * big, 90); x.restore(); // light column
  x.globalAlpha = .75; x.strokeStyle = '#00141c'; x.lineWidth = 5; x.beginPath(); x.arc(0, 0, 17 * big, 0, 7); x.stroke(); // dark underlay keeps it readable on any floor
  x.globalAlpha = 1; x.strokeStyle = col; x.lineWidth = 2.2; x.beginPath(); x.arc(0, 0, 17 * big, 0, 7); x.stroke();
  x.globalAlpha = .9 * (1 - k * .5); x.lineWidth = 1.8; x.beginPath(); x.arc(0, 0, (17 + 26 * (1 - k)) * big, 0, 7); x.stroke(); // converging ring
  x.globalAlpha = .35 + .55 * k; x.fillStyle = blink ? '#fff' : 'rgba(180,255,255,.9)'; x.strokeStyle = '#00141c'; x.lineWidth = 3;
  const sc = (q.kind === 'frag' ? 1.5 : 1.15) * big, r0 = q.kind === 'frag' ? 6 : 9; x.rotate(q.kind === 'frag' ? -.6 : R.t * 1.5);
  x.beginPath();
  if (q.kind === 'frag') { x.moveTo(r0 * 1.5 * sc, 0); x.lineTo(-r0 * sc, -r0 * .9 * sc); x.lineTo(-r0 * .45 * sc, 0); x.lineTo(-r0 * sc, r0 * .9 * sc); x.closePath(); }
  else for (let i = 0; i < 6; i++) { const a = i * 1.047, px = Math.cos(a) * r0 * 1.15 * sc, py = Math.sin(a) * r0 * 1.15 * sc; i ? x.lineTo(px, py) : x.moveTo(px, py); }
  if (q.kind !== 'frag') x.closePath();
  x.stroke(); x.fill(); x.restore();
  x.save(); x.font = "700 7px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.lineWidth = 3; x.strokeStyle = 'rgba(0,12,18,.95)'; const lb = (q.lead ? 'MAIN ' : '') + q.squad; x.strokeText(lb, q.x, q.y + 28 * big); x.fillStyle = '#bff8ff'; x.fillText(lb, q.x, q.y + 28 * big); x.restore();
 }
}
function drawMeteors(x) { // the falling meteor itself
 const L = R.leak, M = LEAK.meteor; if (!L || !L.meteors.length || !L.boss || L.boss.dead) return;
 for (const m of L.meteors) {
  if (m.w > 0) continue;
  const f = Math.pow(cl(m.t / m.T, 0, 1), 1.5), dist = M.fall * f, dx = Math.cos(m.fa), dy = Math.sin(m.fa), sz = 9 + 11 * (1 - f);
  const mx = m.x + dx * dist, my = m.y + dy * dist; // starts far up-left of the target and comes down onto it
  x.save();
  const tx = mx + dx * 70, ty = my + dy * 70, g = x.createLinearGradient(mx, my, tx, ty); g.addColorStop(0, 'rgba(255,170,80,.9)'); g.addColorStop(.5, 'rgba(125,255,106,.45)'); g.addColorStop(1, 'rgba(125,255,106,0)');
  x.strokeStyle = g; x.lineWidth = sz * 1.5; x.lineCap = 'round'; x.beginPath(); x.moveTo(mx, my); x.lineTo(tx, ty); x.stroke();
  x.globalCompositeOperation = 'lighter'; x.globalAlpha = .5; x.fillStyle = '#7dff6a'; x.beginPath(); x.arc(mx, my, sz * 1.9, 0, 7); x.fill(); x.globalCompositeOperation = 'source-over';
  x.globalAlpha = 1; x.translate(mx, my); x.rotate(R.t * 3 + m.x); pgon(x, sz, 7, 0); x.fillStyle = '#26361a'; x.strokeStyle = '#ff9a4a'; x.lineWidth = 2.4; x.fill(); x.stroke();
  x.fillStyle = '#eaffd0'; pgon(x, sz * .45, 5, .4); x.fill();
  x.restore();
 }
}
function drawPrismTop(x) { // drawn above projectiles so the healer never disappears behind the bullet storm
 const pr = R.en.find(e => e.prism && !e.dead); if (!pr) return;
 const t = R.t, ph = (t * .55) % 1, r = pr.r;
 x.save(); x.translate(pr.x, pr.y);
 x.globalAlpha = (1 - ph) * .55; x.strokeStyle = '#d8a6ff'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, r * 1.3 + ph * 34, 0, 7); x.stroke(); // sonar ping
 x.globalAlpha = .95; x.strokeStyle = '#f3e4ff'; x.lineWidth = 1.8; const b = r * 2.1 + Math.sin(t * 4) * 1, c = 5; // corner brackets
 for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { x.beginPath(); x.moveTo(sx * b, sy * (b - c)); x.lineTo(sx * b, sy * b); x.lineTo(sx * (b - c), sy * b); x.stroke(); }
 x.restore();
 x.save(); x.font = "700 9px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.lineWidth = 3; x.strokeStyle = 'rgba(14,4,26,.95)'; x.strokeText('PRISM', pr.x, pr.y + r * 2.7 + 6); x.fillStyle = '#e6c8ff'; x.fillText('PRISM', pr.x, pr.y + r * 2.7 + 6); x.restore();
}
function drawArmy(x, e) {
 const t = R.t, w = e.fl > 0, col = w ? '#fff' : e.c, r = e.r, UL = '#03100a', rim = w ? '#fff' : lightenHex(e.c, .6);
 x.save(); x.translate(e.x, e.y); x.lineJoin = 'round';
 const glow = (rad, a, c) => { x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = a; x.fillStyle = c; x.beginPath(); x.arc(0, 0, rad, 0, 7); x.fill(); x.restore(); };
 if (e.army === 'frag') { // dart: bright body, dark outline, soft glow, drawn larger than its hitbox so it reads against the map
  const an = Math.atan2(e.vy || 0, e.vx || 1), vs = e.lead ? 1.2 : 1.45;
  glow(r * 2.7, .32, e.c);
  x.rotate(an);
  if (e.lead) jet(x, r, e.c, '#eaffd0', -r * .9, 1.5);
  else if (SET.fl && Math.hypot(e.vx, e.vy) > 70) jet(x, r * .5, e.c, '#eaffd0', -r * .7, .8);
  x.scale(vs, vs);
  x.beginPath(); x.moveTo(r * 1.5, 0); x.lineTo(-r, -r * .9); x.lineTo(-r * .45, 0); x.lineTo(-r, r * .9); x.closePath();
  x.globalAlpha = .95; x.strokeStyle = UL; x.lineWidth = 4.4; x.stroke();
  x.globalAlpha = .88; x.fillStyle = e.c; x.fill();
  x.globalAlpha = 1; x.strokeStyle = rim; x.lineWidth = e.lead ? 2 : 1.5; x.stroke();
 } else if (e.army === 'shard') {
  const vs = e.lead ? 1.1 : 1.25;
  if (e.lead) { x.save(); x.rotate(Math.atan2(R.p.y - e.y, R.p.x - e.x)); jet(x, r, e.c, '#eaffd0', -r * .9, 1.2); x.restore(); }
  glow(r * 2.6, .3, e.c);
  x.rotate(t * .8 + e.gi); x.scale(vs, vs);
  pgon(x, r * 1.15, 6, 0);
  x.globalAlpha = .95; x.strokeStyle = UL; x.lineWidth = 4.6; x.stroke();
  x.globalAlpha = .78; x.fillStyle = e.c; x.fill();
  x.globalAlpha = 1; x.strokeStyle = rim; x.lineWidth = e.lead ? 2.4 : 1.8; x.stroke();
  x.fillStyle = '#eafff6'; x.globalAlpha = .92; pgon(x, r * .5, 3, 0.5); x.fill();
 } else if (e.army === 'core') { // ordinary Core: compact body, same green flame aura
  const kb = .8, k1 = r * .95, k2 = r * 1.5;
  if (SET.fl) { x.restore(); flameRing(x, e.x, e.y, r * 1.2, SET.fl > 1 ? 9 : 5, '#39ff6a', t + e.gi, 1.1); x.save(); x.translate(e.x, e.y); x.lineJoin = 'round'; }
  glow(r * 1.7, .3, '#39d35f');
  const legs = () => { for (let i = 0; i < 8; i++) {
   const a = i * .785 + Math.sin(t * 6 + i * 1.3) * .16, s2 = i % 2 ? 1 : -1;
   x.beginPath(); x.moveTo(Math.cos(a) * r * .6, Math.sin(a) * r * .6);
   x.lineTo(Math.cos(a - .25 * s2) * k1, Math.sin(a - .25 * s2) * k1); x.lineTo(Math.cos(a + .1 * s2) * k2, Math.sin(a + .1 * s2) * k2); x.stroke();
  } };
  x.globalAlpha = .95; x.strokeStyle = UL; x.lineWidth = 4.6; legs();
  x.strokeStyle = w ? '#fff' : '#8dff9c'; x.lineWidth = 1.9; legs();
  x.beginPath(); x.arc(0, 0, r * kb, 0, 7); x.strokeStyle = UL; x.lineWidth = 4.2; x.stroke();
  x.fillStyle = 'rgba(18,86,34,.97)'; x.fill();
  x.strokeStyle = w ? '#fff' : '#b8ffb0'; x.lineWidth = 1.9; x.stroke();
  x.fillStyle = e.sac > 0 || e.cs === 1 ? '#fff' : '#b6ff8a'; x.beginPath(); x.arc(0, 0, r * .3, 0, 7); x.fill();
 } else if (e.army === 'prism') { // PRISM: flat two-tone crystal + three small spectral lenses (same outline/rim style as the minions)
  const sh = e.shMax ? e.sh / e.shMax : 0, pu = .5 + .5 * Math.sin(t * 3.2), Hh = r * 1.5, Ww = r * .82;
  glow(r * 2.3, .24 + .08 * pu, '#b36bff');
  x.strokeStyle = '#f3e4ff'; x.lineWidth = 1.2; x.globalAlpha = .4 + .25 * pu; // simple glint cross (flat lines, no gradients)
  x.beginPath(); x.moveTo(0, -r * 2.5); x.lineTo(0, r * 2.5); x.moveTo(-r * 2, 0); x.lineTo(r * 2, 0); x.stroke(); x.globalAlpha = 1;
  const LC = ['#ffd84a', '#5ee0d0', '#ff7ad9'];
  for (let i = 0; i < 3; i++) {
   const a = t * 1.7 + i * 2.094, ox = Math.cos(a) * r * 1.6, oy = Math.sin(a) * r * .9, ls = r * .3;
   x.save(); x.translate(ox, oy);
   x.beginPath(); x.moveTo(0, -ls); x.lineTo(ls * .75, 0); x.lineTo(0, ls); x.lineTo(-ls * .75, 0); x.closePath();
   x.strokeStyle = UL; x.lineWidth = 3.2; x.stroke(); x.fillStyle = LC[i]; x.fill(); x.strokeStyle = '#fff'; x.lineWidth = .9; x.stroke(); x.restore();
  }
  const body = () => { x.beginPath(); x.moveTo(0, -Hh); x.lineTo(Ww, -Hh * .3); x.lineTo(0, Hh * .9); x.lineTo(-Ww, -Hh * .3); x.closePath(); };
  body(); x.globalAlpha = .95; x.strokeStyle = UL; x.lineWidth = 4.4; x.stroke();
  x.globalAlpha = .92; x.fillStyle = w ? '#fff' : '#b98cff'; x.fill(); // flat light half
  x.beginPath(); x.moveTo(0, -Hh); x.lineTo(0, Hh * .9); x.lineTo(-Ww, -Hh * .3); x.closePath(); x.fillStyle = w ? '#eee' : '#8a4ee6'; x.fill(); // flat dark half
  x.globalAlpha = 1; body(); x.strokeStyle = w ? '#fff' : '#f3e4ff'; x.lineWidth = 1.6; x.stroke();
  x.globalAlpha = .55; x.lineWidth = 1; x.beginPath(); x.moveTo(-Ww, -Hh * .3); x.lineTo(Ww, -Hh * .3); x.stroke(); x.globalAlpha = 1;
  x.fillStyle = '#fff'; x.beginPath(); x.arc(0, -Hh * .3, r * .2, 0, 7); x.fill();
  if (sh > 0) { x.globalAlpha = .3 + .45 * sh + (e.shHit > 0 ? .3 : 0); x.strokeStyle = '#5ee0d0'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, r * 2.05, 0, 7); x.stroke(); }
 }
 x.restore();
 if (e.prism) { // separate [CORRUPT] meter above the character (not in the boss HUD)
  const bw = 40, bx = e.x - bw / 2, by = e.y - e.r - 24, m = cl(e.corrupt / LEAK.prism.meter, 0, 1);
  x.save(); x.textAlign = 'center'; x.font = "700 7px 'JetBrains Mono',monospace"; x.fillStyle = '#d8a6ff'; x.fillText('[CORRUPT]', e.x, by - 3);
  x.fillStyle = 'rgba(179,107,255,.2)'; x.fillRect(bx, by, bw, 4); x.fillStyle = '#c77dff'; x.fillRect(bx, by, bw * m, 4);
  x.strokeStyle = 'rgba(216,166,255,.6)'; x.lineWidth = 1; x.strokeRect(bx, by, bw, 4);
  x.restore();
 } else if (e.lead) {
  x.save(); x.textAlign = 'center'; x.font = "700 7px 'JetBrains Mono',monospace"; x.fillStyle = e.c; x.fillText(e.army === 'frag' ? 'MAIN FRAGMENT' : 'MAIN SHARD', e.x, e.y - e.r - 8); x.restore();
 } else if (e.variant) {
  const name = e.variant === 'sapper' ? 'SAPPER FRAGMENT' : e.variant === 'lance' ? 'LANCE SHARD' : 'SCATTER SHARD';
  x.save(); x.textAlign = 'center'; x.font = "700 7px 'JetBrains Mono',monospace"; x.fillStyle = e.c; x.fillText(name, e.x, e.y - e.r - 8); x.restore();
 }
 if (!e.lead && e.evo > 0 && e.army !== 'core') { // evolution progress
  const need = LEAK.evo.need[e.army], m = cl(e.evo / need, 0, 1);
  x.save(); x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(e.x - 8, e.y + e.r + 4, 16, 2); x.fillStyle = '#9dff7a'; x.fillRect(e.x - 8, e.y + e.r + 4, 16 * m, 2); x.restore();
 }
}
function drawArmyTelegraphs(x, e) {
 if (!e.army || e.dead) return;
 x.save();
 if (e.variant === 'sapper' && e.sapperT > 0) {
  const V = LEAK.variants.frag.sapper, len = Math.min(V.range, bossBounds(e.x, e.y, e.sapperAng)), dx = Math.cos(e.sapperAng), dy = Math.sin(e.sapperAng);
  const progress = cl(1 - e.sapperT / V.tele, 0, 1);
  x.strokeStyle = '#3dffc4'; x.globalAlpha = .3 + progress * .55; x.lineWidth = 1.5 + progress * 1.5; x.setLineDash([5, 5]); x.lineDashOffset = -R.t * 35;
  x.beginPath(); x.moveTo(e.x, e.y); x.lineTo(e.x + dx * len, e.y + dy * len); x.stroke(); x.setLineDash([]);
  x.globalAlpha = .75; x.beginPath(); x.arc(e.x + dx * len, e.y + dy * len, 5 + progress * 4, 0, 7); x.stroke();
 }
 if (e.army === 'core') {
  if (e.cs === 1) {
   const lock = e.cT <= .28, Lr = bossBounds(e.x, e.y, e.cang), dx = Math.cos(e.cang), dy = Math.sin(e.cang);
   x.strokeStyle = '#39ff6a'; x.globalAlpha = lock ? .3 : .45; x.lineWidth = lock ? 8 : 1; x.beginPath(); x.moveTo(e.x, e.y); x.lineTo(e.x + dx * Lr, e.y + dy * Lr); x.stroke();
   x.globalAlpha = lock ? 1 : .5; x.lineWidth = lock ? 1.8 : 1; x.beginPath(); x.moveTo(e.x, e.y); x.lineTo(e.x + dx * Lr, e.y + dy * Lr); x.stroke();
  }
  if (e.sac > 0) { const k = 1 - e.sac / 1.1; x.globalAlpha = .6; x.strokeStyle = '#7dff6a'; x.lineWidth = 2; x.beginPath(); x.arc(e.x, e.y, 62 * k, 0, 7); x.stroke(); x.globalAlpha = .25; x.beginPath(); x.arc(e.x, e.y, 62, 0, 7); x.stroke(); }
 }
 if (e.prism) {
  const P = LEAK.prism;
  if (e.hc && e.hc.tgt && !e.hc.tgt.dead) { // HEALING LASER: gold-white, smooth wavy beam with travelling '+' and a ring + countdown arc on the target
   const h = e.hc, tg = h.tgt, dx = tg.x - e.x, dy = tg.y - e.y, dist = Math.hypot(dx, dy) || 1, ux = dx / dist, uy = dy / dist, nx = -uy, ny = ux;
   if (h.t > 0) { // attaching: dashed line reaches out to the target
    const k = 1 - cl(h.t / P.tele, 0, 1);
    x.strokeStyle = HEAL_C; x.globalAlpha = .45 + .4 * k; x.lineWidth = 2; x.setLineDash([6, 5]); x.lineDashOffset = -R.t * 40;
    x.beginPath(); x.moveTo(e.x, e.y); x.lineTo(e.x + dx * k, e.y + dy * k); x.stroke(); x.setLineDash([]);
    x.globalAlpha = .9; x.lineWidth = 1.6; x.beginPath(); x.arc(tg.x, tg.y, tg.r + 7 + 8 * (1 - k), 0, 7); x.stroke();
   } else {
    const n = Math.max(6, Math.round(dist / 7)), wob = (u) => Math.sin(u * dist * .09 - R.t * 13) * 3.2 * Math.sin(u * Math.PI);
    const path = () => { x.beginPath(); for (let i = 0; i <= n; i++) { const u = i / n, o = wob(u), px = e.x + dx * u + nx * o, py = e.y + dy * u + ny * o; i ? x.lineTo(px, py) : x.moveTo(px, py); } };
    x.lineCap = 'round'; x.lineJoin = 'round';
    x.globalAlpha = .9; x.strokeStyle = 'rgba(70,40,0,.85)'; x.lineWidth = 8; path(); x.stroke();      // dark underlay: separates it from the map
    x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = .55; x.strokeStyle = HEAL_C; x.lineWidth = 6.5; path(); x.stroke(); x.restore();
    x.globalAlpha = 1; x.strokeStyle = '#fff6c8'; x.lineWidth = 2.4; path(); x.stroke();
    for (let j = 0; j < 4; j++) { // '+' marks travelling from PRISM to the target
     const u = (R.t * .9 + j / 4) % 1, o = wob(u), px = e.x + dx * u + nx * o, py = e.y + dy * u + ny * o;
     x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(px - 3.5, py); x.lineTo(px + 3.5, py); x.moveTo(px, py - 3.5); x.lineTo(px, py + 3.5); x.stroke();
    }
    const rem = cl(h.life / P.healDur, 0, 1); // target marker + remaining-connection arc
    x.globalAlpha = .95; x.strokeStyle = 'rgba(70,40,0,.85)'; x.lineWidth = 5; x.beginPath(); x.arc(tg.x, tg.y, tg.r + 8, 0, 7); x.stroke();
    x.strokeStyle = HEAL_C; x.lineWidth = 2.4; x.beginPath(); x.arc(tg.x, tg.y, tg.r + 8, -1.5708, -1.5708 + 6.283 * rem); x.stroke();
    for (let j = 0; j < 3; j++) { const u = (R.t * .8 + j / 3) % 1, py = tg.y - tg.r - 2 - u * 18, px = tg.x + Math.sin(j * 2.1 + R.t * 2) * (tg.r + 2); x.globalAlpha = 1 - u; x.strokeStyle = '#fff3b0'; x.lineWidth = 1.8; x.beginPath(); x.moveTo(px - 3, py); x.lineTo(px + 3, py); x.moveTo(px, py - 3); x.lineTo(px, py + 3); x.stroke(); }
   }
  }
  if (e.cc && e.cc.tgt && !e.cc.tgt.dead) { // CORRUPT BOOST: violet/magenta jagged lightning + spiked target mark (nothing gold, nothing smooth)
   const c2 = e.cc, tg = c2.tgt, dx = tg.x - e.x, dy = tg.y - e.y, dist = Math.hypot(dx, dy) || 1, nx = -dy / dist, ny = dx / dist, k = 1 - cl(c2.t / P.corrTele, 0, 1), seed = Math.floor(R.t * 22);
   const n = Math.max(5, Math.round(dist / 12));
   const zig = () => { x.beginPath(); x.moveTo(e.x, e.y); for (let i = 1; i < n; i++) { const u = i / n, o = (Math.sin(seed * 12.9 + i * 78.2) * 43758.5 % 1) * 12 * (i % 2 ? 1 : -1); x.lineTo(e.x + dx * u + nx * o, e.y + dy * u + ny * o); } x.lineTo(tg.x, tg.y); };
   x.lineCap = 'round'; x.lineJoin = 'miter';
   x.globalAlpha = .35 + .6 * k; x.strokeStyle = '#1a0630'; x.lineWidth = 6; zig(); x.stroke();
   x.strokeStyle = '#ff5ce0'; x.lineWidth = 3.2; zig(); x.stroke();
   x.strokeStyle = CORR_C; x.lineWidth = 1.4; x.globalAlpha = .95; x.stroke();
   x.globalAlpha = .95; x.strokeStyle = CORR_C; x.lineWidth = 2; const rr = tg.r + 8 + 6 * (1 - k); // spiked reticle
   for (let j = 0; j < 8; j++) { const a = j * .785 + R.t * 2; x.beginPath(); x.moveTo(tg.x + Math.cos(a) * rr, tg.y + Math.sin(a) * rr); x.lineTo(tg.x + Math.cos(a) * (rr + 6), tg.y + Math.sin(a) * (rr + 6)); x.stroke(); }
   x.save(); x.font = "700 8px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.fillStyle = '#e6b8ff'; x.fillText('CORRUPT', tg.x, tg.y - tg.r - 16); x.restore();
  }
 }
 x.restore();
}

function drawMerged(x, e) {
 const t = R.t, r = e.r;
 const body = (cx, cy, col, a) => {
  x.save();
  x.globalAlpha = .22 * a; x.fillStyle = col; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
  x.globalAlpha = a; x.strokeStyle = e.fl > 0 ? '#fff' : col; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
  x.font = `700 ${Math.round(r * 1.5)}px 'JetBrains Mono',monospace`; x.fillStyle = e.fl > 0 ? '#fff' : col; x.fillText(e.g, cx, cy + 1);
  x.restore();
 };
 if (e.splitT > 0) {
  const s = 1 - e.splitT / RACE.splitTime, ease = s * s * (3 - 2 * s), D = 38 * ease;
  x.save();
  x.globalAlpha = .6 * (1 - ease); x.strokeStyle = '#ffffff'; x.lineWidth = Math.max(.5, r * 1.6 * (1 - ease)); x.lineCap = 'round';
  x.beginPath(); x.moveTo(e.x - D, e.y); x.lineTo(e.x + D, e.y); x.stroke();
  x.restore();
  body(e.x - D, e.y, RACE.red, 1); body(e.x + D, e.y, RACE.blue, 1);
  x.save(); x.globalAlpha = (1 - s) * .5; x.strokeStyle = '#ffffff'; x.lineWidth = 2; x.beginPath(); x.arc(e.x, e.y, r + 6 + 30 * s, 0, 7); x.stroke(); x.restore();
  return;
 }
 const o = 3 + Math.sin(t * 9) * 1.6, j = Math.sin(t * 23) * 1.1;
 body(e.x - o * 2.4, e.y - j, RACE.red, .25); body(e.x + o * 2.4, e.y + j, RACE.blue, .25); // afterimages
 body(e.x - o, e.y - j * .5, RACE.red, 1); body(e.x + o, e.y + j * .5, RACE.blue, 1);
}
function drawRaceAoE(x) {
 const r0 = R.race;
 if (!r0) return;
 const cb = r0.cb;
 if (cb) {
  const C = RACE.grid, S = C.cell;
  x.save(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = "700 11px 'JetBrains Mono',monospace";
  for (const c of cb.cells) {
   if (c.pop > 0 || (c.par === 0 && cb.wave >= 1) || (c.par === 1 && cb.wave >= 2)) continue;
   const at = c.par ? cb.tele + cb.beat : cb.tele, rem = at - cb.t, u = cl(1 - rem / at, 0, 1), h = S / 2 - 2 + c.pad;
   const live = c.par === 0 || cb.wave >= 1, flash = rem < .16 && ((R.t * 24) | 0) % 2;
   x.globalAlpha = live ? .14 + .3 * u : .07 + .1 * u; x.fillStyle = flash ? '#fff' : c.col;
   x.fillRect(c.x - h, c.y - h, h * 2, h * 2);
   x.globalAlpha = live ? .95 : .5; x.strokeStyle = c.col; x.lineWidth = live ? 2.2 : 1.4; x.strokeRect(c.x - h, c.y - h, h * 2, h * 2);
   const ih = h * u; x.globalAlpha = live ? .6 : .3; x.fillStyle = c.col; x.fillRect(c.x - ih, c.y - ih, ih * 2, ih * 2);
   x.globalAlpha = live ? 1 : .6; x.fillStyle = '#fff'; x.fillText(c.par ? '2' : '1', c.x, c.y + 1);
  }
  x.restore();
 }
 if (r0.stk && r0.stk.length) {
  x.save(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = "700 9px 'JetBrains Mono',monospace";
  const st = r0.stk;
  x.strokeStyle = '#ffffff'; x.globalAlpha = .35; x.lineWidth = 1; x.setLineDash([3, 4]);
  x.beginPath(); st.forEach((n, i) => { if (i) x.lineTo(n.x, n.y); else x.moveTo(n.x, n.y); }); x.stroke(); x.setLineDash([]);
  for (const n of st) {
   const soon = n.t < .14;
   x.globalAlpha = soon ? .55 : .2; x.fillStyle = soon ? '#fff' : n.col; x.beginPath(); x.arc(n.x, n.y, n.r, 0, 7); x.fill();
   x.globalAlpha = .9; x.strokeStyle = n.col; x.lineWidth = 2; x.beginPath(); x.arc(n.x, n.y, n.r, 0, 7); x.stroke();
   x.globalAlpha = 1; x.fillStyle = '#fff'; x.fillText('#' + n.i, n.x, n.y + 1);
  }
  x.restore();
 }
}
function drawLockRing(x, e) {
 const L = R.race.lock, frac = Math.max(0, L.dur) / (L.max || 1);
 x.save();
 x.strokeStyle = '#9fe8ff'; x.lineWidth = 2.2; x.globalAlpha = .9; x.shadowColor = '#9fe8ff'; x.shadowBlur = 8;
 poly(x, e.r + 8, 6, R.t * 1.2, 0); x.stroke();
 x.shadowBlur = 0; x.strokeStyle = '#e8fbff'; x.lineWidth = 3; x.globalAlpha = .95;
 x.beginPath(); x.arc(e.x, e.y, e.r + 14, -Math.PI / 2, -Math.PI / 2 + 6.283 * frac); x.stroke();
 x.restore();
}
function drawRaceLinks(x) {
 const r0 = R.race;
 if (!r0 || !r0.split) return;
 const a = r0.red, b = r0.blue;
 if (!a || !b || a.dead || b.dead) return;
 const prog = 1 - Math.min(1, (r0.tetherT || 0) / RACE.tether.arm), dashing = !!(a.dash || b.dash), live = prog >= 1 && !dashing;
 const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
 const qn = Math.floor(R.t * 28), rnd = i => { const v = Math.sin(i * 12.9898 + qn * 78.233) * 43758.5453; return v - Math.floor(v); };
 const pt = (u, amp) => { const w = Math.sin(Math.PI * u) * amp * (rnd(Math.round(u * 60)) * 2 - 1); return [a.x + dx * u + nx * w, a.y + dy * u + ny * w]; };
 x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
 if (live) {
  // live electric tripwire: crackling arc, danger field, forks and sparks, flaring pylons on both Hosts
  x.globalAlpha = .08; x.strokeStyle = '#b36bff'; x.lineWidth = 26; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
  const seg = Math.max(6, Math.round(len / 14));
  const path = () => { x.beginPath(); x.moveTo(a.x, a.y); for (let i = 1; i < seg; i++) { const p = pt(i / seg, 6); x.lineTo(p[0], p[1]); } x.lineTo(b.x, b.y); };
  x.shadowColor = '#b36bff'; x.shadowBlur = 10; x.globalAlpha = .55; x.strokeStyle = '#a566ff'; x.lineWidth = 6; path(); x.stroke();
  x.shadowBlur = 0; x.globalAlpha = .95; x.strokeStyle = '#e2c4ff'; x.lineWidth = 2.6; path(); x.stroke();
  x.strokeStyle = '#ffffff'; x.lineWidth = 1.1; path(); x.stroke();
  x.strokeStyle = '#d9a6ff'; x.lineWidth = 1.2; x.globalAlpha = .8;
  for (let k = 0; k < 3; k++) {
   const u = .12 + rnd(k * 7 + 1) * .76, p = pt(u, 6), sd = rnd(k * 5 + 3) > .5 ? 1 : -1, l = 10 + rnd(k * 3 + 9) * 12;
   x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(p[0] + nx * sd * l * .7 + ux * l * (rnd(k + 11) - .5), p[1] + ny * sd * l * .7 + uy * l * (rnd(k + 17) - .5)); x.stroke();
  }
  x.fillStyle = '#f1e2ff';
  for (const e of [a, b]) { x.globalAlpha = .5 + .35 * rnd(e === a ? 1 : 2); x.beginPath(); x.arc(e.x, e.y, 4 + rnd(5) * 3, 0, 7); x.fill(); }
 } else {
  // charging / dormant tripwire: a dotted wire growing from both ends toward the middle, with a spark crawling along it
  const u1 = dashing ? .5 : .5 * prog;
  x.setLineDash([4, 6]); x.lineWidth = dashing ? 1.6 : 2.2; x.strokeStyle = dashing ? '#8a86c9' : '#a566ff'; x.globalAlpha = dashing ? .5 : .55 + .4 * prog;
  x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(a.x + dx * u1, a.y + dy * u1); x.moveTo(b.x, b.y); x.lineTo(b.x - dx * u1, b.y - dy * u1); x.stroke();
  x.setLineDash([]);
  const cu = (R.t * .9) % 1 * u1; x.globalAlpha = .95; x.shadowColor = '#b36bff'; x.shadowBlur = 8; x.fillStyle = '#ffffff';
  x.beginPath(); x.arc(a.x + dx * cu, a.y + dy * cu, 2.8, 0, 7); x.fill(); x.beginPath(); x.arc(b.x - dx * cu, b.y - dy * cu, 2.8, 0, 7); x.fill(); x.shadowBlur = 0;
 }
 x.restore();
 const L = r0.lock;
 if (L && L.state === 'transit' && L.from) {
  x.save(); x.globalAlpha = .75; x.strokeStyle = '#9fe8ff'; x.lineWidth = 2; x.setLineDash([4, 6]); x.lineDashOffset = -R.t * 80;
  x.beginPath(); x.moveTo(L.from.x, L.from.y); x.lineTo(L.holder.x, L.holder.y); x.stroke(); x.restore();
 }
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

 // Race Condition: each process shows its tell. Red = dash lane with >>> chevrons (tracks you, then locks); blue = aim lines / sniper line (aim tracks, then locks).
 if (e.race && e.rp && !e.dead && !(e.splitT > 0)) {
  ctx.globalCompositeOperation = 'source-over'; // normal blending so the tells read on light arenas too
  for (const k in e.rp) {
   const pr = e.rp[k];
   if (pr.st !== 1) continue;
   const lock = pr.lock, col = k === 'red' ? RACE.red : RACE.blue;
   ctx.strokeStyle = col; ctx.fillStyle = col;
   if (k === 'red') {
    const L = RACE.dash.sp * RACE.dash.t + e.r, dx = Math.cos(pr.ang), dy = Math.sin(pr.ang), ux = -dy, uy = dx, nx = ux * e.r, ny = uy * e.r;
    ctx.globalAlpha = lock ? .34 : .13 + .07 * Math.sin(now * 14);
    ctx.beginPath(); ctx.moveTo(e.x + nx, e.y + ny); ctx.lineTo(e.x + dx * L + nx, e.y + dy * L + ny); ctx.lineTo(e.x + dx * L - nx, e.y + dy * L - ny); ctx.lineTo(e.x - nx, e.y - ny); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = lock ? 1 : .55; ctx.lineWidth = lock ? 2.5 : 1.4;
    ctx.beginPath(); ctx.moveTo(e.x + nx, e.y + ny); ctx.lineTo(e.x + dx * L + nx, e.y + dy * L + ny); ctx.moveTo(e.x - nx, e.y - ny); ctx.lineTo(e.x + dx * L - nx, e.y + dy * L - ny); ctx.stroke();
    // >>> chevrons scrolling along the lane: loose and dim while tracking, solid, bright and fast once locked
    ctx.strokeStyle = lock ? '#fff0f0' : col; ctx.lineWidth = lock ? 2.8 : 2; ctx.globalAlpha = lock ? .95 : .5; ctx.lineJoin = 'miter';
    const gap = 24, off = (now * (lock ? 240 : 70)) % gap;
    for (let sd = e.r + 4 + off; sd < L - 8; sd += gap) {
     const cx = e.x + dx * sd, cy = e.y + dy * sd;
     ctx.beginPath(); ctx.moveTo(cx - dx * 7 + ux * 10, cy - dy * 7 + uy * 10); ctx.lineTo(cx + dx * 7, cy + dy * 7); ctx.lineTo(cx - dx * 7 - ux * 10, cy - dy * 7 - uy * 10); ctx.stroke();
    }
    ctx.strokeStyle = col; ctx.fillStyle = col;
   } else if (pr.variant === 1 || pr.variant === 3) {
    const C = RACE.shoot, nn = pr.variant === 3 ? 3 : C.n, sp = pr.variant === 3 ? C.burst.spread : C.spread;
    ctx.globalAlpha = lock ? .85 : .3; ctx.lineWidth = lock ? 2 : 1.2;
    for (let i = 0; i < nn; i++) {
     const an = pr.ang + (i - (nn - 1) / 2) * sp;
     ctx.beginPath(); ctx.moveTo(e.x + Math.cos(an) * (e.r + 4), e.y + Math.sin(an) * (e.r + 4)); ctx.lineTo(e.x + Math.cos(an) * 170, e.y + Math.sin(an) * 170); ctx.stroke();
    }
   } else if (pr.variant === 2) {
    // sniper: a thin line across the arena that locks almost at the last moment
    const dx = Math.cos(pr.ang), dy = Math.sin(pr.ang);
    const SL = rayLen(e.x, e.y, pr.ang, 900), ex = e.x + dx * SL, ey = e.y + dy * SL;
    if (lock) { ctx.globalAlpha = .28; ctx.lineWidth = RACE.snipe.w; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(ex, ey); ctx.stroke(); }
    ctx.globalAlpha = lock ? 1 : .4; ctx.lineWidth = lock ? 1.8 : 1;
    ctx.beginPath(); ctx.moveTo(e.x + dx * (e.r + 4), e.y + dy * (e.r + 4)); ctx.lineTo(ex, ey); ctx.stroke();
    if (lock) { ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ex, ey, 9, 0, 7); ctx.moveTo(ex - 14, ey); ctx.lineTo(ex + 14, ey); ctx.moveTo(ex, ey - 14); ctx.lineTo(ex, ey + 14); ctx.stroke(); }
   }
   const prog = 1 - Math.max(0, pr.t) / (pr.T || 1);
   ctx.globalAlpha = .5; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4 + 16 * (1 - prog), 0, 7); ctx.stroke();
  }
 }

 // Runtime Error boss: teleport telegraph (bold on purpose: path, converging landing ring, flashing boss).
 if (e.boss && e.tpd && !e.dead) {
  const tx = e.tpd.x, ty = e.tpd.y, dx = tx - e.x, dy = ty - e.y, len = Math.hypot(dx, dy) || 1;
  const prog = e.tpd.go ? 1 : cl(1 - e.tpd.t / .9, 0, 1), blink = .65 + .35 * Math.sin(now * 28);
  ctx.save(); ctx.lineCap = 'round';
  ctx.shadowColor = c; ctx.shadowBlur = 12;
  ctx.globalAlpha = .55 + .35 * blink; ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -now * 90;
  ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = .9; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(tx, ty); ctx.stroke();
  const ah = Math.atan2(dy, dx); ctx.fillStyle = '#fff'; ctx.globalAlpha = .95; // arrow head at the destination
  ctx.beginPath(); ctx.moveTo(tx - Math.cos(ah) * 26, ty - Math.sin(ah) * 26); ctx.lineTo(tx - Math.cos(ah + 2.6) * 10 - Math.cos(ah) * 26, ty - Math.sin(ah + 2.6) * 10 - Math.sin(ah) * 26); ctx.lineTo(tx - Math.cos(ah - 2.6) * 10 - Math.cos(ah) * 26, ty - Math.sin(ah - 2.6) * 10 - Math.sin(ah) * 26); ctx.closePath(); ctx.fill();
  const r = 20 + (1 - prog) * 26; // landing ring shrinks onto the destination
  ctx.globalAlpha = .22 + .3 * prog; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(tx, ty, 34, 0, 7); ctx.fill();
  ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tx, ty, r, 0, 7); ctx.stroke();
  ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(tx, ty, 20, 0, 7); ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + now * 2; ctx.moveTo(tx + Math.cos(a) * 24, ty + Math.sin(a) * 24); ctx.lineTo(tx + Math.cos(a) * 36, ty + Math.sin(a) * 36); }
  ctx.stroke();
  ctx.globalAlpha = .5 + .4 * blink; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6 + prog * 10, 0, 7); ctx.stroke(); // departure ring on the boss
  { // i-frame marker: sits at the middle of the path, then rides it while she is invulnerable
   const pg = e.tpd.go ? 1 - e.tpd.tr / RTE.transit : .5, mx = e.x + dx * pg, my = e.y + dy * pg, live = !!e.tpd.go, mr = live ? 9 : 6;
   ctx.globalAlpha = live ? 1 : .8; ctx.fillStyle = live ? '#fff' : 'rgba(234,220,255,.35)'; ctx.strokeStyle = '#eadcff'; ctx.lineWidth = 2;
   ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill(); ctx.stroke();
   ctx.beginPath(); ctx.moveTo(mx, my - mr - 5); ctx.lineTo(mx + mr + 5, my); ctx.lineTo(mx, my + mr + 5); ctx.lineTo(mx - mr - 5, my); ctx.closePath(); ctx.stroke();
   ctx.fillStyle = '#eadcff'; ctx.font = "700 7px 'JetBrains Mono',monospace"; ctx.textAlign = 'center'; ctx.fillText('I-FRAME', mx, my - mr - 9);
  }
  ctx.restore();
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

 if (shape === 'seg_barrage' || shape === 'seg_homing') {
  ctx.globalAlpha = .35; ctx.strokeStyle = '#ff9ba6'; ctx.lineWidth = r * .8;
  ctx.beginPath(); ctx.moveTo(-r * 7, 0); ctx.lineTo(-r * 1.8, 0); ctx.stroke();
  ctx.globalAlpha = 1; ctx.fillStyle = shape === 'seg_barrage' ? '#ff5267' : '#ff8791';
  ctx.beginPath(); ctx.moveTo(r * 2.8, 0); ctx.lineTo(-r * 1.4, -r * .8); ctx.lineTo(-r * 2.1, 0); ctx.lineTo(-r * 1.4, r * .8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff1cf'; ctx.beginPath(); ctx.arc(r * .7, 0, Math.max(1.1, r * .24), 0, 7); ctx.fill();
  ctx.globalAlpha = .9; ctx.fillStyle = '#ffbd69';
  ctx.beginPath(); ctx.moveTo(-r * 1.8, -r * .45); ctx.lineTo(-r * 3.4, 0); ctx.lineTo(-r * 1.8, r * .45); ctx.closePath(); ctx.fill();
  ctx.restore(); return;
 } else if (!enemy && shape === 'fireball') {
  fireBlob(ctx, r * 1.18, q.x * .05 + q.y * .03); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = '#ffd36a'; fireBlob(ctx, r * .70, 2.1); ctx.fill();
  ctx.fillStyle = '#fff7db'; ctx.beginPath(); ctx.arc(r * .20, -r * .16, Math.max(1.2, r * .23), 0, 7); ctx.fill();
 } else if (!enemy && shape === 'bolt') {
  ctx.beginPath(); ctx.arc(0, 0, r * 1.04, 0, 7); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = '#eaffff'; ctx.beginPath(); ctx.arc(r * .18, -r * .15, Math.max(1.1, r * .25), 0, 7); ctx.fill();
 } else if (shape === 'lance') {
  // Lance: concave arrowhead — sharp tip, swept-back barbs, notched tail where the jet burns.
  const L = r * 2.7, Wk = r * 1.15, bx = -L * .66, notch = -L * .22;
  jet(ctx, r, col, hot, notch, 1.05, Wk * .45);
  let bodyCol = col;
  if (enemy) {
   bodyCol = ctx.createLinearGradient(-L, 0, L, 0);
   bodyCol.addColorStop(0, '#3dffc4'); bodyCol.addColorStop(.55, '#7dff6a'); bodyCol.addColorStop(1, '#eaffd0');
  }
  ctx.shadowBlur = Math.max(2, r * .9); ctx.fillStyle = bodyCol;
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
 } else if (shape === 'snipe') {
  // Sniper round: the bolt model (round core + highlight) in blue, with a long speed streak
  const sg = ctx.createLinearGradient(0, 0, -r * 16, 0);
  sg.addColorStop(0, 'rgba(130,175,255,.9)'); sg.addColorStop(1, 'rgba(130,175,255,0)');
  ctx.strokeStyle = sg; ctx.lineWidth = r * 1.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 16, 0); ctx.stroke();
  ctx.strokeStyle = outline; ctx.lineWidth = Math.max(1.1, r * .24);
  ctx.beginPath(); ctx.arc(0, 0, r * 1.15, 0, 7); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = '#eaf3ff'; ctx.beginPath(); ctx.arc(r * .2, -r * .15, Math.max(1.2, r * .3), 0, 7); ctx.fill();
 } else if (shape === 'hex') {
  const sp6 = (R?.t || 0) * 3 + q.x * .02;
  poly(ctx, r * 1.2, 6, sp6, 0); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = lightenHex(col, .6); poly(ctx, r * .55, 6, -sp6, 0); ctx.fill();
 } else if (shape === 'leak') {
  poly(ctx, r * 1.17, 7, -.25, .09);
  ctx.save(); ctx.shadowBlur = 0; ctx.strokeStyle = '#020b05'; ctx.lineWidth = Math.max(3.4, r * .75); ctx.stroke(); ctx.restore();
  ctx.fill(); ctx.strokeStyle = '#f2ffe0'; ctx.lineWidth = Math.max(1.3, r * .27); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = '#fffbe0'; fireBlob(ctx, r*.52, q.x*.05); ctx.fill();
 } else if (shape === 'segfault') {
  fireBlob(ctx, r*1.18, q.y*.04); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = '#ff9d8a'; poly(ctx, r*.52, 5, -.15, .04); ctx.fill();
 } else {
  ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = hot; ctx.beginPath(); ctx.arc(r*.12,-r*.10,Math.max(1.1,r*.24),0,7); ctx.fill();
 }
 // Keep the two mini-jets visibly outside the projectile body.
 if ((!enemy || SET.ef) && shape !== 'snipe') jet(ctx, r, col, hot);
 ctx.restore();
}

function drawSegfaultMissile(x, target, progress) {
 const angle = -Math.PI / 2 - .3, dx = Math.cos(angle), dy = Math.sin(angle);
 const distance = LEAK.meteor.fall * cl(1 - progress, 0, 1), mx = target.x + dx * distance, my = target.y + dy * distance;
 x.save();
 const tx = mx + dx * 70, ty = my + dy * 70, flame = x.createLinearGradient(mx, my, tx, ty);
 x.globalAlpha = .28; x.strokeStyle = '#ff6b61'; x.lineWidth = 2; x.setLineDash([3, 7]);
 x.beginPath(); x.moveTo(target.x, target.y); x.lineTo(mx, my); x.stroke(); x.setLineDash([]);
 x.globalAlpha = 1;
 flame.addColorStop(0, 'rgba(255,245,225,.98)'); flame.addColorStop(.25, 'rgba(255,116,75,.9)'); flame.addColorStop(1, 'rgba(255,64,84,0)');
 x.strokeStyle = flame; x.lineWidth = 16; x.lineCap = 'round';
 x.beginPath(); x.moveTo(mx, my); x.lineTo(tx, ty); x.stroke();
 x.globalCompositeOperation = 'lighter'; x.globalAlpha = .48; x.fillStyle = '#ff536b';
 x.beginPath(); x.arc(mx, my, 13, 0, Math.PI * 2); x.fill();
 x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
 x.translate(mx, my); x.rotate(angle);
 x.beginPath(); x.moveTo(15, 0); x.lineTo(-8, -7); x.lineTo(-4, 0); x.lineTo(-8, 7); x.closePath();
 x.fillStyle = '#70202f'; x.strokeStyle = '#ffc0a1'; x.lineWidth = 2.2; x.fill(); x.stroke();
 x.fillStyle = '#fff1d6'; x.beginPath(); x.arc(4, 0, 2.4, 0, Math.PI * 2); x.fill();
 x.restore();
}

function drawSegfaultJetpack(x, e, angle) {
 const P = STDOUT_PAL[2], detail = [4, 7, 11][SET.fl], pulse = .86 + .14 * Math.sin(R.t * 34);
 x.save(); x.translate(e.x, e.y); x.rotate(angle);
 for (const side of [-1, 1]) {
  x.save(); x.translate(-e.r * .48, side * e.r * .42);
  const length = (32 + e.r * 1.25) * pulse, width = e.r * .24;
  const glow = x.createRadialGradient(-length * .48, 0, 1, -length * .48, 0, length * .58);
  glow.addColorStop(0, `rgba(${P.core[0]},.9)`);
  glow.addColorStop(.45, `rgba(${P.core[1]},.48)`);
  glow.addColorStop(1, `rgba(${P.core[2]},0)`);
  x.globalCompositeOperation = 'lighter'; x.fillStyle = glow;
  x.beginPath(); x.ellipse(-length * .48, 0, length * .58, width * 1.8, 0, 0, Math.PI * 2); x.fill();
  x.globalCompositeOperation = 'source-over';
  for (let i = 0; i < detail; i++) {
   const u = detail > 1 ? i / (detail - 1) * 2 - 1 : 0;
   const flicker = Math.sin(R.t * 25 + i * 2.1 + side) * .06;
   const flameLength = length * (.72 + .28 * Math.cos(u * 1.25));
   const flameWidth = width * (.45 + .32 * (1 - Math.abs(u)));
   const g = x.createLinearGradient(0, 0, -flameLength, 0);
   g.addColorStop(0, `rgba(${P.tg[0]},.95)`);
   g.addColorStop(.3, `rgba(${P.tg[1]},.82)`);
   g.addColorStop(.68, `rgba(${P.tg[2]},.58)`);
   g.addColorStop(1, `rgba(${P.tg[3]},0)`);
   x.fillStyle = g; x.beginPath(); x.moveTo(0, -flameWidth * .42);
   x.quadraticCurveTo(-flameLength * .34, -flameWidth * (1 + flicker), -flameLength, flicker * length);
   x.quadraticCurveTo(-flameLength * .38, flameWidth, 0, flameWidth * .42); x.closePath(); x.fill();
  }
  x.globalAlpha = .95; x.strokeStyle = `rgba(${P.core[0]},.9)`; x.lineWidth = Math.max(1.5, width * .24);
  x.beginPath(); x.moveTo(-2, 0); x.quadraticCurveTo(-length * .28, -width * .16, -length * .62, 0); x.stroke();
  x.restore();
 }
 x.restore();
}

function segChevrons(x, x1, y1, x2, y2, col, size = 6, gap = 38) {
 const len = Math.hypot(x2 - x1, y2 - y1);
 if (len < 40) return;
 const ang = Math.atan2(y2 - y1, x2 - x1);
 x.save(); x.strokeStyle = col; x.lineWidth = 2; x.lineCap = 'round'; x.lineJoin = 'round'; x.setLineDash([]);
 for (let s = 26 + (R.t * 70) % gap; s < len - 10; s += gap) {
  x.save(); x.translate(x1 + Math.cos(ang) * s, y1 + Math.sin(ang) * s); x.rotate(ang);
  x.globalAlpha = .75; x.beginPath(); x.moveTo(-size, -size); x.lineTo(size * .5, 0); x.lineTo(-size, size); x.stroke();
  x.restore();
 }
 x.restore();
}
// stdout stream: the Host's stdout() flame language (hot core, gradient tongues, sparks) shot along a lane, then ground fire that gutters out before the lane expires.
function drawStdoutStream(x, t) {
 // the flames themselves are stdout cones (see the trail update); this only draws the heat bed and the damage-width edges so the hitbox stays readable
 const P = STDOUT_PAL[t.tier ?? 2], dx = t.x2 - t.x1, dy = t.y2 - t.y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
 const reach = len * cl((t.age || 0) / Math.max(.01, t.grow || .3), 0, 1), w = t.width;
 const fireK = Math.pow(cl(t.t / Math.min(1.2, t.T), 0, 1), .6) * (t.t < 1 && Math.sin(R.t * 34) < -.2 ? .5 : 1);
 x.save(); x.lineCap = 'round';
 x.globalCompositeOperation = 'lighter'; x.globalAlpha = .12 * fireK; x.strokeStyle = 'rgba(' + P.core[2] + ',1)'; x.lineWidth = w * 2.2;
 x.beginPath(); x.moveTo(t.x1, t.y1); x.lineTo(t.x1 + ux * reach, t.y1 + uy * reach); x.stroke();
 x.globalCompositeOperation = 'source-over'; x.globalAlpha = .3 * fireK; x.strokeStyle = P.hot; x.lineWidth = 1; x.setLineDash([4, 5]); x.lineDashOffset = -R.t * 20;
 for (const s of [-1, 1]) { x.beginPath(); x.moveTo(t.x1 - uy * s * (w + 7), t.y1 + ux * s * (w + 7)); x.lineTo(t.x1 + ux * reach - uy * s * (w + 7), t.y1 + uy * reach + ux * s * (w + 7)); x.stroke(); }
 x.restore();
}
// Bulkhead door between the keep and the launch bay: hazard-striped and sealed until the intro breaks it; afterwards a permanent breach with rubble.
function drawSegSteel(x, w) {
 x.save(); x.globalAlpha = .97; x.fillStyle = '#18212c'; x.fillRect(w.x, w.y, w.w, w.h);
 x.strokeStyle = '#a9bccf'; x.lineWidth = 2; x.strokeRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
 x.globalAlpha = .4; x.lineWidth = 1; x.beginPath(); x.moveTo(w.x + 5, w.y + w.h - 5); x.lineTo(w.x + w.w - 5, w.y + 5); x.moveTo(w.x + 5, w.y + 5); x.lineTo(w.x + w.w - 5, w.y + w.h - 5); x.stroke();
 x.globalAlpha = .9; x.fillStyle = '#e4eef8';
 for (const [rx, ry] of [[4, 4], [w.w - 4, 4], [4, w.h - 4], [w.w - 4, w.h - 4]]) { x.beginPath(); x.arc(w.x + rx, w.y + ry, 1.5, 0, 7); x.fill(); }
 x.restore();
}
function drawSegDoor(x, wall) {
 x.save();
 if (wall.hp > 0) {
  const alarm = R.bossIntro && !R.bossIntro.hit, pulse = .5 + .5 * Math.sin(R.t * (alarm ? 14 : 3));
  x.globalAlpha = .96; x.fillStyle = '#1a0a10'; x.fillRect(wall.x, wall.y, wall.w, wall.h);
  x.save(); x.beginPath(); x.rect(wall.x, wall.y, wall.w, wall.h); x.clip(); x.fillStyle = '#ff8a3c'; x.globalAlpha = .5;
  for (let i = -wall.h; i < wall.w + wall.h; i += 18) { x.beginPath(); x.moveTo(wall.x + i, wall.y + wall.h); x.lineTo(wall.x + i + 9, wall.y + wall.h); x.lineTo(wall.x + i + 9 + wall.h, wall.y); x.lineTo(wall.x + i + wall.h, wall.y); x.fill(); }
  x.restore();
  x.globalAlpha = .95; x.strokeStyle = '#ff677c'; x.lineWidth = 2; x.strokeRect(wall.x, wall.y, wall.w, wall.h);
  x.globalAlpha = (alarm ? .55 : .3) + .4 * pulse; x.strokeStyle = '#ff2f4e'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(wall.x + wall.w / 2, wall.y + 6); x.lineTo(wall.x + wall.w / 2, wall.y + wall.h - 6); x.stroke();
  x.fillStyle = '#ffd5d9'; x.globalAlpha = .8;
  for (const by of [wall.y + 10, wall.y + wall.h / 2, wall.y + wall.h - 10]) { x.beginPath(); x.arc(wall.x + 4, by, 1.6, 0, 7); x.arc(wall.x + wall.w - 4, by, 1.6, 0, 7); x.fill(); }
 } else {
  for (let i = 0; i < 16; i++) {
   const h1 = Math.sin(i * 91.7) * 43758.5453, r1 = h1 - Math.floor(h1), h2 = Math.sin(i * 12.9 + 4.1) * 43758.5453, r2 = h2 - Math.floor(h2);
   const rx = wall.x - 26 + r1 * 70, ry = wall.y + 6 + r2 * (wall.h - 12), s = 3 + r1 * 6;
   x.globalAlpha = .65; x.fillStyle = i % 3 ? '#2a1218' : '#4a2028'; x.fillRect(rx, ry, s * 1.6, s);
   x.globalAlpha = .55; x.strokeStyle = '#ff677c'; x.lineWidth = 1; x.strokeRect(rx, ry, s * 1.6, s);
  }
  x.globalAlpha = .35 + .15 * Math.sin(R.t * 3); x.fillStyle = '#ff9a45';
  x.fillRect(wall.x, wall.y - 2, wall.w, 3); x.fillRect(wall.x, wall.y + wall.h - 1, wall.w, 3);
 }
 x.restore();
}

function drawSegfaultScene(x) {
 const S = R.seg;
 if (!S) return;
 x.save();
 for (const wall of S.walls) {
  if (wall.type === 'door') { drawSegDoor(x, wall); continue; }
  if (wall.type === 'steel') { drawSegSteel(x, wall); continue; }
  const intact = wall.hp > 0, holo = wall.type === 'holo', color = wall.heat > 0 ? '#ff9a45' : holo ? '#65eaff' : '#ff677c';
  x.globalAlpha = intact ? (holo ? .22 : .48 + .32 * wall.hp / wall.max) : cl((wall.regenAt - R.t) / 2, .08, .28);
  x.fillStyle = color;
  x.fillRect(wall.x, wall.y, wall.w, wall.h);
  x.globalAlpha = intact ? .95 : .45;
  x.strokeStyle = color; x.lineWidth = holo ? 1.4 : 1;
  if (holo) x.setLineDash([4, 3]);
  x.strokeRect(wall.x, wall.y, wall.w, wall.h);
  x.setLineDash([]);
  if (intact && wall.hp < wall.max * .7) {
   x.globalAlpha = .75; x.strokeStyle = '#ffe1dd'; x.lineWidth = 1;
   x.beginPath(); x.moveTo(wall.x + wall.w * .3, wall.y + 1); x.lineTo(wall.x + wall.w * .55, wall.y + wall.h * .5); x.lineTo(wall.x + wall.w * .42, wall.y + wall.h - 1); x.stroke();
  }
  if (wall.heat > 0) {
   x.globalAlpha = .8 * (.65 + Math.sin(R.t * 16) * .2);
   x.strokeStyle = '#fff1b0'; x.lineWidth = 2;
   x.strokeRect(wall.x - 2, wall.y - 2, wall.w + 4, wall.h + 4);
  }
 }
 for (const trail of S.trails) drawStdoutStream(x, trail);
 for (const laser of S.lasers) {
  x.globalAlpha = .18; x.strokeStyle = '#ff263e'; x.lineWidth = 14;
  x.beginPath(); x.moveTo(laser.x1, laser.y1); x.lineTo(laser.x2, laser.y2); x.stroke();
  x.globalAlpha = .9; x.strokeStyle = '#ff5364'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(laser.x1, laser.y1); x.lineTo(laser.x2, laser.y2); x.stroke();
  x.globalAlpha = .95; x.fillStyle = '#ffe7ea';
  x.beginPath(); x.arc(laser.x1, laser.y1, 3, 0, 7); x.arc(laser.x2, laser.y2, 3, 0, 7); x.fill();
 }
 for (const rl of S.relays || []) { // relay turrets: charge ring + locked aim line + one pip per round in the burst
  if (rl.hacked) { // taken over: cyan ring + tag
   x.save(); x.globalAlpha = .9; x.strokeStyle = '#7ee8ff'; x.lineWidth = 2; x.beginPath(); x.arc(rl.x, rl.y, 16, 0, Math.PI * 2); x.stroke();
   x.fillStyle = '#7ee8ff'; x.font = "700 8px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.fillText('HACKED', rl.x, rl.y - 24); x.restore(); continue;
  }
  if (rl.qte) { // QTE plate: roman numeral = the key to press (I=1 ... IV=4), symbol is just flavour
   const q = rl.qte, Q = SEGFAULT.qte, n = q.seq.length, w = n * 34 + 10, px = cl(rl.x - w / 2, 4, W - w - 4), py = Math.max(4, rl.y - 66);
   x.save(); x.strokeStyle = '#7ee8ff'; x.lineWidth = 3; x.globalAlpha = .9; x.beginPath(); x.arc(rl.x, rl.y, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cl(q.t / Q.time, 0, 1)); x.stroke();
   x.globalAlpha = .94; x.fillStyle = 'rgba(5,10,20,.9)'; x.fillRect(px, py, w, 36); x.lineWidth = 1.5; x.strokeRect(px, py, w, 36);
   x.textAlign = 'center';
   for (let i = 0; i < n; i++) {
    const cx = px + 5 + i * 34 + 17, cur = i === q.i, done = i < q.i;
    x.fillStyle = done ? '#7dffb0' : cur ? '#ffe08a' : '#9fb4c8'; x.font = "700 12px 'JetBrains Mono',monospace"; x.fillText(SEG_NUM[q.seq[i]], cx, py + 15);
    x.font = "700 11px 'JetBrains Mono',monospace"; x.fillText(SEG_SYM[q.seq[i]], cx, py + 29);
    if (cur) { x.fillStyle = '#ffe08a'; x.fillRect(cx - 12, py + 32, 24, 2); }
   }
   x.fillStyle = '#7ee8ff'; x.font = "700 7px 'JetBrains Mono',monospace"; x.fillText('HACK // PRESS 1 2 3 4 = I II III IV', rl.x, py - 4);
   x.restore();
  } else if (rl.near && !(rl.hcd > 0)) { // prompt
   x.save(); x.fillStyle = '#7ee8ff'; x.globalAlpha = .9; x.font = "700 9px 'JetBrains Mono',monospace"; x.textAlign = 'center';
   x.fillText(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'HACKING...' : 'PRESS [E] TO HACK', rl.x, rl.y - 30); x.restore();
  }
  if (false) { // (old hold-to-hack ring, replaced by the QTE)
   x.save(); x.strokeStyle = '#7ee8ff'; x.fillStyle = '#7ee8ff'; x.lineWidth = 3; x.globalAlpha = .35 + .5 * (rl.hack || 0);
   x.beginPath(); x.arc(rl.x, rl.y, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (rl.hack || 0)); x.stroke();
   x.globalAlpha = .9; x.font = "700 9px 'JetBrains Mono',monospace"; x.textAlign = 'center';
   if (rl.near) x.fillText(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'HACKING...' : 'HOLD [E] TO HACK', rl.x, rl.y - 30);
   x.restore();
  }
  if (rl.state === 'charge') {
   const k = 1 - rl.t / SEGFAULT.relay.telegraph, lockedLine = rl.t <= .22;
   x.save();
   x.globalAlpha = .35 + .5 * k; x.strokeStyle = lockedLine ? '#fff0f2' : '#ffb48a'; x.lineWidth = lockedLine ? 2.5 : 1.8; x.setLineDash(lockedLine ? [] : [5, 6]); x.lineDashOffset = -R.t * 30;
   x.beginPath(); x.moveTo(rl.x, rl.y); x.lineTo(rl.x + Math.cos(rl.aim) * 130, rl.y + Math.sin(rl.aim) * 130); x.stroke(); x.setLineDash([]);
   x.globalAlpha = .9; x.lineWidth = 2; x.beginPath(); x.arc(rl.x, rl.y, 26 - 12 * k, 0, Math.PI * 2); x.stroke();
   x.fillStyle = '#ffb48a'; for (let n = 0; n < SEGFAULT.relay.burst; n++) { x.beginPath(); x.arc(rl.x + Math.cos(rl.aim) * (44 + n * 24), rl.y + Math.sin(rl.aim) * (44 + n * 24), 3.5, 0, 7); x.fill(); }
   x.restore();
  } else if (rl.flash > 0) {
   x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = rl.flash / .14 * .6; x.fillStyle = '#ffb48a'; x.beginPath(); x.arc(rl.x, rl.y, 22, 0, 7); x.fill(); x.restore();
  }
 }
 if (S.boss?.segTankStun > 0) { // fuel leak: armour-up ring + label
  const b = S.boss; x.save(); x.globalAlpha = .5 + .3 * Math.sin(R.t * 10); x.strokeStyle = '#ffb36b'; x.lineWidth = 2; x.setLineDash([6, 4]);
  x.beginPath(); x.arc(b.x, b.y, b.r + 8, 0, Math.PI * 2); x.stroke(); x.setLineDash([]); x.globalAlpha = .95; x.fillStyle = '#ffb36b';
  x.font = "700 10px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.fillText('FUEL LEAK // ARMOUR UP', b.x, b.y - b.r - 18); x.restore();
 }
 if (S.boss?.segStun > 0) { // stunned: orbiting stars + label
  const b = S.boss;
  x.save(); x.fillStyle = '#ffe08a'; x.globalAlpha = .95;
  for (let n = 0; n < 3; n++) { const a = R.t * 5 + n * 2.09; x.beginPath(); x.arc(b.x + Math.cos(a) * (b.r + 8), b.y - b.r - 4 + Math.sin(a) * 5, 3, 0, 7); x.fill(); }
  x.font = "700 10px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.fillText('STUNNED', b.x, b.y - b.r - 18);
  x.restore();
 }
 if (S.relays?.some(r => r.qte)) { // on-screen numbered buttons (touch + a visual key reference)
  x.save(); x.textAlign = 'center';
  for (let i = 0; i < 4; i++) {
   const b = qteBtn(i); x.globalAlpha = .88; x.fillStyle = 'rgba(5,10,20,.9)'; x.fillRect(b.x, b.y, b.w, b.h); x.strokeStyle = '#7ee8ff'; x.lineWidth = 1.5; x.strokeRect(b.x, b.y, b.w, b.h);
   x.fillStyle = '#e8f4ff'; x.font = "700 14px 'JetBrains Mono',monospace"; x.fillText(SEG_NUM[i], b.x + b.w / 2, b.y + 18);
   x.fillStyle = '#7ee8ff'; x.font = "700 9px 'JetBrains Mono',monospace"; x.fillText(SEG_SYM[i] + '  [' + (i + 1) + ']', b.x + b.w / 2, b.y + 33);
  }
  x.restore();
 }
 const boss = R.seg.boss;
 for (const tele of S.telegraphs) {
  const progress = 1 - tele.t / tele.T, d = tele.data;
  x.globalAlpha = .4 + .45 * progress;
  x.strokeStyle = '#ffd5d9'; x.lineWidth = 1.5; x.setLineDash([6, 5]); x.lineDashOffset = -R.t * 24;
  if (tele.type === 'volley') {
   if (d.pattern === 'ring') {
    x.beginPath(); x.arc(boss.x, boss.y, 27 + progress * 8, 0, Math.PI * 2); x.stroke();
    for (let i = 0; i < 5; i++) {
     const an = i * Math.PI * 2 / 5 + d.angle;
     x.beginPath(); x.moveTo(boss.x + Math.cos(an) * 32, boss.y + Math.sin(an) * 32);
     x.lineTo(boss.x + Math.cos(an) * 52, boss.y + Math.sin(an) * 52); x.stroke();
    }
   } else {
    const len = 230;
    x.beginPath(); x.moveTo(boss.x, boss.y); x.lineTo(boss.x + Math.cos(d.angle) * len, boss.y + Math.sin(d.angle) * len); x.stroke();
    x.beginPath(); x.arc(boss.x + Math.cos(d.angle) * len, boss.y + Math.sin(d.angle) * len, 7 + progress * 4, 0, Math.PI * 2); x.stroke();
   }
  } else if (tele.type === 'homing') {
   const an = Math.atan2(d.y - boss.y, d.x - boss.x);
   x.beginPath(); x.moveTo(boss.x, boss.y); x.lineTo(boss.x + Math.cos(an) * 110, boss.y + Math.sin(an) * 110); x.stroke();
   x.beginPath(); x.arc(boss.x, boss.y, 20 + progress * 10, 0, 7); x.stroke();
  } else if (tele.type === 'barrage') {
   const aim = Math.atan2(d.y - boss.y, d.x - boss.x);
   for (let i = 0; i < 5; i++) {
    const an = aim + i * Math.PI * 2 / 5, tx = d.x + Math.cos(an) * 95, ty = d.y + Math.sin(an) * 95;
    const r = 14 + progress * 4;
    x.beginPath(); x.arc(tx, ty, r, 0, 7); x.stroke();
    x.save(); x.setLineDash([]); x.globalAlpha = .9; x.strokeStyle = '#fff0f2'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(tx - 8, ty - 8); x.lineTo(tx + 8, ty + 8); x.moveTo(tx + 8, ty - 8); x.lineTo(tx - 8, ty + 8); x.stroke();
    x.restore();
   }
   x.beginPath(); x.arc(d.x, d.y, 11 + progress * 3, 0, 7); x.stroke();
   x.save(); x.setLineDash([]); x.globalAlpha = .95; x.strokeStyle = '#fff0f2'; x.lineWidth = 3;
   x.beginPath(); x.moveTo(d.x - 9, d.y - 9); x.lineTo(d.x + 9, d.y + 9); x.moveTo(d.x + 9, d.y - 9); x.lineTo(d.x - 9, d.y + 9); x.stroke();
   x.restore();
  } else if (tele.type === 'airstrike') {
   x.setLineDash([]);
   for (const target of d.strikes) {
    x.globalAlpha = .14; x.fillStyle = '#ff536b';
    x.fillRect(target.x - 34, target.y - 34, 68, 68);
    x.globalAlpha = .95; x.strokeStyle = '#ff7382'; x.lineWidth = 2;
    x.strokeRect(target.x - 34, target.y - 34, 68, 68);
    x.strokeStyle = '#fff1f3'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(target.x - 10, target.y - 10); x.lineTo(target.x + 10, target.y + 10);
    x.moveTo(target.x + 10, target.y - 10); x.lineTo(target.x - 10, target.y + 10); x.stroke();
    drawSegfaultMissile(x, target, progress);
   }
  } else if (tele.type === 'flame') { // intentionally no visual telegraph
  } else if (tele.type === 'stdout') {
   const len = d.range || 340, ex = boss.x + Math.cos(d.angle) * len, ey = boss.y + Math.sin(d.angle) * len;
   x.save(); x.setLineDash([8, 7]); x.lineDashOffset = -R.t * 24;
   x.globalAlpha = .82; x.strokeStyle = '#c987ff'; x.lineWidth = 2.2;
   x.beginPath(); x.moveTo(boss.x, boss.y); x.lineTo(ex, ey); x.stroke(); x.setLineDash([]);
   segChevrons(x, boss.x, boss.y, ex, ey, '#e3b8ff');
   x.globalAlpha = .88; x.beginPath(); x.arc(ex, ey, 7 + progress * 3, 0, Math.PI * 2); x.stroke();
   x.beginPath(); x.moveTo(ex - 11, ey); x.lineTo(ex + 11, ey); x.moveTo(ex, ey - 11); x.lineTo(ex, ey + 11); x.stroke();
   x.globalAlpha = .1 + .08 * progress; x.fillStyle = '#bf70ff';
   x.beginPath(); x.moveTo(boss.x, boss.y);
   x.lineTo(boss.x + Math.cos(d.angle - .08) * len, boss.y + Math.sin(d.angle - .08) * len);
   x.lineTo(boss.x + Math.cos(d.angle + .08) * len, boss.y + Math.sin(d.angle + .08) * len); x.closePath(); x.fill();
   x.restore();
  } else if (tele.type === 'dead-zone') {
   x.setLineDash([]); x.globalAlpha = .92; x.strokeStyle = '#ff637b'; x.lineWidth = 2.5;
   for (const line of S.protocol?.lines || []) { x.beginPath(); x.moveTo(line.x1, line.y1); x.lineTo(line.x2, line.y2); x.stroke(); }
   x.globalAlpha = .95; x.strokeStyle = '#fff0f2'; x.lineWidth = 1.5;
   for (const [nx, ny] of ARENAS[G.cfg.arena].nodes || []) {
    x.beginPath(); x.arc(nx, ny, 8 + progress * 3, 0, Math.PI * 2); x.moveTo(nx - 12, ny); x.lineTo(nx + 12, ny); x.moveTo(nx, ny - 12); x.lineTo(nx, ny + 12); x.stroke();
   }
  } else if (tele.type === 'jet-dash') {
   x.beginPath(); x.moveTo(boss.x, boss.y); x.lineTo(d.x, d.y); x.stroke();
   segChevrons(x, boss.x, boss.y, d.x, d.y, '#ffd5d9');
   x.beginPath(); x.arc(d.x, d.y, 18, 0, 7); x.stroke();
  } else if (tele.type === 'stack') {
   let lx = boss.x, ly = boss.y;
   for (const route of d.routes) { x.beginPath(); x.moveTo(lx, ly); x.lineTo(route.x, route.y); x.stroke(); segChevrons(x, lx, ly, route.x, route.y, '#9fc8ff'); lx = route.x; ly = route.y; }
  }
  x.setLineDash([]);
 }
 x.restore();
}
function drawSegfaultTanks(x, e) {
 const S = R.seg;
 if (!S?.tanks) return;
 x.save(); x.translate(e.x, e.y); x.rotate(e.faceAng || 0);
 S.tanks.forEach((t, i) => {
  const w = 8, h = 18;
  x.save(); x.translate(-e.r - 3, (i ? 1 : -1) * 9);
  x.globalAlpha = 1; x.fillStyle = '#1a0f14'; x.strokeStyle = t.broken ? '#6b5560' : t.hit > 0 ? '#fff0c2' : '#ffb36b'; x.lineWidth = 1.6;
  x.fillRect(-w / 2, -h / 2, w, h); x.strokeRect(-w / 2, -h / 2, w, h);
  if (!t.broken && t.fuel > .02) { x.globalAlpha = .9; x.fillStyle = t.fuel < .35 ? '#ff5c7a' : '#ff9a45'; x.fillRect(-w / 2 + 1.5, h / 2 - 1.5 - (h - 3) * t.fuel, w - 3, (h - 3) * t.fuel); }
  x.globalAlpha = 1; x.fillStyle = '#ffd0a0'; x.fillRect(-w / 2 - 1, -h / 2 - 2, w + 2, 2);
  if (t.broken) { x.fillStyle = '#ffb36b'; for (let k = 0; k < 3; k++) x.fillRect((Math.random() - .5) * 12, (Math.random() - .5) * 20, 2, 2); }
  x.restore();
 });
 x.restore();
}
function drawSegfaultArmor(x, e) {
 const S = R.seg;
 if (!S) return;
 x.save();
 if (!S.phase3) {
  const offsets = { front: 0, back: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 };
  for (const plate of S.plates) {
   if (plate.dead) continue;
   const an = (e.faceAng || 0) + offsets[plate.side], px = e.x + Math.cos(an) * (e.r + 5), py = e.y + Math.sin(an) * (e.r + 5), health = plate.hp / plate.max;
   x.save(); x.translate(px, py); x.rotate(an);
   x.globalAlpha = .18 + .38 * health; x.fillStyle = '#ff6578'; x.fillRect(-7, -11, 14, 22);
   x.globalAlpha = .95; x.strokeStyle = health < .4 ? '#ffd6a0' : '#ff9aaa'; x.lineWidth = 2;
   x.beginPath(); x.moveTo(-7, -11); x.lineTo(6, -11); x.lineTo(8, -5); x.lineTo(8, 7); x.lineTo(4, 11); x.lineTo(-7, 11); x.closePath(); x.stroke();
   if (health < .72) { x.lineWidth = 1; x.beginPath(); x.moveTo(-4, -8); x.lineTo(1, -2); x.lineTo(-2, 3); x.lineTo(4, 8); x.stroke(); }
   x.restore();
  }
 } else {
  const O = S.overload, active = O.state === 'absorbing' || O.state === 'overloading';
  x.translate(e.x, e.y); x.rotate(e.faceAng || 0);
  if (active || O.state === 'reviving') {
   x.globalAlpha = O.state === 'reviving' ? .4 + Math.sin(R.t * 14) * .2 : .32 + .55 * O.charge / SEGFAULT.phase3.overload.threshold + (O.hit > 0 ? .22 : 0);
   x.fillStyle = O.state === 'overloading' ? '#eaa3ff' : '#ff687e';
   x.strokeStyle = '#ffd8de'; x.lineWidth = 2;
   x.beginPath(); x.moveTo(e.r + 2, -18); x.lineTo(e.r + 18, -13); x.lineTo(e.r + 23, 0); x.lineTo(e.r + 18, 13); x.lineTo(e.r + 2, 18); x.closePath(); x.fill(); x.stroke();
  }
  if (O.state !== 'off') {
   const k = cl(O.charge / SEGFAULT.phase3.overload.threshold, 0, 1);
   x.globalAlpha = .95; x.fillStyle = '#1b0c15'; x.fillRect(-25, -e.r - 17, 50, 5);
   x.fillStyle = k > .72 ? '#f6a8ff' : '#ff687e'; x.fillRect(-25, -e.r - 17, 50 * k, 5);
   x.strokeStyle = '#ffd8de'; x.lineWidth = 1; x.strokeRect(-25, -e.r - 17, 50, 5);
   x.font = "700 7px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.fillStyle = '#ffdce2';
   x.fillText(O.state === 'absorbing' ? 'OVERLOAD' : O.state.toUpperCase(), 0, -e.r - 22);
  }
 }
 x.restore();
}
function drawSegfaultIntro(x) {
 const intro = R.bossIntro, C = SEGFAULT.intro, st = intro.st || 0, mech = R.en.find(e => e.boss && !e.dead), host = R.p, rm = intro.reducedMotion;
 x.save();
 // 1. launch bay alarm: red wash and beacons until the bulkhead gives way
 if (!intro.hit) {
  const flash = rm ? .5 : .5 + .5 * Math.sin(st * 13);
  x.globalAlpha = .06 + .1 * flash * cl(st / .4, 0, 1); x.fillStyle = '#ff2f4e'; x.fillRect(718, 0, W - 718, H);
  for (const [bx, by] of [[740, 40], [920, 40], [740, 520], [920, 520], [709, 200]]) {
   x.globalAlpha = .3 + .6 * flash; x.fillStyle = '#ff3b55'; x.beginPath(); x.arc(bx, by, 6, 0, 7); x.fill();
   x.globalCompositeOperation = 'lighter'; x.globalAlpha = .25 * flash; x.beginPath(); x.arc(bx, by, 24, 0, 7); x.fill(); x.globalCompositeOperation = 'source-over';
  }
 }
 // 2. location card
 if (st < C.dashAt + .5) {
  const a = cl(Math.min(st / .4, (C.dashAt + .5 - st) / .4), 0, 1);
  x.globalAlpha = a; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(5,2,8,.78)'; x.fillRect(W / 2 - 170, 40, 340, 56);
  x.strokeStyle = '#ff5267'; x.lineWidth = 1; x.strokeRect(W / 2 - 170, 40, 340, 56);
  x.fillStyle = '#ffe9eb'; x.font = "700 20px 'JetBrains Mono',monospace"; x.fillText('CITADEL 403', W / 2, 62);
  x.fillStyle = '#ff8793'; x.font = "700 9px 'JetBrains Mono',monospace"; x.fillText('LAUNCH BAY 03 // UNIT ONLINE', W / 2, 82);
 }
 // 3. launch lane: same dashed line + chevrons the jetpack dash telegraph uses
 if (mech && st > .5 && st < C.hitAt) {
  x.globalAlpha = cl((st - .5) / .4, 0, 1) * .9; x.strokeStyle = '#ffd5d9'; x.lineWidth = 1.5; x.setLineDash([6, 5]); x.lineDashOffset = -R.t * 24;
  x.beginPath(); x.moveTo(C.bay[0], C.bay[1]); x.lineTo(C.hit[0] - 30, C.hit[1]); x.stroke(); x.setLineDash([]);
  segChevrons(x, C.bay[0], C.bay[1], C.hit[0] - 30, C.hit[1], '#ff8793');
 }
 // 4. impact: flash ring, cross and flying bulkhead shards
 if (intro.hit && st < C.hitAt + .8) {
  const k = cl(1 - (st - C.hitAt) / .8, 0, 1), ix = 709, iy = C.hit[1];
  x.globalAlpha = k; x.strokeStyle = '#fff0c2'; x.lineWidth = 2;
  x.beginPath(); x.arc(ix, iy, 14 + (1 - k) * 60, 0, Math.PI * 2); x.moveTo(ix - 12, iy - 12); x.lineTo(ix + 12, iy + 12); x.moveTo(ix + 12, iy - 12); x.lineTo(ix - 12, iy + 12); x.stroke();
 }
 for (const s of intro.shards || []) {
  x.save(); x.translate(s.x, s.y); x.rotate(s.a); x.globalAlpha = cl(s.l / .4, 0, 1); x.fillStyle = s.c; x.fillRect(-s.w / 2, -s.h / 2, s.w, s.h); x.restore();
 }
 // 5. scan: the beams sweep, then lock on the Host
 if (mech && st >= C.skidEnd) {
  const scanT = cl((st - C.skidEnd) / (C.dlgAt - C.skidEnd), 0, 1), locked = scanT >= 1;
  const sweep = Math.atan2(host.y - mech.y, host.x - mech.x) + (rm ? 0 : Math.sin(scanT * 5.2) * (1 - scanT) * .8), len = Math.hypot(W, H);
  const col = locked ? '#ff5267' : '#ffb070';
  x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = locked ? .07 : .1; x.fillStyle = col;
  x.beginPath(); x.moveTo(mech.x, mech.y); x.lineTo(mech.x + Math.cos(sweep - .06) * len, mech.y + Math.sin(sweep - .06) * len); x.lineTo(mech.x + Math.cos(sweep + .06) * len, mech.y + Math.sin(sweep + .06) * len); x.closePath(); x.fill(); x.restore();
  for (const off of [-.045, .045]) {
   x.globalAlpha = locked ? .55 : .4; x.strokeStyle = col; x.lineWidth = locked ? 2 : 1.2; x.setLineDash(locked ? [] : [5, 7]);
   x.beginPath(); x.moveTo(mech.x, mech.y); x.lineTo(mech.x + Math.cos(sweep + off) * len, mech.y + Math.sin(sweep + off) * len); x.stroke();
  }
  x.setLineDash([]);
  const lock = cl((scanT - .7) / .3, 0, 1), rr = 13 + (1 - lock) * 22 + (locked && !rm ? Math.sin(R.t * 8) * 1.5 : 0);
  if (scanT > .55) {
   x.globalAlpha = .85; x.strokeStyle = '#ff8793'; x.lineWidth = 1.2;
   x.beginPath(); x.arc(host.x, host.y, rr, 0, Math.PI * 2);
   x.moveTo(host.x - rr - 8, host.y); x.lineTo(host.x - rr + 2, host.y); x.moveTo(host.x + rr - 2, host.y); x.lineTo(host.x + rr + 8, host.y);
   x.moveTo(host.x, host.y - rr - 8); x.lineTo(host.x, host.y - rr + 2); x.moveTo(host.x, host.y + rr - 2); x.lineTo(host.x, host.y + rr + 8); x.stroke();
  }
  x.globalAlpha = .9; x.fillStyle = col; x.font = "700 9px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(locked ? 'TARGET LOCKED' : 'SCANNING... ' + Math.round(scanT * 100) + '%', mech.x, mech.y - mech.r - 14);
 }
 drawDlgBox(x, intro);
 // 7. last line done: red surge, then the fight begins
 if (intro.out != null) { x.globalAlpha = .4 * cl(intro.out / C.out, 0, 1); x.fillStyle = '#ff2f4e'; x.fillRect(0, 0, W, H); }
 x.restore();
}
function drawDlgBox(x, intro) {
 const rm = intro.reducedMotion;
 x.save();
 // 6. Undertale-style dialogue box
 const d = intro.dlg;
 if (d && intro.out == null) {
  const K = SEG_KIND[d.line.kind], nrows = intro.rows ||= Math.max(2, ...intro.script.map(l => dlgWrap(l.text).split('\n').length)), bw = Math.min(W - 160, 420), bh = 52 + nrows * 24, bx = Math.round((W - bw) / 2), by = H - bh - 28, ps = bh - 40, px = bx + 16, py = by + 20, tx = px + ps + 16;
  x.globalAlpha = .97; x.fillStyle = '#050208'; x.fillRect(bx, by, bw, bh);
  x.strokeStyle = K.col; x.lineWidth = 3; x.strokeRect(bx + 1.5, by + 1.5, bw - 3, bh - 3);
  x.globalAlpha = .35; x.lineWidth = 1; x.strokeRect(bx + 7.5, by + 7.5, bw - 15, bh - 15);
  x.globalAlpha = 1; x.fillStyle = '#12060c'; x.fillRect(px, py, ps, ps); x.strokeStyle = K.col; x.lineWidth = 2; x.strokeRect(px, py, ps, ps);
  const cx = px + ps / 2, cy = py + ps / 2;
  x.save(); x.beginPath(); x.rect(px, py, ps, ps); x.clip(); x.strokeStyle = K.col; x.fillStyle = K.col;
  if (K.glyph) {
   x.font = "700 44px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.globalAlpha = rm || d.phase !== 'typing' ? 1 : .75 + Math.random() * .25; x.fillText(K.glyph, cx, cy + 2);
  } else if (d.line.kind === 'radio') {
   x.lineWidth = 2; x.beginPath();
   for (let i = 0; i <= 24; i++) { const amp = (d.phase === 'typing' && !rm ? Math.random() : .25) * ps * .32; const yy = cy + (i % 2 ? -amp : amp) * Math.sin(i / 24 * Math.PI); i ? x.lineTo(px + 6 + i * (ps - 12) / 24, yy) : x.moveTo(px + 6, yy); }
   x.stroke();
  } else {
   x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, ps * .27, 0, Math.PI * 2); x.stroke();
   x.beginPath(); x.moveTo(cx - ps * .42, cy); x.lineTo(cx - ps * .16, cy); x.moveTo(cx + ps * .16, cy); x.lineTo(cx + ps * .42, cy); x.moveTo(cx, cy - ps * .42); x.lineTo(cx, cy - ps * .16); x.moveTo(cx, cy + ps * .16); x.lineTo(cx, cy + ps * .42); x.stroke();
   x.beginPath(); x.arc(cx, cy, 3 + (rm ? 0 : Math.sin(R.t * 6)), 0, Math.PI * 2); x.fill();
  }
  x.restore();
  x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.globalAlpha = 1; x.fillStyle = K.col; x.font = "700 11px 'JetBrains Mono',monospace";
  x.fillText(d.line.who, tx, by + 27);
  const rows = dlgShown(d).split('\n'), jit = d.line.shake && !rm && d.phase === 'typing' ? 1.4 : 0;
  x.fillStyle = K.txt; x.font = "700 20px 'JetBrains Mono',monospace";
  rows.forEach((row, i) => x.fillText((i ? '  ' : '* ') + row, tx + (Math.random() - .5) * jit, by + 56 + i * 24 + (Math.random() - .5) * jit));
  if (d.phase === 'fail') { x.save(); x.fillStyle = K.col; x.font = "700 9px 'JetBrains Mono',monospace"; x.globalAlpha = Math.sin(R.t * 30) > 0 ? 1 : .35; x.fillText('! LOAD FAILED // RETRYING ' + '.'.repeat(1 + Math.floor(R.t * 6) % 3), tx, by + bh - 14); x.restore(); }
  if (d.phase === 'wait' && Math.sin(R.t * 7) > -.3) { x.fillStyle = K.col; x.beginPath(); x.moveTo(bx + bw - 34, by + bh - 28); x.lineTo(bx + bw - 22, by + bh - 28); x.lineTo(bx + bw - 28, by + bh - 19); x.closePath(); x.fill(); }
  x.globalAlpha = .55; x.fillStyle = '#d8dfe0'; x.font = "9px 'JetBrains Mono',monospace"; x.textAlign = 'right';
  x.fillText('CLICK / ENTER: ' + (d.phase === 'typing' ? 'FINISH LINE' : 'NEXT'), bx + bw, by - 8);
 }
 x.restore();
}
function drawCoreIntro(x) { // Main Core telegraph during the Memory Leak dialogue
 const intro = R.bossIntro, L = R.leak, mc = L?.mc;
 if (!intro || intro.core !== 1 || !mc || L.boss.dead) return;
 const k = cl(intro.coreT / 1.1, 0, 1), r = LEAK.mainCore.r;
 x.save();
 x.strokeStyle = 'rgba(125,255,106,.35)'; x.lineWidth = 1; x.setLineDash([3, 5]); x.beginPath(); x.arc(L.boss.x, L.boss.y, LEAK.mainCore.orbit, 0, 7); x.stroke(); x.setLineDash([]);
 x.globalAlpha = .35 + .5 * k; x.strokeStyle = '#7dff6a'; x.lineWidth = 2; x.beginPath(); x.arc(mc.x, mc.y, r * (3.4 - 2.2 * k), 0, 7); x.stroke();
 x.globalAlpha = (.2 + .5 * k) * (Math.sin(R.t * 24) > 0 ? 1 : .55); x.fillStyle = '#7dff6a'; x.beginPath(); x.arc(mc.x, mc.y, r * (.3 + .7 * k), 0, 7); x.fill();
 x.globalAlpha = .9; x.fillStyle = '#d8ffc8'; x.font = "700 8px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.fillText('MAIN CORE // INIT ' + Math.round(k * 100) + '%', mc.x, mc.y - r * 3.6);
 x.restore();
}
function drawRuntimeIntro(x, intro) { // distorted teleport-in + glitching surroundings, then the dialogue box
 const t = intro.t, rm = intro.reducedMotion, boss = R.en.find(e => e.boss && !e.dead), g = rm ? .35 : cl(t / 1.0, 0, 1) * (intro.dlg ? .8 : 1);
 x.save();
 const seed = rm ? 3 : Math.floor(R.t * 16), rnd = i => { const h = Math.sin(seed * 91.7 + i * 12.9898) * 43758.5453; return h - Math.floor(h); };
 for (let i = 0; i < Math.round(14 * g); i++) {
  x.globalAlpha = (.07 + rnd(i + 120) * .12) * g; x.fillStyle = i % 3 ? '#b48cff' : '#7ee8ff';
  x.fillRect((rnd(i + 80) - .5) * 70 * g, rnd(i) * H, W * (.2 + rnd(i + 160) * .6), 2 + rnd(i + 40) * 14);
 }
 x.globalAlpha = .07 * g; x.fillStyle = '#000'; for (let y = 0; y < H; y += 4) x.fillRect(0, y, W, 1);
 if (boss && t >= intro.revealAt - .5 && t < intro.revealAt + .7) {
  const before = t < intro.revealAt, k = before ? cl((t - (intro.revealAt - .5)) / .5, 0, 1) : cl((t - intro.revealAt) / .7, 0, 1);
  x.strokeStyle = '#b48cff'; x.lineWidth = 2; x.shadowColor = '#b48cff'; x.shadowBlur = 10;
  for (let i = 0; i < 3; i++) { x.globalAlpha = before ? k : 1 - k; x.beginPath(); x.arc(boss.x, boss.y, before ? (70 - 56 * k) + i * 9 : 16 + k * (60 + i * 18), 0, 7); x.stroke(); }
  if (before) { x.globalAlpha = k; x.fillStyle = '#eadcff'; x.fillRect(boss.x - 1.5, boss.y - 90 * (1 - k) - 20, 3, 40 + 90 * (1 - k)); }
 }
 if (intro.dlg) drawDlgBox(x, intro);
 x.restore();
}
function drawBossIntro(x) {
 const intro = R.bossIntro, key = G.cfg.boss, boss = BOSSES[key], leak = key === 'leak';
 if (!intro || !boss) return;
 const t = intro.t, p = R.p, fadeOut = cl((intro.duration - t) * 2.5, 0, 1), motionScale = intro.reducedMotion ? .45 : 1;
 x.save();
 if (key === 'segfault') {
  drawSegfaultIntro(x);
 } else if (leak) {
   const cameras = [[28, 28], [W - 28, 28], [28, H - 28], [W - 28, H - 28]];
   const lock = cl((t - 1.15 * motionScale) / (.45 * motionScale), 0, 1);
  for (let i = 0; i < cameras.length; i++) {
   const [cx, cy] = cameras[i], target = Math.atan2(p.y - cy, p.x - cx);
    const sweep = target + (intro.reducedMotion ? 0 : Math.sin(t * 1.7 + i * 2.3) * (1 - lock) * 1.35);
    const color = t >= 1.5 * motionScale ? '#ff6860' : '#7dff6a';
   const reach = Math.hypot(W, H);
   x.save();
   x.globalCompositeOperation = 'lighter';
   x.globalAlpha = (t >= 1.5 * motionScale ? .17 : .1) * fadeOut;
   x.fillStyle = color;
   x.beginPath();
   x.moveTo(cx, cy);
   x.lineTo(cx + Math.cos(sweep - .12) * reach, cy + Math.sin(sweep - .12) * reach);
   x.lineTo(cx + Math.cos(sweep + .12) * reach, cy + Math.sin(sweep + .12) * reach);
   x.closePath();
   x.fill();
   x.restore();

   x.save();
   x.translate(cx, cy);
   x.rotate(sweep);
   x.globalAlpha = fadeOut;
   x.fillStyle = '#111a1b';
   x.strokeStyle = t >= 1.5 * motionScale ? '#ff6860' : '#7dff6a';
   x.lineWidth = 1.5;
   x.beginPath();
   if (x.roundRect) x.roundRect(-11, -8, 22, 16, 3);
   else x.rect(-11, -8, 22, 16);
   x.fill(); x.stroke();
   x.fillStyle = color;
   x.shadowColor = color; x.shadowBlur = intro.reducedMotion ? 0 : (t >= 1.5 * motionScale ? 10 : 4);
   x.beginPath(); x.arc(3, 0, 3.2, 0, Math.PI * 2); x.fill();
   x.restore();

   x.save();
   x.globalAlpha = fadeOut * (t >= 1.5 * motionScale && !intro.reducedMotion && (Math.floor(t * 8) % 2) ? .45 : .9);
   x.fillStyle = t >= 1.5 * motionScale ? '#ffaaa0' : '#a2ca9a';
   x.font = "700 7px 'JetBrains Mono',monospace";
   x.textAlign = cx < W / 2 ? 'left' : 'right';
   x.textBaseline = cy < H / 2 ? 'top' : 'bottom';
   x.fillText(`CAM 0${i + 1} // ${t >= 1.5 ? 'LOCK' : 'SCAN'}`, cx + (cx < W / 2 ? 14 : -14), cy + (cy < H / 2 ? 10 : -10));
   x.restore();
  }

  if (t >= 1.5 * motionScale && t < 2.6 * motionScale) {
   const pulse = intro.reducedMotion ? 1 : .75 + Math.sin(t * 18) * .2;
   const size = intro.reducedMotion ? 18 : 18 + Math.sin(t * 11) * 2;
   x.save();
   x.globalAlpha = fadeOut * pulse;
   x.strokeStyle = '#ff6860';
   x.lineWidth = 1;
   x.beginPath();
   x.moveTo(p.x - size - 5, p.y - size); x.lineTo(p.x - size, p.y - size); x.lineTo(p.x - size, p.y - size - 5);
   x.moveTo(p.x + size + 5, p.y - size); x.lineTo(p.x + size, p.y - size); x.lineTo(p.x + size, p.y - size - 5);
   x.moveTo(p.x - size - 5, p.y + size); x.lineTo(p.x - size, p.y + size); x.lineTo(p.x - size, p.y + size + 5);
   x.moveTo(p.x + size + 5, p.y + size); x.lineTo(p.x + size, p.y + size); x.lineTo(p.x + size, p.y + size + 5);
   x.stroke();
   x.restore();
  }

  if (t >= 1.5 * motionScale && t < 2.6 * motionScale) {
   const flash = intro.reducedMotion || Math.floor(t * 7) % 2 === 0;
   x.save();
   x.globalAlpha = fadeOut;
   x.fillStyle = 'rgba(7,10,12,.9)';
   x.fillRect(W / 2 - 174, 18, 348, 25);
   x.strokeStyle = flash ? '#ff6860' : '#9b4f4d';
   x.lineWidth = 1;
   x.strokeRect(W / 2 - 174, 18, 348, 25);
   x.fillStyle = flash ? '#ffd0c9' : '#ff7770';
   x.font = "700 10px 'JetBrains Mono',monospace";
   x.textAlign = 'center'; x.textBaseline = 'middle';
   x.fillText('SECURITY GRID // UNREGISTERED HOST DETECTED', W / 2, 30);
   x.restore();
  }

  if (intro.dlg) drawDlgBox(x, intro);
 } else if (key === 'runtime') {
  drawRuntimeIntro(x, intro);
 } else {
  // Other bosses intentionally have no dialogue yet; keep their intros signal-only.
  const alpha = cl(Math.min(t * 4, (intro.duration - t) * 3), 0, 1);
  const alert = t > .7 * motionScale && !intro.reducedMotion && Math.floor(t * 6) % 2 === 0;
  const actor = R.en.find(e => e.boss && !e.dead), bx = actor?.x ?? W / 2, by = actor?.y ?? H / 2;
  const scan = t < .7 * motionScale;
  x.save();
  x.globalAlpha = alpha * (scan ? .35 : .75);
  if (key === 'segfault') {
   x.strokeStyle = '#ff5c7a'; x.lineWidth = 1;
   for (let i = 0; i < 6; i++) {
    const y = (i * 79 + (intro.reducedMotion ? 0 : t * 170)) % H;
    const offset = intro.reducedMotion ? 0 : Math.sin(t * 13 + i) * 35;
    x.beginPath(); x.moveTo(offset, y); x.lineTo(W * .22 + offset, y); x.moveTo(W * .63 - offset, y + 7); x.lineTo(W, y + 7); x.stroke();
   }
   x.fillStyle = 'rgba(255,92,122,.12)';
   x.fillRect(0, H * .48 + Math.sin(t * 20) * 16, W, 2);
  } else if (key === 'runtime') {
   x.strokeStyle = '#b48cff'; x.lineWidth = 1.5;
   for (let i = 0; i < 3; i++) {
    x.globalAlpha = alpha * (1 - i * .22);
    x.beginPath(); x.arc(bx, by, intro.reducedMotion ? 36 + i * 18 : 14 + ((t * 48 + i * 18) % 72), 0, Math.PI * 2); x.stroke();
   }
   x.globalAlpha = alpha;
   x.beginPath(); x.moveTo(bx - 24, by); x.lineTo(bx + 24, by); x.moveTo(bx, by - 24); x.lineTo(bx, by + 24); x.stroke();
  } else if (key === 'race') {
   const offset = intro.reducedMotion ? W / 2 : (t * 260) % (W + 100) - 50;
   x.globalAlpha = alpha * .7;
   x.strokeStyle = '#ff4d5a'; x.lineWidth = 2;
   x.beginPath(); x.moveTo(offset, 0); x.lineTo(offset + H * .7, H); x.stroke();
   x.strokeStyle = '#4d8dff';
   x.beginPath(); x.moveTo(W - offset, 0); x.lineTo(W - offset - H * .7, H); x.stroke();
   x.globalAlpha = alpha * .45;
   x.setLineDash([5, 6]); x.beginPath(); x.arc(p.x, p.y, intro.reducedMotion ? 54 : 30 + (t * 75) % 48, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
  } else {
   const color = boss.c || '#d0d8e2';
   x.strokeStyle = color; x.lineWidth = 1.5;
   const pulse = intro.reducedMotion ? 52 : 22 + ((t * 65) % 62);
   x.globalAlpha = alpha * .7;
   x.beginPath(); x.arc(bx, by, pulse, 0, Math.PI * 2); x.stroke();
   x.globalAlpha = alpha;
   x.font = "700 22px 'JetBrains Mono',monospace";
   x.textAlign = 'center'; x.textBaseline = 'middle';
   x.fillStyle = color; x.fillText(boss.g || '!', bx, by);
  }
  x.restore();

  const signal = key === 'segfault' ? 'HEAP GUARD // INVALID ADDRESS'
   : key === 'runtime' ? 'EXCEPTION TRACE // POSITION RESOLVED'
   : key === 'race' ? 'THREAD COLLISION // TWO PROCESSES DETECTED'
   : key === 'kernel_ph' ? 'KERNEL INTERRUPT // UNKNOWN PROCESS'
   : key === 'deadlock_ph' ? 'LOCK MONITOR // UNKNOWN PROCESS'
   : 'HOSTILE PROCESS // SIGNATURE RESOLVED';
  x.save();
  x.globalAlpha = alpha;
  x.fillStyle = 'rgba(4,7,12,.76)';
  x.fillRect(0, 0, W, 42);
  x.fillStyle = alert ? '#ffaaa0' : boss.c;
  x.font = "700 10px 'JetBrains Mono',monospace";
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(scan ? 'SIDEQUEST // ENVIRONMENTAL SCAN' : `SIDEQUEST // ${boss.n}`, W / 2, 16);
  x.fillStyle = '#d0d8e2';
  x.font = "9px 'JetBrains Mono',monospace";
  x.fillText(scan ? signal : 'THREAT LOCKED // ENGAGEMENT IMMINENT', W / 2, 31);
  x.restore();
 }
 x.restore();
}

function draw(x) {
 const c = R.col, A = ARENAS[G.cfg.arena], p = R.p, H0 = HOSTS[G.host], hc = H0.c, hg = H0.g;
 x.save();
 x.fillStyle = c.pan; x.fillRect(0, 0, W, H);
 if (R.shake > .4) x.translate((Math.random() - .5) * R.shake * SET.shake, (Math.random() - .5) * R.shake * SET.shake);
 x.drawImage(R.bg, 0, 0);
 drawNodes(x, A, R.t, G.world?.c?.[0] || '#9dff7a');
 drawSegfaultScene(x);
 if (A.z) drawLabLive(x, A, R.t); // lab: flickering screens / LEDs / error traces (A = ARENAS[arena])
 if (R.room) drawRoomLayer(x);

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
 if (R.frost && R.frost.length) { // floor ice from the Cryogenic Stream: pale hex plates + frost cracks, fading out
  x.save();
  for (const q of R.frost) {
   const k = Math.min(1, q.l / (q.m * .5)), r = q.r;
   x.globalAlpha = .38 * k; x.fillStyle = '#9fefff'; x.beginPath();
   for (let i = 0; i < 6; i++) { const an = i * Math.PI / 3 + q.seed; x.lineTo(q.x + Math.cos(an) * r, q.y + Math.sin(an) * r); }
   x.closePath(); x.fill();
   x.globalAlpha = .75 * k; x.strokeStyle = '#e6fbff'; x.lineWidth = 1; x.stroke();
   x.beginPath(); for (let i = 0; i < 3; i++) { const an = i * Math.PI / 3 + q.seed; x.moveTo(q.x - Math.cos(an) * r * .7, q.y - Math.sin(an) * r * .7); x.lineTo(q.x + Math.cos(an) * r * .7, q.y + Math.sin(an) * r * .7); } x.stroke();
  }
  x.restore();
 }
 for (const t of R.tg) {
  if (t.mine) {
   x.save(); x.globalCompositeOperation = 'lighter';
   x.globalAlpha = .28; x.fillStyle = t.c; x.beginPath(); x.arc(t.x, t.y, 18, 0, 7); x.fill();
   x.globalAlpha = .8; x.strokeStyle = t.c; x.lineWidth = 1.5; x.beginPath(); x.arc(t.x, t.y, 18, 0, 7); x.stroke();
   x.restore();
   continue;
  }
  if (t.kind === 'airstrike') {
   const progress = 1 - t.t / t.max;
   x.save(); x.setLineDash([]);
   x.globalAlpha = .2; x.fillStyle = t.c;
   x.fillRect(t.x - t.r, t.y - t.r, t.r * 2, t.r * 2);
   x.globalAlpha = .95; x.strokeStyle = '#ff7180'; x.lineWidth = 2;
   x.strokeRect(t.x - t.r, t.y - t.r, t.r * 2, t.r * 2);
   x.strokeStyle = '#fff1f3'; x.lineWidth = 3;
   x.beginPath(); x.moveTo(t.x - 11, t.y - 11); x.lineTo(t.x + 11, t.y + 11);
   x.moveTo(t.x + 11, t.y - 11); x.lineTo(t.x - 11, t.y + 11); x.stroke();
   drawSegfaultMissile(x, t, progress);
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

 drawRaceAoE(x);
 drawLeakAreas(x);
 drawCraters(x);
 drawMeteorTele(x);
 drawSpawnTele(x);
 for (const f of R.fx) {
  if (f.sq) {
   const k = f.l / f.d, h = f.max * (1 - .25 * k);
   x.save(); x.globalCompositeOperation = 'lighter';
   x.globalAlpha = k * .55; x.fillStyle = f.c; x.fillRect(f.x - h, f.y - h, h * 2, h * 2);
   x.globalAlpha = k; x.strokeStyle = '#fff'; x.lineWidth = 2; x.strokeRect(f.x - h, f.y - h, h * 2, h * 2);
   x.restore(); continue;
  }
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
  if (f.cryo) { // Cryogenic Stream: a narrow lattice beam of ice shards with binary-code sparks
   const k = f.l / f.d, L = Math.max(10, f.max), q = SET.fl, GK = GLOW[SET.gw];
   x.save(); x.translate(f.x, f.y); x.rotate(f.a);
   if (GK > 0) { x.globalCompositeOperation = 'lighter'; const g = x.createLinearGradient(0, 0, L, 0); g.addColorStop(0, 'rgba(126,232,255,' + k * .55 * GK + ')'); g.addColorStop(1, 'rgba(126,232,255,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.lineTo(L, -L * Math.tan(f.h)); x.lineTo(L, L * Math.tan(f.h)); x.closePath(); x.fill(); }
   x.globalCompositeOperation = 'source-over';
   const n = [5, 9, 14][q];
   for (let i = 0; i < n; i++) { // ice shards strewn along the stream
    const u = (i + .5) / n, d = L * u, w = (Math.sin(f.seed + i * 7.1) * .5) * Math.tan(f.h) * d * 1.5, sz = 4 + 4 * (1 - u);
    x.globalAlpha = k * (.9 - u * .4); x.fillStyle = i % 2 ? '#e6fbff' : '#7ee8ff';
    x.beginPath(); x.moveTo(d + sz, w); x.lineTo(d, w - sz * .45); x.lineTo(d - sz * .8, w); x.lineTo(d, w + sz * .45); x.closePath(); x.fill();
   }
   x.globalAlpha = k * .9; x.strokeStyle = '#e6fbff'; x.lineWidth = 2; x.beginPath(); x.moveTo(8, 0); x.lineTo(L, 0); x.stroke();
   if (q > 0) { x.font = "700 8px 'JetBrains Mono',monospace"; x.fillStyle = '#bff6ff'; for (let i = 0; i < [0, 5, 9][q]; i++) { const u = ((i * .37 + f.seed) % 1), d = 14 + (L - 14) * u; x.globalAlpha = k * .8; x.fillText((i + (f.seed | 0)) % 2 ? '1' : '0', d, Math.sin(i * 5.3 + f.seed) * Math.tan(f.h) * d); } }
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
   x.globalCompositeOperation = l.refl ? 'source-over' : 'lighter'; x.lineCap = l.rte ? 'round' : 'butt';
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
   if (orb.bl && orb.bl[i] && orb.bl[i].dead) continue;
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
  if (R.bossIntro?.revealAt != null && e.boss && R.bossIntro.t < R.bossIntro.revealAt) continue;
  if (e.boss && e.tpd && e.tpd.go) continue; // mid-teleport: only the i-frame marker is drawn
  drawEnemyTelegraphs(x, e);
  drawArmyTelegraphs(x, e);
  if (e.boss && e.bd0?.n === 'SEGMENT FAULT' && R.seg) {
   const tele = R.seg.telegraphs.find(q => q.type === 'jet-dash' || q.type === 'stack');
   const intro = G.cfg.boss === 'segfault' ? R.bossIntro : null;
   const introJet = !!intro && (intro.st || 0) >= SEGFAULT.intro.dashAt - .8 && (intro.st || 0) < SEGFAULT.intro.skidEnd;
   const angle = e.segDash?.angle ?? (tele?.type === 'stack' ? tele.data.routes[0]?.angle : tele?.data.angle) ?? (introJet ? e.faceAng : undefined);
   if (angle != null) drawSegfaultJetpack(x, e, angle);
  }
  if (e.race && e.twin === 'merged') drawMerged(x, e);
  else if (e.army) drawArmy(x, e);
  else {
  x.globalAlpha = e.ghost ? .12 : .25; x.fillStyle = e.c;
  x.beginPath(); x.arc(e.x, e.y, e.r, 0, 7); x.fill();
  x.globalAlpha = e.ghost ? .7 : 1; x.strokeStyle = e.fl > 0 ? '#fff' : e.c;
  x.lineWidth = e.elite ? 3 : 2; x.beginPath(); x.arc(e.x, e.y, e.r, 0, 7); x.stroke();
  x.font = `700 ${Math.round(e.r * 1.5)}px 'JetBrains Mono',monospace`;
  x.fillStyle = e.fl > 0 ? '#fff' : e.c;
  x.fillText(e.g, e.x, e.y + 1);
  if (e.race && R.race && R.race.lock && R.race.lock.holder === e && R.race.lock.state === 'active') drawLockRing(x, e);
  }
  if (e.boss && e.bd0?.n === 'SEGMENT FAULT') { drawSegfaultArmor(x, e); drawSegfaultTanks(x, e); }

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
 drawRaceLinks(x);
 if (R.rt) drawRuntimeFx(x);
 if (!(R.bossIntro?.revealAt != null && R.bossIntro.t < R.bossIntro.revealAt) && !(R.bossIntro && G.cfg.boss === 'leak' && R.bossIntro.core !== 2)) drawMainCore(x);
 if (R.bossIntro) drawCoreIntro(x);
 for (const q of R.pr) drawProjectile(x, q, false);
 for (const b of R.eb) drawProjectile(x, b, true);
 drawMeteors(x);
 drawPrismTop(x);

 for (const g of R.gh) {
  x.globalAlpha = g.l * 2;
  x.font = "700 24px 'JetBrains Mono',monospace";
  x.fillStyle = hc;
  x.fillText(hg, g.x, g.y);
 }

 // Jet flame attached to host engine exhaust
 if (!R.deathSequence && Math.hypot(p.vx, p.vy) > 20) {
  const an = (p.ang ?? Math.atan2(p.fy, p.fx)) + Math.PI;
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

 { // energy barrier: a humming hex outline while it is up, a thin refill arc while it regenerates
  const b = G.bar;
  x.save();
  if (!hasBarrier()) { /* other Hosts have no barrier */ } else if (!b || b.ready) {
   x.translate(p.x, p.y); x.rotate(R.t * .6); x.globalAlpha = .55 + .2 * Math.sin(R.t * 4); x.strokeStyle = '#7ee8ff'; x.lineWidth = 1.6; x.shadowColor = '#7ee8ff'; x.shadowBlur = 8;
   x.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; x.lineTo(Math.cos(a) * 19, Math.sin(a) * 19); } x.closePath(); x.stroke();
  } else {
   x.globalAlpha = .4; x.strokeStyle = '#7ee8ff'; x.lineWidth = 1.5; x.setLineDash([2, 3]);
   x.beginPath(); x.arc(p.x, p.y, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - b.t / PLAYER_SHIELD.barrierRegen)); x.stroke();
  }
  x.restore();
 }
 // Shield visual on host (semicircle in front facing velocity, fainter arc behind)
 const hOutline = shadeHex(hc, .62);
 if (p.sh > 0) {
  const facing = p.ang ?? Math.atan2(p.fy, p.fx);
  const shRatio = Math.min(1, p.sh / shMax());
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

 const shutdown = R.deathSequence;
 const shutdownK = shutdown ? cl(shutdown.t / shutdown.duration, 0, 1) : 0;
 x.globalAlpha = (p.inv > 0 && p.dash <= 0 && ((R.t * 24) | 0) % 2 ? .4 : 1) * (1 - shutdownK * .78);
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
 if (!R.deathSequence && G.wand) { x.globalAlpha = (p.inv > 0 && p.dash <= 0 && ((R.t * 24) | 0) % 2 ? .4 : 1); drawWandSprite(x, G.wand, p.x + Math.cos(aimAngle()) * 17, p.y + Math.sin(aimAngle()) * 17, aimAngle(), 1.3); } // the equipped wand, held toward the aim
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
 if (shutdown) {
  const phase = shutdownK, cx = p.x, cy = p.y, pulse = Math.sin(shutdown.t * 9) * 2;
  x.save();
  x.fillStyle = `rgba(3, 6, 12, ${.18 + phase * .52})`;
  x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'lighter';
  x.globalAlpha = 1 - phase * .65;
  x.strokeStyle = phase > .6 ? '#9aa8b8' : hc;
  x.lineWidth = 1.5;
  x.beginPath();
  x.arc(cx, cy, 23 + phase * 28 + pulse, -Math.PI * .78, Math.PI * (1.15 - phase * .8));
  x.stroke();
  x.beginPath();
  x.moveTo(cx - 6, cy); x.lineTo(cx + 6, cy);
  x.moveTo(cx, cy - 6); x.lineTo(cx, cy + 6);
  x.stroke();
  x.globalCompositeOperation = 'source-over';
  x.globalAlpha = 1;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = "700 11px 'JetBrains Mono',monospace";
  const label = phase < .58 ? 'HOST PROCESS // SAFE SHUTDOWN' : 'HOST OFFLINE // RUN ABORTED';
  const width = x.measureText(label).width + 22, labelY = H - 42;
  x.fillStyle = 'rgba(5, 8, 14, .9)';
  x.fillRect(W / 2 - width / 2, labelY - 13, width, 26);
  x.strokeStyle = 'rgba(190, 205, 220, .45)'; x.strokeRect(W / 2 - width / 2, labelY - 13, width, 26);
  x.fillStyle = '#c2ccd8'; x.fillText(label, W / 2, labelY);
  x.restore();
 }
 drawBossIntro(x);
 x.restore();

 // UI Overlay - Top Left HUD Card (HP, Shield, Dash)
 const BB = hasBarrier() ? 11 : 0, BO = BB + 12; // BB: Debugger barrier row. +12: the Bandwidth row sits between shield and dash.
 x.save();
 x.textAlign = 'left';
 x.textBaseline = 'middle';
 x.font = "700 11px 'JetBrains Mono',monospace";

 x.fillStyle = 'rgba(18, 22, 34, 0.78)';
 x.strokeStyle = 'rgba(255, 255, 255, 0.14)';
 x.lineWidth = 1;
 x.beginPath();
 if (x.roundRect) x.roundRect(8, 8, 204, 80 + BO, 6);
 else x.rect(8, 8, 204, 80 + BO);
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
 const shPct = Math.min(1, Math.max(0, p.sh) / shMax());
 if (shPct > 0) {
  x.fillStyle = c.chip;
  x.fillRect(14, 26, 108 * shPct, 6);
 }
 x.fillStyle = shPct > 0 ? c.chip : 'rgba(255, 255, 255, 0.45)';
 x.fillText(`SHIELD ${Math.ceil(p.sh)}/${shMax()}`, 128, 29);
 if (hasBarrier()) { // energy barrier: full bar = ready, filling bar = regenerating
  const b = G.bar || { ready: 1, t: 0 }, frac = b.ready ? 1 : 1 - b.t / PLAYER_SHIELD.barrierRegen;
  x.fillStyle = 'rgba(126,232,255,.14)'; x.fillRect(14, 37, 108, 6);
  x.fillStyle = b.ready ? '#7ee8ff' : 'rgba(126,232,255,.55)'; x.fillRect(14, 37, 108 * frac, 6);
  x.fillStyle = '#7ee8ff'; x.fillText(b.ready ? 'BARRIER READY' : 'BARRIER ' + Math.ceil(b.t) + 's', 128, 40);
 }

 // 2b. Bandwidth bar: lagging trail shows spending, chevrons show passive regen, flashes red when a cast is refused for lack of BW
 {
  const by = 37 + BB, bwm = Math.max(1, G.bwMax || 1), bf = cl((G.bw || 0) / bwm, 0, 1), tf = cl((G.bwTrail || 0) / bwm, 0, 1), lowFlash = R.bwFlash > 0;
  x.fillStyle = 'rgba(255, 255, 255, 0.12)'; x.fillRect(14, by, 108, 6);
  if (tf > bf) { x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(14 + 108 * bf, by, 108 * (tf - bf), 6); }
  x.fillStyle = lowFlash && Math.floor(R.t * 14) % 2 ? '#ff5c7a' : '#8f7bff'; x.fillRect(14, by, 108 * bf, 6);
  if (G.bwRegenOn) { x.fillStyle = 'rgba(255,255,255,.55)'; const ox = (R.t * 40) % 12; for (let i = 0; i < 9; i++) { const cx = 14 + i * 12 + ox; if (cx < 14 + 108 * bf - 3 && cx > 14) x.fillRect(cx, by + 2, 2, 2); } }
  x.font = "700 10.5px 'JetBrains Mono',monospace"; x.fillStyle = lowFlash ? '#ff8aa0' : (G.bw >= bwm - .5 ? '#cfc6ff' : '#b9adff');
  x.fillText(lowFlash ? 'LOW BW' : `BW ${Math.floor(G.bw || 0)}/${bwm}${G.bw >= bwm - .5 ? ' MAX' : ''}`, 128, by + 4);
 }

 // 3. Dash Meter
 x.fillStyle = 'rgba(255, 255, 255, 0.12)';
 x.fillRect(14, 37 + BO, 108, 6);
 const dashReady = p.dcd <= 0;
 const dashProgress = dashReady ? 1 : Math.max(0, 1 - (p.dcd / (1.5 * ST.dashcd)));
 x.fillStyle = dashReady ? c.chip : c.mu;
 x.fillRect(14, 37 + BO, 108 * dashProgress, 6);
 x.fillStyle = dashReady ? c.chip : 'rgba(255, 255, 255, 0.6)';
 x.fillText(dashReady ? 'DASH READY' : `DASH ${p.dcd.toFixed(1)}s`, 128, 40 + BO);
 x.fillStyle = R.combatMode ? c.chip : c.mult;
 x.beginPath(); x.arc(18, 55 + BO, 3, 0, Math.PI * 2); x.fill();
 x.font = "700 9px 'JetBrains Mono',monospace";
 x.fillText(R.combatMode ? 'COMBAT MODE // ACTIVE' : 'COMBAT MODE // OFF', 27, 55 + BO);
 { const wd = wandOf(G.wand); x.imageSmoothingEnabled = false; x.drawImage(wandCanvas(G.wand), 14, 64 + BO, 40, 14); x.fillStyle = wd.col; x.textAlign = 'left'; x.fillText(wd.short, 60, 71 + BO); } // equipped wand: pixel sprite + name
 x.restore();

 x.save();
 x.textAlign = 'right';
 x.textBaseline = 'middle';
 x.font = "700 11px 'JetBrains Mono',monospace";
 x.fillStyle = c.ink;
 x.fillText(`${G.sector}-${G.layer} ${G.world?.n || 'Sector'}: ${A.n}${G.cfg?.elite && !R.room?.cleared ? ' [ELITE]' : ''}`, W - 10, 15);
 x.fillText(`bugs ${R.en.length + (R.boss ? 0 : Math.ceil(Math.max(0, R.budget) / 1.2))}`, W - 10, 29);

 if (R.term) {
  x.fillStyle = c.chip;
  x.fillText(`hack ${Math.round((R.term.p || 0) * 100)}%  data ${R.pk.filter(k => k.got).length}/3`, W - 10, R.room ? 85 : 43);
 }

 if (R.room) drawRoomHud(x);
 const bs = R.en.find(e => e.boss);
 // ----- Boss HP Display (Settings): 0 = HP bar, 1 = HP bar + %, 2 = actual HP / max (%) -----
 const pctTxt = (hp, m) => {
  if (!(m > 0) || !(hp > 0)) return '0%';
  let v = Math.round(cl(hp / m * 100, 0, 100));
  if (v >= 100 && hp < m) v = 99;
  return Math.max(1, v) + '%';
 };
 const numTxt = (hp, m) => Math.max(0, Math.ceil(hp || 0)) + ' / ' + Math.max(0, Math.round(m || 0)) + ' (' + pctTxt(hp, m) + ')';
 const hudHp = (bx, by, bw, hp, m, fill, o = {}) => {
  const mode = SET.bhp, h = o.h || 8, frac = m > 0 ? cl(hp / m, 0, 1) : 0;
  x.save();
  if (mode === 2) {
   x.fillStyle = 'rgba(12,14,24,.82)'; x.fillRect(bx - 1, by - 3, bw + 2, h + 6);
   x.strokeStyle = o.edge || '#8a90a8'; x.lineWidth = 1.5; x.strokeRect(bx - 1, by - 3, bw + 2, h + 6);
   x.font = `700 ${o.fs || 11}px 'JetBrains Mono',monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
   x.fillStyle = o.txt || '#fff'; x.fillText(numTxt(hp, m), bx + bw / 2, by + h / 2 + 1);
  } else {
   x.fillStyle = c.mu; x.fillRect(bx, by, bw, h);
   x.fillStyle = fill; x.fillRect(bx, by, bw * frac, h);
   if (mode === 1 && !o.inline) {
    x.fillStyle = c.ink; x.font = `700 ${o.fs || 10}px 'JetBrains Mono',monospace`; x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText(pctTxt(hp, m), bx + bw + 6, by + h / 2 + 1);
   }
  }
  x.restore();
 };
 x.save(); x.translate((W - 640) / 2, 0); // boss / hint HUD was laid out for a 640px-wide arena: keep it centred in wider rooms
 if (R.race && R.race.split && R.race.red) {
  // Phase 2: two color-coded health bars, each with its own HP.
  x.textAlign = 'center';
  [[R.race.red, 150, 'RED'], [R.race.blue, 330, 'BLUE']].forEach(([b, bx, nm]) => {
   const alive = !b.dead && b.hp > 0;
   hudHp(bx, 44, 160, alive ? b.hp : 0, b.max || 1, alive ? b.c : '#5a5f70', { inline: 1, edge: alive ? b.c : '#5a5f70', fs: 10 });
   x.fillStyle = alive ? b.c : '#7d8498'; x.font = "700 10px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
   const Lk = R.race.lock, hasLock = alive && Lk && Lk.holder === b && (Lk.state === 'active' || Lk.state === 'transit');
   x.fillText(alive ? nm + (hasLock ? ' [LOCK]' : '') + (SET.bhp === 1 ? '  ' + pctTxt(b.hp, b.max) : '') : nm + ' TERMINATED', bx + 80, 64);
   if (hasLock && Lk.state === 'active') { x.fillStyle = 'rgba(159,232,255,.25)'; x.fillRect(bx, 54, 160, 3); x.fillStyle = '#9fe8ff'; x.fillRect(bx, 54, 160 * Math.max(0, Lk.dur) / (Lk.max || 1), 3); }
  });
  {
   const Lk = R.race.lock; x.font = "700 9px 'JetBrains Mono',monospace";
   if (Lk && Lk.state === 'broken') { x.fillStyle = '#9fe8ff'; x.fillText('LOCK RECOMPILING ' + Math.max(0, Math.ceil(Lk.cd)) + 's', 320, 92); }
   else if (Lk && Lk.state === 'transit') { x.fillStyle = '#9fe8ff'; x.fillText('LOCK TRANSFER', 320, 92); }
   else if (R.race.merged) { x.fillStyle = '#d9a6ff'; x.fillText('THREAD MERGE', 320, 92); }
  }
  x.fillStyle = c.ink; x.font = "700 11px 'JetBrains Mono',monospace";
  x.fillText('THE RACE CONDITION', 320, 78);
 } else if (bs && bs.bd0) {
  let fill = bs.c;
  if (bs.race) { const gr = x.createLinearGradient(320 - 170, 0, 320 + 170, 0); gr.addColorStop(0, RACE.red); gr.addColorStop(1, RACE.blue); fill = gr; }
  hudHp(320 - 170, 44, 340, Math.max(0, bs.hp), bs.max || 1, fill, { edge: bs.race ? '#c77dff' : bs.c });
  x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = c.ink;
  x.font = "700 11px 'JetBrains Mono',monospace";
  x.fillText(bs.bd0.n + (bs.vuln > 0 ? '  [EXPOSED x1.5]' : ''), 320, 64);
  // PRISM: unique healer. Purple name + HP bar, thin cyan shield bar directly beneath it (its [CORRUPT] meter floats above the character).
  const pz = R.en.find(e => e.prism && !e.dead);
  if (pz) {
   const bx = 210, bw = 220, gr = x.createLinearGradient(bx, 0, bx + bw, 0);
   gr.addColorStop(0, '#7a3bff'); gr.addColorStop(.5, '#b36bff'); gr.addColorStop(1, '#f0b8ff');
   x.save(); x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.font = "700 10px 'JetBrains Mono',monospace"; x.fillStyle = gr; x.fillText('PRISM', 320, 82); x.restore();
   hudHp(bx, 88, bw, Math.max(0, pz.hp), pz.max, '#a45cff', { h: 7, edge: '#b36bff', fs: 10 });
   const sh = pz.shMax ? cl(pz.sh / pz.shMax, 0, 1) : 0;
   x.fillStyle = 'rgba(94,224,208,.18)'; x.fillRect(bx, 97, bw, 3);
   x.fillStyle = pz.shHit > 0 ? '#ffffff' : '#5ee0d0'; x.fillRect(bx, 97, bw * sh, 3);
   if (SET.bhp === 2) { x.save(); x.font = "700 8px 'JetBrains Mono',monospace"; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = '#5ee0d0'; x.fillText('SHIELD ' + Math.ceil(pz.sh || 0) + ' / ' + pz.shMax, bx + bw + 6, 98.5); x.restore(); }
  } else if (R.leak && R.leak.prismDead) {
   x.save(); x.textAlign = 'center'; x.font = "700 9px 'JetBrains Mono',monospace"; x.fillStyle = '#7d8498'; x.fillText('PRISM TERMINATED', 320, 82); x.restore();
  }
  if (R.seg) {
   x.save();
   const cx = 320, S = R.seg, FU = SEGFAULT.fuel;
   x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.font = "700 8px 'JetBrains Mono',monospace";
   let yEnd;
   if (S.phase3) {
    const O = S.overload, hp = O.state === 'off' ? 0 : O.hp, max = SEGFAULT.phase3.overload.durability;
    x.fillStyle = '#ff9eae'; x.fillText('OVERLOAD SHIELD // ' + O.state.toUpperCase(), cx, 78);
    x.fillStyle = 'rgba(255,104,126,.2)'; x.fillRect(cx - 110, 82, 220, 6);
    x.fillStyle = O.state === 'overloading' ? '#eaa3ff' : '#ff687e';
    x.fillRect(cx - 110, 82, 220 * cl(hp / max, 0, 1), 6);
    x.strokeStyle = '#ffc0c9'; x.lineWidth = 1; x.strokeRect(cx - 110, 82, 220, 6);
    x.fillStyle = '#ffdce2'; x.font = "700 7px 'JetBrains Mono',monospace";
    x.fillText(Math.ceil(hp) + ' / ' + max, cx, 99);
    yEnd = 99;
   } else {
    const plates = S.plates, total = plates.reduce((sum, plate) => sum + plate.hp, 0), max = plates.reduce((sum, plate) => sum + plate.max, 0);
    x.fillStyle = '#ff9eae'; x.fillText('DIRECTIONAL SHIELDS // ' + Math.ceil(total) + ' / ' + max, cx, 77);
    const names = { front: 'F / KIN', left: 'L / EN', right: 'R / EN', back: 'B / IMP' }, bw = 78, gap = 8, bx0 = cx - (bw * plates.length + gap * (plates.length - 1)) / 2;
    plates.forEach((plate, i) => {
     const bx = bx0 + i * (bw + gap), frac = plate.dead ? 0 : cl(plate.hp / plate.max, 0, 1);
     x.fillStyle = '#ffb7c1'; x.fillText(names[plate.side], bx + bw / 2, 87);
     x.fillStyle = 'rgba(255,104,126,.2)'; x.fillRect(bx, 90, bw, 5);
     x.fillStyle = frac > .35 ? '#ff687e' : '#ffd18c'; x.fillRect(bx, 90, bw * frac, 5);
     x.strokeStyle = 'rgba(255,192,201,.75)'; x.lineWidth = 1; x.strokeRect(bx, 90, bw, 5);
    });
    x.fillStyle = '#e8b8c0'; x.font = "700 7px 'JetBrains Mono',monospace";
    x.fillText('KINETIC: PROJECTILES   ENERGY: BEAM / CONE / CHAIN', cx, 105);
    yEnd = 105;
   }
   // FUEL (orange): drained by jetpack dashes and the close-range stdout, refills over time. The tick marks the minimum fuel needed to dash (SEGFAULT.fuel.minDash).
   // STUN HP: the two tank bars. Hits from behind drain them (segTankHit); a tank at 0 ruptures and stuns him. Value: SEGFAULT.fuel.tankHp in data.js.
   const fy = yEnd + 9, fw = 234, fx = cx - fw / 2, fuel = segFuel(S);
   x.textAlign = 'left'; x.font = "700 7px 'JetBrains Mono',monospace"; x.fillStyle = '#ffb36b'; x.fillText('FUEL', fx, fy);
   x.textAlign = 'right'; x.fillText(Math.round(fuel * 100) + '%', fx + fw, fy);
   x.fillStyle = 'rgba(255,154,69,.2)'; x.fillRect(fx, fy + 3, fw, 5);
   x.fillStyle = fuel < FU.minDash ? '#ff5c7a' : '#ff9a45'; x.fillRect(fx, fy + 3, fw * fuel, 5);
   x.strokeStyle = 'rgba(255,208,160,.8)'; x.lineWidth = 1; x.strokeRect(fx, fy + 3, fw, 5);
   x.beginPath(); x.moveTo(fx + fw * FU.minDash, fy + 1); x.lineTo(fx + fw * FU.minDash, fy + 10); x.stroke();
   x.textAlign = 'left'; x.fillStyle = '#ffd18c'; x.fillText('TANK HP // STUN AT 0', fx, fy + 19);
   const tw = (fw - 6) / 2;
   S.tanks.forEach((t, i) => {
    const tx = fx + i * (tw + 6), frac = t.broken ? 1 - cl(t.fix / FU.rupturedFix, 0, 1) : cl(t.hp / t.max, 0, 1);
    x.fillStyle = 'rgba(255,209,140,.18)'; x.fillRect(tx, fy + 22, tw, 4);
    x.fillStyle = t.broken ? '#7a5a4f' : '#ffd18c'; x.fillRect(tx, fy + 22, tw * frac, 4);
    x.strokeStyle = t.broken ? 'rgba(255,92,122,.9)' : 'rgba(255,208,160,.75)'; x.strokeRect(tx, fy + 22, tw, 4);
    if (t.broken) { x.fillStyle = '#ff5c7a'; x.fillText('RUPTURED', tx, fy + 35); }
   });
   x.restore();
  }
 }
 if (R.leak && R.leak.sig > 0) { x.save(); x.textAlign = 'center'; x.font = "700 9px 'JetBrains Mono',monospace"; x.fillStyle = '#8fe0ff'; x.fillText('[SIGSTOP] minion spawn suspended  ' + Math.ceil(R.leak.sig) + 's', 320, 110); x.restore(); }
 if (R.hint) { x.save(); x.textAlign = 'center'; x.font = "700 10px 'JetBrains Mono',monospace"; x.globalAlpha = Math.min(1, R.hint.t); x.fillStyle = c.ink; x.fillText(R.hint.s, 320, R.seg ? 156 : 116); x.restore(); }
 x.restore();

 // Bottom spell pipeline casting monitors
 x.textAlign = 'left';
 const fs = 11;
 const nCasts = (R.casts && R.casts.length) ? R.casts.length : 1;
 const cw = Math.min(150, Math.max(60, Math.floor((W - 20) / nCasts - 4)));
 // Each cast is drawn as a mini card: rarity edge, spell name, fire rate, modifier chips, and a rate bar.
 (SET.cc ? (R.casts || []) : []).forEach((k, i) => {
  const bx = 10 + i * (cw + 4), bottom = H - 8;
  if (SET.cc === 1) {
   // Compact: plain text, wrapped so every modifier shows, with a rate bar.
   const spd0 = SPELLS[k.c?.sp], dis0 = k.dis > 0 || !!(k.blk ??= !!stats(k.c, ST).blocked);
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
   x.fillRect(bx, bottom - 6, cw * (dis0 ? 1 : 1 - Math.max(0, k.t) / (k.period || 1)), 6);
   x.fillStyle = dis0 ? '#ff5c7a' : c.ink;
   x.fillText((spd0?.n || k.c?.sp || 'spell()') + (k.c?.lv > 1 ? ' v' + k.c.lv : ''), bx, bottom - 11, Math.max(18, cw - 32));
   x.textAlign = 'right'; x.font = `700 8px 'JetBrains Mono',monospace`;
   x.fillText((Number.isFinite(k.rate) ? k.rate.toFixed(2) : '1.00') + '/s', bx + cw, bottom - 11);
   x.textAlign = 'left';
   x.fillStyle = c.mu;
   lines.slice().reverse().forEach((ln2, li) => x.fillText(ln2, bx, bottom - 23 - li * 12));
   x.restore(); return;
  }
  const spd = SPELLS[k.c?.sp], rc = RC[spd?.r] || '#9d92b5', dis = k.dis > 0 || !!(k.blk ??= !!stats(k.c, ST).blocked);
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
  const fireRate = Number.isFinite(k.rate) ? k.rate.toFixed(2) : '1.00';
  x.font = `700 10px 'JetBrains Mono',monospace`; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
  x.fillStyle = dis ? '#ff5c7a' : '#e8ecf5';
  x.fillText(spName + (k.c?.lv > 1 ? ' v' + k.c.lv : ''), bx + 4, top + 17);
  x.font = `700 8px 'JetBrains Mono',monospace`; x.textAlign = 'right'; x.fillStyle = '#9aa3b8';
  x.fillText(fireRate + '/s', bx + cw - 4, top + 17);
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
  x.fillRect(bx + 4, bottom - 7, (cw - 8) * (dis ? 1 : 1 - Math.max(0, k.t) / (k.period || 1)), 4);
  x.restore();
 });

 if (R.banner) {
  x.textAlign = 'center';
  x.globalAlpha = Math.min(1, Math.max(0, R.banner.t));
  x.font = "900 26px 'Grenze Gotisch',serif";
  x.fillStyle = c.mult;
  x.fillText(R.banner.s, W / 2, 130);
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
 const r = refs[t] || ['reviewing expedition dossier', 'mounting sidequest archive', 'synchronizing host records'];
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
  `> expedition target: ${t.toUpperCase()}`,
  `> archive access: COMPLETE`
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
  uiSound('start');
  go();
 });
}

function beginBossLoad(bossKey, after) {
 if (sectorLoading) return;
 sectorLoading = true;
 const token = ++sectorLoadToken;
 const style = {
  segfault: { bg: '#100608', accent: '#ff5c7a', hi: '#ffd0d8', ok: '#ff91aa', dim: '#7f3d4c', glow: 'rgba(255,70,100,.16)' },
  leak: { bg: '#07100c', accent: '#55e6a5', hi: '#caffea', ok: '#8ff0c3', dim: '#477d68', glow: 'rgba(70,220,150,.15)' },
  runtime: { bg: '#0b0710', accent: '#b48cff', hi: '#ead5ff', ok: '#c99cff', dim: '#6f4d8a', glow: 'rgba(180,140,255,.16)' },
  race: { bg: '#0a0812', accent: '#ff4d5a', accent2: '#4d8dff', hi: '#e6e8ff', ok: '#b79cff', dim: '#5a5f8a', glow: 'rgba(160,110,255,.16)' }
 }[bossKey] || { bg: '#080a10', accent: '#7aa7ff', hi: '#d8e5ff', ok: '#a9c6ff', dim: '#536b8f', glow: 'rgba(90,140,255,.14)' };
 const names = { segfault: 'SEGMENT FAULT', leak: 'MEMORY LEAK', runtime: 'RUNTIME ERROR', race: 'RACE CONDITION' };
 const refs = {
  segfault: ['invalidating stack frames', 'scanning pointer boundaries', 'isolating segmentation fault'],
  leak: ['tracing retained allocations', 'walking unreachable references', 'checking heap pressure'],
  runtime: ['entering final execution path', 'validating syscall boundary', 'locking runtime state'],
  race: ['scheduling competing threads', 'resolving write order', 'locking shared state']
 };
 const r = refs[bossKey] || refs.segfault;
 const bossLines = bossKey === 'segfault' ? [
  `> ${BOSSES.segfault.n} // UNIT ONLINE`,
  `> INVALIDATING STACK FRAMES...`,
  `> SCANNING POINTER BOUNDARIES...`,
  ``,
  `> WARNING: SEGMENTATION FAULT DETECTED.`,
  `> ATTEMPTING RECOVERY...`,
  `> RECOVERY FAILED.`,
  ``,
  `> BOOTING EMERGENCY PURGE ROUTINE...`,
  `> FOUNDRY DEFENSE GRID: ACTIVE`,
  `> TARGET ACQUISITION: PENDING`
 ] : null;
 const A = $('#app');
 if (!MUTE) ensureMusicContext();
 stopMusic(.45);
 const ready = waitReady(bossTrack(bossKey));
 const root = document.createElement('div');
 root.id = 'sector-load';
 if (bossKey === 'race') root.classList.add('load-dual'); // red-to-blue gradient boot screen
 for (const k in style) root.style.setProperty('--load-' + ({ bg: 'bg', accent: 'accent', hi: 'hi', ok: 'ok', dim: 'dim', glow: 'glow' }[k] || k), style[k]);
 root.innerHTML = `<div class="load-window"><div class="load-head">${bossKey === 'segfault' ? 'SEGMENT FAULT // UNIT ONLINE' : 'SIDEQUEST // BOSS APPROACH'}</div><div id="load-lines"></div><div class="load-bar"><div class="load-fill"></div></div><div>&gt; ${names[bossKey] || 'BOSS'} <span class="load-cursor"></span></div></div>`;
 A.replaceChildren(root);
 const out = root.querySelector('#load-lines'), fill = root.querySelector('.load-fill');
 const world = G.world?.n || 'current sector';
 const lines = bossLines || [
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
  el.className = 'load-line ' + (line.endsWith('OK') || line.includes('READY') || line.includes('FOUND') || line.includes('FAILED') ? 'load-ok' : line.includes('WARNING') ? 'load-warning' : line === '' ? 'load-dim' : '');
  el.textContent = line;
  out.appendChild(el);
  fill.style.width = Math.round(i / lines.length * 92) + '%';
  setTimeout(tick, bossLines ? (line.includes('WARNING') || line.includes('FAILED') ? 260 : line ? 120 : 90) : (line ? 75 : 45));
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
 root.innerHTML = `<div class="load-window"><div class="load-head">SIDEQUEST // SECTOR TRANSITION</div><div id="load-lines"></div><div class="load-bar"><div class="load-fill"></div></div><div>&gt; ${target?.n?.toUpperCase() || 'SECTOR'} <span class="load-cursor"></span></div></div>`;
 A.replaceChildren(root);
 const out = root.querySelector('#load-lines'), fill = root.querySelector('.load-fill');
 let i = 0;
 const tick = () => {
  if (token !== sectorLoadToken) return;
  if (i >= lines.length) {
   loadGate(root, fill, ready, initial ? 'BEGIN RUN' : 'ENTER ' + (target?.n?.toUpperCase() || 'SECTOR'), token, () => {
    G.world = target;
    G.sh = ST.shmax; G.bar = null; // Full shield restored on sector transition!
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
 return `<div class="top">${sec()}<span>${HOSTS[G.host].n}</span><span style="color:var(--mult)">HP ${Math.ceil(G.hp)}/${G.max}</span><span style="color:var(--chip)">SH ${currSh}/${ST.shmax}</span><span>deck ${G.deck.length}</span><span style="color:var(--gold)" title="Cycles: in-run currency">CYCLES ${G.cycles ?? 0}</span></div><div class="pas">${pas || '<span style="color:var(--mute)">no upgrades yet</span>'}</div>`;
}


function resultLoadStyle(win) {
 return win
  ? { bg: '#06100a', accent: '#62ff79', hi: '#d1ffda', ok: '#91ffa2', dim: '#3c7a48', glow: 'rgba(40,255,80,.14)' }
  : { bg: '#100608', accent: '#ff5c7a', hi: '#ffd0d8', ok: '#ff91aa', dim: '#7f3d4c', glow: 'rgba(255,70,100,.14)' };
}
function renderResultLoad() {
 const A = $('#app'), win = !!G.resultWin, s = resultLoadStyle(win);
 const title = win ? 'SIDEQUEST // RESOLUTION COMPLETE' : 'SIDEQUEST // RUN ABORTED';
 const lines = win ? [
  '> sealing quest record................ OK',
  '> preserving host telemetry........... OK',
  '> indexing recovered data............. OK',
  '> verifying sidequest outcome......... COMPLETE',
  '',
  '> preparing post-run summary.......... READY'
 ] : [
  '> recording quest failure............. OK',
  '> preserving host telemetry........... OK',
  '> indexing recovered data............. OK',
  '> host recovery status................ SAFE',
  '',
  '> preparing post-run summary.......... READY'
 ];
 A.innerHTML = `<div id="sector-load" style="--load-bg:${s.bg};--load-accent:${s.accent};--load-hi:${s.hi};--load-ok:${s.ok};--load-dim:${s.dim};--load-glow:${s.glow}">
  <div class="load-window">
   <div class="load-head">${title}</div>
   <div id="result-load-lines"></div>
   <div class="load-bar"><div class="load-fill"></div></div>
   <div>&gt; POST-RUN SUMMARY <span class="load-cursor"></span></div>
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

function renderResultEvent() {
 const A = $('#app'), host = HOSTS[G.host], kind = G.resultEvent || (G.resultWin ? 'layer-purge' : 'death');
 const boss = G.cfg?.boss ? BOSSES[G.cfg.boss]?.n : null;
 const event = {
  death: {
   title: 'RUN ABORTED',
   tag: 'QUEST FAILED // SAFE SHUTDOWN',
   detail: `${host.n} shut down safely after the quest failed in ${G.world?.n || 'the runtime'} at layer ${G.sector}-${G.layer}.`,
   status: 'HOST STATE: OFFLINE // RECOVERY AVAILABLE',
   cls: 'event-offline'
  },
  'host-purge': {
   title: 'HOST PROCESS PURGED',
   tag: 'BOSS PROCESS // PURGE COMPLETE',
   detail: `${boss || 'Host process'} was removed from ${G.world?.n || 'the runtime'} at layer ${G.sector}-${G.layer}.`,
   status: 'HOST STATE: PURGED',
   cls: 'event-purge'
  },
  hack: {
   title: 'LAYER HACKED',
   tag: 'INTRUSION // ACCESS GRANTED',
   detail: `${G.world?.n || 'Runtime'} was compromised at layer ${G.sector}-${G.layer}.`,
   status: 'LAYER STATE: OVERRIDDEN',
   cls: 'event-hack'
  },
  'layer-purge': {
   title: 'LAYER PURGED',
   tag: 'SIDEQUEST // CLEANUP COMPLETE',
   detail: `${G.world?.n || 'Runtime'} was cleared at layer ${G.sector}-${G.layer}.`,
   status: 'LAYER STATE: PURGED',
   cls: 'event-purge'
  }
 }[kind];
 const accent = event.cls === 'event-offline' ? host.c : event.cls === 'event-hack' ? '#b48cff' : '#62ff79';
 A.insertAdjacentHTML('beforeend', `<div id="result-event" class="${event.cls}" role="dialog" aria-modal="true" aria-labelledby="result-event-title" style="--event-accent:${accent}">
  <div class="event-panel">
   <div class="event-kicker">SIDEQUEST // POST-RUN EVENT REPORT</div>
   <div class="event-mark" aria-hidden="true">
    <span class="event-ring"></span>
    <span class="event-glyph">${host.g}</span>
    <i class="event-fragment event-fragment-a"></i><i class="event-fragment event-fragment-b"></i><i class="event-fragment event-fragment-c"></i>
   </div>
   <div class="event-tag">${event.tag}</div>
   <h1 id="result-event-title">${event.title}</h1>
   <p>${event.detail}</p>
   <div class="event-status">${event.status}</div>
   <button class="btn" data-act="continue-summary">CONTINUE TO RUN SUMMARY</button>
  </div>
 </div>`);
 const button = A.querySelector('[data-act="continue-summary"]');
 if (button) button.focus();
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
  <h2>${s.win ? 'SIDEQUEST COMPLETE' : 'SIDEQUEST ABORTED'}</h2>
  <p>${HOSTS[G.host].n}: ${s.win ? 'the quest is complete; host returning to the archive.' : 'the quest ended in round ' + G.round + '/' + PLAN.length + '; host recovery is available.'}</p>
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
  if (HOSTS[G.host]?.admin) G.host = 'debugger'; // the sandbox-only admin host never leaks into real runs
  A.innerHTML = `    <div class="center"><h1 class="logo">SPELLCODE</h1><p style="font:700 16px 'JetBrains Mono';color:var(--chip);margin:0">// RUNTIME</p><p>Take on post-run sidequests, compile spells into an execution pipeline, and clear 20 rounds across 4 boss encounters.</p><p>Move: WASD / drag. Dash: Space / DASH. Toggle combat with left-click / Z; hold X or right-click to fire every equipped card at its own rate.</p>
  <div class="grid" style="text-align:left;margin-top:14px">${Object.keys(HOSTS).filter(k => !HOSTS[k].admin).map(k => {
   const h = HOSTS[k], lk = !hostOpen(k);
   return `<button class="card host ${lk ? 'lk' : ''} ${G.host === k ? 'sel' : ''}" data-host="${k}" style="border-top-color:${lk ? '#6b5f82' : h.c}"><b>${lk ? '[x] chmod 000 ' + h.n : h.g + ' ' + h.n}</b><small>${lk ? '403 FORBIDDEN<br>' + h.lt + ', or buy for ' + h.cost + ' commits (you have ' + (META.commits || 0) + ')' : h.d}</small>${lk ? '' : `<i>${h.w} (${h.hp} HP)</i>`}</button>`;
  }).join('')}</div>
  <div class="row" style="justify-content:center"><button class="btn" data-act="start">Boot ${HOSTS[G.host].n}</button><button class="btn g" data-act="sandbox">SANDBOX // TEST ONLY</button></div><p>Best room: ${META.best || 0}. Wins: ${META.wins}. Commits: ${META.commits || 0}.</p></div><button class="gear" data-act="settings" title="Settings">⚙</button>${renderOSWindows(G, 6, [settingsSpec])}`;
  return;
 }
 if (v === 'sandbox') {
  const bossOptions = Object.keys(BOSSES).map(k => `<option value="${k}">${BOSSES[k].n}${BOSSES[k].placeholder ? ' // PLACEHOLDER' : ''}</option>`).join('');
  A.innerHTML = `<div class="center sbx-screen"><h1 class="logo">SANDBOX</h1>
   <p style="font:700 13px 'JetBrains Mono';color:var(--mult)">$ spellcode --sandbox  // non-canon // test only</p>
   <div class="panel"><b>NO PROGRESSION</b><p class="lbl">Sandbox tests never grant commits, achievements, quest progress, best-round records, or permanent rewards. Run-only card rewards are temporary. This is not part of the story.</p></div>
   ${G.sandboxMessage ? `<p style="color:var(--chip)">${G.sandboxMessage}</p>` : ''}
   <div class="panel" style="text-align:left">
    <label class="set-row"><span>Start at round</span><input id="sandbox-round" type="number" min="1" max="${PLAN.length}" value="${G.sandboxRound || 1}" style="width:90px"></label>
    <label class="set-row"><span>Host</span><select id="sandbox-host">${Object.keys(HOSTS).map(k => `<option value="${k}" ${G.host === k ? 'selected' : ''}>${HOSTS[k].n}${HOSTS[k].admin ? ' // ADMIN (non-canon test host)' : ''}</option>`).join('')}</select></label>
    <label class="set-row"><span>Encounter</span><select id="sandbox-boss"><option value="round">Normal round schedule</option>${bossOptions}</select></label>
    <p class="lbl">Invulnerability starts ON. During a fight, open TEST MENU (or press \`) for invulnerability, full HP/shields, and skip-round cheats.</p>
   </div>
   <div class="row" style="justify-content:center"><button class="btn" data-act="sandbox-start">START TEST</button><button class="btn g" data-act="title">BACK</button></div>
  </div>`;
  return;
 }
 if (v === 'result-load') {
  renderResultLoad();
  return;
 }
 if (v === 'result-event') {
  renderResultEvent();
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
  A.innerHTML = `<div class="wrap"><canvas id="cv" width="${W}" height="${H}"></canvas><div id="mobile-controls" aria-label="Mobile combat controls"><div id="aim-pad" role="slider" aria-label="Drag to aim" aria-valuetext="Aim direction"><span>AIM</span></div><button id="combat-toggle" aria-pressed="true">COMBAT ON</button><button id="mobile-fire">FIRE</button><button id="continuous-fire" aria-pressed="false">AUTO OFF</button></div><button id="intro-next" type="button">NEXT TEXT</button><button id="interact" type="button" aria-label="Interact">TALK</button><button id="dash" aria-label="Dash">DASH</button><button id="mapbtn" type="button" aria-label="Toggle map" aria-pressed="false">MAP</button><div id="maparea" role="button" aria-label="Enlarge or close the map"></div><button id="pausebtn" data-act="pause" aria-label="${G.sandbox ? 'Sandbox test cheats' : 'Pause'}">${G.sandbox ? 'TEST MENU' : 'II'}</button></div>${G.sandbox ? '<p class="lbl" style="color:var(--mult)">SANDBOX // NON-CANON // NOT LORE-RELATED // NO PROGRESSION</p>' : ''}<p class="rot-hint">Tip: rotate your phone sideways, or tap the fullscreen button, for a bigger arena.</p><p class="lbl" style="margin-top:6px">Move: WASD / drag. Dash: Space / DASH. Aim with mouse or Host facing. Left-click / Z toggles combat; hold X / right-click to fire every card at its own rate. Mobile: drag AIM, tap FIRE or toggle AUTO.</p>`;
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
  A.innerHTML = head() + `<h2>${c.boss ? BOSSES[c.boss].n + ' defeated' : G.rewardCtx ? (G.rewardCtx.kind === 'chest' ? 'Treasure cache opened' : 'Challenge cleared: Elite Hunt reward') : 'Layer cleared'}</h2>${G.rewardCtx && G.rewardNote ? `<p class="lbl">${G.rewardNote}</p>` : ''}` + (G.cat ? `<div class="grid">${G.offers.map((o, i) => o.t === 'w' ? wandCardH(o.k, `data-pick="${i}"`) : cardH(o.k, `data-pick="${i}"`, o.t === 'u', 1, '', G)).join('')}</div>` : `<p class="lbl">Choose a reward type.</p><div class="grid">${cats.map(k => `<button class="card" data-cat="${k[0]}" style="border-top-color:var(--chip)"><b>${k[1]}</b><small>${k[2]}</small></button>`).join('')}</div>`);
  return;
 }

 // DRAFT VIEW (Persistent pipeline & deck management)
 const cp = compilePipeline(G.slots, ST), n = nSlots(), c = G.cfg, ok = cp.out.some(cc => SPELLS[cc.sp]?.dmg && !stats(cc, ST).blocked);
 const bd = new Set();
 const wandBlocked = blockedCards();
 {
  let pm = [];
  G.slots.forEach(cc => {
   if (isMod(cc.k)) pm.push(cc);
   else { pm.forEach(m => { if (!okMod(m.k, cc.k)) bd.add(m.id); }); if (!wandAccepts(G.wand, cc.k, SPELLS[cc.k])) bd.add(cc.id); pm = []; }
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

 A.innerHTML = head() + `${G.sandbox ? '<p class="lbl" style="color:var(--mult)">SANDBOX // NON-CANON // NO PROGRESSION</p>' : ''}${G.sandbox ? '<button class="btn g" data-act="sandbox-skip">SKIP TEST ROUND</button>' : ''}<div>
  <div class="row" style="margin-bottom:8px;gap:6px">
    <button class="btn g sm tb-btn ${isDrawOpen ? 'act' : ''}" data-act="view-draw">🗂️ Draw Pile (${G.draw.length})</button>
    <button class="btn g sm tb-btn ${isDiscOpen ? 'act' : ''}" data-act="view-disc">🗄️ Storage (${G.disc.length + (G.binWands || []).length})</button>
    <button class="btn g sm tb-btn ${isDeckOpen ? 'act' : ''}" data-act="view-deck">📦 Full Deck (${G.deck.length})</button>
    <button class="btn g sm" data-act="redraw" ${(G.cycles ?? 0) < redrawCost(G.layerRedraws || 0) ? 'disabled' : ''} title="Move hand to Storage and draw fresh cards. Costs Cycles; the price climbs each time this layer.">🔄 Redraw (${redrawCost(G.layerRedraws || 0)} CY)</button>
  </div>

  <div class="panel">
    <pre style="color:var(--ink)">INCOMING // ${c.bossKey ? 'BOSS DOOR AHEAD' : ARENAS[c.arena].n}${c.elite ? '  [ELITE]' : ''}</pre>
    <div style="margin-top:4px;font-size:11px">${(c.boss || c.bossKey) ? `<b style="color:var(--mult)">${BOSSES[c.boss || c.bossKey].n}</b>: ${BOSSES[c.boss || c.bossKey].i}` : 'Squash incoming bugs. Build persists across rounds!'}</div>
  </div>

  <p class="lbl">Pipeline (modifiers affect the spell to their right). Tap a card to select it, tap another to move it to that spot, or an empty slot to move it to the end. Double-tap to remove. Cards with a bar underneath were used last round, so they go to the Storage.</p>
  <div class="grid">${sl}</div>
  ${G.sandbox ? `<div class="panel" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b style="color:var(--mult)">SANDBOX // ADD CARD</b><select id="sbx-card" class="sbx-sel">${sbxCardOpts()}</select><select id="sbx-ver" class="sbx-sel"><option value="1">v1</option><option value="2">v2</option><option value="3">v3</option></select><button class="btn g sm" data-act="sbx-add">ADD TO PIPELINE</button><button class="btn g sm" data-act="sbx-add-hand">ADD TO HAND</button></div>` : ''}

  <div class="panel"><b>WAND</b> <span class="lbl">equipment // ${(G.wands || []).length} owned</span>
   <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:6px;align-items:stretch">${(G.wands || ['universal']).map(id => { const w = wandOf(id), eq = G.wand === id, st = canStoreWand(id, G.wand, G.wands || []); return `<div class="card" style="cursor:default;min-width:150px;max-width:210px;border-top-color:${w.col};${eq ? 'outline:2px solid ' + w.col + ';' : ''}"><div style="height:44px;text-align:center;padding-top:6px">${wandIconHTML(id, 3, -35)}</div><em style="color:${w.col}">${eq ? 'EQUIPPED' : 'WAND'}</em><b>${w.n}</b><small>${w.d}</small><div style="margin-top:auto;display:flex;gap:4px;padding-top:6px"><button class="btn sm ${eq ? '' : 'g'}" data-act="wand-equip" data-wand="${id}" style="flex:1;font-size:10px;padding:4px 6px" ${eq ? 'disabled' : ''}>${eq ? 'Equipped' : 'Equip'}</button>${id === 'universal' ? '' : `<button class="btn sm g" data-act="wand-store" data-wand="${id}" style="flex:1;font-size:10px;padding:4px 6px" ${st ? '' : 'disabled'} title="${eq ? 'Equip another wand first' : 'Move to Storage (Wands tab)'}">Store</button>`}</div></div>`; }).join('')}</div>
   ${wandBlocked.length ? `<p class="lbl" style="color:#ff6a6a;margin:6px 0 0">// ${wandBlocked.length} pipeline spell${wandBlocked.length > 1 ? 's' : ''} cannot be fired by this wand (${[...new Set(wandBlocked.map(cc => SPELLS[cc.sp].n))].join(', ')}). They will not fire. Switch wands or change the pipeline.</p>` : ''}</div>
  <div class="panel"><pre>${ok ? cp.out.map(cc => lineOf(cc, ST)).join('\n') : '// slot at least one damage spell the equipped wand can fire'}${cp.dead.length ? '\n// warning: trailing modifier does nothing' : ''}</pre></div>

  <p class="lbl">Hand (tap to slot; double-tap to stash in Storage; if pipeline is full, tap a hand card, then a pipeline card)</p>
  <div class="grid">${G.hand.map((cc, i) => cardH(cc.k, `data-hand="${i}"`, 0, cc.v, (G.fz === cc.id ? 'fz ' : '') + (G.fs === cc.id || (G.sel && G.sel.id === cc.id) ? 'selc' : G.fs && G.hand.find(x => x.id === G.fs)?.k === cc.k ? 'glow' : ''), G)).join('')}</div>

  <div class="row">
    <button class="btn" data-act="run" ${ok ? '' : 'disabled'}>Run round ${c.i}</button>
    <button class="btn g" data-act="clear" ${G.slots.length ? '' : 'disabled'}>Clear pipeline</button>
    <button class="btn g" data-act="fuse">${G.fm === 'f' ? 'Fusing...' : 'Fuse'}</button>
    <button class="btn g" data-act="unfuse">${G.fm === 'u' ? 'Unfusing...' : 'Unfuse'}</button>
    ${G.sel && G.sel.z === 'h' ? `<button class="btn g" data-act="stash" style="border-color:#0b8479;color:#0b8479;font-weight:700" title="Store selected card in Storage">📥 Stash in Storage</button>` : ''}
  </div>
  <p class="lbl">${G.msg || 'Persistent Pipeline: cards stay equipped between rounds. Store cards in Storage, or delete 3 cards to put 3 fresh cards in draw pile.'}</p></div>
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

 const binTabBtn = e.target.closest('[data-bin-tab]');
 if (binTabBtn) { G.binTab = binTabBtn.dataset.binTab === 'wands' ? 'wands' : 'cards'; G.binWandConfirm = 0; uiSound('select'); render(); return; }
 const wandRestoreBtn = e.target.closest('[data-wand-restore]');
 if (wandRestoreBtn) { // Wands tab: restores ONLY a wand (G.binWands -> G.wands). Cards are not touched.
  const id = wandRestoreBtn.dataset.wandRestore;
  if (restoreWand(id)) { uiSound('card_place'); G.msg = `${wandName(id)} restored to your collection.`; }
  render(); return;
 }
 const binRestoreBtn = e.target.closest('[data-bin-restore]');
 if (binRestoreBtn) {
  const id = +binRestoreBtn.dataset.binRestore;
  const card = G.disc.find(c => c.id === id);
  if (card) {
   G.disc.splice(G.disc.indexOf(card), 1);
   G.hand.push(card);
   uiSound('card_place');
   G.msg = `${defOf(card.k).n} restored from Storage to hand.`;
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

 const t = e.target.closest('[data-act],[data-host],[data-hand],[data-slot],[data-pick],[data-cat],[data-world],[data-set],[data-setv],[data-slotend]');
 if (!t) return;
 const d = t.dataset;
 uiSound(d.hand != null ? 'card_pick' : (d.slot != null || d.slotend != null) ? 'card_place' : d.pick != null ? 'reward' : (d.host || d.cat != null || d.world != null) ? 'select' : (d.set != null || d.setv != null || d.act === 'mute') ? 'toggle' : (d.act === 'run' || d.act === 'start' || d.act === 'initialize') ? 'start' : (d.act === 'clear' || d.act === 'title' || d.act === 'unfuse') ? 'back' : (d.act === 'view-draw' || d.act === 'view-disc' || d.act === 'view-deck' || d.act === 'settings') ? 'open' : 'click');

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
 if (d.act === 'sandbox') {
  G.sandboxMessage = '';
  G.view = 'sandbox'; render();
  return;
 }
 if (d.act === 'sandbox-start') {
  const round = Number($('#sandbox-round')?.value);
  const boss = $('#sandbox-boss')?.value || 'round';
  const sbHost = $('#sandbox-host')?.value; if (sbHost && HOSTS[sbHost]) G.host = sbHost; // sandbox can use every Host, locked or not
  initializeRun(true, Number.isFinite(round) ? round : 1, boss);
  return;
 }
 if (d.act === 'sandbox-skip') { sandboxSkipRound(); return; }
 if (d.act === 'continue-summary') {
  G.view = 'result-load';
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
  const cost = redrawCost(G.layerRedraws || 0);
  if ((G.cycles ?? 0) < cost) { G.msg = `Redraw costs ${cost} Cycles (you have ${G.cycles ?? 0}).`; uiSound('deny'); render(); return; }
  G.cycles -= cost; G.layerRedraws = (G.layerRedraws || 0) + 1;
  G.disc.push(...G.hand);
  G.hand = [];
  drawN(6 + ST.hand);
  render();
  return;
 }
 if (d.act === 'wands-empty') { if ((G.binWands || []).length) { G.binWandConfirm = 1; uiSound('select'); } render(); return; } // first click only arms the confirmation
 if (d.act === 'wands-empty-cancel') { G.binWandConfirm = 0; render(); return; }
 if (d.act === 'wands-empty-confirm') { // permanently removes ONLY the stored wands; G.disc / G.deck are never touched
  const n = (G.binWands || []).length; G.binWands = []; G.binWandConfirm = 0;
  G.msg = n ? `${n} stored wand${n > 1 ? 's' : ''} permanently deleted.` : ''; uiSound('back'); render(); return;
 }
 if (d.act === 'bin-recycle-3') {
  if (G.disc.length < 3) {
   G.msg = `Need at least 3 cards in Storage to recycle (currently ${G.disc.length}).`;
   uiSound('deny');
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
    uiSound('card_drop');
    G.msg = `${defOf(card.k).n} stored in Storage.`;
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
    uiSound('deny');
    setTimeout(() => t.classList.remove('deny'), 400);
    return;
   }
  } else G.host = d.host;
  render();
 } else if (d.act === 'pause') {
  togglePause();
 } else if (d.setv) {
  const [k, v] = d.setv.split(':');
  if (SETS[k] && SETS[k][1].includes(+v)) { SET[k] = +v; META.set = SET; saveMeta(); applyAudioSettings(); }
  render();
 } else if (d.act === 'test-sfx' || d.act === 'test-boss' || d.act === 'test-ui') {
  testSound(d.act.slice(5));
 } else if (d.set) {
  const tt = SETS[d.set], i = tt[1].indexOf(SET[d.set]);
  SET[d.set] = tt[1][(i + 1) % tt[1].length];
  META.set = SET; saveMeta(); applyAudioSettings();
  if (d.set === 'mus') syncMusic();
  render();
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
  setMute(!MUTE); syncMusic(); render();
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
 } else if ((d.act === 'sbx-add' || d.act === 'sbx-add-hand') && G.sandbox) {
  const k = $('#sbx-card')?.value, v = +($('#sbx-ver')?.value || 1);
  if (k && (SPELLS[k] || MODS[k])) { G.sbxCard = k; const c = mk(k, v); G.deck.push(c); if (d.act === 'sbx-add' && G.slots.length < nSlots()) G.slots.push(c); else G.hand.push(c); sfx('heal'); }
  render(); return;
 } else if (d.act === 'wand-store') {
  const id = d.wand;
  if (storeWand(id)) { G.msg = `${wandName(id)} moved to Storage (Wands tab).`; uiSound('card_drop'); }
  else { G.msg = id === G.wand ? 'Equip a different wand before storing this one.' : 'The Universal Wand cannot be stored.'; uiSound('deny'); }
  render();
 } else if (d.act === 'wand-equip') {
  if (equipWand(d.wand)) { const nb = blockedCards().length; G.msg = `${wandOf(G.wand).n} equipped.` + (nb ? ` Warning: ${nb} pipeline spell${nb > 1 ? 's' : ''} cannot be fired by it.` : ''); sfx('heal'); }
  render();
 } else if (d.act === 'clear') {
  const n = G.slots.filter(c => c.lk).length;
  G.slots.forEach(leave);
  G.slots = [];
  G.sel = 0;
  G.msg = n ? n + ' used card' + (n > 1 ? 's' : '') + ' went to the Storage.' : '';
  render();
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
     uiSound('card_fuse');
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
 applyAudioSettings();
 const lbl = document.getElementById('vol-' + k); if (lbl) lbl.textContent = Math.round(v * 100) + '%';
 META.set = SET; saveMeta();
});
$('#app').addEventListener('change', e => {
 const sl = e.target.closest('[data-vol]');
 if (!sl) return;
 // let go of a slider: play a sample of the channel you just changed
 const k = sl.dataset.vol;
 if (k === 'vs') sfx('cast_proj'); else if (k === 'vb') sfx('boss_aim'); else if (k === 'vu') uiSound('select'); else if (k === 'vm') sfx('heal');
});
$('#app').addEventListener('contextmenu', e => e.preventDefault());
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
addEventListener('pointerup', e => {
 if (e.pointerType === 'mouse' && e.button === 2) mouseFire = 0;
});
addEventListener('pointercancel', e => {
 if (e.pointerType === 'mouse') mouseFire = 0;
 if (e.pointerType === 'touch') mobileFire = 0;
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
 if (G.view === 'run' && R?.shopOpen) { if (k === 'escape') { e.preventDefault(); closeShop(); } return; } // the shop menu owns the keyboard while it is open
 if ((k === '`' || e.code === 'Backquote') && G.view === 'run' && R && !R.end) { // ` toggles the pause / settings menu (Esc is left alone: it exits fullscreen)
  e.preventDefault(); e.stopPropagation();
  if (!e.repeat) togglePause();
  return;
 }
 if (G.view === 'run' && R && R.paused) return;
 if (G.view === 'run' && R && R.bossIntro && DLG_BOSSES.includes(G.cfg.boss) && (k === 'enter' || k === ' ' || k === 'z' || k === 'x')) {
  e.preventDefault();
  if (!e.repeat) segDialogueAdvance();
  return;
 }
 if (G.view === 'run' && R && R.seg && !R.bossIntro && ['1', '2', '3', '4'].includes(k) && R.seg.relays.some(r => r.qte)) { e.preventDefault(); if (!e.repeat) segQteInput(+k - 1); return; }
 if (G.view === 'run' && R?.room && G.mapMode === 2 && k === 'escape') { e.preventDefault(); G.mapMode = 0; syncMap(); return; }
 if (G.view === 'run' && R?.room && !e.repeat && k === 'm') { e.preventDefault(); cycleMap(); return; }
 if (G.view === 'run' && R?.room && !R.bossIntro && !e.repeat && (k === 'e' || k === 'q')) { e.preventDefault(); if (k === 'e') interact(); else useItem('restore'); return; }
 if (k === 'z' && G.view === 'run' && R && !R.bossIntro && !R.end) {
  e.preventDefault();
  if (!e.repeat) setCombatMode(!R.combatMode);
  return;
 }
 if (k === 'h' && G.view === 'run' && R && !R.paused && !e.repeat) {
  SET.bhp = (SET.bhp + 1) % 3; META.set = SET; saveMeta();
  R.hint = { t: 2, s: 'Boss HP Display: ' + BHP_NAMES[SET.bhp] };
  uiSound('toggle');
  return;
 }
 if (k === ' ' || k === 'shift') {
  dashReq = true;
  if (G.view === 'run') e.preventDefault();
 } else if (k === 'x' && G.view === 'run') {
  if (!fireBlockedX) keys.x = 1;
 } else keys[k] = 1;
 if (G.view === 'run' && k.startsWith('arrow')) e.preventDefault();
});
addEventListener('keyup', e => {
 const k = e.key.toLowerCase();
 keys[k] = 0;
 if (k === 'x') fireBlockedX = 0;
});

render();
initFullscreen();

// Test-only hook: compiled out of production builds (import.meta.env.VITE_TEST is undefined unless a test build sets it).
if (import.meta.env?.VITE_TEST) window.__SC = { get G() { return G; }, get R() { return R; }, leaveRoom, openChest, openShop, startRoomReward, roomMap, render, fight, wandOffer, roomClear, advance, ST: () => ST };
