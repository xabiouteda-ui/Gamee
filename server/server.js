// Servidor de Hordalia Arena: salas de 12, simulación autoritativa y ranking semanal.
// Ejecuta la MISMA simulación que el cliente (shared/sim.js).
'use strict';
const http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer}=require('ws');
const S=require('../shared/sim.js');

const PORT=+process.env.PORT||8080;
const LOBBY_WAIT=+process.env.LOBBY_WAIT||8000;      // ms de espera antes de rellenar con bots
const OFFICIAL_CA=process.env.OFFICIAL_CA||'';        // contrato de tu moneda oficial
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const PUBLIC_DIR=process.env.PUBLIC_DIR||path.join(__dirname,'public');
const TICK=1/30,SEND_EVERY=2,VIEW_R=1150,EV_R=1300;
const SPEED=Math.max(1,Math.min(8,+process.env.SIM_SPEED||1)); // solo para pruebas

/* ---------- monedas ---------- */
const TIER_MIN=[0,1e4,6e4,1e5,1e6];
const tierOf=m=>{let i=0;TIER_MIN.forEach((v,k)=>{if((m||0)>=v)i=k;});return i;};
function coinHue(ca){let h=7;for(const ch of String(ca))h=(Math.imul(h,31)+ch.charCodeAt(0))>>>0;return h%360;}
const clean=(s,n)=>String(s||'').replace(/[^\p{L}\p{N}_.\- ]/gu,'').trim().slice(0,n);
const validCA=ca=>typeof ca==='string'&&(/^[1-9A-HJ-NP-Za-km-z]{32,48}$/.test(ca)||/^0x[0-9a-fA-F]{40}$/.test(ca));
const coinCache=new Map();
async function verifyCoin(ca){
  const c=coinCache.get(ca);if(c&&Date.now()-c.at<60000)return c.data;
  const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),6000);
  try{
    const r=await fetch('https://api.dexscreener.com/latest/dex/tokens/'+encodeURIComponent(ca),{signal:ctl.signal});
    if(!r.ok)throw new Error('http '+r.status);
    const j=await r.json();
    const pairs=(j&&j.pairs||[]).filter(p=>p&&p.baseToken&&String(p.baseToken.address).toLowerCase()===ca.toLowerCase());
    let data=null;
    if(pairs.length){
      pairs.sort((a,b)=>((b.liquidity&&b.liquidity.usd)||0)-((a.liquidity&&a.liquidity.usd)||0));
      const caps=pairs.slice(0,5).map(q=>Number(q.marketCap||q.fdv||0)).filter(v=>v>0).sort((a,b)=>a-b),mcap=caps.length?caps[(caps.length-1)>>1]:0;
      const wi=pairs.find(q=>q.info&&q.info.imageUrl),img=wi&&/^https:\/\//.test(wi.info.imageUrl)?wi.info.imageUrl:'';
      data={t:clean(pairs[0].baseToken.symbol,12)||'???',img,mcap};
    }
    coinCache.set(ca,{at:Date.now(),data});return data;
  }catch(e){return c?c.data:null;}finally{clearTimeout(to);}
}
function baseCoin(c){
  const ca=c&&validCA(c.ca)?c.ca:'none',t=clean(c&&c.t,12).toUpperCase()||'?';
  return{ca,t,img:'',hue:coinHue(ca==='none'?t:ca),tier:0,off:false,v:false,mcap:0};
}

/* ---------- ranking semanal ---------- */
function weekKey(d=new Date()){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const y=t.getUTCFullYear();const w=Math.ceil(((t-Date.UTC(y,0,1))/864e5+1)/7);return y+'-W'+String(w).padStart(2,'0');}
const RFILE=path.join(DATA_DIR,'ranking.json');
// Si hay SUPABASE_URL y SUPABASE_SERVICE_KEY, el ranking se guarda en Supabase (tabla "ranking", una fila por semana)
// y sobrevive a reinicios y despliegues. Si no, se usa el archivo local como antes.
const SB_URL=(process.env.SUPABASE_URL||'').replace(/\/+$/,''),SB_KEY=process.env.SUPABASE_SERVICE_KEY||'';
const SB=!!(SB_URL&&SB_KEY);
const sbHeaders=extra=>Object.assign({apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json'},extra);
async function sbLoad(week){
  const r=await fetch(SB_URL+'/rest/v1/ranking?select=data&week=eq.'+encodeURIComponent(week),{headers:sbHeaders()});
  if(!r.ok)throw new Error('supabase load http '+r.status+' '+(await r.text()).slice(0,200));
  const rows=await r.json();return rows[0]&&rows[0].data;
}
async function sbSave(rank){
  const r=await fetch(SB_URL+'/rest/v1/ranking?on_conflict=week',{method:'POST',headers:sbHeaders({Prefer:'resolution=merge-duplicates,return=minimal'}),
    body:JSON.stringify({week:rank.week,data:rank,updated_at:new Date().toISOString()})});
  if(!r.ok)throw new Error('supabase save http '+r.status+' '+(await r.text()).slice(0,200));
}
let RANK={week:weekKey(),coins:{}};
if(!SB){try{const r=JSON.parse(fs.readFileSync(RFILE,'utf8'));if(r&&r.coins)RANK=r;}catch(e){}}
// carga inicial desde Supabase; las partidas que acaben antes se suman encima
const rankReady=SB?sbLoad(RANK.week).then(d=>{
  if(!d||!d.coins||d.week!==RANK.week)return;
  for(const[ca,e]of Object.entries(RANK.coins)){const o=d.coins[ca];if(!o){d.coins[ca]=e;continue;}o.w+=e.w;o.r+=e.r;o.k+=e.k;for(const id of e.p)if(!o.p.includes(id))o.p.push(id);}
  RANK=d;console.log('ranking cargado de Supabase:',Object.keys(d.coins).length,'monedas');
}).catch(e=>console.error('ranking load',e.message)):Promise.resolve();
let saveT=null,saving=Promise.resolve();
function writeRank(){
  const snap=JSON.parse(JSON.stringify(RANK));
  if(SB)saving=saving.then(()=>rankReady).then(()=>sbSave(snap)).catch(e=>console.error('ranking save',e.message));
  else{try{fs.mkdirSync(DATA_DIR,{recursive:true});fs.writeFileSync(RFILE,JSON.stringify(snap));}catch(e){console.error('ranking save',e.message);}}
  return saving;
}
function saveRank(){clearTimeout(saveT);saveT=setTimeout(writeRank,2000);}
// Render manda SIGTERM al reiniciar o desplegar: guarda lo pendiente antes de salir
for(const sig of['SIGTERM','SIGINT'])process.on(sig,()=>{const t=saveT;clearTimeout(saveT);saveT=null;
  (t?writeRank():saving).finally(()=>process.exit(0));setTimeout(()=>process.exit(0),5000).unref();});
function rankRoll(){const w=weekKey();if(RANK.week!==w){RANK={week:w,coins:{}};}}
// cuenta una partida al caer el jugador (o al ganar); solo jugadores reales con moneda verificada
function recordRun(f,won){
  if(!f||!f.human||f.recorded||!f.pid||!f.coin.v||f.coin.ca==='none')return;
  f.recorded=true;rankRoll();
  const e=RANK.coins[f.coin.ca]||(RANK.coins[f.coin.ca]={t:f.coin.t,img:f.coin.img,w:0,r:0,k:0,p:[]});
  e.t=f.coin.t;if(f.coin.img)e.img=f.coin.img;e.r++;e.k+=f.kills;if(won)e.w++;
  if(f.cid&&!e.p.includes(f.cid)&&e.p.length<5000)e.p.push(f.cid);
  saveRank();
}
function rankRows(){rankRoll();return Object.entries(RANK.coins).map(([ca,e])=>({ca,t:e.t,img:e.img,w:e.w,r:e.r,k:e.k,p:e.p.length,v:true})).sort((a,b)=>b.w-a.w||b.r-a.r||b.k-a.k).slice(0,50);}

/* ---------- salas ---------- */
const BOT_T=['GATO','PATO','LUNA','TACO','BURRO','CHURRO','MOCHI','RANA','PULPO','KIWI','TURBO','NUBE','PIXEL','GRANO','QUESO','LORO'];
const rooms=new Set();let waiting=null,rid=1;
function newRoom(){const r={id:rid++,M:S.createMatch(),clients:new Map(),state:'wait',firstJoin:0,tick:0,evq:[]};rooms.add(r);return r;}
const humans=r=>[...r.clients.values()].length;
function getWaiting(){if(!waiting||waiting.state!=='wait'||humans(waiting)>=S.MAXP)waiting=newRoom();return waiting;}
function send(ws,o){if(ws.readyState===1)ws.send(JSON.stringify(o));}
function infoOf(f){return{id:f.id,coin:{ca:f.coin.ca,t:f.coin.t,img:f.coin.img,hue:f.coin.hue,tier:f.coin.tier,off:f.coin.off},w:f.w,bot:!f.human};}
function startRoom(r){
  const M=r.M,used=new Set(M.fighters.map(f=>f.coin.t));
  const pool=BOT_T.filter(t=>!used.has(t)).sort(()=>Math.random()-.5);
  while(M.fighters.length<S.MAXP){const t=pool.pop()||('B'+M.fighters.length),x=Math.random(),mc=x<.35?3e3+Math.random()*7e3:x<.65?1e4+Math.random()*5e4:x<.85?6e4+Math.random()*4e4:x<.97?1e5+Math.random()*9e5:1e6+Math.random()*4e6;
    S.addFighter(M,{bot:true,w:S.WEAPONS[Math.random()*S.WEAPONS.length|0],coin:{ca:'bot-'+t,t,img:'',hue:coinHue('bot-'+t),tier:tierOf(mc),off:false,v:false}});}
  S.begin(M);r.state='run';if(waiting===r)waiting=null;
  const info=M.fighters.map(infoOf);
  for(const[ws,fid]of r.clients)send(ws,{t:'start',you:fid,R0:M.R0,info});
}
const R=v=>Math.round(v),R2=v=>Math.round(v*100);
function snapshotFor(r,fid,evs){
  const M=r.M,me=S.byId(M,fid);
  let c=me&&me.alive?me:(me&&me.lastBy&&S.byId(M,me.lastBy)&&S.byId(M,me.lastBy).alive?S.byId(M,me.lastBy):(M.winner?S.byId(M,M.winner):M.fighters.find(f=>f.alive)))||me;
  const cx=c?c.x:0,cy=c?c.y:0,inR=(x,y,rr)=>Math.abs(x-cx)<rr&&Math.abs(y-cy)<rr;
  const f=M.fighters.map(o=>[o.id,R(o.x),R(o.y),o.face,o.moving?1:0,R(o.hp),R(o.maxHp),o.lvl,o.alive?1:0,o.dashT>0?1:0,R2(o.atkT),o.flash>0?1:0,R2(o.ang),R2(o.eclPhase),o.st.extra,R2(o.st.area),o.kills,R2(o.lean)]);
  const m=[];for(const o of M.mobs)if(inR(o.x,o.y,VIEW_R))m.push([o.id,S.MOB_TYPES.indexOf(o.type),R(o.x),R(o.y),o.face]);
  const sh=[];for(const o of M.shots)if(inR(o.x,o.y,VIEW_R))sh.push([o.id,o.k==='arrow'?1:0,R(o.x),R(o.y),R(o.vx),R(o.vy)]);
  const d=[];for(const o of M.drops)if(inR(o.x,o.y,VIEW_R))d.push([o.id,o.k==='heart'?1:0,R(o.x),R(o.y),o.v]);
  const e=evs.filter(x=>x.e==='elim'||x.e==='win'||x.id===fid||x.tgt===fid||x.src===fid||(x.x!==undefined&&inR(x.x,x.y,EV_R)));
  return{t:'s',T:+M.t.toFixed(2),st:+M.start.toFixed(2),zr:R(M.zoneR),ov:M.over?1:0,win:M.winner||0,sp:c?c.id:0,f,m,sh,d,e,
    me:me?{xp:me.xp,xn:me.xpNext,pend:me.pend,ch:me.pend>0?(me.choices||(me.choices=S.choices(me))):null,dcd:+me.dashCd.toFixed(2),place:me.place}:null};
}
function tick(){
  for(const r of rooms){
    const M=r.M;
    if(r.state==='wait'){
      const n=humans(r);if(!n){rooms.delete(r);if(waiting===r)waiting=null;continue;}
      const left=Math.max(0,LOBBY_WAIT-(Date.now()-r.firstJoin));
      if(n>=S.MAXP||left<=0){startRoom(r);continue;}
      if(r.tick++%15===0){const list=M.fighters.map(f=>f.coin.t);for(const ws of r.clients.keys())send(ws,{t:'lobby',n,max:S.MAXP,left:Math.ceil(left/1000),list});}
      continue;
    }
    for(let k=0;k<SPEED;k++)S.step(M,TICK);
    for(const e of M.ev){if(e.e==='elim')recordRun(S.byId(M,e.id),false);else if(e.e==='win')recordRun(S.byId(M,e.id),true);}
    r.evq.push(...M.ev);M.ev.length=0;
    if(++r.tick%SEND_EVERY===0){const evs=r.evq;r.evq=[];for(const[ws,fid]of r.clients)send(ws,snapshotFor(r,fid,evs));}
    if((M.over&&M.endT>12)||(!humans(r)&&r.state==='run')){for(const ws of r.clients.keys())ws.close();rooms.delete(r);}
  }
}
setInterval(tick,TICK*1000);

/* ---------- HTTP ---------- */
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://x');
  if(url.pathname==='/ranking'){res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'});res.end(JSON.stringify({week:RANK.week,rows:rankRows()}));return;}
  if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':'text/plain'});res.end('ok '+rooms.size);return;}
  if(url.pathname==='/'||url.pathname==='/index.html'){fs.readFile(path.join(PUBLIC_DIR,'index.html'),(e,b)=>{if(e){res.writeHead(404);res.end('Falta public/index.html');return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});res.end(b);});return;}
  res.writeHead(404);res.end('No encontrado');
});
const wss=new WebSocketServer({server,maxPayload:2048});
wss.on('connection',ws=>{
  ws.alive=true;ws.on('pong',()=>{ws.alive=true;});
  let room=null,fid=0,msgs=0,win=Date.now();
  ws.on('message',buf=>{
    const now=Date.now();if(now-win>1000){win=now;msgs=0;}if(++msgs>90)return;
    let m;try{m=JSON.parse(buf);}catch(e){return;}if(!m||typeof m!=='object')return;
    if(m.t==='join'&&!room){
      room=getWaiting();if(!room.firstJoin)room.firstJoin=now;
      const coin=baseCoin(m.coin),f=S.addFighter(room.M,{pid:'p'+fid,w:S.WEAPONS.includes(m.w)?m.w:'espada',coin});
      f.human=true;f.pid=true;f.cid=typeof m.cid==='string'?m.cid.slice(0,40):'';fid=f.id;room.clients.set(ws,fid);
      if(coin.ca!=='none'){const r0=room;verifyCoin(coin.ca).then(d=>{if(!d){console.log('moneda sin verificar',coin.ca);return;}const ff=S.byId(r0.M,fid);if(!ff)return;
        Object.assign(ff.coin,{t:d.t,img:d.img,mcap:d.mcap,tier:tierOf(d.mcap),off:!!OFFICIAL_CA&&coin.ca===OFFICIAL_CA,v:true});if(ff.coin.off)ff.st.dmg=Math.max(ff.st.dmg,1.05);
        if(r0.state==='run')for(const w2 of r0.clients.keys())send(w2,{t:'info',...infoOf(ff)});});}
      send(ws,{t:'joined',room:room.id});return;
    }
    if(!room)return;const f=S.byId(room.M,fid);if(!f)return;
    if(m.t==='in'){let mx=+m.mx||0,my=+m.my||0;const l=Math.hypot(mx,my);if(l>1){mx/=l;my/=l;}f.in.mx=mx;f.in.my=my;if(m.d)f.in.dash=true;}
    else if(m.t==='pick'){S.pick(room.M,f,(+m.i)|0);}
    else if(m.t==='leave'){ws.close();}
  });
  ws.on('close',()=>{
    if(!room)return;const f=S.byId(room.M,fid);room.clients.delete(ws);
    if(!f)return;
    if(room.state==='wait'){room.M.fighters=room.M.fighters.filter(x=>x!==f);}
    else{f.bot=true;f.pid=null;}
  });
});
setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;try{ws.ping();}catch(e){}}},20000);
server.listen(PORT,()=>console.log('Hordalia Arena escuchando en el puerto '+PORT));
