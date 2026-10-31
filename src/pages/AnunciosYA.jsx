import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import api from '../api/axios';
import './AnunciosYA.css';

/* ── Constantes ───────────────────────────────────── */
const ADMIN_EMAIL = 'reviewiasit@gmail.com';
const CIUDADES = ['Todas', 'La Paz', 'El Alto', 'Santa Cruz', 'Cochabamba', 'Oruro', 'Potosí', 'Sucre', 'Tarija', 'Beni', 'Pando'];

const DEPARTAMENTOS_BOLIVIA = [
  'Cochabamba',
  'La Paz',
  'El Alto',
  'Santa Cruz',
  'Oruro',
  'Potosí',
  'Chuquisaca / Sucre',
  'Tarija',
  'Beni',
  'Pando'
];

const CATEGORIAS = [
  { id: 'todas',       icon: 'fa-solid fa-border-all',      nombre: 'Todas',             count: 58142 },
  { id: 'vehiculos',   icon: 'fa-solid fa-car',             nombre: 'Veh\u00edculos',         count: 12458 },
  { id: 'inmuebles',   icon: 'fa-solid fa-house',           nombre: 'Inmuebles',         count: 8732  },
  { id: 'electronica', icon: 'fa-solid fa-mobile-screen',  nombre: 'Tecnolog\u00eda',        count: 15621 },
  { id: 'hogar',       icon: 'fa-solid fa-couch',          nombre: 'Hogar y Muebles',   count: 7341  },
  { id: 'moda',        icon: 'fa-solid fa-shirt',          nombre: 'Ropa y Accesorios', count: 5876  },
  { id: 'empleo',      icon: 'fa-solid fa-briefcase',      nombre: 'Empleos',           count: 4235  },
  { id: 'servicios',   icon: 'fa-solid fa-screwdriver-wrench', nombre: 'Servicios',    count: 6912  },
  { id: 'mascotas',    icon: 'fa-solid fa-paw',            nombre: 'Mascotas',          count: 2134  },
  { id: 'otros',       icon: 'fa-solid fa-ellipsis',       nombre: 'Otros',             count: 3567  },
  { id: 'tiendas',     icon: 'fa-solid fa-store',          nombre: 'Tiendas',           count: 0     },
];

const POPULARES = ['Celulares', 'Departamentos', 'Autos', 'Laptops', 'Trabajos', 'Terrenos'];

const CATS_MAP = Object.fromEntries(CATEGORIAS.map(c => [c.id, c.nombre]));

/* ── Fotos reales por categoría (Unsplash) ────────── */
const IMG_CAT = {
  vehiculos:   'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=120&q=75',
  inmuebles:   'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=120&q=75',
  electronica: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=120&q=75',
  hogar:       'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=120&q=75',
  moda:        'https://images.unsplash.com/photo-1445205170230-053b83016050?w=120&q=75',
  empleo:      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=120&q=75',
  servicios:   'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=120&q=75',
  mascotas:    'https://images.unsplash.com/photo-1552053831-71594a27632d?w=120&q=75',
};

/* ── Paleta de Colores Llamativos para Títulos (+1 Bs) ── */
const COLORES_LLAMATIVOS = [
  { id: 'naranja', nombre: 'Naranja Fuego', hex: '#ea580c' },
  { id: 'azul',    nombre: 'Azul Eléctrico', hex: '#2563eb' },
  { id: 'verde',   nombre: 'Verde Esmeralda', hex: '#16a34a' },
  { id: 'purpura', nombre: 'Púrpura Neón',  hex: '#9333ea' },
  { id: 'dorado',  nombre: 'Oro / Dorado',  hex: '#d97706' },
  { id: 'rojo',    nombre: 'Rojo Pasión',   hex: '#dc2626' },
];

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════ */
export default function AnunciosYA() {
  const navigate = useNavigate();
  const [catActiva,    setCatActiva]    = useState('todas');
  const [busInput,     setBusInput]     = useState('');
  const [busHero,      setBusHero]      = useState('');
  const [filtroCiudad, setFiltroCiudad] = useState('Todas');
  const [filtroSelect, setFiltroSelect] = useState('todas');
  const [destacados,   setDestacados]   = useState([]);
  const [ultimos,      setUltimos]      = useState([]);
  const [cargandoAnuncios, setCargandoAnuncios] = useState(false);

  /* Estado del anuncio activo para cargar la vista completa (NO ventana emergente) */
  const [anuncioActivo, setAnuncioActivo] = useState(null);

  /* Estado para vista de Perfil de usuario */
  const [vistaPerfil, setVistaPerfil] = useState(false);

  /* Modal de publicación */
  const [modalPub, setModalPub] = useState(false);
  const [toast, setToast] = useState(null);

  /* ── Estados del Módulo Tiendas ── */
  const [tiendas,          setTiendas]          = useState([]);
  const [cargandoTiendas,  setCargandoTiendas]  = useState(false);
  const [tiendaActiva,     setTiendaActiva]     = useState(null); // Detalle de tienda seleccionada
  const [miTienda,         setMiTienda]         = useState(null); // Tienda del usuario autenticado
  const [vistaGestionTienda, setVistaGestionTienda] = useState(false); // Panel de gestión (dueño)
  const [modalRegistroTienda, setModalRegistroTienda] = useState(false); // Modal registro tienda
  const [formTienda, setFormTienda] = useState({
    nombre_tienda: '',
    nombre_propietario: '',
    descripcion: '',
    ubicacion: 'Cochabamba',
    direccion: '',
    telefono: '',
    email: '',
    logo_url: '',
    categoria_principal: ''
  });
  const [modalProducto, setModalProducto] = useState(false);
  const [productoEdit, setProductoEdit] = useState(null); // null = crear, object = editar
  const [formProducto, setFormProducto] = useState({
    nombre: '', descripcion: '', categoria: 'otros',
    precio: '', cantidad_disponible: '', imagen_url: ''
  });
  const [guardandoTienda, setGuardandoTienda] = useState(false);
  const [guardandoProducto, setGuardandoProducto] = useState(false);
  // Modal para elegir tipo de cuenta (particular vs negocio) después de Google login
  const [modalTipoCuenta, setModalTipoCuenta] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);


  /* Estado de Autenticación */
  const [usuarioAuth, setUsuarioAuth] = useState(() => {
    try {
      const u = localStorage.getItem('anunciosya_usuario');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });
  const [modalAuth, setModalAuth] = useState(false);
  const [tabAuth, setTabAuth]     = useState('login'); // 'login' | 'registro'

  /* Formularios de autenticación */
  const [formLogin, setFormLogin] = useState({ email: '', password: '' });
  const [formRegistro, setFormRegistro] = useState({
    nombre: '',
    apellidos: '', // Opcional
    telefono: '',  // Obligatorio
    ubicacion: 'Cochabamba', // Obligatorio
    direccion: '', // Opcional
    email: '',
    password: ''
  });

  /* Formulario de Perfil editable */
  const [formPerfil, setFormPerfil] = useState({
    nombre: '',
    apellidos: '',
    telefono: '',
    ubicacion: 'Cochabamba',
    direccion: '',
    email: ''
  });

  /* ── Estados del Wizard de Publicación en 3 Pasos ── */
  const [pasoPub, setPasoPub] = useState(1); // 1: Datos de usuario, 2: Detalles del anuncio, 3: Duración, Color y Pago QR
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [datosUserPub, setDatosUserPub] = useState({
    nombre: '',
    apellidos: '',
    telefono: '',
    ubicacion: 'Cochabamba',
    direccion: '',
    email: ''
  });
  const [datosAdPub, setDatosAdPub] = useState({
    titulo: '',
    categoria: '',
    ciudad: 'Cochabamba',
    precio: '',
    desc: '',
    direccion: '',
    imagenes: [] // Hasta 4 fotos opcionales
  });
  const [inputFotoUrl, setInputFotoUrl] = useState('');
  const [subiendoFotos, setSubiendoFotos] = useState(false);
  const [mostrarInputUrl, setMostrarInputUrl] = useState(false);
  const [pubDias, setPubDias] = useState(6); // Por defecto 6 días incluidos
  const [pubColorActivo, setPubColorActivo] = useState(false); // +1 Bs si se activa
  const [pubColorTitulo, setPubColorTitulo] = useState('#ea580c'); // Color seleccionado

  /* Estado de foto activa en el visor del detalle de un anuncio */
  const [fotoActivaIndex, setFotoActivaIndex] = useState(0);

  /* Modal de advertencias de seguridad antes de contactar por WhatsApp */
  const [modalSeguridadWsp, setModalSeguridadWsp] = useState(false);

  /* Modal de denuncia de anuncio */
  const [modalDenuncia, setModalDenuncia] = useState(false);
  const [motivoDenuncia, setMotivoDenuncia] = useState('estafa');
  const [comentarioDenuncia, setComentarioDenuncia] = useState('');
  const [enviandoDenuncia, setEnviandoDenuncia] = useState(false);

  /* Modal legal: Términos, Política de privacidad, Normas y Guía */
  const [modalLegal, setModalLegal] = useState(null); // 'terminos' | 'privacidad' | 'normas' | 'comoPublicar' | null

  /* Cálculos de costos en tiempo real:
     - Tarifa base de publicación: 5.00 Bs (incluye 6 días)
     - Días adicionales: 0.50 Bs por cada día extra (> 6 días)
     - Color llamativo en título: 1.00 Bs
  */
  const COSTO_BASE = 5.00;
  const diasExtra = Math.max(0, pubDias - 6);
  const costoDiasExtra = diasExtra * 0.50;
  const costoColor = pubColorActivo ? 1.00 : 0.00;
  const costoSubtotal = COSTO_BASE + costoDiasExtra + costoColor;

  /* Estados de cupón de descuento / publicación gratis */
  const [codigoCuponInput, setCodigoCuponInput] = useState('');
  const [validandoCupon, setValidandoCupon]     = useState(false);
  const [cuponAplicado, setCuponAplicado]       = useState(null); // { id, codigo, tipo, valor, descripcion }

  /* Descuento del cupón aplicado */
  let descuentoCupon = 0;
  if (cuponAplicado) {
    if (cuponAplicado.tipo === 'gratis' || cuponAplicado.valor >= 100) {
      descuentoCupon = costoSubtotal;
    } else if (cuponAplicado.tipo === 'porcentaje') {
      descuentoCupon = costoSubtotal * (cuponAplicado.valor / 100);
    } else if (cuponAplicado.tipo === 'monto') {
      descuentoCupon = Math.min(costoSubtotal, cuponAplicado.valor);
    }
  }
  const costoTotalCalculado = Math.max(0, costoSubtotal - descuentoCupon).toFixed(2);
  const esPublicacionGratis  = cuponAplicado && parseFloat(costoTotalCalculado) === 0;

  /* Cargar anuncios reales desde la base de datos MySQL */
  const cargarAnuncios = async () => {
    try {
      setCargandoAnuncios(true);
      const res = await api.get('/anuncios');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setDestacados(res.data.data);
        setUltimos(res.data.data);
      }
    } catch (err) {
      console.error('Error al cargar anuncios de MySQL:', err);
    } finally {
      setCargandoAnuncios(false);
    }
  };

  useEffect(() => {
    cargarAnuncios();
  }, []);

  /* ── Carga de tiendas ── */
  const cargarTiendas = async (filtros = {}) => {
    try {
      setCargandoTiendas(true);
      const params = new URLSearchParams();
      if (filtros.ubicacion && filtros.ubicacion !== 'Todas') params.append('ubicacion', filtros.ubicacion);
      if (filtros.categoria && filtros.categoria !== 'Todos') params.append('categoria', filtros.categoria);
      if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
      const res = await api.get(`/tiendas?${params.toString()}`);
      if (res.data?.success) setTiendas(res.data.data || []);
    } catch (err) {
      console.error('Error al cargar tiendas:', err);
    } finally {
      setCargandoTiendas(false);
    }
  };

  const cargarMiTienda = async () => {
    const token = localStorage.getItem('anunciosya_token');
    if (!token) return;
    try {
      const res = await api.get('/tiendas/mi-tienda/perfil', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) setMiTienda(res.data.data);
    } catch (err) {
      console.error('Error al cargar mi tienda:', err);
    }
  };

  /* Cargar mi tienda automáticamente al haber usuario autenticado */
  useEffect(() => {
    if (usuarioAuth) {
      cargarMiTienda();
    } else {
      setMiTienda(null);
    }
  }, [usuarioAuth]);

  /* Cargar tiendas cuando se activa la categoría */
  useEffect(() => {
    if (catActiva === 'tiendas') {
      cargarTiendas();
      if (usuarioAuth) cargarMiTienda();
    }
  }, [catActiva, usuarioAuth]);

  /* Acciones de tienda desde perfil o header */
  const abrirCrearTiendaDesdePerfil = () => {
    setFormTienda({
      nombre_tienda: '',
      nombre_propietario: `${usuarioAuth?.nombre || ''} ${usuarioAuth?.apellidos || ''}`.trim(),
      descripcion: '',
      ubicacion: usuarioAuth?.ubicacion || 'Cochabamba',
      direccion: usuarioAuth?.direccion || '',
      telefono: usuarioAuth?.telefono || '',
      email: usuarioAuth?.correo || usuarioAuth?.email || '',
      logo_url: '',
      categoria_principal: ''
    });
    setModalRegistroTienda(true);
  };

  const irAGestionMiTienda = () => {
    setVistaPerfil(false);
    setAnuncioActivo(null);
    setTiendaActiva(null);
    setCatActiva('tiendas');
    setVistaGestionTienda(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const irAVerMiTienda = () => {
    if (!miTienda?.id) return;
    setVistaPerfil(false);
    setAnuncioActivo(null);
    setVistaGestionTienda(false);
    setCatActiva('tiendas');
    verDetalleTienda(miTienda.id);
  };

  /* Abrir detalle de una tienda */
  const verDetalleTienda = async (tiendaId) => {
    try {
      const res = await api.get(`/tiendas/${tiendaId}`);
      if (res.data?.success) {
        setTiendaActiva(res.data.data);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      mostrarToast('❌ Error al cargar la tienda');
    }
  };

  /* Crear o actualizar tienda */
  const handleGuardarTienda = async (e) => {
    e.preventDefault();
    if (!formTienda.nombre_tienda.trim() || !formTienda.nombre_propietario.trim()) {
      mostrarToast('⚠️ Nombre de tienda y propietario son obligatorios');
      return;
    }
    const token = localStorage.getItem('anunciosya_token');
    if (!token) { mostrarToast('⚠️ Debes iniciar sesión'); return; }
    setGuardandoTienda(true);
    try {
      let res;
      if (miTienda?.id) {
        res = await api.put(`/tiendas/${miTienda.id}`, formTienda, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        res = await api.post('/tiendas', formTienda, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      if (res.data?.success) {
        setMiTienda(res.data.data);
        setModalRegistroTienda(false);
        mostrarToast('🎉 ' + (miTienda?.id ? 'Tienda actualizada' : '¡Tienda creada exitosamente!'));
        cargarTiendas();
      } else {
        mostrarToast('⚠️ ' + (res.data?.message || 'Error al guardar'));
      }
    } catch (err) {
      mostrarToast('❌ ' + (err.response?.data?.message || 'Error al guardar la tienda'));
    } finally {
      setGuardandoTienda(false);
    }
  };

  /* Guardar producto (crear o editar) */
  const handleGuardarProducto = async (e) => {
    e.preventDefault();
    if (!formProducto.nombre.trim() || formProducto.precio === '') {
      mostrarToast('⚠️ Nombre y precio son obligatorios');
      return;
    }
    const token = localStorage.getItem('anunciosya_token');
    if (!token) { mostrarToast('⚠️ Debes iniciar sesión'); return; }
    setGuardandoProducto(true);
    try {
      let res;
      if (productoEdit?.id) {
        res = await api.put(`/tiendas/productos/${productoEdit.id}`, formProducto, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        res = await api.post('/tiendas/productos/crear', {
          ...formProducto,
          id_tienda: miTienda.id
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      if (res.data?.success) {
        setModalProducto(false);
        setProductoEdit(null);
        setFormProducto({ nombre: '', descripcion: '', categoria: 'otros', precio: '', cantidad_disponible: '', imagen_url: '' });
        mostrarToast('✅ Producto guardado');
        cargarMiTienda();
      } else {
        mostrarToast('⚠️ ' + res.data?.message);
      }
    } catch (err) {
      mostrarToast('❌ ' + (err.response?.data?.message || 'Error al guardar producto'));
    } finally {
      setGuardandoProducto(false);
    }
  };

  /* Eliminar producto */
  const handleEliminarProducto = async (prodId) => {
    if (!window.confirm('¿Eliminar este producto?')) return;
    const token = localStorage.getItem('anunciosya_token');
    try {
      const res = await api.delete(`/tiendas/productos/${prodId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        mostrarToast('🗑️ Producto eliminado');
        cargarMiTienda();
      }
    } catch (err) {
      mostrarToast('❌ Error al eliminar producto');
    }
  };

  /* Comprimir imagen para tienda/producto */
  const comprimirImagenTienda = (file, maxW = 800, quality = 0.7) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(maxW / img.width, maxW / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });



  /* Sincronizar formulario de perfil y datos de usuario al cambiar sesión */
  useEffect(() => {
    if (usuarioAuth) {
      const nom = usuarioAuth.nombre || usuarioAuth.nombre_completo || '';
      const ape = usuarioAuth.apellidos || '';
      const tel = usuarioAuth.telefono || '';
      const ubi = usuarioAuth.ubicacion || 'Cochabamba';
      const dir = usuarioAuth.direccion || '';
      const cor = usuarioAuth.correo || usuarioAuth.email || '';

      setFormPerfil({
        nombre: nom,
        apellidos: ape,
        telefono: tel,
        ubicacion: ubi,
        direccion: dir,
        email: cor
      });

      setDatosUserPub(prev => ({
        ...prev,
        nombre: nom,
        apellidos: ape,
        telefono: tel,
        ubicacion: ubi,
        direccion: dir,
        email: cor
      }));

      setDatosAdPub(prev => ({
        ...prev,
        ciudad: ubi || prev.ciudad
      }));
    }
  }, [usuarioAuth]);

  /* Filtrado de anuncios destacados */
  const destaFiltrados = useMemo(() => {
    let list = destacados;
    if (catActiva !== 'todas') list = list.filter(a => a.categoria === catActiva);
    if (filtroCiudad !== 'Todas') list = list.filter(a => a.ciudad === filtroCiudad);
    if (busHero.trim()) {
      const b = busHero.toLowerCase();
      list = list.filter(a => a.titulo.toLowerCase().includes(b) || (a.desc && a.desc.toLowerCase().includes(b)));
    }
    return list;
  }, [destacados, catActiva, filtroCiudad, busHero]);

  function mostrarToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }

  /* Función para cargar el anuncio en la página directamente */
  function irAAnuncio(anuncio) {
    setVistaPerfil(false);
    setFotoActivaIndex(0);
    setAnuncioActivo(anuncio);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function volverAInicio() {
    setAnuncioActivo(null);
    setVistaPerfil(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function abrirPerfil() {
    if (!usuarioAuth) {
      setTabAuth('login');
      setModalAuth(true);
      return;
    }
    cargarMiTienda();
    setFormPerfil({
      nombre: usuarioAuth.nombre || usuarioAuth.nombre_completo || '',
      apellidos: usuarioAuth.apellidos || '',
      telefono: usuarioAuth.telefono || '',
      ubicacion: usuarioAuth.ubicacion || 'Cochabamba',
      direccion: usuarioAuth.direccion || '',
      email: usuarioAuth.correo || usuarioAuth.email || ''
    });
    setAnuncioActivo(null);
    setTiendaActiva(null);
    setVistaGestionTienda(false);
    setVistaPerfil(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleFavD(id, e) {
    if (e) e.stopPropagation();
    setDestacados(p => p.map(a => a.id === id ? { ...a, fav: !a.fav } : a));
    if (anuncioActivo && anuncioActivo.id === id) {
      setAnuncioActivo(prev => ({ ...prev, fav: !prev.fav }));
    }
  }

  function toggleFavU(id, e) {
    if (e) e.stopPropagation();
    setUltimos(p => p.map(a => a.id === id ? { ...a, fav: !a.fav } : a));
    if (anuncioActivo && anuncioActivo.id === id) {
      setAnuncioActivo(prev => ({ ...prev, fav: !prev.fav }));
    }
  }

  const [cargandoAuth, setCargandoAuth] = useState(false);

  /* Autenticación con Google conectada a la API Backend */
  async function handleGoogleSuccess(credentialResponse) {
    if (!credentialResponse?.credential) {
      mostrarToast('⚠️ No se recibió credencial de Google.');
      return;
    }
    setCargandoAuth(true);
    try {
      const res = await api.post('/anuncios/auth/google', {
        token: credentialResponse.credential
      });
      if (res.data?.success) {
        const { token, user } = res.data.data;
        setUsuarioAuth(user);
        localStorage.setItem('anunciosya_token', token);
        localStorage.setItem('anunciosya_usuario', JSON.stringify(user));
        setModalAuth(false);

        const email = (user.email || user.correo || '').toLowerCase().trim();
        if (email === ADMIN_EMAIL.toLowerCase()) {
          localStorage.setItem('aadm_token', token);
          localStorage.setItem('aadm_user', JSON.stringify(user));
          mostrarToast(`🛡️ ¡Bienvenido Administrador! Abriendo tu panel de control...`);
          setTimeout(() => {
            navigate('/admin-anuncios');
          }, 600);
          return;
        }

        mostrarToast(`🎉 ¡Bienvenido/a con Google, ${user.nombre}!`);
      } else {
        mostrarToast('⚠️ ' + (res.data?.message || 'Error con Google'));
      }
    } catch (err) {
      console.error('Error Google Auth:', err);
      // Fallback amigable si hay problema de red
      const errorMsg = err.response?.data?.message || 'No se pudo verificar con Google. Revisa tu conexión.';
      mostrarToast('❌ ' + errorMsg);
    } finally {
      setCargandoAuth(false);
    }
  }

  function handleGoogleError() {
    mostrarToast('❌ Ocurrió un error al conectar con Google Accounts');
  }

  /* Iniciar sesión tradicional conectada al backend */
  async function handleLogin(e) {
    e.preventDefault();
    if (!formLogin.email || !formLogin.password) {
      mostrarToast('⚠️ Por favor completa tu correo y contraseña');
      return;
    }
    setCargandoAuth(true);
    try {
      const res = await api.post('/anuncios/auth/login', {
        email: formLogin.email,
        password: formLogin.password
      });
      if (res.data?.success) {
        const { token, user } = res.data.data;
        setUsuarioAuth(user);
        localStorage.setItem('anunciosya_token', token);
        localStorage.setItem('anunciosya_usuario', JSON.stringify(user));
        setModalAuth(false);

        const email = (user.email || user.correo || formLogin.email || '').toLowerCase().trim();
        if (email === ADMIN_EMAIL.toLowerCase()) {
          localStorage.setItem('aadm_token', token);
          localStorage.setItem('aadm_user', JSON.stringify(user));
          mostrarToast(`🛡️ ¡Bienvenido Administrador! Abriendo tu panel de control...`);
          setTimeout(() => {
            navigate('/admin-anuncios');
          }, 600);
          return;
        }

        mostrarToast(`👋 ¡Bienvenido de nuevo, ${user.nombre}!`);
      } else {
        mostrarToast('⚠️ ' + (res.data?.message || 'Credenciales inválidas'));
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Credenciales inválidas o error de conexión';
      mostrarToast('❌ ' + msg);
    } finally {
      setCargandoAuth(false);
    }
  }

  /* Registrarse conectado al backend con campos solicitados */
  async function handleRegistro(e) {
    e.preventDefault();
    if (!formRegistro.nombre.trim()) {
      mostrarToast('⚠️ Por favor ingresa tu nombre');
      return;
    }
    if (!formRegistro.telefono.trim()) {
      mostrarToast('⚠️ Por favor ingresa tu número de teléfono');
      return;
    }
    if (!formRegistro.email.trim() || !formRegistro.password.trim()) {
      mostrarToast('⚠️ Por favor ingresa tu correo y contraseña');
      return;
    }

    setCargandoAuth(true);
    try {
      const res = await api.post('/anuncios/auth/registro', {
        nombre: formRegistro.nombre.trim(),
        apellidos: formRegistro.apellidos.trim(),
        telefono: formRegistro.telefono.trim(),
        ubicacion: formRegistro.ubicacion || 'Cochabamba',
        direccion: formRegistro.direccion.trim(),
        email: formRegistro.email.trim(),
        password: formRegistro.password
      });

      if (res.data?.success) {
        const { token, user } = res.data.data;
        setUsuarioAuth(user);
        localStorage.setItem('anunciosya_token', token);
        localStorage.setItem('anunciosya_usuario', JSON.stringify(user));
        setModalAuth(false);

        const email = (user.email || user.correo || formRegistro.email || '').toLowerCase().trim();
        if (email === ADMIN_EMAIL.toLowerCase()) {
          localStorage.setItem('aadm_token', token);
          localStorage.setItem('aadm_user', JSON.stringify(user));
          navigate('/admin-anuncios');
          return;
        }

        mostrarToast(`🎉 ¡Cuenta creada con éxito en la base de datos! Bienvenido, ${user.nombre}.`);
      } else {
        mostrarToast('⚠️ ' + (res.data?.message || 'Error al registrarte'));
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Error al crear la cuenta en el servidor';
      mostrarToast('❌ ' + msg);
    } finally {
      setCargandoAuth(false);
    }
  }

  /* Actualizar perfil en la base de datos */
  async function handleGuardarPerfil(e) {
    e.preventDefault();
    if (!formPerfil.nombre.trim()) {
      mostrarToast('⚠️ El nombre es obligatorio');
      return;
    }
    setCargandoAuth(true);
    try {
      const token = localStorage.getItem('anunciosya_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await api.put('/anuncios/auth/perfil', {
        id: usuarioAuth?.id,
        nombre: formPerfil.nombre.trim(),
        apellidos: formPerfil.apellidos.trim(),
        telefono: formPerfil.telefono.trim(),
        ubicacion: formPerfil.ubicacion || 'Cochabamba',
        direccion: formPerfil.direccion.trim(),
        avatar_url: usuarioAuth?.avatar_url
      }, { headers });

      if (res.data?.success) {
        const userActualizado = res.data.data.user;
        setUsuarioAuth(userActualizado);
        localStorage.setItem('anunciosya_usuario', JSON.stringify(userActualizado));
        mostrarToast('✅ ¡Datos actualizados exitosamente en la base de datos!');
      } else {
        mostrarToast('⚠️ ' + (res.data?.message || 'Error al actualizar el perfil'));
      }
    } catch (err) {
      console.error('Error al actualizar perfil:', err);
      const msg = err.response?.data?.message || 'Error al conectar con la base de datos';
      mostrarToast('❌ ' + msg);
    } finally {
      setCargandoAuth(false);
    }
  }

  /* Cerrar sesión */
  function handleCerrarSesion() {
    setUsuarioAuth(null);
    setVistaPerfil(false);
    localStorage.removeItem('anunciosya_token');
    localStorage.removeItem('anunciosya_usuario');
    mostrarToast('🔒 Has cerrado sesión correctamente');
  }

  /* ── LÓGICA DEL WIZARD DE PUBLICACIÓN EN 3 PASOS ── */

  /* Abrir el modal de publicación */
  function abrirModalPublicar() {
    if (!usuarioAuth) {
      mostrarToast('🔒 Inicia sesión con tu cuenta de Google para publicar un anuncio');
      setModalAuth(true);
      return;
    }

    setDatosUserPub({
      nombre: usuarioAuth.nombre || usuarioAuth.nombre_completo || '',
      apellidos: usuarioAuth.apellidos || '',
      telefono: usuarioAuth.telefono || '',
      ubicacion: usuarioAuth.ubicacion || 'Cochabamba',
      direccion: usuarioAuth.direccion || '',
      email: usuarioAuth.correo || usuarioAuth.email || ''
    });
    setPasoPub(1);
    setPubDias(6);
    setPubColorActivo(false);
    setPubColorTitulo('#ea580c');
    setInputFotoUrl('');
    setDatosAdPub(prev => ({ ...prev, imagenes: [] }));
    setModalPub(true);
  }

  /* Comprimir imagen a resolución optimizada (máx 1200px) para carga ultrarrápida y ligera */
  function comprimirArchivoImagen(file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(e.target?.result);
        img.src = e.target?.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  /* Cargar fotos directamente desde el dispositivo (galería, explorador o cámara) */
  async function handleArchivosSeleccionados(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const cupo = 4 - datosAdPub.imagenes.length;
    if (cupo <= 0) {
      mostrarToast('⚠️ Ya has alcanzado el límite máximo de 4 fotos.');
      return;
    }

    const seleccionados = files.slice(0, cupo);
    setSubiendoFotos(true);
    mostrarToast(`⏳ Procesando ${seleccionados.length} foto(s)...`);

    for (const file of seleccionados) {
      if (file.size > 20 * 1024 * 1024) {
        mostrarToast(`⚠️ "${file.name}" supera los 20MB.`);
        continue;
      }

      let subidaExitosa = false;
      try {
        const formData = new FormData();
        formData.append('imagen', file);
        const res = await api.post('/upload/imagen', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.data?.success && res.data.imageUrl) {
          setDatosAdPub(prev => ({
            ...prev,
            imagenes: [...prev.imagenes, res.data.imageUrl]
          }));
          subidaExitosa = true;
        }
      } catch {
        subidaExitosa = false;
      }

      if (!subidaExitosa) {
        const base64Comprimido = await comprimirArchivoImagen(file);
        if (base64Comprimido) {
          setDatosAdPub(prev => ({
            ...prev,
            imagenes: [...prev.imagenes, base64Comprimido]
          }));
        }
      }
    }

    setSubiendoFotos(false);
    mostrarToast('✅ Fotos cargadas y optimizadas con éxito.');
    e.target.value = '';
  }

  /* Agregar foto por enlace URL (opcional secundario) */
  function agregarFotoUrl(url) {
    const urlLimpia = (url || inputFotoUrl).trim();
    if (!urlLimpia) return;
    if (datosAdPub.imagenes.length >= 4) {
      mostrarToast('⚠️ Puedes agregar un máximo de 4 imágenes por anuncio.');
      return;
    }
    setDatosAdPub(prev => ({
      ...prev,
      imagenes: [...prev.imagenes, urlLimpia]
    }));
    setInputFotoUrl('');
    mostrarToast(`📷 Foto ${datosAdPub.imagenes.length + 1} de 4 agregada.`);
  }

  /* Remover foto de la lista */
  function removerFoto(idx) {
    setDatosAdPub(prev => ({
      ...prev,
      imagenes: prev.imagenes.filter((_, i) => i !== idx)
    }));
  }

  /* Paso 1: Validar que los datos del usuario estén completos (Nombre, Apellidos, Teléfono, Ubicación) */
  async function validarYAvanzarPaso1(e) {
    if (e) e.preventDefault();

    if (!datosUserPub.nombre.trim()) {
      mostrarToast('⚠️ Por favor ingresa tu nombre de pila.');
      return;
    }
    if (!datosUserPub.apellidos.trim()) {
      mostrarToast('⚠️ Por favor ingresa tus apellidos (importante para tu perfil de vendedor).');
      return;
    }
    const telLimpio = datosUserPub.telefono.trim().replace(/\D/g, '');
    if (!telLimpio || telLimpio.length < 7) {
      mostrarToast('⚠️ El número de teléfono celular es obligatorio y debe tener al menos 7 dígitos.');
      return;
    }
    if (!datosUserPub.ubicacion) {
      mostrarToast('⚠️ Por favor selecciona tu departamento / ubicación.');
      return;
    }

    // Si el usuario no tiene cuenta aún, auto-registrarlo o enlazarlo para tener su id en MySQL
    if (!usuarioAuth) {
      try {
        const correoAuto = datosUserPub.email.trim() || `vendedor_${telLimpio}@anunciosya.bo`;
        const resReg = await api.post('/anuncios/auth/registro', {
          nombre: datosUserPub.nombre.trim(),
          apellidos: datosUserPub.apellidos.trim(),
          telefono: telLimpio,
          ubicacion: datosUserPub.ubicacion,
          direccion: datosUserPub.direccion.trim(),
          email: correoAuto,
          password: `pass_${telLimpio}`
        });
        if (resReg.data?.success) {
          const { token, user } = resReg.data.data;
          setUsuarioAuth(user);
          localStorage.setItem('anunciosya_token', token);
          localStorage.setItem('anunciosya_usuario', JSON.stringify(user));
        }
      } catch (err) {
        console.warn('Auto-registro previo:', err?.response?.data?.message || err.message);
      }
    }

    mostrarToast('✅ Datos del vendedor validados correctamente.');
    setPasoPub(2);
  }

  /* Paso 2: Validar detalles del anuncio (Título, Categoría, Precio, Descripción, Dirección) */
  function validarYAvanzarPaso2(e) {
    if (e) e.preventDefault();

    if (!datosAdPub.titulo.trim()) {
      mostrarToast('⚠️ Por favor ingresa el título del anuncio.');
      return;
    }
    if (!datosAdPub.categoria) {
      mostrarToast('⚠️ Por favor selecciona una categoría para tu anuncio.');
      return;
    }
    if (!datosAdPub.precio.trim()) {
      mostrarToast('⚠️ Por favor ingresa el precio en Bolivianos (Bs).');
      return;
    }
    if (!datosAdPub.desc.trim()) {
      mostrarToast('⚠️ Por favor ingresa una descripción detallada de tu anuncio.');
      return;
    }
    if (!datosAdPub.direccion.trim()) {
      mostrarToast('⚠️ Por favor indica la dirección de tu local o zona de mercado.');
      return;
    }

    setPasoPub(3);
  }

  /* Validar cupón de descuento o publicación gratis */
  async function handleValidarCupon() {
    if (!codigoCuponInput.trim()) {
      mostrarToast('⚠️ Por favor ingresa el código del cupón (ej. VPPP)');
      return;
    }
    setValidandoCupon(true);
    try {
      const res = await api.post('/anuncios/cupones/validar', {
        codigo: codigoCuponInput.trim(),
        id_usuario: usuarioAuth?.id,
        correo: usuarioAuth?.correo || usuarioAuth?.email
      });
      if (res.data?.success && res.data?.data) {
        setCuponAplicado(res.data.data);
        mostrarToast(res.data.message || '🎉 ¡Cupón aplicado con éxito!');
      } else {
        mostrarToast('⚠️ ' + (res.data?.message || 'Cupón inválido'));
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Cupón inválido o agotado';
      mostrarToast('❌ ' + msg);
    } finally {
      setValidandoCupon(false);
    }
  }

  /* Quitar cupón */
  function handleQuitarCupon() {
    setCuponAplicado(null);
    setCodigoCuponInput('');
    mostrarToast('Cupón removido.');
  }

  /* Paso 3: Confirmación de pago QR rápido o registro con cupón gratis */
  async function handleConfirmarPagoYPublicar() {
    setProcesandoPago(true);

    try {
      // 1. Simulación visual rápida de procesamiento (1.2 segundos para feedback)
      await new Promise(r => setTimeout(r, 1200));

      let idUsuario = usuarioAuth?.id;

      // Si aún no hay ID de usuario, asegurarlo registrándolo
      if (!idUsuario) {
        const telLimpio = datosUserPub.telefono.trim().replace(/\D/g, '') || '77412345';
        const correoAuto = datosUserPub.email.trim() || `vendedor_${telLimpio}@anunciosya.bo`;
        const resReg = await api.post('/anuncios/auth/registro', {
          nombre: datosUserPub.nombre.trim() || 'Vendedor',
          apellidos: datosUserPub.apellidos.trim() || 'Bolivia',
          telefono: telLimpio,
          ubicacion: datosUserPub.ubicacion || 'Cochabamba',
          direccion: datosUserPub.direccion.trim() || '',
          email: correoAuto,
          password: `pass_${telLimpio}`
        });
        if (resReg.data?.success) {
          const { token, user } = resReg.data.data;
          idUsuario = user.id;
          setUsuarioAuth(user);
          localStorage.setItem('anunciosya_token', token);
          localStorage.setItem('anunciosya_usuario', JSON.stringify(user));
        }
      }

      const token = localStorage.getItem('anunciosya_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Limpiar imágenes (hasta 4 opcionales, puede ser vacío)
      const imagenesLimpias = Array.isArray(datosAdPub.imagenes)
        ? datosAdPub.imagenes.filter(u => u && u.trim().length > 0).slice(0, 4)
        : [];
      const imagenPrincipal = imagenesLimpias.length > 0 ? imagenesLimpias[0] : null;

      // 2. Guardar el anuncio en la base de datos con todos los cálculos y cupón
      const res = await api.post('/anuncios', {
        titulo: datosAdPub.titulo.trim(),
        precio: datosAdPub.precio.trim(),
        categoria: datosAdPub.categoria,
        ciudad: datosAdPub.ciudad || datosUserPub.ubicacion,
        descripcion: datosAdPub.desc.trim(),
        direccion: datosAdPub.direccion.trim(),
        imagen_principal: imagenPrincipal,
        imagenes: imagenesLimpias, // hasta 4 imágenes opcionales
        telefono_contacto: datosUserPub.telefono.trim(),
        dias_duracion: pubDias,
        color_titulo: pubColorActivo ? pubColorTitulo : null,
        costo_total: costoTotalCalculado,
        id_usuario: idUsuario,
        nombre_vendedor: datosUserPub.nombre.trim(),
        apellidos_vendedor: datosUserPub.apellidos.trim(),
        codigo_cupon: cuponAplicado?.codigo || null
      }, { headers });

      if (res.data?.success) {
        const nuevoAnuncio = res.data.data;
        const msgSuccess = esPublicacionGratis
          ? `🎉 ¡Publicación registrada con cupón [${cuponAplicado.codigo}] con éxito! Tu anuncio ha sido creado.`
          : `🎉 ¡Pago de Bs ${costoTotalCalculado} acreditado con éxito! Tu anuncio ha sido creado.`;
        mostrarToast(msgSuccess);
        setModalPub(false);
        await cargarAnuncios();
        irAAnuncio(nuevoAnuncio);
        // Resetear campos del anuncio y cupón
        setDatosAdPub({
          titulo: '',
          categoria: '',
          ciudad: 'Cochabamba',
          precio: '',
          desc: '',
          direccion: '',
          imagenes: []
        });
        setInputFotoUrl('');
        setPubDias(6);
        setPubColorActivo(false);
        setCuponAplicado(null);
        setCodigoCuponInput('');
      } else {
        mostrarToast('⚠️ ' + (res.data?.message || 'Error al crear el anuncio'));
      }

    } catch (err) {
      console.error('Error al publicar anuncio:', err);
      const msg = err.response?.data?.message || 'Error al procesar el pago o publicar';
      mostrarToast('❌ ' + msg);
    } finally {
      setProcesandoPago(false);
    }
  }

  /* Confirmar y proceder a WhatsApp tras aceptar advertencias de seguridad */
  function confirmarIrAWhatsApp() {
    setModalSeguridadWsp(false);
    const tel = anuncioActivo?.telefono || '77412345';
    const msg = `Hola que tal, vi su anuncio de "${anuncioActivo?.titulo}" en AnunciosYA y me gustaría más información.`;
    const url = `https://api.whatsapp.com/send?phone=591${tel}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  /* Enviar denuncia de publicación al backend */
  async function handleEnviarDenuncia(e) {
    if (e) e.preventDefault();
    if (!anuncioActivo) return;
    setEnviandoDenuncia(true);
    try {
      await api.post(`/anuncios/${anuncioActivo.id}/denunciar`, {
        motivo: motivoDenuncia,
        comentario: comentarioDenuncia.trim()
      });
      setModalDenuncia(false);
      setComentarioDenuncia('');
      mostrarToast('🛡️ Gracias por tu reporte. Nuestro equipo de moderación revisará la publicación.');
    } catch (err) {
      mostrarToast('❌ Error al enviar la denuncia. Inténtalo de nuevo.');
    } finally {
      setEnviandoDenuncia(false);
    }
  }

  return (
    <div className="aya-page">

      {/* ══ HEADER ══════════════════════════════════════ */}
      <header className="aya-header">
        <div className="aya-header-top">
          {/* Logo clickeable que vuelve al catálogo principal */}
          <div
            className="aya-logo"
            onClick={volverAInicio}
            style={{ cursor: 'pointer' }}
            title="Ir al inicio de AnunciosYA"
          >
            <div className="aya-logo-icon">📢</div>
            <div className="aya-logo-text">
              <strong>AnunciosYA</strong>
              <span>Compra · Vende · Encuentra</span>
            </div>
          </div>

          {/* Buscador central */}
          <div className="aya-header-search">
            <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--ya-muted)', fontSize: '0.95rem' }}></i>
            <input
              id="aya-header-search-input"
              type="text"
              placeholder="¿Qué estás buscando en Bolivia?"
              value={busInput}
              onChange={e => setBusInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setBusHero(busInput);
                  if (anuncioActivo) setAnuncioActivo(null);
                }
              }}
            />
            <button
              className="aya-header-search-btn"
              id="aya-header-search-btn"
              onClick={() => {
                setBusHero(busInput);
                if (anuncioActivo) setAnuncioActivo(null);
              }}
            ><i className="fa-solid fa-magnifying-glass"></i></button>
          </div>

          {/* Nav derecha con Login Google / Perfil */}
          <nav className="aya-header-nav">
            {!usuarioAuth ? (
              <button
                className="aya-btn-registrar"
                id="aya-nav-login"
                onClick={() => setModalAuth(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  color: 'var(--ya-text)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                }}
              >
                <i className="fa-brands fa-google" style={{ color: '#ea4335', fontSize: '1rem' }}></i>
                <span>Iniciar sesión con Google</span>
              </button>
            ) : (
              <div
                className="aya-user-profile"
                id="aya-header-perfil-chip"
                onClick={abrirPerfil}
                style={{ cursor: 'pointer' }}
                title="Haz clic para ver y editar tu perfil"
              >
                <div className="aya-user-avatar">
                  {usuarioAuth.avatar_url || usuarioAuth.foto ? (
                    <img src={usuarioAuth.avatar_url || usuarioAuth.foto} alt={usuarioAuth.nombre} />
                  ) : (
                    usuarioAuth.nombre?.[0]?.toUpperCase() || 'U'
                  )}
                </div>
                <div className="aya-user-info">
                  <span className="aya-user-name">{usuarioAuth.nombre}</span>
                  <span className="aya-user-city">
                    <i className="fa-solid fa-location-dot" style={{ marginRight: '4px', color: 'var(--ya-primary)' }}></i>
                    {usuarioAuth.ubicacion || 'Bolivia'} · Mi Perfil
                  </span>
                </div>
                <button
                  className="aya-btn-logout"
                  id="aya-btn-logout"
                  onClick={(e) => { e.stopPropagation(); handleCerrarSesion(); }}
                  title="Cerrar sesión"
                >
                  <i className="fa-solid fa-right-from-bracket"></i>
                </button>
              </div>
            )}

            {usuarioAuth && (usuarioAuth.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase() || usuarioAuth.correo?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase()) && (
              <button
                className="aya-btn-admin-panel"
                id="aya-btn-admin-panel"
                style={{
                  background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                  border: '1px solid #38bdf8',
                  color: '#38bdf8',
                  borderRadius: '10px',
                  padding: '7px 14px',
                  fontWeight: '700',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 10px rgba(56,189,248,0.25)',
                  transition: 'all 0.2s'
                }}
                onClick={() => navigate('/admin-anuncios')}
                title="Ir a tu Panel de Administrador de AnunciosYA"
              >
                <i className="fa-solid fa-shield-halved"></i> Panel Admin
              </button>
            )}

            <button
              className="aya-btn-publicar-nav"
              id="aya-btn-publicar-nav"
              onClick={abrirModalPublicar}
            >
              <i className="fa-solid fa-plus"></i> <span>Publicar anuncio</span>
            </button>
          </nav>
        </div>

        {/* Barra de categorías horizontal */}
        <div className="aya-header-cats">
          <div className="aya-header-cats-inner">
            {CATEGORIAS.map(c => (
              <button
                key={c.id}
                className={`aya-hcat-btn${catActiva === c.id ? ' active' : ''}`}
                id={`aya-hcat-${c.id}`}
                onClick={() => {
                  setCatActiva(c.id);
                  if (anuncioActivo) setAnuncioActivo(null);
                  if (vistaPerfil) setVistaPerfil(false);
                }}
              >
                <i className={c.icon}></i>
                <span>{c.nombre}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════
         CONTENIDO PRINCIPAL: PERFIL, DETALLE O CATÁLOGO
      ══════════════════════════════════════════════════ */}
      {vistaPerfil ? (
        /* ── VISTA DE PÁGINA COMPLETA DE PERFIL DE USUARIO (EDITAR DATOS) ── */
        <main className="aya-perfil-page" id="aya-perfil-view">
          <div className="aya-perfil-topbar">
            <button
              className="aya-btn-volver"
              id="aya-btn-perfil-volver"
              onClick={volverAInicio}
            >
              ← Volver a todos los anuncios
            </button>

            <nav className="aya-breadcrumbs">
              <span className="aya-breadcrumb-link" onClick={volverAInicio}>Inicio</span>
              <span>/</span>
              <span className="aya-breadcrumb-curr">Mi Perfil y Datos Personales</span>
            </nav>
          </div>

          <div className="aya-perfil-layout">
            {/* Sidebar con resumen del usuario */}
            <aside className="aya-perfil-card-sidebar">
              <div className="aya-perfil-avatar-big">
                {usuarioAuth?.avatar_url || usuarioAuth?.foto ? (
                  <img src={usuarioAuth.avatar_url || usuarioAuth.foto} alt={usuarioAuth.nombre} />
                ) : (
                  usuarioAuth?.nombre?.[0]?.toUpperCase() || 'U'
                )}
              </div>
              <h3 className="aya-perfil-user-name">
                {usuarioAuth?.nombre} {usuarioAuth?.apellidos || ''}
              </h3>
              <p className="aya-perfil-user-email">✉️ {usuarioAuth?.correo || usuarioAuth?.email}</p>

              <div className="aya-perfil-auth-badge">
                <span>{usuarioAuth?.auth_provider === 'google' ? '🌐 Conectado con Google' : '🔐 Cuenta Local'}</span>
              </div>

              <div className="aya-perfil-stats-box">
                <div className="aya-perfil-stat-item">
                  <strong>{destacados.filter(d => d.vendedor === usuarioAuth?.nombre).length}</strong>
                  <span>Mis Anuncios</span>
                </div>
                <div className="aya-perfil-stat-item">
                  <strong>{usuarioAuth?.ubicacion || 'Bolivia'}</strong>
                  <span>Ubicación</span>
                </div>
              </div>

              {/* ── Módulo Tienda en Perfil (Sidebar) ── */}
              <div className="aya-perfil-tienda-sidecard">
                {miTienda ? (
                  <>
                    <div className="aya-perfil-tienda-side-badge">
                      <i className="fa-solid fa-store" /> Mi Tienda
                    </div>
                    <div className="aya-perfil-tienda-side-nombre">{miTienda.nombre_tienda}</div>
                    <div className="aya-perfil-tienda-side-info">
                      <span><i className="fa-solid fa-box-open" /> {(miTienda.productos || []).length} productos</span>
                      <span><i className="fa-solid fa-eye" /> {miTienda.visitas || 0} visitas</span>
                    </div>
                    <button
                      type="button"
                      className="aya-btn-perfil-tienda-primary"
                      onClick={irAGestionMiTienda}
                    >
                      <i className="fa-solid fa-boxes-stacked" /> Gestionar Productos
                    </button>
                    <button
                      type="button"
                      className="aya-btn-perfil-tienda-sec"
                      onClick={irAVerMiTienda}
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square" /> Ver Mi Tienda
                    </button>
                  </>
                ) : (
                  <div className="aya-perfil-tienda-callout">
                    <div className="aya-perfil-tienda-callout-icon">
                      <i className="fa-solid fa-store" />
                    </div>
                    <div className="aya-perfil-tienda-callout-text">
                      <strong>¿Tienes un Negocio?</strong>
                      <p>Crea tu catálogo de productos y vende por WhatsApp.</p>
                    </div>
                    <button
                      type="button"
                      className="aya-btn-perfil-crear-tienda"
                      onClick={abrirCrearTiendaDesdePerfil}
                    >
                      <i className="fa-solid fa-plus-circle" /> Crear Mi Tienda
                    </button>
                  </div>
                )}
              </div>

              <button
                className="aya-btn-logout-big"
                id="aya-perfil-btn-logout"
                onClick={handleCerrarSesion}
              >
                <span>🚪</span> Cerrar sesión
              </button>
            </aside>

            {/* Formulario de edición de datos personales */}
            <div className="aya-perfil-card-main">
              {/* Banner Tienda en Perfil */}
              {miTienda ? (
                <div className="aya-perfil-tienda-banner aya-perfil-banner-has-store">
                  <div className="aya-perfil-tienda-banner-logo">
                    {miTienda.logo_url ? (
                      <img src={miTienda.logo_url} alt={miTienda.nombre_tienda} />
                    ) : (
                      <div className="aya-perfil-tienda-logo-ph"><i className="fa-solid fa-store" /></div>
                    )}
                  </div>
                  <div className="aya-perfil-tienda-banner-body">
                    <div className="aya-perfil-tienda-pill">
                      <i className="fa-solid fa-circle-check" /> Tu Tienda está Activa
                    </div>
                    <h3>{miTienda.nombre_tienda}</h3>
                    <p>Ubicación: <strong>{miTienda.ubicacion || 'Bolivia'}</strong> · Catálogo: <strong>{(miTienda.productos || []).length} productos</strong> · <strong>{miTienda.visitas || 0} visitas</strong></p>
                  </div>
                  <div className="aya-perfil-tienda-banner-actions">
                    <button
                      type="button"
                      className="aya-btn-banner-gestionar"
                      onClick={irAGestionMiTienda}
                    >
                      <i className="fa-solid fa-boxes-stacked" /> Gestionar Productos
                    </button>
                    <button
                      type="button"
                      className="aya-btn-banner-ver"
                      onClick={irAVerMiTienda}
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square" /> Ver Tienda
                    </button>
                  </div>
                </div>
              ) : (
                <div className="aya-perfil-tienda-banner aya-perfil-banner-create">
                  <div className="aya-perfil-banner-icon-circ">
                    <i className="fa-solid fa-store" />
                  </div>
                  <div className="aya-perfil-tienda-banner-body">
                    <div className="aya-perfil-tienda-pill aya-pill-accent">
                      <i className="fa-solid fa-sparkles" /> Nuevo en AnunciosYA
                    </div>
                    <h3>¿Tienes una Tienda o Negocio?</h3>
                    <p>Crea tu tienda virtual gratis con catálogo de productos, fotos, precios y pedidos directos por WhatsApp.</p>
                  </div>
                  <button
                    type="button"
                    className="aya-btn-banner-crear"
                    onClick={abrirCrearTiendaDesdePerfil}
                  >
                    <i className="fa-solid fa-plus-circle" /> Crear Mi Tienda
                  </button>
                </div>
              )}

              <div className="aya-perfil-main-head">
                <h2>✏️ Editar mis datos personales</h2>
                <p>
                  Actualiza tu nombre, apellidos, teléfono celular, ubicación o dirección. Los cambios se guardarán directamente en la base de datos de AnunciosYA.
                </p>
              </div>

              <form onSubmit={handleGuardarPerfil}>
                <div className="aya-form-row">
                  <div className="aya-form-group">
                    <label>Nombre de pila *</label>
                    <input
                      id="aya-perfil-input-nombre"
                      type="text"
                      placeholder="Ej: Carlos"
                      value={formPerfil.nombre}
                      onChange={e => setFormPerfil(f => ({ ...f, nombre: e.target.value }))}
                      required
                    />
                    <span style={{ fontSize: '.74rem', color: 'var(--ya-muted)', marginTop: '2px', display: 'block' }}>
                      Este es el único nombre que verán los compradores en tus anuncios.
                    </span>
                  </div>

                  <div className="aya-form-group">
                    <label>Apellidos (opcional)</label>
                    <input
                      id="aya-perfil-input-apellidos"
                      type="text"
                      placeholder="Ej: Vargas Mamani"
                      value={formPerfil.apellidos}
                      onChange={e => setFormPerfil(f => ({ ...f, apellidos: e.target.value }))}
                    />
                    <span style={{ fontSize: '.74rem', color: 'var(--ya-muted)', marginTop: '2px', display: 'block' }}>
                      Información privada para tu perfil y cuenta.
                    </span>
                  </div>
                </div>

                <div className="aya-form-row">
                  <div className="aya-form-group">
                    <label>Teléfono celular de contacto *</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span style={{
                        background: '#f3f4f6',
                        border: '1.5px solid var(--ya-border)',
                        borderRadius: '10px',
                        padding: '12px 10px',
                        fontSize: '.88rem',
                        fontWeight: 700,
                        color: 'var(--ya-text2)',
                        display: 'flex',
                        alignItems: 'center'
                      }}>🇧🇴 +591</span>
                      <input
                        id="aya-perfil-input-telefono"
                        type="tel"
                        placeholder="77412345"
                        value={formPerfil.telefono}
                        onChange={e => setFormPerfil(f => ({ ...f, telefono: e.target.value }))}
                        required
                        style={{ flex: 1 }}
                      />
                    </div>
                    <span style={{ fontSize: '.74rem', color: 'var(--ya-muted)', marginTop: '2px', display: 'block' }}>
                      Número donde recibirás consultas por WhatsApp y llamadas.
                    </span>
                  </div>

                  <div className="aya-form-group">
                    <label>Ubicación (Departamento) *</label>
                    <select
                      id="aya-perfil-select-ubicacion"
                      value={formPerfil.ubicacion}
                      onChange={e => setFormPerfil(f => ({ ...f, ubicacion: e.target.value }))}
                      required
                    >
                      {DEPARTAMENTOS_BOLIVIA.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="aya-form-group">
                  <label>Dirección de local o Zona de mercado (opcional)</label>
                  <input
                    id="aya-perfil-input-direccion"
                    type="text"
                    placeholder="Ej: Zona Cala Cala, Av. América #240"
                    value={formPerfil.direccion}
                    onChange={e => setFormPerfil(f => ({ ...f, direccion: e.target.value }))}
                  />
                </div>

                <div className="aya-form-group">
                  <label>Correo electrónico vinculado</label>
                  <input
                    id="aya-perfil-input-correo"
                    type="email"
                    value={formPerfil.email}
                    disabled
                    style={{ background: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }}
                  />
                  <span style={{ fontSize: '.74rem', color: 'var(--ya-muted)', marginTop: '2px', display: 'block' }}>
                    Vinculado a tu cuenta de autenticación ({usuarioAuth?.auth_provider === 'google' ? 'Google OAuth' : 'Registro de usuario'}).
                  </span>
                </div>

                <div className="aya-perfil-form-actions">
                  <button
                    type="button"
                    className="aya-btn-cancel"
                    onClick={volverAInicio}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="aya-btn-guardar-perfil"
                    id="aya-btn-guardar-perfil"
                    disabled={cargandoAuth}
                  >
                    {cargandoAuth ? '⏳ Guardando cambios...' : '💾 Guardar cambios en la base de datos'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      ) : anuncioActivo ? (
        /* ── VISTA DE PÁGINA COMPLETA DEL ANUNCIO (CARGA DIRECTA, SIN VENTANA EMERGENTE) ── */
        <main className="aya-detalle-page" id="aya-detalle-view">
          {/* Barra superior de navegación */}
          <div className="aya-detalle-topbar">
            <button
              className="aya-btn-volver"
              id="aya-btn-volver-atras"
              onClick={volverAInicio}
            >
              ← Volver a todos los anuncios
            </button>

            <nav className="aya-breadcrumbs">
              <span className="aya-breadcrumb-link" onClick={volverAInicio}>Inicio</span>
              <span>/</span>
              <span
                className="aya-breadcrumb-link"
                onClick={() => {
                  setCatActiva(anuncioActivo.categoria);
                  volverAInicio();
                }}
              >
                {CATS_MAP[anuncioActivo.categoria] || anuncioActivo.categoria}
              </span>
              <span>/</span>
              <span className="aya-breadcrumb-curr">{anuncioActivo.titulo}</span>
            </nav>
          </div>

          {/* Grid de 2 columnas: Contenido a la izquierda, Vendedor y Contacto a la derecha */}
          <div className="aya-detalle-layout">

            {/* Columna Izquierda: Imagen grande, título, descripción, detalles */}
            <div className="aya-detalle-main">
              {(() => {
                const fotosLista = (anuncioActivo.imagenes && anuncioActivo.imagenes.length > 0)
                  ? anuncioActivo.imagenes
                  : (anuncioActivo.img ? [anuncioActivo.img] : []);
                const fotoActual = fotosLista[fotoActivaIndex] || fotosLista[0];

                if (fotosLista.length > 0 && fotoActual) {
                  return (
                    <div>
                      <div className="aya-detalle-img-wrap">
                        <div className="aya-detalle-badges">
                          <span className="aya-detail-cat-tag">
                            {CATS_MAP[anuncioActivo.categoria] || anuncioActivo.categoria}
                          </span>
                          {anuncioActivo.destacado && <span className="aya-card-badge dest">⭐ Destacado</span>}
                          {anuncioActivo.nuevo && <span className="aya-card-badge nuevo">✨ Nuevo</span>}
                        </div>

                        <button
                          className={`aya-detalle-fav-btn${anuncioActivo.fav ? ' faved' : ''}`}
                          onClick={() => toggleFavD(anuncioActivo.id)}
                          title="Guardar en favoritos"
                        >
                          {anuncioActivo.fav ? '❤️' : '🤍'}
                        </button>

                        <img
                          className="aya-detalle-img"
                          src={fotoActual}
                          alt={anuncioActivo.titulo}
                          onError={e => {
                            e.target.src = 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=900&q=80';
                          }}
                        />
                      </div>

                      {/* Tira interactiva de miniaturas si tiene más de 1 imagen */}
                      {fotosLista.length > 1 && (
                        <div className="aya-gallery-thumbnails">
                          {fotosLista.map((foto, idx) => (
                            <img
                              key={idx}
                              src={foto}
                              alt={`Foto ${idx + 1}`}
                              className={`aya-gallery-thumb${fotoActivaIndex === idx ? ' active' : ''}`}
                              onClick={() => setFotoActivaIndex(idx)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                {/* Si el anuncio NO tiene imágenes: NO mostrar espacio vacío, mostrar banner superior limpio */}
                return (
                  <div className={`aya-detalle-no-img-banner${anuncioActivo.destacado ? ' is-destacado' : ''}`}>
                    <div className="aya-detalle-no-img-badges">
                      <span className="aya-detail-cat-tag">
                        {CATS_MAP[anuncioActivo.categoria] || anuncioActivo.categoria}
                      </span>
                      {anuncioActivo.destacado && <span className="aya-card-badge dest">⭐ Destacado</span>}
                      {anuncioActivo.nuevo && <span className="aya-card-badge nuevo">✨ Nuevo</span>}
                    </div>
                    <button
                      className={`aya-detalle-fav-btn inline${anuncioActivo.fav ? ' faved' : ''}`}
                      onClick={() => toggleFavD(anuncioActivo.id)}
                      title="Guardar en favoritos"
                    >
                      {anuncioActivo.fav ? '❤️ Guardado' : '🤍 Guardar'}
                    </button>
                  </div>
                );
              })()}

              <div className="aya-detalle-header">
                <h1
                  className="aya-detalle-title"
                  style={anuncioActivo.color_titulo ? { color: anuncioActivo.color_titulo, fontWeight: 900 } : {}}
                >
                  {anuncioActivo.titulo}
                </h1>
                <div className="aya-detalle-meta-row">
                  <div className="aya-detalle-meta-item">
                    <span>📍</span>
                    <span>{anuncioActivo.ciudad}, Bolivia</span>
                  </div>
                  <div className="aya-detalle-meta-item">
                    <span>🕒</span>
                    <span>{anuncioActivo.tiempo}</span>
                  </div>
                  <div className="aya-detalle-meta-item">
                    <span>🏷️</span>
                    <span>ID: #AY-{anuncioActivo.id}</span>
                  </div>
                  {anuncioActivo.dias_duracion && (
                    <div className="aya-detalle-meta-item">
                      <span>⏳</span>
                      <span>{anuncioActivo.dias_duracion} días de vigencia</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Descripción */}
              <h3 className="aya-detalle-section-title">
                <span>📝</span> Descripción del anuncio
              </h3>
              <p className="aya-detalle-desc">
                {anuncioActivo.desc || 'El anunciante no ha especificado una descripción extendida para este artículo.'}
              </p>

              {/* Ficha de especificaciones */}
              <h3 className="aya-detalle-section-title">
                <span>⚙️</span> Ficha de detalles
              </h3>
              <div className="aya-detalle-specs">
                <div className="aya-spec-item">
                  <span className="aya-spec-label">Categoría</span>
                  <span className="aya-spec-val">{CATS_MAP[anuncioActivo.categoria] || anuncioActivo.categoria}</span>
                </div>
                <div className="aya-spec-item">
                  <span className="aya-spec-label">Ubicación</span>
                  <span className="aya-spec-val">{anuncioActivo.ciudad}</span>
                </div>
                {anuncioActivo.direccion && (
                  <div className="aya-spec-item">
                    <span className="aya-spec-label">Dirección / Zona</span>
                    <span className="aya-spec-val">📍 {anuncioActivo.direccion}</span>
                  </div>
                )}
                {anuncioActivo.dias_duracion && (
                  <div className="aya-spec-item">
                    <span className="aya-spec-label">Vigencia</span>
                    <span className="aya-spec-val">⏳ {anuncioActivo.dias_duracion} días</span>
                  </div>
                )}
                <div className="aya-spec-item">
                  <span className="aya-spec-label">Moneda</span>
                  <span className="aya-spec-val">Bolivianos (Bs.)</span>
                </div>
                <div className="aya-spec-item">
                  <span className="aya-spec-label">Estado de publicación</span>
                  <span className="aya-spec-val">Activo y disponible</span>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Tarjeta de Precio, Anunciante (SOLO NOMBRE) y Contacto */}
            <aside className="aya-detalle-sidebar">
              {/* Tarjeta de Precio */}
              <div className="aya-price-card">
                <div className="aya-price-label">Precio publicado</div>
                <div className="aya-price-amount">{anuncioActivo.precio}</div>
                <div className="aya-price-sub">
                  <span>✓</span> Precio negociable / Trato directo
                </div>
                <div className="aya-actions-group">
                  <button
                    type="button"
                    className="aya-btn-whatsapp"
                    id="aya-btn-whatsapp"
                    onClick={() => setModalSeguridadWsp(true)}
                  >
                    <span>💬</span>
                    <span>Contactar por WhatsApp</span>
                  </button>

                  <button
                    className="aya-btn-llamar"
                    id="aya-btn-llamar"
                    onClick={() => {
                      navigator.clipboard?.writeText(anuncioActivo.telefono || '77412345');
                      mostrarToast(`📞 Teléfono copiado: +591 ${anuncioActivo.telefono || '77412345'}`);
                    }}
                  >
                    <span>📞</span>
                    <span>Llamar: {anuncioActivo.telefono || '77412345'}</span>
                  </button>
                </div>
              </div>

              {/* Tarjeta del anunciante: SOLO NOMBRE (requisito estricto) */}
              <div className="aya-seller-card">
                <div className="aya-seller-head">
                  <div className="aya-seller-avatar">
                    {anuncioActivo.vendedor?.[0]?.toUpperCase() || 'A'}
                  </div>
                  <div className="aya-seller-info">
                    <span className="aya-seller-role">Anunciante</span>
                    {/* Exclusivamente el nombre de pila, sin apellidos ni datos personales */}
                    <strong className="aya-seller-name">{anuncioActivo.vendedor}</strong>
                    <span className="aya-seller-badge">
                      <span>🛡️</span> Cuenta verificada
                    </span>
                  </div>
                </div>

                <div className="aya-seller-features">
                  <div className="aya-seller-feature-item">
                    <span>📍</span> <span>{anuncioActivo.ciudad}, Bolivia</span>
                  </div>
                  <div className="aya-seller-feature-item">
                    <span>⚡</span> <span>Responde en menos de 1 hora</span>
                  </div>
                  <div className="aya-seller-feature-item">
                    <span>📅</span> <span>Miembro activo en AnunciosYA</span>
                  </div>
                </div>
              </div>

              {/* Consejos de seguridad para compras en Bolivia */}
              <div className="aya-safety-card">
                <div className="aya-safety-title">
                  <span>🛡️</span> Compra con seguridad en Bolivia
                </div>
                <ul className="aya-safety-list">
                  <li>Acuerda encontrarte en un lugar público y concurrido.</li>
                  <li>Revisa bien el producto antes de entregar el dinero.</li>
                  <li>Nunca envíes adelantos ni giros sin haber visto el producto.</li>
                </ul>
              </div>

              {/* Botón de Denunciar Anuncio */}
              <button
                type="button"
                className="aya-btn-denunciar"
                id="aya-btn-denunciar"
                onClick={() => setModalDenuncia(true)}
              >
                <span>🚩</span>
                <span>Denunciar o reportar este anuncio</span>
              </button>
            </aside>
          </div>

          {/* Sección de otros anuncios similares para seguir explorando */}
          <section className="aya-similares-section">
            <div className="aya-section-header">
              <h2 className="aya-section-title">Otros anuncios que te pueden interesar</h2>
              <button
                className="aya-section-link"
                onClick={volverAInicio}
              >
                Ver todo el catálogo →
              </button>
            </div>
            <div className="aya-cards-grid">
              {destacados
                .filter(a => a.id !== anuncioActivo.id)
                .slice(0, 4)
                .map(a => (
                  <div
                    key={a.id}
                    className={`aya-card${!a.img ? ' aya-card-no-img' : ''}${a.destacado ? ' is-destacado' : ''}`}
                    id={`aya-similar-card-${a.id}`}
                    onClick={() => irAAnuncio(a)}
                  >
                    {a.img ? (
                      <>
                        <div className="aya-card-badges-wrapper">
                          {a.destacado && <span className="aya-card-badge dest">⭐ Destacado</span>}
                          {a.nuevo && <span className="aya-card-badge nuevo">✨ Nuevo</span>}
                        </div>
                        <button
                          className={`aya-card-fav-btn${a.fav ? ' faved' : ''}`}
                          onClick={e => toggleFavD(a.id, e)}
                          title="Guardar en favoritos"
                        >
                          {a.fav ? '❤️' : '🤍'}
                        </button>
                        <img className="aya-card-img" src={a.img} alt={a.titulo} loading="lazy" />
                      </>
                    ) : (
                      <div className="aya-card-no-img-top">
                        <div className="aya-card-badges-wrapper">
                          <span className="aya-card-cat-badge">{CATS_MAP[a.categoria] || a.categoria}</span>
                          {a.destacado && <span className="aya-card-badge dest">⭐ Destacado</span>}
                          {a.nuevo && <span className="aya-card-badge nuevo">✨ Nuevo</span>}
                        </div>
                        <button
                          className={`aya-card-fav-btn${a.fav ? ' faved' : ''}`}
                          onClick={e => toggleFavD(a.id, e)}
                          title="Guardar en favoritos"
                        >
                          {a.fav ? '❤️' : '🤍'}
                        </button>
                      </div>
                    )}
                    <div className="aya-card-body">
                      <h3 className="aya-card-title">{a.titulo}</h3>
                      <div className="aya-card-price">{a.precio}</div>
                      <div className="aya-card-meta">📍 {a.ciudad} · 🕐 {a.tiempo}</div>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </main>
      ) : (
        /* ── CATÁLOGO PRINCIPAL (PÁGINA DE INICIO) ── */
        <>
          {catActiva === 'tiendas' ? (
            /* ══════════════════════════════════════════════════
               MÓDULO DE TIENDAS
            ══════════════════════════════════════════════════ */
            tiendaActiva ? (
              /* ── DETALLE DE TIENDA ── */
              <main className="aya-tienda-detalle-page">
                <div className="aya-tienda-detalle-topbar">
                  <button className="aya-btn-volver" onClick={() => setTiendaActiva(null)}>
                    ← Volver a Tiendas
                  </button>
                  <nav className="aya-breadcrumbs">
                    <span className="aya-breadcrumb-link" onClick={() => { setCatActiva('todas'); setTiendaActiva(null); }}>Inicio</span>
                    <span>/</span>
                    <span className="aya-breadcrumb-link" onClick={() => setTiendaActiva(null)}>Tiendas</span>
                    <span>/</span>
                    <span className="aya-breadcrumb-curr">{tiendaActiva.nombre_tienda}</span>
                  </nav>
                </div>

                {/* Banner y logo */}
                <div className="aya-tienda-banner-wrap">
                  {tiendaActiva.banner_url ? (
                    <img src={tiendaActiva.banner_url} alt="Banner" className="aya-tienda-banner-img" />
                  ) : (
                    <div className="aya-tienda-banner-placeholder">
                      <i className="fa-solid fa-store" />
                    </div>
                  )}
                  <div className="aya-tienda-logo-over">
                    {tiendaActiva.logo_url ? (
                      <img src={tiendaActiva.logo_url} alt="Logo" className="aya-tienda-logo-img" />
                    ) : (
                      <div className="aya-tienda-logo-default">
                        {tiendaActiva.nombre_tienda?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="aya-tienda-det-body">
                  <div className="aya-tienda-det-info">
                    <h2 className="aya-tienda-det-nombre">{tiendaActiva.nombre_tienda}</h2>
                    <p className="aya-tienda-det-propietario"><i className="fa-solid fa-user" /> {tiendaActiva.nombre_propietario}</p>
                    {tiendaActiva.descripcion && <p className="aya-tienda-det-desc">{tiendaActiva.descripcion}</p>}
                    <div className="aya-tienda-det-meta">
                      {tiendaActiva.ubicacion && <span><i className="fa-solid fa-location-dot" /> {tiendaActiva.ubicacion}</span>}
                      {tiendaActiva.telefono && <span><i className="fa-solid fa-phone" /> {tiendaActiva.telefono}</span>}
                      {tiendaActiva.email && <span><i className="fa-solid fa-envelope" /> {tiendaActiva.email}</span>}
                      {tiendaActiva.categoria_principal && <span><i className="fa-solid fa-tag" /> {tiendaActiva.categoria_principal}</span>}
                    </div>
                    {tiendaActiva.telefono && (
                      <a
                        href={`https://wa.me/591${tiendaActiva.telefono.replace(/\D/g, '')}?text=Hola, vi tu tienda "${tiendaActiva.nombre_tienda}" en AnunciosYA`}
                        target="_blank"
                        rel="noreferrer"
                        className="aya-tienda-wsp-btn"
                      >
                        <i className="fa-brands fa-whatsapp" /> Contactar por WhatsApp
                      </a>
                    )}
                  </div>

                  {/* Productos de la tienda */}
                  <div className="aya-tienda-productos-section">
                    <h3 className="aya-tienda-productos-title">
                      <i className="fa-solid fa-box-open" /> Catálogo de Productos
                      <span className="aya-tienda-prod-count">{(tiendaActiva.productos || []).length} producto{(tiendaActiva.productos || []).length !== 1 ? 's' : ''}</span>
                    </h3>
                    {(tiendaActiva.productos || []).length === 0 ? (
                      <div className="aya-tiendas-empty">
                        <i className="fa-solid fa-box-open" />
                        <p>Esta tienda aún no tiene productos publicados.</p>
                      </div>
                    ) : (
                      <div className="aya-productos-grid">
                        {(tiendaActiva.productos || []).map(prod => (
                          <div key={prod.id} className="aya-prod-card">
                            <div className="aya-prod-img-wrap">
                              {prod.imagen_url ? (
                                <img src={prod.imagen_url} alt={prod.nombre} className="aya-prod-img" />
                              ) : (
                                <div className="aya-prod-img-placeholder">
                                  <i className="fa-solid fa-image" />
                                </div>
                              )}
                              <span className="aya-prod-cat-badge">{prod.categoria}</span>
                            </div>
                            <div className="aya-prod-info">
                              <h4 className="aya-prod-nombre">{prod.nombre}</h4>
                              {prod.descripcion && <p className="aya-prod-desc">{prod.descripcion}</p>}
                              <div className="aya-prod-footer">
                                <span className="aya-prod-precio">Bs {parseFloat(prod.precio).toFixed(2)}</span>
                                {prod.cantidad_disponible > 0 && (
                                  <span className="aya-prod-stock">✅ {prod.cantidad_disponible} disp.</span>
                                )}
                                {prod.cantidad_disponible === 0 && (
                                  <span className="aya-prod-agotado">❌ Agotado</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </main>
            ) : vistaGestionTienda ? (
              /* ── PANEL DE GESTIÓN DE TIENDA (DUEÑO) ── */
              <main className="aya-gestion-page">
                <div className="aya-tienda-detalle-topbar">
                  <button className="aya-btn-volver" onClick={() => setVistaGestionTienda(false)}>
                    ← Volver a Tiendas
                  </button>
                  <nav className="aya-breadcrumbs">
                    <span className="aya-breadcrumb-link" onClick={() => setVistaGestionTienda(false)}>Tiendas</span>
                    <span>/</span>
                    <span className="aya-breadcrumb-curr">Mi Tienda</span>
                  </nav>
                </div>

                <div className="aya-gestion-layout">
                  {/* Info de la tienda */}
                  <div className="aya-gestion-tienda-card">
                    <div className="aya-gestion-tienda-header">
                      <div className="aya-gestion-logo-wrap">
                        {miTienda?.logo_url ? (
                          <img src={miTienda.logo_url} alt="Logo" className="aya-tienda-logo-img" />
                        ) : (
                          <div className="aya-tienda-logo-default" style={{ width: 64, height: 64, fontSize: '1.6rem' }}>
                            {miTienda?.nombre_tienda?.[0]?.toUpperCase() || '🏪'}
                          </div>
                        )}
                      </div>
                      <div>
                        <h2 className="aya-gestion-tienda-nombre">{miTienda?.nombre_tienda}</h2>
                        <p className="aya-gestion-tienda-meta"><i className="fa-solid fa-user" /> {miTienda?.nombre_propietario}</p>
                        <p className="aya-gestion-tienda-meta"><i className="fa-solid fa-location-dot" /> {miTienda?.ubicacion}</p>
                      </div>
                    </div>
                    <div className="aya-gestion-tienda-actions">
                      <button
                        className="aya-btn-editar-tienda"
                        onClick={() => {
                          setFormTienda({
                            nombre_tienda: miTienda?.nombre_tienda || '',
                            nombre_propietario: miTienda?.nombre_propietario || '',
                            descripcion: miTienda?.descripcion || '',
                            ubicacion: miTienda?.ubicacion || 'Cochabamba',
                            direccion: miTienda?.direccion || '',
                            telefono: miTienda?.telefono || '',
                            email: miTienda?.email || '',
                            logo_url: miTienda?.logo_url || '',
                            categoria_principal: miTienda?.categoria_principal || ''
                          });
                          setModalRegistroTienda(true);
                        }}
                      >
                        <i className="fa-solid fa-pen" /> Editar Tienda
                      </button>
                    </div>
                  </div>

                  {/* Panel de productos */}
                  <div className="aya-gestion-productos-panel">
                    <div className="aya-gestion-prod-header">
                      <h3><i className="fa-solid fa-box-open" /> Mis Productos ({(miTienda?.productos || []).length})</h3>
                      <button
                        className="aya-btn-agregar-prod"
                        onClick={() => {
                          setProductoEdit(null);
                          setFormProducto({ nombre: '', descripcion: '', categoria: 'otros', precio: '', cantidad_disponible: '', imagen_url: '' });
                          setModalProducto(true);
                        }}
                      >
                        <i className="fa-solid fa-plus" /> Agregar Producto
                      </button>
                    </div>

                    {(miTienda?.productos || []).length === 0 ? (
                      <div className="aya-tiendas-empty">
                        <i className="fa-solid fa-box-open" />
                        <p>Aún no tienes productos. ¡Agrega tu primer producto!</p>
                      </div>
                    ) : (
                      <div className="aya-gestion-prod-list">
                        {(miTienda?.productos || []).map(prod => (
                          <div key={prod.id} className="aya-gestion-prod-item">
                            <div className="aya-gestion-prod-img">
                              {prod.imagen_url ? (
                                <img src={prod.imagen_url} alt={prod.nombre} />
                              ) : (
                                <span className="aya-gestion-prod-img-ph"><i className="fa-solid fa-image" /></span>
                              )}
                            </div>
                            <div className="aya-gestion-prod-data">
                              <strong>{prod.nombre}</strong>
                              <span className="aya-prod-cat-badge" style={{ marginLeft: 8 }}>{prod.categoria}</span>
                              <p>Bs {parseFloat(prod.precio).toFixed(2)} &bull; Stock: {prod.cantidad_disponible}</p>
                              {prod.descripcion && <p className="aya-prod-desc">{prod.descripcion}</p>}
                            </div>
                            <div className="aya-gestion-prod-btns">
                              <button
                                className="aya-btn-edit-prod"
                                title="Editar producto"
                                onClick={() => {
                                  setProductoEdit(prod);
                                  setFormProducto({
                                    nombre: prod.nombre,
                                    descripcion: prod.descripcion || '',
                                    categoria: prod.categoria || 'otros',
                                    precio: prod.precio,
                                    cantidad_disponible: prod.cantidad_disponible,
                                    imagen_url: prod.imagen_url || ''
                                  });
                                  setModalProducto(true);
                                }}
                              >
                                <i className="fa-solid fa-pen" />
                              </button>
                              <button
                                className="aya-btn-del-prod"
                                title="Eliminar producto"
                                onClick={() => handleEliminarProducto(prod.id)}
                              >
                                <i className="fa-solid fa-trash" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </main>
            ) : (
              /* ── LISTA DE TIENDAS ── */
              <main className="aya-tiendas-page">
                {/* Hero de Tiendas */}
                <section className="aya-tiendas-hero">
                  <div className="aya-tiendas-hero-content">
                    <h1><i className="fa-solid fa-store" /> Tiendas y Negocios</h1>
                    <p>Descubre tiendas locales con sus catálogos de productos. ¡Apoya al comercio boliviano!</p>

                    {/* Buscador */}
                    <div className="aya-tiendas-search-bar">
                      <input
                        type="text"
                        placeholder="Buscar tienda o producto..."
                        className="aya-tiendas-search-input"
                        onKeyDown={e => {
                          if (e.key === 'Enter') cargarTiendas({ busqueda: e.target.value });
                        }}
                      />
                      <select
                        className="aya-tiendas-search-select"
                        onChange={e => cargarTiendas({ ubicacion: e.target.value })}
                        defaultValue="Todas"
                      >
                        <option value="Todas">Todos los departamentos</option>
                        {DEPARTAMENTOS_BOLIVIA.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>

                    {/* Botones de acción */}
                    <div className="aya-tiendas-hero-actions">
                      {usuarioAuth ? (
                        miTienda ? (
                          <button className="aya-btn-gestionar-tienda" onClick={() => setVistaGestionTienda(true)}>
                            <i className="fa-solid fa-store" /> Gestionar Mi Tienda
                          </button>
                        ) : (
                          <button
                            className="aya-btn-crear-tienda"
                            onClick={() => {
                              setFormTienda({
                                nombre_tienda: '',
                                nombre_propietario: `${usuarioAuth.nombre || ''} ${usuarioAuth.apellidos || ''}`.trim(),
                                descripcion: '',
                                ubicacion: usuarioAuth.ubicacion || 'Cochabamba',
                                direccion: usuarioAuth.direccion || '',
                                telefono: usuarioAuth.telefono || '',
                                email: usuarioAuth.correo || usuarioAuth.email || '',
                                logo_url: '',
                                categoria_principal: ''
                              });
                              setModalRegistroTienda(true);
                            }}
                          >
                            <i className="fa-solid fa-plus" /> Registrar Mi Tienda
                          </button>
                        )
                      ) : (
                        <button
                          className="aya-btn-crear-tienda"
                          onClick={() => { setTabAuth('registro'); setModalAuth(true); }}
                        >
                          <i className="fa-solid fa-user-plus" /> Registrate para Crear tu Tienda
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                {/* Grid de tiendas */}
                <section className="aya-tiendas-grid-section">
                  {cargandoTiendas ? (
                    <div className="aya-cargando-tiendas">
                      <div className="aya-spinner" />
                      <p>Cargando tiendas...</p>
                    </div>
                  ) : tiendas.length === 0 ? (
                    <div className="aya-tiendas-empty">
                      <i className="fa-solid fa-store-slash" />
                      <h3>Aún no hay tiendas registradas</h3>
                      <p>¡Sé el primero en registrar tu negocio en AnunciosYA!</p>
                    </div>
                  ) : (
                    <div className="aya-tiendas-grid">
                      {tiendas.map(tienda => (
                        <div
                          key={tienda.id}
                          className="aya-tienda-card"
                          onClick={() => verDetalleTienda(tienda.id)}
                        >
                          {/* Logo */}
                          <div className="aya-tienda-card-logo">
                            {tienda.logo_url ? (
                              <img src={tienda.logo_url} alt={tienda.nombre_tienda} />
                            ) : (
                              <div className="aya-tienda-card-logo-default">
                                {tienda.nombre_tienda?.[0]?.toUpperCase()}
                              </div>
                            )}
                            {tienda.destacada === 1 && <span className="aya-tienda-badge-dest">⭐ Destacada</span>}
                          </div>

                          <div className="aya-tienda-card-body">
                            <h3 className="aya-tienda-card-nombre">{tienda.nombre_tienda}</h3>
                            <p className="aya-tienda-card-propietario"><i className="fa-solid fa-user" /> {tienda.nombre_propietario}</p>
                            {tienda.descripcion && (
                              <p className="aya-tienda-card-desc">
                                {tienda.descripcion.length > 80 ? tienda.descripcion.slice(0, 80) + '...' : tienda.descripcion}
                              </p>
                            )}
                            <div className="aya-tienda-card-meta">
                              <span><i className="fa-solid fa-location-dot" /> {tienda.ubicacion}</span>
                              <span><i className="fa-solid fa-box-open" /> {tienda.total_productos || 0} productos</span>
                            </div>
                          </div>

                          <div className="aya-tienda-card-footer">
                            {tienda.categoria_principal && (
                              <span className="aya-tienda-cat-tag">{tienda.categoria_principal}</span>
                            )}
                            <span className="aya-tienda-ver-btn">Ver tienda →</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </main>
            )
          ) : (
            <>
          {/* ══ HERO BANNER ═══════════════════════════════ */}
          <section className="aya-hero" id="inicio">
            <img
              className="aya-hero-bg"
              src="https://images.unsplash.com/photo-1580684885768-6e1ba4b0b571?w=1400&q=80"
              alt="Bolivia"
              onError={e => {
                e.target.src = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1400&q=80';
              }}
            />
            <div className="aya-hero-overlay" />

            <div className="aya-hero-content">
              <h1>
                La forma más fácil de<br />
                comprar y vender en Bolivia
              </h1>
              <p>Encuentra lo que necesitas o publica lo que quieres vender de forma rápida y gratuita.</p>

              {/* Buscador hero */}
              <div className="aya-hero-search">
                <div className="aya-hero-search-input">
                  <span>🔍</span>
                  <input
                    id="aya-hero-search-input"
                    type="text"
                    placeholder="¿Qué estás buscando?"
                    value={busHero}
                    onChange={e => setBusHero(e.target.value)}
                  />
                </div>

                <select
                  className="aya-hero-search-select"
                  id="aya-hero-select-ciudad"
                  value={filtroCiudad}
                  onChange={e => setFiltroCiudad(e.target.value)}
                >
                  {CIUDADES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <select
                  className="aya-hero-search-select"
                  id="aya-hero-select-cat"
                  value={filtroSelect}
                  onChange={e => {
                    setFiltroSelect(e.target.value);
                    setCatActiva(e.target.value);
                  }}
                >
                  {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>

                <button
                  className="aya-hero-search-btn"
                  id="aya-hero-btn-buscar"
                  onClick={() => mostrarToast('🔍 Filtros aplicados')}
                >
                  🔍 Buscar
                </button>
              </div>

              {/* Búsquedas populares */}
              <div className="aya-hero-popular">
                <span>Búsquedas populares:</span>
                {POPULARES.map(p => (
                  <button
                    key={p}
                    className="aya-popular-tag"
                    onClick={() => setBusHero(p)}
                  >{p}</button>
                ))}
              </div>
            </div>
          </section>

          {/* ══ CATEGORÍAS CON IMÁGENES REALES ════════════ */}
          <section className="aya-section">
            <div className="aya-section-header">
              <h2 className="aya-section-title">Categorías principales</h2>
              <button
                className="aya-section-link"
                id="aya-ver-cats"
                onClick={() => setCatActiva('todas')}
              >
                Ver todas las categorías →
              </button>
            </div>
            <div className="aya-icon-cats">
              {CATEGORIAS.filter(c => c.id !== 'todas').map(cat => (
                <div
                  key={cat.id}
                  className={`aya-icon-cat${catActiva === cat.id ? ' active' : ''}`}
                  id={`aya-icon-cat-${cat.id}`}
                  onClick={() => setCatActiva(cat.id)}
                >
                  {IMG_CAT[cat.id] ? (
                    <img className="aya-icon-cat-img" src={IMG_CAT[cat.id]} alt={cat.nombre} loading="lazy" />
                  ) : (
                    <div className="aya-icon-cat-emoji">{cat.emoji}</div>
                  )}
                  <span className="aya-icon-cat-name">{cat.nombre}</span>
                  <span className="aya-icon-cat-count">{cat.count.toLocaleString()} anuncios</span>
                </div>
              ))}
            </div>
          </section>

          {/* ══ ANUNCIOS DESTACADOS ═══════════════════════ */}
          <section className="aya-section" id="anuncios" style={{ paddingTop: 0 }}>
            <div className="aya-section-header">
              <h2 className="aya-section-title">🔥 Anuncios destacados</h2>
              <button
                className="aya-section-link"
                id="aya-ver-destacados"
                onClick={() => setCatActiva('todas')}
              >
                Ver más destacados →
              </button>
            </div>

            {destaFiltrados.length === 0 ? (
              <div style={{ textAlign:'center', padding:'50px 20px', color:'#9ca3af', background:'#fff', borderRadius:'14px', border:'1px dashed var(--ya-border)' }}>
                <p style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--ya-text)', fontWeight: 700 }}>
                  {cargandoAnuncios ? '⏳ Cargando anuncios...' : '🔎 No se encontraron anuncios con estos filtros.'}
                </p>
                <p style={{ fontSize: '.88rem', marginBottom: '18px', color: 'var(--ya-muted)' }}>
                  Sé el primero en vender o promocionar tus productos y servicios en Bolivia.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    className="aya-btn-volver"
                    onClick={() => { setCatActiva('todas'); setFiltroCiudad('Todas'); setBusHero(''); }}
                  >
                    Restablecer filtros
                  </button>
                  <button
                    className="aya-btn-publicar-nav"
                    onClick={abrirModalPublicar}
                  >
                    ＋ Publicar anuncio ahora
                  </button>
                </div>
              </div>
            ) : (
              <div className="aya-cards-grid">
                {destaFiltrados.map(a => (
                  <div
                    key={a.id}
                    className={`aya-card${!a.img ? ' aya-card-no-img' : ''}${a.destacado ? ' is-destacado' : ''}`}
                    id={`aya-card-${a.id}`}
                    onClick={() => irAAnuncio(a)}
                  >
                    {a.img ? (
                      <>
                        <div className="aya-card-badges-wrapper">
                          {a.destacado && <span className="aya-card-badge dest">⭐ Destacado</span>}
                          {a.nuevo && <span className="aya-card-badge nuevo">✨ Nuevo</span>}
                        </div>

                        <button
                          className={`aya-card-fav-btn${a.fav ? ' faved' : ''}`}
                          id={`aya-fav-${a.id}`}
                          onClick={e => toggleFavD(a.id, e)}
                          title="Guardar en favoritos"
                        >{a.fav ? '❤️' : '🤍'}</button>

                        <img
                          className="aya-card-img"
                          src={a.img}
                          alt={a.titulo}
                          loading="lazy"
                          onError={e => { e.target.style.display='none'; }}
                        />
                      </>
                    ) : (
                      <div className="aya-card-no-img-top">
                        <div className="aya-card-badges-wrapper">
                          <span className="aya-card-cat-badge">{CATS_MAP[a.categoria] || a.categoria}</span>
                          {a.destacado && <span className="aya-card-badge dest">⭐ Destacado</span>}
                          {a.nuevo && <span className="aya-card-badge nuevo">✨ Nuevo</span>}
                        </div>

                        <button
                          className={`aya-card-fav-btn${a.fav ? ' faved' : ''}`}
                          id={`aya-fav-${a.id}`}
                          onClick={e => toggleFavD(a.id, e)}
                          title="Guardar en favoritos"
                        >{a.fav ? '❤️' : '🤍'}</button>
                      </div>
                    )}

                    <div className="aya-card-body">
                      <h3
                        className="aya-card-title"
                        style={a.color_titulo ? { color: a.color_titulo, fontWeight: 900 } : {}}
                      >
                        {a.titulo}
                      </h3>
                      <div className="aya-card-price">{a.precio}</div>
                      <div className="aya-card-meta">📍 {a.ciudad} · 🕐 {a.tiempo}</div>
                      {a.desc && <p className="aya-card-desc">{a.desc}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ══ ÚLTIMOS ANUNCIOS ═══════════════════════════ */}
          <section className="aya-section" style={{ paddingTop: 0 }}>
            <div className="aya-section-header">
              <h2 className="aya-section-title">Últimos anuncios</h2>
              <button className="aya-section-link" id="aya-ver-ultimos">Ver todos los anuncios →</button>
            </div>
            {ultimos.length === 0 ? (
              <div style={{ textAlign:'center', padding:'30px 20px', color:'#9ca3af', background:'#fff', borderRadius:'12px', border:'1px dashed var(--ya-border)' }}>
                <p style={{ fontSize: '1rem', color: 'var(--ya-muted)' }}>
                  Aún no hay anuncios recientes. ¡Sé el primero en publicar!
                </p>
              </div>
            ) : (
              <div className="aya-list-cards">
                {ultimos.map(a => (
                  <div
                    key={a.id}
                    className="aya-list-card"
                    id={`aya-list-${a.id}`}
                    onClick={() => irAAnuncio(a)}
                  >
                    {a.img ? (
                      <img
                        className="aya-list-card-img"
                        src={a.img}
                        alt={a.titulo}
                        loading="lazy"
                        onError={e => { e.target.style.display='none'; }}
                      />
                    ) : null}
                    <div className="aya-list-card-info">
                      <div
                        className="aya-list-card-title"
                        style={a.color_titulo ? { color: a.color_titulo, fontWeight: 900 } : {}}
                      >
                        {a.titulo}
                      </div>
                      <div className="aya-list-card-price">{a.precio}</div>
                      <div className="aya-list-card-meta">📍 {a.ciudad} · {a.tiempo}</div>
                    </div>
                    <button
                      className={`aya-card-fav-btn${a.fav ? ' faved' : ''}`}
                      style={{ position:'static', boxShadow:'none', background:'#f3f4f6', flexShrink:0 }}
                      onClick={e => toggleFavU(a.id, e)}
                    >{a.fav ? '❤️' : '🤍'}</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ══ BANNER DE CONFIANZA ════════════════════════ */}

            </>
          )}
        </>
      )}


      {/* ══ FAB FLOTANTE EN MÓVIL ════════════════════════ */}
      <button
        className="aya-fab"
        id="aya-fab"
        onClick={abrirModalPublicar}
      >
        ＋ Publicar anuncio
      </button>

      {/* ══════════════════════════════════════════════════
         MODAL DE AUTENTICACIÓN (LOGIN / REGISTRO / GOOGLE)
      ══════════════════════════════════════════════════ */}
      {modalAuth && (
        <div className="aya-overlay" onClick={() => setModalAuth(false)}>
          <div className="aya-auth-modal" onClick={e => e.stopPropagation()}>
            {/* Botón cerrar */}
            <button
              className="aya-modal-close"
              id="aya-close-auth"
              onClick={() => setModalAuth(false)}
            >✕</button>

            {/* Selector de pestañas */}
            <div className="aya-auth-tabs">
              <button
                className={`aya-auth-tab${tabAuth === 'login' ? ' active' : ''}`}
                id="aya-tab-login"
                onClick={() => setTabAuth('login')}
              >
                👤 Iniciar sesión
              </button>
              <button
                className={`aya-auth-tab${tabAuth === 'registro' ? ' active' : ''}`}
                id="aya-tab-registro"
                onClick={() => setTabAuth('registro')}
              >
                📝 Registrarse
              </button>
            </div>

            <h2 className="aya-auth-title">
              {tabAuth === 'login' ? 'Bienvenido a AnunciosYA' : 'Crear una cuenta gratis'}
            </h2>
            <p className="aya-auth-sub">
              {tabAuth === 'login'
                ? 'Ingresa para gestionar tus anuncios, mensajes y favoritos.'
                : 'Regístrate para publicar anuncios y contactar compradores en toda Bolivia.'}
            </p>

            {/* CONTENEDOR OFICIAL DE LOGIN CON GOOGLE */}
            <div className="aya-google-login-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                text={tabAuth === 'login' ? 'signin_with' : 'signup_with'}
                shape="rectangular"
                theme="outline"
                size="large"
                width="100%"
                locale="es"
              />
              {cargandoAuth && (
                <div style={{ fontSize: '.84rem', color: 'var(--ya-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⏳</span> Conectando con tu cuenta y la base de datos...
                </div>
              )}
            </div>

            <div className="aya-auth-divider">
              <span>o con tus datos</span>
            </div>

            {/* FORMULARIO DE INICIAR SESIÓN */}
            {tabAuth === 'login' ? (
              <form onSubmit={handleLogin}>
                <div className="aya-form-group">
                  <label>Correo electrónico o teléfono</label>
                  <input
                    id="aya-login-email"
                    type="text"
                    placeholder="ejemplo@correo.com o 77412345"
                    value={formLogin.email}
                    onChange={e => setFormLogin(f => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>

                <div className="aya-form-group">
                  <label>Contraseña</label>
                  <input
                    id="aya-login-pass"
                    type="password"
                    placeholder="Ingresa tu contraseña"
                    value={formLogin.password}
                    onChange={e => setFormLogin(f => ({ ...f, password: e.target.value }))}
                    required
                  />
                </div>

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'.82rem', marginBottom:18 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', color:'var(--ya-muted)' }}>
                    <input type="checkbox" defaultChecked /> Recordarme
                  </label>
                  <button
                    type="button"
                    style={{ background:'none', border:'none', color:'var(--ya-primary)', cursor:'pointer', fontWeight:600 }}
                    onClick={() => mostrarToast('🔑 Se ha enviado un enlace a tu correo para restablecer.')}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <button type="submit" className="aya-btn-publish" style={{ width: '100%' }} id="aya-submit-login">
                  Ingresar a mi cuenta
                </button>

                <div className="aya-auth-footer-switch">
                  ¿No tienes una cuenta aún?
                  <button type="button" onClick={() => setTabAuth('registro')}>
                    Regístrate gratis aquí
                  </button>
                </div>
              </form>
            ) : (
              /* FORMULARIO DE REGISTRO CON CAMPOS SOLICITADOS */
              <form onSubmit={handleRegistro}>
                <div className="aya-form-row">
                  <div className="aya-form-group">
                    <label>Nombre *</label>
                    <input
                      id="aya-reg-nombre"
                      type="text"
                      placeholder="Ej. Carlos"
                      value={formRegistro.nombre}
                      onChange={e => setFormRegistro(f => ({ ...f, nombre: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="aya-form-group">
                    <label>Apellidos (opcional)</label>
                    <input
                      id="aya-reg-apellidos"
                      type="text"
                      placeholder="Ej. Vargas Mamani"
                      value={formRegistro.apellidos}
                      onChange={e => setFormRegistro(f => ({ ...f, apellidos: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="aya-form-row">
                  <div className="aya-form-group">
                    <label>Teléfono celular *</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span style={{
                        background: '#f3f4f6',
                        border: '1.5px solid var(--ya-border)',
                        borderRadius: '10px',
                        padding: '12px 10px',
                        fontSize: '.88rem',
                        fontWeight: 700,
                        color: 'var(--ya-text2)',
                        display: 'flex',
                        alignItems: 'center'
                      }}>🇧🇴 +591</span>
                      <input
                        id="aya-reg-telefono"
                        type="tel"
                        placeholder="77412345"
                        value={formRegistro.telefono}
                        onChange={e => setFormRegistro(f => ({ ...f, telefono: e.target.value }))}
                        required
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>

                  <div className="aya-form-group">
                    <label>Ubicación (Departamento) *</label>
                    <select
                      id="aya-reg-ubicacion"
                      value={formRegistro.ubicacion}
                      onChange={e => setFormRegistro(f => ({ ...f, ubicacion: e.target.value }))}
                      required
                    >
                      {DEPARTAMENTOS_BOLIVIA.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dirección opcional */}
                <div className="aya-form-group">
                  <label>Dirección o Zona (opcional)</label>
                  <input
                    id="aya-reg-direccion"
                    type="text"
                    placeholder="Ej. Cala Cala, Av. América #240"
                    value={formRegistro.direccion}
                    onChange={e => setFormRegistro(f => ({ ...f, direccion: e.target.value }))}
                  />
                </div>

                <div className="aya-form-group">
                  <label>Correo electrónico *</label>
                  <input
                    id="aya-reg-email"
                    type="email"
                    placeholder="ejemplo@correo.com"
                    value={formRegistro.email}
                    onChange={e => setFormRegistro(f => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>

                <div className="aya-form-group">
                  <label>Contraseña *</label>
                  <input
                    id="aya-reg-pass"
                    type="password"
                    placeholder="Crea una contraseña segura (mín. 6 caracteres)"
                    value={formRegistro.password}
                    onChange={e => setFormRegistro(f => ({ ...f, password: e.target.value }))}
                    required
                  />
                </div>

                <div style={{ fontSize:'.78rem', color:'var(--ya-muted)', marginBottom:16, lineHeight:1.5 }}>
                  Al registrarte aceptas las Condiciones de Uso y Políticas de Privacidad de AnunciosYA Bolivia.
                </div>

                <button type="submit" className="aya-btn-publish" style={{ width: '100%' }} id="aya-submit-registro">
                  🚀 Crear mi cuenta gratis
                </button>

                <div className="aya-auth-footer-switch">
                  ¿Ya tienes una cuenta registrada?
                  <button type="button" onClick={() => setTabAuth('login')}>
                    Inicia sesión aquí
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
         MODAL PUBLICAR ANUNCIO
      ══════════════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════════
         WIZARD DE PUBLICACIÓN DE ANUNCIOS EN 3 PASOS
         Paso 1: Validación de Datos del Vendedor (Nombre, Apellidos, Teléfono, Ubicación)
         Paso 2: Detalles del Anuncio (Título, Categoría, Precio, Descripción, Dirección)
         Paso 3: Duración (6 días base + 0.50 Bs/día extra), Color llamativo (+1 Bs) y Pago QR rápido (5 Bs base)
      ══════════════════════════════════════════════════ */}
      {modalPub && (
        <div className="aya-overlay" onClick={() => !procesandoPago && setModalPub(false)}>
          <div className="aya-wizard-modal" onClick={e => e.stopPropagation()}>

            {/* Encabezado del Wizard */}
            <div className="aya-wizard-header">
              <h2>📢 Publicar Anuncio en AnunciosYA</h2>
              <button
                className="aya-modal-close"
                id="aya-close-pub"
                onClick={() => !procesandoPago && setModalPub(false)}
                disabled={procesandoPago}
              >✕</button>
            </div>

            {/* Barra de progreso de los 3 pasos */}
            <div className="aya-wizard-nav-steps">
              <div className={`aya-wizard-step-item${pasoPub === 1 ? ' active' : ''}${pasoPub > 1 ? ' completed' : ''}`}>
                <div className="aya-wizard-circle">{pasoPub > 1 ? '✓' : '1'}</div>
                <span>1. Tus Datos</span>
              </div>
              <div className={`aya-wizard-divider-line${pasoPub > 1 ? ' active' : ''}`} />
              <div className={`aya-wizard-step-item${pasoPub === 2 ? ' active' : ''}${pasoPub > 2 ? ' completed' : ''}`}>
                <div className="aya-wizard-circle">{pasoPub > 2 ? '✓' : '2'}</div>
                <span>2. Tu Anuncio</span>
              </div>
              <div className={`aya-wizard-divider-line${pasoPub > 2 ? ' active' : ''}`} />
              <div className={`aya-wizard-step-item${pasoPub === 3 ? ' active' : ''}`}>
                <div className="aya-wizard-circle">3</div>
                <span>3. Duración y Pago</span>
              </div>
            </div>

            {/* Cuerpo del Wizard */}
            <div className="aya-wizard-body">

              {/* ── PASO 1: VALIDACIÓN DE DATOS DEL VENDEDOR ── */}
              {pasoPub === 1 && (
                <form onSubmit={validarYAvanzarPaso1}>
                  <div className="aya-step-instruction">
                    <span>👤</span>
                    <div>
                      <strong>Paso 1: Valida tus datos de contacto</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '.82rem', opacity: .9 }}>
                        Para garantizar confianza y seguridad, tu nombre, apellidos y número de WhatsApp son obligatorios.
                      </p>
                    </div>
                  </div>

                  {usuarioAuth && (
                    <div style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: 10,
                      padding: '10px 14px',
                      marginBottom: 18,
                      fontSize: '.85rem',
                      color: '#166534',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}>
                      <span>✓</span>
                      <span>Sesión iniciada como <strong>{usuarioAuth.nombre} {usuarioAuth.apellidos || ''}</strong></span>
                    </div>
                  )}

                  <div className="aya-form-row">
                    <div className="aya-form-group">
                      <label>Nombre de pila *</label>
                      <input
                        id="aya-step1-nombre"
                        type="text"
                        placeholder="Ej: Carlos"
                        value={datosUserPub.nombre}
                        onChange={e => setDatosUserPub(f => ({ ...f, nombre: e.target.value }))}
                        required
                      />
                      <span style={{ fontSize: '.74rem', color: 'var(--ya-muted)', marginTop: '2px', display: 'block' }}>
                        Por privacidad, solo se mostrará tu primer nombre a los compradores.
                      </span>
                    </div>

                    <div className="aya-form-group">
                      <label>Apellidos *</label>
                      <input
                        id="aya-step1-apellidos"
                        type="text"
                        placeholder="Ej: Vargas Mamani"
                        value={datosUserPub.apellidos}
                        onChange={e => setDatosUserPub(f => ({ ...f, apellidos: e.target.value }))}
                        required
                      />
                      <span style={{ fontSize: '.74rem', color: 'var(--ya-muted)', marginTop: '2px', display: 'block' }}>
                        Registro privado para seguridad de la plataforma.
                      </span>
                    </div>
                  </div>

                  <div className="aya-form-row">
                    <div className="aya-form-group">
                      <label>Teléfono Celular / WhatsApp *</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span style={{
                          background: '#f3f4f6',
                          border: '1.5px solid var(--ya-border)',
                          borderRadius: '10px',
                          padding: '12px 10px',
                          fontSize: '.88rem',
                          fontWeight: 700,
                          color: 'var(--ya-text2)',
                          display: 'flex',
                          alignItems: 'center'
                        }}>🇧🇴 +591</span>
                        <input
                          id="aya-step1-telefono"
                          type="tel"
                          placeholder="77412345"
                          value={datosUserPub.telefono}
                          onChange={e => setDatosUserPub(f => ({ ...f, telefono: e.target.value }))}
                          required
                          style={{ flex: 1 }}
                        />
                      </div>
                      <span style={{ fontSize: '.74rem', color: 'var(--ya-muted)', marginTop: '2px', display: 'block' }}>
                        Los interesados te llamarán o contactarán a este WhatsApp.
                      </span>
                    </div>

                    <div className="aya-form-group">
                      <label>Departamento / Ubicación *</label>
                      <select
                        id="aya-step1-ubicacion"
                        value={datosUserPub.ubicacion}
                        onChange={e => setDatosUserPub(f => ({ ...f, ubicacion: e.target.value }))}
                        required
                      >
                        {DEPARTAMENTOS_BOLIVIA.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="aya-wizard-footer-actions">
                    <button
                      type="button"
                      className="aya-btn-step-back"
                      onClick={() => setModalPub(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="aya-btn-step-next"
                      id="aya-btn-paso1-next"
                    >
                      Continuar a Detalles del Anuncio →
                    </button>
                  </div>
                </form>
              )}

              {/* ── PASO 2: CREACIÓN DE LA PUBLICACIÓN ── */}
              {pasoPub === 2 && (
                <form onSubmit={validarYAvanzarPaso2}>
                  <div className="aya-step-instruction">
                    <span>📦</span>
                    <div>
                      <strong>Paso 2: Detalles de lo que estás vendiendo u ofreciendo</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '.82rem', opacity: .9 }}>
                        Coloca el título, descripción, precio y la dirección donde se encuentra el producto.
                      </p>
                    </div>
                  </div>

                  <div className="aya-form-group">
                    <label>Título del anuncio *</label>
                    <input
                      id="aya-step2-titulo"
                      type="text"
                      placeholder="Ej: Toyota Hilux 2020 4x4 o Laptop Lenovo Legion Core i7"
                      value={datosAdPub.titulo}
                      onChange={e => setDatosAdPub(f => ({ ...f, titulo: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="aya-form-row">
                    <div className="aya-form-group">
                      <label>Categoría *</label>
                      <select
                        id="aya-step2-cat"
                        value={datosAdPub.categoria}
                        onChange={e => setDatosAdPub(f => ({ ...f, categoria: e.target.value }))}
                        required
                      >
                        <option value="">Seleccionar categoría...</option>
                        {CATEGORIAS.filter(c => c.id !== 'todas').map(c => (
                          <option key={c.id} value={c.id}>{c.emoji} {c.nombre}</option>
                        ))}
                      </select>
                    </div>

                    <div className="aya-form-group">
                      <label>Ciudad *</label>
                      <select
                        id="aya-step2-ciudad"
                        value={datosAdPub.ciudad}
                        onChange={e => setDatosAdPub(f => ({ ...f, ciudad: e.target.value }))}
                        required
                      >
                        {CIUDADES.filter(c => c !== 'Todas').map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="aya-form-group">
                    <label>Precio en Bolivianos (Bs.) *</label>
                    <input
                      id="aya-step2-precio"
                      type="text"
                      placeholder="Ej: 1500  (o 'A convenir')"
                      value={datosAdPub.precio}
                      onChange={e => setDatosAdPub(f => ({ ...f, precio: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="aya-form-group">
                    <label>Descripción detallada *</label>
                    <textarea
                      id="aya-step2-desc"
                      placeholder="Describe las características principales, estado estético, accesorios incluidos, garantía o detalles de entrega..."
                      value={datosAdPub.desc}
                      onChange={e => setDatosAdPub(f => ({ ...f, desc: e.target.value }))}
                      required
                      style={{ minHeight: '90px' }}
                    />
                  </div>

                  <div className="aya-form-group">
                    <label>Dirección de local o Zona de mercado *</label>
                    <input
                      id="aya-step2-direccion"
                      type="text"
                      placeholder="Ej: Av. Heroínas #320 casi San Martín (o Zona La Cancha sector calzados)"
                      value={datosAdPub.direccion}
                      onChange={e => setDatosAdPub(f => ({ ...f, direccion: e.target.value }))}
                      required
                    />
                    <span style={{ fontSize: '.74rem', color: 'var(--ya-muted)', marginTop: '2px', display: 'block' }}>
                      Indica dónde pueden ver el artículo o recogerlo.
                    </span>
                  </div>

                  <div className="aya-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ margin: 0 }}>
                        Fotos del producto (Opcional — Máximo 4 fotos)
                      </label>
                      <span style={{ fontSize: '.78rem', color: 'var(--ya-muted)', fontWeight: 600 }}>
                        {datosAdPub.imagenes.length} de 4 fotos
                      </span>
                    </div>
                    <p style={{ fontSize: '.78rem', color: 'var(--ya-muted)', margin: '4px 0 10px' }}>
                      💡 Cargar fotos es 100% opcional. Puedes publicar tu anuncio sin ninguna foto o agregar hasta 4 imágenes para mostrar más detalles.
                    </p>

                    {/* Input invisible de archivos del dispositivo */}
                    <input
                      type="file"
                      id="aya-file-input-fotos"
                      accept="image/png, image/jpeg, image/jpg, image/webp, image/gif"
                      multiple
                      style={{ display: 'none' }}
                      onChange={handleArchivosSeleccionados}
                      disabled={subiendoFotos || datosAdPub.imagenes.length >= 4}
                    />

                    {/* Botón / Zona de Carga de Imágenes */}
                    {datosAdPub.imagenes.length < 4 && (
                      <div
                        className="aya-upload-dropzone"
                        onClick={() => document.getElementById('aya-file-input-fotos')?.click()}
                        role="button"
                        tabIndex={0}
                        title="Haz clic para seleccionar imágenes desde tu dispositivo"
                      >
                        <div className="aya-upload-dropzone-icon">
                          {subiendoFotos ? '⏳' : '📷'}
                        </div>
                        <div className="aya-upload-dropzone-title">
                          {subiendoFotos ? 'Subiendo fotos...' : 'Cargar fotos desde tu dispositivo'}
                        </div>
                        <div className="aya-upload-dropzone-sub">
                          Toca aquí para seleccionar de tu galería, fotos o archivos (hasta 4 fotos, opcional)
                        </div>
                      </div>
                    )}

                    {/* Enlace discreto para pegar URL web si el usuario lo desea */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                      <button
                        type="button"
                        onClick={() => setMostrarInputUrl(prev => !prev)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--ya-primary)',
                          fontSize: '.75rem',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        {mostrarInputUrl ? 'Ocultar opción de link web' : '¿Prefieres pegar un enlace web? Haz clic aquí'}
                      </button>
                    </div>

                    {mostrarInputUrl && datosAdPub.imagenes.length < 4 && (
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <input
                          type="url"
                          placeholder="Pega enlace de foto https://..."
                          value={inputFotoUrl}
                          onChange={e => setInputFotoUrl(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              agregarFotoUrl();
                            }
                          }}
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className="aya-btn-step-next"
                          style={{ padding: '8px 16px', fontSize: '.86rem', whiteSpace: 'nowrap' }}
                          onClick={() => agregarFotoUrl()}
                        >
                          ＋ Añadir link
                        </button>
                      </div>
                    )}

                    {/* Cuadrícula de 4 slots */}
                    <div className="aya-img-slots-grid">
                      {[0, 1, 2, 3].map(idx => {
                        const foto = datosAdPub.imagenes[idx];
                        return (
                          <div
                            key={idx}
                            className={`aya-img-slot${foto ? ' has-image' : ''}`}
                            onClick={!foto ? () => document.getElementById('aya-file-input-fotos')?.click() : undefined}
                            style={{ cursor: !foto ? 'pointer' : 'default' }}
                            title={!foto ? 'Haz clic para cargar foto' : undefined}
                          >
                            {foto ? (
                              <>
                                <img
                                  src={foto}
                                  alt={`Foto ${idx + 1}`}
                                  onError={e => {
                                    e.target.src = 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=300&q=70';
                                  }}
                                />
                                <button
                                  type="button"
                                  className="aya-slot-remove-btn"
                                  title="Eliminar foto"
                                  onClick={(e) => { e.stopPropagation(); removerFoto(idx); }}
                                >
                                  ✕
                                </button>
                                <span className="aya-slot-number">
                                  {idx === 0 ? 'Principal' : `#${idx + 1}`}
                                </span>
                              </>
                            ) : (
                              <div style={{ textAlign: 'center', color: '#9ca3af', padding: 8 }}>
                                <span style={{ fontSize: '1.2rem', display: 'block' }}>＋</span>
                                <span style={{ fontSize: '.72rem', display: 'block', marginTop: 2 }}>
                                  {idx === 0 ? 'Foto 1 (Principal)' : `Foto ${idx + 1}`}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Fotos sugeridas rápidas para comodidad del usuario */}
                    {datosAdPub.categoria && IMG_CAT[datosAdPub.categoria] && datosAdPub.imagenes.length < 4 && (
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '.76rem', color: 'var(--ya-muted)' }}>Sugerencia rápida:</span>
                        <button
                          type="button"
                          style={{
                            background: '#f3f4f6',
                            border: '1px solid var(--ya-border)',
                            borderRadius: 6,
                            padding: '3px 8px',
                            fontSize: '.75rem',
                            cursor: 'pointer',
                            color: 'var(--ya-primary)',
                            fontWeight: 600
                          }}
                          onClick={() => agregarFotoUrl(IMG_CAT[datosAdPub.categoria])}
                        >
                          ✨ Usar foto sugerida de {CATS_MAP[datosAdPub.categoria] || 'categoría'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="aya-wizard-footer-actions">
                    <button
                      type="button"
                      className="aya-btn-step-back"
                      onClick={() => setPasoPub(1)}
                    >
                      ← Volver a Mis Datos
                    </button>
                    <button
                      type="submit"
                      className="aya-btn-step-next"
                      id="aya-btn-paso2-next"
                    >
                      Continuar a Duración y Pago →
                    </button>
                  </div>
                </form>
              )}

              {/* ── PASO 3: DURACIÓN, COLOR Y PAGO QR RÁPIDO ── */}
              {pasoPub === 3 && (
                <div>
                  <div className="aya-step-instruction">
                    <span>⚡</span>
                    <div>
                      <strong>Paso 3: Duración, personalización y pago QR</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '.82rem', opacity: .9 }}>
                        Revisa la vigencia de tu anuncio, añade color llamativo y completa el pago rápido con QR.
                      </p>
                    </div>
                  </div>

                  {/* 1. Selector de Duración */}
                  <div className="aya-duration-selector-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '.95rem', color: 'var(--ya-text)' }}>
                          ⏳ Duración del Anuncio
                        </strong>
                        <p style={{ fontSize: '.8rem', color: 'var(--ya-muted)', margin: '2px 0 0' }}>
                          Por defecto incluye <strong>6 días</strong>. Días adicionales: <strong>0.50 Bs</strong> cada uno.
                        </p>
                      </div>
                      {pubDias > 6 ? (
                        <span className="aya-duration-badge-extra">
                          +{diasExtra} días (+{(diasExtra * 0.5).toFixed(2)} Bs)
                        </span>
                      ) : (
                        <span style={{ background: '#ecfdf5', color: '#047857', padding: '4px 10px', borderRadius: 20, fontSize: '.78rem', fontWeight: 700 }}>
                          6 días incluidos
                        </span>
                      )}
                    </div>

                    <div className="aya-duration-selector-row">
                      <div className="aya-duration-counter">
                        <button
                          type="button"
                          className="aya-counter-btn"
                          onClick={() => setPubDias(d => Math.max(6, d - 1))}
                          disabled={pubDias <= 6}
                          title="Mínimo 6 días"
                        >
                          −
                        </button>
                        <div className="aya-counter-val">
                          {pubDias} <span style={{ fontSize: '.82rem', fontWeight: 500, color: 'var(--ya-muted)' }}>días</span>
                        </div>
                        <button
                          type="button"
                          className="aya-counter-btn"
                          onClick={() => setPubDias(d => d + 1)}
                          title="Añadir 1 día extra (+0.50 Bs)"
                        >
                          ＋
                        </button>
                      </div>

                      <div style={{ fontSize: '.84rem', color: 'var(--ya-text2)' }}>
                        Expira en: <strong>{pubDias} días</strong> desde la publicación
                      </div>
                    </div>
                  </div>

                  {/* 2. Selector de Color Llamativo (+1 Bs) */}
                  <div className="aya-color-picker-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '.95rem', color: 'var(--ya-text)' }}>
                          🎨 Color llamativo en el título (+1.00 Bs)
                        </strong>
                        <p style={{ fontSize: '.8rem', color: 'var(--ya-muted)', margin: '2px 0 0' }}>
                          Haz que tu anuncio destaque y atraiga el triple de vistas en el catálogo.
                        </p>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 700, fontSize: '.86rem', color: pubColorActivo ? 'var(--ya-primary)' : 'var(--ya-muted)' }}>
                        <input
                          type="checkbox"
                          checked={pubColorActivo}
                          onChange={e => setPubColorActivo(e.target.checked)}
                          style={{ width: 18, height: 18, cursor: 'pointer' }}
                        />
                        {pubColorActivo ? 'Activado (+1 Bs)' : 'Activar color'}
                      </label>
                    </div>

                    {pubColorActivo && (
                      <>
                        <div className="aya-color-palette">
                          {COLORES_LLAMATIVOS.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              className={`aya-color-circle-btn${pubColorTitulo === c.hex ? ' selected' : ''}`}
                              style={{ backgroundColor: c.hex }}
                              onClick={() => setPubColorTitulo(c.hex)}
                              title={`${c.nombre} (${c.hex})`}
                            />
                          ))}
                        </div>

                        {/* Vista previa del título con el color */}
                        <div className="aya-title-preview">
                          <span style={{ fontSize: '.78rem', color: 'var(--ya-muted)', display: 'block', marginBottom: 4 }}>
                            Vista previa de tu título llamativo:
                          </span>
                          <strong style={{ color: pubColorTitulo, fontSize: '1.15rem' }}>
                            {datosAdPub.titulo || 'Título de tu anuncio'}
                          </strong>
                        </div>
                      </>
                    )}
                  </div>

                  {/* 3. Desglose detallado de Costos */}
                  <div className="aya-cost-breakdown">
                    <h4><span>💰</span> Resumen y Desglose de Costos</h4>
                    <div className="aya-cost-line">
                      <span>Tarifa base de publicación (6 días incluidos)</span>
                      <strong>Bs 5.00</strong>
                    </div>
                    <div className="aya-cost-line">
                      <span>Días adicionales ({diasExtra} días x 0.50 Bs)</span>
                      <strong>Bs {costoDiasExtra.toFixed(2)}</strong>
                    </div>
                    <div className="aya-cost-line">
                      <span>Color llamativo de título ({pubColorActivo ? 'Activado' : 'Sin color'})</span>
                      <strong>Bs {costoColor.toFixed(2)}</strong>
                    </div>

                    {cuponAplicado && (
                      <div className="aya-cost-line" style={{ color: '#16a34a' }}>
                        <span>
                          <i className="fa-solid fa-ticket" style={{ marginRight: 6 }}></i>
                          Descuento cupón ({cuponAplicado.codigo})
                        </span>
                        <strong>-Bs {descuentoCupon.toFixed(2)}</strong>
                      </div>
                    )}

                    <div className="aya-cost-total-line">
                      <span>TOTAL A PAGAR</span>
                      <span className="aya-total-price-tag" style={{ color: esPublicacionGratis ? '#16a34a' : 'inherit' }}>
                        Bs {costoTotalCalculado}
                        {esPublicacionGratis && (
                          <span style={{ fontSize: '.72rem', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 12, marginLeft: 8, fontWeight: 700 }}>
                            GRATIS
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* 4. Sección de Cupón de Descuento / Publicación Gratis */}
                  <div className="aya-coupon-section" style={{
                    background: '#f8fafc',
                    border: cuponAplicado ? '1.5px solid #22c55e' : '1.5px dashed #cbd5e1',
                    borderRadius: '14px',
                    padding: '16px',
                    margin: '18px 0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: cuponAplicado ? '8px' : '12px' }}>
                      <i className="fa-solid fa-ticket" style={{ color: cuponAplicado ? '#16a34a' : 'var(--ya-primary)', fontSize: '1.1rem' }}></i>
                      <strong style={{ fontSize: '.92rem', color: 'var(--ya-text)' }}>
                        {cuponAplicado ? 'Cupón Aplicado' : '¿Tienes un cupón de publicación gratis o descuento?'}
                      </strong>
                    </div>

                    {cuponAplicado ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ecfdf5', padding: '10px 14px', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ background: '#16a34a', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontWeight: '800', fontSize: '0.82rem', letterSpacing: '0.5px' }}>
                              {cuponAplicado.codigo}
                            </span>
                            <strong style={{ color: '#065f46', fontSize: '0.9rem' }}>
                              {cuponAplicado.tipo === 'gratis' || cuponAplicado.valor >= 100 ? 'Publicación 100% Gratis' : `Descuento de ${cuponAplicado.valor}%`}
                            </strong>
                          </div>
                          <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#047857' }}>
                            {cuponAplicado.descripcion || 'Cupón de cortesía activado correctamente.'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleQuitarCupon}
                          style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          title="Remover cupón"
                        >
                          <i className="fa-solid fa-xmark"></i> Quitar
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Pon código de cupón (ej: VPPP)"
                          value={codigoCuponInput}
                          onChange={e => setCodigoCuponInput(e.target.value.toUpperCase())}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleValidarCupon(); } }}
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            borderRadius: '10px',
                            border: '1.5px solid #cbd5e1',
                            fontSize: '0.9rem',
                            fontWeight: '700',
                            letterSpacing: '1px',
                            textTransform: 'uppercase'
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleValidarCupon}
                          disabled={validandoCupon}
                          style={{
                            background: 'var(--ya-primary)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '10px 18px',
                            fontWeight: '700',
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {validandoCupon ? (
                            <><i className="fa-solid fa-spinner fa-spin"></i> Validando...</>
                          ) : (
                            <><i className="fa-solid fa-check"></i> Validar</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 5. Tarjeta de Pago QR o Confirmación de Publicación Gratis */}
                  {esPublicacionGratis ? (
                    <div className="aya-qr-payment-card" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', borderColor: '#86efac', textAlign: 'center', padding: '24px' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎉</div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#166534', marginBottom: 6 }}>
                        ¡Publicación 100% Gratuita con Cupón!
                      </h3>
                      <p style={{ fontSize: '.86rem', color: '#15803d', maxWidth: 440, margin: '0 auto 18px', lineHeight: 1.5 }}>
                        El cupón <strong>{cuponAplicado.codigo}</strong> cubre el costo total de tu publicación. Ya no requieres realizar pago por QR.
                      </p>

                      <button
                        type="button"
                        className="aya-btn-pay-qr-fast"
                        id="aya-btn-confirmar-qr"
                        onClick={handleConfirmarPagoYPublicar}
                        disabled={procesandoPago}
                        style={{ width: '100%', justifyContent: 'center', background: '#16a34a', borderColor: '#15803d', fontSize: '1rem', padding: '14px' }}
                      >
                        {procesandoPago ? (
                          <>
                            <i className="fa-solid fa-spinner fa-spin"></i> Registrando publicación...
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }}></i> Registrar publicación
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="aya-qr-payment-card">
                      <div className="aya-qr-badge-bo">
                        <span>🇧🇴</span> Pago con QR Simple Bolivia
                      </div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--ya-text)', marginBottom: 4 }}>
                        Código QR para Pago Rápido
                      </h3>
                      <p style={{ fontSize: '.84rem', color: 'var(--ya-muted)', maxWidth: 420, margin: '0 auto' }}>
                        Escanea desde cualquier app bancaria de Bolivia (Banco Unión, BCP, BNB, BancoSol, Bisa, Ganadero, etc.).
                      </p>

                      <div className="aya-qr-wrapper">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=PAGO-ANUNCIOSYA-BS-${costoTotalCalculado}-${Date.now()}`}
                          alt="QR Simple Bolivia"
                        />
                      </div>

                      <div style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--ya-text2)', marginBottom: 12 }}>
                        Monto a transferir: <span style={{ color: 'var(--ya-primary)', fontSize: '1.1rem' }}>Bs {costoTotalCalculado}</span>
                      </div>

                      <button
                        type="button"
                        className="aya-btn-pay-qr-fast"
                        id="aya-btn-confirmar-qr"
                        onClick={handleConfirmarPagoYPublicar}
                        disabled={procesandoPago}
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        {procesandoPago ? (
                          <>
                            <i className="fa-solid fa-spinner fa-spin"></i> Verificando pago QR en tiempo real...
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-credit-card" style={{ marginRight: 6 }}></i> Confirmar Pago QR (Bs {costoTotalCalculado}) y Publicar Anuncio
                          </>
                        )}
                      </button>
                      <span style={{ fontSize: '.74rem', color: 'var(--ya-muted)', display: 'block', marginTop: 8 }}>
                        ⚡ Modo prueba rápida: al confirmar, se validará el pago y tu anuncio se creará al instante en MySQL.
                      </span>
                    </div>
                  )}

                  <div className="aya-wizard-footer-actions">
                    <button
                      type="button"
                      className="aya-btn-step-back"
                      onClick={() => setPasoPub(2)}
                      disabled={procesandoPago}
                    >
                      ← Volver a Editar Anuncio
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ══ FOOTER ══════════════════════════════════════ */}

      {/* ══ FOOTER ══════════════════════════════════════ */}
      <footer className="aya-footer">
        <div className="aya-footer-main">

          {/* Columna 1 — Brand */}
          <div className="aya-footer-brand">
            <div
              className="aya-logo"
              onClick={volverAInicio}
              style={{ cursor: 'pointer' }}
            >
              <div className="aya-logo-icon">📢</div>
              <div className="aya-logo-text">
                <strong style={{ color: '#fff' }}>AnunciosYA</strong>
                <span style={{ color: '#9ca3af' }}>Compra, vende y encuentra en Bolivia</span>
              </div>
            </div>
            <p className="aya-footer-desc">
              AnunciosYA es una plataforma moderna para la publicación de clasificados. Las operaciones de compraventa o contratación se realizan directamente entre los usuarios con total libertad y seguridad.
            </p>
            <div className="aya-footer-socials">
              <button className="aya-social-btn" title="Facebook">📘</button>
              <button className="aya-social-btn" title="Instagram">📸</button>
              <button className="aya-social-btn" title="TikTok">🎵</button>
              <button className="aya-social-btn" title="WhatsApp">💬</button>
            </div>
          </div>

          {/* Columna 2 — Links */}
          <div className="aya-footer-col">
            <h4>Enlaces rápidos</h4>
            <ul>
              <li><button onClick={volverAInicio}>Inicio</button></li>
              <li><button onClick={() => { volverAInicio(); setCatActiva('todas'); }}>Categorías</button></li>
              <li><button onClick={abrirModalPublicar}>Publicar anuncio</button></li>
              <li><button onClick={() => { if (usuarioAuth) abrirPerfil(); else { setTabAuth('login'); setModalAuth(true); } }}>Mi cuenta / Mi Perfil</button></li>
              <li><button onClick={() => mostrarToast('⭐ Sección de favoritos')}>Favoritos</button></li>
            </ul>
          </div>

          {/* Columna 3 — Categorías */}
          <div className="aya-footer-col">
            <h4>Categorías</h4>
            <ul>
              {CATEGORIAS.filter(c => c.id !== 'todas').map(c => (
                <li key={c.id}>
                  <button onClick={() => { setCatActiva(c.id); volverAInicio(); }}>{c.nombre}</button>
                </li>
              ))}
            </ul>
          </div>

          {/* Columna 4 — Ayuda y Legal */}
          <div className="aya-footer-col">
            <h4>Ayuda y Legal</h4>
            <ul>
              <li><button onClick={() => setModalLegal('comoPublicar')}>Cómo publicar</button></li>
              <li><button onClick={() => setModalLegal('terminos')}>Términos y condiciones</button></li>
              <li><button onClick={() => setModalLegal('privacidad')}>Política de privacidad</button></li>
              <li><button onClick={() => setModalLegal('normas')}>Normas de la comunidad</button></li>
            </ul>
          </div>

          {/* Columna 5 — App + newsletter */}
          <div className="aya-footer-col">
            <h4>Recibe las mejores ofertas</h4>
            <p style={{ fontSize: '.82rem', color: '#9ca3af', marginBottom: 12 }}>
              Suscríbete y sé el primero en enterarte de las mejores oportunidades en Bolivia.
            </p>
            <div className="aya-footer-newsletter">
              <input
                className="aya-newsletter-input"
                type="email"
                placeholder="Tu correo electrónico"
              />
              <button
                className="aya-newsletter-btn"
                onClick={() => mostrarToast('📬 ¡Suscripción realizada con éxito!')}
              >→</button>
            </div>

            <div className="aya-app-title">Descarga nuestra app (próximamente)</div>
            <div className="aya-app-badges">
              <div className="aya-app-badge">
                <span className="aya-app-badge-icon">▶</span>
                <div className="aya-app-badge-text">
                  <span>DISPONIBLE EN</span>
                  <strong>Google Play</strong>
                </div>
              </div>
              <div className="aya-app-badge">
                <span className="aya-app-badge-icon">🍎</span>
                <div className="aya-app-badge-text">
                  <span>Descárgalo en</span>
                  <strong>App Store</strong>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="aya-footer-bottom">
          <div className="aya-footer-bottom-inner">
            <span className="aya-footer-copy">© 2026 AnunciosYA. Todos los derechos reservados.</span>
            <div className="aya-footer-bottom-right">
              <span>🇧🇴 Hecho en Bolivia</span>
              <span>Bolivia · Español</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ══════════════════════════════════════════════════
         MODAL DE ADVERTENCIAS DE SEGURIDAD (ANTES DE WHATSAPP)
      ══════════════════════════════════════════════════ */}
      {modalSeguridadWsp && (
        <div className="aya-overlay" onClick={() => setModalSeguridadWsp(false)}>
          <div className="aya-security-modal" onClick={e => e.stopPropagation()}>
            <div className="aya-security-head">
              <div className="aya-security-badge-icon">🛡️</div>
              <div>
                <h2>Advertencias de Seguridad</h2>
                <p>Consejos esenciales antes de contactar al anunciante por WhatsApp</p>
              </div>
            </div>

            <div className="aya-security-items">
              <div className="aya-sec-item critical">
                <div className="aya-sec-icon">🛑</div>
                <div>
                  <strong>No adelantes dinero bajo ningún motivo</strong>
                  Nunca envíes transferencias bancarias, depósitos previos, pagos de señas ni giros (Tigo Money, etc.) antes de haber visto y verificado el producto en tus manos.
                </div>
              </div>

              <div className="aya-sec-item">
                <div className="aya-sec-icon">👥</div>
                <div>
                  <strong>Reúnanse en un lugar público y concurrido</strong>
                  Acuerda siempre el encuentro en lugares públicos (plazas principales, supermercados, centros comerciales o locales concurridos). Evita lugares desolados o domicilios privados desconocidos.
                </div>
              </div>

              <div className="aya-sec-item">
                <div className="aya-sec-icon">🔍</div>
                <div>
                  <strong>Revisa el producto minuciosamente</strong>
                  Comprueba el funcionamiento, estado estético, accesorios, documentos de propiedad y autenticidad del artículo antes de entregar el pago.
                </div>
              </div>

              <div className="aya-sec-item">
                <div className="aya-sec-icon">💵</div>
                <div>
                  <strong>Precaución con el dinero en efectivo</strong>
                  Evita transportar altas sumas de dinero en efectivo. Si es posible, realiza el pago mediante QR Simple en el momento exacto de recibir el producto acordado.
                </div>
              </div>
            </div>

            <div className="aya-security-actions">
              <button
                type="button"
                className="aya-btn-sec-cancel"
                onClick={() => setModalSeguridadWsp(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="aya-btn-sec-continue"
                id="aya-btn-confirm-wsp"
                onClick={confirmarIrAWhatsApp}
              >
                <span>💬</span> Entendido, ir a WhatsApp →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
         MODAL DE DENUNCIA DE ANUNCIO
      ══════════════════════════════════════════════════ */}
      {modalDenuncia && (
        <div className="aya-overlay" onClick={() => !enviandoDenuncia && setModalDenuncia(false)}>
          <div className="aya-denuncia-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2><span>🚩</span> Denunciar publicación</h2>
              <button className="aya-modal-close" onClick={() => !enviandoDenuncia && setModalDenuncia(false)}>✕</button>
            </div>
            <p style={{ fontSize: '.84rem', color: 'var(--ya-muted)', marginBottom: 18 }}>
              Tu reporte es anónimo y confidencial. Nos ayuda a proteger la comunidad de AnunciosYA en toda Bolivia.
            </p>

            <form onSubmit={handleEnviarDenuncia}>
              <div className="aya-form-group">
                <label>Motivo principal del reporte *</label>
                <select
                  value={motivoDenuncia}
                  onChange={e => setMotivoDenuncia(e.target.value)}
                  required
                >
                  <option value="estafa">⚠️ Posible estafa, fraude o pago sospechoso</option>
                  <option value="precio_falso">💰 Precio engañoso o irreal</option>
                  <option value="producto_ilegal">🚫 Artículo o sustancia prohibida / ilícita</option>
                  <option value="datos_falsos">📞 Datos de contacto falsos o engañosos</option>
                  <option value="spam">🔁 Anuncio repetido o spam masivo</option>
                  <option value="otro">❓ Otro motivo no especificado</option>
                </select>
              </div>

              <div className="aya-form-group">
                <label>Detalles adicionales (opcional)</label>
                <textarea
                  placeholder="Explica brevemente por qué consideras que esta publicación infringe las normas..."
                  value={comentarioDenuncia}
                  onChange={e => setComentarioDenuncia(e.target.value)}
                  style={{ minHeight: 80 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
                <button
                  type="button"
                  className="aya-btn-cancel"
                  onClick={() => setModalDenuncia(false)}
                  disabled={enviandoDenuncia}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="aya-btn-publish"
                  style={{ background: '#dc2626' }}
                  disabled={enviandoDenuncia}
                >
                  {enviandoDenuncia ? '⏳ Enviando reporte...' : '🚩 Enviar Denuncia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
         MODAL LEGAL: TÉRMINOS, POLÍTICAS Y NORMAS
      ══════════════════════════════════════════════════ */}
      {modalLegal && (
        <div className="aya-overlay" onClick={() => setModalLegal(null)}>
          <div className="aya-legal-modal" onClick={e => e.stopPropagation()}>
            <div className="aya-legal-head">
              <h2>⚖️ Información Legal y Normativas</h2>
              <button className="aya-modal-close" onClick={() => setModalLegal(null)}>✕</button>
            </div>

            {/* Pestañas legales */}
            <div className="aya-legal-tabs">
              <button
                className={`aya-legal-tab-btn${modalLegal === 'terminos' ? ' active' : ''}`}
                onClick={() => setModalLegal('terminos')}
              >
                📄 Términos y Condiciones
              </button>
              <button
                className={`aya-legal-tab-btn${modalLegal === 'privacidad' ? ' active' : ''}`}
                onClick={() => setModalLegal('privacidad')}
              >
                🔒 Política de Privacidad
              </button>
              <button
                className={`aya-legal-tab-btn${modalLegal === 'normas' ? ' active' : ''}`}
                onClick={() => setModalLegal('normas')}
              >
                🛡️ Normas de la Comunidad
              </button>
              <button
                className={`aya-legal-tab-btn${modalLegal === 'comoPublicar' ? ' active' : ''}`}
                onClick={() => setModalLegal('comoPublicar')}
              >
                📖 Guía de Publicación
              </button>
            </div>

            <div className="aya-legal-body">
              {modalLegal === 'terminos' && (
                <>
                  <h3>1. Aceptación de los Términos</h3>
                  <p>
                    Al utilizar o publicar anuncios en <strong>AnunciosYA Bolivia</strong>, el usuario acepta de manera íntegra y sin reservas los presentes Términos y Condiciones de Uso. La plataforma actúa exclusivamente como un canal digital de contacto y clasificación publicitaria entre particulares y comercios independientes en el Estado Plurinacional de Bolivia.
                  </p>

                  <h3>2. Responsabilidad de las Transacciones</h3>
                  <p>
                    AnunciosYA no interviene en las negociaciones directas, acuerdos de precio, entrega física ni garantías legales de los bienes o servicios ofertados. Cada compraventa es responsabilidad estricta y exclusiva del comprador y el vendedor. Recomendamos siempre acordar encuentros en lugares públicos concurridos y verificar físicamente el estado del producto antes de entregar dinero.
                  </p>

                  <h3>3. Obligaciones del Anunciante</h3>
                  <p>
                    El usuario que publica declara contar con el derecho legítimo para comercializar el artículo u ofrecer el servicio, proporcionando datos fidedignos, precios reales en moneda nacional (Bolivianos - Bs.) y descripciones precisas sin inducir al error o engaño.
                  </p>

                  <h3>4. Tarifas y Vigencia</h3>
                  <p>
                    El costo base de publicación activa es de Bs 5.00 e incluye 6 días de vigencia continua. El usuario puede extender opcionalmente la duración a razón de Bs 0.50 por cada día adicional y destacar el título de su anuncio por Bs 1.00 adicional. Los pagos se procesan de forma inmediata mediante códigos QR válidos en el sistema financiero boliviano.
                  </p>
                </>
              )}

              {modalLegal === 'privacidad' && (
                <>
                  <h3>1. Protección de Datos y Privacidad del Vendedor</h3>
                  <p>
                    En <strong>AnunciosYA</strong> valoramos tu privacidad. Conforme a las mejores prácticas y principios de protección de datos personales en Bolivia:
                  </p>
                  <ul>
                    <li><strong>Privacidad de identidad:</strong> En los anuncios públicos y tarjetas del catálogo, se muestra <em>únicamente tu primer nombre de pila</em>. Tus apellidos permanecen privados en tu perfil interno de usuario.</li>
                    <li><strong>Número de contacto:</strong> El teléfono celular o WhatsApp que registras se utilizará exclusivamente para permitir que los compradores interesados te contacten directamente respecto a tus publicaciones.</li>
                    <li><strong>No comercialización:</strong> Jamás vendemos, alquilamos ni transferimos tus datos personales a empresas de publicidad ni a terceras partes.</li>
                  </ul>

                  <h3>2. Autenticación y Credenciales</h3>
                  <p>
                    Las contraseñas se almacenan mediante encriptación criptográfica unidireccional (bcrypt hash). En los accesos con Google OAuth, no almacenamos tus contraseñas de Google; únicamente verificamos tu identidad segura mediante tokens oficiales autorizados.
                  </p>

                  <h3>3. Derechos del Usuario</h3>
                  <p>
                    Puedes modificar o actualizar tu nombre, apellidos, teléfono y ubicación en cualquier momento desde la sección <strong>"Mi Perfil"</strong>, así como solicitar la eliminación de tu cuenta o de tus anuncios en cualquier momento.
                  </p>
                </>
              )}

              {modalLegal === 'normas' && (
                <>
                  <h3>🛡️ Normas de Convivencia y Publicación Segura</h3>
                  <p>
                    Para garantizar una experiencia segura, limpia y confiable para toda la población en Bolivia, queda estrictamente prohibida la publicación de:
                  </p>
                  <ul>
                    <li>🚫 Armas de fuego, municiones, explosivos o fuegos pirotécnicos no regulados.</li>
                    <li>🚫 Medicamentos de prescripción médica controlada, sustancias ilícitas o estupefacientes.</li>
                    <li>🚫 Documentos de identidad falsificados, títulos académicos apócrifos o certificados fraudulentos.</li>
                    <li>🚫 Esquemas piramidales, ofertas de inversión milagrosa o captación ilegal de fondos.</li>
                    <li>🚫 Contenido para adultos explícito, servicios sexuales o material que vulnere la dignidad humana.</li>
                    <li>🚫 Artículos robados o de procedencia ilícita comprobable.</li>
                  </ul>
                  <p>
                    Las publicaciones que infrinjan estas normas serán dadas de baja de inmediato y la cuenta asociada podrá ser suspendida permanentemente. Los usuarios pueden utilizar en todo momento el botón <strong>"🚩 Denunciar este anuncio"</strong> para reportar irregularidades.
                  </p>
                </>
              )}

              {modalLegal === 'comoPublicar' && (
                <>
                  <h3>📖 Cómo Publicar tu Anuncio Paso a Paso</h3>
                  <p>Publicar en AnunciosYA es rápido, seguro y accesible:</p>
                  <ul>
                    <li><strong>Paso 1 - Tus Datos:</strong> Valida tu nombre de pila, apellidos y tu número de WhatsApp boliviano (+591) para que los clientes puedan llamarte o escribirte.</li>
                    <li><strong>Paso 2 - Tu Anuncio:</strong> Coloca un título claro, selecciona la categoría correcta, define tu precio en Bs., describe las características principales y agrega la dirección o zona de entrega. Puedes subir hasta 4 fotos opcionales o publicar sin imágenes.</li>
                    <li><strong>Paso 3 - Duración y Pago QR:</strong> Elige los días de vigencia (6 días base incluidos) y si deseas destacar tu título con un color llamativo. Escanea el código QR desde tu app bancaria y confirma para ver tu anuncio en vivo inmediatamente.</li>
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
         MODAL: REGISTRO / EDICIÓN DE TIENDA
      ══════════════════════════════════════════════════ */}
      {modalRegistroTienda && (
        <div className="aya-overlay" onClick={() => !guardandoTienda && setModalRegistroTienda(false)}>
          <div className="aya-tienda-modal" onClick={e => e.stopPropagation()}>
            <div className="aya-wizard-header">
              <h2><i className="fa-solid fa-store" /> {miTienda?.id ? 'Editar Tienda' : 'Registrar Mi Tienda'}</h2>
              <button className="aya-modal-close" onClick={() => !guardandoTienda && setModalRegistroTienda(false)}>✕</button>
            </div>
            <form className="aya-tienda-form" onSubmit={handleGuardarTienda}>
              <div className="aya-tienda-form-grid">
                <div className="aya-form-group">
                  <label>🏪 Nombre de la Tienda *</label>
                  <input
                    type="text"
                    value={formTienda.nombre_tienda}
                    onChange={e => setFormTienda(p => ({ ...p, nombre_tienda: e.target.value }))}
                    placeholder="Ej: Ferretería El Progreso"
                    required
                  />
                </div>
                <div className="aya-form-group">
                  <label>👤 Nombre del Propietario *</label>
                  <input
                    type="text"
                    value={formTienda.nombre_propietario}
                    onChange={e => setFormTienda(p => ({ ...p, nombre_propietario: e.target.value }))}
                    placeholder="Ej: Juan Pérez"
                    required
                  />
                </div>
                <div className="aya-form-group aya-form-full">
                  <label>📝 Descripción</label>
                  <textarea
                    value={formTienda.descripcion}
                    onChange={e => setFormTienda(p => ({ ...p, descripcion: e.target.value }))}
                    placeholder="Describe brevemente tu negocio..."
                    rows={3}
                  />
                </div>
                <div className="aya-form-group">
                  <label>📍 Departamento</label>
                  <select
                    value={formTienda.ubicacion}
                    onChange={e => setFormTienda(p => ({ ...p, ubicacion: e.target.value }))}
                  >
                    {['Cochabamba','La Paz','Santa Cruz','Oruro','Potosí','Chuquisaca','Tarija','Beni','Pando'].map(d =>
                      <option key={d} value={d}>{d}</option>
                    )}
                  </select>
                </div>
                <div className="aya-form-group">
                  <label>🏠 Dirección</label>
                  <input
                    type="text"
                    value={formTienda.direccion}
                    onChange={e => setFormTienda(p => ({ ...p, direccion: e.target.value }))}
                    placeholder="Calle, zona o referencia"
                  />
                </div>
                <div className="aya-form-group">
                  <label>📞 Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    value={formTienda.telefono}
                    onChange={e => setFormTienda(p => ({ ...p, telefono: e.target.value }))}
                    placeholder="Ej: 77412345"
                  />
                </div>
                <div className="aya-form-group">
                  <label>✉️ Email</label>
                  <input
                    type="email"
                    value={formTienda.email}
                    onChange={e => setFormTienda(p => ({ ...p, email: e.target.value }))}
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <div className="aya-form-group">
                  <label>🏷️ Categoría Principal</label>
                  <select
                    value={formTienda.categoria_principal}
                    onChange={e => setFormTienda(p => ({ ...p, categoria_principal: e.target.value }))}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Ferretería">Ferretería</option>
                    <option value="Electrónica">Electrónica</option>
                    <option value="Ropa y Moda">Ropa y Moda</option>
                    <option value="Alimentos">Alimentos</option>
                    <option value="Hogar y Decoración">Hogar y Decoración</option>
                    <option value="Salud y Belleza">Salud y Belleza</option>
                    <option value="Deportes">Deportes</option>
                    <option value="Automotriz">Automotriz</option>
                    <option value="Servicios">Servicios</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div className="aya-form-group aya-form-full">
                  <label>🖼️ Logo (sube una imagen)</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="aya-input-file"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const b64 = await comprimirImagenTienda(file, 400, 0.8);
                        setFormTienda(p => ({ ...p, logo_url: b64 }));
                      }
                    }}
                  />
                  {formTienda.logo_url && (
                    <img src={formTienda.logo_url} alt="Vista previa logo" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="aya-btn-step-back" onClick={() => setModalRegistroTienda(false)} disabled={guardandoTienda}>
                  Cancelar
                </button>
                <button type="submit" className="aya-btn-pay-qr" disabled={guardandoTienda}>
                  {guardandoTienda ? '⏳ Guardando...' : <><i className="fa-solid fa-floppy-disk" /> {miTienda?.id ? 'Actualizar Tienda' : 'Crear Tienda'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
         MODAL: AGREGAR / EDITAR PRODUCTO
      ══════════════════════════════════════════════════ */}
      {modalProducto && (
        <div className="aya-overlay" onClick={() => !guardandoProducto && setModalProducto(false)}>
          <div className="aya-tienda-modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="aya-wizard-header">
              <h2><i className="fa-solid fa-box-open" /> {productoEdit ? 'Editar Producto' : 'Agregar Producto'}</h2>
              <button className="aya-modal-close" onClick={() => !guardandoProducto && setModalProducto(false)}>✕</button>
            </div>
            <form className="aya-tienda-form" onSubmit={handleGuardarProducto}>
              <div className="aya-tienda-form-grid">
                <div className="aya-form-group aya-form-full">
                  <label>📦 Nombre del Producto *</label>
                  <input
                    type="text"
                    value={formProducto.nombre}
                    onChange={e => setFormProducto(p => ({ ...p, nombre: e.target.value }))}
                    placeholder="Ej: Taladro Percutor 700W"
                    required
                  />
                </div>
                <div className="aya-form-group aya-form-full">
                  <label>📝 Descripción</label>
                  <textarea
                    value={formProducto.descripcion}
                    onChange={e => setFormProducto(p => ({ ...p, descripcion: e.target.value }))}
                    placeholder="Características, colores, tallas..."
                    rows={3}
                  />
                </div>
                <div className="aya-form-group">
                  <label>🏷️ Categoría</label>
                  <select
                    value={formProducto.categoria}
                    onChange={e => setFormProducto(p => ({ ...p, categoria: e.target.value }))}
                  >
                    <option value="otros">Otros</option>
                    <option value="herramientas">Herramientas</option>
                    <option value="electronica">Electrónica</option>
                    <option value="ropa">Ropa</option>
                    <option value="alimentos">Alimentos</option>
                    <option value="hogar">Hogar</option>
                    <option value="salud">Salud</option>
                    <option value="deportes">Deportes</option>
                    <option value="automotriz">Automotriz</option>
                  </select>
                </div>
                <div className="aya-form-group">
                  <label>💲 Precio (Bs.) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formProducto.precio}
                    onChange={e => setFormProducto(p => ({ ...p, precio: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="aya-form-group">
                  <label>📊 Stock disponible</label>
                  <input
                    type="number"
                    min="0"
                    value={formProducto.cantidad_disponible}
                    onChange={e => setFormProducto(p => ({ ...p, cantidad_disponible: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="aya-form-group aya-form-full">
                  <label>🖼️ Imagen del Producto</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="aya-input-file"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const b64 = await comprimirImagenTienda(file, 600, 0.75);
                        setFormProducto(p => ({ ...p, imagen_url: b64 }));
                      }
                    }}
                  />
                  {formProducto.imagen_url && (
                    <img src={formProducto.imagen_url} alt="Vista previa" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="aya-btn-step-back" onClick={() => setModalProducto(false)} disabled={guardandoProducto}>
                  Cancelar
                </button>
                <button type="submit" className="aya-btn-pay-qr" disabled={guardandoProducto}>
                  {guardandoProducto ? '⏳ Guardando...' : <><i className="fa-solid fa-floppy-disk" /> {productoEdit ? 'Actualizar' : 'Agregar Producto'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast informativo */}
      {toast && <div className="aya-toast" id="aya-toast">{toast}</div>}

    </div>
  );
}
