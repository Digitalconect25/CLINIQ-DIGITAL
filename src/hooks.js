import { useState, useEffect } from 'react';
import { db } from './db.js';

/* -- CLIENTS HOOK -- */
export function useClients(initialClients = []) {
  const [clients, setClients] = useState(initialClients);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => { loadClients(); }, []);

  const loadClients = async () => {
    const data = await db.getClients();
    if (data && data.length > 0) {
      // Map DB column names (snake_case) to app names (camelCase)
      setClients(data.map(mapClientFromDb));
      setDbReady(true);
    }
    setLoading(false);
  };

  const addClient = async (client) => {
    const saved = await db.createClient(client);
    if (saved) {
      const mapped = mapClientFromDb(saved);
      setClients(prev => [mapped, ...prev]);
      return mapped;
    } else {
      // Fallback local
      const local = { ...client, id: Date.now() };
      setClients(prev => [local, ...prev]);
      return local;
    }
  };

  const updateClient = async (id, updates) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    await db.updateClient(id, updates);
  };

  const deleteClient = async (id) => {
    setClients(prev => prev.filter(c => c.id !== id));
    await db.deleteClient(id);
  };

  return { clients, loading, dbReady, addClient, updateClient, deleteClient, refresh: loadClients };
}

/* -- ACTIVITY LOG HOOK -- */
export function useActivityLog() {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLog(); }, []);

  const loadLog = async () => {
    const data = await db.getActivity();
    if (data) setLog(data.map(mapLogFromDb));
    setLoading(false);
  };

  const addEntry = async (entry) => {
    // Save to DB
    const saved = await db.logActivity(entry);
    const mapped = saved ? mapLogFromDb(saved) : {
      ...entry, id: Date.now(), date: new Date().toISOString()
    };
    setLog(prev => [mapped, ...prev]);
    return mapped;
  };

  const getForClient = (clientName) => {
    if (!clientName || clientName === 'all') return log;
    return log.filter(e => e.client === clientName);
  };

  return { log, loading, addEntry, getForClient, refresh: loadLog };
}

/* -- MAPPERS (snake_case DB -> camelCase App) -- */
function mapClientFromDb(row) {
  return {
    id: row.id,
    nombre: row.nombre || '',
    nif: row.nif || '',
    dirFiscal: row.dir_fiscal || '',
    cpFiscal: row.cp_fiscal || '',
    ciudadFiscal: row.ciudad_fiscal || '',
    provinciaFiscal: row.provincia_fiscal || '',
    email: row.email || '',
    telefono: row.telefono || '',
    web: row.web || '',
    contacto: row.contacto || '',
    cargoContacto: row.cargo_contacto || '',
    nicho: row.nicho || '',
    plan: row.plan || 'Esencial',
    servicios: row.servicios || '',
    formaPago: row.forma_pago || 'Transferencia',
    iban: row.iban || '',
    fechaAlta: row.fecha_alta || '',
    notas: row.notas || '',
    empresa: row.empresa || 'Cliniq Digital',
    emailEmpresa: row.email_empresa || 'info@cliniqdigital.com',
    telEmpresa: row.tel_empresa || '',
    cifEmpresa: row.cif_empresa || '',
    createdAt: row.created_at || '',
  };
}

function mapLogFromDb(row) {
  return {
    id: row.id,
    date: row.created_at || new Date().toISOString(),
    tool: row.tool || 'IA',
    client: row.client_name || 'Sin asignar',
    inputs: typeof row.inputs === 'string' ? JSON.parse(row.inputs) : (row.inputs || {}),
    preview: row.preview || '',
    fullOutput: row.full_output || '',
  };
}
