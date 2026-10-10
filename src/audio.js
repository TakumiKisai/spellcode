import { MUSIC } from './data.js';

export let AC = null, MUTE = false, lastS = {};
export const VOL = { master: 1, music: 1, sfx: 1 };
export function applyVolumes() {
 if (musicBus) musicBus.gain.value = MUSIC_MASTER * VOL.master * VOL.music;
}
export function setMute(m) {
 MUTE = m;
 if (m) stopMusic();
}

export function snd(f, d = .08, type = 'square', v = .04, sl = 0, key) {
 if (MUTE) return;
 const t = performance.now();
 if (key) {
  if (t - (lastS[key] || 0) < 70) return;
  lastS[key] = t;
 }
 try {
  AC = AC || new (window.AudioContext || window.webkitAudioContext)();
  const n = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, n);
  if (sl) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + sl), n + d);
  g.gain.setValueAtTime(Math.max(.0002, v * VOL.master * VOL.sfx), n);
  g.gain.exponentialRampToValueAtTime(.001, n + d);
  o.connect(g);
  g.connect(AC.destination);
  o.start();
  o.stop(n + d);
 } catch (e) {}
}

let MUSIC_MASTER = 0.85, musicCtx = null, musicBus = null, musicBuffer = null, musicSource = null, musicGain = null, musicKey = '', musicLoading = '', musicToken = 0;

export function ensureMusicContext() {
 try {
  musicCtx = musicCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (!musicBus) {
   musicBus = musicCtx.createGain();
   musicBus.gain.value = MUSIC_MASTER * VOL.master * VOL.music;
   musicBus.connect(musicCtx.destination);
  }
  if (musicCtx.state === 'suspended') musicCtx.resume();
  return true;
 } catch (e) {
  return false;
 }
}

const musicCache = new Map(), musicPending = new Map(), MUSIC_CACHE_MAX = 6;

export function fetchDecode(k) {
 if (!MUSIC[k]) return Promise.resolve(null);
 if (musicCache.has(k)) {
  const d = musicCache.get(k);
  return Promise.resolve(d);
 }
 if (musicPending.has(k)) return musicPending.get(k);

 const p = (async () => {
  ensureMusicContext();
  const file = MUSIC[k].file;
  const base = file.replace(/\.(mp3|ogg)(\.(mp3|ogg))?$/i, '');
  const ext = file.includes('.ogg') ? '.ogg' : '.mp3';
  const paths = [
   '/audio/' + file,
   'audio/' + file,
   '/audio/' + base + ext,
   'audio/' + base + ext,
   '/audio/' + base + ext + ext,
   'audio/' + base + ext + ext,
   '/' + file,
   file,
   '/' + base + ext,
   base + ext
  ];
  for (const url of paths) {
   try {
    const r = await fetch(url);
    if (r.ok) {
     const ab = await r.arrayBuffer();
     const d = await musicCtx.decodeAudioData(ab);
     d._isFile = true;
     musicCache.set(k, d);
     return d;
    }
   } catch (e) {}
  }
  return null;
 })();

 musicPending.set(k, p);
 const done = () => musicPending.delete(k);
 p.then(done, done);
 return p;
}

export function preloadMusic(k) {
 if (MUTE || !MUSIC[k] || !ensureMusicContext()) return Promise.resolve(true);
 return fetchDecode(k).then(() => true, () => true);
}

export function stopMusic(fade = .25) {
 if (!musicSource || !musicCtx) return;
 const now = musicCtx.currentTime, g = musicGain || musicBus;
 try {
  g.gain.cancelScheduledValues(now);
  g.gain.setValueAtTime(g.gain.value, now);
  g.gain.linearRampToValueAtTime(0, now + fade);
  musicSource.stop(now + fade + .03);
 } catch (e) {}
 musicSource = null;
 musicGain = null;
}

export function playMusicBuffer(k) {
 const spec = MUSIC[k];
 if (!musicBuffer || !musicCtx || !spec) return;
 const now = musicCtx.currentTime, src = musicCtx.createBufferSource(), g = musicCtx.createGain();
 src.buffer = musicBuffer;
 src.loop = true;
 if (musicBuffer._isFile && musicBuffer.duration > 15) {
  src.loopStart = Math.min(spec.start || 0, Math.max(0, musicBuffer.duration - .01));
  src.loopEnd = Math.min(spec.end || musicBuffer.duration, musicBuffer.duration);
  if (src.loopEnd <= src.loopStart) src.loopStart = 0;
  src.start(now, Math.min(src.loopStart, Math.max(0, musicBuffer.duration - .01)));
 } else {
  src.loopStart = 0;
  src.loopEnd = musicBuffer.duration;
  src.start(now);
 }
 g.gain.setValueAtTime(0, now);
 g.gain.linearRampToValueAtTime(spec.gain || 0.8, now + .25);
 src.connect(g);
 g.connect(musicBus);
 musicSource = src;
 musicGain = g;
 src.onended = () => {
  if (musicSource === src) {
   musicSource = null;
   musicGain = null;
  }
 };
}

export async function setMusic(k) {
 if (MUTE || !k || !MUSIC[k]) {
  stopMusic();
  musicKey = '';
  musicLoading = '';
  return;
 }
 if (k === musicKey && musicSource) return;
 if (k === musicKey && musicLoading === k) return;
 musicKey = k;
 musicLoading = k;
 stopMusic(.18);
 const token = ++musicToken;
 const d = await fetchDecode(k);
 if (token !== musicToken) return;
 musicBuffer = d;
 musicLoading = '';
 if (d && musicKey === k && !MUTE) {
  if (musicCtx.state === 'suspended') await musicCtx.resume();
  playMusicBuffer(k);
 }
}

addEventListener('visibilitychange', () => {
 if (!musicCtx) return;
 if (document.hidden) musicCtx.suspend();
 else if (!MUTE) musicCtx.resume();
});
