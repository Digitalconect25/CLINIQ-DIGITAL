// ProjectStudio.jsx - Estudio de Proyecto Conecta Nex
// Diseno editorial. Tipografia mixta: Fraunces (display) + DM Sans (body).
// Flujo: idea -> propuesta IA -> entregables -> presentacion al cliente

import { useState, useEffect, useRef } from "react";
import { db } from "./db.js";

const C = {
  bg:"#0B0F1A", sf:"#111827", sf2:"#1A2236", bd:"#2A3550",
  teal:"#2DD4BF", tealD:"#14B8A6", gold:"#F5C563", blue:"#60A5FA",
  purple:"#A78BFA", rose:"#FB7185", green:"#4ADE80", cyan:"#22D3EE",
  w:"#F1F5F9", tx:"#94A3B8", txD:"#475569", red:"#EF4444",
  ink:"#020617"
};

// Tipos de entregables que la IA puede sugerir
const DELIVERABLE_TYPES = {
  landing:    { lb:"Landing Page",       cl:C.blue,   ic:"◧", tool:"Landing Pages",       est:"3-5 min" },
  whatsapp:   { lb:"Protocolo WhatsApp", cl:C.green,  ic:"◩", tool:"Protocolos WhatsApp", est:"1-2 min" },
  seo:        { lb:"Artículo SEO",       cl:C.purple, ic:"◨", tool:"Contenido SEO",       est:"3-5 min" },
  social:     { lb:"Estrategia Redes",   cl:C.purple, ic:"◉", tool:"Estrategia Redes",    est:"3-5 min" },
  video:      { lb:"Scripts Vídeo",      cl:"#FB923C",ic:"▶", tool:"Scripts Vídeo",       est:"2-3 min" },
  gbp:        { lb:"Google Business",    cl:C.gold,   ic:"◎", tool:"Google Business",     est:"2-3 min" },
  followup:   { lb:"Secuencia Emails",   cl:C.rose,   ic:"◬", tool:"Secuencias Seguimiento", est:"2-3 min" },
  webstruct:  { lb:"Arquitectura Web",   cl:C.blue,   ic:"⬡", tool:"Arquitectura Web",    est:"3-5 min" },
  proposal:   { lb:"Propuesta Comercial",cl:C.gold,   ic:"◰", tool:"Propuestas Comerciales", est:"3-5 min" },
  campaign:   { lb:"Campaña Multicanal", cl:C.rose,   ic:"⊕", tool:"Campañas Multicanal", est:"4-6 min" },
  metaads:    { lb:"Campaña Meta Ads",   cl:C.blue,   ic:"◎", tool:"Meta Ads Pro",        est:"4-6 min" },
  segmentation:{lb:"Segmentación Meta",  cl:C.teal,   ic:"⊙", tool:"Meta Ads Pro",        est:"3-4 min" },
  manual:     { lb:"Manual Comunicación",cl:C.gold,   ic:"◳", tool:"Manual Comunicación", est:"3-5 min" },
};

// Plantillas rapidas de prompt
const QUICK_TEMPLATES = [
  { lb:"Campaña Meta con segmentación", txt:"[Cliente] necesita campaña Meta Ads para captar [tipo de lead]. Presupuesto [X] EUR/mes. Publico objetivo: [edad, genero, perfil]. Zona: [ciudad o radio km]. Quiero estructura completa con segmentacion detallada, 3 copys distintos y briefing de creatividades." },
  { lb:"Lanzamiento de servicio",    txt:"[Cliente] quiere lanzar [servicio]. Necesito landing, 5 posts redes, secuencia WhatsApp y campaña Meta Ads. Presupuesto ads [X] EUR/mes. Publico [edad, perfil]. Zona [ciudad]." },
  { lb:"Reactivar pacientes/leads",  txt:"[Cliente] quiere reactivar antiguos contactos. Necesito secuencia email 5 toques, protocolo WhatsApp, segmentacion Meta de retargeting basada en base de datos." },
  { lb:"Posicionar nuevo profesional",txt:"[Cliente] incorpora a [Dr/a. X]. Necesito post presentacion, scripts video presentacion, landing especialidad y campaña Meta local de presentacion." },
  { lb:"Auditoria + plan",           txt:"[Cliente] necesita diagnostico completo. Auditoria digital, analisis competencia, plan de implementacion 90 dias con presupuestos por canal." },
];

export default function ProjectStudio({ setAct }){
  const [step, setStep] = useState("compose");  // compose | analyzing | board | generating | done | present
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [brief, setBrief] = useState("");
  const [deliverables, setDeliverables] = useState([]);
  const [presentSlide, setPresentSlide] = useState(0);
  const [savedProjects, setSavedProjects] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(()=>{
    db.getClients().then(d=>setClients(d||[]));
    try{
      const raw = localStorage.getItem("cliniq_projects") || "[]";
      setSavedProjects(JSON.parse(raw));
    }catch{}
  },[]);

  // Inyectar estilos editoriales (Fraunces + decoraciones)
  useEffect(()=>{
    const linkId = "fraunces-font";
    if(!document.getElementById(linkId)){
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&display=swap";
      document.head.appendChild(link);
    }
    const styleId = "studio-styles";
    if(!document.getElementById(styleId)){
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        .studio-display{font-family:'Fraunces',Georgia,serif;font-feature-settings:'ss01','ss02';letter-spacing:-0.02em}
        .studio-body{font-family:'DM Sans',system-ui,sans-serif}
        .studio-mono{font-family:'JetBrains Mono','SF Mono',Consolas,monospace;letter-spacing:-0.02em}
        @keyframes studioFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes studioGrainShift{0%,100%{transform:translate(0,0)}25%{transform:translate(-3px,2px)}50%{transform:translate(2px,-3px)}75%{transform:translate(-2px,-2px)}}
        .studio-fadein{animation:studioFadeIn 0.6s cubic-bezier(0.16,1,0.3,1) both}
        .studio-grain{background-image:radial-gradient(circle at 1px 1px,rgba(255,255,255,0.04) 1px,transparent 0);background-size:24px 24px;animation:studioGrainShift 8s ease-in-out infinite}
        .studio-pulse{animation:studioPulse 2s ease-in-out infinite}
        @keyframes studioPulse{0%,100%{opacity:0.6}50%{opacity:1}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .studio-shimmer{background:linear-gradient(90deg,${C.sf2} 0%,${C.bd} 50%,${C.sf2} 100%);background-size:200% 100%;animation:shimmer 2s linear infinite}
      `;
      document.head.appendChild(style);
    }
  },[]);

  const selectedClient = clients.find(c=>String(c.id)===String(clientId));

  // Llamar a la IA para que proponga entregables segun el brief
  const analyzeBrief = async () => {
    if(!brief.trim() || !selectedClient){
      alert("Selecciona cliente y describe el proyecto antes de analizar");
      return;
    }
    setStep("analyzing");
    const typesJSON = JSON.stringify(Object.keys(DELIVERABLE_TYPES));
    const system = `Eres director creativo senior de la agencia Conecta Nex. AÑO ACTUAL: 2026.
Tu rol: leer un brief de proyecto y descomponerlo en entregables concretos.
Devuelves SIEMPRE JSON valido (sin markdown, sin texto extra), array de entregables.
Tipos validos: ${typesJSON}.
Espanol de Espana, sin emojis, sin asteriscos.`;

    const userMsg = `CLIENTE: ${selectedClient.nombre}
NICHO: ${selectedClient.nicho || "[completar]"}
CIUDAD: ${selectedClient.ciudad_fiscal || selectedClient.ciudadFiscal || "[completar]"}

BRIEF DEL PROYECTO:
"""
${brief}
"""

INSTRUCCIONES:
1. Analiza el brief y propone entre 3 y 8 entregables concretos que la agencia debe producir.
2. Cada entregable usa exactamente uno de los tipos validos.
3. Para cada uno, da un titulo corto y descriptivo (max 50 caracteres) y un detalle de produccion (max 250 caracteres) que explique QUE debe contener y a QUE audiencia se dirige.
4. Ordenalos en orden logico de produccion.

Devuelve SOLO este JSON, sin texto antes ni despues:
[
  {"type":"landing","title":"...","detail":"..."},
  {"type":"whatsapp","title":"...","detail":"..."}
]`;

    try{
      const r = await fetch("/api/generate", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          provider:"anthropic",
          model:"claude-sonnet-4-20250514",
          max_tokens:2048,
          stream:false,
          system,
          messages:[{role:"user", content:userMsg}],
          hint:"Project Studio - Analisis"
        })
      });
      const data = await r.json();
      let text = data.content?.[0]?.text || "";
      // Limpiar posible markdown fence
      text = text.replace(/```json|```/g, "").trim();
      // Buscar el JSON dentro
      const m = text.match(/\[[\s\S]*\]/);
      const json = m ? m[0] : text;
      let parsed;
      try{
        parsed = JSON.parse(json);
      }catch(e){
        alert("La IA devolvio una respuesta no valida. Intenta de nuevo.");
        setStep("compose");
        return;
      }
      const items = parsed
        .filter(it => it && DELIVERABLE_TYPES[it.type])
        .map((it,i) => ({
          id: Date.now()+i,
          type: it.type,
          title: it.title || DELIVERABLE_TYPES[it.type].lb,
          detail: it.detail || "",
          status: "pending",   // pending | generating | done | error
          content: "",
        }));
      if(items.length === 0){
        alert("La IA no propuso entregables. Reformula el brief con mas detalle.");
        setStep("compose");
        return;
      }
      setDeliverables(items);
      if(!projectName){
        setProjectName(`Proyecto ${selectedClient.nombre.split(" ")[0]} - ${new Date().toLocaleDateString("es-ES",{day:"2-digit",month:"short"})}`);
      }
      setStep("board");
    }catch(e){
      alert("Error de conexion: " + e.message);
      setStep("compose");
    }
  };

  // Construye prompt especifico por tipo de entregable
  const buildSystemPrompt = (item) => {
    const niche = selectedClient.nicho || "Servicio profesional";
    const geo = (selectedClient.ciudad_fiscal||selectedClient.ciudadFiscal||"Espana");
    const provincia = selectedClient.provincia_fiscal||selectedClient.provinciaFiscal||"";
    const baseContext = `Cliente: ${selectedClient.nombre}. Nicho: ${niche}. Ciudad: ${geo}${provincia?", "+provincia:""}. AÑO ACTUAL: 2026.`;
    const baseStyle = `Espanol de Espana, comillas rectas, sin emojis, sin asteriscos, sin markdown. Si faltan datos del cliente, marca como [COMPLETAR]. Tono profesional pero cercano.`;

    switch(item.type){

      case "metaads": return `Eres media buyer senior con 10 anos en Meta Ads para negocios locales en Espana. Has gestionado mas de 500.000 EUR de inversion publicitaria en ${niche}. ${baseContext}

BIBLIOTECA INTERNA META ADS ESPANA 2026 (usar como referencia, no copiar literal):

CPL BENCHMARKS ESPANA 2026 POR NICHO:
- Reformas y construccion: 18-45 EUR (alto ticket compensa)
- Dental/estetica dental: 12-28 EUR
- Estetica y belleza: 8-22 EUR
- Fisioterapia/clinicas: 10-25 EUR
- Restaurantes: 3-8 EUR (lead a reserva)
- Academias y formacion: 8-18 EUR
- Inmobiliaria: 15-40 EUR
- Servicios profesionales B2B: 25-60 EUR
- Telecom/fibra: 12-25 EUR
- Ecommerce moda/hogar: 4-12 EUR CPA

OBJETIVOS META 2026: usar nomenclatura ODAX nueva. Objetivos vigentes son Awareness, Trafico, Interaccion, Leads, Promocion de la app, Ventas. Usa el correcto.

REGLAS CRITICAS DE LA PLATAFORMA META 2026:
- Advantage+ Shopping Campaigns: usar para ecommerce con catalogo, mejor performance que campanas manuales para conversiones de compra
- Advantage Detailed Targeting: Meta expandira audiencias automaticamente, no luchar contra ello, dejarlo activado por defecto
- Advantage+ Placements: dejar todos los placements activos salvo Audience Network si el cliente prioriza calidad de lead
- Para audiencias < 1M Meta tiene poca senal, mejor usar Lookalike o broad con Advantage
- Regla 50: cada ad set necesita 50+ conversiones/semana para optimizar bien
- Aprendizaje en 7 dias: no tocar ads en aprendizaje, espera fase Active
- CBO (Campaign Budget Optimization) ahora es Advantage Campaign Budget, activar si tienes 3+ ad sets
- iOS 14.5+: pixel events post-click solo confirmable con CAPI (Conversions API), recomendar instalacion CAPI siempre
- Apple ATT y limite SKAdNetwork: atribuciones de 1d-click y 7d-click son las fiables, modeled 28d-click solo para tendencia
- En 2026 Meta penaliza fuerte ads de baja calidad: priorizar Performance Score 4+
- Frequency cap: alertar cuando frequency > 2.5 en frio o > 4 en retargeting

INTERESES META REALES POR NICHO (sugerir entre estos, marcar [VERIFICAR EN META] siempre):

Reformas:
- "Reformas del hogar", "Decoracion del hogar", "Cocinas (mueble)", "Banos (decoracion)", "Hipoteca", "Propietarios de viviendas", "Constructor", "Leroy Merlin", "IKEA", "Pinterest", "Casa y jardin", "Diseno de interiores"

Dental:
- "Implantes dentales", "Ortodoncia", "Blanqueamiento dental", "Estetica dental", "Salud dental", "Vitaldent", "Dentix", "Sonrisa", "Clinicas dentales", "Carillas dentales", "Invisalign"

Estetica:
- "Botox", "Acido hialuronico", "Depilacion laser", "Tratamientos faciales", "Medicina estetica", "Belleza", "Antiaging", "Mesoterapia", "Hilos tensores"

Fisio/salud:
- "Fisioterapia", "Lesiones deportivas", "Dolor de espalda", "Osteopatia", "Quiropractica", "Pilates", "Yoga", "Recuperacion deportiva"

Restaurantes:
- "Restaurantes", "Comida [tipo]", "Cocina mediterranea", "Foodie", "El Tenedor", "TripAdvisor", "Pareja", "Salir a cenar"

Academias:
- "Educacion", "Formacion profesional", "Oposiciones", "Idiomas", "Universidad", "Cambridge English", "EOI", "Ensenanza online"

Inmobiliaria:
- "Compra de vivienda", "Hipoteca", "Idealista", "Fotocasa", "Inversion inmobiliaria", "Alquiler", "Mudanza"

Si el nicho no esta listado, propone intereses logicos basados en el comportamiento del comprador en ese sector.

ESTRUCTURA DE CAMPANA RECOMENDADA 2026:
- Una sola campana por objetivo (no fragmentar)
- 2-4 ad sets dentro de la campana: broad + 1 lookalike + 1 retargeting (minimo)
- 3-4 anuncios por ad set, todos con variantes A/B reales
- Advantage Campaign Budget activado
- Optimizacion por conversion mas valiosa (Lead form completado, Compra, etc)
- Atribucion: 7-day click, 1-day view (default 2026)

------

PRODUCE una propuesta de campaña Meta Ads completa, lista para pegar en Ads Manager, estructura exacta:

1. RESUMEN EJECUTIVO (4-6 lineas)
   - Objetivo de negocio del cliente
   - Que vamos a hacer con la campana
   - Por que va a funcionar en este nicho/geo segun benchmarks 2026
   - Cuanto cuesta y cuanto se espera de retorno

2. OBJETIVO META Y ESTRUCTURA
   - Objetivo ODAX exacto (Leads / Ventas / Interaccion / etc). Justifica desde el brief.
   - Si es ecommerce con catalogo, evalua Advantage+ Shopping Campaigns
   - Numero de ad sets propuesto (justifica el numero)
   - Numero de anuncios por ad set
   - Plataformas: Facebook SI/NO, Instagram SI/NO, Audience Network SI/NO, Messenger SI/NO con razon
   - Placements: cuales activar y cuales desactivar, justifica
   - CAPI (Conversions API): obligatoria si o no para este cliente, motivo
   - Advantage Campaign Budget: activar SI o NO segun numero de ad sets

3. PRESUPUESTO E INVERSION
   - Presupuesto diario total y por ad set
   - Presupuesto mensual total
   - CPL/CPA estimado realista (rango basado en benchmark del nicho)
   - Leads/conversiones esperadas al mes
   - CAC objetivo y LTV referencia si aplica
   - Punto de equilibrio: cuando empieza a ser rentable

4. SEGMENTACION DETALLADA POR AD SET
   Para CADA ad set propuesto:
   - Nombre del ad set
   - Ubicacion: ciudad + radio km exacto, o codigos postales especificos. Justifica el radio.
   - Edad: rango razonado (no "25-55 generico")
   - Genero: segmentar SI o NO con justificacion
   - Idiomas
   - Intereses concretos de Meta marcados [VERIFICAR EN META]: usa nombres reales del catalogo Meta 2026 (no genericos), de la biblioteca arriba o del nicho del cliente. Lista 8-12 por ad set.
   - Comportamientos: cuales aplican (compradores online frecuentes, propietarios vivienda, expat, padres, etc)
   - Advantage Detailed Targeting: activado SI/NO
   - Conexiones: incluir/excluir fans pagina
   - Exclusiones obligatorias: clientes actuales (lista cargada), empleados, visitantes ultimos 7 dias para evitar fatiga, otros publicos personalizados
   - Tamano de publico estimado (rango)

5. PUBLICOS PERSONALIZADOS A CREAR
   Lista exacta con prioridad:
   - Visitantes web 30/60/180 dias (requiere pixel)
   - Lista clientes via CSV (con que campos: email + telefono + ciudad)
   - Interaccion IG organica 365 dias
   - Interaccion FB organica 365 dias
   - Video viewers 50%, 75%, 95%
   - Lead form openers no completed
   Indica que eventos del pixel/CAPI hacen falta para cada uno.

6. LOOKALIKE AUDIENCES
   - Lookalike 1% de mejores clientes (geo: provincia o Espana, justifica)
   - Lookalike 1-3% de leads cualificados
   - Lookalike 1% de compradores recurrentes (si aplica)
   Indica % y fuente base de cada uno y por que esa fuente.

7. CREATIVIDADES (briefing para diseno, NO el diseno)
   3 variantes con:
   - Concepto creativo
   - Formato: imagen estatica / carrusel / video corto / reel / coleccion
   - Aspecto ratio (1:1 feed, 9:16 stories/reels, 4:5 feed vertical)
   - Duracion si es video
   - Hook visual de los primeros 3 segundos
   - Texto sobre imagen si aplica (max 20% de la imagen)
   - Performance Score esperado y por que

8. COPYS LISTOS PARA PEGAR
   Para CADA variante (3 completas):
   - Primary text (max 125 caracteres antes del "Ver mas")
   - Headline (max 27 caracteres optimo)
   - Description (max 27 caracteres)
   - CTA: cual usar de la lista Meta (Mas informacion, Reservar, Solicitar oferta, Comprar ahora, etc)
   - URL destino con UTMs sugeridos (utm_source=facebook&utm_medium=cpc&utm_campaign=...)

9. KPIs Y OPTIMIZACION
   - Metricas clave: CPL/CPA objetivo, CTR objetivo (>1% feed, >0.8% stories), CPM esperado, frequency a vigilar (max 2.5 frio, 4 retarget), ROAS si aplica
   - Aprendizaje Meta: dejar 7 dias completos sin tocar
   - Umbral de pausa de anuncio: CTR < 0.5% tras 1000 impresiones, CPL > 1.5x objetivo tras 100 EUR gastados
   - Tests A/B primeras 2 semanas: titular vs creatividad vs CTA (uno a uno, no varios cambios)
   - Plan de optimizacion semanal: que revisar lunes, miercoles, viernes
   - Senales para escalar: ad set con CPL < objetivo y frequency < 1.5 → subir 20% presupuesto cada 3 dias

10. RIESGOS Y MITIGACION
    - Riesgos del nicho/zona
    - Plan B si una creatividad no funciona
    - Cuando pivotar de estrategia

${baseStyle}
Precision sobre extension. Esta estructura completa NO se acorta. Cada interes Meta sugerido lleva siempre [VERIFICAR EN META] para que el media buyer lo valide en Ads Manager antes de lanzar.`;

      case "segmentation": return `Eres especialista senior en segmentacion de Meta Ads para ${niche} en ${geo}, con dominio del catalogo de targeting Meta 2026. ${baseContext}

CONOCIMIENTO META 2026 APLICABLE:
- Advantage Detailed Targeting expande audiencias, no luchar contra el sistema
- Audiencias < 500.000 personas dan poca senal a Meta, considerar broad o lookalike
- Pixel + CAPI obligatorio para retargeting funcional post iOS 14.5+
- Custom Audiences caducan: web visitors max 180 dias, listas CSV max 90 dias optimo refresco
- Lookalike 1% es el mas preciso, 5-10% mas alcance menos precision
- Geo radius minimo 17 km, no se puede menos (limitacion Meta 2026)
- Por codigo postal puedes ir muy especifico, util en ciudades grandes

PRODUCE propuesta de segmentacion Meta Ads quirurgica, lista para implementar:

1. ANALISIS DEL BUYER PERSONA (extraido del brief y nicho)
   - Quien es el cliente ideal en concreto
   - Edad, genero, perfil socioeconomico
   - Que busca, que le duele, que le motiva a comprar
   - Donde vive en relacion al negocio del cliente
   - Como toma decisiones de compra en este nicho

2. PUBLICO FRIO PRINCIPAL (broad + intereses)
   - Ubicacion: ciudad + radio km exacto (minimo 17 km por limitacion Meta), o codigos postales especificos. Justifica la geografia.
   - Edad: rango con razonamiento por que esa edad y no otra
   - Genero: si segmentar o no, justifica
   - Idiomas
   - Intereses Meta concretos [VERIFICAR EN META]: lista 10-15 intereses con nombre exacto del catalogo Meta 2026. Para cada uno explica por que lo eliges para este cliente.
   - Comportamientos: lista 2-4 comportamientos clave (compradores online frecuentes, propietarios vivienda, padres con hijos, expats, viajeros frecuentes, etc)
   - Advantage Detailed Targeting: activado SI/NO con justificacion
   - Tamano de publico estimado: dar rango y senal de si Meta tendra suficientes datos

3. PUBLICO BROAD (sin intereses, solo geo + demo)
   - Cuando usarlo: a partir de que presupuesto tiene sentido
   - Configuracion exacta
   - Pros y contras vs publico con intereses
   - Tamano estimado

4. PUBLICOS DE RETARGETING CALIENTES (Custom Audiences)
   Lista priorizada:
   - Visitantes web 30, 90, 180 dias (requiere pixel funcional)
   - Eventos pixel especificos: ViewContent, AddToCart, InitiateCheckout, Lead - cuales son relevantes
   - Lista de clientes via CSV: con email + telefono + nombre + apellido + ciudad + codigo postal para mejor match rate
   - Interaccion organica IG 365 dias
   - Interaccion organica FB 365 dias
   - Video viewers 50%, 75%, 95%
   - Lead form openers no completed (oro para reactivar)
   - Carrito abandonado si ecommerce
   Indica que pixel events y que eventos CAPI hacen falta para cada uno.

5. LOOKALIKE AUDIENCES
   Por orden de prioridad:
   - Lookalike 1% de mejores clientes (top 20% por valor) en provincia o Espana segun negocio
   - Lookalike 1% de leads cualificados
   - Lookalike 1-3% de compradores recurrentes
   - Lookalike 1% de video viewers 75%+
   Para cada uno indica: tamano fuente minimo (1000+ ideal), geografia base, % y justificacion del %.

6. EXCLUSIONES OBLIGATORIAS
   - Clientes actuales (subir lista CSV actualizada cada mes)
   - Empleados y proveedores
   - Visitantes recientes ultimos 7 dias en publicos frios (anti-fatiga)
   - Otros publicos personalizados a excluir segun caso
   - Si retargeting: excluir compradores ultimos 30 dias para no machacar
   Por que cada exclusion.

7. ARQUITECTURA DE AD SETS PROPUESTA
   Propone 3-5 ad sets concretos con la combinacion exacta de publicos en cada uno. Para cada ad set:
   - Nombre del ad set
   - Publico exacto (interes / broad / lookalike / retarget)
   - Geografia
   - Edad y genero
   - Exclusiones aplicadas
   - Presupuesto diario sugerido (porcentaje del total)
   - Que esperar de este ad set (volumen vs precision)

8. PLAN DE TESTING Y APRENDIZAJE
   - Que segmentos probar primero (3 ad sets max al arrancar para no fragmentar presupuesto)
   - Presupuesto minimo por ad set para que aprenda Meta (regla 50 conversiones/semana, traducido a EUR segun CPL nicho)
   - Cuanto tiempo dar antes de pausar (minimo 7 dias completos sin tocar)
   - Senales para escalar: CPL < objetivo + frequency < 1.5 + 50 conversiones reales
   - Senales para pausar: frequency > 2.5 en frio, CPL > 1.5x objetivo tras 100 EUR
   - Cuando refrescar publicos personalizados: cada 30-60 dias

9. INSTRUCCIONES DE IMPLEMENTACION
   - Que hacer ANTES de lanzar (pixel funcional, CAPI activado, eventos verificados, publicos creados, exclusiones cargadas)
   - Orden de creacion en Ads Manager
   - Validaciones finales antes de pulsar "Publish"

${baseStyle}
Cada interes Meta sugerido lleva [VERIFICAR EN META] al lado para que el media buyer lo valide en Ads Manager antes de lanzar. Si propones un interes que crees que existe pero no estas seguro, pon [VERIFICAR EN META - posiblemente no exista].`;

      case "landing": return `Eres copywriter especializado en landing pages de conversion para ${niche} local. ${baseContext}

PRODUCE el copy completo de una landing page (no esquema), seccion por seccion, lista para implementar:

1. HERO: titular principal (max 12 palabras), subtitular (max 25 palabras), CTA primario
2. PROPUESTA DE VALOR: 3-4 bullets con beneficios concretos
3. PRUEBA SOCIAL: estructura de testimonios (3 con nombre, edad/perfil, resultado)
4. DESCRIPCION DEL SERVICIO: 2-3 parrafos
5. COMO FUNCIONA: 3-4 pasos
6. PRECIOS / PLANES: si aplica, con estructura clara
7. FAQs: 5 preguntas reales que el publico se hace en este nicho
8. CTA FINAL: con copy de urgencia honesta y formulario sugerido (campos)
9. SEO: meta titulo (max 60 char), meta descripcion (max 155 char), keyword principal y 5 secundarias

${baseStyle}`;

      case "whatsapp": return `Eres especialista en protocolos WhatsApp Business para negocios de ${niche}. ${baseContext}

PRODUCE un protocolo WhatsApp completo:

1. SALUDO INICIAL automatico
2. ARBOL DE RESPUESTAS por tipo de consulta (3-5 ramas)
3. PROTOCOLO DE LEAD NUEVO: secuencia de 5-7 mensajes desde primer contacto hasta cita
4. RESPUESTAS RAPIDAS pre-grabadas: 8-10 mensajes tipo
5. PROTOCOLO DE NO RESPUESTA: 3 follow-ups con espacios temporales (24h, 72h, 7d)
6. CIERRE DE CITA: confirmacion, recordatorio 24h antes, recordatorio 2h antes
7. POST-VISITA: mensaje de seguimiento, peticion de resena
8. PROTOCOLO DE QUEJAS

Cada mensaje listo para pegar en WhatsApp, sin asteriscos para negrita (usar mayusculas si necesario). ${baseStyle}`;

      case "seo": return `Eres redactor SEO experto en contenido para ${niche} local. ${baseContext}

PRODUCE un articulo SEO completo y optimizado:
- Keyword principal y 3 long-tail
- Meta titulo (max 60 char) y meta descripcion (max 155 char)
- H1 con keyword
- Articulo de 1200-1800 palabras estructurado con H2 y H3
- Densidad de keyword natural (1-2%)
- Bloque FAQ con 5 preguntas (schema FAQPage friendly)
- Llamada interna a 3 anchor texts sugeridos
- Conclusion con CTA

${baseStyle}`;

      case "social": return `Eres estratega de contenido para redes sociales de ${niche}. ${baseContext}

PRODUCE una estrategia de redes completa para los proximos 30 dias:
- Pilares de contenido (4-5 pilares con peso %)
- Frecuencia por canal (Instagram, Facebook, TikTok si aplica)
- Calendario tipo de la semana (que se publica que dia y por que)
- 10 ideas de post concretas con: formato, gancho de la primera linea, copy completo, hashtags (10-15), CTA
- Idea de carrusel educativo (5-7 slides) con texto de cada slide
- Recomendaciones para Stories diarias

${baseStyle}`;

      case "video": return `Eres guionista de video corto vertical para redes (Reels, TikTok, Shorts) en ${niche}. ${baseContext}

PRODUCE 5 scripts de video corto (30-60 seg cada uno):
Para cada script:
- Titulo del video
- Hook de los primeros 3 segundos
- Estructura segundo a segundo (intro, desarrollo, payoff)
- Texto que aparece en pantalla
- Voz en off / dialogo
- Cierre con CTA
- Hashtags recomendados
- Sugerencia de musica/audio trending si aplica

${baseStyle}`;

      case "gbp": return `Eres especialista en Google Business Profile para negocios locales de ${niche}. ${baseContext}

PRODUCE optimizacion completa de la ficha Google Business:
1. Descripcion del negocio: 4-5 versiones (corta, media, larga, con keyword, sin keyword)
2. Categorias primaria y secundarias recomendadas
3. Atributos a marcar
4. Productos/servicios a listar con descripcion (8-12 items)
5. 10 ideas de publicaciones GBP del proximo mes con copy completo
6. Plantillas de respuesta a resenas (positivas 5*, neutras 3*, negativas 1-2*)
7. Estrategia de Q&A: 10 preguntas y respuestas a publicar
8. Plan de fotos: que fotos tomar y cada cuanto

${baseStyle}`;

      case "followup": return `Eres especialista en email marketing y secuencias automatizadas para ${niche}. ${baseContext}

PRODUCE una secuencia de seguimiento email de 7 toques:
Para cada email:
- Cuando se envia (dia desde inscripcion)
- Asunto (3 variantes A/B)
- Preheader
- Cuerpo del email (300-500 palabras maximo)
- CTA con texto exacto del boton
- Objetivo concreto del email (educar, ofrecer, recordar, etc)

${baseStyle}`;

      case "webstruct": return `Eres arquitecto de informacion web para sitios de ${niche}. ${baseContext}

PRODUCE arquitectura web completa:
1. Mapa de paginas (sitemap textual con jerarquia)
2. Para cada pagina principal: titulo H1, objetivo, secciones, CTA
3. Estructura de menu principal y footer
4. URLs propuestas (slugs) optimizadas
5. Estrategia de enlazado interno
6. Paginas legales obligatorias

${baseStyle}`;

      case "proposal": return `Eres comercial senior B2B preparando propuesta para ${niche}. ${baseContext}

PRODUCE propuesta comercial completa para presentar al cliente:
1. Resumen ejecutivo (1 pagina)
2. Diagnostico actual del cliente
3. Solucion propuesta detallada por modulos
4. Cronograma de implementacion (semana a semana)
5. Inversion: 3 opciones (basica, recomendada, premium) con precios
6. ROI estimado y casos de exito comparables
7. Equipo asignado
8. Garantias y compromisos
9. Siguientes pasos

${baseStyle}`;

      case "campaign": return `Eres director de campana multicanal para ${niche} local. ${baseContext}

PRODUCE plan de campana multicanal de 90 dias:
1. Objetivo de la campana y KPIs
2. Mensaje principal y angulos creativos (3-5)
3. Activacion por canal con detalle:
   - Meta Ads (presupuesto, segmentacion, creatividades)
   - Google Ads (Search, Display, presupuesto)
   - SEO (3-5 articulos pilar)
   - Email marketing (secuencias)
   - Redes organicas (calendario)
   - Influencers/colaboraciones si aplica
4. Cronograma trimestral semana a semana
5. Presupuesto total y por canal
6. Sistema de medicion y reporting

${baseStyle}`;

      case "manual": return `Eres consultor de comunicacion corporativa. ${baseContext}

PRODUCE manual de comunicacion del cliente:
1. Tono de voz: 5-7 principios con ejemplos correctos y incorrectos
2. Vocabulario: palabras a usar, palabras a evitar
3. Estructura tipo de respuesta a cliente (saludo, cuerpo, cierre)
4. Plantillas para situaciones tipicas (10 casos)
5. Manejo de crisis y respuestas a negativas
6. Reglas de uso de emojis, mayusculas, exclamaciones
7. Estilo de comunicacion por canal (WhatsApp vs email vs telefono)

${baseStyle}`;

      default: return `Estratega de marketing digital para negocios locales en Espana. ${baseContext}
Estas produciendo: ${DELIVERABLE_TYPES[item.type]?.lb || "entregable"} (titulo: "${item.title}").
DETALLE A CUMPLIR: ${item.detail}.

Reglas: contenido COMPLETO listo para entregar al cliente, no esquemas. ${baseStyle}`;
    }
  };

  // Generar UN entregable
  const generateOne = async (item) => {
    setDeliverables(prev => prev.map(d => d.id===item.id ? {...d, status:"generating", content:""} : d));
    const def = DELIVERABLE_TYPES[item.type];

    const system = buildSystemPrompt(item);
    const userMsg = `Brief original del proyecto: ${brief}

Produce el entregable "${item.title}". Detalle: ${item.detail || "Definir alcance"}.`;

    const maxTokens =
      (item.type === "metaads") ? 8192 :
      (item.type === "segmentation") ? 6144 :
      (item.type === "campaign" || item.type === "proposal" || item.type === "manual") ? 6144 :
      4096;

    try{
      const r = await fetch("/api/generate", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          provider:"anthropic",
          model:"claude-sonnet-4-20250514",
          max_tokens: maxTokens,
          stream:true,
          system,
          messages:[{role:"user", content:userMsg}],
          hint: def.tool
        })
      });
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      let buffer = "";
      while(true){
        const {done, value} = await reader.read();
        if(done) break;
        buffer += decoder.decode(value, {stream:true});
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for(const line of lines){
          if(!line.startsWith("data: ")) continue;
          try{
            const ev = JSON.parse(line.slice(6));
            if(ev.type==="content_block_delta" && ev.delta?.type==="text_delta" && ev.delta.text){
              full += ev.delta.text;
              setDeliverables(prev => prev.map(d => d.id===item.id ? {...d, content:full} : d));
            }
          }catch{}
        }
      }
      setDeliverables(prev => prev.map(d => d.id===item.id ? {...d, status:"done", content:full} : d));
    }catch(e){
      setDeliverables(prev => prev.map(d => d.id===item.id ? {...d, status:"error", content:"Error: "+e.message} : d));
    }
  };

  // Generar TODOS en serie
  const generateAll = async () => {
    setStep("generating");
    const pending = deliverables.filter(d => d.status !== "done");
    for(const item of pending){
      await generateOne(item);
    }
    setStep("done");
    saveProject();
  };

  const addDeliverable = (type) => {
    const def = DELIVERABLE_TYPES[type];
    setDeliverables(prev => [...prev, {
      id: Date.now(),
      type,
      title: def.lb,
      detail: "Definir alcance especifico",
      status: "pending",
      content: ""
    }]);
  };

  const removeDeliverable = (id) => {
    setDeliverables(prev => prev.filter(d => d.id !== id));
  };

  const editDeliverable = (id, field, value) => {
    setDeliverables(prev => prev.map(d => d.id===id ? {...d, [field]:value} : d));
  };

  const saveProject = () => {
    const proj = {
      id: Date.now(),
      date: new Date().toISOString(),
      clientId,
      clientName: selectedClient?.nombre || "",
      projectName,
      brief,
      deliverables,
    };
    try{
      const raw = localStorage.getItem("cliniq_projects") || "[]";
      const list = JSON.parse(raw);
      list.unshift(proj);
      const trimmed = list.slice(0, 20);
      localStorage.setItem("cliniq_projects", JSON.stringify(trimmed));
      setSavedProjects(trimmed);
    }catch{}
  };

  const loadProject = (p) => {
    setClientId(p.clientId);
    setProjectName(p.projectName);
    setBrief(p.brief);
    setDeliverables(p.deliverables);
    setStep(p.deliverables.every(d=>d.status==="done") ? "done" : "board");
    setShowHistory(false);
  };

  const resetAll = () => {
    if(!confirm("Empezar un proyecto nuevo? Se perderan los cambios no guardados.")) return;
    setClientId("");
    setProjectName("");
    setBrief("");
    setDeliverables([]);
    setStep("compose");
  };

  /* ── COMPOSE STEP (pantalla inicial) ── */
  if(step === "compose" || step === "analyzing"){
    return <div style={S.wrap}>
      <div style={S.grain} className="studio-grain"/>
      <div style={S.composeContainer}>

        <header style={S.composeHeader} className="studio-fadein">
          <div style={S.eyebrow}>
            <span style={S.eyebrowDot}/>
            <span style={S.eyebrowText}>CONECTA NEX · ESTUDIO DE PROYECTO</span>
          </div>
          <h1 style={S.composeTitle} className="studio-display">
            ¿Qué construimos<br/>
            <em style={{color:C.gold,fontStyle:"italic",fontWeight:400}}>hoy</em> para el cliente?
          </h1>
          <p style={S.composeSubtitle} className="studio-body">
            Describe el proyecto y la IA descompone el trabajo en entregables.
            Genera todo en cadena. Presenta al cliente al momento.
          </p>
        </header>

        <div style={{...S.composeForm, animationDelay:"0.15s"}} className="studio-fadein">

          {/* Selector cliente con estética editorial */}
          <div style={S.formRow}>
            <label style={S.formLabel} className="studio-mono">01 · CLIENTE</label>
            <select value={clientId} onChange={e=>setClientId(e.target.value)} style={S.bigSelect}>
              <option value="">— Selecciona un cliente del archivo —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.nicho?"· "+c.nicho:""}</option>)}
            </select>
            {clients.length === 0 && <p style={S.helpText}>
              No tienes clientes todavía. <a onClick={()=>setAct("clients")} style={S.linkInline}>Crea uno aquí</a>.
            </p>}
          </div>

          {selectedClient && <div style={S.clientChip} className="studio-fadein">
            <div style={{display:"flex",alignItems:"center",gap:14,flex:1,minWidth:0}}>
              <div style={S.clientChipAvatar} className="studio-display">{selectedClient.nombre.charAt(0).toUpperCase()}</div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:C.w}}>{selectedClient.nombre}</div>
                <div style={{fontSize:11,color:C.tx,marginTop:2}}>
                  {selectedClient.nicho || "Sin nicho"} · {selectedClient.ciudad_fiscal || selectedClient.ciudadFiscal || "Sin ciudad"}
                </div>
              </div>
            </div>
          </div>}

          {/* Brief con plantillas */}
          <div style={{...S.formRow, marginTop:24}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10,flexWrap:"wrap",gap:6}}>
              <label style={S.formLabel} className="studio-mono">02 · BRIEF DEL PROYECTO</label>
              <span style={{fontSize:11,color:C.txD}}>Cuanto más detalle, mejor la propuesta</span>
            </div>
            <textarea
              value={brief}
              onChange={e=>setBrief(e.target.value)}
              placeholder="Ejemplo: Lanzamos servicio de implantes premium con financiación. Necesito una landing nueva, 5 posts para Instagram durante la próxima semana, una secuencia de WhatsApp para los leads que vengan, y campaña en Meta Ads de 400 euros mes orientada a mujeres 35-55 en Alicante centro."
              style={S.bigTextarea}
              rows={6}
            />
            <div style={S.templates}>
              {QUICK_TEMPLATES.map(t => <button key={t.lb} onClick={()=>setBrief(t.txt)} style={S.templateBtn}>
                <span style={S.templatePlus}>+</span> {t.lb}
              </button>)}
            </div>
          </div>

          {/* CTA grande */}
          <div style={{marginTop:32,display:"flex",gap:14,flexWrap:"wrap"}}>
            <button
              onClick={analyzeBrief}
              disabled={!brief.trim() || !selectedClient || step==="analyzing"}
              style={S.bigCTA}
            >
              {step==="analyzing"
                ? <>
                    <span style={{display:"inline-block",width:14,height:14,border:"2px solid "+C.bg,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite",marginRight:10,verticalAlign:"middle"}}/>
                    La IA está descomponiendo el proyecto...
                  </>
                : "Construir proyecto →"}
            </button>
            {savedProjects.length > 0 && <button onClick={()=>setShowHistory(true)} style={S.ghostCTA}>
              Recuperar proyecto ({savedProjects.length})
            </button>}
          </div>

        </div>

        {/* Historia lateral */}
        {showHistory && <div style={S.historyOverlay} onClick={e=>{if(e.target===e.currentTarget)setShowHistory(false);}}>
          <div style={S.historyPanel}>
            <div style={S.historyHeader}>
              <h3 style={{margin:0,fontSize:15,fontWeight:700,color:C.w}} className="studio-display">Proyectos recientes</h3>
              <button onClick={()=>setShowHistory(false)} style={S.iconBtn}>×</button>
            </div>
            <div style={{padding:"6px 0"}}>
              {savedProjects.map(p => <div key={p.id} onClick={()=>loadProject(p)} style={S.historyItem}>
                <div style={{fontSize:13,fontWeight:600,color:C.w,marginBottom:3}}>{p.projectName || "Sin nombre"}</div>
                <div style={{fontSize:11,color:C.tx}}>{p.clientName} · {new Date(p.date).toLocaleDateString("es-ES")} · {p.deliverables?.length||0} entregables</div>
              </div>)}
            </div>
          </div>
        </div>}

      </div>
    </div>;
  }

  /* ── BOARD STEP (tablero de entregables) ── */
  if(step === "board" || step === "generating" || step === "done"){
    const totalDone = deliverables.filter(d=>d.status==="done").length;
    const total = deliverables.length;
    const pct = total>0 ? Math.round((totalDone/total)*100) : 0;
    const isGenerating = step === "generating";
    const isDone = step === "done" || (total>0 && totalDone === total);

    return <div style={S.wrap}>
      <div style={S.grain} className="studio-grain"/>
      <div style={S.boardContainer}>

        {/* Top bar con proyecto */}
        <header style={S.boardHeader} className="studio-fadein">
          <div style={{flex:1,minWidth:0}}>
            <div style={S.eyebrow}>
              <span style={S.eyebrowDot}/>
              <span style={S.eyebrowText}>PROYECTO · {selectedClient?.nombre || "—"}</span>
            </div>
            <input
              value={projectName}
              onChange={e=>setProjectName(e.target.value)}
              style={S.projectNameInput}
              className="studio-display"
              placeholder="Nombre del proyecto"
            />
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button onClick={resetAll} style={S.ghostBtn}>Nuevo proyecto</button>
            {isDone && <button onClick={()=>{setStep("present");setPresentSlide(0);}} style={S.solidBtn}>
              Presentar al cliente →
            </button>}
          </div>
        </header>

        {/* Brief recordatorio */}
        <div style={S.briefRecap} className="studio-fadein">
          <div style={S.briefRecapLabel} className="studio-mono">BRIEF</div>
          <p style={S.briefRecapText}>{brief}</p>
        </div>

        {/* Progreso */}
        <div style={S.progressBar} className="studio-fadein">
          <div style={S.progressBarTrack}>
            <div style={{...S.progressBarFill, width: pct+"%"}}/>
          </div>
          <div style={S.progressBarLabel}>
            <span className="studio-mono" style={{fontSize:11,color:C.tx,letterSpacing:0.5}}>
              {totalDone}/{total} ENTREGABLES PRODUCIDOS · {pct}%
            </span>
            {!isGenerating && totalDone < total && <button onClick={generateAll} style={S.generateAllBtn}>
              Generar todo →
            </button>}
            {isGenerating && <span style={{fontSize:11,color:C.teal}} className="studio-pulse">
              Producción en curso...
            </span>}
          </div>
        </div>

        {/* Lista de entregables */}
        <div style={S.deliverablesGrid}>
          {deliverables.map((d, i) => <DeliverableCard
            key={d.id}
            item={d}
            index={i}
            onGenerate={() => generateOne(d)}
            onRemove={() => removeDeliverable(d.id)}
            onEdit={(field,value)=>editDeliverable(d.id,field,value)}
            isBusy={isGenerating}
          />)}

          {/* Add more */}
          <div style={S.addCard}>
            <div style={S.addCardLabel} className="studio-mono">AÑADIR ENTREGABLE</div>
            <div style={S.addGrid}>
              {Object.entries(DELIVERABLE_TYPES).map(([key, def]) =>
                <button key={key} onClick={()=>addDeliverable(key)} style={{...S.addBtn, borderColor:def.cl+"40"}}>
                  <span style={{color:def.cl,fontSize:14}}>{def.ic}</span>
                  <span style={{fontSize:11}}>{def.lb}</span>
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>;
  }

  /* ── PRESENT STEP (presentacion al cliente) ── */
  if(step === "present"){
    const slides = [
      {kind:"cover"},
      ...deliverables.filter(d=>d.status==="done"),
      {kind:"end"}
    ];
    const current = slides[presentSlide];
    const next = ()=>setPresentSlide(s=>Math.min(s+1, slides.length-1));
    const prev = ()=>setPresentSlide(s=>Math.max(s-1, 0));

    return <div style={S.presentWrap}>
      <div style={S.grain} className="studio-grain"/>

      {/* Slide */}
      <div style={S.slide} className="studio-fadein" key={presentSlide}>
        {current.kind === "cover" && <div style={S.coverSlide}>
          <div style={S.eyebrow}>
            <span style={S.eyebrowDot}/>
            <span style={S.eyebrowText}>{selectedClient?.nombre} · {new Date().toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})}</span>
          </div>
          <h1 style={S.coverTitle} className="studio-display">{projectName}</h1>
          <p style={S.coverSubtitle} className="studio-body">{brief}</p>
          <div style={S.coverMeta}>
            <span className="studio-mono" style={S.coverMetaItem}>{deliverables.filter(d=>d.status==="done").length} ENTREGABLES</span>
            <span style={S.coverMetaDivider}>·</span>
            <span className="studio-mono" style={S.coverMetaItem}>PROPUESTA DE PRODUCCIÓN</span>
          </div>
        </div>}

        {current.kind === "end" && <div style={S.coverSlide}>
          <h1 style={S.coverTitle} className="studio-display">¿<em style={{color:C.gold,fontStyle:"italic",fontWeight:400}}>Empezamos</em><br/>la producción?</h1>
          <p style={S.coverSubtitle} className="studio-body">
            Todo lo que has visto está listo para ejecutarse esta misma semana.
          </p>
          <div style={{marginTop:40,display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
            <div style={S.endBox}>
              <div style={S.endBoxLabel} className="studio-mono">CONECTA NEX</div>
              <div style={S.endBoxValue}>info.digitalconect@gmail.com</div>
            </div>
            <div style={S.endBox}>
              <div style={S.endBoxLabel} className="studio-mono">TELÉFONO</div>
              <div style={S.endBoxValue}>611 986 107</div>
            </div>
          </div>
        </div>}

        {current.type && DELIVERABLE_TYPES[current.type] && <div style={S.contentSlide}>
          <div style={S.contentSlideHeader}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{...S.slideIcon, color:DELIVERABLE_TYPES[current.type].cl}}>{DELIVERABLE_TYPES[current.type].ic}</div>
              <div>
                <div className="studio-mono" style={{fontSize:11,color:C.tx,letterSpacing:1,textTransform:"uppercase"}}>
                  {DELIVERABLE_TYPES[current.type].lb} · Entregable {presentSlide}/{slides.length-2}
                </div>
                <h2 style={S.slideTitle} className="studio-display">{current.title}</h2>
              </div>
            </div>
          </div>
          <div style={S.slideContent}>
            {current.content}
          </div>
        </div>}

      </div>

      {/* Nav */}
      <div style={S.presentNav}>
        <button onClick={()=>setStep("done")} style={S.exitBtn}>← Salir</button>
        <div style={S.slidesDots}>
          {slides.map((_,i) => <button key={i} onClick={()=>setPresentSlide(i)} style={{...S.slideDot, ...(i===presentSlide?S.slideDotActive:{})}}/>)}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={prev} disabled={presentSlide===0} style={S.navBtn}>←</button>
          <button onClick={next} disabled={presentSlide===slides.length-1} style={S.navBtn}>→</button>
        </div>
      </div>

    </div>;
  }

  return null;
}

/* ── DELIVERABLE CARD ── */
function DeliverableCard({ item, index, onGenerate, onRemove, onEdit, isBusy }){
  const def = DELIVERABLE_TYPES[item.type];
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDetail, setEditingDetail] = useState(false);

  return <div style={{
    background: C.sf,
    border: "1px solid " + (item.status==="done"?def.cl+"60":C.bd),
    borderRadius: 14,
    padding: 22,
    transition: "all 0.3s",
    animationDelay: (index * 0.05) + "s",
  }} className="studio-fadein">

    {/* Top */}
    <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:14}}>
      <div style={{
        width:38,height:38,borderRadius:10,
        background:def.cl+"18",color:def.cl,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:18,fontWeight:700,flexShrink:0
      }}>{def.ic}</div>
      <div style={{flex:1,minWidth:0}}>
        <div className="studio-mono" style={{fontSize:10,color:C.txD,letterSpacing:1,marginBottom:4,textTransform:"uppercase"}}>
          {def.lb}
        </div>
        {editingTitle
          ? <input
              value={item.title}
              onChange={e=>onEdit("title", e.target.value)}
              onBlur={()=>setEditingTitle(false)}
              autoFocus
              style={{background:"transparent",border:"none",borderBottom:"1px solid "+C.bd,color:C.w,fontSize:14,fontWeight:700,padding:"2px 0",width:"100%",outline:"none",fontFamily:"'Fraunces',serif"}}
            />
          : <h4 onClick={()=>setEditingTitle(true)} style={{margin:0,fontSize:15,fontWeight:600,color:C.w,cursor:"text",lineHeight:1.3}} className="studio-display">{item.title}</h4>}
      </div>
      <button onClick={onRemove} disabled={isBusy} style={{
        background:"transparent",border:"none",color:C.txD,
        cursor:isBusy?"not-allowed":"pointer",fontSize:16,padding:4,opacity:isBusy?0.3:1
      }}>×</button>
    </div>

    {/* Detail */}
    {editingDetail
      ? <textarea
          value={item.detail}
          onChange={e=>onEdit("detail", e.target.value)}
          onBlur={()=>setEditingDetail(false)}
          autoFocus
          rows={3}
          style={{width:"100%",background:C.bg,border:"1px solid "+C.bd,color:C.tx,padding:"8px 10px",borderRadius:6,fontSize:12,resize:"vertical",fontFamily:"'DM Sans',sans-serif",boxSizing:"border-box",marginBottom:12,outline:"none"}}
        />
      : <p onClick={()=>setEditingDetail(true)} style={{fontSize:12,color:C.tx,margin:"0 0 14px",cursor:"text",lineHeight:1.5}}>{item.detail || "(añade detalle)"}</p>}

    {/* Status / actions */}
    <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      {item.status === "pending" && <>
        <button onClick={onGenerate} disabled={isBusy} style={{
          background:def.cl,color:C.bg,border:"none",
          padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:600,
          cursor:isBusy?"not-allowed":"pointer",opacity:isBusy?0.4:1,
          fontFamily:"'DM Sans',sans-serif"
        }}>Generar ahora</button>
        <span className="studio-mono" style={{fontSize:10,color:C.txD,letterSpacing:0.5}}>~{def.est}</span>
      </>}
      {item.status === "generating" && <span style={{display:"flex",alignItems:"center",gap:8,color:def.cl,fontSize:12,fontWeight:600}}>
        <span style={{display:"inline-block",width:10,height:10,borderRadius:"50%",background:def.cl}} className="studio-pulse"/>
        Produciendo...
      </span>}
      {item.status === "done" && <>
        <span style={{display:"flex",alignItems:"center",gap:6,color:C.green,fontSize:11,fontWeight:600}}>
          <span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:C.green}}/>
          LISTO
        </span>
        <button onClick={()=>setExpanded(!expanded)} style={{
          background:"transparent",border:"1px solid "+C.bd,color:C.tx,
          padding:"6px 12px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",
          fontFamily:"'DM Sans',sans-serif"
        }}>{expanded ? "Ocultar" : "Ver contenido"}</button>
        <button onClick={()=>navigator.clipboard.writeText(item.content)} style={{
          background:"transparent",border:"1px solid "+C.bd,color:C.tx,
          padding:"6px 12px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",
          fontFamily:"'DM Sans',sans-serif"
        }}>Copiar</button>
        <button onClick={onGenerate} disabled={isBusy} style={{
          background:"transparent",border:"1px solid "+C.bd,color:C.txD,
          padding:"6px 12px",borderRadius:6,fontSize:11,fontWeight:600,
          cursor:isBusy?"not-allowed":"pointer",opacity:isBusy?0.4:1,
          fontFamily:"'DM Sans',sans-serif"
        }}>Regenerar</button>
      </>}
      {item.status === "error" && <span style={{color:C.red,fontSize:11}}>Error. Reintentar.</span>}
    </div>

    {/* Expanded content */}
    {(expanded || item.status==="generating") && item.content && <div style={{
      marginTop:14,padding:14,background:C.bg,border:"1px solid "+C.bd,borderRadius:8,
      fontSize:12,color:C.tx,whiteSpace:"pre-wrap",lineHeight:1.6,
      maxHeight: expanded ? 400 : 200,overflowY:"auto"
    }}>{item.content}{item.status==="generating" && <span style={{display:"inline-block",width:4,height:11,background:def.cl,marginLeft:2,animation:"blink 1s infinite",verticalAlign:"text-bottom"}}/>}</div>}

  </div>;
}

/* ── STYLES ── */
const S = {
  wrap: {
    minHeight:"calc(100vh - 0px)",
    background:`linear-gradient(180deg, ${C.bg} 0%, ${C.ink} 100%)`,
    position:"relative",
    padding:"40px 20px 80px",
  },
  grain:{
    position:"absolute",top:0,left:0,right:0,bottom:0,
    pointerEvents:"none",zIndex:0,opacity:0.5
  },

  // COMPOSE
  composeContainer:{maxWidth:920,margin:"0 auto",position:"relative",zIndex:1},
  composeHeader:{marginBottom:48},
  eyebrow:{
    display:"inline-flex",alignItems:"center",gap:8,
    padding:"6px 12px",border:"1px solid "+C.bd,borderRadius:30,
    marginBottom:24,background:C.sf+"60"
  },
  eyebrowDot:{
    width:6,height:6,borderRadius:"50%",background:C.teal,
    animation:"studioPulse 2s ease-in-out infinite"
  },
  eyebrowText:{
    fontSize:10,fontWeight:600,color:C.tx,letterSpacing:1,
    fontFamily:"'JetBrains Mono',monospace"
  },
  composeTitle:{
    fontSize:"clamp(40px, 6vw, 72px)",fontWeight:600,color:C.w,
    lineHeight:1.05,margin:"0 0 22px",letterSpacing:"-0.03em"
  },
  composeSubtitle:{
    fontSize:17,color:C.tx,maxWidth:560,lineHeight:1.5,margin:0
  },
  composeForm:{
    background:C.sf+"80",backdropFilter:"blur(20px)",
    border:"1px solid "+C.bd,borderRadius:18,padding:30,marginTop:30
  },
  formRow:{},
  formLabel:{
    display:"block",fontSize:10,fontWeight:600,color:C.tx,
    letterSpacing:1.2,marginBottom:10,textTransform:"uppercase"
  },
  bigSelect:{
    width:"100%",padding:"16px 18px",fontSize:15,
    background:C.bg,border:"1px solid "+C.bd,color:C.w,
    borderRadius:12,outline:"none",fontFamily:"'DM Sans',sans-serif",
    cursor:"pointer",appearance:"none",
    backgroundImage:`url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%2394A3B8' d='M6 8L0 0h12z'/%3E%3C/svg%3E")`,
    backgroundRepeat:"no-repeat",backgroundPosition:"right 18px center"
  },
  helpText:{fontSize:12,color:C.txD,marginTop:8},
  linkInline:{color:C.teal,cursor:"pointer",textDecoration:"underline"},
  clientChip:{
    marginTop:14,padding:"12px 16px",
    background:C.teal+"08",border:"1px solid "+C.teal+"30",
    borderRadius:12,display:"flex",alignItems:"center"
  },
  clientChipAvatar:{
    width:38,height:38,borderRadius:10,
    background:`linear-gradient(135deg, ${C.teal}, ${C.tealD})`,
    color:C.bg,display:"flex",alignItems:"center",justifyContent:"center",
    fontSize:17,fontWeight:600,flexShrink:0,fontStyle:"italic"
  },
  bigTextarea:{
    width:"100%",padding:"16px 18px",fontSize:15,
    background:C.bg,border:"1px solid "+C.bd,color:C.w,
    borderRadius:12,outline:"none",fontFamily:"'DM Sans',sans-serif",
    resize:"vertical",lineHeight:1.6,boxSizing:"border-box",minHeight:140
  },
  templates:{display:"flex",gap:8,flexWrap:"wrap",marginTop:12},
  templateBtn:{
    background:"transparent",border:"1px dashed "+C.bd,color:C.tx,
    padding:"6px 12px",fontSize:11,borderRadius:20,cursor:"pointer",
    display:"flex",alignItems:"center",gap:6,fontFamily:"'DM Sans',sans-serif",
    transition:"all 0.2s"
  },
  templatePlus:{color:C.gold,fontWeight:700},
  bigCTA:{
    background:C.teal,color:C.bg,border:"none",
    padding:"16px 32px",fontSize:15,fontWeight:600,
    borderRadius:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
    transition:"all 0.2s"
  },
  ghostCTA:{
    background:"transparent",border:"1px solid "+C.bd,color:C.tx,
    padding:"16px 24px",fontSize:14,fontWeight:600,borderRadius:12,
    cursor:"pointer",fontFamily:"'DM Sans',sans-serif"
  },

  // HISTORY
  historyOverlay:{
    position:"fixed",top:0,left:0,right:0,bottom:0,
    background:"rgba(0,0,0,0.75)",zIndex:999,
    display:"flex",alignItems:"flex-start",justifyContent:"flex-end",
    padding:20
  },
  historyPanel:{
    width:"100%",maxWidth:420,maxHeight:"calc(100vh - 40px)",
    background:C.sf,border:"1px solid "+C.bd,borderRadius:14,
    overflow:"auto"
  },
  historyHeader:{
    padding:"18px 20px",borderBottom:"1px solid "+C.bd,
    display:"flex",justifyContent:"space-between",alignItems:"center",
    position:"sticky",top:0,background:C.sf,zIndex:1
  },
  historyItem:{
    padding:"14px 20px",cursor:"pointer",
    borderBottom:"1px solid "+C.bd,transition:"background 0.15s"
  },
  iconBtn:{
    background:"transparent",border:"none",color:C.tx,
    fontSize:18,cursor:"pointer",padding:6,lineHeight:1
  },

  // BOARD
  boardContainer:{maxWidth:1100,margin:"0 auto",position:"relative",zIndex:1},
  boardHeader:{
    display:"flex",justifyContent:"space-between",
    alignItems:"flex-start",gap:20,flexWrap:"wrap",marginBottom:28
  },
  projectNameInput:{
    background:"transparent",border:"none",color:C.w,
    fontSize:"clamp(28px, 4vw, 44px)",fontWeight:600,
    padding:"4px 0",margin:"6px 0 0",
    fontFamily:"'Fraunces',serif",letterSpacing:"-0.02em",
    outline:"none",width:"100%",lineHeight:1.1
  },
  ghostBtn:{
    background:"transparent",border:"1px solid "+C.bd,color:C.tx,
    padding:"10px 18px",fontSize:13,fontWeight:600,borderRadius:9,
    cursor:"pointer",fontFamily:"'DM Sans',sans-serif"
  },
  solidBtn:{
    background:C.gold,color:C.bg,border:"none",
    padding:"10px 20px",fontSize:13,fontWeight:600,borderRadius:9,
    cursor:"pointer",fontFamily:"'DM Sans',sans-serif"
  },
  briefRecap:{
    background:C.sf+"60",border:"1px solid "+C.bd,borderRadius:12,
    padding:"16px 20px",marginBottom:18,display:"flex",gap:18,alignItems:"flex-start"
  },
  briefRecapLabel:{
    fontSize:9,letterSpacing:1.5,color:C.gold,fontWeight:600,
    paddingTop:4,flexShrink:0
  },
  briefRecapText:{fontSize:13,color:C.tx,margin:0,lineHeight:1.6,flex:1},
  progressBar:{marginBottom:24},
  progressBarTrack:{
    width:"100%",height:3,background:C.sf2,borderRadius:2,
    overflow:"hidden",marginBottom:10
  },
  progressBarFill:{
    height:"100%",background:`linear-gradient(90deg, ${C.teal}, ${C.gold})`,
    transition:"width 0.6s cubic-bezier(0.16,1,0.3,1)"
  },
  progressBarLabel:{
    display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8
  },
  generateAllBtn:{
    background:C.teal,color:C.bg,border:"none",
    padding:"8px 16px",fontSize:12,fontWeight:600,borderRadius:8,
    cursor:"pointer",fontFamily:"'DM Sans',sans-serif"
  },
  deliverablesGrid:{
    display:"grid",
    gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))",
    gap:16
  },
  addCard:{
    background:C.sf+"40",border:"1px dashed "+C.bd,borderRadius:14,
    padding:18
  },
  addCardLabel:{
    fontSize:10,fontWeight:600,color:C.tx,letterSpacing:1.2,
    marginBottom:12,textTransform:"uppercase"
  },
  addGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:6},
  addBtn:{
    background:"transparent",border:"1px solid "+C.bd,color:C.tx,
    padding:"8px 10px",borderRadius:8,cursor:"pointer",
    display:"flex",alignItems:"center",gap:8,fontSize:11,
    fontFamily:"'DM Sans',sans-serif",transition:"all 0.2s"
  },

  // PRESENT
  presentWrap:{
    position:"fixed",top:0,left:0,right:0,bottom:0,
    background:`linear-gradient(180deg, ${C.bg} 0%, ${C.ink} 100%)`,
    zIndex:9999,display:"flex",flexDirection:"column",
    fontFamily:"'DM Sans',sans-serif"
  },
  slide:{
    flex:1,display:"flex",alignItems:"center",justifyContent:"center",
    padding:"60px 8vw",overflowY:"auto",position:"relative",zIndex:1
  },
  coverSlide:{maxWidth:900,width:"100%",textAlign:"center"},
  coverTitle:{
    fontSize:"clamp(48px, 8vw, 96px)",fontWeight:600,color:C.w,
    lineHeight:1.05,margin:"30px 0 26px",letterSpacing:"-0.03em"
  },
  coverSubtitle:{
    fontSize:"clamp(15px, 1.6vw, 19px)",color:C.tx,
    maxWidth:680,margin:"0 auto",lineHeight:1.6
  },
  coverMeta:{
    marginTop:50,display:"flex",justifyContent:"center",alignItems:"center",
    gap:14,flexWrap:"wrap"
  },
  coverMetaItem:{
    fontSize:11,color:C.tx,letterSpacing:1.5,fontWeight:600
  },
  coverMetaDivider:{color:C.txD},
  endBox:{
    padding:"18px 26px",border:"1px solid "+C.bd,borderRadius:12,
    background:C.sf+"60"
  },
  endBoxLabel:{fontSize:10,color:C.tx,letterSpacing:1,marginBottom:6},
  endBoxValue:{fontSize:14,color:C.w,fontWeight:600},
  contentSlide:{maxWidth:900,width:"100%"},
  contentSlideHeader:{marginBottom:24,paddingBottom:18,borderBottom:"1px solid "+C.bd},
  slideIcon:{
    fontSize:32,width:60,height:60,
    display:"flex",alignItems:"center",justifyContent:"center",
    borderRadius:14,background:C.sf
  },
  slideTitle:{
    fontSize:"clamp(28px, 4vw, 44px)",fontWeight:600,color:C.w,
    margin:"4px 0 0",lineHeight:1.15,letterSpacing:"-0.02em"
  },
  slideContent:{
    fontSize:15,color:C.w,whiteSpace:"pre-wrap",lineHeight:1.8,
    fontFamily:"'DM Sans',sans-serif"
  },
  presentNav:{
    padding:"20px 30px",display:"flex",justifyContent:"space-between",
    alignItems:"center",borderTop:"1px solid "+C.bd,background:C.sf+"60",
    position:"relative",zIndex:2
  },
  exitBtn:{
    background:"transparent",border:"1px solid "+C.bd,color:C.tx,
    padding:"8px 16px",fontSize:12,fontWeight:600,borderRadius:8,
    cursor:"pointer",fontFamily:"'DM Sans',sans-serif"
  },
  slidesDots:{display:"flex",gap:6,alignItems:"center"},
  slideDot:{
    width:8,height:8,borderRadius:"50%",border:"none",
    background:C.bd,cursor:"pointer",padding:0,transition:"all 0.2s"
  },
  slideDotActive:{background:C.gold,width:22,borderRadius:4},
  navBtn:{
    background:C.sf,border:"1px solid "+C.bd,color:C.w,
    width:38,height:38,borderRadius:8,cursor:"pointer",fontSize:15
  },
};
