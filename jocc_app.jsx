import { useState, useEffect, useCallback } from "react";

const LOGO_B64 = "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";

// ─── Constants ────────────────────────────────────────────────
const TEAMS = ["A","B","C","D"];
const POSTES = { chef:"Chef de quart", veille:"Op. de veille", radio:"Op. radio", permanence:"Off. permanence", supervision:"Superviseur" };
const EV_L = { routine:"Routine", info:"Information", urgence:"Urgence" };
const EV_C = { routine:"info", info:"info", urgence:"destructive" };
const MOTIFS = { maladie:"Maladie", conge:"Congé", formation:"Formation", mission:"Mission", autre:"Autre" };
const PRIO_VAR = { normal:"bg-blue-50 text-blue-700 border-blue-200", important:"bg-amber-50 text-amber-700 border-amber-200", urgent:"bg-red-50 text-red-700 border-red-200" };
const PRIO_L = { normal:"Normale", important:"Importante", urgent:"Urgente" };
const SRCS = { vtmis:"VTMIS", ais:"AIS", radar:"Radar", camera:"Caméra", autre:"Autre" };
const TEAM_CLR = { A:"bg-blue-50 text-blue-700 border-blue-200", B:"bg-emerald-50 text-emerald-700 border-emerald-200", C:"bg-amber-50 text-amber-700 border-amber-200", D:"bg-rose-50 text-rose-700 border-rose-200" };
const TEAM_BG = { A:"bg-blue-600", B:"bg-emerald-600", C:"bg-amber-500", D:"bg-rose-600" };

// ─── Helpers ──────────────────────────────────────────────────
const tod = () => new Date().toISOString().slice(0,10);
const gid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const fmt = d => { if(!d) return "—"; const p=d.split("-"); return `${p[2]}/${p[1]}/${p[0]}`; };
const nowT = () => new Date().toTimeString().slice(0,5);
const getTeam = (ds, cfg) => {
  if(!cfg?.refDate) return "A";
  const ref = new Date(cfg.refDate+"T12:00:00"), d = new Date(ds+"T12:00:00");
  const diff = Math.round((d-ref)/86400000);
  return TEAMS[((TEAMS.indexOf(cfg.refTeam)+diff)%4+4)%4];
};

// ─── UI Primitives ────────────────────────────────────────────
const Badge = ({variant="default",cls="",children}) => {
  const styles = {
    default:"bg-slate-100 text-slate-700 border border-slate-200",
    info:"bg-blue-50 text-blue-700 border border-blue-200",
    success:"bg-emerald-50 text-emerald-700 border border-emerald-200",
    warning:"bg-amber-50 text-amber-700 border border-amber-200",
    destructive:"bg-red-50 text-red-700 border border-red-200",
    sup:"bg-purple-50 text-purple-700 border border-purple-200",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[variant]||styles.default} ${cls}`}>{children}</span>;
};

const TeamBadge = ({team}) => {
  const v = {A:"info",B:"success",C:"warning",D:"destructive"}[team]||"default";
  return <Badge variant={v}>Éq. {team}</Badge>;
};

const Btn = ({onClick,variant="outline",size="sm",disabled,cls="",children}) => {
  const base = "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors focus:outline-none disabled:opacity-50 cursor-pointer";
  const sizes = {sm:"px-3 py-1.5 text-xs", md:"px-4 py-2 text-sm"};
  const variants = {
    outline:"border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    primary:"border border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
    ghost:"bg-transparent text-slate-600 hover:bg-slate-100",
    danger:"border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    gold:"border border-amber-300 bg-amber-500 text-white hover:bg-amber-600",
  };
  return <button onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]||sizes.sm} ${variants[variant]||variants.outline} ${cls}`}>{children}</button>;
};

const Card = ({cls="",children}) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${cls}`}>{children}</div>
);

const Input = ({id,type="text",value,onChange,placeholder,className=""}) => (
  <input id={id} type={type} value={value} onChange={onChange} placeholder={placeholder}
    className={`w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`} />
);

const Select = ({id,value,onChange,children,className=""}) => (
  <select id={id} value={value} onChange={onChange}
    className={`w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}>
    {children}
  </select>
);

const Textarea = ({id,value,onChange,rows=3,placeholder=""}) => (
  <textarea id={id} value={value} onChange={onChange} rows={rows} placeholder={placeholder}
    className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
);

const Label = ({children}) => <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{children}</label>;
const FG = ({label,children,cls=""}) => <div className={`mb-3 ${cls}`}><Label>{label}</Label>{children}</div>;

const StatCard = ({label,value,sub}) => (
  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
    <div className="text-2xl font-semibold text-slate-800">{value}</div>
    {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
  </div>
);

const SectionHeader = ({title,action}) => (
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-base font-semibold text-slate-800">{title}</h2>
    {action}
  </div>
);

// ─── Main App ─────────────────────────────────────────────────
export default function App() {
  const initD = () => ({
    config:{refDate:tod(),refTeam:"A"},
    operators:[], rapports:{}, absences:[], notifications:[], consignes:[], captures:[], sitreps:[]
  });

  const [D,setD] = useState(initD);
  const [activeTab,setActiveTab] = useState("dashboard");
  const [loaded,setLoaded] = useState(false);

  // Storage
  const saveD = useCallback(async(data) => {
    try { await window.storage.set("jocc_v4", JSON.stringify(data)); } catch(e){}
  },[]);

  useEffect(()=>{
    (async()=>{
      try {
        const r = await window.storage.get("jocc_v4");
        if(r?.value) { const parsed = JSON.parse(r.value); setD(parsed); }
        else { const nd = initD(); seedOps(nd); setD(nd); await saveD(nd); }
      } catch(e){ const nd=initD(); seedOps(nd); setD(nd); }
      setLoaded(true);
    })();
  },[]);

  function seedOps(d){
    const defs=[["MARTIN","Jean","LV","A","chef"],["DUBOIS","Marie","OIM","A","radio"],["BERNARD","Paul","CC","A","veille"],["THOMAS","Sophie","EV1","A","permanence"],
      ["PETIT","Luc","LV","B","chef"],["ROBERT","Anna","OIM","B","radio"],["RICHARD","Marc","CC","B","veille"],["SIMON","Julie","EV1","B","permanence"],
      ["MOREAU","Eric","LV","C","chef"],["LAURENT","Claire","OIM","C","radio"],["GARCIA","Pierre","CC","C","veille"],["LEROY","Isabelle","EV1","C","permanence"],
      ["ADAM","Nicolas","LV","D","chef"],["ROUX","Catherine","OIM","D","radio"],["FOURNIER","Alain","CC","D","veille"],["VINCENT","Sandra","EV1","D","permanence"],
      ["HOUNKPE","Romuald","CF","A","supervision"]];
    d.operators = defs.map(([nom,prenom,grade,equipe,poste])=>({id:gid(),nom,prenom,grade,equipe,poste,actif:true}));
  }

  const update = useCallback((fn) => {
    setD(prev => { const next = fn({...prev}); saveD(next); return next; });
  },[saveD]);

  const pushNotif = useCallback((type,titre,detail,urg=false) => {
    update(d => { d.notifications=[...d.notifications,{id:gid(),type,titre,detail,urg,ts:new Date().toISOString(),lu:false}]; return d; });
  },[update]);

  const unread = D.notifications.filter(n=>!n.lu).length;
  const tabs = [
    {id:"dashboard",label:"Tableau de bord"},
    {id:"sitrep",label:"SITREP"},
    {id:"planning",label:"Planning"},
    {id:"operators",label:"Opérateurs"},
    {id:"rapport",label:"Rapport de quart"},
    {id:"absences",label:"Absences"},
    {id:"supervision",label:null},
    {id:"fichiers",label:"Fichiers"},
  ];

  const markRead = () => {
    update(d => { d.notifications=d.notifications.map(n=>({...n,lu:true})); return d; });
  };

  if(!loaded) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-500 text-sm">Chargement…</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* SIDEBAR + CONTENT */}
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-56 min-h-screen bg-[#0d1f35] text-white shrink-0">
          {/* Logo area */}
          <div className="flex flex-col items-center py-6 px-4 border-b border-white/10">
            <img src={`data:image/png;base64,${LOGO_B64}`} alt="Logo" className="w-16 h-16 object-contain mb-3"/>
            <div className="text-center">
              <div className="text-xs font-semibold tracking-wider text-white/90">PRÉFECTURE MARITIME</div>
              <div className="text-[10px] text-white/50 mt-0.5">République du Bénin</div>
            </div>
          </div>
          {/* Nav */}
          <nav className="flex-1 py-4 px-3">
            <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-2 mb-2">Navigation</div>
            {[
              {id:"dashboard",icon:"⬛",label:"Tableau de bord"},
              {id:"sitrep",icon:"📡",label:"SITREP"},
              {id:"planning",icon:"📅",label:"Planning"},
              {id:"operators",icon:"👥",label:"Opérateurs"},
              {id:"rapport",icon:"📋",label:"Rapport de quart"},
              {id:"absences",icon:"🏥",label:"Absences"},
              {id:"supervision",icon:"🎯",label:"Supervision",badge:unread>0?unread:null},
              {id:"fichiers",icon:"📁",label:"Fichiers"},
            ].map(t=>(
              <button key={t.id} onClick={()=>{setActiveTab(t.id);if(t.id==="supervision")markRead();}}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors text-left ${activeTab===t.id?"bg-white/15 text-white font-medium":"text-white/60 hover:bg-white/8 hover:text-white/90"}`}>
                <span className="text-base leading-none">{t.icon}</span>
                <span className="flex-1">{t.label}</span>
                {t.badge && <span className="bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{t.badge}</span>}
              </button>
            ))}
          </nav>
          {/* Clock */}
          <div className="px-4 py-4 border-t border-white/10">
            <div className="text-[10px] text-white/40 text-center">{new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"short",year:"numeric"})}</div>
          </div>
        </aside>

        {/* Mobile header */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#0d1f35] text-white px-4 py-3 flex items-center gap-3 shadow-lg">
          <img src={`data:image/png;base64,${LOGO_B64}`} alt="Logo" className="w-8 h-8 object-contain"/>
          <div>
            <div className="text-xs font-semibold">JOCC — Préfecture Maritime</div>
            <div className="text-[10px] text-white/50">République du Bénin</div>
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {/* Mobile top nav */}
          <div className="md:hidden flex overflow-x-auto bg-white border-b border-slate-200 mt-14 scrollbar-hide px-2">
            {[{id:"dashboard",label:"Accueil"},{id:"sitrep",label:"SITREP"},{id:"planning",label:"Planning"},{id:"operators",label:"Équipes"},{id:"rapport",label:"Rapport"},{id:"absences",label:"Absences"},{id:"supervision",label:"Supervision"},{id:"fichiers",label:"Fichiers"}].map(t=>(
              <button key={t.id} onClick={()=>{setActiveTab(t.id);if(t.id==="supervision")markRead();}}
                className={`px-3 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab===t.id?"border-blue-600 text-blue-600":"border-transparent text-slate-500"}`}>
                {t.label}{t.id==="supervision"&&unread>0&&<span className="ml-1 bg-red-500 text-white text-[9px] rounded-full px-1">{unread}</span>}
              </button>
            ))}
          </div>

          {/* Page header */}
          <div className="bg-white border-b border-slate-200 px-6 py-4 hidden md:block">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold text-slate-900">JOCC — Gestion des Quarts</h1>
                <p className="text-xs text-slate-500 mt-0.5">Système de gestion opérationnelle · {new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
              </div>
              <div className="flex items-center gap-2">
                <TeamBadge team={getTeam(tod(),D.config)} />
                <Badge variant="success">Quart actif</Badge>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6">
            {activeTab==="dashboard" && <Dashboard D={D} update={update}/>}
            {activeTab==="sitrep" && <Sitrep D={D} update={update} pushNotif={pushNotif}/>}
            {activeTab==="planning" && <Planning D={D} update={update}/>}
            {activeTab==="operators" && <Operators D={D} update={update}/>}
            {activeTab==="rapport" && <Rapport D={D} update={update} pushNotif={pushNotif}/>}
            {activeTab==="absences" && <Absences D={D} update={update} pushNotif={pushNotif}/>}
            {activeTab==="supervision" && <Supervision D={D} update={update}/>}
            {activeTab==="fichiers" && <Fichiers D={D} update={update} pushNotif={pushNotif}/>}
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────
function Dashboard({D,update}){
  const eq = getTeam(tod(),D.config);
  const ops = D.operators.filter(o=>o.equipe===eq&&o.actif&&o.poste!=="supervision");
  const mo = tod().slice(0,7);
  const absN = (D.absences||[]).filter(a=>a.dateDebut.slice(0,7)===mo||a.dateFin.slice(0,7)===mo).length;
  const tom = new Date(); tom.setDate(tom.getDate()+1);
  const nextEq = getTeam(tom.toISOString().slice(0,10),D.config);
  const evs = [];
  Object.entries(D.rapports||{}).forEach(([date,r])=>(r.evenements||[]).forEach(ev=>evs.push({date,ev})));
  evs.sort((a,b)=>(b.date+b.ev.heure).localeCompare(a.date+a.ev.heure));
  const lastEvs = evs.slice(0,5);
  const lastSit = (D.sitreps||[]).slice().sort((a,b)=>b.num-a.num).slice(0,3);

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Équipe en service" value={<TeamBadge team={eq}/>}/>
        <StatCard label="Effectif présent" value={ops.length} sub="opérateurs actifs"/>
        <StatCard label="Absences / mois" value={absN}/>
        <StatCard label="Prochaine équipe" value={<TeamBadge team={nextEq}/>}/>
      </div>
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Card>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Quart en cours</h3>
            <Badge variant="success">Actif</Badge>
          </div>
          <div className="p-4">
            {ops.length===0 ? <div className="text-sm text-slate-400 text-center py-4">Aucun opérateur</div> :
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-slate-400 uppercase"><th className="text-left pb-2">Nom</th><th className="text-left pb-2">Grade</th><th className="text-left pb-2">Poste</th></tr></thead>
              <tbody>{ops.map(o=><tr key={o.id} className="border-t border-slate-50">
                <td className="py-1.5 font-medium text-slate-700">{o.nom} {o.prenom}</td>
                <td className="py-1.5 text-slate-500">{o.grade}</td>
                <td className="py-1.5 text-slate-500 text-xs">{POSTES[o.poste]||o.poste}</td>
              </tr>)}</tbody>
            </table>}
          </div>
        </Card>
        <Card>
          <div className="p-4 border-b border-slate-100"><h3 className="font-semibold text-slate-800">Rotation — 5 jours</h3></div>
          <div className="p-4 grid grid-cols-5 gap-2">
            {Array.from({length:5},(_,i)=>{
              const d=new Date(); d.setDate(d.getDate()+i);
              const ds=d.toISOString().slice(0,10);
              const t=getTeam(ds,D.config);
              const dn=i===0?"Auj.":i===1?"Dem.":d.toLocaleDateString("fr-FR",{weekday:"short"});
              return <div key={i} className="text-center">
                <div className="text-xs text-slate-400 mb-1.5">{dn}</div>
                <div className={`w-10 h-10 mx-auto rounded-full ${TEAM_BG[t]} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>{t}</div>
              </div>;
            })}
          </div>
        </Card>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="p-4 border-b border-slate-100"><h3 className="font-semibold text-slate-800">Derniers événements</h3></div>
          <div className="divide-y divide-slate-50">
            {!lastEvs.length ? <div className="p-4 text-sm text-slate-400 text-center">Aucun événement</div> :
            lastEvs.map(({date,ev},i)=>(
              <div key={i} className="p-3 flex items-start gap-3">
                <Badge variant={EV_C[ev.type]||"default"} cls="shrink-0 mt-0.5">{EV_L[ev.type]}</Badge>
                <div className="min-w-0">
                  <div className="text-sm text-slate-700 truncate">{ev.description}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{fmt(date)} · {ev.heure}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="p-4 border-b border-slate-100"><h3 className="font-semibold text-slate-800">Derniers SITREPs</h3></div>
          <div className="divide-y divide-slate-50">
            {!lastSit.length ? <div className="p-4 text-sm text-slate-400 text-center">Aucun SITREP</div> :
            lastSit.map(s=>(
              <div key={s.id} className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#0d1f35] flex items-center justify-center text-white text-xs font-bold shrink-0">{s.num}</div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-700">SITREP N°{s.num}</div>
                  <div className="text-xs text-slate-400">{fmt(s.date)} · {s.time} · <TeamBadge team={s.equipe}/></div>
                </div>
                {s.speed && <Badge variant="default" cls="ml-auto shrink-0">{s.speed} nds</Badge>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── SITREP ────────────────────────────────────────────────────
function Sitrep({D,update,pushNotif}){
  const empty = {num:"",date:tod(),time:nowT(),equipe:"A",speed:"",course:"",lat:"",lon:"",azm_pac:"",dist_pac:"",dist_cote:"",azm_spm:"",dist_spm:"",comment:""};
  const [form,setForm]=useState(null);
  const [editId,setEditId]=useState(null);
  const [fEq,setFEq]=useState("");
  const [fDate,setFDate]=useState("");

  const sit=(D.sitreps||[]).slice().sort((a,b)=>b.num-a.num);
  const filtered=sit.filter(s=>(!fEq||s.equipe===fEq)&&(!fDate||s.date===fDate));

  const openNew = () => {
    const nextN = sit.length ? Math.max(...sit.map(s=>Number(s.num)||0))+1 : 1;
    setForm({...empty,num:nextN,equipe:getTeam(tod(),D.config)});
    setEditId(null);
  };
  const openEdit = s => { setForm({...s}); setEditId(s.id); };
  const save = () => {
    if(!form.num){alert("Numéro requis");return;}
    const s={...form,num:Number(form.num),id:editId||gid(),ts:new Date().toISOString()};
    update(d=>{ if(editId){const i=d.sitreps.findIndex(x=>x.id===editId);if(i>=0)d.sitreps[i]=s;}else d.sitreps=[...(d.sitreps||[]),s]; return d;});
    pushNotif("sitrep",`SITREP N°${s.num} — ${fmt(s.date)}`,`Éq.${s.equipe} · ${s.time}${s.lat?" · "+s.lat:""}`);
    setForm(null);setEditId(null);
  };
  const del = id => { if(!confirm("Supprimer ?"))return; update(d=>{d.sitreps=d.sitreps.filter(s=>s.id!==id);return d;}); };

  const F = (label,key,ph) => (
    <FG label={label}><Input value={form[key]||""} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder={ph}/></FG>
  );

  return (
    <div>
      <SectionHeader title="SITREP — Rapports de situation maritime"
        action={<Btn variant="primary" onClick={openNew}>+ Nouveau SITREP</Btn>}/>

      {form && (
        <Card cls="mb-5">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="font-semibold text-slate-800">{editId?"Modifier SITREP":"Nouveau SITREP"}</div>
            <Btn variant="ghost" onClick={()=>setForm(null)}>Annuler</Btn>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
              <FG label="SITREP N°"><Input type="number" value={form.num} onChange={e=>setForm(f=>({...f,num:e.target.value}))} placeholder="3"/></FG>
              <FG label="Date"><Input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></FG>
              <FG label="TIME"><Input type="time" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))}/></FG>
              <FG label="Équipe">
                <Select value={form.equipe} onChange={e=>setForm(f=>({...f,equipe:e.target.value}))}>
                  {TEAMS.map(t=><option key={t}>{t}</option>)}
                </Select>
              </FG>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 mb-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Données de navigation</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {F("SPEED (nds)","speed","0.3")}
                {F("COURSE (°)","course","18°")}
                <div/>
                <FG label="Latitude"><Input value={form.lat||""} onChange={e=>setForm(f=>({...f,lat:e.target.value}))} placeholder="06°17.353N"/></FG>
                <FG label="Longitude" cls="md:col-span-2"><Input value={form.lon||""} onChange={e=>setForm(f=>({...f,lon:e.target.value}))} placeholder='002°16.500"E'/></FG>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 mb-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Distances et azimuts</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {F("AZM/PAC (°)","azm_pac","249°")}
                {F("DIST/PAC (nq)","dist_pac","10.8")}
                {F("DIST/CÔTE (nq)","dist_cote","3.38")}
                {F("AZM/SPM (°)","azm_spm","—")}
                {F("DIST/SPM (nq)","dist_spm","—")}
              </div>
            </div>
            <FG label="Commentaire">
              <Textarea value={form.comment||""} onChange={e=>setForm(f=>({...f,comment:e.target.value}))} rows={3} placeholder="Observations, situation tactique, météo..."/>
            </FG>
            <Btn variant="primary" onClick={save}>Enregistrer le SITREP</Btn>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="text-sm text-slate-500">{filtered.length} SITREP(s)</div>
        <Select value={fEq} onChange={e=>setFEq(e.target.value)} className="w-auto">
          <option value="">Toutes équipes</option>
          {TEAMS.map(t=><option key={t} value={t}>Équipe {t}</option>)}
        </Select>
        <Input type="date" value={fDate} onChange={e=>setFDate(e.target.value)} className="w-auto"/>
        {(fEq||fDate)&&<Btn variant="ghost" onClick={()=>{setFEq("");setFDate("");}}>Effacer filtres</Btn>}
      </div>

      {!filtered.length ? (
        <Card><div className="p-10 text-center text-slate-400">Aucun SITREP — cliquez sur "+ Nouveau SITREP"</div></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(s=>(
            <Card key={s.id} cls="overflow-hidden">
              <div className="flex items-center gap-3 p-4 border-b border-slate-100 bg-gradient-to-r from-[#0d1f35] to-[#1a3a5c]">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold">{s.num}</div>
                <div>
                  <div className="text-white font-semibold text-sm">SITREP N° {s.num}</div>
                  <div className="text-white/60 text-xs">{fmt(s.date)} · {s.time||"—"} · Équipe {s.equipe}</div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Btn variant="outline" cls="!bg-white/10 !text-white !border-white/20 hover:!bg-white/20" onClick={()=>openEdit(s)}>Modifier</Btn>
                  <Btn variant="outline" cls="!bg-white/10 !text-white !border-white/20 hover:!bg-white/20" onClick={()=>printSitrep(s)}>Imprimer</Btn>
                  <Btn variant="danger" cls="!bg-red-500/20 !text-red-200 !border-red-500/30" onClick={()=>del(s.id)}>Suppr.</Btn>
                </div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-3">
                  {[["TIME",s.time],["SPEED",s.speed?s.speed+" nds":"—"],["COURSE",s.course?s.course+"°":"—"],["AZM/PAC",s.azm_pac||"—"],["DIST/PAC",s.dist_pac?s.dist_pac+" nq":"—"]].map(([l,v])=>(
                    <div key={l} className="bg-slate-50 rounded-lg p-2.5">
                      <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">{l}</div>
                      <div className="text-sm font-semibold text-slate-700">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                  {[["POSITION",s.lat&&s.lon?s.lat+" / "+s.lon:"—"],["DIST/CÔTE",s.dist_cote?s.dist_cote+" nq":"—"],["AZM/SPM",s.azm_spm||"—"],["DIST/SPM",s.dist_spm?s.dist_spm+" nq":"—"]].map(([l,v])=>(
                    <div key={l} className="bg-slate-50 rounded-lg p-2.5">
                      <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">{l}</div>
                      <div className="text-xs font-medium text-slate-700">{v}</div>
                    </div>
                  ))}
                </div>
                {s.comment && <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-800"><span className="font-medium text-amber-600 text-xs uppercase tracking-wider mr-2">Commentaire —</span>{s.comment}</div>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function printSitrep(s){
  const html=`<html><head><title>SITREP N°${s.num}</title>
  <style>body{font-family:'Courier New',monospace;font-size:12px;padding:24px;max-width:680px;margin:0 auto}
  .hdr{background:#0d1f35;color:#fff;padding:14px 16px;border-radius:6px;margin-bottom:16px;display:flex;justify-content:space-between}
  h1{font-size:15px;color:#0d1f35;border-bottom:2px solid #0d1f35;padding-bottom:6px;margin-bottom:12px;letter-spacing:.06em}
  .row{display:flex;padding:6px 0;border-bottom:1px solid #e5e7eb}
  .lbl{width:150px;font-weight:bold;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.04em;flex-shrink:0}
  .val{color:#111827}</style></head><body>
  <div class="hdr"><div style="font-size:13px;font-weight:bold;letter-spacing:.06em">PRÉFECTURE MARITIME — JOCC</div><div style="opacity:.6;font-size:11px">République du Bénin</div></div>
  <h1>SITREP N° ${s.num}</h1>
  ${[["DATE",fmt(s.date)],["TIME",s.time||"—"],["ÉQUIPE",s.equipe],["SPEED",s.speed?s.speed+" nœuds":"—"],["COURSE",s.course?s.course+"°":"—"],["POSITION",(s.lat&&s.lon)?s.lat+" / "+s.lon:"—"],["AZM/PAC",s.azm_pac||"—"],["DIST/PAC",s.dist_pac?s.dist_pac+" nautiques":"—"],["DIST/CÔTE",s.dist_cote?s.dist_cote+" nautiques":"—"],["AZM/SPM",s.azm_spm||"—"],["DIST/SPM",s.dist_spm?s.dist_spm+" nautiques":"—"]].map(([l,v])=>`<div class="row"><div class="lbl">${l}</div><div class="val">${v}</div></div>`).join("")}
  ${s.comment?`<div style="margin-top:12px;background:#fef3c7;border:1px solid #fde68a;padding:10px;border-radius:4px"><strong style="color:#92400e">COMMENTAIRE :</strong><br><span style="color:#78350f">${s.comment}</span></div>`:""}
  <p style="font-size:10px;color:#9ca3af;margin-top:16px;border-top:1px solid #e5e7eb;padding-top:8px">Généré le ${new Date().toLocaleString("fr-FR")} — JOCC / Préfecture Maritime — République du Bénin</p>
  </body></html>`;
  const w=window.open("","_blank","width=720,height=600");
  if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),400);}
}

// ─── Planning ──────────────────────────────────────────────────
function Planning({D,update}){
  const [calY,setCalY]=useState(new Date().getFullYear());
  const [calM,setCalM]=useState(new Date().getMonth());
  const [detail,setDetail]=useState(null);
  const months=["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const td=tod();

  const first=new Date(calY,calM,1),last=new Date(calY,calM+1,0);
  const dow=(first.getDay()+6)%7;
  const days=[];
  for(let i=0;i<dow;i++){const d=new Date(calY,calM,1-dow+i);days.push({d,om:true});}
  for(let i=1;i<=last.getDate();i++){const d=new Date(calY,calM,i);days.push({d,om:false});}
  const rem=(7-(dow+last.getDate())%7)%7;
  for(let i=1;i<=rem;i++){const d=new Date(calY,calM+1,i);days.push({d,om:true});}

  return (
    <div>
      <SectionHeader title="Planning de rotation"/>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Btn onClick={()=>{let m=calM-1,y=calY;if(m<0){m=11;y--;}setCalM(m);setCalY(y);}}>‹</Btn>
          <span className="font-semibold text-slate-700 w-36 text-center">{months[calM]} {calY}</span>
          <Btn onClick={()=>{let m=calM+1,y=calY;if(m>11){m=0;y++;}setCalM(m);setCalY(y);}}>›</Btn>
        </div>
        <div className="flex gap-1.5 ml-auto">
          {TEAMS.map(t=><TeamBadge key={t} team={t}/>)}
        </div>
      </div>

      <Card cls="mb-4 overflow-hidden">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
          {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(d=>(
            <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map(({d,om},i)=>{
            const ds=d.toISOString().slice(0,10);
            const team=getTeam(ds,D.config);
            const isT=ds===td;
            const hasRpt=!!(D.rapports||{})[ds];
            const hasSit=(D.sitreps||[]).some(s=>s.date===ds);
            return (
              <div key={i} onClick={()=>setDetail(ds)}
                className={`border-r border-b border-slate-100 p-2 min-h-[56px] cursor-pointer transition-colors last:border-r-0 hover:bg-slate-50 ${om?"opacity-30":""} ${isT?"bg-blue-50/60":""}`}>
                <div className={`text-xs mb-1.5 flex items-center justify-between ${isT?"font-bold text-blue-600":"text-slate-500"}`}>
                  <span>{d.getDate()}</span>
                  <div className="flex gap-0.5">
                    {hasRpt&&<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"/>}
                    {hasSit&&<span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"/>}
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full ${TEAM_BG[team]} flex items-center justify-center text-white text-[10px] font-bold`}>{team}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {detail && (
        <Card cls="mb-4">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="font-semibold text-slate-800">{fmt(detail)} — Équipe {getTeam(detail,D.config)}</div>
            <Btn variant="ghost" onClick={()=>setDetail(null)}>×</Btn>
          </div>
          <div className="p-4">
            <TeamBadge team={getTeam(detail,D.config)}/>
            {D.operators.filter(o=>o.equipe===getTeam(detail,D.config)&&o.actif).length>0 && (
              <table className="w-full text-sm mt-3">
                <thead><tr className="text-xs text-slate-400 uppercase"><th className="text-left pb-2">Nom</th><th className="text-left pb-2">Grade</th><th className="text-left pb-2">Poste</th></tr></thead>
                <tbody>{D.operators.filter(o=>o.equipe===getTeam(detail,D.config)&&o.actif).map(o=>(
                  <tr key={o.id} className="border-t border-slate-50">
                    <td className="py-1.5 font-medium">{o.nom} {o.prenom}</td>
                    <td className="py-1.5 text-slate-500">{o.grade}</td>
                    <td className="py-1.5 text-slate-500 text-xs">{POSTES[o.poste]||o.poste}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </Card>
      )}

      <Card>
        <div className="p-4 border-b border-slate-100"><h3 className="font-semibold text-slate-800">Configuration de la rotation</h3></div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <FG label="Date de référence">
            <Input type="date" value={D.config.refDate} onChange={e=>update(d=>{d.config={...d.config,refDate:e.target.value};return d;})}/>
          </FG>
          <FG label="Équipe ce jour">
            <Select value={D.config.refTeam} onChange={e=>update(d=>{d.config={...d.config,refTeam:e.target.value};return d;})}>
              {TEAMS.map(t=><option key={t}>{t}</option>)}
            </Select>
          </FG>
        </div>
      </Card>
    </div>
  );
}

// ─── Operators ─────────────────────────────────────────────────
function Operators({D,update}){
  const empty={nom:"",prenom:"",grade:"",equipe:"A",poste:"chef",actif:true};
  const [form,setForm]=useState(null);
  const [editId,setEditId]=useState(null);
  const [fEq,setFEq]=useState("");
  const ops=D.operators.filter(o=>!fEq||o.equipe===fEq);

  const save=()=>{
    if(!form.nom||!form.prenom){alert("Nom et prénom requis");return;}
    const o={...form,nom:form.nom.toUpperCase()};
    update(d=>{
      if(editId){const i=d.operators.findIndex(x=>x.id===editId);if(i>=0)d.operators[i]={...o,id:editId};}
      else d.operators=[...d.operators,{...o,id:gid()}];
      return d;
    });
    setForm(null);setEditId(null);
  };
  const edit=o=>{setForm({...o,actif:o.actif});setEditId(o.id);};
  const del=id=>{if(!confirm("Supprimer ?"))return;update(d=>{d.operators=d.operators.filter(o=>o.id!==id);return d;});};

  return (
    <div>
      <SectionHeader title={`Opérateurs JOCC (${D.operators.length})`}
        action={<div className="flex gap-2"><Select value={fEq} onChange={e=>setFEq(e.target.value)} className="w-auto"><option value="">Toutes équipes</option>{TEAMS.map(t=><option key={t} value={t}>Éq. {t}</option>)}</Select><Btn variant="primary" onClick={()=>{setForm({...empty});setEditId(null);}}>+ Ajouter</Btn></div>}/>

      {form && (
        <Card cls="mb-5">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="font-semibold">{editId?"Modifier l'opérateur":"Nouvel opérateur"}</div>
            <Btn variant="ghost" onClick={()=>setForm(null)}>Annuler</Btn>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            <FG label="Nom"><Input value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))} placeholder="NOM"/></FG>
            <FG label="Prénom"><Input value={form.prenom} onChange={e=>setForm(f=>({...f,prenom:e.target.value}))} placeholder="Prénom"/></FG>
            <FG label="Grade"><Input value={form.grade} onChange={e=>setForm(f=>({...f,grade:e.target.value}))} placeholder="LV, CC, OIM..."/></FG>
            <FG label="Équipe"><Select value={form.equipe} onChange={e=>setForm(f=>({...f,equipe:e.target.value}))}>{TEAMS.map(t=><option key={t}>{t}</option>)}</Select></FG>
            <FG label="Poste"><Select value={form.poste} onChange={e=>setForm(f=>({...f,poste:e.target.value}))}>{Object.entries(POSTES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</Select></FG>
            <FG label="Statut"><Select value={form.actif?"1":"0"} onChange={e=>setForm(f=>({...f,actif:e.target.value==="1"}))}><option value="1">Actif</option><option value="0">Inactif</option></Select></FG>
          </div>
          <div className="px-4 pb-4"><Btn variant="primary" onClick={save}>Enregistrer</Btn></div>
        </Card>
      )}

      <Card cls="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>{["Nom / Prénom","Grade","Équipe","Poste","Statut",""].map(h=><th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {!ops.length?<tr><td colSpan={6} className="p-6 text-center text-slate-400">Aucun opérateur</td></tr>:
            ops.map(o=>(
              <tr key={o.id} className="hover:bg-slate-50/50">
                <td className="py-3 px-4"><span className="font-medium text-slate-800">{o.nom}</span> <span className="text-slate-500">{o.prenom}</span></td>
                <td className="py-3 px-4 text-slate-500">{o.grade}</td>
                <td className="py-3 px-4"><TeamBadge team={o.equipe}/></td>
                <td className="py-3 px-4 text-slate-500 text-xs">{o.poste==="supervision"?<Badge variant="sup">Superviseur</Badge>:(POSTES[o.poste]||o.poste)}</td>
                <td className="py-3 px-4"><Badge variant={o.actif?"success":"default"}>{o.actif?"Actif":"Inactif"}</Badge></td>
                <td className="py-3 px-4"><div className="flex gap-1.5"><Btn onClick={()=>edit(o)}>Modifier</Btn><Btn variant="danger" onClick={()=>del(o.id)}>Suppr.</Btn></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Rapport ───────────────────────────────────────────────────
function Rapport({D,update,pushNotif}){
  const [date,setDate]=useState(tod());
  const [loaded,setLoaded]=useState(false);
  const [showEvForm,setShowEvForm]=useState(false);
  const [evForm,setEvForm]=useState({heure:nowT(),type:"routine",desc:""});

  const r=D.rapports?.[date];
  const eq=r?.equipe||getTeam(date,D.config);
  const ops=D.operators.filter(o=>o.equipe===eq&&o.actif);

  const loadRpt=()=>{
    if(!D.rapports?.[date]){
      update(d=>{d.rapports={...d.rapports,[date]:{equipe:eq,chef:"",observations:"",evenements:[]}};return d;});
    }
    setLoaded(true);
  };

  const saveObs=()=>{
    pushNotif("rapport","Rapport du "+fmt(date),"Mis à jour — Éq."+eq);
    alert("Entête enregistrée.");
  };

  const addEv=()=>{
    if(!evForm.heure||!evForm.desc){alert("Heure et description requises");return;}
    update(d=>{
      d.rapports[date].evenements=[...(d.rapports[date].evenements||[]),{id:gid(),...evForm,description:evForm.desc}];
      return d;
    });
    if(evForm.type==="urgence") pushNotif("urgence","URGENCE — "+fmt(date)+" à "+evForm.heure,evForm.desc,true);
    else pushNotif("rapport","Événement ("+EV_L[evForm.type]+") — "+fmt(date),evForm.heure+" · "+evForm.desc);
    setEvForm({heure:nowT(),type:"routine",desc:""});
    setShowEvForm(false);
  };

  const delEv=id=>{ update(d=>{d.rapports[date].evenements=d.rapports[date].evenements.filter(e=>e.id!==id);return d;}); };

  const evs=(r?.evenements||[]).slice().sort((a,b)=>a.heure.localeCompare(b.heure));

  return (
    <div>
      <SectionHeader title="Rapport de quart"/>
      <Card cls="mb-4">
        <div className="p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-0"><Label>Date du quart</Label><Input type="date" value={date} onChange={e=>{setDate(e.target.value);setLoaded(false);}}/></div>
          <Btn variant="primary" onClick={loadRpt}>Charger / Créer</Btn>
        </div>
      </Card>

      {loaded && r && (
        <>
          <Card cls="mb-4">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <div><div className="font-semibold text-slate-800">Rapport du {fmt(date)}</div><div className="text-xs text-slate-500">Quart 24h</div></div>
              <TeamBadge team={eq}/>
            </div>
            <div className="p-4 grid md:grid-cols-2 gap-3">
              <FG label="Chef de quart / Officier responsable">
                <Select value={r.chef||""} onChange={e=>update(d=>{d.rapports[date].chef=e.target.value;return d;})}>
                  <option value="">-- Sélectionner --</option>
                  {ops.map(o=><option key={o.id} value={o.id}>{o.grade} {o.nom} {o.prenom}</option>)}
                </Select>
              </FG>
              <FG label="Observations générales" cls="md:col-span-1">
                <Textarea value={r.observations||""} onChange={e=>update(d=>{d.rapports[date].observations=e.target.value;return d;})} placeholder="Observations générales..."/>
              </FG>
            </div>
            <div className="px-4 pb-4 flex gap-2">
              <Btn variant="primary" onClick={saveObs}>Enregistrer entête</Btn>
              <Btn variant="outline" onClick={()=>printRpt(D,date)}>Imprimer</Btn>
            </div>
          </Card>

          <Card>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Main courante — {evs.length} événement(s)</h3>
              <Btn variant="primary" onClick={()=>setShowEvForm(v=>!v)}>+ Événement</Btn>
            </div>
            {showEvForm && (
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <FG label="Heure"><Input type="time" value={evForm.heure} onChange={e=>setEvForm(f=>({...f,heure:e.target.value}))}/></FG>
                  <FG label="Type"><Select value={evForm.type} onChange={e=>setEvForm(f=>({...f,type:e.target.value}))}>{Object.entries(EV_L).map(([k,v])=><option key={k} value={k}>{v}</option>)}</Select></FG>
                </div>
                <FG label="Description"><Textarea value={evForm.desc} onChange={e=>setEvForm(f=>({...f,desc:e.target.value}))} rows={2} placeholder="Décrire l'événement..."/></FG>
                <div className="flex gap-2"><Btn variant="primary" onClick={addEv}>Ajouter</Btn><Btn variant="ghost" onClick={()=>setShowEvForm(false)}>Annuler</Btn></div>
              </div>
            )}
            {!evs.length ? <div className="p-8 text-center text-slate-400">Aucun événement — commencez la saisie</div> :
            <div className="divide-y divide-slate-50">
              {evs.map(ev=>(
                <div key={ev.id} className="p-4 flex items-start gap-3">
                  <span className="font-mono text-sm font-semibold text-slate-700 shrink-0 mt-0.5">{ev.heure}</span>
                  <Badge variant={EV_C[ev.type]||"default"} cls="shrink-0">{EV_L[ev.type]}</Badge>
                  <span className="text-sm text-slate-600 flex-1">{ev.description}</span>
                  <Btn variant="danger" cls="shrink-0" onClick={()=>delEv(ev.id)}>×</Btn>
                </div>
              ))}
            </div>}
          </Card>
        </>
      )}
    </div>
  );
}

function printRpt(D,date){
  const r=D.rapports[date];if(!r)return;
  const chef=D.operators.find(o=>o.id===r.chef);
  const chefL=chef?chef.grade+" "+chef.nom+" "+chef.prenom:"Non désigné";
  const evs=(r.evenements||[]).slice().sort((a,b)=>a.heure.localeCompare(b.heure));
  const ops=D.operators.filter(o=>o.equipe===r.equipe&&o.actif);
  const fmt2=d=>{if(!d)return"—";const p=d.split("-");return`${p[2]}/${p[1]}/${p[0]}`};
  const html=`<html><head><title>Rapport JOCC ${fmt2(date)}</title>
  <style>body{font-family:Arial,sans-serif;font-size:12px;padding:24px;max-width:760px;margin:0 auto}
  .hdr{background:#0d1f35;color:#fff;padding:14px 16px;border-radius:6px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
  h2{font-size:12px;font-weight:bold;margin:12px 0 5px;color:#0d1f35;border-bottom:1px solid #e5e7eb;padding-bottom:3px}
  table{width:100%;border-collapse:collapse}th{background:#0d1f35;color:#fff;padding:5px 8px;text-align:left;font-size:11px}td{padding:5px 8px;border-bottom:1px solid #f1f5f9;font-size:11px}
  .meta{background:#f8fafc;border-radius:4px;padding:10px;margin-bottom:12px;display:flex;gap:24px;font-size:11px}</style></head><body>
  <div class="hdr"><div style="font-size:13px;font-weight:bold;letter-spacing:.05em">RAPPORT DE QUART — JOCC / Préfecture Maritime du Bénin</div></div>
  <div class="meta"><div>Date : <strong>${fmt2(date)}</strong></div><div>Équipe : <strong>${r.equipe}</strong></div><div>Responsable : <strong>${chefL}</strong></div></div>
  <h2>Composition de l'équipe</h2><table><tr><th>Nom / Prénom</th><th>Grade</th><th>Poste</th></tr>${ops.map(o=>`<tr><td>${o.nom} ${o.prenom}</td><td>${o.grade}</td><td>${POSTES[o.poste]||o.poste}</td></tr>`).join("")}</table>
  <h2>Observations générales</h2><p style="font-size:11px">${r.observations||"Aucune observation particulière."}</p>
  <h2>Main courante — ${evs.length} événement(s)</h2>
  <table><tr><th style="width:50px">Heure</th><th style="width:80px">Type</th><th>Description</th></tr>${evs.map(e=>`<tr><td>${e.heure}</td><td>${EV_L[e.type]}</td><td>${e.description}</td></tr>`).join("")}${!evs.length?'<tr><td colspan="3" style="text-align:center;color:#9ca3af">Aucun événement</td></tr>':""}</table>
  <p style="font-size:10px;color:#9ca3af;margin-top:16px;border-top:1px solid #e5e7eb;padding-top:8px">Généré le ${new Date().toLocaleString("fr-FR")} — JOCC / Préfecture Maritime — République du Bénin</p></body></html>`;
  const w=window.open("","_blank","width=800,height=620");if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),400);}
}

// ─── Absences ──────────────────────────────────────────────────
function Absences({D,update,pushNotif}){
  const [form,setForm]=useState(null);
  const save=()=>{
    if(!form.opId||!form.debut||!form.fin){alert("Champs requis");return;}
    if(form.fin<form.debut){alert("Date fin invalide");return;}
    const op=D.operators.find(o=>o.id===form.opId);
    D.absences||[];
    update(d=>{d.absences=[...(d.absences||[]),{id:gid(),operateurId:form.opId,motif:form.motif,dateDebut:form.debut,dateFin:form.fin,statut:"attente"}];return d;});
    pushNotif("absence","Absence déclarée",(op?op.grade+" "+op.nom+" "+op.prenom:"")+" — "+MOTIFS[form.motif]+" du "+fmt(form.debut)+" au "+fmt(form.fin));
    setForm(null);
  };
  const upd=(id,st)=>update(d=>{const a=d.absences.find(x=>x.id===id);if(a)a.statut=st;return d;});
  const del=id=>{if(!confirm("Supprimer ?"))return;update(d=>{d.absences=d.absences.filter(a=>a.id!==id);return d;});};

  const sorted=(D.absences||[]).slice().sort((a,b)=>b.dateDebut.localeCompare(a.dateDebut));
  const stV={attente:"warning",valide:"success",refuse:"destructive"};
  const stL={attente:"En attente",valide:"Validé",refuse:"Refusé"};

  return (
    <div>
      <SectionHeader title="Suivi des absences" action={<Btn variant="primary" onClick={()=>setForm({opId:D.operators[0]?.id||"",motif:"maladie",debut:tod(),fin:tod()})}>+ Déclarer</Btn>}/>
      {form && (
        <Card cls="mb-4">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between"><div className="font-semibold">Nouvelle absence</div><Btn variant="ghost" onClick={()=>setForm(null)}>Annuler</Btn></div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <FG label="Opérateur" cls="col-span-2">
              <Select value={form.opId} onChange={e=>setForm(f=>({...f,opId:e.target.value}))}>
                {D.operators.filter(o=>o.actif).sort((a,b)=>a.equipe.localeCompare(b.equipe)).map(o=><option key={o.id} value={o.id}>Éq.{o.equipe} — {o.grade} {o.nom} {o.prenom}</option>)}
              </Select>
            </FG>
            <FG label="Motif">
              <Select value={form.motif} onChange={e=>setForm(f=>({...f,motif:e.target.value}))}>
                {Object.entries(MOTIFS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </Select>
            </FG>
            <FG label="Date début"><Input type="date" value={form.debut} onChange={e=>setForm(f=>({...f,debut:e.target.value}))}/></FG>
            <FG label="Date fin"><Input type="date" value={form.fin} onChange={e=>setForm(f=>({...f,fin:e.target.value}))}/></FG>
          </div>
          <div className="px-4 pb-4"><Btn variant="primary" onClick={save}>Enregistrer</Btn></div>
        </Card>
      )}
      <Card cls="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50">
              <tr>{["Opérateur","Éq.","Motif","Début","Fin","Durée","Statut",""].map(h=><th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {!sorted.length?<tr><td colSpan={8} className="p-6 text-center text-slate-400">Aucune absence</td></tr>:
              sorted.map(a=>{
                const op=D.operators.find(o=>o.id===a.operateurId);
                const jours=Math.max(1,Math.round((new Date(a.dateFin+"T12:00:00")-new Date(a.dateDebut+"T12:00:00"))/86400000)+1);
                return <tr key={a.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-medium text-slate-700">{op?op.grade+" "+op.nom+" "+op.prenom:"Inconnu"}</td>
                  <td className="py-3 px-4">{op?<TeamBadge team={op.equipe}/>:""}</td>
                  <td className="py-3 px-4 text-slate-500">{MOTIFS[a.motif]||a.motif}</td>
                  <td className="py-3 px-4 text-slate-500">{fmt(a.dateDebut)}</td>
                  <td className="py-3 px-4 text-slate-500">{fmt(a.dateFin)}</td>
                  <td className="py-3 px-4 text-slate-500">{jours}j</td>
                  <td className="py-3 px-4">
                    <Select value={a.statut||"attente"} onChange={e=>upd(a.id,e.target.value)} className="w-auto text-xs">
                      <option value="attente">En attente</option><option value="valide">Validé</option><option value="refuse">Refusé</option>
                    </Select>
                  </td>
                  <td className="py-3 px-4"><Btn variant="danger" onClick={()=>del(a.id)}>×</Btn></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Supervision ───────────────────────────────────────────────
function Supervision({D,update}){
  const [filter,setFilter]=useState("");
  const eq=getTeam(tod(),D.config);
  const sups=D.operators.filter(o=>o.poste==="supervision"&&o.actif);
  const notifs=(D.notifications||[]).slice().reverse().filter(n=>!filter||n.type===filter);
  const urgN=(D.notifications||[]).filter(n=>n.urg).length;
  const unread=(D.notifications||[]).filter(n=>!n.lu).length;

  return (
    <div>
      <SectionHeader title="Centre de Supervision"
        action={<div className="flex gap-2"><Badge variant="sup">Accès Superviseur</Badge><Btn variant="danger" onClick={()=>{if(!confirm("Effacer toutes ?"))return;update(d=>{d.notifications=[];return d;});}}>Effacer tout</Btn></div>}/>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label="Notifications actives" value={<span className="text-red-500">{unread}</span>}/>
        <StatCard label="Urgences totales" value={urgN}/>
        <StatCard label="SITREPs" value={(D.sitreps||[]).length}/>
      </div>

      <Card cls="mb-4 overflow-hidden">
        <div className="p-4 border-b border-slate-100"><h3 className="font-semibold text-slate-800">État des équipes</h3></div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {TEAMS.map(t=>{
            const ops=D.operators.filter(o=>o.equipe===t&&o.actif&&o.poste!=="supervision");
            const isAct=getTeam(tod(),D.config)===t;
            return <div key={t} className={`rounded-xl border p-3 ${isAct?"border-blue-200 bg-blue-50":"border-slate-100 bg-slate-50"}`}>
              <div className="flex items-center justify-between mb-2">
                <TeamBadge team={t}/>
                {isAct&&<Badge variant="success" cls="text-[10px]">En service</Badge>}
              </div>
              <div className="text-xs text-slate-500 mb-1">{ops.length} opérateur(s)</div>
              {ops.map(o=><div key={o.id} className="text-xs text-slate-600">{o.nom} <span className="text-slate-400">({(POSTES[o.poste]||o.poste).split(" ")[0]})</span></div>)}
            </div>;
          })}
        </div>
      </Card>

      <Card cls="mb-4">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Notifications</h3>
          <Select value={filter} onChange={e=>setFilter(e.target.value)} className="w-auto">
            <option value="">Tous types</option>
            <option value="urgence">Urgences</option>
            <option value="absence">Absences</option>
            <option value="rapport">Rapports</option>
            <option value="sitrep">SITREPs</option>
          </Select>
        </div>
        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
          {!notifs.length?<div className="text-center text-slate-400 py-6">Aucune notification</div>:
          notifs.map(n=>(
            <div key={n.id} className={`rounded-lg p-3 border-l-4 ${n.urg?"border-l-red-500 bg-red-50/60":"n.type==='absence'?"border-l-emerald-500 bg-emerald-50/60":"border-l-blue-500 bg-blue-50/60""}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-800">{n.titre}</span>
                <div className="flex items-center gap-1.5">
                  {n.urg&&<Badge variant="destructive">Urgence</Badge>}
                  <span className="text-[10px] text-slate-400">{n.lu?"Lu":"Nouveau"}</span>
                </div>
              </div>
              <div className="text-xs text-slate-500">{n.detail}</div>
              <div className="text-[10px] text-slate-400 mt-1">{new Date(n.ts).toLocaleString("fr-FR")}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="p-4 border-b border-slate-100"><h3 className="font-semibold text-slate-800">Superviseurs enregistrés</h3></div>
        <div className="p-4">
          {!sups.length?<div className="text-slate-400 text-center py-4">Aucun superviseur — ajoutez un opérateur avec le poste "Superviseur"</div>:
          sups.map(s=>(
            <div key={s.id} className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
              <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-sm font-semibold">{s.nom.slice(0,2)}</div>
              <div><div className="font-medium text-sm text-slate-800">{s.grade} {s.nom} {s.prenom}</div><div className="text-xs text-slate-400">Équipe {s.equipe}</div></div>
              <Badge variant="sup" cls="ml-auto">Superviseur</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Fichiers ──────────────────────────────────────────────────
function Fichiers({D,update,pushNotif}){
  const [csForm,setCsForm]=useState(false);
  const [csData,setCsData]=useState({titre:"",desc:"",prio:"normal",file:null,fileName:""});
  const [survPend,setSurvPend]=useState(null);
  const [survMeta,setSurvMeta]=useState({source:"vtmis",comment:""});

  const rfDU=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsDataURL(f);});

  const saveCs=async()=>{
    if(!csData.titre){alert("Titre requis");return;}
    const c={id:gid(),titre:csData.titre,desc:csData.desc,priorite:csData.prio,date:tod()};
    if(csData.file){c.fileData=csData.file;c.fileName=csData.fileName;}
    update(d=>{d.consignes=[...(d.consignes||[]),c];return d;});
    pushNotif("rapport","Nouvelle consigne : "+csData.titre,"Priorité "+PRIO_L[csData.prio]);
    setCsForm(false);setCsData({titre:"",desc:"",prio:"normal",file:null,fileName:""});
  };

  const saveSurv=async()=>{
    if(!survPend)return;
    update(d=>{d.captures=[...(d.captures||[]),{id:gid(),...survMeta,dataUrl:survPend.dataUrl,ts:new Date().toISOString()}];return d;});
    pushNotif("rapport","Capture "+SRCS[survMeta.source]+" ajoutée",survMeta.comment);
    setSurvPend(null);setSurvMeta({source:"vtmis",comment:""});
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Consignes */}
      <div>
        <Card>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div><div className="font-semibold text-slate-800">Consignes permanentes</div><div className="text-xs text-slate-400 mt-0.5">Visibles par tous</div></div>
            <Btn variant="primary" onClick={()=>setCsForm(v=>!v)}>+ Ajouter</Btn>
          </div>
          {csForm && (
            <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3">
              <FG label="Titre"><Input value={csData.titre} onChange={e=>setCsData(f=>({...f,titre:e.target.value}))} placeholder="Ex: Procédure VTMIS"/></FG>
              <FG label="Description"><Textarea value={csData.desc} onChange={e=>setCsData(f=>({...f,desc:e.target.value}))} rows={2}/></FG>
              <FG label="Priorité">
                <Select value={csData.prio} onChange={e=>setCsData(f=>({...f,prio:e.target.value}))}>
                  <option value="normal">Normale</option><option value="important">Importante</option><option value="urgent">Urgente</option>
                </Select>
              </FG>
              <div>
                <Label>Fichier joint</Label>
                <div onClick={()=>document.getElementById("cs-file-in").click()} className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <div className="text-sm text-slate-500">{csData.fileName||"Cliquez pour joindre un fichier"}</div>
                  <div className="text-xs text-slate-400 mt-1">PDF, Word, images — max 5 Mo</div>
                </div>
                <input id="cs-file-in" type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.txt" onChange={async e=>{
                  if(!e.target.files?.[0])return;
                  const file=e.target.files[0];
                  if(file.size>5*1024*1024){alert("Max 5 Mo");return;}
                  setCsData(f=>({...f,file:null,fileName:file.name}));
                  const data=await rfDU(file);
                  setCsData(f=>({...f,file:data,fileName:file.name}));
                }}/>
              </div>
              <div className="flex gap-2"><Btn variant="primary" onClick={saveCs}>Enregistrer</Btn><Btn variant="ghost" onClick={()=>setCsForm(false)}>Annuler</Btn></div>
            </div>
          )}
          <div className="divide-y divide-slate-50">
            {!(D.consignes||[]).length?<div className="p-8 text-center text-slate-400">Aucune consigne</div>:
            (D.consignes||[]).slice().reverse().map(c=>(
              <div key={c.id} className="p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 text-base shrink-0">📄</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-slate-800 truncate">{c.titre}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{c.desc}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${PRIO_VAR[c.priorite]||PRIO_VAR.normal}`}>{PRIO_L[c.priorite]||"Normale"}</span>
                    <span className="text-[10px] text-slate-400">{fmt(c.date)}</span>
                    {c.fileData&&<button onClick={()=>{const a=document.createElement("a");a.href=c.fileData;a.download=c.fileName;a.click();}} className="text-[10px] text-blue-600 hover:underline">Télécharger</button>}
                  </div>
                </div>
                <Btn variant="danger" onClick={()=>{if(!confirm("Supprimer ?"))return;update(d=>{d.consignes=d.consignes.filter(x=>x.id!==c.id);return d;});}}>×</Btn>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Captures */}
      <div>
        <Card>
          <div className="p-4 border-b border-slate-100">
            <div className="font-semibold text-slate-800">Captures surveillance</div>
            <div className="text-xs text-slate-400 mt-0.5">VTMIS, AIS, radar, caméras</div>
          </div>
          <div className="p-4">
            <div onClick={()=>document.getElementById("surv-file-in").click()}
              className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors mb-4">
              <div className="text-3xl mb-2">📡</div>
              <div className="text-sm font-medium text-slate-700">Déposer une capture d'écran</div>
              <div className="text-xs text-slate-400 mt-1">PNG, JPG, JPEG — max 5 Mo</div>
            </div>
            <input id="surv-file-in" type="file" className="hidden" accept=".png,.jpg,.jpeg,.gif,.bmp" onChange={async e=>{
              if(!e.target.files?.[0])return;
              const file=e.target.files[0];
              if(file.size>5*1024*1024){alert("Max 5 Mo");return;}
              const data=await rfDU(file);
              setSurvPend({dataUrl:data,name:file.name});
            }}/>
            {survPend && (
              <div className="mb-4 space-y-3">
                <img src={survPend.dataUrl} className="w-full rounded-lg object-cover max-h-40 border border-slate-200"/>
                <FG label="Source">
                  <Select value={survMeta.source} onChange={e=>setSurvMeta(f=>({...f,source:e.target.value}))}>
                    {Object.entries(SRCS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </Select>
                </FG>
                <FG label="Commentaire"><Input value={survMeta.comment} onChange={e=>setSurvMeta(f=>({...f,comment:e.target.value}))} placeholder="Décrire la situation..."/></FG>
                <div className="flex gap-2"><Btn variant="primary" onClick={saveSurv}>Sauvegarder</Btn><Btn variant="ghost" onClick={()=>setSurvPend(null)}>Annuler</Btn></div>
              </div>
            )}
          </div>
          <div className="divide-y divide-slate-50">
            {!(D.captures||[]).length?<div className="px-4 pb-6 text-center text-slate-400 text-sm">Aucune capture</div>:
            (D.captures||[]).slice().reverse().map(cap=>(
              <div key={cap.id} className="p-3 flex items-start gap-3">
                <img src={cap.dataUrl} className="w-14 h-10 object-cover rounded border border-slate-200 shrink-0 cursor-pointer" onClick={()=>{const w=window.open("","_blank");if(w){w.document.write(`<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${cap.dataUrl}" style="max-width:100%;max-height:100vh"/></body></html>`);w.document.close();}}}/>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700">{SRCS[cap.source]||cap.source}</div>
                  <div className="text-xs text-slate-500">{cap.comment}</div>
                  <div className="text-[10px] text-slate-400">{new Date(cap.ts).toLocaleString("fr-FR")}</div>
                </div>
                <Btn variant="danger" onClick={()=>{if(!confirm("Supprimer ?"))return;update(d=>{d.captures=d.captures.filter(c=>c.id!==cap.id);return d;});}}>×</Btn>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
