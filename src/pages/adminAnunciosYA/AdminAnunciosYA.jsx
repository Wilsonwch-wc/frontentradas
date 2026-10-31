import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import api from '../../api/axios';
import './AdminAnunciosYA.css';

/* ─ Constantes ─ */
const ADMIN_EMAIL = 'reviewiasit@gmail.com';
const CATEGORIAS_MAP = {
  vehiculos: '🚗 Vehículos', inmuebles: '🏠 Inmuebles', electronica: '📱 Tecnología',
  hogar: '🛋️ Hogar', moda: '👗 Ropa', empleo: '💼 Empleos',
  servicios: '🔧 Servicios', mascotas: '🐾 Mascotas', otros: '··· Otros'
};

/* ─ Utilidades ─ */
const fmt = (n) => (n ?? 0).toLocaleString('es-BO');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-BO', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const INIT_TOKEN_KEY = 'aadm_token';
const INIT_USER_KEY  = 'aadm_user';

/* ════════════════════════════════════════════
   COMPONENTE PRINCIPAL
════════════════════════════════════════════ */
export default function AdminAnunciosYA() {
  const navigate = useNavigate();

  /* Auth state con sincronización multisitio */
  const [adminUser, setAdminUser] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem(INIT_USER_KEY) || 'null') ||
                JSON.parse(localStorage.getItem('anunciosya_usuario') || 'null') ||
                JSON.parse(localStorage.getItem('user') || 'null');
      if (u) {
        const mail = (u.email || u.correo || '').toLowerCase().trim();
        const rol  = (u.rol || '').toLowerCase().trim();
        if (mail === ADMIN_EMAIL.toLowerCase() || rol === 'admin') return u;
      }
      return null;
    } catch { return null; }
  });
  const [adminToken, setAdminToken] = useState(() => {
    return localStorage.getItem(INIT_TOKEN_KEY) ||
           localStorage.getItem('anunciosya_token') ||
           localStorage.getItem('token') || null;
  });
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass]   = useState('');
  const [loginErr,  setLoginErr]    = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  /* UI state */
  const [tab, setTab] = useState('dashboard');
  const [modal, setModal] = useState(null); // { type, data }

  /* Dashboard data */
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  /* Anuncios admin */
  const [anuncios, setAnuncios] = useState([]);
  const [anunciosTot, setAnunciosTot] = useState(0);
  const [anunciosPag, setAnunciosPag] = useState(1);
  const [anunciosFilter, setAnunciosFilter] = useState({ estado: 'todos', buscar: '', categoria: 'todas' });
  const [loadingAnuncios, setLoadingAnuncios] = useState(false);

  /* Usuarios admin */
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosTot, setUsuariosTot] = useState(0);
  const [usuariosPag, setUsuariosPag] = useState(1);
  const [usuariosFilter, setUsuariosFilter] = useState({ buscar: '' });
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [userAnuncios, setUserAnuncios] = useState(null);

  /* Cupones admin */
  const [cupones, setCupones] = useState([]);
  const [loadingCupones, setLoadingCupones] = useState(false);
  const [modalCrearCupon, setModalCrearCupon] = useState(false);
  const [formCupon, setFormCupon] = useState({
    codigo: '',
    descripcion: 'Cupón de Publicación 100% Gratis',
    tipo: 'gratis',
    valor: 100,
    limite_usos: 10,
    limite_por_usuario: 1
  });
  const [guardandoCupon, setGuardandoCupon] = useState(false);

  /* ── Helpers de request ── */
  const authHeaders = useCallback(() => ({
    headers: { Authorization: `Bearer ${adminToken}` }
  }), [adminToken]);

  /* ── LOGIN CON CORREO / CONTRASEÑA ── */
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginErr('');
    try {
      const { data } = await api.post('/anuncios/auth/login', {
        email: loginEmail.trim(), password: loginPass
      });
      if (!data.success) { setLoginErr(data.message || 'Error'); return; }
      const user = data.data.user;
      const token = data.data.token;
      const mail = (user.correo || user.email || loginEmail || '').toLowerCase().trim();
      const rol  = (user.rol || '').toLowerCase().trim();
      if (mail !== ADMIN_EMAIL.toLowerCase() && rol !== 'admin') {
        setLoginErr(`Acceso denegado. La cuenta (${mail}) no tiene permisos de administrador.`);
        return;
      }
      localStorage.setItem(INIT_TOKEN_KEY, token);
      localStorage.setItem(INIT_USER_KEY, JSON.stringify(user));
      localStorage.setItem('anunciosya_token', token);
      localStorage.setItem('anunciosya_usuario', JSON.stringify(user));
      setAdminToken(token);
      setAdminUser(user);
    } catch (err) {
      setLoginErr(err.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setLoginLoading(false);
    }
  };

  /* ── LOGIN CON GOOGLE ── */
  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setLoginErr('No se recibió la credencial de Google.');
      return;
    }
    setLoginLoading(true);
    setLoginErr('');
    try {
      const { data } = await api.post('/anuncios/auth/google', {
        token: credentialResponse.credential
      });
      if (!data.success) { setLoginErr(data.message || 'Error al verificar con Google'); return; }
      const user = data.data.user;
      const token = data.data.token;
      const mail = (user.correo || user.email || '').toLowerCase().trim();
      const rol  = (user.rol || '').toLowerCase().trim();
      if (mail !== ADMIN_EMAIL.toLowerCase() && rol !== 'admin') {
        setLoginErr(`Acceso denegado. La cuenta (${mail}) no es la autorizada para administrar.`);
        return;
      }
      localStorage.setItem(INIT_TOKEN_KEY, token);
      localStorage.setItem(INIT_USER_KEY, JSON.stringify(user));
      localStorage.setItem('anunciosya_token', token);
      localStorage.setItem('anunciosya_usuario', JSON.stringify(user));
      setAdminToken(token);
      setAdminUser(user);
    } catch (err) {
      setLoginErr(err.response?.data?.message || 'Error al iniciar sesión con Google');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(INIT_TOKEN_KEY);
    localStorage.removeItem(INIT_USER_KEY);
    setAdminToken(null);
    setAdminUser(null);
    setTab('dashboard');
  };

  /* ── CARGAR STATS ── */
  const loadStats = useCallback(async () => {
    if (!adminToken) return;
    setLoadingStats(true);
    try {
      const { data } = await api.get('/admin/anuncios/stats', authHeaders());
      if (data.success) setStats(data.data);
    } catch (err) {
      console.error('Error stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, [adminToken, authHeaders]);

  /* ── CARGAR ANUNCIOS ── */
  const loadAnuncios = useCallback(async (pag = 1) => {
    if (!adminToken) return;
    setLoadingAnuncios(true);
    try {
      const params = new URLSearchParams({
        pagina: pag,
        limite: 15,
        estado: anunciosFilter.estado,
        buscar: anunciosFilter.buscar,
        categoria: anunciosFilter.categoria
      });
      const { data } = await api.get(`/admin/anuncios/anuncios?${params}`, authHeaders());
      if (data.success) {
        setAnuncios(data.data.anuncios);
        setAnunciosTot(data.data.total);
        setAnunciosPag(pag);
      }
    } catch (err) {
      console.error('Error anuncios:', err);
    } finally {
      setLoadingAnuncios(false);
    }
  }, [adminToken, authHeaders, anunciosFilter]);

  /* ── CARGAR USUARIOS ── */
  const loadUsuarios = useCallback(async (pag = 1) => {
    if (!adminToken) return;
    setLoadingUsuarios(true);
    try {
      const params = new URLSearchParams({ pagina: pag, limite: 15, buscar: usuariosFilter.buscar });
      const { data } = await api.get(`/admin/anuncios/usuarios?${params}`, authHeaders());
      if (data.success) {
        setUsuarios(data.data.usuarios);
        setUsuariosTot(data.data.total);
        setUsuariosPag(pag);
      }
    } catch (err) {
      console.error('Error usuarios:', err);
    } finally {
      setLoadingUsuarios(false);
    }
  }, [adminToken, authHeaders, usuariosFilter]);

  /* ── Cargar Cupones ── */
  const loadCupones = useCallback(async () => {
    if (!adminToken) return;
    setLoadingCupones(true);
    try {
      const { data } = await api.get('/admin/anuncios/cupones', authHeaders());
      if (data.success) setCupones(data.data || []);
    } catch (err) {
      console.error('Error loadCupones:', err);
    } finally {
      setLoadingCupones(false);
    }
  }, [adminToken, authHeaders]);

  const handleCrearCupon = async (e) => {
    e.preventDefault();
    if (!formCupon.codigo.trim()) {
      alert('Por favor ingresa un código para el cupón (ej. VPPP)');
      return;
    }
    setGuardandoCupon(true);
    try {
      const { data } = await api.post('/admin/anuncios/cupones', {
        ...formCupon,
        codigo: formCupon.codigo.trim().toUpperCase()
      }, authHeaders());
      if (data.success) {
        alert(data.message || 'Cupón creado con éxito');
        setModalCrearCupon(false);
        setFormCupon({
          codigo: '',
          descripcion: 'Cupón de Publicación 100% Gratis',
          tipo: 'gratis',
          valor: 100,
          limite_usos: 10,
          limite_por_usuario: 1
        });
        loadCupones();
      } else {
        alert(data.message || 'Error al crear cupón');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error al crear el cupón');
    } finally {
      setGuardandoCupon(false);
    }
  };

  const handleToggleEstadoCupon = async (c) => {
    try {
      const { data } = await api.patch(`/admin/anuncios/cupones/${c.id}/estado`, { activo: !c.activo }, authHeaders());
      if (data.success) {
        loadCupones();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error al cambiar estado');
    }
  };

  const handleEliminarCupon = async (c) => {
    if (!window.confirm(`¿Estás seguro de eliminar el cupón "${c.codigo}"?`)) return;
    try {
      const { data } = await api.delete(`/admin/anuncios/cupones/${c.id}`, authHeaders());
      if (data.success) {
        loadCupones();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error al eliminar cupón');
    }
  };

  /* ── Effects ── */
  useEffect(() => { if (adminToken && tab === 'dashboard') loadStats(); }, [adminToken, tab, loadStats]);
  useEffect(() => { if (adminToken && tab === 'anuncios') loadAnuncios(1); }, [adminToken, tab, anunciosFilter]);
  useEffect(() => { if (adminToken && tab === 'usuarios') loadUsuarios(1); }, [adminToken, tab, usuariosFilter]);
  useEffect(() => { if (adminToken && tab === 'cupones') loadCupones(); }, [adminToken, tab, loadCupones]);

  /* ── CAMBIAR ESTADO ANUNCIO ── */
  const cambiarEstadoAnuncio = async (id, estado) => {
    try {
      const { data } = await api.patch(
        `/admin/anuncios/anuncios/${id}/estado`,
        { estado },
        authHeaders()
      );
      if (data.success) {
        setAnuncios(prev => prev.map(a => a.id === id ? { ...a, estado } : a));
        setModal(null);
      }
    } catch (err) {
      console.error('Error cambiar estado:', err);
    }
  };

  /* ── CAMBIAR ESTADO USUARIO ── */
  const cambiarEstadoUsuario = async (id, activo) => {
    try {
      const { data } = await api.patch(
        `/admin/anuncios/usuarios/${id}/estado`,
        { activo },
        authHeaders()
      );
      if (data.success) {
        setUsuarios(prev => prev.map(u => u.id === id ? { ...u, activo: activo ? 1 : 0 } : u));
        setModal(null);
      }
    } catch (err) {
      console.error('Error cambiar usuario:', err);
    }
  };

  /* ── VER ANUNCIOS DE USUARIO ── */
  const verAnunciosUsuario = async (u) => {
    try {
      const { data } = await api.get(`/admin/anuncios/usuarios/${u.id}/anuncios`, authHeaders());
      setUserAnuncios({ usuario: u, anuncios: data.data || [] });
      setModal({ type: 'user_anuncios' });
    } catch (err) {
      console.error(err);
    }
  };

  /* ══════════════ RENDER ══════════════ */

  /* Si no está autenticado → Login */
  if (!adminToken || !adminUser) {
    return (
      <div className="aadm-login-wrap">
        <div className="aadm-login-box">
          <div className="aadm-login-logo">
            <div className="aadm-brand">AnunciosYA</div>
            <div className="aadm-sub">Panel de Administración</div>
          </div>
          <h2>Acceso Admin</h2>
          <p>Panel exclusivo para <strong>{ADMIN_EMAIL}</strong> y administradores autorizados.</p>

          {/* Botón de Google Login */}
          <div style={{ margin: '1.25rem 0 0.75rem', display: 'flex', justifyContent: 'center' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setLoginErr('Error al conectar con Google Accounts')}
              theme="filled_black"
              shape="pill"
              text="signin_with"
              locale="es"
            />
          </div>

          <div style={{ textAlign: 'center', margin: '0.85rem 0', color: '#64748b', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ flex: 1, height: '1px', background: '#334155' }}></span>
            <span>o con credenciales</span>
            <span style={{ flex: 1, height: '1px', background: '#334155' }}></span>
          </div>

          <form onSubmit={handleLogin}>
            <div className="aadm-form-group">
              <label>Correo electrónico</label>
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="reviewiasit@gmail.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="aadm-form-group">
              <label>Contraseña</label>
              <input
                type="password"
                value={loginPass}
                onChange={e => setLoginPass(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {loginErr && <div className="aadm-login-error">⚠️ {loginErr}</div>}
            <button className="aadm-btn-login" type="submit" disabled={loginLoading}>
              {loginLoading ? 'Verificando...' : '🔐 Ingresar al Panel'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
            <button
              type="button"
              onClick={() => navigate('/anuncios-ya')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                fontSize: '0.82rem',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              ← Volver al portal AnunciosYA
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════ PANEL PRINCIPAL ══════════ */
  return (
    <div className="aadm-root">
      {/* ── Sidebar ── */}
      <aside className="aadm-sidebar">
        <div className="aadm-sidebar-logo">
          <div className="brand">AnunciosYA</div>
          <div className="subt">Panel Admin</div>
        </div>
        <nav className="aadm-nav">
          {[
            { id: 'dashboard', icon: '📊', label: 'Dashboard' },
            { id: 'anuncios',  icon: '📋', label: 'Anuncios' },
            { id: 'usuarios',  icon: '👥', label: 'Usuarios' },
            { id: 'cupones',   icon: '🎟️', label: 'Cupones' },
          ].map(item => (
            <button
              key={item.id}
              className={`aadm-nav-item ${tab === item.id ? 'active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
          <button
            className="aadm-nav-item"
            style={{ marginTop: '0.75rem', borderTop: '1px solid #334155', paddingTop: '0.75rem', color: '#38bdf8' }}
            onClick={() => navigate('/anuncios-ya')}
          >
            <span className="icon">🌐</span>
            Ver Portal
          </button>
        </nav>
        <div className="aadm-sidebar-footer">
          <div className="aadm-user-badge">
            <div className="avatar">A</div>
            <div className="info">
              <div className="name">Admin</div>
              <div className="role">Administrador</div>
            </div>
          </div>
          <button className="aadm-btn-logout" onClick={handleLogout}>⎋ Cerrar Sesión</button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="aadm-main">
        <div className="aadm-topbar">
          <h1>
            {tab === 'dashboard' && '📊 Dashboard General'}
            {tab === 'anuncios'  && '📋 Gestión de Anuncios'}
            {tab === 'usuarios'  && '👥 Usuarios Registrados'}
            {tab === 'cupones'   && '🎟️ Gestión de Cupones'}
          </h1>
          <div className="aadm-topbar-actions">
            <span className="aadm-badge-live">En vivo</span>
            <button
              style={{ background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.3)', color:'#93c5fd', borderRadius:'8px', padding:'4px 10px', fontSize:'0.78rem', fontWeight:'600', cursor:'pointer' }}
              onClick={() => { if (tab === 'dashboard') loadStats(); if (tab === 'anuncios') loadAnuncios(anunciosPag); if (tab === 'usuarios') loadUsuarios(usuariosPag); }}
            >
              🔄 Actualizar
            </button>
          </div>
        </div>

        <div className="aadm-content">

          {/* ══════ TAB: DASHBOARD ══════ */}
          {tab === 'dashboard' && (
            <div style={{ animation: 'aadm-fadeIn 0.3s ease' }}>
              {loadingStats ? (
                <div style={{ textAlign:'center', padding:'4rem', color:'#64748b' }}>Cargando estadísticas...</div>
              ) : stats ? (
                <>
                  {/* Stats cards */}
                  <div className="aadm-stats-grid">
                    <div className="aadm-stat-card blue">
                      <div className="sc-icon">📋</div>
                      <div className="sc-val">{fmt(stats.totales?.total_anuncios)}</div>
                      <div className="sc-label">Total Anuncios</div>
                    </div>
                    <div className="aadm-stat-card green">
                      <div className="sc-icon">✅</div>
                      <div className="sc-val">{fmt(stats.totales?.activos)}</div>
                      <div className="sc-label">Anuncios Activos</div>
                    </div>
                    <div className="aadm-stat-card yellow">
                      <div className="sc-icon">⏸️</div>
                      <div className="sc-val">{fmt(stats.totales?.pausados)}</div>
                      <div className="sc-label">Pausados</div>
                    </div>
                    <div className="aadm-stat-card red">
                      <div className="sc-icon">🗑️</div>
                      <div className="sc-val">{fmt(stats.totales?.eliminados)}</div>
                      <div className="sc-label">Eliminados</div>
                    </div>
                    <div className="aadm-stat-card purple">
                      <div className="sc-icon">👥</div>
                      <div className="sc-val">{fmt(stats.usuarios?.total_usuarios)}</div>
                      <div className="sc-label">Usuarios Registrados</div>
                    </div>
                    <div className="aadm-stat-card blue">
                      <div className="sc-icon">👁️</div>
                      <div className="sc-val">{fmt(stats.totales?.total_visitas)}</div>
                      <div className="sc-label">Total Visitas</div>
                    </div>
                    <div className="aadm-stat-card green">
                      <div className="sc-icon">🌐</div>
                      <div className="sc-val">{fmt(stats.usuarios?.por_google)}</div>
                      <div className="sc-label">Login con Google</div>
                    </div>
                    <div className="aadm-stat-card yellow">
                      <div className="sc-icon">🆕</div>
                      <div className="sc-val">{fmt(stats.usuarios?.registrados_hoy)}</div>
                      <div className="sc-label">Registros Hoy</div>
                    </div>
                  </div>

                  {/* Charts */}
                  <div className="aadm-charts-row">
                    {/* Por categoría */}
                    <div className="aadm-chart-card">
                      <h3>📂 Anuncios por Categoría</h3>
                      <div className="aadm-bar-chart">
                        {(stats.porCategoria || []).map((c, i) => {
                          const max = stats.porCategoria[0]?.cantidad || 1;
                          return (
                            <div className="aadm-bar-row" key={i}>
                              <div className="aadm-bar-label">{CATEGORIAS_MAP[c.categoria] || c.categoria}</div>
                              <div className="aadm-bar-track">
                                <div className="aadm-bar-fill" style={{ width: `${(c.cantidad / max) * 100}%` }} />
                              </div>
                              <div className="aadm-bar-count">{c.cantidad}</div>
                            </div>
                          );
                        })}
                        {(!stats.porCategoria || stats.porCategoria.length === 0) && (
                          <p style={{ color:'#64748b', fontSize:'0.85rem' }}>Sin datos aún</p>
                        )}
                      </div>
                    </div>

                    {/* Por ciudad */}
                    <div className="aadm-chart-card">
                      <h3>🏙️ Anuncios por Ciudad</h3>
                      <div className="aadm-bar-chart">
                        {(stats.porCiudad || []).map((c, i) => {
                          const max = stats.porCiudad[0]?.cantidad || 1;
                          return (
                            <div className="aadm-bar-row" key={i}>
                              <div className="aadm-bar-label">📍 {c.ciudad}</div>
                              <div className="aadm-bar-track">
                                <div className="aadm-bar-fill" style={{ width: `${(c.cantidad / max) * 100}%`, background: 'linear-gradient(90deg, #10b981, #059669)' }} />
                              </div>
                              <div className="aadm-bar-count">{c.cantidad}</div>
                            </div>
                          );
                        })}
                        {(!stats.porCiudad || stats.porCiudad.length === 0) && (
                          <p style={{ color:'#64748b', fontSize:'0.85rem' }}>Sin datos aún</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Más vistos */}
                  <div className="aadm-table-card">
                    <div className="aadm-table-hdr">
                      <h3>🔥 Anuncios más visitados</h3>
                    </div>
                    <div className="aadm-table-wrap">
                      <table className="aadm-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Título</th>
                            <th>Categoría</th>
                            <th>Ciudad</th>
                            <th>Visitas</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(stats.masVistos || []).map((a, i) => (
                            <tr key={a.id}>
                              <td style={{ color:'#64748b' }}>{i + 1}</td>
                              <td style={{ fontWeight:600 }}>{a.titulo}</td>
                              <td>{CATEGORIAS_MAP[a.categoria] || a.categoria}</td>
                              <td>{a.ciudad}</td>
                              <td><strong style={{ color:'#60a5fa' }}>{fmt(a.visitas)}</strong></td>
                              <td><span className={`aadm-badge ${a.estado}`}>{a.estado}</span></td>
                            </tr>
                          ))}
                          {(!stats.masVistos || stats.masVistos.length === 0) && (
                            <tr><td colSpan={6} style={{ textAlign:'center', color:'#64748b', padding:'2rem' }}>Sin anuncios aún</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign:'center', padding:'4rem', color:'#64748b' }}>
                  <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>📊</div>
                  <p>No se pudieron cargar las estadísticas. <button onClick={loadStats} style={{ color:'#60a5fa', background:'none', border:'none', cursor:'pointer', fontSize:'inherit' }}>Reintentar</button></p>
                </div>
              )}
            </div>
          )}

          {/* ══════ TAB: ANUNCIOS ══════ */}
          {tab === 'anuncios' && (
            <div style={{ animation: 'aadm-fadeIn 0.3s ease' }}>
              <div className="aadm-table-card">
                <div className="aadm-table-hdr">
                  <h3>📋 Todos los Anuncios ({fmt(anunciosTot)})</h3>
                  <div className="aadm-filters">
                    <input
                      className="aadm-search"
                      placeholder="🔍 Buscar anuncio o usuario..."
                      value={anunciosFilter.buscar}
                      onChange={e => setAnunciosFilter(f => ({ ...f, buscar: e.target.value }))}
                    />
                    <select className="aadm-select" value={anunciosFilter.estado} onChange={e => setAnunciosFilter(f => ({ ...f, estado: e.target.value }))}>
                      <option value="todos">Todos los estados</option>
                      <option value="activo">Activo</option>
                      <option value="pausado">Pausado</option>
                      <option value="vendido">Vendido</option>
                      <option value="eliminado">Eliminado</option>
                    </select>
                    <select className="aadm-select" value={anunciosFilter.categoria} onChange={e => setAnunciosFilter(f => ({ ...f, categoria: e.target.value }))}>
                      <option value="todas">Todas las categorías</option>
                      {Object.entries(CATEGORIAS_MAP).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="aadm-table-wrap">
                  {loadingAnuncios ? (
                    <div style={{ padding:'2rem', textAlign:'center', color:'#64748b' }}>Cargando anuncios...</div>
                  ) : (
                    <table className="aadm-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Título</th>
                          <th>Categoría</th>
                          <th>Ciudad</th>
                          <th>Precio</th>
                          <th>Vendedor</th>
                          <th>👁️</th>
                          <th>Publicado</th>
                          <th>Expira</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {anuncios.map(a => (
                          <tr key={a.id}>
                            <td style={{ color:'#64748b', fontSize:'0.75rem' }}>#{a.id}</td>
                            <td>
                              <div style={{ fontWeight:600, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.titulo}</div>
                              {a.imagen_principal && (
                                <img src={a.imagen_principal} alt="" style={{ width:36, height:36, objectFit:'cover', borderRadius:4, marginTop:2 }} onError={e => e.target.style.display='none'} />
                              )}
                            </td>
                            <td style={{ fontSize:'0.8rem' }}>{CATEGORIAS_MAP[a.categoria] || a.categoria}</td>
                            <td style={{ fontSize:'0.8rem' }}>📍 {a.ciudad}</td>
                            <td style={{ fontWeight:600, color:'#6ee7b7' }}>{a.precio}</td>
                            <td>
                              <div style={{ fontSize:'0.8rem' }}>{a.vendedor || '—'}</div>
                              <div style={{ fontSize:'0.72rem', color:'#64748b' }}>{a.vendedor_correo}</div>
                            </td>
                            <td style={{ color:'#60a5fa', fontWeight:600 }}>{fmt(a.visitas)}</td>
                            <td style={{ fontSize:'0.78rem', color:'#94a3b8' }}>{fmtDate(a.created_at)}</td>
                            <td style={{ fontSize:'0.78rem', color: new Date(a.fecha_expiracion) < new Date() ? '#fca5a5' : '#94a3b8' }}>
                              {fmtDate(a.fecha_expiracion)}
                            </td>
                            <td><span className={`aadm-badge ${a.estado}`}>{a.estado}</span></td>
                            <td>
                              <div className="aadm-action-btns">
                                {a.estado !== 'activo' && (
                                  <button className="aadm-btn-sm success" onClick={() => setModal({ type:'confirm_ad', data:a, action:'activo' })}>✅ Activar</button>
                                )}
                                {a.estado === 'activo' && (
                                  <button className="aadm-btn-sm warn" onClick={() => setModal({ type:'confirm_ad', data:a, action:'pausado' })}>⏸️ Pausar</button>
                                )}
                                {a.estado !== 'eliminado' && (
                                  <button className="aadm-btn-sm danger" onClick={() => setModal({ type:'confirm_ad', data:a, action:'eliminado' })}>🗑️ Baja</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {anuncios.length === 0 && !loadingAnuncios && (
                          <tr><td colSpan={11} style={{ textAlign:'center', color:'#64748b', padding:'2rem' }}>
                            No se encontraron anuncios con estos filtros.
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="aadm-pagination">
                  <span>Mostrando {Math.min((anunciosPag - 1) * 15 + 1, anunciosTot)}–{Math.min(anunciosPag * 15, anunciosTot)} de {fmt(anunciosTot)}</span>
                  <div className="aadm-pag-btns">
                    <button className="aadm-pag-btn" disabled={anunciosPag <= 1} onClick={() => loadAnuncios(anunciosPag - 1)}>◀</button>
                    <button className="aadm-pag-btn" disabled={anunciosPag * 15 >= anunciosTot} onClick={() => loadAnuncios(anunciosPag + 1)}>▶</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════ TAB: USUARIOS ══════ */}
          {tab === 'usuarios' && (
            <div style={{ animation: 'aadm-fadeIn 0.3s ease' }}>
              <div className="aadm-table-card">
                <div className="aadm-table-hdr">
                  <h3>👥 Usuarios Anunciantes ({fmt(usuariosTot)})</h3>
                  <div className="aadm-filters">
                    <input
                      className="aadm-search"
                      placeholder="🔍 Buscar por nombre, correo..."
                      value={usuariosFilter.buscar}
                      onChange={e => setUsuariosFilter(f => ({ ...f, buscar: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="aadm-table-wrap">
                  {loadingUsuarios ? (
                    <div style={{ padding:'2rem', textAlign:'center', color:'#64748b' }}>Cargando usuarios...</div>
                  ) : (
                    <table className="aadm-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Nombre</th>
                          <th>Correo</th>
                          <th>Teléfono</th>
                          <th>Ciudad</th>
                          <th>Auth</th>
                          <th>Anuncios</th>
                          <th>Activos</th>
                          <th>Registrado</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usuarios.map(u => (
                          <tr key={u.id}>
                            <td style={{ color:'#64748b', fontSize:'0.75rem' }}>#{u.id}</td>
                            <td>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                {u.avatar_url ? (
                                  <img src={u.avatar_url} alt="" style={{ width:30, height:30, borderRadius:'50%', objectFit:'cover' }} onError={e => e.target.style.display='none'} />
                                ) : (
                                  <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg, #3b82f6, #8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.8rem', fontWeight:700, color:'#fff', flexShrink:0 }}>
                                    {(u.nombre_completo || '?')[0].toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontWeight:600, fontSize:'0.85rem' }}>{u.nombre_completo}</div>
                                  {u.apellidos && <div style={{ fontSize:'0.75rem', color:'#64748b' }}>{u.apellidos}</div>}
                                </div>
                              </div>
                            </td>
                            <td style={{ fontSize:'0.8rem' }}>{u.correo}</td>
                            <td style={{ fontSize:'0.8rem' }}>{u.telefono || '—'}</td>
                            <td style={{ fontSize:'0.8rem' }}>📍 {u.ubicacion || '—'}</td>
                            <td><span className={`aadm-badge ${u.auth_provider}`}>{u.auth_provider === 'google' ? '🌐 Google' : '🔑 Local'}</span></td>
                            <td style={{ fontWeight:600, textAlign:'center' }}>{u.total_anuncios}</td>
                            <td style={{ color:'#6ee7b7', fontWeight:600, textAlign:'center' }}>{u.anuncios_activos}</td>
                            <td style={{ fontSize:'0.78rem', color:'#94a3b8' }}>{fmtDate(u.created_at)}</td>
                            <td>
                              <span style={{
                                display:'inline-flex', alignItems:'center', gap:4,
                                padding:'2px 8px', borderRadius:20, fontSize:'0.72rem', fontWeight:600,
                                background: u.activo ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                color: u.activo ? '#6ee7b7' : '#fca5a5'
                              }}>
                                {u.activo ? '● Activo' : '● Inactivo'}
                              </span>
                            </td>
                            <td>
                              <div className="aadm-action-btns">
                                <button className="aadm-btn-sm info" onClick={() => verAnunciosUsuario(u)}>📋 Ver anuncios</button>
                                {u.activo ? (
                                  <button className="aadm-btn-sm danger" onClick={() => setModal({ type:'confirm_user', data:u, action:false })}>🚫 Desactivar</button>
                                ) : (
                                  <button className="aadm-btn-sm success" onClick={() => setModal({ type:'confirm_user', data:u, action:true })}>✅ Activar</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {usuarios.length === 0 && !loadingUsuarios && (
                          <tr><td colSpan={11} style={{ textAlign:'center', color:'#64748b', padding:'2rem' }}>No se encontraron usuarios.</td></tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="aadm-pagination">
                  <span>Mostrando {Math.min((usuariosPag - 1) * 15 + 1, usuariosTot)}–{Math.min(usuariosPag * 15, usuariosTot)} de {fmt(usuariosTot)}</span>
                  <div className="aadm-pag-btns">
                    <button className="aadm-pag-btn" disabled={usuariosPag <= 1} onClick={() => loadUsuarios(usuariosPag - 1)}>◀</button>
                    <button className="aadm-pag-btn" disabled={usuariosPag * 15 >= usuariosTot} onClick={() => loadUsuarios(usuariosPag + 1)}>▶</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════ TAB: CUPONES ══════ */}
          {tab === 'cupones' && (
            <div style={{ animation: 'aadm-fadeIn 0.3s ease' }}>
              <div className="aadm-table-card">
                <div className="aadm-table-hdr" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <h3>🎟️ Cupones de Publicación ({cupones.length})</h3>
                  <button
                    onClick={() => setModalCrearCupon(true)}
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      border: 'none',
                      color: '#fff',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
                    }}
                  >
                    ＋ Crear Cupón
                  </button>
                </div>

                <div className="aadm-table-wrap">
                  {loadingCupones ? (
                    <div style={{ padding:'2rem', textAlign:'center', color:'#64748b' }}>Cargando cupones...</div>
                  ) : (
                    <table className="aadm-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Código</th>
                          <th>Descripción</th>
                          <th>Tipo / Beneficio</th>
                          <th>Usos / Límite Total</th>
                          <th>Límite por Usuario</th>
                          <th>Estado</th>
                          <th>Creado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cupones.map(c => (
                          <tr key={c.id}>
                            <td style={{ color:'#64748b', fontSize:'0.75rem' }}>#{c.id}</td>
                            <td>
                              <span style={{
                                background: '#1e293b',
                                border: '1px solid #38bdf8',
                                color: '#38bdf8',
                                padding: '3px 10px',
                                borderRadius: '6px',
                                fontWeight: 800,
                                fontSize: '0.88rem',
                                letterSpacing: '1px'
                              }}>
                                {c.codigo}
                              </span>
                            </td>
                            <td style={{ fontSize:'0.85rem', color:'#e2e8f0' }}>{c.descripcion || '—'}</td>
                            <td>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                background: c.tipo === 'gratis' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                                color: c.tipo === 'gratis' ? '#6ee7b7' : '#93c5fd'
                              }}>
                                {c.tipo === 'gratis' ? '🎁 100% Gratis' : `${c.valor}%`}
                              </span>
                            </td>
                            <td style={{ fontWeight:700, fontSize:'0.85rem' }}>
                              <span style={{ color: c.usos_actuales >= c.limite_usos ? '#f87171' : '#6ee7b7' }}>
                                {c.usos_actuales}
                              </span>
                              {' / '}
                              <span style={{ color:'#94a3b8' }}>
                                {c.limite_usos || 'Ilimitado'}
                              </span>
                            </td>
                            <td style={{ fontSize:'0.82rem', color:'#cbd5e1' }}>
                              {c.limite_por_usuario ? `${c.limite_por_usuario} uso(s) por usuario` : 'Ilimitado'}
                            </td>
                            <td>
                              <span style={{
                                display:'inline-flex', alignItems:'center', gap:4,
                                padding:'2px 8px', borderRadius:20, fontSize:'0.72rem', fontWeight:600,
                                background: c.activo ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                color: c.activo ? '#6ee7b7' : '#fca5a5'
                              }}>
                                {c.activo ? '● Activo' : '● Inactivo'}
                              </span>
                            </td>
                            <td style={{ fontSize:'0.78rem', color:'#94a3b8' }}>{fmtDate(c.created_at)}</td>
                            <td>
                              <div className="aadm-action-btns">
                                <button
                                  className={`aadm-btn-sm ${c.activo ? 'danger' : 'success'}`}
                                  onClick={() => handleToggleEstadoCupon(c)}
                                >
                                  {c.activo ? '🚫 Desactivar' : '✅ Activar'}
                                </button>
                                <button
                                  className="aadm-btn-sm danger"
                                  onClick={() => handleEliminarCupon(c)}
                                  title="Eliminar cupón"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {cupones.length === 0 && !loadingCupones && (
                          <tr><td colSpan={9} style={{ textAlign:'center', color:'#64748b', padding:'2rem' }}>No hay cupones creados aún. Haz clic en "＋ Crear Cupón" para crear uno.</td></tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── MODAL: CREAR CUPÓN ── */}
      {modalCrearCupon && (
        <div className="aadm-modal-overlay" onClick={() => setModalCrearCupon(false)}>
          <div className="aadm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h3>🎟️ Crear Cupón de Publicación</h3>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 16px' }}>
              Crea un cupón promocional para que los usuarios puedan publicar gratis o con descuento ingresando el código.
            </p>

            <form onSubmit={handleCrearCupon}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                  Código del Cupón * (en mayúsculas)
                </label>
                <input
                  type="text"
                  placeholder="Ej: VPPP"
                  value={formCupon.codigo}
                  onChange={e => setFormCupon(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #475569',
                    color: '#fff',
                    fontWeight: 700,
                    letterSpacing: '1px',
                    fontSize: '0.95rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                  Descripción del Cupón
                </label>
                <input
                  type="text"
                  placeholder="Ej: Cupón de Publicación 100% Gratis"
                  value={formCupon.descripcion}
                  onChange={e => setFormCupon(f => ({ ...f, descripcion: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #475569',
                    color: '#fff',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                    Límite Total de Usos *
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ej: 10"
                    value={formCupon.limite_usos}
                    onChange={e => setFormCupon(f => ({ ...f, limite_usos: parseInt(e.target.value) || 1 }))}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: '#1e293b',
                      border: '1px solid #475569',
                      color: '#fff',
                      fontSize: '0.88rem'
                    }}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Ej. 10 para máx 10 publicaciones</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                    Usos por Usuario *
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ej: 1"
                    value={formCupon.limite_por_usuario}
                    onChange={e => setFormCupon(f => ({ ...f, limite_por_usuario: parseInt(e.target.value) || 1 }))}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: '#1e293b',
                      border: '1px solid #475569',
                      color: '#fff',
                      fontSize: '0.88rem'
                    }}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Máx usos por cada cuenta</span>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                  Tipo de Beneficio
                </label>
                <select
                  value={formCupon.tipo}
                  onChange={e => setFormCupon(f => ({ ...f, tipo: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #475569',
                    color: '#fff',
                    fontSize: '0.88rem'
                  }}
                >
                  <option value="gratis">🎁 Publicación 100% Gratis</option>
                  <option value="porcentaje">Porcentaje de Descuento</option>
                  <option value="monto">Monto Fijo en Bs</option>
                </select>
              </div>

              <div className="aadm-modal-btns">
                <button type="button" className="cancel-btn" onClick={() => setModalCrearCupon(false)}>
                  Cancelar
                </button>
                <button type="submit" className="confirm-btn green" disabled={guardandoCupon}>
                  {guardandoCupon ? 'Guardando...' : '💾 Crear Cupón'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════ MODALES ══════ */}

      {/* Confirmar cambio de estado anuncio */}
      {modal?.type === 'confirm_ad' && (
        <div className="aadm-modal-overlay" onClick={() => setModal(null)}>
          <div className="aadm-modal" onClick={e => e.stopPropagation()}>
            <h3>
              {modal.action === 'eliminado' ? '🗑️ Dar de baja anuncio' :
               modal.action === 'pausado'   ? '⏸️ Pausar anuncio' :
               '✅ Activar anuncio'}
            </h3>
            <p>
              ¿Estás seguro de que quieres cambiar el estado del anuncio{' '}
              <strong>"{modal.data.titulo}"</strong>{' '}
              {modal.action === 'eliminado' ? 'a ELIMINADO? El anuncio dejará de ser visible para los usuarios.' :
               modal.action === 'pausado'   ? 'a PAUSADO? El anuncio quedará temporalmente oculto.' :
               'a ACTIVO? El anuncio volverá a ser visible.'}
            </p>
            {modal.data.vendedor_correo && (
              <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'0.6rem 0.8rem', marginBottom:'1rem', fontSize:'0.8rem', color:'#94a3b8' }}>
                📧 Anunciante: <strong style={{ color:'#e2e8f0' }}>{modal.data.vendedor}</strong> ({modal.data.vendedor_correo})
              </div>
            )}
            <div className="aadm-modal-btns">
              <button className="cancel-btn" onClick={() => setModal(null)}>Cancelar</button>
              <button
                className={`confirm-btn ${modal.action === 'activo' ? 'green' : ''}`}
                onClick={() => cambiarEstadoAnuncio(modal.data.id, modal.action)}
              >
                {modal.action === 'eliminado' ? '🗑️ Sí, dar de baja' :
                 modal.action === 'pausado'   ? '⏸️ Sí, pausar' :
                 '✅ Sí, activar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar cambio de estado usuario */}
      {modal?.type === 'confirm_user' && (
        <div className="aadm-modal-overlay" onClick={() => setModal(null)}>
          <div className="aadm-modal" onClick={e => e.stopPropagation()}>
            <h3>{modal.action ? '✅ Activar usuario' : '🚫 Desactivar usuario'}</h3>
            <p>
              ¿Estás seguro de que quieres <strong>{modal.action ? 'activar' : 'desactivar'}</strong> al usuario{' '}
              <strong>{modal.data.nombre_completo}</strong> ({modal.data.correo})?
              {!modal.action && ' Esta acción impedirá que el usuario inicie sesión y sus anuncios serán ocultados.'}
            </p>
            <div className="aadm-modal-btns">
              <button className="cancel-btn" onClick={() => setModal(null)}>Cancelar</button>
              <button
                className={`confirm-btn ${modal.action ? 'green' : ''}`}
                onClick={() => cambiarEstadoUsuario(modal.data.id, modal.action)}
              >
                {modal.action ? '✅ Sí, activar' : '🚫 Sí, desactivar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Anuncios de un usuario */}
      {modal?.type === 'user_anuncios' && userAnuncios && (
        <div className="aadm-modal-overlay" onClick={() => setModal(null)}>
          <div className="aadm-modal aadm-anuncio-detail" style={{ maxWidth:700, maxHeight:'85vh', overflow:'auto' }} onClick={e => e.stopPropagation()}>
            <h3>📋 Anuncios de {userAnuncios.usuario.nombre_completo}</h3>
            <p style={{ marginBottom:'1rem' }}>
              {userAnuncios.usuario.correo} · {userAnuncios.anuncios.length} publicación(es)
            </p>
            {userAnuncios.anuncios.length === 0 ? (
              <div style={{ textAlign:'center', padding:'2rem', color:'#64748b' }}>Este usuario no tiene anuncios publicados.</div>
            ) : (
              <table className="aadm-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Título</th>
                    <th>Cat.</th>
                    <th>Ciudad</th>
                    <th>👁️</th>
                    <th>Expira</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {userAnuncios.anuncios.map(a => (
                    <tr key={a.id}>
                      <td style={{ color:'#64748b', fontSize:'0.75rem' }}>#{a.id}</td>
                      <td style={{ fontWeight:600, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.titulo}</td>
                      <td style={{ fontSize:'0.78rem' }}>{CATEGORIAS_MAP[a.categoria] || a.categoria}</td>
                      <td style={{ fontSize:'0.78rem' }}>{a.ciudad}</td>
                      <td style={{ color:'#60a5fa' }}>{fmt(a.visitas)}</td>
                      <td style={{ fontSize:'0.75rem', color: new Date(a.fecha_expiracion) < new Date() ? '#fca5a5' : '#94a3b8' }}>{fmtDate(a.fecha_expiracion)}</td>
                      <td><span className={`aadm-badge ${a.estado}`}>{a.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="aadm-modal-btns" style={{ marginTop:'1.2rem' }}>
              <button className="cancel-btn" onClick={() => setModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
