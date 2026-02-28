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
function Crd({children,sx}){return <div style={{background:C.sf,border:"1px solid "+C.bd,borderRadius:12,padding:24,...sx}}>{children}</div>;}
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
function buildSys(nicheResolved, geo){
  return `Estratega de marketing digital para negocios locales en Espana. AÑO ACTUAL: 2026. Nicho: ${nicheResolved}. Geo: ${geo}.
Reglas: Terminologia profesional del sector. SEO local (keyword en titulo, H2s, primer y ultimo parrafo, densidad 1-2%, LSI keywords, geo-keywords "[servicio] + [ciudad/barrio]"). Sector salud: cumplir regulacion publicitaria sanitaria espanola, sin claims de resultado. Texto limpio sin markdown/asteriscos/almohadillas. Espanol de Espana, comillas rectas, sin emojis. No inventar datos: usar [COMPLETAR] si faltan. Recomendaciones accionables y concretas. Precision sobre extension. IMPORTANTE: Usa informacion, tendencias, datos y referencias de 2025-2026. No uses datos obsoletos.`;
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
        // Fallback chain: groq -> deepseek -> claude haiku
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
      // Fallback chain on connection error: groq -> deepseek -> claude
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

/* ── MODEL ROUTING ── */
const MODELS={
  fast:"claude-haiku-4-5-20251001",
  mid:"claude-sonnet-4-5-20250929",
  full:"claude-sonnet-4-20250514",
  ds:"deepseek-chat",
  dsr:"deepseek-reasoner",
  groqFast:"llama-3.1-8b-instant",
  groqMid:"meta-llama/llama-4-maverick-17b-128e-instruct",
  groqPro:"llama-3.3-70b-versatile",
  groqQwen:"qwen/qwen3-32b"
};
function pickModel(toolHint){
  // Tier 1 - Groq Maverick: fast + cheap ($0.20/$0.60, 562 TPS) for light tasks
  const groqTier=["Respuesta Reseñas","Google Business","WhatsApp","Scripts Vídeo","Prompts Imagen IA","Multiplicador Contenido","Manual Comunicación","Secuencias Seguimiento","Expansión Plataformas","Auditoría NAP","SEO Voz","Monitor de Marca"];
  // Tier 2 - Claude Sonnet 4.5: balanced quality for mid-complexity
  const midTier=["Landing Pages","Contenido SEO","Estrategia Redes","Arquitectura Web","Verificador Normativo","Reporting Mensual"];
  // Tier 3 - Claude Sonnet 4: max quality for complex analysis
  // (everything else: Meta Ads, Propuestas, Campañas, Dashboard, Auditorías, Deep Analysis, aiSearch)
  if(groqTier.some(t=>toolHint?.includes(t))) return {model:MODELS.groqMid,provider:"groq"};
  if(midTier.some(t=>toolHint?.includes(t))) return {model:MODELS.mid,provider:"anthropic"};
  return {model:MODELS.full,provider:"anthropic"};
}

async function ai(sysExtra,prompt,setO,setL,niche,geo,logInfo){
  setL(true);setO("");
  const sys=buildSys(niche||"Servicio profesional",geo||"Espana")+"\n\n"+sysExtra;
  const {model,provider}=pickModel(logInfo?.tool||sysExtra);
  const full=await streamRequest({model,provider,max_tokens:4096,stream:true,system:sys,messages:[{role:"user",content:prompt}]},setO,setL);
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

/* ── AI WITH WEB SEARCH (STREAMING + RETRY) ── */
async function aiSearch(sysExtra,prompt,setO,setL,niche,geo,setPhase,logInfo){
  setL(true);setO("");
  if(setPhase) setPhase("search");
  const sys=buildSys(niche||"Servicio profesional",geo||"Espana")+"\n\n"+sysExtra;
  const maxRetries=3;
  for(let attempt=0;attempt<maxRetries;attempt++){
  try{
    const r=await fetch("/api/generate",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"claude-sonnet-4-20250514",max_tokens:4096,stream:true,system:sys,
        messages:[{role:"user",content:prompt}],
        tools:[{type:"web_search_20250305",name:"web_search"}]
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
    if(full){const toolName=logInfo?.tool||inferToolName(sysExtra,prompt);logActivity(toolName+" (Web)",logInfo?.client||"Sin asignar",logInfo?.inputs||extractInputs(prompt),full,{provider:"anthropic",model:"claude-sonnet-4-20250514",inputText:prompt});}
    if(setPhase) setPhase("done");setL(false);return;
  }catch(e){
    if(attempt<maxRetries-1){setO("Error de conexion, reintentando en 5s...");await new Promise(ok=>setTimeout(ok,5000));continue;}
    setO("Error de conexion: "+e.message);
  }}
  if(setPhase) setPhase("done");setL(false);
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
    ai("Experto SEO en 2026 con especializacion en posicionamiento local para el sector sanitario y servicios profesionales en Espana. Aplica las mejores practicas SEO actualizadas a 2026.",
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
    `Arquitectura web completa para: ${nm||"[Nombre]"}. Localizacion: ${geo}. Especialidades: ${sp||"[Definir]"}. Equipo: ${dc||"[Definir]"}. Sector: ${nR}.
Genera: MAPA DEL SITIO CON URLs, HOME, PLANTILLA SERVICIO, EQUIPO, BLOG, PAGINAS TRANSVERSALES, ENLAZADO INTERNO, SEO TECNICO.`,sO,sL,nR,geo)}
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
    ai("Estratega de redes sociales en 2026 especializado en negocios locales. Conoce las tendencias, algoritmos y formatos actuales de cada plataforma.",
    `Estrategia completa de ${pl} para: ${nm||"[Nombre]"}. Sector: ${nR}. Localizacion: ${geo}. Periodo: ${wk}. Objetivo: ${obj}.
Genera: ANALISIS, PILARES DE CONTENIDO, CALENDARIO EDITORIAL, GUIONES REELS, STORIES, HASHTAGS, METRICAS, CUMPLIMIENTO NORMATIVO.`,sO,sL,nR,geo)}
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
    ai("Especialista en Google Business Profile y SEO local en 2026. Conoce las ultimas funcionalidades de GBP y los factores de ranking actualizados.",
    `Guia completa GBP para: ${nm||"[Nombre]"}. Localizacion: ${geo}. Sector: ${nR}.
Genera: CHECKLIST OPTIMIZACION, ESTRATEGIA FOTOS, PUBLICACIONES (4 semanas), RESPUESTAS RESENAS, FAQ PROACTIVAS, MONITORIZACION.`,sO,sL,nR,geo)}
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
    ai("Guionista de video para redes sociales en 2026. Conoce los formatos, tendencias y algoritmos actuales de Instagram Reels, TikTok y YouTube Shorts.",
    `4 scripts de video sobre "${srv}" para ${pl}.
Centro: ${nm||"[Nombre]"}. Profesional: ${dc||"[Nombre]"}. Objetivo: ${gl}.
Genera 4 scripts: EDUCATIVO, MITOS, PROCESO, FAQ. Cada uno con GANCHO, DESARROLLO, CTA, TEXTO PANTALLA, INDICACIONES, COPY POST, HASHTAGS.`,sO,sL,nR,"Espana")}
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
    ai("Analista de competencia digital en 2026 con enfoque en SEO local.",
    `Analisis competencia local para: ${nm} en ${geo}. Competidores: ${cm||"Buscar principales"}. Sector: ${nR}.
Genera: MAPA COMPETITIVO, WEB COMPARATIVO, SEO LOCAL, GOOGLE MAPS, REDES, PRECIOS, OPORTUNIDADES GEO-LOCALES, PLAN DE ACCION.`,sO,sL,nR,geo)}
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
    ai("Consultor de cumplimiento normativo publicitario en Espana actualizado a 2026. Conoce la legislacion vigente, incluyendo LOPD-GDD, RGPD, Ley General de Publicidad, normativa AEMPS y regulacion autonomica actualizada.",
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
Genera: RESUMEN EJECUTIVO, TRAFICO WEB, CONVERSION, SEO LOCAL, GBP, REDES, PLAN PROXIMO MES, PROYECCION.`,sO,sL,nR,"Espana")}
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
    `MANUAL DE COMUNICACION para: ${nm}. Sector: ${nR}. Servicios: ${tx||"[Principales]"}. Equipo: ${dc||"[Profesionales]"}. Tono: ${tn||"Profesional y cercano"}. Valores: ${vl||"[Valores]"}. Audiencia: ${au||"30-55 anos"}.
Genera: IDENTIDAD DE MARCA, TONO DE VOZ, MENSAJES CLAVE, PROTOCOLOS, GUIA POR CANAL, GUIA VISUAL, CUMPLIMIENTO, PLANTILLAS.`,sO,sL,nR,"Espana")}
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
          <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
          <Fld label="Nombre del negocio *"><Inp value={nm} onChange={sNm} ph="Nombre exacto"/></Fld>
          <Fld label="Ciudad *"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
          <Fld label="Web"><Inp value={web} onChange={sWeb} ph="www.ejemplo.es"/></Fld>
          <Btn primary disabled={!nm||!ci||!ni} color={C.teal} onClick={()=>
            aiSearch("Investigador de presencia digital en 2026. Busca en Internet informacion REAL y actualizada sobre este negocio. Busca el nombre, resenas, perfiles en redes, directorios y menciones. Responde en espanol de Espana.",
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
          <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
          <Fld label="Nombre *"><Inp value={nm} onChange={sNm} ph="Nombre exacto"/></Fld>
          <Fld label="Ciudad *"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
          <Fld label="Web"><Inp value={web} onChange={sWeb} ph="www.ejemplo.es"/></Fld>
          <Fld label="Competidor"><Inp value={comp1} onChange={sComp1} ph="Nombre competidor"/></Fld>
          <Btn primary disabled={!nm||!ci||!ni} color={C.teal} onClick={()=>
            aiSearch("Investigador digital profesional en 2026. Busca informacion REAL, VERIFICABLE y ACTUALIZADA. NO inventes datos. Responde en espanol de Espana.",
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
    ai("Especialista en local listings y expansion digital en 2026 para negocios locales en Espana. Conoce las plataformas y directorios relevantes actualizados.",
    `GUIA DE EXPANSION DIGITAL para: "${nm}" en ${ci}. Sector: ${nR}. Dir: ${dir||"[COMPLETAR]"}. Tel: ${tel||"[COMPLETAR]"}. Web: ${web||"[COMPLETAR]"}.
Genera guia COMPLETA para: Google Business, Google Maps, Bing Places, Apple Maps, Facebook, Instagram, LinkedIn, Paginas Amarillas, Doctoralia (si salud). Para cada una: URL acceso, pasos, datos a introducir, descripcion optimizada, fotos, primeras acciones.`,sO,sL,nR,ci||"Espana")}
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
Genera: ANALISIS NOMBRE, DIRECCION, TELEFONO, WEB, IMPACTO SEO, CHECKLIST CORRECCION, HERRAMIENTAS, MANTENIMIENTO.`,sO,sL,nR,ci||"Espana")}
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
            aiSearch("Investigador de reputacion online en 2026. Busca resenas REALES y actualizadas en Google, Facebook, Doctoralia. Responde en espanol de Espana.",
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
    ai("Especialista en Voice Search Optimization en 2026 para negocios locales en Espana. Conoce las ultimas tendencias en busqueda por voz con Alexa, Google Assistant y Siri.",
    `ESTRATEGIA VOICE SEO para: ${nm} en ${ci}. Sector: ${nR}.
Genera: CONSULTAS DE VOZ, FUENTES POR ASISTENTE, CONTENIDO OPTIMIZADO, SCHEMA MARKUP, BUSQUEDAS CERCA DE MI, METRICAS.`,sO,sL,nR,ci||"Espana")}
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
    `PLAN MONITORIZACION MARCA para: ${nm} en ${ci||"Espana"}. Sector: ${nR}.
Genera: ALERTAS GOOGLE, ALERTAS GBP, ALERTAS REDES, MONITORIZACION RESENAS, COMPETENCIA, CONTENIDO NEGATIVO, HERRAMIENTAS, PROTOCOLO RESPUESTA, INFORME MENSUAL, CALENDARIO.`,sO,sL,nR,ci||"Espana")}
    fields={<>
      <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
      <Fld label="Centro *"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
      <Fld label="Ciudad"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
    </>}/>;
}

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

    <Tab tabs={[{id:"gen",lb:"Generar Imagen"},{id:"prompts",lb:"Generador Prompts"},{id:"history",lb:"Historial ("+imgHistory.length+")"}]} active={imgResult!==null||imgLoading?"gen":"gen"} onChange={()=>{}}/>

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
        ai("Experto en prompt engineering para generacion de imagenes IA en 2026. Prompts para Midjourney v6/DALL-E 3/Flux/SD3/Leonardo EN INGLES. Explicaciones en espanol de Espana.",
        `PROMPTS DE IMAGEN IA
Sector: ${nR}. Centro: ${nm||"[Negocio]"}. Idea: ${idea}. Plataforma: ${platform}. Estilo: ${style}.
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
            aiSearch("Consultor de marketing digital en 2026. Busca el negocio en Internet, detecta estado real actualizado y genera plan personalizado. Responde en espanol de Espana.",
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
function LOPDDocument({client,onClose}){
  const today=new Date().toLocaleDateString("es-ES",{day:"2-digit",month:"long",year:"numeric"});
  const[consent1,setConsent1]=useState(false);
  const[consent2,setConsent2]=useState(false);
  const[consent3,setConsent3]=useState(false);
  const[comercial,setComercial]=useState("autorizo");
  const[saved,setSaved]=useState(false);

  const empresa=client.empresa||"Cliniq Digital";
  const cifEmpresa=client.cifEmpresa||"[CIF EMPRESA]";
  const dirEmpresa=client.dirFiscal||"[DIRECCION EMPRESA]";
  const emailEmpresa=client.emailEmpresa||"info@cliniqdigital.com";

  const printDoc=()=>{
    const w=window.open("","_blank");
    if(!w) return;
    w.document.write(buildHTML());
    w.document.close();
    setTimeout(()=>w.print(),600);
  };

  const copyDoc=()=>{
    const txt=buildPlainText();
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(()=>setSaved(true)).catch(()=>{
        fallbackCopy(txt);
      });
    }else{fallbackCopy(txt);}
    setTimeout(()=>setSaved(false),2000);
  };

  const fallbackCopy=(txt)=>{
    const ta=document.createElement("textarea");
    ta.value=txt;ta.style.position="fixed";ta.style.left="-9999px";
    document.body.appendChild(ta);ta.select();
    try{document.execCommand("copy");setSaved(true);}catch(e){}
    document.body.removeChild(ta);
  };

  const buildPlainText=()=>`DOCUMENTO DE CONSENTIMIENTO Y AUTORIZACION
PROTECCION DE DATOS PERSONALES
(Conforme al Reglamento General de Proteccion de Datos UE 2016/679
y Ley Organica 3/2018 de Proteccion de Datos Personales y Garantia de los Derechos Digitales)

===================================================================

1. DATOS DEL RESPONSABLE DEL TRATAMIENTO

Razon social: ${empresa}
CIF/NIF: ${cifEmpresa}
Domicilio: ${dirEmpresa}
Email de contacto: ${emailEmpresa}
Delegado de Proteccion de Datos: ${emailEmpresa}

2. DATOS DEL INTERESADO (CLIENTE)

Nombre / Razon social: ${client.nombre||"[NOMBRE]"}
NIF/CIF: ${client.nif||"[NIF/CIF]"}
Domicilio fiscal: ${client.dirFiscal||"[DIRECCION]"}, ${client.cpFiscal||""} ${client.ciudadFiscal||"[CIUDAD]"} (${client.provinciaFiscal||""})
Email: ${client.email||"[EMAIL]"}
Telefono: ${client.telefono||"[TELEFONO]"}
Persona de contacto: ${client.contacto||"[CONTACTO]"}
Cargo: ${client.cargoContacto||"[CARGO]"}

3. FINALIDAD DEL TRATAMIENTO

Los datos personales facilitados seran tratados con las siguientes finalidades:
a) Gestion de la relacion contractual (Plan: ${client.plan||"[PLAN]"})
b) Facturacion y cobro de los servicios contratados
c) Gestion de presencia digital y reputacion online del negocio del interesado
d) Creacion y gestion de contenido digital en nombre del interesado
e) Comunicaciones relacionadas con el servicio contratado
${comercial==="autorizo"?"f) Envio de comunicaciones comerciales sobre servicios propios":""}

4. BASE JURIDICA DEL TRATAMIENTO

- Art. 6.1.b) RGPD: Ejecucion de contrato o medidas precontractuales
- Art. 6.1.a) RGPD: Consentimiento del interesado
- Art. 6.1.c) RGPD: Cumplimiento de obligaciones legales (fiscales, mercantiles)

5. PLAZO DE CONSERVACION

Los datos se conservaran durante la vigencia de la relacion contractual y, tras su finalizacion, durante los plazos legalmente establecidos:
- 4 anos para obligaciones fiscales y tributarias
- 5 anos para obligaciones contractuales y civiles
- 3 anos para datos de caracter personal sin otra base legal

6. DESTINATARIOS DE LOS DATOS

Los datos podran ser comunicados a:
- Administraciones publicas cuando exista obligacion legal
- Proveedores tecnologicos necesarios para la prestacion del servicio (hosting, herramientas digitales)
- No se realizan transferencias internacionales de datos fuera del EEE

7. DERECHOS DEL INTERESADO

El interesado podra ejercer los siguientes derechos:
- Derecho de acceso a sus datos personales
- Derecho de rectificacion de datos inexactos
- Derecho de supresion ("derecho al olvido")
- Derecho a la limitacion del tratamiento
- Derecho a la portabilidad de los datos
- Derecho de oposicion al tratamiento

Ejercicio de derechos: Por escrito a ${dirEmpresa} o email a ${emailEmpresa}
Plazo de respuesta: 1 mes desde la recepcion de la solicitud
Reclamaciones: Agencia Espanola de Proteccion de Datos (www.aepd.es)

8. CONSENTIMIENTO

D./Da. ${client.contacto||client.nombre||"_________________________"}, con NIF ${client.nif||"_____________"}, en calidad de ${client.cargoContacto||"representante legal"} de ${client.nombre||"_________________________"}:

${consent1?"[X]":"[ ]"} CONSIENTO expresamente el tratamiento de mis datos para las finalidades descritas en el apartado 3.
${consent2?"[X]":"[ ]"} AUTORIZO la gestion de la presencia digital de mi negocio en las plataformas acordadas.
${consent3?"[X]":"[ ]"} ${comercial==="autorizo"?"AUTORIZO":"NO AUTORIZO"} el envio de comunicaciones comerciales sobre servicios propios.

En ${client.ciudadFiscal||"_____________"}, a ${today}.



Firma del cliente:                          Firma del responsable:


_________________________              _________________________
${client.contacto||client.nombre||""}              ${empresa}
NIF: ${client.nif||""}                      CIF: ${cifEmpresa}`;

  const buildHTML=()=>`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>LOPD - ${client.nombre}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Georgia,'Times New Roman',serif;padding:50px 70px;line-height:1.7;font-size:12.5px;color:#1a1a1a;max-width:820px;margin:auto}
h1{font-size:16px;text-align:center;margin-bottom:4px;letter-spacing:1px}
h2{font-size:11px;text-align:center;color:#555;margin-bottom:30px;font-weight:400}
h3{font-size:13px;margin:24px 0 8px;border-bottom:1px solid #ccc;padding-bottom:4px}
.header{border:2px solid #333;padding:20px 30px;margin-bottom:30px;text-align:center}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;margin:8px 0 16px}
.grid div{font-size:12px}
.label{color:#666;font-weight:600}
.check{margin:6px 0;font-size:12.5px}
.sig{display:flex;justify-content:space-between;margin-top:60px}
.sig-box{width:45%;text-align:center}
.sig-line{border-bottom:1px solid #333;height:50px;margin-bottom:6px}
.sig-name{font-size:11px;color:#555}
.footer{text-align:center;margin-top:40px;font-size:10px;color:#999;border-top:1px solid #ddd;padding-top:12px}
@media print{body{padding:30px 50px}button{display:none!important}}
</style></head><body>
<div class="header">
<h1>DOCUMENTO DE CONSENTIMIENTO Y AUTORIZACION</h1>
<h2>Proteccion de Datos Personales - RGPD (UE 2016/679) y LOPDGDD (LO 3/2018)</h2>
</div>
${buildPlainText().split("\n").map(l=>"<p>"+l.replace(/</g,"&lt;")+"</p>").join("")}
<div class="footer">Documento generado el ${today} - ${empresa}</div>
</body></html>`;

  const Chk=({checked,onChange,label})=><div onClick={()=>onChange(!checked)} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 0",cursor:"pointer"}}>
    <div style={{width:20,height:20,borderRadius:4,border:"2px solid "+(checked?C.green:C.bd),background:checked?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
      {checked&&<span style={{color:C.bg,fontSize:13,fontWeight:700}}>✓</span>}
    </div>
    <span style={{fontSize:13,color:C.w,lineHeight:1.5}}>{label}</span>
  </div>;

  return <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.85)",zIndex:9999,overflowY:"auto",padding:"20px"}}>
    <div style={{maxWidth:800,margin:"0 auto",background:C.sf,border:"1px solid "+C.bd,borderRadius:14,overflow:"hidden"}}>
      <div style={{padding:"20px 24px",borderBottom:"1px solid "+C.bd,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:C.sf,zIndex:1}}>
        <div>
          <h3 style={{fontSize:16,fontWeight:700,color:C.w,margin:0}}>Documento LOPD / RGPD</h3>
          <p style={{fontSize:12,color:C.txD,margin:"2px 0 0"}}>{client.nombre} - {today}</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn small primary color={C.green} onClick={copyDoc}>{saved?"Copiado!":"Copiar"}</Btn>
          <Btn small primary color={C.blue} onClick={printDoc}>Imprimir</Btn>
          <Btn small onClick={onClose}>Cerrar</Btn>
        </div>
      </div>

      <div style={{padding:24}}>
        <div style={{textAlign:"center",padding:"16px 20px",border:"2px solid "+C.teal,borderRadius:10,marginBottom:24}}>
          <div style={{fontSize:15,fontWeight:700,color:C.w,letterSpacing:1}}>DOCUMENTO DE CONSENTIMIENTO Y AUTORIZACION</div>
          <div style={{fontSize:12,color:C.txD,marginTop:4}}>Proteccion de Datos Personales - RGPD (UE 2016/679) y LOPDGDD (LO 3/2018)</div>
        </div>

        <Crd sx={{marginBottom:16}}>
          <h4 style={{fontSize:13,fontWeight:700,color:C.teal,margin:"0 0 10px"}}>1. DATOS DEL RESPONSABLE DEL TRATAMIENTO</h4>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 20px",fontSize:13}}>
            <div><span style={{color:C.txD}}>Razon social:</span> <span style={{color:C.w}}>{empresa}</span></div>
            <div><span style={{color:C.txD}}>CIF/NIF:</span> <span style={{color:C.w}}>{cifEmpresa}</span></div>
            <div style={{gridColumn:"1/-1"}}><span style={{color:C.txD}}>Domicilio:</span> <span style={{color:C.w}}>{dirEmpresa}</span></div>
            <div><span style={{color:C.txD}}>Email:</span> <span style={{color:C.w}}>{emailEmpresa}</span></div>
          </div>
        </Crd>

        <Crd sx={{marginBottom:16}}>
          <h4 style={{fontSize:13,fontWeight:700,color:C.blue,margin:"0 0 10px"}}>2. DATOS DEL INTERESADO (CLIENTE)</h4>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 20px",fontSize:13}}>
            <div><span style={{color:C.txD}}>Nombre:</span> <span style={{color:C.w}}>{client.nombre||"-"}</span></div>
            <div><span style={{color:C.txD}}>NIF/CIF:</span> <span style={{color:C.w}}>{client.nif||"-"}</span></div>
            <div style={{gridColumn:"1/-1"}}><span style={{color:C.txD}}>Domicilio:</span> <span style={{color:C.w}}>{client.dirFiscal||"-"}, {client.cpFiscal||""} {client.ciudadFiscal||"-"} ({client.provinciaFiscal||""})</span></div>
            <div><span style={{color:C.txD}}>Email:</span> <span style={{color:C.w}}>{client.email||"-"}</span></div>
            <div><span style={{color:C.txD}}>Telefono:</span> <span style={{color:C.w}}>{client.telefono||"-"}</span></div>
            <div><span style={{color:C.txD}}>Contacto:</span> <span style={{color:C.w}}>{client.contacto||"-"}</span></div>
            <div><span style={{color:C.txD}}>Cargo:</span> <span style={{color:C.w}}>{client.cargoContacto||"-"}</span></div>
          </div>
        </Crd>

        <Crd sx={{marginBottom:16}}>
          <h4 style={{fontSize:13,fontWeight:700,color:C.purple,margin:"0 0 10px"}}>3. FINALIDAD DEL TRATAMIENTO</h4>
          <div style={{fontSize:13,color:C.tx,lineHeight:1.7}}>
            <p style={{marginBottom:6}}>Los datos personales seran tratados para:</p>
            <p>a) Gestion de la relacion contractual (Plan: <span style={{color:C.w,fontWeight:600}}>{client.plan||"-"}</span>)</p>
            <p>b) Facturacion y cobro de los servicios contratados</p>
            <p>c) Gestion de presencia digital y reputacion online</p>
            <p>d) Creacion y gestion de contenido digital</p>
            <p>e) Comunicaciones relacionadas con el servicio</p>
          </div>
        </Crd>

        <Crd sx={{marginBottom:16}}>
          <h4 style={{fontSize:13,fontWeight:700,color:C.gold,margin:"0 0 10px"}}>4. BASE JURIDICA</h4>
          <div style={{fontSize:13,color:C.tx,lineHeight:1.7}}>
            <p>Art. 6.1.b) RGPD - Ejecucion de contrato</p>
            <p>Art. 6.1.a) RGPD - Consentimiento del interesado</p>
            <p>Art. 6.1.c) RGPD - Cumplimiento de obligaciones legales</p>
          </div>
        </Crd>

        <Crd sx={{marginBottom:16}}>
          <h4 style={{fontSize:13,fontWeight:700,color:C.cyan,margin:"0 0 10px"}}>5. CONSERVACION / 6. DESTINATARIOS / 7. DERECHOS</h4>
          <div style={{fontSize:12,color:C.tx,lineHeight:1.7}}>
            <p><span style={{color:C.w,fontWeight:600}}>Conservacion:</span> Vigencia contractual + plazos legales (4 anos fiscal, 5 anos contractual, 3 anos datos personales)</p>
            <p style={{marginTop:6}}><span style={{color:C.w,fontWeight:600}}>Destinatarios:</span> Administraciones publicas (obligacion legal), proveedores tecnologicos. Sin transferencias fuera del EEE.</p>
            <p style={{marginTop:6}}><span style={{color:C.w,fontWeight:600}}>Derechos:</span> Acceso, rectificacion, supresion, limitacion, portabilidad, oposicion. Ejercicio: {emailEmpresa}. Plazo: 1 mes. Reclamaciones: AEPD (www.aepd.es)</p>
          </div>
        </Crd>

        <Crd sx={{marginBottom:16,borderColor:C.teal}}>
          <h4 style={{fontSize:13,fontWeight:700,color:C.green,margin:"0 0 12px"}}>8. CONSENTIMIENTO</h4>
          <p style={{fontSize:13,color:C.tx,marginBottom:12}}>D./Da. <span style={{color:C.w,fontWeight:600}}>{client.contacto||client.nombre||"_________"}</span>, con NIF <span style={{color:C.w,fontWeight:600}}>{client.nif||"_________"}</span>, en calidad de {client.cargoContacto||"representante legal"} de <span style={{color:C.w,fontWeight:600}}>{client.nombre||"_________"}</span>:</p>
          <Chk checked={consent1} onChange={setConsent1} label="CONSIENTO expresamente el tratamiento de mis datos personales para las finalidades descritas en el apartado 3."/>
          <Chk checked={consent2} onChange={setConsent2} label="AUTORIZO la gestion de la presencia digital de mi negocio en las plataformas acordadas."/>
          <div style={{marginTop:8,marginBottom:4}}>
            <Fld label="Comunicaciones comerciales">
              <Sel value={comercial} onChange={setComercial} opts={[{v:"autorizo",l:"AUTORIZO el envio de comunicaciones comerciales"},{v:"no_autorizo",l:"NO AUTORIZO el envio de comunicaciones comerciales"}]}/>
            </Fld>
          </div>
          <Chk checked={consent3} onChange={setConsent3} label={comercial==="autorizo"?"AUTORIZO el envio de comunicaciones comerciales sobre servicios propios.":"NO AUTORIZO el envio de comunicaciones comerciales."}/>
        </Crd>

        <Crd sx={{marginBottom:16}}>
          <p style={{fontSize:13,color:C.tx,marginBottom:20}}>En <span style={{color:C.w,fontWeight:600}}>{client.ciudadFiscal||"_____________"}</span>, a <span style={{color:C.w,fontWeight:600}}>{today}</span>.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:40}}>
            <div style={{textAlign:"center"}}>
              <p style={{fontSize:11,color:C.txD,marginBottom:8}}>Firma del cliente</p>
              <div style={{height:80,border:"1px dashed "+C.bd,borderRadius:8,marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:11,color:C.txD,fontStyle:"italic"}}>Espacio para firma</span>
              </div>
              <p style={{fontSize:12,color:C.w}}>{client.contacto||client.nombre||""}</p>
              <p style={{fontSize:11,color:C.txD}}>NIF: {client.nif||""}</p>
            </div>
            <div style={{textAlign:"center"}}>
              <p style={{fontSize:11,color:C.txD,marginBottom:8}}>Firma del responsable</p>
              <div style={{height:80,border:"1px dashed "+C.bd,borderRadius:8,marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:11,color:C.txD,fontStyle:"italic"}}>Espacio para firma</span>
              </div>
              <p style={{fontSize:12,color:C.w}}>{empresa}</p>
              <p style={{fontSize:11,color:C.txD}}>CIF: {cifEmpresa}</p>
            </div>
          </div>
        </Crd>

        <div style={{textAlign:"center",padding:"16px",fontSize:11,color:C.txD}}>
          Documento generado el {today} - {empresa}
        </div>
      </div>
    </div>
  </div>;
}

/* ══════ CLIENTS ══════ */
function Clients(){
  const emptyClient = {
    nombre:"",nif:"",dirFiscal:"",cpFiscal:"",ciudadFiscal:"",provinciaFiscal:"",
    email:"",telefono:"",web:"",contacto:"",cargoContacto:"",
    nicho:"",plan:"Esencial",servicios:"",formaPago:"Transferencia",iban:"",
    fechaAlta:new Date().toISOString().split("T")[0],notas:"",
    empresa:"Cliniq Digital",emailEmpresa:"info@cliniqdigital.com",telEmpresa:"",cifEmpresa:"",
    presupuesto:"",cuotaMensual:""
  };
  const mask=(val)=>{if(!val||val.length<4) return val||"-";return val.slice(0,2)+"*".repeat(Math.max(val.length-4,2))+val.slice(-2);};
  const[cls,setCls]=useState([]);
  const[show,setShow]=useState(false);
  const[f,setF]=useState({...emptyClient});
  const[tab,setTab]=useState("list");
  const[sel,setSel]=useState(null);
  const[logFilter,setLogFilter]=useState("all");
  const[editId,setEditId]=useState(null);
  const[editLog,setEditLog]=useState(null);
  const[,forceUpdate]=useState(0);
  const[logSearch,setLogSearch]=useState("");
  const[logToolFilter,setLogToolFilter]=useState("all");
  const[shareLink,setShareLink]=useState("");
  const[lopdClient,setLopdClient]=useState(null);

  useEffect(()=>{
    db.getClients().then(data=>{
      if(data&&data.length>0){
        setCls(data.map(r=>({
          id:r.id,nombre:r.nombre||"",nif:r.nif||"",dirFiscal:r.dir_fiscal||"",cpFiscal:r.cp_fiscal||"",
          ciudadFiscal:r.ciudad_fiscal||"",provinciaFiscal:r.provincia_fiscal||"",email:r.email||"",
          telefono:r.telefono||"",web:r.web||"",contacto:r.contacto||"",cargoContacto:r.cargo_contacto||"",
          nicho:r.nicho||"",plan:r.plan||"Esencial",servicios:r.servicios||"",formaPago:r.forma_pago||"Transferencia",
          iban:r.iban||"",fechaAlta:r.fecha_alta||"",notas:r.notas||"",
          empresa:r.empresa||"Cliniq Digital",emailEmpresa:r.email_empresa||"",telEmpresa:r.tel_empresa||"",cifEmpresa:r.cif_empresa||"",
          presupuesto:r.presupuesto||"",cuotaMensual:r.cuota_mensual||""
        })));
      }
    }).catch(()=>{});
  },[]);

  const save=()=>{
    if(!f.nombre||!f.nif) return;
    if(editId){
      setCls(prev=>prev.map(c=>c.id===editId?{...f,id:editId}:c));
      db.updateClient&&db.updateClient(editId,f).catch(()=>{});
      setEditId(null);setF({...emptyClient});setShow(false);
    }else{
      const newClient={...f,id:Date.now()};
      setCls(prev=>[...prev,newClient]);
      setF({...emptyClient});setShow(false);
      db.createClient(f).then(saved=>{
        if(saved){setCls(prev=>prev.map(c=>c.id===newClient.id?{...newClient,id:saved.id}:c));}
      }).catch(()=>{});
    }
  };
  const startEdit=(c)=>{setF({...c});setEditId(c.id);setShow(true);setSel(null);};
  const deleteClient=(id)=>{
    if(!confirm("Eliminar este cliente?")) return;
    setCls(prev=>prev.filter(c=>c.id!==id));
    db.deleteClient&&db.deleteClient(id).catch(()=>{});
    setSel(null);
  };
  const deleteLog=(idx)=>{
    ACTIVITY_LOG.splice(idx,1);
    db.deleteActivity&&db.deleteActivity(idx).catch(()=>{});
    forceUpdate(n=>n+1);
  };
  const clearAllLogs=()=>{
    if(!confirm("Borrar TODO el registro de actividad?")) return;
    ACTIVITY_LOG.length=0;
    db.clearActivity&&db.clearActivity().catch(()=>{});
    forceUpdate(n=>n+1);
  };

  const allLog=ACTIVITY_LOG;
  const filteredLog=logFilter==="all"?allLog:getLogForClient(logFilter);
  const clientNames=[...new Set(allLog.map(e=>e.client))].filter(n=>n!=="Sin asignar");

  const ClientFormJSX=<Crd sx={{marginBottom:20}}>
    <h4 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 16px"}}>{editId?"Editar Cliente":"Nuevo Cliente"}</h4>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:16}}>
      <Fld label="Nombre / Razón Social *"><Inp value={f.nombre} onChange={v=>setF({...f,nombre:v})} ph="Nombre"/></Fld>
      <Fld label="NIF / CIF *"><Inp value={f.nif} onChange={v=>setF({...f,nif:v})} ph="B12345678"/></Fld>
      <Fld label="Dirección Fiscal"><Inp value={f.dirFiscal} onChange={v=>setF({...f,dirFiscal:v})} ph="C/ Mayor 15"/></Fld>
      <Fld label="CP"><Inp value={f.cpFiscal} onChange={v=>setF({...f,cpFiscal:v})} ph="03001"/></Fld>
      <Fld label="Ciudad"><Inp value={f.ciudadFiscal} onChange={v=>setF({...f,ciudadFiscal:v})} ph="Alicante"/></Fld>
      <Fld label="Provincia"><Inp value={f.provinciaFiscal} onChange={v=>setF({...f,provinciaFiscal:v})} ph="Alicante"/></Fld>
      <Fld label="Email"><Inp value={f.email} onChange={v=>setF({...f,email:v})} ph="info@clinica.es"/></Fld>
      <Fld label="Teléfono"><Inp value={f.telefono} onChange={v=>setF({...f,telefono:v})} ph="+34 600 000 000"/></Fld>
      <Fld label="Web"><Inp value={f.web} onChange={v=>setF({...f,web:v})} ph="www.clinica.es"/></Fld>
      <Fld label="Contacto"><Inp value={f.contacto} onChange={v=>setF({...f,contacto:v})} ph="Nombre responsable"/></Fld>
      <Fld label="Nicho"><Sel value={f.nicho} onChange={v=>setF({...f,nicho:v})} opts={NICHES.map(n=>n.lb)} ph="Sector..."/></Fld>
      <Fld label="Plan"><Sel value={f.plan} onChange={v=>setF({...f,plan:v})} opts={PLANS.map(p=>({value:p.lb,label:`${p.lb} (${p.price} EUR)`}))}/></Fld>
      <Fld label="Presupuesto total (EUR)"><Inp value={f.presupuesto} onChange={v=>setF({...f,presupuesto:v})} ph="Ej: 3000"/></Fld>
      <Fld label="Cuota mensual (EUR)"><Inp value={f.cuotaMensual} onChange={v=>setF({...f,cuotaMensual:v})} ph="Ej: 497"/></Fld>
      <Fld label="Forma pago"><Sel value={f.formaPago} onChange={v=>setF({...f,formaPago:v})} opts={["Transferencia","Domiciliación","Tarjeta","Efectivo"]}/></Fld>
      <Fld label="Fecha alta"><Inp value={f.fechaAlta} onChange={v=>setF({...f,fechaAlta:v})} type="date"/></Fld>
    </div>
    <Fld label="Servicios contratados"><Txa value={f.servicios} onChange={v=>setF({...f,servicios:v})} ph="SEO local, redes sociales, Google Ads..." rows={2}/></Fld>
    <Fld label="Notas"><Txa value={f.notas} onChange={v=>setF({...f,notas:v})} ph="Observaciones..." rows={2}/></Fld>
    <div style={{marginTop:12,display:"flex",gap:10}}>
      <Btn primary small onClick={save}>{editId?"Actualizar":"Guardar"}</Btn>
      <Btn small onClick={()=>{setShow(false);setEditId(null);setF({...emptyClient});}}>Cancelar</Btn>
    </div>
  </Crd>;

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
      <div>
        <h3 style={{fontSize:18,fontWeight:700,color:C.w,margin:0}}>Gestión de Clientes</h3>
        <p style={{fontSize:13,color:C.tx,margin:"4px 0 0"}}>{cls.length} clientes - {allLog.length} consultas</p>
      </div>
      <Btn primary onClick={()=>{setShow(!show);setSel(null);setEditId(null);setF({...emptyClient});}}>+ Nuevo Cliente</Btn>
    </div>

    <Tab tabs={[{id:"list",lb:"Clientes"},{id:"log",lb:"Biblioteca ("+allLog.length+")"},{id:"logclient",lb:"Log por Cliente"}]} active={tab} onChange={setTab}/>

    {tab==="list"&&show&&ClientFormJSX}

    {tab==="list"&&cls.map(c=>{
      const clientLog=getLogForClient(c.nombre);
      return <div key={c.id} style={{background:sel===c.id?C.sf2:C.sf,border:"1px solid "+(sel===c.id?C.teal:C.bd),borderRadius:10,padding:"14px 20px",marginBottom:8,cursor:"pointer"}} onClick={()=>setSel(sel===c.id?null:c.id)}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:38,height:38,borderRadius:8,background:bg8(C.teal),display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:C.teal}}>{c.nombre[0]}</div>
            <div>
              <div style={{fontSize:14,fontWeight:600,color:C.w}}>{c.nombre}</div>
              <div style={{fontSize:12,color:C.tx}}>{mask(c.nif)} - {c.ciudadFiscal||c.email}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <Badge text={c.nicho||"Sin sector"} color={C.purple}/>
            <Badge text={c.plan} color={c.plan==="Premium"?C.gold:c.plan==="Profesional"?C.blue:C.teal}/>
            {c.cuotaMensual&&<Badge text={c.cuotaMensual+" EUR/mes"} color={C.green}/>}
            {clientLog.length>0&&<Badge text={clientLog.length+" consultas"} color={C.cyan}/>}
          </div>
        </div>
        {sel===c.id&&<div style={{marginTop:16,paddingTop:16,borderTop:"1px solid "+C.bd}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:8,fontSize:13,marginBottom:12}}>
            <div><span style={{color:C.txD}}>NIF/CIF:</span> <span style={{color:C.w}}>{mask(c.nif)}</span></div>
            <div><span style={{color:C.txD}}>Email:</span> <span style={{color:C.w}}>{c.email||"-"}</span></div>
            <div><span style={{color:C.txD}}>Tel:</span> <span style={{color:C.w}}>{mask(c.telefono)}</span></div>
            <div><span style={{color:C.txD}}>Web:</span> <span style={{color:C.w}}>{c.web||"-"}</span></div>
            <div><span style={{color:C.txD}}>Plan:</span> <span style={{color:C.w}}>{c.plan}</span></div>
            <div><span style={{color:C.txD}}>Cuota:</span> <span style={{color:C.green}}>{c.cuotaMensual?c.cuotaMensual+" EUR/mes":"-"}</span></div>
            <div><span style={{color:C.txD}}>Presupuesto:</span> <span style={{color:C.gold}}>{c.presupuesto?c.presupuesto+" EUR":"-"}</span></div>
            <div><span style={{color:C.txD}}>Pago:</span> <span style={{color:C.w}}>{c.formaPago||"-"}</span></div>
            <div><span style={{color:C.txD}}>Alta:</span> <span style={{color:C.w}}>{c.fechaAlta||"-"}</span></div>
            <div><span style={{color:C.txD}}>Contacto:</span> <span style={{color:C.w}}>{c.contacto||"-"}</span></div>
            {c.servicios&&<div style={{gridColumn:"1/-1"}}><span style={{color:C.txD}}>Servicios:</span> <span style={{color:C.w}}>{c.servicios}</span></div>}
            {c.notas&&<div style={{gridColumn:"1/-1"}}><span style={{color:C.txD}}>Notas:</span> <span style={{color:C.w}}>{c.notas}</span></div>}
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Btn small primary color={C.blue} onClick={(e)=>{e.stopPropagation();startEdit(c);}}>Editar</Btn>
            <Btn small primary color={C.teal} onClick={(e)=>{e.stopPropagation();setLopdClient(c);}}>LOPD</Btn>
            {clientLog.length>0&&<Btn small primary color={C.cyan} onClick={(e)=>{e.stopPropagation();exportLogPDF(clientLog,c.nombre);}}>Log PDF</Btn>}
            <Btn small primary color={C.green} onClick={async(e)=>{
              e.stopPropagation();
              try{
                const token=await db.getShareToken(c.id);
                if(token){
                  const url=window.location.origin+"/api/client-view?token="+token;
                  setShareLink(url);
                  if(navigator.clipboard&&navigator.clipboard.writeText){
                    navigator.clipboard.writeText(url).catch(()=>{});
                  }
                }else{setShareLink("error");}
              }catch(err){setShareLink("error");}
            }}>Compartir</Btn>
            <Btn small color={C.red} onClick={(e)=>{e.stopPropagation();deleteClient(c.id);}}>Eliminar</Btn>
          </div>
          {shareLink&&shareLink!=="error"&&sel===c.id&&<div style={{marginTop:8,padding:"8px 12px",background:C.bg,border:"1px solid "+C.teal,borderRadius:8,display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:11,color:C.teal,fontWeight:600}}>Enlace copiado:</span>
            <input readOnly value={shareLink} onClick={e=>{e.stopPropagation();e.target.select();}} style={{fontSize:11,color:C.tx,flex:1,background:"transparent",border:"none",outline:"none",fontFamily:font}}/>
            <span onClick={(e)=>{e.stopPropagation();window.open(shareLink,"_blank");}} style={{fontSize:11,color:C.blue,cursor:"pointer",whiteSpace:"nowrap"}}>Abrir</span>
          </div>}
          {shareLink==="error"&&sel===c.id&&<div style={{marginTop:8,padding:"8px 12px",background:C.bg,border:"1px solid "+C.rose,borderRadius:8}}>
            <span style={{fontSize:11,color:C.rose}}>Error al generar enlace. Verifica que client-view.js este en api/.</span>
          </div>}
        </div>}
      </div>;
    })}
    {tab==="list"&&cls.length===0&&!show&&<Crd sx={{textAlign:"center",padding:40}}>
      <p style={{color:C.txD,fontSize:14}}>No hay clientes. Pulsa "+ Nuevo Cliente".</p>
    </Crd>}

    {tab==="log"&&<div>
      <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <Inp value={logSearch} onChange={setLogSearch} ph="Buscar en contenido..." style={{flex:1,minWidth:200}}/>
        <Sel value={logToolFilter} onChange={setLogToolFilter}
          opts={[{v:"all",l:"Todas las herramientas"},...[...new Set(allLog.map(e=>e.tool))].sort().map(t=>({v:t,l:t}))]}
          style={{maxWidth:220}}/>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <Btn small primary color={C.cyan} onClick={()=>exportLogPDF(allLog,"Todos")}>Exportar PDF</Btn>
        {allLog.length>0&&<Btn small color={C.red} onClick={clearAllLogs}>Borrar todo</Btn>}
        <span style={{fontSize:11,color:C.txD,marginLeft:"auto"}}>
          {(()=>{const f=allLog.filter(e=>{
            if(logToolFilter!=="all"&&e.tool!==logToolFilter) return false;
            if(logSearch&&!(e.fullOutput||"").toLowerCase().includes(logSearch.toLowerCase())&&!(e.tool||"").toLowerCase().includes(logSearch.toLowerCase())&&!(e.client||"").toLowerCase().includes(logSearch.toLowerCase())) return false;
            return true;
          });return f.length+" de "+allLog.length+" contenidos";})()}
        </span>
      </div>
      {allLog.length===0?<Crd sx={{textAlign:"center",padding:30}}><p style={{color:C.txD}}>Sin contenido generado. Usa cualquier herramienta para empezar tu biblioteca.</p></Crd>
      :allLog.slice().reverse().filter(e=>{
        if(logToolFilter!=="all"&&e.tool!==logToolFilter) return false;
        if(logSearch&&!(e.fullOutput||"").toLowerCase().includes(logSearch.toLowerCase())&&!(e.tool||"").toLowerCase().includes(logSearch.toLowerCase())&&!(e.client||"").toLowerCase().includes(logSearch.toLowerCase())) return false;
        return true;
      }).map((e,idx)=>{
        const realIdx=allLog.indexOf(e);
        const d=new Date(e.date);
        const isEditing=editLog===realIdx;
        const provLabel=e.provider==="groq"?"Groq":e.provider==="deepseek"?"DeepSeek":e.provider==="fal"?"Fal.ai":"Claude";
        const provColor=e.provider==="groq"?C.green:e.provider==="deepseek"?C.blue:e.provider==="fal"?C.orange:C.purple;
        return <Crd key={e.id||idx} sx={{padding:12,marginBottom:6}}>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6,marginBottom:6}}>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:11,fontWeight:700,color:C.bg,background:C.cyan,padding:"2px 8px",borderRadius:4}}>{e.tool}</span>
              <span style={{fontSize:12,color:C.w}}>{e.client}</span>
              <span style={{fontSize:9,padding:"1px 6px",borderRadius:3,background:provColor+"25",color:provColor}}>{provLabel}</span>
              {e.estCost>0&&<span style={{fontSize:9,color:C.txD}}>${(e.estCost||0).toFixed(4)}</span>}
            </div>
            <span style={{fontSize:11,color:C.txD}}>{d.toLocaleDateString("es-ES")} {d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}</span>
          </div>
          {isEditing?<div>
            <Txa value={e.fullOutput} onChange={v=>{ACTIVITY_LOG[realIdx].fullOutput=v;ACTIVITY_LOG[realIdx].preview=v.slice(0,300);forceUpdate(n=>n+1);}} rows={6}/>
            <div style={{display:"flex",gap:6,marginTop:6}}>
              <Btn small primary onClick={()=>setEditLog(null)}>Cerrar</Btn>
            </div>
          </div>:<div>
            <div style={{fontSize:12,color:C.tx,lineHeight:1.5,maxHeight:60,overflow:"hidden"}}>{e.preview}</div>
            <div style={{display:"flex",gap:6,marginTop:6}}>
              <Btn small onClick={()=>navigator.clipboard.writeText(e.fullOutput)}>Copiar</Btn>
              <Btn small onClick={()=>setEditLog(realIdx)}>Ver / Editar</Btn>
              <Btn small color={C.red} onClick={()=>deleteLog(realIdx)}>Borrar</Btn>
            </div>
          </div>}
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
            <div style={{display:"flex",gap:6,marginTop:6}}>
              <Btn small onClick={()=>navigator.clipboard.writeText(e.fullOutput)}>Copiar</Btn>
            </div>
          </div>;
        })}
      </div>
    </div>}

    {lopdClient&&<LOPDDocument client={lopdClient} onClose={()=>setLopdClient(null)}/>}
  </div>;
}

/* ══════ MULTIPLICADOR DE CONTENIDO ══════ */
function ContentMultiplier(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[nm,sNm]=useState("");
  const[ci,sCi]=useState("");const[pv,sPv]=useState("");const[br,sBr]=useState("");
  const[src,setSrc]=useState("");const[srcType,setSrcType]=useState("Texto libre");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const[chTab,setChTab]=useState("all");
  const nR=resolveNiche(ni,cni);const geo=geoStr(ci,pv,br);
  const channels=["Instagram Post","Instagram Reels","TikTok","Blog SEO","Email Marketing","WhatsApp","Google Business Post","LinkedIn"];

  const parseChannels=(text)=>{
    const sections={};let current="all";
    text.split("\n").forEach(line=>{
      const found=channels.find(ch=>line.toUpperCase().includes(ch.toUpperCase()));
      if(found&&(line.startsWith("=")||line.startsWith("-")||line.startsWith("#")||line.includes("---")||line.match(/^\d+[\.\)]/)||line.toUpperCase().startsWith(found.toUpperCase()))){
        current=found;sections[current]=(sections[current]||"")+"\n";
      }
      sections[current]=(sections[current]||"")+line+"\n";
    });
    return sections;
  };

  const filtered=o?chTab==="all"?o:(() => {const s=parseChannels(o);return s[chTab]||"No se encontro contenido para este canal. Genera de nuevo.";})():"";

  return <div>
    <div style={{marginBottom:20}}>
      <h3 style={{fontSize:18,fontWeight:700,color:C.w,margin:"0 0 4px"}}>Multiplicador de Contenido IA</h3>
      <p style={{fontSize:13,color:C.tx,margin:0}}>1 texto origen = 8 versiones optimizadas para cada canal</p>
    </div>
    <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
      <div style={{flex:"0 0 400px",maxWidth:"100%"}}><Crd>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
          <Fld label="Centro"><Inp value={nm} onChange={sNm} ph="Nombre del centro"/></Fld>
          <GeoFields city={ci} setCity={sCi} province={pv} setProvince={sPv} barrio={br} setBarrio={sBr}/>
          <Fld label="Tipo de contenido origen"><Sel value={srcType} onChange={setSrcType} opts={["Texto libre","Artículo blog","Descripción servicio","Noticia/novedad","Caso de éxito","Oferta/promoción","Evento","FAQ / Pregunta frecuente"]}/></Fld>
          <Fld label="Contenido origen *"><Txa value={src} onChange={setSrc} ph="Pega aqui el texto base, describe el tema o escribe la idea principal. La IA lo adaptara a 8 canales diferentes con formato, tono y longitud optimizados para cada uno..." rows={8}/></Fld>
          <Btn primary disabled={!src||!ni} color={C.cyan} onClick={()=>{
            setChTab("all");
            ai("Equipo de content marketing en 2026. Transforma UN contenido en 8 piezas DIFERENTES optimizadas por canal. No recicles texto, adapta formato/tono/estructura/gancho/CTA nativamente. Usa tendencias y formatos actuales de cada plataforma.",
            `CONTENIDO ORIGEN (${srcType}):
"""
${src}
"""
Centro: ${nm||"[Nombre]"}. Sector: ${nR}. Geo: ${geo}.

8 VERSIONES COMPLETAS LISTAS PARA PUBLICAR (separa cada canal con ========):

1. INSTAGRAM POST: caption completo con gancho primera linea, 15 hashtags (5 generales+5 nicho+5 locales), slides si carrusel, mejor hora
2. INSTAGRAM REELS (30-60s): gancho 3s, script con tiempos, texto pantalla, audio sugerido, caption
3. TIKTOK (15-45s): gancho viral nativo TikTok, script 1a persona, overlay, trending hashtags
4. BLOG SEO: title tag (60 chars+keyword+ciudad), meta description, H1/H2/H3, articulo 600-800 palabras, FAQ x3, CTA
5. EMAIL: 3 subject lines, preview text, cuerpo completo, mejor dia/hora
6. WHATSAPP: mensaje 160 palabras, variante con enlace, variante engagement, cumplimiento RGPD
7. GOOGLE BUSINESS POST: tipo apropiado, texto optimizado, CTA Google, keywords locales
8. LINKEDIN: tono B2B, gancho primera linea, max 5 hashtags
CALENDARIO: orden publicacion + planificacion semanal`,sO,sL,nR,geo,
            {tool:"Multiplicador Contenido",client:nm||"Sin asignar",inputs:{tipo:srcType,origen:src.slice(0,80)}});
          }}>Multiplicar a 8 Canales</Btn>
        </div>
      </Crd></div>
      <div style={{flex:1,minWidth:300}}>
        {o&&<div style={{marginBottom:12}}>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",background:C.sf2,borderRadius:8,padding:4}}>
            <button onClick={()=>setChTab("all")} style={{padding:"6px 12px",borderRadius:6,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",background:chTab==="all"?C.sf:"transparent",color:chTab==="all"?C.w:C.txD,fontFamily:font}}>Todo</button>
            {channels.map(ch=><button key={ch} onClick={()=>setChTab(ch)} style={{padding:"6px 10px",borderRadius:6,border:"none",fontSize:10,fontWeight:600,cursor:"pointer",background:chTab===ch?C.sf:"transparent",color:chTab===ch?C.cyan:C.txD,fontFamily:font,whiteSpace:"nowrap"}}>{ch.replace("Instagram ","IG ").replace("Email Marketing","Email").replace("Google Business Post","GBP")}</button>)}
          </div>
        </div>}
        <Out content={filtered} loading={l} label="Contenido Multiplicado"/>
      </div>
    </div>
  </div>;
}

/* ══════ GENERADOR DE PROPUESTAS COMERCIALES ══════ */
function ProposalGenerator(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");
  const[nm,sNm]=useState("");const[ci,sCi]=useState("");const[pv,sPv]=useState("");const[br,sBr]=useState("");
  const[web,sWeb]=useState("");const[contacto,sContacto]=useState("");
  const[plan,setPlan]=useState("Profesional");const[obj,sObj]=useState("");
  const[comp,sComp]=useState("");const[notas,sNotas]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);const geo=geoStr(ci,pv,br);

  const printProposal=(content,clientName)=>{
    const today=new Date().toLocaleDateString("es-ES",{day:"2-digit",month:"long",year:"numeric"});
    let html=`<html><head><title>Propuesta - ${clientName}</title><style>
      @page{margin:30mm 25mm}
      body{font-family:'Segoe UI',Helvetica,sans-serif;color:#1a1a2e;line-height:1.7;font-size:13px;max-width:850px;margin:auto;padding:40px 50px}
      .cover{text-align:center;padding:80px 0 60px;border-bottom:3px solid #2DD4BF;margin-bottom:40px;page-break-after:always}
      .cover h1{font-size:28px;color:#2DD4BF;margin:0 0 8px;letter-spacing:-0.5px}
      .cover h2{font-size:18px;color:#1a1a2e;font-weight:400;margin:0 0 30px}
      .cover .meta{font-size:13px;color:#666;margin-top:40px}
      .cover .logo{font-size:32px;font-weight:800;color:#2DD4BF;margin-bottom:20px}
      h2{font-size:16px;color:#2DD4BF;border-bottom:1px solid #e0e0e0;padding-bottom:6px;margin:30px 0 12px}
      h3{font-size:14px;color:#1a1a2e;margin:20px 0 8px}
      .highlight{background:#f0faf8;border-left:3px solid #2DD4BF;padding:12px 16px;margin:12px 0;border-radius:0 6px 6px 0}
      .price-box{background:#1a1a2e;color:white;padding:20px 24px;border-radius:10px;margin:16px 0;text-align:center}
      .price-box .amount{font-size:36px;font-weight:800;color:#2DD4BF}
      .price-box .period{font-size:13px;color:#94A3B8}
      .roi-box{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0}
      .roi-item{flex:1;min-width:150px;background:#f8f8fc;border:1px solid #e8e8f0;border-radius:8px;padding:16px;text-align:center}
      .roi-val{font-size:22px;font-weight:700;color:#2DD4BF}
      .roi-lbl{font-size:11px;color:#888;margin-top:4px}
      .timeline{border-left:2px solid #2DD4BF;padding-left:20px;margin:16px 0}
      .timeline-item{margin-bottom:16px;position:relative}
      .timeline-item::before{content:'';width:10px;height:10px;background:#2DD4BF;border-radius:50%;position:absolute;left:-25px;top:5px}
      .footer{margin-top:40px;padding-top:16px;border-top:2px solid #e0e0e0;font-size:11px;color:#999;text-align:center}
      table{width:100%;border-collapse:collapse;margin:12px 0}
      th{background:#f0faf8;color:#1a1a2e;padding:8px 12px;text-align:left;font-size:12px;border-bottom:2px solid #2DD4BF}
      td{padding:8px 12px;border-bottom:1px solid #eee;font-size:12px}
      @media print{body{padding:0}.cover{padding:60px 0 40px}}
    </style></head><body>`;
    html+=`<div class="cover">
      <div class="logo">CLINIQ DIGITAL</div>
      <h1>Propuesta de Servicios</h1>
      <h2>${clientName||"[Cliente]"}</h2>
      <div class="meta">${today}<br>${geo}<br>Plan ${plan}</div>
    </div>`;
    html+=`<pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.7">${content.replace(/</g,"&lt;")}</pre>`;
    html+=`<div class="footer">Cliniq Digital | Propuesta confidencial | ${today}<br>Este documento es valido durante 30 dias desde su fecha de emision.</div>`;
    html+=`<script>setTimeout(()=>window.print(),600)<\/script></body></html>`;
    const w=window.open("","_blank");w.document.write(html);
  };

  return <div>
    <div style={{marginBottom:20}}>
      <h3 style={{fontSize:18,fontWeight:700,color:C.w,margin:"0 0 4px"}}>Generador de Propuestas Comerciales</h3>
      <p style={{fontSize:13,color:C.tx,margin:0}}>Propuestas profesionales con estrategia, precios y ROI para cerrar clientes</p>
    </div>
    <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
      <div style={{flex:"0 0 400px",maxWidth:"100%"}}><Crd>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
          <Fld label="Nombre negocio *"><Inp value={nm} onChange={sNm} ph="Clinica Dental Sonrisa"/></Fld>
          <Fld label="Persona de contacto"><Inp value={contacto} onChange={sContacto} ph="Dra. Maria Lopez"/></Fld>
          <GeoFields city={ci} setCity={sCi} province={pv} setProvince={sPv} barrio={br} setBarrio={sBr}/>
          <Fld label="Web actual"><Inp value={web} onChange={sWeb} ph="www.ejemplo.es"/></Fld>
          <Fld label="Plan propuesto"><Sel value={plan} onChange={setPlan} opts={PLANS.map(p=>({value:p.lb,label:`${p.lb} - ${p.price} EUR/mes - ${p.desc}`}))}/></Fld>
          <Fld label="Objetivo principal"><Sel value={obj} onChange={sObj} opts={["Captar más pacientes/clientes","Mejorar presencia digital","Lanzar nuevo servicio","Recuperar pacientes perdidos","Posicionar como referente en la zona","Competir contra franquicias","Abrir nueva ubicación"]} ph="Seleccionar..."/></Fld>
          <Fld label="Competencia conocida"><Inp value={comp} onChange={sComp} ph="Nombres de competidores directos"/></Fld>
          <Fld label="Notas adicionales"><Txa value={notas} onChange={sNotas} ph="Contexto del cliente, objeciones, puntos clave..." rows={3}/></Fld>
          <Btn primary disabled={!nm||!ni||!ci} color={C.gold} onClick={()=>
            ai("Director comercial de agencia de marketing digital en 2026. Propuestas profesionales, persuasivas, con ROI realista y conservador basado en datos actualizados. Sin promesas vacias.",
            `PROPUESTA COMERCIAL para: "${nm}". Contacto: ${contacto||"[Responsable]"}. Sector: ${nR}. Geo: ${geo}. Web: ${web||"N/A"}. Plan: ${plan} (${PLANS.find(p=>p.lb===plan)?.price||"497"} EUR/mes). Objetivo: ${obj||"Captar clientes"}. Competencia: ${comp||"N/A"}. Notas: ${notas||"N/A"}.

Secciones:
1. RESUMEN EJECUTIVO: situacion actual, oportunidad mercado ${geo}, propuesta valor
2. DIAGNOSTICO: presencia digital, gaps, comparativa competencia
3. ESTRATEGIA: objetivos SMART 3/6/12 meses, canales prioritarios, diferenciacion
4. SERVICIOS PLAN ${plan}: detalle exacto servicios mensuales, entregables, herramientas, reuniones
5. TIMELINE: mes 1 setup, mes 2-3 activacion, mes 4-6 optimizacion, mes 7-12 consolidacion
6. ROI: proyeccion conservadora visitas/SEO/Maps/leads/conversion/facturacion adicional vs inversion (datos sector Espana reales)
7. INVERSION: ${PLANS.find(p=>p.lb===plan)?.price||"497"} EUR+IVA, setup, compromiso minimo, comparativa empleado y Google Ads
8. GARANTIAS: diferenciadores, transparencia, sin permanencia, equipo especializado ${nR}
9. SIGUIENTE PASO: CTA, onboarding, disponibilidad
10. CONDICIONES: pago, plazos, validez 30 dias`,sO,sL,nR,geo,
            {tool:"Propuestas Comerciales",client:nm,inputs:{plan:plan,objetivo:obj}})
          }>Generar Propuesta</Btn>
          {o&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:4}}>
            <Btn small primary color={C.gold} onClick={()=>printProposal(o,nm)}>Imprimir / PDF</Btn>
            <Btn small onClick={()=>navigator.clipboard.writeText(o)}>Copiar texto</Btn>
          </div>}
        </div>
      </Crd></div>
      <div style={{flex:1,minWidth:300}}><Out content={o} loading={l} label="Propuesta Comercial"/></div>
    </div>
  </div>;
}

/* ══════ CAMPAÑAS MULTICANAL ══════ */
function MultiCampaign(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[nm,sNm]=useState("");
  const[ci,sCi]=useState("");const[pv,sPv]=useState("");const[br,sBr]=useState("");
  const[obj,sObj]=useState("Lanzar servicio/tratamiento nuevo");
  const[srv,sSrv]=useState("");const[dur,sDur]=useState("4 semanas");
  const[budget,sBudget]=useState("300-500 EUR");const[notas,sNotas]=useState("");
  const[o,sO]=useState("");const[l,sL]=useState(false);
  const nR=resolveNiche(ni,cni);const geo=geoStr(ci,pv,br);

  return <div>
    <div style={{marginBottom:20}}>
      <h3 style={{fontSize:18,fontWeight:700,color:C.w,margin:"0 0 4px"}}>Campañas Multicanal</h3>
      <p style={{fontSize:13,color:C.tx,margin:0}}>1 brief = campaña coordinada completa en todos los canales</p>
    </div>
    <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
      <div style={{flex:"0 0 400px",maxWidth:"100%"}}><Crd>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
          <Fld label="Centro *"><Inp value={nm} onChange={sNm} ph="Nombre del centro"/></Fld>
          <GeoFields city={ci} setCity={sCi} province={pv} setProvince={sPv} barrio={br} setBarrio={sBr}/>
          <Fld label="Objetivo de la campaña"><Sel value={obj} onChange={sObj} opts={["Lanzar servicio/tratamiento nuevo","Promoción estacional (Navidad, verano, vuelta cole...)","Captar primeras consultas","Evento jornada de puertas abiertas","Reactivar pacientes inactivos","Black Friday / oferta limitada","Posicionar como referente","Inauguración / nueva apertura"]}/></Fld>
          <Fld label="Servicio o tema central *"><Inp value={srv} onChange={sSrv} ph="Ej: Blanqueamiento dental, Botox, nuevo equipo laser..."/></Fld>
          <Fld label="Duración"><Sel value={dur} onChange={sDur} opts={["1 semana (flash)","2 semanas","4 semanas","6 semanas","8 semanas"]}/></Fld>
          <Fld label="Presupuesto ads (opcional)"><Sel value={budget} onChange={sBudget} opts={["Sin inversión en ads","100-300 EUR","300-500 EUR","500-1000 EUR","1000-2000 EUR","+2000 EUR"]}/></Fld>
          <Fld label="Contexto adicional"><Txa value={notas} onChange={sNotas} ph="Detalles especificos: oferta concreta, fecha evento, profesional destacado..." rows={3}/></Fld>
          <Btn primary disabled={!srv||!ni||!nm} color={C.rose} onClick={()=>
            ai("Director de campanas multicanal en 2026 para negocios locales. Campanas COORDINADAS donde cada canal refuerza a los demas con timing preciso. Usa formatos y tendencias actuales.",
            `CAMPAÑA MULTICANAL: "${nm}" (${nR}) en ${geo}. Objetivo: ${obj}. Servicio: "${srv}". Duracion: ${dur}. Ads: ${budget}. Notas: ${notas||"N/A"}.

Secciones:
1. BRIEF: concepto creativo (naming, claim, visual key), mensaje principal, publico primario/secundario, tono
2. ARQUITECTURA: fases Teaser>Lanzamiento>Sostenimiento>Cierre, calendario semana a semana, canal por fase
3. TEASER: scripts stories/reels anticipacion, email avance, WhatsApp VIP
4. LANZAMIENTO: post IG (copy+hashtags), reel/TikTok script, GBP, email (subject+body), WhatsApp difusion, 5 stories
5. SOSTENIMIENTO: calendario DIA A DIA con copy COMPLETO por publicacion (Lun-Vie), repetir cada semana
6. CIERRE: countdown stories, email urgencia, WhatsApp cierre
7. PAID MEDIA: ${budget!=="Sin inversión en ads"?`distribucion ${budget} por canal/fase, segmentacion ${geo}, 3 variantes copy anuncios, remarketing`:"100% organico"}
8. VISUAL: key visual descripcion, paleta, prompts IA imagenes principales
9. KPIs: objetivos numericos por canal, checklist optimizacion
10. POST-CAMPAÑA: seguimiento leads, analisis resultados, aprendizajes`,sO,sL,nR,geo,
            {tool:"Campañas Multicanal",client:nm,inputs:{objetivo:obj,servicio:srv,duracion:dur}})
          }>Generar Campaña Completa</Btn>
        </div>
      </Crd></div>
      <div style={{flex:1,minWidth:300}}><Out content={o} loading={l} label="Campaña Multicanal"/></div>
    </div>
  </div>;
}

/* ══════ META ADS PRO ══════ */
function MetaAdsPro(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[tx,sTx]=useState("");const[ctx,sCtx]=useState("");
  const[nm,sNm]=useState("");const[ci,sCi]=useState("");const[pv,sPv]=useState("");const[br,sBr]=useState("");
  const[web,sWeb]=useState("");const[obj,sObj]=useState("Conversiones (leads/citas)");
  const[budget,sBudget]=useState("300-500 EUR/mes");const[dur,sDur]=useState("30 dias");
  const[audience,sAudience]=useState("");const[comp,sComp]=useState("");
  const[usp,sUsp]=useState("");const[offer,sOffer]=useState("");
  const[prevAds,sPrevAds]=useState("No, primera campaña");
  const[tab,setTab]=useState("strategy");
  const[o,sO]=useState("");const[l,sL]=useState(false);const[phase,setPhase]=useState(null);
  const nR=resolveNiche(ni,cni);const geo=geoStr(ci,pv,br);const srv=resolveTx(tx,ctx);

  const genStrategy=()=>{
    setTab("strategy");
    aiSearch("Media Buyer senior de Meta Ads para negocios locales en Espana en 2026. Busca benchmarks reales y actualizados del sector. Recomendaciones accionables, no teoricas.",
    `ESTRATEGIA META ADS para: "${nm||"[Nombre]"}" (${nR}) en ${geo}. Servicio: "${srv||"General"}". Web: ${web||"N/A"}.
Objetivo: ${obj}. Presupuesto: ${budget}. Duracion: ${dur}. Exp. previa: ${prevAds}.
Audiencia: ${audience||"Por definir"}. Competencia: ${comp||"N/A"}. USP: ${usp||"N/A"}. Oferta: ${offer||"N/A"}.

Busca: CPM/CTR/CPL benchmarks 2025-2026 para ${nR} en Espana, politicas Meta sector salud actualizadas.

Genera estas secciones:
1. DIAGNOSTICO PRE-CAMPANA: objetivo vs presupuesto realista, politicas Meta aplicables, requisitos pixel/CAPI/legales
2. ARQUITECTURA CAMPANAS: estructura exacta para Ads Manager con campana prospeccion (intereses + lookalike) y retargeting (web + engagement), segmentacion detallada (edad, genero, radio km, 8-12 intereses), ubicaciones, presupuesto diario por conjunto
3. DISTRIBUCION PRESUPUESTO: desglose ${budget} por campana/dia/semana, fase aprendizaje vs optimizacion
4. FORMATO RECOMENDADO: imagen vs video vs carrusel con justificacion y datos CPM/CTR por formato para ${nR}
5. 6 ANUNCIOS COMPLETOS: para cada uno: copy primario (3 variantes A/B), titulo, descripcion, CTA, prompt IA imagen detallado (Midjourney, ingles, con sujeto, iluminacion, composicion, --ar, --v 6), negative prompt
6. LANDING/TRACKING: pagina destino, eventos pixel, UTMs
7. PROYECCION RESULTADOS: tabla con impresiones, alcance, CTR, CPC, leads, CPL, conversiones, ROAS - estimaciones conservadora/media/alta con datos reales del sector
8. CALENDARIO OPTIMIZACION: dia 1-3, semana 1, semana 2-4, mes 2+, señales alarma y escalado
9. CUMPLIMIENTO POLITICAS META: restricciones ${nR}, claims prohibidos, audiencias limitadas`,sO,sL,nR,geo,setPhase,
    {tool:"Meta Ads Pro",client:nm||"Sin asignar",inputs:{servicio:srv,objetivo:obj,presupuesto:budget}});
  };

  const genCreatives=()=>{
    setTab("creatives");
    ai("Director creativo de Meta Ads en 2026 para negocios locales. Crea creatividades que convierten con los formatos y tendencias actuales. Prompts de imagen IA detallados en ingles (Midjourney v6 / DALL-E 3). Copies que pasan revision Meta.",
    `PACK CREATIVO META ADS para: "${nm||"[Nombre]"}" (${nR}) en ${geo}. Servicio: "${srv||"General"}".
Objetivo: ${obj}. USP: ${usp||"N/A"}. Oferta: ${offer||"Sin oferta"}.

Genera 10 creatividades COMPLETAS listas para producir. Para CADA una incluye: copy primario (3 variantes: emocional/racional/social proof, max 125 chars primera linea), titulo (40 chars), descripcion (30 chars), CTA, y prompt IA imagen detallado en ingles (sujeto, entorno ${nR}, iluminacion, composicion, emocion, --ar, --v 6 --style raw, NO texto en imagen) + negative prompt.

Las 10 creatividades:
1. HERO IMAGE feed 1:1 (1080x1080) - prospeccion
2. STORIES vertical 9:16 (1080x1920) - prospeccion, con overlay texto sugerido
3. CARRUSEL PROCESO 5 tarjetas (1080x1080) - paso a paso del servicio, prompt IA por tarjeta
4. IMAGEN 4:5 vertical (1080x1350) - concepto transformacion sin before/after prohibido
5. TESTIMONIO SOCIAL PROOF 1:1 - resena estilizada como creatividad
6. VIDEO SCRIPT 15s vertical - guion segundo a segundo con texto pantalla y audio
7. VIDEO SCRIPT 30s feed - estructura problema-agitacion-solucion-CTA, thumbnail prompt IA
8. RETARGETING imagen 1:1 - urgencia suave, copy diferente a prospeccion
9. OFERTA/PROMO stories - ${offer||"primera consulta gratuita"}, countdown
10. AUTORIDAD/EQUIPO feed - posicionar profesional como referente

Al final: RESUMEN PRODUCCION con total piezas, orden prioridad lanzamiento, plan A/B testing, rotacion creativa anti-fatiga.`,sO,sL,nR,geo,
    {tool:"Meta Ads Pro - Creatividades",client:nm||"Sin asignar",inputs:{servicio:srv,objetivo:obj}});
  };
  return <div>
    <div style={{marginBottom:20}}>
      <h3 style={{fontSize:18,fontWeight:700,color:C.w,margin:"0 0 4px"}}>Meta Ads Pro</h3>
      <p style={{fontSize:13,color:C.tx,margin:0}}>Campañas profesionales de Facebook e Instagram Ads con creatividades, prompts y proyección</p>
    </div>
    <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
      <div style={{flex:"0 0 400px",maxWidth:"100%"}}><Crd>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
          <TreatmentSelector niche={ni} treatment={tx} setTreatment={sTx} customTx={ctx} setCustomTx={sCtx} label="Servicio foco de la campaña"/>
          <Fld label="Centro *"><Inp value={nm} onChange={sNm} ph="Nombre del centro"/></Fld>
          <GeoFields city={ci} setCity={sCi} province={pv} setProvince={sPv} barrio={br} setBarrio={sBr}/>
          <Fld label="Web"><Inp value={web} onChange={sWeb} ph="www.ejemplo.es"/></Fld>
          <Fld label="Objetivo de campaña"><Sel value={obj} onChange={sObj} opts={["Conversiones (leads/citas)","Trafico cualificado a web","Mensajes WhatsApp/Messenger","Reconocimiento de marca local","Reproducciones de video","Generación de formularios (Lead Ads)"]}/></Fld>
          <Fld label="Presupuesto mensual"><Sel value={budget} onChange={sBudget} opts={["150-300 EUR/mes","300-500 EUR/mes","500-1000 EUR/mes","1000-2000 EUR/mes","2000-5000 EUR/mes","+5000 EUR/mes"]}/></Fld>
          <Fld label="Duración"><Sel value={dur} onChange={sDur} opts={["15 dias (test)","30 dias","60 dias","90 dias","Continua"]}/></Fld>
          <Fld label="Experiencia previa con ads"><Sel value={prevAds} onChange={sPrevAds} opts={["No, primera campaña","Si, con resultados pobres","Si, con resultados aceptables","Si, quiero escalar"]}/></Fld>
          <Fld label="Público objetivo"><Txa value={audience} onChange={sAudience} ph="Ej: Mujeres 30-55, nivel medio-alto, interesadas en estetica, zona Alicante centro + Playa San Juan..." rows={2}/></Fld>
          <Fld label="Diferenciador clave"><Inp value={usp} onChange={sUsp} ph="Ej: 20 años experiencia, tecnologia exclusiva, unico en la zona..."/></Fld>
          <Fld label="Oferta / gancho"><Inp value={offer} onChange={sOffer} ph="Ej: Primera consulta gratuita, 20% dto febrero..."/></Fld>
          <Fld label="Competencia ads"><Inp value={comp} onChange={sComp} ph="Competidores que anuncian en Meta"/></Fld>

          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Btn primary disabled={!ni||!nm||!ci} color={C.blue} onClick={genStrategy} sx={{flex:1}}>Estrategia + Proyección</Btn>
            <Btn primary disabled={!ni||!nm} color={C.rose} onClick={genCreatives} sx={{flex:1}}>Pack Creativo (10 anuncios)</Btn>
          </div>
        </div>
      </Crd></div>
      <div style={{flex:1,minWidth:300}}>
        {(o||l)&&<div style={{marginBottom:12}}>
          <div style={{display:"flex",gap:4,background:C.sf2,borderRadius:8,padding:4}}>
            <button onClick={()=>setTab("strategy")} style={{flex:1,padding:"8px 14px",borderRadius:6,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",background:tab==="strategy"?C.sf:"transparent",color:tab==="strategy"?C.blue:C.txD,fontFamily:font}}>Estrategia</button>
            <button onClick={()=>setTab("creatives")} style={{flex:1,padding:"8px 14px",borderRadius:6,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",background:tab==="creatives"?C.sf:"transparent",color:tab==="creatives"?C.rose:C.txD,fontFamily:font}}>Creatividades</button>
          </div>
        </div>}
        <OutSearch content={o} loading={l} label={tab==="strategy"?"Estrategia Meta Ads":"Pack Creativo Meta Ads"} phase={phase}/>
      </div>
    </div>
  </div>;
}

/* ══════ DASHBOARD PREDICTIVO ══════ */
function PredictiveDashboard(){
  const[ni,sNi]=useState("");const[cni,sCni]=useState("");const[nm,sNm]=useState("");
  const[ci,sCi]=useState("");
  /* Metricas actuales */
  const[visitas,sVisitas]=useState("");const[leads,sLeads]=useState("");const[conv,sConv]=useState("");
  const[ticket,sTicket]=useState("");const[resenas,sResenas]=useState("");const[nota,sNota]=useState("");
  const[seguidores,sSeguidores]=useState("");const[engagement,sEngagement]=useState("");
  const[kwPos,sKwPos]=useState("");const[gbpViews,sGbpViews]=useState("");
  const[inversionAds,sInversionAds]=useState("");const[mesesActivo,sMesesActivo]=useState("3 meses");
  const[o,sO]=useState("");const[l,sL]=useState(false);const[phase,setPhase]=useState(null);
  const[tab,setTab]=useState("projections");
  const nR=resolveNiche(ni,cni);

  /* Simple metric parser */
  const metrics=[
    {lb:"Visitas/mes",v:visitas,cl:C.blue},
    {lb:"Leads/mes",v:leads,cl:C.teal},
    {lb:"Conversiones/mes",v:conv,cl:C.green},
    {lb:"Ticket medio",v:ticket?ticket+"€":"",cl:C.gold},
    {lb:"Reseñas",v:resenas,cl:C.purple},
    {lb:"Nota media",v:nota,cl:nota&&parseFloat(nota)>=4.5?C.green:nota&&parseFloat(nota)>=4?C.gold:C.rose},
    {lb:"Seguidores",v:seguidores,cl:C.cyan},
    {lb:"GBP vistas",v:gbpViews,cl:C.orange},
  ].filter(m=>m.v);

  return <div>
    <div style={{marginBottom:20}}>
      <h3 style={{fontSize:18,fontWeight:700,color:C.w,margin:"0 0 4px"}}>Dashboard Predictivo</h3>
      <p style={{fontSize:13,color:C.tx,margin:0}}>Métricas actuales + proyección IA a 3, 6 y 12 meses</p>
    </div>

    {metrics.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:20}}>
      {metrics.map(m=><div key={m.lb} style={{background:C.sf,border:"1px solid "+C.bd,borderRadius:10,padding:"12px 16px",borderTop:"2px solid "+m.cl}}>
        <div style={{fontSize:10,color:C.tx,marginBottom:4}}>{m.lb}</div>
        <div style={{fontSize:20,fontWeight:700,color:m.cl}}>{m.v}</div>
      </div>)}
    </div>}

    <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
      <div style={{flex:"0 0 400px",maxWidth:"100%"}}><Crd>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <NicheSelector niche={ni} setNiche={sNi} customNiche={cni} setCustomNiche={sCni} onClientSelect={({nombre,ciudad})=>{sNm(nombre);sCi(ciudad);}}/>
          <Fld label="Centro *"><Inp value={nm} onChange={sNm} ph="Nombre"/></Fld>
          <Fld label="Ciudad *"><Inp value={ci} onChange={sCi} ph="Alicante"/></Fld>
          <Fld label="Meses activo con marketing digital"><Sel value={mesesActivo} onChange={sMesesActivo} opts={["Empezando (0 meses)","1-2 meses","3 meses","6 meses","12 meses","+12 meses"]}/></Fld>
          <div style={{fontSize:11,fontWeight:600,color:C.teal,letterSpacing:0.5,textTransform:"uppercase",marginTop:4}}>Metricas actuales</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Fld label="Visitas web/mes"><Inp value={visitas} onChange={sVisitas} ph="Ej: 1200"/></Fld>
            <Fld label="Leads/consultas mes"><Inp value={leads} onChange={sLeads} ph="Ej: 45"/></Fld>
            <Fld label="Conversiones/mes"><Inp value={conv} onChange={sConv} ph="Ej: 12"/></Fld>
            <Fld label="Ticket medio (EUR)"><Inp value={ticket} onChange={sTicket} ph="Ej: 350"/></Fld>
            <Fld label="Reseñas Google (total)"><Inp value={resenas} onChange={sResenas} ph="Ej: 87"/></Fld>
            <Fld label="Nota media Google"><Inp value={nota} onChange={sNota} ph="Ej: 4.6"/></Fld>
            <Fld label="Seguidores RRSS"><Inp value={seguidores} onChange={sSeguidores} ph="Ej: 2300"/></Fld>
            <Fld label="Vistas GBP/mes"><Inp value={gbpViews} onChange={sGbpViews} ph="Ej: 5400"/></Fld>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Fld label="Posiciones SEO clave"><Inp value={kwPos} onChange={sKwPos} ph="kw1 #pos, kw2 #pos"/></Fld>
            <Fld label="Inversión ads/mes"><Inp value={inversionAds} onChange={sInversionAds} ph="Ej: 500"/></Fld>
          </div>
          <Btn primary disabled={!nm||!ni||!ci} color={C.green} onClick={()=>{
            setTab("projections");
            aiSearch("Analista de marketing digital en 2026. Proyecciones REALISTAS con benchmarks actualizados del sector en Espana. Rangos conservadores. Busca datos reales recientes.",
            `DASHBOARD PREDICTIVO: "${nm}" en ${ci}. Sector: ${nR}. Meses activo: ${mesesActivo}.
Metricas: ${[visitas&&"visitas:"+visitas,leads&&"leads:"+leads,conv&&"conv:"+conv,ticket&&"ticket:"+ticket+"EUR",resenas&&"resenas:"+resenas+"("+nota+")",seguidores&&"seguidores:"+seguidores,gbpViews&&"GBP:"+gbpViews,kwPos&&"SEO:"+kwPos,inversionAds&&"ads:"+inversionAds+"EUR"].filter(Boolean).join(", ")||"Sin metricas"}.

Busca benchmarks 2025-2026 ${nR} Espana: conversion, ticket medio, crecimiento organico.

Secciones:
1. ESTADO ACTUAL: cada metrica vs benchmark, puntuacion /100, fortalezas/debilidades
2. PROYECCION 3 MESES: tabla Metrica|Actual|Proyeccion|Variacion%, ingresos adicionales estimados
3. PROYECCION 6 MESES: misma tabla, efecto acumulativo SEO, ROI acumulado
4. PROYECCION 12 MESES: misma tabla, madurez canales, ROI anual
5. ALERTAS: senales alarma, cuellos botella, plan B
6. QUICK WINS: 5 acciones impacto <30 dias (accion, impacto estimado, esfuerzo)
7. RECOMENDACIONES: donde invertir, canales prioritarios, estacionalidad ${nR}
8. SCORECARD: KPIs mensuales, valores objetivo, semaforo verde/amarillo/rojo`,sO,sL,nR,ci||"Espana",setPhase,
            {tool:"Dashboard Predictivo",client:nm,inputs:{visitas:visitas,leads:leads,conv:conv}});
          }}>Generar Proyección con IA</Btn>
        </div>
      </Crd></div>
      <div style={{flex:1,minWidth:300}}><OutSearch content={o} loading={l} label="Dashboard Predictivo" phase={phase}/></div>
    </div>
  </div>;
}

/* ══════ TASKS ══════ */
function Tasks(){
  const[tasks,setTasks]=useState([]);
  const[cls,setCls]=useState([]);
  const[show,setShow]=useState(false);
  const[filter,setFilter]=useState("pendiente");
  const[clientFilter,setClientFilter]=useState("all");
  const[editId,setEditId]=useState(null);
  const[f,setF]=useState({title:"",description:"",client:"General",priority:"media",due_date:""});

  useEffect(()=>{
    db.getTasks().then(d=>d&&setTasks(d)).catch(()=>{});
    db.getClients().then(d=>d&&d.length>0&&setCls(d.map(r=>r.nombre||""))).catch(()=>{});
  },[]);

  const save=()=>{
    if(!f.title.trim()) return;
    if(editId){
      db.updateTask(editId,f).then(saved=>{
        if(saved) setTasks(prev=>prev.map(t=>t.id===editId?{...saved}:t));
      });
      setEditId(null);
    }else{
      db.createTask(f).then(saved=>{
        if(saved) setTasks(prev=>[saved,...prev]);
      });
    }
    setF({title:"",description:"",client:"General",priority:"media",due_date:""});
    setShow(false);
  };

  const toggle=(task)=>{
    const newStatus=task.status==="completada"?"pendiente":"completada";
    db.updateTask(task.id,{status:newStatus}).then(saved=>{
      if(saved) setTasks(prev=>prev.map(t=>t.id===task.id?{...saved}:t));
    });
  };

  const setProg=(task)=>{
    db.updateTask(task.id,{status:"en_progreso"}).then(saved=>{
      if(saved) setTasks(prev=>prev.map(t=>t.id===task.id?{...saved}:t));
    });
  };

  const del=(id)=>{
    if(!confirm("Eliminar tarea?")) return;
    db.deleteTask(id);
    setTasks(prev=>prev.filter(t=>t.id!==id));
  };

  const startEdit=(t)=>{
    setF({title:t.title,description:t.description||"",client:t.client_name||"General",priority:t.priority||"media",due_date:t.due_date?t.due_date.split("T")[0]:""});
    setEditId(t.id);setShow(true);
  };

  const filtered=tasks.filter(t=>{
    if(filter!=="all"&&t.status!==filter) return false;
    if(clientFilter!=="all"&&t.client_name!==clientFilter) return false;
    return true;
  });

  const priColors={alta:C.rose,media:C.gold,baja:C.green};
  const statusColors={pendiente:C.orange,en_progreso:C.blue,completada:C.green};
  const statusLabels={pendiente:"Pendiente",en_progreso:"En progreso",completada:"Completada"};

  const pendCount=tasks.filter(t=>t.status==="pendiente").length;
  const progCount=tasks.filter(t=>t.status==="en_progreso").length;
  const doneCount=tasks.filter(t=>t.status==="completada").length;
  const overdueCount=tasks.filter(t=>t.status!=="completada"&&t.due_date&&new Date(t.due_date)<new Date()).length;

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div>
        <h2 style={{fontSize:20,fontWeight:700,color:C.w,margin:0}}>Tareas / Pendientes</h2>
        <p style={{fontSize:12,color:C.txD,margin:"4px 0 0"}}>
          {pendCount} pendientes, {progCount} en progreso, {doneCount} completadas
          {overdueCount>0&&<span style={{color:C.rose}}> - {overdueCount} vencidas</span>}
        </p>
      </div>
      <Btn onClick={()=>{setF({title:"",description:"",client:"General",priority:"media",due_date:""});setEditId(null);setShow(true);}}>+ Nueva tarea</Btn>
    </div>

    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
      {[["all","Todas"],["pendiente","Pendientes"],["en_progreso","En progreso"],["completada","Completadas"]].map(([v,l])=>
        <span key={v} onClick={()=>setFilter(v)} style={{padding:"5px 14px",borderRadius:8,fontSize:12,cursor:"pointer",
          background:filter===v?C.teal:"transparent",color:filter===v?C.bg:C.tx,border:"1px solid "+(filter===v?C.teal:C.bd)}}>{l}</span>
      )}
      <Sel value={clientFilter} onChange={setClientFilter}
        opts={[{v:"all",l:"Todos los clientes"},...cls.map(n=>({v:n,l:n})),{v:"General",l:"General"}]}
        style={{marginLeft:"auto",maxWidth:200}}/>
    </div>

    {show&&<Crd style={{marginBottom:16}}>
      <h3 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 12px"}}>{editId?"Editar tarea":"Nueva tarea"}</h3>
      <Fld label="Titulo"><Inp value={f.title} onChange={v=>setF({...f,title:v})} ph="Que hay que hacer?"/></Fld>
      <Fld label="Descripcion (opcional)"><Txa value={f.description} onChange={v=>setF({...f,description:v})} rows={2} ph="Detalles extra..."/></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        <Fld label="Cliente"><Sel value={f.client} onChange={v=>setF({...f,client:v})} opts={[{v:"General",l:"General"},...cls.map(n=>({v:n,l:n}))]}/></Fld>
        <Fld label="Prioridad"><Sel value={f.priority} onChange={v=>setF({...f,priority:v})} opts={[{v:"alta",l:"Alta"},{v:"media",l:"Media"},{v:"baja",l:"Baja"}]}/></Fld>
        <Fld label="Fecha limite"><Inp type="date" value={f.due_date} onChange={v=>setF({...f,due_date:v})}/></Fld>
      </div>
      <div style={{display:"flex",gap:8,marginTop:10}}>
        <Btn onClick={save}>{editId?"Guardar cambios":"Crear tarea"}</Btn>
        <Btn onClick={()=>{setShow(false);setEditId(null);}} style={{background:C.sf2}}>Cancelar</Btn>
      </div>
    </Crd>}

    {filtered.length===0&&<Crd><p style={{fontSize:13,color:C.txD,textAlign:"center",padding:20}}>
      {filter==="all"?"No hay tareas. Crea la primera con el boton de arriba.":"Sin tareas con este filtro."}
    </p></Crd>}

    {filtered.map(t=>{
      const isOverdue=t.status!=="completada"&&t.due_date&&new Date(t.due_date)<new Date();
      const dueStr=t.due_date?new Date(t.due_date).toLocaleDateString("es-ES",{day:"numeric",month:"short"}):"";
      return <div key={t.id} style={{background:C.sf,border:"1px solid "+(isOverdue?C.rose:C.bd),borderRadius:10,padding:"12px 16px",marginBottom:8,
        borderLeft:"4px solid "+(statusColors[t.status]||C.bd),opacity:t.status==="completada"?0.6:1}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
          <div onClick={()=>toggle(t)} style={{width:22,height:22,borderRadius:6,border:"2px solid "+(t.status==="completada"?C.green:C.bd),
            background:t.status==="completada"?C.green:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
            flexShrink:0,marginTop:2}}>
            {t.status==="completada"&&<span style={{color:C.bg,fontSize:14,fontWeight:700}}>✓</span>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:14,fontWeight:600,color:t.status==="completada"?C.txD:C.w,
                textDecoration:t.status==="completada"?"line-through":"none"}}>{t.title}</span>
              <span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:priColors[t.priority]||C.gold,color:C.bg,fontWeight:600}}>{t.priority}</span>
              {t.client_name&&t.client_name!=="General"&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:C.teal+"30",color:C.teal}}>{t.client_name}</span>}
              {dueStr&&<span style={{fontSize:10,color:isOverdue?C.rose:C.txD}}>{isOverdue?"Vencida: ":""}{dueStr}</span>}
            </div>
            {t.description&&<p style={{fontSize:12,color:C.txD,margin:"4px 0 0",lineHeight:1.4}}>{t.description}</p>}
          </div>
          <div style={{display:"flex",gap:4,flexShrink:0}}>
            {t.status==="pendiente"&&<span onClick={()=>setProg(t)} title="Marcar en progreso" style={{cursor:"pointer",fontSize:12,padding:"4px 8px",borderRadius:6,background:C.blue+"20",color:C.blue}}>▶</span>}
            <span onClick={()=>startEdit(t)} style={{cursor:"pointer",fontSize:12,padding:"4px 8px",borderRadius:6,background:C.sf2,color:C.tx}}>✎</span>
            <span onClick={()=>del(t.id)} style={{cursor:"pointer",fontSize:12,padding:"4px 8px",borderRadius:6,background:C.rose+"20",color:C.rose}}>✕</span>
          </div>
        </div>
      </div>;
    })}
  </div>;
}

/* ══════ HOME ══════ */
function Home({go}){
  const[cls,setCls]=useState([]);
  const[pendingTasks,setPendingTasks]=useState(0);
  const[overdueTasks,setOverdueTasks]=useState(0);
  const[,tick]=useState(0);
  useEffect(()=>{
    db.getClients().then(data=>{
      if(data&&data.length>0) setCls(data.map(r=>({
        nombre:r.nombre||"",plan:r.plan||"Esencial",nicho:r.nicho||"",
        cuotaMensual:r.cuota_mensual||r.cuotaMensual||"",fechaAlta:r.fecha_alta||""
      })));
    }).catch(()=>{});
    db.getTasks&&db.getTasks().then(d=>{
      if(d){
        setPendingTasks(d.filter(t=>t.status!=="completada").length);
        setOverdueTasks(d.filter(t=>t.status!=="completada"&&t.due_date&&new Date(t.due_date)<new Date()).length);
      }
    }).catch(()=>{});
    const t=setInterval(()=>tick(n=>n+1),5000);
    return ()=>clearInterval(t);
  },[]);

  const log=ACTIVITY_LOG;
  const now=new Date();
  const thisMonth=log.filter(e=>{const d=new Date(e.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});
  const today=log.filter(e=>new Date(e.date).toDateString()===now.toDateString());
  const toolsUsed=[...new Set(thisMonth.map(e=>e.tool))];
  const mrr=cls.reduce((s,c)=>s+(parseFloat(c.cuotaMensual)||0),0);
  const planDist={Esencial:0,Profesional:0,Premium:0};
  cls.forEach(c=>{if(planDist[c.plan]!==undefined)planDist[c.plan]++;});
  const nicheDist={};
  cls.forEach(c=>{const n=c.nicho||"Sin sector";nicheDist[n]=(nicheDist[n]||0)+1;});
  const topNiches=Object.entries(nicheDist).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const last5=log.slice(-5).reverse();

  const Kpi=({label,value,sub,color})=><div style={{background:C.sf,border:"1px solid "+C.bd,borderRadius:12,padding:"16px 20px",borderTop:"3px solid "+color}}>
    <div style={{fontSize:11,color:C.tx,marginBottom:4}}>{label}</div>
    <div style={{fontSize:26,fontWeight:700,color:color}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:C.txD,marginTop:2}}>{sub}</div>}
  </div>;

  const Bar=({label,value,max,color})=>{
    const pct=max>0?Math.round(value/max*100):0;
    return <div style={{marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
        <span style={{color:C.tx}}>{label}</span><span style={{color:color,fontWeight:600}}>{value}</span>
      </div>
      <div style={{height:6,background:C.sf2,borderRadius:3,overflow:"hidden"}}>
        <div style={{height:"100%",width:pct+"%",background:color,borderRadius:3,transition:"width 0.5s"}}/>
      </div>
    </div>;
  };

  return <div>
    <div style={{marginBottom:24}}>
      <h2 style={{fontSize:22,fontWeight:700,color:C.w,margin:"0 0 4px"}}>Dashboard</h2>
      <p style={{fontSize:13,color:C.tx,margin:0}}>Cliniq Digital - {now.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:14,marginBottom:24}}>
      <Kpi label="Clientes activos" value={cls.length} sub={cls.length>0?`${planDist.Premium} premium`:""} color={C.teal}/>
      <Kpi label="MRR (mensual)" value={mrr>0?mrr.toLocaleString("es-ES")+" EUR":"0 EUR"} sub={cls.length>0?Math.round(mrr/cls.length)+" EUR/cliente medio":""} color={C.green}/>
      <Kpi label="Consultas mes" value={thisMonth.length} sub={today.length+" hoy"} color={C.blue}/>
      <Kpi label="Herramientas usadas" value={toolsUsed.length} sub="de 28 disponibles" color={C.purple}/>
      <Kpi label="Total consultas" value={log.length} sub={cls.length>0?Math.round(log.length/cls.length)+" por cliente":""} color={C.cyan}/>
      <Kpi label="Tareas pendientes" value={pendingTasks} sub={overdueTasks>0?overdueTasks+" vencidas":"todo al dia"} color={overdueTasks>0?C.rose:C.orange}/>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:16,marginBottom:24}}>

      <Crd>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h3 style={{fontSize:14,fontWeight:700,color:C.w,margin:0}}>Actividad reciente</h3>
          <span onClick={()=>go("clients")} style={{fontSize:11,color:C.teal,cursor:"pointer"}}>Ver todo</span>
        </div>
        {last5.length===0?<p style={{fontSize:13,color:C.txD}}>Sin actividad. Usa cualquier herramienta para empezar.</p>
        :last5.map((e,i)=>{
          const d=new Date(e.date);
          const mins=Math.round((now-d)/60000);
          const timeAgo=mins<60?mins+"min":mins<1440?Math.round(mins/60)+"h":Math.round(mins/1440)+"d";
          return <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<last5.length-1?"1px solid "+C.bd:"none"}}>
            <span style={{fontSize:10,fontWeight:700,color:C.bg,background:C.cyan,padding:"2px 6px",borderRadius:4,whiteSpace:"nowrap",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis"}}>{e.tool}</span>
            <span style={{fontSize:12,color:C.tx,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.client}</span>
            <span style={{fontSize:10,color:C.txD,whiteSpace:"nowrap"}}>{timeAgo}</span>
          </div>;
        })}
      </Crd>

      <Crd>
        <h3 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 14px"}}>Clientes por plan</h3>
        {cls.length===0?<p style={{fontSize:13,color:C.txD}}>Sin clientes registrados.</p>:<div>
          <Bar label="Esencial (297 EUR)" value={planDist.Esencial} max={cls.length} color={C.teal}/>
          <Bar label="Profesional (497 EUR)" value={planDist.Profesional} max={cls.length} color={C.blue}/>
          <Bar label="Premium (897 EUR)" value={planDist.Premium} max={cls.length} color={C.gold}/>
          <div style={{marginTop:14,padding:"10px 12px",background:C.sf2,borderRadius:8}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
              <span style={{color:C.tx}}>Facturacion anual estimada</span>
              <span style={{color:C.green,fontWeight:700}}>{(mrr*12).toLocaleString("es-ES")} EUR</span>
            </div>
          </div>
        </div>}
      </Crd>

      {topNiches.length>0&&<Crd>
        <h3 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 14px"}}>Sectores</h3>
        {topNiches.map(([n,c],i)=><Bar key={n} label={n} value={c} max={cls.length} color={[C.purple,C.blue,C.teal,C.rose,C.orange][i%5]}/>)}
      </Crd>}

      {toolsUsed.length>0&&<Crd>
        <h3 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 14px"}}>Herramientas mas usadas (mes)</h3>
        {(()=>{
          const freq={};thisMonth.forEach(e=>{freq[e.tool]=(freq[e.tool]||0)+1;});
          const sorted=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,6);
          const maxV=sorted[0]?.[1]||1;
          return sorted.map(([t,c],i)=><Bar key={t} label={t} value={c} max={maxV} color={[C.cyan,C.blue,C.teal,C.purple,C.gold,C.rose][i%6]}/>);
        })()}
      </Crd>}

      <Crd>
        <h3 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 14px"}}>Costes IA (mes actual)</h3>
        {(()=>{
          const provCosts={};
          thisMonth.forEach(e=>{
            const p=e.provider||"anthropic";
            if(!provCosts[p]) provCosts[p]={count:0,cost:0};
            provCosts[p].count++;
            provCosts[p].cost+=(parseFloat(e.estCost)||0);
          });
          const totalCost=Object.values(provCosts).reduce((s,v)=>s+v.cost,0);
          const provColors={groq:C.green,deepseek:C.blue,anthropic:C.purple,fal:C.orange};
          const provLabels={groq:"Groq (Llama 4)",deepseek:"DeepSeek",anthropic:"Claude",fal:"Fal.ai (imagenes)"};
          const entries=Object.entries(provCosts).sort((a,b)=>b[1].cost-a[1].cost);
          return <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:14}}>
              <span style={{fontSize:22,fontWeight:700,color:totalCost>5?C.rose:C.green}}>{totalCost.toFixed(3)} USD</span>
              <span style={{fontSize:11,color:C.txD}}>{thisMonth.length} consultas</span>
            </div>
            {entries.map(([p,v])=>{
              const maxCost=entries[0]?.[1]?.cost||1;
              return <div key={p} style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                  <span style={{color:C.tx}}>{provLabels[p]||p} ({v.count})</span>
                  <span style={{color:provColors[p]||C.tx,fontWeight:600}}>{v.cost.toFixed(4)} USD</span>
                </div>
                <div style={{height:5,background:C.sf2,borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:Math.max(Math.round(v.cost/maxCost*100),2)+"%",background:provColors[p]||C.tx,borderRadius:3}}/>
                </div>
              </div>;
            })}
            {totalCost>0&&mrr>0&&<div style={{marginTop:12,padding:"8px 12px",background:C.sf2,borderRadius:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:C.tx}}>Coste IA vs MRR</span>
                <span style={{color:C.green,fontWeight:700}}>{(totalCost*0.92).toFixed(2)} EUR ({((totalCost*0.92)/mrr*100).toFixed(1)}%)</span>
              </div>
            </div>}
            {totalCost===0&&<p style={{fontSize:12,color:C.txD}}>Sin consultas este mes. Los costes se calculan automaticamente.</p>}
          </div>;
        })()}
      </Crd>
    </div>

    <div style={{marginBottom:16}}>
      <h3 style={{fontSize:14,fontWeight:700,color:C.w,margin:"0 0 14px"}}>Acceso rapido</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
        {[
          {t:"Produccion",ids:["landing","whatsapp","seo","followup","social","video","imageprompt","gbp","webstruct"]},
          {t:"Crecimiento",ids:["multiplier","proposal","campaign","metaads","dashboard"]},
          {t:"Inteligencia",ids:["audit","competitor","compliance","reviews"]},
          {t:"Presencia Digital",ids:["scan","deepanalysis","expansion","citations","reputation","voiceseo","brandmonitor","implement"]},
          {t:"Gestion",ids:["report","manual","clients","tasks"]}
        ].map(g=><Crd key={g.t}>
          <h3 style={{fontSize:13,fontWeight:700,color:C.w,margin:"0 0 10px"}}>{g.t}</h3>
          {g.ids.map(id=>{const it=ITEMS.find(x=>x.id===id);if(!it)return null;return(
            <div key={id} onClick={()=>go(id)} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",borderRadius:8,cursor:"pointer",transition:"background 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.background=C.sf2;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
              <span style={{fontSize:12,color:it.cl,width:18,textAlign:"center"}}>{it.ic}</span>
              <span style={{fontSize:12,color:C.tx,flex:1}}>{it.lb}</span>
              <span style={{fontSize:10,color:C.txD}}>{">"}</span>
            </div>);})}
        </Crd>)}
      </div>
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
    clients:<Clients/>,tasks:<Tasks/>,scan:<ScanPresencia/>,expansion:<Expansion/>,citations:<CitationsAudit/>,
    reputation:<Reputation/>,voiceseo:<VoiceSeo/>,brandmonitor:<BrandMonitor/>,
    deepanalysis:<DeepAnalysis/>,implement:<ImplementHub/>,
    multiplier:<ContentMultiplier/>,proposal:<ProposalGenerator/>,campaign:<MultiCampaign/>,metaads:<MetaAdsPro/>,dashboard:<PredictiveDashboard/>
  };
  const curLabel=ITEMS.find(i=>i.id===act)?.lb||"Panel";

  return <div style={{fontFamily:font,background:C.bg,minHeight:"100vh",display:"flex",color:C.w}}>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
    <style>{`*{margin:0;padding:0;box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.bd};border-radius:3px}@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}@keyframes blink{0%,50%{opacity:1}51%,100%{opacity:0}}.spinner{width:16px;height:16px;border:2px solid ${C.teal};border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite}select option{background:${C.sf};color:${C.w}}@media(max-width:860px){.dsk{display:none!important}}`}</style>

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
          <span style={{fontSize:10,color:C.txD,padding:"3px 8px",background:C.sf2,borderRadius:4}}>28 herramientas</span>
          <div style={{width:26,height:26,borderRadius:6,background:bg8(C.teal),display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.teal}}>L</div>
        </div>
      </header>
      <div style={{flex:1,padding:"18px 20px",overflowY:"auto"}}>{pages[act]||<Home go={setAct}/>}</div>
    </main>
  </div>;
}
