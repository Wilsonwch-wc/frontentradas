import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef, useMemo } from 'react';
import { calcularViewportPlano, calcularTamanoSvgPlano, escenarioVisibleEnViewport } from '../utils/planoCompra.js';
import {
  esMesaSoloVentaCompleta,
  calcularPrecioMesaCompleta,
  calcularPrecioSillaEnMesa,
} from '../utils/mesaPrecios.js';
import { etiquetaMesa } from '../utils/etiquetaMesa.js';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { getApiBase, getServerBase } from '../api/base';
import api from '../api/axios';
import ModalTipoPago from '../components/ModalTipoPago';
import './Compra.css';

const serverBase = getServerBase();
const apiBase = getApiBase();

const Compra = () => {
  const PLANO_COLORS = {
    // Fondo “cálido” (no gris) + borde suave
    sheetFill: '#fff7ed',
    sheetStroke: '#cbd5e1',
    stageFill: '#7c2d12',
    stageStroke: '#3f1d0b',
    stageText: '#ffffff',
    // Áreas bien marcadas
    areaStroke: '#1f2937',
    areaStrokeInner: 'rgba(255,255,255,0.55)',
    areaLabelBg: 'rgba(255, 255, 255, 0.92)',
    areaLabelStroke: '#94a3b8',
    // Mesas: madera + contraste
    mesaFill: '#8b5a2b',
    mesaStroke: '#3f2a14',
    mesaText: '#fde68a',
    // Asientos: defaults por categoría
    seatFillDefault: '#3b82f6',        // asientos normales
    mesaChairFillDefault: '#22c55e',   // sillas de mesa
    personaFillDefault: '#a855f7',     // personas (P...)
    seatStroke: '#0f172a',
    occupiedFill: '#ef4444',
    occupiedStroke: '#991b1b',
    selectedStroke: '#fbbf24'
  };

  const hexToRgba = (hex, alpha = 1) => {
    if (!hex || typeof hex !== 'string') return `rgba(203,213,225,${alpha})`;
    const h = hex.replace('#', '').trim();
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    if (full.length !== 6) return `rgba(203,213,225,${alpha})`;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user, isAdmin, canSellWithVerification, canUseAdminSaleOptions } = useAuth();
  const { showAlert } = useAlert();
  const [evento, setEvento] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: ''
  });

  // Estados para eventos especiales
  const [selecciones, setSelecciones] = useState([]); // [{type: 'asiento', id, tipo_precio_id, precio, nombre}]
  const [cantidad, setCantidad] = useState(1); // Para eventos generales (precio único)
  const [cantidadesPorTipo, setCantidadesPorTipo] = useState({}); // Para general con múltiples precios: { tipo_precio_id: cantidad }
  const [asientosOcupados, setAsientosOcupados] = useState([]); // IDs de asientos ocupados/confirmados
  const [mesasOcupadas, setMesasOcupadas] = useState([]); // IDs de mesas ocupadas/confirmadas
  const [enviando, setEnviando] = useState(false); // Estado para prevenir doble envío
  const [esRegaloAdmin, setEsRegaloAdmin] = useState(false);
  const [esOfertaAdmin, setEsOfertaAdmin] = useState(false);
  const [precioEspecial, setPrecioEspecial] = useState('');
  const [codigoCupon, setCodigoCupon] = useState('');
  const [cuponValidado, setCuponValidado] = useState(null);
  const [validandoCupon, setValidandoCupon] = useState(false);
  const [compraRecienCreada, setCompraRecienCreada] = useState(null);
  const [showModalVerificarPago, setShowModalVerificarPago] = useState(false);
  const [compraConfirmada, setCompraConfirmada] = useState(null);
  const [confirmandoPago, setConfirmandoPago] = useState(false);
  const [enviandoBoleto, setEnviandoBoleto] = useState(false);
  const [descargandoPDF, setDescargandoPDF] = useState(false);
  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  const escalaRef = useRef({ sx: 1, sy: 1, ox: 0, oy: 0, minX: 0, minY: 0, worldW: 1000, worldH: 1000 });
  const compraRealizadaRef = useRef(null);
  const [mostrarNumerosAsientos, setMostrarNumerosAsientos] = useState(true);
  const [zonaSeleccionadaId, setZonaSeleccionadaId] = useState('');
  const [cantidadJuntos, setCantidadJuntos] = useState(2);
  const [filtroTipoPrecioId, setFiltroTipoPrecioId] = useState('');
  // Plano siempre en SVG (sin toggle visible).
  const usarSvgPlano = true;
  const [cursorPlano, setCursorPlano] = useState('pointer');
  const eventoCompletoRef = useRef(null);

  const puedeOpcionesVentaAdmin = !!(canUseAdminSaleOptions && canUseAdminSaleOptions());

  useEffect(() => {
    if (!puedeOpcionesVentaAdmin && (esRegaloAdmin || esOfertaAdmin || (precioEspecial || '').trim() !== '')) {
      setEsRegaloAdmin(false);
      setEsOfertaAdmin(false);
      setPrecioEspecial('');
    }
  }, [puedeOpcionesVentaAdmin]);

  useEffect(() => {
    // Verificar autenticación
    if (!isAuthenticated()) {
      navigate('/login', { state: { from: `/compra/${id}` } });
      return;
    }

    // Cargar evento desde la API
    cargarEvento();
  }, [id, isAuthenticated, navigate]);

  const viewportPlano = useMemo(() => {
    if (!evento) return { minX: 0, minY: 0, worldW: 1000, worldH: 600 };
    return calcularViewportPlano(evento, zonaSeleccionadaId);
  }, [evento, zonaSeleccionadaId]);

  const tamanoSvgPlano = useMemo(
    () => calcularTamanoSvgPlano(viewportPlano, zonaSeleccionadaId),
    [viewportPlano, zonaSeleccionadaId]
  );

  const nombreZonaSeleccionada = useMemo(() => {
    if (!zonaSeleccionadaId || !evento?.areas) return '';
    const a = evento.areas.find((ar) => String(ar.id) === String(zonaSeleccionadaId));
    return a?.nombre || '';
  }, [evento, zonaSeleccionadaId]);

  useEffect(() => {
    escalaRef.current = { ...escalaRef.current, ...viewportPlano };
  }, [viewportPlano]);

  useEffect(() => {
    if (evento && evento.tipo_evento === 'especial') {
      if (canvasRef.current) dibujarCanvas();
    }
  }, [evento, selecciones, asientosOcupados, mesasOcupadas, mostrarNumerosAsientos, zonaSeleccionadaId, filtroTipoPrecioId, viewportPlano]);

  // Carga progresiva por zona: cuando se selecciona una zona, cargar solo asientos/mesas de esa zona
  useEffect(() => {
    if (!evento || evento.tipo_evento !== 'especial' || !eventoCompletoRef.current) return;

    if (!zonaSeleccionadaId) {
      setEvento(prev => prev ? {
        ...prev,
        asientos: [...(eventoCompletoRef.current.asientos || [])],
        mesas: [...(eventoCompletoRef.current.mesas || [])]
      } : prev);
      return;
    }

    const cargarPlano = async () => {
      try {
        const res = await fetch(`${apiBase}/eventos-public/${id}/plano?area_id=${zonaSeleccionadaId}`);
        const data = await res.json();
        if (data.success && data.data) {
          const asientos = (data.data.asientos || []).map(a => ({ ...a, x: a.posicion_x, y: a.posicion_y }));
          const mesas = (data.data.mesas || []).map(m => ({ ...m, width: m.ancho || 40, height: m.alto || 40 }));
          setEvento(prev => prev ? { ...prev, asientos, mesas } : prev);
        }
      } catch (e) {
        console.error('Error al cargar plano por zona:', e);
      }
    };
    cargarPlano();
  }, [zonaSeleccionadaId, id]);

  // Al confirmar pago, hacer scroll al bloque "Compra realizada" para enviar boletos rápido
  useEffect(() => {
    if (compraConfirmada && compraRealizadaRef.current) {
      const t = setTimeout(() => {
        compraRealizadaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [compraConfirmada]);

  const cargarEvento = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBase}/eventos-public/${id}`);
      const data = await response.json();
      
      if (data.success) {
        const eventoData = data.data;
        // Formatear imagen
        if (eventoData.imagen && !eventoData.imagen.startsWith('http')) {
          eventoData.imagen = `${serverBase}${eventoData.imagen}`;
        }
        // Formatear QR de pago
        if (eventoData.qr_pago_url && !eventoData.qr_pago_url.startsWith('http')) {
          eventoData.qr_pago_url = `${serverBase}${eventoData.qr_pago_url}`;
        }
        // Formatear precio
        eventoData.precio = parseFloat(eventoData.precio);
        // Formatear tipos de precio
        if (eventoData.tipos_precio && Array.isArray(eventoData.tipos_precio)) {
          eventoData.tipos_precio = eventoData.tipos_precio.map(tp => ({
            ...tp,
            precio: parseFloat(tp.precio)
          }));
        }
        // Formatear asientos (mantener posicion_x y posicion_y)
        if (eventoData.asientos && Array.isArray(eventoData.asientos)) {
          eventoData.asientos = eventoData.asientos.map(a => ({
            ...a,
            x: a.posicion_x,
            y: a.posicion_y
          }));
        }
        // Formatear mesas (agregar width y height si no existen)
        if (eventoData.mesas && Array.isArray(eventoData.mesas)) {
          eventoData.mesas = eventoData.mesas.map(m => ({
            ...m,
            width: m.ancho || m.width || 40,
            height: m.alto || m.height || 40
          }));
        }
        // Verificar si el evento está en estado "proximamente", excepto para admin/vendedor
        if (eventoData.estado === 'proximamente' && !isAdmin && !canUseAdminSaleOptions) {
          showAlert('Este evento está marcado como "Próximamente". Las entradas aún no están disponibles para la venta.', {
            type: 'warning',
            title: 'Evento Próximamente'
          }).then(() => {
            // Redirigir al detalle del evento
            const slug = eventoData.slug || eventoData.titulo?.toLowerCase().replace(/\s+/g, '-');
            navigate(`/evento/${slug}`);
          });
          return;
        }
        
        setEvento(eventoData);
        if (eventoData.tipo_evento === 'especial') {
          eventoCompletoRef.current = { ...eventoData, asientos: [...(eventoData.asientos || [])], mesas: [...(eventoData.mesas || [])] };
        }

        // Inicializar cantidades por tipo para evento general con múltiples precios (VIP, General, Gradería)
        if (eventoData.tipo_evento === 'general' && eventoData.tipos_precio?.length > 0) {
          const inicial = {};
          eventoData.tipos_precio.forEach(tp => { inicial[tp.id] = 0; });
          setCantidadesPorTipo(inicial);
        }
        
        // Cargar asientos ocupados (confirmados) para este evento
        if (eventoData.tipo_evento === 'especial') {
          cargarAsientosOcupados(id);
        }
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Error al cargar evento:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const cargarAsientosOcupados = async (eventoId) => {
    try {
      // Obtener asientos ocupados directamente desde el endpoint optimizado
      const response = await api.get(`/compras/ocupados/${eventoId}`);
      
      if (response.data.success) {
        setAsientosOcupados(response.data.data.asientos || []);
        setMesasOcupadas(response.data.data.mesas || []);
      }
    } catch (error) {
      console.error('Error al cargar asientos ocupados:', error);
      // No es crítico, continuar sin esta información
    }
  };

  // Rellenar datos del usuario cuando esté disponible
  useEffect(() => {
    if (user && evento) {
      setFormData({
        nombre: user.nombre_completo || user.nombre || '',
        email: user.correo || user.email || '',
        telefono: user.telefono || ''
      });
    }
  }, [user, evento]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Ajusta sillas de mesa acercándolas ligeramente a la mesa
  const crearMapaMesas = () => {
    const mapa = new Map();
    evento?.mesas?.forEach(mesa => mapa.set(mesa.id, mesa));
    return mapa;
  };

  const puntoDentroDeArea = (x, y, area) => {
    if (!area || area.posicion_x == null || area.posicion_y == null || area.ancho == null || area.alto == null) {
      return false;
    }
    return (
      x >= area.posicion_x &&
      x <= area.posicion_x + area.ancho &&
      y >= area.posicion_y &&
      y <= area.posicion_y + area.alto
    );
  };

  const estaEnZonaSeleccionada = (x, y) => {
    if (!zonaSeleccionadaId || !evento || !Array.isArray(evento.areas) || evento.areas.length === 0) {
      return true; // Sin filtro, mostrar todo
    }
    const areaSeleccionada = evento.areas.find(
      (area) => String(area.id) === String(zonaSeleccionadaId)
    );
    if (!areaSeleccionada) {
      return true;
    }
    return puntoDentroDeArea(x, y, areaSeleccionada);
  };

  const cumpleFiltroTipoPrecio = (tipoPrecioId) => {
    if (!filtroTipoPrecioId) return true;
    return String(tipoPrecioId) === String(filtroTipoPrecioId);
  };

  const obtenerPosicionAsiento = (asiento, mesasMap) => {
    const baseX = asiento.x ?? asiento.posicion_x;
    const baseY = asiento.y ?? asiento.posicion_y;
    if (!asiento.mesa_id || !mesasMap.has(asiento.mesa_id) || baseX === null || baseY === null) {
      return { x: baseX, y: baseY };
    }

    const mesa = mesasMap.get(asiento.mesa_id);
    const mesaX = mesa.posicion_x ?? 0;
    const mesaY = mesa.posicion_y ?? 0;
    const mesaWidth = mesa.ancho || 30;
    const mesaHeight = mesa.alto || 30;
    const centroX = mesaX + mesaWidth / 2;
    const centroY = mesaY + mesaHeight / 2;

    const dx = baseX - centroX;
    const dy = baseY - centroY;
    const distancia = Math.sqrt(dx * dx + dy * dy) || 1;

    const factorAcercar = 1.0;
    const ratio = (distancia * factorAcercar) / distancia;

    return {
      x: centroX + dx * ratio,
      y: centroY + dy * ratio
    };
  };

  const construirSeleccionAsiento = (asiento) => {
    const tipoPrecio = evento.tipos_precio?.find(tp => tp.id === asiento.tipo_precio_id);
    let nombreArea = asiento.area_nombre;

    if (!nombreArea && evento.areas && Array.isArray(evento.areas) && evento.areas.length > 0) {
      const asientoX = asiento.x || asiento.posicion_x;
      const asientoY = asiento.y || asiento.posicion_y;
      if (asientoX !== null && asientoY !== null) {
        const areaEncontrada = evento.areas.find(area => {
          if (!area.posicion_x || !area.posicion_y || !area.ancho || !area.alto) return false;
          return asientoX >= area.posicion_x &&
                 asientoX <= (area.posicion_x + area.ancho) &&
                 asientoY >= area.posicion_y &&
                 asientoY <= (area.posicion_y + area.alto);
        });
        if (areaEncontrada && areaEncontrada.nombre) {
          nombreArea = areaEncontrada.nombre;
        }
      }
    }

    let textoMesa = '';
    if (asiento.mesa_id) {
      const mesaDelAsiento = evento.mesas?.find(m => m.id === asiento.mesa_id);
      if (mesaDelAsiento) {
        textoMesa = ` de Mesa ${etiquetaMesa(mesaDelAsiento)}`;
      }
    }

    const textoArea = nombreArea ? ` - ${nombreArea}` : '';
    return {
      type: 'asiento',
      id: asiento.id,
      tipo_precio_id: asiento.tipo_precio_id,
      precio: tipoPrecio?.precio || 0,
      nombre: `Asiento ${asiento.codigo_asiento || asiento.numero_asiento}${textoMesa}${textoArea}`,
      area_nombre: nombreArea || null
    };
  };

  const dibujarCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !evento) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const mesasMap = crearMapaMesas();

    // Limpiar canvas
    ctx.clearRect(0, 0, width, height);

    const { minX, minY, worldW, worldH } = viewportPlano;

    const sx = (width - 20) / worldW;
    const sy = (height - 20) / worldH;
    const s = Math.min(sx, sy);
    const contentW = worldW * s;
    const contentH = worldH * s;
    const ox = 10 + (width - 20 - contentW) / 2 - minX * s;
    const oy = 10 + (height - 20 - contentH) / 2 - minY * s;
    escalaRef.current = { sx: s, sy: s, ox, oy, minX, minY, worldW, worldH };

    // Fondo del plano
    ctx.fillStyle = PLANO_COLORS.sheetFill;
    ctx.strokeStyle = PLANO_COLORS.sheetStroke;
    ctx.lineWidth = 2;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);

    if (evento.forma_espacio) {
      switch (evento.forma_espacio) {
        case 'rectangulo':
        case 'cuadrado':
          ctx.fillRect(minX, minY, worldW, worldH);
          ctx.strokeRect(minX, minY, worldW, worldH);
          break;
        case 'triangulo':
          ctx.beginPath();
          ctx.moveTo(minX + worldW / 2, minY + 10);
          ctx.lineTo(minX + 10, minY + worldH - 10);
          ctx.lineTo(minX + worldW - 10, minY + worldH - 10);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        case 'circulo':
          const radius = Math.min(worldW, worldH) / 2 - 10;
          ctx.beginPath();
          ctx.arc(minX + worldW / 2, minY + worldH / 2, radius, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
          break;
      }
    } else {
      // Por defecto rectángulo
      ctx.fillRect(minX, minY, worldW, worldH);
      ctx.strokeRect(minX, minY, worldW, worldH);
    }

    // Dibujar escenario (exactamente como en admin)
    if (evento.escenario_x !== null && evento.escenario_y !== null && 
        evento.escenario_width && evento.escenario_height) {
      ctx.fillStyle = PLANO_COLORS.stageFill;
      ctx.fillRect(evento.escenario_x, evento.escenario_y, evento.escenario_width, evento.escenario_height);
      ctx.strokeStyle = PLANO_COLORS.stageStroke;
      ctx.lineWidth = 3;
      ctx.strokeRect(evento.escenario_x, evento.escenario_y, evento.escenario_width, evento.escenario_height);
      ctx.fillStyle = PLANO_COLORS.stageText;
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ESCENARIO', evento.escenario_x + evento.escenario_width / 2, evento.escenario_y + evento.escenario_height / 2);
    }

    // Dibujar áreas (exactamente como en admin)
    if (evento.areas && Array.isArray(evento.areas)) {
      evento.areas.forEach(area => {
        const hayFiltroZona = !!zonaSeleccionadaId;
        const esZonaSeleccionada =
          hayFiltroZona && String(area.id) === String(zonaSeleccionadaId);

        ctx.save();
        // Área: relleno suave (tinte) + borde fuerte para que se note el límite
        const baseArea = area.color || '#cbd5e1';
        const alpha = hayFiltroZona && !esZonaSeleccionada ? 0.08 : 0.18;
        ctx.fillStyle = hexToRgba(baseArea, alpha);
        if (hayFiltroZona && !esZonaSeleccionada) {
          ctx.globalAlpha = 0.15;
        }
        ctx.fillRect(area.posicion_x, area.posicion_y, area.ancho, area.alto);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = PLANO_COLORS.areaStroke;
        ctx.lineWidth = esZonaSeleccionada ? 4 : 3;
        ctx.strokeRect(area.posicion_x, area.posicion_y, area.ancho, area.alto);
        // Borde interior claro (da “relieve”)
        ctx.strokeStyle = PLANO_COLORS.areaStrokeInner;
        ctx.lineWidth = 2;
        ctx.strokeRect(area.posicion_x + 2, area.posicion_y + 2, area.ancho - 4, area.alto - 4);
        
        // Dibujar nombre del área en la parte superior (cabecera) - igual que admin
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const textY = area.posicion_y - 5;
        const textX = area.posicion_x + area.ancho / 2;
        const text = area.nombre.toUpperCase();
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const textHeight = 16;
        
        // Fondo blanco con borde para el texto
        ctx.fillStyle = PLANO_COLORS.areaLabelBg;
        ctx.fillRect(textX - textWidth / 2 - 4, textY - textHeight - 2, textWidth + 8, textHeight + 4);
        ctx.strokeStyle = PLANO_COLORS.areaLabelStroke;
        ctx.lineWidth = 1;
        ctx.strokeRect(textX - textWidth / 2 - 4, textY - textHeight - 2, textWidth + 8, textHeight + 4);
        
        // Dibujar el texto
        ctx.fillStyle = '#0f172a';
        ctx.fillText(text, textX, textY);
        ctx.restore();
      });
    }

    // Dibujar mesas (exactamente como en admin)
    if (evento.mesas && Array.isArray(evento.mesas)) {
      evento.mesas.forEach(mesa => {
        // Verificar si la mesa está ocupada
        const mesaOcupada = mesasOcupadas.includes(mesa.id);
        
        // Usar posicion_x y posicion_y de la base de datos (igual que admin)
        const mesaX = mesa.posicion_x !== null && mesa.posicion_x !== undefined ? mesa.posicion_x : 100;
        const mesaY = mesa.posicion_y !== null && mesa.posicion_y !== undefined ? mesa.posicion_y : 100;
        // En admin se usa width: 30, height: 30, pero deberíamos usar ancho y alto de BD
        const mesaWidth = mesa.ancho || 30;
        const mesaHeight = mesa.alto || 30;

        const centroMesaX = mesaX + mesaWidth / 2;
        const centroMesaY = mesaY + mesaHeight / 2;
        if (!estaEnZonaSeleccionada(centroMesaX, centroMesaY)) return;
        if (!cumpleFiltroTipoPrecio(mesa.tipo_precio_id)) return;
        
        // Verificar si todos los asientos de la mesa están seleccionados
        const asientosMesa = evento.asientos?.filter(a => a.mesa_id === mesa.id) || [];
        const todosSeleccionados = asientosMesa.length > 0 && asientosMesa.every(a => 
          selecciones.some(sel => sel.type === 'asiento' && sel.id === a.id)
        );
        
        // Dibujar la mesa: rojo si está ocupada, marrón si no
        if (mesaOcupada) {
          // Mesa ocupada - color rojo
          ctx.fillStyle = PLANO_COLORS.occupiedFill;
          ctx.fillRect(mesaX, mesaY, mesaWidth, mesaHeight);
          ctx.strokeStyle = PLANO_COLORS.occupiedStroke;
          ctx.lineWidth = 3;
          ctx.strokeRect(mesaX, mesaY, mesaWidth, mesaHeight);
          
          // Dibujar X en la mesa ocupada
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const centroX = mesaX + mesaWidth / 2;
          const centroY = mesaY + mesaHeight / 2;
          const tamX = Math.min(mesaWidth, mesaHeight) * 0.3;
          ctx.moveTo(centroX - tamX, centroY - tamX);
          ctx.lineTo(centroX + tamX, centroY + tamX);
          ctx.moveTo(centroX + tamX, centroY - tamX);
          ctx.lineTo(centroX - tamX, centroY + tamX);
          ctx.stroke();
        } else {
          // Mesa disponible - color marrón normal
          ctx.fillStyle = PLANO_COLORS.mesaFill;
          ctx.fillRect(mesaX, mesaY, mesaWidth, mesaHeight);
          ctx.strokeStyle = todosSeleccionados ? PLANO_COLORS.selectedStroke : PLANO_COLORS.mesaStroke;
          ctx.lineWidth = todosSeleccionados ? 3 : 2;
          ctx.strokeRect(mesaX, mesaY, mesaWidth, mesaHeight);
        }
        
        if (mostrarNumerosAsientos) {
          ctx.fillStyle = PLANO_COLORS.mesaText;
          ctx.font = 'bold 11px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(etiquetaMesa(mesa), mesaX + mesaWidth / 2, mesaY + mesaHeight / 2);
        }
      });
    }

    // Dibujar sillas de mesas (exactamente como en admin)
    if (evento.asientos && Array.isArray(evento.asientos)) {
      const sillasMesas = evento.asientos.filter(a => a.mesa_id);
      sillasMesas.forEach(silla => {
        // Usar posicion_x y posicion_y (igual que admin)
        const { x: sillaX, y: sillaY } = obtenerPosicionAsiento(silla, mesasMap);
        if (sillaX === null || sillaY === null) return;
        if (!estaEnZonaSeleccionada(sillaX, sillaY)) return;
        if (!cumpleFiltroTipoPrecio(silla.tipo_precio_id)) return;
        const tipoPrecio = evento.tipos_precio?.find(tp => tp.id === silla.tipo_precio_id);
        const estaSeleccionada = selecciones.some(sel => sel.type === 'asiento' && sel.id === silla.id);
        const estaOcupada = asientosOcupados.includes(silla.id);
        // Si la mesa está ocupada, todas sus sillas también están ocupadas
        const mesaOcupada = silla.mesa_id && mesasOcupadas.includes(silla.mesa_id);
        const sillaOcupada = estaOcupada || mesaOcupada;
        
        // Color de la silla: rojo si está ocupada (individual o por mesa), color normal si no
        const colorSilla = sillaOcupada
          ? PLANO_COLORS.occupiedFill
          : (tipoPrecio?.color || PLANO_COLORS.mesaChairFillDefault);
        
        // Dibujar silla 8x8 (más pequeña)
        ctx.fillStyle = colorSilla;
        ctx.fillRect(sillaX - 4, sillaY - 4, 8, 8);
        ctx.strokeStyle = estaSeleccionada ? PLANO_COLORS.selectedStroke : (sillaOcupada ? PLANO_COLORS.occupiedStroke : PLANO_COLORS.seatStroke);
        ctx.lineWidth = estaSeleccionada ? 2 : (sillaOcupada ? 2 : 1);
        ctx.strokeRect(sillaX - 4, sillaY - 4, 8, 8);
        
        if (mostrarNumerosAsientos) {
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 9px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          let numeroSilla = silla.codigo_asiento || silla.numero_asiento || '';
          if (numeroSilla.includes('-')) {
            numeroSilla = numeroSilla.split('-')[1];
          }
          ctx.fillText(numeroSilla || '', sillaX, sillaY);
        }
        
        // Si está ocupada (individual o por mesa), dibujar una X
        if (sillaOcupada) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(sillaX - 3, sillaY - 3);
          ctx.lineTo(sillaX + 3, sillaY + 3);
          ctx.moveTo(sillaX + 3, sillaY - 3);
          ctx.lineTo(sillaX - 3, sillaY + 3);
          ctx.stroke();
        }
      });
    }
    
    // Dibujar asientos individuales (cuadrados) - excluir personas
    if (evento.asientos && Array.isArray(evento.asientos)) {
      const asientosSillas = evento.asientos.filter(a => !a.mesa_id && !String(a.numero_asiento || '').startsWith('P'));
      asientosSillas.forEach(asiento => {
        const asientoX = asiento.posicion_x !== null && asiento.posicion_x !== undefined ? asiento.posicion_x : 50;
        const asientoY = asiento.posicion_y !== null && asiento.posicion_y !== undefined ? asiento.posicion_y : 50;
        if (!estaEnZonaSeleccionada(asientoX, asientoY)) return;
        if (!cumpleFiltroTipoPrecio(asiento.tipo_precio_id)) return;
        const tipoPrecio = evento.tipos_precio?.find(tp => tp.id === asiento.tipo_precio_id);
        const estaSeleccionado = selecciones.some(sel => sel.type === 'asiento' && sel.id === asiento.id);
        const estaOcupado = asientosOcupados.includes(asiento.id);
        const colorAsiento = estaOcupado
          ? PLANO_COLORS.occupiedFill
          : (tipoPrecio?.color || PLANO_COLORS.seatFillDefault);
        
        ctx.fillStyle = colorAsiento;
        ctx.fillRect(asientoX - 5, asientoY - 5, 10, 10);
        ctx.strokeStyle = estaSeleccionado ? PLANO_COLORS.selectedStroke : (estaOcupado ? PLANO_COLORS.occupiedStroke : PLANO_COLORS.seatStroke);
        ctx.lineWidth = estaSeleccionado ? 3 : (estaOcupado ? 2 : 1);
        ctx.strokeRect(asientoX - 5, asientoY - 5, 10, 10);
        
        if (mostrarNumerosAsientos) {
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 11px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(asiento.codigo_asiento || asiento.numero_asiento || '', asientoX, asientoY);
        }
        
        if (estaOcupado) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(asientoX - 3, asientoY - 3);
          ctx.lineTo(asientoX + 3, asientoY + 3);
          ctx.moveTo(asientoX + 3, asientoY - 3);
          ctx.lineTo(asientoX - 3, asientoY + 3);
          ctx.stroke();
        }
      });
    }

    // Dibujar personas (espacio pie) como círculos
    if (evento.asientos && Array.isArray(evento.asientos)) {
      const personas = evento.asientos.filter(a => !a.mesa_id && String(a.numero_asiento || '').startsWith('P'));
      personas.forEach(persona => {
        const px = persona.posicion_x !== null && persona.posicion_x !== undefined ? persona.posicion_x : 50;
        const py = persona.posicion_y !== null && persona.posicion_y !== undefined ? persona.posicion_y : 50;
        if (!estaEnZonaSeleccionada(px, py)) return;
        if (!cumpleFiltroTipoPrecio(persona.tipo_precio_id)) return;
        const tipoPrecio = evento.tipos_precio?.find(tp => tp.id === persona.tipo_precio_id);
        const estaSeleccionado = selecciones.some(sel => sel.type === 'asiento' && sel.id === persona.id);
        const estaOcupado = asientosOcupados.includes(persona.id);
        const colorPersona = estaOcupado
          ? PLANO_COLORS.occupiedFill
          : (tipoPrecio?.color || PLANO_COLORS.personaFillDefault);
        const radio = 5;
        
        ctx.fillStyle = colorPersona;
        ctx.beginPath();
        ctx.arc(px, py, radio, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = estaSeleccionado ? PLANO_COLORS.selectedStroke : (estaOcupado ? PLANO_COLORS.occupiedStroke : PLANO_COLORS.seatStroke);
        ctx.lineWidth = estaSeleccionado ? 3 : (estaOcupado ? 2 : 1);
        ctx.stroke();
        
        if (mostrarNumerosAsientos) {
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 11px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(persona.numero_asiento || '', px, py);
        }
        
        if (estaOcupado) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px - 5, py - 5);
          ctx.lineTo(px + 5, py + 5);
          ctx.moveTo(px + 5, py - 5);
          ctx.lineTo(px - 5, py + 5);
          ctx.stroke();
        }
      });
    }

    // Tooltip deshabilitado - el usuario no quiere ver información de mesa y precio
    ctx.restore();
  };

  const seleccionarMejorAsientoDisponible = () => {
    if (!evento || evento.tipo_evento !== 'especial' || !Array.isArray(evento.asientos)) return;

    const asientosDisponibles = evento.asientos
      .filter((asiento) => {
        if (asiento.mesa_id) return false; // Por simplicidad, solo asientos individuales
        if (asientosOcupados.includes(asiento.id)) return false;
        if (asiento.estado && asiento.estado !== 'disponible') return false;
        const yaSeleccionado = selecciones.some((sel) => sel.type === 'asiento' && sel.id === asiento.id);
        if (yaSeleccionado) return false;
        const mesasMap = crearMapaMesas();
        const { x, y } = obtenerPosicionAsiento(asiento, mesasMap);
        if (x == null || y == null) return false;
        if (!estaEnZonaSeleccionada(x, y)) return false;
        if (!cumpleFiltroTipoPrecio(asiento.tipo_precio_id)) return false;
        return true;
      });

    if (asientosDisponibles.length === 0) {
      showAlert('No hay asientos disponibles con los filtros seleccionados.', { type: 'warning' });
      return;
    }

    let mejor = null;
    let mejorDistancia = Infinity;

    let centroX = 0;
    let centroY = 0;
    if (evento.escenario_x != null && evento.escenario_y != null && evento.escenario_width && evento.escenario_height) {
      centroX = evento.escenario_x + evento.escenario_width / 2;
      centroY = evento.escenario_y + evento.escenario_height;
    }

    const mesasMap = crearMapaMesas();
    asientosDisponibles.forEach((asiento) => {
      const { x, y } = obtenerPosicionAsiento(asiento, mesasMap);
      if (x == null || y == null) return;
      const dx = x - centroX;
      const dy = y - centroY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < mejorDistancia) {
        mejorDistancia = dist;
        mejor = asiento;
      }
    });

    if (!mejor) {
      showAlert('No se encontró un asiento adecuado.', { type: 'warning' });
      return;
    }

    const nuevaSeleccion = construirSeleccionAsiento(mejor);
    setSelecciones((prev) => [...prev, nuevaSeleccion]);
  };

  const seleccionarNAsientosJuntos = () => {
    if (!evento || evento.tipo_evento !== 'especial' || !Array.isArray(evento.asientos)) return;
    const n = parseInt(cantidadJuntos, 10) || 0;
    if (n < 2) {
      showAlert('Indica una cantidad de asientos juntos de al menos 2.', { type: 'warning' });
      return;
    }

    const mesasMap = crearMapaMesas();

    // Candidatos (asientos individuales + sillas de mesas) disponibles en la zona/filtros
    const candidatos = evento.asientos
      .filter((asiento) => {
        const numero = String(asiento.numero_asiento || '');
        if (asientosOcupados.includes(asiento.id)) return false;
        if (asiento.estado && asiento.estado !== 'disponible') return false;
        const yaSeleccionado = selecciones.some((sel) => sel.type === 'asiento' && sel.id === asiento.id);
        if (yaSeleccionado) return false;
        // Si es silla de mesa, la mesa no puede estar ocupada completamente
        if (asiento.mesa_id && mesasOcupadas.includes(asiento.mesa_id)) return false;
        const { x, y } = obtenerPosicionAsiento(asiento, mesasMap);
        if (x == null || y == null) return false;
        if (!estaEnZonaSeleccionada(x, y)) return false;
        if (!cumpleFiltroTipoPrecio(asiento.tipo_precio_id)) return false;
        return true;
      })
      .map((a) => ({
        ...a,
        es_persona: String(a.numero_asiento || '').startsWith('P'),
        numero_asiento_num: Number(a.numero_asiento) || 0,
        area_nombre_normalizada: (a.area_nombre || '').toLowerCase(),
        // Guardar posición ya calculada para agrupar por filas
        ...(() => {
          const { x, y } = obtenerPosicionAsiento(a, mesasMap);
          return { x_plano: x, y_plano: y };
        })()
      }));

    // Pools
    const sillasMesas = candidatos.filter((c) => !!c.mesa_id && !c.es_persona);
    const individuales = candidatos.filter((c) => !c.mesa_id && !c.es_persona && !String(c.numero_asiento || '').startsWith('P'));
    const personas = candidatos.filter((c) => !c.mesa_id && c.es_persona);

    const elegirGrupoCompactoEnFilas = (pool) => {
      if (!pool || pool.length < n) return null;
      const TOL_Y = 10; // píxeles
      const filas = [];
      const ordenados = [...pool].sort((a, b) => {
        if (a.area_nombre_normalizada < b.area_nombre_normalizada) return -1;
        if (a.area_nombre_normalizada > b.area_nombre_normalizada) return 1;
        if (a.y_plano !== b.y_plano) return a.y_plano - b.y_plano;
        return a.x_plano - b.x_plano;
      });
      ordenados.forEach((a) => {
        let fila = filas.find((f) => Math.abs(f.yRef - a.y_plano) <= TOL_Y && f.area === a.area_nombre_normalizada);
        if (!fila) {
          fila = { yRef: a.y_plano, area: a.area_nombre_normalizada, asientos: [] };
          filas.push(fila);
        }
        fila.asientos.push(a);
      });
      let mejorGrupo = null;
      let mejorAnchura = Infinity;
      filas.forEach((fila) => {
        const arr = fila.asientos.sort((a, b) => a.x_plano - b.x_plano);
        for (let i = 0; i <= arr.length - n; i++) {
          const ventana = arr.slice(i, i + n);
          const anchura = ventana[ventana.length - 1].x_plano - ventana[0].x_plano;
          if (anchura < mejorAnchura) {
            mejorAnchura = anchura;
            mejorGrupo = ventana;
          }
        }
      });
      return mejorGrupo;
    };

    // 1) Preferir asientos individuales (sin mesa) por filas
    let grupo = elegirGrupoCompactoEnFilas(individuales);

    // 2) Si no hay, intentar con personas (P...) por filas
    if (!grupo) {
      grupo = elegirGrupoCompactoEnFilas(personas);
    }

    // 3) Si no hay, intentar con sillas de una misma mesa (misma mesa_id)
    if (!grupo) {
      const porMesa = new Map();
      sillasMesas.forEach((s) => {
        if (!porMesa.has(s.mesa_id)) porMesa.set(s.mesa_id, []);
        porMesa.get(s.mesa_id).push(s);
      });

      let mejorMesa = null;
      let mejorScore = Infinity;

      // Centro del escenario para preferir mesas más cercanas (opcional)
      let centroEscX = 0;
      let centroEscY = 0;
      if (evento.escenario_x != null && evento.escenario_y != null && evento.escenario_width && evento.escenario_height) {
        centroEscX = evento.escenario_x + evento.escenario_width / 2;
        centroEscY = evento.escenario_y + evento.escenario_height;
      }

      porMesa.forEach((sillas, mesaId) => {
        if (sillas.length < n) return;
        const mesa = (evento.mesas || []).find((m) => String(m.id) === String(mesaId));
        const mx = (mesa?.posicion_x ?? mesa?.x ?? 0) + ((mesa?.ancho ?? mesa?.width ?? 30) / 2);
        const my = (mesa?.posicion_y ?? mesa?.y ?? 0) + ((mesa?.alto ?? mesa?.height ?? 30) / 2);
        const d = Math.hypot(mx - centroEscX, my - centroEscY);
        if (d < mejorScore) {
          mejorScore = d;
          mejorMesa = { mesaId, sillas };
        }
      });

      if (mejorMesa) {
        const sillasOrdenadas = [...mejorMesa.sillas].sort((a, b) => (a.numero_asiento_num || 0) - (b.numero_asiento_num || 0));
        grupo = sillasOrdenadas.slice(0, n);
      }
    }

    if (!grupo || grupo.length < n) {
      showAlert('No hay suficientes asientos/mesas disponibles con los filtros seleccionados.', { type: 'warning' });
      return;
    }

    const nuevasSelecciones = grupo.map((asiento) => construirSeleccionAsiento(asiento));
    setSelecciones((prev) => [...prev, ...nuevasSelecciones]);
  };


  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    const { sx, sy, ox, oy } = escalaRef.current;
    return { x: (px - ox) / sx, y: (py - oy) / sy, clientX: e.clientX, clientY: e.clientY };
  };

  const getSvgWorldPos = (e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const { minX, minY, worldW, worldH } = viewportPlano;
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    return { x: minX + rx * worldW, y: minY + ry * worldH };
  };

  const manejarClickPlano = (x, y, opts = {}) => {
    if (!evento || evento.tipo_evento !== 'especial') return;

    // Primero verificar si se hizo click en una mesa
    if (!opts.ignoreMesas && evento.mesas && Array.isArray(evento.mesas)) {
      for (const mesa of evento.mesas) {
        const mesaX = mesa.posicion_x || 50;
        const mesaY = mesa.posicion_y || 50;
        const mesaWidth = mesa.ancho || mesa.width || 40;
        const mesaHeight = mesa.alto || mesa.height || 40;

        const centroMesaX = mesaX + mesaWidth / 2;
        const centroMesaY = mesaY + mesaHeight / 2;
        if (!estaEnZonaSeleccionada(centroMesaX, centroMesaY)) continue;
        if (!cumpleFiltroTipoPrecio(mesa.tipo_precio_id)) continue;

        // Verificar si el click está dentro del área de la mesa
        if (x >= mesaX && x <= mesaX + mesaWidth &&
            y >= mesaY && y <= mesaY + mesaHeight) {

          // Verificar si la mesa está ocupada
          if (mesasOcupadas.includes(mesa.id)) {
            showAlert('Esta mesa ya está ocupada y no está disponible', { type: 'warning' });
            return;
          }

          const asientosMesa = evento.asientos?.filter(a => a.mesa_id === mesa.id) || [];

          if (asientosMesa.length === 0) {
            const cap = parseInt(mesa.capacidad_sillas, 10) || 0;
            if (cap < 1) return;

            const yaMesaCompleta = selecciones.some(
              (sel) => sel.type === 'mesa_completa' && sel.mesa_id === mesa.id
            );
            if (yaMesaCompleta) {
              setSelecciones((prev) =>
                prev.filter((sel) => sel.type !== 'mesa_completa' || sel.mesa_id !== mesa.id)
              );
              return;
            }

            const precioTotal = calcularPrecioMesaCompleta(mesa, [], evento.tipos_precio);
            const etiqueta = etiquetaMesa(mesa);
            setSelecciones((prev) => [
              ...prev,
              {
                type: 'mesa_completa',
                mesa_id: mesa.id,
                numero_mesa: mesa.numero_mesa,
                codigo_mesa: mesa.codigo_mesa,
                cantidad_sillas: cap,
                precio_total: precioTotal,
                venta_solo_mesa: true,
                nombre: `MESA ${etiqueta}`,
                sillas: `${cap} personas`,
              },
            ]);
            return;
          }

          // Verificar si todos los asientos ya están seleccionados
          const todosSeleccionados = asientosMesa.every(a =>
            selecciones.some(sel => sel.type === 'asiento' && sel.id === a.id)
          );

          const soloMesa = esMesaSoloVentaCompleta(mesa);
          const yaMesaCompleta = selecciones.some(
            (sel) => sel.type === 'mesa_completa' && sel.mesa_id === mesa.id
          );

          if (todosSeleccionados || yaMesaCompleta) {
            const idsAsientosMesa = asientosMesa.map((a) => a.id);
            setSelecciones((prev) =>
              prev
                .filter((sel) => sel.type !== 'mesa_completa' || sel.mesa_id !== mesa.id)
                .filter((sel) => !idsAsientosMesa.includes(sel.id))
            );
          } else {
            const asientosDisponibles = [];
            const nuevasSelecciones = [];

            for (const asiento of asientosMesa) {
              if (asientosOcupados.includes(asiento.id)) continue;
              if (asiento.estado && asiento.estado !== 'disponible') continue;
              if (selecciones.some((sel) => sel.type === 'asiento' && sel.id === asiento.id)) continue;
              if (!cumpleFiltroTipoPrecio(asiento.tipo_precio_id)) continue;

              const precioSilla = calcularPrecioSillaEnMesa(mesa, asiento, evento.tipos_precio);
              if (precioSilla == null) continue;

              asientosDisponibles.push({
                id: asiento.id,
                numero: asiento.codigo_asiento || asiento.numero_asiento,
                precio: precioSilla,
              });

              if (!soloMesa) {
                let nombreArea = asiento.area_nombre;
                if (!nombreArea && evento.areas?.length) {
                  const ax = asiento.x ?? asiento.posicion_x;
                  const ay = asiento.y ?? asiento.posicion_y;
                  if (ax != null && ay != null) {
                    const areaEncontrada = evento.areas.find(
                      (area) =>
                        area.posicion_x != null &&
                        ax >= area.posicion_x &&
                        ax <= area.posicion_x + area.ancho &&
                        ay >= area.posicion_y &&
                        ay <= area.posicion_y + area.alto
                    );
                    if (areaEncontrada?.nombre) nombreArea = areaEncontrada.nombre;
                  }
                }
                const textoArea = nombreArea ? ` - ${nombreArea}` : '';
                nuevasSelecciones.push({
                  type: 'asiento',
                  id: asiento.id,
                  tipo_precio_id: asiento.tipo_precio_id,
                  precio: precioSilla,
                  nombre: `Silla ${asiento.codigo_asiento || asiento.numero_asiento} - Mesa ${etiquetaMesa(mesa)}${textoArea}`,
                  area_nombre: nombreArea || null,
                });
              }
            }

            if (asientosDisponibles.length > 0) {
              const precioTotal = calcularPrecioMesaCompleta(mesa, asientosDisponibles, evento.tipos_precio);
              const entradaMesaCompleta = {
                type: 'mesa_completa',
                mesa_id: mesa.id,
                numero_mesa: mesa.numero_mesa,
                cantidad_sillas: asientosDisponibles.length,
                precio_total: precioTotal,
                venta_solo_mesa: soloMesa,
                nombre: `MESA COMPLETA M${mesa.numero_mesa}`,
                sillas: asientosDisponibles.map((a) => a.numero).join(', '),
              };

              setSelecciones((prev) => [
                ...prev,
                ...(soloMesa ? [] : nuevasSelecciones),
                entradaMesaCompleta,
              ]);
            }
          }
          return; // Ya manejamos el click, no verificar asientos individuales
        }
      }
    }

    // Verificar si se hizo click en un asiento individual (no dentro de una mesa)
    if (evento.asientos && Array.isArray(evento.asientos)) {
      const mesasMap = crearMapaMesas();
      for (const asiento of evento.asientos) {
        const { x: asientoX, y: asientoY } = obtenerPosicionAsiento(asiento, mesasMap);
        if (asientoX === null || asientoY === null) continue;
        if (!estaEnZonaSeleccionada(asientoX, asientoY)) continue;
        if (!cumpleFiltroTipoPrecio(asiento.tipo_precio_id)) continue;

        // Radio de detección (más pequeño para sillas de mesas)
        const tamañoAsiento = asiento.mesa_id ? 5 : 6;
        const distancia = Math.sqrt(Math.pow(x - asientoX, 2) + Math.pow(y - asientoY, 2));

        if (distancia <= tamañoAsiento) {
          // Verificar si el asiento está ocupado
          if (asientosOcupados.includes(asiento.id)) {
            showAlert('Este asiento ya está ocupado y no está disponible', { type: 'warning' });
            return;
          }

          const mesaDelAsiento = asiento.mesa_id
            ? evento.mesas?.find((m) => m.id === asiento.mesa_id)
            : null;

          if (mesaDelAsiento && esMesaSoloVentaCompleta(mesaDelAsiento)) {
            showAlert('Esta mesa solo se vende completa. Haz clic sobre la mesa (no en las sillas).', {
              type: 'info',
            });
            return;
          }

          // Si el asiento pertenece a una mesa, verificar si la mesa está ocupada
          if (asiento.mesa_id && mesasOcupadas.includes(asiento.mesa_id)) {
            showAlert('Esta mesa ya está ocupada completamente y no está disponible para comprar sillas individuales', { type: 'warning' });
            return;
          }

          // Verificar disponibilidad
          if (asiento.estado && asiento.estado !== 'disponible') {
            showAlert('Este asiento no está disponible', { type: 'warning' });
            return;
          }

          const yaSeleccionado = selecciones.some(sel => sel.type === 'asiento' && sel.id === asiento.id);

          if (yaSeleccionado) {
            // Deseleccionar
            // Al deseleccionar un asiento, también eliminar la entrada de mesa completa si existe
            const mesaDelAsiento = evento.mesas?.find(m => m.id === asiento.mesa_id);
            setSelecciones(prev => prev.filter(sel => {
              if (sel.id === asiento.id) return false;
              // Si es una mesa completa y el asiento pertenece a esa mesa, eliminar también la mesa completa
              if (sel.type === 'mesa_completa' && mesaDelAsiento && sel.mesa_id === mesaDelAsiento.id) {
                return false;
              }
              return true;
            }));
          } else {
            const precioSilla = mesaDelAsiento
              ? calcularPrecioSillaEnMesa(mesaDelAsiento, asiento, evento.tipos_precio)
              : null;
            const nuevaSeleccion = construirSeleccionAsiento(asiento);
            if (mesaDelAsiento && precioSilla != null) {
              nuevaSeleccion.precio = precioSilla;
            }
            setSelecciones((prev) => [...prev, nuevaSeleccion]);
          }
          return;
        }
      }
    }
  };

  const handleSvgClick = (e) => {
    const pos = getSvgWorldPos(e);
    if (!pos) return;
    manejarClickPlano(pos.x, pos.y);
  };

  const handleSvgMouseMove = (e) => {
    const pos = getSvgWorldPos(e);
    if (!pos || !evento || evento.tipo_evento !== 'especial') {
      setCursorPlano('pointer');
      return;
    }
    const x = pos.x;
    const y = pos.y;

    let cursor = 'pointer';
    if (evento.asientos && Array.isArray(evento.asientos)) {
      const mesasMap = crearMapaMesas();
      for (const asiento of evento.asientos) {
        const { x: asientoX, y: asientoY } = obtenerPosicionAsiento(asiento, mesasMap);
        if (asientoX === null || asientoY === null) continue;
        if (!estaEnZonaSeleccionada(asientoX, asientoY)) continue;
        if (!cumpleFiltroTipoPrecio(asiento.tipo_precio_id)) continue;
        const tamañoAsiento = asiento.mesa_id ? 5 : 6;
        const distancia = Math.sqrt(Math.pow(x - asientoX, 2) + Math.pow(y - asientoY, 2));
        if (distancia <= tamañoAsiento && asientosOcupados.includes(asiento.id)) {
          cursor = 'not-allowed';
          break;
        }
      }
    }
    setCursorPlano(cursor);
  };

  const handleCanvasMouseMove = (e) => {
    // Tooltip deshabilitado - no mostrar información al hacer hover
  };


  const handleCanvasClick = (e) => {
    if (!evento || evento.tipo_evento !== 'especial') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getMousePos(e);
    if (!pos) return;
    manejarClickPlano(pos.x, pos.y);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevenir doble envío
    if (enviando) {
      return;
    }
    
    setEnviando(true);
    
    // Para eventos especiales, validar que haya selecciones (excluyendo entradas de mesa completa del conteo)
    const seleccionesValidas = selecciones.filter(s => s.type === 'asiento' || s.type === 'mesa_completa');
    if (evento.tipo_evento === 'especial' && seleccionesValidas.length === 0) {
      showAlert('Por favor selecciona al menos un asiento', { type: 'warning' });
      setEnviando(false);
      return;
    }

    // Para evento general con múltiples tipos (VIP, General, etc.), validar que haya al menos una entrada
    if (evento.tipo_evento === 'general' && evento.tipos_precio?.length > 0) {
      const totalPorTipo = Object.values(cantidadesPorTipo).reduce((s, q) => s + (parseInt(q, 10) || 0), 0);
      if (totalPorTipo < 1) {
        showAlert('Selecciona al menos una entrada por tipo (VIP, General, Gradería, etc.)', { type: 'warning' });
        setEnviando(false);
        return;
      }
    }
    
    // Calcular cantidad real (sin contar mesas completas como entrada adicional)
    let cantidadReal = cantidad;
    if (evento.tipo_evento === 'general' && evento.tipos_precio?.length > 0) {
      cantidadReal = Object.values(cantidadesPorTipo).reduce((s, q) => s + (parseInt(q, 10) || 0), 0);
    } else if (evento.tipo_evento === 'especial') {
      // Obtener IDs de mesas completas seleccionadas
      const mesasCompletasSeleccionadas = selecciones.filter(s => s.type === 'mesa_completa');
      const idsMesasCompletas = mesasCompletasSeleccionadas.map(m => m.mesa_id);
      
      // Contar asientos de mesas completas (no contar la mesa como entrada adicional)
      let cantidadMesas = 0;
      mesasCompletasSeleccionadas.forEach(mesa => {
        cantidadMesas += mesa.cantidad_sillas || 0;
      });
      
      // Contar asientos individuales que NO pertenecen a una mesa completa seleccionada
      const asientosIndividuales = selecciones.filter(s => {
        if (s.type !== 'asiento') return false;
        // Verificar si este asiento pertenece a una mesa completa seleccionada
        const asientoData = evento.asientos?.find(a => a.id === s.id);
        return asientoData && !idsMesasCompletas.includes(asientoData.mesa_id);
      });
      
      const cantidadAreaGeneral = selecciones
        .filter(s => s.type === 'area_general')
        .reduce((sum, s) => sum + s.cantidad, 0);

      cantidadReal = cantidadMesas + asientosIndividuales.length + cantidadAreaGeneral;
    }
    
    // Registrar compra en la base de datos
    try {
      // Preparar asientos para enviar al backend
      const asientosParaBackend = [];
      const mesasParaBackend = [];
      const areasPersonasParaBackend = [];
      
      if (evento.tipo_evento === 'especial') {
        // Obtener IDs de mesas completas seleccionadas
        const mesasCompletasSeleccionadas = selecciones.filter(s => s.type === 'mesa_completa');
        const idsMesasCompletas = mesasCompletasSeleccionadas.map(m => m.mesa_id);
        
        // Agregar mesas completas
        mesasCompletasSeleccionadas.forEach(mesa => {
          mesasParaBackend.push({
            mesa_id: mesa.mesa_id,
            cantidad_sillas: mesa.cantidad_sillas || 0,
            precio_total: mesa.precio_total || 0,
            sillas: mesa.sillas || ''
          });
        });
        
        // Agregar asientos individuales que NO pertenecen a una mesa completa seleccionada
        const asientosIndividuales = selecciones.filter(s => {
          if (s.type !== 'asiento') return false;
          const asientoData = evento.asientos?.find(a => a.id === s.id);
          return asientoData && !idsMesasCompletas.includes(asientoData.mesa_id);
        });
        
        asientosIndividuales.forEach(asiento => {
          asientosParaBackend.push({
            id: asiento.id,
            precio: asiento.precio || 0
          });
        });

        // Agregar áreas personas (de pie)
        const areasPersonasSeleccionadas = selecciones.filter(s => s.type === 'area_general');
        areasPersonasSeleccionadas.forEach(ap => {
          areasPersonasParaBackend.push({
            area_id: ap.id,
            cantidad: ap.cantidad,
            precio_unitario: ap.precio
          });
        });
      } else {
        // Para eventos generales (precio único o con tipos), no hay asientos
      }

      // Entradas generales por tipo (VIP, General, Gradería) para evento general
      const entradasGeneralesPayload = (evento.tipo_evento === 'general' && evento.tipos_precio?.length > 0)
        ? Object.entries(cantidadesPorTipo)
            .filter(([, q]) => (parseInt(q, 10) || 0) > 0)
            .map(([tipoId, q]) => ({ tipo_precio_id: parseInt(tipoId, 10), cantidad: parseInt(q, 10) }))
        : undefined;

      // Enviar al backend: total SIN descuento cuando hay cupón (el backend aplica el descuento una vez).
      // Si enviamos el total ya con descuento, el backend lo descontaría de nuevo y quedaría mal (ej. 972 en vez de 1080).
      let totalParaBackend = totalConDescuento || 0;
      if (cuponValidado && !esRegaloAdmin && !esOfertaAdmin) {
        totalParaBackend = total; // total = subtotal sin descuento; el backend aplicará el cupón
      }

      let totalFinal = totalConDescuento || 0;
      let tipoVenta = 'NORMAL';
      let precioOriginal = null;
      if ((canSellWithVerification && canSellWithVerification()) && puedeOpcionesVentaAdmin) {
        if (esRegaloAdmin) {
          totalFinal = 0;
          tipoVenta = 'REGALO_ADMIN';
        } else if (esOfertaAdmin && precioEspecial !== '' && !isNaN(parseFloat(precioEspecial))) {
          totalFinal = parseFloat(precioEspecial) * cantidadReal;
          precioOriginal = total;
          tipoVenta = 'OFERTA_ADMIN';
        }
      }

      if (puedeOpcionesVentaAdmin) {
        if (esRegaloAdmin) totalParaBackend = 0;
        else if (esOfertaAdmin && precioEspecial !== '' && !isNaN(parseFloat(precioEspecial))) {
          totalParaBackend = parseFloat(precioEspecial) * cantidadReal;
        }
      }

      // Crear compra en el backend
      const compraPayload = {
        evento_id: parseInt(id),
        cliente_nombre: formData.nombre || 'Cliente',
        cliente_email: formData.email || null,
        cliente_telefono: formData.telefono || null,
        cantidad: cantidadReal,
        total: totalParaBackend,
        tipo_venta: tipoVenta,
        precio_original: precioOriginal,
        codigo_cupon: cuponValidado ? codigoCupon.trim() : null,
        asientos: asientosParaBackend,
        mesas: mesasParaBackend,
        areas_personas: areasPersonasParaBackend
      };
      if (entradasGeneralesPayload && entradasGeneralesPayload.length > 0) {
        compraPayload.entradas_generales = entradasGeneralesPayload;
      }
      const compraResponse = await api.post('/compras', compraPayload);

      if (compraResponse.data.success) {
        const compra = compraResponse.data.data;
        
        // Si es admin: mostrar modal para verificar tipo de pago (QR/Efectivo) y no ir a pago-qr
        if (canSellWithVerification && canSellWithVerification()) {
          setCompraRecienCreada(compra);
          setShowModalVerificarPago(true);
          setEnviando(false);
          return;
        }
        
        // Cliente normal: guardar en localStorage y redirigir a pago QR
        localStorage.setItem('codigoCompra', compra.codigo_unico);
        localStorage.setItem('compraId', compra.id.toString());
        localStorage.setItem('eventoCompra', JSON.stringify(evento));
        localStorage.setItem('cantidadCompra', cantidadReal.toString());
        localStorage.setItem('totalCompra', (compra.total != null ? compra.total : totalFinal).toString());
        localStorage.setItem('formDataCompra', JSON.stringify(formData));
        if (evento.tipo_evento === 'especial') {
          localStorage.setItem('seleccionesCompra', JSON.stringify(selecciones));
        }
        console.log('✅ Compra registrada con código:', compra.codigo_unico);
      } else {
        throw new Error(compraResponse.data.message || 'Error al registrar la compra');
      }
    } catch (error) {
      console.error('Error al registrar compra:', error);
      const serverMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      showAlert(serverMsg || 'Error al registrar la compra. Por favor, intenta nuevamente.', { type: 'error' });
      setEnviando(false);
      return;
    } finally {
      setEnviando(false);
    }
    
    navigate(`/pago-qr/${id}`);
  };

  const totalParaModalAdmin = () => {
    if (esRegaloAdmin) return 0;
    if (esOfertaAdmin && precioEspecial !== '' && !isNaN(parseFloat(precioEspecial))) {
      return parseFloat(precioEspecial) * cantidadEntradas;
    }
    return totalConDescuento || 0;
  };

  const handleSeleccionarTipoPagoAdmin = async (payload) => {
    if (!compraRecienCreada) return;
    const tipoPago = typeof payload === 'string' ? payload : payload.tipoPago;
    if (!tipoPago || !['QR', 'EFECTIVO'].includes(tipoPago)) return;
    const body = { tipo_pago: tipoPago };
    if (puedeOpcionesVentaAdmin) {
      if (esRegaloAdmin) body.tipo_venta = 'REGALO_ADMIN';
      else if (esOfertaAdmin && precioEspecial && !isNaN(parseFloat(precioEspecial))) {
        body.tipo_venta = 'OFERTA_ADMIN';
        body.precio_original = total;
      }
    }
    setConfirmandoPago(true);
    try {
      const response = await api.put(`/compras/${compraRecienCreada.id}/confirmar-pago`, body);
      if (response.data.success) {
        setCompraConfirmada({ ...response.data.data, boletoUrl: response.data.boletoUrl });
        setShowModalVerificarPago(false);
        setCompraRecienCreada(null);
        showAlert('Pago confirmado. Puedes enviar el boleto por correo o WhatsApp.', { type: 'success' });
      } else {
        showAlert(response.data.message || 'Error al confirmar el pago', { type: 'error' });
      }
    } catch (error) {
      showAlert(error.response?.data?.message || 'Error al confirmar el pago', { type: 'error' });
    } finally {
      setConfirmandoPago(false);
    }
  };

  const enviarBoletoPorCorreoAdmin = async () => {
    if (!compraConfirmada?.id) return;
    const email = compraConfirmada.cliente_email;
    if (!email) {
      showAlert('No hay correo del cliente', { type: 'warning' });
      return;
    }
    setEnviandoBoleto(true);
    try {
      const response = await api.post(`/compras/${compraConfirmada.id}/enviar-email`);
      if (response.data.success) {
        showAlert(`Boleto enviado a ${response.data.email || email}`, { type: 'success' });
      } else {
        showAlert(response.data.message || 'Error al enviar', { type: 'error' });
      }
    } catch (error) {
      showAlert(error.response?.data?.message || 'Error al enviar el boleto por correo', { type: 'error' });
    } finally {
      setEnviandoBoleto(false);
    }
  };

  const enviarBoletoPorWhatsAppAdmin = async () => {
    if (!compraConfirmada?.id) return;
    const telefono = compraConfirmada.cliente_telefono;
    if (!telefono) {
      showAlert('No hay teléfono del cliente', { type: 'warning' });
      return;
    }
    setEnviandoBoleto(true);
    try {
      const response = await api.post(`/compras/${compraConfirmada.id}/enviar-whatsapp-web`);
      if (response.data.success) {
        showAlert(`PDF enviado por WhatsApp a ${response.data.telefono || telefono}`, { type: 'success' });
      } else {
        if (response.data?.qrCode) {
          showAlert('WhatsApp Web no está conectado. Escanea el QR en el servidor.', { type: 'warning' });
        } else {
          showAlert(response.data?.message || 'Error al enviar por WhatsApp', { type: 'error' });
        }
      }
    } catch (error) {
      const data = error.response?.data;
      if (data?.qrCode) {
        showAlert('WhatsApp Web no está conectado. Escanea el QR en el servidor.', { type: 'warning' });
      } else {
        showAlert(data?.message || 'Error al enviar por WhatsApp', { type: 'error' });
      }
    } finally {
      setEnviandoBoleto(false);
    }
  };

  const descargarEntradasPDFAdmin = async () => {
    if (!compraConfirmada?.id) return;
    try {
      setDescargandoPDF(true);
      const response = await api.get(`/compras/${compraConfirmada.id}/pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `entradas-${compraConfirmada.codigo_unico || compraConfirmada.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al descargar PDF:', error);
      showAlert(error.response?.data?.message || 'Error al descargar el PDF', { type: 'error' });
    } finally {
      setDescargandoPDF(false);
    }
  };

  if (loading) {
    return <div className="compra-loading">Cargando evento...</div>;
  }

  if (!evento) {
    return (
      <div className="compra-loading">
        <p>No se pudo cargar la información del evento.</p>
        <button onClick={() => navigate('/')} className="btn-volver">
          Volver al inicio
        </button>
      </div>
    );
  }

  // Función para validar cupón
  const handleValidarCupon = async () => {
    if (!codigoCupon.trim()) {
      showAlert('Por favor ingresa un código de cupón', { type: 'warning' });
      return;
    }

    const emailParaValidar = formData.email?.trim() || user?.correo || user?.email || '';
    if (!emailParaValidar) {
      showAlert('Completa tu correo electrónico antes de validar el cupón, para verificar si ya lo utilizaste.', { type: 'warning' });
      return;
    }

    setValidandoCupon(true);
    try {
      const response = await api.post('/cupones/validar', {
        codigo: codigoCupon.trim(),
        evento_id: parseInt(id),
        cliente_email: emailParaValidar
      });

      if (response.data.success) {
        setCuponValidado(response.data.data);
        showAlert(`Cupón válido: ${response.data.data.porcentaje_descuento}% de descuento`, { type: 'success' });
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Error al validar el cupón';
      showAlert(message, { type: 'error' });
      setCuponValidado(null);
    } finally {
      setValidandoCupon(false);
    }
  };

  // Calcular total
  let total = 0;
  if (evento.tipo_evento === 'especial') {
    total = selecciones.reduce((sum, sel) => {
      if (sel.type === 'mesa_completa') {
        return sum + sel.precio_total;
      } else if (sel.type === 'asiento') {
        // Verificar si este asiento pertenece a una mesa completa
        const perteneceAMesaCompleta = selecciones.some(s => 
          s.type === 'mesa_completa' && 
          evento.asientos?.find(a => a.id === sel.id)?.mesa_id === s.mesa_id
        );
        // No sumar si pertenece a una mesa completa (ya está incluido)
        return perteneceAMesaCompleta ? sum : sum + sel.precio;
      } else if (sel.type === 'area_general') {
        return sum + (sel.precio * sel.cantidad);
      }
      return sum;
    }, 0);
  } else if (evento.tipo_evento === 'general' && evento.tipos_precio?.length > 0) {
    total = (evento.tipos_precio || []).reduce((sum, tp) => {
      const q = cantidadesPorTipo[tp.id] || 0;
      return sum + (parseFloat(tp.precio) || 0) * q;
    }, 0);
  } else {
    total = evento.precio * cantidad;
  }

  // Aplicar descuento del cupón si está validado
  let totalConDescuento = total;
  let descuentoCupon = 0;
  if (cuponValidado && !esRegaloAdmin && !esOfertaAdmin) {
    descuentoCupon = (total * cuponValidado.porcentaje_descuento) / 100;
    totalConDescuento = total - descuentoCupon;
    if (totalConDescuento < 0) {
      totalConDescuento = 0;
      descuentoCupon = total;
    }
  }

  // Cantidad de entradas (para precio especial: precio × cantidad; para general con tipos: suma por tipo)
  let cantidadEntradas = cantidad;
  if (evento.tipo_evento === 'general' && evento.tipos_precio?.length > 0) {
    cantidadEntradas = Object.values(cantidadesPorTipo).reduce((s, q) => s + (parseInt(q, 10) || 0), 0);
  } else if (evento.tipo_evento === 'especial' && selecciones.length > 0) {
    const mesasCompletasSel = selecciones.filter((s) => s.type === 'mesa_completa');
    const idsMesasCompletas = mesasCompletasSel.map((m) => m.mesa_id);
    let cantidadMesas = 0;
    mesasCompletasSel.forEach((mesa) => {
      cantidadMesas += mesa.cantidad_sillas || 0;
    });
    const asientosIndividuales = selecciones.filter((s) => {
      if (s.type !== 'asiento') return false;
      const asientoData = evento.asientos?.find((a) => a.id === s.id);
      return asientoData && !idsMesasCompletas.includes(asientoData.mesa_id);
    });
    const cantidadAreaGeneral = selecciones
      .filter((s) => s.type === 'area_general')
      .reduce((sum, s) => sum + s.cantidad, 0);

    cantidadEntradas = cantidadMesas + asientosIndividuales.length + cantidadAreaGeneral;
  }

  const formatearFecha = (fechaString) => {
    const fecha = new Date(fechaString);
    return {
      fecha: fecha.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      hora: fecha.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  const esEventoEspecial = evento.tipo_evento === 'especial';

  return (
    <div className="compra-page">
      <ModalTipoPago
        isOpen={showModalVerificarPago}
        onClose={() => { if (!confirmandoPago) { setShowModalVerificarPago(false); setCompraRecienCreada(null); } }}
        onSelect={handleSeleccionarTipoPagoAdmin}
        title="Verificar pago"
        disabled={confirmandoPago}
        compraTotal={totalParaModalAdmin()}
        soloTipoPago={true}
        mensajeTotal={compraRecienCreada ? (esRegaloAdmin ? 'Total: Bs. 0 (entrada gratis)' : `Total: Bs. ${totalParaModalAdmin().toFixed(2)}${cuponValidado ? ' (con cupón aplicado)' : ''}${esOfertaAdmin ? ' (precio especial)' : ''}`) : null}
      />

      <div className="container">
        <button onClick={() => navigate(-1)} className="btn-volver">
          ← Volver
        </button>

        {compraConfirmada && canSellWithVerification && canSellWithVerification() && (
          <div ref={compraRealizadaRef} className="compra-card compra-card-resultado-admin" style={{ marginBottom: '24px', border: '2px solid #28a745', borderRadius: '12px', padding: '20px', background: '#f8fff9' }}>
            <h2 style={{ marginTop: 0, color: '#28a745' }}>✓ Compra realizada</h2>
            <p style={{ marginBottom: '8px' }}><strong>Código:</strong> {compraConfirmada.codigo_unico}</p>
            <p style={{ marginBottom: '8px' }}><strong>Cliente:</strong> {compraConfirmada.cliente_nombre}</p>
            <p style={{ marginBottom: '8px' }}><strong>Total:</strong> Bs. {parseFloat(compraConfirmada.total || 0).toFixed(2)} · <strong>Tipo pago:</strong> {compraConfirmada.tipo_pago || '—'}</p>
            <p style={{ marginBottom: '16px' }}><strong>Correo:</strong> {compraConfirmada.cliente_email || '—'} · <strong>Teléfono:</strong> {compraConfirmada.cliente_telefono || '—'}</p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={enviarBoletoPorCorreoAdmin}
                disabled={enviandoBoleto || !compraConfirmada.cliente_email}
                style={{ padding: '10px 18px', background: '#007bff', color: 'white', border: 'none', borderRadius: '8px', cursor: enviandoBoleto ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                {enviandoBoleto ? 'Enviando...' : '📧 Enviar boleto por correo'}
              </button>
              <button
                type="button"
                onClick={enviarBoletoPorWhatsAppAdmin}
                disabled={enviandoBoleto || !compraConfirmada.cliente_telefono}
                style={{ padding: '10px 18px', background: '#25D366', color: 'white', border: 'none', borderRadius: '8px', cursor: enviandoBoleto ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                {enviandoBoleto ? 'Enviando...' : '📱 Enviar por WhatsApp'}
              </button>
              <button
                type="button"
                onClick={descargarEntradasPDFAdmin}
                disabled={descargandoPDF}
                style={{ padding: '10px 18px', background: '#111827', color: 'white', border: 'none', borderRadius: '8px', cursor: descargandoPDF ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                {descargandoPDF ? 'Descargando...' : '⬇️ Descargar entradas (PDF)'}
              </button>
              <button
                type="button"
                onClick={() => { setCompraConfirmada(null); }}
                style={{ padding: '10px 18px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                Hacer otra compra
              </button>
            </div>
          </div>
        )}

        <h1 className="compra-title">Completa tu Compra</h1>

        <div className="compra-content">
          {/* Sección 1: Información del Evento */}
          <div className="compra-card compra-card-evento">
            <h2>Información del Evento</h2>
            <div className="evento-resumen">
              <img src={evento.imagen} alt={evento.titulo} className="evento-resumen-img" />
              <div className="evento-resumen-info">
                <h3>{evento.titulo}</h3>
                <div className="evento-fecha-hora">
                  <p className="evento-fecha">📅 {formatearFecha(evento.hora_inicio).fecha}</p>
                  <p className="evento-hora">🕐 {formatearFecha(evento.hora_inicio).hora}</p>
                </div>
                {!esEventoEspecial && (
                  <p className="evento-resumen-precio">Bs. {evento.precio.toFixed(2)} por entrada</p>
                )}
              </div>
            </div>
            <p className="evento-descripcion-resumen">{evento.descripcion}</p>

          </div>

          {/* Sección 2: Tipos de Entrada Disponibles */}
          {esEventoEspecial && evento.tipos_precio && evento.tipos_precio.length > 0 && (
            <div className="compra-card compra-card-tipos">
              <h2>Tipos de Entrada Disponibles</h2>
              <div className="tipos-precio-grid">
                {evento.tipos_precio.map((tipoPrecio, index) => (
                  <div key={tipoPrecio.id || index} className="tipo-precio-item">
                    <div 
                      className="tipo-precio-color"
                      style={{ backgroundColor: tipoPrecio.color || '#CCCCCC' }}
                    ></div>
                    <div className="tipo-precio-info">
                      <span className="tipo-precio-nombre">{tipoPrecio.nombre}</span>
                      <span className="tipo-precio-valor precio-destacado">Bs. {tipoPrecio.precio.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sección 3: Selecciona tus Asientos */}
          {esEventoEspecial && (
            <div className="compra-card compra-card-asientos">
              <h2>Selecciona tus Asientos</h2>
              <p className="layout-instructions">
                Haz clic en un asiento para seleccionarlo.
              </p>
              <div
                style={{
                  marginBottom: '10px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <span style={{ fontWeight: 600 }}>Compra rápida:</span>
                <button
                  type="button"
                  onClick={seleccionarMejorAsientoDisponible}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: '#2563eb',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Mejor asiento disponible
                </button>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px' }}>N juntos:</span>
                  <input
                    type="number"
                    min="2"
                    max="10"
                    value={cantidadJuntos}
                    onChange={(e) => setCantidadJuntos(e.target.value)}
                    style={{
                      width: '60px',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      fontSize: '12px'
                    }}
                  />
                  <button
                    type="button"
                    onClick={seleccionarNAsientosJuntos}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: '#16a34a',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    Buscar
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSelecciones([])}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid #e5e7eb',
                    backgroundColor: '#f3f4f6',
                    color: '#111827',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                  title="Quitar todas las selecciones de asientos"
                >
                  Limpiar selección
                </button>
              </div>
              {evento.areas && Array.isArray(evento.areas) && evento.areas.length > 0 && (
                <div
                  style={{
                    marginBottom: '12px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Zona:</span>
                  <select
                    value={zonaSeleccionadaId}
                    onChange={(e) => setZonaSeleccionadaId(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      minWidth: '180px'
                    }}
                  >
                    <option value="">Todas las zonas</option>
                    {evento.areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {evento.tipos_precio && evento.tipos_precio.length > 0 && (
                <div style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 600 }}>Tipo de precio:</span>
                  <select
                    value={filtroTipoPrecioId}
                    onChange={(e) => setFiltroTipoPrecioId(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '160px' }}
                  >
                    <option value="">Todos</option>
                    {evento.tipos_precio.map((tp) => (
                      <option key={tp.id} value={tp.id}>{tp.nombre} (Bs. {parseFloat(tp.precio).toFixed(2)})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="leyenda-asientos" style={{ marginBottom: '15px', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setMostrarNumerosAsientos(!mostrarNumerosAsientos)}
                  style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    backgroundColor: mostrarNumerosAsientos ? '#607D8B' : '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {mostrarNumerosAsientos ? '🙈 Ocultar números' : '👁️ Mostrar números'}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '20px', height: '20px', backgroundColor: PLANO_COLORS.seatFillDefault, border: `1px solid ${PLANO_COLORS.seatStroke}`, borderRadius: '4px' }}></div>
                  <span>Disponible</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '20px', height: '20px', backgroundColor: PLANO_COLORS.occupiedFill, border: `1px solid ${PLANO_COLORS.occupiedStroke}`, borderRadius: '4px', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>✕</div>
                  </div>
                  <span>Ocupado</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '20px', height: '20px', backgroundColor: '#3b82f6', border: `3px solid ${PLANO_COLORS.selectedStroke}`, borderRadius: '4px' }}></div>
                  <span>Seleccionado</span>
                </div>
              </div>
              {zonaSeleccionadaId && nombreZonaSeleccionada && (
                <p className="plano-zona-hint">
                  Vista ampliada: <strong>{nombreZonaSeleccionada}</strong>
                  {' '}(elige &quot;Todas las zonas&quot; para ver el plano completo)
                </p>
              )}
              <div
                className={`plano-compra-wrap${zonaSeleccionadaId ? ' plano-compra-wrap--zoom' : ''}`}
                style={{ position: 'relative', display: 'block', width: '100%' }}
              >
              {usarSvgPlano ? (
                <svg
                  ref={svgRef}
                  viewBox={`${viewportPlano.minX} ${viewportPlano.minY} ${viewportPlano.worldW} ${viewportPlano.worldH}`}
                  className="plano-compra-svg"
                  onClick={handleSvgClick}
                  onMouseMove={handleSvgMouseMove}
                  style={{
                    border: '2px solid #ddd',
                    borderRadius: '4px',
                    cursor: cursorPlano,
                    maxWidth: '100%',
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                    background: '#ffffff'
                  }}
                  width={tamanoSvgPlano.width}
                  height={tamanoSvgPlano.height}
                >
                  {/* Fondo */}
                  <rect
                    x={viewportPlano.minX}
                    y={viewportPlano.minY}
                    width={viewportPlano.worldW}
                    height={viewportPlano.worldH}
                    fill={PLANO_COLORS.sheetFill}
                    stroke={PLANO_COLORS.sheetStroke}
                    strokeWidth="2"
                  />

                  {/* Escenario (solo si entra en la vista ampliada) */}
                  {escenarioVisibleEnViewport(evento, viewportPlano) && evento.escenario_x !== null && evento.escenario_y !== null && evento.escenario_width && evento.escenario_height && (
                    <>
                      <rect
                        x={evento.escenario_x}
                        y={evento.escenario_y}
                        width={evento.escenario_width}
                        height={evento.escenario_height}
                        fill={PLANO_COLORS.stageFill}
                        stroke={PLANO_COLORS.stageStroke}
                        strokeWidth="3"
                      />
                      <text
                        x={evento.escenario_x + evento.escenario_width / 2}
                        y={evento.escenario_y + evento.escenario_height / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={PLANO_COLORS.stageText}
                        fontSize="16"
                        fontWeight="700"
                      >
                        ESCENARIO
                      </text>
                    </>
                  )}

                  {/* Áreas (con zoom solo la zona activa) */}
                  {Array.isArray(evento.areas) && evento.areas.map((area) => {
                    const hayFiltroZona = !!zonaSeleccionadaId;
                    const esZonaSel = hayFiltroZona && String(area.id) === String(zonaSeleccionadaId);
                    if (hayFiltroZona && !esZonaSel) return null;
                    const fill = area.color ? hexToRgba(area.color, 0.22) : hexToRgba('#cbd5e1', 0.22);
                    const isPersonas = area.tipo_area === 'PERSONAS';

                    const handleAreaClick = (e) => {
                      if (!isPersonas) return;
                      e.stopPropagation();
                      
                      const precio = parseFloat(area.precio || 0);
                      const disponibles = area.personas_disponibles !== undefined ? area.personas_disponibles : area.capacidad_personas;
                      const sel = selecciones.find(s => s.type === 'area_general' && s.id === area.id);
                      const cantidadActual = sel ? sel.cantidad : 0;
                      
                      if (disponibles !== null && cantidadActual >= disponibles) {
                        showAlert(`No hay más espacio disponible en la zona ${area.nombre}.`, { type: 'warning' });
                        return;
                      }
                      
                      setSelecciones(prev => {
                        const existing = prev.find(s => s.type === 'area_general' && s.id === area.id);
                        if (existing) {
                          return prev.map(s => (s.type === 'area_general' && s.id === area.id)
                            ? { ...s, cantidad: s.cantidad + 1, total: (s.cantidad + 1) * precio }
                            : s
                          );
                        } else {
                          return [...prev, {
                            type: 'area_general',
                            id: area.id,
                            nombre: `Entrada General - ${area.nombre}`,
                            cantidad: 1,
                            precio: precio,
                            total: precio,
                            color: area.color
                          }];
                        }
                      });
                      
                      showAlert(`Se agregó 1 entrada para la zona ${area.nombre}.`, { type: 'success', toast: true });
                    };

                    const isCirculo = area.forma === 'circulo' || area.forma === 'circle';
                    const cx = area.posicion_x + area.ancho / 2;
                    const cy = area.posicion_y + area.alto / 2;
                    const rx = area.ancho / 2;
                    const ry = area.alto / 2;

                    return (
                      <g
                        key={`area-${area.id}`}
                        onClick={isPersonas ? handleAreaClick : undefined}
                        style={{ cursor: isPersonas ? 'pointer' : 'default' }}
                      >
                        {isCirculo ? (
                          <>
                            <ellipse
                              cx={cx}
                              cy={cy}
                              rx={rx}
                              ry={ry}
                              fill={fill}
                              stroke={area.color || PLANO_COLORS.areaStroke}
                              strokeWidth={esZonaSel ? 4 : 3}
                            />
                            <ellipse
                              cx={cx}
                              cy={cy}
                              rx={Math.max(0, rx - 2)}
                              ry={Math.max(0, ry - 2)}
                              fill="transparent"
                              stroke={PLANO_COLORS.areaStrokeInner}
                              strokeWidth="2"
                            />
                          </>
                        ) : (
                          <>
                            <rect
                              x={area.posicion_x}
                              y={area.posicion_y}
                              width={area.ancho}
                              height={area.alto}
                              fill={fill}
                              stroke={area.color || PLANO_COLORS.areaStroke}
                              strokeWidth={esZonaSel ? 4 : 3}
                            />
                            <rect
                              x={area.posicion_x + 2}
                              y={area.posicion_y + 2}
                              width={Math.max(0, area.ancho - 4)}
                              height={Math.max(0, area.alto - 4)}
                              fill="transparent"
                              stroke={PLANO_COLORS.areaStrokeInner}
                              strokeWidth="2"
                            />
                          </>
                        )}
                        
                        {/* Decorative Crowd dots grid for standing area */}
                        {isPersonas && (() => {
                          const cols = Math.floor(area.ancho / 20);
                          const rows = Math.floor(area.alto / 20);
                          const dots = [];
                          for (let r = 0; r < rows; r++) {
                            for (let c = 0; c < cols; c++) {
                              const dotX = area.posicion_x + 10 + c * 20;
                              const dotY = area.posicion_y + 10 + r * 20;
                              
                              if (isCirculo) {
                                // Verificar si está dentro de la elipse
                                const inside = (((dotX - cx) / rx) ** 2 + ((dotY - cy) / ry) ** 2) <= 1;
                                if (!inside) continue;
                              }
                              
                              dots.push(
                                <circle
                                  key={`dot-${area.id}-${r}-${c}`}
                                  cx={dotX}
                                  cy={dotY}
                                  r={2.5}
                                  fill={area.color || '#4CAF50'}
                                  opacity={0.35}
                                  pointerEvents="none"
                                />
                              );
                            }
                          }
                          return dots;
                        })()}

                        {/* Badges and Labels */}
                        {isPersonas ? (
                          <g transform={`translate(${area.posicion_x + area.ancho / 2}, ${area.posicion_y + area.alto / 2})`}>
                            <rect
                              x={-80}
                              y={-25}
                              width={160}
                              height={50}
                              rx={6}
                              ry={6}
                              fill="#ffffff"
                              stroke={area.color || '#cbd5e1'}
                              strokeWidth={2}
                              style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))' }}
                              pointerEvents="none"
                            />
                            <text
                              x={0}
                              y={-8}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="#1f2937"
                              fontSize="12"
                              fontWeight="800"
                              pointerEvents="none"
                            >
                              {String(area.nombre || '').toUpperCase()}
                            </text>
                            <text
                              x={0}
                              y={8}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="#16a34a"
                              fontSize="10"
                              fontWeight="700"
                              pointerEvents="none"
                            >
                              Bs. {parseFloat(area.precio || 0).toFixed(2)}
                            </text>
                            <text
                              x={0}
                              y={18}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="#666"
                              fontSize="8"
                              fontWeight="600"
                              pointerEvents="none"
                            >
                              ({area.personas_disponibles !== undefined ? area.personas_disponibles : area.capacidad_personas} disp)
                            </text>
                          </g>
                        ) : (
                          <text
                            x={area.posicion_x + area.ancho / 2}
                            y={area.posicion_y - 8}
                            textAnchor="middle"
                            dominantBaseline="baseline"
                            fill="#333"
                            fontSize="14"
                            fontWeight="700"
                          >
                            {String(area.nombre || '').toUpperCase()}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Mesas */}
                  {Array.isArray(evento.mesas) && evento.mesas.map((mesa) => {
                    const mesaX = mesa.posicion_x ?? 100;
                    const mesaY = mesa.posicion_y ?? 100;
                    const mesaW = mesa.ancho || mesa.width || 30;
                    const mesaH = mesa.alto || mesa.height || 30;
                    const cx = mesaX + mesaW / 2;
                    const cy = mesaY + mesaH / 2;
                    if (!estaEnZonaSeleccionada(cx, cy)) return null;
                    if (!cumpleFiltroTipoPrecio(mesa.tipo_precio_id)) return null;
                    const ocupada = mesasOcupadas.includes(mesa.id);
                    const fill = ocupada ? PLANO_COLORS.occupiedFill : PLANO_COLORS.mesaFill;
                    const stroke = ocupada ? PLANO_COLORS.occupiedStroke : PLANO_COLORS.mesaStroke;
                    return (
                      <g key={`mesa-${mesa.id}`}>
                        <rect
                          x={mesaX}
                          y={mesaY}
                          width={mesaW}
                          height={mesaH}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={ocupada ? 3 : 2}
                          rx="3"
                          ry="3"
                          pointerEvents="all"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Click directo a la mesa (selección exacta)
                            manejarClickPlano(cx, cy, { ignoreMesas: false });
                          }}
                        />
                        {mostrarNumerosAsientos && (
                          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill={PLANO_COLORS.mesaText} fontSize="11" fontWeight="700" pointerEvents="none">
                            {etiquetaMesa(mesa)}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Asientos (incluye sillas de mesas) */}
                  {Array.isArray(evento.asientos) && (() => {
                    const mesasMap = crearMapaMesas();
                    return evento.asientos.map((asiento) => {
                      const { x, y } = obtenerPosicionAsiento(asiento, mesasMap);
                      if (x == null || y == null) return null;
                      if (!estaEnZonaSeleccionada(x, y)) return null;
                      if (!cumpleFiltroTipoPrecio(asiento.tipo_precio_id)) return null;

                      const estaOcupado = asientosOcupados.includes(asiento.id) || (asiento.mesa_id && mesasOcupadas.includes(asiento.mesa_id));
                      const estaSel = selecciones.some(sel => sel.type === 'asiento' && sel.id === asiento.id);
                      const tipoPrecio = evento.tipos_precio?.find(tp => tp.id === asiento.tipo_precio_id);

                      // Personas (P*)
                      if (!asiento.mesa_id && String(asiento.numero_asiento || '').startsWith('P')) {
                        return (
                          <circle
                            key={`persona-${asiento.id}`}
                            cx={x}
                            cy={y}
                            r={5}
                            fill={estaOcupado ? PLANO_COLORS.occupiedFill : (tipoPrecio?.color || PLANO_COLORS.personaFillDefault)}
                            stroke={estaSel ? PLANO_COLORS.selectedStroke : (estaOcupado ? PLANO_COLORS.occupiedStroke : PLANO_COLORS.seatStroke)}
                            strokeWidth={estaSel ? 3 : 1}
                            pointerEvents="all"
                            onClick={(e) => {
                              e.stopPropagation();
                              manejarClickPlano(x, y, { ignoreMesas: true });
                            }}
                          />
                        );
                      }

                      // Sillas de mesa
                      if (asiento.mesa_id) {
                        let numeroSilla = asiento.codigo_asiento || asiento.numero_asiento || '';
                        if (numeroSilla.includes('-')) {
                          numeroSilla = numeroSilla.split('-')[1];
                        }
                        return (
                          <g key={`g-silla-${asiento.id}`}>
                            <rect
                              key={`silla-${asiento.id}`}
                              x={x - 4}
                              y={y - 4}
                              width={8}
                              height={8}
                              fill={estaOcupado ? PLANO_COLORS.occupiedFill : (tipoPrecio?.color || PLANO_COLORS.mesaChairFillDefault)}
                              stroke={estaSel ? PLANO_COLORS.selectedStroke : (estaOcupado ? PLANO_COLORS.occupiedStroke : PLANO_COLORS.seatStroke)}
                              strokeWidth={estaSel ? 2 : 1}
                              rx="1"
                              ry="1"
                              pointerEvents="all"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Click directo a la silla (no a la mesa completa)
                                manejarClickPlano(x, y, { ignoreMesas: true });
                              }}
                            />
                            {mostrarNumerosAsientos && numeroSilla && (
                              <text
                                x={x}
                                y={y}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="#0f172a"
                                fontSize="5.5"
                                fontWeight="700"
                                pointerEvents="none"
                              >
                                {numeroSilla}
                              </text>
                            )}
                          </g>
                        );
                      }

                      // Asiento individual
                      let numeroAsiento = asiento.codigo_asiento || asiento.numero_asiento || '';
                      if (numeroAsiento.includes('-')) {
                        numeroAsiento = numeroAsiento.split('-')[1];
                      }
                      return (
                        <g key={`g-asiento-${asiento.id}`}>
                          <rect
                            key={`asiento-${asiento.id}`}
                            x={(asiento.posicion_x ?? x) - 5}
                            y={(asiento.posicion_y ?? y) - 5}
                            width={10}
                            height={10}
                            fill={estaOcupado ? PLANO_COLORS.occupiedFill : (tipoPrecio?.color || PLANO_COLORS.seatFillDefault)}
                            stroke={estaSel ? PLANO_COLORS.selectedStroke : (estaOcupado ? PLANO_COLORS.occupiedStroke : PLANO_COLORS.seatStroke)}
                            strokeWidth={estaSel ? 3 : 1}
                            rx="2"
                            ry="2"
                            pointerEvents="all"
                            onClick={(e) => {
                              e.stopPropagation();
                              manejarClickPlano(x, y, { ignoreMesas: true });
                            }}
                          />
                          {mostrarNumerosAsientos && numeroAsiento && (
                            <text
                              x={asiento.posicion_x ?? x}
                              y={asiento.posicion_y ?? y}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="#0f172a"
                              fontSize="6.5"
                              fontWeight="700"
                              pointerEvents="none"
                            >
                              {numeroAsiento}
                            </text>
                          )}
                        </g>
                      );
                    });
                  })()}
                </svg>
              ) : null}

              {/* Canvas se mantiene como fallback/compatibilidad (oculto por defecto) */}
              <canvas
                ref={canvasRef}
                width={800}
                height={600}
                onClick={handleCanvasClick}
                style={{
                  border: '2px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  maxWidth: '100%',
                  height: 'auto',
                  display: usarSvgPlano ? 'none' : 'block',
                  background: '#ffffff'
                }}
              />
              </div>
              {selecciones.length > 0 && (
                <div className="selecciones-resumen">
                  <h4>Selecciones</h4>
                  <div className="selecciones-lista">
                    {selecciones.map((sel, index) => {
                      // Filtrar solo asientos individuales, mesas completas y áreas generales
                      if (sel.type === 'asiento') {
                        // Verificar si este asiento pertenece a una mesa completa seleccionada
                        const perteneceAMesaCompleta = selecciones.some(s => 
                          s.type === 'mesa_completa' && 
                          evento.asientos?.find(a => a.id === sel.id)?.mesa_id === s.mesa_id
                        );
                        // No mostrar asientos individuales si pertenecen a una mesa completa
                        if (perteneceAMesaCompleta) return null;
                        
                        return (
                          <div key={index} className="seleccion-item">
                            <span className="seleccion-nombre">{sel.nombre}</span>
                            <span className="seleccion-precio">Bs. {sel.precio.toFixed(2)}</span>
                          </div>
                        );
                      } else if (sel.type === 'mesa_completa') {
                        return (
                          <div key={index} className="seleccion-item seleccion-mesa-completa">
                            <div className="seleccion-mesa-info">
                              <span className="seleccion-nombre seleccion-mesa-titulo">{sel.nombre}</span>
                              <span className="seleccion-mesa-detalle">
                                Mesa {sel.codigo_mesa || (sel.numero_mesa != null ? `M${sel.numero_mesa}` : '?')} • {sel.cantidad_sillas} personas
                              </span>
                              <span className="seleccion-mesa-sillas">
                                Sillas: {sel.sillas}
                              </span>
                            </div>
                            <span className="seleccion-precio seleccion-precio-mesa">Bs. {sel.precio_total.toFixed(2)}</span>
                          </div>
                        );
                      } else if (sel.type === 'area_general') {
                        return (
                          <div key={index} className="seleccion-item" style={{ borderLeft: `4px solid ${sel.color || '#4CAF50'}` }}>
                            <div className="seleccion-mesa-info">
                              <span className="seleccion-nombre" style={{ fontWeight: 'bold' }}>{sel.nombre}</span>
                              <span className="seleccion-mesa-detalle">
                                Cantidad: {sel.cantidad} × Bs. {sel.precio.toFixed(2)}
                              </span>
                            </div>
                            <span className="seleccion-precio">Bs. {sel.total.toFixed(2)}</span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                  <div className="selecciones-total">
                    <span>Total:</span>
                    <span>Bs. {selecciones.reduce((sum, sel) => {
                      if (sel.type === 'mesa_completa') {
                        return sum + sel.precio_total;
                      } else if (sel.type === 'asiento') {
                        // Verificar si este asiento pertenece a una mesa completa
                        const perteneceAMesaCompleta = selecciones.some(s => 
                          s.type === 'mesa_completa' && 
                          evento.asientos?.find(a => a.id === sel.id)?.mesa_id === s.mesa_id
                        );
                        // No sumar si pertenece a una mesa completa (ya está incluido)
                        return perteneceAMesaCompleta ? sum : sum + sel.precio;
                      } else if (sel.type === 'area_general') {
                        return sum + sel.total;
                      }
                      return sum;
                    }, 0).toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Zonas Generales (De Pie) para eventos especiales */}
              {Array.isArray(evento.areas) && evento.areas.some(a => a.tipo_area === 'PERSONAS') && (
                <div className="compra-card-cantidad" style={{ marginTop: '20px', padding: '20px', borderTop: '1px solid #eee' }}>
                  <h3 style={{ fontSize: '1.25rem', color: '#2c3e50', marginBottom: '8px', fontWeight: 'bold' }}>Entradas de Zona General (De Pie)</h3>
                  <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '15px' }}>
                    Selecciona la cantidad de entradas para las zonas de pie/sin numerar (puedes hacer clic en ellas en el plano o seleccionarlas aquí abajo):
                  </p>
                  <div className="tipos-precio-cantidad-list">
                    {evento.areas
                      .filter(a => a.tipo_area === 'PERSONAS')
                      .map((area) => {
                        const sel = selecciones.find(s => s.type === 'area_general' && s.id === area.id);
                        const cantidadActual = sel ? sel.cantidad : 0;
                        const precio = parseFloat(area.precio || 0);
                        const disponibles = area.personas_disponibles !== undefined ? area.personas_disponibles : area.capacidad_personas;
                        
                        const handleIncrement = () => {
                          if (disponibles !== null && cantidadActual >= disponibles) {
                            showAlert(`No hay más espacio disponible en la zona ${area.nombre}.`, { type: 'warning' });
                            return;
                          }
                          
                          setSelecciones(prev => {
                            const existing = prev.find(s => s.type === 'area_general' && s.id === area.id);
                            if (existing) {
                              return prev.map(s => (s.type === 'area_general' && s.id === area.id)
                                ? { ...s, cantidad: s.cantidad + 1, total: (s.cantidad + 1) * precio }
                                : s
                              );
                            } else {
                              return [...prev, {
                                type: 'area_general',
                                id: area.id,
                                nombre: `Entrada General - ${area.nombre}`,
                                cantidad: 1,
                                precio: precio,
                                total: precio,
                                color: area.color
                              }];
                            }
                          });
                        };

                        const handleDecrement = () => {
                          setSelecciones(prev => {
                            const existing = prev.find(s => s.type === 'area_general' && s.id === area.id);
                            if (!existing) return prev;
                            if (existing.cantidad <= 1) {
                              return prev.filter(s => !(s.type === 'area_general' && s.id === area.id));
                            } else {
                              return prev.map(s => (s.type === 'area_general' && s.id === area.id)
                                ? { ...s, cantidad: s.cantidad - 1, total: (s.cantidad - 1) * precio }
                                : s
                              );
                            }
                          });
                        };

                        return (
                          <div key={area.id} className="tipo-precio-fila" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', padding: '10px 15px', background: '#f8f9fa', borderRadius: '8px', borderLeft: `5px solid ${area.color || '#4CAF50'}` }}>
                            <div style={{ flex: 1, minWidth: '150px' }}>
                              <span className="tipo-nombre" style={{ fontWeight: 700, fontSize: '1rem', color: '#2c3e50', display: 'block' }}>{area.nombre}</span>
                              <span style={{ fontSize: '0.8rem', color: '#666' }}>
                                Capacidad: {area.capacidad_personas} • Disponibles: <strong style={{ color: disponibles === 0 ? '#dc3545' : '#198754' }}>{disponibles}</strong>
                              </span>
                            </div>
                            <span className="tipo-precio precio-destacado" style={{ fontWeight: 700, color: '#0d6efd', fontSize: '1rem' }}>Bs. {precio.toFixed(2)}</span>
                            
                            <div className="cantidad-selector" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <button
                                type="button"
                                onClick={handleDecrement}
                                className="cantidad-btn"
                                disabled={cantidadActual === 0}
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  border: 'none',
                                  background: cantidadActual === 0 ? '#e2e8f0' : 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
                                  color: '#1a1a1a',
                                  fontWeight: 'bold',
                                  cursor: cantidadActual === 0 ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '1.2rem',
                                  boxShadow: 'none'
                                }}
                              >
                                -
                              </button>
                              <span className="cantidad-value" style={{ minWidth: '30px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: '#2c3e50' }}>
                                {cantidadActual}
                              </span>
                              <button
                                type="button"
                                onClick={handleIncrement}
                                className="cantidad-btn"
                                disabled={disponibles !== null && disponibles <= 0}
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  border: 'none',
                                  background: (disponibles !== null && disponibles <= 0) ? '#e2e8f0' : 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
                                  color: '#1a1a1a',
                                  fontWeight: 'bold',
                                  cursor: (disponibles !== null && disponibles <= 0) ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '1.2rem',
                                  boxShadow: 'none'
                                }}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Selector de cantidad para eventos generales */}
          {!esEventoEspecial && (
            <div className="compra-card compra-card-cantidad">
              <h2>
                {evento.tipos_precio?.length > 0
                  ? 'Elige tipo y cantidad de entradas'
                  : 'Cantidad de Entradas'}
              </h2>
              {evento.tipos_precio?.length > 0 ? (
                <div className="tipos-precio-cantidad-list">
                  {evento.tipos_precio.map((tp) => {
                    const disponibles = tp.disponibles != null ? parseInt(tp.disponibles, 10) : null;
                    const actual = cantidadesPorTipo[tp.id] || 0;
                    const maxPermitido = disponibles != null ? disponibles : null;
                    const puedeSumar = maxPermitido == null || actual < maxPermitido;
                    return (
                      <div key={tp.id} className="tipo-precio-fila" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                        <span className="tipo-nombre" style={{ fontWeight: 600, minWidth: '120px' }}>{tp.nombre}</span>
                        <span className="tipo-precio precio-destacado" style={{ fontWeight: 700, color: '#0d6efd', fontSize: '1.05rem' }}>Bs. {parseFloat(tp.precio).toFixed(2)}</span>
                        {maxPermitido != null && (
                          <span className="tipo-disponibles" style={{ fontSize: '0.9rem', color: maxPermitido === 0 ? '#c00' : '#555' }}>
                            Quedan: {maxPermitido}
                          </span>
                        )}
                        <div className="cantidad-selector" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => setCantidadesPorTipo(prev => ({ ...prev, [tp.id]: Math.max(0, (prev[tp.id] || 0) - 1) }))}
                            className="cantidad-btn"
                          >
                            -
                          </button>
                          <span className="cantidad-value">{(cantidadesPorTipo[tp.id] || 0)}</span>
                          <button
                            type="button"
                            onClick={() => puedeSumar && setCantidadesPorTipo(prev => ({ ...prev, [tp.id]: (prev[tp.id] || 0) + 1 }))}
                            className="cantidad-btn"
                            disabled={!puedeSumar}
                            title={maxPermitido === 0 ? 'No hay entradas disponibles' : (maxPermitido != null ? `Máximo ${maxPermitido}` : null)}
                          >
                            +
                          </button>
                        </div>
                        <span className="tipo-subtotal" style={{ marginLeft: 'auto', fontWeight: 600 }}>
                          Bs. {((parseFloat(tp.precio) || 0) * (cantidadesPorTipo[tp.id] || 0)).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="cantidad-selector-wrapper">
                  <div className="cantidad-selector">
                    <button 
                      type="button"
                      onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                      className="cantidad-btn"
                    >
                      -
                    </button>
                    <span className="cantidad-value">{cantidad}</span>
                    <button 
                      type="button"
                      onClick={() => setCantidad(cantidad + 1)}
                      className="cantidad-btn"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sección 4: Completa tu Compra (Formulario) */}
          <div className="compra-card compra-card-contacto">
            <h2>Completa tu Compra</h2>
            <form onSubmit={handleSubmit} className="compra-form">
              <div className="form-group">
                <label htmlFor="nombre">Nombre Completo</label>
                <input
                  type="text"
                  id="nombre"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Correo Electrónico</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="telefono">Teléfono</label>
                <input
                  type="tel"
                  id="telefono"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Campo de cupón de descuento */}
              {!esRegaloAdmin && !esOfertaAdmin && (
                <div className="form-group">
                  <label htmlFor="codigoCupon">Código de Cupón (Opcional)</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      id="codigoCupon"
                      name="codigoCupon"
                      value={codigoCupon}
                      onChange={(e) => {
                        setCodigoCupon(e.target.value.toUpperCase());
                        setCuponValidado(null);
                      }}
                      placeholder="Ingresa el código del cupón"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={handleValidarCupon}
                      disabled={validandoCupon || !codigoCupon.trim()}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: validandoCupon || !codigoCupon.trim() ? 'not-allowed' : 'pointer',
                        opacity: validandoCupon || !codigoCupon.trim() ? 0.6 : 1
                      }}
                    >
                      {validandoCupon ? 'Validando...' : 'Validar'}
                    </button>
                  </div>
                  {cuponValidado && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.75rem',
                      background: '#d4edda',
                      color: '#155724',
                      borderRadius: '5px',
                      fontSize: '0.9rem'
                    }}>
                      ✓ Cupón válido: {cuponValidado.porcentaje_descuento}% de descuento aplicado
                    </div>
                  )}
                </div>
              )}

              {((canSellWithVerification && canSellWithVerification()) && puedeOpcionesVentaAdmin) && (
                <div className="form-group compra-admin-opciones">
                  <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>Opciones de venta (admin / vendedor)</label>
                  <div className="admin-opcion">
                    <label>
                      <input
                        type="checkbox"
                        checked={esRegaloAdmin}
                        onChange={(e) => {
                          setEsRegaloAdmin(e.target.checked);
                          if (e.target.checked) setEsOfertaAdmin(false);
                        }}
                      />
                      <span> Entrada gratis (regalo del administrador)</span>
                    </label>
                  </div>
                  <div className="admin-opcion">
                    <label>
                      <input
                        type="checkbox"
                        checked={esOfertaAdmin}
                        onChange={(e) => {
                          setEsOfertaAdmin(e.target.checked);
                          if (e.target.checked) setEsRegaloAdmin(false);
                        }}
                      />
                      <span> Precio especial (oferta)</span>
                    </label>
                    {esOfertaAdmin && (
                      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span>Precio original total: Bs. {total.toFixed(2)}</span>
                          <span>Precio por entrada: </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Ej: 20"
                            value={precioEspecial}
                            onChange={(e) => setPrecioEspecial(e.target.value)}
                            style={{ width: '100px', padding: '6px' }}
                          />
                          <span>Bs. × {cantidadEntradas} = Bs. {(precioEspecial && !isNaN(parseFloat(precioEspecial)) ? parseFloat(precioEspecial) * cantidadEntradas : 0).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button type="submit" className="btn-confirmar-compra" disabled={enviando}>
                {enviando ? 'Procesando...' : (esRegaloAdmin ? 'Confirmar Compra - Gratis' : `Confirmar Compra - Bs. ${(esOfertaAdmin && precioEspecial && !isNaN(parseFloat(precioEspecial)) ? parseFloat(precioEspecial) * cantidadEntradas : totalConDescuento).toFixed(2)}`)}
              </button>
            </form>
          </div>

          {/* Sección 5: Resumen de Compra (Debajo de todo) */}
          <div className="compra-card compra-card-resumen">
            <h2>Resumen de Compra</h2>
            {!esEventoEspecial && (
              <>
                <div className="resumen-cantidad">
                  <span>Cantidad:</span>
                  <span>{cantidadEntradas} entrada{cantidadEntradas !== 1 ? 's' : ''}</span>
                </div>
                {evento.tipos_precio?.length > 0 && cantidadEntradas > 0 && (
                  <div className="resumen-tipos-general" style={{ marginTop: '8px', fontSize: '0.95rem' }}>
                    {evento.tipos_precio
                      .filter(tp => (cantidadesPorTipo[tp.id] || 0) > 0)
                      .map(tp => (
                        <div key={tp.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span>{tp.nombre}: {cantidadesPorTipo[tp.id] || 0} × Bs. {parseFloat(tp.precio).toFixed(2)}</span>
                          <span style={{ fontWeight: 600 }}>Bs. {((cantidadesPorTipo[tp.id] || 0) * parseFloat(tp.precio)).toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
            {esEventoEspecial && selecciones.length > 0 && (
              <div className="resumen-selecciones">
                <h3>Entradas Seleccionadas</h3>
                <div className="resumen-selecciones-lista">
                  {selecciones.map((sel, index) => {
                    if (sel.type === 'asiento') {
                      // Verificar si este asiento pertenece a una mesa completa seleccionada
                      const perteneceAMesaCompleta = selecciones.some(s => 
                        s.type === 'mesa_completa' && 
                        evento.asientos?.find(a => a.id === sel.id)?.mesa_id === s.mesa_id
                      );
                      // No mostrar asientos individuales si pertenecen a una mesa completa
                      if (perteneceAMesaCompleta) return null;
                      
                      return (
                        <div key={index} className="resumen-seleccion-item">
                          <span className="resumen-seleccion-nombre">{sel.nombre}</span>
                          <span className="resumen-seleccion-precio">Bs. {sel.precio.toFixed(2)}</span>
                        </div>
                      );
                    } else if (sel.type === 'mesa_completa') {
                      return (
                        <div key={index} className="resumen-seleccion-item resumen-mesa-completa">
                          <div className="resumen-mesa-info">
                            <span className="resumen-seleccion-nombre resumen-mesa-titulo">{sel.nombre}</span>
                            <span className="resumen-mesa-detalle">
                              Mesa {sel.codigo_mesa || sel.numero_mesa} • {sel.cantidad_sillas} sillas
                            </span>
                            <span className="resumen-mesa-sillas">
                              Sillas: {sel.sillas}
                            </span>
                          </div>
                          <span className="resumen-seleccion-precio resumen-precio-mesa">Bs. {sel.precio_total.toFixed(2)}</span>
                        </div>
                      );
                    } else if (sel.type === 'area_general') {
                      return (
                        <div key={index} className="resumen-seleccion-item" style={{ borderLeft: `4px solid ${sel.color || '#4CAF50'}` }}>
                          <div className="resumen-mesa-info">
                            <span className="resumen-seleccion-nombre" style={{ fontWeight: 'bold' }}>{sel.nombre}</span>
                            <span className="resumen-mesa-detalle" style={{ color: '#666', fontSize: '0.85rem' }}>
                              Cantidad: {sel.cantidad} × Bs. {sel.precio.toFixed(2)}
                            </span>
                          </div>
                          <span className="resumen-seleccion-precio">Bs. {sel.total.toFixed(2)}</span>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            )}
            <div className="resumen-detalle">
              {cuponValidado && !esRegaloAdmin && !esOfertaAdmin && (
                <>
                  <div className="resumen-item resumen-item-anterior">
                    <span>Total anterior (sin descuento)</span>
                    <span>Bs. {total.toFixed(2)}</span>
                  </div>
                  <div className="resumen-item" style={{ color: '#28a745' }}>
                    <span>Descuento ({cuponValidado.porcentaje_descuento}%)</span>
                    <span>- Bs. {descuentoCupon.toFixed(2)}</span>
                  </div>
                  <div className="resumen-item resumen-total resumen-total-con-descuento">
                    <span>Total con descuento (a pagar)</span>
                    <span className="resumen-total-monto">Bs. {totalConDescuento.toFixed(2)}</span>
                  </div>
                </>
              )}
              {!cuponValidado && !esRegaloAdmin && !esOfertaAdmin && (
                <div className="resumen-item resumen-total">
                  <span>Total a pagar</span>
                  <span className="resumen-total-monto">Bs. {totalConDescuento.toFixed(2)}</span>
                </div>
              )}
              {((canSellWithVerification && canSellWithVerification()) && puedeOpcionesVentaAdmin) && (esRegaloAdmin || (esOfertaAdmin && precioEspecial !== '')) && (
                <div className="resumen-item">
                  <span>Precio original</span>
                  <span>Bs. {total.toFixed(2)}</span>
                </div>
              )}
              {(esRegaloAdmin || esOfertaAdmin) && (
                <div className="resumen-item resumen-total">
                  <span>Total a pagar</span>
                  <span>
                    {esRegaloAdmin ? (
                      <span style={{ color: '#28a745', fontWeight: 700 }}>Gratis</span>
                    ) : esOfertaAdmin && precioEspecial !== '' && !isNaN(parseFloat(precioEspecial)) ? (
                      <span style={{ fontWeight: 700 }}>Bs. {(parseFloat(precioEspecial) * cantidadEntradas).toFixed(2)} <small style={{ fontWeight: 400, color: '#666' }}>({cantidadEntradas} × Bs. {parseFloat(precioEspecial).toFixed(2)})</small></span>
                    ) : (
                      `Bs. ${totalConDescuento.toFixed(2)}`
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Compra;
