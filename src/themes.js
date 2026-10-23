// ===== Sector visual themes for rooms. Everything here is drawn ONCE per round onto the background canvas (cheap), except relay nodes. =====
// Readability rule: floor decoration stays faint (alpha <= .18) so the player, bosses, projectiles and telegraphs always stand out.
import { W, H } from './constants.js';

const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rngOf = s => { let a = hash(s) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const MONO = "'JetBrains Mono',monospace";
const hex = (r, n = 4) => Math.floor(r() * 65536).toString(16).toUpperCase().padStart(n, '0');

function wash(x, world, a = .22) {
 const g = x.createLinearGradient(0, 0, 0, H);
 g.addColorStop(0, world.c[0]); g.addColorStop(1, world.c[1]);
 x.globalAlpha = a; x.fillStyle = g; x.fillRect(0, 0, W, H); x.globalAlpha = 1;
}
function grid(x, col, a, step = 40) {
 x.strokeStyle = col; x.globalAlpha = a; x.lineWidth = 1;
 x.beginPath();
 for (let i = 0; i <= W; i += step) { x.moveTo(i + .5, 0); x.lineTo(i + .5, H); }
 for (let i = 0; i <= H; i += step) { x.moveTo(0, i + .5); x.lineTo(W, i + .5); }
 x.stroke(); x.globalAlpha = 1;
}
function hatch(x, r, col, a, gap = 8) {
 x.save(); x.beginPath(); x.rect(r[0], r[1], r[2], r[3]); x.clip();
 x.strokeStyle = col; x.globalAlpha = a; x.lineWidth = 1; x.beginPath();
 for (let i = -r[3]; i < r[2]; i += gap) { x.moveTo(r[0] + i, r[1] + r[3]); x.lineTo(r[0] + i + r[3], r[1]); }
 x.stroke(); x.restore();
}
function box(x, r, fill, fa, stroke, lw = 2) {
 x.globalAlpha = fa; x.fillStyle = fill; x.fillRect(r[0], r[1], r[2], r[3]); x.globalAlpha = 1;
 x.strokeStyle = stroke; x.lineWidth = lw; x.strokeRect(r[0] + lw / 2, r[1] + lw / 2, r[2] - lw, r[3] - lw);
}
function label(x, s, px, py, col, a = .5, size = 8, al = 'left') {
 x.save(); x.font = `700 ${size}px ${MONO}`; x.textAlign = al; x.textBaseline = 'middle'; x.fillStyle = col; x.globalAlpha = a; x.fillText(s, px, py); x.restore();
}
function cracks(x, r, n, col, a, len = 40) {
 x.strokeStyle = col; x.globalAlpha = a; x.lineWidth = 1;
 for (let i = 0; i < n; i++) {
  let px = r() * W, py = r() * H, an = r() * 6.28;
  x.beginPath(); x.moveTo(px, py);
  for (let k = 0; k < 4; k++) { an += (r() - .5) * 1.2; px += Math.cos(an) * len * (.4 + r() * .6); py += Math.sin(an) * len * (.4 + r() * .6); x.lineTo(px, py); }
  x.stroke();
 }
 x.globalAlpha = 1;
}

// ---------- shared props (never solid) ----------
const PROPS = {
 lamp(x, [px, py], th) { x.globalAlpha = .25; x.fillStyle = th.acc; x.beginPath(); x.arc(px, py, 9, 0, 7); x.fill(); x.globalAlpha = .7; x.beginPath(); x.arc(px, py, 3, 0, 7); x.fill(); x.globalAlpha = 1; },
 rack(x, [px, py, w, h], th) { box(x, [px, py, w, h], '#0a1018', .8, th.acc, 1.5); for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? th.acc : th.warn; x.globalAlpha = .7; x.fillRect(px + 4, py + 4 + i * (h - 8) / 4, 6, 3); } x.globalAlpha = 1; },
 term(x, [px, py], th) { box(x, [px - 12, py - 7, 24, 14], '#06141c', .85, th.acc, 1.5); x.globalAlpha = .45; x.fillStyle = th.acc; x.fillRect(px - 9, py - 4, 18, 3); x.fillRect(px - 9, py + 1, 11, 2); x.globalAlpha = 1; },
 plant(x, [px, py]) { x.globalAlpha = .35; x.fillStyle = '#7ad89a'; x.beginPath(); x.arc(px, py, 14, 0, 7); x.fill(); x.globalAlpha = .6; x.strokeStyle = '#e8fff0'; x.lineWidth = 1.5; x.beginPath(); x.arc(px, py, 14, 0, 7); x.stroke(); x.globalAlpha = 1; },
 pipe(x, [x1, y1, x2, y2], th) { x.strokeStyle = th.acc; x.globalAlpha = .22; x.lineWidth = 6; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke(); x.globalAlpha = .35; x.lineWidth = 1; x.stroke(); x.globalAlpha = 1; },
 link(x, [x1, y1, x2, y2], th) { x.strokeStyle = th.acc; x.globalAlpha = .4; x.lineWidth = 2; x.setLineDash([6, 4]); x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke(); x.setLineDash([]); x.globalAlpha = 1; },
 crack(x, [px, py, len], th) { x.strokeStyle = '#ffffff'; x.globalAlpha = .55; x.lineWidth = 1.2; x.beginPath(); x.moveTo(px - len, py - len * .3); x.lineTo(px - len * .3, py + len * .1); x.lineTo(px + len * .1, py - len * .2); x.lineTo(px + len, py + len * .4); x.stroke(); x.strokeStyle = th.acc; x.globalAlpha = .35; x.stroke(); x.globalAlpha = 1; },
 sign(x, [px, py, s], th) { label(x, s, px, py, th.acc, .55, 8, 'center'); },
 stripe(x, [px, py, w, h], th) { x.save(); x.beginPath(); x.rect(px, py, w, h); x.clip(); x.fillStyle = th.warn; x.globalAlpha = .55; for (let i = -h; i < w; i += 16) { x.beginPath(); x.moveTo(px + i, py + h); x.lineTo(px + i + 8, py + h); x.lineTo(px + i + 8 + h, py); x.lineTo(px + i + h, py); x.fill(); } x.restore(); },
 cam(x, [px, py], th) { x.fillStyle = '#0c1620'; x.strokeStyle = th.acc; x.lineWidth = 1.5; x.beginPath(); x.rect(px - 9, py - 4, 18, 8); x.fill(); x.stroke(); x.fillStyle = th.warn; x.globalAlpha = .9; x.beginPath(); x.arc(px, py + 8, 2, 0, 7); x.fill(); x.globalAlpha = 1; },
 pod(x, [px, py], th) { x.globalAlpha = .18; x.fillStyle = th.acc; x.beginPath(); x.ellipse(px, py + 60, 30, 14, 0, 0, 7); x.fill(); x.globalAlpha = .5; x.strokeStyle = th.acc; x.lineWidth = 1.5; x.beginPath(); x.ellipse(px, py + 60, 30, 14, 0, 0, 7); x.stroke(); x.globalAlpha = 1; },
 vent(x, [px, py], th) { box(x, [px - 14, py - 10, 28, 20], '#120a06', .8, th.acc, 1.5); x.strokeStyle = th.warn; x.globalAlpha = .6; x.lineWidth = 1.5; for (let i = -6; i <= 6; i += 4) { x.beginPath(); x.moveTo(px + i, py - 6); x.lineTo(px + i, py + 6); x.stroke(); } x.globalAlpha = 1; },
 chain(x, [x1, y1, x2, y2], th) { const n = Math.max(2, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 12)); x.strokeStyle = th.acc; x.lineWidth = 2; x.globalAlpha = .5; for (let i = 0; i < n; i++) { const t = (i + .5) / n; x.beginPath(); x.ellipse(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 5, 3, Math.atan2(y2 - y1, x2 - x1) + (i % 2 ? 1.57 : 0), 0, 7); x.stroke(); } x.globalAlpha = 1; }
};

// ---------- THE HEAP: memory under stress ----------
function floorCitadel(x, A, wd, r) {
 // CITADEL 403: armoured deck plating. The keep is cool and dark, the launch bay is hot-lit with guide rails and painted chevrons pointing at the bulkhead.
 wash(x, wd, .16);
 const bayX = 718;
 for (let gy = 0; gy < H; gy += 40) for (let gx = 0; gx < W; gx += 40) {
  const bay = gx >= bayX - 2, k = r();
  x.globalAlpha = bay ? .24 : .1 + k * .05; x.fillStyle = bay ? '#2a0c0e' : '#14201a'; x.fillRect(gx + 1, gy + 1, 38, 38);
  x.globalAlpha = .2; x.strokeStyle = bay ? '#ff6a4a' : wd.c[0]; x.lineWidth = 1; x.strokeRect(gx + .5, gy + .5, 40, 40);
  if (k > .93) { x.globalAlpha = .1; x.fillStyle = '#ff5c7a'; x.fillRect(gx + 4, gy + 4, 32, 32); }
  x.globalAlpha = .3; x.fillStyle = bay ? '#ffb39a' : wd.c[0];
  x.fillRect(gx + 3, gy + 3, 2, 2); x.fillRect(gx + 35, gy + 3, 2, 2); x.fillRect(gx + 3, gy + 35, 2, 2); x.fillRect(gx + 35, gy + 35, 2, 2);
 }
 x.globalAlpha = 1;
 // Sentinel sigil in the middle of the keep
 const cx = 360, cy = 280;
 x.strokeStyle = '#ff5c7a'; x.lineWidth = 2; x.globalAlpha = .14;
 for (const rr of [54, 86]) { x.beginPath(); x.arc(cx, cy, rr, 0, 7); x.stroke(); }
 x.setLineDash([6, 8]); x.beginPath(); x.arc(cx, cy, 120, 0, 7); x.stroke(); x.setLineDash([]);
 x.beginPath(); x.moveTo(cx - 140, cy); x.lineTo(cx + 140, cy); x.moveTo(cx, cy - 140); x.lineTo(cx, cy + 140); x.stroke();
 label(x, 'CITADEL 403', cx, cy + 5, '#ff8793', .22, 14, 'center');
 // Launch bay: guide rails, chevrons pointing at the bulkhead, thruster pad
 x.globalAlpha = .3; x.strokeStyle = '#ffb39a'; x.lineWidth = 2;
 x.beginPath(); x.moveTo(730, 250); x.lineTo(930, 250); x.moveTo(730, 310); x.lineTo(930, 310); x.stroke();
 x.globalAlpha = .38; x.strokeStyle = '#ff8a3c'; x.lineWidth = 3;
 for (let cxv = 740; cxv < 840; cxv += 36) { x.beginPath(); x.moveTo(cxv + 10, 266); x.lineTo(cxv, 280); x.lineTo(cxv + 10, 294); x.stroke(); }
 x.globalAlpha = .4; x.beginPath(); x.arc(862, 280, 30, 0, 7); x.stroke(); x.globalAlpha = .2; x.setLineDash([4, 5]); x.beginPath(); x.arc(862, 280, 42, 0, 7); x.stroke(); x.setLineDash([]);
 label(x, 'PAD 03', 862, 340, '#ffb39a', .32, 9, 'center');
 x.globalAlpha = 1;
 cracks(x, r, 12, '#07090a', .5, 46);
}
function floorHeap(x, A, wd, r) {
 if (A.st === 'boss') return floorCitadel(x, A, wd, r);
 wash(x, wd, .2);
 const rows = 10;
 for (let row = 0; row < rows; row++) {
  const y = row * 40 + 13;
  label(x, '0x' + hex(r) + '0', 4, y + 7, wd.c[0], .16, 7);
  let px = 46;
  while (px < W - 8) {
   const w = 16 + Math.floor(r() * 70), k = r();
   if (px + w > W - 6) break;
   if (k < .5) { x.globalAlpha = .08; x.fillStyle = wd.c[0]; x.fillRect(px, y, w, 14); x.globalAlpha = .18; x.strokeStyle = wd.c[0]; x.lineWidth = 1; x.strokeRect(px + .5, y + .5, w - 1, 13); }
   else if (k < .64) { x.globalAlpha = .12; x.fillStyle = '#ff8a3c'; x.fillRect(px, y, w, 14); x.globalAlpha = .26; x.strokeStyle = '#ff8a3c'; x.setLineDash([3, 3]); x.strokeRect(px + .5, y + .5, w - 1, 13); x.setLineDash([]); }
   else { x.globalAlpha = .08; x.strokeStyle = wd.c[1]; x.strokeRect(px + .5, y + .5, w - 1, 13); }
   px += w + 4 + Math.floor(r() * 18);
  }
 }
 x.globalAlpha = 1;
 cracks(x, r, A.st === 'frag' ? 14 : 9, '#0a0f08', .5, 46);
 for (let i = 0; i < 26; i++) { x.globalAlpha = .45; x.fillStyle = r() < .5 ? '#ffb84a' : wd.c[0]; x.fillRect(Math.floor(r() * W), Math.floor(r() * H), 2, 2); }
 x.globalAlpha = 1;
}
function wallHeap(x, w, wd, r) {
 box(x, w, '#10200e', .86, wd.c[0], 2);
 hatch(x, w, wd.c[1], .35, 7);
 if (w[2] >= 54 && w[3] >= 22) label(x, '0x' + hex(r), w[0] + w[2] / 2, w[1] + w[3] / 2, wd.c[0], .55, 8, 'center');
}
function hzHeap(x, z, r) {
 if (z[4] === 'lava') {
  x.globalAlpha = .38; x.fillStyle = '#ff3c78'; x.fillRect(z[0], z[1], z[2], z[3]);
  x.globalAlpha = .22; x.fillStyle = '#1a0010'; for (let yy = z[1]; yy < z[1] + z[3]; yy += 6) x.fillRect(z[0], yy, z[2], 2);
  x.globalAlpha = .6; x.strokeStyle = '#ff8ab0'; x.lineWidth = 1; x.setLineDash([4, 3]); x.strokeRect(z[0] + .5, z[1] + .5, z[2] - 1, z[3] - 1); x.setLineDash([]);
  x.globalAlpha = 1;
 } else { x.fillStyle = 'rgba(70,160,255,.22)'; x.fillRect(z[0], z[1], z[2], z[3]); }
}

// ---------- /dev/null: erased, unstable system space ----------
function floorNull(x, A, wd, r) {
 wash(x, wd, .2); grid(x, wd.c[1], .22);
 // erased tiles: the floor simply isn't there (faint, so they never read as walls or hazards)
 for (let i = 0; i < 26; i++) {
  const gx = Math.floor(r() * 16) * 40, gy = Math.floor(r() * 10) * 40;
  x.globalAlpha = .5; x.fillStyle = '#05030c'; x.fillRect(gx, gy, 40, 40);
  x.globalAlpha = .18; x.strokeStyle = wd.c[0]; x.setLineDash([2, 4]); x.strokeRect(gx + .5, gy + .5, 39, 39); x.setLineDash([]);
 }
 // glitch slices
 for (let i = 0; i < 9; i++) { const gy = Math.floor(r() * H), gh = 2 + Math.floor(r() * 5), gx = Math.floor(r() * W * .6), gw = 40 + r() * 160; x.globalAlpha = .12; x.fillStyle = r() < .5 ? '#40f0ff' : '#ff4ad0'; x.fillRect(gx, gy, gw, gh); }
 // ragged void edges
 x.fillStyle = '#05030c'; x.globalAlpha = .55;
 for (let i = 0; i < W; i += 14) { const h = 3 + r() * 10; x.fillRect(i, 0, 14, h); x.fillRect(i, H - h, 14, h); }
 for (let i = 0; i < H; i += 14) { const w2 = 3 + r() * 10; x.fillRect(0, i, w2, 14); x.fillRect(W - w2, i, w2, 14); }
 x.globalAlpha = 1;
 for (let i = 0; i < 14; i++) label(x, r() < .5 ? 'NULL' : '0x00', Math.floor(r() * W), Math.floor(r() * H), wd.c[0], .12, 7);
 if (A.st === 'grid') { // Grid Lock: heavier lattice and lock nodes at the crossings
  grid(x, wd.c[0], .12, 80);
  for (let gx = 80; gx < W; gx += 80) for (let gy = 80; gy < H; gy += 80) { x.globalAlpha = .3; x.fillStyle = wd.c[0]; x.fillRect(gx - 2, gy - 2, 4, 4); }
  x.globalAlpha = 1;
 }
}
function wallNull(x, w, wd) {
 x.globalAlpha = .9; x.fillStyle = '#0b0618'; x.fillRect(w[0], w[1], w[2], w[3]); x.globalAlpha = 1;
 x.strokeStyle = '#40f0ff'; x.globalAlpha = .45; x.lineWidth = 1.5; x.strokeRect(w[0] - 1.5, w[1] + 1.5, w[2], w[3]);
 x.strokeStyle = '#ff4ad0'; x.strokeRect(w[0] + 2, w[1] - 1.5, w[2], w[3]); x.globalAlpha = 1;
 x.strokeStyle = wd.c[0]; x.lineWidth = 2; x.strokeRect(w[0] + 1, w[1] + 1, w[2] - 2, w[3] - 2);
}
function hzNull(x, z, wd) {
 if (z[4] === 'lava') { // a hole in the system: erased space, dead dark with a violet rim
  x.globalAlpha = .88; x.fillStyle = '#020108'; x.fillRect(z[0], z[1], z[2], z[3]);
  x.globalAlpha = .5; x.fillStyle = wd.c[1]; for (let yy = z[1] + 3; yy < z[1] + z[3]; yy += 8) x.fillRect(z[0] + 2, yy, z[2] - 4, 1);
  x.globalAlpha = .9; x.strokeStyle = '#ff4ad0'; x.lineWidth = 1.5; x.setLineDash([5, 3]); x.strokeRect(z[0] + .5, z[1] + .5, z[2] - 1, z[3] - 1); x.setLineDash([]); x.globalAlpha = 1;
 } else { x.fillStyle = 'rgba(70,160,255,.22)'; x.fillRect(z[0], z[1], z[2], z[3]); }
}

// ---------- NEXUS COMPLEX: a clean, legitimate research campus ----------
function floorNexus(x, A, wd, r) {
 x.globalAlpha = .42; x.fillStyle = '#d4e2ee'; x.fillRect(0, 0, W, H);
 const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,210,255,.35)');
 x.globalAlpha = .28; x.fillStyle = g; x.fillRect(0, 0, W, H); x.globalAlpha = 1;
 grid(x, '#ffffff', .3, 40); grid(x, '#3fa9d6', .12, 80);
 // polished-floor reflection streaks
 for (let i = 0; i < 5; i++) { const px = 40 + r() * (W - 80); x.globalAlpha = .08; x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(px, 0); x.lineTo(px + 26, 0); x.lineTo(px - 60, H); x.lineTo(px - 86, H); x.fill(); }
 x.globalAlpha = 1;
 // cyan accent strips and room-specific floor markings
 x.fillStyle = '#3fd0f0'; x.globalAlpha = .55; x.fillRect(0, 0, W, 3); x.fillRect(0, H - 3, W, 3); x.globalAlpha = 1;
 if (A.st === 'campus') { x.strokeStyle = '#3fa9d6'; x.globalAlpha = .3; x.lineWidth = 2; x.setLineDash([10, 8]); x.beginPath(); x.arc(320, 200, 120, 0, 7); x.stroke(); x.setLineDash([]); x.globalAlpha = 1; }
 if (A.st === 'lab') for (let i = 0; i < 3; i++) label(x, 'LAB 0' + (i + 1), 120 + i * 160, 150, '#2a6f8f', .4, 9);
 if (A.st === 'ward') { x.strokeStyle = '#ff9a3c'; x.globalAlpha = .4; x.lineWidth = 2; x.strokeRect(24, 24, W - 48, H - 48); x.globalAlpha = 1; for (const [px, py] of [[110, 108], [530, 108], [110, 292], [530, 292]]) label(x, 'CELL', px, py, '#8a5a2a', .5, 8, 'center'); }
 if (A.st === 'wing') { x.strokeStyle = '#ff4d5a'; x.globalAlpha = .25; x.lineWidth = 2; x.beginPath(); x.moveTo(114, 200); x.lineTo(526, 200); x.stroke(); x.globalAlpha = 1; }
 if (A.st === 'boss') { // two rings that don't quite become one, red and blue
  x.lineWidth = 3; x.globalAlpha = .28; x.strokeStyle = '#ff4d5a'; x.beginPath(); x.arc(290, 200, 100, 0, 7); x.stroke(); x.strokeStyle = '#4d8dff'; x.beginPath(); x.arc(350, 200, 100, 0, 7); x.stroke(); x.globalAlpha = 1;
  label(x, 'A', 232, 200, '#ff4d5a', .5, 12, 'center'); label(x, 'B', 408, 200, '#4d8dff', .5, 12, 'center');
  for (const [a, b] of [[114, 160], [114, 240]]) { x.strokeStyle = '#3fa9d6'; x.globalAlpha = .4; x.lineWidth = 3; x.beginPath(); x.moveTo(a, b); x.lineTo(250, 200); x.stroke(); }
  for (const [a, b] of [[526, 160], [526, 240]]) { x.strokeStyle = '#3fa9d6'; x.globalAlpha = .4; x.lineWidth = 3; x.beginPath(); x.moveTo(a, b); x.lineTo(390, 200); x.stroke(); }
  x.globalAlpha = 1;
 }
}
function wallNexus(x, w, wd, r, A) {
 const warm = A.st === 'ward' || A.st === 'wing' || A.st === 'boss';
 x.globalAlpha = .55; x.fillStyle = '#7fd8ff'; x.fillRect(w[0], w[1], w[2], w[3]);
 const g = x.createLinearGradient(w[0], w[1], w[0] + w[2], w[1] + w[3]); g.addColorStop(0, 'rgba(255,255,255,.7)'); g.addColorStop(.5, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(255,255,255,.4)');
 x.globalAlpha = .6; x.fillStyle = g; x.fillRect(w[0], w[1], w[2], w[3]); x.globalAlpha = 1;
 x.strokeStyle = warm ? '#ffffff' : '#ffffff'; x.lineWidth = 2; x.strokeRect(w[0] + 1, w[1] + 1, w[2] - 2, w[3] - 2);
 x.strokeStyle = warm ? '#ff9a3c' : '#2fb8e8'; x.lineWidth = 1; x.strokeRect(w[0] + 4, w[1] + 4, w[2] - 8, w[3] - 8);
}
function hzNexus(x, z) {
 if (z[4] === 'lava') { x.globalAlpha = .4; x.fillStyle = '#ff4d5a'; x.fillRect(z[0], z[1], z[2], z[3]); x.globalAlpha = 1; }
 else { x.globalAlpha = .3; x.fillStyle = '#4aa8ff'; x.fillRect(z[0], z[1], z[2], z[3]); x.globalAlpha = .55; x.strokeStyle = '#3fd0f0'; x.setLineDash([6, 4]); x.strokeRect(z[0] + .5, z[1] + .5, z[2] - 1, z[3] - 1); x.setLineDash([]); x.globalAlpha = 1; }
}

// ---------- KERNEL: ring 0, privileged hardware, heat ----------
function floorKernel(x, A, wd, r) {
 wash(x, wd, .16);
 x.fillStyle = '#0c0604'; x.globalAlpha = .45; x.fillRect(0, 0, W, H); x.globalAlpha = 1;
 // concentric privilege rings + spokes
 x.strokeStyle = wd.c[0]; x.lineWidth = 1.5;
 for (let i = 1; i <= 4; i++) { x.globalAlpha = .1 + (A.st === 'ring0' || A.st === 'ring' ? .06 : 0); x.beginPath(); x.arc(320, 200, i * 72, 0, 7); x.stroke(); }
 x.globalAlpha = .08; x.beginPath(); for (let i = 0; i < 12; i++) { const a = i * .5236; x.moveTo(320 + Math.cos(a) * 36, 200 + Math.sin(a) * 36); x.lineTo(320 + Math.cos(a) * 340, 200 + Math.sin(a) * 340); } x.stroke(); x.globalAlpha = 1;
 // circuit traces
 x.strokeStyle = wd.c[1]; x.lineWidth = 1.5; x.globalAlpha = .22;
 for (let i = 0; i < 12; i++) { let px = Math.floor(r() * 16) * 40 + 20, py = Math.floor(r() * 10) * 40 + 20; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 3; k++) { if (r() < .5) px += (r() < .5 ? -1 : 1) * 40 * (1 + Math.floor(r() * 2)); else py += (r() < .5 ? -1 : 1) * 40; x.lineTo(px, py); } x.stroke(); x.fillStyle = wd.c[0]; x.fillRect(px - 2, py - 2, 4, 4); }
 x.globalAlpha = 1;
 grid(x, wd.c[1], .1);
 label(x, 'RING ' + (A.st === 'ring0' || A.st === 'boss' ? '0' : '1'), 320, 392, wd.c[0], .3, 9, 'center');
 x.fillStyle = wd.c[0]; x.globalAlpha = .4; for (let i = 0; i < 10; i++) x.fillRect(Math.floor(r() * W), Math.floor(r() * H), 2, 2); x.globalAlpha = 1;
}
function wallKernel(x, w, wd) {
 box(x, w, '#1a0c06', .92, wd.c[0], 2);
 hatch(x, w, wd.c[1], .5, 9);
 x.strokeStyle = '#ffd24a'; x.globalAlpha = .55; x.lineWidth = 1; x.strokeRect(w[0] + 3.5, w[1] + 3.5, w[2] - 7, w[3] - 7); x.globalAlpha = 1;
}
function hzKernel(x, z) {
 if (z[4] === 'lava') {
  const g = x.createLinearGradient(z[0], z[1], z[0] + z[2], z[1] + z[3]); g.addColorStop(0, '#ff7a1a'); g.addColorStop(1, '#ff2a3a');
  x.globalAlpha = .55; x.fillStyle = g; x.fillRect(z[0], z[1], z[2], z[3]);
  x.globalAlpha = .5; x.fillStyle = '#ffd24a'; for (let k = 0; k < z[2] * z[3] / 700; k++) x.fillRect(z[0] + ((k * 37) % z[2]), z[1] + ((k * 53) % z[3]), 3, 2);
  x.globalAlpha = .8; x.strokeStyle = '#ffb02e'; x.lineWidth = 1.5; x.strokeRect(z[0] + .5, z[1] + .5, z[2] - 1, z[3] - 1); x.globalAlpha = 1;
 } else { x.fillStyle = 'rgba(70,160,255,.22)'; x.fillRect(z[0], z[1], z[2], z[3]); }
}

// ---------- DEADLOCK: everything waiting on everything else; frozen ----------
function floorDeadlock(x, A, wd, r) {
 wash(x, wd, .2);
 x.fillStyle = '#0a1830'; x.globalAlpha = .3; x.fillRect(0, 0, W, H); x.globalAlpha = 1;
 // frost crystals
 for (let i = 0; i < 16; i++) { const cx = r() * W, cy = r() * H, s = 10 + r() * 26; x.globalAlpha = .07; x.fillStyle = '#d8f6ff'; x.beginPath(); for (let k = 0; k < 6; k++) { const a = k * 1.047 + r() * .4; k ? x.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s) : x.moveTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); } x.closePath(); x.fill(); }
 x.globalAlpha = 1; cracks(x, r, 8, '#d8f6ff', .22, 44);
 // circular-wait arrows: A waits on B waits on C waits on A
 x.strokeStyle = wd.c[0]; x.lineWidth = 2; x.globalAlpha = .16;
 const cx = 320, cy = 200, R0 = A.st === 'cycle' ? 62 : 150;
 for (let k = 0; k < 3; k++) { const a0 = k * 2.0944 + .3, a1 = a0 + 1.5; x.beginPath(); x.arc(cx, cy, R0, a0, a1); x.stroke(); const ex = cx + Math.cos(a1) * R0, ey = cy + Math.sin(a1) * R0; x.beginPath(); x.moveTo(ex, ey); x.lineTo(ex + Math.cos(a1 + 1.9) * 9, ey + Math.sin(a1 + 1.9) * 9); x.lineTo(ex + Math.cos(a1 + 1.2) * 9, ey + Math.sin(a1 + 1.2) * 9); x.closePath(); x.fillStyle = wd.c[0]; x.fill(); }
 x.globalAlpha = 1; grid(x, wd.c[1], .12);
 label(x, 'WAITING...', 320, 392, wd.c[0], .3, 9, 'center');
 if (A.st === 'queue') for (let i = 0; i < 4; i++) label(x, 'P' + i, 90 + i * 160, 24, wd.c[0], .4, 9, 'center');
 if (A.st === 'vault' || A.st === 'standoff') { label(x, 'HOLD', 60, 200, wd.c[0], .3, 9, 'center'); label(x, 'WAIT', 580, 200, wd.c[0], .3, 9, 'center'); }
}
function lockGlyph(x, px, py, col) { x.strokeStyle = col; x.lineWidth = 2; x.beginPath(); x.arc(px, py - 3, 4, Math.PI, 0); x.stroke(); x.fillStyle = col; x.fillRect(px - 5, py - 2, 10, 8); }
function wallDeadlock(x, w, wd) {
 box(x, w, '#a8e8ff', .3, '#e8fbff', 2);
 hatch(x, w, '#ffffff', .25, 6);
 x.globalAlpha = .8; if (w[2] >= 20 && w[3] >= 20) lockGlyph(x, w[0] + w[2] / 2, w[1] + w[3] / 2, wd.c[1]); x.globalAlpha = 1;
}
function hzDeadlock(x, z) {
 if (z[4] === 'lava') { x.globalAlpha = .4; x.fillStyle = '#ff4d5a'; x.fillRect(z[0], z[1], z[2], z[3]); x.globalAlpha = 1; return; }
 x.globalAlpha = .34; x.fillStyle = '#d8f6ff'; x.fillRect(z[0], z[1], z[2], z[3]); // ice
 x.globalAlpha = .5; x.strokeStyle = '#ffffff'; x.setLineDash([5, 4]); x.strokeRect(z[0] + .5, z[1] + .5, z[2] - 1, z[3] - 1); x.setLineDash([]);
 x.globalAlpha = .6; x.fillStyle = '#ffffff'; for (let k = 0; k < z[2] * z[3] / 900; k++) x.fillRect(z[0] + ((k * 41) % z[2]), z[1] + ((k * 59) % z[3]), 2, 2); x.globalAlpha = 1;
}

const THEMES = {
 heap: { floor: floorHeap, wall: wallHeap, hz: hzHeap, acc: '#d4f56a', warn: '#ff8a3c' },
 null: { floor: floorNull, wall: wallNull, hz: hzNull, acc: '#e0b8ff', warn: '#ff4ad0' },
 nexus: { floor: floorNexus, wall: wallNexus, hz: hzNexus, acc: '#2fb8e8', warn: '#ff9a3c' },
 kernel: { floor: floorKernel, wall: wallKernel, hz: hzKernel, acc: '#ffb02e', warn: '#ff4d3a' },
 deadlock: { floor: floorDeadlock, wall: wallDeadlock, hz: hzDeadlock, acc: '#7fe8ff', warn: '#3b6bff' }
};

export function drawThemed(x, A, world) {
 const th = THEMES[A.th], r = rngOf(A.key || A.n);
 th.floor(x, A, world, r);
 for (const z of A.hz) th.hz(x, z, world, r);
 for (const p of A.pr || []) if (PROPS[p[0]]) PROPS[p[0]](x, p.slice(1), th);
 for (const w of A.w) th.wall(x, w, world, r, A);
 // relay nodes get their base plate here; the glowing part is animated in drawNodes()
 for (const n of A.nodes || []) { x.globalAlpha = .55; x.fillStyle = '#0b1408'; x.beginPath(); x.arc(n[0], n[1], 17, 0, 7); x.fill(); x.globalAlpha = .6; x.strokeStyle = world.c[0]; x.lineWidth = 2; x.beginPath(); x.arc(n[0], n[1], 17, 0, 7); x.stroke(); x.globalAlpha = 1; }
}

// Segfault arena relay nodes (animated, non-solid). Dormant for now: the rescue interaction, tethers and activation are future work.
export function drawNodes(x, A, t, col = '#9dff7a') {
 if (!A.nodes) return;
 x.save();
 for (const [i, n] of A.nodes.entries()) {
  const px = n[0], py = n[1], pulse = .5 + .5 * Math.sin(t * 2 + i * 1.1);
  x.globalCompositeOperation = 'lighter';
  x.globalAlpha = .12 + .1 * pulse; x.fillStyle = col; x.beginPath(); x.arc(px, py, 24 + 3 * pulse, 0, 7); x.fill();
  x.globalCompositeOperation = 'source-over';
  x.strokeStyle = col; x.lineWidth = 2; x.globalAlpha = .9;
  for (let k = 0; k < 3; k++) { const a = t * .6 + i + k * 2.094; x.beginPath(); x.arc(px, py, 12, a, a + 1.3); x.stroke(); }
  x.globalAlpha = .65 + .3 * pulse; x.fillStyle = '#e8fff0'; x.beginPath(); x.arc(px, py, 4, 0, 7); x.fill();
  x.globalAlpha = .9; x.fillStyle = col; x.fillRect(px - 1, py - 22, 2, 6); x.fillRect(px - 1, py + 16, 2, 6); x.fillRect(px - 22, py - 1, 6, 2); x.fillRect(px + 16, py - 1, 6, 2);
 }
 x.restore();
}
