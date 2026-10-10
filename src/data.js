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
 title:{file:'localhost.mp3',gain:1,start:0,end:53.43},
 overtime:{file:'overtime.ogg',gain:1,start:0,end:61.3},
 gameover:{file:'game_over.mp3',gain:1,start:1.21,end:189.21},
 win:{file:'win.mp3',gain:1,start:0,end:143.85}
};

export const SPELLS = {
 fireball:{n:'fireball()',d:'Aimed shot',r:0,k:'proj',dmg:13,cd:1,sp:290,rad:5,pierce:0,col:'#ff7a45'},
 bolt:{n:'bolt()',d:'Fast shot, pierces 2',r:0,k:'proj',dmg:7,cd:.55,sp:360,rad:4,pierce:2,col:'#5ee0d0'},
 lance:{n:'lance()',d:'Slow cast, pierces everything',r:1,k:'proj',dmg:32,cd:2.2,sp:580,rad:6,pierce:99,col:'#e2b24a'},
 nova:{n:'nova()',d:'Ring blast + knockback around you',r:0,k:'nova',dmg:13,cd:2.2,rad:92,knock:120,col:'#b48cff'},
 chain:{n:'chain()',d:'Lightning jumps between bugs (4 jumps)',r:1,k:'chain',dmg:13,cd:.9,rad:200,jumps:4,col:'#ffe066'},
 orbit:{n:'orbit()',d:'Blades circle you for 4s',r:2,k:'orbit',dmg:7,cd:5,col:'#8ae0ff'},
 mine:{n:'mine()',d:'Drops a delayed explosion',r:1,k:'mine',dmg:36,cd:2.4,rad:72,col:'#ff5c7a'},
 stdout:{n:'stdout()',d:'Flame cone (range 125), burns',r:1,k:'cone',dmg:7,cd:.3,col:'#ff7a45',burn:1},
 ping:{n:'ping()',d:'Instant beam, pierces everything',r:1,k:'beam',dmg:15,cd:1.3,col:'#8ae0ff'},
 rm:{n:'rm()',d:'Wide melee sweep, huge knockback',r:1,k:'melee',dmg:24,cd:1.1,knock:260,col:'#ffd23f'},
 shield:{n:'shield()',d:'+14 shield',r:0,k:'self',shv:14,cd:4,col:'#5ee0d0'},
 heal:{n:'heal()',d:'Restore 8 HP',r:0,k:'self',hpv:8,cd:7,col:'#7ddc6f'}
};

export const MODS = {
 for:{n:'for(2)',r:0,d:'Cast twice',h:'+ homing, explode',f:(a,l)=>{a.rep+=l}},
 async:{n:'async',r:0,d:'Cooldown -45%, damage -15%',h:'+ for(2), fork()',f:(a,l)=>{a.cd*=[.55,.42,.34][l-1]||.34;a.dmg*=.85}},
 map:{n:'map()',r:1,d:'3-way spread, -25% dmg each, +30% area',h:'+ pierce(), burn',f:(a,l)=>{a.pc=(a.pc>1?a.pc:1)+2*l;a.dmg*=.75;a.area*=1.3}},
 overflow:{n:'overflow',r:1,d:'x2 damage, cooldown x1.5',h:'+ lance(), mine()',f:(a,l)=>{a.dmg*=[2,2.6,3.2][l-1]||3.2;a.cd*=1.5}},
 try:{n:'try{}',r:0,d:'Each cast grants +5 shield',h:'+ async, Garbage Collector',f:(a,l)=>{a.sh+=5*l}},
 homing:{n:'homing',r:1,d:'Shots steer toward bugs, -10% dmg',h:'+ map(), ricochet',f:(a,l)=>{a.home=l;a.dmg*=.9}},
 bounce:{n:'ricochet',r:1,d:'Shots bounce off walls 3x',h:'+ pierce(), pillars arenas',f:(a,l)=>{a.bounce+=3*l}},
 pierce:{n:'pierce()',r:1,d:'+2 pierce, +2 chain jumps',h:'+ map(), ricochet',f:(a,l)=>{a.pierce+=2*l;a.jumps+=2*l}},
 explode:{n:'explode()',r:2,d:'Hits blast nearby bugs for 60%',h:'+ big, knockback',f:(a,l)=>{a.expl=l}},
 split:{n:'fork()',r:2,d:'Hits split into 2 weaker shots',h:'+ for(2), explode',f:(a,l)=>{a.split=l}},
 big:{n:'malloc()',r:1,d:'Bigger, slower, +25% dmg, +25% area',h:'+ explode, Stack Overflow',f:(a,l)=>{for(let i=0;i<l;i++){a.size*=1.5;a.sp*=.8;a.dmg*=1.25;a.area*=1.25}}},
 burn:{n:'burn',r:1,d:'Burn for 40% damage over 3s',h:'+ map(), async',f:(a,l)=>{a.burn=l}},
 freeze:{n:'freeze',r:2,d:'Hits slow bugs 45%',h:'+ nova(), mine()',f:(a,l)=>{a.freeze=l}},
 knock:{n:'push()',r:1,d:'Knockback on hit',h:'+ pillars, void arenas',f:(a,l)=>{a.knock+=130*l}},
 leech:{n:'leech()',r:2,d:'Hits heal up to 5% of damage dealt',h:'+ async, for(2)',f:(a,l)=>{a.leech=l}},
 pull:{n:'gravity()',r:3,d:'Hits pull nearby bugs in',h:'+ explode, nova()',f:(a,l)=>{a.pull=l}},
 sudo:{n:'sudo',r:4,d:'Every hit is a critical. Cooldown x1.6',h:'+ overflow, lance()',f:(a,l)=>{a.crit=l;a.cd*=1.6}}
};

export const ALL = ['proj','nova','chain','orbit','mine','cone','beam','melee'];
export const COMPAT = {
 for:[...ALL,'self'],async:[...ALL,'self'],try:[...ALL,'self'],big:[...ALL,'self'],
 map:['proj','beam','orbit','cone','melee'],overflow:ALL,homing:['proj'],bounce:['proj'],
 pierce:['proj','chain'],explode:['proj'],split:['proj'],burn:ALL,freeze:ALL,knock:ALL,
 leech:ALL,pull:['proj'],sudo:ALL
};
export const KN = {proj:'shots',nova:'nova',chain:'chain',orbit:'orbit',mine:'mines',cone:'flames',beam:'beams',melee:'melee',self:'shield/heal'};

export const UPG = {
 dmg:{n:'Optimizer',r:0,m:3,d:'+18% damage',f:s=>{s.dmg*=1.18}},
 cdr:{n:'Cache',r:0,m:3,d:'-12% cooldowns',f:s=>{s.cd*=.88}},
 spd:{n:'Hot Path',r:0,m:3,d:'+12% move speed',f:s=>{s.spd*=1.12}},
 hp:{n:'Redundancy',r:0,m:3,d:'+14 max HP',f:s=>{s.hpa+=14}},
 shl:{n:'Firewall',r:0,m:2,d:'Max shield +15, shield spells +40%',f:s=>{s.shmax+=15;s.shm*=1.4}},
 crit:{n:'Branch Predictor',r:1,m:3,d:'+15% crit chance (crit = x2)',f:s=>{s.crit+=.15}},
 dash:{n:'Fast Interrupt',r:1,m:2,d:'Dash cooldown -30%',f:s=>{s.dashcd*=.7}},
 gc:{n:'Garbage Collector',r:1,m:2,d:'Kills grant +3 shield',f:s=>{s.gc+=3}},
 heal:{n:'Autosave',r:1,m:2,d:'Heal 30% (not 20%) after each round',f:s=>{s.rh+=.1}},
 hot:{n:'Hot Reload',r:2,m:1,d:'Cooldowns tick 50% faster while moving, 20% slower standing still',f:s=>{s.mv+=.5;s.still+=.2}},
 over:{n:'Overclock',r:2,m:1,d:'Every 3rd cast fires an extra copy. Cooldowns +20%',f:s=>{s.over=1;s.cd*=1.2}},
 glass:{n:'Glass Compiler',r:2,m:1,d:'+100% damage, max HP -40%',f:s=>{s.dmg*=2;s.hpm*=.6}},
 recur:{n:'Recursive Call',r:2,m:1,d:'Every 5th cast repeats automatically',f:s=>{s.recur=1}},
 par:{n:'Parallel Processing',r:2,m:2,d:'+1 build slot, -10% damage',f:s=>{s.slots++;s.dmg*=.9}},
 proxy:{n:'Reflective Proxy',r:2,m:1,d:'Breaking your shield releases a nova',f:s=>{s.proxy=1}},
 leak:{n:'Memory Leak',r:3,m:1,d:'Spell damage +2.5%/s during a round (max +150%). Bugs speed up 1.2%/s',f:s=>{s.leak=1}},
 stack:{n:'Stack Overflow',r:3,m:1,d:'Each modifier on a spell: +10% damage, +6% size',f:s=>{s.stack=1}},
 dead:{n:'Dead Code',r:3,m:1,d:'25% per cast: a random extra modifier triggers',f:s=>{s.chaos+=.25}},
 null:{n:'Null Reference',r:4,m:1,d:'Dash phases through danger: long i-frames and a damaging trail',f:s=>{s.nullref=1}},
 panic:{n:'Kernel Panic',r:4,m:1,d:'Kills explode for 50% of that bug\'s max HP',f:s=>{s.panic=1}},
 fork:{n:'Fork Bomb',r:4,m:1,d:'15% per cast: repeats that spell’s full execution. Max HP -20%',f:s=>{s.fork=1;s.hpm*=.8}}
};

// UNO-Style Starting Decks: plenty of basic duplicates, rare power cards
export const HOSTS = {
 compiler:{
  n:'THE COMPILER',hp:60,
  start:'fireball fireball fireball fireball bolt bolt bolt shield shield shield heal heal for for for async async try try overflow',
  d:'Balanced. Each modifier on a spell trims its cooldown 3%.',w:'No weakness. No edge either.',
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
  start:'fireball fireball fireball shield shield shield shield shield heal heal heal try try try try for for pierce bounce nova',
  d:'Shield regenerates (5/s) after 3s without damage.',w:'-15% damage.',
  g:'@',c:'#5ee0d0',j:['#5ee0d0','#22b8f0','#e6fffb'],
  f:s=>{s.regen=5;s.dmg*=.85}
 },
 glitch:{
  n:'THE GLITCH',hp:55,
  start:'fireball fireball fireball bolt bolt bolt nova nova chain chain homing homing explode explode async async for for split mine',
  d:'30% of casts gain a random extra modifier.',w:'+10% cooldowns. Chaos.',
  g:'&',c:'#ff5ca8',j:['#ff5ca8','#b84dff','#ffe0f0'],
  lt:'Reach layer 4',cost:25,f:s=>{s.chaos+=.3;s.cd*=1.1}
 },
 archivist:{
  n:'THE ARCHIVIST',hp:58,
  start:'fireball fireball fireball fireball bolt bolt bolt bolt nova nova shield shield shield heal heal chain chain for for for async async async map map try try homing explode',
  d:'8-card hands, 5 slots, bigger deck.',w:'-20% damage.',
  g:'¶',c:'#b48cff',j:['#b48cff','#5c6cff','#f0e8ff'],
  lt:'Win a run',cost:40,f:s=>{s.slots++;s.hand+=2;s.dmg*=.8}
 }
};

export const DK = {
 slot:{n:'Extra Register',r:2,d:'+1 build slot (max 2)'},
 hand:{n:'Bigger Cache',r:1,d:'+1 hand size'},
 heal:{n:'Hotfix',r:0,d:'Restore 50% HP'}
};

export const WORLDS = {
 boot:{n:'Boot Sector',g:'>_',c:['#9af5a0','#2f9e5a'],ar:['open','pillars','cross','ring']},
 deadlock:{n:'Deadlock',g:'*',c:['#7fe8ff','#3b6bff'],ar:['ring','void','grid','cross']},
 heap:{n:'The Heap',g:'{}',c:['#d4f56a','#4fb860'],ar:['pillars','hot','grid','open']},
 null:{n:'/dev/null',g:'::',c:['#e0b8ff','#6a3bd6'],ar:['void','hot','ring','pillars']},
 kernel:{n:'Kernel',g:'#!',c:['#ffb02e','#ff4d3a'],ar:['grid','void','hot','cross']}
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
 nullifier:{g:'∅',c:'#a99fc0',hp:22,sp:56,r:10,dmg:5,cost:2,from:6,beh:'null',i:'Disables a spell for 4s on hit'}
};

export const ARENAS = {
 open:{n:'OPEN FIELD',w:[],hz:[]},
 pillars:{n:'PILLARS',w:[[150,90,44,44],[446,90,44,44],[150,266,44,44],[446,266,44,44],[298,176,44,44]],hz:[]},
 cross:{n:'CROSSROADS',w:[[0,0,190,110],[450,0,190,110],[0,290,190,110],[450,290,190,110]],hz:[]},
 ring:{n:'THE RING',w:[[250,140,140,100]],hz:[[170,56,300,28,'slow'],[170,316,300,28,'slow']]},
 void:{n:'THE VOID',w:[],hz:[[0,0,640,26,'lava'],[0,374,640,26,'lava'],[0,0,26,400,'lava'],[614,0,26,400,'lava']]},
 grid:{n:'GRID LOCK',w:[[120,70,20,110],[500,220,20,110],[250,140,140,16],[250,244,140,16],[120,270,110,20],[410,70,110,20]],hz:[]},
 hot:{n:'HOT ZONE',w:[[300,110,40,170]],hz:[[110,150,100,100,'lava'],[430,150,100,100,'lava']]}
};

export const BOSSES = {
 segfault:{n:'THE SEGFAULT',hp:720,r:24,sp:28,arena:'void',g:'Ж',c:'#ff5c7a',i:'Crashes zones of the arena. Exposed after each crash.',ph:[{ring:3.4,zone:5},{ring:2.8,zone:3.4,summon:8},{ring:2.2,zone:2.5,aim:2.8,summon:6}]},
 leak:{n:'THE MEMORY LEAK',hp:780,r:22,sp:24,arena:'pillars',g:'Ө',c:'#7ddc6f',grow:1,i:'Grows stronger every second. Its shots and minions ignore walls, so you cannot hide.',ph:[{aim:2.4,summon:6},{aim:1.9,ring:4.5,summon:5},{aim:1.5,ring:3.2,summon:4}]},
 runtime:{n:'THE RUNTIME ERROR',hp:1750,r:22,sp:22,arena:'grid',g:'Ξ',c:'#b48cff',i:'Marks where it will land, then teleports next to you. Exposed after each jump.',ph:[{tp:4.2,aim:2.4,zone:4.4},{tp:3.2,aim:1.9,zone:3,ring:4.4},{tp:2.5,aim:1.5,zone:2.2,ring:3.2,summon:6.5}]}
};
