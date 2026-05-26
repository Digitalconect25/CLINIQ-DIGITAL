# Diseño: Consolidación de herramientas en Hubs — Cliniq Digital

**Fecha:** 2026-05-26
**Estado:** Aprobado (diseño) — pendiente plan de implementación

## 1. Contexto y objetivo

Cliniq Digital tiene hoy ~28 herramientas en el menú lateral, repartidas en 6 grupos
(Producción, Inteligencia, Presencia Digital, Crecimiento, Estrategia, Gestión). Muchas
comparten el mismo input (cliente, nicho, ciudad, web) y se solapan en su propósito.

**Objetivo:** que el usuario introduzca los datos del cliente **una sola vez** y obtenga
**varios entregables juntos**, reduciendo el menú de 28 a ~6 hubs. "Un input → varios
resultados".

## 2. Problema actual

- Demasiadas entradas de menú; difícil de navegar.
- El mismo dato (cliente/nicho/ciudad) se reintroduce en cada herramienta.
- Solapamiento fuerte: Scan 360, Análisis Profundo, Auditoría Digital, Auditoría NAP,
  Competencia, Reputación y Monitor de Marca son todas "investigación de presencia".

## 3. Arquitectura (reutilizar, no reescribir)

Hoy cada herramienta es un componente React que llama a `ai()` o `aiSearch()` con un
`system` prompt y una plantilla de prompt. La consolidación introduce **un componente
`Hub` genérico** parametrizado por una lista de **secciones**:

```js
// Config de una sección (se extrae tal cual de las herramientas actuales)
{
  key: "competencia",
  label: "Competencia Local",
  web: true,                       // true => aiSearch (Gemini grounding); false => ai()
  essential: true,                 // entra en el preset "Generar lo esencial"
  system: "Analista de competencia digital en 2026.",
  buildPrompt: (inp) => `Analisis competencia para ${inp.cliente} en ${inp.geo}...`,
}
```

- Los `system`/`buildPrompt` se **copian de las herramientas existentes** → mismos
  resultados, solo reorganizados. No se inventan prompts nuevos.
- Cada hub = una instancia de `Hub` con su array de secciones.
- El routing de proveedor NO cambia: `web:true` → `aiSearch` (Gemini grounding, gratis);
  `web:false` → `ai()` (Gemini/Groq según `pickModel`).

## 4. UX del hub

1. **Inputs comunes arriba, una sola vez:** selector de cliente (autorrellena nicho/
   ciudad desde el Brief de v2), nicho, ciudad/provincia, servicio, web.
2. **Casillas** con las secciones del hub (marcables).
3. **Botones:** "Generar seleccionadas" y "Generar lo esencial" (marca las secciones con
   `essential:true`).
4. **Salida apilada:** cada sección genera y se añade al área de resultados con su título,
   estado (buscando/analizando/hecho) y su botón Copiar/Imprimir.

## 5. Flujo de datos, coste y errores

- Las secciones marcadas se ejecutan **secuencialmente** (respeta el límite de la capa
  gratis de Gemini/Groq), con indicador de progreso por sección.
- El Brief del cliente se autoinyecta vía `buildSys` (ya existe).
- **Manejo de errores aislado:** si una sección falla (p. ej. rate limit), se muestra el
  error solo en esa sección; las demás continúan. Se reaprovecha el retry existente de
  `aiSearch`.
- Las secciones `web:true` no se cachean (ya garantizado por `!body.web_search`).

## 6. Mapa de los 6 hubs

| Hub | Absorbe |
|---|---|
| **1. Diagnóstico 360** (web) | Scan Presencia 360, Análisis Profundo, Auditoría Digital, Auditoría NAP, Competencia Local, Reputación, Monitor de Marca |
| **2. Estudio de Contenido** | Landing Pages, Contenido SEO, Arquitectura Web, Scripts Vídeo, Prompts Imagen IA, Estrategia Redes, Multiplicador |
| **3. Presencia Local** | Google Business, SEO Voz, Expansión Plataformas |
| **4. Captación & Conversión** | WhatsApp, Secuencias Seguimiento, Respuesta Reseñas, Propuestas, Campañas, Meta Ads |
| **5. Estrategia & Reporte** | Reporting Mensual, Manual Comunicación, Hub Implementación, Dashboard |
| **6. Gestión** | Clientes/Facturación, Tareas, Verificador Normativo, Perfiles (externo) |

## 7. Piloto: Hub "Diagnóstico 360"

Primer hub a construir y validar antes de replicar el patrón.

**Inputs comunes:** cliente, nicho, ciudad, provincia, web.

**Secciones** (todas `web:true`, copiadas de las herramientas actuales):

| key | label | essential |
|---|---|---|
| scan360 | Scan Presencia 360 | ✓ |
| deepweb | Análisis Profundo Web | |
| auditoria | Auditoría Digital | ✓ |
| competencia | Competencia Local | ✓ |
| nap | Auditoría NAP/Citations | |
| reputacion | Reputación y Reseñas | ✓ |
| marca | Monitor de Marca | |

**"Generar lo esencial"** marca: scan360 + auditoria + competencia + reputacion.

## 8. Estrategia de migración (sin romper nada)

1. Construir `Hub` genérico + instancia "Diagnóstico 360" **junto a** las herramientas
   actuales (nuevo ítem de menú), sin tocar las viejas.
2. Validar en preview (PR) con el PIN.
3. Si OK, replicar los otros 5 hubs.
4. Retirar del menú las herramientas individuales ya absorbidas (el código de secciones
   queda reutilizado por los hubs).

## 9. Fuera de alcance (YAGNI)

- Migrar imágenes FAL a gratis (fase aparte).
- Asistente conversacional (enfoque C, descartado por ahora).
- Cambios en el modelo de datos / Brief (se reutiliza el existente).

## 10. Criterios de éxito

- Menú reducido de 28 a ~6 entradas.
- Desde un hub, con los datos introducidos una vez, se generan ≥3 entregables en una sola
  acción ("Generar lo esencial").
- Mismos resultados de calidad que las herramientas originales (prompts reutilizados).
- Coste 0 mantenido (Groq + Gemini).
- Ninguna herramienta existente deja de funcionar durante la migración.
