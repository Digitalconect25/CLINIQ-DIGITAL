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
    if(d.error){setO("ERROR API: "+JSON.stringify(d.error));setL(false);return;}
    const out=(d.content||[]).map(b=>b.text||"").join("\n")||"Sin contenido en la respuesta.";
    setO(out);
    if(out&&!out.startsWith("Error")&&!out.startsWith("ERROR")){
      const toolName=logInfo?.tool||inferToolName(sysExtra,prompt);
      logActivity(toolName,logInfo?.client||"Sin asignar",logInfo?.inputs||extractInputs(prompt),out);
    }
  }catch(e){setO("Error de conexion: "+e.message);}
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
    if(d.error){setO("ERROR API: "+JSON.stringify(d.error));if(setPhase) setPhase("done");setL(false);return;}
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
  }catch(e){setO("Error de conexion: "+e.message);}
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
2. VARIANTE A - TONO FORMAL
3. VARIANTE B - TONO CERCANO
4. RESPUESTAS PREPARADAS (4 minimo)
5. GUIA DE ENVIO
6. ERRORES FRECUENTES
7. NOTAS LEGALES`,sO,sL,nR,"Espana")}
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
    ai("Experto SEO con especializacion en posicionamiento local para el sector sanitario y servicios profesionales en Espana.",
    `ARTICULO SEO GEO-OPTIMIZADO
Tema: "${tp}"
Keyword principal: "${kw||tp}"
Localizacion: ${geo}
Extension objetivo: ${ln}
Intencion de busqueda: ${intent}

Genera articulo completo con: TITLE TAG, META DESCRIPTION, URL, ESTRUCTURA ENCABEZADOS, ARTICULO COMPLETO, FAQ (5), CTA INTERNO, KEYWORDS SECUNDARIAS, ENLACES INTERNOS, SCHEMA MARKUP, NOTAS SEO TECNICAS.`,sO,sL,nR,geo)}
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
    `Auditoria digital completa del negocio: ${u}
Localizacion: ${geo}. Sector: ${nR}. Notas: ${nt||"Ninguna"}

Genera informe con: RESUMEN EJECUTIVO, WEB (/100), SEO LOCAL (/100), GBP (/100), EXPERIENCIA DIGITAL (/100), REDES SOCIALES (/100), PLAN DE ACCION PRIORIZADO, PROYECCION.`,sO,sL,nR,geo)}
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
    ai("Experto en secuencias de seguimiento y nurturing para negocios de servicios.",
    `Secuencia completa de seguimiento para personas interesadas en "${srv}" que NO han reservado cita.
Centro: ${nm||"[Nombre]"}. Canal: ${ch}. Sector: ${nR}.
Genera 5 mensajes COMPLETOS: DIA 1, DIA 3, DIA 7, DIA 14, DIA 30. Incluye ASUNTO, MENSAJE, OBJETIVO, METRICA, REGLAS, NOTAS LEGALES, VARIACIONES A/B.`,sO,sL,nR,"Espana")}
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
    ai("Arquitecto de informacion web con SEO tecnico y local integrado.",
    `Arquitectura web completa para: ${nm||"[Nombre]"}. Localizacion: ${geo}. Especialidades: ${sp||"[Definir]"}. Equipo: ${dc||"[Definir]"}. Sector: ${nR}.
Genera: MAPA DEL SITIO CON URLs, HOME, PLANTILLA SERVICIO, EQUIPO, BLOG, PAGINAS TRANSVERSALES, ENLAZADO INTERNO, SEO TECNICO.`,sO,sL,nR,geo)}
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
    ai("Estratega de redes sociales especializado en negocios locales.",
    `Estrategia completa de ${pl} para: ${nm||"[Nombre]"}. Sector: ${nR}. Localizacion: ${geo}. Periodo: ${wk}. Objetivo: ${obj}.
Genera: ANALISIS, PILARES DE CONTENIDO, CALENDARIO EDITORIAL, GUIONES REELS, STORIES, HASHTAGS, METRICAS, CUMPLIMIENTO NORMATIVO.`,sO,sL,nR,geo)}
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
    ai("Especialista en Google Business Profile y SEO local.",
    `Guia completa GBP para: ${nm||"[Nombre]"}. Localizacion: ${geo}. Sector: ${nR}.
Genera: CHECKLIST OPTIMIZACION, ESTRATEGIA FOTOS, PUBLICACIONES (4 semanas), RESPUESTAS RESENAS, FAQ PROACTIVAS, MONITORIZACION.`,sO,sL,nR,geo)}
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
    ai("Guionista de video para redes sociales del sector sanitario.",
    `4 scripts de video sobre "${srv}" para ${pl}.
Centro: ${nm||"[Nombre]"}. Profesional: ${dc||"[Nombre]"}. Objetivo: ${gl}.
Genera 4 scripts: EDUCATIVO, MITOS, PROCESO, FAQ. Cada uno con GANCHO, DESARROLLO, CTA, TEXTO PANTALLA, INDICACIONES, COPY POST, HASHTAGS.`,sO,sL,nR,"Espana")}
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
    ai("Analista de competencia digital con enfoque en SEO local.",
    `Analisis competencia local para: ${nm} en ${geo}. Competidores: ${cm||"Buscar principales"}. Sector: ${nR}.
Genera: MAPA COMPETITIVO, WEB COMPARATIVO, SEO LOCAL, GOOGLE MAPS, REDES, PRECIOS, OPORTUNIDADES GEO-LOCALES, PLAN DE ACCION.`,sO,sL,nR,geo)}
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
    ai("Consultor de cumplimiento normativo publicitario en Espana.",
    `Analiza texto "${tp}" contra normativa del sector ${nR}:
"""
${txt}
"""
Genera: VEREDICTO, INFRACCIONES, ADVERTENCIAS, BUENAS PRACTICAS, VERSION CORREGIDA, CHECKLIST.`,sO,sL,nR,"Espana")}
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
    `Genera respuestas para resena de Google:
Centro: ${nm||"[Nombre]"}. Sector: ${nR}. Puntuacion: ${rt}. Tipo: ${sc}. ${rv?'Texto: "'+rv+'"':"(Solo puntuacion)"}.
Genera: RESPUESTA PRINCIPAL, VARIANTE FORMAL, VARIANTE CERCANA, REGLAS, ACCION INTERNA${rt.includes("1")||rt.includes("2")||rt.includes("3")?", PROTOCOLO RECUPERACION":""}.`,sO,sL,nR,"Espana")}
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
    ai("Analista de marketing digital para negocios locales.",
    `Informe mensual. Centro: ${nm}. Mes: ${mo}. Sector: ${nR}.
Datos: Visitas: ${vi||"[COMPLETAR]"}, Consultas: ${co||"[COMPLETAR]"}, Reservas: ${bk||"[COMPLETAR]"}, Google: ${gp||"[COMPLETAR]"}, Resenas: ${rv||"[COMPLETAR]"}, Redes: ${so||"[COMPLETAR]"}.
Genera: RESUMEN EJECUTIVO, TRAFICO WEB, CONVERSION, SEO LOCAL, GBP, REDES, PLAN PROXIMO MES, PROYECCION.`,sO,sL,nR,"Espana")}
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
    ai("Consultor de marca y comunicacion para negocios de servicios.",
    `MANUAL DE COMUNICACION para: ${nm}. Sector: ${nR}. Servicios: ${tx||"[Principales]"}. Equipo: ${dc||"[Profesionales]"}. Tono: ${tn||"Profesional y cercano"}. Valores: ${vl||"[Valores]"}. Audiencia: ${au||"30-55 anos"}.
Genera: IDENTIDAD DE MARCA, TONO DE VOZ, MENSAJES CLAVE, PROTOCOLOS, GUIA POR CANAL, GUIA VISUAL, CUMPLIMIENTO, PLANTILLAS.`,sO,sL,nR,"Espana")}
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

/* ══════ SIMPLE PLACEHOLDER TOOLS ══════ */
/* These tools use aiSearch or ai with simpler prompts to keep file size manageable */

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
          <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
          <Fld label="Nombre del negocio *"><Inp value={nm} onChange={sNm} ph="Nombre exacto"/></Fld>
          <Fld label="Ciudad *"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
          <Fld label="Web"><Inp value={web} onChange={sWeb} ph="www.ejemplo.es"/></Fld>
          <Btn primary disabled={!nm||!ci||!ni} color={C.teal} onClick={()=>
            aiSearch("Investigador de presencia digital. Busca en Internet informacion REAL sobre este negocio. Busca el nombre, resenas, perfiles en redes, directorios y menciones. Responde en espanol de Espana.",
            `SCAN DE PRESENCIA DIGITAL 360 para: "${nm}" en ${ci}. Sector: ${nR}. Web: ${web||"No proporcionada"}.
Busca: 1) "${nm}" en Google 2) "${nm} resenas" 3) "${nR} en ${ci}" 4) Presencia en Google Maps, Facebook, Instagram, Doctoralia, etc.
Genera informe con: ESTADO POR PLATAFORMA, RESENAS, COMPETENCIA, GAPS, PLAN DE ACCION.`,sO,sL,nR,ci||"Espana",setPhase)
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
          <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
          <Fld label="Nombre *"><Inp value={nm} onChange={sNm} ph="Nombre exacto"/></Fld>
          <Fld label="Ciudad *"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
          <Fld label="Web"><Inp value={web} onChange={sWeb} ph="www.ejemplo.es"/></Fld>
          <Fld label="Competidor"><Inp value={comp1} onChange={sComp1} ph="Nombre competidor"/></Fld>
          <Btn primary disabled={!nm||!ci||!ni} color={C.teal} onClick={()=>
            aiSearch("Investigador digital profesional. Busca informacion REAL y VERIFICABLE. NO inventes datos. Responde en espanol de Espana.",
            `ANALISIS PROFUNDO para: "${nm}" en ${ci}. Sector: ${nR}. Web: ${web||"No proporcionada"}. Competidor: ${comp1||"Buscar principales"}.
Busca: presencia Google, resenas, redes, competencia, SEO. Genera informe con FUENTES REALES.`,sO,sL,nR,ci||"Espana",setPhase)
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
    ai("Especialista en local listings y expansion digital para negocios locales en Espana.",
    `GUIA DE EXPANSION DIGITAL para: "${nm}" en ${ci}. Sector: ${nR}. Dir: ${dir||"[COMPLETAR]"}. Tel: ${tel||"[COMPLETAR]"}. Web: ${web||"[COMPLETAR]"}.
Genera guia COMPLETA para: Google Business, Google Maps, Bing Places, Apple Maps, Facebook, Instagram, LinkedIn, Paginas Amarillas, Doctoralia (si salud). Para cada una: URL acceso, pasos, datos a introducir, descripcion optimizada, fotos, primeras acciones.`,sO,sL,nR,ci||"Espana")}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
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
Genera: ANALISIS NOMBRE, DIRECCION, TELEFONO, WEB, IMPACTO SEO, CHECKLIST CORRECCION, HERRAMIENTAS, MANTENIMIENTO.`,sO,sL,nR,ci||"Espana")}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
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
          <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
          <Fld label="Centro *"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
          <Fld label="Ciudad"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
          <Btn primary disabled={!nm||!ni} color={C.teal} onClick={()=>
            aiSearch("Investigador de reputacion online. Busca resenas REALES en Google, Facebook, Doctoralia. Responde en espanol de Espana.",
            `DIAGNOSTICO REPUTACION para: "${nm}" en ${ci||"Espana"}. Sector: ${nR}.
Busca resenas reales, compara con competencia, analiza sentimiento. Genera plan de solicitud de resenas y protocolo respuesta.`,sO,sL,nR,ci||"Espana",setPhase)
          }>Buscar reseñas reales</Btn>
          <Btn primary disabled={!nm||!ni} color={C.green} onClick={()=>
            ai("Especialista en generacion de resenas para negocios locales.",
            `SISTEMA DE SOLICITUD DE RESENAS para: ${nm}. Sector: ${nR}. Ciudad: ${ci||"Espana"}.
Genera: enlace directo resena Google, mensajes WhatsApp (3 variantes), emails (2 variantes), SMS, guion recepcion, materiales fisicos, automatizacion, timing, metricas, cumplimiento legal.`,sO,sL,nR,ci||"Espana")
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
    ai("Especialista en Voice Search Optimization para negocios locales en Espana.",
    `ESTRATEGIA VOICE SEO para: ${nm} en ${ci}. Sector: ${nR}.
Genera: CONSULTAS DE VOZ, FUENTES POR ASISTENTE, CONTENIDO OPTIMIZADO, SCHEMA MARKUP, BUSQUEDAS CERCA DE MI, METRICAS.`,sO,sL,nR,ci||"Espana")}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
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
    `PLAN MONITORIZACION MARCA para: ${nm} en ${ci||"Espana"}. Sector: ${nR}.
Genera: ALERTAS GOOGLE, ALERTAS GBP, ALERTAS REDES, MONITORIZACION RESENAS, COMPETENCIA, CONTENIDO NEGATIVO, HERRAMIENTAS, PROTOCOLO RESPUESTA, INFORME MENSUAL, CALENDARIO.`,sO,sL,nR,ci||"Espana")}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
      <Fld label="Centro *"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
      <Fld label="Ciudad"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
    </>}/>;
}

function ImagePrompt(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");
  const[idea,sIdea]=useState("");const[platform,setPlatform]=useState("Midjourney");const[style,setStyle]=useState("Fotografía profesional");
  const[nm,sNm]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);
  const platforms=["Midjourney","DALL-E 3","Stable Diffusion","Ideogram","Leonardo AI","Canva IA","Adobe Firefly","Flux","Todos"];
  return <Tool title="Prompts Imagen IA" subtitle="Prompts optimizados para cada plataforma de IA generativa" out={o} ld={l} label="Prompts" btnTxt="Generar Prompts" btnCl={C.rose} ok={ni&&idea} onGen={()=>
    ai("Experto en prompt engineering para generacion de imagenes IA. Prompts para Midjourney/DALL-E/SD/Leonardo/Flux EN INGLES. Explicaciones en espanol de Espana.",
    `PROMPTS DE IMAGEN IA
Sector: ${nR}. Centro: ${nm||"[Negocio]"}. Idea: ${idea}. Plataforma: ${platform}. Estilo: ${style}.
Genera 4 prompts COMPLETOS listos para copiar, con parametros, negative prompt, instrucciones uso, tips del sector.`,sO,sL,nR,"Espana",
    {tool:"Prompts Imagen IA",client:nm||"Sin asignar",inputs:{idea:idea,plataforma:platform}})}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
      <Fld label="Centro"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
      <Fld label="Idea / Concepto *"><Txa value={idea} onChange={sIdea} ph="Ej: Foto recepcion clinica con ambiente calido..." rows={3}/></Fld>
      <Fld label="Plataforma IA"><Sel value={platform} onChange={setPlatform} opts={platforms}/></Fld>
      <Fld label="Estilo visual"><Sel value={style} onChange={setStyle} opts={["Fotografía profesional","Fotografía lifestyle","Ilustración moderna","3D render","Minimalista","Cinematográfico","Editorial"]}/></Fld>
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
          <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni}/>
          <Fld label="Centro *"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
          <Fld label="Ciudad *"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
          <Btn primary disabled={!nm||!ni} color={C.rose} onClick={()=>
            aiSearch("Consultor de marketing digital. Busca el negocio en Internet, detecta estado real y genera plan personalizado. Responde en espanol de Espana.",
            `PLAN IMPLEMENTACION para: "${nm}" en ${ci}. Sector: ${nR}.
Busca el negocio, detecta estado real, genera: DIAGNOSTICO EXPRESS, FASE 1 URGENTE, FASE 2 CORTO PLAZO, FASE 3 MEDIO PLAZO, MANTENIMIENTO, IMPACTO ESTIMADO.`,sO,sL,nR,ci||"Espana",setPhase)
          }>Generar Plan (busca en Internet)</Btn>
        </div>
      </Crd></div>
      <div style={{flex:1,minWidth:300}}><OutSearch content={o} loading={l} label="Plan Implementación" phase={phase}/></div>
    </div>
  </div>;
}

/* ══════ LOPD GENERATOR ══════ */
function generateLOPD(client){
  const today=new Date().toLocaleDateString("es-ES",{day:"2-digit",month:"long",year:"numeric"});
  return `DOCUMENTO DE CONSENTIMIENTO Y AUTORIZACION
PROTECCION DE DATOS PERSONALES (RGPD y LOPDGDD)

RESPONSABLE: CLINIQ DIGITAL / ${client.empresa||"[EMPRESA]"}
CIF/NIF: ${client.cif||"[CIF/NIF]"}
Domicilio: ${client.dirFiscal||"[DIRECCION]"}, ${client.cpFiscal||""} ${client.ciudadFiscal||"[CIUDAD]"}
Email: ${client.emailEmpresa||"[EMAIL]"}

INTERESADO: ${client.nombre||"[NOMBRE]"}
NIF/CIF: ${client.nif||"[NIF/CIF]"}
Domicilio: ${client.dirFiscal||"[DIRECCION]"}, ${client.cpFiscal||""} ${client.ciudadFiscal||"[CIUDAD]"}
Email: ${client.email||"[EMAIL]"} | Tel: ${client.telefono||"[TEL]"}
Contacto: ${client.contacto||"[CONTACTO]"}

FINALIDAD: Gestion relacion contractual (plan ${client.plan||"[PLAN]"}), facturacion, presencia digital, reputacion online, contenido digital, comunicaciones comerciales.
BASE JURIDICA: Art. 6.1.b) RGPD (contrato), Art. 6.1.a) (consentimiento), Art. 6.1.c) (obligaciones legales).
CONSERVACION: Vigencia contractual + plazos legales (4 anos fiscal, 5 anos contractual).
DERECHOS: Acceso, rectificacion, supresion, limitacion, portabilidad, oposicion. Ejercicio por escrito o email.
Reclamaciones: Agencia Espanola de Proteccion de Datos (www.aepd.es).

CONSENTIMIENTO
D./Da. ${client.contacto||client.nombre||"_______"}, NIF ${client.nif||"_______"}:
[ ] CONSIENTO el tratamiento para las finalidades descritas.
[ ] AUTORIZO la gestion de presencia digital de mi negocio.
[ ] AUTORIZO / NO AUTORIZO comunicaciones comerciales.

En ${client.ciudadFiscal||"_______"}, a ${today}.

Firma cliente: _________________ Firma responsable: _________________`;
}

/* ══════ CLIENTS ══════ */
function Clients(){
  const emptyClient = {
    nombre:"",nif:"",dirFiscal:"",cpFiscal:"",ciudadFiscal:"",provinciaFiscal:"",
    email:"",telefono:"",web:"",contacto:"",cargoContacto:"",
    nicho:"",plan:"Esencial",servicios:"",formaPago:"Transferencia",iban:"",
    fechaAlta:new Date().toISOString().split("T")[0],notas:"",
    empresa:"Cliniq Digital",emailEmpresa:"info@cliniqdigital.com",telEmpresa:"",cifEmpresa:""
  };
  const[cls,setCls]=useState([]);
  const[show,setShow]=useState(false);
  const[f,setF]=useState({...emptyClient});
  const[tab,setTab]=useState("list");
  const[sel,setSel]=useState(null);
  const[lopdView,setLopdView]=useState(null);
  const[logFilter,setLogFilter]=useState("all");

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
      }
    }).catch(()=>{});
  },[]);

  const add=()=>{
    if(f.nombre&&f.nif){
      const newClient={...f,id:Date.now()};
      setCls(prev=>[...prev,newClient]);
      setF({...emptyClient});setShow(false);
      db.createClient(f).then(saved=>{
        if(saved){setCls(prev=>prev.map(c=>c.id===newClient.id?{...newClient,id:saved.id}:c));}
      }).catch(()=>{});
    }
  };

  const printLOPD=(client)=>{
    const doc=generateLOPD(client);
    const w=window.open("","_blank");
    w.document.write(`<html><head><title>LOPD - ${client.nombre}</title><style>body{font-family:'Courier New',monospace;padding:40px 60px;line-height:1.8;font-size:13px;max-width:800px;margin:auto}@media print{body{padding:20px}}</style></head><body><pre style="white-space:pre-wrap">${doc.replace(/</g,"&lt;")}</pre><script>setTimeout(()=>window.print(),500)<\/script></body></html>`);
  };

  const allLog=ACTIVITY_LOG;
  const filteredLog=logFilter==="all"?allLog:getLogForClient(logFilter);
  const clientNames=[...new Set(allLog.map(e=>e.client))].filter(n=>n!=="Sin asignar");

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
      <div>
        <h3 style={{fontSize:18,fontWeight:700,color:C.w,margin:0}}>Gestión de Clientes</h3>
        <p style={{fontSize:13,color:C.tx,margin:"4px 0 0"}}>{cls.length} clientes - {allLog.length} consultas</p>
      </div>
      <Btn primary onClick={()=>{setShow(!show);setSel(null);}}>+ Nuevo Cliente</Btn>
    </div>

    <Tab tabs={[{id:"list",lb:"Clientes"},{id:"log",lb:"Registro ("+allLog.length+")"},{id:"logclient",lb:"Log por Cliente"}]} active={tab} onChange={setTab}/>

    {tab==="list"&&show&&<Crd sx={{marginBottom:20}}>
      <h4 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 16px"}}>Nuevo Cliente</h4>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:16}}>
        <Fld label="Nombre / Razón Social *"><Inp value={f.nombre} onChange={v=>setF({...f,nombre:v})} ph="Nombre"/></Fld>
        <Fld label="NIF / CIF *"><Inp value={f.nif} onChange={v=>setF({...f,nif:v})} ph="B12345678"/></Fld>
        <Fld label="Dirección Fiscal"><Inp value={f.dirFiscal} onChange={v=>setF({...f,dirFiscal:v})} ph="C/ Mayor 15"/></Fld>
        <Fld label="CP"><Inp value={f.cpFiscal} onChange={v=>setF({...f,cpFiscal:v})} ph="03001"/></Fld>
        <Fld label="Ciudad"><Inp value={f.ciudadFiscal} onChange={v=>setF({...f,ciudadFiscal:v})} ph="Alicante"/></Fld>
        <Fld label="Email"><Inp value={f.email} onChange={v=>setF({...f,email:v})} ph="info@clinica.es"/></Fld>
        <Fld label="Teléfono"><Inp value={f.telefono} onChange={v=>setF({...f,telefono:v})} ph="+34 600 000 000"/></Fld>
        <Fld label="Web"><Inp value={f.web} onChange={v=>setF({...f,web:v})} ph="www.clinica.es"/></Fld>
        <Fld label="Contacto"><Inp value={f.contacto} onChange={v=>setF({...f,contacto:v})} ph="Nombre responsable"/></Fld>
        <Fld label="Nicho"><Sel value={f.nicho} onChange={v=>setF({...f,nicho:v})} opts={NICHES.map(n=>n.lb)} ph="Sector..."/></Fld>
        <Fld label="Plan"><Sel value={f.plan} onChange={v=>setF({...f,plan:v})} opts={PLANS.map(p=>({value:p.lb,label:`${p.lb} (${p.price} EUR)`}))}/></Fld>
        <Fld label="Fecha alta"><Inp value={f.fechaAlta} onChange={v=>setF({...f,fechaAlta:v})} type="date"/></Fld>
      </div>
      <Fld label="Notas"><Txa value={f.notas} onChange={v=>setF({...f,notas:v})} ph="Observaciones..." rows={2}/></Fld>
      <div style={{marginTop:12,display:"flex",gap:10}}>
        <Btn primary small onClick={add}>Guardar</Btn>
        <Btn small onClick={()=>setShow(false)}>Cancelar</Btn>
      </div>
    </Crd>}

    {tab==="list"&&cls.map(c=>{
      const clientLog=getLogForClient(c.nombre);
      return <div key={c.id} style={{background:sel===c.id?C.sf2:C.sf,border:"1px solid "+(sel===c.id?C.teal:C.bd),borderRadius:10,padding:"14px 20px",marginBottom:8,cursor:"pointer"}} onClick={()=>setSel(sel===c.id?null:c.id)}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:38,height:38,borderRadius:8,background:bg8(C.teal),display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:C.teal}}>{c.nombre[0]}</div>
            <div>
              <div style={{fontSize:14,fontWeight:600,color:C.w}}>{c.nombre}</div>
              <div style={{fontSize:12,color:C.tx}}>{c.nif} - {c.ciudadFiscal||c.email}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Badge text={c.nicho||"Sin sector"} color={C.purple}/>
            <Badge text={c.plan} color={c.plan==="Premium"?C.gold:c.plan==="Profesional"?C.blue:C.teal}/>
            {clientLog.length>0&&<Badge text={clientLog.length+" consultas"} color={C.cyan}/>}
          </div>
        </div>
        {sel===c.id&&<div style={{marginTop:16,paddingTop:16,borderTop:"1px solid "+C.bd}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:8,fontSize:13,marginBottom:12}}>
            <div><span style={{color:C.txD}}>Email:</span> <span style={{color:C.w}}>{c.email||"-"}</span></div>
            <div><span style={{color:C.txD}}>Tel:</span> <span style={{color:C.w}}>{c.telefono||"-"}</span></div>
            <div><span style={{color:C.txD}}>Web:</span> <span style={{color:C.w}}>{c.web||"-"}</span></div>
            <div><span style={{color:C.txD}}>Plan:</span> <span style={{color:C.w}}>{c.plan}</span></div>
            <div><span style={{color:C.txD}}>Alta:</span> <span style={{color:C.w}}>{c.fechaAlta||"-"}</span></div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Btn small primary color={C.teal} onClick={(e)=>{e.stopPropagation();printLOPD(c);}}>Imprimir LOPD</Btn>
            <Btn small color={C.blue} onClick={(e)=>{e.stopPropagation();setLopdView(lopdView===c.id?null:c.id);}}>
              {lopdView===c.id?"Ocultar":"Ver LOPD"}
            </Btn>
            <Btn small color={C.gold} onClick={(e)=>{e.stopPropagation();navigator.clipboard.writeText(generateLOPD(c));}}>Copiar LOPD</Btn>
            {clientLog.length>0&&<Btn small primary color={C.cyan} onClick={(e)=>{e.stopPropagation();exportLogPDF(clientLog,c.nombre);}}>Log PDF</Btn>}
          </div>
          {lopdView===c.id&&<div style={{marginTop:10,background:C.bg,border:"1px solid "+C.bd,borderRadius:8,padding:16,maxHeight:300,overflowY:"auto"}}>
            <div style={{fontSize:11,color:C.w,lineHeight:1.7,whiteSpace:"pre-wrap",fontFamily:"monospace"}}>{generateLOPD(c)}</div>
          </div>}
        </div>}
      </div>;
    })}
    {tab==="list"&&cls.length===0&&!show&&<Crd sx={{textAlign:"center",padding:40}}>
      <p style={{color:C.txD,fontSize:14}}>No hay clientes. Pulsa "+ Nuevo Cliente".</p>
    </Crd>}

    {tab==="log"&&<div>
      <div style={{display:"flex",gap:10,marginBottom:16}}>
        <Btn small primary color={C.cyan} onClick={()=>exportLogPDF(allLog,"Todos")}>Exportar PDF</Btn>
      </div>
      {allLog.length===0?<Crd sx={{textAlign:"center",padding:30}}><p style={{color:C.txD}}>Sin consultas registradas.</p></Crd>
      :allLog.slice().reverse().map((e,i)=>{
        const d=new Date(e.date);
        return <Crd key={i} sx={{padding:12,marginBottom:6}}>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6,marginBottom:6}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:11,fontWeight:700,color:C.bg,background:C.cyan,padding:"2px 8px",borderRadius:4}}>{e.tool}</span>
              <span style={{fontSize:12,color:C.w}}>{e.client}</span>
            </div>
            <span style={{fontSize:11,color:C.txD}}>{d.toLocaleDateString("es-ES")} {d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}</span>
          </div>
          <div style={{fontSize:12,color:C.tx,lineHeight:1.5,maxHeight:60,overflow:"hidden"}}>{e.preview}</div>
          <Btn small onClick={()=>navigator.clipboard.writeText(e.fullOutput)} sx={{marginTop:6}}>Copiar</Btn>
        </Crd>;
      })}
    </div>}

    {tab==="logclient"&&<div>
      <Fld label="Filtrar por cliente">
        <Sel value={logFilter} onChange={setLogFilter} opts={[{value:"all",label:"Todos"},...clientNames.map(n=>({value:n,label:n+" ("+getLogForClient(n).length+")"}))]}/></Fld>
      <div style={{marginTop:12}}>
        {filteredLog.length===0?<p style={{color:C.txD,fontSize:13}}>Sin consultas.</p>
        :filteredLog.slice().reverse().map((e,i)=>{
          const d=new Date(e.date);
          return <div key={i} style={{padding:"10px 14px",background:C.sf,border:"1px solid "+C.bd,borderRadius:8,marginBottom:6,borderLeft:"3px solid "+C.cyan}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:12,fontWeight:700,color:C.cyan}}>{e.tool}</span>
              <span style={{fontSize:10,color:C.txD}}>{d.toLocaleDateString("es-ES")} {d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}</span>
            </div>
            <div style={{fontSize:12,color:C.tx}}>{e.preview?.slice(0,200)}</div>
          </div>;
        })}
      </div>
    </div>}
  </div>;
}

/* ══════ HOME ══════ */
function Home({go}){
  return <div>
    <div style={{marginBottom:28}}>
      <h2 style={{fontSize:22,fontWeight:700,color:C.w,margin:"0 0 4px"}}>Panel de Control</h2>
      <p style={{fontSize:14,color:C.tx,margin:0}}>Cliniq Digital - 23 herramientas | Web Search IA | Registro Actividad</p>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:14,marginBottom:24}}>
      {[{lb:"Nichos",v:"10+",cl:C.purple},{lb:"Herramientas",v:"23",cl:C.blue},{lb:"Motor IA",v:"Claude",cl:C.teal},{lb:"Plataformas",v:"18+",cl:C.green}].map(s=>
        <div key={s.lb} style={{background:C.sf,border:"1px solid "+C.bd,borderRadius:12,padding:"16px 20px"}}>
          <div style={{fontSize:11,color:C.tx,marginBottom:6}}>{s.lb}</div>
          <div style={{fontSize:24,fontWeight:700,color:s.cl}}>{s.v}</div>
        </div>
      )}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
      {[
        {t:"Producción",ids:["landing","whatsapp","seo","followup","social","video","imageprompt","gbp","webstruct"]},
        {t:"Inteligencia",ids:["audit","competitor","compliance","reviews"]},
        {t:"Presencia Digital",ids:["scan","deepanalysis","expansion","citations","reputation","voiceseo","brandmonitor","implement"]},
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
          <span style={{fontSize:10,color:C.txD,padding:"3px 8px",background:C.sf2,borderRadius:4}}>23 herramientas</span>
          <div style={{width:26,height:26,borderRadius:6,background:bg8(C.teal),display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.teal}}>L</div>
        </div>
      </header>
      <div style={{flex:1,padding:"18px 20px",overflowY:"auto"}}>{pages[act]||<Home go={setAct}/>}</div>
    </main>
  </div>;
}
