// ═══════════════════════════════════════════════════════════════
// JOCC — Serveur Node.js / Express
// Gestion des Quarts · Préfecture Maritime du Bénin · v5.0
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();

const express     = require('express');
const { Pool }    = require('pg');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');
const path        = require('path');
const fs          = require('fs');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── CONNEXION POSTGRESQL ─────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.connect()
  .then(client => {
    console.log('✅ PostgreSQL connecté');
    client.release();
    return initDatabase();
  })
  .catch(err => {
    console.error('❌ Connexion PostgreSQL échouée:', err.message);
    process.exit(1);
  });

// ─── INITIALISATION SCHÉMA ────────────────────────────────────────────────
async function initDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.warn('⚠️  schema.sql introuvable — tables non créées automatiquement');
    return;
  }
  const sql = fs.readFileSync(schemaPath, 'utf8');
  try {
    await pool.query(sql);
    console.log('✅ Schéma PostgreSQL initialisé');
  } catch (err) {
    console.error('⚠️  Erreur schéma (tables peut-être déjà existantes):', err.message);
  }
}

// ─── MIDDLEWARES ─────────────────────────────────────────────────────────
app.use(compression());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '20mb' }));  // 20mb pour les images base64
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── HELPERS ─────────────────────────────────────────────────────────────
const ok  = (res, data)          => res.json({ success: true, data });
const err = (res, msg, code=500) => res.status(code).json({ success: false, error: msg });
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ═══════════════════════════════════════════════════════════════
// API CONFIG (rotation des équipes)
// ═══════════════════════════════════════════════════════════════

app.get('/api/config', async (req, res) => {
  try {
    const r = await pool.query("SELECT value FROM config WHERE key='rotation'");
    ok(res, r.rows.length ? r.rows[0].value : { refDate: new Date().toISOString().slice(0,10), refTeam: 'A' });
  } catch (e) { err(res, e.message); }
});

app.put('/api/config', async (req, res) => {
  try {
    const { refDate, refTeam } = req.body;
    if (!refDate || !refTeam) return err(res, 'refDate et refTeam requis', 400);
    await pool.query(
      `INSERT INTO config (key, value) VALUES ('rotation', $1)
       ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
      [JSON.stringify({ refDate, refTeam })]
    );
    ok(res, { refDate, refTeam });
  } catch (e) { err(res, e.message); }
});

// ═══════════════════════════════════════════════════════════════
// API OPÉRATEURS
// ═══════════════════════════════════════════════════════════════

app.get('/api/operateurs', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM operateurs ORDER BY equipe, nom');
    ok(res, r.rows);
  } catch (e) { err(res, e.message); }
});

app.post('/api/operateurs', async (req, res) => {
  try {
    const { id, nom, prenom, grade, equipe, poste, actif } = req.body;
    if (!nom || !prenom) return err(res, 'Nom et prénom requis', 400);
    const r = await pool.query(
      `INSERT INTO operateurs (id, nom, prenom, grade, equipe, poste, actif)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id || genId(), nom.toUpperCase(), prenom, grade || '', equipe || 'A', poste || 'chef', actif !== false]
    );
    ok(res, r.rows[0]);
  } catch (e) { err(res, e.message); }
});

app.put('/api/operateurs/:id', async (req, res) => {
  try {
    const { nom, prenom, grade, equipe, poste, actif } = req.body;
    const r = await pool.query(
      `UPDATE operateurs SET nom=$1, prenom=$2, grade=$3, equipe=$4, poste=$5, actif=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [nom.toUpperCase(), prenom, grade || '', equipe, poste, actif, req.params.id]
    );
    if (!r.rows.length) return err(res, 'Opérateur non trouvé', 404);
    ok(res, r.rows[0]);
  } catch (e) { err(res, e.message); }
});

app.delete('/api/operateurs/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM operateurs WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows.length) return err(res, 'Opérateur non trouvé', 404);
    ok(res, { deleted: req.params.id });
  } catch (e) { err(res, e.message); }
});

// ═══════════════════════════════════════════════════════════════
// API SITREPS
// ═══════════════════════════════════════════════════════════════

app.get('/api/sitreps', async (req, res) => {
  try {
    const { equipe, date } = req.query;
    let sql = 'SELECT * FROM sitreps WHERE 1=1';
    const params = [];
    if (equipe) { params.push(equipe); sql += ` AND equipe=$${params.length}`; }
    if (date)   { params.push(date);   sql += ` AND date=$${params.length}`; }
    sql += ' ORDER BY num DESC';
    const r = await pool.query(sql, params);
    ok(res, r.rows);
  } catch (e) { err(res, e.message); }
});

app.post('/api/sitreps', async (req, res) => {
  try {
    const s = req.body;
    if (!s.num) return err(res, 'Numéro requis', 400);
    const r = await pool.query(
      `INSERT INTO sitreps (id,num,date,heure,equipe,speed,course,lat,lon,
         azm_pac,dist_pac,dist_cote,azm_spm,dist_spm,comment)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [s.id || genId(), s.num, s.date, s.heure || '', s.equipe,
       s.speed||'', s.course||'', s.lat||'', s.lon||'',
       s.azm_pac||'', s.dist_pac||'', s.dist_cote||'',
       s.azm_spm||'', s.dist_spm||'', s.comment||'']
    );
    ok(res, r.rows[0]);
  } catch (e) { err(res, e.message); }
});

app.put('/api/sitreps/:id', async (req, res) => {
  try {
    const s = req.body;
    const r = await pool.query(
      `UPDATE sitreps SET num=$1,date=$2,heure=$3,equipe=$4,speed=$5,course=$6,
         lat=$7,lon=$8,azm_pac=$9,dist_pac=$10,dist_cote=$11,
         azm_spm=$12,dist_spm=$13,comment=$14,updated_at=NOW()
       WHERE id=$15 RETURNING *`,
      [s.num, s.date, s.heure||'', s.equipe,
       s.speed||'', s.course||'', s.lat||'', s.lon||'',
       s.azm_pac||'', s.dist_pac||'', s.dist_cote||'',
       s.azm_spm||'', s.dist_spm||'', s.comment||'', req.params.id]
    );
    if (!r.rows.length) return err(res, 'SITREP non trouvé', 404);
    ok(res, r.rows[0]);
  } catch (e) { err(res, e.message); }
});

app.delete('/api/sitreps/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM sitreps WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows.length) return err(res, 'SITREP non trouvé', 404);
    ok(res, { deleted: req.params.id });
  } catch (e) { err(res, e.message); }
});

// ═══════════════════════════════════════════════════════════════
// API RAPPORTS DE QUART
// ═══════════════════════════════════════════════════════════════

// ⚠️ Cette route DOIT être avant /api/rapports/:date
app.get('/api/rapports/recent-events', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT e.*, e.date_rapport::text AS date
       FROM evenements e
       ORDER BY e.date_rapport DESC, e.heure DESC
       LIMIT 10`
    );
    ok(res, r.rows);
  } catch (e) { err(res, e.message); }
});

app.get('/api/rapports/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const { equipe } = req.query;
    let r = await pool.query('SELECT * FROM rapports WHERE date=$1', [date]);
    if (!r.rows.length) {
      r = await pool.query(
        'INSERT INTO rapports (date, equipe, chef, observations) VALUES ($1,$2,$3,$4) RETURNING *',
        [date, equipe || 'A', '', '']
      );
    }
    const rapport = { ...r.rows[0] };
    const evs = await pool.query(
      'SELECT * FROM evenements WHERE date_rapport=$1 ORDER BY heure ASC', [date]
    );
    rapport.evenements = evs.rows;
    ok(res, rapport);
  } catch (e) { err(res, e.message); }
});

app.put('/api/rapports/:date', async (req, res) => {
  try {
    const { chef, observations } = req.body;
    const r = await pool.query(
      'UPDATE rapports SET chef=$1, observations=$2, updated_at=NOW() WHERE date=$3 RETURNING *',
      [chef || '', observations || '', req.params.date]
    );
    if (!r.rows.length) return err(res, 'Rapport non trouvé', 404);
    ok(res, r.rows[0]);
  } catch (e) { err(res, e.message); }
});

// ─── ÉVÉNEMENTS (main courante) ───────────────────────────────────────────

app.post('/api/rapports/:date/evenements', async (req, res) => {
  try {
    const { date } = req.params;
    const { heure, type, description } = req.body;
    if (!heure || !description) return err(res, 'Heure et description requises', 400);
    const r = await pool.query(
      `INSERT INTO evenements (id, date_rapport, heure, type, description)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [genId(), date, heure, type || 'routine', description]
    );
    ok(res, r.rows[0]);
  } catch (e) { err(res, e.message); }
});

app.delete('/api/rapports/:date/evenements/:id', async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM evenements WHERE id=$1 AND date_rapport=$2 RETURNING id',
      [req.params.id, req.params.date]
    );
    if (!r.rows.length) return err(res, 'Événement non trouvé', 404);
    ok(res, { deleted: req.params.id });
  } catch (e) { err(res, e.message); }
});

// ═══════════════════════════════════════════════════════════════
// API ABSENCES
// ═══════════════════════════════════════════════════════════════

app.get('/api/absences', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM absences ORDER BY date_debut DESC');
    ok(res, r.rows);
  } catch (e) { err(res, e.message); }
});

app.post('/api/absences', async (req, res) => {
  try {
    const { operateur_id, motif, date_debut, date_fin } = req.body;
    if (!operateur_id || !date_debut || !date_fin) return err(res, 'Champs requis manquants', 400);
    if (date_fin < date_debut) return err(res, 'Date de fin invalide', 400);
    const r = await pool.query(
      `INSERT INTO absences (id, operateur_id, motif, date_debut, date_fin, statut)
       VALUES ($1,$2,$3,$4,$5,'attente') RETURNING *`,
      [genId(), operateur_id, motif || 'autre', date_debut, date_fin]
    );
    ok(res, r.rows[0]);
  } catch (e) { err(res, e.message); }
});

app.patch('/api/absences/:id/statut', async (req, res) => {
  try {
    const valid = ['attente','valide','refuse'];
    if (!valid.includes(req.body.statut)) return err(res, 'Statut invalide', 400);
    const r = await pool.query(
      'UPDATE absences SET statut=$1 WHERE id=$2 RETURNING *',
      [req.body.statut, req.params.id]
    );
    if (!r.rows.length) return err(res, 'Absence non trouvée', 404);
    ok(res, r.rows[0]);
  } catch (e) { err(res, e.message); }
});

app.delete('/api/absences/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM absences WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows.length) return err(res, 'Absence non trouvée', 404);
    ok(res, { deleted: req.params.id });
  } catch (e) { err(res, e.message); }
});

// ═══════════════════════════════════════════════════════════════
// API NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

app.get('/api/notifications', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100');
    ok(res, r.rows);
  } catch (e) { err(res, e.message); }
});

app.post('/api/notifications', async (req, res) => {
  try {
    const { type, titre, detail, urg } = req.body;
    const r = await pool.query(
      'INSERT INTO notifications (id,type,titre,detail,urg) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [genId(), type, titre, detail || '', urg || false]
    );
    ok(res, r.rows[0]);
  } catch (e) { err(res, e.message); }
});

app.patch('/api/notifications/mark-read', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET lu=true WHERE lu=false');
    ok(res, { updated: true });
  } catch (e) { err(res, e.message); }
});

app.delete('/api/notifications', async (req, res) => {
  try {
    await pool.query('DELETE FROM notifications');
    ok(res, { deleted: true });
  } catch (e) { err(res, e.message); }
});

// ═══════════════════════════════════════════════════════════════
// API CONSIGNES
// ═══════════════════════════════════════════════════════════════

app.get('/api/consignes', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM consignes ORDER BY created_at DESC');
    ok(res, r.rows);
  } catch (e) { err(res, e.message); }
});

app.post('/api/consignes', async (req, res) => {
  try {
    const { titre, description, priorite, file_data, file_name } = req.body;
    if (!titre) return err(res, 'Titre requis', 400);
    const r = await pool.query(
      `INSERT INTO consignes (id, titre, description, priorite, file_data, file_name, date)
       VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE) RETURNING *`,
      [genId(), titre, description || '', priorite || 'normal', file_data || null, file_name || null]
    );
    ok(res, r.rows[0]);
  } catch (e) { err(res, e.message); }
});

app.delete('/api/consignes/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM consignes WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows.length) return err(res, 'Consigne non trouvée', 404);
    ok(res, { deleted: req.params.id });
  } catch (e) { err(res, e.message); }
});

// ═══════════════════════════════════════════════════════════════
// API CAPTURES SURVEILLANCE
// ═══════════════════════════════════════════════════════════════

app.get('/api/captures', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM captures ORDER BY created_at DESC');
    ok(res, r.rows);
  } catch (e) { err(res, e.message); }
});

app.post('/api/captures', async (req, res) => {
  try {
    const { source, comment, data_url } = req.body;
    if (!data_url) return err(res, 'Image requise', 400);
    const r = await pool.query(
      'INSERT INTO captures (id, source, comment, data_url) VALUES ($1,$2,$3,$4) RETURNING *',
      [genId(), source || 'autre', comment || '', data_url]
    );
    ok(res, r.rows[0]);
  } catch (e) { err(res, e.message); }
});

app.delete('/api/captures/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM captures WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows.length) return err(res, 'Capture non trouvée', 404);
    ok(res, { deleted: req.params.id });
  } catch (e) { err(res, e.message); }
});

// ═══════════════════════════════════════════════════════════════
// API MISSIONS D'ESCORTE
// ═══════════════════════════════════════════════════════════════

app.get('/api/escortes', async (req, res) => {
  try {
    const { statut, type } = req.query;
    let sql = 'SELECT * FROM escortes WHERE 1=1';
    const params = [];
    if (statut) { params.push(statut); sql += ` AND statut=$${params.length}`; }
    if (type)   { params.push(type);   sql += ` AND type=$${params.length}`; }
    sql += ' ORDER BY date DESC, heure DESC';
    const r = await pool.query(sql, params);
    ok(res, r.rows);
  } catch (e) { err(res, e.message); }
});

app.post('/api/escortes', async (req, res) => {
  try {
    const e = req.body;
    if (!e.num || !e.cible_nom) return err(res, 'Numéro de mission et nom du navire requis', 400);
    const r = await pool.query(
      `INSERT INTO escortes (id,num,date,heure,type,equipe,zone,rdv,duree,
         cible_nom,cible_mmsi,cible_imo,cible_cs,cible_pavillon,cible_type,
         cible_loa,cible_gt,cible_draft,cible_from,cible_to,cible_eta,cible_cargo,
         nav_nom,nav_mmsi,nav_cs,nav_pavillon,nav_type,nav_loa,nav_cmd,
         nav_vhf,nav_effectif,nav_arm,comment,statut)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
               $16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,
               $30,$31,$32,$33,$34) RETURNING *`,
      [e.id||genId(), e.num, e.date, e.heure||'', e.type||'entree', e.equipe||'A',
       e.zone||'', e.rdv||'', e.duree||'',
       e.cible_nom.toUpperCase(), e.cible_mmsi||'', e.cible_imo||'', e.cible_cs||'', e.cible_pavillon||'',
       e.cible_type||'cargo', e.cible_loa||null, e.cible_gt||null, e.cible_draft||'',
       e.cible_from||'', e.cible_to||'', e.cible_eta||null, e.cible_cargo||'',
       (e.nav_nom||'').toUpperCase(), e.nav_mmsi||'', e.nav_cs||'', e.nav_pavillon||'Bénin',
       e.nav_type||'patrouilleur', e.nav_loa||null, e.nav_cmd||'',
       e.nav_vhf||'', e.nav_effectif||null, e.nav_arm||'', e.comment||'', e.statut||'planifiee']
    );
    ok(res, r.rows[0]);
  } catch (e) { err(res, e.message); }
});

app.put('/api/escortes/:id', async (req, res) => {
  try {
    const e = req.body;
    // On conserve le statut existant lors d'une édition
    const existing = await pool.query('SELECT statut FROM escortes WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return err(res, 'Mission non trouvée', 404);
    const statut = existing.rows[0].statut;
    const r = await pool.query(
      `UPDATE escortes SET num=$1,date=$2,heure=$3,type=$4,equipe=$5,zone=$6,rdv=$7,duree=$8,
         cible_nom=$9,cible_mmsi=$10,cible_imo=$11,cible_cs=$12,cible_pavillon=$13,cible_type=$14,
         cible_loa=$15,cible_gt=$16,cible_draft=$17,cible_from=$18,cible_to=$19,cible_eta=$20,cible_cargo=$21,
         nav_nom=$22,nav_mmsi=$23,nav_cs=$24,nav_pavillon=$25,nav_type=$26,nav_loa=$27,nav_cmd=$28,
         nav_vhf=$29,nav_effectif=$30,nav_arm=$31,comment=$32,updated_at=NOW()
       WHERE id=$33 RETURNING *`,
      [e.num, e.date, e.heure||'', e.type, e.equipe, e.zone||'', e.rdv||'', e.duree||'',
       e.cible_nom.toUpperCase(), e.cible_mmsi||'', e.cible_imo||'', e.cible_cs||'', e.cible_pavillon||'',
       e.cible_type||'cargo', e.cible_loa||null, e.cible_gt||null, e.cible_draft||'',
       e.cible_from||'', e.cible_to||'', e.cible_eta||null, e.cible_cargo||'',
       (e.nav_nom||'').toUpperCase(), e.nav_mmsi||'', e.nav_cs||'', e.nav_pavillon||'Bénin',
       e.nav_type||'patrouilleur', e.nav_loa||null, e.nav_cmd||'',
       e.nav_vhf||'', e.nav_effectif||null, e.nav_arm||'', e.comment||'', req.params.id]
    );
    ok(res, r.rows[0]);
  } catch (e) { err(res, e.message); }
});

app.patch('/api/escortes/:id/statut', async (req, res) => {
  try {
    const valid = ['planifiee','encours','terminee','annulee'];
    if (!valid.includes(req.body.statut)) return err(res, 'Statut invalide', 400);
    const r = await pool.query(
      'UPDATE escortes SET statut=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [req.body.statut, req.params.id]
    );
    if (!r.rows.length) return err(res, 'Mission non trouvée', 404);
    ok(res, r.rows[0]);
  } catch (e) { err(res, e.message); }
});

app.delete('/api/escortes/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM escortes WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows.length) return err(res, 'Mission non trouvée', 404);
    ok(res, { deleted: req.params.id });
  } catch (e) { err(res, e.message); }
});

// ─── HEALTH CHECK ────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const db = await pool.query('SELECT NOW() AS now, version() AS pg');
    res.json({ status: 'OK', db: db.rows[0].now, pg: db.rows[0].pg.split(' ')[0]+' '+db.rows[0].pg.split(' ')[1], version: '5.0.0' });
  } catch (e) {
    res.status(500).json({ status: 'ERROR', error: e.message });
  }
});

// ─── SPA fallback → index.html ───────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── DÉMARRAGE ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 JOCC Server démarré → http://localhost:${PORT}`);
  console.log(`   Mode : ${process.env.NODE_ENV || 'development'}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
