
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000;
const defs=[["Xuchang", 0, 1, 2], ["Luoyang", 0, 2, 1], ["Ye", 0, 3, 1], ["Chenliu", 0, 2, 3], ["Wancheng", 0, 3, 3], ["Chengdu", 1, 1, 7], ["Hanzhong", 1, 2, 5], ["Jiangzhou", 1, 3, 7], ["Mianzhu", 1, 0, 6], ["Yong'an", 1, 4, 6], ["Jianye", 2, 7, 4], ["Chaisang", 2, 6, 5], ["Wuchang", 2, 5, 5], ["Kuaiji", 2, 8, 6], ["Luling", 2, 7, 7]];
let rooms=new Map();
function fresh(code,mode){
 const cs=defs.map((d,id)=>({id,name:d[0],owner:["wei","shu","wu"][d[1]],x:d[2],y:d[3],troops:4500+id*160,gold:1200,food:8000,pool:6500,fort:200,used:false}));
 return {code,mode,turn:1,deadline:Date.now()+mode*1000,players:{wei:false,shu:false},cities:cs,log:[],seq:0,winner:null,events:[]};
}
function event(r,txt,owner=null){r.seq++;r.log.unshift({seq:r.seq,turn:r.turn,txt,owner,time:Date.now()});r.log=r.log.slice(0,100)}
function adjacent(a,b){return Math.hypot(a.x-b.x,a.y-b.y)<=2.85}
function next(r){if(r.winner)return;r.turn++;r.deadline=Date.now()+r.mode*1000;r.players.wei=false;r.players.shu=false;
 for(const c of r.cities){c.used=false;c.gold+=Math.floor(65+c.fort*.03);c.food+=Math.floor(90+c.pool*.02);c.food=Math.max(0,c.food-Math.ceil(c.troops*.08));}
 event(r,'Turn '+r.turn+' dimulai. Semua kota mendapat income dan upkeep.');}
function tick(r){if(!r.winner&&(Date.now()>=r.deadline||(r.players.wei&&r.players.shu)))next(r)}
function view(r,side){tick(r);return {code:r.code,side,mode:r.mode,turn:r.turn,deadline:r.deadline,players:r.players,seq:r.seq,winner:r.winner,cities:r.cities.map(c=>({...c, gold:c.owner===side?c.gold:null,food:c.owner===side?c.food:null,pool:c.owner===side?c.pool:null, troops:c.owner===side?c.troops:Math.round(c.troops/1000)*1000})),log:r.log.filter(e=>e.owner===null||e.owner===side).slice(0,45)}}
function action(r,side,a){
 tick(r);if(r.winner)throw Error('Game selesai');
 if(r.players[side])throw Error('Sudah End Turn');
 const c=r.cities[a.city];if(!c||c.owner!==side)throw Error('Kota bukan milikmu');
 if(!['recruit','develop','fort','attack','transfer'].includes(a.type))throw Error('Aksi tidak valid');
 if(c.used)throw Error('Kota sudah memakai aksi turn ini');
 if(a.type==='recruit'){if(c.gold<250||c.pool<1000||c.food<300)throw Error('Resource kurang');c.gold-=250;c.food-=300;c.pool-=1000;c.troops+=1000;event(r,side.toUpperCase()+' recruit 1,000 troops di '+c.name)}
 if(a.type==='develop'){if(c.gold<200)throw Error('Gold kurang');c.gold-=200;c.pool+=350;c.food+=500;event(r,side.toUpperCase()+' mengembangkan '+c.name)}
 if(a.type==='fort'){if(c.gold<250)throw Error('Gold kurang');c.gold-=250;c.fort+=80;event(r,side.toUpperCase()+' memperkuat '+c.name)}
 if(a.type==='attack'||a.type==='transfer'){
 const t=r.cities[a.target];if(!t||!adjacent(c,t)||t.id===c.id)throw Error('Target tidak bertetangga');
 const n=Math.floor(Number(a.amount));if(!Number.isFinite(n)||n<500||n>c.troops-500)throw Error('Pasukan tidak valid');
 if(a.type==='transfer'){if(t.owner!==side)throw Error('Transfer hanya ke kota sendiri');c.troops-=n;t.troops+=n;event(r,side.toUpperCase()+' transfer '+n+' troops '+c.name+' → '+t.name)}
 else{
 if(t.owner===side)throw Error('Tidak bisa menyerang kota sendiri');
 const cost=Math.ceil(n*.16);if(c.food<cost)throw Error('Food ekspedisi kurang');
 c.food-=cost;c.troops-=n;
 const attackPower=n*(.85+Math.random()*.35);
 const defensePower=t.troops*(1+t.fort/3000)*(.85+Math.random()*.35);
 if(attackPower>defensePower){
   const survivors=Math.max(500,Math.floor(n*(1-Math.min(.78,defensePower/attackPower*.65))));
   const previous=t.owner;t.owner=side;t.troops=survivors;t.fort=Math.floor(t.fort*.65);t.gold=Math.floor(t.gold*.65);t.food=Math.floor(t.food*.65);t.used=true;
   event(r,side.toUpperCase()+' merebut '+t.name+' dari '+previous.toUpperCase()+' ('+survivors+' survivors)');
 }else{
   const lost=Math.max(250,Math.floor(n*.78));t.troops=Math.max(500,t.troops-Math.floor(lost*.55));event(r,side.toUpperCase()+' gagal menyerang '+t.name+' dari '+c.name);
 }
 }
 }
 c.used=true;
 for(const faction of ['wei','shu'])if(!r.cities.some(x=>x.owner===faction)){r.winner=faction==='wei'?'shu':'wei';event(r,r.winner.toUpperCase()+' memenangkan perang!')}
 return {ok:true};
}
function respond(res,status,obj){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(obj))}
function read(req){return new Promise((resolve,reject)=>{let s='';req.on('data',d=>{s+=d;if(s.length>20000)req.destroy()});req.on('end',()=>{try{resolve(JSON.parse(s||'{}'))}catch(e){reject(e)}})})}
const index=fs.readFileSync(path.join(__dirname,'index.html'));
http.createServer(async(req,res)=>{
 try{
 if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(index)}
 if(req.method==='POST'&&req.url==='/api/join'){
 const b=await read(req),code=String(b.code||'DUEL').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12)||'DUEL',side=b.side;
 if(!['wei','shu'].includes(side))throw Error('Pilih Wei atau Shu');
 let r=rooms.get(code);if(!r){r=fresh(code,[20,60,180,300].includes(+b.mode)?+b.mode:60);rooms.set(code,r);event(r,'Room '+code+' dibuat · '+r.mode+' detik/turn')}
 return respond(res,200,{ok:true,state:view(r,side)});
 }
 if(req.method==='GET'&&req.url.startsWith('/api/state?')){
 const u=new URL(req.url,'http://localhost');let r=rooms.get(u.searchParams.get('code'));if(!r)throw Error('Room tidak ditemukan');
 const side=u.searchParams.get('side');if(!['wei','shu'].includes(side))throw Error('Invalid faction');
 return respond(res,200,{ok:true,state:view(r,side)});
 }
 // GET command endpoints for turn-by-turn remote play testing. Never embed secrets in URL.
 if(req.method==='GET'&&req.url.startsWith('/api/action?')){
 const u=new URL(req.url,'http://localhost');const b=Object.fromEntries(u.searchParams.entries());
 const r=rooms.get(b.code);if(!r)throw Error('Room tidak ditemukan');
 if(!['wei','shu'].includes(b.side))throw Error('Faction invalid');
 if(b.from!==undefined&&b.city===undefined)b.city=b.from;
 if(b.to!==undefined&&b.target===undefined)b.target=b.to;
 if(b.troops!==undefined&&b.amount===undefined)b.amount=b.troops;
 action(r,b.side,b);return respond(res,200,{ok:true,state:view(r,b.side)});
 }
 if(req.method==='GET'&&req.url.startsWith('/api/end?')){
 const u=new URL(req.url,'http://localhost');const b=Object.fromEntries(u.searchParams.entries());
 const r=rooms.get(b.code);if(!r)throw Error('Room tidak ditemukan');
 if(!['wei','shu'].includes(b.side))throw Error('Faction invalid');
 tick(r);if(!r.players[b.side]){r.players[b.side]=true;event(r,b.side.toUpperCase()+' End Turn');tick(r)}
 return respond(res,200,{ok:true,state:view(r,b.side)});
 }
 if(req.method==='POST'&&req.url==='/api/action'){
 const b=await read(req),r=rooms.get(b.code);if(!r)throw Error('Room tidak ditemukan');
 if(!['wei','shu'].includes(b.side))throw Error('Faction invalid');
 action(r,b.side,b);return respond(res,200,{ok:true,state:view(r,b.side)});
 }
 if(req.method==='POST'&&req.url==='/api/end'){
 const b=await read(req),r=rooms.get(b.code);if(!r)throw Error('Room tidak ditemukan');
 if(!['wei','shu'].includes(b.side))throw Error('Faction invalid');
 tick(r);r.players[b.side]=true;event(r,b.side.toUpperCase()+' End Turn');tick(r);
 return respond(res,200,{ok:true,state:view(r,b.side)});
 }
 respond(res,404,{error:'Not found'});
 }catch(e){respond(res,400,{error:e.message})}
}).listen(PORT,'0.0.0.0',()=>console.log('ROTK multiplayer listening on '+PORT));
setInterval(()=>{for(const r of rooms.values())tick(r)},500);
