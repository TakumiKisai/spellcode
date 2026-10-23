// Arena size is a live binding: most rooms are 640x400, the Memory Leak lab is larger (see ARENAS.lab). Set once per fight, before the canvas is created.
export let W = 640, H = 400, GW = 32, GH = 20;
export function setArenaSize(w = 640, h = 400) { W = w; H = h; GW = Math.round(w / 20); GH = Math.round(h / 20); }
export const PLAN = { length: 20 };
export const CHAOS = ['homing', 'explode', 'burn', 'freeze', 'split', 'bounce', 'knock', 'pierce'];
