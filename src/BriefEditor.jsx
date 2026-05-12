import { useEffect, useState } from 'react';

const C = {
  bg:"#0B0F1A", sf:"#111827", sf2:"#1A2236", bd:"#2A3550",
  teal:"#2DD4BF", gold:"#F5C563", blue:"#60A5FA", purple:"#A78BFA",
  rose:"#FB7185", green:"#4ADE80", w:"#F1F5F9", tx:"#94A3B8", txD:"#475569", red:"#EF4444",
};
const font = "'DM Sans',sans-serif";

const BRIEF_FIELDS = [
  { key:"usp", lb:"Diferenciador clave (USP)", ph:"Lo que te hace unico frente a la competencia. Ej: 20 años, tecnologia exclusiva, atencion personalizada.", rows:2 },
  { key:"audiencia", lb:"Audiencia detallada / Buyer persona", ph:"Quien es tu cliente ideal? Edad, genero, nivel socioeconomico, intereses, donde vive, que le preocupa.", rows:3 },
  { key:"tono", lb:"Tono de voz preferido", ph:"Como debe sonar tu marca? Cercano y familiar / Profesional y serio / Premium y exclusivo / Tecnico y riguroso..." },
  { key:"keywords", lb:"Palabras clave que siempre deben aparecer", ph:"Ej: humano, equipo, garantia, experiencia, cercania (separadas por comas)" },
  { key:"prohibidas", lb:"Palabras prohibidas", ph:"Palabras o expresiones que NUNCA deben aparecer. Ej: barato, milagro, garantizado, low cost" },
  { key:"competidores", lb:"Competidores directos", ph:"Nombres + por que son competencia. Ej: Clinica X por precio agresivo, Clinica Y por marca fuerte.", rows:3 },
  { key:"testimonios", lb:"Testimonios reales para usar", ph:"3-5 testimonios reales con nombre (o iniciales) y servicio. Para inyectar en landings, posts, emails.", rows:4 },
  { key:"horario", lb:"Horario y datos de contacto", ph:"Ej: L-V 9-20h, S 9-14h. Tel 600000000. WhatsApp activo. Email reservas@..." },
  { key:"canales", lb:"Canales principales", ph:"Por donde quiere que le contacten los clientes? WhatsApp, telefono, formulario web, email..." },
  { key:"objetivos", lb:"Objetivos del trimestre", ph:"Que quiere conseguir en los proximos 3 meses? Ej: 30 leads/mes, abrir nueva sede, posicionar servicio X.", rows:2 },
  { key:"presupuesto_ads", lb:"Presupuesto mensual para anuncios", ph:"Si invierte en Meta o Google Ads, cuanto. Ej: 300 EUR/mes" },
  { key:"fechas_clave", lb:"Fechas clave del calendario", ph:"Lanzamientos, eventos, temporadas altas/bajas. Ej: Black Friday, San Valentin para estetica, septiembre para academias." },
  { key:"valores", lb:"Valores de marca", ph:"3-5 valores que definen como trabaja. Ej: honestidad, excelencia, cercania, innovacion." },
  { key:"extra", lb:"Datos extra que la IA debe saber", ph:"Cualquier otra cosa relevante: certificaciones, premios, alianzas, historia del negocio, anecdotas...", rows:4 },
];

export default function BriefEditor({ client, onClose, onSave }) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!client?.id) return;
    fetch('/api/briefs?client_id=' + client.id)
      .then(r => r.json())
      .then(d => {
        if (d && d.brief) {
          const b = typeof d.brief === 'string' ? JSON.parse(d.brief) : d.brief;
          setData(b || {});
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [client?.id]);

  const update = (key, val) => setData(prev => ({ ...prev, [key]: val }));

  const save = async () => {
    setSaving(true);
    setFeedback('');
    try {
      const r = await fetch('/api/briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.id,
          nicho_slug: client.nicho || null,
          brief: data,
        }),
      });
      if (r.ok) {
        setFeedback('Guardado');
        if (onSave) onSave(data);
        setTimeout(() => setFeedback(''), 2000);
      } else {
        setFeedback('Error al guardar');
      }
    } catch (e) {
      setFeedback('Error de conexion');
    }
    setSaving(false);
  };

  const completedCount = BRIEF_FIELDS.filter(f => (data[f.key] || '').trim().length > 0).length;
  const pct = Math.round((completedCount / BRIEF_FIELDS.length) * 100);

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal}>
        <div style={header}>
          <div>
            <h3 style={{fontSize:16,fontWeight:700,color:C.w,margin:0}}>Brief del cliente</h3>
            <p style={{fontSize:12,color:C.txD,margin:'2px 0 0'}}>
              {client.nombre} - <span style={{color: pct>=70?C.green : pct>=40?C.gold : C.rose}}>{pct}% completado</span>
            </p>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {feedback && <span style={{fontSize:11,color:feedback==='Guardado'?C.green:C.red,fontWeight:600}}>{feedback}</span>}
            <button onClick={save} disabled={saving} style={btnSave}>{saving?'Guardando...':'Guardar'}</button>
            <button onClick={onClose} style={btnClose}>Cerrar</button>
          </div>
        </div>

        <div style={body}>
          <div style={infoBox}>
            <p style={{margin:0,fontSize:12,color:C.tx,lineHeight:1.6}}>
              Este brief se inyecta automaticamente como contexto en TODAS las herramientas IA cuando trabajas con este cliente. Cuanto mas completo, mejor sera el output. Lo rellenas una vez y la IA lo usa siempre.
            </p>
          </div>

          {loading ? (
            <p style={{color:C.txD,fontSize:13,textAlign:'center',padding:30}}>Cargando brief...</p>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {BRIEF_FIELDS.map(f => (
                <div key={f.key}>
                  <label style={lbl}>{f.lb}</label>
                  <textarea
                    value={data[f.key] || ''}
                    onChange={(e) => update(f.key, e.target.value)}
                    placeholder={f.ph}
                    rows={f.rows || 2}
                    style={textarea}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const overlay = { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.85)', zIndex:9999, overflowY:'auto', padding:20, fontFamily: font };
const modal = { maxWidth:800, margin:'0 auto', background:C.sf, border:'1px solid '+C.bd, borderRadius:14, overflow:'hidden' };
const header = { padding:'16px 24px', borderBottom:'1px solid '+C.bd, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8, position:'sticky', top:0, background:C.sf, zIndex:1 };
const body = { padding:24 };
const infoBox = { background:C.teal+'12', border:'1px solid '+C.teal+'30', padding:'12px 16px', borderRadius:10, marginBottom:18 };
const lbl = { fontFamily: font, fontSize:11, fontWeight:600, color:C.tx, letterSpacing:0.5, textTransform:'uppercase', display:'block', marginBottom:6 };
const textarea = { width:'100%', background:C.bg, border:'1px solid '+C.bd, color:C.w, padding:'10px 14px', borderRadius:8, fontFamily:font, fontSize:13, outline:'none', resize:'vertical', lineHeight:1.6, boxSizing:'border-box' };
const btnSave = { background:C.teal, border:'none', color:C.bg, padding:'8px 16px', borderRadius:8, fontFamily:font, fontSize:12, fontWeight:600, cursor:'pointer' };
const btnClose = { background:'transparent', border:'1px solid '+C.bd, color:C.tx, padding:'8px 16px', borderRadius:8, fontFamily:font, fontSize:12, fontWeight:600, cursor:'pointer' };

export function formatBriefForPrompt(brief) {
  if (!brief || typeof brief !== 'object') return '';
  const parts = [];
  for (const f of BRIEF_FIELDS) {
    const val = (brief[f.key] || '').trim();
    if (val) parts.push(`${f.lb}: ${val}`);
  }
  if (parts.length === 0) return '';
  return `\n\n[CONTEXTO DEL CLIENTE - BRIEF]\n${parts.join('\n')}\n[FIN BRIEF]\n`;
}
