-- ============================================================
-- CLINIQ DIGITAL - Migracion v2.0
-- Pegar tal cual en Neon SQL Editor y ejecutar
-- ============================================================

CREATE TABLE IF NOT EXISTS cache_ia (
  hash_clave TEXT PRIMARY KEY,
  proveedor TEXT,
  modelo TEXT,
  prompt_resumen TEXT,
  resultado TEXT,
  tokens_input INT DEFAULT 0,
  tokens_output INT DEFAULT 0,
  hits INT DEFAULT 1,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cache_ia_expires ON cache_ia(expires_at);

CREATE TABLE IF NOT EXISTS client_briefs (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT REFERENCES clients(id) ON DELETE CASCADE,
  nicho_slug TEXT,
  brief JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id)
);
CREATE INDEX IF NOT EXISTS idx_client_briefs_client ON client_briefs(client_id);

ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS est_cost NUMERIC(10,5) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_hit BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tokens_input INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_output INT DEFAULT 0;

SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name='cache_ia') AS cache_ia_existe,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name='client_briefs') AS briefs_existe,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='activity_log' AND column_name='cache_hit') AS cache_hit_existe,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='activity_log' AND column_name='provider') AS provider_existe
;
