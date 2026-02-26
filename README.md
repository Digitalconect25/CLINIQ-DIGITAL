# CLINIQ DIGITAL - Plataforma de Marketing IA

## Arquitectura

```
cliniq-deploy/
├── api/
│   ├── _db.js               # Conexion Neon PostgreSQL (compartida)
│   ├── generate.js           # Proxy seguro a Anthropic API
│   ├── clients.js            # CRUD clientes (GET/POST/PUT/DELETE)
│   └── activity.js           # Log de actividad IA (GET/POST)
├── src/
│   ├── CliniqPlatform.jsx    # App completa (23 herramientas)
│   ├── db.js                 # Cliente API para el frontend
│   ├── hooks.js              # React hooks para datos
│   └── main.jsx              # Entry point
├── supabase-schema.sql       # SQL para crear tablas en Neon
├── vercel.json               # Config Vercel
└── .env.example              # Variables de entorno
```

## DESPLIEGUE

### 1. CREAR TABLAS EN NEON

1. Ve a https://console.neon.tech
2. Abre tu proyecto cliniq-digital
3. Clic en "SQL Editor" (menu lateral)
4. Copia y pega TODO el contenido de supabase-schema.sql
5. Clic en "Run"

### 2. DESPLEGAR EN VERCEL

Opcion A: GitHub (recomendado)
1. Sube este proyecto a GitHub
2. Ve a vercel.com > "Add New Project" > Importa el repo
3. Framework: Vite
4. Environment Variables:
   - ANTHROPIC_API_KEY = sk-ant-...
   - DATABASE_URL = postgresql://neondb_owner:...@ep-xxxxx.aws.neon.tech/neondb?sslmode=require
5. Deploy

Opcion B: Vercel CLI
```bash
npm i -g vercel
cd cliniq-deploy
vercel
vercel env add ANTHROPIC_API_KEY
vercel env add DATABASE_URL
vercel --prod
```

### 3. VERIFICAR

1. Abre la URL de Vercel
2. Ve a Gestion de Clientes > crea un cliente
3. Recarga la pagina: el cliente debe seguir ahi (Neon)
4. Genera contenido con cualquier herramienta
5. Ve al Registro de Actividad: la consulta queda guardada

## VARIABLES DE ENTORNO

| Variable | Descripcion |
|---|---|
| ANTHROPIC_API_KEY | Clave API de Anthropic (servidor) |
| DATABASE_URL | Connection string de Neon PostgreSQL (servidor) |

Ambas son server-side: NUNCA se exponen al navegador.

## DESARROLLO LOCAL

```bash
npm install
cp .env.example .env.local
# Edita .env.local con tus credenciales
npx vercel dev
```
