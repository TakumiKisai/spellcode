import { defOf, maxV, xText, wo, isMod } from './helpers.js';
import { RC, RAR } from './data.js';

export function groupCards(list) {
 const map = new Map();
 for (const c of list) {
  const key = `${c.k}__v${c.v || 1}`;
  if (!map.has(key)) {
   map.set(key, { k: c.k, v: c.v || 1, count: 0, sample: c });
  }
  map.get(key).count++;
 }
 return Array.from(map.values()).sort((a, b) => {
  const da = defOf(a.k), db = defOf(b.k);
  if (da.r !== db.r) return da.r - db.r;
  return a.k.localeCompare(b.k);
 });
}

// Hypergeometric probability: P(at least 1 of C copies in H draws from N cards)
export function calcDrawProb(N, C, H) {
 if (N <= 0 || C <= 0 || H <= 0) return { next: 0, hand: 0 };
 const next = Math.round((C / N) * 1000) / 10;
 if (H >= N || C >= N) return { next, hand: 100 };
 const draws = Math.min(H, N);
 let probNone = 1;
 for (let i = 0; i < draws; i++) {
  probNone *= (N - C - i) / (N - i);
 }
 const hand = Math.round(Math.max(0, 1 - probNone) * 1000) / 10;
 return { next, hand };
}

function renderDrawBody(G, handSize) {
 const N = G.draw.length;
 const H = Math.min(N, handSize);
 const groups = groupCards(G.draw);

 const rows = groups.map(g => {
  const d = defOf(g.k);
  const p = calcDrawProb(N, g.count, H);
  return `
   <div class="card" style="border-top-color:${RC[d.r] || '#9d92b5'};cursor:default;position:relative">
     <div class="cnt-badge">x${g.count}</div>
     ${g.v > 1 ? `<span class="v-tag v${g.v}">v${g.v}</span>` : ''}
     <em style="color:${RC[d.r] || '#9d92b5'}">${RAR[d.r] || 'COMMON'}</em>
     <b>${d.n}</b>
     <small>${d.d || ''}</small>
     ${wo(g.k)}
     ${xText(g.k, g.v) ? `<i class="xl">x v${g.v}: ${xText(g.k, g.v)}</i>` : ''}
     <div style="margin-top:auto;display:flex;flex-direction:column;gap:3px;padding-top:6px;border-top:1px dashed rgba(120,120,120,.3)">
       <span class="p-tag">Next draw: <b>${p.next}%</b></span>
       <span class="p-tag prob">In hand (${H} draws): <b>${p.hand}%</b></span>
     </div>
   </div>
  `;
 }).join('');

 return `
  <div style="color:var(--mute);font-size:11px;margin-bottom:10px">${N} cards left in draw pile • Upcoming round draws ${H} cards into hand</div>
  ${N === 0 ? '<div class="center" style="padding:32px;color:var(--mute)">Draw pile is empty!<br>Your Recycle Bin will shuffle into draw on the next pull.</div>' : `
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">
      ${rows}
    </div>
  `}
 `;
}

function renderDiscBody(G) {
 const N = G.disc.length;
 const groups = groupCards(G.disc);

 const rows = groups.map(g => {
  const d = defOf(g.k);
  return `
   <div class="card" style="border-top-color:${RC[d.r] || '#9d92b5'};cursor:default;position:relative">
     <div class="cnt-badge">x${g.count}</div>
     ${g.v > 1 ? `<span class="v-tag v${g.v}">v${g.v}</span>` : ''}
     <em style="color:${RC[d.r] || '#9d92b5'}">${RAR[d.r] || 'COMMON'}</em>
     <b>${d.n}</b>
     <small>${d.d || ''}</small>
     ${wo(g.k)}
     ${xText(g.k, g.v) ? `<i class="xl">x v${g.v}: ${xText(g.k, g.v)}</i>` : ''}
     <div style="margin-top:auto;display:flex;gap:4px;padding-top:6px;border-top:1px dashed rgba(120,120,120,.3)">
       <button class="btn sm" data-bin-restore="${g.sample.id}" style="padding:4px 6px;font-size:10px;flex:1" title="Restore this card back to your hand">⬆️ Restore</button>
       <button class="btn sm g" data-bin-delete="${g.sample.id}" style="padding:4px 6px;font-size:10px;flex:1;color:#ff5c7a" title="Permanently delete from deck & add 1 fresh card to draw pile">❌ Delete (+1 Draw)</button>
     </div>
   </div>
  `;
 }).join('');

 return `
  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--mute)">
    <div style="color:var(--ink);font-size:11.5px;max-width:440px">
      <b>${N} cards in Recycle Bin.</b> Store cards here to free up hand space, restore them anytime, or delete cards to synthesize fresh cards into your draw pile!
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${N >= 3 ? `<button class="btn sm" data-act="bin-recycle-3" style="background:#0b8479;color:#fff;font-weight:700">♻️ Delete 3 Cards → +3 Fresh Draw Cards</button>` : `<button class="btn sm" disabled style="opacity:.6;font-size:11px" title="Need at least 3 cards in bin to recycle">♻️ Delete 3 Cards (needs ${3 - N} more in bin)</button>`}
      ${N > 0 ? `<button class="btn sm g" data-act="bin-recycle-all" style="font-size:11px">🗑️ Empty Bin (${N}) → +${N} Fresh Draw Cards</button>` : ''}
    </div>
  </div>
  ${N === 0 ? '<div class="center" style="padding:32px;color:var(--mute)">Recycle Bin is empty.<br>Tap a card in hand and click "Stash in Bin", double-tap a hand card, or remove pipeline cards to store them here!</div>' : `
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr))">
      ${rows}
    </div>
  `}
 `;
}

function renderDeckBody(G) {
 const groups = groupCards(G.deck);

 const rows = groups.map(g => {
  const d = defOf(g.k);
  const inPipe = G.slots.filter(c => c.k === g.k && (c.v || 1) === g.v).length;
  const inHand = G.hand.filter(c => c.k === g.k && (c.v || 1) === g.v).length;
  const inDraw = G.draw.filter(c => c.k === g.k && (c.v || 1) === g.v).length;
  const inDisc = G.disc.filter(c => c.k === g.k && (c.v || 1) === g.v).length;

  return `
   <div class="card" style="border-top-color:${RC[d.r] || '#9d92b5'};cursor:default;position:relative">
     <div class="cnt-badge">x${g.count}</div>
     ${g.v > 1 ? `<span class="v-tag v${g.v}">v${g.v}</span>` : ''}
     <em style="color:${RC[d.r] || '#9d92b5'}">${RAR[d.r] || 'COMMON'}</em>
     <b>${d.n}</b>
     <small>${d.d || ''}</small>
     ${wo(g.k)}
     ${xText(g.k, g.v) ? `<i class="xl">x v${g.v}: ${xText(g.k, g.v)}</i>` : ''}
     <div style="margin-top:auto;font-size:9.5px;color:var(--mute);display:flex;flex-wrap:wrap;gap:3px;padding-top:4px">
       ${inPipe ? `<span class="p-tag" style="border-color:var(--mult);color:var(--mult)">Pipe: ${inPipe}</span>` : ''}
       ${inHand ? `<span class="p-tag" style="border-color:var(--chip);color:var(--chip)">Hand: ${inHand}</span>` : ''}
       ${inDraw ? `<span class="p-tag">Draw: ${inDraw}</span>` : ''}
       ${inDisc ? `<span class="p-tag">Bin: ${inDisc}</span>` : ''}
     </div>
   </div>
  `;
 }).join('');

 return `
  <div style="color:var(--mute);font-size:11px;margin-bottom:10px">${G.deck.length} total cards registered in host memory across all sectors</div>
  <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">
    ${rows}
  </div>
 `;
}

export function renderOSWindows(G, handSize, extra = []) {
 if (!G.windows) return '';

 const WINS = [
  { key: 'draw', icon: '🗂️', title: `DRAW PILE INSPECTOR (${(G.draw || []).length})`, renderBody: () => renderDrawBody(G, handSize) },
  { key: 'disc', icon: '🗑️', title: `RECYCLE BIN (${(G.disc || []).length})`, renderBody: () => renderDiscBody(G) },
  { key: 'deck', icon: '📦', title: `DECK REPOSITORY (${(G.deck || []).length})`, renderBody: () => renderDeckBody(G) },
  ...extra
 ];

 return WINS.map(spec => {
  const w = G.windows[spec.key];
  if (!w || !w.open) return '';

  const cls = ['os-win', w.max ? 'max' : '', w.min ? 'min' : ''].filter(Boolean).join(' ');
  const style = w.max
   ? `z-index:${w.z || 100};`
   : `left:${Math.max(8, w.x || 20)}px;top:${Math.max(8, w.y || 40)}px;width:${w.min ? '300px' : 'min(620px, 94vw)'};height:${w.min ? '38px' : 'min(460px, 80vh)'};z-index:${w.z || 100};`;

  return `
   <div class="${cls}" data-win-id="${spec.key}" style="${style}">
     <div class="os-tb" data-win-drag="${spec.key}">
       <span style="display:flex;align-items:center;gap:6px"><span>${spec.icon}</span> <span>${spec.title}</span></span>
       <div class="os-ctrl">
         <button class="os-btn" data-win-min="${spec.key}" title="${w.min ? 'Restore' : 'Minimize'}">${w.min ? '+' : '-'}</button>
         <button class="os-btn" data-win-max="${spec.key}" title="${w.max ? 'Restore Size' : 'Maximize'}">${w.max ? '❐' : '□'}</button>
         <button class="os-btn cls" data-win-close="${spec.key}" title="Close">✕</button>
       </div>
     </div>
     <div class="os-body">
       ${spec.renderBody()}
     </div>
   </div>
  `;
 }).join('');
}

export function renderDrawModal(G, handSize) {
 return renderOSWindows(G, handSize);
}
export function renderDiscModal(G) {
 return renderOSWindows(G, 6);
}
export function renderDeckModal(G) {
 return renderOSWindows(G, 6);
}
