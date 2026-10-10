import { SPELLS, MODS, DK, UPG, COMPAT, KN, RAR, RC } from './data.js';

export const $ = s => document.querySelector(s);
export const ri = n => Math.random() * n | 0;
export const pick = a => a[ri(a.length)];
export const cl = (v, a, b) => v < a ? a : v > b ? b : v;
export const shuffle = a => {
 for (let i = a.length - 1; i > 0; i--) {
  const j = ri(i + 1);
  [a[i], a[j]] = [a[j], a[i]];
 }
 return a;
};
export const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export let uid = 0;
export const mk = (k, v = 1) => ({ k, id: ++uid, v });
export const defOf = k => SPELLS[k] || MODS[k] || DK[k] || UPG[k] || { n: k, d: '', r: 0 };
export const isMod = k => !!MODS[k];

export const maxV = () => 3;

export const okMod = (m, sp) => !COMPAT[m] || COMPAT[m].includes(SPELLS[sp]?.k);

export const wo = k => {
 const c = COMPAT[k];
 return c ? `<i class="wo">works on: ${c.length >= 8 ? 'all attacks' : c.map(x => KN[x] || x).join(', ')}</i>` : '';
};

export const XT = {
 for: ['casts 3x', 'casts 4x'],
 async: ['cooldown -58%, damage still -15%', 'cooldown -66%, damage still -15%'],
 map: ['5-way spread, penalty stays -25%', '7-way spread, penalty stays -25%'],
 overflow: ['x2.6 damage, cooldown still x1.5', 'x3.2 damage, cooldown still x1.5'],
 try: ['+10 shield per cast', '+15 shield per cast'],
 homing: ['turn rate x2, penalty stays -10%', 'turn rate x3, penalty stays -10%'],
 bounce: ['bounces 6x', 'bounces 9x'],
 pierce: ['+4 pierce, +4 jumps', '+6 pierce, +6 jumps'],
 explode: ['blast +30% radius, 80% damage', 'blast +60% radius, 100% damage'],
 split: ['splits into 3 shots', 'splits into 4 shots'],
 big: ['size x3.6, damage +56%', 'size x6.9, damage +95%'],
 burn: ['burns 80% over 3s', 'burns 120% over 3s'],
 freeze: ['slows 58% for 3.3s', 'slows 68% for 4.4s'],
 knock: ['knockback x2', 'knockback x3'],
 leech: ['heals up to 10% of damage', 'heals up to 15% of damage'],
 pull: ['pull radius +40%', 'pull radius +80%'],
 sudo: ['crits do x3, cooldown penalty stays x1.6', 'crits do x4, cooldown penalty stays x1.6']
};

export function xText(k, L) {
 if (XT[k]) return XT[k][L - 2] || XT[k][1];
 const s = SPELLS[k];
 if (!s) return '';
 const q = 1 + .6 * (L - 1);
 return s.dmg ? `+${Math.round(60 * (L - 1))}% damage (${s.dmg} > ${Math.round(s.dmg * q)}), bigger shots` :
        s.shv ? `shield ${s.shv} > ${Math.round(s.shv * q)}` :
        s.hpv ? `heal ${s.hpv} > ${Math.round(s.hpv * q)}` : '';
}

export function xl(k, v, u, G) {
 if (u || !v) return '';
 const ln = (p, L, c) => {
  const t = xText(k, L);
  return t ? `<i class="xl ${c}">${p}v${L}: ${t}</i>` : '';
 };
 return (v > 1 ? ln('x ', v, '') : '') + (G && G.fm === 'f' && v < maxV(k) ? ln('fuse > ', v + 1, 'pv') : '');
}

export function cardH(k, attr, u, v, cls, G) {
 const d = u ? (UPG[k] || defOf(k)) : defOf(k);
 if (!d) return '';
 const own = u && G && G.u && G.u[k] ? ` (have ${G.u[k]})` : '';
 return `<button class="card ${u ? 'u' : ''} ${cls || ''}" ${attr} style="border-top-color:${RC[d.r] || '#9d92b5'}" title="${d.d || ''}">
   ${v > 1 ? `<span class="v-tag v${v}">v${v}</span>` : ''}
   <em style="color:${RC[d.r] || '#9d92b5'}">${RAR[d.r] || 'COMMON'}</em>
   <b>${d.n || k}${own}</b>
   <small>${d.d || ''}</small>
   ${d.h ? `<i class="syn">// synergy: ${String(d.h).replace(/^\+\s*/, '')}</i>` : ''}
   ${u ? '' : wo(k)}
   ${xl(k, v, u, G)}
 </button>`;
}
