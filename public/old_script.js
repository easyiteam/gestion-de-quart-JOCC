const TEAMS=['A','B','C','D'];
const POSTES={chef:'Chef de quart',veille:'Op. de veille',radio:'Op. radio',permanence:'Off. permanence',supervision:'Superviseur'};
const EV_L={routine:'Routine',info:'Information',urgence:'Urgence'};
const EV_C={routine:'bi',info:'bi',urgence:'br'};
const MOTIFS={maladie:'Maladie',conge:'Congé',formation:'Formation',mission:'Mission',autre:'Autre'};
const PRIO_C={normal:'bi',important:'bw',urgent:'br'};
const PRIO_L={normal:'Normale',important:'Importante',urgent:'Urgente'};
const SRCS={vtmis:'VTMIS',ais:'AIS',radar:'Radar',camera:'Caméra',autre:'Autre'};
let D={config:{refDate:tod(),refTeam:'A'},operators:[],rapports:{},absences:[],notifications:[],consignes:[],captures:[],sitreps:[],escortes:[]};
let calY=new Date().getFullYear(),calM=new Date().getMonth(),curRptDate=null,survFD=null,csFD=null;

function tod(){return new Date().toISOString().slice(0,10);}
function gid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function fmt(d){if(!d)return'';const p=d.split('-');return p[2]+'/'+p[1]+'/'+p[0];}
function nowT(){return new Date().toTimeString().slice(0,5);}
function getTeam(ds){const ref=new Date(D.config.refDate+'T12:00:00'),d=new Date(ds+'T12:00:00');const diff=Math.round((d-ref)/86400000);return TEAMS[((TEAMS.indexOf(D.config.refTeam)+diff)%4+4)%4];}
function tBadge(t){return`<span class="badge b${t.toLowerCase()}">Éq.${t}</span>`;}
function gOp(id){return D.operators.find(o=>o.id===id);}
function tOps(eq){return D.operators.filter(o=>o.equipe===eq&&o.actif);}
function dBetween(a,b){return Math.max(1,Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000)+1);}
function sups(){return D.operators.filter(o=>o.poste==='supervision'&&o.actif);}
function pushN(type,titre,detail,urg=false){D.notifications.push({id:gid(),type,titre,detail,urg,ts:new Date().toISOString(),lu:false});updDot();}
function updDot(){const n=D.notifications.filter(x=>!x.lu).length;const d=document.getElementById('notif-dot');if(d)d.style.display=n>0?'inline-block':'none';}
async function load(){
  try{var raw=localStorage.getItem('jocc_v5');if(raw)D=JSON.parse(raw);}catch(e){}
  if(!D.operators||!D.operators.length)initSample();
  ['rapports','notifications','consignes','captures','sitreps','escortes'].forEach(k=>{if(!D[k])D[k]=k==='rapports'?{}:[];});
  if(!D.absences)D.absences=[];
  await sv();
}
async function sv(){try{localStorage.setItem('jocc_v5',JSON.stringify(D));}catch(e){}}

function initSample(){
  const defs=[['MARTIN','Jean','LV','A','chef'],['DUBOIS','Marie','OIM','A','radio'],['BERNARD','Paul','CC','A','veille'],['THOMAS','Sophie','EV1','A','permanence'],['PETIT','Luc','LV','B','chef'],['ROBERT','Anna','OIM','B','radio'],['RICHARD','Marc','CC','B','veille'],['SIMON','Julie','EV1','B','permanence'],['MOREAU','Eric','LV','C','chef'],['LAURENT','Claire','OIM','C','radio'],['GARCIA','Pierre','CC','C','veille'],['LEROY','Isabelle','EV1','C','permanence'],['ADAM','Nicolas','LV','D','chef'],['ROUX','Catherine','OIM','D','radio'],['FOURNIER','Alain','CC','D','veille'],['VINCENT','Sandra','EV1','D','permanence'],['HOUNKPE','Romuald','CF','A','supervision']];
  D.operators=defs.map(([nom,prenom,grade,equipe,poste])=>({id:gid(),nom,prenom,grade,equipe,poste,actif:true}));
  D.config={refDate:tod(),refTeam:'A'};
}

// CLOCK
function tickClock(){
  const now=new Date();
  const t=now.toTimeString().slice(0,8);
  const d=now.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const e1=document.getElementById('hdr-time');const e2=document.getElementById('hdr-date');
  if(e1)e1.textContent=t;if(e2)e2.textContent=d;
}
setInterval(tickClock,1000);tickClock();

function showTab(n){
  document.querySelectorAll('.tab').forEach(t=>t.style.display='none');
  document.querySelectorAll('.nb').forEach(b=>b.classList.toggle('active',b.dataset.tab===n));
  document.getElementById('tab-'+n).style.display='block';
  if(n==='supervision'){D.notifications.forEach(x=>x.lu=true);sv().then(()=>updDot());}
  ({dashboard:renderDash,sitrep:renderSitrep,planning:renderCal,operators:renderOps,rapport:function(){},absences:renderAbs,supervision:renderSup,fichiers:renderFichiers,escorte:renderEscorte})[n]?.();
}

function renderDash(){
  const t=tod();const eq=getTeam(t);const ops=tOps(eq);
  const tom=new Date();tom.setDate(tom.getDate()+1);const nEq=getTeam(tom.toISOString().slice(0,10));
  const mo=t.slice(0,7);const aN=(D.absences||[]).filter(a=>a.dateDebut.slice(0,7)===mo||a.dateFin.slice(0,7)===mo).length;
  document.getElementById('s-eq').innerHTML=tBadge(eq);document.getElementById('hs-eq').innerHTML=tBadge(eq);
  document.getElementById('s-ops').textContent=ops.length;document.getElementById('hs-ops').textContent=ops.length;
  document.getElementById('s-abs').textContent=aN;
  document.getElementById('s-next2').innerHTML=tBadge(nEq);document.getElementById('hs-next').innerHTML=tBadge(nEq);
  document.getElementById('hs-sit').textContent=(D.sitreps||[]).length;
  let qh='';
  if(!ops.length)qh='<div class="empty">Aucun opérateur — Équipe '+eq+'</div>';
  else{qh='<div class="tw"><table><thead><tr><th>Nom / Prénom</th><th>Grade</th><th>Poste</th></tr></thead><tbody>';ops.forEach(o=>{qh+=`<tr><td><span style="font-weight:600">${o.nom}</span> ${o.prenom}</td><td>${o.grade}</td><td>${POSTES[o.poste]||o.poste}</td></tr>`;});qh+='</tbody></table></div>';}
  document.getElementById('d-quart-ops').innerHTML=qh;
  let rot='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px">';
  for(let i=0;i<4;i++){const d=new Date();d.setDate(d.getDate()+i);const ds=d.toISOString().slice(0,10);const dn=i===0?'Auj.':i===1?'Dem.':d.toLocaleDateString('fr-FR',{weekday:'short'});rot+=`<div style="text-align:center;padding:7px 3px;border:0.5px solid var(--color-border-tertiary);border-radius:6px"><div style="font-size:9px;color:var(--color-text-secondary);margin-bottom:4px;letter-spacing:.06em;text-transform:uppercase">${dn}</div>${tBadge(getTeam(ds))}</div>`;}
  document.getElementById('d-rotation').innerHTML=rot+'</div>';
  const evs=[];Object.entries(D.rapports||{}).forEach(([date,r])=>(r.evenements||[]).forEach(ev=>evs.push({date,ev})));evs.sort((a,b)=>(b.date+b.ev.heure).localeCompare(a.date+a.ev.heure));
  const last=evs.slice(0,6);let eh='';
  if(!last.length)eh='<div class="empty">Aucun événement</div>';
  else last.forEach(({date,ev})=>{eh+=`<div class="ev-item"><div class="flex-b mb8" style="margin-bottom:3px"><span class="badge ${EV_C[ev.type]||'bi'}">${EV_L[ev.type]||ev.type}</span><span style="font-size:10px;color:var(--color-text-secondary)">${fmt(date)} · ${ev.heure}</span></div><div style="font-size:12px">${ev.description}</div></div>`;});
  document.getElementById('d-events').innerHTML=eh;
}

function renderSitrep(){
  const fEq=document.getElementById('sitrep-filter-eq')?.value||'';
  const fDate=document.getElementById('sitrep-filter-date')?.value||'';
  let sits=(D.sitreps||[]).slice().sort((a,b)=>Number(b.num)-Number(a.num));
  if(fEq)sits=sits.filter(s=>s.equipe===fEq);if(fDate)sits=sits.filter(s=>s.date===fDate);
  document.getElementById('sitrep-count').textContent=sits.length+' SITREP(s) enregistré(s)';
  if(!sits.length){document.getElementById('sitrep-list').innerHTML='<div class="empty">Aucun SITREP · cliquez sur "+ Nouveau SITREP"</div>';return;}
  document.getElementById('sitrep-list').innerHTML=sits.map(s=>sitrepCard(s)).join('');
}
function sitrepCard(s){
  const fields=[['TIME',s.time],['SPEED',s.speed?s.speed+' nds':'—'],['COURSE',s.course?s.course:'—'],['POSITION',s.lat&&s.lon?s.lat+' / '+s.lon:'—'],['AZM/PAC',s.azm_pac||'—'],['DIST/PAC',s.dist_pac?s.dist_pac+' nq':'—'],['DIST/CÔTE',s.dist_cote?s.dist_cote+' nq':'—'],['AZM/SPM',s.azm_spm||'—'],['DIST/SPM',s.dist_spm?s.dist_spm+' nq':'—']];
  let fh='<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:10px">';
  fields.forEach(([l,v])=>{fh+=`<div class="sit-f"><div class="sit-fl">${l}</div><div class="sit-fv">${v||'—'}</div></div>`;});fh+='</div>';
  return`<div class="sit-card"><div class="flex-b"><div class="flex"><div class="sit-num">${s.num}</div><div><div style="font-weight:700;font-size:13px;letter-spacing:.04em">SITREP N° ${s.num}</div><div style="font-size:11px;color:rgba(111,163,200,.7)">${fmt(s.date)} · ${s.time||'—'} · ${tBadge(s.equipe)}</div></div></div><div class="flex"><button class="btn btn-gold" style="font-size:10px;padding:3px 9px" onclick="editSitrep('${s.id}')">Modifier</button><button class="btn" style="font-size:10px;padding:3px 9px" onclick="printSitrep('${s.id}')">Imprimer</button><button class="btn btn-danger" style="font-size:10px;padding:3px 9px" onclick="delSitrep('${s.id}')">Suppr.</button></div></div>${fh}${s.comment?`<div style="margin-top:10px;padding-top:9px;border-top:0.5px solid rgba(200,164,74,.15);font-size:12px"><span style="font-size:9px;color:rgba(111,163,200,.6);text-transform:uppercase;letter-spacing:.1em">Commentaire — </span>${s.comment}</div>`:''}</div>`;
}
function openSitrepForm(reset){
  const f=document.getElementById('sitrep-form');f.style.display='block';
  if(reset){document.getElementById('sitrep-form-title').textContent='Nouveau SITREP';const n=(D.sitreps||[]).length?Math.max(...D.sitreps.map(s=>Number(s.num)||0))+1:1;document.getElementById('sit-num').value=n;document.getElementById('sit-date').value=tod();document.getElementById('sit-time').value=nowT();document.getElementById('sit-equipe').value=getTeam(tod());['sit-speed','sit-course','sit-lat','sit-lon','sit-azm-pac','sit-dist-pac','sit-dist-cote','sit-azm-spm','sit-dist-spm','sit-comment'].forEach(id=>{document.getElementById(id).value='';});document.getElementById('sit-edit-id').value='';}
}
function editSitrep(id){
  const s=(D.sitreps||[]).find(x=>x.id===id);if(!s)return;
  document.getElementById('sitrep-form-title').textContent='Modifier SITREP N°'+s.num;
  document.getElementById('sit-num').value=s.num;document.getElementById('sit-date').value=s.date;document.getElementById('sit-time').value=s.time;document.getElementById('sit-equipe').value=s.equipe;document.getElementById('sit-speed').value=s.speed;document.getElementById('sit-course').value=s.course;document.getElementById('sit-lat').value=s.lat;document.getElementById('sit-lon').value=s.lon;document.getElementById('sit-azm-pac').value=s.azm_pac;document.getElementById('sit-dist-pac').value=s.dist_pac;document.getElementById('sit-dist-cote').value=s.dist_cote;document.getElementById('sit-azm-spm').value=s.azm_spm;document.getElementById('sit-dist-spm').value=s.dist_spm;document.getElementById('sit-comment').value=s.comment||'';document.getElementById('sit-edit-id').value=id;
  document.getElementById('sitrep-form').style.display='block';document.getElementById('sitrep-form').scrollIntoView({behavior:'smooth',block:'start'});
}
async function saveSitrep(){
  const num=document.getElementById('sit-num').value;if(!num){alert('Numéro requis');return;}
  const s={id:document.getElementById('sit-edit-id').value||gid(),num:Number(num),date:document.getElementById('sit-date').value,time:document.getElementById('sit-time').value,equipe:document.getElementById('sit-equipe').value,speed:document.getElementById('sit-speed').value,course:document.getElementById('sit-course').value,lat:document.getElementById('sit-lat').value,lon:document.getElementById('sit-lon').value,azm_pac:document.getElementById('sit-azm-pac').value,dist_pac:document.getElementById('sit-dist-pac').value,dist_cote:document.getElementById('sit-dist-cote').value,azm_spm:document.getElementById('sit-azm-spm').value,dist_spm:document.getElementById('sit-dist-spm').value,comment:document.getElementById('sit-comment').value,ts:new Date().toISOString()};
  const eid=document.getElementById('sit-edit-id').value;
  if(eid){const idx=(D.sitreps||[]).findIndex(x=>x.id===eid);if(idx>=0)D.sitreps[idx]=s;}else{if(!D.sitreps)D.sitreps=[];D.sitreps.push(s);}
  pushN('sitrep','SITREP N°'+num+' — '+fmt(s.date),'Équipe '+s.equipe+' · '+s.time+(s.lat?' · Pos: '+s.lat:''));
  await sv();document.getElementById('sitrep-form').style.display='none';renderSitrep();renderDash();
}
async function delSitrep(id){if(!confirm('Supprimer ce SITREP ?'))return;D.sitreps=(D.sitreps||[]).filter(s=>s.id!==id);await sv();renderSitrep();renderDash();}
function printSitrep(id){
  const s=(D.sitreps||[]).find(x=>x.id===id);if(!s)return;
  const html=`<html><head><title>SITREP N°${s.num}</title><style>body{font-family:'Courier New',monospace;font-size:13px;padding:30px;max-width:700px;margin:0 auto}h1{font-size:16px;border-bottom:2px solid #0d2035;padding-bottom:8px;margin-bottom:16px;color:#0d2035;letter-spacing:.08em}.row{display:flex;padding:7px 0;border-bottom:1px solid #e0e0e0}.lbl{width:140px;font-weight:bold;color:#555;flex-shrink:0;font-size:11px;text-transform:uppercase;letter-spacing:.05em}.val{flex:1;font-size:13px;color:#111}.hb{background:#0d2035;color:#fff;padding:14px 16px;border-radius:4px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}@media print{.hb{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="hb"><div style="font-size:15px;font-weight:bold;letter-spacing:.08em">PRÉFECTURE MARITIME — JOCC</div><div style="font-size:11px;opacity:.8">République du Bénin</div></div><h1>SITREP N° ${s.num}</h1><div class="row"><div class="lbl">DATE</div><div class="val">${fmt(s.date)}</div></div><div class="row"><div class="lbl">TIME</div><div class="val">${s.time||'—'}</div></div><div class="row"><div class="lbl">ÉQUIPE</div><div class="val">${s.equipe}</div></div><div class="row"><div class="lbl">SPEED</div><div class="val">${s.speed?s.speed+' nds':'—'}</div></div><div class="row"><div class="lbl">COURSE</div><div class="val">${s.course||'—'}</div></div><div class="row"><div class="lbl">POSITION</div><div class="val">${s.lat&&s.lon?s.lat+' / '+s.lon:'—'}</div></div><div class="row"><div class="lbl">AZM/PAC</div><div class="val">${s.azm_pac||'—'}</div></div><div class="row"><div class="lbl">DIST/PAC</div><div class="val">${s.dist_pac?s.dist_pac+' nautiques':'—'}</div></div><div class="row"><div class="lbl">DIST/CÔTE</div><div class="val">${s.dist_cote?s.dist_cote+' nautiques':'—'}</div></div><div class="row"><div class="lbl">AZM/SPM</div><div class="val">${s.azm_spm||'—'}</div></div><div class="row"><div class="lbl">DIST/SPM</div><div class="val">${s.dist_spm?s.dist_spm+' nautiques':'—'}</div></div>${s.comment?`<div style="background:#f5f7fa;border:1px solid #ddd;padding:10px;margin-top:14px;border-radius:4px"><strong>COMMENTAIRE :</strong><br>${s.comment}</div>`:''}<p style="font-size:10px;color:#999;margin-top:20px;border-top:1px solid #eee;padding-top:8px">Généré le ${new Date().toLocaleString('fr-FR')} — JOCC / Préfecture Maritime — République du Bénin</p><\/body><\/html>`;
  const w=window.open('','_blank','width=750,height=600');if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),500);}
}

function renderCal(){
  const months=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  document.getElementById('cal-label').textContent=months[calM]+' '+calY;
  const grid=document.getElementById('cal-grid');grid.innerHTML='';
  const first=new Date(calY,calM,1),last=new Date(calY,calM+1,0),td=tod();
  let dow=(first.getDay()+6)%7;
  for(let i=0;i<dow;i++){const d=new Date(calY,calM,1-dow+i);mkDay(grid,d.getDate(),d.toISOString().slice(0,10),true);}
  for(let i=1;i<=last.getDate();i++){const d=new Date(calY,calM,i);const ds=d.toISOString().slice(0,10);mkDay(grid,i,ds,false,ds===td);}
  const rem=(7-(dow+last.getDate())%7)%7;
  for(let i=1;i<=rem;i++){const d=new Date(calY,calM+1,i);mkDay(grid,i,d.toISOString().slice(0,10),true);}
  document.getElementById('cfg-date').value=D.config.refDate;document.getElementById('cfg-team').value=D.config.refTeam;
}
function mkDay(grid,num,ds,om,isT){
  const div=document.createElement('div');div.className='cal-d'+(om?' om':'')+(isT?' today':'');
  const team=getTeam(ds);const cls={A:'ba',B:'bb',C:'bc',D:'bd'}[team];
  const hasSit=(D.sitreps||[]).some(s=>s.date===ds);const hasRpt=!!(D.rapports||{})[ds];
  div.innerHTML=`<div style="font-size:9px;color:var(--color-text-secondary);margin-bottom:2px;display:flex;justify-content:space-between">${num}<span>${hasRpt?'●':''}${hasSit?'◆':''}</span></div><span class="badge ${cls}" style="font-size:8px;padding:1px 4px">${team}</span>`;
  div.onclick=()=>showCalDetail(ds);grid.appendChild(div);
}
function showCalDetail(ds){
  const det=document.getElementById('cal-detail');det.style.display='block';
  document.getElementById('cal-det-title').textContent=fmt(ds)+' — Équipe '+getTeam(ds);
  const team=getTeam(ds);const ops=tOps(team);let h=tBadge(team);
  if(ops.length){h+='<div class="tw" style="margin-top:8px"><table><thead><tr><th>Nom</th><th>Grade</th><th>Poste</th></tr></thead><tbody>';ops.forEach(o=>{h+=`<tr><td>${o.nom} ${o.prenom}</td><td>${o.grade}</td><td>${POSTES[o.poste]||o.poste}</td></tr>`;});h+='</tbody></table></div>';}
  const sits=(D.sitreps||[]).filter(s=>s.date===ds);
  if(sits.length)h+=`<div style="margin-top:8px;font-size:11px;color:var(--color-text-secondary)">${sits.length} SITREP(s) ce jour</div>`;
  document.getElementById('cal-det-body').innerHTML=h;
}

function renderOps(){
  const filt=document.getElementById('filter-eq').value;let ops=D.operators;if(filt)ops=ops.filter(o=>o.equipe===filt);
  const tbody=document.getElementById('ops-body');tbody.innerHTML='';
  if(!ops.length){tbody.innerHTML='<tr><td colspan="6"><div class="empty">Aucun opérateur</div></td></tr>';return;}
  ops.forEach(o=>{const tr=document.createElement('tr');const isSup=o.poste==='supervision';tr.innerHTML=`<td><span style="font-weight:600">${o.nom}</span> ${o.prenom}</td><td style="color:var(--color-text-secondary)">${o.grade}</td><td>${tBadge(o.equipe)}</td><td>${isSup?'<span class="badge bsup">Superviseur</span>':(POSTES[o.poste]||o.poste)}</td><td><span class="badge ${o.actif?'bv':'br'}">${o.actif?'Actif':'Inactif'}</span></td><td><div class="flex"><button class="btn" style="font-size:10px;padding:2px 7px" onclick="editOp('${o.id}')">Modifier</button><button class="btn btn-danger" style="font-size:10px;padding:2px 7px" onclick="delOp('${o.id}')">Suppr.</button></div></td>`;tbody.appendChild(tr);});
}
function showOpForm(reset){const p=document.getElementById('op-form');p.style.display='block';if(reset){document.getElementById('op-form-title').textContent='Nouvel opérateur';['op-nom','op-prenom','op-grade'].forEach(id=>document.getElementById(id).value='');document.getElementById('op-eq').value='A';document.getElementById('op-poste').value='chef';document.getElementById('op-actif').value='1';document.getElementById('op-edit-id').value='';}}
function editOp(id){const o=gOp(id);if(!o)return;document.getElementById('op-form-title').textContent='Modifier';document.getElementById('op-nom').value=o.nom;document.getElementById('op-prenom').value=o.prenom;document.getElementById('op-grade').value=o.grade;document.getElementById('op-eq').value=o.equipe;document.getElementById('op-poste').value=o.poste;document.getElementById('op-actif').value=o.actif?'1':'0';document.getElementById('op-edit-id').value=id;document.getElementById('op-form').style.display='block';}
async function saveOp(){const nom=document.getElementById('op-nom').value.trim().toUpperCase();const prenom=document.getElementById('op-prenom').value.trim();const grade=document.getElementById('op-grade').value.trim().toUpperCase();const equipe=document.getElementById('op-eq').value;const poste=document.getElementById('op-poste').value;const actif=document.getElementById('op-actif').value==='1';if(!nom||!prenom){alert('Nom et prénom requis');return;}const eid=document.getElementById('op-edit-id').value;if(eid){const o=gOp(eid);if(o)Object.assign(o,{nom,prenom,grade,equipe,poste,actif});}else D.operators.push({id:gid(),nom,prenom,grade,equipe,poste,actif});await sv();document.getElementById('op-form').style.display='none';renderOps();}
async function delOp(id){if(!confirm('Supprimer ?'))return;D.operators=D.operators.filter(o=>o.id!==id);await sv();renderOps();}

function loadRpt(){const date=document.getElementById('rpt-date').value;if(!date){alert('Sélectionnez une date');return;}curRptDate=date;const eq=getTeam(date);if(!D.rapports[date])D.rapports[date]={equipe:eq,chef:'',observations:'',evenements:[]};const r=D.rapports[date];document.getElementById('rpt-title').textContent='RAPPORT DU '+fmt(date);document.getElementById('rpt-sub').textContent='Quart 24h';document.getElementById('rpt-badge').innerHTML=tBadge(eq);const sel=document.getElementById('rpt-chef');sel.innerHTML='<option value="">-- Sélectionner --</option>';tOps(eq).forEach(o=>{const opt=document.createElement('option');opt.value=o.id;opt.textContent=o.grade+' '+o.nom+' '+o.prenom;if(o.id===r.chef)opt.selected=true;sel.appendChild(opt);});document.getElementById('rpt-obs').value=r.observations||'';document.getElementById('rpt-content').style.display='block';document.getElementById('ev-form').style.display='none';renderEvList();}
function renderEvList(){const r=D.rapports[curRptDate];if(!r)return;const evs=(r.evenements||[]).slice().sort((a,b)=>a.heure.localeCompare(b.heure));const el=document.getElementById('ev-list');if(!evs.length){el.innerHTML='<div class="empty">Aucun événement</div>';return;}el.innerHTML=evs.map((ev,i)=>`<div class="ev-item"><div class="flex-b" style="margin-bottom:3px"><div class="flex"><span style="font-size:13px;font-weight:600;font-family:'Share Tech Mono',monospace">${ev.heure}</span><span class="badge ${EV_C[ev.type]||'bi'}">${EV_L[ev.type]}</span></div><button class="btn btn-danger" style="padding:2px 7px;font-size:10px" onclick="delEv(${i})">×</button></div><div style="font-size:12px">${ev.description}</div></div>`).join('');}
async function saveRptMeta(){if(!curRptDate)return;const r=D.rapports[curRptDate];r.chef=document.getElementById('rpt-chef').value;r.observations=document.getElementById('rpt-obs').value;pushN('rapport','Rapport du '+fmt(curRptDate),'Mis à jour — Équipe '+r.equipe);await sv();alert('Entête enregistrée.');}
async function addEv(){const heure=document.getElementById('ev-heure').value;const type=document.getElementById('ev-type').value;const desc=document.getElementById('ev-desc').value.trim();if(!heure||!desc){alert('Heure et description requises');return;}D.rapports[curRptDate].evenements.push({id:gid(),heure,type,description:desc});if(type==='urgence')pushN('urgence','URGENCE — '+fmt(curRptDate)+' à '+heure,desc,true);else pushN('rapport','Événement ('+EV_L[type]+') — '+fmt(curRptDate),heure+' · '+desc);await sv();document.getElementById('ev-heure').value='';document.getElementById('ev-desc').value='';document.getElementById('ev-form').style.display='none';renderEvList();}
async function delEv(i){if(!confirm('Supprimer ?'))return;D.rapports[curRptDate].evenements.splice(i,1);await sv();renderEvList();}
function printRpt(){const r=D.rapports[curRptDate];if(!r)return;const chef=gOp(r.chef);const chefL=chef?chef.grade+' '+chef.nom+' '+chef.prenom:'Non désigné';const evs=(r.evenements||[]).slice().sort((a,b)=>a.heure.localeCompare(b.heure));const ops=tOps(r.equipe);const html=`<html><head><title>Rapport JOCC ${fmt(curRptDate)}</title><style>body{font-family:Arial,sans-serif;font-size:13px;padding:30px;max-width:800px}h1{font-size:16px;border-bottom:2px solid #0d2035;padding-bottom:8px;margin-bottom:16px;color:#0d2035}h2{font-size:13px;font-weight:bold;margin:14px 0 6px;color:#0d2035;border-bottom:1px solid #ddd;padding-bottom:3px}table{width:100%;border-collapse:collapse}th{background:#0d2035;color:#fff;padding:5px 8px;font-size:12px;text-align:left}td{padding:5px 8px;border-bottom:1px solid #eee;font-size:12px}.meta{display:flex;gap:20px;font-size:12px;margin-bottom:14px;padding:10px;background:#f0f4f8}</style></head><body><h1>RAPPORT DE QUART — JOCC / Préfecture Maritime du Bénin</h1><div class="meta"><div>Date : <strong>${fmt(curRptDate)}</strong></div><div>Équipe : <strong>${r.equipe}</strong></div><div>Responsable : <strong>${chefL}</strong></div></div><h2>Équipe</h2><table><tr><th>Nom</th><th>Grade</th><th>Poste</th></tr>${ops.map(o=>`<tr><td>${o.nom} ${o.prenom}</td><td>${o.grade}</td><td>${POSTES[o.poste]||o.poste}</td></tr>`).join('')}</table><h2>Observations</h2><p style="font-size:12px">${r.observations||'Aucune observation particulière.'}</p><h2>Main courante — ${evs.length} événement(s)</h2><table><tr><th style="width:55px">Heure</th><th style="width:80px">Type</th><th>Description</th></tr>${evs.map(e=>`<tr><td>${e.heure}</td><td>${EV_L[e.type]}</td><td>${e.description}</td></tr>`).join('')}${!evs.length?'<tr><td colspan="3" style="text-align:center;color:#999">Aucun événement</td></tr>':''}</table><p style="font-size:10px;color:#999;margin-top:20px;border-top:1px solid #eee;padding-top:8px">Généré le ${new Date().toLocaleString('fr-FR')} — JOCC / Préfecture Maritime — République du Bénin</p><\/body><\/html>`;const w=window.open('','_blank','width=850,height=650');if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),500);}}

function renderAbs(){const tbody=document.getElementById('abs-body');const abs=D.absences||[];tbody.innerHTML='';if(!abs.length){tbody.innerHTML='<tr><td colspan="8"><div class="empty">Aucune absence</div></td></tr>';return;}abs.slice().sort((a,b)=>b.dateDebut.localeCompare(a.dateDebut)).forEach(a=>{const op=gOp(a.operateurId);const opL=op?op.grade+' '+op.nom+' '+op.prenom:'Inconnu';const opTeam=op?tBadge(op.equipe):'';const jours=dBetween(a.dateDebut,a.dateFin);const st=a.statut||'attente';const tr=document.createElement('tr');tr.innerHTML=`<td>${opL}</td><td class="hide-mob">${opTeam}</td><td>${MOTIFS[a.motif]||a.motif}</td><td>${fmt(a.dateDebut)}</td><td class="hide-mob">${fmt(a.dateFin)}</td><td class="hide-mob">${jours}j</td><td><select style="width:auto;padding:3px 6px;font-size:11px" onchange="updAbs('${a.id}',this.value)"><option value="attente" ${st==='attente'?'selected':''}>En attente</option><option value="valide" ${st==='valide'?'selected':''}>Validé</option><option value="refuse" ${st==='refuse'?'selected':''}>Refusé</option></select></td><td><button class="btn btn-danger" style="padding:2px 7px;font-size:10px" onclick="delAbs('${a.id}')">×</button></td>`;tbody.appendChild(tr);});}
function fillAbsOps(){const sel=document.getElementById('abs-op');sel.innerHTML='';D.operators.filter(o=>o.actif).sort((a,b)=>a.equipe.localeCompare(b.equipe)||a.nom.localeCompare(b.nom)).forEach(o=>{const opt=document.createElement('option');opt.value=o.id;opt.textContent=`Éq.${o.equipe} — ${o.grade} ${o.nom} ${o.prenom}`;sel.appendChild(opt);});}
async function saveAbs(){const opId=document.getElementById('abs-op').value;const motif=document.getElementById('abs-motif').value;const debut=document.getElementById('abs-debut').value;const fin=document.getElementById('abs-fin').value;if(!opId||!debut||!fin){alert('Tous les champs requis');return;}if(fin<debut){alert('Date de fin invalide');return;}D.absences.push({id:gid(),operateurId:opId,motif,dateDebut:debut,dateFin:fin,statut:'attente'});const op=gOp(opId);pushN('absence','Absence déclarée',(op?op.grade+' '+op.nom+' '+op.prenom:'')+' — '+MOTIFS[motif]+' du '+fmt(debut)+' au '+fmt(fin));await sv();document.getElementById('abs-form').style.display='none';renderAbs();}
async function updAbs(id,st){const a=D.absences.find(x=>x.id===id);if(a){a.statut=st;await sv();}}
async function delAbs(id){if(!confirm('Supprimer ?'))return;D.absences=D.absences.filter(a=>a.id!==id);await sv();renderAbs();}

function renderSup(){const ss=sups();document.getElementById('sup-sitreps').textContent=(D.sitreps||[]).length;const urgN=(D.notifications||[]).filter(n=>n.urg).length;const unread=(D.notifications||[]).filter(n=>!n.lu).length;document.getElementById('sup-notif-count').textContent=unread;document.getElementById('sup-urgences').textContent=urgN;
let eh='<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">';TEAMS.forEach(t=>{const ops=tOps(t);const isAct=getTeam(tod())===t;eh+=`<div style="padding:10px;border:0.5px solid var(--color-border-tertiary);border-radius:8px;${isAct?'border-color:rgba(200,164,74,.5);':''}" ><div class="flex-b" style="margin-bottom:5px">${tBadge(t)}${isAct?'<span class="badge bv" style="font-size:9px">En service</span>':''}</div><div style="font-size:11px;color:var(--color-text-secondary)">${ops.filter(o=>o.poste!=='supervision').length} op.</div>${ops.filter(o=>o.poste!=='supervision').map(o=>`<div style="font-size:11px;margin-top:2px">${o.nom} <span style="color:var(--color-text-secondary);font-size:10px">(${(POSTES[o.poste]||o.poste).split(' ')[0]})</span></div>`).join('')}</div>`;});
document.getElementById('sup-equipes').innerHTML=eh+'</div>';renderSupN();let sl='';if(!ss.length)sl='<div class="empty">Aucun superviseur</div>';else ss.forEach(s=>{sl+=`<div class="flex-b" style="padding:8px 0;border-bottom:0.5px solid var(--color-border-tertiary)"><div class="flex"><div style="width:30px;height:30px;border-radius:50%;background:rgba(142,100,219,.15);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#9b59b6">${s.nom.slice(0,2)}</div><div><div style="font-weight:600;font-size:13px">${s.grade} ${s.nom} ${s.prenom}</div><div style="font-size:11px;color:var(--color-text-secondary)">Équipe ${s.equipe}</div></div></div><span class="badge bsup">Superviseur</span></div>`;});document.getElementById('sup-list').innerHTML=sl;}
function renderSupN(){const filt=document.getElementById('sup-filter')?.value||'';let notifs=(D.notifications||[]).slice().reverse();if(filt)notifs=notifs.filter(n=>n.type===filt);if(!notifs.length){document.getElementById('sup-notifs').innerHTML='<div class="empty">Aucune notification</div>';return;}document.getElementById('sup-notifs').innerHTML=notifs.map(n=>{const cls=n.urg?'urg':(n.type==='absence'?'inf':'');return`<div class="notif-item ${cls}"><div class="flex-b" style="margin-bottom:2px"><div style="font-size:12px;font-weight:600">${n.titre}</div><div class="flex">${n.urg?'<span class="badge br" style="font-size:9px">Urgence</span>':''}${n.lu?'<span style="font-size:10px;color:var(--color-text-secondary)">Lu</span>':'<span style="font-size:10px;color:#0c447c;font-weight:700">Nouveau</span>'}</div></div><div style="font-size:11px;color:var(--color-text-secondary)">${n.detail}</div><div style="font-size:10px;color:var(--color-text-secondary);margin-top:2px">${new Date(n.ts).toLocaleString('fr-FR')}</div></div>`;}).join('');}

function renderFichiers(){renderConsignes();renderSurveillance();}
function renderConsignes(){const list=document.getElementById('consignes-list');if(!D.consignes||!D.consignes.length){list.innerHTML='<div class="empty">Aucune consigne</div>';return;}list.innerHTML=D.consignes.slice().reverse().map(c=>`<div class="file-item"><div class="flex" style="flex:1;min-width:0"><div style="width:30px;height:30px;border-radius:6px;background:#e6f1fb;color:#0c447c;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0">📄</div><div style="min-width:0"><div style="font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.titre}</div><div style="font-size:11px;color:var(--color-text-secondary)">${c.desc||''}</div><div class="flex" style="margin-top:3px;gap:5px"><span class="badge ${PRIO_C[c.priorite]||'bi'}" style="font-size:9px">${PRIO_L[c.priorite]||'Normale'}</span><span style="font-size:10px;color:var(--color-text-secondary)">${fmt(c.date)}</span>${c.fileData?`<span style="font-size:10px;color:#0c447c;cursor:pointer" onclick="dlFile('${c.id}')">Télécharger</span>`:''}</div></div></div><button class="btn btn-danger" style="font-size:10px;padding:2px 7px;flex-shrink:0" onclick="delConsigne('${c.id}')">×</button></div>`).join('');}
function renderSurveillance(){const list=document.getElementById('surveillance-list');if(!D.captures||!D.captures.length){list.innerHTML='<div class="empty">Aucune capture</div>';return;}list.innerHTML=D.captures.slice().reverse().map(cap=>`<div class="file-item" style="align-items:flex-start"><img src="${cap.dataUrl}" style="width:50px;height:38px;object-fit:cover;border-radius:4px;flex-shrink:0;border:0.5px solid var(--color-border-tertiary)"><div style="flex:1;min-width:0;margin-left:7px"><div style="font-weight:600;font-size:12px">${SRCS[cap.source]||cap.source}</div><div style="font-size:11px;color:var(--color-text-secondary)">${cap.comment||''}</div><div style="font-size:10px;color:var(--color-text-secondary)">${new Date(cap.ts).toLocaleString('fr-FR')}</div></div><div class="flex" style="flex-shrink:0"><button class="btn" style="font-size:10px;padding:2px 7px" onclick="viewCap('${cap.id}')">Voir</button><button class="btn btn-danger" style="font-size:10px;padding:2px 7px" onclick="delCap('${cap.id}')">×</button></div></div>`).join('');}
function dlFile(id){const c=D.consignes.find(x=>x.id===id);if(!c||!c.fileData)return;const a=document.createElement('a');a.href=c.fileData;a.download=c.fileName;a.click();}
function viewCap(id){const cap=D.captures.find(x=>x.id===id);if(!cap)return;const w=window.open('','_blank','width=900,height=700');if(w){w.document.write(`<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${cap.dataUrl}" style="max-width:100%;max-height:100vh;object-fit:contain"><\/body><\/html>`);w.document.close();}}
async function delConsigne(id){if(!confirm('Supprimer ?'))return;D.consignes=D.consignes.filter(c=>c.id!==id);await sv();renderConsignes();}
async function delCap(id){if(!confirm('Supprimer ?'))return;D.captures=D.captures.filter(c=>c.id!==id);await sv();renderSurveillance();}
function rfDU(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsDataURL(file);});}

document.querySelectorAll('.nb').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
document.getElementById('cal-prev').addEventListener('click',()=>{calM--;if(calM<0){calM=11;calY--;}renderCal();});
document.getElementById('cal-next').addEventListener('click',()=>{calM++;if(calM>11){calM=0;calY++;}renderCal();});
document.getElementById('cal-det-close').addEventListener('click',()=>{document.getElementById('cal-detail').style.display='none';});
document.getElementById('btn-save-cfg').addEventListener('click',async()=>{D.config.refDate=document.getElementById('cfg-date').value;D.config.refTeam=document.getElementById('cfg-team').value;await sv();renderCal();renderDash();alert('Configuration enregistrée.');});
document.getElementById('btn-new-op').addEventListener('click',()=>showOpForm(true));
document.getElementById('op-cancel').addEventListener('click',()=>{document.getElementById('op-form').style.display='none';});
document.getElementById('op-save').addEventListener('click',saveOp);
document.getElementById('filter-eq').addEventListener('change',renderOps);
document.getElementById('btn-load-rpt').addEventListener('click',loadRpt);
document.getElementById('btn-save-rpt-meta').addEventListener('click',saveRptMeta);
document.getElementById('btn-show-ev').addEventListener('click',()=>{document.getElementById('ev-form').style.display='block';document.getElementById('ev-heure').value=nowT();});
document.getElementById('btn-add-ev').addEventListener('click',addEv);
document.getElementById('btn-cancel-ev').addEventListener('click',()=>{document.getElementById('ev-form').style.display='none';});
document.getElementById('btn-print-rpt').addEventListener('click',printRpt);
document.getElementById('btn-new-abs').addEventListener('click',()=>{fillAbsOps();document.getElementById('abs-debut').value=tod();document.getElementById('abs-fin').value=tod();document.getElementById('abs-form').style.display='block';});
document.getElementById('abs-cancel').addEventListener('click',()=>{document.getElementById('abs-form').style.display='none';});
document.getElementById('abs-save').addEventListener('click',saveAbs);
document.getElementById('btn-clear-notifs').addEventListener('click',async()=>{if(!confirm('Effacer toutes les notifications ?'))return;D.notifications=[];await sv();renderSup();});
document.getElementById('sup-filter').addEventListener('change',renderSupN);
document.getElementById('btn-new-sitrep').addEventListener('click',()=>openSitrepForm(true));
document.getElementById('sitrep-cancel').addEventListener('click',()=>{document.getElementById('sitrep-form').style.display='none';});
document.getElementById('sitrep-cancel2').addEventListener('click',()=>{document.getElementById('sitrep-form').style.display='none';});
document.getElementById('sit-save').addEventListener('click',saveSitrep);
document.getElementById('sitrep-filter-eq').addEventListener('change',renderSitrep);
document.getElementById('sitrep-filter-date').addEventListener('change',renderSitrep);
document.getElementById('btn-add-consigne').addEventListener('click',()=>{document.getElementById('consigne-form').style.display='block';});
document.getElementById('cs-cancel').addEventListener('click',()=>{document.getElementById('consigne-form').style.display='none';});
document.getElementById('cs-file').addEventListener('change',async function(){if(!this.files||!this.files[0])return;const file=this.files[0];if(file.size>5*1024*1024){alert('Fichier trop volumineux');return;}csFD={name:file.name,data:await rfDU(file)};document.getElementById('cs-file-preview').style.display='block';document.getElementById('cs-file-preview').textContent='Fichier : '+file.name;});
document.getElementById('cs-save').addEventListener('click',async function(){const titre=document.getElementById('cs-titre').value.trim();const desc=document.getElementById('cs-desc').value.trim();const prio=document.getElementById('cs-prio').value;if(!titre){alert('Titre requis');return;}const c={id:gid(),titre,desc,priorite:prio,date:tod()};if(csFD){c.fileData=csFD.data;c.fileName=csFD.name;}D.consignes.push(c);pushN('rapport','Nouvelle consigne : '+titre,'Priorité '+PRIO_L[prio]);await sv();document.getElementById('consigne-form').style.display='none';document.getElementById('cs-titre').value='';document.getElementById('cs-desc').value='';csFD=null;document.getElementById('cs-file-preview').style.display='none';renderConsignes();});
document.getElementById('surv-file').addEventListener('change',async function(){if(!this.files||!this.files[0])return;const file=this.files[0];if(file.size>5*1024*1024){alert('Image trop volumineuse');return;}const data=await rfDU(file);survFD={name:file.name,dataUrl:data};document.getElementById('surv-img-prev').src=data;document.getElementById('surv-preview').style.display='block';document.getElementById('surv-meta-form').style.display='block';});
document.getElementById('surv-save').addEventListener('click',async function(){if(!survFD){alert('Aucune image');return;}const source=document.getElementById('surv-source').value;const comment=document.getElementById('surv-comment').value.trim();D.captures.push({id:gid(),source,comment,dataUrl:survFD.dataUrl,ts:new Date().toISOString()});pushN('rapport','Capture '+SRCS[source]+' ajoutée',comment);await sv();document.getElementById('surv-meta-form').style.display='none';document.getElementById('surv-preview').style.display='none';survFD=null;document.getElementById('surv-comment').value='';renderSurveillance();});
document.getElementById('surv-cancel').addEventListener('click',()=>{document.getElementById('surv-meta-form').style.display='none';document.getElementById('surv-preview').style.display='none';survFD=null;});
document.getElementById('rpt-date').value=tod();

// ══════════ MODULE ESCORTE ══════════
var ESC_TY_L={entree:'Escorte entrée',sortie:'Escorte sortie','aller-retour':'Aller-retour'};
var ESC_ST_L={planifiee:'Planifiée',encours:'En cours',terminee:'Terminée',annulee:'Annulée'};
var ESC_ST_C={planifiee:'bgold',encours:'bv',terminee:'bi',annulee:'br'};
var ESC_ST_I={planifiee:'📅',encours:'⚓',terminee:'✔',annulee:'✕'};
var CIBLE_TY={cargo:'Cargo',petrolier:'Pétrolier/Tanker',vraquier:'Vraquier',conteneur:'Porte-cont.',passagers:'Passagers',roro:'Ro-Ro',gazier:'Gazier',chimquier:'Chimiquier',peche:'Pêche',remorqueur:'Remorqueur',autre:'Autre'};
var NAV_TY={patrouilleur:'Patrouilleur',vedette:'Vedette rapide',aviso:'Aviso',fregatte:'Frégate',corvette:'Corvette',bac:'Bt. commandement',autre:'Autre'};

function renderEscorte(){
  if(!D.escortes)D.escortes=[];
  var fSt=(document.getElementById('esc-flt-st')||{}).value||'';
  var fTy=(document.getElementById('esc-flt-ty')||{}).value||'';
  var fDt=(document.getElementById('esc-flt-dt')||{}).value||'';
  var list=D.escortes.slice().sort(function(a,b){
    var dc=b.date.localeCompare(a.date);
    return dc!==0?dc:b.heure.localeCompare(a.heure);
  });
  if(fSt)list=list.filter(function(e){return e.statut===fSt;});
  if(fTy)list=list.filter(function(e){return e.type===fTy;});
  if(fDt)list=list.filter(function(e){return e.date===fDt;});
  document.getElementById('esc-count-lbl').textContent=list.length+' mission(s)';
  document.getElementById('esg-total').textContent=D.escortes.length;
  document.getElementById('esg-encours').textContent=D.escortes.filter(function(e){return e.statut==='encours';}).length;
  document.getElementById('esg-plan').textContent=D.escortes.filter(function(e){return e.statut==='planifiee';}).length;
  document.getElementById('esg-done').textContent=D.escortes.filter(function(e){return e.statut==='terminee';}).length;
  if(!list.length){
    document.getElementById('escorte-list').innerHTML='<div class="empty">Aucune mission enregistrée — cliquez sur "+ Nouvelle mission"</div>';
    return;
  }
  var html='';
  list.forEach(function(e){html+=buildEscCard(e);});
  document.getElementById('escorte-list').innerHTML=html;
}

function eRow(l,v){
  if(!v)return'';
  return '<div style="padding:3px 0;font-size:11px"><span style="color:var(--color-text-secondary)">'+l+' : </span><strong>'+v+'</strong></div>';
}
function eMeta(l,v){
  if(!v)return'<div></div>';
  return '<div style="background:var(--color-background-secondary);border:1px solid var(--color-border-tertiary);border-radius:6px;padding:5px 8px">'
    +'<div style="font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-secondary)">'+l+'</div>'
    +'<div style="font-weight:600;font-size:11px;margin-top:2px">'+v+'</div></div>';
}

function buildEscCard(e){
  var sc=ESC_ST_C[e.statut]||'bi';
  var sl=ESC_ST_L[e.statut]||e.statut;
  var si=ESC_ST_I[e.statut]||'';
  var opts='';
  ['planifiee','encours','terminee','annulee'].forEach(function(s){
    opts+='<option value="'+s+'"'+(e.statut===s?' selected':'')+'>'+ESC_ST_I[s]+' '+ESC_ST_L[s]+'</option>';
  });
  var card=document.createElement('div');
  card.className='card-section mb10';
  var header=''
    +'<div class="card-section-header">'
    +'<div class="flex">'
    +'<div style="background:linear-gradient(135deg,rgba(13,32,53,.9),rgba(26,46,74,.8));border:1.5px solid rgba(200,164,74,.4);border-radius:8px;padding:4px 11px;font-family:monospace;font-size:13px;font-weight:700;color:rgba(200,164,74,.9)">'+(e.num||'ESC')+'</div>'
    +'<div><div style="font-weight:700;font-size:13px">'+(e.cible_nom||'Navire N/A')
    +' <span style="font-weight:400;font-size:11px;color:var(--color-text-secondary)">&#8596; '+(e.nav_nom||'Escorteur N/A')+'</span></div>'
    +'<div style="font-size:11px;color:var(--color-text-secondary)">'+fmt(e.date)+' &middot; App. '+(e.heure||'&mdash;')+' &middot; '+(ESC_TY_L[e.type]||e.type)+'</div>'
    +'</div></div>'
    +'<div class="flex"><span class="badge '+sc+'">'+si+' '+sl+'</span>'
    +'<select style="font-size:11px;padding:3px 7px;width:auto" onchange="updEscStatut(\''+e.id+'\',this.value)">'+opts+'</select>'
    +'</div></div>';
  var cibleBox=''
    +'<div><div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(74,127,165,.9);margin-bottom:8px">&#x1F6A2; Navire à escorter</div>'
    +'<div style="background:rgba(74,127,165,.07);border:1px solid rgba(74,127,165,.2);border-radius:8px;padding:10px">'
    +'<div style="font-size:14px;font-weight:700;margin-bottom:6px">'+(e.cible_nom||'&mdash;')+'</div>'
    +eRow('MMSI',e.cible_mmsi)+eRow('IMO',e.cible_imo)+eRow('Indicatif',e.cible_cs)
    +eRow('Pavillon',e.cible_pavillon)+eRow('Type',CIBLE_TY[e.cible_type]||e.cible_type)
    +eRow('LOA',e.cible_loa?e.cible_loa+' m':'')
    +eRow('GT',e.cible_gt?Number(e.cible_gt).toLocaleString('fr-FR'):'')
    +eRow('Tirant',e.cible_draft?e.cible_draft+' m':'')
    +eRow('De',e.cible_from)+eRow('Vers',e.cible_to)+eRow('Cargaison',e.cible_cargo)
    +'</div></div>';
  var navBox=''
    +'<div><div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(200,164,74,.9);margin-bottom:8px">&#x26F5; Navire escorteur</div>'
    +'<div style="background:rgba(200,164,74,.06);border:1px solid rgba(200,164,74,.25);border-radius:8px;padding:10px">'
    +'<div style="font-size:14px;font-weight:700;margin-bottom:6px;color:rgba(200,164,74,.9)">'+(e.nav_nom||'&mdash;')+'</div>'
    +eRow('MMSI',e.nav_mmsi)+eRow('Indicatif',e.nav_cs)
    +eRow('Pavillon',e.nav_pavillon||'Bénin')+eRow('Type',NAV_TY[e.nav_type]||e.nav_type)
    +eRow('LOA',e.nav_loa?e.nav_loa+' m':'')
    +eRow('Commandant',e.nav_cmd)+eRow('VHF',e.nav_vhf)
    +eRow('Effectif',e.nav_effectif?e.nav_effectif+' pers.':'')
    +eRow('Armement',e.nav_arm)
    +'</div></div>';
  var metaRow=''
    +'<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--color-border-tertiary);display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">'
    +eMeta('Zone',e.zone)+eMeta('Rendez-vous',e.rdv)+eMeta('Durée',e.duree)
    +eMeta('Équipe',e.equipe?'Équipe '+e.equipe:'')
    +'</div>';
  var obsRow=e.comment
    ?'<div style="margin-top:10px;background:var(--color-background-secondary);border:1px solid var(--color-border-tertiary);border-radius:7px;padding:9px;font-size:12px">'
      +'<span style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-secondary)">Observations &mdash; </span>'+e.comment+'</div>'
    :'';
  var actions=''
    +'<div class="flex" style="margin-top:10px;justify-content:flex-end">'
    +'<button class="btn btn-info" style="font-size:10px;padding:3px 9px" onclick="printEsc(\''+e.id+'\')">&#x1F5A8; OPLAN</button>'
    +'<button class="btn btn-gold" style="font-size:10px;padding:3px 9px" onclick="editEsc(\''+e.id+'\')">&#x270F; Modifier</button>'
    +'<button class="btn btn-danger" style="font-size:10px;padding:3px 9px" onclick="delEsc(\''+e.id+'\')">&#x1F5D1; Supprimer</button>'
    +'</div>';
  card.innerHTML=header
    +'<div class="card-section-body">'
    +'<div class="g2" style="gap:12px">'+cibleBox+navBox+'</div>'
    +metaRow+obsRow+actions
    +'</div>';
  return card.outerHTML;
}

function openEscForm(reset){
  document.getElementById('escorte-form').style.display='block';
  if(reset){
    document.getElementById('escorte-form-title').textContent="Nouvelle mission d'escorte";
    var n=(D.escortes||[]).length+1;
    var ns='ESC-'+(n<10?'00':n<100?'0':'')+n;
    document.getElementById('esc-num').value=ns;
    document.getElementById('esc-date').value=tod();
    document.getElementById('esc-heure').value=nowT();
    document.getElementById('esc-equipe').value=getTeam(tod());
    document.getElementById('esc-type').value='entree';
    document.getElementById('esc-nav-pavillon').value='Bénin';
    ['esc-zone','esc-rdv','esc-duree',
     'esc-cible-nom','esc-cible-mmsi','esc-cible-imo','esc-cible-cs','esc-cible-pavillon',
     'esc-cible-loa','esc-cible-gt','esc-cible-draft','esc-cible-from','esc-cible-to',
     'esc-cible-cargo','esc-cible-eta',
     'esc-nav-nom','esc-nav-mmsi','esc-nav-cs','esc-nav-loa',
     'esc-nav-cmd','esc-nav-vhf','esc-nav-effectif','esc-nav-arm','esc-comment'
    ].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('esc-edit-id').value='';
  }
  document.getElementById('escorte-form').scrollIntoView({behavior:'smooth',block:'start'});
}

function editEsc(id){
  var e=(D.escortes||[]).find(function(x){return x.id===id;});
  if(!e)return;
  document.getElementById('escorte-form-title').textContent='Modifier — Mission '+e.num;
  var flds={
    'esc-num':e.num,'esc-date':e.date,'esc-heure':e.heure,
    'esc-zone':e.zone,'esc-rdv':e.rdv,'esc-duree':e.duree,
    'esc-cible-nom':e.cible_nom,'esc-cible-mmsi':e.cible_mmsi,'esc-cible-imo':e.cible_imo,
    'esc-cible-cs':e.cible_cs,'esc-cible-pavillon':e.cible_pavillon,
    'esc-cible-loa':e.cible_loa,'esc-cible-gt':e.cible_gt,'esc-cible-draft':e.cible_draft,
    'esc-cible-from':e.cible_from,'esc-cible-to':e.cible_to,
    'esc-cible-eta':e.cible_eta,'esc-cible-cargo':e.cible_cargo,
    'esc-nav-nom':e.nav_nom,'esc-nav-mmsi':e.nav_mmsi,'esc-nav-cs':e.nav_cs,
    'esc-nav-pavillon':e.nav_pavillon,'esc-nav-loa':e.nav_loa,
    'esc-nav-cmd':e.nav_cmd,'esc-nav-vhf':e.nav_vhf,
    'esc-nav-effectif':e.nav_effectif,'esc-nav-arm':e.nav_arm,'esc-comment':e.comment
  };
  Object.keys(flds).forEach(function(k){var el=document.getElementById(k);if(el&&flds[k])el.value=flds[k];});
  document.getElementById('esc-type').value=e.type||'entree';
  document.getElementById('esc-equipe').value=e.equipe||'A';
  document.getElementById('esc-cible-type').value=e.cible_type||'cargo';
  document.getElementById('esc-nav-type').value=e.nav_type||'patrouilleur';
  document.getElementById('esc-edit-id').value=id;
  document.getElementById('escorte-form').style.display='block';
  document.getElementById('escorte-form').scrollIntoView({behavior:'smooth',block:'start'});
}

async function saveEsc(){
  var num=document.getElementById('esc-num').value.trim();
  var cnom=document.getElementById('esc-cible-nom').value.trim();
  if(!num||!cnom){alert('Le numéro de mission et le nom du navire à escorter sont obligatoires');return;}
  var e={
    id:document.getElementById('esc-edit-id').value||gid(),
    num:num,date:document.getElementById('esc-date').value,
    heure:document.getElementById('esc-heure').value,
    type:document.getElementById('esc-type').value,
    equipe:document.getElementById('esc-equipe').value,
    zone:document.getElementById('esc-zone').value,
    rdv:document.getElementById('esc-rdv').value,
    duree:document.getElementById('esc-duree').value,
    cible_nom:cnom.toUpperCase(),
    cible_mmsi:document.getElementById('esc-cible-mmsi').value,
    cible_imo:document.getElementById('esc-cible-imo').value,
    cible_cs:document.getElementById('esc-cible-cs').value,
    cible_pavillon:document.getElementById('esc-cible-pavillon').value,
    cible_type:document.getElementById('esc-cible-type').value,
    cible_loa:document.getElementById('esc-cible-loa').value,
    cible_gt:document.getElementById('esc-cible-gt').value,
    cible_draft:document.getElementById('esc-cible-draft').value,
    cible_from:document.getElementById('esc-cible-from').value,
    cible_to:document.getElementById('esc-cible-to').value,
    cible_eta:document.getElementById('esc-cible-eta').value,
    cible_cargo:document.getElementById('esc-cible-cargo').value,
    nav_nom:document.getElementById('esc-nav-nom').value.toUpperCase(),
    nav_mmsi:document.getElementById('esc-nav-mmsi').value,
    nav_cs:document.getElementById('esc-nav-cs').value,
    nav_pavillon:document.getElementById('esc-nav-pavillon').value,
    nav_type:document.getElementById('esc-nav-type').value,
    nav_loa:document.getElementById('esc-nav-loa').value,
    nav_cmd:document.getElementById('esc-nav-cmd').value,
    nav_vhf:document.getElementById('esc-nav-vhf').value,
    nav_effectif:document.getElementById('esc-nav-effectif').value,
    nav_arm:document.getElementById('esc-nav-arm').value,
    comment:document.getElementById('esc-comment').value,
    statut:'planifiee',ts:new Date().toISOString()
  };
  if(!D.escortes)D.escortes=[];
  var eid=document.getElementById('esc-edit-id').value;
  if(eid){
    var idx=D.escortes.findIndex(function(x){return x.id===eid;});
    if(idx>=0){e.statut=D.escortes[idx].statut;D.escortes[idx]=e;}
    else D.escortes.push(e);
  } else {
    D.escortes.push(e);
  }
  pushN('escorte','Mission '+num+' — '+(ESC_TY_L[e.type]||e.type),e.cible_nom+' / '+e.nav_nom+' — App. '+e.heure);
  await sv();
  document.getElementById('escorte-form').style.display='none';
  renderEscorte();
}

async function updEscStatut(id,st){
  var e=(D.escortes||[]).find(function(x){return x.id===id;});
  if(e){
    e.statut=st;
    pushN('escorte','Mission '+e.num+' — '+(ESC_ST_L[st]||st),e.cible_nom+' / '+e.nav_nom);
    await sv();
    renderEscorte();
  }
}

async function delEsc(id){
  if(!confirm("Supprimer définitivement cette mission d'escorte ?"))return;
  D.escortes=(D.escortes||[]).filter(function(e){return e.id!==id;});
  await sv();
  renderEscorte();
}

function printEsc(id){
  var e=(D.escortes||[]).find(function(x){return x.id===id;});
  if(!e)return;
  var doc=window.open('','_blank','width=950,height=750');
  if(!doc)return;
  var r=function(l,v){return '<div class="r"><div class="lb">'+l+'</div><div>'+(v||'&mdash;')+'</div></div>';};
  doc.document.open();
  doc.document.write('<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">');
  doc.document.write('<title>OPLAN '+e.num+'</title>');
  doc.document.write('<style>');
  doc.document.write('body{font-family:Arial,sans-serif;font-size:12px;padding:25px;max-width:900px;margin:0 auto}');
  doc.document.write('h1{font-size:16px;border-bottom:3px solid #0d2035;padding-bottom:7px;margin-bottom:14px;color:#0d2035}');
  doc.document.write('h2{font-size:11px;font-weight:bold;margin:14px 0 7px;color:#0d2035;border-bottom:1px solid #ccc;padding-bottom:3px;text-transform:uppercase;letter-spacing:.06em}');
  doc.document.write('.hb{background:#0d2035;color:#fff;padding:12px 16px;border-radius:4px;margin-bottom:16px;display:flex;justify-content:space-between}');
  doc.document.write('.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}');
  doc.document.write('.box{border:1.5px solid #ccc;border-radius:4px;padding:10px}');
  doc.document.write('.bt{font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;color:#0d2035;margin-bottom:7px;padding-bottom:3px;border-bottom:1px solid #eee}');
  doc.document.write('.r{display:flex;padding:3px 0;border-bottom:1px solid #f5f5f5;font-size:11px}.r:last-child{border-bottom:none}');
  doc.document.write('.lb{width:120px;color:#555;flex-shrink:0;font-weight:bold}');
  doc.document.write('.meta{display:flex;gap:16px;font-size:11px;margin-bottom:14px;padding:8px;background:#f0f4f8;border-radius:4px}');
  doc.document.write('.sig{margin-top:36px;display:grid;grid-template-columns:1fr 1fr;gap:40px}');
  doc.document.write('.sl{border-top:2px solid #000;padding-top:5px;font-size:10px}');
  doc.document.write('@media print{.hb{-webkit-print-color-adjust:exact;print-color-adjust:exact}}');
  doc.document.write('</style></head><body>');
  doc.document.write('<div class="hb"><div>');
  doc.document.write('<div style="font-size:15px;font-weight:bold;letter-spacing:.05em">PRÉFECTURE MARITIME &middot; JOCC</div>');
  doc.document.write('<div style="font-size:10px;margin-top:2px;opacity:.8">République du Bénin &middot; Ordre de mission escorte</div>');
  doc.document.write('</div><div style="font-size:10px;opacity:.8">'+new Date().toLocaleDateString('fr-FR',{weekday:'long',year:'numeric',month:'long',day:'numeric'})+'</div></div>');
  doc.document.write('<h1>OPLAN ESCORTE N° '+e.num+'</h1>');
  doc.document.write('<div class="meta">');
  doc.document.write('<div>Date : <strong>'+fmt(e.date)+'</strong></div>');
  doc.document.write('<div>Appareillage : <strong>'+(e.heure||'&mdash;')+'</strong></div>');
  doc.document.write('<div>Type : <strong>'+(ESC_TY_L[e.type]||e.type)+'</strong></div>');
  doc.document.write('<div>Équipe : <strong>'+(e.equipe||'&mdash;')+'</strong></div>');
  doc.document.write('<div>Statut : <strong>'+(ESC_ST_L[e.statut]||e.statut)+'</strong></div>');
  doc.document.write('</div>');
  doc.document.write('<div class="g2">');
  doc.document.write('<div class="box"><div class="bt">Navire à escorter</div>');
  doc.document.write(r('Nom','<strong>'+(e.cible_nom||'&mdash;')+'</strong>'));
  doc.document.write(r('MMSI',e.cible_mmsi)+r('IMO',e.cible_imo)+r('Indicatif',e.cible_cs));
  doc.document.write(r('Pavillon',e.cible_pavillon)+r('Type',CIBLE_TY[e.cible_type]||'&mdash;'));
  doc.document.write(r('LOA',e.cible_loa?e.cible_loa+' m':''));
  doc.document.write(r('GT',e.cible_gt?Number(e.cible_gt).toLocaleString('fr-FR'):''));
  doc.document.write(r('Tirant',e.cible_draft?e.cible_draft+' m':''));
  doc.document.write(r('De',e.cible_from)+r('Vers',e.cible_to)+r('Cargaison',e.cible_cargo));
  doc.document.write('</div>');
  doc.document.write('<div class="box"><div class="bt">Escorteur (Marine Nationale)</div>');
  doc.document.write(r('Bâtiment','<strong>'+(e.nav_nom||'&mdash;')+'</strong>'));
  doc.document.write(r('MMSI',e.nav_mmsi)+r('Indicatif',e.nav_cs));
  doc.document.write(r('Pavillon',e.nav_pavillon||'Bénin')+r('Type',NAV_TY[e.nav_type]||'&mdash;'));
  doc.document.write(r('LOA',e.nav_loa?e.nav_loa+' m':''));
  doc.document.write(r('Commandant','<strong>'+(e.nav_cmd||'&mdash;')+'</strong>'));
  doc.document.write(r('VHF travail',e.nav_vhf)+r('Effectif',e.nav_effectif?e.nav_effectif+' pers.':''));
  doc.document.write(r('Armement',e.nav_arm));
  doc.document.write('</div></div>');
  doc.document.write('<h2>Paramètres de mission</h2>');
  doc.document.write(r('Zone',e.zone)+r('Rendez-vous',e.rdv)+r('Durée estimée',e.duree));
  if(e.comment){
    doc.document.write('<h2>Observations / Instructions</h2>');
    doc.document.write('<div style="background:#f8f8f8;border:1px solid #ddd;padding:9px;border-radius:4px">'+e.comment+'</div>');
  }
  doc.document.write('<div class="sig"><div class="sl">Signature du Commandant de mission</div><div class="sl">Visa du Chef de quart JOCC</div></div>');
  doc.document.write('<p style="font-size:9px;color:#999;margin-top:18px;border-top:1px solid #eee;padding-top:7px">');
  doc.document.write('Généré le '+new Date().toLocaleString('fr-FR')+' &mdash; Préfecture Maritime &middot; JOCC &mdash; République du Bénin</p>');
  doc.document.close();
  setTimeout(function(){doc.print();},600);
}

document.getElementById('btn-new-escorte').addEventListener('click',function(){openEscForm(true);});
document.getElementById('escorte-cancel').addEventListener('click',function(){document.getElementById('escorte-form').style.display='none';});
document.getElementById('esc-cancel2').addEventListener('click',function(){document.getElementById('escorte-form').style.display='none';});
document.getElementById('esc-save').addEventListener('click',saveEsc);
document.getElementById('esc-flt-st').addEventListener('change',renderEscorte);
document.getElementById('esc-flt-ty').addEventListener('change',renderEscorte);
document.getElementById('esc-flt-dt').addEventListener('change',renderEscorte);

load().then(()=>showTab('dashboard'));
