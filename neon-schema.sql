-- =============================================
-- CLINIQ DIGITAL - ESQUEMA NEON POSTGRESQL
-- Ejecutar en Neon SQL Editor (console.neon.tech)
-- =============================================

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  nif TEXT,
  dir_fiscal TEXT,
  cp_fiscal TEXT,
  ciudad_fiscal TEXT,
  provincia_fiscal TEXT,
  email TEXT,
  telefono TEXT,
  web TEXT,
  contacto TEXT,
  cargo_contacto TEXT,
  nicho TEXT,
  plan TEXT DEFAULT 'Esencial',
  servicios TEXT,
  forma_pago TEXT DEFAULT 'Transferencia',
  iban TEXT,
  fecha_alta DATE DEFAULT CURRENT_DATE,
  notas TEXT,
  empresa TEXT DEFAULT 'Cliniq Digital',
  email_empresa TEXT DEFAULT 'info@cliniqdigital.com',
  tel_empresa TEXT,
  cif_empresa TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de registro de actividad (log de consultas IA)
CREATE TABLE IF NOT EXISTS activity_log (
  id BIGSERIAL PRIMARY KEY,
  tool TEXT NOT NULL,
  client_name TEXT DEFAULT 'Sin asignar',
  inputs JSONB DEFAULT '{}',
  preview TEXT,
  full_output TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de estados de plataformas por cliente (Scan Presencia)
CREATE TABLE IF NOT EXISTS platform_statuses (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT REFERENCES clients(id) ON DELETE CASCADE,
  platform_id TEXT NOT NULL,
  status TEXT DEFAULT 'unknown' CHECK (status IN ('unknown', 'ok', 'warning', 'missing')),
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, platform_id)
);

-- Tabla de tareas de implementacion por cliente
CREATE TABLE IF NOT EXISTS implementation_tasks (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT REFERENCES clients(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  priority TEXT DEFAULT 'media' CHECK (priority IN ('alta', 'media', 'baja')),
  title TEXT NOT NULL,
  time_estimate TEXT,
  impact TEXT,
  platform TEXT,
  done BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indices para busquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_activity_log_client ON activity_log(client_name);
CREATE INDEX IF NOT EXISTS idx_activity_log_tool ON activity_log(tool);
CREATE INDEX IF NOT EXISTS idx_activity_log_date ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_nombre ON clients(nombre);
CREATE INDEX IF NOT EXISTS idx_platform_statuses_client ON platform_statuses(client_id);
CREATE INDEX IF NOT EXISTS idx_implementation_tasks_client ON implementation_tasks(client_id);

-- Trigger para updated_at automatico en clients
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clients_updated_at ON clients;
CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
