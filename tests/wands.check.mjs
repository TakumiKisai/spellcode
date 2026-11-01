import { SPELLS } from '../src/data.js';
import { WANDS, WAND_ACQ, wandsOffered, canStoreWand, specialWands, wandAccepts, applyWand, bwCost, bwMaxFor, bwRegen, clampBW, BW_CFG, CRYO } from '../src/wands.js';
let fails = 0; const bad = m => { fails++; console.log('FAIL:', m); }, ok = (c, m) => { if (!c) bad(m); };
const mkA = sp => ({ ...SPELLS[sp], rate: SPELLS[sp].rate, rep: 1, pc: 1, area: 1, size: 1, burn: SPELLS[sp].burn || 0, freeze: 0, pierce: SPELLS[sp].pierce || 0, dmg: SPELLS[sp].dmg });
// compatibility
for (const k in SPELLS) ok(wandAccepts('universal', k, SPELLS[k]), 'universal must accept ' + k);
// every specialized wand accepts exactly its own card (+ utility cards), and each attack card except the ones listed in UNCOVERED has a wand
const OWN = { cryomancer: 'stdout', railgun: 'ping', pyromancer: 'fireball', swarm: 'bolt', stormcaller: 'chain', demolitionist: 'mine' };
for (const w in OWN) for (const k in SPELLS) ok(wandAccepts(w, k, SPELLS[k]) === (k === OWN[w] || SPELLS[k].k === 'self'), w + ' compat wrong for ' + k);
const UNCOVERED = Object.keys(SPELLS).filter(k => SPELLS[k].k !== 'self' && !Object.values(OWN).includes(k));
console.log('attack cards without a specialized wand yet:', UNCOVERED.join(', '));
// transforms
for (const [w, sp] of Object.entries(OWN)) { const t = applyWand(mkA(sp), { sp }, w, SPELLS[sp]); ok(t.wandFx && !t.blocked, w + ' transforms ' + sp); ok(bwCost(t) > 0, w + ' has a BW cost'); ok(WANDS[w].transforms.includes(sp), w + ' lists its transform'); }
{ const r = applyWand(mkA('ping'), { sp: 'ping' }, 'railgun', SPELLS.ping); ok(r.dmg > SPELLS.ping.dmg * 2 && r.rate < SPELLS.ping.rate && r.railLen > 300, 'railgun: heavier, slower, longer than ping'); }
{ const r = applyWand(mkA('bolt'), { sp: 'bolt' }, 'swarm', SPELLS.bolt); ok(r.swarmN >= 3 && r.dmg < SPELLS.bolt.dmg && r.home && r.pierce === 0, 'swarm: many weak homing drones'); }
{ const r = applyWand(mkA('fireball'), { sp: 'fireball' }, 'pyromancer', SPELLS.fireball); ok(r.pyroR > 0 && r.burn >= 1 && r.pierce === 0, 'pyromancer: bursts, burns, no pierce'); }
{ const r = applyWand(mkA('mine'), { sp: 'mine' }, 'demolitionist', SPELLS.mine); ok(r.clusterN === 3 && r.dmg < SPELLS.mine.dmg, 'demolitionist: three weaker mines'); }
{ const r = applyWand(mkA('chain'), { sp: 'chain' }, 'stormcaller', SPELLS.chain); ok(r.stormFork >= 2, 'stormcaller: forks'); }
for (const w in OWN) for (const k in SPELLS) if (k !== OWN[w] && SPELLS[k].k !== 'self') ok(applyWand(mkA(k), { sp: k }, w, SPELLS[k]).blocked, w + ' must block ' + k);
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
// acquisition / storage rules
ok(JSON.stringify(specialWands())===JSON.stringify(['cryomancer','railgun','pyromancer','swarm','stormcaller','demolitionist']), 'six specialized wands');
ok(wandsOffered(['universal'], []).length===6, 'all unowned wands are offered');
ok(!wandsOffered(['universal','cryomancer'], []).includes('cryomancer'), 'owned wand is never offered again');
ok(!wandsOffered(['universal'], ['cryomancer']).includes('cryomancer'), 'wand in Storage is never offered (no duplicates)');
ok(wandsOffered(specialWands().concat('universal'), []).length===0, 'nothing offered when everything is owned');
ok(WAND_ACQ.chest>0&&WAND_ACQ.chest<1&&WAND_ACQ.deck>0&&WAND_ACQ.deck<1, 'chest/deck wand chances are partial, never guaranteed');
ok(!canStoreWand('universal','cryomancer',['universal','cryomancer']), 'Universal can never be stored');
ok(!canStoreWand('cryomancer','cryomancer',['universal','cryomancer']), 'equipped wand can never be stored');
ok(canStoreWand('cryomancer','universal',['universal','cryomancer']), 'spare wand can be stored');
ok(!canStoreWand('cryomancer','universal',['universal']), 'cannot store a wand you do not own');
for (const id in WANDS) ok(Array.isArray(WANDS[id].art) && WANDS[id].art.length>5, id+' has pixel art');
console.log(fails ? fails + ' FAILED' : 'ALL WAND/BW CHECKS PASSED'); process.exit(fails ? 1 : 0);
