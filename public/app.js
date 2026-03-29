/* ═══════════════════════════════════════════════════════════════
   JOCC — Gestion des Quarts · v5.0 (FULLSTACK)
   Alignement Backend & Restauration Logique Business
   ═══════════════════════════════════════════════════════════════ */

const TEAMS = ['A', 'B', 'C', 'D'];
const POSTES = { chef: 'Chef de quart', veille: 'Op. de veille', radio: 'Op. radio', permanence: 'Off. permanence', supervision: 'Superviseur' };
const EV_L = { routine: 'Routine', info: 'Information', urgence: 'Urgence' };
const EV_C = { routine: 'bi', info: 'bi', urgence: 'br' };
const MOTIFS = { maladie: 'Maladie', conge: 'Congé', formation: 'Formation', mission: 'Mission', autre: 'Autre' };
const PRIO_C = { normal: 'bi', important: 'bw', urgent: 'br' };
const PRIO_L = { normal: 'Normale', important: 'Importante', urgent: 'Urgente' };
const SRCS = { vtmis: 'VTMIS', ais: 'AIS', radar: 'Radar', camera: 'Caméra', autre: 'Autre' };

let D = { config: { refDate: '2026-01-01', refTeam: 'A' }, operators: [], sitreps: [], absences: [], notifications: [], consignes: [], captures: [], escortes: [], rapports: {} };
let calY = new Date().getFullYear(), calM = new Date().getMonth(), curRptDate = null, survFD = null, csFD = null;

// ── UTILS ─────────────────────────────────────────────────────────────
function tod() { return new Date().toISOString().slice(0, 10); }
function gid() { return Math.random().toString(36).slice(2, 9); }
function fmt(d) { if (!d) return ''; const p = d.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
function nowT() { return new Date().toTimeString().slice(0, 5); }
function getTeam(ds) {
    if (!D.config.refDate) return 'A';
    const ref = new Date(D.config.refDate + 'T12:00:00'), d = new Date(ds + 'T12:00:00');
    const diff = Math.round((d - ref) / 86400000);
    return TEAMS[((TEAMS.indexOf(D.config.refTeam) + diff) % 4 + 4) % 4];
}
function tBadge(t) { return `<span class="badge b${t.toLowerCase()}">Éq.${t}</span>`; }
function gOp(id) { return D.operators.find(o => o.id === id); }
function tOps(eq) { return D.operators.filter(o => o.equipe === eq && o.actif); }
function dBetween(a, b) { return Math.max(1, Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000) + 1); }
function sups() { return D.operators.filter(o => o.poste === 'supervision' && o.actif); }

// ── API HELPERS ────────────────────────────────────────────────────────
async function api(path, options = {}) {
    const res = await fetch('/api' + path, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers }
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erreur API');
    return json.data;
}

// ── DATA LOADING ─────────────────────────────────────────────────────
async function load() {
    try {
        const [cfg, ops, sits, abs, notifs, cs, caps, escs] = await Promise.all([
            api('/config'), api('/operateurs'), api('/sitreps'), api('/absences'),
            api('/notifications'), api('/consignes'), api('/captures'), api('/escortes')
        ]);
        D.config = cfg; D.operators = ops; D.sitreps = sits; D.absences = abs;
        D.notifications = notifs; D.consignes = cs; D.captures = caps; D.escortes = escs;
        updDot();
    } catch (e) { console.error('Load error:', e); }
}

async function pushN(type, titre, detail, urg = false) {
    try {
        const n = await api('/notifications', { method: 'POST', body: JSON.stringify({ type, titre, detail, urg }) });
        D.notifications.unshift(n); updDot();
    } catch (e) { console.error(e); }
}

function updDot() {
    const n = D.notifications.filter(x => !x.lu).length;
    const d = document.getElementById('notif-dot');
    if (d) d.style.display = n > 0 ? 'inline-block' : 'none';
}

// ── CLOCK ─────────────────────────────────────────────────────────────
function tickClock() {
    const now = new Date();
    const t = now.toTimeString().slice(0, 8);
    const d = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const e1 = document.getElementById('hdr-time'), e2 = document.getElementById('hdr-date');
    if (e1) e1.textContent = t; if (e2) e2.textContent = d;
}
setInterval(tickClock, 1000); tickClock();

// ── TABS & NAVIGATION ─────────────────────────────────────────────────
async function showTab(n) {
    document.querySelectorAll('.tab').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.nb').forEach(b => b.classList.toggle('active', b.dataset.tab === n));
    document.getElementById('tab-' + n).style.display = 'block';
    
    if (n === 'supervision') {
        try { await api('/notifications/mark-read', { method: 'PATCH' }); D.notifications.forEach(x => x.lu = true); updDot(); } catch (e) {}
    }
    
    await load();
    const renderers = {
        dashboard: renderDash, sitrep: renderSitrep, planning: renderCal,
        operators: renderOps, absences: renderAbs, supervision: renderSup,
        fichiers: renderFichiers, escorte: renderEscorte
    };
    renderers[n]?.();
}

// ── DASHBOARD ─────────────────────────────────────────────────────────
function renderDash() {
    const t = tod(), eq = getTeam(t), ops = tOps(eq);
    const tom = new Date(); tom.setDate(tom.getDate() + 1); const nEq = getTeam(tom.toISOString().slice(0, 10));
    const mo = t.slice(0, 7);
    const aN = D.absences.filter(a => a.date_debut.slice(0, 7) === mo || a.date_fin.slice(0, 7) === mo).length;

    document.getElementById('s-eq').innerHTML = tBadge(eq);
    document.getElementById('hs-eq').innerHTML = tBadge(eq);
    document.getElementById('s-ops').textContent = ops.length;
    document.getElementById('hs-ops').textContent = ops.length;
    document.getElementById('s-abs').textContent = aN;
    document.getElementById('s-next2').innerHTML = tBadge(nEq);
    document.getElementById('hs-sit').textContent = D.sitreps.length;
    document.getElementById('hs-next').innerHTML = tBadge(nEq);

    let qh = '';
    if(!ops.length) qh = `<div class="empty">Aucun opérateur — Équipe ${eq}</div>`;
    else {
        qh = '<div class="tw"><table><thead><tr><th>Nom / Prénom</th><th>Grade</th><th>Poste</th></tr></thead><tbody>';
        ops.forEach(o => { qh += `<tr><td><strong>${o.nom}</strong> ${o.prenom}</td><td>${o.grade}</td><td>${POSTES[o.poste]||o.poste}</td></tr>`; });
        qh += '</tbody></table></div>';
    }
    document.getElementById('d-quart-ops').innerHTML = qh;
    
    let rot = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px">';
    for(let i=0; i<4; i++){
        const d=new Date(); d.setDate(d.getDate()+i); const ds=d.toISOString().slice(0,10);
        const dn=i===0?'Auj.':i===1?'Dem.':d.toLocaleDateString('fr-FR',{weekday:'short'});
        rot += `<div style="text-align:center;padding:7px;border:1px solid var(--color-border-tertiary);border-radius:6px">
            <div style="font-size:9px;color:var(--color-text-secondary);margin-bottom:4px;text-transform:uppercase">${dn}</div>${tBadge(getTeam(ds))}
        </div>`;
    }
    document.getElementById('d-rotation').innerHTML = rot + '</div>';
    fetchRecentEvents();
}

async function fetchRecentEvents() {
    try {
        const evs = await api('/rapports/recent-events');
        let eh = '';
        if(!evs.length) eh = '<div class="empty">Aucun événement répertorié.</div>';
        else evs.forEach(ev => {
            eh += `<div class="ev-item"><div class="flex-b" style="margin-bottom:3px"><span class="badge ${EV_C[ev.type]||'bi'}">${EV_L[ev.type]||ev.type}</span><span style="font-size:10px">${fmt(ev.date)} · ${ev.heure}</span></div><div style="font-size:12px">${ev.description}</div></div>`;
        });
        document.getElementById('d-events').innerHTML = eh;
    } catch(e) {}
}

// ── SITREP MODULE ─────────────────────────────────────────────────────
function renderSitrep() {
    const fEq = document.getElementById('sitrep-filter-eq')?.value || '';
    const fDate = document.getElementById('sitrep-filter-date')?.value || '';
    let sits = D.sitreps.slice().sort((a,b)=>Number(b.num)-Number(a.num));
    if(fEq) sits = sits.filter(s=>s.equipe===fEq);
    if(fDate) sits = sits.filter(s=>s.date===fDate);
    
    document.getElementById('sitrep-count').textContent = sits.length + ' SITREP(s) enregistré(s)';
    document.getElementById('sitrep-list').innerHTML = sits.length ? sits.map(s => buildSitCard(s)).join('') : '<div class="empty">Aucun SITREP trouvé.</div>';
}

function buildSitCard(s) {
    const fields = [['HEURE',s.heure],['SPEED',s.speed?s.speed+' nds':'—'],['COURSE',s.course?s.course+'°':'—'],['POS.',(s.lat||'')+' / '+(s.lon||'')]];
    let grid = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px">';
    fields.forEach(([l,v])=> { grid += `<div class="sit-f"><div class="sit-fl">${l}</div><div class="sit-fv">${v||'—'}</div></div>`; });
    grid += '</div>';

    return `
        <div class="sit-card">
            <div class="flex-b">
                <div class="flex"><div class="sit-num">${s.num}</div><div><strong>SITREP N° ${s.num}</strong><div style="font-size:11px;color:var(--color-text-secondary)">${fmt(s.date)} · ${s.heure} · ${tBadge(s.equipe)}</div></div></div>
                <div class="flex">
                    <button class="btn btn-gold" style="font-size:10px" onclick="editSitrep('${s.id}')">Modifier</button>
                    <button class="btn" style="font-size:10px" onclick="printSitrep('${s.id}')">Imprimer</button>
                    <button class="btn btn-danger" style="font-size:10px" onclick="delSitrep('${s.id}')">Supprimer</button>
                </div>
            </div>
            ${grid}
            ${s.comment ? `<div style="margin-top:10px;padding:8px;background:rgba(0,0,0,0.05);border-radius:4px;font-size:12px"><strong>Obs:</strong> ${s.comment}</div>`:''}
        </div>
    `;
}

window.openSitrepForm = (reset) => {
    document.getElementById('sitrep-form').style.display = 'block';
    if(reset) {
        document.getElementById('sitrep-form-title').textContent = 'Nouveau SITREP';
        const lastNum = D.sitreps.length ? Math.max(...D.sitreps.map(s=>Number(s.num)||0)) : 0;
        document.getElementById('sit-num').value = lastNum + 1;
        document.getElementById('sit-date').value = tod();
        document.getElementById('sit-time').value = nowT();
        document.getElementById('sit-equipe').value = getTeam(tod());
        ['sit-speed','sit-course','sit-lat','sit-lon','sit-comment'].forEach(id => document.getElementById(id).value='');
        document.getElementById('sit-edit-id').value = '';
    }
};

window.editSitrep = (id) => {
    const s = D.sitreps.find(x => x.id === id); if(!s) return;
    document.getElementById('sitrep-form-title').textContent = 'Modifier SITREP N°' + s.num;
    document.getElementById('sit-num').value = s.num;
    document.getElementById('sit-date').value = s.date;
    document.getElementById('sit-time').value = s.heure;
    document.getElementById('sit-equipe').value = s.equipe;
    document.getElementById('sit-speed').value = s.speed || '';
    document.getElementById('sit-course').value = s.course || '';
    document.getElementById('sit-lat').value = s.lat || '';
    document.getElementById('sit-lon').value = s.lon || '';
    document.getElementById('sit-comment').value = s.comment || '';
    document.getElementById('sit-edit-id').value = id;
    document.getElementById('sitrep-form').style.display = 'block';
    document.getElementById('sitrep-form').scrollIntoView({behavior:'smooth'});
};

window.saveSitrep = async () => {
    const s = {
        num: Number(document.getElementById('sit-num').value),
        date: document.getElementById('sit-date').value,
        heure: document.getElementById('sit-time').value,
        equipe: document.getElementById('sit-equipe').value,
        speed: document.getElementById('sit-speed').value,
        course: document.getElementById('sit-course').value,
        lat: document.getElementById('sit-lat').value,
        lon: document.getElementById('sit-lon').value,
        comment: document.getElementById('sit-comment').value
    };
    const eid = document.getElementById('sit-edit-id').value;
    try {
        if(eid) await api('/sitreps/' + eid, { method: 'PUT', body: JSON.stringify(s) });
        else await api('/sitreps', { method: 'POST', body: JSON.stringify(s) });
        pushN('sitrep', `SITREP N°${s.num} - ${s.equipe}`, `${s.heure} : ${s.lat}/${s.lon}`);
        await load(); document.getElementById('sitrep-form').style.display = 'none'; renderSitrep();
    } catch(e) { alert(e.message); }
};

window.delSitrep = async (id) => {
    if(!confirm('Supprimer ce SITREP ?')) return;
    try { await api('/sitreps/' + id, { method: 'DELETE' }); await load(); renderSitrep(); } catch(e) { alert(e.message); }
};

window.printSitrep = (id) => {
    const s = D.sitreps.find(x => x.id === id); if(!s) return;
    const html = `<html><head><title>SITREP ${s.num}</title><style>body{font-family:sans-serif;padding:40px}h1{border-bottom:2px solid #333}table{width:100%;border-collapse:collapse;margin-top:20px}td{padding:10px;border-bottom:1px solid #ddd} .lbl{font-weight:bold;width:150px}</style></head>
    <body><h1>SITREP N° ${s.num}</h1><p>Date: ${fmt(s.date)} | Heure: ${s.heure} | Équipe: ${s.equipe}</p>
    <table><tr><td class="lbl">Latitude</td><td>${s.lat||'—'}</td></tr><tr><td class="lbl">Longitude</td><td>${s.lon||'—'}</td></tr><tr><td class="lbl">Vitesse</td><td>${s.speed||'—'} kts</td></tr><tr><td class="lbl">Course</td><td>${s.course||'—'}°</td></tr></table>
    <div style="margin-top:20px"><strong>Observations:</strong><br>${s.comment||'Néant'}</div></body></html>`;
    const w = window.open('','_blank'); w.document.write(html); w.document.close(); setTimeout(()=>w.print(), 500);
};

// ── OPERATORS MODULE ──────────────────────────────────────────────────
function renderOps() {
    const filt = document.getElementById('filter-eq').value;
    let ops = D.operators; if(filt) ops = ops.filter(o => o.equipe === filt);
    const tbody = document.getElementById('ops-body'); tbody.innerHTML = '';
    ops.forEach(o => {
        tbody.innerHTML += `<tr>
            <td><strong>${o.nom}</strong> ${o.prenom}</td>
            <td>${o.grade}</td>
            <td>${tBadge(o.equipe)}</td>
            <td>${POSTES[o.poste]||o.poste}</td>
            <td><span class="badge ${o.actif?'bv':'br'}">${o.actif?'Actif':'Inactif'}</span></td>
            <td>
                <button class="btn" onclick="editOp('${o.id}')">Mod.</button>
                <button class="btn btn-danger" onclick="delOp('${o.id}')">×</button>
            </td>
        </tr>`;
    });
}

window.editOp = (id) => {
    const o = gOp(id); if(!o) return;
    document.getElementById('op-form-title').textContent = 'Modifier Opérateur';
    document.getElementById('op-nom').value = o.nom;
    document.getElementById('op-prenom').value = o.prenom;
    document.getElementById('op-grade').value = o.grade;
    document.getElementById('op-eq').value = o.equipe;
    document.getElementById('op-poste').value = o.poste;
    document.getElementById('op-actif').value = o.actif ? '1' : '0';
    document.getElementById('op-edit-id').value = id;
    document.getElementById('op-form').style.display = 'block';
};

window.delOp = async (id) => {
    if(!confirm('Supprimer cet opérateur ?')) return;
    try { await api('/operateurs/' + id, { method: 'DELETE' }); await load(); renderOps(); } catch(e) { alert(e.message); }
};

window.saveOp = async () => {
    const o = {
        nom: document.getElementById('op-nom').value.toUpperCase(),
        prenom: document.getElementById('op-prenom').value,
        grade: document.getElementById('op-grade').value,
        equipe: document.getElementById('op-eq').value,
        poste: document.getElementById('op-poste').value,
        actif: document.getElementById('op-actif').value === '1'
    };
    const eid = document.getElementById('op-edit-id').value;
    try {
        if(eid) await api('/operateurs/' + eid, { method: 'PUT', body: JSON.stringify(o) });
        else await api('/operateurs', { method: 'POST', body: JSON.stringify(o) });
        await load(); document.getElementById('op-form').style.display = 'none'; renderOps();
    } catch(e) { alert(e.message); }
};

// ── RAPPORT DE QUART ──────────────────────────────────────────────────
window.loadRpt = async () => {
    const date = document.getElementById('rpt-date').value;
    if(!date) return;
    curRptDate = date;
    const r = await api('/rapports/' + date);
    document.getElementById('rpt-title').textContent = 'RAPPORT DU ' + fmt(date);
    document.getElementById('rpt-content').style.display = 'block';
    document.getElementById('rpt-obs').value = r.observations || '';
    
    // Fill Chef Select
    const chefSel = document.getElementById('rpt-chef'); chefSel.innerHTML = '<option value="">-- Choisir --</option>';
    tOps(r.equipe).forEach(op => {
        chefSel.innerHTML += `<option value="${op.id}" ${op.id === r.chef ? 'selected':''}>${op.grade} ${op.nom}</option>`;
    });
    renderEvList(r.evenements);
};

function renderEvList(evs) {
    const list = document.getElementById('ev-list');
    if(!evs || !evs.length) { list.innerHTML = '<div class="empty">Aucun événement.</div>'; return; }
    list.innerHTML = evs.map((ev, i) => `
        <div class="ev-item">
            <div class="flex-b"><strong>${ev.heure} - ${EV_L[ev.type]}</strong><button class="btn btn-danger" onclick="delEv('${ev.id}')">×</button></div>
            <div style="font-size:12px">${ev.description}</div>
        </div>
    `).join('');
}

window.addEv = async () => {
    const ev = { heure: document.getElementById('ev-heure').value, type: document.getElementById('ev-type').value, description: document.getElementById('ev-desc').value };
    if(!ev.heure || !ev.description) return;
    try {
        await api(`/rapports/${curRptDate}/evenements`, { method: 'POST', body: JSON.stringify(ev) });
        loadRpt(); document.getElementById('ev-form').style.display = 'none';
    } catch(e) {}
};

window.delEv = async (id) => {
    if(!confirm('Effacer cet événement ?')) return;
    try { await api(`/rapports/evenements/${id}`, { method: 'DELETE' }); loadRpt(); } catch(e) {}
};

window.saveRptMeta = async () => {
    const data = { chef: document.getElementById('rpt-chef').value, observations: document.getElementById('rpt-obs').value };
    try { await api(`/rapports/${curRptDate}/meta`, { method: 'POST', body: JSON.stringify(data) }); alert('Enregistré'); } catch(e) {}
};

window.printRpt = async () => {
    const r = await api('/rapports/' + curRptDate);
    const chef = gOp(r.chef);
    const html = `<html><head><title>Rapport ${curRptDate}</title><style>body{font-family:sans-serif;padding:30px}h1{border-bottom:3px solid #081522} .ev{border-left:2px solid #ddd;padding-left:10px;margin-bottom:10px}</style></head>
    <body><h1>JOCC - RAPPORT DE QUART DU ${fmt(curRptDate)}</h1>
    <p>Équipe: ${r.equipe} | Chef de quart: ${chef ? chef.nom : '—'}</p>
    <h3>MAIN COURANTE</h3>
    ${r.evenements.map(e => `<div class="ev"><strong>${e.heure} [${EV_L[e.type]}]</strong><br>${e.description}</div>`).join('')}
    <h3>OBSERVATIONS</h3><p>${r.observations || 'Néant'}</p></body></html>`;
    const w = window.open(); w.document.write(html); w.document.close(); setTimeout(()=>w.print(), 500);
};

// ── PLANNING / CALENDAR ────────────────────────────────────────────────
function renderCal() {
    document.getElementById('cal-label').textContent = new Date(calY, calM).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const grid = document.getElementById('cal-grid'); grid.innerHTML = '';
    const first = new Date(calY, calM, 1), last = new Date(calY, calM + 1, 0), td = tod();
    let dow = (first.getDay() + 6) % 7;
    for(let i=0; i<dow; i++) { mkDay(grid, '', '', true); }
    for(let i=1; i<=last.getDate(); i++) {
        const ds = new Date(calY, calM, i).toISOString().slice(0, 10);
        mkDay(grid, i, ds, false, ds === td);
    }
    document.getElementById('cfg-date').value = D.config.refDate;
    document.getElementById('cfg-team').value = D.config.refTeam;
}

function mkDay(grid, n, ds, om, isT) {
    const div = document.createElement('div'); div.className = 'cal-d' + (om ? ' om':'') + (isT ? ' today':'');
    if(!om) {
        const team = getTeam(ds);
        div.innerHTML = `<div style="font-size:9px">${n}</div>${tBadge(team)}`;
        div.onclick = () => {
            document.getElementById('cal-detail').style.display = 'block';
            document.getElementById('cal-det-title').textContent = fmt(ds) + ' - Équipe ' + team;
            let opsStr = tOps(team).map(o => `<li>${o.grade} ${o.nom}</li>`).join('');
            document.getElementById('cal-det-body').innerHTML = `<ul>${opsStr || 'Aucun opérateur'}</ul>`;
        };
    }
    grid.appendChild(div);
}

// ── ABSENCES ──────────────────────────────────────────────────────────
function renderAbs() {
    const tbody = document.getElementById('abs-body'); tbody.innerHTML = '';
    D.absences.forEach(a => {
        const op = gOp(a.operateur_id);
        const dur = dBetween(a.date_debut, a.date_fin);
        tbody.innerHTML += `<tr>
            <td>${op ? op.nom : '?'}</td><td class="hide-mob">${op?tBadge(op.equipe):''}</td>
            <td>${MOTIFS[a.motif]||a.motif}</td><td>${fmt(a.date_debut)}</td><td class="hide-mob">${fmt(a.date_fin)}</td>
            <td class="hide-mob">${dur}j</td><td><span class="badge ${a.statut==='valide'?'bv':'bi'}">${a.statut}</span></td>
            <td><button class="btn btn-danger" onclick="delAbs('${a.id}')">×</button></td>
        </tr>`;
    });
}

window.delAbs = async (id) => {
    if(!confirm('Supprimer ?')) return;
    try { await api('/absences/' + id, { method: 'DELETE' }); await load(); renderAbs(); } catch(e) {}
};

window.saveAbs = async () => {
    const a = { operateur_id: document.getElementById('abs-op').value, motif: document.getElementById('abs-motif').value, date_debut: document.getElementById('abs-debut').value, date_fin: document.getElementById('abs-fin').value };
    try { await api('/absences', { method: 'POST', body: JSON.stringify(a) }); await load(); document.getElementById('abs-form').style.display='none'; renderAbs(); } catch(e) {}
};

// ── SUPERVISION ───────────────────────────────────────────────────────
function renderSup() {
    document.getElementById('sup-sitreps').textContent = D.sitreps.length;
    document.getElementById('sup-notif-count').textContent = D.notifications.filter(n=>!n.lu).length;
    document.getElementById('sup-urgences').textContent = D.notifications.filter(n=>n.urg).length;
    
    let eh = '';
    TEAMS.forEach(t => {
        const ops = tOps(t);
        const isAct = getTeam(tod()) === t;
        eh += `<div class="card" style="${isAct?'border-color:gold':''}">
            <div class="flex-b"><strong>Équipe ${t}</strong> ${isAct?'<span class="badge bv">Actif</span>':''}</div>
            <div style="font-size:11px">${ops.length} membres</div>
        </div>`;
    });
    document.getElementById('sup-equipes').innerHTML = `<div class="g4">${eh}</div>`;
    renderSupN();
}

function renderSupN() {
    const filt = document.getElementById('sup-filter').value;
    let notifs = D.notifications; if(filt) notifs = notifs.filter(n => n.type === filt);
    document.getElementById('sup-notifs').innerHTML = notifs.map(n => `
        <div class="notif-item ${n.urg?'urg':''}">
            <div class="flex-b"><strong>${n.titre}</strong> <span style="font-size:10px">${n.lu?'Lu':'Neuf'}</span></div>
            <div style="font-size:11px">${n.detail}</div>
        </div>
    `).join('');
}

// ── FICHIERS ET CAPTURES ──────────────────────────────────────────────
function renderFichiers() {
    document.getElementById('consignes-list').innerHTML = D.consignes.map(c => `
        <div class="file-item">
            <div><strong>${c.titre}</strong><br><small>${c.desc}</small></div>
            <button class="btn btn-danger" onclick="delConsigne('${c.id}')">×</button>
        </div>
    `).join('');
    
    document.getElementById('surveillance-list').innerHTML = D.captures.map(cap => `
        <div class="file-item">
            <img src="${cap.data_url || ''}" style="width:50px;height:40px;object-fit:cover;border-radius:4px">
            <div><strong>${SRCS[cap.source]||cap.source}</strong><br><small>${cap.comment}</small></div>
            <button class="btn btn-danger" onclick="delCap('${cap.id}')">×</button>
        </div>
    `).join('');
}

window.delConsigne = async (id) => {
    try { await api('/consignes/'+id, {method:'DELETE'}); await load(); renderFichiers(); } catch(e){}
};
window.delCap = async (id) => {
    try { await api('/captures/'+id, {method:'DELETE'}); await load(); renderFichiers(); } catch(e){}
};

// ── MODULE ESCORTE (⚓) ────────────────────────────────────────────────
function renderEscorte() {
    const list = document.getElementById('escorte-list');
    if(!D.escortes.length) { list.innerHTML = '<div class="empty">Aucune mission d\'escorte.</div>'; return; }
    list.innerHTML = D.escortes.map(e => `
        <div class="sit-card">
            <div class="flex-b">
                <div><strong>MISSION ${e.num}</strong><br><small>${fmt(e.date)} - ${e.heure}</small></div>
                <div class="flex"><span class="badge bi">${e.statut}</span><button class="btn" onclick="editEsc('${e.id}')">Editer</button></div>
            </div>
            <div style="font-size:12px;margin-top:8px">Cible: ${e.cible_nom} (${e.cible_type}) | Escorteur: ${e.nav_nom}</div>
        </div>
    `).join('');
}

window.editEsc = (id) => {
    const e = D.escortes.find(x => x.id === id); if(!e) return;
    document.getElementById('esc-num').value = e.num;
    document.getElementById('esc-date').value = e.date;
    document.getElementById('esc-heure').value = e.heure;
    document.getElementById('esc-cible-nom').value = e.cible_nom;
    document.getElementById('esc-edit-id').value = id;
    document.getElementById('escorte-form').style.display = 'block';
};

window.saveEsc = async () => {
    const e = { num: document.getElementById('esc-num').value, date: document.getElementById('esc-date').value, heure: document.getElementById('esc-heure').value, cible_nom: document.getElementById('esc-cible-nom').value, statut: 'planifiee' };
    const eid = document.getElementById('esc-edit-id').value;
    try {
        if(eid) await api('/escortes/'+eid, {method:'PUT', body:JSON.stringify(e)});
        else await api('/escortes', {method:'POST', body:JSON.stringify(e)});
        await load(); document.getElementById('escorte-form').style.display='none'; renderEscorte();
    } catch(err) {}
};

// ── INITIALISATION ET EVENT LISTENERS ─────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
    await load();
    showTab('dashboard');

    // Navigation
    document.querySelectorAll('.nb').forEach(b => {
        b.onclick = () => showTab(b.dataset.tab);
    });

    // Binding des boutons globaux (ceux qui n'ont pas de onclick dans index.html)
    const binders = [
        ['btn-new-sitrep', () => openSitrepForm(true)],
        ['sitrep-cancel', () => document.getElementById('sitrep-form').style.display='none'],
        ['sitrep-cancel2', () => document.getElementById('sitrep-form').style.display='none'],
        ['sit-save', saveSitrep],
        ['btn-save-cfg', async () => {
            const cfg = { refDate: document.getElementById('cfg-date').value, refTeam: document.getElementById('cfg-team').value };
            await api('/config', { method: 'POST', body: JSON.stringify(cfg) });
            await load(); renderCal(); renderDash();
        }],
        ['cal-prev', () => { calM--; if(calM<0){calM=11;calY--;} renderCal(); }],
        ['cal-next', () => { calM++; if(calM>11){calM=0;calY++;} renderCal(); }],
        ['cal-det-close', () => document.getElementById('cal-detail').style.display='none'],
        ['btn-new-op', () => {
            document.getElementById('op-form').style.display = 'block';
            document.getElementById('op-form-title').textContent = 'Nouvel Opérateur';
            document.getElementById('op-edit-id').value = '';
        }],
        ['op-cancel', () => document.getElementById('op-form').style.display='none'],
        ['op-save', saveOp],
        ['btn-load-rpt', loadRpt],
        ['btn-save-rpt-meta', saveRptMeta],
        ['btn-show-ev', () => { document.getElementById('ev-form').style.display='block'; document.getElementById('ev-heure').value = nowT(); }],
        ['btn-add-ev', addEv],
        ['btn-cancel-ev', () => document.getElementById('ev-form').style.display='none'],
        ['btn-print-rpt', printRpt],
        ['btn-new-abs', () => {
             const sel = document.getElementById('abs-op'); sel.innerHTML = '';
             D.operators.forEach(o => sel.innerHTML += `<option value="${o.id}">${o.nom}</option>`);
             document.getElementById('abs-form').style.display='block';
        }],
        ['abs-cancel', () => document.getElementById('abs-form').style.display='none'],
        ['abs-save', saveAbs],
        ['btn-new-escorte', () => { document.getElementById('escorte-form').style.display='block'; document.getElementById('esc-edit-id').value=''; }],
        ['escorte-cancel', () => document.getElementById('escorte-form').style.display='none'],
        ['esc-save', saveEsc]
    ];

    binders.forEach(([id, fn]) => {
        const el = document.getElementById(id);
        if(el) el.onclick = fn;
    });

    // Filters
    ['sitrep-filter-eq', 'sitrep-filter-date'].forEach(id => {
        const el = document.getElementById(id); if(el) el.onchange = renderSitrep;
    });
    const opFilt = document.getElementById('filter-eq'); if(opFilt) opFilt.onchange = renderOps;
});
