import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/axios';
import { useAlert } from '../../context/AlertContext';
import './EspacioGrid.css';

// ─── Constantes del Grid ───────────────────────────────────────────────────────
const CELL_SIZE = 36;          // px por celda en pantalla
const GRID_COLS = 60;          // columnas del grid
const GRID_ROWS = 40;          // filas del grid

const COLORES_AREA = [
  { nombre: 'Dorado VIP',    hex: '#D4AF37' },
  { nombre: 'Azul noche',    hex: '#1A3A5C' },
  { nombre: 'Verde esmeralda',hex: '#1B6B4A' },
  { nombre: 'Rojo granate',  hex: '#8B1A1A' },
  { nombre: 'Naranja fuego', hex: '#E86A10' },
  { nombre: 'Morado real',   hex: '#5B2C8D' },
  { nombre: 'Gris plata',    hex: '#6B7280' },
  { nombre: 'Rosa flamingo', hex: '#C2185B' },
  { nombre: 'Cian eléctrico',hex: '#0891B2' },
  { nombre: 'Verde lima',    hex: '#4D7C0F' },
];

const TIPOS_CELDA = {
  vacio: 'vacio',
  area: 'area',
  escenario: 'escenario',
  mesa: 'mesa',
  silla: 'silla',
};

const MODOS = {
  seleccionar: 'seleccionar',
  area: 'area',
  escenario: 'escenario',
  mesa: 'mesa',
  silla: 'silla',
  borrar: 'borrar',
};

// Genera un ID temporal único
const tmpId = () => `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ─── Componente principal ──────────────────────────────────────────────────────
const EspacioGrid = () => {
  const { showAlert, showConfirm } = useAlert();

  // Evento seleccionado
  const [eventos, setEventos] = useState([]);
  const [eventoId, setEventoId] = useState('');
  const [tiposPrecio, setTiposPrecio] = useState([]);
  const [loadingEventos, setLoadingEventos] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [layoutBloqueado, setLayoutBloqueado] = useState(false);

  // Modo de edición
  const [modo, setModo] = useState(MODOS.seleccionar);
  const [tipoPrecioId, setTipoPrecioId] = useState('');

  // Grid: celda[row][col] = { tipo, areaId, elementoId, color, label }
  const [celdas, setCeldas] = useState({});  // clave: "r,c"
  const [areas, setAreas] = useState([]);    // [{id, nombre, color, tipo_precio_id, tipo_area}]
  const [mesas, setMesas] = useState([]);    // [{id, nombre, capacidad_sillas, tipo_precio_id, areaId, gridRow, gridCol}]
  const [asientos, setAsientos] = useState([]); // [{id, nombre, tipo_precio_id, areaId, gridRow, gridCol, mesaId}]
  const [escenarios, setEscenarios] = useState([]); // [{id, celdas:[{r,c}]}]

  // Selección de arrastre (para áreas y escenario)
  const [drag, setDrag] = useState(null); // {startR, startC, curR, curC}
  const isDragging = useRef(false);

  // Elemento seleccionado para info
  const [elementoSeleccionado, setElementoSeleccionado] = useState(null);

  // Modales
  const [modalArea, setModalArea] = useState(null);    // {r1,c1,r2,c2}
  const [modalMesa, setModalMesa] = useState(null);    // {r,c,areaId}
  const [modalSilla, setModalSilla] = useState(null);  // {r,c,areaId}
  const [modalEditar, setModalEditar] = useState(null); // elemento a editar

  // Formularios modales
  const [formArea, setFormArea] = useState({ nombre: '', color: COLORES_AREA[0].hex, tipo_precio_id: '', tipo_area: 'SILLAS', capacidad_personas: '' });
  const [formMesa, setFormMesa] = useState({ nombre: '', capacidad_sillas: 4, tipo_precio_id: '' });
  const [formSilla, setFormSilla] = useState({ nombre: '', tipo_precio_id: '' });

  // Zoom y pan
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const gridRef = useRef(null);

  // ── Cargar eventos ────────────────────────────────────────────────────────────
  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await api.get('/eventos?tipo=especial');
        const lista = res.data?.data || res.data || [];
        // Filtrar solo eventos tipo especial
        const especiales = lista.filter(e => e.tipo_evento === 'especial');
        setEventos(especiales);
      } catch {
        showAlert('Error al cargar eventos', { type: 'error' });
      } finally {
        setLoadingEventos(false);
      }
    };
    cargar();
  }, []);

  // ── Cargar layout al cambiar evento ──────────────────────────────────────────
  useEffect(() => {
    if (!eventoId) {
      limpiarTodo();
      setTiposPrecio([]);
      return;
    }
    cargarLayout();
    cargarTiposPrecio();
  }, [eventoId]);

  const limpiarTodo = () => {
    setCeldas({});
    setAreas([]);
    setMesas([]);
    setAsientos([]);
    setEscenarios([]);
    setElementoSeleccionado(null);
    setLayoutBloqueado(false);
  };

  const cargarTiposPrecio = async () => {
    try {
      const res = await api.get(`/tipos-precio/evento/${eventoId}`);
      setTiposPrecio(res.data?.data || []);
    } catch {
      setTiposPrecio([]);
    }
  };

  const cargarLayout = async () => {
    try {
      const [resEvento, resAreas, resMesas, resAsientos] = await Promise.all([
        api.get(`/eventos/${eventoId}`),
        api.get(`/areas/evento/${eventoId}`),
        api.get(`/mesas/evento/${eventoId}`),
        api.get(`/asientos/evento/${eventoId}`),
      ]);
      
      const eventoData = resEvento.data?.data;
      if (eventoData) {
        setLayoutBloqueado(Boolean(eventoData.layout_bloqueado));
      }

      const areasData = resAreas.data?.data || [];
      const mesasData = resMesas.data?.data || [];
      const asientosData = resAsientos.data?.data || [];

      setAreas(areasData);
      setMesas(mesasData);
      setAsientos(asientosData);

      // Reconstruir celdas desde los datos de BD
      const nuevasCeldas = {};

      // Pintar áreas
      areasData.forEach(area => {
        const cStart = parseInt(area.posicion_x) || 0;
        const rStart = parseInt(area.posicion_y) || 0;
        const cols = parseInt(area.ancho) || 1;
        const rows = parseInt(area.alto) || 1;
        let excluidas = [];
        try {
          if (typeof area.celdas_excluidas === 'string') {
            excluidas = JSON.parse(area.celdas_excluidas);
          } else if (Array.isArray(area.celdas_excluidas)) {
            excluidas = area.celdas_excluidas;
          }
        } catch(e) {}
        
        for (let r = rStart; r < rStart + rows; r++) {
          for (let c = cStart; c < cStart + cols; c++) {
            // Solo pintar si no está excluida
            if (!excluidas.some(ex => ex.r === r && ex.c === c)) {
              const key = `${r},${c}`;
              nuevasCeldas[key] = { tipo: TIPOS_CELDA.area, areaId: area.id, color: area.color, label: '' };
            }
          }
        }
      });

      // Pintar mesas
      mesasData.forEach(mesa => {
        if (mesa.grid_row != null && mesa.grid_col != null) {
          const key = `${mesa.grid_row},${mesa.grid_col}`;
          nuevasCeldas[key] = {
            tipo: TIPOS_CELDA.mesa,
            areaId: mesa.area_id,
            elementoId: mesa.id,
            color: '#8b5e3c',
            label: mesa.codigo_mesa || mesa.numero_mesa,
          };
        }
      });

      // Pintar asientos
      asientosData.forEach(a => {
        if (a.grid_row != null && a.grid_col != null) {
          const key = `${a.grid_row},${a.grid_col}`;
          nuevasCeldas[key] = {
            tipo: TIPOS_CELDA.silla,
            areaId: a.area_id,
            elementoId: a.id,
            color: '#3b82f6',
            label: a.numero_asiento,
          };
        }
      });

      // Pintar escenario
      let escCeldas = eventoData.escenario_celdas;
      if (typeof escCeldas === 'string') {
        try { escCeldas = JSON.parse(escCeldas); } catch(e) {}
      }

      if (escCeldas && Array.isArray(escCeldas) && escCeldas.length > 0) {
        const escId = 'escenario_1';
        const celdasEscenario = [];
        escCeldas.forEach(c => {
          const key = `${c.r},${c.c}`;
          nuevasCeldas[key] = { tipo: TIPOS_CELDA.escenario, elementoId: escId, color: '#000000', label: 'ESCENARIO' };
          celdasEscenario.push({ r: c.r, c: c.c });
        });
        setEscenarios([{ id: escId, celdas: celdasEscenario }]);
      } else if (eventoData && eventoData.escenario_x != null) {
        const ex = parseInt(eventoData.escenario_x);
        const ey = parseInt(eventoData.escenario_y);
        const ew = parseInt(eventoData.escenario_width) || 1;
        const eh = parseInt(eventoData.escenario_height) || 1;
        const escId = 'escenario_1';
        const celdasEscenario = [];
        for (let r = ey; r < ey + eh; r++) {
          for (let c = ex; c < ex + ew; c++) {
            const key = `${r},${c}`;
            nuevasCeldas[key] = { tipo: TIPOS_CELDA.escenario, elementoId: escId, color: '#000000', label: 'ESCENARIO' };
            celdasEscenario.push({ r, c });
          }
        }
        setEscenarios([{ id: escId, celdas: celdasEscenario }]);
      } else {
        setEscenarios([]);
      }

      setCeldas(nuevasCeldas);
    } catch {
      showAlert('Error al cargar el layout', { type: 'error' });
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const getAreaEnCelda = (r, c) => {
    const key = `${r},${c}`;
    const celda = celdas[key];
    if (!celda || celda.tipo !== TIPOS_CELDA.area) return null;
    return areas.find(a => a.id == celda.areaId) || null;
  };

  const getTipoPrecioSeleccionado = () =>
    tiposPrecio.find(t => t.id == parseInt(tipoPrecioId)) || null;

  const getPrecioTipoPrecio = (id) =>
    tiposPrecio.find(t => t.id === parseInt(id))?.precio || 0;

  // Rango de selección normalizado
  const rangoNormalizado = (d) => {
    if (!d) return null;
    const r1 = Math.min(d.startR, d.curR);
    const r2 = Math.max(d.startR, d.curR);
    const c1 = Math.min(d.startC, d.curC);
    const c2 = Math.max(d.startC, d.curC);
    return { r1, r2, c1, c2 };
  };

  // ── Eventos del mouse en el grid ──────────────────────────────────────────────
  const handleMouseDown = useCallback((e, r, c) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Pan con clic central o Alt+clic
      isPanning.current = true;
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      e.preventDefault();
      return;
    }

    if (modo === MODOS.seleccionar) {
      // Seleccionar elemento
      const key = `${r},${c}`;
      const celda = celdas[key];
      if (celda && celda.tipo !== TIPOS_CELDA.vacio) {
        if (celda.tipo === TIPOS_CELDA.area) {
          const area = areas.find(a => a.id == celda.areaId);
          setElementoSeleccionado({ tipo: 'area', data: area });
        } else if (celda.tipo === TIPOS_CELDA.mesa) {
          const mesa = mesas.find(m => m.id == celda.elementoId);
          setElementoSeleccionado({ tipo: 'mesa', data: mesa });
        } else if (celda.tipo === TIPOS_CELDA.silla) {
          const silla = asientos.find(a => a.id == celda.elementoId);
          setElementoSeleccionado({ tipo: 'silla', data: silla });
        }
      } else {
        setElementoSeleccionado(null);
      }
      return;
    }

    if (modo === MODOS.area || modo === MODOS.escenario) {
      isDragging.current = true;
      setDrag({ startR: r, startC: c, curR: r, curC: c });
      return;
    }

    if (modo === MODOS.mesa) {
      handleColocarMesa(r, c);
      return;
    }

    if (modo === MODOS.silla) {
      handleColocarSilla(r, c);
      return;
    }

    if (modo === MODOS.borrar) {
      handleBorrarCelda(r, c);
      return;
    }
  }, [modo, celdas, areas, mesas, asientos, pan]);

  const handleMouseMove = useCallback((e, r, c) => {
    if (isPanning.current) {
      setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
      return;
    }
    if (isDragging.current) {
      setDrag(prev => prev ? { ...prev, curR: r, curC: c } : null);
    }
  }, []);

  const handleMouseUp = useCallback((e) => {
    isPanning.current = false;
    if (!isDragging.current) return;
    isDragging.current = false;

    if (!drag) return;
    const rango = rangoNormalizado(drag);
    setDrag(null);

    if (modo === MODOS.area) {
      // Verificar que las celdas estén vacías
      for (let r = rango.r1; r <= rango.r2; r++) {
        for (let c = rango.c1; c <= rango.c2; c++) {
          const key = `${r},${c}`;
          if (celdas[key] && celdas[key].tipo !== TIPOS_CELDA.vacio) {
            showAlert('Hay celdas ocupadas en el rango seleccionado. Selecciona un área libre.', { type: 'warning' });
            return;
          }
        }
      }
      setModalArea(rango);
      // Arreglo temporal si setModalArea no resetea la capacidad
      setFormArea({ nombre: '', color: COLORES_AREA[0].hex, tipo_precio_id: tipoPrecioId || '', tipo_area: 'SILLAS', capacidad_personas: '' });
    } else if (modo === MODOS.escenario) {
      confirmarEscenario(rango);
    }
  }, [drag, modo, celdas, tipoPrecioId]);

  // ── Confirmar Área ─────────────────────────────────────────────────────────────
  const confirmarArea = () => {
    if (!formArea.nombre.trim()) {
      showAlert('Debes escribir el nombre del área', { type: 'warning' });
      return;
    }
    const rango = modalArea;
    const id = tmpId();
    const nuevaArea = {
      id,
      nombre: formArea.nombre.trim(),
      color: formArea.color,
      tipo_precio_id: formArea.tipo_precio_id ? parseInt(formArea.tipo_precio_id) : null,
      tipo_area: formArea.tipo_area,
      capacidad_personas: formArea.tipo_area === 'PERSONAS' ? parseInt(formArea.capacidad_personas) || null : null,
      posicion_x: rango.c1,
      posicion_y: rango.r1,
      ancho: rango.c2 - rango.c1 + 1,
      alto: rango.r2 - rango.r1 + 1,
    };
    setAreas(prev => [...prev, nuevaArea]);
    const nuevasCeldas = { ...celdas };
    for (let r = rango.r1; r <= rango.r2; r++) {
      for (let c = rango.c1; c <= rango.c2; c++) {
        nuevasCeldas[`${r},${c}`] = { tipo: TIPOS_CELDA.area, areaId: id, color: formArea.color, label: '' };
      }
    }
    setCeldas(nuevasCeldas);
    setModalArea(null);
  };

  // ── Confirmar Escenario ───────────────────────────────────────────────────────
  const confirmarEscenario = (rango) => {
    const id = tmpId();
    const celdasEscenario = [];
    const nuevasCeldas = { ...celdas };
    for (let r = rango.r1; r <= rango.r2; r++) {
      for (let c = rango.c1; c <= rango.c2; c++) {
        celdasEscenario.push({ r, c });
        nuevasCeldas[`${r},${c}`] = { tipo: TIPOS_CELDA.escenario, color: '#7c2d12', label: '' };
      }
    }
    setEscenarios(prev => [...prev, { id, celdas: celdasEscenario }]);
    setCeldas(nuevasCeldas);
  };

  // ── Colocar Mesa ─────────────────────────────────────────────────────────────
  const handleColocarMesa = (r, c) => {
    const key = `${r},${c}`;
    const celda = celdas[key];

    // Solo permitir en celda de área
    if (!celda || celda.tipo !== TIPOS_CELDA.area) {
      showAlert('Las mesas solo pueden colocarse dentro de un área', { type: 'warning' });
      return;
    }

    const areaId = celda.areaId;
    const area = areas.find(a => a.id == areaId);
    setModalMesa({ r, c, areaId });
    const tp = getTipoPrecioSeleccionado();
    setFormMesa({
      nombre: '',
      capacidad_sillas: 4,
      tipo_precio_id: tp ? tp.id : (area?.tipo_precio_id || tipoPrecioId || ''),
    });
  };

  const confirmarMesa = () => {
    if (!formMesa.nombre.trim()) {
      showAlert('Debes escribir el nombre de la mesa (ej: M1A)', { type: 'warning' });
      return;
    }
    const { r, c, areaId } = modalMesa;
    const id = tmpId();
    const area = areas.find(a => a.id == areaId);
    
    const finalTipoPrecioId = formMesa.tipo_precio_id ? parseInt(formMesa.tipo_precio_id) : (area?.tipo_precio_id ? parseInt(area.tipo_precio_id) : null);
    
    if (!finalTipoPrecioId) {
      showAlert('Debes asignar un precio a la mesa o al área donde se encuentra.', { type: 'warning' });
      return;
    }

    const nuevaMesa = {
      id,
      codigo_mesa: formMesa.nombre.trim(),
      numero_mesa: formMesa.nombre.trim(),
      capacidad_sillas: parseInt(formMesa.capacidad_sillas) || 4,
      tipo_precio_id: finalTipoPrecioId,
      tipo_precio_nombre: tiposPrecio.find(t => t.id === finalTipoPrecioId)?.nombre || '',
      tipo_precio_precio: getPrecioTipoPrecio(finalTipoPrecioId),
      area_id: areaId,
      area_nombre: area?.nombre || '',
      grid_row: r,
      grid_col: c,
      evento_id: parseInt(eventoId),
    };
    setMesas(prev => [...prev, nuevaMesa]);
    setCeldas(prev => ({
      ...prev,
      [`${r},${c}`]: { tipo: TIPOS_CELDA.mesa, areaId, elementoId: id, color: '#8b5e3c', label: formMesa.nombre.trim() },
    }));
    setModalMesa(null);
  };

  // ── Colocar Silla ─────────────────────────────────────────────────────────────
  const handleColocarSilla = (r, c) => {
    const key = `${r},${c}`;
    const celda = celdas[key];

    if (!celda || celda.tipo !== TIPOS_CELDA.area) {
      showAlert('Las sillas solo pueden colocarse dentro de un área', { type: 'warning' });
      return;
    }

    const areaId = celda.areaId;
    const area = areas.find(a => a.id == areaId);
    setModalSilla({ r, c, areaId });
    const tp = getTipoPrecioSeleccionado();
    setFormSilla({
      nombre: '',
      tipo_precio_id: tp ? tp.id : (area?.tipo_precio_id || tipoPrecioId || ''),
    });
  };

  const confirmarSilla = () => {
    if (!formSilla.nombre.trim()) {
      showAlert('Debes escribir el nombre de la silla (ej: S1, A1)', { type: 'warning' });
      return;
    }
    const { r, c, areaId } = modalSilla;
    const id = tmpId();
    const area = areas.find(a => a.id == areaId);
    
    const finalTipoPrecioId = formSilla.tipo_precio_id ? parseInt(formSilla.tipo_precio_id) : (area?.tipo_precio_id ? parseInt(area.tipo_precio_id) : null);
    
    if (!finalTipoPrecioId) {
      showAlert('Debes asignar un precio a la silla o al área donde se encuentra.', { type: 'warning' });
      return;
    }

    const nuevaSilla = {
      id,
      numero_asiento: formSilla.nombre.trim(),
      tipo_precio_id: finalTipoPrecioId,
      tipo_precio_nombre: tiposPrecio.find(t => t.id === finalTipoPrecioId)?.nombre || '',
      tipo_precio_precio: getPrecioTipoPrecio(finalTipoPrecioId),
      area_id: areaId,
      area_nombre: area?.nombre || '',
      mesa_id: null,
      grid_row: r,
      grid_col: c,
      evento_id: parseInt(eventoId),
    };
    setAsientos(prev => [...prev, nuevaSilla]);
    setCeldas(prev => ({
      ...prev,
      [`${r},${c}`]: { tipo: TIPOS_CELDA.silla, areaId, elementoId: id, color: '#3b82f6', label: formSilla.nombre.trim() },
    }));
    setModalSilla(null);
  };

  // ── Editar Mesa ──────────────────────────────────────────────────────────────
  const abrirEditarMesa = (mesa) => {
    setFormMesa({
      nombre: mesa.codigo_mesa || mesa.numero_mesa || '',
      capacidad_sillas: mesa.capacidad_sillas || 4,
      tipo_precio_id: mesa.tipo_precio_id || '',
    });
    setModalEditar({ tipo: 'mesa', data: mesa });
  };

  const confirmarEditarMesa = () => {
    if (!formMesa.nombre.trim()) {
      showAlert('Debes escribir el nombre de la mesa', { type: 'warning' });
      return;
    }
    const mesa = modalEditar.data;
    const updatedMesa = {
      ...mesa,
      codigo_mesa: formMesa.nombre.trim(),
      numero_mesa: formMesa.nombre.trim(),
      capacidad_sillas: parseInt(formMesa.capacidad_sillas) || 4,
      tipo_precio_id: formMesa.tipo_precio_id ? parseInt(formMesa.tipo_precio_id) : null,
      tipo_precio_nombre: tiposPrecio.find(t => t.id === parseInt(formMesa.tipo_precio_id))?.nombre || '',
      tipo_precio_precio: getPrecioTipoPrecio(formMesa.tipo_precio_id),
    };
    setMesas(prev => prev.map(m => m.id === mesa.id ? updatedMesa : m));
    // Actualizar label en la celda
    const cellKey = Object.keys(celdas).find(k => celdas[k].elementoId === mesa.id);
    if (cellKey) {
      setCeldas(prev => ({
        ...prev,
        [cellKey]: { ...prev[cellKey], label: formMesa.nombre.trim() },
      }));
    }
    setModalEditar(null);
    setElementoSeleccionado({ tipo: 'mesa', data: updatedMesa });
    showAlert('Mesa actualizada', { type: 'success' });
  };

  // ── Editar Silla ─────────────────────────────────────────────────────────────
  const abrirEditarSilla = (silla) => {
    setFormSilla({
      nombre: silla.numero_asiento || '',
      tipo_precio_id: silla.tipo_precio_id || '',
    });
    setModalEditar({ tipo: 'silla', data: silla });
  };

  const confirmarEditarSilla = () => {
    if (!formSilla.nombre.trim()) {
      showAlert('Debes escribir el nombre de la silla', { type: 'warning' });
      return;
    }
    const silla = modalEditar.data;
    const updatedSilla = {
      ...silla,
      numero_asiento: formSilla.nombre.trim(),
      tipo_precio_id: formSilla.tipo_precio_id ? parseInt(formSilla.tipo_precio_id) : null,
      tipo_precio_nombre: tiposPrecio.find(t => t.id === parseInt(formSilla.tipo_precio_id))?.nombre || '',
      tipo_precio_precio: getPrecioTipoPrecio(formSilla.tipo_precio_id),
    };
    setAsientos(prev => prev.map(a => a.id === silla.id ? updatedSilla : a));
    const cellKey = Object.keys(celdas).find(k => celdas[k].elementoId === silla.id);
    if (cellKey) {
      setCeldas(prev => ({
        ...prev,
        [cellKey]: { ...prev[cellKey], label: formSilla.nombre.trim() },
      }));
    }
    setModalEditar(null);
    setElementoSeleccionado({ tipo: 'silla', data: updatedSilla });
    showAlert('Silla actualizada', { type: 'success' });
  };

  // ── Borrar celda ─────────────────────────────────────────────────────────────
  const handleBorrarCelda = (r, c) => {
    const key = `${r},${c}`;
    const celda = celdas[key];
    if (!celda) return;

    const nuevasCeldas = { ...celdas };

    if (celda.tipo === TIPOS_CELDA.area) {
      // Borrar solo este cuadradito del área (no toda el área)
      // Si tiene mesa o silla encima en este cuadradito, borrar también
      delete nuevasCeldas[key];
      // Verificar si el área aún tiene celdas restantes
      const areaId = celda.areaId;
      const celdasRestantes = Object.values(nuevasCeldas).filter(v => v.areaId === areaId && v.tipo === TIPOS_CELDA.area);
      if (celdasRestantes.length === 0) {
        // Ya no queda ninguna celda de esta área, eliminar el área del estado
        setAreas(prev => prev.filter(a => a.id !== areaId));
      }
    } else if (celda.tipo === TIPOS_CELDA.mesa) {
      delete nuevasCeldas[key];
      setMesas(prev => prev.filter(m => m.id !== celda.elementoId));
    } else if (celda.tipo === TIPOS_CELDA.silla) {
      delete nuevasCeldas[key];
      setAsientos(prev => prev.filter(a => a.id !== celda.elementoId));
    } else if (celda.tipo === TIPOS_CELDA.escenario) {
      delete nuevasCeldas[key];
      // Actualizar el estado de escenarios para que se persista al guardar
      setEscenarios(prev => {
        const updated = prev.map(esc => ({
          ...esc,
          celdas: esc.celdas.filter(cc => !(cc.r === r && cc.c === c)),
        })).filter(esc => esc.celdas.length > 0);
        return updated;
      });
    }

    setCeldas(nuevasCeldas);
    if (elementoSeleccionado?.data?.id === celda.elementoId || elementoSeleccionado?.data?.id === celda.areaId) {
      setElementoSeleccionado(null);
    }
  };

  // ── Borrar toda el área ──────────────────────────────────────────────────────
  const handleBorrarAreaCompleta = (areaId) => {
    const nuevasCeldas = { ...celdas };
    // Verificar si hay mesas o sillas en el área
    const tieneElementos = Object.values(nuevasCeldas).some(v =>
      v.areaId === areaId && (v.tipo === TIPOS_CELDA.mesa || v.tipo === TIPOS_CELDA.silla)
    );
    if (tieneElementos) {
      showAlert('El área tiene mesas o sillas. Borra primero los elementos del área.', { type: 'warning' });
      return;
    }
    Object.keys(nuevasCeldas).forEach(k => {
      if (nuevasCeldas[k].areaId === areaId && nuevasCeldas[k].tipo === TIPOS_CELDA.area) {
        delete nuevasCeldas[k];
      }
    });
    setAreas(prev => prev.filter(a => a.id !== areaId));
    setCeldas(nuevasCeldas);
    setElementoSeleccionado(null);
  };

  // ── Guardar Layout ────────────────────────────────────────────────────────────
  const guardarLayout = async () => {
    if (!eventoId) {
      showAlert('Selecciona un evento primero', { type: 'warning' });
      return;
    }

    const confirmado = await showConfirm(
      'Se guardará el diseño actual del espacio. Los cambios se aplicarán al evento.',
      {
        title: '¿Guardar el layout?',
        confirmText: 'Guardar',
      }
    );
    if (!confirmado) return;

    setGuardando(true);
    try {
      // Construir el payload completo para guardarLayoutCompleto
      let escenarioUnificado = null;
      if (escenarios.length > 0) {
        const minX = Math.min(...escenarios.flatMap(e => e.celdas.map(c => c.c)));
        const minY = Math.min(...escenarios.flatMap(e => e.celdas.map(c => c.r)));
        const maxX = Math.max(...escenarios.flatMap(e => e.celdas.map(c => c.c)));
        const maxY = Math.max(...escenarios.flatMap(e => e.celdas.map(c => c.r)));
        escenarioUnificado = {
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
        };
      }

      const payload = {
        forma_espacio: 'rectangulo',
        modo_layout: 'grid',
        grid_cols: GRID_COLS,
        grid_rows: GRID_ROWS,
        hoja_ancho: GRID_COLS * CELL_SIZE,
        hoja_alto: GRID_ROWS * CELL_SIZE,
        escenario: escenarioUnificado,
        escenario_celdas: escenarios.flatMap(e => e.celdas.map(c => ({ r: c.r, c: c.c }))),
        areas: areas.map(a => {
          // Calcular celdas excluidas
          const celdasExcluidas = [];
          const cStart = parseInt(a.posicion_x) || 0;
          const rStart = parseInt(a.posicion_y) || 0;
          const cols = parseInt(a.ancho) || 1;
          const rows = parseInt(a.alto) || 1;
          
          for (let r = rStart; r < rStart + rows; r++) {
            for (let c = cStart; c < cStart + cols; c++) {
              const key = `${r},${c}`;
              const celda = celdas[key];
              // Si la celda no existe o no pertenece a esta área, está excluida
              if (!celda || celda.tipo !== TIPOS_CELDA.area || celda.areaId !== a.id) {
                celdasExcluidas.push({ r, c });
              }
            }
          }

          return {
            id: a.id,
            nombre: a.nombre,
            color: a.color,
            tipo_precio_id: a.tipo_precio_id,
            tipo_area: a.tipo_area || 'SILLAS',
            x: a.posicion_x,
            y: a.posicion_y,
            width: a.ancho,
            height: a.alto,
            forma: 'rectangulo',
            capacidad_personas: a.capacidad_personas,
            celdas_excluidas: celdasExcluidas.length > 0 ? celdasExcluidas : null,
          };
        }),
        mesas: mesas.map(m => ({
          id: m.id,
          numero_mesa: m.numero_mesa || m.codigo_mesa,
          codigo_mesa: m.codigo_mesa || m.numero_mesa,
          capacidad_sillas: m.capacidad_sillas,
          tipo_precio_id: m.tipo_precio_id,
          area_id: m.area_id,
          x: (m.grid_col || 0) * CELL_SIZE,
          y: (m.grid_row || 0) * CELL_SIZE,
          width: CELL_SIZE,
          height: CELL_SIZE,
          grid_col: m.grid_col,
          grid_row: m.grid_row,
          precio_mesa_completa: m.tipo_precio_precio || null,
          precio_silla_individual: null,
          venta_solo_mesa: 0,
        })),
        asientos: asientos.map(a => ({
          id: a.id,
          numero_asiento: a.numero_asiento,
          tipo_precio_id: a.tipo_precio_id,
          area_id: a.area_id,
          mesa_id: a.mesa_id || null,
          x: (a.grid_col || 0) * CELL_SIZE,
          y: (a.grid_row || 0) * CELL_SIZE,
          grid_col: a.grid_col,
          grid_row: a.grid_row,
        })),
      };

      await api.put(`/layout/${eventoId}`, payload);
      setLayoutBloqueado(true);
      showAlert('¡Layout guardado exitosamente!', { type: 'success' });
      cargarLayout(); // Recargar para obtener IDs reales de BD
    } catch (err) {
      console.error(err);
      showAlert(err.response?.data?.message || 'Error al guardar el layout', { type: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  const desbloquearLayout = async () => {
    try {
      const confirmado = await showConfirm('¿Desbloquear el layout para editar? Esto permitirá modificar el diseño.', { title: 'Desbloquear Layout' });
      if (!confirmado) return;
      await api.put(`/eventos/${eventoId}`, { layout_bloqueado: 0 });
      setLayoutBloqueado(false);
      showAlert('Layout desbloqueado', { type: 'success' });
    } catch (err) {
      showAlert('Error al desbloquear el layout', { type: 'error' });
    }
  };

  // ── Limpiar todo ──────────────────────────────────────────────────────────────
  const handleLimpiar = async () => {
    const confirmado = await showConfirm(
      'Se eliminará todo el diseño actual. ¿Confirmar?',
      {
        title: 'Limpiar el diseño',
        confirmText: 'Limpiar',
      }
    );
    if (!confirmado) return;
    limpiarTodo();
  };

  const handleLimpiarEscenario = async () => {
    const confirmado = await showConfirm(
      'Se eliminarán todos los bloques de escenario. ¿Confirmar?',
      {
        title: 'Limpiar Escenario',
        confirmText: 'Limpiar',
      }
    );
    if (!confirmado) return;
    
    const nuevasCeldas = { ...celdas };
    for (const key in nuevasCeldas) {
      if (nuevasCeldas[key].tipo === TIPOS_CELDA.escenario) {
        delete nuevasCeldas[key];
      }
    }
    setCeldas(nuevasCeldas);
    setEscenarios([]);
  };

  // ── Render de la cuadrícula ───────────────────────────────────────────────────
  const rangoArrastre = drag ? rangoNormalizado(drag) : null;

  const renderGrid = () => {
    const rows = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      const cols = [];
      for (let c = 0; c < GRID_COLS; c++) {
        const key = `${r},${c}`;
        const celda = celdas[key];
        const enArrastre = rangoArrastre &&
          r >= rangoArrastre.r1 && r <= rangoArrastre.r2 &&
          c >= rangoArrastre.c1 && c <= rangoArrastre.c2;

        let bg = '#ffffff';
        let border = '#e2e8f0';
        let label = '';
        let icon = '';
        let textColor = '#94a3b8';

        if (enArrastre) {
          bg = modo === MODOS.escenario ? 'rgba(124,45,18,0.7)' : 'rgba(99,102,241,0.4)';
          border = modo === MODOS.escenario ? '#ea580c' : '#818cf8';
        } else if (celda) {
          switch (celda.tipo) {
            case TIPOS_CELDA.area:
              bg = celda.color + '33'; // 20% opacidad
              border = celda.color + '88';
              break;
            case TIPOS_CELDA.escenario:
              bg = '#7c2d12';
              border = '#ea580c';
              icon = '🎭';
              label = 'ESC';
              textColor = '#fed7aa';
              break;
            case TIPOS_CELDA.mesa:
              bg = '#fef08a';
              border = '#000000';
              icon = '';
              label = celda.label;
              textColor = '#000000';
              break;
            case TIPOS_CELDA.silla:
              bg = '#93c5fd';
              border = '#1d4ed8';
              icon = '';
              label = celda.label;
              textColor = '#1e3a5f';
              break;
          }
        }

        const isSelected = elementoSeleccionado &&
          celda && celda.elementoId === elementoSeleccionado?.data?.id;

        cols.push(
          <div
            key={key}
            className={`eg-celda${isSelected ? ' eg-celda--selected' : ''}${celda?.tipo === TIPOS_CELDA.area ? ' eg-celda--area' : ''}`}
            style={{
              width: CELL_SIZE,
              height: CELL_SIZE,
              backgroundColor: bg,
              border: `1px solid ${isSelected ? '#fbbf24' : border}`,
              boxSizing: 'border-box',
              cursor: modo === MODOS.seleccionar ? 'default' : 'crosshair',
              position: 'relative',
              flexShrink: 0,
              userSelect: 'none',
              pointerEvents: (layoutBloqueado && modo !== MODOS.seleccionar) ? 'none' : 'auto',
            }}
            onMouseDown={(e) => handleMouseDown(e, r, c)}
            onMouseEnter={(e) => handleMouseMove(e, r, c)}
            onMouseUp={handleMouseUp}
          >
            {label && (
              <span style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color: textColor,
                lineHeight: 1, textAlign: 'center', padding: 1,
                overflow: 'hidden',
              }}>
                <span style={{ fontSize: label.length > 4 ? 10 : 12, marginTop: 0 }}>
                  {label.slice(0, 6)}
                </span>
              </span>
            )}
            {!label && icon && (
              <span style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14,
              }}>{icon}</span>
            )}
          </div>
        );
      }
      rows.push(
        <div key={r} style={{ display: 'flex', flexDirection: 'row' }}>
          {cols}
        </div>
      );
    }
    return rows;
  };

  // Leyenda de áreas superpuesta
  const renderAreaLabels = () =>
    areas.map(area => {
      const col = area.posicion_x;
      const row = area.posicion_y;
      const w = area.ancho;
      return (
        <div
          key={area.id}
          style={{
            position: 'absolute',
            left: col * CELL_SIZE + 4,
            top: row * CELL_SIZE + 2,
            background: area.color + 'CC',
            color: '#fff',
            fontSize: 11,
            fontWeight: 800,
            padding: '1px 5px',
            borderRadius: 3,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            maxWidth: w * CELL_SIZE - 8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textShadow: '0 1px 2px #0006',
            zIndex: 10,
          }}
        >
          {area.nombre}
        </div>
      );
    });

  // ── Resumen ───────────────────────────────────────────────────────────────────
  const resumen = {
    areas: areas.length,
    mesas: mesas.length,
    sillasMesa: mesas.reduce((s, m) => s + (parseInt(m.capacidad_sillas) || 0), 0),
    sillasIndividuales: asientos.length,
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="eg-root">
      {/* ── Barra superior ─────────────────────────────────────── */}
      <div className="eg-topbar">
        <div className="eg-topbar__left">
          <h1 className="eg-topbar__title">🗺️ Editor de Espacios</h1>
          <select
            className="eg-select"
            value={eventoId}
            onChange={e => setEventoId(e.target.value)}
            disabled={loadingEventos}
          >
            <option value="">— Selecciona un evento especial —</option>
            {eventos.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.titulo}</option>
            ))}
          </select>
        </div>
        <div className="eg-topbar__right">
          <span className="eg-resumen">
            {resumen.areas} áreas · {resumen.mesas} mesas ({resumen.sillasMesa} sillas) · {resumen.sillasIndividuales} sillas sueltas
          </span>
          <div className="layout-actions">
            {layoutBloqueado ? (
              <button className="eg-btn eg-btn--warning" onClick={desbloquearLayout}>
                🔓 Desbloquear Layout
              </button>
            ) : (
              <>
                <button className="eg-btn eg-btn--danger" onClick={handleLimpiarEscenario} disabled={!eventoId || guardando} style={{ backgroundColor: '#f97316' }}>
                  🎭 Limpiar Escenario
                </button>
                <button className="eg-btn eg-btn--danger" onClick={handleLimpiar} disabled={!eventoId || guardando}>
                  🗑 Limpiar Todo
                </button>
                <button className="eg-btn eg-btn--primary" onClick={guardarLayout} disabled={!eventoId || guardando}>
                  {guardando ? '💾 Guardando…' : '💾 Guardar Layout'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="eg-body">
        {/* ── Panel lateral ──────────────────────────────────────── */}
        <aside className="eg-sidebar">
          <h2 className="eg-sidebar__title">Herramientas</h2>

          {/* Tipo de precio activo */}
          <div className="eg-sidebar__section">
            <label className="eg-label">Tipo de precio activo</label>
            <select
              className="eg-select eg-select--full"
              value={tipoPrecioId}
              onChange={e => setTipoPrecioId(e.target.value)}
              disabled={!eventoId}
            >
              <option value="">— Seleccionar —</option>
              {tiposPrecio.map(tp => (
                <option key={tp.id} value={tp.id}>
                  {tp.nombre} — Bs {parseFloat(tp.precio).toFixed(2)}
                </option>
              ))}
            </select>
            {tipoPrecioId && (
              <div className="eg-precio-activo">
                💰 Bs {parseFloat(getPrecioTipoPrecio(tipoPrecioId)).toFixed(2)} por unidad
              </div>
            )}
          </div>

          {/* Modos */}
          <div className="eg-sidebar__section">
            <label className="eg-label">Modo de edición</label>
            <div className="eg-modos">
              {[
                { key: MODOS.seleccionar, icon: '👆', label: 'Seleccionar' },
                { key: MODOS.area, icon: '📦', label: 'Área (arrastrar)' },
                { key: MODOS.escenario, icon: '🎭', label: 'Escenario' },
                { key: MODOS.mesa, icon: '🪑', label: 'Mesa (1 clic)' },
                { key: MODOS.silla, icon: '💺', label: 'Silla suelta' },
                { key: MODOS.borrar, icon: '🗑', label: 'Borrar' },
              ].map(m => (
                <button
                  key={m.key}
                  className={`eg-modo-btn${modo === m.key ? ' eg-modo-btn--activo' : ''}`}
                  onClick={() => setModo(m.key)}
                  disabled={!eventoId}
                >
                  <span className="eg-modo-btn__icon">{m.icon}</span>
                  <span className="eg-modo-btn__label">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Instrucciones contextuales */}
          <div className="eg-sidebar__section eg-instrucciones">
            {modo === MODOS.seleccionar && <p>👆 Haz clic en un elemento para ver su información.</p>}
            {modo === MODOS.area && <p>📦 Arrastra para marcar un área rectangular. Al soltar, pon el nombre y el color.</p>}
            {modo === MODOS.escenario && <p>🎭 Arrastra para marcar el escenario (no comprable).</p>}
            {modo === MODOS.mesa && <p>🪑 Clic en una celda <strong>dentro de un área</strong> para colocar una mesa. Escribe el nombre y la cantidad de sillas.</p>}
            {modo === MODOS.silla && <p>💺 Clic en una celda <strong>dentro de un área</strong> para colocar una silla suelta.</p>}
            {modo === MODOS.borrar && <p>🗑 Clic en cualquier elemento para borrarlo. Borrar un área borra su color pero no sus mesas/sillas.</p>}
          </div>

          {/* Info elemento seleccionado */}
          {elementoSeleccionado && (
            <div className="eg-sidebar__section eg-info-elemento">
              <h3 className="eg-label">📋 Elemento seleccionado</h3>
              {elementoSeleccionado.tipo === 'area' && (
                <div>
                  <p><strong>Área:</strong> {elementoSeleccionado.data?.nombre}</p>
                  <p><strong>Tipo:</strong> {elementoSeleccionado.data?.tipo_area}</p>
                  <p><strong>Tamaño:</strong> {elementoSeleccionado.data?.ancho}×{elementoSeleccionado.data?.alto} celdas</p>
                  {elementoSeleccionado.data?.tipo_area === 'PERSONAS' && (
                    <p><strong>Límite Personas:</strong> {elementoSeleccionado.data?.capacidad_personas || 'Sin límite'}</p>
                  )}
                  {elementoSeleccionado.data?.tipo_precio_id && (
                    <p><strong>Precio:</strong> {tiposPrecio.find(t => t.id === elementoSeleccionado.data.tipo_precio_id)?.nombre}</p>
                  )}
                </div>
              )}
              {elementoSeleccionado.tipo === 'mesa' && (
                <div>
                  <p><strong>Mesa:</strong> {elementoSeleccionado.data?.codigo_mesa || elementoSeleccionado.data?.numero_mesa}</p>
                  <p><strong>Sillas:</strong> {elementoSeleccionado.data?.capacidad_sillas}</p>
                  <p><strong>Área:</strong> {elementoSeleccionado.data?.area_nombre || '—'}</p>
                  <p><strong>Precio:</strong> {elementoSeleccionado.data?.tipo_precio_nombre || '—'} (Bs {parseFloat(elementoSeleccionado.data?.tipo_precio_precio || 0).toFixed(2)})</p>
                  <p className="eg-nota">💡 Esta mesa genera <strong>{elementoSeleccionado.data?.capacidad_sillas} boletos</strong> al comprarse completa.</p>
                </div>
              )}
              {elementoSeleccionado.tipo === 'silla' && (
                <div>
                  <p><strong>Silla:</strong> {elementoSeleccionado.data?.numero_asiento}</p>
                  <p><strong>Área:</strong> {elementoSeleccionado.data?.area_nombre || '—'}</p>
                  <p><strong>Precio:</strong> {elementoSeleccionado.data?.tipo_precio_nombre || '—'} (Bs {parseFloat(elementoSeleccionado.data?.tipo_precio_precio || 0).toFixed(2)})</p>
                </div>
              )}
              {!layoutBloqueado && elementoSeleccionado.tipo === 'mesa' && (
                <button
                  className="eg-btn eg-btn--primary eg-btn--sm"
                  style={{ marginTop: 8, marginRight: 6 }}
                  onClick={() => abrirEditarMesa(elementoSeleccionado.data)}
                >
                  ✏️ Editar Mesa
                </button>
              )}
              {!layoutBloqueado && elementoSeleccionado.tipo === 'silla' && (
                <button
                  className="eg-btn eg-btn--primary eg-btn--sm"
                  style={{ marginTop: 8, marginRight: 6 }}
                  onClick={() => abrirEditarSilla(elementoSeleccionado.data)}
                >
                  ✏️ Editar Silla
                </button>
              )}
              {!layoutBloqueado && elementoSeleccionado.tipo === 'area' && (
                <button
                  className="eg-btn eg-btn--danger eg-btn--sm"
                  style={{ marginTop: 8, marginRight: 6 }}
                  onClick={() => handleBorrarAreaCompleta(elementoSeleccionado.data?.id)}
                >
                  🗑 Borrar toda el área
                </button>
              )}
              {!layoutBloqueado && (
                <button
                  className="eg-btn eg-btn--danger eg-btn--sm"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    const tipo = elementoSeleccionado.tipo;
                    const id = elementoSeleccionado.data?.id;
                    const key = Object.keys(celdas).find(k => {
                      const c = celdas[k];
                      if (tipo === 'area') return c.tipo === TIPOS_CELDA.area && c.areaId === id;
                      return c.elementoId === id;
                    });
                    if (key) {
                      const [r, c] = key.split(',').map(Number);
                      handleBorrarCelda(r, c);
                    }
                    setElementoSeleccionado(null);
                  }}
                >
                  🗑 Borrar elemento
                </button>
              )}
            </div>
          )}

          {/* Leyenda */}
          <div className="eg-sidebar__section eg-leyenda">
            <h3 className="eg-label">Leyenda</h3>
            <div className="eg-leyenda-item"><span style={{ background: '#fef08a', border: '1px solid #000' }} />Mesa (🪑)</div>
            <div className="eg-leyenda-item"><span style={{ background: '#93c5fd', border: '1px solid #1d4ed8' }} />Silla suelta (💺)</div>
            <div className="eg-leyenda-item"><span style={{ background: '#7c2d12', border: '1px solid #ea580c' }} />Escenario (🎭)</div>
            {areas.map(a => (
              <div key={a.id} className="eg-leyenda-item">
                <span style={{ background: a.color + '33', border: `1px solid ${a.color}88` }} />
                {a.nombre}
              </div>
            ))}
          </div>
        </aside>

        {/* ── Canvas del grid ─────────────────────────────────────── */}
        <div className="eg-canvas-wrapper">
          <div
            className="eg-canvas-viewport"
            onMouseLeave={() => { isDragging.current = false; isPanning.current = false; }}
            onMouseUp={handleMouseUp}
          >
            <div
              className="eg-canvas-inner"
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transformOrigin: 'top left',
                position: 'relative',
                display: 'inline-block',
              }}
            >
              {/* Grid de celdas */}
              <div
                style={{ display: 'flex', flexDirection: 'column', userSelect: 'none' }}
                ref={gridRef}
              >
                {renderGrid()}
              </div>
              {/* Etiquetas de áreas superpuestas */}
              <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                {renderAreaLabels()}
              </div>
            </div>
          </div>

          {/* Controles de zoom */}
          <div className="eg-zoom-controls">
            <button className="eg-zoom-btn" onClick={() => setZoom(z => Math.min(2.5, z + 0.1))}>+</button>
            <span className="eg-zoom-label">{Math.round(zoom * 100)}%</span>
            <button className="eg-zoom-btn" onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}>−</button>
            <button className="eg-zoom-btn" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>⊡</button>
          </div>
        </div>
      </div>

      {/* ── Modal: Nombre del Área ──────────────────────────────────── */}
      {modalArea && (
        <div className="eg-modal-overlay" onClick={() => setModalArea(null)}>
          <div className="eg-modal" onClick={e => e.stopPropagation()}>
            <h2 className="eg-modal__title">📦 Nueva Área</h2>
            <p className="eg-modal__info">
              Celdas seleccionadas: {(modalArea.r2 - modalArea.r1 + 1)} filas × {(modalArea.c2 - modalArea.c1 + 1)} columnas
            </p>

            <label className="eg-label">Nombre del área *</label>
            <input
              className="eg-input"
              placeholder="ej: Área VIP, Área General, Gradería"
              value={formArea.nombre}
              onChange={e => setFormArea(p => ({ ...p, nombre: e.target.value }))}
              autoFocus
            />

            <label className="eg-label">Tipo de área</label>
            <select
              className="eg-select eg-select--full"
              value={formArea.tipo_area}
              onChange={e => setFormArea(p => ({ ...p, tipo_area: e.target.value }))}
            >
              <option value="SILLAS">Sillas / Mesas (elementos individuales)</option>
              <option value="PERSONAS">Personas de pie (zona general)</option>
            </select>

            {formArea.tipo_area === 'PERSONAS' && (
              <>
                <label className="eg-label" style={{ marginTop: 8 }}>Límite de Personas (Opcional)</label>
                <input
                  type="number"
                  className="eg-input"
                  placeholder="ej: 100"
                  min="1"
                  value={formArea.capacidad_personas}
                  onChange={e => setFormArea(p => ({ ...p, capacidad_personas: e.target.value }))}
                />
                <p className="eg-hint">Si lo dejas en blanco, no habrá límite de cupos en esta zona.</p>
              </>
            )}

            <label className="eg-label" style={{ marginTop: 8 }}>Tipo de precio del área</label>
            <select
              className="eg-select eg-select--full"
              value={formArea.tipo_precio_id}
              onChange={e => setFormArea(p => ({ ...p, tipo_precio_id: e.target.value }))}
            >
              <option value="">— Sin precio de área (definir por elemento) —</option>
              {tiposPrecio.map(tp => (
                <option key={tp.id} value={tp.id}>{tp.nombre} — Bs {parseFloat(tp.precio).toFixed(2)}</option>
              ))}
            </select>

            <label className="eg-label">Color del área</label>
            <div className="eg-color-grid">
              {COLORES_AREA.map(col => (
                <button
                  key={col.hex}
                  className={`eg-color-swatch${formArea.color === col.hex ? ' eg-color-swatch--activo' : ''}`}
                  style={{ background: col.hex }}
                  title={col.nombre}
                  onClick={() => setFormArea(p => ({ ...p, color: col.hex }))}
                />
              ))}
              <input type="color" value={formArea.color} onChange={e => setFormArea(p => ({ ...p, color: e.target.value }))} title="Color personalizado" className="eg-color-picker" />
            </div>

            <div className="eg-modal__actions">
              <button className="eg-btn eg-btn--secondary" onClick={() => setModalArea(null)}>Cancelar</button>
              <button className="eg-btn eg-btn--primary" onClick={confirmarArea}>✅ Crear Área</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Nueva Mesa ───────────────────────────────────────── */}
      {modalMesa && (
        <div className="eg-modal-overlay" onClick={() => setModalMesa(null)}>
          <div className="eg-modal" onClick={e => e.stopPropagation()}>
            <h2 className="eg-modal__title">🪑 Nueva Mesa</h2>
            <p className="eg-modal__info">
              Celda [{modalMesa.r},{modalMesa.c}]
            </p>

            <label className="eg-label">Área Asignada</label>
            <input
              className="eg-input"
              value={areas.find(a => a.id == modalMesa.areaId)?.nombre || '—'}
              disabled
              style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
            />

            <label className="eg-label" style={{ marginTop: '12px' }}>Nombre / Código de la mesa *</label>
            <input
              className="eg-input"
              placeholder="ej: M1A, Mesa 1 Izq., VIP-01"
              value={formMesa.nombre}
              onChange={e => setFormMesa(p => ({ ...p, nombre: e.target.value }))}
              autoFocus
            />

            <label className="eg-label">Cantidad de sillas</label>
            <input
              className="eg-input"
              type="number"
              min={1}
              max={20}
              value={formMesa.capacidad_sillas}
              onChange={e => setFormMesa(p => ({ ...p, capacidad_sillas: parseInt(e.target.value) || 1 }))}
            />
            <p className="eg-hint">💡 Se generará 1 boleto por cada silla al comprar la mesa completa.</p>

            <label className="eg-label">Tipo de precio</label>
            <select
              className="eg-select eg-select--full"
              value={formMesa.tipo_precio_id}
              onChange={e => setFormMesa(p => ({ ...p, tipo_precio_id: e.target.value }))}
            >
              <option value="">— Sin precio asignado —</option>
              {tiposPrecio.map(tp => (
                <option key={tp.id} value={tp.id}>{tp.nombre} — Bs {parseFloat(tp.precio).toFixed(2)}</option>
              ))}
            </select>

            <div className="eg-modal__actions">
              <button className="eg-btn eg-btn--secondary" onClick={() => setModalMesa(null)}>Cancelar</button>
              <button className="eg-btn eg-btn--primary" onClick={confirmarMesa}>✅ Colocar Mesa</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Nueva Silla ──────────────────────────────────────── */}
      {modalSilla && (
        <div className="eg-modal-overlay" onClick={() => setModalSilla(null)}>
          <div className="eg-modal" onClick={e => e.stopPropagation()}>
            <h2 className="eg-modal__title">💺 Nueva Silla</h2>
            <p className="eg-modal__info">
              Celda [{modalSilla.r},{modalSilla.c}]
            </p>

            <label className="eg-label">Área Asignada</label>
            <input
              className="eg-input"
              value={areas.find(a => a.id == modalSilla.areaId)?.nombre || '—'}
              disabled
              style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
            />

            <label className="eg-label" style={{ marginTop: '12px' }}>Nombre / Número de la silla *</label>
            <input
              className="eg-input"
              placeholder="ej: A1, Silla 12, S-001"
              value={formSilla.nombre}
              onChange={e => setFormSilla(p => ({ ...p, nombre: e.target.value }))}
              autoFocus
            />

            <label className="eg-label">Tipo de precio</label>
            <select
              className="eg-select eg-select--full"
              value={formSilla.tipo_precio_id}
              onChange={e => setFormSilla(p => ({ ...p, tipo_precio_id: e.target.value }))}
            >
              <option value="">— Sin precio asignado —</option>
              {tiposPrecio.map(tp => (
                <option key={tp.id} value={tp.id}>{tp.nombre} — Bs {parseFloat(tp.precio).toFixed(2)}</option>
              ))}
            </select>

            <div className="eg-modal__actions">
              <button className="eg-btn eg-btn--secondary" onClick={() => setModalSilla(null)}>Cancelar</button>
              <button className="eg-btn eg-btn--primary" onClick={confirmarSilla}>✅ Colocar Silla</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Editar Mesa / Silla ───────────────────────────────── */}
      {modalEditar && modalEditar.tipo === 'mesa' && (
        <div className="eg-modal-overlay" onClick={() => setModalEditar(null)}>
          <div className="eg-modal" onClick={e => e.stopPropagation()}>
            <h2 className="eg-modal__title">✏️ Editar Mesa</h2>

            <label className="eg-label">Nombre / Código de la mesa *</label>
            <input
              className="eg-input"
              placeholder="ej: M1A, Mesa 1 Izq., VIP-01"
              value={formMesa.nombre}
              onChange={e => setFormMesa(p => ({ ...p, nombre: e.target.value }))}
              autoFocus
            />

            <label className="eg-label">Cantidad de sillas</label>
            <input
              className="eg-input"
              type="number"
              min={1}
              max={20}
              value={formMesa.capacidad_sillas}
              onChange={e => setFormMesa(p => ({ ...p, capacidad_sillas: parseInt(e.target.value) || 1 }))}
            />

            <label className="eg-label">Tipo de precio</label>
            <select
              className="eg-select eg-select--full"
              value={formMesa.tipo_precio_id}
              onChange={e => setFormMesa(p => ({ ...p, tipo_precio_id: e.target.value }))}
            >
              <option value="">— Sin precio asignado —</option>
              {tiposPrecio.map(tp => (
                <option key={tp.id} value={tp.id}>{tp.nombre} — Bs {parseFloat(tp.precio).toFixed(2)}</option>
              ))}
            </select>

            <div className="eg-modal__actions">
              <button className="eg-btn eg-btn--secondary" onClick={() => setModalEditar(null)}>Cancelar</button>
              <button className="eg-btn eg-btn--primary" onClick={confirmarEditarMesa}>✅ Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      {modalEditar && modalEditar.tipo === 'silla' && (
        <div className="eg-modal-overlay" onClick={() => setModalEditar(null)}>
          <div className="eg-modal" onClick={e => e.stopPropagation()}>
            <h2 className="eg-modal__title">✏️ Editar Silla</h2>

            <label className="eg-label">Nombre / Número de la silla *</label>
            <input
              className="eg-input"
              placeholder="ej: A1, Silla 12, S-001"
              value={formSilla.nombre}
              onChange={e => setFormSilla(p => ({ ...p, nombre: e.target.value }))}
              autoFocus
            />

            <label className="eg-label">Tipo de precio</label>
            <select
              className="eg-select eg-select--full"
              value={formSilla.tipo_precio_id}
              onChange={e => setFormSilla(p => ({ ...p, tipo_precio_id: e.target.value }))}
            >
              <option value="">— Sin precio asignado —</option>
              {tiposPrecio.map(tp => (
                <option key={tp.id} value={tp.id}>{tp.nombre} — Bs {parseFloat(tp.precio).toFixed(2)}</option>
              ))}
            </select>

            <div className="eg-modal__actions">
              <button className="eg-btn eg-btn--secondary" onClick={() => setModalEditar(null)}>Cancelar</button>
              <button className="eg-btn eg-btn--primary" onClick={confirmarEditarSilla}>✅ Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EspacioGrid;
