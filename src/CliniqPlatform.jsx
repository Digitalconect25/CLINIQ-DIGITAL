import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./db.js";

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
function logActivity(toolName, clientName, inputs, outputPreview){
  const entry = {
    id:Date.now()+Math.random(),
    date:new Date().toISOString(),
    tool:toolName,
    client:clientName||"Sin asignar",
    inputs:inputs||{},
    preview:(outputPreview||"").slice(0,300),
    fullOutput:outputPreview||""
  };
  ACTIVITY_LOG.push(entry);
  // Persist to Neon DB (fire and forget)
  db.logActivity({tool:entry.tool,client:entry.client,inputs:entry.inputs,preview:entry.preview,fullOutput:entry.fullOutput}).catch(()=>{});
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
        preview:r.preview||"",fullOutput:r.full_output||r.fullOutput||""
      }));
      _activityLoaded=true;
    }
  }catch(e){console.warn("Could not load activity from DB");}
}
function getLogForClient(clientName){
  if(!clientName) return ACTIVITY_LOG;
  return ACTIVITY_LOG.filter(e=>e.client===clientName);
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
  { id:"otro", lb:"Otro nicho (especificar)", txs:[] },
];

const MENU = [
  {g:"PANEL"},{id:"home",ic:"◫",lb:"Panel de Control",cl:C.teal},
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
  {g:"ESTRATEGIA"},
  {id:"report",ic:"◰",lb:"Reporting Mensual",cl:C.teal},
  {id:"manual",ic:"◳",lb:"Manual Comunicación",cl:C.gold},
  {g:"GESTIÓN"},
  {id:"clients",ic:"◈",lb:"Clientes / Facturación",cl:C.teal},
];
const ITEMS=MENU.filter(m=>m.id);

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
const isHealthNiche=(lb)=>{const n=NICHES.find(x=>x.lb===lb);return n?["estetica","dental","multi","fertilidad","fisio","oftalmo","derma","psico","nutri"].includes(n.id):false;};
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
  }}>{ph&&<option value="">{ph}</option>}{opts.map(o=><option key={typeof o==="string"?o:o.value} value={typeof o==="string"?o:o.value}>{typeof o==="string"?o:o.label}</option>)}</select>;
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
function Crd({children,sx}){return <div style={{background:C.sf,border:"1px solid "+C.bd,borderRadius:12,padding:24,...sx}}>{children}</div>;}
function Fld({label,children}){return <div><Lbl>{label}</Lbl>{children}</div>;}
function Badge({text,color}){return <span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:6,background:bg8(color||C.teal),color:color||C.teal}}>{text}</span>;}

/* ── NICHE SELECTOR ── */
function NicheSelector({niche,setNiche,customNiche,setCustomNiche}){
  return <>
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
      <span style={{fontSize:11,fontWeight:600,color:C.tx,letterSpacing:0.5,textTransform:"uppercase"}}>{label||"Resultado"}</span>
      {content&&<div style={{display:"flex",gap:6}}>
        <Btn small onClick={()=>navigator.clipboard.writeText(content)}>Copiar</Btn>
        <Btn small onClick={()=>{const w=window.open("","_blank");w.document.write("<pre style='font-family:sans-serif;padding:40px;line-height:1.8;max-width:800px;margin:auto'>"+content.replace(/</g,"&lt;")+"</pre>");w.document.title="Cliniq Digital - Exportar";}}>Imprimir</Btn>
      </div>}
    </div>
    <div ref={ref} style={{padding:20,flex:1,overflowY:"auto",maxHeight:600}}>
      {loading?<div style={{display:"flex",alignItems:"center",gap:12,color:C.teal}}>
        <div className="spinner"/><span style={{fontSize:14}}>Generando con IA...</span>
      </div>:content?<div style={{fontSize:14,color:C.w,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{content}</div>
      :<p style={{fontSize:14,color:C.txD,fontStyle:"italic"}}>Configura los parámetros y pulsa generar.</p>}
    </div>
  </div>;
}

/* ── AI ENGINE ── */
function buildSys(nicheResolved, geo){
  return `Eres un estratega de marketing digital de elite especializado en negocios locales y clinicas sanitarias en Espana. Generas contenido que posiciona en buscadores y convierte visitantes en pacientes o clientes.

NICHO ACTUAL: ${nicheResolved}
GEO-LOCALIZACION: ${geo}

ADAPTACION AL NICHO:
- Detecta el sector y adapta terminologia, perfil de cliente, ciclo de decision, objeciones habituales y tono.
- Sector sanitario: aplica regulacion publicitaria sanitaria espanola (RD 1907/1996, Ley 34/1988 General de Publicidad, normativa AEMPS, normativa autonomica). Sin claims de resultado, sin trivializar procedimientos.
- Sector no sanitario: aplica el marco etico y regulatorio correspondiente.
- Terminologia exacta del profesional del sector, no generica.

SEO OBLIGATORIO:
- Keyword principal natural en titulo, primer parrafo, al menos 2 subtitulos, ultimo parrafo.
- Densidad keyword 1-2%. Sin keyword stuffing.
- Variaciones semanticas y long-tail (LSI keywords).
- Estructura H1 > H2 > H3 jerarquica.
- Parrafos de 3-4 lineas maximas para movil.
- Preguntas reales de usuarios (People Also Ask).
- Optimiza para featured snippets cuando corresponda.
- Sugiere enlaces internos a paginas de servicio y articulos.
- Cada contenido con UNA intencion de busqueda clara.

GEO-SEO OBLIGATORIO:
- Localización natural: "en ${geo}", menciones a barrio/zona, referencias locales.
- Keywords geo: "[servicio] + [ciudad]", "[tratamiento] + [barrio]", "[especialidad] + cerca de mi".
- Puntos de referencia locales, zonas conocidas, transporte cercano.
- Prioriza micro-SEO local del barrio sobre SEO generico de ciudad.
- Comunidad autonoma para SEO regional.

FORMATO: Texto limpio sin markdown, sin asteriscos, sin almohadillas. Saltos de linea para organizar. Comillas rectas. Espanol de Espana.
Tono: profesional, directo, genera confianza. Sin marketing agresivo.

FIABILIDAD:
- NUNCA inventes datos, estadisticas, estudios o cifras. Si mencionas un dato, que sea realista y verificable.
- Informacion insuficiente: usa marcadores [COMPLETAR CON DATO REAL].
- NUNCA inventes nombres de profesionales, clinicas o direcciones.
- Cada recomendacion ACCIONABLE: que hacer, como, con que herramienta, en que plazo.
- Precision sobre extension. Menos texto correcto antes que mucho generico.
- Datos incompletos: genera con lo disponible y senala que falta.
- SIEMPRE espanol de Espana, comillas rectas, sin emojis.`;
}

async function ai(sysExtra,prompt,setO,setL,niche,geo,logInfo){
  setL(true);setO("");
  const sys=buildSys(niche||"Servicio profesional",geo||"Espana")+"\n\n"+sysExtra;
  try{
    const r=await fetch("/api/generate",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:4096,system:sys,messages:[{role:"user",content:prompt}]})
    });
    const d=await r.json();
    const out=(d.content||[]).map(b=>b.text||"").join("\n")||"Error en la respuesta.";
    setO(out);
    if(out&&!out.startsWith("Error")){
      const toolName=logInfo?.tool||inferToolName(sysExtra,prompt);
      logActivity(toolName,logInfo?.client||"Sin asignar",logInfo?.inputs||extractInputs(prompt),out);
    }
  }catch(e){setO("Error de conexion. Verifica la configuracion de la API.");}
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

/* ── AI WITH WEB SEARCH ── */
async function aiSearch(sysExtra,prompt,setO,setL,niche,geo,setPhase,logInfo){
  setL(true);setO("");
  if(setPhase) setPhase("search");
  const sys=buildSys(niche||"Servicio profesional",geo||"Espana")+"\n\n"+sysExtra;
  try{
    const r=await fetch("/api/generate",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"claude-sonnet-4-20250514",max_tokens:8192,system:sys,
        messages:[{role:"user",content:prompt}],
        tools:[{type:"web_search_20250305",name:"web_search"}]
      })
    });
    if(setPhase) setPhase("analyze");
    const d=await r.json();
    const texts=(d.content||[]).filter(b=>b.type==="text").map(b=>b.text||"");
    const searchResults=(d.content||[]).filter(b=>b.type==="web_search_tool_result");
    let output=texts.join("\n");
    if(searchResults.length>0){
      output+="\n\n---\nFUENTES CONSULTADAS EN INTERNET:\n";
      searchResults.forEach((sr,i)=>{
        if(sr.content){
          const webPages=sr.content.filter(c=>c.type==="web_search_result");
          webPages.forEach(wp=>{
            if(wp.url&&wp.title) output+=`- ${wp.title}: ${wp.url}\n`;
          });
        }
      });
    }
    setO(output||"No se encontraron resultados. Verifica los datos e intenta de nuevo.");
    if(output){
      const toolName=logInfo?.tool||inferToolName(sysExtra,prompt);
      logActivity(toolName+" (Web)",logInfo?.client||"Sin asignar",logInfo?.inputs||extractInputs(prompt),output);
    }
  }catch(e){setO("Error de conexion. Verifica la configuracion de la API.\n\nDetalle: "+e.message);}
  if(setPhase) setPhase("done");
  setL(false);
}

/* ── PROGRESS RING (SVG) ── */
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

/* ── RADAR SCORE (SVG) ── */
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

/* ── ENHANCED OUT COMPONENT ── */
function OutSearch({content,loading,label,phase}){
  const ref=useRef(null);
  useEffect(()=>{if(ref.current)ref.current.scrollTop=ref.current.scrollHeight;},[content]);
  const phaseLabels={search:"Buscando en Internet...",analyze:"Analizando resultados...",done:"Completado"};
  return <div style={{background:C.bg,border:"1px solid "+C.bd,borderRadius:12,overflow:"hidden",flex:1,display:"flex",flexDirection:"column",minHeight:340}}>
    <div style={{padding:"12px 16px",borderBottom:"1px solid "+C.bd,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:11,fontWeight:600,color:C.tx,letterSpacing:0.5,textTransform:"uppercase"}}>{label||"Resultado"}</span>
        {loading&&phase&&<span style={{fontSize:10,color:C.cyan,fontWeight:600,padding:"2px 8px",background:bg8(C.cyan),borderRadius:4}}>{phaseLabels[phase]||phase}</span>}
      </div>
      {content&&<div style={{display:"flex",gap:6}}>
        <Btn small onClick={()=>navigator.clipboard.writeText(content)}>Copiar</Btn>
        <Btn small onClick={()=>{const w=window.open("","_blank");w.document.write("<pre style='font-family:sans-serif;padding:40px;line-height:1.8;max-width:800px;margin:auto'>"+content.replace(/</g,"&lt;")+"</pre>");w.document.title="Cliniq Digital - Exportar";}}>Imprimir</Btn>
      </div>}
    </div>
    <div ref={ref} style={{padding:20,flex:1,overflowY:"auto",maxHeight:700}}>
      {loading?<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16,paddingTop:40}}>
        <div className="spinner" style={{width:24,height:24,borderWidth:3}}/>
        <span style={{fontSize:14,color:C.teal}}>{phaseLabels[phase]||"Generando..."}</span>
        {phase==="search"&&<div style={{maxWidth:300,textAlign:"center"}}>
          <p style={{fontSize:12,color:C.txD,lineHeight:1.6}}>La IA busca datos reales del negocio en Internet: presencia en plataformas, resenas, menciones, competencia y mas.</p>
        </div>}
      </div>:content?<div style={{fontSize:14,color:C.w,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{content}</div>
      :<p style={{fontSize:14,color:C.txD,fontStyle:"italic"}}>Configura los parámetros y pulsa generar.</p>}
    </div>
  </div>;
}

/* ── ACTION ITEM COMPONENT ── */
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

/* ── TOOL WRAPPER ── */
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

1. HERO
- H1 que posicione para "${srv} en ${ci||"[ciudad]"}" (maximo 70 caracteres)
- Subtitulo emocional que conecte con la necesidad del paciente/cliente (maximo 120 caracteres)
- CTA principal claro y directo
- Texto de refuerzo bajo el CTA (urgencia suave: disponibilidad, primera consulta, etc.)

2. PROBLEMA / NECESIDAD
- Describe las preocupaciones REALES y concretas del paciente/cliente que busca este servicio
- Usa 3-4 preguntas que buscan en Google sobre este tema
- Conecta emocionalmente: que siente, que le preocupa, que ha probado antes

3. SOLUCION / BENEFICIOS
- Texto orientado 100% al beneficio, no a las caracteristicas tecnicas
- Keywords secundarias integradas de forma natural
- 4-5 beneficios concretos con descripcion de 2 lineas cada uno
- Diferenciador del centro respecto a la competencia local

4. PROCESO PASO A PASO
- 4-5 pasos concretos desde la primera consulta hasta el resultado
- Reduce incertidumbre con detalles reales: que ocurre en cada fase, duracion, que esperar
- Lenguaje accesible aunque tecnico cuando sea necesario

5. EQUIPO / AUTORIDAD
- Texto que posicione al profesional como referente en ${geo}
- Credenciales verificables, anos de experiencia, casos realizados
- Formacion especifica en "${srv}" si aplica
- Pertenencia a sociedades cientificas o colegios profesionales

6. FAQ - 6 PREGUNTAS REALES
- Preguntas que buscan usuarios en Google sobre "${srv}"
- Respuestas concisas (3-4 lineas) optimizadas para featured snippets
- Incluir al menos 2 preguntas con componente geo-local

7. TESTIMONIOS - 3 ESTRUCTURAS
- Placeholders con estructura narrativa que refuerce confianza local
- Formato: nombre ficticio + zona de ${geo} + servicio + resultado + recomendacion
- Indicar [SUSTITUIR POR TESTIMONIO REAL]

8. CTA FINAL
- Urgencia natural sin agresividad
- Formulario con campos minimos (nombre, telefono, servicio interes)
- Telefono directo + WhatsApp + email
- Horario de atencion

9. BLOQUE DE CONFIANZA
- Certificaciones reales del sector
- Cifras verificables (anos, pacientes atendidos con marcador [COMPLETAR])
- Referencias locales en ${geo}
- Logos de aseguradoras / colaboradores si aplica

10. SEO META
- Title tag (maximo 60 caracteres, con keyword + ciudad)
- Meta description (maximo 155 caracteres, con geo + CTA)
- Schema markup sugerido (tipo LocalBusiness + MedicalBusiness si sanitario)
- Open Graph tags sugeridos`,sO,sL,nR,geo)}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
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
    ai("Experto en comunicacion WhatsApp Business para centros de salud y servicios profesionales. Cada mensaje debe sonar NATURAL, como lo escribiria una recepcionista profesional con experiencia, no como un bot ni como un mensaje de marketing. Maximo 160 palabras por mensaje. Los mensajes deben cumplir estrictamente con la LOPD y el RGPD.",
    `Protocolo WhatsApp completo para el escenario: "${sc}".
Centro: ${nm||"[Nombre del centro]"}.
Sector: ${nR}.

Genera contenido LISTO PARA COPIAR Y ENVIAR por WhatsApp Business:

1. MENSAJE PRINCIPAL
- Texto exacto listo para enviar. Natural, breve, profesional
- Sin formalismos excesivos ni lenguaje corporativo
- Estructura: saludo personalizado + contenido especifico del escenario + cierre con accion concreta
- Maximo 160 palabras

2. VARIANTE A - TONO FORMAL
- Mismo objetivo, ligeramente mas institucional
- Para casos donde el receptor prefiere trato formal

3. VARIANTE B - TONO CERCANO
- Mismo objetivo, mas calido y personal
- Para casos con relacion ya establecida

4. RESPUESTAS PREPARADAS (4 minimo)
- Respuesta si ACEPTA la propuesta
- Respuesta si PREGUNTA PRECIO o condiciones
- Respuesta si PIDE MAS INFORMACION
- Respuesta si NO CONTESTA (follow-up a 24h y 48h)
- Respuesta si RECHAZA (cierre elegante, puerta abierta)

5. GUIA DE ENVIO
- Horario recomendado (dia y hora optimos)
- Tiempo de espera entre mensajes
- Protocolo si no responde: 24h, 48h, 1 semana
- Frecuencia maxima para no saturar

6. ERRORES FRECUENTES
- 5 errores concretos que cometen los centros en este escenario
- Para cada error: que hacen mal y como corregirlo

7. NOTAS LEGALES
- Consentimiento previo LOPD/RGPD necesario
- Derecho de baja y como implementarlo
- Horarios permitidos para comunicaciones comerciales
- Registro de consentimiento recomendado`,sO,sL,nR,"Espana")}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
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
    ai("Experto SEO con especializacion en posicionamiento local para el sector sanitario y servicios profesionales en Espana. Redactas articulos que posicionan en las primeras posiciones de Google para busquedas geo-localizadas. Cada articulo debe ser informativo, preciso y util para el usuario que busca este tema.",
    `ARTICULO SEO GEO-OPTIMIZADO

Tema: "${tp}"
Keyword principal: "${kw||tp}"
Localizacion: ${geo}
Extension objetivo: ${ln}
Intencion de busqueda: ${intent}

KEYWORDS GEO OBLIGATORIAS a integrar de forma natural en el texto:
"${kw||tp} en ${ci||"[ciudad]"}", "${kw||tp} ${ci||"[ciudad]"}", "${kw||tp} ${br||ci||"[zona]"}", "mejor ${kw||tp} ${ci||"[ciudad]"}", "${kw||tp} precio", "${kw||tp} opiniones"

ESTRUCTURA COMPLETA REQUERIDA:

1. TITLE TAG
- Maximo 60 caracteres
- Keyword principal + ciudad
- Gancho que invite al clic

2. META DESCRIPTION
- Maximo 155 caracteres
- Keyword + geo + CTA implicito

3. URL SUGERIDA
- Slug corto, con keyword y ciudad: /keyword-ciudad/

4. ESTRUCTURA DE ENCABEZADOS
- H1 con keyword + ciudad
- H2s con variaciones semanticas y long-tail
- H3s para subtemas especificos
- Estructura logica y jerarquica

5. ARTICULO COMPLETO
- Parrafos cortos de 3-4 lineas para lectura movil
- Keyword en el primer parrafo de forma natural
- LSI keywords distribuidas en todo el texto
- Referencias locales naturales a ${geo}
- Datos del sector verificables o con marcador [COMPLETAR]
- Informacion practica y util para el lector
- Transiciones naturales entre secciones
- Sin relleno ni repeticiones innecesarias

6. FAQ (5 preguntas)
- Preguntas optimizadas para People Also Ask
- Formato pregunta-respuesta concisa para featured snippets
- Al menos 2 con componente geo-local

7. CTA INTERNO
- Enlace natural a pagina de servicio
- Texto ancla optimizado con keyword

8. KEYWORDS SECUNDARIAS Y LONG-TAIL
- Minimo 10 keywords relacionadas
- Volumen estimado orientativo
- Dificultad estimada

9. ENLACES INTERNOS SUGERIDOS
- 3-5 paginas internas a las que enlazar
- Texto ancla recomendado para cada uno

10. SCHEMA MARKUP RECOMENDADO
- Tipo de schema (Article, FAQPage, MedicalWebPage si aplica)
- Campos principales a rellenar

11. NOTAS SEO TECNICAS
- Densidad keyword estimada
- Legibilidad Flesch objetivo
- Meta robots recomendado
- Canonical URL`,sO,sL,nR,geo)}
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
    ai("Auditor experto en experiencia digital para negocios locales. Tus informes incluyen puntuaciones objetivas y recomendaciones priorizadas por impacto real en conversion y SEO local. Cuando no tengas datos concretos, usa marcadores [COMPLETAR] para que el usuario rellene.",
    `Auditoria digital completa del negocio: ${u}
Localizacion: ${geo}
Sector: ${nR}
Notas adicionales: ${nt||"Ninguna"}

INFORME COMPLETO:

1. RESUMEN EJECUTIVO
- Puntuacion global (/100) con desglose
- Top 3 fortalezas identificadas
- Top 3 mejoras prioritarias
- ROI estimado de implementar las mejoras [COMPLETAR con datos reales]

2. WEB (/100)
- Conversion: CTAs, formularios, recorrido del usuario
- UX: velocidad, navegacion, usabilidad
- Movil: responsive, experiencia tactil, Core Web Vitals
- Contenido: calidad, extension, actualizacion

3. SEO LOCAL (/100)
- Keywords geo-localizadas posicionadas
- Posicionamiento en busquedas "${nR} en ${ci||"[ciudad]"}"
- Google Business Profile: estado, optimizacion
- NAP Consistency: nombre, direccion, telefono en directorios
- Citations en directorios locales y sectoriales
- Schema markup local implementado

4. GOOGLE BUSINESS PROFILE (/100)
- Completitud del perfil
- Fotos y publicaciones
- Resenas: cantidad, nota media, tasa respuesta
- FAQ y servicios listados

5. EXPERIENCIA DIGITAL DEL PACIENTE/CLIENTE (/100)
- Facilidad de reserva online
- Comunicacion post-contacto
- Seguimiento y fidelizacion
- WhatsApp Business configurado

6. REDES SOCIALES (/100)
- Presencia activa por plataforma
- Frecuencia y calidad de contenido
- Engagement y crecimiento
- Coherencia con marca

7. PLAN DE ACCION PRIORIZADO
- Quick Wins (0-1 semana): acciones inmediatas sin coste
- Corto plazo (1-3 meses): mejoras con inversion moderada
- Medio plazo (3-6 meses): proyectos estrategicos
- Para cada accion: que hacer, impacto estimado, coste orientativo, responsable

8. PROYECCION
- Escenario sin cambios vs con plan implementado
- Metricas objetivo a 3 y 6 meses
- KPIs de seguimiento recomendados`,sO,sL,nR,geo)}
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
    ai("Experto en secuencias de seguimiento y nurturing para negocios de servicios. Cada mensaje debe estar COMPLETO y listo para enviar, no esquemas ni indicaciones. El objetivo es nutrir la relacion sin presionar, generando confianza progresiva hasta la conversion.",
    `Secuencia completa de seguimiento para personas interesadas en "${srv}" que NO han reservado cita.
Centro: ${nm||"[Nombre del centro]"}.
Canal: ${ch}.
Sector: ${nR}.

Genera 5 mensajes COMPLETOS listos para copiar y enviar:

DIA 1 - AGRADECIMIENTO Y CONEXION
- Agradece el interes de forma natural
- Recuerda brevemente el servicio y por que es relevante para su caso
- Ofrece resolver dudas sin compromiso
- Tono calido, sin ninguna presion comercial

DIA 3 - CONTENIDO EDUCATIVO
- Comparte informacion util sobre "${srv}" que responda una duda frecuente
- Posiciona al centro como referente en el tema
- Incluye un dato o consejo practico que aporte valor real

DIA 7 - CASO DE EXITO / PRUEBA SOCIAL
- Cuenta un caso tipico (sin nombres reales) con el proceso y resultado
- Genera confianza a traves de la experiencia de otros
- Conecta con la situacion probable del receptor

DIA 14 - OBJECIONES
- Identifica y aborda la objecion mas comun del sector (precio, miedo, tiempo, resultados)
- Desmonta la objecion con argumento concreto y datos reales del sector
- Mantiene tono empático y comprensivo

DIA 30 - PROPUESTA CONCRETA
- Oferta especifica o incentivo para activar la reserva
- Urgencia natural y legitima (disponibilidad, temporada, plazas)
- CTA claro y directo, sin presion agresiva
- Puerta abierta si no es el momento

Para CADA mensaje incluye:
- ASUNTO (si es email)
- MENSAJE COMPLETO listo para copiar
- OBJETIVO concreto del mensaje
- ACCION que esperas del receptor
- METRICA de exito (tasa apertura/respuesta objetivo)

Al final:
- REGLAS DE USO: horarios optimos, frecuencia, cuando parar la secuencia
- NOTAS LEGALES: consentimiento LOPD/RGPD, derecho de baja, registro
- VARIACIONES A/B: 2 versiones alternativas del asunto del Dia 1 y Dia 14`,sO,sL,nR,"Espana")}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
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
    ai("Arquitecto de informacion web con SEO tecnico y local integrado. Disenas estructuras web que maximizan el posicionamiento local y la conversion.",
    `Arquitectura web completa para: ${nm||"[Nombre del centro]"}.
Localizacion: ${geo}.
Especialidades: ${sp||"[Definir servicios principales]"}.
Equipo: ${dc||"[Definir profesionales]"}.
Sector: ${nR}.

ESTRUCTURA COMPLETA:

1. MAPA DEL SITIO CON URLs GEO-OPTIMIZADAS
- Estructura de URLs tipo /[ciudad]/[servicio]/ para cada servicio
- Jerarquia logica de paginas
- Paginas hub por categoria de servicio
- URLs canonicas

2. HOME - Secciones y CTAs
- Estructura de secciones con proposito de cada una
- CTAs principales y secundarios
- Elementos geo-locales visibles
- Above the fold: que debe verse sin scroll

3. PLANTILLA PAGINA DE SERVICIO
- SEO on-page completo para cada servicio
- Estructura de contenido optima
- CTAs por seccion
- Schema markup especifico

4. PAGINA DE EQUIPO
- Estructura por profesional
- Schema Person
- Credenciales y especializaciones

5. BLOG - Categorias y estrategia
- Categorias geo-local por servicio
- Frecuencia publicacion recomendada
- Tipos de contenido por categoria
- Calendario editorial base

6. PAGINAS TRANSVERSALES
- Contacto (con schema, mapa, horarios)
- Sobre nosotros (historia, valores, equipo)
- FAQ general
- Politica privacidad y legal

7. ENLAZADO INTERNO
- Silos tematicos por servicio
- Enlaces hub-spoke
- Breadcrumbs optimizados
- Footer links estrategicos

8. SEO TECNICO
- Schema LocalBusiness completo
- Schema MedicalBusiness si aplica
- Sitemap XML estructura
- Robots.txt recomendado
- hreflang si hay version en otro idioma
- Core Web Vitals objetivos`,sO,sL,nR,geo)}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
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
    ai("Estratega de redes sociales especializado en negocios locales de salud y servicios profesionales. Creas estrategias basadas en datos reales de engagement del sector, no en formulas genericas. Cada pieza de contenido debe estar completa y lista para publicar. La estrategia debe ser realista y ejecutable para un equipo pequeno.",
    `Estrategia completa de ${pl} para: ${nm||"[Nombre del centro]"}.
Sector: ${nR}.
Localizacion: ${geo}.
Periodo: ${wk}.
Objetivo principal: ${obj}.

ESTRATEGIA COMPLETA:

1. ANALISIS Y POSICIONAMIENTO
- Perfil de audiencia en ${pl} para este sector en ${geo}
- Horarios optimos de publicacion para esta audiencia y zona geografica
- Benchmark del sector: frecuencia, tipo contenido, engagement medio
- Tono y personalidad de marca en ${pl}

2. PILARES DE CONTENIDO (4-5 pilares)
- Para cada pilar: nombre, porcentaje del total, objetivo, tipo contenido
- Pilar EDUCATIVO: informar sobre servicios y sector (30-35%)
- Pilar CONFIANZA: casos, equipo, behind the scenes (25-30%)
- Pilar ENGAGEMENT: preguntas, encuestas, tendencias (15-20%)
- Pilar CONVERSION: ofertas, CTAs, reservas (10-15%)
- Pilar LOCAL: contenido geo-localizado, comunidad, eventos ${geo} (10%)

3. CALENDARIO EDITORIAL (${wk})
Para cada publicacion (4-5 por semana):
- Dia y hora exacta de publicacion
- Pilar al que pertenece
- Formato (post, reel, carrusel, story)
- Tema concreto
- COPY COMPLETO listo para publicar (texto del post)
- Descripcion visual detallada (que se ve en la imagen/video)
- Hashtags (8-12, mix de genericos del sector + locales + nicho)
- CTA especifico

4. GUIONES DE REELS (4 guiones completos)
Para cada reel:
- Titulo/gancho (primeros 2 segundos)
- Guion palabra por palabra
- Duracion estimada
- Indicaciones visuales
- Audio/musica sugerida
- Copy para el post
- Hashtags

5. ESTRATEGIA DE STORIES (semanal)
- Lunes: tipo story + contenido
- Martes-Viernes: secuencia tematica
- Fin de semana: contenido relajado/personal
- Stickers interactivos a usar (encuestas, preguntas, quiz)
- Destacados sugeridos (iconos, nombres, contenido)

6. HASHTAGS MASTER LIST
- 10 hashtags del sector general
- 10 hashtags geo-locales (${ci||"[ciudad]"}, ${br||""}, ${pv||""})
- 10 hashtags de nicho especifico
- 5 hashtags de marca propios sugeridos
- Rotacion semanal recomendada

7. METRICAS Y KPIs
- KPIs objetivo por semana/mes
- Que medir y como interpretar cada metrica
- Benchmark del sector para comparar
- Herramientas de medicion recomendadas

8. CUMPLIMIENTO NORMATIVO
- Reglas especificas de publicidad del sector en redes
- Limitaciones de claims y promesas
- Uso de imagenes antes/despues
- Testimonios: que se puede y que no
- Disclaimers necesarios`,sO,sL,nR,geo)}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
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
    ai("Especialista en Google Business Profile y SEO local para negocios de servicios.",
    `Guia completa de optimizacion de Google Business Profile para: ${nm||"[Nombre]"}.
Localizacion: ${geo}. Sector: ${nR}.

1. CHECKLIST OPTIMIZACION COMPLETA
- Nombre del negocio (formato correcto, sin keywords stuffing)
- Categoria principal y secundarias recomendadas para ${nR}
- Descripcion optimizada (750 caracteres con keywords geo naturales)
- Listado completo de servicios con descripciones
- Atributos recomendados para el sector
- Horario (con horarios especiales)
- Zona de servicio si aplica
- Web, telefono, WhatsApp enlazados

2. ESTRATEGIA DE FOTOS
- Tipos especificos de fotos para ${nR}
- Cantidad minima por categoria
- Nombres de archivo con keywords geo
- Frecuencia de actualizacion

3. PUBLICACIONES (4 semanas, 2/semana)
- Texto completo geo-optimizado para cada publicacion
- CTA apropiado
- Imagen sugerida

4. RESPUESTAS A RESENAS
- 3 plantillas para resenas positivas (variables)
- 3 plantillas para resenas negativas (protocolos)
- Estrategia de solicitud de resenas a pacientes/clientes

5. FAQ PROACTIVAS (10 preguntas)
- Preguntas con keywords locales integradas
- Respuestas optimizadas para visibilidad

6. MONITORIZACION
- Que revisar semanalmente
- Metricas GBP a seguir
- NAP Consistency: verificar nombre, direccion, telefono identicos en toda la web
- Herramientas de seguimiento`,sO,sL,nR,geo)}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
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
    ai("Guionista de video para redes sociales del sector sanitario y servicios profesionales. Cada script contiene el texto exacto que dira el profesional frente a camara. Los guiones deben sonar naturales, como si el profesional hablara con un paciente en consulta.",
    `4 scripts de video sobre "${srv}" para ${pl}.
Centro: ${nm||"[Nombre]"}. Profesional: ${dc||"[Nombre]"}. Objetivo principal: ${gl}.

Para CADA script genera TODO esto:

- TITULO del video (gancho para retener en scroll)
- DURACION estimada
- GANCHO (primeros 3 segundos): frase EXACTA para retener. Curiosidad o resolucion de duda inmediata
- DESARROLLO COMPLETO: texto palabra por palabra. Lenguaje natural, como en consulta. Pausas, transiciones, enfasis
- CTA: frase final que invite a la accion sin ser agresiva
- TEXTO EN PANTALLA: textos superpuestos que refuercen el mensaje
- INDICACIONES VISUALES: plano, setting, movimiento camara en cada momento
- COPY PARA EL POST: texto completo para acompanar en la publicacion
- HASHTAGS: 8-10 hashtags relevantes (sector + localidad)

DISTRIBUCION DE SCRIPTS:
Script 1 = EDUCATIVO - Explica algo sobre "${srv}" que el publico desconoce
Script 2 = MITOS - Desmonta 2-3 mitos comunes con datos reales del sector
Script 3 = PROCESO - Muestra paso a paso la experiencia real del paciente/cliente
Script 4 = FAQ - Responde las 3 preguntas mas frecuentes de forma directa

NOTAS DE CUMPLIMIENTO NORMATIVO del sector al final.`,sO,sL,nR,"Espana")}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
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
    ai("Analista de competencia digital con enfoque en SEO local y posicionamiento geografico.",
    `Analisis de competencia local para: ${nm} en ${geo}.
Competidores identificados: ${cm||"No especificados (analizar los principales del sector en la zona)"}.
Sector: ${nR}.

FRAMEWORK DE ANALISIS (usa [COMPLETAR] cuando falten datos concretos):

1. MAPA COMPETITIVO LOCAL
- Segmentacion por zona en ${ci||"[ciudad]"}
- Competidores directos vs indirectos
- Posicionamiento de precio de cada uno

2. WEB COMPARATIVO
- Calidad web, UX, conversion
- Contenido y blog
- Velocidad y movil

3. SEO LOCAL COMPARATIVO
- Keywords geo posicionadas por competidor
- Gaps de keywords donde no hay competencia
- Autoridad de dominio estimada
- Backlinks locales

4. GOOGLE MAPS / PACK LOCAL
- Fichas GBP de competidores
- Resenas: cantidad y nota media
- Posicion en el pack local de Google
- Categorias y atributos

5. REDES SOCIALES
- Presencia y actividad por plataforma
- Engagement y crecimiento
- Tipo de contenido

6. PRECIOS Y COMUNICACION
- Rango de precios del mercado local
- Propuesta de valor de cada competidor
- Diferenciadores comunicados

7. OPORTUNIDADES GEO-LOCALES
- Keywords sin competencia en ${br||ci||"[zona]"}
- Zonas geograficas desatendidas
- Servicios con demanda y poca oferta local
- Nichos long-tail sin explotar

8. PLAN DE ACCION
- 5 acciones concretas para ganar cuota de mercado local
- Prioridad, plazo, inversion estimada`,sO,sL,nR,geo)}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
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
    ai("Consultor de cumplimiento normativo publicitario en Espana. Solo senala infracciones cuando estes SEGURO de que la norma aplica. No inventes normas ni articulos. Si no estas seguro del articulo exacto, indicalo. Sector sanitario: RD 1907/1996, Ley 34/1988, normativa AEMPS, codigos deontologicos. Otros sectores: marco regulatorio correspondiente.",
    `Analiza el siguiente texto publicitario de tipo "${tp}" contra la normativa aplicable al sector ${nR}:
"""
${txt}
"""

ESTRUCTURA DEL ANALISIS:

1. VEREDICTO GENERAL
- Semaforo: VERDE (cumple) / AMARILLO (riesgos menores) / ROJO (infracciones graves)
- Justificacion en 2-3 lineas

2. INFRACCIONES DETECTADAS
Para cada una:
- Fragmento exacto del texto problematico
- Norma concreta que vulnera (con articulo si lo conoces; si no, indicar "verificar articulo exacto")
- Nivel de riesgo: bajo / medio / alto / muy alto
- Texto corregido que mantiene el mensaje comercial

3. ADVERTENCIAS
- Elementos que no son infracciones claras pero podrian serlo segun interpretacion o comunidad autonoma

4. BUENAS PRACTICAS
- Que hace bien el texto

5. VERSION CORREGIDA COMPLETA
- Texto entero reescrito cumpliendo normativa
- Mantiene la intencion comercial original sin infracciones

6. CHECKLIST RAPIDO (si/no)
- Promesas de resultado
- Superlativos absolutos
- Comparativas sin base
- Trivializacion de riesgos
- Testimonios problematicos
- Imagenes antes/despues referenciadas
- Urgencia artificial
- Profesional identificado
- Consentimiento informado mencionado
- Precios claros si se mencionan
- Condiciones de oferta visibles`,sO,sL,nR,"Espana")}
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
    ai("Especialista en reputacion online y gestion de resenas para negocios locales. Las respuestas deben ser empaticas, profesionales y reforzar la marca. NUNCA confirmes ni niegues detalles clinicos o personales del paciente/cliente por privacidad.",
    `Genera respuestas para esta resena de Google:
Centro: ${nm||"[Nombre]"}. Sector: ${nR}.
Puntuacion: ${rt}. Tipo: ${sc}. ${rv?'Texto de la resena: "'+rv+'"':"(Resena sin texto, solo puntuacion)"}.

1. RESPUESTA PRINCIPAL (120-150 palabras)
- Empatica, profesional, refuerza marca
- Si positiva: agradecimiento genuino + refuerzo del valor mencionado + invitacion a volver
- Si negativa: empatia + reconocimiento + solucion concreta + canal privado

2. VARIANTE FORMAL
- Mas institucional, para perfiles premium

3. VARIANTE CERCANA
- Mas calida y personal

4. REGLAS DE RESPUESTA
- LOPD: que nunca mencionar (datos salud, tratamientos, fechas)
- Limites legales de la respuesta publica
- Tiempo maximo de respuesta recomendado

5. ACCION INTERNA
- Que hacer internamente con esta resena
- Si requiere seguimiento del equipo
- Registro para mejorar procesos

${rt.includes("1")||rt.includes("2")||rt.includes("3")?"6. PROTOCOLO DE RECUPERACION\n- Mensaje privado sugerido para contactar al cliente\n- Protocolo de resolucion paso a paso\n- Objetivo: convertir experiencia negativa en segunda oportunidad":""}`,sO,sL,nR,"Espana")}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
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
    ai("Analista de marketing digital para negocios locales. Informes que traducen datos en insights accionables y recomendaciones SEO/geo concretas. Usa [COMPLETAR] para datos que no tengas.",
    `Informe mensual de marketing digital.
Centro: ${nm}. Mes: ${mo}. Sector: ${nR}.
Datos del mes:
- Visitas web: ${vi||"[COMPLETAR]"}
- Consultas recibidas: ${co||"[COMPLETAR]"}
- Reservas/citas: ${bk||"[COMPLETAR]"}
- Posiciones Google: ${gp||"[COMPLETAR]"}
- Resenas nuevas: ${rv||"[COMPLETAR]"}
- Redes sociales: ${so||"[COMPLETAR]"}

ESTRUCTURA DEL INFORME:

1. RESUMEN EJECUTIVO
- Puntuacion del mes (1-10) con justificacion
- 3 logros principales
- 3 areas de mejora
- Tendencia vs mes anterior

2. TRAFICO WEB
- Fuentes de trafico (organico, directo, redes, referidos)
- Trafico geo-localizado (ciudades, zonas)
- Paginas mas visitadas
- Tasa de rebote y tiempo medio

3. CONVERSION
- Tasa de conversion visitante > consulta
- Tasa conversion consulta > reserva
- Embudo completo con tasas por fase
- Comparativa con benchmark del sector

4. SEO LOCAL
- Keywords posicionadas y evolucion
- Nuevas keywords ganadas
- Keywords perdidas o en descenso
- Oportunidades detectadas

5. GOOGLE BUSINESS PROFILE
- Visualizaciones, acciones, llamadas
- Resenas: nuevas, nota media, respuestas pendientes
- Publicaciones realizadas y rendimiento

6. REDES SOCIALES
- Seguidores, engagement, alcance por plataforma
- Mejores publicaciones del mes
- Contenido que mejor funciono y por que

7. PLAN PROXIMO MES
- 5 acciones concretas con impacto SEO
- Prioridad, responsable, plazo
- KPIs objetivo

8. PROYECCION TRIMESTRAL
- Tendencia de datos
- Objetivos realistas a 3 meses
- Inversion recomendada`,sO,sL,nR,"Espana")}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
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
    ai("Consultor de marca y comunicacion para negocios de servicios. Manuales completos, practicos y adaptados al sector que pueda usar cualquier miembro del equipo.",
    `MANUAL DE COMUNICACION completo para: ${nm}.
Sector: ${nR}.
Servicios: ${tx||"[Principales servicios]"}.
Equipo: ${dc||"[Profesionales del centro]"}.
Tono deseado: ${tn||"Profesional y cercano"}.
Valores: ${vl||"[Valores del centro]"}.
Audiencia principal: ${au||"Medio-alto, 30-55 anos"}.

ESTRUCTURA DEL MANUAL:

1. IDENTIDAD DE MARCA
- Mision, vision, valores (textos definitivos)
- Propuesta de valor diferencial
- Tabla ES / NO ES (que es la marca y que no es)
- Elevator pitch (30 segundos)

2. TONO DE VOZ
- Escala de formalidad (1-10) con ejemplos
- Vocabulario permitido y prohibido
- Expresiones SI y expresiones NO
- Tono por canal (web, redes, WhatsApp, email, telefono)
- Ejemplos concretos de texto bien escrito vs mal escrito

3. MENSAJES CLAVE POR SERVICIO
- Para cada servicio principal: propuesta de valor, mensaje corto, FAQ, objeciones y respuestas

4. PROTOCOLOS DE COMUNICACION
- Respuesta a consultas (tiempo, formato, contenido)
- Seguimiento post-consulta
- Gestion de quejas y reclamaciones
- Respuesta a resenas (positivas y negativas)
- Comunicacion de urgencias

5. GUIA POR CANAL
- Web: tono, extension, CTAs
- Instagram: personalidad, formatos, frecuencia
- Google Business: publicaciones, FAQ, respuestas
- WhatsApp Business: mensajes, automatismos, limites
- Email: plantillas, asuntos, frecuencia

6. GUIA VISUAL (directrices)
- Paleta de colores (codigos hex sugeridos)
- Tipografias recomendadas
- Estilo fotografico
- Uso de logo

7. CUMPLIMIENTO NORMATIVO
- Reglas publicitarias del sector
- Que se puede comunicar y que no
- Disclaimers obligatorios
- LOPD en comunicaciones

8. PLANTILLAS LISTAS PARA USAR
- 3 plantillas de post redes sociales
- 3 plantillas de email
- 3 plantillas de WhatsApp
- 1 plantilla respuesta resena positiva
- 1 plantilla respuesta resena negativa`,sO,sL,nR,"Espana")}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
      <Fld label="Centro"><Inp value={nm} onChange={sNm} ph="Nombre completo"/></Fld>
      <Fld label="Servicios"><Txa value={tx} onChange={sTx} ph="Servicios principales..." rows={2}/></Fld>
      <Fld label="Equipo"><Txa value={dc} onChange={sDc} ph="Profesionales..." rows={2}/></Fld>
      <Fld label="Tono"><Inp value={tn} onChange={sTn} ph="Profesional, cercano, premium..."/></Fld>
      <Fld label="Valores"><Inp value={vl} onChange={sVl} ph="Excelencia, honestidad, cercanía..."/></Fld>
      <Fld label="Audiencia"><Inp value={au} onChange={sAu} ph="Mujeres 30-55, nivel medio-alto"/></Fld>
    </>}/>;
}

/* ══════ SCAN PRESENCIA 360 ══════ */
function ScanPresencia(){
  const[nm,sNm]=useState("");const[web,sWeb]=useState("");const[tel,sTel]=useState("");
  const[dir,sDir]=useState("");const[cp,sCp]=useState("");const[ci,sCi]=useState("");const[pv,sPv]=useState("");
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");
  const[email,sEmail]=useState("");const[horario,sHor]=useState("");
  const[gbpUrl,sGbpUrl]=useState("");const[fbUrl,sFbUrl]=useState("");const[igUrl,sIgUrl]=useState("");
  const[numRes,sNumRes]=useState("");const[notaMedia,sNotaMedia]=useState("");
  const[tab,setTab]=useState("data");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const[mode,setMode]=useState("full");
  const[phase,setPhase]=useState(null);
  const nR=resolveNiche(ni,cni);
  const plats=PLATFORM_DB.filter(p=>!p.healthOnly||isHealthNiche(ni));
  const[statuses,setStatuses]=useState({});
  const toggleStatus=(pid)=>{
    const cycle=["unknown","ok","warning","missing"];
    const cur=statuses[pid]||"unknown";
    const next=cycle[(cycle.indexOf(cur)+1)%cycle.length];
    setStatuses({...statuses,[pid]:next});
  };
  const countBy=(st)=>Object.values(statuses).filter(s=>s===st).length;
  const totalAudited=Object.values(statuses).filter(s=>s!=="unknown").length;
  const scoreCalc=()=>{
    if(totalAudited===0) return 0;
    const ok=countBy("ok");const warn=countBy("warning");
    return Math.round(((ok*10+warn*5)/(totalAudited*10))*100);
  };
  const score=scoreCalc();
  const scoreCl=score>=70?C.green:score>=40?C.gold:score<40&&totalAudited>0?C.red:C.txD;
  const cats=[...new Set(plats.map(p=>p.cat))];

  const napData={nombre:nm,direccion:dir+(cp?" "+cp:""),ciudad:ci+(pv?", "+pv:""),telefono:tel,web:web,email:email,horario:horario};
  const napFilled=Object.values(napData).filter(v=>v).length;
  const napTotal=Object.keys(napData).length;
  const napScore=Math.round((napFilled/napTotal)*100);

  const modeOpts=[
    {id:"full",lb:"Scan completo 360"},
    {id:"websearch",lb:"Buscar en Internet (datos reales)"},
    {id:"gaps",lb:"Solo gaps y ausencias"},
    {id:"nap",lb:"Auditoría NAP/Consistencia"},
    {id:"priority",lb:"Plan de acción priorizado"},
    {id:"seolocal",lb:"Impacto en SEO local"},
    {id:"voicesearch",lb:"Búsquedas por voz"},
  ];

  const statusSummary=()=>{
    const lines=[];
    plats.forEach(p=>{
      const st=statuses[p.id]||"unknown";
      const label={ok:"PRESENTE Y CORRECTO",warning:"PRESENTE PERO DATOS A REVISAR",missing:"AUSENTE",unknown:"SIN VERIFICAR"}[st];
      lines.push(`- ${p.name} (${p.cat}): ${label}`);
    });
    return lines.join("\n");
  };

  const buildPrompt=()=>{
    const base=`SCAN DE PRESENCIA DIGITAL 360

DATOS DEL NEGOCIO:
Nombre: ${nm}
Web: ${web||"[No proporcionada]"}
Telefono: ${tel||"[No proporcionado]"}
Direccion: ${dir||"[No proporcionada]"} ${cp||""} ${ci||"[No proporcionada]"} ${pv||""}
Email: ${email||"[No proporcionado]"}
Horario: ${horario||"[No proporcionado]"}
Sector: ${nR}
Google Business Profile URL: ${gbpUrl||"[No proporcionado]"}
Facebook URL: ${fbUrl||"[No proporcionada]"}
Instagram URL: ${igUrl||"[No proporcionado]"}
Resenas Google: ${numRes||"[No verificado]"} resenas, nota media: ${notaMedia||"[No verificado]"}

ESTADO ACTUAL POR PLATAFORMA (verificado por el usuario):
${statusSummary()}

Total plataformas verificadas: ${totalAudited} de ${plats.length}
Presentes y correctas: ${countBy("ok")}
Presentes con datos incorrectos: ${countBy("warning")}
Ausentes: ${countBy("missing")}
Sin verificar: ${plats.length-totalAudited}
Puntuacion presencia: ${score}/100
Completitud datos NAP: ${napScore}%`;

    if(mode==="full") return base+`

GENERA UN INFORME COMPLETO DE PRESENCIA DIGITAL 360 con esta estructura:

1. RESUMEN EJECUTIVO
- Puntuacion global de presencia digital (/100) basada en los datos proporcionados
- Nivel de madurez digital: Basico / En desarrollo / Avanzado / Optimo
- Plataformas criticas donde NO esta presente (GAPS)
- Top 5 acciones prioritarias inmediatas con impacto esperado
- Riesgo de inconsistencia de datos (NAP Score: ${napScore}%)
- Estimacion de visibilidad perdida por ausencia en plataformas

2. MAPA DE PRESENCIA POR CATEGORIA

Para CADA plataforma del listado anterior, genera un analisis individualizado:

BUSCADORES Y MAPAS:
Para Google Business Profile, Google Maps, Bing Places, Apple Maps:
- Estado actual basado en lo reportado
- Nivel de optimizacion estimado (/10)
- Datos que probablemente faltan o estan desactualizados
- Acciones CONCRETAS para optimizar (paso a paso)
- Impacto estimado en visibilidad local
- Categorias recomendadas para el sector ${nR}
- Keywords que deberian aparecer en la descripcion

REDES SOCIALES:
Para Facebook, Instagram, LinkedIn, YouTube, TikTok:
- Estado actual
- Nivel de completitud del perfil (/10)
- Coherencia con la marca y datos del negocio
- Bio/descripcion optimizada sugerida (lista para copiar)
- Acciones de mejora inmediatas
- Conexion con web y otros perfiles

NAVEGACION GPS Y COCHES:
Para Waze, TomTom, Here Maps:
- Estado de presencia
- Como verificar si aparece
- Proceso de alta o reclamacion
- Impacto en clientes que buscan por navegador GPS

ASISTENTES DE VOZ:
Para Alexa, Google Assistant, Siri:
- Datos que indexan para responder consultas de voz
- Como optimizar para "encuentra un ${nR} cerca de mi"
- Plataformas de las que extraen informacion
- Acciones para mejorar visibilidad en busquedas por voz

DIRECTORIOS GENERALES (Paginas Amarillas, QDQ, 11870, Yelp, Foursquare, TripAdvisor):
- Estado por directorio
- Proceso de alta en cada uno con URL de acceso
- Datos a completar
- Prioridad real de cada directorio para ${nR} en ${ci||"Espana"}

DIRECTORIOS SECTORIALES (${isHealthNiche(ni)?"Doctoralia, Top Doctors, directorios medicos":"Directorios especificos de "+nR}):
- Directorios clave del sector
- Proceso de alta
- Optimizacion de perfil
- Impacto en SEO sectorial

3. AUDITORIA DE CONSISTENCIA NAP
- Analisis de los datos NAP (Name, Address, Phone) proporcionados
- Errores comunes de inconsistencia que afectan al SEO local
- Checklist de datos que DEBEN ser IDENTICOS en todas las plataformas
- Variaciones habituales que penalizan (abreviaturas, formatos telefono, etc.)
- Herramientas para verificar consistencia NAP: BrightLocal, Moz Local, Yext
- Plan de correccion si hay inconsistencias

4. ANALISIS DE IMPACTO EN SEO LOCAL
- Como afecta la presencia (o ausencia) en cada plataforma al ranking local
- Factores de ranking local de Google que dependen de citations y presencia
- Correlacion entre numero de plataformas y posicion en Google Maps
- Estimacion de mejora de posicionamiento al completar presencia
- Keywords geo-localizadas que se beneficiarian: "${nR} en ${ci}", "${nR} cerca de mi"

5. ANALISIS DE REPUTACION CRUZADA
- Estado de resenas en Google (${numRes||"[verificar]"} resenas, nota ${notaMedia||"[verificar]"})
- Presencia de resenas en otras plataformas (Facebook, Doctoralia, etc.)
- Consistencia de la nota media entre plataformas
- Volumen de resenas vs competencia estimada
- Estrategia para aumentar resenas positivas

6. DETECCION DE RIESGOS
- Fichas duplicadas en Google Maps u otras plataformas
- Datos incorrectos que pueden confundir al cliente
- Perfiles abandonados o sin actualizar
- Resenas negativas sin responder
- Informacion legal ausente (LOPD, aviso legal en web)
- Vulnerabilidades frente a la competencia local

7. PLAN DE ACCION PRIORIZADO
INMEDIATO (esta semana):
- 5 acciones que se pueden ejecutar hoy mismo
- Para cada una: plataforma, que hacer exactamente, tiempo estimado, impacto

CORTO PLAZO (2-4 semanas):
- Plataformas secundarias a completar
- Optimizaciones de perfiles existentes
- Inicio de estrategia de resenas

MEDIO PLAZO (1-3 meses):
- Directorios sectoriales
- Estrategia de contenido para plataformas
- Monitorizacion y mantenimiento

8. DASHBOARD DE METRICAS
- KPIs a seguir mensualmente por plataforma
- Herramientas de seguimiento recomendadas
- Frecuencia de revision por plataforma
- Alertas que configurar (nuevas resenas, cambios en ficha, etc.)

9. ESTIMACION DE ROI
- Visibilidad estimada actual vs con presencia completa
- Aumento estimado de consultas/visitas al completar presencia
- Coste de oportunidad mensual por no estar en plataformas criticas
- Inversion en tiempo vs retorno estimado`;

    if(mode==="gaps") return base+`

GENERA UN INFORME DE GAPS (AUSENCIAS) centrado exclusivamente en:

1. PLATAFORMAS CRITICAS DONDE NO ESTA PRESENTE
- Lista priorizada de plataformas marcadas como "AUSENTE"
- Para cada una: por que es critica para ${nR} en ${ci||"Espana"}, proceso de alta paso a paso con URL, datos exactos a introducir, tiempo estimado de alta, impacto esperado en visibilidad

2. PLATAFORMAS SIN VERIFICAR
- Lista de plataformas marcadas como "SIN VERIFICAR"
- Como verificar cada una en menos de 2 minutos
- URLs directas para comprobar presencia

3. PLATAFORMAS CON DATOS INCORRECTOS
- Lista de plataformas con datos a revisar
- Proceso de correccion para cada una
- Datos que probablemente estan mal y como corregirlos

4. OPORTUNIDADES PERDIDAS
- Estimacion de busquedas mensuales que NO encuentran el negocio
- Pacientes/clientes potenciales perdidos por cada plataforma ausente
- Ventaja competitiva que ganan los competidores presentes

5. PLAN EXPRESS DE ACCION
- Top 10 acciones ordenadas por impacto/esfuerzo
- Tiempo total estimado para completar todas las acciones`;

    if(mode==="nap") return base+`

GENERA UNA AUDITORIA NAP (Name, Address, Phone) EXHAUSTIVA:

DATOS NAP DEL NEGOCIO:
Nombre: "${nm}"
Direccion: "${dir} ${cp} ${ci} ${pv}"
Telefono: "${tel}"
Web: "${web}"
Email: "${email}"
Horario: "${horario}"

1. ANALISIS DE CADA CAMPO NAP
Para nombre, direccion, telefono, web, email y horario:
- Formato correcto segun estandares Google
- Variaciones problematicas que pueden existir (ej: "C/" vs "Calle", "+34" vs "34")
- Formato EXACTO que debe usarse en TODAS las plataformas (proporcionar el dato formateado)

2. CHECKLIST DE CONSISTENCIA
- Formato unico de nombre de negocio
- Formato unico de direccion (sin abreviaturas inconsistentes)
- Formato unico de telefono (con o sin prefijo)
- URL sin/con www, con/sin barra final
- Horario en formato estandar

3. VERIFICACION POR PLATAFORMA
Para cada plataforma donde el negocio esta presente:
- Como acceder para verificar/editar datos
- Campos especificos a comprobar
- Errores tipicos de cada plataforma

4. CORRECCIONES NECESARIAS
- Lista de correcciones priorizadas
- Datos EXACTOS a introducir en cada plataforma (listos para copiar)

5. HERRAMIENTAS DE MONITORIZACION NAP
- BrightLocal Citation Tracker
- Moz Local
- Yext
- Whitespark
- Como usar cada una para verificar consistencia

6. MANTENIMIENTO
- Frecuencia de verificacion recomendada
- Que hacer cuando cambia un dato (mudanza, nuevo telefono, etc.)
- Protocolo de actualizacion simultanea en todas las plataformas`;

    if(mode==="priority") return base+`

GENERA UN PLAN DE ACCION PRIORIZADO usando la matriz IMPACTO vs ESFUERZO:

1. QUICK WINS (Alto impacto, bajo esfuerzo) - HACER HOY
- Acciones que se ejecutan en menos de 30 minutos
- Impacto inmediato en visibilidad
- Para cada accion: que hacer, donde, tiempo exacto, resultado esperado

2. PROYECTOS ESTRATEGICOS (Alto impacto, alto esfuerzo) - PLANIFICAR
- Acciones que requieren mas tiempo pero generan gran retorno
- Calendario de implementacion semana a semana
- Recursos necesarios

3. TAREAS DE MANTENIMIENTO (Bajo impacto, bajo esfuerzo) - AUTOMATIZAR
- Acciones recurrentes que se pueden sistematizar
- Herramientas para automatizar
- Frecuencia recomendada

4. DESCARTAR O POSPONER (Bajo impacto, alto esfuerzo)
- Plataformas o acciones que no merecen la pena ahora
- Cuando reconsiderar

5. TIMELINE COMPLETO
Semana 1: [acciones concretas]
Semana 2: [acciones concretas]
Semana 3-4: [acciones concretas]
Mes 2: [acciones concretas]
Mes 3: [acciones concretas]

6. METRICAS DE SEGUIMIENTO
- KPIs por semana/mes
- Como medir el progreso
- Objetivos a 30, 60, 90 dias`;

    if(mode==="seolocal") return base+`

GENERA UN ANALISIS DE IMPACTO EN SEO LOCAL de la presencia digital:

1. FACTORES DE RANKING LOCAL AFECTADOS
- Senales de Google Business Profile (25% del ranking local)
- Senales de Citations/NAP (16% del ranking local)
- Senales de Resenas (15% del ranking local)
- Senales de Comportamiento (interacciones, clics, llamadas)
- Como cada plataforma contribuye a estos factores

2. ANALISIS DE KEYWORDS GEO-LOCALES
- Keywords transaccionales: "${nR} en ${ci}", "${nR} ${ci} precio"
- Keywords navegacionales: "${nm}", "como llegar a ${nm}"
- Keywords informacionales: "mejor ${nR} en ${ci}", "${nR} cerca de mi"
- Para cada keyword: que plataformas influyen en su posicionamiento

3. GOOGLE MAP PACK (3-Pack)
- Factores que determinan si aparece en el pack local
- Estado actual estimado
- Acciones para mejorar posicion en el pack
- Impacto de cada plataforma en el Map Pack

4. BUSQUEDAS "CERCA DE MI"
- Como Google determina que negocios mostrar
- Plataformas que alimentan estos resultados
- Optimizacion para busquedas de proximidad
- Radio de visibilidad estimado actual

5. AUTORIDAD LOCAL (Domain Authority Local)
- Citations que refuerzan autoridad local
- Backlinks locales potenciales
- Directorios con mayor peso SEO
- Estrategia de link building local

6. PROYECCION DE MEJORA SEO
- Posicionamiento estimado actual para keywords principales
- Posicionamiento estimado tras implementar mejoras
- Timeline de mejora (el SEO local tarda 3-6 meses en mostrar resultados)
- KPIs de seguimiento SEO local`;

    if(mode==="voicesearch") return base+`

GENERA UN ANALISIS DE PRESENCIA EN BUSQUEDAS POR VOZ:

1. COMO FUNCIONAN LAS BUSQUEDAS POR VOZ LOCALES
- Google Assistant: fuentes de datos que usa
- Siri / Apple: fuentes de datos (Apple Maps, Yelp)
- Alexa / Amazon: fuentes de datos
- Como cada asistente elige que negocio recomendar

2. CONSULTAS DE VOZ TIPICAS PARA ${nR}
- "Busca un ${nR} cerca de mi"
- "Cual es el mejor ${nR} en ${ci}"
- "Horario de ${nm}"
- "Telefono de ${nm}"
- "Como llego a ${nm}"
- Otras consultas frecuentes del sector

3. OPTIMIZACION POR ASISTENTE
Para Google Assistant:
- GBP optimizado (datos completos, horario, servicios)
- Schema markup en web (LocalBusiness, openingHours, geo)
- Contenido FAQ optimizado para voz (preguntas naturales)

Para Siri / Apple:
- Apple Maps Business Connect configurado
- Datos en Yelp actualizados (fuente principal de Siri)
- Web con datos estructurados

Para Alexa:
- Datos en Bing Places y Yelp
- Perfil en Amazon si aplica
- Datos NAP consistentes

4. CONTENIDO OPTIMIZADO PARA VOZ
- FAQ con preguntas en lenguaje natural
- Respuestas concisas (Position Zero / Featured Snippet)
- Schema markup FAQPage
- Contenido conversacional en la web

5. ESTADO ACTUAL Y MEJORAS
- Plataformas cubiertas vs necesarias para cada asistente
- Acciones prioritarias para aparecer en busquedas por voz
- Estimacion de busquedas por voz locales mensuales para el sector`;

    return base;
  };

  return <div>
    <div style={{marginBottom:20}}>
      <h3 style={{fontSize:18,fontWeight:700,color:C.w,margin:"0 0 4px"}}>Scan de Presencia Digital 360</h3>
      <p style={{fontSize:13,color:C.tx,margin:0}}>Diagnóstico completo de la presencia del negocio en Internet, análisis de plataformas y plan de acción</p>
    </div>

    <Tab tabs={[{id:"data",lb:"1. Datos del Negocio"},{id:"platforms",lb:"2. Mapa de Plataformas"},{id:"analysis",lb:"3. Análisis IA"}]} active={tab} onChange={setTab}/>

    {tab==="data"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:20}}>
      <Crd>
        <h4 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 16px"}}>Datos básicos del negocio</h4>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
          <Fld label="Nombre exacto del negocio *"><Inp value={nm} onChange={sNm} ph="Tal como aparece en el rótulo o registro"/></Fld>
          <Fld label="Web"><Inp value={web} onChange={sWeb} ph="www.ejemplo.es"/></Fld>
          <Fld label="Teléfono principal"><Inp value={tel} onChange={sTel} ph="+34 600 000 000"/></Fld>
          <Fld label="Email de contacto"><Inp value={email} onChange={sEmail} ph="info@ejemplo.es"/></Fld>
        </div>
      </Crd>
      <Crd>
        <h4 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 16px"}}>Dirección y horario</h4>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Fld label="Dirección completa *"><Inp value={dir} onChange={sDir} ph="Calle, número, piso"/></Fld>
          <Fld label="Código postal"><Inp value={cp} onChange={sCp} ph="03001"/></Fld>
          <Fld label="Ciudad *"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
          <Fld label="Provincia / CC.AA."><Inp value={pv} onChange={sPv} ph="Alicante / C. Valenciana"/></Fld>
          <Fld label="Horario"><Inp value={horario} onChange={sHor} ph="L-V 9:00-20:00, S 9:00-14:00"/></Fld>
        </div>
      </Crd>
      <Crd>
        <h4 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 16px"}}>Perfiles actuales conocidos</h4>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Fld label="URL Google Business Profile"><Inp value={gbpUrl} onChange={sGbpUrl} ph="https://g.page/tu-negocio"/></Fld>
          <Fld label="URL Facebook"><Inp value={fbUrl} onChange={sFbUrl} ph="https://facebook.com/tunegocio"/></Fld>
          <Fld label="URL Instagram"><Inp value={igUrl} onChange={sIgUrl} ph="https://instagram.com/tunegocio"/></Fld>
          <Fld label="N. reseñas en Google"><Inp value={numRes} onChange={sNumRes} ph="Ej: 47"/></Fld>
          <Fld label="Nota media Google"><Inp value={notaMedia} onChange={sNotaMedia} ph="Ej: 4.6"/></Fld>
        </div>
      </Crd>
      <Crd>
        <h4 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 16px"}}>Completitud datos NAP</h4>
        <ScoreBar label="Datos proporcionados" score={napFilled} max={napTotal}/>
        <div style={{fontSize:12,color:C.tx,lineHeight:1.7,marginTop:10}}>
          {Object.entries(napData).map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:"1px solid "+C.sf2}}>
            <span style={{color:C.txD,textTransform:"capitalize"}}>{k}</span>
            <span style={{color:v?C.green:C.red,fontSize:11,fontWeight:600}}>{v?"Completo":"Falta"}</span>
          </div>)}
        </div>
        <p style={{fontSize:11,color:C.txD,marginTop:10}}>La consistencia NAP (Name, Address, Phone) es uno de los factores clave de SEO local. Datos incompletos o inconsistentes entre plataformas penalizan tu posicionamiento.</p>
      </Crd>
    </div>}

    {tab==="platforms"&&<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:12}}>
        <div>
          <p style={{fontSize:13,color:C.tx,margin:0}}>Haz clic en cada plataforma para marcar su estado. Esto mejora la precisión del análisis IA.</p>
        </div>
        <div style={{display:"flex",gap:16,fontSize:11}}>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:4,background:C.txD,display:"inline-block"}}/> Sin datos</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:4,background:C.green,display:"inline-block"}}/> OK</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:4,background:C.gold,display:"inline-block"}}/> Revisar</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:4,background:C.red,display:"inline-block"}}/> Ausente</span>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:20}}>
        <Crd sx={{padding:16,textAlign:"center"}}>
          <div style={{fontSize:32,fontWeight:700,color:scoreCl}}>{score}<span style={{fontSize:14,color:C.txD}}>/100</span></div>
          <div style={{fontSize:11,color:C.tx}}>Puntuación presencia</div>
        </Crd>
        <Crd sx={{padding:16,textAlign:"center"}}>
          <div style={{fontSize:32,fontWeight:700,color:C.green}}>{countBy("ok")}</div>
          <div style={{fontSize:11,color:C.tx}}>Verificadas OK</div>
        </Crd>
        <Crd sx={{padding:16,textAlign:"center"}}>
          <div style={{fontSize:32,fontWeight:700,color:C.gold}}>{countBy("warning")}</div>
          <div style={{fontSize:11,color:C.tx}}>Datos a revisar</div>
        </Crd>
        <Crd sx={{padding:16,textAlign:"center"}}>
          <div style={{fontSize:32,fontWeight:700,color:C.red}}>{countBy("missing")}</div>
          <div style={{fontSize:11,color:C.tx}}>Ausentes</div>
        </Crd>
      </div>

      {cats.map(cat=><div key={cat} style={{marginBottom:20}}>
        <div style={{fontSize:12,fontWeight:700,color:C.tx,letterSpacing:0.5,textTransform:"uppercase",marginBottom:10,paddingBottom:6,borderBottom:"1px solid "+C.sf2}}>{cat}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8}}>
          {plats.filter(p=>p.cat===cat).map(p=>{
            const st=statuses[p.id]||"unknown";
            const stCl={ok:C.green,warning:C.gold,missing:C.red,unknown:C.txD}[st];
            return <div key={p.id} onClick={()=>toggleStatus(p.id)} style={{
              background:C.sf,border:"1px solid "+(st==="unknown"?C.bd:stCl),borderRadius:8,padding:"10px 12px",
              cursor:"pointer",transition:"all 0.2s",display:"flex",alignItems:"center",gap:10
            }}>
              <div style={{width:30,height:30,borderRadius:6,background:bg8(p.cl),display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:p.cl,flexShrink:0}}>{p.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:C.w,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
                <div style={{fontSize:10,color:stCl,fontWeight:600}}>{{ok:"Verificado",warning:"Revisar",missing:"Ausente",unknown:"Clic para marcar"}[st]}</div>
              </div>
              <div style={{width:10,height:10,borderRadius:5,background:stCl,flexShrink:0}}/>
            </div>;
          })}
        </div>
      </div>)}
    </div>}

    {tab==="analysis"&&<div>
      {totalAudited>=3&&<Crd sx={{marginBottom:20}}>
        <h4 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 16px"}}>Dashboard de presencia</h4>
        <div style={{display:"flex",gap:24,flexWrap:"wrap",alignItems:"center",justifyContent:"center"}}>
          <ProgressRing score={score} max={100} size={100} label="Score Global" sublabel={score>=70?"Bueno":score>=40?"Mejorable":"Critico"}/>
          <ProgressRing score={napScore} max={100} size={80} color={C.blue} label="Datos NAP" sublabel={napFilled+"/"+napTotal+" campos"}/>
          <ProgressRing score={countBy("ok")} max={plats.length} size={80} color={C.green} label="Verificadas" sublabel={countBy("ok")+" de "+plats.length}/>
          <RadarScore size={180} items={cats.map(cat=>{
            const catPlats=plats.filter(p=>p.cat===cat);
            const catOk=catPlats.filter(p=>(statuses[p.id]||"unknown")==="ok").length;
            const catWarn=catPlats.filter(p=>(statuses[p.id]||"unknown")==="warning").length;
            return{label:cat.split(" ")[0],score:catOk*10+catWarn*5,max:catPlats.length*10};
          })}/>
        </div>
      </Crd>}

      <Crd sx={{marginBottom:20}}>
        <h4 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 12px"}}>Tipo de análisis</h4>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8,marginBottom:16}}>
          {modeOpts.map(m=><button key={m.id} onClick={()=>setMode(m.id)} style={{
            padding:"10px 14px",borderRadius:8,border:"1px solid "+(mode===m.id?C.cyan:C.bd),
            background:mode===m.id?bg8(C.cyan):C.sf2,color:mode===m.id?C.cyan:C.tx,
            fontFamily:font,fontSize:12,fontWeight:600,cursor:"pointer",textAlign:"left"
          }}>{m.lb}{m.id==="websearch"?" (busca en Internet)":""}</button>)}
        </div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
          {mode==="websearch"?<Btn primary disabled={!nm||!ci} color={C.teal} onClick={()=>
            aiSearch("Eres un investigador de presencia digital. Busca en Internet informacion REAL sobre este negocio. Usa web_search para buscar el nombre del negocio, su web, resenas, perfiles en redes sociales, directorios y menciones. Analiza los resultados encontrados y genera un informe basado en datos REALES, no estimaciones. Si encuentras el negocio en alguna plataforma, indica la URL exacta. Si no lo encuentras, indica que no aparece. Responde en espanol de Espana.",
            buildPrompt(),sO,sL,nR,ci||"Espana",setPhase)
          }>Buscar en Internet</Btn>
          :<Btn primary disabled={!nm||!ci} color={C.cyan} onClick={()=>
            ai("Eres un auditor senior de presencia digital para negocios locales en Espana, especializado en el ecosistema BeeDigital/Scan de presencia. Tu experiencia cubre Google Business Profile, directorios locales, navegadores GPS, asistentes de voz y SEO local. Generas informes detallados, accionables y priorizados. Cada recomendacion incluye URL de acceso, pasos concretos y tiempo estimado. Nunca inventes datos: si algo no se puede verificar, indicalo con [VERIFICAR]. Responde siempre en espanol de Espana.",
            buildPrompt(),sO,sL,nR,ci||"Espana")
          }>Ejecutar Scan {modeOpts.find(m=>m.id===mode)?.lb}</Btn>}
          {totalAudited>0&&<span style={{fontSize:12,color:C.tx}}>{totalAudited} plataformas verificadas - Score: <span style={{color:scoreCl,fontWeight:700}}>{score}/100</span></span>}
          {totalAudited===0&&<span style={{fontSize:12,color:C.txD}}>Marca las plataformas en la pestaña 2 para un análisis mas preciso</span>}
        </div>
      </Crd>
      {mode==="websearch"?<OutSearch content={o} loading={l} label="Análisis con búsqueda web real" phase={phase}/>
      :<Out content={o} loading={l} label={"Informe - "+modeOpts.find(m=>m.id===mode)?.lb}/>}
    </div>}
  </div>;
}

/* ══════ PLATFORM EXPANSION ══════ */
function Expansion(){
  const[nm,sNm]=useState("");const[ci,sCi]=useState("");const[pv,sPv]=useState("");const[ni,sNi]=useState("");const[cni,sCni]=useState("");
  const[dir,sDir]=useState("");const[tel,sTel]=useState("");const[web,sWeb]=useState("");const[desc,sDesc]=useState("");
  const[cats,setCats]=useState(["Buscadores","Mapas","Redes Sociales"]);
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);
  const allCats=[...new Set(PLATFORM_DB.map(p=>p.cat))];
  const toggleCat=(cat)=>{setCats(cats.includes(cat)?cats.filter(c=>c!==cat):[...cats,cat]);};
  const selectedPlats=PLATFORM_DB.filter(p=>cats.includes(p.cat)).filter(p=>!p.healthOnly||isHealthNiche(ni));

  return <div>
    <div style={{marginBottom:20}}>
      <h3 style={{fontSize:18,fontWeight:700,color:C.w,margin:"0 0 4px"}}>Expansión en Plataformas Digitales</h3>
      <p style={{fontSize:13,color:C.tx,margin:0}}>Guía paso a paso con URLs, datos exactos y textos listos para copiar</p>
    </div>
    <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
      <div style={{flex:"0 0 380px",maxWidth:"100%"}}>
        <Crd>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
            <Fld label="Nombre del negocio *"><Inp value={nm} onChange={sNm} ph="Nombre exacto"/></Fld>
            <Fld label="Ciudad *"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
            <Fld label="Provincia"><Inp value={pv} onChange={sPv} ph="Alicante"/></Fld>
            <Fld label="Dirección"><Inp value={dir} onChange={sDir} ph="C/ Mayor 15, 03001"/></Fld>
            <Fld label="Teléfono"><Inp value={tel} onChange={sTel} ph="+34 600 000 000"/></Fld>
            <Fld label="Web"><Inp value={web} onChange={sWeb} ph="www.ejemplo.es"/></Fld>
            <Fld label="Descripción del negocio (2-3 líneas)"><Txa value={desc} onChange={sDesc} ph="Describe brevemente qué ofrece tu negocio..." rows={3}/></Fld>

            <Fld label="Categorías de plataformas">
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {allCats.map(cat=><button key={cat} onClick={()=>toggleCat(cat)} style={{
                  fontSize:11,padding:"5px 10px",borderRadius:6,border:"1px solid "+(cats.includes(cat)?C.blue:C.bd),
                  background:cats.includes(cat)?bg8(C.blue):"transparent",color:cats.includes(cat)?C.blue:C.txD,
                  cursor:"pointer",fontFamily:font,fontWeight:600
                }}>{cat} ({PLATFORM_DB.filter(p=>p.cat===cat).length})</button>)}
              </div>
            </Fld>
            <p style={{fontSize:11,color:C.txD}}>{selectedPlats.length} plataformas seleccionadas</p>
            <Btn primary disabled={!nm||!ci||!ni} color={C.blue} onClick={()=>
              ai("Eres un especialista en local listings y expansion digital para negocios locales en Espana. Generas guias paso a paso CONCRETAS con URLs reales de acceso, pasos exactos, textos listos para copiar y pegar, y categorias recomendadas. Cada instruccion debe ser tan precisa que alguien sin experiencia pueda ejecutarla. Incluye capturas de pantalla mentales (describe que vera el usuario en cada paso). Responde en espanol de Espana.",
              `GUIA DE EXPANSION DIGITAL para: "${nm}" en ${ci}${pv?", "+pv:""}.
Sector: ${nR}.
Direccion: ${dir||"[COMPLETAR]"}
Telefono: ${tel||"[COMPLETAR]"}
Web: ${web||"[COMPLETAR]"}
Descripcion del negocio: ${desc||"[COMPLETAR]"}

Plataformas a cubrir (genera guia COMPLETA para cada una):
${selectedPlats.map(p=>"- "+p.name+" ("+p.cat+")").join("\n")}

Para CADA PLATAFORMA genera TODA esta informacion:

A) ACCESO Y ALTA
- URL EXACTA de acceso (la URL real, no inventada)
- Requisitos previos (cuenta Google, Facebook, etc.)
- Pasos numerados del 1 al N para crear/reclamar la ficha
- Que vera el usuario en cada paso (descripcion visual)
- Metodo de verificacion (postal, telefono, email, instantanea)
- Tiempo estimado total del proceso

B) DATOS A INTRODUCIR
- Nombre: "${nm}" (formato exacto)
- Categoria principal recomendada para ${nR} (la mas especifica disponible)
- Categorias secundarias recomendadas (2-3)
- Direccion en formato correcto de la plataforma
- Telefono en formato correcto
- Web
- Horario: formato especifico de la plataforma

C) DESCRIPCION OPTIMIZADA
- Texto de descripcion listo para copiar (adaptado a la longitud maxima de cada plataforma)
- Con keywords geo-locales integradas naturalmente
- Tono profesional adaptado al sector ${nR}
- Para Google: 750 caracteres max con "${nR} en ${ci}" integrado
- Para Facebook: descripcion corta + descripcion larga
- Para Instagram: bio de 150 caracteres con CTA

D) FOTOS RECOMENDADAS
- Lista de fotos que subir a cada plataforma
- Especificaciones (tamano, formato, tipo: exterior, interior, equipo, servicios)
- Nombres de archivo con keywords geo (ej: "${nR}-${ci}-fachada.jpg")

E) PRIMERAS ACCIONES POST-ALTA
- Que hacer en las primeras 24-48 horas
- Primera publicacion o actualizacion
- Solicitar primeras resenas

F) OPTIMIZACIONES AVANZADAS
- Atributos o campos extra a completar
- Servicios o productos a listar
- FAQ a anadir si la plataforma lo permite
- Publicaciones o posts iniciales

Al final, genera:

RESUMEN EXPRESS: Tabla con todas las plataformas, URL de acceso, tiempo estimado y prioridad
CHECKLIST DE SEGUIMIENTO: Lista de verificacion para marcar cada plataforma completada
MANTENIMIENTO: Que revisar cada semana/mes en cada plataforma`,sO,sL,nR,ci||"Espana")
            }>Generar Guía de Expansión</Btn>
          </div>
        </Crd>
      </div>
      <div style={{flex:1,minWidth:300}}><Out content={o} loading={l} label="Guía de Expansión"/></div>
    </div>
  </div>;
}

/* ══════ NAP CITATIONS AUDIT ══════ */
function CitationsAudit(){
  const[nm,sNm]=useState("");const[dir,sDir]=useState("");const[tel,sTel]=useState("");const[web,sWeb]=useState("");
  const[ci,sCi]=useState("");const[ni,sNi]=useState("");const[cni,sCni]=useState("");
  const[varNombre,sVarNombre]=useState("");const[varDir,sVarDir]=useState("");const[varTel,sVarTel]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);
  return <Tool title="Auditoría NAP / Citations" subtitle="Verifica la consistencia de tus datos en todas las plataformas y detecta errores que penalizan tu SEO local" out={o} ld={l} label="Informe NAP" btnTxt="Auditar Consistencia NAP" btnCl={C.gold} ok={nm&&ci} onGen={()=>
    ai("Eres un experto en SEO local y consistencia NAP (Name, Address, Phone) para negocios en Espana. La consistencia NAP representa aproximadamente el 16% de los factores de ranking en el pack local de Google. Tu trabajo es auditar los datos del negocio, detectar variaciones problematicas y generar un plan de correccion con los datos EXACTOS que deben usarse en cada plataforma. Eres meticuloso con los formatos: abreviaturas, prefijos telefonicos, formato de CP, uso de tildes, etc.",
    `AUDITORIA DE CONSISTENCIA NAP (Name, Address, Phone)

DATOS OFICIALES DEL NEGOCIO:
Nombre oficial: "${nm}"
Direccion oficial: "${dir||"[COMPLETAR]"}"
Ciudad: ${ci}
Telefono oficial: "${tel||"[COMPLETAR]"}"
Web oficial: "${web||"[COMPLETAR]"}"
Sector: ${nR}

VARIACIONES DETECTADAS POR EL USUARIO:
Variaciones del nombre encontradas: ${varNombre||"No especificadas (analizar las mas comunes)"}
Variaciones de direccion encontradas: ${varDir||"No especificadas"}
Variaciones de telefono encontradas: ${varTel||"No especificadas"}

GENERA UNA AUDITORIA NAP COMPLETA:

1. ANALISIS DEL NOMBRE
- Nombre oficial correcto: "${nm}"
- Variaciones PROBLEMATICAS comunes para negocios del sector ${nR}:
  * Con/sin "S.L.", "S.L.U.", "S.A."
  * Con/sin tildes o caracteres especiales
  * Abreviaciones (Dr. vs Doctor, Dra. vs Doctora)
  * Con/sin nombre del profesional
  * Con/sin "Clinica", "Centro", "Consultorio"
- Formato UNICO recomendado que debe usarse EN TODAS las plataformas
- Regla de Google para nombres de negocio (no meter keywords)

2. ANALISIS DE LA DIRECCION
- Direccion oficial formateada correctamente
- Variaciones PROBLEMATICAS:
  * "C/" vs "Calle" vs "c/" vs "Cl."
  * "Av." vs "Avenida" vs "Avda."
  * "1o" vs "1" vs "primero" vs "1er"
  * Con/sin codigo postal
  * Con/sin ciudad
  * Con/sin provincia
- Formato UNICO recomendado para TODAS las plataformas
- Formato especifico Google (que acepta y que no)

3. ANALISIS DEL TELEFONO
- Telefono oficial formateado
- Variaciones PROBLEMATICAS:
  * "+34" vs "0034" vs "34" vs sin prefijo
  * Con/sin espacios: "600000000" vs "600 000 000" vs "600 00 00 00"
  * Fijo vs movil vs ambos
  * Segundo telefono que puede confundir
- Formato UNICO recomendado

4. ANALISIS WEB
- URL oficial
- Variaciones: con/sin www, con/sin barra final, http vs https
- URL canonica que debe usarse siempre

5. IMPACTO EN SEO LOCAL
- Que porcentaje del ranking local depende de NAP consistency (dato real)
- Como Google cruza datos entre plataformas
- Penalizaciones por inconsistencia
- Tiempo que tarda Google en actualizar datos corregidos

6. CHECKLIST DE CORRECCION POR PLATAFORMA
Para cada plataforma principal (Google Business, Google Maps, Bing, Apple Maps, Facebook, Instagram, Paginas Amarillas, Doctoralia si salud):
- Dato actual probable (basado en errores comunes)
- Dato CORRECTO a introducir (listo para copiar)
- URL de acceso para editar
- Pasos para modificar

7. HERRAMIENTAS DE VERIFICACION
- BrightLocal Citation Tracker: que es, como usarlo
- Moz Local: que es, como usarlo, precio
- Whitespark: que es, como usarlo
- Yext: que es, como usarlo
- Busquedas manuales recomendadas en Google para detectar duplicados

8. PROTOCOLO DE MANTENIMIENTO
- Frecuencia de verificacion (cada 3 meses minimo)
- Que hacer cuando cambia un dato (nuevo telefono, mudanza)
- Orden de actualizacion (Google primero, luego resto)
- Registro de plataformas donde esta presente`,sO,sL,nR,ci||"Espana")}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
      <Fld label="Nombre oficial *"><Inp value={nm} onChange={sNm} ph="Nombre exacto del negocio"/></Fld>
      <Fld label="Dirección oficial"><Inp value={dir} onChange={sDir} ph="C/ Mayor 15, 1o, 03001 Alicante"/></Fld>
      <Fld label="Ciudad *"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
      <Fld label="Teléfono oficial"><Inp value={tel} onChange={sTel} ph="+34 600 000 000"/></Fld>
      <Fld label="Web oficial"><Inp value={web} onChange={sWeb} ph="https://www.ejemplo.es"/></Fld>
      <Fld label="Variaciones de nombre encontradas"><Txa value={varNombre} onChange={sVarNombre} ph='Ej: "Clinica Dr Martinez", "Clínica Doctor Martínez SL", "Dr. Martinez Alicante"...' rows={2}/></Fld>
      <Fld label="Variaciones de dirección encontradas"><Txa value={varDir} onChange={sVarDir} ph='Ej: "C/ Mayor 15", "Calle Mayor, 15, 1o", "Mayor 15 1 piso"...' rows={2}/></Fld>
      <Fld label="Variaciones de teléfono encontradas"><Txa value={varTel} onChange={sVarTel} ph='Ej: "600000000", "+34 600 000 000", "966 000 000"...' rows={2}/></Fld>
    </>}/>;
}

/* ══════ REPUTATION & REVIEWS ══════ */
function Reputation(){
  const[nm,sNm]=useState("");const[ni,sNi]=useState("");const[cni,sCni]=useState("");
  const[ci,sCi]=useState("");const[tab,setTab]=useState("diag");
  const[numRes,sNumRes]=useState("");const[nota,sNota]=useState("");const[tasa,sTasa]=useState("");
  const[compRes,sCompRes]=useState("");const[compNota,sCompNota]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const[phase,setPhase]=useState(null);
  const nR=resolveNiche(ni,cni);

  const diagPrompt=`DIAGNOSTICO COMPLETO DE REPUTACION ONLINE para: ${nm} en ${ci||"[ciudad]"}.
Sector: ${nR}.
Resenas Google actuales: ${numRes||"[VERIFICAR]"}
Nota media Google: ${nota||"[VERIFICAR]"}
Tasa respuesta actual: ${tasa||"[VERIFICAR]"}
Competencia (resenas/nota): ${compRes||"[VERIFICAR]"} resenas / ${compNota||"[VERIFICAR]"} nota

GENERA UN DIAGNOSTICO EXHAUSTIVO:

1. ESTADO ACTUAL DE REPUTACION
- Puntuacion de reputacion online (/100) basada en datos
- Nota media vs benchmark del sector ${nR} en Espana
- Volumen de resenas vs lo esperado para el sector
- Tasa de respuesta vs la recomendada (100%)
- Velocidad de obtencion de resenas (ritmo mensual estimado)
- Sentimiento general estimado (positivo/neutro/negativo)
- Comparativa con competencia local

2. ANALISIS DE FORTALEZAS Y DEBILIDADES
- Que aspectos probablemente destacan en las resenas positivas
- Que aspectos generan resenas negativas en el sector ${nR}
- Oportunidades de mejora basadas en el perfil del sector
- Riesgos reputacionales especificos del sector

3. PRESENCIA DE RESENAS POR PLATAFORMA
- Google Business Profile: estado principal
- Facebook: presencia de valoraciones
- Doctoralia / Top Doctors (si salud)
- TripAdvisor, Yelp (si aplica)
- Paginas Amarillas
- Para cada una: importancia para el sector, estado probable, accion

4. BENCHMARK DEL SECTOR
- Nota media tipica en ${nR} en ${ci||"Espana"}
- Volumen medio de resenas de competidores
- Tasa de respuesta media del sector
- Que diferencia a los negocios mejor valorados

5. ANALISIS DE PATRONES
- Patrones comunes en resenas negativas del sector ${nR}
- Palabras clave que aparecen en resenas positivas
- Momentos criticos que generan resenas (post-servicio, espera, precio)
- Estacionalidad de resenas en el sector

6. PROYECCION Y OBJETIVOS
- Objetivo de nota media a 6 meses (realista)
- Objetivo de volumen de resenas mensual
- Tiempo estimado para alcanzar X nota con Y resenas nuevas
- Impacto estimado en ranking local de Google`;

  const solicitudPrompt=`SISTEMA COMPLETO DE SOLICITUD DE RESENAS para: ${nm} en ${ci||"[ciudad]"}.
Sector: ${nR}.

GENERA TODO ESTO LISTO PARA USAR:

1. ENLACE DIRECTO DE RESENA GOOGLE
- Pasos EXACTOS para generar el enlace corto de resena:
  a) Buscar el negocio en Google Maps
  b) Obtener el Place ID (explicar como)
  c) Construir URL: https://search.google.com/local/writereview?placeid=[ID]
  d) Alternativa: desde Google Business Profile > Compartir > Pedir resenas
  e) Acortador recomendado (Bitly, rebrandly)
- Ejemplo de URL final lista para usar

2. MENSAJES DE SOLICITUD (TODOS listos para copiar)

a) WhatsApp (3 variantes):
VARIANTE PROFESIONAL:
[texto completo, max 120 palabras, con enlace, tono profesional]

VARIANTE CERCANA:
[texto completo, max 100 palabras, con enlace, tono calido]

VARIANTE BREVE:
[texto completo, max 50 palabras, con enlace, directo]

b) Email (2 variantes):
ASUNTO 1: [asunto optimizado]
CUERPO: [email completo, profesional, con enlace y boton visual sugerido]

ASUNTO 2: [asunto alternativo]
CUERPO: [variante mas personal]

c) SMS (2 variantes):
[mensaje corto max 160 caracteres con enlace]
[variante]

3. PROTOCOLO PRESENCIAL (EN CENTRO)

a) GUION PARA RECEPCION
- Frase exacta que dice la recepcionista tras un servicio satisfactorio
- 3 variantes segun contexto (post-consulta, post-tratamiento, revision)
- Cuando NO pedirlo (cliente insatisfecho, con prisa, primera visita)

b) MATERIALES FISICOS
- Texto para tarjeta con QR (diseno sugerido, texto exacto, tamano)
- Texto para cartel en recepcion
- Texto para pegatina en mostrador
- Texto para marco de foto Instagram con QR

4. AUTOMATIZACION
- Secuencia automatica recomendada:
  * T+2h tras servicio: mensaje de agradecimiento (texto exacto)
  * T+24h: solicitud de resena (texto exacto)
  * T+7d: si no dejo resena, recordatorio suave (texto exacto)
- Herramientas para automatizar:
  * WhatsApp Business (automatizacion nativa)
  * Google Forms + email automatico
  * CRM con secuencias (recomendar opciones)
  * Plataformas especializadas (GatherUp, Podium, BirdEye)

5. TIMING OPTIMO
- Momento ideal para pedir resena tras cada tipo de servicio
- Dia y hora con mayor tasa de respuesta
- Cuanto esperar entre el servicio y la solicitud
- Frecuencia maxima de solicitudes a un mismo cliente

6. METRICAS Y SEGUIMIENTO
- Tasa de conversion objetivo (solicitudes vs resenas obtenidas)
- Tracking: como saber cuantas solicitudes envias vs cuantas convierten
- KPI mensual: nuevas resenas / mes
- Dashboard sencillo de seguimiento

7. CUMPLIMIENTO LEGAL Y GOOGLE
- Politica de Google sobre solicitud de resenas (que se puede y que NO)
- LOPD/RGPD: consentimiento para enviar solicitudes
- Prohibido: ofrecer descuentos, incentivos, o filtrar solo clientes satisfechos
- Permitido: pedir a todos por igual, facilitar el enlace, recordar
- Texto de consentimiento LOPD para solicitudes por email/WhatsApp`;

  const monitorPrompt=`PLAN DE MONITORIZACION DE REPUTACION ONLINE para: ${nm} en ${ci||"[ciudad]"}.
Sector: ${nR}.

1. ALERTAS Y NOTIFICACIONES
- Como configurar alertas de Google para nuevas resenas
- Notificaciones de Google Business Profile (como activarlas)
- Alertas de Facebook para nuevas valoraciones
- Google Alerts para menciones del negocio online
- Herramientas de monitorizacion avanzada (Mention, Brand24, Reputology)

2. PROTOCOLO DE RESPUESTA
Tiempos de respuesta:
- Resena positiva: max 24 horas
- Resena negativa: max 12 horas (antes si es posible)
- Resena neutra: max 24 horas

Para resenas POSITIVAS (5 variantes listas para copiar):
[5 respuestas diferentes, personalizables, profesionales, que refuercen la marca]

Para resenas NEGATIVAS (protocolo completo):
a) Paso 1: Leer con calma, no reaccionar en caliente
b) Paso 2: Verificar internamente que ocurrio
c) Paso 3: Respuesta publica (3 plantillas segun tipo: espera, precio, resultado)
d) Paso 4: Contacto privado (texto exacto de email/llamada)
e) Paso 5: Seguimiento y resolucion
f) Paso 6: Solicitar actualizacion de resena si se resolvio

Para resenas FALSAS o INJUSTAS:
- Criterios para identificar resena falsa
- Proceso de reporte a Google paso a paso
- Que hacer mientras se procesa el reporte
- Respuesta publica mientras tanto

3. INFORME MENSUAL DE REPUTACION
Plantilla de informe con:
- Resenas nuevas del mes (positivas, negativas, neutras)
- Nota media evolucion
- Tasa de respuesta
- Sentimiento general
- Temas recurrentes
- Acciones del mes siguiente

4. AREA PRIVADA / DASHBOARD DEL NEGOCIO
Estructura recomendada para gestionar todo desde un solo sitio:
- Resenas pendientes de respuesta (todas las plataformas)
- Estadisticas de reputacion en tiempo real
- Consistencia de datos NAP
- Calendario de publicaciones GBP
- Enlace rapido de solicitud de resenas
- Historico de notas y volumen
- Comparativa con competencia
- Herramientas recomendadas para implementar este dashboard

5. GESTION DE CRISIS REPUTACIONAL
- Que hacer si llegan varias resenas negativas seguidas
- Protocolo de comunicacion interna
- Cuando responder publicamente vs en privado
- Cuando involucrar al profesional vs recepcion
- Plan de recuperacion post-crisis`;

  return <div>
    <div style={{marginBottom:20}}>
      <h3 style={{fontSize:18,fontWeight:700,color:C.w,margin:"0 0 4px"}}>Gestión de Reputación y Reseñas</h3>
      <p style={{fontSize:13,color:C.tx,margin:0}}>Diagnóstico, solicitud de reseñas, templates de respuesta y monitorización continua</p>
    </div>

    <Crd sx={{marginBottom:20}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:16}}>
        <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
        <Fld label="Centro *"><Inp value={nm} onChange={sNm} ph="Nombre del negocio"/></Fld>
        <Fld label="Ciudad"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12}}>
        <Fld label="N. reseñas Google"><Inp value={numRes} onChange={sNumRes} ph="47"/></Fld>
        <Fld label="Nota media"><Inp value={nota} onChange={sNota} ph="4.6"/></Fld>
        <Fld label="% respuestas"><Inp value={tasa} onChange={sTasa} ph="80%"/></Fld>
        <Fld label="Reseñas competencia"><Inp value={compRes} onChange={sCompRes} ph="120"/></Fld>
        <Fld label="Nota competencia"><Inp value={compNota} onChange={sCompNota} ph="4.3"/></Fld>
      </div>
    </Crd>

    <Tab tabs={[{id:"diag",lb:"Diagnóstico"},{id:"diagweb",lb:"Diagnóstico Web (busca)"},{id:"solicitud",lb:"Solicitar Reseñas"},{id:"monitor",lb:"Monitorización"}]} active={tab} onChange={setTab}/>

    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
      {tab==="diagweb"?<Btn primary disabled={!nm||!ni} color={C.teal} onClick={()=>{
        aiSearch("Eres un investigador de reputacion online. Usa web_search para buscar resenas REALES del negocio en Google, Facebook, Doctoralia y otras plataformas. Analiza lo que encuentres y genera un diagnostico basado en datos REALES. Si no encuentras resenas en una plataforma, indicalo. Responde en espanol de Espana.",
        `DIAGNOSTICO DE REPUTACION CON BUSQUEDA WEB REAL para: "${nm}" en ${ci||"[ciudad]"}.
Sector: ${nR}.

INSTRUCCIONES DE BUSQUEDA:
1. Busca "${nm}" resenas para encontrar resenas reales
2. Busca "${nm}" opiniones
3. Busca "${nm} ${ci}" en Google para ver el perfil de negocio
4. Busca "${nm}" en Doctoralia si es sector salud (${nR})
5. Busca "${nR} en ${ci}" resenas para comparar con competencia

BASANDOTE EN LO QUE ENCUENTRES, genera:

1. ESTADO REAL DE REPUTACION
- Resenas REALES encontradas por plataforma (numero, nota)
- Resenas recientes: contenido resumido sin copiar texto literal
- Temas que se repiten en resenas positivas
- Temas que se repiten en negativas
- Resenas sin responder detectadas

2. COMPARATIVA CON COMPETENCIA
- Competidores encontrados en la misma busqueda
- Sus notas y numero de resenas
- Posicion relativa de ${nm}

3. SENTIMIENTO Y PATRONES
- Analisis del sentimiento general basado en lo leido
- Palabras o temas mas mencionados
- Aspectos mejor valorados por los clientes
- Aspectos peor valorados

4. PLAN DE ACCION BASADO EN HALLAZGOS REALES
- Acciones especificas derivadas de las resenas encontradas
- Prioridades basadas en los problemas detectados
- Oportunidades basadas en lo que valoran los clientes`,sO,sL,nR,ci||"Espana",setPhase);
      }}>Buscar reseñas reales en Internet</Btn>
      :<Btn primary disabled={!nm||!ni} color={tab==="diag"?C.cyan:tab==="solicitud"?C.green:C.orange} onClick={()=>{
        const prompt=tab==="diag"?diagPrompt:tab==="solicitud"?solicitudPrompt:monitorPrompt;
        const sys=tab==="diag"?"Eres un analista de reputacion online para negocios locales en Espana. Diagnosticos basados en datos reales del sector, comparativas con benchmark y recomendaciones accionables."
          :tab==="solicitud"?"Eres un especialista en generacion de resenas para negocios locales. Creas sistemas completos de solicitud que cumplen con las politicas de Google y la LOPD/RGPD. Cada texto que generes debe estar LISTO PARA COPIAR Y USAR, no ser un esquema o ejemplo."
          :"Eres un consultor de monitorizacion y gestion de reputacion online. Creas protocolos de respuesta, alertas y dashboards para que los negocios gestionen su reputacion de forma proactiva.";
        ai(sys,prompt,sO,sL,nR,ci||"Espana");
      }}>{{diag:"Generar Diagnóstico",solicitud:"Generar Sistema de Solicitud",monitor:"Generar Plan de Monitorización"}[tab]}</Btn>}
    </div>
    {tab==="diagweb"?<OutSearch content={o} loading={l} label="Diagnóstico con datos reales" phase={phase}/>
    :<Out content={o} loading={l} label={{diag:"Diagnóstico de Reputación",solicitud:"Sistema de Solicitud de Reseñas",monitor:"Plan de Monitorización"}[tab]}/>}
  </div>;
}

/* ══════ VOICE SEO / ASSISTANTS ══════ */
function VoiceSeo(){
  const[nm,sNm]=useState("");const[ci,sCi]=useState("");const[ni,sNi]=useState("");const[cni,sCni]=useState("");
  const[svcs,sSvcs]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);
  return <Tool title="SEO para Búsquedas por Voz" subtitle="Optimiza tu negocio para Google Assistant, Siri, Alexa y búsquedas 'cerca de mí'" out={o} ld={l} label="Guía Voice SEO" btnTxt="Generar Estrategia Voice SEO" btnCl={C.purple} ok={nm&&ci&&ni} onGen={()=>
    ai("Eres un especialista en Voice Search Optimization para negocios locales en Espana. Conoces en profundidad como Google Assistant, Siri y Alexa seleccionan negocios locales para responder consultas de voz. Tu trabajo es generar una estrategia completa para que el negocio sea la respuesta predeterminada a consultas de voz en su zona.",
    `ESTRATEGIA DE SEO PARA BUSQUEDAS POR VOZ

Negocio: ${nm}
Ciudad: ${ci}
Sector: ${nR}
Servicios principales: ${svcs||"[Los propios del sector "+nR+"]"}

1. CONSULTAS DE VOZ MAS PROBABLES
Lista de 20+ consultas de voz que los usuarios hacen a sus asistentes sobre ${nR} en ${ci}:
- "Oye Google, busca un ${nR} cerca de mi"
- "Siri, cual es el mejor ${nR} en ${ci}"
- "Alexa, que horario tiene ${nm}"
- [15+ consultas adicionales especificas del sector, naturales, como habla la gente]

Para cada consulta: que asistente la procesa, de donde extrae la respuesta, como aparecer como resultado

2. FUENTES DE DATOS POR ASISTENTE
Google Assistant:
- Fuente principal: Google Business Profile
- Fuentes secundarias: web del negocio, Schema markup, resenas
- Factores de seleccion: proximidad, relevancia, prominencia, nota resenas
- Acciones CONCRETAS para optimizar (10 acciones)

Siri (Apple):
- Fuente principal: Apple Maps (Apple Business Connect)
- Fuentes secundarias: Yelp, web con Schema
- Acciones CONCRETAS (7 acciones)

Alexa (Amazon):
- Fuente principal: Bing Places, Yelp, Yext
- Acciones CONCRETAS (5 acciones)

3. CONTENIDO OPTIMIZADO PARA VOZ
- 10 preguntas FAQ en lenguaje conversacional natural
- Respuestas concisas (40-50 palabras) optimizadas para Position Zero
- Schema FAQPage completo listo para implementar
- Contenido conversacional para la web (como habla la gente, no como escribe)
- Long-tail keywords de voz vs texto (diferencias y como cubrir ambas)

4. SCHEMA MARKUP PARA VOZ
- LocalBusiness schema completo con todos los campos
- OpeningHoursSpecification
- GeoCoordinates
- AggregateRating
- FAQ schema
- Codigo JSON-LD listo para copiar e insertar en la web

5. BUSQUEDAS "CERCA DE MI"
- Como Google determina la proximidad
- Radio de visibilidad del negocio (como ampliarlo)
- Factores que mejoran la aparicion en "cerca de mi"
- Optimizaciones especificas por zona de ${ci}

6. METRICAS Y SEGUIMIENTO
- Como medir busquedas de voz (datos disponibles)
- Google Search Console: consultas tipo pregunta
- GBP insights: consultas de descubrimiento vs directas
- KPIs de voz local`,sO,sL,nR,ci||"Espana")}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
      <Fld label="Centro *"><Inp value={nm} onChange={sNm} ph="Nombre del negocio"/></Fld>
      <Fld label="Ciudad *"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
      <Fld label="Servicios principales"><Txa value={svcs} onChange={sSvcs} ph="Ej: Implantes dentales, carillas, ortodoncia..." rows={2}/></Fld>
    </>}/>;
}

/* ══════ BRAND MONITOR ══════ */
function BrandMonitor(){
  const[nm,sNm]=useState("");const[ci,sCi]=useState("");const[ni,sNi]=useState("");const[cni,sCni]=useState("");
  const[web,sWeb]=useState("");const[comp,sComp]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);
  return <Tool title="Monitor de Marca Online" subtitle="Estrategia para detectar y gestionar menciones del negocio en Internet" out={o} ld={l} label="Plan de Monitorización" btnTxt="Generar Plan de Monitorización" btnCl={C.orange} ok={nm&&ni} onGen={()=>
    ai("Eres un consultor de brand monitoring y online reputation management para negocios locales. Creas sistemas de monitorizacion completos, con alertas configuradas, protocolos de respuesta y herramientas concretas. Todo debe ser ejecutable por un equipo pequeno sin conocimientos tecnicos avanzados.",
    `PLAN DE MONITORIZACION DE MARCA ONLINE para: ${nm} en ${ci||"[ciudad]"}.
Sector: ${nR}. Web: ${web||"[No proporcionada]"}.
Competidores: ${comp||"Los principales del sector en la zona"}.

1. CONFIGURACION DE ALERTAS

Google Alerts (paso a paso):
- Alerta 1: "${nm}" (menciones directas)
- Alerta 2: "${nm}" + resena / opinion / experiencia
- Alerta 3: "${nR} ${ci||""}" (sector + ciudad)
- Alerta 4: Nombre del profesional principal
- Para cada alerta: URL de configuracion, frecuencia, idioma, region
- Formato de entrega: email diario vs tiempo real

Alertas de Google Business Profile:
- Como activar notificaciones de resenas
- Como activar notificaciones de preguntas
- Como activar notificaciones de cambios en la ficha

Alertas en redes sociales:
- Menciones en Instagram (configuracion de notificaciones)
- Menciones en Facebook (configuracion)
- Busquedas de hashtags propios y del sector

2. MONITORIZACION DE RESENAS (todas las plataformas)
- Google Business: frecuencia de revision, como responder
- Facebook: activar valoraciones, como gestionarlas
- Doctoralia / Top Doctors (si salud): revision semanal
- Paginas Amarillas: verificar existencia de valoraciones
- Yelp: verificar ficha
- Foros del sector: cuales monitorizar, como buscar

3. MONITORIZACION DE COMPETENCIA
Para cada competidor principal:
- Resenas nuevas (que dicen sus clientes, que podemos aprender)
- Contenido publicado (que funciona, que copiar)
- Posicionamiento en Google Maps
- Cambios en web o perfiles
- Herramientas: Google Alerts, Social Blade, SimilarWeb

4. DETECCION DE CONTENIDO NEGATIVO
- Como buscar contenido negativo sobre el negocio en Google
- Busquedas recomendadas: "${nm} opiniones", "${nm} quejas", "${nm} problemas"
- Foros y webs de quejas a monitorizar
- Protocolo si se detecta contenido negativo
- Derecho al olvido (cuando aplica, como ejercerlo)

5. HERRAMIENTAS RECOMENDADAS
Gratuitas:
- Google Alerts (menciones)
- Google Business Profile (resenas)
- Social Search (menciones redes)
- Talkwalker Alerts (alternativa a Google Alerts)

De pago (para cuando el negocio crezca):
- Mention (desde X EUR/mes): que ofrece, para quien
- Brand24: que ofrece, para quien
- Reputology: especifico para resenas
- ReviewTrackers: gestion multi-plataforma

6. PROTOCOLO DE RESPUESTA A MENCIONES
- Mencion positiva: agradecer + compartir si procede
- Mencion neutra: valorar si requiere accion
- Mencion negativa: protocolo paso a paso, tiempos, quien responde
- Mencion falsa o difamatoria: pasos legales en Espana

7. INFORME MENSUAL DE MARCA
Template con:
- Menciones del mes (positivas, neutras, negativas)
- Nuevas resenas por plataforma
- Evolucion de nota media
- Contenido generado por usuarios
- Acciones de competidores relevantes
- Acciones recomendadas para el mes siguiente

8. CALENDARIO DE REVISION
- Diario: resenas Google (5 minutos)
- Semanal: resenas todas las plataformas + menciones (15 min)
- Mensual: informe completo + analisis competencia (1 hora)
- Trimestral: revision de estrategia y objetivos`,sO,sL,nR,ci||"Espana")}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
      <Fld label="Centro *"><Inp value={nm} onChange={sNm} ph="Nombre del negocio"/></Fld>
      <Fld label="Ciudad"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
      <Fld label="Web"><Inp value={web} onChange={sWeb} ph="www.ejemplo.es"/></Fld>
      <Fld label="Competidores principales"><Txa value={comp} onChange={sComp} ph="Nombres de competidores directos..." rows={2}/></Fld>
    </>}/>;
}

/* ══════ IMAGE PROMPT GENERATOR ══════ */
function ImagePrompt(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");
  const[idea,sIdea]=useState("");const[goal,sGoal]=useState("Post de Instagram");
  const[platform,setPlatform]=useState("Midjourney");const[style,setStyle]=useState("Fotografía profesional");
  const[mood,setMood]=useState("Profesional y limpio");const[aspect,setAspect]=useState("1:1 (cuadrado)");
  const[colors,setColors]=useState("");const[elements,setElements]=useState("");
  const[nm,sNm]=useState("");const[avoid,setAvoid]=useState("");
  const[numPrompts,setNumPrompts]=useState("4");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);

  const platforms=[
    {id:"Midjourney",desc:"Prompts en ingles con parametros --ar, --v, --style, --q"},
    {id:"DALL-E 3 (ChatGPT)",desc:"Prompts descriptivos en natural language, detallados"},
    {id:"Stable Diffusion",desc:"Prompts con pesos, negative prompts, steps, CFG"},
    {id:"Ideogram",desc:"Prompts con texto integrado en la imagen, tipografia"},
    {id:"Leonardo AI",desc:"Prompts con preset styles, alchemy, photoreal"},
    {id:"Canva IA (Magic Media)",desc:"Prompts simples y directos, estilos predefinidos"},
    {id:"Adobe Firefly",desc:"Prompts con content type, style reference, effects"},
    {id:"Flux",desc:"Prompts descriptivos, alta fidelidad fotografica"},
    {id:"Todos (multi-plataforma)",desc:"Genera prompts adaptados para cada plataforma"},
  ];
  const goals=["Post de Instagram","Post de Facebook","Historia/Story","Portada web hero","Banner publicitario","Antes y despues","Foto del equipo/profesional","Foto de instalaciones","Infografia","Logotipo o icono","Testimonio visual","Tarjeta de presentacion","Cartel para el centro","Imagen de blog/articulo","Comparativa visual"];
  const styles=["Fotografía profesional","Fotografía lifestyle","Fotografía clínica/médica","Ilustración moderna","Ilustración flat design","3D render","Minimalista","Cinematográfico","Editorial/revista","Acuarela/artístico","Vectorial/corporativo","Infografía visual","Collage moderno","Neon/futurista"];
  const moods=["Profesional y limpio","Cálido y cercano","Premium y lujoso","Fresco y moderno","Sereno y relajante","Enérgico y vibrante","Elegante y sofisticado","Natural y orgánico","Confiable y seguro","Tecnológico e innovador"];
  const aspects=["1:1 (cuadrado - Instagram feed)","4:5 (vertical - Instagram feed)","9:16 (vertical - Stories/Reels)","16:9 (horizontal - web/YouTube)","3:2 (horizontal - blog)","2:3 (vertical - Pinterest)","4:3 (horizontal - presentación)"];

  return <Tool title="Generador de Prompts para Imagen IA" subtitle="Crea prompts optimizados para cada plataforma de IA generativa, adaptados a tu nicho y objetivo" out={o} ld={l} label="Prompts de Imagen" btnTxt="Generar Prompts" btnCl={C.rose} ok={ni&&idea} onGen={()=>{
    const selectedPlatform=platforms.find(p=>p.id===platform);
    ai("Eres un experto en prompt engineering para generacion de imagenes con inteligencia artificial. Dominas la sintaxis especifica de cada plataforma (Midjourney, DALL-E, Stable Diffusion, Ideogram, Leonardo, Canva AI, Adobe Firefly, Flux). Generas prompts que producen imagenes profesionales, esteticas y adaptadas al sector del negocio. Conoces los parametros tecnicos de cada plataforma y los aplicas correctamente. IMPORTANTE: los prompts para Midjourney, DALL-E, Stable Diffusion, Leonardo, Flux y Adobe Firefly deben ir EN INGLES porque las plataformas funcionan mejor en ingles. Los prompts para Canva AI pueden ir en espanol. Las explicaciones e instrucciones van en espanol de Espana.",
    `GENERACION DE PROMPTS DE IMAGEN IA

Sector/Nicho: ${nR}
Centro/Marca: ${nm||"[Negocio del sector "+nR+"]"}
Idea/Concepto: ${idea}
Objetivo/Donde se usara: ${goal}
Plataforma de IA: ${platform}
Estilo visual: ${style}
Mood/Atmosfera: ${mood}
Proporcion: ${aspect}
Colores predominantes: ${colors||"Los apropiados para el sector "+nR}
Elementos que debe incluir: ${elements||"Los relevantes para la idea"}
Elementos a evitar: ${avoid||"Texto ilegible, manos deformes, rostros distorsionados, sangre, agujas visibles (si salud)"}
Numero de variantes: ${numPrompts}

${platform==="Todos (multi-plataforma)"?`GENERA PROMPTS OPTIMIZADOS PARA CADA UNA DE ESTAS PLATAFORMAS:
- Midjourney (con parametros --ar, --v 6.1, --style, --q)
- DALL-E 3 (descripcion detallada en ingles natural)
- Stable Diffusion (con pesos, negative prompt, parametros recomendados)
- Ideogram (si incluye texto en la imagen)
- Leonardo AI (con estilo y preset recomendados)
- Canva AI (prompt simple, estilo predefinido sugerido)

Para CADA plataforma genera ${numPrompts} variantes.`
:`GENERA ${numPrompts} PROMPTS OPTIMIZADOS PARA: ${platform}
Especificaciones de la plataforma: ${selectedPlatform?.desc||""}`}

PARA CADA PROMPT GENERA:

1. PROMPT COMPLETO (listo para copiar y pegar en la plataforma)
${platform.includes("Midjourney")||platform==="Todos (multi-plataforma)"?`- Para Midjourney: prompt en ingles + parametros (--ar X:Y --v 6.1 --style raw --q 2 etc.)
  Ejemplo de formato: "Professional dental clinic interior, modern minimalist design, soft natural lighting, white and teal color palette, clean aesthetic --ar 4:5 --v 6.1 --style raw --q 2"`:``}
${platform.includes("Stable")||platform==="Todos (multi-plataforma)"?`- Para Stable Diffusion: prompt en ingles con pesos (concept:1.2) + negative prompt completo
  Ejemplo: "professional medical clinic, (modern interior:1.3), (soft lighting:1.2), clean, high quality"
  Negative: "blurry, low quality, distorted, text, watermark, nsfw"`:``}
${platform.includes("DALL")||platform==="Todos (multi-plataforma)"?`- Para DALL-E 3: descripcion detallada en ingles natural, sin parametros tecnicos
  Ejemplo: "A professional photograph of a modern dental clinic reception area with warm lighting, minimalist furniture in white and teal tones..."`:``}
${platform.includes("Canva")||platform==="Todos (multi-plataforma)"?`- Para Canva AI: prompt simple y directo, puede ser en espanol
  Ejemplo: "Foto profesional de clinica dental moderna con iluminacion calida" + estilo sugerido de Canva`:``}

2. PARAMETROS RECOMENDADOS
- Proporcion: la indicada por el usuario o la optima para el objetivo
- Calidad: maxima recomendada para la plataforma
- Seed (si aplica): para mantener consistencia
- Otros parametros especificos de la plataforma

3. VARIACIONES
- Cada variante debe cambiar un aspecto significativo (angulo, composicion, iluminacion, enfoque)
- Numerar claramente: Variante 1, 2, 3...

4. INSTRUCCIONES DE USO
- Donde escribir el prompt exactamente en la plataforma
- Configuraciones recomendadas en la interfaz
- Como iterar si el resultado no es el deseado (que modificar en el prompt)

5. NEGATIVE PROMPT (si la plataforma lo soporta)
- Lista de elementos a evitar especificos para el sector ${nR}
- Elementos tecnicos a evitar (blur, artifacts, etc.)

6. POST-PRODUCCION RECOMENDADA
- Retoques sugeridos tras generar la imagen
- Apps o herramientas para ajustar (Canva, Photoshop, Lightroom mobile)
- Formato de exportacion optimo para ${goal}

7. TIPS PARA EL SECTOR ${nR}
- Elementos visuales que generan confianza en el sector
- Errores visuales que transmiten poca profesionalidad
- Tendencias actuales de imagen en ${nR}
- Normas sobre imagenes en publicidad del sector (si es salud: no mostrar resultados irreales, no trivializar procedimientos)`,sO,sL,nR,"Espana",
    {tool:"Prompts Imagen IA",client:nm||"Sin asignar",inputs:{idea:idea,plataforma:platform,objetivo:goal,estilo:style}});
  }}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
      <Fld label="Centro / Marca"><Inp value={nm} onChange={sNm} ph="Nombre del negocio"/></Fld>
      <Fld label="Idea / Concepto de la imagen *"><Txa value={idea} onChange={sIdea} ph='Ej: "Foto de la recepcion de la clinica con ambiente calido y profesional", "Antes y despues de blanqueamiento dental", "Equipo medico en consulta sonriendo"...' rows={3}/></Fld>
      <Fld label="Objetivo / Donde se usara"><Sel value={goal} onChange={sGoal} opts={goals}/></Fld>
      <Fld label="Plataforma de IA *"><div style={{display:"flex",flexDirection:"column",gap:4}}>
        {platforms.map(p=><button key={p.id} onClick={()=>setPlatform(p.id)} style={{
          display:"flex",flexDirection:"column",gap:1,padding:"7px 10px",borderRadius:6,textAlign:"left",
          border:"1px solid "+(platform===p.id?C.rose:C.bd),background:platform===p.id?bg8(C.rose):C.sf2,
          cursor:"pointer",fontFamily:font,transition:"all 0.15s"
        }}>
          <span style={{fontSize:12,fontWeight:600,color:platform===p.id?C.rose:C.w}}>{p.id}</span>
          <span style={{fontSize:10,color:C.txD}}>{p.desc}</span>
        </button>)}
      </div></Fld>
      <Fld label="Estilo visual"><Sel value={style} onChange={setStyle} opts={styles}/></Fld>
      <Fld label="Mood / Atmósfera"><Sel value={mood} onChange={setMood} opts={moods}/></Fld>
      <Fld label="Proporción / Aspect Ratio"><Sel value={aspect} onChange={setAspect} opts={aspects}/></Fld>
      <Fld label="Colores predominantes"><Inp value={colors} onChange={setColors} ph="Ej: blanco, turquesa, madera natural"/></Fld>
      <Fld label="Elementos a incluir"><Inp value={elements} onChange={setElements} ph="Ej: planta, paciente sonriendo, luz natural"/></Fld>
      <Fld label="Elementos a evitar"><Inp value={avoid} onChange={setAvoid} ph="Ej: sangre, agujas, rostros deformados"/></Fld>
      <Fld label="Variantes"><Sel value={numPrompts} onChange={setNumPrompts} opts={["2","3","4","5","6"]}/></Fld>
    </>}/>;
}

/* ══════ DEEP INTERNET ANALYSIS (WEB SEARCH) ══════ */
function DeepAnalysis(){
  const[nm,sNm]=useState("");const[ci,sCi]=useState("");const[ni,sNi]=useState("");const[cni,sCni]=useState("");
  const[web,sWeb]=useState("");const[comp1,sComp1]=useState("");const[comp2,sComp2]=useState("");
  const[focus,setFocus]=useState("full");
  const[o,sO]=useState("");const[l,sL]=useState(false);const[phase,setPhase]=useState(null);
  const nR=resolveNiche(ni,cni);

  const focusOpts=[
    {id:"full",lb:"Análisis completo",desc:"Busca todo sobre el negocio en Internet"},
    {id:"reviews",lb:"Reseñas y opiniones",desc:"Encuentra todas las reseñas y valoraciones"},
    {id:"competitors",lb:"Competencia local",desc:"Analiza presencia de competidores vs la tuya"},
    {id:"seo",lb:"Posicionamiento SEO",desc:"Busca cómo posiciona en Google para keywords clave"},
    {id:"mentions",lb:"Menciones y prensa",desc:"Busca menciones del negocio en medios y foros"},
    {id:"gaps",lb:"Oportunidades perdidas",desc:"Detecta dónde debería estar pero no está"},
  ];

  const buildSearchPrompt=()=>{
    const base=`ANALISIS PROFUNDO DE INTERNET para: "${nm}" en ${ci}.
Sector: ${nR}. Web: ${web||"[No proporcionada]"}.
Competidores a comparar: ${comp1||"[Buscar principales]"}, ${comp2||""}.

INSTRUCCIONES: Usa la herramienta de busqueda web para investigar este negocio REAL en Internet. Busca:
1. El nombre exacto "${nm}" en Google
2. "${nm}" + "resenas" u "opiniones"
3. La web ${web||"del negocio"} si la tiene
4. Competidores del sector ${nR} en ${ci}
${comp1?'5. "'+comp1+'" para comparar':''}
${comp2?'6. "'+comp2+'" para comparar':''}

`;
    if(focus==="full") return base+`Genera un INFORME COMPLETO basado en lo que ENCUENTRES REALMENTE en Internet:

1. PRESENCIA EN GOOGLE
- Que aparece al buscar "${nm}" en Google
- Posicion estimada en resultados
- Google Business Profile: si existe, datos visibles, nota, resenas
- Google Maps: si aparece, ubicacion correcta
- Resultados que compiten por el nombre

2. PRESENCIA EN PLATAFORMAS
Para cada plataforma donde encuentres al negocio:
- URL exacta del perfil
- Datos visibles (nombre, direccion, telefono, horario)
- Resenas o valoraciones si las hay
- Nivel de completitud del perfil

Para las plataformas donde NO lo encuentres, indicar explicitamente que no aparece.

3. RESENAS Y REPUTACION
- Resenas en Google: numero, nota media, resenas recientes
- Resenas en otras plataformas (Facebook, Doctoralia, etc.)
- Temas recurrentes en resenas positivas
- Temas recurrentes en resenas negativas
- Resenas sin responder

4. PRESENCIA WEB
- Estado de la web: si existe, velocidad, contenido, SEO basico
- Contenido: que paginas tiene, si tiene blog
- SEO: title tags, meta descriptions visibles
- SSL, movil, velocidad aparente

5. REDES SOCIALES
- Perfiles encontrados (Facebook, Instagram, LinkedIn, etc.)
- Actividad reciente
- Numero de seguidores/likes
- Tipo de contenido

6. COMPETENCIA
- Principales competidores que aparecen para "${nR} en ${ci}"
- Comparativa de presencia digital
- Que hacen los competidores que ${nm} no hace
${comp1?"- Analisis especifico de "+comp1:""}
${comp2?"- Analisis especifico de "+comp2:""}

7. OPORTUNIDADES DETECTADAS
- Plataformas donde deberia estar y no esta
- Keywords sin explotar
- Contenido que falta
- Mejoras inmediatas con datos concretos

8. PLAN DE ACCION
- Top 10 acciones basadas en los hallazgos REALES
- Priorizadas por impacto`;

    if(focus==="reviews") return base+`Busca TODAS las resenas y opiniones que existan sobre "${nm}" en Internet.

Busca en: Google Business, Facebook, Doctoralia, Top Doctors, Yelp, Paginas Amarillas, foros, blogs.
Para cada plataforma donde encuentres resenas:
- Numero total de resenas
- Nota media
- Resenas mas recientes (resumidas, sin copiar textos exactos)
- Temas que se repiten
- Resenas negativas y su contenido
- Si las resenas estan respondidas o no

Analisis:
- Sentimiento general
- Fortalezas segun los clientes
- Debilidades segun los clientes
- Comparativa con competencia local
- Recomendaciones basadas en los patrones encontrados`;

    if(focus==="competitors") return base+`Busca y compara la presencia digital de los principales competidores de "${nm}" en ${ci}.

1. Busca "${nR} en ${ci}" y analiza los primeros 10 resultados
2. Para cada competidor encontrado:
   - Nombre y web
   - Posicion en Google
   - Google Business: nota, numero resenas
   - Redes sociales: cuales tiene, actividad
   - Web: calidad aparente, SEO basico
3. Tabla comparativa: ${nm} vs competidores
4. Que hacen los competidores mejor
5. Ventajas de ${nm} sobre competidores
6. Oportunidades donde la competencia es debil
${comp1?"7. Analisis detallado de "+comp1:""}
${comp2?"8. Analisis detallado de "+comp2:""}`;

    if(focus==="seo") return base+`Busca como posiciona "${nm}" en Google para las keywords mas importantes del sector.

Keywords a buscar:
- "${nR} en ${ci}"
- "${nR} ${ci}"
- "mejor ${nR} ${ci}"
- "${nR} cerca de mi" (contexto ${ci})
- "${nR} precio ${ci}"
- "${nR} opiniones ${ci}"
- El nombre del negocio "${nm}"

Para cada keyword:
- Que resultados aparecen en las primeras posiciones
- Si ${nm} aparece y en que posicion
- Quien domina esa keyword
- Oportunidad de posicionar

Analisis de la web ${web||"si la tiene"}:
- Estructura SEO visible
- Contenido indexado
- Paginas posicionadas
- Keywords para las que probablemente posiciona`;

    if(focus==="mentions") return base+`Busca MENCIONES de "${nm}" en Internet fuera de las plataformas habituales.

Buscar en:
- Noticias y medios locales de ${ci}
- Blogs del sector ${nR}
- Foros y comunidades
- Redes sociales (menciones por usuarios)
- Premios o reconocimientos
- Entrevistas o articulos
- Directorios profesionales
- Colegios o asociaciones profesionales

Para cada mencion encontrada:
- Fuente y URL
- Contexto (positivo, neutro, negativo)
- Fecha aproximada
- Relevancia para la reputacion

Analisis: volumen de menciones, sentimiento, oportunidades de PR y link building`;

    if(focus==="gaps") return base+`Busca OPORTUNIDADES PERDIDAS: donde deberia estar "${nm}" pero no esta.

1. Busca el negocio en las principales plataformas y nota donde NO aparece
2. Busca "${nR} en ${ci}" y analiza que hacen los competidores que SI aparecen
3. Keywords donde nadie del sector tiene buena presencia en ${ci}
4. Directorios sectoriales donde el negocio deberia tener perfil
5. Tipos de contenido que la competencia publica y ${nm} no
6. Plataformas emergentes relevantes para el sector
7. Estimacion de trafico/consultas perdidas por cada gap`;

    return base;
  };

  return <div>
    <div style={{marginBottom:20}}>
      <h3 style={{fontSize:18,fontWeight:700,color:C.w,margin:"0 0 4px"}}>Análisis Profundo de Internet</h3>
      <p style={{fontSize:13,color:C.tx,margin:0}}>La IA busca datos REALES del negocio en Internet: presencia, reseñas, competencia, SEO y menciones</p>
      <div style={{marginTop:8,padding:"8px 12px",background:bg8(C.teal),borderRadius:6,border:"1px solid "+C.teal+"30"}}>
        <span style={{fontSize:12,color:C.teal,fontWeight:600}}>Esta herramienta busca en Internet en tiempo real, los resultados son datos verificados, no estimaciones.</span>
      </div>
    </div>

    <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
      <div style={{flex:"0 0 400px",maxWidth:"100%"}}>
        <Crd>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
            <Fld label="Nombre del negocio *"><Inp value={nm} onChange={sNm} ph="Nombre exacto"/></Fld>
            <Fld label="Ciudad *"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
            <Fld label="Web"><Inp value={web} onChange={sWeb} ph="www.ejemplo.es"/></Fld>
            <Fld label="Competidor 1 (para comparar)"><Inp value={comp1} onChange={sComp1} ph="Nombre del competidor"/></Fld>
            <Fld label="Competidor 2 (para comparar)"><Inp value={comp2} onChange={sComp2} ph="Nombre del competidor"/></Fld>

            <Fld label="Foco del análisis">
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {focusOpts.map(f=><button key={f.id} onClick={()=>setFocus(f.id)} style={{
                  display:"flex",flexDirection:"column",gap:2,padding:"8px 12px",borderRadius:6,textAlign:"left",
                  border:"1px solid "+(focus===f.id?C.teal:C.bd),background:focus===f.id?bg8(C.teal):C.sf2,
                  cursor:"pointer",fontFamily:font
                }}>
                  <span style={{fontSize:12,fontWeight:600,color:focus===f.id?C.teal:C.w}}>{f.lb}</span>
                  <span style={{fontSize:10,color:C.txD}}>{f.desc}</span>
                </button>)}
              </div>
            </Fld>

            <Btn primary disabled={!nm||!ci||!ni} color={C.teal} onClick={()=>
              aiSearch("Eres un investigador digital profesional. Tu trabajo es buscar informacion REAL y VERIFICABLE sobre negocios en Internet. Usa web_search para buscar datos reales. NO inventes datos: si no encuentras algo, di que no lo encontraste. Cada dato que incluyas debe venir de una busqueda real. Incluye las URLs donde encontraste la informacion. Organiza los hallazgos de forma clara y accionable. Responde en espanol de Espana. IMPORTANTE: busca al menos 3-5 veces para cubrir diferentes angulos (nombre del negocio, resenas, competencia, keywords del sector).",
              buildSearchPrompt(),sO,sL,nR,ci||"Espana",setPhase)
            }>Investigar en Internet</Btn>
          </div>
        </Crd>
      </div>
      <div style={{flex:1,minWidth:320}}>
        <OutSearch content={o} loading={l} label={"Investigación - "+focusOpts.find(f=>f.id===focus)?.lb} phase={phase}/>
      </div>
    </div>
  </div>;
}

/* ══════ IMPLEMENTATION HUB ══════ */
function ImplementHub(){
  const[nm,sNm]=useState("");const[ci,sCi]=useState("");const[ni,sNi]=useState("");const[cni,sCni]=useState("");
  const[tab,setTab]=useState("generate");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const[tasks,setTasks]=useState([]);
  const[tasksDone,setTasksDone]=useState({});
  const nR=resolveNiche(ni,cni);

  const toggleTask=(idx)=>setTasksDone({...tasksDone,[idx]:!tasksDone[idx]});
  const doneCount=Object.values(tasksDone).filter(Boolean).length;
  const totalTasks=tasks.length;

  const defaultTasks=[
    {cat:"Presencia",priority:"alta",title:"Crear/reclamar Google Business Profile",time:"30 min",impact:"Critico para SEO local",platform:"Google"},
    {cat:"Presencia",priority:"alta",title:"Verificar datos NAP en todas las plataformas",time:"1-2 horas",impact:"16% del ranking local",platform:"Todas"},
    {cat:"Presencia",priority:"alta",title:"Crear ficha en Apple Business Connect",time:"20 min",impact:"Visible en Siri y Apple Maps",platform:"Apple"},
    {cat:"Presencia",priority:"alta",title:"Crear/optimizar pagina de Facebook",time:"30 min",impact:"Red social principal",platform:"Facebook"},
    {cat:"Presencia",priority:"media",title:"Crear ficha en Bing Places",time:"15 min",impact:"Visible en Bing y Alexa",platform:"Bing"},
    {cat:"Presencia",priority:"media",title:"Configurar Instagram Business con bio optimizada",time:"20 min",impact:"Contenido visual + descubrimiento",platform:"Instagram"},
    {cat:"Presencia",priority:"media",title:"Alta en Paginas Amarillas online",time:"15 min",impact:"Citation + visibilidad local",platform:"Pag. Amarillas"},
    {cat:"Presencia",priority:"baja",title:"Alta en Yelp, Foursquare, QDQ",time:"30 min total",impact:"Citations adicionales",platform:"Directorios"},
    {cat:"Reputacion",priority:"alta",title:"Generar enlace directo de resena Google",time:"10 min",impact:"Facilita obtencion de resenas",platform:"Google"},
    {cat:"Reputacion",priority:"alta",title:"Crear protocolo de solicitud de resenas",time:"30 min",impact:"Aumentar volumen de resenas",platform:"Interno"},
    {cat:"Reputacion",priority:"alta",title:"Responder TODAS las resenas pendientes",time:"Variable",impact:"Mejora nota y confianza",platform:"Google"},
    {cat:"Reputacion",priority:"media",title:"Crear tarjeta/cartel con QR de resena",time:"1 hora",impact:"Solicitud pasiva constante",platform:"Fisico"},
    {cat:"Reputacion",priority:"media",title:"Configurar alertas Google para nuevas resenas",time:"10 min",impact:"Respuesta rapida",platform:"Google"},
    {cat:"SEO",priority:"alta",title:"Optimizar web para keywords geo-locales principales",time:"2-4 horas",impact:"Posicionamiento local",platform:"Web"},
    {cat:"SEO",priority:"alta",title:"Implementar Schema LocalBusiness en la web",time:"1 hora",impact:"Rich results + voz",platform:"Web"},
    {cat:"SEO",priority:"media",title:"Crear contenido FAQ optimizado para busqueda por voz",time:"2 horas",impact:"Position Zero + asistentes",platform:"Web"},
    {cat:"SEO",priority:"media",title:"Crear 3 articulos SEO geo-optimizados",time:"4-6 horas",impact:"Trafico organico local",platform:"Blog"},
    {cat:"Contenido",priority:"alta",title:"Crear calendario de publicaciones GBP (2/semana)",time:"1 hora/semana",impact:"Senales de actividad",platform:"Google"},
    {cat:"Contenido",priority:"media",title:"Producir 4 reels/videos cortos del negocio",time:"4 horas",impact:"Engagement + alcance",platform:"Instagram"},
    {cat:"Contenido",priority:"media",title:"Crear secuencia WhatsApp de seguimiento",time:"1 hora",impact:"Retencion de clientes",platform:"WhatsApp"},
    {cat:"Monitor",priority:"media",title:"Configurar Google Alerts para nombre del negocio",time:"5 min",impact:"Deteccion menciones",platform:"Google"},
    {cat:"Monitor",priority:"baja",title:"Crear informe mensual de metricas",time:"1 hora/mes",impact:"Seguimiento continuo",platform:"Interno"},
  ];

  const loadDefaults=()=>{setTasks(defaultTasks);setTasksDone({});};
  const catCounts=(cat)=>tasks.filter(t=>t.cat===cat).length;
  const catDone=(cat)=>tasks.filter((t,i)=>t.cat===cat&&tasksDone[i]).length;
  const taskCats=[...new Set(tasks.map(t=>t.cat))];

  return <div>
    <div style={{marginBottom:20}}>
      <h3 style={{fontSize:18,fontWeight:700,color:C.w,margin:"0 0 4px"}}>Hub de Implementación</h3>
      <p style={{fontSize:13,color:C.tx,margin:0}}>Plan de acción priorizado con seguimiento de progreso. Genera sugerencias personalizadas o usa el checklist recomendado.</p>
    </div>

    <Tab tabs={[{id:"generate",lb:"Generar Plan IA"},{id:"checklist",lb:"Checklist de Acciones"},{id:"progress",lb:"Progreso"}]} active={tab} onChange={setTab}/>

    {tab==="generate"&&<div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
      <div style={{flex:"0 0 380px",maxWidth:"100%"}}><Crd>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
          <Fld label="Centro *"><Inp value={nm} onChange={sNm} ph="Nombre del negocio"/></Fld>
          <Fld label="Ciudad *"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
          <Btn primary disabled={!nm||!ni} color={C.rose} onClick={()=>
            aiSearch("Eres un consultor de marketing digital que genera planes de implementacion concretos para negocios locales. Usa web_search para buscar el negocio en Internet y detectar su estado real. Basandote en lo que ENCUENTRES, genera un plan de accion personalizado y priorizado. Cada accion debe ser concreta, con tiempo estimado, impacto esperado y pasos exactos. Responde en espanol de Espana.",
            `PLAN DE IMPLEMENTACION PERSONALIZADO para: "${nm}" en ${ci}. Sector: ${nR}.

INSTRUCCIONES:
1. Busca "${nm}" en Internet para entender su estado actual
2. Busca "${nm}" + resenas para ver su reputacion
3. Busca "${nR} en ${ci}" para ver la competencia
4. Basandote en los HALLAZGOS REALES, genera un plan de accion

FORMATO DEL PLAN:

DIAGNOSTICO EXPRESS (basado en lo que encontraste):
- Estado actual de presencia digital (que encontraste y que no)
- Nota de reseñas y volumen (si encontraste)
- Posicion estimada en resultados de busqueda
- Competidores que aparecen por delante

FASE 1: URGENTE (esta semana)
Para cada accion:
- QUE: descripcion concreta
- POR QUE: impacto esperado con datos
- COMO: pasos exactos (1, 2, 3...)
- TIEMPO: minutos/horas estimados
- HERRAMIENTA: que usar (URL si aplica)

FASE 2: CORTO PLAZO (2-4 semanas)
[mismo formato]

FASE 3: MEDIO PLAZO (1-3 meses)
[mismo formato]

FASE 4: MANTENIMIENTO CONTINUO
- Acciones recurrentes semanales
- Acciones recurrentes mensuales
- KPIs a seguir

ESTIMACION DE IMPACTO TOTAL:
- Mejora estimada en visibilidad local
- Aumento estimado de consultas/mes
- Mejora estimada de nota en resenas
- Timeline realista de resultados`,sO,sL,nR,ci||"Espana",null)
          }>Generar Plan Personalizado (busca en Internet)</Btn>
          <div style={{borderTop:"1px solid "+C.bd,paddingTop:12}}>
            <Btn small color={C.txD} onClick={loadDefaults}>Cargar checklist recomendado</Btn>
          </div>
        </div>
      </Crd></div>
      <div style={{flex:1,minWidth:300}}><OutSearch content={o} loading={l} label="Plan de Implementación"/></div>
    </div>}

    {tab==="checklist"&&<div>
      {tasks.length===0?<Crd>
        <p style={{fontSize:14,color:C.tx,textAlign:"center",padding:20}}>
          No hay tareas cargadas. Genera un plan con IA o usa el checklist recomendado.
        </p>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <Btn primary small color={C.rose} onClick={loadDefaults}>Cargar checklist recomendado</Btn>
        </div>
      </Crd>:<div>
        <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:14,fontWeight:700,color:C.w}}>{doneCount} de {totalTasks} completadas</span>
          <div style={{flex:1,minWidth:100,maxWidth:300,height:8,background:C.sf2,borderRadius:4,overflow:"hidden"}}>
            <div style={{height:"100%",width:(totalTasks>0?(doneCount/totalTasks)*100:0)+"%",background:C.green,borderRadius:4,transition:"width 0.3s"}}/>
          </div>
          <span style={{fontSize:12,color:C.green,fontWeight:600}}>{totalTasks>0?Math.round((doneCount/totalTasks)*100):0}%</span>
        </div>
        {taskCats.map(cat=><div key={cat} style={{marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontSize:13,fontWeight:700,color:C.w}}>{cat}</span>
            <span style={{fontSize:11,color:C.txD}}>{catDone(cat)}/{catCounts(cat)}</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {tasks.map((t,i)=>t.cat===cat?<ActionItem key={i} priority={t.priority} title={t.title} time={t.time}
              impact={t.impact} platform={t.platform} done={!!tasksDone[i]} onToggle={()=>toggleTask(i)}/>:null)}
          </div>
        </div>)}
      </div>}
    </div>}

    {tab==="progress"&&<div>
      {tasks.length===0?<Crd><p style={{fontSize:14,color:C.tx,textAlign:"center",padding:20}}>Carga tareas primero para ver el progreso.</p></Crd>
      :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:20}}>
        <Crd sx={{textAlign:"center",padding:30}}>
          <ProgressRing score={doneCount} max={totalTasks||1} size={120} label="Progreso total"/>
        </Crd>
        {taskCats.map(cat=><Crd key={cat} sx={{textAlign:"center",padding:20}}>
          <ProgressRing score={catDone(cat)} max={catCounts(cat)||1} size={90}
            color={cat==="Presencia"?C.cyan:cat==="Reputacion"?C.green:cat==="SEO"?C.purple:cat==="Contenido"?C.blue:C.orange}
            label={cat} sublabel={catDone(cat)+"/"+catCounts(cat)}/>
        </Crd>)}
        <Crd sx={{padding:20}}>
          <h4 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 12px"}}>Pendientes prioritarias</h4>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {tasks.filter((t,i)=>!tasksDone[i]&&t.priority==="alta").slice(0,5).map((t,i)=>
              <div key={i} style={{fontSize:12,color:C.w,padding:"6px 10px",background:bg8(C.red),borderRadius:4,borderLeft:"3px solid "+C.red}}>
                {t.title}
              </div>
            )}
            {tasks.filter((t,i)=>!tasksDone[i]&&t.priority==="alta").length===0&&
              <p style={{fontSize:12,color:C.green}}>Todas las tareas de prioridad alta completadas</p>}
          </div>
        </Crd>
      </div>}
    </div>}
  </div>;
}

/* ══════ LOPD AUTHORIZATION GENERATOR ══════ */
function generateLOPD(client){
  const today=new Date().toLocaleDateString("es-ES",{day:"2-digit",month:"long",year:"numeric"});
  return `DOCUMENTO DE CONSENTIMIENTO Y AUTORIZACION
PROTECCION DE DATOS PERSONALES
(Reglamento (UE) 2016/679 - RGPD y Ley Organica 3/2018 - LOPDGDD)

====================================================================

DATOS DEL RESPONSABLE DEL TRATAMIENTO

Responsable: CLINIQ DIGITAL / ${client.empresa||"[EMPRESA]"}
CIF/NIF: ${client.cif||"[CIF/NIF RESPONSABLE]"}
Domicilio: ${client.dirFiscal||"[DIRECCION]"}, ${client.cpFiscal||"[CP]"} ${client.ciudadFiscal||"[CIUDAD]"} (${client.provinciaFiscal||"[PROVINCIA]"})
Email de contacto: ${client.emailEmpresa||"[EMAIL]"}
Telefono: ${client.telEmpresa||"[TELEFONO]"}

====================================================================

DATOS DEL INTERESADO (CLIENTE)

Nombre completo / Razon social: ${client.nombre||"[NOMBRE]"}
NIF/CIF: ${client.nif||"[NIF/CIF]"}
Domicilio fiscal: ${client.dirFiscal||"[DIRECCION]"}, ${client.cpFiscal||"[CP]"} ${client.ciudadFiscal||"[CIUDAD]"}
Email: ${client.email||"[EMAIL]"}
Telefono: ${client.telefono||"[TELEFONO]"}
Persona de contacto: ${client.contacto||"[CONTACTO]"}

====================================================================

INFORMACION SOBRE EL TRATAMIENTO DE DATOS

1. FINALIDAD DEL TRATAMIENTO

Los datos personales facilitados seran tratados con las siguientes finalidades:

a) Gestion de la relacion contractual y prestacion de los servicios contratados (plan ${client.plan||"[PLAN]"}).
b) Facturacion y gestion administrativa y contable derivada de la relacion comercial.
c) Gestion de la presencia digital del negocio del cliente en plataformas de Internet, incluyendo Google Business Profile, Google Maps, Facebook, Instagram, Bing Places, directorios y otras plataformas digitales.
d) Gestion de la reputacion online, incluyendo monitorizacion y respuesta a resenas en plataformas publicas.
e) Creacion y gestion de contenido digital (web, redes sociales, SEO) en nombre del cliente.
f) Comunicaciones comerciales sobre servicios propios, previa autorizacion.
g) Cumplimiento de obligaciones legales y fiscales.

2. BASE JURIDICA DEL TRATAMIENTO

- Articulo 6.1.b) RGPD: Ejecucion del contrato de prestacion de servicios.
- Articulo 6.1.a) RGPD: Consentimiento del interesado para comunicaciones comerciales.
- Articulo 6.1.c) RGPD: Cumplimiento de obligaciones legales (fiscales, mercantiles).

3. DESTINATARIOS DE LOS DATOS

Los datos podran ser comunicados a:
- Administracion Tributaria, en cumplimiento de obligaciones fiscales.
- Plataformas digitales (Google, Facebook, Bing, directorios) para la gestion de la presencia online del negocio del cliente, con autorizacion explicita del mismo.
- Proveedores de servicios tecnologicos necesarios para la prestacion del servicio, con los que se han firmado los correspondientes contratos de encargado del tratamiento.
- No se realizan transferencias internacionales de datos fuera del Espacio Economico Europeo, salvo las derivadas del uso de plataformas tecnologicas con clausulas contractuales tipo aprobadas por la Comision Europea.

4. PLAZO DE CONSERVACION

Los datos se conservaran durante la vigencia de la relacion contractual y, una vez finalizada, durante los plazos legalmente establecidos:
- Datos fiscales y contables: 4 anos (Ley General Tributaria).
- Datos contractuales: 5 anos (Codigo Civil, articulo 1964).
- Datos de comunicaciones comerciales: hasta la revocacion del consentimiento.

5. DERECHOS DEL INTERESADO

El interesado puede ejercer los siguientes derechos:
- Derecho de ACCESO a sus datos personales.
- Derecho de RECTIFICACION de datos inexactos o incompletos.
- Derecho de SUPRESION ("derecho al olvido").
- Derecho de LIMITACION del tratamiento.
- Derecho de PORTABILIDAD de los datos.
- Derecho de OPOSICION al tratamiento.
- Derecho a NO SER OBJETO de decisiones automatizadas.
- Derecho a RETIRAR EL CONSENTIMIENTO en cualquier momento.

Para ejercer estos derechos, el interesado puede dirigirse por escrito a la direccion indicada o por email, adjuntando copia del DNI/NIE.

Asimismo, tiene derecho a presentar una reclamacion ante la Agencia Espanola de Proteccion de Datos (www.aepd.es) si considera que el tratamiento no se ajusta a la normativa vigente.

6. MEDIDAS DE SEGURIDAD

Se aplican las medidas tecnicas y organizativas apropiadas para garantizar la seguridad, confidencialidad e integridad de los datos, de acuerdo con lo establecido en el articulo 32 del RGPD.

====================================================================

CONSENTIMIENTO

D./Da. ${client.contacto||client.nombre||"_________________________"}, con NIF ${client.nif||"_____________"}, en representacion de ${client.nombre||"_________________________"}, declara:

[ ] He sido informado/a de los terminos del tratamiento de mis datos personales conforme a lo expuesto en este documento.

[ ] CONSIENTO el tratamiento de mis datos para las finalidades descritas en el apartado 1.

[ ] AUTORIZO la gestion de la presencia digital de mi negocio en las plataformas indicadas, incluyendo la publicacion y actualizacion de los datos basicos del negocio (nombre, direccion, telefono, horario, servicios, fotos).

[ ] AUTORIZO el envio de comunicaciones comerciales sobre servicios de Cliniq Digital.

[ ] NO AUTORIZO el envio de comunicaciones comerciales.

En ${client.ciudadFiscal||"_____________"}, a ${today}.


Firma del cliente:                    Firma del responsable:


_________________________            _________________________
${client.contacto||client.nombre||"[Nombre y cargo]"}            [Nombre y cargo]
NIF: ${client.nif||"[NIF]"}


====================================================================
Este documento se extiende por duplicado, quedando un ejemplar en poder de cada parte.
Documento generado conforme al Reglamento (UE) 2016/679 (RGPD) y la Ley Organica 3/2018, de 5 de diciembre, de Proteccion de Datos Personales y garantia de los derechos digitales (LOPDGDD).`;
}

/* ══════ CLIENTS / BILLING ══════ */
function Clients(){
  const emptyClient = {
    nombre:"",nif:"",dirFiscal:"",cpFiscal:"",ciudadFiscal:"",provinciaFiscal:"",
    email:"",telefono:"",web:"",contacto:"",cargoContacto:"",
    nicho:"",plan:"Esencial",servicios:"",formaPago:"Transferencia",iban:"",
    fechaAlta:new Date().toISOString().split("T")[0],notas:"",
    empresa:"Cliniq Digital",emailEmpresa:"info@cliniqdigital.com",telEmpresa:"",cifEmpresa:""
  };
  const[cls,setCls]=useState([]);
  const[dbLoaded,setDbLoaded]=useState(false);
  const[show,setShow]=useState(false);
  const[f,setF]=useState({...emptyClient});
  const[tab,setTab]=useState("list");
  const[sel,setSel]=useState(null);
  const[lopdView,setLopdView]=useState(null);
  const[logRefresh,setLogRefresh]=useState(0);
  const[logFilter,setLogFilter]=useState("all");

  // Load clients from Neon DB on mount
  useEffect(()=>{
    db.getClients().then(data=>{
      if(data&&data.length>0){
        setCls(data.map(r=>({
          id:r.id,nombre:r.nombre||"",nif:r.nif||"",dirFiscal:r.dir_fiscal||"",cpFiscal:r.cp_fiscal||"",
          ciudadFiscal:r.ciudad_fiscal||"",provinciaFiscal:r.provincia_fiscal||"",email:r.email||"",
          telefono:r.telefono||"",web:r.web||"",contacto:r.contacto||"",cargoContacto:r.cargo_contacto||"",
          nicho:r.nicho||"",plan:r.plan||"Esencial",servicios:r.servicios||"",formaPago:r.forma_pago||"Transferencia",
          iban:r.iban||"",fechaAlta:r.fecha_alta||"",notas:r.notas||"",
          empresa:r.empresa||"Cliniq Digital",emailEmpresa:r.email_empresa||"",telEmpresa:r.tel_empresa||"",cifEmpresa:r.cif_empresa||""
        })));
        setDbLoaded(true);
      }
    }).catch(()=>{});
  },[]);

  const add=()=>{
    if(f.nombre&&f.nif){
      const newClient={...f,id:Date.now()};
      setCls(prev=>[...prev,newClient]);
      setF({...emptyClient});
      setShow(false);
      // Persist to Neon
      db.createClient(f).then(saved=>{
        if(saved){setCls(prev=>prev.map(c=>c.id===newClient.id?{...newClient,id:saved.id}:c));}
      }).catch(()=>{});
    }
  };
  const upd=(id,data)=>{
    setCls(cls.map(c=>c.id===id?{...c,...data}:c));
    db.updateClient(id,data).catch(()=>{});
  };

  const printLOPD=(client)=>{
    const doc=generateLOPD(client);
    const w=window.open("","_blank");
    w.document.write(`<html><head><title>LOPD - ${client.nombre}</title><style>
      body{font-family:'Courier New',monospace;padding:40px 60px;line-height:1.8;font-size:13px;color:#111;max-width:800px;margin:auto}
      @media print{body{padding:20px}}
    </style></head><body><pre style="white-space:pre-wrap">${doc.replace(/</g,"&lt;")}</pre>
    <script>setTimeout(()=>window.print(),500)<\/script></body></html>`);
  };

  const selectedClient = sel ? cls.find(c=>c.id===sel) : null;
  const allLog=ACTIVITY_LOG;
  const filteredLog=logFilter==="all"?allLog:getLogForClient(logFilter);
  const clientNames=[...new Set(allLog.map(e=>e.client))].filter(n=>n!=="Sin asignar");

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
      <div>
        <h3 style={{fontSize:18,fontWeight:700,color:C.w,margin:0}}>Gestión de Clientes</h3>
        <p style={{fontSize:13,color:C.tx,margin:"4px 0 0"}}>{cls.length} clientes - {allLog.length} consultas registradas</p>
      </div>
      <div style={{display:"flex",gap:8}}>
        <Btn primary onClick={()=>{setShow(!show);setSel(null);}}>+ Nuevo Cliente</Btn>
      </div>
    </div>

    <Tab tabs={[{id:"list",lb:"Clientes"},{id:"log",lb:"Registro de Actividad ("+allLog.length+")"},{id:"logclient",lb:"Log por Cliente"}]} active={tab} onChange={setTab}/>

    {/* ── NEW CLIENT FORM ── */}
    {tab==="list"&&show&&<Crd sx={{marginBottom:20}}>
      <h4 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 16px"}}>Datos del Cliente (Facturación + LOPD)</h4>

      <div style={{fontSize:11,color:C.tx,marginBottom:12,fontWeight:600,letterSpacing:0.5,textTransform:"uppercase"}}>Datos Fiscales</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:20}}>
        <Fld label="Nombre / Razón Social *"><Inp value={f.nombre} onChange={v=>setF({...f,nombre:v})} ph="Nombre o razón social"/></Fld>
        <Fld label="NIF / CIF *"><Inp value={f.nif} onChange={v=>setF({...f,nif:v})} ph="B12345678"/></Fld>
        <Fld label="Dirección Fiscal *"><Inp value={f.dirFiscal} onChange={v=>setF({...f,dirFiscal:v})} ph="C/ Mayor 15, 2o B"/></Fld>
        <Fld label="Código Postal"><Inp value={f.cpFiscal} onChange={v=>setF({...f,cpFiscal:v})} ph="03001"/></Fld>
        <Fld label="Ciudad *"><Inp value={f.ciudadFiscal} onChange={v=>setF({...f,ciudadFiscal:v})} ph="Alicante"/></Fld>
        <Fld label="Provincia"><Inp value={f.provinciaFiscal} onChange={v=>setF({...f,provinciaFiscal:v})} ph="Alicante"/></Fld>
      </div>

      <div style={{fontSize:11,color:C.tx,marginBottom:12,fontWeight:600,letterSpacing:0.5,textTransform:"uppercase"}}>Contacto</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:20}}>
        <Fld label="Email *"><Inp value={f.email} onChange={v=>setF({...f,email:v})} ph="info@clinica.es" type="email"/></Fld>
        <Fld label="Teléfono *"><Inp value={f.telefono} onChange={v=>setF({...f,telefono:v})} ph="+34 600 000 000"/></Fld>
        <Fld label="Web"><Inp value={f.web} onChange={v=>setF({...f,web:v})} ph="www.clinica.es"/></Fld>
        <Fld label="Persona de contacto"><Inp value={f.contacto} onChange={v=>setF({...f,contacto:v})} ph="Nombre del responsable"/></Fld>
        <Fld label="Cargo"><Inp value={f.cargoContacto} onChange={v=>setF({...f,cargoContacto:v})} ph="Director/a, Gerente..."/></Fld>
      </div>

      <div style={{fontSize:11,color:C.tx,marginBottom:12,fontWeight:600,letterSpacing:0.5,textTransform:"uppercase"}}>Servicio Contratado</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:20}}>
        <Fld label="Nicho / Sector"><Sel value={f.nicho} onChange={v=>setF({...f,nicho:v})} opts={NICHES.map(n=>n.lb)} ph="Sector..."/></Fld>
        <Fld label="Plan"><Sel value={f.plan} onChange={v=>setF({...f,plan:v})} opts={PLANS.map(p=>({value:p.lb,label:`${p.lb} (${p.price} EUR/mes)`}))}/></Fld>
        <Fld label="Fecha de alta"><Inp value={f.fechaAlta} onChange={v=>setF({...f,fechaAlta:v})} type="date"/></Fld>
        <Fld label="Forma de pago"><Sel value={f.formaPago} onChange={v=>setF({...f,formaPago:v})} opts={["Transferencia","Domiciliación SEPA","Tarjeta","Bizum"]}/></Fld>
        <Fld label="IBAN (si domiciliación)"><Inp value={f.iban} onChange={v=>setF({...f,iban:v})} ph="ES00 0000 0000 0000 0000"/></Fld>
      </div>
      <Fld label="Servicios contratados (detalle)"><Txa value={f.servicios} onChange={v=>setF({...f,servicios:v})} ph="Landing + SEO + Redes + GBP + Reporting..." rows={2}/></Fld>
      <Fld label="Notas internas"><Txa value={f.notas} onChange={v=>setF({...f,notas:v})} ph="Observaciones internas..." rows={2}/></Fld>

      <div style={{marginTop:16,display:"flex",gap:10,flexWrap:"wrap"}}>
        <Btn primary small onClick={add} color={f.nombre&&f.nif?C.teal:C.txD}>Guardar Cliente</Btn>
        <Btn small onClick={()=>setShow(false)}>Cancelar</Btn>
      </div>
    </Crd>}

    {/* ── CLIENT LIST TAB ── */}
    {tab==="list"&&<div>
      {cls.map(c=>{
        const clientLog=getLogForClient(c.nombre);
        return <div key={c.id} style={{background:sel===c.id?C.sf2:C.sf,border:"1px solid "+(sel===c.id?C.teal:C.bd),borderRadius:10,padding:"14px 20px",marginBottom:8,cursor:"pointer",transition:"all 0.2s"}} onClick={()=>setSel(sel===c.id?null:c.id)}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:38,height:38,borderRadius:8,background:bg8(C.teal),display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:C.teal}}>{c.nombre[0]}</div>
            <div>
              <div style={{fontSize:14,fontWeight:600,color:C.w}}>{c.nombre}</div>
              <div style={{fontSize:12,color:C.tx}}>{c.nif} - {c.ciudadFiscal||c.email}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <Badge text={c.nicho||"Sin sector"} color={C.purple}/>
            <Badge text={c.plan} color={c.plan==="Premium"?C.gold:c.plan==="Profesional"?C.blue:C.teal}/>
            {clientLog.length>0&&<Badge text={clientLog.length+" consultas"} color={C.cyan}/>}
          </div>
        </div>

        {sel===c.id&&<div style={{marginTop:16,paddingTop:16,borderTop:"1px solid "+C.bd}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,fontSize:13,marginBottom:16}}>
            <div><span style={{color:C.txD}}>NIF/CIF:</span> <span style={{color:C.w}}>{c.nif||"-"}</span></div>
            <div><span style={{color:C.txD}}>Dir. Fiscal:</span> <span style={{color:C.w}}>{c.dirFiscal||"-"}, {c.cpFiscal} {c.ciudadFiscal}</span></div>
            <div><span style={{color:C.txD}}>Email:</span> <span style={{color:C.w}}>{c.email||"-"}</span></div>
            <div><span style={{color:C.txD}}>Teléfono:</span> <span style={{color:C.w}}>{c.telefono||"-"}</span></div>
            <div><span style={{color:C.txD}}>Web:</span> <span style={{color:C.w}}>{c.web||"-"}</span></div>
            <div><span style={{color:C.txD}}>Contacto:</span> <span style={{color:C.w}}>{c.contacto||"-"} ({c.cargoContacto||"-"})</span></div>
            <div><span style={{color:C.txD}}>Plan:</span> <span style={{color:C.w}}>{c.plan} - {PLANS.find(p=>p.lb===c.plan)?.price||"?"} EUR/mes</span></div>
            <div><span style={{color:C.txD}}>Pago:</span> <span style={{color:C.w}}>{c.formaPago||"-"} {c.iban?"("+c.iban.slice(0,8)+"...)":""}</span></div>
            <div><span style={{color:C.txD}}>Alta:</span> <span style={{color:C.w}}>{c.fechaAlta||"-"}</span></div>
            <div><span style={{color:C.txD}}>Servicios:</span> <span style={{color:C.w}}>{c.servicios||"-"}</span></div>
          </div>
          {c.notas&&<div style={{fontSize:12,color:C.txD,marginBottom:12}}>Notas: {c.notas}</div>}

          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
            <Btn small primary color={C.teal} onClick={(e)=>{e.stopPropagation();printLOPD(c);}}>Imprimir LOPD</Btn>
            <Btn small color={C.blue} onClick={(e)=>{e.stopPropagation();setLopdView(lopdView===c.id?null:c.id);}}>
              {lopdView===c.id?"Ocultar LOPD":"Ver LOPD"}
            </Btn>
            <Btn small color={C.gold} onClick={(e)=>{e.stopPropagation();navigator.clipboard.writeText(generateLOPD(c));}}>Copiar LOPD</Btn>
            {clientLog.length>0&&<>
              <Btn small primary color={C.cyan} onClick={(e)=>{e.stopPropagation();exportLogPDF(clientLog,c.nombre);}}>Exportar Log PDF</Btn>
              <Btn small color={C.purple} onClick={(e)=>{e.stopPropagation();navigator.clipboard.writeText(
                clientLog.map(e=>{const d=new Date(e.date);return `[${d.toLocaleDateString("es-ES")} ${d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}] ${e.tool}\n${e.preview}...`}).join("\n\n---\n\n")
              );}}>Copiar Log</Btn>
            </>}
          </div>

          {/* ── CLIENT ACTIVITY LOG (inline) ── */}
          {clientLog.length>0&&<div style={{background:C.bg,border:"1px solid "+C.bd,borderRadius:8,padding:14,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:12,fontWeight:700,color:C.w}}>Registro de actividad ({clientLog.length})</span>
            </div>
            <div style={{maxHeight:250,overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
              {clientLog.slice().reverse().map((e,i)=>{
                const d=new Date(e.date);
                return <div key={i} style={{padding:"8px 10px",background:C.sf2,borderRadius:6,borderLeft:"3px solid "+C.cyan}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <span style={{fontSize:11,fontWeight:700,color:C.cyan}}>{e.tool}</span>
                    <span style={{fontSize:10,color:C.txD}}>{d.toLocaleDateString("es-ES")} {d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}</span>
                  </div>
                  <div style={{fontSize:11,color:C.tx,lineHeight:1.5}}>{e.preview?.slice(0,150)}{e.preview?.length>150?"...":""}</div>
                </div>;
              })}
            </div>
          </div>}

          {lopdView===c.id&&<div style={{marginTop:6,background:C.bg,border:"1px solid "+C.bd,borderRadius:8,padding:16,maxHeight:400,overflowY:"auto"}}>
            <div style={{fontSize:12,color:C.w,lineHeight:1.7,whiteSpace:"pre-wrap",fontFamily:"'Courier New',monospace"}}>{generateLOPD(c)}</div>
          </div>}
        </div>}
      </div>;})}
      {cls.length===0&&<Crd sx={{textAlign:"center",padding:40}}>
        <p style={{color:C.txD,fontSize:14}}>No hay clientes registrados. Pulsa "+ Nuevo Cliente" para comenzar.</p>
      </Crd>}
    </div>}

    {/* ── GLOBAL ACTIVITY LOG TAB ── */}
    {tab==="log"&&<div>
      <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
        <Btn small primary color={C.cyan} onClick={()=>exportLogPDF(allLog,"Todos los clientes")}>Exportar Todo a PDF</Btn>
        <Btn small color={C.txD} onClick={()=>navigator.clipboard.writeText(JSON.stringify(allLog,null,2))}>Copiar JSON</Btn>
        <span style={{fontSize:12,color:C.tx}}>{allLog.length} consultas totales</span>
      </div>
      {allLog.length===0?<Crd sx={{textAlign:"center",padding:40}}>
        <p style={{color:C.txD,fontSize:14}}>No hay consultas registradas todavia. Cada vez que generes contenido con las herramientas de IA, la consulta quedara registrada automaticamente.</p>
      </Crd>:<div style={{display:"flex",flexDirection:"column",gap:8}}>
        {allLog.slice().reverse().map((e,i)=>{
          const d=new Date(e.date);
          const toolItem=ITEMS.find(it=>it.lb===e.tool);
          const toolCl=toolItem?.cl||C.cyan;
          return <Crd key={i} sx={{padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,flexWrap:"wrap",gap:6}}>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{fontSize:11,fontWeight:700,color:C.bg,background:toolCl,padding:"2px 8px",borderRadius:4}}>{e.tool}</span>
                <span style={{fontSize:12,fontWeight:600,color:C.w}}>{e.client}</span>
              </div>
              <span style={{fontSize:11,color:C.txD}}>{d.toLocaleDateString("es-ES")} {d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}</span>
            </div>
            {Object.keys(e.inputs||{}).length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
              {Object.entries(e.inputs).filter(([k,v])=>v).slice(0,4).map(([k,v])=>
                <span key={k} style={{fontSize:10,color:C.txD,background:C.sf2,padding:"2px 6px",borderRadius:3}}>{k}: {String(v).slice(0,40)}</span>
              )}
            </div>}
            <div style={{fontSize:12,color:C.tx,lineHeight:1.6,maxHeight:80,overflow:"hidden"}}>{e.preview}</div>
            <div style={{marginTop:6}}>
              <Btn small onClick={()=>{navigator.clipboard.writeText(e.fullOutput);}}>Copiar resultado completo</Btn>
            </div>
          </Crd>;
        })}
      </div>}
    </div>}

    {/* ── LOG BY CLIENT TAB ── */}
    {tab==="logclient"&&<div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <Fld label="Filtrar por cliente">
          <Sel value={logFilter} onChange={setLogFilter} opts={[{value:"all",label:"Todos ("+allLog.length+")"},...clientNames.map(n=>({value:n,label:n+" ("+getLogForClient(n).length+")"}))]}/>
        </Fld>
        {logFilter!=="all"&&<Btn small primary color={C.cyan} onClick={()=>exportLogPDF(filteredLog,logFilter)}>Exportar PDF de {logFilter}</Btn>}
      </div>
      {filteredLog.length===0?<Crd sx={{textAlign:"center",padding:30}}><p style={{color:C.txD,fontSize:13}}>No hay consultas para este filtro.</p></Crd>
      :<div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:16}}>
          {(()=>{
            const tools={};filteredLog.forEach(e=>{tools[e.tool]=(tools[e.tool]||0)+1;});
            return Object.entries(tools).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([t,n])=>
              <div key={t} style={{background:C.sf,border:"1px solid "+C.bd,borderRadius:8,padding:"10px 14px"}}>
                <div style={{fontSize:18,fontWeight:700,color:C.teal}}>{n}</div>
                <div style={{fontSize:11,color:C.tx}}>{t}</div>
              </div>
            );
          })()}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {filteredLog.slice().reverse().map((e,i)=>{
            const d=new Date(e.date);
            return <div key={i} style={{padding:"10px 14px",background:C.sf,border:"1px solid "+C.bd,borderRadius:8,borderLeft:"3px solid "+C.cyan}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,flexWrap:"wrap",gap:4}}>
                <span style={{fontSize:12,fontWeight:700,color:C.cyan}}>{e.tool}</span>
                <span style={{fontSize:10,color:C.txD}}>{d.toLocaleDateString("es-ES")} {d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}</span>
              </div>
              <div style={{fontSize:12,color:C.tx,lineHeight:1.5}}>{e.preview?.slice(0,200)}{e.preview?.length>200?"...":""}</div>
            </div>;
          })}
        </div>
      </div>}
    </div>}
  </div>;
}

/* ══════ HOME ══════ */
function Home({go}){
  return <div>
    <div style={{marginBottom:28}}>
      <h2 style={{fontSize:22,fontWeight:700,color:C.w,margin:"0 0 4px"}}>Panel de Control</h2>
      <p style={{fontSize:14,color:C.tx,margin:0}}>Cliniq Digital - 23 herramientas | Web Search IA | Prompts Imagen | Registro Actividad</p>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:14,marginBottom:24}}>
      {[{lb:"Nichos",v:"10+",cl:C.purple},{lb:"Herramientas",v:"23",cl:C.blue},{lb:"Motor IA",v:"Web Search",cl:C.teal},{lb:"Plataformas",v:"18+",cl:C.green},{lb:"RGPD",v:"SI",cl:C.gold},{lb:"Log PDF",v:"SI",cl:C.cyan}].map(s=>
        <div key={s.lb} style={{background:C.sf,border:"1px solid "+C.bd,borderRadius:12,padding:"16px 20px"}}>
          <div style={{fontSize:11,color:C.tx,marginBottom:6}}>{s.lb}</div>
          <div style={{fontSize:24,fontWeight:700,color:s.cl}}>{s.v}</div>
        </div>
      )}
    </div>
    <Crd sx={{marginBottom:16}}>
      <h3 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 6px"}}>Nichos configurados</h3>
      <p style={{fontSize:12,color:C.txD,margin:"0 0 14px"}}>La IA adapta terminología, regulación, perfil de cliente y estrategia SEO a cada sector</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {NICHES.map(n=><span key={n.id} style={{fontSize:11,color:C.tx,background:bg8(C.purple),padding:"4px 10px",borderRadius:6}}>{n.lb}</span>)}
      </div>
    </Crd>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
      {[
        {t:"Producción",ids:["landing","whatsapp","seo","followup","social","video","imageprompt","gbp","webstruct"]},
        {t:"Inteligencia",ids:["audit","competitor","compliance","reviews"]},
        {t:"Presencia Digital 360",ids:["scan","deepanalysis","expansion","citations","reputation","voiceseo","brandmonitor","implement"]},
        {t:"Estrategia y Gestión",ids:["report","manual","clients"]}
      ].map(g=><Crd key={g.t}>
        <h3 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 14px"}}>{g.t}</h3>
        {g.ids.map(id=>{const it=ITEMS.find(x=>x.id===id);if(!it)return null;return(
          <div key={id} onClick={()=>go(id)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,cursor:"pointer",transition:"background 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.background=C.sf2;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
            <span style={{fontSize:13,color:it.cl,width:20,textAlign:"center"}}>{it.ic}</span>
            <span style={{fontSize:13,color:C.tx,flex:1}}>{it.lb}</span>
            <span style={{fontSize:11,color:C.txD}}>{">"}</span>
          </div>);})}
      </Crd>)}
    </div>
  </div>;
}

/* ══════ MAIN ══════ */
export default function App(){
  const[act,setAct]=useState("home");
  const[col,setCol]=useState(false);
  useEffect(()=>{loadActivityFromDb();},[]);
  const pages={
    home:<Home go={setAct}/>,landing:<Landing/>,whatsapp:<WhatsApp/>,seo:<Seo/>,audit:<Audit/>,
    followup:<Followup/>,webstruct:<WebStruct/>,social:<Social/>,gbp:<Gbp/>,video:<Video/>,
    imageprompt:<ImagePrompt/>,
    competitor:<Competitor/>,compliance:<Compliance/>,reviews:<Reviews/>,report:<Report/>,manual:<Manual/>,
    clients:<Clients/>,scan:<ScanPresencia/>,expansion:<Expansion/>,citations:<CitationsAudit/>,
    reputation:<Reputation/>,voiceseo:<VoiceSeo/>,brandmonitor:<BrandMonitor/>,
    deepanalysis:<DeepAnalysis/>,implement:<ImplementHub/>
  };
  const curLabel=ITEMS.find(i=>i.id===act)?.lb||"Panel";

  return <div style={{fontFamily:font,background:C.bg,minHeight:"100vh",display:"flex",color:C.w}}>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
    <style>{`*{margin:0;padding:0;box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.bd};border-radius:3px}@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}.spinner{width:16px;height:16px;border:2px solid ${C.teal};border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite}select option{background:${C.sf};color:${C.w}}@media(max-width:860px){.dsk{display:none!important}}`}</style>

    <aside className="dsk" style={{width:col?54:220,background:C.sf,borderRight:"1px solid "+C.bd,display:"flex",flexDirection:"column",transition:"width 0.25s",flexShrink:0,height:"100vh",position:"sticky",top:0,overflow:"hidden"}}>
      <div style={{padding:col?"14px 6px":"14px 12px",borderBottom:"1px solid "+C.bd,display:"flex",alignItems:"center",gap:8,justifyContent:col?"center":"flex-start"}}>
        <div style={{width:26,height:26,borderRadius:6,background:"linear-gradient(135deg,"+C.teal+","+C.tealD+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:C.bg,flexShrink:0}}>C</div>
        {!col&&<span style={{fontSize:13,fontWeight:700,whiteSpace:"nowrap"}}>CLINIQ <span style={{color:C.teal}}>DIGITAL</span></span>}
      </div>
      <nav style={{flex:1,padding:"4px 4px",display:"flex",flexDirection:"column",gap:0,overflowY:"auto"}}>
        {MENU.map((m,i)=>{
          if(m.g)return col?<div key={i} style={{height:1,background:C.bd,margin:"5px 3px",opacity:0.4}}/>:<div key={i} style={{fontSize:9,fontWeight:700,color:C.txD,letterSpacing:1.2,padding:"9px 8px 2px"}}>{m.g}</div>;
          return <button key={m.id} onClick={()=>setAct(m.id)} title={m.lb} style={{display:"flex",alignItems:"center",gap:8,padding:col?"7px 0":"7px 8px",justifyContent:col?"center":"flex-start",background:act===m.id?(m.cl+"10"):"transparent",border:"none",borderRadius:6,cursor:"pointer",borderLeft:act===m.id?"2px solid "+m.cl:"2px solid transparent",width:"100%"}}>
            <span style={{fontSize:12,color:act===m.id?m.cl:C.txD,flexShrink:0,width:16,textAlign:"center"}}>{m.ic}</span>
            {!col&&<span style={{fontSize:12,fontWeight:act===m.id?600:400,color:act===m.id?C.w:C.tx,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.lb}</span>}
          </button>;
        })}
      </nav>
      <div style={{padding:"6px 4px",borderTop:"1px solid "+C.bd}}>
        <button onClick={()=>setCol(!col)} style={{display:"flex",alignItems:"center",justifyContent:"center",width:"100%",padding:5,background:"none",border:"none",color:C.txD,fontSize:10,cursor:"pointer",borderRadius:5}}>{col?"→":"← Colapsar"}</button>
      </div>
    </aside>

    <main style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
      <header style={{padding:"10px 20px",borderBottom:"1px solid "+C.bd,display:"flex",alignItems:"center",justifyContent:"space-between",background:C.sf,position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <select value={act} onChange={e=>setAct(e.target.value)} className="mob-sel" style={{background:C.sf2,border:"1px solid "+C.bd,color:C.w,padding:"5px 8px",borderRadius:6,fontSize:11,display:"none"}}>
            {ITEMS.map(t=><option key={t.id} value={t.id}>{t.lb}</option>)}
          </select>
          <style>{`@media(max-width:860px){.mob-sel{display:block!important}}`}</style>
          <h1 style={{fontSize:14,fontWeight:700,color:C.w,margin:0}}>{curLabel}</h1>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:10,color:C.txD,padding:"3px 8px",background:C.sf2,borderRadius:4}}>23 herramientas + Log PDF</span>
          <div style={{width:26,height:26,borderRadius:6,background:bg8(C.teal),display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.teal}}>L</div>
        </div>
      </header>
      <div style={{flex:1,padding:"18px 20px",overflowY:"auto"}}>{pages[act]||<Home go={setAct}/>}</div>
    </main>
  </div>;
}
