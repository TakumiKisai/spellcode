import { SPELLS } from '../src/data.js';
import { WANDS, wandAccepts, applyWand, bwCost, bwMaxFor, bwRegen, clampBW, BW_CFG, CRYO } from '../src/wands.js';
let fails = 0; const bad = m => { fails++; console.log('FAIL:', m); }, ok = (c, m) => { if (!c) bad(m); };
const mkA = sp => ({ ...SPELLS[sp], rate: SPELLS[sp].rate, rep: 1, pc: 1, area: 1, size: 1, burn: SPELLS[sp].burn || 0, freeze: 0, pierce: SPELLS[sp].pierce || 0, dmg: SPELLS[sp].dmg });
// compatibility
for (const k in SPELLS) ok(wandAccepts('universal', k, SPELLS[k]), 'universal must accept ' + k);
for (const k in SPELLS) ok(wandAccepts('cryomancer', k, SPELLS[k]) === (k === 'stdout' || SPELLS[k].k === 'self'), 'cryomancer compat wrong for ' + k);
ok(wandAccepts('nonexistent', 'bolt', SPELLS.bolt), 'unknown wand id falls back to universal');
// universal leaves stats untouched
const u = applyWand(mkA('bolt'), { sp: 'bolt' }, 'universal', SPELLS.bolt);
ok(!u.blocked && u.dmg === SPELLS.bolt.dmg && !u.wandFx, 'universal must not change bolt');
// cryo transforms stdout
const c = applyWand(mkA('stdout'), { sp: 'stdout' }, 'cryomancer', SPELLS.stdout);
ok(c.wandFx === 'cryo' && c.burn === 0 && c.freeze >= 1 && c.pierce === 99 && c.bw === CRYO.bw, 'cryo transform of stdout');
ok(c.dmg > SPELLS.stdout.dmg, 'cryo specialist should out-damage universal stdout');
// incompatible card is blocked, not transformed
const b = applyWand(mkA('bolt'), { sp: 'bolt' }, 'cryomancer', SPELLS.bolt);
ok(b.blocked && !b.wandFx, 'bolt must be blocked on cryomancer, not silently run');
ok(bwCost(b) === 0, 'blocked attack costs nothing');
// BW costs
ok(bwCost(u) === 0, 'zero-cost attacks stay free (cards do not cost BW by being cards)');
ok(bwCost(c) === CRYO.bw, 'cryo effective cost');
ok(bwCost({ ...c, bwMul: 2 }) === CRYO.bw * 2, 'bwMul modifies effective cost');
ok(bwCost(c, { bwcost: .5 }) === CRYO.bw * .5, 'passive cost modifier');
// capacity/regen/bounds
ok(bwMaxFor('compiler') === BW_CFG.base, 'default capacity');
ok(bwMaxFor('x', { bwmax: -5 }) >= BW_CFG.min, 'capacity lower bound');
ok(bwMaxFor('x', { bwmax: 1e9 }) === BW_CFG.cap, 'capacity upper bound');
ok(bwRegen({}) === BW_CFG.bwr && bwRegen({ bwr: 0 }) === 0 && bwRegen({ bwr: -3 }) === 0, 'regen baseline / floor');
ok(clampBW(150, 100) === 100 && clampBW(-4, 100) === 0 && clampBW(NaN, 100) === 0, 'clamp');
// simulate: regen never exceeds max, spending never goes below 0
let bw = 100; for (let i = 0; i < 600; i++) bw = clampBW(bw + bwRegen({}) / 60, 100); ok(bw === 100, 'regen capped at max');
bw = 5; const cost = bwCost(c); const can = cost <= bw; ok(can, 'sanity'); bw = 2; ok(!(cost <= bw), 'insufficient BW is refused');
// every wand definition is well formed (extensible registry)
for (const id in WANDS) { const w = WANDS[id]; ok(w.n && w.short && w.col && w.accepts, id + ' missing fields'); }
console.log(fails ? fails + ' FAILED' : 'ALL WAND/BW CHECKS PASSED'); process.exit(fails ? 1 : 0);
