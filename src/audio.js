import { MUSIC } from './data.js';

// ===== SPELLCODE AUDIO =====
// One AudioContext, four mixer buses (music / effects / boss+enemy / interface) -> master -> compressor.
// All sound effects are generated live (no sound files needed). Music comes from /audio/*.
export let AC = null, MUTE = false, lastS = {};
export const VOL = { master: 1, music: 1, sfx: 1, boss: 1, ui: 1 };
// Switches controlled from Settings: music/sfx on-off, button style (0 off, 1 soft, 2 classic, 3 arcade), card sounds, density (0 low, 1 normal, 2 high)
export const AOPT = { music: 1, sfx: 1, ui: 1, cards: 1, dens: 1 };

const MUSIC_MASTER = 1, MAXV = [14, 26, 40];
let bus = null, noiseBuf = null, voices = 0;

function ctx() {
 if (AC) return AC;
 try {
  AC = new (window.AudioContext || window.webkitAudioContext)();
  const master = AC.createGain(), comp = AC.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 20; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .2;
  master.connect(comp); comp.connect(AC.destination);
  bus = { master };
  for (const k of ['music', 'sfx', 'boss', 'ui']) { const g = AC.createGain(); g.connect(master); bus[k] = g; }
  const n = AC.sampleRate, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf = b;
  applyVolumes();
 } catch (e) { AC = null; bus = null; }
 return AC;
}

export function applyVolumes() {
 if (!AC || !bus) return;
 const t = AC.currentTime, set = (g, v) => { try { g.gain.setTargetAtTime(v, t, .015); } catch (e) { g.gain.value = v; } };
 set(bus.master, VOL.master);
 set(bus.music, MUSIC_MASTER * VOL.music * (AOPT.music ? 1 : 0));
 set(bus.sfx, VOL.sfx * (AOPT.sfx ? 1 : 0));
 set(bus.boss, VOL.boss * (AOPT.sfx ? 1 : 0));
 set(bus.ui, VOL.ui * (AOPT.ui ? 1 : 0));
}
export function setMute(m) {
 MUTE = m;
 if (m) stopMusic();
}

// ---------- primitives ----------
const panOf = x => Math.max(-.9, Math.min(.9, (x / 640 - .5) * 1.6));
function route(c, node, o) {
 let out = node;
 if (o.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = o.pan; out.connect(p); out = p; }
 out.connect(bus[o.bus || 'sfx']);
}
function tone(o) {
 const c = ctx();
 if (!c || !bus || voices >= MAXV[AOPT.dens]) return;
 if (c.state === 'suspended') c.resume();
 const t0 = c.currentTime + (o.at || 0), d = o.d || .1, os = c.createOscillator(), g = c.createGain();
 os.type = o.type || 'square';
 os.frequency.setValueAtTime(Math.max(20, o.f), t0);
 if (o.f2) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + d);
 if (o.det) os.detune.value = o.det;
 g.gain.setValueAtTime(.0001, t0);
 g.gain.linearRampToValueAtTime(Math.max(.0003, o.v ?? .05), t0 + Math.min(o.a ?? .004, d * .5));
 g.gain.exponentialRampToValueAtTime(.0006, t0 + d);
 os.connect(g);
 let out = g;
 if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); out = f; }
 route(c, out, o);
 os.start(t0); os.stop(t0 + d + .03);
 voices++; os.onended = () => { voices--; };
}
function noise(o) {
 const c = ctx();
 if (!c || !bus || !noiseBuf || voices >= MAXV[AOPT.dens]) return;
 if (c.state === 'suspended') c.resume();
 const t0 = c.currentTime + (o.at || 0), d = o.d || .1, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
 src.buffer = noiseBuf; src.loop = true;
 f.type = o.ft || 'bandpass'; f.Q.value = o.q ?? 1;
 f.frequency.setValueAtTime(Math.max(40, o.f || 1000), t0);
 if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.f2), t0 + d);
 g.gain.setValueAtTime(.0001, t0);
 g.gain.linearRampToValueAtTime(Math.max(.0003, o.v ?? .05), t0 + Math.min(o.a ?? .005, d * .5));
 g.gain.exponentialRampToValueAtTime(.0006, t0 + d);
 src.connect(f); f.connect(g);
 route(c, g, o);
 src.start(t0, Math.random() * .5); src.stop(t0 + d + .03);
 voices++; src.onended = () => { voices--; };
}

// Legacy helper kept for the many existing snd() calls: a quick pitched blip on the effects bus.
export function snd(f, d = .08, type = 'square', v = .04, sl = 0, key, b = 'sfx') {
 if (MUTE) return;
 const t = performance.now();
 if (key) {
  if (t - (lastS[key] || 0) < 70 * [1.8, 1, .6][AOPT.dens]) return;
  lastS[key] = t;
 }
 tone({ f, f2: sl ? Math.max(30, f + sl) : 0, d, type, v, bus: b });
}

// ---------- interface sounds (buttons, cards, windows) ----------
// Each entry: [frequency, duration, delay]. Style 1 = soft (sine), 2 = classic (square blip), 3 = arcade (bright, sliding squares).
const UIN = {
 click: [[440, .05, 0]],
 select: [[392, .07, 0], [523, .09, .05]],
 toggle: [[330, .04, 0], [494, .05, .035]],
 back: [[392, .05, 0], [294, .07, .04]],
 open: [[500, .05, 0], [700, .06, .04]],
 close: [[700, .05, 0], [480, .06, .04]],
 tick: [[620, .02, 0]],
 card_pick: [[587, .05, 0], [740, .04, .03]],
 card_place: [[260, .06, 0], [390, .05, .04]],
 card_drop: [[330, .05, 0], [220, .09, .04]],
 card_fuse: [[523, .08, 0], [659, .08, .06], [784, .08, .12], [1047, .18, .18]],
 card_unfuse: [[784, .07, 0], [587, .07, .06], [440, .12, .12]],
 card_draw: [[480, .04, 0], [560, .04, .05], [640, .04, .1]],
 start: [[392, .06, 0], [523, .06, .06], [784, .14, .12]],
 reward: [[523, .08, 0], [659, .08, .07], [784, .08, .14], [1047, .22, .21]],
 buy: [[880, .05, 0], [1175, .09, .05]],
 deny: [[170, .18, 0]]
};
export function uiSound(kind) {
 if (MUTE || !AOPT.ui) return;
 if (kind.startsWith('card') && !AOPT.cards) return;
 const t = performance.now(), key = 'ui_' + kind;
 if (t - (lastS[key] || 0) < (kind === 'tick' ? 35 : 40)) return;
 lastS[key] = t;
 const st = AOPT.ui, list = UIN[kind] || UIN.click;
 if (kind.startsWith('card') && st !== 2) {
  // paper / card shuffle texture under the notes
  noise({ d: kind === 'card_fuse' ? .16 : .06, f: kind === 'card_place' ? 900 : 3200, f2: kind === 'card_place' ? 400 : 1800, q: .8, v: .035, bus: 'ui' });
 }
 for (const [f, d, at] of list) {
  if (kind === 'deny') { tone({ f: st === 1 ? 190 : 150, f2: 70, d, type: 'sawtooth', v: .05, bus: 'ui', lp: st === 1 ? 900 : 4000 }); continue; }
  if (st === 1) tone({ f, d: d * 1.5, type: 'sine', v: .06, at, bus: 'ui', a: .008 });
  else if (st === 2) tone({ f, d, type: 'square', v: .03, at, bus: 'ui' });
  else tone({ f: f * 1.5, f2: f * 2, d: d * .9, type: 'square', v: .025, at, bus: 'ui' });
 }
}

// ---------- sound effect library ----------
// bus: 'sfx' = your spells and combat, 'boss' = bosses, enemies and their attacks.
const J = (f, a = .05) => f * (1 + (Math.random() - .5) * a);
const T = (o, p) => tone({ ...o, pan: p });
const bt = (o, p) => tone({ bus: 'boss', ...o, pan: p });
const bn = (o, p) => noise({ bus: 'boss', ...o, pan: p });
const LIB = {
 // --- your spells ---
 cast_proj: [55, (p) => { T({ f: J(760), f2: 380, d: .07, v: .022 }, p); T({ f: J(1500), f2: 900, d: .04, type: 'triangle', v: .012 }, p); }],
 cast_nova: [90, (p) => { T({ f: 150, f2: 50, d: .24, type: 'sine', v: .08 }, p); noise({ d: .2, f: 1000, f2: 200, q: .7, v: .05, pan: p }); }],
 cast_chain: [60, (p) => { noise({ d: .1, ft: 'highpass', f: 2500, v: .03, pan: p }); T({ f: J(1200), f2: 300, d: .09, type: 'sawtooth', v: .018 }, p); }],
 cast_cone: [70, (p) => { noise({ d: .22, f: 600, f2: 1800, q: .5, v: .05, pan: p }); noise({ d: .26, ft: 'lowpass', f: 420, v: .05, pan: p }); }],
 cast_beam: [80, (p) => { T({ f: 1800, f2: 600, d: .14, type: 'sawtooth', v: .028, lp: 3500 }, p); T({ f: 900, f2: 300, d: .16, type: 'sine', v: .05 }, p); }],
 cast_melee: [70, (p) => { noise({ d: .14, f: 1200, f2: 3500, q: 1.2, v: .05, pan: p }); T({ f: 200, f2: 120, d: .08, type: 'triangle', v: .04 }, p); }],
 cast_orbit: [200, (p) => { T({ f: 300, f2: 620, d: .35, type: 'triangle', v: .04 }, p); T({ f: 450, f2: 900, d: .35, type: 'sine', v: .03, at: .05 }, p); }],
 cast_mine: [120, (p) => { T({ f: 500, d: .05, v: .03 }, p); T({ f: 700, d: .05, v: .03, at: .07 }, p); }],
 cast_self: [120, (p) => { T({ f: 523, d: .1, type: 'triangle', v: .05 }, p); T({ f: 784, d: .14, type: 'triangle', v: .05, at: .07 }, p); }],
 hit: [45, (p) => T({ f: J(380, .2), d: .04, v: .016 }, p)],
 crit: [60, (p) => { T({ f: 700, d: .05, v: .03 }, p); T({ f: 1400, d: .06, type: 'triangle', v: .025, at: .03 }, p); }],
 kill: [50, (p) => { noise({ d: .1, f: 900, f2: 200, v: .035, pan: p }); T({ f: 160, f2: 70, d: .1, type: 'sawtooth', v: .03 }, p); }],
 boom: [80, (p) => { noise({ d: .3, f: 1400, f2: 120, q: .6, v: .07, pan: p }); T({ f: 110, f2: 38, d: .3, type: 'sine', v: .09 }, p); }],
 player_hurt: [110, () => { T({ f: 150, f2: 55, d: .22, type: 'sawtooth', v: .08, lp: 1400 }); noise({ d: .12, f: 700, f2: 200, v: .05 }); }],
 shield_hit: [70, () => { T({ f: 900, f2: 600, d: .09, type: 'triangle', v: .05 }); T({ f: 1350, f2: 900, d: .07, type: 'sine', v: .03 }); }],
 shield_break: [150, () => { noise({ d: .25, ft: 'highpass', f: 2000, v: .05 }); T({ f: 600, f2: 120, d: .3, type: 'sawtooth', v: .05 }); }],
 dash: [90, () => { noise({ d: .16, f: 500, f2: 3000, q: .7, v: .05 }); T({ f: 360, f2: 900, d: .12, type: 'triangle', v: .03 }); }],
 heal: [150, () => { T({ f: 660, d: .1, type: 'sine', v: .05 }); T({ f: 880, d: .16, type: 'sine', v: .05, at: .08 }); }],
 pickup: [60, () => { T({ f: 800, f2: 1200, d: .08, type: 'triangle', v: .05 }); }],
 orbit_block: [60, (p) => { T({ f: 1500, d: .09, type: 'sine', v: .045 }, p); T({ f: 2250, d: .06, type: 'sine', v: .025 }, p); }],
 orbit_zap: [70, (p) => { T({ f: 2000, f2: 500, d: .1, type: 'sawtooth', v: .02, lp: 4000 }, p); }],
 shatter: [120, (p) => { noise({ d: .3, ft: 'highpass', f: 3000, f2: 1500, q: .6, v: .06, pan: p }); T({ f: 1300, f2: 300, d: .25, type: 'triangle', v: .04 }, p); }],
 objective: [80, () => { T({ f: 660, d: .1, type: 'triangle', v: .05 }); T({ f: 990, d: .14, type: 'triangle', v: .05, at: .07 }); }],
 // --- bosses & enemies ---
 enemy_shoot: [90, (p) => bt({ f: J(300), f2: 190, d: .09, type: 'sawtooth', v: .02, lp: 1800 }, p)],
 shooter_shoot: [90, (p) => { bt({ f: J(540), f2: 300, d: .1, type: 'sine', v: .035 }, p); bt({ f: 810, f2: 450, d: .07, type: 'triangle', v: .015 }, p); }],
 boss_aim: [140, (p) => { for (let i = 0; i < 3; i++) bt({ f: 320 - i * 40, f2: 150, d: .1, type: 'sawtooth', v: .03, at: i * .04, lp: 2500 }, p); }],
 boss_ring: [200, (p) => { bn({ d: .45, f: 300, f2: 1800, q: .6, v: .05 }, p); bt({ f: 120, f2: 70, d: .35, type: 'sine', v: .06 }, p); }],
 boss_bolt: [80, (p) => bt({ f: J(260), f2: 140, d: .12, type: 'sawtooth', v: .022, lp: 1500 }, p)],
 // Segment Fault: dialogue voices (Undertale-style typewriter blips), bulkhead impact, relay turrets, stdout flames
 dlg_boss: [30, (p) => bt({ f: J(95, .1), d: .05, type: 'square', v: .022, lp: 900 }, p)],
 dlg_sys: [30, (p) => bt({ f: J(880, .06), d: .035, type: 'square', v: .014, lp: 3200 }, p)],
 dlg_radio: [30, (p) => { bn({ d: .03, f: 2200, v: .012, q: 1 }, p); bt({ f: J(520, .12), d: .03, type: 'triangle', v: .012 }, p); }],
 seg_impact: [400, () => { bn({ d: .7, f: 1800, f2: 60, q: .5, v: .1 }); bt({ f: 90, f2: 28, d: .7, type: 'sine', v: .12 }); bt({ f: 220, f2: 60, d: .4, type: 'sawtooth', v: .05, lp: 900 }); }],
 seg_relay: [90, (p) => bt({ f: J(180), f2: 120, d: .14, type: 'square', v: .02, lp: 1200 }, p)],
 seg_relay_charge: [300, (p) => bt({ f: 260, f2: 620, d: .6, type: 'triangle', v: .02 }, p)],
 seg_flame: [150, (p) => { bn({ d: .5, f: 900, f2: 2600, q: .5, v: .05 }, p); bt({ f: 110, f2: 70, d: .45, type: 'sawtooth', v: .03, lp: 700 }, p); }],
 leak_shot: [70, (p) => { bt({ f: J(210), f2: 120, d: .13, type: 'sawtooth', v: .025, lp: 900 }, p); bn({ d: .05, f: 600, v: .015 }, p); }],
 zone_warn: [160, (p) => { bt({ f: 880, d: .05, v: .03 }, p); bt({ f: 880, d: .05, v: .03, at: .12 }, p); }],
 zone_boom: [70, (p) => { bn({ d: .3, f: 1200, f2: 100, q: .6, v: .06 }, p); bt({ f: 95, f2: 40, d: .28, type: 'sine', v: .08 }, p); }],
 enemy_dash_tele: [120, (p) => bt({ f: 320, f2: 900, d: .3, type: 'sawtooth', v: .02, lp: 2500 }, p)],
 enemy_dash: [100, (p) => { bn({ d: .2, f: 800, f2: 3500, q: .8, v: .05 }, p); bt({ f: 200, f2: 500, d: .12, type: 'triangle', v: .03 }, p); }],
 enemy_tp: [100, (p) => { for (let i = 0; i < 4; i++) bt({ f: 500 + Math.random() * 900, d: .03, v: .02, at: i * .03 }, p); }],
 enemy_summon: [220, (p) => { bt({ f: 90, f2: 200, d: .5, type: 'sawtooth', v: .04, lp: 700 }, p); bt({ f: 600, d: .06, type: 'sine', v: .03, at: .4 }, p); }],
 boss_warning: [900, () => { for (let i = 0; i < 4; i++) bt({ f: i % 2 ? 380 : 520, d: .2, type: 'sawtooth', v: .04, at: i * .2, lp: 1800 }); }],
 boss_phase: [400, () => { bn({ d: .6, f: 1500, f2: 80, v: .07 }); bt({ f: 160, f2: 40, d: .6, type: 'sawtooth', v: .07, lp: 800 }); }],
 boss_death: [900, () => { bn({ d: 1.4, f: 2000, f2: 60, q: .5, v: .09 }); bt({ f: 120, f2: 30, d: 1.3, type: 'sine', v: .11 }); for (let i = 0; i < 5; i++) bt({ f: 800 - i * 110, d: .12, type: 'square', v: .03, at: .2 + i * .16 }); }],
 tp_charge: [900, (p) => bt({ f: 200, f2: 1200, d: .9, type: 'triangle', v: .04 }, p)],
 tp_land: [150, (p) => { bn({ d: .25, f: 1600, f2: 200, v: .06 }, p); bt({ f: 130, f2: 50, d: .25, type: 'sine', v: .08 }, p); }],
 // Race Condition
 race_dash_tele: [150, (p) => bt({ f: 260, f2: 780, d: .5, type: 'sawtooth', v: .02, lp: 2200 }, p)],
 race_dash: [100, (p) => { bn({ d: .26, f: 700, f2: 4000, q: .9, v: .06 }, p); bt({ f: 180, f2: 700, d: .2, type: 'sawtooth', v: .035, lp: 2500 }, p); }],
 race_check_a: [150, (p) => { bt({ f: 330, d: .12, type: 'square', v: .04, lp: 2500 }, p); bn({ d: .2, f: 900, f2: 200, v: .04 }, p); }],
 race_check_b: [150, (p) => { bt({ f: 520, d: .12, type: 'square', v: .04, lp: 3000 }, p); bn({ d: .2, f: 1400, f2: 300, v: .04 }, p); }],
 race_stack_tick: [30, (p) => bt({ f: 700 + Math.random() * 300, d: .03, type: 'square', v: .02 }, p)],
 race_stack_boom: [40, (p) => { bn({ d: .16, f: 1500, f2: 250, v: .04 }, p); bt({ f: 150, f2: 70, d: .14, type: 'sine', v: .05 }, p); }],
 race_beam_charge: [300, (p) => { bt({ f: 300, f2: 2200, d: .7, type: 'sine', v: .03 }, p); bt({ f: 600, f2: 3000, d: .7, type: 'sawtooth', v: .008, lp: 3500 }, p); }],
 race_beam_lock: [100, (p) => { bt({ f: 2600, d: .04, type: 'square', v: .04 }, p); bt({ f: 2600, d: .04, type: 'square', v: .04, at: .07 }, p); }],
 race_beam_fire: [100, (p) => { bn({ d: .22, ft: 'highpass', f: 2500, f2: 800, v: .07 }, p); bt({ f: 3200, f2: 260, d: .24, type: 'sawtooth', v: .05, lp: 5000 }, p); bt({ f: 140, f2: 60, d: .2, type: 'sine', v: .06 }, p); }],
 race_tether: [200, (p) => { bn({ d: .12, ft: 'highpass', f: 3500, v: .04 }, p); bt({ f: 120, d: .1, type: 'sawtooth', v: .03, lp: 600 }, p); }],
 race_lock_form: [200, (p) => { bt({ f: 420, f2: 840, d: .2, type: 'triangle', v: .05 }, p); bt({ f: 630, f2: 1260, d: .2, type: 'sine', v: .03 }, p); }],
 race_split: [900, () => { bn({ d: .9, f: 3000, f2: 80, q: .5, v: .08 }); bt({ f: 90, f2: 30, d: .9, type: 'sawtooth', v: .08, lp: 600 }); bt({ f: 900, f2: 200, d: .5, type: 'triangle', v: .04, at: .1 }); }],
 race_merge: [600, () => { bt({ f: 100, f2: 400, d: .5, type: 'sawtooth', v: .06, lp: 1200 }); bn({ d: .4, f: 400, f2: 3000, v: .05 }); }],
 // Memory Leak army
 leak_frag_rush: [140, (p) => bt({ f: 520 + Math.random() * 200, f2: 1100, d: .1, type: 'sawtooth', v: .012, lp: 3000 }, p)],
 leak_frag_hit: [60, (p) => { bn({ d: .12, f: 1100, f2: 250, v: .05 }, p); bt({ f: 240, f2: 90, d: .12, type: 'square', v: .03 }, p); }],
 leak_shard_burst: [100, (p) => { for (let i = 0; i < 3; i++) bt({ f: 520 - i * 35, f2: 260, d: .08, type: 'sawtooth', v: .022, at: i * .07, lp: 2200 }, p); }],
 leak_core_charge: [400, (p) => { bt({ f: 70, f2: 220, d: .9, type: 'sawtooth', v: .04, lp: 700 }, p); bn({ d: .9, f: 300, f2: 1200, q: 2, v: .02 }, p); }],
 leak_core_laser: [150, (p) => { bt({ f: 150, f2: 140, d: .3, type: 'sawtooth', v: .06, lp: 1600 }, p); bn({ d: .3, f: 1800, q: 3, v: .04 }, p); }],
 leak_evolve: [150, (p) => { for (let i = 0; i < 4; i++) bt({ f: 400 * Math.pow(1.26, i), d: .1, type: 'triangle', v: .035, at: i * .05 }, p); bn({ d: .3, ft: 'highpass', f: 3000, v: .02 }, p); }],
 leak_promote: [600, () => { bt({ f: 220, d: .3, type: 'sawtooth', v: .04, lp: 1200 }); bt({ f: 330, d: .3, type: 'sawtooth', v: .04, at: .12, lp: 1200 }); bt({ f: 440, d: .5, type: 'sawtooth', v: .045, at: .24, lp: 1500 }); }],
 leak_prism_spawn: [2000, () => { for (const [i, f] of [440, 554, 659, 880].entries()) bt({ f, d: 1.1, type: 'sine', v: .035, at: i * .08, a: .15 }); bn({ d: .8, f: 600, f2: 4000, v: .03 }); }],
 leak_prism_heal: [250, (p) => { bt({ f: 520, f2: 780, d: .35, type: 'sine', v: .045 }, p); bt({ f: 780, f2: 1040, d: .35, type: 'sine', v: .03, at: .08 }, p); }],
 leak_prism_charge: [250, (p) => bt({ f: 300, f2: 700, d: .5, type: 'sine', v: .035 }, p)],
 leak_prism_corrupt: [250, (p) => { bt({ f: 880, f2: 330, d: .35, type: 'sawtooth', v: .03, det: 40, lp: 2500 }, p); bt({ f: 930, f2: 340, d: .35, type: 'sawtooth', v: .025, lp: 2500 }, p); }],
 leak_prism_shield: [200, (p) => { bt({ f: 1100, d: .15, type: 'sine', v: .035 }, p); bt({ f: 1650, d: .12, type: 'sine', v: .02, at: .05 }, p); }],
 leak_prism_die: [900, () => { bn({ d: 1, ft: 'highpass', f: 4000, f2: 500, v: .06 }); for (let i = 0; i < 5; i++) bt({ f: 1100 - i * 150, d: .25, type: 'sine', v: .04, at: i * .08 }); }],
 leak_core_block: [60, (p) => { bt({ f: 1100, d: .08, type: 'square', v: .03, lp: 3000 }, p); bt({ f: 1650, d: .05, type: 'sine', v: .02 }, p); }],
 leak_core_strain: [180, (p) => { bt({ f: 700, f2: 1500, d: .12, type: 'square', v: .03, lp: 3200 }, p); bt({ f: 1050, f2: 2100, d: .1, type: 'sine', v: .02, at: .05 }, p); }],
 leak_core_stagger: [400, (p) => { bn({ d: .5, ft: 'highpass', f: 3500, f2: 500, v: .06 }, p); bt({ f: 900, f2: 90, d: .5, type: 'sawtooth', v: .05, lp: 2500 }, p); bt({ f: 120, f2: 50, d: .4, type: 'sine', v: .07 }, p); }],
 leak_core_recover: [300, (p) => { bt({ f: 200, f2: 520, d: .3, type: 'triangle', v: .04 }, p); bt({ f: 520, f2: 780, d: .2, type: 'sine', v: .03, at: .1 }, p); }],
 leak_sacrifice: [500, (p) => { bn({ d: .5, f: 1200, f2: 80, v: .06 }, p); bt({ f: 160, f2: 40, d: .5, type: 'sawtooth', v: .06, lp: 600 }, p); }],
 necropost: [600, (p) => { bt({ f: 80, f2: 160, d: .8, type: 'sawtooth', v: .05, lp: 500 }, p); for (let i = 0; i < 5; i++) bt({ f: 700 + Math.random() * 500, d: .04, v: .02, at: .2 + i * .09 }, p); }]
};
export function sfx(name, o = {}) {
 if (MUTE) return;
 const L = LIB[name];
 if (!L) return;
 const t = performance.now(), gap = L[0] * [1.8, 1, .6][AOPT.dens];
 if (t - (lastS[name] || 0) < gap) return;
 lastS[name] = t;
 try { L[1](o.x != null ? panOf(o.x) : 0); } catch (e) {}
}
export function testSound(group) {
 const seq = group === 'ui' ? ['select', 'card_pick', 'card_place', 'card_fuse', 'reward'] : group === 'boss' ? ['boss_aim', 'race_beam_charge', 'leak_shard_burst', 'leak_evolve', 'boss_ring'] : ['cast_proj', 'cast_nova', 'cast_beam', 'boom', 'heal'];
 seq.forEach((k, i) => setTimeout(() => { delete lastS[k]; delete lastS['ui_' + k]; if (group === 'ui') uiSound(k); else sfx(k); }, i * 280));
}

// ---------- music ----------
let musicBuffer = null, musicSource = null, musicGain = null, musicKey = '', musicLoading = '', musicToken = 0;
let musicFilter = null, musicMoodGain = null, musicMood = { cutoff: 20000, gain: 1, tempo: 1 };

export function setMusicMood(cutoff = 20000, gain = 1, time = .5, tempo = 1) {
 musicMood = { cutoff: Math.max(80, cutoff), gain: Math.max(0, gain), tempo: Math.max(.5, Math.min(1.5, tempo)) };
 if (!AC || !musicFilter || !musicMoodGain) return;
 const now = AC.currentTime;
 musicSource?.playbackRate.cancelScheduledValues(now);
 musicSource?.playbackRate.setTargetAtTime(musicMood.tempo, now, Math.max(.02, time / 3));
 musicFilter.frequency.cancelScheduledValues(now);
 musicFilter.frequency.setTargetAtTime(musicMood.cutoff, now, Math.max(.02, time / 3));
 musicMoodGain.gain.cancelScheduledValues(now);
 musicMoodGain.gain.setTargetAtTime(musicMood.gain, now, Math.max(.02, time / 3));
}

export function ensureMusicContext() {
 const c = ctx();
 if (!c) return false;
 try { if (c.state === 'suspended') c.resume(); } catch (e) {}
 return true;
}

const musicCache = new Map(), musicPending = new Map(), MUSIC_CACHE_MAX = 6;

export function fetchDecode(k) {
 if (!MUSIC[k]) return Promise.resolve(null);
 if (musicCache.has(k)) {
  const d = musicCache.get(k);
  return Promise.resolve(d);
 }
 if (musicPending.has(k)) return musicPending.get(k);

 const p = (async () => {
  ensureMusicContext();
  const file = MUSIC[k].file;
  const base = file.replace(/\.(mp3|ogg)(\.(mp3|ogg))?$/i, '');
  const ext = file.includes('.ogg') ? '.ogg' : '.mp3';
  const paths = [
   '/audio/' + file,
   'audio/' + file,
   '/audio/' + base + ext,
   'audio/' + base + ext,
   '/audio/' + base + ext + ext,
   'audio/' + base + ext + ext,
   '/' + file,
   file,
   '/' + base + ext,
   base + ext
  ];
  for (const url of paths) {
   try {
    const r = await fetch(url);
    if (r.ok) {
     const ab = await r.arrayBuffer();
     const d = await AC.decodeAudioData(ab);
     d._isFile = true;
     musicCache.set(k, d);
     return d;
    }
   } catch (e) {}
  }
  return null;
 })();

 musicPending.set(k, p);
 const done = () => musicPending.delete(k);
 p.then(done, done);
 return p;
}

export function preloadMusic(k) {
 if (MUTE || !MUSIC[k] || !ensureMusicContext()) return Promise.resolve(true);
 return fetchDecode(k).then(() => true, () => true);
}

export function stopMusic(fade = .25) {
 if (!musicSource || !AC) return;
 const now = AC.currentTime, g = musicGain;
 try {
  if (g) {
   g.gain.cancelScheduledValues(now);
   g.gain.setValueAtTime(g.gain.value, now);
   g.gain.linearRampToValueAtTime(0, now + fade);
  }
  musicSource.stop(now + fade + .03);
 } catch (e) {}
 musicSource = null;
 musicGain = null;
 musicFilter = null;
 musicMoodGain = null;
}

export function playMusicBuffer(k) {
 const spec = MUSIC[k];
 if (!musicBuffer || !AC || !bus || !spec) return;
 const now = AC.currentTime, src = AC.createBufferSource(), g = AC.createGain();
 src.buffer = musicBuffer;
 src.loop = true;
 src.playbackRate.setValueAtTime(musicMood.tempo, now);
 if (musicBuffer._isFile && musicBuffer.duration > 15) {
  src.loopStart = Math.min(spec.start || 0, Math.max(0, musicBuffer.duration - .01));
  src.loopEnd = Math.min(spec.end || musicBuffer.duration, musicBuffer.duration);
  if (src.loopEnd <= src.loopStart) src.loopStart = 0;
  src.start(now, Math.min(src.loopStart, Math.max(0, musicBuffer.duration - .01)));
 } else {
  src.loopStart = 0;
  src.loopEnd = musicBuffer.duration;
  src.start(now);
 }
 g.gain.setValueAtTime(0, now);
 g.gain.linearRampToValueAtTime(spec.gain || 0.8, now + .25);
 const filter = AC.createBiquadFilter(), mood = AC.createGain();
 filter.type = 'lowpass';
 filter.frequency.setValueAtTime(musicMood.cutoff, now);
 filter.Q.value = .7;
 mood.gain.setValueAtTime(musicMood.gain, now);
 src.connect(filter);
 filter.connect(mood);
 mood.connect(g);
 g.connect(bus.music);
 musicSource = src;
 musicGain = g;
 musicFilter = filter;
 musicMoodGain = mood;
 src.onended = () => {
  if (musicSource === src) {
   musicSource = null;
   musicGain = null;
  }
 };
}

export async function setMusic(k) {
 if (MUTE || !k || !MUSIC[k]) {
  stopMusic();
  musicKey = '';
  musicLoading = '';
  return;
 }
 if (k === musicKey && musicSource) return;
 if (k === musicKey && musicLoading === k) return;
 musicKey = k;
 musicLoading = k;
 stopMusic(.18);
 const token = ++musicToken;
 let kk = k, d = await fetchDecode(k);
 if (!d && MUSIC[k].fb) { kk = MUSIC[k].fb; d = await fetchDecode(kk); } // track file not made yet: use its fallback
 if (token !== musicToken) return;
 musicBuffer = d;
 musicLoading = '';
 if (d && musicKey === k && !MUTE) {
  if (AC.state === 'suspended') await AC.resume();
  playMusicBuffer(kk);
 }
}

addEventListener('visibilitychange', () => {
 if (!AC) return;
 if (document.hidden) AC.suspend();
 else if (!MUTE) AC.resume();
});
