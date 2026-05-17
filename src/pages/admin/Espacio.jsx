import { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../api/axios';
import { useAlert } from '../../context/AlertContext';
import './Espacio.css';
import Modal from '../../components/Modal.jsx';
import {
  HOJA_PRESETS,
  HOJA_LIMITS,
  MAX_ELEMENTOS_ZONA,
  COLOR_AREA_DEFAULT,
  COLORES_AREA_PRESETS,
  clampHojaDim,
  calcularTamanosLayout,
  hexToRgba,
} from '../../utils/layoutEspacio.js';
import { etiquetaMesa } from '../../utils/etiquetaMesa.js';
import { normalizarLetraMesa, obtenerSiguienteCodigoMesa } from '../../utils/codigoMesa.js';
import { normalizarLetraAsiento, obtenerSiguienteCodigoAsiento } from '../../utils/codigoAsiento.js';

const SelectorColorArea = ({ color, onChange, disabled = false }) => (
  <div className="espacio-color-area">
    <label className="espacio-color-area__label">Color de fondo del área</label>
    <div className="espacio-color-presets">
      {COLORES_AREA_PRESETS.map((preset) => (
        <button
          key={preset.hex}
          type="button"
          className={`espacio-color-swatch${color?.toUpperCase() === preset.hex.toUpperCase() ? ' espacio-color-swatch--activo' : ''}`}
          style={{ backgroundColor: preset.hex }}
          title={preset.nombre}
          disabled={disabled}
          onClick={() => onChange(preset.hex)}
        />
      ))}
    </div>
    <div className="espacio-color-custom">
      <input
        type="color"
        value={color || COLOR_AREA_DEFAULT}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      <span className="espacio-color-hex">{color || COLOR_AREA_DEFAULT}</span>
    </div>
  </div>
);

const Espacio = () => {
  const { showAlert, showConfirm } = useAlert();
  const [eventos, setEventos] = useState([]);
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null);
  const [tiposPrecio, setTiposPrecio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forma, setForma] = useState('rectangulo'); // rectangulo, cuadrado, triangulo, circulo
  const [modo, setModo] = useState('escenario'); // escenario, area, asiento_individual, persona_individual, zona_asientos, zona_mesas, zona_mesas_solas, zona_personas, mesas, mesa_individual, seleccionar
  const [tipoPrecioSeleccionado, setTipoPrecioSeleccionado] = useState(null);
  const [layoutBloqueado, setLayoutBloqueado] = useState(false); // Modo solo lectura después de guardar
  const [elementoInfo, setElementoInfo] = useState(null); // Información del elemento seleccionado para mostrar
  const [mostrarModalResumen, setMostrarModalResumen] = useState(false); // Controlar modal de resumen
  const [resumenLayout, setResumenLayout] = useState(null); // Resumen del layout para el modal
  const [mostrarModalProgreso, setMostrarModalProgreso] = useState(false); // Controlar modal de progreso
  const [progresoGuardado, setProgresoGuardado] = useState({ mensaje: '', porcentaje: 0, detalles: [] });
  
  // Selección múltiple
  const [elementosSeleccionados, setElementosSeleccionados] = useState([]); // [{type: 'asiento', id}]
  const [seleccionCuadro, setSeleccionCuadro] = useState(null); // {x, y, width, height} para el cuadro de selección
  const [posicionesOriginales, setPosicionesOriginales] = useState({}); // {asiento_id: {x, y}}
  
  // Elementos del layout
  const [escenario, setEscenario] = useState(null); // {x, y, width, height}
  const [areas, setAreas] = useState([]); // [{id, nombre, x, y, width, height, color}]
  const [zonaAsientos, setZonaAsientos] = useState(null); // {x, y, width, height, cantidad, tipo_precio_id}
  const [zonaMesas, setZonaMesas] = useState(null); // {x, y, width, height, cantidad, sillasPorMesa, tipo_precio_id}
  const [zonaMesasSolas, setZonaMesasSolas] = useState(null); // zona mesas sin sillas (A1, A2… auto)
  const [zonaPersonas, setZonaPersonas] = useState(null); // zona de personas dibujada (para mostrar)
  const [asientos, setAsientos] = useState([]); // [{id, x, y, numero_asiento, tipo_precio_id, mesa_id}]
  const [mesas, setMesas] = useState([]); // [{id, x, y, width, height, numero_mesa, capacidad_sillas, tipo_precio_id}]
  
  // Configuración de área
  const [nombreArea, setNombreArea] = useState(''); // Nombre de la nueva área
  const [nombreAreaModal, setNombreAreaModal] = useState('');
  const [colorAreaNueva, setColorAreaNueva] = useState(COLOR_AREA_DEFAULT);
  const [mostrarModalNombreArea, setMostrarModalNombreArea] = useState(false); // Controlar modal de nombre de área
  const [areaPendiente, setAreaPendiente] = useState(null); // Área dibujada esperando nombre

  const cambiarColorArea = (areaId, nuevoColor) => {
    setAreas((prev) => prev.map((a) => (a.id === areaId ? { ...a, color: nuevoColor } : a)));
  };

  // Handler para confirmar nombre del área
  const handleConfirmarNombreArea = () => {
    const nombre = (nombreAreaModal || nombreArea).trim();
    if (areaPendiente && nombre) {
      const nuevaArea = {
        id: `temp_area_${Date.now()}`,
        nombre,
        x: areaPendiente.x,
        y: areaPendiente.y,
        width: areaPendiente.width,
        height: areaPendiente.height,
        color: colorAreaNueva || COLOR_AREA_DEFAULT,
        forma: areaPendiente.forma || 'rectangulo',
        tipo_area: 'SILLAS',
        capacidad_personas: null
      };
      setAreas([...areas, nuevaArea]);
      setNombreArea(nombre);
      setAreaPendiente(null);
      setCurrentElement(null);
      setMostrarModalNombreArea(false); // Cerrar el modal
      dibujarCanvas(); // Redibujar para mostrar el área
    } else {
      // Si cancela, limpiar el preview
      setAreaPendiente(null);
      setCurrentElement(null);
      setMostrarModalNombreArea(false); // Cerrar el modal
      dibujarCanvas(); // Redibujar para limpiar el preview
    }
  };

  const handleCancelarNombreArea = () => {
    setAreaPendiente(null);
    setCurrentElement(null);
    setMostrarModalNombreArea(false); // Cerrar el modal
    dibujarCanvas(); // Redibujar para limpiar el preview
  };

  const abrirEditarArea = (area) => {
    setAreaEnEdicion({ ...area });
    setMostrarModalEditarArea(true);
  };

  const getCamposPrecioMesa = () => ({
    precio_mesa_completa:
      mesaPrecioCompleta !== '' && !Number.isNaN(parseFloat(mesaPrecioCompleta))
        ? parseFloat(mesaPrecioCompleta)
        : null,
    precio_silla_individual:
      mesaVentaSoloMesa ||
      mesaPrecioSilla === '' ||
      Number.isNaN(parseFloat(mesaPrecioSilla))
        ? null
        : parseFloat(mesaPrecioSilla),
    venta_solo_mesa: mesasSinSillasVisibles || mesaVentaSoloMesa ? 1 : 0,
  });

  const codigoMesaDuplicado = (codigo, excluirId = null, posX = null, posY = null) => {
    const c = String(codigo || '').trim().toUpperCase();
    if (!c) return false;
    let areaActual = null;
    if (posX !== null && posY !== null) {
      areaActual = detectarAreaEnPosicion(posX, posY);
    } else if (excluirId) {
      const mObj = mesas.find(m => m.id === excluirId);
      if (mObj) {
        areaActual = detectarAreaEnPosicion((mObj.x || 0) + (mObj.width || 0) / 2, (mObj.y || 0) + (mObj.height || 0) / 2);
      }
    }
    return mesas.some((m) => {
      if (m.id === excluirId) return false;
      if (String(m.codigo_mesa || '').trim().toUpperCase() !== c) return false;
      const areaM = detectarAreaEnPosicion((m.x || 0) + (m.width || 0) / 2, (m.y || 0) + (m.height || 0) / 2);
      if (areaActual?.id && areaM?.id) {
        return areaActual.id === areaM.id;
      }
      if (!areaActual && !areaM) {
        return true; // Ambos fuera de áreas, es duplicado
      }
      return false; // Uno dentro y otro fuera, no es duplicado
    });
  };

  const agregarSillasDeMesaAlEstado = (mesa) => {
    if (mesasSinSillasVisibles) return;
    const sillas = generarSillasAlrededorMesa(mesa).map((s) => {
      const c = clampPointToSheet(s.x, s.y, 14);
      return { ...s, x: c.x, y: c.y };
    });
    if (sillas.length) setAsientos((prev) => [...prev, ...sillas]);
  };

  const aplicarPreciosAMesa = (mesaId) => {
    const campos = getCamposPrecioMesa();
    const codigo = codigoMesaEdit.trim().toUpperCase() || null;
    const mesaObj = mesas.find(m => m.id === mesaId);
    const mesaX = mesaObj ? (mesaObj.x + mesaObj.width / 2) : null;
    const mesaY = mesaObj ? (mesaObj.y + mesaObj.height / 2) : null;
    if (codigo && codigoMesaDuplicado(codigo, mesaId, mesaX, mesaY)) {
      showAlert(`Ya existe la mesa ${codigo} en esta área`, { type: 'warning' });
      return;
    }
    const payload = { ...campos, ...(codigo ? { codigo_mesa: codigo } : {}) };
    setMesas((prev) =>
      prev.map((m) => (m.id === mesaId ? { ...m, ...payload } : m))
    );
    if (typeof mesaId === 'number' && mesaId <= 1000000 && eventoSeleccionado) {
      api.put(`/mesas/${mesaId}`, payload).catch((e) => console.warn('Precios mesa:', e));
    }
    showAlert('Mesa actualizada', { type: 'success' });
  };

  const resolverCodigoNuevaMesa = (listaBase = mesas, x, y) => {
    if (mesasSinSillasVisibles || modo === 'zona_mesas_solas' || modo === 'mesa_individual' || modo === 'mesas') {
      let acumulado = listaBase;
      if (x !== undefined && y !== undefined) {
        const area = detectarAreaEnPosicion(x, y);
        if (area) {
          acumulado = listaBase.filter(m => {
            const mArea = detectarAreaEnPosicion((m.x || 0) + (m.width || 0) / 2, (m.y || 0) + (m.height || 0) / 2);
            return mArea?.id === area.id;
          });
        }
      }
      return obtenerSiguienteCodigoMesa(acumulado, letraMesa);
    }
    const manual = codigoMesaEdit.trim().toUpperCase();
    return manual || null;
  };

  const guardarEdicionArea = () => {
    if (!areaEnEdicion) return;
    if (areaEnEdicion.tipo_area === 'PERSONAS' && (!areaEnEdicion.capacidad_personas || areaEnEdicion.capacidad_personas < 1)) {
      showAlert('Para zona de personas debes indicar la capacidad (mínimo 1)', { type: 'warning' });
      return;
    }
    setAreas(areas.map(a => a.id === areaEnEdicion.id ? { ...a, ...areaEnEdicion } : a));
    setAreaEnEdicion(null);
    setMostrarModalEditarArea(false);
    dibujarCanvas();
  };
  
  // Configuración de generación automática
  const [cantidadAsientos, setCantidadAsientos] = useState(10);
  const [cantidadPersonas, setCantidadPersonas] = useState(50); // Límite para Zona Personas
  
  // Configuración de mesas
  const [cantidadMesas, setCantidadMesas] = useState(1);
  const [sillasPorMesa, setSillasPorMesa] = useState(4);
  const [mesasSinSillasVisibles, setMesasSinSillasVisibles] = useState(true);
  const [letraMesa, setLetraMesa] = useState('A');
  const [letraAsiento, setLetraAsiento] = useState('A');
  const [paridadAsiento, setParidadAsientoState] = useState('normal'); // 'normal' | 'impar' | 'par'
  const paridadAsientoRef = useRef('normal');
  const setParidadAsiento = (v) => { paridadAsientoRef.current = v; setParidadAsientoState(v); };
  const [paridadMesaSola, setParidadMesoSolaState] = useState('normal'); // 'normal' | 'impar' | 'par'
  const paridadMesaSolaRef = useRef('normal');
  const setParidadMesaSola = (v) => { paridadMesaSolaRef.current = v; setParidadMesoSolaState(v); };
  const [codigoMesaEdit, setCodigoMesaEdit] = useState('');
  const [mesaPrecioCompleta, setMesaPrecioCompleta] = useState('');
  const [mesaPrecioSilla, setMesaPrecioSilla] = useState('');
  const [mesaVentaSoloMesa, setMesaVentaSoloMesa] = useState(false);
  const [formaMesa, setFormaMesa] = useState('rectangulo'); // cuadrado, rectangulo
  const [mostrarModalEditarArea, setMostrarModalEditarArea] = useState(false);
  const [areaEnEdicion, setAreaEnEdicion] = useState(null); // área que se está editando (tipo, capacidad)
  const [hojaAncho, setHojaAncho] = useState(2500);
  const [hojaAlto, setHojaAlto] = useState(1800);
  const [hojaAnchoInput, setHojaAnchoInput] = useState('2500');
  const [hojaAltoInput, setHojaAltoInput] = useState('1800');
  const [escalaIconos, setEscalaIconos] = useState(0.55);
  const [guardandoTamanoHoja, setGuardandoTamanoHoja] = useState(false);

  const canvasRef = useRef(null);
  const miniCanvasRef = useRef(null);
  const [mostrarCanvasAmpliado, setMostrarCanvasAmpliado] = useState(false);
  const [mostrarNumerosAsientos, setMostrarNumerosAsientos] = useState(true);

  const layoutSizes = useMemo(() => calcularTamanosLayout(escalaIconos), [escalaIconos]);
  const totalElementosDibujo = asientos.length + mesas.length;
  const dibujarNumerosEnCanvas = mostrarNumerosAsientos && totalElementosDibujo <= 2000;

  // Limitar coordenadas a los bordes de la hoja (todo debe quedar dentro)
  const clampRectToSheet = (rect) => {
    let { x, y, width, height } = rect;
    if (x < 0) { width += x; x = 0; }
    if (y < 0) { height += y; y = 0; }
    if (x + width > hojaAncho) width = hojaAncho - x;
    if (y + height > hojaAlto) height = hojaAlto - y;
    if (width < 0) width = 0;
    if (height < 0) height = 0;
    return { x, y, width, height };
  };
  const clampPointToSheet = (x, y, size = 16) => {
    const margin = Math.ceil(size / 2) + 2;
    return {
      x: Math.max(margin, Math.min(hojaAncho - margin, x)),
      y: Math.max(margin, Math.min(hojaAlto - margin, y))
    };
  };
  const clampMesaToSheet = (x, y, w, h) => ({
    x: Math.max(0, Math.min(hojaAncho - w, x)),
    y: Math.max(0, Math.min(hojaAlto - h, y))
  });
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [currentElement, setCurrentElement] = useState(null);
  const [currentZone, setCurrentZone] = useState(null);
  const [elementoArrastrando, setElementoArrastrando] = useState(null); // {type: 'asiento', id, offsetX, offsetY}
  const [mousePosition, setMousePosition] = useState(null); // {x, y} para mostrar el cursor

  useEffect(() => {
    cargarEventos();
    
    // Listener para tecla Escape para deseleccionar
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setElementosSeleccionados([]);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Guardar el ID del evento anterior para detectar cambios
  const eventoAnteriorRef = useRef(null);
  const layoutBloqueadoAnteriorRef = useRef(false);

  useEffect(() => {
    // Limpiar el canvas solo cuando cambia el evento (no en la carga inicial)
    if (eventoAnteriorRef.current !== null && eventoAnteriorRef.current !== eventoSeleccionado?.id) {
      // El evento cambió, solo limpiar el estado local (NO borrar de BD si estaba bloqueado)
      // Solo limpiar estado local, no borrar de la base de datos
      setEscenario(null);
      setAreas([]);
      setZonaAsientos(null);
      setZonaMesas(null);
      setAsientos([]);
      setMesas([]);
      setElementosSeleccionados([]);
      setSeleccionCuadro(null);
      setElementoInfo(null);
      setNombreArea('');
      setLayoutBloqueado(false);
      setModo('escenario');
      setCurrentElement(null);
      setCurrentZone(null);
      setIsDrawing(false);
      setStartPos(null);
      setElementoArrastrando(null);
      setPosicionesOriginales({});
      setForma('rectangulo');
    }
    
    if (eventoSeleccionado) {
      eventoAnteriorRef.current = eventoSeleccionado.id;
      cargarTiposPrecio(eventoSeleccionado.id);
      cargarLayout(eventoSeleccionado.id);
    } else {
      // Si no hay evento seleccionado, limpiar todo
      limpiarEspacio(false);
      eventoAnteriorRef.current = null;
      layoutBloqueadoAnteriorRef.current = false;
    }
  }, [eventoSeleccionado]);

  // Función para limpiar todo el espacio de dibujo (tanto del estado como de la base de datos)
  const limpiarEspacio = async (confirmar = false) => {
    // Si el layout está bloqueado, no permitir limpiar
    if (layoutBloqueado) {
      showAlert('No se puede limpiar el espacio porque el layout está bloqueado. Desbloquéalo primero para poder editarlo.', { type: 'warning' });
      return;
    }

    // Si hay elementos dibujados y se requiere confirmación, preguntar
    const tieneElementos = escenario || areas.length > 0 || asientos.length > 0;
    
    if (confirmar && tieneElementos) {
      const confirmado = await showConfirm('¿Estás seguro de que deseas limpiar todo el espacio? Se eliminarán TODOS los elementos, incluyendo los guardados en la base de datos.', { 
        type: 'warning',
        title: 'Limpiar Espacio'
      });
      if (!confirmado) {
        return;
      }
    }

    // Si hay un evento seleccionado, eliminar también de la base de datos
    if (eventoSeleccionado && !layoutBloqueado) {
      try {
        // Obtener todos los elementos existentes
        const [mesasRes, asientosRes, areasRes] = await Promise.all([
          api.get(`/mesas/evento/${eventoSeleccionado.id}`),
          api.get(`/asientos/evento/${eventoSeleccionado.id}`),
          api.get(`/areas/evento/${eventoSeleccionado.id}`)
        ]);

        // Eliminar todas las mesas (aunque ya no las usemos, limpiar las existentes)
        if (mesasRes.data.success && mesasRes.data.data.length > 0) {
          for (const mesa of mesasRes.data.data) {
            try {
              await api.delete(`/mesas/${mesa.id}`);
            } catch (error) {
              if (error.response?.status !== 404) {
                console.warn('Error al eliminar mesa:', error);
              }
            }
          }
        }

        // Eliminar todos los asientos
        if (asientosRes.data.success && asientosRes.data.data.length > 0) {
          for (const asiento of asientosRes.data.data) {
            try {
              await api.delete(`/asientos/${asiento.id}`);
            } catch (error) {
              if (error.response?.status !== 404) {
                console.warn('Error al eliminar asiento:', error);
              }
            }
          }
        }

        // Eliminar todas las áreas
        if (areasRes.data.success && areasRes.data.data.length > 0) {
          for (const area of areasRes.data.data) {
            try {
              await api.delete(`/areas/${area.id}`);
            } catch (error) {
              if (error.response?.status !== 404) {
                console.warn('Error al eliminar área:', error);
              }
            }
          }
        }

        // Limpiar escenario y forma del espacio en el evento
        await api.put(`/eventos/${eventoSeleccionado.id}`, {
          forma_espacio: null,
          escenario_x: null,
          escenario_y: null,
          escenario_width: null,
          escenario_height: null,
          layout_bloqueado: false
        });
      } catch (error) {
        console.error('Error al limpiar espacio en la base de datos:', error);
        showAlert('Error al limpiar el espacio en la base de datos. Se limpió solo el estado local.', { type: 'error' });
      }
    }

    // Limpiar el estado local
    setEscenario(null);
    setAreas([]);
    setZonaAsientos(null);
    setAsientos([]);
    setMesas([]);
    setElementosSeleccionados([]);
    setSeleccionCuadro(null);
    setElementoInfo(null);
    setNombreArea('');
    setLayoutBloqueado(false);
    setModo('escenario');
    setCurrentElement(null);
    setCurrentZone(null);
    setIsDrawing(false);
    setStartPos(null);
    setElementoArrastrando(null);
    setPosicionesOriginales({});
    setForma('rectangulo'); // Resetear forma a rectángulo
  };

  useEffect(() => {
    setHojaAnchoInput(String(hojaAncho));
    setHojaAltoInput(String(hojaAlto));
  }, [hojaAncho, hojaAlto]);

  useEffect(() => {
    dibujarCanvas();
  }, [forma, escenario, areas, zonaAsientos, zonaPersonas, asientos, mesas, eventoSeleccionado, elementosSeleccionados, seleccionCuadro, mostrarNumerosAsientos, hojaAncho, hojaAlto, escalaIconos, layoutSizes, colorAreaNueva, nombreArea]);

  useEffect(() => {
    dibujarCanvasMini();
  }, [forma, escenario, areas, asientos, mesas, eventoSeleccionado, mostrarNumerosAsientos, hojaAncho, hojaAlto, escalaIconos]);

  useEffect(() => {
    if (eventoSeleccionado) {
      setMostrarCanvasAmpliado(true);
    }
  }, [eventoSeleccionado]);

  const aplicarTamanoHoja = async (ancho, alto, { guardarEnDb = false } = {}) => {
    const { ancho: w, alto: h } = clampHojaDim(ancho, alto);
    setHojaAncho(w);
    setHojaAlto(h);
    setHojaAnchoInput(String(w));
    setHojaAltoInput(String(h));
    if (!guardarEnDb || !eventoSeleccionado) return;
    setGuardandoTamanoHoja(true);
    try {
      await api.put(`/eventos/${eventoSeleccionado.id}`, { hoja_ancho: w, hoja_alto: h });
      showAlert(`Hoja guardada: ${w} × ${h} px`, { type: 'success' });
    } catch (error) {
      showAlert(error.response?.data?.message || 'Error al guardar tamaño de hoja', { type: 'error' });
    } finally {
      setGuardandoTamanoHoja(false);
    }
  };

  const renderTamanoHojaSection = () => (
    <div className="control-section espacio-hoja-section">
      <h3>Hoja y escala</h3>
      <p className="espacio-hoja-hint">
        Hoja: <strong>{hojaAncho} × {hojaAlto} px</strong>
        {totalElementosDibujo > 2000 && (
          <span> · Usa scroll en el dibujo. Con +2000 iconos conviene ocultar números.</span>
        )}
      </p>
      <div className="espacio-hoja-presets">
        {HOJA_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={hojaAncho === preset.ancho && hojaAlto === preset.alto ? 'espacio-hoja-preset active' : 'espacio-hoja-preset'}
            onClick={() => aplicarTamanoHoja(preset.ancho, preset.alto)}
            disabled={layoutBloqueado}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="espacio-hoja-custom">
        <div className="form-group-small">
          <label>Ancho (px)</label>
          <input
            type="number"
            min={HOJA_LIMITS.minAncho}
            max={HOJA_LIMITS.maxAncho}
            value={hojaAnchoInput}
            onChange={(e) => setHojaAnchoInput(e.target.value)}
            className="select-input"
            disabled={layoutBloqueado}
          />
        </div>
        <div className="form-group-small">
          <label>Alto (px)</label>
          <input
            type="number"
            min={HOJA_LIMITS.minAlto}
            max={HOJA_LIMITS.maxAlto}
            value={hojaAltoInput}
            onChange={(e) => setHojaAltoInput(e.target.value)}
            className="select-input"
            disabled={layoutBloqueado}
          />
        </div>
      </div>
      <div className="espacio-hoja-actions">
        <button type="button" className="btn-hoja-aplicar" disabled={layoutBloqueado} onClick={() => aplicarTamanoHoja(hojaAnchoInput, hojaAltoInput)}>
          Aplicar hoja
        </button>
        <button
          type="button"
          className="btn-hoja-guardar"
          disabled={layoutBloqueado || !eventoSeleccionado || guardandoTamanoHoja}
          onClick={() => aplicarTamanoHoja(hojaAnchoInput, hojaAltoInput, { guardarEnDb: true })}
        >
          {guardandoTamanoHoja ? 'Guardando…' : 'Guardar hoja en evento'}
        </button>
      </div>
      <div className="form-group-small espacio-escala-slider">
        <label>Tamaño iconos ({Math.round(escalaIconos * 100)}%)</label>
        <input
          type="range"
          min="40"
          max="120"
          value={Math.round(escalaIconos * 100)}
          onChange={(e) => setEscalaIconos(Number(e.target.value) / 100)}
          disabled={layoutBloqueado}
        />
        <p className="espacio-hoja-hint">Personas, sillas, mesas y asientos más pequeños = más caben en la misma zona.</p>
      </div>
    </div>
  );

  const renderHerramientasPanel = (enModal = false) => (
      <div
        style={
          enModal
            ? {
                flex: '1 1 320px',
                maxWidth: '360px',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                padding: '12px',
                minWidth: '280px'
              }
            : undefined
        }
      >
      {renderTamanoHojaSection()}
      <div className="control-section">
        <h3>Herramientas</h3>
        <div className="modo-buttons">
          <button
            className={modo === 'escenario' ? 'active' : ''}
            onClick={() => {
              if (!layoutBloqueado) {
                setModo('escenario');
                setElementosSeleccionados([]);
              }
            }}
            disabled={layoutBloqueado}
            title={layoutBloqueado ? 'Layout bloqueado' : 'Dibujar escenario'}
          >
            🎭 Escenario
          </button>
          <button
            className={modo === 'area' ? 'active' : ''}
            onClick={() => {
              if (!layoutBloqueado) {
                setModo('area');
                setElementosSeleccionados([]);
              }
            }}
            disabled={layoutBloqueado}
            title={layoutBloqueado ? 'Layout bloqueado' : 'Dibujar área personalizada'}
          >
            📐 Área Personalizada
          </button>
          <button
            className={modo === 'seleccionar' ? 'active' : ''}
            onClick={() => {
              setModo('seleccionar');
              setElementoInfo(null);
            }}
            title={
              layoutBloqueado
                ? 'Ver información de elementos'
                : 'Selecciona y mueve múltiples elementos. Shift+clic para selección múltiple, arrastra para cuadro de selección'
            }
          >
            🖱️ {layoutBloqueado ? 'Ver Info' : 'Seleccionar/Mover'}
          </button>
          <button
            className={modo === 'asiento_individual' ? 'active' : ''}
            onClick={() => {
              if (!layoutBloqueado) {
                setModo('asiento_individual');
                setElementosSeleccionados([]);
              }
            }}
            disabled={layoutBloqueado || !tipoPrecioSeleccionado}
            title={layoutBloqueado ? 'Layout bloqueado' : 'Haz clic en el canvas para colocar un asiento'}
          >
            💺 Asiento Individual
          </button>
          <button
            className={modo === 'persona_individual' ? 'active' : ''}
            onClick={() => {
              if (!layoutBloqueado) {
                setModo('persona_individual');
                setElementosSeleccionados([]);
              }
            }}
            disabled={layoutBloqueado || !tipoPrecioSeleccionado}
            title={layoutBloqueado ? 'Layout bloqueado' : 'Haz clic para colocar una persona (círculo). Mover, eliminar y asignar precio como asientos.'}
          >
            👤 Persona Individual
          </button>
          <button
            className={modo === 'mesas' ? 'active' : ''}
            onClick={() => {
              if (!layoutBloqueado) {
                setModo('mesas');
                setMesasSinSillasVisibles(true);
                setElementosSeleccionados([]);
              }
            }}
            disabled={layoutBloqueado || !tipoPrecioSeleccionado}
            title={layoutBloqueado ? 'Layout bloqueado' : 'Coloca mesas con código automático A1, A2…'}
          >
            🪑 Mesas
          </button>
          <button
            className={modo === 'mesa_individual' ? 'active' : ''}
            onClick={() => {
              if (!layoutBloqueado) {
                setModo('mesa_individual');
                setElementosSeleccionados([]);
              }
            }}
            disabled={layoutBloqueado || !tipoPrecioSeleccionado}
            title={layoutBloqueado ? 'Layout bloqueado' : 'Coloca una mesa individual con sus sillas'}
          >
            🪑 Mesa individual
          </button>
          <button
            className={modo === 'zona_asientos' ? 'active' : ''}
            onClick={() => {
              if (!layoutBloqueado) {
                setModo('zona_asientos');
                setElementosSeleccionados([]);
              }
            }}
            disabled={layoutBloqueado || !tipoPrecioSeleccionado}
            title={layoutBloqueado ? 'Layout bloqueado' : 'Dibuja una zona y los asientos se generarán automáticamente'}
          >
            📦 Zona Asientos (Auto)
          </button>
          <button
            className={modo === 'zona_mesas' ? 'active' : ''}
            onClick={() => {
              if (!layoutBloqueado) {
                setModo('zona_mesas');
                setElementosSeleccionados([]);
              }
            }}
            disabled={layoutBloqueado || !tipoPrecioSeleccionado}
            title={layoutBloqueado ? 'Layout bloqueado' : 'Dibuja una zona y las mesas con sillas se generarán automáticamente'}
          >
            🪑 Mesas con Sillas (Auto)
          </button>
          <button
            className={modo === 'zona_mesas_solas' ? 'active' : ''}
            onClick={() => {
              if (!layoutBloqueado) {
                setModo('zona_mesas_solas');
                setMesasSinSillasVisibles(true);
                setElementosSeleccionados([]);
              }
            }}
            disabled={layoutBloqueado || !tipoPrecioSeleccionado}
            title={layoutBloqueado ? 'Layout bloqueado' : 'Zona: mesas A1, A2… sin sillas'}
          >
            📋 Mesas sin sillas (Auto)
          </button>
        </div>
        
      </div>

      <div className="control-section">
        <h3>Tipos de Precio</h3>
        <select
          value={tipoPrecioSeleccionado || ''}
          onChange={(e) => setTipoPrecioSeleccionado(parseInt(e.target.value))}
          className="select-input"
        >
          <option value="">-- Selecciona tipo --</option>
          {tiposPrecio.map(tp => (
            <option key={tp.id} value={tp.id}>
              {tp.nombre} - ${tp.precio}
            </option>
          ))}
        </select>
        {tiposPrecio.length > 0 && (
          <div style={{ marginTop: '10px', fontSize: '12px' }}>
            <strong>Colores asignados:</strong>
            <div style={{ marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {tiposPrecio.map(tp => (
                <div key={tp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      backgroundColor: tp.color || '#CCCCCC',
                      border: '1px solid #333',
                      borderRadius: '3px'
                    }}
                  />
                  <span>{tp.nombre} - ${tp.precio}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderCanvas = (ampliado = false, sinInstrucciones = false) => {
    const width = hojaAncho;
    const height = hojaAlto;

    const baseStyle = { padding: 0, margin: 0, width: '100%', overflow: 'auto', boxSizing: 'border-box' };
    return (
      <div
        className={`espacio-canvas-container${ampliado ? ' espacio-canvas-container--ampliado' : ''}`}
        style={ampliado ? { padding: 0, margin: 0, boxSizing: 'border-box' } : baseStyle}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="espacio-canvas"
          style={{
            display: 'block',
            width: `${width}px`,
            height: `${height}px`,
            maxWidth: 'none',
            flexShrink: 0,
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseLeave}
          onContextMenu={(e) => e.preventDefault()}
        />
        {!sinInstrucciones && (
          <div className="canvas-instructions">
            <p>
              {layoutBloqueado ? (
                modo === 'seleccionar'
                  ? 'Haz clic en cualquier elemento para ver su información detallada'
                  : 'Layout bloqueado. Usa "Ver Info" para ver detalles de los elementos.'
              ) : (
                <>
                  {modo === 'escenario' && 'Haz clic y arrastra para dibujar el escenario'}
                  {modo === 'area' && 'Elige el color de fondo, dibuja el rectángulo y confirma nombre y color al terminar.'}
                  {modo === 'seleccionar' && 'Clic para seleccionar, Shift+clic para selección múltiple, arrastra para cuadro de selección. Arrastra elementos seleccionados para moverlos todos juntos.'}
                  {modo === 'asiento_individual' && 'Haz clic en el canvas para colocar un asiento. Arrastra los asientos existentes para moverlos. Clic derecho o Ctrl+clic para eliminar.'}
                  {modo === 'persona_individual' && 'Haz clic para colocar una persona (círculo). Arrastra para mover. Clic derecho o Ctrl+clic para eliminar. Selecciona y asigna precio como los demás.'}
                  {modo === 'zona_asientos' && 'Haz clic y arrastra para dibujar la zona de asientos. Los asientos se generarán automáticamente.'}
                  {modo === 'zona_mesas' && 'Haz clic y arrastra para dibujar la zona de mesas. Las mesas con sillas se generarán automáticamente.'}
                  {modo === 'zona_mesas_solas' && `Haz clic y arrastra una zona. Se crearán mesas ${normalizarLetraMesa(letraMesa)}1, ${normalizarLetraMesa(letraMesa)}2… sin dibujar sillas.`}
                  {(modo === 'mesas' || modo === 'mesa_individual') && mesasSinSillasVisibles && `Coloca mesas una a una: siguiente ${obtenerSiguienteCodigoMesa(mesas, letraMesa)}.`}
                  {modo === 'zona_personas' && `Haz clic y arrastra para dibujar la zona. Se generarán hasta ${cantidadPersonas} personas (círculos).`}
                </>
              )}
            </p>
          </div>
        )}
      </div>
    );
  };

  const cargarEventos = async () => {
    try {
      setLoading(true);
      const response = await api.get('/eventos');
      if (response.data.success) {
        // Filtrar solo eventos especiales (con múltiples precios: VIP, Balcón, etc.)
        // No mostrar eventos con precio único (tipo_evento = 'general')
        const eventosEspeciales = response.data.data.filter(e => e.tipo_evento === 'especial');
        setEventos(eventosEspeciales);
        
        // Si el evento seleccionado actual no es especial, limpiarlo
        if (eventoSeleccionado && !eventosEspeciales.find(e => e.id === eventoSeleccionado.id)) {
          setEventoSeleccionado(null);
        }
      }
    } catch (error) {
      console.error('Error al cargar eventos:', error);
    } finally {
      setLoading(false);
    }
  };

  const cargarTiposPrecio = async (eventoId) => {
    try {
      const response = await api.get(`/tipos-precio/evento/${eventoId}`);
      if (response.data.success) {
        const tiposPrecioCargados = response.data.data;
        
        // Asignar colores únicos a tipos de precio que no tienen color o tienen colores duplicados
        const coloresDisponibles = [
          '#4CAF50',  // Verde
          '#2196F3',  // Azul
          '#FF9800',  // Naranja
          '#9C27B0',  // Morado
          '#F44336',  // Rojo
          '#00BCD4',  // Cyan
          '#FFC107',  // Amarillo
          '#795548',  // Marrón
          '#607D8B',  // Azul gris
          '#E91E63',  // Rosa
          '#3F51B5',  // Índigo
          '#009688',  // Verde azulado
          '#FF5722',  // Naranja oscuro
          '#673AB7',  // Morado oscuro
          '#CDDC39'   // Lima
        ];
        
        const coloresUsados = new Set();
        const tiposConColores = tiposPrecioCargados.map((tipo, index) => {
          // Si el tipo ya tiene un color y no está duplicado, usarlo
          if (tipo.color && !coloresUsados.has(tipo.color)) {
            coloresUsados.add(tipo.color);
            return tipo;
          }
          
          // Si no tiene color o está duplicado, asignar uno único
          let colorAsignado = coloresDisponibles[index % coloresDisponibles.length];
          
          // Si el color ya está usado, buscar el siguiente disponible
          let intentos = 0;
          while (coloresUsados.has(colorAsignado) && intentos < coloresDisponibles.length) {
            colorAsignado = coloresDisponibles[(index + intentos + 1) % coloresDisponibles.length];
            intentos++;
          }
          
          coloresUsados.add(colorAsignado);
          return { ...tipo, color: colorAsignado };
        });
        
        setTiposPrecio(tiposConColores);
        if (tiposConColores.length > 0) {
          setTipoPrecioSeleccionado(tiposConColores[0].id);
        }
      }
    } catch (error) {
      console.error('Error al cargar tipos de precio:', error);
    }
  };

  const cargarLayout = async (eventoId) => {
    try {
      // Cargar evento para obtener forma y escenario
      const eventoRes = await api.get(`/eventos/${eventoId}`);
      let escenarioCargado = null;
      if (eventoRes.data.success) {
        const evento = eventoRes.data.data;
        if (evento.forma_espacio) {
          setForma(evento.forma_espacio);
        }
        if (evento.escenario_x !== null && evento.escenario_y !== null) {
          escenarioCargado = {
            x: evento.escenario_x,
            y: evento.escenario_y,
            width: evento.escenario_width || 200,
            height: evento.escenario_height || 100
          };
          setEscenario(escenarioCargado);
        }
        // Cargar estado de bloqueo del layout
        if (evento.layout_bloqueado !== undefined) {
          setLayoutBloqueado(evento.layout_bloqueado === 1 || evento.layout_bloqueado === true);
          layoutBloqueadoAnteriorRef.current = evento.layout_bloqueado === 1 || evento.layout_bloqueado === true;
        } else {
          setLayoutBloqueado(false);
          layoutBloqueadoAnteriorRef.current = false;
        }
      }

      // Cargar áreas, mesas y asientos existentes
      const [areasRes, mesasRes, asientosRes] = await Promise.all([
        api.get(`/areas/evento/${eventoId}`),
        api.get(`/mesas/evento/${eventoId}`),
        api.get(`/asientos/evento/${eventoId}`)
      ]);

      let areasCargadas = [];
      let mesasCargadas = [];
      let asientosCargados = [];
      let hojaAnchoGuardado = 1000;
      let hojaAltoGuardado = 600;
      if (eventoRes.data.success && eventoRes.data.data) {
        const ev = eventoRes.data.data;
        hojaAnchoGuardado = ev.hoja_ancho ? Number(ev.hoja_ancho) : 1000;
        hojaAltoGuardado = ev.hoja_alto ? Number(ev.hoja_alto) : 600;
      }

      // Cargar áreas
      if (areasRes.data.success) {
        areasCargadas = areasRes.data.data.map(a => ({
          id: a.id,
          nombre: a.nombre,
          x: a.posicion_x,
          y: a.posicion_y,
          width: a.ancho,
          height: a.alto,
          color: a.color || '#CCCCCC',
          forma: a.forma || 'rectangulo',
          tipo_area: a.tipo_area || 'SILLAS',
          capacidad_personas: a.capacidad_personas || null,
          tipo_precio_id: a.tipo_precio_id || null
        }));
        setAreas(areasCargadas);
      }

      // Cargar mesas
      if (mesasRes.data.success && mesasRes.data.data.length > 0) {
        mesasCargadas = mesasRes.data.data.map(m => ({
          id: m.id,
          x: m.posicion_x !== null && m.posicion_x !== undefined ? m.posicion_x : 100,
          y: m.posicion_y !== null && m.posicion_y !== undefined ? m.posicion_y : 100,
          // Usar el ancho y alto guardados, o valores por defecto si no existen
          width: m.ancho !== null && m.ancho !== undefined ? m.ancho : 24,
          height: m.alto !== null && m.alto !== undefined ? m.alto : 24,
          numero_mesa: m.numero_mesa,
          codigo_mesa: m.codigo_mesa || null,
          capacidad_sillas: m.capacidad_sillas || 4, // Valor por defecto si no tiene capacidad_sillas
          tipo_precio_id: m.tipo_precio_id,
          area_id: m.area_id || null,
          precio_mesa_completa: m.precio_mesa_completa ?? null,
          precio_silla_individual: m.precio_silla_individual ?? null,
          venta_solo_mesa: m.venta_solo_mesa === 1 || m.venta_solo_mesa === true,
        }));
        setMesas(mesasCargadas);
      }

      // Cargar asientos (individuales y de mesas)
      if (asientosRes.data.success && asientosRes.data.data.length > 0) {
        asientosCargados = asientosRes.data.data.map(a => ({
          ...a,
          // Preservar posiciones exactas de la base de datos
          x: a.posicion_x !== null && a.posicion_x !== undefined ? a.posicion_x : 50,
          y: a.posicion_y !== null && a.posicion_y !== undefined ? a.posicion_y : 50,
          area_id: a.area_id || null,
          mesa_id: a.mesa_id || null
        }));
        setAsientos(asientosCargados);
        
        // Si hay asientos individuales (sin mesa), intentar reconstruir la zona
        const asientosIndividuales = asientosCargados.filter(a => !a.mesa_id);
        if (asientosIndividuales.length > 0) {
          const xs = asientosIndividuales.map(a => a.x);
          const ys = asientosIndividuales.map(a => a.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          
          const primerAsiento = asientosIndividuales[0];
          setZonaAsientos({
            x: minX - 25,
            y: minY - 25,
            width: (maxX - minX) + 50,
            height: (maxY - minY) + 50,
            cantidad: asientosIndividuales.length,
            tipo_precio_id: primerAsiento.tipo_precio_id
          });
          setCantidadAsientos(asientosIndividuales.length);
        }
      }

      // Usar dimensiones guardadas (sin expandir)
      setHojaAncho(hojaAnchoGuardado);
      setHojaAlto(hojaAltoGuardado);
    } catch (error) {
      console.error('Error al cargar layout:', error);
    }
  };


  // Generar asientos automáticamente dentro de una zona puntual
  const generarAsientosAutomaticos = (zona) => {
    if (!zona || !zona.cantidad || !zona.tipo_precio_id || zona.width <= 0 || zona.height <= 0) return;

    const nuevosAsientos = [];
    const cantidad = zona.cantidad;
    const anchoZona = zona.width;
    const altoZona = zona.height;
    const xInicio = zona.x;
    const yInicio = zona.y;
    const letra = normalizarLetraAsiento(zona.letraAsiento ?? letraAsiento);

    // Fila única: todos los asientos en una sola línea horizontal
    const columnas = cantidad;
    const filas = 1;
    const ESPACIO_FIJO = 3; // px entre asientos
    const { asiento: tamañoAsiento, paddingZona: padding } = layoutSizes;
    const espacioX = ESPACIO_FIJO;
    const espacioY = 0;
    // Determinar el área de la zona (centro de la zona)
    const areaDeLaZona = detectarAreaEnPosicion(
      xInicio + anchoZona / 2,
      yInicio + altoZona / 2
    );

    // Si la zona está dentro de un área: contar solo los asientos de esa área como base
    // Si está fuera de cualquier área: empezar desde 1 (solo contar los de esta llamada)
    let acumuladoBase;
    if (areaDeLaZona) {
      acumuladoBase = asientos.filter(a => {
        const aArea = detectarAreaEnPosicion(a.x || 0, a.y || 0);
        return aArea?.id === areaDeLaZona.id;
      });
    } else {
      acumuladoBase = []; // fuera de área → reinicia desde A1
    }

    let acumulado = [...acumuladoBase];
    const paridad = zona.paridad || 'normal';

    // Función para obtener siguiente código respetando paridad
    const getCodigoConParidad = (lista, L, par) => {
      if (par === 'normal') return obtenerSiguienteCodigoAsiento(lista, L);
      const esPar = par === 'par';
      let maxN = esPar ? 0 : -1;
      (lista || []).forEach(a => {
        const cod = String(a.codigo_asiento || a.numero_asiento || '').toUpperCase();
        const m2 = cod.match(new RegExp(`^${L}(\\d+)$`));
        if (m2) {
          const n = parseInt(m2[1], 10);
          if (esPar ? n % 2 === 0 : n % 2 !== 0) maxN = Math.max(maxN, n);
        }
      });
      return `${L}${maxN + 2}`;
    };

    for (let i = 0; i < cantidad; i++) {
      const fila = Math.floor(i / columnas);
      const columna = i % columnas;
      
      let x = xInicio + padding + (columna * (tamañoAsiento + espacioX)) + tamañoAsiento / 2;
      let y = yInicio + padding + (fila * (tamañoAsiento + espacioY)) + tamañoAsiento / 2;
      const c = clampPointToSheet(x, y, tamañoAsiento + 2);
      x = c.x; y = c.y;

      const codigo = getCodigoConParidad(acumulado, letra, paridad);

      const nuevoAsiento = {
        id: `temp_asiento_${Date.now()}_${i}`,
        x: Math.round(x),
        y: Math.round(y),
        numero_asiento: codigo,
        codigo_asiento: codigo,
        tipo_precio_id: zona.tipo_precio_id,
        mesa_id: null,
        area_id: (() => {
          const areaDetect = detectarAreaEnPosicion(Math.round(x), Math.round(y));
          return areaDetect?.id ?? null;
        })()
      };
      nuevosAsientos.push(nuevoAsiento);
      acumulado = [...acumulado, nuevoAsiento];
    }

    setAsientos(prev => [...prev, ...nuevosAsientos]);
    if (nuevosAsientos.length > 0) {
      showAlert(
        `${nuevosAsientos.length} asiento(s) creados: ${nuevosAsientos[0].codigo_asiento} … ${nuevosAsientos[nuevosAsientos.length - 1].codigo_asiento}`,
        { type: 'success' }
      );
    }
  };

  // Colores para etiquetas/números (más visibles que blanco/gris)
  const COLOR_TEXTO_MESA = '#FFD700';
  const COLOR_TEXTO_ASIENTO = '#FFFFFF';
  const FUENTE_ASIENTO = `bold ${Math.max(7, Math.min(11, Math.round(layoutSizes.asiento * 0.75)))}px Arial`;

  const calcularCapacidadPersonas = (zona) => {
    if (!zona || zona.width <= 0 || zona.height <= 0) return 0;
    const { persona: tam, paddingZona: padding, espacioGrid: espacioEntre } = layoutSizes;
    const anchoParaGrid = zona.width - 2 * padding;
    const altoParaGrid = zona.height - 2 * padding;
    if (anchoParaGrid <= 0 || altoParaGrid <= 0) return 0;
    const paso = tam + espacioEntre;
    const columnas = Math.max(1, Math.floor((anchoParaGrid + espacioEntre) / paso));
    const filas = Math.max(1, Math.floor((altoParaGrid + espacioEntre) / paso));
    return columnas * filas;
  };

  // Obtener posiciones de círculos para dibujar (a partir de un área tipo PERSONAS)
  const getPosicionesPersonasParaArea = (area) => {
    if (!area || area.tipo_area !== 'PERSONAS' || !area.capacidad_personas) return [];
    const cantidad = area.capacidad_personas;
    const { persona: tam, paddingZona: padding, espacioGrid: espacioEntre } = layoutSizes;
    const columnas = Math.ceil(Math.sqrt(cantidad));
    const filas = Math.ceil(cantidad / columnas);
    const anchoDisponible = area.width - 2 * padding - columnas * tam;
    const altoDisponible = area.height - 2 * padding - filas * tam;
    const espacioX = columnas > 1 ? Math.max(espacioEntre, anchoDisponible / (columnas - 1)) : 0;
    const espacioY = filas > 1 ? Math.max(espacioEntre, altoDisponible / (filas - 1)) : 0;
    const posiciones = [];
    for (let i = 0; i < cantidad; i++) {
      const fila = Math.floor(i / columnas);
      const columna = i % columnas;
      const x = area.x + padding + (columna * (tam + espacioX)) + tam / 2;
      const y = area.y + padding + (fila * (tam + espacioY)) + tam / 2;
      posiciones.push({ x: Math.round(x), y: Math.round(y) });
    }
    return posiciones;
  };

  // Generar zona de personas: crea asientos (personas) en grid - limitado por cantidadPersonas
  const generarPersonasAutomaticas = (zona) => {
    if (!zona || !zona.tipo_precio_id || zona.width <= 10 || zona.height <= 10) return;
    const capacidadMax = calcularCapacidadPersonas(zona);
    const limite = zona.cantidad != null ? zona.cantidad : cantidadPersonas;
    const cantidad = Math.min(capacidadMax, Math.max(1, limite));
    if (cantidad <= 0) return;

    const personasExistentes = asientos.filter(a => !a.mesa_id && String(a.numero_asiento || '').startsWith('P'));
    const nuevoNumero = personasExistentes.length + 1;

    const { persona: tam, paddingZona: padding, espacioGrid: espacioEntre } = layoutSizes;
    const nuevasPersonas = [];
    const columnas = Math.ceil(Math.sqrt(cantidad));
    const filas = Math.ceil(cantidad / columnas);
    const anchoDisponible = zona.width - 2 * padding - columnas * tam;
    const altoDisponible = zona.height - 2 * padding - filas * tam;
    const espacioX = columnas > 1 ? Math.max(espacioEntre, anchoDisponible / (columnas - 1)) : 0;
    const espacioY = filas > 1 ? Math.max(espacioEntre, altoDisponible / (filas - 1)) : 0;

    for (let i = 0; i < cantidad; i++) {
      const fila = Math.floor(i / columnas);
      const columna = i % columnas;
      let x = zona.x + padding + (columna * (tam + espacioX)) + tam / 2;
      let y = zona.y + padding + (fila * (tam + espacioY)) + tam / 2;
      const c = clampPointToSheet(x, y, tam + 2);
      x = c.x; y = c.y;

      nuevasPersonas.push({
        id: `temp_asiento_${Date.now()}_${i}`,
        x: Math.round(x),
        y: Math.round(y),
        numero_asiento: `P${nuevoNumero + i}`,
        tipo_precio_id: zona.tipo_precio_id,
        mesa_id: null
      });
    }

    setAsientos(prev => [...prev, ...nuevasPersonas]);
  };

  // Distribución por lados: ej. 12 → [3,3,3,3], 10 → [3,2,3,2], 6 → [2,1,2,1], 4 → [1,1,1,1]
  const distribuirSillasPorLados = (total) => {
    const base = Math.floor(total / 4);
    const rem = total % 4;
    return [
      base + (rem >= 1 ? 1 : 0), // superior
      base + (rem >= 2 ? 1 : 0), // derecha
      base + (rem >= 3 ? 1 : 0), // inferior
      base                              // izquierda
    ];
  };

  // Generar sillas alrededor de una mesa: bien separadas por lados (ej. 3-3-3-3 para 12 sillas)
  const generarSillasAlrededorMesa = (mesa) => {
    if (!mesa || !mesa.capacidad_sillas || !mesa.tipo_precio_id) return [];

    const sillas = [];
    const cantidadSillas = mesa.capacidad_sillas;
    const mesaX = mesa.x;
    const mesaY = mesa.y;
    const mesaWidth = mesa.width || layoutSizes.mesaCuad;
    const mesaHeight = mesa.height || layoutSizes.mesaCuad;

    const tamañoSilla = layoutSizes.silla;
    const distanciaMesa = layoutSizes.distanciaMesaSilla;
    const [sillasSuperior, sillasDerecha, sillasInferior, sillasIzquierda] = distribuirSillasPorLados(cantidadSillas);
    let sillaIndex = 0;

    const colocarLado = (n, getX, getY) => {
      for (let i = 0; i < n && sillaIndex < cantidadSillas; i++) {
        sillas.push({
          id: `temp_silla_${mesa.id}_${sillaIndex}`,
          x: Math.round(getX(i)),
          y: Math.round(getY(i)),
          numero_asiento: `${sillaIndex + 1}`,
          tipo_precio_id: mesa.tipo_precio_id,
          mesa_id: mesa.id
        });
        sillaIndex++;
      }
    };

    const centroX = mesaX + mesaWidth / 2;
    const centroY = mesaY + mesaHeight / 2;

    // Superior: centradas sobre el ancho de la mesa
    if (sillasSuperior > 0) {
      const anchoTotal = sillasSuperior * tamañoSilla + Math.max(0, sillasSuperior - 1) * 4;
      let startX = centroX - anchoTotal / 2 + tamañoSilla / 2;
      colocarLado(sillasSuperior, (i) => startX + i * (tamañoSilla + 4), () => mesaY - distanciaMesa - tamañoSilla / 2);
    }

    // Derecha
    if (sillasDerecha > 0) {
      const altoTotal = sillasDerecha * tamañoSilla + Math.max(0, sillasDerecha - 1) * 4;
      let startY = centroY - altoTotal / 2 + tamañoSilla / 2;
      colocarLado(sillasDerecha, () => mesaX + mesaWidth + distanciaMesa + tamañoSilla / 2, (i) => startY + i * (tamañoSilla + 4));
    }

    // Inferior
    if (sillasInferior > 0) {
      const anchoTotal = sillasInferior * tamañoSilla + Math.max(0, sillasInferior - 1) * 4;
      let startX = centroX - anchoTotal / 2 + tamañoSilla / 2;
      colocarLado(sillasInferior, (i) => startX + i * (tamañoSilla + 4), () => mesaY + mesaHeight + distanciaMesa + tamañoSilla / 2);
    }

    // Izquierda
    if (sillasIzquierda > 0) {
      const altoTotal = sillasIzquierda * tamañoSilla + Math.max(0, sillasIzquierda - 1) * 4;
      let startY = centroY - altoTotal / 2 + tamañoSilla / 2;
      colocarLado(sillasIzquierda, () => mesaX - distanciaMesa - tamañoSilla / 2, (i) => startY + i * (tamañoSilla + 4));
    }

    return sillas;
  };

  // Generar mesas automáticamente en una zona
  const generarMesasAutomaticas = (zona) => {
    if (!zona || !zona.cantidad || !zona.sillasPorMesa || !zona.tipo_precio_id || zona.width <= 0 || zona.height <= 0) return;

    const cantidadMesas = zona.cantidad;
    const sillasPorMesa = zona.sillasPorMesa;
    const anchoZona = zona.width;
    const altoZona = zona.height;
    const xInicio = zona.x;
    const yInicio = zona.y;

    // Calcular distribución en grid
    const columnas = Math.ceil(Math.sqrt(cantidadMesas));
    const filas = Math.ceil(cantidadMesas / columnas);
    
    const mesaW = formaMesa === 'cuadrado' ? layoutSizes.mesaCuad : layoutSizes.mesaRectW;
    const mesaH = formaMesa === 'cuadrado' ? layoutSizes.mesaCuad : layoutSizes.mesaRectH;
    const padding = layoutSizes.paddingZona + 4;
    const espacioEntreMesas = layoutSizes.espacioEntreMesas;
    
    const anchoDisponible = anchoZona - (2 * padding) - (columnas * mesaW);
    const altoDisponible = altoZona - (2 * padding) - (filas * mesaH);
    
    const espacioX = columnas > 1 ? Math.max(espacioEntreMesas, anchoDisponible / (columnas - 1)) : 0;
    const espacioY = filas > 1 ? Math.max(espacioEntreMesas, altoDisponible / (filas - 1)) : 0;

    const nuevasMesas = [];
    const nuevasSillas = [];
    let numeroMesa = mesas.length + 1;

    for (let i = 0; i < cantidadMesas; i++) {
      const fila = Math.floor(i / columnas);
      const columna = i % columnas;
      
      let x = xInicio + padding + (columna * (mesaW + espacioX)) + mesaW / 2;
      let y = yInicio + padding + (fila * (mesaH + espacioY)) + mesaH / 2;
      const { x: mx, y: my } = clampMesaToSheet(x - mesaW / 2, y - mesaH / 2, mesaW, mesaH);

      const nuevaMesa = {
        id: `temp_mesa_${Date.now()}_${i}`,
        x: Math.round(mx),
        y: Math.round(my),
        width: mesaW,
        height: mesaH,
        numero_mesa: numeroMesa,
        codigo_mesa: null,
        capacidad_sillas: sillasPorMesa,
        tipo_precio_id: zona.tipo_precio_id,
        venta_solo_mesa: mesasSinSillasVisibles ? 1 : (mesaVentaSoloMesa ? 1 : 0),
        ...getCamposPrecioMesa(),
      };

      nuevasMesas.push(nuevaMesa);

      if (!mesasSinSillasVisibles) {
        const sillasMesa = generarSillasAlrededorMesa(nuevaMesa);
        sillasMesa.forEach((s) => {
          const c = clampPointToSheet(s.x, s.y, layoutSizes.silla + 2);
          nuevasSillas.push({ ...s, x: c.x, y: c.y });
        });
      }

      numeroMesa++;
    }

    // Agregar las nuevas mesas y sillas
    setMesas(prev => [...prev, ...nuevasMesas]);
    setAsientos(prev => [...prev, ...nuevasSillas]);
  };

  /** Mesas sin sillas en zona: códigos A1, A2… según letra y cantidad */
  const generarMesasSinSillasEnZona = (zona) => {
    if (!zona || !zona.cantidad || !zona.tipo_precio_id || zona.width <= 0 || zona.height <= 0) return;

    const cantidadEnZona = Math.min(Math.max(1, parseInt(zona.cantidad, 10) || 1), MAX_ELEMENTOS_ZONA);
    const letra = normalizarLetraMesa(zona.letraMesa ?? letraMesa);
    const cap = parseInt(zona.capacidad_sillas ?? sillasPorMesa, 10) || 4;

    const mesaW = formaMesa === 'cuadrado' ? layoutSizes.mesaCuad : layoutSizes.mesaRectW;
    const mesaH = formaMesa === 'cuadrado' ? layoutSizes.mesaCuad : layoutSizes.mesaRectH;
    const padding = layoutSizes.paddingZona + 4;
    const espacioEntreMesas = layoutSizes.espacioEntreMesas;

    // Fila única para mesas sin sillas
    const columnas = cantidadEnZona;
    const filas = 1;
    const ESPACIO_FIJO_M = 4;
    const espacioX = ESPACIO_FIJO_M;
    const espacioY = 0;

    const nuevasMesas = [];
    // Detectar área del centro de la zona una sola vez
    const areaDeLaZonaMesa = detectarAreaEnPosicion(
      zona.x + zona.width / 2,
      zona.y + zona.height / 2
    );
    let acumuladoBase;
    if (areaDeLaZonaMesa) {
      acumuladoBase = mesas.filter(m => {
        const mArea = detectarAreaEnPosicion((m.x || 0) + (m.width || mesaW) / 2, (m.y || 0) + (m.height || mesaH) / 2);
        return mArea?.id === areaDeLaZonaMesa.id;
      });
    } else {
      acumuladoBase = [];
    }
    let acumulado = [...acumuladoBase];
    let numeroMesa = mesas.length + 1;
    const camposPrecio = getCamposPrecioMesa();
    const paridadM = zona.paridad || 'normal';
    const getCodigoMesaConParidad = (lista, L, par) => {
      if (par === 'normal') return obtenerSiguienteCodigoMesa(lista, L);
      const esPar = par === 'par';
      let maxN = esPar ? 0 : -1;
      (lista || []).forEach(m => {
        const cod = String(m.codigo_mesa || '').toUpperCase();
        const m2 = cod.match(new RegExp(`^${L}(\\d+)$`));
        if (m2) {
          const n = parseInt(m2[1], 10);
          if (esPar ? n % 2 === 0 : n % 2 !== 0) maxN = Math.max(maxN, n);
        }
      });
      return `${L}${maxN + 2}`;
    };

    for (let i = 0; i < cantidadEnZona; i++) {
      const columna = i; // fila única, columna = índice
      const { x: mx, y: my } = clampMesaToSheet(zona.x + padding + columna * (mesaW + espacioX), zona.y + padding, mesaW, mesaH);
      
      const codigo = getCodigoMesaConParidad(acumulado, letra, paridadM);

      const areaMesa = detectarAreaEnPosicion(Math.round(mx) + mesaW / 2, Math.round(my) + mesaH / 2);
      const nuevaMesa = {
        id: `temp_mesa_${Date.now()}_${i}`,
        x: Math.round(mx),
        y: Math.round(my),
        width: mesaW,
        height: mesaH,
        numero_mesa: numeroMesa++,
        codigo_mesa: codigo,
        capacidad_sillas: cap,
        tipo_precio_id: zona.tipo_precio_id,
        venta_solo_mesa: 1,
        area_id: areaMesa?.id ?? null,
        ...camposPrecio,
      };
      nuevasMesas.push(nuevaMesa);
      acumulado = [...acumulado, nuevaMesa];
    }

    setMesas((prev) => [...prev, ...nuevasMesas]);
    if (nuevasMesas.length > 0) {
      showAlert(
        `${nuevasMesas.length} mesa(s) creadas: ${nuevasMesas[0].codigo_mesa} … ${nuevasMesas[nuevasMesas.length - 1].codigo_mesa}`,
        { type: 'success' }
      );
    }
  };

  const dibujarCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Limpiar canvas
    ctx.clearRect(0, 0, width, height);

    // Dibujar hoja límite fija en (0,0)-(hojaAncho, hojaAlto)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.fillRect(0, 0, hojaAncho, hojaAlto);
    ctx.strokeRect(0, 0, hojaAncho, hojaAlto);

    // Dibujar escenario
    if (escenario) {
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(escenario.x, escenario.y, escenario.width, escenario.height);
      ctx.strokeStyle = '#654321';
      ctx.lineWidth = 3;
      ctx.strokeRect(escenario.x, escenario.y, escenario.width, escenario.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('ESCENARIO', escenario.x + escenario.width / 2, escenario.y + escenario.height / 2);
    }

    // Dibujar áreas personalizadas
    areas.forEach(area => {
      ctx.fillStyle = hexToRgba(area.color || COLOR_AREA_DEFAULT, 0.78);
      const isCircle = area.forma === 'circulo';
      if (isCircle) {
        const cx = area.x + area.width / 2;
        const cy = area.y + area.height / 2;
        const r = Math.min(area.width, area.height) / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillRect(area.x, area.y, area.width, area.height);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.strokeRect(area.x, area.y, area.width, area.height);
      }
      
      ctx.fillStyle = '#333';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const textY = area.y - 5;
      const textX = area.x + area.width / 2;
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

    // Dibujar preview del elemento que se está dibujando
    if (currentElement && isDrawing) {
      if (currentElement.type === 'escenario') {
        ctx.fillStyle = 'rgba(139, 69, 19, 0.3)';
        ctx.fillRect(currentElement.x, currentElement.y, currentElement.width, currentElement.height);
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(currentElement.x, currentElement.y, currentElement.width, currentElement.height);
        ctx.setLineDash([]);
      } else if (currentElement.type === 'area') {
        ctx.fillStyle = hexToRgba(colorAreaNueva || COLOR_AREA_DEFAULT, 0.45);
        ctx.strokeStyle = colorAreaNueva || COLOR_AREA_DEFAULT;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        if (currentElement.forma === 'circulo') {
          const cx = currentElement.x + currentElement.width / 2;
          const cy = currentElement.y + currentElement.height / 2;
          const r = Math.min(currentElement.width, currentElement.height) / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(currentElement.x, currentElement.y, currentElement.width, currentElement.height);
          ctx.strokeRect(currentElement.x, currentElement.y, currentElement.width, currentElement.height);
        }
        ctx.setLineDash([]);
        if (nombreArea) {
          // Dibujar nombre del área en la parte superior (cabecera) del preview
          ctx.fillStyle = '#333';
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          const textY = currentElement.y - 5;
          const textX = currentElement.x + currentElement.width / 2;
          const text = nombreArea.toUpperCase();
          const metrics = ctx.measureText(text);
          const textWidth = metrics.width;
          const textHeight = 16;
          
          // Fondo blanco con borde para el texto
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.fillRect(textX - textWidth / 2 - 4, textY - textHeight - 2, textWidth + 8, textHeight + 4);
          ctx.strokeStyle = '#999';
          ctx.lineWidth = 1;
          ctx.strokeRect(textX - textWidth / 2 - 4, textY - textHeight - 2, textWidth + 8, textHeight + 4);
          
          // Dibujar el texto
          ctx.fillStyle = '#333';
          ctx.fillText(text, textX, textY);
        }
      } else if (currentElement.type === 'zona_asientos') {
        ctx.fillStyle = 'rgba(33, 150, 243, 0.2)';
        ctx.fillRect(currentElement.x, currentElement.y, currentElement.width, currentElement.height);
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(currentElement.x, currentElement.y, currentElement.width, currentElement.height);
        ctx.setLineDash([]);
        ctx.fillStyle = '#2196F3';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        const LA = normalizarLetraAsiento(letraAsiento);
        ctx.fillText(`ZONA ASIENTOS ${LA} (${cantidadAsientos || 0})`, currentElement.x + currentElement.width / 2, currentElement.y + 20);
      } else if (currentElement.type === 'zona_mesas') {
        ctx.fillStyle = 'rgba(139, 69, 19, 0.2)';
        ctx.fillRect(currentElement.x, currentElement.y, currentElement.width, currentElement.height);
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(currentElement.x, currentElement.y, currentElement.width, currentElement.height);
        ctx.setLineDash([]);
        if (zonaMesas) {
          ctx.fillStyle = '#8B4513';
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`ZONA MESAS (${zonaMesas.cantidad || 0} mesas, ${zonaMesas.sillasPorMesa || 0} sillas/mesa)`, currentElement.x + currentElement.width / 2, currentElement.y + 20);
        }
      } else if (currentElement.type === 'zona_mesas_solas') {
        ctx.fillStyle = 'rgba(255, 193, 7, 0.25)';
        ctx.fillRect(currentElement.x, currentElement.y, currentElement.width, currentElement.height);
        ctx.strokeStyle = '#F57C00';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(currentElement.x, currentElement.y, currentElement.width, currentElement.height);
        ctx.setLineDash([]);
        if (zonaMesasSolas) {
          const L = normalizarLetraMesa(zonaMesasSolas.letraMesa ?? letraMesa);
          ctx.fillStyle = '#E65100';
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(
            `MESAS ${L} (${zonaMesasSolas.cantidad || 0} mesas, sin sillas)`,
            currentElement.x + currentElement.width / 2,
            currentElement.y + 20
          );
        }
      } else if (currentElement.type === 'zona_personas') {
        ctx.fillStyle = 'rgba(76, 175, 80, 0.2)';
        ctx.fillRect(currentElement.x, currentElement.y, currentElement.width, currentElement.height);
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(currentElement.x, currentElement.y, currentElement.width, currentElement.height);
        ctx.setLineDash([]);
        if (zonaPersonas && zonaPersonas.width > 0 && zonaPersonas.height > 0) {
          const cap = calcularCapacidadPersonas(zonaPersonas);
          const real = Math.min(cap, cantidadPersonas);
          ctx.fillStyle = '#4CAF50';
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`ZONA PERSONAS (máx. ${real})`, currentElement.x + currentElement.width / 2, currentElement.y + 20);
        }
      } else if (currentElement.type === 'mesa') {
        ctx.fillStyle = 'rgba(139, 69, 19, 0.3)';
        ctx.fillRect(currentElement.x, currentElement.y, currentElement.width, currentElement.height);
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(currentElement.x, currentElement.y, currentElement.width, currentElement.height);
        ctx.setLineDash([]);
      }
    }

    // Dibujar zona de asientos (solo si está en modo de dibujo o si no hay asientos generados aún)
    // Solo mostrar la zona si está activamente siendo dibujada o si no hay asientos en esa zona
    if (zonaAsientos && (currentElement?.type === 'zona_asientos' || modo === 'zona_asientos')) {
      ctx.fillStyle = 'rgba(33, 150, 243, 0.2)';
      ctx.fillRect(zonaAsientos.x, zonaAsientos.y, zonaAsientos.width, zonaAsientos.height);
      ctx.strokeStyle = '#2196F3';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(zonaAsientos.x, zonaAsientos.y, zonaAsientos.width, zonaAsientos.height);
      ctx.setLineDash([]);
      ctx.fillStyle = '#2196F3';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      const L = normalizarLetraAsiento(zonaAsientos.letraAsiento ?? letraAsiento);
      ctx.fillText(`ZONA ASIENTOS ${L} (${zonaAsientos.cantidad || 0})`, zonaAsientos.x + zonaAsientos.width / 2, zonaAsientos.y + 20);
    }

    // Dibujar zona de personas (preview al dibujar)
    if (zonaPersonas && (currentElement?.type === 'zona_personas' || modo === 'zona_personas')) {
      ctx.fillStyle = 'rgba(76, 175, 80, 0.2)';
      ctx.fillRect(zonaPersonas.x, zonaPersonas.y, zonaPersonas.width, zonaPersonas.height);
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(zonaPersonas.x, zonaPersonas.y, zonaPersonas.width, zonaPersonas.height);
      ctx.setLineDash([]);
      const cap = calcularCapacidadPersonas(zonaPersonas);
      const real = Math.min(cap, cantidadPersonas);
      ctx.fillStyle = '#4CAF50';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`ZONA PERSONAS (máx. ${real})`, zonaPersonas.x + zonaPersonas.width / 2, zonaPersonas.y + 20);
    }

    // Dibujar áreas tipo PERSONAS como zona sólida (sin círculos individuales)
    areas.filter(a => a.tipo_area === 'PERSONAS' && a.capacidad_personas > 0).forEach(area => {
      const tipoPrecio = tiposPrecio.find(tp => tp.id === area.tipo_precio_id);
      const colorBase = tipoPrecio?.color || getColorForTipoPrecio(area.tipo_precio_id) || '#4CAF50';
      // Relleno semitransparente
      ctx.fillStyle = colorBase + '55';
      ctx.fillRect(area.x, area.y, area.width, area.height);
      // Patrón de puntos decorativos
      const r = Math.max(3, Math.round(Math.min(area.width, area.height) / 18));
      const cols = Math.floor(area.width / (r * 3.2));
      const rows2 = Math.floor(area.height / (r * 3.2));
      const gx = cols > 1 ? area.width / cols : area.width;
      const gy = rows2 > 1 ? area.height / rows2 : area.height;
      ctx.fillStyle = colorBase + 'aa';
      for (let ri = 0; ri < rows2; ri++) {
        for (let ci = 0; ci < cols; ci++) {
          ctx.beginPath();
          ctx.arc(area.x + gx * 0.5 + ci * gx, area.y + gy * 0.5 + ri * gy, r, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      // Etiqueta capacidad en el centro
      ctx.fillStyle = '#000';
      ctx.font = `bold ${Math.min(16, Math.max(10, area.height / 4))}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${area.capacidad_personas} personas`, area.x + area.width / 2, area.y + area.height / 2);
      ctx.textBaseline = 'alphabetic';
    });

    // Dibujar zona de mesas
    if (zonaMesas && (currentElement?.type === 'zona_mesas' || modo === 'zona_mesas')) {
      ctx.fillStyle = 'rgba(139, 69, 19, 0.2)';
      ctx.fillRect(zonaMesas.x, zonaMesas.y, zonaMesas.width, zonaMesas.height);
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(zonaMesas.x, zonaMesas.y, zonaMesas.width, zonaMesas.height);
      ctx.setLineDash([]);
      ctx.fillStyle = '#8B4513';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`ZONA MESAS (${zonaMesas.cantidad || 0} mesas, ${zonaMesas.sillasPorMesa || 0} sillas/mesa)`, zonaMesas.x + zonaMesas.width / 2, zonaMesas.y + 20);
    }

    if (zonaMesasSolas && (currentElement?.type === 'zona_mesas_solas' || modo === 'zona_mesas_solas')) {
      ctx.fillStyle = 'rgba(255, 193, 7, 0.25)';
      ctx.fillRect(zonaMesasSolas.x, zonaMesasSolas.y, zonaMesasSolas.width, zonaMesasSolas.height);
      ctx.strokeStyle = '#F57C00';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(zonaMesasSolas.x, zonaMesasSolas.y, zonaMesasSolas.width, zonaMesasSolas.height);
      ctx.setLineDash([]);
      const L = normalizarLetraMesa(zonaMesasSolas.letraMesa ?? letraMesa);
      ctx.fillStyle = '#E65100';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        `MESAS ${L} (${zonaMesasSolas.cantidad || 0} sin sillas)`,
        zonaMesasSolas.x + zonaMesasSolas.width / 2,
        zonaMesasSolas.y + 20
      );
    }

    // Dibujar mesas con sus sillas (mesa visible como tabla, sillas alrededor por lados)
    mesas.forEach(mesa => {
      const estaSeleccionada = elementosSeleccionados.some(sel => sel.type === 'mesa' && sel.id === mesa.id);
      const mw = mesa.width || layoutSizes.mesaCuad;
      const mh = mesa.height || layoutSizes.mesaCuad;

      // Mesa: fondo marrón tipo “tabla” y borde para que se distinga de las sillas
      ctx.fillStyle = '#A0522D';
      ctx.fillRect(mesa.x, mesa.y, mw, mh);
      ctx.strokeStyle = estaSeleccionada ? '#FFD700' : '#654321';
      ctx.lineWidth = estaSeleccionada ? 3 : 2;
      ctx.strokeRect(mesa.x, mesa.y, mw, mh);
      // Borde interior claro para que se vea como superficie de mesa
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(mesa.x + 2, mesa.y + 2, mw - 4, mh - 4);

      if (dibujarNumerosEnCanvas) {
        const etiqMesa = etiquetaMesa(mesa);
        const fsMesa = Math.max(9, Math.min(13, Math.round(Math.min(mw, mh) * 0.32)));
        ctx.font = `bold ${fsMesa}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const wMesa = ctx.measureText(etiqMesa).width;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(mesa.x + mw / 2 - wMesa / 2 - 2, mesa.y + mh / 2 - fsMesa / 2 - 1, wMesa + 4, fsMesa + 2);
        ctx.fillStyle = COLOR_TEXTO_MESA;
        ctx.fillText(etiqMesa, mesa.x + mw / 2, mesa.y + mh / 2);
      }

      const sillasMesa = asientos.filter(a => a.mesa_id === mesa.id);
      const sh = layoutSizes.silla;
      const sh2 = layoutSizes.halfSilla;
      sillasMesa.forEach(silla => {
        const tipoPrecio = tiposPrecio.find(tp => tp.id === silla.tipo_precio_id);
        const estaSeleccionadaSilla = elementosSeleccionados.some(sel => sel.type === 'asiento' && sel.id === silla.id);
        const sx = (silla.x || 50) - sh2;
        const sy = (silla.y || 50) - sh2;
        const colorSilla = tipoPrecio?.color || getColorForTipoPrecio(silla.tipo_precio_id) || '#2196F3';
        ctx.fillStyle = colorSilla;
        ctx.fillRect(sx, sy, sh, sh);
        ctx.strokeStyle = estaSeleccionadaSilla ? '#FFD700' : '#333';
        ctx.lineWidth = estaSeleccionadaSilla ? 2 : 1;
        ctx.strokeRect(sx, sy, sh, sh);
        if (dibujarNumerosEnCanvas) {
          ctx.font = FUENTE_ASIENTO;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.strokeStyle = 'rgba(0,0,0,0.8)';
          ctx.lineWidth = 2;
          ctx.strokeText(silla.numero_asiento || '', silla.x || 50, silla.y || 50);
          ctx.fillStyle = COLOR_TEXTO_ASIENTO;
          ctx.fillText(silla.numero_asiento || '', silla.x || 50, silla.y || 50);
        }
      });
    });

    // Dibujar asientos individuales (sin mesa) - cuadrados
    asientos.filter(a => !a.mesa_id && !String(a.numero_asiento || '').startsWith('P')).forEach(asiento => {
      const tipoPrecio = tiposPrecio.find(tp => tp.id === asiento.tipo_precio_id);
      const estaSeleccionado = elementosSeleccionados.some(sel => sel.type === 'asiento' && sel.id === asiento.id);
      
      const colorAsiento = tipoPrecio?.color || getColorForTipoPrecio(asiento.tipo_precio_id) || '#2196F3';
      const ha = layoutSizes.halfAsiento;
      const ta = layoutSizes.asiento;
      ctx.fillStyle = colorAsiento;
      ctx.fillRect((asiento.x || 50) - ha, (asiento.y || 50) - ha, ta, ta);
      ctx.strokeStyle = estaSeleccionado ? '#FFD700' : '#333';
      ctx.lineWidth = estaSeleccionado ? 2 : 1;
      ctx.strokeRect((asiento.x || 50) - ha, (asiento.y || 50) - ha, ta, ta);
      
      if (dibujarNumerosEnCanvas) {
        const labelA = asiento.codigo_asiento || asiento.numero_asiento || '';
        const fsA = Math.max(8, Math.min(12, Math.round(ta * 0.7)));
        ctx.font = `bold ${fsA}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const wA = ctx.measureText(labelA).width;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect((asiento.x || 50) - wA / 2 - 1, (asiento.y || 50) - fsA / 2 - 1, wA + 2, fsA + 2);
        ctx.fillStyle = COLOR_TEXTO_ASIENTO;
        ctx.fillText(labelA, asiento.x || 50, asiento.y || 50);
      }
    });

    // Dibujar personas individuales (círculos, mismo tamaño que asientos)
    asientos.filter(a => !a.mesa_id && String(a.numero_asiento || '').startsWith('P')).forEach(persona => {
      const tipoPrecio = tiposPrecio.find(tp => tp.id === persona.tipo_precio_id);
      const estaSeleccionado = elementosSeleccionados.some(sel => sel.type === 'asiento' && sel.id === persona.id);
      
      const colorPersona = tipoPrecio?.color || getColorForTipoPrecio(persona.tipo_precio_id) || '#4CAF50';
      const radio = layoutSizes.radioPersona;
      ctx.fillStyle = colorPersona;
      ctx.beginPath();
      ctx.arc(persona.x || 50, persona.y || 50, radio, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = estaSeleccionado ? '#FFD700' : '#333';
      ctx.lineWidth = estaSeleccionado ? 2 : 1;
      ctx.stroke();
      
      if (dibujarNumerosEnCanvas) {
        ctx.font = FUENTE_ASIENTO;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 2;
        ctx.strokeText(persona.numero_asiento || '', persona.x || 50, persona.y || 50);
        ctx.fillStyle = COLOR_TEXTO_ASIENTO;
        ctx.fillText(persona.numero_asiento || '', persona.x || 50, persona.y || 50);
      }
    });

    // Dibujar cuadro de selección
    if (seleccionCuadro && modo === 'seleccionar') {
      ctx.strokeStyle = '#2196F3';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(seleccionCuadro.x, seleccionCuadro.y, seleccionCuadro.width, seleccionCuadro.height);
      ctx.fillStyle = 'rgba(33, 150, 243, 0.1)';
      ctx.fillRect(seleccionCuadro.x, seleccionCuadro.y, seleccionCuadro.width, seleccionCuadro.height);
      ctx.setLineDash([]);
    }

    // Dibujar indicador visual del cursor (solo cuando no se está dibujando)
    if (mousePosition && !isDrawing) {
      ctx.fillStyle = '#007bff';
      ctx.beginPath();
      ctx.arc(mousePosition.x, mousePosition.y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  const dibujarCanvasMini = () => {
    const canvas = miniCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Mundo fijo según tamaño de hoja
    const minX = 0;
    const minY = 0;
    const worldW = hojaAncho;
    const worldH = hojaAlto;
    const s = Math.min((width - 12) / worldW, (height - 12) / worldH);
    const contentW = worldW * s;
    const contentH = worldH * s;
    const ox = 6 + (width - 12 - contentW) / 2 - minX * s;
    const oy = 6 + (height - 12 - contentH) / 2 - minY * s;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);

    switch (forma) {
      case 'rectangulo':
        ctx.fillRect(minX, minY, worldW, worldH);
        ctx.strokeRect(minX, minY, worldW, worldH);
        break;
      case 'cuadrado': {
        const size = Math.min(worldW, worldH) - 16;
        const oxWorld = minX + (worldW - size) / 2;
        const oyWorld = minY + (worldH - size) / 2;
        ctx.fillRect(oxWorld, oyWorld, size, size);
        ctx.strokeRect(oxWorld, oyWorld, size, size);
        break;
      }
      case 'triangulo':
        ctx.beginPath();
        ctx.moveTo(minX + worldW / 2, minY + 10);
        ctx.lineTo(minX + 10, minY + worldH - 10);
        ctx.lineTo(minX + worldW - 10, minY + worldH - 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 'circulo': {
        const radius = Math.min(worldW, worldH) / 2 - 8;
        ctx.beginPath();
        ctx.arc(minX + worldW / 2, minY + worldH / 2, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        break;
      }
    }
    if (escenario) {
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(escenario.x, escenario.y, escenario.width, escenario.height);
      ctx.strokeStyle = '#654321';
      ctx.lineWidth = 2;
      ctx.strokeRect(escenario.x, escenario.y, escenario.width, escenario.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('ESCENARIO', escenario.x + escenario.width / 2, escenario.y + escenario.height / 2);
    }
    areas.forEach(area => {
      ctx.fillStyle = hexToRgba(area.color || COLOR_AREA_DEFAULT, 0.78);
      if (area.forma === 'circulo') {
        const cx = area.x + area.width / 2;
        const cy = area.y + area.height / 2;
        const r = Math.min(area.width, area.height) / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillRect(area.x, area.y, area.width, area.height);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.strokeRect(area.x, area.y, area.width, area.height);
      }
    });
    areas.filter(a => a.tipo_area === 'PERSONAS' && a.capacidad_personas > 0).forEach(area => {
      const colorBase = tiposPrecio.find(tp => tp.id === area.tipo_precio_id)?.color || '#4CAF50';
      ctx.fillStyle = colorBase + '55';
      ctx.fillRect(area.x, area.y, area.width, area.height);
      const r = Math.max(3, Math.round(Math.min(area.width, area.height) / 18));
      const cols = Math.floor(area.width / (r * 3.2));
      const rows2 = Math.floor(area.height / (r * 3.2));
      const gx = cols > 1 ? area.width / cols : area.width;
      const gy = rows2 > 1 ? area.height / rows2 : area.height;
      ctx.fillStyle = colorBase + 'aa';
      for (let ri = 0; ri < rows2; ri++) {
        for (let ci = 0; ci < cols; ci++) {
          ctx.beginPath();
          ctx.arc(area.x + gx * 0.5 + ci * gx, area.y + gy * 0.5 + ri * gy, r, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      ctx.fillStyle = '#000';
      ctx.font = `bold ${Math.min(16, Math.max(10, area.height / 4))}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${area.capacidad_personas} personas`, area.x + area.width / 2, area.y + area.height / 2);
      ctx.textBaseline = 'alphabetic';
    });
    mesas.forEach(mesa => {
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(mesa.x, mesa.y, mesa.width, mesa.height);
      ctx.strokeStyle = '#654321';
      ctx.lineWidth = 1;
      ctx.strokeRect(mesa.x, mesa.y, mesa.width, mesa.height);
      if (mostrarNumerosAsientos) {
        ctx.fillStyle = COLOR_TEXTO_MESA;
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(etiquetaMesa(mesa), mesa.x + mesa.width / 2, mesa.y + mesa.height / 2);
      }
    });
    asientos.forEach(asiento => {
      const tipoPrecio = tiposPrecio.find(tp => tp.id === asiento.tipo_precio_id);
      const color = tipoPrecio?.color || '#2196F3';
      const esPersona = !asiento.mesa_id && String(asiento.numero_asiento || '').startsWith('P');
      const size = asiento.mesa_id ? 4 : 5;
      const sx = (asiento.x || 50) - size / 2;
      const sy = (asiento.y || 50) - size / 2;
      ctx.fillStyle = esPersona ? (tipoPrecio?.color || '#4CAF50') : color;
      if (esPersona) {
        ctx.beginPath();
        ctx.arc(asiento.x || 50, asiento.y || 50, size, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        ctx.fillRect(sx, sy, size, size);
      }
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      if (esPersona) {
        ctx.stroke();
      } else {
        ctx.strokeRect(sx, sy, size, size);
      }
    });
    ctx.restore();
  };

  const getColorForTipoPrecio = (tipoPrecioId) => {
    const tipoPrecio = tiposPrecio.find(tp => tp.id === tipoPrecioId);
    if (tipoPrecio && tipoPrecio.color) {
      return tipoPrecio.color;
    }
    // Colores por defecto únicos si no tiene color asignado
    // Usar el índice en el array de tiposPrecio para asegurar colores únicos
    const index = tiposPrecio.findIndex(tp => tp.id === tipoPrecioId);
    const colors = [
      '#4CAF50',  // Verde
      '#2196F3',  // Azul
      '#FF9800',  // Naranja
      '#9C27B0',  // Morado
      '#F44336',  // Rojo
      '#00BCD4',  // Cyan
      '#FFC107',  // Amarillo
      '#795548',  // Marrón
      '#607D8B',  // Azul gris
      '#E91E63',  // Rosa
      '#3F51B5',  // Índigo
      '#009688',  // Verde azulado
      '#FF5722',  // Naranja oscuro
      '#673AB7',  // Morado oscuro
      '#CDDC39'   // Lima
    ];
    return colors[index % colors.length];
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    return { x: px, y: py };
  };



  // Detectar si el clic está sobre una mesa
  const detectarMesaEnPosicion = (x, y) => {
    for (const mesa of mesas) {
      if (x >= mesa.x && x <= mesa.x + mesa.width && 
          y >= mesa.y && y <= mesa.y + mesa.height) {
        return mesa;
      }
    }
    return null;
  };

  // Detectar si el clic está sobre un asiento
  const detectarAsientoEnPosicion = (x, y) => {
    const radioDeteccion = 8; // Radio de detección para asientos

    // Buscar en todos los asientos
    for (const asiento of asientos) {
      const asientoX = asiento.x || 50;
      const asientoY = asiento.y || 50;
      const distancia = Math.sqrt(Math.pow(x - asientoX, 2) + Math.pow(y - asientoY, 2));
      if (distancia <= radioDeteccion) {
        return asiento;
      }
    }
    return null;
  };

  // Detectar elementos dentro de un rectángulo
  const detectarElementosEnRectangulo = (x, y, width, height) => {
    const elementos = [];
    const minX = Math.min(x, x + width);
    const maxX = Math.max(x, x + width);
    const minY = Math.min(y, y + height);
    const maxY = Math.max(y, y + height);

    // Detectar mesas
    mesas.forEach(mesa => {
      const centroX = mesa.x + mesa.width / 2;
      const centroY = mesa.y + mesa.height / 2;
      if (centroX >= minX && centroX <= maxX && centroY >= minY && centroY <= maxY) {
        elementos.push({ type: 'mesa', id: mesa.id });
      }
    });

    // Detectar SOLO asientos individuales (NO sillas de mesas)
    asientos.forEach(asiento => {
      // Excluir sillas de mesas (asientos con mesa_id)
      if (asiento.mesa_id) {
        return; // No incluir sillas de mesas en la selección
      }
      
      const asientoX = asiento.x || 50;
      const asientoY = asiento.y || 50;
      if (asientoX >= minX && asientoX <= maxX && asientoY >= minY && asientoY <= maxY) {
        elementos.push({ type: 'asiento', id: asiento.id });
      }
    });

    return elementos;
  };

  // Detectar en qué área está un punto
  const detectarAreaEnPosicion = (x, y) => {
    for (const area of areas) {
      if (area.forma === 'circulo') {
        const cx = area.x + area.width / 2;
        const cy = area.y + area.height / 2;
        const r = Math.min(area.width, area.height) / 2;
        const dist = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
        if (dist <= r) return area;
      } else {
        if (x >= area.x && x <= area.x + area.width && 
            y >= area.y && y <= area.y + area.height) {
          return area;
        }
      }
    }
    return null;
  };

  // Generar nombre descriptivo para un elemento
  const generarNombreDescriptivo = (elemento) => {
    if (elemento.type === 'asiento') {
      const asiento = asientos.find(a => a.id === elemento.id);
      if (!asiento) return 'Asiento desconocido';
      
      const label = asiento.codigo_asiento || asiento.numero_asiento;
      const area = areas.find(a => a.id === asiento.area_id);
      const tipoPrecio = tiposPrecio.find(tp => tp.id === asiento.tipo_precio_id);
      const nombreTipo = tipoPrecio?.nombre || 'Sin precio';
      
      if (area) {
        return `Asiento ${label} de ${area.nombre} (${nombreTipo})`;
      }
      return `Asiento ${label} (${nombreTipo})`;
    }
    return 'Elemento desconocido';
  };

  const handleCanvasMouseDown = async (e) => {
    const pos = getMousePos(e);
    setIsDrawing(true);
    setStartPos(pos);

    // Modo de selección
    if (modo === 'seleccionar') {
      // Si se hace clic en un elemento, seleccionarlo/deseleccionarlo
      const mesaClickeada = detectarMesaEnPosicion(pos.x, pos.y);
      const asientoClickeado = detectarAsientoEnPosicion(pos.x, pos.y);

      if (mesaClickeada) {
        // En modo bloqueado, solo mostrar información
        if (layoutBloqueado) {
          const mesa = mesas.find(m => m.id === mesaClickeada.id);
          const area = areas.find(a => a.id === mesa?.area_id);
          const tipoPrecio = tiposPrecio.find(tp => tp.id === mesa?.tipo_precio_id);
          setElementoInfo({
            type: 'mesa',
            id: mesaClickeada.id,
            mesa: mesa,
            area: area,
            tipoPrecio: tipoPrecio
          });
          setCodigoMesaEdit(mesa?.codigo_mesa || '');
          if (mesa?.codigo_mesa) {
            const m = String(mesa.codigo_mesa).toUpperCase().match(/^([A-Z])/);
            if (m) setLetraMesa(m[1]);
          }
          setIsDrawing(false);
          return;
        }

        const yaSeleccionada = elementosSeleccionados.some(sel => sel.type === 'mesa' && sel.id === mesaClickeada.id);
        
        if (e.shiftKey) {
          // Shift+clic: agregar/quitar de selección
          if (yaSeleccionada) {
            setElementosSeleccionados(elementosSeleccionados.filter(sel => !(sel.type === 'mesa' && sel.id === mesaClickeada.id)));
            setIsDrawing(false);
            return;
          } else {
            setElementosSeleccionados([...elementosSeleccionados, { type: 'mesa', id: mesaClickeada.id }]);
          }
        } else {
          // Clic normal: si ya estaba seleccionada, mover todos los seleccionados
          if (yaSeleccionada && elementosSeleccionados.length > 0) {
            // Guardar posiciones originales y mover todos
            const posiciones = {};
            elementosSeleccionados.forEach(sel => {
              if (sel.type === 'mesa') {
                const mesa = mesas.find(m => m.id === sel.id);
                if (mesa) {
                  posiciones[`mesa_${sel.id}`] = { x: mesa.x || 100, y: mesa.y || 100 };
                  // Guardar también las posiciones originales de las sillas de esta mesa
                  const sillasMesa = asientos.filter(a => a.mesa_id === sel.id);
                  sillasMesa.forEach(silla => {
                    posiciones[`asiento_${silla.id}`] = { x: silla.x || 50, y: silla.y || 50 };
                  });
                }
              } else if (sel.type === 'asiento') {
                const asiento = asientos.find(a => a.id === sel.id);
                if (asiento) posiciones[`asiento_${sel.id}`] = { x: asiento.x || 50, y: asiento.y || 50 };
              }
            });
            setPosicionesOriginales(posiciones);
            setElementoArrastrando({ type: 'seleccion', offsetX: pos.x, offsetY: pos.y });
            setIsDrawing(true);
            return;
          } else {
            // Seleccionar solo este elemento y preparar para arrastre
            setElementosSeleccionados([{ type: 'mesa', id: mesaClickeada.id }]);
            const posiciones = {};
            const mesa = mesas.find(m => m.id === mesaClickeada.id);
            if (mesa) {
              posiciones[`mesa_${mesaClickeada.id}`] = { x: mesa.x || 100, y: mesa.y || 100 };
              // Guardar también las posiciones originales de las sillas de esta mesa
              const sillasMesa = asientos.filter(a => a.mesa_id === mesaClickeada.id);
              sillasMesa.forEach(silla => {
                posiciones[`asiento_${silla.id}`] = { x: silla.x || 50, y: silla.y || 50 };
              });
            }
            setPosicionesOriginales(posiciones);
            setElementoArrastrando({ type: 'seleccion', offsetX: pos.x, offsetY: pos.y });
            setIsDrawing(true);
            return;
          }
        }
      } else if (asientoClickeado) {
        // En modo bloqueado, solo mostrar información
        if (layoutBloqueado) {
          const asiento = asientos.find(a => a.id === asientoClickeado.id);
          const area = areas.find(a => a.id === asiento?.area_id);
          const tipoPrecio = tiposPrecio.find(tp => tp.id === asiento?.tipo_precio_id);
          setElementoInfo({
            type: 'asiento',
            id: asientoClickeado.id,
            asiento: asiento,
            area: area,
            tipoPrecio: tipoPrecio
          });
          setIsDrawing(false);
          return;
        }

        const yaSeleccionado = elementosSeleccionados.some(sel => sel.type === 'asiento' && sel.id === asientoClickeado.id);
        
        if (e.shiftKey) {
          // Shift+clic: agregar/quitar de selección
          if (yaSeleccionado) {
            setElementosSeleccionados(elementosSeleccionados.filter(sel => !(sel.type === 'asiento' && sel.id === asientoClickeado.id)));
            setIsDrawing(false);
            return;
          } else {
            setElementosSeleccionados([...elementosSeleccionados, { type: 'asiento', id: asientoClickeado.id }]);
          }
        } else {
          // Clic normal: si ya estaba seleccionado, mover todos los seleccionados
          if (yaSeleccionado && elementosSeleccionados.length > 0) {
            // Guardar posiciones originales y mover todos
            const posiciones = {};
            elementosSeleccionados.forEach(sel => {
              if (sel.type === 'asiento') {
                const asiento = asientos.find(a => a.id === sel.id);
                if (asiento) posiciones[`asiento_${sel.id}`] = { x: asiento.x || 50, y: asiento.y || 50 };
              }
            });
            setPosicionesOriginales(posiciones);
            setElementoArrastrando({ type: 'seleccion', offsetX: pos.x, offsetY: pos.y });
            setIsDrawing(true);
            return;
          } else {
            // Seleccionar solo este elemento y preparar para arrastre
            setElementosSeleccionados([{ type: 'asiento', id: asientoClickeado.id }]);
            const posiciones = {};
            const asiento = asientos.find(a => a.id === asientoClickeado.id);
            if (asiento) posiciones[`asiento_${asientoClickeado.id}`] = { x: asiento.x || 50, y: asiento.y || 50 };
            setPosicionesOriginales(posiciones);
            setElementoArrastrando({ type: 'seleccion', offsetX: pos.x, offsetY: pos.y });
            setIsDrawing(true);
            return;
          }
        }
      }

      // Si no se hizo clic en ningún elemento, iniciar selección por cuadro
      if (!mesaClickeada && !asientoClickeado) {
        setSeleccionCuadro({ x: pos.x, y: pos.y, width: 0, height: 0 });
        if (!e.shiftKey) {
          setElementosSeleccionados([]); // Limpiar selección si no es Shift
        }
      }
      return;
    }

    // Primero verificar si se está haciendo clic en una mesa o asiento existente para moverlo
    const mesaClickeada = detectarMesaEnPosicion(pos.x, pos.y);
    const asientoClickeado = detectarAsientoEnPosicion(pos.x, pos.y);

    // Permitir mover mesas en cualquier modo (excepto cuando se está dibujando escenario o área)
    if (mesaClickeada && modo !== 'escenario' && modo !== 'area' && modo !== 'mesas' && modo !== 'mesa_individual') {
      // Si es clic derecho, eliminar la mesa y sus sillas
      if (e.button === 2 || e.ctrlKey) {
        e.preventDefault();
        const confirmado = await showConfirm(`¿Eliminar mesa ${mesaClickeada.numero_mesa} y todas sus sillas?`, { 
          type: 'warning',
          title: 'Eliminar Mesa'
        });
        if (confirmado) {
          // Eliminar las sillas de la mesa
          setAsientos(asientos.filter(a => a.mesa_id !== mesaClickeada.id));
          // Eliminar la mesa
          setMesas(mesas.filter(m => m.id !== mesaClickeada.id));
        }
        setIsDrawing(false);
        return;
      }
      
      // Guardar posiciones originales de la mesa y sus sillas antes de arrastrar
      const posiciones = {};
      posiciones[`mesa_${mesaClickeada.id}`] = { x: mesaClickeada.x, y: mesaClickeada.y };
      const sillasMesa = asientos.filter(a => a.mesa_id === mesaClickeada.id);
      sillasMesa.forEach(silla => {
        posiciones[`asiento_${silla.id}`] = { x: silla.x || 50, y: silla.y || 50 };
      });
      setPosicionesOriginales(posiciones);
      
      // Arrastrar mesa existente (y sus sillas)
      setElementoArrastrando({
        type: 'mesa',
        id: mesaClickeada.id,
        offsetX: pos.x - mesaClickeada.x,
        offsetY: pos.y - mesaClickeada.y
      });
      return;
    }

    // Permitir mover asientos/personas en cualquier modo (excepto cuando se está dibujando escenario o área)
    if (asientoClickeado && modo !== 'escenario' && modo !== 'area' && modo !== 'mesas' && modo !== 'mesa_individual') {
      const esPersona = String(asientoClickeado.numero_asiento || '').startsWith('P');
      // Si es clic derecho, eliminar el asiento o persona
      if (e.button === 2 || e.ctrlKey) {
        e.preventDefault();
        const confirmado = await showConfirm(esPersona 
          ? `¿Eliminar persona ${asientoClickeado.numero_asiento}?` 
          : `¿Eliminar asiento ${asientoClickeado.numero_asiento}?`, { 
          type: 'warning',
          title: esPersona ? 'Eliminar Persona' : 'Eliminar Asiento'
        });
        if (confirmado) {
          eliminarAsiento(asientoClickeado.id);
        }
        setIsDrawing(false);
        return;
      }
      
      // Si hay elementos seleccionados y este asiento está seleccionado, mover todos
      const estaSeleccionado = elementosSeleccionados.some(sel => sel.type === 'asiento' && sel.id === asientoClickeado.id);
      if (estaSeleccionado && elementosSeleccionados.length > 0) {
        // Guardar posiciones originales
        const posiciones = {};
        elementosSeleccionados.forEach(sel => {
          if (sel.type === 'asiento') {
            const asiento = asientos.find(a => a.id === sel.id);
            if (asiento) posiciones[`asiento_${sel.id}`] = { x: asiento.x || 50, y: asiento.y || 50 };
          }
        });
        setPosicionesOriginales(posiciones);
        setElementoArrastrando({ type: 'seleccion', offsetX: pos.x, offsetY: pos.y });
        setIsDrawing(true);
        return;
      }
      
      // Arrastrar asiento existente
      setElementoArrastrando({
        type: 'asiento',
        id: asientoClickeado.id,
        offsetX: pos.x - (asientoClickeado.x || 50),
        offsetY: pos.y - (asientoClickeado.y || 50)
      });
      return;
    }

    // Si está bloqueado, no permitir crear nuevos elementos
    if (layoutBloqueado) {
      setIsDrawing(false);
      return;
    }

    // Si no se está arrastrando, crear nuevo elemento según el modo
    if (modo === 'escenario') {
      setCurrentElement({ type: 'escenario', x: pos.x, y: pos.y, width: 0, height: 0 });
    } else if (modo === 'area') {
      setCurrentElement({ type: 'area', x: pos.x, y: pos.y, width: 0, height: 0, forma: 'rectangulo' });
    } else if (modo === 'asiento_individual' && tipoPrecioSeleccionado) {
      const { x: cx, y: cy } = clampPointToSheet(pos.x, pos.y, 16);
      
      const area = detectarAreaEnPosicion(cx, cy);
      let acumuladoEnArea = asientos;
      if (area) {
        acumuladoEnArea = asientos.filter(a => {
          const aArea = detectarAreaEnPosicion(a.x || 0, a.y || 0);
          return aArea?.id === area.id;
        });
      }
      const codigo = obtenerSiguienteCodigoAsiento(acumuladoEnArea, letraAsiento);
      
      const nuevoAsiento = {
        id: `temp_asiento_${Date.now()}`,
        x: cx,
        y: cy,
        numero_asiento: codigo,
        codigo_asiento: codigo,
        tipo_precio_id: tipoPrecioSeleccionado,
        area_id: area?.id ?? null
      };
      setAsientos([...asientos, nuevoAsiento]);
      setIsDrawing(false);
    } else if (modo === 'persona_individual' && tipoPrecioSeleccionado) {
      const { x: cx, y: cy } = clampPointToSheet(pos.x, pos.y, 16);
      const personasCount = asientos.filter(a => !a.mesa_id && String(a.numero_asiento || '').startsWith('P')).length;
      const nuevaPersona = {
        id: `temp_asiento_${Date.now()}`,
        x: cx,
        y: cy,
        numero_asiento: `P${personasCount + 1}`,
        tipo_precio_id: tipoPrecioSeleccionado
      };
      setAsientos([...asientos, nuevaPersona]);
      setIsDrawing(false);
    } else if (modo === 'zona_asientos' && tipoPrecioSeleccionado) {
      setCurrentElement({ type: 'zona_asientos', x: pos.x, y: pos.y, width: 0, height: 0 });
      setCurrentZone({ x: pos.x, y: pos.y, width: 0, height: 0 });
    } else if (modo === 'zona_mesas' && tipoPrecioSeleccionado) {
      setCurrentElement({ type: 'zona_mesas', x: pos.x, y: pos.y, width: 0, height: 0 });
      setZonaMesas({ 
        x: pos.x, 
        y: pos.y, 
        width: 0, 
        height: 0, 
        cantidad: cantidadMesas, 
        sillasPorMesa: sillasPorMesa,
        tipo_precio_id: tipoPrecioSeleccionado 
      });
    } else if (modo === 'zona_mesas_solas' && tipoPrecioSeleccionado) {
      setCurrentElement({ type: 'zona_mesas_solas', x: pos.x, y: pos.y, width: 0, height: 0 });
      setZonaMesasSolas({
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        cantidad: cantidadMesas,
        letraMesa: normalizarLetraMesa(letraMesa),
        capacidad_sillas: sillasPorMesa,
        tipo_precio_id: tipoPrecioSeleccionado,
      });
    } else if (modo === 'zona_personas' && tipoPrecioSeleccionado) {
      setCurrentElement({ type: 'zona_personas', x: pos.x, y: pos.y, width: 0, height: 0 });
      setZonaPersonas({ x: pos.x, y: pos.y, width: 0, height: 0 });
    } else if ((modo === 'mesas' || modo === 'mesa_individual' || modo === 'zona_mesas_solas') && tipoPrecioSeleccionado && modo !== 'zona_mesas_solas') {
      // Mesa por defecto más rectangular para que no se pisen las sillas
      const mesaW = formaMesa === 'cuadrado' ? layoutSizes.mesaCuad : layoutSizes.mesaRectW;
      const mesaH = formaMesa === 'cuadrado' ? layoutSizes.mesaCuad : layoutSizes.mesaRectH;
      const { x: mx, y: my } = clampMesaToSheet(pos.x - mesaW / 2, pos.y - mesaH / 2, mesaW, mesaH);
      const codigo = resolverCodigoNuevaMesa(mesas, mx + mesaW / 2, my + mesaH / 2);
      if (codigo && codigoMesaDuplicado(codigo, null, mx + mesaW / 2, my + mesaH / 2)) {
        showAlert(`Ya existe la mesa ${codigo} en esta área`, { type: 'warning' });
        setIsDrawing(false);
        return;
      }
      const numeroMesa = mesas.length + 1;
      const areaMesaInd = detectarAreaEnPosicion(mx + mesaW / 2, my + mesaH / 2);
      const nuevaMesa = {
        id: `temp_mesa_${Date.now()}`,
        x: mx,
        y: my,
        width: mesaW,
        height: mesaH,
        numero_mesa: numeroMesa,
        codigo_mesa: codigo,
        capacidad_sillas: sillasPorMesa,
        tipo_precio_id: tipoPrecioSeleccionado,
        area_id: areaMesaInd?.id ?? null,
        ...getCamposPrecioMesa(),
      };

      setMesas([...mesas, nuevaMesa]);
      agregarSillasDeMesaAlEstado(nuevaMesa);
      setIsDrawing(false);
    }
  };

  const handleCanvasMouseMove = (e) => {
    const pos = getMousePos(e);
    
    // Actualizar posición del mouse para mostrar el indicador del cursor
    setMousePosition(pos);
    // Redibujar canvas para mostrar el indicador del cursor
    if (!isDrawing) {
      dibujarCanvas();
    }

    // Si se está arrastrando una selección múltiple
    if (elementoArrastrando && isDrawing && elementoArrastrando.type === 'seleccion' && elementosSeleccionados.length > 0) {
      const deltaX = pos.x - elementoArrastrando.offsetX;
      const deltaY = pos.y - elementoArrastrando.offsetY;

      // Mover todas las mesas seleccionadas usando posiciones originales
      const mesasSeleccionadas = elementosSeleccionados.filter(sel => sel.type === 'mesa');
      if (mesasSeleccionadas.length > 0) {
        // Primero actualizar las mesas
        setMesas(prevMesas => prevMesas.map(m => {
          const estaSeleccionada = mesasSeleccionadas.some(sel => sel.id === m.id);
          if (estaSeleccionada) {
            const posOriginal = posicionesOriginales[`mesa_${m.id}`];
            if (posOriginal) {
              let nuevaX = posOriginal.x + deltaX;
              let nuevaY = posOriginal.y + deltaY;
              const { x: cx, y: cy } = clampMesaToSheet(nuevaX, nuevaY, m.width || 24, m.height || 24);
              nuevaX = cx; nuevaY = cy;
              return {
                ...m,
                x: nuevaX,
                y: nuevaY
              };
            }
          }
          return m;
        }));
        
        // Luego actualizar las sillas de todas las mesas seleccionadas
        setAsientos(prevAsientos => prevAsientos.map(a => {
          const mesaSeleccionada = mesasSeleccionadas.find(sel => sel.id === a.mesa_id);
          if (mesaSeleccionada) {
            const posOriginalSilla = posicionesOriginales[`asiento_${a.id}`];
            if (posOriginalSilla) {
              const { x: cx, y: cy } = clampPointToSheet(posOriginalSilla.x + deltaX, posOriginalSilla.y + deltaY, 14);
              return { ...a, x: cx, y: cy };
            }
          }
          return a;
        }));
      }

      // Mover todos los asientos seleccionados usando posiciones originales
      const asientosSeleccionados = elementosSeleccionados.filter(sel => sel.type === 'asiento');
      if (asientosSeleccionados.length > 0) {
        setAsientos(prevAsientos => prevAsientos.map(a => {
          const estaSeleccionado = asientosSeleccionados.some(sel => sel.id === a.id);
          if (estaSeleccionado) {
            const posOriginal = posicionesOriginales[`asiento_${a.id}`];
            if (posOriginal) {
              const { x: cx, y: cy } = clampPointToSheet(posOriginal.x + deltaX, posOriginal.y + deltaY, 16);
              return { ...a, x: cx, y: cy };
            }
          }
          return a;
        }));
      }

      dibujarCanvas();
      return;
    }

    // Si se está arrastrando una mesa o asiento individual
    if (elementoArrastrando && isDrawing) {
      if (elementoArrastrando.type === 'mesa') {
        let nuevaX = pos.x - elementoArrastrando.offsetX;
        let nuevaY = pos.y - elementoArrastrando.offsetY;
        const mesa = mesas.find(m => m.id === elementoArrastrando.id);
        if (mesa) {
          const { x: cx, y: cy } = clampMesaToSheet(nuevaX, nuevaY, mesa.width || 24, mesa.height || 24);
          nuevaX = cx; nuevaY = cy;
          const posOriginalMesa = posicionesOriginales[`mesa_${elementoArrastrando.id}`] || { x: mesa.x, y: mesa.y };
          const deltaX = nuevaX - posOriginalMesa.x;
          const deltaY = nuevaY - posOriginalMesa.y;
          
          setMesas(mesas.map(m => 
            m.id === elementoArrastrando.id 
              ? { ...m, x: nuevaX, y: nuevaY }
              : m
          ));
          
          // Mover también las sillas de la mesa usando sus posiciones originales
          setAsientos(asientos.map(a => {
            if (a.mesa_id === elementoArrastrando.id) {
              const posOriginalSilla = posicionesOriginales[`asiento_${a.id}`] || { x: a.x, y: a.y };
              return {
                ...a,
                x: posOriginalSilla.x + deltaX,
                y: posOriginalSilla.y + deltaY
              };
            }
            return a;
          }));
        }
        dibujarCanvas();
        return;
      } else if (elementoArrastrando.type === 'asiento') {
        const { x: cx, y: cy } = clampPointToSheet(
          pos.x - elementoArrastrando.offsetX,
          pos.y - elementoArrastrando.offsetY,
          16
        );
        setAsientos(asientos.map(a => 
          a.id === elementoArrastrando.id ? { ...a, x: cx, y: cy } : a
        ));
        dibujarCanvas();
        return;
      }
    }

    // Si está en modo selección y se está dibujando un cuadro
    if (modo === 'seleccionar' && isDrawing && seleccionCuadro) {
      const width = pos.x - startPos.x;
      const height = pos.y - startPos.y;
      const x = Math.min(startPos.x, pos.x);
      const y = Math.min(startPos.y, pos.y);
      const w = Math.abs(width);
      const h = Math.abs(height);

      setSeleccionCuadro({ x, y, width: w, height: h });
      dibujarCanvas();
      return;
    }

    if (!isDrawing) return;

    if (currentElement) {
      let x, y, w, h;
      const width = pos.x - startPos.x;
      const height = pos.y - startPos.y;
      x = Math.min(startPos.x, pos.x);
      y = Math.min(startPos.y, pos.y);
      w = Math.abs(width);
      h = Math.abs(height);
      const clamped = clampRectToSheet({ x, y, width: w, height: h });
      x = clamped.x; y = clamped.y; w = clamped.width; h = clamped.height;

      const updatedElement = {
        ...currentElement,
        x,
        y,
        width: w,
        height: h,
        ...(modo === 'area' && { forma: 'rectangulo' })
      };

      setCurrentElement(updatedElement);

      if (modo === 'escenario') {
        setEscenario({ x, y, width: w, height: h });
      } else if (modo === 'area') {
        // El área se agregará al soltar el mouse
      } else if (modo === 'zona_asientos') {
        setCurrentZone({ x, y, width: w, height: h });
      } else if (modo === 'zona_mesas') {
        setZonaMesas({ 
          ...zonaMesas, 
          x, 
          y, 
          width: w, 
          height: h 
        });
      } else if (modo === 'zona_mesas_solas') {
        setZonaMesasSolas({
          ...zonaMesasSolas,
          x,
          y,
          width: w,
          height: h,
        });
      } else if (modo === 'zona_personas') {
        setZonaPersonas({ x, y, width: w, height: h });
      }

      // Redibujar canvas inmediatamente para mostrar el preview
      dibujarCanvas();
    }
  };

  const handleCanvasMouseLeave = () => {
    // Ocultar indicador del cursor cuando el mouse sale del canvas
    setMousePosition(null);
    dibujarCanvas();
    // También llamar a handleCanvasMouseUp para finalizar cualquier dibujo
    handleCanvasMouseUp();
  };

  const handleCanvasMouseUp = () => {
    // Si se estaba dibujando un cuadro de selección
    if (seleccionCuadro && modo === 'seleccionar' && seleccionCuadro.width > 5 && seleccionCuadro.height > 5) {
      const elementosEnCuadro = detectarElementosEnRectangulo(
        seleccionCuadro.x,
        seleccionCuadro.y,
        seleccionCuadro.width,
        seleccionCuadro.height
      );
      
      // Agregar elementos al cuadro a la selección (o reemplazar si no es Shift)
      setElementosSeleccionados(elementosEnCuadro);
      setSeleccionCuadro(null);
    } else if (seleccionCuadro) {
      setSeleccionCuadro(null);
    }

    if (elementoArrastrando) {
      // Finalizar arrastre
      setElementoArrastrando(null);
      setPosicionesOriginales({});
      setIsDrawing(false);
      return;
    }

    if (currentElement && modo === 'area') {
      // Solo pedir el nombre si el área tiene un tamaño mínimo (más de 10 píxeles)
      if (currentElement.width > 10 && currentElement.height > 10) {
        // Guardar el área pendiente y mostrar el modal
        setAreaPendiente(currentElement);
        setNombreAreaModal(nombreArea);
        setMostrarModalNombreArea(true);
        dibujarCanvas(); // Redibujar para mantener el preview
      } else {
        // Si el área es muy pequeña, simplemente limpiar el preview sin pedir nombre
        dibujarCanvas(); // Redibujar para limpiar el preview
      }
    } else if (currentZone && modo === 'zona_asientos' && tipoPrecioSeleccionado) {
      // Confirmar zona de asientos y generar asientos en esa zona
      const zona = {
        ...currentZone,
        cantidad: cantidadAsientos,
        tipo_precio_id: tipoPrecioSeleccionado,
        letraAsiento: letraAsiento,
        paridad: paridadAsientoRef.current
      };
      setZonaAsientos(zona); // Solo para mostrar visualmente la última zona
      generarAsientosAutomaticos(zona);
    } else if (zonaMesas && modo === 'zona_mesas' && tipoPrecioSeleccionado) {
      generarMesasAutomaticas(zonaMesas);
      setZonaMesas(null);
    } else if (zonaMesasSolas && modo === 'zona_mesas_solas' && tipoPrecioSeleccionado) {
      if (zonaMesasSolas.width > 10 && zonaMesasSolas.height > 10) {
        generarMesasSinSillasEnZona({ ...zonaMesasSolas, paridad: paridadMesaSolaRef.current });
      }
      setZonaMesasSolas(null);
    } else if (zonaPersonas && modo === 'zona_personas' && tipoPrecioSeleccionado) {
      if (zonaPersonas.width > 10 && zonaPersonas.height > 10) {
        const cap = calcularCapacidadPersonas(zonaPersonas);
        if (cantidadPersonas > cap) {
          showAlert(
            `En esta zona caben aprox. ${cap} personas con el tamaño de icono actual. Amplía la zona, sube el tamaño de la hoja o baja el slider de iconos.`,
            { type: 'warning' }
          );
        }
        generarPersonasAutomaticas({ ...zonaPersonas, tipo_precio_id: tipoPrecioSeleccionado, cantidad: cantidadPersonas });
      }
      setZonaPersonas(null);
    }

    setIsDrawing(false);
    setStartPos(null);
    setCurrentElement(null);
    setCurrentZone(null);
  };

  const eliminarAsiento = (id) => {
    setAsientos(asientos.filter(a => a.id !== id));
  };

  const limpiarZonaAsientos = () => {
    // Solo eliminar asientos individuales (sin mesa_id) que fueron generados automáticamente
    // Las sillas de mesas (con mesa_id) NO deben eliminarse
    setZonaAsientos(null);
    setAsientos(asientos.filter(a => {
      // Mantener todos los asientos que tienen mesa_id (sillas de mesas)
      if (a.mesa_id) {
        return true;
      }
      // Mantener asientos que no son temporales (ya guardados en BD)
      if (a.id && typeof a.id === 'number' && a.id < 1000000) {
        return true;
      }
      // Mantener asientos individuales creados manualmente (no de zona automática)
      // Los asientos de zona automática tienen IDs como "temp_asiento_..."
      if (typeof a.id === 'string' && a.id.startsWith('temp_asiento_')) {
        return false; // Eliminar estos (son de zona automática)
      }
      // Mantener el resto
      return true;
    }));
  };

  const eliminarArea = (id) => {
    setAreas(areas.filter(a => a.id !== id));
  };

  const asignarPrecioASeleccion = () => {
    if (!tipoPrecioSeleccionado || elementosSeleccionados.length === 0) {
      showAlert('Selecciona un tipo de precio y elementos primero', { type: 'warning' });
      return;
    }

    let elementosActualizados = 0;

    // Separar mesas y asientos seleccionados
    const mesasSeleccionadas = elementosSeleccionados.filter(sel => sel.type === 'mesa');
    const asientosIndividualesSeleccionados = elementosSeleccionados.filter(sel => sel.type === 'asiento');
    const idsMesas = mesasSeleccionadas.map(sel => sel.id);
    const idsAsientos = asientosIndividualesSeleccionados.map(sel => sel.id);

    // Actualizar mesas seleccionadas
    if (mesasSeleccionadas.length > 0) {
      elementosActualizados += mesasSeleccionadas.length;
      setMesas(prevMesas => prevMesas.map(m => {
        const estaSeleccionada = idsMesas.includes(m.id);
        if (estaSeleccionada) {
          return { ...m, tipo_precio_id: tipoPrecioSeleccionado };
        }
        return m;
      }));
    }

    // Actualizar asientos: tanto los asociados a mesas seleccionadas como los individuales seleccionados
    // Combinamos ambas actualizaciones en una sola llamada para evitar conflictos
    if (mesasSeleccionadas.length > 0 || asientosIndividualesSeleccionados.length > 0) {
      if (asientosIndividualesSeleccionados.length > 0) {
        elementosActualizados += asientosIndividualesSeleccionados.length;
      }
      
      setAsientos(prevAsientos => prevAsientos.map(a => {
        // Si la silla pertenece a una mesa seleccionada, actualizar su precio
        if (a.mesa_id && idsMesas.includes(a.mesa_id)) {
          return { ...a, tipo_precio_id: tipoPrecioSeleccionado };
        }
        // Si el asiento individual está seleccionado, actualizar su precio
        if (!a.mesa_id && idsAsientos.includes(a.id)) {
          return { ...a, tipo_precio_id: tipoPrecioSeleccionado };
        }
        return a;
      }));
    }

    // Limpiar selección
    setElementosSeleccionados([]);

    // Redibujar canvas para mostrar nuevos colores
    dibujarCanvas();
    
    if (elementosActualizados > 0) {
      showAlert(`Precio asignado a ${elementosActualizados} elemento(s)`, { type: 'success' });
    }
  };

  const eliminarElementosSeleccionados = async () => {
    if (elementosSeleccionados.length === 0) {
      showAlert('No hay elementos seleccionados para eliminar', { type: 'warning' });
      return;
    }

    const confirmado = await showConfirm(`¿Eliminar ${elementosSeleccionados.length} elemento(s) seleccionado(s)?`, { 
      type: 'warning',
      title: 'Eliminar Elementos'
    });
    if (!confirmado) {
      return;
    }

    // Eliminar mesas seleccionadas (y sus sillas asociadas)
    const mesasSeleccionadas = elementosSeleccionados.filter(sel => sel.type === 'mesa');
    if (mesasSeleccionadas.length > 0) {
      const idsMesas = mesasSeleccionadas.map(sel => sel.id);
      // Eliminar las sillas asociadas a estas mesas
      setAsientos(prev => prev.filter(a => !a.mesa_id || !idsMesas.includes(a.mesa_id)));
      // Eliminar las mesas
      setMesas(prev => prev.filter(m => !idsMesas.includes(m.id)));
    }

    // Eliminar asientos seleccionados
    const asientosSeleccionados = elementosSeleccionados.filter(sel => sel.type === 'asiento');
    if (asientosSeleccionados.length > 0) {
      const idsAsientos = asientosSeleccionados.map(sel => sel.id);
      setAsientos(prev => prev.filter(a => !idsAsientos.includes(a.id)));
    }

    // Limpiar selección
    setElementosSeleccionados([]);
  };

  const OFFSET_DUPLICADO = 60;

  const duplicarElementosSeleccionados = () => {
    if (elementosSeleccionados.length === 0) {
      showAlert('Selecciona elementos para duplicar', { type: 'warning' });
      return;
    }
    if (layoutBloqueado) {
      showAlert('No se puede duplicar con el layout bloqueado', { type: 'warning' });
      return;
    }

    const mesasSeleccionadas = elementosSeleccionados.filter(sel => sel.type === 'mesa');
    const asientosSeleccionados = elementosSeleccionados.filter(sel => sel.type === 'asiento');
    const idsMesasSeleccionadas = new Set(mesasSeleccionadas.map(s => s.id));
    const asientosSinMesaSeleccionada = asientosSeleccionados.filter(sel => {
      const a = asientos.find(x => x.id === sel.id);
      return a && (!a.mesa_id || !idsMesasSeleccionadas.has(a.mesa_id));
    });

    const nuevasMesas = [];
    const nuevosAsientos = [];
    const maxNumeroMesa = mesas.length > 0 ? Math.max(...mesas.map(m => m.numero_mesa || 0)) : 0;
    let proximoNumeroMesa = maxNumeroMesa + 1;

    mesasSeleccionadas.forEach((sel, idx) => {
      const mesa = mesas.find(m => m.id === sel.id);
      if (!mesa) return;
      const nuevaMesaId = `temp_mesa_${Date.now()}_dup_${idx}`;
      let nx = (mesa.x || 0) + OFFSET_DUPLICADO;
      let ny = (mesa.y || 0) + OFFSET_DUPLICADO;
      const { x: cx, y: cy } = clampMesaToSheet(nx, ny, mesa.width || 24, mesa.height || 24);
      nx = cx;
      ny = cy;
      const nuevaMesa = {
        id: nuevaMesaId,
        x: nx,
        y: ny,
        width: mesa.width || 24,
        height: mesa.height || 24,
        numero_mesa: proximoNumeroMesa++,
        capacidad_sillas: mesa.capacidad_sillas || 4,
        tipo_precio_id: mesa.tipo_precio_id,
        area_id: mesa.area_id || null
      };
      nuevasMesas.push(nuevaMesa);

      const sillasMesa = asientos.filter(a => a.mesa_id === mesa.id);
      sillasMesa.forEach((silla, i) => {
        let sx = (silla.x || 50) + OFFSET_DUPLICADO;
        let sy = (silla.y || 50) + OFFSET_DUPLICADO;
        const c = clampPointToSheet(sx, sy, 14);
        sx = c.x;
        sy = c.y;
        nuevosAsientos.push({
          id: `temp_silla_${nuevaMesaId}_${i}`,
          x: sx,
          y: sy,
          numero_asiento: silla.numero_asiento || `${i + 1}`,
          tipo_precio_id: silla.tipo_precio_id,
          mesa_id: nuevaMesaId
        });
      });
    });

    const asientosA = asientos.filter(a => !a.mesa_id && !String(a.numero_asiento || '').startsWith('P'));
    const personasExistentes = asientos.filter(a => !a.mesa_id && String(a.numero_asiento || '').startsWith('P'));
    let contA = asientosA.length + 1;
    let contP = personasExistentes.length + 1;

    asientosSinMesaSeleccionada.forEach((sel, idx) => {
      const asiento = asientos.find(a => a.id === sel.id);
      if (!asiento) return;
      const esPersona = String(asiento.numero_asiento || '').startsWith('P');
      let nx = (asiento.x || 50) + OFFSET_DUPLICADO;
      let ny = (asiento.y || 50) + OFFSET_DUPLICADO;
      const c = clampPointToSheet(nx, ny, 16);
      nx = c.x;
      ny = c.y;
      const numero = esPersona ? `P${contP++}` : `A${contA++}`;
      nuevosAsientos.push({
        id: `temp_asiento_${Date.now()}_dup_${idx}`,
        x: nx,
        y: ny,
        numero_asiento: numero,
        tipo_precio_id: asiento.tipo_precio_id,
        mesa_id: null
      });
    });

    if (nuevasMesas.length > 0) setMesas(prev => [...prev, ...nuevasMesas]);
    if (nuevosAsientos.length > 0) setAsientos(prev => [...prev, ...nuevosAsientos]);

    const nuevosSeleccionados = [
      ...nuevasMesas.map(m => ({ type: 'mesa', id: m.id })),
      ...nuevosAsientos.map(a => ({ type: 'asiento', id: a.id }))
    ];
    setElementosSeleccionados(nuevosSeleccionados);
  };

  // Detectar elementos dentro de un área específica
  const detectarElementosEnArea = (area) => {
    const elementos = [];

    const puntoDentro = (px, py) => {
      if (area.forma === 'circulo') {
        const cx = area.x + area.width / 2;
        const cy = area.y + area.height / 2;
        const r = Math.min(area.width, area.height) / 2;
        const dist = Math.sqrt(Math.pow(px - cx, 2) + Math.pow(py - cy, 2));
        return dist <= r;
      }
      return px >= area.x && px <= area.x + area.width && 
             py >= area.y && py <= area.y + area.height;
    };

    asientos.forEach(asiento => {
      if (asiento.mesa_id) return;
      const asientoX = asiento.x || 50;
      const asientoY = asiento.y || 50;
      if (puntoDentro(asientoX, asientoY)) {
        elementos.push({ type: 'asiento', id: asiento.id });
      }
    });

    return elementos;
  };

  const eliminarElementosEnArea = async (areaId) => {
    const area = areas.find(a => a.id === areaId);
    if (!area) return;

    const elementosEnArea = detectarElementosEnArea(area);
    if (elementosEnArea.length === 0) {
      showAlert(`No hay elementos dentro del área "${area.nombre}"`, { type: 'warning' });
      return;
    }

    const confirmado = await showConfirm(`¿Eliminar ${elementosEnArea.length} elemento(s) dentro del área "${area.nombre}"?`, { 
      type: 'warning',
      title: 'Eliminar Elementos del Área'
    });
    if (!confirmado) {
      return;
    }

    // Eliminar asientos dentro del área
    const asientosEnArea = elementosEnArea.filter(sel => sel.type === 'asiento');
    if (asientosEnArea.length > 0) {
      const idsAsientos = asientosEnArea.map(sel => sel.id);
      setAsientos(asientos.filter(a => !idsAsientos.includes(a.id)));
    }
  };

  // Aplicar renumeración en pantalla (mesas M1,M2... y asientos A1,P1... en orden posición)
  const aplicarRenumeracion = () => {
    if (layoutBloqueado) {
      showAlert('No se puede renumerar con el layout bloqueado', { type: 'warning' });
      return;
    }
    const ordenarPorPosicion = (a, b) => {
      const ay = (a.y ?? a.posicion_y ?? 0);
      const by = (b.y ?? b.posicion_y ?? 0);
      if (Math.abs(ay - by) > 5) return ay - by;
      return (a.x ?? a.posicion_x ?? 0) - (b.x ?? b.posicion_x ?? 0);
    };

    const mesasOrdenadas = [...mesas].sort(ordenarPorPosicion);
    const mesasRenumeradas = mesasOrdenadas.map((m, i) => {
      if (m.codigo_mesa && String(m.codigo_mesa).trim()) return m;
      return { ...m, numero_mesa: i + 1 };
    });
    setMesas(mesasRenumeradas);

    const asientosConMesa = asientos.filter(a => a.mesa_id);
    const asientosIndividuales = asientos.filter(a => !a.mesa_id && !String(a.numero_asiento || '').startsWith('P'));
    const personas = asientos.filter(a => !a.mesa_id && String(a.numero_asiento || '').startsWith('P'));

    const asientosIndOrd = [...asientosIndividuales].sort(ordenarPorPosicion).map((a, i) => ({ ...a, numero_asiento: `A${i + 1}` }));
    const personasOrd = [...personas].sort(ordenarPorPosicion).map((a, i) => ({ ...a, numero_asiento: `P${i + 1}` }));

    const todasSillas = asientos.filter(a => a.mesa_id);
    const asientosFinales = [...asientosIndOrd, ...personasOrd, ...todasSillas];
    setAsientos(asientosFinales);
  };

  // Función para renumerar asientos asegurando que no haya duplicados
  const renumerarElementos = (numeroAsientoInicial = 0) => {
    // Renumerar SOLO asientos individuales (sin mesa_id)
    // Las sillas de mesas mantienen sus números simples (1, 2, 3...)
    // Personas (P1, P2...) mantienen su prefijo P
    let contadorAsientos = numeroAsientoInicial;
    let contadorPersonas = 0;
    
    const asientosRenumerados = asientos.map((asiento) => {
      if (asiento.mesa_id) {
        return asiento;
      }
      const esPersona = String(asiento.numero_asiento || '').startsWith('P');
      if (esPersona) {
        contadorPersonas++;
        return { ...asiento, numero_asiento: `P${contadorPersonas}` };
      }
      contadorAsientos++;
      return { ...asiento, numero_asiento: `A${contadorAsientos}` };
    });

    return {
      asientos: asientosRenumerados
    };
  };

  // Función para calcular resumen del layout
  const calcularResumenLayout = () => {
    const totalAreas = areas.length;
    const totalMesas = mesas.length;
    
    // Separar: sillas de mesas, asientos individuales (sillas), personas (espacio pie)
    const sillasDeMesas = asientos.filter(a => a.mesa_id).length;
    const personasPie = asientos.filter(a => !a.mesa_id && String(a.numero_asiento || '').startsWith('P')).length;
    const asientosIndividuales = asientos.filter(a => !a.mesa_id && !String(a.numero_asiento || '').startsWith('P')).length;
    const totalAsientos = sillasDeMesas + asientosIndividuales; // solo sillas, sin personas
    const totalPersonas = personasPie;
    
    // Calcular capacidad total de mesas (suma de capacidad_sillas de todas las mesas)
    const capacidadTotalMesas = mesas.reduce((total, mesa) => {
      return total + (mesa.capacidad_sillas || 0);
    }, 0);

    // Agrupar por tipo de precio: sillas (mesas + individuales) y personas (espacio pie)
    const porTipoPrecio = {};
    
    const normalizarTipoId = (tipoPrecioId) => {
      if (tipoPrecioId === null || tipoPrecioId === undefined) {
        return 'sin_precio';
      }
      return String(tipoPrecioId);
    };
    
    asientos.forEach(a => {
      const tipoId = normalizarTipoId(a.tipo_precio_id);
      if (!porTipoPrecio[tipoId]) {
        porTipoPrecio[tipoId] = { sillas: 0, personas: 0 };
      }
      const esPersona = !a.mesa_id && String(a.numero_asiento || '').startsWith('P');
      if (esPersona) {
        porTipoPrecio[tipoId].personas += 1;
      } else {
        porTipoPrecio[tipoId].sillas += 1;
      }
    });

    return {
      totalAsientos,
      totalAreas,
      totalMesas,
      sillasDeMesas,
      asientosIndividuales,
      personasPie,
      capacidadTotalMesas,
      porTipoPrecio
    };
  };

  const guardarLayout = async () => {
    if (!eventoSeleccionado) {
      showAlert('Selecciona un evento primero', { type: 'warning' });
      return;
    }

    // Calcular resumen
    const resumen = calcularResumenLayout();
    
    // Mostrar modal de resumen
    setResumenLayout(resumen);
    setMostrarModalResumen(true);
  };

  const confirmarGuardado = async () => {
    setMostrarModalResumen(false);
    
    if (!eventoSeleccionado) {
      return;
    }

    // Inicializar progreso
    setMostrarModalProgreso(true);
    setProgresoGuardado({ mensaje: 'Iniciando guardado...', porcentaje: 0, detalles: [] });

    try {
      // Renumerar elementos primero para calcular el total
      const { asientos: asientosRenumerados } = renumerarElementos(0);
      
      // Calcular total de pasos para el progreso (aproximado)
      // Estimamos pasos: evento (1) + mesas + asientos (cada 10) + areas
      const pasosAsientos = Math.max(1, Math.ceil(asientosRenumerados.length / 10));
      const totalPasos = 1 + mesas.length + pasosAsientos + areas.length;
      let pasosProcesados = 0;

      const actualizarProgreso = (mensaje, detalle = null) => {
        pasosProcesados++;
        const porcentaje = Math.round((pasosProcesados / totalPasos) * 100);
        setProgresoGuardado(prev => ({
          mensaje,
          porcentaje: Math.min(porcentaje, 99), // Máximo 99% hasta que termine
          detalles: detalle ? [...prev.detalles.slice(-19), detalle] : prev.detalles // Mantener solo los últimos 20
        }));
      };
      
      // Obtener elementos existentes para eliminarlos antes de guardar los nuevos
      actualizarProgreso('Obteniendo elementos existentes...');
      const [asientosExistentesRes, mesasExistentesRes] = await Promise.all([
        api.get(`/asientos/evento/${eventoSeleccionado.id}`),
        api.get(`/mesas/evento/${eventoSeleccionado.id}`)
      ]);

      // Los elementos ya están renumerados arriba
      
      // NO actualizar el estado todavía - guardar primero, luego recargar
      // Esto evita que las posiciones se pierdan durante el guardado
      // Guardar forma del espacio y escenario en el evento, y bloquear el layout
      actualizarProgreso('Guardando configuración del evento...');
      await api.put(`/eventos/${eventoSeleccionado.id}`, {
        forma_espacio: forma,
        escenario_x: escenario?.x || null,
        escenario_y: escenario?.y || null,
        escenario_width: escenario?.width || null,
        escenario_height: escenario?.height || null,
        hoja_ancho: hojaAncho,
        hoja_alto: hojaAlto,
        layout_bloqueado: true
      });

      // Eliminar TODOS los asientos existentes antes de guardar los nuevos
      // Esto evita conflictos de números duplicados durante la actualización y respeta la integridad referencial (FK)
      if (asientosExistentesRes.data.success) {
        for (const asientoExistente of asientosExistentesRes.data.data) {
          try {
            await api.delete(`/asientos/${asientoExistente.id}`);
          } catch (error) {
            // Si el asiento ya no existe, continuar sin error
            if (error.response?.status !== 404) {
              console.warn('Error al eliminar asiento:', error);
            }
          }
        }
      }

      // Eliminar TODAS las mesas existentes antes de guardar las nuevas
      if (mesasExistentesRes.data.success) {
        for (const mesaExistente of mesasExistentesRes.data.data) {
          try {
            await api.delete(`/mesas/${mesaExistente.id}`);
          } catch (error) {
            if (error.response?.status !== 404) {
              console.warn('Error al eliminar mesa:', error);
            }
          }
        }
      }

      // Guardar mesas primero
      actualizarProgreso(`Guardando ${mesas.length} mesa(s)...`);
      const mesasGuardadas = [];
      for (let i = 0; i < mesas.length; i++) {
        const mesa = mesas[i];
        // Validar que la mesa tenga capacidad_sillas válida
        if (!mesa.capacidad_sillas || mesa.capacidad_sillas < 1) {
          console.error('Mesa sin capacidad_sillas válida:', mesa);
          showAlert(`La mesa M${mesa.numero_mesa} no tiene un número válido de sillas. Debe tener al menos 1 silla.`, { type: 'error' });
          continue; // Saltar esta mesa y continuar con las demás
        }

        // Detectar en qué área está la mesa
        const areaEncontrada = detectarAreaEnPosicion(mesa.x + mesa.width / 2, mesa.y + mesa.height / 2);
        let areaId = null;
        if (areaEncontrada?.id && typeof areaEncontrada.id === 'number' && areaEncontrada.id <= 1000000) {
          areaId = areaEncontrada.id;
        }

        const response = await api.post('/mesas', {
          evento_id: eventoSeleccionado.id,
          numero_mesa: mesa.numero_mesa,
          codigo_mesa: mesa.codigo_mesa?.trim() ? String(mesa.codigo_mesa).trim().toUpperCase() : null,
          capacidad_sillas: parseInt(mesa.capacidad_sillas) || 1, // Asegurar que sea un número entero válido
          tipo_precio_id: mesa.tipo_precio_id,
          posicion_x: Math.round(mesa.x),
          posicion_y: Math.round(mesa.y),
          ancho: Math.round(mesa.width),
          alto: Math.round(mesa.height),
          area_id: areaId,
          precio_mesa_completa: mesa.precio_mesa_completa ?? null,
          precio_silla_individual: mesa.precio_silla_individual ?? null,
          venta_solo_mesa: mesa.venta_solo_mesa ? 1 : 0,
        });

        if (response.data.success) {
          mesasGuardadas.push({ ...mesa, id: response.data.data.id });
          actualizarProgreso(`Guardando mesa ${i + 1} de ${mesas.length}...`, `✅ Mesa ${mesa.numero_mesa} registrada`);
        }
      }

      // Guardar asientos con posiciones y área (usar los renumerados)
      // Ahora todos son nuevos, así que usamos POST
      actualizarProgreso(`Guardando ${asientosRenumerados.length} asiento(s)...`);
      for (let i = 0; i < asientosRenumerados.length; i++) {
        const asiento = asientosRenumerados[i];
        // Detectar en qué área está el asiento
        const areaEncontrada = detectarAreaEnPosicion(asiento.x || 50, asiento.y || 50);
        // Solo usar area_id si es un número válido (no un ID temporal)
        let areaId = null;
        if (areaEncontrada?.id && typeof areaEncontrada.id === 'number' && areaEncontrada.id <= 1000000) {
          areaId = areaEncontrada.id;
        }

        // Buscar la mesa asociada si el asiento tiene mesa_id
        let mesaId = null;
        if (asiento.mesa_id) {
          // Buscar la mesa guardada que corresponde a este asiento
          const mesaOriginal = mesas.find(m => m.id === asiento.mesa_id);
          if (mesaOriginal) {
            const mesaGuardada = mesasGuardadas.find((m) => {
              if (mesaOriginal.codigo_mesa && m.codigo_mesa === mesaOriginal.codigo_mesa) return true;
              return (
                m.numero_mesa === mesaOriginal.numero_mesa &&
                m.tipo_precio_id === mesaOriginal.tipo_precio_id
              );
            });
            if (mesaGuardada) {
              mesaId = mesaGuardada.id;
            }
          }
        }
        
        // Todos los asientos son nuevos ahora (eliminamos los existentes arriba)
        await api.post('/asientos', {
          evento_id: eventoSeleccionado.id,
          mesa_id: mesaId,
          numero_asiento: asiento.numero_asiento,
          codigo_asiento: asiento.codigo_asiento || null,
          tipo_precio_id: asiento.tipo_precio_id,
          posicion_x: asiento.x ? Math.round(asiento.x) : null,
          posicion_y: asiento.y ? Math.round(asiento.y) : null,
          area_id: areaId
        });
        
        // Actualizar progreso cada 10 asientos o si es el último
        if ((i + 1) % 10 === 0 || i === asientosRenumerados.length - 1) {
          const tipoAsiento = asiento.mesa_id ? 'Silla' : 'Asiento';
          actualizarProgreso(`Guardando asiento ${i + 1} de ${asientosRenumerados.length}...`, `✅ ${tipoAsiento} ${asiento.numero_asiento} registrado`);
        }
      }

      // Guardar áreas
      actualizarProgreso(`Guardando ${areas.length} área(s)...`);
      // Eliminar áreas existentes que no están en la lista actual
      const areasExistentes = await api.get(`/areas/evento/${eventoSeleccionado.id}`);
      if (areasExistentes.data.success) {
        for (const areaExistente of areasExistentes.data.data) {
          const existeEnLista = areas.some(a => a.id === areaExistente.id);
          if (!existeEnLista) {
            await api.delete(`/areas/${areaExistente.id}`);
          }
        }
      }

      // Guardar o actualizar áreas y actualizar IDs en el estado local
      const areasActualizadas = [];
      for (let i = 0; i < areas.length; i++) {
        const area = areas[i];
        if (!area.id || typeof area.id === 'string' || (typeof area.id === 'number' && area.id > 1000000)) {
          // Es un área nueva
          const response = await api.post('/areas', {
            evento_id: eventoSeleccionado.id,
            nombre: area.nombre,
            posicion_x: Math.round(area.x),
            posicion_y: Math.round(area.y),
            ancho: Math.round(area.width),
            alto: Math.round(area.height),
            color: area.color || '#CCCCCC',
            forma: area.forma || 'rectangulo',
            tipo_area: area.tipo_area || 'SILLAS',
            capacidad_personas: area.tipo_area === 'PERSONAS' ? (area.capacidad_personas || 50) : null,
            tipo_precio_id: area.tipo_area === 'PERSONAS' ? (area.tipo_precio_id || tipoPrecioSeleccionado) : null
          });
          if (response.data.success) {
            areasActualizadas.push({ ...area, id: response.data.data.id });
            actualizarProgreso(`Guardando área ${i + 1} de ${areas.length}...`, `✅ Área "${area.nombre}" registrada`);
          }
        } else {
          // Actualizar área existente
          actualizarProgreso(`Actualizando área ${i + 1} de ${areas.length}...`);
          await api.put(`/areas/${area.id}`, {
            nombre: area.nombre,
            posicion_x: Math.round(area.x),
            posicion_y: Math.round(area.y),
            ancho: Math.round(area.width),
            alto: Math.round(area.height),
            color: area.color || '#CCCCCC',
            forma: area.forma || 'rectangulo',
            tipo_area: area.tipo_area || 'SILLAS',
            capacidad_personas: area.tipo_area === 'PERSONAS' ? (area.capacidad_personas || 50) : null,
            tipo_precio_id: area.tipo_area === 'PERSONAS' ? (area.tipo_precio_id || tipoPrecioSeleccionado) : null
          });
          areasActualizadas.push(area);
          actualizarProgreso(`Área ${i + 1} de ${areas.length} actualizada...`, `✅ Área "${area.nombre}" actualizada`);
        }
      }
      // Actualizar áreas en el estado local con los IDs correctos
      if (areasActualizadas.length > 0) {
        setAreas(areasActualizadas);
      }

      // IMPORTANTE: Recargar el layout completo desde la base de datos al final
      // Esto asegura que los asientos tengan las posiciones exactas guardadas
      // y que los IDs estén correctamente sincronizados
      actualizarProgreso('Recargando layout desde la base de datos...');
      await cargarLayout(eventoSeleccionado.id);
      
      // Cerrar modal de progreso
      setProgresoGuardado({ mensaje: '✅ Guardado completado exitosamente', porcentaje: 100, detalles: [] });
      setTimeout(() => {
        setMostrarModalProgreso(false);
        showAlert('Layout guardado exitosamente. El diseño ahora está bloqueado para edición.', { type: 'success' });
      }, 500);
      // El estado de bloqueo ya se carga desde la BD en cargarLayout
    } catch (error) {
      console.error('Error al guardar layout:', error);
      setMostrarModalProgreso(false);
      showAlert('Error al guardar el layout: ' + (error.response?.data?.message || error.message), { type: 'error' });
    }
  };

  if (loading) {
    return <div className="admin-page">Cargando eventos...</div>;
  }

  return (
    <div className="admin-page">
      <div className="admin-content">
        <div className="espacio-header">
          <h1>Configuración de Espacios</h1>
          <p>Diseña el layout de tus eventos especiales</p>
        </div>

        <div className="espacio-container">
          {/* Panel izquierdo - Controles */}
          <div className="espacio-controls">
            <div className="control-section">
              <h3>Seleccionar Evento</h3>
              <select
                value={eventoSeleccionado?.id || ''}
                onChange={(e) => {
                  const evento = eventos.find(ev => ev.id === parseInt(e.target.value));
                  setEventoSeleccionado(evento);
                }}
                className="select-input"
              >
                <option value="">-- Selecciona un evento especial (múltiples precios) --</option>
                {eventos.length === 0 ? (
                  <option value="" disabled>
                    No hay eventos especiales disponibles
                  </option>
                ) : (
                  eventos.map(evento => (
                    <option key={evento.id} value={evento.id}>
                      {evento.titulo}
                    </option>
                  ))
                )}
              </select>
              {eventos.length === 0 && (
                <p style={{ fontSize: '12px', color: '#666', marginTop: '8px', fontStyle: 'italic' }}>
                  Solo se muestran eventos con múltiples precios (VIP, Balcón, etc.). Los eventos con precio único no se muestran aquí.
                </p>
              )}
            </div>

              {eventoSeleccionado && (
              <div className="control-section">
                <p style={{ marginBottom: '10px' }}>
                  Usa el botón para abrir el dibujo ampliado con todas las herramientas.
                </p>
                <button
                  onClick={() => setMostrarCanvasAmpliado(true)}
                  style={{
                    padding: '12px',
                    backgroundColor: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%'
                  }}
                >
                  🔍 Abrir dibujo ampliado
                </button>
              </div>
            )}

                



                {(modo === 'asiento_individual' || modo === 'persona_individual' || modo === 'zona_asientos') && (
                  <div className="control-section">
                    <h3>Configuración de {modo === 'persona_individual' ? 'Persona' : 'Asientos'}</h3>
                    {modo === 'persona_individual' && (
                      <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                        Haz clic para colocar una persona (círculo). Arrastra para mover. Clic derecho o Ctrl+clic para eliminar. Selecciona y asigna precio como los demás.
                      </p>
                    )}
                    {modo === 'zona_asientos' && (
                      <>
                        <div className="form-group-small">
                          <label>Letra de fila</label>
                          <input
                            type="text"
                            maxLength={1}
                            value={letraAsiento}
                            onChange={(e) => {
                              const L = normalizarLetraAsiento(e.target.value);
                              setLetraAsiento(L);
                              if (zonaAsientos) setZonaAsientos({ ...zonaAsientos, letraAsiento: L });
                            }}
                            className="select-input"
                            style={{ width: '4rem', textTransform: 'uppercase' }}
                          />
                        </div>
                        <div className="form-group-small">
                          <label>Cantidad de Asientos</label>
                          <input
                            type="number"
                            min="1"
                            max={MAX_ELEMENTOS_ZONA}
                            value={cantidadAsientos}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 10;
                              setCantidadAsientos(val);
                              if (zonaAsientos) {
                                setZonaAsientos({ ...zonaAsientos, cantidad: val });
                              }
                            }}
                            className="select-input"
                          />
                        </div>
                        <div className="form-group-small">
                          <label>Numeración</label>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                            {[['normal','Normal'],['impar','Solo impares'],['par','Solo pares']].map(([val, lbl]) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setParidadAsiento(val)}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '11px',
                                  borderRadius: '4px',
                                  border: '1px solid #aaa',
                                  cursor: 'pointer',
                                  background: paridadAsiento === val ? '#3b82f6' : '#f3f4f6',
                                  color: paridadAsiento === val ? '#fff' : '#333',
                                  fontWeight: paridadAsiento === val ? 'bold' : 'normal'
                                }}
                              >{lbl}</button>
                            ))}
                          </div>
                          <p style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                            {paridadAsiento === 'impar' ? `Genera: ${letraAsiento}1, ${letraAsiento}3, ${letraAsiento}5…` : paridadAsiento === 'par' ? `Genera: ${letraAsiento}2, ${letraAsiento}4, ${letraAsiento}6…` : `Genera: ${letraAsiento}1, ${letraAsiento}2, ${letraAsiento}3…`}
                          </p>
                        </div>
                        {zonaAsientos && (
                          <button
                            type="button"
                            onClick={limpiarZonaAsientos}
                            className="btn-eliminar-zona"
                          >
                            ✕ Eliminar Zona de Asientos
                          </button>
                        )}
                      </>
                    )}
                    {modo === 'asiento_individual' && (
                      <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                        Haz clic en el canvas para colocar un asiento. Arrastra los asientos existentes para moverlos. Clic derecho o Ctrl+clic para eliminar.
                      </p>
                    )}
                  </div>
                )}

                     {(modo === 'mesas' || modo === 'mesa_individual') && (
                  <div className="control-section">
                    <h3>Configuración de Mesas</h3>
                    <div className="form-group-small">
                      <label>Forma de la Mesa</label>
                      <div className="forma-buttons" style={{ marginTop: '5px' }}>
                        <button
                          className={formaMesa === 'cuadrado' ? 'active' : ''}
                          onClick={() => setFormaMesa('cuadrado')}
                          style={{ padding: '0.4rem' }}
                        >
                          Cuadrado
                        </button>
                        <button
                          className={formaMesa === 'rectangulo' ? 'active' : ''}
                          onClick={() => setFormaMesa('rectangulo')}
                          style={{ padding: '0.4rem' }}
                        >
                          Rectángulo
                        </button>
                      </div>
                    </div>
                    <label className="checkbox-label espacio-precios-mesa__check">
                      <input
                        type="checkbox"
                        checked={mesasSinSillasVisibles}
                        onChange={(e) => setMesasSinSillasVisibles(e.target.checked)}
                      />
                      Solo mesa en el plano (sin dibujar sillas; capacidad = personas)
                    </label>
                    <div className="form-group-small">
                      <label>Letra de fila</label>
                      <input
                        type="text"
                        maxLength={1}
                        value={letraMesa}
                        onChange={(e) => setLetraMesa(normalizarLetraMesa(e.target.value))}
                        className="select-input"
                        style={{ width: '4rem', textTransform: 'uppercase' }}
                      />
                      <p className="form-hint">
                        Numeración automática al colocar: {obtenerSiguienteCodigoMesa(mesas, letraMesa)} (cambia fila con B, C… para otra hilera).
                      </p>
                    </div>
                    <div className="form-group-small">
                      <label>{mesasSinSillasVisibles ? 'Capacidad (personas)' : 'Sillas por mesa'}</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={sillasPorMesa}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 4;
                          setSillasPorMesa(Math.max(1, Math.min(30, val)));
                        }}
                        className="select-input"
                      />
                    </div>
                    <div className="espacio-precios-mesa">
                      <h4 className="espacio-precios-mesa__titulo">Precios de venta (mesas nuevas)</h4>
                      <div className="form-group-small">
                        <label>Precio mesa completa (Bs.)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={mesaPrecioCompleta}
                          onChange={(e) => setMesaPrecioCompleta(e.target.value)}
                          className="select-input"
                          placeholder="Ej: 3500"
                        />
                      </div>
                      <label className="checkbox-label espacio-precios-mesa__check">
                        <input
                          type="checkbox"
                          checked={mesaVentaSoloMesa}
                          onChange={(e) => setMesaVentaSoloMesa(e.target.checked)}
                          disabled={mesasSinSillasVisibles}
                        />
                        Solo vender mesa entera (sin sillas sueltas)
                      </label>
                      {!mesaVentaSoloMesa && (
                        <div className="form-group-small">
                          <label>Precio por silla suelta (Bs.)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={mesaPrecioSilla}
                            onChange={(e) => setMesaPrecioSilla(e.target.value)}
                            className="select-input"
                            placeholder="Ej: 100"
                          />
                        </div>
                      )}
                      <p className="form-hint">
                        Ej.: VIP 3500 solo mesa entera, o mesa 600 completa y sillas sueltas a 100.
                      </p>
                    </div>
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                      {mesasSinSillasVisibles
                        ? 'Clic en el canvas: cada mesa recibe el siguiente código (A1, A2…).'
                        : 'Clic en el canvas: mesa con sillas alrededor.'}
                    </p>
                  </div>
                )}

                {modo === 'zona_mesas_solas' && (
                  <div className="control-section">
                    <h3>Mesas sin sillas (automático)</h3>
                    <div className="form-group-small">
                      <label>Letra de fila</label>
                      <input
                        type="text"
                        maxLength={1}
                        value={letraMesa}
                        onChange={(e) => {
                          const L = normalizarLetraMesa(e.target.value);
                          setLetraMesa(L);
                          if (zonaMesasSolas) setZonaMesasSolas({ ...zonaMesasSolas, letraMesa: L });
                        }}
                        className="select-input"
                        style={{ width: '4rem', textTransform: 'uppercase' }}
                      />
                    </div>
                    <div className="form-group-small">
                      <label>Cantidad de mesas en la zona</label>
                      <input
                        type="number"
                        min="1"
                        max={MAX_ELEMENTOS_ZONA}
                        value={cantidadMesas}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 1;
                          setCantidadMesas(val);
                          if (zonaMesasSolas) setZonaMesasSolas({ ...zonaMesasSolas, cantidad: val });
                        }}
                        className="select-input"
                      />
                    </div>
                    <div className="form-group-small">
                      <label>Capacidad (personas por mesa)</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={sillasPorMesa}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 4;
                          setSillasPorMesa(Math.max(1, Math.min(30, val)));
                          if (zonaMesasSolas) setZonaMesasSolas({ ...zonaMesasSolas, capacidad_sillas: val });
                        }}
                        className="select-input"
                      />
                    </div>
                    <div className="espacio-precios-mesa">
                      <h4 className="espacio-precios-mesa__titulo">Precios (mesas de la zona)</h4>
                      <div className="form-group-small">
                        <label>Precio mesa completa (Bs.)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={mesaPrecioCompleta}
                          onChange={(e) => setMesaPrecioCompleta(e.target.value)}
                          className="select-input"
                          placeholder="Ej: 3500"
                        />
                      </div>
                    </div>
                    <div className="form-group-small">
                       <label>Numeración</label>
                       <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                         {[['normal','Normal'],['impar','Solo impares'],['par','Solo pares']].map(([val, lbl]) => (
                           <button key={val} type="button" onClick={() => setParidadMesaSola(val)}
                             style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #aaa', cursor: 'pointer',
                               background: paridadMesaSola === val ? '#f57c00' : '#f3f4f6',
                               color: paridadMesaSola === val ? '#fff' : '#333',
                               fontWeight: paridadMesaSola === val ? 'bold' : 'normal' }}
                           >{lbl}</button>
                         ))}
                       </div>
                       <p style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                         {paridadMesaSola === 'impar' ? `Genera: ${letraMesa}1, ${letraMesa}3, ${letraMesa}5…` : paridadMesaSola === 'par' ? `Genera: ${letraMesa}2, ${letraMesa}4, ${letraMesa}6…` : `Genera: ${letraMesa}1, ${letraMesa}2, ${letraMesa}3…`}
                       </p>
                     </div>
                     <p className="form-hint">Arrastra un rectángulo: se crearán {cantidadMesas} mesas en una fila</p>
                  </div>
                )}

                {modo === 'zona_mesas' && (
                  <div className="control-section">
                    <h3>Configuración de Zona de Mesas</h3>
                    <div className="form-group-small">
                      <label>Cantidad de Mesas</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={cantidadMesas}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setCantidadMesas(val);
                          if (zonaMesas) {
                            setZonaMesas({ ...zonaMesas, cantidad: val });
                          }
                        }}
                        className="select-input"
                      />
                    </div>
                    <div className="form-group-small">
                      <label>Sillas por Mesa</label>
                      <input
                        type="number"
                        min="2"
                        max="20"
                        value={sillasPorMesa}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 4;
                          setSillasPorMesa(Math.max(2, Math.min(20, val)));
                          if (zonaMesas) {
                            setZonaMesas({ ...zonaMesas, sillasPorMesa: val });
                          }
                        }}
                        className="select-input"
                      />
                    </div>
                    <div className="espacio-precios-mesa">
                      <h4 className="espacio-precios-mesa__titulo">Precios de venta (zona de mesas)</h4>
                      <div className="form-group-small">
                        <label>Precio mesa completa (Bs.)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={mesaPrecioCompleta}
                          onChange={(e) => setMesaPrecioCompleta(e.target.value)}
                          className="select-input"
                          placeholder="Ej: 600"
                        />
                      </div>
                      <label className="checkbox-label espacio-precios-mesa__check">
                        <input
                          type="checkbox"
                          checked={mesaVentaSoloMesa}
                          onChange={(e) => setMesaVentaSoloMesa(e.target.checked)}
                        />
                        Solo vender mesa entera (sin sillas sueltas)
                      </label>
                      {!mesaVentaSoloMesa && (
                        <div className="form-group-small">
                          <label>Precio por silla suelta (Bs.)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={mesaPrecioSilla}
                            onChange={(e) => setMesaPrecioSilla(e.target.value)}
                            className="select-input"
                            placeholder="Ej: 100"
                          />
                        </div>
                      )}
                    </div>
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                      Haz clic y arrastra para dibujar la zona. Las mesas con sillas se generarán automáticamente.
                    </p>
                  </div>
                )}

                

                

                {/* Panel de información del elemento seleccionado */}
                {elementoInfo && (
                  <div className="control-section" style={{ 
                    backgroundColor: '#f5f5f5', 
                    padding: '15px', 
                    borderRadius: '5px',
                    border: '2px solid #2196F3'
                  }}>
                    <h3 style={{ marginTop: 0, color: '#2196F3' }}>📋 Información del Elemento</h3>
                    {elementoInfo.type === 'mesa' && elementoInfo.mesa && (
                      <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                        <p><strong>Nombre:</strong> {generarNombreDescriptivo({ type: 'mesa', id: elementoInfo.mesa.id })}</p>
                        <p><strong>Código en plano:</strong> {etiquetaMesa(elementoInfo.mesa)}</p>
                        <p><strong>Capacidad:</strong> {elementoInfo.mesa.capacidad_sillas} personas</p>
                        <div className="form-group-small" style={{ marginTop: '8px' }}>
                          <label>Editar código</label>
                          <input
                            type="text"
                            maxLength={20}
                            value={codigoMesaEdit}
                            onChange={(e) => setCodigoMesaEdit(e.target.value.toUpperCase())}
                            className="select-input"
                          />
                        </div>
                        {elementoInfo.area && <p><strong>Área:</strong> {elementoInfo.area.nombre}</p>}
                        {elementoInfo.tipoPrecio && (
                          <>
                            <p><strong>Tipo de Precio (respaldo):</strong> {elementoInfo.tipoPrecio.nombre}</p>
                            <p><strong>Precio tipo:</strong> Bs. {elementoInfo.tipoPrecio.precio}</p>
                          </>
                        )}
                        <p>
                          <strong>Mesa completa:</strong>{' '}
                          {elementoInfo.mesa.precio_mesa_completa != null
                            ? `Bs. ${elementoInfo.mesa.precio_mesa_completa}`
                            : '— (suma de sillas)'}
                        </p>
                        <p>
                          <strong>Venta:</strong>{' '}
                          {elementoInfo.mesa.venta_solo_mesa ? 'Solo mesa entera' : 'Mesa completa o sillas sueltas'}
                        </p>
                        {!elementoInfo.mesa.venta_solo_mesa && (
                          <p>
                            <strong>Silla suelta:</strong>{' '}
                            {elementoInfo.mesa.precio_silla_individual != null
                              ? `Bs. ${elementoInfo.mesa.precio_silla_individual}`
                              : `Bs. ${elementoInfo.tipoPrecio?.precio ?? '—'}`}
                          </p>
                        )}
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ marginTop: '8px' }}
                          onClick={() => aplicarPreciosAMesa(elementoInfo.mesa.id)}
                        >
                          Aplicar precios del panel a esta mesa
                        </button>
                        <p><strong>Posición:</strong> ({Math.round(elementoInfo.mesa.x || 0)}, {Math.round(elementoInfo.mesa.y || 0)})</p>
                      </div>
                    )}
                    {elementoInfo.type === 'asiento' && elementoInfo.asiento && (
                      <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                        <p><strong>Nombre:</strong> {generarNombreDescriptivo({ type: 'asiento', id: elementoInfo.asiento.id })}</p>
                        <p><strong>Número de {elementoInfo.mesa ? 'Silla' : 'Asiento'}:</strong> {elementoInfo.asiento.codigo_asiento || elementoInfo.asiento.numero_asiento}</p>
                        {elementoInfo.mesa && (
                          <>
                            <p><strong>Mesa:</strong> Mesa {elementoInfo.mesa.numero_mesa}</p>
                            <p><strong>Tipo:</strong> 🪑 Silla de Mesa</p>
                          </>
                        )}
                        {!elementoInfo.mesa && (
                          <p><strong>Tipo:</strong> {String(elementoInfo.asiento?.numero_asiento || '').startsWith('P') ? '👤 Persona Individual' : '💺 Asiento Individual'}</p>
                        )}
                        {elementoInfo.area && <p><strong>Área:</strong> {elementoInfo.area.nombre}</p>}
                        {elementoInfo.tipoPrecio && (
                          <>
                            <p><strong>Tipo de Precio:</strong> {elementoInfo.tipoPrecio.nombre}</p>
                            <p><strong>Precio:</strong> ${elementoInfo.tipoPrecio.precio}</p>
                          </>
                        )}
                        <p><strong>Posición:</strong> ({Math.round(elementoInfo.asiento.x || 0)}, {Math.round(elementoInfo.asiento.y || 0)})</p>
                        {elementoInfo.mesa && (
                          <div style={{ 
                            marginTop: '10px', 
                            padding: '8px', 
                            backgroundColor: '#e3f2fd', 
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}>
                            <strong>💡 Información:</strong> Esta silla pertenece a la Mesa {elementoInfo.mesa.numero_mesa}
                            {elementoInfo.area && ` en el área ${elementoInfo.area.nombre}`}.
                            {elementoInfo.tipoPrecio && ` Precio: $${elementoInfo.tipoPrecio.precio}`}
                          </div>
                        )}
                      </div>
                    )}
                    <button 
                      onClick={() => setElementoInfo(null)}
                      style={{ 
                        marginTop: '10px', 
                        padding: '5px 10px', 
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Cerrar
                    </button>
                  </div>
                )}
              
            
          </div>
          {eventoSeleccionado && (
            <div className="espacio-preview">
              <h3>Vista previa</h3>
              <div style={{
                border: '1px solid #ddd',
                borderRadius: '6px',
                background: '#fff',
                padding: '6px'
              }}>
                <canvas
                  ref={miniCanvasRef}
                  width={480}
                  height={320}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>
            </div>
          )}
          <Modal
            isOpen={mostrarCanvasAmpliado}
            onClose={() => setMostrarCanvasAmpliado(false)}
            closeOnOverlayClick={false}
            title="Dibujo ampliado"
            large={true}
            tools={
              <>
                {renderTamanoHojaSection()}
                <div className="control-section">
                  <h3>Herramientas</h3>
                  <div className="modo-buttons">
                    <button
                      className={modo === 'escenario' ? 'active' : ''}
                      onClick={() => {
                        if (!layoutBloqueado) {
                          setModo('escenario');
                          setElementosSeleccionados([]);
                        }
                      }}
                      disabled={layoutBloqueado}
                      title={layoutBloqueado ? 'Layout bloqueado' : 'Dibujar escenario'}
                    >
                      🎭 Escenario
                    </button>
                    <button
                      className={modo === 'area' ? 'active' : ''}
                      onClick={() => {
                        if (!layoutBloqueado) {
                          setModo('area');
                          setElementosSeleccionados([]);
                        }
                      }}
                      disabled={layoutBloqueado}
                      title={layoutBloqueado ? 'Layout bloqueado' : 'Dibujar área personalizada'}
                    >
                      📐 Área Personalizada
                    </button>
                    <button
                      className={modo === 'seleccionar' ? 'active' : ''}
                      onClick={() => {
                        setModo('seleccionar');
                        setElementoInfo(null);
                      }}
                      title={layoutBloqueado ? 'Ver información de elementos' : 'Selecciona y mueve múltiples elementos. Shift+clic para selección múltiple, arrastra para cuadro de selección'}
                    >
                      🖱️ {layoutBloqueado ? 'Ver Info' : 'Seleccionar/Mover'}
                    </button>
                    <button
                      className={modo === 'asiento_individual' ? 'active' : ''}
                      onClick={() => {
                        if (!layoutBloqueado) {
                          setModo('asiento_individual');
                          setElementosSeleccionados([]);
                        }
                      }}
                      disabled={layoutBloqueado || !tipoPrecioSeleccionado}
                      title={layoutBloqueado ? 'Layout bloqueado' : 'Haz clic en el canvas para colocar un asiento'}
                    >
                      💺 Asiento Individual
                    </button>
                    <button
                      className={modo === 'persona_individual' ? 'active' : ''}
                      onClick={() => {
                        if (!layoutBloqueado) {
                          setModo('persona_individual');
                          setElementosSeleccionados([]);
                        }
                      }}
                      disabled={layoutBloqueado || !tipoPrecioSeleccionado}
                      title={layoutBloqueado ? 'Layout bloqueado' : 'Haz clic para colocar una persona (círculo)'}
                    >
                      👤 Persona Individual
                    </button>
                    <button
                      className={modo === 'mesas' ? 'active' : ''}
                      onClick={() => {
                        if (!layoutBloqueado) {
                          setModo('mesas');
                          setElementosSeleccionados([]);
                        }
                      }}
                      disabled={layoutBloqueado || !tipoPrecioSeleccionado}
                      title={layoutBloqueado ? 'Layout bloqueado' : 'Haz clic en el canvas para colocar una mesa con sillas alrededor'}
                    >
                      🪑 Mesas
                    </button>
                    <button
                      className={modo === 'mesa_individual' ? 'active' : ''}
                      onClick={() => {
                        if (!layoutBloqueado) {
                          setModo('mesa_individual');
                          setElementosSeleccionados([]);
                        }
                      }}
                      disabled={layoutBloqueado || !tipoPrecioSeleccionado}
                      title={layoutBloqueado ? 'Layout bloqueado' : 'Coloca una mesa individual con sus sillas'}
                    >
                      🪑 Mesa individual
                    </button>
                    <button
                      className={modo === 'zona_asientos' ? 'active' : ''}
                      onClick={() => {
                        if (!layoutBloqueado) {
                          setModo('zona_asientos');
                          setElementosSeleccionados([]);
                        }
                      }}
                      disabled={layoutBloqueado || !tipoPrecioSeleccionado}
                      title={layoutBloqueado ? 'Layout bloqueado' : 'Dibuja una zona y los asientos se generarán automáticamente'}
                    >
                      📦 Zona Asientos (Auto)
                    </button>
                    <button
                      className={modo === 'zona_mesas' ? 'active' : ''}
                      onClick={() => {
                        if (!layoutBloqueado) {
                          setModo('zona_mesas');
                          setElementosSeleccionados([]);
                        }
                      }}
                      disabled={layoutBloqueado || !tipoPrecioSeleccionado}
                      title={layoutBloqueado ? 'Layout bloqueado' : 'Dibuja una zona y las mesas con sillas se generarán automáticamente'}
                    >
                      🪑 Mesas con Sillas (Auto)
                    </button>
                    <button
                      className={modo === 'zona_mesas_solas' ? 'active' : ''}
                      onClick={() => {
                        if (!layoutBloqueado) {
                          setModo('zona_mesas_solas');
                          setMesasSinSillasVisibles(true);
                          setElementosSeleccionados([]);
                        }
                      }}
                      disabled={layoutBloqueado || !tipoPrecioSeleccionado}
                      title={layoutBloqueado ? 'Layout bloqueado' : 'Zona: mesas A1, A2… sin sillas'}
                    >
                      📋 Mesas sin sillas (Auto)
                    </button>
                    <button
                      className={modo === 'zona_personas' ? 'active' : ''}
                      onClick={() => {
                        if (!layoutBloqueado) {
                          setModo('zona_personas');
                          setElementosSeleccionados([]);
                        }
                      }}
                      disabled={layoutBloqueado || !tipoPrecioSeleccionado}
                      title={layoutBloqueado ? 'Layout bloqueado' : 'Dibuja una zona de personas de pie (capacidad por cantidad)'}
                    >
                      👥 Zona Personas (Auto)
                    </button>
                  </div>
                  
                </div>

                {modo === 'area' && (
                  <div className="control-section">
                    <h3>Configuración de Área</h3>
                    <div className="form-group-small">
                      <label>Nombre del Área</label>
                      <input
                        type="text"
                        placeholder="Ej: PALCO, VIP, Balcón..."
                        value={nombreArea}
                        onChange={(e) => setNombreArea(e.target.value)}
                        className="select-input"
                      />
                    </div>
                    <SelectorColorArea
                      color={colorAreaNueva}
                      onChange={setColorAreaNueva}
                      disabled={layoutBloqueado}
                    />
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                      Elige el color, dibuja el rectángulo y confirma el nombre al terminar.
                    </p>
                    {areas.length > 0 && (
                      <div style={{ marginTop: '15px' }}>
                        <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Áreas creadas:</h4>
                        {areas.map(area => {
                          const elementosEnArea = detectarElementosEnArea(area);
                          return (
                            <div key={area.id} style={{ 
                              padding: '8px',
                              marginBottom: '8px',
                              backgroundColor: '#f5f5f5',
                              borderRadius: '4px',
                              border: '1px solid #ddd'
                            }}>
                              <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                marginBottom: '5px'
                              }}>
                                <span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span
                                    style={{
                                      width: 14,
                                      height: 14,
                                      borderRadius: 3,
                                      backgroundColor: area.color || COLOR_AREA_DEFAULT,
                                      border: '1px solid #999',
                                      flexShrink: 0,
                                    }}
                                  />
                                  {area.nombre}
                                </span>
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                                  <span className="espacio-area-color-inline" title="Cambiar color de fondo">
                                    <input
                                      type="color"
                                      value={area.color || COLOR_AREA_DEFAULT}
                                      onChange={(e) => cambiarColorArea(area.id, e.target.value)}
                                      disabled={layoutBloqueado}
                                    />
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => abrirEditarArea(area)}
                                    title="Configurar tipo (sillas/personas) y capacidad"
                                    style={{
                                      background: '#2196F3',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '3px',
                                      padding: '3px 8px',
                                      cursor: 'pointer',
                                      fontSize: '11px'
                                    }}
                                  >
                                    ⚙️ Editar
                                  </button>
                                  {elementosEnArea.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => eliminarElementosEnArea(area.id)}
                                      title={`Eliminar ${elementosEnArea.length} elemento(s) dentro de esta área`}
                                      style={{
                                        background: '#FF9800',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        padding: '3px 8px',
                                        cursor: 'pointer',
                                        fontSize: '11px'
                                      }}
                                    >
                                      🗑️ Eliminar ({elementosEnArea.length})
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => eliminarArea(area.id)}
                                    title="Eliminar el área (no elimina los elementos dentro)"
                                    style={{
                                      background: '#f44336',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '3px',
                                      padding: '3px 8px',
                                      cursor: 'pointer',
                                      fontSize: '12px'
                                    }}
                                  >
                                    ✕ Área
                                  </button>
                                </div>
                              </div>
                              <div style={{ fontSize: '11px', color: '#666' }}>
                                {area.tipo_area === 'PERSONAS'
                                  ? `Personas: ${area.capacidad_personas || '-'}`
                                  : area.tipo_area === 'MESAS'
                                    ? 'Mesas'
                                    : 'Sillas'}
                                {elementosEnArea.length > 0 && ` · ${elementosEnArea.length} elemento(s)`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {modo === 'zona_personas' && (
                  <div className="control-section">
                    <h3>Zona Personas</h3>
                    <div className="form-group-small">
                      <label>Límite de Personas</label>
                      <input
                        type="number"
                        min="1"
                        max={MAX_ELEMENTOS_ZONA}
                        value={cantidadPersonas}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 50;
                          setCantidadPersonas(Math.max(1, Math.min(MAX_ELEMENTOS_ZONA, val)));
                        }}
                        className="select-input"
                        placeholder="Máx. personas"
                      />
                    </div>
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                      Clic y arrastra para dibujar la zona. Se generarán hasta {cantidadPersonas} personas (círculos) del mismo tamaño que las sillas.
                    </p>
                  </div>
                )}

                {(modo === 'asiento_individual' || modo === 'persona_individual' || modo === 'zona_asientos') && (
                  <div className="control-section">
                    <h3>Configuración de {modo === 'persona_individual' ? 'Persona' : 'Asientos'}</h3>
                    {modo === 'persona_individual' && (
                      <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                        Haz clic para colocar una persona (círculo). Arrastra para mover. Clic derecho o Ctrl+clic para eliminar. Selecciona y asigna precio como los demás.
                      </p>
                    )}
                    {modo === 'zona_asientos' && (
                      <>
                        <div className="form-group-small">
                          <label>Letra de fila</label>
                          <input
                            type="text"
                            maxLength={1}
                            value={letraAsiento}
                            onChange={(e) => {
                              const L = normalizarLetraAsiento(e.target.value);
                              setLetraAsiento(L);
                              if (zonaAsientos) setZonaAsientos({ ...zonaAsientos, letraAsiento: L });
                            }}
                            className="select-input"
                            style={{ width: '4rem', textTransform: 'uppercase' }}
                          />
                        </div>
                        <div className="form-group-small">
                          <label>Cantidad de Asientos</label>
                          <input
                            type="number"
                            min="1"
                            max={MAX_ELEMENTOS_ZONA}
                            value={cantidadAsientos}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 10;
                              setCantidadAsientos(val);
                              if (zonaAsientos) {
                                setZonaAsientos({ ...zonaAsientos, cantidad: val });
                              }
                            }}
                            className="select-input"
                          />
                        </div>
                        <div className="form-group-small">
                          <label>Numeración</label>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                            {[['normal','Normal'],['impar','Solo impares'],['par','Solo pares']].map(([val, lbl]) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setParidadAsiento(val)}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '11px',
                                  borderRadius: '4px',
                                  border: '1px solid #aaa',
                                  cursor: 'pointer',
                                  background: paridadAsiento === val ? '#3b82f6' : '#f3f4f6',
                                  color: paridadAsiento === val ? '#fff' : '#333',
                                  fontWeight: paridadAsiento === val ? 'bold' : 'normal'
                                }}
                              >{lbl}</button>
                            ))}
                          </div>
                          <p style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                            {paridadAsiento === 'impar' ? `Genera: ${letraAsiento}1, ${letraAsiento}3, ${letraAsiento}5…` : paridadAsiento === 'par' ? `Genera: ${letraAsiento}2, ${letraAsiento}4, ${letraAsiento}6…` : `Genera: ${letraAsiento}1, ${letraAsiento}2, ${letraAsiento}3…`}
                          </p>
                        </div>
                        {zonaAsientos && (
                          <button
                            type="button"
                            onClick={limpiarZonaAsientos}
                            className="btn-eliminar-zona"
                          >
                            ✕ Eliminar Zona de Asientos
                          </button>
                        )}
                      </>
                    )}
                    {modo === 'asiento_individual' && (
                      <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                        Haz clic en el canvas para colocar un asiento. Arrastra los asientos existentes para moverlos. Clic derecho o Ctrl+clic para eliminar.
                      </p>
                    )}
                  </div>
                )}

                {(modo === 'mesas' || modo === 'mesa_individual') && (
                  <div className="control-section">
                    <h3>Configuración de Mesas</h3>
                    <div className="form-group-small">
                      <label>Forma de la Mesa</label>
                      <div className="forma-buttons" style={{ marginTop: '5px' }}>
                        <button
                          className={formaMesa === 'cuadrado' ? 'active' : ''}
                          onClick={() => setFormaMesa('cuadrado')}
                          style={{ padding: '0.4rem' }}
                        >
                          Cuadrado
                        </button>
                        <button
                          className={formaMesa === 'rectangulo' ? 'active' : ''}
                          onClick={() => setFormaMesa('rectangulo')}
                          style={{ padding: '0.4rem' }}
                        >
                          Rectángulo
                        </button>
                      </div>
                    </div>
                    <label className="checkbox-label espacio-precios-mesa__check">
                      <input
                        type="checkbox"
                        checked={mesasSinSillasVisibles}
                        onChange={(e) => setMesasSinSillasVisibles(e.target.checked)}
                      />
                      Solo mesa en el plano (sin dibujar sillas; capacidad = personas)
                    </label>
                    <div className="form-group-small">
                      <label>Letra de fila</label>
                      <input
                        type="text"
                        maxLength={1}
                        value={letraMesa}
                        onChange={(e) => setLetraMesa(normalizarLetraMesa(e.target.value))}
                        className="select-input"
                        style={{ width: '4rem', textTransform: 'uppercase' }}
                      />
                      <p className="form-hint">
                        Numeración automática al colocar: {obtenerSiguienteCodigoMesa(mesas, letraMesa)} (cambia fila con B, C… para otra hilera).
                      </p>
                    </div>
                    <div className="form-group-small">
                      <label>{mesasSinSillasVisibles ? 'Capacidad (personas)' : 'Sillas por mesa'}</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={sillasPorMesa}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 4;
                          setSillasPorMesa(Math.max(1, Math.min(30, val)));
                        }}
                        className="select-input"
                      />
                    </div>
                    <div className="espacio-precios-mesa">
                      <h4 className="espacio-precios-mesa__titulo">Precios de venta (mesas nuevas)</h4>
                      <div className="form-group-small">
                        <label>Precio mesa completa (Bs.)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={mesaPrecioCompleta}
                          onChange={(e) => setMesaPrecioCompleta(e.target.value)}
                          className="select-input"
                          placeholder="Ej: 3500"
                        />
                      </div>
                      <label className="checkbox-label espacio-precios-mesa__check">
                        <input
                          type="checkbox"
                          checked={mesaVentaSoloMesa}
                          onChange={(e) => setMesaVentaSoloMesa(e.target.checked)}
                          disabled={mesasSinSillasVisibles}
                        />
                        Solo vender mesa entera (sin sillas sueltas)
                      </label>
                      {!mesaVentaSoloMesa && (
                        <div className="form-group-small">
                          <label>Precio por silla suelta (Bs.)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={mesaPrecioSilla}
                            onChange={(e) => setMesaPrecioSilla(e.target.value)}
                            className="select-input"
                            placeholder="Ej: 100"
                          />
                        </div>
                      )}
                      <p className="form-hint">
                        Ej.: VIP 3500 solo mesa entera, o mesa 600 completa y sillas sueltas a 100.
                      </p>
                    </div>
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                      {mesasSinSillasVisibles
                        ? 'Clic en el canvas: cada mesa recibe el siguiente código (A1, A2…).'
                        : 'Clic en el canvas: mesa con sillas alrededor.'}
                    </p>
                  </div>
                )}

                {modo === 'zona_mesas_solas' && (
                  <div className="control-section">
                    <h3>Mesas sin sillas (automático)</h3>
                    <div className="form-group-small">
                      <label>Letra de fila</label>
                      <input
                        type="text"
                        maxLength={1}
                        value={letraMesa}
                        onChange={(e) => {
                          const L = normalizarLetraMesa(e.target.value);
                          setLetraMesa(L);
                          if (zonaMesasSolas) setZonaMesasSolas({ ...zonaMesasSolas, letraMesa: L });
                        }}
                        className="select-input"
                        style={{ width: '4rem', textTransform: 'uppercase' }}
                      />
                    </div>
                    <div className="form-group-small">
                      <label>Cantidad de mesas en la zona</label>
                      <input
                        type="number"
                        min="1"
                        max={MAX_ELEMENTOS_ZONA}
                        value={cantidadMesas}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 1;
                          setCantidadMesas(val);
                          if (zonaMesasSolas) setZonaMesasSolas({ ...zonaMesasSolas, cantidad: val });
                        }}
                        className="select-input"
                      />
                    </div>
                    <div className="form-group-small">
                      <label>Capacidad (personas por mesa)</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={sillasPorMesa}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 4;
                          setSillasPorMesa(Math.max(1, Math.min(30, val)));
                          if (zonaMesasSolas) setZonaMesasSolas({ ...zonaMesasSolas, capacidad_sillas: val });
                        }}
                        className="select-input"
                      />
                    </div>
                    <div className="espacio-precios-mesa">
                      <h4 className="espacio-precios-mesa__titulo">Precios (mesas de la zona)</h4>
                      <div className="form-group-small">
                        <label>Precio mesa completa (Bs.)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={mesaPrecioCompleta}
                          onChange={(e) => setMesaPrecioCompleta(e.target.value)}
                          className="select-input"
                          placeholder="Ej: 3500"
                        />
                      </div>
                    </div>
                    <div className="form-group-small">
                       <label>Numeración</label>
                       <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                         {[['normal','Normal'],['impar','Solo impares'],['par','Solo pares']].map(([val, lbl]) => (
                           <button key={val} type="button" onClick={() => setParidadMesaSola(val)}
                             style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #aaa', cursor: 'pointer',
                               background: paridadMesaSola === val ? '#f57c00' : '#f3f4f6',
                               color: paridadMesaSola === val ? '#fff' : '#333',
                               fontWeight: paridadMesaSola === val ? 'bold' : 'normal' }}
                           >{lbl}</button>
                         ))}
                       </div>
                       <p style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                         {paridadMesaSola === 'impar' ? `Genera: ${letraMesa}1, ${letraMesa}3, ${letraMesa}5…` : paridadMesaSola === 'par' ? `Genera: ${letraMesa}2, ${letraMesa}4, ${letraMesa}6…` : `Genera: ${letraMesa}1, ${letraMesa}2, ${letraMesa}3…`}
                       </p>
                     </div>
                     <p className="form-hint">Arrastra un rectángulo: se crearán {cantidadMesas} mesas en una fila</p>
                  </div>
                )}

                {modo === 'zona_mesas' && (
                  <div className="control-section">
                    <h3>Configuración de Zona de Mesas</h3>
                    <div className="form-group-small">
                      <label>Cantidad de Mesas</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={cantidadMesas}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setCantidadMesas(val);
                          if (zonaMesas) {
                            setZonaMesas({ ...zonaMesas, cantidad: val });
                          }
                        }}
                        className="select-input"
                      />
                    </div>
                    <div className="form-group-small">
                      <label>Sillas por Mesa</label>
                      <input
                        type="number"
                        min="2"
                        max="20"
                        value={sillasPorMesa}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 4;
                          setSillasPorMesa(Math.max(2, Math.min(20, val)));
                          if (zonaMesas) {
                            setZonaMesas({ ...zonaMesas, sillasPorMesa: val });
                          }
                        }}
                        className="select-input"
                      />
                    </div>
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                      Haz clic y arrastra para dibujar la zona. Las mesas con sillas se generarán automáticamente.
                    </p>
                  </div>
                )}

                <div className="control-section">
                  <h3>Tipos de Precio</h3>
                  <select
                    value={tipoPrecioSeleccionado || ''}
                    onChange={(e) => setTipoPrecioSeleccionado(parseInt(e.target.value))}
                    className="select-input"
                  >
                    <option value="">-- Selecciona tipo --</option>
                    {tiposPrecio.map(tp => (
                      <option key={tp.id} value={tp.id}>
                        {tp.nombre} - ${tp.precio}
                      </option>
                    ))}
                  </select>
                  {tiposPrecio.length > 0 && (
                    <div style={{ marginTop: '10px', fontSize: '12px' }}>
                      <strong>Colores asignados:</strong>
                      <div style={{ marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {tiposPrecio.map(tp => (
                          <div key={tp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div 
                              style={{ 
                                width: '20px', 
                                height: '20px', 
                                backgroundColor: tp.color || '#CCCCCC', 
                                border: '1px solid #333',
                                borderRadius: '3px'
                              }} 
                            />
                            <span>{tp.nombre} - ${tp.precio}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="control-section">
                  {layoutBloqueado ? (
                    <>
                      <div style={{ 
                        padding: '10px', 
                        backgroundColor: '#fff3cd', 
                        border: '1px solid #ffc107', 
                        borderRadius: '5px',
                        marginBottom: '10px'
                      }}>
                        <strong>⚠️ Layout Bloqueado</strong>
                        <p style={{ fontSize: '12px', marginTop: '5px' }}>
                          El diseño está guardado y bloqueado. Solo puedes ver información de los elementos.
                        </p>
                      </div>
                      <button 
                        className="btn-guardar" 
                        onClick={async () => {
                          const confirmado = await showConfirm('¿Desbloquear el layout para editar? Esto permitirá modificar el diseño.', { 
                            type: 'warning',
                            title: 'Desbloquear Layout'
                          });
                          if (confirmado) {
                            try {
                              await api.put(`/eventos/${eventoSeleccionado.id}`, {
                                layout_bloqueado: false
                              });
                              setLayoutBloqueado(false);
                              layoutBloqueadoAnteriorRef.current = false;
                            } catch (error) {
                              console.error('Error al desbloquear layout:', error);
                              showAlert('Error al desbloquear el layout', { type: 'error' });
                            }
                          }
                        }}
                        style={{ backgroundColor: '#ff9800' }}
                      >
                        🔓 Desbloquear Layout
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                        <button className="btn-guardar" onClick={guardarLayout}>
                          💾 Guardar Layout
                        </button>
                        <button
                          onClick={aplicarRenumeracion}
                          disabled={layoutBloqueado}
                          style={{
                            padding: '12px',
                            backgroundColor: layoutBloqueado ? '#cccccc' : '#9C27B0',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: layoutBloqueado ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}
                          title={layoutBloqueado ? 'Layout bloqueado' : 'Renumerar mesas (M1,M2...) y asientos/personas (A1,P1...) en orden'}
                        >
                          🔢 Renumerar objetos
                        </button>
                        <button
                          onClick={() => setMostrarNumerosAsientos(!mostrarNumerosAsientos)}
                          style={{
                            padding: '12px',
                            backgroundColor: mostrarNumerosAsientos ? '#607D8B' : '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}
                          title={mostrarNumerosAsientos ? 'Ocultar números de asientos y mesas' : 'Mostrar números'}
                        >
                          {mostrarNumerosAsientos ? '🙈 Ocultar números' : '👁️ Mostrar números'}
                        </button>
                        <button 
                          onClick={() => limpiarEspacio(true)}
                          style={{
                            padding: '12px',
                            backgroundColor: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}
                          title="Limpiar todo el espacio de dibujo"
                        >
                          🗑️ Limpiar Espacio
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Panel de acciones para elementos seleccionados */}
                {modo === 'seleccionar' && elementosSeleccionados.length > 0 && (
                  <div className="control-section" style={{ 
                    backgroundColor: '#e3f2fd', 
                    padding: '10px', 
                    borderRadius: '5px',
                    border: '2px solid #2196F3'
                  }}>
                    <h3 style={{ marginTop: 0, color: '#2196F3', fontSize: '14px', marginBottom: '8px' }}>
                      ✅ {elementosSeleccionados.length} seleccionado(s)
                    </h3>
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '6px'
                    }}>
                      <button
                        onClick={asignarPrecioASeleccion}
                        disabled={!tipoPrecioSeleccionado}
                        style={{
                          padding: '6px 10px',
                          backgroundColor: tipoPrecioSeleccionado ? '#4CAF50' : '#cccccc',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: tipoPrecioSeleccionado ? 'pointer' : 'not-allowed',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                        title={!tipoPrecioSeleccionado ? 'Selecciona un tipo de precio primero' : 'Asignar precio a los elementos seleccionados'}
                      >
                        {tipoPrecioSeleccionado && tiposPrecio.find(tp => tp.id === tipoPrecioSeleccionado) 
                          ? `Asignar ${tiposPrecio.find(tp => tp.id === tipoPrecioSeleccionado)?.nombre}`
                          : 'Asignar Precio'}
                      </button>
                      {elementosSeleccionados.length > 1 && (
                        <button
                          onClick={() => {
                            // Recopilar posiciones actuales de todos los elementos seleccionados
                            const items = elementosSeleccionados.map(sel => {
                              if (sel.type === 'asiento') {
                                const a = asientos.find(x => x.id === sel.id);
                                return a ? { ...sel, x: a.x || 50, y: a.y || 50 } : null;
                              } else {
                                const m = mesas.find(x => x.id === sel.id);
                                return m ? { ...sel, x: m.x || 100, y: m.y || 100, w: m.width || 24, h: m.height || 24 } : null;
                              }
                            }).filter(Boolean);
                            // Ordenar por X
                            const sorted = [...items].sort((a, b) => a.x - b.x);
                            const xs = sorted.map(i => i.x);
                            // Asignar posiciones en orden inverso
                            const newAsientos = asientos.map(a => {
                              const idx = sorted.findIndex(i => i.type === 'asiento' && i.id === a.id);
                              if (idx === -1) return a;
                              return { ...a, x: xs[sorted.length - 1 - idx] };
                            });
                            const newMesas = mesas.map(m => {
                              const idx = sorted.findIndex(i => i.type === 'mesa' && i.id === m.id);
                              if (idx === -1) return m;
                              return { ...m, x: xs[sorted.length - 1 - idx] };
                            });
                            // Actualizar sillas de mesas movidas
                            const mesasMovidas = sorted.filter(i => i.type === 'mesa');
                            let asientosAct = newAsientos;
                            mesasMovidas.forEach(sel => {
                              const mesaOrig = mesas.find(m => m.id === sel.id);
                              const mesaNueva = newMesas.find(m => m.id === sel.id);
                              if (!mesaOrig || !mesaNueva) return;
                              const dx = mesaNueva.x - mesaOrig.x;
                              asientosAct = asientosAct.map(a =>
                                a.mesa_id === sel.id ? { ...a, x: (a.x || 50) + dx } : a
                              );
                            });
                            setAsientos(asientosAct);
                            setMesas(newMesas);
                          }}
                          disabled={layoutBloqueado}
                          style={{
                            padding: '6px 10px',
                            backgroundColor: layoutBloqueado ? '#cccccc' : '#9c27b0',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: layoutBloqueado ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}
                          title="Invierte el orden horizontal: el primero va al final y el último al inicio"
                        >
                          ⇔ Invertir posición
                        </button>
                      )}
                      {elementosSeleccionados.length > 1 && (
                        <button
                          onClick={() => {
                            // Recopilar Y actuales de todos los seleccionados
                            const ys = elementosSeleccionados.map(sel => {
                              if (sel.type === 'asiento') {
                                const a = asientos.find(x => x.id === sel.id);
                                return a ? (a.y || 50) : 50;
                              } else {
                                const m = mesas.find(x => x.id === sel.id);
                                return m ? (m.y || 100) : 100;
                              }
                            }).filter(Boolean);
                            const medY = Math.round(ys.reduce((s, v) => s + v, 0) / ys.length);
                            // Aplicar Y promedio a todos
                            const newAsientos = asientos.map(a => {
                              const sel = elementosSeleccionados.find(s => s.type === 'asiento' && s.id === a.id);
                              return sel ? { ...a, y: medY } : a;
                            });
                            // Para mesas: alinear la mesa y sus sillas
                            const newMesas = mesas.map(m => {
                              const sel = elementosSeleccionados.find(s => s.type === 'mesa' && s.id === m.id);
                              if (!sel) return m;
                              const dy = medY - (m.y || 100);
                              return { ...m, y: medY };
                            });
                            // Mover sillas de mesas alineadas
                            let asientosAct = newAsientos;
                            elementosSeleccionados.filter(s => s.type === 'mesa').forEach(sel => {
                              const mesaOrig = mesas.find(m => m.id === sel.id);
                              const mesaNueva = newMesas.find(m => m.id === sel.id);
                              if (!mesaOrig || !mesaNueva) return;
                              const dy = mesaNueva.y - mesaOrig.y;
                              asientosAct = asientosAct.map(a =>
                                a.mesa_id === sel.id ? { ...a, y: (a.y || 50) + dy } : a
                              );
                            });
                            setAsientos(asientosAct);
                            setMesas(newMesas);
                          }}
                          disabled={layoutBloqueado}
                          style={{
                            padding: '6px 10px',
                            backgroundColor: layoutBloqueado ? '#cccccc' : '#00897b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: layoutBloqueado ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}
                          title="Alinea todos los elementos seleccionados en la misma fila horizontal"
                        >
                          ≡ Alinear fila
                        </button>
                      )}
                      <button
                        onClick={duplicarElementosSeleccionados}
                        disabled={layoutBloqueado}
                        style={{
                          padding: '6px 10px',
                          backgroundColor: layoutBloqueado ? '#cccccc' : '#2196F3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: layoutBloqueado ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                        title={layoutBloqueado ? 'Layout bloqueado' : 'Duplicar elementos'}
                      >
                        Duplicar
                      </button>
                      <button
                        onClick={eliminarElementosSeleccionados}
                        style={{
                          padding: '6px 10px',
                          backgroundColor: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                        title="Eliminar los elementos seleccionados"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </>
            }
          >
            <div className="espacio-modal-canvas-wrap">
              {renderCanvas(true, true)}
            </div>
          </Modal>
        </div>
      </div>

      {/* Modal de Progreso de Guardado */}
      {mostrarModalProgreso && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000
          }}
        >
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#2c3e50' }}>
              💾 Guardando Layout
            </h2>
            
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                backgroundColor: '#e0e0e0', 
                borderRadius: '10px', 
                height: '30px', 
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{
                  backgroundColor: '#4CAF50',
                  height: '100%',
                  width: `${progresoGuardado.porcentaje}%`,
                  transition: 'width 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}>
                  {progresoGuardado.porcentaje}%
                </div>
              </div>
            </div>

            <div style={{ 
              marginBottom: '20px', 
              minHeight: '30px',
              fontSize: '16px',
              color: '#555',
              fontWeight: '500'
            }}>
              {progresoGuardado.mensaje}
            </div>

            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              padding: '15px',
              border: '1px solid #ddd'
            }}>
              {progresoGuardado.detalles.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {progresoGuardado.detalles.slice(-20).map((detalle, index) => (
                    <div 
                      key={index}
                      style={{
                        fontSize: '14px',
                        color: '#333',
                        padding: '5px',
                        backgroundColor: detalle.includes('✅') ? '#e8f5e9' : '#fff',
                        borderRadius: '4px'
                      }}
                    >
                      {detalle}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#999', fontStyle: 'italic' }}>
                  Esperando inicio del guardado...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Resumen del Layout */}
      {mostrarModalResumen && resumenLayout && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10000
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setMostrarModalResumen(false);
            }
          }}
        >
          <div style={{
            backgroundColor: '#2c3e50',
            borderRadius: '10px',
            padding: '30px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
            color: '#ecf0f1'
          }}>
            <h2 style={{ 
              marginTop: 0, 
              marginBottom: '20px', 
              color: '#ecf0f1',
              fontSize: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span>📊</span> RESUMEN DEL LAYOUT
            </h2>

            <div style={{ marginBottom: '25px' }}>
              <h3 style={{ 
                color: '#3498db', 
                marginBottom: '15px',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>📦</span> Estructura
              </h3>
              <div style={{ 
                backgroundColor: '#34495e', 
                padding: '15px', 
                borderRadius: '5px',
                lineHeight: '1.8'
              }}>
                <div>• <strong>Áreas dibujadas:</strong> {resumenLayout.totalAreas}</div>
                <div>• <strong>Mesas:</strong> {resumenLayout.totalMesas}</div>
                <div>• <strong>Sillas de mesas:</strong> {resumenLayout.sillasDeMesas} ({resumenLayout.capacidadTotalMesas} capacidad total)</div>
                <div>• <strong>Asientos individuales (sillas):</strong> {resumenLayout.asientosIndividuales}</div>
                <div>• <strong>Personas (espacio pie):</strong> {resumenLayout.personasPie || 0}</div>
                <div>• <strong>Total sillas/asientos:</strong> {resumenLayout.totalAsientos}</div>
              </div>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <h3 style={{ 
                color: '#f39c12', 
                marginBottom: '15px',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>💰</span> Por tipo de precio
              </h3>
              <div style={{ 
                backgroundColor: '#34495e', 
                padding: '15px', 
                borderRadius: '5px',
                lineHeight: '1.8'
              }}>
                {Object.entries(resumenLayout.porTipoPrecio).map(([tipoId, datos]) => {
                  let tipoPrecio = null;
                  if (tipoId !== 'sin_precio') {
                    const tipoIdNum = parseInt(tipoId);
                    if (!isNaN(tipoIdNum)) {
                      tipoPrecio = tiposPrecio.find(tp => tp.id === tipoIdNum);
                    }
                  }
                  const nombre = tipoPrecio ? tipoPrecio.nombre : 'Sin precio';
                  const precio = tipoPrecio ? `$${tipoPrecio.precio}` : '';
                  const sillas = datos.sillas || 0;
                  const personas = datos.personas || 0;
                  
                  if (sillas === 0 && personas === 0) return null;
                  
                  return (
                    <div key={tipoId} style={{ marginBottom: '10px' }}>
                      <strong>{nombre}</strong> {precio && `(${precio})`}
                      <div style={{ marginLeft: '20px', fontSize: '14px', color: '#bdc3c7' }}>
                        {sillas > 0 && <div>• Sillas: {sillas}</div>}
                        {personas > 0 && <div>• Personas (espacio pie): {personas}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ 
              backgroundColor: '#e74c3c', 
              padding: '12px', 
              borderRadius: '5px',
              marginBottom: '20px',
              fontSize: '14px',
              color: '#fff'
            }}>
              ⚠️ <strong>NOTA:</strong> Los números de mesas y asientos se renumerarán automáticamente para evitar duplicados.
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '10px', 
              justifyContent: 'flex-end' 
            }}>
              <button
                onClick={() => setMostrarModalResumen(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#7f8c8d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarGuardado}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                Guardar Layout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ingresar nombre y color del área */}
      {mostrarModalNombreArea && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
          onClick={handleCancelarNombreArea}
        >
          <div
            className="espacio-modal-nombre-area"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Nueva área</h3>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
              Nombre y color de fondo para la zona que dibujaste.
            </p>
            <div className="form-group-small">
              <label>Nombre</label>
              <input
                type="text"
                className="select-input"
                placeholder="Ej: PALCO, VIP, GENERAL..."
                value={nombreAreaModal}
                onChange={(e) => setNombreAreaModal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmarNombreArea()}
                autoFocus
              />
            </div>
            <SelectorColorArea color={colorAreaNueva} onChange={setColorAreaNueva} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                onClick={handleCancelarNombreArea}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarNombreArea}
                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#2196F3', color: '#fff', cursor: 'pointer' }}
              >
                Crear área
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar área (tipo, capacidad) - después de dibujar */}
      {mostrarModalEditarArea && areaEnEdicion && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }} onClick={() => setMostrarModalEditarArea(false)}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '20px',
            minWidth: '320px',
            maxWidth: '90vw'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Configurar área: {areaEnEdicion.nombre}</h3>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
              Color de fondo, tipo de asientos y capacidad de la zona.
            </p>
            <SelectorColorArea
              color={areaEnEdicion.color || COLOR_AREA_DEFAULT}
              onChange={(hex) => setAreaEnEdicion({ ...areaEnEdicion, color: hex })}
            />
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Tipo de área</label>
              <select
                value={areaEnEdicion.tipo_area || 'SILLAS'}
                onChange={e => setAreaEnEdicion({ ...areaEnEdicion, tipo_area: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                <option value="SILLAS">Sillas</option>
                <option value="MESAS">Mesas</option>
                <option value="PERSONAS">Personas de pie (zona general)</option>
              </select>
            </div>
            {areaEnEdicion.tipo_area === 'PERSONAS' && (
              <>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Capacidad de personas</label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={areaEnEdicion.capacidad_personas || 50}
                    onChange={e => setAreaEnEdicion({
                      ...areaEnEdicion,
                      capacidad_personas: Math.max(1, parseInt(e.target.value) || 1)
                    })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Tipo de precio</label>
                  <select
                    value={areaEnEdicion.tipo_precio_id || ''}
                    onChange={e => setAreaEnEdicion({
                      ...areaEnEdicion,
                      tipo_precio_id: e.target.value ? parseInt(e.target.value) : null
                    })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                  >
                    <option value="">-- Selecciona --</option>
                    {tiposPrecio.map(tp => (
                      <option key={tp.id} value={tp.id}>{tp.nombre} - ${tp.precio}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => { setMostrarModalEditarArea(false); setAreaEnEdicion(null); }}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={guardarEdicionArea}
                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#2196F3', color: '#fff', cursor: 'pointer' }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Espacio;
