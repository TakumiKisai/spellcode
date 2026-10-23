import { W, H } from './constants.js';
import { ARENAS, EN, BOSSES, HOSTS, SPELLS, MODS } from './data.js';
import { cl, ri, pick, okMod } from './helpers.js';
import { snd } from './audio.js';
import { drawThemed } from './themes.js';

const dynamicWalls = new Map();
export function setDynamicWalls(arena, walls) {
 if (walls.length) dynamicWalls.set(arena, walls);
 else dynamicWalls.delete(arena);
}

export function wallHit(arena, x, y, r) {
 const blocks = ARENAS[arena].w, extra = dynamicWalls.get(arena) || [];
 for (const w of blocks) {
  if (x > w[0] - r && x < w[0] + w[2] + r && y > w[1] - r && y < w[1] + w[3] + r) return true;
 }
 for (const w of extra) {
  if (x > w[0] - r && x < w[0] + w[2] + r && y > w[1] - r && y < w[1] + w[3] + r) return true;
 }
 return x < r || y < r || x > W - r || y > H - r;
}

export function hazAt(arena, x, y) {
 for (const z of ARENAS[arena].hz) {
  if (x > z[0] && x < z[0] + z[2] && y > z[1] && y < z[1] + z[3]) return z[4];
 }
 return null;
}

export function mv(arena, o, dx, dy, r) {
 if (wallHit(arena, o.x, o.y, r)) {
  o.x = cl(o.x + dx, r, W - r);
  o.y = cl(o.y + dy, r, H - r);
  return;
 }
 if (!wallHit(arena, o.x + dx, o.y, r)) o.x += dx;
 if (!wallHit(arena, o.x, o.y + dy, r)) o.y += dy;
}

export const near = (R, o, max = 1e9) => {
 let b = null, bd = max;
 for (const e of R.en) {
  if (e.dead) continue;
  const d = Math.hypot(e.x - o.x, e.y - o.y);
  if (d < bd) { bd = d; b = e; }
 }
 return b;
};

export function compilePipeline(sl, ST) {
 const out = [];
 let m = [], mv = [];
 sl.forEach(c => {
  if (MODS[c.k]) {
   m.push(c.k);
   mv.push(c.v || 1);
  } else {
   out.push({ sp: c.k, mods: m, mv, lv: c.v || 1 });
   m = [];
   mv = [];
  }
 });
 return { out, dead: m };
}

export function stats(c, ST) {
 const s = SPELLS[c.sp] || { dmg: 0, rate: 1, sp: 200, rad: 5, pierce: 0, k: 'proj' };
 const a = {
  ...s, rate: s.rate || 1, rep: 1, pc: 1, area: 1, size: 1, sh: 0, home: 0, bounce: 0,
  expl: 0, split: 0, burn: 0, freeze: 0, knock: s.knock || 0, leech: 0,
  pull: 0, crit: 0, pierce: s.pierce || 0, sp: s.sp || 0, dmg: s.dmg || 0,
  jumps: s.jumps || 0, hpv: s.hpv || 0, shv: s.shv || 0
 };
 c.mods.forEach((k, i) => {
  if (okMod(k, c.sp) && MODS[k]) MODS[k].f(a, (c.mv && c.mv[i]) || 1);
 });
 const nm = c.mods.length;
 if (s.burn) a.burn = Math.max(1, a.burn);
 const lv = c.lv || 1;
 a.lv = lv;
 if (lv > 1) {
  const q = 1 + .6 * (lv - 1);
  a.dmg *= q;
  a.shv *= q;
  a.hpv *= q;
  a.size *= 1 + .12 * (lv - 1);
 }
 a.dmg *= (ST.dmg || 1) * (ST.stack ? 1 + .1 * nm : 1);
 a.rate *= (ST.rate || 1) * (1 + .03 * nm * (ST.compiler || 0));
 if (a.k === 'mine') a.rate = Math.min(a.rate, 1 / 1.4);
 a.size *= ST.stack ? 1 + Math.min(.16, .02 * nm) : 1;
 a.nm = nm;
 return a;
}

export function lineOf(c, ST) {
 const a = stats(c, ST);
 const f = [
  [a.rep > 1, a.rep + 'x cast'],
  [a.pc > 1, a.pc + '-way spread'],
  [a.home, 'homing'],
  [a.bounce, 'ricochet'],
  [a.expl, 'explodes'],
  [a.split, 'forks'],
  [a.size > 1.5, 'big'],
  [a.burn, 'burns'],
  [a.freeze, 'freezes'],
  [a.knock > (SPELLS[c.sp]?.knock || 0), 'knockback'],
  [a.leech, 'lifesteal'],
  [a.pull, 'pulls'],
  [a.crit, 'always crits'],
  [a.pierce > (SPELLS[c.sp]?.pierce || 0) && a.k === 'proj', 'pierces'],
  [a.sh, '+' + a.sh + ' shield']
 ].filter(x => x[0]).map(x => x[1]);

 return `${c.mods.map((k, i) => `<u>${MODS[k].n}${c.mv && c.mv[i] > 1 ? ' v' + c.mv[i] : ''}</u> > `).join('')}<i>${SPELLS[c.sp].n}</i> // ${a.dmg ? Math.round(a.dmg) + ' dmg, ' : ''}${a.rate.toFixed(2)}/s${f.length ? ': ' + f.join(', ') : ''}`;
}

// ===== BOOT SECTOR: dark motherboard / disk-platter floor. Blue-steel + dull amber only: no greens or hot colours, so every enemy, shot and hazard stands out. =====
function bootRand(n) { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
function drawBootSector(x, A) {
 const cx = W / 2, cy = H / 2;
 let g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a1326'); g.addColorStop(1, '#0f1d36');
 x.fillStyle = g; x.fillRect(0, 0, W, H);
 // PCB grid
 x.strokeStyle = 'rgba(70,110,170,.10)'; x.lineWidth = 1;
 for (let i = 0; i <= W; i += 20) { x.beginPath(); x.moveTo(i + .5, 0); x.lineTo(i + .5, H); x.stroke(); }
 for (let i = 0; i <= H; i += 20) { x.beginPath(); x.moveTo(0, i + .5); x.lineTo(W, i + .5); x.stroke(); }
 // disk platter: concentric dashed tracks + sector ticks, the boot sector motif
 x.save(); x.translate(cx, cy);
 x.strokeStyle = 'rgba(120,160,225,.17)'; x.lineWidth = 1.4;
 for (const r of [58, 104, 150, 196, 242]) { x.setLineDash(r % 2 ? [3, 7] : [14, 8]); x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
 x.setLineDash([]); x.strokeStyle = 'rgba(120,160,225,.14)';
 for (let i = 0; i < 48; i++) { const a = i * Math.PI / 24, r0 = 58, r1 = i % 4 ? 70 : 84; x.beginPath(); x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); x.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); x.stroke(); }
 x.fillStyle = 'rgba(150,185,240,.075)'; x.font = "800 58px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('55AA', 0, -4);
 x.font = "700 13px 'JetBrains Mono',monospace"; x.fillStyle = 'rgba(150,185,240,.22)'; x.fillText('0x7C00  MBR  LBA 0', 0, 34);
 x.restore();
 // copper trace bundles along the four edges (45-degree bends, via pads)
 const trace = (pts, col, wd) => { x.strokeStyle = col; x.lineWidth = wd; x.lineJoin = 'round'; x.lineCap = 'round'; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); };
 for (let i = 0; i < 7; i++) {
  const k = bootRand(i + 1), y0 = 34 + i * 5, bend = 90 + k * 160, dy = 12 + k * 22;
  const pts = [[0, y0], [bend, y0], [bend + dy, y0 + dy], [bend + dy + 120, y0 + dy], [bend + dy + 120 + 30, y0 + 4], [W * .55, y0 + 4]];
  trace(pts, 'rgba(34,64,108,.9)', 3); trace(pts, 'rgba(70,115,180,.35)', 1);
  x.fillStyle = 'rgba(95,150,220,.55)'; x.beginPath(); x.arc(pts[5][0], pts[5][1], 3, 0, 7); x.fill();
  const y1 = H - 34 - i * 5, b2 = W - bend, pts2 = [[W, y1], [b2, y1], [b2 - dy, y1 - dy], [b2 - dy - 120, y1 - dy], [b2 - dy - 150, y1 - 4], [W * .45, y1 - 4]];
  trace(pts2, 'rgba(34,64,108,.9)', 3); trace(pts2, 'rgba(70,115,180,.35)', 1);
  x.fillStyle = 'rgba(95,150,220,.55)'; x.beginPath(); x.arc(pts2[5][0], pts2[5][1], 3, 0, 7); x.fill();
 }
 for (let i = 0; i < 5; i++) {
  const x0 = 30 + i * 6, k = bootRand(i + 40), by = 80 + k * 70, pts = [[x0, 40], [x0, by], [x0 + 26, by + 26], [x0 + 26, H - 60 - k * 40], [x0, H - 40 - k * 40], [x0, H - 40]];
  trace(pts, 'rgba(30,58,100,.75)', 2.6); trace(pts, 'rgba(70,115,180,.28)', 1);
  const x1 = W - 30 - i * 6, pr = [[x1, 40], [x1, by + 20], [x1 - 26, by + 46], [x1 - 26, H - 80], [x1, H - 54], [x1, H - 40]];
  trace(pr, 'rgba(30,58,100,.75)', 2.6); trace(pr, 'rgba(70,115,180,.28)', 1);
 }
 // gold-finger edge connector along the bottom, silkscreen along the top
 for (let i = 0; i < 46; i++) { x.fillStyle = i % 2 ? 'rgba(176,138,60,.5)' : 'rgba(140,108,44,.5)'; x.fillRect(14 + i * 13.5, H - 9, 9, 9); }
 x.fillStyle = 'rgba(150,185,240,.5)'; x.font = "700 9px 'JetBrains Mono',monospace"; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
 x.fillText('BOOT SECTOR // 512 B // SIG 55 AA', 14, 14); x.textAlign = 'right'; x.fillText('REV 1.0  POST OK', W - 14, 14);
 // mounting holes + capacitors in the corners
 for (const [px, py] of [[14, 26], [W - 14, 26], [14, H - 22], [W - 14, H - 22]]) { x.strokeStyle = 'rgba(150,185,240,.5)'; x.lineWidth = 2; x.beginPath(); x.arc(px, py, 6, 0, 7); x.stroke(); x.fillStyle = '#060b16'; x.beginPath(); x.arc(px, py, 3.2, 0, 7); x.fill(); }
 // hazards
 for (const z of A.hz) {
  const lava = z[4] === 'lava';
  x.fillStyle = lava ? 'rgba(255,60,90,.34)' : 'rgba(70,170,255,.26)'; x.fillRect(z[0], z[1], z[2], z[3]);
  x.save(); x.beginPath(); x.rect(z[0], z[1], z[2], z[3]); x.clip(); x.strokeStyle = lava ? 'rgba(255,120,140,.5)' : 'rgba(130,200,255,.45)'; x.lineWidth = 2;
  for (let i = -z[3]; i < z[2]; i += 12) { x.beginPath(); x.moveTo(z[0] + i, z[1] + z[3]); x.lineTo(z[0] + i + z[3], z[1]); x.stroke(); }
  x.restore(); x.strokeStyle = lava ? '#ff8aa0' : '#8fd0ff'; x.lineWidth = 1.5; x.strokeRect(z[0] + .5, z[1] + .5, z[2] - 1, z[3] - 1);
 }
 // walls drawn as IC chips with pin rows
 const LAB = ['ROM', 'CPU', 'RAM', 'BIOS', 'I/O'];
 A.w.forEach((w, n) => {
  const [wx, wy, ww, wh] = w;
  x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(wx + 4, wy + 5, ww, wh);
  x.fillStyle = '#c9d4ea'; const horiz = ww >= wh;
  if (horiz) for (let px = wx + 5; px < wx + ww - 4; px += 7) { x.fillRect(px, wy - 4, 3.5, 5); x.fillRect(px, wy + wh - 1, 3.5, 5); }
  else for (let py = wy + 5; py < wy + wh - 4; py += 7) { x.fillRect(wx - 4, py, 5, 3.5); x.fillRect(wx + ww - 1, py, 5, 3.5); }
  const cg = x.createLinearGradient(wx, wy, wx + ww, wy + wh); cg.addColorStop(0, '#2b3d60'); cg.addColorStop(1, '#17233d');
  x.fillStyle = cg; x.fillRect(wx, wy, ww, wh);
  x.strokeStyle = '#8fb0e8'; x.lineWidth = 2; x.strokeRect(wx + 1, wy + 1, ww - 2, wh - 2);
  x.strokeStyle = 'rgba(143,176,232,.35)'; x.lineWidth = 1; x.strokeRect(wx + 6, wy + 6, ww - 12, wh - 12);
  x.fillStyle = 'rgba(143,176,232,.7)'; x.beginPath(); x.arc(wx + 10, wy + 10, 2.6, 0, 7); x.fill();
  if (Math.min(ww, wh) >= 40) { x.fillStyle = 'rgba(200,220,255,.75)'; x.font = "800 " + Math.min(14, Math.floor(Math.min(ww, wh) / 3.2)) + "px 'JetBrains Mono',monospace"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(LAB[n % LAB.length], wx + ww / 2, wy + wh / 2 + 1); }
 });
 // soft vignette keeps the eye on the arena centre
 g = x.createRadialGradient(cx, cy, 130, cx, cy, 400); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.38)');
 x.fillStyle = g; x.fillRect(0, 0, W, H);
}
// ===== CORRUPTED RESEARCH LAB (Memory Leak boss room) =====
// Static layer (drawLabSector, cached in R.bg) + a cheap live layer (drawLabLive) for flicker. Everything here is background:
// enemies, projectiles and telegraphs are drawn on top, and the palette is kept dark/desaturated so they stay readable.
function labProps(A) {
 if (A._p) return A._p;
 const mons = [], leds = [], traces = [], [cx, cy] = A.z.c;
 for (let i = 0; i < 9; i++) mons.push({ x: 262 + i * 30, y: 3, w: 24, h: 15 });                                  // back-wall monitor array
 A.w.slice(2, 4).forEach((w, k) => { for (let i = 0; i < 4; i++) mons.push({ x: w[0] + 12 + i * 40, y: w[1] + 5, w: 28, h: 16 }); }); // workstation screens
 mons.push({ x: 130, y: 214, w: 16, h: 12 }, { x: 654, y: 214, w: 16, h: 12 });                                    // centrifuge readouts
 A.w.slice(0, 2).forEach(w => { for (let c = 0; c < 8; c++) for (let r = 0; r < 3; r++) leds.push([w[0] + 12 + c * 19, w[1] + 9 + r * 8]); });
 for (let i = 0; i < 10; i++) { // green error traces creeping out of the containment chamber
  let a = i * .628 + .2, x = cx + Math.cos(a) * 126, y = cy + Math.sin(a) * 126; const pts = [[x, y]];
  for (let k = 0; k < 9; k++) { a += (bootRand(i * 11 + k) - .5) * 1.1; x += Math.cos(a) * (28 + bootRand(i + k * 5) * 26); y += Math.sin(a) * (28 + bootRand(k + i * 7) * 26); if (x < 10 || x > A.W - 10 || y < 24 || y > A.H - 24) break; pts.push([x, y]); }
  traces.push(pts);
 }
 return (A._p = { mons, leds, traces });
}
function drawLabSector(x, A) {
 const Wd = A.W, Hd = A.H, [cx, cy] = A.z.c, P = labProps(A), mono = "'JetBrains Mono',monospace";
 x.fillStyle = '#080e1b'; x.fillRect(0, 0, Wd, Hd);
 for (let ty = 0; ty < Hd; ty += 40) for (let tx = 0; tx < Wd; tx += 40) { // floor tiles, a few cracked / corrupted
  const k = bootRand(tx * .13 + ty * 1.7);
  x.fillStyle = k < .5 ? '#0b1322' : '#0d1627'; x.fillRect(tx + 1, ty + 1, 38, 38);
  if (k > .93) { x.fillStyle = 'rgba(40,150,100,.13)'; x.fillRect(tx + 1, ty + 1, 38, 38); }
 }
 x.strokeStyle = 'rgba(52,84,140,.28)'; x.lineWidth = 1;
 for (let i = 0; i <= Wd; i += 40) { x.beginPath(); x.moveTo(i + .5, 0); x.lineTo(i + .5, Hd); x.stroke(); }
 for (let i = 0; i <= Hd; i += 40) { x.beginPath(); x.moveTo(0, i + .5); x.lineTo(Wd, i + .5); x.stroke(); }
 // flank lanes (Squad B): lighter floor, chevrons pointing at the centre, airlock bays at the outer ends
 for (const [lx, dir] of [[22, 1], [Wd - 148, -1]]) {
  x.fillStyle = 'rgba(70,110,170,.09)'; x.fillRect(lx, 70, 126, Hd - 140);
  x.strokeStyle = 'rgba(214,170,70,.38)'; x.lineWidth = 2; x.setLineDash([10, 8]); x.strokeRect(lx + .5, 70.5, 125, Hd - 141); x.setLineDash([]);
  x.strokeStyle = 'rgba(150,185,240,.2)'; x.lineWidth = 2;
  for (let y = 100; y < Hd - 90; y += 46) { const mx = lx + 63; x.beginPath(); x.moveTo(mx - 8 * dir, y - 8); x.lineTo(mx + 6 * dir, y); x.lineTo(mx - 8 * dir, y + 8); x.stroke(); }
 }
 A.z.bays.forEach(([bx, by], i) => {
  x.strokeStyle = 'rgba(160,200,255,.45)'; x.lineWidth = 2; x.beginPath(); x.arc(bx, by, 30, 0, 7); x.stroke();
  x.setLineDash([4, 5]); x.beginPath(); x.arc(bx, by, 20, 0, 7); x.stroke(); x.setLineDash([]);
  x.fillStyle = 'rgba(160,200,255,.4)'; x.font = '700 9px ' + mono; x.textAlign = 'center'; x.fillText('BAY B' + (i + 1), bx, by + 46);
  const left = bx < Wd / 2; x.fillStyle = '#16233d'; x.fillRect(left ? 0 : Wd - 10, by - 26, 10, 52); x.strokeStyle = 'rgba(214,170,70,.6)'; x.lineWidth = 1.5; x.strokeRect(left ? .5 : Wd - 9.5, by - 25.5, 9, 51); // airlock door
 });
 // defensive perimeter (Squad A / PRISM) + central containment chamber
 x.strokeStyle = 'rgba(94,224,208,.2)'; x.lineWidth = 1.6; x.setLineDash([16, 10]); x.beginPath(); x.arc(cx, cy, A.z.rp, 0, 7); x.stroke(); x.setLineDash([]);
 x.fillStyle = 'rgba(94,224,208,.3)'; x.font = '700 9px ' + mono; x.textAlign = 'center'; x.fillText('PERIMETER A', cx, cy - A.z.rp - 6);
 x.fillStyle = '#0a1a22'; x.beginPath(); x.arc(cx, cy, A.z.rc, 0, 7); x.fill();
 x.save(); x.beginPath(); x.arc(cx, cy, A.z.rc + 12, 0, 7); x.arc(cx, cy, A.z.rc, 0, 7, true); x.clip(); // hazard ring
 for (let i = -20; i < 40; i++) { x.fillStyle = i % 2 ? 'rgba(10,10,10,.85)' : 'rgba(160,122,36,.6)'; x.beginPath(); x.moveTo(cx - 140 + i * 14, cy - 140); x.lineTo(cx - 126 + i * 14, cy - 140); x.lineTo(cx + 14 + i * 14, cy + 140); x.lineTo(cx + i * 14, cy + 140); x.fill(); }
 x.restore();
 x.strokeStyle = 'rgba(94,224,208,.28)'; x.lineWidth = 1.4; for (const r of [A.z.rc - 14, A.z.rc * .6, A.z.rc * .28]) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke(); }
 x.beginPath(); for (let i = 0; i < 12; i++) { const a = i * .5236; x.moveTo(cx + Math.cos(a) * A.z.rc * .28, cy + Math.sin(a) * A.z.rc * .28); x.lineTo(cx + Math.cos(a) * (A.z.rc - 14), cy + Math.sin(a) * (A.z.rc - 14)); } x.strokeStyle = 'rgba(94,224,208,.1)'; x.stroke();
 x.fillStyle = 'rgba(94,224,208,.28)'; x.font = '800 11px ' + mono; x.fillText('CONTAINMENT', cx, cy + A.z.rc - 30); x.fillStyle = 'rgba(214,170,70,.4)'; x.font = '700 8px ' + mono; x.fillText('DO NOT FREE', cx, cy + A.z.rc - 18);
 // green error traces (static glow; live layer animates them)
 x.lineCap = 'round'; x.lineJoin = 'round';
 for (const pts of P.traces) { x.strokeStyle = 'rgba(30,110,70,.35)'; x.lineWidth = 3; x.beginPath(); pts.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.stroke(); x.strokeStyle = 'rgba(80,200,130,.28)'; x.lineWidth = 1; x.stroke(); const e = pts[pts.length - 1]; x.fillStyle = 'rgba(80,200,130,.4)'; x.fillRect(e[0] - 3, e[1] - 3, 6, 6); }
 for (let i = 0; i < 16; i++) { const gx = 60 + bootRand(i + 3) * (Wd - 120), gy = 60 + bootRand(i + 9) * (Hd - 120); x.fillStyle = 'rgba(60,170,110,.12)'; x.fillRect(gx, gy, 14 + bootRand(i) * 40, 4 + bootRand(i + 1) * 6); } // glitch blocks
 // back wall (top): whiteboard + title + monitor array housing, cable trays along the bottom
 x.fillStyle = '#0f1930'; x.fillRect(0, 0, Wd, 22); x.fillStyle = '#16233d'; x.fillRect(256, 0, 288, 22); x.strokeStyle = 'rgba(143,176,232,.4)'; x.lineWidth = 1; x.strokeRect(256.5, .5, 287, 21);
 x.fillStyle = 'rgba(150,185,240,.5)'; x.font = '700 8px ' + mono; x.textAlign = 'left'; x.fillText('HOST RESEARCH WING // MEMORY DIVISION', 8, 14); x.textAlign = 'right'; x.fillText('TRIAL 07: RETENTION UNDER LOAD', Wd - 8, 14);
 x.fillStyle = '#c9d4ea'; x.fillRect(242, 40, 0, 0); // (whiteboard drawn on the left lane wall below)
 x.fillStyle = 'rgba(214,224,240,.14)'; x.fillRect(176, 28, 96, 36); x.strokeStyle = 'rgba(214,224,240,.35)'; x.strokeRect(176.5, 28.5, 95, 35); // whiteboard
 x.fillStyle = 'rgba(214,224,240,.55)'; x.font = '600 7px ' + mono; x.textAlign = 'left'; x.fillText('alloc(HOST) ok', 181, 40); x.fillText('free(HOST) ???', 181, 49); x.fillStyle = 'rgba(255,110,110,.7)'; x.fillText('LEAK != 0  !!', 181, 59);
 x.fillStyle = '#0f1930'; x.fillRect(0, Hd - 14, Wd, 14); x.fillStyle = 'rgba(214,170,70,.25)'; for (let i = 0; i < Wd; i += 22) x.fillRect(i, Hd - 9, 12, 4);
 // specimen vats: Hosts in stasis along the lanes (one has cracked, leaking green)
 const vats = [[44, 215, '$', 0], [44, 285, '>', 1], [Wd - 44, 215, '#', 0], [Wd - 44, 285, '&', 0]];
 for (const [vx, vy, gl, bad] of vats) {
  x.fillStyle = 'rgba(0,0,0,.4)'; x.beginPath(); x.arc(vx + 3, vy + 4, 17, 0, 7); x.fill();
  x.fillStyle = '#1a2640'; x.beginPath(); x.arc(vx, vy, 17, 0, 7); x.fill(); x.strokeStyle = 'rgba(160,200,255,.6)'; x.lineWidth = 2; x.stroke();
  x.fillStyle = bad ? 'rgba(60,200,110,.35)' : 'rgba(80,180,230,.3)'; x.beginPath(); x.arc(vx, vy, 13, 0, 7); x.fill();
  x.fillStyle = bad ? 'rgba(180,255,200,.8)' : 'rgba(200,235,255,.75)'; x.font = '800 14px ' + mono; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(gl, vx, vy + 1); x.textBaseline = 'alphabetic';
  if (bad) { x.strokeStyle = 'rgba(200,255,220,.8)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(vx - 9, vy - 12); x.lineTo(vx - 2, vy - 2); x.lineTo(vx - 8, vy + 4); x.lineTo(vx + 1, vy + 14); x.stroke(); x.fillStyle = 'rgba(60,200,110,.25)'; x.beginPath(); x.ellipse(vx + 6, vy + 24, 20, 7, 0, 0, 7); x.fill(); }
 }
 // equipment (the walls)
 A.w.forEach((w, n) => {
  const [wx, wy, ww, wh] = w; x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(wx + 4, wy + 5, ww, wh);
  if (n < 2) { // server racks
   x.fillStyle = '#1b2840'; x.fillRect(wx, wy, ww, wh); x.strokeStyle = '#7f9ed0'; x.lineWidth = 2; x.strokeRect(wx + 1, wy + 1, ww - 2, wh - 2);
   for (let c = 0; c < 8; c++) { x.fillStyle = '#0c1424'; x.fillRect(wx + 5 + c * 19, wy + 4, 16, wh - 8); x.strokeStyle = 'rgba(127,158,208,.5)'; x.lineWidth = 1; x.strokeRect(wx + 5.5 + c * 19, wy + 4.5, 15, wh - 9); }
   x.fillStyle = 'rgba(200,220,255,.6)'; x.font = '800 8px ' + mono; x.textAlign = 'left'; x.fillText(n ? 'SRV-B' : 'SRV-A', wx + 4, wy + wh + 11);
  } else if (n < 4) { // workstation desks
   x.fillStyle = '#243553'; x.fillRect(wx, wy, ww, wh); x.strokeStyle = '#8fb0e8'; x.lineWidth = 2; x.strokeRect(wx + 1, wy + 1, ww - 2, wh - 2);
   for (let i = 0; i < 4; i++) { x.fillStyle = '#0c1424'; x.fillRect(wx + 12 + i * 40, wy + 5, 28, 16); x.fillStyle = '#34486e'; x.fillRect(wx + 14 + i * 40, wy + 24, 24, 6); }
   x.fillStyle = 'rgba(200,220,255,.6)'; x.font = '800 8px ' + mono; x.textAlign = 'left'; x.fillText('WKST-' + (n - 1), wx + 4, wy - 4);
  } else if (n < 6) { // centrifuge / analysis machine
   x.fillStyle = '#1d2c48'; x.fillRect(wx, wy, ww, wh); x.strokeStyle = '#8fb0e8'; x.lineWidth = 2; x.strokeRect(wx + 1, wy + 1, ww - 2, wh - 2);
   x.fillStyle = '#0c1424'; x.beginPath(); x.arc(wx + ww / 2, wy + wh * .62, 15, 0, 7); x.fill(); x.strokeStyle = 'rgba(143,176,232,.7)'; x.lineWidth = 1.5; x.stroke();
   for (let i = 0; i < 6; i++) { const a = i * 1.047; x.fillStyle = 'rgba(143,176,232,.6)'; x.fillRect(wx + ww / 2 + Math.cos(a) * 9 - 1.5, wy + wh * .62 + Math.sin(a) * 9 - 1.5, 3, 3); }
   x.fillStyle = 'rgba(200,220,255,.55)'; x.font = '700 7px ' + mono; x.textAlign = 'center'; x.fillText('SPIN', wx + ww / 2, wy + wh - 5);
  } else { // containment pylons
   x.fillStyle = '#1d2c48'; x.fillRect(wx, wy, ww, wh); x.strokeStyle = '#8fb0e8'; x.lineWidth = 2; x.strokeRect(wx + 1, wy + 1, ww - 2, wh - 2);
   x.fillStyle = 'rgba(94,224,208,.55)'; x.fillRect(wx + 8, wy + 8, ww - 16, wh - 16); x.fillStyle = 'rgba(214,170,70,.7)'; x.fillRect(wx + 3, wy + 3, 4, 4); x.fillRect(wx + ww - 7, wy + wh - 7, 4, 4);
  }
 });
 x.textAlign = 'left';
 const g = x.createRadialGradient(Wd / 2, Hd / 2, 200, Wd / 2, Hd / 2, 520); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.42)'); x.fillStyle = g; x.fillRect(0, 0, Wd, Hd);
}
// Live layer, drawn every frame under the entities: flickering screens, blinking server LEDs, crawling error traces, unstable lighting.
export function drawLabLive(x, A, t) {
 const P = labProps(A), [cx, cy] = A.z.c, q = Math.floor(t * 7);
 P.mons.forEach((m, i) => {
  const k = bootRand(i * 3.1 + q * .37), dead = bootRand(i * 9.7) > .82; // some screens are permanently dead / fried
  if (dead) { x.fillStyle = '#05080f'; x.fillRect(m.x + 1, m.y + 1, m.w - 2, m.h - 2); if (k > .5) { x.strokeStyle = 'rgba(80,200,130,.55)'; x.lineWidth = 1; x.beginPath(); x.moveTo(m.x + 3, m.y + 3); x.lineTo(m.x + m.w - 3, m.y + m.h - 3); x.moveTo(m.x + m.w - 3, m.y + 3); x.lineTo(m.x + 3, m.y + m.h - 3); x.stroke(); } return; }
  if (k < .12) return; // blank frame (flicker)
  const err = k > .86;
  x.fillStyle = err ? 'rgba(210,60,70,.55)' : 'rgba(40,150,170,.5)'; x.fillRect(m.x + 1, m.y + 1, m.w - 2, m.h - 2);
  x.fillStyle = err ? 'rgba(255,200,200,.85)' : 'rgba(180,255,235,.75)';
  for (let r = 0; r < Math.max(2, (m.h / 4) | 0); r++) { const w2 = 3 + bootRand(i + r * 5 + Math.floor(t * 2 + r)) * (m.w - 8); x.fillRect(m.x + 3, m.y + 3 + r * 4, Math.min(w2, m.w - 6), 1.6); }
 });
 for (let i = 0; i < P.leds.length; i++) { const [lx, ly] = P.leds[i], k = bootRand(i * 1.9 + Math.floor(t * (2 + i % 3))); x.fillStyle = k > .8 ? 'rgba(255,170,60,.9)' : k > .3 ? 'rgba(80,235,140,.85)' : 'rgba(20,40,30,.7)'; x.fillRect(lx, ly, 4, 3); }
 x.save(); x.lineCap = 'round'; x.strokeStyle = 'rgba(120,255,170,.55)'; x.lineWidth = 1.4; x.setLineDash([6, 22]); x.lineDashOffset = -t * 40; // data pulses crawling along the green traces
 for (const pts of P.traces) { x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); }
 x.restore();
 // lighting: occasional brown-out and a sick green pulse from the containment chamber
 const strobe = bootRand(Math.floor(t * 3) * 1.7) > .93 ? .3 : 0, flick = (Math.sin(t * 31) * Math.sin(t * 7.3) > .85 ? .12 : 0) + strobe;
 if (flick) { x.fillStyle = 'rgba(0,0,6,' + flick + ')'; x.fillRect(0, 0, A.W, A.H); }
 x.save(); x.globalCompositeOperation = 'lighter'; const gp = .035 + .025 * Math.sin(t * 2.2) + (bootRand(Math.floor(t * 9)) > .9 ? .03 : 0);
 const g = x.createRadialGradient(cx, cy, 10, cx, cy, A.z.rp + 40); g.addColorStop(0, 'rgba(60,255,140,' + gp * 1.6 + ')'); g.addColorStop(1, 'rgba(60,255,140,0)'); x.fillStyle = g; x.fillRect(cx - A.z.rp - 40, cy - A.z.rp - 40, (A.z.rp + 40) * 2, (A.z.rp + 40) * 2); x.restore();
 const gy = (t * 90) % (A.H + 80) - 40; if (bootRand(Math.floor(t * 2.5)) > .8) { x.fillStyle = 'rgba(80,255,160,.06)'; x.fillRect(0, gy, A.W, 6); } // rolling glitch band
}
export function drawBG(x, col, A, world) {
 if (A.z) { drawLabSector(x, A); return; }
 if (world && world.key === 'boot') { drawBootSector(x, A); return; }
 if (A.th) { drawThemed(x, A, world); return; } // themed sector rooms from the complete sector branch
 const g = x.createLinearGradient(0, 0, 0, H);
 g.addColorStop(0, world.c[0]);
 g.addColorStop(1, world.c[1]);
 x.fillStyle = g;
 x.globalAlpha = .22;
 x.fillRect(0, 0, W, H);
 x.globalAlpha = 1;

 x.strokeStyle = world.c[1];
 x.globalAlpha = .2;
 x.lineWidth = 1;
 for (let i = 0; i <= W; i += 40) {
  x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke();
 }
 for (let i = 0; i <= H; i += 40) {
  x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke();
 }
 x.globalAlpha = 1;

 for (const z of A.hz) {
  x.fillStyle = z[4] === 'lava' ? 'rgba(255,60,90,.3)' : 'rgba(70,160,255,.22)';
  x.fillRect(z[0], z[1], z[2], z[3]);
 }
 for (const w of A.w) {
  x.fillStyle = world.c[1];
  x.globalAlpha = .5;
  x.fillRect(w[0], w[1], w[2], w[3]);
  x.globalAlpha = 1;
  x.strokeStyle = world.c[0];
  x.lineWidth = 2;
  x.strokeRect(w[0], w[1], w[2], w[3]);
 }
}
