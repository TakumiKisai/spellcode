import { MAPS, buildBossMap, buildLayerMap, ROOM_TYPES, slotRTP, slotHandTable, evalSlotHand, spinSlots, redrawCost, ENTRY_SPOT, DIR_VEC, DIR_OPP } from '../src/rooms.js';
import { ARENAS, WORLDS } from '../src/data.js';
let fails = 0; const bad = m => { fails++; console.log('FAIL:', m); };
const blocked = (A, x, y, r) => { for (const w of A.w) if (x > w[0] - r && x < w[0] + w[2] + r && y > w[1] - r && y < w[1] + w[3] + r) return true; return x < r || y < r || x > 631 || y > 391; };
function floodOK(A, doors) {
  const seen = new Set(); let st = null;
  for (let r = 0; r < 200 && !st; r += 10) for (const [x, y] of [[320, 200 + r], [320, 200 - r], [320 + r, 200], [320 - r, 200]]) if (!st && !blocked(A, x, y, 9)) st = [x, y];
  const q = [st]; seen.add(st.join());
  while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[10, 0], [-10, 0], [0, 10], [0, -10]]) { const nx = x + dx, ny = y + dy; if (!seen.has(nx + ',' + ny) && !blocked(A, nx, ny, 9)) { seen.add(nx + ',' + ny); q.push([nx, ny]); } } }
  const snap = d => Math.round(ENTRY_SPOT[d][0] / 10) * 10 + ',' + Math.round(ENTRY_SPOT[d][1] / 10) * 10;
  return Object.keys(doors).filter(d => doors[d]).every(d => seen.has(snap(d)));
}
function check(map, label) {
  const rooms = Object.values(map.rooms);
  if (rooms.filter(r => r.type === 'S').length !== 1) bad(label + ' needs exactly one S');
  if (rooms.filter(r => r.type === 'X').length !== 1) bad(label + ' needs exactly one X');
  // doors are symmetric and point at real neighbours
  for (const r of rooms) for (const d in r.doors) { const o = map.rooms[r.doors[d]]; if (!o) bad(label + ' dangling door'); else if (o.doors[DIR_OPP[d]] !== r.id) bad(label + ' asymmetric door'); else if (o.at[0] !== r.at[0] + DIR_VEC[d][0] || o.at[1] !== r.at[1] + DIR_VEC[d][1]) bad(label + ' door not adjacent'); }
  // every room reachable from start, and exit reachable
  const seen = new Set([map.start]), q = [map.start];
  while (q.length) { const r = map.rooms[q.pop()]; for (const d in r.doors) if (!seen.has(r.doors[d])) { seen.add(r.doors[d]); q.push(r.doors[d]); } }
  if (seen.size !== rooms.length) bad(label + ' has an unreachable room');
  for (const r of rooms) { const A = ARENAS[r.arena]; if (!A) { bad(label + ' missing arena ' + r.arena); continue; } if (A.W || A.H) bad(label + ' uses a non-standard size arena'); if (A.boss || A.own === 'segfault' || A.own === 'leak') bad(label + ' uses a boss arena'); if (!floodOK(A, r.doors)) bad(label + ' room ' + r.id + ' (' + r.arena + ') has an unreachable door'); }
}
let n = 0;
for (const key of Object.keys(MAPS)) { const [w, l] = key.split(':'); const a = buildLayerMap(w, +l), b = buildLayerMap(w, +l); n++;
  if (!a) { bad(key + ' failed to build'); continue; } check(a, key);
  if (JSON.stringify(a.rooms) !== JSON.stringify(b.rooms)) bad(key + ' is not deterministic between builds'); }
console.log('fixed maps checked:', n, 'of expected 16');
// boot 1-3: chest on the right
const b3 = buildLayerMap('boot', 3); const t = Object.values(b3.rooms).find(r => r.type === 'T'); const mx = Math.max(...Object.values(b3.rooms).map(r => r.at[0]));
if (!(t.at[0] === mx)) bad('boot:3 chest is not on the right-hand branch'); else console.log('boot:3 chest is the rightmost room: ok');
// layers with no map
for (const [w, l] of [['boot', 5], ['deadlock', 1], ['deadlock', 3], ['heap', 5]]) if (buildLayerMap(w, l)) bad(`${w}:${l} should keep the single-room format`);
console.log('deadlock / layer-5 stay legacy: ok');
// boss layers: antechamber + one-way boss door into the untouched dedicated arena
for (const [w, b, a] of [['boot', 'leak', 'lab'], ['heap', 'segfault', 'heap_boss'], ['null', 'runtime', 'gridlock'], ['nexus', 'race', 'nexus_boss']]) {
  const m = buildBossMap(w, b); if (!m) { bad(w + ' boss map missing'); continue; }
  const B = m.rooms[m.exit]; if (B.type !== 'B' || B.arena !== a || ARENAS[a] !== ARENAS[a] || Object.keys(B.doors).length) bad(w + ' boss room wrong');
  if (m.rooms[m.start].doors.E !== m.exit || !floodOK(ARENAS[m.rooms[m.start].arena], m.rooms[m.start].doors)) bad(w + ' boss door unreachable');
}
if (buildBossMap('deadlock', 'runtime')) bad('deadlock must not get a boss door');
console.log('boss door maps: ok');
// Kernel procedural
let kd = new Set();
for (let i = 0; i < 300; i++) { const m = buildLayerMap('kernel', 1 + i % 4); if (!m) { bad('kernel build'); break; } check(m, 'kernel#' + i); kd.add(Object.values(m.rooms).map(r => r.type + r.at).join('|')); }
console.log('kernel layouts distinct:', kd.size, 'of 300');
// procedural generation must not leak into ordinary sectors
if (buildLayerMap('heap', 1).procedural || !buildLayerMap('kernel', 1).procedural) bad('procedural flag wrong');
// slots: five reels scored like poker; chances are exact counts over all 6^5 outcomes
{ const t = slotHandTable(), total = t.reduce((a, h) => a + h.count, 0);
  if (total !== 7776) bad('slot outcomes should total 7776, got ' + total);
  console.log('slot hands:', t.map(h => h.id + ' ' + (h.p * 100).toFixed(2) + '% x' + h.mult).join(' | '), '| RTP', slotRTP());
  let tot = 0, N = 300000; for (let i = 0; i < N; i++) tot += spinSlots(1).payout; const sim = tot / N;
  console.log('simulated return over', N, 'spins:', sim.toFixed(3)); if (Math.abs(sim - slotRTP()) > .02) bad('slot simulation does not match the exact return');
  const E = (...s) => evalSlotHand(s);
  if (E('7','7','7','7','7') !== 'five' || E('$','$','$','$','7') !== 'four' || E('#','#','#','%','%') !== 'full' || E('#','#','#','7','$') !== 'three' || E('$','$','%','%','7') !== 'twopair' || E('7','7','$','#','%') !== 'pair7' || E('$','$','7','#','%') !== 'pair' || E('7','$','#','%','&') !== 'none') bad('slot hand scoring');
}
console.log('redraw costs 0..7:', [0,1,2,3,4,5,6,7].map(redrawCost).join(','));
console.log(fails ? fails + ' FAILURES' : 'ALL ROOM CHECKS PASSED');
process.exit(fails ? 1 : 0);
