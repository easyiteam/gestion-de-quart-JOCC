-- ═══════════════════════════════════════════════════════════════
-- SCHÉMA POSTGRESQL — JOCC Gestion des Quarts
-- Version 5.0 — Préfecture Maritime du Bénin
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── TRIGGER updated_at ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ─── CONFIG (rotation des équipes) ──────────────────────────────
CREATE TABLE IF NOT EXISTS config (
  key        VARCHAR(50) PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO config (key, value) VALUES
  ('rotation', '{"refDate":"2026-01-01","refTeam":"A"}')
ON CONFLICT (key) DO NOTHING;

-- ─── OPÉRATEURS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operateurs (
  id         VARCHAR(30) PRIMARY KEY,
  nom        VARCHAR(100) NOT NULL,
  prenom     VARCHAR(100) NOT NULL,
  grade      VARCHAR(50)  DEFAULT '',
  equipe     CHAR(1)      NOT NULL DEFAULT 'A'
               CHECK (equipe IN ('A','B','C','D')),
  poste      VARCHAR(30)  NOT NULL DEFAULT 'chef'
               CHECK (poste IN ('chef','veille','radio','permanence','supervision')),
  actif      BOOLEAN      NOT NULL DEFAULT TRUE,
  CONSTRAINT unique_oper_name UNIQUE(nom, prenom),
  created_at TIMESTAMPTZ  DEFAULT NOW(),
  updated_at TIMESTAMPTZ  DEFAULT NOW()
);
CREATE OR REPLACE TRIGGER trg_operateurs_upd
  BEFORE UPDATE ON operateurs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_oper_equipe ON operateurs(equipe);

-- Ajout colonne password_hash pour les tables déjà existantes
ALTER TABLE operateurs ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Données initiales (17 opérateurs JOCC)
INSERT INTO operateurs (id,nom,prenom,grade,equipe,poste,actif) VALUES
  ('op_a1','MARTIN',    'Jean',     'LV',  'A','chef',        true),
  ('op_a2','DUBOIS',    'Marie',    'OIM', 'A','radio',       true),
  ('op_a3','BERNARD',   'Paul',     'CC',  'A','veille',      true),
  ('op_a4','THOMAS',    'Sophie',   'EV1', 'A','permanence',  true),
  ('op_b1','PETIT',     'Luc',      'LV',  'B','chef',        true),
  ('op_b2','ROBERT',    'Anna',     'OIM', 'B','radio',       true),
  ('op_b3','RICHARD',   'Marc',     'CC',  'B','veille',      true),
  ('op_b4','SIMON',     'Julie',    'EV1', 'B','permanence',  true),
  ('op_c1','MOREAU',    'Eric',     'LV',  'C','chef',        true),
  ('op_c2','LAURENT',   'Claire',   'OIM', 'C','radio',       true),
  ('op_c3','GARCIA',    'Pierre',   'CC',  'C','veille',      true),
  ('op_c4','LEROY',     'Isabelle', 'EV1', 'C','permanence',  true),
  ('op_d1','ADAM',      'Nicolas',  'LV',  'D','chef',        true),
  ('op_d2','ROUX',      'Catherine','OIM', 'D','radio',       true),
  ('op_d3','FOURNIER',  'Alain',    'CC',  'D','veille',      true),
  ('op_d4','VINCENT',   'Sandra',   'EV1', 'D','permanence',  true),
  ('op_s1','HOUNKPE',   'Romuald',  'CF',  'A','supervision', true),
  ('admin_01','ADMIN',  'Super',    'CDT', 'A','supervision', true)
ON CONFLICT (id) DO NOTHING;

-- ─── SITREPS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sitreps (
  id         VARCHAR(30) PRIMARY KEY,
  num        INTEGER     NOT NULL,
  date       DATE        NOT NULL,
  heure      VARCHAR(10),
  equipe     CHAR(1)     CHECK (equipe IN ('A','B','C','D')),
  speed      VARCHAR(20) DEFAULT '',
  course     VARCHAR(20) DEFAULT '',
  lat        VARCHAR(40) DEFAULT '',
  lon        VARCHAR(40) DEFAULT '',
  azm_pac    VARCHAR(20) DEFAULT '',
  dist_pac   VARCHAR(20) DEFAULT '',
  dist_cote  VARCHAR(20) DEFAULT '',
  azm_spm    VARCHAR(20) DEFAULT '',
  dist_spm   VARCHAR(20) DEFAULT '',
  comment    TEXT        DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE OR REPLACE TRIGGER trg_sitreps_upd
  BEFORE UPDATE ON sitreps FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_sitreps_date   ON sitreps(date DESC);
CREATE INDEX IF NOT EXISTS idx_sitreps_equipe ON sitreps(equipe);

-- ─── RAPPORTS DE QUART ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rapports (
  date         DATE        PRIMARY KEY,
  equipe       CHAR(1)     CHECK (equipe IN ('A','B','C','D')),
  chef         VARCHAR(30) DEFAULT '',
  observations TEXT        DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE OR REPLACE TRIGGER trg_rapports_upd
  BEFORE UPDATE ON rapports FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── ÉVÉNEMENTS (main courante) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS evenements (
  id           VARCHAR(30) PRIMARY KEY,
  date_rapport DATE        NOT NULL REFERENCES rapports(date) ON DELETE CASCADE,
  heure        VARCHAR(10) NOT NULL,
  type         VARCHAR(20) NOT NULL DEFAULT 'routine'
                 CHECK (type IN ('routine','info','urgence')),
  description  TEXT        NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ev_date ON evenements(date_rapport DESC);

-- ─── ABSENCES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS absences (
  id           VARCHAR(30) PRIMARY KEY,
  operateur_id VARCHAR(30) REFERENCES operateurs(id) ON DELETE SET NULL,
  motif        VARCHAR(30) NOT NULL DEFAULT 'autre'
                 CHECK (motif IN ('maladie','conge','formation','mission','autre')),
  date_debut   DATE        NOT NULL,
  date_fin     DATE        NOT NULL,
  statut       VARCHAR(20) NOT NULL DEFAULT 'attente'
                 CHECK (statut IN ('attente','valide','refuse')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_abs_oper ON absences(operateur_id);

-- ─── NOTIFICATIONS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         VARCHAR(30) PRIMARY KEY,
  type       VARCHAR(30)  NOT NULL,
  titre      VARCHAR(200) NOT NULL,
  detail     TEXT         DEFAULT '',
  urg        BOOLEAN      NOT NULL DEFAULT FALSE,
  lu         BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_lu ON notifications(lu);

-- ─── CONSIGNES PERMANENTES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS consignes (
  id          VARCHAR(30) PRIMARY KEY,
  titre       VARCHAR(200) NOT NULL,
  description TEXT         DEFAULT '',
  priorite    VARCHAR(20)  NOT NULL DEFAULT 'normal'
                CHECK (priorite IN ('normal','important','urgent')),
  date        DATE         NOT NULL DEFAULT CURRENT_DATE,
  file_data   TEXT,       -- base64
  file_name   VARCHAR(200),
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── REPORTING ENVIRONNEMENTAL ─────────────────────────────────
CREATE TABLE IF NOT EXISTS reporting_env (
  id           VARCHAR(30) PRIMARY KEY,
  date         DATE        NOT NULL,
  equipe       CHAR(1)     CHECK (equipe IN ('A','B','C','D')),
  redacteur_id VARCHAR(30) REFERENCES operateurs(id) ON DELETE SET NULL,
  lignes       JSONB       NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_reporting_env_date UNIQUE (date)
);
CREATE OR REPLACE TRIGGER trg_reporting_env_upd
  BEFORE UPDATE ON reporting_env FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_rep_env_date ON reporting_env(date DESC);

-- ─── JOURNAL D'AUDIT ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id         VARCHAR(30) PRIMARY KEY,
  user_id    VARCHAR(30),
  user_nom   VARCHAR(150),
  user_poste VARCHAR(30),
  action     VARCHAR(150) NOT NULL,
  resource   VARCHAR(100),
  details    TEXT,
  ip         VARCHAR(50),
  created_at TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit_logs(user_id);

-- ─── CAPTURES SURVEILLANCE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS captures (
  id         VARCHAR(30) PRIMARY KEY,
  source     VARCHAR(20) NOT NULL DEFAULT 'autre'
               CHECK (source IN ('vtmis','ais','radar','camera','autre')),
  comment    TEXT        DEFAULT '',
  data_url   TEXT        NOT NULL,   -- base64 image
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MISSIONS D'ESCORTE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escortes (
  id             VARCHAR(30) PRIMARY KEY,
  num            VARCHAR(30) NOT NULL,
  date           DATE        NOT NULL,
  heure          VARCHAR(10) DEFAULT '',
  type           VARCHAR(20) NOT NULL DEFAULT 'entree'
                   CHECK (type IN ('entree','sortie','aller-retour')),
  equipe         CHAR(1)     CHECK (equipe IN ('A','B','C','D')),
  zone           VARCHAR(200) DEFAULT '',
  rdv            VARCHAR(200) DEFAULT '',
  duree          VARCHAR(50)  DEFAULT '',
  -- Navire à escorter
  cible_nom      VARCHAR(200) NOT NULL,
  cible_mmsi     VARCHAR(20)  DEFAULT '',
  cible_imo      VARCHAR(20)  DEFAULT '',
  cible_cs       VARCHAR(20)  DEFAULT '',
  cible_pavillon VARCHAR(100) DEFAULT '',
  cible_type     VARCHAR(30)  DEFAULT 'cargo',
  cible_loa      NUMERIC,
  cible_gt       NUMERIC,
  cible_draft    VARCHAR(20)  DEFAULT '',
  cible_from     VARCHAR(200) DEFAULT '',
  cible_to       VARCHAR(200) DEFAULT '',
  cible_eta      TIMESTAMPTZ,
  cible_cargo    TEXT         DEFAULT '',
  -- Navire escorteur
  nav_nom        VARCHAR(200) DEFAULT '',
  nav_mmsi       VARCHAR(20)  DEFAULT '',
  nav_cs         VARCHAR(20)  DEFAULT '',
  nav_pavillon   VARCHAR(100) DEFAULT 'Bénin',
  nav_type       VARCHAR(30)  DEFAULT 'patrouilleur',
  nav_loa        NUMERIC,
  nav_cmd        VARCHAR(200) DEFAULT '',
  nav_vhf        VARCHAR(50)  DEFAULT '',
  nav_effectif   INTEGER,
  nav_arm        TEXT         DEFAULT '',
  comment        TEXT         DEFAULT '',
  statut         VARCHAR(20)  NOT NULL DEFAULT 'planifiee'
                   CHECK (statut IN ('planifiee','encours','terminee','annulee')),
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  DEFAULT NOW()
);
CREATE OR REPLACE TRIGGER trg_escortes_upd
  BEFORE UPDATE ON escortes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX IF NOT EXISTS idx_esc_date   ON escortes(date DESC);
CREATE INDEX IF NOT EXISTS idx_esc_statut ON escortes(statut);
