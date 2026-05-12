// Helper de conexion a Neon PostgreSQL (uso BACKEND, dentro de /api)
// IMPORTANTE: este archivo debe estar en /api/_db.js, NO en /src/
// El de /src/db.js es distinto: ese hace fetch a estos endpoints

import { neon } from '@neondatabase/serverless';

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no esta configurada en el servidor');
  }
  return neon(process.env.DATABASE_URL);
}
