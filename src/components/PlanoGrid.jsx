/**
 * PlanoGrid.jsx
 * Plano de selección de asientos/mesas para eventos con layout de cuadrícula.
 * Auto-fit: el plano se ajusta automáticamente al ancho/pantalla para que
 * se vea COMPLETO sin necesidad de deslizar (scroll), manteniendo controles de Zoom
 * para que el usuario pueda acercarse a una zona si lo desea.
 */
import { useState, useMemo, useEffect, useRef } from 'react';

const CELL_SIZE = 32; // px por celda a zoom 1.0
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;

// Colores para el plano del cliente
const COLORES = {
  vacio: '#ffffff',
  vacioHover: '#f8fafc',
  area: (color) => color + '28',
  escenario: '#f97316',
  mesa: {
    libre: '#fef08a',
    seleccionada: '#f59e0b',
    ocupada: '#e5e7eb',
  },
  silla: {
    libre: '#93c5fd',
    seleccionada: '#3b82f6',
    ocupada: '#e5e7eb',
  },
  textLibre: '#000000',
  textOcupada: '#9ca3af',
};

const PlanoGrid = ({
  evento,
  selecciones,          // [{type:'mesa'|'silla', id, precio, nombre, capacidad_sillas}]
  onToggleSeleccion,    // (item) => void
  asientosOcupados,     // [id, ...]
  mesasOcupadas,        // [id, ...]
  zonaSeleccionadaId,   // id del area (opcional)
}) => {
  const [hoveredKey, setHoveredKey] = useState(null);
  const [zoom, setZoom] = useState(1.0);
  const containerRef = useRef(null);

  // Reconstruir mapa de celdas desde los datos del evento
  const { celdas, areasFiltradas, mesasFiltradas, asientosFiltrados, minCol, maxCol, minRow, maxRow } = useMemo(() => {
    const areas = evento?.areas || [];
    const mesas = evento?.mesas || [];
    const asientos = evento?.asientos || [];

    const isFiltered = !!zonaSeleccionadaId;
    const filteredAreas = isFiltered ? areas.filter(a => String(a.id) === String(zonaSeleccionadaId)) : areas;
    const filteredMesas = mesas;
    const filteredAsientos = asientos;

    let minC = Infinity, minR = Infinity;
    let maxC = 0, maxR = 0;

    filteredAreas.forEach(a => {
      const c0 = parseInt(a.posicion_x) || 0;
      const r0 = parseInt(a.posicion_y) || 0;
      const endCol = c0 + (parseInt(a.ancho) || 1) - 1;
      const endRow = r0 + (parseInt(a.alto) || 1) - 1;
      if (c0 < minC) minC = c0;
      if (r0 < minR) minR = r0;
      if (endCol > maxC) maxC = endCol;
      if (endRow > maxR) maxR = endRow;
    });
    filteredMesas.forEach(m => {
      if (m.grid_col != null) {
        if (m.grid_col < minC) minC = m.grid_col;
        if (m.grid_col > maxC) maxC = m.grid_col;
      }
      if (m.grid_row != null) {
        if (m.grid_row < minR) minR = m.grid_row;
        if (m.grid_row > maxR) maxR = m.grid_row;
      }
    });
    filteredAsientos.forEach(a => {
      if (a.grid_col != null) {
        if (a.grid_col < minC) minC = a.grid_col;
        if (a.grid_col > maxC) maxC = a.grid_col;
      }
      if (a.grid_row != null) {
        if (a.grid_row < minR) minR = a.grid_row;
        if (a.grid_row > maxR) maxR = a.grid_row;
      }
    });

    // Escenario (solo si no hay filtro de zona, o ajustarlo si quieres verlo)
    if (evento?.escenario_x != null && !isFiltered) {
      const ex = parseInt(evento.escenario_x);
      const ey = parseInt(evento.escenario_y);
      const ew = parseInt(evento.escenario_width) || 1;
      const eh = parseInt(evento.escenario_height) || 1;
      if (ex < minC) minC = ex;
      if (ey < minR) minR = ey;
      if (ex + ew - 1 > maxC) maxC = ex + ew - 1;
      if (ey + eh - 1 > maxR) maxR = ey + eh - 1;
    }

    if (minC === Infinity) minC = 0;
    if (minR === Infinity) minR = 0;
    
    // Dejar un margen de 1 celda
    minC = Math.max(0, minC - 1);
    minR = Math.max(0, minR - 1);
    maxC = maxC + 1;
    maxR = maxR + 1;

    const celdas = {};

    filteredAreas.forEach(area => {
      const c0 = parseInt(area.posicion_x) || 0;
      const r0 = parseInt(area.posicion_y) || 0;
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

      for (let r = r0; r < r0 + rows; r++) {
        for (let c = c0; c < c0 + cols; c++) {
          if (!excluidas.some(ex => ex.r === r && ex.c === c)) {
            celdas[`${r},${c}`] = { tipo: 'area', areaId: area.id, color: area.color };
          }
        }
      }
    });

    filteredMesas.forEach(m => {
      if (m.grid_row != null && m.grid_col != null) {
        celdas[`${m.grid_row},${m.grid_col}`] = {
          tipo: 'mesa',
          id: m.id,
          label: m.codigo_mesa || m.numero_mesa,
          capacidad_sillas: m.capacidad_sillas,
          tipo_precio_id: m.tipo_precio_id,
          precio: parseFloat(m.tipo_precio_precio || m.precio_mesa_completa || 0),
          nombre: m.codigo_mesa || m.numero_mesa,
          area_nombre: m.area_nombre || '',
          tipo_precio_nombre: m.tipo_precio_nombre || '',
        };
      }
    });

    filteredAsientos.forEach(a => {
      if (a.grid_row != null && a.grid_col != null) {
        celdas[`${a.grid_row},${a.grid_col}`] = {
          tipo: 'silla',
          id: a.id,
          label: a.numero_asiento,
          tipo_precio_id: a.tipo_precio_id,
          precio: parseFloat(a.tipo_precio_precio || 0),
          nombre: a.numero_asiento,
          area_nombre: a.area_nombre || '',
          tipo_precio_nombre: a.tipo_precio_nombre || '',
        };
      }
    });

    if (!isFiltered) {
      let escCeldas = evento?.escenario_celdas;
      if (typeof escCeldas === 'string') {
        try { escCeldas = JSON.parse(escCeldas); } catch(e) {}
      }

      if (escCeldas && Array.isArray(escCeldas) && escCeldas.length > 0) {
        escCeldas.forEach(c => {
          celdas[`${c.r},${c.c}`] = { tipo: 'escenario', color: '#000000' };
        });
      } else if (evento?.escenario_x != null) {
        const ex = parseInt(evento.escenario_x);
        const ey = parseInt(evento.escenario_y);
        const ew = parseInt(evento.escenario_width) || 1;
        const eh = parseInt(evento.escenario_height) || 1;
        for (let r = ey; r < ey + eh; r++) {
          for (let c = ex; c < ex + ew; c++) {
            celdas[`${r},${c}`] = { tipo: 'escenario', color: '#000000' };
          }
        }
      }
    }

    return { celdas, areasFiltradas: filteredAreas, mesasFiltradas: filteredMesas, asientosFiltrados: filteredAsientos, minCol: minC, maxCol: maxC, minRow: minR, maxRow: maxR };
  }, [evento, zonaSeleccionadaId]);

  // Función para calcular el zoom óptimo que encaja todo en el contenedor
  const calcularAutoZoom = () => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth - 28; // márgenes/padding
    const totalCols = maxCol - minCol + 1;
    const totalRows = maxRow - minRow + 1;

    if (totalCols <= 0 || totalRows <= 0) return;

    const zoomW = containerWidth / (totalCols * CELL_SIZE + totalCols);
    const maxH = window.innerHeight * 0.70;
    const zoomH = maxH / (totalRows * CELL_SIZE + totalRows);

    // Ajuste automático exacto para que TODO se vea sin scroll
    const fitZoom = Math.min(zoomW, zoomH, 1.0);
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(fitZoom * 100) / 100));

    setZoom(clampedZoom);
  };

  // Auto-ajustar al cargar o cuando cambia la zona/datos o el tamaño de la ventana
  useEffect(() => {
    const t = setTimeout(calcularAutoZoom, 60);
    window.addEventListener('resize', calcularAutoZoom);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', calcularAutoZoom);
    };
  }, [maxCol, minCol, maxRow, minRow, zonaSeleccionadaId]);

  const seleccionadosIds = useMemo(() => {
    const set = new Set();
    selecciones.forEach(s => {
      if (s.type === 'mesa_completa') set.add(`mesa_${s.id}`);
      else if (s.type === 'asiento') set.add(`silla_${s.id}`);
      else set.add(`${s.type}_${s.id}`);
    });
    return set;
  }, [selecciones]);

  const handleClickCelda = (r, c) => {
    const key = `${r},${c}`;
    const celda = celdas[key];
    if (!celda) return;

    if (celda.tipo === 'mesa') {
      if (mesasOcupadas.includes(celda.id)) return;
      onToggleSeleccion({
        type: 'mesa_completa',
        id: celda.id,
        precio_total: celda.precio,
        precio: celda.precio,
        nombre: `Mesa ${celda.nombre}`,
        codigo_mesa: celda.nombre,
        cantidad_sillas: celda.capacidad_sillas,
        sillas: celda.capacidad_sillas + ' personas',
        tipo_precio_nombre: celda.tipo_precio_nombre,
        area_nombre: celda.area_nombre,
        mesa_id: celda.id,
      });
    } else if (celda.tipo === 'silla') {
      if (asientosOcupados.includes(celda.id)) return;
      onToggleSeleccion({
        type: 'asiento',
        id: celda.id,
        precio: celda.precio,
        nombre: `Silla ${celda.nombre}`,
        tipo_precio_nombre: celda.tipo_precio_nombre,
        area_nombre: celda.area_nombre,
      });
    }
  };

  // Renderizar celdas
  const renderCeldas = () => {
    const cols = [];
    const cellPx = Math.max(8, CELL_SIZE * zoom);

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const key = `${r},${c}`;
        const celda = celdas[key];
        const isHovered = hoveredKey === key;

        let bg = COLORES.vacio;
        let border = '#e2e8f0';
        let label = '';
        let cursor = 'default';
        let textColor = '#475569';
        let icon = '';

        if (!celda) {
          bg = isHovered ? '#f1f5f9' : COLORES.vacio;
          border = '#e2e8f0';
        } else if (celda.tipo === 'area') {
          bg = celda.color + '1A';
          border = celda.color + '60';
        } else if (celda.tipo === 'escenario') {
          bg = COLORES.escenario;
          border = '#000000';
          icon = '🎤';
          textColor = '#ffffff';
        } else if (celda.tipo === 'mesa') {
          const ocupada = mesasOcupadas.includes(celda.id);
          const seleccionada = seleccionadosIds.has(`mesa_${celda.id}`);
          if (ocupada) {
            bg = COLORES.mesa.ocupada;
            border = '#d1d5db';
            textColor = COLORES.textOcupada;
            cursor = 'not-allowed';
          } else if (seleccionada) {
            bg = COLORES.mesa.seleccionada;
            border = '#b45309';
            textColor = '#fff';
            cursor = 'pointer';
          } else {
            bg = isHovered ? '#fbbf24' : COLORES.mesa.libre;
            border = '#000000';
            textColor = COLORES.textLibre;
            cursor = 'pointer';
          }
          icon = '';
          label = celda.label;
        } else if (celda.tipo === 'silla') {
          const ocupada = asientosOcupados.includes(celda.id);
          const seleccionada = seleccionadosIds.has(`silla_${celda.id}`);
          if (ocupada) {
            bg = COLORES.silla.ocupada;
            border = '#d1d5db';
            textColor = COLORES.textOcupada;
            cursor = 'not-allowed';
          } else if (seleccionada) {
            bg = COLORES.silla.seleccionada;
            border = '#1d4ed8';
            textColor = '#fff';
            cursor = 'pointer';
          } else {
            bg = isHovered ? '#60a5fa' : COLORES.silla.libre;
            border = '#1d4ed8';
            textColor = '#1e3a5f';
            cursor = 'pointer';
          }
          icon = '';
          label = celda.label;
        }

        cols.push(
          <div
            key={key}
            title={
              celda?.tipo === 'mesa'
                ? `Mesa: ${celda.label} | ${celda.capacidad_sillas} sillas | Bs ${celda.precio?.toFixed(2)} | ${celda.area_nombre}`
                : celda?.tipo === 'silla'
                ? `Silla: ${celda.label} | Bs ${celda.precio?.toFixed(2)} | ${celda.area_nombre}`
                : ''
            }
            style={{
              width: cellPx,
              height: cellPx,
              backgroundColor: bg,
              border: `1px solid ${border}`,
              boxSizing: 'border-box',
              cursor,
              position: 'relative',
              flexShrink: 0,
              userSelect: 'none',
              transition: 'background-color 0.1s',
            }}
            onMouseEnter={() => setHoveredKey(key)}
            onMouseLeave={() => setHoveredKey(null)}
            onClick={() => handleClickCelda(r, c)}
          >
            {label && (
              <span style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                fontSize: (() => {
                  const len = String(label).length;
                  let base = 12;
                  if (len <= 2) base = 13;
                  else if (len <= 3) base = 11;
                  else if (len <= 4) base = 9.5;
                  else if (len <= 5) base = 8;
                  else if (len <= 6) base = 7;
                  else base = 6.2;
                  return Math.max(5.5, Math.round(base * zoom * 10) / 10);
                })(),
                fontWeight: 800, color: textColor,
                lineHeight: 1.05, textAlign: 'center', padding: '1px',
                letterSpacing: String(label).length >= 5 ? '-0.4px' : 'normal',
                overflow: 'hidden', pointerEvents: 'none',
                wordBreak: 'break-word',
              }}>
                {zoom > 0.65 && icon && <span>{icon}</span>}
                {zoom >= 0.3 && <span>{label}</span>}
              </span>
            )}
          </div>
        );
      }
    }

    return (
      <div
        className="plano-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${maxCol - minCol + 1}, ${cellPx}px)`,
          gridTemplateRows: `repeat(${maxRow - minRow + 1}, ${cellPx}px)`,
          gap: '1px',
          backgroundColor: '#e2e8f0',
          padding: '1px',
          boxSizing: 'border-box',
          width: 'max-content',
          margin: '0 auto', // Centrar horizontalmente el plano en su contenedor
        }}
      >
        {cols}
      </div>
    );
  };

  // Etiquetas de áreas superpuestas
  const renderAreaLabels = () => {
    const cellPx = Math.max(8, CELL_SIZE * zoom) + 1;
    return areasFiltradas.map(area => (
      <div
        key={area.id}
        style={{
          position: 'absolute',
          left: ((parseInt(area.posicion_x) || 0) - minCol) * cellPx + 4,
          top: ((parseInt(area.posicion_y) || 0) - minRow) * cellPx + 2,
          background: (area.color || '#666') + 'D0',
          color: '#fff',
          fontSize: Math.max(8, Math.round(11 * zoom)),
          fontWeight: 800,
          padding: '1px 5px',
          borderRadius: 3,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          maxWidth: (parseInt(area.ancho) || 1) * cellPx - 8,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textShadow: '0 1px 2px #000a',
          zIndex: 10,
        }}
      >
        {zoom >= 0.35 ? area.nombre : ''}
      </div>
    ));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: '#475569', marginBottom: 2 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: COLORES.mesa.libre, border: '1px solid #f59e0b' }} />
          Mesa disponible
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: COLORES.silla.libre, border: '1px solid #60a5fa' }} />
          Silla disponible
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: COLORES.mesa.seleccionada, border: '1px solid #b45309' }} />
          Seleccionado
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: COLORES.mesa.ocupada, border: '1px solid #d1d5db' }} />
          Ocupado
        </span>
      </div>

      {/* Controles de zoom */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Zoom:</span>
        <button onClick={() => setZoom(z => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 10) / 10))} style={btnStyle}>+</button>
        <span style={{ fontSize: 12, color: '#1e293b', minWidth: 42, textAlign: 'center', fontWeight: 700 }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 10) / 10))} style={btnStyle}>−</button>
        <button onClick={() => setZoom(1.0)} style={{ ...btnStyle, fontSize: 11, padding: '2px 7px' }} title="Zoom 100%">100%</button>
        <button
          onClick={calcularAutoZoom}
          style={{ ...btnStyle, fontSize: 11, padding: '2px 8px', color: '#2563eb', borderColor: '#bfdbfe', background: '#eff6ff', fontWeight: 600 }}
          title="Ajustar para ver todo el plano completo en pantalla"
        >
          ⤢ Ver Todo
        </button>
      </div>

      {/* Contenedor del plano adaptativo: todo el plano visible sin scrollbars forzados */}
      <div
        ref={containerRef}
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          background: '#f8fafc',
          position: 'relative',
          width: '100%',
          overflowX: 'auto',
          overflowY: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '12px 6px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'inline-flex', flexDirection: 'column', position: 'relative' }}>
          {renderCeldas()}
          {/* Etiquetas de área */}
          <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
            {renderAreaLabels()}
          </div>
        </div>
      </div>

      {/* Tooltip info del hover */}
      {hoveredKey && celdas[hoveredKey] && (celdas[hoveredKey].tipo === 'mesa' || celdas[hoveredKey].tipo === 'silla') && (
        <div style={{
          background: '#ffffff', border: '1px solid #cbd5e1',
          borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#1e293b',
          display: 'flex', gap: 16, boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
          flexWrap: 'wrap',
        }}>
          {celdas[hoveredKey].tipo === 'mesa' ? (
            <>
              <span>🪑 <strong>Mesa:</strong> {celdas[hoveredKey].label}</span>
              <span>👥 <strong>Sillas:</strong> {celdas[hoveredKey].capacidad_sillas}</span>
              <span>💰 <strong>Precio:</strong> Bs {celdas[hoveredKey].precio?.toFixed(2)}</span>
              {celdas[hoveredKey].area_nombre && <span>📍 {celdas[hoveredKey].area_nombre}</span>}
            </>
          ) : (
            <>
              <span>💺 <strong>Silla:</strong> {celdas[hoveredKey].label}</span>
              <span>💰 <strong>Precio:</strong> Bs {celdas[hoveredKey].precio?.toFixed(2)}</span>
              {celdas[hoveredKey].area_nombre && <span>📍 {celdas[hoveredKey].area_nombre}</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const btnStyle = {
  padding: '2px 8px',
  background: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: 4,
  color: '#334155',
  cursor: 'pointer',
  fontSize: 14,
};

export default PlanoGrid;