// Fullscreen toggle + responsive helpers.
// Uses the native Fullscreen API where it exists (desktop, Android, iPad). Where it does not (iPhone Safari) or is refused,
// it falls back to a "fit" mode (html.fsx) that makes the game use the whole visible viewport.
const root = document.documentElement;
const nativeEnter = () => root.requestFullscreen ? root.requestFullscreen({ navigationUI: 'hide' }) : root.webkitRequestFullscreen ? root.webkitRequestFullscreen() : Promise.reject(new Error('no fullscreen api'));
const nativeExit = () => document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen ? document.webkitExitFullscreen() : Promise.resolve();
const nativeEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;

let fit = false; // true while in fallback (non-native) fit mode
let btn = null;

const active = () => !!nativeEl() || fit;
function sync() {
 root.classList.toggle('fsx', active());
 if (btn) {
  const on = active();
  btn.textContent = on ? '✕' : '⛶';
  btn.title = btn.ariaLabel = on ? 'Exit fullscreen (Esc)' : 'Fullscreen';
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
 }
}
async function enter() {
 try {
  await nativeEnter();
  fit = false;
  try { await screen.orientation?.lock?.('landscape'); } catch (e) { /* not allowed on most desktops / iOS: fine */ }
 } catch (e) {
  fit = true; // fullscreen refused or unavailable (e.g. iPhone): still use all available screen space
  window.scrollTo(0, 1);
 }
 sync();
}
async function exit() {
 fit = false;
 try { screen.orientation?.unlock?.(); } catch (e) { /* ignore */ }
 if (nativeEl()) { try { await nativeExit(); } catch (e) { /* ignore */ } }
 sync();
}
export const toggleFullscreen = () => (active() ? exit() : enter());

export function initFullscreen() {
 if (btn) return;
 btn = document.createElement('button');
 btn.className = 'fsb';
 btn.type = 'button';
 btn.onclick = e => { e.stopPropagation(); toggleFullscreen(); btn.blur(); };
 document.body.appendChild(btn);
 document.addEventListener('fullscreenchange', () => { if (!nativeEl()) fit = false; sync(); }); // covers Esc / browser UI exit
 document.addEventListener('webkitfullscreenchange', () => { if (!nativeEl()) fit = false; sync(); });
 addEventListener('keydown', e => { if (e.key === 'Escape' && fit) exit(); }); // Esc leaves fit mode too (native fullscreen handles Esc itself)
 // Tag <body> with the current view so CSS can lay out the arena (canvas present) differently from menus; also tell CSS whether a settings gear is shown.
 const app = document.getElementById('app');
 const tag = () => {
  document.body.classList.toggle('in-run', !!(app && app.querySelector('#cv')));
  document.body.classList.toggle('has-gear', !!document.querySelector('.gear'));
 };
 if (app) new MutationObserver(tag).observe(app, { childList: true, subtree: true });
 tag(); sync();
}
