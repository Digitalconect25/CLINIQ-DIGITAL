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
  metaads:    { lb:"Meta Ads",           cl:C.blue,   ic:"◎", tool:"Meta Ads Pro",        est:"3-5 min" },
  manual:     { lb:"Manual Comunicación",cl:C.gold,   ic:"◳", tool:"Manual Comunicación", est:"3-5 min" },
};

// Plantillas rapidas de prompt
const QUICK_TEMPLATES = [
  { lb:"Lanzamiento de servicio",    txt:"[Cliente] quiere lanzar [servicio]. Necesito landing, 5 posts redes, secuencia WhatsApp y campaña Meta Ads. Presupuesto ads [X] EUR/mes." },
  { lb:"Reactivar pacientes/leads",  txt:"[Cliente] quiere reactivar antiguos contactos. Necesito secuencia email 5 toques, protocolo WhatsApp y posts redes." },
  { lb:"Posicionar nuevo profesional",txt:"[Cliente] incorpora a [Dr/a. X]. Necesito post presentacion, scripts video presentacion, landing especialidad y FAQ." },
  { lb:"Auditoria + plan",           txt:"[Cliente] necesita diagnostico completo. Auditoria digital, analisis competencia, plan de implementacion 90 dias." },
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

  // Generar UN entregable
  const generateOne = async (item) => {
    setDeliverables(prev => prev.map(d => d.id===item.id ? {...d, status:"generating", content:""} : d));
    const def = DELIVERABLE_TYPES[item.type];
    const niche = selectedClient.nicho || "Servicio profesional";
    const geo = (selectedClient.ciudad_fiscal||selectedClient.ciudadFiscal||"Espana");

    const system = `Estratega de marketing digital para negocios locales en Espana. AÑO ACTUAL: 2026.
Nicho: ${niche}. Geo: ${geo}.
Estas produciendo: ${def.lb} (titulo: "${item.title}").
DETALLE A CUMPLIR: ${item.detail}.

Reglas: contenido COMPLETO listo para entregar al cliente, no esquemas. Espanol de Espana, comillas rectas, sin emojis ni markdown. Si faltan datos usa [COMPLETAR]. Tono profesional pero cercano. Precision sobre extension.`;

    const userMsg = `Cliente: ${selectedClient.nombre}.
Brief original del proyecto: ${brief}

Produce ${def.lb} con foco en: ${item.title}. ${item.detail}`;

    try{
      const r = await fetch("/api/generate", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          provider:"anthropic",
          model:"claude-sonnet-4-20250514",
          max_tokens:4096,
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
