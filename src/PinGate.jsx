import { useEffect, useState } from 'react';

const STORAGE_KEY = 'cliniq_pin';

export default function PinGate({ children }) {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = (() => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } })();
    if (!stored) { setLoading(false); return; }
    verify(stored).then((ok) => {
      if (ok) setAuthed(true);
      else { try { localStorage.removeItem(STORAGE_KEY); } catch {} }
      setLoading(false);
    });
  }, []);

  async function verify(value) {
    try {
      const r = await fetch('/api/auth-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: value }),
      });
      const d = await r.json();
      return d.ok === true;
    } catch { return false; }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const ok = await verify(pin);
    if (ok) {
      try { localStorage.setItem(STORAGE_KEY, pin); } catch {}
      setAuthed(true);
    } else {
      setError('PIN incorrecto');
      setPin('');
    }
  }

  if (loading) {
    return <div style={wrap}><div style={{color:'#94a3b8',fontSize:13}}>Cargando...</div></div>;
  }
  if (authed) return children;

  return (
    <div style={wrap}>
      <form onSubmit={onSubmit} style={card}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
          <div style={logoCircle}>C</div>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:'#F1F5F9',letterSpacing:0.3}}>CLINIQ <span style={{color:'#2DD4BF'}}>DIGITAL</span></div>
            <div style={{fontSize:11,color:'#64748B',marginTop:2}}>Acceso del equipo</div>
          </div>
        </div>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN de acceso"
          autoFocus
          style={input}
        />
        <button type="submit" style={btn}>Entrar</button>
        {error && <div style={errBox}>{error}</div>}
        <div style={{fontSize:10,color:'#475569',marginTop:14,textAlign:'center'}}>
          Solicita el PIN al administrador si no lo recuerdas
        </div>
      </form>
    </div>
  );
}

const wrap = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0B0F1A', fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif", padding: 16 };
const card = { background: '#111827', padding: 28, borderRadius: 12, border: '1px solid #2A3550', width: '100%', maxWidth: 340 };
const logoCircle = { width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #2DD4BF, #14B8A6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#0B0F1A' };
const input = { width: '100%', padding: '11px 14px', borderRadius: 8, border: '1px solid #2A3550', fontSize: 14, outline: 'none', marginBottom: 10, boxSizing: 'border-box', background: '#0B0F1A', color: '#F1F5F9', fontFamily: 'inherit' };
const btn = { width: '100%', padding: '11px 14px', borderRadius: 8, border: 'none', background: '#2DD4BF', color: '#0B0F1A', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const errBox = { color: '#EF4444', marginTop: 12, fontSize: 12, padding: '6px 10px', background: 'rgba(239,68,68,0.1)', borderRadius: 6 };
