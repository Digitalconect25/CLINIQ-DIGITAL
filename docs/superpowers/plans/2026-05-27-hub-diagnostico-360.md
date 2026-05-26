# Hub "Diagnóstico 360" — Plan de Implementación (piloto)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un componente `Hub` genérico reutilizable y su primera instancia "Diagnóstico 360", que desde un input único genera varias secciones de investigación juntas, sin tocar las herramientas existentes.

**Architecture:** Se añade dentro de `src/CliniqPlatform.jsx` (monolito existente) un componente `Hub` parametrizado por una lista de "secciones". Cada sección reutiliza los `system`/prompt de las herramientas actuales y llama a las funciones ya existentes `ai()` (no-web) o `aiSearch()` (web/Gemini grounding). Se registra un nuevo ítem de menú y entrada en el mapa `tools`, conviviendo con las herramientas viejas.

**Tech Stack:** React 18 (sin TS), Vite, sin suite de tests → verificación por `node --check`, `grep`, build de Vite y validación manual en preview de Vercel.

**Nota de verificación:** este repo no tiene tests unitarios. Cada tarea verifica con sintaxis + grep; la validación funcional final es manual en la URL de preview del PR (requiere PIN).

---

### Task 1: Extraer los prompts de las 7 secciones a una config

**Files:**
- Modify: `src/CliniqPlatform.jsx` (añadir constante `DIAGNOSTICO_SECTIONS` cerca de las definiciones de datos, p. ej. tras `const MENU = [...]`)

Las 7 secciones reutilizan los `system` y plantillas de prompt **ya existentes** en estos componentes (copiar VERBATIM, no inventar):

| key | label | essential | Origen del prompt (componente/función actual) |
|---|---|---|---|
| scan360 | Scan Presencia 360 | ✓ | componente Scan (llamada `aiSearch(... {tool:"Scan Presencia 360"})`) |
| deepweb | Análisis Profundo Web | | componente DeepAnalysis (`aiSearch(... "Análisis Profundo")`) |
| auditoria | Auditoría Digital | ✓ | componente Audit (`{tool:"Auditoría Digital"}`) |
| competencia | Competencia Local | ✓ | componente Competitor (`{tool:"Competencia Local"}`) |
| nap | Auditoría NAP/Citations | | componente Citations (`{tool:"Auditoría NAP"}`) |
| reputacion | Reputación y Reseñas | ✓ | componente Reputation (`{tool:"Reputación"}`) |
| marca | Monitor de Marca | | componente BrandMonitor (`{tool:"Monitor de Marca"}`) |

- [ ] **Step 1: Localizar los prompts existentes**

Run: `grep -n 'tool:"Scan Presencia 360"\|tool:"Análisis Profundo"\|tool:"Auditoría Digital"\|tool:"Competencia Local"\|tool:"Auditoría NAP"\|tool:"Reputación"\|tool:"Monitor de Marca"' src/CliniqPlatform.jsx`
Expected: 7 líneas con los números donde se llama a `aiSearch`/`ai` de cada herramienta.

- [ ] **Step 2: Crear la constante de config**

Añadir tras `const ITEMS=MENU.filter(m=>m.id);`. Copiar el `system` (primer argumento de `aiSearch`) y la plantilla de prompt (segundo argumento) de cada componente origen, parametrizando los inputs. Estructura (rellena `system` y `buildPrompt` con el texto VERBATIM de cada origen):

```js
// Secciones del hub Diagnóstico 360. system/buildPrompt copiados de las herramientas actuales.
const DIAGNOSTICO_SECTIONS = [
  { key:"scan360", label:"Scan Presencia 360", web:true, essential:true,
    system:/* copiar de Scan */ "",
    buildPrompt:(i)=>/* copiar plantilla de Scan, usando i.cliente,i.geo,i.web */ "" },
  { key:"deepweb", label:"Análisis Profundo Web", web:true, essential:false,
    system:"", buildPrompt:(i)=>"" },
  { key:"auditoria", label:"Auditoría Digital", web:true, essential:true,
    system:"", buildPrompt:(i)=>"" },
  { key:"competencia", label:"Competencia Local", web:true, essential:true,
    system:"Analista de competencia digital en 2026.",
    buildPrompt:(i)=>`Analisis competencia para: ${i.cliente} en ${i.geo}. Competidores: ${i.competidores||"Buscar principales"}. Sector: ${i.nicho}.
Genera: MAPA COMPETITIVO, WEB COMPARATIVO, SEO LOCAL, GOOGLE MAPS, REDES, PRECIOS, OPORTUNIDADES GEO-LOCALES, PLAN.` },
  { key:"nap", label:"Auditoría NAP/Citations", web:true, essential:false,
    system:"", buildPrompt:(i)=>"" },
  { key:"reputacion", label:"Reputación y Reseñas", web:true, essential:true,
    system:"", buildPrompt:(i)=>"" },
  { key:"marca", label:"Monitor de Marca", web:true, essential:false,
    system:"", buildPrompt:(i)=>"" },
];
```

> NOTA: `competencia` ya trae el prompt real como referencia de formato (extraído de `Competitor`, líneas ~1000-1002). Las demás se rellenan igual, copiando de su componente origen.

- [ ] **Step 3: Verificar sintaxis**

Run: `node --check src/CliniqPlatform.jsx 2>/dev/null || npx --yes @babel/cli --version >/dev/null` 
(Nota: `node --check` no procesa JSX; basta con que no haya error de parseo de la constante. Verificación real en build, Task 5.)
Run: `grep -n "DIAGNOSTICO_SECTIONS" src/CliniqPlatform.jsx`
Expected: aparece la definición y (más adelante) su uso.

- [ ] **Step 4: Commit**

```bash
git add src/CliniqPlatform.jsx
git commit -m "feat(hub): config DIAGNOSTICO_SECTIONS con prompts reutilizados"
```

---

### Task 2: Componente `Hub` genérico

**Files:**
- Modify: `src/CliniqPlatform.jsx` (añadir el componente `Hub` antes del mapa `tools`)

Reutiliza funciones existentes: `ai`, `aiSearch`, `resolveNiche`, `geoStr`, `buildSys` (vía `ai`/`aiSearch`), y componentes UI `Fld`, `Inp`, `Btn`, `Crd`, `OutSearch`, `NicheSelector`. Colores en `C`.

- [ ] **Step 1: Escribir el componente Hub**

```jsx
function Hub({ title, subtitle, sections, accent }){
  const [ni,sNi]=React.useState("");const [cni,sCni]=React.useState("");
  const [nm,sNm]=React.useState("");const [ci,sCi]=React.useState("");
  const [pv,sPv]=React.useState("");const [web,sWeb]=React.useState("");
  const [comp,sComp]=React.useState("");
  const [sel,sSel]=React.useState(()=>new Set(sections.filter(s=>s.essential).map(s=>s.key)));
  const [outs,sOuts]=React.useState({});   // { key: {text, loading, phase} }
  const [running,sRunning]=React.useState(false);

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
```

- [ ] **Step 2: Verificar referencias**

Run: `grep -n "function Hub(\|React.useState\|resolveNiche\|geoStr\|<OutSearch\|<NicheSelector\|<Crd\|bg8(" src/CliniqPlatform.jsx | head`
Expected: confirma que `Hub` existe y que `resolveNiche`, `geoStr`, `OutSearch`, `NicheSelector`, `Crd`, `bg8` ya están definidos en el archivo (si `React` no está importado como namespace, usar los hooks ya importados: cambiar `React.useState` por `useState`).

- [ ] **Step 3: Ajustar import de hooks si hace falta**

Run: `grep -n "import.*useState\|from \"react\"" src/CliniqPlatform.jsx | head`
Si `useState` se importa nombrado (p. ej. `import {useState} from "react"`), reemplazar en el componente `Hub` todas las apariciones de `React.useState` por `useState`.

- [ ] **Step 4: Commit**

```bash
git add src/CliniqPlatform.jsx
git commit -m "feat(hub): componente Hub generico con multi-seleccion"
```

---

### Task 3: Instanciar "Diagnóstico 360" y registrarlo en menú + tools

**Files:**
- Modify: `src/CliniqPlatform.jsx` (instancia + entrada en `MENU` + entrada en mapa `tools`)

- [ ] **Step 1: Crear la instancia del hub**

Añadir junto a `Hub`:

```jsx
function DiagnosticoHub(){
  return <Hub title="Diagnóstico 360" subtitle="Auditoría completa de presencia digital en una sola pasada"
    sections={DIAGNOSTICO_SECTIONS} accent={C.cyan}/>;
}
```

- [ ] **Step 2: Registrar en el mapa `tools`**

Run: `grep -n "implement:<ImplementHub/>" src/CliniqPlatform.jsx`
Añadir en el objeto `tools` (junto a las demás entradas) la línea:

```jsx
    diag360:<DiagnosticoHub/>,
```

- [ ] **Step 3: Añadir al MENU**

En `const MENU = [...]`, añadir un grupo nuevo arriba (tras `{g:"PANEL"}` y el item home), antes de `{g:"PRODUCCIÓN"}`:

```jsx
  {g:"HUBS"},
  {id:"diag360",ic:"⊙",lb:"Diagnóstico 360",cl:C.cyan},
```

- [ ] **Step 4: Verificar**

Run: `grep -n "diag360\|DiagnosticoHub\|{g:\"HUBS\"}" src/CliniqPlatform.jsx`
Expected: 3 referencias (MENU item, tools map, componente) + el grupo HUBS.

- [ ] **Step 5: Commit**

```bash
git add src/CliniqPlatform.jsx
git commit -m "feat(hub): instancia Diagnostico 360 en menu y router de vistas"
```

---

### Task 4: Build local (verificación de que compila)

**Files:** ninguno (solo build)

- [ ] **Step 1: Instalar deps y build**

Run: `cd /tmp/CLINIQ-DIGITAL && npm install --silent && npm run build`
Expected: build de Vite termina sin errores (`✓ built in ...`). Si falla por JSX/identificador no definido, corregir en el archivo y repetir.

- [ ] **Step 2: Commit (si hubo correcciones)**

```bash
git add -A && git commit -m "fix(hub): correcciones de build"
```

---

### Task 5: PR + validación en preview

**Files:** ninguno

- [ ] **Step 1: Push y PR**

```bash
git push -u origin consolidacion-hubs
gh pr create --base main --head consolidacion-hubs \
  --title "feat: Hub Diagnostico 360 (piloto consolidacion)" \
  --body "Piloto del componente Hub generico + instancia Diagnostico 360. Convive con las herramientas existentes. Probar en preview: abrir 'Diagnóstico 360', rellenar Centro+Ciudad, 'Generar lo esencial' -> deben generarse 4 secciones con texto + fuentes."
```

- [ ] **Step 2: Esperar READY de la preview**

Comprobar el deployment de la rama `consolidacion-hubs` en Vercel (estado READY) y obtener la URL `cliniq-digital-git-consolidacion-hubs-...vercel.app`.

- [ ] **Step 3: Validación manual (usuario)**

En la preview, con el PIN: menú → **Diagnóstico 360** → Centro="Luz And", Ciudad="Alicante" → **Generar lo esencial**.
Expected: se generan secuencialmente Scan 360 + Auditoría + Competencia + Reputación, cada una con su texto y "FUENTES CONSULTADAS", sin error de Anthropic.

- [ ] **Step 4: Merge (tras OK del usuario)**

```bash
gh pr merge consolidacion-hubs --squash
```

---

## Self-Review

- **Cobertura del spec:** componente Hub genérico (Task 2 ✓), UX inputs-una-vez + casillas + "Generar lo esencial" (Task 2 ✓), routing web/no-web reutilizando ai/aiSearch (Task 2 ✓), piloto Diagnóstico 360 con 7 secciones y preset esencial (Task 1+3 ✓), convivencia sin romper viejas (Task 3 añade, no quita ✓), validación preview (Task 5 ✓). Los otros 5 hubs y retirada de herramientas viejas quedan para planes posteriores (alcance del piloto, correcto).
- **Placeholders:** los `system:""`/`buildPrompt:(i)=>""` de Task 1 son intencionados: se rellenan copiando VERBATIM del componente origen indicado (los prompts ya existen en el repo; inventarlos sería peor). `competencia` se da completo como patrón.
- **Consistencia de tipos:** `DIAGNOSTICO_SECTIONS` (Task 1) → consumido por `Hub` vía prop `sections` (Task 2) → pasado por `DiagnosticoHub` (Task 3). `inputs` usa cliente/nicho/geo/web/competidores en todas las secciones. `setOut(k,patch)` y la forma `{text,loading,phase}` consistentes.
