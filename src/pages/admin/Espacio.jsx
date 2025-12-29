import { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import { useAlert } from '../../context/AlertContext';
import './Espacio.css';
import Modal from '../../components/Modal.jsx';
import ModalInput from '../../components/ModalInput.jsx';

const Espacio = () => {
  const { showAlert, showConfirm } = useAlert();
  const [eventos, setEventos] = useState([]);
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null);
  const [tiposPrecio, setTiposPrecio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forma, setForma] = useState('rectangulo'); // rectangulo, cuadrado, triangulo, circulo
  const [modo, setModo] = useState('escenario'); // escenario, area, asiento_individual, zona_asientos, zona_mesas, mesas, mesa_individual, seleccionar
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
  const [asientos, setAsientos] = useState([]); // [{id, x, y, numero_asiento, tipo_precio_id, mesa_id}]
  const [mesas, setMesas] = useState([]); // [{id, x, y, width, height, numero_mesa, capacidad_sillas, tipo_precio_id}]
  
  // Configuración de área
  const [nombreArea, setNombreArea] = useState(''); // Nombre de la nueva área
  const [mostrarModalNombreArea, setMostrarModalNombreArea] = useState(false); // Controlar modal de nombre de área
  const [areaPendiente, setAreaPendiente] = useState(null); // Área dibujada esperando nombre

  // Handler para confirmar nombre del área
  const handleConfirmarNombreArea = (nombre) => {
    if (areaPendiente && nombre && nombre.trim()) {
      const nuevaArea = {
        id: `temp_area_${Date.now()}`,
        nombre: nombre.trim(),
        x: areaPendiente.x,
        y: areaPendiente.y,
        width: areaPendiente.width,
        height: areaPendiente.height,
        color: '#CCCCCC'
      };
      setAreas([...areas, nuevaArea]);
      setNombreArea(nombre.trim());
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
  
  // Configuración de generación automática
  const [cantidadAsientos, setCantidadAsientos] = useState(10);
  
  // Configuración de mesas
  const [cantidadMesas, setCantidadMesas] = useState(1);
  const [sillasPorMesa, setSillasPorMesa] = useState(4);
  const [formaMesa, setFormaMesa] = useState('cuadrado'); // cuadrado, rectangulo
  const [hojaAncho, setHojaAncho] = useState(1000);
  const [hojaAlto, setHojaAlto] = useState(600);
  
  const canvasRef = useRef(null);
  const miniCanvasRef = useRef(null);
  const [mostrarCanvasAmpliado, setMostrarCanvasAmpliado] = useState(false);
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
    dibujarCanvas();
  }, [forma, escenario, areas, zonaAsientos, asientos, mesas, eventoSeleccionado, elementosSeleccionados, seleccionCuadro]);

  useEffect(() => {
    dibujarCanvasMini();
  }, [forma, escenario, areas, asientos, mesas, eventoSeleccionado]);

  useEffect(() => {
    if (eventoSeleccionado) {
      setMostrarCanvasAmpliado(true);
    }
  }, [eventoSeleccionado]);

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
        className="espacio-canvas-container"
        style={
          ampliado
            ? { ...baseStyle, maxWidth: '1400px', width: '100%', height: '100%' }
            : baseStyle
        }
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="espacio-canvas"
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
                  {modo === 'area' && 'Haz clic y arrastra para dibujar el área. Se te pedirá el nombre después de dibujar.'}
                  {modo === 'seleccionar' && 'Clic para seleccionar, Shift+clic para selección múltiple, arrastra para cuadro de selección. Arrastra elementos seleccionados para moverlos todos juntos.'}
                  {modo === 'asiento_individual' && 'Haz clic en el canvas para colocar un asiento. Arrastra los asientos existentes para moverlos. Clic derecho o Ctrl+clic para eliminar.'}
                  {modo === 'zona_asientos' && 'Haz clic y arrastra para dibujar la zona de asientos. Los asientos se generarán automáticamente.'}
                  {modo === 'zona_mesas' && 'Haz clic y arrastra para dibujar la zona de mesas. Las mesas con sillas se generarán automáticamente.'}
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
      if (eventoRes.data.success) {
        const evento = eventoRes.data.data;
        if (evento.forma_espacio) {
          setForma(evento.forma_espacio);
        }
        if (evento.escenario_x !== null && evento.escenario_y !== null) {
          setEscenario({
            x: evento.escenario_x,
            y: evento.escenario_y,
            width: evento.escenario_width || 200,
            height: evento.escenario_height || 100
          });
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

      // Cargar áreas
      if (areasRes.data.success) {
        const areasCargadas = areasRes.data.data.map(a => ({
          id: a.id,
          nombre: a.nombre,
          x: a.posicion_x,
          y: a.posicion_y,
          width: a.ancho,
          height: a.alto,
          color: a.color || '#CCCCCC'
        }));
        setAreas(areasCargadas);
      }

      // Cargar mesas
      if (mesasRes.data.success && mesasRes.data.data.length > 0) {
        const mesasCargadas = mesasRes.data.data.map(m => ({
          id: m.id,
          x: m.posicion_x !== null && m.posicion_x !== undefined ? m.posicion_x : 100,
          y: m.posicion_y !== null && m.posicion_y !== undefined ? m.posicion_y : 100,
          // Usar el ancho y alto guardados, o valores por defecto si no existen
          width: m.ancho !== null && m.ancho !== undefined ? m.ancho : 24,
          height: m.alto !== null && m.alto !== undefined ? m.alto : 24,
          numero_mesa: m.numero_mesa,
          capacidad_sillas: m.capacidad_sillas || 4, // Valor por defecto si no tiene capacidad_sillas
          tipo_precio_id: m.tipo_precio_id,
          area_id: m.area_id || null
        }));
        setMesas(mesasCargadas);
      }

      // Cargar asientos (individuales y de mesas)
      if (asientosRes.data.success && asientosRes.data.data.length > 0) {
        const asientosCargados = asientosRes.data.data.map(a => ({
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

    // Calcular distribución en grid
    const columnas = Math.ceil(Math.sqrt(cantidad));
    const filas = Math.ceil(cantidad / columnas);
    
    const tamañoAsiento = 10; // Reducido
    const padding = 20; // Padding dentro de la zona (aumentado)
    const espacioEntreAsientos = 8; // Espacio mínimo entre asientos (aumentado)
    
    const anchoDisponible = anchoZona - (2 * padding) - (columnas * tamañoAsiento);
    const altoDisponible = altoZona - (2 * padding) - (filas * tamañoAsiento);
    
    const espacioX = columnas > 1 ? Math.max(espacioEntreAsientos, anchoDisponible / (columnas - 1)) : 0;
    const espacioY = filas > 1 ? Math.max(espacioEntreAsientos, altoDisponible / (filas - 1)) : 0;

    for (let i = 0; i < cantidad; i++) {
      const fila = Math.floor(i / columnas);
      const columna = i % columnas;
      
      const x = xInicio + padding + (columna * (tamañoAsiento + espacioX)) + tamañoAsiento / 2;
      const y = yInicio + padding + (fila * (tamañoAsiento + espacioY)) + tamañoAsiento / 2;

      nuevosAsientos.push({
        id: `temp_asiento_${Date.now()}_${i}`,
        x: Math.round(x),
        y: Math.round(y),
        numero_asiento: `A${i + 1}`,
        tipo_precio_id: zona.tipo_precio_id,
        mesa_id: null
      });
    }

    // Agregar los nuevos asientos sin mover los existentes
    setAsientos(prev => [...prev, ...nuevosAsientos]);
  };

  // Generar sillas alrededor de una mesa
  const generarSillasAlrededorMesa = (mesa) => {
    if (!mesa || !mesa.capacidad_sillas || !mesa.tipo_precio_id) return [];

    const sillas = [];
    const cantidadSillas = mesa.capacidad_sillas;
    const mesaX = mesa.x;
    const mesaY = mesa.y;
    const mesaWidth = mesa.width;
    const mesaHeight = mesa.height;

    // Tamaño de la silla
    const tamañoSilla = 12; // Aumentado para mejor visibilidad
    const distanciaMesa = 4; // Distancia de la silla al borde de la mesa (reducida para acercar las sillas)
    const espacioEntreSillas = 4; // Espacio mínimo entre sillas

    // Distribuir sillas equitativamente alrededor de la mesa
    // Dividir en 4 lados: superior, derecho, inferior, izquierdo
    const sillasPorLado = Math.ceil(cantidadSillas / 4);
    let sillaIndex = 0;

    // Lado superior
    const sillasSuperior = Math.min(sillasPorLado, cantidadSillas - sillaIndex);
    if (sillasSuperior > 0) {
      // Calcular el espacio disponible para distribuir las sillas
      const espacioDisponible = mesaWidth - (sillasSuperior * tamañoSilla);
      const espacioEntre = sillasSuperior > 1 ? espacioDisponible / (sillasSuperior + 1) : espacioDisponible / 2;
      for (let i = 0; i < sillasSuperior && sillaIndex < cantidadSillas; i++) {
        const x = mesaX + espacioEntre + (i * (tamañoSilla + espacioEntre)) + tamañoSilla / 2;
        const y = mesaY - distanciaMesa - tamañoSilla / 2;
        sillas.push({
          id: `temp_silla_${mesa.id}_${sillaIndex}`,
          x: Math.round(x),
          y: Math.round(y),
          numero_asiento: `${sillaIndex + 1}`, // Solo número simple para sillas de mesas
          tipo_precio_id: mesa.tipo_precio_id,
          mesa_id: mesa.id
        });
        sillaIndex++;
      }
    }

    // Lado derecho
    const sillasDerecha = Math.min(sillasPorLado, cantidadSillas - sillaIndex);
    if (sillasDerecha > 0) {
      // Calcular el espacio disponible para distribuir las sillas verticalmente
      const espacioDisponible = mesaHeight - (sillasDerecha * tamañoSilla);
      const espacioEntre = sillasDerecha > 1 ? espacioDisponible / (sillasDerecha + 1) : espacioDisponible / 2;
      for (let i = 0; i < sillasDerecha && sillaIndex < cantidadSillas; i++) {
        const x = mesaX + mesaWidth + distanciaMesa + tamañoSilla / 2;
        const y = mesaY + espacioEntre + (i * (tamañoSilla + espacioEntre)) + tamañoSilla / 2;
        sillas.push({
          id: `temp_silla_${mesa.id}_${sillaIndex}`,
          x: Math.round(x),
          y: Math.round(y),
          numero_asiento: `${sillaIndex + 1}`, // Solo número simple para sillas de mesas
          tipo_precio_id: mesa.tipo_precio_id,
          mesa_id: mesa.id
        });
        sillaIndex++;
      }
    }

    // Lado inferior
    const sillasInferior = Math.min(sillasPorLado, cantidadSillas - sillaIndex);
    if (sillasInferior > 0) {
      // Calcular el espacio disponible para distribuir las sillas
      const espacioDisponible = mesaWidth - (sillasInferior * tamañoSilla);
      const espacioEntre = sillasInferior > 1 ? espacioDisponible / (sillasInferior + 1) : espacioDisponible / 2;
      for (let i = 0; i < sillasInferior && sillaIndex < cantidadSillas; i++) {
        const x = mesaX + espacioEntre + (i * (tamañoSilla + espacioEntre)) + tamañoSilla / 2;
        const y = mesaY + mesaHeight + distanciaMesa + tamañoSilla / 2;
        sillas.push({
          id: `temp_silla_${mesa.id}_${sillaIndex}`,
          x: Math.round(x),
          y: Math.round(y),
          numero_asiento: `${sillaIndex + 1}`, // Solo número simple para sillas de mesas
          tipo_precio_id: mesa.tipo_precio_id,
          mesa_id: mesa.id
        });
        sillaIndex++;
      }
    }

    // Lado izquierdo (resto de sillas)
    const sillasIzquierda = cantidadSillas - sillaIndex;
    if (sillasIzquierda > 0) {
      // Calcular el espacio disponible para distribuir las sillas verticalmente
      const espacioDisponible = mesaHeight - (sillasIzquierda * tamañoSilla);
      const espacioEntre = sillasIzquierda > 1 ? espacioDisponible / (sillasIzquierda + 1) : espacioDisponible / 2;
      for (let i = 0; i < sillasIzquierda && sillaIndex < cantidadSillas; i++) {
        const x = mesaX - distanciaMesa - tamañoSilla / 2;
        const y = mesaY + espacioEntre + (i * (tamañoSilla + espacioEntre)) + tamañoSilla / 2;
        sillas.push({
          id: `temp_silla_${mesa.id}_${sillaIndex}`,
          x: Math.round(x),
          y: Math.round(y),
          numero_asiento: `${sillaIndex + 1}`, // Solo número simple para sillas de mesas
          tipo_precio_id: mesa.tipo_precio_id,
          mesa_id: mesa.id
        });
        sillaIndex++;
      }
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
    
    const tamañoMesa = 32; // Tamaño de la mesa (reducido)
    const padding = 30; // Padding dentro de la zona
    const espacioEntreMesas = 60; // Espacio mínimo entre mesas (incluye espacio para sillas)
    
    const anchoDisponible = anchoZona - (2 * padding) - (columnas * tamañoMesa);
    const altoDisponible = altoZona - (2 * padding) - (filas * tamañoMesa);
    
    const espacioX = columnas > 1 ? Math.max(espacioEntreMesas, anchoDisponible / (columnas - 1)) : 0;
    const espacioY = filas > 1 ? Math.max(espacioEntreMesas, altoDisponible / (filas - 1)) : 0;

    const nuevasMesas = [];
    const nuevasSillas = [];
    let numeroMesa = mesas.length + 1;

    for (let i = 0; i < cantidadMesas; i++) {
      const fila = Math.floor(i / columnas);
      const columna = i % columnas;
      
      const x = xInicio + padding + (columna * (tamañoMesa + espacioX)) + tamañoMesa / 2;
      const y = yInicio + padding + (fila * (tamañoMesa + espacioY)) + tamañoMesa / 2;

      const nuevaMesa = {
        id: `temp_mesa_${Date.now()}_${i}`,
        x: Math.round(x - tamañoMesa / 2),
        y: Math.round(y - tamañoMesa / 2),
        width: tamañoMesa,
        height: tamañoMesa,
        numero_mesa: numeroMesa,
        capacidad_sillas: sillasPorMesa,
        tipo_precio_id: zona.tipo_precio_id
      };

      nuevasMesas.push(nuevaMesa);
      
      // Generar sillas alrededor de esta mesa
      const sillasMesa = generarSillasAlrededorMesa(nuevaMesa);
      nuevasSillas.push(...sillasMesa);
      
      numeroMesa++;
    }

    // Agregar las nuevas mesas y sillas
    setMesas(prev => [...prev, ...nuevasMesas]);
    setAsientos(prev => [...prev, ...nuevasSillas]);
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
      ctx.fillStyle = area.color || '#CCCCCC';
      ctx.fillRect(area.x, area.y, area.width, area.height);
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      ctx.strokeRect(area.x, area.y, area.width, area.height);
      
      // Dibujar nombre del área en la parte superior (cabecera)
      ctx.fillStyle = '#333';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      // Dibujar fondo blanco para el texto para mejor legibilidad
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
        ctx.fillStyle = 'rgba(200, 200, 200, 0.3)';
        ctx.fillRect(currentElement.x, currentElement.y, currentElement.width, currentElement.height);
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(currentElement.x, currentElement.y, currentElement.width, currentElement.height);
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
      ctx.fillText(`ZONA ASIENTOS (${zonaAsientos.cantidad || 0})`, zonaAsientos.x + zonaAsientos.width / 2, zonaAsientos.y + 20);
    }

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

    // Dibujar mesas con sus sillas
    mesas.forEach(mesa => {
      const estaSeleccionada = elementosSeleccionados.some(sel => sel.type === 'mesa' && sel.id === mesa.id);
      
      // Dibujar la mesa
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(mesa.x, mesa.y, mesa.width, mesa.height);
      ctx.strokeStyle = estaSeleccionada ? '#FFD700' : '#654321';
      ctx.lineWidth = estaSeleccionada ? 3 : 2;
      ctx.strokeRect(mesa.x, mesa.y, mesa.width, mesa.height);
      
      // Dibujar texto de la mesa
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`M${mesa.numero_mesa}`, mesa.x + mesa.width / 2, mesa.y + mesa.height / 2);
      
      // Dibujar sillas de la mesa
      const sillasMesa = asientos.filter(a => a.mesa_id === mesa.id);
      sillasMesa.forEach(silla => {
        const tipoPrecio = tiposPrecio.find(tp => tp.id === silla.tipo_precio_id);
        const estaSeleccionadaSilla = elementosSeleccionados.some(sel => sel.type === 'asiento' && sel.id === silla.id);
        
        const colorSilla = tipoPrecio?.color || getColorForTipoPrecio(silla.tipo_precio_id) || '#2196F3';
        ctx.fillStyle = colorSilla;
        ctx.fillRect((silla.x || 50) - 6, (silla.y || 50) - 6, 12, 12);
        ctx.strokeStyle = estaSeleccionadaSilla ? '#FFD700' : '#333';
        ctx.lineWidth = estaSeleccionadaSilla ? 2 : 1;
        ctx.strokeRect((silla.x || 50) - 6, (silla.y || 50) - 6, 12, 12);
        
        // Dibujar número de la silla (las sillas de mesas ahora usan solo números: 1, 2, 3...)
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(silla.numero_asiento || '', silla.x || 50, silla.y || 50);
      });
    });

    // Dibujar asientos individuales (sin mesa)
    asientos.filter(a => !a.mesa_id).forEach(asiento => {
      const tipoPrecio = tiposPrecio.find(tp => tp.id === asiento.tipo_precio_id);
      const estaSeleccionado = elementosSeleccionados.some(sel => sel.type === 'asiento' && sel.id === asiento.id);
      
      const colorAsiento = tipoPrecio?.color || getColorForTipoPrecio(asiento.tipo_precio_id) || '#2196F3';
      ctx.fillStyle = colorAsiento;
      ctx.fillRect((asiento.x || 50) - 8, (asiento.y || 50) - 8, 16, 16);
      ctx.strokeStyle = estaSeleccionado ? '#FFD700' : '#333';
      ctx.lineWidth = estaSeleccionado ? 3 : 1;
      ctx.strokeRect((asiento.x || 50) - 8, (asiento.y || 50) - 8, 16, 16);
      
      // Dibujar número del asiento
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(asiento.numero_asiento || '', asiento.x || 50, asiento.y || 50);
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
      ctx.fillStyle = area.color || '#CCCCCC';
      ctx.fillRect(area.x, area.y, area.width, area.height);
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.strokeRect(area.x, area.y, area.width, area.height);
    });
    mesas.forEach(mesa => {
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(mesa.x, mesa.y, mesa.width, mesa.height);
      ctx.strokeStyle = '#654321';
      ctx.lineWidth = 1;
      ctx.strokeRect(mesa.x, mesa.y, mesa.width, mesa.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`M${mesa.numero_mesa}`, mesa.x + mesa.width / 2, mesa.y + mesa.height / 2);
    });
    asientos.forEach(asiento => {
      const tipoPrecio = tiposPrecio.find(tp => tp.id === asiento.tipo_precio_id);
      const color = tipoPrecio?.color || '#2196F3';
      const size = asiento.mesa_id ? 6 : 7;
      const sx = (asiento.x || 50) - size / 2;
      const sy = (asiento.y || 50) - size / 2;
      ctx.fillStyle = color;
      ctx.fillRect(sx, sy, size, size);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, sy, size, size);
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
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
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
      if (x >= area.x && x <= area.x + area.width && 
          y >= area.y && y <= area.y + area.height) {
        return area;
      }
    }
    return null;
  };

  // Generar nombre descriptivo para un elemento
  const generarNombreDescriptivo = (elemento) => {
    if (elemento.type === 'asiento') {
      const asiento = asientos.find(a => a.id === elemento.id);
      if (!asiento) return 'Asiento desconocido';
      
      const area = areas.find(a => a.id === asiento.area_id);
      const tipoPrecio = tiposPrecio.find(tp => tp.id === asiento.tipo_precio_id);
      const nombreTipo = tipoPrecio?.nombre || 'Sin precio';
      
      if (area) {
        return `Asiento ${asiento.numero_asiento} de ${area.nombre} (${nombreTipo})`;
      }
      return `Asiento ${asiento.numero_asiento} (${nombreTipo})`;
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

    // Permitir mover asientos en cualquier modo (excepto cuando se está dibujando escenario o área)
    if (asientoClickeado && modo !== 'escenario' && modo !== 'area' && modo !== 'mesas' && modo !== 'mesa_individual') {
      // Si es clic derecho, eliminar el asiento
      if (e.button === 2 || e.ctrlKey) {
        e.preventDefault();
        const confirmado = await showConfirm(`¿Eliminar asiento ${asientoClickeado.numero_asiento}?`, { 
          type: 'warning',
          title: 'Eliminar Asiento'
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
      // Permitir dibujar sin nombre, se pedirá después
      setCurrentElement({ type: 'area', x: pos.x, y: pos.y, width: 0, height: 0 });
    } else if (modo === 'asiento_individual' && tipoPrecioSeleccionado) {
      // Crear nuevo asiento en la posición del clic
      const numeroAsiento = asientos.length + 1;
      const nuevoAsiento = {
        id: `temp_asiento_${Date.now()}`,
        x: pos.x,
        y: pos.y,
        numero_asiento: `A${numeroAsiento}`,
        tipo_precio_id: tipoPrecioSeleccionado
      };
      setAsientos([...asientos, nuevoAsiento]);
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
    } else if ((modo === 'mesas' || modo === 'mesa_individual') && tipoPrecioSeleccionado) {
      // Crear nueva mesa en la posición del clic
      const tamañoMesa = formaMesa === 'cuadrado' ? 24 : 32; // Cuadrado: 24x24, Rectángulo: 32x24 (reducidos)
      const alturaMesa = formaMesa === 'cuadrado' ? 24 : 24;
      const numeroMesa = mesas.length + 1;
      const nuevaMesa = {
        id: `temp_mesa_${Date.now()}`,
        x: pos.x - tamañoMesa / 2,
        y: pos.y - alturaMesa / 2,
        width: tamañoMesa,
        height: alturaMesa,
        numero_mesa: numeroMesa,
        capacidad_sillas: sillasPorMesa,
        tipo_precio_id: tipoPrecioSeleccionado
      };
      
      // Generar sillas alrededor de la mesa
      const sillas = generarSillasAlrededorMesa(nuevaMesa);
      
      setMesas([...mesas, nuevaMesa]);
      setAsientos(prev => [...prev, ...sillas]);
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
              const nuevaX = posOriginal.x + deltaX;
              const nuevaY = posOriginal.y + deltaY;
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
          // Verificar si esta silla pertenece a alguna mesa seleccionada
          const mesaSeleccionada = mesasSeleccionadas.find(sel => sel.id === a.mesa_id);
          if (mesaSeleccionada) {
            // Usar la posición original de la silla guardada
            const posOriginalSilla = posicionesOriginales[`asiento_${a.id}`];
            if (posOriginalSilla) {
              return {
                ...a,
                x: posOriginalSilla.x + deltaX,
                y: posOriginalSilla.y + deltaY
              };
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
              return {
                ...a,
                x: posOriginal.x + deltaX,
                y: posOriginal.y + deltaY
              };
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
        const nuevaX = pos.x - elementoArrastrando.offsetX;
        const nuevaY = pos.y - elementoArrastrando.offsetY;
        const mesa = mesas.find(m => m.id === elementoArrastrando.id);
        if (mesa) {
          // Calcular el delta desde la posición original de la mesa
          // Necesitamos obtener la posición original guardada
          const posOriginalMesa = posicionesOriginales[`mesa_${elementoArrastrando.id}`] || { x: mesa.x, y: mesa.y };
          const deltaX = nuevaX - posOriginalMesa.x;
          const deltaY = nuevaY - posOriginalMesa.y;
          
          // Mover la mesa
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
        setAsientos(asientos.map(a => 
          a.id === elementoArrastrando.id 
            ? { ...a, x: pos.x - elementoArrastrando.offsetX, y: pos.y - elementoArrastrando.offsetY }
            : a
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
      const width = pos.x - startPos.x;
      const height = pos.y - startPos.y;
      const x = Math.min(startPos.x, pos.x);
      const y = Math.min(startPos.y, pos.y);
      const w = Math.abs(width);
      const h = Math.abs(height);

      const updatedElement = {
        ...currentElement,
        x,
        y,
        width: w,
        height: h
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
        tipo_precio_id: tipoPrecioSeleccionado
      };
      setZonaAsientos(zona); // Solo para mostrar visualmente la última zona
      generarAsientosAutomaticos(zona);
    } else if (zonaMesas && modo === 'zona_mesas' && tipoPrecioSeleccionado) {
      // Confirmar zona de mesas y generar mesas con sillas en esa zona
      generarMesasAutomaticas(zonaMesas);
      setZonaMesas(null);
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

  // Detectar elementos dentro de un área específica
  const detectarElementosEnArea = (area) => {
    const elementos = [];
    const minX = area.x;
    const maxX = area.x + area.width;
    const minY = area.y;
    const maxY = area.y + area.height;

    // Detectar SOLO asientos individuales dentro del área (NO sillas de mesas)
    asientos.forEach(asiento => {
      // Excluir sillas de mesas (asientos con mesa_id)
      if (asiento.mesa_id) {
        return; // No incluir sillas de mesas
      }
      
      const asientoX = asiento.x || 50;
      const asientoY = asiento.y || 50;
      if (asientoX >= minX && asientoX <= maxX && asientoY >= minY && asientoY <= maxY) {
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

  // Función para renumerar asientos asegurando que no haya duplicados
  const renumerarElementos = (numeroAsientoInicial = 0) => {
    // Renumerar SOLO asientos individuales (sin mesa_id)
    // Las sillas de mesas mantienen sus números simples (1, 2, 3...)
    let contadorAsientosIndividuales = numeroAsientoInicial;
    
    const asientosRenumerados = asientos.map((asiento) => {
      if (asiento.mesa_id) {
        // Es una silla de mesa: mantener su número tal cual (1, 2, 3...)
        return asiento;
      } else {
        // Es un asiento individual: renumerar con formato A1, A2, A3...
        contadorAsientosIndividuales++;
        return {
          ...asiento, // Preservar x, y, y todas las demás propiedades
          numero_asiento: `A${contadorAsientosIndividuales}`
        };
      }
    });

    return {
      asientos: asientosRenumerados
    };
  };

  // Función para calcular resumen del layout
  const calcularResumenLayout = () => {
    const totalAsientos = asientos.length;
    const totalAreas = areas.length;
    const totalMesas = mesas.length;
    
    // Separar sillas de mesas y asientos individuales
    const sillasDeMesas = asientos.filter(a => a.mesa_id).length;
    const asientosIndividuales = asientos.filter(a => !a.mesa_id).length;
    
    // Calcular capacidad total de mesas (suma de capacidad_sillas de todas las mesas)
    const capacidadTotalMesas = mesas.reduce((total, mesa) => {
      return total + (mesa.capacidad_sillas || 0);
    }, 0);

    // Agrupar por tipo de precio (SOLO SILLAS/ASIENTOS, NO MESAS)
    const porTipoPrecio = {};
    
    // Función auxiliar para normalizar el tipo de precio
    const normalizarTipoId = (tipoPrecioId) => {
      if (tipoPrecioId === null || tipoPrecioId === undefined) {
        return 'sin_precio';
      }
      // Convertir a string para consistencia
      return String(tipoPrecioId);
    };
    
    // Solo contar sillas/asientos por tipo de precio (las mesas no se cuentan aquí)
    asientos.forEach(a => {
      const tipoId = normalizarTipoId(a.tipo_precio_id);
      if (!porTipoPrecio[tipoId]) {
        porTipoPrecio[tipoId] = { sillas: 0 }; // Solo contamos sillas/asientos
      }
      porTipoPrecio[tipoId].sillas += 1;
    });

    return {
      totalAsientos,
      totalAreas,
      totalMesas,
      sillasDeMesas,
      asientosIndividuales,
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

      // Eliminar TODOS los asientos existentes antes de guardar los nuevos
      // Esto evita conflictos de números duplicados durante la actualización
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
          capacidad_sillas: parseInt(mesa.capacidad_sillas) || 1, // Asegurar que sea un número entero válido
          tipo_precio_id: mesa.tipo_precio_id,
          posicion_x: Math.round(mesa.x),
          posicion_y: Math.round(mesa.y),
          ancho: Math.round(mesa.width),
          alto: Math.round(mesa.height),
          area_id: areaId
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
            const mesaGuardada = mesasGuardadas.find(m => 
              m.numero_mesa === mesaOriginal.numero_mesa && 
              m.tipo_precio_id === mesaOriginal.tipo_precio_id
            );
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
            color: area.color || '#CCCCCC'
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
            color: area.color || '#CCCCCC'
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

                



                {(modo === 'asiento_individual' || modo === 'zona_asientos') && (
                  <div className="control-section">
                    <h3>Configuración de Asientos</h3>
                    {modo === 'zona_asientos' && (
                      <>
                        <div className="form-group-small">
                          <label>Cantidad de Asientos</label>
                          <input
                            type="number"
                            min="1"
                            max="500"
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
                        }}
                        className="select-input"
                      />
                    </div>
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                      Haz clic en el canvas para colocar una mesa. Las sillas se generarán automáticamente alrededor de la mesa.
                    </p>
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
                        <p><strong>Número de Mesa:</strong> {elementoInfo.mesa.numero_mesa}</p>
                        <p><strong>Capacidad:</strong> {elementoInfo.mesa.capacidad_sillas} sillas</p>
                        {elementoInfo.area && <p><strong>Área:</strong> {elementoInfo.area.nombre}</p>}
                        {elementoInfo.tipoPrecio && (
                          <>
                            <p><strong>Tipo de Precio:</strong> {elementoInfo.tipoPrecio.nombre}</p>
                            <p><strong>Precio:</strong> ${elementoInfo.tipoPrecio.precio}</p>
                          </>
                        )}
                        <p><strong>Posición:</strong> ({Math.round(elementoInfo.mesa.x || 0)}, {Math.round(elementoInfo.mesa.y || 0)})</p>
                      </div>
                    )}
                    {elementoInfo.type === 'asiento' && elementoInfo.asiento && (
                      <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                        <p><strong>Nombre:</strong> {generarNombreDescriptivo({ type: 'asiento', id: elementoInfo.asiento.id })}</p>
                        <p><strong>Número de {elementoInfo.mesa ? 'Silla' : 'Asiento'}:</strong> {elementoInfo.asiento.numero_asiento}</p>
                        {elementoInfo.mesa && (
                          <>
                            <p><strong>Mesa:</strong> Mesa {elementoInfo.mesa.numero_mesa}</p>
                            <p><strong>Tipo:</strong> 🪑 Silla de Mesa</p>
                          </>
                        )}
                        {!elementoInfo.mesa && (
                          <p><strong>Tipo:</strong> 💺 Asiento Individual</p>
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
            tools={
              <>
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
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                      Dibuja el área en el canvas. Se te pedirá el nombre después de dibujar.
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
                                <span style={{ fontWeight: 'bold' }}>{area.nombre}</span>
                                <div style={{ display: 'flex', gap: '5px' }}>
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
                                {elementosEnArea.length} elemento(s) dentro
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {(modo === 'asiento_individual' || modo === 'zona_asientos') && (
                  <div className="control-section">
                    <h3>Configuración de Asientos</h3>
                    {modo === 'zona_asientos' && (
                      <>
                        <div className="form-group-small">
                          <label>Cantidad de Asientos</label>
                          <input
                            type="number"
                            min="1"
                            max="500"
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
                        }}
                        className="select-input"
                      />
                    </div>
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                      Haz clic en el canvas para colocar una mesa. Las sillas se generarán automáticamente alrededor de la mesa.
                    </p>
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
            <div
              style={{
                width: '100%',
                boxSizing: 'border-box',
                maxHeight: 'calc(90vh - 70px)',
                overflow: 'hidden'
              }}
            >
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
                <div>• <strong>Asientos individuales:</strong> {resumenLayout.asientosIndividuales}</div>
                <div>• <strong>Total de asientos:</strong> {resumenLayout.totalAsientos}</div>
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
                  // Manejar el caso de 'sin_precio' y convertir correctamente
                  let tipoPrecio = null;
                  if (tipoId !== 'sin_precio') {
                    const tipoIdNum = parseInt(tipoId);
                    if (!isNaN(tipoIdNum)) {
                      tipoPrecio = tiposPrecio.find(tp => tp.id === tipoIdNum);
                    }
                  }
                  const nombre = tipoPrecio ? tipoPrecio.nombre : 'Sin precio';
                  const precio = tipoPrecio ? `$${tipoPrecio.precio}` : '';
                  
                  // Solo mostrar si hay sillas en este tipo de precio
                  if (!datos.sillas || datos.sillas === 0) return null;
                  
                  return (
                    <div key={tipoId} style={{ marginBottom: '10px' }}>
                      <strong>{nombre}</strong> {precio && `(${precio})`}
                      <div style={{ marginLeft: '20px', fontSize: '14px', color: '#bdc3c7' }}>
                        • Sillas: {datos.sillas}
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

      {/* Modal para ingresar nombre del área */}
      <ModalInput
        isOpen={mostrarModalNombreArea}
        onClose={handleCancelarNombreArea}
        onConfirm={handleConfirmarNombreArea}
        title="Nueva Área"
        message="Ingresa el nombre del área"
        placeholder="Ej: PALCO, VIP, Balcón..."
      />
    </div>
  );
};

export default Espacio;
