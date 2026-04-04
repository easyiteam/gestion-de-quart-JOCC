/* ═══════════════════════════════════════════════════════════════
   JOCC — Gestion des Quarts · v5.0 (FULLSTACK)
   Alignement Backend & Restauration Logique Business
   ═══════════════════════════════════════════════════════════════ */

const TEAMS = ['A', 'B', 'C', 'D'];
const POSTES = { chef: 'Chef de quart', veille: 'Op. de veille', radio: 'Op. radio', permanence: 'Off. permanence', supervision: 'Superviseur', liaison: 'Off. de liaison' };
const EV_L = { routine: 'Routine', info: 'Information', urgence: 'Urgence' };
const EV_C = { routine: 'bi', info: 'bi', urgence: 'br' };
const MOTIFS = { maladie: 'Maladie', conge: 'Congé', formation: 'Formation', mission: 'Mission', autre: 'Autre' };
const PRIO_C = { normal: 'bi', important: 'bw', urgent: 'br' };
const PRIO_L = { normal: 'Normale', important: 'Importante', urgent: 'Urgente' };
const SRCS = { vtmis: 'VTMIS', ais: 'AIS', radar: 'Radar', camera: 'Caméra', autre: 'Autre' };

let D = { config: { refDate: '2026-01-01', refTeam: 'A' }, operators: [], sitreps: [], absences: [], notifications: [], consignes: [], captures: [], escortes: [], rapports: {}, escales: [], etaWapco: [] };
let _esc2DocFD = null; // { name, data } pour le doc d'autorisation escale
let _wapDocFD  = null; // idem pour ETA WAPCO
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

window.currentUser = null;

// ── PERMISSIONS ────────────────────────────────────────────────────────
const ROLE_LEVEL = { permanence: 1, liaison: 1, veille: 2, radio: 2, chef: 3, supervision: 4 };
function can(action) {
    const lv = ROLE_LEVEL[window.currentUser?.poste] ?? 0;
    const map = {
        manage_operators: 4, config_rotation: 4, clear_notifications: 4,
        validate_absence: 4, reset_any_password: 4,
        delete_sitrep: 3, delete_event: 3, manage_escortes: 3,
        delete_absence: 3, manage_consignes: 3, manage_captures: 3, edit_rapport_chef: 3,
        create_sitrep: 1, create_absence: 1, add_event: 1,
    };
    return lv >= (map[action] ?? 99);
}
function applyRBAC() {
    const role = window.currentUser?.poste;
    const isSup = role === 'supervision';
    // Tabs
    document.querySelectorAll('[data-tab="supervision"],[data-tab="operators"]').forEach(el => {
        el.style.display = isSup ? '' : 'none';
    });
    document.querySelector('#btn-config-rot')?.style && (document.querySelector('#btn-config-rot').style.display = isSup ? '' : 'none');
    // Buttons with data-role attr
    document.querySelectorAll('[data-role]').forEach(el => {
        const req = el.getAttribute('data-role');
        const needed = ROLE_LEVEL[req] ?? 99;
        el.style.display = (ROLE_LEVEL[role] ?? 0) >= needed ? '' : 'none';
    });
    // Nav handler
    document.querySelectorAll('.nb').forEach(b => {
        const t = b.dataset.tab;
        const reqRole = b.getAttribute('data-role');
        if (reqRole) {
            const needed = ROLE_LEVEL[reqRole] ?? 99;
            b.style.display = (ROLE_LEVEL[role] ?? 0) >= needed ? '' : 'none';
        }
        b.onclick = () => {
            const needed = ROLE_LEVEL[b.getAttribute('data-role')] ?? 0;
            if ((ROLE_LEVEL[role] ?? 0) < needed) return;
            if (!isSup && (t === 'supervision' || t === 'operators')) return;
            showTab(t);
        };
    });
}

// ── API HELPERS ────────────────────────────────────────────────────────
async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const token = localStorage.getItem('jocc_token');
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch('/api' + path, { ...options, headers });
    if (res.status === 401) {
        localStorage.removeItem('jocc_token');
        window.location.reload();
        return;
    }
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erreur API');
    return json.data;
}

// ── DATA LOADING ─────────────────────────────────────────────────────
async function load() {
    try {
        const [cfg, ops, sits, abs, notifs, cs, caps, escs, escales, wapco] = await Promise.all([
            api('/config'), api('/operateurs'), api('/sitreps'), api('/absences'),
            api('/notifications'), api('/consignes'), api('/captures'), api('/escortes'),
            api('/escales'), api('/eta-wapco')
        ]);
        D.config = cfg; D.operators = ops; D.sitreps = sits; D.absences = abs;
        D.notifications = notifs; D.consignes = cs; D.captures = caps; D.escortes = escs;
        D.escales = escales; D.etaWapco = wapco;
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
        fichiers: renderFichiers, escorte: renderEscorte,
        'reporting-env': renderReportingEnv,
        audit: renderAuditLogs,
        escales: renderEscales,
        'eta-wapco': renderEtaWapco
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
    if(document.getElementById('s-esc')) document.getElementById('s-esc').textContent = D.escortes.filter(e=>e.statut==='encours').length;
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
const POSTE_BADGE = { supervision:'bsup', chef:'bi', radio:'bw', veille:'bi', permanence:'bi' };
function renderOps() {
    const filt = document.getElementById('filter-eq').value;
    let ops = D.operators; if(filt) ops = ops.filter(o => o.equipe === filt);
    const tbody = document.getElementById('ops-body'); tbody.innerHTML = '';
    const isSup = can('manage_operators');
    ops.forEach(o => {
        const isMe = o.id === window.currentUser?.id;
        const actions = isSup ? `
            <button class="btn" onclick="editOp('${o.id}')">Modifier</button>
            <button class="btn" onclick="openPwModal('${o.id}',false)" title="Réinitialiser MDP">🔑</button>
            <button class="btn btn-danger" onclick="delOp('${o.id}')" title="Supprimer">×</button>
        ` : (isMe ? `<button class="btn" onclick="openPwModal('${o.id}',true)">Mon MDP</button>` : '');
        tbody.innerHTML += `<tr ${isMe ? 'style="background:rgba(200,164,74,.06)"' : ''}>
            <td><strong>${o.nom}</strong> ${o.prenom}${isMe ? ' <span style="font-size:10px;opacity:.5">(vous)</span>' : ''}</td>
            <td>${o.grade}</td>
            <td>${tBadge(o.equipe)}</td>
            <td><span class="badge ${POSTE_BADGE[o.poste]||'bi'}">${POSTES[o.poste]||o.poste}</span></td>
            <td><span class="badge ${o.actif?'bv':'br'}">${o.actif?'Actif':'Inactif'}</span></td>
            <td>${actions}</td>
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
    try { await api(`/rapports/${curRptDate}/evenements/${id}`, { method: 'DELETE' }); loadRpt(); } catch(e) {}
};

window.saveRptMeta = async () => {
    const data = { chef: document.getElementById('rpt-chef').value, observations: document.getElementById('rpt-obs').value };
    try { await api(`/rapports/${curRptDate}`, { method: 'PUT', body: JSON.stringify(data) }); alert('Enregistré'); } catch(e) {}
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
    if(document.getElementById('sup-esc')) document.getElementById('sup-esc').textContent = D.escortes.filter(e=>e.statut==='encours').length;
    
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
const STATUTS_ESC = { planifiee: 'Planifiée', encours: 'En cours', terminee: 'Terminée', annulee: 'Annulée' };
const ST_C_ESC = { planifiee: 'bw', encours: 'bv', terminee: 'bi', annulee: 'br' };

function renderEscorte() {
    const st = document.getElementById('esc-flt-st')?.value || '';
    const ty = document.getElementById('esc-flt-ty')?.value || '';
    const dt = document.getElementById('esc-flt-dt')?.value || '';
    
    let escs = D.escortes.slice().sort((a,b) => (a.date===b.date) ? b.heure.localeCompare(a.heure) : b.date.localeCompare(a.date));
    
    if(document.getElementById('esg-total')){
      document.getElementById('esg-total').textContent = escs.length;
      document.getElementById('esg-plan').textContent = escs.filter(e=>e.statut==='planifiee').length;
      document.getElementById('esg-encours').textContent = escs.filter(e=>e.statut==='encours').length;
      document.getElementById('esg-done').textContent = escs.filter(e=>e.statut==='terminee').length;
    }
    
    if(st) escs = escs.filter(e => e.statut === st);
    if(ty) escs = escs.filter(e => e.type === ty);
    if(dt) escs = escs.filter(e => e.date === dt);
    
    const list = document.getElementById('escorte-list');
    if(document.getElementById('esc-count-lbl')) document.getElementById('esc-count-lbl').textContent = escs.length + ' MISSION(S)';
    if(!escs.length) { list.innerHTML = '<div class="empty">Aucune mission trouvée.</div>'; return; }
    
    list.innerHTML = escs.map(e => `
        <div class="sit-card" style="${e.statut==='encours'?'border-color:#27ae60':''}">
            <div class="flex-b" style="margin-bottom:12px">
                <div class="flex">
                    <div class="sit-num">${e.num}</div>
                    <div><strong>MISSION D'ESCORTE</strong><div style="font-size:11px;color:var(--color-text-secondary)">${fmt(e.date)} · ${e.heure} · ${tBadge(e.equipe)}</div></div>
                </div>
                <div class="flex">
                    <span class="badge ${ST_C_ESC[e.statut]||'bi'}">${STATUTS_ESC[e.statut]||e.statut}</span>
                    <button class="btn btn-gold" style="font-size:10px" onclick="editEsc('${e.id}')">Editer</button>
                    <button class="btn btn-danger" style="font-size:10px" onclick="delEsc('${e.id}')">×</button>
                </div>
            </div>
            <div class="g2">
                <div style="background:rgba(0,0,0,.02);padding:10px;border-radius:6px">
                    <div style="font-size:10px;font-weight:700;color:var(--color-text-secondary);margin-bottom:6px">NAVIRE À ESCORTER (CIBLE)</div>
                    <div style="font-size:12px"><strong>${e.cible_nom}</strong> (${e.cible_type})</div>
                    <div style="font-size:11px">IMO: ${e.cible_imo||'—'} | MMSI: ${e.cible_mmsi||'—'} | Pavillon: ${e.cible_pavillon||'—'}</div>
                    <div style="font-size:11px">Trajet: ${e.cible_from||'—'} ➔ ${e.cible_to||'—'}</div>
                </div>
                <div style="background:rgba(0,0,0,.02);padding:10px;border-radius:6px">
                    <div style="font-size:10px;font-weight:700;color:var(--color-text-secondary);margin-bottom:6px">NAVIRE ESCORTEUR</div>
                    <div style="font-size:12px"><strong>${e.nav_nom||'—'}</strong> (${e.nav_type})</div>
                    <div style="font-size:11px">CMD: ${e.nav_cmd||'—'} | Equipage: ${e.nav_effectif||'—'}</div>
                    <div style="font-size:11px">Zone: ${e.zone||'—'} | RDV: ${e.rdv||'—'} | VHF: ${e.nav_vhf||'—'}</div>
                </div>
            </div>
            ${e.comment ? `<div style="font-size:11px;margin-top:10px;padding:6px;background:rgba(0,0,0,.03);border-radius:4px"><strong>Obs:</strong> ${e.comment}</div>` : ''}
            <div class="flex" style="margin-top:10px;gap:5px;justify-content:flex-end">
                <div style="font-size:10px;font-weight:600;margin-right:10px;color:var(--color-text-secondary)">STATUT :</div>
                <button class="btn ${e.statut==='planifiee'?'btn-info':''}" style="font-size:9px" onclick="changeEscStatut('${e.id}', 'planifiee')">Planifiée</button>
                <button class="btn ${e.statut==='encours'?'btn-info':''}" style="font-size:9px" onclick="changeEscStatut('${e.id}', 'encours')">En cours</button>
                <button class="btn ${e.statut==='terminee'?'btn-info':''}" style="font-size:9px" onclick="changeEscStatut('${e.id}', 'terminee')">Terminée</button>
                <button class="btn ${e.statut==='annulee'?'btn-danger':''}" style="font-size:9px" onclick="changeEscStatut('${e.id}', 'annulee')">Annulée</button>
            </div>
        </div>
    `).join('');
}

window.openEscForm = (reset) => {
    document.getElementById('escorte-form').style.display='block';
    if(reset) {
        document.getElementById('esc-edit-id').value='';
        document.querySelectorAll('#escorte-form input, #escorte-form textarea').forEach(el => {
            if(el.type !== 'hidden') el.value = '';
        });
        document.getElementById('esc-type').value = 'entree';
        document.getElementById('esc-equipe').value = getTeam(tod());
        document.getElementById('esc-cible-type').value = 'cargo';
        document.getElementById('esc-nav-type').value = 'patrouilleur';
        document.getElementById('esc-date').value = tod();
        document.getElementById('esc-heure').value = nowT();
        
        // Auto-increment Num
        const lastNum = D.escortes.length ? Math.max(...D.escortes.map(s => parseInt(s.num.replace(/[^0-9]/g, ''))||0)) : 0;
        document.getElementById('esc-num').value = 'ESC-' + String(lastNum + 1).padStart(3, '0');
    }
};

window.editEsc = (id) => {
    const e = D.escortes.find(x => x.id === id); if(!e) return;
    document.querySelectorAll('#escorte-form input, #escorte-form select, #escorte-form textarea').forEach(el => {
        if(el.id && el.id.startsWith('esc-') && el.id !== 'esc-edit-id' && !el.id.startsWith('esc-flt')) {
            const key = el.id.replace(/^esc-/, '').replace(/-/g, '_');
            if (e[key] !== undefined && e[key] !== null) {
                if(el.type === 'datetime-local' && e[key]) {
                    el.value = new Date(e[key]).toISOString().slice(0,16);
                } else {
                    el.value = e[key];
                }
            }
        }
    });
    document.getElementById('esc-edit-id').value = id;
    document.getElementById('escorte-form').style.display = 'block';
    document.getElementById('escorte-form').scrollIntoView({behavior:'smooth'});
};

window.saveEsc = async () => {
    const e = {};
    document.querySelectorAll('#escorte-form input, #escorte-form select, #escorte-form textarea').forEach(el => {
        if(el.id && el.id.startsWith('esc-') && el.id !== 'esc-edit-id' && !el.id.startsWith('esc-flt')) {
            const key = el.id.replace(/^esc-/, '').replace(/-/g, '_');
            if(el.type === 'number') e[key] = el.value ? Number(el.value) : null;
            else e[key] = el.value || null;
        }
    });

    const eid = document.getElementById('esc-edit-id').value;
    try {
        if(eid) await api('/escortes/'+eid, {method:'PUT', body:JSON.stringify(e)});
        else {
            e.statut = 'planifiee';
            await api('/escortes', {method:'POST', body:JSON.stringify(e)});
        }
        await load(); document.getElementById('escorte-form').style.display='none'; renderEscorte();
        pushN('info', 'Escorte ' + e.num, 'Mission enregistrée');
    } catch(err) { alert(err.message); }
};

window.changeEscStatut = async (id, statut) => {
    try { await api('/escortes/'+id+'/statut', {method:'PATCH', body:JSON.stringify({statut})}); await load(); renderEscorte(); } catch(e){}
};

window.delEsc = async (id) => {
    if(!confirm('Supprimer définitivement cette mission ?')) return;
    try { await api('/escortes/'+id, {method:'DELETE'}); await load(); renderEscorte(); } catch(e){}
};

// ── MOT DE PASSE ──────────────────────────────────────────────────────
window.openPwModal = (opId, isSelf) => {
    const op = D.operators.find(o => o.id === opId);
    document.getElementById('modal-pw-op-id').value = opId;
    document.getElementById('modal-pw-target-name').textContent = op ? `${op.grade} ${op.nom} ${op.prenom}` : '';
    document.getElementById('modal-pw-current-wrap').style.display = isSelf ? '' : 'none';
    document.getElementById('modal-pw-current').value = '';
    document.getElementById('modal-pw-new').value = '';
    document.getElementById('modal-pw-confirm').value = '';
    document.getElementById('modal-pw-err').style.display = 'none';
    document.getElementById('modal-pw').style.display = 'flex';
};
window.savePwChange = async () => {
    const opId = document.getElementById('modal-pw-op-id').value;
    const isSelf = opId === window.currentUser?.id;
    const current = document.getElementById('modal-pw-current').value;
    const np = document.getElementById('modal-pw-new').value;
    const nc = document.getElementById('modal-pw-confirm').value;
    const errEl = document.getElementById('modal-pw-err');
    errEl.style.display = 'none';
    if (np.length < 4) { errEl.textContent = 'Mot de passe trop court (min. 4 caractères)'; errEl.style.display = 'block'; return; }
    if (np !== nc) { errEl.textContent = 'Les mots de passe ne correspondent pas'; errEl.style.display = 'block'; return; }
    try {
        const body = { newPassword: np };
        if (isSelf) body.currentPassword = current;
        await api('/operateurs/' + opId + '/password', { method: 'PUT', body: JSON.stringify(body) });
        document.getElementById('modal-pw').style.display = 'none';
        alert('Mot de passe mis à jour avec succès.');
    } catch(e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
};

// ── REPORTING ENVIRONNEMENTAL ──────────────────────────────────────────
const RENV_ACTIVITES = [
    'Déversements',
    'Intrusions des pêcheurs',
    'Espèces migratoires (cétacés, tortues marines, lamantins, baleine) morts, blessés ou vivants',
    'Incidents environnementaux ou de sûreté liés aux trafics portuaires',
    'Autres',
];
const RENV_ZONES = ['AMP', 'Bassin', 'Chenal', 'Mouillage'];
let renvCurrent = null;

async function loadRenv() {
    const date = document.getElementById('renv-date').value;
    if (!date) { alert('Veuillez sélectionner une date'); return; }
    const equipe = document.getElementById('renv-equipe').value;
    try {
        const r = await api('/reporting-env/' + date + '?equipe=' + equipe);
        renvCurrent = r;
        document.getElementById('renv-equipe').value = r.equipe || equipe;
        // Rédacteur dropdown
        const sel = document.getElementById('renv-redacteur');
        sel.innerHTML = '<option value="">-- Choisir --</option>';
        D.operators.filter(o => o.actif).sort((a,b) => a.nom.localeCompare(b.nom)).forEach(o => {
            sel.innerHTML += `<option value="${o.id}" ${o.id === r.redacteur_id ? 'selected' : ''}>${o.grade} ${o.nom} ${o.prenom}</option>`;
        });
        renderRenvForm(r.lignes || []);
        document.getElementById('renv-form-wrap').style.display = '';
        document.getElementById('btn-save-renv').style.display = '';
        document.getElementById('btn-print-renv').style.display = '';
        document.getElementById('btn-del-renv').style.display = can('manage_operators') ? '' : 'none';
    } catch(e) { alert(e.message); }
}

const RENV_TA = `width:100%;box-sizing:border-box;resize:vertical;min-height:70px;
  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:5px;
  color:inherit;font-size:11.5px;padding:8px;font-family:inherit;line-height:1.5;outline:none;
  transition:border-color .2s`;
const RENV_CELL = (extra='') =>
  `padding:10px;border-right:1px solid rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.08);vertical-align:top;${extra}`;

function renderRenvForm(lignes) {
    const tbody = document.getElementById('renv-tbody');
    tbody.innerHTML = '';
    RENV_ACTIVITES.forEach((act, i) => {
        const lg = lignes.find(l => l.num === i + 1) || { num: i+1, activite: act, constats: '', zones: [], commentaires: '' };
        const activeZones = lg.zones || [];
        const isLast = i === RENV_ACTIVITES.length - 1;
        const bBot = isLast ? 'border-bottom:none' : '';

        // 2×2 zone grid
        const zonesHtml = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 12px">
            ${RENV_ZONES.map(z => {
              const checked = activeZones.includes(z) ? 'checked' : '';
              const isActive = activeZones.includes(z);
              return `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:5px 7px;border-radius:5px;
                background:${isActive ? 'rgba(200,164,74,.15)' : 'rgba(255,255,255,.03)'};
                border:1px solid ${isActive ? 'rgba(200,164,74,.5)' : 'rgba(255,255,255,.08)'};
                font-size:11px;white-space:nowrap;transition:all .15s"
                onmouseenter="this.style.background='rgba(255,255,255,.07)'"
                onmouseleave="this.style.background='${isActive ? 'rgba(200,164,74,.15)' : 'rgba(255,255,255,.03)'}'">
                <input type="checkbox" data-renv-zone="${i+1}|${z}" ${checked}
                  style="accent-color:rgba(200,164,74,.9);width:14px;height:14px;cursor:pointer"> ${z}
              </label>`;
            }).join('')}
          </div>`;

        const rowBg = i % 2 === 0 ? 'background:rgba(255,255,255,.015)' : 'background:rgba(0,0,0,.1)';
        tbody.innerHTML += `
        <tr style="${rowBg}">
          <td style="${RENV_CELL('text-align:center;width:36px;')}${bBot}">
            <div style="font-size:16px;font-weight:700;color:rgba(200,164,74,.85);line-height:1">${i+1}</div>
          </td>
          <td style="${RENV_CELL('width:220px;')}${bBot}">
            <div style="font-size:11.5px;font-weight:600;line-height:1.45;color:var(--color-text-primary)">${act}</div>
          </td>
          <td style="${RENV_CELL()}${bBot}">
            <textarea data-renv-constats="${i+1}" style="${RENV_TA}" placeholder="Décrire le constat observé…" onfocus="this.style.borderColor='rgba(200,164,74,.6)'" onblur="this.style.borderColor='rgba(255,255,255,.15)'">${lg.constats||''}</textarea>
          </td>
          <td style="${RENV_CELL('width:190px;')}${bBot}">
            ${zonesHtml}
          </td>
          <td style="padding:10px;vertical-align:top;${bBot}">
            <textarea data-renv-comments="${i+1}" style="${RENV_TA}" placeholder="Observations complémentaires…" onfocus="this.style.borderColor='rgba(200,164,74,.6)'" onblur="this.style.borderColor='rgba(255,255,255,.15)'">${lg.commentaires||''}</textarea>
          </td>
        </tr>`;
    });
}

function collectRenvLignes() {
    return RENV_ACTIVITES.map((act, i) => {
        const n = i + 1;
        const constats = document.querySelector(`[data-renv-constats="${n}"]`)?.value || '';
        const commentaires = document.querySelector(`[data-renv-comments="${n}"]`)?.value || '';
        const zones = RENV_ZONES.filter(z => document.querySelector(`[data-renv-zone="${n}|${z}"]`)?.checked);
        return { num: n, activite: act, constats, zones, commentaires };
    });
}

window.saveRenv = async () => {
    if (!renvCurrent) return;
    const date = document.getElementById('renv-date').value;
    const body = {
        equipe: document.getElementById('renv-equipe').value,
        redacteur_id: document.getElementById('renv-redacteur').value || null,
        lignes: collectRenvLignes(),
    };
    try {
        await api('/reporting-env/' + date, { method: 'PUT', body: JSON.stringify(body) });
        await loadRenvHist();
        alert('Rapport environnemental enregistré.');
    } catch(e) { alert(e.message); }
};

window.delRenv = async () => {
    if (!renvCurrent || !confirm('Supprimer ce rapport environnemental ?')) return;
    try {
        await api('/reporting-env/' + renvCurrent.id, { method: 'DELETE' });
        renvCurrent = null;
        document.getElementById('renv-form-wrap').style.display = 'none';
        document.getElementById('btn-save-renv').style.display = 'none';
        document.getElementById('btn-print-renv').style.display = 'none';
        document.getElementById('btn-del-renv').style.display = 'none';
        await loadRenvHist();
    } catch(e) { alert(e.message); }
};

async function loadRenvHist() {
    try {
        const list = await api('/reporting-env');
        const hist = document.getElementById('renv-hist');
        const cnt = document.getElementById('renv-hist-count');
        if (cnt) cnt.textContent = `${list.length} rapport(s)`;
        if (!list.length) { hist.innerHTML = '<div class="empty">Aucun rapport enregistré.</div>'; return; }
        hist.innerHTML = list.map(r => {
            // r.date est une string 'YYYY-MM-DD' grâce au parser pg côté serveur
            const dateStr = (r.date || '').slice(0, 10);
            const red = D.operators.find(o => o.id === r.redacteur_id);
            const lignesRens = (r.lignes||[]).filter(l => l.constats || (l.zones||[]).length).length;
            const updatedAt = r.updated_at || r.created_at;
            const heureMaj = updatedAt ? new Date(updatedAt).toLocaleString('fr-FR', {
                day:'2-digit', month:'2-digit', year:'numeric',
                hour:'2-digit', minute:'2-digit'
            }) : '';
            return `<div class="ev-item">
                <div class="flex-b" style="align-items:flex-start">
                    <div>
                        <div style="font-weight:700;font-size:13px;margin-bottom:3px">${fmt(dateStr)}</div>
                        <div style="font-size:11px;color:var(--color-text-secondary)">
                            Rédacteur : ${red ? red.grade+' '+red.nom+' '+red.prenom : '—'}
                            ${heureMaj ? `<span style="margin-left:10px;opacity:.6">· Màj. ${heureMaj}</span>` : ''}
                        </div>
                    </div>
                    <div class="flex" style="gap:6px;align-items:center;flex-shrink:0">
                        ${tBadge(r.equipe)}
                        <span class="badge ${lignesRens ? 'bv' : 'bi'}">${lignesRens}/5 activité(s)</span>
                        <button class="btn btn-info" style="padding:3px 10px;font-size:11px"
                            onclick="loadRenvFromHist('${dateStr}')">📂 Charger</button>
                        ${can('manage_operators') ? `<button class="btn br" style="padding:3px 8px;font-size:11px"
                            onclick="delRenvById('${r.id}','${dateStr}')">✕</button>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch(e) {}
}

window.loadRenvFromHist = (date) => {
    const dateStr = date.slice(0, 10);
    document.getElementById('renv-date').value = dateStr;
    // Scroll vers le formulaire
    document.getElementById('renv-form-wrap').scrollIntoView?.({ behavior: 'smooth' });
    loadRenv();
};

window.delRenvById = async (id, dateStr) => {
    if (!confirm(`Supprimer le rapport du ${fmt(dateStr)} ?`)) return;
    try {
        await api('/reporting-env/' + id, { method: 'DELETE' });
        // Si c'est le rapport actuellement chargé, fermer le formulaire
        if (renvCurrent && renvCurrent.id === id) {
            renvCurrent = null;
            document.getElementById('renv-form-wrap').style.display = 'none';
            document.getElementById('btn-save-renv').style.display = 'none';
            document.getElementById('btn-print-renv').style.display = 'none';
            document.getElementById('btn-del-renv').style.display = 'none';
        }
        await loadRenvHist();
    } catch(e) { alert(e.message); }
};

window.printRenv = () => {
    if (!renvCurrent) return;
    const date = document.getElementById('renv-date').value;
    const red = D.operators.find(o => o.id === renvCurrent.redacteur_id);
    const lignes = collectRenvLignes();
    const rows = lignes.map((l, i) => {
        const zonesHtml = (l.zones||[]).length
            ? (l.zones).map(z => `<span class="zone-yes">${z}</span>`).join('')
            : '<span style="color:#aaa;font-style:italic">—</span>';
        return `<tr>
            <td class="num">${i+1}</td>
            <td class="act">${l.activite}</td>
            <td style="padding:7px;border:1px solid #c8d4e0">${l.constats||'<span style="color:#aaa;font-style:italic">Néant</span>'}</td>
            <td style="padding:7px;border:1px solid #c8d4e0;text-align:center">${zonesHtml}</td>
            <td style="padding:7px;border:1px solid #c8d4e0">${l.commentaires||''}</td>
        </tr>`;
    }).join('');
    const logoEl = document.querySelector('#login-overlay img');
    const logoSrc = logoEl ? logoEl.src : '';
    const now = new Date();
    const printDate = now.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
    const printTime = now.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Reporting Env. — ${fmt(date)}</title>
    <style>
      @page { size: A4 landscape; margin: 15mm 12mm; }
      * { box-sizing: border-box; }
      body { font-family: 'Arial', sans-serif; font-size: 11px; color: #1a2a3a; margin: 0; }
      .header { display:flex; align-items:center; gap: 16px; padding-bottom: 10px; border-bottom: 3px solid #1f3052; margin-bottom: 12px; }
      .header img { width: 60px; height: 60px; }
      .header-org { flex: 1; }
      .header-org .org-main { font-size:16px; font-weight:700; color:#1f3052; letter-spacing:.5px; }
      .header-org .org-sub  { font-size:10px; color:#5a7090; letter-spacing:1px; margin-top:2px; }
      .header-doc { text-align:right; }
      .header-doc .doc-title { font-size:13px; font-weight:700; color:#1f3052; }
      .header-doc .doc-meta  { font-size:9px; color:#6a7a8a; margin-top:3px; }
      .meta-band { background:#1f3052; color:white; padding:7px 12px; border-radius:4px; margin-bottom:12px;
        display:flex; gap:24px; font-size:11px; }
      .meta-band span { opacity:.8; }
      .meta-band strong { opacity:1; }
      table { width:100%; border-collapse:collapse; }
      thead tr { background:#1f3052; color:white; }
      th { padding:8px 7px; font-size:10px; letter-spacing:.5px; text-transform:uppercase; border:1px solid #2a4060; }
      td { padding:7px; border:1px solid #c8d4e0; vertical-align:top; font-size:10.5px; }
      tr:nth-child(even) td { background:#f4f7fb; }
      .num { text-align:center; font-weight:700; color:#1f3052; font-size:13px; width:30px; }
      .act { font-weight:600; color:#1f3052; width:200px; }
      .zones { font-size:10px; }
      .zone-yes { background:#dceeff; color:#1a5fa8; border-radius:3px; padding:2px 5px; margin:2px; display:inline-block; font-weight:700; }
      .footer { margin-top:12px; padding-top:8px; border-top:1px solid #c8d4e0; display:flex; justify-content:space-between; font-size:9px; color:#8a9aaa; }
      .nb-note { margin-top:10px; font-size:9.5px; font-style:italic; color:#5a6a7a; background:#f0f4f8; padding:6px 10px; border-left:3px solid #1f3052; }
    </style></head><body>
    <div class="header">
      ${logoSrc ? `<img src="${logoSrc}" alt="JOCC">` : ''}
      <div class="header-org">
        <div class="org-main">PRÉFECTURE MARITIME — JOCC BÉNIN</div>
        <div class="org-sub">JOINT OPERATIONS COMMAND CENTER · Gestion des Quarts</div>
      </div>
      <div class="header-doc">
        <div class="doc-title">FORMULAIRE DE REPORTING JOURNALIER</div>
        <div class="doc-meta">Surveillance environnementale et maritime<br>Imprimé le ${printDate} à ${printTime}</div>
      </div>
    </div>
    <div class="meta-band">
      <div><span>Jour du : </span><strong>${fmt(date)}</strong></div>
      <div><span>Équipe de quart : </span><strong>Équipe ${renvCurrent.equipe}</strong></div>
      <div><span>Rédacteur : </span><strong>${red ? red.grade+' '+red.nom+' '+red.prenom : '—'}</strong></div>
    </div>
    <table>
      <thead><tr>
        <th style="width:30px">N°</th>
        <th style="width:200px">Activités de surveillance</th>
        <th>Constats (à décrire)</th>
        <th style="width:160px;text-align:center">Zone de constat</th>
        <th style="width:160px">Commentaires</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="nb-note"><strong>NB :</strong> Décrire les constats en précisant la nature, la période d'observation, la localisation, l'étendue.</div>
    <div class="footer">
      <span>PRÉFECTURE MARITIME — JOCC BÉNIN — Document généré automatiquement</span>
      <span>Rapport du ${fmt(date)} · Équipe ${renvCurrent.equipe}</span>
    </div>
    <script>window.print();<\/script></body></html>`);
    w.document.close();
};

function renderReportingEnv() { loadRenvHist(); }

// ── AUDIT LOGS ─────────────────────────────────────────────────────────
const ACTION_STYLE = {
  'LOGIN':        { bg:'rgba(39,174,96,.15)',  color:'#27ae60',  icon:'🔑' },
  'LOGIN_REFUSE': { bg:'rgba(231,76,60,.15)',  color:'#e74c3c',  icon:'🚫' },
  'LOGIN_ECHEC':  { bg:'rgba(231,76,60,.15)',  color:'#e74c3c',  icon:'⚠️' },
  'DELETE':       { bg:'rgba(231,76,60,.1)',   color:'#e74c3c',  icon:'🗑' },
  'POST':         { bg:'rgba(52,152,219,.1)',  color:'#3498db',  icon:'➕' },
  'PUT':          { bg:'rgba(200,164,74,.1)',  color:'rgba(200,164,74,.9)', icon:'✏️' },
  'PATCH':        { bg:'rgba(200,164,74,.08)', color:'rgba(200,164,74,.7)', icon:'🔧' },
};
function auditStyle(action) {
  for (const [k,v] of Object.entries(ACTION_STYLE)) {
    if (action.startsWith(k)) return v;
  }
  return { bg:'rgba(255,255,255,.04)', color:'var(--color-text-secondary)', icon:'📋' };
}

let _auditData = [];

async function loadAuditLogs() {
    const userId  = document.getElementById('audit-flt-user')?.value   || '';
    const action  = document.getElementById('audit-flt-action')?.value || '';
    const from    = document.getElementById('audit-flt-from')?.value   || '';
    const to      = document.getElementById('audit-flt-to')?.value     || '';
    const limit   = document.getElementById('audit-flt-limit')?.value  || 200;
    const params  = new URLSearchParams();
    if (userId) params.set('user_id', userId);
    if (action) params.set('action', action);
    if (from)   params.set('from', from);
    if (to)     params.set('to', to);
    params.set('limit', limit);
    try {
        _auditData = await api('/audit-logs?' + params.toString());
        renderAuditTable(_auditData);
    } catch(e) { console.error(e); }
}

function renderAuditTable(logs) {
    const tbody = document.getElementById('audit-body');
    const stats = document.getElementById('audit-stats');
    if (!tbody) return;
    if (stats) {
        stats.style.display = '';
        document.getElementById('audit-count').textContent   = logs.length;
        document.getElementById('audit-logins').textContent  = logs.filter(l => l.action === 'LOGIN').length;
        document.getElementById('audit-refused').textContent = logs.filter(l => l.action.includes('REFUSE') || l.action.includes('ECHEC')).length;
        document.getElementById('audit-users').textContent   = new Set(logs.filter(l => l.user_id).map(l => l.user_id)).size;
    }
    if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">Aucun log trouvé.</td></tr>';
        return;
    }
    tbody.innerHTML = logs.map(l => {
        const s = auditStyle(l.action);
        const dt = new Date(l.created_at);
        const dateStr = dt.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
        const timeStr = dt.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        const details = l.details ? l.details.replace(/</g,'&lt;').replace(/>/g,'&gt;') : '—';
        return `<tr>
            <td style="font-size:11px;white-space:nowrap"><div>${dateStr}</div><div style="opacity:.6">${timeStr}</div></td>
            <td><div style="font-weight:600;font-size:11.5px">${l.user_nom || '—'}</div><div style="font-size:10px;opacity:.6">${l.user_id || ''}</div></td>
            <td><span class="badge ${l.user_poste==='supervision'?'bsup':l.user_poste==='chef'?'bi':'bw'}" style="font-size:10px">${POSTES[l.user_poste]||l.user_poste||'—'}</span></td>
            <td><span style="display:inline-flex;align-items:center;gap:4px;background:${s.bg};color:${s.color};padding:3px 7px;border-radius:4px;font-size:10.5px;font-weight:600">
                ${s.icon} ${l.action}
            </span></td>
            <td style="font-size:10.5px;opacity:.8">${l.resource || '—'}</td>
            <td style="font-size:10.5px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${details}">${details}</td>
            <td style="font-size:10px;opacity:.6">${l.ip || '—'}</td>
        </tr>`;
    }).join('');
}

window.exportAuditCSV = () => {
    if (!_auditData.length) { alert('Aucune donnée à exporter. Lancez une recherche d\'abord.'); return; }
    const cols = ['Date','Opérateur','ID','Rôle','Action','Ressource','Détails','IP'];
    const rows = _auditData.map(l => [
        new Date(l.created_at).toLocaleString('fr-FR'),
        l.user_nom||'', l.user_id||'', POSTES[l.user_poste]||l.user_poste||'',
        l.action, l.resource||'', l.details||'', l.ip||''
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
    const csv = '\uFEFF' + cols.map(c=>`"${c}"`).join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `audit_jocc_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

window.clearAuditLogs = async () => {
    const choice = confirm('Purger TOUS les logs d\'audit ? Cette action est irréversible.');
    if (!choice) return;
    try {
        await api('/audit-logs', { method: 'DELETE', body: JSON.stringify({}) });
        _auditData = [];
        renderAuditTable([]);
        alert('Journal d\'audit purgé.');
    } catch(e) { alert(e.message); }
};

function renderAuditLogs() {
    // Populate user filter
    const sel = document.getElementById('audit-flt-user');
    if (sel && sel.options.length <= 1) {
        D.operators.sort((a,b)=>a.nom.localeCompare(b.nom)).forEach(o => {
            sel.innerHTML += `<option value="${o.id}">${o.grade} ${o.nom} ${o.prenom}</option>`;
        });
    }
    loadAuditLogs();
}

// ── INITIALISATION ET EVENT LISTENERS ─────────────────────────────────
window.doLogin = async () => {
    const id  = (document.getElementById('login-id')?.value || '').trim();
    const pwd = document.getElementById('login-pwd')?.value || '';
    if (!id || !pwd) return;
    const btn  = document.getElementById('btn-login');
    const errEl = document.getElementById('login-error');
    btn.disabled = true; btn.textContent = 'CONNEXION...';
    errEl.style.display = 'none';
    try {
        const res  = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, password: pwd }) });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        localStorage.setItem('jocc_token', json.data.token);
        window.location.reload();
    } catch(e) {
        errEl.textContent = e.message || 'Erreur de connexion';
        errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = 'CONNEXION SÉCURISÉE';
    }
};

window.doLogout = () => {
    if(!confirm('Êtes-vous sûr de vouloir vous déconnecter du terminal ?')) return;
    localStorage.removeItem('jocc_token');
    window.location.reload();
};

window.addEventListener('DOMContentLoaded', async () => {
    // ── Vérification du token JWT ────────────────────────────────
    const token = localStorage.getItem('jocc_token');
    if (!token) { document.getElementById('login-overlay').style.display='flex'; return; }
    try {
        const r = await fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } });
        const j = await r.json();
        if (!j.success) throw new Error(j.error);
        window.currentUser = j.data;
    } catch(e) {
        localStorage.removeItem('jocc_token');
        document.getElementById('login-overlay').style.display='flex';
        return;
    }

    await load();
    document.getElementById('login-overlay').style.display='none';
    const uNameLabel = document.getElementById('hdr-user-name');
    if(uNameLabel) uNameLabel.textContent = `${window.currentUser.grade} ${window.currentUser.nom}`;

    // ── Appliquer RBAC complet ─────────────────────────────────────
    applyRBAC();

    // ── Afficher le badge de rôle dans le header ──────────────────
    const roleLabel = document.getElementById('hdr-role-badge');
    if(roleLabel) { roleLabel.textContent = POSTES[window.currentUser.poste] || window.currentUser.poste; }

    showTab('dashboard');

    // ── Binding des boutons globaux ────────────────────────────────
    const binders = [
        ['btn-new-sitrep', () => openSitrepForm(true)],
        ['sitrep-cancel', () => document.getElementById('sitrep-form').style.display='none'],
        ['sitrep-cancel2', () => document.getElementById('sitrep-form').style.display='none'],
        ['sit-save', saveSitrep],
        ['btn-save-cfg', async () => {
            const cfg = { refDate: document.getElementById('cfg-date').value, refTeam: document.getElementById('cfg-team').value };
            await api('/config', { method: 'PUT', body: JSON.stringify(cfg) });
            await load(); renderCal(); renderDash();
        }],
        ['cal-prev', () => { calM--; if(calM<0){calM=11;calY--;} renderCal(); }],
        ['cal-next', () => { calM++; if(calM>11){calM=0;calY++;} renderCal(); }],
        ['cal-det-close', () => document.getElementById('cal-detail').style.display='none'],
        ['btn-new-op', () => {
            if(!can('manage_operators')) return;
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
        ['btn-new-escorte', () => openEscForm(true)],
        ['escorte-cancel', () => document.getElementById('escorte-form').style.display='none'],
        ['esc-cancel2', () => document.getElementById('escorte-form').style.display='none'],
        ['esc-save', saveEsc],
        // Reporting env
        ['btn-load-renv', loadRenv],
        ['btn-save-renv', saveRenv],
        ['btn-del-renv', delRenv],
        // Audit
        ['btn-load-audit', loadAuditLogs],
    ];

    binders.forEach(([id, fn]) => {
        const el = document.getElementById(id);
        if(el) el.onclick = fn;
    });

    // ── Masquer boutons réservés superviseurs ──────────────────────
    if(!can('manage_operators')) {
        document.getElementById('btn-new-op')?.style && (document.getElementById('btn-new-op').style.display = 'none');
    }
    if(!can('clear_notifications')) {
        document.getElementById('btn-clear-notifs')?.style && (document.getElementById('btn-clear-notifs').style.display = 'none');
    }

    // ── Filters ───────────────────────────────────────────────────
    ['sitrep-filter-eq', 'sitrep-filter-date'].forEach(id => {
        const el = document.getElementById(id); if(el) el.onchange = renderSitrep;
    });
    ['esc-flt-st', 'esc-flt-ty', 'esc-flt-dt'].forEach(id => {
        const el = document.getElementById(id); if(el) el.onchange = renderEscorte;
    });
    const opFilt = document.getElementById('filter-eq'); if(opFilt) opFilt.onchange = renderOps;

    // Pré-remplir la date du reporting env avec aujourd'hui
    const renvDateEl = document.getElementById('renv-date');
    if(renvDateEl) renvDateEl.value = tod();
    // Pré-sélectionner l'équipe du jour
    const renvEqEl = document.getElementById('renv-equipe');
    if(renvEqEl) renvEqEl.value = getTeam(tod());

    // ── Escales bindings ──────────────────────────────────────────
    document.getElementById('btn-new-escale')?.addEventListener('click', () => openEscaleForm(true));
    document.getElementById('escale-cancel')?.addEventListener('click', () => document.getElementById('escale-form').style.display='none');
    document.getElementById('escale-cancel2')?.addEventListener('click', () => document.getElementById('escale-form').style.display='none');
    document.getElementById('esc2-save')?.addEventListener('click', saveEscale);
    ['esl-flt-st','esl-flt-from','esl-flt-to'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', renderEscales);
    });

    // ── ETA WAPCO bindings ────────────────────────────────────────
    document.getElementById('btn-new-wapco')?.addEventListener('click', () => openWapcoForm(true));
    document.getElementById('wapco-cancel')?.addEventListener('click', () => document.getElementById('wapco-form').style.display='none');
    document.getElementById('wapco-cancel2')?.addEventListener('click', () => document.getElementById('wapco-form').style.display='none');
    document.getElementById('wap-save')?.addEventListener('click', saveWapco);
    ['wap-flt-st','wap-flt-from','wap-flt-to'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', renderEtaWapco);
    });
});

// ═══════════════════════════════════════════════════════════════
// ESCALES — Navires de guerre en escale
// ═══════════════════════════════════════════════════════════════

// ── Lecture fichier → base64 data URL ────────────────────────────────────
function readFileAsDataURL(file) {
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = e => res(e.target.result);
        r.onerror = rej;
        r.readAsDataURL(file);
    });
}

// Construit le HTML de preview selon le type MIME
function buildDocPreviewHTML(dataUrl, fileName) {
    const ext = (fileName || '').split('.').pop().toLowerCase();
    const isImage = ['png','jpg','jpeg','gif','bmp','webp'].includes(ext);
    const isPdf   = ext === 'pdf';
    if (isImage) {
        return `<img src="${dataUrl}" alt="${fileName}"
            style="max-width:100%;max-height:340px;display:block;object-fit:contain;padding:8px">`;
    }
    if (isPdf) {
        return `<iframe src="${dataUrl}" style="width:100%;height:420px;border:none;display:block"
            title="${fileName}"></iframe>`;
    }
    // Word / autre — pas de preview natif dans le navigateur
    const icon = ext === 'doc' || ext === 'docx' ? '📝' : '📄';
    return `<div style="display:flex;align-items:center;gap:12px;padding:16px">
        <span style="font-size:36px">${icon}</span>
        <div>
            <div style="font-weight:600;font-size:13px">${fileName}</div>
            <div style="font-size:11px;color:var(--color-text-secondary);margin-top:3px">
                Aperçu non disponible pour ce type de fichier.
            </div>
            <a href="${dataUrl}" download="${fileName}"
               style="display:inline-block;margin-top:8px;font-size:11px;color:rgba(200,164,74,.9)">
               ⬇ Télécharger pour ouvrir
            </a>
        </div>
    </div>`;
}

function showDocViewer(viewerId, previewId, dataUrl, fileName) {
    const viewer  = document.getElementById(viewerId);
    const preview = document.getElementById(previewId);
    if (!viewer) return;
    viewer.innerHTML = buildDocPreviewHTML(dataUrl, fileName);
    viewer.style.display = 'block';
    if (preview) preview.textContent = '📄 ' + fileName;
}

function hideDocViewer(viewerId, previewId) {
    const viewer = document.getElementById(viewerId);
    if (viewer) { viewer.innerHTML = ''; viewer.style.display = 'none'; }
    const preview = document.getElementById(previewId);
    if (preview) preview.textContent = '';
}

window.onEsc2DocChange = async function(input) {
    const file = input.files[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('Fichier trop volumineux (max 10 Mo).'); input.value = ''; return; }
    const data = await readFileAsDataURL(file);
    _esc2DocFD = { name: file.name, data };
    showDocViewer('esc2-doc-viewer', 'esc2-doc-preview', data, file.name);
    // Masquer le doc existant si on remplace
    document.getElementById('esc2-doc-existing').style.display = 'none';
};

window.onWapDocChange = async function(input) {
    const file = input.files[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('Fichier trop volumineux (max 10 Mo).'); input.value = ''; return; }
    const data = await readFileAsDataURL(file);
    _wapDocFD = { name: file.name, data };
    showDocViewer('wap-doc-viewer', 'wap-doc-preview', data, file.name);
    document.getElementById('wap-doc-existing').style.display = 'none';
};

// Télécharge le doc depuis le data URL stocké dans le lien
window.dlDoc = function(a, type) {
    a.preventDefault();
    const data = a.dataset.docData;
    const name = a.dataset.docNom || 'document';
    if (!data) return;
    const link = document.createElement('a');
    link.href = data; link.download = name;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
};

// Supprime le doc existant (marqué pour suppression côté form)
window.clearDoc = function(prefix) {
    if (prefix === 'esc2') {
        _esc2DocFD = { name: null, data: '__clear__' };
        document.getElementById('esc2-doc-existing').style.display = 'none';
        hideDocViewer('esc2-doc-viewer', 'esc2-doc-preview');
        document.getElementById('esc2-doc-preview').textContent = '(document supprimé)';
    } else {
        _wapDocFD = { name: null, data: '__clear__' };
        document.getElementById('wap-doc-existing').style.display = 'none';
        hideDocViewer('wap-doc-viewer', 'wap-doc-preview');
        document.getElementById('wap-doc-preview').textContent = '(document supprimé)';
    }
};

const ESC2_TYPE_L = {
    fregate:'Frégate', patrouilleur:'Patrouilleur', corvette:'Corvette',
    sous_marin:'Sous-marin', porte_helicopteres:'Porte-hélicoptères',
    aviso:'Aviso', batiment_soutien:'Bât. de soutien', autre:'Autre'
};
const ESC2_MOTIF_L = {
    visite_protocolaire:'Visite protocolaire', ravitaillement:'Ravitaillement',
    maintenance:'Maintenance', exercice:'Exercice conjoint',
    transit:'Transit', humanitaire:'Humanitaire', autre:'Autre'
};
const ESC2_STATUT_C = { attendu:'bw', a_quai:'bv', appareille:'bi', annule:'br' };
const ESC2_STATUT_L = { attendu:'Attendu', a_quai:'À quai', appareille:'Appareillé', annule:'Annulé' };

function openEscaleForm(isNew, data) {
    _esc2DocFD = null;
    document.getElementById('esc2-doc-file').value = '';
    hideDocViewer('esc2-doc-viewer', 'esc2-doc-preview');
    document.getElementById('escale-form').style.display = 'block';
    document.getElementById('escale-form-title').textContent = isNew ? 'Nouvelle escale' : 'Modifier l\'escale';
    document.getElementById('esc2-edit-id').value = isNew ? '' : data.id;
    document.getElementById('esc2-num').value = isNew ? '' : (data.num_escale||'');
    document.getElementById('esc2-nom').value = isNew ? '' : (data.nom_batiment||'');
    document.getElementById('esc2-type').value = isNew ? 'fregate' : (data.type_batiment||'autre');
    document.getElementById('esc2-nationalite').value = isNew ? '' : (data.nationalite||'');
    document.getElementById('esc2-pavillon').value = isNew ? '' : (data.pavillon||'');
    document.getElementById('esc2-commandant').value = isNew ? '' : (data.commandant||'');
    document.getElementById('esc2-equipage').value = isNew ? '' : (data.equipage||'');
    document.getElementById('esc2-longueur').value = isNew ? '' : (data.longueur||'');
    document.getElementById('esc2-tirant').value = isNew ? '' : (data.tirant_eau||'');
    document.getElementById('esc2-poste').value = isNew ? '' : (data.poste_amarrage||'');
    document.getElementById('esc2-eta').value = isNew ? '' : (data.eta ? data.eta.slice(0,16) : '');
    document.getElementById('esc2-eta-reelle').value = isNew ? '' : (data.eta_reelle ? data.eta_reelle.slice(0,16) : '');
    document.getElementById('esc2-etd').value = isNew ? '' : (data.etd ? data.etd.slice(0,16) : '');
    document.getElementById('esc2-etd-reelle').value = isNew ? '' : (data.etd_reelle ? data.etd_reelle.slice(0,16) : '');
    document.getElementById('esc2-motif').value = isNew ? 'visite_protocolaire' : (data.motif||'visite_protocolaire');
    document.getElementById('esc2-statut').value = isNew ? 'attendu' : (data.statut||'attendu');
    document.getElementById('esc2-observations').value = isNew ? '' : (data.observations||'');
    // Document existant — preview + lien téléchargement
    const existingDiv  = document.getElementById('esc2-doc-existing');
    const existingLink = document.getElementById('esc2-doc-link');
    hideDocViewer('esc2-doc-viewer', 'esc2-doc-preview');
    if (!isNew && data.doc_autorisation_data && data.doc_autorisation_nom) {
        existingLink.dataset.docData = data.doc_autorisation_data;
        existingLink.dataset.docNom  = data.doc_autorisation_nom;
        existingLink.textContent = '⬇ ' + data.doc_autorisation_nom;
        existingDiv.style.display = 'block';
        showDocViewer('esc2-doc-viewer', 'esc2-doc-preview', data.doc_autorisation_data, data.doc_autorisation_nom);
    } else {
        existingDiv.style.display = 'none';
    }
    document.getElementById('escale-form').scrollIntoView({ behavior:'smooth' });
}

async function saveEscale() {
    const id = document.getElementById('esc2-edit-id').value;
    const nom = document.getElementById('esc2-nom').value.trim();
    if (!nom) { alert('Le nom du bâtiment est requis.'); return; }
    const payload = {
        num_escale: document.getElementById('esc2-num').value.trim(),
        nom_batiment: nom,
        type_batiment: document.getElementById('esc2-type').value,
        nationalite: document.getElementById('esc2-nationalite').value.trim(),
        pavillon: document.getElementById('esc2-pavillon').value.trim(),
        commandant: document.getElementById('esc2-commandant').value.trim(),
        equipage: document.getElementById('esc2-equipage').value || null,
        longueur: document.getElementById('esc2-longueur').value || null,
        tirant_eau: document.getElementById('esc2-tirant').value || null,
        poste_amarrage: document.getElementById('esc2-poste').value.trim(),
        eta: document.getElementById('esc2-eta').value || null,
        eta_reelle: document.getElementById('esc2-eta-reelle').value || null,
        etd: document.getElementById('esc2-etd').value || null,
        etd_reelle: document.getElementById('esc2-etd-reelle').value || null,
        motif: document.getElementById('esc2-motif').value,
        statut: document.getElementById('esc2-statut').value,
        observations: document.getElementById('esc2-observations').value.trim(),
        equipe_id: getTeam(tod()),
        doc_autorisation_data: _esc2DocFD ? (_esc2DocFD.data === '__clear__' ? null : _esc2DocFD.data) : undefined,
        doc_autorisation_nom:  _esc2DocFD ? (_esc2DocFD.data === '__clear__' ? null : _esc2DocFD.name) : undefined,
    };
    try {
        const result = id
            ? await api('/escales/' + id, { method: 'PUT', body: JSON.stringify(payload) })
            : await api('/escales', { method: 'POST', body: JSON.stringify(payload) });
        if (id) {
            const idx = D.escales.findIndex(e => e.id === id);
            if (idx !== -1) D.escales[idx] = result; else D.escales.unshift(result);
        } else {
            D.escales.unshift(result);
        }
        document.getElementById('escale-form').style.display = 'none';
        renderEscales();
    } catch(e) { alert('Erreur : ' + e.message); }
}

function fmtDt(val) {
    if (!val) return '—';
    const d = new Date(val);
    return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' })
        + ' ' + d.toTimeString().slice(0,5);
}

function etaDelay(eta, etaReelle) {
    if (!eta || !etaReelle) return '';
    const diff = Math.round((new Date(etaReelle) - new Date(eta)) / 60000);
    if (diff === 0) return '<span style="color:#27ae60;font-size:10px">À l\'heure</span>';
    const sign = diff > 0 ? '+' : '';
    const col = diff > 0 ? '#ef4444' : '#27ae60';
    const abs = Math.abs(diff);
    const label = abs >= 60 ? `${Math.floor(abs/60)}h${abs%60?String(abs%60).padStart(2,'0')+'min':''}` : abs+'min';
    return `<span style="color:${col};font-size:10px">${sign}${label}</span>`;
}

function renderEscales() {
    const fltSt   = document.getElementById('esl-flt-st')?.value   || '';
    const fltFrom = document.getElementById('esl-flt-from')?.value || '';
    const fltTo   = document.getElementById('esl-flt-to')?.value   || '';

    let rows = D.escales.filter(e => {
        if (fltSt && e.statut !== fltSt) return false;
        if (fltFrom && e.eta && e.eta < fltFrom) return false;
        if (fltTo   && e.eta && e.eta.slice(0,10) > fltTo) return false;
        return true;
    });

    // Stats
    document.getElementById('esl-total').textContent    = D.escales.length;
    document.getElementById('esl-attendu').textContent  = D.escales.filter(e=>e.statut==='attendu').length;
    document.getElementById('esl-aquai').textContent    = D.escales.filter(e=>e.statut==='a_quai').length;
    document.getElementById('esl-appareille').textContent = D.escales.filter(e=>e.statut==='appareille').length;
    document.getElementById('esl-count-lbl').textContent = `${rows.length} escale(s)`;

    const el = document.getElementById('escale-list');
    if (!rows.length) {
        el.innerHTML = '<div class="empty">Aucune escale enregistrée.</div>';
        return;
    }

    let html = '<div class="tw"><table><thead><tr>'
        + '<th>N° Escale</th><th>Bâtiment</th><th>Type</th><th>Nationalité</th>'
        + '<th>ETA prévue</th><th>ETA réelle</th><th>ETD prévue</th>'
        + '<th>Poste</th><th>Motif</th><th>Statut</th><th>Actions</th>'
        + '</tr></thead><tbody>';

    rows.forEach(e => {
        const delay = etaDelay(e.eta, e.eta_reelle);
        const escDocBtn = e.doc_autorisation_data
            ? `<br><a href="#" data-doc-data="${encodeURIComponent(e.doc_autorisation_data)}" data-doc-nom="${e.doc_autorisation_nom||'document'}" onclick="dlDocInline(event,this)" style="font-size:10px;color:rgba(200,164,74,.8)">📎 ${e.doc_autorisation_nom||'Document'}</a>`
            : '';
        html += `<tr>
            <td style="font-family:monospace;font-size:11px">${e.num_escale}</td>
            <td><strong>${e.nom_batiment}</strong>${escDocBtn}</td>
            <td>${ESC2_TYPE_L[e.type_batiment]||e.type_batiment}</td>
            <td>${e.nationalite||'—'} ${e.pavillon ? `<span style="font-size:10px;color:var(--color-text-secondary)">(${e.pavillon})</span>` : ''}</td>
            <td style="font-size:11px">${fmtDt(e.eta)}</td>
            <td style="font-size:11px">${fmtDt(e.eta_reelle)} ${delay}</td>
            <td style="font-size:11px">${fmtDt(e.etd)}</td>
            <td style="font-size:11px">${e.poste_amarrage||'—'}</td>
            <td style="font-size:11px">${ESC2_MOTIF_L[e.motif]||e.motif}</td>
            <td><span class="badge ${ESC2_STATUT_C[e.statut]||'bi'}">${ESC2_STATUT_L[e.statut]||e.statut}</span></td>
            <td>
                <div class="flex" style="gap:4px">
                    <select style="font-size:11px;padding:2px 4px" onchange="patchEscaleStatut('${e.id}',this.value);this.value=''" title="Changer le statut">
                        <option value="">Statut…</option>
                        <option value="attendu">Attendu</option>
                        <option value="a_quai">À quai</option>
                        <option value="appareille">Appareillé</option>
                        <option value="annule">Annulé</option>
                    </select>
                    <button class="btn" style="padding:3px 8px;font-size:11px" onclick='openEscaleForm(false,${JSON.stringify(e)})'>✎</button>
                    <button class="btn br" style="padding:3px 8px;font-size:11px" onclick="delEscale('${e.id}')">✕</button>
                </div>
            </td>
        </tr>`;
        if (e.observations) {
            html += `<tr><td colspan="11" style="font-size:11px;color:var(--color-text-secondary);padding:4px 12px;font-style:italic">
                📝 ${e.observations}</td></tr>`;
        }
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
}

async function patchEscaleStatut(id, statut) {
    try {
        const r = await api('/escales/' + id + '/statut', { method: 'PATCH', body: JSON.stringify({ statut }) });
        const idx = D.escales.findIndex(e => e.id === id);
        if (idx !== -1) D.escales[idx] = r;
        renderEscales();
    } catch(e) { alert('Erreur : ' + e.message); }
}

async function delEscale(id) {
    if (!confirm('Supprimer cette escale ?')) return;
    try {
        await api('/escales/' + id, { method: 'DELETE' });
        D.escales = D.escales.filter(e => e.id !== id);
        renderEscales();
    } catch(e) { alert('Erreur : ' + e.message); }
}

window.openEscaleForm = openEscaleForm;
window.patchEscaleStatut = patchEscaleStatut;
window.delEscale = delEscale;

// ═══════════════════════════════════════════════════════════════
// ETA WAPCO — Navires commerciaux
// ═══════════════════════════════════════════════════════════════

const WAP_TYPE_L = {
    cargo:'Cargo général', porte_conteneurs:'Porte-conteneurs', vraquier:'Vraquier',
    petrolier:'Pétrolier', roro:'Roro', ferry:'Ferry/Passagers',
    chimiqueur:'Chimiqueur', autre:'Autre'
};
const WAP_STATUT_C = {
    planifie:'bw', en_route:'bi', au_port:'bv',
    en_dechargement:'bg', appareille:'', annule:'br'
};
const WAP_STATUT_L = {
    planifie:'Planifié', en_route:'En route', au_port:'Au port',
    en_dechargement:'En déchargement', appareille:'Appareillé', annule:'Annulé'
};

function openWapcoForm(isNew, data) {
    _wapDocFD = null;
    document.getElementById('wap-doc-file').value = '';
    hideDocViewer('wap-doc-viewer', 'wap-doc-preview');
    document.getElementById('wapco-form').style.display = 'block';
    document.getElementById('wapco-form-title').textContent = isNew ? 'Nouvel ETA WAPCO' : 'Modifier l\'ETA';
    document.getElementById('wap-edit-id').value = isNew ? '' : data.id;
    document.getElementById('wap-num').value = isNew ? '' : (data.num_voyage||'');
    document.getElementById('wap-nom').value = isNew ? '' : (data.nom_navire||'');
    document.getElementById('wap-mmsi').value = isNew ? '' : (data.mmsi||'');
    document.getElementById('wap-imo').value = isNew ? '' : (data.imo||'');
    document.getElementById('wap-type').value = isNew ? 'cargo' : (data.type_navire||'cargo');
    document.getElementById('wap-pavillon').value = isNew ? '' : (data.pavillon||'');
    document.getElementById('wap-commandant').value = isNew ? '' : (data.commandant||'');
    document.getElementById('wap-origine').value = isNew ? '' : (data.port_origine||'');
    document.getElementById('wap-cargaison').value = isNew ? '' : (data.cargaison||'');
    document.getElementById('wap-quantite').value = isNew ? '' : (data.quantite||'');
    document.getElementById('wap-eta').value = isNew ? '' : (data.eta ? data.eta.slice(0,16) : '');
    document.getElementById('wap-eta-reelle').value = isNew ? '' : (data.eta_reelle ? data.eta_reelle.slice(0,16) : '');
    document.getElementById('wap-etd').value = isNew ? '' : (data.etd ? data.etd.slice(0,16) : '');
    document.getElementById('wap-poste').value = isNew ? '' : (data.poste||'');
    document.getElementById('wap-escorte-req').checked = isNew ? false : !!data.escorte_requise;
    document.getElementById('wap-vhf').value = isNew ? '' : (data.vhf||'');
    document.getElementById('wap-agent').value = isNew ? '' : (data.agent_consignataire||'');
    document.getElementById('wap-statut').value = isNew ? 'planifie' : (data.statut||'planifie');
    document.getElementById('wap-observations').value = isNew ? '' : (data.observations||'');
    // Document existant — preview + lien téléchargement
    const wapExistingDiv  = document.getElementById('wap-doc-existing');
    const wapExistingLink = document.getElementById('wap-doc-link');
    hideDocViewer('wap-doc-viewer', 'wap-doc-preview');
    if (!isNew && data.doc_autorisation_data && data.doc_autorisation_nom) {
        wapExistingLink.dataset.docData = data.doc_autorisation_data;
        wapExistingLink.dataset.docNom  = data.doc_autorisation_nom;
        wapExistingLink.textContent = '⬇ ' + data.doc_autorisation_nom;
        wapExistingDiv.style.display = 'block';
        showDocViewer('wap-doc-viewer', 'wap-doc-preview', data.doc_autorisation_data, data.doc_autorisation_nom);
    } else {
        wapExistingDiv.style.display = 'none';
    }
    document.getElementById('wapco-form').scrollIntoView({ behavior:'smooth' });
}

async function saveWapco() {
    const id = document.getElementById('wap-edit-id').value;
    const nom = document.getElementById('wap-nom').value.trim();
    if (!nom) { alert('Le nom du navire est requis.'); return; }
    const payload = {
        num_voyage: document.getElementById('wap-num').value.trim(),
        nom_navire: nom,
        mmsi: document.getElementById('wap-mmsi').value.trim(),
        imo: document.getElementById('wap-imo').value.trim(),
        type_navire: document.getElementById('wap-type').value,
        pavillon: document.getElementById('wap-pavillon').value.trim(),
        commandant: document.getElementById('wap-commandant').value.trim(),
        port_origine: document.getElementById('wap-origine').value.trim(),
        cargaison: document.getElementById('wap-cargaison').value.trim(),
        quantite: document.getElementById('wap-quantite').value || null,
        eta: document.getElementById('wap-eta').value || null,
        eta_reelle: document.getElementById('wap-eta-reelle').value || null,
        etd: document.getElementById('wap-etd').value || null,
        poste: document.getElementById('wap-poste').value.trim(),
        escorte_requise: document.getElementById('wap-escorte-req').checked,
        vhf: document.getElementById('wap-vhf').value.trim(),
        agent_consignataire: document.getElementById('wap-agent').value.trim(),
        statut: document.getElementById('wap-statut').value,
        observations: document.getElementById('wap-observations').value.trim(),
        equipe_id: getTeam(tod()),
        doc_autorisation_data: _wapDocFD ? (_wapDocFD.data === '__clear__' ? null : _wapDocFD.data) : undefined,
        doc_autorisation_nom:  _wapDocFD ? (_wapDocFD.data === '__clear__' ? null : _wapDocFD.name) : undefined,
    };
    try {
        const result = id
            ? await api('/eta-wapco/' + id, { method: 'PUT', body: JSON.stringify(payload) })
            : await api('/eta-wapco', { method: 'POST', body: JSON.stringify(payload) });
        if (id) {
            const idx = D.etaWapco.findIndex(w => w.id === id);
            if (idx !== -1) D.etaWapco[idx] = result; else D.etaWapco.unshift(result);
        } else {
            D.etaWapco.push(result);
        }
        document.getElementById('wapco-form').style.display = 'none';
        renderEtaWapco();
    } catch(e) { alert('Erreur : ' + e.message); }
}

function renderEtaWapco() {
    const fltSt   = document.getElementById('wap-flt-st')?.value   || '';
    const fltFrom = document.getElementById('wap-flt-from')?.value || '';
    const fltTo   = document.getElementById('wap-flt-to')?.value   || '';

    let rows = D.etaWapco.filter(w => {
        if (fltSt && w.statut !== fltSt) return false;
        if (fltFrom && w.eta && w.eta < fltFrom) return false;
        if (fltTo   && w.eta && w.eta.slice(0,10) > fltTo) return false;
        return true;
    });

    // Stats
    document.getElementById('wap-total').textContent    = D.etaWapco.length;
    document.getElementById('wap-plan').textContent     = D.etaWapco.filter(w=>w.statut==='planifie').length;
    document.getElementById('wap-enroute').textContent  = D.etaWapco.filter(w=>w.statut==='en_route').length;
    document.getElementById('wap-port').textContent     = D.etaWapco.filter(w=>w.statut==='au_port').length;
    document.getElementById('wap-dech').textContent     = D.etaWapco.filter(w=>w.statut==='en_dechargement').length;
    document.getElementById('wap-esc-req').textContent  = D.etaWapco.filter(w=>w.escorte_requise).length;
    document.getElementById('wap-count-lbl').textContent = `${rows.length} ETA(s)`;

    const el = document.getElementById('wapco-list');
    if (!rows.length) {
        el.innerHTML = '<div class="empty">Aucun ETA WAPCO enregistré.</div>';
        return;
    }

    let html = '<div class="tw"><table><thead><tr>'
        + '<th>N° Voyage</th><th>Navire</th><th>Type</th><th>Origine</th>'
        + '<th>ETA prévue</th><th>ETA réelle</th><th>ETD</th>'
        + '<th>Poste</th><th>Cargaison</th><th>Escorte</th><th>Statut</th><th>Actions</th>'
        + '</tr></thead><tbody>';

    rows.forEach(w => {
        const delay = etaDelay(w.eta, w.eta_reelle);
        const escBadge = w.escorte_requise
            ? `<span class="badge br" style="font-size:10px">Requise</span>`
            : `<span style="font-size:10px;color:var(--color-text-secondary)">Non</span>`;
        const wapDocBtn = w.doc_autorisation_data
            ? `<br><a href="#" data-doc-data="${encodeURIComponent(w.doc_autorisation_data)}" data-doc-nom="${w.doc_autorisation_nom||'document'}" onclick="dlDocInline(event,this)" style="font-size:10px;color:rgba(200,164,74,.8)">📎 ${w.doc_autorisation_nom||'Document'}</a>`
            : '';
        html += `<tr>
            <td style="font-family:monospace;font-size:11px">${w.num_voyage}</td>
            <td>
                <strong>${w.nom_navire}</strong>${wapDocBtn}<br>
                <span style="font-size:10px;color:var(--color-text-secondary)">${w.mmsi ? 'MMSI: '+w.mmsi : ''} ${w.imo ? '· IMO: '+w.imo : ''}</span>
            </td>
            <td style="font-size:11px">${WAP_TYPE_L[w.type_navire]||w.type_navire}</td>
            <td style="font-size:11px">${w.port_origine||'—'}</td>
            <td style="font-size:11px">${fmtDt(w.eta)}</td>
            <td style="font-size:11px">${fmtDt(w.eta_reelle)} ${delay}</td>
            <td style="font-size:11px">${fmtDt(w.etd)}</td>
            <td style="font-size:11px">${w.poste||'—'}</td>
            <td style="font-size:11px">${w.cargaison||'—'} ${w.quantite ? `<span style="color:var(--color-text-secondary)">(${Number(w.quantite).toLocaleString('fr-FR')} t)</span>` : ''}</td>
            <td>${escBadge}</td>
            <td><span class="badge ${WAP_STATUT_C[w.statut]||'bi'}">${WAP_STATUT_L[w.statut]||w.statut}</span></td>
            <td>
                <div class="flex" style="gap:4px">
                    <select style="font-size:11px;padding:2px 4px" onchange="patchWapcoStatut('${w.id}',this.value);this.value=''" title="Changer le statut">
                        <option value="">Statut…</option>
                        <option value="planifie">Planifié</option>
                        <option value="en_route">En route</option>
                        <option value="au_port">Au port</option>
                        <option value="en_dechargement">En déchargement</option>
                        <option value="appareille">Appareillé</option>
                        <option value="annule">Annulé</option>
                    </select>
                    <button class="btn" style="padding:3px 8px;font-size:11px" onclick='openWapcoForm(false,${JSON.stringify(w)})'>✎</button>
                    <button class="btn br" style="padding:3px 8px;font-size:11px" onclick="delWapco('${w.id}')">✕</button>
                </div>
            </td>
        </tr>`;
        if (w.observations) {
            html += `<tr><td colspan="12" style="font-size:11px;color:var(--color-text-secondary);padding:4px 12px;font-style:italic">
                📝 ${w.observations}</td></tr>`;
        }
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
}

async function patchWapcoStatut(id, statut) {
    try {
        const r = await api('/eta-wapco/' + id + '/statut', { method: 'PATCH', body: JSON.stringify({ statut }) });
        const idx = D.etaWapco.findIndex(w => w.id === id);
        if (idx !== -1) D.etaWapco[idx] = r;
        renderEtaWapco();
    } catch(e) { alert('Erreur : ' + e.message); }
}

async function delWapco(id) {
    if (!confirm('Supprimer cet ETA WAPCO ?')) return;
    try {
        await api('/eta-wapco/' + id, { method: 'DELETE' });
        D.etaWapco = D.etaWapco.filter(w => w.id !== id);
        renderEtaWapco();
    } catch(e) { alert('Erreur : ' + e.message); }
}

window.openWapcoForm = openWapcoForm;
window.patchWapcoStatut = patchWapcoStatut;
window.delWapco = delWapco;

// Téléchargement depuis le tableau (data encodée dans l'attribut HTML)
window.dlDocInline = function(e, a) {
    e.preventDefault();
    const data = decodeURIComponent(a.dataset.docData);
    const name = a.dataset.docNom || 'document';
    const link = document.createElement('a');
    link.href = data; link.download = name;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
};


// ═══════════════════════════════════════════════════════════════
// GENERIC IO DROPDOWN TOGGLE
// ═══════════════════════════════════════════════════════════════

window.toggleDropdown = function(id) {
    const all = document.querySelectorAll('.io-dropdown');
    all.forEach(d => { if (d.id !== id) d.style.display = 'none'; });
    const dd = document.getElementById(id);
    if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
};

document.addEventListener('click', e => {
    if (!e.target.closest('[onclick*="toggleDropdown"]')) {
        document.querySelectorAll('.io-dropdown').forEach(d => d.style.display = 'none');
    }
});

// ═══════════════════════════════════════════════════════════════
// MODULE CONFIG (columns, API, labels)
// ═══════════════════════════════════════════════════════════════

const MODULE_CFG = {
    sitrep: {
        label: 'SITREPs',
        apiGet: '/sitreps',
        apiPost: '/sitreps',
        dataKey: 'sitreps',
        renderFn: () => renderSitrep(),
        statutOptions: [],
        sortFields: { date: 'date', nom: 'num', statut: 'equipe', equipe: 'equipe' },
        csvCols: ['id','num','date','heure','equipe','speed','course','lat','lon','azm_pac','dist_pac','dist_cote','azm_spm','dist_spm','comment'],
        csvLabels: ['ID','N°','Date','Heure','Équipe','Speed','Course','Lat','Lon','AZM/PAC','Dist/PAC','Dist/Côte','AZM/SPM','Dist/SPM','Commentaire'],
        pdfTitle: 'SITREP — Situation Reports',
        pdfCols: ['num','date','heure','equipe','speed','course','lat','lon','comment'],
        pdfLabels: ['N°','Date','Heure','Éq.','Speed','Course','Lat','Lon','Commentaire'],
        buildRow: r => ({
            num_escale: undefined,
            num: r.num, date: r.date, heure: r.heure||'', equipe: r.equipe,
            speed: r.speed, course: r.course, lat: r.lat, lon: r.lon,
            comment: r.comment
        }),
    },
    escorte: {
        label: 'Missions d\'Escorte',
        apiGet: '/escortes',
        apiPost: '/escortes',
        dataKey: 'escortes',
        renderFn: () => renderEscorte(),
        statutOptions: ['planifiee','encours','terminee','annulee'],
        statutLabels: { planifiee:'Planifiée', encours:'En cours', terminee:'Terminée', annulee:'Annulée' },
        sortFields: { date: 'date', nom: 'cible_nom', statut: 'statut', equipe: 'equipe' },
        csvCols: ['id','num','date','heure','type','equipe','zone','cible_nom','cible_mmsi','cible_imo','cible_pavillon','cible_type','statut','comment'],
        csvLabels: ['ID','N° Mission','Date','Heure','Type','Équipe','Zone','Navire cible','MMSI','IMO','Pavillon','Type navire','Statut','Commentaire'],
        pdfTitle: 'Missions d\'Escorte — Marine Nationale',
        pdfCols: ['num','date','heure','type','equipe','cible_nom','cible_mmsi','zone','statut'],
        pdfLabels: ['N°','Date','Heure','Type','Éq.','Navire','MMSI','Zone','Statut'],
        buildRow: r => r,
    },
    escales: {
        label: 'Navires de guerre en escale',
        apiGet: '/escales',
        apiPost: '/escales',
        dataKey: 'escales',
        renderFn: () => renderEscales(),
        statutOptions: ['attendu','a_quai','appareille','annule'],
        statutLabels: ESC2_STATUT_L,
        sortFields: { date: 'eta', nom: 'nom_batiment', statut: 'statut', equipe: 'equipe_id' },
        csvCols: ['id','num_escale','nom_batiment','type_batiment','nationalite','pavillon','commandant','equipage','longueur','tirant_eau','poste_amarrage','eta','eta_reelle','etd','etd_reelle','motif','statut','observations'],
        csvLabels: ['ID','N° Escale','Bâtiment','Type','Nationalité','Pavillon','Commandant','Équipage','Longueur (m)','Tirant d\'eau (m)','Poste','ETA prévue','ETA réelle','ETD prévue','ETD réelle','Motif','Statut','Observations'],
        pdfTitle: 'Navires de guerre en escale',
        pdfCols: ['num_escale','nom_batiment','type_batiment','nationalite','eta','etd','poste_amarrage','motif','statut'],
        pdfLabels: ['N° Escale','Bâtiment','Type','Nationalité','ETA','ETD','Poste','Motif','Statut'],
        buildRow: r => r,
        mapImport: row => ({
            num_escale: row['N° Escale']||row['num_escale']||'',
            nom_batiment: row['Bâtiment']||row['nom_batiment']||'',
            type_batiment: row['Type']||row['type_batiment']||'autre',
            nationalite: row['Nationalité']||row['nationalite']||'',
            pavillon: row['Pavillon']||row['pavillon']||'',
            commandant: row['Commandant']||row['commandant']||'',
            equipage: row['Équipage']||row['equipage']||null,
            longueur: row['Longueur (m)']||row['longueur']||null,
            tirant_eau: row['Tirant d\'eau (m)']||row['tirant_eau']||null,
            poste_amarrage: row['Poste']||row['poste_amarrage']||'',
            eta: row['ETA prévue']||row['eta']||null,
            etd: row['ETD prévue']||row['etd']||null,
            motif: row['Motif']||row['motif']||'visite_protocolaire',
            statut: row['Statut']||row['statut']||'attendu',
            observations: row['Observations']||row['observations']||'',
        }),
    },
    wapco: {
        label: 'ETA WAPCO',
        apiGet: '/eta-wapco',
        apiPost: '/eta-wapco',
        dataKey: 'etaWapco',
        renderFn: () => renderEtaWapco(),
        statutOptions: ['planifie','en_route','au_port','en_dechargement','appareille','annule'],
        statutLabels: WAP_STATUT_L,
        sortFields: { date: 'eta', nom: 'nom_navire', statut: 'statut', equipe: 'equipe_id' },
        csvCols: ['id','num_voyage','nom_navire','mmsi','imo','type_navire','pavillon','commandant','port_origine','cargaison','quantite','eta','eta_reelle','etd','poste','escorte_requise','vhf','agent_consignataire','statut','observations'],
        csvLabels: ['ID','N° Voyage','Navire','MMSI','IMO','Type','Pavillon','Commandant','Port d\'origine','Cargaison','Quantité (t)','ETA prévue','ETA réelle','ETD','Poste','Escorte req.','VHF','Agent','Statut','Observations'],
        pdfTitle: 'ETA WAPCO — Navires commerciaux',
        pdfCols: ['num_voyage','nom_navire','type_navire','port_origine','eta','etd','poste','cargaison','statut'],
        pdfLabels: ['N° Voyage','Navire','Type','Origine','ETA','ETD','Poste','Cargaison','Statut'],
        buildRow: r => r,
        mapImport: row => ({
            num_voyage: row['N° Voyage']||row['num_voyage']||'',
            nom_navire: row['Navire']||row['nom_navire']||'',
            mmsi: row['MMSI']||row['mmsi']||'',
            imo: row['IMO']||row['imo']||'',
            type_navire: row['Type']||row['type_navire']||'cargo',
            pavillon: row['Pavillon']||row['pavillon']||'',
            commandant: row['Commandant']||row['commandant']||'',
            port_origine: row['Port d\'origine']||row['port_origine']||'',
            cargaison: row['Cargaison']||row['cargaison']||'',
            quantite: row['Quantité (t)']||row['quantite']||null,
            eta: row['ETA prévue']||row['eta']||null,
            etd: row['ETD']||row['etd']||null,
            poste: row['Poste']||row['poste']||'',
            escorte_requise: (row['Escorte req.']||row['escorte_requise']||'').toString().toLowerCase() === 'true',
            vhf: row['VHF']||row['vhf']||'',
            agent_consignataire: row['Agent']||row['agent_consignataire']||'',
            statut: row['Statut']||row['statut']||'planifie',
            observations: row['Observations']||row['observations']||'',
        }),
    },
};

// ═══════════════════════════════════════════════════════════════
// CSV EXPORT
// ═══════════════════════════════════════════════════════════════

window.exportModuleCSV = function(module) {
    const cfg = MODULE_CFG[module];
    if (!cfg) return;
    const data = D[cfg.dataKey] || [];
    if (!data.length) { alert('Aucune donnée à exporter.'); return; }
    const cols = cfg.csvCols;
    const labels = cfg.csvLabels;
    const rows = data.map(r => cols.map(c => {
        const v = r[c];
        if (v === null || v === undefined) return '""';
        return `"${String(v).replace(/"/g,'""')}"`;
    }).join(','));
    const csv = '\uFEFF' + labels.map(l => `"${l}"`).join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `jocc_${module}_${tod()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    document.querySelectorAll('.io-dropdown').forEach(d => d.style.display = 'none');
};

// ═══════════════════════════════════════════════════════════════
// EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

window.exportModuleXLSX = async function(module) {
    const cfg = MODULE_CFG[module];
    if (!cfg) return;
    const data = D[cfg.dataKey] || [];
    if (!data.length) { alert('Aucune donnée à exporter.'); return; }
    document.querySelectorAll('.io-dropdown').forEach(d => d.style.display = 'none');

    try {
        await ensureXLSX();
        const XLSX = window.XLSX;

        // Construire les lignes avec en-têtes FR
        const cols   = cfg.csvCols;
        const labels = cfg.csvLabels;
        const rows = data.map(r => {
            const obj = {};
            cols.forEach((c, i) => {
                let v = r[c];
                if (v === null || v === undefined) v = '';
                // Exclure les blobs base64 (doc_autorisation_data)
                if (c === 'doc_autorisation_data') v = v ? '(document joint)' : '';
                obj[labels[i]] = v;
            });
            return obj;
        });

        const ws = XLSX.utils.json_to_sheet(rows, { header: labels });

        // Largeur de colonnes automatique (max 40)
        const colWidths = labels.map((lbl, i) => {
            const maxLen = Math.max(
                lbl.length,
                ...data.map(r => {
                    const c = cols[i];
                    const v = c === 'doc_autorisation_data' ? '' : String(r[c] ?? '');
                    return v.length;
                })
            );
            return { wch: Math.min(maxLen + 2, 40) };
        });
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, cfg.label.slice(0, 31));

        // Feuille méta
        const meta = XLSX.utils.aoa_to_sheet([
            ['Préfecture Maritime du Bénin — JOCC'],
            ['Module', cfg.label],
            ['Exporté le', new Date().toLocaleString('fr-FR')],
            ['Nombre de lignes', data.length],
        ]);
        XLSX.utils.book_append_sheet(wb, meta, 'Informations');

        XLSX.writeFile(wb, `jocc_${module}_${tod()}.xlsx`);
    } catch(e) { alert('Erreur export Excel : ' + e.message); }
};

// ═══════════════════════════════════════════════════════════════
// CSV IMPORT
// ═══════════════════════════════════════════════════════════════

function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g,'').trim());
    return lines.slice(1).map(line => {
        const values = []; let cur = ''; let inQ = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') { inQ = !inQ; }
            else if (line[i] === ',' && !inQ) { values.push(cur.replace(/^"|"$/g,'')); cur = ''; }
            else { cur += line[i]; }
        }
        values.push(cur.replace(/^"|"$/g,''));
        const obj = {};
        headers.forEach((h, i) => obj[h] = values[i] || '');
        return obj;
    });
}

window.importModuleCSV = async function(input, module) {
    const file = input.files[0]; if (!file) return;
    document.querySelectorAll('.io-dropdown').forEach(d => d.style.display = 'none');
    const text = await file.text();
    const rows = parseCSV(text);
    await _doImport(module, rows);
    input.value = '';
};

// ═══════════════════════════════════════════════════════════════
// EXCEL IMPORT (via SheetJS from CDN — lazy loaded)
// ═══════════════════════════════════════════════════════════════

async function ensureXLSX() {
    if (window.XLSX) return;
    await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
    });
}

window.importModuleXLSX = async function(input, module) {
    const file = input.files[0]; if (!file) return;
    document.querySelectorAll('.io-dropdown').forEach(d => d.style.display = 'none');
    try {
        await ensureXLSX();
        const buf = await file.arrayBuffer();
        const wb = window.XLSX.read(buf, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(ws, { defval: '' });
        await _doImport(module, rows);
    } catch(e) { alert('Erreur lecture fichier : ' + e.message); }
    input.value = '';
};

async function _doImport(module, rows) {
    const cfg = MODULE_CFG[module];
    if (!cfg) return;
    if (!rows.length) { alert('Fichier vide ou format non reconnu.'); return; }
    const mapFn = cfg.mapImport || (r => r);
    let ok = 0, errors = 0;
    for (const rawRow of rows) {
        const payload = mapFn(rawRow);
        if (!payload || !(payload.nom_batiment || payload.nom_navire || payload.num || payload.cible_nom)) {
            errors++; continue;
        }
        try {
            const result = await api(cfg.apiPost, { method: 'POST', body: JSON.stringify(payload) });
            (D[cfg.dataKey] || []).push(result);
            ok++;
        } catch(e) { errors++; }
    }
    cfg.renderFn();
    alert(`Import terminé : ${ok} ligne(s) importée(s)${errors ? `, ${errors} erreur(s) ignorée(s)` : ''}.`);
}

// ═══════════════════════════════════════════════════════════════
// PDF EXPORT (print window)
// ═══════════════════════════════════════════════════════════════

let _pdfModule = null;

window.openExportPDF = function(module) {
    const cfg = MODULE_CFG[module];
    if (!cfg) return;
    _pdfModule = module;
    document.querySelectorAll('.io-dropdown').forEach(d => d.style.display = 'none');
    document.getElementById('modal-pdf-module-lbl').textContent = 'Module : ' + cfg.label;

    // Populate statut options
    const sel = document.getElementById('pdf-filter-statut');
    sel.innerHTML = '<option value="">Tous les statuts</option>';
    if (cfg.statutOptions && cfg.statutLabels) {
        cfg.statutOptions.forEach(s => {
            const o = document.createElement('option');
            o.value = s; o.textContent = cfg.statutLabels[s] || s;
            sel.appendChild(o);
        });
    }
    // Reset date filters
    document.getElementById('pdf-filter-from').value = '';
    document.getElementById('pdf-filter-to').value = '';
    document.getElementById('modal-pdf').classList.add('open');
};

window.generatePDF = function() {
    const cfg = MODULE_CFG[_pdfModule];
    if (!cfg) return;
    let data = [...(D[cfg.dataKey] || [])];

    // Filters
    const fltSt   = document.getElementById('pdf-filter-statut').value;
    const fltFrom = document.getElementById('pdf-filter-from').value;
    const fltTo   = document.getElementById('pdf-filter-to').value;
    if (fltSt) data = data.filter(r => r.statut === fltSt || r.statut === fltSt);
    if (fltFrom) data = data.filter(r => {
        const dv = r.date || r.eta || r.created_at || '';
        return !dv || dv.slice(0,10) >= fltFrom;
    });
    if (fltTo) data = data.filter(r => {
        const dv = r.date || r.eta || r.created_at || '';
        return !dv || dv.slice(0,10) <= fltTo;
    });

    // Sort
    const sortField = document.getElementById('pdf-sort-field').value;
    const sortDir   = document.getElementById('pdf-sort-dir').value;
    const fieldKey  = cfg.sortFields[sortField] || 'date';
    data.sort((a, b) => {
        const av = String(a[fieldKey] || '').toLowerCase();
        const bv = String(b[fieldKey] || '').toLowerCase();
        return sortDir === 'asc' ? av.localeCompare(bv, 'fr') : bv.localeCompare(av, 'fr');
    });

    if (!data.length) { alert('Aucune donnée correspondant aux critères.'); return; }

    const now  = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
    const timeStr = now.toTimeString().slice(0,5);
    const user = window.currentUser ? `${window.currentUser.grade} ${window.currentUser.nom} ${window.currentUser.prenom}` : 'JOCC';

    const cols   = cfg.pdfCols;
    const labels = cfg.pdfLabels;

    const thead = '<tr>' + labels.map(l => `<th>${l}</th>`).join('') + '</tr>';
    const tbody = data.map(r => {
        return '<tr>' + cols.map(c => {
            let v = r[c];
            if (v === null || v === undefined) v = '—';
            // Format dates
            if (typeof v === 'string' && v.length > 10 && v.includes('T')) {
                v = fmtDt(v);
            }
            // Translate statut codes
            const allLabels = { ...ESC2_STATUT_L, ...WAP_STATUT_L,
                planifiee:'Planifiée', encours:'En cours', terminee:'Terminée', annulee:'Annulée' };
            if (c === 'statut' && allLabels[v]) v = allLabels[v];
            if (c === 'type_batiment' && ESC2_TYPE_L[v]) v = ESC2_TYPE_L[v];
            if (c === 'type_navire' && WAP_TYPE_L[v]) v = WAP_TYPE_L[v];
            return `<td>${String(v)}</td>`;
        }).join('') + '</tr>';
    }).join('');

    const filters = [];
    if (fltSt) filters.push('Statut : ' + (cfg.statutLabels?.[fltSt] || fltSt));
    if (fltFrom) filters.push('Du : ' + fltFrom);
    if (fltTo)   filters.push('Au : ' + fltTo);
    const filterStr = filters.length ? `<div style="font-size:10px;color:#666;margin-top:4px">Filtres : ${filters.join(' · ')}</div>` : '';

    const html = `<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><title>${cfg.pdfTitle}</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #1a1a2e; }
  .header { margin-bottom: 14px; border-bottom: 2px solid #0d2035; padding-bottom: 8px; }
  .header h1 { font-size: 16px; font-weight: 700; color: #0d2035; margin: 0 0 2px; }
  .header .sub { font-size: 10px; color: #5a6478; }
  .meta { font-size: 9px; color: #888; margin-top: 2px; }
  .count { font-size: 10px; font-weight: 600; margin-bottom: 6px; }
  table { width:100%; border-collapse: collapse; }
  th { background: #0d2035; color: #fff; padding: 6px 8px; font-size: 9px; letter-spacing: .04em; text-align: left; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 9px; vertical-align: top; }
  tr:nth-child(even) td { background: #f9fafb; }
  .footer { margin-top: 12px; font-size: 8px; color: #aaa; text-align: right; border-top: 1px solid #e5e7eb; padding-top: 6px; }
</style></head><body>
<div class="header">
  <h1>⚓ Préfecture Maritime du Bénin · JOCC</h1>
  <div class="sub">${cfg.pdfTitle}</div>
  ${filterStr}
  <div class="meta">Généré le ${dateStr} à ${timeStr} · Par : ${user}</div>
</div>
<div class="count">${data.length} enregistrement(s) · Tri : ${labels[cols.indexOf(fieldKey)] || sortField} (${sortDir === 'asc' ? 'croissant' : 'décroissant'})</div>
<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
<div class="footer">JOCC — Document généré automatiquement · Confidentiel</div>
<script>window.onload=()=>window.print();<\/script>
</body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    document.getElementById('modal-pdf').classList.remove('open');
};
