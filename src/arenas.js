// ===== ROOMS (maps) =====
// SECTOR = world, LAYER = stage, MAP/ROOM = the playable space, BOSS ARENA = a dedicated Layer 5 room.
// Every room: n (display name), w (solid walls [x,y,w,h]), hz (floor hazards [x,y,w,h,'lava'|'slow']), th (visual theme), st (theme variant), pr (decor props, never solid),
// own (which world/boss owns it: owned rooms never show up in randomly generated worlds). Canvas is 640x400.
export const EXTRA_ARENAS = {
 // ---------------- THE HEAP (Layers 1-4, then the Segfault arena) ----------------
 heap_alloc: { n: 'ALLOCATION TABLE', th: 'heap', st: 'rows', own: 'heap', hz: [], pr: [['lamp', 20, 20], ['lamp', 620, 20], ['lamp', 20, 380], ['lamp', 620, 380]],
  w: [[90, 70, 120, 34], [300, 70, 60, 34], [430, 70, 110, 34], [60, 180, 70, 34], [200, 180, 140, 34], [440, 180, 90, 34], [120, 290, 90, 34], [330, 290, 140, 34], [520, 290, 60, 34]] },
 heap_free: { n: 'FREE LIST', th: 'heap', st: 'chain', own: 'heap', hz: [], pr: [['lamp', 20, 20], ['lamp', 620, 380], ['link', 430, 111, 480, 111], ['link', 160, 241, 210, 241]],
  w: [[0, 100, 430, 22], [210, 230, 430, 22], [90, 320, 60, 40]] },
 heap_frag: { n: 'FRAGMENTATION', th: 'heap', st: 'frag', own: 'heap', pr: [['lamp', 620, 20], ['lamp', 20, 380]],
  w: [[70, 60, 40, 40], [180, 150, 60, 28], [260, 60, 28, 70], [380, 110, 50, 50], [500, 60, 60, 28], [110, 260, 70, 50], [300, 230, 50, 28], [430, 250, 40, 70], [540, 170, 28, 80], [220, 330, 80, 28]],
  hz: [[330, 330, 90, 40, 'lava'], [40, 160, 50, 70, 'lava']] },
 heap_gc: { n: 'GARBAGE COLLECTOR', th: 'heap', st: 'gc', own: 'heap', pr: [['lamp', 320, 20], ['lamp', 320, 380]],
  w: [[60, 60, 50, 50], [530, 60, 50, 50], [60, 290, 50, 50], [530, 290, 50, 50], [290, 170, 60, 60]],
  hz: [[150, 40, 30, 110, 'lava'], [460, 250, 30, 110, 'lava']] },
 // CITADEL 403 (it was Citadel Sentinel before the Fracture): a 960x560 stronghold. THE KEEP (x 0-718) is the maze; the sealed LAUNCH BAY 03 (x 718-960) is where the Segment Fault crashes in from.
 // The keep maze and the bulkhead door are installed dynamically by the boss (SEGFAULT.walls in data.js). The door is broken by the intro and never comes back, so the bay stays open as a hazard flank.
 // Relay nodes (non-solid) sit around the keep: they fire slow 3-round bursts and are also the Dead Zone Protocol's laser anchors.
 heap_boss: { n: 'CITADEL 403', th: 'heap', st: 'boss', own: 'segfault', W: 960, H: 560, bs: [470, 280], ps: [360, 482],
  nodes: [[70, 70], [650, 70], [50, 280], [670, 280], [110, 500], [610, 500]],
  pr: [['rack', 34, 34, 44, 30], ['rack', 640, 34, 44, 30], ['rack', 34, 496, 44, 30], ['rack', 640, 496, 44, 30], ['pipe', 20, 60, 20, 500], ['pipe', 940, 60, 940, 500],
   ['stripe', 686, 20, 14, 520], ['sign', 360, 548, 'CITADEL 403 // KEEP'], ['sign', 836, 548, 'LAUNCH BAY 03 // SEALED'], ['lamp', 740, 40], ['lamp', 920, 40], ['lamp', 740, 520], ['lamp', 920, 520]],
  w: [[868, 110, 24, 64], [868, 386, 24, 64]],
  hz: [[0, 0, 960, 20, 'lava'], [0, 540, 960, 20, 'lava'], [0, 0, 20, 560, 'lava'], [940, 0, 20, 560, 'lava'],
   [752, 56, 70, 56, 'lava'], [752, 448, 70, 56, 'lava'], [790, 186, 90, 28, 'slow'], [790, 346, 90, 28, 'slow']] },

 // ---------------- /dev/null (Layers 1-4, then Grid Lock for the Runtime Error) ----------------
 null_gap: { n: 'ERASED SECTOR', th: 'null', st: 'gap', own: 'null', pr: [],
  w: [[260, 120, 120, 18], [260, 262, 120, 18]],
  hz: [[200, 40, 80, 40, 'lava'], [360, 320, 80, 40, 'lava'], [40, 170, 40, 60, 'lava'], [560, 170, 40, 60, 'lava']] },
 null_dead: { n: 'DEAD LINKS', th: 'null', st: 'stairs', own: 'null', pr: [],
  w: [[100, 60, 80, 20], [180, 110, 80, 20], [260, 160, 80, 20], [340, 210, 80, 20], [420, 260, 80, 20], [500, 310, 80, 20]],
  hz: [[540, 40, 60, 60, 'lava'], [40, 300, 60, 60, 'lava']] },
 null_sink: { n: 'BIT BUCKET', th: 'null', st: 'sink', own: 'null', pr: [],
  w: [[140, 60, 24, 24], [476, 60, 24, 24], [140, 316, 24, 24], [476, 316, 24, 24]],
  hz: [[240, 140, 160, 120, 'lava']] },
 null_trunc: { n: 'TRUNCATED', th: 'null', st: 'trunc', own: 'null', pr: [],
  w: [[220, 60, 20, 120], [400, 220, 20, 120]],
  hz: [[0, 0, 110, 160, 'lava'], [0, 240, 110, 160, 'lava'], [530, 0, 110, 100, 'lava']] },
 // Runtime Error arena: the established Grid Lock wall layout is preserved exactly (teleport behaviour depends on it); only the look changed.
 gridlock: { n: 'GRID LOCK', th: 'null', st: 'grid', own: 'runtime', pr: [],
  w: [[120, 70, 20, 110], [500, 220, 20, 110], [250, 140, 140, 16], [250, 244, 140, 16], [120, 270, 110, 20], [410, 70, 110, 20]], hz: [] },

 // ---------------- NEXUS COMPLEX (Layers 1-4, then the Convergence Chamber) ----------------
 nexus_atrium: { n: 'ATRIUM CONCOURSE', th: 'nexus', st: 'campus', own: 'nexus', hz: [],
  pr: [['term', 300, 24], ['term', 340, 24], ['plant', 40, 40], ['plant', 600, 40], ['plant', 40, 360], ['plant', 600, 360], ['sign', 320, 388, 'WELCOME  //  NEXUS']],
  w: [[120, 90, 70, 36], [450, 90, 70, 36], [120, 274, 70, 36], [450, 274, 70, 36], [285, 170, 70, 60], [40, 170, 100, 16], [500, 170, 100, 16]] },
 nexus_lab: { n: 'ADVANCED LABORATORIES', th: 'nexus', st: 'lab', own: 'nexus', hz: [],
  pr: [['rack', 20, 20, 36, 28], ['rack', 584, 20, 36, 28], ['term', 40, 372], ['term', 600, 372], ['sign', 320, 388, 'LAB B // AUTHORISED STAFF']],
  w: [[110, 70, 420, 24], [110, 180, 160, 24], [370, 180, 160, 24], [110, 306, 420, 24]] },
 nexus_ward: { n: 'HOST RESEARCH WARD', th: 'nexus', st: 'ward', own: 'nexus',
  pr: [['stripe', 0, 0, 640, 8], ['stripe', 0, 392, 640, 8], ['sign', 320, 388, 'RESTRICTED // HOST RESEARCH'], ['cam', 320, 14]],
  w: [[60, 60, 100, 16], [60, 60, 16, 90], [144, 60, 16, 90], [480, 60, 100, 16], [480, 60, 16, 90], [564, 60, 16, 90], [60, 324, 100, 16], [60, 250, 16, 90], [144, 250, 16, 90], [480, 324, 100, 16], [480, 250, 16, 90], [564, 250, 16, 90]],
  hz: [[250, 176, 140, 48, 'slow']] },
 nexus_wing: { n: 'INTEGRATION WING', th: 'nexus', st: 'wing', own: 'nexus',
  pr: [['cam', 320, 14], ['crack', 330, 200, 50], ['sign', 320, 388, 'HOST INTEGRATION // SEALED'], ['pod', 92, 90], ['pod', 548, 90]],
  w: [[70, 120, 44, 160], [526, 120, 44, 160], [300, 180, 40, 40]],
  hz: [[150, 60, 340, 18, 'slow'], [150, 322, 340, 18, 'slow']] },
 // Race Condition arena: the final integration chamber. Twin containment pods, failed merge equipment, clear combat floor.
 nexus_boss: { n: 'CONVERGENCE CHAMBER', th: 'nexus', st: 'boss', own: 'race', hz: [],
  pr: [['pod', 88, 140], ['pod', 552, 140], ['crack', 320, 200, 90], ['crack', 200, 300, 40], ['cam', 320, 14], ['sign', 320, 388, 'MERGE PROTOCOL // FAILED']],
  w: [[62, 140, 52, 120], [526, 140, 52, 120], [0, 0, 70, 60], [570, 0, 70, 60], [0, 340, 70, 60], [570, 340, 70, 60]] },

 // ---------------- KERNEL (Layers 1-4; Layer 5 is a modular placeholder) ----------------
 kernel_gate: { n: 'SYSCALL GATE', th: 'kernel', st: 'gate', own: 'kernel', pr: [['vent', 60, 60], ['vent', 580, 340]],
  w: [[200, 0, 24, 150], [200, 250, 24, 150], [416, 0, 24, 150], [416, 250, 24, 150]], hz: [] },
 kernel_irq: { n: 'INTERRUPT VECTORS', th: 'kernel', st: 'spokes', own: 'kernel', pr: [['vent', 60, 340], ['vent', 580, 60]],
  w: [[308, 0, 24, 90], [308, 310, 24, 90], [0, 188, 90, 24], [550, 188, 90, 24], [290, 170, 60, 60]], hz: [] },
 kernel_sched: { n: 'SCHEDULER', th: 'kernel', st: 'ring', own: 'kernel', pr: [],
  w: [[200, 110, 70, 18], [200, 110, 18, 60], [370, 110, 70, 18], [422, 110, 18, 60], [200, 272, 70, 18], [200, 230, 18, 60], [370, 272, 70, 18], [422, 230, 18, 60]],
  hz: [[30, 30, 50, 50, 'lava'], [560, 320, 50, 50, 'lava']] },
 kernel_ring0: { n: 'RING ZERO', th: 'kernel', st: 'ring0', own: 'kernel', pr: [],
  w: [[290, 170, 60, 60], [120, 80, 30, 30], [490, 80, 30, 30], [120, 290, 30, 30], [490, 290, 30, 30]],
  hz: [[0, 185, 200, 30, 'lava'], [440, 185, 200, 30, 'lava'], [305, 0, 30, 110, 'lava'], [305, 290, 30, 110, 'lava']] },
 kernel_boss: { n: 'KERNEL CORE (PLACEHOLDER)', th: 'kernel', st: 'boss', own: 'kernel_ph', pr: [['vent', 60, 60], ['vent', 580, 60]],
  w: [[270, 160, 100, 80], [60, 60, 40, 14], [60, 60, 14, 40], [540, 60, 40, 14], [566, 60, 14, 40], [60, 326, 40, 14], [60, 300, 14, 40], [540, 326, 40, 14], [566, 300, 14, 40]], hz: [] },

 // ---------------- DEADLOCK (Layers 1-4; Layer 5 is a modular placeholder) ----------------
 deadlock_queue: { n: 'WAIT QUEUE', th: 'deadlock', st: 'queue', own: 'deadlock', pr: [],
  w: [[160, 0, 16, 250], [320, 150, 16, 250], [480, 0, 16, 250]],
  hz: [[176, 330, 130, 40, 'slow'], [336, 40, 130, 40, 'slow']] },
 deadlock_circ: { n: 'CIRCULAR WAIT', th: 'deadlock', st: 'cycle', own: 'deadlock', pr: [],
  w: [[200, 110, 40, 40], [400, 110, 40, 40], [400, 250, 40, 40], [200, 250, 40, 40]],
  hz: [[240, 120, 160, 20, 'slow'], [400, 150, 20, 100, 'slow'], [240, 260, 160, 20, 'slow'], [220, 150, 20, 100, 'slow']] },
 deadlock_mutex: { n: 'MUTEX VAULT', th: 'deadlock', st: 'vault', own: 'deadlock', pr: [],
  w: [[90, 60, 22, 110], [170, 60, 22, 110], [448, 230, 22, 110], [528, 230, 22, 110], [290, 175, 60, 50]],
  hz: [[112, 100, 58, 70, 'slow'], [470, 260, 58, 70, 'slow']] },
 deadlock_stand: { n: 'STANDOFF', th: 'deadlock', st: 'standoff', own: 'deadlock', pr: [],
  w: [[100, 130, 80, 140], [460, 130, 80, 140]], hz: [[250, 40, 140, 320, 'slow']] },
 deadlock_boss: { n: 'DEADLOCK CHAMBER (PLACEHOLDER)', th: 'deadlock', st: 'boss', own: 'deadlock_ph', pr: [],
  w: [[130, 150, 36, 100], [474, 150, 36, 100]], hz: [[220, 260, 200, 24, 'slow']] }
};
