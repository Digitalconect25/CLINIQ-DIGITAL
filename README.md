# CLINIQ DIGITAL v2.0 - Pack de actualizacion

Estructura de este pack (espejo exacto de tu repo):

```
cliniq-v2/
├── 01-migration.sql          Ejecutar en Neon SQL Editor
├── README.md                 Este archivo
├── api/                      Copiar a /api/ del repo
│   ├── _pin.js               NUEVO
│   ├── _cache.js             NUEVO
│   ├── auth-pin.js           NUEVO
│   ├── briefs.js             NUEVO
│   └── generate.js           REEMPLAZA el existente
└── src/                      Copiar a /src/ del repo
    ├── PinGate.jsx           NUEVO
    ├── BriefEditor.jsx       NUEVO
    ├── main.jsx              REEMPLAZA el existente
    └── CliniqPlatform.jsx    REEMPLAZA el existente
```

Todos los archivos JSX y JS estan validados con parser. No hace falta editar ni una linea.

---

## Que trae v2.0

- **PIN de acceso al equipo**. La app deja de estar abierta a internet.
- **Cache de IA en Neon**. Cualquier prompt repetido se sirve sin pagar al modelo.
- **Briefs por cliente**. Cada cliente puede tener un brief de 14 campos que se inyecta automaticamente en TODAS las herramientas.
- **5 nichos nuevos no-salud**: reformas, restaurantes, academias, comercio local, servicios profesionales.
- **Clausula sanitaria condicional**: deja de meter reglas de AEMPS cuando el cliente es de reformas.
- **CORS cerrado**: solo tu dominio puede llamar a tus endpoints.

---

## ORDEN DE APLICACION

### PASO 1 - Variables de entorno en Vercel

Settings > Environment Variables. Anade DOS nuevas:

| Variable | Valor |
|----------|-------|
| `ACCESS_PIN` | Eliges tu PIN, minimo 8 caracteres. Ej: `Cliniq2026!` |
| `ALLOWED_ORIGIN` | `https://cliniq-digital.vercel.app` (o tu dominio real) |

No toques las que ya existen (ANTHROPIC_API_KEY, GROQ_API_KEY, DEEPSEEK_API_KEY, FAL_KEY, DATABASE_URL).

### PASO 2 - Migracion SQL en Neon

Abre `01-migration.sql`, copia todo el contenido, pegalo en Neon SQL Editor y pulsa Run. Al final veras una fila con cuatro 1s. Si los cuatro estan en 1, perfecto.

### PASO 3 - Subir archivos al repo

Copia los 9 archivos a las rutas exactas del repo (mismo path que en este pack):

- 5 archivos en `/api/`
- 4 archivos en `/src/`

### PASO 4 - Anadir 2 lineas a tus endpoints existentes

En CADA uno de estos archivos del repo: `api/clients.js`, `api/activity.js`, `api/tasks.js`, `api/image.js`, anade al principio:

```js
import { requirePin, corsHeaders } from './_pin.js';
```

Y justo despues de las cabeceras CORS o al inicio del handler, anade:

```js
if (!requirePin(req, res)) return;
```

Excepcion: en `api/client-view.js` solo proteges el POST. El GET sigue publico para que los clientes puedan abrir su enlace:

```js
if (req.method === 'POST' && !requirePin(req, res)) return;
```

### PASO 5 - Deploy

Push a GitHub. Vercel deploya solo en 1-2 minutos.

### PASO 6 - Verificacion

1. Abre `https://cliniq-digital.vercel.app`
2. Te sale la pantalla negra "Acceso del equipo". Introduces el PIN.
3. Vas a "Clientes", abres uno y pulsas "Brief IA" (boton morado).
4. Rellenas el brief y guardas.
5. Vas a "Landing Pages", seleccionas ese cliente y generas una landing.
6. Genera la misma landing otra vez con los mismos datos: deberia ser INSTANTANEA (cache hit).

Si los 6 pasos funcionan, version v2.0 desplegada con exito.

---

## Si algo falla

- **Pantalla en blanco tras introducir PIN**: el PIN no coincide con `ACCESS_PIN` de Vercel. Revisa el valor exacto.
- **"No autorizado" en endpoints**: el interceptor de main.jsx no envia el header. Abre DevTools (F12) > Network > recarga y revisa que las llamadas a `/api/` llevan `X-Cliniq-Pin`.
- **El cache nunca hace hit**: normal las primeras semanas. Solo hay hit con prompts byte-a-byte identicos.
- **El brief no se inyecta**: el matching es por nombre exacto. El "Centro" que escribes en la herramienta debe coincidir letra a letra con el nombre del cliente registrado.
- **SQL falla con "relation clients does not exist"**: estas apuntando a una base distinta a la real. Verifica `DATABASE_URL` en Vercel.

---

## Ver el ahorro del cache

A los 7 dias, pega esta query en Neon:

```sql
SELECT
  proveedor,
  modelo,
  COUNT(*) as entradas_cache,
  SUM(hits) as veces_servido,
  SUM(hits) - COUNT(*) as ahorros_efectivos
FROM cache_ia
GROUP BY proveedor, modelo
ORDER BY ahorros_efectivos DESC;
```

Te dice cuantas veces el cache evito una llamada de pago.
