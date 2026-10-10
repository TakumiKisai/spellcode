import { W, H } from './constants.js';
import { ARENAS, EN, BOSSES, HOSTS, SPELLS, MODS } from './data.js';
import { cl, ri, pick, okMod } from './helpers.js';
import { snd } from './audio.js';

export function wallHit(arena, x, y, r) {
 for (const w of ARENAS[arena].w) {
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
 const s = SPELLS[c.sp] || { dmg: 0, cd: 1, sp: 200, rad: 5, pierce: 0, k: 'proj' };
 const a = {
  ...s, rep: 1, pc: 1, area: 1, size: 1, sh: 0, home: 0, bounce: 0,
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
 a.cd *= (ST.cd || 1) * (1 - .03 * nm * (ST.compiler || 0));
 if (a.k === 'mine') a.cd = Math.max(a.cd, 1.4);
 a.size *= ST.stack ? 1 + .06 * nm : 1;
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

 return `${c.mods.map((k, i) => `<u>${MODS[k].n}${c.mv && c.mv[i] > 1 ? ' v' + c.mv[i] : ''}</u> > `).join('')}<i>${SPELLS[c.sp].n}</i> // ${a.dmg ? Math.round(a.dmg) + ' dmg, ' : ''}every ${a.cd.toFixed(2)}s${f.length ? ': ' + f.join(', ') : ''}`;
}

export function drawBG(x, col, A, world) {
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
