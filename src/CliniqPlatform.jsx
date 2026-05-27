import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./db.js";
import BriefEditor, { formatBriefForPrompt } from "./BriefEditor.jsx";
import ProjectStudio from "./ProjectStudio.jsx";

const C = {
  bg:"#0B0F1A",sf:"#111827",sf2:"#1A2236",bd:"#2A3550",
  teal:"#2DD4BF",tealD:"#14B8A6",gold:"#F5C563",blue:"#60A5FA",
  purple:"#A78BFA",rose:"#FB7185",green:"#4ADE80",orange:"#FB923C",cyan:"#22D3EE",
  w:"#F1F5F9",tx:"#94A3B8",txD:"#475569",red:"#EF4444",
};
const bg8=c=>c+"14";
const font="'DM Sans',sans-serif";

/* ── GLOBAL ACTIVITY LOG ── */
let ACTIVITY_LOG = [];
let _activityLoaded = false;
const COST_RATES={
  groq:{input:0.20/1e6,output:0.60/1e6},
  deepseek:{input:0.14/1e6,output:0.28/1e6},
  "anthropic-haiku":{input:0.80/1e6,output:4.00/1e6},
  "anthropic-sonnet4.5":{input:3.00/1e6,output:15.00/1e6},
  "anthropic-sonnet4":{input:3.00/1e6,output:15.00/1e6},
  "fal":{input:0,output:0,perCall:0.002}
};
function estimateCost(provider,model,inputText,outputText){
  if(provider==="fal") return 0.002;
  const inTok=Math.ceil((inputText||"").length/4);
  const outTok=Math.ceil((outputText||"").length/4);
  let key=provider||"anthropic";
  if(key==="anthropic"){
    if(model?.includes("haiku")) key="anthropic-haiku";
    else if(model?.includes("sonnet-4-5")||model?.includes("sonnet-4.5")) key="anthropic-sonnet4.5";
    else key="anthropic-sonnet4";
  }
  const rate=COST_RATES[key]||COST_RATES["anthropic-sonnet4"];
  return Math.round((inTok*rate.input+outTok*rate.output)*100000)/100000;
}
function logActivity(toolName, clientName, inputs, outputPreview, providerInfo){
  const prov=providerInfo?.provider||"anthropic";
  const mod=providerInfo?.model||"";
  const inText=providerInfo?.inputText||"";
  const cost=estimateCost(prov,mod,inText,outputPreview);
  const entry = {
    id:Date.now()+Math.random(),
    date:new Date().toISOString(),
    tool:toolName,
    client:clientName||"Sin asignar",
    inputs:inputs||{},
    preview:(outputPreview||"").slice(0,300),
    fullOutput:outputPreview||"",
    provider:prov,model:mod,estCost:cost
  };
  ACTIVITY_LOG.push(entry);
  db.logActivity({tool:entry.tool,client:entry.client,inputs:entry.inputs,preview:entry.preview,fullOutput:entry.fullOutput,provider:entry.provider,model:entry.model,estCost:entry.estCost}).catch(()=>{});
}
async function loadActivityFromDb(){
  if(_activityLoaded) return;
  try{
    const data=await db.getActivity();
    if(data&&data.length>0){
      ACTIVITY_LOG=data.map(r=>({
        id:r.id,date:r.created_at||r.date||new Date().toISOString(),
        tool:r.tool||"IA",client:r.client_name||r.client||"Sin asignar",
        inputs:typeof r.inputs==="string"?JSON.parse(r.inputs):(r.inputs||{}),
        preview:r.preview||"",fullOutput:r.full_output||r.fullOutput||"",
        provider:r.provider||"anthropic",model:r.model||"",estCost:parseFloat(r.est_cost)||0
      }));
      _activityLoaded=true;
    }
  }catch(e){console.warn("Could not load activity from DB");}
}
function getLogForClient(clientName){
  if(!clientName) return ACTIVITY_LOG;
  return ACTIVITY_LOG.filter(e=>e.client===clientName);
}

/* ── GLOBAL BRIEFS CACHE (v2.0) ── */
let BRIEFS_CACHE = {};
let _briefsLoaded = false;
async function loadBriefsFromDb(){
  if(_briefsLoaded) return;
  try{
    const r=await fetch("/api/briefs");
    if(!r.ok) return;
    const data=await r.json();
    if(Array.isArray(data)){
      data.forEach(row=>{
        if(row.nombre && row.brief){
          const b=typeof row.brief==="string"?JSON.parse(row.brief):row.brief;
          BRIEFS_CACHE[row.nombre]=b;
        }
      });
      _briefsLoaded=true;
    }
  }catch(e){}
}
function getBriefForClient(clientName){
  if(!clientName || clientName==="Sin asignar") return null;
  return BRIEFS_CACHE[clientName] || null;
}

function exportLogPDF(entries, clientName){
  const today=new Date().toLocaleDateString("es-ES",{day:"2-digit",month:"long",year:"numeric"});
  let html=`<html><head><title>Registro de Actividad - ${clientName||"Todos"}</title><style>
    body{font-family:'Segoe UI',sans-serif;padding:40px 50px;color:#1a1a1a;line-height:1.6;max-width:900px;margin:auto}
    h1{font-size:20px;border-bottom:2px solid #2DD4BF;padding-bottom:8px;margin-bottom:6px}
    .meta{font-size:12px;color:#666;margin-bottom:24px}
    .entry{border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:12px;page-break-inside:avoid}
    .entry-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:4px}
    .tool-badge{background:#2DD4BF;color:#000;padding:2px 10px;border-radius:4px;font-size:11px;font-weight:700}
    .date{font-size:11px;color:#888}
    .inputs{font-size:12px;color:#555;margin-bottom:8px}
    .inputs span{font-weight:600;color:#333}
    .preview{font-size:12px;color:#333;background:#f8f8f8;padding:10px;border-radius:4px;white-space:pre-wrap;max-height:200px;overflow:hidden}
    .stats{display:flex;gap:20px;margin-bottom:20px;flex-wrap:wrap}
    .stat{background:#f0f9f8;border:1px solid #2DD4BF30;border-radius:8px;padding:12px 20px;text-align:center}
    .stat-val{font-size:22px;font-weight:700;color:#2DD4BF}
    .stat-lbl{font-size:11px;color:#888}
    @media print{body{padding:20px}; .entry{border:1px solid #ccc}}
  </style></head><body>`;
  html+=`<h1>REGISTRO DE ACTIVIDAD${clientName?" - "+clientName:""}</h1>`;
  html+=`<div class="meta">Cliniq Digital | Generado el ${today} | ${entries.length} consultas registradas</div>`;
  const tools={};entries.forEach(e=>{tools[e.tool]=(tools[e.tool]||0)+1;});
  html+=`<div class="stats">`;
  html+=`<div class="stat"><div class="stat-val">${entries.length}</div><div class="stat-lbl">Total consultas</div></div>`;
  html+=`<div class="stat"><div class="stat-val">${Object.keys(tools).length}</div><div class="stat-lbl">Herramientas usadas</div></div>`;
  const firstDate=entries.length>0?new Date(entries[0].date).toLocaleDateString("es-ES"):"N/A";
  const lastDate=entries.length>0?new Date(entries[entries.length-1].date).toLocaleDateString("es-ES"):"N/A";
  html+=`<div class="stat"><div class="stat-val" style="font-size:14px">${firstDate}</div><div class="stat-lbl">Primera consulta</div></div>`;
  html+=`<div class="stat"><div class="stat-val" style="font-size:14px">${lastDate}</div><div class="stat-lbl">Ultima consulta</div></div>`;
  html+=`</div>`;
  html+=`<h2 style="font-size:15px;margin:20px 0 10px">Desglose por herramienta</h2>`;
  Object.entries(tools).sort((a,b)=>b[1]-a[1]).forEach(([t,n])=>{
    html+=`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px solid #eee"><span>${t}</span><strong>${n}</strong></div>`;
  });
  html+=`<h2 style="font-size:15px;margin:24px 0 12px">Detalle de consultas</h2>`;
  entries.forEach((e,i)=>{
    const d=new Date(e.date);
    const dateStr=d.toLocaleDateString("es-ES")+" "+d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
    html+=`<div class="entry">`;
    html+=`<div class="entry-header"><span class="tool-badge">${e.tool}</span><span class="date">${dateStr}</span></div>`;
    if(e.client!=="Sin asignar") html+=`<div class="inputs"><span>Cliente:</span> ${e.client}</div>`;
    const inputStr=Object.entries(e.inputs||{}).filter(([k,v])=>v).map(([k,v])=>`<span>${k}:</span> ${String(v).slice(0,80)}`).join(" | ");
    if(inputStr) html+=`<div class="inputs">${inputStr}</div>`;
    if(e.preview) html+=`<div class="preview">${e.preview.replace(/</g,"&lt;")}...</div>`;
    html+=`</div>`;
  });
  html+=`<div style="margin-top:30px;padding-top:16px;border-top:2px solid #eee;font-size:11px;color:#999;text-align:center">
    Cliniq Digital - Documento generado automaticamente | ${today}
  </div>`;
  html+=`<script>setTimeout(()=>window.print(),600)<\/script></body></html>`;
  const w=window.open("","_blank");
  w.document.write(html);
}

/* ── NICHE SYSTEM ── */
const NICHES = [
  { id:"estetica", lb:"Medicina Estética", txs:["Botox","Ácido Hialurónico","Rinomodelación","Hilos Tensores","Mesoterapia Facial","Peeling Químico","Láser CO2","Radiofrecuencia","Liposucción","Aumento Labios","Ojeras","Antimanchas"] },
  { id:"dental", lb:"Odontología Premium", txs:["Implantes Dentales","Carillas Porcelana","Ortodoncia Invisible","Blanqueamiento","Prótesis Implantes","Diseño Sonrisa","Endodoncia","Periodoncia","Cirugía Oral","Férulas Descarga"] },
  { id:"multi", lb:"Multidisciplinar (estética + dental)", txs:[] },
  { id:"fertilidad", lb:"Clínica de Fertilidad", txs:["FIV","Inseminación Artificial","Ovodonación","Congelación Óvulos","Diagnóstico Genético","Estudio Fertilidad","Preservación Fertilidad"] },
  { id:"fisio", lb:"Fisioterapia / Rehabilitación", txs:["Fisioterapia Deportiva","Rehabilitación Postquirúrgica","Suelo Pélvico","Punción Seca","Ondas de Choque","ATM / Mandíbula","Readaptación Deportiva"] },
  { id:"oftalmo", lb:"Oftalmología / Cirugía Ocular", txs:["Cirugía LASIK","Cataratas","Lentes Intraoculares","Retina","Glaucoma","Cirugía Refractiva","Ojo Seco"] },
  { id:"derma", lb:"Dermatología", txs:["Dermatología Clínica","Dermatoscopia","Tratamiento Acné","Psoriasis","Rosácea","Cirugía Dermatológica","Dermatología Pediátrica"] },
  { id:"psico", lb:"Psicología / Psiquiatría", txs:["Terapia Individual","Terapia de Pareja","Ansiedad","Depresión","TDAH","Terapia Adolescentes","Psiquiatría"] },
  { id:"nutri", lb:"Nutrición / Endocrinología", txs:["Plan Nutricional","Pérdida de Peso","Nutrición Deportiva","Intolerancias","Diabetes","Tiroides","Nutrición Oncológica"] },
  { id:"reformas", lb:"Reformas y Trades", txs:["Reforma Integral","Cocinas","Baños","Electricidad","Fontanería","Pintura","Albañilería","Climatización","Carpintería","Suelos","Tejados","Aislamiento"] },
  { id:"hosteleria", lb:"Restaurantes y Hostelería", txs:["Menú del día","Carta nueva","Eventos privados","Catering","Take away","Brunch","Cena romántica","Carta de vinos","Cocina temática","Reservas online"] },
  { id:"academia", lb:"Academias y Formación", txs:["Refuerzo escolar","Idiomas","Oposiciones","Formación profesional","Cursos online","Talleres","Preparación selectividad","Cursos infantiles"] },
  { id:"comercio", lb:"Comercio Local", txs:["Productos frescos","Entrega a domicilio","Gourmet","Ecológico","Marca propia","Productos artesanos"] },
  { id:"servicios", lb:"Servicios Profesionales", txs:["Asesoría fiscal","Asesoría laboral","Asesoría contable","Consultoría","Abogados","Notaría","Inmobiliaria","Seguros","Gestoría"] },
  { id:"otro", lb:"Otro nicho (especificar)", txs:[] },
];

const HEALTH_IDS = ["estetica","dental","multi","fertilidad","fisio","oftalmo","derma","psico","nutri"];
function isHealthLabel(lb){
  const n=NICHES.find(x=>x.lb===lb);
  return n?HEALTH_IDS.includes(n.id):false;
}

const MENU = [
  {g:"PANEL"},{id:"home",ic:"◫",lb:"Panel de Control",cl:C.teal},
  {g:"HUBS"},
  {id:"diag360",ic:"⊙",lb:"Diagnóstico 360",cl:C.cyan},
  {g:"PRODUCCIÓN"},
  {id:"landing",ic:"◧",lb:"Landing Pages",cl:C.blue},
  {id:"whatsapp",ic:"◩",lb:"Protocolos WhatsApp",cl:C.green},
  {id:"seo",ic:"◨",lb:"Contenido SEO",cl:C.purple},
  {id:"audit",ic:"◪",lb:"Auditoría Digital",cl:C.gold},
  {id:"followup",ic:"◬",lb:"Secuencias Seguimiento",cl:C.rose},
  {id:"webstruct",ic:"⬡",lb:"Arquitectura Web",cl:C.blue},
  {id:"social",ic:"◉",lb:"Estrategia Redes",cl:C.purple},
  {id:"gbp",ic:"◎",lb:"Google Business",cl:C.gold},
  {id:"video",ic:"▶",lb:"Scripts Vídeo",cl:C.orange},
  {id:"imageprompt",ic:"◧",lb:"Prompts Imagen IA",cl:C.rose},
  {g:"INTELIGENCIA"},
  {id:"competitor",ic:"⊞",lb:"Competencia Local",cl:C.cyan},
  {id:"compliance",ic:"⊘",lb:"Verificador Normativo",cl:C.rose},
  {id:"reviews",ic:"★",lb:"Respuesta Reseñas",cl:C.green},
  {g:"PRESENCIA DIGITAL"},
  {id:"scan",ic:"⊙",lb:"Scan Presencia 360",cl:C.cyan},
  {id:"deepanalysis",ic:"⊛",lb:"Análisis Profundo Web",cl:C.teal},
  {id:"expansion",ic:"⊕",lb:"Expansión Plataformas",cl:C.blue},
  {id:"citations",ic:"≡",lb:"Auditoría NAP/Citations",cl:C.gold},
  {id:"reputation",ic:"◈",lb:"Reputación y Reseñas",cl:C.green},
  {id:"voiceseo",ic:"◉",lb:"SEO Voz / Asistentes",cl:C.purple},
  {id:"brandmonitor",ic:"◎",lb:"Monitor de Marca",cl:C.orange},
  {id:"implement",ic:"◧",lb:"Hub Implementación",cl:C.rose},
  {g:"CRECIMIENTO"},
  {id:"multiplier",ic:"⊛",lb:"Multiplicador Contenido",cl:C.cyan},
  {id:"proposal",ic:"◰",lb:"Propuestas Comerciales",cl:C.gold},
  {id:"campaign",ic:"⊕",lb:"Campañas Multicanal",cl:C.rose},
  {id:"metaads",ic:"◎",lb:"Meta Ads Pro",cl:C.blue},
  {id:"dashboard",ic:"◫",lb:"Dashboard Predictivo",cl:C.green},
  {g:"ESTRATEGIA"},
  {id:"report",ic:"◰",lb:"Reporting Mensual",cl:C.teal},
  {id:"manual",ic:"◳",lb:"Manual Comunicación",cl:C.gold},
  {g:"GESTIÓN"},
  {id:"clients",ic:"◈",lb:"Clientes / Facturación",cl:C.teal},
  {id:"tasks",ic:"☑",lb:"Tareas / Pendientes",cl:C.orange},
  {id:"perfiles-ext",ic:"↗",lb:"Perfiles Clientes",cl:C.cyan,href:"https://clientes.conectanex.com/"},
];
const ITEMS=MENU.filter(m=>m.id);

/* ══════ HUB DIAGNÓSTICO 360 — config ══════ */
const DIAGNOSTICO_SECTIONS = [
  { key:"scan360", label:"Scan Presencia 360", web:true, essential:true,
    system:"Investigador de presencia digital en 2026.",
    buildPrompt:(i)=>`SCAN 360 para: "${i.cliente}" en ${i.geo}. Sector: ${i.nicho}. Web: ${i.web||"No proporcionada"}.
Busca: 1) "${i.cliente}" en Google 2) "${i.cliente} resenas" 3) "${i.nicho} en ${i.geo}" 4) Presencia en Google Maps, Facebook, Instagram, Doctoralia.
Genera: ESTADO POR PLATAFORMA, RESENAS, COMPETENCIA, GAPS, PLAN DE ACCION.` },
  { key:"deepweb", label:"Análisis Profundo Web", web:true, essential:false,
    system:"Investigador digital profesional en 2026.",
    buildPrompt:(i)=>`ANALISIS PROFUNDO para: "${i.cliente}" en ${i.geo}. Sector: ${i.nicho}. Web: ${i.web||"No proporcionada"}. Competidor: ${i.competidores||"Buscar"}.
Busca: presencia Google, resenas, redes, competencia, SEO. Genera informe con FUENTES REALES.` },
  { key:"auditoria", label:"Auditoría Digital", web:false, essential:true,
    system:"Auditor experto en experiencia digital para negocios locales.",
    buildPrompt:(i)=>`Auditoria digital de: ${i.web||i.cliente}. Geo: ${i.geo}. Sector: ${i.nicho}. Notas: Ninguna
Genera: RESUMEN EJECUTIVO, WEB (/100), SEO LOCAL (/100), GBP (/100), EXPERIENCIA DIGITAL (/100), REDES (/100), PLAN PRIORIZADO, PROYECCION.` },
  { key:"competencia", label:"Competencia Local", web:false, essential:true,
    system:"Analista de competencia digital en 2026.",
    buildPrompt:(i)=>`Analisis competencia para: ${i.cliente} en ${i.geo}. Competidores: ${i.competidores||"Buscar principales"}. Sector: ${i.nicho}.
Genera: MAPA COMPETITIVO, WEB COMPARATIVO, SEO LOCAL, GOOGLE MAPS, REDES, PRECIOS, OPORTUNIDADES GEO-LOCALES, PLAN.` },
  { key:"nap", label:"Auditoría NAP/Citations", web:false, essential:false,
    system:"Experto en SEO local y consistencia NAP para negocios en Espana.",
    buildPrompt:(i)=>`AUDITORIA NAP para: "${i.cliente}". Dir: "[COMPLETAR]". Ciudad: ${i.geo}. Tel: "[COMPLETAR]". Web: "${i.web||"[COMPLETAR]"}". Sector: ${i.nicho}.
Genera: ANALISIS NOMBRE, DIRECCION, TELEFONO, WEB, IMPACTO SEO, CHECKLIST CORRECCION, HERRAMIENTAS, MANTENIMIENTO.` },
  { key:"reputacion", label:"Reputación y Reseñas", web:true, essential:true,
    system:"Investigador de reputacion online en 2026.",
    buildPrompt:(i)=>`DIAGNOSTICO REPUTACION para: "${i.cliente}" en ${i.geo}. Sector: ${i.nicho}.
Busca resenas reales, compara con competencia, analiza sentimiento. Plan de solicitud y protocolo respuesta.` },
  { key:"marca", label:"Monitor de Marca", web:false, essential:false,
    system:"Consultor de brand monitoring y online reputation management.",
    buildPrompt:(i)=>`PLAN MONITORIZACION para: ${i.cliente} en ${i.geo}. Sector: ${i.nicho}.
Genera: ALERTAS GOOGLE, ALERTAS GBP, ALERTAS REDES, RESENAS, COMPETENCIA, NEGATIVO, HERRAMIENTAS, PROTOCOLO RESPUESTA, INFORME MENSUAL, CALENDARIO.` },
];

const PLANS = [
  {id:"esencial",lb:"Esencial",price:"297",desc:"Presencia básica + SEO local"},
  {id:"profesional",lb:"Profesional",price:"497",desc:"Marketing completo + redes + reputación"},
  {id:"premium",lb:"Premium",price:"897",desc:"Todo incluido + estrategia + reporting"},
];

const PLATFORM_DB = [
  {id:"gbp",name:"Google Business Profile",cat:"Buscadores",priority:1,icon:"G",cl:C.blue},
  {id:"gmaps",name:"Google Maps",cat:"Mapas",priority:1,icon:"M",cl:C.green},
  {id:"bing",name:"Bing Places",cat:"Buscadores",priority:2,icon:"B",cl:C.cyan},
  {id:"apple",name:"Apple Maps",cat:"Mapas",priority:2,icon:"A",cl:C.tx},
  {id:"facebook",name:"Facebook Business",cat:"Redes Sociales",priority:1,icon:"F",cl:C.blue},
  {id:"instagram",name:"Instagram Business",cat:"Redes Sociales",priority:1,icon:"I",cl:C.purple},
  {id:"linkedin",name:"LinkedIn",cat:"Redes Sociales",priority:2,icon:"L",cl:C.blue},
  {id:"youtube",name:"YouTube",cat:"Redes Sociales",priority:2,icon:"Y",cl:C.red},
  {id:"tiktok",name:"TikTok Business",cat:"Redes Sociales",priority:2,icon:"T",cl:C.rose},
  {id:"waze",name:"Waze",cat:"Navegación GPS",priority:3,icon:"W",cl:C.cyan},
  {id:"tomtom",name:"TomTom / Here Maps",cat:"Navegación GPS",priority:3,icon:"T",cl:C.orange},
  {id:"alexa",name:"Alexa / Amazon",cat:"Asistentes Voz",priority:3,icon:"A",cl:C.orange},
  {id:"pamarillas",name:"Páginas Amarillas",cat:"Directorios ES",priority:2,icon:"P",cl:C.gold},
  {id:"qdq",name:"QDQ / 11870",cat:"Directorios ES",priority:3,icon:"Q",cl:C.rose},
  {id:"yelp",name:"Yelp",cat:"Directorios INT",priority:3,icon:"Y",cl:C.red},
  {id:"foursquare",name:"Foursquare",cat:"Directorios INT",priority:3,icon:"4",cl:C.purple},
  {id:"tripadvisor",name:"TripAdvisor",cat:"Directorios INT",priority:3,icon:"T",cl:C.green},
  {id:"doctoralia",name:"Doctoralia",cat:"Directorios Salud",priority:1,icon:"D",cl:C.teal,healthOnly:true},
  {id:"topdoctors",name:"Top Doctors",cat:"Directorios Salud",priority:2,icon:"T",cl:C.blue,healthOnly:true},
];
const isHealthNiche=(lb)=>{const n=NICHES.find(x=>x.lb===lb);return n?HEALTH_IDS.includes(n.id):false;};
const getPlatformsForNiche=(lb)=>PLATFORM_DB.filter(p=>!p.healthOnly||isHealthNiche(lb));

function StatusDot({status}){
  const colors={ok:C.green,warning:C.gold,missing:C.red,unknown:C.txD};
  const labels={ok:"Verificado",warning:"Revisar",missing:"Ausente",unknown:"Sin datos"};
  return <div style={{display:"flex",alignItems:"center",gap:6}}>
    <div style={{width:8,height:8,borderRadius:4,background:colors[status]||C.txD}}/>
    <span style={{fontSize:11,color:colors[status]||C.txD}}>{labels[status]||status}</span>
  </div>;
}
function ScoreBar({label,score,max}){
  const pct=Math.min(100,Math.max(0,(score/max)*100));
  const cl=pct>=70?C.green:pct>=40?C.gold:C.red;
  return <div style={{marginBottom:10}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
      <span style={{fontSize:12,color:C.tx}}>{label}</span>
      <span style={{fontSize:12,fontWeight:700,color:cl}}>{score}/{max}</span>
    </div>
    <div style={{height:6,background:C.sf2,borderRadius:3,overflow:"hidden"}}>
      <div style={{height:"100%",width:pct+"%",background:cl,borderRadius:3,transition:"width 0.5s"}}/>
    </div>
  </div>;
}
function Tab({tabs,active,onChange}){
  return <div style={{display:"flex",gap:2,background:C.sf2,borderRadius:8,padding:3,marginBottom:20,flexWrap:"wrap"}}>
    {tabs.map(t=><button key={t.id} onClick={()=>onChange(t.id)} style={{
      flex:"1 1 auto",padding:"8px 14px",borderRadius:6,border:"none",fontFamily:font,fontSize:12,fontWeight:600,
      cursor:"pointer",background:active===t.id?C.sf:"transparent",color:active===t.id?C.w:C.txD,transition:"all 0.2s",whiteSpace:"nowrap"
    }}>{t.lb}</button>)}
  </div>;
}

/* ── UI COMPONENTS ── */
function Btn({children,primary,small,color,onClick,disabled,sx}){
  return <button disabled={disabled} onClick={onClick} style={{
    background:disabled?C.sf2:primary?(color||C.teal):"transparent",
    border:primary?"none":"1px solid "+(color||C.bd),
    color:disabled?C.txD:primary?C.bg:(color||C.tx),
    padding:small?"6px 14px":"10px 20px",borderRadius:8,
    fontFamily:font,fontSize:small?12:13,fontWeight:600,
    cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,...sx
  }}>{children}</button>;
}
function Sel({value,onChange,opts,ph}){
  return <select value={value} onChange={e=>onChange(e.target.value)} style={{
    background:C.sf,border:"1px solid "+C.bd,color:C.w,padding:"10px 14px",
    borderRadius:8,fontFamily:font,fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"
  }}>{ph&&<option value="">{ph}</option>}{opts.map(o=>{const val=typeof o==="string"?o:(o.value||o.v);const lbl=typeof o==="string"?o:(o.label||o.l);return <option key={val} value={val}>{lbl}</option>;})}</select>;
}
function Inp({value,onChange,ph,type}){
  return <input type={type||"text"} value={value} onChange={e=>onChange(e.target.value)} placeholder={ph} style={{
    background:C.sf,border:"1px solid "+C.bd,color:C.w,padding:"10px 14px",
    borderRadius:8,fontFamily:font,fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"
  }}/>;
}
function Txa({value,onChange,ph,rows}){
  return <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={ph} rows={rows||3} style={{
    background:C.sf,border:"1px solid "+C.bd,color:C.w,padding:"10px 14px",
    borderRadius:8,fontFamily:font,fontSize:13,outline:"none",width:"100%",
    resize:"vertical",lineHeight:1.6,boxSizing:"border-box"
  }}/>;
}
function Lbl({children}){return <label style={{fontFamily:font,fontSize:11,fontWeight:600,color:C.tx,letterSpacing:0.5,textTransform:"uppercase",display:"block",marginBottom:6}}>{children}</label>;}
function Crd({children,sx,onClick}){return <div onClick={onClick} style={{background:C.sf,border:"1px solid "+C.bd,borderRadius:12,padding:24,cursor:onClick?"pointer":"default",...sx}}>{children}</div>;}
function Fld({label,children}){return <div><Lbl>{label}</Lbl>{children}</div>;}
function Badge({text,color}){return <span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:6,background:bg8(color||C.teal),color:color||C.teal}}>{text}</span>;}

/* ── NICHE SELECTOR ── */
function NicheSelector({niche,setNiche,customNiche,setCustomNiche,onClientSelect}){
  return <>
    <ClientQuickFill onSelect={({nombre,nicho,ciudad,provincia})=>{
      if(nicho) setNiche(nicho);
      if(onClientSelect) onClientSelect({nombre:nombre||"",ciudad:ciudad||"",provincia:provincia||""});
    }}/>
    <Fld label="Nicho / Sector">
      <Sel value={niche} onChange={setNiche} opts={NICHES.map(n=>n.lb)} ph="Seleccionar sector..."/>
    </Fld>
    {niche===NICHES.find(n=>n.id==="otro")?.lb && (
      <Fld label="Especifica tu nicho">
        <Inp value={customNiche} onChange={setCustomNiche} ph="Ej: Podología deportiva, Veterinaria premium..."/>
      </Fld>
    )}
  </>;
}

function getTxForNiche(nicheLabel){
  const found=NICHES.find(n=>n.lb===nicheLabel);
  if(!found||found.txs.length===0) return [];
  return found.txs;
}

function TreatmentSelector({niche,treatment,setTreatment,customTx,setCustomTx,label}){
  const txs=getTxForNiche(niche);
  const hasPreset=txs.length>0;
  return <>
    {hasPreset ? <>
      <Fld label={label||"Tratamiento / Servicio"}>
        <Sel value={treatment} onChange={v=>{setTreatment(v);if(v!=="Otro (escribir)")setCustomTx("");}} opts={[...txs,"Otro (escribir)"]} ph="Seleccionar..."/>
      </Fld>
      {treatment==="Otro (escribir)"&&<Fld label="Especifica el servicio">
        <Inp value={customTx} onChange={setCustomTx} ph="Ej: Lipopapada, Microblading, Prótesis híbrida..."/>
      </Fld>}
    </> : <Fld label={label||"Servicio / Tratamiento"}>
      <Inp value={customTx} onChange={setCustomTx} ph="Describe el servicio que ofrece el centro..."/>
    </Fld>}
  </>;
}

function resolveTx(treatment,customTx){
  if(!treatment||treatment==="Otro (escribir)") return customTx||"";
  return treatment;
}
function resolveNiche(nicheLabel,custom){
  if(nicheLabel===NICHES.find(n=>n.id==="otro")?.lb && custom) return custom;
  return nicheLabel||"Clínica sanitaria privada";
}

/* ── CLIENT QUICK-FILL ── */
let _qfCache=null;let _qfTime=0;
function ClientQuickFill({onSelect}){
  const[cls,setCls]=useState(()=>_qfCache||[]);
  const[v,setV]=useState("");
  useEffect(()=>{
    if(_qfCache&&Date.now()-_qfTime<60000){
      if(cls.length===0) setCls(_qfCache);
      return;
    }
    db.getClients().then(d=>{
      if(d&&d.length>0){_qfCache=d;_qfTime=Date.now();setCls(d);}
    }).catch(()=>{});
  },[]);
  const handle=(val)=>{
    setV(val);
    if(!val) return;
    const c=cls.find(x=>(x.nombre||"")===val);
    if(c) onSelect({nombre:c.nombre||"",nicho:c.nicho||"",ciudad:c.ciudad_fiscal||c.ciudadFiscal||"",provincia:c.provincia_fiscal||c.provinciaFiscal||""});
  };
  if(cls.length===0) return <div style={{height:0,overflow:"hidden"}}/>;
  return <div style={{padding:"8px 12px",background:C.teal+"12",border:"1px solid "+C.teal+"30",borderRadius:8,marginBottom:6}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:11,color:C.teal,fontWeight:600,whiteSpace:"nowrap"}}>Cliente:</span>
      <select value={v} onChange={e=>handle(e.target.value)} style={{
        background:C.sf,border:"1px solid "+C.bd,color:C.w,padding:"6px 10px",
        borderRadius:6,fontFamily:font,fontSize:12,outline:"none",flex:1
      }}>
        <option value="">-- Rellenar manual --</option>
        {cls.map(c=><option key={c.id} value={c.nombre}>{c.nombre}{c.nicho?" ("+c.nicho+")":""}</option>)}
      </select>
    </div>
  </div>;
}

/* ── GEO FIELDS ── */
function GeoFields({city,setCity,province,setProvince,barrio,setBarrio}){
  return <>
    <Fld label="Ciudad"><Inp value={city} onChange={setCity} ph="Ej: Alicante"/></Fld>
    <Fld label="Provincia / Comunidad"><Inp value={province} onChange={setProvince} ph="Ej: Comunidad Valenciana"/></Fld>
    <Fld label="Barrio / Zona (opcional)"><Inp value={barrio} onChange={setBarrio} ph="Ej: Playa de San Juan, Centro..."/></Fld>
  </>;
}
function geoStr(city,province,barrio){
  let g=city||"";
  if(barrio)g=barrio+", "+g;
  if(province)g+=" ("+province+")";
  return g||"España";
}

/* ── OUTPUT PANEL ── */
function Out({content,loading,label}){
  const ref=useRef(null);
  useEffect(()=>{if(ref.current)ref.current.scrollTop=ref.current.scrollHeight;},[content]);
  return <div style={{background:C.bg,border:"1px solid "+C.bd,borderRadius:12,overflow:"hidden",flex:1,display:"flex",flexDirection:"column",minHeight:300}}>
    <div style={{padding:"12px 16px",borderBottom:"1px solid "+C.bd,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:11,fontWeight:600,color:C.tx,letterSpacing:0.5,textTransform:"uppercase"}}>{label||"Resultado"}</span>
        {loading&&<div className="spinner" style={{width:12,height:12}}/>}
      </div>
      {content&&!loading&&<div style={{display:"flex",gap:6}}>
        <Btn small onClick={()=>navigator.clipboard.writeText(content)}>Copiar</Btn>
        <Btn small onClick={()=>{const w=window.open("","_blank");w.document.write("<pre style='font-family:sans-serif;padding:40px;line-height:1.8;max-width:800px;margin:auto'>"+content.replace(/</g,"&lt;")+"</pre>");w.document.title="Cliniq Digital - Exportar";}}>Imprimir</Btn>
      </div>}
    </div>
    <div ref={ref} style={{padding:20,flex:1,overflowY:"auto",maxHeight:600}}>
      {content?<div style={{fontSize:14,color:C.w,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{content}{loading&&<span style={{display:"inline-block",width:6,height:16,background:C.teal,marginLeft:2,animation:"blink 1s infinite",verticalAlign:"text-bottom"}}/>}</div>
      :loading?<div style={{display:"flex",alignItems:"center",gap:12,color:C.teal}}>
        <div className="spinner"/><span style={{fontSize:14}}>Generando con IA...</span>
      </div>
      :<p style={{fontSize:14,color:C.txD,fontStyle:"italic"}}>Configura los parámetros y pulsa generar.</p>}
    </div>
  </div>;
}

/* ── AI ENGINE ── */
function buildSys(nicheResolved, geo, brief){
  const isHealth=isHealthLabel(nicheResolved);
  let base=`Estratega de marketing digital para negocios locales en Espana. AÑO ACTUAL: 2026. Nicho: ${nicheResolved}. Geo: ${geo}.
Reglas: Terminologia profesional del sector. SEO local (keyword en titulo, H2s, primer y ultimo parrafo, densidad 1-2%, LSI keywords, geo-keywords "[servicio] + [ciudad/barrio]").`;
  if(isHealth){
    base+=` Sector salud: cumplir regulacion publicitaria sanitaria espanola, sin claims de resultado, sin antes-despues, sin testimonios identificables.`;
  }else{
    base+=` Adaptar lenguaje y referencias al sector concreto (no usar terminologia sanitaria salvo que aplique).`;
  }
  base+=` Texto limpio sin markdown/asteriscos/almohadillas. Espanol de Espana, comillas rectas, sin emojis. No inventar datos: usar [COMPLETAR] si faltan. Recomendaciones accionables y concretas. Precision sobre extension. IMPORTANTE: Usa informacion, tendencias, datos y referencias de 2025-2026. No uses datos obsoletos.`;
  if(brief) base+=formatBriefForPrompt(brief);
  return base;
}

async function streamRequest(body,setO,setL,onText){
  const maxRetries=3;
  for(let attempt=0;attempt<maxRetries;attempt++){
    try{
      const r=await fetch("/api/generate",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(body)
      });
      if(r.status===429||r.status===529){
        const wait=Math.min(30,(attempt+1)*12);
        setO(`Limite de velocidad API. Reintentando en ${wait}s... (intento ${attempt+1}/${maxRetries})`);
        await new Promise(ok=>setTimeout(ok,wait*1000));
        continue;
      }
      if(!r.ok){
        const errRaw=await r.text();
        let errMsg;try{const j=JSON.parse(errRaw);errMsg=j.error?.message||j.error||errRaw.slice(0,200);}catch(e){errMsg=errRaw.slice(0,200);}
        if(typeof errMsg==="string"&&errMsg.includes("rate limit")&&attempt<maxRetries-1){
          const wait=Math.min(30,(attempt+1)*12);
          setO(`Limite de velocidad API. Reintentando en ${wait}s... (intento ${attempt+1}/${maxRetries})`);
          await new Promise(ok=>setTimeout(ok,wait*1000));
          continue;
        }
        if((body.provider==="groq"||body.provider==="deepseek")&&attempt===maxRetries-1){
          const nextProvider=body.provider==="groq"?"deepseek":"anthropic";
          const nextModel=body.provider==="groq"?MODELS.ds:MODELS.fast;
          const nextLabel=body.provider==="groq"?"DeepSeek":"Claude";
          setO(body.provider==="groq"?"Groq no disponible, usando DeepSeek...":"DeepSeek no disponible, usando Claude...");
          await new Promise(ok=>setTimeout(ok,1000));
          return streamRequest({...body,provider:nextProvider,model:nextModel},setO,setL,onText);
        }
        setO("ERROR API: "+(typeof errMsg==="string"?errMsg:JSON.stringify(errMsg)));setL(false);return null;
      }
      if(!body.stream){
        const raw=await r.text();
        let d;try{d=JSON.parse(raw);}catch(pe){setO("Error del servidor: "+raw.slice(0,200));setL(false);return null;}
        if(d.error){setO("ERROR API: "+(typeof d.error==="string"?d.error:JSON.stringify(d.error)));setL(false);return null;}
        return d;
      }
      const reader=r.body.getReader();
      const decoder=new TextDecoder();
      let full="";let buffer="";
      while(true){
        const{done,value}=await reader.read();
        if(done) break;
        buffer+=decoder.decode(value,{stream:true});
        const lines=buffer.split("\n");
        buffer=lines.pop()||"";
        for(const line of lines){
          if(!line.startsWith("data: ")) continue;
          const raw=line.slice(6);
          if(raw==="[DONE]") continue;
          try{
            const ev=JSON.parse(raw);
            if(ev.type==="error"){
              const em=ev.error?.message||JSON.stringify(ev.error);
              if(typeof em==="string"&&em.includes("rate limit")&&attempt<maxRetries-1){
                const wait=Math.min(30,(attempt+1)*12);
                setO(`Limite de velocidad API. Reintentando en ${wait}s...`);
                await new Promise(ok=>setTimeout(ok,wait*1000));
                full="__RETRY__";break;
              }
              setO("ERROR API: "+em);setL(false);return null;
            }
            if(ev.type==="content_block_delta"&&ev.delta?.type==="text_delta"&&ev.delta.text){
              full+=ev.delta.text;
              setO(full);
            }
            if(onText&&ev.type==="content_block_start") onText(ev);
          }catch(pe){}
        }
        if(full==="__RETRY__") break;
      }
      if(full==="__RETRY__"){full="";continue;}
      return full||null;
    }catch(e){
      if(attempt<maxRetries-1){
        setO(`Error de conexion, reintentando en 5s...`);
        await new Promise(ok=>setTimeout(ok,5000));continue;
      }
      if(body.provider==="groq"||body.provider==="deepseek"){
        const nextProvider=body.provider==="groq"?"deepseek":"anthropic";
        const nextModel=body.provider==="groq"?MODELS.ds:MODELS.fast;
        setO(body.provider==="groq"?"Groq no disponible, usando DeepSeek...":"DeepSeek no disponible, usando Claude...");
        await new Promise(ok=>setTimeout(ok,1000));
        return streamRequest({...body,provider:nextProvider,model:nextModel},setO,setL,onText);
      }
      setO("Error de conexion: "+e.message);setL(false);return null;
    }
  }
  setO("No se pudo completar la solicitud. Espera 1 minuto y prueba de nuevo.");
  setL(false);return null;
}

const MODELS={
  fast:"claude-haiku-4-5-20251001",
  mid:"claude-sonnet-4-5-20250929",
  full:"claude-sonnet-4-20250514",
  gemini:"gemini-2.5-flash",
  geminiLite:"gemini-2.5-flash-lite",
  cerebras:"llama-3.3-70b",
  ds:"deepseek-chat",
  dsr:"deepseek-reasoner",
  groqFast:"llama-3.1-8b-instant",
  groqMid:"meta-llama/llama-4-maverick-17b-128e-instruct",
  groqPro:"llama-3.3-70b-versatile",
  groqQwen:"qwen/qwen3-32b"
};
function pickModel(toolHint){
  const groqTier=["Respuesta Reseñas","Google Business","WhatsApp","Scripts Vídeo","Prompts Imagen IA","Multiplicador Contenido","Manual Comunicación","Secuencias Seguimiento","Expansión Plataformas","Auditoría NAP","SEO Voz","Monitor de Marca"];
  const midTier=["Landing Pages","Contenido SEO","Estrategia Redes","Arquitectura Web","Verificador Normativo","Reporting Mensual"];
  if(groqTier.some(t=>toolHint?.includes(t))) return {model:MODELS.groqPro,provider:"groq"};
  if(midTier.some(t=>toolHint?.includes(t))) return {model:MODELS.gemini,provider:"gemini"};
  return {model:MODELS.gemini,provider:"gemini"};
}

async function ai(sysExtra,prompt,setO,setL,niche,geo,logInfo){
  setL(true);setO("");
  const brief=getBriefForClient(logInfo?.client);
  const sys=buildSys(niche||"Servicio profesional",geo||"Espana",brief)+"\n\n"+sysExtra;
  const {model,provider}=pickModel(logInfo?.tool||sysExtra);
  const full=await streamRequest({model,provider,max_tokens:4096,stream:true,system:sys,messages:[{role:"user",content:prompt}],hint:logInfo?.tool||""},setO,setL);
  if(full&&!full.startsWith("Error")&&!full.startsWith("ERROR")){
    const toolName=logInfo?.tool||inferToolName(sysExtra,prompt);
    logActivity(toolName,logInfo?.client||"Sin asignar",logInfo?.inputs||extractInputs(prompt),full,{provider,model,inputText:prompt});
  }
  if(!full&&!setO.lastVal) setO("Sin contenido en la respuesta.");
  setL(false);
}

function inferToolName(sys,prompt){
  if(sys.includes("landing")) return "Landing Pages";
  if(sys.includes("WhatsApp")) return "Protocolos WhatsApp";
  if(sys.includes("SEO")&&sys.includes("Articulo")) return "Contenido SEO";
  if(sys.includes("Auditor")&&sys.includes("digital")) return "Auditoría Digital";
  if(sys.includes("seguimiento")||sys.includes("Followup")) return "Secuencias Seguimiento";
  if(sys.includes("arquitectura")||sys.includes("sitemap")) return "Arquitectura Web";
  if(sys.includes("redes sociales")||sys.includes("calendario editorial")) return "Estrategia Redes";
  if(sys.includes("Google Business")) return "Google Business";
  if(sys.includes("video")||sys.includes("reels")||sys.includes("guion")) return "Scripts Vídeo";
  if(sys.includes("competencia")||sys.includes("competidor")) return "Competencia Local";
  if(sys.includes("normativ")||sys.includes("compliance")) return "Verificador Normativo";
  if(sys.includes("resena")&&sys.includes("respuesta")) return "Respuesta Reseñas";
  if(sys.includes("presencia digital")||sys.includes("Scan")) return "Scan Presencia 360";
  if(sys.includes("expansion")||sys.includes("listings")) return "Expansión Plataformas";
  if(sys.includes("NAP")||sys.includes("citations")) return "Auditoría NAP";
  if(sys.includes("reputacion")) return "Reputación Online";
  if(sys.includes("voz")||sys.includes("Voice")) return "SEO Voz";
  if(sys.includes("brand")||sys.includes("monitorizacion")) return "Monitor de Marca";
  if(sys.includes("imagen")||sys.includes("prompt engineering")) return "Prompts Imagen IA";
  if(sys.includes("informe mensual")||sys.includes("Reporting")) return "Reporting Mensual";
  if(sys.includes("manual")||sys.includes("comunicacion")) return "Manual Comunicación";
  if(sys.includes("implementacion")||sys.includes("plan de accion")) return "Hub Implementación";
  return "Herramienta IA";
}

function extractInputs(prompt){
  const inputs={};
  const lines=prompt.split("\n").slice(0,10);
  lines.forEach(line=>{
    const match=line.match(/^([A-Za-z\s]+):\s*(.+)/);
    if(match&&match[2]&&match[2].length<100&&!match[2].startsWith("[")) inputs[match[1].trim()]=match[2].trim();
  });
  return inputs;
}

async function aiSearch(sysExtra,prompt,setO,setL,niche,geo,setPhase,logInfo){
  setL(true);setO("");
  if(setPhase) setPhase("search");
  const brief=getBriefForClient(logInfo?.client);
  const sys=buildSys(niche||"Servicio profesional",geo||"Espana",brief)+"\n\n"+sysExtra;
  const maxRetries=3;
  for(let attempt=0;attempt<maxRetries;attempt++){
  try{
    const r=await fetch("/api/generate",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        provider:"gemini",model:MODELS.gemini,web_search:true,max_tokens:4096,stream:true,system:sys,
        messages:[{role:"user",content:prompt}],
        hint:logInfo?.tool||""
      })
    });
    if(r.status===429||r.status===529||(r.status>=400&&!r.ok)){
      const errRaw=await r.text();
      let errMsg;try{const j=JSON.parse(errRaw);errMsg=j.error?.message||j.error||errRaw.slice(0,200);}catch(e){errMsg=errRaw.slice(0,200);}
      if((r.status===429||r.status===529||(typeof errMsg==="string"&&errMsg.includes("rate limit")))&&attempt<maxRetries-1){
        const wait=Math.min(30,(attempt+1)*12);
        setO(`Limite de velocidad API. Reintentando en ${wait}s... (${attempt+1}/${maxRetries})`);
        await new Promise(ok=>setTimeout(ok,wait*1000));continue;
      }
      setO("ERROR API: "+(typeof errMsg==="string"?errMsg:JSON.stringify(errMsg)));
      if(setPhase) setPhase("done");setL(false);return;
    }
    const reader=r.body.getReader();
    const decoder=new TextDecoder();
    let full="";let buffer="";let searchingPhase=true;let sources=[];let retryNeeded=false;
    while(true){
      const{done,value}=await reader.read();
      if(done) break;
      buffer+=decoder.decode(value,{stream:true});
      const lines=buffer.split("\n");
      buffer=lines.pop()||"";
      for(const line of lines){
        if(!line.startsWith("data: ")) continue;
        const raw=line.slice(6);
        if(raw==="[DONE]") continue;
        try{
          const ev=JSON.parse(raw);
          if(ev.type==="error"){
            const em=ev.error?.message||JSON.stringify(ev.error);
            if(typeof em==="string"&&em.includes("rate limit")&&attempt<maxRetries-1){
              const wait=Math.min(30,(attempt+1)*12);
              setO(`Limite de velocidad. Reintentando en ${wait}s...`);
              await new Promise(ok=>setTimeout(ok,wait*1000));retryNeeded=true;break;
            }
            setO("ERROR API: "+em);if(setPhase) setPhase("done");setL(false);return;
          }
          if(ev.type==="content_block_start"){
            if((ev.content_block?.type==="web_search_tool_result"||ev.content_block?.type==="text")&&searchingPhase&&setPhase){setPhase("analyze");searchingPhase=false;}
            if(ev.content_block?.type==="web_search_tool_result"&&ev.content_block.content){
              ev.content_block.content.filter(c=>c.type==="web_search_result"&&c.url&&c.title).forEach(wp=>sources.push({title:wp.title,url:wp.url}));
            }
          }
          if(ev.type==="content_block_delta"&&ev.delta?.type==="text_delta"&&ev.delta.text){full+=ev.delta.text;setO(full);}
        }catch(pe){}
      }
      if(retryNeeded) break;
    }
    if(retryNeeded) continue;
    if(sources.length>0){full+="\n\n---\nFUENTES CONSULTADAS:\n";sources.forEach(s=>{full+=`- ${s.title}: ${s.url}\n`;});setO(full);}
    if(!full) setO("Sin resultados. Verifica los datos e intenta de nuevo.");
    if(full){const toolName=logInfo?.tool||inferToolName(sysExtra,prompt);logActivity(toolName+" (Web)",logInfo?.client||"Sin asignar",logInfo?.inputs||extractInputs(prompt),full,{provider:"gemini",model:MODELS.gemini,inputText:prompt});}
    if(setPhase) setPhase("done");setL(false);return;
  }catch(e){
    if(attempt<maxRetries-1){setO("Error de conexion, reintentando en 5s...");await new Promise(ok=>setTimeout(ok,5000));continue;}
    setO("Error de conexion: "+e.message);
  }}
  if(setPhase) setPhase("done");setL(false);
}

function ProgressRing({score,max,size,color,label,sublabel}){
  const sz=size||90;const r=(sz-10)/2;const circ=2*Math.PI*r;
  const pct=Math.min(100,Math.max(0,(score/max)*100));
  const offset=circ-(pct/100)*circ;
  const cl=color||(pct>=70?C.green:pct>=40?C.gold:C.red);
  return <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
    <svg width={sz} height={sz} style={{transform:"rotate(-90deg)"}}>
      <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={C.sf2} strokeWidth={5}/>
      <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={cl} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{transition:"stroke-dashoffset 0.8s ease"}}/>
      <text x={sz/2} y={sz/2+1} fill={cl} fontSize={sz>70?20:14} fontWeight={700}
        textAnchor="middle" dominantBaseline="middle" style={{transform:"rotate(90deg)",transformOrigin:"center"}}>{Math.round(pct)}</text>
    </svg>
    {label&&<span style={{fontSize:11,fontWeight:600,color:C.w,textAlign:"center"}}>{label}</span>}
    {sublabel&&<span style={{fontSize:10,color:C.txD,textAlign:"center"}}>{sublabel}</span>}
  </div>;
}

function RadarScore({items,size}){
  const sz=size||200;const cx=sz/2;const cy=sz/2;const maxR=(sz-40)/2;
  const n=items.length;if(n<3) return null;
  const angle=(i)=>(Math.PI*2*i/n)-Math.PI/2;
  const pt=(i,r)=>({x:cx+Math.cos(angle(i))*r,y:cy+Math.sin(angle(i))*r});
  const polyPts=(r)=>items.map((_,i)=>{const p=pt(i,r);return p.x+","+p.y;}).join(" ");
  const dataPts=items.map((it,i)=>{const p=pt(i,(it.score/it.max)*maxR);return p.x+","+p.y;}).join(" ");
  return <svg width={sz} height={sz}>
    {[0.25,0.5,0.75,1].map(f=><polygon key={f} points={polyPts(maxR*f)} fill="none" stroke={C.bd} strokeWidth={0.5} opacity={0.5}/>)}
    {items.map((_,i)=>{const p=pt(i,maxR);return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={C.bd} strokeWidth={0.5} opacity={0.3}/>;
    })}
    <polygon points={dataPts} fill={C.teal+"30"} stroke={C.teal} strokeWidth={2}/>
    {items.map((it,i)=>{const p=pt(i,maxR+14);return <text key={i} x={p.x} y={p.y} fill={C.tx} fontSize={9} fontWeight={600} textAnchor="middle" dominantBaseline="middle">{it.label}</text>;
    })}
    {items.map((it,i)=>{const p=pt(i,(it.score/it.max)*maxR);const cl=it.score/it.max>=0.7?C.green:it.score/it.max>=0.4?C.gold:C.red;
      return <circle key={i} cx={p.x} cy={p.y} r={3} fill={cl}/>;
    })}
  </svg>;
}

function OutSearch({content,loading,label,phase}){
  const ref=useRef(null);
  useEffect(()=>{if(ref.current)ref.current.scrollTop=ref.current.scrollHeight;},[content]);
  const phaseLabels={search:"Buscando en Internet...",analyze:"Analizando resultados...",done:"Completado"};
  return <div style={{background:C.bg,border:"1px solid "+C.bd,borderRadius:12,overflow:"hidden",flex:1,display:"flex",flexDirection:"column",minHeight:340}}>
    <div style={{padding:"12px 16px",borderBottom:"1px solid "+C.bd,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:11,fontWeight:600,color:C.tx,letterSpacing:0.5,textTransform:"uppercase"}}>{label||"Resultado"}</span>
        {loading&&<div className="spinner" style={{width:12,height:12}}/>}
        {loading&&phase&&<span style={{fontSize:10,color:C.cyan,fontWeight:600,padding:"2px 8px",background:bg8(C.cyan),borderRadius:4}}>{phaseLabels[phase]||phase}</span>}
      </div>
      {content&&!loading&&<div style={{display:"flex",gap:6}}>
        <Btn small onClick={()=>navigator.clipboard.writeText(content)}>Copiar</Btn>
        <Btn small onClick={()=>{const w=window.open("","_blank");w.document.write("<pre style='font-family:sans-serif;padding:40px;line-height:1.8;max-width:800px;margin:auto'>"+content.replace(/</g,"&lt;")+"</pre>");w.document.title="Cliniq Digital - Exportar";}}>Imprimir</Btn>
      </div>}
    </div>
    <div ref={ref} style={{padding:20,flex:1,overflowY:"auto",maxHeight:700}}>
      {content?<div style={{fontSize:14,color:C.w,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{content}{loading&&<span style={{display:"inline-block",width:6,height:16,background:C.teal,marginLeft:2,animation:"blink 1s infinite",verticalAlign:"text-bottom"}}/>}</div>
      :loading?<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16,paddingTop:40}}>
        <div className="spinner" style={{width:24,height:24,borderWidth:3}}/>
        <span style={{fontSize:14,color:C.teal}}>{phaseLabels[phase]||"Generando..."}</span>
        {phase==="search"&&<div style={{maxWidth:300,textAlign:"center"}}>
          <p style={{fontSize:12,color:C.txD,lineHeight:1.6}}>La IA busca datos reales del negocio en Internet: presencia en plataformas, resenas, menciones, competencia y mas.</p>
        </div>}
      </div>
      :<p style={{fontSize:14,color:C.txD,fontStyle:"italic"}}>Configura los parámetros y pulsa generar.</p>}
    </div>
  </div>;
}

function ActionItem({priority,title,time,impact,platform,done,onToggle}){
  const pColors={alta:C.red,media:C.gold,baja:C.green};
  return <div onClick={onToggle} style={{
    display:"flex",gap:12,padding:"10px 14px",borderRadius:8,cursor:"pointer",
    background:done?C.sf2+"80":C.sf,border:"1px solid "+(done?C.bd:pColors[priority]||C.bd),
    opacity:done?0.6:1,transition:"all 0.2s",alignItems:"flex-start"
  }}>
    <div style={{width:18,height:18,borderRadius:4,border:"2px solid "+(done?C.green:C.txD),
      background:done?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",
      flexShrink:0,marginTop:1,fontSize:10,color:C.bg,fontWeight:700}}>{done?"✓":""}</div>
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontSize:13,fontWeight:600,color:done?C.txD:C.w,textDecoration:done?"line-through":"none"}}>{title}</div>
      <div style={{display:"flex",gap:8,marginTop:4,flexWrap:"wrap"}}>
        {priority&&<span style={{fontSize:10,fontWeight:600,color:pColors[priority],background:bg8(pColors[priority]),padding:"1px 6px",borderRadius:3}}>{priority}</span>}
        {time&&<span style={{fontSize:10,color:C.txD}}>{time}</span>}
        {impact&&<span style={{fontSize:10,color:C.cyan}}>{impact}</span>}
        {platform&&<span style={{fontSize:10,color:C.purple}}>{platform}</span>}
      </div>
    </div>
  </div>;
}

function Tool({title,fields,out,ld,label,btnTxt,btnCl,onGen,ok,subtitle}){
  return <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
    <div style={{flex:"0 0 380px",maxWidth:"100%"}}><Crd>
      <h3 style={{fontSize:16,fontWeight:700,color:C.w,margin:"0 0 4px"}}>{title}</h3>
      {subtitle&&<p style={{fontSize:12,color:C.txD,margin:"0 0 18px"}}>{subtitle}</p>}
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {fields}
        <Btn primary disabled={!ok} onClick={onGen} sx={btnCl?{background:btnCl}:{}}>{btnTxt||"Generar"}</Btn>
      </div>
    </Crd></div>
    <div style={{flex:1,minWidth:300}}><Out content={out} loading={ld} label={label}/></div>
  </div>;
}

/* ══════ TOOLS ══════ */

function Landing(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[tx,sTx]=useState("");const[ctx,sCtx]=useState("");
  const[nm,sNm]=useState("");const[ci,sCi]=useState("");const[pv,sPv]=useState("");const[br,sBr]=useState("");
  const[dc,sDc]=useState("");const[tone,sTone]=useState("Profesional y cercano");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);const geo=geoStr(ci,pv,br);const srv=resolveTx(tx,ctx);
  return <Tool title="Landing Pages" subtitle="Genera landings completas optimizadas para SEO local y conversion" out={o} ld={l} label="Landing page" btnTxt="Generar Landing" ok={ni&&srv} onGen={()=>
    ai("Experto en copywriting de conversion para landing pages sanitarias y de servicios profesionales. Cada seccion debe contener texto COMPLETO listo para copiar en la web, no esquemas ni indicaciones genericas. Todo el copy debe estar pensado para convertir visitas en consultas o citas.",
    `Landing page completa para el servicio "${srv}" en ${geo}.
Centro: "${nm||"[Nombre del centro]"}".
Profesional responsable: ${dc||"[Doctor/a responsable]"}.
Tono comunicativo: ${tone}.

KEYWORDS GEO OBLIGATORIAS que deben aparecer de forma natural:
"${srv} en ${ci||"[ciudad]"}", "${srv} ${br||ci||"[zona]"}", "mejor ${srv} ${ci||"[ciudad]"}", "${srv} precio ${ci||"[ciudad]"}", "${srv} cerca de mi"

Genera TEXTO COMPLETO Y DEFINITIVO para cada seccion (texto real listo para publicar, no esquemas):

1. HERO con H1 (max 70 chars), subtitulo emocional (max 120 chars), CTA y texto refuerzo.
2. PROBLEMA con preocupaciones reales y 3-4 preguntas tipo Google.
3. SOLUCION con 4-5 beneficios y diferenciador local.
4. PROCESO PASO A PASO 4-5 pasos concretos.
5. EQUIPO posicionando como referente en ${geo}.
6. FAQ 6 preguntas reales con respuestas optimizadas.
7. TESTIMONIOS 3 estructuras con [SUSTITUIR POR TESTIMONIO REAL].
8. CTA FINAL con formulario, telefono, WhatsApp, email y horario.
9. BLOQUE DE CONFIANZA con certificaciones reales del sector.
10. SEO META: title (60c), meta description (155c), schema markup, OG tags.`,sO,sL,nR,geo,
    {tool:"Landing Pages",client:nm||"Sin asignar",inputs:{servicio:srv,tono:tone}})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
      <TreatmentSelector niche={ni} treatment={tx} setTreatment={sTx} customTx={ctx} setCustomTx={sCtx}/>
      <Fld label="Centro"><Inp value={nm} onChange={sNm} ph="Nombre del centro"/></Fld>
      <GeoFields city={ci} setCity={sCi} province={pv} setProvince={sPv} barrio={br} setBarrio={sBr}/>
      <Fld label="Profesional"><Inp value={dc} onChange={sDc} ph="Dr/a. nombre"/></Fld>
      <Fld label="Tono"><Sel value={tone} onChange={sTone} opts={["Profesional y cercano","Premium y exclusivo","Tecnico y riguroso","Calido y empatico"]}/></Fld>
    </>}/>;
}

function WhatsApp(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[sc,sSc]=useState("");const[nm,sNm]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);
  const scs=["Primera consulta nuevo","Post-consulta no reservó","Confirmación cita","Recordatorio 24h","Post-tratamiento día siguiente","Post-tratamiento 1 semana","Reactivación 3 meses","Reactivación 6 meses","Consulta precio","Consulta servicio","Cancelación","Solicitud reseña Google","Presupuesto pendiente","Derivación entre profesionales"];
  return <Tool title="Protocolos WhatsApp" subtitle="Mensajes listos para enviar adaptados a cada escenario" out={o} ld={l} label="Protocolo" btnTxt="Generar Protocolo" btnCl={C.green} ok={ni&&sc} onGen={()=>
    ai("Experto en comunicacion WhatsApp Business para centros de salud y servicios profesionales. Cada mensaje debe sonar NATURAL, como lo escribiria una recepcionista profesional con experiencia. Maximo 160 palabras por mensaje. Cumplir LOPD y RGPD.",
    `Protocolo WhatsApp completo para el escenario: "${sc}". Centro: ${nm||"[Nombre]"}. Sector: ${nR}.
Genera: MENSAJE PRINCIPAL, VARIANTE FORMAL, VARIANTE CERCANA, 4 RESPUESTAS PREPARADAS, GUIA DE ENVIO, ERRORES FRECUENTES, NOTAS LEGALES.`,sO,sL,nR,"Espana",
    {tool:"Protocolos WhatsApp",client:nm||"Sin asignar",inputs:{escenario:sc}})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre})=>{sNm(nombre);}}/>
      <Fld label="Escenario"><Sel value={sc} onChange={sSc} opts={scs} ph="Seleccionar..."/></Fld>
      <Fld label="Centro"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
    </>}/>;
}

function Seo(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[tp,sTp]=useState("");const[kw,sKw]=useState("");
  const[ci,sCi]=useState("");const[pv,sPv]=useState("");const[br,sBr]=useState("");
  const[ln,sLn]=useState("1500 palabras");const[intent,setIntent]=useState("Informacional");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);const geo=geoStr(ci,pv,br);
  return <Tool title="Contenido SEO Geo-Optimizado" subtitle="Artículos posicionados para búsquedas locales" out={o} ld={l} label="Artículo SEO" btnTxt="Generar Artículo" btnCl={C.purple} ok={ni&&tp} onGen={()=>
    ai("Experto SEO en 2026 con especializacion en posicionamiento local para sector sanitario y servicios profesionales en Espana.",
    `ARTICULO SEO GEO-OPTIMIZADO. Tema: "${tp}". Keyword: "${kw||tp}". Geo: ${geo}. Extension: ${ln}. Intencion: ${intent}.
Genera: TITLE TAG, META DESCRIPTION, URL, ESTRUCTURA H1-H3, ARTICULO COMPLETO, FAQ 5 preguntas, CTA INTERNO, KEYWORDS SECUNDARIAS, ENLACES INTERNOS, SCHEMA MARKUP, NOTAS SEO.`,sO,sL,nR,geo,
    {tool:"Contenido SEO",inputs:{tema:tp,extension:ln}})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
      <Fld label="Tema"><Inp value={tp} onChange={sTp} ph="Ej: Qué esperar tras un implante dental"/></Fld>
      <Fld label="Keyword principal"><Inp value={kw} onChange={sKw} ph="Ej: implantes dentales Valencia"/></Fld>
      <GeoFields city={ci} setCity={sCi} province={pv} setProvince={sPv} barrio={br} setBarrio={sBr}/>
      <Fld label="Intención de búsqueda"><Sel value={intent} onChange={setIntent} opts={["Informacional","Transaccional","Navegacional","Comparativa"]}/></Fld>
      <Fld label="Extensión"><Sel value={ln} onChange={sLn} opts={["800 palabras","1200 palabras","1500 palabras","2000 palabras","2500 palabras"]}/></Fld>
    </>}/>;
}

function Audit(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[u,sU]=useState("");const[nt,sNt]=useState("");
  const[ci,sCi]=useState("");const[pv,sPv]=useState("");const[br,sBr]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);const geo=geoStr(ci,pv,br);
  return <Tool title="Auditoría Digital" subtitle="Análisis completo de la presencia digital del negocio" out={o} ld={l} label="Informe" btnTxt="Generar Informe" btnCl={C.gold} ok={u&&ni} onGen={()=>
    ai("Auditor experto en experiencia digital para negocios locales.",
    `Auditoria digital de: ${u}. Geo: ${geo}. Sector: ${nR}. Notas: ${nt||"Ninguna"}
Genera: RESUMEN EJECUTIVO, WEB (/100), SEO LOCAL (/100), GBP (/100), EXPERIENCIA DIGITAL (/100), REDES (/100), PLAN PRIORIZADO, PROYECCION.`,sO,sL,nR,geo,
    {tool:"Auditoría Digital",inputs:{web:u}})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
      <Fld label="Web o nombre"><Inp value={u} onChange={sU} ph="www.ejemplo.es"/></Fld>
      <GeoFields city={ci} setCity={sCi} province={pv} setProvince={sPv} barrio={br} setBarrio={sBr}/>
      <Fld label="Notas"><Txa value={nt} onChange={sNt} ph="Observaciones adicionales..." rows={3}/></Fld>
    </>}/>;
}

function Followup(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[tx,sTx]=useState("");const[ctx,sCtx]=useState("");const[ch,sCh]=useState("Email");const[nm,sNm]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);const srv=resolveTx(tx,ctx);
  return <Tool title="Secuencias Seguimiento" subtitle="Nurturing automatizado para convertir interesados en pacientes" out={o} ld={l} label="Secuencia" btnTxt="Generar" btnCl={C.rose} ok={ni&&srv} onGen={()=>
    ai("Experto en secuencias de seguimiento y nurturing.",
    `Secuencia completa para personas interesadas en "${srv}" que NO han reservado. Centro: ${nm||"[Nombre]"}. Canal: ${ch}. Sector: ${nR}.
5 mensajes: DIA 1, DIA 3, DIA 7, DIA 14, DIA 30. Incluye ASUNTO, MENSAJE, OBJETIVO, METRICA, REGLAS, NOTAS LEGALES, A/B.`,sO,sL,nR,"Espana",
    {tool:"Secuencias Seguimiento",client:nm||"Sin asignar",inputs:{servicio:srv,canal:ch}})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre})=>{sNm(nombre);}}/>
      <TreatmentSelector niche={ni} treatment={tx} setTreatment={sTx} customTx={ctx} setCustomTx={sCtx}/>
      <Fld label="Canal"><Sel value={ch} onChange={sCh} opts={["Email","WhatsApp","SMS"]}/></Fld>
      <Fld label="Centro"><Inp value={nm} onChange={sNm} ph="Nombre del centro"/></Fld>
    </>}/>;
}

function WebStruct(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[nm,sNm]=useState("");const[sp,sSp]=useState("");const[dc,sDc]=useState("");
  const[ci,sCi]=useState("");const[pv,sPv]=useState("");const[br,sBr]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);const geo=geoStr(ci,pv,br);
  return <Tool title="Arquitectura Web" subtitle="Estructura y URLs optimizadas para SEO local" out={o} ld={l} label="Arquitectura" btnTxt="Generar" btnCl={C.blue} ok={!!ni} onGen={()=>
    ai("Arquitecto de informacion web con SEO tecnico y local integrado.",
    `Arquitectura web para: ${nm||"[Nombre]"}. Geo: ${geo}. Especialidades: ${sp||"[Definir]"}. Equipo: ${dc||"[Definir]"}. Sector: ${nR}.
Genera: SITEMAP CON URLs, HOME, PLANTILLA SERVICIO, EQUIPO, BLOG, PAGINAS TRANSVERSALES, ENLAZADO INTERNO, SEO TECNICO.`,sO,sL,nR,geo,
    {tool:"Arquitectura Web",client:nm||"Sin asignar"})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
      <Fld label="Centro"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
      <GeoFields city={ci} setCity={sCi} province={pv} setProvince={sPv} barrio={br} setBarrio={sBr}/>
      <Fld label="Especialidades"><Txa value={sp} onChange={sSp} ph="Servicios principales..." rows={2}/></Fld>
      <Fld label="Equipo"><Txa value={dc} onChange={sDc} ph="Profesionales..." rows={2}/></Fld>
    </>}/>;
}

function Social(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[pl,sPl]=useState("Instagram");const[nm,sNm]=useState("");const[wk,sWk]=useState("4 semanas");
  const[ci,sCi]=useState("");const[pv,sPv]=useState("");const[br,sBr]=useState("");
  const[obj,sObj]=useState("Captar nuevos pacientes/clientes");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);const geo=geoStr(ci,pv,br);
  return <Tool title="Estrategia Redes Sociales" subtitle="Calendario editorial completo con contenido listo para publicar" out={o} ld={l} label="Estrategia" btnTxt="Generar Estrategia" btnCl={C.purple} ok={!!ni} onGen={()=>
    ai("Estratega de redes sociales en 2026 especializado en negocios locales.",
    `Estrategia ${pl} para: ${nm||"[Nombre]"}. Sector: ${nR}. Geo: ${geo}. Periodo: ${wk}. Objetivo: ${obj}.
Genera: ANALISIS, PILARES CONTENIDO, CALENDARIO EDITORIAL, GUIONES REELS, STORIES, HASHTAGS, METRICAS, CUMPLIMIENTO NORMATIVO.`,sO,sL,nR,geo,
    {tool:"Estrategia Redes",client:nm||"Sin asignar",inputs:{plataforma:pl,objetivo:obj}})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
      <Fld label="Plataforma"><Sel value={pl} onChange={sPl} opts={["Instagram","TikTok","Facebook","LinkedIn","Instagram + TikTok","Todas"]}/></Fld>
      <Fld label="Centro"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
      <GeoFields city={ci} setCity={sCi} province={pv} setProvince={sPv} barrio={br} setBarrio={sBr}/>
      <Fld label="Objetivo"><Sel value={obj} onChange={sObj} opts={["Captar nuevos pacientes/clientes","Fidelizar pacientes actuales","Posicionar como referente","Lanzar nuevo servicio","Aumentar notoriedad local"]}/></Fld>
      <Fld label="Periodo"><Sel value={wk} onChange={sWk} opts={["2 semanas","4 semanas","8 semanas","12 semanas"]}/></Fld>
    </>}/>;
}

function Gbp(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[nm,sNm]=useState("");
  const[ci,sCi]=useState("");const[pv,sPv]=useState("");const[br,sBr]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);const geo=geoStr(ci,pv,br);
  return <Tool title="Google Business Profile" subtitle="Optimización completa del perfil de negocio en Google" out={o} ld={l} label="Guía GBP" btnTxt="Generar Guía" btnCl={C.gold} ok={!!ni} onGen={()=>
    ai("Especialista en Google Business Profile y SEO local en 2026.",
    `Guia completa GBP para: ${nm||"[Nombre]"}. Geo: ${geo}. Sector: ${nR}.
Genera: CHECKLIST OPTIMIZACION, ESTRATEGIA FOTOS, PUBLICACIONES 4 semanas, RESPUESTAS RESENAS, FAQ PROACTIVAS, MONITORIZACION.`,sO,sL,nR,geo,
    {tool:"Google Business",client:nm||"Sin asignar"})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
      <Fld label="Centro"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
      <GeoFields city={ci} setCity={sCi} province={pv} setProvince={sPv} barrio={br} setBarrio={sBr}/>
    </>}/>;
}

function Video(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[tx,sTx]=useState("");const[ctx,sCtx]=useState("");
  const[pl,sPl]=useState("Instagram Reels");const[gl,sGl]=useState("Educar");const[nm,sNm]=useState("");const[dc,sDc]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);const srv=resolveTx(tx,ctx);
  return <Tool title="Scripts Vídeo" subtitle="Guiones completos listos para grabar" out={o} ld={l} label="Scripts" btnTxt="Generar Scripts" btnCl={C.orange} ok={ni&&srv} onGen={()=>
    ai("Guionista de video para redes sociales en 2026.",
    `4 scripts sobre "${srv}" para ${pl}. Centro: ${nm||"[Nombre]"}. Profesional: ${dc||"[Nombre]"}. Objetivo: ${gl}.
4 scripts: EDUCATIVO, MITOS, PROCESO, FAQ. Cada uno: GANCHO, DESARROLLO, CTA, TEXTO PANTALLA, INDICACIONES, COPY POST, HASHTAGS.`,sO,sL,nR,"Espana",
    {tool:"Scripts Vídeo",client:nm||"Sin asignar"})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre})=>{sNm(nombre);}}/>
      <TreatmentSelector niche={ni} treatment={tx} setTreatment={sTx} customTx={ctx} setCustomTx={sCtx}/>
      <Fld label="Plataforma"><Sel value={pl} onChange={sPl} opts={["Instagram Reels","TikTok","YouTube Shorts","YouTube largo"]}/></Fld>
      <Fld label="Objetivo"><Sel value={gl} onChange={sGl} opts={["Educar","Generar confianza","Resolver dudas","Mostrar autoridad","Humanizar"]}/></Fld>
      <Fld label="Centro"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
      <Fld label="Profesional"><Inp value={dc} onChange={sDc} ph="Dr/a. nombre"/></Fld>
    </>}/>;
}

function Competitor(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[nm,sNm]=useState("");
  const[ci,sCi]=useState("");const[pv,sPv]=useState("");const[br,sBr]=useState("");const[cm,sCm]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);const geo=geoStr(ci,pv,br);
  return <Tool title="Competencia Local" subtitle="Análisis del posicionamiento competitivo en tu zona" out={o} ld={l} label="Análisis" btnTxt="Analizar" btnCl={C.cyan} ok={nm&&ci&&ni} onGen={()=>
    ai("Analista de competencia digital en 2026.",
    `Analisis competencia para: ${nm} en ${geo}. Competidores: ${cm||"Buscar principales"}. Sector: ${nR}.
Genera: MAPA COMPETITIVO, WEB COMPARATIVO, SEO LOCAL, GOOGLE MAPS, REDES, PRECIOS, OPORTUNIDADES GEO-LOCALES, PLAN.`,sO,sL,nR,geo,
    {tool:"Competencia Local",client:nm})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
      <Fld label="Tu cliente"><Inp value={nm} onChange={sNm} ph="Nombre del centro"/></Fld>
      <GeoFields city={ci} setCity={sCi} province={pv} setProvince={sPv} barrio={br} setBarrio={sBr}/>
      <Fld label="Competidores (opcional)"><Txa value={cm} onChange={sCm} ph="Nombres de competidores conocidos..." rows={2}/></Fld>
    </>}/>;
}

function Compliance(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[txt,sTxt]=useState("");const[tp,sTp]=useState("Texto web / landing");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);
  return <Tool title="Verificador Normativo" subtitle="Análisis de cumplimiento legal publicitario" out={o} ld={l} label="Informe" btnTxt="Verificar" btnCl={C.rose} ok={!!txt} onGen={()=>
    ai("Consultor de cumplimiento normativo publicitario en Espana 2026.",
    `Analiza texto "${tp}" contra normativa del sector ${nR}:
"""
${txt}
"""
Genera: VEREDICTO, INFRACCIONES, ADVERTENCIAS, BUENAS PRACTICAS, VERSION CORREGIDA, CHECKLIST.`,sO,sL,nR,"Espana",
    {tool:"Verificador Normativo",inputs:{tipo:tp}})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
      <Fld label="Tipo texto"><Sel value={tp} onChange={sTp} opts={["Texto web / landing","Post redes","Anuncio Meta/Google","Email","WhatsApp","Blog/SEO","Guion vídeo","Folleto"]}/></Fld>
      <Fld label="Texto a verificar"><Txa value={txt} onChange={sTxt} ph="Pega el texto que quieres verificar..." rows={10}/></Fld>
    </>}/>;
}

function Reviews(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[nm,sNm]=useState("");
  const[rt,sRt]=useState("5 estrellas");const[sc,sSc]=useState("Positiva general");const[rv,sRv]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);
  return <Tool title="Respuesta Reseñas" subtitle="Respuestas profesionales para reseñas de Google" out={o} ld={l} label="Respuestas" btnTxt="Generar" btnCl={C.green} ok={!!ni} onGen={()=>
    ai("Especialista en reputacion online y gestion de resenas.",
    `Genera respuestas para resena de Google. Centro: ${nm||"[Nombre]"}. Sector: ${nR}. Puntuacion: ${rt}. Tipo: ${sc}. ${rv?'Texto: "'+rv+'"':"(Solo puntuacion)"}.
Genera: RESPUESTA PRINCIPAL, VARIANTE FORMAL, VARIANTE CERCANA, REGLAS, ACCION INTERNA${rt.includes("1")||rt.includes("2")||rt.includes("3")?", PROTOCOLO RECUPERACION":""}.`,sO,sL,nR,"Espana",
    {tool:"Respuesta Reseñas",client:nm||"Sin asignar",inputs:{puntuacion:rt}})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre})=>{sNm(nombre);}}/>
      <Fld label="Centro"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
      <Fld label="Puntuación"><Sel value={rt} onChange={sRt} opts={["5 estrellas","4 estrellas","3 estrellas","2 estrellas","1 estrella"]}/></Fld>
      <Fld label="Tipo"><Sel value={sc} onChange={sSc} opts={["Positiva general","Positiva detallada","Positiva sobre profesional","Negativa espera","Negativa precio","Negativa resultado","Negativa trato","Negativa injusta","Neutra"]}/></Fld>
      <Fld label="Texto reseña (opcional)"><Txa value={rv} onChange={sRv} ph="Pega la reseña aquí..." rows={4}/></Fld>
    </>}/>;
}

function Report(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[nm,sNm]=useState("");const[mo,sMo]=useState("Febrero 2026");
  const[vi,sVi]=useState("");const[co,sCo]=useState("");const[bk,sBk]=useState("");
  const[gp,sGp]=useState("");const[rv,sRv]=useState("");const[so,sSo]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);
  return <Tool title="Reporting Mensual" subtitle="Informe ejecutivo con métricas y recomendaciones" out={o} ld={l} label="Informe" btnTxt="Generar Informe" ok={nm&&ni} onGen={()=>
    ai("Analista de marketing digital para negocios locales.",
    `Informe mensual. Centro: ${nm}. Mes: ${mo}. Sector: ${nR}.
Datos: Visitas: ${vi||"[COMPLETAR]"}, Consultas: ${co||"[COMPLETAR]"}, Reservas: ${bk||"[COMPLETAR]"}, Google: ${gp||"[COMPLETAR]"}, Resenas: ${rv||"[COMPLETAR]"}, Redes: ${so||"[COMPLETAR]"}.
Genera: RESUMEN EJECUTIVO, TRAFICO WEB, CONVERSION, SEO LOCAL, GBP, REDES, PLAN PROXIMO MES, PROYECCION.`,sO,sL,nR,"Espana",
    {tool:"Reporting Mensual",client:nm,inputs:{mes:mo}})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre})=>{sNm(nombre);}}/>
      <Fld label="Centro"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
      <Fld label="Mes"><Sel value={mo} onChange={sMo} opts={["Enero 2026","Febrero 2026","Marzo 2026","Abril 2026","Mayo 2026","Junio 2026","Julio 2026","Agosto 2026","Septiembre 2026","Octubre 2026","Noviembre 2026","Diciembre 2026"]}/></Fld>
      <Fld label="Visitas web"><Inp value={vi} onChange={sVi} ph="Ej: 2.340"/></Fld>
      <Fld label="Consultas"><Inp value={co} onChange={sCo} ph="87"/></Fld>
      <Fld label="Reservas"><Inp value={bk} onChange={sBk} ph="34"/></Fld>
      <Fld label="Posiciones Google"><Inp value={gp} onChange={sGp} ph="Ej: implantes #4, carillas #7"/></Fld>
      <Fld label="Reseñas"><Inp value={rv} onChange={sRv} ph="8 nuevas, media 4.7"/></Fld>
      <Fld label="Redes"><Inp value={so} onChange={sSo} ph="+120 seg, 3.2% engagement"/></Fld>
    </>}/>;
}

function Manual(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[nm,sNm]=useState("");
  const[tx,sTx]=useState("");const[dc,sDc]=useState("");const[tn,sTn]=useState("");const[vl,sVl]=useState("");const[au,sAu]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);
  return <Tool title="Manual Comunicación" subtitle="Guía completa de marca y comunicación para todo el equipo" out={o} ld={l} label="Manual" btnTxt="Generar Manual" btnCl={C.gold} ok={nm&&ni} onGen={()=>
    ai("Consultor de marca y comunicacion para negocios de servicios.",
    `MANUAL DE COMUNICACION para: ${nm}. Sector: ${nR}. Servicios: ${tx||"[Principales]"}. Equipo: ${dc||"[Profesionales]"}. Tono: ${tn||"Profesional"}. Valores: ${vl||"[Valores]"}. Audiencia: ${au||"30-55 anos"}.
Genera: IDENTIDAD MARCA, TONO VOZ, MENSAJES CLAVE, PROTOCOLOS, GUIA POR CANAL, GUIA VISUAL, CUMPLIMIENTO, PLANTILLAS.`,sO,sL,nR,"Espana",
    {tool:"Manual Comunicación",client:nm})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre})=>{sNm(nombre);}}/>
      <Fld label="Centro"><Inp value={nm} onChange={sNm} ph="Nombre completo"/></Fld>
      <Fld label="Servicios"><Txa value={tx} onChange={sTx} ph="Servicios principales..." rows={2}/></Fld>
      <Fld label="Equipo"><Txa value={dc} onChange={sDc} ph="Profesionales..." rows={2}/></Fld>
      <Fld label="Tono"><Inp value={tn} onChange={sTn} ph="Profesional, cercano, premium..."/></Fld>
      <Fld label="Valores"><Inp value={vl} onChange={sVl} ph="Excelencia, honestidad, cercanía..."/></Fld>
      <Fld label="Audiencia"><Inp value={au} onChange={sAu} ph="Mujeres 30-55, nivel medio-alto"/></Fld>
    </>}/>;
}

function ScanPresencia(){
  const[nm,sNm]=useState("");const[ci,sCi]=useState("");const[ni,sNi]=useState("");const[cni,sCni]=useState("");
  const[web,sWeb]=useState("");const[o,sO]=useState("");const[l,sL]=useState(false);const[phase,setPhase]=useState(null);
  const nR=resolveNiche(ni,cni);
  return <div>
    <div style={{marginBottom:20}}>
      <h3 style={{fontSize:18,fontWeight:700,color:C.w,margin:"0 0 4px"}}>Scan de Presencia Digital 360</h3>
      <p style={{fontSize:13,color:C.tx,margin:0}}>Busca datos reales del negocio en Internet</p>
    </div>
    <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
      <div style={{flex:"0 0 380px",maxWidth:"100%"}}><Crd>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
          <Fld label="Nombre del negocio *"><Inp value={nm} onChange={sNm} ph="Nombre exacto"/></Fld>
          <Fld label="Ciudad *"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
          <Fld label="Web"><Inp value={web} onChange={sWeb} ph="www.ejemplo.es"/></Fld>
          <Btn primary disabled={!nm||!ci||!ni} color={C.teal} onClick={()=>
            aiSearch("Investigador de presencia digital en 2026.",
            `SCAN 360 para: "${nm}" en ${ci}. Sector: ${nR}. Web: ${web||"No proporcionada"}.
Busca: 1) "${nm}" en Google 2) "${nm} resenas" 3) "${nR} en ${ci}" 4) Presencia en Google Maps, Facebook, Instagram, Doctoralia.
Genera: ESTADO POR PLATAFORMA, RESENAS, COMPETENCIA, GAPS, PLAN DE ACCION.`,sO,sL,nR,ci||"Espana",setPhase,
            {tool:"Scan Presencia 360",client:nm})
          }>Buscar en Internet</Btn>
        </div>
      </Crd></div>
      <div style={{flex:1,minWidth:300}}><OutSearch content={o} loading={l} label="Scan Presencia 360" phase={phase}/></div>
    </div>
  </div>;
}

function DeepAnalysis(){
  const[nm,sNm]=useState("");const[ci,sCi]=useState("");const[ni,sNi]=useState("");const[cni,sCni]=useState("");
  const[web,sWeb]=useState("");const[comp1,sComp1]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);const[phase,setPhase]=useState(null);
  const nR=resolveNiche(ni,cni);
  return <div>
    <div style={{marginBottom:20}}>
      <h3 style={{fontSize:18,fontWeight:700,color:C.w,margin:"0 0 4px"}}>Análisis Profundo de Internet</h3>
      <p style={{fontSize:13,color:C.tx,margin:0}}>La IA busca datos REALES del negocio en Internet</p>
    </div>
    <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
      <div style={{flex:"0 0 380px",maxWidth:"100%"}}><Crd>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
          <Fld label="Nombre *"><Inp value={nm} onChange={sNm} ph="Nombre exacto"/></Fld>
          <Fld label="Ciudad *"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
          <Fld label="Web"><Inp value={web} onChange={sWeb} ph="www.ejemplo.es"/></Fld>
          <Fld label="Competidor"><Inp value={comp1} onChange={sComp1} ph="Nombre competidor"/></Fld>
          <Btn primary disabled={!nm||!ci||!ni} color={C.teal} onClick={()=>
            aiSearch("Investigador digital profesional en 2026.",
            `ANALISIS PROFUNDO para: "${nm}" en ${ci}. Sector: ${nR}. Web: ${web||"No proporcionada"}. Competidor: ${comp1||"Buscar"}.
Busca: presencia Google, resenas, redes, competencia, SEO. Genera informe con FUENTES REALES.`,sO,sL,nR,ci||"Espana",setPhase,
            {tool:"Análisis Profundo",client:nm})
          }>Investigar en Internet</Btn>
        </div>
      </Crd></div>
      <div style={{flex:1,minWidth:300}}><OutSearch content={o} loading={l} label="Análisis Profundo" phase={phase}/></div>
    </div>
  </div>;
}

function Expansion(){
  const[nm,sNm]=useState("");const[ci,sCi]=useState("");const[ni,sNi]=useState("");const[cni,sCni]=useState("");
  const[dir,sDir]=useState("");const[tel,sTel]=useState("");const[web,sWeb]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);
  return <Tool title="Expansión Plataformas" subtitle="Guía paso a paso para dar de alta el negocio en plataformas" out={o} ld={l} label="Guía Expansión" btnTxt="Generar Guía" btnCl={C.blue} ok={nm&&ci&&ni} onGen={()=>
    ai("Especialista en local listings y expansion digital en 2026.",
    `GUIA EXPANSION para: "${nm}" en ${ci}. Sector: ${nR}. Dir: ${dir||"[COMPLETAR]"}. Tel: ${tel||"[COMPLETAR]"}. Web: ${web||"[COMPLETAR]"}.
Para Google Business, Maps, Bing, Apple Maps, Facebook, Instagram, LinkedIn, P.Amarillas, Doctoralia (si salud): URL, pasos, datos, descripcion, fotos, primeras acciones.`,sO,sL,nR,ci||"Espana",
    {tool:"Expansión Plataformas",client:nm})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
      <Fld label="Nombre *"><Inp value={nm} onChange={sNm} ph="Nombre exacto"/></Fld>
      <Fld label="Ciudad *"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
      <Fld label="Dirección"><Inp value={dir} onChange={sDir} ph="C/ Mayor 15"/></Fld>
      <Fld label="Teléfono"><Inp value={tel} onChange={sTel} ph="+34 600 000 000"/></Fld>
      <Fld label="Web"><Inp value={web} onChange={sWeb} ph="www.ejemplo.es"/></Fld>
    </>}/>;
}

function CitationsAudit(){
  const[nm,sNm]=useState("");const[dir,sDir]=useState("");const[tel,sTel]=useState("");const[web,sWeb]=useState("");
  const[ci,sCi]=useState("");const[ni,sNi]=useState("");const[cni,sCni]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);
  return <Tool title="Auditoría NAP / Citations" subtitle="Verifica consistencia de datos en todas las plataformas" out={o} ld={l} label="Informe NAP" btnTxt="Auditar NAP" btnCl={C.gold} ok={nm&&ci} onGen={()=>
    ai("Experto en SEO local y consistencia NAP para negocios en Espana.",
    `AUDITORIA NAP para: "${nm}". Dir: "${dir||"[COMPLETAR]"}". Ciudad: ${ci}. Tel: "${tel||"[COMPLETAR]"}". Web: "${web||"[COMPLETAR]"}". Sector: ${nR}.
Genera: ANALISIS NOMBRE, DIRECCION, TELEFONO, WEB, IMPACTO SEO, CHECKLIST CORRECCION, HERRAMIENTAS, MANTENIMIENTO.`,sO,sL,nR,ci||"Espana",
    {tool:"Auditoría NAP",client:nm})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
      <Fld label="Nombre oficial *"><Inp value={nm} onChange={sNm} ph="Nombre exacto"/></Fld>
      <Fld label="Dirección"><Inp value={dir} onChange={sDir} ph="C/ Mayor 15, 03001"/></Fld>
      <Fld label="Ciudad *"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
      <Fld label="Teléfono"><Inp value={tel} onChange={sTel} ph="+34 600 000 000"/></Fld>
      <Fld label="Web"><Inp value={web} onChange={sWeb} ph="https://www.ejemplo.es"/></Fld>
    </>}/>;
}

function Reputation(){
  const[nm,sNm]=useState("");const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[ci,sCi]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);const[phase,setPhase]=useState(null);
  const nR=resolveNiche(ni,cni);
  return <div>
    <div style={{marginBottom:20}}>
      <h3 style={{fontSize:18,fontWeight:700,color:C.w,margin:"0 0 4px"}}>Gestión de Reputación y Reseñas</h3>
      <p style={{fontSize:13,color:C.tx,margin:0}}>Diagnóstico, solicitud de reseñas y monitorización</p>
    </div>
    <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
      <div style={{flex:"0 0 380px",maxWidth:"100%"}}><Crd>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
          <Fld label="Centro *"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
          <Fld label="Ciudad"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
          <Btn primary disabled={!nm||!ni} color={C.teal} onClick={()=>
            aiSearch("Investigador de reputacion online en 2026.",
            `DIAGNOSTICO REPUTACION para: "${nm}" en ${ci||"Espana"}. Sector: ${nR}.
Busca resenas reales, compara con competencia, analiza sentimiento. Plan de solicitud y protocolo respuesta.`,sO,sL,nR,ci||"Espana",setPhase,
            {tool:"Reputación",client:nm})
          }>Buscar reseñas reales</Btn>
          <Btn primary disabled={!nm||!ni} color={C.green} onClick={()=>
            ai("Especialista en generacion de resenas para negocios locales.",
            `SISTEMA SOLICITUD RESENAS para: ${nm}. Sector: ${nR}. Ciudad: ${ci||"Espana"}.
Genera: enlace directo resena Google, WhatsApp (3 variantes), emails (2), SMS, guion recepcion, materiales fisicos, automatizacion, timing, metricas, legal.`,sO,sL,nR,ci||"Espana",
            {tool:"Reputación - Solicitud",client:nm})
          }>Generar Sistema Solicitud</Btn>
        </div>
      </Crd></div>
      <div style={{flex:1,minWidth:300}}><OutSearch content={o} loading={l} label="Reputación" phase={phase}/></div>
    </div>
  </div>;
}

function VoiceSeo(){
  const[nm,sNm]=useState("");const[ci,sCi]=useState("");const[ni,sNi]=useState("");const[cni,sCni]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);
  return <Tool title="SEO para Búsquedas por Voz" subtitle="Optimiza para Google Assistant, Siri, Alexa" out={o} ld={l} label="Voice SEO" btnTxt="Generar Estrategia" btnCl={C.purple} ok={nm&&ci&&ni} onGen={()=>
    ai("Especialista en Voice Search Optimization en 2026 para Espana.",
    `ESTRATEGIA VOICE SEO para: ${nm} en ${ci}. Sector: ${nR}.
Genera: CONSULTAS DE VOZ, FUENTES POR ASISTENTE, CONTENIDO OPTIMIZADO, SCHEMA MARKUP, BUSQUEDAS CERCA DE MI, METRICAS.`,sO,sL,nR,ci||"Espana",
    {tool:"SEO Voz",client:nm})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
      <Fld label="Centro *"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
      <Fld label="Ciudad *"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
    </>}/>;
}

function BrandMonitor(){
  const[nm,sNm]=useState("");const[ci,sCi]=useState("");const[ni,sNi]=useState("");const[cni,sCni]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);
  return <Tool title="Monitor de Marca Online" subtitle="Estrategia para detectar y gestionar menciones" out={o} ld={l} label="Plan Monitor" btnTxt="Generar Plan" btnCl={C.orange} ok={nm&&ni} onGen={()=>
    ai("Consultor de brand monitoring y online reputation management.",
    `PLAN MONITORIZACION para: ${nm} en ${ci||"Espana"}. Sector: ${nR}.
Genera: ALERTAS GOOGLE, ALERTAS GBP, ALERTAS REDES, RESENAS, COMPETENCIA, NEGATIVO, HERRAMIENTAS, PROTOCOLO RESPUESTA, INFORME MENSUAL, CALENDARIO.`,sO,sL,nR,ci||"Espana",
    {tool:"Monitor de Marca",client:nm})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
      <Fld label="Centro *"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
      <Fld label="Ciudad"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
    </>}/>;
}

function ImplementHub(){
  const[nm,sNm]=useState("");const[ci,sCi]=useState("");const[ni,sNi]=useState("");const[cni,sCni]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);const[phase,setPhase]=useState(null);
  const nR=resolveNiche(ni,cni);
  return <div>
    <div style={{marginBottom:20}}>
      <h3 style={{fontSize:18,fontWeight:700,color:C.w,margin:"0 0 4px"}}>Hub de Implementación</h3>
      <p style={{fontSize:13,color:C.tx,margin:0}}>Plan de acción personalizado basado en datos reales</p>
    </div>
    <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
      <div style={{flex:"0 0 380px",maxWidth:"100%"}}><Crd>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
          <Fld label="Centro *"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
          <Fld label="Ciudad *"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
          <Btn primary disabled={!nm||!ni} color={C.rose} onClick={()=>
            aiSearch("Consultor de marketing digital en 2026.",
            `PLAN IMPLEMENTACION para: "${nm}" en ${ci}. Sector: ${nR}.
Busca el negocio, detecta estado real, genera: DIAGNOSTICO EXPRESS, FASE 1 URGENTE, FASE 2 CORTO, FASE 3 MEDIO, MANTENIMIENTO, IMPACTO ESTIMADO.`,sO,sL,nR,ci||"Espana",setPhase,
            {tool:"Hub Implementación",client:nm})
          }>Generar Plan (busca en Internet)</Btn>
        </div>
      </Crd></div>
      <div style={{flex:1,minWidth:300}}><OutSearch content={o} loading={l} label="Plan Implementación" phase={phase}/></div>
    </div>
  </div>;
}

/* ══════ HUB GENÉRICO + DIAGNÓSTICO 360 ══════ */
function Hub({ title, subtitle, sections, accent }){
  const [ni,sNi]=useState("");const [cni,sCni]=useState("");
  const [nm,sNm]=useState("");const [ci,sCi]=useState("");
  const [pv,sPv]=useState("");const [web,sWeb]=useState("");
  const [comp,sComp]=useState("");
  const [sel,sSel]=useState(()=>new Set(sections.filter(s=>s.essential).map(s=>s.key)));
  const [outs,sOuts]=useState({});
  const [running,sRunning]=useState(false);
  const nR=resolveNiche(ni,cni); const geo=geoStr(ci,pv,"");
  const toggle=(k)=>{const n=new Set(sel);n.has(k)?n.delete(k):n.add(k);sSel(n);};
  const setOut=(k,patch)=>sOuts(o=>({...o,[k]:{...(o[k]||{}),...patch}}));
  async function runKeys(keys){
    if(running) return; sRunning(true);
    const inputs={cliente:nm||"[Cliente]",nicho:nR,geo,web,competidores:comp};
    for(const k of keys){
      const sec=sections.find(s=>s.key===k); if(!sec) continue;
      const prompt=sec.buildPrompt(inputs);
      const log={tool:sec.label,client:nm||"Sin asignar"};
      const setO=(v)=>setOut(k,{text:typeof v==="function"?v(outs[k]?.text||""):v});
      const setL=(b)=>setOut(k,{loading:b});
      const setPhase=(p)=>setOut(k,{phase:p});
      if(sec.web) await aiSearch(sec.system,prompt,setO,setL,nR,geo,setPhase,log);
      else await ai(sec.system,prompt,setO,setL,nR,geo,log);
    }
    sRunning(false);
  }
  const runSelected=()=>runKeys([...sel]);
  const runEssential=()=>{const ek=sections.filter(s=>s.essential).map(s=>s.key);sSel(new Set(ek));runKeys(ek);};
  return <div>
    <h3 style={{fontSize:18,fontWeight:700,color:C.w,margin:"0 0 4px"}}>{title}</h3>
    <p style={{fontSize:12,color:C.txD,margin:"0 0 14px"}}>{subtitle}</p>
    <Crd sx={{marginBottom:14}}>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}
        onClientSelect={({nombre,ciudad,provincia})=>{sNm(nombre||"");sCi(ciudad||"");sPv(provincia||"");}}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginTop:10}}>
        <Fld label="Centro *"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
        <Fld label="Ciudad *"><Inp value={ci} onChange={sCi} ph="Ciudad"/></Fld>
        <Fld label="Provincia"><Inp value={pv} onChange={sPv} ph="Provincia"/></Fld>
        <Fld label="Web"><Inp value={web} onChange={sWeb} ph="https://"/></Fld>
        <Fld label="Competidores (opcional)"><Inp value={comp} onChange={sComp} ph="Nombres o vacío"/></Fld>
      </div>
      <div style={{marginTop:12,display:"flex",flexWrap:"wrap",gap:8}}>
        {sections.map(s=><label key={s.key} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.tx,cursor:"pointer",padding:"4px 8px",background:sel.has(s.key)?bg8(accent||C.teal):C.sf2,borderRadius:6}}>
          <input type="checkbox" checked={sel.has(s.key)} onChange={()=>toggle(s.key)}/>{s.label}
        </label>)}
      </div>
      <div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}>
        <Btn primary color={accent||C.teal} onClick={runSelected} disabled={running||!nm||!ci||sel.size===0}>Generar seleccionadas ({sel.size})</Btn>
        <Btn color={C.gold} onClick={runEssential} disabled={running||!nm||!ci}>Generar lo esencial</Btn>
      </div>
    </Crd>
    {sections.filter(s=>outs[s.key]).map(s=><div key={s.key} style={{marginBottom:14}}>
      <OutSearch content={outs[s.key]?.text||""} loading={outs[s.key]?.loading} label={s.label} phase={outs[s.key]?.phase}/>
    </div>)}
  </div>;
}

function DiagnosticoHub(){
  return <Hub title="Diagnóstico 360" subtitle="Auditoría completa de presencia digital en una sola pasada" sections={DIAGNOSTICO_SECTIONS} accent={C.cyan}/>;
}

/* ══════ IMAGE PROMPT + FLUX ══════ */
function ImagePrompt(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");
  const[idea,sIdea]=useState("");const[platform,setPlatform]=useState("Midjourney");const[style,setStyle]=useState("Fotografía profesional");
  const[nm,sNm]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const[imgPrompt,setImgPrompt]=useState("");const[imgModel,setImgModel]=useState("schnell");const[imgSize,setImgSize]=useState("landscape_16_9");
  const[imgLoading,setImgLoading]=useState(false);const[imgResult,setImgResult]=useState(null);const[imgError,setImgError]=useState("");
  const[imgHistory,setImgHistory]=useState([]);
  const nR=resolveNiche(ni,cni);
  const platforms=["Midjourney","DALL-E 3","Stable Diffusion","Ideogram","Leonardo AI","Canva IA","Adobe Firefly","Flux","Todos"];

  const generateImage=async()=>{
    if(!imgPrompt.trim()) return;
    setImgLoading(true);setImgError("");setImgResult(null);
    try{
      const r=await fetch("/api/image",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({prompt:imgPrompt,model:imgModel,image_size:imgSize,num_images:1})
      });
      const data=await r.json();
      if(!r.ok){setImgError(data.error||"Error generando imagen");setImgLoading(false);return;}
      if(data.images&&data.images.length>0){
        setImgResult(data.images[0]);
        setImgHistory(prev=>[{url:data.images[0].url,prompt:imgPrompt,model:imgModel,date:new Date().toISOString()},...prev].slice(0,12));
        logActivity("Generador Imagen IA",nm||"Sin asignar",{prompt:imgPrompt.slice(0,100),modelo:imgModel},"Imagen generada: "+data.images[0].url,{provider:"fal",model:imgModel});
      }
    }catch(e){setImgError("Error de conexion: "+e.message);}
    setImgLoading(false);
  };

  return <div>
    <div style={{marginBottom:20}}>
      <h3 style={{fontSize:18,fontWeight:700,color:C.w,margin:"0 0 4px"}}>Imagen IA</h3>
      <p style={{fontSize:13,color:C.tx,margin:0}}>Genera prompts optimizados y crea imagenes directamente con Flux AI</p>
    </div>

    <div style={{display:"flex",gap:24,flexWrap:"wrap",marginTop:16}}>
      <div style={{flex:"0 0 400px",maxWidth:"100%"}}>
        <Crd>
          <h4 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 14px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{background:C.rose,color:C.bg,padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:700}}>FLUX AI</span>
            Generar Imagen
          </h4>
          <Fld label="Prompt de imagen (en ingles para mejor resultado)">
            <Txa value={imgPrompt} onChange={setImgPrompt} ph="Ej: Professional dental clinic reception, warm lighting, modern minimalist interior, happy receptionist greeting patient, soft bokeh background, commercial photography style" rows={4}/>
          </Fld>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,margin:"12px 0"}}>
            <Fld label="Modelo">
              <Sel value={imgModel} onChange={setImgModel} opts={[
                {value:"schnell",label:"Schnell (rapido, ~0.003 USD)"},
                {value:"dev",label:"Dev (equilibrado, ~0.025 USD)"},
                {value:"realism",label:"Realism (fotorealista, ~0.025 USD)"},
                {value:"pro",label:"Pro Ultra (premium, ~0.06 USD)"}
              ]}/>
            </Fld>
            <Fld label="Formato">
              <Sel value={imgSize} onChange={setImgSize} opts={[
                {value:"landscape_16_9",label:"Horizontal 16:9"},
                {value:"landscape_4_3",label:"Horizontal 4:3"},
                {value:"square_hd",label:"Cuadrado HD"},
                {value:"square",label:"Cuadrado"},
                {value:"portrait_4_3",label:"Vertical 4:3"},
                {value:"portrait_16_9",label:"Vertical 16:9"}
              ]}/>
            </Fld>
          </div>
          <Fld label="Cliente"><Inp value={nm} onChange={sNm} ph="Nombre del cliente"/></Fld>
          <Btn primary disabled={!imgPrompt.trim()||imgLoading} color={C.rose} onClick={generateImage} sx={{marginTop:12,width:"100%"}}>
            {imgLoading?"Generando imagen...":"Generar Imagen"}
          </Btn>
          {imgLoading&&<div style={{display:"flex",alignItems:"center",gap:8,marginTop:10}}>
            <div className="spinner"/>
            <span style={{fontSize:12,color:C.tx}}>Generando con Flux {imgModel}... puede tardar 5-15s</span>
          </div>}
          {imgError&&<div style={{marginTop:10,padding:"8px 12px",background:bg8(C.red),border:"1px solid "+C.red,borderRadius:8,fontSize:12,color:C.red}}>{imgError}</div>}
        </Crd>

        <Crd sx={{marginTop:16}}>
          <h4 style={{fontSize:13,fontWeight:700,color:C.w,margin:"0 0 10px"}}>Prompts rapidos</h4>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[
              {lb:"Recepcion clinica",p:"Professional medical clinic reception area, warm ambient lighting, modern minimalist design, white and wood tones, potted plants, clean and welcoming atmosphere, commercial interior photography"},
              {lb:"Doctor consulta",p:"Professional doctor in white coat consulting with patient in modern medical office, warm lighting, empathetic conversation, soft focus background, editorial healthcare photography"},
              {lb:"Equipo medico",p:"Diverse team of healthcare professionals standing together in modern hospital corridor, confident poses, professional attire, soft natural lighting, corporate team photo style"},
              {lb:"Tratamiento dental",p:"Modern dental treatment room with advanced equipment, patient comfortable in chair, dentist performing procedure, clean clinical environment, warm LED lighting, professional medical photography"},
              {lb:"Fachada negocio",p:"Modern professional business storefront exterior, clean signage, large windows, welcoming entrance, daytime natural lighting, urban commercial district, architectural photography"},
              {lb:"Redes sociales",p:"Flat lay creative social media content arrangement, smartphone, coffee cup, notebook, succulent plant, pastel colors, overhead shot, instagram aesthetic, lifestyle photography"}
            ].map(q=><button key={q.lb} onClick={()=>setImgPrompt(q.p)} style={{fontSize:11,padding:"5px 10px",background:bg8(C.rose),color:C.rose,border:"1px solid "+C.rose+"40",borderRadius:6,cursor:"pointer"}}>{q.lb}</button>)}
          </div>
        </Crd>
      </div>

      <div style={{flex:1,minWidth:300}}>
        {imgResult&&<Crd>
          <div style={{position:"relative",borderRadius:10,overflow:"hidden",marginBottom:12}}>
            <img src={imgResult.url} alt="Imagen generada" style={{width:"100%",height:"auto",display:"block",borderRadius:10}}/>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <a href={imgResult.url} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}}>
              <Btn small primary color={C.teal}>Abrir original</Btn>
            </a>
            <Btn small onClick={()=>navigator.clipboard.writeText(imgResult.url)}>Copiar URL</Btn>
            <Btn small onClick={()=>navigator.clipboard.writeText(imgPrompt)}>Copiar prompt</Btn>
            <Btn small color={C.blue} onClick={()=>{
              const a=document.createElement("a");a.href=imgResult.url;a.download="cliniq-image-"+Date.now()+".png";a.target="_blank";a.click();
            }}>Descargar</Btn>
          </div>
          <div style={{marginTop:10,fontSize:11,color:C.txD,lineHeight:1.5}}>
            <span style={{color:C.tx}}>Prompt:</span> {imgPrompt.slice(0,150)}{imgPrompt.length>150?"...":""}
          </div>
        </Crd>}

        {!imgResult&&!imgLoading&&<Crd sx={{textAlign:"center",padding:"60px 30px"}}>
          <div style={{fontSize:40,marginBottom:12}}>◧</div>
          <p style={{color:C.tx,fontSize:14,margin:"0 0 6px"}}>Escribe un prompt o usa uno rapido</p>
          <p style={{color:C.txD,fontSize:12,margin:0}}>La imagen se mostrara aqui. Modelos desde 0.003 USD/imagen.</p>
        </Crd>}

        {imgHistory.length>0&&<div style={{marginTop:16}}>
          <h4 style={{fontSize:13,fontWeight:700,color:C.w,margin:"0 0 10px"}}>Imagenes recientes</h4>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8}}>
            {imgHistory.map((h,i)=><div key={i} style={{position:"relative",borderRadius:8,overflow:"hidden",cursor:"pointer",border:"1px solid "+C.bd}} onClick={()=>{setImgResult({url:h.url});setImgPrompt(h.prompt);}}>
              <img src={h.url} alt="" style={{width:"100%",height:80,objectFit:"cover",display:"block"}}/>
              <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,rgba(0,0,0,0.8))",padding:"12px 6px 4px",fontSize:9,color:"#fff"}}>{h.model}</div>
            </div>)}
          </div>
        </div>}
      </div>
    </div>

    <div style={{marginTop:24,borderTop:"1px solid "+C.bd,paddingTop:20}}>
      <h4 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 14px"}}>Generador de Prompts por IA</h4>
      <Tool title="" subtitle="" out={o} ld={l} label="Prompts" btnTxt="Generar Prompts IA" btnCl={C.purple} ok={ni&&idea} onGen={()=>
        ai("Experto en prompt engineering para imagenes IA 2026.",
        `PROMPTS DE IMAGEN IA. Sector: ${nR}. Centro: ${nm||"[Negocio]"}. Idea: ${idea}. Plataforma: ${platform}. Estilo: ${style}.
Genera 4 prompts COMPLETOS listos para copiar, con parametros, negative prompt, instrucciones uso, tips del sector.`,sO,sL,nR,"Espana",
        {tool:"Prompts Imagen IA",client:nm||"Sin asignar",inputs:{idea:idea,plataforma:platform}})}
        fields={<>
          <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre})=>{sNm(nombre);}}/>
          <Fld label="Idea / Concepto *"><Txa value={idea} onChange={sIdea} ph="Ej: Foto recepcion clinica con ambiente calido..." rows={3}/></Fld>
          <Fld label="Plataforma IA"><Sel value={platform} onChange={setPlatform} opts={platforms}/></Fld>
          <Fld label="Estilo visual"><Sel value={style} onChange={setStyle} opts={["Fotografía profesional","Fotografía lifestyle","Ilustración moderna","3D render","Minimalista","Cinematográfico","Editorial"]}/></Fld>
        </>}/>
    </div>
  </div>;
}

/* ══════ LOPD CHECKBOX ══════ */
function LopdChk({checked,onChange,label}){
  return <div onClick={(e)=>{e.preventDefault();e.stopPropagation();onChange(!checked);}} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 0",cursor:"pointer",userSelect:"none"}}>
    <div style={{width:22,height:22,borderRadius:4,border:"2px solid "+(checked?C.green:C.bd),background:checked?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,transition:"all 0.15s"}}>
      {checked&&<span style={{color:C.bg,fontSize:14,fontWeight:700}}>X</span>}
    </div>
    <span style={{fontSize:13,color:C.w,lineHeight:1.5}}>{label}</span>
  </div>;
}

/* ══════ LOPD GENERATOR ══════ */
function LOPDDocument({client,onClose,onSave}){
  const[docDate,setDocDate]=useState(new Date().toISOString().split("T")[0]);
  const[consent1,setConsent1]=useState(false);
  const[consent2,setConsent2]=useState(false);
  const[consent3,setConsent3]=useState(false);
  const[comercial,setComercial]=useState("autorizo");
  const[feedback,setFeedback]=useState("");

  const empresa=client.empresa||"Cliniq Digital";
  const cifEmpresa=client.cifEmpresa||"[CIF EMPRESA]";
  const dirEmpresa=client.dirFiscal||"[DIRECCION EMPRESA]";
  const emailEmpresa=client.emailEmpresa||"info@cliniqdigital.com";
  const fmtDate=(val)=>{
    if(!val) return "_______________";
    if(val.match(/^\d{4}-\d{2}-\d{2}$/)){try{return new Date(val+"T12:00:00").toLocaleDateString("es-ES",{day:"2-digit",month:"long",year:"numeric"});}catch(e){}}
    return val;
  };
  const dateStr=fmtDate(docDate);

  const buildPlainText=()=>`DOCUMENTO DE CONSENTIMIENTO Y AUTORIZACION
PROTECCION DE DATOS PERSONALES (RGPD UE 2016/679 + LO 3/2018)

1. RESPONSABLE DEL TRATAMIENTO
Razon social: ${empresa}
CIF/NIF: ${cifEmpresa}
Domicilio: ${dirEmpresa}
Email: ${emailEmpresa}

2. INTERESADO (CLIENTE)
Nombre: ${client.nombre||"[NOMBRE]"}
NIF/CIF: ${client.nif||"[NIF]"}
Domicilio: ${client.dirFiscal||"[DIRECCION]"}, ${client.cpFiscal||""} ${client.ciudadFiscal||"[CIUDAD]"} (${client.provinciaFiscal||""})
Email: ${client.email||"[EMAIL]"}
Telefono: ${client.telefono||"[TELEFONO]"}
Contacto: ${client.contacto||"[CONTACTO]"}
Cargo: ${client.cargoContacto||"[CARGO]"}

3. FINALIDAD DEL TRATAMIENTO
a) Gestion de la relacion contractual (Plan: ${client.plan||"[PLAN]"})
b) Facturacion y cobro
c) Gestion de presencia digital y reputacion online
d) Creacion y gestion de contenido digital
e) Comunicaciones relacionadas con el servicio
${comercial==="autorizo"?"f) Envio de comunicaciones comerciales sobre servicios propios":""}

4. BASE JURIDICA: Art. 6.1.b) contrato, Art. 6.1.a) consentimiento, Art. 6.1.c) legal.
5. PLAZO CONSERVACION: 4 anos fiscal, 5 anos contractual, 3 anos datos personales.
6. DESTINATARIOS: Administraciones publicas, proveedores tecnologicos. Sin transferencias fuera EEE.
7. DERECHOS: Acceso, rectificacion, supresion, limitacion, portabilidad, oposicion. Ejercicio: ${emailEmpresa}. Reclamaciones: AEPD.

8. CONSENTIMIENTO
D./Da. ${client.contacto||client.nombre||""}, NIF ${client.nif||""}:
${consent1?"[X]":"[ ]"} CONSIENTO el tratamiento de mis datos.
${consent2?"[X]":"[ ]"} AUTORIZO la gestion de presencia digital.
${consent3?"[X]":"[ ]"} ${comercial==="autorizo"?"AUTORIZO":"NO AUTORIZO"} comunicaciones comerciales.

En ${client.ciudadFiscal||"_____________"}, a ${dateStr}.

Firma cliente:                          Firma responsable:
_________________________               _________________________
${client.contacto||client.nombre||""}                              ${empresa}
NIF: ${client.nif||""}                                CIF: ${cifEmpresa}`;

  const buildHTML=()=>`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>LOPD - ${client.nombre}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Georgia,serif;padding:50px 70px;line-height:1.7;font-size:12.5px;color:#1a1a1a;max-width:820px;margin:auto}
h1{font-size:16px;text-align:center;margin-bottom:4px}
.header{border:2px solid #333;padding:20px;margin-bottom:30px;text-align:center}
.footer{text-align:center;margin-top:40px;font-size:10px;color:#999;padding-top:12px;border-top:1px solid #ddd}
@media print{body{padding:30px 50px}.no-print{display:none}}
</style></head><body>
<div class="header"><h1>DOCUMENTO DE CONSENTIMIENTO Y AUTORIZACION</h1></div>
${buildPlainText().split("\n").map(l=>"<p>"+(l||"&nbsp;").replace(/</g,"&lt;")+"</p>").join("\n")}
<div class="footer">Documento generado el ${dateStr} - ${empresa}</div>
<script>setTimeout(()=>window.print(),500)<\/script>
</body></html>`;

  const printDoc=()=>{const w=window.open("","_blank");if(!w)return;w.document.write(buildHTML());w.document.close();};
  const copyDoc=()=>{
    const txt=buildPlainText();
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(()=>{setFeedback("Copiado!");setTimeout(()=>setFeedback(""),2000);}).catch(()=>fbCopy(txt));
    }else fbCopy(txt);
  };
  const fbCopy=(txt)=>{const ta=document.createElement("textarea");ta.value=txt;ta.style.cssText="position:fixed;left:-9999px";document.body.appendChild(ta);ta.select();try{document.execCommand("copy");setFeedback("Copiado!");}catch(e){}document.body.removeChild(ta);setTimeout(()=>setFeedback(""),2000);};
  const saveDoc=()=>{
    if(onSave) onSave(buildPlainText());
    setFeedback("Guardado en biblioteca!");
    setTimeout(()=>setFeedback(""),2500);
  };

  return <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.85)",zIndex:9999,overflowY:"auto",padding:"20px"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={{maxWidth:800,margin:"0 auto",background:C.sf,border:"1px solid "+C.bd,borderRadius:14,overflow:"hidden"}}>
      <div style={{padding:"16px 24px",borderBottom:"1px solid "+C.bd,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,position:"sticky",top:0,background:C.sf,zIndex:1}}>
        <div>
          <h3 style={{fontSize:16,fontWeight:700,color:C.w,margin:0}}>Documento LOPD / RGPD</h3>
          <p style={{fontSize:12,color:C.txD,margin:"2px 0 0"}}>{client.nombre}</p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          {feedback&&<span style={{fontSize:11,color:C.green,fontWeight:600}}>{feedback}</span>}
          <Btn small primary color={C.gold} onClick={saveDoc}>Guardar</Btn>
          <Btn small primary color={C.green} onClick={copyDoc}>Copiar</Btn>
          <Btn small primary color={C.blue} onClick={printDoc}>Imprimir / PDF</Btn>
          <Btn small onClick={onClose}>Cerrar</Btn>
        </div>
      </div>

      <div style={{padding:24}}>
        <div style={{textAlign:"center",padding:"16px 20px",border:"2px solid "+C.teal,borderRadius:10,marginBottom:24}}>
          <div style={{fontSize:15,fontWeight:700,color:C.w,letterSpacing:1}}>DOCUMENTO DE CONSENTIMIENTO Y AUTORIZACION</div>
          <div style={{fontSize:12,color:C.txD,marginTop:4}}>Proteccion de Datos - RGPD (UE 2016/679) y LOPDGDD (LO 3/2018)</div>
        </div>

        <Crd sx={{marginBottom:16}}>
          <h4 style={{fontSize:13,fontWeight:700,color:C.teal,margin:"0 0 10px"}}>1. RESPONSABLE</h4>
          <div style={{fontSize:13,color:C.tx}}>
            <p><span style={{color:C.w,fontWeight:600}}>{empresa}</span> - CIF: {cifEmpresa}</p>
            <p>{dirEmpresa} - Email: {emailEmpresa}</p>
          </div>
        </Crd>

        <Crd sx={{marginBottom:16}}>
          <h4 style={{fontSize:13,fontWeight:700,color:C.blue,margin:"0 0 10px"}}>2. INTERESADO</h4>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 20px",fontSize:13}}>
            <div><span style={{color:C.txD}}>Nombre:</span> <span style={{color:C.w}}>{client.nombre||"-"}</span></div>
            <div><span style={{color:C.txD}}>NIF:</span> <span style={{color:C.w}}>{client.nif||"-"}</span></div>
            <div style={{gridColumn:"1/-1"}}><span style={{color:C.txD}}>Direccion:</span> <span style={{color:C.w}}>{client.dirFiscal||"-"}, {client.cpFiscal||""} {client.ciudadFiscal||"-"}</span></div>
            <div><span style={{color:C.txD}}>Email:</span> <span style={{color:C.w}}>{client.email||"-"}</span></div>
            <div><span style={{color:C.txD}}>Telefono:</span> <span style={{color:C.w}}>{client.telefono||"-"}</span></div>
          </div>
        </Crd>

        <Crd sx={{marginBottom:16,border:"2px solid "+C.teal}}>
          <h4 style={{fontSize:13,fontWeight:700,color:C.green,margin:"0 0 12px"}}>8. CONSENTIMIENTO</h4>
          <LopdChk checked={consent1} onChange={setConsent1} label="CONSIENTO el tratamiento de mis datos personales para las finalidades descritas."/>
          <LopdChk checked={consent2} onChange={setConsent2} label="AUTORIZO la gestion de la presencia digital de mi negocio en las plataformas acordadas."/>
          <div style={{marginTop:8}}>
            <Fld label="Comunicaciones comerciales">
              <Sel value={comercial} onChange={setComercial} opts={[{v:"autorizo",l:"AUTORIZO comunicaciones comerciales"},{v:"no_autorizo",l:"NO AUTORIZO comunicaciones comerciales"}]}/>
            </Fld>
          </div>
          <LopdChk checked={consent3} onChange={setConsent3} label={comercial==="autorizo"?"AUTORIZO el envio de comunicaciones comerciales.":"NO AUTORIZO el envio de comunicaciones comerciales."}/>
        </Crd>

        <Crd>
          <Fld label="Fecha del documento">
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:13,color:C.tx}}>En <span style={{color:C.w,fontWeight:600}}>{client.ciudadFiscal||"_____________"}</span>, a</span>
              <input type="date" value={docDate} onChange={e=>setDocDate(e.target.value)} style={{background:C.sf,border:"1px solid "+C.teal,color:C.w,padding:"8px 12px",borderRadius:6,fontFamily:font,fontSize:13,outline:"none"}}/>
            </div>
          </Fld>
          <p style={{fontSize:11,color:C.txD,marginTop:4}}>En el documento aparece como: <span style={{color:C.teal}}>{dateStr}</span></p>
        </Crd>

        <div style={{textAlign:"center",padding:16,fontSize:11,color:C.txD}}>Documento generado el {dateStr} - {empresa}</div>
      </div>
    </div>
  </div>;
}

/* ══════ CLIENTS ══════ */
function Clients(){
  const[tab,setTab]=useState("list");
  const[cls,setCls]=useState([]);
  const[sel,setSel]=useState(null);
  const[edit,setEdit]=useState(null);
  const[isNew,setIsNew]=useState(false);
  const[clientSearch,setClientSearch]=useState("");
  const[logClientFilter,setLogClientFilter]=useState("");
  const[clientLibrary,setClientLibrary]=useState([]);
  const[shareLink,setShareLink]=useState("");
  const[lopdClient,setLopdClient]=useState(null);
  const[briefClient,setBriefClient]=useState(null);

  useEffect(()=>{db.getClients().then(d=>setCls(d||[]));},[]);

  const fields=[
    {gp:"Datos básicos",f:[{k:"nombre",l:"Nombre",ph:"Clínica Dental Sonrisa"},{k:"nicho",l:"Nicho",ph:"Odontología"},{k:"plan",l:"Plan",sel:PLANS.map(p=>p.lb)}]},
    {gp:"Datos fiscales",f:[{k:"empresa",l:"Razón Social",ph:"S.L./S.A."},{k:"nif",l:"NIF / CIF",ph:"B12345678"},{k:"dirFiscal",l:"Dirección",ph:"C/ Mayor 15"},{k:"cpFiscal",l:"CP",ph:"03001"},{k:"ciudadFiscal",l:"Ciudad",ph:"Alicante"},{k:"provinciaFiscal",l:"Provincia",ph:"Alicante"}]},
    {gp:"Contacto comercial",f:[{k:"contacto",l:"Nombre contacto",ph:"María García"},{k:"cargoContacto",l:"Cargo",ph:"Gerente"},{k:"email",l:"Email",ph:"info@ejemplo.es"},{k:"telefono",l:"Teléfono",ph:"+34 600 000 000"}]},
    {gp:"Servicio acordado",f:[{k:"fechaInicio",l:"Fecha alta",ph:"2026-02-01",type:"date"},{k:"fechaFin",l:"Fin contrato",ph:"2026-02-01",type:"date"},{k:"importeMensual",l:"Importe mensual €"},{k:"formaPago",l:"Forma pago",sel:["Domiciliación SEPA","Transferencia mensual","Stripe / tarjeta","Bizum","Otro"]},{k:"diaFactura",l:"Día factura",ph:"1, 15..."}]},
    {gp:"Notas",f:[{k:"notas",l:"Notas internas",txa:true}]}
  ];

  const startEdit=(c)=>{setEdit({...c});setIsNew(false);setSel(c.id);setTab("list");};
  const startNew=()=>{const blank={};fields.forEach(g=>g.f.forEach(f=>blank[f.k]=""));setEdit({...blank,plan:"Profesional",formaPago:"Domiciliación SEPA"});setIsNew(true);setSel(null);setTab("list");};
  const save=async()=>{
    if(!edit)return;
    try{
      const saved=await db.saveClient(edit);
      const list=await db.getClients();
      setCls(list||[]);
      setSel(saved?.id);
      setEdit(null);setIsNew(false);
    }catch(e){alert("Error guardando: "+e.message);}
  };
  const remove=async()=>{
    if(!sel)return;
    if(!confirm("Eliminar este cliente y todos sus datos asociados?"))return;
    try{
      await db.deleteClient(sel);
      const list=await db.getClients();
      setCls(list||[]);
      setSel(null);setEdit(null);
    }catch(e){alert("Error eliminando: "+e.message);}
  };
  const saveLOPD=(text)=>{
    if(!lopdClient)return;
    const entry={
      id:Date.now()+Math.random(),date:new Date().toISOString(),
      tool:"LOPD/RGPD",client:lopdClient.nombre,
      inputs:{tipo:"Documento legal"},
      preview:text.slice(0,300),fullOutput:text,
      provider:"system",model:"lopd-generator",estCost:0
    };
    ACTIVITY_LOG.push(entry);
    db.logActivity({tool:entry.tool,client:entry.client,inputs:entry.inputs,preview:entry.preview,fullOutput:entry.fullOutput,provider:entry.provider,model:entry.model,estCost:entry.estCost}).catch(()=>{});
    setLopdClient(null);
  };

  const generateShareLink=async(c)=>{
    try{
      const r=await fetch("/api/client-view",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({clientId:c.id,clientName:c.nombre})
      });
      if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||"Error generando enlace");}
      const data=await r.json();
      const url=data.url||(data.token?`${window.location.origin}/api/client-view?token=${data.token}`:"");
      if(!url) throw new Error("No se recibio el enlace");
      setShareLink(url);
      navigator.clipboard.writeText(url).catch(()=>{});
    }catch(e){alert("Error: "+e.message);}
  };

  const cliFiltrados=cls.filter(c=>{
    if(!clientSearch.trim())return true;
    const q=clientSearch.toLowerCase();
    return (c.nombre||"").toLowerCase().includes(q)||
           (c.nicho||"").toLowerCase().includes(q)||
           (c.contacto||"").toLowerCase().includes(q)||
           (c.email||"").toLowerCase().includes(q);
  });

  const allLogClients=Array.from(new Set(ACTIVITY_LOG.map(e=>e.client))).sort();
  const filteredLog=logClientFilter?ACTIVITY_LOG.filter(e=>e.client===logClientFilter):ACTIVITY_LOG;

  return <div>
    <h2 style={{fontSize:18,fontWeight:700,color:C.w,margin:"0 0 12px"}}>Clientes</h2>
    <Tab tabs={[
      {id:"list",lb:"Lista de clientes"},
      {id:"log",lb:"Log general"},
      {id:"logclient",lb:"Log por cliente"},
      {id:"library",lb:"Biblioteca"}
    ]} active={tab} onChange={setTab}/>

    {tab==="list"&&<div>
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <Btn primary color={C.teal} onClick={startNew}>+ Nuevo cliente</Btn>
        <div style={{flex:1,minWidth:200,maxWidth:400}}>
          <Inp value={clientSearch} onChange={setClientSearch} ph="Buscar por nombre, nicho, contacto..."/>
        </div>
        <span style={{fontSize:12,color:C.tx,alignSelf:"center"}}>{cliFiltrados.length} de {cls.length}</span>
      </div>

      {edit&&<Crd sx={{marginBottom:16,border:"2px solid "+C.teal}}>
        <h4 style={{fontSize:14,fontWeight:700,color:C.teal,margin:"0 0 14px"}}>{isNew?"Nuevo cliente":"Editando: "+edit.nombre}</h4>
        {fields.map(g=><div key={g.gp} style={{marginBottom:18}}>
          <p style={{fontSize:11,color:C.gold,fontWeight:600,letterSpacing:0.5,textTransform:"uppercase",marginBottom:8}}>{g.gp}</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}>
            {g.f.map(f=><div key={f.k}>
              <Lbl>{f.l}</Lbl>
              {f.sel?<Sel value={edit[f.k]||""} onChange={v=>setEdit({...edit,[f.k]:v})} opts={f.sel}/>
              :f.txa?<Txa value={edit[f.k]||""} onChange={v=>setEdit({...edit,[f.k]:v})} ph={f.ph||""} rows={3}/>
              :<Inp value={edit[f.k]||""} onChange={v=>setEdit({...edit,[f.k]:v})} ph={f.ph||""} type={f.type||"text"}/>}
            </div>)}
          </div>
        </div>)}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Btn primary color={C.green} onClick={save}>Guardar</Btn>
          <Btn onClick={()=>{setEdit(null);setIsNew(false);}}>Cancelar</Btn>
          {!isNew&&<Btn primary color={C.red} onClick={remove}>Eliminar</Btn>}
        </div>
      </Crd>}

      {shareLink&&<div style={{marginBottom:14,padding:"12px 16px",background:bg8(C.green),border:"1px solid "+C.green,borderRadius:8}}>
        <p style={{fontSize:12,color:C.green,fontWeight:600,margin:"0 0 4px"}}>Enlace copiado al portapapeles</p>
        <p style={{fontSize:11,color:C.tx,margin:0,wordBreak:"break-all"}}>{shareLink}</p>
      </div>}

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {cliFiltrados.length===0?<Crd sx={{textAlign:"center"}}><p style={{color:C.txD,margin:0,fontSize:13}}>No hay clientes que coincidan con la búsqueda.</p></Crd>
        :cliFiltrados.map(c=><Crd key={c.id} sx={{cursor:"pointer",border:sel===c.id?"2px solid "+C.teal:"1px solid "+C.bd}} onClick={()=>setSel(sel===c.id?null:c.id)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
            <div style={{flex:1,minWidth:200}}>
              <h4 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 4px"}}>{c.nombre||"(Sin nombre)"}</h4>
              <p style={{fontSize:12,color:C.tx,margin:0}}>{c.nicho||"-"} · {c.ciudadFiscal||c.ciudad_fiscal||"-"}</p>
            </div>
            <Badge text={c.plan||"Sin plan"} color={C.teal}/>
          </div>
          {sel===c.id&&<div style={{marginTop:14,paddingTop:14,borderTop:"1px solid "+C.bd}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"6px 18px",fontSize:12,marginBottom:14}}>
              <div><span style={{color:C.txD}}>Contacto:</span> <span style={{color:C.w}}>{c.contacto||"-"}</span></div>
              <div><span style={{color:C.txD}}>Email:</span> <span style={{color:C.w}}>{c.email||"-"}</span></div>
              <div><span style={{color:C.txD}}>Teléfono:</span> <span style={{color:C.w}}>{c.telefono||"-"}</span></div>
              <div><span style={{color:C.txD}}>Importe/mes:</span> <span style={{color:C.green}}>{c.importeMensual||c.importe_mensual||"-"} €</span></div>
              <div><span style={{color:C.txD}}>NIF/CIF:</span> <span style={{color:C.w}}>{c.nif||"-"}</span></div>
              <div><span style={{color:C.txD}}>Fecha alta:</span> <span style={{color:C.w}}>{c.fechaInicio||c.fecha_inicio||"-"}</span></div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}} onClick={e=>e.stopPropagation()}>
              <Btn small primary color={C.blue} onClick={()=>startEdit(c)}>Editar</Btn>
              <Btn small primary color={C.purple} onClick={()=>setBriefClient(c)}>Brief IA</Btn>
              <Btn small primary color={C.teal} onClick={()=>setLopdClient(c)}>LOPD</Btn>
              <Btn small primary color={C.gold} onClick={()=>generateShareLink(c)}>Vista cliente</Btn>
              {(()=>{const clientLog=ACTIVITY_LOG.filter(e=>e.client===c.nombre);return clientLog.length>0&&<Btn small primary color={C.cyan} onClick={()=>exportLogPDF(clientLog,c.nombre)}>Log PDF</Btn>;})()}
            </div>
          </div>}
        </Crd>)}
      </div>
    </div>}

    {tab==="log"&&<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <p style={{fontSize:13,color:C.tx,margin:0}}>{ACTIVITY_LOG.length} entradas registradas</p>
        {ACTIVITY_LOG.length>0&&<Btn small primary color={C.cyan} onClick={()=>exportLogPDF(ACTIVITY_LOG,null)}>Exportar PDF</Btn>}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {ACTIVITY_LOG.length===0?<Crd sx={{textAlign:"center"}}><p style={{color:C.txD,margin:0,fontSize:13}}>Sin actividad registrada todavía.</p></Crd>
        :ACTIVITY_LOG.slice().reverse().slice(0,100).map(e=><Crd key={e.id}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:8}}>
            <div><Badge text={e.tool} color={C.teal}/> <span style={{fontSize:12,color:C.tx,marginLeft:6}}>{e.client}</span></div>
            <span style={{fontSize:11,color:C.txD}}>{new Date(e.date).toLocaleString("es-ES")}</span>
          </div>
          {e.preview&&<p style={{fontSize:12,color:C.tx,margin:0,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{e.preview}{e.fullOutput&&e.fullOutput.length>300?"...":""}</p>}
          <div style={{display:"flex",gap:14,fontSize:10,color:C.txD,marginTop:8,flexWrap:"wrap"}}>
            <span>{e.provider||"anthropic"} {e.model?"· "+e.model:""}</span>
            {e.estCost!==undefined&&<span style={{color:C.gold}}>≈ {e.estCost.toFixed(5)} USD</span>}
          </div>
        </Crd>)}
      </div>
    </div>}

    {tab==="logclient"&&<div>
      <div style={{marginBottom:14,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <Lbl>Filtrar por cliente:</Lbl>
        <div style={{flex:1,minWidth:200,maxWidth:400}}>
          <Sel value={logClientFilter} onChange={setLogClientFilter} opts={allLogClients} ph="Todos los clientes"/>
        </div>
        {filteredLog.length>0&&<Btn small primary color={C.cyan} onClick={()=>exportLogPDF(filteredLog,logClientFilter||null)}>Exportar PDF</Btn>}
      </div>
      <p style={{fontSize:12,color:C.tx,marginBottom:14}}>{filteredLog.length} entradas {logClientFilter?"de "+logClientFilter:"en total"}</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filteredLog.length===0?<Crd sx={{textAlign:"center"}}><p style={{color:C.txD,margin:0,fontSize:13}}>Sin actividad para este cliente.</p></Crd>
        :filteredLog.slice().reverse().slice(0,100).map(e=><Crd key={e.id}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap",gap:6}}>
            <Badge text={e.tool} color={C.purple}/>
            <span style={{fontSize:11,color:C.txD}}>{new Date(e.date).toLocaleString("es-ES")}</span>
          </div>
          {e.preview&&<p style={{fontSize:12,color:C.tx,margin:0,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{e.preview}{e.fullOutput&&e.fullOutput.length>300?"...":""}</p>}
        </Crd>)}
      </div>
    </div>}

    {tab==="library"&&<div>
      <p style={{fontSize:13,color:C.tx,marginBottom:14}}>Biblioteca de contenido generado (todas las salidas guardadas)</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {ACTIVITY_LOG.length===0?<Crd sx={{textAlign:"center"}}><p style={{color:C.txD,margin:0,fontSize:13}}>Biblioteca vacía.</p></Crd>
        :ACTIVITY_LOG.slice().reverse().slice(0,50).map(e=><Crd key={e.id}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,flexWrap:"wrap",gap:6}}>
            <div><Badge text={e.tool} color={C.gold}/> <span style={{fontSize:12,color:C.tx,marginLeft:6}}>{e.client}</span></div>
            <div style={{display:"flex",gap:6}}>
              <Btn small onClick={()=>navigator.clipboard.writeText(e.fullOutput||e.preview)}>Copiar</Btn>
              <Btn small onClick={()=>{const w=window.open("","_blank");w.document.write("<pre style='font-family:sans-serif;padding:40px;line-height:1.7;max-width:800px;margin:auto;white-space:pre-wrap'>"+(e.fullOutput||e.preview).replace(/</g,"&lt;")+"</pre>");}}>Ver</Btn>
            </div>
          </div>
          <p style={{fontSize:12,color:C.tx,margin:0,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{(e.fullOutput||e.preview||"").slice(0,250)}...</p>
        </Crd>)}
      </div>
    </div>}

    {lopdClient&&<LOPDDocument client={lopdClient} onClose={()=>setLopdClient(null)} onSave={saveLOPD}/>}
    {briefClient&&<BriefEditor client={briefClient} onClose={()=>setBriefClient(null)} onSave={(data)=>{BRIEFS_CACHE[briefClient.nombre]=data;}}/>}
  </div>;
}

/* ══════ CONTENT MULTIPLIER ══════ */
function ContentMultiplier(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[nm,sNm]=useState("");
  const[orig,sOrig]=useState("");const[type,sType]=useState("Artículo blog");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);
  return <Tool title="Multiplicador de Contenido" subtitle="Reutiliza una pieza en 8+ formatos diferentes" out={o} ld={l} label="Variaciones" btnTxt="Multiplicar" btnCl={C.cyan} ok={!!orig} onGen={()=>
    ai("Especialista en repurposing de contenido digital en 2026.",
    `MULTIPLICAR CONTENIDO. Origen: ${type}. Sector: ${nR}. Centro: ${nm||"[Centro]"}.
CONTENIDO ORIGINAL:
"""
${orig}
"""
Genera 8 versiones: 1) Post Instagram (carousel), 2) Reel/TikTok (guion 30s), 3) Tweet thread (8 tweets), 4) Email newsletter, 5) Post LinkedIn, 6) Story Instagram (5 frames), 7) FAQ snippet, 8) Mini-articulo SEO.
Cada version COMPLETA y lista para publicar.`,sO,sL,nR,"Espana",
    {tool:"Multiplicador Contenido",client:nm||"Sin asignar",inputs:{tipo:type}})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre})=>{sNm(nombre);}}/>
      <Fld label="Centro"><Inp value={nm} onChange={sNm} ph="Nombre del cliente"/></Fld>
      <Fld label="Tipo de contenido origen"><Sel value={type} onChange={sType} opts={["Artículo blog","Vídeo largo","Podcast","Email","Post extenso","Whitepaper"]}/></Fld>
      <Fld label="Contenido a multiplicar"><Txa value={orig} onChange={sOrig} ph="Pega el contenido original aquí..." rows={8}/></Fld>
    </>}/>;
}

/* ══════ PROPOSAL GENERATOR ══════ */
function ProposalGenerator(){
  const[nm,sNm]=useState("");const[ni,sNi]=useState("");const[cni,sCni]=useState("");
  const[ci,sCi]=useState("");const[contact,sContact]=useState("");
  const[plan,setPlan]=useState("Profesional");const[meses,sMeses]=useState("6");
  const[problemas,sProblemas]=useState("");const[objetivos,sObjetivos]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);
  const selectedPlan=PLANS.find(p=>p.lb===plan)||PLANS[1];
  return <Tool title="Propuestas Comerciales" subtitle="Documentos profesionales listos para enviar al cliente" out={o} ld={l} label="Propuesta" btnTxt="Generar Propuesta" btnCl={C.gold} ok={nm&&ni} onGen={()=>
    ai("Consultor comercial senior especializado en venta de servicios de marketing digital.",
    `PROPUESTA COMERCIAL para: ${nm}. Sector: ${nR}. Ciudad: ${ci||"[Ciudad]"}. Contacto: ${contact||"[Contacto]"}.
PLAN: ${plan} (${selectedPlan.price} EUR/mes). DURACION: ${meses} meses.
PROBLEMAS DETECTADOS: ${problemas||"[Diagnostico previo]"}.
OBJETIVOS DEL CLIENTE: ${objetivos||"[Objetivos]"}.

Genera propuesta completa:
1. PORTADA con nombre cliente, fecha, validez 15 dias
2. RESUMEN EJECUTIVO en 1 parrafo
3. DIAGNOSTICO ACTUAL (basado en problemas)
4. OBJETIVOS Y KPIs medibles (3-5)
5. PLAN PROPUESTO con desglose detallado de servicios
6. CALENDARIO mes a mes
7. INVERSION clara: ${selectedPlan.price} EUR/mes x ${meses} meses + posibles extras
8. ROI esperado (conservador, no exagerar)
9. CASOS DE EXITO similares [SUSTITUIR CON REALES]
10. PROCESO DE ALTA y siguientes pasos
11. CLAUSULAS BASICAS (no contrato completo)
12. CTA: "Reservar llamada para confirmar"

Tono profesional, directo, sin marketing inflado.`,sO,sL,nR,"Espana",
    {tool:"Propuestas Comerciales",client:nm,inputs:{plan:plan,meses:meses}})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
      <Fld label="Cliente"><Inp value={nm} onChange={sNm} ph="Nombre del centro"/></Fld>
      <Fld label="Ciudad"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
      <Fld label="Contacto"><Inp value={contact} onChange={sContact} ph="Nombre y cargo"/></Fld>
      <Fld label="Plan propuesto"><Sel value={plan} onChange={setPlan} opts={PLANS.map(p=>p.lb)}/></Fld>
      <Fld label="Duración (meses)"><Sel value={meses} onChange={sMeses} opts={["3","6","9","12","24"]}/></Fld>
      <Fld label="Problemas detectados"><Txa value={problemas} onChange={sProblemas} ph="Web obsoleta, Google Business sin optimizar..." rows={3}/></Fld>
      <Fld label="Objetivos del cliente"><Txa value={objetivos} onChange={sObjetivos} ph="Captar 30 leads/mes, abrir nueva sede..." rows={2}/></Fld>
    </>}/>;
}

/* ══════ MULTI CAMPAIGN ══════ */
function MultiCampaign(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[nm,sNm]=useState("");
  const[srv,sSrv]=useState("");const[obj,sObj]=useState("Captar leads");
  const[ci,sCi]=useState("");const[budget,sBudget]=useState("500");const[duracion,sDuracion]=useState("4 semanas");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);
  return <Tool title="Campañas Multicanal" subtitle="Estrategia completa coordinada en todos los canales" out={o} ld={l} label="Plan campaña" btnTxt="Generar Campaña" btnCl={C.rose} ok={nm&&srv&&ni} onGen={()=>
    ai("Estratega de campañas multicanal integradas.",
    `CAMPANA MULTICANAL para: ${nm} (${nR}). Servicio destacado: ${srv}. Objetivo: ${obj}. Ciudad: ${ci||"[Ciudad]"}. Presupuesto total: ${budget} EUR. Duracion: ${duracion}.

Genera plan coordinado:
1. CONCEPTO CREATIVO unificado (titular madre, claim, imagen guia)
2. META ADS: presupuesto, audiencia, 3 creatividades con copy completo
3. GOOGLE ADS: keywords, anuncios responsivos, extensiones
4. REDES ORGANICAS: 8 posts Instagram + 4 reels + 5 stories con guion completo
5. EMAIL: 3 secuencias (nuevos, fidelizacion, recuperacion)
6. WHATSAPP: 5 protocolos de mensajes
7. LANDING PAGE: estructura + copy de hero, beneficios, prueba social, CTA
8. CALENDARIO de publicaciones dia a dia
9. KPIs medibles por canal
10. BUDGET BREAKDOWN: cuanto a cada canal y por que
11. PLAN DE OPTIMIZACION segun datos en semana 2`,sO,sL,nR,ci||"Espana",
    {tool:"Campañas Multicanal",client:nm,inputs:{servicio:srv,objetivo:obj,presupuesto:budget}})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
      <Fld label="Centro"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
      <Fld label="Servicio destacado"><Inp value={srv} onChange={sSrv} ph="Implantes, FIV, reforma cocina..."/></Fld>
      <Fld label="Objetivo"><Sel value={obj} onChange={sObj} opts={["Captar leads","Promocion lanzamiento","Aumentar reservas","Posicionar nuevo servicio","Re-activar antiguos"]}/></Fld>
      <Fld label="Ciudad"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
      <Fld label="Presupuesto total (EUR)"><Inp value={budget} onChange={sBudget} ph="500"/></Fld>
      <Fld label="Duración"><Sel value={duracion} onChange={sDuracion} opts={["2 semanas","4 semanas","8 semanas","12 semanas"]}/></Fld>
    </>}/>;
}

/* ══════ META ADS PRO ══════ */
function MetaAdsPro(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[nm,sNm]=useState("");
  const[srv,sSrv]=useState("");const[budget,sBudget]=useState("300");const[obj,sObj]=useState("Leads");
  const[ci,sCi]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);
  return <Tool title="Meta Ads Pro" subtitle="Campañas profesionales Facebook + Instagram" out={o} ld={l} label="Campaña Meta" btnTxt="Generar Estructura" btnCl={C.blue} ok={nm&&srv&&ni} onGen={()=>
    ai("Especialista certificado Meta Ads para negocios locales en 2026.",
    `CAMPANA META ADS para: ${nm} (${nR}). Servicio: ${srv}. Ciudad: ${ci||"Espana"}. Presupuesto: ${budget} EUR/mes. Objetivo: ${obj}.

Genera estructura completa:
1. CAMPANA 1 - Audiencia Fria (Conversiones)
   - Audiencia: intereses + comportamientos + lookalike
   - 3 conjuntos de anuncios (A/B/C)
   - 5 creatividades por conjunto: copy primario, headlines, descripciones
2. CAMPANA 2 - Audiencia Templada (Trafico web)
   - Custom audience: visitantes web 30 dias
   - 3 creatividades
3. CAMPANA 3 - Audiencia Caliente (Retargeting)
   - Custom audience: visitas pagina servicio + engagement IG/FB
   - Mensaje cierre, oferta limitada
4. BUDGET breakdown por campana y conjunto
5. ESTRUCTURA DE PUJA recomendada
6. PIXEL events que deben estar configurados
7. CHECKLIST pre-lanzamiento (8 puntos verificables)
8. PLAN DE OPTIMIZACION: que mirar dia 3, dia 7, dia 14
9. CUMPLIMIENTO normativa publicitaria del sector
10. KPIs y umbrales de decision (cuando pausar, cuando escalar)`,sO,sL,nR,ci||"Espana",
    {tool:"Meta Ads Pro",client:nm,inputs:{servicio:srv,presupuesto:budget}})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
      <Fld label="Centro"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
      <Fld label="Servicio"><Inp value={srv} onChange={sSrv} ph="Servicio a promocionar"/></Fld>
      <Fld label="Ciudad"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
      <Fld label="Presupuesto mensual (EUR)"><Inp value={budget} onChange={sBudget} ph="300"/></Fld>
      <Fld label="Objetivo principal"><Sel value={obj} onChange={sObj} opts={["Leads","Conversiones","Mensajes WhatsApp","Trafico web","Reconocimiento","Reservas"]}/></Fld>
    </>}/>;
}

/* ══════ PREDICTIVE DASHBOARD ══════ */
function PredictiveDashboard(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[nm,sNm]=useState("");
  const[mesActual,sMesActual]=useState("");const[mesAnterior,sMesAnterior]=useState("");
  const[invMensual,sInvMensual]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);
  return <Tool title="Dashboard Predictivo" subtitle="Proyecciones a 3 y 6 meses basadas en datos actuales" out={o} ld={l} label="Dashboard" btnTxt="Generar Proyecciones" btnCl={C.green} ok={nm&&ni&&mesActual} onGen={()=>
    ai("Analista de datos de marketing digital con conocimiento de modelos predictivos.",
    `DASHBOARD PREDICTIVO para: ${nm} (${nR}).
DATOS MES ACTUAL: ${mesActual}.
DATOS MES ANTERIOR: ${mesAnterior||"No proporcionado"}.
INVERSION MENSUAL EN MARKETING: ${invMensual||"No proporcionada"} EUR.

Genera:
1. ESTADO ACTUAL (lectura objetiva de los datos)
2. TENDENCIA detectada (mejora/empeora/estancado y por que)
3. PROYECCION A 3 MESES (escenario optimista, base, pesimista)
4. PROYECCION A 6 MESES
5. PALANCAS DE CRECIMIENTO (3-5 acciones concretas que multiplican)
6. RIESGOS detectados y como mitigarlos
7. ROI estimado de la inversion actual
8. RECOMENDACIONES de reasignacion de presupuesto si aplica
9. KPIs A MONITOREAR mensualmente
10. SIGUIENTE REVISION recomendada y que mirar`,sO,sL,nR,"Espana",
    {tool:"Dashboard Predictivo",client:nm})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre})=>{sNm(nombre);}}/>
      <Fld label="Centro"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
      <Fld label="Datos mes actual"><Txa value={mesActual} onChange={sMesActual} ph="Visitas: 2340, Leads: 87, Reservas: 34, Coste/lead: 12€, CTR ads: 2.1%..." rows={4}/></Fld>
      <Fld label="Datos mes anterior"><Txa value={mesAnterior} onChange={sMesAnterior} ph="Para detectar tendencia (opcional pero recomendado)" rows={3}/></Fld>
      <Fld label="Inversión mensual marketing (EUR)"><Inp value={invMensual} onChange={sInvMensual} ph="500"/></Fld>
    </>}/>;
}

/* ══════ TASKS ══════ */
function Tasks(){
  const[tasks,setTasks]=useState([]);
  const[nuevaTarea,sNuevaTarea]=useState("");
  const[clienteTarea,sClienteTarea]=useState("");
  const[prioridad,sPrioridad]=useState("media");
  const[filtro,sFiltro]=useState("activas");
  const[clients,setClients]=useState([]);

  useEffect(()=>{loadTasks();db.getClients().then(d=>setClients(d||[]));},[]);

  async function loadTasks(){
    try{
      const r=await fetch("/api/tasks");
      if(!r.ok) return;
      const d=await r.json();
      setTasks(d||[]);
    }catch(e){}
  }

  const addTask=async()=>{
    if(!nuevaTarea.trim()) return;
    try{
      await fetch("/api/tasks",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          title:nuevaTarea.trim(),
          client_name:clienteTarea||null,
          priority:prioridad,
          status:"pendiente",
        })
      });
      sNuevaTarea("");sClienteTarea("");
      loadTasks();
    }catch(e){alert("Error añadiendo tarea");}
  };
  const toggleTask=async(t)=>{
    try{
      await fetch("/api/tasks",{
        method:"PUT",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({id:t.id,status:t.status==="completada"?"pendiente":"completada"})
      });
      loadTasks();
    }catch(e){}
  };
  const deleteTask=async(id)=>{
    if(!confirm("Eliminar esta tarea?")) return;
    try{
      await fetch("/api/tasks?id="+id,{method:"DELETE"});
      loadTasks();
    }catch(e){}
  };

  const filtered=tasks.filter(t=>{
    if(filtro==="activas") return t.status!=="completada";
    if(filtro==="completadas") return t.status==="completada";
    return true;
  });

  const pColors={alta:C.red,media:C.gold,baja:C.green};

  return <div>
    <h2 style={{fontSize:18,fontWeight:700,color:C.w,margin:"0 0 16px"}}>Tareas / Pendientes</h2>

    <Crd sx={{marginBottom:16}}>
      <h4 style={{fontSize:13,fontWeight:700,color:C.teal,margin:"0 0 12px"}}>Nueva tarea</h4>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:10,alignItems:"end",flexWrap:"wrap"}}>
        <Fld label="Tarea"><Inp value={nuevaTarea} onChange={sNuevaTarea} ph="Qué hay que hacer..."/></Fld>
        <Fld label="Cliente"><Sel value={clienteTarea} onChange={sClienteTarea} opts={clients.map(c=>c.nombre)} ph="Sin cliente"/></Fld>
        <Fld label="Prioridad"><Sel value={prioridad} onChange={sPrioridad} opts={["alta","media","baja"]}/></Fld>
        <div><Btn primary color={C.green} onClick={addTask}>+ Añadir</Btn></div>
      </div>
    </Crd>

    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
      {[{id:"activas",lb:"Activas ("+tasks.filter(t=>t.status!=="completada").length+")"},{id:"completadas",lb:"Completadas"},{id:"todas",lb:"Todas"}].map(f=>
        <Btn key={f.id} small primary={filtro===f.id} color={filtro===f.id?C.teal:C.tx} onClick={()=>sFiltro(f.id)}>{f.lb}</Btn>
      )}
    </div>

    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {filtered.length===0?<Crd sx={{textAlign:"center"}}><p style={{color:C.txD,margin:0,fontSize:13}}>Sin tareas en esta vista.</p></Crd>
      :filtered.map(t=><Crd key={t.id} sx={{display:"flex",alignItems:"center",gap:12,opacity:t.status==="completada"?0.55:1}}>
        <div onClick={()=>toggleTask(t)} style={{width:24,height:24,borderRadius:6,border:"2px solid "+(t.status==="completada"?C.green:C.txD),background:t.status==="completada"?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",color:C.bg,fontSize:14,fontWeight:700}}>{t.status==="completada"?"✓":""}</div>
        <div style={{flex:1,minWidth:0}}>
          <p style={{fontSize:13,color:C.w,margin:0,fontWeight:600,textDecoration:t.status==="completada"?"line-through":"none"}}>{t.title}</p>
          <div style={{display:"flex",gap:10,marginTop:4,flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:pColors[t.priority]||C.tx,fontWeight:600,padding:"1px 8px",borderRadius:4,background:bg8(pColors[t.priority]||C.tx)}}>{t.priority}</span>
            {t.client_name&&<span style={{fontSize:11,color:C.tx}}>{t.client_name}</span>}
            <span style={{fontSize:10,color:C.txD}}>{new Date(t.created_at).toLocaleDateString("es-ES")}</span>
          </div>
        </div>
        <Btn small onClick={()=>deleteTask(t.id)}>×</Btn>
      </Crd>)}
    </div>
  </div>;
}

/* ══════ HOME / PANEL ══════ */
function Home({setAct}){
  const totalActivity=ACTIVITY_LOG.length;
  const last24h=ACTIVITY_LOG.filter(e=>new Date(e.date)>new Date(Date.now()-24*60*60*1000)).length;
  const totalCost=ACTIVITY_LOG.reduce((s,e)=>s+(e.estCost||0),0);
  const last30days=ACTIVITY_LOG.filter(e=>new Date(e.date)>new Date(Date.now()-30*24*60*60*1000));
  const cost30=last30days.reduce((s,e)=>s+(e.estCost||0),0);
  const toolStats={};ACTIVITY_LOG.forEach(e=>{toolStats[e.tool]=(toolStats[e.tool]||0)+1;});
  const topTools=Object.entries(toolStats).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const groups={};MENU.forEach((m,i)=>{
    if(m.g){const gname=m.g;groups[gname]=[];let j=i+1;while(j<MENU.length&&!MENU[j].g){groups[gname].push(MENU[j]);j++;}}
  });

  return <div>
    <h2 style={{fontSize:20,fontWeight:700,color:C.w,margin:"0 0 4px"}}>Panel de Control</h2>
    <p style={{fontSize:13,color:C.tx,margin:"0 0 24px"}}>Cliniq Digital · Plataforma de marketing para negocios locales</p>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:24}}>
      <Crd sx={{textAlign:"center"}}>
        <p style={{fontSize:11,color:C.tx,margin:"0 0 4px",letterSpacing:0.5,textTransform:"uppercase"}}>Total consultas</p>
        <p style={{fontSize:24,fontWeight:700,color:C.teal,margin:0}}>{totalActivity}</p>
      </Crd>
      <Crd sx={{textAlign:"center"}}>
        <p style={{fontSize:11,color:C.tx,margin:"0 0 4px",letterSpacing:0.5,textTransform:"uppercase"}}>Últimas 24h</p>
        <p style={{fontSize:24,fontWeight:700,color:C.green,margin:0}}>{last24h}</p>
      </Crd>
      <Crd sx={{textAlign:"center"}}>
        <p style={{fontSize:11,color:C.tx,margin:"0 0 4px",letterSpacing:0.5,textTransform:"uppercase"}}>Coste estimado total</p>
        <p style={{fontSize:24,fontWeight:700,color:C.gold,margin:0}}>{totalCost.toFixed(3)} <span style={{fontSize:13}}>USD</span></p>
      </Crd>
      <Crd sx={{textAlign:"center"}}>
        <p style={{fontSize:11,color:C.tx,margin:"0 0 4px",letterSpacing:0.5,textTransform:"uppercase"}}>Coste últimos 30d</p>
        <p style={{fontSize:24,fontWeight:700,color:C.blue,margin:0}}>{cost30.toFixed(3)} <span style={{fontSize:13}}>USD</span></p>
      </Crd>
    </div>

    {topTools.length>0&&<Crd sx={{marginBottom:24}}>
      <h4 style={{fontSize:13,fontWeight:700,color:C.w,margin:"0 0 12px"}}>Herramientas más utilizadas</h4>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {topTools.map(([t,n])=><div key={t} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:13,color:C.tx}}>{t}</span>
          <span style={{fontSize:13,fontWeight:700,color:C.teal}}>{n}</span>
        </div>)}
      </div>
    </Crd>}

    <h3 style={{fontSize:15,fontWeight:700,color:C.w,margin:"0 0 14px"}}>Acceso rápido a herramientas</h3>
    {Object.entries(groups).map(([gname,items])=><div key={gname} style={{marginBottom:20}}>
      <p style={{fontSize:11,color:C.gold,fontWeight:600,letterSpacing:0.5,textTransform:"uppercase",marginBottom:10}}>{gname}</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
        {items.map(it=><Crd key={it.id} sx={{cursor:"pointer",padding:14}} onClick={()=>setAct(it.id)}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:8,background:bg8(it.cl),display:"flex",alignItems:"center",justifyContent:"center",color:it.cl,fontSize:16,fontWeight:700}}>{it.ic}</div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:12,fontWeight:600,color:C.w,margin:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{it.lb}</p>
            </div>
          </div>
        </Crd>)}
      </div>
    </div>)}
  </div>;
}

/* ══════ APP ROOT ══════ */
export default function App(){
  const[act,setAct]=useState("home");
  const[col,setCol]=useState(false);

  useEffect(()=>{
    loadActivityFromDb();
    loadBriefsFromDb();
  },[]);

  useEffect(()=>{
    const css=`
      *{box-sizing:border-box}
      body{margin:0;background:${C.bg};color:${C.w};font-family:${font}}
      ::-webkit-scrollbar{width:8px;height:8px}
      ::-webkit-scrollbar-track{background:${C.sf2}}
      ::-webkit-scrollbar-thumb{background:${C.bd};border-radius:4px}
      ::-webkit-scrollbar-thumb:hover{background:${C.txD}}
      .spinner{width:16px;height:16px;border:2px solid ${C.bd};border-top-color:${C.teal};border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
      input,textarea,select{font-family:${font}!important}
      input:focus,textarea:focus,select:focus{border-color:${C.teal}!important}
      button:hover{filter:brightness(1.1)}
    `;
    const st=document.createElement("style");st.innerHTML=css;document.head.appendChild(st);
    return()=>st.remove();
  },[]);

  const tools={
    home:<ProjectStudio setAct={setAct}/>,
    diag360:<DiagnosticoHub/>,
    landing:<Landing/>,
    whatsapp:<WhatsApp/>,
    seo:<Seo/>,
    audit:<Audit/>,
    followup:<Followup/>,
    webstruct:<WebStruct/>,
    social:<Social/>,
    gbp:<Gbp/>,
    video:<Video/>,
    imageprompt:<ImagePrompt/>,
    competitor:<Competitor/>,
    compliance:<Compliance/>,
    reviews:<Reviews/>,
    scan:<ScanPresencia/>,
    deepanalysis:<DeepAnalysis/>,
    expansion:<Expansion/>,
    citations:<CitationsAudit/>,
    reputation:<Reputation/>,
    voiceseo:<VoiceSeo/>,
    brandmonitor:<BrandMonitor/>,
    implement:<ImplementHub/>,
    multiplier:<ContentMultiplier/>,
    proposal:<ProposalGenerator/>,
    campaign:<MultiCampaign/>,
    metaads:<MetaAdsPro/>,
    dashboard:<PredictiveDashboard/>,
    report:<Report/>,
    manual:<Manual/>,
    clients:<Clients/>,
    tasks:<Tasks/>,
  };

  return <div style={{display:"flex",minHeight:"100vh",background:C.bg,color:C.w}}>
    <aside style={{
      width:col?60:230,background:C.sf,borderRight:"1px solid "+C.bd,
      transition:"width 0.2s",overflowY:"auto",overflowX:"hidden",
      flexShrink:0,position:"sticky",top:0,height:"100vh"
    }}>
      <div style={{padding:"18px 14px",borderBottom:"1px solid "+C.bd,display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,"+C.teal+","+C.tealD+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:C.bg,flexShrink:0}}>C</div>
        {!col&&<div style={{flex:1,minWidth:0}}>
          <p style={{fontSize:13,fontWeight:700,color:C.w,margin:0,letterSpacing:0.3}}>CLINIQ <span style={{color:C.teal}}>DIGITAL</span></p>
          <p style={{fontSize:10,color:C.txD,margin:0}}>v2.0 · Plataforma IA</p>
        </div>}
        <button onClick={()=>setCol(!col)} style={{background:"none",border:"none",color:C.tx,cursor:"pointer",fontSize:14,padding:4}}>{col?"›":"‹"}</button>
      </div>

      <nav style={{padding:"10px 6px"}}>
        {MENU.map((m,i)=>m.g?
          (!col&&<p key={"g-"+i} style={{fontSize:10,color:C.gold,fontWeight:600,letterSpacing:0.5,textTransform:"uppercase",padding:"14px 10px 6px",margin:0}}>{m.g}</p>)
          :<button key={m.id} onClick={()=>m.href?window.open(m.href,"_blank","noopener,noreferrer"):setAct(m.id)} style={{
            display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 10px",margin:"2px 0",
            background:act===m.id?bg8(m.cl):"transparent",
            border:"none",borderRadius:7,color:act===m.id?m.cl:C.tx,
            fontSize:12,fontFamily:font,cursor:"pointer",textAlign:"left",
            fontWeight:act===m.id?600:500,transition:"all 0.15s"
          }} title={col?m.lb:""}>
            <span style={{fontSize:15,flexShrink:0,width:18,textAlign:"center"}}>{m.ic}</span>
            {!col&&<span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.lb}</span>}
          </button>
        )}
      </nav>
    </aside>

    <main style={{flex:1,padding:"24px 30px",overflowX:"hidden",minWidth:0}}>
      {tools[act]||<ProjectStudio setAct={setAct}/>}
    </main>
  </div>;
}
