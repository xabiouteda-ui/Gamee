/* Hordalia Arena: simulación compartida (navegador y servidor).
   No toca el DOM ni el canvas. Cada luchador lee f.in = {mx, my, dash}.
   Todo lo visual o sonoro sale como eventos en M.ev para que el cliente los pinte. */
(function(root){
'use strict';
const TAU=Math.PI*2,K=.76;
const MOB={
  slime:{hp:14,spd:62,dmg:8,r:13,xp:1,col:'#7fd35a'},
  slimeV:{hp:24,spd:72,dmg:10,r:14,xp:2,col:'#c86bff'},
  bat:{hp:10,spd:118,dmg:7,r:11,xp:1,col:'#5b3f8a',fly:26}
};
const MOB_TYPES=Object.keys(MOB);
// mismo presupuesto de daño para todas las armas: el gacha es estilo, no poder
const AW={
  espada:{cd:.7,dmg:16,range:92},honda:{cd:.55,dmg:10,range:360},arco:{cd:.72,dmg:13,range:380},
  tomo:{cd:1.05,dmg:12,range:340},orbes:{dmg:8,range:90},corona:{dmg:7,range:100}
};
const WEAPONS=Object.keys(AW);
const UPS={
  dmg:{f:f=>f.st.dmg+=.12},cd:{f:f=>f.st.cd*=.92},area:{f:f=>f.st.area+=.12},spd:{f:f=>f.st.spd+=.08},
  hp:{f:f=>{f.maxHp+=20;f.hp=Math.min(f.maxHp,f.hp+30);}},
  extra:{max:2,f:f=>f.st.extra++},regen:{max:2,f:f=>f.st.regen++},armor:{max:3,f:f=>f.st.armor++}
};
const UP_IDS=Object.keys(UPS);
const PVP=.38,TRUCE=20,MAXP=12;

function zoneAt(R0,t){if(t<25)return R0;if(t<165)return R0+(170-R0)*((t-25)/140);if(t<205)return 170;return Math.max(0,170*(1-(t-205)/30));}
function createMatch(){return{t:0,start:3.2,R0:1050,zoneR:1050,over:false,winner:null,fighters:[],mobs:[],shots:[],drops:[],nid:1,mobAcc:0,endT:0,ev:[],begun:false};}
function addFighter(M,o){
  const coin=o.coin||{ca:'none',t:'?',img:'',hue:30,tier:0,off:false};
  const f={id:M.nid++,pid:o.pid||null,bot:!!o.bot,coin,w:AW[o.w]?o.w:'espada',x:0,y:0,face:1,lean:0,moving:false,hp:120,maxHp:120,lvl:1,xp:0,xpNext:5,
    st:{dmg:coin.off?1.05:1,cd:1,area:1,spd:1,extra:0,regen:0,armor:0},ups:{},wt:Math.random()*.5,ang:Math.random()*TAU,flare:2,ecl:4,eclPhase:0,
    dashT:0,dashCd:0,ddx:1,ddy:0,dx:1,dy:0,mobInv:0,alive:true,kills:0,atkT:0,pend:0,choices:null,lastBy:null,dieT:0,flash:0,
    in:{mx:0,my:0,dash:false},ai:{t:0,goal:null,skill:.55+Math.random()*.45},hitT:new Map(),place:0};
  M.fighters.push(f);return f;
}
function begin(M){
  const n=M.fighters.length;
  M.fighters.forEach((f,i)=>{const a=i/n*TAU+Math.random()*.2,R=M.R0*.62;f.x=Math.cos(a)*R;f.y=Math.sin(a)*R;});
  for(let i=0;i<40;i++)spawnMob(M,true);
  M.begun=true;
}
const isF=o=>o&&o.st!==undefined;
const ev=(M,e)=>{M.ev.push(e);};
function spawnMob(M,any){
  const zr=M.zoneR*.92,a=Math.random()*TAU,r=Math.sqrt(Math.random())*zr,x=Math.cos(a)*r,y=Math.sin(a)*r;
  if(!any)for(const f of M.fighters)if(f.alive&&Math.hypot(f.x-x,f.y-y)<150)return;
  const t=M.t,ty=t>80&&Math.random()<.3?'slimeV':Math.random()<.35?'bat':'slime',d=MOB[ty];
  const m={id:M.nid++,type:ty,x,y,hp:d.hp*(1+t/120),r:d.r,spd:d.spd*.8,dmg:d.dmg*.5,col:d.col,fly:d.fly||0,seed:Math.random()*10,face:1,flash:0,sp:.35,kx:0,ky:0,xp:d.xp,wx:x,wy:y,wt:0,dead:false};
  m.maxHp=m.hp;M.mobs.push(m);ev(M,{e:'spawn',x,y,r:m.r});
}
function near(M,x,y,R,self,fightersOnly){
  let b=null,bd=R*R;
  for(const f of M.fighters){if(f===self||!f.alive)continue;const d=(f.x-x)**2+(f.y-y)**2;if(d<bd){bd=d;b=f;}}
  if(!fightersOnly)for(const m of M.mobs){if(m.dead||m.sp>0)continue;const d=(m.x-x)**2+(m.y-y)**2;if(d<bd){bd=d;b=m;}}
  return b;
}
function dmg(M,tgt,amt,src,o){
  o=o||{};if(!tgt||(isF(tgt)?!tgt.alive:tgt.dead))return;
  const crit=Math.random()<.1;if(crit)amt*=1.8;
  if(isF(tgt)){if(tgt.dashT>0||M.start>0)return;const pvp=src&&isF(src);if(pvp&&M.t<TRUCE)return;if(pvp){amt*=PVP*(1-.08*tgt.st.armor);tgt.lastBy=src.id;}tgt.hp-=amt;tgt.flash=.1;}
  else{tgt.hp-=amt;tgt.flash=.09;if(o.kb&&src){const dx=tgt.x-src.x,dy=tgt.y-src.y,l=Math.hypot(dx,dy)||1;tgt.kx+=dx/l*o.kb;tgt.ky+=dy/l*o.kb;}}
  ev(M,{e:'hit',tgt:tgt.id,src:src?src.id:0,a:Math.max(1,Math.round(amt)),c:crit?1:0,x:Math.round(tgt.x),y:Math.round(tgt.y),z:Math.round((tgt.fly||0)+(tgt.r||14)),sx:src?Math.round(src.x):0,sy:src?Math.round(src.y):0,col:o.col||''});
  if(tgt.hp<=0){if(isF(tgt))elim(M,tgt,src);else killMob(M,tgt,src);}
}
function killMob(M,m,src){
  m.dead=true;
  ev(M,{e:'mobdie',id:m.id,type:m.type,x:Math.round(m.x),y:Math.round(m.y),r:m.r,col:m.col,fly:m.fly,face:m.face,seed:m.seed,by:src&&isF(src)?src.id:0});
  M.drops.push({id:M.nid++,k:'xp',x:m.x,y:m.y,v:m.xp,z:8,vz:120,s:0,mag:0});
  if(Math.random()<.025)M.drops.push({id:M.nid++,k:'heart',x:m.x+5,y:m.y,v:1,z:8,vz:150,s:0,mag:0});
}
function byId(M,id){return M.fighters.find(f=>f.id===id)||null;}
function elim(M,f,src){
  f.alive=false;f.dieT=1.2;f.hp=0;
  const killer=src&&isF(src)?src:(f.lastBy?byId(M,f.lastBy):null);
  const alive=M.fighters.filter(x=>x.alive).length;f.place=alive+1;
  for(let i=0;i<4+f.lvl;i++)M.drops.push({id:M.nid++,k:'xp',x:f.x+(Math.random()-.5)*60,y:f.y+(Math.random()-.5)*50,v:2,z:10,vz:200,s:0,mag:0});
  if(killer&&killer.alive){killer.kills++;xp(M,killer,6+f.lvl*3);}
  ev(M,{e:'elim',id:f.id,by:killer?killer.id:0,x:Math.round(f.x),y:Math.round(f.y),place:f.place});
  if(alive<=1){const w=M.fighters.find(x=>x.alive);if(w){w.place=1;M.winner=w.id;M.over=true;M.endT=0;ev(M,{e:'win',id:w.id,x:Math.round(w.x),y:Math.round(w.y)});}}
}
function xp(M,f,v){f.xp+=v;while(f.xp>=f.xpNext){f.xp-=f.xpNext;f.lvl++;f.xpNext=Math.round(f.xpNext*1.25+3);f.pend++;ev(M,{e:'lvl',id:f.id,x:Math.round(f.x),y:Math.round(f.y)});}}
function choices(f){const pool=UP_IDS.filter(id=>!UPS[id].max||(f.ups[id]||0)<UPS[id].max);for(let i=pool.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[pool[i],pool[j]]=[pool[j],pool[i]];}return pool.slice(0,3);}
function pick(M,f,i){
  if(!f||!f.alive||f.pend<=0)return false;if(!f.choices)f.choices=choices(f);
  const id=f.choices[i];if(!id||!UPS[id])return false;UPS[id].f(f);f.ups[id]=(f.ups[id]||0)+1;f.pend--;f.choices=null;if(f.pend>0)f.choices=choices(f);return true;
}
function botThink(M,f,dt){
  const ai=f.ai;ai.t-=dt;
  if(f.pend>0){if(!f.choices)f.choices=choices(f);pick(M,f,Math.random()*f.choices.length|0);}
  if(ai.t>0)return;ai.t=.18+Math.random()*.2*(1.6-ai.skill);
  const dc=Math.hypot(f.x,f.y),zr=M.zoneR,hpP=f.hp/f.maxHp;let tx=null,ty=null,flee=null;
  const foe=near(M,f.x,f.y,340,f,true),wr=AW[f.w].range,ideal=f.w==='espada'?55:f.w==='orbes'||f.w==='corona'?50:Math.min(240,wr*.65);
  if(dc>zr-70){tx=0;ty=0;}
  else if(hpP<.35&&foe)flee=foe;
  else if(hpP<.6){const h=M.drops.find(d=>d.k==='heart'&&Math.hypot(d.x-f.x,d.y-f.y)<400);if(h){tx=h.x;ty=h.y;}}
  if(tx===null&&!flee){
    const brave=M.t>35||M.zoneR<600||(foe&&foe.hp/foe.maxHp<.3);
    if(foe&&brave&&(f.lvl>=foe.lvl-1||hpP>foe.hp/foe.maxHp+.15)){const d=Math.hypot(foe.x-f.x,foe.y-f.y)||1,k=(d-ideal)/d;tx=f.x+(foe.x-f.x)*k;ty=f.y+(foe.y-f.y)*k;}
    else if(foe&&f.lvl<foe.lvl-1)flee=foe;
    else{const m=near(M,f.x,f.y,520,f,false);if(m&&!isF(m)){const d=Math.hypot(m.x-f.x,m.y-f.y)||1,k=(d-ideal)/d;tx=f.x+(m.x-f.x)*k;ty=f.y+(m.y-f.y)*k;}
      else{if(!ai.goal||Math.hypot(ai.goal[0]-f.x,ai.goal[1]-f.y)<40){const a=Math.random()*TAU,r=Math.random()*zr*.7;ai.goal=[Math.cos(a)*r,Math.sin(a)*r];}tx=ai.goal[0];ty=ai.goal[1];}}
  }
  let mx=0,my=0;
  if(flee){mx=f.x-flee.x;my=f.y-flee.y;if(dc>zr*.7){mx-=f.x*.01*dc;my-=f.y*.01*dc;}}
  else if(tx!==null){mx=tx-f.x;my=ty-f.y;if(Math.hypot(mx,my)<10){mx=0;my=0;}}
  const l=Math.hypot(mx,my);if(l>0){mx/=l;my/=l;}
  if(foe&&Math.random()<.35){mx+=-my*.5*(Math.random()<.5?1:-1);my+=mx*.3;}
  f.in.mx=mx;f.in.my=my;
  f.in.dash=f.dashCd<=0&&((flee&&Math.random()<.4*ai.skill)||(foe&&f.lastBy===foe.id&&Math.random()<.2*ai.skill)||(dc>zr&&Math.random()<.5));
}
function weapon(M,f,dt){
  const w=AW[f.w],st=f.st,dm=w.dmg*st.dmg;f.wt-=dt;
  const all=()=>{const a=[];for(const m of M.mobs)if(!m.dead)a.push(m);for(const o of M.fighters)if(o.alive&&o!==f)a.push(o);return a;};
  switch(f.w){
  case 'espada':{if(f.wt>0)break;const tg=near(M,f.x,f.y,w.range*st.area+10,f);if(!tg){f.wt=.05;break;}f.wt=w.cd*st.cd;f.atkT=.18;
    const R=w.range*st.area,base=Math.atan2(tg.y-f.y,tg.x-f.x),n=1+st.extra;f.face=Math.cos(base)>=0?1:-1;
    for(let i=0;i<n;i++){const a=base+i*TAU/n;ev(M,{e:'slash',id:f.id,x:Math.round(f.x),y:Math.round(f.y),a:+a.toFixed(2),r:Math.round(R)});
      for(const o of all()){const dx=o.x-f.x,dy=o.y-f.y,d=Math.hypot(dx,dy);if(d>R+(o.r||14))continue;let da=Math.atan2(dy,dx)-a;da=Math.atan2(Math.sin(da),Math.cos(da));if(Math.abs(da)<1.15||d<(o.r||14)+12)dmg(M,o,dm,f,{kb:220});}}
    break;}
  case 'honda':case 'arco':{if(f.wt>0)break;const tg=near(M,f.x,f.y,w.range,f);if(!tg){f.wt=.05;break;}f.wt=w.cd*st.cd;f.atkT=.12;
    const base=Math.atan2(tg.y-f.y,tg.x-f.x),n=1+st.extra,sp=f.w==='arco'?680:540;f.face=Math.cos(base)>=0?1:-1;
    for(let i=0;i<n;i++){const a=base+(i-(n-1)/2)*.16;M.shots.push({id:M.nid++,o:f.id,k:f.w==='arco'?'arrow':'rock',x:f.x,y:f.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,dmg:dm,r:f.w==='arco'?7:6,life:.8,pierce:f.w==='arco'?1:0,hit:new Set()});}
    ev(M,{e:'shoot',id:f.id,k:f.w});break;}
  case 'tomo':{if(f.wt>0)break;const cur=near(M,f.x,f.y,w.range,f);if(!cur){f.wt=.05;break;}f.wt=w.cd*st.cd;f.atkT=.15;
    for(let b=0;b<1+st.extra;b++){const used=new Set(),pts=[[Math.round(f.x),Math.round(f.y),34]];let c2=b?near(M,f.x,f.y,w.range,f):cur;
      for(let j=0;j<3&&c2;j++){used.add(c2);pts.push([Math.round(c2.x),Math.round(c2.y),Math.round((c2.fly||0)+(c2.r||14))]);const prev=c2;dmg(M,c2,dm,f,{col:'#bfe9ff'});
        c2=null;let bd=(150*st.area)**2;for(const o of all()){if(used.has(o)||(isF(o)?!o.alive:o.dead))continue;const d=(o.x-prev.x)**2+(o.y-prev.y)**2;if(d<bd){bd=d;c2=o;}}}
      ev(M,{e:'bolt',id:f.id,p:pts});}
    break;}
  case 'orbes':case 'corona':{const n=(f.w==='orbes'?3:4)+st.extra,R=(f.w==='orbes'?72:88)*st.area;f.ang+=(f.w==='orbes'?2.8:3.4)*dt;
    const objs=all();
    for(let i=0;i<n;i++){const a=f.ang+i*TAU/n,ox=f.x+Math.cos(a)*R,oy=f.y+Math.sin(a)*R;
      for(const o of objs){if(isF(o)?!o.alive:o.dead)continue;if(Math.hypot(o.x-ox,o.y-oy)<(o.r||14)+16){const last=f.hitT.get(o.id)||-9;if(M.t+M.endT-last>.45){f.hitT.set(o.id,M.t+M.endT);dmg(M,o,dm,f,{kb:120,col:f.w==='orbes'?'#ffcf6a':'#ffb3f0'});}}}}
    if(f.w==='orbes'){f.flare-=dt;if(f.flare<=0){f.flare=3.5*st.cd;const R2=140*st.area;ev(M,{e:'ring',id:f.id,x:Math.round(f.x),y:Math.round(f.y),r0:20,r1:Math.round(R2),l:.45,col:'255,170,60',w:12,s:'flare'});
      for(const o of all())if((isF(o)?o.alive:!o.dead)&&Math.hypot(o.x-f.x,o.y-f.y)<R2+(o.r||14))dmg(M,o,14*st.dmg,f,{kb:240,col:'#ffcf6a'});}}
    else{if(f.eclPhase>0){f.eclPhase-=dt;const R2=240*st.area;
        for(const o of all()){const dx=f.x-o.x,dy=f.y-o.y,d=Math.hypot(dx,dy);if(d<R2&&d>30){const p=((1-d/R2)*300+60)*(isF(o)?.35:1);o.x+=dx/d*p*dt;o.y+=dy/d*p*dt;}}
        if(f.eclPhase<=0){for(const o of all())if((isF(o)?o.alive:!o.dead)&&Math.hypot(o.x-f.x,o.y-f.y)<220*st.area+(o.r||14))dmg(M,o,26*st.dmg,f,{kb:300,col:'#ffd6f6'});
          ev(M,{e:'boom',id:f.id,x:Math.round(f.x),y:Math.round(f.y),r:Math.round(220*st.area)});}}
      else{f.ecl-=dt;if(f.ecl<=0){f.ecl=6*st.cd;f.eclPhase=.7;ev(M,{e:'charge',id:f.id});}}}
    break;}
  }
}
function step(M,dt){
  if(!M.begun)return;
  if(M.start>0){M.start-=dt;}
  const live=M.start<=0&&!M.over;
  if(live)M.t+=dt;
  M.zoneR=zoneAt(M.R0,M.t);
  for(const f of M.fighters){
    if(!f.alive){f.dieT-=dt;continue;}
    if(f.bot&&live)botThink(M,f,dt);
    let mx=live?+f.in.mx||0:0,my=live?+f.in.my||0:0;const l=Math.hypot(mx,my);if(l>1){mx/=l;my/=l;}
    f.moving=l>.1;if(f.moving){f.dx=mx;f.dy=my;if(Math.abs(mx)>.1&&f.atkT<=0)f.face=Math.sign(mx);}
    f.lean+=(mx-f.lean)*Math.min(1,dt*10);f.atkT=Math.max(0,f.atkT-dt);f.dashCd=Math.max(0,f.dashCd-dt);f.mobInv-=dt;f.flash-=dt;
    if(f.in.dash&&live&&f.dashCd<=0&&f.dashT<=0){const dl=Math.hypot(f.dx,f.dy)||1;f.ddx=f.dx/dl;f.ddy=f.dy/dl;f.dashT=.18;f.dashCd=2.2;ev(M,{e:'dash',id:f.id,x:Math.round(f.x),y:Math.round(f.y)});}
    f.in.dash=false;
    let sp=165*f.st.spd;if(f.dashT>0){f.dashT-=dt;sp*=3.4;mx=f.ddx;my=f.ddy;}
    f.x+=mx*sp*dt;f.y+=my*sp*dt/K*.9;
    const dc=Math.hypot(f.x,f.y);if(dc>M.R0+40){f.x*=(M.R0+40)/dc;f.y*=(M.R0+40)/dc;}
    if(live){if(f.st.regen)f.hp=Math.min(f.maxHp,f.hp+f.st.regen*dt);
      if(dc>M.zoneR){f.hp-=(6+M.t/20)*dt;f.flash=Math.max(f.flash,.02);f.zoneT=(f.zoneT||0)-dt;if(f.zoneT<=0){f.zoneT=.4;ev(M,{e:'zone',id:f.id});}if(f.hp<=0){elim(M,f,null);continue;}}
      weapon(M,f,dt);}
  }
  const fs=M.fighters.filter(f=>f.alive);
  for(let i=0;i<fs.length;i++)for(let j=i+1;j<fs.length;j++){const a=fs[i],b=fs[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.01;if(d<26){const o=(26-d)/2/d;a.x-=dx*o;a.y-=dy*o;b.x+=dx*o;b.y+=dy*o;}}
  if(live){M.mobAcc+=dt;if(M.mobAcc>.25){M.mobAcc=0;const tgt=Math.round(18+40*(M.zoneR/M.R0));if(M.mobs.length<tgt)spawnMob(M,false);}}
  for(const m of M.mobs){
    m.flash-=dt;if(m.sp>0){m.sp-=dt;continue;}
    let tg=null,bd=280*280;for(const f of fs){const d=(f.x-m.x)**2+(f.y-m.y)**2;if(d<bd){bd=d;tg=f;}}
    let tx,ty;if(tg){tx=tg.x;ty=tg.y;}else{m.wt-=dt;if(m.wt<=0){m.wt=2+Math.random()*3;const a=Math.random()*TAU;m.wx=m.x+Math.cos(a)*120;m.wy=m.y+Math.sin(a)*120;}tx=m.wx;ty=m.wy;}
    const dx=tx-m.x,dy=ty-m.y,d=Math.hypot(dx,dy)||1,s=tg?m.spd:m.spd*.35;
    if(d>4){m.x+=(dx/d*s+m.kx)*dt;m.y+=(dy/d*s+m.ky)*dt;}else{m.x+=m.kx*dt;m.y+=m.ky*dt;}
    const kd=Math.exp(-9*dt);m.kx*=kd;m.ky*=kd;if(Math.abs(dx)>1)m.face=dx>0?1:-1;
    if(tg&&live&&Math.sqrt(bd)<m.r+13&&tg.mobInv<=0&&tg.dashT<=0){tg.mobInv=.5;dmg(M,tg,m.dmg,m);}
    if(Math.hypot(m.x,m.y)>M.zoneR+60){m.hp-=20*dt;if(m.hp<=0)m.dead=true;}
  }
  M.mobs=M.mobs.filter(m=>!m.dead);
  for(const s of M.shots){s.life-=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;const owner=byId(M,s.o);
    const test=o=>{if(o.id===s.o||s.hit.has(o.id))return false;const m=(o.r||14)+s.r;if(Math.abs(o.x-s.x)<m&&Math.abs(o.y-s.y)<m&&Math.hypot(o.x-s.x,o.y-s.y)<m){s.hit.add(o.id);dmg(M,o,s.dmg,owner||{x:s.x-s.vx,y:s.y-s.vy,id:0},{kb:110});if(--s.pierce<0){s.life=0;return true;}}return false;};
    for(const m of M.mobs){if(!m.dead&&test(m))break;}if(s.life>0)for(const f of M.fighters){if(f.alive&&test(f))break;}}
  M.shots=M.shots.filter(s=>s.life>0);
  for(const g of M.drops){g.vz-=520*dt;g.z+=g.vz*dt;if(g.z<0){g.z=0;g.vz=Math.abs(g.vz)*.35;if(g.vz<25)g.vz=0;}
    let best=null,bd=1e9;for(const f of fs){const d=Math.hypot(f.x-g.x,f.y-g.y);if(d<bd){bd=d;best=f;}}
    if(best&&bd<85&&g.k==='xp')g.mag=best.id;
    const mf=g.mag?byId(M,g.mag):null;
    if(mf&&mf.alive){const dx=mf.x-g.x,dy=mf.y-g.y,d=Math.hypot(dx,dy)||1;g.s=Math.min(900,(g.s||0)+1500*dt);g.x+=dx/d*g.s*dt;g.y+=dy/d*g.s*dt;}
    if(best&&bd<18){g.dead=true;if(g.k==='xp'){xp(M,best,g.v);ev(M,{e:'gem',id:best.id});}else{best.hp=Math.min(best.maxHp,best.hp+30);ev(M,{e:'heal',id:best.id,x:Math.round(best.x),y:Math.round(best.y)});}}}
  M.drops=M.drops.filter(g=>!g.dead);if(M.drops.length>300)M.drops.splice(0,M.drops.length-300);
  if(M.over)M.endT+=dt;
}
const api={TAU,K,MOB,MOB_TYPES,AW,WEAPONS,UP_IDS,PVP,TRUCE,MAXP,zoneAt,createMatch,addFighter,begin,step,pick,choices,byId,elim};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HSim=api;
})(typeof window!=='undefined'?window:globalThis);
