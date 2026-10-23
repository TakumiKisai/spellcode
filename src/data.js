import { EXTRA_ARENAS } from './arenas.js';
// Spellcode Data Registry
export const RAR = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];
export const RC = ['#9d92b5', '#4fb860', '#3b95f0', '#b45cff', '#ffa81f'];

export const MUSIC = {
 boot:{file:'boot_sector.mp3',gain:1,start:0,end:79.96},
 deadlock:{file:'deadlock.mp3',gain:1,start:.45,end:59.01},
 heap:{file:'the_heap.mp3',gain:1,start:0,end:116.09},
 null:{file:'devnull.mp3',gain:1,start:1.03,end:217.94},
 kernel:{file:'kernel.mp3',gain:1,start:0,end:94.62},
 generated:{file:'generated.ogg',gain:1,start:0,end:65.2},
 generated1:{file:'generated1.ogg',gain:1,start:0,end:52.2},
 segfault:{file:'segfault.mp3',gain:1,start:.1,end:197.09},
 leak:{file:'memory_leak.mp3',gain:1,start:.38,end:238.29},
 runtime:{file:'runtime_error.mp3',gain:1,start:.77,end:295.67},
 race:{file:'race_condition.mp3',gain:1,start:0}, // loops the whole track; add end:<seconds> or start:<seconds> to trim silence
 nexus:{file:'nexus_complex.mp3',gain:1,start:0,fb:'generated'}, // add audio/nexus_complex.mp3 when the track exists; until then the generated-world track plays
 title:{file:'localhost.mp3',gain:1,start:0,end:53.43},
 overtime:{file:'overtime.ogg',gain:1,start:0,end:61.3},
 gameover:{file:'game_over.mp3',gain:1,start:1.21,end:189.21},
 win:{file:'win.mp3',gain:1,start:0,end:143.85}
};

export const SPELLS = {
 fireball:{n:'fireball()',d:'Aimed shot',r:0,k:'proj',dmg:13,rate:1,sp:290,rad:5,pierce:0,col:'#ff7a45'},
 bolt:{n:'bolt()',d:'Fast shot, pierces 2',r:0,k:'proj',dmg:7,rate:1.82,sp:360,rad:4,pierce:2,col:'#5ee0d0'},
 lance:{n:'lance()',d:'Slow cast, pierces everything',r:1,k:'proj',dmg:32,rate:.455,sp:580,rad:6,pierce:99,col:'#e2b24a'},
 nova:{n:'nova()',d:'Ring blast + knockback around you',r:0,k:'nova',dmg:13,rate:.455,rad:92,knock:120,col:'#b48cff'},
 chain:{n:'chain()',d:'Lightning jumps between bugs (3 jumps; reduced damage to bosses)',r:1,k:'chain',dmg:11,rate:.909,rad:180,jumps:3,col:'#ffe066'},
 orbit:{n:'orbit()',d:'Blades circle you for 4s',r:2,k:'orbit',dmg:7,rate:.2,col:'#8ae0ff'},
 mine:{n:'mine()',d:'Drops a delayed explosion',r:1,k:'mine',dmg:36,rate:.417,rad:72,col:'#ff5c7a'},
 stdout:{n:'stdout()',d:'Flame cone (range 125), burns',r:1,k:'cone',dmg:7,rate:3.333,col:'#ff7a45',burn:1},
 ping:{n:'ping()',d:'Instant beam, pierces everything',r:1,k:'beam',dmg:15,rate:.769,col:'#8ae0ff'},
 rm:{n:'rm()',d:'Wide melee sweep, huge knockback',r:1,k:'melee',dmg:24,rate:.909,knock:260,col:'#ffd23f'},
 shield:{n:'shield()',d:'+14 MAX shield this fight (it does not refill; shield regenerates on its own)',r:0,k:'self',shv:14,rate:.25,col:'#5ee0d0'}
};

export const MODS = {
 for:{n:'for(2)',r:0,d:'Cast twice',h:'+ homing, explode',f:(a,l)=>{a.rep+=l}},
 async:{n:'async',r:0,d:'Fire rate x1.82, damage -15%',h:'+ for(2), fork()',f:(a,l)=>{a.rate*=[1.82,2.38,2.94][l-1]||2.94;a.dmg*=.85}},
 map:{n:'map()',r:1,d:'3-way spread, -25% dmg each, +30% area',h:'+ pierce(), burn',f:(a,l)=>{a.pc=(a.pc>1?a.pc:1)+2*l;a.dmg*=.75;a.area*=1.3}},
 overflow:{n:'overflow',r:1,d:'x2 damage, fire rate x0.67',h:'+ lance(), mine()',f:(a,l)=>{a.dmg*=[2,2.6,3.2][l-1]||3.2;a.rate/=1.5}},
 try:{n:'try{}',r:0,d:'Each cast grants +5 shield',h:'+ async, Garbage Collector',f:(a,l)=>{a.sh+=5*l}},
 homing:{n:'homing',r:1,d:'Shots steer gently (v3 turns sharply), -10% dmg',h:'+ map(), ricochet',f:(a,l)=>{a.home=l;a.turn=[.65,1.4,5][l-1]||5;a.dmg*=.9}},
 bounce:{n:'ricochet',r:1,d:'Shots bounce off walls 3x',h:'+ pierce(), pillars arenas',f:(a,l)=>{a.bounce+=3*l}},
 pierce:{n:'pierce()',r:1,d:'+2 pierce, +2 chain jumps',h:'+ map(), ricochet',f:(a,l)=>{a.pierce+=2*l;a.jumps+=2*l}},
 explode:{n:'explode()',r:2,d:'Hits blast nearby bugs for 60%',h:'+ big, knockback',f:(a,l)=>{a.expl=l}},
 split:{n:'fork()',r:2,d:'Hits split into 2 weaker shots',h:'+ for(2), explode',f:(a,l)=>{a.split=l}},
 big:{n:'malloc()',r:1,d:'Slightly bigger and slower, +15% dmg, +12% area',h:'+ explode, Stack Overflow',f:(a,l)=>{for(let i=0;i<l;i++){a.size*=1.2;a.sp*=.9;a.dmg*=1.15;a.area*=1.12}}},
 burn:{n:'burn',r:1,d:'Burn for 40% damage over 3s',h:'+ map(), async',f:(a,l)=>{a.burn=l}},
 freeze:{n:'freeze',r:2,d:'Hits slow bugs 45%',h:'+ nova(), mine()',f:(a,l)=>{a.freeze=l}},
 knock:{n:'push()',r:1,d:'Knockback on hit',h:'+ pillars, void arenas',f:(a,l)=>{a.knock+=130*l}},
 leech:{n:'leech()',r:2,d:'Hits heal up to 5% of damage dealt',h:'+ async, for(2)',f:(a,l)=>{a.leech=l}},
 pull:{n:'gravity()',r:3,d:'Hits pull nearby bugs in (stronger at higher versions)',h:'+ explode, nova()',f:(a,l)=>{a.pull=l}},
 sudo:{n:'sudo',r:4,d:'Every hit is a critical. Fire rate x0.63',h:'+ overflow, lance()',f:(a,l)=>{a.crit=l;a.rate/=1.6}}
};

export const ALL = ['proj','nova','chain','orbit','mine','cone','beam','melee'];
export const COMPAT = {
 for:[...ALL,'self'],async:[...ALL,'self'],try:[...ALL,'self'],big:[...ALL,'self'],
 map:['proj','beam','orbit','cone','melee'],overflow:ALL,homing:['proj'],bounce:['proj'],
 pierce:['proj','chain'],explode:['proj'],split:['proj'],burn:ALL,freeze:ALL,knock:ALL,
 leech:ALL,pull:['proj'],sudo:ALL
};
// Every Host regenerates shield slowly after `delay` seconds without damage (a bit faster with combat mode OFF). Debugger keeps its own, faster regen (ST.regen).
// The energy barrier is the DEBUGGER's one-hit outline shield (its passive regen is nerfed to pay for it): it negates a single hit, shatters, and comes back after `barrierRegen` seconds. Skills will be able to call restoreBarrier().
export const PLAYER_SHIELD = { delay: 5, debuggerDelay: 3, regen: .9, idleMul: 1.6, maxBonus: 16, barrierRegen: 30 };
export const KN = {proj:'shots',nova:'nova',chain:'chain',orbit:'orbit',mine:'mines',cone:'flames',beam:'beams',melee:'melee',self:'shield/heal'};

export const UPG = {
 dmg:{n:'Optimizer',r:0,m:3,d:'+18% damage',f:s=>{s.dmg*=1.18}},
 cdr:{n:'Cache',r:0,m:3,d:'+12% fire rate',f:s=>{s.rate*=1.12}},
 spd:{n:'Hot Path',r:0,m:3,d:'+12% move speed',f:s=>{s.spd*=1.12}},
 hp:{n:'Redundancy',r:0,m:3,d:'+14 max HP',f:s=>{s.hpa+=14}},
 shl:{n:'Firewall',r:0,m:2,d:'Max shield +15, shield spells +40%',f:s=>{s.shmax+=15;s.shm*=1.4}},
 crit:{n:'Branch Predictor',r:1,m:3,d:'+15% crit chance (crit = x2)',f:s=>{s.crit+=.15}},
 dash:{n:'Fast Interrupt',r:1,m:2,d:'Dash cooldown -30%',f:s=>{s.dashcd*=.7}},
 gc:{n:'Garbage Collector',r:1,m:2,d:'Kills grant +1 shield per rank (max +8 per rank per fight)',f:s=>{s.gc++}},
 hot:{n:'Hot Reload',r:2,m:1,d:'Fire rate +50% while moving, -20% while standing still',f:s=>{s.mv+=.5;s.still+=.2}},
 over:{n:'Overclock',r:2,m:1,d:'Every 3rd cast fires an extra copy. Fire rate x0.83',f:s=>{s.over=1;s.rate/=1.2}},
 glass:{n:'Glass Compiler',r:2,m:1,d:'+100% damage, max HP -40%',f:s=>{s.dmg*=2;s.hpm*=.6}},
 recur:{n:'Recursive Call',r:2,m:1,d:'Every 5th cast repeats automatically',f:s=>{s.recur=1}},
 par:{n:'Parallel Processing',r:2,m:2,d:'+1 build slot, -10% damage',f:s=>{s.slots++;s.dmg*=.9}},
 proxy:{n:'Reflective Proxy',r:2,m:1,d:'Breaking your shield releases a nova',f:s=>{s.proxy=1}},
 leak:{n:'Memory Leak',r:3,m:1,d:'Spell damage +2.5%/s during a round (max +150%). Bugs speed up 1.2%/s',f:s=>{s.leak=1}},
 stack:{n:'Stack Overflow',r:3,m:1,d:'Each modifier on a spell: +10% damage, +2% size (max +16%)',f:s=>{s.stack=1}},
 dead:{n:'Dead Code',r:3,m:1,d:'25% per cast: a random extra modifier triggers',f:s=>{s.chaos+=.25}},
 null:{n:'Null Reference',r:4,m:1,d:'Dash phases through danger: long i-frames and a damaging trail',f:s=>{s.nullref=1}},
 panic:{n:'Kernel Panic',r:4,m:1,d:'Kills explode for 50% of that bug\'s max HP',f:s=>{s.panic=1}},
 fork:{n:'Fork Bomb',r:4,m:1,d:'15% per cast: repeats that spell’s full execution. Max HP -20%',f:s=>{s.fork=1;s.hpm*=.8}}
};

// UNO-Style Starting Decks: plenty of basic duplicates, rare power cards
export const HOSTS = {
 compiler:{
  n:'THE COMPILER',hp:60,
  start:'fireball fireball fireball fireball bolt bolt bolt shield shield shield for for for async async try try overflow',
  d:'Balanced. Each modifier on a spell increases its fire rate 3%.',w:'No weakness. No edge either.',
  g:'$',c:'#e2b24a',j:['#ffd34a','#ff9a1f','#fff6cf'],
  f:s=>{s.compiler=1}
 },
 overclock:{
  n:'THE OVERCLOCKER',hp:42,
  start:'bolt bolt bolt bolt bolt chain chain shield shield shield async async async async for for for homing map ping lance',
  d:'Casts 35% faster while moving.',w:'Low HP. Standing still is slow.',
  g:'%',c:'#ff7a45',j:['#ff7a45','#ff3b1f','#ffe066'],
  f:s=>{s.mv+=.35;s.still+=.1}
 },
 debugger:{
  n:'THE DEBUGGER',hp:72,
  start:'fireball fireball fireball shield shield shield shield shield try try try try for for pierce bounce nova',
  d:'Shield regenerates fast (2.4/s) after 3s without damage.',w:'-15% damage.',
  g:'@',c:'#5ee0d0',j:['#5ee0d0','#22b8f0','#e6fffb'],
  f:s=>{s.regen=2.4;s.dmg*=.85}
 },
 glitch:{
  n:'THE GLITCH',hp:55,
  start:'fireball fireball fireball bolt bolt bolt nova nova chain chain homing homing explode explode async async for for split mine',
  d:'30% of casts gain a random extra modifier.',w:'Fire rate -9%. Chaos.',
  g:'&',c:'#ff5ca8',j:['#ff5ca8','#b84dff','#ffe0f0'],
  lt:'Reach layer 4',cost:25,f:s=>{s.chaos+=.3;s.rate/=1.1}
 },
 archivist:{
  n:'THE ARCHIVIST',hp:58,
  start:'fireball fireball fireball fireball bolt bolt bolt bolt nova nova shield shield shield chain chain for for for async async async map map try try homing explode',
  d:'8-card hands, 5 slots, bigger deck.',w:'-20% damage.',
  g:'¶',c:'#b48cff',j:['#b48cff','#5c6cff','#f0e8ff'],
  lt:'Win a run',cost:40,f:s=>{s.slots++;s.hand+=2;s.dmg*=.8}
 },
 admin:{
  n:'THE ADMIN',hp:300,admin:1,
  start:'fireball fireball fireball bolt bolt lance nova chain orbit mine ping shield for for async async map try homing bounce pierce explode split big burn freeze knock leech pull sudo overflow',
  d:'TEST HOST (not lore accurate). Everything unlocked, huge stats.',w:'Sandbox only.',
  g:'#',c:'#ffffff',j:['#ffffff','#7ee8ff','#ffe066'],
  f:s=>{s.slots+=3;s.hand+=4;s.dmg*=3;s.rate*=1.4;s.regen=30;s.mv+=.3}
 }
};

export const DK = {
 slot:{n:'Extra Register',r:2,d:'+1 build slot (max 2)'},
 hand:{n:'Bigger Cache',r:1,d:'+1 hand size'},
 heal:{n:'Hotfix',r:0,d:'Restore 50% HP'}
};

export const WORLDS = {
 // ar = the four ordinary rooms (Layers 1-4). ordered:1 = Layer N uses ar[N-1] (distinct purpose per layer); otherwise a random room each layer.
 // boss = the Layer 5 boss for this sector. pref = enemy weights (flavour: which bugs this sector favours).
 boot:{n:'Boot Sector',g:'>_',c:['#9af5a0','#2f9e5a'],ar:['open','pillars','cross','ring'],boss:'leak'},
 deadlock:{n:'Deadlock',g:'*',c:['#7fe8ff','#3b6bff'],ar:['deadlock_queue','deadlock_circ','deadlock_mutex','deadlock_stand'],ordered:1,boss:'deadlock_ph',pref:{shielder:3,tank:2,warden:3,chain:3,shooter:1.5}},
 heap:{n:'The Heap',g:'{}',c:['#d4f56a','#4fb860'],ar:['heap_alloc','heap_free','heap_frag','heap_gc'],ordered:1,boss:'segfault',pref:{splitter:3,summoner:2,swarm:2,leech:1.5,tank:1.5}},
 null:{n:'/dev/null',g:'::',c:['#e0b8ff','#6a3bd6'],ar:['null_gap','null_dead','null_sink','null_trunc'],ordered:1,boss:'runtime',pref:{glitch:3,nullifier:3,dasher:2}},
 kernel:{n:'Kernel',g:'#!',c:['#ffb02e','#ff4d3a'],ar:['kernel_gate','kernel_irq','kernel_sched','kernel_ring0'],ordered:1,boss:'kernel_ph',pref:{interrupt:3,daemon:2.5,dasher:2,shooter:1.5}},
 nexus:{n:'Nexus Complex',g:'[]',c:['#eaf6ff','#3fa9d6'],ar:['nexus_atrium','nexus_lab','nexus_ward','nexus_wing'],ordered:1,boss:'race',pref:{shooter:2.5,shielder:2.5,tank:2,leech:1.5,glitch:1.5}}
};
for(const k in WORLDS) WORLDS[k].key = k;

export const EN = {
 chaser:{g:'ж',c:'#ff7a45',hp:16,sp:64,r:10,dmg:7,cost:1,from:1,i:'Runs straight at you'},
 swarm:{g:'·',c:'#ff9a6a',hp:5,sp:96,r:6,dmg:3,cost:.35,from:1,i:'Weak, arrives in packs'},
 shooter:{g:'◈',c:'#b48cff',hp:12,sp:46,r:9,dmg:6,cost:1.5,from:2,beh:'shoot',i:'Keeps distance, fires'},
 dasher:{g:'»',c:'#ffd23f',hp:18,sp:50,r:10,dmg:11,cost:1.6,from:3,beh:'dash',i:'Flashes, then charges'},
 splitter:{g:'Ø',c:'#6fe0a0',hp:26,sp:50,r:12,dmg:7,cost:1.6,from:3,beh:'split',i:'Splits into swarm on death'},
 tank:{g:'█',c:'#d0507a',hp:95,sp:32,r:17,dmg:14,cost:3.2,from:4,i:'Armored (-6 per hit): rapid weak hits barely hurt it. Slow, huge HP'},
 glitch:{g:'¤',c:'#5ee0d0',hp:12,sp:60,r:9,dmg:6,cost:1.3,from:4,beh:'tp',i:'Teleports, stalls a spell on hit'},
 leech:{g:'§',c:'#e04aa0',hp:16,sp:72,r:9,dmg:4,cost:1.5,from:5,beh:'leech',i:'Drains shield/HP and heals'},
 shielder:{g:'◎',c:'#4aa8ff',hp:28,sp:38,r:11,dmg:5,cost:2,from:5,beh:'aura',i:'Allies near it take 45% less'},
 summoner:{g:'Ψ',c:'#ff5ca8',hp:42,sp:30,r:12,dmg:5,cost:3,from:6,beh:'summon',i:'Keeps spawning swarm'},
 interrupt:{g:'ǂ',c:'#ffb02e',hp:14,sp:68,r:8,dmg:5,cost:1.8,from:1,wk:['kernel'],beh:'spread',sh:'tri',i:'Kernel only. Fast flanker that strafes and fires a 3-way spread'},
 daemon:{g:'⎔',c:'#ff7a3a',hp:46,sp:0,r:13,dmg:6,cost:2.6,from:1,wk:['kernel'],beh:'spin',sh:'oct',i:'Kernel only. Stationary turret: a rotating pair of shots. Walk the gaps'},
 warden:{g:'✛',c:'#9fe8ff',hp:22,sp:40,r:10,dmg:6,cost:2,from:1,wk:['deadlock'],beh:'cross',sh:'cross',i:'Deadlock only. Holds its distance and fires + then x volleys'},
 chain:{g:'⛓',c:'#bfe8ff',hp:20,sp:46,r:9,dmg:6,cost:1.4,from:1,wk:['deadlock'],beh:'link',sh:'dia',i:'Deadlock only. Comes in tethered pairs: do not cross the chain. Kill one and the other panics'},
 nullifier:{g:'∅',c:'#a99fc0',hp:22,sp:56,r:10,dmg:5,cost:2,from:6,beh:'null',i:'Disables a spell for 4s on hit'}
};

export const ARENAS = {
 open:{n:'OPEN FIELD',w:[],hz:[]},
 pillars:{n:'PILLARS',w:[[150,90,44,44],[446,90,44,44],[150,266,44,44],[446,266,44,44],[298,176,44,44]],hz:[]},
 cross:{n:'CROSSROADS',w:[[0,0,190,110],[450,0,190,110],[0,290,190,110],[450,290,190,110]],hz:[]},
 ring:{n:'THE RING',w:[[250,140,140,100]],hz:[[170,56,300,28,'slow'],[170,316,300,28,'slow']]},
 void:{n:'THE VOID',w:[],hz:[[0,0,640,26,'lava'],[0,374,640,26,'lava'],[0,0,26,400,'lava'],[614,0,26,400,'lava']]},
 grid:{n:'GRID FIELD',w:[[120,70,20,110],[500,220,20,110],[250,140,140,16],[250,244,140,16],[120,270,110,20],[410,70,110,20]],hz:[]},
 hot:{n:'HOT ZONE',w:[[300,110,40,170]],hz:[[110,150,100,100,'lava'],[430,150,100,100,'lava']]},// Memory Leak boss room: dedicated 800x500 lab with central containment, defensive perimeter, and flanking spawn bays.
 lab:{n:'CORRUPTED RESEARCH LAB',boss:1,W:800,H:500,bs:[400,250],ps:[400,445],
  w:[[60,30,170,34],[570,30,170,34],[60,436,170,34],[570,436,170,34],[118,208,40,84],[642,208,40,84],[292,148,26,26],[482,148,26,26],[292,326,26,26],[482,326,26,26]],hz:[],
  z:{c:[400,250],rc:112,rp:215,bays:[[84,130],[84,370],[716,130],[716,370]]}}
};

Object.assign(ARENAS, EXTRA_ARENAS);
for (const k in ARENAS) ARENAS[k].key = k;

// Race Condition boss tuning (all values are easy to adjust for balancing).
export const RACE = {
 splitAt: .5,      // merged phase ends at this fraction of Phase 1 max HP
 twinHp: .5,       // each twin's max HP, as a fraction of the original Phase 1 max HP
 splitTime: 1.7,   // mitosis animation length (the boss is protected meanwhile)
 gap: .85,         // minimum seconds between the two processes' damaging moments
 twinCd: .85,      // post-split attack cooldown multiplier (lower = faster)
 red: '#ff4d5a', blue: '#4d8dff',
 dash: { cd: [2.0, 3.0], tele: .85, lock: .36, t: .34, sp: 480, dmg: 16 },
 shoot: { cd: [2.6, 3.8], tele: .85, lock: .36, n: 7, spread: .17, sp: 300, dmg: 9, zones: 2, zr: 50, zdmg: 12, burst: { n: 3, gap: .2, spread: .09, sp: 270, dmg: 7 } }, // shotgun was sp 135 / 5 pellets; burst = new BURST STREAM (3 tight volleys)
 snipe: { tele: .8, lock: .26, dmg: 12, w: 9, life: .3 },                                  // precision BEAM: targeting line tracks you, locks .26s before firing, then an instant beam (Orbit cannot block it)
 mutex: { reduce: .3, dur: .5, grow: 2, handover: 9, cd: 9, transit: .6 },                 // lock holder takes 30% damage; shield = dur x twin max HP (raw dmg), doubles each re-form
 tether: { dmg: 8, cd: .6, arm: 1.5, w: 3 },                                               // line between the twins
 collide: { grow: 1.5, dmg: 1.3 },                                                         // red dash through a blue marker: bigger, harder
 merge: { speed: 1.25, cd: .8 },                                                           // survivor after one twin dies
 lead: .45,                                                                                // blue aims this many seconds ahead of your movement
 pincer: 62,                                                                               // (legacy) flanking marker distance
 // Phase 1 (the combined boss) pressure
 p1: { cd: .6, sp: 1.35, gap: .68, still: 1.0, echo: .45, orbit: .55 },                    // cooldown mult, speed mult, min gap between damaging moments, seconds standing still before it punishes, double-dash chance, sniper bias while Orbit is out
 // AoE 1, ALTERNATING WRITES: a checkerboard of squares around where you're heading. Red squares pop first, blue squares pop one beat later: step onto the other colour between beats.
 grid: { cell: 56, span: 2, tele: 1.1, beat: .78, dmg: 13 },
 // AoE 2, STACK TRACE: after every red dash it leaves numbered frames along the lane that detonate one after another, racing away from the dash start.
 stack: { n: 5, step: 48, r: 30, dmg: 12, delay: .42, fuse: .17 }
};

// Memory Leak army / PRISM tuning (all values are prototypes: OP first, nerf later).
export const LEAK = {
 cap: 34,            // ordinary Fragments + Shards alive at once; with 3 Cores and 5 special enemies, the encounter cap is 42
 coreCap: 3,         // ordinary Cores alive at once
 t: {
  frag:  { hp: 12, r: 6,  sp: 122, dmg: 8, c: '#d2ff3d', g: '▴' },
  shard: { hp: 35, r: 9,  sp: 45,  dmg: 4, c: '#3dffc4', g: '◆' },
  core:  { hp: 90, r: 15, sp: 30,  dmg: 8, c: '#39d35f', g: '✺' }
 },
 variants: {
  frag: { sapper: { chance: .14, hp: .8, sp: .82, dmg: .75, c: '#a6f06b', range: 180, tele: .4, cd: 5, beamDmg: 6 } },
  shard: {
   lance: { chance: .2, hp: .8, sp: .9, dmg: .8, c: '#3dffc4', projectileDmg: 4, projectileSpeed: 215, volleyCd: 3.8 },
   scatter: { chance: .2, hp: .8, sp: .9, dmg: .8, c: '#4d8dff', projectileDmg: 2, projectileSpeed: 155, volleyCd: 4.5, spread: .68, count: 5 }
  }
 },
 mainFrag: { hp: 150, r: 9, sp: 112, dmg: 10, boost: 1.08, turn: 3.6 }, // was sp 165 with a 1.2x close-range boost: toned down so the rush can be read and dodged,
 mainShard: { hp: 240, r: 12, sp: 52, dmg: 5 },
 mainCore: { r: 13, orbit: 52, spin: 1.15, recover: .7, beamRange: 96, beamCd: 6, beamTele: 1.15, beamLock: .3, beamDmg: 16, beamLen: 340,
  // Stagger: blocked hits build hidden pressure (a hit's would-be damage / ref, clamped to min..max so weak spam and huge hits both stay fair, and capped at perSec so fast multi-hit builds can't trivialise it). At threshold the Core is stunned for `time` seconds (no orbit, no blocking, no beam), then locked out of building pressure for `lockout` seconds.
  stagger: { threshold: 9, ref: 12, min: .4, max: 2.5, perSec: 5, decay: .9, decayDelay: 1.2, time: 5, lockout: 15, warn: .6, alert: .85 } }, // spin = max orbit speed (rad/s, was ~8); beamRange = 4 Shaped Hosts (a Host is ~24px); recover = slow-down after it blocks a shot,
 density: { ring: .78, nova: .75, volleyGap: .9 }, // Memory Leak only: boss ring bullet count x .78, Core corruption nova x .75, and at least `volleyGap` seconds between boss ring/aim volleys. Shard / Main Shard bursts are NOT changed
 sigstop: { time: 5 }, // SIGSTOP: seconds ordinary minion spawning is suspended after the army is wiped
 evo: { need: { frag: 40, shard: 100 }, passive: 1.4, area: 16, areaR: 80, areaT: 9, maxAreas: 4, aReach: 270, bReach: 340 },
 spawnTele: .85, spawnIntro: 1.5, // seconds of warning before a minion appears (ordinary spawns / the opening wave) // aReach/bReach: how far Squad A (from the boss) / Squad B (from itself) will walk to use a hotspot (movement only: evolution requirements unchanged) // passive rate only applies to Squad A; areas speed up anyone eligible
 squadA: .4,         // share of the ordinary army kept on defence
 disable: { base: 2.4, extra: 3.2, cards: 1, moreCards: 2, cd: 3.5 }, // Main Fragment contact: disable duration, bonus when the army is depleted, cards disabled, cooldown
 prism: { hp: 950, shield: 950, shDelay: 2, interrupt: { dmg: .1, win: 1.5, cd: 1.6, immune: 5 }, // 25% less combined durability than before (900 + 260). shDelay = seconds shield can't regenerate after any hit. interrupt: damage worth `dmg` x (hp+shield) inside `win` seconds briefly breaks the healing beam (it can try again after `cd`; it can't be interrupted again for `immune` seconds)
  red: .6, heal: 55, bossHeal: .012, hps: .16, bossHps: .006, healDur: 5, breakRange: 430, healCd: 2.4, tele: .6, corrCd: 3.2, corrTele: .65, meter: 100, gain: .35, shGain: .8, r: 14, sp: 52 },
 meteor: { tele: 1.6, r: 54, dmg: 16, n: [1, 2, 2], spread: 100, stagger: .45, k: .6, fall: 560 } // CORE DUMP: NECROPOST calls down n[phase] meteors; each leaves an evolution hotspot of strength k
};

export const SEGFAULT = {
 plates: {
  hp: 600, radius: 27, resist: {
   front: { projectile: .5 },
   left: { energy: .5 },
   right: { energy: .5 },
   back: { impact: .5 }
  }
 },
 volleyTelegraph: .42,
 walls: [
  // THE KEEP: broad lanes, many openings, no dead ends. Walls are deliberately different lengths and shapes (long runs, short stubs, L-corners, a T, slabs).
  // Normal walls regenerate slowly; holo panels break in one hit and come back fast; steel is unbreakable (Segment Fault crashes into it).
  { x: 90, y: 96, w: 250, h: 18, type: 'normal' }, { x: 450, y: 96, w: 130, h: 18, type: 'normal' }, { x: 580, y: 96, w: 18, h: 96, type: 'normal' },
  { x: 96, y: 190, w: 18, h: 140, type: 'normal' }, { x: 190, y: 214, w: 84, h: 18, type: 'normal' },
  { x: 420, y: 196, w: 160, h: 18, type: 'normal' }, { x: 491, y: 214, w: 18, h: 30, type: 'normal' },
  { x: 612, y: 300, w: 18, h: 110, type: 'normal' },
  { x: 120, y: 430, w: 90, h: 18, type: 'normal' }, { x: 210, y: 340, w: 18, h: 108, type: 'normal' }, { x: 380, y: 430, w: 200, h: 18, type: 'normal' },
  { x: 345, y: 236, w: 18, h: 52, type: 'holo' }, { x: 300, y: 130, w: 18, h: 40, type: 'holo' }, { x: 520, y: 372, w: 44, h: 14, type: 'holo' },
  { x: 150, y: 236, w: 26, h: 60, type: 'steel' }, { x: 540, y: 250, w: 56, h: 24, type: 'steel' }, { x: 300, y: 380, w: 30, h: 30, type: 'steel' },
  // BULKHEAD between the keep and the launch bay. The door is breached by the intro and never regenerates; its frame panels regenerate like any other wall.
  { x: 700, y: 20, w: 18, h: 190, type: 'normal' }, { x: 700, y: 350, w: 18, h: 190, type: 'normal' },
  { x: 700, y: 210, w: 18, h: 140, type: 'door' }
 ],
 phase2: {
  homing: { cooldown: 9, speed: 195, speedMul: [.88, 1, 1.2], damage: 13, turn: .8, telegraph: .85, evadeLock: .65, evadeRadius: 145 },
  barrage: { cooldown: 16, telegraph: 1.1, speed: 190, damage: 10, farDistance: 330, hysteresis: 90 },
  stdoutV3: { distance: 175, cooldown: 12, telegraph: 1.05, range: 440, width: 14, damage: 12, grow: .3, half: .06 }, // grow = seconds the flame front takes to reach full length; half = flame half-angle
  wallRegen: 14, hologramRegen: 4
 },
 phase3: {
  overload: { threshold: 100, durability: 1200, cooldown: 5.5, regenDelay: 4, telegraph: .8, absorbingArmor: 2, cooldownArmor: 12 },
  dashCooldown: 9, dashLength: 320, stdoutV2: { duration: .48, damage: 16, width: 22, grow: .16, half: .15 },
  stack: { cooldown: 18, telegraph: 1.35, routes: 3, trail: 3.4, length: 280, grow: .2, half: .07 }
 },
 deadZone: { cooldown: 18, warning: 3, active: 4.5, damage: 18 },
 // Relay turrets: each node charges (telegraph), then fires a slow burst. Indexed by boss phase. Nodes that anchor a Dead Zone line stop shooting until the protocol ends.
 // Fuel tanks on his back (they replaced the back plate): jetpack dashes and the close-range stdout burn fuel; a hit from behind damages the tanks. A ruptured tank stuns him, but he takes much less damage while he is down.
 fuel: { tankHp: 140, dashCost: .34, minDash: .34, refuel: .055, rupturedFix: 12, stun: 3.2, stunReduction: .45, blast: .04, blastRadius: 80, blastHurt: 10 },
 // Segment Fault chases faster each phase (the passive jet in phase 2 (blue) and 3 (purple) shows it)
 speed: [1, 1.18, 1.4],
 // Hacking QTE: press the numbered keys in the order shown (I = 1 ... IV = 4). len = sequence length per phase, time = seconds, penalty = seconds lost on a miss.
 qte: { len: [3, 4, 5], time: 4.5, penalty: .6, cooldown: 3 },
 // Close-range stdout (the Host's stdout card flames): v1 / v2 / v3 by phase. Used when the Host is near; costs fuel.
 flame: { trigger: [150, 175, 200], range: [130, 150, 175], half: .5, telegraph: .14, duration: [.9, 1, 1.15], cooldown: [6.5, 5.2, 4], damage: [4, 5, 6], tick: .22, drain: .24, track: 1.1, minFuel: .16 },
 relay: { hackRadius: 38, hackTime: 2.2, cooldown: [6.8, 5.4, 4.2], telegraph: .8, burst: 3, gap: .34, speed: 74, damage: 7, spread: [0, 0, .09], maxBusy: 2 },
 // Entrance: Segment Fault launches from LAUNCH BAY 03, breaks through the bulkhead door, skids into the keep, scans the Host, then the dialogue starts (all times in seconds).
 intro: { bay: [862, 280], hit: [742, 280], land: [470, 280], dashAt: 1.7, hitAt: 2.4, skidEnd: 3.7, dlgAt: 5.0, out: 1.2 }
};

export const BOSSES = {
 segfault:{n:'SEGMENT FAULT',hp:12000,r:24,sp:28,arena:'heap_boss',track:'segfault',g:'Ж',c:'#ff5c7a',i:'A corrupted mech hunts an unauthorized Host through the foundry.',ph:[{ring:5.8,zone:7.5},{ring:4.8,zone:8.5,summon:10},{ring:4.2,zone:7.5,aim:4.8,summon:9}]},
 leak:{n:'THE MEMORY LEAK',hp:6000,fixed:1,army:1,r:22,sp:24,arena:'lab',track:'leak',g:'Ө',c:'#7ddc6f',grow:1,i:'Commands an evolving corrupted army (Fragment, Shard, Core) shielded by an orbiting Main Core. NECROPOST calls down CORE DUMP meteors; PRISM appears below half health and must be destroyed before the boss can be killed.',ph:[{aim:2.4,summon:6},{aim:1.9,ring:4.5,summon:5,dump:15},{aim:1.5,ring:3.2,summon:4,dump:11}]},
 runtime:{n:'THE RUNTIME ERROR',hp:14000,r:22,sp:22,arena:'gridlock',track:'runtime',g:'Ξ',c:'#b48cff',i:'Marks where it will land, then teleports next to you, corrupting any wall it cuts through. Corrupted walls spit prisms and reflect its beam; wall satchels detonate when you touch the wall. Exposed after each jump.',ph:[{tp:4.2,aim:3,zone:4.4,satchel:7,det:6.5,prism:12,sweep:8.5,recall:13},{tp:3.2,aim:2.4,zone:3,ring:4.8,satchel:7.5,det:5.5,prism:9.5,fork:6.5,recall:10.5,nullp:14},{tp:2.5,aim:1.9,zone:2.2,ring:3.8,summon:6.5,satchel:6,det:4.5,prism:7.5,panic:10.5,recall:8.5,nullp:11}]},
 race:{n:'THE RACE CONDITION',hp:17000,r:22,sp:28,arena:'nexus_boss',track:'race',g:'‖',c:'#ff4d5a',race:1,i:'Two processes race to hit you first. Splits into a red and a blue Host at half health: defeat both.'},
 // PLACEHOLDER bosses (Kernel and Deadlock): the real bosses and stories are undecided. These only use the existing pattern engine; replace the entry (or point WORLDS.<sector>.boss elsewhere) when the real boss exists.
 kernel_ph:{n:'UNASSIGNED PROCESS [KERNEL]',hp:2200,r:22,sp:26,arena:'kernel_boss',track:'runtime',placeholder:1,g:'#',c:'#ff9a3c',i:'Placeholder. Final Kernel boss undecided.',ph:[{ring:3.6,aim:2.8},{ring:2.8,aim:2.2,summon:7},{ring:2.2,aim:1.7,summon:5.5}]},
 deadlock_ph:{n:'UNASSIGNED PROCESS [DEADLOCK]',hp:2000,r:22,sp:24,arena:'deadlock_boss',track:'segfault',placeholder:1,g:'*',c:'#7fe8ff',i:'Placeholder. Final Deadlock boss undecided.',ph:[{aim:2.6,zone:5},{aim:2.0,zone:3.6,ring:4.6},{aim:1.6,zone:2.8,ring:3.4,summon:7}]}
};
