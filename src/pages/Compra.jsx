import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { getApiBase, getServerBase } from '../api/base';
import api from '../api/axios';
import ModalTipoPago from '../components/ModalTipoPago';
import './Compra.css';

const serverBase = getServerBase();
const apiBase = getApiBase();

const Compra = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user, isAdmin, canSellWithVerification } = useAuth();
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
  const canvasRef = useRef(null);
  const escalaRef = useRef({ sx: 1, sy: 1, ox: 0, oy: 0, minX: 0, minY: 0, worldW: 1000, worldH: 1000 });
  const compraRealizadaRef = useRef(null);
  const [mostrarNumerosAsientos, setMostrarNumerosAsientos] = useState(true);

  useEffect(() => {
    // Verificar autenticación
    if (!isAuthenticated()) {
      navigate('/login', { state: { from: `/compra/${id}` } });
      return;
    }

    // Cargar evento desde la API
    cargarEvento();
  }, [id, isAuthenticated, navigate]);

  useEffect(() => {
    if (evento && evento.tipo_evento === 'especial' && canvasRef.current) {
      dibujarCanvas();
    }
  }, [evento, selecciones, asientosOcupados, mesasOcupadas, mostrarNumerosAsientos]);

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
            width: m.width || 40,
            height: m.height || 40
          }));
        }
        // Verificar si el evento está en estado "proximamente"
        if (eventoData.estado === 'proximamente') {
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

  const dibujarCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !evento) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const mesasMap = crearMapaMesas();

    // Limpiar canvas
    ctx.clearRect(0, 0, width, height);

    // Calcular bounds del contenido para escalar a todo el canvas
    const elementos = [];
    if (evento.escenario_x !== null && evento.escenario_y !== null && evento.escenario_width && evento.escenario_height) {
      elementos.push({ x: evento.escenario_x, y: evento.escenario_y, w: evento.escenario_width, h: evento.escenario_height });
    }
    (evento.areas || []).forEach(a => elementos.push({ x: a.posicion_x, y: a.posicion_y, w: a.ancho, h: a.alto }));
    (evento.mesas || []).forEach(m => elementos.push({ x: m.posicion_x || 0, y: m.posicion_y || 0, w: m.ancho || 30, h: m.alto || 30 }));
    (evento.asientos || []).forEach(s => elementos.push({ x: (s.x ?? s.posicion_x) || 0, y: (s.y ?? s.posicion_y) || 0, w: s.mesa_id ? 12 : 16, h: s.mesa_id ? 12 : 16 }));
    let minX = 10, minY = 10, maxX = width - 10, maxY = height - 10;
    if (elementos.length > 0) {
      minX = Math.min(...elementos.map(e => e.x)) - 20;
      minY = Math.min(...elementos.map(e => e.y)) - 20;
      maxX = Math.max(...elementos.map(e => e.x + e.w)) + 20;
      maxY = Math.max(...elementos.map(e => e.y + e.h)) + 20;
    }
    // Mundo desde el evento (persistido en admin). Fallback 1000x600
    const worldW = (evento.hoja_ancho && Number(evento.hoja_ancho)) ? Number(evento.hoja_ancho) : 1000;
    const worldH = (evento.hoja_alto && Number(evento.hoja_alto)) ? Number(evento.hoja_alto) : 600;
    minX = 0;
    minY = 0;
    const sx = (width - 20) / worldW;
    const sy = (height - 20) / worldH;
    const s = Math.min(sx, sy);
    const contentW = worldW * s;
    const contentH = worldH * s;
    const ox = 10 + (width - 20 - contentW) / 2 - minX * s;
    const oy = 10 + (height - 20 - contentH) / 2 - minY * s;
    escalaRef.current = { sx: s, sy: s, ox, oy, minX, minY, worldW, worldH };

    // Dibujar fondo del espacio según la forma (blanco, igual que admin) usando mundo escalado
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#333';
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
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(evento.escenario_x, evento.escenario_y, evento.escenario_width, evento.escenario_height);
      ctx.strokeStyle = '#654321';
      ctx.lineWidth = 3;
      ctx.strokeRect(evento.escenario_x, evento.escenario_y, evento.escenario_width, evento.escenario_height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ESCENARIO', evento.escenario_x + evento.escenario_width / 2, evento.escenario_y + evento.escenario_height / 2);
    }

    // Dibujar áreas (exactamente como en admin)
    if (evento.areas && Array.isArray(evento.areas)) {
      evento.areas.forEach(area => {
        ctx.fillStyle = area.color || '#CCCCCC';
        ctx.fillRect(area.posicion_x, area.posicion_y, area.ancho, area.alto);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.strokeRect(area.posicion_x, area.posicion_y, area.ancho, area.alto);
        
        // Dibujar nombre del área en la parte superior (cabecera) - igual que admin
        ctx.fillStyle = '#333';
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
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(textX - textWidth / 2 - 4, textY - textHeight - 2, textWidth + 8, textHeight + 4);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.strokeRect(textX - textWidth / 2 - 4, textY - textHeight - 2, textWidth + 8, textHeight + 4);
        
        // Dibujar el texto
        ctx.fillStyle = '#333';
        ctx.fillText(text, textX, textY);
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
        
        // Verificar si todos los asientos de la mesa están seleccionados
        const asientosMesa = evento.asientos?.filter(a => a.mesa_id === mesa.id) || [];
        const todosSeleccionados = asientosMesa.length > 0 && asientosMesa.every(a => 
          selecciones.some(sel => sel.type === 'asiento' && sel.id === a.id)
        );
        
        // Dibujar la mesa: rojo si está ocupada, marrón si no
        if (mesaOcupada) {
          // Mesa ocupada - color rojo
          ctx.fillStyle = '#e74c3c';
          ctx.fillRect(mesaX, mesaY, mesaWidth, mesaHeight);
          ctx.strokeStyle = '#c0392b';
          ctx.lineWidth = 3;
          ctx.strokeRect(mesaX, mesaY, mesaWidth, mesaHeight);
          
          // Dibujar X en la mesa ocupada
          ctx.strokeStyle = '#fff';
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
          ctx.fillStyle = '#8B4513';
          ctx.fillRect(mesaX, mesaY, mesaWidth, mesaHeight);
          ctx.strokeStyle = todosSeleccionados ? '#FFD700' : '#654321';
          ctx.lineWidth = todosSeleccionados ? 3 : 2;
          ctx.strokeRect(mesaX, mesaY, mesaWidth, mesaHeight);
        }
        
        if (mostrarNumerosAsientos) {
          ctx.fillStyle = '#FFD700';
          ctx.font = 'bold 11px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`M${mesa.numero_mesa}`, mesaX + mesaWidth / 2, mesaY + mesaHeight / 2);
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
        const tipoPrecio = evento.tipos_precio?.find(tp => tp.id === silla.tipo_precio_id);
        const estaSeleccionada = selecciones.some(sel => sel.type === 'asiento' && sel.id === silla.id);
        const estaOcupada = asientosOcupados.includes(silla.id);
        // Si la mesa está ocupada, todas sus sillas también están ocupadas
        const mesaOcupada = silla.mesa_id && mesasOcupadas.includes(silla.mesa_id);
        const sillaOcupada = estaOcupada || mesaOcupada;
        
        // Color de la silla: rojo si está ocupada (individual o por mesa), color normal si no
        const colorSilla = sillaOcupada ? '#e74c3c' : (tipoPrecio?.color || '#2196F3');
        
        // Dibujar silla 8x8 (más pequeña)
        ctx.fillStyle = colorSilla;
        ctx.fillRect(sillaX - 4, sillaY - 4, 8, 8);
        ctx.strokeStyle = estaSeleccionada ? '#FFD700' : (sillaOcupada ? '#c0392b' : '#333');
        ctx.lineWidth = estaSeleccionada ? 2 : (sillaOcupada ? 2 : 1);
        ctx.strokeRect(sillaX - 4, sillaY - 4, 8, 8);
        
        if (mostrarNumerosAsientos) {
          ctx.fillStyle = '#0d0d0d';
          ctx.font = 'bold 10px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          let numeroSilla = '';
          if (silla.numero_asiento) {
            if (silla.numero_asiento.includes('-')) {
              const parteSilla = silla.numero_asiento.split('-')[1];
              numeroSilla = parteSilla.replace('S', '');
            } else {
              numeroSilla = silla.numero_asiento.replace(/^[A-Za-z]+/, '');
            }
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
        const tipoPrecio = evento.tipos_precio?.find(tp => tp.id === asiento.tipo_precio_id);
        const estaSeleccionado = selecciones.some(sel => sel.type === 'asiento' && sel.id === asiento.id);
        const estaOcupado = asientosOcupados.includes(asiento.id);
        const colorAsiento = estaOcupado ? '#e74c3c' : (tipoPrecio?.color || '#2196F3');
        
        ctx.fillStyle = colorAsiento;
        ctx.fillRect(asientoX - 5, asientoY - 5, 10, 10);
        ctx.strokeStyle = estaSeleccionado ? '#FFD700' : (estaOcupado ? '#c0392b' : '#333');
        ctx.lineWidth = estaSeleccionado ? 3 : (estaOcupado ? 2 : 1);
        ctx.strokeRect(asientoX - 5, asientoY - 5, 10, 10);
        
        if (mostrarNumerosAsientos) {
          ctx.fillStyle = '#0d0d0d';
          ctx.font = 'bold 11px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(asiento.numero_asiento || '', asientoX, asientoY);
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
        const tipoPrecio = evento.tipos_precio?.find(tp => tp.id === persona.tipo_precio_id);
        const estaSeleccionado = selecciones.some(sel => sel.type === 'asiento' && sel.id === persona.id);
        const estaOcupado = asientosOcupados.includes(persona.id);
        const colorPersona = estaOcupado ? '#e74c3c' : (tipoPrecio?.color || '#4CAF50');
        const radio = 5;
        
        ctx.fillStyle = colorPersona;
        ctx.beginPath();
        ctx.arc(px, py, radio, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = estaSeleccionado ? '#FFD700' : (estaOcupado ? '#c0392b' : '#333');
        ctx.lineWidth = estaSeleccionado ? 3 : (estaOcupado ? 2 : 1);
        ctx.stroke();
        
        if (mostrarNumerosAsientos) {
          ctx.fillStyle = '#0d0d0d';
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


  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    const { sx, sy, ox, oy } = escalaRef.current;
    return { x: (px - ox) / sx, y: (py - oy) / sy, clientX: e.clientX, clientY: e.clientY };
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
    
    const x = pos.x;
    const y = pos.y;

    // Primero verificar si se hizo click en una mesa
    if (evento.mesas && Array.isArray(evento.mesas)) {
      for (const mesa of evento.mesas) {
        const mesaX = mesa.posicion_x || 50;
        const mesaY = mesa.posicion_y || 50;
          const mesaWidth = mesa.ancho || mesa.width || 40;
          const mesaHeight = mesa.alto || mesa.height || 40;
        
        // Verificar si el click está dentro del área de la mesa
        if (x >= mesaX && x <= mesaX + mesaWidth && 
            y >= mesaY && y <= mesaY + mesaHeight) {
          
          // Verificar si la mesa está ocupada
          if (mesasOcupadas.includes(mesa.id)) {
            showAlert('Esta mesa ya está ocupada y no está disponible', { type: 'warning' });
            return;
          }
          
          // Obtener todos los asientos de esta mesa
          const asientosMesa = evento.asientos?.filter(a => a.mesa_id === mesa.id) || [];
          
          if (asientosMesa.length === 0) {
            return; // No hay asientos en esta mesa
          }
          
          // Verificar si todos los asientos ya están seleccionados
          const todosSeleccionados = asientosMesa.every(a => 
            selecciones.some(sel => sel.type === 'asiento' && sel.id === a.id)
          );
          
          if (todosSeleccionados) {
            // Deseleccionar todos los asientos de la mesa y la entrada de mesa completa
            const idsAsientosMesa = asientosMesa.map(a => a.id);
            setSelecciones(prev => prev.filter(sel => 
              sel.type !== 'mesa_completa' || sel.mesa_id !== mesa.id
            ).filter(sel => !idsAsientosMesa.includes(sel.id)));
          } else {
            // Seleccionar todos los asientos de la mesa que estén disponibles
            const nuevasSelecciones = [];
            const asientosDisponibles = [];
            
            for (const asiento of asientosMesa) {
              // Verificar si el asiento está ocupado
              if (asientosOcupados.includes(asiento.id)) {
                continue; // Saltar asientos ocupados
              }
              
              // Verificar disponibilidad
              if (asiento.estado && asiento.estado !== 'disponible') {
                continue; // Saltar asientos no disponibles
              }
              
              // Verificar si ya está seleccionado
              const yaSeleccionado = selecciones.some(sel => sel.type === 'asiento' && sel.id === asiento.id);
              if (yaSeleccionado) continue;
              
              const tipoPrecio = evento.tipos_precio?.find(tp => tp.id === asiento.tipo_precio_id);
              let nombreArea = asiento.area_nombre;
              
              // Buscar área si no está en el asiento
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
              
              // Obtener información de la mesa si el asiento pertenece a una
              let textoMesa = '';
              if (asiento.mesa_id) {
                const mesaDelAsiento = evento.mesas?.find(m => m.id === asiento.mesa_id);
                if (mesaDelAsiento) {
                  textoMesa = ` de Mesa ${mesaDelAsiento.numero_mesa}`;
                }
              }
              
              const textoArea = nombreArea ? ` - ${nombreArea}` : '';
              nuevasSelecciones.push({
                type: 'asiento',
                id: asiento.id,
                tipo_precio_id: asiento.tipo_precio_id,
                precio: tipoPrecio?.precio || 0,
                nombre: `Asiento ${asiento.numero_asiento}${textoMesa}${textoArea}`,
                area_nombre: nombreArea || null
              });
              
              asientosDisponibles.push({
                id: asiento.id,
                numero: asiento.numero_asiento,
                precio: tipoPrecio?.precio || 0
              });
            }
            
            if (nuevasSelecciones.length > 0) {
              // Calcular precio total de la mesa
              const precioTotal = asientosDisponibles.reduce((sum, a) => sum + a.precio, 0);
              
              // Agregar entrada de mesa completa
              const entradaMesaCompleta = {
                type: 'mesa_completa',
                mesa_id: mesa.id,
                numero_mesa: mesa.numero_mesa,
                cantidad_sillas: asientosDisponibles.length,
                precio_total: precioTotal,
                nombre: `MESA COMPLETA M${mesa.numero_mesa}`,
                sillas: asientosDisponibles.map(a => a.numero).join(', ')
              };
              
              setSelecciones(prev => [...prev, ...nuevasSelecciones, entradaMesaCompleta]);
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
        
        // Radio de detección (más pequeño para sillas de mesas)
        const tamañoAsiento = asiento.mesa_id ? 5 : 6;
        const distancia = Math.sqrt(Math.pow(x - asientoX, 2) + Math.pow(y - asientoY, 2));
        
        if (distancia <= tamañoAsiento) {
          // Verificar si el asiento está ocupado
          if (asientosOcupados.includes(asiento.id)) {
            showAlert('Este asiento ya está ocupado y no está disponible', { type: 'warning' });
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

          const tipoPrecio = evento.tipos_precio?.find(tp => tp.id === asiento.tipo_precio_id);
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
            // Seleccionar - incluir información del área
            // Primero intentar usar area_nombre del asiento, si no existe, buscar por posición
            let nombreArea = asiento.area_nombre;
            
            // Si no tiene area_nombre directo, buscar por posición
            if (!nombreArea && evento.areas && Array.isArray(evento.areas) && evento.areas.length > 0) {
              // Buscar el área que contiene este asiento basándose en su posición
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
            
            // Obtener información de la mesa si el asiento pertenece a una
            let textoMesa = '';
            if (asiento.mesa_id) {
              const mesaDelAsiento = evento.mesas?.find(m => m.id === asiento.mesa_id);
              if (mesaDelAsiento) {
                textoMesa = ` de Mesa ${mesaDelAsiento.numero_mesa}`;
              }
            }
            
            const textoArea = nombreArea ? ` - ${nombreArea}` : '';
            setSelecciones(prev => [...prev, {
              type: 'asiento',
              id: asiento.id,
              tipo_precio_id: asiento.tipo_precio_id,
              precio: tipoPrecio?.precio || 0,
              nombre: `Asiento ${asiento.numero_asiento}${textoMesa}${textoArea}`,
              area_nombre: nombreArea || null
            }]);
          }
          return;
        }
      }
    }
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
      
      cantidadReal = cantidadMesas + asientosIndividuales.length;
    }
    
    // Registrar compra en la base de datos
    try {
      // Preparar asientos para enviar al backend
      const asientosParaBackend = [];
      const mesasParaBackend = [];
      
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
      if (canSellWithVerification && canSellWithVerification()) {
        if (esRegaloAdmin) {
          totalFinal = 0;
          tipoVenta = 'REGALO_ADMIN';
        } else if (esOfertaAdmin && precioEspecial !== '' && !isNaN(parseFloat(precioEspecial))) {
          totalFinal = parseFloat(precioEspecial) * cantidadReal;
          precioOriginal = total;
          tipoVenta = 'OFERTA_ADMIN';
        }
      }

      if (esRegaloAdmin) totalParaBackend = 0;
      else if (esOfertaAdmin && precioEspecial !== '' && !isNaN(parseFloat(precioEspecial))) {
        totalParaBackend = parseFloat(precioEspecial) * cantidadReal;
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
        mesas: mesasParaBackend
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
    if (esRegaloAdmin) body.tipo_venta = 'REGALO_ADMIN';
    else if (esOfertaAdmin && precioEspecial && !isNaN(parseFloat(precioEspecial))) {
      body.tipo_venta = 'OFERTA_ADMIN';
      body.precio_original = total;
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
    cantidadEntradas = cantidadMesas + asientosIndividuales.length;
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
                  <div style={{ width: '20px', height: '20px', backgroundColor: '#2196F3', border: '1px solid #333', borderRadius: '3px' }}></div>
                  <span>Disponible</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '20px', height: '20px', backgroundColor: '#e74c3c', border: '1px solid #c0392b', borderRadius: '3px', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>✕</div>
                  </div>
                  <span>Ocupado</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '20px', height: '20px', backgroundColor: '#2196F3', border: '3px solid #FFD700', borderRadius: '3px' }}></div>
                  <span>Seleccionado</span>
                </div>
              </div>
              <div style={{ position: 'relative', display: 'inline-block' }}>
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
                    display: 'block',
                    background: '#ffffff'
                  }}
                  onMouseMove={(e) => {
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    const pos = getMousePos(e);
                    if (!pos) return;
                    
                    let cursor = 'pointer';
                    const x = pos.x;
                    const y = pos.y;
                    
                    // Verificar si está sobre un asiento ocupado
                    if (evento.asientos && Array.isArray(evento.asientos)) {
                      const mesasMap = crearMapaMesas();
                      for (const asiento of evento.asientos) {
                        const { x: asientoX, y: asientoY } = obtenerPosicionAsiento(asiento, mesasMap);
                        if (asientoX === null || asientoY === null) continue;
                        
                        const tamañoAsiento = asiento.mesa_id ? 5 : 6;
                        const distancia = Math.sqrt(Math.pow(x - asientoX, 2) + Math.pow(y - asientoY, 2));
                        
                        if (distancia <= tamañoAsiento && asientosOcupados.includes(asiento.id)) {
                          cursor = 'not-allowed';
                          break;
                        }
                      }
                    }
                    
                    canvas.style.cursor = cursor;
                  }}
              />
              </div>
              {selecciones.length > 0 && (
                <div className="selecciones-resumen">
                  <h4>Selecciones</h4>
                  <div className="selecciones-lista">
                    {selecciones.map((sel, index) => {
                      // Filtrar solo asientos individuales y mesas completas
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
                                Mesa M{sel.numero_mesa} • {sel.cantidad_sillas} sillas
                              </span>
                              <span className="seleccion-mesa-sillas">
                                Sillas: {sel.sillas}
                              </span>
                            </div>
                            <span className="seleccion-precio seleccion-precio-mesa">Bs. {sel.precio_total.toFixed(2)}</span>
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
                      }
                      return sum;
                    }, 0).toFixed(2)}</span>
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

              {(canSellWithVerification && canSellWithVerification()) && (
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
                              Mesa M{sel.numero_mesa} • {sel.cantidad_sillas} sillas
                            </span>
                            <span className="resumen-mesa-sillas">
                              Sillas: {sel.sillas}
                            </span>
                          </div>
                          <span className="resumen-seleccion-precio resumen-precio-mesa">Bs. {sel.precio_total.toFixed(2)}</span>
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
              {(canSellWithVerification && canSellWithVerification()) && (esRegaloAdmin || (esOfertaAdmin && precioEspecial !== '')) && (
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
