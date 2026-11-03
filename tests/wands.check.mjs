import { SPELLS } from '../src/data.js';
import { CARD_DESC, WANDS, WAND_ACQ, wandsOffered, canStoreWand, specialWands, wandAccepts, applyWand, bwCost, bwMaxFor, bwRegen, clampBW, BW_CFG, CRYO, FX_LABEL } from '../src/wands.js';
let fails = 0; const bad = m => { fails++; console.log('FAIL:', m); }, ok = (c, m) => { if (!c) bad(m); };
const mkA = sp => ({ ...SPELLS[sp], rate: SPELLS[sp].rate, rep: 1, pc: 1, area: 1, size: 1, burn: SPELLS[sp].burn || 0, freeze: 0, pierce: SPELLS[sp].pierce || 0, dmg: SPELLS[sp].dmg, sp: SPELLS[sp].sp || 0, rad: SPELLS[sp].rad || 10, knock: SPELLS[sp].knock || 0, jumps: SPELLS[sp].jumps || 0 });
const MATRIX = { // the cards each specialized wand fires; every pair has its own unique transformation
 cryomancer: ['stdout', 'fireball', 'nova'], railgun: ['ping', 'bolt', 'lance'], pyromancer: ['fireball', 'bolt', 'mine'], swarm: ['bolt', 'chain', 'fireball'],
 stormcaller: ['chain', 'bolt', 'ping'], demolitionist: ['mine', 'fireball', 'nova'], lancer: ['lance', 'ping'], pulse: ['nova', 'chain']
};
const attackCards = Object.keys(SPELLS).filter(k => SPELLS[k].k !== 'self');
// compatibility
for (const k in SPELLS) ok(wandAccepts('universal', k, SPELLS[k]), 'universal must accept ' + k);
ok(wandAccepts('nonexistent', 'bolt', SPELLS.bolt), 'unknown wand id falls back to universal');
ok(JSON.stringify(specialWands()) === JSON.stringify(Object.keys(MATRIX)), 'specialized wand roster: ' + specialWands());
const seen = new Set();
for (const [w, cards] of Object.entries(MATRIX)) {
 ok(cards.length >= 2, w + ' must fire more than one card');
 for (const k of attackCards) ok(wandAccepts(w, k, SPELLS[k]) === cards.includes(k), w + ' compat wrong for ' + k);
 ok(wandAccepts(w, 'shield', SPELLS.shield), w + ' never blocks utility cards');
 ok(JSON.stringify([...WANDS[w].transforms].sort()) === JSON.stringify([...cards].sort()), w + ' transforms list');
 for (const k of cards) {
  const t = applyWand(mkA(k), { sp: k }, w, SPELLS[k]);
  ok(!t.blocked && t.wandFx, w + '/' + k + ' transforms');
  ok(bwCost(t) > 0, w + '/' + k + ' has a BW cost');
  const label = t.fxLabel || FX_LABEL[t.wandFx]; ok(label, w + '/' + k + ' has a preview label');
  const id = w + '/' + label; ok(!seen.has(label) || w === 'railgun' && k !== 'ping', w + '/' + k + ' label duplicates another wand: ' + label); seen.add(label);
 }
 for (const k of attackCards.filter(k => !cards.includes(k))) ok(applyWand(mkA(k), { sp: k }, w, SPELLS[k]).blocked, w + ' must block ' + k);
}
for (const [w, cards] of Object.entries(MATRIX)) for (const k of cards) ok(CARD_DESC[w] && CARD_DESC[w][k], w + '/' + k + ' has a compact description');
console.log('attack cards without a specialized wand yet:', attackCards.filter(k => !Object.values(MATRIX).flat().includes(k)).join(', '));
// the wunderwaffe: chain under the Swarm Wand = arcing drones
{ const t = applyWand(mkA('chain'), { sp: 'chain' }, 'swarm', SPELLS.chain); ok(t.swarmN >= 3 && t.xArc && t.home && t.pierce === 0, 'swarm+chain = homing drones that arc lightning'); }
{ const r = applyWand(mkA('ping'), { sp: 'ping' }, 'railgun', SPELLS.ping); ok(r.dmg > SPELLS.ping.dmg * 2 && r.rate < SPELLS.ping.rate && r.railLen > 300, 'railgun: heavier, slower, longer than ping'); }
{ const r = applyWand(mkA('bolt'), { sp: 'bolt' }, 'railgun', SPELLS.bolt); ok(r.k === 'beam' && r.railLen > 0, 'railgun+bolt is a hitscan beam'); }
{ const r = applyWand(mkA('mine'), { sp: 'mine' }, 'demolitionist', SPELLS.mine); ok(r.clusterN === 3 && r.dmg < SPELLS.mine.dmg, 'demolitionist: three weaker mines'); }
{ const r = applyWand(mkA('lance'), { sp: 'lance' }, 'lancer', SPELLS.lance); ok(r.pierce === 99 && r.pull >= 2, 'lancer harpoon pierces and pulls'); }
{ const r = applyWand(mkA('nova'), { sp: 'nova' }, 'pulse', SPELLS.nova); ok(r.cascade && r.rad > SPELLS.nova.rad, 'pulse cascade'); }
// BW
const c = applyWand(mkA('stdout'), { sp: 'stdout' }, 'cryomancer', SPELLS.stdout);
ok(c.wandFx === 'cryo' && c.burn === 0 && c.freeze >= 1 && c.pierce === 99 && c.bw === CRYO.bw, 'cryo transform of stdout');
const u = applyWand(mkA('bolt'), { sp: 'bolt' }, 'universal', SPELLS.bolt);
ok(!u.blocked && u.dmg === SPELLS.bolt.dmg && !u.wandFx, 'universal must not change bolt');
ok(bwCost(u) === 0, 'universal attacks stay free (cards do not cost BW by being cards)');
ok(bwCost({ ...c, bwMul: 2 }) === CRYO.bw * 2, 'bwMul modifies effective cost'); ok(bwCost(c, { bwcost: .5 }) === CRYO.bw * .5, 'passive cost modifier');
ok(BW_CFG.base === 200 && bwMaxFor('compiler') === 200 && bwMaxFor('debugger') === 200, 'max BW is 200 for every Host');
ok(bwMaxFor('x', { bwmax: -5 }) >= BW_CFG.min && bwMaxFor('x', { bwmax: 1e9 }) === BW_CFG.cap, 'capacity bounds');
ok(bwRegen({}) === BW_CFG.bwr && bwRegen({ bwr: 0 }) === 0 && bwRegen({ bwr: -3 }) === 0, 'regen baseline / floor');
ok(clampBW(250, 200) === 200 && clampBW(-4, 200) === 0 && clampBW(NaN, 200) === 0, 'clamp');
// acquisition / storage rules
ok(wandsOffered(['universal'], []).length === 8, 'all unowned wands are offered');
ok(!wandsOffered(['universal', 'cryomancer'], []).includes('cryomancer'), 'owned wand is never offered again');
ok(!wandsOffered(['universal'], ['cryomancer']).includes('cryomancer'), 'wand in Storage is never offered (no duplicates)');
ok(wandsOffered(specialWands().concat('universal'), []).length === 0, 'nothing offered when everything is owned');
ok(WAND_ACQ.chest > 0 && WAND_ACQ.chest < 1 && WAND_ACQ.deck > 0 && WAND_ACQ.deck < 1, 'chest/deck wand chances are partial');
ok(!canStoreWand('universal', 'cryomancer', ['universal', 'cryomancer']) && !canStoreWand('cryomancer', 'cryomancer', ['universal', 'cryomancer']) && canStoreWand('cryomancer', 'universal', ['universal', 'cryomancer']) && !canStoreWand('cryomancer', 'universal', ['universal']), 'store rules');
for (const id in WANDS) ok(Array.isArray(WANDS[id].art) && WANDS[id].art.length > 5, id + ' has pixel art');
console.log(fails ? fails + ' FAILED' : 'ALL WAND/BW CHECKS PASSED'); process.exit(fails ? 1 : 0);
