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
const bcrypt      = require('bcryptjs');
const jwt         = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET || 'jocc_jwt_secret_2026';
const JWT_EXPIRES = '8h';

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
  .then(() => applyMigrations())
  .then(() => seedPasswords())
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

// ─── AUDIT LOG ────────────────────────────────────────────────────────────
function audit(userId, userNom, userPoste, action, resource, details, ip) {
  pool.query(
    `INSERT INTO audit_logs (id,user_id,user_nom,user_poste,action,resource,details,ip)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [genId(), userId, userNom, userPoste, action, resource || null,
     details ? String(details).slice(0, 400) : null, ip || '']
  ).catch(() => {});
}

// Middleware: log auto toutes les mutations réussies (POST/PUT/PATCH/DELETE)
app.use((req, res, next) => {
  const MUTATE = ['POST','PUT','PATCH','DELETE'];
  if (!MUTATE.includes(req.method)) return next();
  const origJson = res.json.bind(res);
  res.json = function(body) {
    if (body && body.success && req.user) {
      const safeBody = JSON.stringify(req.body || {})
        .replace(/"(password[^"]*|newPassword|currentPassword)"\s*:\s*"[^"]+"/g, '"$1":"***"')
        .slice(0, 400);
      audit(req.user.id, `${req.user.nom} ${req.user.prenom}`, req.user.poste,
            `${req.method} ${req.path}`, req.path, safeBody, req.ip);
    }
    return origJson(body);
  };
  next();
});

// ─── ROTATION HELPER ──────────────────────────────────────────────────────
function getTeamForDate(date, refDate, refTeam) {
  const TEAMS = ['A','B','C','D'];
  const ref  = new Date(refDate + 'T12:00:00');
  const d    = new Date(date    + 'T12:00:00');
  const diff = Math.round((d - ref) / 86400000);
  return TEAMS[((TEAMS.indexOf(refTeam) + diff) % 4 + 4) % 4];
}

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────
const requireAuth = (req, res, next) => {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return err(res, 'Non authentifié', 401);
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch (e) {
    return err(res, 'Token invalide ou expiré', 401);
  }
};

const requireRole = (role) => (req, res, next) => {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return err(res, 'Non authentifié', 401);
  try {
    const user = jwt.verify(auth.slice(7), JWT_SECRET);
    if (user.poste !== role) return err(res, `Privilèges [${role}] requis`, 403);
    req.user = user;
    next();
  } catch (e) {
    return err(res, 'Token invalide ou expiré', 401);
  }
};

// ─── MIGRATIONS ──────────────────────────────────────────────────────────
async function applyMigrations() {
  try {
    // Colonne password_hash
    await pool.query('ALTER TABLE operateurs ADD COLUMN IF NOT EXISTS password_hash TEXT');

    // Contrainte unicité nom+prenom si absente
    const cc = await pool.query("SELECT 1 FROM pg_constraint WHERE conname='unique_oper_name'");
    if (!cc.rows.length) {
      await pool.query('ALTER TABLE operateurs ADD CONSTRAINT unique_oper_name UNIQUE (nom, prenom)');
    }

    // Rôle "liaison" — mise à jour de la contrainte CHECK
    await pool.query(`ALTER TABLE operateurs DROP CONSTRAINT IF EXISTS operateurs_poste_check`);
    await pool.query(`ALTER TABLE operateurs ADD CONSTRAINT operateurs_poste_check
      CHECK (poste IN ('chef','veille','radio','permanence','supervision','liaison'))`);

    // Table audit_logs
    await pool.query(`CREATE TABLE IF NOT EXISTS audit_logs (
      id         VARCHAR(30) PRIMARY KEY,
      user_id    VARCHAR(30),
      user_nom   VARCHAR(150),
      user_poste VARCHAR(30),
      action     VARCHAR(150) NOT NULL,
      resource   VARCHAR(100),
      details    TEXT,
      ip         VARCHAR(50),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC)`);

    // Table reporting_env
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reporting_env (
        id           VARCHAR(30) PRIMARY KEY,
        date         DATE        NOT NULL,
        equipe       CHAR(1)     CHECK (equipe IN ('A','B','C','D')),
        redacteur_id VARCHAR(30),
        lignes       JSONB       NOT NULL DEFAULT '[]',
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='unique_reporting_env_date') THEN
          ALTER TABLE reporting_env ADD CONSTRAINT unique_reporting_env_date UNIQUE (date);
        END IF;
      END $$
    `);

    // Seed opérateurs si table vide
    const cnt = await pool.query('SELECT COUNT(*) FROM operateurs');
    if (parseInt(cnt.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO operateurs (id,nom,prenom,grade,equipe,poste,actif) VALUES
          ('op_a1','MARTIN',   'Jean',     'LV', 'A','chef',       true),
          ('op_a2','DUBOIS',   'Marie',    'OIM','A','radio',      true),
          ('op_a3','BERNARD',  'Paul',     'CC', 'A','veille',     true),
          ('op_a4','THOMAS',   'Sophie',   'EV1','A','permanence', true),
          ('op_b1','PETIT',    'Luc',      'LV', 'B','chef',       true),
          ('op_b2','ROBERT',   'Anna',     'OIM','B','radio',      true),
          ('op_b3','RICHARD',  'Marc',     'CC', 'B','veille',     true),
          ('op_b4','SIMON',    'Julie',    'EV1','B','permanence', true),
          ('op_c1','MOREAU',   'Eric',     'LV', 'C','chef',       true),
          ('op_c2','LAURENT',  'Claire',   'OIM','C','radio',      true),
          ('op_c3','GARCIA',   'Pierre',   'CC', 'C','veille',     true),
          ('op_c4','LEROY',    'Isabelle', 'EV1','C','permanence', true),
          ('op_d1','ADAM',     'Nicolas',  'LV', 'D','chef',       true),
          ('op_d2','ROUX',     'Catherine','OIM','D','radio',      true),
          ('op_d3','FOURNIER', 'Alain',    'CC', 'D','veille',     true),
          ('op_d4','VINCENT',  'Sandra',   'EV1','D','permanence', true),
          ('op_s1','HOUNKPE',  'Romuald',  'CF', 'A','supervision',true),
          ('admin_01','ADMIN', 'Super',    'CDT','A','supervision',true)
        ON CONFLICT (id) DO NOTHING
      `);
      console.log('✅ Opérateurs initiaux insérés');
    }
  } catch (e) {
    console.error('⚠️  Erreur migration:', e.message);
  }
}

// ─── SEED MOTS DE PASSE PAR DÉFAUT ───────────────────────────────────────
async function seedPasswords() {
  try {
    const r = await pool.query('SELECT id FROM operateurs WHERE password_hash IS NULL');
    if (!r.rows.length) return;
    const hash = await bcrypt.hash('JOCC2026', 10);
    await pool.query('UPDATE operateurs SET password_hash=$1 WHERE password_hash IS NULL', [hash]);
    console.log(`✅ Mots de passe initialisés pour ${r.rows.length} opérateur(s) (JOCC2026)`);
  } catch (e) {
    console.error('⚠️  Erreur seedPasswords:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// API AUTH
// ═══════════════════════════════════════════════════════════════

app.post('/api/login', async (req, res) => {
  const { id, password } = req.body;
  if (!id || !password) return err(res, 'Identifiant et mot de passe requis', 400);
  try {
    const r = await pool.query('SELECT * FROM operateurs WHERE id=$1 AND actif=true', [id]);
    if (!r.rows.length) return err(res, 'Identifiant ou mot de passe incorrect', 401);
    const op = r.rows[0];
    if (!op.password_hash) return err(res, 'Compte non configuré, contactez un superviseur', 401);
    const valid = await bcrypt.compare(password, op.password_hash);
    if (!valid) {
      audit(op.id, `${op.nom} ${op.prenom}`, op.poste, 'LOGIN_ECHEC', 'auth', 'Mot de passe incorrect', req.ip);
      return err(res, 'Identifiant ou mot de passe incorrect', 401);
    }

    // ── Vérification de planification (rôles non-exempt uniquement) ──
    const EXEMPT_ROLES = ['supervision', 'chef'];
    if (!EXEMPT_ROLES.includes(op.poste)) {
      const cfg = await pool.query("SELECT value FROM config WHERE key='rotation'");
      if (cfg.rows.length) {
        const { refDate, refTeam } = cfg.rows[0].value;
        const today = new Date().toISOString().slice(0, 10);
        const todayTeam = getTeamForDate(today, refDate, refTeam);
        if (op.equipe !== todayTeam) {
          audit(op.id, `${op.nom} ${op.prenom}`, op.poste, 'LOGIN_REFUSE', 'auth',
            `Non planifié — Équipe du jour : ${todayTeam}`, req.ip);
          return err(res,
            `Connexion refusée : vous n'êtes pas planifié aujourd'hui.\n` +
            `Équipe de quart en service : Équipe ${todayTeam}`, 403);
        }
      }
    }

    const payload = { id: op.id, nom: op.nom, prenom: op.prenom, grade: op.grade, equipe: op.equipe, poste: op.poste };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    audit(op.id, `${op.nom} ${op.prenom}`, op.poste, 'LOGIN', 'auth', null, req.ip);
    ok(res, { token, user: payload });
  } catch (e) { err(res, e.message); }
});

app.get('/api/me', requireAuth, (req, res) => {
  ok(res, req.user);
});

// ═══════════════════════════════════════════════════════════════
// API CONFIG (rotation des équipes)
// ═══════════════════════════════════════════════════════════════

app.get('/api/config', async (req, res) => {
  try {
    const r = await pool.query("SELECT value FROM config WHERE key='rotation'");
    ok(res, r.rows.length ? r.rows[0].value : { refDate: new Date().toISOString().slice(0,10), refTeam: 'A' });
  } catch (e) { err(res, e.message); }
});

app.put('/api/config', requireRole('supervision'), async (req, res) => {
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

app.post('/api/operateurs', requireRole('supervision'), async (req, res) => {
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

app.put('/api/operateurs/:id', requireRole('supervision'), async (req, res) => {
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

app.delete('/api/operateurs/:id', requireRole('supervision'), async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM operateurs WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows.length) return err(res, 'Opérateur non trouvé', 404);
    ok(res, { deleted: req.params.id });
  } catch (e) { err(res, e.message); }
});

// Changement de mot de passe (supervision peut tout changer; un opérateur peut changer le sien)
app.put('/api/operateurs/:id/password', requireAuth, async (req, res) => {
  try {
    const { newPassword, currentPassword } = req.body;
    if (!newPassword || newPassword.length < 4) return err(res, 'Mot de passe trop court (min. 4 car.)', 400);
    const isSelf = req.user.id === req.params.id;
    const isSup  = req.user.poste === 'supervision';
    if (!isSelf && !isSup) return err(res, 'Action non autorisée', 403);
    // Si changement de son propre mot de passe, vérifier l'ancien
    if (isSelf && !isSup) {
      if (!currentPassword) return err(res, 'Mot de passe actuel requis', 400);
      const r2 = await pool.query('SELECT password_hash FROM operateurs WHERE id=$1', [req.params.id]);
      if (!r2.rows.length) return err(res, 'Opérateur introuvable', 404);
      const valid = await bcrypt.compare(currentPassword, r2.rows[0].password_hash || '');
      if (!valid) return err(res, 'Mot de passe actuel incorrect', 401);
    }
    const hash = await bcrypt.hash(newPassword, 10);
    const r = await pool.query('UPDATE operateurs SET password_hash=$1, updated_at=NOW() WHERE id=$2 RETURNING id', [hash, req.params.id]);
    if (!r.rows.length) return err(res, 'Opérateur introuvable', 404);
    ok(res, { updated: req.params.id });
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

// ═══════════════════════════════════════════════════════════════
// API REPORTING ENVIRONNEMENTAL
// ═══════════════════════════════════════════════════════════════

const ENV_ACTIVITES = [
  'Déversements',
  'Intrusions des pêcheurs',
  'Espèces migratoires (cétacés, tortues marines, lamantins, baleine) morts, blessés ou vivants',
  'Incidents environnementaux ou de sûreté liés aux trafics portuaires',
  'Autres',
];
const LIGNES_VIDES = ENV_ACTIVITES.map((activite, i) => ({
  num: i + 1, activite, constats: '', zones: [], commentaires: '',
}));

app.get('/api/reporting-env', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM reporting_env ORDER BY date DESC');
    ok(res, r.rows);
  } catch (e) { err(res, e.message); }
});

app.get('/api/reporting-env/:date', async (req, res) => {
  try {
    const { date } = req.params;
    let r = await pool.query('SELECT * FROM reporting_env WHERE date=$1', [date]);
    if (!r.rows.length) {
      const equipe = req.query.equipe || 'A';
      r = await pool.query(
        `INSERT INTO reporting_env (id, date, equipe, redacteur_id, lignes)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [genId(), date, equipe, null, JSON.stringify(LIGNES_VIDES)]
      );
    }
    ok(res, r.rows[0]);
  } catch (e) { err(res, e.message); }
});

app.put('/api/reporting-env/:date', requireAuth, async (req, res) => {
  try {
    const { equipe, redacteur_id, lignes } = req.body;
    const r = await pool.query(
      `UPDATE reporting_env SET equipe=$1, redacteur_id=$2, lignes=$3, updated_at=NOW()
       WHERE date=$4 RETURNING *`,
      [equipe, redacteur_id || null, JSON.stringify(lignes), req.params.date]
    );
    if (!r.rows.length) return err(res, 'Rapport introuvable', 404);
    ok(res, r.rows[0]);
  } catch (e) { err(res, e.message); }
});

app.delete('/api/reporting-env/:id', requireRole('supervision'), async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM reporting_env WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows.length) return err(res, 'Rapport introuvable', 404);
    ok(res, { deleted: req.params.id });
  } catch (e) { err(res, e.message); }
});

// ═══════════════════════════════════════════════════════════════
// API AUDIT LOGS
// ═══════════════════════════════════════════════════════════════

app.get('/api/audit-logs', requireRole('supervision'), async (req, res) => {
  try {
    const { user_id, action, from, to, limit = 200 } = req.query;
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    if (user_id) { params.push(user_id); sql += ` AND user_id=$${params.length}`; }
    if (action)  { params.push(`%${action}%`); sql += ` AND action ILIKE $${params.length}`; }
    if (from)    { params.push(from); sql += ` AND created_at >= $${params.length}`; }
    if (to)      { params.push(to + 'T23:59:59Z'); sql += ` AND created_at <= $${params.length}`; }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(Math.min(Number(limit) || 200, 1000));
    const r = await pool.query(sql, params);
    ok(res, r.rows);
  } catch (e) { err(res, e.message); }
});

app.delete('/api/audit-logs', requireRole('supervision'), async (req, res) => {
  try {
    const { before } = req.body;
    if (before) {
      await pool.query('DELETE FROM audit_logs WHERE created_at < $1', [before]);
    } else {
      await pool.query('DELETE FROM audit_logs');
    }
    ok(res, { deleted: true });
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
