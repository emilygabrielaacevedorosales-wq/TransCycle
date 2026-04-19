-- =============================================================
-- TransCycle & Health — Migración inicial
-- Bloque 1: Esquema base + perfiles farmacocinéticos
-- =============================================================

BEGIN;

-- -------------------------------------------------------------
-- Extensiones
-- -------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------
-- ENUM types
-- -------------------------------------------------------------
CREATE TYPE admin_route AS ENUM (
  'sublingual',
  'intramuscular',
  'transdermal_patch',
  'transdermal_gel',
  'rectal',
  'oral'
);

CREATE TYPE drug_category AS ENUM (
  'estrogen',
  'progestogen',
  'antiandrogen',
  'other'
);

CREATE TYPE body_site_zone AS ENUM (
  'glut_left', 'glut_right',
  'quad_left', 'quad_right',
  'delt_left', 'delt_right',
  'abd_upper_left', 'abd_upper_right',
  'abd_lower_left', 'abd_lower_right',
  'back_left', 'back_right',
  'arm_left', 'arm_right',
  'rectal'
);

CREATE TYPE phase_label AS ENUM (
  'follicular_early',
  'follicular_late',
  'ovulation_virtual',
  'luteal_early',
  'luteal_late',
  'trough'
);

-- -------------------------------------------------------------
-- USERS
-- -------------------------------------------------------------
CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                 TEXT UNIQUE NOT NULL,
  password_hash         TEXT NOT NULL,
  display_name          TEXT NOT NULL,
  pronouns              TEXT,
  timezone              TEXT NOT NULL DEFAULT 'America/Santiago',

  -- Modo discreto
  discrete_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  discrete_app_name     TEXT NOT NULL DEFAULT 'Mi Calendario',
  discrete_icon_key     TEXT NOT NULL DEFAULT 'calendar_default',

  -- Seguridad
  biometric_lock        BOOLEAN NOT NULL DEFAULT FALSE,
  encryption_salt       BYTEA,                          -- sal para clave de cifrado AES derivada de biometría

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------
-- DRUG_PROFILES
-- Perfiles farmacocinéticos de referencia por fármaco/vía
-- -------------------------------------------------------------
CREATE TABLE drug_profiles (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drug_key              TEXT UNIQUE NOT NULL,           -- ej: 'E2_SUBLINGUAL'
  display_name          TEXT NOT NULL,
  category              drug_category NOT NULL,
  route                 admin_route NOT NULL,

  -- Parámetros farmacocinéticos
  half_life_hours       NUMERIC(6,2) NOT NULL,          -- t½ principal
  half_life_secondary_h NUMERIC(6,2),                   -- t½ metabolito activo (ej: canrenoato en espiro)
  peak_hours            NUMERIC(6,2) NOT NULL,          -- tiempo al pico plasmático (tmax)
  trough_fraction       NUMERIC(5,4) NOT NULL DEFAULT 0.05, -- fracción de Cmax considerada valle

  -- Referencia de Cmax por unidad de dosis
  cmax_per_unit         NUMERIC(10,4),                  -- pg/mL por mg (estrógenos) o ng/mL por mg (P4)
  cmax_unit             TEXT NOT NULL DEFAULT 'pg_per_mg',

  -- Solo espironolactona: modelo de supresión androgénica
  is_suppression_model  BOOLEAN NOT NULL DEFAULT FALSE,
  suppression_target    TEXT,                           -- 'testosterone'

  -- Metadatos
  notes                 TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed con los 6 fármacos del proyecto
INSERT INTO drug_profiles
  (drug_key, display_name, category, route,
   half_life_hours, half_life_secondary_h, peak_hours, trough_fraction,
   cmax_per_unit, cmax_unit, is_suppression_model, suppression_target, notes)
VALUES
  -- Estradiol sublingual (vía principal en TRH trans)
  ('E2_SUBLINGUAL',
   'Estradiol sublingual',
   'estrogen', 'sublingual',
   3.0, NULL, 0.75, 0.05,
   350.0, 'pg_per_mg',
   FALSE, NULL,
   'Evita primer paso hepático. Pico muy agudo 30-60min, t½ 2-4h. Típicamente 2-3 tomas/día.'),

  -- Valerato de estradiol IM
  ('E2_VALERATE_IM',
   'Valerato de estradiol (IM)',
   'estrogen', 'intramuscular',
   96.0, NULL, 48.0, 0.10,
   80.0, 'pg_per_mg',
   FALSE, NULL,
   't½ ~4 días. Pico a las 24-72h. Inyección semanal o quincenal según protocolo.'),

  -- Cipionato de estradiol IM
  ('E2_CYPIONATE_IM',
   'Cipionato de estradiol (IM)',
   'estrogen', 'intramuscular',
   168.0, NULL, 72.0, 0.10,
   90.0, 'pg_per_mg',
   FALSE, NULL,
   't½ ~7 días. Liberación más sostenida que valerato. Inyección semanal.'),

  -- Parche transdérmico
  ('E2_PATCH',
   'Estradiol parche transdérmico',
   'estrogen', 'transdermal_patch',
   18.0, NULL, 10.0, 0.30,
   NULL, 'pg_per_patch',
   FALSE, NULL,
   'Steady-state al 2do parche (~día 7). Cmax varía por marca (50-200 pg/mL). Cambiar cada 3-4 días.'),

  -- Progesterona micronizada rectal
  ('P4_RECTAL',
   'Progesterona micronizada (rectal)',
   'progestogen', 'rectal',
   20.0, NULL, 3.5, 0.15,
   8.0, 'ng_per_mg',
   FALSE, NULL,
   'Vía rectal preferida en mujeres trans: evita primer paso hepático y efecto sedante del metabolito oral (alopregnanolona). Absorción sostenida similar a vaginal. t½ efectiva 13-25h.'),

  -- Espironolactona (antiandrogénico)
  ('SPIRO',
   'Espironolactona',
   'antiandrogen', 'oral',
   1.4, 16.0, 2.5, 0.20,
   NULL, 'ng_per_mg',
   TRUE, 'testosterone',
   'Bloqueador de receptor androgénico. t½ propia 1.4h, metabolito activo canrenoato t½ 16h. Modelar como supresión de T, no como nivel hormonal exógeno. Dosis típica 50-200mg/día.');

-- -------------------------------------------------------------
-- HRT_MEDICATIONS
-- Medicamentos activos de la usuaria (su régimen personal)
-- -------------------------------------------------------------
CREATE TABLE hrt_medications (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drug_profile_id       UUID NOT NULL REFERENCES drug_profiles(id),

  -- Configuración personal de dosis
  dose_amount           NUMERIC(8,3) NOT NULL,          -- cantidad por toma
  dose_unit             TEXT NOT NULL DEFAULT 'mg',
  frequency_hours       NUMERIC(6,2) NOT NULL,          -- intervalo entre dosis en horas
  preferred_times       TEXT[],                         -- ej: ['08:00','20:00']

  -- Inventario
  stock_units           NUMERIC(8,2) NOT NULL DEFAULT 0,
  stock_alert_threshold NUMERIC(8,2) NOT NULL DEFAULT 7, -- unidades para alerta de reposición

  -- Estado
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  start_date            DATE NOT NULL,
  end_date              DATE,
  notes_encrypted       BYTEA,                          -- notas cifradas AES-256

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------
-- ADMINISTRATION_LOG
-- Registro de cada toma/inyección/parche aplicado
-- -------------------------------------------------------------
CREATE TABLE administration_log (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication_id         UUID NOT NULL REFERENCES hrt_medications(id),

  administered_at       TIMESTAMPTZ NOT NULL,
  actual_dose           NUMERIC(8,3) NOT NULL,          -- puede diferir de la dosis prescrita
  body_site             body_site_zone,                 -- NULL para rutas no inyectables/parche

  -- Seguimiento de parches: sitio anterior para rotación
  prev_site             body_site_zone,

  reminder_sent         BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_sent_at      TIMESTAMPTZ,
  was_late              BOOLEAN NOT NULL DEFAULT FALSE,  -- administrada fuera de ventana ±2h
  late_minutes          INT,

  notes_encrypted       BYTEA,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------
-- PLASMA_LEVELS
-- Niveles plasmáticos calculados (1 fila por punto temporal)
-- Se genera automáticamente por trigger al insertar en administration_log
-- -------------------------------------------------------------
CREATE TABLE plasma_levels (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  administration_id     UUID NOT NULL REFERENCES administration_log(id) ON DELETE CASCADE,
  drug_profile_id       UUID NOT NULL REFERENCES drug_profiles(id),

  calculated_at         TIMESTAMPTZ NOT NULL,           -- momento al que corresponde el nivel
  hours_post_dose       NUMERIC(8,2) NOT NULL,          -- horas desde la toma
  level_value           NUMERIC(10,4) NOT NULL,         -- pg/mL (E2) o ng/mL (P4) o supresión 0-1 (Spiro)
  level_unit            TEXT NOT NULL DEFAULT 'pg_ml',

  -- Posición en ciclo virtual
  virtual_cycle_day     INT,                            -- 1–28
  phase                 phase_label,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------
-- BODY_MAP_SITES
-- Historial de rotación de sitios de inyección/parche
-- -------------------------------------------------------------
CREATE TABLE body_map_sites (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication_id         UUID NOT NULL REFERENCES hrt_medications(id),
  site_code             body_site_zone NOT NULL,

  last_used_at          TIMESTAMPTZ,
  use_count             INT NOT NULL DEFAULT 0,
  rest_days_required    INT NOT NULL DEFAULT 7,         -- días de descanso recomendados
  is_resting            BOOLEAN NOT NULL DEFAULT FALSE,
  available_from        DATE,                           -- cuándo puede volver a usarse

  UNIQUE(user_id, medication_id, site_code)
);

-- -------------------------------------------------------------
-- SYMPTOM_LOG
-- Diario sintomático diario (campos cifrados)
-- -------------------------------------------------------------
CREATE TABLE symptom_log (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  logged_at             TIMESTAMPTZ NOT NULL,

  -- Escalas 1-10 (0 = no registrado)
  mood_score            SMALLINT CHECK (mood_score BETWEEN 0 AND 10),
  breast_tenderness     SMALLINT CHECK (breast_tenderness BETWEEN 0 AND 10),
  fatigue_level         SMALLINT CHECK (fatigue_level BETWEEN 0 AND 10),
  digestive_changes     SMALLINT CHECK (digestive_changes BETWEEN 0 AND 10),
  libido_score          SMALLINT CHECK (libido_score BETWEEN 0 AND 10),
  skin_changes          SMALLINT CHECK (skin_changes BETWEEN 0 AND 10),
  brain_fog             SMALLINT CHECK (brain_fog BETWEEN 0 AND 10),
  emotional_lability    SMALLINT CHECK (emotional_lability BETWEEN 0 AND 10),

  -- Correlación automática al insertar
  virtual_cycle_day     INT,
  phase                 phase_label,

  freetext_encrypted    BYTEA,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------
-- BLOOD_TESTS
-- Resultados de exámenes de laboratorio
-- -------------------------------------------------------------
CREATE TABLE blood_tests (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  test_date               DATE NOT NULL,
  lab_name                TEXT,

  -- Valores hormonales (NULL si no fue medido)
  estradiol_pg_ml         NUMERIC(10,3),
  testosterone_ng_dl      NUMERIC(10,3),
  prolactin_ng_ml         NUMERIC(10,3),
  lh_miu_ml               NUMERIC(10,3),
  fsh_miu_ml              NUMERIC(10,3),
  progesterone_ng_ml      NUMERIC(10,3),
  shbg_nmol_l             NUMERIC(10,3),

  -- Documento fuente (cifrado)
  document_url_encrypted  BYTEA,
  lab_notes_encrypted     BYTEA,

  -- Relación con dosis al momento del examen
  hours_since_last_dose   NUMERIC(8,2),                 -- importante para interpretar E2

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------
-- VIRTUAL_CYCLE
-- Ciclo aprendido de la usuaria (se refina con cada ciclo)
-- -------------------------------------------------------------
CREATE TABLE virtual_cycle (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cycle_number          INT NOT NULL DEFAULT 1,

  cycle_start_date      DATE NOT NULL,
  cycle_length_days     INT NOT NULL DEFAULT 28,

  -- Parámetros del ciclo aprendido
  follicular_days       INT NOT NULL DEFAULT 14,
  luteal_days           INT NOT NULL DEFAULT 14,
  avg_peak_e2           NUMERIC(10,3),                  -- E2 pico promedio del ciclo
  avg_trough_e2         NUMERIC(10,3),                  -- E2 valle promedio
  avg_peak_p4           NUMERIC(10,3),                  -- P4 pico promedio

  -- Patrón sintomático serializado
  symptom_pattern_json  JSONB,                          -- correlaciones día→síntoma

  -- Confianza del algoritmo (0.0-1.0, sube con más datos)
  confidence_score      NUMERIC(4,3) NOT NULL DEFAULT 0.1,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------
-- EVOLUTION_DIARY
-- Diario de cambios físicos y emocionales (cifrado total)
-- -------------------------------------------------------------
CREATE TABLE evolution_diary (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date                DATE NOT NULL,

  wellbeing_score           SMALLINT CHECK (wellbeing_score BETWEEN 1 AND 10),

  -- Todo cifrado AES-256 con clave derivada de biometría
  body_changes_encrypted    BYTEA,
  emotional_notes_encrypted BYTEA,
  photo_urls_encrypted      BYTEA,                      -- JSON array de URLs cifrado

  virtual_cycle_day         INT,
  phase                     phase_label,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, entry_date)
);

-- -------------------------------------------------------------
-- Índices de rendimiento
-- -------------------------------------------------------------
CREATE INDEX idx_admin_log_user_time      ON administration_log(user_id, administered_at DESC);
CREATE INDEX idx_admin_log_medication     ON administration_log(medication_id, administered_at DESC);
CREATE INDEX idx_plasma_levels_user_time  ON plasma_levels(user_id, calculated_at DESC);
CREATE INDEX idx_plasma_levels_admin      ON plasma_levels(administration_id);
CREATE INDEX idx_symptom_log_user_time    ON symptom_log(user_id, logged_at DESC);
CREATE INDEX idx_blood_tests_user_date    ON blood_tests(user_id, test_date DESC);
CREATE INDEX idx_virtual_cycle_user       ON virtual_cycle(user_id, cycle_number DESC);
CREATE INDEX idx_evolution_diary_user     ON evolution_diary(user_id, entry_date DESC);
CREATE INDEX idx_body_map_user_med        ON body_map_sites(user_id, medication_id);

-- -------------------------------------------------------------
-- Trigger: updated_at automático
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_medications_updated_at
  BEFORE UPDATE ON hrt_medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
