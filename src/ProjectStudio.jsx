// ProjectStudio.jsx - Estudio Conecta Nex v3
// Wizard 4 pasos: Cliente+Area -> Contexto -> Detalle -> Resumen+Generar
// Diseno: Fraunces + DM Sans, chips, glass cards, CTA alto contraste

import { useState, useEffect } from "react";
import { db } from "./db.js";

const C = {
  bg:"#0B0F1A", sf:"#111827", sf2:"#1A2236", bd:"#2A3550", bdL:"#374151",
  teal:"#2DD4BF", tealD:"#14B8A6", gold:"#F5C563", goldD:"#D4A857",
  blue:"#60A5FA", purple:"#A78BFA", rose:"#FB7185", green:"#4ADE80",
  w:"#F1F5F9", tx:"#94A3B8", txD:"#475569", red:"#EF4444",
  ink:"#020617"
};

// AREAS con emoji y descripcion corta
const AREAS = {
  metaads:    { ic:"📊", lb:"Campana Meta Ads",       desc:"Campana completa Facebook/Instagram con segmentacion, copys y creatividades", cl:C.blue },
  segmentation:{ic:"🎯", lb:"Segmentacion Meta",       desc:"Audiencias quirurgicas: publico frio, retargeting, lookalikes, exclusiones", cl:C.teal },
  landing:    { ic:"📄", lb:"Landing Page",            desc:"Pagina de captacion completa con copy de conversion y FAQs", cl:C.blue },
  social:     { ic:"📱", lb:"Estrategia Redes",        desc:"Plan editorial 30 dias con pilares, calendario y 10 posts", cl:C.purple },
  whatsapp:   { ic:"💬", lb:"Protocolo WhatsApp",      desc:"Arbol de respuestas, mensajes tipo y follow-ups automatizados", cl:C.green },
  seo:        { ic:"🔍", lb:"Articulo SEO",            desc:"Articulo optimizado con keyword research y schema FAQ", cl:C.purple },
  video:      { ic:"🎬", lb:"Scripts de Video",        desc:"5 guiones cortos para Reels/TikTok con hook y CTA segundo a segundo", cl:"#FB923C" },
  gbp:        { ic:"📍", lb:"Google Business Profile", desc:"Optimizacion ficha GBP, posts mensuales y plantillas resenas", cl:C.gold },
  followup:   { ic:"📧", lb:"Secuencia Email",         desc:"Emails de nurturing desde lead hasta cierre con asuntos A/B", cl:C.rose },
  proposal:   { ic:"📋", lb:"Propuesta Comercial",     desc:"Documento profesional: diagnostico, solucion, inversion y ROI", cl:C.gold },
  campaign:   { ic:"🚀", lb:"Campana Multicanal",      desc:"Plan 90 dias Meta+Google+SEO+Email coordinado", cl:C.rose },
  webstruct:  { ic:"🏗️", lb:"Arquitectura Web",        desc:"Mapa de paginas, jerarquia, menus y enlazado interno", cl:C.blue },
  manual:     { ic:"📖", lb:"Manual de Comunicacion",  desc:"Tono de voz, vocabulario y plantillas de respuesta", cl:C.gold }
};

// QUESTIONS organizadas por paso (2 = Contexto, 3 = Detalle)
// type: text | textarea | chip | chip-multi
const QUESTIONS = {
  metaads: [
    { step:2, id:"servicio", q:"Servicio o producto a promocionar", type:"textarea", placeholder:"Ej: Implantes dentales premium con financiacion sin intereses 60 meses", required:true },
    { step:2, id:"objetivo", q:"Objetivo principal de la campana", type:"chip", options:["Captar leads","Llamadas","Visitas/Reservas","WhatsApp","Ventas online","Awareness"], required:true },
    { step:2, id:"presupuesto", q:"Presupuesto mensual (EUR)", type:"text", placeholder:"600", required:true },
    { step:2, id:"geografia", q:"Geografia exacta y radio (km)", type:"text", placeholder:"Alicante centro + Playa San Juan, radio 15 km", required:true },
    { step:3, id:"avatar", q:"Perfil del cliente ideal", type:"textarea", placeholder:"Mujeres 40-60, propietarias de vivienda, hijos en casa, poder adquisitivo medio-alto", required:true },
    { step:3, id:"diferencial", q:"Propuesta de valor unica vs competencia", type:"textarea", placeholder:"Unico centro con cirujano maxilo-facial propio. Financiacion 60 meses sin intereses.", required:true },
    { step:3, id:"tracking", q:"Pixel Meta + CAPI", type:"chip", options:["Ambos OK","Solo Pixel","Nada instalado"], required:true },
    { step:3, id:"listas", q:"Lista clientes para retargeting", type:"chip", options:["+500 contactos","100-500","<100","Sin lista"], required:true },
    { step:3, id:"historial", q:"Historial campanas Meta previo (opcional)", type:"textarea", placeholder:"Si, pero CPL alto >50 EUR. O: nunca hemos hecho ads.", required:false },
    { step:3, id:"oferta", q:"Oferta o gancho del anuncio (opcional)", type:"textarea", placeholder:"Primera consulta + radiografia gratis. Estudio personalizado sin compromiso.", required:false }
  ],
  segmentation: [
    { step:2, id:"servicio", q:"Servicio o producto", type:"textarea", placeholder:"Captar leads de reforma integral de cocinas premium", required:true },
    { step:2, id:"presupuesto", q:"Presupuesto Meta mensual (EUR)", type:"text", placeholder:"600", required:true },
    { step:2, id:"geografia", q:"Geografia exacta y radio", type:"text", placeholder:"Alicante centro + Playa San Juan, radio 15 km", required:true },
    { step:3, id:"avatar", q:"Perfil cliente ideal", type:"textarea", placeholder:"Propietarios vivienda 35-60, ingresos medios-altos, valoran calidad sobre precio", required:true },
    { step:3, id:"listas", q:"Recursos para retargeting", type:"chip", options:["CSV +500 + Pixel","Solo Pixel","Solo CSV","Nada"], required:true },
    { step:3, id:"competencia", q:"Marcas competidoras que conoce tu cliente (opcional)", type:"textarea", placeholder:"Vitaldent, Dentix, Sanitas Dental", required:false },
    { step:3, id:"exclusiones", q:"Publicos a excluir si o si (opcional)", type:"textarea", placeholder:"Clientes actuales, ex empleados, menores de edad", required:false }
  ],
  landing: [
    { step:2, id:"servicio", q:"Que vende esta landing", type:"textarea", placeholder:"Reforma integral de cocinas llave en mano en 4 semanas", required:true },
    { step:2, id:"accion", q:"Accion principal del visitante", type:"chip", options:["Formulario","Llamada","WhatsApp","Reservar cita","Compra online","Descargar PDF"], required:true },
    { step:2, id:"precio", q:"Precio o rango (escribe NO APLICA si no procede)", type:"text", placeholder:"Desde 12.000 EUR. O: Presupuesto a medida sin compromiso", required:true },
    { step:2, id:"tono", q:"Tono de la landing", type:"chip", options:["Cercano (tuteo)","Profesional calido","Estrictamente formal (usted)"], required:true },
    { step:3, id:"miedo", q:"Principal miedo o duda del cliente", type:"textarea", placeholder:"Que se alargue la obra, aparezcan extras, calidad final no sea la esperada", required:true },
    { step:3, id:"prueba", q:"Prueba social que tienes", type:"textarea", placeholder:"200+ reformas finalizadas, 4.8/5 Google, 12 anos en Alicante", required:true },
    { step:3, id:"competencia", q:"Que haces mejor que la competencia", type:"textarea", placeholder:"Solo marcas propias, equipo propio sin subcontratas, presupuesto cerrado sin extras", required:true },
    { step:3, id:"oferta", q:"Urgencia honesta a activar (opcional)", type:"textarea", placeholder:"Reservamos 3 obras al mes para garantizar atencion personalizada", required:false }
  ],
  social: [
    { step:2, id:"objetivo", q:"Objetivo de la estrategia", type:"chip", options:["Captar seguidores","Generar leads","Autoridad de marca","Vender"], required:true },
    { step:2, id:"canales", q:"Canales a trabajar", type:"chip-multi", options:["Instagram","Facebook","TikTok","LinkedIn","YouTube","Twitter/X"], required:true },
    { step:2, id:"frecuencia", q:"Publicaciones por semana", type:"chip", options:["3 por semana","4-5 por semana","Diaria","Mas de 1 al dia"], required:true },
    { step:3, id:"tono", q:"Tono que define la marca", type:"textarea", placeholder:"Cercano, didactico, con humor", required:true },
    { step:3, id:"diferencial", q:"Angulo unico que aportas", type:"textarea", placeholder:"Soy el unico fisio que muestra ANTES Y DESPUES real en video de cada paciente", required:true },
    { step:3, id:"prohibido", q:"Temas o palabras prohibidas (opcional)", type:"textarea", placeholder:"No prometer curaciones. No mostrar antes/despues sin consentimiento.", required:false }
  ],
  whatsapp: [
    { step:2, id:"tipo", q:"Para que tipo de consultas", type:"textarea", placeholder:"Leads que vienen de Meta Ads preguntando por implantes dentales", required:true },
    { step:2, id:"objetivo", q:"Objetivo del protocolo", type:"chip", options:["Cualificar y agendar","Cerrar venta","Resolver dudas","Captar contacto"], required:true },
    { step:2, id:"tiempo_respuesta", q:"Tiempo medio de respuesta", type:"chip", options:["<5 min","30-60 min","Varias horas","Dia siguiente"], required:true },
    { step:3, id:"info_basica", q:"Info que captar de cada lead", type:"textarea", placeholder:"Nombre, ciudad, que servicio le interesa, cuando le viene bien", required:true },
    { step:3, id:"objeciones", q:"3 objeciones mas tipicas", type:"textarea", placeholder:"Es caro, dudo del efecto, no tengo tiempo", required:true },
    { step:3, id:"tono", q:"Como tratas al cliente", type:"chip", options:["Tuteo","Usted","Segun cliente"], required:true }
  ],
  seo: [
    { step:2, id:"keyword", q:"Keyword principal", type:"text", placeholder:"implantes dentales alicante precio", required:true },
    { step:2, id:"intent", q:"Intencion de busqueda", type:"chip", options:["Informativa","Comparar","Local","Comprar ya"], required:true },
    { step:2, id:"longitud", q:"Longitud del articulo", type:"chip", options:["800-1200 palabras","1500-2000","2500+ (pilar)"], required:true },
    { step:3, id:"angulo", q:"Angulo unico del articulo", type:"textarea", placeholder:"Datos reales de pacientes propios. Comparativa de materiales sin marketing.", required:true },
    { step:3, id:"cta", q:"Que hace el lector al final", type:"textarea", placeholder:"Pedir presupuesto. Reservar consulta gratis.", required:true },
    { step:3, id:"competidores", q:"Articulos competidores que rankean (opcional)", type:"textarea", placeholder:"Vitaldent.es tiene un articulo bueno sobre esto", required:false }
  ],
  video: [
    { step:2, id:"plataforma", q:"Plataforma principal", type:"chip", options:["Instagram Reels","TikTok","YouTube Shorts","Las tres","LinkedIn"], required:true },
    { step:2, id:"duracion", q:"Duracion objetivo", type:"chip", options:["15-30 seg","30-60 seg","60-90 seg"], required:true },
    { step:2, id:"persona", q:"Quien aparece en camara", type:"chip", options:["Yo mismo","Empleado","Sin camara (B-roll)","Cliente"], required:true },
    { step:3, id:"tema", q:"Tematica a trabajar", type:"textarea", placeholder:"5 errores que cometes al cepillarte. Reformas express antes/despues.", required:true },
    { step:3, id:"tono", q:"Tono del video", type:"chip", options:["Educativo serio","Educativo con humor","Cercano","Inspiracional"], required:true }
  ],
  gbp: [
    { step:2, id:"servicios", q:"Servicios principales que ofreces", type:"textarea", placeholder:"Implantes, ortodoncia, blanqueamiento, limpieza, urgencias 24h", required:true },
    { step:2, id:"zonas", q:"Zonas geograficas que cubres", type:"textarea", placeholder:"Alicante centro, Playa San Juan, Vistahermosa, Mutxamel", required:true },
    { step:2, id:"horario", q:"Horario de atencion", type:"text", placeholder:"L-V 9h-20h, S 9h-14h, festivos cerrado", required:true },
    { step:3, id:"diferencial", q:"Que te hace destacar en tu zona", type:"textarea", placeholder:"Unico centro con cirujano maxilo-facial. Financiacion propia.", required:true },
    { step:3, id:"resenas_neg", q:"Gestion actual de resenas negativas", type:"chip", options:["Siempre y rapido","A veces","No las contesto","No suelo recibir"], required:false }
  ],
  followup: [
    { step:2, id:"audiencia", q:"Quien recibe la secuencia", type:"textarea", placeholder:"Leads que descargaron guia PDF pero no contrataron", required:true },
    { step:2, id:"oferta", q:"Oferta principal al final", type:"textarea", placeholder:"Consulta gratis + presupuesto sin compromiso", required:true },
    { step:2, id:"longitud", q:"Numero de emails", type:"chip", options:["3 emails","5 emails","7 emails","10+ emails"], required:true },
    { step:3, id:"cadencia", q:"Cada cuanto enviar", type:"chip", options:["Diaria","Cada 2 dias","Cada 3 dias","Semanal"], required:true },
    { step:3, id:"tono", q:"Tono de los emails", type:"chip", options:["Personal/amigo","Profesional cercano","Estrictamente formal"], required:true },
    { step:3, id:"miedo", q:"Principal miedo a rebatir", type:"textarea", placeholder:"Que sea caro. No tener tiempo. Ya lo intento sin exito.", required:true }
  ],
  proposal: [
    { step:2, id:"cliente_tipo", q:"Quien recibe la propuesta", type:"textarea", placeholder:"Carlos Martinez, dueno de Reformas Martinez, factura 800k al ano, 6 empleados", required:true },
    { step:2, id:"diagnostico", q:"Diagnostico actual del cliente", type:"textarea", placeholder:"Clientes por boca a boca, web sin trafico, Instagram abandonado, no hace ads", required:true },
    { step:2, id:"solucion", q:"Solucion que vas a proponer", type:"textarea", placeholder:"Plan integral 6 meses: web nueva, Meta Ads 800/mes, SEO local, Instagram activo", required:true },
    { step:3, id:"presupuesto", q:"Inversion propuesta", type:"text", placeholder:"1.800 EUR/mes durante 6 meses + 3.500 setup inicial", required:true },
    { step:3, id:"plazo", q:"Plazo de la propuesta", type:"text", placeholder:"6 meses con resultados visibles desde mes 2", required:true }
  ],
  campaign: [
    { step:2, id:"objetivo", q:"Objetivo de negocio de la campana", type:"textarea", placeholder:"Lanzar implantes con financiacion. 30 leads/mes y cerrar 8 ventas.", required:true },
    { step:2, id:"presupuesto", q:"Presupuesto total (media + produccion)", type:"text", placeholder:"2.500 EUR/mes durante 3 meses", required:true },
    { step:2, id:"plazo", q:"Duracion de la campana", type:"chip", options:["30 dias","90 dias","6 meses","Continuo"], required:true },
    { step:3, id:"canales", q:"Canales a activar", type:"chip-multi", options:["Meta Ads","Google Ads","SEO","Email","Redes","Influencers","PR"], required:true },
    { step:3, id:"mensaje", q:"Mensaje principal unico", type:"textarea", placeholder:"Sonrie sin pensar en el precio. Financiacion 60 meses sin intereses.", required:true }
  ],
  webstruct: [
    { step:2, id:"tipo_web", q:"Tipo de web", type:"chip", options:["Corporativa","Ecommerce","Profesional/Clinica","Landing","Multi-servicios"], required:true },
    { step:2, id:"servicios", q:"Servicios principales", type:"textarea", placeholder:"Implantes, ortodoncia, blanqueamiento, limpieza, urgencias 24h", required:true },
    { step:3, id:"objetivo", q:"Accion principal del visitante", type:"chip", options:["Pedir cita","Llamar","Formulario","Comprar","WhatsApp"], required:true },
    { step:3, id:"seo", q:"SEO local", type:"chip", options:["Si, principal","Si, secundario","No"], required:true }
  ],
  manual: [
    { step:2, id:"valores", q:"3 valores que definen la marca", type:"textarea", placeholder:"Cercania, transparencia, profesionalidad", required:true },
    { step:2, id:"diferencial", q:"Que hace unica a la marca", type:"textarea", placeholder:"Unicos en la zona con tecnologia X, atencion personalizada por la duena", required:true },
    { step:3, id:"tono", q:"Tono de la comunicacion", type:"chip", options:["Cercano (tuteo)","Profesional calido","Estrictamente formal (usted)"], required:true },
    { step:3, id:"prohibido", q:"Palabras prohibidas (opcional)", type:"textarea", placeholder:"Barato. Mejor que la competencia. Garantizado.", required:false }
  ]
};

export default function ProjectStudio({ setAct }){
  const [step, setStep] = useState(1); // 1, 2, 3, 4, "generating", "result"
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [area, setArea] = useState("");
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState("");
  const [err, setErr] = useState("");
  const [sessions, setSessions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [provider, setProvider] = useState(() => localStorage.getItem("cliniq_provider") || "groq");

  // Mapeo de proveedores -> modelo + label visible
  const PROVIDERS = {
    groq:      { lb:"Groq Llama 4",  ic:"🚀", model:"meta-llama/llama-4-maverick-17b-128e-instruct", desc:"Gratis, rapido", color:C.teal },
    anthropic: { lb:"Claude Sonnet 4", ic:"💎", model:"claude-sonnet-4-20250514", desc:"Maxima calidad, requiere creditos", color:C.gold },
    deepseek:  { lb:"DeepSeek Chat",   ic:"⚡", model:"deepseek-chat", desc:"Economico, calidad alta", color:C.purple }
  };

  const setProviderPersist = (p) => {
    setProvider(p);
    try{ localStorage.setItem("cliniq_provider", p); }catch{}
  };

  useEffect(()=>{
    db.getClients().then(d=>setClients(d||[]));
    try{
      const raw = localStorage.getItem("cliniq_sessions") || "[]";
      setSessions(JSON.parse(raw));
    }catch{}
  },[]);

  useEffect(()=>{
    if(!document.getElementById("fraunces-font")){
      const link = document.createElement("link");
      link.id = "fraunces-font";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&display=swap";
      document.head.appendChild(link);
    }
    if(!document.getElementById("studio-css")){
      const s = document.createElement("style");
      s.id = "studio-css";
      s.innerHTML = ".studio-display{font-family:'Fraunces',Georgia,serif;letter-spacing:-0.02em}.studio-mono{font-family:'JetBrains Mono','SF Mono',Consolas,monospace;letter-spacing:-0.02em}@keyframes sFade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes sPulse{0%,100%{opacity:.6}50%{opacity:1}}@keyframes sBlink{0%,100%{opacity:1}50%{opacity:0}}@keyframes sShine{0%{background-position:-200% 0}100%{background-position:200% 0}}.s-fadein{animation:sFade .5s cubic-bezier(.16,1,.3,1) both}.s-pulse{animation:sPulse 2s ease-in-out infinite}.s-blink{animation:sBlink 1s infinite}.s-card:hover{transform:translateY(-3px);border-color:"+C.teal+"80 !important;background:"+C.sf2+" !important;cursor:pointer;box-shadow:0 8px 32px rgba(45,212,191,.12)}.s-chip:hover{border-color:"+C.teal+" !important;background:"+C.sf2+" !important;transform:translateY(-1px)}.s-cta:hover{transform:translateY(-2px);box-shadow:0 12px 40px rgba(245,197,99,.4)}.s-cta-shine{background:linear-gradient(90deg,"+C.gold+" 0%,#FFE5A0 50%,"+C.gold+" 100%);background-size:200% 100%;animation:sShine 3s linear infinite}";
      document.head.appendChild(s);
    }
  },[]);

  const sel = clients.find(c => String(c.id) === String(clientId));
  const allQs = QUESTIONS[area] || [];
  const qStep2 = allQs.filter(q => q.step === 2);
  const qStep3 = allQs.filter(q => q.step === 3);

  const setAns = (id, v) => setAnswers(p => ({...p, [id]: v}));

  const isStepValid = (s) => {
    const qs = s === 2 ? qStep2 : s === 3 ? qStep3 : [];
    return qs.every(q => {
      if(!q.required) return true;
      const v = answers[q.id];
      if(!v) return false;
      if(typeof v === "string" && !v.trim()) return false;
      if(Array.isArray(v) && v.length === 0) return false;
      return true;
    });
  };

  const goNext = () => {
    setErr("");
    if(step === 1){
      if(!clientId || !area){
        setErr("Selecciona cliente y area antes de continuar");
        return;
      }
      setStep(2);
    } else if(step === 2){
      if(!isStepValid(2)){
        setErr("Completa todos los campos obligatorios");
        return;
      }
      setStep(3);
    } else if(step === 3){
      if(!isStepValid(3)){
        setErr("Completa todos los campos obligatorios");
        return;
      }
      setStep(4);
    }
  };

  const goBack = () => {
    setErr("");
    if(typeof step === "number" && step > 1) setStep(step - 1);
    else if(step === "result" || step === "generating") setStep(4);
  };

  const startArea = (key) => {
    setArea(key);
    setAnswers({});
    setErr("");
  };

  const resetAll = () => {
    setStep(1);
    setArea("");
    setAnswers({});
    setResult("");
    setErr("");
    setCustomPrompt("");
  };

  // Construye super prompt
  const buildPrompt = () => {
    const A = AREAS[area];
    const niche = sel?.nicho || "Servicio profesional";
    const geo = sel?.ciudad_fiscal || sel?.ciudadFiscal || "Espana";
    const prov = sel?.provincia_fiscal || sel?.provinciaFiscal || "";

    const lines = allQs.map(qx => {
      const a = answers[qx.id];
      if(!a) return null;
      const v = Array.isArray(a) ? a.join(", ") : a;
      return qx.q + ":\n" + v;
    }).filter(Boolean).join("\n\n");

    return "PROYECTO: " + A.lb + "\nCLIENTE: " + sel.nombre + "\nNICHO: " + niche + "\nCIUDAD: " + geo + (prov?", "+prov:"") + "\n\nDATOS RECOGIDOS DEL CLIENTE:\n\n" + lines + "\n\nPRODUCE el entregable completo siguiendo las mejores practicas de " + A.lb + " para este nicho concreto en Espana 2026. Usa toda la informacion arriba para que el output sea quirurgico y especifico, no generico. Entregable listo para implementar.";
  };

  const buildSystem = () => {
    const niche = sel?.nicho || "Servicio profesional";
    const geo = sel?.ciudad_fiscal || sel?.ciudadFiscal || "Espana";
    const ctx = "Cliente: " + sel.nombre + ". Nicho: " + niche + ". Ciudad: " + geo + ". ANO ACTUAL: 2026.";
    const style = "Espanol de Espana, comillas rectas, sin emojis, sin asteriscos, sin markdown. Si faltan datos del cliente marca [COMPLETAR]. Tono profesional pero cercano.";

    if(area === "metaads") return "Eres media buyer senior con 10 anos en Meta Ads para negocios locales en Espana, experto en " + niche + ". " + ctx + "\n\nBIBLIOTECA META ESPANA 2026:\n- CPL benchmarks: reformas 18-45 EUR, dental 12-28 EUR, estetica 8-22 EUR, fisio 10-25 EUR, restaurantes 3-8 EUR, academias 8-18 EUR, inmobiliaria 15-40 EUR, B2B 25-60 EUR\n- Objetivos ODAX 2026: Awareness, Trafico, Interaccion, Leads, App, Ventas\n- Advantage+ Shopping para ecommerce con catalogo\n- Advantage Detailed Targeting activado por defecto\n- Regla 50 conversiones/semana por ad set\n- Pixel + CAPI obligatorio post iOS 14.5+\n- Atribucion fiable: 7-day click + 1-day view\n- Frequency cap: max 2.5 en frio, max 4 en retargeting\n\nINTERESES META REALES POR NICHO (marcar siempre [VERIFICAR EN META]):\nDental: Implantes dentales, Ortodoncia, Vitaldent, Dentix, Sonrisa, Carillas dentales, Invisalign\nReformas: Reformas del hogar, Decoracion del hogar, Leroy Merlin, IKEA, Propietarios viviendas, Cocinas\nEstetica: Botox, Acido hialuronico, Depilacion laser, Medicina estetica, Belleza\nFisio: Fisioterapia, Lesiones deportivas, Dolor de espalda, Osteopatia, Pilates\nRestaurantes: El Tenedor, TripAdvisor, Foodie, Cocina mediterranea\n\nPRODUCE propuesta Meta Ads completa lista para Ads Manager:\n1. RESUMEN EJECUTIVO (4-6 lineas con benchmarks aplicables)\n2. OBJETIVO ODAX, estructura ad sets, anuncios, placements, CAPI SI/NO, Advantage Campaign Budget SI/NO\n3. PRESUPUESTO diario/mensual, CPL estimado, leads esperados, CAC objetivo\n4. SEGMENTACION DETALLADA POR AD SET: geo+radio, edad razonada, genero, intereses concretos [VERIFICAR EN META], comportamientos, exclusiones, tamano publico\n5. PUBLICOS PERSONALIZADOS: visitantes 30/60/180d, listas CSV, IG/FB 365d, video viewers, lead form openers. Eventos pixel/CAPI necesarios.\n6. LOOKALIKES priorizados con % y fuente\n7. BRIEFING 3 CREATIVIDADES: concepto, formato, ratio, hook 3seg\n8. 3 COPYS COMPLETOS: primary 125c, headline 27c, description 27c, CTA, URL+UTMs\n9. KPIs, umbrales pausa, tests A/B, plan optimizacion lunes/miercoles/viernes\n10. RIESGOS Y PLAN B\n\n" + style;

    if(area === "segmentation") return "Eres especialista senior en segmentacion Meta Ads para " + niche + " en " + geo + ". " + ctx + "\n\nCONOCIMIENTO META 2026:\n- Advantage Detailed Targeting expande audiencias\n- Audiencias <500.000 dan poca senal\n- Pixel + CAPI obligatorio\n- Custom Audiences: web visitors max 180d\n- Lookalike 1% mas preciso\n- Geo radius minimo 17km\n\nPRODUCE segmentacion Meta quirurgica:\n1. ANALISIS BUYER PERSONA\n2. PUBLICO FRIO: geo+radio, edad razonada, intereses [VERIFICAR EN META] (10-15), comportamientos, tamano\n3. PUBLICO BROAD: cuando usar\n4. RETARGETING CUSTOM AUDIENCES: visitantes 30/90/180d, eventos pixel, CSV, IG/FB 365d, video viewers\n5. LOOKALIKES priorizados: 1% mejores clientes, 1% leads, 1% compradores\n6. EXCLUSIONES OBLIGATORIAS\n7. ARQUITECTURA 3-5 AD SETS con presupuesto %\n8. PLAN TESTING: regla 50, aprendizaje 7d, escalado/pausa\n9. INSTRUCCIONES IMPLEMENTACION\n\n" + style;

    if(area === "landing") return "Eres copywriter senior de landing pages de conversion para " + niche + " local. " + ctx + "\n\nPRODUCE landing completa:\n1. HERO: titular max 12 palabras, subtitular max 25, CTA\n2. PROPUESTA DE VALOR: 3-4 bullets concretos\n3. PRUEBA SOCIAL: 3 testimonios con perfil\n4. DESCRIPCION SERVICIO: 2-3 parrafos\n5. COMO FUNCIONA: 3-4 pasos\n6. PRECIOS o RANGO si aplica\n7. FAQs: 5 preguntas reales\n8. CTA FINAL con urgencia honesta + formulario\n9. SEO: meta titulo max 60c, meta descripcion max 155c, keyword principal y 5 secundarias\n\n" + style;

    if(area === "whatsapp") return "Eres especialista en protocolos WhatsApp Business para " + niche + ". " + ctx + "\n\nPRODUCE protocolo completo:\n1. SALUDO INICIAL automatico\n2. ARBOL DE RESPUESTAS por tipo de consulta (3-5 ramas)\n3. PROTOCOLO LEAD NUEVO: 5-7 mensajes desde primer contacto a cita\n4. 8-10 RESPUESTAS RAPIDAS pre-grabadas\n5. SEGUIMIENTO NO RESPUESTA: 3 follow-ups (24h, 72h, 7d)\n6. CIERRE CITA: confirmacion, recordatorio 24h, recordatorio 2h\n7. POST-VISITA: seguimiento + peticion resena\n8. PROTOCOLO QUEJAS\n\nCada mensaje listo para pegar, sin asteriscos. " + style;

    if(area === "seo") return "Eres redactor SEO experto en " + niche + " local 2026. " + ctx + "\n\nPRODUCE articulo SEO completo:\n- Keyword principal y 3 long-tail\n- Meta titulo max 60c y meta descripcion max 155c\n- H1 con keyword\n- Articulo estructurado con H2 y H3\n- Densidad keyword natural 1-2%\n- Bloque FAQ con 5 preguntas\n- 3 anchor texts internos sugeridos\n- Conclusion con CTA\n\n" + style;

    if(area === "social") return "Eres estratega senior de redes sociales para " + niche + ". " + ctx + "\n\nPRODUCE estrategia 30 dias:\n- 4-5 PILARES DE CONTENIDO con peso %\n- FRECUENCIA por canal con dias concretos\n- CALENDARIO TIPO DE SEMANA\n- 10 IDEAS DE POST CONCRETAS: formato, hook, copy, hashtags, CTA\n- 1 CARRUSEL EDUCATIVO (5-7 slides)\n- RECOMENDACIONES STORIES diarias\n\n" + style;

    if(area === "video") return "Eres guionista de video corto vertical para redes en " + niche + ". " + ctx + "\n\nPRODUCE 5 scripts de video corto. Para cada uno:\n- Titulo\n- Hook 3 primeros segundos\n- Estructura segundo a segundo\n- Texto en pantalla\n- Voz en off / dialogo\n- Cierre con CTA\n- Hashtags recomendados\n\n" + style;

    if(area === "gbp") return "Eres especialista en Google Business Profile para " + niche + " local 2026. " + ctx + "\n\nPRODUCE optimizacion GBP completa:\n1. 4-5 versiones de descripcion del negocio\n2. Categorias primaria y secundarias\n3. Atributos a marcar\n4. 8-12 productos/servicios con descripcion\n5. 10 ideas de publicaciones GBP con copy completo\n6. Plantillas respuesta resenas (5*, 3*, 1-2*)\n7. 10 preguntas Q&A\n8. Plan de fotos\n\n" + style;

    if(area === "followup") return "Eres especialista email marketing y secuencias automatizadas para " + niche + ". " + ctx + "\n\nPRODUCE secuencia email completa. Para cada email:\n- Cuando se envia (dia desde inscripcion)\n- Asunto (3 variantes A/B)\n- Preheader\n- Cuerpo 300-500 palabras\n- CTA con texto exacto del boton\n- Objetivo concreto del email\n\n" + style;

    if(area === "proposal") return "Eres comercial senior B2B preparando propuesta para " + niche + ". " + ctx + "\n\nPRODUCE propuesta comercial completa:\n1. Resumen ejecutivo (1 pagina)\n2. Diagnostico actual cliente\n3. Solucion por modulos detallada\n4. Cronograma semana a semana\n5. Inversion: 3 opciones (basica, recomendada, premium)\n6. ROI estimado y casos comparables\n7. Equipo asignado\n8. Garantias y compromisos\n9. Siguientes pasos\n\n" + style;

    if(area === "campaign") return "Eres director de campana multicanal para " + niche + " local. " + ctx + "\n\nPRODUCE plan campana:\n1. Objetivo y KPIs\n2. Mensaje principal y 3-5 angulos creativos\n3. Activacion por canal detallada (Meta Ads, Google Ads, SEO, Email, Redes)\n4. Cronograma semana a semana\n5. Presupuesto total y por canal\n6. Sistema medicion y reporting\n\n" + style;

    if(area === "webstruct") return "Eres arquitecto informacion web para " + niche + ". " + ctx + "\n\nPRODUCE arquitectura web completa:\n1. Sitemap textual con jerarquia\n2. Por cada pagina: H1, objetivo, secciones, CTA\n3. Estructura menu principal y footer\n4. URLs/slugs propuestos\n5. Estrategia enlazado interno\n6. Paginas legales obligatorias\n\n" + style;

    if(area === "manual") return "Eres consultor comunicacion corporativa para " + niche + ". " + ctx + "\n\nPRODUCE manual de comunicacion:\n1. Tono de voz: 5-7 principios con ejemplos correctos e incorrectos\n2. Vocabulario: usar/evitar\n3. Estructura respuesta cliente\n4. 10 plantillas para situaciones tipicas\n5. Manejo crisis y resenas negativas\n6. Reglas emojis/mayusculas/exclamaciones\n7. Estilo por canal\n\n" + style;

    return "Estratega marketing digital para negocios locales Espana. " + ctx + "\n" + style;
  };

  const execute = async () => {
    setStep("generating");
    setResult("");
    setErr("");

    const system = buildSystem();
    const promptToUse = customPrompt && customPrompt.trim() ? customPrompt : buildPrompt();
    // Limites segun proveedor (Groq y DeepSeek tienen tope distinto a Anthropic)
    const maxTokens = provider === "anthropic"
      ? (area === "metaads" ? 8192 : (area === "segmentation" || area === "campaign" || area === "proposal" || area === "manual") ? 6144 : 4096)
      : (area === "metaads" ? 8000 : (area === "segmentation" || area === "campaign" || area === "proposal" || area === "manual") ? 6000 : 4000);

    const P = PROVIDERS[provider];

    try{
      const r = await fetch("/api/generate", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          provider,
          model: P.model,
          max_tokens: maxTokens,
          stream:true,
          system,
          messages:[{role:"user", content:promptToUse}],
          hint: "Wizard " + AREAS[area].lb + " (" + P.lb + ")"
        })
      });

      if(!r.ok){
        let errText = "";
        try{ errText = await r.text(); }catch{}
        setErr("Error " + r.status + ": " + errText.slice(0, 300));
        setStep(4);
        return;
      }

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      let buffer = "";
      let streamErr = null;

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
              setResult(full);
            }
            if(ev.type==="error" && ev.error?.message){
              streamErr = ev.error.message;
            }
          }catch{}
        }
      }

      if(streamErr){
        setErr("Error IA: " + streamErr);
        setStep(4);
        return;
      }
      if(!full || full.length < 50){
        setErr("Respuesta vacia. Reintenta.");
        setStep(4);
        return;
      }
      setResult(full);
      setStep("result");
      saveSession(full);
    }catch(e){
      setErr("Error de conexion: " + (e.message || String(e)));
      setStep(4);
    }
  };

  const saveSession = (txt) => {
    const session = {
      id: Date.now(),
      date: new Date().toISOString(),
      clientId,
      clientName: sel?.nombre || "",
      area,
      areaLabel: AREAS[area].lb,
      answers: {...answers},
      result: txt
    };
    try{
      const raw = localStorage.getItem("cliniq_sessions") || "[]";
      const list = JSON.parse(raw);
      list.unshift(session);
      const trimmed = list.slice(0, 30);
      localStorage.setItem("cliniq_sessions", JSON.stringify(trimmed));
      setSessions(trimmed);
    }catch{}
  };

  const loadSession = (s) => {
    setClientId(s.clientId);
    setArea(s.area);
    setAnswers(s.answers || {});
    setResult(s.result);
    setStep("result");
    setShowHistory(false);
  };

  // === RENDER COMPONENTS ===

  const Stepper = () => {
    const steps = [
      {n:1, lb:"Cliente y area"},
      {n:2, lb:"Contexto"},
      {n:3, lb:"Detalle"},
      {n:4, lb:"Resumen y crear"}
    ];
    const currentNum = typeof step === "number" ? step : 4;
    return <div style={S.stepper}>
      {steps.map((s, i) => {
        const done = currentNum > s.n;
        const active = currentNum === s.n;
        return <div key={s.n} style={{display:"flex",alignItems:"center",gap:10,flex:i<3?1:0}}>
          <div style={{...S.stepCircle, ...(done?S.stepCircleDone:active?S.stepCircleActive:{})}}>
            {done ? "✓" : s.n}
          </div>
          <div style={{...S.stepLabel, color: done||active ? C.w : C.txD}} className="studio-mono">{s.lb}</div>
          {i < 3 && <div style={{...S.stepLine, background: done ? C.teal : C.bd}}/>}
        </div>;
      })}
    </div>;
  };

  const renderField = (q) => {
    const v = answers[q.id];
    if(q.type === "text"){
      return <input value={v||""} onChange={e=>setAns(q.id, e.target.value)} placeholder={q.placeholder} style={S.input}/>;
    }
    if(q.type === "textarea"){
      return <textarea value={v||""} onChange={e=>setAns(q.id, e.target.value)} placeholder={q.placeholder} style={S.textarea} rows={3}/>;
    }
    if(q.type === "chip"){
      return <div style={S.chipsGrid}>
        {q.options.map(opt => <button key={opt} onClick={()=>setAns(q.id, opt)} style={{...S.chip, ...(v===opt?S.chipActive:{})}} className="s-chip">{opt}</button>)}
      </div>;
    }
    if(q.type === "chip-multi"){
      const arr = Array.isArray(v) ? v : [];
      return <div style={S.chipsGrid}>
        {q.options.map(opt => {
          const on = arr.includes(opt);
          return <button key={opt} onClick={()=>setAns(q.id, on ? arr.filter(x=>x!==opt) : [...arr, opt])} style={{...S.chip, ...(on?S.chipActive:{})}} className="s-chip">
            {on?"✓ ":""}{opt}
          </button>;
        })}
      </div>;
    }
    return null;
  };

  // === PASO 1: Cliente + Area ===
  if(step === 1){
    return <div style={S.wrap}>
      <div style={S.container}>

        <header className="s-fadein" style={{marginBottom:30}}>
          <div style={S.eyebrow}>
            <span style={S.eyebrowDot}/>
            <span style={S.eyebrowText}>CONECTA NEX · ESTUDIO DE PRODUCCION</span>
          </div>
          <h1 style={S.title} className="studio-display">
            ¿Que <em style={{color:C.gold,fontStyle:"italic",fontWeight:400}}>producimos</em> hoy?
          </h1>
          <p style={S.subtitle}>
            Elige el cliente y el area. En 4 pasos producimos un entregable profesional a medida del nicho.
          </p>
        </header>

        <Stepper/>

        <div style={S.formCard} className="s-fadein">

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
            <label style={S.label} className="studio-mono">CLIENTE</label>
            {sessions.length > 0 && <button onClick={()=>setShowHistory(true)} style={S.ghostMini}>Sesiones anteriores ({sessions.length})</button>}
          </div>
          <select value={clientId} onChange={e=>setClientId(e.target.value)} style={S.select}>
            <option value="">— Selecciona un cliente —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.nicho?"· "+c.nicho:""}</option>)}
          </select>
          {clients.length === 0 && <p style={S.helpText}>No tienes clientes todavia. <a onClick={()=>setAct("clients")} style={S.linkInline}>Crea uno aqui</a>.</p>}

          {sel && <div style={S.clientChip} className="s-fadein">
            <div style={S.clientAvatar} className="studio-display">{sel.nombre.charAt(0).toUpperCase()}</div>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:14,fontWeight:600,color:C.w}}>{sel.nombre}</div>
              <div style={{fontSize:12,color:C.tx,marginTop:2}}>{sel.nicho || "Sin nicho"} · {sel.ciudad_fiscal || sel.ciudadFiscal || "Sin ciudad"}</div>
            </div>
          </div>}

          {sel && <div style={{marginTop:28}}>
            <label style={S.label} className="studio-mono">MOTOR DE IA</label>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",gap:10}}>
              {Object.entries(PROVIDERS).map(([key, P]) => {
                const on = provider === key;
                return <button key={key} onClick={()=>setProviderPersist(key)} style={{
                  background: on ? P.color+"15" : C.bg,
                  border: "1px solid " + (on ? P.color : C.bd),
                  color: on ? P.color : C.w,
                  padding:"12px 14px",borderRadius:10,cursor:"pointer",
                  fontFamily:"inherit",textAlign:"left",transition:"all .2s"
                }} className="s-chip">
                  <div style={{fontSize:18,marginBottom:4}}>{P.ic}</div>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{P.lb}</div>
                  <div style={{fontSize:10,opacity:0.7}}>{P.desc}</div>
                </button>;
              })}
            </div>
          </div>}

          {sel && <div style={{marginTop:28}}>
            <label style={S.label} className="studio-mono">AREA DE MARKETING A PRODUCIR</label>
            <div style={S.areasGrid}>
              {Object.entries(AREAS).map(([key, A]) => {
                const selected = area === key;
                return <div key={key} onClick={()=>startArea(key)} style={{...S.areaCard, ...(selected?S.areaCardActive:{})}} className="s-card">
                  <div style={{...S.areaEmoji, background: selected ? A.cl+"25" : A.cl+"12"}}>{A.ic}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={S.areaName} className="studio-display">{A.lb}</div>
                    <div style={S.areaDesc}>{A.desc}</div>
                  </div>
                  {selected && <div style={{...S.areaCheck, background:A.cl}}>✓</div>}
                </div>;
              })}
            </div>
          </div>}

          {err && <div style={S.errMsg}>{err}</div>}

          {sel && area && <div style={{marginTop:30,display:"flex",justifyContent:"flex-end"}}>
            <button onClick={goNext} style={S.primaryBtn}>Empezar producir →</button>
          </div>}

        </div>

        {showHistory && <div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget)setShowHistory(false);}}>
          <div style={S.panel}>
            <div style={S.panelHeader}>
              <h3 style={{margin:0,fontSize:15,fontWeight:700,color:C.w}} className="studio-display">Sesiones recientes</h3>
              <button onClick={()=>setShowHistory(false)} style={S.iconBtn}>×</button>
            </div>
            <div>
              {sessions.map(s => <div key={s.id} onClick={()=>loadSession(s)} style={S.historyItem}>
                <div style={{fontSize:13,fontWeight:600,color:C.w,marginBottom:3}}>{s.areaLabel}</div>
                <div style={{fontSize:11,color:C.tx}}>{s.clientName} · {new Date(s.date).toLocaleDateString("es-ES")}</div>
              </div>)}
            </div>
          </div>
        </div>}

      </div>
    </div>;
  }

  // === PASO 2 y 3: Preguntas agrupadas ===
  if(step === 2 || step === 3){
    const A = AREAS[area];
    const qs = step === 2 ? qStep2 : qStep3;
    const title = step === 2 ? "Contexto del proyecto" : "Detalle profesional";
    const subtitle = step === 2
      ? "Las preguntas clave para que el output sea quirurgico."
      : "Datos profesionales que marcan la diferencia con un output generico.";

    return <div style={S.wrap}>
      <div style={S.container}>

        <header className="s-fadein" style={{marginBottom:24}}>
          <div style={S.eyebrow}>
            <span style={S.eyebrowDot}/>
            <span style={S.eyebrowText}>{A.ic} {A.lb.toUpperCase()} · {sel?.nombre?.toUpperCase()}</span>
          </div>
          <h1 style={{...S.title,fontSize:"clamp(34px, 5vw, 56px)"}} className="studio-display">
            {title}
          </h1>
          <p style={S.subtitle}>{subtitle}</p>
        </header>

        <Stepper/>

        <div style={S.formCard} className="s-fadein">
          {qs.map(q => <div key={q.id} style={S.questionBlock}>
            <label style={S.label} className="studio-mono">
              {q.q}
              {!q.required && <span style={{color:C.txD,fontWeight:400,marginLeft:8,textTransform:"none",letterSpacing:0}}>(opcional)</span>}
            </label>
            {renderField(q)}
          </div>)}

          {err && <div style={S.errMsg}>{err}</div>}

          <div style={S.navRow}>
            <button onClick={goBack} style={S.ghostBtn}>← Atras</button>
            <button onClick={goNext} style={S.primaryBtn}>
              {step === 3 ? "Ver resumen →" : "Siguiente →"}
            </button>
          </div>
        </div>

      </div>
    </div>;
  }

  // === PASO 4: Resumen + CTA ===
  if(step === 4){
    const A = AREAS[area];
    return <div style={S.wrap}>
      <div style={S.container}>

        <header className="s-fadein" style={{marginBottom:24}}>
          <div style={S.eyebrow}>
            <span style={{...S.eyebrowDot,background:C.gold}}/>
            <span style={S.eyebrowText}>RESUMEN · LISTO PARA CREAR</span>
          </div>
          <h1 style={{...S.title,fontSize:"clamp(34px, 5vw, 56px)"}} className="studio-display">
            Todo listo, vamos a <em style={{color:C.gold,fontStyle:"italic",fontWeight:400}}>producir</em>
          </h1>
          <p style={S.subtitle}>Revisa los datos. Al pulsar el boton, la IA producira el entregable completo.</p>
        </header>

        <Stepper/>

        <div style={S.summaryCard} className="s-fadein">

          <div style={S.summaryHeader}>
            <div style={{...S.areaEmoji, background:A.cl+"20", width:56, height:56, fontSize:30}}>{A.ic}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:C.tx,letterSpacing:1.2,fontFamily:"'JetBrains Mono',monospace"}}>VAS A PRODUCIR</div>
              <div style={{fontSize:22,fontWeight:600,color:C.w,marginTop:2}} className="studio-display">{A.lb}</div>
              <div style={{fontSize:13,color:C.tx,marginTop:4}}>para {sel.nombre}</div>
            </div>
          </div>

          <div style={S.summaryDivider}/>

          <div style={S.summaryTable}>
            <div style={S.summaryRow}>
              <div style={S.summaryKey}>Motor IA</div>
              <div style={S.summaryVal}>{PROVIDERS[provider].ic} {PROVIDERS[provider].lb}</div>
            </div>
            <div style={S.summaryRow}>
              <div style={S.summaryKey}>Cliente</div>
              <div style={S.summaryVal}>{sel.nombre}</div>
            </div>
            <div style={S.summaryRow}>
              <div style={S.summaryKey}>Nicho</div>
              <div style={S.summaryVal}>{sel.nicho || "Sin definir"}</div>
            </div>
            <div style={S.summaryRow}>
              <div style={S.summaryKey}>Ciudad</div>
              <div style={S.summaryVal}>{sel.ciudad_fiscal || sel.ciudadFiscal || "Sin definir"}</div>
            </div>
            {allQs.map(q => {
              const v = answers[q.id];
              if(!v) return null;
              const val = Array.isArray(v) ? v.join(", ") : v;
              return <div key={q.id} style={S.summaryRow}>
                <div style={S.summaryKey}>{q.q}</div>
                <div style={S.summaryVal}>{val}</div>
              </div>;
            })}
          </div>

          {err && <div style={S.errMsg}>{err}</div>}

          <div style={S.ctaBlock}>
            <button onClick={execute} style={S.ctaPrimary} className="s-cta">
              <span style={{fontSize:18,marginRight:8}}>✨</span>
              Crear contenido con IA
            </button>
            <div style={{marginTop:14,display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
              <button onClick={()=>setStep(2)} style={S.ghostBtn}>← Editar respuestas</button>
              <button onClick={()=>{ setCustomPrompt(customPrompt || buildPrompt()); setShowAdvanced(true); }} style={S.ghostBtn}>Ajustar prompt avanzado</button>
            </div>
          </div>

        </div>

        {showAdvanced && <div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget)setShowAdvanced(false);}}>
          <div style={{...S.panel, maxWidth:720, maxHeight:"calc(100vh - 40px)"}}>
            <div style={S.panelHeader}>
              <h3 style={{margin:0,fontSize:15,fontWeight:700,color:C.w}} className="studio-display">Prompt avanzado (editable)</h3>
              <button onClick={()=>setShowAdvanced(false)} style={S.iconBtn}>×</button>
            </div>
            <div style={{padding:"4px 0"}}>
              <textarea value={customPrompt} onChange={e=>setCustomPrompt(e.target.value)} style={{...S.textarea,borderRadius:0,border:"none",borderTop:"1px solid "+C.bd,minHeight:380,background:C.bg}} rows={20}/>
              <div style={{padding:"14px 20px",borderTop:"1px solid "+C.bd,display:"flex",gap:10,justifyContent:"space-between",flexWrap:"wrap"}}>
                <button onClick={()=>{setCustomPrompt(""); setShowAdvanced(false);}} style={S.ghostBtn}>Resetear y usar resumen</button>
                <button onClick={()=>setShowAdvanced(false)} style={S.primaryBtn}>Guardar cambios</button>
              </div>
            </div>
          </div>
        </div>}

      </div>
    </div>;
  }

  // === GENERATING: streaming ===
  if(step === "generating"){
    const A = AREAS[area];
    return <div style={S.wrap}>
      <div style={S.container}>

        <header style={{marginBottom:24}}>
          <div style={S.eyebrow}>
            <span style={{...S.eyebrowDot,background:A.cl}} className="s-pulse"/>
            <span style={S.eyebrowText}>{A.ic} PRODUCIENDO {A.lb.toUpperCase()}...</span>
          </div>
          <h1 style={{...S.title,fontSize:"clamp(28px, 4vw, 44px)"}} className="studio-display">
            La IA esta <em style={{color:A.cl,fontStyle:"italic",fontWeight:400}}>creando</em>
          </h1>
        </header>

        <div style={{...S.formCard,minHeight:340}}>
          <div style={{whiteSpace:"pre-wrap",color:C.w,fontSize:14,lineHeight:1.8,fontFamily:"'DM Sans',sans-serif"}}>
            {result || <span style={{color:C.tx}}>Iniciando produccion...</span>}
            <span className="s-blink" style={{display:"inline-block",width:6,height:14,background:A.cl,marginLeft:2,verticalAlign:"text-bottom"}}/>
          </div>
        </div>

      </div>
    </div>;
  }

  // === RESULT: entregable final ===
  if(step === "result"){
    const A = AREAS[area];
    return <div style={S.wrap}>
      <div style={S.container}>

        <header className="s-fadein" style={{marginBottom:24}}>
          <div style={S.eyebrow}>
            <span style={{...S.eyebrowDot,background:C.green}}/>
            <span style={S.eyebrowText}>LISTO · {sel?.nombre?.toUpperCase()}</span>
          </div>
          <h1 style={{...S.title,fontSize:"clamp(32px, 4.5vw, 50px)"}} className="studio-display">
            {A.ic} {A.lb}
          </h1>
          <p style={S.subtitle}>Entregable producido. Copialo, regeneralo o produce otro.</p>
        </header>

        <div style={S.formCard} className="s-fadein">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <span className="studio-mono" style={{fontSize:11,color:C.tx,letterSpacing:1}}>{result.length} CARACTERES</span>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{navigator.clipboard.writeText(result); alert("Copiado");}} style={S.ghostBtn}>Copiar</button>
              <button onClick={execute} style={S.ghostBtn}>Regenerar</button>
            </div>
          </div>
          <div style={{whiteSpace:"pre-wrap",color:C.w,fontSize:14,lineHeight:1.8,fontFamily:"'DM Sans',sans-serif",maxHeight:600,overflowY:"auto",padding:20,background:C.bg,border:"1px solid "+C.bd,borderRadius:12}}>
            {result}
          </div>
        </div>

        <div style={{marginTop:24,display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center"}}>
          <button onClick={resetAll} style={S.ctaPrimary} className="s-cta">
            <span style={{fontSize:18,marginRight:8}}>✨</span>
            Producir otro entregable
          </button>
        </div>

      </div>
    </div>;
  }

  return null;
}

const S = {
  wrap:{minHeight:"calc(100vh - 0px)",background:"radial-gradient(ellipse at top, "+C.sf+" 0%, "+C.bg+" 50%, "+C.ink+" 100%)",padding:"40px 20px 80px",fontFamily:"'DM Sans',system-ui,sans-serif"},
  container:{maxWidth:980,margin:"0 auto"},

  eyebrow:{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 14px",border:"1px solid "+C.bd,borderRadius:30,marginBottom:22,background:C.sf+"80",backdropFilter:"blur(10px)"},
  eyebrowDot:{width:6,height:6,borderRadius:"50%",background:C.teal,animation:"sPulse 2s ease-in-out infinite"},
  eyebrowText:{fontSize:10,fontWeight:600,color:C.tx,letterSpacing:1,fontFamily:"'JetBrains Mono',monospace"},
  title:{fontSize:"clamp(40px, 6vw, 72px)",fontWeight:600,color:C.w,lineHeight:1.05,margin:"0 0 18px",letterSpacing:"-0.03em"},
  subtitle:{fontSize:16,color:C.tx,maxWidth:640,lineHeight:1.5,margin:0},

  // STEPPER
  stepper:{display:"flex",alignItems:"center",gap:0,padding:"18px 22px",background:C.sf+"60",backdropFilter:"blur(10px)",border:"1px solid "+C.bd,borderRadius:14,marginBottom:24,overflowX:"auto"},
  stepCircle:{width:28,height:28,minWidth:28,borderRadius:"50%",background:C.bg,border:"1px solid "+C.bd,color:C.txD,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,fontFamily:"'JetBrains Mono',monospace",transition:"all .3s"},
  stepCircleActive:{background:C.teal,border:"1px solid "+C.teal,color:C.bg,boxShadow:"0 0 0 4px "+C.teal+"20"},
  stepCircleDone:{background:C.teal+"15",border:"1px solid "+C.teal,color:C.teal},
  stepLabel:{fontSize:10,fontWeight:600,letterSpacing:0.8,whiteSpace:"nowrap"},
  stepLine:{flex:1,height:1,minWidth:20,margin:"0 8px"},

  // FORM CARD
  formCard:{background:C.sf+"80",backdropFilter:"blur(20px)",border:"1px solid "+C.bd,borderRadius:18,padding:30,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"},
  label:{display:"block",fontSize:11,fontWeight:600,color:C.tx,letterSpacing:1.2,marginBottom:10,textTransform:"uppercase"},

  // INPUTS
  select:{width:"100%",padding:"14px 18px",fontSize:15,background:C.bg,border:"1px solid "+C.bd,color:C.w,borderRadius:10,outline:"none",fontFamily:"inherit",cursor:"pointer",appearance:"none",backgroundImage:"url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%2394A3B8' d='M6 8L0 0h12z'/%3E%3C/svg%3E\")",backgroundRepeat:"no-repeat",backgroundPosition:"right 18px center"},
  input:{width:"100%",padding:"12px 16px",fontSize:14,background:C.bg,border:"1px solid "+C.bd,color:C.w,borderRadius:10,outline:"none",fontFamily:"inherit",boxSizing:"border-box",transition:"border .15s"},
  textarea:{width:"100%",padding:"12px 16px",fontSize:14,background:C.bg,border:"1px solid "+C.bd,color:C.w,borderRadius:10,outline:"none",fontFamily:"inherit",resize:"vertical",lineHeight:1.6,boxSizing:"border-box",minHeight:88},

  // CHIPS
  chipsGrid:{display:"flex",flexWrap:"wrap",gap:8},
  chip:{background:C.bg,border:"1px solid "+C.bd,color:C.w,padding:"10px 16px",borderRadius:24,cursor:"pointer",fontSize:13,fontFamily:"inherit",transition:"all .2s",whiteSpace:"nowrap"},
  chipActive:{background:C.teal+"15",border:"1px solid "+C.teal,color:C.teal,fontWeight:500},

  // QUESTION BLOCK
  questionBlock:{marginBottom:22},

  // NAV
  navRow:{display:"flex",justifyContent:"space-between",gap:12,marginTop:28,flexWrap:"wrap"},

  // BUTTONS
  primaryBtn:{background:C.teal,color:C.bg,border:"none",padding:"12px 24px",fontSize:14,fontWeight:600,borderRadius:10,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"},
  ghostBtn:{background:"transparent",border:"1px solid "+C.bd,color:C.tx,padding:"12px 22px",fontSize:13,fontWeight:600,borderRadius:10,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"},
  ghostMini:{background:"transparent",border:"1px solid "+C.bd,color:C.tx,padding:"6px 14px",fontSize:11,fontWeight:600,borderRadius:8,cursor:"pointer",fontFamily:"inherit"},

  // CTA (boton mágico)
  ctaBlock:{marginTop:30,paddingTop:24,borderTop:"1px solid "+C.bd,textAlign:"center"},
  ctaPrimary:{background:"linear-gradient(135deg, "+C.gold+" 0%, "+C.goldD+" 100%)",color:C.ink,border:"none",padding:"18px 44px",fontSize:17,fontWeight:700,borderRadius:14,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 8px 24px rgba(245,197,99,.3), 0 0 0 1px "+C.gold+"40",letterSpacing:"-0.01em",transition:"all .3s cubic-bezier(.16,1,.3,1)",display:"inline-flex",alignItems:"center"},

  // CLIENT CHIP
  clientChip:{marginTop:14,padding:"14px 18px",background:C.teal+"08",border:"1px solid "+C.teal+"30",borderRadius:12,display:"flex",alignItems:"center",gap:14},
  clientAvatar:{width:42,height:42,borderRadius:10,background:"linear-gradient(135deg, "+C.teal+", "+C.tealD+")",color:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,flexShrink:0,fontStyle:"italic"},

  // AREAS GRID
  areasGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:10},
  areaCard:{background:C.bg,border:"1px solid "+C.bd,borderRadius:12,padding:16,display:"flex",alignItems:"flex-start",gap:14,transition:"all .25s",position:"relative"},
  areaCardActive:{background:C.sf2+" !important",border:"1px solid "+C.teal+" !important",boxShadow:"0 8px 24px rgba(45,212,191,.15)"},
  areaEmoji:{width:42,height:42,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0,transition:"all .25s"},
  areaName:{fontSize:14,fontWeight:600,color:C.w,marginBottom:4,lineHeight:1.2},
  areaDesc:{fontSize:11,color:C.tx,lineHeight:1.4},
  areaCheck:{position:"absolute",top:10,right:10,width:22,height:22,borderRadius:"50%",color:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700},

  // SUMMARY
  summaryCard:{background:C.sf+"80",backdropFilter:"blur(20px)",border:"1px solid "+C.bd,borderRadius:18,padding:30,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"},
  summaryHeader:{display:"flex",alignItems:"center",gap:18,marginBottom:8},
  summaryDivider:{height:1,background:C.bd,margin:"20px 0"},
  summaryTable:{display:"flex",flexDirection:"column",gap:0},
  summaryRow:{display:"grid",gridTemplateColumns:"180px 1fr",gap:18,padding:"12px 0",borderBottom:"1px solid "+C.bd+"60"},
  summaryKey:{fontSize:12,color:C.tx,fontWeight:500,fontFamily:"'JetBrains Mono',monospace",letterSpacing:0.3},
  summaryVal:{fontSize:14,color:C.w,lineHeight:1.5,wordBreak:"break-word"},

  // MISC
  helpText:{fontSize:12,color:C.txD,marginTop:8},
  linkInline:{color:C.teal,cursor:"pointer",textDecoration:"underline"},
  errMsg:{marginTop:16,padding:"12px 16px",background:C.red+"15",border:"1px solid "+C.red+"40",color:C.rose,fontSize:13,borderRadius:10},
  iconBtn:{background:"transparent",border:"none",color:C.tx,fontSize:20,cursor:"pointer",padding:6,lineHeight:1},

  // OVERLAY/PANEL
  overlay:{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.75)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20},
  panel:{width:"100%",maxWidth:480,maxHeight:"calc(100vh - 40px)",background:C.sf,border:"1px solid "+C.bd,borderRadius:14,overflow:"auto"},
  panelHeader:{padding:"18px 20px",borderBottom:"1px solid "+C.bd,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:C.sf,zIndex:1},
  historyItem:{padding:"14px 20px",cursor:"pointer",borderBottom:"1px solid "+C.bd,transition:"background .15s"}
};
