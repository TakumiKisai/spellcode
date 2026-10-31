// Wand pixel art (browser only). Sprites are data in wands.js (`art`), rasterised once to a 20x7 canvas and reused everywhere:
// HUD, equipment panel, Storage, reward cards and the in-world wand held by the Host. One source of truth keeps sandbox and normal runs identical.
import { wandOf } from './wands.js';
export const WAND_PX = { w: 20, h: 7 };
const cache = {};
export function wandCanvas(id) {
 const w = wandOf(id), key = w.n;
 if (cache[key]) return cache[key];
 const cv = document.createElement('canvas'); cv.width = WAND_PX.w; cv.height = WAND_PX.h;
 const g = cv.getContext('2d');
 for (const [x, y, ww, hh, c] of w.art || []) { g.fillStyle = c; g.fillRect(x, y, ww, hh); }
 return cache[key] = cv;
}
const urls = {};
export const wandIconURL = id => urls[id] ||= wandCanvas(id).toDataURL();
// <img> for HTML UIs. Rotated so the wand reads as an item icon rather than a thin bar.
export const wandIconHTML = (id, px = 4, rot = -35) => `<img class="wand-ico" alt="" src="${wandIconURL(id)}" style="width:${WAND_PX.w * px}px;height:${WAND_PX.h * px}px;image-rendering:pixelated;transform:rotate(${rot}deg)">`;
